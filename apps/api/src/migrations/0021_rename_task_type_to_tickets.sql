-- 將事件類型名稱統一為「任務單」與「問題單」
UPDATE task_type SET name = '任務單' WHERE key = 'TASK';
UPDATE task_type SET name = '問題單' WHERE key = 'BUG';
