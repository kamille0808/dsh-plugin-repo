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
