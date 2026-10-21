/**
 * 一轮完整流程（L1/L2 抓取 → 归一化 → 门槛校验 → 事务 upsert → L4 核验 →
 * 渲染 format-1 索引与静态页 → 发布 → 写运行摘要）。
 *
 * 阶段顺序有意为之：
 *   Phase A（L4 核验）先跑 —— 用轮次开始时的库内状态做 diff；
 *   Phase B（信源合并入库）后跑 —— 此时库内状态已含 L4 的新信号，
 *           合并时能正确判断「npm 出现更高版本」而不误报。
 *
 * 每个写阶段独立事务：某阶段失败不影响已提交阶段，也便于崩溃后续跑。
 */
import { log } from './log.mjs'
import { createPool, withTransaction, loadCatalog, readContractVersion, upsertPlugin, syncPluginSources, insertEvent } from './db.mjs'
import { HttpClient } from './http.mjs'
import { mergeCandidates, applyAdmissionGate, persistCandidates, applyVerification } from './catalog.mjs'
import { fetchSource, searchGithubTopic, searchNpmKeywords, verifyPlugin } from './collect.mjs'
import { readState, writeState, readSourceSnapshot, writeSourceSnapshot, readCursor, writeCursor, writeLastRun } from './state.mjs'
import { renderMarketIndex } from './render-index.mjs'
import { buildBrowseData, renderBrowsePage } from './render-page.mjs'
import { publish } from './publish.mjs'
import { parseMarketIndex } from '@deepseek-ai/dsh-plugin-market-index'
import { contractId, buildInstallSpec, isValidNpmName, parseGithubUrl } from './normalize.mjs'

const SUPPORTED_CONTRACT_MAJOR = 0

export async function runHarvester(config, options = {}) {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  const summary = {
    at: startedAt,
    durationMs: 0,
    contractVersion: null,
    sources: { ok: [], failed: [], skipped: [] },
    newPlugins: 0,
    updatedPlugins: 0,
    unchangedPlugins: 0,
    admittedCandidates: 0,
    rejectedCandidates: 0,
    verified: 0,
    events: 0,
    eventKinds: {},
    removedFromLists: 0,
    indexPlugins: 0,
    published: null,
    errors: 0,
  }

  const pool = createPool(config)
  const http = new HttpClient({
    userAgent: config.userAgent,
    githubToken: config.githubToken,
    timeoutMs: config.httpTimeoutMs,
    retries: config.httpRetries,
    concurrency: config.httpConcurrency,
  })
  http.npmRatePerHour = config.npmRatePerMinute * 60

  try {
    // 契约版本自检（契约 §9）：major 不兼容时中止
    const contractVersion = await readContractVersion(pool)
    summary.contractVersion = contractVersion
    if (Number(contractVersion.major ?? 0) !== SUPPORTED_CONTRACT_MAJOR) {
      throw new Error(`契约 major=${contractVersion.major}，本发现器支持 ${SUPPORTED_CONTRACT_MAJOR}`)
    }
    log.info('开始一轮采集', { contractVersion, dryRun: Boolean(options.dryRun) })

    // ---------------- Phase A：L4 单点核验 ----------------
    const state0 = await loadCatalog(pool)
    const verification = await runVerificationPhase(pool, http, config, state0, summary, options)
    summary.verified = verification.checked

    // ---------------- Phase B：信源抓取 + 合并入库 ----------------
    const collected = await collectAllSources(http, config, summary)
    const state1 = await loadCatalog(pool)

    const sourceSnapshots = new Map()
    for (const source of [...config.sources.curated, ...config.sources.indexes]) {
      if (!source.votes) continue
      sourceSnapshots.set(source.source_id, await readSourceSnapshot(pool, source.source_id))
    }

    const candidates = mergeCandidates(collected, config.categories.alias ?? {}, config.knownCategories)
    const persisted = await withTransaction(pool, (client) => persistCandidates(client, candidates, state1, {
      sourceSnapshots,
      aliasMap: config.categories.alias ?? {},
      knownCategories: config.knownCategories,
    }))

    summary.newPlugins = persisted.inserted
    summary.updatedPlugins = persisted.updated
    summary.unchangedPlugins = persisted.unchanged
    summary.removedFromLists = persisted.removed.length
    for (const event of persisted.events) {
      summary.events += 1
      summary.eventKinds[event.kind] = (summary.eventKinds[event.kind] ?? 0) + 1
    }
    for (const event of verification.events) {
      summary.events += 1
      summary.eventKinds[event.kind] = (summary.eventKinds[event.kind] ?? 0) + 1
    }

    // 写入本轮信源快照（下一轮的 removed-from-list 判定基准）
    for (const { source, entries } of collected) {
      if (!source.votes) continue
      const ids = entries.map((e) => e.parsed ? contractId(e.parsed.owner, e.parsed.repo, e.parsed.subPath) : null).filter(Boolean)
      await writeSourceSnapshot(pool, source.source_id, ids, { title: source.title, url: source.url })
    }

    // ---------------- Phase C：L3 候选池 + 入库门槛 ----------------
    await runCandidatePhase(pool, http, config, state1, summary)

    // ---------------- Phase D：渲染 + 校验 + 发布 ----------------
    const state2 = await loadCatalog(pool)
    const index = renderMarketIndex(state2)
    summary.indexPlugins = index.plugins.length

    const indexUrl = `${config.indexBaseUrl.replace(/\/+$/, '')}/index.json`
    validateIndex(index, indexUrl)

    const page = renderBrowsePage(buildBrowseData(state2), { generatedAt: new Date().toISOString() })
    const files = new Map([
      ['index.json', JSON.stringify(index, null, 2)],
      ['index.html', page],
    ])

    if (!options.dryRun) {
      const published = await publish(config, files)
      summary.published = published
    } else {
      summary.published = { target: '(dry-run 未发布)', written: [...files.keys()] }
    }

    // ---------------- 汇总 ----------------
    summary.durationMs = Date.now() - startedMs
    if (!options.dryRun) await writeLastRun(pool, summary)
    else log.info('dry-run：未写入任何数据库状态', { summary })
    return summary
  } catch (error) {
    summary.errors += 1
    summary.durationMs = Date.now() - startedMs
    log.error('本轮采集失败', { error: String(error?.message ?? error) })
    if (!options.dryRun) {
      await writeLastRun(pool, { ...summary, failed: String(error?.message ?? error) }).catch(() => {})
    }
    throw error
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * 离线模式：不连数据库，只跑「抓信源 → 归一化 → 门槛 → 渲染 → 校验」。
 *
 * 用途：
 * - 改了解析器或信源配置后，先离线验证真实清单的解析结果；
 * - 数据库凭据未就位时，先产出可发布的 index.json 预览；
 * - 排查信源挂了哪一条。
 */
export async function runOffline(config, options = {}) {
  const startedMs = Date.now()
  const summary = {
    mode: 'offline',
    at: new Date().toISOString(),
    sources: { ok: [], failed: [], skipped: [] },
    candidates: 0,
    rejected: 0,
    indexPlugins: 0,
    published: null,
    errors: 0,
  }

  const http = new HttpClient({
    userAgent: config.userAgent,
    githubToken: config.githubToken,
    timeoutMs: config.httpTimeoutMs,
    retries: config.httpRetries,
    concurrency: config.httpConcurrency,
  })
  http.npmRatePerHour = config.npmRatePerMinute * 60

  const collected = await collectAllSources(http, config, summary)
  const candidates = mergeCandidates(collected, config.categories.alias ?? {}, config.knownCategories)

  // 门槛校验（无库可比对，用「是否被任一策展源收录」代替）
  const catalog = { plugins: [], categories: [] }
  for (const c of candidates.values()) {
    const gated = applyAdmissionGate(c, { curated: c.votes > 0 })
    if (!gated.ok) {
      summary.rejected += 1
      continue
    }
    catalog.plugins.push({
      ...gated.row,
      status: 'active',
      sources: [...c.sources].sort(),
      consensus_votes: c.votes,
      git_commit: '',
    })
  }
  summary.candidates = catalog.plugins.length

  // 分类声明
  const declared = new Map()
  for (const c of catalog.plugins) {
    if (c.category_id && !declared.has(c.category_id)) declared.set(c.category_id, c.category_id)
  }
  catalog.categories = [...declared.keys()].map((id) => ({
    id, title_zh: id, title_en: id, builtin: false,
  }))

  const index = renderMarketIndex(catalog)
  summary.indexPlugins = index.plugins.length
  const indexUrl = `${config.indexBaseUrl.replace(/\/+$/, '')}/index.json`
  validateIndex(index, indexUrl)

  const page = renderBrowsePage(buildBrowseData(catalog), { generatedAt: new Date().toISOString() })
  const published = await publish(config, new Map([
    ['index.json', JSON.stringify(index, null, 2)],
    ['index.html', page],
  ]))
  summary.published = published
  summary.durationMs = Date.now() - startedMs
  return summary
}

// ---------------------------------------------------------------------------
// Phase A：L4 核验
// ---------------------------------------------------------------------------

async function runVerificationPhase(pool, http, config, state, summary, options = {}) {
  const events = []
  const { rows } = await pool.query(
    `SELECT p.id, p.github, p.npm, p.status, p.npm_versions, p.stars, p.last_push_at,
            p.license, p.git_commit, p.updated_at, c.checked_at, c.miss_streak, c.signals_hash
       FROM plugins p
       LEFT JOIN plugin_checks c ON c.plugin_id = p.id
      WHERE p.status <> 'gone'
      ORDER BY c.checked_at ASC NULLS FIRST, p.id ASC
      LIMIT $1`,
    [config.verifyMaxPerRun],
  )
  if (rows.length === 0) return { checked: 0, events }

  const previousById = new Map(state.plugins.map((p) => [p.id, p]))
  let checked = 0
  let lastId = null

  for (const row of rows) {
    const previous = previousById.get(row.id)
    const verification = await verifyPlugin(http, config, row)
    checked += 1
    lastId = row.id

    if (!options.dryRun) {
      const applied = await withTransaction(pool, (client) => applyVerification(client, row.id, previous, verification, config))
      for (const event of applied.events) {
        events.push(event)
        log.info('状态变化', { plugin: event.pluginId, kind: event.kind, detail: event.detail })
      }
    }
    if (checked % 25 === 0) log.debug('L4 核验进度', { checked, total: rows.length })
  }

  await writeCursor(pool, 'l4', {
    lastCheckedAt: new Date().toISOString(),
    lastPluginId: lastId,
    checked,
    batchSize: rows.length,
  }).catch(() => {})

  return { checked, events }
}

// ---------------------------------------------------------------------------
// Phase B：信源抓取
// ---------------------------------------------------------------------------

async function collectAllSources(http, config, summary) {
  const collected = []
  const all = [
    ...config.sources.curated.map((s) => ({ ...s, layer: 'L1' })),
    ...config.sources.indexes.map((s) => ({ ...s, layer: 'L2' })),
  ]
  for (const source of all) {
    if (!source.enabled) {
      summary.sources.skipped.push({ source_id: source.source_id, reason: source.url ? 'disabled' : 'url-missing' })
      log.warn('信源已跳过', { source: source.source_id, reason: source.url ? 'disabled' : 'url-missing' })
      continue
    }
    const result = await fetchSource(http, source)
    if (result.ok) {
      summary.sources.ok.push({ source_id: source.source_id, layer: source.layer, entries: result.entries.length })
      log.info('信源抓取完成', { source: source.source_id, layer: source.layer, entries: result.entries.length })
    } else {
      summary.sources.failed.push({ source_id: source.source_id, layer: source.layer, error: result.error })
      summary.errors += 1
    }
    collected.push({ source, entries: result.entries })
  }
  return collected
}

// ---------------------------------------------------------------------------
// Phase C：L3 候选池
// ---------------------------------------------------------------------------

async function runCandidatePhase(pool, http, config, state, summary) {
  const candidatesConfig = config.sources.candidates ?? {}
  const known = new Set(state.plugins.map((p) => p.id))
  const seen = new Set()
  const pending = []

  if (candidatesConfig.github_topic?.enabled) {
    const cursor = await readCursor(pool, 'candidate:topic', { page: 1 })
    const result = await searchGithubTopic(http, config, cursor)
    await writeCursor(pool, 'candidate:topic', result.cursor).catch(() => {})
    for (const entry of result.entries) {
      const id = contractId(entry.parsed.owner, entry.parsed.repo, '')
      if (known.has(id) || seen.has(id)) continue
      seen.add(id)
      pending.push({ id, entry: { ...entry, sourceId: candidatesConfig.github_topic.source_id } })
    }
  }

  if (candidatesConfig.npm_keywords?.enabled) {
    const cursor = await readCursor(pool, 'candidate:npm', { from: 0 })
    const result = await searchNpmKeywords(http, config, cursor)
    await writeCursor(pool, 'candidate:npm', result.cursor).catch(() => {})
    for (const entry of result.entries) {
      if (!entry.parsed) continue
      const id = contractId(entry.parsed.owner, entry.parsed.repo, '')
      if (known.has(id) || seen.has(id)) continue
      seen.add(id)
      pending.push({ id, entry: { ...entry, sourceId: candidatesConfig.npm_keywords.source_id } })
    }
  }

  const batch = pending.slice(0, config.candidatePerRun)
  if (batch.length === 0) return

  let admitted = 0
  let rejected = 0

  for (const { id, entry } of batch) {
    // 门槛 ①：仓库 package.json 含 dsh.bundle 声明
    const hasBundle = await hasBundleDeclaration(http, entry)
    if (!hasBundle) {
      rejected += 1
      summary.rejectedCandidates += 1
      continue
    }
    const candidate = {
      id,
      owner: entry.parsed.owner,
      repo: entry.parsed.repo,
      subPath: '',
      github: entry.parsed.baseUrl,
      name: entry.displayName || entry.npm || id,
      descZh: '',
      descEn: entry.description ?? '',
      npm: entry.npm && isValidNpmName(entry.npm) ? entry.npm : '',
      categoryId: '',
      versions: [],
      votes: 0,
      sources: new Set([entry.sourceId]),
    }
    const gated = applyAdmissionGate(candidate, { requiresBundleDeclaration: true, hasBundleDeclaration: hasBundle })
    if (!gated.ok) {
      rejected += 1
      summary.rejectedCandidates += 1
      continue
    }
    await withTransaction(pool, async (client) => {
      const result = await upsertPlugin(client, gated.row)
      await syncPluginSources(client, gated.row.id, [...candidate.sources])
      if (result === 'inserted') {
        await insertEvent(client, gated.row.id, 'new-plugin', { sources: [...candidate.sources].sort() })
      }
    })
    admitted += 1
    summary.admittedCandidates += 1
    log.info('候选池条目入库', { id, npm: gated.row.npm })
  }

  log.info('候选池处理完成', { pending: pending.length, admitted, rejected })
}

/** 读取仓库 package.json，判断是否声明 dsh.bundle。 */
async function hasBundleDeclaration(http, entry) {
  const parsed = entry.parsed
  if (!parsed) return false
  try {
    const res = await http.json(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/package.json`,
    )
    const content = typeof res?.content === 'string' ? Buffer.from(res.content, 'base64').toString('utf8') : ''
    if (!content) return false
    const json = JSON.parse(content)
    return Boolean(json?.dsh?.bundle)
  } catch (error) {
    log.debug('读取 package.json 失败', { repo: `${parsed.owner}/${parsed.repo}`, error: String(error?.message ?? error) })
    return false
  }
}

// ---------------------------------------------------------------------------
// 索引自验（官方 parseMarketIndex）
// ---------------------------------------------------------------------------

export function validateIndex(index, indexUrl) {
  try {
    const parsed = parseMarketIndex(index, indexUrl)
    log.info('index.json 通过官方 parseMarketIndex 校验', { plugins: parsed.plugins.length })
    return parsed
  } catch (error) {
    const detail = `${error?.path ?? '$'} ${error?.reason ?? error?.message ?? String(error)}`
    throw new Error(`index.json 未通过官方 format-1 校验：${detail}`)
  }
}
