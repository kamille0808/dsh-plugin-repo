# DSH 插件仓库 · 工作区

「DSH 插件仓库」项目工作区：方案、数据契约、种子脚本与插件本体。

## 项目产物

| 想看什么 | 去哪看 |
| --- | --- |
| **设计方案**（v1 已评审，含双主机协作计划 §7） | [dsh-plugin-repo-design.md](dsh-plugin-repo-design.md) |
| **可视化管理设计方案 + 开发计划**（客户端 UI，M4） | [docs/client-ui-design.md](docs/client-ui-design.md) · [docs/client-ui-dev-plan.md](docs/client-ui-dev-plan.md) |
| **V1 方案与计划**（评分录入/客观分/事件时间线） | [docs/client-ui-v1-design.md](docs/client-ui-v1-design.md) · [docs/client-ui-v1-dev-plan.md](docs/client-ui-v1-dev-plan.md) |
| **数据契约 v0.1**（两端唯一接口）+ PG migrations | [contract/](contract/CONTRACT.md) |
| **种子导入脚本**（归档 6084 条 → PG；发现器 L0 参考实现） | [tools/seed/](tools/seed/seed.mjs) |
| **插件本体**（DSH bundle：PG 增量同步 + plugin_repo 工具） | [dsh-plugin-repo/](dsh-plugin-repo/README.md) |

分工：本机开发插件（组件③）；另一主机开发并持续运行发现器（组件①）。协作推进计划见设计文档 §7。

## 先期调研归档

| 想看什么 | 去哪看 |
| --- | --- |
| 结论、方法、风险、来源核验 | [dsh-plugin-repo-archive/docs/RESEARCH.md](dsh-plugin-repo-archive/docs/RESEARCH.md) |
| 全量 6084 条插件（Markdown / CSV / JSON） | [dsh-plugin-repo-archive/docs/](dsh-plugin-repo-archive/docs/) |
| 紧凑检索目录 + 官方 20 项清单 | [dsh-plugin-repo-archive/data/](dsh-plugin-repo-archive/data/) |
| 归档说明、许可、复核方法 | [dsh-plugin-repo-archive/README.md](dsh-plugin-repo-archive/README.md) |

数据自检：`python3 dsh-plugin-repo-archive/scripts/validate_data.py`（17/17 通过）。

## 当前状态（2026-10-20）

- 契约包 / 种子脚本 / 插件骨架已完成，静态验证通过（见设计文档 §7.5 与本机交付说明）；
- 待 DBA 执行 `contract/migrations/` 两个 SQL 后，种子脚本即可灌库联调；
- 插件待真机安装验证（`dsh plugin --profile web add <abs path>`）。
