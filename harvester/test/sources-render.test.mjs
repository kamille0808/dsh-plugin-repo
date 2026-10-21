/**
 * 信源解析与 format-1 索引渲染的单测。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkdownList, parseMarketIndex, parseVbarterRegistry, extractInstallSpec, stripMarkdown } from '../src/sources.mjs'
import { renderMarketIndex } from '../src/render-index.mjs'
import { buildBrowseData } from '../src/render-page.mjs'
import { validateIndex } from '../src/run.mjs'
import { contractId } from '../src/normalize.mjs'

const AWESOME_SAMPLE = `
## Plugins

### UI Enhancements

- [owner/repo](https://github.com/owner/repo) - A nice plugin for DSH.
- [monorepo#pkg](https://github.com/owner/mono/tree/main/packages/pkg) - Monorepo sub package.

### Memory

- [mem/thing](https://github.com/mem/thing) - Memory plugin.
`

test('markdown 清单解析：分类 + 条目 + monorepo 子路径', () => {
  const entries = parseMarkdownList(AWESOME_SAMPLE)
  assert.equal(entries.length, 3)
  assert.equal(entries[0].parsed.owner, 'owner')
  assert.equal(entries[0].parsed.repo, 'repo')
  assert.equal(entries[0].categoryTitle, 'UI Enhancements')
  assert.equal(entries[0].description, 'A nice plugin for DSH.')
  assert.equal(entries[1].parsed.subPath, 'packages/pkg')
  assert.equal(entries[2].categoryTitle, 'Memory')
})

test('markdown 清单解析：表格行', () => {
  const table = `
## Tools

| Plugin | Description | Stars |
| --- | --- | --- |
| [a/b](https://github.com/a/b) | Table plugin | 12 |
`
  const entries = parseMarkdownList(table)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].parsed.owner, 'a')
  assert.equal(entries[0].description, 'Table plugin')
})

test('markdown 清单解析：非章节标题不进分类', () => {
  const entries = parseMarkdownList(AWESOME_SAMPLE)
  assert.ok(!entries.some((e) => e.categoryTitle === 'Plugins'))
})

test('stripMarkdown 去记号', () => {
  assert.equal(stripMarkdown('**bold** and `code` and [link](https://x)'), 'bold and code and link')
})

const MARKET_INDEX = {
  format: 1,
  title: { en: 'T', zh: 'T' },
  metadata: { categories: { ui: { title: { en: 'UI Enhancements', zh: 'UI 增强' } } } },
  plugins: [
    {
      name: '@scope/dsh-demo',
      title: 'Demo',
      description: { en: 'English desc', zh: '中文简介' },
      repository: { url: 'https://github.com/owner/demo' },
      metadata: { category: 'ui' },
      versions: [{ version: '1.0.0', publishTimestamp: 1767225600, source: { type: 'npm' }, engines: {} }],
    },
    {
      name: 'dsh-mono',
      repository: { url: 'https://github.com/owner/mono', directory: 'packages/pkg' },
      versions: [{ version: '2.0.0', publishTimestamp: 1767225600, source: { type: 'npm' }, engines: {} }],
    },
  ],
}

test('vbarter 注册表解析：curated / discovered 两种视图互斥', () => {
  const doc = {
    schemaVersion: 2,
    categories: { dev: { en: 'Development & Runtime', zh: '开发与运行时' } },
    plugins: [
      {
        id: 'strukto-ai/mirage#dsh',
        name: 'mirage#dsh',
        owner: 'strukto-ai',
        url: 'https://github.com/strukto-ai/mirage/tree/main/typescript/packages/dsh',
        description: { zh: '中文简介', en: 'English description' },
        category: 'dev',
        stars: 3433,
        pushedAt: '2026-08-15T09:27:31Z',
        source: 'curated',
        install: 'dsh plugin --profile web add @struktoai/mirage-dsh',
      },
      {
        id: 'liustack/modlens',
        name: 'modlens',
        owner: 'liustack',
        url: 'https://github.com/liustack/modlens',
        description: { zh: '另一个', en: 'Another' },
        category: 'dev',
        stars: 120,
        source: 'discovered',
        install: 'dsh plugin --profile web add github:liustack/modlens',
      },
    ],
  }

  const curated = parseVbarterRegistry(doc, { source: 'curated' })
  assert.equal(curated.length, 1)
  assert.equal(curated[0].parsed.owner, 'strukto-ai')
  assert.equal(curated[0].parsed.subPath, 'typescript/packages/dsh')
  // 契约 id 从 url 推导（vbarter 自己的 id 记法与契约不同）
  assert.equal(contractId(curated[0].parsed.owner, curated[0].parsed.repo, curated[0].parsed.subPath),
    'strukto-ai/mirage#path:/typescript/packages/dsh')
  assert.equal(curated[0].npm, '@struktoai/mirage-dsh')
  assert.equal(curated[0].descEn, 'English description')
  assert.equal(curated[0].descZh, '中文简介')
  assert.equal(curated[0].categoryTitle, 'Development & Runtime')
  assert.equal(curated[0].stars, 3433)

  const discovered = parseVbarterRegistry(doc, { source: 'discovered' })
  assert.equal(discovered.length, 1)
  assert.equal(discovered[0].npm, '', 'github: 形式的 spec 不是 npm 包名')
  assert.equal(discovered[0].parsed.subPath, '')

  // 两个视图互斥：同一插件不会被同一注册表算两票
  const ids = new Set([...curated, ...discovered].map((e) => e.parsed.owner))
  assert.equal(ids.size, 2)
})

test('vbarter 注册表解析：无 install 字段时降级为空 spec', () => {
  const doc = {
    plugins: [{
      id: 'x/y', name: 'y', url: 'https://github.com/x/y',
      description: {}, category: 'dev', source: 'discovered',
    }],
  }
  const entries = parseVbarterRegistry(doc, { source: 'discovered' })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].npm, '')
})

test('extractInstallSpec 从安装命令里取 spec', () => {
  assert.equal(extractInstallSpec('dsh plugin --profile web add @scope/pkg'), '@scope/pkg')
  assert.equal(extractInstallSpec('dsh plugin --profile web add github:o/r'), 'github:o/r')
  assert.equal(extractInstallSpec('dsh plugin --profile web add "github:o/r#path:/p"'), 'github:o/r#path:/p')
  assert.equal(extractInstallSpec(''), '')
})

test('format-1 索引解析：npm 名 / 仓库 / 版本时间', () => {
  const entries = parseMarketIndex(MARKET_INDEX)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].npm, '@scope/dsh-demo')
  assert.equal(entries[0].categoryTitle, 'UI Enhancements')
  assert.equal(entries[0].descEn, 'English desc')
  assert.equal(entries[0].versions[0].ver, '1.0.0')
  assert.equal(entries[0].versions[0].time, '2026-01-01T00:00:00.000Z')
  assert.equal(entries[1].parsed.subPath, 'packages/pkg')
})

const CATALOG = {
  plugins: [
    {
      id: 'owner/npm-backed',
      name: 'NPM Backed',
      npm: '@scope/dsh-npm',
      install_spec: '@scope/dsh-npm',
      github: 'https://github.com/owner/npm-backed',
      category_id: 'ui-enhancements',
      desc_zh: '中文',
      desc_en: 'English',
      stars: 12,
      last_push_at: '2026-10-01T00:00:00.000Z',
      npm_versions: [{ ver: '1.2.3', time: '2026-09-01T00:00:00.000Z' }],
      consensus_votes: 3,
      status: 'active',
      sources: ['awesome'],
    },
    {
      id: 'owner/git-only',
      name: 'Git Only',
      npm: '',
      install_spec: 'github:owner/git-only',
      github: 'https://github.com/owner/git-only',
      category_id: 'memory',
      desc_zh: '',
      desc_en: 'Only on GitHub',
      stars: 3,
      last_push_at: '2026-10-02T00:00:00.000Z',
      npm_versions: [],
      consensus_votes: 1,
      status: 'active',
      git_commit: 'abcdef1234567890abcdef1234567890abcdef12',
      sources: ['awesome'],
    },
    {
      id: 'owner/mono#path:/packages/x',
      name: 'Mono',
      npm: '',
      install_spec: 'github:owner/mono#path:/packages/x',
      github: 'https://github.com/owner/mono',
      category_id: '',
      desc_zh: '',
      desc_en: 'Monorepo package',
      stars: 0,
      last_push_at: null,
      npm_versions: [],
      consensus_votes: 0,
      status: 'active',
      git_commit: '',
      sources: ['awesome'],
    },
    {
      id: 'owner/gone',
      name: 'Gone',
      npm: 'dsh-gone',
      install_spec: 'dsh-gone',
      github: 'https://github.com/owner/gone',
      category_id: '',
      desc_zh: '',
      desc_en: '',
      stars: 0,
      last_push_at: null,
      npm_versions: [{ ver: '1.0.0', time: null }],
      consensus_votes: 0,
      status: 'gone',
      sources: ['awesome'],
    },
  ],
  categories: [
    { id: 'ui-enhancements', title_zh: 'UI 增强', title_en: 'UI Enhancements', builtin: true },
    { id: 'memory', title_zh: '记忆', title_en: 'Memory', builtin: true },
  ],
}

test('渲染的 index.json 通过官方 parseMarketIndex', () => {
  const index = renderMarketIndex(CATALOG)
  const parsed = validateIndex(index, 'https://example.com/index.json')
  assert.equal(parsed.plugins.length, 2, 'gone 的插件与无可安装版本的插件都不进索引')
  const names = parsed.plugins.map((p) => p.name)
  assert.ok(names.includes('@scope/dsh-npm'))
  assert.ok(names.includes('@owner/git-only'), '未发布 npm 的插件用合成名')
})

test('索引条目字段：category 必须在 metadata 中声明', () => {
  const index = renderMarketIndex(CATALOG)
  const parsed = validateIndex(index, 'https://example.com/index.json')
  const declared = new Set(Object.keys(parsed.metadata.categories))
  for (const plugin of parsed.plugins) {
    if (plugin.metadata.category) assert.ok(declared.has(plugin.metadata.category))
  }
  const mono = parsed.plugins.find((p) => p.name.startsWith('@owner/mono'))
  assert.equal(mono, undefined, '没有 npm 版本也没有 git_commit 的插件没有可安装版本，不进索引')
  assert.ok(!parsed.plugins.some((p) => p.metadata.category === undefined), '无分类的条目不带 category 键')
})

test('git 源条目带 40 位 commit', () => {
  const index = renderMarketIndex(CATALOG)
  const parsed = validateIndex(index, 'https://example.com/index.json')
  const gitOnly = parsed.plugins.find((p) => p.name === '@owner/git-only')
  assert.equal(gitOnly.versions.length, 1)
  assert.equal(gitOnly.versions[0].source.type, 'git')
  assert.match(gitOnly.versions[0].source.commit, /^[0-9a-f]{40}$/)
  assert.equal(gitOnly.versions[0].source.url, 'https://github.com/owner/git-only')
})

test('索引条目的中英简介分别落位（不互相顶掉）', () => {
  const catalog = {
    ...CATALOG,
    plugins: [{
      ...CATALOG.plugins[0],
      desc_en: 'English description',
      desc_zh: '中文简介',
    }],
  }
  const index = renderMarketIndex(catalog)
  const parsed = validateIndex(index, 'https://example.com/index.json')
  const entry = parsed.plugins.find((p) => p.name === '@scope/dsh-npm')
  assert.equal(entry.description.en, 'English description')
  assert.equal(entry.description.zh, '中文简介')
})

test('只有一种语言时，en 与 zh 用同一个值（format-1 要求含 en）', () => {
  const catalog = {
    ...CATALOG,
    plugins: [{ ...CATALOG.plugins[0], desc_en: 'Only English', desc_zh: '' }],
  }
  const index = renderMarketIndex(catalog)
  const parsed = validateIndex(index, 'https://example.com/index.json')
  const entry = parsed.plugins.find((p) => p.name === '@scope/dsh-npm')
  assert.equal(entry.description.en, 'Only English')
  assert.equal(entry.description.zh, 'Only English')
})

test('浏览页按上限截断但给出总数（不做无声截断）', () => {
  const many = {
    plugins: Array.from({ length: 30 }, (_, i) => ({
      id: `owner/p${String(i).padStart(2, '0')}`,
      name: `p${i}`, npm: '', install_spec: `github:owner/p${i}`,
      github: `https://github.com/owner/p${i}`, category_id: 'memory',
      desc_zh: '', desc_en: `desc ${i}`, license: '', stars: i,
      last_push_at: null, npm_versions: [], consensus_votes: i % 3,
      status: 'active', sources: ['awesome'],
    })),
    categories: [{ id: 'memory', title_zh: '记忆', title_en: 'Memory', builtin: true }],
  }
  const data = buildBrowseData(many, { limit: 10 })
  assert.equal(data.plugins.length, 10)
  assert.equal(data.total, 30)
  // 按共识票 → star 排序，前 10 条是票数最高的
  assert.equal(data.plugins[0].votes, 2)
})

test('浏览页数据只含公共字段', () => {
  const data = buildBrowseData(CATALOG)
  assert.equal(data.plugins.length, 3)
  const row = data.plugins[0]
  assert.deepEqual(Object.keys(row).sort(), [
    'category', 'categoryTitle', 'desc', 'github', 'id', 'install', 'lastPushAt',
    'name', 'npm', 'sources', 'stars', 'status', 'subPath', 'version', 'votes',
  ])
  assert.ok(!('ratings' in row))
})
