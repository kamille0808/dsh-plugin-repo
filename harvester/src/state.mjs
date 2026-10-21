/**
 * harvester_state 游标与摘要（契约 §5 / 设计文档 §3.5）。
 *
 * 所有键共享一张表（key TEXT PRIMARY KEY, value JSONB）。约定：
 *   contract_version —— 契约版本（由 migrations 播种，插件也读这一行）
 *   last-run        —— 每轮运行摘要
 *   source:<id>     —— 某个信源上轮的收录快照（用于 removed-from-list diff）
 *   cursor:<name>   —— 各层游标（L4 核验批次、候选池翻页）
 */
import { log } from './log.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { ROOT } from './config.mjs'

export async function readState(client, key, fallback = null) {
  const { rows } = await client.query('SELECT value FROM harvester_state WHERE key = $1', [key])
  return rows.length ? rows[0].value : fallback
}

export async function writeState(client, key, value) {
  await client.query(
    `INSERT INTO harvester_state (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  )
}

export async function readAllState(client) {
  const { rows } = await client.query('SELECT key, value FROM harvester_state')
  return new Map(rows.map((r) => [r.key, r.value]))
}

/** 某个信源上轮的收录 id 列表（用于 removed-from-list 判定）。 */
export async function readSourceSnapshot(client, sourceId) {
  const value = await readState(client, `source:${sourceId}`, null)
  return Array.isArray(value?.ids) ? value.ids : []
}

export async function writeSourceSnapshot(client, sourceId, ids, meta = {}) {
  await writeState(client, `source:${sourceId}`, { ids: [...ids].sort(), at: new Date().toISOString(), ...meta })
}

export async function readCursor(client, name, fallback = null) {
  const value = await readState(client, `cursor:${name}`, null)
  return value ?? fallback
}

export async function writeCursor(client, name, value) {
  await writeState(client, `cursor:${name}`, value)
}

export async function writeLastRun(client, summary) {
  await writeState(client, 'last-run', summary)
  log.info('运行摘要已写入 harvester_state', {
    at: summary.at,
    newPlugins: summary.newPlugins,
    updatedPlugins: summary.updatedPlugins,
    events: summary.events,
    errors: summary.errors,
  })
}

// ---------------------------------------------------------------------------
// 本地状态文件（离线模式用）
// ---------------------------------------------------------------------------

/**
 * 离线模式（collect）不连库，没有 harvester_state 可存发布守门的基线。
 * 用一个本地 JSON 文件兜底：记录上一轮发布的候选数。
 *
 * 这不是「多一套状态」——线上路径（run）的基线仍然在 PG 里，
 * 这里只是让离线路径也别把完整索引覆盖成残缺索引。
 */
export function localStatePath() {
  return process.env.HARVESTER_LOCAL_STATE_FILE
    ? path.resolve(process.env.HARVESTER_LOCAL_STATE_FILE)
    : path.join(ROOT, '.harvester-state.json')
}

async function readLocalStateAll() {
  try {
    return JSON.parse(await readFile(localStatePath(), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    return {}
  }
}

export async function readLocalState(key, fallback = null) {
  const all = await readLocalStateAll()
  return all[key] ?? fallback
}

export async function writeLocalState(key, value) {
  const all = await readLocalStateAll()
  all[key] = value
  const file = localStatePath()
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(all, null, 2)}\n`, 'utf8')
  return file
}
