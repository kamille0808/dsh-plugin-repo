/**
 * 发布守门：信源大面积失败时，不允许用残缺索引覆盖完整索引。
 *
 * 背景：发现器有 8 个信源。任一轮网络抖动，可能只剩三四个源有数据。
 * 若照发，公开索引会从 3484 条掉到 767 条——对已经把它加进
 * DSH「发现」页的用户是静默的能力回退。
 *
 * 判定口径与 vbarter 注册表自己的做法一致：
 * 「若新快照 published 数量比上一版下降超过 40%，中止写入」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldPublish } from '../src/publish.mjs'

test('首轮没有基线：照发', () => {
  const r = shouldPublish({ previousSize: 0, currentSize: 767, maxCatalogDrop: 0.4 })
  assert.equal(r.publish, true)
})

test('跌幅在阈值内：照发', () => {
  // 3484 → 3000，跌 13.9%
  const r = shouldPublish({ previousSize: 3484, currentSize: 3000, maxCatalogDrop: 0.4 })
  assert.equal(r.publish, true)
  assert.ok(r.dropRatio < 0.4)
})

test('跌幅超过阈值：跳过发布', () => {
  // 3484 → 767，跌 78%
  const r = shouldPublish({ previousSize: 3484, currentSize: 767, maxCatalogDrop: 0.4 })
  assert.equal(r.publish, false)
  assert.ok(r.dropRatio > 0.4)
})

test('候选数上涨：一律照发', () => {
  const r = shouldPublish({ previousSize: 1000, currentSize: 5000, maxCatalogDrop: 0.4 })
  assert.equal(r.publish, true)
  assert.ok(r.dropRatio < 0)
})

test('恰好等于阈值：照发（阈值是「超过」才拦）', () => {
  const r = shouldPublish({ previousSize: 1000, currentSize: 600, maxCatalogDrop: 0.4 })
  assert.equal(r.publish, true)
})
