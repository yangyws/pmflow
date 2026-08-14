-- 將預設事件類型「任務」名稱統一為「事件」
UPDATE task_type SET name = '事件' WHERE key = 'TASK' AND name = '任務';
