/**
 * 从 PG 渲染官方 format-1 索引 index.json（契约 §8）。
 *
 * 严格按 @deepseek-ai/dsh-plugin-market-index 的 parseMarketIndex 口径产出：
 * - plugins[].name 必须是合法 npm 包名（未发布 npm 的用 @owner/repo 合成名）
 * - versions[] 非空，每项含 version(精确 SemVer) / publishTimestamp / source
 * - metadata 里的 category id 必须在 metadata.categories 中声明
 *
 * 导出物卫生（契约 §4.5）：只含公共字段，不含 PG 内部字段、ratings、本地数据、
 * 凭据与本机路径。
 */
import { log } from './log.mjs'
import { isValidNpmName, isValidSemver, parseContractId, compareSemver } from './normalize.mjs'
import { syntheticNpmName, syntheticVersion } from './collect.mjs'

const MAX_PUBLISH_TIMESTAMP = 1e11

/**
 * format-1 的本地化文本：{ en, zh }。
 * 官方校验器要求必须含 en；只有一种语言时两个字段都用它。
 */
function localized(descEn, descZh) {
  const en = String(descEn ?? '').trim()
  const zh = String(descZh ?? '').trim()
  if (!en && !zh) return undefined
  return { en: en || zh, zh: zh || en }
}

/**
 * 渲染索引。
 * @param {object} catalog loadCatalog 的结果
 * @param {object} options { includeGit }
 */
export function renderMarketIndex(catalog, options = {}) {
  const includeGit = options.includeGit ?? true
  const declaredCategories = new Map()
  for (const category of catalog.categories) {
    declaredCategories.set(category.id, {
      title: { en: category.title_en || category.id, zh: category.title_zh || category.title_en || category.id },
    })
  }

  const plugins = []
  const skipped = { noName: 0, noVersion: 0, badVersion: 0, badTimestamp: 0, duplicate: 0 }
  const usedNames = new Set()

  for (const plugin of catalog.plugins) {
    if (plugin.status === 'gone') continue

    const parsedId = parseContractId(plugin.id)
    if (!parsedId) {
      skipped.noName += 1
      continue
    }

    const npmName = plugin.npm && isValidNpmName(plugin.npm) ? plugin.npm : null
    const synthetic = npmName ? null : syntheticNpmName(parsedId.owner, parsedId.repo, parsedId.subPath)
    const name = npmName ?? synthetic
    if (!name) {
      skipped.noName += 1
      continue
    }
    if (usedNames.has(name)) {
      // 同一 npm 名冲突：契约 §4 —— 以 GitHub 仓库为准，后一个换合成名
      const alt = synthetic && synthetic !== name ? synthetic : `${name}.${hashSuffix(plugin.id)}`
      if (!isValidNpmName(alt)) {
        skipped.duplicate += 1
        continue
      }
      if (usedNames.has(alt)) {
        skipped.duplicate += 1
        continue
      }
      usedNames.add(alt)
      const entry = buildEntry(plugin, alt, { npmBacked: false, declaredCategories })
      if (!entry) {
        skipped.noVersion += 1
        continue
      }
      plugins.push(entry)
      continue
    }
    usedNames.add(name)
    const entry = buildEntry(plugin, name, { npmBacked: Boolean(npmName), declaredCategories })
    if (!entry) {
      skipped.noVersion += 1
      continue
    }
    plugins.push(entry)
  }

  const index = {
    format: 1,
    title: {
      en: 'DSH Plugin Repository',
      zh: 'DSH 插件仓库',
    },
    description: {
      en: 'Community-curated DeepSeek Harness (DSH) plugin catalog, aggregated from public curated lists and published as a format-1 market index. Listing is not a security review.',
      zh: '来自社区人工策展清单汇总的 DeepSeek Harness（DSH）插件目录，以 format-1 市场索引发布。收录不代表安全审计结论。',
    },
    metadata: {
      categories: Object.fromEntries(declaredCategories),
      labels: {},
      sortKeys: {},
    },
    plugins,
  }

  log.info('format-1 索引已渲染', { plugins: plugins.length, skipped })
  return index
}

function hashSuffix(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(36).slice(0, 6)
}

function buildEntry(plugin, name, { npmBacked, declaredCategories }) {
  const versions = []

  // npm 源版本
  for (const v of plugin.npm_versions ?? []) {
    if (!v?.ver || !isValidSemver(v.ver)) continue
    const ts = v.time ? Math.floor(Date.parse(v.time) / 1000) : fallbackTimestamp(plugin)
    if (!Number.isInteger(ts) || ts < 0 || ts >= MAX_PUBLISH_TIMESTAMP) continue
    versions.push({
      version: v.ver,
      publishTimestamp: ts,
      source: { type: 'npm' },
      engines: {},
    })
  }

  // git 源版本：钉住默认分支 HEAD 提交
  if (!npmBacked && plugin.git_commit && /^[0-9a-f]{40}$/.test(plugin.git_commit)) {
    const ts = fallbackTimestamp(plugin)
    const subPath = plugin.id.includes('#path:/') ? plugin.id.split('#path:/')[1] : ''
    // format-1 的 directory 必须是相对 POSIX 目录，段内只允许字母数字与 ._@+-；
    // 路径不合规时不发这个版本——发出去会得到装错位置的安装目标
    if (!subPath || isFormat1Path(subPath)) {
      if (Number.isInteger(ts) && ts >= 0 && ts < MAX_PUBLISH_TIMESTAMP) {
        versions.push({
          version: syntheticVersion('head', plugin.git_commit),
          publishTimestamp: ts,
          source: {
            type: 'git',
            url: plugin.github,
            commit: plugin.git_commit,
            ...(subPath ? { path: subPath } : {}),
          },
          engines: {},
        })
      }
    }
  }

  versions.sort((a, b) => compareSemver(b.version, a.version))

  // format-1 要求 versions 非空：没有任何可安装版本的插件不进索引
  if (versions.length === 0) return null

  // category 必须在 metadata.categories 中声明；没有就整个键不出现
  // （官方校验器按「键是否存在」判定，值为 undefined 也会被拒）
  const metadata = { keywords: [], labels: [], sortKeys: {} }
  if (plugin.category_id && declaredCategories.has(plugin.category_id)) {
    metadata.category = plugin.category_id
  }

  const description = localized(plugin.desc_en, plugin.desc_zh)

  return {
    name,
    title: plugin.name || name,
    ...(description ? { description } : {}),
    repository: { url: plugin.github },
    metadata,
    versions,
  }
}

const PATH_SEGMENT = /^[A-Za-z0-9._@+-]+$/

/** format-1 的 directory 口径：相对 POSIX 目录，段内不含 . 或 .. */
export function isFormat1Path(path) {
  const text = String(path ?? '')
  if (!text) return false
  return !text.split('/').some((segment) => segment === '.' || segment === '..' || !PATH_SEGMENT.test(segment))
}

function fallbackTimestamp(plugin) {  const base = plugin.last_push_at ?? plugin.updated_at
  if (!base) return 0
  const ts = Math.floor(new Date(base).getTime() / 1000)
  return Number.isFinite(ts) ? ts : 0
}

function compareVersionsDesc(a, b) {
  return compareSemver(b, a)
}
