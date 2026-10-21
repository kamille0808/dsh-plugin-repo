# DSH 插件仓库 · 发现器（Harvester）

> 组件①：**独立运行的 Node.js 程序**，不是 DSH 插件。由一台主机常驻定时运行。
> 职责：抓信源 → 归一化 → 过入库门槛 → 事务写 PostgreSQL 契约表 → 从库渲染
> format-1 索引与静态浏览页 → 发布到公网静态托管。
>
> 与组件③（`dsh-plugin-repo` 插件）的唯一接口是 `../contract/`（数据契约 + migrations）。
> 两端互不依赖实现。

---

## 1. 快速开始

```sh
cd harvester
npm install

# 联调：DATABASE_URL 必须带 TLS 参数
export DATABASE_URL='postgres://dsh_plugin_harvester_rw:<口令>@47.101.216.5:5432/dsh_plugin_repo_dev?sslmode=no-verify'
export GITHUB_TOKEN='<只读 PAT>'

# ① 不连库，先验证信源解析与索引渲染（不写任何数据）
node src/cli.mjs collect

# ② 跑一轮完整流程（写库 + 发布）
node src/cli.mjs run

# ③ 只从库重新渲染并发布
node src/cli.mjs render

# ④ 契约符合性检查（验收 T1）
node tools/contract-check.mjs

# ⑤ 单测
node --test test/normalize.test.mjs test/sources-render.test.mjs
```

> `node --test test/` 在 Windows 上对目录参数不友好，直接列文件名更稳。

## 2. 目录

```
harvester/
├─ config/
│  ├─ sources.json          信源名录（唯一运维入口：加信源只改这里）
│  └─ categories.json       外部分类标题 → 契约 categories.id 的别名表
├─ src/
│  ├─ cli.mjs               命令行入口
│  ├─ run.mjs               一轮流程编排（L4 核验 → 信源合并 → 候选池 → 渲染发布）
│  ├─ config.mjs            环境变量与配置加载（含 sslmode → TLS 参数映射）
│  ├─ log.mjs               结构化日志 + 凭据脱敏
│  ├─ http.mjs              限流 / 退避重试 / 超时的 HTTP 客户端
│  ├─ db.mjs                PG 连接、事务、契约表读写
│  ├─ state.mjs             harvester_state 游标与摘要
│  ├─ normalize.mjs         契约 id / install_spec / 分类 / 版本归一
│  ├─ sources.mjs           信源解析器（markdown 清单、format-1 索引）
│  ├─ collect.mjs           L1/L2/L3/L4 采集
│  ├─ catalog.mjs           合并、入库门槛、事务 upsert、事件
│  ├─ render-index.mjs      PG → format-1 index.json
│  ├─ render-page.mjs       PG → 静态浏览页
│  └─ publish.mjs           发布（本地目录 / 阿里云 OSS）
├─ tools/
│  ├─ contract-check.mjs    契约符合性检查（只读）
│  └─ probe-sources.mjs     信源格式探针（排障用）
└─ test/                    单测
```

## 3. 契约要点与实现对照

| 契约条款 | 实现位置 |
| --- | --- |
| §1 发现器是 catalog 唯一写者，ratings 只读 | `src/db.mjs` 不提供写 ratings 的方法；`tools/contract-check.mjs` 校验权限位 |
| §2 id 小写规范化 / monorepo `#path:` | `src/normalize.mjs` `contractId()` / `parseContractId()` |
| §2 install_spec 必过官方 `parseInstallSpec` | `src/normalize.mjs` `buildInstallSpec()`，不合格直接不入库 |
| §2 `npm_versions` 按时间倒序 | `src/normalize.mjs` `normalizeNpmVersions()` |
| §3 信源名录与计票规则 | `config/sources.json` 的 `votes` 字段 |
| §4 入库门槛 | `src/catalog.mjs` `applyAdmissionGate()`；`src/run.mjs` L3 候选池查 `dsh.bundle` |
| §5 增量同步水印（**插件侧**协议） | 本发现器不消费；只保证 `updated_at` 触发器语义不被扰动 |
| §6 五种事件与状态迁移 | `src/catalog.mjs` `persistCandidates()` / `applyVerification()` |
| §7 只存原始信号，不存算好的评分 | `plugins` 表无分数字段；评分由消费侧按权重即时算 |
| §8 format-1 索引发布 | `src/render-index.mjs`，每轮发布前跑官方 `parseMarketIndex` 自验 |
| §9 契约版本与变更流程 | `contract/migrations/`；本次提交 `0002_harvester_signals.sql`（minor 0.1 → 0.2） |

### 本次对契约的改动（minor）

`contract/migrations/0002_harvester_signals.sql`：

- `plugins.git_commit` —— 默认分支 HEAD 提交 SHA。format-1 的 git 源条目必须有
  40 位 commit 才有可钉住的可安装版本。
- `plugin_checks.miss_streak` —— 连续核验 404 计数，用于 §6 的「连续多轮 404 → gone」。
- `contract_version` minor 0.1 → 0.2；major 未变，插件侧只校验 major，**无需同步发布**。

同时修正了 CONTRACT.md §8 的索引字段表述：原表述漏了 format-1 必填的
`versions[].publishTimestamp` 与 `versions[].source`，照原文渲染无法通过官方校验。
现按官方 `parseMarketIndex` 的实际结构逐字段列出。

## 4. 信源分层与当前接入情况

| 层 | source_id | 地址 | 计票 | 状态 |
| --- | --- | --- | --- | --- |
| L1 | `awesome` | `raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/main/README.md` | ✅ | 已接入 |
| L1 | `walkinglabs` | `raw.githubusercontent.com/walkinglabs/awesome-deepseek-harness-plugins/main/README.md` | ✅ | 已接入 |
| L1 | `kejixiaoliang` | `raw.githubusercontent.com/kejixiaoliang/awesome-dsh-plugins/main/README.md` | ✅ | 已接入 |
| L1 | `beancookie` | `raw.githubusercontent.com/beancookie/awesome-dsh-plugin/main/README.md` | ✅ | 已接入 |
| L1 | `dshopen` | `https://dshopen.org/index.json` | ✅ | 已接入 |
| L1 | `vbarter-curated` | `raw.githubusercontent.com/vbarter/dsh-plugin-registry/main/data/plugins.json`（筛 `source=curated`） | ✅ | 已接入 |
| L1 | `vbarter-full` | 同上（筛 `source=discovered`） | ✅ | 已接入 |
| L2 | `dsh-plugin-catalog` | `cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` | ❌ | 已接入 |
| L3 | `topic-scan` | GitHub topic `dsh-plugin` 搜索 | ❌ | 已接入 |
| L3 | `npm-scan` | npm `keywords:dsh-plugin` 搜索 | ❌ | 已接入 |

> **vbarter 两个源是什么**：`vbarter` 是 GitHub 用户 `vbarter`，其项目
> [`vbarter/dsh-plugin-registry`](https://github.com/vbarter/dsh-plugin-registry)
> 是一个社区 DSH 插件注册表（站点 [dsplugin.app](https://dsplugin.app/)）。
> 它的数据文件 `data/plugins.json`（schemaVersion 2）里每条都有
> `source: "curated" | "discovered"` 字段：
> - `curated` = 人工提交并经审核通过的条目 → 对应契约的 **`vbarter-curated`**（策展子集）
> - `discovered` = GitHub topic `dsh-plugin` 自动发现、并校验过 `dsh.bundle`/`dsh.plugin` 的条目
>   → 对应契约的 **`vbarter-full`**（全量自动发现）
>
> 两个视图**互斥**：同一注册表不把同一个插件算两票（共识票要跨注册表才有区分度）。
> 它们共用一次下载（26MB，解析器按 `filter.source` 切两刀），保证两份快照一致。
> 注意该文件里的 `id` 用的是 `owner/repo#子路径` 记法，与契约的
> `owner/repo#path:/子路径` 不同——契约 id 一律从 `url` 推导。

`node src/cli.mjs sources` 会逐个探测可达性并报出每源解析到的条目数。

### 解析器适配

社区清单格式各异，当前三个通用解析器覆盖了主流形态：

- `markdown-list` —— `### 分类标题` + `- [名字](链接) - 描述`，兼容表格行
  `| [名字](链接) | 描述 |`，以及非标准形态（整行含 GitHub 链接）的兜底。
  分类标题经 `config/categories.json` 的 alias 表归一到契约的 23 个内置分类。
- `market-index` —— 官方 format-1 索引 JSON，取 npm 名、版本时间线、仓库地址、分类。
- `vbarter-registry` —— vbarter 注册表的 `data/plugins.json`（schemaVersion 2），
  按 `source` 字段切 curated / discovered 两刀；安装 spec 从 `install` 字段
  （`dsh plugin --profile web add <spec>`）里提取，仓库与契约 id 从 `url` 推导。

monorepo 子包从 `https://github.com/o/r/tree/<branch>/<path>` 推出
`owner/repo#path:/<path>`；format-1 侧用 `repository.directory` 对齐。

## 5. 一轮流程

```
Phase A  L4 单点核验    按 plugin_checks.checked_at 升序取一批（默认 400 条/轮）
                        → GitHub repos API（stars / pushed_at / archived / license / 改名 301）
                        → 默认分支 HEAD commit（format-1 git 源所需）
                        → npm registry 版本时间线
                        → 事件：update-available / renamed / archived；连续 404 达阈值 → status='gone'
Phase B  信源抓取+合并  L1+L2 抓取 → 归一化 → 合并去重 → 计票 → 事务 upsert
                        → 事件：new-plugin / removed-from-list
Phase C  候选池+门槛    GitHub topic + npm keywords 搜索 → 查 package.json 的 dsh.bundle
                        → 过门槛才入库（计 0 票）
Phase D  渲染+校验+发布  从库渲染 index.json + index.html → 官方 parseMarketIndex 自验 → 发布
```

每阶段的写操作独立事务；某阶段失败不影响已提交阶段。游标与摘要写在
`harvester_state`（`cursor:*` / `source:<id>` / `last-run`），崩溃重启后续跑。

## 6. format-1 索引的两条重要取舍

1. **`plugins[].name` 必须是合法 npm 包名**（官方校验器口径），而契约的
   `plugins.id` 是 `owner/repo`。因此：
   - 已发布 npm 的插件 → `name` 用真实 npm 包名；
   - 未发布 npm 的插件 → 用合成名 `@<owner>/<repo>`（monorepo 追加 `.<子路径>`），
     其 `versions[].source.type = 'git'`，用 `plugins.git_commit` 钉住提交。
   合成名与作者日后可能发布的 npm 名（`@owner/repo`）恰好一致，所以不会产生
   索引条目抖动。npm 同名冲突时按契约 §4「以 GitHub 仓库为准」，后者换合成名。
2. **没有可安装版本的插件不进索引**：format-1 要求 `versions` 非空。尚未核验、
   既无 npm 版本又无 `git_commit` 的插件会先进库（插件侧仍能搜到），等 L4 核验
   补上 `git_commit` 后才进公开索引。

## 7. 配置

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | —（必填，`collect` 除外） | PG 连接串，**必须带 TLS 参数** |
| `GITHUB_TOKEN` / `GH_TOKEN` | 空 | 只读 PAT；匿名 60 次/小时不够 L4 用 |
| `NPM_REGISTRY` | `https://registry.npmjs.org` | npm registry |
| `HARVESTER_HTTP_TIMEOUT_MS` | `30000` | 单次请求超时 |
| `HARVESTER_HTTP_RETRIES` | `3` | 退避重试次数 |
| `HARVESTER_HTTP_CONCURRENCY` | `4` | 并发上限 |
| `HARVESTER_GITHUB_RATE_PER_HOUR` | `4500` | GitHub 自适应限流上限（留余量） |
| `HARVESTER_VERIFY_MAX_PER_RUN` | `400` | 每轮 L4 核验条数（分批） |
| `HARVESTER_GONE_MISS_THRESHOLD` | `3` | 连续多少轮 404 判定 gone |
| `HARVESTER_CANDIDATE_PER_RUN` | `100` | 每轮候选池处理条数 |
| `HARVESTER_OUT_DIR` | `harvester/dist` | `publisher=file` 的输出目录 |
| `HARVESTER_BROWSE_LIMIT` | `5000` | 浏览页最多收录多少条（按共识票→star 排序取前 N；`0` = 不限）。完整目录在 PG 与 format-1 索引里 |
| `HARVESTER_PUBLISHER` | `file` | `file` \| `oss` |
| `HARVESTER_INDEX_BASE_URL` | `https://dsh-plugin-repo.pages.dev` | 索引公开地址前缀（参与图标相对路径解析与自验） |
| `OSS_BUCKET` / `OSS_REGION` / `OSS_PREFIX` / `OSS_PUBLIC_BASE_URL` | — | `publisher=oss` 时必填 bucket/region |
| `HARVESTER_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

### TLS（重要）

交接说明三的硬要求：**不要用 `sslmode=require`**。新版 `pg-connection-string`
把它当 verify-full，RDS 私有 CA 会报 self-signed。`src/config.mjs` 显式映射：

| 连接串 | 行为 |
| --- | --- |
| `?sslmode=no-verify` | 加密但不验证书（联调） |
| `?sslmode=verify-full&sslrootcert=<RDS CA 路径>` | 加密且验证书（正式） |
| `?sslmode=require` | 记警告并按 no-verify 处理（不按 verify-full，避免误报） |

## 8. 凭据纪律

- `DATABASE_URL` / `GITHUB_TOKEN` 只从环境变量读，不落配置文件。
- 日志统一经 `src/log.mjs` 脱敏：URI 里的口令、名字里带 token/secret/password/
  authorization/cookie 的字段一律替换成 `***`。
- 导出物（`index.json` / `index.html`）只含公共字段：不含 PG 内部字段、ratings、
  本地数据、凭据与本机路径（契约 §4.5）。

## 9. 定时运行

### systemd timer（Linux）

```ini
# /etc/systemd/system/dsh-harvester.service
[Service]
Type=oneshot
User=dsh
WorkingDirectory=/opt/dsh-plugin-repo/harvester
EnvironmentFile=/etc/dsh-harvester.env   # DATABASE_URL / GITHUB_TOKEN
ExecStart=/usr/bin/node src/cli.mjs run
```

```ini
# /etc/systemd/system/dsh-harvester.timer
[Timer]
OnCalendar=*-*-* 03,15:00:00
Persistent=true
```

### Windows 计划任务

```powershell
$env:DATABASE_URL='...'; $env:GITHUB_TOKEN='...'
& 'C:\Program Files\nodejs\node.exe' 'C:\path\to\harvester\src\cli.mjs' run
```

### 云效 Flow / 任意 CI

把 `npm ci && node src/cli.mjs run` 作为定时流水线步骤，连接串与 token 走
CI 的环境变量/密钥管理。

## 10. 已验证 / 未验证

### 已验证

- **29 项单测通过**（`node --test test/normalize.test.mjs test/sources-render.test.mjs test/degradation.test.mjs`）：
  归一化与契约 id、入库门槛、信源解析（markdown 清单 / 表格行 / format-1 索引）、
  索引渲染与官方校验、失败降级规则。
- **对 6 个真实信源跑通离线全链路**（`node src/cli.mjs collect`）：抓取 → 归一化 →
  门槛 → 渲染 → 官方 `parseMarketIndex` 自验 → 产出 `dist/index.json` + `dist/index.html`。
  实测一轮：6 个信源全部成功、0 错误、6847 个去重候选、3484 条进索引，
  索引内 npm 名 100% 合法且无重名，分类恰好落在契约的 23 个内置分类里。
- **PG 连通性与 TLS 路径**：47.101.216.5:5432 可达，`sslmode=no-verify` 的 TLS
  握手成功，服务端确认账号 `dsh_plugin_harvester_rw` 存在（返回
  `28P01 password authentication failed`）。

### 未验证（需口令 / 需决策）

- **PG 写入路径未端到端跑通**：本机没有 `dsh_plugin_harvester_rw` 的口令
  （交接说明三：口令走线下渠道，不在任何文档/聊天记录里）。失败点仅在口令。
  拿到口令后按第 1 节跑 `run` + `tools/contract-check.mjs` 即可完成验收 T1。
- **`vbarter-curated` / `vbarter-full` 已定位并接入**：源为
  `vbarter/dsh-plugin-registry` 的 `data/plugins.json`（站点 dshplugin.app），
> 按 `source` 字段切成策展子集与全量自动发现两刀（见第 4 节）。
  唯一待确认的是契约 §3 的措辞「vbarter 全量自动发现」到底指
  `source=discovered`（本实现，判据：与 curated 互斥、避免同注册表重复计票）
  还是「策展+自动发现的合集」——若是后者，改 `config/sources.json` 里
  `vbarter-full` 的 `filter` 即可。
- **静态托管渠道未实测**：`publisher=file` 已验证（产出 `dist/`）；
  `publisher=oss` 的代码路径就绪但未连真实 OSS 跑过（需要 Bucket 与 AccessKey）。
- **L4 核验未连真实 GitHub 跑满批**：核验逻辑与事件判定有单测覆盖，
  但未用真实 PAT 跑完整批量（需要 `GITHUB_TOKEN`）。
- **端到端「发现页一键安装」由 Dennis 在本机完成**：本侧只保证 `index.json`
  通过 `parseMarketIndex`、PG 数据符合契约（交接说明末段）。
