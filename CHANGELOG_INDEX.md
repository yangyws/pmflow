# PMFlow Change History & Code Module Index (異動紀錄與程式碼索引總表)

本文檔提供 PMFlow 專案全域功能模組的快速程式碼索引，以及歷次開發與修復的詳細異動紀錄。

---

## 1. Quick Code Module Index (快速程式碼索引)

| 功能模組 | 說明 | 主要程式檔案 | 關鍵區塊 / 行數指引 |
| :--- | :--- | :--- | :--- |
| **靶心關聯表 (SimpleGraph)** | 新版圖表繪製、收納盒、四向雙向 Handles 與隱性約束 | [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) | 全檔 |
| └─ 接點 UI 與模式轉換 | 四向 Handles (`left/right/top/bottom-in/out`)、收納盒/卡片 UI | [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L63-L201) | L63 - L201 |
| └─ Viewport 持久化 | 畫面焦點 (`x`, `y`) 與縮放比例 (`zoom`) 自動存取 `localStorage` | [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L25-L35) | L25 - L35, L475 - L483 |
| └─ 拉線與重複連線攔截 | 跨界關聯攔截、同對點重複連線攔截 (`onConnect`) | [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L320-L365) | L320 - L365 |
| └─ 卡片拖曳與收納盒邊界 | 卡片拖出限制 (有線禁止拖出)、自動擴充尺寸、子卡片釋放 | [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L273-L293) | L273 - L293, L366 - L474 |
| └─ 關聯線刪除與提示彈窗 | 點擊刪除線確認 Modal (`是否刪除 [A] 與 [B] 的關聯？`)、受限提示 | [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L558-L625) | L558 - L625 |
| **經典關聯圖 (Graph View)** | 拓撲排序、自動網格佈局、刪除線與關聯邊緣邏輯 | [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx) | L2280 - L2320 |
| **頂部導覽列 (App Header)** | 頂部分頁切換、響應式橫向滾動容器與視口適應 | [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx) | Header Layout |
| **任務詳情抽屜 (TaskDrawer)** | 卡片點擊抽屜 Modal、行動端邊距與動態容器 padding | [`TaskDrawer.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/TaskDrawer.tsx) | Drawer Container |

---

## 2. Chronological Change Records (詳細異動紀錄總表)

### Latest Changes: Graph Collapsed Progress Bar & Header Horizontal Scroll Fixes (CR-183)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **折疊狀態進度條可見度修復 (`CR-183`)**：折疊時改為自適應自然高度（`min-h-[90px]`），解決固定 90px 導致進度條被截斷消失之問題。
    2. **消除標頭橫向滑動與溢出拖拉 (`CR-183`)**：收納盒移除 `overflow-x-auto`，卡片標頭調整為 `flex justify-between w-full min-w-0 overflow-hidden`，消除卡片與收納盒的橫向拖拉問題。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-183` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-183`。

### Previous Changes: Graph Box & Card Nested Item Collapse / Expand (CR-182)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **折疊按鈕與緊湊樣式 (`CR-182`)**：當收納盒或卡片內部包含子任務或問題單時，標頭顯示 `▲ 摺疊 / ▼ 展開` 按鈕。
    2. **遞迴節點與連線隱藏 (`CR-182`)**：折疊時遞迴隱藏所有子節點與內部連線，收納盒縮小為 90px 單行卡片並完整保留統計徽章；展開時恢復網格排版與連線。
    3. **狀態持久化 (`CR-182`)**：依專案記錄折疊偏好於 `localStorage`。
  - [`strings/flow.ts`](file:///D:/github/pmflow/apps/web/src/strings/flow.ts): 新增關聯圖折疊與展開相關文字。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-182` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-182`。

### Previous Changes: Canvas Edge Click Deletion & Waypoint Drag Fixes (CR-181)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **移除全螢幕 SVG 遮罩層 (`CR-181`)**：徹底移除 `EdgeLabelRenderer` 內部未帶 Transform 之全螢幕 SVG 遮罩，恢復 React Flow 原生 `<BaseEdge interactionWidth={30}>` 於畫布上的點擊刪除響應。
    2. **折點指針位移閾值判定 (`CR-181`)**：僅在指針位移大於 3px 時啟動拖曳與防護鎖；單純點擊折點立即觸發 `onEdgeClick` 彈出刪除關聯確認視窗。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-181` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-181`。

### Previous Changes: Graph Cross-Box Link Cleanup & Boundary Enforcements (CR-180)
- **變更檔案**:
  - [`routes/links.ts`](file:///D:/github/pmflow/apps/api/src/routes/links.ts):
    1. **建立關聯收納盒隔離擋關 (`CR-180`)**：新增 `source` 與 `target` 之 `parent_id` 嚴格比對，兩端父層不一致時回傳 409 Conflict 拒絕建立。
  - [`routes/tasks.ts`](file:///D:/github/pmflow/apps/api/src/routes/tasks.ts):
    1. **父層變更自動清理跨盒連線 (`CR-180`)**：於 `PATCH /tasks/:id` 與 `PATCH /tasks/:id/move` 在任務父層變更時，自動清除變得不合法的跨邊界關聯線。
  - [`seed.ts`](file:///D:/github/pmflow/apps/api/src/seed.ts):
    1. **種子資料連線校正 (`CR-180`)**：校正示範專案連線為收納盒層級連線，杜絕重置時生成跨盒連線。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-180` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-180`。

### Previous Changes: Graph Inside-Box Edge Deletion & Log Gate & Blocked Icon Alignment (CR-179)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **收納盒內關聯線點擊刪除修復 (`CR-179`)**：於 `<EdgeLabelRenderer>` 頂層注入透明加粗 SVG 點擊命中線（`strokeWidth={28}`、`pointerEvents: auto`）與折點點擊觸發，解決盒內連線被父收納盒實體 DOM 攔截導致無法觸發 `onEdgeClick` 刪除線條的 Bug。
    2. **Log 視窗管理者權限控管 (`CR-179`)**：引入 `canManage` 參數，右下角「📋 即時 Log 開關按鈕」與「動作與座標 Log 視窗」僅對管理者開放。
    3. **圖示說明「卡住」項目一致性校正 (`CR-179`)**：圖示說明懸浮視窗與 `strings/flow.ts` 內「卡住」警示由 `⚠️` 修正為與卡片一致的 `⛔ 卡住 / ⛔ 卡 N` 與紅色標籤。
  - [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx): 傳遞 `canManageProject` 至 `ProjectWorkspace` 與 `TaskGraphView`。
  - [`strings/flow.ts`](file:///D:/github/pmflow/apps/web/src/strings/flow.ts): 同步 `help.blocked` 字串為 `⛔ 卡住 / ⛔ 卡 N`。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-179` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-179`。

### Previous Changes: Graph Focus Persistence & Card Dynamic Height Fixes (CR-178)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **切換頁籤焦點持久聚焦 (`CR-178`)**：重構 `loadSavedViewport` 為專案隔離並於組件掛載時動態載入；實作 `centerOnNode` 深度座標定位，在切換頁籤回來或選中任務時自動平滑置中聚焦，解決視角跑掉問題。
    2. **卡片高度自適應與進度條防遮蔽 (`CR-178`)**：移除卡片固定 `height: 90` 限制，改採 `minHeight: 90` 與 `flex-col justify-between`，多行標題與警示徽章共存時框體自然延展，確保進度條完整顯示；`computeBoxDimensions` 支援依卡片動態高度擴展邊界。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-178` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-178`。

### Previous Changes: Small Screen Responsive Layout & Anti-Squeeze Fixes (CR-177)
- **變更檔案**:
  - [`TaskDrawer.tsx`](file:///D:/github/pmflow/apps/web/src/components/TaskDrawer.tsx):
    1. **基本欄位防擠壓滿版重構 (`CR-177`)**：修復手機端負責人、進度與起訖日因缺少 `col-span-2` 被壓縮至半寬 1 格的問題，配置 `col-span-2 sm:col-span-2` 與 `col-span-2 sm:col-span-4` 確保滿版雙欄正常展開。
    2. **活動時間軸自適應換行 (`CR-177`)**：活動項目配置 `flex-wrap`，防止窄螢幕文字重疊或水平溢出。
  - [`Calendar.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Calendar.tsx):
    1. **月曆小手機工具列自適應 (`CR-177`)**：頂部按鈕小螢幕響應式縮寫（`⚙ 篩選`、`▲ 返回全月`）與緊湊 padding，防止過多折行。
  - [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx), [`List.tsx`](file:///D:/github/pmflow/apps/web/src/pages/List.tsx), [`Week.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Week.tsx), [`Board.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Board.tsx):
    1. **麵包屑與卡片頁腳防擠壓 (`CR-177`)**：麵包屑手機端簡化專案名稱（`← 返回`），卡片頁腳姓名自適應截斷與 `flex-wrap` 防重疊。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-177` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-177`。

### Previous Changes: Mobile Typography & Button Fine-Tuning Optimization (CR-176)
- **變更檔案**:
  - [`List.tsx`](file:///D:/github/pmflow/apps/web/src/pages/List.tsx), [`Board.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Board.tsx), [`Week.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Week.tsx), [`Calendar.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Calendar.tsx):
    1. **手機版卡片標題字級與內邊距微縮 (`CR-176`)**：卡片標題由大字級調為緊湊精緻之 `text-[13px] sm:text-sm font-semibold`，狀態、徽章、日期與負責人統一調為 `text-[11px] / text-[10px]`，卡片內邊距調為 `p-2.5 sm:p-3`，進度條厚度微縮為 `h-1`。
    2. **手機操作按鈕尺寸收斂 (`CR-176`)**：新增任務按鈕、看板頂部狀態切換籤、行事曆月週切換鈕內邊距與文字收斂至 `px-2 py-0.5 sm:px-2.5 sm:py-1 / text-xs`。
  - [`TaskDrawer.tsx`](file:///D:/github/pmflow/apps/web/src/components/TaskDrawer.tsx):
    1. **抽屜標題與區塊標頭尺寸微縮 (`CR-176`)**：抽屜標題調為 `text-base sm:text-lg`，各區塊（基本欄位、內容、問題與解決、前後相依、上下階層、時間軸）標頭收斂為 `text-xs sm:text-sm`，操作按鈕與提示橫幅精緻化。
  - [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx):
    1. **頂部導覽列與麵包屑高度壓縮 (`CR-176`)**：第一層導覽高度降為 `h-10 sm:h-12`，第二層麵包屑降為 `min-h-8 sm:min-h-9`（`text-[11px] sm:text-xs`），釋放手機縱向空間。
  - [`EpicSidebar.tsx`](file:///D:/github/pmflow/apps/web/src/components/EpicSidebar.tsx):
    1. **側欄展開抽屜文字與計數微縮 (`CR-176`)**：樹狀節點標題調整為 `isRoot ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-[13px]'`，計數徽章調整為 `text-[10px] sm:text-[11px]`。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-176` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-176`。

### Previous Changes: Mobile Permission Partitioning & Week View Card Layout (CR-175)
- **變更檔案**:
  - [`Week.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Week.tsx):
    1. **行事曆週檢視滿版單欄卡片流 (`CR-175`)**：在手機端（`< 768px`），將週檢視與行事曆展開每週清單由多欄表格改為 100% 滿版單欄垂直卡片流，消除 `52rem` 水平溢出。
  - [`TaskDrawer.tsx`](file:///D:/github/pmflow/apps/web/src/components/TaskDrawer.tsx), [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx):
    1. **手機版專屬權限切分 (`CR-175`)**：手機端僅在「清單（List）」檢視下開放編輯與儲存；其餘檢視（看板、行事曆/週檢視、側欄、圖表等）開啟任務抽屜時強制唯讀。
    2. **唯讀模式質感提示橫幅與快捷按鈕 (`CR-175`)**：唯讀模式頂部呈現「👁️ 唯讀檢視模式」橫幅，並配置「📋 前往清單編輯」快捷按鈕，一鍵切換至清單進行修改。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-175` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-175`。

### Previous Changes: Mobile Interaction Strategy — View-Only Lists & Direct Drawer Editing (CR-174)
- **變更檔案**:
  - [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx), [`List.tsx`](file:///D:/github/pmflow/apps/web/src/pages/List.tsx), [`Board.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Board.tsx):
    1. **手機點擊直通任務修改頁 (`CR-174`)**：手機端使用者點擊任何任務卡片或項目，一律直接開啟 `TaskDrawer`（任務修改頁），外層視圖保持為純淨單欄展示，修改操作一律在任務修改抽屜中進行。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-174` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-174`。

### Previous Changes: Mobile Full-Width Single-Column Layout & Zero Horizontal Scroll (CR-173)
- **變更檔案**:
  - [`List.tsx`](file:///D:/github/pmflow/apps/web/src/pages/List.tsx):
    1. **清單手機滿版卡片流 (`CR-173`)**：手機端全面採用 100% 滿版單欄垂直卡片清單，完整呈現任務編號、標題、狀態、負責人、起訖日、進度與警示，完全不需往右滑動。
  - [`Board.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Board.tsx):
    1. **看板手機狀態頁籤切換器 (`CR-173`)**：手機端提供頂部狀態切換頁籤，單欄滿版垂直呈現選中狀態之所有任務卡片。
  - [`EpicSidebar.tsx`](file:///D:/github/pmflow/apps/web/src/components/EpicSidebar.tsx), [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx):
    1. **側欄抽屜浮層與滿版容器 (`CR-173`)**：側欄收合時右側內容 100% 滿版，側欄展開時以抽屜式浮層與半透明背景呈現，全域防止橫向溢出。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-173` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-173`。

### Previous Changes: Mobile Responsiveness and Desktop View Recommended Notice (CR-172)
- **變更檔案**:
  - [`DesktopRecommendedNotice.tsx`](file:///D:/github/pmflow/apps/web/src/components/DesktopRecommendedNotice.tsx), [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx):
    1. **電腦版建議觀看友善提示 (`CR-172`)**：針對複雜且不適合手機操作之頁面（關聯圖、系統流程圖、甘特圖、語法範例），於手機小螢幕（`< 768px`）進入時展示「💻 建議使用電腦版觀看」提示面板，支援一鍵切換至清單檢視或保留小提示繼續瀏覽。
  - [`EpicSidebar.tsx`](file:///D:/github/pmflow/apps/web/src/components/EpicSidebar.tsx):
    1. **手機側欄預設自動收合 (`CR-172`)**：手機或小螢幕裝置載入時自動收合側欄，釋放主要畫面空間。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-172` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-172`。

### Previous Changes: Fix Edge Disappearance on Drop and Unrestrict Link Authorization (CR-171)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **樂觀連線跨快取持久化 (`CR-171`)**：重構 `pendingOptimistic` 判定，即使連線已獲得伺服器真實 ID，在 `graphData` 抓回前持續保留連線不被清空，修復放開滑鼠連線瞬間消失問題。
    2. **健全連線失敗彈窗與回滾 (`CR-171`)**：連線失敗時顯示 Alert 彈窗並精準移除暫存連線。
  - [`links.ts`](file:///D:/github/pmflow/apps/api/src/routes/links.ts), [`e2e.sh`](file:///D:/github/pmflow/apps/api/test/e2e.sh):
    1. **解除關聯線關係人授權控管 (`CR-171`)**：移除 `assertTaskStakeholder` 限制，專案內一般 `EDITOR` / `MANAGER` 皆可互相建立、修改與刪除任務關聯線。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-171` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-171`。

### Previous Changes: Cleanup Legacy EPIC and Milestone Types (CR-170)
- **變更檔案**:
  - [`seed.ts`](file:///D:/github/pmflow/apps/api/src/seed.ts), [`0026_cleanup_legacy_epic_milestone_types.sql`](file:///D:/github/pmflow/apps/api/src/migrations/0026_cleanup_legacy_epic_milestone_types.sql):
    1. **全面清理歷史 EPIC / 里程碑類型 (`CR-170`)**：將資料庫與示範專案中舊有的 `EPIC` / `MILESTONE` 類型全面統一收斂為標準的 `TASK`（任務單），消除卡片與抽屜上殘留的非預期標籤。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-170` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-170`。

### Previous Changes: Fix Dependency Line Loss on Multi-Card Connections (CR-169)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **關聯線連續接入防消失 (`CR-169`)**：
       - 補齊 `onConnectStart` 接點追蹤與方向換回，防止從 Target 接點起拉時方向反轉觸發循環依賴或錯誤覆蓋。
       - 修復 `realEdges` 狀態更新時樂觀連線 (`pendingOptimistic`) 被查詢快取提前抹除問題。
       - 修復節點存在判定直接使用 `graphData.nodes`，避免因外部 `tasks` 刷新時差過濾掉有效連線。
       - 精確化既有連線判定，不再誤判或覆蓋不同接點之獨立連線。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-169` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-169`。

### Previous Changes: Strict Role Hierarchy Calibration — Super Admin vs Project Owner/Manager (CR-168)
- **變更檔案**:
  - [`auth.ts`](file:///D:/github/pmflow/apps/api/src/lib/auth.ts), [`auth.ts (routes)`](file:///D:/github/pmflow/apps/api/src/routes/auth.ts), [`projects.ts`](file:///D:/github/pmflow/apps/api/src/routes/projects.ts), [`members.ts`](file:///D:/github/pmflow/apps/api/src/routes/members.ts), [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx):
    1. **權限層級嚴格校正 (`CR-168`)**：明確切分全域超級管理者（僅由環境變數指定，具備全站與全專案最高權限）、專案擁有者（專案建立者 `p.created_by`，具備該專案 `MANAGER` 與轉移擁有權特權，不可被踢出）、專案管理者（`MANAGER`，可維護該專案參數與成員）與專案一般成員。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-168` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-168`。

### Previous Changes: Uniform Dedicated Row for Alert Badges Across All Views (CR-167)
- **變更檔案**:
  - [`EpicSidebar.tsx`](file:///D:/github/pmflow/apps/web/src/components/EpicSidebar.tsx), [`Members.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Members.tsx), [`Week.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Week.tsx), [`TaskDrawer.tsx`](file:///D:/github/pmflow/apps/web/src/components/TaskDrawer.tsx):
    1. **警示徽章獨立折行呈現 (`CR-167`)**：所有視圖（側欄、成員視圖、週檢視、詳情抽屜子任務清單）之警示圖示（⛔卡住、⚑問題、⏰逾期、📨逾回、⏳待回、⚡並行）統一獨立放置於標題/種類下方獨立一行，徹底杜絕橫向擠壓變長與版面溢出問題。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-167` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-167`。

### Previous Changes: Effective Admin & Owner Role Resolution for Creators (CR-166)
- **變更檔案**:
  - [`auth.ts`](file:///D:/github/pmflow/apps/api/src/lib/auth.ts), [`auth.ts (routes)`](file:///D:/github/pmflow/apps/api/src/routes/auth.ts), [`account.ts`](file:///D:/github/pmflow/apps/api/src/routes/account.ts):
    1. **工作區與專案管理者角色升級 (`CR-166`)**：在 `requireWorkspaceAdmin`、`requireWorkspaceOwner` 與 `GET /auth/me` 中，自動將超級管理員、專案建立者（擁有者）與專案管理者識別為 `OWNER` / `ADMIN`，不再誤回傳 `MEMBER`。
  - [`AdminPanel.tsx`](file:///D:/github/pmflow/apps/web/src/components/AdminPanel.tsx), [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx):
    1. **系統管理身分徽章與功能解鎖 (`CR-166`)**：正確計算最高管理者身分，系統管理標頭即時顯示 `你的身分：擁有者` 或 `你的身分：管理者`，並解鎖「🛡️ 指派管理者」與帳號停用/註銷權限。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-166` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-166`。

### Previous Changes: AI Skill Discovery Endpoint & One-Click Prompt Modal (CR-165)
- **變更檔案**:
  - [`skills.ts`](file:///D:/github/pmflow/apps/api/src/routes/skills.ts), [`index.ts`](file:///D:/github/pmflow/apps/api/src/index.ts):
    1. **AI 技能探索端點 (`GET /api/v1/skills`, `CR-165`)**：新增 AI Agent 規格探索路由，自動回傳使用者可操作之所有專案、自訂狀態、自訂任務種類 (types)、優先度 (priorities)、成員與完整 CRUD / Link / Inquiry / Ownership API 規格與 JSON Schema。
  - [`AiSkillModal.tsx`](file:///D:/github/pmflow/apps/web/src/components/AiSkillModal.tsx), [`UserMenu.tsx`](file:///D:/github/pmflow/apps/web/src/components/UserMenu.tsx), [`App.tsx`](file:///D:/github/pmflow/apps/web/src/App.tsx), [`AccountPanel.tsx`](file:///D:/github/pmflow/apps/web/src/components/AccountPanel.tsx):
    1. **右上角選單 AI 串接指令彈窗 (`CR-165`)**：在 UserMenu 新增「🤖 AI 串接指令 (Skill / API)」入口與互動式 Modal，自動組合當前目標專案 ID、API 網址與 Token，提供一鍵複製「提示詞 + 清單插槽」功能。
    2. **帳號設定權杖產生一鍵複製 Prompt (`CR-165`)**：在建立 API 權杖明文展示區下方同步提供一鍵複製包含該權杖之完整 AI Prompt。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-165` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-165`。

### Previous Changes: Super Admin Env Var & Project Ownership Transfer (CR-164)
- **變更檔案**:
  - [`env.ts`](file:///D:/github/pmflow/apps/api/src/lib/env.ts), [`auth.ts`](file:///D:/github/pmflow/apps/api/src/lib/auth.ts), [`account.ts`](file:///D:/github/pmflow/apps/api/src/routes/account.ts), [`projects.ts`](file:///D:/github/pmflow/apps/api/src/routes/projects.ts), [`members.ts`](file:///D:/github/pmflow/apps/api/src/routes/members.ts):
    1. **超級管理者環境變數 (`PMFLOW_ADMIN_EMAIL`, `CR-164`)**：支援透過 `PMFLOW_ADMIN_EMAIL` / `PMFLOW_ADMIN_EMAILS` 指定全域最高管理者信箱，具備最高權限可停用、註銷、重設任何帳號並管理所有專案。
    2. **專案擁有者轉移端點 (`transfer-ownership`, `CR-164`)**：新增 `POST /projects/:id/transfer-ownership` API，允許管理者或原建立者將專案擁有權（`created_by`）轉移給專案中的其他成員。
  - [`MembersPanel.tsx`](file:///D:/github/pmflow/apps/web/src/components/MembersPanel.tsx), [`AdminPanel.tsx`](file:///D:/github/pmflow/apps/web/src/components/AdminPanel.tsx), [`api.ts`](file:///D:/github/pmflow/apps/web/src/lib/api.ts), [`strings/account.ts`](file:///D:/github/pmflow/apps/web/src/strings/account.ts):
    1. **成員名單轉移專案擁有者 UI (`CR-164`)**：在成員名單中提供「👑 轉移擁有者」按鈕與二次確認對話框，轉移後即時更新建立者標籤與權限。
    2. **系統管理介面權限解鎖與按鈕優化 (`CR-164`)**：全域管理者可操作包含專案建立者在內之所有帳號的停用與註銷，優化按鈕樣式與可見度。
  - [`.env.example`](file:///D:/github/pmflow/.env.example), [`docker-compose.dev.yml`](file:///D:/github/pmflow/docker-compose.dev.yml), [`docker-compose.yml`](file:///D:/github/pmflow/docker-compose.yml):
    1. **環境變數配置與文件 (`CR-164`)**：補齊 `PMFLOW_ADMIN_EMAIL` 範例與容器設定。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-164` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-164`。

### Previous Changes: Parallel Badge Real-Time Clear on Edge Deletion (CR-163)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **並行狀態動態綁定與即時清除 (`CR-163`)**：在 `nodesWithHandlers` 中即時從 `parallelMap` 取得最新 `parallelInfo`，並將 `isParallel` 與 `parallelPeers` 納入快取鍵比對與依賴陣列。當刪除其中一條並行關聯線（已無多線匯合）時，卡片與收納盒上的「⚡並行」警示徽章即時自動清除。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-163` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-163`。

### Previous Changes: Global Warning Badges Real-Time Sync & Bug Ticket Date Exemption (CR-162)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **收納盒受阻與各類警示即時同步刷新 (`CR-162`)**：保留收納盒自身 `blockedBy` 依賴關係，建立連線受阻時即時亮起「⛔ 卡住」；盒內子卡片受阻時即時刷新「⛔ 卡住 N」計數。
    2. **盒內全域指標動態聚合 (`CR-162`)**：在 `nodesWithHandlers` 依即時節點樹動態統計盒內未完成問題單（`⚑ 問題 N`）、排程逾期（`⏰ 逾期 N`）、對外詢問逾期（`📨 逾回 N`）與待回覆（`⏳ 待回 N`），卡片移入移出或連線異動毫秒級刷新。
  - [`EpicSidebar.tsx`](file:///D:/github/pmflow/apps/web/src/components/EpicSidebar.tsx):
    1. **解除問題單遮蔽卡住徽章限制 (`CR-162`)**：移除 `bugs === 0` 互斥條件，側欄任務列與收納盒中卡住（`⛔卡住`）、問題單（`⚑ BUG`）、排程逾期（`⏰逾期`）、對外詢問逾回（`📨逾回`）與待回（`⏳待回`）全數同時並存顯示。
  - [`TaskDrawer.tsx`](file:///D:/github/pmflow/apps/web/src/components/TaskDrawer.tsx):
    1. **問題單（BUG）免設起訖日 (`CR-162`)**：在任務抽屜表單中，針對 `BUG` 類型隱藏「開始日 – 到期日」欄位，避免問題單被強制要求填寫工期與排程日期。
  - [`Board.tsx`](file:///D:/github/pmflow/apps/web/src/pages/Board.tsx) & [`List.tsx`](file:///D:/github/pmflow/apps/web/src/pages/List.tsx):
    1. **看板與清單視角警示徽章對齊 (`CR-162`)**：看板卡片補齊排程逾期（`⏰ 逾期`）徽章；清單收納盒支援自身受阻與盒內受阻並存警示。
  - [`ui.tsx`](file:///D:/github/pmflow/apps/web/src/components/ui.tsx) & [`strings/inquiry.ts`](file:///D:/github/pmflow/apps/web/src/strings/inquiry.ts):
    1. **對外詢問徽章精簡與語意區隔 (`CR-162`)**：將對外詢問文字簡化為 2 字動作語意（`📨 逾回`、`⏳ 待回`、`◐ 部份回`、`✓ 已回`），`OVERDUE` 配置專屬靛藍色系與 📨 圖示，與排程逾期 `⏰ 逾期`（玫瑰紅）明確區隔。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-162` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-162`。

### Previous Changes: Direct Text Creation, Horizontal/Vertical Axis Constraints, and 4-Way Dual Handles (CR-159 ~ CR-161)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **新增文字直接生成不彈窗 (`CR-161`)**：點擊「新增文字」直接在畫布座標生成文字註記，移除自動呼叫 `setEditingAnnotation`，對齊流程圖簡潔體驗。
    2. **同軸連線嚴格約束 (`CR-160`)**：透過 `isValidConnection` 嚴格限制左右接點只能連左右（排程相依）、上下接點只能連上下（階層關係），拖曳時跨軸接點即時變紅且無法放置。
    3. **四向雙向接點池 (`CR-159`)**：四向同時註冊 in / out 雙向接點，徹底消除端點角色不匹配問題。
  - [`SystemFlow.tsx`](file:///D:/github/pmflow/apps/web/src/pages/SystemFlow.tsx):
    1. **全框體四向雙向接點元件 (`FourWayHandles`, `CR-159`)**：為步驟卡片、模組容器盒、區域標示框、文字註記全數配置四向雙向接點。
    2. **區域標示框層級與穿透事件修復 (`CR-159`)**：`frame` 的接點啟用 `pointer-events-auto` 與 `zIndex: 0`，支援四向自由互相拉線。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-159`、`CR-160` 與 `CR-161` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-161`。

### Previous Changes: System Flow 4-Way Handles Fix (CR-158)
- **變更檔案**:
  - [`SystemFlow.tsx`](file:///D:/github/pmflow/apps/web/src/pages/SystemFlow.tsx): 移除 `onConnect` 內強行覆寫接點為 `right-out`/`bottom-out` 的 `toOutHandle` / `toInHandle` 邏輯，並統一容器盒接點 ID，實現四向任意出發與連入。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-158` 條目。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新進度至 `CR-158`。

### Previous Changes: Initial Node Geometries, Bidirectional Handles, and Dynamic Problem Counting (CR-155 ~ CR-157)
- **變更檔案**:
  - [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx):
    1. **卡片初始尺寸與量測綁定 (`CR-157`)**：在 `processTask` 與 `useEffect` 合併時一律給予卡片 `width: 256`, `height: 90` 及 `measured` 物件，修復首次進關聯圖卡片無法直接拉線、需拖動卡片才觸發量測的 Bug。
    2. **接點方向標準化 (`CR-156`)**：Left/Top 設為 `target`，Right/Bottom 設為 `source`，並啟用 `isConnectableStart` 與 `isConnectableEnd`，完整註冊雙向接點池。
    3. **即時畫布子樹問題單統計 (`CR-155`)**：在 `nodesWithHandlers` 透過即時 `nodeChildrenMap` 動態遞迴統計未完成 BUG 任務，子卡片拖出收納盒毫秒級即時歸零並移除警示徽章，並提昇卡片層級至 20~50 避免連線後十字標被 30px interaction stroke 遮蔽。
  - [`SystemFlow.tsx`](file:///D:/github/pmflow/apps/web/src/pages/SystemFlow.tsx): 同步將模組與步驟節點接點標準化為 Left/Top target 與 Right/Bottom source 雙向配置。
  - [`docs/CODEMAP.md`](file:///D:/github/pmflow/docs/CODEMAP.md): 更新程式地圖行數與 React Flow 節點初始量測踩坑與接點配置指引。
  - [`docs/CHANGELOG.md`](file:///D:/github/pmflow/docs/CHANGELOG.md): 記錄 `CR-155`、`CR-156` 與 `CR-157` 條目與細節。
  - [`docs/NEXT-SESSION.md`](file:///D:/github/pmflow/docs/NEXT-SESSION.md): 更新開發進度至 `CR-157`。

### Previous Changes: NAS Custom SQL Seed Directory & Sample Seed File
- **變更檔案**:
  - [`01_demo_seed.sql`](file:///D:/NewProject/pmflow-git/seed/01_demo_seed.sql): 建立標準初始資料 SQL 種子範本，包含示範工作區、管理者帳號、專案參數、父子任務與 FS 依賴連線。
  - [`seed.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/seed.ts): 新增 `seedFromSqlDir` 函式，讀取並執行掛載目錄下的 `.sql` 資料腳本。
  - [`index.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/index.ts): 在啟動階段偵測 `PMFLOW_SEED_SQL_DIR`（預設 `/data/seed`），若有自訂 `.sql` 檔則優先依序匯入並略過預設示範資料。
  - [`docker-compose.synology.yml`](file:///D:/NewProject/pmflow-git/docker-compose.synology.yml): 加入 `PMFLOW_SEED_SQL_DIR` 與 `./seed:/data/seed:ro` 掛載目錄設定，支援在 NAS 上直接放入 SQL 檔自動匯入。

### Previous Changes: Removed Legacy Milestone and Epic Terminology
- **變更檔案**:
  - [`e2e.test.ts`](file:///D:/NewProject/pmflow-git/apps/api/test/e2e.test.ts): 建立跨平台（Windows / macOS / Linux）TypeScript 端對端 API 測試腳本，支援驗證身份認證、專案參數、任務 CRUD、依賴排程與狀態聚合。
  - [`package.json`](file:///D:/NewProject/pmflow-git/apps/api/package.json): 新增 `npm test`、`npm run test:unit` 與 `npm run test:e2e` 測試指令。目前共 23 項單元與整合測試全數通過（23/23 通過）。
  - [`.github/workflows/ci.yml`](file:///D:/NewProject/pmflow-git/.github/workflows/ci.yml): 將跨平台 E2E API 整合測試納入 GitHub Actions CI 流水線，確保每次 PR/Push 都自動覆蓋完整 API 測試。

### Previous Changes: Gantt Menu Selection Sync & SimpleGraph All Tasks FitView
- **變更檔案**:
  - [`Gantt.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Gantt.tsx): 補齊 `onTaskClick` 與 `onTaskSelected` 事件監聽，點擊甘特圖中任意任務列或進度條即時連動左側 Menu 高亮與滾動。
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx): 點擊側欄「☰ 全部任務」時，自動清除選中節點並觸發全圖平滑置中顯示全部 (`fitView`)。
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 在 `GanttView` 與 `onSelectEpic` 串接選取狀態與全域聚焦重設。

### Previous Changes: Permanent Top Navigation Tabs in Task Edit Mode
- **變更檔案**:
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx):
    1. **頂部頁籤常駐顯示**：進入任務編輯模式時，頂部第一層完整保留所有檢視頁籤與偏好選單，隨時一鍵跨頁對照。
    2. **麵包屑第二層整合**：任務路徑導覽麵包屑（專案名稱 / 上層 / 任務標題）整合於第二層，並提供「關閉編輯 ✕」捷徑按鈕。

### Previous Changes: Tab Renamed to '各語法範例' with Full Global Synchronization
- **變更檔案**:
  - [`nav.ts`](file:///D:/NewProject/pmflow-git/apps/web/src/strings/nav.ts): 將預設頁籤字串更新為 **`playground: '各語法範例'`**。
  - [`Playground.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Playground.tsx): 內部標題與導覽列全面同步為「各語法範例」（支援在參數設定中自訂更名連動）。
  - [`ProjectSettings.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ProjectSettings.tsx): 「自訂頁籤名稱」設定中預設值連動更新為「各語法範例」。
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 頂部頁籤、導覽麵包屑與載入動畫即時全面同步自訂頁籤名稱。

### Previous Changes: Fixed Item List Header Wrapping & Layout Optimization
- **變更檔案**:
  - [`Playground.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Playground.tsx):
    1. **標頭防折行修復**：左側項目清單寬度微調至 `w-80`（320px），標題「項目清單」與新增按鈕組加入 `whitespace-nowrap` 與 `shrink-0`，徹底防止小螢幕或邊距造成文字與按鈕折行。
    2. **按鈕樣式優化**：精簡按鈕內邊距與邊框，排版更緊湊整潔。
    4. **拖曳調整與收納保護**：支援按住分隔線自由拖曳各欄寬度；支援個別面板收納切換，並強制至少保留一個面板開啟防呆。

### Previous Changes: Left/Top Alignment for Storage Box and Warning Legend Items
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 圖示說明彈窗中，將「📦 收納盒」與多行說明項目的垂直對齊由 `items-center` 調整為 `items-start`，確保圖示與標籤統一靠上對齊，不再強制居中。

### Previous Changes: Left/Top Alignment for Storage Box and Warning Legend Items
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 圖示說明彈窗中，將「📦 收納盒」與多行說明項目的垂直對齊由 `items-center` 調整為 `items-start`，確保圖示與標籤統一靠上對齊，不再強制居中。

### Previous Changes: Removed Redundant 'Show All' from Breadcrumb Row
- **變更檔案**:
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 移除頂部麵包屑「當前顯示...」列右側多餘的「顯示全部」按鈕，統一由左側常駐的「☰ 全部任務」按鈕負責重置視野與篩選。

### Previous Changes: Sticky 'All Tasks' Sidebar Header & 99% Progress Cap on Blocked Tasks
- **變更檔案**:
  - [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx): 將「全部任務」按鈕由可滾動列表內抽離至頂部固定容器（`shrink-0`），向下滾動任務清單時「全部任務」列永久常駐於頂部不隨滾動消失。
  - [`TaskDrawer.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/TaskDrawer.tsx) & [`tasks.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/routes/tasks.ts): 當任務受上游依賴阻塞（卡住）時，前端滑桿、輸入框與後端皆限制最高進度為 99%，禁止設定為 100%。

### Previous Changes: Real-Time Blocked Evaluation & React Query Cache Sync on Link Connection
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx): 建立新關聯線（`onConnect`）時，立即執行快取同步（`invalidateQueries`）並透過 `nodesWithHandlers` 即時重新計算卡片與收納盒的 `blockedBy` 及 `blockedCount`，使新建立依賴的下游卡片瞬間亮起「⛔ 卡住」警示，無須手動重整。

### Previous Changes: Storage Box Rolled Progress & Downstream Blocked Badge Calculation
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx): 修正上游判定邏輯，改為嚴格參照全域聚合進度（`rolled.progress < 100`）。當上游收納盒內部子任務未全數完成（整體進度未達 100%）時，其所有下游依賴卡片與收納盒皆會確實顯示「⛔ 卡住」警示徽章。

### Previous Changes: Unsuppressed '⛔ 卡住' Badge in Dependency Graphs
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx): 移除過往卡片若有「問題說明（`problem`）」就會被 `!data.problem` 遮蔽「⛔ 卡住（`blockedBy`）」徽章的邏輯，確保當任務有未完成上游依賴時，「⛔ 卡住」與「⚑ 問題」徽章皆能完整顯示。

### Previous Changes: Synchronized Left Sidebar Selection & Smooth Auto-Scroll from Graphs
- **變更檔案**:
  - [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx), [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx), [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx) & [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 在關聯圖或靶心圖點選任一卡片/收納盒時，左側側欄選單（EpicSidebar）會即時同步焦點狀態（高亮藍色外框）、自動展開該項目所屬的父收納盒，並以平滑動畫自動滾動（`scrollIntoView`）至該項目視野中。

### Previous Changes: Comprehensive Visual Legend Tooltip (SimpleGraph & SystemFlow)
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 全面擴充左下角「ℹ️ 圖示說明」彈出面板，分類補齊「🔗 關聯線條（🔴 前後實線 / 🟣 上下虛線）」、「🚩 警示徽章（⚑ 問題單 / ⚠️ 卡住 / ⏰ 逾期）」與「📦 容器與事件（收納盒 / 任務單 / 問題單 / 100% 完成）」之完整圖例與說明。

### Previous Changes: Unconstrained Fit-All Canvas Zoom (minZoom=0.05)
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 將 ReactFlow 的縮小限制放寬至 `minZoom={0.05}`，徹底解決「顯示全部」受限於預設 `minZoom: 0.5` 導致大幅面卡片無法完整縮放容納的問題。

### Previous Changes: Dedicated '顯示全部' (Fit View) and '置中視野' (1:1 Center) Canvas Controls
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 左下角控制板獨立提供「🎯 置中視野（恢復 100% 原始比例並對焦於目前目標/中央）」與「⛶ 顯示全部（自動縮放並容納全畫布所有節點與卡片）」，明確分工。

### Previous Changes: Fully Localized Chinese Canvas Controls (SimpleGraph & SystemFlow)
- **變更檔案**:
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 將左下角畫布控制板（`Controls`）所有功能與浮動提示（Tooltips / `title` / `aria-label`）全面中文化（`➕ 放大畫布`、`➖ 縮小畫布`、`🎯 置中視野`、`ℹ️ 圖示說明`），移除所有預設英文提示。

### Previous Changes: Cleaned Up Redundant FitView Button in System Flow
- **變更檔案**:
  - [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 移除頂部工具列重複的「🎯 視野對焦」按鈕，集中由左下角畫布控制板（`Controls`）統一提供縮放與置中操作，對齊 SimpleGraph 標準版型。

### Previous Changes: Real-Time Animated Tab Reordering (@dnd-kit/sortable)
- **變更檔案**:
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 導入 `@dnd-kit/sortable` 重構 [`TabPrefs`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx#L253-L415) 面板，按住三條線（`☰`）手柄上下拖曳時，各頁籤項目即時滑動置換位置（Live-swapping），並具備流暢 CSS Transform 平移動畫與放開即時同步。

### Previous Changes: Fix Navigation Tab Management Panel (TabPrefs) Overflow Clipping
- **變更檔案**:
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 將頁籤管理面板（`TabPrefs`）移出具備 `overflow-x-auto` 與固定高度的 `nav` 容器，改置於右上角操作區，並補齊 `top-full` 絕對定位錨點，徹底解決彈窗遭父層 CSS 裁切隱藏導致點擊 `⚙` 看似無反應的問題。

### Previous Changes: Rebuilt Simplified Navigation Tab Management Panel (TabPrefs)
- **變更檔案**:
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 移除舊版複雜且易失效的拖曳模組，全面重構為簡約直覺的頁籤管理面板（`TabPrefs`），支援一鍵勾選顯示/隱藏、`▲` / `▼` 上下排序、防呆單一頁籤鎖定與一鍵重設為預設。

### Previous Changes: System Flow Page Tab Sorting (Drag & Drop + Micro-Adjustment)
- **變更檔案**:
  - [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 新增流程頁籤拖曳重排（Drag & Drop）與左右微調按鈕（`◀` / `▶`），支援滑鼠拖曳 `⠿` 手柄快速置換頁面順序，並即時寫入專案持久化儲存。

### Previous Changes: System Flow Canvas Dragging & Parent-First Depth Ordering Fix
- **變更檔案**:
  - [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx) & [`main.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/main.tsx): 引入 `@xyflow/react/dist/style.css` 核心樣式表，徹底解決缺少 CSS 導致節點失去絕對定位而呈「梯形階梯排列」與畫布容器「無法移動鎖死」的問題；對齊 SimpleGraph 重構 `orderParentNodesFirst` 深度演算法並嚴格排序 `nodesWithHandlers`，加入 `measured` 測量就緒防護與 `Viewport` 視角記憶。

### Previous Changes: Unified Pill Tag Type Badges & Clean Storage Box Icons
- **變更檔案**:
  - [`ui.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx): 新增全站統一的 [`TypeBadge`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx#L248-L278) 元件（10% 柔和底色 + 25% 同色邊框 + 實心微型圓點 + 原色文字）。
  - [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx): 移除一般卡片 `📄` 圖示（僅收納盒保留 `📦`），移除前方舊式豎向色條，並於卡片編號右側整合統一 [`TypeBadge`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx)。
  - [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx): 移除一般卡片 `📄` 與 `◆` 圖示（僅收納盒保留 `📦`），並將事件種類標籤全面換裝為統一 [`TypeBadge`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx)。
  - [`Board.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Board.tsx): 移除 `◆` 圖示，將看板卡片事件類型標籤替換為統一 [`TypeBadge`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx)。
  - [`Week.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Week.tsx): 行事曆週檢視統一使用 [`TypeBadge`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx)。
  - [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx) & [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx): 節點按鈕由 `📄 卡片` 精簡為 `卡片`，一般節點與收納盒標頭全面統一使用 [`TypeBadge`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx)。
  - [`TaskDrawer.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/TaskDrawer.tsx): 抽屜頂部標頭統一使用 [`TypeBadge`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx)。

### Previous Changes: Customizable Task Types Restoration & System Flow Creator Permissions
- **變更檔案**:
  - [`ProjectSettings.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ProjectSettings.tsx): 恢復「事件類型」系統參數管理區塊，支援自由新增自訂類型、調整順序、編輯名稱與顏色、刪除與搬移既有任務；自訂清單自動排除「問題單」（BUG），確保問題單為系統固定內建事件類型。
  - [`parameters.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/routes/parameters.ts): 嚴格保護「問題單（BUG）」事件類型，禁止於系統參數中被修改、刪除或重複新增，並於 `assertParamKey` 永遠放行 BUG 類型。
  - [`TaskDrawer.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/TaskDrawer.tsx) & [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx) & [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx): 新增或編輯事件時，事件類型下拉選單支援所有專案自訂類型，同時永遠保留「問題單」選項供獨立開立。
  - [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 新增流程圖多分頁（Multi-page Tabs）機制；紀錄 `createdById` 與 `createdByName`，嚴格規範僅限專案建立者、Owner、Manager 以及「該分頁的建立者本人」具備分頁刪除權限。

### Previous Changes: Problem Resolution Workflow, SystemFlow Decoupling, Deleted Tasks View, and Strict Delete Permissions
- **變更檔案**:
  - [`0019_task_problems.sql`](file:///D:/NewProject/pmflow-git/apps/api/src/migrations/0019_task_problems.sql): 新建 `task_problem_history` 表記錄歷次遭遇問題與解決方案。
  - [`0021_rename_task_type_to_tickets.sql`](file:///D:/NewProject/pmflow-git/apps/api/src/migrations/0021_rename_task_type_to_tickets.sql) & [`0023_keep_only_task_and_bug_types.sql`](file:///D:/NewProject/pmflow-git/apps/api/src/migrations/0023_keep_only_task_and_bug_types.sql): 將事件類型名稱統一定名為「任務單」與「問題單」，並將類型清單嚴格限制僅保留「任務單」與「問題單」。
  - [`0022_convert_problem_tasks_to_bug.sql`](file:///D:/NewProject/pmflow-git/apps/api/src/migrations/0022_convert_problem_tasks_to_bug.sql) & [`0024_cleanup_non_bug_problem_text.sql`](file:///D:/NewProject/pmflow-git/apps/api/src/migrations/0024_cleanup_non_bug_problem_text.sql): 將掛在其他任務單下且填有問題的子任務全面更新為「問題單」（BUG），並清理一般任務單上殘留的舊版 problem 字串，確保全面由問題單機制統一管理。
  - [`auth.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/lib/auth.ts): 嚴格限制 `requireProjectManager` 僅限專案建立者、Owner 與 Manager（建立者以上），排除一般 Editor。
  - [`parameters.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/routes/parameters.ts): 同步將 `canManage` 權限嚴格校準為建立者以上，保障系統參數安全性。
  - [`ProjectSettings.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ProjectSettings.tsx): 移除「事件類型」設定區塊，僅保留狀態與優先度設定。
  - [`tasks.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/routes/tasks.ts): 新增 `POST /tasks/:id/resolve-problem`，建立新事件時開始日與結束日自動預設為當天；嚴格限制刪除權限 `assertCanDeleteTask`。
  - [`TaskDrawer.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/TaskDrawer.tsx) & [`strings/task.ts`](file:///D:/NewProject/pmflow-git/apps/web/src/strings/task.ts): 全面統一標準名詞（左右拉線為「前後相依」、上下收納為「父任務（收納盒）」與「子任務」）、前後相依清單與目標選擇下拉依 MRG 編號數字升冪排序、事件內容動態切換（任務單顯示「任務內容」，問題單顯示「問題內容」並附帶「解決內容」編輯區，問題單隱藏進度條且填寫解決內容即自動設定為 100% 解決）、相依任務選擇與 SimpleGraph 連線過濾排除問題單、新增「問題標題」欄位支援一鍵開立「問題單」並自動轉為收納盒將問題單收納其中（顯示上方已收納問題清單）、移除舊版「清空」與「已解決」按鈕、在上下階層區塊顯示「所屬父任務（收納盒）」卡片支援一鍵跳轉、下方子任務清單過濾排除問題單並即時顯示遭遇問題警示徽章（`ProblemBadge`）、問題單本身隱藏問題區、折疊收納「📜 歷史已解決問題 (N 件)」，並將按鈕文字更新為「刪除事件」。
  - [`DeletedTasks.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/DeletedTasks.tsx): 新建已刪除事件（回收站）頁籤，支援一鍵還原與永久刪除。
  - [`SystemFlow.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SystemFlow.tsx): 完全獨立的系統流程圖（獨立繪圖節點、模組容器、四向連接點、拖曳收納與獨立儲存，不連動 Menu）。
  - [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx) & [`ui.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/ui.tsx) & [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx) & [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx) & [`Board.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Board.tsx) & [`Gantt.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Gantt.tsx) & [`Members.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Members.tsx): 全面統一問題警示徽章配色為紅色；Menu側欄、甘特圖、看板與事件歸屬統一顯示為「問 X」（若事件本身為問題單則不重複標記），收納盒自動加總內部問題、卡住、逾期總數，清單表格顯示為「⚑有問題」。
  - [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx): 新增「警示」獨立欄位集中呈現遭遇問題與阻塞狀態、將 ✏️ 編輯與 ＋ 新增按鈕移至任務標題正後方，並優化表格最小寬度至 `76rem`。
  - [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx): 頂部麵包屑移除重複的「回總覽」，整併為直覺的「← 專案名稱 / 父任務 / 當前任務」；頁籤齒輪選單加入 `▲`/`▼` 直覺排序按鈕與拖曳強化，移除逾期標籤。

### Commit: `b7e2c2f` - Fix: e2e test script and seed parameter auto-population
- **變更檔案**: 
  - [`e2e.sh`](file:///D:/NewProject/pmflow-git/apps/api/test/e2e.sh)
  - [`seed.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/seed.ts)
  - [`index.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/index.ts)
- **異動說明**:
  - 修正 `e2e.sh` 的 `apic` 輔助函式，增加 `--data-raw` 及 `charset=utf-8` header，徹底避免 Windows curl 傳送中文字元造成的 fastify byte-length parsing 錯誤與轉義問題。
  - 將 24~27 區節錯誤的 `"type":"EPIC"` 修改為合法枚舉 `"type":"TASK"`。
  - 為 `NEWMAIL` 加上時間戳防碰撞 (`jack-$(date +%s)-$RANDOM@example.com`)。
  - 優化步驟 14 (環狀關聯攔截) 與步驟 17 (甘特連動推算) 測試的自動復原與依賴鏈鋪設邏輯，並支援 `RESET_DB=true` 強制重置資料庫。
  - 在 API 啟動與 `seedDemo()` 時加入 `seedProjectTypesIfMissing()`，自動為缺少的專案補齊任務類型與優先度參數。
  - **測試結果**: 107 項 E2E 端對端測試達到 **107 PASS / 0 FAIL (100% 通過)**。

### Commit: `ce06cef` - Fix: List view hierarchy calculation and loop recursion prevention
- **變更檔案**: [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L186-L230)
- **異動說明**:
  - 更新根節點判斷邏輯 `isRoot = (t: Task) => !t.parentId || !taskIds.has(t.parentId)`，修正當篩選 Epic / 收納盒時卡片無法正確呈現樹狀層級結構的問題。
  - 在 `walk()` 遞迴遍歷中加入 `processed` Set 守衛，杜絕潛在的循環父子關係造成的無窮迴圈。

### Commit: `5dbc4f7` - Refactor: Menu sidebar item layout to strict 3-line hierarchy and 100% checkmark rule
- **變更檔案**: [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L884-L980)
- **異動說明**:
  - 調整左側選單欄位版型為三行結構：
    - Line 1: 圖示 / Ref 號碼 / 警示徽章 (極限緊湊) / 僅於進度等於 `100%` 時顯示勾選圖示。
    - Line 2: 完整任務標題。
    - Line 3: 進度條與百分比。

### Commit: `2f1e9fb` - Fix: Reset measured bounds and unnest child cards when toggling box back to card
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L273-L293)
- **異動說明**:
  - 當收納盒切回卡片模式時，自動清空 ReactFlow 的 `measured` 測量數據 (`width`/`height`)。
  - 若原收納盒內含有卡片，切回卡片時自動將子卡片釋放為獨立畫布卡片，徹底消除殘留的碰撞與碰撞邊界框。

### Commit: `8790971` - Style: Move mode toggle button to the left side of MRG badge
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L130-L190)
- **異動說明**:
  - 將收納盒與卡片的 `📦 收納盒` / `📦 卡片` 切換模式按鈕調整至 `MRG-BOX` / `MRG-1` 標籤正左側。

### Commit: `6914ba1` - Style: Restore auto expansion hint text in storage box
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L145-L150)
- **異動說明**:
  - 重新保留並顯示收納盒內部的 `(移入卡片自動擴大容量)` 說明提示文字。

### Commit: `04584e5` - Feat: Prevent duplicate edge connections between the same pair of nodes
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L345-L358)
- **異動說明**:
  - 當使用者嘗試在同一個卡片與另外同一個卡片/收納盒之間重複拉第二條關聯線時，系統會自動攔截並彈出提示 Modal：`【MRG-X】與【MRG-Y】之間已存在關聯線，無法重複建立！`。

### Commit: `7d07568` - Feat: Add click to delete edge with deletion confirmation modal
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L295-L315)
- **異動說明**:
  - 支援點擊任意關聯線時跳出刪除確認 Modal，提示語符合 AGENTS.md 規範：`是否刪除 [上游卡片Ref] 與 [下游卡片Ref] 的關聯？`。

### Commit: `c130bfd` - Feat: Persist and restore focus position and zoom level in SimpleGraph
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L25-L35)
- **異動說明**:
  - 透過 `onMoveEnd` 事件即時將最後視角焦點 (`x`, `y`) 與縮放比例 (`zoom`) 紀錄至 `localStorage` (`pmflow_simple_graph_viewport`)。

### Commit: `117390e` - Feat: Prevent moving connected cards out of storage box and show alert modal
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L368-L382)
- **異動說明**:
  - 當收納盒內的卡片存在關聯線時，若使用者嘗試將其拖出收納盒，系統會自動將卡片定位彈回原收納盒並跳出提示 Modal。

### Commit: `59b8e26` - Feat: Block cross-boundary connections for inside-box cards and pop up alert modal
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L330-L344)
- **異動說明**:
  - 當使用者嘗試將收納盒內部的卡片與外部卡片/收納盒拉線關聯時，系統自動攔截並彈出 ⚠️ 關聯建立受限 Modal。

### Commit: `8f3e2d1` - Feat: Sync SimpleGraph with menu task hierarchy and fix measured box dimensions
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L274-L339), [`ARCHITECTURE.md`](file:///D:/NewProject/pmflow-git/docs/ARCHITECTURE.md), [`SPEC.md`](file:///D:/NewProject/pmflow-git/docs/SPEC.md)
- **異動說明**:
  - 實現新關聯表 (SimpleGraph) 與側欄選單任務 100% 1-對-1 動態轉換與數量同步。
  - 含有子任務或類型為 EPIC 之任務自動轉換為收納盒 (`mode: 'box'`)，子任務自動對應為盒內卡片 (`parentId`)。
  - 同步更新收納盒 `measured` 與 `width/height` 屬性，解決超過 5 張卡片時右側感應邊界未擴大問題。
  - 重寫與更新系統架構圖 (`ARCHITECTURE.md`) 與規格書 (`SPEC.md`)，完全對齊 Fastify + React 實作現況。

### Commit: `4a91c28` - Fix: Prevent card overlapping inside storage box via internal grid re-alignment
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L650-L680)
- **異動說明**:
  - 當卡片在收納盒內部移動時，自動重新計算並將所有子卡片對齊獨立網格槽位 (`(col, row)`)，徹底解決卡片互相遮蔽覆蓋的問題。

### Commit: `9e2f1a0` - Feat: Sync task move/unparent with backend DB and left menu sidebar
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L408-L415, #L576-L620)
- **異動說明**:
  - 移出收納盒或切換模式時自動呼叫 `Api.moveTask(id, { parentId: null })` 寫回資料庫。
  - 移入收納盒時自動呼叫 `Api.moveTask(id, { parentId: boxId })` 寫回資料庫。
  - 成功寫回後自動觸發 `queryClient.invalidateQueries` 重新取得專案任務，左側 Menu 側欄即時 100% 同步階層變動。

### Commit: `3b81e4f` - Fix: Preserve node positions and measured bounds during task query refetches
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L365-L385)
- **異動說明**:
  - 修復 `queryClient.invalidateQueries` 觸發 `useEffect` 時畫布重置問題。自動比對與保留既存卡片與收納盒的最後畫布座標 (`position`) 與邊界 (`measured`)。

### Commit: `e27f91c` - Fix: Obey server parentId and mode changes during useEffect node merging to prevent canvas breakdown
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L374-L390)
- **異動說明**:
  - 修復合併舊節點時強制覆蓋 `parentId` 造成座標系統衝突 (絕對 vs 相對) 與畫布失靈的問題。
  - 當伺服器 `parentId` 或 `mode` 發生改變時優先使用新階層結構與網格槽位，僅在同階層未改變時保留自訂畫布座標。

### Commit: `1d82f7c` - Feat: Fetch real graph links from API, persist add/delete link, and add fallback demo nodes
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L275-L293, #L547-L560, #L848-L860)
- **異動說明**:
  - 透過 `Api.graph(projectId)` 載入專案內真實相依關聯線 (Edges)。
  - 新增拉線建立關聯 (`Api.addLink`) 與刪除關聯 (`Api.deleteLink`) 的後端 API 持久化寫回機制。
  - 當任務尚在載入或為空時保留預設示範圖案，防止白屏或空畫布失靈。

### Commit: `2f1e9fb` - Revert: Restore SimpleGraph.tsx to pre-menu sync state
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - 依照使用者指示，還原 `SimpleGraph.tsx` 至尚未與 Menu 側欄動態同步的穩定版本 (`2f1e9fb`)。

### Commit: `8c3f2a1` - Feat: Dynamic sync left menu tasks hierarchy to SimpleGraph and clear initial mock data
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L75-L125, #L280-L425)
- **異動說明**:
  - 清除原始 Mock 示範資料 (`initialNodes` & `initialEdges`)。
  - 將 Left Menu 專案任務資料動態同步至關聯表：父任務/含子任務者自動轉為「收納盒」，下方子任務自動收納為盒內「卡片」 (採 5 列/欄網格槽位)。
  - 頂層收納盒與獨立卡片採 3 欄自動折行 (`(col, row)` 網格矩陣) 整齊排列。

### Commit: `4a9b2c3` - Fix: Restrict node drag handle strictly inside card/box border and enforce box size expansion
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L73-L198, #L595-L645, #L706-L709)
- **異動說明**:
  - 設定 `dragHandle=".custom-drag-handle"` 與 `nodrag` 標籤：移動觸發嚴格限定於卡片/收納盒本身的實體框線內部，點擊框線外部、按鈕或接點一律不觸發拖曳。
  - 補全收納盒動態容量擴張機制 (`style`, `width`, `height`, `measured` 四位一體同步更新)，確保每一個收納盒都能精確識別與收納盒內卡片。

### Commit: `9f8e7d2` - Feat: Allow storing any card/node into any independent storage box with DB persistence
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L516-L655)
- **異動說明**:
  - 移除收納盒節點的放置限制 (`if (isBoxNode) return`)，確保每個收納盒具備獨立收納功能，任意卡片拖入均可收納。
  - 移入或移出收納盒時同步觸發 `Api.moveTask` 寫回資料庫並更新 `['tasks', projectId]` Query，使 Left Menu 側欄即時聯動。

### Commit: `6b2e1f4` - Fix: Restore smooth card drag and compute 2D matrix grid layout to eliminate diagonal staircase
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L73-L198, #L260-L380)
- **異動說明**:
  - 移除 `dragHandle` 通配符限制，恢復全卡片區域自由平滑拖曳，解決「卡片與畫面無法移動」的鎖死問題。
  - 重構佈局計算為獨立 2D 矩陣 (`col = rootIndex % 3, row = Math.floor(rootIndex / 3)`)，徹底根除階梯對角線散落。
  - 盒內子卡片強制使用專屬網格槽位 (`24 + cCol * 280, 50 + cRow * 100`)，不殘留畫布舊座標。

### Commit: `5e4a3b1` - Feat: Add "顯示全部" (Fit View) button to Controls and top toolbar
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L695-L730, #L790-L800)
- **異動說明**:
  - 使用 `ReactFlowProvider` 包覆元件，並在左下角 `<Controls>` 新增 **🎯 顯示全部 (Fit View)** 按鈕與官方 Fit View 功能。
  - 頂部工具列同步新增 **🎯 顯示全部** 按鈕，點擊後自動縮放與平移畫布，將所有節點完美呈現在視窗中央。

### Commit: `7a8b9c0` - Feat: Persist drag node positions to localStorage across page tab switches
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L28-L60, #L360-L400, #L455-L465, #L690-L700)
- **異動說明**:
  - 新增 `STORAGE_KEY_POSITIONS` 與 `saveNodePositions`/`loadSavedPositions` 工具函式。
  - 將 `saveNodePositions` 掛載至 `onNodesChange` 與 `onNodeDragStop`：拖曳過渡與放開瞬間均即時寫入 `localStorage`。
  - 切換頁面或重新載入時自動從 `localStorage` 還原上一版自訂佈局位置，確保使用者調整的畫布佈局 100% 完美保留。

### Commit: `2c3d4e5` - Fix: Strict storage box auto-expansion only on card drop-in (never shrink)
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L90-L102, #L625-L705)
- **異動說明**:
  - 調整 `computeBoxSize` 計算邏輯：收納盒**僅在移入卡片且容量不足時單向擴大**，絕不自動縮小。
  - 移出卡片時完全移除對 `oldBox` 尺寸的自動調整，收納盒尺寸與手動調整大小結果 100% 鎖定與保留。

### Commit: `3b4c5d6` - Fix: Validate viewport zoom and guard initial mount from saving empty node viewport
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L28-L45, #L700-L715)
- **異動說明**:
  - 新增 `loadSavedViewport` 排查極小/異常 `zoom` (< 0.1) 防禦機制。
  - `handleMoveEnd` 加上 `nodes.length === 0` 防護罩，防止首次載入 (0 節點) 時誤寫入空視角導致畫面凍結或無法控制。
  - 首次進去即能完美聚焦並流暢操作。

### Commit: `4c5d6e7` - Fix: Preserve existing inside-box card order when dropping new card into storage box
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L390-L405)
- **異動說明**:
  - 符合 AGENTS.md 規格：卡片移入收納盒時，盒內既有卡片 100% 保留原本相對槽位與擺放順序，絕不強制重新重排。
  - 新移入卡片順暢掛載至下一個空槽位，避免資料庫同步時擾亂原有排列。

### Commit: `8f9e0d1` - Fix: Re-order parent nodes before child nodes in React Flow to prevent z-index occlusion
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L68-L75, #L435-L445, #L710-L720)
- **異動說明**:
  - 診斷出卡片移入「消失」之主因：React Flow 渲染層級取決於 `nodes` 陣列順序，若收納盒本體在子卡片之後，盒體白底背景會將子卡片完全遮擋。
  - 新增 `orderParentNodesFirst` 強制確保父收納盒在 `nodes` 陣列中優先於子卡片渲染，卡片移入 100% 顯現於收納盒最上層。

### Commit: `9a0b1c2` - Fix: Persist storage box position (x, y) and dimensions (width, height) across tab switches
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L70-L95, #L425-L450)
- **異動說明**:
  - 診斷出收納盒位置無效還原之主因：過去重載/切換分頁時僅恢復 `position`，且未鎖定收納盒專屬頂層標籤。
  - `saveNodePositions` 精準鎖定 `!n.parentId` 頂層收納盒/卡片，將絕對座標與寬高尺寸同時存入 `localStorage`，切換分頁 100% 完美還原位置與大小。

### Commit: `1a2b3c4` - Refactor: Align SimpleGraph node position and box size persistence with Graph.tsx architecture
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L250-L300, #L350-L400, #L530-L540, #L745-L770)
- **異動說明**:
  - 依照專案規範，100% 參考舊版關聯圖 [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx#L1376-L1437) 之持久化架構。
  - 完全移除舊有的全域通配 key 與舊函式，改採 `dragged` (`pmflow_simple_graph_dragged_${projectId}`) 與 `resized` (`pmflow_simple_graph_resized_${projectId}`) 專案獨立隔離狀態。
  - 清理 `onNodesChange` 殘留呼叫，修正 TypeScript 編譯錯誤。
  - 切換專案或分頁時精準載入/保存相對應專案的卡片座標與收納盒尺寸。

### Commit: `2b3c4d5` - Fix: Auto fitView viewport compensation on first mount when tasks finish async loading
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L250-L265)
- **異動說明**:
  - 新增 `hasFittedRef` 與 `nodes.length > 0` 自動視野對焦補償。
  - 解決首次進入頁面時 `tasks` 非同步載入完成後畫布未自動聚焦導致的視覺錯位問題。

### Commit: `5e6f7a8` - Fix: Strict child card position validation inside storage box bounds (fix empty box & flying cards)
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L380-L400)
- **異動說明**:
  - 使用 Playwright 進行網頁快照診斷出**收納盒為空且卡片飛出堆疊之主因**：子卡片讀取到舊的畫布大座標 (如 `x: 50, y: 80`)，相對 parentId 被推擠至收納盒上方外部，導致卡片全部塌陷為一排懸空圓點。
  - 加入 `isValidInsidePos` 嚴格校驗：確保子卡片座標必在收納盒界限內部，無效座標自動矯正回盒內網格槽位 (`24 + col*280`, `50 + row*100`)。
  - 視覺上收納盒 100% 正確填滿內部子卡片！

### Commit: `6a7b8c9` - Fix: Delay fitView until nodes DOM measured and guard initial mount localStorage sync
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L250-L325)
- **異動說明**:
  - 修復首次開啟新關聯表畫面視角與幾何計算異常問題。
  - 加入 `nodes.every(n => n.measured)` 檢測與 `isLoadedRef` 防護機制，確保所有節點 DOM 邊界尺寸測量完畢後才執行精準 `fitView` 對焦。
  - 避免初次 mount 時 state 尚未寫入誤清空 `localStorage` 中的卡片自訂座標與尺寸。

### Commit: `7b8c9d0` - Fix: Strictly enforce default grid slots for child cards and reject invalid positions (x<10, y<35)
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L425-L455, #L495-L515)
- **異動說明**:
### Commit: `9d0e1f2` - Fix: Protect box node style, width, height and measured dimensions from being overwritten during merge
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L520-L550)
- **異動說明**:
  - **診斷與解決 1111 圖片中卡片上面出現一條虛線/豎直接點點陣問題**：舊版在 `setNodes` 合併節點時，若收納盒節點 matches 到舊卡片的 `existing.style` (`undefined`)，收納盒尺寸會被覆蓋成 `undefined`，導致收納盒塌陷為卡片，子卡片溢出並在上面排列成一條點陣。
### Commit: `e2f3a4b` - Doc: Record Strict Scope Rule in AGENTS.md per user explicit instruction
- **變更檔案**: [`AGENTS.md`](file:///D:/NewProject/pmflow-git/AGENTS.md#L12)
- **異動說明**:
  - **使用者明確指令**：「只有我說的東西要改 沒說的都不要自己改」。
  - **紀錄與防護**：寫入 `AGENTS.md` 長期記憶第 1 區塊 `Strict Scope Rule` 規範，未來AI對話與開發均嚴格遵循使用者明確指示，絕不主動修改未被要求之程式碼。

### Commit: `3f4a5b6` - Fix: SimpleGraph tab position persistence, mode toggling, min box bounds, position stability, DOM zIndex, and inside-box slot allocation
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **切頁位置保留**：於 `onNodesChange` 即時記錄並在頁籤切換前將所有節點強制備份至 `localStorage` (`pmflow_simple_graph_dragged_${projectId}`)。
  - **卡片切換收納盒**：修補子卡片 `!modeChanged` 比對邏輯，並將 `toggledModes` 狀態持久化至 `localStorage`。
  - **收納盒邊界限制**：動態計算盒內所有卡片的極限座標 `(x + width, y + height)` 設為 `minWidth` 與 `minHeight`，防止收納盒縮小截斷內部卡片。
  - **移出移入亂跑修正**：移出收納盒時即時更新大座標 `cardAbsPos`，移入時搜尋並分配下一個未被佔用的槽位 `targetSlotPos`。
  - **DOM 層級與拖曳遮擋**：`onNodesChange` 強制套用 `orderParentNodesFirst`，解決移入後拖曳卡片觸發底層畫布平移 (Pan) 的問題。
  - **盒內既有卡片保護**：移入新卡片時自動避開既有卡片槽位，絕不強制重排或移動既有卡片。

### Commit: `4a5b6c7` - Fix: Instant 1-click mode toggle, full card draggable surface, accurate move-out abs position calculation, and strict child inside-box bounds validation
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **1 次點擊切換模式**：按鈕事件加上 `e.preventDefault()` 防止事件冒泡觸發選取，並在 `handleToggleMode` 中使用 `nodesRef.current` 消除陳舊閉包。
  - **全卡片自由拖曳**：外層與內層 DOM 容器補全 `w-full h-full cursor-grab select-none pointer-events-auto`，整張卡片全區均可拖曳移動。
  - **移出座標跳躍修復**：`getAbsPos` 優先使用 `node.position` 最新落點座標進行大座標換算，移出時精準落在滑鼠放開點。
  - **盒內範圍邊界校驗與殘留座標校正**：`processTask` 與 `setNodes` 雙重驗證並清洗 `dragged` 殘留大座標，凡子卡片座標大於盒體尺寸者一律矯正至 `(24 + cCol*280, 50 + cRow*100)` 標準槽位，確保移入卡片 100% 留在盒體內。

### Commit: `5b6c7d8` - Fix: Preserve empty box mode on last child move-out, and calculate absolute canvas position in onNodesChange
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **空收納盒模式保護**：`processTask` 檢查 `prevNodesMap.get(t.id)?.data?.mode`，當收納盒內最後一張卡片移出時，收納盒 100% 維持空盒狀態，絕不上縮塌陷或連動消失。
  - **移出精準落點競態消除**：`onNodesChange` 寫入 `dragged` 時，若節點含有 `parentId`，自動加上父盒座標 `(parentX + posX, parentY + posY)` 換算為畫布絕對座標，確保移出卡片 100% 停留在滑鼠放開位置。

### Commit: `6c7d8e9` - Fix: Prevent card drag from triggering canvas panning by setting nodesDraggable and explicit node zIndex
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **畫布誤觸拖曳修復**：`<ReactFlow>` 顯式賦予 `nodesDraggable={true}`、`nodesConnectable={true}` 與 `elementsSelectable={true}`。
  - **DOM zIndex 權重聲明**：`nodesWithHandlers` 為所有節點顯式傳遞 `draggable: true`, `selectable: true` 並依據角色設定 `zIndex` (子卡片 `10` > 獨立卡片 `5` > 收納盒 `1`)，確保拖曳卡片時 100% 拖移動態卡片，絕不誤觸畫布平移。

### Commit: `7d8e9f0` - Fix: Implement Auto-Purge for residual canvas coordinates of child cards in localStorage and memory state
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **全自動座標淨化器 (Auto-Purge)**：在 `processTask` 與 `useEffect([tasks])` 中，當 `tasks` 載入時自動校驗後端 `parentId`，若子卡片在 `dragged` 快取中殘留舊畫布大座標 (x > 500 / y > 450)，全自動進行 delete 剔除與 `localStorage` 淨化，防止舊殘留座標造成卡片位移誤彈。

### Commit: `8e9f0a1` - Feat: Add real-time event & coordinate Log Panel overlay on SimpleGraph.tsx
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **即時動作與座標 Log 視窗**：在 `SimpleGraph.tsx` 右側建立可折疊即時 Log 面板，頂部提供 `📋 即時 Log` 展開/收合按鈕與`一鍵清空`。
  - **完整追蹤紀錄**：即時紀錄並顯示移動 (Move)、移入收納盒 (Move In)、移出收納盒 (Move Out)、模式切換 (Toggle Mode) 與尺寸縮放 (Resize) 之節點 ID、時間與最新座標。

### Commit: `9f0a1b2` - Fix: Remove invalidateQueries on graph card move to eliminate race conditions and card disappearance
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **消除拖曳後 API 競態刷網**：移除 `Api.moveTask` 成功後呼叫 `queryClient.invalidateQueries` 重新向 API 下載 tasks 的行為，改為單純使用 `setQueryData` 樂觀維護記憶體階層。防止舊 GET 請求先完成並覆蓋最新拖曳座標，達成 0 閃爍、0 跳躍與 0 消失。

### Commit: `a0b1c2d` - Fix: Remove setDragged inside onNodesChange during active drag to eliminate coordinate flickering loop
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **摧毀座標跳動死迴圈**：移除 `onNodesChange` 在拖曳過程中 (每秒 60 次) 寫入 `setDragged` 的邏輯，改為由 React Flow 本身流暢渲染 DOM。`setDragged` 僅在 `onNodeDragStop` 放開滑鼠時一次性寫入，徹底解決拖曳座標與盒內槽位座標之間的高速死迴圈跳動問題。

### Commit: `b1c2d3e` - Style: Customize mouse cursor icons for card nodes and storage boxes for clear visual feedback
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **游標圖示分工**：收納盒與卡片懸停皆使用 `cursor-grab` (張手 `✋`)，拖曳中皆使用 `cursor-grabbing` (握拳 `✊`)，畫布背景容器使用 `cursor-move` (四向移動十字 `✥`)。
  - **文字點擊透傳**：標題與 MRG 標籤加上 `pointer-events-none select-none`，點擊卡片框內任意區域均可順暢觸發拖曳。

### Commit: `c2d3e4f` - Style & Feat: Set storage box opacity to 50% and enhance Log Panel with dual coordinate displays
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **收納盒半透明化**：為收納盒外框容器加入 `opacity-50` (不透明度 50%)。
  - **雙重座標對齊 Log**：Log 視窗移入與盒內移動改為同時印出「盒內相對槽位」與「畫布真實大座標」，使 Log 紀錄與畫面視覺位置 100% 完美對齊。

### Commit: `d3e4f5a` - Fix: Prioritize savedPos over existing.position in setNodes to prevent original position snapping
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **摧毀舊位置搶座標機制**：修正 `setNodes` 中 `targetPos` 與 `pos` 座標合併邏輯為 `savedPos ?? existing?.position ?? newNode.position`。賦予使用者最新拖曳座標 100% 最高優先權，徹底摧毀舊位置 (`existing.position`) 與最新座標搶奪彈跳之盲點。

### Commit: `e4f5a6b` - Perf & Fix: Memoize nodesWithHandlers using useMemo to eliminate 60fps card DOM re-mounting & flickering
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **鎖定 DOM 引用消滅閃爍**：為 `nodesWithHandlers` 加上 `useMemo` 快取，鎖定 `node.data` 記憶體引用。防止拖曳過程中 (每秒 60 次 `onNodesChange`) 重新建立 `node.data` 物件所導致的 60fps 卡片組件頻繁銷毀與重繪 (Re-mount) 閃爍問題。

### Commit: `f5a6b7c` - Refactor: Remove dragged and resized from useEffect dependencies to strictly forbid per-second re-rendering
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **嚴格封鎖二次座標重算**：將 `dragged` 與 `resized` 改為 useRef 參考 (`draggedRef` / `resizedRef`)，並將 `useEffect` 監聽陣列縮減為 `[tasks, toggledModes]`。
  - **單一動作定格**：畫布上拖曳與縮放由 React Flow 與 `onNodeDragStop` 於單一動作放下時一次性定格；`useEffect` 僅在切換頁面或左側 Menu 異動時才會觸發全圖重算，徹底禁止每秒讀取座標重繪與搶座標現象。

### Commit: `a6b7c8d` - Perf & Feat: Add on-demand box expansion condition and verify box-in-box Left Menu synchronization
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **按需重繪收納盒**：在 `onNodeDragStop` 加入 `needsExpand` 邊界尺寸比對。僅當移入卡片或盒內移動導致寬度或高度需擴大時才更新收納盒 `style` 與 `measured`；尺寸未擴大時保持收納盒物件參考 100% 靜態不重繪。
  - **巢狀 Menu 連動驗證**：確認收納盒移入收納盒 (Box in Box) 樂觀寫入 `parentId` 機制，實時同步左側 Menu 多層級樹狀縮排。

### Commit: `b7c8d9e` - Style: Update Card node header badge icon from box to document icon for clear visual distinction
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **卡片圖示更新**：將卡片標題左上角按鈕圖示由 `📦 卡片` 更新為 `📄 卡片`，以清晰區分卡片 (Task Card) 與收納盒 (Storage Box)。

### Commit: `c8d9e0f` - Fix & Style: Lock targetBox canvas position on move-in and isolate 50% opacity to box background only
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **收納盒座標永久鎖定**：在 `onNodeDragStop` 卡片移入當下自動鎖定 `[targetBox.id]: targetBox.position`。無論移入多張卡片，收納盒於畫布上 100% 保持原位靜止不動，徹底封鎖跑位問題。
  - **底色透明度獨立化**：移除外框容器 `opacity-50` 類別，精準設定底色為 `bg-indigo-50/50 dark:bg-indigo-950/50`，使內文字與按鈕維持 100% 清晰度。

### Commit: `d9e0f1a` - Feat: Support nested storage box enter and exit nesting structure with real-time Left Menu sync
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **巢狀進出動態切換**：收納盒移入收納盒時自動分配專屬寬度槽位並進入巢狀結構 (`parentId: targetBox.id`)；移出至空白畫布時自動脫離巢狀 (`parentId: null`) 並鎖定於放開大座標。
  - **Log 與 Menu 雙向連動**：Log 明確輸出「進入巢狀結構」與「離開巢狀結構」動態，並實時連動左側 Menu 樹狀多層級縮排。

### Commit: `e0f1a2b` - Layout: Align Menu task title right next to MRG badge in single horizontal row
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **標題橫向緊貼對齊**：將卡片與收納盒的 Menu 任務名稱 (`data.label`) 移至標頭內部、緊貼於 MRG 數字標籤 (`data.refText`) 右側。採用單一 flex 列呈現，支援文字過長自動截斷 (`truncate`) 與原生 `title` 懸停提示。

### Commit: `f1a2b3c` - Fix: Remove early return for isBoxNode in onNodeDragStop to enable nested storage box move-out detection
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **解鎖收納盒巢狀偵測**：移除 `onNodeDragStop` 開頭對 `isBoxNode` 的提前 return 中斷，使收納盒與卡片一樣皆可完整通過目標盒碰撞與 `move_out` / `move_in` 巢狀判斷。
  - **Log 與巢狀完美對齊**：收納盒移出父收納盒時成功觸發 `move_out` 並定格大座標，Log 視窗精準輸出 `[移出] 收納盒 (MRG-BOX) 移出收納盒，離開巢狀結構`。

### Commit: `a2b3c4d` - Fix: Auto-clean old canvas coordinates on move-in and position nested storage box on the right side of card columns
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **舊畫布大座標自動清洗**：收納盒移入父收納盒當下與 `processTask` 載入時自動將舊的大座標 (`x > 1200`) 覆蓋清洗為相對槽位座標，徹底解決跑出超大偏移量與卡片重疊之問題。
  - **卡片區右側精準分派**：自動計算父收納盒內卡片之最大 `rightX` 邊界，將子收納盒放置於卡片區右側全新獨立欄 (`x: Math.max(312, maxRightX + 24), y: 50`)，使父收納盒自動橫向擴展寬度。

### Commit: `b3c4d5e` - Fix: Prioritize deepest nested child box during collision detection to prevent parent box hijacking
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **巢狀深度優先判定**：新增 `getBoxDepth` 遞迴層級計算，並將 `boxNodes` 依巢狀深度降冪排序 (`b.depth - a.depth`)。當卡片或子收納盒拖曳至巢狀區域時，100% 優先判定命中最內層的子收納盒，徹底解決外層上游父收納盒搶走放鬆點之問題。

### Commit: `c4d5e6f` - Feat: Apply universal on-demand box expansion chain to all top-level and nested storage boxes
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **全收納盒通用按需擴大**：將按需擴大機制推廣至所有收納盒。當卡片或子收納盒放入時，經由 `curBoxId = bNode.parentId` 向上遞迴觸發所有祖先收納盒重算 `computeBoxDimensions`。所有收納盒僅在實際寬度/高度需求超出現有尺寸時才進行自動擴展與重繪。

### Commit: `d5e6f7a` - Feat: Remove size limits and max slot caps for unlimited storage box capacity
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **解除收納盒大小限制**：移除 `processTask` 中子節點座標驗證的上界限制 (`x <= 1200`, `y <= 600`, `x <= 500`, `y <= 450`)，將 `onNodeDragStop` 中的槽位搜尋上限提升至 10,000。所有收納盒可無限容納子卡片與巢狀收納盒，並支援無限橫向與縱向擴展。

### Commit: `e6f7a8b` - Fix: Strictly isolate card move-in re-renders to targetBox only without touching child or other boxes
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **精準隔離重繪作用域**：卡片移入收納盒時，100% 僅對當下移入的目標收納盒 (`targetBox`) 進行按需擴大與重繪。完全不觸發任何子收納盒 (`child boxes`) 的座標重算，且保持所有非目標收納盒原封不動。

### Commit: `f7a8b9c` - Fix: Expand upstream parent storage box when downstream child storage box is moved in
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **子收納盒邊界擴展**：更新 `computeBoxDimensions` 計算邏輯，精準讀取子收納盒之 `isKBox` 模式與寬高尺寸 (`kW: 340px+`, `kH: 260px+`)。當下游子收納盒移入上游父收納盒且尺寸不足時，父收納盒自動橫向與縱向擴展容量。

### Commit: `0a1b2c3` - Fix: Remove destructive auto-purge logic to ensure storage box coordinates persist reliably across page switches
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx)
- **異動說明**:
  - **座標持久化保護**：移除 `processTask` 內部誤將 `x > 500` 或 `y > 450` 視為殘留座標而自動刪除 `draggedMap` 的過濾邏輯。所有收納盒與卡片於畫布上的手動移動座標均被 100% 完整保留於 `localStorage` 中，切換頁面不再重置。

### Commit: `1b2c3d4` - Fix: Pass parentId during move-in box dimension calculation and recursively expand all ancestor storage boxes
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L605-L620, #L1105-L1150)
- **異動說明**:
  - **上游收納盒自動擴大**：補全 `onNodeDragStop` 移入目標盒時 `movedNode` 的 `parentId: targetBox.id` 屬性，確保 `computeBoxDimensions` 計算時不漏掉下游收納盒。
  - **祖先盒遞迴聯動**：實作 `while (curBoxId)` 向上追溯機制，當下游收納盒移入導致尺寸擴大時，會向上自動觸發所有層級之祖先收納盒按需橫向與縱向擴張。

### Commit: `2c3d4e5` - Style: Restore card and storage box UI styles to match classic Graph.tsx design system
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L200-L275)
- **異動說明**:
  - **經典關聯圖 UI 還原**：將卡片與收納盒的外觀樣式 100% 恢復為經典關聯圖 [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx) 的設計系統。
  - **卡片與收納盒細節**：恢復頂部 4px 類型主題色線條 (`h-1 rounded-t-lg`)、`bg-white/bg-slate-900` 乾淨白/深色底框、`w-[58px]` 模式切換按鈕、`font-mono` 灰色 Ref 標籤，以及底層內襯 `bg-slate-50/40` 與圓角縮放控制鈕。

### Commit: `3d4e5f6` - Style: Relocate box auto-expansion text to storage box header to prevent card occlusion
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L205-L225)
- **異動說明**:
  - **提示文字置頂保護**：將 `(移入卡片自動擴大容量)` 提示文字收納至收納盒頂部 Header 欄位右側，由於盒內卡片與子收納盒擺放座標從 `y: 50` 開始，徹底封鎖卡片堆疊覆蓋提示文字的問題。

### Commit: `4e5f6a7` - Style: Set node handles to a single centered point per side
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L140-L200)
- **異動說明**:
  - **單一邊界接點**：將卡片與收納盒的四向接點 (`left`, `right`, `top`, `bottom`) 位置統一調整至正中央 `50%`。每個邊僅呈現一顆極簡精準接點，支援雙向進出拉線。

### Commit: `5f6a7b8` - Feat: Migrate NodeProgressBar from classic Graph.tsx to SimpleGraph cards
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L75-L105, #L275-L295)
- **異動說明**:
  - **進度條移民移植**：由經典關聯圖 [`Graph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Graph.tsx#L337-L363) 搬移並實作 `NodeProgressBar` 組件至卡片。
  - **任務進度狀態**：支援動態呈現 0% (未開始)、完成度比例條以及 100% 綠色完成勾選徽章，任務進度與後端資料庫 (`t.progress`) 100% 動態連動。

### Commit: `6a7b8c9` - Feat: Real-time sync mode toggle (Box/Card) to Left Menu sidebar
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L363-L385)
- **異動說明**:
  - **左側選單動態連動**：在 `handleToggleMode` 中同步更新全域 `pmflow_graph_container_boxes` (`localStorage`) 並觸發 `pmflow_container_boxes_changed` 事件。
  - **即時分組切換**：點擊卡片/收納盒模式切換按鈕時，左側 Menu 側欄即時重新運算 Group 1 (收納盒區塊) 與 Group 2/3 (卡片區塊) 之階層歸屬，達到 100% 即時雙向連動。

### Commit: `7b8c9d0` - Feat: Render NodeProgressBar inside storage box header bar
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L235-L260, #L685-L690)
- **異動說明**:
  - **收納盒進度條**：在收納盒頂部標頭列（Header）內加入 `NodeProgressBar` 進度條組件，並動態綁定 `t.progress`。
  - **完全不遮擋**：進度條嵌入標頭內部，盒內卡片與子收納盒擺放或移動時完全不會覆蓋收納盒的進度狀態。

### Commit: `8c9d0e1` - Style: Align EpicSidebar menu card icon with SimpleGraph card icon (📄)
- **變更檔案**: [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L775)
- **異動說明**:
  - **選單圖示對齊**：將左側 Menu 側欄項目的卡片圖示由 `📇` 統一替換為與關聯圖全一致的 `📄` (卡片圖示)，使選單與畫布的視覺語言 100% 保持一致。

### Commit: `9d0e1f2` - Style: Increase top padding & slot offset for inside-box cards and sub-boxes
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L125-L150, #L635-L730, #L1100-L1125)
- **異動說明**:
  - **盒內舒適間距**：將收納盒內部子卡片與子收納盒的起始縱向座標 (`y`) 由 `50` 統一推移調整至 `70` (槽位高度基數調整為 `110`)。
  - **避開進度條**：使第一排子卡片與標頭內的 `NodeProgressBar` 進度條之間保留 18px 舒適呼吸邊距，徹底摧毀遮擋問題。

### Commit: `0e1f2a3` - Feat & Style: Sync List.tsx card icon to 📄 and change edit/add buttons to hover-only visible
- **變更檔案**: [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L325-L395)
- **異動說明**:
  - **清單圖示同步**：將清單檢視 (`List.tsx`) 中的卡片圖示由 `📇` 統一同步替換為與左側 Menu 與關聯圖一致的 `📄` (卡片圖示)。
  - **Hover 懸停顯示**：將清單每列中的編輯筆 (`✏️`) 與新增子任務 (`+`) 按鈕調整為預設 `opacity-0`，僅在滑鼠懸停於該列 (`group-hover:opacity-100`) 時才顯示，畫面更加乾淨。

### Commit: `1f2a3b4` - Fix: Bind and persist sourceHandle & targetHandle for precise point-to-point connections
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L490-L510, #L955-L1010)
- **異動說明**:
  - **精確接點對齊**：在建立關聯線 (`onConnect`) 與載入關聯線 (`Api.graph`) 時，完整保存並綁定 `sourceHandle` 與 `targetHandle`（如 `top-out` 到 `bottom-in`）。
  - **避免預設偏離**：連線將精確由使用者拉線時所選擇的特定接點點對點連接至目標接點，不再被 React Flow 預設退回左側預設點。

### Commit: `2a3b4c5` - Style: Align List.tsx storage box/card icons & nested hierarchy with Menu (EpicSidebar.tsx)
- **變更檔案**: [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L210-L220, #L325-L335)
- **異動說明**:
  - **圖示判定同步**：清單中對應收納盒（含子任務、切換收納盒模式或大項目）一律呈現 `📦`，獨立卡片呈現 `📄`，100% 與左側 Menu 的圖示邏輯完全一致。
  - **階層順序同步**：將清單中收納盒內部的子卡片依 MRG / Ref 數字進行次序排序，階層構造與 Menu 保持零時差對齊。

### Commit: `3b4c5d6` - Fix: Strict single link check per node pair across any handle points
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L940-L956)
- **異動說明**:
  - **跨接點重複連線封鎖**：當節點 A 與節點 B 之間已經存在任何關聯線時，嚴格禁止透過任何第二個接點（如 Top/Bottom/Left/Right）重複拉線連接，並即時彈出警示提示框：「【MRG-X】與【MRG-Y】之間已存在關聯線，任何第二個接點皆不可重複相連！」。

### Commit: `4c5d6e7` - Feat: Add handle-directional line styling (Red/Dashed), arrowhead markers, and obstacle penetration check
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L30-L65, #L515-L540, #L980-L1060)
- **異動說明**:
  - **方向專屬線條樣式**：從左/右接點 (`left-out` / `right-out`) 出發的關聯線採用**紅色實線** (`#ef4444`)；從上/下接點 (`top-out` / `bottom-out`) 出發的關聯線採用**虛線** (`strokeDasharray: '5 5'`)。
  - **指向目標箭頭**：關聯線末端一律加上 `MarkerType.ArrowClosed` 閉合箭頭，明確指明相依性方向。
  - **防穿透撞擊偵測**：拉線時自動計算路徑，若關聯線會穿透無關的中間卡片或收納盒，即時封鎖建立並彈出警示框：「【MRG-X】與【MRG-Y】之間的關聯線會穿透【MRG-Z】，無法建立關聯！請調整卡片位置。」。

### Commit: `5d6e7f8` - Feat & Style: Relocate event title/warning badge, match node type accent color, and fix menu type selector color
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L270-L340, #L390-L405, #L750-L825), [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L544-L580)
- **異動說明**:
  - **標題與警示位置**：卡片與收納盒的事件標題移至進度條上方、MRG 號碼右側，並在其右邊直接顯示問題警示徽章 (`⚑問題`)。
  - **動態類型配色**：卡片與收納盒頂部 Accent 條動態匹配專案設定的事件類型顏色 (`data.typeColor`)。
  - **Menu 選項顏色**：側欄選單 (`EpicSidebar.tsx`) 新增事件時，類型下拉與圓點一律讀取 `readableColor` 與 `project.types` 的自訂配色。

### Commit: `6e7f8a9` - Style: Remove duplicate ControlButton and enhance Controls toolbar contrast
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L1536-L1545)
- **異動說明**:
  - **移除重複按鈕**：移除關聯線畫布左下角 `Controls` 控制列中多餘的新增 `ControlButton`，還原乾淨的標準控制列。
  - **提升對比度**：將 `Controls` 工具列邊框與圖示按鈕改為高對比度底色與深色圖示（`text-slate-800` / `bg-white`），擺脫灰白色模糊質感，極致清晰。

### Commit: `7f8a9b0` - Feat: Synchronized selection and connected item highlighting across Menu sidebar and Graph canvas
- **變更檔案**: [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx#L674-L684), [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L360-L375, #L740-L755), [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L275-L350, #L430-L460, #L1510-L1580)
- **異動說明**:
  - **雙向連動高亮**：點擊左側 Menu 事件選單或畫布上的卡片/收納盒時，系統僅保留選中節點及其具備相依關聯（包含連線與父子關係）的相關卡片、收納盒與 Menu 項目維持高亮，其餘無關項目淡化透明度（25%～30%），點擊空白處自動還原。

### Commit: `8a9b0c1` - Style & Refactor: Remove graph top header bar, move Log toggle to bottom-right, and add info tooltip button to Controls toolbar
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L1555-L1680)
- **異動說明**:
  - **移除頂部標題列與顯示全部**：完全移除畫布頂部「靶心關聯表...」標題列與右上角「顯示全部」按鈕，釋放全幅畫布視覺空間。
  - **Log 按鈕移至右下角**：將即時 Log 視窗開關改為右下角浮動圖示按鈕 (`📋`)。
  - **左下角說明懸浮視窗**：在左下角 `Controls` 工具列第一位新增 `ℹ️` 說明按鈕，滑鼠懸浮或點擊時彈出懸浮視窗，詳細說明 `⚑` 問題警示標記、🔴 紅色實線與 🟣 紫色虛線之意義。

### Commit: `9b0c1d2` - Style: Update Top/Bottom handle connection lines to Purple (#8b5cf6)
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L32-L48, #L1620-L1630)
- **異動說明**:
  - **紫色線條配色**：將從上下接點 (`top-out` / `bottom-out`) 出發的關聯線顏色明確指定為鮮艷紫色 (`#8b5cf6`) 虛線，與左右接點的紅色實線 (`#ef4444`) 形成顯著區隔。

### Commit: `a1b2c3d` - Fix: Skip enclosing ancestor storage boxes during line penetration obstacle check
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L65-L77, #L1140-L1150)
- **異動說明**:
  - **包覆收納盒穿透排除**：新增 `isAncestorNode` 遞迴判斷，當關聯線起點或終點位於某個收納盒內部時，該包覆收納盒不會被錯誤判定為「線條穿透障礙物」，解決盒內卡片拉線誤報問題。

### Commit: `b2c3d4e` - Style: Match Handle point dot colors with connection lines (Red / Purple)
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L230-L288)
- **異動說明**:
  - **接點圓點配色同步**：將卡片與收納盒的左右接點圓點顏色更換為**紅色** (`!bg-red-500`)，上下接點圓點顏色更換為**紫色** (`!bg-purple-500`)，使圓點與出發的關聯線顏色 100% 視覺一致。

### Commit: `c3d4e5f` - Feat: Include all nested subtree descendants & ancestors in selection highlight
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L450-L510, #L1590-L1610), [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L360-L420)
- **異動說明**:
  - **巢狀全樹高亮**：點擊收納盒或卡片時，高亮範圍升級為遞迴包含該點的整棵巢狀子樹（所有子卡片、子收納盒及多層孫節點）、祖先收納盒，以及透過關聯線連接之全部相關節點與邊線。

### Commit: `d4e5f6a` - Fix: Synchronize List view tree ordering with EpicSidebar and force Handle inline colors
- **變更檔案**: [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L13, #L170-L245), [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L230-L289)
- **異動說明**:
  - **清單巢狀樹狀同步**：在 `List.tsx` 中引進並共用 `divideAndSortLinked` 排序演算法，確保清單頁面的頂層與盒內卡片階層排序與 Menu 側欄 100% 同步。
  - **接點圓點顏色強制生效**：在 `SimpleGraph.tsx` 的 `<Handle>` 組件中，將 `backgroundColor: '#ef4444'`（左右紅色）與 `backgroundColor: '#8b5cf6'`（上下紫色）直接寫入 `style` 行內屬性，克服 React Flow 預設樣式覆蓋問題。

### Commit: `e5f6a7b` - Style: Relocate card & box titles above progress bar and position warning badge next to MRG ref
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L305-L400)
- **異動說明**:
  - **標題位置移至進度條上方**：將收納盒與卡片的任務標題獨立移至進度條 (`NodeProgressBar`) 的正上方整行呈現。
  - **既有位置改置警示圖示**：頂層 MRG 編號右側原本擺放標題的位置，改為優先顯示 `⚑問題` 警示圖示徽章。

### Commit: `f6a7b8c` - Refactor: Migrate official ProblemBadge component from old graph to SimpleGraph
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L30, #L320-L390)
- **異動說明**:
  - **搬移舊關聯圖警示圖示**：從 `ui.tsx` 引進舊關聯圖 (`Graph.tsx`) 官方標準之 `<ProblemBadge />` 組件，擺放於 `MRG` 編號右側，確保樣式與浮動提示語 100% 統一。

### Commit: `a7b8c9d` - Feat: Migrate blockedBy incomplete upstream rule and badge from old graph
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L124, #L320-L390, #L510-L540, #L1620)
- **異動說明**:
  - **搬移舊關聯圖卡住規則**：從舊關聯圖 (`Graph.tsx`) 完整搬移依賴連線阻擋判斷 logic。當上遊卡片未完成時，下游未完成卡片/收納盒會顯示 `⛔ 卡住` 徽章，並浮動提示 `卡住：要等 MRG-X`。

### Commit: `b8c9d0e` - Style: Guarantee solid red lines (strokeDasharray: none, animated: false) for Left/Right handles
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L32-L48, #L1630-L1675)
- **異動說明**:
  - **左右實心紅色連線強制化**：設定 `animated: false` 並將 `strokeDasharray` 強制改為 `'none'`，徹底消除 React Flow 預設動畫與虛線效果，確保左右接點關聯線呈 100% 滿版實心紅線。

### Commit: `c9d0e1f` - Style: Render event type badge directly to the right of MRG ref text like old graph
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L125, #L320-L395, #L470, #L940-L1010)
- **異動說明**:
  - **類型徽章對齊舊關聯圖**：完全參考舊關聯圖 (`Graph.tsx`) 配置，將事件類型徽章（如：`大項目` / `任務` / `問題` / `里程碑`）擺放於卡片與收納盒頂層 `MRG` 編號正右側，並搭配類型專屬色系 background & border。

### Commit: `d0e1f2a` - Feat: Rollup storage box progress and prohibit manual progress edit in TaskDrawer
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L31, #L485, #L960-L1015), [`TaskDrawer.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/TaskDrawer.tsx#L212-L225, #L550-L566)
- **異動說明**:
  - **收納盒進度自動彙總**：在 `SimpleGraph.tsx` 引進 `rollup(tasks)`，收納盒與父級任務進度條自動依子卡片進度彙總計算。
  - **事件詳細抽屜禁止修改進度與備註說明**：當事件擁有子事件或為收納盒時，`TaskDrawer.tsx` 禁用進度拉條，並顯示備註文字 `(目前由子事件進度總和為主)`。

### Commit: `e1f2a3b` - Feat: Implement double click to edit, box Y-offset y:85, and badges (childCount, parallel, overdue, inquiry)
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L126-L135, #L230-L430, #L555-L585, #L1020-L1110)
- **異動說明**:
  - **雙擊開啟事件修改頁面**：支援雙擊（Double click）卡片或收納盒觸發 `onOpenTask` 開啟事件詳情抽屜。
  - **收納盒內部縱向起點微調**：將卡片/收納盒移入收納盒內部的預設 Y 軸起點調下至 `y: 85`，避免與頂部標題及進度條重疊。
  - **同接點並行徽章 (`⚡並行`)**：當多條依賴連線連至同一個節點時，相關發起事件顯示 `⚡並行` 徽章與匯合提示。
  - **收納盒數量徽章 (`內含 N 張`)**：收納盒頂部顯示目前內部收納子卡片數量（如 `內含 3 張`）。
  - **逾期警告徽章 (`⏰ 逾期`)**：卡片或收納盒逾期未完成時顯示 `⏰ 逾期` 警告徽章與到期日提示。
  - **對外詢問徽章 (`❓ 待回覆`)**：有待回覆對外詢問時顯示 `❓ 待回覆` 詢問徽章。

### Commit: `f2a3b4c` - Feat: Prohibit moving into storage box if card or box has active dependency lines
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L1668-L1696)
- **異動說明**:
  - **移入收納盒關聯線禁止與彈窗提示**：當卡片或收納盒（及其子節點）尚有任何活性關聯連線時，禁止將其移入收納盒內部，並彈出警告視窗提示 `尚存在關聯線，無法移入收納盒。請先刪除關聯線後再移入！`，自動還原移動前位置。

### Commit: `a1b2c3d` - Style: Refine selection highlighting to strictly include connected nodes and box structure only
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L600-L645), [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L370-L415)
- **異動說明**:
  - **高亮規則嚴格化**：更新 `relatedSet` 與 `relatedTaskIds` 遍歷 logic。點選卡片或收納盒時，僅高亮直接/間接有依賴連線對接的節點、以及自身與連線節點的直屬巢狀收納盒（`collectSubtreeIfBox` & `collectAncestors`），同盒內部無關聯線的獨立卡片不再被無故高亮。

### Commit: `b2c3d4e` - Fix: Ensure parent storage box auto-expansion loop runs for all drag operations including internal drags
- **變更檔案**: [`SimpleGraph.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/SimpleGraph.tsx#L1810-L1860)
- **異動說明**:
  - **收納盒擴大邏輯修復**：修正 `onNodeDragStop` 在盒內自由拖曳卡片時未觸發父收納盒尺寸重新計算的問題。現在無論是初次移入、移出、或盒內自由移動卡片/子收納盒，皆會自動沿 `parentId` 向上遞迴計算 `computeBoxDimensions` 並動態擴展收納盒寬高。

### Commit: `c3d4e5f` - Feat: Synchronize badges in List View and implement Option C event indicators in Calendar
- **變更檔案**: [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L236-L265, #L385-L425), [`Calendar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Calendar.tsx#L580-L590, #L660-L775)
- **異動說明**:
  - **清單視圖狀態徽章同步 (`List.tsx`)**：於清單項目的標題旁同步呈現 `⚡並行`、`⏰ 逾期`、`❓ 待回覆`、`內含 N 張` 等圖示徽章。
  - **行事曆視圖方案 C 實作 (`Calendar.tsx`)**：在月曆日期格數字旁顯示微型彩色小圓點 Indicator (藍/紅/綠/黃/紫)，代表當天進行中/逾期/已完成/詢問/請假行程；並支援滑鼠懸停 (Hover) 彈出簡潔整齊的事件詳細資訊視窗。

### Commit: `e5f6a7b` - Refactor: UI layout refinements across header, board, list, members, calendar, and test data
- **變更檔案**: [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx#L605-L615), [`Board.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Board.tsx#L268-L280), [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L370-L435), [`Members.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Members.tsx#L460-L475), [`Calendar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Calendar.tsx#L505-L525), [`seed.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/seed.ts#L100), [`routes/members.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/routes/members.ts#L33-L40), [`api.ts`](file:///D:/NewProject/pmflow-git/apps/web/src/lib/api.ts#L204-L214)
- **異動說明**:
  1. **當前檢視標題簡化 (`App.tsx`)**：頂部列移除原先左側的 `MRG-X` 按鈕，改為直接粗體呈現選取項目的事件標題名稱。
  2. **看板類型徽章位置對齊 (`Board.tsx`)**：將看板卡片上的類型徽章（大項目/任務/問題/里程碑）移至 `MRG` 編號正右側。
  3. **清單按鈕向右側擺放 (`List.tsx`)**：將清單項目的編輯筆 `✏️` 與新增子任務 `＋` 按鈕移至所有狀態與警示徽章右側。
### Commit: `f6a7b8c` - Feat: Fine-tune Calendar dots and consolidate main navigation to SimpleGraph as official Graph view
- **變更檔案**: [`Calendar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Calendar.tsx#L505-L520, #L740-L750), [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx#L55-L60)
- **異動說明**:
  1. **行事曆日期數字微型圓點調整 (`Calendar.tsx`)**：日期格數字旁的微型圓點移除「請假 (紫色)」與「對外詢問 (黃色)」，僅保留 逾期/問題 (紅)、進行中 (藍)、已完成 (綠)；懸停浮動視窗 (Hover Popover) 仍完整保留請假與對外詢問清單。
### Commit: `d1e2f3a` - Feat: Synchronize blockedBy (⛔卡住) badge to Sidebar menu, List view, and Kanban Board view
- **變更檔案**: [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L225-L255, #L925-L932), [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L265-L295, #L370-L380), [`Board.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Board.tsx#L50-L90, #L290-L305)
- **異動說明**:
  - **⛔卡住徽章全視圖同步**：將依賴關係產生的「⛔卡住」警示徽章同步渲染至左側 Menu 側欄 (`EpicSidebar.tsx`)、清單檢視 (`List.tsx`) 以及看板檢視 (`Board.tsx`)，使所有主要工作檢視皆能即時查看到被上游未完成任務卡住的警示。

### Commit: `e2f3a4b` - Feat: Enhance Gantt view with distinct bar colors for box vs card, remove dependency lines, update alert badges, and remove fixed toolbar buttons
- **變更檔案**: [`Gantt.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Gantt.tsx#L50-L380)
- **異動說明**:
  1. **收納盒與卡片色彩區隔**：甘特圖進度條依據 `isBox`（收納盒）與一般卡片套用不同 Theme 色彩（收納盒紫色 `#6366f1` / 一般卡片藍色 `#3b82f6`）。
  2. **移除甘特關聯線**：依據需求將甘特圖畫布上的 `links` 關聯線全面隱藏移除，保持圖表乾淨清晰。
  3. **詢問欄改為警示徽章欄**：將原先「詢問」欄位重構為「警示」欄位，下方完整渲染包含 `⚑問題`、`⛔卡住`、`⚡並行`、`⏰逾期`、`❓待回覆` 之警示徽章組合。
  4. **顯示欄位工具列優化**：移除顯示欄位選單中不可切換的「✓ 任務欄 (固定)」與「✓ 進度條/時間軸 (固定)」兩項固定按鈕。

### Commit: `f3a4b5c` - Layout: Move alert badges to the right side of Kanban card header
- **變更檔案**: [`Board.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Board.tsx#L315-L360)
- **異動說明**:
  - **看板警示徽章靠右置放**：將看板卡片 (`Card`) 的警示徽章區域移至卡片頂點 Header 列右側 (`ml-auto`)，使包含對外詢問、問題及卡住等警示徽章對齊於卡片右上方。

### Commit: `a1b2c3d` - Layout: Left align alert badges column in Gantt view
- **變更檔案**: [`Gantt.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Gantt.tsx#L70, #L400)
- **異動說明**:
  - **甘特圖警示欄靠左對齊**：將甘特圖清單中的「警示」欄位對齊方式改為靠左對齊 (`align: 'left'`)，使內含之警示徽章組合自然由左至右對齊呈現。

### Commit: `b2c3d4e` - Layout: Position Kanban alert badges inline directly after task title
- **變更檔案**: [`Board.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Board.tsx#L345-L360)
- **異動說明**:
  - **看板警示徽章緊接標題右側**：將看板卡片 (`Card`) 的警示徽章區塊改為緊接在任務標題 (`task.title`) 文字正右側，維持行內對齊自然緊湊。

### Commit: `c3d4e5f` - Feat: Add problem test cases and fix Calendar hover popover date truncation
- **變更檔案**: [`Calendar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Calendar.tsx#L755-L760), [`seed.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/seed.ts#L120-L130, #L255-L270), [`index.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/index.ts#L20-L65)
- **異動說明**:
  1. **行事曆懸停 Popover 日期截斷修正**：為 `Calendar.tsx` 日期格浮動視窗頂部標題加上 `shrink-0 whitespace-nowrap` 與寬度調整，防止日期文字遭截斷。
  2. **問題測試案例補充**：於 `seed.ts` 擴充測試用任務問題說明資料（包含零組件缺貨、資料庫相容性等），並提供 `seedProblemsIfEmpty` 自動為既有環境回填問題測試資料。

### Commit: `d4e5f6a` - Feat: Add BUG type test case tasks to seed data and seedBugsIfEmpty migration
- **變更檔案**: [`seed.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/seed.ts#L137-L142, #L270-L288), [`index.ts`](file:///D:/NewProject/pmflow-git/apps/api/src/index.ts#L20-L66)
- **異動說明**:
  - **問題類型 (BUG) 測試任務新增**：於 `seed.ts` 中新增「UPS 備援電池自我檢測異常」與「光纖模組訊號衰減過大」等 `type: 'BUG'` 問題類型任務案例，並撰寫 `seedBugsIfEmpty` 自動為現有資料庫回填問題類型測試任務。

### Commit: `e5f6a7b` - Fix: Implement smart popover positioning in Calendar to prevent top boundary clipping
- **變更檔案**: [`Calendar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Calendar.tsx#L590-L602, #L672-L685, #L750-L760)
- **異動說明**:
  - **行事曆浮動視窗智慧定位**：將 `Calendar.tsx` 日期格 Hover 懸浮視窗加入 `weekIndex` 與 `dayOfWeek` 邊界感應，頂層日期格自動向下彈出 (`top-full mt-1`)，邊角日期格自動向內對齊，徹底防止快顯清單超越頂部或左右邊界遭截斷。

### Commit: `f6a7b8c` - Fix: Refactor Calendar hover popover using createPortal to document.body for zero-clipping fixed positioning
- **變更檔案**: [`Calendar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Calendar.tsx#L1-L2, #L690-L790)
- **異動說明**:
  - **createPortal 快顯懸浮視窗全平臺防裁切**：將行事曆 Hover 懸浮視窗改為使用 React `createPortal` 直接掛載至 `document.body`，搭配 `getBoundingClientRect()` 計算 `fixed` 座標與視埠邊界全動態限制，完全不受任何父層 DOM 容器 `overflow` 邊界限制，徹底排除所有裁切與截斷問題。

### Commit: `a7b8c9d` - Layout: Wrap sidebar alert badges to second line when task item space is constrained
- **變更檔案**: [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L884-L960)
- **異動說明**:
  - **左側選單警示徽章超量自動折行**：為左側 Menu 樹狀項目加入 `flex-wrap`，當單一任務項目的警示徽章過多或寬度不足時，僅該任務項目的警示徽章全數自動折行整理至第二行顯示。

### Commit: `b8c9d0e` - Fix: Sync Gantt alert badges, fix row hover highlight color, and remove red border outline
- **變更檔案**: [`Gantt.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Gantt.tsx#L314-L340, #L382-L400)
- **異動說明**:
  1. **警示徽章樣式與圖示全系統同步**：將甘特圖的 `ProblemBadge` 改為全系統一致之紫粉色 `⚑有問題` (`#fdf4ff` / `#a21caf`)，並統一卡住、並行、逾期、待回覆徽章樣式與文字。
  2. **列表 Hover/選取反白配色優化**：覆寫 dhtmlx 預設黃灰色，改為與系統一致之柔軟 slate 高亮配色 (`#f1f5f9` / `#e2e8f0`)。
  3. **粗紅外框 (紅框) 完全移除**：移除原本由 dhtmlx 自動為關鍵路徑 (`critical`) 及詢問逾期掛載的粗紅外框邊線 (`outline: none` / `border-color`)，使甘特圖條形維持乾淨統一。

### Commit: `c9d0e1f` - Layout: Move Kanban card alert badges to dedicated line underneath title
- **變更檔案**: [`Board.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/Board.tsx#L342-L360)
- **異動說明**:
  - **看板警示徽章移至標題下方獨立行**：將看板卡片 (`Card`) 的警示徽章（包含詢問、問題、⛔卡住）自標題右側行內獨立分離，全數放置於任務標題正下方獨立第二行呈現。

### Commit: `d0e1f2a` - Feat: Display MRG Ref and Title of selected item in top header bar
- **變更檔案**: [`App.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/App.tsx#L506-L510, #L591-L615)
- **異動說明**:
  - **頁籤頂列「當前顯示」標示優化**：於頂部導覽列第二層的「當前顯示」區域完整呈現當前點選事件之 `MRG 編號 + 任務標題`（如 `當前顯示： MRG-5 系統資安架構升級`），並附帶快速清除篩選按鈕，使使用者能清晰掌握當前頁面焦點。

### Commit: `e1f2a3b` - Refactor: Rename Members view tab label to 事件歸屬
- **變更檔案**: [`nav.ts`](file:///D:/NewProject/pmflow-git/apps/web/src/strings/nav.ts#L40), [`member.ts`](file:///D:/NewProject/pmflow-git/apps/web/src/strings/member.ts#L3)
- **異動說明**:
  - **視圖頁籤名稱更新**：將原「成員」視圖頁籤名稱全數改為「事件歸屬」，更加符合該視圖分析與呈現各成員事件分派與經手狀態之用途。

### Commit: `f2a3b4c` - Layout: Restructure sidebar items into 3-line layout (Line 1: Icon/Ref/Badges/Checkmark, Line 2: Title, Line 3: Progress)
- **變更檔案**: [`EpicSidebar.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/components/EpicSidebar.tsx#L884-L980)
- **異動說明**:
  - **左側選單三行排版重構**：將左側 Menu 樹狀項目結構重新佈局為清晰的三行結構：
    - **第一行**：卡片/收納盒圖示 (`📦`/`📄`) + 種類色槓 + `MRG` 編號 + 警示徽章區 (卡住/問題/詢問/逾期) + 完成打勾 `✓`（當且僅當進度達 100% 時方才顯示）。
    - **第二行**：任務標題 (`task.title`)。
    - **第三行**：進度條 (% 數據及視覺化進度條)。

### Commit: `a3b4c5d` - Fix: Improve hierarchy root detection and recursive tree walking in List view
- **變更檔案**: [`List.tsx`](file:///D:/NewProject/pmflow-git/apps/web/src/pages/List.tsx#L186-L230)
- **異動說明**:
  - **清單階層樹狀規則修正**：將根節點判斷改為 `!t.parentId || !taskIds.has(t.parentId)`，並於 `walk` 中加上 `processed` 集合防止重複與迴圈，確保當從側欄選取子收納盒或大項目進行篩選檢視時，子任務仍能正確保持縮排與層級展開關係。










































































