/**
 * 失败降级与事件口径的回归测试。
 *
 * 这些是「信源挂掉时不能把整库带偏」的硬规则：
 * - 抓取失败的源不能被写成空快照；
 * - 抓取失败的源不能被判成「条目被移除」；
 * - 事件 kind 只能是契约 §6 的五种。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeCandidates, persistCandidates } from '../src/catalog.mjs'

/** 假 client：只记录写操作，不连库。 */
function fakeClient() {
  const written = { plugins: [], sources: [], events: [], categories: [] }
  return {
    written,
    async query(sql, params) {
      if (sql.includes('INSERT INTO plugins')) {
        written.plugins.push(params)
        // 14 列一行，返回与行数相同的 inserted 标记
        const rowCount = Math.ceil(params.length / 14)
        return { rows: Array.from({ length: rowCount }, (_, i) => ({ inserted: i % 2 === 0 })) }
      }
      if (sql.includes('INSERT INTO plugin_sources')) {
        written.sources.push(params)
        return { rows: [] }
      }
      if (sql.includes('DELETE FROM plugin_sources')) {
        return { rows: [] }
      }
      if (sql.includes('INSERT INTO events')) {
        written.events.push(params)
        return { rows: [] }
      }
      if (sql.includes('INSERT INTO categories')) {
        written.categories.push(params)
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
}

const EXISTING = {
  plugins: [
    {
      id: 'owner/kept', name: 'Kept', npm: 'dsh-kept', install_spec: 'dsh-kept',
      github: 'https://github.com/owner/kept', category_id: 'memory',
      desc_zh: '', desc_en: 'kept', license: '', stars: 1, last_push_at: null,
      npm_versions: [], consensus_votes: 1, status: 'active', git_commit: '',
      sources: ['awesome'],
    },
    {
      id: 'owner/dropped', name: 'Dropped', npm: 'dsh-dropped', install_spec: 'dsh-dropped',
      github: 'https://github.com/owner/dropped', category_id: 'memory',
      desc_zh: '', desc_en: 'dropped', license: '', stars: 1, last_push_at: null,
      npm_versions: [], consensus_votes: 1, status: 'active', git_commit: '',
      sources: ['awesome'],
    },
  ],
  categories: [],
}

test('信源抓取失败时：不做 removed-from-list 判定', async () => {
  const client = fakeClient()
  // 本轮 awesome 抓取失败 → 没有条目
  const candidates = mergeCandidates(
    [{ source: { source_id: 'awesome', votes: true, kind: 'markdown-list' }, entries: [] }],
    {},
    ['memory'],
  )
  const result = await persistCandidates(client, candidates, EXISTING, {
    // 上轮快照里 awesome 收了 owner/kept 与 owner/dropped
    sourceSnapshots: new Map([['awesome', ['owner/kept', 'owner/dropped']]]),
    failedSources: ['awesome'],
  })

  const removalEvents = result.events.filter((e) => e.kind === 'removed-from-list')
  assert.equal(removalEvents.length, 0, '失败的源不产生 removed-from-list')
  assert.equal(result.removed.length, 0)
})

test('信源正常抓取但条目被移除：产生 removed-from-list 事件', async () => {
  const client = fakeClient()
  const candidates = mergeCandidates(
    [{
      source: { source_id: 'awesome', votes: true, kind: 'markdown-list' },
      entries: [{
        parsed: { owner: 'owner', repo: 'kept', subPath: '' },
        displayName: 'Kept', description: 'kept', categoryTitle: 'Memory',
      }],
    }],
    {},
    ['memory'],
  )
  const result = await persistCandidates(client, candidates, EXISTING, {
    sourceSnapshots: new Map([['awesome', ['owner/kept', 'owner/dropped']]]),
    failedSources: [],
  })

  const removalEvents = result.events.filter((e) => e.kind === 'removed-from-list')
  assert.equal(removalEvents.length, 1)
  assert.equal(removalEvents[0].pluginId, 'owner/dropped')
  assert.deepEqual(removalEvents[0].detail, { source_id: 'awesome' })
  // 落库的事件 kind 必须在契约 §6 的五种之内
  for (const call of client.written.events) {
    assert.ok(
      ['new-plugin', 'update-available', 'renamed', 'archived', 'removed-from-list'].includes(call[1]),
      `非法事件 kind：${call[1]}`,
    )
  }
})

test('新插件产生 new-plugin 事件，带收录来源', async () => {
  const client = fakeClient()
  const candidates = mergeCandidates(
    [{
      source: { source_id: 'awesome', votes: true, kind: 'markdown-list' },
      entries: [{
        parsed: { owner: 'new', repo: 'thing', subPath: '' },
        displayName: 'Thing', description: 'brand new', categoryTitle: 'Memory',
      }],
    }],
    {},
    ['memory'],
  )
  const result = await persistCandidates(client, candidates, EXISTING, {
    sourceSnapshots: new Map(), failedSources: [],
  })

  const newEvents = result.events.filter((e) => e.kind === 'new-plugin')
  assert.equal(newEvents.length, 1)
  assert.equal(newEvents[0].pluginId, 'new/thing')
  assert.deepEqual(newEvents[0].detail.sources, ['awesome'])
  // 共识票数 = 计票源数量
  assert.equal(result.inserted, 1)
})

test('npm 出现更高版本产生 update-available 事件', async () => {
  const client = fakeClient()
  const existing = {
    ...EXISTING,
    plugins: [{
      ...EXISTING.plugins[0],
      npm_versions: [{ ver: '1.0.0', time: '2026-01-01T00:00:00.000Z' }],
    }],
  }
  const candidates = mergeCandidates(
    [{
      source: { source_id: 'dsh-plugin-catalog', votes: false, kind: 'market-index' },
      entries: [{
        parsed: { owner: 'owner', repo: 'kept', subPath: '' },
        displayName: 'Kept', description: '', categoryTitle: '',
        npm: 'dsh-kept', descEn: '', descZh: '',
        versions: [{ ver: '2.0.0', time: '2026-06-01T00:00:00.000Z' }],
      }],
    }],
    {},
    ['memory'],
  )
  const result = await persistCandidates(client, candidates, existing, {
    sourceSnapshots: new Map(), failedSources: [],
  })

  const updateEvents = result.events.filter((e) => e.kind === 'update-available')
  assert.equal(updateEvents.length, 1)
  assert.deepEqual(updateEvents[0].detail, { from: '1.0.0', to: '2.0.0' })
})

test('双语源的中文描述不会顶掉英文描述', async () => {  const client = fakeClient()
  const candidates = mergeCandidates(
    [
      {
        source: { source_id: 'awesome', votes: true, kind: 'markdown-list' },
        entries: [{
          parsed: { owner: 'owner', repo: 'kept', subPath: '' },
          displayName: 'Kept', description: 'English description', categoryTitle: 'Memory',
        }],
      },
      {
        source: { source_id: 'dshopen', votes: true, kind: 'market-index' },
        entries: [{
          parsed: { owner: 'owner', repo: 'kept', subPath: '' },
          displayName: 'Kept', description: '中文简介', descEn: '', descZh: '中文简介',
          categoryTitle: 'Memory', npm: 'dsh-kept', versions: [],
        }],
      },
    ],
    {},
    ['memory'],
  )
  const candidate = [...candidates.values()][0]
  assert.equal(candidate.descEn, 'English description')
  assert.equal(candidate.descZh, '中文简介')
})
