-- ══════════════════════════════════════════════════════════
-- PMFlow NAS 初始資料種子範例 (01_demo_seed.sql)
-- 預設登入帳號：demo@pmflow.local / demo1234
-- ══════════════════════════════════════════════════════════

BEGIN;

-- 1. 建立示範工作區
INSERT INTO workspace (id, slug, name)
VALUES ('01900000-0000-7000-8000-000000000001', 'demo', '示範工作區')
ON CONFLICT (id) DO NOTHING;

-- 2. 建立示範管理員帳號 (密碼: demo1234)
INSERT INTO app_user (id, email, password_hash, display_name, status, email_verified_at)
VALUES (
  '01900000-0000-7000-8000-000000000002',
  'demo@pmflow.local',
  'scrypt$32768$8$1$cG1mbG93ZGVtb3NhbHQxNg==$WPHWpyX+F8k60zsOZqBH22SwVEBiSbgh8fEg5GRTN9C345Hj7SCWdLFS9gsE3IE0q43Qkw0oufKJunlTGmLovQ==',
  '示範管理者',
  'ACTIVE',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 3. 加入工作區成員 (OWNER)
INSERT INTO workspace_member (workspace_id, user_id, role)
VALUES ('01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000002', 'OWNER')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 4. 建立專案：機房搬遷 (MRG)
INSERT INTO project (id, workspace_id, key, name, color, start_date, end_date, rank, created_by)
VALUES (
  '01900000-0000-7000-8000-000000000003',
  '01900000-0000-7000-8000-000000000001',
  'MRG', '機房搬遷專案', '#3178c6',
  CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '45 days',
  1000,
  '01900000-0000-7000-8000-000000000002'
)
ON CONFLICT (id) DO NOTHING;

-- 5. 專案成員
INSERT INTO project_member (project_id, user_id, role)
VALUES ('01900000-0000-7000-8000-000000000003', '01900000-0000-7000-8000-000000000002', 'MANAGER')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 6. 建立專案狀態清單
INSERT INTO task_status (project_id, key, name, category, color, rank) VALUES
  ('01900000-0000-7000-8000-000000000003', 'todo',      '待辦',     'TODO',   '#94a3b8', 1000),
  ('01900000-0000-7000-8000-000000000003', 'doing',     '進行中',   'ACTIVE', '#3178c6', 2000),
  ('01900000-0000-7000-8000-000000000003', 'review',    '待驗收',   'ACTIVE', '#e07b39', 3000),
  ('01900000-0000-7000-8000-000000000003', 'verifying', '驗證中',   'ACTIVE', '#8b5cf6', 3200),
  ('01900000-0000-7000-8000-000000000003', 'verified',  '驗證完成', 'DONE',   '#0d9488', 3500),
  ('01900000-0000-7000-8000-000000000003', 'done',      '已完成',   'DONE',   '#2e8b57', 4000)
ON CONFLICT (project_id, key) DO NOTHING;

-- 7. 建立任務類型與優先度參數
INSERT INTO project_parameter (project_id, kind, key, name, color, rank) VALUES
  ('01900000-0000-7000-8000-000000000003', 'type', 'TASK', '任務', '#3b82f6', 1000),
  ('01900000-0000-7000-8000-000000000003', 'type', 'BUG',  '問題', '#ef4444', 2000),
  ('01900000-0000-7000-8000-000000000003', 'priority', 'LOW',     '低', '#94a3b8', 1000),
  ('01900000-0000-7000-8000-000000000003', 'priority', 'NORMAL',  '中', '#3b82f6', 2000),
  ('01900000-0000-7000-8000-000000000003', 'priority', 'HIGH',    '高', '#f59e0b', 3000),
  ('01900000-0000-7000-8000-000000000003', 'priority', 'URGENT',  '緊急', '#ef4444', 4000)
ON CONFLICT (project_id, kind, key) DO NOTHING;

-- 8. 建立示範任務
-- (1) 父任務 / 收納盒 1
INSERT INTO task (id, project_id, workspace_id, number, title, type, status_key, priority, start_date, due_date, progress, created_by, rank)
VALUES (
  '01900000-0000-7000-8000-000000000011',
  '01900000-0000-7000-8000-000000000003',
  '01900000-0000-7000-8000-000000000001',
  1, '前期評估與環境盤點', 'TASK', 'doing', 'HIGH',
  CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '5 days', 60,
  '01900000-0000-7000-8000-000000000002', 1000
) ON CONFLICT (id) DO NOTHING;

-- (2) 子任務 A (掛在任務 1 底下)
INSERT INTO task (id, project_id, workspace_id, parent_id, number, title, type, status_key, priority, start_date, due_date, progress, assignee_id, created_by, rank)
VALUES (
  '01900000-0000-7000-8000-000000000012',
  '01900000-0000-7000-8000-000000000003',
  '01900000-0000-7000-8000-000000000001',
  '01900000-0000-7000-8000-000000000011',
  2, '伺服器機櫃空間配置確認', 'TASK', 'done', 'NORMAL',
  CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '3 days', 100,
  '01900000-0000-7000-8000-000000000002', '01900000-0000-7000-8000-000000000002', 2000
) ON CONFLICT (id) DO NOTHING;

-- (3) 子任務 B (掛在任務 1 底下)
INSERT INTO task (id, project_id, workspace_id, parent_id, number, title, type, status_key, priority, start_date, due_date, progress, assignee_id, created_by, rank)
VALUES (
  '01900000-0000-7000-8000-000000000013',
  '01900000-0000-7000-8000-000000000003',
  '01900000-0000-7000-8000-000000000001',
  '01900000-0000-7000-8000-000000000011',
  3, '網路專線與頻寬升級測試', 'TASK', 'doing', 'HIGH',
  CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 40,
  '01900000-0000-7000-8000-000000000002', '01900000-0000-7000-8000-000000000002', 3000
) ON CONFLICT (id) DO NOTHING;

-- 9. 建立任務依賴連線 (任務 2 完成後開始任務 3, FS 依賴)
INSERT INTO task_link (id, source_id, target_id, link_type, lag_days)
VALUES (
  '01900000-0000-7000-8000-000000000021',
  '01900000-0000-7000-8000-000000000012',
  '01900000-0000-7000-8000-000000000013',
  'FS', 0
) ON CONFLICT (id) DO NOTHING;

COMMIT;
