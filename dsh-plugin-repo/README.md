# dsh-plugin-repo

DSH 插件仓库（组件③）。从 PostgreSQL 中心库增量同步社区插件目录，为 Agent 提供只读检索工具 `plugin_repo`；人工评分写回中心库（RLS 限本人行）。

- **数据契约**：[`../contract/CONTRACT.md`](../contract/CONTRACT.md)（v0.1）
- **发现器**：独立组件（组件①，另一主机开发与运行），本插件不依赖其在线
- **安装动作**：一律走 `plugin_manager`（`install_bundle`），保留 DSH 的审批与版本检查

## 安装

```sh
# 桌面 App（Electron）用 desktop profile：
dsh plugin --profile desktop add /abs/path/to/dsh-plugin-repo
# 浏览器模式（dsh web）用 web profile：
dsh plugin --profile web add /abs/path/to/dsh-plugin-repo
```

> 注意：桌面 App 的 GUI 由 **desktop** profile 驱动（宿主源码：`runProfile({ profile: "desktop" })`），
> 装进 web profile 的插件在桌面 GUI 里不可见；desktop profile 的组合归 Electron 独占管理
> （`--dump-config` 对其不可用），插件增删用 `dsh plugin --profile desktop ...`。

## 配置（profile 中本插件行的 config）

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `databaseUrl` | `''` | PG 连接串（`dsh_plugin_client` 账号）。TLS 必带：联调 `?sslmode=no-verify`，正式 `?sslmode=verify-full&sslrootcert=<RDS CA 路径>`。为空 = 同步停用，仅用本地镜像 |
| `scoredBy` | `''` | 本机评分标识 `<host>-<user>`（小写），对应 RLS 的 `app.scored_by` |
| `syncIntervalSeconds` | `600` | 同步循环间隔（≥60） |
| `syncBatchSize` | `500` | 单批拉取行数 |
| `githubToken` | `''` | 可选 PAT，仅用于 `check` 动作的即席核验 |

## 模型工具 plugin_repo（只读）

| action | 说明 |
| --- | --- |
| `search` | 关键词检索本地镜像（名称/npm/简介），可按分类过滤、分页；按共识票/star 排序 |
| `entry` | 单个插件详情 + 评分摘要 + 最近更新事件 + 安装 spec |
| `categories` | 分类列表与插件数 |
| `updates` | 最近的更新事件流 |
| `check` | 对单个 `owner/repo` 做 GitHub 即席核验（是否像 DSH bundle、star、归档状态） |

返回的 `installSpec` 可直接传给 `plugin_manager` 的 `install_bundle`。

## 本地镜像

`ctx.storageDomain` 域 `plugin_repo`（v1，per-record）：plugins / categories / ratings / events / sync_state。
PG 是权威、本地是镜像；PG 不可达时检索与浏览不受影响。

## 许可

MIT。种子数据来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（CC0-1.0）。
