/**
 * dsh-plugin-repo 客户端半边 —— 插件页「仓库」标签。
 *
 * V0 只读浏览 / V1 评分与事件 / V2 已安装管理增强 + 分类与 labels 管理。
 *
 * 机制与官方 Discover 页同款（@deepseek-ai/dsh-client-ui-plugin-market）：
 * - Lazy-CJS bundle（lib/client.js），由宿主 client-modules 经 /plugins/<id>/client.js 提供；
 * - ctx.slots.inject('plugins.tab') 注册标签；
 * - 数据经 ctx.connection.rpc.call('/api', '<namespace>/<method>', {args}) 动态调用：
 *   pluginRepo/*（本插件宿主 SRC fallback Remote）与 pluginManager/*（官方现成命名空间）；
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

/** 客户端插件需要的服务：槽位、词典、连接（rpc 动态调用）、remote（订阅官方变更事件）。 */
const inject = ['slots', 'locale', 'connection', 'remote']

const PAGE_SIZE = 24

const zh = {
  title: '仓库',
  viewBrowse: '浏览仓库',
  viewInstalled: '已安装',
  viewCategories: '分类管理',
  searchPlaceholder: '搜索插件名称 / npm 包名 / 简介',
  allCategories: '全部分类',
  sortVotes: '共识票排序',
  sortStars: 'Star 排序',
  sortUpdated: '最近更新',
  sortScore: '客观分排序',
  scoreShort: '分',
  objectiveScoreTitle: '客观分',
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
  ratingNotAudit: '自动计算，非安全审计结论',
  myRatingTitle: '我的评分',
  notePlaceholder: '短评（≤500 字，可选）',
  save: '保存',
  saving: '保存中…',
  savedLocal: '已存本地，待同步',
  unrateBtn: '删除我的评分',
  rateHint: '未配置 scoredBy：请到本插件的配置里填写本机评分标识（<host>-<user>）',
  rateInvalidScore: '分数须为 1-5 星',
  rateNotFound: '插件不在本地镜像中',
  rateFailed: '操作失败，请重试',
  eventsTitle: '最近事件',
  eventsEmpty: '暂无动态',
  installTitle: '安装',
  installSpecLabel: '安装 spec',
  copySpec: '复制 spec',
  copied: '已复制',
  installNow: '安装',
  installing: '安装中…',
  installApplied: '已安装并启用',
  installRestart: '已安装，重启后生效',
  installFailed: '安装失败',
  installHint: '安装动作经 pluginManager 执行，保留其审批与回滚；失败可改用复制的 spec 到「已安装」页操作',
  snapshotNote: '数据来自本地镜像快照（离线可读）',
  errorPrefix: '调用失败',
  labelsTitle: '标签',
  labelsPlaceholder: '回车添加标签（≤8 个）',
  localCategoryTitle: '本地分类',
  followCentral: '跟随中心库',
  installedEmpty: '本 profile 没有已安装的外部 bundle',
  installedLoading: '正在读取已安装列表',
  notInRepo: '不在仓库镜像',
  enabledTag: '已启用',
  disabledTag: '已停用',
  enableBtn: '启用',
  disableBtn: '停用',
  removeBtn: '移除',
  removeConfirm: '确认移除该 bundle？移除会卸载其全部插件行',
  officialTag: '官方',
  viewInRepo: '仓库详情',
  catBuiltin: '内置分类（只读）',
  catLocal: '本地分类',
  catAddPlaceholderZh: '新分类中文名',
  catAddPlaceholderEn: '英文名（可选）',
  catAddBtn: '新增分类',
  catDelete: '删除',
  catDeleteConfirm: '删除该本地分类？其中插件将回退到中心库分类',
  catEmpty: '暂无本地分类',
  catMembers: '该分类下的插件',
  catMembersEmpty: '该分类下暂无插件',
  catMoveOut: '移出',
  catInvalidTitle: '中文名必填且 ≤30 字',
  pmUnavailable: 'pluginManager 服务不可用（当前 profile 不支持插件管理）',
  pmActionFailed: '操作失败',
}

const en = {
  title: 'Repository',
  viewBrowse: 'Browse',
  viewInstalled: 'Installed',
  viewCategories: 'Categories',
  searchPlaceholder: 'Search plugin name / npm package / description',
  allCategories: 'All categories',
  sortVotes: 'Sort by consensus votes',
  sortStars: 'Sort by stars',
  sortUpdated: 'Recently updated',
  sortScore: 'Sort by objective score',
  scoreShort: 'score',
  objectiveScoreTitle: 'Objective score',
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
  ratingNotAudit: 'Auto-computed; not a security audit',
  myRatingTitle: 'My rating',
  notePlaceholder: 'Short note (≤500 chars, optional)',
  save: 'Save',
  saving: 'Saving…',
  savedLocal: 'Saved locally, pending sync',
  unrateBtn: 'Delete my rating',
  rateHint: 'scoredBy is not configured: set your host rating identity (<host>-<user>) in this plugin\'s config',
  rateInvalidScore: 'Score must be 1-5 stars',
  rateNotFound: 'Plugin not in the local mirror',
  rateFailed: 'Operation failed, please retry',
  eventsTitle: 'Recent events',
  eventsEmpty: 'No recent events',
  installTitle: 'Install',
  installSpecLabel: 'Install spec',
  copySpec: 'Copy spec',
  copied: 'Copied',
  installNow: 'Install',
  installing: 'Installing…',
  installApplied: 'Installed and enabled',
  installRestart: 'Installed; takes effect after restart',
  installFailed: 'Installation failed',
  installHint: 'Installation runs through pluginManager with its approval and rollback; on failure, copy the spec and use the Installed page',
  snapshotNote: 'Data comes from the local mirror snapshot (readable offline)',
  errorPrefix: 'Call failed',
  labelsTitle: 'Labels',
  labelsPlaceholder: 'Press Enter to add a label (max 8)',
  localCategoryTitle: 'Local category',
  followCentral: 'Follow central catalog',
  installedEmpty: 'No external bundles installed in this profile',
  installedLoading: 'Reading installed bundles',
  notInRepo: 'Not in repository mirror',
  enabledTag: 'Enabled',
  disabledTag: 'Disabled',
  enableBtn: 'Enable',
  disableBtn: 'Disable',
  removeBtn: 'Remove',
  removeConfirm: 'Remove this bundle? All its plugin rows will be unloaded',
  officialTag: 'Official',
  viewInRepo: 'Open in repository',
  catBuiltin: 'Built-in categories (read-only)',
  catLocal: 'Local categories',
  catAddPlaceholderZh: 'New category name (zh)',
  catAddPlaceholderEn: 'English name (optional)',
  catAddBtn: 'Add category',
  catDelete: 'Delete',
  catDeleteConfirm: 'Delete this local category? Its plugins fall back to the central category',
  catEmpty: 'No local categories yet',
  catMembers: 'Plugins in this category',
  catMembersEmpty: 'No plugins in this category',
  catMoveOut: 'Move out',
  catInvalidTitle: 'Chinese name required, ≤30 chars',
  pmUnavailable: 'pluginManager service unavailable (this profile cannot manage plugins)',
  pmActionFailed: 'Action failed',
}

const INITIAL = {
  status: 'idle', // idle | loading | error | ready
  error: null, // RemoteError 序列化 {code, message}
  query: { text: '', category: '', sort: 'votes' },
  categories: [], // [{id, titleZh, titleEn, builtin, plugins}]
  listing: null, // {total, offset, items, hasMore}
  detail: null, // entry() 结果（含 plugin/objectiveScore/ratingSummary/myRating/recentEvents）
  detailStatus: 'idle', // idle | loading | error
  rateError: null, // rate/unrate 失败的 {code, message}（null = 无）
  rateBusy: false,
  // ---- V2 ----
  view: 'browse', // browse | installed | categories
  bundles: null, // installed() 合并读结果 items
  bundlesStatus: 'idle', // idle | loading | ready | error
  bundlesError: null,
  pmBusy: '', // 进行中的 bundle 名（按钮禁用）
  pmResult: null, // {action, application|code, diagnostic?, target} 操作结果条
  newCatZh: '',
  newCatEn: '',
  catBusy: false,
  catError: null,
  catMembers: null, // {categoryId, items}
  labelDraft: '',
}

/** 插件页「仓库」标签控制器：持有快照 store，经 connection rpc 读宿主镜像与 pluginManager。 */
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

  /** 动态调用官方 pluginManager Remote（安装/启停/删除走它，保留官方审批链）。 */
  async callPm(method, args) {
    try {
      return await this.ctx.connection.rpc.call('/api', `pluginManager/${method}`, { args })
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
        this.patch({ rateError: null })
        void this.loadEntry(id)
      },
      closeEntry: () => {
        if (!this.disposed) this.patch({ detail: null, detailStatus: 'idle', rateError: null })
      },
      submitRating: (id, score, note) => {
        void this.saveRating(id, score, note)
      },
      removeRating: (id) => {
        void this.deleteRating(id)
      },
      // ---- V2 动作 ----
      setView: (view) => {
        this.patch({ view })
        if (view === 'installed' && this.state().bundlesStatus === 'idle') void this.loadBundles()
        if (view === 'categories') void this.loadCategories()
      },
      refreshBundles: () => void this.loadBundles(),
      toggleBundle: (name, enabled) => void this.toggleBundle(name, enabled),
      removeBundle: (name) => void this.removeBundle(name),
      installSpec: (spec) => void this.installSpec(spec),
      openEntryByRepoId: (id) => {
        this.patch({ view: 'browse' })
        void this.loadEntry(id)
      },
      editNewCategory: (patch) => this.patch(patch),
      addCategory: () => void this.addCategory(),
      removeCategory: (id) => void this.removeCategory(id),
      openCategoryMembers: (id) => void this.openCategoryMembers(id),
      moveOutOfCategory: (id) => void this.moveOutOfCategory(id),
      editLabelDraft: (labelDraft) => this.patch({ labelDraft }),
      addLabel: (id, label) => void this.addLabel(id, label),
      removeLabel: (id, label) => void this.removeLabel(id, label),
      setLocalCategory: (id, categoryId) => void this.setLocalCategory(id, categoryId),
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

  /** 保存评分：按返回 code 映射引导文案，成功后重拉详情（含 synced 徽标）。 */
  async saveRating(id, score, note) {
    this.patch({ rateBusy: true, rateError: null })
    const answer = await this.call('rate', { id, score, note })
    if (this.disposed) return
    this.patch({ rateBusy: false })
    if (!answer.ok) {
      this.patch({ rateError: answer.error })
      return
    }
    if (!answer.value.ok) {
      this.patch({ rateError: answer.value.error })
      return
    }
    await this.loadEntry(id)
  }

  /** 删除本人评分；成功后重拉详情。 */
  async deleteRating(id) {
    this.patch({ rateBusy: true, rateError: null })
    const answer = await this.call('unrate', { id })
    if (this.disposed) return
    this.patch({ rateBusy: false })
    if (!answer.ok) {
      this.patch({ rateError: answer.error })
      return
    }
    if (!answer.value.ok) {
      this.patch({ rateError: answer.value.error })
      return
    }
    await this.loadEntry(id)
  }

  async loadEntry(id) {
    this.patch({ detailStatus: 'loading', detail: null })
    const answer = await this.call('entry', { id })
    if (this.disposed) return
    if (!answer.ok || !answer.value?.found) {
      this.patch({ detailStatus: 'error' })
      return
    }
    this.patch({ detail: answer.value, detailStatus: 'ready', labelDraft: '' })
  }

  // ---------------------------------------------------------------------------
  // V2：已安装管理（读走本插件 installed 合并读；写动作直调官方 pluginManager）
  // ---------------------------------------------------------------------------

  async loadBundles() {
    this.patch({ bundlesStatus: 'loading' })
    const answer = await this.call('installed', {})
    if (this.disposed) return
    if (!answer.ok || !answer.value?.ok) {
      this.patch({ bundlesStatus: 'error', bundlesError: answer.ok ? answer.value?.error : answer.error })
      return
    }
    this.patch({ bundlesStatus: 'ready', bundles: answer.value.items ?? [], bundlesError: null })
  }

  /** 启停/删除/安装动作统一出口：记录结果条并重拉已安装列表。 */
  async pmAction(action, name, answerPromise) {
    this.patch({ pmBusy: name, pmResult: null })
    const answer = await answerPromise
    if (this.disposed) return
    this.patch({ pmBusy: '' })
    if (!answer.ok) {
      this.patch({ pmResult: { action, application: 'failed', diagnostic: answer.error?.message ?? answer.error?.code ?? '', target: name } })
      return
    }
    const v = answer.value ?? {}
    this.patch({
      pmResult: {
        action,
        application: v.application ?? (v.error ? 'failed' : 'applied'),
        diagnostic: v.error?.diagnostic ?? v.error?.code ?? '',
        target: v.target ?? name,
      },
    })
    await this.loadBundles()
  }

  toggleBundle(name, enabled) {
    return this.pmAction(enabled ? 'enable' : 'disable', name, this.callPm('setBundleEnabled', { name, enabled }))
  }

  removeBundle(name) {
    return this.pmAction('remove', name, this.callPm('removeBundle', { name }))
  }

  /** 详情页直接安装：requestId 追踪，installBundle 结算后展示 application 状态。 */
  installSpec(spec) {
    const requestId = `repo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return this.pmAction('install', spec, this.callPm('installBundle', { spec, options: { requestId } }))
  }

  // ---------------------------------------------------------------------------
  // V2：分类与 labels（本地私有，宿主只写本机域）
  // ---------------------------------------------------------------------------

  async addCategory() {
    const { newCatZh, newCatEn } = this.state()
    if (!newCatZh.trim()) {
      this.patch({ catError: { code: 'plugin-repo/invalid-category-title' } })
      return
    }
    this.patch({ catBusy: true, catError: null })
    const answer = await this.call('addCategory', { titleZh: newCatZh.trim(), titleEn: newCatEn.trim() })
    if (this.disposed) return
    this.patch({ catBusy: false })
    if (!answer.ok || !answer.value?.ok) {
      this.patch({ catError: answer.ok ? answer.value?.error : answer.error })
      return
    }
    this.patch({ newCatZh: '', newCatEn: '' })
    await this.loadCategories()
  }

  async removeCategory(id) {
    this.patch({ catBusy: true, catError: null })
    const answer = await this.call('removeCategory', { id })
    if (this.disposed) return
    this.patch({ catBusy: false })
    if (!answer.ok || !answer.value?.ok) {
      this.patch({ catError: answer.ok ? answer.value?.error : answer.error })
      return
    }
    if (this.state().catMembers?.categoryId === id) this.patch({ catMembers: null })
    await this.loadCategories()
  }

  /** 分类管理视图：列出某本地分类下的插件（复用 search 的分类过滤）。 */
  async openCategoryMembers(categoryId) {
    const answer = await this.call('search', { text: '', category: categoryId, sort: 'votes', limit: 100, offset: 0 })
    if (this.disposed) return
    if (!answer.ok) return
    this.patch({ catMembers: { categoryId, items: answer.value.items ?? [] } })
  }

  async moveOutOfCategory(id) {
    const answer = await this.call('setLocalCategory', { id, categoryId: '' })
    if (this.disposed || !answer.ok) return
    const members = this.state().catMembers
    if (members) await this.openCategoryMembers(members.categoryId)
  }

  /** 详情页 labels 编辑：在现有基础上增删后整体提交。 */
  async addLabel(id, label) {
    const current = this.state().detail?.plugin?.labels ?? []
    const next = [...new Set([...current, label.trim()])].filter(Boolean)
    if (next.length === current.length) return
    const answer = await this.call('setLabels', { id, labels: next })
    if (this.disposed || !answer.ok) return
    this.patch({ labelDraft: '' })
    await this.loadEntry(id)
  }

  async removeLabel(id, label) {
    const current = this.state().detail?.plugin?.labels ?? []
    const answer = await this.call('setLabels', { id, labels: current.filter((l) => l !== label) })
    if (this.disposed || !answer.ok) return
    await this.loadEntry(id)
  }

  async setLocalCategory(id, categoryId) {
    const answer = await this.call('setLocalCategory', { id, categoryId })
    if (this.disposed || !answer.ok) return
    await this.loadEntry(id)
    await this.loadCategories()
  }
}

// ---------------------------------------------------------------------------
// 样式（内联，不引入 CSS 管线）
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
const scoreBarOuterStyle = {
  height: 8, borderRadius: 4, flex: 1, minWidth: 80, overflow: 'hidden',
  background: 'var(--dsh-sunken, rgba(128,128,128,.12))',
}
const scoreBarInnerStyle = { height: '100%', borderRadius: 4, background: 'var(--dsh-accent, rgba(64,128,255,.8))' }
const starStyle = (active) => ({
  border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px',
  fontSize: 18, lineHeight: 1, color: active ? '#f5a623' : 'var(--dsh-muted, rgba(128,128,128,.55))',
})
const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--dsh-border, rgba(128,128,128,.25))',
}
const resultBarStyle = (failed) => ({
  fontSize: 12, padding: '6px 10px', borderRadius: 8,
  background: failed ? 'var(--dsh-danger-bg, rgba(192,57,43,.12))' : 'var(--dsh-sunken, rgba(128,128,128,.12))',
})

/** 更新事件 kind → 图标（契约 §6 名录；未知 kind 用通用圆点）。 */
const EVENT_ICONS = {
  'new-plugin': '🆕',
  'update-available': '⬆️',
  'renamed': '✏️',
  'archived': '📦',
  'removed-from-list': '🚫',
}

function categoryTitle(c, language) {
  const zhActive = language === 'zh'
  return zhActive ? (c.titleZh || c.titleEn || c.id) : (c.titleEn || c.titleZh || c.id)
}

function formatWhen(text) {
  if (!text) return ''
  return text.replace('T', ' ').slice(0, 16)
}

/** rate/unrate 失败 code → 引导文案键（RLS 拒绝 = scoredBy 未配置 → 引导去插件配置）。 */
const RATE_ERROR_KEYS = {
  'plugin-repo/scored-by-required': 'rateHint',
  'plugin-repo/invalid-score': 'rateInvalidScore',
  'plugin-repo/not-found': 'rateNotFound',
}

/** 五星输入：hover 预览、点击选定（不引第三方组件）。 */
function StarInput({ value, onChange, disabled, t }) {
  const [hover, setHover] = React.useState(0)
  const shown = hover || value
  return (
    <span role="radiogroup" aria-label={t('myRatingTitle')} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          style={starStyle(n <= shown)}
          disabled={disabled}
          role="radio"
          aria-label={String(n)}
          aria-checked={value === n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
        >{n <= shown ? '★' : '☆'}</button>
      ))}
    </span>
  )
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
          <Tag title={t('ratingNotAudit')}>{t('scoreShort')} {item.objectiveScore}</Tag>
          <Tag>★ {item.stars}</Tag>
          <Tag>{item.consensusVotes} {t('votes')}</Tag>
          {item.status !== 'active' ? <Tag>{item.status}</Tag> : null}
          {(item.labels ?? []).slice(0, 3).map((l) => <Tag key={l}>{l}</Tag>)}
        </span>
      </button>
    </li>
  )
}

/** 详情视图（页内替换视图，够用且避免抽屉焦点管理）。 */
function EntryDetail({ detail, categories, t, language, onBack, onRate, onUnrate, rateError, rateBusy, onInstall, onAddLabel, onRemoveLabel, onSetLocalCategory, labelDraft, onEditLabelDraft, pmBusy }) {
  const p = detail.plugin
  const my = detail.myRating
  const [copied, setCopied] = React.useState(false)
  // 评分输入本地态；详情重拉（保存/删除后）同步回填
  const [score, setScore] = React.useState(my?.score ?? 0)
  const [note, setNote] = React.useState(my?.note ?? '')
  React.useEffect(() => {
    setScore(detail.myRating?.score ?? 0)
    setNote(detail.myRating?.note ?? '')
  }, [detail.myRating?.score, detail.myRating?.note])
  const category = categories.find((c) => c.id === (p.localCategoryId || p.categoryId))
  const localCategories = categories.filter((c) => !c.builtin)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(detail.install.spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪贴板权限失败时静默：spec 文本本身可见可手选
    }
  }
  const scoreTotal = detail.objectiveScore?.total ?? 0
  const rateErrorText = rateError ? t(RATE_ERROR_KEYS[rateError.code] ?? 'rateFailed') : null
  const labels = p.labels ?? []
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
        <span style={mutedStyle}>{t('factCategory')}</span><span>{category ? categoryTitle(category, language) : (p.localCategoryId || p.categoryId) || '—'}</span>
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
        <span style={mutedStyle}> · {t('ratingNotAudit')}</span>
      </div>
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('objectiveScoreTitle')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong style={{ fontSize: 18, minWidth: 28, textAlign: 'right' }}>{scoreTotal}</strong>
          <div style={scoreBarOuterStyle}>
            <div style={{ ...scoreBarInnerStyle, width: `${Math.max(0, Math.min(100, scoreTotal))}%` }} />
          </div>
        </div>
        <p style={{ ...mutedStyle, margin: '4px 0 0' }}>{t('ratingNotAudit')}</p>
      </div>
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('myRatingTitle')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StarInput value={score} onChange={setScore} disabled={rateBusy} t={t} />
            {my && !my.synced ? <Tag>{t('savedLocal')}</Tag> : null}
          </div>
          <Input
            value={note}
            placeholder={t('notePlaceholder')}
            aria-label={t('notePlaceholder')}
            maxLength={500}
            disabled={rateBusy}
            onChange={(event) => setNote(event.target.value)}
            style={{ maxWidth: 420 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={rateBusy || score < 1}
              onClick={() => onRate(p.id, score, note)}
            >{rateBusy ? t('saving') : t('save')}</Button>
            {my ? (
              <Button variant="ghost" size="sm" disabled={rateBusy} onClick={() => onUnrate(p.id)}>
                {t('unrateBtn')}
              </Button>
            ) : null}
            {rateErrorText ? <span role="alert" style={{ ...mutedStyle, color: 'var(--dsh-danger, #c0392b)' }}>{rateErrorText}</span> : null}
          </div>
        </div>
      </div>
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('labelsTitle')}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {labels.map((l) => (
            <Tag key={l}>
              {l}
              <button
                type="button"
                aria-label={`remove ${l}`}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 11 }}
                onClick={() => onRemoveLabel(p.id, l)}
              >×</button>
            </Tag>
          ))}
          <Input
            value={labelDraft}
            placeholder={t('labelsPlaceholder')}
            aria-label={t('labelsPlaceholder')}
            onChange={(event) => onEditLabelDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && labelDraft.trim()) onAddLabel(p.id, labelDraft)
            }}
            style={{ maxWidth: 200 }}
          />
        </div>
      </div>
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('localCategoryTitle')}</div>
        <select
          aria-label={t('localCategoryTitle')}
          value={p.localCategoryId ?? ''}
          onChange={(event) => onSetLocalCategory(p.id, event.target.value)}
          style={{ fontSize: 12 }}
        >
          <option value="">{t('followCentral')}</option>
          {localCategories.map((c) => <option key={c.id} value={c.id}>{categoryTitle(c, language)}</option>)}
        </select>
      </div>
      {Array.isArray(p.npmVersions) && p.npmVersions.length > 0 ? (
        <div>
          <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('versionsTitle')}</div>
          <div style={cardMetaStyle}>
            {p.npmVersions.slice(0, 6).map((v) => <Tag key={v.ver}>{v.ver}</Tag>)}
          </div>
        </div>
      ) : null}
      {Array.isArray(detail.recentEvents) ? (
        <div>
          <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('eventsTitle')}</div>
          {detail.recentEvents.length === 0 ? (
            <span style={mutedStyle}>{t('eventsEmpty')}</span>
          ) : (
            <ul style={eventListStyle}>
              {detail.recentEvents.map((e, i) => (
                <li key={i} style={cardMetaStyle}>
                  <span aria-hidden="true">{EVENT_ICONS[e.kind] ?? '•'}</span>
                  <span>{e.kind}</span>
                  <span style={mutedStyle}>{formatWhen(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('installSpecLabel')}</div>
        <div style={specRowStyle}>
          <code style={codeStyle}>{detail.install.spec}</code>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? t('copied') : t('copySpec')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pmBusy !== ''}
            onClick={() => onInstall(detail.install.spec)}
          >{pmBusy ? t('installing') : t('installNow')}</Button>
        </div>
        <p style={mutedStyle}>{t('installHint')}</p>
      </div>
      <p style={mutedStyle}>{t('snapshotNote')}</p>
    </div>
  )
}

/** 已安装子视图：pluginManager listBundles 与本仓库镜像的合并读 + 启停/移除动作。 */
function InstalledView({ state, t, language, onRefresh, onToggle, onRemove, onOpenEntry, categories }) {
  const categoryMap = new Map(categories.map((c) => [c.id, categoryTitle(c, language)]))
  if (state.bundlesStatus === 'loading' || state.bundlesStatus === 'idle') {
    return <p style={mutedStyle}>{t('installedLoading')}</p>
  }
  if (state.bundlesStatus === 'error') {
    return (
      <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <StateDot state="error" />
        <span style={mutedStyle}>{t('errorPrefix')}: {state.bundlesError?.code ?? 'unknown'}</span>
        <Button variant="outline" size="sm" onClick={onRefresh}>{t('retry')}</Button>
      </div>
    )
  }
  const items = (state.bundles ?? []).filter((b) => b.installed)
  if (items.length === 0) return <p style={mutedStyle}>{t('installedEmpty')}</p>
  return (
    <ul style={{ ...cardsStyle, gridTemplateColumns: '1fr' }}>
      {items.map((b) => (
        <li key={b.name} style={rowStyle}>
          <PluginArtworkDefault size={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{b.metaTitle || b.name}</strong>
              <span style={mutedStyle}>{b.name}{b.version ? `@${b.version}` : ''}</span>
              {b.official ? <Tag>{t('officialTag')}</Tag> : null}
              {b.enabled ? <Tag>{t('enabledTag')}</Tag> : <Tag>{t('disabledTag')}</Tag>}
              {b.error ? <Tag title={b.error.diagnostic}>⚠ {b.error.code}</Tag> : null}
            </div>
            <div style={{ ...mutedStyle, marginTop: 4 }}>
              {b.inRepo
                ? `${b.repoDesc || ''} · ${categoryMap.get(b.repoCategoryId) ?? ''} · ${t('scoreShort')} ${b.objectiveScore} · ${b.consensusVotes} ${t('votes')}`
                : t('notInRepo')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {b.inRepo ? (
              <Button variant="ghost" size="sm" onClick={() => onOpenEntry(b.repoId)}>{t('viewInRepo')}</Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={state.pmBusy !== '' || Boolean(b.readOnlyReason)}
              onClick={() => onToggle(b.name, !b.enabled)}
            >{b.enabled ? t('disableBtn') : t('enableBtn')}</Button>
            {b.removable ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={state.pmBusy !== ''}
                onClick={() => {
                  if (window.confirm(t('removeConfirm'))) onRemove(b.name)
                }}
              >{t('removeBtn')}</Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 分类管理子视图：内置只读 + 本地增删 + 分类成员移出。 */
function CategoriesView({ state, t, language, onEditNew, onAdd, onRemove, onOpenMembers, onMoveOut, onOpenEntry }) {
  const builtin = state.categories.filter((c) => c.builtin)
  const local = state.categories.filter((c) => !c.builtin)
  const members = state.catMembers
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('catLocal')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {local.length === 0 ? <span style={mutedStyle}>{t('catEmpty')}</span> : null}
          {local.map((c) => (
            <Tag key={c.id}>
              <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                onClick={() => onOpenMembers(c.id)}>{categoryTitle(c, language)} ({c.plugins})</button>
              <button
                type="button"
                aria-label={`delete ${c.id}`}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 11 }}
                onClick={() => {
                  if (window.confirm(t('catDeleteConfirm'))) onRemove(c.id)
                }}
              >×</button>
            </Tag>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <Input
            value={state.newCatZh}
            placeholder={t('catAddPlaceholderZh')}
            aria-label={t('catAddPlaceholderZh')}
            onChange={(event) => onEditNew({ newCatZh: event.target.value })}
            style={{ maxWidth: 180 }}
          />
          <Input
            value={state.newCatEn}
            placeholder={t('catAddPlaceholderEn')}
            aria-label={t('catAddPlaceholderEn')}
            onChange={(event) => onEditNew({ newCatEn: event.target.value })}
            style={{ maxWidth: 180 }}
          />
          <Button variant="outline" size="sm" disabled={state.catBusy} onClick={onAdd}>{t('catAddBtn')}</Button>
          {state.catError ? <span role="alert" style={{ ...mutedStyle, color: 'var(--dsh-danger, #c0392b)' }}>{t('catInvalidTitle')}</span> : null}
        </div>
      </div>
      {members ? (
        <div>
          <div style={{ ...mutedStyle, marginBottom: 4 }}>
            {t('catMembers')}：{categoryTitle(state.categories.find((c) => c.id === members.categoryId) ?? { id: members.categoryId }, language)}
          </div>
          {members.items.length === 0 ? <span style={mutedStyle}>{t('catMembersEmpty')}</span> : (
            <ul style={{ ...cardsStyle, gridTemplateColumns: '1fr' }}>
              {members.items.map((item) => (
                <li key={item.id} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13 }}>{item.name}</strong>
                    <span style={{ ...mutedStyle, marginLeft: 8 }}>{item.desc || ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Button variant="ghost" size="sm" onClick={() => onOpenEntry(item.id)}>{t('viewInRepo')}</Button>
                    <Button variant="outline" size="sm" onClick={() => onMoveOut(item.id)}>{t('catMoveOut')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>{t('catBuiltin')}</div>
        <div style={categoriesStyle}>
          {builtin.map((c) => <Tag key={c.id}>{categoryTitle(c, language)} ({c.plugins})</Tag>)}
        </div>
      </div>
    </div>
  )
}

/** 「仓库」标签根组件：props 由槽位框架注入（t/hooks/动作）。 */
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
  const sortLabels = { votes: t('sortVotes'), stars: t('sortStars'), updated: t('sortUpdated'), score: t('sortScore') }
  const viewLabels = { browse: t('viewBrowse'), installed: t('viewInstalled'), categories: t('viewCategories') }

  let body = null
  if (state.view === 'installed') {
    body = (
      <InstalledView
        state={state}
        t={t}
        language={language}
        categories={categories}
        onRefresh={props.refreshBundles}
        onToggle={props.toggleBundle}
        onRemove={props.removeBundle}
        onOpenEntry={props.openEntryByRepoId}
      />
    )
  } else if (state.view === 'categories') {
    body = (
      <CategoriesView
        state={state}
        t={t}
        language={language}
        onEditNew={props.editNewCategory}
        onAdd={props.addCategory}
        onRemove={props.removeCategory}
        onOpenMembers={props.openCategoryMembers}
        onMoveOut={props.moveOutOfCategory}
        onOpenEntry={props.openEntryByRepoId}
      />
    )
  } else if (state.detailStatus === 'loading') {
    body = <p style={mutedStyle}>{t('loading')}</p>
  } else if (state.detail) {
    body = (
      <EntryDetail
        detail={state.detail}
        categories={categories}
        t={t}
        language={language}
        onBack={props.closeEntry}
        onRate={props.submitRating}
        onUnrate={props.removeRating}
        rateError={state.rateError}
        rateBusy={state.rateBusy}
        onInstall={props.installSpec}
        onAddLabel={props.addLabel}
        onRemoveLabel={props.removeLabel}
        onSetLocalCategory={props.setLocalCategory}
        labelDraft={state.labelDraft}
        onEditLabelDraft={props.editLabelDraft}
        pmBusy={state.pmBusy}
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
              categoryName={categoryMap.get(item.localCategoryId || item.categoryId) ?? ''}
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

  const pmBar = state.pmResult ? (
    <div style={resultBarStyle(state.pmResult.application === 'failed')} role="status">
      {state.pmResult.action} → {state.pmResult.target}：{state.pmResult.application}
      {state.pmResult.application === 'failed' && state.pmResult.diagnostic ? `（${state.pmResult.diagnostic}）` : ''}
    </div>
  ) : null

  return (
    <div style={sectionStyle} data-plugin-tab="repo">
      <div style={categoriesStyle} role="group" aria-label="view">
        {Object.entries(viewLabels).map(([key, label]) => (
          <Pill key={key} active={state.view === key} aria-pressed={state.view === key} onClick={() => props.setView(key)}>
            {label}
          </Pill>
        ))}
      </div>
      {pmBar}
      {state.view === 'browse' ? (
        <Fragment>
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
        </Fragment>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{body}</div>
    </div>
  )
}

/** 客户端入口：注册词典 + 控制器 + plugins.tab 槽位 + 官方变更事件订阅。 */
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-plugin-repo: dictionaries')
  const controller = new RepoController(ctx)
  ctx.effect(() => () => controller.dispose(), 'ui-plugin-repo: controller')
  ctx.effect(() => {
    const off = ctx.on('connection/reset', () => {
      // 连接重置后宿主可能换代：就绪态重新拉取，未渲染（idle）保持不动
      if (controller.state().status !== 'idle') controller.reload()
      if (controller.state().bundlesStatus !== 'idle') void controller.loadBundles()
    })
    return off
  }, 'ui-plugin-repo: connection reset')
  ctx.effect(() => {
    // 官方 pluginManager 的变更事件：已安装视图就绪时自动刷新
    const off = ctx.remote.$on('plugin-manager/changed', () => {
      if (controller.state().bundlesStatus === 'ready') void controller.loadBundles()
    })
    return off
  }, 'ui-plugin-repo: plugin-manager changed')
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
