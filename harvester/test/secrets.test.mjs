/**
 * 本地凭据文件：解析、优先级、写入、连接串脱敏。
 *
 * 这些是「口令不经对话、不进 git」这条纪律的实现底座，
 * 所以每条规则都要有测试钉住。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseEnvText, loadEnvFile, upsertEnvValue, maskDatabaseUrl } from '../src/secrets.mjs'

async function tmpFile(name = 'secrets.env') {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-harvester-secrets-'))
  return path.join(dir, name)
}

test('解析 .env 文本：跳过注释与空行', () => {
  const parsed = parseEnvText([
    '# 这是注释',
    '',
    'DATABASE_URL=postgres://u:p@h:5432/db?sslmode=no-verify',
    'GITHUB_TOKEN=ghp_xxx',
  ].join('\n'))
  assert.equal(parsed.DATABASE_URL, 'postgres://u:p@h:5432/db?sslmode=no-verify')
  assert.equal(parsed.GITHUB_TOKEN, 'ghp_xxx')
  assert.equal(Object.keys(parsed).length, 2)
})

test('解析 .env 文本：值里的 = 不被截断', () => {
  const parsed = parseEnvText('DSN=postgres://u:p@h/db?sslmode=no-verify&x=1')
  assert.equal(parsed.DSN, 'postgres://u:p@h/db?sslmode=no-verify&x=1')
})

test('解析 .env 文本：去掉成对引号，保留引号内的 #', () => {
  const parsed = parseEnvText([
    'A="带 # 号的值"',
    "B='单引号'",
  ].join('\n'))
  assert.equal(parsed.A, '带 # 号的值')
  assert.equal(parsed.B, '单引号')
})

test('环境变量优先于凭据文件', async () => {
  const file = await tmpFile()
  await writeFile(file, 'HARVESTER_TEST_PW=file-value\n', 'utf8')
  process.env.HARVESTER_TEST_PW = 'env-value'
  try {
    const result = await loadEnvFile({ file })
    assert.equal(process.env.HARVESTER_TEST_PW, 'env-value')
    assert.ok(!result.loaded.includes('HARVESTER_TEST_PW'))
    assert.equal(result.exists, true)
  } finally {
    delete process.env.HARVESTER_TEST_PW
    await rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('凭据文件里的值在环境变量缺失时生效', async () => {
  const file = await tmpFile()
  await writeFile(file, 'HARVESTER_TEST_PW=file-value\n', 'utf8')
  delete process.env.HARVESTER_TEST_PW
  try {
    const result = await loadEnvFile({ file })
    assert.equal(process.env.HARVESTER_TEST_PW, 'file-value')
    assert.deepEqual(result.loaded, ['HARVESTER_TEST_PW'])
  } finally {
    delete process.env.HARVESTER_TEST_PW
    await rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('凭据文件不存在时不报错', async () => {
  const file = await tmpFile('missing.env')
  const result = await loadEnvFile({ file })
  assert.equal(result.exists, false)
  assert.deepEqual(result.loaded, [])
})

test('写入：新建文件只写该键', async () => {
  const file = await tmpFile()
  try {
    await upsertEnvValue('DATABASE_URL', 'postgres://u:p@h/db', { file })
    const text = await readFile(file, 'utf8')
    assert.match(text, /^DATABASE_URL=/m)
    assert.equal(Object.keys(parseEnvText(text)).length, 1)
  } finally {
    await rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('写入：更新已有键并保留其它键', async () => {
  const file = await tmpFile()
  try {
    await upsertEnvValue('DATABASE_URL', 'postgres://u:old@h/db', { file })
    await upsertEnvValue('GITHUB_TOKEN', 'ghp_x', { file })
    await upsertEnvValue('DATABASE_URL', 'postgres://u:new@h/db', { file })
    const parsed = parseEnvText(await readFile(file, 'utf8'))
    assert.equal(parsed.DATABASE_URL, 'postgres://u:new@h/db')
    assert.equal(parsed.GITHUB_TOKEN, 'ghp_x')
  } finally {
    await rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('写入：同名重复行只保留一条', async () => {
  const file = await tmpFile()
  try {
    await upsertEnvValue('DATABASE_URL', 'a', { file })
    await upsertEnvValue('DATABASE_URL', 'b', { file })
    const text = await readFile(file, 'utf8')
    const count = text.split(/\r?\n/).filter((l) => l.trim().startsWith('DATABASE_URL=')).length
    assert.equal(count, 1)
  } finally {
    await rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('写入：含 # 的值被引号包住，不会被当成注释截断', async () => {
  const file = await tmpFile()
  try {
    await upsertEnvValue('DATABASE_URL', 'postgres://u:p@h/db?a=1#frag', { file })
    const parsed = parseEnvText(await readFile(file, 'utf8'))
    assert.equal(parsed.DATABASE_URL, 'postgres://u:p@h/db?a=1#frag')
  } finally {
    await rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('连接串脱敏：口令不外泄', () => {
  const masked = maskDatabaseUrl('postgres://dsh_plugin_harvester_rw:sup3rs3cret@47.101.216.5:5432/dsh_plugin_repo_dev?sslmode=no-verify')
  assert.ok(!masked.includes('sup3rs3cret'))
  assert.match(masked, /dsh_plugin_harvester_rw:\*\*\*@47\.101\.216\.5:5432/)
  assert.match(masked, /sslmode=no-verify/)
})

test('连接串脱敏：无口令时原样返回', () => {
  assert.equal(maskDatabaseUrl(''), '')
  assert.equal(maskDatabaseUrl('postgres://u@host/db'), 'postgres://u@host/db')
})

test('BOM 不影响解析：Windows 编辑器改过的 .env 第一个键也要认', () => {
  // UTF-8 BOM 挡在第一个键前面，不去掉的话 DATABASE_URL 会静默失效
  const parsed = parseEnvText('\uFEFFDATABASE_URL=postgres://u:p@h/db\nGITHUB_TOKEN=ghp_x\n')
  assert.equal(parsed.DATABASE_URL, 'postgres://u:p@h/db')
  assert.equal(parsed.GITHUB_TOKEN, 'ghp_x')
})

test('BOM 不影响解析：只有一行且带 BOM', () => {
  const parsed = parseEnvText('\uFEFFDATABASE_URL=postgres://u:p@h/db')
  assert.equal(parsed.DATABASE_URL, 'postgres://u:p@h/db')
})
