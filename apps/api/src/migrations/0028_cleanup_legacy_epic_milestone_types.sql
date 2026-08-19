-- 0028_cleanup_legacy_epic_milestone_types.sql
-- 全面清理與校正所有舊專案中殘留的 EPIC 與 MILESTONE 類型，統一收斂為標準的 TASK (任務單)

UPDATE task
SET type = 'TASK'
WHERE type NOT IN ('TASK', 'BUG');
