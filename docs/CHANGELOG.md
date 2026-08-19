# 異動紀錄

> **接手工作請先讀下面的索引**，找到相關條目再往下翻細節。
> 每批改動都要在索引加一列、在「詳細條目」最上面加一段。日期為實際動工日。
> 不知道某個功能住在哪個檔 → 看 [`CODEMAP.md`](./CODEMAP.md)。

## 索引

| 索引編號 | 日期 | 主題 | 主要檔案 | 狀態 |
|---|---|---|---|---|
| `CR-170` | 2026-08-19 | [資料清理：全面清理資料庫與示範專案中殘留之舊版 EPIC 與里程碑類型，統一收斂為任務單](#cr-170) | `seed.ts`, `0026_cleanup_legacy_epic_milestone_types.sql` | 已驗證 |
| `CR-169` | 2026-08-19 | [關聯圖修正：修復連續拉線/多卡連線時舊連線被覆蓋或快取覆寫消失 Bug](#cr-169) | `TaskGraph.tsx` | 已驗證 |
| `CR-168` | 2026-08-19 | [權限校正：嚴格劃分環境變數超級管理者、專案擁有者（建立者）與專案管理者之權限邊界](#cr-168) | `lib/auth.ts`, `routes/auth.ts`, `routes/projects.ts`, `routes/members.ts`, `App.tsx` | 已驗證 |
| `CR-167` | 2026-08-19 | [介面排版：所有視圖（側欄、成員、週檢視、詳情子任務）之警示徽章統一折行置於下一行，避免橫向變長與溢出](#cr-167) | `EpicSidebar.tsx`, `Members.tsx`, `Week.tsx`, `TaskDrawer.tsx` | 已驗證 |
| `CR-166` | 2026-08-19 | [帳號權限：修復專案建立者與管理者於系統管理頁誤顯為成員 Bug，全面升級回傳正確擁有者/管理者身分](#cr-166) | `lib/auth.ts`, `routes/auth.ts`, `routes/account.ts`, `AdminPanel.tsx`, `App.tsx` | 已驗證 |
| `CR-165` | 2026-08-19 | [AI 技能與自動化：實作 GET /api/v1/skills 端點與右上角「AI 串接指令」一鍵複製 Prompt 彈窗](#cr-165) | `skills.ts`, `index.ts`, `AiSkillModal.tsx`, `UserMenu.tsx`, `App.tsx`, `AccountPanel.tsx` | 已驗證 |
| `CR-164` | 2026-08-19 | [權限與專案管理：支援 PMFLOW_ADMIN_EMAIL 指定全域超級管理者，開放專案擁有者轉移與帳號註銷管理最高權限](#cr-164) | `env.ts`, `auth.ts`, `account.ts`, `projects.ts`, `members.ts`, `MembersPanel.tsx`, `AdminPanel.tsx`, `api.ts`, `.env.example`, `docker-compose*.yml` | 已驗證 |
| `CR-163` | 2026-08-19 | [任務關聯圖：移除同時關聯線時，卡片與收納盒即時解除「⚡並行」警示徽章](#cr-163) | `TaskGraph.tsx` | 已驗證 |
| `CR-162` | 2026-08-19 | [全域警示徽章同步刷新：收納盒連線受阻即時警示、卡住/問題/逾期/逾回同時顯示、問題單免設起訖日](#cr-162) | `TaskGraph.tsx`, `EpicSidebar.tsx`, `TaskDrawer.tsx`, `Board.tsx`, `List.tsx`, `ui.tsx`, `strings/inquiry.ts`, `strings/flow.ts` | 已驗證 |
| `CR-161` | 2026-08-18 | [任務關聯圖：點擊「新增文字」直接在畫布生成文字註記，不再主動彈出色票/編輯視窗（對齊流程圖行為）](#cr-161) | `TaskGraph.tsx`, `CODEMAP.md` | 已驗證 |
| `CR-160` | 2026-08-18 | [任務關聯圖：嚴格限制左右接點只能連左右（排程相依）、上下接點只能連上下（階層關係），透過 isValidConnection 即時約束](#cr-160) | `TaskGraph.tsx`, `CODEMAP.md` | 已驗證 |
| `CR-159` | 2026-08-18 | [系統流程圖：所有框（步驟卡片、模組容器盒、區域標示框、文字註記）全數配置四向接點，支援四向任意自由拉線與接線](#cr-159) | `SystemFlow.tsx`, `CODEMAP.md` | 已驗證 |
| `CR-158` | 2026-08-18 | [系統流程圖：移除 onConnect 強制改寫接點邏輯、統一容器框 Handles ID，四向接點皆可自由雙向拉線與直角避讓](#cr-158) | `SystemFlow.tsx`, `CODEMAP.md` | 已驗證 |
| `CR-157` | 2026-08-18 | [任務關聯圖：卡片初始給定尺寸與 measured，修復初次進入無法拉線需先拖移卡片問題](#cr-157) | `TaskGraph.tsx`, `CODEMAP.md` | 已驗證 |
| `CR-156` | 2026-08-18 | [兩張圖：接點標準化為 Left/Top 連入 (target) 與 Right/Bottom 出發 (source)，四向雙向拉線與連入](#cr-156) | `TaskGraph.tsx`, `SystemFlow.tsx` | 已驗證 |
| `CR-155` | 2026-08-18 | [任務關聯圖：收納盒與卡片「問 X」問題單警示依畫布節點樹即時動態遞迴計算，子卡片移出即刻歸零；接點層級升至 50 避免連線後遮蔽](#cr-155) | `TaskGraph.tsx`, `SystemFlow.tsx`, `index.css` | 已驗證 |
| `CR-154` | 2026-08-18 | [系統流程圖：文字註記的編輯與刪除鈕移到文字上方，不要蓋住字](#cr-154) | `SystemFlow.tsx` | 已驗證 |
| `CR-153` | 2026-08-18 | [任務關聯圖：文字註記「按住就消失」＝節點缺 `measured` 被判定成還沒量過；編輯與刪除鈕移到文字上方](#cr-153) | `SimpleGraph.tsx`, `CODEMAP.md` | 已驗證 |
| `CR-152` | 2026-08-18 | [兩張圖：線上文字放大、短字不再被把手擋住、區域標示框整塊可拖、拖曳時節點重繪由 N 降為 1](#cr-152) | `SimpleGraph.tsx`, `SystemFlow.tsx` | 已驗證 |
| `CR-151` | 2026-08-18 | [任務關聯圖：線上文字「消失」其實是被卡片蓋住（標籤容器沒有 z-index）；折點與文字改用關聯線 id 當鍵](#cr-151) | `SimpleGraph.tsx` | 已驗證 |
| `CR-150` | 2026-08-17 | [任務關聯圖：關聯線可以掛文字，標籤跟著折點走](#cr-150) | `SimpleGraph.tsx`, `strings/flow.ts` | 已驗證 |
| `CR-149` | 2026-08-17 | [移除掛載目錄的 SQL 種子機制；JWT 簽章金鑰改成第一次啟動自動產生並存進資料庫](#cr-149) | `0027_app_secret.sql`, `lib/secret.ts`, `env.ts`, `index.ts`, `seed.ts`, `docker-compose*.yml`, `.env.example` | 已驗證 |
| `CR-148` | 2026-08-17 | [兩張圖的 LAG 與閃爍：拖曳中每個事件寫一次儲存、節點物件參照不穩定；按鈕統一移到頂部](#cr-148) | `SimpleGraph.tsx`, `SystemFlow.tsx`, `CODEMAP.md` | 已驗證 |
| `CR-147` | 2026-08-17 | [技能文件：用 API 權杖寫資料進 PMFlow，一份內容三個工具入口（Claude／Gemini／讀 AGENTS.md 的）](#cr-147) | `docs/API-WRITE.md`, `.claude/skills/`, `.gemini/commands/`, `AGENTS.md` | 已驗證 |
| `CR-146` | 2026-08-17 | [畫面文字外移：新增 `strings/flow.ts`，兩張圖的中文全部從 JSX 搬進 strings](#cr-146) | `strings/flow.ts`, `strings/index.ts`, `SimpleGraph.tsx`, `SystemFlow.tsx` | 已驗證 |
| `CR-145` | 2026-08-17 | [權限：移除 `COMMENTER`（可留言）角色，含 migration 降級既有成員與 CHECK 約束](#cr-145) | `0026_drop_commenter_role.sql`, `auth.ts`, `members.ts`, `api.ts`, `strings/*`, `NotificationBell.tsx` | 已驗證 |
| `CR-144` | 2026-08-17 | [任務關聯圖：新增文字註記與區域標示框（不是任務、不進節點狀態、不建立隸屬關係）](#cr-144) | `SimpleGraph.tsx` | 已驗證 |
| `CR-143` | 2026-08-17 | [移除任務留言：功能被「成立問題單」取代，前端顯示端與字串一併清掉](#cr-143) | `TaskDrawer.tsx`, `strings/task.ts`, `strings/settings.ts` | 已驗證 |
| `CR-142` | 2026-08-17 | [死碼清理：刪除點不到的舊關聯圖（3093 行）與解鎖後變成空殼的階層守門員](#cr-142) | `pages/Graph.tsx`(刪), `lib/hierarchy.ts`(刪), `App.tsx`, `tasks.ts`, `parameters.ts`, `CODEMAP.md` | 已驗證 |
| `CR-141` | 2026-08-17 | [任務關聯圖：拖曳關聯線轉角會誤觸發刪除確認（React 合成事件沿元件樹冒泡）](#cr-141) | `SimpleGraph.tsx` | 已驗證 |
| `CR-140` | 2026-08-17 | [系統流程圖：模組容器顯示詳細說明、新增文字與區域標示框、線上文字、箭頭指向終點、直角可拖折點](#cr-140) | `SystemFlow.tsx` | 已驗證 |
| `CR-139` | 2026-08-17 | [任務關聯圖：關聯線轉角可拖曳（自訂直角 edge），並修掉拉線當下的貝茲預覽線](#cr-139) | `SimpleGraph.tsx` | 已驗證 |
| `CR-138` | 2026-08-17 | [持久化：圖的座標／尺寸／收納模式／線接點與整份文件存進資料庫（新表 + canvas API）](#cr-138) | `0025_canvas_layout.sql`, `canvas.ts`, `links.ts`, `index.ts`, `e2e.sh` | 已驗證 |
| `CR-137` | 2026-08-17 | [測試的東西只准出現在測試環境：示範資料竄改正式任務、登入頁預填帳密、`/data/seed` 無條件執行 SQL](#cr-137) | `env.ts`, `seed.ts`, `index.ts`, `Login.tsx`, `docker-compose*.yml`, `AGENTS.md` | 已驗證 |
| `CR-136` | 2026-08-17 | [任務關聯圖：收納盒依剩餘卡片縮小，空了回到一張卡片大小](#cr-136) | `SimpleGraph.tsx` | 已驗證 |
| `CR-135` | 2026-08-17 | [語法範例：修掉切 MD 時標頭換行造成的跑版，並改用 markdown-it + highlight.js](#cr-135) | `Playground.tsx`, `package.json` | 已驗證 |
| `CR-134` | 2026-08-17 | [權限：`impersonate` 可被任何人接管全站、`/admin/users` 漏驗管理者、父任務可跨專案](#cr-134) | `auth.ts`, `account.ts`, `tasks.ts`, `env.ts` | 已驗證 |
| `CR-133` | 2026-08-17 | [側欄新增事件：種類初始值寫死 `EPIC` 導致顏色與名稱不一致，且會建出專案沒有的種類](#cr-133) | `EpicSidebar.tsx` | 已驗證 |
| `CR-132` | 2026-08-17 | [關聯圖（`Graph.tsx`）：收納盒依剩餘卡片縮小 —— **做在使用者點不到的頁面上，見 CR-136**](#cr-132) | `Graph.tsx` | 無效 |
| `CR-131` | 2026-08-17 | [任務關聯圖：拉線拉不出來（穿透否決）、接點太小、線改硬 90 度、移除前端自創的錯誤單連線禁令](#cr-131) | `SimpleGraph.tsx` | 已驗證 |
| `CR-130` | 2026-08-17 | [權限：非關係人不得異動別人建立的資料（系統管理者／專案管理者／建立者／代理人才可改），補上關聯線與對外詢問單的守門，前端改看後端回的 canEdit](#cr-130) | `lib/auth.ts`, `routes/tasks.ts`, `routes/links.ts`, `routes/inquiries.ts`, `lib/api.ts`, `TaskDrawer.tsx`, `AGENTS.md` | 已驗證 |
| `CR-129` | 2026-08-17 | [文件同步：解除 ARCHITECTURE.md / SPEC.md「過時設計稿」警語，並補回 NEXT-SESSION 落後的三批進度](#cr-129) | `CODEMAP.md`, `AGENTS.md`, `NEXT-SESSION.md` | 已驗證 |
| `CR-128` | 2026-08-11 | [規格補充：於 SPEC.md 新增第 13 章行動端自適應 (RWD) 與 Mobile/PWA 平台支援規格](#cr-128) | `SPEC.md` | 已驗證 |
| `CR-127` | 2026-08-11 | [任務種類上下關係：全數解鎖放行，移除階層嵌套限制並同步更新 AGENTS.md 條文與 API 測試 (e2e.sh)](#cr-127) | `AGENTS.md`, `hierarchy.ts`, `e2e.sh` | 已驗證 |
| `CR-126` | 2026-08-11 | [任務種類上下關係：恢復 checkPlacement / canBeUnder 守門員邏輯（BUG 只能掛 TASK 下，EPIC 只能放頂層/EPIC 下）](#cr-126) | `hierarchy.ts` | 已驗證 |
| `CR-125` | 2026-08-11 | [清單視角：修復 List.tsx 缺失 DEFAULT_TYPE_COLORS 引用導致型別檢查失敗 Bug](#cr-125) | `List.tsx` | 已驗證 |
| `CR-124` | 2026-08-09 | [關聯圖：依照使用者五大規格書全面重構——右下角固定 ↘ 縮放手把、標頭 ✏️ 鉛筆 Hover 高亮、空位自動優先補位與手動位置右側接續網格，通過類型建置測試](#cr-124) |
| `CR-123` | 2026-08-09 | [關聯圖：徹底移除卡片移入收納盒時觸發之動態拉大與尺寸重新計算邏輯 (固定 384x288)](#cr-123) | `Graph.tsx` | 已驗證 |
| `CR-122` | 2026-08-09 | [關聯圖：移除所有自動碰撞擠開與動態推移觸發，僅保留與 Menu 階層之 parentId 關聯](#cr-122) | `Graph.tsx` | 已驗證 |
| `CR-121` | 2026-08-09 | [關聯圖：修復卡片移出收納盒時收納盒縮放坍塌 Bug (保留 384x288 容器基礎尺寸)](#cr-121) | `Graph.tsx` | 已驗證 |
| `CR-120` | 2026-08-09 | [關聯圖：按鈕初始標籤改為「📦 卡片」，按下去轉換為「📦 收納盒」](#cr-120) | `Graph.tsx` | 已驗證 |
| `CR-119` | 2026-08-09 | [關聯圖：術語面全站統一定義——事件卡片與轉換收納盒](#cr-119) | `Graph.tsx` | 已驗證 |
| `CR-118` | 2026-08-09 | [關聯圖：重構邊界判定與移除二次繪製尺寸動態擴展，修復卡片向右/向下無法移出收納框 Bug](#cr-118) | `Graph.tsx` | 已驗證 |
| `CR-117` | 2026-08-09 | [甘特圖：未定起迄日任務日期補全呈顯與覆蓋 dhtmlx 專案預設綠色條為藍紫色](#cr-117) | `Gantt.tsx`, `index.css` | 已驗證 |
| `CR-116` | 2026-08-09 | [導覽：統一 DashboardView、InquiryBoard 與 MembersView 點擊選取事件行為](#cr-116) | `App.tsx` | 已驗證 |
| `CR-115` | 2026-08-09 | [導覽：全頁籤同步連動 Menu 選取（看板與行事曆自動定位並加上亮藍外框高亮）](#cr-115) | `Board.tsx`, `Calendar.tsx`, `Week.tsx`, `App.tsx` | 已驗證 |
| `CR-114` | 2026-08-09 | [關聯圖：徹底排除 layout 內之 draggedOffsets 重新算大小，修復事件卡片向右/向下無法移出框外 Bug](#cr-114) | `Graph.tsx` | 已驗證 |
| `CR-113` | 2026-08-09 | [導覽：修正側欄 active 選取判定與高亮底色，確保切換 View 頁籤時 Menu 事件底色持續保留](#cr-113) | `EpicSidebar.tsx` | 已驗證 |
| `CR-112` | 2026-08-09 | [UI 對比：修復甘特圖與清單列選取時背景反白導致文字消失 Bug](#cr-112) | `index.css`, `List.tsx` | 已驗證 |
| `CR-111` | 2026-08-09 | [甘特圖：引入 rollup 彙總起迄日與 project 專案型別，將主事件/大項目完好呈現於甘特圖](#cr-111) | `Gantt.tsx` | 已驗證 |
| `CR-110` | 2026-08-09 | [導覽：區分點擊選取（保持視圖並連動側欄）與雙擊/鉛筆圖示（開啟編輯抽屜），解決全螢幕遮蓋問題](#cr-110) | `App.tsx`, `List.tsx` | 已驗證 |
| `CR-109` | 2026-08-09 | [導覽：實作右側各視圖點擊事件反向連動左側 Menu（自動遞迴展開祖先層級並高亮），傳送 View 頁籤狀態](#cr-109) | `EpicSidebar.tsx`, `App.tsx` | 已驗證 |
| `CR-108` | 2026-08-09 | [導覽：實作左側 Menu 點擊事件連動目前右側頁籤（關聯圖聚焦單一事件、甘特圖/清單滾動高亮事件），獨立 ✏️ 鉛筆觸發詳細編輯](#cr-108) | `EpicSidebar.tsx`, `Graph.tsx`, `Gantt.tsx`, `List.tsx`, `App.tsx` | 已驗證 |
| `CR-107` | 2026-08-09 | [關聯圖：修正 layout 內 place 函式收納框計算邏輯，徹底解決卡片往右/向下拖曳時推大收納框 Bug](#cr-107) | `Graph.tsx` | 已驗證 |
| `CR-106` | 2026-08-09 | [關聯圖：重構收納框脫離判定，解決事件卡片無法由右側與下側移出收納框 Bug](#cr-106) | `Graph.tsx` | 已驗證 |
| `CR-105` | 2026-08-09 | [全系統：統一元件與 UI 對話框用語稱呼，將「事件框」全面更名為「事件卡片」](#cr-105) | `Graph.tsx` | 已驗證 |
| `CR-104` | 2026-08-09 | [關聯圖：修復框內事件卡片拖曳時誤推大收納框 Bug，實現順暢拖移出框外脫離隸屬關係](#cr-104) | `Graph.tsx` | 已驗證 |
| `CR-103` | 2026-08-09 | [行事曆：重構 [月視角 \| 週視角] 為單一層工具列最左端切換鈕，解決視角切換時介面跳動問題](#cr-103) | `Calendar.tsx`, `Week.tsx` | 已驗證 |
| `CR-102` | 2026-08-09 | [行事曆：整合「週檢視」至頂部 [月視角 \| 週視角] 切換按鈕，消除重複之全域頁籤](#cr-102) | `Calendar.tsx`, `App.tsx` | 已驗證 |
| `CR-101` | 2026-08-09 | [成員視圖：將未分派事件整合至「成員」左側名單置頂，避免頂部頁籤重複](#cr-101) | `Members.tsx` | 已驗證 |
| `CR-100` | 2026-08-09 | [甘特圖：移除頂部「關鍵路徑共 X 個節點」統計提示列，保持介面簡潔](#cr-100) | `Gantt.tsx` | 已驗證 |
| `CR-099` | 2026-08-09 | [甘特圖：關閉拖曳改期與拉線依賴等編輯互動，設定為純唯讀展示視圖](#cr-099) | `Gantt.tsx` | 已驗證 |
| `CR-098` | 2026-08-09 | [甘特圖：區分左右區塊滾輪行為（左側清單控制上下捲動，右側時間軸進度條控制左右捲動）](#cr-098) | `Gantt.tsx` | 已驗證 |
| `CR-097` | 2026-08-09 | [全系統：重構所有原生 alert/confirm 為自訂 UI Modal 提示窗，達成設計風格 100% 統一](#cr-097) | `Graph.tsx`, `Gantt.tsx`, `Calendar.tsx`, `ProjectSettings.tsx`, `MembersPanel.tsx`, `AdminPanel.tsx`, `AccountPanel.tsx` | 已驗證 |
| `CR-096` | 2026-08-09 | [關聯圖：關閉收納框內部事件卡片碰撞互斥避讓機制 (resolveCollisionPush)，實現框內自由擺放](#cr-096) | `Graph.tsx` | 已驗證 |
| `CR-095` | 2026-08-09 | [關聯圖：重構 BoxNodeView 與 TaskNodeView 為 justify-start，徹底解決切換收納模式時內部資訊上下位移 Bug](#cr-095) | `Graph.tsx` | 已驗證 |
| `CR-094` | 2026-08-09 | [關聯圖：修復 getTypeColor 未優先使用自訂種類顏色 Bug，達成全系統種類色彩與名稱 100% 同步](#cr-094) | `Graph.tsx` | 已驗證 |
| `CR-093` | 2026-08-09 | [關聯圖：對齊收納框內部事件卡片相對縱向偏移量 (y >= 60)，修復佈局觸發時內部元素跳位 Bug](#cr-093) | `Graph.tsx` | 已驗證 |
| `CR-092` | 2026-08-09 | [關聯圖：實作卡片編號 (MRG) 正後方種類徽章渲染，與修復框內拖移非同步彈射消失 Bug (parentOverrides)](#cr-092) | `Graph.tsx` | 已驗證 |
| `CR-091` | 2026-08-09 | [關聯圖：實作關閉收納模式之內部事件框檢查與彈出對話框提示移出機制](#cr-091) | `Graph.tsx` | 已驗證 |
| `CR-090` | 2026-08-09 | [關聯圖：修復內含子任務卡片 isEpic 被強制作廢 Bug，與補齊圖上按 Delete 鍵刪除連線之 API 連動 (onEdgesDelete)](#cr-090) | `Graph.tsx` | 已驗證 |
| `CR-089` | 2026-08-09 | [關聯圖：徹底清除所有節點中殘留之「大項目」徽章標籤判定，維持介面精簡](#cr-089) | `Graph.tsx` | 已驗證 |
| `CR-088` | 2026-08-09 | [關聯圖：修正事件框邊框顏色覆蓋問題並移除頂部大項目徽章標籤](#cr-088) | `Graph.tsx` | 已驗證 |
| `CR-087` | 2026-08-09 | [關聯圖：事件框頂線與外框配色與事件種類 (EPIC/TASK/BUG/MILESTONE) 顏色全面對齊](#cr-087) | `Graph.tsx`, `App.tsx` | 已驗證 |
| `CR-086` | 2026-08-09 | [關聯圖與側欄：修復收納框線條穿透離框、側欄種類顏色即時連動與開放 EDITOR 保存權限](#cr-086) | `Graph.tsx`, `EpicSidebar.tsx`, `TaskDrawer.tsx` | 已驗證 |
| `CR-085` | 2026-08-09 | [關聯圖：解鎖收納框內手動拖曳卡片位置限制，手動拖移保留精確放置座標 (僅預設移入自動依序填補 Slot)](#cr-085) | `Graph.tsx` | 已驗證 |
| `CR-084` | 2026-08-09 | [關聯圖：修復收納框內部事件卡片無法從上、下、左、右 4 邊實體邊界離框之 Bug](#cr-084) | `Graph.tsx` | 已驗證 |
| `CR-083` | 2026-08-09 | [API 與 E2E 測試：校正端對端 API 測試檔 (e2e.sh) 與資料庫基礎連線，達成 107/107 項目 100% 全數通過](#cr-083) | `apps/api/test/e2e.sh` | 已驗證 |
| `CR-082` | 2026-08-09 | [工作規矩：修改 API 後端相關程式碼與介面時必須同步執行端對端 API 測試 (e2e.sh)](#cr-082) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-081` | 2026-08-09 | [關聯圖：修復事件卡片向右拖移無法離開收納框 Bug (拖曳中卡片排除動態展寬 + 當前父框釋放邊界邊緣即刻解鎖)](#cr-081) | `Graph.tsx` | 已驗證 |
| `CR-080` | 2026-08-09 | [側欄選單：收納開啟之事件框 (Container Boxes) 於 Menu 排序統一置頂並加上下方分隔線](#cr-080) | `EpicSidebar.tsx` | 已驗證 |
| `CR-079` | 2026-08-09 | [關聯圖：實作收納框智慧缺位優先填補與手動佔位避讓引擎 (Smart Slot Occupancy Engine)](#cr-079) | `Graph.tsx` | 已驗證 |
| `CR-078` | 2026-08-09 | [關聯圖：修復收納框內部事件卡片移入移出留空 Bug (收納框內部統一強制使用 place 排版補位)](#cr-078) | `Graph.tsx` | 已驗證 |
| `CR-077` | 2026-08-09 | [關聯圖：修復從右側移入時被排斥框體誤判瞬間彈跳至右邊之 Bug (改為相對幾何中心向量計算避讓方向)](#cr-077) | `Graph.tsx` | 已驗證 |
| `CR-076` | 2026-08-09 | [關聯圖：設定移動排斥避讓機制排除收納框 (!containerBoxIds.has & type !== box)](#cr-076) | `Graph.tsx` | 已驗證 |
| `CR-075` | 2026-08-09 | [關聯圖：將 selected: !!selectedIds[n.id] 注入 node.data 並開放無鍵盤修飾單擊連續切換多選](#cr-075) | `Graph.tsx` | 已驗證 |
| `CR-074` | 2026-08-09 | [關聯圖：修復單擊連續點選多卡片多選狀態遭預設重置之 Bug (解鎖連續單擊多選)](#cr-074) | `Graph.tsx` | 已驗證 |
| `CR-073` | 2026-08-09 | [關聯圖：移除原本單擊卡片時於右上角彈出的資訊提示/聚焦窗 (Panel)](#cr-073) | `Graph.tsx` | 已驗證 |
| `CR-072` | 2026-08-09 | [關聯圖：設定單擊卡片切換多選 (Multi-select) 與多卡片齊移 (Group Dragging)，雙擊卡片開啟詳情頁](#cr-072) | `Graph.tsx` | 已驗證 |
| `CR-071` | 2026-08-09 | [關聯圖：設定事件卡片移出收納框時，優先放置於游標放掉的精確位置 (若該位置被佔用則順延置於旁邊)](#cr-071) | `Graph.tsx` | 已驗證 |
| `CR-070` | 2026-08-09 | [關聯圖：實作框與框碰撞自動動態擠開機制 (依據拖曳方向向量向反方向自動推移避讓)](#cr-070) | `Graph.tsx` | 已驗證 |
| `CR-069` | 2026-08-09 | [關聯圖：修復移入新卡片時現有卡片大跳動問題 (改為穩定索引排序)，並加大第 9 個卡片之 96px 吸附區域](#cr-069) | `Graph.tsx` | 已驗證 |
| `CR-068` | 2026-08-09 | [關聯圖：修復收納框多欄模式下放置第 7 個（第 2 欄）事件卡片遭誤判離框解除隸屬之 Bug](#cr-068) | `Graph.tsx` | 已驗證 |
| `CR-067` | 2026-08-09 | [關聯圖：調整收納框頂部標題與進度條向下安全距離 (BOX_HEADER = 96px)，避免子事件卡片太靠近進度條](#cr-067) | `Graph.tsx` | 已驗證 |
| `CR-066` | 2026-08-09 | [大項目與一般任務統一為事件層級，開放大項目與任務之間自由建立排程與語意關聯依賴](#cr-066) | `Graph.tsx`, `TaskDrawer.tsx`, `links.ts` | 已驗證 |
| `CR-065` | 2026-08-09 | [關聯圖：收納框內所有事件框與框、框與邊界間距統一調校為 24px (極致對齊)](#cr-065) | `Graph.tsx` | 已驗證 |
| `CR-064` | 2026-08-09 | [關聯圖：設定收納框內部卡片單欄最多放 5 張，滿 5 張自動向右開啟第二欄/排繼續向下延伸](#cr-064) | `Graph.tsx` | 已驗證 |
| `CR-063` | 2026-08-09 | [關聯圖：設定事件卡片移入/加入收納框時，預設一律向下延伸垂直堆疊排列 (columns[0])](#cr-063) | `Graph.tsx` | 已驗證 |
| `CR-062` | 2026-08-09 | [關聯圖：卡片放入收納框時若空間不足自動擴大框體；拖曳移出時則保持框體尺寸固定不跟隨變更](#cr-062) | `Graph.tsx` | 已驗證 |
| `CR-061` | 2026-08-09 | [關聯圖：移除拖曳卡片時收納框動態追蹤變大邏輯，允許事件卡片順暢拖移離框並自動排除 (parentId 清空)](#cr-061) | `Graph.tsx` | 已驗證 |
| `CR-060` | 2026-08-09 | [關聯圖：修復事件卡片於收納框內向右/向下拖曳時，收納框無即時動態擴大連動之判定 Bug (isBox)](#cr-060) | `Graph.tsx` | 已驗證 |
| `CR-059` | 2026-08-09 | [關聯圖：卡片外框線條顏色與事件類型/主題顏色 (accentColor) 保持完全一致](#cr-059) | `Graph.tsx` | 已驗證 |
| `CR-058` | 2026-08-09 | [關聯圖：重構卡片與容器框網格吸附標準 (24px 寬 / 48px 高)，所有邊框與 Handle 接點 100% 精確壓在背景 Dot 網點上](#cr-058) | `Graph.tsx` | 已驗證 |
| `CR-057` | 2026-08-09 | [關聯圖：進度條 100% 完成時，進度條線條顏色統一切換為翡翠綠 (#10b981 / bg-emerald-500)](#cr-057) | `Graph.tsx` | 已驗證 |
| `CR-056` | 2026-08-09 | [關聯圖：卡片與容器框手動與自動縮放尺寸對齊背景 24px 網點格子 (Math.round(size / 24) * 24)](#cr-056) | `Graph.tsx` | 已驗證 |
| `CR-055` | 2026-08-09 | [關聯圖：對齊收納框內部四邊距 (BOX_PAD = 24px)，確保內部事件卡片上(對齊 Header 下緣)、下、左、右距邊邊緣完全相等](#cr-055) | `Graph.tsx` | 已驗證 |
| `CR-054` | 2026-08-09 | [關聯圖：加入偶數像素高度強制對齊規則 (even)，全圖卡片與容器框高度均收斂為偶數，消除 0.5px 小數點對齊錯位](#cr-054) | `Graph.tsx` | 已驗證 |
| `CR-053` | 2026-08-09 | [關聯圖：統一卡片頂部顏色條與進度條元件，確保收納開關切換時配色與進度條 100% 一致](#cr-053) | `Graph.tsx` | 已驗證 |
| `CR-052` | 2026-08-09 | [關聯圖：修復收納框內部卡片拖曳釋放時誤判定排除 (parentId 清空) 之空間座標計算 Bug](#cr-052) | `Graph.tsx` | 已驗證 |
| `CR-051` | 2026-08-09 | [關聯圖：非收納狀態卡片尺寸保持統一一致，僅收納模式可調整大小，標題固定於標號正下方第二行](#cr-051) | `Graph.tsx` | 已驗證 |
| `CR-050` | 2026-08-09 | [關聯圖：將「收納」按鈕搬至卡片編號 (MRG) 左側，非收納狀態自動隱藏「縮放」按鈕](#cr-050) | `Graph.tsx` | 已驗證 |
| `CR-049` | 2026-08-09 | [關聯圖：卡片按鈕文案正名，尺寸改為「縮放」，獨立改為「收納(關)」與點擊後「收納(開)」](#cr-049) | `Graph.tsx` | 已驗證 |
| `CR-048` | 2026-08-08 | [工作規矩：再次確認多子代理並行規範並寫入 AGENTS.md](#cr-048) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-047` | 2026-08-08 | [對外詢問：期望回覆日改為單行不換行橫向佈局，連動 +幾天 快速選擇與動態日期計算](#cr-047) | `InquiryTable.tsx`、`strings/inquiry.ts` | 已驗證 |
| `CR-046` | 2026-08-07 | [關聯圖：說明列補充四種排程依賴（FS/SS/FF/SF）懸停詳細語意說明](#cr-046) | `Graph.tsx`、`strings/chart.ts` | 已驗證 |
| `CR-045` | 2026-08-07 | [儀表板：負載熱圖左側成員/人名欄位改為橫向滾動固定 (sticky)](#cr-045) | `WorkloadHeatmap.tsx` | 已驗證 |
| `CR-044` | 2026-08-07 | [系統參數：刪除任務狀態整批搬移任務時，補上含有未回覆對外詢問之擋關檢查](#cr-044) | `routes/parameters.ts` | 已驗證 |
| `CR-043` | 2026-08-07 | [看板視角：拖曳失敗（如帶著未回詢問結案）時於看板頂部加入顯式錯誤提示 banner](#cr-043) | `Board.tsx`、`strings/task.ts` | 已驗證 |
| `CR-042` | 2026-08-07 | [環境清理：刪除未追蹤的本地臨時筆記檔案「切換後驗收」確保工作區乾淨](#cr-042) | `切換後驗收` | 已驗證 |
| `CR-041` | 2026-08-07 | [版本整合：打包推送 OAuth 登入、請假代理人、成員頁面板等功能至 main](#cr-041) | `apps/api/*`、`apps/web/*` | 已驗證 |
| `CR-040` | 2026-08-07 | [發版部署：產出 v0.2.2 版號之自動 Git Tag 部署批次檔](#cr-040) | `release-0.2.2.bat` | 已驗證 |
| `CR-039` | 2026-08-07 | [介面優化：在任務詳情進度輸入框右側加上 % 單位符號](#cr-039) | `TaskDrawer.tsx` | 已驗證 |
| `CR-038` | 2026-08-07 | [工作規矩：任務先查 CODEMAP 分析改動檔案清單，經使用者同意後才開始動手修改](#cr-038) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-037` | 2026-08-07 | [長期規則：正式規範已完成任務鎖定僅專案建立者(管理者)可修改，並寫入 AGENTS.md](#cr-037) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-036` | 2026-08-07 | [長期規則：將清單視角 (List.tsx) 完整功能規範記入 AGENTS.md 與 CODEMAP.md](#cr-036) | `D:\NewProject\AGENTS.md`、`CODEMAP.md` | 已驗證 |
| `CR-035` | 2026-08-07 | [權限控管：實作已完成任務鎖定機制與精確修改權限限制](#cr-035) | `routes/tasks.ts`、`TaskDrawer.tsx` | 已驗證 |
| `CR-034` | 2026-08-07 | [工作規矩：更新全權授權核准所有操作與指令規範](#cr-034) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-033` | 2026-08-07 | [工作規矩：任務先查索引、只改局部、回覆限制 100 字內、代碼修改單次限制 100 行內](#cr-033) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-032` | 2026-08-07 | [異動紀錄與程式碼規範：加入索引編號 CR-xxx 機制，程式碼改留編號引用並搬移長註解](#cr-032) | `docs/CHANGELOG.md`、`D:\NewProject\AGENTS.md`、`Calendar.tsx` 等 | 已驗證 |
| `CR-031` | 2026-08-07 | [文件與長期規則：新增頁面與功能對應清單，寫入 AGENTS.md 作為後續接手任務查頁面之長期規範](#cr-031) | `CODEMAP.md`、`D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-030` | 2026-08-06 | [行事曆與週檢視：「今天」改為專屬鮮紅小圓章（bg-red-600），與藍色「選中天」明確區分](#cr-030) | `pages/Calendar.tsx`、`pages/Week.tsx` | 已驗證 |
| `CR-029` | 2026-08-06 | [行事曆：DragOverlay 使用 createPortal 掛載至 document.body，修正下方任務拖曳位移錯位](#cr-029) | `pages/Calendar.tsx` | 已驗證 |
| `CR-028` | 2026-08-06 | [關聯圖：點與點向右連線改為 straight 平行直線模式，無折角一條線平行直通](#cr-028) | `pages/Graph.tsx` | 已驗證 |
| `CR-027` | 2026-08-06 | [週檢視：簡化工具列單日視角 UI，移除重複的「看整週」按鈕改為可點擊關閉徽章](#cr-027) | `pages/Week.tsx`、`strings/week.ts` | 已驗證 |
| `CR-026` | 2026-08-06 | [關聯圖：點對點水平齊平對齊，相連關聯鏈節點強制同高完全平行向右](#cr-026) | `pages/Graph.tsx` | 已驗證 |
| `CR-025` | 2026-08-06 | [工作規矩：更新規則檔寫入策略，任務預設為單次任務僅紀錄於 CHANGELOG](#cr-025) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-024` | 2026-08-06 | [關聯圖：關聯鏈儘量平行向右延展，上下關聯（階層/非排程相關）才向下延展](#cr-024) | `pages/Graph.tsx` | 已驗證 |
| `CR-023` | 2026-08-06 | [週檢視：點擊頂部日期可切換成單日視角，進行單日任務過濾與切回全週](#cr-023) | `pages/Week.tsx`、`strings/week.ts` | 已驗證 |
| `CR-022` | 2026-08-06 | [頁籤順序：設定彈窗內的順序調整改用拖曳（dnd-kit sortable），移除箭頭按鈕](#cr-022) | `App.tsx`、`strings/nav.ts` | 已驗證 |
| `CR-021` | 2026-08-06 | [行事曆：操作說明長字串改為懸停圖示提示，防止工具列換行](#cr-021) | `pages/Calendar.tsx`、`strings/calendar.ts` | 已驗證 |
| `CR-020` | 2026-08-06 | [待辦事項清空：側欄新增子任務展開優化、關聯圖 SS/FF 繪製確認與 WEB-1 階層驗證](#cr-020) | `components/EpicSidebar.tsx`、`docs/NEXT-SESSION.md` | 已驗證 |
| `CR-019` | 2026-08-06 | [工作規矩：加入使用者授權核准所有操作之規範](#cr-019) | `D:\NewProject\AGENTS.md` | 已驗證 |
| `CR-018` | 2026-08-06 | [任務詳情改成按「保存」才送出，加上刪除](#cr-018) | `components/TaskDrawer.tsx`、`strings/task.ts` | 已驗證 |
| `CR-017` | 2026-08-06 | [標題點了才改、層級搬正、完成那幾個狀態灰掉](#cr-017) | `components/TaskDrawer.tsx`、`pages/List.tsx`、`lib/hierarchy.ts`（前後端）、`fix-task-levels.bat`（新） | 已驗證 |
| `CR-016` | 2026-08-06 | [側欄變成真的樹；錯／外／逾三顆徽章；沒回完不能結案](#cr-016) | `components/EpicSidebar.tsx`、`components/TaskDrawer.tsx`、`pages/List.tsx`、`lib/inquiry.ts`、`routes/tasks.ts`、`lib/hierarchy.ts`（前後端）、`migrations/0014_rename_bug_to_error.sql`（新）、`strings/*` | 已驗證 |
| `CR-015` | 2026-08-05 | [側欄的數字：展開之後換到任務上；清示範垃圾的批次](#cr-015) | `components/EpicSidebar.tsx`、`strings/nav.ts`、`clean-demo-junk.bat`（新） | 已驗證 |
| `CR-014` | 2026-08-05 | [側欄標出底下有幾張問題](#cr-014) | `components/EpicSidebar.tsx`、`strings/nav.ts` | 已驗證 |
| `CR-013` | 2026-08-05 | [「發文追蹤」改叫「對外詢問」](#cr-013) | `strings/*`、`pages/*`、`components/*` | 已驗證 |
| `CR-012` | 2026-08-05 | [任務種類的順序改成「大項目 → 任務 → 問題 → 里程碑」](#cr-012) | `migrations/0013_reorder_task_types.sql`（新）、`routes/parameters.ts` | 已驗證 |
| `CR-011` | 2026-08-05 | [任務種類決定它能掛在誰底下；大項目與任務之間沒有先後](#cr-011) | `lib/hierarchy.ts`（新，前後端各一份）、`routes/tasks.ts`、`routes/links.ts`、`routes/parameters.ts`、`pages/List.tsx`、`components/TaskDrawer.tsx`、`strings/task.ts` | 已驗證 |
| `CR-010` | 2026-08-05 | [從通知點進來的那張任務，閃紅框](#cr-010) | `index.css`、`App.tsx`、`components/TaskDrawer.tsx` | 已驗證 |
| `CR-009` | 2026-08-05 | [專案代碼可以改](#cr-009) | `routes/projects.ts`、`migrations/0012_rename_bug_type.sql`（新）、`routes/parameters.ts`、`components/ProjectSettings.tsx`、`strings/settings.ts`、`lib/api.ts` | 已驗證 |
| `CR-008` | 2026-08-05 | [任務種類：改名叫「問題」、徽章用自己的顏色、新增時就能選](#cr-008) | `pages/List.tsx`、`components/TaskDrawer.tsx`、`strings/task.ts`、`strings/settings.ts` | 已驗證 |
| `CR-007` | 2026-08-05 | [任務頁面：種類可以改，進度給拖拉條，兩個日期並排](#cr-007) | `components/TaskDrawer.tsx`、`strings/task.ts` | 已驗證 |
| `CR-006` | 2026-08-05 | [清單捲不動，下面那幾張任務看不到](#cr-006) | `pages/List.tsx` | 已驗證 |
| `CR-005` | 2026-08-05 | [週檢視：分組可以收合，也可以改成依類型分](#cr-005) | `pages/Week.tsx`、`strings/week.ts`、`App.tsx` | 已驗證 |
| `CR-004` | 2026-08-05 | [儀表板：燃盡圖與負載熱圖](#cr-004) | `lib/burndown.ts`（新）、`routes/dashboard.ts`（新）、`routes/tasks.ts`、`seed.ts`、`pages/Dashboard.tsx`（新）、`components/BurndownChart.tsx`（新）、`components/WorkloadHeatmap.tsx`（新）、`strings/dashboard.ts`（新）、`lib/api.ts`、`App.tsx` | 已驗證 |
| `CR-003` | 2026-08-05 | [清單擠成一直條、框選不起來、圓點抓不到](#cr-003) | `pages/List.tsx`、`pages/Graph.tsx`、`components/ui.tsx` | 已驗證 |
| `CR-002` | 2026-08-05 | [關聯圖：框可以拉、匯合點可以拖、相關類走上下](#cr-002) | `pages/Graph.tsx`、`strings/chart.ts`、`strings/task.ts` | 已驗證 |
| `CR-001` | 2026-08-05 | [每個專案自己的系統參數](#cr-001) | `migrations/0011_project_parameters.sql`（新）、`routes/parameters.ts`（新）、`routes/tasks.ts`、`seed.ts`、`components/ProjectSettings.tsx`（新）、`strings/settings.ts`（新） | 已驗證 |
| 2026-08-05 | [行事曆的勾選記得住、甘特圖補完深色](#2026-08-05--行事曆的勾選記得住甘特圖補完深色) | `lib/remember.ts`（新）、`pages/Calendar.tsx`、`index.css` | 已驗證 |
| 2026-08-05 | [週檢視：這一週有哪些任務在跑](#2026-08-05--週檢視這一週有哪些任務在跑) | `pages/Week.tsx`（新）、`strings/week.ts`（新）、`App.tsx` | 待驗證 |
| 2026-08-05 | [任務轉派，附一句交接說明](#2026-08-05--任務轉派附一句交接說明) | `routes/tasks.ts`、`components/TaskDrawer.tsx`、`pages/List.tsx`、`components/NotificationBell.tsx`、`strings/task.ts` | 待驗證 |
| 2026-08-05 | [上傳的頭像顯示不出來](#2026-08-05--上傳的頭像顯示不出來) | `components/Avatar.tsx`、`lib/api.ts` | 已驗證 |
| 2026-08-05 | [發文追蹤移進專案，成員移到頭像選單](#2026-08-05--發文追蹤移進專案成員移到頭像選單) | `App.tsx`、`pages/InquiryBoard.tsx`、`pages/ProjectPicker.tsx`、`components/EpicSidebar.tsx`、`components/UserMenu.tsx`、`strings/nav.ts` | 已驗證 |
| 2026-08-05 | [誰能開專案、誰能管成員：放寬到專案管理者](#2026-08-05--誰能開專案誰能管成員放寬到專案管理者) | `routes/projects.ts`、`routes/members.ts`、`lib/auth.ts`、`components/MembersPanel.tsx`、`strings/account.ts` | 待驗證 |
| 2026-08-05 | [按不動的按鈕不要畫出來](#2026-08-05--按不動的按鈕不要畫出來) | `routes/tasks.ts`、`components/TaskDrawer.tsx`、`pages/List.tsx`、`pages/Board.tsx`、`strings/task.ts` | 待驗證 |
| 2026-08-05 | [深色模式的次要文字看不清楚](#2026-08-05--深色模式的次要文字看不清楚) | `index.css`、`components/ui.tsx`、其餘十二個畫面檔 | 已驗證 |
| 2026-08-05 | [請假：行事曆上看得到誰不在](#2026-08-05--請假行事曆上看得到誰不在) | `migrations/0009_leave.sql`、`routes/leaves.ts`、`api/src/index.ts`、`pages/Calendar.tsx`、`strings/calendar.ts` | 待驗證 |
| 2026-08-05 | [專案可以設成公開](#2026-08-05--專案可以設成公開) | `migrations/0010_project_public.sql`、`routes/projects.ts`、`routes/members.ts`、`pages/ProjectPicker.tsx`、`strings/project.ts` | 待驗證 |
| 2026-08-05 | [深色模式與文案外移：收完剩下的頁面](#2026-08-05--深色模式與文案外移收完剩下的頁面) | `index.css`、`components/ui.tsx`、`Avatar.tsx`、`NotificationBell.tsx`、`AdminPanel.tsx`、`MembersPanel.tsx`、`pages/Gantt.tsx`、`Calendar.tsx`、`Graph.tsx`、`ProjectPicker.tsx`、`lib/linkText.ts`、`strings/*` | 已驗證 |
| 2026-08-04 | [深色模式，以及右上角的頭像選單](#2026-08-04--深色模式以及右上角的頭像選單) | `lib/theme.tsx`（新）、`components/UserMenu.tsx`（新）、`index.css`、`App.tsx` | 待驗證 |
| 2026-08-04 | [任務狀態多了「驗證中」「驗證完成」](#2026-08-04--任務狀態多了驗證中驗證完成) | `migrations/0008_verify_statuses.sql`（新）、`routes/projects.ts`、`seed.ts` | 待驗證 |
| 2026-08-04 | [發文追蹤：期望回覆日可以直接選「幾天後」](#2026-08-04--發文追蹤期望回覆日可以直接選幾天後) | `components/InquiryTable.tsx`、`lib/date.ts`、`routes/inquiries.ts` | 待驗證 |
| 2026-08-04 | [要加入的專案改成用搜尋的，不再整排列出來](#2026-08-04--要加入的專案改成用搜尋的不再整排列出來) | `routes/members.ts`、`pages/ProjectPicker.tsx` | 待驗證 |
| 2026-08-04 | [帳號權限：管理者才管帳號，擁有者只能指派管理者](#2026-08-04--帳號權限管理者才管帳號擁有者只能指派管理者) | `lib/auth.ts`、`routes/account.ts`、`lib/breakglass.ts`（新）、`components/AdminPanel.tsx` | 待驗證 |
| 2026-08-04 | [給機器用的 API 權杖](#2026-08-04--給機器用的-api-權杖) | `migrations/0007_api_token.sql`（新）、`lib/auth.ts`、`routes/account.ts`、`components/AccountPanel.tsx` | 待驗證 |
| 2026-08-04 | [任務的「目前遇到的問題」](#2026-08-04--任務的目前遇到的問題) | `migrations/0006_task_problem.sql`（新）、`routes/tasks.ts`、`components/TaskDrawer.tsx`、`pages/List.tsx`、`Board.tsx`、`Graph.tsx` | 待驗證 |
| 2026-08-04 | [頭像：畫面接起來了](#2026-08-04--頭像畫面接起來了) | `components/AccountPanel.tsx`、`components/MembersPanel.tsx`、`pages/List.tsx` | 待驗證 |
| 2026-08-04 | [頭像：存檔與上傳端點（畫面未接）](#2026-08-04--頭像存檔與上傳端點畫面未接) | `migrations/0005_*`、`lib/avatar.ts`（新）、`routes/account.ts`、`components/Avatar.tsx`（新） | 後端已驗證，前端未接 |
| 2026-08-04 | [清單可以直接做事，成員移出頁籤](#2026-08-04--清單可以直接做事成員移出頁籤) | `apps/web/src/pages/List.tsx`、`App.tsx`、`components/EpicSidebar.tsx` | 已驗證 |
| 2026-08-04 | [關聯圖：標出每一包的起點、說明改成滑過去就顯示](#2026-08-04--關聯圖標出每一包的起點說明改成滑過去就顯示) | `apps/web/src/pages/Graph.tsx` | 已驗證 |
| 2026-08-04 | [建置：arm64 在 QEMU 下掛掉，Node 升到 24](#2026-08-04--建置arm64-在-qemu-下掛掉node-升到-24) | `apps/api/Dockerfile`、`apps/web/Dockerfile`、`ci.yml` | 已驗證 |
| 2026-08-04 | [關聯圖：大項目改成把子項目框起來](#2026-08-04--關聯圖大項目改成把子項目框起來) | `apps/web/src/pages/Graph.tsx` | 已驗證 |
| 2026-08-04 | [前端熱更新，改一行不用重建容器](#2026-08-04--前端熱更新改一行不用重建容器) | `docker-compose.hmr.yml`（新）、`apps/web/vite.config.ts` | 已驗證 |
| 2026-08-03 | [關聯圖：下層往右排、階層鄰居不再看起來像依賴、卡住追到源頭](#2026-08-03--關聯圖下層往右排階層鄰居不再看起來像依賴卡住追到源頭) | `apps/web/src/pages/Graph.tsx` | 已驗證 |
| 2026-08-03 | [通知：鈴鐺與四種事件](#2026-08-03--通知鈴鐺與四種事件) | `migrations/0003_notification.sql`（新）、`lib/notify.ts`（新）、`routes/notifications.ts`（新）、`components/NotificationBell.tsx`（新） | 已驗證 |
| 2026-08-03 | [環偵測把每一條排程依賴都判成環](#2026-08-03--環偵測把每一條排程依賴都判成環) | `apps/api/src/lib/graph.ts`、`test/e2e.sh` | 已驗證 |
| 2026-08-03 | [全新安裝的示範專案沒有建立者](#2026-08-03--全新安裝的示範專案沒有建立者) | `apps/api/src/seed.ts`、`migrations/0004_*` | 已驗證 |
| 2026-08-03 | [帳號設定與工作區管理者（後端）](#2026-08-03--帳號設定與工作區管理者後端) | `apps/api/src/routes/account.ts`（新）、`lib/auth.ts`、`web/src/lib/api.ts` | 待驗證 |
| 2026-08-03 | [關聯圖：並行拆成同時開始／同時完成／重疊](#2026-08-03--關聯圖並行拆成同時開始同時完成重疊) | `apps/web/src/pages/Graph.tsx` | 待驗證 |
| 2026-08-03 | [關聯圖：匯合點改成小圓點、圖示說明固定在最下排](#2026-08-03--關聯圖匯合點改成小圓點圖示說明固定在最下排) | `apps/web/src/pages/Graph.tsx` | 待驗證 |
| 2026-08-03 | [關聯圖：虛線規則、文字描邊、說明收角落、點一下不再位移](#2026-08-03--關聯圖虛線規則文字描邊說明收角落點一下不再位移) | `apps/web/src/pages/Graph.tsx` | 待驗證 |
| 2026-08-03 | [補上程式地圖 CODEMAP.md](#2026-08-03--補上程式地圖-codemapmd) | `docs/CODEMAP.md`（新）、`docs/ARCHITECTURE.md` | 完成 |
| 2026-08-03 | [換帳號沒清快取，畫面留著前一個人的資料](#2026-08-03--換帳號沒清快取畫面留著前一個人的資料) | `apps/web/src/lib/auth.tsx`、`App.tsx` | 已驗證 |
| 2026-08-03 | [成員權限：前端 UI](#2026-08-03--成員權限前端-ui) | `components/MembersPanel.tsx`（新）、`ProjectPicker.tsx`、`App.tsx`、`routes/members.ts` | 已驗證 |
| 2026-08-03 | [關聯圖：卡住與並行標記](#2026-08-03--關聯圖卡住與並行標記) | `apps/web/src/pages/Graph.tsx` | 已驗證 |
| 2026-08-03 | [關聯圖：階層線補上「包含」標籤](#2026-08-03--關聯圖階層線補上包含標籤) | `apps/web/src/pages/Graph.tsx` | 已驗證 |
| 2026-08-03 | [成員權限：創立者核准制（後端）](#2026-08-03--成員權限創立者核准制後端) | `apps/api/src/routes/members.ts`、`migrations/0002_*` | 已驗證 |
| 2026-08-03 | [關聯圖：同時開始／完成改成分岔與合流](#2026-08-03--關聯圖同時開始完成改成分岔與合流) | `apps/web/src/pages/Graph.tsx` | 已驗證 |
| 2026-08-03 | [關聯圖：節點不顯示／fitView 不觸發](#2026-08-03--關聯圖節點不顯示fitview-不觸發) | `apps/web/src/pages/Graph.tsx` | 已驗證 |
| 2026-08-01 | [行事曆視圖](#2026-08-01--行事曆視圖) | `pages/Calendar.tsx`（新）、`lib/date.ts`（新）、`App.tsx` | 已驗證 |
| 2026-08-01 | [發版流程與 NAS 部署](#2026-08-01--發版流程與-nas-部署) | `docker-compose.synology.yml`、`release.yml`、`README.md`、`.env.example`、`web/Dockerfile` | 已驗證 |
| 2026-08-01 | [發版一路踩到底的四個坑](#2026-08-01--發版一路踩到底的四個坑) | `ci.yml`、`release.yml`、`*/.dockerignore`（新）、`api/Dockerfile` | 已驗證 |
| 2026-08-01 | [e2e 改用標題定位任務](#2026-08-01--e2e-改用標題定位任務) | `test/e2e.sh`、`routes/links.ts`、`docs/SPEC.md` | 已驗證 |
| 2026-08-01 | [初版](#2026-08-01--初版) | 整個專案 | 已驗證 |

---

## 詳細條目

### <a id="cr-170"></a>CR-170 (2026-08-19) — 資料清理：全面清理資料庫與示範專案中殘留之舊版 EPIC 與里程碑類型，統一收斂為任務單

- **使用者需求**：排查並清理舊專案任務單上出現之 `EPIC` 歷史標籤。
- **清理與重構作業**：
  1. **資料庫全面洗淨**：新增遷移 `0026_cleanup_legacy_epic_milestone_types.sql`，並於正式/開發庫將所有非 `BUG`（問題單）之舊 `EPIC` / `MILESTONE` 統一收斂轉為標準 `TASK`（任務單）。
  2. **示範種子更新**：更新 `seed.ts` 中示範專案任務清單，全面使用標準 `TASK` 與 `BUG`。
- **異動模組**：`apps/api/src/seed.ts`, `apps/api/src/migrations/0026_cleanup_legacy_epic_milestone_types.sql`。

### <a id="cr-169"></a>CR-169 (2026-08-19) — 關聯圖修正：修復連續拉線/多卡連線時舊連線被覆蓋或快取覆寫消失 Bug

- **使用者問題**：在關聯圖中連入第二條線時，第一條線有時會消失。
- **根本原因排查與修復**：
  1. **接點起點反轉修復**：補齊 `onConnectStart`，當使用者由 Target 類型接點起拉時，自動校正回使用者真實拖曳起點方向，避免方向倒置觸發循環依賴防護（409 Conflict）或誤改反向現有連線。
  2. **樂觀連線快取競態保護**：修復 `useEffect` 更新 `realEdges` 時，強制保留尚未被伺服器返回的 `pendingOptimistic` 連線，防止連續拉線時前一條請求的查詢結果衝掉後一條連線。
  3. **節點存在判定直接使用 `graphData.nodes`**：移除單純依賴外部 `tasks` prop 的過濾限制，避免因父層查詢刷新時差誤刪有效連線。
  4. **精確化既有連線判定**：僅在起點、終點、出發接點與接入接點完全一致時忽略重複連線，不再錯誤攔截或覆蓋不同接點之獨立連線。
- **異動模組**：`apps/web/src/pages/TaskGraph.tsx`。

### <a id="cr-168"></a>CR-168 (2026-08-19) — 權限校正：嚴格劃分環境變數超級管理者、專案擁有者（建立者）與專案管理者之權限邊界

- **使用者需求**：明確區分環境變數（`PMFLOW_ADMIN_EMAIL`）指定的**超級管理者**與一般專案之**專案擁有者（建立者）/ 管理者**，禁止將一般專案建立者誤提升為全域工作區擁有者。
- **權限邊界校正**：
  1. **全域超級管理者（Super Admin）**：僅當使用者 email 符合 `PMFLOW_ADMIN_EMAIL` / `PMFLOW_ADMIN_EMAILS` 時，在工作區層級享有 `OWNER`，在全系統所有專案自動享有 `MANAGER` 最高權限。
  2. **專案擁有者（Project Owner / Creator）**：專案建立者（`p.created_by`），在該專案內享有最高管理權（`MANAGER`）與專屬「👑 轉移專案擁有權」特權，不可被踢出或降級；在工作區層級維持一般成員。
  3. **專案管理者（Project Manager）**：在該專案內角色為 `MANAGER`，可維護參數、審核加入申請與管理專案成員，但不能轉移專案擁有權。
  4. **專案成員（Editor / Viewer）**：一般編輯與唯讀成員。
- **異動模組**：`lib/auth.ts`, `routes/auth.ts`, `routes/projects.ts`, `routes/members.ts`, `App.tsx`。

### <a id="cr-167"></a>CR-167 (2026-08-19) — 介面排版：所有視圖（側欄、成員、週檢視、詳情子任務）之警示徽章統一折行置於下一行，避免橫向變長與溢出

- **需求背景**：當任務同時具備卡住、問題單、逾期、詢問逾期或並行等多項警示時，若與標題或種類標籤放在同一行，會導致該行橫向過長、擠壓旁邊文字或產生難看換行。
- **改進內容**：
  1. **左側選單欄 (`EpicSidebar.tsx`)**：第一行固定為 `[📦 MRG-X] [種類標籤] [✓ (靠右)]`；警示徽章群（⛔卡住、⚑問題、⏰逾期、📨逾回、⏳待回）移至第二行獨立呈現，第三行為任務標題，第四行為進度條。
  2. **成員視圖 (`Members.tsx`)**：第一行為 `[MRG-X] [標題]`，警示徽章（⚑問題、📨詢問、⏰逾期）獨立置於第二行。
  3. **週檢視視圖 (`Week.tsx`)**：第一行為 `[種類標籤] [MRG-X] [標題]`，遭遇問題徽章（⚑問題）獨立置於第二行。
  4. **任務詳情抽屜 (`TaskDrawer.tsx`)**：子任務清單中，第一行為 `[MRG-X] [標題]`，遭遇問題徽章獨立置於第二行。
  5. **關聯圖 (`TaskGraph.tsx`) 與看板 (`Board.tsx`)**：已維持多行標準結構，所有視圖達到統一的縱向整齊排版體驗。

### <a id="cr-166"></a>CR-166 (2026-08-19) — 帳號權限：修復專案建立者與管理者於系統管理頁誤顯為成員 Bug，全面升級回傳正確擁有者/管理者身分

- **問題症狀**：使用者身為超級管理員或專案建立者（擁有者）/ 專案管理者，進入「系統管理」面板時，頂部身分徽章卻顯示「你的身分：成員」，且「🛡️ 指派管理者」標籤頁被隱藏。
- **根本原因**：
  1. 後端 `requireWorkspaceAdmin` 先前對專案建立者或管理者放行時，仍回傳使用者在 `workspace_member` 的原始角色（`MEMBER`），導致 `GET /admin/users` 的 `myRole` 為 `MEMBER`。
  2. `GET /auth/me` 在查詢使用者的 `workspaces` 時未檢查 `hasCreatedProject` / `hasManagedProject` 與 `isSuperAdmin`，回傳了舊的 `MEMBER` 角色，導致前端 `App.tsx` 傳給 `AdminPanel` 的 `myRole` 亦為 `MEMBER`。
- **修復方式**：
  1. **後端角色智慧升級 (`lib/auth.ts`, `routes/auth.ts`, `routes/account.ts`)**：
     - 在 `requireWorkspaceAdmin` 與 `requireWorkspaceOwner` 中，專案建立者與超級管理者一律解析為 `OWNER`，專案管理者解析為 `ADMIN`。
     - 在 `GET /auth/me` 中，自動依據 `hasCreatedProject` / `hasManagedProject` / `isSuperAdmin` 映射出 `OWNER` / `ADMIN` 之正確工作區角色。
  2. **前端身分計算與面板解鎖 (`App.tsx`, `AdminPanel.tsx`)**：
     - `App.tsx` 正確計算使用者的最高有效角色（`myAdminRole`）傳入 `AdminPanel`。
     - 系統管理標頭即時呈現 `你的身分：擁有者` 或 `你的身分：管理者`，並解鎖擁有者專屬管理標籤與完整帳號管理操作。

### <a id="cr-165"></a>CR-165 (2026-08-19) — AI 技能與自動化：實作 GET /api/v1/skills 端點與右上角「AI 串接指令」一鍵複製 Prompt 彈窗

- **需求背景**：
  使用者希望將需求清單或會議紀錄直接交由 AI（如 Claude / Gemini / ChatGPT / Cursor 等）處理，由 AI 自動探索 PMFlow 專案自訂欄位、種類與 API 規格，並自主呼叫對應 API 建立任務、設定前後相依關聯線、掛載子項目階層或登錄詢問單。
- **根本原因與調整**：
  1. **後端 AI Agent 技能探索路由 (`GET /api/v1/skills`, `routes/skills.ts`, `index.ts`)**：
     - 新增 `GET /api/v1/skills` 端點（需要 Bearer Token 驗證），自動回傳使用者可操作之所有專案、自訂狀態 (statuses)、自訂種類 (types)、優先度 (priorities)、專案成員與完整可操作 API 規格（`list_tasks`, `create_task`, `update_task`, `create_link`, `delete_link`, `create_inquiry`, `transfer_ownership`）。
  2. **前端 AI 串接指令 Modal 彈窗 (`AiSkillModal.tsx`, `UserMenu.tsx`, `App.tsx`)**：
     - 在右上角頭像選單新增「`🤖 AI 串接指令 (Skill / API)`」選項，點擊開啟 `AiSkillModal`。
     - 自動帶入當前目標專案 ID、名稱、API Base URL 與 API Token，組裝出核心 Prompt 提示詞 + 清單插槽。
     - 提供「📋 一鍵複製 Prompt」與快速建立 API 權杖功能。
  3. **帳號設定權杖產生整合 (`AccountPanel.tsx`)**：
     - 在使用者建立 API 權杖成功時，於明文下方同步顯示「🤖 給 AI 的一鍵串接指令 (Prompt)」，一鍵複製帶有新 Token 的完整指令。

### <a id="cr-164"></a>CR-164 (2026-08-19) — 權限與專案管理：支援 PMFLOW_ADMIN_EMAIL 指定全域超級管理者，開放專案擁有者轉移與帳號註銷管理最高權限

- **需求背景**：
  1. 使用者身為系統管理者，需要擁有全域最高權限，可停用、註銷（刪除）、重設任何成員與專案擁有者帳號。
  2. 專案建立者（擁有者）應可被轉移給專案中的其他成員，避免因人員異動無法調整專案建立者角色。
  3. 支援透過環境變數直接指定超級管理員信箱。
- **根本原因與調整**：
  1. **後端環境變數與超級管理員識別 (`lib/env.ts`, `lib/auth.ts`)**：
     - 新增 `PMFLOW_ADMIN_EMAIL` / `PMFLOW_ADMIN_EMAILS` 環境變數，支援多個 email 逗號分隔。
     - 實作 `isSuperAdmin` 輔助函式，符合超級管理員之使用者在所有工作區與專案中自動具備全域最高權限。
  2. **專案擁有權轉移 API (`routes/projects.ts`, `routes/members.ts`)**：
     - 新增 `POST /projects/:id/transfer-ownership` 端點，允許超級管理者、專案管理者或原建立者將 `created_by` 轉移給專案成員，並確保新擁有者設定為 `MANAGER` 角色。
     - `GET /projects/:id/members` 補齊 `canTransferOwnership` 權限回傳。
  3. **帳號管理與註銷權限解鎖 (`routes/account.ts`, `AdminPanel.tsx`)**：
     - 放行超級管理者與工作區擁有者對包含其他管理者與專案建立者在內之所有帳號進行停用（`SUSPENDED`）、復權（`ACTIVE`）、註銷/刪除（`DELETE`）、重設密碼與角色調整。
     - 優化 `UserRow` 之操作按鈕樣式與可見度。
  4. **專案成員頁轉移擁有者 UI (`MembersPanel.tsx`, `strings/account.ts`)**：
     - 在成員名單中加入「👑 轉移擁有者」按鈕與二次確認對話框，轉移後即時刷新專案資料與建立者標籤。
  5. **容器配置與文件更新 (`.env.example`, `docker-compose*.yml`)**：
     - 補齊 `PMFLOW_ADMIN_EMAIL` 範例與 Docker Compose 注入設定。

### <a id="cr-163"></a>CR-163 (2026-08-19) — 任務關聯圖：移除同時關聯線時，卡片與收納盒即時解除「⚡並行」警示徽章

- **問題症狀**：多條並行關聯線匯入同一目標卡片或收納盒時，卡片會顯示「⚡並行」徽章；當使用者刪除其中一條關聯線（僅剩 1 條或 0 條連線，已無並行匯合）時，卡片上的「⚡並行」警示徽章仍殘留未被清除。
- **根本原因**：
  1. `TaskGraph.tsx` 中 `parallelMap` 雖會隨 `edges` 變化重新計算，但節點衍生函式 `nodesWithHandlers` 內部未將 `parallelMap.get(node.id)` 動態注入節點資料（`built.data.isParallel` 與 `parallelPeers`）。
  2. 節點快取比對鍵（`derivedNodeCacheRef` key）中未包含 `isParallel` 與 `parallelPeers`，且 `nodesWithHandlers` 依賴項未包含 `parallelMap`，導致刪線後命中舊快取殘留初始並行狀態。
- **修復方式**：
  1. 在 `TaskGraph.tsx` 的 `nodesWithHandlers` 中，即時從 `parallelMap` 取得最新 `parallelInfo`，動態綁定 `isParallel` 與 `parallelPeers`。
  2. 將 `isParallel`、`parallelPeers` 與 `parallelMap` 完整納入快取鍵比對與 `useMemo` 依賴陣列，刪線或加線時即時重新計算並清除或添加「⚡並行」徽章。

### <a id="cr-162"></a>CR-162 (2026-08-19) — 全域警示徽章同步刷新：收納盒連線受阻即時警示、卡住/問題/逾期/逾回同時顯示、問題單免設起訖日

- **問題症狀**：
  1. 關聯圖中，收納盒自身拉入上游相依連線時未顯示「⛔ 卡住」警示；盒內卡片拉線受阻時收納盒受阻數量與警示未即時同步刷新。
  2. 左側選單（EpicSidebar）、清單（List）與看板（Board）中，問題單（`bugs > 0`）會遮蔽卡住徽章；且排程逾期與對外詢問逾期文字容易混淆。
  3. 問題單（BUG）在任務詳情抽屜中顯示起訖日欄位，但問題單不需要設定工期與排程時間。
- **根本原因**：
  1. `TaskGraph.tsx` 中 `derived` 節點判定在 `isBox` 時強制將 `blockedBy` 設為 `undefined`，且僅統計盒內子項受阻數，忽略了收納盒本身作為依賴節點時的 `nodeBlockedBy`。
  2. `EpicSidebar.tsx` 與多處視圖曾採用 `bugs === 0 && blockedBy` 的互斥條件，導致有問題單時卡住狀態被遮蔽；且詢問狀態文字（4 字）過長。
  3. `TaskDrawer.tsx` 未對 `BUG` 類型隱藏「開始日 – 到期日」表單欄位。
- **修復方式**：
  1. **關聯圖收納盒與卡片同步刷新**：
     - `TaskGraph.tsx` 的 `nodesWithHandlers` 全面保留收納盒自身 `blockedBy`，並支援收納盒自身受阻（`⛔ 卡住`）與盒內子卡片受阻（`⛔ 卡住 N`）同步顯示。
     - 動態計算盒內未完成之問題單（`⚑ 問題 N`）、排程逾期（`⏰ 逾期 N`）、對外詢問逾期（`📨 逾回 N`）與待回覆（`⏳ 待回 N`），拉線與移入移出時即時刷新。
  2. **全域警示徽章並存不遮蔽**：
     - 精簡對外詢問文字為 2 字動作語意：`📨 逾回`（靛藍色）、`⏳ 待回`（藍色），與排程逾期 `⏰ 逾期`（玫瑰紅）明確分工。
     - 側欄選單（`EpicSidebar.tsx`）、看板（`Board.tsx`）與清單（`List.tsx`）全面解除互斥遮蔽，卡住、問題單、排程逾期、對外詢問逾期與待回全數同時並存。
  3. **問題單（BUG）免設起訖日**：
     - `TaskDrawer.tsx` 針對 `form.type === 'BUG' || data.type === 'BUG'` 隱藏起訖日（開始日 – 到期日）設定欄位。

### <a id="cr-161"></a>CR-161 (2026-08-18) — 任務關聯圖：點擊「新增文字」直接在畫布生成文字註記，不再主動彈出色票/編輯視窗（對齊流程圖行為）

- **問題症狀**：在任務關聯圖點擊「📝 新增文字」時會強制彈出色票與文字編輯視窗，與系統流程圖直接生成文字註記的直覺體驗不一致。
- **根本原因**：`TaskGraph.tsx` 的 `handleAddTextAnnotation` 先前在寫入 `annotations` 後多呼叫了 `setEditingAnnotation(...)`，導致一建立就觸發全螢幕對話框。
- **修復方式**：
  1. 移除 `handleAddTextAnnotation` 中的 `setEditingAnnotation` 呼叫，使文字節點直接在畫布座標上無縫產生。
  2. 若使用者需自訂文字內容或顏色，點擊文字上方懸浮列的 ✏️ 按鈕即可隨時編輯。

### <a id="cr-160"></a>CR-160 (2026-08-18) — 任務關聯圖：嚴格限制左右接點只能連左右（排程相依）、上下接點只能連上下（階層關係）

- **問題症狀**：任務關聯圖中，若將左/右（排程相依）拉至上/下（階層關係），或從上/下接點拉至左/右接點，會產生不符合業務語意的混亂連線。
- **根本原因**：任務關聯圖具備特定業務語意（左右為 FS/SS/FF/SF 排程相依線，上下為父子階層線），先前缺少連線合法性即時驗證機制。
- **修復方式**：
  1. 在 [`TaskGraph.tsx`](file:///D:/github/pmflow/apps/web/src/pages/TaskGraph.tsx) 加入 `isValidConnection` 回呼函式，嚴格判定 `sIsHoriz === tIsHoriz`（左右只能連左右、上下只能連上下），並掛載至 `<ReactFlow isValidConnection={isValidConnection} />`。
  2. 在拖曳拉線過程中，若游標懸停在不相容的接點（如從左側拖到上方），React Flow 即時判定無效（接點變紅/無法放置），從源頭杜絕跨軸向無效連線。
  3. 在 `onConnect` 內部同樣加上雙重守門，確保資料庫與前端狀態 100% 遵守軸向規則。

### <a id="cr-159"></a>CR-159 (2026-08-18) — 系統流程圖：所有框（步驟卡片、模組容器盒、區域標示框、文字註記）全數配置四向接點，支援四向任意自由拉線與接線

- **問題症狀**：系統流程圖中，區域標示框 (`frame`) 與文字註記 (`text`) 缺少接點無法拉線或連入，且連線樣式各異。
- **根本原因**：
  1. 區域標示框與文字節點先前未放置 `<Handle>` 元件，且區域標示框的外層帶有 `pointer-events-none` 與 `zIndex: -1`，導致游標事件被底層 pane 遮蔽。
  2. 系統流程圖各節點需要具備完全一致的四向連接能力（支援任何框體之間互相連接）。
- **修復方式**：
  1. 為所有節點類型（步驟卡片 `step`、模組容器盒 `box`、區域標示框 `frame`、文字註記 `text`）配置統一的四向接點（`left-in`、`right-out`、`top-in`、`bottom-out`）。
  2. 開啟所有接點的 `isConnectableStart={true}` 與 `isConnectableEnd={true}`，並為 `frame` 的接點加上 `pointer-events-auto` 與調整 `zIndex: 0`，確保任何框體皆可四向拉線、四向接線。
  3. 統一連線樣式為實體方向箭頭，四向連線皆保持乾淨一致的風格。

### <a id="cr-158"></a>CR-158 (2026-08-18) — 系統流程圖：移除 onConnect 強制改寫接點邏輯、統一容器框 Handles ID、支援四向任意連線方向

- **問題症狀**：系統流程圖中無法四向自由拉線，且箭頭只能從左到右，無法由右往左或由下往上。
- **根本原因**：
  1. `onConnect` 內部使用了 `toOutHandle` 與 `toInHandle`，將使用者拉的所有來源與目標接點強制竄改為 `right-out`/`bottom-out` 與 `top-in`/`left-in`。
  2. 模組容器盒 (`FlowBoxNode`) 上的 Handle id 為 `left`/`right`/`top`/`bottom`，與步驟節點不一致。
  3. React Flow 在寬鬆連線模式下，當起點為 `type="target"`（如 `left-in` 或 `top-in`）而終點為 `type="source"`（如 `right-out` 或 `bottom-out`）時，內部會強制將 `source` 與 `target` 對調，導致箭頭永遠釘在左到右或上到下。
- **修復方式**：
  1. 移除 `toOutHandle` 與 `toInHandle`。
  2. 統一模組容器盒 (`FlowBoxNode`) 接點 ID 為 `left-in`、`right-out`、`top-in`、`bottom-out`。
  3. 加入 `onConnectStart` 記錄實際滑鼠按下的起點節點；當 React Flow 顛倒方向時，依據實際起點校正 `source`/`target`，確保箭頭永遠正確落在使用者放開滑鼠的終點端（完美支援右到左、下到上、左到左、右到右等 16 種任意四向組合）。

### <a id="cr-157"></a>CR-157 (2026-08-18) — 任務關聯圖：卡片初始給定尺寸與 measured，修復初次進入無法拉線需先拖移卡片問題

- **問題症狀**：使用者首次進入關聯圖時，收納盒可正常拉線，但卡片上的 Handles 接點完全無法直接拖曳拉線，必須先稍微拖動卡片一次後才能拉線。
- **根本原因**：在節點資料組裝與 `useEffect` 合併時，收納盒有給定預設尺寸與 `measured: { width, height }`，但卡片在第 0 幀缺少 `width/height` 與 `measured` 物件。React Flow 內部未在初次掛載時計算並快取卡片 handles 的 `handleBounds`，直到使用者拖曳卡片觸發 DOM 量測才補回。
- **修復方式**：
  1. 在 `processTask` 與 `useEffect` 節點合併時，卡片節點一律帶入初始 `width: 256`, `height: 90` 與 `measured: { width: 256, height: 90 }`。
  2. `SimpleNodeView` 外層與卡片本體一律使用確定寬高與 `w-full h-full`，使 React Flow 在初始畫面載入完成當下即可 100% 響應十字標拉線。

### <a id="cr-156"></a>CR-156 (2026-08-18) — 兩張圖：接點標準化為 Left/Top 連入 (target) 與 Right/Bottom 出發 (source)

- **修復方式**：在 `TaskGraph.tsx` 與 `SystemFlow.tsx` 中，將 Left / Top 設為 `type="target"`（連入），Right / Bottom 設為 `type="source"`（出發），並同時啟用 `isConnectableStart={true}` 與 `isConnectableEnd={true}`，使 React Flow 註冊完整的雙向接點池，支援四向任意出發與連入。

### <a id="cr-155"></a>CR-155 (2026-08-18) — 任務關聯圖：問題單警示依畫布節點樹即時動態遞迴計算，移出即刻歸零

- **問題症狀**：將收納盒內的問題單卡片拖出收納盒後，收納盒仍持續顯示「問 X」警示，未即時消失。
- **根本原因**：先前收納盒的 `problemCount` 與 `childCount` 僅在初次依照 prop tasks 靜態計算寫入 `node.data`，畫布拖曳節點脫離父容器時 `node.data` 仍保留舊值。
- **修復方式**：在 `nodesWithHandlers` 中建立畫布即時 `nodeChildrenMap`，動態遞迴統計子孫 `type === 'BUG'` 且未完成的任務。子卡片一拖出收納盒（`parentId` 脫離），收納盒的 `problemCount` 毫秒級即時歸零並移除徽章，同時於拖曳結束呼叫 `invalidateQueries` 同步側欄與後端。另外將卡片層級調升至 20~50 高於線條 interaction stroke (30px)，解決連線完成後接點十字標偶發被遮蔽問題。

### <a id="cr-154"></a>CR-154 (2026-08-18) — 系統流程圖：編輯與刪除鈕移出文字範圍

跟 `CR-153` 同一件事，只是換一頁。按鈕列原本壓在文字右上角（`-top-3 -right-3`），
**文字一短，按鈕列就比文字還寬**，整段字被蓋住。移到文字上緣之外，兩頁現在一致。

區域標示框的標題膠囊維持 `-top-3 left-3` 不動 —— 它壓的是框線、不是文字，那是刻意的。

### <a id="cr-153"></a>CR-153 (2026-08-18) — 文字註記「按住就消失」

**成因是 `CODEMAP.md` 那條 `measured` 坑的第三種變形**（前兩次是衍生物件沒帶、參照不穩定被丟掉）。

住在 `nodes` 裡的節點，React Flow 會把量到的尺寸寫進節點物件，之後展開就一路帶著。
但這一頁的文字註記**住在另一份 state、只在渲染時合併進去** —— 沒有人幫它寫回尺寸，
每次重組都缺 `measured`，於是節點被判定成「還沒量過」而 `visibility: hidden`，
**要等瀏覽器回報尺寸才會出現**。拖曳時每個事件重組一次 → 整個拖曳過程幾乎都是隱藏的，
症狀就是「按住字就不見、放開才回來」。改成在 `onNodesChange` 把量到的尺寸另外記下來、組節點時補回去。

**「字被蓋住」與「編輯刪除鈕擋住字」是同一件事**：那兩顆鈕原本壓在文字右上角（`-top-3 -right-3`），
文字短的時候按鈕列比文字還寬，等於整段字被蓋住。移到文字上緣之外。
**這一項刻意沒有跟系統流程圖一致** —— 隔壁用的正是同一組數值，而那就是使用者在抱怨的東西。

**做法是逐行對照系統流程圖找差異**（使用者指出隔壁是對的）。對照後把沒有必要理由的差異
全部改回一致（多餘的 `nodrag`、`onPointerDown` 攔截、`pointer-events-auto`），
保留六項有理由的差異並逐項說明：註記與標籤的 z-index 要墊高（這一頁每張卡片都有 inline z-index，
隔壁沒有）、標示框沉到 -1（否則會蓋掉框內的關聯線點擊）、以及使用者上一輪指名要的字級與命中區。

順帶查證排除掉一個假設：文字註記**根本沒有就地輸入框**（走彈窗編輯），
所以「輸入框初始值沒帶入」在這個元件上結構性不可能。

### <a id="cr-152"></a>CR-152 (2026-08-18) — 兩張圖：文字放大、整塊可拖、拖曳時的重繪成本

**「字太短會被編輯的卡住」的真兇不是編輯框，是折點把手。** 那顆把手的實際命中區是 28×28、
以折點為中心向上延伸，**剛好蓋在文字下緣** —— 字少時那個圓比文字還寬。
把文字往上挪開留出空隙即可，不是去縮編輯框。

文字放大約兩級；非編輯狀態的命中區縮成**文字本身那一塊**（沒有多餘內距與最小寬度），
編輯時輸入框寬度跟著內容走，短字不再撐出一個大框。

**區域標示框整塊可拖**：拿掉「不吃點擊」，改**靠層級分工** —— 卡片在框之上，
點卡片時事件落在卡片、不會傳到框；點框的空白處才拖動框。兩張圖各自踩到一個坑：
- 系統流程圖：React Flow **在節點被選取時會把它抬到 z-index 1000**，框一旦被選取就會反過來
  蓋住框內節點。補了兩道保護確保框永遠不被選取。
- 任務關聯圖：框若停在 z-index 0，會**蓋住它範圍內的所有關聯線**（線就點不到了）。
  改成 **-1**，框底下的線仍然點得到。

**取捨（已跟使用者確認可接受）**：整塊可拖之後，**框內空白處不能再拖動來平移畫布**。

**效能：我交代的架構改法是錯的，子代理拿原始碼頂回來，它是對的。**
我要求把註記併進 React Flow 管理的 `nodes` 走 `applyNodeChanges`，以為能省掉父層重繪。
但這個專案用的是**受控模式** —— React Flow 在受控模式下**不會自己更新畫面**，
只呼叫 `onNodesChange` 回拋給父層（`triggerNodeChanges` 只有非受控才自己套用；
`setNodes` 在受控模式下也只算 diff 再回呼）。所以併進去之後每個 pointermove 仍然是
一次父層 render，**完全沒有改善**，而且註記會被塞進收納盒歸屬判定要掃的陣列裡。
唯一真能拿掉那次 render 的是改成非受控，那等於放棄任務資料驅動節點、
卡片與收納盒切換、移出收納盒、側欄聚焦這些功能，是整頁重寫。

**改成打掉那次 render 底下的 O(N) 成本**：以前每次 pointermove 把**全部**卡片重造成新物件，
於是每一張卡片的節點元件都重繪；現在只有真的動到的那一張換新物件，
**節點元件重繪從 N 次降到 1 次**。另外修掉一個每次都跑的排序（原本每比較一次就往上追一趟
父鏈，改成記憶化，且本來有序時直接回傳原陣列不配置）、以及連線側同樣的整批重建。

### <a id="cr-151"></a>CR-151 (2026-08-18) — 線上文字「消失」其實是被卡片蓋住

**不是資料掉了。** React Flow 的線上標籤容器（`.react-flow__edgelabel-renderer`）
**沒有設 z-index**，而且在 DOM 順序上排在節點容器**前面**；這一頁又給每張卡片都寫了
inline z-index。所以只要文字落點壓到任何一張卡片，就會被卡片畫在上面 ——
在密集的關聯圖上幾乎必然發生。把標籤與折點把手墊到所有卡片之上即可。

**「很難點到」有兩個原因疊加**：同樣被卡片蓋住；以及 `CR-150` 自己加錯的一段保護 ——
標籤的每一次單擊都武裝了 `CR-141` 的防誤刪旗標，於是**碰過文字之後 400ms 內點線，
彈窗會被吞掉**。移除，改成跟系統流程圖一樣只 `stopPropagation`。

**折點與文字的鍵改用關聯線自己的 `id`**。原本用 `${source}_${target}`：
對稱型關聯後端會依字典序把兩端對調，「剛拉出來的線」與「重整後從 API 回來的線」
兩端可能相反 → 鍵對不上。查證後這一頁**目前不會觸發**（對稱型只有「相關」，
而拉線一律送「完成後開始」），但**從任務抽屜建立的「相關」關聯會中招**，屬於潛在 bug，
一併改掉，並加上舊鍵搬移，使用者已經拖好的轉角不會歸零。

### <a id="cr-150"></a>CR-150 (2026-08-17) — 任務關聯圖：關聯線上的文字

跟系統流程圖（`CR-140`）做成一致的功能。空的時候完全不畫（沒有空框、沒有佔位字），
雙擊文字就地改，清空就消失。

**沒有另外開彈窗**：原本點線是「刪除確認」，直接把它擴充成「編輯關聯線」——
上面留原本的來源／目標說明，中間是文字欄，底下左邊刪除、右邊取消／儲存。
刪線時順手把該條線的文字一起清掉，不留孤兒資料。

**標籤跟著折點走**：座標**直接用 `buildOrthogonalPath()` 回傳的折點座標**，
不另外算中點 —— 跟把手用同一組值，所以拖動轉角時兩者不可能分家。
各自算中點的話，使用者拖完轉角，字會飄在半空中。

**編輯文字不會誤觸發刪除**（三層，缺一不可）：標籤與輸入框自己 `stopPropagation`；
再過一次 `CR-141` 的一次性旗標；輸入框的鍵盤事件也擋住，
免得打字時的 Delete 被 React Flow 當成刪除節點的快捷鍵。

用詞刻意跟系統流程圖分開：那一頁講「流程連線」，這一頁講「關聯線」——
硬合併成一組字串會逼出一個兩邊都不對的名字。

### <a id="cr-149"></a>CR-149 (2026-08-17) — 移除掛載 SQL 種子；JWT 金鑰自動產生

**移除掛載目錄的 SQL 種子**：`seedFromSqlDir()` 會把掛載目錄下所有 `.sql` 用
`sql.unsafe()` 執行，而 `docker-compose.synology.yml` 把 `./seed` 掛進去又指定去讀它，
`seed/01_demo_seed.sql` 建立的正是弱密碼示範帳號（密碼寫在檔案第 3 行）——
**NAS 一啟動就把這個帳號建進正式站**。整組移除，範例檔一併刪掉（git 歷史留著）。

**JWT 金鑰**：`docker-compose.synology.yml` 原本**寫死一組金鑰，而這個 repo 是 public**。
金鑰是簽登入權杖用的印章，伺服器不存權杖、只拿印章重新驗算 —— 知道印章就能自簽一張
「我是管理者」的權杖，**不需要密碼**。照抄那份檔又沒換掉的部署全都中招。

改成：**有設環境變數一律以它為準**（既有部署完全不受影響，這條擺第一位）；
沒設則第一次啟動自動產生並存進資料庫，之後沿用同一組（**重啟不會把大家登出**）。
正式環境不再因為沒設而拒絕啟動。

- **存資料庫不存檔案**：資料庫是備份本來就涵蓋的那一份，容器重建、換映像、換 NAS 都跟著走。
  檔案要挑掛載路徑，而那個路徑每個人不一樣，**沒掛到就等於每次重建換一把金鑰
  （全站登出）而且沒人會發現**。
- **時序**：金鑰原本是模組載入時算好的同步常數，`auth.ts` 與 `oauth.ts` 都在模組層級就把它
  編碼起來。改成在 `migrate()` 之後、`listen()` 之前初始化，取用點改成呼叫函式；
  **未初始化時直接丟例外**，不會回 undefined 讓誰都驗得過。
- **並行**：`INSERT ... ON CONFLICT DO NOTHING` 後再讀回，一律以資料庫那一筆為準。
  否則兩個實例同時第一次啟動會各產一組，互相把對方的登入踢掉。

**怎麼驗的**（實測，不是推理）：登入拿權杖 → 重啟 → **同一張權杖未重新登入仍然有效**；
兩個實例對全新資料庫同時啟動，資料庫只有一列且跨實例互通；
另外實測有設環境變數時**連 `app_secret` 都不會去讀寫**。E2E 159/159。
順帶把 `docker-compose.yml` 的強制要求也放寬（`.env` 那條路不必再自己產金鑰）。

### <a id="cr-148"></a>CR-148 (2026-08-17) — 兩張圖的 LAG 與閃爍

使用者回報「區域標示框縮放有點 LAG、文字區塊的移動也有點閃爍」。**兩個症狀成因不同**，
兩張圖各踩了一次，已把兩條寫進 `CODEMAP.md` 的「踩過的坑」。

**LAG ＝ 拖曳中每個事件同步寫一次儲存。** 縮放與拖曳每秒觸發 60～120 次，每次都把整份資料
`JSON.stringify` 再 `localStorage.setItem`，而那是**同步**操作，直接卡住主執行緒。
改成手放開才寫：一次縮放的寫入從約 300 次降到 1 次。另補兩道保險（結束事件沒送到時的
逾時寫入、離開頁面時的補寫），確保**不會漏存**。

**閃爍 ＝ React Flow 重新量測。** 它只有在**節點物件的參照相同**時才跳過重建；
重建時**不會把 `measured` 疊回去**，節點於是被當成「還沒量測」而渲染成隱藏，
直到瀏覽器回報尺寸 —— 那一下就是閃爍。原本每次都重造整個節點陣列，
等於告訴 React Flow「每一個都變了」，**拖一個節點會讓全部節點每一幀重畫**。
改成逐筆快取，沒變的回傳同一個參照，有變的把量測結果疊回去。

這是 `CODEMAP.md` 既有那條 `measured` 坑的變形 —— 原本那條講的是衍生物件沒帶 `measured`，
這次是**參照不穩定導致它被丟掉**，路徑不同、結果一樣。

**按鈕位置統一**：使用者要兩張圖一致，都放頂部。任務關聯圖的兩顆按鈕從左下角的控制列
搬到頂部工具列，版面與樣式照抄系統流程圖那條；畫布用 flex 吃剩餘高度，不會算錯或跑出捲軸。

### <a id="cr-147"></a>CR-147 (2026-08-17) — 技能文件：用 API 權杖寫資料進 PMFlow

**為什麼不做成 Claude Code 的 skill 就好**：`.claude/skills/` 只有 Claude Code 讀得到，
Gemini CLI 與 Codex 看不見 —— 那正是 `AGENTS.md` 開頭警告的「換一個工具就等於沒交代過」。

**做法**：內容只有一份，放在 repo 裡（`docs/API-WRITE.md`，任何工具都讀得到）；
三個工具入口全部只是指標：`.claude/skills/pmflow-api-write/SKILL.md`、
`.gemini/commands/pmflow-api-write.toml`、以及 `AGENTS.md` 新增的「可以直接用的 Skill」一節。
那一節同時寫死一條規矩：**新增技能時三個地方一起加**，只加一個別的視窗就用不到。

**文件裡刻意寫進去的三個坑**：① 不要直接寫資料庫（排程重算、閉包表、詢問狀態、
活動紀錄與通知都在 API 層，繞過去的資料在畫面上是壞的）② 權杖的權限等於發它的人，
**還要再過 `CR-130` 的關係人判斷** —— 這會是最常見的 403 來源，所以連例外
（只填問題、登錄詢問回覆、跨人依賴）都列出來 ③ `type` 與 `priority` 是每個專案自己定義的，
不是固定清單。另外照專案規矩附上**可重複執行**的腳本骨架。

### <a id="cr-146"></a>CR-146 (2026-08-17) — 畫面文字外移到 `strings/flow.ts`

`CR-140` 與 `CR-144` 的子代理不能改共用檔，中文暫置在各自的頁面檔裡，違反
「畫面文字一律放 `strings/*`」。這一批收回去，新增 `strings/flow.ts` 切成三組：
兩頁**逐字相同**的放 `shared`（註記與標示框整套 17 個鍵），其餘各自放
`relationGraph` 與 `systemFlow`。

**只差一兩個字的沒有硬湊**（「所有卡片」vs「所有節點」、「雙擊」vs「連點兩下」、
兩份顏色名稱），各留各的 —— 硬合併會逼出一個兩邊都不對的說法。
「取消」「儲存」改用既有的 `common.*`，不再各寫一份。

**驗法**：掃兩個頁面檔的中文字元，剩下的逐行確認**全部是註解**，沒有字串字面值或
JSX 文字節點；並對 `HEAD` 做集合比對逐項歸因，確認**沒有任何一個字被改寫**
（這是搬家，不是改文案）。

### <a id="cr-145"></a>CR-145 (2026-08-17) — 移除 `COMMENTER`（可留言）角色

留言功能被「成立問題單」取代後（`CR-143`），這個角色**沒有任何一支端點拿它當下限**：
填問題與登錄詢問回覆只要 VIEWER（那是刻意的，誰收到誰登錄最快），其餘寫入都要 EDITOR。
被指派成「可留言」的人，實際權限比檢視者多零項，畫面上卻寫著可留言。

**migration `0026_drop_commenter_role.sql` 的兩個關鍵**：
① **順序不能反** —— 先 `UPDATE` 把既有成員降成 `VIEWER`，再換 CHECK 約束；
反過來舊資料會違反新約束而失敗。② **不寫死約束名稱** —— PostgreSQL 是自動命名的，
改用動態查出 `project_member` 上定義裡含 `COMMENTER` 的那個約束再處理。

**前端不必改成員頁**：三個角色下拉都是從角色標籤的鍵推導出來的，不是硬編清單，
拿掉標籤就自動同步 —— 這比在元件裡另外過濾好，不會留下兩份會走鐘的清單。

**一個只有別的部署會踩到的邊界**：migration 只降級 `project_member`，
**不會回頭改寫通知裡的 JSON**。自架站若有舊的「加入核准」通知帶著已刪除的角色，
會顯示「你的身分是 undefined」。已在 `NotificationBell.tsx` 加上退回原值的保護。

### <a id="cr-144"></a>CR-144 (2026-08-17) — 任務關聯圖：文字註記與區域標示框

跟 `CR-140` 做成一致的東西（互動、把手、顏色、標題位置照抄），兩頁長得不一樣會讓人
以為是兩套系統。

**這一頁跟系統流程圖最大的不同**：那一頁的節點是自由畫的，**這一頁的節點是真的任務**。
所以註記與標示框**完全不進節點狀態**，只在渲染階段疊上去 —— 任務那條資料流一行沒動，
也**絕對不會呼叫任何任務 API**（否則任務清單會憑空多出假任務）。

**卡片拖到標示框上不會被誤收進去**，有兩道獨立保證：一是結構上不可能（收納盒判定掃描的是
節點狀態，標示框從來不在那份資料裡）；二是拖曳結束的第一行就對註記早退。

### <a id="cr-143"></a>CR-143 (2026-08-17) — 移除任務留言

使用者說明：本來要做任務留言，後來改成「成立問題單」，所以那支端點是設計改變留下的殘骸。

**前端從來沒有實作過留言的輸入介面** —— 盤點後確認沒有輸入框、沒有 API 函式、沒有型別，
所以第一輪**一個字都沒改**就回報了（比硬找東西刪來湊數好）。只有後端端點與顯示端存在。

原本要保留顯示端以免舊資料憑空消失，**查了資料庫發現 `COMMENT` 活動是 0 筆**
（合理：輸入介面從來沒做出來，除非直接打 API 否則產不出資料），
所以連顯示端一起清掉。**沒有寫刪資料的 migration** —— 本來就沒有資料，
發一支刪空表的 migration 只會在別人的部署上多跑一次無用的異動。
`activity.kind` 的 CHECK 也**不動**（append-only，留著無害）。

驗過拿掉分支後**未知的活動種類不會崩、不會空白、不會整列消失**，一律落到「更新了欄位」。

### <a id="cr-142"></a>CR-142 (2026-08-17) — 死碼清理

**舊關聯圖 `pages/Graph.tsx`（3093 行）**：`App.tsx` 還有 `view === 'graph'` 的渲染分支，
但 `VIEWS` 陣列裡沒有它、也沒有任何地方會把 view 設成它 —— 頁籤永遠不會出現。
「任務關聯圖」這個標籤早就掛在 `SimpleGraph.tsx` 上了。連同確認為孤兒的 11 組字串一起刪，
合計 **-3326 行**。

**稽核有一條是錯的，複核時擋下來了**：稽核說 `INQUIRY_META` 會跟著死，
但它被同檔的對外詢問徽章用著，而那個徽章活在看板、清單、週檢視、成員四頁 ——
照稽核刪下去會弄壞四個畫面。改成只拿掉 `export`。同理 `chart.graph.*` 有三個鍵被
`linkText.ts` 用著（牽動任務詳情與通知文案），也保留了。
**驗到產物端**：建置後的 chunk 裡已經沒有 Graph，等於從打包結果再確認一次沒人引用。

**階層守門員（前後端共 233 行）**：`CR-127` 全數解鎖後，`checkPlacement` 無條件回 null、
`canBeUnder` 無條件回 true，但 `assertTypeHierarchy` 仍在三個地方**照跑資料庫查詢**，
永遠不可能拋錯 —— 純白工。整組拔掉，**保留**所有跟種類無關的檢查（防止掛到自己的子孫底下、
父任務同專案、沒回完的詢問不能結案、參數值必須存在），`lib/graph.ts` 一個字沒動。

### <a id="cr-141"></a>CR-141 (2026-08-17) — 拖曳關聯線轉角會誤觸發刪除

**成因（查 React Flow 原始碼確認，不是猜的）**：每條線的 `<g>` 上掛的是 **React 的 `onClick`**，
而折點把手是 `EdgeLabelRenderer` 用 `createPortal` 送出去的。
**React 的合成事件沿「元件樹」冒泡，不是沿 DOM 樹** —— 把手雖然被搬到別的 DOM 節點底下，
click 仍然一路冒回那條線。前一版「portal 出去就不會觸發」的判斷是錯的，被實測推翻。
幫兇是只在 `pointerdown` 做 `stopPropagation`，而 click 是 pointerup 之後**另外派送**的事件。

**同一條路徑上還有第二個災情**：拖把手還會**選取那條線**並**清掉目前的任務選取**，一併修掉。

擋法兩道互為備援：把手自己 `stopPropagation` 切斷冒泡；再加一個「這次有沒有拖過」的
一次性旗標，400ms 後自動解除以免卡住下一次點擊。**單純點線刪除的流程一行沒改**，
並用八種情境實跑驗過（含「拖完之後再點線仍然刪得掉」）。

### <a id="cr-140"></a>CR-140 (2026-08-17) — 系統流程圖：六件

**模組容器顯示詳細說明**：`desc` 欄位本來就存在、編輯彈窗也早就有，只是容器沒畫出來。
超長截斷、滑過看全文、沒填不佔位。

**新增文字**（無框無底色的說明字，不參與連線）、**區域標示框**（純視覺標示，
墊最底層、不吃點擊、**不建立隸屬關係**，跟模組容器是兩件事）、
**線上文字**（空的不顯示，**標籤跟著折點走** —— 各自算中點的話，拖完轉角字會飄在半空中）。

**箭頭方向**：查證後發現**不是我們的程式**。React Flow 的 `isValidHandle` 在
「從輸入接點起拉」時會自己把 source/target 對調。而且直接換回來會踩第二個坑 ——
它只有 target 端做寬鬆的接點查找，source 端沒有，硬換會讓接點查不到、線根本不渲染，
所以換邊時要同步正規化接點。

**直角線＋可拖折點**：照抄 `CR-139` 的五點模型，折點存進整份文件（沒有另開儲存位置）。
預覽線也設成直角 —— `connectionLineType` 沒設的話 React Flow 預設是貝茲，
**那跟已建立的線是兩套渲染**，只改 edge 會出現「畫好是直角、拉的時候是弧線」。

### <a id="cr-139"></a>CR-139 (2026-08-17) — 任務關聯圖：關聯線轉角可拖曳，並修掉拉線當下的貝茲預覽線

**症狀**：`CR-131` 已經把關聯線改成直角了，使用者**還是看得到弧線**。

**原因**：`connectionLineType` 從來沒設過，React Flow 的預設是 **Bezier**。
**拉線當下的預覽線與已建立的 edge 是兩套完全不同的渲染** —— 上一輪只改了 edge，
所以「線畫好之後是直角、但拉的時候是弧線」。這種一個東西兩套渲染的地方，
以後改線型要記得兩邊都看。

**轉角可拖**：內建的 `step` 不吃自訂折點，所以改成自訂 edge（`OrthogonalEdge`）自己算路徑。
模型是由單一折點驅動的五點路線 `起點 → A → 折點 → B → 終點`，
A/B 依接點是左右向還是上下向決定 —— 這個模型在四種接點組合下**都保證每一段共用 x 或 y**，
所以折點拖到哪裡都不可能變成斜線。沒拖過的線折點取中點，路線跟原本 `step` 算出來的一致。
把手視覺 10px（刻意不搶眼）、命中區 28×28（沿用卡片接點那套 `after:` 擴張），
**雙擊把手復位**回自動折點 —— 沒有這個就只能刪線重畫。

**怎麼驗的**：對檔案裡真正那支 `buildOrthogonalPath` 餵九種情境算輸出，
逐一檢查 (1) `d` 不含 `C`/`Q`/`A`/`S`/`T` 任何曲線指令 (2) 相鄰兩點必須共用 x 或 y，
九種全過。全檔已無 `smoothstep` / `bezier` / `type:'default'` 殘留，
且所有 edge 都經過 `styledEdges` 這個唯一出口，沒有繞過的路徑。
**畫面上沒驗**（Chrome 擴充未連線），拉線手感與把手觀感待使用者自己看。

**留給下一輪**：折點的讀寫已收斂成 `loadWaypoints` / `saveWaypoints` 兩支函式，
全檔只有它們碰 localStorage，要換成 `CR-138` 的 API 只需改這兩支。

### <a id="cr-138"></a>CR-138 (2026-08-17) — 持久化：圖的資料存進資料庫

**為什麼**：稽核發現**所有「圖」的東西完全沒有進資料庫** —— 卡片座標、收納盒尺寸、
收納模式、關聯線接點，以及系統流程圖與語法範例**整份使用者親手畫／寫的內容**，
全部只躺在自己那台瀏覽器的 localStorage。換電腦、清快取就沒了，
同專案的其他人也永遠看不到你排的版。而且沒有一項是「後端有 API 但前端忘了叫」——
資料庫連欄位都還沒有。

**資料形狀是混用的，不是二選一**：
- **座標／寬高／收納模式 → 正規化，每個節點一列**。理由是並行寫入：兩個人各拖各的卡片
  不會互相蓋掉；任務刪除靠外鍵級聯自動清掉孤兒排版。純 jsonb 做不到這兩件事。
- **系統流程圖／語法範例 → jsonb 整份文件**。它們的節點不是任務、結構會跟著畫面演進，
  硬拆成正規化等於把前端的資料結構複製進資料庫，前端每加一個欄位就要發一次 migration。
- **關聯線接點 → 直接加欄位在 `task_link`**。跟關聯線一對一，刪除、級聯、權限全部沿用既有那套。

`node_id` 用 `text` 不是 `uuid`：圖上還有匯合點、收納盒這些不是任務的節點；
指得回任務的另外用 `task_id` 掛外鍵拿級聯。

**權限**：讀取 VIEWER、寫入 EDITOR，**刻意不套 `CR-130` 的關係人限制** ——
排版是專案共用的，不是誰的私有財產。

**已知侷限（明講）**：jsonb 那一半沒帶 `baseUpdatedAt` 就是最後寫的蓋掉前一個人
（有帶就回 409 而不是默默覆蓋）；座標那一半沒有這個問題。
另外軟刪除不會級聯，任務救回來排版也跟著回來。

**怎麼驗的**：typecheck 通過；E2E **124/124 全過**（基準 97 ＋ 新增 27 項），
且連跑兩次都全過（重跑安全）。

### <a id="cr-137"></a>CR-137 (2026-08-17) — 測試的東西只准出現在測試環境

**規則（使用者 2026-08-17 定，已寫進 `AGENTS.md` 新增的同名章節）**：
任何測試／示範／開發方便用的東西，正式環境一律預設關閉；
關法是**改預設值**（沒設環境變數時看 `isProd`），但保留變數讓自架的人能明確打開。

**查出來最嚴重的不是示範帳號，是示範程式碼會竄改正式站的真實資料**：
- `seedBugsIfEmpty()` 每次啟動都跑、**完全不看示範資料開關**：只要庫裡沒有「錯誤」類任務，
  它就抓最前面三張**真的任務** `UPDATE` 成 `type='BUG'` 並覆寫問題描述。正式站上這是
  無法還原的資料破壞。
- `seedProblemsIfEmpty()` 同樣不看開關，照 `task.number` 全庫比對（2/4/6/7/9/20），
  把假的問題描述塞進剛好編到那些號碼的真實任務。

**其餘**：示範資料預設 `true` → 改成正式環境預設不建（那個帳號還是工作區 OWNER，
密碼公開在 README）；`/data/seed` 目錄**沒設環境變數就無條件執行裡面的任意 SQL**
→ 改成必須明確指定目錄；啟動日誌不再印密碼；dev compose 的假 OAuth 憑證改留空
（假憑證會畫出三顆按下去必定失敗的按鈕，正好違反專案自己的「沒設定就不要畫按鈕」）。

**登入頁預填帳密**先被一刀清空，使用者反映開發環境要保留方便，改成
`import.meta.env.DEV ? '示範帳號' : ''` —— 這個寫法在 `vite build` 後整個三元式會被摺疊掉，
**那組帳密根本不會出現在正式包的檔案裡**，不是「畫面不顯示但字串還躺在 JS 裡」。

**沒做、留給使用者決定的**：`docker-compose.synology.yml` 寫死的 `PMFLOW_JWT_SECRET`
公開在 public repo 上（任何照抄又沒換掉的部署，別人都能自簽權杖冒充站上任何人）；
`seed/01_demo_seed.sql` 建立的也是示範帳號。

### <a id="cr-136"></a>CR-136 (2026-08-17) — 任務關聯圖：收納盒依剩餘卡片縮小

推翻 `CR-121`／`CR-123` 的「尺寸 100% 靜態」，但**只縮不放** ——
沒有把 `CR-123` 移除的「移入自動撐大」或 `CR-122` 移除的碰撞擠開加回來。

需求尺寸走這一頁**既有的** `computeBoxDimensions`（照剩餘卡片**實際佔用的座標邊界**推，
不是照張數 —— 用張數會把手動拖遠的卡片裁掉），再取 `min(目前尺寸, 需求尺寸)`。
兩個「卡片離開原盒」的分支都要掛：拖到畫布上、以及從 A 盒改放進 B 盒（A 盒同樣算移出）。

**空盒回到 256×90**（＝這一頁一張卡片的尺寸）。原本 `computeBoxDimensions` 的下限寫死
340×280，所以光是刪掉尺寸紀錄只會退回 340×280、退不到卡片大小。

**怎麼驗的**：抽出檔案裡真正那支函式餵資料算輸出。收斂鏈：手動放大 800×600／3 張 →
340×335 → 340×280 → 空盒 **256×90**，單調遞減。手動拖遠的卡片（y=600）算出 340×710，
沒有被裁掉。**畫面上沒驗**（擴充未連線）。

**附帶影響（待使用者確認）**：沒有子任務的大項目在這一頁一律畫成收納盒，
現在會從 340×280 變成 256×90，既有畫面的觀感會變。

### <a id="cr-135"></a>CR-135 (2026-08-17) — 語法範例：MD 跑版與 Markdown 套件

**跑版的根因不是 Markdown**（舊的手刻轉換輸出第一個字元就是 `<h1>`，前面沒有空節點），
是**第三欄的標頭被文字撐成兩行**：標籤「即時預覽結果 (MARKDOWN)」比 `(WEB)`／`(SQL)`
長約 33px，而該欄實際寬度剛好卡在中間（1366px 視窗下約 324px，WEB 要 309px、
MARKDOWN 要 343px），所以只有切 MD 才換行，整塊往下推約 17px、跟左右兩欄的標頭對不齊。
修法是無條件禁止換行（右側裝飾字先被截斷），**不依賴上面那個寬度推論也成立**。

**套件選 `markdown-it`(MIT) + `highlight.js`(BSD-3)**，沒選 `react-markdown` 是因為它要拉
40 幾個轉依賴，這個只帶 5 個。授權掃描實跑通過。**XSS**：`html:false` 是預設值，
原始 HTML 一律被跳脫；`javascript:`／`data:` 連結被內建 `validateLink` 擋掉；
外連強制 `rel="noopener noreferrer"`。因此**不需要再拉消毒套件**（`dompurify` 是 MPL-2.0，
過不了授權關卡）。**首屏 bundle 完全沒變**（這頁是 lazy 分包），
highlight.js 走 `lib/core` 只 import 11 種語言，不是整包 1MB。TypeScript 語法高亮確認可用。

### <a id="cr-134"></a>CR-134 (2026-08-17) — 權限：任何人都能接管全站的那支端點

回答使用者的「所有的內容都有卡控在該專案下嗎」。掃過全部端點，
**除了下面這一支之外，其餘查詢確實都卡控在專案或工作區範圍內**；
但這一支讓任何人變成任何人，等於把全部卡控一次繞過去。

- **`POST /auth/impersonate`**：權限檢查只問「你在**任何一個**專案是不是 MANAGER」，
  沒有帶專案範圍。而產品規則是**任何人都能開專案、開的人當下就是 MANAGER** ——
  註冊完打一支建立專案就通過。`targetUserId` 完全沒有範圍限制，直接發目標帳號的權杖並
  種 refresh cookie，可以切成工作區 OWNER 拿到全站。另一條分支寫的 `'ADMINISTRATOR'`
  不是有效的角色值（實際是 `ADMIN`），所以那條**從來沒生效過**。
  改成：只認工作區 OWNER/ADMIN、只能切**同工作區**的人、
  **正式環境預設關閉**（`PMFLOW_ALLOW_IMPERSONATION`，見 `CR-137`）、切換寫進伺服器日誌。
  稽核只寫日誌沒寫資料庫，因為 `activity.task_id` 是 NOT NULL，
  這件事跟任何一張任務都無關，硬塞會污染任務的活動紀錄。
- **`GET /admin/users`**：只驗「是不是工作區成員」，同檔其他三支寫入端點都認管理者，
  只有這支漏掉 —— 任何被拉進來的人（含自動補出來的 GUEST）都能撈走整份通訊錄
  （email、狀態、角色）。改成認 ADMIN 與 OWNER 兩種；不直接用 `requireWorkspaceAdmin`
  是因為那支刻意把 OWNER 排除在外，而自架站的第一個人就是 OWNER，
  套上去會讓開站的人連自己的帳號清單都看不到。
- **父任務可以跨專案**：存在性檢查沒有帶 `project_id`，知道 UUID 就能把任務掛到別的專案
  底下，`task_closure` 會長出跨專案的列。建立、PATCH、拖曳三條路徑都補上同專案檢查。

### <a id="cr-133"></a>CR-133 (2026-08-17) — 側欄新增事件的種類顏色不一致

**根因是取錯來源，不是時序問題**：新增事件的種類初始值**寫死成 `'EPIC'`**，
但示範專案的種類只有「任務單／問題單」，根本沒有 EPIC。於是顏色查不到而掉回寫死的
琥珀橘，下拉卻因為找不到對應選項顯示第一個「任務單」（藍）——
**圓點是橘的、名字卻是任務單**，切換一次才對上。

**連帶抓到更嚴重的**：不切換直接按建立，送出的種類是 `EPIC`，
會建出一張**種類不在該專案參數裡**的任務。

改用衍生值（`useMemo`）：選到的 key 不在專案種類清單時退回清單第一個（照專案自訂順序）。
用衍生值而不是 `useEffect` 同步，所以第一次渲染就是對的，不會先畫錯色再修正。

### <a id="cr-132"></a>CR-132 (2026-08-17) — 【無效】收納盒縮放做在使用者點不到的頁面上

改動本身是對的，但**做錯檔了**。`App.tsx` 的 `VIEWS` 陣列裡**沒有 `graph` 這一項**，
也沒有任何地方會把 view 設成它 —— `Graph.tsx`（近 3000 行）的頁籤永遠不會出現。
使用者說的「任務關聯圖」實際掛的是 `SimpleGraph.tsx`。已在正確的檔重做，見 `CR-136`。

**教訓**：接手前查 `CODEMAP.md` 還不夠，**要確認那個頁面真的到得了** ——
檔案存在不等於使用者看得到。

### <a id="cr-131"></a>CR-131 (2026-08-17) — 任務關聯圖：拉不出線、線改硬 90 度

**拉不出線的主因**是 `onConnect` 裡有一道「關聯線會穿透其他卡片或收納盒就拒絕建立」的
否決：它用 6 段假想折線對每個節點做矩形相交，**密集畫布上幾乎必中**。
線畫得漂不漂亮是排版問題，不是合法性問題，拿它來拒絕建立關聯是本末倒置。已移除。
保留的三道：連到自己、收納盒內外相連、同一對卡片重複連線。

**另外移除一道前端自創的禁令**：「問題單不能建立連線」。
後端 `links.ts` 根本沒有任何種類判斷，前端自己發明一道後端沒有的禁令等於畫面在騙人；
而且專案規矩 2026-08-11 已明文把任務種類的上下關係全數解鎖，`CR-066` 也早就解除了
大項目與一般任務之間的排程依賴限制，單獨留這條跟整個方向相反。
（`handleToggleMode` 裡另一處「錯誤卡片不能切換成收納盒」與連線無關，未動。）

**手感**：8 個接點的命中區從 12px 擴到 28×28（透明擴張層，卡片尺寸與版面沒動），
吸附半徑 20 → 30。**線型**改硬 90 度（`step` + 圓角 0），用 React Flow 自己的路徑函式
實算確認轉角是零長度退化、不是圓角。

### <a id="cr-130"></a>CR-130 (2026-08-17) — 權限：非關係人不得異動別人建立的資料

**規則（使用者 2026-08-17 定）**：只有**系統管理者**（工作區 OWNER/ADMIN）、**專案建立者／管理者**、
**資料建立者本人**與**他們請假期間的代理人**可以修改資料；其他人不能異動別人建立的東西。
兩個由他拍板的細節：**負責人 (`assignee_id`) 維持可改**（他被指派做這張，改不動自己的進度說不過去）；
**「目前遇到的問題」與「登錄對外詢問回覆」誰都能填的例外保留**（誰遇到誰寫最快）。

**為什麼要改**：對照程式碼後，任務本身 (`assertCanEditTask`) 其實已經照這套走了，
真正漏的是三個地方 ——

1. **系統管理者根本不被認**。`requireTaskAccess` → `requireProjectRole` 只查 `project_member`，
   站台管理者若不是那個專案的成員，第一關就被擋成「你不是這個專案的成員」，
   後面的 MANAGER 判斷永遠走不到。等於規則裡權限最大的那個人反而動不了任何東西。
2. **關聯線沒有守門**。`links.ts` 建立與刪除只驗到專案角色 `EDITOR`，
   任何編輯者都能去接、去剪別人任務的關聯線 —— 而關聯線會直接改變排程結果。
3. **對外詢問單改／刪沒有守門**。同樣只驗 `EDITOR`，別人開的詢問單可以被改題目、
   改期望回覆日、抽回已回覆狀態甚至刪掉。這條又跟「還有詢問沒回就不能完成」連動，
   等於可以繞過那道結案限制。

**改法**：
- `requireProjectRole` 改 `LEFT JOIN` 並一併讀 `workspace_member.role`，
  工作區 OWNER/ADMIN 直接取得 `MANAGER`，**不必先被加進專案成員名單**。
  其餘人維持原本的角色聯集（含代理人取得被代理者角色）。
- `lib/auth.ts` 新增共用的 `assertTaskStakeholder()`：角色過了還要是關係人。
  放在 `auth.ts` 而不是複製到各路由，是因為這種判斷一旦有兩份就一定會分岔。
- `links.ts`（建立與刪除）與 `inquiries.ts`（PATCH / reopen / DELETE）套上它。
  **關聯線只驗發起的那一端**：第一版兩端都驗，E2E 立刻打到「Jack 從自己的任務拉一條 FS
  指向 demo 的任務」被 403 擋掉。跨人依賴（我的任務要等你的做完）是這套系統的核心用法，
  兩端都要求關係人等於把它整個關掉；而拉這條線是新增自己的一筆關聯，
  並沒有去改對方任務那一列資料。指到誰身上只需要對那張有編輯權（`requireTaskAccess` 已驗）。
  詢問單額外放行 `asked_by` 本人；`mark-replied`（登錄回覆）**刻意不套**，維持例外。
- 前端不再自己算：`GET /tasks/:id` 直接回 `canEdit` / `canDelete`，
  `TaskDrawer` 以它為準，讀不到才退回舊的角色近似判斷（相容舊後端）。
  理由是代理人是誰、有沒有被完成鎖定，前端手上沒有資料，自己猜一定跟後端對不起來。

**怎麼驗的**：`apps/api` 與 `apps/web` 兩邊 `tsc --noEmit` 皆通過；
重建 api 容器後跑 `test/e2e.sh`，**97/97 全數通過**，確認既有行為沒有被這次收緊擋掉。
順帶釐清一個一直被誤引的數字：**E2E 基準是 97 不是 107**。`CR-127` 解鎖任務種類上下關係後，
第 24 段那批「→ 400 應被拒絕」的案例已不成立而被移除（-10 項，另補 2 項），
腳本沒有 early exit、沒有被註解掉的斷言，27 個段落全部有跑。
`AGENTS.md` 與 `NEXT-SESSION.md` 裡的 107 已一併更正。
畫面上要驗的是：用非關係人的編輯者帳號開別人的任務，抽屜應該是唯讀、
不出現保存與關聯線的按鈕。

### <a id="cr-129"></a>CR-129 (2026-08-17) — 文件同步：解除 ARCHITECTURE.md / SPEC.md「過時設計稿」警語，並補回 NEXT-SESSION 落後的三批進度

**為什麼這樣改**：接手時照導引讀文件，`CODEMAP.md` 開頭與 `AGENTS.md` 啟動導引都還寫著
「`ARCHITECTURE.md` 是最早的設計稿（Spring Boot / Java / Flyway / STOMP），不要照著它找檔案」。
但那兩份文件已在 2026-08-12 改版為 v3.0.0，內容早就是實作現況（Fastify + postgres、自寫 append-only
migration、含 SimpleGraph 靶心關聯表與 RWD/PWA 第 13 章），Spring/Flyway/STOMP 字樣一個都不剩。
**警語比它警告的東西還舊**，結果是每個接手的人都被擋在唯二兩份講「為什麼這樣設計」的文件外面。

同時 `NEXT-SESSION.md` 停在 2026-08-09，落後 `CR-124`～`CR-128` 三批，接手的人會以為那些還沒做。

**改法**：警語不是直接刪掉，而是換成分工說明 —— 那兩份可以參考架構與規格，
但**找檔案一律以 `CODEMAP.md` 為準**。它們回答的是「為什麼」，不是「東西住在哪一行」，
兩者本來就不該混用；直接刪掉警語會讓下一個人又拿 SPEC 去找檔案。

**怎麼驗的**：`grep -i "spring|flyway|stomp"` 掃過兩份文件，僅剩「未來規劃」與「刻意不做」段落中
的提及（本來就該留）；比對 `CODEMAP.md` 的頁面清單與 `SPEC.md` 第 3 章功能規格，
SimpleGraph 靶心關聯表兩邊都在。純文件異動，不影響程式碼，未動 typecheck 範圍。

### <a id="cr-128"></a>CR-128 (2026-08-11) — 規格補充：於 SPEC.md 新增第 13 章行動端自適應 (RWD) 與 Mobile/PWA 平台支援規格

1. **規格補充**：應使用者詢問，確認現有規格未涵蓋行動端適應，於 `docs/SPEC.md` 補上第 13 章「行動端與自適應 (RWD / PWA / Mobile) 規格」。
2. **條款內容**：包含手持裝置 (Width < 768px) 佈局（側欄/看板/抽屜 mobile 轉換）、PWA (manifest/service worker) 以及 Capacitor 封裝 iOS/Android 平台發展方向。

### <a id="cr-127"></a>CR-127 (2026-08-11) — 任務種類上下關係：全數解鎖放行，移除階層嵌套限制並同步更新 AGENTS.md 條文與 API 測試 (e2e.sh)

1. **規則更新**：依據使用者指示，於 `D:\NewProject\AGENTS.md` 更新「任務種類的上下關係」規則，移除卡片種類限制。
2. **前後端放行**：將 `apps/api/src/lib/hierarchy.ts` 的 `checkPlacement` 與 `apps/web/src/lib/hierarchy.ts` 的 `canBeUnder` 設定為全數放行 (`return null` / `return true`)。
3. **API 測試同步**：更新 `apps/api/test/e2e.sh` 第 24 項種類測試之 HTTP 預期碼，前後端型別檢查 0 錯誤通過。

### <a id="cr-126"></a>CR-126 (2026-08-11) — 任務種類上下關係：恢復 checkPlacement / canBeUnder 守門員邏輯（BUG 只能掛 TASK 下，EPIC 只能放頂層/EPIC 下）

1. **後端守門員**：恢復 `apps/api/src/lib/hierarchy.ts` 之 `checkPlacement` 驗證，禁止孤兒 BUG 站在最上層或掛在大項目/里程碑/錯誤底下；禁止 EPIC 掛在 TASK/BUG/MILESTONE 底下。
2. **前端守門員**：同步恢復 `apps/web/src/lib/hierarchy.ts` 之 `canBeUnder` 驗證，確保 UI 下拉選單與拖曳放置規則一致。

### <a id="cr-125"></a>CR-125 (2026-08-11) — 清單視角：修復 List.tsx 缺失 DEFAULT_TYPE_COLORS 引用導致型別檢查失敗 Bug

1. **修正全域型別與常數引用**：`List.tsx` 中的 `typeColorOf` 函式使用了未定義的 `DEFAULT_TYPE_COLORS`，導致型別檢查（`npx tsc --noEmit`）失敗。
2. **匯入導出常數**：在 `List.tsx` 頂部補上 `import { DEFAULT_TYPE_COLORS } from '../components/EpicSidebar'` 與 `Ref: CR-125` 標籤，前後端驗證全數通過。

### <a id="cr-123"></a>CR-123 (2026-08-09) — 關聯圖：徹底移除卡片移入收納盒時觸發之動態拉大與尺寸重新計算邏輯 (固定 384x288)

1. **徹底移除動態尺寸擴展計算**：原佈局計算會在 `boxes` 後處置迴圈中遍歷所有子卡片座標 `maxRight` / `maxBottom` 並觸發 `size.set(bId, { w: snap48(...), h: snap48(...) })` 動態擴大收納盒。現已將該段動態擴展迴圈全數移除，直接賦予收納盒預設固定尺寸 `{ w: 384, h: 288 }`。
2. **完全排除移入時之拉大觸發**：無論何時將卡片拖移放入收納盒，收納盒尺寸皆永遠 100% 靜態固定，絕不產生任何自動拉大、放大或邊界觸發動作。

### <a id="cr-122"></a>CR-122 (2026-08-09) — 關聯圖：移除所有自動碰撞擠開與動態推移觸發，僅保留與 Menu 階層之 parentId 關聯

1. **移除碰撞擠開機制 (resolveCollisionPush)**：徹底移除 `onNodeDrag` 與 `onNodeDragStop` 中調用之碰撞排擠邏輯，確保卡片拖移時絕不會自動推移、位移或彈開週邊收納盒或其它卡片。
2. **移除移出時之連帶推移邏輯**：移除卡片拖移出框時對 `rootNodes` 進行疊加計算並改寫 `targetX` 之連帶觸發，卡片釋放於何處即靜態留存於何處。
3. **僅保留 Menu 階層關聯更新**：卡片拖移進/出收納盒時，僅執行 `updateTaskParent.mutate({ id, parentId })` 更新資料庫與左側 Menu 的階層樹狀關係，絕不觸發任何收納盒位置或尺寸推移調整。

### <a id="cr-121"></a>CR-121 (2026-08-09) — 關聯圖：修復卡片移出收納盒時收納盒縮放坍塌 Bug (保留 384x288 容器基礎尺寸)

1. **修正 measure 尺寸計算坍塌 Bug**：原 `layout` 函式中的 `measure` 在計算節點尺寸時，若 `kids.length === 0` (例如唯一子卡片被拖出框外)，會落入 `else` 分支將 node 尺寸重置為葉單元 `LEAF_W` x `LEAF_H` (264x84)。這導致移出卡片時收納盒瞬間由 384x288 坍塌縮小為 264x84。
2. **鎖定收納盒容器基礎寬高**：在 `measure` 與 `place` 邏輯中加上 `isContainerBox` 判斷，確保開啟容器模式的收納盒即使內部卡片歸零，仍永遠維持 `384` x `288` 的標準收納盒外框尺寸，徹底解決拖出卡片時框體縮放與抖動 Bug。

### <a id="cr-120"></a>CR-120 (2026-08-09) — 關聯圖：按鈕初始標籤改為「📦 卡片」，按下去轉換為「📦 收納盒」

1. **更新按鈕文字**：將 `Graph.tsx` 節點卡片預設（未開啟容器模式）時的按鈕文字修改為 `📦 卡片`；當使用者按下切換容器模式時，按鈕文字變更為 `📦 收納盒`。
2. **懸浮 Prompt 更新**：按鈕關閉時 Prompt 為「【卡片】點擊轉換為收納盒（允許其它卡片拖放進入內部）」，開啟時為「【收納盒】點擊轉換回卡片」。

### <a id="cr-119"></a>CR-119 (2026-08-09) — 關聯圖：術語面全站統一定義——事件卡片與轉換收納盒

1. **術語面名詞統一**：依據規範，關聯圖畫布上的基礎節點統稱為「**事件卡片**」；當點擊按鈕開啟容器模式時，該事件卡片即轉換為「**收納盒**」，用以收納其它事件卡片。
2. **UI 標籤與彈窗語意更新**：將 `Graph.tsx` 節點第一列按鈕文案更新為 `📦 轉收納盒`（關閉時）與 `📦 收納盒`（開啟時），Prompt 工具提示更新為「【事件卡片】點擊轉換為收納盒（允許其它事件卡片拖放進入內部）」，並同步將關閉確認 Modal 標題更新為「關閉收納盒確認」。

### <a id="cr-118"></a>CR-118 (2026-08-09) — 關聯圖：重構邊界判定與移除二次繪製尺寸動態擴展，修復卡片向右/向下無法移出收納框 Bug

1. **移除繪製階段動態擴展框體**：原 `styledNodes` 在轉換 node 屬性時會遍歷 `kids` 重新根據 `kPos.x` / `kPos.y` 加總算出的 `maxRight` / `maxBottom` 擴大 `width` / `height`。這導致卡片向右或向下拖曳時，框體寬高在渲染階段同步變大，造成 `cardRight <= bW` 永遠為 `true` 而無法脫離。現已移除該二次擴展邏輯，嚴格以佈局計算之槽位尺寸為準。
2. **重構四向邊界脫離檢測 (`onNodeDragStop`)**：邊界判定改為使用靜態槽位尺寸 `bW` / `bH`，並採計卡片實體邊界 `cardRight = relX + nodeW` 與 `cardBottom = relY + nodeH`。當卡片拖移超過 `bW - 12`（右側）或 `bH - 12`（下側）或 `relX < 12`（左側）或 `relY < 36`（上側）時，均可 100% 對稱解鎖父子關係並移出框外。

### <a id="cr-117"></a>CR-117 (2026-08-09) — 甘特圖：未定起迄日任務日期補全呈顯與覆蓋 dhtmlx 專案預設綠色條為藍紫色

1. **未設定起迄日任務條呈現**：原程式在 `!startDate || !dueDate` 時直接 `return null` 過濾拋棄，導致無起迄日的任務在甘特圖中進度條消失。現已增加基準日期預設值補全與 `no-dates` 虛線半透明樣式，確保專案中所有事件卡片皆能完整畫出甘特圖條。
2. **覆蓋 dhtmlx 預設綠色專案條**：dhtmlx-gantt 套件預設將 `type: 'project'` (主事件/大項目/父任務) 繪製為亮綠色 (`#65c16f`)。現於 `index.css` 中重構樣式，改為與 PMFlow 質感一致的深藍/靛藍配色 (`#2563eb` / `#3b82f6`)。
3. **開啟自適應滾動邊界**：於 dhtmlx 配置中開啟 `g.config.fit_tasks = true`，自動擴展時間軸視角邊界，確保跨度廣泛的任務長條皆能完整展示。

### <a id="cr-115"></a>CR-115 (2026-08-09) — 導覽：全頁籤同步連動 Menu 選取（看板與行事曆自動定位並加上亮藍外框高亮）

1. **看板視圖連動與高亮**：`Board.tsx` 加入 `focusedTaskId` 支援，當選取事件時自動捲動定位卡片 (`scrollIntoView`)，並加上亮藍色外框與深藍背景高亮 (`ring-2 ring-blue-500 bg-blue-50/90 dark:bg-blue-900/40`)。
2. **行事曆與週檢視連動**：`Calendar.tsx` 與 `Week.tsx` 加入 `focusedTaskId` 支援，選取事件時長條自動捲動置中，並加上發光外框標記 (`ring-2 ring-blue-500 scale-[1.03] z-20 shadow-lg`)。
3. **全視圖雙向連動統一**：達成清單、看板、行事曆 (月/週視角)、甘特圖與關聯圖五大頁籤全數雙向連動 Menu 事件高亮。

### <a id="cr-114"></a>CR-114 (2026-08-09) — 關聯圖：徹底排除 layout 內之 draggedOffsets 重新算大小，修復事件卡片向右/向下無法移出框外 Bug

1. **固定收納框尺寸計算**：於 `Graph.tsx` 的 `layout` 後續流程中，計算框體 `size` 時使用 `r.x - dOffset.x` 扣除即時拖曳位移量，將收納框體尺寸鎖定為成員節點的靜態槽位大小。
2. **解決動態吞噬 Bug**：當使用者向右或向下拖曳事件卡片時，框體邊界不再跟隨卡片實時擴大，卡片中心點可 100% 順暢超越框體右側與下側邊界，觸發脫離隸屬關係。

### <a id="cr-113"></a>CR-113 (2026-08-09) — 導覽：修正側欄 active 選取判定與高亮底色，確保切換 View 頁籤時 Menu 事件底色持續保留

1. **選取判定無死角修復**：將 `EpicSidebar.tsx` 內 `active` 條件改為包含 `task.id === selectedTaskId`（包含大項目/頂層事件），解決過往大項目在 `selectedTaskId` 有值時 `active` 被誤判為 `false` 導致高亮底色消失問題。
2. **藍色選取背景與文字高亮**：為選取的事件列加上柔和藍色背景底色 (`bg-blue-100/80 dark:bg-blue-900/60 ring-1 ring-blue-500/30`) 與藍色粗體文字，無論切換至哪一個視圖頁籤（關聯圖、甘特圖、清單、看板、行事曆），左側 Menu 上的事件藍底高亮 100% 完好保留！

### <a id="cr-112"></a>CR-112 (2026-08-09) — UI 對比：修復甘特圖與清單列選取時背景反白導致文字消失 Bug

1. **甘特圖選取樣式覆蓋**：於 `index.css` 為 `.gantt_row.gantt_selected` 指定明晰對比的背景底色 (`#e0f2fe`) 與文字顏色 (`#0f172a` / `#f8fafc`)，解決預設 dhtmlx 反白選取時白色文字與淺色背景撞色導致文字看不見之問題。
2. **樹狀清單選取視覺優化**：確保清單與各視圖在選取高亮時文字顏色維持極高對比與可讀性。

### <a id="cr-111"></a>CR-111 (2026-08-09) — 甘特圖：引入 rollup 彙總起迄日與 project 專案型別，將主事件/大項目完好呈現於甘特圖

1. **彙總日期避免主事件遭誤刪**：於 `Gantt.tsx` 資料對映時，改由 `rollup` 計算取得大項目與父事件之彙總起迄日 (`r?.startDate`, `r?.dueDate`)，解決主事件因自身未填獨立日期而被 `.filter()` 剔除之 Bug。
2. **層級專案條呈現**：為大項目與擁有子任務之父事件指派 dhtmlx `type: 'project'`，使 Menu 主事件正確呈現為包含子任務樹之頂層進度條。

### <a id="cr-110"></a>CR-110 (2026-08-09) — 導覽：區分點擊選取（保持視圖並連動側欄）與雙擊/鉛筆圖示（開啟編輯抽屜），解決全螢幕遮蓋問題

1. **區分單擊選取與詳細編輯**：拆分 `handleTaskSelect` 與 `handleTaskEdit`。單擊事件僅設定 `focusedTaskId` 進行視覺高亮與捲動定位（`openTask = null`），主視圖不被 `TaskDrawer` 覆蓋。
2. **樹狀清單支援雙擊編輯**：於 `List.tsx` 的 `tr` 元素加入 `onDoubleClick` 處理常式，雙擊列或點擊側欄 ✏️ 鉛筆圖示方會開啟 `TaskDrawer` 進行詳細資料編輯。

### <a id="cr-109"></a>CR-109 (2026-08-09) — 導覽：實作右側各視圖點擊事件反向連動左側 Menu（自動遞迴展開祖先層級並高亮），傳送 View 頁籤狀態

1. **右側視圖點擊反向連動左側 Menu**：於 `App.tsx` 的 `handleTaskOpen` 統一同步 `focusedTaskId`，當使用者在右側清單/看板/行事曆/甘特圖/關聯圖點擊任何事件時，左側 Menu 即時同步藍字高亮。
2. **自動遞迴展開祖先層級**：重構 `EpicSidebar.tsx` 的 `useEffect` 邏輯，當選擇任何深層子事件時，自動沿著 `parentId` 鏈條向上遞迴將所有祖先父節點寫入 `expanded` 集合，確保事件在側欄樹狀結構中 100% 完整呈現。
3. **視圖頁籤感知**：將 `view` 頁籤狀態傳入 `EpicSidebar.tsx`，達成雙向導覽同步。

### <a id="cr-108"></a>CR-108 (2026-08-09) — 導覽：實作左側 Menu 點擊事件連動目前右側頁籤（關聯圖聚焦單一事件、甘特圖/清單滾動高亮事件），獨立 ✏️ 鉛筆觸發詳細編輯

1. **左側 Menu 連動右側頁籤**：移除點擊側欄事件強制切換為「清單」視圖之舊邏輯，改為保持在右側目前開啟的頁籤視圖中。
2. **各視圖連動聚焦與定位**：
   - 當右側為「關聯圖」時，點擊 Menu 事件觸發 `focusedTaskId`，關聯圖畫布淡化非關聯節點，只聚焦該事件與脈絡（「只看該事件」）。
   - 當右側為「甘特圖」時，點擊 Menu 事件自動捲動定位並高亮該事件列 (`g.selectTask` / `g.showTask`)。
   - 當右側為「清單」時，點擊 Menu 事件自動置中捲動定位 (`scrollIntoView`) 並顯示淡藍色高亮。
3. **獨立 ✏️ 鉛筆按鈕**：將開起 `TaskDrawer` 詳細編輯抽屜之功能綁定至點擊列尾 ✏️ 鉛筆圖示，達成檢視與編輯操作之明確分工。

### <a id="cr-107"></a>CR-107 (2026-08-09) — 關聯圖：修正 layout 內 place 函式收納框計算邏輯，徹底解決卡片往右/向下拖曳時推大收納框 Bug

1. **修正 place 收納框邊界計算**：於 `Graph.tsx` 的 `layout` / `place` 函式中，區分「卡片畫布座標 (rel)」與「收納框本體尺寸計算座標 (staticPos)」。
2. **靜態槽位固定邊界**：收納框 `maxRight` 與 `maxBottom` 尺寸計算一律改由靜態網格槽位推算，不再採計拖曳過程中的動態 `draggedOffsets` 臨時座標。
3. **完美支援四向移出**：確保拖移框內卡片往右或向下移動時，收納框尺寸完全鎖定不膨脹，卡片跨越實體邊界放開後 100% 順暢移出框外脫離。

### <a id="cr-106"></a>CR-106 (2026-08-09) — 關聯圖：重構收納框脫離判定，解決事件卡片無法由右側與下側移出收納框 Bug

1. **修正型別解析與雙階段判定**：於 `Graph.tsx` 將 `onNodeDragStop` 的收納框寬高解析由 `Number()` 統一改為 `parseFloat()` 搭配數字型別判斷，並拆分為獨立二階段判定。
2. **精準卡片中心點脫離計算**：卡片中心點拖移超越右側邊界 (`relX + nodeW / 2 > bW`) 或下側邊界 (`relY + nodeH / 2 > bH`) 時，立即觸發脫離，不被其餘收納框之 48px 吸附外擴邊界二次擷取。
3. **四方向完全對稱脫離**：確保事件卡片不論向右、向下、向左、向上拖曳超越收納框邊界放開後，均能平滑脫離隸屬關係並轉為全域絕對座標卡片。

### <a id="cr-105"></a>CR-105 (2026-08-09) — 全系統：統一元件與 UI 對話框用語稱呼，將「事件框」全面更名為「事件卡片」

1. **修正對話框用語**：於 `Graph.tsx` 將關閉收納模式提示 Modal 之內文文字更名為：「收納框內尚有 X 個事件卡片，關閉收納模式將會把內部事件卡片移出至外部畫布，確定要關閉嗎？」。
2. **統一系統稱呼**：全系統統一將非收納框體之各類任務／事件單元稱為「**事件卡片**」，消除與容器收納框之用語混淆。

### <a id="cr-104"></a>CR-104 (2026-08-09) — 關聯圖：修復框內事件卡片拖曳時誤推大收納框 Bug，實現順暢拖移出框外脫離隸屬關係

1. **修正邊界計算位置**：於 `Graph.tsx` 的 `styledNodes` 調整收納框 `width` 與 `height` 邊界容納計算，由採用 `dragged` 臨時位置改為採用靜態 `k.position` 佈局位置。
2. **防止動態長大**：解決拖曳框內事件卡片向右移動時，收納框不斷隨拖曳位置動態被推大膨脹之問題。
3. **順暢拖移脫離**：卡片拖移超越收納框實體邊界放開後，能精準判定脫離並改掛為畫布全域絕對座標卡片，自動更新父子隸屬關係。

### <a id="cr-103"></a>CR-103 (2026-08-09) — 行事曆：重構 [月視角 | 週視角] 為單一層工具列最左端切換鈕，解決視角切換時介面跳動問題

1. **注入 extraHeaderLeft**：於 `Week.tsx` 擴充 `extraHeaderLeft` 屬性，使其工具列能直接接收並渲染最左側切換鈕。
2. **統一單一層工具列**：於 `Calendar.tsx` 建立共用 `modeSwitcher` 模組，將切換鈕固定於工具列第 1 個位置（銜接 `‹` 與日期區間控制項）。
3. **徹底消除跳動**：移除週視角外圍雙層工具列包覆，切換月/週視角時按鈕、標題與導覽控制完全原地靜止、不發生縱向或橫向位移。

### <a id="cr-102"></a>CR-102 (2026-08-09) — 行事曆：整合「週檢視」至頂部 [月視角 | 週視角] 切換按鈕，消除重複之全域頁籤

1. **整合週視角**：採方案 A 將原先獨立之「週檢視」整合至 `Calendar.tsx` 頂部工具列，提供 `[ 📅 月視角 | 🗓️ 週視角 ]` 切換鈕。
2. **連動 WeekView 渲染**：切換至「週視角」時直接調用 `WeekView` 組件，提供本週狀態流轉、類型分組與 7 天單日切換功能；切換至「月視角」則呈現月曆長條與請假狀態。
3. **優化頁籤欄位**：自 `App.tsx` 頂部全域 View 頁籤列中移除 duplicate 的「週檢視」頁籤，使導覽列極致俐落。

### <a id="cr-101"></a>CR-101 (2026-08-09) — 成員視圖：將未分派事件整合至「成員」頁左側選單置頂，避免頁籤重複

1. **置頂未分派項目**：在 `Members.tsx` 的成員選擇列表最上方新增「👤 **未分派事件**」置頂卡片與數量統計徽章。
2. **連動未分派面板**：點擊切換時右側渲染 `UnassignedTasks` 組件，按事件種類分組展示無負責人之任務與事件，點擊即可開啟詳情頁進行指派。
3. **優化全域頁籤欄**：不額外佔用頂部全域 View 頁籤，達成成員與指派流轉作業之極致整合。

### <a id="cr-100"></a>CR-100 (2026-08-09) — 甘特圖：移除頂部「關鍵路徑共 X 個節點」統計提示列，保持介面簡潔

1. **移除統計提示列**：依需求移除 `Gantt.tsx` 頂部原先渲染之 `sched.criticalPath.length > 0` 統計列（「關鍵路徑共 X 個節點」）。
2. **極致精簡 UI**：消除不必要的提示資訊雜訊，使甘特圖視圖更加直接、純粹與乾淨。

### <a id="cr-099"></a>CR-099 (2026-08-09) — 甘特圖：關閉拖曳改期與拉線依賴等編輯互動，設定為純唯讀展示視圖

1. **關閉拖曳與拉線權限**：將 `Gantt.tsx` 之 dhtmlx 配置設定 `readonly = true`，並將 `drag_progress`, `drag_links`, `drag_move`, `drag_resize` 全數設為 `false`。
2. **清理編輯與連線事件**：移除 `onAfterTaskDrag`（拖曳改期連動）、`onAfterLinkAdd`（端點拉線建立依賴）、`onAfterLinkDelete` / `onLinkClick` / `onLinkDblClick`（點擊連線刪除依賴），僅保留雙擊任務開啟詳情頁 (`onTaskDblClick`)。
3. **清理介面與提示**：清理連線刪除確認與失敗提示 Modal、並移除頁面上方之拖曳操作提示文字，使甘特圖專注於純資料展示與關鍵路徑瀏覽。

### <a id="cr-098"></a>CR-098 (2026-08-09) — 甘特圖：區分左右區塊滾輪行為（左側清單控制上下捲動，右側時間軸進度條控制左右捲動）

1. **區分左右滾輪區域**：於 `Gantt.tsx` 的 `handleWheel` 事件中新增 `target?.closest('.gantt_grid')` 判斷。
2. **左側清單上下捲動**：游標懸停在左側任務清單表格時，保持瀏覽器與甘特圖原生的垂直上下捲動。
3. **右側進度條左右捲動**：游標懸停在右側時間軸與進度條長條圖時，攔截滾輪事件並調用 `scrollTo` 控制 `x` 軸左右水平捲動。

### <a id="cr-097"></a>CR-097 (2026-08-09) — 全系統：重構所有原生 alert/confirm 為自訂 UI Modal 提示窗，達成設計風格 100% 統一

1. **取代原生瀏覽器彈窗**：移除全系統中殘留之 `window.alert()` 與 `window.confirm()` 瀏覽器原生對話框。
2. **對齊 UI Modal 規範**：重構為符合 PMFlow 設計規範之高質感 Modal 提示對話框（支援半透明背景模糊 `backdrop-blur`、圓角 `rounded-xl`、主題卡片背景與警告/危險圖示）。
3. **影響範圍**：涵蓋關聯圖收納關閉、甘特圖連線刪除/錯誤提示、行事曆假單刪除、專案設定項目刪除、成員管理移除、系統管理帳號處置與帳號設定解綁等全系統情境。
4. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-096"></a>CR-096 (2026-08-09) — 關聯圖：關閉收納框內部事件卡片碰撞互斥避讓機制 (`resolveCollisionPush`)，實現框內自由擺放

1. **關閉框內碰撞互斥**：於 `Graph.tsx` 的 `resolveCollisionPush` 函式開頭加上 `if (parentId !== null) return` 判定。當事件卡片處於收納框內部時，完全停用框與框之碰撞互斥擠開邏輯，允許使用者在框內任意位置自由擺放與精確排列卡片。
2. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-095"></a>CR-095 (2026-08-09) — 關聯圖：重構 BoxNodeView 與 TaskNodeView 為 justify-start，徹底解決切換收納模式時內部資訊上下位移 Bug

1. **固定內部頂部資訊列佈局**：將 `BoxNodeView` 與 `TaskNodeView` 的外層容器垂直對齊模式由 `justify-between` 改為 `justify-start`，並將第一列 (按鈕/編號/徽章)、第二列 (標題) 與第三列 (進度條) 統一打包於 `shrink-0 flex flex-col justify-start` 容器中。
2. **消解上下位移跳動**：無論點擊 `📦 收納(開)` 或 `📦 收納(關)` 改變框體高度 (96px vs 288px)，內部所有資訊列 100% 垂直固定在卡片頂部原位 (y=4px, y=28px, y=56px)，絕不發生上下伸縮或拉開彈跳。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-094"></a>CR-094 (2026-08-09) — 關聯圖：修復 getTypeColor 未優先使用自訂種類顏色 Bug，達成全系統種類色彩與名稱 100% 同步

1. **修正種類色彩覆蓋順序**：於 `Graph.tsx` 的 `getTypeColor` 函式中，優先判斷傳入之 `customColor`（來自專案設定 `types` 陣列），若存在則直接使用自訂色彩，避免硬編碼之預設 Map 蓋掉使用者設定之「大項目」或其他自訂種類顏色。
2. **新增種類名稱連動**：補齊 `typeNameMap` 與 `getTypeName(taskType, customName)`，使關聯圖中卡片上之種類名稱與顏色 100% 與側欄、詳情頁、甘特圖、看板全系統實時對齊。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-093"></a>CR-093 (2026-08-09) — 關聯圖：對齊收納框內部事件卡片相對縱向偏移量 (`y >= 60`)，修復佈局觸發時內部元素跳位 Bug

1. **對齊內部縱向偏移量**：於 `Graph.tsx` 的 `place` 函式中，統一將收納框內部事件卡片之最小縱向相對座標設定為 `y >= 60`（避開標頭區域 `BOX_HEADER`），自動補位之 Slot 亦統一對齊起點 `(x: 24, y: 60)`。
2. **消除內部卡片跳位**：徹底消解切換收納模式或拖曳卡片時內部元素在 `y=0`（遮擋標頭）與 `y=60` 之間彈跳錯位之 Bug，使框內佈局 100% 穩定對齊。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-092"></a>CR-092 (2026-08-09) — 關聯圖：實作卡片編號 (MRG) 正後方種類徽章渲染，與修復框內拖移非同步彈射消失 Bug (`parentOverrides`)

1. **MRG 後方渲染種類徽章**：於 `Graph.tsx` 的 `BoxNodeView` 與 `TaskNodeView` 中，在事件編號 (MRG-1, MRG-2...) 正後方渲染該事件之種類徽章，且文字與色彩 100% 精確對齊系統種類配色 (大項目 `#d97706`、任務 `#3178c6`、問題 `#dc2626`、里程碑 `#8b5cf6`)。
2. **修復框內拖移卡片彈射消失 Bug**：引進樂觀 UI `parentOverrides` 狀態，解鎖 API `patchTask` 非同步傳輸期間 DOM 節點 `parentId` 與座標錯位問題，並限制框內卡片相對座標邊界，消除卡片移入/移出或框內推移時彈射消失之問題。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-091"></a>CR-091 (2026-08-09) — 關聯圖：實作關閉收納模式之內部事件框檢查與彈出對話框提示移出機制

1. **關閉收納模式二次確認機制**：於 `Graph.tsx` 的 `toggleContainerMode` 補上內部事件框檢查。當點擊關閉收納模式且框內尚有事件框時，彈出確認提示訊息：「收納框內尚有 X 個事件框，關閉收納模式將會把內部事件框移出至外部畫布，確定要關閉嗎？」。
2. **安全移出內部事件**：使用者按下「確定」後才關閉收納模式並將內部事件框平滑移出至外部畫布 (`parentId = null`)；若按「取消」則保持收納模式開啓狀態。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-090"></a>CR-090 (2026-08-09) — 關聯圖：修復內含子任務卡片 isEpic 被強制作廢 Bug，與補齊圖上按 Delete 鍵刪除連線之 API 連動 (`onEdgesDelete`)

1. **修正 `isEpic` 判斷誤植**：於 `Graph.tsx` 將 `isEpic: isBox || n.type === 'EPIC'` 修正為 `isEpic: n.type === 'EPIC'`。避免任何包含子任務之卡片被舊邏輯硬性覆蓋判定為「大項目」。
2. **補齊關聯線刪除 API 觸發 (`onEdgesDelete`)**：於 `<ReactFlow>` 補上 `onEdgesDelete` 事件，選取關聯線按下 Delete 鍵時同步觸發 `DELETE /links` 徹底自資料庫移除關聯線，解決重新載入後線條復原之問題。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-089"></a>CR-089 (2026-08-09) — 關聯圖：徹底清除所有節點中殘留之「大項目」徽章標籤判定，維持介面精簡

1. **徹底移除大項目徽章**：於 `Graph.tsx` 的 `TaskNodeView` 種類徽章條件中徹底清除 `!data.isEpic` 舊有條件，將 EPIC 大項目種類之標籤徹底隱藏，不殘留任何「大項目」徽章文字。
2. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-088"></a>CR-088 (2026-08-09) — 關聯圖：修正事件框邊框顏色覆蓋問題並移除頂部大項目徽章標籤

1. **修正邊框顏色覆蓋**：於 `Graph.tsx` 之 `frameClass` 移除預設灰框樣式 `border-slate-300`，使卡片外框線精確繪製對應事件種類顏色 (大項目琥珀橘 `#d97706`、任務經典藍 `#3178c6`、問題鮮紅 `#dc2626`、里程碑紫羅蘭 `#8b5cf6`)。
2. **移除頂部大項目徽章**：依指示從 `BoxNodeView` 與 `TaskNodeView` 中移除卡片頂部之「大項目」(`G.badge.epic`) 圖像徽章標籤規則。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-087"></a>CR-087 (2026-08-09) — 關聯圖：事件框頂線與外框配色與事件種類 (EPIC/TASK/BUG/MILESTONE) 顏色全面對齊

1. **關聯圖事件框配色全系統對齊**：重構 `Graph.tsx` 之 `getTypeColor` 顏色推導邏輯，大項目 (EPIC) 對齊琥珀橘 (`#d97706`)、任務 (TASK) 對齊經典藍 (`#3178c6`)、問題 (BUG) 對齊鮮紅 (`#dc2626`)、里程碑 (MILESTONE) 對齊紫羅蘭 (`#8b5cf6`)。
2. **動態載入專案自訂種類色彩**：由 `App.tsx` 傳遞專案自訂 `types` 陣列，關聯圖自動套用使用者於系統參數所設定之自訂種類配色。
3. **E2E 測試驗證**：端對端 API 測試 `e2e.sh` 達成 107/107 項目 100% PASS。

### <a id="cr-086"></a>CR-086 (2026-08-09) — 關聯圖與側欄：修復收納框線條穿透離框、側欄種類顏色即時連動與開放 EDITOR 保存權限

1. **解鎖 React Flow `nodeExtent` 穿透限制**：於 `Graph.tsx` 設定 `nodeExtent` 為無障礙範圍，移除預設對 `parentId` 子卡片的硬性夾持，允許卡片拖移時自由穿透收納框線條脫離。
2. **側欄種類顏色即時同步**：於 `EpicSidebar.tsx` 注入完整 `typeList` 備用顏色對映，當事件切換種類 (大項目/任務/問題/里程碑) 時，側欄即時呈現對應色彩。
3. **開放 EDITOR 保存權限**：於 `TaskDrawer.tsx` 設定 `canEdit = isManager || role === 'EDITOR'`，開放編輯權限使所有問題與事件均可順暢點擊保存。
4. **API 端對端測試 100% PASS**：執行 `e2e.sh` 達成 107/107 項目全數通過驗證。

### <a id="cr-085"></a>CR-085 (2026-08-09) — 關聯圖：解鎖收納框內手動拖曳卡片位置限制，手動拖移保留精確放置座標 (僅預設移入自動依序填補 Slot)

依使用者指示區分預設移入與手動拖曳卡片之擺放邏輯：
1. **手動擺放自由解鎖 (`dragged[n.id]`)**：移除子卡片強迫壓縮進 Slot 網格限制。當使用者在框內手動拖放時，卡片保持精確手動落點 (吸附 24px/48px 網點)，且容器框自動展寬展高包覆。
2. **預設移入維持自動 Slot 補位**：無手動座標時（如剛加入之新卡片），自動依序填補空缺 Slot，兼顧自動對齊與手動自由度。

### <a id="cr-084"></a>CR-084 (2026-08-09) — 關聯圖：修復收納框內部事件卡片無法從上、下、左、右 4 邊實體邊界離框之 Bug

修復收納框內部事件卡片脫離判定邏輯：
1. **重構當前父框 4 邊幾何邊界解鎖**：對當前所隸屬之收納框，計算相對座標 `relX` 與 `relY`。只要卡片拖移超越上、下、左、右任一實體邊緣外 (含 24px 容錯邊界)，即刻解鎖脫離 (`parentId = null`)。
2. **零卡頓全向脫離體驗**：解決先前僅判定單點中心點導致向上、向下與向左拖移卡住無法離框之問題，實現上、下、左、右四周順暢脫離與定位。

### <a id="cr-083"></a>CR-083 (2026-08-09) — API 與 E2E 測試：校正端對端 API 測試檔 (e2e.sh) 與資料庫基礎連線，達成 107/107 項目 100% 全數通過

校正與修正端對端 API 測試鏈：
1. **對齊 CR-066 依賴規則變更**：更新 `e2e.sh` 第 15 區段與 26 區段測試預期，反映 CR-066 已開放 EPIC 與 Task 自由建立排程與語意依賴（201）之改動。
2. **補齊示範資料庫基礎連線**：補齊資料庫 `task_link` 示範初始連線（如 2->6、6->7、7->9 等），解決前次測試殘留之環造成推算引擎中斷問題。
3. **100% 測試全數通過**：執行 `docker run ... bash test/e2e.sh`，107 項測試指標無瑕疵全數 PASS（0 failures）。

### <a id="cr-082"></a>CR-082 (2026-08-09) — 工作規矩：修改 API 後端相關程式碼與介面時必須同步執行端對端 API 測試 (e2e.sh)

遵照使用者指示，於 `D:\NewProject\AGENTS.md` 寫入長期工作規範：
只要有修改到 `apps/api` 後端相關程式碼或 API 介面，必須同步執行端對端 API 測試 (`apps/api/test/e2e.sh`) 確認通過，確保 CI 檢查順利 passing。

### <a id="cr-081"></a>CR-081 (2026-08-09) — 關聯圖：修復事件卡片向右拖移無法離開收納框 Bug (拖曳中卡片排除動態展寬 + 當前父框釋放邊界邊緣即刻解鎖)

修復事件卡片向右拖移時框體無限右擴導致無法移出框外之 Bug：
1. **拖曳中卡片不計算自動擴框 (`if (dragged[k.id]) continue`)**：於 `styledNodes` 計算收納框動態尺寸時，排除正在被使用者拖曳之卡片位址，確保拖曳時框體維持固定邊界，不隨游標向右無限拉寬。
2. **當前父框精確邊界釋放 (`MARGIN = isCurrentParent ? 0 : 96`)**：卡片在所隸屬之收納框內拖曳時，只要游標中心超越當前父框實體邊界 (`MARGIN = 0`)，即刻判定解鎖脫離收納框 (`parentId = null`)，順暢移至畫布上。

### <a id="cr-080"></a>CR-080 (2026-08-09) — 側欄選單：收納開啟之事件框 (Container Boxes) 於 Menu 排序統一置頂並加上下方分隔線

依使用者指示優化左側邊欄 Menu 樹狀結構展現：
1. **收納開啟事件框排序統一最高 (`containerBoxes`)**：在左側選單中，凡屬於開啟收納模式之事件框 (`containerBoxSet` / `EPIC`)，一律優先排序於 Menu 頂端。
2. **底部渲染橫向分隔線**：在置頂收納框群組最下方、普通任務群組上方，渲染優雅細緻之橫向分隔線 (`border-b border-slate-200 dark:border-slate-700/60`)，明確劃分結構區塊。

### <a id="cr-079"></a>CR-079 (2026-08-09) — 關聯圖：實作收納框智慧缺位優先填補與手動佔位避讓引擎 (Smart Slot Occupancy Engine)

依使用者指示打造收納框內部動態 Slot 智慧填補與佔位邏輯：
1. **移走缺位優先填補 (`occupiedSlots`)**：當卡片移出收納框時，其留下的空格位址被標註為 Vacant Slot。下次新卡片移入時，系統自動優先將新卡片填補至該空白缺位。
2. **手動擺放佔位避讓**：若使用者在收納框內手動將卡片移動至特定 Slot，該 Slot 被標註為 Occupied；後續移入的卡片會自動避開已被佔用的位址，順延填補至下一個未被佔用的空位中。

### <a id="cr-078"></a>CR-078 (2026-08-09) — 關聯圖：修復收納框內部事件卡片移入移出留空 Bug (收納框內部統一強制使用 place 排版補位)

修復收納框內事件卡片移出時殘留空位或移入時無法向上補位之 Bug：
1. **收納框內部強制 `place()` 排版 (`styledNodes`)**：當事件卡片位於收納框內 (`n.parentId !== null`) 時，強制採用系統依 5 個/欄、24px 等距無縫計算之 `n.position`，不再受舊有手動 `dragged` 位移殘留干擾。
2. **自動順延向上緊湊補位**：卡片移出收納框時，框內剩餘卡片自動無縫向上緊密補位（絕不產生空白洞）；新卡片移入時自動填補至最新緊湊空位。

### <a id="cr-077"></a>CR-077 (2026-08-09) — 關聯圖：修復從右側移入時被排斥框體誤判瞬間彈跳至右邊之 Bug (改為相對幾何中心向量計算避讓方向)

修復從右邊移向左邊時，左邊的卡片被誤推至右邊之幾何向量 Bug：
1. **依幾何中心向量計算避讓方向 (`diffX`, `diffY`)**：計算拖曳卡片與被碰撞卡片之相對中心向量。若被碰撞卡片部位於左側 (`diffX < 0`)，則精確向左推移；部位於右側 (`diffX >= 0`) 則向右推移。
2. **徹底消除方向瞬移 Bug**：從右側向左拖曳時，左側卡片順暢向左避讓推開，絕不產生瞬間向右彈跳閃爍問題。

### <a id="cr-076"></a>CR-076 (2026-08-09) — 關聯圖：設定移動排斥避讓機制排除收納框 (!containerBoxIds.has & type !== box)

依使用者指示精確控制碰撞排斥範圍：
1. **收納框不參與碰撞排斥 (`resolveCollisionPush`)**：在碰撞自動擠開引擎中排除容器模式卡片與大項目框體 (`!containerBoxIds.has(other.id) && other.type !== 'box'`)。
2. **順暢拖入收納框**：當將事件卡片拖入或掠過收納框時，收納框保持安定原位不動，卡片可輕鬆順暢進入收納框；獨立卡片之間碰撞仍維持 100% 擠開避讓。

### <a id="cr-075"></a>CR-075 (2026-08-09) — 關聯圖：將 selected: !!selectedIds[n.id] 注入 node.data 並開放無鍵盤修飾單擊連續切換多選

修復點擊第二次或點擊多張卡片時高亮消失之問題：
1. **注入 `selected` 至 `node.data`**：將 `selected: !!selectedIds[n.id]` 完整傳送至卡片 `node.data`，使 `TaskNodeView` 與 `BoxNodeView` 的 `frameClass` 樣式函式能精確讀取選取狀態並維持藍色高亮光暈。
2. **無障礙單擊多選 (`multiSelectionKeyCode={null}`)**：設定無需按住 Ctrl/Meta 即可直接單擊切換選擇狀態（第一次點擊選取、第二次點擊取消），依序單擊每張卡片皆能完美將全部卡片選取起來並進行群組齊推拖曳。

### <a id="cr-074"></a>CR-074 (2026-08-09) — 關聯圖：修復單擊連續點選多卡片多選狀態遭預設重置之 Bug (解鎖連續單擊多選)

修復單擊第二張卡片時上一張卡片被取消選擇之 Bug：
1. **解除 React Flow 預設單選覆蓋 (`onNodesChange`)**：移除 `onNodesChange` 中 React Flow 預設對單擊取消其他卡片選擇之 `picks` 覆蓋邏輯。
2. **無縫連續單擊多選**：現在使用者依次點擊卡片 1、卡片 2、卡片 3... 皆可輕鬆保留多選狀態（皆顯示藍色光暈外框高亮），無須按住鍵盤按鍵即可流暢連續多選與帶動群組移動！

### <a id="cr-073"></a>CR-073 (2026-08-09) — 關聯圖：移除原本單擊卡片時於右上角彈出的資訊提示/聚焦窗 (Panel)

依使用者指示移除舊有單擊彈窗：
1. **移除舊有 Focus Panel 彈窗**：完整移除單擊卡片時於畫布右上角顯示的任務簡介與關聯清單提示面板（Panel），使單擊操作專注於卡片多選與群組移動，界面更加乾淨俐落。

### <a id="cr-072"></a>CR-072 (2026-08-09) — 關聯圖：設定單擊卡片切換多選 (Multi-select) 與多卡片齊移 (Group Dragging)，雙擊卡片開啟詳情頁

依使用者指示調整卡片點擊互動與多選群組移動行為：
1. **雙擊開啟詳情頁 (`onNodeDoubleClick`)**：連點兩下事件卡片開啓事件詳情頁 (`onOpen(n.id)`)；單擊不再彈出詳情頁。
2. **單擊多選切換 (`selectedIds`)**：點一下事件卡片即可切換選擇狀態（顯示藍色光暈外框高亮），支援連續單擊多選多個事件框；點擊空白畫布清空選擇。
3. **按住任一卡片齊移 (`activeGroup`)**：當選取多個事件框時，按住並拖曳其中任意一張卡片，所有被選取的事件框將以相同的位移向量與網點對齊**一起同步移動 (Group Dragging)**。

### <a id="cr-071"></a>CR-071 (2026-08-09) — 關聯圖：設定事件卡片移出收納框時，優先放置於游標放掉的精確位置 (若該位置被佔用則順延置於旁邊)

依使用者指示精確控制移出收納框放置行為：
1. **精確游標落點定位**：當將事件卡片拖出收納框並放開滑鼠 (`parentId = null`) 時，不再彈回預設預設點，而是直接放置於使用者游標釋放的畫布絕對座標（並對齊 24px/48px 網格點）。
2. **重疊自動避讓置於旁邊**：若釋放的落點位置已有最外層的其他事件框或卡片，系統自動將移出的卡片順延放置於該框體右側旁邊 (間隔 24px)，確保畫布清晰俐落無重疊。

### <a id="cr-070"></a>CR-070 (2026-08-09) — 關聯圖：實作框與框碰撞自動動態擠開機制 (依據拖曳方向向量向反方向自動推移避讓)

依使用者指示打造框體防重疊與自動動態擠開機制：
1. **拖曳向量判定 (`moveDir`)**：在拖曳過程中比對初始位置與當前位置之位移向量 (`dx`, `dy`)，精確辨識拖曳方向（從左、右、上、下何處移入）。
2. **反方向自動推移避讓 (`resolveCollisionPush`)**：當拖曳框與目標位置的既有框體發生 2D AABB 重疊時，自動將目標位置的框體順著拖曳移動的反方向向外推移避讓（並對齊 24px/48px 網點），確保畫布與收納框內「框與框 100% 絕不重疊」。

### <a id="cr-069"></a>CR-069 (2026-08-09) — 關聯圖：修復移入新卡片時現有卡片大跳動問題 (改為穩定索引排序)，並加大第 9 個卡片之 96px 吸附區域

解決移入新卡片時現有卡片位移與第 9 個卡片無法放置的問題：
1. **防跳動穩定排序 (`sortKey`)**：將 `sortKey` 由「依任務編號字母排序 (`MRG-1`, `MRG-2`...)」重構為「依任務數組原始索引 (`ids.indexOf(id)`)」，確保移入新卡片時直接順序追加於末端，既有卡片 100% 保持不動。
2. **加大第 9 個卡片等高區域吸附 (`MARGIN = 96px`)**：將 `onNodeDragStop` 中容器框的吸附與感應區域由 48px 加倍擴充至 96px，輕鬆吸附放置第 9、10 個（及後續多欄位）卡片。

### <a id="cr-068"></a>CR-068 (2026-08-09) — 關聯圖：修復收納框多欄模式下放置第 7 個（第 2 欄）事件卡片遭誤判離框解除隸屬之 Bug

修復收納框放滿 5 個卡片後，新增第 6、7 個卡片於第 2 欄時因舊判定區域寬度不足而遭排除的 Bug：
1. **即時多欄動態邊界讀取 (`bStyle?.style?.width`)**：更新 `onNodeDragStop` 判定範圍計算，優先讀取 `styledNodes` 多欄延伸後的完整寬高與邊界，確保第 2 欄、第 3 欄的子卡片完全落於收納框邊界內。
2. **48px 容錯感應區 (`MARGIN = 48`)**：為收納框放鬆 48px 的防甩脫與吸附邊界，移入/放置第 7 個（含以上）卡片時可 100% 穩定收納與隸屬。

### <a id="cr-067"></a>CR-067 (2026-08-09) — 關聯圖：調整收納框頂部標題與進度條向下安全距離 (BOX_HEADER = 96px)，避免子事件卡片太靠近進度條

依使用者指示拉開子卡片與進度條間距：
1. **頂部邊距加寬 (`BOX_HEADER = 96px`)**：將收納框標題與進度條區塊的下緣偏移量 (`BOX_HEADER`) 從 72px 調整為 96px（對齊 4 個網格點）。
2. **舒緩空間留白**：子事件卡片頂部與進度條之間釋出約 24px~32px 的充裕留白，卡片不再擁擠貼近進度條。

### <a id="cr-066"></a>CR-066 (2026-08-09) — 大項目與一般任務統一為事件層級，開放大項目與任務之間自由建立排程與語意關聯依賴

依使用者指示解鎖大項目與任務之間的關聯限制：
1. **後端 API 限制解除 (`links.ts`)**：移除 `INSERT INTO task_link` 時阻擋 `EPIC` 與一般任務關聯的類型校驗，允許大項目與任務之間建立 FS/SS/FF/SF 及語意關聯。
2. **前端關聯選擇器解鎖 (`TaskDrawer.tsx` & `Graph.tsx`)**：解鎖關聯設定抽屜中的排程類選項 restriction (`schedulingAllowed = true`)，關聯圖畫布支援在大項目框與一般任務卡片之間直接拖拉連線。

### <a id="cr-065"></a>CR-065 (2026-08-09) — 關聯圖：收納框內所有事件框與框、框與邊界間距統一調校為 24px (極致對齊)

依使用者指示統一收納框內部所有間距：
1. **橫向與縱向間距一律 24px**：將收納框內部的欄與欄間距 (`colGap`) 與卡片垂直間距 (`NODE_V_GAP`) 統一設定為 24px，與四週外邊框留白 (`BOX_PAD = 24px`) 保持 100% 完全一致。
2. **100% Dot 網點壓線吸附**：所有內部間距無縫緊扣畫布 24px 網點，佈局高度規律且整齊劃一。

### <a id="cr-064"></a>CR-064 (2026-08-09) — 關聯圖：設定收納框內部卡片單欄最多放 5 張，滿 5 張自動向右開啟第二欄/排繼續向下延伸

依使用者指示調整收納框內部多欄堆疊規則：
1. **單欄最多 5 張**：設定 `columns` 佇列容量上限，當單一欄位的垂直卡片達到 5 張時，後續加入的卡片自動向右開啟第 2 欄 (或第 3 欄) 繼續向下延伸堆疊。
2. **多欄精確維度控制**：避免收納框無限制向下長高，維持黃金比例之框體維度與極佳閱讀體驗。

### <a id="cr-063"></a>CR-063 (2026-08-09) — 關聯圖：設定事件卡片移入/加入收納框時，預設一律向下延伸垂直堆疊排列 (columns[0])

依使用者指示調整收納框內部預設排列方向：
1. **預設垂直向下延伸**：重構 `place(members)` 內部佇列指派邏輯，無關聯線的子事件加入收納框時，一律指派至第一主欄 (`columns[0]`) 垂直向下順序堆疊排列，避免向右橫向蔓延開新欄。
2. **空間自動擴充**：收納框寬度保持俐落緊湊，高度隨卡片數量向下延伸，層次清晰美觀。

### <a id="cr-062"></a>CR-062 (2026-08-09) — 關聯圖：卡片放入收納框時若空間不足自動擴大框體；拖曳移出時則保持框體尺寸固定不跟隨變更

依使用者精確指示重構收納框放進與移出行為：
1. **放入時自動擴大包覆**：當事件卡片拖入/放入收納框 (`parentId` 建立) 且位置超出框體原有尺寸時，收納框自動擴大寬高 (`maxRight`/`maxBottom`) 並點陣吸附，完美容納卡片。
2. **移出時保持框體尺寸**：拖曳卡片移出收納框時，收納框尺寸保持固定不隨拖曳游標變更或縮小。

### <a id="cr-061"></a>CR-061 (2026-08-09) — 關聯圖：移除拖曳卡片時收納框動態追蹤變大邏輯，允許事件卡片順暢拖移離框並自動排除 (parentId 清空)

依使用者指示調整拖移卡片離框行為：
1. **取消拖曳離框時收納框擴大追蹤**：移除 `styledNodes` 中依據 `dragged[k.id]` 動態拉大收納框邊界的邏輯。使使用者拖曳卡片移出收納框時，收納框邊界保持固定不追隨拉大。
2. **順暢移出與階層解除**：事件卡片拖出收納框範圍並放開後，能被 `onNodeDragStop` 順暢判定為「落於框外」，正確清空 `parentId` 並獨立移出收納框。

### <a id="cr-060"></a>CR-060 (2026-08-09) — 關聯圖：修復事件卡片於收納框內向右/向下拖曳時，收納框無即時動態擴大連動之判定 Bug (isBox)

依使用者指示修正收納框即時擴大連動邏輯：
1. **容器卡片判定擴充 (`containerBoxIds`)**：修正 `styledNodes` 中 `isBox` 之判定為 `n.type === 'box' || containerBoxIds.has(n.id)`。使開啟收納模式 (`📦 收納(開)`) 的一般任務卡片容器亦能被正確識別為容器框。
2. **即時自動擴大 (`maxRight` / `maxBottom`)**：當內部事件卡片在收納框內向右或向下拖曳觸及/超出框緣時，收納框的右界與下界會即時自動擴大並以 24px 網格倍數吸附，完美包覆內部卡片。

### <a id="cr-059"></a>CR-059 (2026-08-09) — 關聯圖：卡片外框線條顏色與事件類型/主題顏色 (accentColor) 保持完全一致

依使用者指示將事件框外框顏色與事件配色統一：
1. **事件外框配色一致化**：更新 `BoxNodeView` 與 `TaskNodeView` 的邊框渲染邏輯，在非聚焦 / 非卡住 alert 狀態下，卡片外框線條顏色 (`borderColor`) 統一切換為該事件的專屬主題顏色 (`accentColor` / `getTypeColor`)。
2. **顏色識別度提升**：大項目 (紫)、Bug (紅/粉)、任務 (天藍)、里程碑 (黃) 各具備全框同色系風格，且開關收納模式時配色 100% 完全一體化。

### <a id="cr-058"></a>CR-058 (2026-08-09) — 關聯圖：重構卡片與容器框網格吸附標準 (24px 寬 / 48px 高)，所有邊框與 Handle 接點 100% 精確壓在背景 Dot 網點上

依使用者指示重新設計卡片與容器框的尺寸網格吸附標準：
1. **常態事件卡片高寬標準化 (`288px x 96px`)**：將 `TaskNodeView` 高度顯式鎖定為 `96px`（精確跨 4 個 24px 網點，寬 288px 跨 12 個網點），使 Handle 垂直中點 `height / 2` 固定為 `48px`（精確壓在第 2 個網點橫線上）。
2. **容器框倍數吸附 (`24px 寬 / 48px 高`)**：將容器框寬度吸附為 24px 網點倍數，高度吸附為 48px 網點倍數（如 `288px`、`336px`、`384px` 等），確保容器框的 Handles 垂直中點 (`height / 2`) 亦 100% 精確壓在背景 24px Dot 網點上。

### <a id="cr-057"></a>CR-057 (2026-08-09) — 關聯圖：進度條 100% 完成時，進度條線條顏色統一切換為翡翠綠 (#10b981 / bg-emerald-500)

依使用者指示將 100% 完成之進度條線條顏色與完成徽章對齊：
1. **翡翠綠一致性**：更新 `NodeProgressBar` 工具組件，當任務 `progress === 100` 時，進度條填充線顏色由類型主色統一切換為翡翠綠 `#10b981` (`bg-emerald-500`)。
2. **視覺直觀度**：100% 完成之任務，其進度線與右側 `✓` 綠色徽章完全一體化，提高辨識度。

### <a id="cr-056"></a>CR-056 (2026-08-09) — 關聯圖：卡片與容器框手動與自動縮放尺寸對齊背景 24px 網點格子 (Math.round(size / 24) * 24)

依使用者指示將縮放調整大小連動網格網點：
1. **縮放對齊背景網點 (`24px`)**：於 `onNodesChange` 及 `styledNodes` 尺寸換算中，將手動拉伸與自動算出的框寬高一律吸附對齊 24px 網點倍數 (`Math.round(val / 24) * 24`)。
2. **視覺齊平性**：縮放後的卡片邊框落點 100% 貼合 `gap={24}` 背景 Dot 網格點，使視覺邊框與四周佈局完美整齊劃一。

### <a id="cr-055"></a>CR-055 (2026-08-09) — 關聯圖：對齊收納框內部四邊距 (BOX_PAD = 24px)，確保內部事件卡片上(對齊 Header 下緣)、下、左、右距邊邊緣完全相等

依使用者指示精確對齊收納框內部的內邊距 (Padding) 間距：
1. **正確標題列高度換算 (`BOX_HEADER = 72px`)**：精確量測與修正 `BoxNodeView` 的 Header 實際內容高度，使子任務垂直起點精確對齊 Header 下緣。
2. **四邊等距 (`BOX_PAD = 24px`)**：將內容區上、下、左、右四周內邊距統一對齊為 24px。內部事件卡片無論在自動佈局或是手動拖曳位置時，頂部 (對齊標題區底界)、底部 (對齊框下緣)、左側與右側邊距均達到 100% 水平垂直對稱與一致。

### <a id="cr-054"></a>CR-054 (2026-08-09) — 關聯圖：加入偶數像素高度強制對齊規則 (even)，全圖卡片與容器框高度均收斂為偶數，消除 0.5px 小數點對齊錯位

依使用者指示建立全圖卡片與容器框高度對齊規則：
1. **偶數高度與中點整數化 (`even`)**：新增通用工具函數 `even(v)`，強制將卡片與容器框的 `height` 收斂為偶數像素整數。
2. **消滅 0.5px 錯位**：確保所有實體 Handle 接點垂直中點 (`height / 2`) 均為無餘數之精確整數，避免奇數像素（如 97px 或 103px）造成 Handle 垂直中心出現 0.5px 渲染浮點小數點致連線對齊錯位。

### <a id="cr-053"></a>CR-053 (2026-08-09) — 關聯圖：統一卡片頂部顏色條 (getTypeColor) 與進度條元件 (NodeProgressBar)，確保收納開關切換時卡片配色與進度條 100% 一致

依使用者指示修正 `Graph.tsx` 中 `BoxNodeView` 與 `TaskNodeView` 的視覺渲染差異：
1. **頂部顏色條邊框一致化**：統一調用 `getTypeColor(data.taskType, data.color)` 繪製頂部標籤條。切換 `📦 收納(關)` / `📦 收納(開)` 模式時，卡片框的顏色與邊框 100% 保持一致，不再發生配色突變。
2. **進度條 UI 與視覺一致化**：提取獨立通用組件 `NodeProgressBar` 供兩類檢視共用。無論是否開啟收納模式，進度條之背景色、`✓` 完成標籤、`未開始 (0%)` 文字與百分比數字渲染規格完全統一。

### <a id="cr-048"></a>CR-048 (2026-08-08) — 工作規矩：再次確認多子代理並行規範並寫入 AGENTS.md

依據使用者明確指示「記起來」，更新 `D:\NewProject\AGENTS.md` 的 `## 怎麼跟他一起工作` 段落：確認只要任務可拆分且檔案權限劃分清楚，直接自動開啟多子代理進行平行處理，無須每次詢問。

### <a id="cr-047"></a>CR-047 (2026-08-08) — 對外詢問：期望回覆日改為單行不換行橫向佈局，連動 +幾天 快速選擇與動態日期計算

將對外詢問的新增與編輯欄位 `DueDateField` 重構為單行不換行 (`flex items-center gap-1.5 whitespace-nowrap`) 佈局，將預設下拉選單改為精簡之 `+1 天`、`+3 天` 等橫向格式，並與日期選擇器和星期標籤水平並排連動，選擇天數即時推算日期且不再折行撐高表格。

### <a id="cr-046"></a>CR-046 (2026-08-07) — 關聯圖：說明列補充四種排程依賴（FS/SS/FF/SF）懸停詳細語意說明

於 `Graph.tsx` 底部 `LegendBar` 常駐說明列中新增「排程依賴」專屬標籤排，顯式列出 FS（完成後開始）、SS（同時開始）、FF（同時完成）、SF（開始後完成）四種排程顏色徽章，並支援滑鼠懸停時即時彈出完整定義與流向說明，解決去重後排程依賴缺乏詳細說明的問題。

### <a id="cr-045"></a>CR-045 (2026-08-07) — 儀表板：負載熱圖左側成員/人名欄位改為橫向滾動固定 (sticky)

重構 `WorkloadHeatmap.tsx` 的 HTML 與 SVG 組合佈局，將左側成員 (NAME_W) 欄位獨立為 `sticky left-0 z-10` HTML 容器並對齊 50px 表頭與 26px 列高。當畫面或區間較寬發生橫向滾動時，左側人名欄位將固定在最左側不被捲出畫面。

### <a id="cr-044"></a>CR-044 (2026-08-07) — 系統參數：刪除任務狀態整批搬移任務時，補上含有未回覆對外詢問之擋關檢查

於 `routes/parameters.ts` 的刪除參數 API (DELETE `/projects/:id/parameters/:paramId`) 中加入檢查：當刪除任務狀態並指定 `moveTo` 轉移至 `DONE` 類別之完成狀態時，若有待轉移任務含有未回覆之對外詢問 (`AWAITING`, `PARTIAL`, `OVERDUE`)，則顯式擋下並提示使用者，防止透過刪除狀態欄位繞過「對外詢問未回覆禁止結案」之業務規則。

### <a id="cr-043"></a>CR-043 (2026-08-07) — 看板視角：拖曳失敗（如帶著未回詢問結案）時於看板頂部加入顯式錯誤提示 banner

修復看板拖曳卡片被後端規則（例如：還有對外詢問未回覆禁止結案、無權限）擋下時靜悄悄彈回原位無提示的問題。於 `Board.tsx` 的 `move` mutation `onError` 處捕捉 ApiError 訊息，並在看板視角頂部渲染紅色警告提示 Banner（支援手動點擊 ✕ 關閉與再次拖曳時自動清除）。

### <a id="cr-042"></a>CR-042 (2026-08-07) — 環境清理：刪除未追蹤的本地臨時筆記檔案「切換後驗收」確保工作區乾淨

依據使用者指示，刪除未納入版本控管的本地臨時筆記檔案 `切換後驗收`。經 `git status` 確認工作區已 100% 乾淨無殘留檔案。

### <a id="cr-041"></a>CR-041 (2026-08-07) — 版本整合：打包推送 OAuth 登入、請假代理人、成員頁面板等功能至 main

經型別檢查確認無誤後，打包推送 OAuth 第三方登入、請假代理人、成員頁面板等 37 項異動檔案至 `main` 分支。雙擊 `release-0.2.2.bat` 即可包含所有內容發版 `v0.2.2`。

### <a id="cr-040"></a>CR-040 (2026-08-07) — 發版部署：產出 v0.2.2 版號之自動 Git Tag 部署批次檔

產出 `release-0.2.2.bat` 發版批次檔，執行時自動推 main、打 Tag `v0.2.2` 並推送到 GitHub Actions 自動構建與部署至 Docker Hub/GHCR。

### <a id="cr-039"></a>CR-039 (2026-08-07) — 介面優化：在任務詳情進度輸入框右側加上 % 單位符號

在 `apps/web/src/components/TaskDrawer.tsx` 的 `ProgressField` 組件中，於數字輸入框 (`Input`) 右側顯式加上 `%` 單位符號，確保進度填寫與檢視時單位清晰無歧義。

### <a id="cr-038"></a>CR-038 (2026-08-07) — 工作規矩：任務先查 CODEMAP 分析改動檔案清單，經使用者同意後才開始動手修改

依據使用者指示更新 `D:\NewProject\AGENTS.md` 的 `## 怎麼跟他一起工作` 段落：收到任務後必須先查 `docs/CODEMAP.md` 分析並列出預計修改的程式檔案清單，經使用者確認同意後才開始修改程式碼。

### <a id="cr-037"></a>CR-037 (2026-08-07) — 長期規則：正式規範已完成任務鎖定僅專案建立者(管理者)可修改，並寫入 AGENTS.md

在 `D:\NewProject\AGENTS.md` 的 `## 產品規則` 下方寫入正式條文：已完成的任務 (`category === 'DONE'`) 鎖定，除了專案建立者/管理者 (`role === 'MANAGER'`) 以外，其餘人員一律不能修改。

### <a id="cr-036"></a>CR-036 (2026-08-07) — 長期規則：將清單視角 (List.tsx) 完整功能規範記入 AGENTS.md 與 CODEMAP.md

依據使用者「記起來」之明確命令，將清單視角 (`apps/web/src/pages/List.tsx`) 的核心功能規範（包含樹狀任務層級清單、依狀態/類型分組與收合、大項目層級展開與收起、完成狀態灰階與劃線）寫入 `D:\NewProject\AGENTS.md` 的 `### 頁面與功能對應尋找規則` 與 `docs/CODEMAP.md` 索引表中。

### <a id="cr-035"></a>CR-035 (2026-08-07) — 權限控管：實作已完成任務鎖定機制與精確修改權限限制

1. **已完成任務鎖定**：後端 `assertCanEditTask` (`routes/tasks.ts`) 與前端 `TaskDrawer.tsx` 加上狀態鎖定。當任務處於 `DONE` 完成狀態時，只有專案管理者 (MANAGER) 可進行修改。
2. **精確權限校驗**：一般未完成任務僅允許開單人 (`created_by`)、負責人 (`assignee_id`)、專案管理者及其請假期間代理人進行編輯修改，其餘成員僅可填寫問題或登錄詢問回覆。

### <a id="cr-034"></a>CR-034 (2026-08-07) — 工作規矩：更新全權授權核准所有操作與指令規範

依據使用者明確授權，更新 `D:\NewProject\AGENTS.md` 的 `## 怎麼跟他一起工作` 段落：授權 AI 自動核准與推進所有檔案修改、子代理指派、指令執行、型別檢查與 commit/push，無需每一步重複詢問。

### <a id="cr-033"></a>CR-033 (2026-08-07) — 工作規矩：任務先查索引、只改局部、回覆限制 100 字內、代碼修改單次限制 100 行內

依據使用者交代將下列長期規範寫入 `D:\NewProject\AGENTS.md` 的 `## 怎麼跟他一起工作` 段落中：
1. **先查索引**：收到任務必須先查 `docs/CODEMAP.md` 頁面清單確定需修改的對應檔案。
2. **只改局部**：程式碼替換僅修改精確區塊，不蓋過無關代碼。
3. **訊息限制 100 字**：每次回覆使用者的對話訊息控制在 **100 字以內**。
4. **代碼修改限制 100 行**：每次替換程式碼區塊上限 **100 行**，超過需拆批次分次送出。

### <a id="cr-032"></a>CR-032 (2026-08-07) — 異動紀錄與程式碼規範：加入索引編號 CR-xxx 機制，程式碼改留編號引用並搬移長註解

1. **編號索引化**：為 `docs/CHANGELOG.md` 最上方的「索引」表格與每個歷史改動條目加上唯一的**索引編號**（如 `CR-001` 至 `CR-032`）。
2. **程式碼註解搬移與清理**：清理 `Calendar.tsx`、`Week.tsx`、`Graph.tsx`、`EpicSidebar.tsx` 等前端組件中的長篇歷史背景註解，替換為精簡的編號引用（例如：`Ref: CR-002`、`Ref: CR-005`），業務背景與原因統一歸納至 `docs/CHANGELOG.md` 查詢。
3. **長期規範寫入**：依據使用者明確要求，將「每次修改紀錄製作索引編號，程式內只保留編號引用 `// Ref: CR-xxx`，詳細紀錄統一至 `CHANGELOG.md` 查閱」之規範寫入 `D:\NewProject\AGENTS.md` 的 `## 異動紀錄：在哪看、怎麼寫` 段落中。

### <a id="cr-031"></a>CR-031 (2026-08-07) — 文件與長期規則：新增頁面與功能對應清單，寫入 AGENTS.md 作為後續接手任務查頁面之長期規範

在 `docs/CODEMAP.md` 中新增「頁面與功能對應清單」索引表格（含登入、專案選擇、清單、看板、週檢視、行事曆、甘特圖、關聯圖、對外詢問看板、儀表板、專案側欄、任務抽屜、成員面板與路由中樞之完整檔案路徑與功能說明）。同時依據使用者「記起來」之明確交代，將「接手後續所有任務時，必須先查 CODEMAP.md 的頁面與功能對應清單確定對應頁面與檔案」之規則寫入 `D:\NewProject\AGENTS.md` 的 `## 介面` 段落中。

### 2026-08-06 — 行事曆與週檢視：「今天」改為專屬鮮紅小圓章（bg-red-600），與藍色「選中天」明確區分

解決行事曆與週檢視「今天 (Today)」與「選中天 (Selected Day)」樣式重疊無法辨識的問題：將「今天」的日期圓章改為專屬鮮紅底白字（`bg-red-600 font-bold text-white`）並帶有懸停「今天」提示，與選中單日/拖曳目標的藍色主題形成鮮明對比，一眼即可清晰區分。

### 2026-08-06 — 行事曆：DragOverlay 使用 createPortal 掛載至 document.body，修正下方任務拖曳位移錯位

修正行事曆 `Calendar.tsx` 拖曳任務條時移動預覽框與指標錯位問題：將 `@dnd-kit/core` 的 `DragOverlay` 改用 `createPortal` 直接掛載至 `document.body`，解除外層滾動容器 `overflow-auto` 與 `relative` 座標偏移對預覽框的干擾，確保無論滑鼠位在畫面何處（特別是螢幕下方），移動框均 100% 精準附著在滑鼠指標上。

### 2026-08-06 — 關聯圖：點與點向右連線改為 straight 平行直線模式，無折角一條線平行直通

優化 `Graph.tsx` 連接線類型：排程依賴（FS/SS/FF/SF）與匯合點（fork/join）向右延伸的連線 Edge `type` 由 `smoothstep` 圓角折線改為 `straight` 模式。當節點點對點（Source 右接點與 Target 左接點）水平對齊時，連線呈現呈 100% 直通直線平行向右穿越，絕無任何九十度迴繞或折角痕跡。

### 2026-08-06 — 週檢視：簡化工具列單日視角 UI，移除重複的「看整週」按鈕改為可點擊關閉徽章

針對工具列「這一週」與「看整週」文案重疊問題進行優化：移除獨立的「看整週」按鈕，將「只看 M/D」改為自帶 `✕` 的點擊式圓角徽章標籤，懸停提示「點擊切回全週視角」，點擊即可清除單日篩選，使工具列介面保持乾淨直覺。

### 2026-08-06 — 關聯圖：點對點水平齊平對齊，相連關聯鏈節點強制同高完全平行向右

改進 `Graph.tsx` 自動佈局的分群與 Y 座標計算：分群依據上游節點 `upstreamY` 進行排序，強制相連的關聯任務節點在 Y 軸置於相同水平位置（A 節點右接點與 B 節點左接點 Y 軸 100% 齊平），使向右延伸的連接線完全呈直線水平向右，不會出現上下斜穿落差。

### 2026-08-06 — 工作規矩：更新規則檔寫入策略，任務預設為單次任務僅紀錄於 CHANGELOG

更新 `D:\NewProject\AGENTS.md` 工作規範：使用者交代的任務預設均為「單次任務」，完成後記錄在 `docs/CHANGELOG.md` 與 `docs/NEXT-SESSION.md` 即可。只有當使用者明確交代「記起來 / 這是長期規則」時，才評估寫入 `AGENTS.md`。

### 2026-08-06 — 關聯圖：關聯鏈儘量平行向右延展，上下關聯（階層/非排程相關）才向下延展

優化關聯圖 `Graph.tsx` 自動佈局演算法 `place()`：具備排程依賴/順序關係（FS/SS/FF/SF）的任務鏈自動計算上游對齊 Y 座標，使相連任務儘量水平平行向右延伸；只有任務階層（Parent-Child 大項目與子任務）或非排程相關（RELATION）才在垂直（Y 軸）方向往下延伸。

### 2026-08-06 — 週檢視：點擊頂部日期可切換成單日視角，進行單日任務過濾與切回全週

週檢視頂部一週七天日期加入點擊互動，點擊任意日期即可切換為「單日視角」，過濾出當日正在進行的任務；工具列同步提供單日篩選徽章與「看整週」按鈕，便於彈性切換。

### 2026-08-06 — 頁籤順序：設定彈窗內的順序調整改用拖曳（dnd-kit sortable），移除箭頭按鈕

頁籤設定彈窗（`TabPrefs`）內的左右順序調整由箭頭按鈕改為拖曳排序（`dnd-kit` sortable），滑鼠拖曳 `≡` 手勢即可即時調整頂部頁籤順序，操作更直覺順手。

### 2026-08-06 — 行事曆：操作說明長字串改為懸停圖示提示，防止工具列換行

原先工具列右側直接渲染 70 個字長的 `dragHint` 說明文字，在一般視窗寬度下造成「登記請假」按鈕與說明文字擠壓換行。改為懸停圖示（`ⓘ 操作說明`）配合 `title={C.dragHint}` 浮動提示，讓工具列保持單行簡潔不換行。

### 2026-08-06 — 待辦事項清空：側欄新增子任務展開優化、關聯圖 SS/FF 繪製確認與 WEB-1 階層驗證

- **側欄新增子任務**：點擊 `＋` 時同步調用 `expand(task.id)` 展開父節點，就地輸入建立子任務，體驗更流暢。
- **關聯圖 SS/FF 繪製**：確認兩端連線有延伸任務時畫出圓點，無延伸任務（`hub === false`）時退回直條連線（走上下，帶有 MarkerEnd 箭頭與「同時起跑／同時收尾」短標籤），防止空頭圓點。
- **WEB-1 階層與批次**：透過 DB 查詢確認 WEB-1 在資料庫中型態為 `EPIC` 且站在最上層，`fix-task-levels.bat` 執行校正通過。

### 2026-08-06 — 工作規矩：加入使用者授權核准所有操作之規範

使用者交代授權核准所有操作，當場寫入 `D:\NewProject\AGENTS.md` 的「## 怎麼跟他一起工作」段落。
授權所有檔案修改、子代理指派、指令執行、型別檢查與 commit/push 自動推進完成，無需每一步重複詢問。

### 2026-08-06 — 任務詳情改成按「保存」才送出，加上刪除

原本改一格就存一次。改三個欄位就是三筆活動紀錄、三次重畫，而且**中途反悔沒有辦法收回**。
現在欄位先留在草稿裡，按「保存」才送出，旁邊有「還原」把沒存的改動丟掉。

- **只送真的動過的那幾格**，不是整份任務 —— 後端的活動紀錄才不會每次都寫上
  一整排沒變的值。
- **「目前遇到的問題」不走草稿**，維持改完就存：那一欄的權限跟其他欄位不同
  （誰遇到誰寫，不必是開任務的人），混進同一顆保存鈕的話，
  沒有編輯權的人就沒有東西可以按。負責人也一樣，它走的是轉派那條有交接說明的路。
- **保存與刪除放在標題列右邊，不放在整頁最下面**。這一頁很長（欄位、問題、
  對外詢問、關聯、活動紀錄），按鈕擺在底下的話，改完上面那排欄位還要先捲到最後。
- **刪除是兩段式**：按一次問一句、再按一次才真的刪，底下還有幾張會一起刪也講出來。
  不用瀏覽器的 `confirm` —— 那會擋住整個分頁。
- **還有對外詢問沒回時，保存鈕變灰並說明原因**（狀態下拉那幾個「做完」也是灰的，
  同一條規則的兩道）。

順手把排程模式挪回第一列：六欄格線的第一列本來就放得下五個欄位，
它排在日期後面才會被推到第三列去。

踩到一個 TypeScript 沒抓到的坑，記著：`saveBlocked` 一開始寫在 `form` 上面，
因為它是在箭頭函式裡才用到 `form`，**型別檢查全過，實際一開畫面就
`Cannot access 'form' before initialization` 整片空白**。
`tsc` 不會替你檢查暫時死區，畫面還是得自己打開看。

---

### 2026-08-06 — 標題點了才改、層級搬正、完成那幾個狀態灰掉

- **任務標題原本是一個長得像文字的輸入框**。這讓「看」跟「改」分不出來：
  想選字複製會不小心改到，真的要改的人也看不出來這裡能改。改成點一下才變輸入框。
- **標題會被截斷**。單行輸入框裝不下就往旁邊捲出去，
  「外部系統自動建立的任務（API 權杖測試）」在畫面上變成「…（API 檔」，
  而且看不出來後面還有字。改成會自己長高的多行框，不捲、不截。
- **標題只用得到畫面的一小段**：外層那一格少了 `flex-1`，寬度只有內容寬。
- **「做完了」那幾個狀態改成灰掉，不是抽掉**。整個不見的話，看的人不知道
  那些狀態跑哪去了；灰掉才看得出來「有這個選項，但現在不行」。
  說明也從欄位底下移到整排欄位上面一整行 —— 那一格只有六分之一寬，
  一句話會被擠成三、四行，把整排欄位撐開。

**修掉一條自己寫錯的規則。** 前一批寫「任務與里程碑一定要掛在大項目底下」，
照字面實作的話**子任務就整個不合法了**（示範資料的「設備清冊建立」就掛在
「需求確認與盤點」底下，畫面上到處都有「＋ 子任務」）。他要的是
「任務不要站在最上層」，不是「任務不能有子任務」。規則改成
**不能站在最上層**，掛在另一張任務底下照舊 —— 往上追一定會走到某個大項目。

新增 `fix-task-levels.bat`：把站在最上層的任務搬到大項目底下，**可以重複執行**
（第二次跑移動 0 筆）。**只搬猜得到答案的**：專案剛好只有一個大項目才搬；
沒有大項目、或有好幾個的就列出來不動。錯誤該掛在哪一張任務底下是判斷題，
一律不猜。搬完**整份重建 closure table** —— 只改 `parent_id` 不重建的話，
關聯圖與父任務的彙總會讀到過期的祖先關係。
實跑結果：MRG 搬了 7 張、closure 重建 46 列；WEB-1 因為那個專案沒有大項目，
被列出來留給他決定。

---

### 2026-08-06 — 側欄變成真的樹；錯／外／逾三顆徽章；沒回完不能結案

一連串都是同一件事的不同面向：**左邊那棵樹要說得出「這裡有什麼、卡在哪」**。

- **側欄改成遞迴的樹**。原本只畫兩層（大項目 → 直屬子項），所以掛在任務底下的
  錯誤根本不會出現 —— 而種類規則正好規定錯誤只能掛在任務底下，
  畫不出來的話，左邊看到的結構跟實際的結構是兩回事。
- **每一列前面一條種類色的細槓**。少了它，最上層的大項目跟最上層的任務
  長得一模一樣（示範資料裡就有四張），錯誤也看不出來跟兄弟任務有什麼不同。
- **三顆徽章：錯 N / 外 N / 逾 N**，各帶一個字 —— 三個純數字並排分不出誰是誰。
  收著時算整支子樹，**展開之後只算這一列自己**（底下每一列都各自標了）。
  錯誤不含自己（它本來就長得像錯誤），逾期含自己（那是狀態不是身分）。
- **「外」與「逾」不重複計算**：外＝還在等回覆的，逾＝過了期望回覆日的，
  兩個加起來才是「還沒回來的東西」。**已回覆的兩邊都不算**。
- **綠點改成打勾**。他第一次看到就問「綠色點是什麼意思」—— 需要先知道規則
  才看得懂的符號就是壞符號。

**「問題」改叫「錯誤」**（`0014`）。這一種的名字換第三次了：「缺陷」是品管行話、
「問題」跟「對外詢問」撞在一起（而且任務身上另有一個「目前遇到的問題」欄位，
講的是「現在卡在哪」，完全不同的東西）。key 一直是 `BUG`，三次都沒動過。

**還有對外詢問沒回，就不能把任務改成「做完了」那一類的狀態。**
東西還在外面沒回來，這件事就沒有結束 —— 先結案只會讓那筆詢問變成沒有人在追的
孤兒：任務從清單上消失了，而外面那個單位還在等我們的人催。
已回覆的不算（不然問過一次就永遠結不了案），只看這張任務自己的（子任務各自會被
同一條規則擋住）。後端在改狀態與拖曳兩處擋，前端則是**不畫出那幾個選項並說明原因**
—— 選項無故消失比按了被拒絕更難懂。側欄那兩顆徽章就是這條規則的儀表板：
**兩顆都不見了才結得了案**。

**任務與里程碑一定要掛在大項目底下**（種類規則再加一條）。最上層只放得下大項目，
一張任務站在側欄第一層會被讀成一個大項目。**示範資料本來就違反這一條**
（MRG-9 到 MRG-14 都在最上層），照既有政策：讀取照舊，只擋新的異動。

**任務詳情的版面**：格線從四欄改成六欄 —— 四欄的話進度與日期各佔兩欄就把第二列
填滿，排程模式被擠到第三列自己一個人站著，看起來像後來補上去的東西。
進度的拖拉條改成**十格**（一格 10），加上刻度：40% 跟 45% 在畫面上分不出來，
而進度本來就是概數。標題列上的對外詢問改成帶數字（「外 1」「逾 2」），
全部回來了才講一句「對外詢問都回覆了」—— 一張任務可以同時問好幾個單位，
沒有數字就看不出來還剩一件還是五件。

順手拿掉標題列的「✕ 看全部」：旁邊的專案名稱按下去就是同一件事。

---

### 2026-08-05 — 側欄的數字：展開之後換到任務上；清示範垃圾的批次

- **兩顆徽章都帶一個字**：「問 2」「逾 1」。兩個純數字並排看不出誰是誰。
- **大項目一展開，它自己的徽章就不畫了**，數字換到底下每一列上。
  上面留總數、下面又各自標一次的話，同一個畫面有兩層數字在互相解釋，
  看的人得自己算「這 2 是不是就是下面那 1 加 1」。
- 為了讓展開前後加得起來，任務列的問題數改成**含自己**：像「採購與到貨」
  這種本身就是問題的直屬子任務，不含自己的話展開後一個數字都沒有。
- **逾期也改成整支子樹的計數**（原本只看那一列自己）。側欄只畫得出直屬子項，
  孫層沒有自己的列 —— 只看自己的話，掛在孫層的那筆逾期會在展開時整個消失，
  **展開反而比收著看得少**。示範資料剛好就是這樣（逾期的是孫層的「網路架構確認」）。

另外新增 `clean-demo-junk.bat`：把點來點去留下的測試任務（`111`、`31321` 那些）
軟刪除掉。**可以重複執行** —— 已經刪掉的會跳過，第二次跑回報 0 筆。
它也拒絕碰任何有關聯線、有對外詢問、或有留言的任務；
**欄位異動不算「有人用過」**，改個狀態或種類正是垃圾任務會遇到的事。
MRG-13／MRG-14 看起來像重複但身上有關聯線，刪了會弄壞示範的關聯圖，所以留著。

---

### 2026-08-05 — 側欄標出底下有幾張問題

側欄本來只標「對外詢問逾期」幾件，現在多一個「問 N」——
**問題是「這裡有多少事情壞了」，逾期是「有多少事情在等外面」**，
兩件事分開標，不要合成一個數字。

算的是**整棵子樹、而且不含自己**：

- 收著的大項目看到的是整包的總數；展開之後每張任務各自顯示自己底下的。
  只看直屬子任務的話，收合前後兩個數字會對不上。
- 不含自己是刻意的 —— 一張問題身上已經掛著「問題」的種類徽章，
  旁邊再標一個「1」只會讓人以為它底下還有東西。

徽章上寫「問 N」不只寫數字：旁邊還有一個逾期的數字，兩個純數字擺在一起分不出誰是誰。
完整的說法（「底下有 N 張問題」）留給游標停著時的提示。

---

### 2026-08-05 — 「發文追蹤」改叫「對外詢問」

「發文」現在最常被讀成「發布文章」，而這裡講的是公文那個發文 ——
名字擋在功能前面，看的人得先翻譯一次。改成「對外詢問」：
同時說了對象（外面的單位）與動作（問），而且跟裡面既有的用詞不打架，
「單位」「期望回覆日」「登錄回覆」一個都不用動。

順手把首頁那句也講清楚。專案卡片原本寫「1 件逾期未回」—— **沒說是什麼東西逾期**。
專案標題列的「1 張任務有單位逾期未回」與側欄的「單位逾期未回」同樣的毛病，
一律改成「對外詢問逾期」。

純文案，沒有動任何邏輯與資料。`inquiry` 這個程式裡的名字（端點、型別、
queryKey）刻意不改：那是資料的名字，跟畫面上的說法本來就不必一致，
改了只會製造一次沒有價值的大範圍改動。

---

### 2026-08-05 — 任務種類的順序改成「大項目 → 任務 → 問題 → 里程碑」

原本是「任務 → 里程碑 → 問題 → 大項目」，那是當初照 `CHECK` 裡的字面順序抄下來的，
沒有想過。新的順序跟種類的上下關係同一個方向：大項目裝著任務、問題掛在任務底下，
由大到小讀下來；里程碑排最後 —— 它不在這條包含鏈上，是插在時間軸上的一個點。

他是在看週檢視「依類型分組」時提的，但**沒有做成週檢視專屬的排法**：
順序是系統參數頁那份清單決定的（所有種類下拉、分組的先後都照它），
只改一個畫面會跟其他下拉對不起來，而且那頁明明寫著順序可以自己拖。

`0013` 只換「四種都還停在原本預設 rank」的專案 —— 有人可能已經自己拖成他要的
樣子了，那是使用者的東西。「四個 rank 剛好等於 1000/2000/3000/4000 且各自對應
原本那個 key」就是「沒有人動過」的證據。少了這個條件，這支 migration 會把每個人
排好的順序洗掉一次，而且他不會知道發生了什麼事。專案自己新增的種類不動
（它們的 rank 本來就大於 4000，相對順序不變）。

---

### 2026-08-05 — 任務種類決定它能掛在誰底下；大項目與任務之間沒有先後

兩條新規則（他 2026-08-05 定的，原文與理由寫在 `D:\NewProject\AGENTS.md`）。
種類本來只是個標籤，現在它決定這張任務**放得進哪裡**。

- **大項目一定在任務上面**：只能放最上層，或掛在另一個大項目底下。
- **問題只能在任務下面**：上層一定要是任務，也不能自己放在最上層。
- 任務與里程碑不受限制；**專案自己新增的種類完全不受限制**。
- **排程依賴不能跨在大項目與任務之間**。它們是包含關係不是先後關係 ——
  大項目的日期本來就是底下那些任務彙總出來的，再拉一條依賴等於叫排程引擎
  同時聽兩個互相矛盾的來源。大項目對大項目、任務對任務都照舊；
  「相關」這種不影響排程的不受限制。

判斷集中在 `lib/hierarchy.ts`，前後端各一份、規則一致：**後端是守門員**
（`routes/tasks.ts` 的建立／改任務／拖曳，加上「改種類會不會害到既有子任務」），
**前端只負責不要把不合法的選項畫出來**。分四個地方各寫一次一定會有一份漏掉。

三件容易忽略、但一定要這樣做的事：

- **既有資料可能已經違反**（規則是後來才定的，示範資料裡 MRG-5 就是「問題」
  掛在大項目底下）。讀取一律照舊顯示，不藏也不報錯 —— 藏起來只會讓人以為資料掉了。
  **而且只在這次異動真的動到種類或上層時才檢查**：本來就不合法的任務，
  改個標題、換個負責人一樣要放行，否則那張任務會變成誰都動不了。
- **下拉一定要留著目前這個值**，即使它不合法。拿掉的話畫面顯示空白，
  然後他一存檔就把種類靜悄悄換成別的 —— 那比顯示一個不合規的值糟得多。
- **整批改種類那條路要另外堵**：刪掉一種任務種類時的「那些任務改成哪一種」
  一次改幾十張，逐張擋的規則在那裡完全繞得過去（`countIllegalAfterRetype`）。
  擋下來時要講出有幾張會放錯，只說「不行」的話他得自己一張一張猜。

畫面上：新增任務的種類下拉只列得出放得進去的種類（在大項目底下就沒有「問題」，
在任務底下就沒有「大項目」）；任務詳情的種類下拉同時看上層與子任務；
關聯的類型下拉在一邊是大項目、另一邊不是的時候，**整組排程選項不畫**，
並在底下寫明原因 —— 少了一整組選項不解釋的話，看起來就只是壞掉。

---

### 2026-08-05 — 從通知點進來的那張任務，閃紅框

通知本來就講得出是哪一張（`MRG-4 網路架構確認` 加一句話），點下去也會直接開，
但那一下畫面上換掉太多東西 —— 可能換專案、換頁籤、再開抽屜 —— 眼睛不知道該看哪裡。
現在那張任務會閃三下紅框。

三個實作上的決定：

- **閃三下就停**。一直動的東西會變成永久的干擾，而且看久了會被讀成
  「這張出事了」的**狀態**，不是「剛剛被指到」的**事件**。
- **用 `box-shadow` 不用 `border` / `outline`**：border 會把元素撐大一圈、
  把裡面的版面推歪；outline 在圓角上不跟著圓。
- **而且是 `inset`**。任務詳情是貼著父層邊緣鋪滿的，父層又是 `overflow-hidden`，
  畫在外面的框會整圈被裁掉，等於白閃。
- 尊重 `prefers-reduced-motion`：關掉閃爍，但**紅框留著** ——
  不然那些人就完全看不到是哪一張。

狀態存的是任務 id 不是布林值：連點兩則不同通知時，第二則要能重新觸發。

**紅框不會自己消失**（他 2026-08-05 要求）：閃三下之後留著一圈靜止的紅框，
要等他真的在那張任務上動一下（點、按鍵、或關掉）才收 —— 人不見得正看著螢幕，
閃完就退場等於沒發生過。做法是把靜止的框寫成 class 本身的 `box-shadow`，
動畫只在跑的時候蓋過它；動畫結束屬性自己退回 class 的值。
**不要用 `animation-fill-mode: forwards`** —— 那會停在最後一個 keyframe，
也就是透明，剛好相反。

---

### 2026-08-05 — 專案代碼可以改

專案代碼就是任務編號的前綴（`MRG-2` 的 MRG）。原本**後端不收、畫面也沒入口**，
開專案時打錯就再也改不掉。

- `PATCH /projects/:id` 收 `key`，驗證沿用建立專案時**同一份 schema**，不另抄一份會走鐘的正則。
- **同工作區內不可重複**，撞號回 400 problem+json 講清楚是代碼重複，
  不讓 Postgres 的 unique 例外原封不動噴出去。
- **不需要回填任何資料**：任務編號沒有存成欄位，是查詢時 `p.key || '-' || t.number`
  拼出來的，所以改完舊任務的編號立刻跟著換，不會有新舊不一致。這是刻意的設計。
- 畫面放在「專案系統參數」頁最上面，只有管理者看得到。輸入自動轉大寫、
  格式不合當場擋下不送出。**警語放在按鈕正下方**，不是塞進 tooltip ——
  所有任務編號都會變，他必須在按下去之前看到。
- 成功後 `['projects']`、`['project', id]`、`['tasks', id]` 都要重抓：
  清單裡的編號是拼好的字串，不重抓會留著舊前綴。

順手把預設的任務種類「缺陷」改名成「問題」（migration `0012`）——
「缺陷」看不懂。**只在 `key='BUG' AND name='缺陷'` 時更新**：有人可能已經自己改成
別的名字了，那是使用者的東西，不可以覆蓋。`key` 維持 `BUG` 不動（任務靠它指回來）。

---

### 2026-08-05 — 任務種類：改名叫「問題」、徽章用自己的顏色、新增時就能選

- **徽章寫死成紫色，把種類的顏色吃掉了**。四種種類本來各有顏色
  （任務藍、里程碑紫、問題紅、大項目橘，存在 `task_type.color`），
  但清單與任務詳情的徽章都寫死 `bg-violet-*`，畫面上四種長得一模一樣。
  改成畫左邊那條細槓用各自的顏色 —— **只當細槓，不當底色也不當文字色**：
  顏色是使用者自己挑的，深淺不受控，拿去當底色在深色模式下會有一半讀不到。
  三個畫面（清單、任務詳情、週檢視）現在是同一種畫法。
- **新增任務時就能選種類**。原本一律開成「任務」，開完再進詳情改一次 ——
  在清單上連開五張的時候那等於五趟來回。選過的種類留著不重設：
  要連開三張問題的人不必每一張都再選一次。
- **「新增」與「取消」畫成真的按鈕**。原本兩顆都是裸文字，夾在一排輸入框旁邊
  看起來像說明文字，沒有人知道那可以按。
- **那一行的提示被折成兩截**（中文可以在任何兩個字之間斷行），移到自己一行。

---

### 2026-08-05 — 任務頁面：種類可以改，進度給拖拉條，兩個日期並排

- **任務種類改不了**。抽屜裡它只是標題旁邊一個唯讀徽章，狀態、負責人、優先級、
  日期、進度都能改，就它不行 —— 後端 `PATCH /tasks/:id` 本來就收 `type`
  （而且會用 `assertParamKey` 驗），純粹是畫面沒給入口。要改種類得跑去系統參數頁，
  但那頁改的是「這個專案有哪幾種」，不是「這一張是哪一種」，兩件事完全不同。
  補成下拉，選項就是專案自己那份 `task_type`。
  文案叫**「任務種類」**不叫「類型」—— 關聯那邊已經有一個「關聯類型」，
  兩個都叫類型會分不出來。
- **開始日與結束日被切到兩列去**。七個欄位塞進四欄的格子裡，剛好從中間斷開，
  而那兩個是一起看的。改成放在同一格裡並排，中間一個破折號，標題也合成一個。
- **進度往上移，並且給拖拉條**。回報進度時先看的是「做到哪了」，不是「哪天開始的」。
  拖拉條 + 數字兩種都能改（拖拉條快，鍵盤準，只給一種一定有人不順手），
  進度佔兩欄 —— 拖拉條擠在四分之一欄寬裡拖不準。
  **拖的過程不送出**，放開才存：一路拖過去每格都打一次 PATCH 的話，
  一次拖曳會發出上百個請求，而且回來的順序不保證，畫面會跳。

驗的時候踩到一個自己造的坑，記著：`components/ui.tsx` 的 `<Input>` 自帶 `w-full`，
在外面再寫 `w-16` 是同一個 specificity，誰贏看 CSS 的順序 —— 實際上 `w-full` 贏，
數字框會把拖拉條整條擠成 0 寬。**寬度要掛在外層的 div 上，不要掛在 `<Input>` 上。**
（0 寬的拖拉條還很危險：點到它就等於拖到最左，會靜悄悄把進度寫成 0。）

---

### 2026-08-05 — 清單捲不動，下面那幾張任務看不到

清單的最外層是 `<div className="overflow-auto p-4">`，**沒有給高度**。
上層（`App.tsx`）是 `min-h-0 flex-1 overflow-hidden`，所以這一層會長到內容的高度
再被上層裁掉 —— `overflow-auto` 因為自己沒有超出自己，捲軸從來不會出現。
任務少的時候剛好塞得下所以沒人發現，一超過一個畫面，下面那幾張就整批看不到、
而且捲不到。加 `h-full` 就好。

其他視圖沒有這個問題，因為它們是 `flex h-full flex-col` 外層 +
`min-h-0 flex-1 overflow-auto` 內層那一套；清單沒有要固定的工具列，直接 `h-full`。

---

### 2026-08-05 — 週檢視：分組可以收合，也可以改成依類型分

兩件事一起做，因為它們共用同一個分組機制。

- **狀態分組可以收合**。整條標題列都可以按（不是只有那個三角形 —— 要按中一個
  12px 的三角是件很煩的事），另外有「全部收合／全部展開」。
  收合狀態存在這台裝置上（`lib/remember.ts`，跟行事曆的勾選同一套），
  鍵帶專案 id：狀態是每個專案自己一份，不分專案會互相蓋掉。
  **存的是「收合」而不是「展開」的清單** —— 反過來存的話，專案之後新增的狀態
  一出現就是收著的，而沒有人會想到要去展開一個自己剛剛才建出來的東西。
- **收起來的組，逾期張數要留在標題上**。收合是「我現在不看細節」，
  不是「這些事可以不管」。
- **可以改成依類型分組**（任務／問題／大項目…用專案自己在系統參數頁設的那份清單）。
  依狀態回答「這禮拜卡在哪一關」，依類型回答「這禮拜是在做事，還是在處理問題」——
  一週裡問題佔了半數的話，那件事光看狀態分組是看不出來的。
  分組方式也記得住，理由跟收合一樣。
  **兩種分組的收合偏好分開存**（鍵前面加 `status:` / `type:`）：
  共用一份的話，換個分組方式會收起一堆莫名其妙的組。
- 每一列補上**類型徽章**。看板與清單本來就有，週檢視沒有的話，
  同一張任務在三個畫面長得不一樣。類型色是使用者自己挑的，只當左邊那條細槓，
  不當底色也不當文字色 —— 深淺不受控，拿去當底色在深色模式下會有一半讀不到。

---

### 2026-08-05 — 儀表板：燃盡圖與負載熱圖

M4 的最後一項。新增一個「儀表板」頁籤，兩張圖都是**自己刻的 inline SVG，沒有加任何
相依套件**（圖表庫與 `elkjs` 一樣過不了 CI 的授權白名單）。

**先補活動紀錄的洞 —— 這是燃盡圖的前提。**

動工前查過，`activity` 根本沒辦法回推狀態歷史：`PATCH /tasks/:id` 只寫新的
`statusKey`、**沒有寫舊值**；`CREATED` 的 body 只有標題，查不到初始狀態；
最嚴重的是 **`POST /tasks/:id/move`（看板拖曳）完全不寫活動紀錄** ——
而那正是大家改狀態最常用的方式。當時整個示範資料庫裡帶 `statusKey` 的
`FIELD_CHANGE` 只有一筆。三處都補上了（沿用 `FIELD_CHANGE`，不新增 kind ——
`activity.kind` 帶 CHECK 約束，多一種就要動 migration）：建立時記下初始狀態、
改狀態時多寫 `statusKeyBefore`、拖曳換欄寫一筆。純粹改排序或改父層仍然不寫，
每拖一次都留一筆會把真正的狀態變更淹掉。

**燃盡圖**（`lib/burndown.ts`）是拿活動紀錄**正向重播**出來的，不是每天存一筆存下來的
（系統沒有背景排程器，沒有人半夜幫忙照相）。舊資料一定有洞，作法是：
查不到「進入完成」那一筆時退回用 `updated_at` 估，並且**在畫面上誠實講出來**
有幾張是估的（`estimatedCount`）。那句話不可以省略也不可以做成能關掉的 ——
看的人有權知道哪幾張是猜的，不然他會拿估出來的線去跟人吵架。
往後改的狀態都會留下紀錄，這個數字會自己變少。

理想線有兩個刻意的決定：**第一張任務出現之前一律水平**，不從區間的第一天就開始降
（區間常常從專案起始日算起，而事情是後來才開進系統的；從第一天就降的話，
那幾天的參考線會說「你已經該做完 1 張了」，但那時候一張任務都還沒有，
那句話沒有對象）；**中途才追加的事不併進參考線** —— 參考線要能被超出，
跟著實際範圍一起長高的話，永遠不會顯示落後。總量另外畫一條線，
中途加事情會讓它往上跳，那正是要看見的。

**負載熱圖**一列一個人、一欄一天。三件事是它存在的理由：超載的格子**除了紅色再加
一個右上角的小三角**（紅色對紅綠色盲來說跟深藍分不開）；請假用**斜線紋理**不是換顏色
（顏色的位置已經被「量」佔走了）；**「沒有指定負責人」那一列照樣要畫**——
那些事不畫出來就會整批消失在圖外，而那正是最容易漏掉的一堆事。
工時是拿預估時數平均攤在任務的工作日上，沒填時數的算一張、不進工時。

兩張圖共用一個計算單位（張數／工時）—— 同一個畫面上兩張圖用不同單位，
看的人一定會把它們讀成同一件事。兩張圖都有「改看表格」，色盲與螢幕閱讀器靠它。
配色跑過色盲驗證器：淺色 `#2563eb` / `#d97706`、深色 `#3b82f6` / `#d97706`，全數通過。

驗證時當場修掉的三個：
- **熱圖的合計與最高一天被擠出畫面**。格子寫死 26px 的話四週就有 1034px 寬，
  一般視窗放不下，而被擠掉的正好是整張圖的結論。改成依容器算格寬（14–26px），
  窄到底還放不下才左右捲。
- **熱圖每一格的提示框都看不到**。`overflow-x-auto` 會把 y 軸一起變成 auto
  （CSS 規定其中一軸不是 visible，另一軸就不能是 visible），格子只有 26px 高，
  提示框一定比容器高、一定被裁掉。改成放到捲動容器外面，自己扣掉 `scrollLeft`。
- 理想線那兩件事（見上）。

**逾期提醒信刻意沒做** —— 系統目前沒有寄信的能力，寄信管道要先問過再決定。

---

### 2026-08-05 — 清單擠成一直條、框選不起來、圓點抓不到

上一批「待驗證」的東西真的拿滑鼠去操作，抓到三件事。前一件是使用者自己看到的。

- **清單的任務名稱被擠成一個字一行**。那一欄裡是一排 flex 子元素（類型徽章、
  任務代號、標題、問題標記、＋子任務），只有徽章與按鈕寫了 `shrink-0`，
  中文又可以在任何兩個字之間斷行，所以壓縮全部落在代號與標題上：
  標題只剩 56px、一個字一行。改成 `table-fixed` 固定欄寬＋標題 `truncate`，
  代號 `whitespace-nowrap`；表頭也 `whitespace-nowrap`，「發文追蹤」不再折成兩行。
  `InquiryBadge` 一併加上 `whitespace-nowrap`（看板與週檢視共用同一顆）。
  視窗真的太窄時整張表左右捲（`min-w-[58rem]`），不再壓縮欄位。
- **大項目的框根本選不起來，所以拉大小從來沒有生效過**。節點是每次 render
  由 `useMemo` 重算的，而 `onNodesChange` 只收 `position` 與 `dimensions` ——
  React Flow 送來的 `select` 變更被丟掉，我們又把沒有 `selected` 的新陣列送回去，
  等於每一次 render 都把「選了誰」清乾淨。`NodeResizer` 的 `isVisible={!!selected}`
  因此永遠是 false，四角的把手一次都沒出現過。改成自己記 `selectedIds`
  （跟 `dragged`、`resized`、`measured` 同一套路）再疊回節點上。
- **匯合點雖然拖得動，但抓不到**。圓點只有 10px，全景時剩三四個像素；
  而且它的 z-index 是 0，大項目的框是 1000，圓點落在框上就被蓋住。
  往外墊一圈看不見的抓取範圍（`-inset-2`）、z-index 提到 1400。

**驗證**：這三件都在畫面上做過 —— 清單十五列各自一行、框選起來會出現八個把手
且拉得動（368→439px）、匯合點拖得動而且線跟著走、按「重新排列」全部歸位。
順手也驗掉系統參數頁的拖曳排序（拖完重新整理仍在，看板欄位順序跟著換）
與 ↑／↓ 一格一格移。

### 2026-08-05 — 關聯圖：框可以拉、匯合點可以拖、相關類走上下

使用者一次提了五件，都在這一張圖上。

- **大項目的框可以拉大小**：`NodeResizer`，把手只在框被選起來時出現（常駐的話
  每個框四角各四顆點，圖會太吵）。改過的尺寸記進 `resized`，跟 `dragged` 同一套：
  只存被動過的那幾個，其餘照佈局算。**關鍵細節**：`onNodesChange` 原本把所有
  `dimensions` 變更都收進 `measured`，會把使用者拉的大小抹掉；React Flow 對
  「使用者拉的」會帶 `resizing` 欄位，用它把兩者分流。
- **匯合點可以拖了**：它本來是整張圖唯一寫死 `draggable: false` 的節點。
  `selectable`／`connectable` 維持 false —— 它不是任務，不能從它拉線。
- **「語意關聯」改叫「任務相關」，而且改走上下**：排程依賴有先後所以左進右出；
  相關類**沒有先後**，畫成左右會被讀成「先做這個再做那個」。節點多了上下兩個
  handle，`isValidConnection` 保證選了相關類就拉不出左右線。
- **說明列不再自己重複自己**：線那一排整排拿掉 —— 每條邊上本來就掛著同樣那幾個字。
  「同時開始／同時完成」原本在線那排（圓點）與圖示那排（徽章）各出現一次，
  合併成一項，說明一次講完兩個長相。原則是**同一件事只在一個地方說明**。
- **不會再把你放大看的地方拉回全景**：真因是自動 fitView 的 effect 裡有一行
  `userAdjusted.current = false`，每次節點集合變動都會執行 —— 背景重抓資料、
  換篩選、建立關聯之後重新佈局，都等於「他沒動過視角」。改成換專案才重置，
  按「全部顯示」「重新排列」也重置（那是他自己要的）。
- 順帶修掉一個一直都在的 bug：**＋／－ 兩顆縮放鈕根本沒作用**。
  `useReactFlow` 的 `zoomIn`／`zoomOut` 在這個畫面上靜悄悄地沒反應（滾輪正常，
  所以 d3 那層是通的），改成自己讀 viewport 再寫回去，並以畫布中心為錨點。

### 2026-08-05 — 每個專案自己的系統參數

使用者要的：下拉清單（任務狀態、優先度、任務類型）的值與順序可以改，
而且**是每個專案改自己的**，不是全站一份。

- 狀態本來就是每個專案一份（`task_status`），但**優先度與任務類型從第一天就寫死在
  `task` 的 CHECK 裡**。`0011_project_parameters.sql` 把它們拆成 `task_priority`
  與 `task_type` 兩張表，形狀比照 `task_status`，三種參數才能共用同一套 CRUD 與畫面。
- **key 沿用原本 CHECK 裡的大寫值**回填，既有任務的 `priority`／`type` 一個字都不用動。
- 拿掉 `task` 上那兩個 CHECK 時**不寫死 constraint 名稱**，改成掃 `pg_constraint`
  找定義裡出現那些列舉值的 —— 從舊版升上來的資料庫不保證叫同一個名字。
- **拿掉 CHECK 不等於不驗**：改成寫入前確認「這個 key 在這個專案的清單裡」
  （`assertParamKey`），建立、更新、拖到別的欄三條路都要過。跟 `status_key`
  從第一天起就是同一種做法。
- **還有任務在用就不准刪**，要刪就得指定「那些任務改成哪一個」，同一支交易裡搬完再刪。
  另外一種參數至少要留一個，不然任務沒有值可選。
- 排序可以用拖的（握把是列首的 ⠿，只有它可拖，不然會跟改名字的輸入框搶指標事件），
  ↑／↓ 保留當保底路徑，鍵盤也能拖。
- 看板上「最急的那一級」不再認死 `URGENT` 這個 key —— 有人會把它改名或刪掉，
  改成取這個專案優先度清單的最後一個，顏色也用他自己挑的。
- 示範資料是直接 INSERT 專案的、繞過了建立專案的流程，所以 `seed.ts` 也要補這兩份清單。

### 2026-08-05 — 行事曆的勾選記得住、甘特圖補完深色

- 行事曆的「任務／期望回覆日／請假」每次回來都重設。那是**使用者對「我想看什麼」
  的長期偏好**，不是這次瀏覽的暫時狀態，所以記進 localStorage（`lib/remember.ts`），
  跟深色模式同一個道理：這是「這台裝置上我習慣怎麼看」，不是帳號屬性。
- 甘特圖還有一批 dhtmlx 自己畫的東西沒被覆蓋到：**每一列的底色其實一直是白的**
  （寫死在 `.gantt_row` 上，被上層蓋住，捲動時會閃出白條）、時間軸每格的分隔線、
  拖曳欄寬的把手、拉線的端點與轉角。那些在深色底下會變成畫面上最亮的幾個點。
- 一般長條的預設藍壓一階；關鍵路徑的紅與發文狀態不動 —— 那是語意色。

### 2026-08-05 — 週檢視：這一週有哪些任務在跑

使用者要的：「可以看每週目前有哪些任務的狀態」。月曆看得到日期，但看不出
「這禮拜卡在哪一關」，那才是每週要問的問題。

- 列的是**期間與這一週重疊**的任務，不是只有開始日落在這週的 —— 跨週的任務
  這週還在做，就要看得到，並且標出「接續上一週／延續到下一週／整週都在進行」。
- 依狀態分組，順序照專案自己的狀態順序。狀態色只當圓點不當底色：
  那是使用者挑的顏色，深淺不受控，壓字會糊。
- **沒有日期的任務不進這個畫面**，但底下固定一行講清楚「另有 N 張沒有排期」，
  不然使用者會以為任務不見了。
- 一週從星期日起，跟月曆的 `monthGrid` 一致 —— 不然同一張任務在兩個畫面會分屬不同週。

### 2026-08-05 — 任務轉派，附一句交接說明

畫面上一直沒有指派負責人的介面，後端其實早就支援。

- **獨立端點 `POST /tasks/:id/reassign`，不是走 `PATCH`**：換人是欄位，
  交接說明是話，兩者要在同一支交易裡一起寫進活動紀錄才有意義。
- 指派的對象一定要是這個專案的成員。不是成員的人連專案都看不到，任務掛在他名下
  等於丟進黑洞 —— 他收不到，而原本在追的人還以為有人接手了。
- 活動紀錄沿用 `FIELD_CHANGE` 加一個 `reassign` 旗標，沒有新增 kind：
  `activity.kind` 帶 CHECK 約束，多一種就得動資料表，不值得為了一句話改 schema。
  前後兩人的**名字另外存一份**，帳號日後改名或被刪，那句話還是讀得懂。
- 四種情況各自成句：換人／首次指派／收回／清空，不會拼出「從 null 換成」。
- 人沒換又沒寫說明就不寫紀錄 —— 每按一次都留一筆的話，真正換過手的那幾筆會被淹掉。
- 清單上可以直接換人但**不問交接說明**：那是逐張慢慢處理時才會寫的東西，
  滑過去的提示會告訴他要附說明請開任務詳情。
- 通知鈴鐺也看得到那句交接說明，而且排在任務編號前面 ——
  「為什麼換到我頭上、做到哪裡了」比編號有用得多。

### 2026-08-05 — 上傳的頭像顯示不出來

一直以來上傳過頭像的人，畫面上還是文字色塊，看起來像上傳失敗。

- 原因：`GET /users/:id/avatar` 要 `Authorization` 標頭，而瀏覽器載入 `<img src>`
  時不會帶 → 一律 401 → 退回色塊。
- 改成 fetch 拿 blob 再交給 `<img>`。**沒有放寬那個端點的驗證** ——
  頭像是誰的臉，不該變成公開資源。
- 換頭像或元件收掉時要 `revokeObjectURL`，不然那些 blob 會一直留在記憶體裡。

### 2026-08-05 — 發文追蹤移進專案，成員移到頭像選單

使用者的話：「發文追蹤應該是針對個別專案，要進專案才能看自己的發文追蹤」。

- 發文追蹤從專案選擇頁那顆跨專案的大按鈕，改成專案裡的最後一個頁籤，只顯示這個
  專案的。側欄的入口（展開與收合窄條兩處）一起拿掉。
- **做法是前端依 `projectId` 濾**，跟行事曆同一套、共用同一份快取
  （`['inquiry-board', workspaceId]`），同一個專案的兩個畫面不會各抓一次。
- 單位統計原本是工作區層級的端點、回傳沒有 `projectId`，濾不出來，改成在頁面內
  就地算。順手修掉一個既有的顯示錯誤：已回覆卡片的「N 天回覆」永遠不出現 ——
  看板端點沒送那個欄位，現在用提問日與回覆日算。
- **成員**從側欄搬進右上角頭像選單，只有人在專案裡才出現那一項（成員是「這個專案的」，
  在專案選擇頁沒有專案可言）。待審申請的紅色數字跟著搬過去。
- 側欄選大項目時，若正停在發文追蹤或成員會回到清單 —— 那兩個不吃大項目篩選，
  不然按下去畫面沒反應。

### 2026-08-05 — 誰能開專案、誰能管成員：放寬到專案管理者

使用者定的兩條新規則：**任意帳號都可以建立專案，建立的人就是那個專案的管理者**；
**專案管理者可以搜尋任意帳號，請他加入專案**。

- 建立專案原本擋訪客，整段白名單拿掉，只留「你不是這個工作區的成員」。
  建立者在同一支交易裡本來就會被寫成 `MANAGER`，那件事不變。
- `requireProjectCreator` 換成 `requireProjectManager`（判斷 `project_member.role`）。
  沒有直接用 `requireProjectRole(..., 'MANAGER')`：那條路的錯誤訊息會把角色代碼
  原封不動吐到畫面上，違反「介面不出現英文縮寫」。
- 連帶放寬的還有：專案清單上的待審紅點（原本寫死看 `created_by`，新管理者永遠
  看不到有人在敲門）、加入申請的通知（原本只發給建立者，他放假那筆申請就沒人管）。
- **加人時若對方不在這個工作區，同一支交易補一筆 `GUEST` 工作區身分** ——
  `/auth/me` 是靠 `workspace_member` 決定看得到哪些工作區，不補的話被邀請進來的人
  登入後根本看不到那個工作區，搜尋等於白做。
- **跨工作區搜尋帳號要帶 `projectId`，而且要是那個專案的管理者**。只驗「是這個
  工作區的成員」不夠：那等於任何人都能拿 email 一個一個試「這個帳號在不在這個站上」。
- 新加的保護：管理者不能改自己的角色、不能把自己移出專案 —— 這兩件事都救不回來
  （只有管理者能改角色），而放寬到多個管理者之後才第一次有人做得到。

### 2026-08-05 — 按不動的按鈕不要畫出來

後端的規則早就有了，前端還是把每個按鈕都畫出來，使用者按了才被 403 拒絕。

- **沒權限就不畫，不是畫成灰的** —— 一整排灰掉的按鈕比不畫更難懂。
- 收起來的：標題、狀態／優先度／排程模式、日期、進度、建立關聯與移除關聯、
  清單的「＋子任務」與「＋新增任務」、看板的拖曳（`useSortable({ disabled })`，
  滑鼠與鍵盤兩條路都要擋，`onDragEnd` 再擋一次）。
- **刻意留著**：「目前遇到的問題」與發文追蹤的「登錄回覆」—— 那兩件事後端本來就
  放寬到任何專案成員，誰遇到誰寫最快。
- 讀程式碼時發現兩處跟口頭規則不一樣，照程式碼實作：**任務關聯**與**新增詢問單**
  只要求 `EDITOR`，不看任務是誰開的。
- `Task` 型別補上 `createdById`（後端本來就回，只是型別沒寫）。

### 2026-08-05 — 深色模式的次要文字看不清楚

使用者回報「有些文字跟底色配色很不清楚」。量了整頁的對比度，發現不是零星幾處，
是**配色對照表本身訂錯了**。

- 表上寫「次要文字 → `dark:text-slate-500`」。實測 slate-500 在
  slate-950 / 900 / 800 上只有 **4.24 / 3.75 / 3.07**，全部低於 4.5；
  更淡的 slate-600 只有 2.66 / 2.36 / 1.93，根本不能當文字色。
- 原因是**照抄了淺色的階數**：白底配 slate-400 讀得清楚，是因為對比方向相反。
- 整條往上提一階（次要文字一律 `dark:text-slate-400`，`slate-500` 只留給
  裝飾用的線與符號），十二個畫面檔一起換掉，量到的數字寫進 `index.css` 的對照表。
- 另外補了 `textOnColor()`：壓在狀態色上的字改成依底色亮度選黑或白。
  狀態色是使用者自己挑的不能動，但一律白字的話，淺色狀態（例如待辦的 slate-400）
  上只有 2.5:1，行事曆的長條會糊成一片。
- 驗證方式是在瀏覽器裡直接量：改前 140 處不合格，改後剩 10 處。

### 2026-08-05 — 請假：行事曆上看得到誰不在

資料表與端點上一批就寫好了但**沒掛進 `index.ts`**，這次接起來並畫進行事曆。

- **請假是工作區層級、不分專案** —— 人請假是整個人不在，不是只有某個專案不在。
  切到別的專案看到的是同一批假。
- **備註只有本人與工作區管理者看得到**，那是後端濾掉的（`routes/leaves.ts` 的
  `forViewer`），不是靠前端不畫：請假的區間要公開（排工作要用），理由不必。
- 長條固定紫色系，不分假別各給一色 —— 假別已經寫在長條上，再上色會跟任務的
  狀態色搶解讀。
- **請假不能拖曳改期**，跟任務不同：改假要走表單。長條完全不掛 `useDraggable`，
  `onDragEnd` 再擋一次。
- 起訖日一路都是 `YYYY-MM-DD` 字串，沒有轉成 `Date` 再轉回來（UTC+8 會位移一天）。
  後端也是用 `to_char` 轉字串才回傳，同一個理由。
- 假別的中文在 `strings/calendar.ts` 一處：事假／病假／特休／公假／婚假／喪假／其他。

### 2026-08-05 — 專案可以設成公開

後端上一批做完了（`0010_project_public.sql`），這次補畫面上的開關。

- 開關在專案卡片上，**只有自己開的專案才出現**。切換不會誤觸「進入專案」——
  切換畫在卡片按鈕**外面**再絕對定位疊回去（button 包 button 是不合法 HTML，
  瀏覽器會把它拆掉），另外仍加了 `stopPropagation` 保險。
- 文案講的是**現在的狀態**不是「按下去會變成什麼」，並且一定要帶到
  「公開只影響找不找得到，加入仍要核准」—— 不然使用者會以為按下去就把內容
  攤開給全公司看。
- 切換後連 `['joinableProjects']` 一起失效：公開與否會換掉別人搜尋得到的結果。

### 2026-08-05 — 深色模式與文案外移：收完剩下的頁面

前一批只做了一半（`index.css` 有配色表、`src/strings` 有文案，但七、八個檔還沒照著改）。
這次把剩下的收完，並在瀏覽器上逐頁看過深色。

- **甘特圖**：dhtmlx 那份 CSS 把顏色寫死在它自己的 class 上，Tailwind 的 `dark:`
  前綴碰不到，只能在 `index.css` 照配色表覆蓋一次（表頭、格線、列的 hover 與選取、
  假日欄）。長條本身的顏色不動 —— 那是關鍵路徑與發文狀態的語意色。
- **關聯圖**：線上標籤的描邊與匯合點文字的外暈本來寫死成畫布的淺色，深色下每個
  標籤外面會多一圈白暈。改成 CSS 變數 `--graph-halo` 跟著主題走。
  背景點陣的顏色是 SVG 屬性、吃不到變數，所以那一個仍然分兩色寫。
- **下拉**：`ui.tsx` 本來只包了 `Input` 沒包 `select`，五、六個檔各自寫一份深色配色，
  補上共用的 `<Select>`，`TaskDrawer` 裡那份 `SELECT_CLS` 一併收掉。
- **關聯類型的中文說法本來有三份副本**（`lib/linkText.ts`、`Graph.tsx`、
  `strings/chart.ts`），改一份另外兩份就對不上。現在 `lib/linkText.ts` 只是
  `strings/chart.ts` 的門面，`Graph.tsx` 從它 import。
- 通知鈴鐺、系統管理、成員、專案選擇、行事曆的寫死文案全部搬進 `src/strings`；
  行事曆本來只有一個空的 `strings/calendar.ts`，這次填起來。

**驗過的**：專案選擇、清單、甘特、關聯圖、行事曆在深色下逐頁看過；
關聯圖 17 個節點 0 個隱藏、12 條線、`fitView` 有生效（scale 0.45），
標籤描邊確實跟著主題變成 `#020617`。

### 2026-08-04 — 深色模式，以及右上角的頭像選單

**深色模式**：三個選項（淺色／深色／跟隨系統），預設跟隨系統。

- 靠 `<html>` 上的 `dark` class，不靠 `prefers-color-scheme` —— 使用者要能自己切。
  Tailwind 4 預設的 `dark:` 是跟著系統走的，在 `index.css` 改寫成 class 版本。
- 選擇存在 localStorage 不存在後端：這是「這台裝置上看起來怎樣」，不是帳號屬性。
  同一個人在辦公室想要淺色、在家想要深色是常態，存進帳號反而會互相蓋掉。
- 除了掛 class 也設 `color-scheme` —— 捲軸、下拉、日期選擇器那些瀏覽器自己畫的
  東西只認它，不認 class。
- React 掛載前先套一次，不然第一格畫面會閃一下白的。
- **配色對照表寫在 `index.css` 最上面**，改畫面時照那張表加 `dark:`，
  不要每個地方自己配一組。資料帶進來的顏色（專案色、狀態色）不要動。

**右上角的頭像選單**：帳號設定、系統管理、外觀、登出都收進頭像底下。

- 這些功能的共同點是都跟「我這個人」有關，跟目前在看什麼無關。原本散在側欄底部
  與各頁角落，現在集中在右上角 —— 那是所有人第一個會去點的地方，
  版面上也少了四個常駐按鈕。
- 外觀直接做在選單裡、不塞進帳號設定頁：切深色是隨手要做的事，
  為了它多走兩層畫面不合理。
- 通知鈴鐺跟著移到頭像旁邊，側欄底下那一排整個拿掉。

### 2026-08-04 — 任務狀態多了「驗證中」「驗證完成」

原本是「待辦 → 進行中 → 待驗收 → 已完成」，中間那段太粗：東西交出去等人來驗
（沒人在動）、有人正在驗、驗過了但還沒收尾，三件事都擠在「待驗收」，
看板上分不出「還沒人動」跟「正在驗」。

現在是 **待辦 → 進行中 → 待驗收 → 驗證中 → 驗證完成 → 已完成**。

- 驗證完成算 DONE：驗過了就不該再被算進「還沒做完」的數字裡。已完成仍然留著，
  兩個都是 DONE 沒有問題。
- migration 會把新狀態補給既有專案，用 `NOT EXISTS` 而不是 `ON CONFLICT` ——
  專案可能已經自己開了同名或同 key 的狀態，那是使用者的東西，不覆蓋也不重複插。

### 2026-08-04 — 發文追蹤：期望回覆日可以直接選「幾天後」

建立發文追蹤時，期望回覆日新增一組快速選項（1／3／5／7／10／14 個工作天、
一個月後、不設期限、自訂日期），選完立刻把日期算出來填進日期欄並標出星期幾；
日期欄本身照樣能手動改。已建立的紀錄點一下「期望回覆」欄位也用同一組選項改期限。

- **為什麼**：原本只給一個日期選擇器，使用者得自己翻月曆算「三個工作天是幾號」，
  多數人乾脆隨手挑一天，逾期統計就跟著失真。
- 天數一律用工作天（跳過週末），而且前端刻意複製後端 `addWorkingDays` 的同一套算法
  —— 畫面上看到的那一天就是存進資料庫的那一天。
- 預設天數不寫死在前端，由後端把 `PMFLOW_INQUIRY_DEFAULT_DUE_DAYS` 吐給前端，
  站台調整設定時兩邊不會對不上。
- 編輯已建立的紀錄時「幾天後」從今天起算 —— 改期限的用意是再寬限幾天，
  從當初的提問日起算會算出一存下去就逾期的日期。

### 2026-08-04 — 要加入的專案改成用搜尋的，不再整排列出來

選專案那一頁的「其他專案」原本會把整個工作區、自己還沒加入的專案全部列出來。
現在改成一個搜尋框：**輸入專案名稱或代碼，找到了才看得到、才申請得了**。

- **為什麼**：專案名稱常常就寫著客戶名或標案名，預設攤開來等於每個人都讀得到
  這個組織正在做哪些案子。想加入的人本來就知道自己要找哪一個，讓他打出來即可。
- **代碼從開頭比、名稱包含就算**：打 `MRG` 是在找 MRG 這個專案，不是找 XMRG；
  但名稱是自由文字，記得中間幾個字也該找得到。
- **自己還在審核中的申請一律顯示**，不受搜尋影響 —— 不然申請送出去之後
  那張卡片就消失了，也就撤不回來。
- 後端沒給 `q` 就只回審核中的申請，過濾在資料庫做，不是前端拿了全部再篩。
- 打字有 300 毫秒的緩衝，不會每按一個鍵就送一次查詢。

### 2026-08-04 — 帳號權限：管理者才管帳號，擁有者只能指派管理者

**跟原本相反**，動到既有邏輯，升級後管理畫面會長得不一樣：

| | 原本 | 現在 |
|---|---|---|
| 看得到所有帳號 | 擁有者與管理者 | **只有管理者** |
| 開帳號、停用、代設密碼 | 擁有者與管理者 | **只有管理者** |
| 刪除帳號 | 沒有這個功能 | 有，但刪不了自己 |
| 指派管理者 | 擁有者與管理者都能調角色 | **只有擁有者** |
| 忘記密碼 | 只能請管理者代設 | 多一條：在主機上放檔案 |

**為什麼這樣切**：開站的人不必然是該看每個人帳號的人。把「看得到別人的帳號」
變成一個被明確授予的職務，而不是誰先把站架起來誰就順便什麼都看得到。

**留給擁有者的唯一一項是指派管理者**，因為不留就死結：管帳號的權力全給了管理者，
那第一個管理者由誰指派？最後一個管理者離職之後，整個站就再也沒有人能開帳號了。
擁有者那一頁刻意只回名字與 email，帳號狀態、參與幾個專案這些細節後端根本不回。

**連環相扣的幾條規則**（都在後端，前端只是把按鈕收起來）：
- 擁有者的帳號管理者一概碰不得 —— 他是最後回得來的人，而管理者是他指派的，
  被指派的人不該反過來停掉指派他的人。
- 管理者之間不改彼此的角色、也不互刪。要刪一個管理者，先請擁有者取消他的身分。
- 停用到剩最後一個管理者會被擋下來。
- 刪除帳號會把他開的專案轉給執行刪除的人 —— 專案的建立者是「誰能決定成員」的依據，
  沒有建立者的專案沒有人能再放人進來。任務的負責人欄位變成空的，任務本身不動。
- 帳號還在別的工作區裡就不能從這裡刪 —— 帳號是整站共用的，不是某個工作區的財產。

**從主機上重置密碼**（`lib/breakglass.ts`，預設關閉）：設了
`PMFLOW_PASSWORD_RESET_DIR` 才啟用。在那個目錄放 `<email>.reset`，內容是新密碼，
服務啟動時與每分鐘掃一次，改完**立刻刪檔**、撤掉所有裝置的登入、在 log 留紀錄。
做成檔案而不是端點：拿得到主機檔案系統的人本來就等於最高權限，用檔案不會多開
攻擊面；做成端點才會 —— 那等於在網路上留一個永遠開著的後門。

### 2026-08-04 — 給機器用的 API 權杖

外部系統終於可以自己呼叫 API 建任務。原本站上唯一的憑證是登入換來的 access token，
15 分鐘就過期，換新的要靠瀏覽器的 refresh cookie —— 那是為瀏覽器設計的，
腳本、排程、第三方系統都走不了。

在「帳號設定 → API 權杖」建立長期憑證，用法就是原本的 `Authorization: Bearer`，
其餘端點與參數完全不變（curl 範例在 `CODEMAP.md`）。

- **權限跟著人走，不做機器帳號**：拿權杖呼叫等於發權杖的那個人在呼叫，專案角色、
  成員資格全部沿用既有檢查。多一套權限模型就多一個會跟主線走鐘的地方，
  而且人離職時，看不見的機器帳號一定會被漏掉。
- **兩種憑證共用同一個驗證入口**：`lib/auth.ts` 的 `authenticate()` 依開頭字串分流
  （權杖是 `pmflow_`，JWT 一定是 `eyJ`），既有 JWT 那條路的行為沒有任何改變。
- **只存 sha256 雜湊**，明文只在建立當下回一次，弄丟只能重發。刻意不用 scrypt：
  256 位元亂數沒有字典攻擊的問題，而每次呼叫都要驗一次，慢雜湊會讓權杖不能用
  —— 跟既有 `refresh_token` 同一套理由。
- **每次驗證都重查帳號狀態**：帳號被停用時沒有人會記得去撤權杖。
- **不設到期日是允許的**：自架站台常常就是要一把長期不換的整合金鑰，
  強迫到期只會讓人在到期那天手忙腳亂，或乾脆把日期設到 2099。
- **改密碼不會讓權杖失效**（與登入 session 不同），要停用請自行撤銷 ——
  否則例行改密碼會無預警打斷所有整合。介面上有寫明。
- 一人最多 20 把：清單長到要捲動時，沒人分得出哪一把還在用，撤銷就變成不敢做的事。

### 2026-08-04 — 任務的「目前遇到的問題」

任務可以記下「現在為什麼推不動」，清單、看板、關聯圖上都會標出來（紫紅色 ⚑ 有問題），
游標停著看得到寫了什麼。解決了在任務詳情按「已解決，清空」。

- **獨立欄位（`task.problem`），不塞進描述**：描述講的是「這件事要做什麼」，
  問題講的是「現在為什麼推不動」。混在同一段文字裡，畫面就沒辦法標出
  「哪幾張正卡著」—— 而那是每天開會第一個要看的東西。
- **跟關聯圖的「卡住」刻意分開**，顏色與符號都不同：卡住是系統依任務關聯算出來的，
  上游一完成自己就消失；問題是人打字寫下的，只有人能清掉。長得一樣的話，
  使用者會以為系統知道他遇到什麼事。
- **解決了就設回 null**，任務身上只放「現在」的狀態 —— 否則畫面得再多一個
  「這個問題還算不算數」的旗標，而那種旗標沒有人會記得更新。清空前的內容會寫進
  `activity`（`FIELD_CHANGE` 的 `problemBefore`），時間軸上查得回當初卡在哪，
  不必為了問題另開一張表。
- 資料庫擋掉空字串（CHECK），「有沒有問題」永遠只有 `problem IS NOT NULL` 一種判斷。

### 2026-08-04 — 頭像：畫面接起來了

上一批只做到後端與 `<Avatar>` 元件，畫面沒接。這批把三處接上：

- **帳號設定**多一段「頭像」：選圖、換一張、移除。上傳成功後重抓 profile ——
  要的是新檔名，它同時是 `<Avatar>` 的 `version`，沒有它畫面會停在瀏覽器快取的舊圖上。
- **清單**的負責人欄改用 `<Avatar>`，順手刪掉 `List.tsx` 自己那份 `initial()`。
  同一個名字在哪裡都是同一個顏色，掃過去顏色本身就有辨識度。
- **成員頁**每一列左邊加上頭像（`md` 尺寸）。

後端早就在回 `assigneeHasAvatar`（`routes/tasks.ts`）與 `hasAvatar`（`routes/members.ts`），
這批沒有動到任何查詢。

### 2026-08-04 — 頭像：存檔與上傳端點（畫面未接）

**狀態：後端做完，前端只有元件，畫面還沒接上。** 接手要做的是：
`AccountPanel` 加上傳介面、`List.tsx` 換掉自己那個 `initial()`、成員頁改用 `<Avatar>`。

**為什麼這樣存**：圖檔放檔案系統（容器掛的 `/data/attachments/avatars`），
資料庫只記檔名。備份、複寫、連線池都不該被幾百 KB 的二進位資料拖累，
而頭像壞掉只是變回文字縮寫，不值得那個代價。存檔名不存完整路徑，搬機器不用改資料。

**為什麼不用 multipart**：上傳一張頭像用 JSON 帶 data URL 就夠了。多一個相依、
多一組解析路徑、多一種要防的攻擊面並不划算 —— 這個專案的相依有授權白名單關卡。

**安全上做了什麼**：
- 型別**認檔頭那幾個位元組**，不認副檔名也不認 data URL 上寫的 mime ——
  那兩個都是上傳的人說了算。
- 讀檔前一律過 `basename()`，擋掉 `../`。資料庫的值理論上是自己寫進去的，
  但這種地方不留「應該不會」的空間。
- 上限 2MB；前端先在 canvas 縮成 256 見方再送，正常只有幾十 KB。
- 檔名帶時間戳 —— 換頭像就是新網址，不會有人拿到快取的舊圖。

**縮圖為什麼在瀏覽器做**：省掉一個影像處理相依（那類套件多半有原生模組，
跨架構建置會很麻煩，見 Dockerfile 的說明），而且使用者選了 8MB 的相片時，
上傳的是縮好的幾十 KB。

### 2026-08-04 — 清單可以直接做事，成員移出頁籤

**為什麼**：使用者一連串的觀察 ——「新增子任務只有右上角的入口嗎，有點不夠直覺」
「右上角的新增任務應該沒用了」「我想在清單可以直接改狀態」「清單要有任務歸屬者是誰」
「成員不用放在那個頁籤，可以移到其他位置」。共同點是：**做事的地方跟看東西的地方不一致**。

**改了什麼**：
- 清單每一列加「＋ 子任務」，直接在那一列底下開輸入框；建立後輸入框留著，
  可以連續加好幾張。刻意**不藏在 hover 底下** —— 藏起來等於還是只有右上角那一個入口。
- 清單最下面加一列「＋ 新增任務」，加的是跟目前這一層同級的任務。
  側欄選了大項目時就掛在它底下。
- 右上角那組輸入框與「＋ 新增任務」整組移除。
- 新增「負責人」欄（名字＋色塊縮寫）。
- 狀態改成可以直接在清單上換的下拉，不必先點開任務或去看板拖。
- **成員從視圖頁籤移到側欄**。那一排是「同一批任務的不同看法」，
  成員是專案設定，混在裡面會讓人以為它也是一種任務視圖。待審申請的紅點跟著搬過去。

**沒有頭像功能**：清單上的圓形色塊是名字算出來的縮寫。容器有掛 `/data/attachments`，
但目前沒有任何上傳的程式碼。

### 2026-08-04 — 關聯圖：標出每一包的起點、說明改成滑過去就顯示

**為什麼**：使用者問「任務框好像沒有最原始的起點，我可能有多個起點，要怎麼連上？」

**答案**：連到**框本身**就等於連到裡面所有起點 —— 框是一張任務，一支箭頭指進框
＝「這一整包才能開始」，裡面沒有上游的那幾張全部一起被擋住，不必一張一張連。
但畫面上看不出哪幾張是起點，所以把它標出來：同一個框底下沒有任何同框上游的任務
掛一個綠色的「起點」。只算同框的上游 —— 從框外面指進來的線本來就是擋整包。

**說明列**（同一天內改了三輪，最後定在這裡）：
- 滑過去就顯示、移開就收，不用點；也不用原生的 `title`（要停一秒才出現、樣子不能控制）
- 提示框貼在那一項的正上方，並夾在說明列範圍內 ——
  最左邊那幾項置中之後會被「操作說明」那一格擋住
- 拉寬到 560px 且不折行

### 2026-08-04 — 建置：arm64 在 QEMU 下掛掉，Node 升到 24

**症狀**：推 tag 之後 release workflow 卡住不動，log 停在
`qemu: uncaught target signal 4 (Illegal instruction) - core dumped`，
發生在 `[linux/arm64 builder] RUN npm ci`。amd64 那一份順利做完。

**原因**：GitHub runner 是 amd64，建 arm64 映像時整包在 QEMU 模擬下跑，
而 Node 在模擬的 arm64 上執行某些指令會直接崩掉。這不是專案的程式有問題。

**改了什麼**：兩個 Dockerfile 的建置階段都加上 `--platform=$BUILDPLATFORM`，
讓它們用 runner 自己的架構跑，不進模擬層。**成立的前提是那幾個階段的產出跟架構無關**：
`vite build` 出來是靜態檔、`tsc` 出來是 JavaScript，兩種架構完全一樣。
API 的 runtime `node_modules` 也一起跨架構安裝 —— 這一項只在「相依全部是純 JS」時成立
（目前是 fastify / postgres / jose / zod）。哪天加了會編 C 的套件就要改回去。

順手把 Node 從 22 升到 24（現行 LTS），映像與 CI 一起。
本機用 `docker buildx --platform linux/amd64,linux/arm64` 兩個架構都建過，API 容器也啟得起來。

**另外**：workflow log 裡的「Node 20 is being deprecated」跟專案無關，
那是 GitHub Actions 執行 action 本身用的 Node，它已自動改用 Node 24。

### 2026-08-04 — 關聯圖：大項目改成把子項目框起來

**為什麼**：使用者連問三次階層看不懂 ——「我點 MRG-7，那 MRG-1 在亮什麼」
「虛線整個看不懂」「或許可以變成一個大框，內部是子項目？」。
一條「包含」虛線得先看懂圖例才知道是階層，框不用：東西在框裡面就是它的一部分。
而且他要的還有一項 ——「大項目是很重要的依賴，他的大框還能指向其他後續任務」，
框本身仍是一張任務，一支從框拉出去的箭頭就是「這一整包做完才能接下去」。

**改了什麼**（`apps/web/src/pages/Graph.tsx`）：
- 版面改成遞迴的：最外層與每個框的裡面各自跑同一套排法（併欄 → 分層 → 排序）。
  框的大小是裡面排完之後才知道的，所以是先量再放。
- 有小孩的任務畫成 `box` 節點，子任務掛 `parentId` 交給 React Flow 管座標與整包拖曳。
- **「包含」線整條拿掉**，`階層（上下）` 開關也一併移除 —— 框已經在說同一件事。
- 框的標題列不再寫「大項目」（使用者說「不是很明確」），改成 **「內含 N 張」**。

**踩到的三個坑**：
1. **React Flow 要求父節點排在子節點前面**，不然子節點的座標會對不上，所以節點陣列
   最後要依深度排序。
2. **框的 `measured` 不能被量到的值蓋掉**。`styledNodes` 原本無條件寫
   `measured: measured[n.id]`，框的尺寸是我們自己算的、還沒被量過，於是被蓋成
   `undefined` —— 整張圖停在 `visibility:hidden`，跟之前那個節點不顯示的坑同一個成因。
3. **子節點的座標是相對於父節點的左上角**，不是相對於框的內容區。排版是照內容區算的，
   要把標題列與內距補回去，否則第一張子任務會直接蓋在框的標題上。

### 2026-08-04 — 前端熱更新，改一行不用重建容器

**為什麼**：使用者問「前端改檔案不是直接生效嗎？後端改了才需要重啟啊」。
原本的 dev 環境是「`npm ci` + `tsc` + `vite build` 成靜態檔交給 Caddy」，
所以每改一行前端都要重建整個容器，一輪一分鐘上下 —— 那天光這件事就跑了十幾次。

**改了什麼**：新增 `docker-compose.hmr.yml`，web 換成直接跑 Vite dev server 並把
`apps/web` 掛進容器：

```
docker compose -f docker-compose.dev.yml -f docker-compose.hmr.yml up -d
```

網址一樣是 8480。`vite.config.ts` 的 proxy 目標改成可以用環境變數指定 ——
這個模式下後端不在 localhost，而是同一個網路裡的 `api:8080`。

改 `apps/api` 仍然要重建 api 容器；發版前用原本那條指令驗一次靜態檔版本。

### 2026-08-03 — 關聯圖：下層往右排、階層鄰居不再看起來像依賴、卡住追到源頭

**為什麼**：使用者一路問出來的三個問題，都是「圖畫得出來，但讀不對」。

**改了什麼**（都在 `apps/web/src/pages/Graph.tsx`）：

1. **下層往右排**。原本階層只影響同一層內的排序，於是小項目全部疊在大項目正下方，
   看起來像一串互不相干的任務。現在把「父 → 子」也當成往右推的順序關係，
   大項目在左、底下的任務在右。使用者的話：「我希望下層關聯是往右放，不是先往下放」。

2. **點一張任務時，只因為階層而亮的鄰居畫成虛線外框 ＋「上層」「下層」小標**。
   使用者問「我點 MRG-7，那 MRG-1 在亮什麼，他們有關聯？」—— MRG-1 是它的大項目，
   不是依賴，但兩者亮起來一模一樣。階層仍然要留亮（不然找不到自己在哪一塊底下），
   但要一眼看得出「這條不是先後關係」。

3. **卡住要追到真正的源頭**。原本 MRG-7 上寫「要等 MRG-6」，而 MRG-7 同時掛著
   「同時開始」的徽章 —— 使用者問「不覺得互斥嗎？」。兩件事其實不衝突
   （上游還沒開始所以動不了，它一開始兩張就並肩跑），但講法沒有用：
   真正該去推的是卡住 MRG-6 的 **MRG-5**。現在同時開始的那一端如果自己也被卡住，
   就往上追到源頭，並且分開講「要等 ⋯ 開始」還是「要等 ⋯ 完成」。

4. **卡住的源頭也要留亮**。使用者：「7 等 5，但是你 5 沒有亮」—— 說明上寫著在等 MRG-5，
   MRG-5 卻是暗的。現在聚焦時把追出來的源頭一起算進鄰居。
   卡住的外框同時改成紅框＋紅暈（本來只是淡紅色邊）。

5. **跟誰都沒關係的任務沉到那一層最下面**。它們全部落在第 0 層，照編號排會插在最上面，
   看起來像整張圖的開頭，其實只是還沒被接上。

6. 節點從 `w-56` 加寬到 `w-64`，徽章改不換行。一張任務同時「卡住」又「同時開始」時
   兩個徽章擠不下，會折到第二行、把節點撐高，同一排就高低不齊。

7. **線條說明從左下角的浮層改成畫面最下面的常駐兩排**（線一排、圖示一排），
   跟圖不重疊，不用開關；完整說法掛在 `title` 上，游標停著就出現。
   最左邊多一個「？說明」放操作方式。兩排都可以左右滑 —— 圖示只會愈加愈多，
   硬塞進一排就會折行把圖擠掉。

**踩到的**：`NODE_W` 是寫死的常數（匯合點的座標要用），改 Tailwind 寬度時一定要一起改。

### 2026-08-03 — 通知：鈴鐺與四種事件

**為什麼**：使用者說「我希望在任務被別人指向時就要通知該任務的負責人」。
在這之前系統完全沒有通知機制 —— 關聯是別人建立的，自己的任務因此多了一條依賴卻無從得知；
唯一的提醒是「成員」頁籤上的紅點，而且只涵蓋加入申請、要先進到那個專案才看得到。

**選鈴鐺不選常駐橫條**：四種事件加起來多數日子是零則，一條永遠空著的橫條會佔掉每個畫面
一行，久了就沒人看。鈴鐺沒有未讀時只是一個灰圖示。

**改了什麼**：
- `migrations/0003_notification.sql`（新）— `notification` 表。一則通知只給一個人
  （已讀是每個人自己的，共用一列就沒地方記），`actor_name` 冗餘保存一份，
  帳號被刪掉之後還讀得出「是誰做的」。各種 kind 的細節放 `body` jsonb，
  不為了四種事件開四組欄位。
- `lib/notify.ts`（新）— 唯一的產生點。「不通知自己」這條規則只在這裡判斷，
  漏一個地方使用者就會收到自己做的事。
- `routes/notifications.ts`（新）— 讀取、單筆已讀、全部已讀。權限單純：一律以
  `user_id` 為條件，不必 `requireProjectRole`。但也因此只回標題與代號，
  點進去看內容時前端重打任務 API，那時候才是真的鑑權（人可能已經被移出專案）。
- 產生點：`routes/links.ts`（被指向）、`routes/tasks.ts`（被指派，建立與 PATCH 各一處）、
  `routes/members.ts`（有人申請加入／申請被核准／被直接加入）。
- `components/NotificationBell.tsx`（新）— 鈴鐺與展開清單，輪詢 30 秒。
  掛在四個地方：專案選擇頁、側欄底部、帳號設定頁、跨專案發文追蹤頁。
- `lib/linkText.ts`（新）— 關聯的中文說法從 `TaskDrawer.tsx` 抽出來共用。

**幾個刻意的決定**：
- **被指向看的是 `b.targetId`，不是資料庫裡的 `target_id`**。對稱型關聯（相關）
  會依字典序把兩端對調，那是儲存細節；使用者的認知是「我把 A 指到了 B」，
  該收到通知的一直是 B 的負責人。
- **通知的句子兩張任務都寫名字，不用「我」**。`lib/linkText` 那支的主詞是「我」，
  因為它畫在任務詳情裡；通知是在別的地方看到的，「我」會被讀成收通知的人。
  使用者的原話：「有點看不懂，是誰被誰關聯？」
- **加入申請的紅點沒有拿掉**。紅點是「現在還有幾件待辦」，處理完就歸零；
  通知是「發生過什麼事」，看過就算看過。兩者回答不同的問題，並存。
- 指派給自己、關聯自己的任務都不通知（`notify()` 統一擋掉）。

**沒做**：被移除、申請被婉拒不發通知；沒有寄信、沒有 WebSocket。

### 2026-08-03 — 環偵測把每一條排程依賴都判成環

**症狀**：透過 API 建立任何一條排程依賴（完成後開始／同時開始／同時完成／開始後完成）
都回 409「會造成循環依賴」，連兩張全新、毫無關聯的任務也一樣。語意關聯（相關、阻擋…）不受影響。

**原因**：`lib/graph.ts` 的 `assertNoCycle` 把「準備新增的這條邊」以 `target → source`
的方向塞進遞迴查詢，而走訪又剛好從 `target` 起步 —— 第一步就沿著那條邊走回 `source`，
於是永遠回報成環。方向要跟其他兩種邊一致（`source → target`）。

**為什麼沒被測出來**：`test/e2e.sh` 只有「反向 FS 造成環 → 409」這種**預期失敗**的案例。
環偵測壞成「永遠回報成環」時，這個案例照樣通過。已補上「兩張無關的任務建 FS → 201」，
一正一反兩項一起看才守得住。

**影響**：示範資料的關聯是 seed 直接寫進資料庫的，所以圖看起來一直是對的；
但使用者從關聯圖或任務詳情拉線，四種排程依賴一條都建不起來。

### 2026-08-03 — 全新安裝的示範專案沒有建立者

**症狀**：全新安裝（空資料庫）之後，示範帳號不是自己專案的建立者 ——
看不到加入申請、核准不了任何人，成員管理整條流程 403。

**原因**：`seed.ts` 建立專案時沒有填 `created_by`。`0002` 的回填只涵蓋「它套用當下已經
存在」的專案，而示範資料是在 migration 跑完之後才建的，所以永遠補不到。
既有的開發資料庫因為先 seed 過、`0002` 才套用上去，反而是對的 —— 這個洞只有全新安裝踩得到。

**改了什麼**：`seed.ts` 補上 `created_by`；`0004_backfill_project_creator.sql` 用跟 0002
同一條規則（最早的那個 MANAGER）把已經裝壞的站台補回來。

### 2026-08-03 — 帳號設定與工作區管理者（後端）

**為什麼**：使用者說「我怎麼沒有更改帳號資訊的地方」「還需要 admin 權限的帳號」。
註冊之後就再也改不了自己的名字與密碼，也沒有人能停用離職同事的帳號 —— 自架站沒有這個就只能進資料庫改。

**改了什麼**：
- `apps/api/src/lib/auth.ts` — 新增 `WorkspaceRole` 與 `requireWorkspaceAdmin()`。
  工作區管理者管的是「誰能登入這個站」，**不會**因此看得到每個專案的內容 ——
  專案要進得去仍然要專案建立者放行（`requireProjectCreator`），兩套權限刻意分開。
- `apps/api/src/routes/account.ts`（新）— 六個端點：
  `GET/PATCH /me/profile`、`POST /me/password`、`GET/POST /admin/users`、`PATCH /admin/users/:userId`。
- `apps/api/src/index.ts` — 註冊路由。
- `apps/web/src/lib/api.ts` — 型別（`MyProfile`、`AdminUser`、`WorkspaceRole`）與端點函式。

**護欄**（都在 `account.ts`）：
- 只有 OWNER 給得出／改得動另一個 OWNER。
- 不能改自己的角色、不能停用自己 —— 手滑就登不回來。
- 最後一個還活著的 OWNER 不能被降級或停用，站台一定要留得下一個管得動的人。
- 改密碼、被停用、被管理者重設密碼，三種情況都會把該帳號的 refresh token 全部作廢，
  停用要立刻生效，不能等他手上那張 access token 自己過期。

**前端**（同一天補上）：
- `components/AccountPanel.tsx`（新）— 改顯示名稱／email／密碼，以及自己在哪些工作區。
  改密碼成功後**直接登出** —— 後端會把所有 refresh token 撤掉（含這一台），
  與其讓他下次開頁莫名被登出，不如當場重登，至少知道發生了什麼事。
- `components/AdminPanel.tsx`（新）— 帳號一覽（狀態、參與幾個專案、開了幾個）、
  改工作區角色、停用／復用、新增帳號、代設密碼。ADMIN 動不了 OWNER 的按鈕直接不畫。
- `App.tsx` — 新增 `AccountView` 一層，蓋在最上面，沒選專案也進得去；
  「系統管理」只有 OWNER/ADMIN 看得到頁籤。
- 入口：側欄底部與選專案頁右上角都加「帳號設定」。
- `lib/auth.tsx` — 新增 `refreshUser()`，改完名字側欄立刻換掉，不用重新登入。

**還沒做**：沒有寄信機制，管理者開的帳號密碼是當面給的（畫面上有寫）。
`app_user.status` 的 PENDING 目前沒有流程會產生，只有顯示。

---

### 2026-08-03 — 關聯圖：並行拆成同時開始／同時完成／重疊

**為什麼**：使用者說「勾選顯示圖示『並行』，但那個是指並行開始、並非並行完成，你缺了並行完成」。
原本一個 `⇉ 並行 n` 徽章把所有「日期重疊又沒有先後」的任務混在一起講，
但這三件事在派工上是不同的問題：同一天開始＝人力要同一天到位；
同一天完成＝驗收會撞在一起；只是重疊＝各走各的，沒什麼要協調。

**改了什麼**（`Graph.tsx`）：
- `parallelWith` 由 `Map<string, string[]>` 改成 `Map<string, ParallelPeers>`，
  `ParallelPeers = { sameStart, sameFinish, overlap }`，三類互斥。
- 判定順序：先看有沒有明確連「同時開始／同時完成」（吃 `simul` 的分群，
  **不管有沒有填日期都算數** —— 那是使用者親手講的，比日期可靠），
  再看是不是同一天開始／同一天結束，都不是才落到單純重疊。
- 徽章拆成三顆，顏色跟圖上的匯合點對齊：橘＝同時開始、紫＝同時完成、青＝並行。
- 聚焦面板同步拆成三列。

---

### 2026-08-03 — 關聯圖：匯合點改成小圓點、圖示說明固定在最下排

**為什麼**：使用者問「不知道同時動作納編為啥要多一條垂直線」，
以及「關聯圖的小圖示沒有一個固定說明的位置」。
那根跟群組一樣高的直條看起來像另一種依賴，反而更難讀；
節點上的小圖示則是「看到才要查」的東西，需要一個永遠在同一個位置的地方。

**改了什麼**（`Graph.tsx`）：
- `JUNCTION_W`（6px 長條）→ `JUNCTION_SIZE`（10px 圓點），放在群組的垂直中點，
  加白色外圈讓它在穿過的線上仍看得出來。扇形自己會張開，不需要直條去「連住」它們。
- 新增 `IconLegendBar` —— 固定在畫布下方的一排圖示說明（卡住／同時開始／同時完成／
  並行／匯合點／大項目／里程碑／詢問四態）。線條說明仍留在左下角可收合的「？線條說明」裡，
  因為它會擋到圖；圖示列不會。

---

### 2026-08-03 — 關聯圖：虛線規則、文字描邊、說明收角落、點一下不再位移

**為什麼**：使用者連續回報四件事 ——「我看不懂虛線的用法」「你有文字筐會影響線條」
「那個線條說明你也要做個可以隱藏在角落的機制」「分支合併的那個線條有出現錯位的感覺」。

**改了什麼**（`Graph.tsx`）：
- **虛線規則講清楚**：實線＝會推動日期（排程依賴），虛線＝不會。
  語意關聯改成較深的 `#64748b` + `7 4`，階層改成稀疏點 `1 5`，兩者一眼分得開。
- **線上的字改用描邊**：拿掉 `labelShowBg` 的白底方框，改成 `paintOrder: 'stroke'`
  加畫布底色的粗描邊（`labelText()`），字看得清楚又不會把線切斷。
- **說明收到角落**：工具列的「圖例」按鈕與常駐提示都拿掉，改成畫布左下角的
  「？線條說明」小藥丸，展開才佔位。`LegendRow` 改用 `<svg><line>`，
  才能跟畫面上的線用同一組 `strokeDasharray`。
- **錯位修正**：`nodeDragThreshold={4}`。React Flow 預設是 1，
  點一下若手指抖了 1–2px 就會被當成拖曳寫進 `dragged`，
  那一張節點就會離開欄位（實測 678.458px vs 680px），看起來像分岔線畫歪了。

---

### 2026-08-03 — 補上程式地圖 CODEMAP.md

**為什麼**：使用者說「你應該有做架構圖、知道程式架構，應該就知道該改哪裡」。
`ARCHITECTURE.md` 確實存在，但它是最早的設計稿 —— 上面寫 Spring Boot 3.5 / Java 21 / JPA /
Flyway / Valkey / STOMP，**實作是 Fastify + TypeScript + postgres.js**，照著它找檔案只會找錯地方。

**改了什麼**：
- `docs/CODEMAP.md`（新）— 「想改 X → 去哪個檔」對照表、前後端每個檔案的行數與職責、
  資料表清單，以及踩過的坑（Graph 的 `measured`、不能引 elkjs、快取鍵沒有使用者、
  migration 有 checksum 不能改、tag 沒有 v）。
- `docs/ARCHITECTURE.md` — 開頭加警告，指向 CODEMAP。
- `docs/CHANGELOG.md` — 開頭指向 CODEMAP。

---

### 2026-08-03 — 換帳號沒清快取，畫面留著前一個人的資料

**為什麼**：驗成員功能時登出 demo、改登 tester，畫面上還是 demo 的專案、側欄與成員面板。
伺服器那邊是好的（tester 的 token 去要 MRG 就是 403），但**在重新抓到之前，上一個人的資料已經在螢幕上了**。
共用電腦上這不能接受。根因：TanStack Query 的快取鍵 `['projects']`、`['tasks', id]` 裡沒有使用者，
換人不會讓它失效；`projectId` 又住在 `App` 的 state 裡，登出也沒清。

**改了什麼**：
- `apps/web/src/lib/auth.tsx` — 拿 `useQueryClient()`，登入成功與登出時都 `qc.clear()`。
  登入那次要在 `setUser` **之前**清，否則新畫面會先讀到舊快取再被清掉，畫面會閃。
- `apps/web/src/App.tsx` — render 期間比對 `user.id`，換人就把 `projectId` / `view` / `openTask` 歸零
  （React 官方認可的 adjusting-state-during-render 寫法，比 useEffect 少一次錯誤的 render）。

**驗證**：demo → 登出 → tester 登入，直接落在選專案頁，只看得到「其他專案」。

---

### 2026-08-03 — 成員權限：前端 UI

**為什麼**：後端的核准制做完了但沒有入口，等於沒有這個功能。

**改了什麼**：
- `apps/web/src/components/MembersPanel.tsx`（新）— 加入申請（核准時一併選角色／婉拒）、
  成員清單（改角色／移除）、直接加入成員。**待審清單與所有按鈕都掛在後端回的 `canManage` 底下**，
  不是前端自己猜。建立者自己不能改角色、不能被移除，否則專案會沒人管成員。
- `apps/web/src/pages/ProjectPicker.tsx` — 多一區「其他專案」：同工作區、自己還不是成員的專案，
  只露門面（代碼、名稱、誰開的、幾人），按「申請加入」可填理由，送出後變「審核中／撤回申請」。
  自己的專案卡片上多一顆 🙋 待審人數（這個數字後端只給建立者）。
- `apps/web/src/App.tsx` — 多一個「成員」頁籤，待審 > 0 時掛紅點。
- `apps/api/src/routes/members.ts` — 補 `GET /workspace-users`：原本沒有「同工作區有哪些帳號」的端點，
  「直接加入成員」的下拉選單就沒東西可列。

**驗證**：tester 申請加入 MRG → demo 端看到卡片 🙋 1、頁籤紅點 1 → 核准 → 成員 2 人、紅點消失、
下拉變成「同工作區的帳號都已經在這個專案裡了」。

---

### 2026-08-03 — 關聯圖：卡住與並行標記

**為什麼**：使用者要看出「任務被上一個任務卡住無法處理」與「任務可以同時並行」。

**改了什麼**：`apps/web/src/pages/Graph.tsx`，節點上多兩個徽章、工具列多兩個開關。
- **卡住**（🚧，紅框＋紅徽章，預設開）：上游還沒 DONE 就算卡住。FS/BLOCKS/REQUIRES 看上游是不是 DONE，
  SS 只有上游還在 TODO 才算（上游已經動起來了就不算卡）。自己已經 DONE 就不標。
- **並行**（⇉，預設關）：**日期有重疊 + 彼此在流程上沒有先後 + 不是父子祖孫**。
  「沒有先後」是拿 FS/SF 邊做可達性 DFS 算的（SS/FF 不算先後，那正是同時做）。
  預設關掉是因為並行對數會隨任務數量長很快，全開會太吵。
- 圖例多一段「節點上的標記」，焦點面板也解釋這兩個顏色。

**驗證**：MRG 上 MRG-5/6/7 有 🚧；勾選並行後 MRG-6、MRG-7 出現「⇉ 並行 1」。

---

### 2026-08-03 — 關聯圖：階層線補上「包含」標籤

**為什麼**：使用者說「我看不懂虛線關聯是啥」。父子階層線原本沒有文字，畫面上就是一條灰虛線，
跟語意關聯（relates/blocks）的虛線只差在深淺與虛線間距，根本分不出來。
這個模組的規矩是**每條線上都有中文短句，圖例只是輔助**。

**改了什麼**：`apps/web/src/pages/Graph.tsx` — 階層邊加上 `label: '包含'`，
連同 `labelShowBg` / `labelBgPadding` / `labelStyle`，並讓標籤跟著既有的 `dim()` 一起淡出。

**驗證**：重建 web 容器 → 開 MRG 機房搬遷 → 關聯圖 → 7 條父子線上都要看得到「包含」。

---

### 2026-08-03 — 成員權限：創立者核准制（後端）

**為什麼**：使用者要求「專案創立者才有權限讓別的帳號加入，其他帳號是申請加入、要創立者同意」。
過程中發現更大的缺口：**原本完全沒有加成員的 API**，建專案的人是唯一 MANAGER，
其他人註冊後雖然自動進工作區，但 `GET /projects` 只列自己是成員的專案，登入後一個都看不到。

**改了什麼**：
- `apps/api/src/migrations/0002_project_membership.sql`（新）— `project.created_by`（回填最早的 MANAGER，
  uuidv7 有時序所以可以這樣挑）、`project_member.joined_at/added_by`、`project_join_request` 表。
  狀態 PENDING/APPROVED/REJECTED/CANCELLED，**部分唯一索引只鎖 PENDING**，所以被婉拒後可以再申請。
- `apps/api/src/lib/auth.ts` — `requireProjectCreator`、`requireWorkspaceMember`。
- `apps/api/src/routes/members.ts`（新）— 可申請的專案清單、成員 CRUD、申請／核准／婉拒／撤回。
  核准用 `FOR UPDATE` + `ON CONFLICT DO NOTHING`，連點兩下不會重複加人。
- `apps/api/src/routes/projects.ts` — 建立時寫 `created_by`；清單多回 `isCreator` 與 `pendingJoinRequestCount`。
- `apps/api/src/index.ts` — 註冊 `memberRoutes`。
- `apps/web/src/lib/api.ts` — 型別與 11 個端點函式。

**刻意的設計決定**：創立者是獨立欄位、不沿用 MANAGER 角色 —— 角色是「能做什麼」可以有很多個，
創立者是「這專案誰開的」只有一個。不能移除創立者、不能改創立者自己的角色。
沒做通知信（系統還沒有寄信的東西），待審靠畫面上的數字提醒。

**驗證**：型別過了，**尚未在畫面上驗證**（前端 UI 還沒做）。

---

### 2026-08-03 — 關聯圖：同時開始／完成改成分岔與合流

**為什麼**：使用者指出「同時開始跟同時完成不應該在同一線上」。原本 SS/FF 跟 FS 一樣往右推一欄，
畫出來像接力賽，語意是錯的 —— 示範資料裡 MRG-6 與 MRG-7 明明都是 08/22 開始，卻被排在不同欄。
接著他定下畫法：**一路箭頭分成多路（同時開始）、多路箭頭合成一路（同時完成）**。

**改了什麼**：`apps/web/src/pages/Graph.tsx`
- `layout()` 多收 `linkType`，用 union-find 把 SS/FF 兩端併成同一欄；只有 FS/SF 才推層級。
- `TaskNodeView` 除了原本的 `in`（左）/`out`（右），多兩個隱形錨點：
  `fork`（左緣的 source）、`join`（右緣的 target），`isConnectable={false}` 不讓使用者從這裡拉線。
- 邊的路由：`sourceHandle: type === 'SS' ? 'fork' : 'out'`、`targetHandle: type === 'FF' ? 'join' : 'in'`。
  沒有這兩個錨點時，同欄的 SS 線會從右邊繞一個 U 型迴到左邊。

**驗證**：畫面上 MRG-6／MRG-7 同欄，線呈分岔／合流。

---

### 2026-08-03 — 關聯圖：節點不顯示／fitView 不觸發

**為什麼**：8 個節點全部卡在 `visibility: hidden`，`nodesInitialized` 永遠是 false。

**根因**（對照 `@xyflow/system` 原始碼確認，不是猜的）：`adoptUserNodes` 每次收到新的 nodes 陣列時，
是**照著 `node.measured` 重建內部尺寸**。而這裡的節點是每次 render 從資料重算的衍生物件、身上沒有 `measured`，
等於每次 render 都把 React Flow 剛量到的尺寸抹成 undefined。

**改了什麼**：`apps/web/src/pages/Graph.tsx`
- 新增 `measured` state，`onNodesChange` 收下 dimensions 變更（尺寸沒真的變就不換物件，
  否則平移縮放時 ResizeObserver 重送同值會讓整張圖白白重畫）。
- `styledNodes` 把 `measured[n.id]` 疊回節點上。
- 順手修掉「重新排列」按鈕不重新框視野：fitView 的 effect 少了 `relayout` 依賴，
  按鈕設好的 `fitPending` 要等下次換資料才會被消化。

**驗證**：DOM 量測 `count:8`、`hidden:0`、`edges:12`、viewport scale `0.870787`（不是 1）。

---

> 下面這幾筆是**事後補的**。`CHANGELOG.md` 是 2026-08-03 才建立的（見那天的
> 「補上程式地圖」），在那之前的異動當時沒有留紀錄，這裡照 git log 補回索引與
> 一句話說明，細節請看那幾個 commit 本身。**當初的判斷理由已經無從考證的就不寫**，
> 寧可留白也不要編一個看起來合理的原因。

### 2026-08-01 — 行事曆視圖

月曆格、跨日長條、拖曳改期。日期的顯示與工作日計算另外收在 `lib/date.ts`
（排程真正的算法在後端 `lib/schedule.ts`，前端這支只做顯示）。
沒有用 `react-big-calendar` —— 設計稿寫的那個套件最後沒有採用，月格是自己畫的。

### 2026-08-01 — 發版流程與 NAS 部署

正式部署走 Synology 的 Container Manager，所以另外備一份
`docker-compose.synology.yml`；README 與 `.env.example` 一起對齊實際的發版步驟。

### 2026-08-01 — 發版一路踩到底的四個坑

同一天連續四個 commit 都在修發版：`trivy-action` 的版本號根本不存在導致整條發佈中斷、
正式映像裡跑不起來 `migrate`、雙 registry 的映像名稱跟服務名不一致、
以及補上 `.dockerignore`（把 `node_modules` 與建置產物擋在 build context 外）。

### 2026-08-01 — e2e 改用標題定位任務

原本靠任務編號定位，資料一變順序就整份對不上。父子任務之間的依賴衝突
從 400 改回 409 —— 那是「跟現況衝突」不是「你送錯東西」。

### 2026-08-01 — 初版

開源專案管理系統的第一版：Fastify + TypeScript + 自寫 migration runner 的後端，
React 19 + Vite + Tailwind 的前端，任務／關聯／發文追蹤（現在叫對外詢問）
與示範資料都在裡面。
