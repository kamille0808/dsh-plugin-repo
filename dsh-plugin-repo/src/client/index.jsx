/**
 * dsh-plugin-repo 客户端半边 —— 插件页「仓库」标签（V0 只读浏览）。
 *
 * 机制与官方 Discover 页同款（@deepseek-ai/dsh-client-ui-plugin-market）：
 * - Lazy-CJS bundle（lib/client.js），由宿主 client-modules 经 /plugins/<id>/client.js 提供；
 * - ctx.slots.inject('plugins.tab') 注册标签；
 * - 数据经 ctx.connection.rpc.call('/api', 'pluginRepo/<method>', {args}) 动态调用
 *   宿主 SRC fallback Remote（无需手写 contribution）；
 * - 状态用 createSnapshotStore 快照 store，控制器照搬官方 DiscoverController 形态。
 */
import { jsx, jsxs, Fragment } from 'react/jsx-runtime'
import React from 'react'
import {
  Button, Input, Pill, Tag, StateDot, PluginArtworkDefault,
  IconSearchOutlineRegular, IconRefreshOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'

/** 词典命名空间（与 locale.register 的 NS 一致）。 */
const NS = 'pluginRepo'

/** 客户端插件需要的服务：槽位、词典、连接（rpc 动态调用）。 */
const inject = ['slots', 'locale', 'connection']

const PAGE_SIZE = 24

const zh = {
  title: '仓库',
  searchPlaceholder: '搜索插件名称 / npm 包名 / 简介',
  allCategories: '全部分类',
  sortVotes: '共识票排序',
  sortStars: 'Star 排序',
  sortUpdated: '最近更新',
  loading: '正在读取仓库镜像',
  retry: '重试',
  refresh: '刷新',
  noMatches: '没有匹配的插件',
  showMore: '加载更多',
  votes: '票',
  detailBack: '返回列表',
  factPackage: 'npm 包',
  factCategory: '分类',
  factLicense: '许可证',
  factStars: 'GitHub Star',
  factUpdated: '镜像更新',
  factStatus: '状态',
  versionsTitle: '最近版本',
  ratingTitle: '人工评分',
  ratingNone: '暂无评分',
  ratingAverage: '{count} 人均分 {average}',
  eventsTitle: '最近事件',
  installTitle: '安装',
  installSpecLabel: '安装 spec',
  copySpec: '复制 spec',
  copied: '已复制',
  installHint: 'V0 不直接安装：复制 spec 后到「已安装」页走 plugin_manager 审批链安装',
  snapshotNote: '数据来自本地镜像快照（离线可读）',
  errorPrefix: '调用失败',
}

const en = {
  title: 'Repository',
  searchPlaceholder: 'Search plugin name / npm package / description',
  allCategories: 'All categories',
  sortVotes: 'Sort by consensus votes',
  sortStars: 'Sort by stars',
  sortUpdated: 'Recently updated',
  loading: 'Reading the local repository mirror',
  retry: 'Retry',
  refresh: 'Refresh',
  noMatches: 'No plugins match.',
  showMore: 'Show more',
  votes: 'votes',
  detailBack: 'Back to list',
  factPackage: 'npm package',
  factCategory: 'Category',
  factLicense: 'License',
  factStars: 'GitHub stars',
  factUpdated: 'Mirror updated',
  factStatus: 'Status',
  versionsTitle: 'Recent versions',
  ratingTitle: 'Ratings',
  ratingNone: 'No ratings yet',
  ratingAverage: '{count} raters, average {average}',
  eventsTitle: 'Recent events',
  installTitle: 'Install',
  installSpecLabel: 'Install spec',
  copySpec: 'Copy spec',
  copied: 'Copied',
  installHint: 'V0 does not install directly: copy the spec and install via the Installed tab (plugin_manager keeps its approval)',
  snapshotNote: 'Data comes from the local mirror snapshot (readable offline)',
  errorPrefix: 'Call failed',
}

const INITIAL = {
  status: 'idle', // idle | loading | error | ready
  error: null, // RemoteError 序列化 {code, message}
  query: { text: '', category: '', sort: 'votes' },
  categories: [], // [{id, titleZh, titleEn, builtin, plugins}]
  listing: null, // {total, offset, items, hasMore}
  detail: null, // entry() 结果（含 plugin/ratingSummary/recentEvents）
  detailStatus: 'idle', // idle | loading | error
}

/** 插件页「仓库」标签控制器：持有快照 store，经 connection rpc 读宿主镜像。 */
class RepoController {
  constructor(ctx) {
    this.ctx = ctx
    this.store = createSnapshotStore(INITIAL)
    this.disposed = false
    this.searchRead = 0
    this.failed = () => {}
  }

  dispose() {
    this.disposed = true
  }

  state() {
    return this.store.getSnapshot()
  }

  patch(next) {
    this.store.set({ ...this.state(), ...next })
  }

  /** 动态调用宿主 pluginRepo Remote；返回 RemoteResult（传输/业务失败均不 throw）。 */
  async call(method, args) {
    try {
      return await this.ctx.connection.rpc.call('/api', `pluginRepo/${method}`, { args })
    } catch (error) {
      return { ok: false, error: { code: 'transport', message: String(error?.message ?? error) } }
    }
  }

  /** 重新拉取分类与首屏列表（ensure/刷新/重置连接后的统一入口）。 */
  reload() {
    this.failed = () => this.reload()
    void this.loadCategories()
    void this.search(true)
  }

  face(resolveText) {
    return {
      hooks: { repo: this.store, locale: this.ctx.locale },
      resolveText,
      ensure: () => {
        if (this.state().status === 'idle') this.reload()
      },
      reload: () => this.reload(),
      retry: () => {
        this.failed()
      },
      refresh: () => {
        this.reload()
      },
      editQuery: (patch) => {
        const query = { ...this.state().query, ...patch }
        this.patch({ query })
      },
      submitSearch: () => {
        void this.search(true)
      },
      pickCategory: (id) => {
        this.patch({ query: { ...this.state().query, category: id } })
        void this.search(true)
      },
      pickSort: (sort) => {
        this.patch({ query: { ...this.state().query, sort } })
        void this.search(true)
      },
      more: () => {
        void this.search(false)
      },
      openEntry: (id) => {
        void this.loadEntry(id)
      },
      closeEntry: () => {
        if (!this.disposed) this.patch({ detail: null, detailStatus: 'idle' })
      },
    }
  }

  async loadCategories() {
    const answer = await this.call('categories', {})
    if (this.disposed || !answer.ok) return
    this.patch({ categories: answer.value.items ?? [] })
  }

  /** 首屏（replace=true）或加载下一页；读取序号防乱序覆盖。 */
  async search(replace) {
    const read = ++this.searchRead
    const state = this.state()
    if (replace || state.status === 'idle') this.patch({ status: 'loading' })
    const offset = replace ? 0 : state.listing ? state.listing.items.length : 0
    const { text, category, sort } = state.query
    const answer = await this.call('search', { text, category, sort, limit: PAGE_SIZE, offset })
    if (this.disposed || read !== this.searchRead) return
    if (!answer.ok) {
      this.failed = () => this.search(replace)
      this.patch({ status: 'error', error: answer.error, listing: replace ? null : state.listing })
      return
    }
    const value = answer.value
    const items = replace ? value.items : [...(state.listing?.items ?? []), ...value.items]
    this.patch({
      status: 'ready',
      error: null,
      listing: { total: value.total, offset: value.offset, items, hasMore: offset + value.items.length < value.total },
    })
  }

  async loadEntry(id) {
    this.patch({ detailStatus: 'loading', detail: null })
    const answer = await this.call('entry', { id })
    if (this.disposed) return
    if (!answer.ok || !answer.value?.found) {
      this.patch({ detailStatus: 'error' })
      return
    }
    this.patch({ detail: answer.value, detailStatus: 'ready' })
  }
}

// ---------------------------------------------------------------------------
// 样式（V0 内联，不引入 CSS 管线）
// ---------------------------------------------------------------------------
const sectionStyle = {
  display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', minHeight: 0, flex: 1,
}
const toolbarStyle = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
const categoriesStyle = { display: 'flex', gap: 6, flexWrap: 'wrap' }
const cardsStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, listStyle: 'none', margin: 0, padding: 0 }
const cardStyle = {
  display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 10,
  border: '1px solid var(--dsh-border, rgba(128,128,128,.25))', cursor: 'pointer', textAlign: 'left',
  background: 'transparent',
}
const cardTitleStyle = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }
const cardDescStyle = { opacity: 0.75, fontSize: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
const cardMetaStyle = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }
const mutedStyle = { opacity: 0.6, fontSize: 12 }
const detailStyle = { display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4 }
const detailHeadStyle = { display: 'flex', alignItems: 'center', gap: 8 }
const factsStyle = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 13 }
const specRowStyle = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
const codeStyle = {
  fontFamily: 'var(--dsh-mono, monospace)', fontSize: 12, padding: '6px 10px', borderRadius: 8,
  background: 'var(--dsh-sunken, rgba(128,128,128,.12))', wordBreak: 'break-all',
}
const eventListStyle = { display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }

function categoryTitle(c, language) {
  const zhActive = language === 'zh'
  return zhActive ? (c.titleZh || c.titleEn || c.id) : (c.titleEn || c.titleZh || c.id)
}

function formatWhen(text, t) {
  if (!text) return ''
  return text.replace('T', ' ').slice(0, 16)
}

/** 一张插件卡片。 */
function EntryCard({ item, categoryName, t, onOpen }) {
  return (
    <li>
      <button type="button" style={cardStyle} onClick={onOpen} aria-label={item.name}>
        <span style={cardTitleStyle}>
          <PluginArtworkDefault size={22} />
          {item.name}
        </span>
        <span style={cardDescStyle}>{item.desc || '—'}</span>
        <span style={cardMetaStyle}>
          {categoryName ? <Tag>{categoryName}</Tag> : null}
          <Tag>★ {item.stars}</Tag>
          <Tag>{item.consensusVotes} {t('votes')}</Tag>
          {item.status !== 'active' ? <Tag>{item.status}</Tag> : null}
        </span>
      </button>
    </li>
  )
}

/** 详情视图（V0 为页内替换视图，够用且避免抽屉焦点管理）。 */
function EntryDetail({ detail, categories, t, language, onBack }) {
  const p = detail.plugin
  const [copied, setCopied] = React.useState(false)
  const category = categories.find((c) => c.id === p.categoryId)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(detail.install.spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪贴板权限失败时静默：spec 文本本身可见可手选
    }
  }
  return (
    <div style={detailStyle} data-plugin-repo-detail={p.id}>
      <div style={detailHeadStyle}>
        <Button variant="ghost" size="sm" onClick={onBack}>{t('detailBack')}</Button>
        <PluginArtworkDefault size={26} />
        <strong style={{ fontSize: 15 }}>{p.name}</strong>
        {p.status !== 'active' ? <Tag>{p.status}</Tag> : null}
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{p.descZh || p.descEn || '—'}</p>
      {p.descZh && p.descEn ? <p style={{ ...mutedStyle, margin: 0 }}>{p.descEn}</p> : null}
      <div style={factsStyle}>
        <span style={mutedStyle}>{t('factPackage')}</span><code style={codeStyle}>{p.npm || '—'}</code>
        <span style={mutedStyle}>{t('factCategory')}</span><span>{category ? categoryTitle(category, language) : p.categoryId || '—'}</span>
        <span style={mutedStyle}>{t('factLicense')}</span><span>{p.license || '—'}</span>
        <span style={mutedStyle}>{t('factStars')}</span><span>★ {p.stars}</span>
        <span style={mutedStyle}>{t('factUpdated')}</span><span>{formatWhen(p.updatedAt)}</span>
      </div>
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('ratingTitle')}</div>
        {detail.ratingSummary
          ? <span>{t('ratingAverage')
            .replace('{count}', String(detail.ratingSummary.count))
            .replace('{average}', String(detail.ratingSummary.average))}</span>
          : <span style={mutedStyle}>{t('ratingNone')}</span>}
      </div>
      {Array.isArray(p.npmVersions) && p.npmVersions.length > 0 ? (
        <div>
          <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('versionsTitle')}</div>
          <div style={cardMetaStyle}>
            {p.npmVersions.slice(0, 6).map((v) => <Tag key={v.ver}>{v.ver}</Tag>)}
          </div>
        </div>
      ) : null}
      {Array.isArray(detail.recentEvents) && detail.recentEvents.length > 0 ? (
        <div>
          <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('eventsTitle')}</div>
          <ul style={eventListStyle}>
            {detail.recentEvents.map((e, i) => (
              <li key={i} style={cardMetaStyle}>
                <StateDot state="ongoing" />
                <span>{e.kind}</span>
                <span style={mutedStyle}>{formatWhen(e.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('installSpecLabel')}</div>
        <div style={specRowStyle}>
          <code style={codeStyle}>{detail.install.spec}</code>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? t('copied') : t('copySpec')}
          </Button>
        </div>
        <p style={mutedStyle}>{t('installHint')}</p>
      </div>
      <p style={mutedStyle}>{t('snapshotNote')}</p>
    </div>
  )
}

/** 「仓库」标签根组件：props 由槽位框架注入（t/hooks/动作）+ 插件页（install/openPackage）。 */
function RepoSection(props) {
  const { t } = props
  const state = props.useRepo((snapshot) => snapshot)
  const language = props.useLocale((snapshot) => snapshot.active)
  React.useEffect(() => {
    props.ensure()
  }, [props.ensure])

  const { query, categories, listing } = state
  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.id, categoryTitle(c, language)])),
    [categories, language],
  )
  const busy = state.status === 'loading'
  const sortLabels = { votes: t('sortVotes'), stars: t('sortStars'), updated: t('sortUpdated') }

  let body = null
  if (state.detailStatus === 'loading') {
    body = <p style={mutedStyle}>{t('loading')}</p>
  } else if (state.detail) {
    body = (
      <EntryDetail
        detail={state.detail}
        categories={categories}
        t={t}
        language={language}
        onBack={props.closeEntry}
      />
    )
  } else if (state.status === 'idle' || state.status === 'loading') {
    body = <p style={mutedStyle}>{t('loading')}</p>
  } else if (state.status === 'error') {
    body = (
      <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <StateDot state="error" />
        <span style={mutedStyle}>{t('errorPrefix')}: {state.error?.code ?? 'unknown'}</span>
        <Button variant="outline" size="sm" onClick={props.retry}>{t('retry')}</Button>
      </div>
    )
  } else if (!listing || listing.items.length === 0) {
    body = <p style={mutedStyle}>{t('noMatches')}</p>
  } else {
    body = (
      <Fragment>
        <ul style={cardsStyle} aria-busy={busy}>
          {listing.items.map((item) => (
            <EntryCard
              key={item.id}
              item={item}
              categoryName={categoryMap.get(item.categoryId) ?? ''}
              t={t}
              onOpen={() => props.openEntry(item.id)}
            />
          ))}
        </ul>
        {listing.hasMore ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={props.more}>{t('showMore')}</Button>
        ) : null}
      </Fragment>
    )
  }

  return (
    <div style={sectionStyle} data-plugin-tab="repo">
      <div style={toolbarStyle}>
        <Input
          type="search"
          icon={<IconSearchOutlineRegular size={14} />}
          value={query.text}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          style={{ flex: 1, minWidth: 220 }}
          onChange={(event) => props.editQuery({ text: event.target.value })}
          onBlur={props.submitSearch}
        />
        <select
          aria-label={sortLabels[query.sort]}
          value={query.sort}
          onChange={(event) => props.pickSort(event.target.value)}
          style={{ fontSize: 12 }}
        >
          {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('refresh')}
          disabled={busy}
          onClick={props.refresh}
          icon={busy ? <StateDot state="ongoing" /> : <IconRefreshOutlineRegular size={14} />}
        />
      </div>
      {categories.length === 0 ? null : (
        <div style={categoriesStyle} role="group">
          <Pill
            active={query.category === ''}
            aria-pressed={query.category === ''}
            onClick={() => props.pickCategory('')}
          >{t('allCategories')}</Pill>
          {categories.map((c) => (
            <Pill
              key={c.id}
              active={query.category === c.id}
              aria-pressed={query.category === c.id}
              onClick={() => props.pickCategory(c.id)}
            >{categoryTitle(c, language)} ({c.plugins})</Pill>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{body}</div>
    </div>
  )
}

/** 客户端入口：注册词典 + 控制器 + plugins.tab 槽位。 */
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-plugin-repo: dictionaries')
  const controller = new RepoController(ctx)
  ctx.effect(() => () => controller.dispose(), 'ui-plugin-repo: controller')
  ctx.effect(() => {
    const off = ctx.on('connection/reset', () => {
      // 连接重置后宿主可能换代：就绪态重新拉取，未渲染（idle）保持不动
      if (controller.state().status !== 'idle') controller.reload()
    })
    return off
  }, 'ui-plugin-repo: connection reset')
  const face = controller.face((text) => ctx.locale.resolveText(text))
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('plugins.tab', () => ctx.slots.register({
    name: 'plugins.tab',
    id: 'repo',
    label: () => t('title'),
    locale: NS,
    inject: () => face,
  }, RepoSection))
}

export { apply, inject }
