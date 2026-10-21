/**
 * 产出物发布：本地目录 / 阿里云 OSS / 任意 S3 兼容端点。
 *
 * 契约 §8：发布到公网静态托管（首选 OSS，备选 GitHub Pages）。
 * 默认 publisher=file —— 始终产出一份可发布的 dist/，部署方式交给外层
 * （GitHub Pages 工作流、rsync、nginx 挂载都吃得下）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { log } from './log.mjs'

/**
 * 发布守门：信源大面积失败时，不允许用残缺索引覆盖完整索引。
 *
 * 背景：发现器有 8 个信源。任一轮网络抖动，可能只剩三四个源有数据。
 * 若照发，公开索引会从 3484 条掉到 767 条——对已经把它加进
 * DSH「发现」页的用户是静默的能力回退。
 *
 * 判定口径与 vbarter 注册表自己的做法一致：
 * 「若新快照 published 数量比上一版下降超过 40%，中止写入」。
 *
 * @param {object} p
 * @param {number} p.previousSize  上一轮发布的候选数（0 = 没有基线）
 * @param {number} p.currentSize   本轮候选数
 * @param {number} p.maxCatalogDrop 允许的最大跌幅（0.4 = 40%）
 * @returns {{publish: boolean, dropRatio: number}}
 */
export function shouldPublish({ previousSize, currentSize, maxCatalogDrop }) {
  if (!previousSize || previousSize <= 0) return { publish: true, dropRatio: 0 }
  const dropRatio = (previousSize - currentSize) / previousSize
  return { publish: dropRatio <= maxCatalogDrop, dropRatio }
}

/**
 * @param {object} config
 * @param {Map<string, string>} files  相对路径 → 内容
 */
export async function publish(config, files) {
  const publisher = config.publisher
  if (publisher === 'file') return publishToDirectory(config.outDir, files)
  if (publisher === 'oss') return publishToOss(config, files)
  throw new Error(`未知的 publisher：${publisher}（支持 file | oss）`)
}

async function publishToDirectory(outDir, files) {
  await mkdir(outDir, { recursive: true })
  const written = []
  for (const [rel, content] of files) {
    const target = path.join(outDir, rel)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content, 'utf8')
    written.push(rel)
  }
  log.info('产出物已写入本地目录', { dir: outDir, files: written })
  return { target: outDir, written }
}

async function publishToOss(config, files) {
  if (!config.ossBucket) throw new Error('publisher=oss 需要 OSS_BUCKET 环境变量')
  let OSS
  try {
    OSS = (await import('ali-oss')).default
  } catch (error) {
    throw new Error(`未安装可选依赖 ali-oss：${String(error?.message ?? error)}`)
  }
  const client = new OSS({
    region: config.ossRegion,
    bucket: config.ossBucket,
    ...(process.env.OSS_ACCESS_KEY_ID ? { accessKeyId: process.env.OSS_ACCESS_KEY_ID } : {}),
    ...(process.env.OSS_ACCESS_KEY_SECRET ? { accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET } : {}),
    ...(process.env.OSS_SECURITY_TOKEN ? { stsToken: process.env.OSS_SECURITY_TOKEN } : {}),
  })
  const prefix = config.ossPrefix ? `${config.ossPrefix.replace(/^\/+|\/+$/g, '')}/` : ''
  const written = []
  for (const [rel, content] of files) {
    const key = `${prefix}${rel}`
    await client.put(key, Buffer.from(content, 'utf8'))
    written.push(key)
  }
  const base = config.ossPublicBaseUrl.replace(/\/+$/, '')
  log.info('产出物已发布到 OSS', { bucket: config.ossBucket, files: written })
  return { target: base, written }
}
