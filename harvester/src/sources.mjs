/**
 * 信源解析器：把外部清单/索引解析成统一的「条目」结构。
 *
 * 条目结构（归一化前的原始形态）：
 *   { repoUrl, subPath, displayName, description, categoryTitle, npm, versions, homepage }
 *
 * 两种解析器：
 *   markdown-list —— 社区人工策展清单（### 分类 + - [名字](链接) - 描述；兼容表格行）
 *   market-index  —— 官方 format-1 索引（npm 包 + 版本 + 仓库 + 分类）
 */
import { parseGithubUrl, isValidNpmName } from './normalize.mjs'

/** 非分类的章节标题（避免把 "Plugins"/"Badge" 当成分类）。 */
const STOP_HEADINGS = new Set([
  'plugins', 'contents', 'table of contents', 'badge', 'disclaimer', 'contributing',
  'index', 'overview', 'about', 'introduction', 'quick start', 'install', 'usage',
  'license', 'acknowledgements', 'acknowledgments', 'stars', 'features', 'screenshots',
  'docs', 'documentation', 'links', 'related', 'see also', 'contribute', 'submit',
  'how submissions are reviewed', '收录如何评审', '插件', '目录', '免责声明', '徽章',
])

const BULLET_RE = /^\s*[-*+]\s*\[([^\]]*)\]\(([^)\s]+)\)\s*(?:[-–—:：]\s*(.*))?$/
const TABLE_RE = /^\s*\|.*$/
const CELL_LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g
const GITHUB_URL_RE = /https?:\/\/github\.com\/[^\s<>|)"]+/gi

/** Markdown → 条目列表。 */
export function parseMarkdownList(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/)
  const entries = []
  const seen = new Set()
  let heading = ''

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)
    if (headingMatch) {
      const text = headingMatch[2].replace(/\s*#+\s*$/, '').trim()
      if (!STOP_HEADINGS.has(text.toLowerCase())) heading = text
      continue
    }

    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      const url = bullet[2]
      if (/^https?:\/\/github\.com\//i.test(url)) {
        push(entries, seen, {
          repoUrl: url,
          displayName: bullet[1] ?? '',
          description: (bullet[3] ?? '').trim(),
          categoryTitle: heading,
        })
        continue
      }
    }

    if (TABLE_RE.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue
      let match = null
      for (const m of line.matchAll(CELL_LINK_RE)) {
        if (/^https?:\/\/github\.com\//i.test(m[2])) {
          match = m
          break
        }
      }
      if (match) {
        const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
        const descCell = cells.find((c) => !c.includes('github.com') && !c.includes(match[2])) ?? ''
        push(entries, seen, {
          repoUrl: match[2],
          displayName: match[1] ?? '',
          description: stripMarkdown(descCell),
          categoryTitle: heading,
        })
        continue
      }
    }

    // 兜底：整行里含 GitHub 链接但不是标准 bullet/table 形态
    if (/github\.com/i.test(line) && !/^\s*>/.test(line)) {
      GITHUB_URL_RE.lastIndex = 0
      const urls = line.match(GITHUB_URL_RE)
      if (urls && urls.length > 0) {
        push(entries, seen, {
          repoUrl: urls[0],
          displayName: '',
          description: stripMarkdown(line.replace(GITHUB_URL_RE, '').replace(/^[\s\-*+|]+/, '').trim()),
          categoryTitle: heading,
        })
      }
    }
  }
  return entries
}

function push(entries, seen, entry) {
  const parsed = parseGithubUrl(entry.repoUrl)
  if (!parsed) return
  const key = `${parsed.owner}/${parsed.repo}#${parsed.subPath}`.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  entries.push({ ...entry, parsed })
}

/** 去掉 Markdown 记号，得到纯文本描述。 */
export function stripMarkdown(text) {
  return String(text ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|_)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * vbarter 注册表（vbarter/dsh-plugin-registry，站点 dshplugin.app）。
 *
 * 数据结构（schemaVersion 2）：
 *   plugins[]: { id, name, owner, url, description:{zh,en}, category, stars,
 *                pushedAt, source: "curated"|"discovered", install, topics, ... }
 *
 * 契约 §3 的两个 vbarter 信源正好对应这个 source 字段：
 *   vbarter-curated → source === "curated"    （人工策展子集）
 *   vbarter-full    → source === "discovered" （全量自动发现）
 * 二者互斥，同一插件不会被同一注册表算两票。
 *
 * 注意：这里的 id 是 `owner/repo#子路径` 记法，与契约的 `owner/repo#path:/子路径`
 * 不同。契约 id 一律从 url（GitHub tree 链接）推导，与 awesome 清单同源。
 */
export function parseVbarterRegistry(doc, filter = {}) {
  const categoryTitles = new Map()
  for (const [id, decl] of Object.entries(doc?.categories ?? {})) {
    categoryTitles.set(id, decl?.en ?? decl?.zh ?? id)
  }

  const entries = []
  const seen = new Set()
  for (const plugin of doc?.plugins ?? []) {
    if (filter.source && plugin?.source !== filter.source) continue
    const parsed = parseGithubUrl(plugin?.url ?? '')
    if (!parsed) continue
    const key = `${parsed.owner}/${parsed.repo}#${parsed.subPath}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const spec = extractInstallSpec(plugin?.install)
    entries.push({
      repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
      subPath: parsed.subPath,
      parsed: { ...parsed, subPath: parsed.subPath },
      displayName: plugin?.name ?? '',
      description: '',
      descEn: typeof plugin?.description?.en === 'string' ? plugin.description.en : '',
      descZh: typeof plugin?.description?.zh === 'string' ? plugin.description.zh : '',
      categoryTitle: categoryTitles.get(plugin?.category) ?? plugin?.category ?? '',
      npm: spec && isValidNpmName(spec) ? spec : '',
      versions: [],
      installSpec: spec,
      stars: Number(plugin?.stars ?? 0),
      pushedAt: plugin?.pushedAt ?? null,
    })
  }
  return entries
}

/** 从 `dsh plugin --profile web add <spec>` 里取出安装 spec。 */
export function extractInstallSpec(install) {
  const text = String(install ?? '').trim()
  if (!text) return ''
  const m = /\badd\s+"?([^"\s]+)"?/.exec(text)
  return m ? m[1] : ''
}

/** format-1 索引 → 条目列表。 */
export function parseMarketIndex(index) {
  const plugins = Array.isArray(index?.plugins) ? index.plugins : []
  const categoryTitles = new Map()
  for (const [id, decl] of Object.entries(index?.metadata?.categories ?? {})) {
    categoryTitles.set(id, localizedTitle(decl?.title))
  }

  const entries = []
  const seen = new Set()
  for (const plugin of plugins) {
    const repoUrl = plugin?.repository?.url ?? ''
    const parsed = parseGithubUrl(repoUrl)
    if (!parsed) continue
    const directory = typeof plugin?.repository?.directory === 'string' ? plugin.repository.directory : ''
    const subPath = directory ? directory.replace(/^\/+|\/+$/g, '') : parsed.subPath
    const key = `${parsed.owner}/${parsed.repo}#${subPath}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const versions = (plugin?.versions ?? [])
      .map((v) => ({
        ver: String(v?.version ?? ''),
        time: v?.publishTimestamp ? new Date(Number(v.publishTimestamp) * 1000).toISOString() : null,
      }))
      .filter((v) => v.ver !== '')

    entries.push({
      repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
      subPath,
      parsed: { ...parsed, subPath },
      displayName: localizedTitle(plugin?.title) || String(plugin?.name ?? ''),
      description: localizedText(plugin?.description),
      descEn: localizedStrict(plugin?.description, 'en'),
      descZh: localizedStrict(plugin?.description, 'zh'),
      categoryTitle: categoryTitles.get(plugin?.metadata?.category) ?? plugin?.metadata?.category ?? '',
      categoryKey: plugin?.metadata?.category ?? '',
      npm: typeof plugin?.name === 'string' ? plugin.name : '',
      versions,
      homepage: plugin?.homepage ?? '',
      engines: plugin?.versions?.[0]?.engines?.dsh ?? '',
    })
  }
  return entries
}

/** LocalizedText 可能是字符串，也可能是 { en, zh } 映射。 */
export function localizedTitle(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return value.en ?? value.zh ?? Object.values(value)[0] ?? ''
  return ''
}

export function localizedText(value, lang) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    if (lang) return value[lang] ?? value.en ?? ''
    return value.zh ?? value.en ?? ''
  }
  return ''
}

/**
 * 严格取某个语种：键不存在就返回空串，不回退到别的语种。
 * 用于「双语源覆盖」场景——中文源不该把英文简介顶掉。
 */
export function localizedStrict(value, lang) {
  if (typeof value === 'string') return lang === 'en' ? value : ''
  if (value && typeof value === 'object') {
    const text = value[lang]
    return typeof text === 'string' ? text : ''
  }
  return ''
}
