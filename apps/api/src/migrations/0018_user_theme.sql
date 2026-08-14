-- 帳號深色/淺色/跟隨系統主題偏好設定
-- 'system' | 'light' | 'dark'
ALTER TABLE app_user ADD COLUMN theme text NOT NULL DEFAULT 'system';
