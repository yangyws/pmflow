-- Ref: CR-145
-- 順序不能反：先搬資料，再換 CHECK 約束。
-- 反過來做的話舊的 COMMENTER 資料會違反新約束，整份 migration 會失敗。

-- 1) COMMENTER 的實際權限跟 VIEWER 一模一樣，降成檢視者對這些人沒有任何影響
UPDATE project_member SET role = 'VIEWER' WHERE role = 'COMMENTER';

-- 2) 換掉 0001_init.sql 建的 role CHECK（自動命名為 project_member_role_check）。
--    仍用動態查詢把「定義裡含 COMMENTER 的 CHECK」全部掃掉，
--    避免某些資料庫上約束名稱不同而漏網。重跑安全：先 DROP 再 ADD。
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'project_member'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%COMMENTER%'
  LOOP
    EXECUTE format('ALTER TABLE project_member DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE project_member DROP CONSTRAINT IF EXISTS project_member_role_check;
ALTER TABLE project_member ADD CONSTRAINT project_member_role_check
  CHECK (role IN ('MANAGER','EDITOR','VIEWER'));
