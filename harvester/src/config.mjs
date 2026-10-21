/**
 * 运行配置：全部来自环境变量 + 两个 JSON 配置文件。
 *
 * 凭据纪律：DATABASE_URL / GITHUB_TOKEN 只从环境变量读，不落配置文件、不回显。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { log } from './log.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '..')

async function readJson(rel) {
  return JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'))
}

function num(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback
  return /^(1|true|yes|on)$/i.test(String(value))
}

/**
 * 解析 DATABASE_URL 的 TLS 参数。
 *
 * 交接说明三的硬要求：不要用 sslmode=require（新版 pg-connection-string 按
 * verify-full 处理，RDS 私有 CA 会报 self-signed）。这里显式映射：
 *   no-verify  → 加密但不验证书（联调用）
 *   verify-full → 加密且验证书（正式，需 sslrootcert 指向 RDS CA）
 */
export function resolveTls(databaseUrl) {
  const url = new URL(databaseUrl)
  const mode = url.searchParams.get('sslmode') ?? 'no-verify'
  const rootCert = url.searchParams.get('sslrootcert')
  url.searchParams.delete('sslmode')
  url.searchParams.delete('sslrootcert')
  if (mode === 'verify-full' || mode === 'verify-ca') {
    if (!rootCert) {
      throw new Error('sslmode=verify-full 需要 sslrootcert=<RDS CA 证书路径>')
    }
    return { connectionString: url.toString(), ssl: { ca: rootCert, rejectUnauthorized: true } }
  }
  if (mode === 'disable' || mode === 'allow' || mode === 'prefer') {
    log.warn('数据库连接未启用 TLS', { sslmode: mode })
    return { connectionString: url.toString(), ssl: false }
  }
  if (mode !== 'no-verify') {
    log.warn('未识别的 sslmode，按 no-verify 处理', { sslmode: mode })
  }
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } }
}

export async function loadConfig(options = {}) {
  const requireDatabase = options.requireDatabase ?? true
  const [sources, categories] = await Promise.all([
    readJson('config/sources.json'),
    readJson('config/categories.json'),
  ])

  const config = {
    databaseUrl: process.env.DATABASE_URL ?? '',
    githubToken: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '',
    npmRegistry: process.env.NPM_REGISTRY ?? 'https://registry.npmjs.org',
    userAgent: process.env.HARVESTER_USER_AGENT ?? 'dsh-plugin-harvester/0.1 (+https://codeup.aliyun.com/dsh/dsh-plugin-repo)',

    // 抓取节奏
    httpTimeoutMs: num(process.env.HARVESTER_HTTP_TIMEOUT_MS, 30_000),
    httpRetries: num(process.env.HARVESTER_HTTP_RETRIES, 5),
    httpConcurrency: num(process.env.HARVESTER_HTTP_CONCURRENCY, 4),
    // GitHub 匿名 60 次/小时，认证 5000 次/小时；留余量按 4500/h 限流
    githubRatePerHour: num(process.env.HARVESTER_GITHUB_RATE_PER_HOUR, 4500),
    npmRatePerMinute: num(process.env.HARVESTER_NPM_RATE_PER_MINUTE, 120),

    // L4 核验批量
    verifyBatchSize: num(process.env.HARVESTER_VERIFY_BATCH, 200),
    verifyMaxPerRun: num(process.env.HARVESTER_VERIFY_MAX_PER_RUN, 400),
    goneMissThreshold: num(process.env.HARVESTER_GONE_MISS_THRESHOLD, 3),

    // 候选池
    candidateLimit: num(process.env.HARVESTER_CANDIDATE_LIMIT, 300),
    candidatePerRun: num(process.env.HARVESTER_CANDIDATE_PER_RUN, 100),

    // 产出物
    outDir: process.env.HARVESTER_OUT_DIR ?? path.join(ROOT, 'dist'),
    // 浏览页最多收录多少条（按共识票→star 排序取前 N；0 = 不限）。
    // 完整目录在 PG 与 format-1 索引里，浏览页是给人看的那一面。
    browseLimit: num(process.env.HARVESTER_BROWSE_LIMIT, 5000),
    publisher: process.env.HARVESTER_PUBLISHER ?? 'file',
    ossBucket: process.env.OSS_BUCKET ?? '',
    ossRegion: process.env.OSS_REGION ?? '',
    ossPrefix: process.env.OSS_PREFIX ?? '',
    ossPublicBaseUrl: process.env.OSS_PUBLIC_BASE_URL ?? '',
    indexBaseUrl: process.env.HARVESTER_INDEX_BASE_URL ?? 'https://dsh-plugin-repo.pages.dev',

    // 行为开关
    dryRun: false,
    sources,
    categories,
  }

  // 允许入库的分类白名单：契约的 23 个内置分类 + 显式增补的
  config.knownCategories = [...(categories.known ?? []), ...(categories.extra ?? [])]

  if (requireDatabase && !config.databaseUrl) {
    throw new Error('缺少 DATABASE_URL 环境变量（联调：postgres://<user>:<pw>@<host>:5432/dsh_plugin_repo_dev?sslmode=no-verify）')
  }
  if (!config.githubToken) {
    log.warn('未配置 GITHUB_TOKEN：GitHub 匿名配额 60 次/小时，L4 核验会大量失败', {})
  }
  return config
}
