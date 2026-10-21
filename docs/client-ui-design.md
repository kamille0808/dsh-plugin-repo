# dsh-plugin-repo 可视化管理（客户端 UI）设计方案

> 版本：v1（2026-10-21）
> 前置文档：[../dsh-plugin-repo-design.md](../dsh-plugin-repo-design.md)（总体方案 §2 出口 2）、[../contract/CONTRACT.md](../contract/CONTRACT.md)（数据契约 v0.1）
> 开发计划：[client-ui-dev-plan.md](client-ui-dev-plan.md)
> 可行性依据：官方客户端插件实装源码（`dsh-client-ui-plugin-market` / `dsh-client-ui-plugin-manager`）+ Gateway/Typert 源码调研（加载级实验 10/10 通过）

---

## 1. 目标与范围

把当前「只能通过对话调用 `plugin_repo` 工具」的能力，做成桌面 GUI 里的可视化管理界面。

**V0 范围**：插件页新增「仓库」标签，提供目录浏览 / 关键词搜索 / 插件详情（只读）。
**后续**：评分录入与展示（V1）、已安装管理与分类管理（V2）。

**非目标**：不做发现器 UI（发现器独立运行，其状态经 `harvester_state` 只读展示）；不重造插件管理页（复用 `remote.pluginManager`）。

## 2. 总体结构：一个 bundle，宿主/浏览器两半

```text
dsh-plugin-repo/
├─ package.json          # + dsh.client 声明 + exports["./client"] + files 加 lib/client.js
├─ cordis.patch.yml      # 不变：仅现有 plugin-repo（宿主半边）行；client 半边经
│                        #   package.json dsh.client 声明由 client-modules 自动发现
├─ lib/index.js          # 宿主半边（现有）：storageDomain 镜像 + 同步 + plugin_repo 工具
│                        #   新增：PluginRepoRemote 服务（SRC fallback Remote 命名空间）
├─ lib/client.js         # 客户端半边（新增，esbuild 产物）：「仓库」标签页
├─ src/client/           # 客户端源码（JSX，esbuild 输入）
├─ build.mjs             # esbuild 编译 + Lazy-CJS 包装（~40 行）
└─ locale/*.json         # 现有 meta；客户端词典内置于 client bundle
```

运行关系：

```text
浏览器（desktop GUI）
  ui-plugin-repo（dsh.client 插件，Lazy-CJS）
    ├─ ctx.slots.register → 插件页「仓库」标签
    ├─ ctx.remote.pluginRepo.*  ────────────┐
    │   （或 ctx.connection.rpc.call 动态版） │
    └─ remote.pluginManager.*（官方现成）──┐ │
                                          ▼ ▼
宿主（desktop profile）               PluginRepoRemote（cordis Service）
  plugin-repo（现有）                   └─ 读 storageDomain 镜像 / 写 ratings
```

## 3. 入口设计：`plugins.tab` 槽位

**选择**：插件页「仓库」标签，与「已安装」「发现」并列。

```js
// 机制与官方 Discover 页完全一致（样例：dsh-client-ui-plugin-market/lib/client.js:1622）
ctx.slots.inject('plugins.tab', () => ctx.slots.register({
  name: 'plugins.tab',
  id: 'repo',
  label: () => t('title'),     // locale 词典
  locale: NS,
  inject: () => face,          // 控制器暴露的状态源与动作
}, RepoSection))               // React 组件
```

- 备选：`sidebar.panellist`（左侧边栏独立面板，与文件/终端同级）。入口更醒目但脱离插件管理语境，作为后续升级项，V0 不做。
- 客户端词典经 `ctx.locale.register(NS, { zh, en })` 注册，`ctx.locale.bind(NS)` 取文案。

**package.json 增量**：

```jsonc
{
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",          // 新增
    "./package.json": "./package.json",
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./locale/*.json": "./locale/*.json"
  },
  "dsh": {
    "manifestVersion": 1,
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {                              // 新增
      "platform": "web",
      "inject": [                            // 客户端 inject 写包名（客户端服务提供者）
        "@deepseek-ai/dsh-api-remotes",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-plugin-manager"
      ]
    }
  }
}
```

**cordis.patch.yml 无增量**（v1 修正，2026-10-21 源码复核）：

官方全部 patch 中不存在 `/client` 行；patch insert 行会被宿主 cordis loader 作为 Node 插件 import，若插入 `name: dsh-plugin-repo/client`，宿主将在 Node 执行浏览器 bundle（顶层 `window.__ModuleLoader__`）导致激活失败。正确机制：**现有行 `plugin-repo`（name: dsh-plugin-repo）即足够**——`dsh-client-modules` 的 `processOne` 按 loader 行 `options.name` 定位包，`resolveMeta` 读到 `dsh.client` 声明后自动把 client 半边编入 `__DSH_BOOT__` 图并经 `/plugins/<id>/client.js` 提供。官方双面包（如 `dsh-client-connection` 行）均为此形态：行指向包本身，node half 在宿主运行，browser half 仅进模块表。

## 4. 数据桥设计（核心）

### 4.1 宿主侧：`pluginRepo` Remote 命名空间（SRC fallback）

Host Gateway 有两级 Remote 发现：strict 注册（generator artifact）之外，还有**官方保留的 SRC fallback**——直接扫描 cordis 服务实例的 `typertRemote` 绑定 + 类原型方法描述符，以 `src-json` codec（仅无损 JSON 校验）动态构建 endpoint。dsh-typert-loader 注释明确允许 "hand-written wire schemas"（dsh-typert-loader/lib/index.js:27-29）。

```js
// lib/index.js 内新增（零新增依赖）
import { Service } from '@deepseek-ai/cordis'

const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'

class PluginRepoRemote extends Service {
  constructor(ctx) {
    super(ctx, 'pluginRepo')
    // 等价于 bindTypertRemote(this, 'pluginRepo')；service 必须是未包装实例
    this.typertRemote = Object.freeze({ service: this, serviceKey: 'pluginRepo', namespace: 'pluginRepo' })
  }
  // 注意：参数只能是普通标识符（SRC 用源码解析参数名），禁止解构/默认值/rest；
  // 入参只做 JSON 安全检查，业务校验在方法内自行完成；返回值须 JSON-safe
  async search(text, category, limit, offset, sort) { /* 读 plugins 镜像，复用工具同逻辑；sort: votes|stars|updated */ }
  async entry(id) { /* 详情 + 评分摘要 + 最近事件 */ }
  async categories() { /* 分类 + 计数 */ }
  async updates(limit) { /* 事件流 */ }
  // V1：async rate(id, score, note) { /* SET app.scored_by 后 upsert 本人行 */ }
}
Object.defineProperty(PluginRepoRemote.prototype, REMOTE_METHOD_DESCRIPTOR, {
  configurable: true,
  value: Object.freeze({ version: 1, methods: Object.freeze(
    ['search', 'entry', 'categories', 'updates']
      .map((m) => Object.freeze({ method: m, invocation: Object.freeze({ kind: 'direct' }) })),
  ) }),
})

// apply() 末尾：ctx.plugin(PluginRepoRemote)
```

必填字段：`typertRemote {service, serviceKey, namespace}` + 原型描述符 `{version:1, methods:[{method, invocation:{kind:'direct'}}]}`。
与官方命名空间撞名检查：`pluginRepo` 无冲突；同名 endpoint 多服务会报 `gateway/ambiguous-endpoint`。

### 4.2 客户端侧：两种调用方式

**方式 A（推荐 V0）：免挂载动态调用**——`inject = ['connection']`，零描述符：

```js
const answer = await ctx.connection.rpc.call('/api', 'pluginRepo/search', {
  args: { text, category, limit, offset },
})
// answer: { ok: true, value } | { ok: false, error: RemoteError }
```

**方式 B（V1 备选）：手写 contribution 挂载命名空间**——`await ctx.remote.$mount(contribution)` 后用 `ctx.remote.pluginRepo.*`。注意：codec 须 `mode:'strict'` + 全局唯一 `typeSymbol` + `create` 函数（调用链上不执行，给 `() => ({parse: v => v})`）；客户端 inject 只写 `'remote'`，**不写** `'remote.pluginRepo'`（服务由自己 $mount 创建，写了会死锁）。

返回约定：`RemoteResult = { ok:true, value } | { ok:false, error }`，业务失败不 throw。

**保底方案**：若 SRC fallback 端到端不通，宿主经 `webServer.register({kind:'exact', path, handler})` 注册 HTTP 端点（已确认该 API 存在，dsh-host-webserver/lib/index.js:326-333），客户端 `fetch` 同源调用。

### 4.3 已安装管理（V2，零宿主成本）

复用官方现成命名空间 **`remote.pluginManager`**（listBundles / installBundle / 启停 / inspect / install-log 事件），官方插件管理页同款数据源；叠加我们镜像里的分类/评分/简介做增强视图。客户端 inject 加 `@deepseek-ai/dsh-client-ui-plugin-manager`。

## 5. 客户端构建设计

- **模块协议（Lazy-CJS）**：`window.__ModuleLoader__.load({ id, factory: (require) => { …; return module.exports } })`；执行 bundle 只注册工厂，首次物化才运行模块体。
- **基线共享模块**（直接 `require`，无需打包）：`react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives`（官方 UI 原语）、`@deepseek-ai/dsh-client-store`（快照 store）。非基线请求才需声明 `dsh.client.external`——V0 不需要。
- **构建链**：`build.mjs`（esbuild 一点依赖）：
  1. `esbuild src/client/index.jsx --bundle --format=cjs --external:react --external:react/* --external:@deepseek-ai/*`；
  2. 产物头部/尾部包一层 `window.__ModuleLoader__.load({id: 'dsh-plugin-repo/client', factory: (require) => { … } })`；
  3. 输出 `lib/client.js`；CSS 用官方原语组件 + 内联样式，V0 不引入 CSS 管线。
- **HMR 注意**：client-plugin 改动要热载，需要本 checkout 跑 `pnpm run dev:web` 重建 bundle（DSH 官方约束）；否则改完重启 App 生效。
- **宿主/客户端版本同步**：`window.__DSH_BOOT__` 的 release 校验要求客户端 bundle 与宿主同 release；我们 bundle 由同一包提供，天然一致。

## 6. UI 设计（V0 → V2）

### V0：「仓库」标签（只读浏览）

```text
┌───────────────────────────────────────────────────────────┐
│ [搜索框____________] [分类▾] [排序▾共识票/star/更新]       │
├───────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐                │
│ │ 插件卡片    │ │ 插件卡片    │ │ 插件卡片    │  …（分页/加载更多）│
│ │ 名称/简介  │ │           │ │           │                │
│ │ 分类·★·票  │ │           │ │           │                │
│ └───────────┘ └───────────┘ └───────────┘                │
├───────────────────────────────────────────────────────────┤
│ 详情抽屉：简介(中/英) · 安装spec(复制) · 版本 · 最近事件    │
└───────────────────────────────────────────────────────────┘
```

- 状态：store 快照（query / listing / detail / sync 状态），控制器模式照搬官方 DiscoverController；
- 数据：`pluginRepo.search / entry / categories`；卡片含名称、简介、分类、共识票、star（标注快照口径）、状态；
- 「安装」按钮：只生成 spec 提示走 plugin_manager（V0 不直接调安装，保留审批链语义清晰）。

### V1：评分与事件

- 详情页加人工评分（1–5 星 + 短评）：宿主 `rate(id, score, note)` Remote 方法，`SET app.scored_by` 后 upsert 本人行（RLS）；离线回退本地队列；
- 客观分按可配权重即时计算并展示，标注「自动计算，非安全审计结论」；
- 详情页加更新事件时间线（`pluginRepo.updates`）。

### V2：已安装管理与分类

- 「已安装」增强视图：`remote.pluginManager.listBundles()` 叠加镜像的分类/评分/简介；安装/删除/启停走 `remote.pluginManager`（保留其审批）；
- 自定义分类与 labels 管理（本地私有，`local-` 前缀，不进 PG）。

## 7. 配置与安全

- 客户端零配置；宿主沿用现有 `databaseUrl / scoredBy / syncIntervalSeconds / syncBatchSize / githubToken`；
- Remote 方法全部为只读（V0）或本人行写入（V1 rate）；不暴露 PG 连接串与任何凭据；
- 入口权限：Remote 调用来自本机 GUI（owner principal），无跨用户面；`rate` 的 RLS 在 PG 侧兜底；
- 导出卫生：UI 只展示镜像公共字段 + 本人评分；labels/自定义分类标「本机私有」。

## 8. 风险与对策

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| SRC fallback 未做真实桌面端到端验证（加载级已验证） | 中 | V0 第一步落宿主半边，浏览器 `POST /api/pluginRepo/search` 冒烟；不通则退 `webServer.register` 保底方案（已确认 API） |
| SRC 无 zod 校验 | 低 | 方法内手写入参校验（类型/范围/limit 上限） |
| 手写 contribution（方式 B）字段校验严格 | 低 | V0 用方式 A（connection.rpc 动态调用）绕开 |
| Lazy-CJS 手写/包装出错导致客户端行激活失败 | 低 | 构建脚本对产物做协议自测（node 侧模拟 `__ModuleLoader__` 执行工厂） |
| 官方槽位/模块协议在后续 DSH 版本变更 | 中 | `engines.dsh` 声明兼容范围；升级时对照官方 plugin-market 客户端源码复核 |
| 桌面 profile 组合归 Electron 独占（`--dump-config` 不可用） | 低 | 沿用隔离 DSH_HOME 试启动法做端到端验证 |

## 9. 与设计总案的关系

本文档是 [../dsh-plugin-repo-design.md](../dsh-plugin-repo-design.md) **M4 的「客户端 UI 四视图」的落地设计**；数据流不变（PG 权威 → 镜像 → 消费），UI 只是镜像与 `remote.pluginManager` 之上的展示层。发现器（组件①）不在本文范围。
