/**
 * 本地凭据文件（口令的「输入地方」）。
 *
 * 目标：口令有地方放，但绝不经对话、绝不进 git、绝不进日志。
 *
 * - 文件：harvester/.env.local（被 .gitignore 忽略；仓库里没有模板）
 * - 格式：KEY=VALUE，每行一条；# 开头为注释
 * - 优先级：进程环境变量 > .env.local。显式设的环境变量永远赢，
 *   所以 systemd / CI 里注入的环境变量不会被文件里的旧值覆盖。
 * - 权限：POSIX 下 0600；Windows 下文件落在用户目录，沿用用户配置文件 ACL
 *   （仅当前用户 + SYSTEM + Administrators 可读）。
 *
 * 这个文件是「环境变量的持久化形式」——本质仍是环境变量，只是不必每次
 * 在 shell 里重敲，也就不会经由聊天记录、shell history、进程列表外泄。
 */
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '..')

/** 凭据文件路径。可用 HARVESTER_SECRETS_FILE 覆盖（便于放到仓库外的受控位置）。 */
export function secretFilePath() {
  return process.env.HARVESTER_SECRETS_FILE
    ? path.resolve(process.env.HARVESTER_SECRETS_FILE)
    : path.join(ROOT, '.env.local')
}

/**
 * 解析 .env 风格文本。
 * @param {string} text
 * @returns {Record<string,string>}
 */
export function parseEnvText(text) {
  const out = {}
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!key) continue
    let value = line.slice(eq + 1).trim()
    // 去掉成对的引号；引号内的 # 不是注释
    if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/**
 * 把凭据文件载入 process.env。
 * 已存在的环境变量优先，不被文件覆盖。
 *
 * @param {object} [options]
 * @param {string} [options.file] 覆盖文件路径
 * @returns {Promise<{path:string, exists:boolean, loaded:string[]}>}
 */
export async function loadEnvFile(options = {}) {
  const file = options.file ? path.resolve(options.file) : secretFilePath()
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { path: file, exists: false, loaded: [] }
    throw error
  }
  const parsed = parseEnvText(text)
  const loaded = []
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value
      loaded.push(key)
    }
  }
  return { path: file, exists: true, loaded }
}

/**
 * 写入 / 覆盖凭据文件里的某个键。
 * 已有的其他键原样保留（注释也保留）。
 *
 * @param {string} key
 * @param {string} value
 * @param {object} [options]
 * @param {string} [options.file]
 * @returns {Promise<{path:string, created:boolean}>}
 */
export async function upsertEnvValue(key, value, options = {}) {
  const file = options.file ? path.resolve(options.file) : secretFilePath()
  await mkdir(path.dirname(file), { recursive: true })

  let lines = []
  try {
    const text = await readFile(file, 'utf8')
    lines = text.split(/\r?\n/)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const encoded = encodeValue(value)
  let replaced = false
  const next = []
  for (const line of lines) {
    const trimmed = line.trim()
    const eq = trimmed.indexOf('=')
    const lineKey = eq > 0 ? trimmed.slice(0, eq).trim() : ''
    if (lineKey === key && !trimmed.startsWith('#')) {
      if (!replaced) {
        next.push(`${key}=${encoded}`)
        replaced = true
      }
      continue // 同名重复行只保留一条
    }
    next.push(line)
  }
  if (!replaced) next.push(`${key}=${encoded}`)

  const body = next.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')
  await writeFile(file, `${body}\n`, { encoding: 'utf8', mode: 0o600 })
  await restrictPermissions(file)
  return { path: file, created: !replaced }
}

/** 需要引号的值加引号；含 # 或空格的必须加，否则会被 .env 解析截断。 */
function encodeValue(value) {
  const text = String(value ?? '')
  if (text === '') return '""'
  if (/[#\s"']/.test(text)) return `"${text.replace(/"/g, '\\"')}"`
  return text
}

/** POSIX 下收紧到 0600；Windows 下用户目录 ACL 已经够紧，不做额外操作。 */
async function restrictPermissions(file) {
  if (process.platform === 'win32') return
  try {
    await chmod(file, 0o600)
  } catch {
    // 权限收紧失败不阻断主流程，但值得知道
  }
}

/**
 * 连接串脱敏：postgres://user:pass@host/db → postgres://user:***@host/db
 * 与 log.mjs 的 redactUri 同口径，这里单独导出给 CLI 展示用。
 */
export function maskDatabaseUrl(value) {
  if (typeof value !== 'string' || !value) return ''
  return value.replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/@]*(@)/gi, '$1***$2')
}

/**
 * 隐藏输入口令。TTY 下不回显任何字符；非 TTY（管道）下读 stdin 全部内容。
 *
 * @param {string} label 提示语
 * @param {object} [options]
 * @param {string} [options.mask] 回显的掩码字符（默认完全不回显）
 * @returns {Promise<string>}
 */
export function promptSecret(label, options = {}) {
  const mask = options.mask ?? ''
  if (!process.stdin.isTTY) {
    return readAllStdin().then((text) => text.trim())
  }
  return new Promise((resolve, reject) => {
    const input = process.stdin
    const output = process.stdout
    let value = ''
    let settled = false

    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      try { input.setRawMode(false) } catch { /* 非 raw 模式 */ }
      input.pause()
      input.removeListener('data', onData)
      fn(arg)
    }

    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === '\u0003') {            // Ctrl+C
          output.write('\n')
          finish(reject, new Error('已取消'))
          return
        }
        if (ch === '\r' || ch === '\n') { // Enter
          output.write('\n')
          finish(resolve, value)
          return
        }
        if (ch === '\u007F' || ch === '\b') { // Backspace
          if (value.length > 0) {
            value = value.slice(0, -1)
            output.write(mask ? '\b \b' : '\b \b')
          }
          continue
        }
        if (ch === '\u001b') {            // ESC：忽略整个转义序列
          continue
        }
        if (ch < ' ') continue            // 其余控制字符忽略
        value += ch
        if (mask) output.write(mask)
      }
    }

    output.write(label)
    input.setRawMode(true)
    input.resume()
    input.setEncoding('utf8')
    input.on('data', onData)
  })
}

/** 读干到 EOF 的 stdin（管道模式）。 */
export function readAllStdin() {
  return new Promise((resolve, reject) => {
    let text = ''
    const onData = (chunk) => { text += chunk }
    const onEnd = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.removeListener('end', onEnd)
      resolve(text)
    }
    const onError = (error) => {
      process.stdin.removeListener('data', onData)
      process.stdin.removeListener('end', onEnd)
      reject(error)
    }
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', onData)
    process.stdin.on('end', onEnd)
    process.stdin.on('error', onError)
    process.stdin.resume()
  })
}
