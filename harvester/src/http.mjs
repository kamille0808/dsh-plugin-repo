/**
 * 带限流、退避重试、超时的 HTTP 客户端。
 *
 * 设计要点（设计文档 §3.2「限流与凭据」）：
 * - 每个 host 独立令牌桶；GitHub 与 npm 配额口径不同。
 * - 认证时优先读 GitHub 响应头 x-ratelimit-remaining/reset 自适应降速；
 *   匿名时按 60 次/小时的保守额度限流。
 * - 429 / 403（带 Retry-After 或 rate-limit 头）/ 5xx 走指数退避。
 * - 凭据只出现在请求头，不进日志。
 */
import { log } from './log.mjs'

class TokenBucket {
  constructor(capacity, refillPerMs) {
    this.capacity = capacity
    this.tokens = capacity
    this.refillPerMs = refillPerMs
    this.last = Date.now()
  }

  take() {
    const now = Date.now()
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.last) * this.refillPerMs)
    this.last = now
    if (this.tokens >= 1) {
      this.tokens -= 1
      return 0
    }
    return Math.ceil((1 - this.tokens) / this.refillPerMs)
  }
}

export class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} ${url}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
    this.body = body
  }
}

export class HttpClient {
  /**
   * @param {object} opts
   * @param {string} opts.userAgent
   * @param {string} [opts.githubToken]
   * @param {number} [opts.timeoutMs]
   * @param {number} [opts.retries]
   * @param {number} [opts.concurrency]
   */
  constructor(opts) {
    this.userAgent = opts.userAgent
    this.githubToken = opts.githubToken ?? ''
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.retries = opts.retries ?? 3
    this.concurrency = opts.concurrency ?? 4
    this.buckets = new Map()
    this.stats = { requests: 0, retries: 0, failures: 0 }
    this.semaphore = { limit: this.concurrency, active: 0, queue: [] }
  }

  bucketFor(host, perHour) {
    const key = `${host}|${perHour}`
    let bucket = this.buckets.get(key)
    if (!bucket) {
      // 令牌桶容量 = 1 分钟额度，避免突发打满小时配额
      const perMinute = Math.max(1, perHour / 60)
      bucket = new TokenBucket(perMinute, perMinute / 60_000)
      this.buckets.set(key, bucket)
    }
    return bucket
  }

  async acquire() {
    if (this.semaphore.active < this.semaphore.limit) {
      this.semaphore.active += 1
      return
    }
    await new Promise((resolve) => this.semaphore.queue.push(resolve))
    this.semaphore.active += 1
  }

  release() {
    this.semaphore.active -= 1
    const next = this.semaphore.queue.shift()
    if (next) next()
  }

  headersFor(url) {
    const headers = {
      'User-Agent': this.userAgent,
      Accept: 'application/vnd.github+json, application/json;q=0.9, */*;q=0.8',
    }
    if (this.githubToken && isGitHubHost(url.hostname)) {
      headers.Authorization = `Bearer ${this.githubToken}`
    }
    return headers
  }

  /**
   * 发起请求；返回 { status, headers, text, json }。
   * 非 2xx 抛 HttpError（携带 body，便于上层判别 404/403/429）。
   */
  async request(url, { method = 'GET', headers = {}, body, accept = 'text', redirect = 'follow', timeoutMs } = {}) {
    const target = new URL(url)
    const perHour = isGitHubHost(target.hostname)
      ? (this.githubToken ? 4800 : 55)
      : isNpmHost(target.hostname)
        ? (this.npmRatePerHour ?? 7000)
        : 3600
    const bucket = this.bucketFor(target.hostname, perHour)
    const waitMs = bucket.take()
    if (waitMs > 0) await sleep(waitMs)

    await this.acquire()
    try {
      let attempt = 0
      for (;;) {
        attempt += 1
        this.stats.requests += 1
        let res
        try {
          res = await fetch(target, {
            method,
            headers: { ...this.headersFor(target), ...headers },
            body,
            signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
            redirect,
          })
        } catch (error) {
          if (attempt > this.retries) {
            this.stats.failures += 1
            throw new Error(`请求失败：${target.toString()}（${describeError(error)}）`)
          }
          this.stats.retries += 1
          const delay = backoffMs(attempt)
          log.debug('重试外部请求', { url: target.toString(), error: describeError(error), delayMs: delay })
          await sleep(delay)
          continue
        }

        // 手动重定向模式：3xx 不算错误，交给上层判断（GitHub 仓库改名返回 301 + Location）
        if (redirect === 'manual' && res.status >= 300 && res.status < 400) {
          return { status: res.status, headers: res.headers, text: await res.text().catch(() => ''), json: null }
        }

        if (res.ok) {
          if (accept === 'json') {
            const text = await res.text()
            try {
              return { status: res.status, headers: res.headers, text, json: JSON.parse(text) }
            } catch (error) {
              throw new Error(`响应不是合法 JSON：${target}（${String(error?.message ?? error)}）`)
            }
          }
          return { status: res.status, headers: res.headers, text: await res.text() }
        }

        const retryable = res.status === 429 || res.status >= 500
          || (res.status === 403 && isRateLimited(res.headers))
        if (retryable && attempt <= this.retries) {
          this.stats.retries += 1
          const delay = retryAfterMs(res.headers, attempt)
          log.debug('重试外部请求', { url: target.toString(), status: res.status, delayMs: delay })
          await sleep(delay)
          continue
        }
        this.stats.failures += 1
        const text = await res.text().catch(() => '')
        throw new HttpError(res.status, target.toString(), text.slice(0, 2000))
      }
    } finally {
      this.release()
    }
  }

  async json(url, options) {
    const res = await this.request(url, { ...options, accept: 'json' })
    return res.json
  }

  async text(url, options) {
    const res = await this.request(url, { ...options, accept: 'text' })
    return res.text
  }

  set npmRatePerHour(value) {
    this._npmRatePerHour = value
  }

  get npmRatePerHour() {
    return this._npmRatePerHour
  }
}

function isGitHubHost(host) {
  return host === 'github.com' || host === 'api.github.com' || host === 'raw.githubusercontent.com'
    || host === 'codeload.github.com' || host === 'objects.githubusercontent.com'
}

function isNpmHost(host) {
  return host === 'registry.npmjs.org' || host === 'npmjs.com' || host === 'www.npmjs.com'
}

function isRateLimited(headers) {
  return headers.get('retry-after') !== null
    || headers.get('x-ratelimit-remaining') === '0'
}

function retryAfterMs(headers, attempt) {
  const retryAfter = headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 60_000)
  }
  const reset = Number(headers.get('x-ratelimit-reset'))
  if (Number.isFinite(reset) && reset > 0) {
    const delta = reset * 1000 - Date.now()
    if (delta > 0) return Math.min(delta, 60_000)
  }
  return backoffMs(attempt)
}

function backoffMs(attempt) {
  const base = 800 * 2 ** (attempt - 1)
  const jitter = Math.floor(Math.random() * 400)
  return base + jitter
}

/**
 * 描述底层网络错误。
 * undici 的 "fetch failed" 是个泛化错误，真正的原因在 cause 里
 * （DNS 失败 / 连接被重置 / TLS 握手失败），不挖出来就没法排障。
 */
export function describeError(error) {
  const parts = [String(error?.message ?? error)]
  let cause = error?.cause
  let depth = 0
  while (cause && depth < 4) {
    const text = String(cause?.message ?? cause)
    if (text && !parts.includes(text)) parts.push(text)
    cause = cause?.cause
    depth += 1
  }
  return parts.join(' / ')
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
