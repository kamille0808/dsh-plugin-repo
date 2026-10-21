#!/usr/bin/env node
/**
 * 契约符合性检查（验收 T1「你写入 dev 库的数据通过契约校验」）。
 *
 * 逐条核对 CONTRACT.md v0.2 的硬规则，发现问题以非零退出码结束。
 * 用法：
 *   DATABASE_URL='postgres://dsh_plugin_harvester_rw:***@<host>:5432/dsh_plugin_repo_dev?sslmode=no-verify' \
 *     node tools/contract-check.mjs
 *
 * 只读：全部是 SELECT，不写任何数据。
 */
import { loadConfig } from '../src/config.mjs'
import { createPool } from '../src/db.mjs'
import { isValidInstallSpec, isValidNpmName, parseContractId } from '../src/normalize.mjs'
import { log } from '../src/log.mjs'

const CHECKS = []
function check(name, fn) {
  CHECKS.push({ name, fn })
}

check('契约版本为 {major:0, minor>=1}', async (pool) => {
  const { rows } = await pool.query(`SELECT value FROM harvester_state WHERE key='contract_version'`)
  const v = rows[0]?.value
  if (!v) return { ok: false, detail: '缺少 contract_version' }
  if (Number(v.major) !== 0) return { ok: false, detail: `major=${v.major}，本检查器针对 major=0` }
  if (Number(v.minor) < 1) return { ok: false, detail: `minor=${v.minor}` }
  return { ok: true, detail: `major=${v.major} minor=${v.minor}` }
})

check('plugins.id 全部为 owner/repo 小写规范化（monorepo 用 #path: 记法）', async (pool) => {
  const { rows } = await pool.query('SELECT id FROM plugins')
  const bad = []
  for (const { id } of rows) {
    const parsed = parseContractId(id)
    if (!parsed) { bad.push({ id, why: '无法解析' }); continue }
    if (id !== id.toLowerCase()) { bad.push({ id, why: '含大写' }); continue }
    if (!/^[^/]+\/[^/#]+(#path:\/[^#]*)?$/.test(id)) { bad.push({ id, why: '格式不符' }); continue }
  }
  return { ok: bad.length === 0, detail: bad.length === 0 ? `${rows.length} 行` : JSON.stringify(bad.slice(0, 5)), bad }
})

check('plugins.install_spec 全部通过官方 parseInstallSpec 口径', async (pool) => {
  const { rows } = await pool.query('SELECT id, install_spec FROM plugins')
  const bad = rows.filter((r) => !isValidInstallSpec(r.install_spec))
  return { ok: bad.length === 0, detail: bad.length === 0 ? `${rows.length} 行` : JSON.stringify(bad.slice(0, 5)), bad }
})

check('plugins.npm 为空或为合法 npm 包名', async (pool) => {
  const { rows } = await pool.query(`SELECT id, npm FROM plugins WHERE npm <> ''`)
  const bad = rows.filter((r) => !isValidNpmName(r.npm))
  return { ok: bad.length === 0, detail: bad.length === 0 ? `${rows.length} 行非空` : JSON.stringify(bad.slice(0, 5)), bad }
})

check('plugins.status 只取契约四值', async (pool) => {
  const { rows } = await pool.query(`SELECT DISTINCT status FROM plugins`)
  const allowed = new Set(['active', 'renamed', 'archived', 'gone'])
  const bad = rows.map((r) => r.status).filter((s) => !allowed.has(s))
  return { ok: bad.length === 0, detail: bad.length === 0 ? [...new Set(rows.map((r) => r.status))].join(',') || '(空表)' : JSON.stringify(bad), bad }
})

check('plugins.npm_versions 为 [{ver,time}] 且按时间倒序', async (pool) => {
  const { rows } = await pool.query('SELECT id, npm_versions FROM plugins')
  const bad = []
  for (const row of rows) {
    const list = row.npm_versions
    if (!Array.isArray(list)) { bad.push({ id: row.id, why: '非数组' }); continue }
    for (const v of list) {
      if (!v || typeof v.ver !== 'string' || !('time' in v)) { bad.push({ id: row.id, why: '元素结构不符' }); break }
    }
    const times = list.map((v) => (v.time ? Date.parse(v.time) : -Infinity))
    for (let i = 1; i < times.length; i += 1) {
      if (times[i] > times[i - 1]) { bad.push({ id: row.id, why: '非时间倒序' }); break }
    }
  }
  return { ok: bad.length === 0, detail: bad.length === 0 ? `${rows.length} 行` : JSON.stringify(bad.slice(0, 5)), bad }
})

check('plugins.consensus_votes 不超过策展源总数（≤7）', async (pool) => {
  const { rows } = await pool.query(`SELECT id, consensus_votes FROM plugins WHERE consensus_votes > 7 OR consensus_votes < 0`)
  return { ok: rows.length === 0, detail: rows.length === 0 ? 'ok' : JSON.stringify(rows.slice(0, 5)), bad: rows }
})

check('plugin_sources.source_id 全部在契约 §3 名录内', async (pool) => {
  const allowed = new Set([
    'awesome', 'vbarter-curated', 'walkinglabs', 'kejixiaoliang', 'beancookie',
    'dshopen', 'vbarter-full', 'dsh-plugin-catalog', 'topic-scan', 'npm-scan', 'official',
  ])
  const { rows } = await pool.query('SELECT DISTINCT source_id FROM plugin_sources')
  const bad = rows.map((r) => r.source_id).filter((s) => !allowed.has(s))
  return { ok: bad.length === 0, detail: bad.length === 0 ? [...new Set(rows.map((r) => r.source_id))].join(',') || '(空表)' : JSON.stringify(bad), bad }
})

check('events.kind 只取契约五值', async (pool) => {
  const allowed = new Set(['new-plugin', 'update-available', 'renamed', 'archived', 'removed-from-list'])
  const { rows } = await pool.query('SELECT DISTINCT kind FROM events')
  const bad = rows.map((r) => r.kind).filter((k) => !allowed.has(k))
  return { ok: bad.length === 0, detail: bad.length === 0 ? [...new Set(rows.map((r) => r.kind))].join(',') || '(空表)' : JSON.stringify(bad), bad }
})

check('插件的收录票数与 plugin_sources 中计票源数量一致', async (pool) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.consensus_votes, count(s.source_id)::int AS n
      FROM plugins p
      LEFT JOIN plugin_sources s
        ON s.plugin_id = p.id AND s.source_id IN
           ('awesome','vbarter-curated','walkinglabs','kejixiaoliang','beancookie','dshopen','vbarter-full')
     GROUP BY p.id, p.consensus_votes
    HAVING p.consensus_votes <> count(s.source_id)`)
  return { ok: rows.length === 0, detail: rows.length === 0 ? '一致' : JSON.stringify(rows.slice(0, 5)), bad: rows }
})

check('每个插件的 category_id 都能在 categories 表找到（\'\' 除外）', async (pool) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.category_id FROM plugins p
     WHERE p.category_id <> ''
       AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = p.category_id)`)
  return { ok: rows.length === 0, detail: rows.length === 0 ? '一致' : JSON.stringify(rows.slice(0, 5)), bad: rows }
})

check('plugin_checks 覆盖情况（发现器私有表）', async (pool) => {
  const { rows } = await pool.query(`
    SELECT (SELECT count(*) FROM plugins) AS plugins,
           (SELECT count(*) FROM plugin_checks) AS checks,
           (SELECT count(*) FROM plugin_checks WHERE miss_streak > 0) AS with_miss_streak`)
  const r = rows[0]
  return { ok: true, detail: `plugins=${r.plugins} checks=${r.checks} miss_streak>0=${r.with_miss_streak}` }
})

check('updated_at 水印不早于 created_at（触发器口径）', async (pool) => {
  const { rows } = await pool.query('SELECT id, created_at, updated_at FROM plugins WHERE updated_at < created_at')
  return { ok: rows.length === 0, detail: rows.length === 0 ? '一致' : JSON.stringify(rows.slice(0, 5)), bad: rows }
})

check('harvester_state 有 last-run 摘要', async (pool) => {
  const { rows } = await pool.query(`SELECT value FROM harvester_state WHERE key='last-run'`)
  const v = rows[0]?.value
  if (!v) return { ok: false, detail: '缺少 last-run（先跑一轮 node src/cli.mjs run）' }
  return { ok: true, detail: `at=${v.at} new=${v.newPlugins} updated=${v.updatedPlugins} events=${v.events}` }
})

check('发现器对 ratings 只有读权限（写不进去）', async (pool) => {
  const { rows } = await pool.query(`
    SELECT has_table_privilege(current_user, 'ratings', 'INSERT') AS can_insert,
           has_table_privilege(current_user, 'ratings', 'UPDATE') AS can_update,
           has_table_privilege(current_user, 'ratings', 'SELECT') AS can_select`)
  const r = rows[0]
  const ok = r.can_select === true && r.can_insert === false && r.can_update === false
  return { ok, detail: `select=${r.can_select} insert=${r.can_insert} update=${r.can_update}` }
})

async function main() {
  const config = await loadConfig()
  const pool = createPool(config)
  const results = []
  let failed = 0
  try {
    for (const { name, fn } of CHECKS) {
      try {
        const result = await fn(pool)
        results.push({ name, ...result })
        if (!result.ok) failed += 1
      } catch (error) {
        failed += 1
        results.push({ name, ok: false, detail: `检查执行失败：${String(error?.message ?? error)}` })
      }
    }
  } finally {
    await pool.end().catch(() => {})
  }

  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`)
    console.log(`      ${r.detail}`)
  }
  console.log(`\n${results.length - failed}/${results.length} 项通过`)
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  log.error('契约检查失败', { error: String(error?.message ?? error) })
  process.exit(1)
})
