/**
 * PostgreSQL 访问层：连接、事务、契约表读写。
 *
 * 角色纪律（契约 §1）：发现器账号 dsh_plugin_harvester_rw 是 catalog 的唯一写者，
 * ratings 只读。本模块不提供写 ratings 的方法，从代码层面守住单写入者原则。
 */
import pg from 'pg'
import { log } from './log.mjs'
import { resolveTls } from './config.mjs'

const { Pool, types } = pg

// timestamptz 保持字符串，避免 JS Date 的毫秒精度截断把游标回退
// （契约 §5 硬规则：游标时间戳必须经 updated_at::text 原样回传）
types.setTypeParser(1184, (value) => value)
types.setTypeParser(1114, (value) => value)

export function createPool(config) {
  const { connectionString, ssl } = resolveTls(config.databaseUrl)
  const pool = new Pool({
    connectionString,
    ssl,
    max: 3,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    application_name: 'dsh-plugin-harvester',
  })
  pool.on('error', (error) => log.error('PG 连接池错误', { message: String(error?.message ?? error) }))
  return pool
}

/** 在一个事务里跑 fn；失败回滚并抛出。 */
export async function withTransaction(pool, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// catalog 读
// ---------------------------------------------------------------------------

/** 全部插件（含来源集合），供渲染与 diff 使用。 */
export async function loadCatalog(client) {
  const { rows: plugins } = await client.query(
    `SELECT id, name, npm, install_spec, github, category_id,
            desc_zh, desc_en, license, stars, last_push_at, npm_versions,
            consensus_votes, status, git_commit, created_at, updated_at
       FROM plugins`,
  )
  const { rows: sources } = await client.query('SELECT plugin_id, source_id, listed_at FROM plugin_sources')
  const { rows: checks } = await client.query('SELECT plugin_id, checked_at, signals_hash, miss_streak FROM plugin_checks')
  const { rows: categories } = await client.query('SELECT id, title_zh, title_en, builtin FROM categories')

  const sourcesByPlugin = new Map()
  for (const s of sources) {
    if (!sourcesByPlugin.has(s.plugin_id)) sourcesByPlugin.set(s.plugin_id, [])
    sourcesByPlugin.get(s.plugin_id).push(s.source_id)
  }
  const checksByPlugin = new Map(checks.map((c) => [c.plugin_id, c]))
  return {
    plugins: plugins.map((p) => ({
      ...p,
      sources: (sourcesByPlugin.get(p.id) ?? []).sort(),
      check: checksByPlugin.get(p.id) ?? null,
    })),
    categories,
  }
}

/** 契约 §7：插件只读 ratings；发现器渲染聚合用。 */
export async function loadRatings(client) {
  const { rows } = await client.query(
    'SELECT plugin_id, scored_by, score, note, scored_at FROM ratings ORDER BY plugin_id, scored_by',
  )
  return rows
}

/** 契约版本（插件启动时也会读同一行）。 */
export async function readContractVersion(client) {
  const { rows } = await client.query(`SELECT value FROM harvester_state WHERE key = 'contract_version'`)
  return rows[0]?.value ?? { major: 0, minor: 1 }
}

// ---------------------------------------------------------------------------
// catalog 写（发现器唯一写者）
// ---------------------------------------------------------------------------

const PLUGIN_COLUMNS = [
  'id', 'name', 'npm', 'install_spec', 'github', 'category_id',
  'desc_zh', 'desc_en', 'license', 'stars', 'last_push_at', 'npm_versions', 'consensus_votes', 'status',
]

/**
 * 批量写入插件记录。返回 'inserted' | 'updated' | 'unchanged' 的行数数组。
 *
 * 批量 upsert 而非逐行：catalog 有数千行，逐行往返对公网 PG 来说太慢。
 * WHERE 子句与 updated_at 触发器口径一致：业务字段没变就不推进水印，
 * 避免每轮重扫造成全量水印抖动（migrations 0001 注释）。
 */
export async function upsertPlugins(client, rows) {
  if (rows.length === 0) return { inserted: 0, updated: 0, unchanged: 0 }
  const values = []
  const params = []
  rows.forEach((row, index) => {
    const b = index * PLUGIN_COLUMNS.length
    const placeholders = PLUGIN_COLUMNS.map((_, i) => `$${b + i + 1}`).join(',')
    values.push(`(${placeholders})`)
    params.push(
      row.id, row.name, row.npm, row.install_spec, row.github, row.category_id,
      row.desc_zh, row.desc_en, row.license, row.stars, row.last_push_at,
      JSON.stringify(row.npm_versions ?? []), row.consensus_votes, row.status,
    )
  })
  const { rows: result } = await client.query(
    `INSERT INTO plugins (${PLUGIN_COLUMNS.join(', ')})
     VALUES ${values.join(',')}
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       npm = EXCLUDED.npm,
       install_spec = EXCLUDED.install_spec,
       github = EXCLUDED.github,
       category_id = EXCLUDED.category_id,
       desc_zh = EXCLUDED.desc_zh,
       desc_en = EXCLUDED.desc_en,
       license = EXCLUDED.license,
       stars = EXCLUDED.stars,
       last_push_at = EXCLUDED.last_push_at,
       npm_versions = EXCLUDED.npm_versions,
       consensus_votes = EXCLUDED.consensus_votes,
       status = EXCLUDED.status
     WHERE plugins.name         IS DISTINCT FROM EXCLUDED.name
        OR plugins.npm          IS DISTINCT FROM EXCLUDED.npm
        OR plugins.install_spec IS DISTINCT FROM EXCLUDED.install_spec
        OR plugins.github       IS DISTINCT FROM EXCLUDED.github
        OR plugins.category_id  IS DISTINCT FROM EXCLUDED.category_id
        OR plugins.desc_zh      IS DISTINCT FROM EXCLUDED.desc_zh
        OR plugins.desc_en      IS DISTINCT FROM EXCLUDED.desc_en
        OR plugins.license      IS DISTINCT FROM EXCLUDED.license
        OR plugins.stars        IS DISTINCT FROM EXCLUDED.stars
        OR plugins.last_push_at IS DISTINCT FROM EXCLUDED.last_push_at
        OR plugins.npm_versions IS DISTINCT FROM EXCLUDED.npm_versions
        OR plugins.consensus_votes IS DISTINCT FROM EXCLUDED.consensus_votes
        OR plugins.status       IS DISTINCT FROM EXCLUDED.status
     RETURNING (xmax = 0) AS inserted`,
    params,
  )
  let inserted = 0
  let updated = 0
  for (const row of result) {
    if (row.inserted) inserted += 1
    else updated += 1
  }
  return { inserted, updated, unchanged: rows.length - inserted - updated }
}

/** 写入单条插件记录（保留给一次性场景）。 */
export async function upsertPlugin(client, row) {
  const result = await upsertPlugins(client, [row])
  if (result.inserted > 0) return 'inserted'
  if (result.updated > 0) return 'updated'
  return 'unchanged'
}

/**
 * 批量维护 plugin_sources（收录来源 = 共识票的事实依据）。
 * @param {Array<{plugin_id: string, source_ids: string[]}>} entries
 */
export async function syncPluginSourcesBatch(client, entries) {
  if (entries.length === 0) return
  const pluginIds = entries.map((e) => e.plugin_id)
  const sourceIds = entries.map((e) => e.source_ids)

  // 先删掉「本轮不再收录」的来源
  await client.query(
    `DELETE FROM plugin_sources ps
       USING unnest($1::text[], $2::text[][]) AS t(plugin_id, source_ids)
      WHERE ps.plugin_id = t.plugin_id
        AND NOT (ps.source_id = ANY(t.source_ids))`,
    [pluginIds, sourceIds],
  )
  // 再补上新增的来源
  await client.query(
    `INSERT INTO plugin_sources (plugin_id, source_id)
     SELECT * FROM unnest($1::text[], $2::text[])
     ON CONFLICT (plugin_id, source_id) DO NOTHING`,
    [pluginIds, sourceIds],
  )
}

/** 维护 plugin_sources（收录来源 = 共识票的事实依据）。 */
export async function syncPluginSources(client, pluginId, sourceIds) {
  await syncPluginSourcesBatch(client, [{ plugin_id: pluginId, source_ids: sourceIds }])
}

/** 记录本轮核验时间与信源快照哈希（发现器私有，不扰动 plugins 水印）。 */
export async function upsertCheck(client, pluginId, checkedAt, signalsHash, missStreak = 0) {
  await client.query(
    `INSERT INTO plugin_checks (plugin_id, checked_at, signals_hash, miss_streak)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (plugin_id) DO UPDATE SET
       checked_at = EXCLUDED.checked_at,
       signals_hash = EXCLUDED.signals_hash,
       miss_streak = EXCLUDED.miss_streak`,
    [pluginId, checkedAt, signalsHash, missStreak],
  )
}

/** 契约 §6：仓库改名后 id 跟随新名，需要连带迁移从属行。 */
export async function renamePlugin(client, oldId, newId, github) {
  await client.query('UPDATE plugins SET id = $1, github = $2 WHERE id = $3', [newId, github, oldId])
  await client.query(
    `INSERT INTO plugin_sources (plugin_id, source_id, listed_at)
     SELECT $1, source_id, listed_at FROM plugin_sources WHERE plugin_id = $2
     ON CONFLICT DO NOTHING`,
    [newId, oldId],
  )
  await client.query('DELETE FROM plugin_sources WHERE plugin_id = $1', [oldId])
  await client.query(
    `INSERT INTO plugin_checks (plugin_id, checked_at, signals_hash, miss_streak)
     SELECT $1, checked_at, signals_hash, miss_streak FROM plugin_checks WHERE plugin_id = $2
     ON CONFLICT (plugin_id) DO NOTHING`,
    [newId, oldId],
  )
  await client.query('DELETE FROM plugin_checks WHERE plugin_id = $1', [oldId])
}

/** 写事件（契约 §6 的五种 kind）。 */
export async function insertEvent(client, pluginId, kind, detail) {
  await client.query(
    'INSERT INTO events (plugin_id, kind, detail) VALUES ($1, $2, $3::jsonb)',
    [pluginId, kind, JSON.stringify(detail ?? {})],
  )
}

/** 分类增补（发现器可增补上游新分类，builtin=false）。 */
export async function upsertCategory(client, id, titleZh, titleEn, builtin = false) {
  await client.query(
    `INSERT INTO categories (id, title_zh, title_en, builtin) VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET
       title_zh = COALESCE(NULLIF(EXCLUDED.title_zh,''), categories.title_zh),
       title_en = COALESCE(NULLIF(EXCLUDED.title_en,''), categories.title_en)`,
    [id, titleZh ?? '', titleEn ?? '', builtin],
  )
}
