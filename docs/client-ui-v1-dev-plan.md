# dsh-plugin-repo V1 开发计划：评分录入与展示 + 更新事件视图

> 版本：v1（2026-10-21）
> 设计依据：[client-ui-v1-design.md](client-ui-v1-design.md)
> 方法论沿用 V0：一切改动先在**隔离 DSH_HOME 试启动**环境端到端验证，再请用户重启主 App。

---

## 里程碑

**V1 完成标志**：仓库页详情抽屉里能给插件打星 + 短评，写入 PG `ratings` 表本人行（RLS 生效）；断网时评分落本地队列、恢复后自动补写；列表与详情展示客观分（可配权重）；详情页有事件时间线。

## 任务分解（顺序依赖）

### T1-1 宿主：评分写路径（门禁任务）✅ 2026-10-21

- [x] `PluginRepoRemote` 增加 `rate(id, score, note)` / `unrate(id)`，描述符 methods 数组同步追加；
- [x] `rate` 实现：入参校验 → 本地镜像先行（`synced=false`）→ PG 事务 `set_config('app.scored_by') + upsert` → 成功标 `synced=true`；离线/失败留队列由 sync 补写（复用 V0 pending 机制）；note 控制字符剔除 + 截断 500；
- [x] `scoredBy` 未配置 → 返回 `{ ok:false, error:{code:'plugin-repo/scored-by-required'} }`（隔离环境 --patch 覆盖实测）；
- [x] `rate/unrate` 后 `ctx.emit('plugin-repo/rating-changed')`；sync 完成后 emit `plugin-repo/synced`；
- [x] **冒烟（门禁）通过**：隔离环境 rate 写入 → PG `SELECT` 本人行落库（score/note/scoredAt 一致，控制字符已剔除）；`invalid-score` / `not-found` 分支实测；断网（databaseUrl 改 5433）rate → 本地 `synced=false` 队列 → 恢复重启后首轮 sync 自动补写 PG，entry `myRating.synced=true`；
- ⚠️ `unrate` 的 PG DELETE 被 0001 的 GRANT/RLS 拒绝（只授 INSERT/UPDATE）：已新增 minor 迁移 `0002_ratings_delete_own.sql`（契约 v0.2），**dev 库由用户执行后复验**（本地删除与 PG DELETE 流程已实现，权限到位即生效）。

### T1-2 宿主：客观分 ✅ 2026-10-21

- [x] `scoreOf(plugin)` 纯函数 + star 分位缓存（`starOrder`，同步 pulled>0 后失效重算）；
- [x] config 新增 `scoreWeights`（五字段 0–1，默认 30/25/20/15/10，归一化）；README 配置表同步；
- [x] `search`/`entry` 返回值附 `objectiveScore` 与分项得分（隔离环境实测 sort=score / entry parts 正常）；
- 补充：镜像 `pluginRecord` 新增 `sources` 字段，sync 每轮全量聚合拉取 `plugin_sources`（6084 条全部带 sources，实测）；「源码验证」分项待发现器写入 walkinglabs 数据后才有非零值（dev 库当前 0 行）。

### T1-3 客户端：评分区 + 时间线 ✅ 2026-10-21

- [x] 详情抽屉评分区：客观分条（含「自动计算，非安全审计结论」标注）、均分/人数、我的星级输入（hover 预览）+ 短评 + 保存/删除；`ok:false` 按 code 给引导文案（scored-by-required → 引导填配置）；`synced=false` 显示「已存本地，待同步」徽标；
- [x] 事件时间线（`recentEvents`，kind → 图标映射 🆕⬆️✏️📦🚫，空态「暂无动态」）；
- [x] 列表卡片加客观分角标 + 排序加「客观分」；
- [x] 构建：`node build.mjs` 产物协议自测通过（`pnpm build` 因 esbuild 构建脚本审批被 pnpm 拦截，直跑 build.mjs 等效）；
- 备注：客户端未订阅 `$on` 事件，采用计划中的降级方案（操作后主动重拉详情）。

### T1-4 端到端验证与交付 🔶 2026-10-21

- [x] 隔离环境全流程：搜索 → 详情（客观分/时间线）→ 评分 → 刷新仍在（myRating+summary）→ PG 侧核验本人行 → 断网评分（synced=false）→ 恢复自动补写（PG 出现该行，synced=true）；
- [x] 回归基线：①工具五动作与 Remote 共用同一 doSearch/doEntry（新增字段向后兼容）；②同步循环正常（镜像 6084，sources 全量合并，游标推进）；③RLS 三验证（未设标识拒写 42501 / 本人行可写 / 他人行不可写 42501）；④契约文件升 v0.2 minor（0002 迁移，unrate DELETE 权限），**非**零变更——设计文档 §1 决策表已更正；
- [x] 2026-10-21 晚补验：用户在 dev 库执行 0002 后，`unrate` 两条测试评分 PG DELETE 成功（ratings 表清空、本地镜像同步清空、entry `myRating:null`）；dev 库测试数据已清理；
- [ ] 待用户：主 App 重启验收；通过后 commit（口令类信息不入库复检）+ push。

## 估算与风险

- 估算：T1-1 0.5d（写路径 + 队列联调）｜T1-2 0.2d｜T1-3 0.3d｜T1-4 0.2d，合计约 1 天。
- 风险：
  - SRC 方法的 emit 事件客户端订阅路径未验证 → T1-1 冒烟一并验证 `$on`；不通则 UI 改为操作后主动重拉（降级可接受）；
  - star 分位缓存失效时机遗漏 → 单元自测覆盖「同步后分值变化」场景；
  - 离线补写与远端并发改同一行 → 同键 upsert 后写赢（契约 §7 既定语义），UI 以最后同步结果为准。
