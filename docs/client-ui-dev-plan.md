# dsh-plugin-repo 可视化管理 · 开发计划

> 版本：v1（2026-10-21）
> 设计方案：[client-ui-design.md](client-ui-design.md)（机制与取舍以它为准）
> 验证方法论：一切改动先在**隔离 DSH_HOME 试启动**环境端到端验证，再让用户重启主 App（2026-10-20 排障确立的流程）。

---

## 里程碑总览

| 阶段 | 目标 | 验收标准 | 预估 |
| --- | --- | --- | --- |
| **V0** | 插件页「仓库」标签：浏览/搜索/详情（只读） | 桌面 GUI 插件页出现「仓库」标签，搜索 memory 返回 266 条，详情正常 | ~1 天 |
| **V1** | 评分录入与展示 + 更新事件视图 | 详情页可打星/短评，PG ratings 表出现本人行（RLS 本人行），刷新后仍在 | ~0.5 天 |
| **V2** | 已安装管理增强视图 + 分类/labels 管理 | 已安装列表叠加分类/评分；安装走 pluginManager 审批链；自定义分类生效 | ~0.5 天 |

---

## V0 任务分解（含顺序依赖）

### T0-1 宿主 Remote 命名空间（先于一切，冒烟门禁）✅ 2026-10-21

- [x] `lib/index.js`：新增 `PluginRepoRemote` cordis Service（`typertRemote` 绑定 + 原型方法描述符），方法 `search/entry/categories/updates` 复用 `plugin_repo` 工具现有查询逻辑（doSearch 等共用，工具与 Remote 同源）；
- [x] 入参方法内校验（clampLimit 1–50、offset ≥0、sort 白名单 votes/stars/updated，非法回退共识票）；
- [x] **冒烟（门禁）通过**：隔离环境（DSH_HOME=/tmp/dsh-iso-home，profile 更名 iso 规避 desktop 独占）`POST /api/pluginRepo/search` 带 dsh-auth cookie，`{ok:true, value:{total:6084}}`（数据较计划编写时的 266 已增长；search/entry/categories/updates 四方法全部 ok:true）；
- 备注：无需保底方案，SRC fallback 端到端打通。

### T0-2 客户端构建链 ✅ 2026-10-21

- [x] `build.mjs`：esbuild bundle → CJS → Lazy-CJS 工厂协议 → `lib/client.js`；externals 恰为 4 个基线模块（react / react/jsx-runtime / @deepseek-ai/dsh-client-store / @deepseek-ai/dsh-client-ui-primitives，已核产物 require 清单）；
- [x] 构建自测：Node 模拟 `__ModuleLoader__` + Proxy 桩执行工厂，断言 `apply/inject`（每次构建自动跑）；
- [x] `package.json`：`exports["./client"]`、`files` 加 `lib/client.js`、`dsh.client` 声明（inject 列表照抄官方 plugin-market）；
- [x] cordis.patch.yml **未改**（v1 修正，见设计文档 §3）；实测隔离环境 boot 图 entries/batches 自动含 `dsh-plugin-repo`，`/plugins/??dsh-plugin-repo/client.js&rev=…` 200。

### T0-3 「仓库」标签页 UI ✅ 2026-10-21

- [x] `src/client/index.jsx`：RepoController（createSnapshotStore 快照）+ 搜索栏/分类 Pill/排序下拉/卡片网格/加载更多/详情视图；传输异常与 RemoteResult `ok:false` 均渲染错误态 + 重试；
- [x] 数据：`ctx.connection.rpc.call('/api','pluginRepo/<method>',{args})`；
- [x] 词典 zh/en 内置 bundle；`plugins.tab` 注册（id `repo`）；
- [x] 安装动作：详情展示 spec + 「复制 spec」+ 提示走 plugin_manager（V0 不直接安装）。
- 修复记录：初版 `this.reload` 误引用 face 局部属性导致槽位渲染崩溃（slot error boundary 吞错，经浏览器控制台定位），已改为类方法。

### T0-4 端到端验证 ✅（隔离环境）2026-10-21

- [x] 隔离环境：boot 图含 client 半边；插件页出现「仓库」标签；搜索（total 6084）/分类（23 个含计数）/详情/排序全链路可用（数据经宿主真实 RPC，浏览器渲染经 Tabbit 验证；CLI web 宿主的浏览器信任栅栏拒绝 Playwright 的 /connect 升级，故浏览器侧用 route 回放同一真实载荷完成渲染验证——真实桌面 App 无此环境限制）；
- [ ] 主 App：待用户 ⌘Q 重启后插件页验收（唯一未闭环项）；
- [x] 回归：宿主日志 0 错误；plugin_repo 工具五动作与 Remote 共用同一 doSearch/doEntry/doCategories/doUpdates（search 仅新增可选 sort 参数，默认行为不变），工具注册路径未动。

### V0 交付物

改动包（package.json / cordis.patch.yml / lib/index.js / lib/client.js / src/client/** / build.mjs）+ 验证记录（冒烟结果、隔离环境截图）。

---

## V1 任务分解

- [ ] 宿主 `rate(id, score, note)` Remote 方法：`SET app.scored_by`（config.scoredBy）后事务内 upsert `ratings` 本人行；写失败落本地队列（沿用同步的 pending 机制）；入参校验 score 1–5、note ≤500 字；
- [ ] 详情页评分组件：我的评分编辑 + 全员均分/分布（`pluginRepo.entry` 已返回摘要）；
- [ ] 客观分：镜像记录的信号字段 × 可配权重即时计算（权重进插件 config，默认 30/25/20/15/10），UI 标注口径与「非安全审计结论」；
- [ ] 详情页事件时间线（`pluginRepo.updates` 按插件过滤）；
- [ ] 验证：评分写入后 `SELECT * FROM ratings` 出现本人行；另一标识（改 scoredBy 重启）看不到可编辑态但能看到均分。

## V2 任务分解

- [ ] 「已安装」视图：`remote.pluginManager.listBundles()` 叠加镜像分类/评分/简介；安装/删除/启停按钮走 `remote.pluginManager`（保留其审批与 install-log 展示）；
- [ ] 分类管理：自定义分类（`local-` 前缀）与 labels 编辑，存本地域（不进 PG）；
- [ ] 验证：安装一个共识榜插件全链路（搜索→详情→安装→审批→出现在已安装增强视图）。

---

## 工程约束与检查点

1. **文件所有权**：本机独占写 `dsh-plugin-repo/`；契约变更（若涉及）先升 CONTRACT.md minor 再改代码；本轮预计**不涉及 PG schema 变更**。
2. **验证纪律**：每个 T 完成后跑 `node --check` + 构建自测；V0/V1/V2 各做一次隔离环境端到端；主 App 重启请用户执行。
3. **回归基线**：`plugin_repo` 工具五动作、PG 同步（6084 镜像）、RLS 三项验证脚本（/tmp 历史脚本模式）每阶段复跑。
4. **HMR 说明**：客户端 bundle 改动需重启 App 生效（除非本 checkout 跑 `pnpm run dev:web`，当前不满足）。
5. **风险登记**（设计文档 §8 同步维护）：SRC 端到端（T0-1 冒烟门禁兜底）、协议版本漂移（升级 DSH 时对照官方源码复核）。
