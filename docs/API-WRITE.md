# 用 API 權杖把資料寫進 PMFlow

> **這份是所有 AI 共用的技能文件**（Claude Code / Gemini CLI / Codex…）。
> 各工具自己的 skill 檔只是一行指標，內容一律以這份為準 —— 三份各自維護一定會走鐘。
> 規矩總表在 `D:\NewProject\AGENTS.md`。（Ref: CR-147）

## 這份在講什麼

從外部腳本、其他系統、或 AI 直接把資料寫進 PMFlow，**不要去戳資料庫**，一律走 API 權杖。
理由：資料庫直寫會繞過排程重算、閉包表重建、對外詢問狀態、活動紀錄與通知 ——
那些都在 API 層做，繞過去的資料在畫面上會是壞的。

## 一、先拿一把權杖（只有人做得到，AI 做不到）

登入換來的 access token 只有 15 分鐘，續期要靠瀏覽器的 refresh cookie，腳本走不了那條路。

1. 網站右上角 →「帳號設定」→「API 權杖」→ 填用途名稱（到期日可留空）→ 建立。
2. **明文只會顯示這一次**，當下沒複製就再也拿不到（伺服器只留 sha256 雜湊）。
3. 弄丟就撤銷舊的重發一把；不用了也請撤銷，撤銷立刻生效。

權杖以 `pmflow_` 開頭（誤貼進程式碼時掃得出來），用法就是標準的
`Authorization: Bearer <權杖>`，**其餘端點與參數一個字都沒變**。

對應端點（要用網頁登入的身分才打得動，不能用權杖去發權杖）：
`GET/POST /me/api-tokens`、`DELETE /me/api-tokens/:id`。

## 二、權限：權杖不會讓你變大

**權杖的權限完全等於發它的那個人。** 他在某專案是 EDITOR，這把權杖就是 EDITOR。
而且 2026-08-17 之後多了一層**關係人判斷**（Ref: CR-130），這是最常見的 403 來源：

- **改任務**：除了角色要 EDITOR 以上，還必須是**開單人／負責人／專案管理者／代理人**其中之一。
  拿權杖去改別人開的任務，照樣 403。
- **例外**：只送 `problem` 一個欄位（「目前遇到的問題」）時，專案裡任何人都可以。
  登錄對外詢問的回覆（`mark-replied`）也一樣開放給所有專案成員。
- **關聯線**：建立時只驗**發起端**是不是關係人 —— 所以「我的任務要等你的任務做完」這種
  跨人依賴是建得起來的。刪除則驗發起端。
- **已完成的任務是鎖定的**：狀態屬於「做完了」那一類時，只有專案管理者改得動。
- **父任務必須在同一個專案**（Ref: CR-134）。

錯誤碼怎麼讀（回應是 RFC 7807 `application/problem+json`，`title` 就是中文說明）：

| 狀態 | 意思 |
|---|---|
| `401` | 權杖無效／已撤銷／已過期 |
| `403` | 角色不夠、不是關係人、或帳號被停用 |
| `400` | 欄位不合法（例如種類不在該專案的參數裡、父任務跨專案） |
| `409` | 衝突（例如會造成循環依賴、重複的關聯） |

## 三、基本用法

```bash
TOKEN=pmflow_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BASE=http://localhost:8480/api/v1        # 正式站換成對外網址

auth=(-H "Authorization: Bearer $TOKEN")
json=(-H 'Content-Type: application/json')

# 先找出專案 id
curl -s "${auth[@]}" "$BASE/projects"
```

### 建一張任務

`POST /projects/{專案 id}/tasks`（需要該專案 EDITOR 以上）

```bash
curl -s -X POST "$BASE/projects/$PID/tasks" "${auth[@]}" "${json[@]}" -d '{
  "title": "外部系統送進來的請修單",
  "description": "三樓走廊燈不亮",
  "type": "TASK",
  "priority": "HIGH",
  "dueDate": "2026-08-31"
}'
```

回傳是一般的任務物件（含 `id` 與 `ref`，例如 `OPS-42`）。
可帶欄位跟前端建任務時一樣，權威來源是 `apps/api/src/routes/tasks.ts` 的 `createBody`。

> **`type` 與 `priority` 是每個專案自己定義的**（不是固定清單）。送進去的值必須存在於
> 該專案的系統參數，否則 400。先用 `GET /projects/{id}` 看該專案有哪些種類與優先度。

### 掛在某張任務底下（父子）

建立時帶 `parentId`，或事後 `PATCH /tasks/{id}`。**父任務必須同專案。**

### 建立關聯線

`POST /tasks/{來源 id}/links`

```bash
curl -s -X POST "$BASE/tasks/$SRC/links" "${auth[@]}" "${json[@]}" -d '{
  "targetId": "'"$TGT"'",
  "linkType": "FS",
  "lagDays": 0
}'
```

`linkType`：排程類 `FS`／`SS`／`FF`／`SF`（會影響日期與要徑），
語意類 `RELATES`／`BLOCKS`／`DUPLICATES`／`REQUIRES`（不影響排程）。

> 畫面上一律講完整句子（「等待任務完成，才能開始」），**不要在 UI 出現這些英文縮寫** ——
> 那是資料庫的值，不是給人看的字。

### 登錄對外詢問

```bash
# 發出一筆詢問
curl -s -X POST "$BASE/tasks/$TID/inquiries" "${auth[@]}" "${json[@]}" -d '{
  "askedToUnit": "資訊室",
  "question": "請確認防火牆規則",
  "dueDate": "2026-08-25"
}'

# 對方回了（這支開放給所有專案成員）
curl -s -X POST "$BASE/inquiries/$IID/mark-replied" "${auth[@]}" "${json[@]}" -d '{
  "repliedByUnit": "資訊室",
  "replyNote": "已開通"
}'
```

**只要還有詢問沒回，那張任務就不能改成「做完了」那一類的狀態**（會被擋下來）。
「沒回」指的是還在等與逾期兩種，已回覆的不算。

### 建立與更新系統架構流程圖 (System Flow Canvas)

`PUT /projects/{專案 id}/canvas-docs/system-flow`（需要該專案畫布編輯權限）

```bash
# 儲存多頁系統架構圖 (Page Tabs)
curl -s -X PUT "$BASE/projects/$PID/canvas-docs/system-flow" "${auth[@]}" "${json[@]}" -d '{
  "data": [
    {
      "id": "page-1",
      "title": "01. 端對端全流程架構",
      "nodes": [
        {
          "id": "frame-left",
          "type": "frame",
          "position": { "x": 50, "y": 50 },
          "style": { "width": 3600, "height": 1400 },
          "data": { "label": "【前端應用區域】", "color": "#3b82f6", "mode": "frame" }
        },
        {
          "id": "box-client",
          "type": "box",
          "position": { "x": 80, "y": 120 },
          "style": { "width": 3500, "height": 360 },
          "data": { "label": "【業務端 (meet 前端)】", "desc": "業務員操作介面", "color": "#6366f1", "icon": "🧑‍💼", "mode": "box" }
        },
        {
          "id": "step-1",
          "type": "step",
          "position": { "x": 120, "y": 240 },
          "data": { "label": "【階段 1】開啟視訊", "desc": "載入會議室", "role": "🧑‍💼 業務員", "color": "#6366f1", "icon": "🎥", "mode": "step" }
        }
      ],
      "edges": [
        {
          "id": "e-1",
          "source": "step-1",
          "target": "step-2",
          "sourceHandle": "right-out",
          "targetHandle": "left-in",
          "type": "flowEdge",
          "data": { "text": "發起 API 請求", "color": "#4f46e5", "waypoint": { "x": 400, "y": 240 } },
          "style": { "stroke": "#4f46e5", "strokeWidth": 2 }
        }
      ]
    }
  ]
}'
```

> **節點層級、接點與連線樣式規則 (CR-207, CR-208)**：
> - `frame`：區域標示框（置底 `z-index: -2`）。
> - `box`：模組收納盒／泳道框（置底 `z-index: 0`）。
> - `step`：流程卡片（`z-index: 5`）。
> - 四向接點 Handle ID 一律為 `left-in` / `left-out`、`right-in` / `right-out`、`top-in` / `top-out`、`bottom-in` / `bottom-out`。
> - 連線樣式：`data.color` 支援 9 色（`#4f46e5` 靛青藍、`#3b82f6` 經典藍、`#10b981` 翠玉綠、`#8b5cf6` 優雅紫、`#f97316` 活力橘、`#ef4444` 熱情紅、`#64748b` 深沉灰、`#06b6d4` 晴空青、`#ec4899` 玫瑰粉）；未手動拉折點且距離 `< 70px` 時自動隱藏中央折點圓點。

### 還原已軟刪除的任務與收納盒 (Restore Task)

`POST /tasks/{任務 id}/restore`

```bash
# 模式可選：all（連帶還原所有子孫）、self_only（僅還原自身）、detach_parent（還原並脫離父收納盒成為頂層獨立卡片）
curl -s -X POST "$BASE/tasks/$TID/restore" "${auth[@]}" "${json[@]}" -d '{
  "mode": "all"
}'
```

## 四、寫成腳本的規矩（專案硬規定）

**會再跑第二次的東西一律寫成可以重複執行的腳本**，不要留一串「照著貼」的指令。
判準很簡單：**跑第二次不能出事**。

- 建立前先查有沒有（比照 migration 的 `NOT EXISTS`、seed 的 idempotent 寫法），
  已經有的就跳過，不要建出第二份。
- 中途失敗要能再跑一次，而不是留下半套。
- 放在專案根目錄：`*.bat` 給他在 Windows 點、`*.sh` 給容器裡跑。
  **檔頭寫清楚它會做什麼、重跑安不安全。**
- 批次檔必須**純 ASCII + CRLF**，否則 cmd.exe 會吃掉每行第一個字元。

冪等的最小骨架：

```bash
# 先用標題查，有了就跳過 —— 這支腳本可以無限次重跑
existing=$(curl -s "${auth[@]}" "$BASE/projects/$PID/tasks?search=$(printf %s "$TITLE" | jq -sRr @uri)" \
           | jq -r --arg t "$TITLE" '.tasks[] | select(.title == $t) | .id' | head -1)
if [ -n "$existing" ]; then
  echo "已存在，跳過：$TITLE ($existing)"
else
  curl -s -X POST "$BASE/projects/$PID/tasks" "${auth[@]}" "${json[@]}" -d "{\"title\":\"$TITLE\"}"
fi
```

## 五、不要做的事

- **不要直接寫資料庫**（理由見開頭）。
- **不要把權杖寫進 repo**。用環境變數或 `.env`，`.env` 不進版控。
- **不要為了繞過 403 去改權限判斷** —— 被擋通常代表這件事本來就不該由這個身分做。
- **不要用權杖去發新的權杖**（那條路要網頁登入的身分）。

## 相關檔案

- 端點與參數的權威來源：`apps/api/src/routes/*.ts`
- 權限判斷：`apps/api/src/lib/auth.ts` 的 `require*` 與 `assertTaskStakeholder`
- 找功能住在哪個檔：`docs/CODEMAP.md`
- 為什麼這樣改：`docs/CHANGELOG.md`（查索引編號 `CR-xxx`）
