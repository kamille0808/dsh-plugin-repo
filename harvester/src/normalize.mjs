/**
 * 归一化：外部条目 → 契约记录模型。
 *
 * 契约 §2：id 为小写规范化 owner/repo，monorepo 子包追加 '#path:/subdir'。
 * 契约 §2：install_spec 必须通过官方 parseInstallSpec 口径。
 */
import { parseInstallSpec } from '@deepseek-ai/dsh-plugin-manager'
import { log } from './log.mjs'

const GITHUB_RE = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/tree\/[^/]+\/(.+?))?\/?$/i

/**
 * 解析 GitHub 仓库链接 → { owner, repo, subPath, canonicalUrl }。
 * 支持 /tree/<branch>/<path>（monorepo 子包）。
 */
export function parseGithubUrl(raw) {
  const text = String(raw ?? '').trim()
  const m = GITHUB_RE.exec(text)
  if (!m) return null
  const owner = m[1]
  const repo = m[2].replace(/\.git$/i, '')
  const subPath = (m[3] ?? '').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!owner || !repo) return null
  return {
    owner,
    repo,
    subPath,
    canonicalUrl: `https://github.com/${owner}/${repo}${subPath ? `/tree/HEAD/${subPath}` : ''}`,
    baseUrl: `https://github.com/${owner}/${repo}`,
  }
}

/**
 * 契约 id：owner/repo 小写；monorepo 子包追加 '#path:/subdir'。
 * 与 tools/seed/seed.mjs 的 contractId 同口径。
 */
export function contractId(owner, repo, subPath) {
  const base = `${owner}/${repo}`.toLowerCase()
  const sub = String(subPath ?? '').replace(/^\//, '').replace(/\/$/, '')
  return sub ? `${base}#path:/${sub}` : base
}

/** 从 GitHub URL 直接算契约 id。 */
export function idFromGithubUrl(raw) {
  const parsed = parseGithubUrl(raw)
  if (!parsed) return null
  return contractId(parsed.owner, parsed.repo, parsed.subPath)
}

/** 从契约 id 反解 owner / repo / 子路径。 */
export function parseContractId(id) {
  const text = String(id ?? '')
  const hashIndex = text.indexOf('#path:')
  const base = hashIndex === -1 ? text : text.slice(0, hashIndex)
  const subPath = hashIndex === -1 ? '' : text.slice(hashIndex + '#path:/'.length)
  const [owner, repo] = base.split('/')
  if (!owner || !repo) return null
  return { owner, repo, subPath }
}

/**
 * 生成 install_spec。
 * 有 npm 包 → npm 名（registry 形态）；否则 → github:owner/repo[#path:/sub]。
 * 产出后必须过官方 parseInstallSpec 口径，过不了返回 null（不入库）。
 */
export function buildInstallSpec({ npm, owner, repo, subPath }) {
  const candidates = []
  if (npm) candidates.push(npm)
  if (owner && repo) {
    const sub = String(subPath ?? '').replace(/^\//, '').replace(/\/$/, '')
    candidates.push(`github:${owner}/${repo}${sub ? `#path:/${sub}` : ''}`)
  }
  for (const spec of candidates) {
    try {
      parseInstallSpec(spec)
      return spec
    } catch (error) {
      log.debug('install_spec 未通过官方口径', { spec, reason: String(error?.reason ?? error?.message ?? error) })
    }
  }
  return null
}

/** 官方口径校验：给定 spec 是否可被 plugin_manager 接受。 */
export function isValidInstallSpec(spec) {
  try {
    parseInstallSpec(spec)
    return true
  } catch {
    return false
  }
}

/** 分类英文标题 → 契约 slug（与 seed.mjs 的 slugifyCategory 同规则）。 */
export function slugifyCategory(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * 外部分类标题 → 契约 categories.id。
 * 先查 alias（键为小写归一后的标题），再走 slugify。
 *
 * 白名单：解析结果必须落在契约的 23 个内置分类（或 config 里显式 extra 的分类）
 * 才算数，否则视为「未分类」。社区清单里的章节标题（'Hot Plugins' 之类）
 * 不是插件分类，放进共享分类表会污染所有主机。
 */
export function resolveCategoryId(title, aliasMap = {}, known = null) {
  const raw = String(title ?? '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  let slug = aliasMap[key] ?? ''
  if (!slug) slug = slugifyCategory(raw)
  if (!slug) return ''
  if (known && !known.includes(slug)) return ''
  return slug
}

/** npm 包名合法性（format-1 索引与官方 registry 同口径）。 */
const NPM_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
const NPM_NAME_MAX = 214

export function isValidNpmName(name) {
  return typeof name === 'string'
    && name.length > 0
    && name.length <= NPM_NAME_MAX
    && NPM_NAME.test(name)
}

/** 精确 SemVer（format-1 要求 version 为 exact SemVer）。 */
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

export function isValidSemver(version) {
  return typeof version === 'string' && SEMVER.test(version)
}

/** npm 时间线 → 契约 npm_versions（[{ver,time}]，按时间倒序）。 */
export function normalizeNpmVersions(versions) {
  if (!Array.isArray(versions)) return []
  return versions
    .filter((v) => v && typeof v.ver === 'string' && v.ver !== '')
    .map((v) => ({ ver: v.ver, time: v.time ?? null }))
    .sort((a, b) => {
      const at = a.time ? Date.parse(a.time) : 0
      const bt = b.time ? Date.parse(b.time) : 0
      if (bt !== at) return bt - at
      return compareSemverDesc(a.ver, b.ver)
    })
}

/** 粗略的 semver 降序比较（只用于排序，不做完整前置规则判定）。 */
export function compareSemverDesc(a, b) {
  const pa = String(a).split('-')[0].split('.').map(Number)
  const pb = String(b).split('-')[0].split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (d !== 0) return d
  }
  return String(b).localeCompare(String(a))
}

/** 取版本时间线的最新版本号（比较用）。 */
export function latestVersion(versions) {
  if (!Array.isArray(versions) || versions.length === 0) return null
  return versions
    .slice()
    .sort((a, b) => compareSemverDesc(a.ver, b.ver))
    .map((v) => v.ver)[0]
}

/** 信号快照哈希：用于 diff 短路（契约 §3.2「各信源快照哈希」）。 */
export function signalsHash(parts) {
  const text = JSON.stringify(parts ?? {})
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}
