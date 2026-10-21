# dsh-plugin-repo V2 开发计划

> 版本：v1（2026-10-21）｜设计：[client-ui-v2-design.md](client-ui-v2-design.md)
> 方法论沿用：隔离 DSH_HOME 试启动验证先行，主 App 重启验收在后。

## 任务分解

### T2-1 宿主：本地分类/labels 写路径

- [ ] `pluginRecord` 加 `localCategoryId`（default ''）；同步 mapRow 保留该字段；
- [ ] `PluginRepoRemote` 新增 `setLabels / setLocalCategory / addCategory / removeCategory`（描述符 methods 同步追加；统一 `{ok|ok:false,error.code}` 返回风格；写后 emit `plugin-repo/local-changed`）；
- [ ] `search`/`categories` 改按生效分类（`localCategoryId || categoryId`）过滤与计数；
- [ ] 语法检查 + 隔离环境冒烟：`POST /api/pluginRepo/addCategory` 等四个方法逐一过。

### T2-2 客户端：子视图框架 + 已安装视图

- [ ] store 加 `view` 字段与切换 UI（三个 Pill）；
- [ ] 已安装视图：`remote.pluginManager.listBundles()` + 镜像 join；启用/禁用/移除（二次确认）；订阅 `plugin-manager/changed` 刷新；
- [ ] 未命中镜像的 bundle 标注「不在仓库镜像」。

### T2-3 客户端：分类管理 + 详情增量

- [ ] 分类管理视图（内置只读 + 本地增删 + 分类下插件列表与移入/移出）；
- [ ] 详情抽屉：labels 编辑器 + 本地分类下拉 + 「安装」按钮（`installBundle`，结果内联展示；复制 spec 保留为降级）；
- [ ] 卡片 labels 角标（≤3 个）。

### T2-4 验证与交付

- [ ] 构建（build.mjs）+ 协议自测；
- [ ] 隔离环境按设计文档 §5 五条验收跑一遍；
- [ ] 回归基线四项（plugin_repo 工具五动作 / 6084 镜像 / RLS 三验证 / 契约无变更）；
- [ ] 用户重启主 App 验收 → commit + push（敏感信息复检）。

## 估算与风险

- 估算：T2-1 0.2d ｜ T2-2 0.3d ｜ T2-3 0.4d ｜ T2-4 0.2d，合计约 1 天。
- 风险：
  - `remote.pluginManager` 从社区插件客户端调用的权限面未实测（官方页面同源调用）→ T2-2 先做只读 listBundles 冒烟，写动作随后；
  - installBundle 耗时操作（pnpm）→ UI 用 requestId + waitForInstall/cancelInstall 呈现进度，失败展示 install-log 摘要；
  - 镜像 join 按 npm 名可能漏配（仅 GitHub 的插件）→ 兜底按 installSpec 含名匹配，不命中就标「不在仓库镜像」。
