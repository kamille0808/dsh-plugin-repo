-- ============================================================================
-- DSH 插件仓库 · 契约 v0.1 初始化（每个数据库执行一次：先 dev 后 prod）
-- 前置：0000_roles.sql 已执行；数据库已创建且 OWNER 为 dsh_plugin_repo_owner；
--       执行账号已 GRANT 成为 dsh_plugin_repo_owner 成员（见 0000 注释）
-- 执行人：DBA / PG 管理账号（owner 角色成员）
-- 执行方式：psql -h <host> -U <admin> -d dsh_plugin_repo_dev -f 0001_init.sql
--           psql -h <host> -U <admin> -d dsh_plugin_repo     -f 0001_init.sql
-- 警告：切勿用 dsh_plugin_client / dsh_plugin_harvester_rw 执行本脚本——
--       这两个是应用运行时账号，刻意没有 DDL 权限（会报
--       "permission denied for schema public"）。本脚本第 8-9 节才为它们授权。
-- 说明：本脚本幂等（IF NOT EXISTS / OR REPLACE），可重复执行。
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 插件主表（发现器唯一写者；只存原始信号，不存计算后的评分）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plugins (
  id              TEXT PRIMARY KEY,              -- 'owner/repo'（小写）或 'owner/repo#path:/sub'
  name            TEXT NOT NULL,                 -- 展示名（清单条目名，保留原大小写）
  npm             TEXT NOT NULL DEFAULT '',      -- npm 包名；'' = 未发布 npm
  install_spec    TEXT NOT NULL,                 -- 已过官方 parseInstallSpec 口径
  github          TEXT NOT NULL,                 -- 仓库 URL（monorepo 保留子路径）
  category_id     TEXT NOT NULL DEFAULT '',      -- 见 categories.id；'' = 未分类
  desc_zh         TEXT NOT NULL DEFAULT '',
  desc_en         TEXT NOT NULL DEFAULT '',
  license         TEXT NOT NULL DEFAULT '',
  stars           INTEGER NOT NULL DEFAULT 0,    -- GitHub API 快照值，口径见 CONTRACT.md §4
  last_push_at    TIMESTAMPTZ,                   -- 仓库最近 push（NULL = 未核验）
  npm_versions    JSONB NOT NULL DEFAULT '[]',   -- [{ver, time}]，time 可 NULL
  consensus_votes INTEGER NOT NULL DEFAULT 0,    -- 人工策展源收录票数（0-7）
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','renamed','archived','gone')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()   -- 增量同步水印，触发器维护
);

-- 水印索引：插件按 updated_at 增量拉取
CREATE INDEX IF NOT EXISTS plugins_updated_idx ON plugins (updated_at, id);
CREATE INDEX IF NOT EXISTS plugins_category_idx ON plugins (category_id);

-- updated_at 仅在业务字段真实变化时推进（发现器每轮重扫不应造成全量水印抖动；
-- 发现器自身的"上次核验时间"放 plugin_checks，不进本表）
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS plugins_touch ON plugins;
CREATE TRIGGER plugins_touch
  BEFORE UPDATE ON plugins
  FOR EACH ROW
  WHEN (OLD.name         IS DISTINCT FROM NEW.name
     OR OLD.npm          IS DISTINCT FROM NEW.npm
     OR OLD.install_spec IS DISTINCT FROM NEW.install_spec
     OR OLD.github       IS DISTINCT FROM NEW.github
     OR OLD.category_id  IS DISTINCT FROM NEW.category_id
     OR OLD.desc_zh      IS DISTINCT FROM NEW.desc_zh
     OR OLD.desc_en      IS DISTINCT FROM NEW.desc_en
     OR OLD.license      IS DISTINCT FROM NEW.license
     OR OLD.stars        IS DISTINCT FROM NEW.stars
     OR OLD.last_push_at IS DISTINCT FROM NEW.last_push_at
     OR OLD.npm_versions IS DISTINCT FROM NEW.npm_versions
     OR OLD.consensus_votes IS DISTINCT FROM NEW.consensus_votes
     OR OLD.status       IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. 收录来源（共识投票的事实依据；一插件多源）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plugin_sources (
  plugin_id  TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  source_id  TEXT NOT NULL,                      -- 名录见 CONTRACT.md §3
  listed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plugin_id, source_id)
);

-- ---------------------------------------------------------------------------
-- 3. 发现器核验状态（发现器私有，不同步给插件；避免 last_checked 扰动水印）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plugin_checks (
  plugin_id   TEXT PRIMARY KEY REFERENCES plugins(id) ON DELETE CASCADE,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  signals_hash TEXT NOT NULL DEFAULT ''          -- 信源快照哈希（diff 短路用）
);

-- ---------------------------------------------------------------------------
-- 4. 分类（内置 23 个由本脚本播种；发现器可增补上游新分类；
--    插件本地自定义分类不进库，id 约定 'local-' 前缀避免冲突）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id       TEXT PRIMARY KEY,                     -- 小写 slug，如 'ui-enhancements'
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  builtin  BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO categories (id, title_zh, title_en, builtin) VALUES
  ('ui-enhancements',            'UI 增强',            'UI Enhancements',            true),
  ('tools-capabilities',         '工具与能力',          'Tools & Capabilities',       true),
  ('sessions-messages',          '会话与消息',          'Sessions & Messages',        true),
  ('development-runtime',        '开发与运行时',        'Development & Runtime',      true),
  ('workflow-automation',        '工作流与自动化',      'Workflow & Automation',      true),
  ('models-providers',           '模型与账号接入',      'Models & Providers',         true),
  ('usage-billing',              '用量与计费',          'Usage & Billing',            true),
  ('memory',                     '记忆',               'Memory',                     true),
  ('notifications-integrations', '通知与集成',          'Notifications & Integrations', true),
  ('skills',                     '技能包',             'Skills',                     true),
  ('themes-appearance',          '主题与外观',          'Themes & Appearance',        true),
  ('security-permissions',       '安全与权限',          'Security & Permissions',     true),
  ('just-for-fun',               '娱乐',               'Just for Fun',               true),
  ('remote-mobile',              '远程与移动端',        'Remote & Mobile',            true),
  ('git-code-review',            'Git 与代码评审',      'Git & Code Review',          true),
  ('vision-multimodal',          '视觉与多模态',        'Vision & Multimodal',        true),
  ('browser-web',                '浏览器与网页',        'Browser & Web',              true),
  ('docs-rendering',             '文档与渲染',          'Docs & Rendering',           true),
  ('plugin-markets-managers',    '插件市场与管理',      'Plugin Markets & Managers',  true),
  ('wsl-windows-interop',        'WSL 与 Windows 互操作','WSL & Windows Interop',     true),
  ('voice-audio',                '语音与音频',          'Voice & Audio',              true),
  ('identity-communication',     '身份与通信',          'Identity & Communication',   true),
  ('agi-architecture-exploration','AGI 架构探索',       'AGI Architecture Exploration', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. 更新事件流（有界保留；发现器负责 90 天以前的清理）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plugin_id  TEXT NOT NULL,
  kind       TEXT NOT NULL
    CHECK (kind IN ('new-plugin','update-available','renamed','archived','removed-from-list')),
  detail     JSONB NOT NULL DEFAULT '{}',
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_id_idx ON events (id);        -- 增量游标：id 单调
CREATE INDEX IF NOT EXISTS events_plugin_idx ON events (plugin_id, id);

-- ---------------------------------------------------------------------------
-- 6. 人工评分（所有主机共享；(plugin_id, scored_by) 主键 → 各人一行）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  plugin_id  TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  scored_by  TEXT NOT NULL,                      -- '<host>-<user>'，小写 [a-z0-9-]
  score      SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  note       TEXT NOT NULL DEFAULT '',
  scored_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plugin_id, scored_by)
);

-- ---------------------------------------------------------------------------
-- 7. 发现器自身状态（游标 / 最近运行摘要 / 契约版本），CI 冷启动续跑
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS harvester_state (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- 契约版本：插件启动时读取校验；重大变更升 major 并两端同步评审
INSERT INTO harvester_state (key, value) VALUES ('contract_version', '{"major": 0, "minor": 1}')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. 属主与授权
-- ---------------------------------------------------------------------------
ALTER TABLE plugins        OWNER TO dsh_plugin_repo_owner;
ALTER TABLE plugin_sources OWNER TO dsh_plugin_repo_owner;
ALTER TABLE plugin_checks  OWNER TO dsh_plugin_repo_owner;
ALTER TABLE categories     OWNER TO dsh_plugin_repo_owner;
ALTER TABLE events         OWNER TO dsh_plugin_repo_owner;
ALTER TABLE ratings        OWNER TO dsh_plugin_repo_owner;
ALTER TABLE harvester_state OWNER TO dsh_plugin_repo_owner;

-- 插件：读公共数据 + 读全部评分；写评分仅限本人行（RLS 强制）
GRANT SELECT ON plugins, plugin_sources, categories, events, ratings TO dsh_plugin_client;
GRANT SELECT ON harvester_state TO dsh_plugin_client;   -- 只用于读 contract_version
GRANT INSERT, UPDATE ON ratings TO dsh_plugin_client;
-- 注意：不授予 dsh_plugin_client 对 plugin_checks 的任何权限

-- 发现器：catalog 全写 + 评分只读（渲染聚合用）
GRANT SELECT, INSERT, UPDATE, DELETE ON plugins, plugin_sources, plugin_checks, categories, events, harvester_state TO dsh_plugin_harvester_rw;
GRANT SELECT ON ratings TO dsh_plugin_harvester_rw;

-- ---------------------------------------------------------------------------
-- 9. ratings 行级安全：dsh_plugin_client 只能写 scored_by = 本人标识的行
--    current_setting('app.scored_by', true) 未设置时返回 NULL → 比较失败 → 拒绝（fail-closed）
-- ---------------------------------------------------------------------------
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ratings_read_all ON ratings;
CREATE POLICY ratings_read_all ON ratings
  FOR SELECT TO dsh_plugin_client, dsh_plugin_harvester_rw
  USING (true);

DROP POLICY IF EXISTS ratings_insert_own ON ratings;
CREATE POLICY ratings_insert_own ON ratings
  FOR INSERT TO dsh_plugin_client
  WITH CHECK (scored_by = current_setting('app.scored_by', true));

DROP POLICY IF EXISTS ratings_update_own ON ratings;
CREATE POLICY ratings_update_own ON ratings
  FOR UPDATE TO dsh_plugin_client
  USING (scored_by = current_setting('app.scored_by', true))
  WITH CHECK (scored_by = current_setting('app.scored_by', true));

COMMIT;
