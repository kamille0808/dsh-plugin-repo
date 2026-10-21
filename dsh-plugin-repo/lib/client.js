window.__ModuleLoader__.load({
	id: "dsh-plugin-repo/client",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
		  // If the importer is in node compatibility mode or this is not an ESM
		  // file that has been converted to a CommonJS file using a Babel-
		  // compatible transform (i.e. "__esModule" has not been set), then set
		  // "default" to the CommonJS "module.exports" for node compatibility.
		  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
		  mod
		));
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
		
		// src/client/index.jsx
		var index_exports = {};
		__export(index_exports, {
		  apply: () => apply,
		  inject: () => inject
		});
		module.exports = __toCommonJS(index_exports);
		var import_jsx_runtime = require("react/jsx-runtime");
		var import_react = __toESM(require("react"), 1);
		var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		var import_jsx_runtime2 = require("react/jsx-runtime");
		var NS = "pluginRepo";
		var inject = ["slots", "locale", "connection", "remote"];
		var PAGE_SIZE = 24;
		var zh = {
		  title: "\u4ED3\u5E93",
		  viewBrowse: "\u6D4F\u89C8\u4ED3\u5E93",
		  viewInstalled: "\u5DF2\u5B89\u88C5",
		  viewCategories: "\u5206\u7C7B\u7BA1\u7406",
		  searchPlaceholder: "\u641C\u7D22\u63D2\u4EF6\u540D\u79F0 / npm \u5305\u540D / \u7B80\u4ECB",
		  allCategories: "\u5168\u90E8\u5206\u7C7B",
		  sortVotes: "\u5171\u8BC6\u7968\u6392\u5E8F",
		  sortStars: "Star \u6392\u5E8F",
		  sortUpdated: "\u6700\u8FD1\u66F4\u65B0",
		  sortScore: "\u5BA2\u89C2\u5206\u6392\u5E8F",
		  scoreShort: "\u5206",
		  objectiveScoreTitle: "\u5BA2\u89C2\u5206",
		  loading: "\u6B63\u5728\u8BFB\u53D6\u4ED3\u5E93\u955C\u50CF",
		  retry: "\u91CD\u8BD5",
		  refresh: "\u5237\u65B0",
		  noMatches: "\u6CA1\u6709\u5339\u914D\u7684\u63D2\u4EF6",
		  showMore: "\u52A0\u8F7D\u66F4\u591A",
		  votes: "\u7968",
		  detailBack: "\u8FD4\u56DE\u5217\u8868",
		  factPackage: "npm \u5305",
		  factCategory: "\u5206\u7C7B",
		  factLicense: "\u8BB8\u53EF\u8BC1",
		  factStars: "GitHub Star",
		  factUpdated: "\u955C\u50CF\u66F4\u65B0",
		  factStatus: "\u72B6\u6001",
		  versionsTitle: "\u6700\u8FD1\u7248\u672C",
		  ratingTitle: "\u4EBA\u5DE5\u8BC4\u5206",
		  ratingNone: "\u6682\u65E0\u8BC4\u5206",
		  ratingAverage: "{count} \u4EBA\u5747\u5206 {average}",
		  ratingNotAudit: "\u81EA\u52A8\u8BA1\u7B97\uFF0C\u975E\u5B89\u5168\u5BA1\u8BA1\u7ED3\u8BBA",
		  myRatingTitle: "\u6211\u7684\u8BC4\u5206",
		  notePlaceholder: "\u77ED\u8BC4\uFF08\u2264500 \u5B57\uFF0C\u53EF\u9009\uFF09",
		  save: "\u4FDD\u5B58",
		  saving: "\u4FDD\u5B58\u4E2D\u2026",
		  savedLocal: "\u5DF2\u5B58\u672C\u5730\uFF0C\u5F85\u540C\u6B65",
		  unrateBtn: "\u5220\u9664\u6211\u7684\u8BC4\u5206",
		  rateHint: "\u672A\u914D\u7F6E scoredBy\uFF1A\u8BF7\u5230\u672C\u63D2\u4EF6\u7684\u914D\u7F6E\u91CC\u586B\u5199\u672C\u673A\u8BC4\u5206\u6807\u8BC6\uFF08<host>-<user>\uFF09",
		  rateInvalidScore: "\u5206\u6570\u987B\u4E3A 1-5 \u661F",
		  rateNotFound: "\u63D2\u4EF6\u4E0D\u5728\u672C\u5730\u955C\u50CF\u4E2D",
		  rateFailed: "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
		  eventsTitle: "\u6700\u8FD1\u4E8B\u4EF6",
		  eventsEmpty: "\u6682\u65E0\u52A8\u6001",
		  installTitle: "\u5B89\u88C5",
		  installSpecLabel: "\u5B89\u88C5 spec",
		  copySpec: "\u590D\u5236 spec",
		  copied: "\u5DF2\u590D\u5236",
		  installNow: "\u5B89\u88C5",
		  installing: "\u5B89\u88C5\u4E2D\u2026",
		  installApplied: "\u5DF2\u5B89\u88C5\u5E76\u542F\u7528",
		  installRestart: "\u5DF2\u5B89\u88C5\uFF0C\u91CD\u542F\u540E\u751F\u6548",
		  installFailed: "\u5B89\u88C5\u5931\u8D25",
		  installHint: "\u5B89\u88C5\u52A8\u4F5C\u7ECF pluginManager \u6267\u884C\uFF0C\u4FDD\u7559\u5176\u5BA1\u6279\u4E0E\u56DE\u6EDA\uFF1B\u5931\u8D25\u53EF\u6539\u7528\u590D\u5236\u7684 spec \u5230\u300C\u5DF2\u5B89\u88C5\u300D\u9875\u64CD\u4F5C",
		  snapshotNote: "\u6570\u636E\u6765\u81EA\u672C\u5730\u955C\u50CF\u5FEB\u7167\uFF08\u79BB\u7EBF\u53EF\u8BFB\uFF09",
		  errorPrefix: "\u8C03\u7528\u5931\u8D25",
		  labelsTitle: "\u6807\u7B7E",
		  labelsPlaceholder: "\u56DE\u8F66\u6DFB\u52A0\u6807\u7B7E\uFF08\u22648 \u4E2A\uFF09",
		  localCategoryTitle: "\u672C\u5730\u5206\u7C7B",
		  followCentral: "\u8DDF\u968F\u4E2D\u5FC3\u5E93",
		  installedEmpty: "\u672C profile \u6CA1\u6709\u5DF2\u5B89\u88C5\u7684\u5916\u90E8 bundle",
		  installedLoading: "\u6B63\u5728\u8BFB\u53D6\u5DF2\u5B89\u88C5\u5217\u8868",
		  notInRepo: "\u4E0D\u5728\u4ED3\u5E93\u955C\u50CF",
		  enabledTag: "\u5DF2\u542F\u7528",
		  disabledTag: "\u5DF2\u505C\u7528",
		  enableBtn: "\u542F\u7528",
		  disableBtn: "\u505C\u7528",
		  removeBtn: "\u79FB\u9664",
		  removeConfirm: "\u786E\u8BA4\u79FB\u9664\u8BE5 bundle\uFF1F\u79FB\u9664\u4F1A\u5378\u8F7D\u5176\u5168\u90E8\u63D2\u4EF6\u884C",
		  officialTag: "\u5B98\u65B9",
		  viewInRepo: "\u4ED3\u5E93\u8BE6\u60C5",
		  catBuiltin: "\u5185\u7F6E\u5206\u7C7B\uFF08\u53EA\u8BFB\uFF09",
		  catLocal: "\u672C\u5730\u5206\u7C7B",
		  catAddPlaceholderZh: "\u65B0\u5206\u7C7B\u4E2D\u6587\u540D",
		  catAddPlaceholderEn: "\u82F1\u6587\u540D\uFF08\u53EF\u9009\uFF09",
		  catAddBtn: "\u65B0\u589E\u5206\u7C7B",
		  catDelete: "\u5220\u9664",
		  catDeleteConfirm: "\u5220\u9664\u8BE5\u672C\u5730\u5206\u7C7B\uFF1F\u5176\u4E2D\u63D2\u4EF6\u5C06\u56DE\u9000\u5230\u4E2D\u5FC3\u5E93\u5206\u7C7B",
		  catEmpty: "\u6682\u65E0\u672C\u5730\u5206\u7C7B",
		  catMembers: "\u8BE5\u5206\u7C7B\u4E0B\u7684\u63D2\u4EF6",
		  catMembersEmpty: "\u8BE5\u5206\u7C7B\u4E0B\u6682\u65E0\u63D2\u4EF6",
		  catMoveOut: "\u79FB\u51FA",
		  catInvalidTitle: "\u4E2D\u6587\u540D\u5FC5\u586B\u4E14 \u226430 \u5B57",
		  pmUnavailable: "pluginManager \u670D\u52A1\u4E0D\u53EF\u7528\uFF08\u5F53\u524D profile \u4E0D\u652F\u6301\u63D2\u4EF6\u7BA1\u7406\uFF09",
		  pmActionFailed: "\u64CD\u4F5C\u5931\u8D25"
		};
		var en = {
		  title: "Repository",
		  viewBrowse: "Browse",
		  viewInstalled: "Installed",
		  viewCategories: "Categories",
		  searchPlaceholder: "Search plugin name / npm package / description",
		  allCategories: "All categories",
		  sortVotes: "Sort by consensus votes",
		  sortStars: "Sort by stars",
		  sortUpdated: "Recently updated",
		  sortScore: "Sort by objective score",
		  scoreShort: "score",
		  objectiveScoreTitle: "Objective score",
		  loading: "Reading the local repository mirror",
		  retry: "Retry",
		  refresh: "Refresh",
		  noMatches: "No plugins match.",
		  showMore: "Show more",
		  votes: "votes",
		  detailBack: "Back to list",
		  factPackage: "npm package",
		  factCategory: "Category",
		  factLicense: "License",
		  factStars: "GitHub stars",
		  factUpdated: "Mirror updated",
		  factStatus: "Status",
		  versionsTitle: "Recent versions",
		  ratingTitle: "Ratings",
		  ratingNone: "No ratings yet",
		  ratingAverage: "{count} raters, average {average}",
		  ratingNotAudit: "Auto-computed; not a security audit",
		  myRatingTitle: "My rating",
		  notePlaceholder: "Short note (\u2264500 chars, optional)",
		  save: "Save",
		  saving: "Saving\u2026",
		  savedLocal: "Saved locally, pending sync",
		  unrateBtn: "Delete my rating",
		  rateHint: "scoredBy is not configured: set your host rating identity (<host>-<user>) in this plugin's config",
		  rateInvalidScore: "Score must be 1-5 stars",
		  rateNotFound: "Plugin not in the local mirror",
		  rateFailed: "Operation failed, please retry",
		  eventsTitle: "Recent events",
		  eventsEmpty: "No recent events",
		  installTitle: "Install",
		  installSpecLabel: "Install spec",
		  copySpec: "Copy spec",
		  copied: "Copied",
		  installNow: "Install",
		  installing: "Installing\u2026",
		  installApplied: "Installed and enabled",
		  installRestart: "Installed; takes effect after restart",
		  installFailed: "Installation failed",
		  installHint: "Installation runs through pluginManager with its approval and rollback; on failure, copy the spec and use the Installed page",
		  snapshotNote: "Data comes from the local mirror snapshot (readable offline)",
		  errorPrefix: "Call failed",
		  labelsTitle: "Labels",
		  labelsPlaceholder: "Press Enter to add a label (max 8)",
		  localCategoryTitle: "Local category",
		  followCentral: "Follow central catalog",
		  installedEmpty: "No external bundles installed in this profile",
		  installedLoading: "Reading installed bundles",
		  notInRepo: "Not in repository mirror",
		  enabledTag: "Enabled",
		  disabledTag: "Disabled",
		  enableBtn: "Enable",
		  disableBtn: "Disable",
		  removeBtn: "Remove",
		  removeConfirm: "Remove this bundle? All its plugin rows will be unloaded",
		  officialTag: "Official",
		  viewInRepo: "Open in repository",
		  catBuiltin: "Built-in categories (read-only)",
		  catLocal: "Local categories",
		  catAddPlaceholderZh: "New category name (zh)",
		  catAddPlaceholderEn: "English name (optional)",
		  catAddBtn: "Add category",
		  catDelete: "Delete",
		  catDeleteConfirm: "Delete this local category? Its plugins fall back to the central category",
		  catEmpty: "No local categories yet",
		  catMembers: "Plugins in this category",
		  catMembersEmpty: "No plugins in this category",
		  catMoveOut: "Move out",
		  catInvalidTitle: "Chinese name required, \u226430 chars",
		  pmUnavailable: "pluginManager service unavailable (this profile cannot manage plugins)",
		  pmActionFailed: "Action failed"
		};
		var INITIAL = {
		  status: "idle",
		  // idle | loading | error | ready
		  error: null,
		  // RemoteError 序列化 {code, message}
		  query: { text: "", category: "", sort: "votes" },
		  categories: [],
		  // [{id, titleZh, titleEn, builtin, plugins}]
		  listing: null,
		  // {total, offset, items, hasMore}
		  detail: null,
		  // entry() 结果（含 plugin/objectiveScore/ratingSummary/myRating/recentEvents）
		  detailStatus: "idle",
		  // idle | loading | error
		  rateError: null,
		  // rate/unrate 失败的 {code, message}（null = 无）
		  rateBusy: false,
		  // ---- V2 ----
		  view: "browse",
		  // browse | installed | categories
		  bundles: null,
		  // installed() 合并读结果 items
		  bundlesStatus: "idle",
		  // idle | loading | ready | error
		  bundlesError: null,
		  pmBusy: "",
		  // 进行中的 bundle 名（按钮禁用）
		  pmResult: null,
		  // {action, application|code, diagnostic?, target} 操作结果条
		  newCatZh: "",
		  newCatEn: "",
		  catBusy: false,
		  catError: null,
		  catMembers: null,
		  // {categoryId, items}
		  labelDraft: ""
		};
		var RepoController = class {
		  constructor(ctx) {
		    this.ctx = ctx;
		    this.store = (0, import_dsh_client_store.createSnapshotStore)(INITIAL);
		    this.disposed = false;
		    this.searchRead = 0;
		    this.failed = () => {
		    };
		  }
		  dispose() {
		    this.disposed = true;
		  }
		  state() {
		    return this.store.getSnapshot();
		  }
		  patch(next) {
		    this.store.set({ ...this.state(), ...next });
		  }
		  /** 动态调用宿主 pluginRepo Remote；返回 RemoteResult（传输/业务失败均不 throw）。 */
		  async call(method, args) {
		    try {
		      return await this.ctx.connection.rpc.call("/api", `pluginRepo/${method}`, { args });
		    } catch (error) {
		      return { ok: false, error: { code: "transport", message: String(error?.message ?? error) } };
		    }
		  }
		  /** 动态调用官方 pluginManager Remote（安装/启停/删除走它，保留官方审批链）。 */
		  async callPm(method, args) {
		    try {
		      return await this.ctx.connection.rpc.call("/api", `pluginManager/${method}`, { args });
		    } catch (error) {
		      return { ok: false, error: { code: "transport", message: String(error?.message ?? error) } };
		    }
		  }
		  /** 重新拉取分类与首屏列表（ensure/刷新/重置连接后的统一入口）。 */
		  reload() {
		    this.failed = () => this.reload();
		    void this.loadCategories();
		    void this.search(true);
		  }
		  face(resolveText) {
		    return {
		      hooks: { repo: this.store, locale: this.ctx.locale },
		      resolveText,
		      ensure: () => {
		        if (this.state().status === "idle") this.reload();
		      },
		      reload: () => this.reload(),
		      retry: () => {
		        this.failed();
		      },
		      refresh: () => {
		        this.reload();
		      },
		      editQuery: (patch) => {
		        const query = { ...this.state().query, ...patch };
		        this.patch({ query });
		      },
		      submitSearch: () => {
		        void this.search(true);
		      },
		      pickCategory: (id) => {
		        this.patch({ query: { ...this.state().query, category: id } });
		        void this.search(true);
		      },
		      pickSort: (sort) => {
		        this.patch({ query: { ...this.state().query, sort } });
		        void this.search(true);
		      },
		      more: () => {
		        void this.search(false);
		      },
		      openEntry: (id) => {
		        this.patch({ rateError: null });
		        void this.loadEntry(id);
		      },
		      closeEntry: () => {
		        if (!this.disposed) this.patch({ detail: null, detailStatus: "idle", rateError: null });
		      },
		      submitRating: (id, score, note) => {
		        void this.saveRating(id, score, note);
		      },
		      removeRating: (id) => {
		        void this.deleteRating(id);
		      },
		      // ---- V2 动作 ----
		      setView: (view) => {
		        this.patch({ view });
		        if (view === "installed" && this.state().bundlesStatus === "idle") void this.loadBundles();
		        if (view === "categories") void this.loadCategories();
		      },
		      refreshBundles: () => void this.loadBundles(),
		      toggleBundle: (name, enabled) => void this.toggleBundle(name, enabled),
		      removeBundle: (name) => void this.removeBundle(name),
		      installSpec: (spec) => void this.installSpec(spec),
		      openEntryByRepoId: (id) => {
		        this.patch({ view: "browse" });
		        void this.loadEntry(id);
		      },
		      editNewCategory: (patch) => this.patch(patch),
		      addCategory: () => void this.addCategory(),
		      removeCategory: (id) => void this.removeCategory(id),
		      openCategoryMembers: (id) => void this.openCategoryMembers(id),
		      moveOutOfCategory: (id) => void this.moveOutOfCategory(id),
		      editLabelDraft: (labelDraft) => this.patch({ labelDraft }),
		      addLabel: (id, label) => void this.addLabel(id, label),
		      removeLabel: (id, label) => void this.removeLabel(id, label),
		      setLocalCategory: (id, categoryId) => void this.setLocalCategory(id, categoryId)
		    };
		  }
		  async loadCategories() {
		    const answer = await this.call("categories", {});
		    if (this.disposed || !answer.ok) return;
		    this.patch({ categories: answer.value.items ?? [] });
		  }
		  /** 首屏（replace=true）或加载下一页；读取序号防乱序覆盖。 */
		  async search(replace) {
		    const read = ++this.searchRead;
		    const state = this.state();
		    if (replace || state.status === "idle") this.patch({ status: "loading" });
		    const offset = replace ? 0 : state.listing ? state.listing.items.length : 0;
		    const { text, category, sort } = state.query;
		    const answer = await this.call("search", { text, category, sort, limit: PAGE_SIZE, offset });
		    if (this.disposed || read !== this.searchRead) return;
		    if (!answer.ok) {
		      this.failed = () => this.search(replace);
		      this.patch({ status: "error", error: answer.error, listing: replace ? null : state.listing });
		      return;
		    }
		    const value = answer.value;
		    const items = replace ? value.items : [...state.listing?.items ?? [], ...value.items];
		    this.patch({
		      status: "ready",
		      error: null,
		      listing: { total: value.total, offset: value.offset, items, hasMore: offset + value.items.length < value.total }
		    });
		  }
		  /** 保存评分：按返回 code 映射引导文案，成功后重拉详情（含 synced 徽标）。 */
		  async saveRating(id, score, note) {
		    this.patch({ rateBusy: true, rateError: null });
		    const answer = await this.call("rate", { id, score, note });
		    if (this.disposed) return;
		    this.patch({ rateBusy: false });
		    if (!answer.ok) {
		      this.patch({ rateError: answer.error });
		      return;
		    }
		    if (!answer.value.ok) {
		      this.patch({ rateError: answer.value.error });
		      return;
		    }
		    await this.loadEntry(id);
		  }
		  /** 删除本人评分；成功后重拉详情。 */
		  async deleteRating(id) {
		    this.patch({ rateBusy: true, rateError: null });
		    const answer = await this.call("unrate", { id });
		    if (this.disposed) return;
		    this.patch({ rateBusy: false });
		    if (!answer.ok) {
		      this.patch({ rateError: answer.error });
		      return;
		    }
		    if (!answer.value.ok) {
		      this.patch({ rateError: answer.value.error });
		      return;
		    }
		    await this.loadEntry(id);
		  }
		  async loadEntry(id) {
		    this.patch({ detailStatus: "loading", detail: null });
		    const answer = await this.call("entry", { id });
		    if (this.disposed) return;
		    if (!answer.ok || !answer.value?.found) {
		      this.patch({ detailStatus: "error" });
		      return;
		    }
		    this.patch({ detail: answer.value, detailStatus: "ready", labelDraft: "" });
		  }
		  // ---------------------------------------------------------------------------
		  // V2：已安装管理（读走本插件 installed 合并读；写动作直调官方 pluginManager）
		  // ---------------------------------------------------------------------------
		  async loadBundles() {
		    this.patch({ bundlesStatus: "loading" });
		    const answer = await this.call("installed", {});
		    if (this.disposed) return;
		    if (!answer.ok || !answer.value?.ok) {
		      this.patch({ bundlesStatus: "error", bundlesError: answer.ok ? answer.value?.error : answer.error });
		      return;
		    }
		    this.patch({ bundlesStatus: "ready", bundles: answer.value.items ?? [], bundlesError: null });
		  }
		  /** 启停/删除/安装动作统一出口：记录结果条并重拉已安装列表。 */
		  async pmAction(action, name, answerPromise) {
		    this.patch({ pmBusy: name, pmResult: null });
		    const answer = await answerPromise;
		    if (this.disposed) return;
		    this.patch({ pmBusy: "" });
		    if (!answer.ok) {
		      this.patch({ pmResult: { action, application: "failed", diagnostic: answer.error?.message ?? answer.error?.code ?? "", target: name } });
		      return;
		    }
		    const v = answer.value ?? {};
		    this.patch({
		      pmResult: {
		        action,
		        application: v.application ?? (v.error ? "failed" : "applied"),
		        diagnostic: v.error?.diagnostic ?? v.error?.code ?? "",
		        target: v.target ?? name
		      }
		    });
		    await this.loadBundles();
		  }
		  toggleBundle(name, enabled) {
		    return this.pmAction(enabled ? "enable" : "disable", name, this.callPm("setBundleEnabled", { name, enabled }));
		  }
		  removeBundle(name) {
		    return this.pmAction("remove", name, this.callPm("removeBundle", { name }));
		  }
		  /** 详情页直接安装：requestId 追踪，installBundle 结算后展示 application 状态。 */
		  installSpec(spec) {
		    const requestId = `repo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		    return this.pmAction("install", spec, this.callPm("installBundle", { spec, options: { requestId } }));
		  }
		  // ---------------------------------------------------------------------------
		  // V2：分类与 labels（本地私有，宿主只写本机域）
		  // ---------------------------------------------------------------------------
		  async addCategory() {
		    const { newCatZh, newCatEn } = this.state();
		    if (!newCatZh.trim()) {
		      this.patch({ catError: { code: "plugin-repo/invalid-category-title" } });
		      return;
		    }
		    this.patch({ catBusy: true, catError: null });
		    const answer = await this.call("addCategory", { titleZh: newCatZh.trim(), titleEn: newCatEn.trim() });
		    if (this.disposed) return;
		    this.patch({ catBusy: false });
		    if (!answer.ok || !answer.value?.ok) {
		      this.patch({ catError: answer.ok ? answer.value?.error : answer.error });
		      return;
		    }
		    this.patch({ newCatZh: "", newCatEn: "" });
		    await this.loadCategories();
		  }
		  async removeCategory(id) {
		    this.patch({ catBusy: true, catError: null });
		    const answer = await this.call("removeCategory", { id });
		    if (this.disposed) return;
		    this.patch({ catBusy: false });
		    if (!answer.ok || !answer.value?.ok) {
		      this.patch({ catError: answer.ok ? answer.value?.error : answer.error });
		      return;
		    }
		    if (this.state().catMembers?.categoryId === id) this.patch({ catMembers: null });
		    await this.loadCategories();
		  }
		  /** 分类管理视图：列出某本地分类下的插件（复用 search 的分类过滤）。 */
		  async openCategoryMembers(categoryId) {
		    const answer = await this.call("search", { text: "", category: categoryId, sort: "votes", limit: 100, offset: 0 });
		    if (this.disposed) return;
		    if (!answer.ok) return;
		    this.patch({ catMembers: { categoryId, items: answer.value.items ?? [] } });
		  }
		  async moveOutOfCategory(id) {
		    const answer = await this.call("setLocalCategory", { id, categoryId: "" });
		    if (this.disposed || !answer.ok) return;
		    const members = this.state().catMembers;
		    if (members) await this.openCategoryMembers(members.categoryId);
		  }
		  /** 详情页 labels 编辑：在现有基础上增删后整体提交。 */
		  async addLabel(id, label) {
		    const current = this.state().detail?.plugin?.labels ?? [];
		    const next = [.../* @__PURE__ */ new Set([...current, label.trim()])].filter(Boolean);
		    if (next.length === current.length) return;
		    const answer = await this.call("setLabels", { id, labels: next });
		    if (this.disposed || !answer.ok) return;
		    this.patch({ labelDraft: "" });
		    await this.loadEntry(id);
		  }
		  async removeLabel(id, label) {
		    const current = this.state().detail?.plugin?.labels ?? [];
		    const answer = await this.call("setLabels", { id, labels: current.filter((l) => l !== label) });
		    if (this.disposed || !answer.ok) return;
		    await this.loadEntry(id);
		  }
		  async setLocalCategory(id, categoryId) {
		    const answer = await this.call("setLocalCategory", { id, categoryId });
		    if (this.disposed || !answer.ok) return;
		    await this.loadEntry(id);
		    await this.loadCategories();
		  }
		};
		var sectionStyle = {
		  display: "flex",
		  flexDirection: "column",
		  gap: 12,
		  padding: "16px 20px",
		  minHeight: 0,
		  flex: 1
		};
		var toolbarStyle = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
		var categoriesStyle = { display: "flex", gap: 6, flexWrap: "wrap" };
		var cardsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, listStyle: "none", margin: 0, padding: 0 };
		var cardStyle = {
		  display: "flex",
		  flexDirection: "column",
		  gap: 8,
		  padding: 14,
		  borderRadius: 10,
		  border: "1px solid var(--dsh-border, rgba(128,128,128,.25))",
		  cursor: "pointer",
		  textAlign: "left",
		  background: "transparent"
		};
		var cardTitleStyle = { display: "flex", alignItems: "center", gap: 8, fontWeight: 600 };
		var cardDescStyle = { opacity: 0.75, fontSize: 12, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };
		var cardMetaStyle = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 };
		var mutedStyle = { opacity: 0.6, fontSize: 12 };
		var detailStyle = { display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingRight: 4 };
		var detailHeadStyle = { display: "flex", alignItems: "center", gap: 8 };
		var factsStyle = { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 13 };
		var specRowStyle = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
		var codeStyle = {
		  fontFamily: "var(--dsh-mono, monospace)",
		  fontSize: 12,
		  padding: "6px 10px",
		  borderRadius: 8,
		  background: "var(--dsh-sunken, rgba(128,128,128,.12))",
		  wordBreak: "break-all"
		};
		var eventListStyle = { display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none", fontSize: 12 };
		var scoreBarOuterStyle = {
		  height: 8,
		  borderRadius: 4,
		  flex: 1,
		  minWidth: 80,
		  overflow: "hidden",
		  background: "var(--dsh-sunken, rgba(128,128,128,.12))"
		};
		var scoreBarInnerStyle = { height: "100%", borderRadius: 4, background: "var(--dsh-accent, rgba(64,128,255,.8))" };
		var starStyle = (active) => ({
		  border: "none",
		  background: "transparent",
		  cursor: "pointer",
		  padding: "0 2px",
		  fontSize: 18,
		  lineHeight: 1,
		  color: active ? "#f5a623" : "var(--dsh-muted, rgba(128,128,128,.55))"
		});
		var rowStyle = {
		  display: "flex",
		  alignItems: "center",
		  gap: 10,
		  padding: "10px 12px",
		  borderRadius: 10,
		  border: "1px solid var(--dsh-border, rgba(128,128,128,.25))"
		};
		var resultBarStyle = (failed) => ({
		  fontSize: 12,
		  padding: "6px 10px",
		  borderRadius: 8,
		  background: failed ? "var(--dsh-danger-bg, rgba(192,57,43,.12))" : "var(--dsh-sunken, rgba(128,128,128,.12))"
		});
		var EVENT_ICONS = {
		  "new-plugin": "\u{1F195}",
		  "update-available": "\u2B06\uFE0F",
		  "renamed": "\u270F\uFE0F",
		  "archived": "\u{1F4E6}",
		  "removed-from-list": "\u{1F6AB}"
		};
		function categoryTitle(c, language) {
		  const zhActive = language === "zh";
		  return zhActive ? c.titleZh || c.titleEn || c.id : c.titleEn || c.titleZh || c.id;
		}
		function formatWhen(text) {
		  if (!text) return "";
		  return text.replace("T", " ").slice(0, 16);
		}
		var RATE_ERROR_KEYS = {
		  "plugin-repo/scored-by-required": "rateHint",
		  "plugin-repo/invalid-score": "rateInvalidScore",
		  "plugin-repo/not-found": "rateNotFound"
		};
		function StarInput({ value, onChange, disabled, t }) {
		  const [hover, setHover] = import_react.default.useState(0);
		  const shown = hover || value;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { role: "radiogroup", "aria-label": t("myRatingTitle"), onMouseLeave: () => setHover(0), children: [1, 2, 3, 4, 5].map((n) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "button",
		    {
		      type: "button",
		      style: starStyle(n <= shown),
		      disabled,
		      role: "radio",
		      "aria-label": String(n),
		      "aria-checked": value === n,
		      onMouseEnter: () => setHover(n),
		      onClick: () => onChange(n),
		      children: n <= shown ? "\u2605" : "\u2606"
		    },
		    n
		  )) });
		}
		function EntryCard({ item, categoryName, t, onOpen }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", style: cardStyle, onClick: onOpen, "aria-label": item.name, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: cardTitleStyle, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.PluginArtworkDefault, { size: 22 }),
		      item.name
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: cardDescStyle, children: item.desc || "\u2014" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: cardMetaStyle, children: [
		      categoryName ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: categoryName }) : null,
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { title: t("ratingNotAudit"), children: [
		        t("scoreShort"),
		        " ",
		        item.objectiveScore
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { children: [
		        "\u2605 ",
		        item.stars
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { children: [
		        item.consensusVotes,
		        " ",
		        t("votes")
		      ] }),
		      item.status !== "active" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: item.status }) : null,
		      (item.labels ?? []).slice(0, 3).map((l) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: l }, l))
		    ] })
		  ] }) });
		}
		function EntryDetail({ detail, categories, t, language, onBack, onRate, onUnrate, rateError, rateBusy, onInstall, onAddLabel, onRemoveLabel, onSetLocalCategory, labelDraft, onEditLabelDraft, pmBusy }) {
		  const p = detail.plugin;
		  const my = detail.myRating;
		  const [copied, setCopied] = import_react.default.useState(false);
		  const [score, setScore] = import_react.default.useState(my?.score ?? 0);
		  const [note, setNote] = import_react.default.useState(my?.note ?? "");
		  import_react.default.useEffect(() => {
		    setScore(detail.myRating?.score ?? 0);
		    setNote(detail.myRating?.note ?? "");
		  }, [detail.myRating?.score, detail.myRating?.note]);
		  const category = categories.find((c) => c.id === (p.localCategoryId || p.categoryId));
		  const localCategories = categories.filter((c) => !c.builtin);
		  const copy = async () => {
		    try {
		      await navigator.clipboard.writeText(detail.install.spec);
		      setCopied(true);
		      setTimeout(() => setCopied(false), 1500);
		    } catch {
		    }
		  };
		  const scoreTotal = detail.objectiveScore?.total ?? 0;
		  const rateErrorText = rateError ? t(RATE_ERROR_KEYS[rateError.code] ?? "rateFailed") : null;
		  const labels = p.labels ?? [];
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: detailStyle, "data-plugin-repo-detail": p.id, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: detailHeadStyle, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", onClick: onBack, children: t("detailBack") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.PluginArtworkDefault, { size: 26 }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { fontSize: 15 }, children: p.name }),
		      p.status !== "active" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: p.status }) : null
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, fontSize: 13, lineHeight: 1.6 }, children: p.descZh || p.descEn || "\u2014" }),
		    p.descZh && p.descEn ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { ...mutedStyle, margin: 0 }, children: p.descEn }) : null,
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: factsStyle, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("factPackage") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { style: codeStyle, children: p.npm || "\u2014" }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("factCategory") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: category ? categoryTitle(category, language) : p.localCategoryId || p.categoryId || "\u2014" }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("factLicense") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: p.license || "\u2014" }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("factStars") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
		        "\u2605 ",
		        p.stars
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("factUpdated") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: formatWhen(p.updatedAt) })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("ratingTitle") }),
		      detail.ratingSummary ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("ratingAverage").replace("{count}", String(detail.ratingSummary.count)).replace("{average}", String(detail.ratingSummary.average)) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("ratingNone") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: mutedStyle, children: [
		        " \xB7 ",
		        t("ratingNotAudit")
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("objectiveScoreTitle") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { fontSize: 18, minWidth: 28, textAlign: "right" }, children: scoreTotal }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: scoreBarOuterStyle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...scoreBarInnerStyle, width: `${Math.max(0, Math.min(100, scoreTotal))}%` } }) })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { ...mutedStyle, margin: "4px 0 0" }, children: t("ratingNotAudit") })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("myRatingTitle") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StarInput, { value: score, onChange: setScore, disabled: rateBusy, t }),
		          my && !my.synced ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: t("savedLocal") }) : null
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Input,
		          {
		            value: note,
		            placeholder: t("notePlaceholder"),
		            "aria-label": t("notePlaceholder"),
		            maxLength: 500,
		            disabled: rateBusy,
		            onChange: (event) => setNote(event.target.value),
		            style: { maxWidth: 420 }
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		            import_dsh_client_ui_primitives.Button,
		            {
		              variant: "outline",
		              size: "sm",
		              disabled: rateBusy || score < 1,
		              onClick: () => onRate(p.id, score, note),
		              children: rateBusy ? t("saving") : t("save")
		            }
		          ),
		          my ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", disabled: rateBusy, onClick: () => onUnrate(p.id), children: t("unrateBtn") }) : null,
		          rateErrorText ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { role: "alert", style: { ...mutedStyle, color: "var(--dsh-danger, #c0392b)" }, children: rateErrorText }) : null
		        ] })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("labelsTitle") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }, children: [
		        labels.map((l) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { children: [
		          l,
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		            "button",
		            {
		              type: "button",
		              "aria-label": `remove ${l}`,
		              style: { border: "none", background: "transparent", cursor: "pointer", padding: "0 0 0 4px", fontSize: 11 },
		              onClick: () => onRemoveLabel(p.id, l),
		              children: "\xD7"
		            }
		          )
		        ] }, l)),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Input,
		          {
		            value: labelDraft,
		            placeholder: t("labelsPlaceholder"),
		            "aria-label": t("labelsPlaceholder"),
		            onChange: (event) => onEditLabelDraft(event.target.value),
		            onKeyDown: (event) => {
		              if (event.key === "Enter" && labelDraft.trim()) onAddLabel(p.id, labelDraft);
		            },
		            style: { maxWidth: 200 }
		          }
		        )
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("localCategoryTitle") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		        "select",
		        {
		          "aria-label": t("localCategoryTitle"),
		          value: p.localCategoryId ?? "",
		          onChange: (event) => onSetLocalCategory(p.id, event.target.value),
		          style: { fontSize: 12 },
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("followCentral") }),
		            localCategories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: c.id, children: categoryTitle(c, language) }, c.id))
		          ]
		        }
		      )
		    ] }),
		    Array.isArray(p.npmVersions) && p.npmVersions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("versionsTitle") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: cardMetaStyle, children: p.npmVersions.slice(0, 6).map((v) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: v.ver }, v.ver)) })
		    ] }) : null,
		    Array.isArray(detail.recentEvents) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("eventsTitle") }),
		      detail.recentEvents.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("eventsEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: eventListStyle, children: detail.recentEvents.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { style: cardMetaStyle, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { "aria-hidden": "true", children: EVENT_ICONS[e.kind] ?? "\u2022" }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: e.kind }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: formatWhen(e.at) })
		      ] }, i)) })
		    ] }) : null,
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("installSpecLabel") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: specRowStyle, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { style: codeStyle, children: detail.install.spec }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: copy, children: copied ? t("copied") : t("copySpec") }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Button,
		          {
		            variant: "outline",
		            size: "sm",
		            disabled: pmBusy !== "",
		            onClick: () => onInstall(detail.install.spec),
		            children: pmBusy ? t("installing") : t("installNow")
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("installHint") })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("snapshotNote") })
		  ] });
		}
		function InstalledView({ state, t, language, onRefresh, onToggle, onRemove, onOpenEntry, categories }) {
		  const categoryMap = new Map(categories.map((c) => [c.id, categoryTitle(c, language)]));
		  if (state.bundlesStatus === "loading" || state.bundlesStatus === "idle") {
		    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("installedLoading") });
		  }
		  if (state.bundlesStatus === "error") {
		    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { role: "alert", style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "error" }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: mutedStyle, children: [
		        t("errorPrefix"),
		        ": ",
		        state.bundlesError?.code ?? "unknown"
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: onRefresh, children: t("retry") })
		    ] });
		  }
		  const items = (state.bundles ?? []).filter((b) => b.installed);
		  if (items.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("installedEmpty") });
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: { ...cardsStyle, gridTemplateColumns: "1fr" }, children: items.map((b) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { style: rowStyle, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.PluginArtworkDefault, { size: 20 }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { fontSize: 13 }, children: b.metaTitle || b.name }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: mutedStyle, children: [
		          b.name,
		          b.version ? `@${b.version}` : ""
		        ] }),
		        b.official ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: t("officialTag") }) : null,
		        b.enabled ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: t("enabledTag") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: t("disabledTag") }),
		        b.error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { title: b.error.diagnostic, children: [
		          "\u26A0 ",
		          b.error.code
		        ] }) : null
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginTop: 4 }, children: b.inRepo ? `${b.repoDesc || ""} \xB7 ${categoryMap.get(b.repoCategoryId) ?? ""} \xB7 ${t("scoreShort")} ${b.objectiveScore} \xB7 ${b.consensusVotes} ${t("votes")}` : t("notInRepo") })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 6, flexShrink: 0 }, children: [
		      b.inRepo ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", onClick: () => onOpenEntry(b.repoId), children: t("viewInRepo") }) : null,
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		        import_dsh_client_ui_primitives.Button,
		        {
		          variant: "outline",
		          size: "sm",
		          disabled: state.pmBusy !== "" || Boolean(b.readOnlyReason),
		          onClick: () => onToggle(b.name, !b.enabled),
		          children: b.enabled ? t("disableBtn") : t("enableBtn")
		        }
		      ),
		      b.removable ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		        import_dsh_client_ui_primitives.Button,
		        {
		          variant: "ghost",
		          size: "sm",
		          disabled: state.pmBusy !== "",
		          onClick: () => {
		            if (window.confirm(t("removeConfirm"))) onRemove(b.name);
		          },
		          children: t("removeBtn")
		        }
		      ) : null
		    ] })
		  ] }, b.name)) });
		}
		function CategoriesView({ state, t, language, onEditNew, onAdd, onRemove, onOpenMembers, onMoveOut, onOpenEntry }) {
		  const builtin = state.categories.filter((c) => c.builtin);
		  const local = state.categories.filter((c) => !c.builtin);
		  const members = state.catMembers;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("catLocal") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }, children: [
		        local.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("catEmpty") }) : null,
		        local.map((c) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		            "button",
		            {
		              type: "button",
		              style: { border: "none", background: "transparent", cursor: "pointer", padding: 0 },
		              onClick: () => onOpenMembers(c.id),
		              children: [
		                categoryTitle(c, language),
		                " (",
		                c.plugins,
		                ")"
		              ]
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		            "button",
		            {
		              type: "button",
		              "aria-label": `delete ${c.id}`,
		              style: { border: "none", background: "transparent", cursor: "pointer", padding: "0 0 0 4px", fontSize: 11 },
		              onClick: () => {
		                if (window.confirm(t("catDeleteConfirm"))) onRemove(c.id);
		              },
		              children: "\xD7"
		            }
		          )
		        ] }, c.id))
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Input,
		          {
		            value: state.newCatZh,
		            placeholder: t("catAddPlaceholderZh"),
		            "aria-label": t("catAddPlaceholderZh"),
		            onChange: (event) => onEditNew({ newCatZh: event.target.value }),
		            style: { maxWidth: 180 }
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Input,
		          {
		            value: state.newCatEn,
		            placeholder: t("catAddPlaceholderEn"),
		            "aria-label": t("catAddPlaceholderEn"),
		            onChange: (event) => onEditNew({ newCatEn: event.target.value }),
		            style: { maxWidth: 180 }
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", disabled: state.catBusy, onClick: onAdd, children: t("catAddBtn") }),
		        state.catError ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { role: "alert", style: { ...mutedStyle, color: "var(--dsh-danger, #c0392b)" }, children: t("catInvalidTitle") }) : null
		      ] })
		    ] }),
		    members ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: [
		        t("catMembers"),
		        "\uFF1A",
		        categoryTitle(state.categories.find((c) => c.id === members.categoryId) ?? { id: members.categoryId }, language)
		      ] }),
		      members.items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("catMembersEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: { ...cardsStyle, gridTemplateColumns: "1fr" }, children: members.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { style: rowStyle, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { fontSize: 13 }, children: item.name }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...mutedStyle, marginLeft: 8 }, children: item.desc || "" })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 6, flexShrink: 0 }, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", onClick: () => onOpenEntry(item.id), children: t("viewInRepo") }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: () => onMoveOut(item.id), children: t("catMoveOut") })
		        ] })
		      ] }, item.id)) })
		    ] }) : null,
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("catBuiltin") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: categoriesStyle, children: builtin.map((c) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { children: [
		        categoryTitle(c, language),
		        " (",
		        c.plugins,
		        ")"
		      ] }, c.id)) })
		    ] })
		  ] });
		}
		function RepoSection(props) {
		  const { t } = props;
		  const state = props.useRepo((snapshot) => snapshot);
		  const language = props.useLocale((snapshot) => snapshot.active);
		  import_react.default.useEffect(() => {
		    props.ensure();
		  }, [props.ensure]);
		  const { query, categories, listing } = state;
		  const categoryMap = import_react.default.useMemo(
		    () => new Map(categories.map((c) => [c.id, categoryTitle(c, language)])),
		    [categories, language]
		  );
		  const busy = state.status === "loading";
		  const sortLabels = { votes: t("sortVotes"), stars: t("sortStars"), updated: t("sortUpdated"), score: t("sortScore") };
		  const viewLabels = { browse: t("viewBrowse"), installed: t("viewInstalled"), categories: t("viewCategories") };
		  let body = null;
		  if (state.view === "installed") {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      InstalledView,
		      {
		        state,
		        t,
		        language,
		        categories,
		        onRefresh: props.refreshBundles,
		        onToggle: props.toggleBundle,
		        onRemove: props.removeBundle,
		        onOpenEntry: props.openEntryByRepoId
		      }
		    );
		  } else if (state.view === "categories") {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      CategoriesView,
		      {
		        state,
		        t,
		        language,
		        onEditNew: props.editNewCategory,
		        onAdd: props.addCategory,
		        onRemove: props.removeCategory,
		        onOpenMembers: props.openCategoryMembers,
		        onMoveOut: props.moveOutOfCategory,
		        onOpenEntry: props.openEntryByRepoId
		      }
		    );
		  } else if (state.detailStatus === "loading") {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("loading") });
		  } else if (state.detail) {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      EntryDetail,
		      {
		        detail: state.detail,
		        categories,
		        t,
		        language,
		        onBack: props.closeEntry,
		        onRate: props.submitRating,
		        onUnrate: props.removeRating,
		        rateError: state.rateError,
		        rateBusy: state.rateBusy,
		        onInstall: props.installSpec,
		        onAddLabel: props.addLabel,
		        onRemoveLabel: props.removeLabel,
		        onSetLocalCategory: props.setLocalCategory,
		        labelDraft: state.labelDraft,
		        onEditLabelDraft: props.editLabelDraft,
		        pmBusy: state.pmBusy
		      }
		    );
		  } else if (state.status === "idle" || state.status === "loading") {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("loading") });
		  } else if (state.status === "error") {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { role: "alert", style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "error" }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: mutedStyle, children: [
		        t("errorPrefix"),
		        ": ",
		        state.error?.code ?? "unknown"
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: props.retry, children: t("retry") })
		    ] });
		  } else if (!listing || listing.items.length === 0) {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("noMatches") });
		  } else {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: cardsStyle, "aria-busy": busy, children: listing.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		        EntryCard,
		        {
		          item,
		          categoryName: categoryMap.get(item.localCategoryId || item.categoryId) ?? "",
		          t,
		          onOpen: () => props.openEntry(item.id)
		        },
		        item.id
		      )) }),
		      listing.hasMore ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", disabled: busy, onClick: props.more, children: t("showMore") }) : null
		    ] });
		  }
		  const pmBar = state.pmResult ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: resultBarStyle(state.pmResult.application === "failed"), role: "status", children: [
		    state.pmResult.action,
		    " \u2192 ",
		    state.pmResult.target,
		    "\uFF1A",
		    state.pmResult.application,
		    state.pmResult.application === "failed" && state.pmResult.diagnostic ? `\uFF08${state.pmResult.diagnostic}\uFF09` : ""
		  ] }) : null;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: sectionStyle, "data-plugin-tab": "repo", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: categoriesStyle, role: "group", "aria-label": "view", children: Object.entries(viewLabels).map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Pill, { active: state.view === key, "aria-pressed": state.view === key, onClick: () => props.setView(key), children: label }, key)) }),
		    pmBar,
		    state.view === "browse" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: toolbarStyle, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Input,
		          {
		            type: "search",
		            icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 }),
		            value: query.text,
		            placeholder: t("searchPlaceholder"),
		            "aria-label": t("searchPlaceholder"),
		            style: { flex: 1, minWidth: 220 },
		            onChange: (event) => props.editQuery({ text: event.target.value }),
		            onBlur: props.submitSearch
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          "select",
		          {
		            "aria-label": sortLabels[query.sort],
		            value: query.sort,
		            onChange: (event) => props.pickSort(event.target.value),
		            style: { fontSize: 12 },
		            children: Object.entries(sortLabels).map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: key, children: label }, key))
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Button,
		          {
		            variant: "ghost",
		            size: "sm",
		            "aria-label": t("refresh"),
		            disabled: busy,
		            onClick: props.refresh,
		            icon: busy ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
		          }
		        )
		      ] }),
		      categories.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: categoriesStyle, role: "group", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		          import_dsh_client_ui_primitives.Pill,
		          {
		            active: query.category === "",
		            "aria-pressed": query.category === "",
		            onClick: () => props.pickCategory(""),
		            children: t("allCategories")
		          }
		        ),
		        categories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		          import_dsh_client_ui_primitives.Pill,
		          {
		            active: query.category === c.id,
		            "aria-pressed": query.category === c.id,
		            onClick: () => props.pickCategory(c.id),
		            children: [
		              categoryTitle(c, language),
		              " (",
		              c.plugins,
		              ")"
		            ]
		          },
		          c.id
		        ))
		      ] })
		    ] }) : null,
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { flex: 1, minHeight: 0, overflowY: "auto" }, children: body })
		  ] });
		}
		function apply(ctx) {
		  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-plugin-repo: dictionaries");
		  const controller = new RepoController(ctx);
		  ctx.effect(() => () => controller.dispose(), "ui-plugin-repo: controller");
		  ctx.effect(() => {
		    const off = ctx.on("connection/reset", () => {
		      if (controller.state().status !== "idle") controller.reload();
		      if (controller.state().bundlesStatus !== "idle") void controller.loadBundles();
		    });
		    return off;
		  }, "ui-plugin-repo: connection reset");
		  ctx.effect(() => {
		    const off = ctx.remote.$on("plugin-manager/changed", () => {
		      if (controller.state().bundlesStatus === "ready") void controller.loadBundles();
		    });
		    return off;
		  }, "ui-plugin-repo: plugin-manager changed");
		  const face = controller.face((text) => ctx.locale.resolveText(text));
		  const t = ctx.locale.bind(NS);
		  ctx.slots.inject("plugins.tab", () => ctx.slots.register({
		    name: "plugins.tab",
		    id: "repo",
		    label: () => t("title"),
		    locale: NS,
		    inject: () => face
		  }, RepoSection));
		}
		
		return module.exports;
	}
});
