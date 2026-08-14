-- 事件類型清單僅保留「任務單」與「問題單」，刪除/停用其他種類
DELETE FROM task_type WHERE key NOT IN ('TASK', 'BUG');
UPDATE task SET type = 'TASK' WHERE type NOT IN ('TASK', 'BUG');
