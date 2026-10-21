# DSH 插件仓库 · 数据契约 v0.2

> 本文件是「发现器（Harvester）」与「dsh-plugin-repo 插件」之间的**唯一接口**。
> 任何一端只依赖本契约与 `migrations/` 的 DDL，不依赖对方实现。
> 契约变更流程见 §9。配套 DDL：`migrations/0000_roles.sql`、`migrations/0001_init.sql`、`migrations/0002_harvester_signals.sql`。
>
> 变更记录：
> - **v0.2**（minor，发现器侧提案）：`plugins` 加 `git_commit`（format-1 git 源所需）、`plugin_checks` 加 `miss_streak`（gone 判定）；§8 索引字段口径改按官方 `parseMarketIndex` 表述。表结构见 `0002_harvester_signals.sql`，major 未变，插件侧无需同步发布。
> - v0.1：初版。

---

## 1. 角色与职责

| 角色 | 数据库账号 | 职责 |
| --- | --- | --- |
| 发现器 | `dsh_plugin_harvester_rw` | catalog（plugins / plugin_sources / plugin_checks / categories / events / harvester_state）的**唯一写者**；ratings 只读 |
| 插件 | `dsh_plugin_client` | 读全部公共数据；写 ratings 仅限本人行（RLS 强制） |
| DBA | 管理账号 | 执行 migrations；不进入应用链路 |

环境：`dsh_plugin_repo`（生产）/ `dsh_plugin_repo_dev`（开发），同一份 migrations；两端开发只碰 dev。

## 2. 插件记录模型（plugins）

| 字段 | 口径 |
| --- | --- |
| `id` | **小写规范化** `owner/repo`；monorepo 子包为 `owner/repo#path:/subdir`（与官方安装 spec 的 `#path:` 记法一致）。同一仓库改名后保留原 id 还是跟随新名，由发现器以 `renamed` 事件说明（见 §6） |
| `name` | 清单条目展示名，保留原始大小写 |
| `npm` | npm 包名；`''` = 未发布 npm |
| `install_spec` | 可直接传给 `plugin_manager.install_bundle` 的 spec；必须通过官方 `parseInstallSpec` 口径（npm 名 / `github:owner/repo` / `github:owner/repo#path:/sub` 等 5 种之一） |
| `github` | 仓库 URL；monorepo 保留子路径 |
| `category_id` | `categories.id`；`''` = 未分类 |
| `stars` | GitHub API 快照值。**该环境数值整体偏高，仅作参考**（调研归档口径，2026-10-20）；展示需标注快照时间 |
| `npm_versions` | `[{ver, time}]`，`time` 可 NULL；发现器按时间倒序维护 |
| `git_commit` | 仓库默认分支 HEAD 提交 SHA（40 位小写 hex）；`''` = 未核验。format-1 索引的 git 源条目需要它才有可钉住的可安装版本（见 §8） |
| `consensus_votes` | 被人工策展源收录的票数（当前满分 7，见 §3 名录） |
| `status` | `active` / `renamed` / `archived` / `gone`（见 §6） |
| `updated_at` | **增量同步水印**，由触发器维护：仅业务字段真实变化时推进；INSERT 取 `now()` |

**不存的东西**：计算后的评分（评分是消费侧策略，见 §7）；发现器的核验时间（在 `plugin_checks`，发现器私有）；用户本地 labels / 自定义分类（插件本地私有，不进库）。

## 3. 信源名录（plugin_sources.source_id）

| source_id | 说明 | 类型 |
| --- | --- | --- |
| `awesome` | awesome-dsh-plugin 主清单 | 人工策展（计票） |
| `vbarter-curated` | vbarter 注册表人工策展子集 | 人工策展（计票） |
| `walkinglabs` | 源码级验证清单 | 人工策展（计票）+ 源码验证标记 |
| `kejixiaoliang` | 14 类目录 | 人工策展（计票） |
| `beancookie` | beancookie 精选 | 人工策展（计票） |
| `dshopen` | dshopen.org 开放市场 | 人工策展（计票） |
| `vbarter-full` | vbarter 全量自动发现 | 人工策展（计票，v0.1 沿用调研口径） |
| `dsh-plugin-catalog` | npm format-1 索引 | 索引（不计票，提供版本与中英简介） |
| `topic-scan` | GitHub topic `dsh-plugin` 搜索 | 候选池（不计票） |
| `npm-scan` | npm `keywords:dsh-plugin` 搜索 | 候选池（不计票） |
| `official` | 官方三层清单（bundle/optional/on-demand） | 官方 |

计票规则：**仅人工策展型来源计票**（topic 全量抓取型不计，会淹没区分度）——沿用调研归档口径。

## 4. 入库门槛（候选池 → plugins）

发现器对 `topic-scan` / `npm-scan` 候选逐条核验，全部通过才写入 `plugins`：

1. 仓库 `package.json` 含 `dsh.bundle` 声明，或已被任一人工策展源收录；
2. 生成的 `install_spec` 通过官方 `parseInstallSpec` 口径；
3. 不是已记录插件的重复 fork / 同 repo 重复条目。

已记录的坑固化为校验规则：仓库改名（跟随并记 `renamed` 事件）、npm 同名包冲突（以 GitHub 仓库为准）、同文二次发布（不算独立信源）。

## 5. 插件同步协议（插件 ← PG）

1. **键集分页游标**：插件持久化 `(plugins_watermark, plugins_id_cursor)`（上次见到的最后一行的 `(updated_at, id)`）。每轮执行：
   ```sql
   SELECT *, updated_at::text AS updated_at_cursor FROM plugins
   WHERE (updated_at, id) > ($1::timestamptz, $2::text)
   ORDER BY updated_at ASC, id ASC
   LIMIT 500;
   ```
   处理完一批推进游标到本批最后一行，循环至不足一批。两条硬性规则（均为 2026-10-20 实测教训）：
   - **必须用 (updated_at, id) 复合游标，不得只用单时间戳水印**：批量导入（如种子事务）会产生大量相同 `updated_at`，单水印在跨批边界既丢行也死循环；
   - **游标时间戳必须经 `updated_at::text` 原样回传**：PG 是微秒精度，经 JS `Date.toISOString()` 截断到毫秒会让游标回退，在大量相同 `updated_at` 时同批死循环。
   镜像写入天然幂等，重复处理无副作用。
2. **删除传播**：不物理删除，`status='gone'` 墓碑；插件见到 `gone` 从本地镜像删除该条。
3. **categories**：小表，每轮全量拉取覆盖（仅 `builtin=false` 且非 `local-` 前缀的行会被覆盖；插件本地自定义分类以 `local-` 前缀豁免）。
4. **events**：按单调 `id` 增量（`WHERE id > $cursor ORDER BY id ASC LIMIT 500`），本地有界保留。
5. **ratings**：小表全量拉取（见 §7）。
6. **契约版本**：插件启动时 `SELECT value FROM harvester_state WHERE key='contract_version'`；本地支持 `major=0`，对端 major 更高时插件只读不同步并在 UI 提示升级。

## 6. 状态与事件（events.kind）

| kind | 触发 | detail 约定 |
| --- | --- | --- |
| `new-plugin` | 新插件入库 | `{sources: [...]}` |
| `update-available` | npm 出现更高版本 | `{from, to}` |
| `renamed` | 仓库改名 | `{from: 'old/id', to: 'new/id'}`；id 是否跟随由发现器实现决定并在 detail 说明 |
| `archived` | 仓库被归档 / 失去维护 | `{reason?}` |
| `removed-from-list` | 被某人工策展源移除 | `{source_id}`；多个源移除产生多条 |

插件 `status` 迁移：`active` →（`renamed` 事件，`status` 保持 `active` 但 id/github 更新）/（`archived` 事件 → `archived`）/（连续多轮核验 404 → `gone`）。`gone` 是终态墓碑。

## 7. 评分协议

- **客观分**：PG 只存原始信号（stars / last_push_at / npm_versions / consensus_votes / 源码验证标记 / 有无图标文档）。插件展示时按**本机可配权重**即时计算，默认权重：共识票 30%、维护活跃度 25%、star 分位 20%、源码验证 15%、图标文档 10%。不同主机可有不同口味，共享数据保持无立场。
- **人工分**：`ratings` 表 `(plugin_id, scored_by)` 主键，各人一行：
  - `scored_by` 命名：`<host>-<user>`，小写，仅 `[a-z0-9-]`（如 `mbp-dennis`）；
  - 插件连接后执行 `SET app.scored_by = '<本机标识>'`，RLS 强制只能 INSERT/UPDATE 本人行；未设置时全部拒绝（fail-closed）；
  - 冲突语义：同键 upsert，后写赢（同一人改自己的分，无他人覆盖问题）；
  - 离线：先落本地队列（`synced=false`），恢复后补写；
  - 展示：各人的分并存，可聚合均分/分布；均分仅为参考，固定标注「非安全审计结论」。

## 8. format-1 索引发布（发现器 → 公网只读出口）

- 发现器每轮从 PG 渲染官方 [format-1 索引](https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json) 兼容的 `index.json`：只含公共字段子集，不含 PG 内部字段、ratings、本地数据。
- **字段口径以官方校验器 `@deepseek-ai/dsh-plugin-market-index` 的 `parseMarketIndex` 为准**（发现器每轮发布前必须自验通过）。format-1 的实际结构：
  - 顶层：`format: 1`；`title`（必填，本地化文本，必须含 `en`）；`description`（可选，本地化文本）；`metadata`（可选：`categories` / `labels` / `sortKeys` 三组声明）；`plugins`（必填数组）。
  - `plugins[]`：`name`（**必须是合法 npm 包名**，索引内唯一）；`title` / `description`（本地化文本）；`icon`（可选，`data:` 图标或绝对/相对 URL）；`author` / `homepage`（可选）；`repository`（可选，`{url, directory?}`）；`metadata`（可选，`{category?, keywords[], labels[], sortKeys{}}`；category/labels/sortKey 的 id 必须在 `metadata` 中声明）；`versions`（**必填非空数组**）。
  - `versions[]`：`version`（**精确 SemVer**）；`publishTimestamp`（**必填**，Unix 秒整数）；`source`（**必填**，`{type:'npm', registry?}` 或 `{type:'git', url, commit, path?}`，`commit` 为 40 位小写 hex）；`engines`（可选，`{dsh?: SemVer range}`）。
  - 同一插件的 `name` 为 npm 包名；未发布 npm 的插件用仓库派生的合成名 `@<owner>/<repo>`（monorepo 子包追加 `.<子路径>`），其 `source.type='git'` 并用 `plugins.git_commit` 钉住提交。
- 发布到公网静态托管（首选阿里云 OSS 静态网站，备选 GitHub Pages），URL 供任意 DSH「发现 → 添加索引源」直接使用。
- 随索引发布一个静态浏览页（web 形态）。

## 9. 契约版本与变更流程

- 版本存 `harvester_state.contract_version`：`{"major": 0, "minor": 1}`。
- **minor**（加列、加表、加枚举值、加 source_id）：任一端可提案，写入 migrations 新文件并升 minor，对端无需同步发布。
- **major**（改语义、删列、改水印/评分协议）：必须两端评审通过后同时升级；发现器先写库升 major，插件校验不通过时降级为只读并提示。
- 迁移脚本一律新增文件（`0002_*.sql`…），不改已发布文件；脚本幂等。
