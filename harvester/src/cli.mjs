#!/usr/bin/env node
/**
 * 发现器命令行。
 *
 *   node src/cli.mjs run [--dry-run]     跑一轮完整流程
 *   node src/cli.mjs collect              离线模式：只抓信源并渲染，不连库
 *   node src/cli.mjs render              只从 PG 重新渲染索引与浏览页并发布
 *   node src/cli.mjs verify-index [文件] 用官方 parseMarketIndex 校验索引
 *   node src/cli.mjs sources             列出信源名录并探测可达性
 *   node src/cli.mjs check-db            连库自检（契约版本 / 表结构 / 计数）
 *   node src/cli.mjs set-secret          本地录入 DATABASE_URL / GITHUB_TOKEN（隐藏输入）
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig } from './config.mjs'
import { log, setLogLevel } from './log.mjs'
import { runHarvester, runOffline, validateIndex } from './run.mjs'
import { createPool, loadCatalog, readContractVersion } from './db.mjs'
import { HttpClient } from './http.mjs'
import { renderMarketIndex } from './render-index.mjs'
import { buildBrowseData, renderBrowsePage } from './render-page.mjs'
import { publish } from './publish.mjs'
import { fetchSource } from './collect.mjs'
import { loadEnvFile, maskDatabaseUrl, promptSecret, secretFilePath, upsertEnvValue } from './secrets.mjs'

const args = process.argv.slice(2)
const command = args[0] ?? 'run'
const flags = new Set(args.filter((a) => a.startsWith('--')))
const dryRun = flags.has('--dry-run')
if (flags.has('--verbose')) setLogLevel('debug')

try {
  switch (command) {
    case 'run':
      await cmdRun()
      break
    case 'collect':
      await cmdCollect()
      break
    case 'render':
      await cmdRender()
      break
    case 'verify-index':
      await cmdVerifyIndex()
      break
    case 'sources':
      await cmdSources()
      break
    case 'check-db':
      await cmdCheckDb()
      break
    case 'set-secret':
      await cmdSetSecret()
      break
    default:
      console.error(`未知命令：${command}`)
      console.error('可用命令：run | render | verify-index | sources | check-db | set-secret')
      process.exit(2)
  }
} catch (error) {
  log.error('命令失败', { command, error: String(error?.message ?? error) })
  process.exit(1)
}

async function cmdRun() {
  const config = await loadConfig()
  const summary = await runHarvester(config, { dryRun })
  console.log(JSON.stringify(summary, null, 2))
}

async function cmdCollect() {
  const config = await loadConfig({ requireDatabase: false })
  const summary = await runOffline(config, {})
  console.log(JSON.stringify(summary, null, 2))
}

async function cmdRender() {
  const config = await loadConfig()
  const pool = createPool(config)
  try {
    const catalog = await loadCatalog(pool)
    const index = renderMarketIndex(catalog)
    const indexUrl = `${config.indexBaseUrl.replace(/\/+$/, '')}/index.json`
    validateIndex(index, indexUrl)
    const page = renderBrowsePage(buildBrowseData(catalog, { limit: config.browseLimit }), { generatedAt: new Date().toISOString() })
    const published = await publish(config, new Map([
      ['index.json', JSON.stringify(index, null, 2)],
      ['index.html', page],
    ]))
    console.log(JSON.stringify({ plugins: index.plugins.length, published }, null, 2))
  } finally {
    await pool.end().catch(() => {})
  }
}

async function cmdVerifyIndex() {
  const target = args[1] ?? path.join(process.cwd(), 'index.json')
  const index = JSON.parse(await readFile(target, 'utf8'))
  const indexUrl = process.env.HARVESTER_INDEX_BASE_URL
    ? `${process.env.HARVESTER_INDEX_BASE_URL.replace(/\/+$/, '')}/index.json`
    : 'https://example.invalid/index.json'
  const parsed = validateIndex(index, indexUrl)
  console.log(JSON.stringify({
    ok: true,
    file: target,
    plugins: parsed.plugins.length,
    categories: Object.keys(parsed.metadata.categories).length,
  }, null, 2))
}

async function cmdSources() {
  // 只探测信源可达性，不连库——不该要求 DATABASE_URL
  const config = await loadConfig({ requireDatabase: false })
  const http = new HttpClient({
    userAgent: config.userAgent,
    githubToken: config.githubToken,
    timeoutMs: config.httpTimeoutMs,
    retries: 1,
    concurrency: 4,
  })
  const all = [
    ...config.sources.curated.map((s) => ({ ...s, layer: 'L1' })),
    ...config.sources.indexes.map((s) => ({ ...s, layer: 'L2' })),
  ]
  const rows = []
  for (const source of all) {
    if (!source.enabled || !source.url) {
      rows.push({ source_id: source.source_id, layer: source.layer, status: 'skipped', reason: source.url ? 'disabled' : 'url-missing' })
      continue
    }
    const result = await fetchSource(http, source)
    rows.push({
      source_id: source.source_id,
      layer: source.layer,
      status: result.ok ? 'ok' : 'failed',
      entries: result.entries.length,
      error: result.error ?? null,
      votes: source.votes,
    })
  }
  console.log(JSON.stringify(rows, null, 2))
}

async function cmdCheckDb() {
  const config = await loadConfig()
  const pool = createPool(config)
  try {
    const version = await readContractVersion(pool)
    const counts = {}
    for (const table of ['plugins', 'plugin_sources', 'plugin_checks', 'categories', 'events', 'ratings']) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`)
      counts[table] = rows[0].n
    }
    const { rows: lastRun } = await pool.query(`SELECT value FROM harvester_state WHERE key = 'last-run'`)
    const columns = {}
    for (const table of ['plugins', 'plugin_checks']) {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [table],
      )
      columns[table] = rows.map((r) => r.column_name)
    }
    console.log(JSON.stringify({
      target: maskDatabaseUrl(config.databaseUrl),
      credentials: {
        file: config.secretsFile,
        fileExists: config.secretsFileExists,
        loadedFromFile: config.secretsLoaded,
        source: config.secretsLoaded.length > 0 ? '本地凭据文件' : '进程环境变量',
      },
      contractVersion: version,
      counts,
      columns,
      lastRun: lastRun[0]?.value ?? null,
    }, null, 2))
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * 本地录入凭据。
 *
 * 口令不经对话、不进 git、不进 shell history：
 *   node src/cli.mjs set-secret          交互输入（不回显）
 *   node src/cli.mjs set-secret --stdin  DATABASE_URL 从管道读
 *   node src/cli.mjs set-secret --status 只看当前状态（脱敏）
 *
 * 写到 harvester/.env.local（gitignored），运行时由 config.mjs 自动载入。
 * 环境变量优先级更高，所以 systemd / CI 注入的值不会被文件覆盖。
 */
async function cmdSetSecret() {
  const file = secretFilePath()

  if (flags.has('--status')) {
    const loaded = await loadEnvFile()
    console.log(JSON.stringify({
      file,
      exists: loaded.exists,
      loadedFromFile: loaded.loaded,
      databaseUrl: maskDatabaseUrl(process.env.DATABASE_URL ?? ''),
      githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN ? '已配置' : '未配置',
    }, null, 2))
    return
  }

  const written = []

  if (flags.has('--stdin')) {
    // 管道模式：DATABASE_URL 从 stdin 读（适合从密码管理器或 vault 里 pipe 过来）
    const { readAllStdin } = await import('./secrets.mjs')
    const value = (await readAllStdin()).trim()
    if (!value) throw new Error('stdin 为空：没有读到 DATABASE_URL')
    await upsertEnvValue('DATABASE_URL', value)
    written.push('DATABASE_URL')
  } else {
    const value = await promptSecret('DATABASE_URL（输入不回显）: ')
    const trimmed = value.trim()
    if (!trimmed) throw new Error('DATABASE_URL 为空，已中止（未写入任何内容）')
    await upsertEnvValue('DATABASE_URL', trimmed)
    written.push('DATABASE_URL')

    // GitHub token 可选：直接回车跳过
    const token = await promptSecret('GITHUB_TOKEN（可回车跳过）: ')
    if (token.trim()) {
      await upsertEnvValue('GITHUB_TOKEN', token.trim())
      written.push('GITHUB_TOKEN')
    }
  }

  console.log(JSON.stringify({
    ok: true,
    file,
    written,
    note: '口令已写入本地凭据文件（gitignored）。运行时自动载入；环境变量优先级更高。',
  }, null, 2))
}
