-- 清理非問題單 (TASK) 上殘留的舊版 problem 字串，確保全面由子問題單 (BUG) 機制統一管理
UPDATE task
SET problem = NULL
WHERE type != 'BUG' AND problem IS NOT NULL;
