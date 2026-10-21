#!/usr/bin/env node
/**
 * 种子导入：dsh-plugin-repo-archive/data/catalog.json → PostgreSQL
 *
 * 用法：
 *   node seed.mjs --dry-run                      # 只解析与统计，不连库（无需 pg/数据库）
 *   DATABASE_URL='postgres://dsh_plugin_harvester_rw:***@<host>:5432/dsh_plugin_repo_dev?sslmode=no-verify' node seed.mjs
 *
 * 注意：
 * - 服务器 pg_hba 只接受 TLS（hostssl），连接串必须带 ssl 参数，
 *   否则报 "pg_hba.conf rejects connection ... no encryption"；
 * - sslmode 取值：联调用 no-verify（加密不验证书）；正式用
 *   'sslmode=verify-full&sslrootcert=<RDS CA 证书路径>'（阿里云控制台下载 CA）。
 *   不要用 require——新版 pg-connection-string 把它当 verify-full，RDS 私有 CA 会报
 *   "self-signed certificate"；
 * - 口令含 # @ : 需 URL 编码。
 *
 * 说明：
 * - 幂等：全部 UPSERT（ON CONFLICT DO UPDATE），可重复执行；
 * - 数据来源 awesome-dsh-plugin（CC0-1.0），再分发需保留出处链接；
 * - 分类行由 migrations/0001_init.sql 播种，本脚本只校验 category_id 存在并警告缺失；
 * - 本脚本同时是发现器 L0（种子导入）的参考实现。
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_CATALOG = path.resolve(HERE, '../../dsh-plugin-repo-archive/data/catalog.json')

/** 分类英文标题 → 契约 slug（与 0001_init.sql 播种的 23 个 id 一致） */
function slugifyCategory(en) {
  return String(en ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** 从 GitHub URL 解析契约 id：小写 owner/repo，monorepo 追加 #path: 记法 */
function contractId(github, subPath) {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i.exec(String(github ?? ''))
  if (!m) return null
  let id = `${m[1]}/${m[2]}`.toLowerCase().replace(/\.git$/, '')
  const sub = String(subPath ?? '').replace(/^\//, '').replace(/\/$/, '')
  if (sub) id += `#path:/${sub}`
  return id
}

function toRows(catalog) {
  const skipped = []
  const rows = []
  for (const p of catalog.plugins) {
    const id = contractId(p.github, p.path)
    if (!id) {
      skipped.push({ name: p.name, reason: 'github-url-unparseable' })
      continue
    }
    rows.push({
      id,
      name: p.name ?? id,
      npm: p.npm ?? '',
      install_spec: p.install ?? '',
      github: p.github ?? '',
      category_id: slugifyCategory(p.category),
      desc_zh: p.desc ?? '',
      desc_en: p.descEn ?? '',
      license: '',
      stars: 0,
      last_push_at: null,
      npm_versions: p.version ? JSON.stringify([{ ver: p.version, time: null }]) : '[]',
      consensus_votes: Number.isInteger(p.consensus) ? p.consensus : 0,
      status: 'active',
      sources: [
        'awesome',
        ...(p.npm ? ['dsh-plugin-catalog'] : []),
      ],
    })
  }
  return { rows, skipped }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const srcIdx = args.indexOf('--source')
  const catalogPath = srcIdx >= 0 ? args[srcIdx + 1] : DEFAULT_CATALOG

  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  console.log(`catalog: ${catalogPath}`)
  console.log(`generatedAt: ${catalog.generatedAt}, count: ${catalog.count}`)

  const { rows, skipped } = toRows(catalog)
  const dupes = rows.length - new Set(rows.map((r) => r.id)).size
  const noSpec = rows.filter((r) => !r.install_spec).length
  console.log(`解析: ${rows.length} 行（跳过 ${skipped.length}，id 冲突 ${dupes}，缺 install_spec ${noSpec}）`)
  if (skipped.length) console.log('跳过样例:', skipped.slice(0, 5))

  const catIds = new Set(rows.map((r) => r.category_id))
  console.log(`涉及分类 ${catIds.size} 个:`, [...catIds].sort().join(', '))

  if (dryRun) {
    console.log('--dry-run：未连接数据库，未写入任何数据。')
    return
  }
  if (dupes > 0) throw new Error(`存在 ${dupes} 个重复 id，先排查数据源再导入`)

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('缺少 DATABASE_URL 环境变量（或先用 --dry-run 验证解析）')

  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  console.log(`已连接: ${new URL(databaseUrl).host}/${new URL(databaseUrl).pathname.slice(1)}`)

  const BATCH = 500
  let written = 0
  let sources = 0
  try {
    await client.query('BEGIN')
    // 分类完整性检查：发现缺失分类只警告（分类由 0001 播种，发现器后续可增补）
    const { rows: catRows } = await client.query('SELECT id FROM categories')
    const known = new Set(catRows.map((r) => r.id))
    const missing = [...catIds].filter((c) => !known.has(c))
    if (missing.length) console.warn(`警告：以下分类不在 categories 表中，将写入但无分类标题: ${missing.join(', ')}`)

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const values = []
      const params = []
      batch.forEach((r, j) => {
        const b = j * 13
        values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12}::jsonb,$${b + 13})`)
        params.push(
          r.id, r.name, r.npm, r.install_spec, r.github, r.category_id,
          r.desc_zh, r.desc_en, r.license, r.stars, r.last_push_at,
          r.npm_versions, r.consensus_votes,
        )
      })
      await client.query(
        `INSERT INTO plugins (id, name, npm, install_spec, github, category_id,
           desc_zh, desc_en, license, stars, last_push_at, npm_versions, consensus_votes)
         VALUES ${values.join(',')}
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, npm = EXCLUDED.npm, install_spec = EXCLUDED.install_spec,
           github = EXCLUDED.github, category_id = EXCLUDED.category_id,
           desc_zh = EXCLUDED.desc_zh, desc_en = EXCLUDED.desc_en,
           npm_versions = EXCLUDED.npm_versions, consensus_votes = EXCLUDED.consensus_votes`,
        params,
      )
      for (const r of batch) {
        for (const sourceId of r.sources) {
          await client.query(
            'INSERT INTO plugin_sources (plugin_id, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [r.id, sourceId],
          )
          sources++
        }
      }
      written += batch.length
      console.log(`已写入 ${written}/${rows.length}`)
    }
    await client.query(
      `INSERT INTO harvester_state (key, value) VALUES ('seed', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify({ at: new Date().toISOString(), count: written, source: 'dsh-plugin-repo-archive catalog.json' })],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    await client.end()
  }
  console.log(`完成：plugins ${written} 行，plugin_sources ${sources} 行。`)
}

main().catch((error) => {
  console.error('失败:', error.message)
  process.exit(1)
})
