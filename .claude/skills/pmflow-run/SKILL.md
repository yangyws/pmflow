---
name: pmflow-run
description: 起 PMFlow 本機環境並在真的畫面上驗證改動 —— 建置、登入示範帳號、走到目標視圖、截圖與 DOM 檢查。當任務是「跑起來看看」「確認改動有效」「截個圖」，或改完 apps/web、apps/api 需要驗證時使用。
---

# 跑 PMFlow 並驗證改動

工作副本在 `D:\NewProject\pmflow-git`。**不要只靠 typecheck 就宣稱改好了** ——
這個專案踩過的坑（節點停在 visibility:hidden、fitView 不觸發）型別全都是過的，
只有在畫面上才看得出來。

## 1. 起環境

Docker Desktop 常常沒在跑，先確認：

```bash
docker info --format '{{.ServerVersion}}'
```

沒回應就啟動它，然後等到守護程序真的起來（約 10–30 秒）：

```bash
"$LOCALAPPDATA/Programs/DockerDesktop/Docker Desktop.exe" &
for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 10; done
```

起整套：

```bash
cd /d/NewProject/pmflow-git
docker compose -f docker-compose.dev.yml up --build -d
```

只改了前端就只重建 web（快很多）：

```bash
docker compose -f docker-compose.dev.yml up --build -d web
```

web 容器內跑 `npm ci && tsc -b && vite build`，所以**它建得起來就代表 lockfile
與型別都沒問題**。等它真的能服務再往下走：

```bash
for i in $(seq 1 25); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8480)" = "200" ] && { echo ready; break; }
  sleep 3
done
```

## 2. 開畫面

前端 http://localhost:8480，示範帳號 `demo@pmflow.local` / `demo1234`（通常已是登入狀態）。

用 claude-in-chrome：`navigate` 到 localhost:8480 → 截圖 → 點專案 → 點分頁。

**每次截圖前先確認視窗尺寸**：視窗大小會變（1536x674 ↔ 1568x693），
沿用上一張截圖的座標會點空。先 screenshot 再決定座標。

## 3. 驗證

示範資料剛好涵蓋各種情況，可以拿來當斷言的依據：

- MRG「機房搬遷」8 個任務、5 條關聯（FS×2 / SS / FF / RELATES）、7 個父子、1 張逾期
- WEB「官網改版」1 個任務

截圖之外，用 `javascript_tool` 直接量 DOM 比肉眼可靠。關聯圖的例子：

```js
const ns=[...document.querySelectorAll('.react-flow__node')];
JSON.stringify({
  count: ns.length,
  hidden: ns.filter(n=>getComputedStyle(n).visibility==='hidden').length,
  viewport: document.querySelector('.react-flow__viewport')?.style.transform,
  edges: document.querySelectorAll('.react-flow__edge').length,
})
```

預期 `count:8`、`hidden:0`、`edges:12`、viewport 的 scale **不是 1**
（是 1 代表 fitView 沒生效，右邊節點會被切掉）。

## 4. 後端改動

改了 `apps/api` 要重建 api 容器。動到 schema 的話 migration 在容器啟動時自動跑，
看 log 確認：

```bash
docker compose -f docker-compose.dev.yml logs api --tail 30
```

migration 是 append-only + checksum 檢查，**已套用的檔案改內容會直接開機失敗**，
要修就新增下一個編號的檔案。

## 環境坑

- 複合指令用 `&&` 串起來時，每一段都要被權限規則允許
- PowerShell 傳中文參數給 git 容易亂碼，**commit 訊息用英文**
- Windows 兩個帳號會讓 git 報 dubious ownership，要加 safe.directory
- 授權白名單掃描只在 CI 跑，不要放回 Dockerfile（arm64 QEMU 下會拖垮建置）
