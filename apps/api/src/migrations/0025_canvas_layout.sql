-- 圖的排版存進資料庫，專案共用。Ref: CR-138
--
-- 在這之前，靶心圖／關聯圖的卡片座標、收納盒尺寸、收納模式、系統流程圖的整份
-- 內容，全部只寫在使用者自己瀏覽器的 localStorage。換一台電腦、清一次快取就沒了，
-- 同專案的其他人也永遠看不到別人排好的版 —— 那等於「排版是個人的」，
-- 但實際上大家在看同一張圖。
--
-- 形狀刻意分成三塊，不是三選一硬湊：
--
--  1. project_canvas_node —— **每個節點一列**。座標、寬高、收納模式這種
--     「一個節點一組值」的東西走這裡。分開存的理由是**並行寫入**：
--     兩個人同時各拖各的卡片時，逐節點 upsert 兩邊都留得住；
--     整份 json 覆蓋則是後寫的把先寫的整個蓋掉。
--     另一個理由是**孤兒清理**：task_id 掛外鍵 ON DELETE CASCADE，
--     任務被真的刪掉時排版跟著走，不必另外寫清理工作。
--
--  2. project_canvas_doc —— **一個 view 一份 jsonb**。系統流程圖（分頁、節點、
--     連線、標籤、顏色、排序）與語法演練的片段是**整份文件**，
--     它的節點不是任務、結構也會隨畫面演進；硬拆成關聯式表等於把前端的資料結構
--     複製一份到資料庫裡，前端每加一個欄位就要發一次 migration。
--     代價是最後寫的人會蓋掉前一個人 —— 所以留了 updated_at / updated_by，
--     並在 API 上提供 baseUpdatedAt 做樂觀鎖。
--
--  3. task_link.source_handle / target_handle —— **關聯線的接點掛在關聯線上**。
--     它本來在 localStorage 裡是一張 `${source}_${target}` → handle 的表，
--     那張表跟 task_link 是一對一的，分開存只會多一份會跟主線走鐘的資料：
--     關聯線被刪掉時那筆接點就變成沒有人認得的孤兒。存回 task_link 之後，
--     刪除、級聯、權限全部沿用既有那一套，一行清理程式都不用寫。

-- ── 1. 每個節點一列的排版 ──────────────────────────────
--
-- node_id 是 text 而不是 uuid：圖上除了任務以外還有虛擬節點
-- （同時開始的橘點、同時完成的紫點、收納盒），它們的 id 不是 uuid。
-- 真的指得回任務的那些，另外用 task_id 掛外鍵拿到級聯刪除；
-- 指不回去的就留 NULL，一樣存得進來。
--
-- view_key 刻意不做白名單也不另立一張表：畫面上多一個視角時，
-- 前端換一個字串就好，不必為了「多一個頁籤」發一次 migration。
CREATE TABLE IF NOT EXISTS project_canvas_node (
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  view_key   text NOT NULL,
  node_id    text NOT NULL,
  task_id    uuid REFERENCES task(id) ON DELETE CASCADE,
  x          double precision,
  y          double precision,
  width      double precision,
  height     double precision,
  mode       text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_user(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, view_key, node_id)
);

-- 任務被硬刪時級聯要走得動，外鍵欄位得有索引，否則每刪一張任務就全表掃描
CREATE INDEX IF NOT EXISTS project_canvas_node_task_idx
  ON project_canvas_node (task_id);

-- ── 2. 一個 view 一份 jsonb 的整份文件 ──────────────────
CREATE TABLE IF NOT EXISTS project_canvas_doc (
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  doc_key    text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_user(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, doc_key)
);

-- ── 3. 關聯線兩端的接點 ────────────────────────────────
--
-- React Flow 的 handle id（如 'right-source' / 'top-target'）。
-- 沒設定就是 NULL，畫面自己挑預設的那一邊 —— 既有的關聯線全部是 NULL，
-- 行為跟改之前一模一樣，不需要回填。
ALTER TABLE task_link ADD COLUMN IF NOT EXISTS source_handle text;
ALTER TABLE task_link ADD COLUMN IF NOT EXISTS target_handle text;
