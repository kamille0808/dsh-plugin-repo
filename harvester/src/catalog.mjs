/**
 * 归一化 → 门槛校验 → 事务 upsert → 事件。
 *
 * 纪律（契约 §1、§4、§6）：
 * - 发现器是 catalog 的唯一写者；ratings 只读。
 * - 只存原始信号，不存算好的评分（评分是消费侧策略，§7）。
 * - 变化才写事件：new-plugin / update-available / renamed / archived / removed-from-list。
 * - events.kind 受 CHECK 约束，只有这五种。
 */
import { log } from './log.mjs'
import {
  contractId, buildInstallSpec, resolveCategoryId, isValidNpmName,
  normalizeNpmVersions, latestVersion, compareSemver, signalsHash, parseContractId,
} from './normalize.mjs'
import {
  upsertPlugins, syncPluginSourcesBatch, upsertCheck, insertEvent, renamePlugin, upsertCategory,
} from './db.mjs'
import { syntheticNpmName } from './collect.mjs'

/**
 * 把各信源条目合并成统一候选集。
 * @param {Array<{source: object, entries: Array<object>}>} collected
 */
export function mergeCandidates(collected, aliasMap, knownCategories = null) {
  const candidates = new Map()

  for (const { source, entries } of collected) {
    for (const entry of entries) {
      const parsed = entry.parsed
      if (!parsed) continue
      const id = contractId(parsed.owner, parsed.repo, parsed.subPath)
      let c = candidates.get(id)
      if (!c) {
        c = {
          id,
          owner: parsed.owner,
          repo: parsed.repo,
          subPath: parsed.subPath,
          github: `https://github.com/${parsed.owner}/${parsed.repo}`,
          name: '',
          descZh: '',
          descEn: '',
          npm: '',
          categoryId: '',
          categoryTitle: '',
          versions: [],
          sources: new Set(),
          votes: 0,
          homepage: '',
          engines: '',
        }
        candidates.set(id, c)
      }

      c.sources.add(source.source_id)
      if (source.votes) c.votes += 1

      // 展示名：先到先得（注册表顺序即优先级，awesome 在最前）
      if (!c.name) c.name = entry.displayName ?? ''

      // 描述：format-1 索引源带完整的中英双语，优先采纳；
      // markdown 清单只有单语描述（通常是英文），只在没有更好的来源时补位。
      const isBilingual = source.kind === 'market-index'
      if (isBilingual) {
        if (entry.descEn) c.descEn = entry.descEn
        if (entry.descZh) c.descZh = entry.descZh
      } else {
        if (!c.descEn && entry.description) c.descEn = entry.description
      }

      if (!c.npm && entry.npm && isValidNpmName(entry.npm)) c.npm = entry.npm
      if (!c.homepage && entry.homepage) c.homepage = entry.homepage
      if (!c.engines && entry.engines) c.engines = entry.engines
      if (!c.categoryTitle && entry.categoryTitle) c.categoryTitle = entry.categoryTitle
      if (Array.isArray(entry.versions) && entry.versions.length > 0) {
        c.versions = mergeVersions(c.versions, entry.versions)
      }
    }
  }

  for (const c of candidates.values()) {
    c.categoryId = resolveCategoryId(c.categoryTitle, aliasMap, knownCategories)
  }
  return candidates
}

function mergeVersions(a, b) {
  const map = new Map()
  for (const v of [...a, ...b]) {
    if (!v?.ver) continue
    const prev = map.get(v.ver)
    if (!prev || (prev.time === null && v.time !== null)) map.set(v.ver, { ver: v.ver, time: v.time ?? null })
  }
  return normalizeNpmVersions([...map.values()])
}

/**
 * 入库门槛（契约 §4）。对 L1/L2 直接收录的条目也要过 install_spec 口径；
 * 对 L3 候选池则额外要求「package.json 含 dsh.bundle 声明 或 已被人工策展源收录」。
 *
 * @returns {{ok: true, row: object} | {ok: false, reason: string}}
 */
export function applyAdmissionGate(candidate, { requiresBundleDeclaration = false, hasBundleDeclaration = false, curated = false } = {}) {
  const npm = candidate.npm && isValidNpmName(candidate.npm) ? candidate.npm : ''
  const installSpec = buildInstallSpec({
    npm,
    owner: candidate.owner,
    repo: candidate.repo,
    subPath: candidate.subPath,
  })
  if (!installSpec) {
    return { ok: false, reason: 'install-spec-invalid' }
  }
  if (requiresBundleDeclaration && !hasBundleDeclaration && !curated) {
    return { ok: false, reason: 'no-bundle-declaration' }
  }
  const name = candidate.name || npm || `${candidate.owner}/${candidate.repo}`
  return {
    ok: true,
    row: {
      id: candidate.id,
      name,
      npm,
      install_spec: installSpec,
      github: candidate.github,
      category_id: candidate.categoryId ?? '',
      desc_zh: candidate.descZh ?? '',
      desc_en: candidate.descEn ?? '',
      license: candidate.license ?? '',
      stars: candidate.stars ?? 0,
      last_push_at: candidate.lastPushAt ?? null,
      npm_versions: candidate.versions ?? [],
      consensus_votes: candidate.votes ?? 0,
      status: candidate.status ?? 'active',
      git_commit: candidate.gitCommit ?? '',
    },
  }
}

/**
 * 把本轮合并结果写进 PG。
 *
 * @param {import('pg').PoolClient} client
 * @param {Map<string, object>} candidates
 * @param {object} existing  库内现状（loadCatalog 的结果）
 * @param {object} options
 * @returns {{inserted: number, updated: number, unchanged: number, events: Array, removed: Array}}
 */
export async function persistCandidates(client, candidates, existing, options = {}) {
  const { sourceSnapshots = new Map(), aliasMap = {}, knownCategories = null, batchSize = 400 } = options
  const failedSources = new Set(options.failedSources ?? [])
  const stats = { inserted: 0, updated: 0, unchanged: 0, events: [] }
  const existingById = new Map(existing.plugins.map((p) => [p.id, p]))
  const nextSources = new Map()

  // 1) 逐条过门槛 + 合并库内已有信号
  const rows = []
  for (const c of candidates.values()) {
    const gated = applyAdmissionGate(c)
    if (!gated.ok) {
      log.debug('条目未过入库门槛', { id: c.id, reason: gated.reason })
      continue
    }
    const row = gated.row
    const previous = existingById.get(row.id)

    // 保留库内已有的核验信号（避免信源列表覆盖 L4 事实）
    if (previous) {
      row.stars = previous.stars
      row.last_push_at = previous.last_push_at
      row.license = previous.license
      row.git_commit = previous.git_commit
      row.npm_versions = mergeVersions(previous.npm_versions ?? [], row.npm_versions)
      row.status = previous.status === 'gone' ? 'gone' : previous.status
    }

    rows.push({ row, previous, sources: [...c.sources].sort() })
    nextSources.set(row.id, [...c.sources].sort())
  }

  // 2) 批量 upsert
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const result = await upsertPlugins(client, batch.map((b) => b.row))
    stats.inserted += result.inserted
    stats.updated += result.updated
    stats.unchanged += result.unchanged

    // 新增行：写 new-plugin 事件；已有行：npm 出现更高版本 → update-available
    for (const b of batch) {
      if (!existingById.has(b.row.id)) {
        stats.events.push({
          kind: 'new-plugin',
          pluginId: b.row.id,
          detail: { sources: b.sources },
        })
      } else {
        const updateEvent = detectUpdateEvent(b.previous, b.row)
        if (updateEvent) stats.events.push(updateEvent)
      }
    }
  }

  // 3) 批量维护收录来源
  await syncPluginSourcesBatch(client, rows.map((b) => ({ plugin_id: b.row.id, source_ids: b.sources })))

  // 4) 分类增补：信源里出现的契约外分类（白名单内的已由 migrations 播种）
  const categoryIds = [...new Set(rows.map((b) => b.row.category_id).filter(Boolean))]
  for (const categoryId of categoryIds) {
    await upsertCategory(client, categoryId, '', '', false)
  }

  // 5) removed-from-list：信源上轮收录、本轮不再收录
  // 抓取失败的源一律跳过：它本轮没有数据，不代表它把条目移除了
  const removed = []
  for (const [sourceId, previousIds] of sourceSnapshots) {
    if (failedSources.has(sourceId)) {
      log.warn('信源本轮抓取失败，跳过 removed-from-list 判定', { source: sourceId })
      continue
    }
    const currentIds = new Set()
    for (const [pluginId, sources] of nextSources) {
      if (sources.includes(sourceId)) currentIds.add(pluginId)
    }
    for (const pluginId of previousIds) {
      if (currentIds.has(pluginId)) continue
      const stillExists = existingById.has(pluginId)
      removed.push({ sourceId, pluginId, stillExists })
      stats.events.push({ kind: 'removed-from-list', pluginId, detail: { source_id: sourceId } })
    }
  }

  // 6) 事件落库
  for (const event of stats.events) {
    await insertEvent(client, event.pluginId, event.kind, event.detail)
  }

  return { ...stats, removed }
}

/** npm 出现更高版本 → update-available（契约 §6）。 */
function detectUpdateEvent(previous, row) {
  if (!previous) return null
  const before = latestVersion(previous.npm_versions ?? [])
  const after = latestVersion(row.npm_versions ?? [])
  if (!before || !after || before === after) return null
  const cmp = compareSemver(after, before)
  if (cmp <= 0) return null
  return { kind: 'update-available', pluginId: row.id, detail: { from: before, to: after } }
}

/**
 * 应用 L4 核验结果：更新原始信号、状态迁移与事件。
 */
export async function applyVerification(client, pluginId, previous, verification, config) {
  const events = []
  const now = new Date().toISOString()

  if (!verification.ok) {
    await upsertCheck(client, pluginId, now, signalsHash({ error: verification.error }), previous?.check?.miss_streak ?? 0)
    return { events, missing: false }
  }

  if (verification.missing) {
    // 连续多轮 404 → gone（终态墓碑，契约 §6）
    const streak = (previous?.check?.miss_streak ?? 0) + 1
    await upsertCheck(client, pluginId, now, signalsHash({ missing: true }), streak)
    if (streak >= config.goneMissThreshold && previous?.status !== 'gone') {
      await client.query(`UPDATE plugins SET status = 'gone' WHERE id = $1 AND status <> 'gone'`, [pluginId])
      events.push({ kind: 'archived', pluginId, detail: { reason: `连续 ${streak} 轮核验 404` } })
    }
    return { events, missing: true }
  }

  const hash = signalsHash({
    stars: verification.stars,
    pushedAt: verification.pushedAt,
    archived: verification.archived,
    headCommit: verification.headCommit,
    npm: verification.npmVersions?.map((v) => v.ver) ?? [],
  })

  // 仓库改名：契约 §6 —— id/github 更新，status 保持 active，记 renamed 事件
  if (verification.renamedTo) {
    const parsedId = parseContractId(pluginId)
    const newId = contractId(verification.renamedTo.owner, verification.renamedTo.repo, parsedId?.subPath ?? '')
    const newGithub = `https://github.com/${verification.renamedTo.owner}/${verification.renamedTo.repo}`
    if (newId !== pluginId) {
      await renamePlugin(client, pluginId, newId, newGithub)
      events.push({ kind: 'renamed', pluginId: newId, detail: { from: pluginId, to: newId } })
      await upsertCheck(client, newId, now, hash, 0)
      return { events, missing: false, renamedTo: newId }
    }
  }

  const npmVersions = verification.npmVersions?.length
    ? mergeVersions(previous?.npm_versions ?? [], verification.npmVersions)
    : (previous?.npm_versions ?? [])

  const updated = await client.query(
    `UPDATE plugins SET
        stars = $2, last_push_at = $3, license = $4, npm_versions = $5::jsonb, git_commit = $6
      WHERE id = $1`,
    [
      pluginId,
      verification.stars ?? previous?.stars ?? 0,
      verification.pushedAt ?? previous?.last_push_at ?? null,
      verification.license || previous?.license || '',
      JSON.stringify(npmVersions),
      verification.headCommit ?? previous?.git_commit ?? '',
    ],
  )
  await upsertCheck(client, pluginId, now, hash, 0)

  // npm 新版本
  const before = latestVersion(previous?.npm_versions ?? [])
  const after = latestVersion(npmVersions)
  if (before && after && before !== after && compareSemver(after, before) > 0) {
    events.push({ kind: 'update-available', pluginId, detail: { from: before, to: after } })
  }

  // 归档
  if (verification.archived && previous?.status !== 'archived') {
    await client.query(`UPDATE plugins SET status = 'archived' WHERE id = $1`, [pluginId])
    events.push({ kind: 'archived', pluginId, detail: { reason: '仓库已归档' } })
  } else if (!verification.archived && previous?.status === 'archived') {
    await client.query(`UPDATE plugins SET status = 'active' WHERE id = $1`, [pluginId])
  }

  for (const event of events) {
    await insertEvent(client, event.pluginId, event.kind, event.detail)
  }
  return { events, missing: false, updated: updated.rowCount }
}
