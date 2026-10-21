/**
 * 产出物发布：本地目录 / nginx 静态托管 / 阿里云 OSS。
 *
 * 契约 §8：发布到公网静态托管（首选 OSS，备选 GitHub Pages）。
 * 默认 publisher=file —— 始终产出一份可发布的 dist/，部署方式交给外层
 * （GitHub Pages 工作流、rsync、nginx 挂载都吃得下）。
 */
import { mkdir, writeFile, rename, chmod, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
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
  if (publisher === 'nginx') return publishToNginx(config, files)
  if (publisher === 'oss') return publishToOss(config, files)
  throw new Error(`未知的 publisher：${publisher}（支持 file | nginx | oss）`)
}

/**
 * 原子写入单个文件：先写同目录临时文件，再 rename 覆盖。
 *
 * 为什么必须原子：nginx 直接对外提供 index.json（3MB+）和 index.html（2.7MB+）。
 * 直接 writeFile 的话，下载方有概率拿到写了一半的 JSON——解析失败，
 * DSH「发现」页当场报错。rename 在同一文件系统内是原子的，
 * 读者要么看到旧文件，要么看到完整的新文件。
 */
async function writeFileAtomic(target, content) {
  const dir = path.dirname(target)
  await mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(target)}.tmp-${process.pid}-${Date.now()}`)
  try {
    await writeFile(tmp, content, 'utf8')
    await chmod(tmp, 0o644).catch(() => {})
    await rename(tmp, target)
  } catch (error) {
    // 失败时别把临时文件留在 web 根目录里（nginx 会把它当静态文件暴露出去）
    await rmQuiet(tmp)
    throw error
  }
}

async function rmQuiet(file) {
  try {
    await rm(file, { force: true })
  } catch {
    // 清理失败不影响主流程
  }
}

async function publishToDirectory(outDir, files) {
  await mkdir(outDir, { recursive: true })
  const written = []
  for (const [rel, content] of files) {
    const target = path.join(outDir, rel)
    await writeFileAtomic(target, content)
    written.push(rel)
  }
  log.info('产出物已写入本地目录', { dir: outDir, files: written })
  return { target: outDir, written }
}

/**
 * nginx 静态托管（阿里云 ECS + 已有 nginx + 已有域名）。
 *
 * 两种部署形态都覆盖：
 *   ① 发现器就跑在 ECS 上   → 直接写 nginx 的 root 目录（原子替换）
 *   ② 发现器跑在别的机器上 → 先写本地目录，再用 rsync 同步到 ECS
 *
 * 发布后可开启回源自检：GET 公开地址的 index.json，确认 nginx 已经
 * 把新文件发出来了——这比「文件写成功」更接近用户实际看到的东西。
 */
async function publishToNginx(config, files) {
  const localDir = config.nginxRoot || config.outDir
  await mkdir(localDir, { recursive: true })
  const written = []
  for (const [rel, content] of files) {
    const target = path.join(localDir, rel)
    await writeFileAtomic(target, content)
    written.push(rel)
  }
  log.info('产出物已原子替换到 nginx 目录', { dir: localDir, files: written })

  let synced = null
  if (config.rsyncTarget) {
    synced = await rsyncTo(config.rsyncBin, localDir, config.rsyncTarget)
    log.info('已同步到远端 ECS', { target: config.rsyncTarget, files: written })
  }

  let probe = null
  if (config.nginxProbeUrl) {
    probe = await probePublished(config.nginxProbeUrl, files, {
      attempts: config.nginxProbeAttempts,
      delayMs: config.nginxProbeDelayMs,
    })
  }

  const base = (config.nginxProbeUrl || config.indexBaseUrl || '').replace(/\/+$/, '')
  return { target: base || localDir, written, localDir, synced, probe }
}

/** rsync 同步到远端；失败直接抛错（发布失败就该让本轮任务亮红）。 */
async function rsyncTo(bin, localDir, target) {
  const args = ['-az', '--delete', `${localDir}/`, target]
  await new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (error) => {
      reject(new Error(`rsync 启动失败（${bin}）：${error.message}。未安装 rsync 可改用 publisher=file + 外部同步`))
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`rsync 退出码 ${code}：${stderr.trim().slice(0, 500)}`))
    })
  })
  return { target }
}

/**
 * 发布后回源自检：确认公开地址能拿到完整的新 index.json。
 * 只比对字节长度，不下载全文（3MB 没必要）。
 */
async function probePublished(baseUrl, files, options = {}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/index.json`
  // 比对的是字节数不是字符串长度：index.json 里有中文简介，
  // UTF-8 字节数明显大于 UTF-16 字符数，用 length 会误判成「内容不完整」。
  const expected = Buffer.byteLength(files.get('index.json') ?? '', 'utf8')
  const attempts = Math.max(1, options.attempts ?? 3)
  const delayMs = Math.max(0, options.delayMs ?? 1500)
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      let response
      try {
        response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
      } finally {
        clearTimeout(timer)
      }
      if (!response.ok) {
        lastError = `HTTP ${response.status}`
        await response.body?.cancel?.()
      } else {
        const buffer = await response.arrayBuffer()
        const actual = buffer.byteLength
        // fetch 会自动解开 gzip，所以拿到的是解压后的字节数，应该与本地产物一致。
        // 留 50% 的宽松阈值：中途被截断的响应才是真正要拦的情况。
        const ok = expected === 0 || actual >= expected * 0.5
        return { url, status: response.status, bytes: actual, expectedBytes: expected, ok, attempt }
      }
    } catch (error) {
      lastError = String(error?.message ?? error)
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
  }
  log.warn('发布后回源自检未通过', { url, error: lastError })
  return { url, ok: false, error: lastError }
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
