# dsh-plugin-repo V1 设计方案：评分录入与展示 + 更新事件视图

> 版本：v1（2026-10-21）
> 前置：[client-ui-design.md](client-ui-design.md)（V0 架构，机制不变）、[../contract/CONTRACT.md](../contract/CONTRACT.md) §7（评分协议）
> 范围：V1 = 人工评分录入（写 PG，RLS 本人行）+ 客观分展示 + 更新事件时间线。V0 的浏览/搜索/详情已上线。

---

## 1. 设计决策一览

| 决策点 | 结论 | 理由 |
| --- | --- | --- |
| 评分写路径 | 新增宿主 Remote 方法 `rate(id, score, note)`，走 V0 已验证的 SRC fallback | 与 search/entry 同通道，无新机制风险 |
| RLS 身份 | `rate` 内 `BEGIN; set_config('app.scored_by', config.scoredBy, true); upsert; COMMIT` | 契约 §7 既定；RLS fail-closed 兜底 |
| 离线评分 | PG 不可达时 `rate` 落本地 `ratings` 表（`synced=false`），下一轮 sync 补写 | V0 同步循环已有 pending 补写机制，直接复用 |
| 客观分 | 展示时对镜像信号即时计算，权重进插件 config | 契约 §7：PG 只存信号不存分；各主机口味可调 |
| 事件视图 | 详情抽屉内加时间线（entry 已返回 recentEvents），无新 Remote 方法 | V0 数据面已够 |
| PG schema | **minor 迁移 0002**（实施时发现 0001 只授 INSERT/UPDATE、无 DELETE 策略，`unrate` 需 `GRANT DELETE` + `ratings_delete_own`，契约升 v0.2） | 契约 §9 minor 流程；RLS 仍限本人行 |

## 2. 宿主侧改动（lib/index.js）

### 2.1 `PluginRepoRemote` 新增方法

```js
// 参数为普通标识符（SRC 约束）；score 1-5，note ≤500 字；返回 JSON-safe
async rate(id, score, note) // → { ok: true, rating } | { ok: false, error }
async unrate(id)            // 删除本人评分（本地镜像删除 + PG DELETE 本人行）
```

`rate` 流程：
1. 入参校验：`id` 存在于镜像、`score` 为 1–5 整数、`note` 去空白 ≤500；
2. 写本地镜像 `ratings`（key `sk(id|scoredBy)`，`synced=false`，`scoredAt=now`）——**本地先行**，UI 立即生效；
3. PG 在线时同事务 `set_config + upsert`，成功把镜像行标 `synced=true`；离线/失败保持 `synced=false`，由 sync 循环补写（V0 已有）；
4. 写后emit事件供客户端刷新（见 2.3）。

`unrate`：本地删除 + PG `DELETE WHERE plugin_id AND scored_by`（RLS 同样限本人行）。

### 2.2 客观分计算（宿主侧纯函数，Remote 与工具共用）

```js
// scoreOf(plugin, weights) → 0-100
// 默认权重（契约 §7）：共识票 30 / 维护活跃度 25 / star 分位 20 / 源码验证 15 / 图标文档 10
```

- **star 分位**：对当前镜像全量 stars 排序取该插件分位（启动时算一次缓存 + 同步后失效重算；6084 条排序是毫秒级）；
- **维护活跃度**：`lastPushAt` / 最新 npm 版本时间距今天数分段（30 天内满分 → 365 天线性衰减 → 之后 0）；
- **源码验证标记**：`sources` 含 `walkinglabs` 计 1（契约 §3：该源带源码级验证）；
- **图标文档**：V1 暂以「desc 非空」近似（图标字段待发现器补齐），注释注明口径；
- 权重配置：插件 config 新增 `scoreWeights`（对象，五字段各 0–1，默认上表；和不为 1 时归一化）。

### 2.3 变更通知

- `rate/unrate` 后 `ctx.emit('plugin-repo/rating-changed', { id })`；客户端 `ctx.remote.$on`（或 connection 事件）订阅刷新详情；
- 同步循环完成时 emit `plugin-repo/synced`（含 pulled 计数），UI 顶部同步时间戳据此刷新。

## 3. 客户端改动（src/client/）

### 3.1 详情抽屉：评分区

```text
┌ 详情抽屉 ──────────────────────────────┐
│ …（V0 已有：简介/spec/版本/事件）        │
│ ── 评分 ────────────────────────────── │
│ 客观分  78  ▓▓▓▓▓▓▓▓░░ （自动计算，非安全审计结论）│
│ 大家评分 ★★★★☆ 4.3（3 人）              │
│ 我的评分 [★][★][★][★][☆]  [短评输入框]  │
│          [保存]（离线时提示"已存本地，待同步"） │
└─────────────────────────────────────────┘
```

- 星级输入：5 按钮即可，不引第三方组件；hover 预览、点击选定；
- 保存：`rpc.call('/api', 'pluginRepo/rate', {args:{id, score, note}})`；`ok:false` 时按 `error.code` 提示（RLS 拒绝 = scoredBy 未配置 → 引导去插件配置）；
- 离线反馈：`value.synced === false` 时显示「已存本地，待同步」徽标。

### 3.2 详情抽屉：事件时间线

- `entry` 返回的 `recentEvents` 渲染为竖向时间线（kind → 图标/颜色映射：new-plugin 🆕、update-available ⬆️、renamed ✏️、archived 📦、removed-from-list 🚫）；
- 事件为空时显示「暂无动态」。

### 3.3 列表卡片微改

- 卡片角标加客观分（圆环或小数字），排序下拉加「客观分」选项；
- 共识票/star 标注口径（star 快照日期悬浮提示）。

## 4. 安全与边界

- `rate/unrate` 只写 `(plugin_id, scored_by=本人)` 行：RLS + GRANT 双保险；方法内再校验 `scoredBy === config.scoredBy`（防配置串号）；
- `scoredBy` 未配置时 `rate` 直接返回结构化错误 `plugin-repo/scored-by-required`，UI 引导填配置（不发起到 PG 的请求）；
- note 文本存 PG 前做长度截断与控制字符剔除；展示走 React 文本节点（天然防 XSS），不渲染 HTML；
- 客观分/均分固定标注「非安全审计结论」。

## 5. 回归基线（每阶段必过）

1. `plugin_repo` 工具五动作（新会话）正常；
2. 同步循环正常（镜像 6084，sync_state 游标推进）；
3. RLS 三验证（未设标识拒写 / 本人行可写 / 他人行不可写）；
4. 契约仅 minor 升 v0.2（0002：ratings DELETE 权限，见 §1 决策表）；RLS fail-closed 语义不变。
