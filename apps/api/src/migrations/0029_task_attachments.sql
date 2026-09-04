-- 任務單（文件）與問題單（圖片）附件儲存表
CREATE TABLE IF NOT EXISTS task_attachment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES app_user(id) ON DELETE SET NULL,
  filename    text NOT NULL,
  stored_name text NOT NULL,
  mime_type   text NOT NULL,
  file_size   bigint NOT NULL,
  kind        text NOT NULL DEFAULT 'file',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_attachment_task_idx ON task_attachment (task_id);
