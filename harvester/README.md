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

# ① 录入凭据（口令隐藏输入，落在 gitignored 的 .env.local；不经对话、不进 git）
node src/cli.mjs set-secret

# ② 不连库，先验证信源解析与索引渲染（不写任何数据）
node src/cli.mjs collect

# ③ 跑一轮完整流程（写库 + 发布）
node src/cli.mjs run

# ④ 只从库重新渲染并发布
node src/cli.mjs render

# ⑤ 契约符合性检查（验收 T1）
node tools/contract-check.mjs

# ⑥ 单测
node --test test/normalize.test.mjs test/sources-render.test.mjs
```

> `node --test test/` 在 Windows 上对目录参数不友好，直接列文件名更稳。

### 凭据从哪来

`DATABASE_URL` / `GITHUB_TOKEN` 只有三个来源，优先级从高到低：

| 来源 | 怎么来 | 适合谁 |
| --- | --- | --- |
| 进程环境变量 | systemd `EnvironmentFile`、CI 密钥、云效 Flow 变量 | 定时任务 |
| `harvester/.env.local` | `node src/cli.mjs set-secret` 隐藏输入 | 本机手动跑 |
| 管道 | `... \| node src/cli.mjs set-secret --stdin` | 密码管理器 / vault |

`.env.local` 被 gitignore 忽略，POSIX 下权限 0600。它本质是「环境变量的持久化
形式」——运行时由 `src/config.mjs` 自动载入，**已存在的环境变量永远赢**，所以
systemd / CI 注入的值不会被文件里的旧值覆盖。

口令绝不要贴进对话、issue 或提交记录。见第 9 节。

## 2. 目录

```
harvester/
├─ config/
│  ├─ sources.json          信源名录（唯一运维入口：加信源只改这里）
│  └─ categories.json       外部分类标题 → 契约 categories.id 的别名表
├─ src/
│  ├─ cli.mjs               命令行入口
│  ├─ run.mjs               一轮流程编排（L4 核验 → 信源合并 → 候选池 → 渲染发布）
│  ├─ config.mjs            环境变量与配置加载（含 sslmode → TLS 参数映射、凭据文件载入）
│  ├─ secrets.mjs           本地凭据文件（.env.local）读写、连接串脱敏、隐藏输入
│  ├─ log.mjs               结构化日志 + 凭据脱敏
│  ├─ http.mjs              限流 / 退避重试 / 超时的 HTTP 客户端
│  ├─ db.mjs                PG 连接、事务、契约表读写
│  ├─ state.mjs             harvester_state 游标与摘要
│  ├─ normalize.mjs         契约 id / install_spec / 分类 / 版本归一
│  ├─ sources.mjs           信源解析器（markdown 清单、format-1 索引、vbarter 注册表）
│  ├─ collect.mjs           L1/L2/L3/L4 采集
│  ├─ catalog.mjs           合并、入库门槛、事务 upsert、事件
│  ├─ render-index.mjs      PG → format-1 index.json
│  ├─ render-page.mjs       PG → 静态浏览页
│  └─ publish.mjs           发布（本地目录 / nginx / 阿里云 OSS）+ 发布守门
├─ tools/
│  ├─ contract-check.mjs    契约符合性检查（只读）
│  └─ probe-sources.mjs     信源格式探针（排障用）
└─ test/                    单测
```

> `.env.local` 是本地凭据文件（gitignored），仓库里没有模板——不要提交。

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

## 6. 发布：三种 publisher 与发布守门

### publisher：产出物放哪

发现器每轮产出两个文件：`index.json`（format-1 索引，约 3.2MB）与
`index.html`（静态浏览页，约 2.8MB，样式与数据全内联，无外部资源）。
publisher 决定把它们放到哪：

| publisher | 行为 | 需要什么 |
| --- | --- | --- |
| `file`（默认） | 写到本地目录 `HARVESTER_OUT_DIR`（默认 `harvester/dist/`），**不上传任何东西** | 无 |
| `nginx` | 原子替换到 nginx 的 root 目录；可选 rsync 推到 ECS；可选回源自检 | `HARVESTER_NGINX_ROOT` |
| `oss` | 用可选依赖 `ali-oss` 直接传到阿里云 OSS | `OSS_BUCKET` / `OSS_REGION` / `OSS_PREFIX` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` / `OSS_PUBLIC_BASE_URL` |

**为什么默认 `file`**：契约 §8 说发布到公网静态托管，但设计文档 §7.4 原本把
渠道记作「待落实」。`file` 不需要云凭据，cron / systemd / CI 任何环境都能跑；
产物就是一个标准静态目录，nginx root、rsync、GitHub Pages 工作流、OSS 同步、
Cloudflare Pages 都能直接吃。渠道定下来后切成 `nginx` 只改环境变量。

### publisher=nginx：阿里云 ECS + 已有 nginx + 已有域名

这是本项目选定的发布渠道。三段式：

```
发现器 ──渲染──> index.json + index.html
                     │
                     ├─ ① 原子替换写入 nginx root 目录（发现器与 nginx 同机时）
                     ├─ ② rsync 同步到 ECS（发现器不在 ECS 上时，可选）
                     └─ ③ GET https://<域名>/index.json 回源自检（可选）
```

**① 原子替换是硬要求，不是优化。** nginx 直接对外提供这个 3.2MB 的
`index.json`。如果用普通 `writeFile` 覆盖，下载方有概率拿到写了一半的 JSON，
DSH「发现」页当场解析失败。实现是先写同目录临时文件再 `rename`——同一文件系统
内 rename 是原子的，读者要么看到旧文件，要么看到完整的新文件，中间没有半截状态。
`file` publisher 同样走这条路径。

**② 两种部署形态**：

| 形态 | 配置 |
| --- | --- |
| 发现器就跑在 ECS 上 | `HARVESTER_NGINX_ROOT=/var/www/dsh-plugin-repo`，直接写这个目录，不需要 rsync |
| 发现器跑在别的机器 | 上面照配，再加 `HARVESTER_NGINX_RSYNC_TARGET=root@<ECS_IP>:/var/www/dsh-plugin-repo` |

rsync 同步用 `--delete`，保证远端目录里没有上一轮残留的文件。rsync 不存在时
会明确报错并提示改用 `publisher=file` + 外部同步，不会静默跳过。

**③ 发布后回源自检**（`HARVESTER_NGINX_PROBE_URL=https://<域名>`）：
发布完立刻 GET 公开地址的 `index.json`，确认 nginx 已经把新文件发出来了。
这比「文件写成功」更接近用户实际看到的东西。失败只记警告，不影响本轮任务
的成功判定（内容已经落盘，nginx 侧的问题不该让数据层跟着背锅）。

### nginx 配置示例

```nginx
server {
    listen 80;
    server_name <你的域名>;

    root /var/www/dsh-plugin-repo;
    index index.html;

    # 索引与浏览页是两个独立文件，各自设定缓存策略
    location = /index.json {
        default_type application/json;
        add_header Cache-Control "public, max-age=300";
        try_files $uri =404;
    }

    location = / {
        add_header Cache-Control "public, max-age=300";
        try_files /index.html =404;
    }

    # 不开放目录列表：web 根目录只应该暴露这两个文件
    location / {
        return 404;
    }

    # 3MB 的 JSON 和 2.8MB 的 HTML，gzip 后能小一个数量级
    gzip on;
    gzip_types application/json text/html text/css application/javascript;
    gzip_min_length 1024;
}
```

> nginx 默认的 `mime.types` 已经把 `.json` 映射成 `application/json`，
> 上面的 `default_type` 只是显式写出来，方便后来人看懂。
> HTTPS 建议用 certbot 或已有证书配置 `listen 443 ssl`。

### 发布守门：不让残缺索引覆盖完整索引

8 个信源里任一轮网络抖动，可能只剩三四个源有数据。若照发，公开索引会从
3484 条掉到 767 条——对已经把它加进 DSH「发现」页的用户是**静默的能力回退**。

所以发布前会比对候选数相对上一轮的跌幅：超过 `HARVESTER_MAX_CATALOG_DROP`
（默认 40%）就**跳过本轮发布**，只记一条警告到运行摘要。判定口径与 vbarter
注册表自己的做法一致（「published 数量比上一版下降超过 40% 就中止写入」）。
上一轮的候选数存在 `harvester_state` 的 `catalog-size` 键。

注意这只挡**发布**；PG 里的数据照常写（源快照也照常更新），所以信源恢复后
下一轮自然回到正常水平。

## 7. format-1 索引的两条重要取舍

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

## 8. 配置

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | —（必填，`collect` 除外） | PG 连接串，**必须带 TLS 参数** |
| `GITHUB_TOKEN` / `GH_TOKEN` | 空 | 只读 PAT；匿名 60 次/小时不够 L4 用 |
| `NPM_REGISTRY` | `https://registry.npmjs.org` | npm registry |
| `HARVESTER_SECRETS_FILE` | `harvester/.env.local` | 本地凭据文件路径（gitignored） |
| `HARVESTER_HTTP_TIMEOUT_MS` | `30000` | 单次请求超时 |
| `HARVESTER_HTTP_RETRIES` | `3` | 退避重试次数 |
| `HARVESTER_HTTP_CONCURRENCY` | `4` | 并发上限 |
| `HARVESTER_GITHUB_RATE_PER_HOUR` | `4500` | GitHub 自适应限流上限（留余量） |
| `HARVESTER_VERIFY_MAX_PER_RUN` | `400` | 每轮 L4 核验条数（分批） |
| `HARVESTER_GONE_MISS_THRESHOLD` | `3` | 连续多少轮 404 判定 gone |
| `HARVESTER_CANDIDATE_PER_RUN` | `100` | 每轮候选池处理条数 |
| `HARVESTER_OUT_DIR` | `harvester/dist` | `publisher=file` 的输出目录 |
| `HARVESTER_BROWSE_LIMIT` | `5000` | 浏览页最多收录多少条（按共识票→star 排序取前 N；`0` = 不限）。完整目录在 PG 与 format-1 索引里 |
| `HARVESTER_MAX_CATALOG_DROP` | `0.4` | 候选数相对上一轮的最大跌幅，超过就**跳过本轮发布**（见第 6 节） |
| `HARVESTER_PUBLISHER` | `file` | `file` \| `nginx` \| `oss` |
| `HARVESTER_INDEX_BASE_URL` | `https://dsh-plugin-repo.pages.dev` | 索引公开地址前缀（参与图标相对路径解析与自验） |
| `HARVESTER_NGINX_ROOT` | —（`publisher=nginx` 时必填） | nginx 的 root 目录，如 `/var/www/dsh-plugin-repo` |
| `HARVESTER_NGINX_RSYNC_TARGET` | 空 | `user@host:/path`；非空则发布后 rsync 同步到 ECS |
| `HARVESTER_NGINX_RSYNC_BIN` | `rsync` | rsync 可执行文件路径 |
| `HARVESTER_NGINX_PROBE_URL` | 空 | 发布后回源自检的公开地址，如 `https://<域名>` |
| `HARVESTER_NGINX_PROBE_ATTEMPTS` | `3` | 回源自检重试次数 |
| `HARVESTER_NGINX_PROBE_DELAY_MS` | `1500` | 回源自检重试间隔（按次数递增） |
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

## 9. 凭据纪律

- `DATABASE_URL` / `GITHUB_TOKEN` 只从环境变量或本地凭据文件读，不落配置文件、
  不进 git、不进日志、不进导出物。
- **口令不经对话**。需要录入时用 `node src/cli.mjs set-secret`（隐藏输入，
  不回显、不进 shell history），或 `... | node src/cli.mjs set-secret --stdin`
  从密码管理器管道过来。写进 `harvester/.env.local`——该文件被 gitignore
  忽略，POSIX 下权限 0600。
- `set-secret --status` 可以查看当前配置状态，连接串一律脱敏显示
  （`postgres://user:***@host:5432/db`）。
- 日志统一经 `src/log.mjs` 脱敏：URI 里的口令、名字里带 token/secret/password/
  authorization/cookie 的字段一律替换成 `***`。
- 导出物（`index.json` / `index.html`）只含公共字段：不含 PG 内部字段、ratings、
  本地数据、凭据与本机路径（契约 §4.5）。实测 `index.json` 中 `C:\`、
  用户名、`DATABASE_URL` 出现次数均为 0。

## 10. 定时运行

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

也可以不用 `EnvironmentFile`，改为在机器上放一份 `/opt/dsh-plugin-repo/harvester/.env.local`
（`chmod 600`，属主 `dsh`）——发现器启动时会自动载入它。

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

## 11. 已验证 / 未验证

### 已验证

- **55 项单测通过**（`node --test test/*.test.mjs`，逐个列文件名）：
  归一化与契约 id、入库门槛、信源解析（markdown 清单 / 表格行 / format-1 索引 /
  vbarter 注册表）、索引渲染与官方校验、失败降级规则、发布守门、
  本地凭据文件（解析 / 优先级 / 写入 / 脱敏）、nginx 发布路径（原子替换 /
  不留临时文件 / 未知 publisher 报错）。
- **对 8 个真实信源跑通离线全链路**（`node src/cli.mjs collect`）：抓取 → 归一化 →
  门槛 → 渲染 → 官方 `parseMarketIndex` 自验 → 产出 `dist/index.json` + `dist/index.html`。
  实测一轮：8 个信源全部成功、0 错误、21863 个去重候选、3490 条进索引，
  索引内 npm 名 100% 合法且无重名，分类恰好落在契约的 23 个内置分类里。
- **vbarter 两个源实测**：解析数与注册表自带 stats 完全一致
  （curated 573 / discovered 20186 / published 20759）。
- **浏览页上限实测**：用真实 20759 条数据渲染，不限时 9.37 MB，
  上限 5000 时 2.27 MB（页面显示「5000 / 共 20759 个插件」）。
- **导出物卫生实测**：`index.json` 里 `C:\`、本机用户名、`DATABASE_URL`
  出现次数均为 0；`password`/`secret`/`token` 的命中全部在插件描述文本里。
- **凭据录入端到端实测**：`set-secret --stdin` 写入 → 文件格式正确 →
  `--status` 脱敏展示 → 运行时装载生效。
- **PG 连通性与 TLS 路径**：47.101.216.5:5432 可达，`sslmode=no-verify` 的 TLS
  握手成功，服务端确认账号 `dsh_plugin_harvester_rw` 存在（返回
  `28P01 password authentication failed`）。

### 未验证（需口令 / 需决策）

- **PG 写入路径未端到端跑通**：本机没有 `dsh_plugin_harvester_rw` 的口令。
  口令现在有地方放了——`node src/cli.mjs set-secret`（隐藏输入，写进
  gitignored 的 `.env.local`），**不要贴进对话**。拿到后按第 1 节跑
  `run` + `tools/contract-check.mjs` 即可完成验收 T1。
- **nginx 发布链路未连真实环境**：原子替换、目录写入、publisher 分发都有单测
  覆盖，`publisher=file` 已跑通真实产出；但**没在真实 ECS + nginx 上验证过**
  （需要 `HARVESTER_NGINX_ROOT`、域名、服务器访问权）。rsync 推送与回源自检
  的代码路径同样只到单测级别。
- **`vbarter-curated` / `vbarter-full` 已定位并接入**：源为
  `vbarter/dsh-plugin-registry` 的 `data/plugins.json`（站点 dshplugin.app），
  按 `source` 字段切成策展子集与全量自动发现两刀（见第 4 节）。
  唯一待确认的是契约 §3 的措辞「vbarter 全量自动发现」到底指
  `source=discovered`（本实现，判据：与 curated 互斥、避免同注册表重复计票）
  还是「策展+自动发现的合集」——若是后者，改 `config/sources.json` 里
  `vbarter-full` 的 `filter` 即可。
- **`publisher=oss` 未连真实 OSS**：代码路径就绪但没跑过（需要 Bucket 与 AccessKey）。
  当前渠道已定为 ECS + nginx，oss 大概率用不上。
- **L4 核验未连真实 GitHub 跑满批**：核验逻辑与事件判定有单测覆盖，
  但未用真实 PAT 跑完整批量（需要 `GITHUB_TOKEN`，同样用 `set-secret` 录入）。
- **端到端「发现页一键安装」由 Dennis 在本机完成**：本侧只保证 `index.json`
  通过 `parseMarketIndex`、PG 数据符合契约（交接说明末段）。
