-- ============================================================================
-- DSH 插件仓库 · 角色初始化（cluster 级，整个 PG 集群只执行一次）
-- 执行人：DBA / PG 管理账号
-- 执行方式：psql -h <host> -U <admin> -d postgres -f 0000_roles.sql
-- 注意：执行前把三处 '__CHANGE_ME__' 替换为强口令（建议 ≥24 位随机串），
--       口令不进仓库、不进日志；分发走各自的秘密管理渠道。
-- ============================================================================

-- 表所有者：不登录，仅作为对象 owner 存在（配合 RLS，业务账号都不是 owner）
CREATE ROLE dsh_plugin_repo_owner NOLOGIN;

-- 【SET ROLE 报错修复】让执行迁移的管理账号成为 owner 角色成员。
-- CREATE DATABASE ... OWNER / ALTER TABLE ... OWNER TO 都要求执行者能 SET ROLE
-- 到属主角色；云 RDS 高权限账号不是真 superuser，缺这步会报：
--   ERROR: must be able to SET ROLE "dsh_plugin_repo_owner"
-- 把 '__ADMIN_ACCOUNT__' 换成你执行迁移的账号名后执行：
-- GRANT dsh_plugin_repo_owner TO __ADMIN_ACCOUNT__;

-- 发现器专用：catalog 数据的唯一写者
-- 口令不入库：提交版本一律用 '__CHANGE_ME__' 占位，执行时以 psql 变量注入或临时改回
CREATE ROLE dsh_plugin_harvester_rw LOGIN PASSWORD '__CHANGE_ME_harvester__';
ALTER ROLE dsh_plugin_harvester_rw SET statement_timeout = '10min';
ALTER ROLE dsh_plugin_harvester_rw CONNECTION LIMIT 5;

-- 插件专用：读全部 + 只能写本人评分行（行级限制由 0001 的 RLS 强制）
CREATE ROLE dsh_plugin_client LOGIN PASSWORD '__CHANGE_ME_plugin__';
ALTER ROLE dsh_plugin_client SET statement_timeout = '30s';
ALTER ROLE dsh_plugin_client CONNECTION LIMIT 20;

-- ============================================================================
-- 配套必做（公网暴露基线，需在 postgresql.conf / pg_hba.conf 落实，不属于本脚本）：
--   1) ssl = on，pg_hba 中本库相关条目使用 hostssl，拒绝 host（明文）连接；
--   2) pg_hba 按来源收紧：发现器运行位固定出口 IP / 插件主机网段，其余拒绝；
--   3) 两个库创建（属主 dsh_plugin_repo_owner；先完成上面的 GRANT 成员授权）：
--        CREATE DATABASE dsh_plugin_repo      OWNER dsh_plugin_repo_owner;
--        CREATE DATABASE dsh_plugin_repo_dev  OWNER dsh_plugin_repo_owner;
--      （也可由 DBA 先建库再 ALTER DATABASE ... OWNER TO dsh_plugin_repo_owner）
--
-- 【安全提醒】本文件当前含真实口令，切勿提交进 Codeup 仓库；建议改为 psql 变量
-- 注入（口令只存在于执行环境）：
--   CREATE ROLE dsh_plugin_harvester_rw LOGIN PASSWORD :'harvester_pw';
--   psql -v harvester_pw='***' -f 0000_roles.sql
-- 若本文件已被提交，请尽快轮换这两个口令（ALTER ROLE ... PASSWORD）。
-- ============================================================================
