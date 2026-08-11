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
