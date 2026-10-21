/**
 * 采集层：L1 人工策展 / L2 索引 / L3 候选池 / L4 单点核验。
 *
 * 分层对应设计文档 §3.2 的 L0-L4 表；每层只认自己那一层的产出，
 * 归一化与入库在 catalog.mjs 统一做。
 */
import { log } from './log.mjs'
import { HttpError } from './http.mjs'
import { parseMarkdownList, parseMarketIndex } from './sources.mjs'
import { parseGithubUrl, contractId, isValidNpmName, normalizeNpmVersions } from './normalize.mjs'

// ---------------------------------------------------------------------------
// L1 / L2
// ---------------------------------------------------------------------------

/**
 * 拉取一个信源。失败不阻断整轮：返回 { ok:false, error } 由上层计入摘要。
 */
export async function fetchSource(http, source, options = {}) {
  if (!source.url) {
    return { ok: false, sourceId: source.source_id, error: 'url-missing', entries: [] }
  }
  // 大清单（awesome 主清单 2MB+）需要更长的下载窗口
  const timeoutMs = source.timeoutMs ?? options.timeoutMs
  try {
    if (source.kind === 'market-index') {
      const index = await http.json(source.url, timeoutMs ? { timeoutMs } : {})
      return { ok: true, sourceId: source.source_id, entries: parseMarketIndex(index) }
    }
    const text = await http.text(source.url, timeoutMs ? { timeoutMs } : {})
    return { ok: true, sourceId: source.source_id, entries: parseMarkdownList(text) }
  } catch (error) {
    const detail = error instanceof HttpError ? `http-${error.status}` : String(error?.message ?? error)
    log.warn('信源抓取失败', { source: source.source_id, url: source.url, error: detail })
    return { ok: false, sourceId: source.source_id, error: detail, entries: [] }
  }
}

// ---------------------------------------------------------------------------
// L3 候选池
// ---------------------------------------------------------------------------

/** GitHub topic 搜索（候选池，不计票）。 */
export async function searchGithubTopic(http, config, cursor) {
  const from = Number.isInteger(cursor?.page) ? cursor.page : 1
  const perPage = 100
  const url = `https://api.github.com/search/repositories?q=topic:dsh-plugin&sort=updated&order=desc&per_page=${perPage}&page=${from}`
  try {
    const data = await http.json(url)
    const items = Array.isArray(data?.items) ? data.items : []
    const entries = items.map((item) => {
      const parsed = parseGithubUrl(item?.html_url ?? '')
      if (!parsed) return null
      return {
        repoUrl: parsed.baseUrl,
        subPath: '',
        parsed,
        displayName: item?.name ?? '',
        description: item?.description ?? '',
        stars: Number(item?.stargazers_count ?? 0),
        topics: Array.isArray(item?.topics) ? item.topics : [],
      }
    }).filter(Boolean)
    const nextPage = data?.total_count && entries.length >= perPage ? from + 1 : from
    return { ok: true, entries, cursor: { page: nextPage } }
  } catch (error) {
    log.warn('GitHub topic 搜索失败', { error: String(error?.message ?? error) })
    return { ok: false, entries: [], cursor }
  }
}

/** npm keywords 搜索（候选池，不计票）。 */
export async function searchNpmKeywords(http, config, cursor) {
  const from = Number.isInteger(cursor?.from) ? cursor.from : 0
  const size = Math.min(100, config.candidatePerRun)
  const url = `${config.npmRegistry}/-/v1/search?text=keywords:dsh-plugin&size=${size}&from=${from}`
  try {
    const data = await http.json(url)
    const objects = Array.isArray(data?.objects) ? data.objects : []
    const entries = objects.map((obj) => {
      const pkg = obj?.package ?? {}
      const repo = typeof pkg.links?.repository === 'string' ? pkg.links.repository : ''
      const parsed = parseGithubUrl(repo)
      return {
        npm: typeof pkg.name === 'string' ? pkg.name : '',
        version: pkg.version ?? '',
        description: pkg.description ?? '',
        keywords: Array.isArray(pkg.keywords) ? pkg.keywords : [],
        repoUrl: parsed?.baseUrl ?? '',
        parsed: parsed ?? null,
      }
    }).filter((e) => e.npm !== '')
    const nextFrom = objects.length >= size ? from + size : from
    return { ok: true, entries, cursor: { from: nextFrom } }
  } catch (error) {
    log.warn('npm 关键词搜索失败', { error: String(error?.message ?? error) })
    return { ok: false, entries: [], cursor }
  }
}

// ---------------------------------------------------------------------------
// L4 单点核验
// ---------------------------------------------------------------------------

/**
 * 核验一批插件的 GitHub / npm 事实。
 * 每条返回：stars / pushedAt / archived / license / headCommit / npmVersions / renamedTo / missing。
 */
export async function verifyPlugin(http, config, plugin) {
  const parsed = parseGithubUrl(plugin.github)
  if (!parsed) return { ok: false, error: 'github-url-unparseable' }
  const owner = parsed.owner
  const repo = parsed.repo

  let repoInfo = null
  let renamedTo = null
  let missing = false
  try {
    const res = await http.request(`https://api.github.com/repos/${owner}/${repo}`, { redirect: 'manual' })
    if (res.status === 301 || res.status === 302) {
      // 仓库改名：GitHub 返回 301。注意 Location 通常是
      // https://api.github.com/repositories/<数字 id>，不是 owner/repo 形式，
      // 所以以「跟随重定向后响应里的 full_name」为准，Location 只作兜底。
      const follow = await http.request(`https://api.github.com/repos/${owner}/${repo}`)
      repoInfo = follow.json
      const fullName = String(repoInfo?.full_name ?? '')
      if (fullName.includes('/')) {
        const [newOwner, newRepo] = fullName.split('/')
        if (newOwner.toLowerCase() !== owner.toLowerCase() || newRepo.toLowerCase() !== repo.toLowerCase()) {
          renamedTo = { owner: newOwner, repo: newRepo }
        }
      }
      if (!renamedTo) {
        const location = res.headers.get('location') ?? ''
        const moved = parseGithubUrl(location)
        if (moved) renamedTo = { owner: moved.owner, repo: moved.repo }
      }
    } else if (res.status === 404) {
      missing = true
    } else {
      repoInfo = res.json
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) missing = true
    else return { ok: false, error: `github-${String(error?.message ?? error).slice(0, 120)}` }
  }

  if (missing) return { ok: true, missing: true, stars: 0, npmVersions: [] }

  const info = repoInfo ?? {}
  const defaultBranch = info.default_branch ?? 'HEAD'

  // 默认分支 HEAD 提交（format-1 的 git source 需要 40 位 commit）
  let headCommit = null
  let headCommittedAt = null
  try {
    const res = await http.json(
      `https://api.github.com/repos/${info.full_name ?? `${owner}/${repo}`}/commits/${encodeURIComponent(defaultBranch)}`,
    )
    if (res?.sha && /^[0-9a-f]{40}$/.test(res.sha)) {
      headCommit = res.sha
      headCommittedAt = res?.commit?.committer?.date ?? null
    }
  } catch (error) {
    log.debug('取 HEAD 提交失败', { repo: info.full_name ?? `${owner}/${repo}`, error: String(error?.message ?? error) })
  }

  // npm registry 版本时间线
  let npmVersions = []
  if (plugin.npm && isValidNpmName(plugin.npm)) {
    try {
      const doc = await http.json(`${config.npmRegistry}/${encodeURIComponent(plugin.npm).replace('%40', '@')}`)
      const times = doc?.time ?? {}
      npmVersions = normalizeNpmVersions(
        Object.keys(doc?.versions ?? {})
          .map((ver) => ({ ver, time: times[ver] ?? null })),
      )
    } catch (error) {
      log.debug('取 npm 版本失败', { npm: plugin.npm, error: String(error?.message ?? error) })
    }
  }

  return {
    ok: true,
    missing: false,
    stars: Number(info.stargazers_count ?? 0),
    pushedAt: info.pushed_at ?? null,
    archived: Boolean(info.archived),
    disabled: Boolean(info.disabled),
    license: spdxId(info.license),
    defaultBranch,
    headCommit,
    headCommittedAt,
    renamedTo,
    fullName: info.full_name ?? `${owner}/${repo}`,
    npmVersions,
  }
}

function spdxId(license) {
  if (!license) return ''
  const id = typeof license === 'string' ? license : license.spdx_id
  if (!id) return ''
  if (id === 'NOASSERTION') return ''
  return String(id)
}

/** 由仓库信息推导合成 npm 名（仅 npm 未发布时使用，format-1 要求 name 是合法 npm 名）。 */
export function syntheticNpmName(owner, repo, subPath) {
  const scope = String(owner).toLowerCase().replace(/[^a-z0-9._~-]+/g, '-').replace(/^[^a-z0-9]+/, '')
  let base = String(repo).toLowerCase().replace(/[^a-z0-9._~-]+/g, '-').replace(/^[^a-z0-9]+/, '')
  const sub = String(subPath ?? '').replace(/^\/+|\/+$/g, '')
  if (sub) {
    base += `.${sub.toLowerCase().split('/').map((seg) => seg.replace(/[^a-z0-9._~-]+/g, '-').replace(/^[^a-z0-9]+/, '')).filter(Boolean).join('.')}`
  }
  const name = `@${scope || 'dsh'}/${base || 'plugin'}`
  return isValidNpmName(name) ? name : null
}

/** 由分支与提交派生一个合法的精确 SemVer（git 源无发布版时使用）。 */
export function syntheticVersion(branch, commit) {
  const b = String(branch ?? 'head').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'head'
  const sha = String(commit ?? '').slice(0, 7).toLowerCase()
  const suffix = sha ? `${b}.${sha}` : b
  return `0.0.0-${suffix}`
}
