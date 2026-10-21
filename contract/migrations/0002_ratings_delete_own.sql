-- 0002：unrate 支持 —— ratings 授予 DELETE（minor 0.2，契约 §7 人工分补删除语义）
-- 幂等：可重复执行。执行账号需为 dsh_plugin_repo_owner 成员（见 0000 注释）。
-- 变更内容：GRANT DELETE ON ratings TO dsh_plugin_client（仍受 RLS 限制，只能删本人行）。
BEGIN;

GRANT DELETE ON ratings TO dsh_plugin_client;

DROP POLICY IF EXISTS ratings_delete_own ON ratings;
CREATE POLICY ratings_delete_own ON ratings
  FOR DELETE TO dsh_plugin_client
  USING (scored_by = current_setting('app.scored_by', true));

COMMIT;
