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
		var inject = ["slots", "locale", "connection"];
		var PAGE_SIZE = 24;
		var zh = {
		  title: "\u4ED3\u5E93",
		  searchPlaceholder: "\u641C\u7D22\u63D2\u4EF6\u540D\u79F0 / npm \u5305\u540D / \u7B80\u4ECB",
		  allCategories: "\u5168\u90E8\u5206\u7C7B",
		  sortVotes: "\u5171\u8BC6\u7968\u6392\u5E8F",
		  sortStars: "Star \u6392\u5E8F",
		  sortUpdated: "\u6700\u8FD1\u66F4\u65B0",
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
		  eventsTitle: "\u6700\u8FD1\u4E8B\u4EF6",
		  installTitle: "\u5B89\u88C5",
		  installSpecLabel: "\u5B89\u88C5 spec",
		  copySpec: "\u590D\u5236 spec",
		  copied: "\u5DF2\u590D\u5236",
		  installHint: "V0 \u4E0D\u76F4\u63A5\u5B89\u88C5\uFF1A\u590D\u5236 spec \u540E\u5230\u300C\u5DF2\u5B89\u88C5\u300D\u9875\u8D70 plugin_manager \u5BA1\u6279\u94FE\u5B89\u88C5",
		  snapshotNote: "\u6570\u636E\u6765\u81EA\u672C\u5730\u955C\u50CF\u5FEB\u7167\uFF08\u79BB\u7EBF\u53EF\u8BFB\uFF09",
		  errorPrefix: "\u8C03\u7528\u5931\u8D25"
		};
		var en = {
		  title: "Repository",
		  searchPlaceholder: "Search plugin name / npm package / description",
		  allCategories: "All categories",
		  sortVotes: "Sort by consensus votes",
		  sortStars: "Sort by stars",
		  sortUpdated: "Recently updated",
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
		  eventsTitle: "Recent events",
		  installTitle: "Install",
		  installSpecLabel: "Install spec",
		  copySpec: "Copy spec",
		  copied: "Copied",
		  installHint: "V0 does not install directly: copy the spec and install via the Installed tab (plugin_manager keeps its approval)",
		  snapshotNote: "Data comes from the local mirror snapshot (readable offline)",
		  errorPrefix: "Call failed"
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
		  // entry() 结果（含 plugin/ratingSummary/recentEvents）
		  detailStatus: "idle"
		  // idle | loading | error
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
		        void this.loadEntry(id);
		      },
		      closeEntry: () => {
		        if (!this.disposed) this.patch({ detail: null, detailStatus: "idle" });
		      }
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
		  async loadEntry(id) {
		    this.patch({ detailStatus: "loading", detail: null });
		    const answer = await this.call("entry", { id });
		    if (this.disposed) return;
		    if (!answer.ok || !answer.value?.found) {
		      this.patch({ detailStatus: "error" });
		      return;
		    }
		    this.patch({ detail: answer.value, detailStatus: "ready" });
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
		function categoryTitle(c, language) {
		  const zhActive = language === "zh";
		  return zhActive ? c.titleZh || c.titleEn || c.id : c.titleEn || c.titleZh || c.id;
		}
		function formatWhen(text, t) {
		  if (!text) return "";
		  return text.replace("T", " ").slice(0, 16);
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
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { children: [
		        "\u2605 ",
		        item.stars
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_dsh_client_ui_primitives.Tag, { children: [
		        item.consensusVotes,
		        " ",
		        t("votes")
		      ] }),
		      item.status !== "active" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: item.status }) : null
		    ] })
		  ] }) });
		}
		function EntryDetail({ detail, categories, t, language, onBack }) {
		  const p = detail.plugin;
		  const [copied, setCopied] = import_react.default.useState(false);
		  const category = categories.find((c) => c.id === p.categoryId);
		  const copy = async () => {
		    try {
		      await navigator.clipboard.writeText(detail.install.spec);
		      setCopied(true);
		      setTimeout(() => setCopied(false), 1500);
		    } catch {
		    }
		  };
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
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: category ? categoryTitle(category, language) : p.categoryId || "\u2014" }),
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
		      detail.ratingSummary ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("ratingAverage").replace("{count}", String(detail.ratingSummary.count)).replace("{average}", String(detail.ratingSummary.average)) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: t("ratingNone") })
		    ] }),
		    Array.isArray(p.npmVersions) && p.npmVersions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("versionsTitle") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: cardMetaStyle, children: p.npmVersions.slice(0, 6).map((v) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { children: v.ver }, v.ver)) })
		    ] }) : null,
		    Array.isArray(detail.recentEvents) && detail.recentEvents.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("eventsTitle") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: eventListStyle, children: detail.recentEvents.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { style: cardMetaStyle, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "ongoing" }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: e.kind }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: mutedStyle, children: formatWhen(e.at) })
		      ] }, i)) })
		    ] }) : null,
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...mutedStyle, marginBottom: 4 }, children: t("installSpecLabel") }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: specRowStyle, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { style: codeStyle, children: detail.install.spec }),
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: copy, children: copied ? t("copied") : t("copySpec") })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("installHint") })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("snapshotNote") })
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
		  const sortLabels = { votes: t("sortVotes"), stars: t("sortStars"), updated: t("sortUpdated") };
		  let body = null;
		  if (state.detailStatus === "loading") {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: mutedStyle, children: t("loading") });
		  } else if (state.detail) {
		    body = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      EntryDetail,
		      {
		        detail: state.detail,
		        categories,
		        t,
		        language,
		        onBack: props.closeEntry
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
		          categoryName: categoryMap.get(item.categoryId) ?? "",
		          t,
		          onOpen: () => props.openEntry(item.id)
		        },
		        item.id
		      )) }),
		      listing.hasMore ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", disabled: busy, onClick: props.more, children: t("showMore") }) : null
		    ] });
		  }
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: sectionStyle, "data-plugin-tab": "repo", children: [
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
		    ] }),
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
		    });
		    return off;
		  }, "ui-plugin-repo: connection reset");
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
