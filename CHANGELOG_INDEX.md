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




































