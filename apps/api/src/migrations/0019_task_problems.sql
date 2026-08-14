-- 任務遭遇問題與解決歷程表
CREATE TABLE IF NOT EXISTS task_problem_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  problem text NOT NULL,
  solution text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES app_user(id) ON DELETE SET NULL,
  created_by uuid REFERENCES app_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_problem_history_task ON task_problem_history(task_id, created_at DESC);
