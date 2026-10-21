/**
 * 结构化日志 + 凭据脱敏。
 *
 * 纪律（契约 §4.4 / 交接说明三）：token 与连接串只存在于运行环境变量，
 * 不进日志、不进库、不进导出物。本模块在写出前统一做脱敏。
 */
const SECRET_KEYS = /(?:token|secret|password|passwd|pwd|authorization|cookie|apikey|api_key|access_key|database_url|connection_string|dsn)/i

/** 形如 postgres://user:pass@host/db 的 URI → 抹掉口令。 */
export function redactUri(value) {
  if (typeof value !== 'string') return value
  return value.replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/@]*(@)/gi, '$1***$2')
}

/** 递归脱敏任意对象（用于日志上下文）。 */
export function redact(value, depth = 0) {
  if (depth > 6) return '[deep]'
  if (typeof value === 'string') return redactUri(value)
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.test(k) ? '***' : redact(v, depth + 1)
    }
    return out
  }
  return value
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }

let threshold = LEVELS[process.env.HARVESTER_LOG_LEVEL ?? 'info'] ?? LEVELS.info
let sink = (line) => process.stdout.write(`${line}\n`)

export function setLogLevel(level) {
  if (LEVELS[level] !== undefined) threshold = LEVELS[level]
}

export function setLogSink(fn) {
  sink = fn
}

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold) return
  const time = new Date().toISOString()
  const parts = [`${time} ${level.toUpperCase().padEnd(5)} ${msg}`]
  if (fields && Object.keys(fields).length > 0) {
    parts.push(JSON.stringify(redact(fields)))
  }
  sink(parts.join(' '))
}

export const log = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
}
