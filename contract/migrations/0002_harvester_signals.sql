-- ============================================================================
-- DSH 插件仓库 · 契约 v0.2 增量（发现器侧提案，minor 升级）
--
-- 变更类型：minor（加列 + 澄清索引字段口径）—— 两端无需同步发布，插件侧
--           只校验 major（契约 §5.6 / §9），major 仍为 0，不受影响。
--
-- 变更内容：
--   1) plugins.git_commit
--      发现器 L4 核验到的默认分支 HEAD 提交 SHA（40 位小写 hex）。
--      用途：format-1 索引的 git 源条目必须有 40 位 commit 才有可钉住的可安装
--      版本（@deepseek-ai/dsh-plugin-market-index 的 source.type='git' 要求）。
--      这是「原始信号」，不是计算后的评分，符合契约 §7 的无立场原则。
--
--   2) plugin_checks.miss_streak
--      连续核验未命中（GitHub 404）的次数。契约 §6 规定「连续多轮核验 404 →
--      gone」，计数需要落在发现器私有表里（plugin_checks 本就是发现器私有、
--      插件侧无任何权限的表，不扰动 plugins 水印）。
--      见 migrations/0001_init.sql 第 3 节注释。
--
--   3) 契约 §8 澄清：format-1 索引的字段名以官方 parseMarketIndex 为准
--      （versions[].publishTimestamp 与 versions[].source 必填，v0.1 的
--      「versions[{version, published, engines}]」表述不完整，无法通过官方校验）。
--      本次只改文档表述，不改表结构。
--
-- 执行人：DBA / PG 管理账号（owner 角色成员）
-- 执行方式：psql -h <host> -U <admin> -d dsh_plugin_repo_dev -f 0002_harvester_signals.sql
--           psql -h <host> -U <admin> -d dsh_plugin_repo     -f 0002_harvester_signals.sql
-- 幂等：可重复执行。
-- ============================================================================

BEGIN;

-- 1) 仓库 HEAD 提交（format-1 git 源）
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS git_commit TEXT NOT NULL DEFAULT '';

-- 2) 连续核验未命中计数（gone 判定）
ALTER TABLE plugin_checks ADD COLUMN IF NOT EXISTS miss_streak INTEGER NOT NULL DEFAULT 0;

-- 3) 契约版本：minor 0.1 → 0.2
INSERT INTO harvester_state (key, value) VALUES ('contract_version', '{"major": 0, "minor": 2}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
