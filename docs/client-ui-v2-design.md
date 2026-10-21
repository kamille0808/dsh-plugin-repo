# dsh-plugin-repo V2 设计方案：已安装管理增强 + 分类与 labels 管理

> 版本：v1（2026-10-21）
> 前置：[client-ui-design.md](client-ui-design.md)、[client-ui-v1-design.md](client-ui-v1-design.md)（机制不变，V2 是其上的视图扩展）
> 计划：[client-ui-v2-dev-plan.md](client-ui-v2-dev-plan.md)

---

## 1. 范围与设计决策

| 决策点 | 结论 | 理由 |
| --- | --- | --- |
| 视图结构 | 「仓库」标签内加子视图切换：**浏览仓库 / 已安装 / 分类管理** | 官方插件页已有「已安装」标签，我们的价值是叠加仓库元数据；自包含在一个标签内，不抢官方页面结构 |
| 已安装数据 | 客户端直调 **`remote.pluginManager`**（listBundles / installBundle / removeBundle / setBundleEnabled / waitForInstall / cancelInstall，均已核实存在） | 零宿主成本；审批链、安装日志、失败回滚全部复用官方 |
| 镜像关联 | 按 npm 包名 join（bundle.name ↔ 镜像 p.npm）；无 npm 名的按 installSpec 含名兜底 | bundle 名即包名 |
| 分类/labels | **本地私有**（不进 PG）：自定义分类 `local-` 前缀；插件记录加 `localCategoryId` 覆盖字段 | 契约既定（§5 categories 覆盖豁免、§7）；DSH 域 schema 加字段带 default，域版本不变 |
| 安装入口 | 详情页「安装」按钮 → `remote.pluginManager.installBundle(spec)`（V0 的「复制 spec」保留为降级） | GUI 为 owner 主体，与官方插件页同权；审批语义不变 |

## 2. 宿主侧改动（lib/index.js，增量小）

### 2.1 镜像模型

- `pluginRecord` 新增 `localCategoryId: zod.string().default('')`（本地分类覆盖；为空 = 用 PG 的 categoryId）。域版本仍为 1（schema 全字段带 default，旧记录兼容）。
- 生效分类口径：`effectiveCategoryId = localCategoryId || categoryId`，仅消费侧使用；同步写回镜像时**保留** localCategoryId（与 labels 同等地位）。

### 2.2 `PluginRepoRemote` 新增方法（全部本地域操作，不碰 PG）

| 方法 | 入参 | 语义 |
| --- | --- | --- |
| `setLabels(id, labels)` | id 字符串、labels 字符串数组（≤8 个，每个 ≤24 字，去重去空白） | 写镜像 labels |
| `setLocalCategory(id, categoryId)` | categoryId 须为已存在的 `local-` 分类或 `''`（清除覆盖） | 写镜像 localCategoryId |
| `addCategory(titleZh, titleEn)` | 标题非空 ≤30 字 | 生成 `local-<slug>` 分类（builtin=false），重名报错 |
| `removeCategory(id)` | 仅 `local-` 前缀 | 删除分类并清空各插件对它的 localCategoryId 引用 |

统一返回 `{ ok: true }` 或 `{ ok: false, error: { code } }`（与 rate/unrate 同风格）；写后 `ctx.emit('plugin-repo/local-changed', { kind })` 供客户端刷新。

### 2.3 既有方法的口径升级

- `search`：category 过滤改按 effectiveCategoryId 匹配（`localCategoryId || categoryId`）；返回项加 `labels` / `localCategoryId`；
- `categories`：返回含本地分类，计数按生效口径；
- `entry`：返回 `labels` / `localCategoryId`（镜像记录自带，无需额外工作）。

## 3. 客户端改动（src/client/index.jsx）

### 3.1 子视图切换

仓库标签顶部加 segmented 切换（三个 Pill）：**浏览仓库**（V0/V1 现有）/ **已安装** / **分类管理**。状态进 store：`view: 'browse' | 'installed' | 'categories'`。

### 3.2 已安装视图

- 数据：`ctx.remote.pluginManager.listBundles()` + 镜像 join（npm 名）；
- 行项：名称、版本、启用状态、（镜像命中时）客观分/评分/分类/简介；
- 动作：启用/禁用（`setBundleEnabled`）、移除（`removeBundle`，二次确认）；操作后订阅 `plugin-manager/changed` 刷新；
- 未命中镜像的 bundle 正常显示（标注「不在仓库镜像」）。

### 3.3 分类管理视图

- 列表：内置 23 个（只读）+ 本地自定义（可删）；「新增分类」输入框（中文名必填、英文名可选）；
- 点分类 → 该分类下插件列表（含把插件移入/移出：调 `setLocalCategory`）。

### 3.4 浏览/详情的增量

- 详情抽屉加 **labels 编辑器**（逗号分隔输入或加号添加小标签）与 **本地分类下拉**（可选 local- 分类或「跟随中心库」）；
- 详情页「安装」按钮：`remote.pluginManager.installBundle(spec)`，结果页内展示（成功/失败/restart-required）；V0 的复制 spec 保留；
- 卡片显示 labels（最多 3 个）。

## 4. 安全与边界

- 安装/删除/启停一律 `remote.pluginManager`（owner 主体的 GUI 调用，与官方插件页同链路；版本兼容检查、失败回滚、install-log 全部由官方承担）；
- 本地分类/labels 只进本机 storageDomain，不同步、不进 PG、不进导出物（契约 §3.3 既定）；
- `local-` 前缀是自定义分类的命名空间约定，防止与上游 builtin 分类 id 冲突；
- 无 PG schema 变更、无契约变更。

## 5. 验收标准

1. 「已安装」子视图列出本 profile 的 bundle，叠加显示镜像的分类/评分；启用/禁用/移除操作生效且页面状态同步；
2. 详情页可直接安装插件（走 pluginManager，install-log 可见），失败有明确错误展示；
3. 新建本地分类「本地-试用」→ 把某插件移入 → 浏览视图按该分类过滤命中；删除分类后插件回退中心库分类；
4. labels 增删在详情页生效且重启后保留（本地域持久化）；
5. 回归基线四项（V1 设计文档 §5）全过。
