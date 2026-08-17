-- Ref: CR-149
-- 站台自己產生、要跨重啟活著的祕密（目前只有 JWT 簽章金鑰）。
-- 放資料庫而不是檔案：資料庫是備份排程裡本來就有的那一份，
-- 而掛載路徑每個人的 NAS 都不一樣。
CREATE TABLE IF NOT EXISTS app_secret (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
