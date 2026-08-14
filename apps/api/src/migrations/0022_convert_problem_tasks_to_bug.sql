-- 將掛在其他任務單下且填有問題的子任務轉為問題單 (BUG)
UPDATE task
SET type = 'BUG'
WHERE parent_id IS NOT NULL AND problem IS NOT NULL AND type = 'TASK';
