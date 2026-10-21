/**
 * 离线模式（collect）的发布守门。
 *
 * 背景：守门原本只挂在连库的线上路径（run）上。离线路径不连库，
 * 就没有 harvester_state 可存基线——结果一次信源大面积失败的
 * 离线运行，把 3490 条的完整索引直接覆盖成了 767 条。
 * 这正是守门要拦的「静默的能力回退」，所以离线也必须拦。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runOffline } from '../src/run.mjs'
import { readLocalState, writeLocalState, localStatePath } from '../src/state.mjs'

const MARKET_INDEX = {
  format: 1,
  metadata: { categories: { ui: { title: { en: 'UI Enhancements' } } } },
  plugins: [
    {
      name: '@scope/dsh-demo',
      description: { en: 'English desc', zh: '中文简介' },
      repository: { url: 'https://github.com/owner/demo' },
      metadata: { category: 'ui' },
      versions: [{ version: '1.0.0', publishTimestamp: 1767225600, source: { type: 'npm' }, engines: {} }],
    },
  ],
}

/** 只返回一份 format-1 索引的假 HTTP 客户端。 */
function fakeHttp() {
  return {
    async json(url) {
      if (url.includes('market-index')) return MARKET_INDEX
      throw new Error(`不该请求的 URL：${url}`)
    },
    async text(url) {
      throw new Error(`不该请求的 URL：${url}`)
    },
  }
}

function configFor(outDir, stateFile) {
  return {
    publisher: 'file',
    outDir,
    indexBaseUrl: 'https://plugins.example.com',
    browseLimit: 100,
    maxCatalogDrop: 0.4,
    knownCategories: ['ui'],
    categories: { alias: {}, known: ['ui'], extra: [] },
    sources: {
      curated: [{
        source_id: 'demo-index',
        title: 'demo',
        kind: 'market-index',
        url: 'https://example.com/market-index.json',
        votes: true,
        enabled: true,
      }],
      indexes: [],
    },
  }
}

test('本地状态文件：读写往返', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-harvester-state-'))
  const file = path.join(dir, 'state.json')
  const previous = process.env.HARVESTER_LOCAL_STATE_FILE
  process.env.HARVESTER_LOCAL_STATE_FILE = file
  try {
    assert.equal(await readLocalState('catalog-size', 0), 0)
    await writeLocalState('catalog-size', 1234)
    assert.equal(await readLocalState('catalog-size', 0), 1234)
    // 写别的键不会冲掉已有的
    await writeLocalState('other', 'x')
    assert.equal(await readLocalState('catalog-size', 0), 1234)
  } finally {
    if (previous === undefined) delete process.env.HARVESTER_LOCAL_STATE_FILE
    else process.env.HARVESTER_LOCAL_STATE_FILE = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test('离线守门：候选数相对上一轮跌超阈值就跳过发布', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-harvester-gate-'))
  const stateFile = path.join(dir, 'state.json')
  const previous = process.env.HARVESTER_LOCAL_STATE_FILE
  process.env.HARVESTER_LOCAL_STATE_FILE = stateFile
  try {
    // 上一轮有 1000 条，本轮只剩 1 条 —— 跌 99.9%
    await writeLocalState('catalog-size', 1000)

    const summary = await runOffline(configFor(dir), { http: fakeHttp() })

    assert.equal(summary.publishSkipped, true)
    assert.equal(summary.published.written.length, 0)
    assert.match(summary.published.target, /已跳过/)
    assert.equal(summary.catalogDrop.previous, 1000)
    assert.ok(summary.catalogDrop.ratio > 0.4)
  } finally {
    if (previous === undefined) delete process.env.HARVESTER_LOCAL_STATE_FILE
    else process.env.HARVESTER_LOCAL_STATE_FILE = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test('离线守门：没有基线（首轮）时照发，并记下基线', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-harvester-gate-'))
  const stateFile = path.join(dir, 'state.json')
  const previous = process.env.HARVESTER_LOCAL_STATE_FILE
  process.env.HARVESTER_LOCAL_STATE_FILE = stateFile
  try {
    const summary = await runOffline(configFor(dir), { http: fakeHttp() })

    assert.notEqual(summary.publishSkipped, true)
    assert.deepEqual(summary.published.written.sort(), ['index.html', 'index.json'])
    // 产物真的落盘了
    const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'))
    assert.equal(index.plugins.length, 1)
    // 基线也记下来了
    assert.equal(await readLocalState('catalog-size', 0), summary.candidates)
  } finally {
    if (previous === undefined) delete process.env.HARVESTER_LOCAL_STATE_FILE
    else process.env.HARVESTER_LOCAL_STATE_FILE = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test('离线守门：跌幅在阈值内照发', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-harvester-gate-'))
  const stateFile = path.join(dir, 'state.json')
  const previous = process.env.HARVESTER_LOCAL_STATE_FILE
  process.env.HARVESTER_LOCAL_STATE_FILE = stateFile
  try {
    await writeLocalState('catalog-size', 1) // 上一轮 1 条，本轮 1 条，跌幅 0
    const summary = await runOffline(configFor(dir), { http: fakeHttp() })
    assert.notEqual(summary.publishSkipped, true)
    assert.deepEqual(summary.published.written.sort(), ['index.html', 'index.json'])
  } finally {
    if (previous === undefined) delete process.env.HARVESTER_LOCAL_STATE_FILE
    else process.env.HARVESTER_LOCAL_STATE_FILE = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test('本地状态文件路径可用环境变量覆盖', () => {
  const previous = process.env.HARVESTER_LOCAL_STATE_FILE
  process.env.HARVESTER_LOCAL_STATE_FILE = 'C:/tmp/harvester-state.json'
  try {
    assert.equal(localStatePath(), path.resolve('C:/tmp/harvester-state.json'))
  } finally {
    if (previous === undefined) delete process.env.HARVESTER_LOCAL_STATE_FILE
    else process.env.HARVESTER_LOCAL_STATE_FILE = previous
  }
})
