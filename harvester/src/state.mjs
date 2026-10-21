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
