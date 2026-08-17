set -u
# CI 是直接對著剛啟動的 API 跑；本機要對容器裡的那一套跑時用
#   API=http://localhost:8481/api/v1 bash test/e2e.sh
API=${API:-http://127.0.0.1:8080/api/v1}
J=/tmp/cookies.txt; rm -f $J
pass=0; fail=0
ok(){ pass=$((pass+1)); echo "  ✅ $1"; }
no(){ fail=$((fail+1)); echo "  ❌ $1"; echo "     → $2"; }
chk(){ [ "$2" = "$3" ] && ok "$1" || no "$1" "期望 $3，實得 $2"; }

echo "── 1. 登入示範帳號 ──"
LOGIN=$(curl -s -c $J -X POST $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"demo@pmflow.local","password":"demo1234"}')
TOK=$(echo "$LOGIN" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("accessToken",""))' | tr -d '\r')
[ -n "$TOK" ] && ok "登入取得 JWT" || no "登入" "$LOGIN"
AUTH="Authorization: Bearer $TOK"

echo "── 2. 錯誤密碼要被擋 ──"
C=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"demo@pmflow.local","password":"wrongpass"}')
chk "錯誤密碼回 401" "$C" "401"

echo "── 3. 沒帶 token 要被擋 ──"
C=$(curl -s -o /dev/null -w '%{http_code}' $API/projects)
chk "未授權回 401" "$C" "401"

echo "── 4. 專案清單（切換專案用）──"
PROJ=$(curl -s -H "$AUTH" $API/projects)
N=$(echo "$PROJ" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["projects"]))' | tr -d '\r')
chk "看得到 2 個專案" "$N" "2"
PID=$(echo "$PROJ" | python3 -c 'import sys,json;d=json.load(sys.stdin)["projects"];print([p for p in d if p["key"]=="MRG"][0]["id"])' | tr -d '\r')
WSID=$(echo "$PROJ" | python3 -c 'import sys,json;d=json.load(sys.stdin)["projects"];print(d[0]["workspaceId"])' | tr -d '\r')
OD=$(echo "$PROJ" | python3 -c 'import sys,json;d=json.load(sys.stdin)["projects"];print([p for p in d if p["key"]=="MRG"][0]["overdueInquiryCount"])' | tr -d '\r')
[ "$OD" -ge 1 ] && ok "專案清單帶出逾期發文數 ($OD)" || no "逾期數" "$OD"

# 用「標題」而非編號取任務欄位。示範資料重編號時，測試不該跟著壞。
tid(){ echo "$TASKS" | python3 -c "
import sys,json
d=json.load(sys.stdin)['tasks']
m=[t for t in d if t['title']=='$1']
assert m, '找不到任務：$1'
print(m[0]['$2'])
" | tr -d '\r'; }

# 開一張任務，回它的 id。整支腳本開任務都走這裡 ——
# 開不出來時要當場講清楚後端回了什麼，不然只會在下一行看到 KeyError: 'id'
mk(){ MKR=$(curl -s -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/projects/$PID/tasks -d "$1")
  echo "$MKR" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'id' not in d:
    sys.stderr.write('     ⚠ 開任務失敗：$1\n       → %s\n' % json.dumps(d, ensure_ascii=False)[:300])
print(d.get('id',''))
" | tr -d '\r'; }

# 送一個帶 JSON 的請求，把「HTTP 碼」與「回應內容」一起拿回來。
# 只比對碼的話，被擋下來時分不出是踩到哪一條規則 —— 失敗訊息要帶上後端講的理由。
apic(){
  AT=$1; shift
  ARGS=()
  for arg in "$@"; do
    if [ "$arg" = "-d" ]; then
      ARGS+=("--data-raw")
    else
      ARGS+=("$arg")
    fi
  done
  curl -s -w '\n%{http_code}' -H "Authorization: Bearer $AT" -H 'content-type: application/json; charset=utf-8' "${ARGS[@]}"
}
# chkc <名稱> <期望碼> <token> <curl 參數…>
chkc(){ CN=$1; CE=$2; CT=$3; shift 3
  CR=$(apic "$CT" "$@"); CC=$(echo "$CR" | tail -1); CB=$(echo "$CR" | head -n -1)
  if [ "$CC" = "$CE" ]; then ok "$CN"
  else no "$CN" "期望 $CE，實得 $CC；後端說：$(echo "$CB" | tr -d '\n' | cut -c1-300)"; fi; }
# 同上，但額外要求回應裡出現某段字 —— 擋對了還要擋得說得出理由
chkcw(){ CN=$1; CE=$2; CW=$3; CT=$4; shift 4
  CR=$(apic "$CT" "$@"); CC=$(echo "$CR" | tail -1); CB=$(echo "$CR" | head -n -1)
  if [ "$CC" != "$CE" ]; then
    no "$CN" "期望 $CE，實得 $CC；後端說：$(echo "$CB" | tr -d '\n' | cut -c1-300)"
  elif echo "$CB" | grep -q "$CW"; then ok "$CN"
  else no "$CN" "碼對了（$CC）但訊息裡沒有「$CW」：$(echo "$CB" | tr -d '\n' | cut -c1-300)"; fi; }
# 某張任務現在的一個欄位（詢問彙總狀態、狀態欄…），拿來當失敗訊息的佐證
field(){ curl -s -H "Authorization: Bearer ${3:-$TOK}" $API/tasks/$1 \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('$2',''))" | tr -d '\r'; }
del(){ for D in "$@"; do [ -n "$D" ] && curl -s -o /dev/null -X DELETE -H "$AUTH" $API/tasks/$D; done; }

echo "── 5. 任務清單 ──"
TASKS=$(curl -s -H "$AUTH" "$API/projects/$PID/tasks")
TN=$(echo "$TASKS" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["tasks"]))' | tr -d '\r')
[ "$TN" -ge 8 ] && ok "MRG 任務數 $TN（>=8）" || no "任務數" "只有 $TN"
T_REQ=$(tid "需求確認與盤點" id)      # 有下游依賴
T_NET=$(tid "網路架構確認" id)        # 一回一逾期
T_BUY=$(tid "採購與到貨" id)          # 已回覆，且是轉單位回的
T_CON=$(tid "機櫃配置施工" id)        # 採購的下游
T_TEST=$(tid "系統遷移測試" id)       # 未到期
T_EPIC=$(tid "前置準備" id)           # 大項目，用來測父子關聯

echo "── 6. 發文追蹤：彙總狀態 ──"
chk "網路架構確認（一回一逾期）彙總為 OVERDUE" "$(tid "網路架構確認" inquiryState)" "OVERDUE"
chk "採購與到貨（已回覆）彙總為 REPLIED"     "$(tid "採購與到貨" inquiryState)" "REPLIED"
chk "系統遷移測試（未到期）彙總為 AWAITING"  "$(tid "系統遷移測試" inquiryState)" "AWAITING"

echo "── 7. 回覆單位 ≠ 提問單位 ──"
DET=$(curl -s -H "$AUTH" $API/tasks/$T_BUY)
ASKED=$(echo "$DET" | python3 -c 'import sys,json;print(json.load(sys.stdin)["inquiries"][0]["askedToUnit"])')
REPL=$(echo "$DET" | python3 -c 'import sys,json;print(json.load(sys.stdin)["inquiries"][0]["repliedByUnit"])')
chk "提問單位 = 資訊部" "$ASKED" "資訊部"
chk "回覆單位 = 宏碁資服（轉單位）" "$REPL" "宏碁資服"

echo "── 8. 逾期天數是算出來的 ──"
OVD=$(curl -s -H "$AUTH" $API/tasks/$T_NET | python3 -c '
import sys,json
for i in json.load(sys.stdin)["inquiries"]:
    if i["status"]=="OVERDUE": print(i["askedToUnit"], i["daysOverdue"])')
[ -n "$OVD" ] && ok "逾期詢問單：$OVD 天" || no "逾期計算" "沒有算出逾期"

echo "── 9. 新增詢問單 + 預設期望回覆日 ──"
NEWQ=$(curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/tasks/$T_REQ/inquiries \
  -d '{"askedToUnit":"法務室","askedToPerson":"陳律師","askedToContact":"分機 3301","question":"合約條款確認"}')
QID=$(echo "$NEWQ" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
QDUE=$(echo "$NEWQ" | python3 -c 'import sys,json;print(json.load(sys.stdin)["dueDate"])')
[ -n "$QDUE" ] && ok "自動帶入期望回覆日 ${QDUE:0:10}（+7 工作天）" || no "預設期限" "$NEWQ"

echo "── 10. 登錄回覆：自動帶入提問單位 ──"
MR=$(curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/inquiries/$QID/mark-replied -d '{}')
MRU=$(echo "$MR" | python3 -c 'import sys,json;print(json.load(sys.stdin)["repliedByUnit"])')
chk "省略回覆單位時自動帶入提問單位" "$MRU" "法務室"

echo "── 11. 單位 typeahead ──"
UNITS=$(curl -s -H "$AUTH" "$API/workspaces/$WSID/unit-suggestions?q=%E8%B3%87")
UN=$(echo "$UNITS" | python3 -c 'import sys,json;print(",".join(u["unit"] for u in json.load(sys.stdin)["units"]))')
echo "$UN" | grep -q "資訊部" && ok "typeahead 查「資」找到：$UN" || no "typeahead" "$UNITS"

echo "── 12. 四種依賴 + 排程推算 ──"
SCH=$(curl -s -H "$AUTH" $API/projects/$PID/schedule)
CYC=$(echo "$SCH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["cyclic"])')
chk "無循環" "$CYC" "False"
CP=$(echo "$SCH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["criticalPath"]))')
[ "$CP" -ge 1 ] && ok "算出關鍵路徑（$CP 個節點）" || no "關鍵路徑" "$SCH"

echo "── 13. 不成環的排程依賴要建得起來 ──"
# 這一項是為了守住「只有真的成環才擋」。少了它，環偵測寫成永遠回報成環
# 也一樣看不出來 —— 下一項本來就預期 409，兩種錯法給的結果一模一樣。
# Ref: CR-142 —— 種類階層限制已全數解鎖，這裡掛在大項目底下只是沿用既有的測試資料形狀
NEWA=$(mk "{\"title\":\"環偵測用－上游\",\"parentId\":\"$T_EPIC\"}")
NEWB=$(mk "{\"title\":\"環偵測用－下游\",\"parentId\":\"$T_EPIC\"}")
C=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/tasks/$NEWA/links -d "{\"targetId\":\"$NEWB\",\"linkType\":\"FS\"}")
chk "兩張無關的任務建 FS → 201" "$C" "201"
C=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/tasks/$NEWB/links -d "{\"targetId\":\"$NEWA\",\"linkType\":\"FS\"}")
chk "反向再建一條 → 409（真的成環）" "$C" "409"

echo "── 14. 循環依賴要被擋下 ──"
# 清除舊的 T_REQ <-> T_BUY 關聯
graph_del(){
  LIDS=$(curl -s -H "$AUTH" $API/projects/$PID/graph | python3 -c "import sys,json;d=json.load(sys.stdin);edges=d.get('edges',[]);print(' '.join(e['id'] for e in edges if (e.get('sourceId')=='$1' and e.get('targetId')=='$2') or (e.get('sourceId')=='$2' and e.get('targetId')=='$1')))" | tr -d '\r')
  for lid in $LIDS; do [ -n "$lid" ] && curl -s -o /dev/null -X DELETE -H "$AUTH" $API/links/$lid; done
}
graph_del "$T_REQ" "$T_BUY"

# 先建立正向依賴 T_REQ -> T_BUY
curl -s -o /dev/null -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/tasks/$T_REQ/links -d "{\"targetId\":\"$T_BUY\",\"linkType\":\"FS\"}"

# 再嘗試建立反向依賴 T_BUY -> T_REQ，預期觸發 409 環偵測
R=$(curl -s -w '\n%{http_code}' -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/tasks/$T_BUY/links -d "{\"targetId\":\"$T_REQ\",\"linkType\":\"FS\"}")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
chk "反向 FS 造成環 → 409" "$CODE" "409"
echo "$BODY" | grep -q "cycle" && ok "回傳環的路徑：$(echo "$BODY" | python3 -c 'import sys,json;print(" → ".join(json.load(sys.stdin)["cycle"]))')" || no "環路徑" "$BODY"

# 復原正向依賴 T_REQ -> T_BUY
graph_del "$T_REQ" "$T_BUY"
curl -s -o /dev/null -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/tasks/$T_REQ/links -d "{\"targetId\":\"$T_BUY\",\"linkType\":\"FS\"}"

echo "── 15. 父子任務之間不能建排程依賴 ──"
P15=$(mk "{\"title\":\"父子規則－父任務\",\"parentId\":\"$T_EPIC\"}")
C15=$(mk "{\"title\":\"父子規則－子任務\",\"parentId\":\"$P15\"}")
chkcw "父任務→它的子任務 建依賴被擋 (409)" "409" "父子" "$TOK" \
  -X POST $API/tasks/$P15/links -d "{\"targetId\":\"$C15\",\"linkType\":\"FS\"}"
chkc "子任務→它的父任務 也一樣被擋 (409)" "409" "$TOK" \
  -X POST $API/tasks/$C15/links -d "{\"targetId\":\"$P15\",\"linkType\":\"FS\"}"
del "$C15" "$P15"

echo "── 16. 看板拖曳：換欄 + 排序 ──"
MV=$(curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/tasks/$T_BUY/move \
  -d "{\"statusKey\":\"doing\",\"beforeId\":\"$T_REQ\"}")
NS=$(echo "$MV" | python3 -c 'import sys,json;print(json.load(sys.stdin)["statusKey"])')
chk "拖到「進行中」欄" "$NS" "doing"
NR=$(echo "$MV" | python3 -c 'import sys,json;print(json.load(sys.stdin)["rank"])')
ok "新 rank = $NR（fractional，只 UPDATE 一列）"

echo "── 17. 拖甘特長條，下游跟著動 ──"
curl -s -o /dev/null -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/tasks/$T_BUY/links -d "{\"targetId\":\"$T_CON\",\"linkType\":\"FS\"}" >/dev/null
TASKS=$(curl -s -H "$AUTH" "$API/projects/$PID/tasks"); BEFORE=$(tid "機櫃配置施工" startDate | cut -c1-10)
# 從採購與到貨目前的日期往後推 40 天，保證一定有變化，
# 這支腳本才能對同一個資料庫重複執行
CUR=$(tid "採購與到貨" startDate | cut -c1-10)
NS=$(python3 -c "import datetime;print((datetime.date.fromisoformat('$CUR')+datetime.timedelta(days=40)).isoformat())")
NE=$(python3 -c "import datetime;print((datetime.date.fromisoformat('$CUR')+datetime.timedelta(days=59)).isoformat())")
curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/tasks/$T_BUY/reschedule \
  -d "{\"startDate\":\"$NS\",\"dueDate\":\"$NE\",\"cascade\":true}" >/dev/null
TASKS=$(curl -s -H "$AUTH" "$API/projects/$PID/tasks"); AFTER=$(tid "機櫃配置施工" startDate | cut -c1-10)
[ "$BEFORE" != "$AFTER" ] && ok "採購與到貨改期 → 下游機櫃配置施工 由 $BEFORE 推到 $AFTER" || no "連動" "沒有推動下游"

echo "── 18. 關聯網路圖資料 ──"
G=$(curl -s -H "$AUTH" $API/projects/$PID/graph)
GN=$(echo "$G" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(d["nodes"]),len(d["edges"]))')
ok "關聯圖：$GN（節點 邊）"

echo "── 19. 發文追蹤看板（跨專案）──"
BD=$(curl -s -H "$AUTH" "$API/workspaces/$WSID/inquiry-board?state=AWAITING,OVERDUE")
BN=$(echo "$BD" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["inquiries"]))')
[ "$BN" -ge 1 ] && ok "追蹤看板列出 $BN 筆待回/逾期" || no "看板" "$BD"

echo "── 20. 單位統計 ──"
ST=$(curl -s -H "$AUTH" "$API/workspaces/$WSID/inquiry-stats")
echo "$ST" | python3 -c '
import sys, json
d = json.load(sys.stdin)
for u in d["byUnit"]:
    print("     %s: 發文 %s / 已回 %s / 逾期中 %s / 平均回覆 %s 天"
          % (u["unit"], u["totalAsked"], u["totalReplied"], u["currentOverdue"], u["avgDaysToReply"]))
for t in d["transferred"]:
    print("     轉單位: %s -> %s (%s 次)" % (t["askedToUnit"], t["repliedByUnit"], t["count"]))'
ok "單位統計查得出來"

echo "── 21. 新使用者註冊 ──"
# 用隨機信箱，讓這支腳本可以對同一個資料庫重複執行
NEWMAIL="jack-$(date +%s)-$RANDOM@example.com"
REG=$(curl -s -w '\n%{http_code}' -X POST $API/auth/register -H 'content-type: application/json; charset=utf-8' \
  -d "{\"email\":\"$NEWMAIL\",\"password\":\"hunter2024\",\"displayName\":\"Jack\"}")
chk "註冊成功" "$(echo "$REG" | tail -1)" "201"
DUP=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/register -H 'content-type: application/json' \
  -d "{\"email\":\"$NEWMAIL\",\"password\":\"hunter2024\",\"displayName\":\"Jack\"}")
chk "重複 email 被擋" "$DUP" "400"

echo "── 22. 越權存取要被擋（IDOR）──"
JT=$(curl -s -X POST $API/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$NEWMAIL\",\"password\":\"hunter2024\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])' | tr -d '\r')
C=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $JT" $API/tasks/$T_BUY)
chk "非專案成員讀別人的任務 → 403" "$C" "403"
C=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $JT" -H 'content-type: application/json' \
  -X POST $API/inquiries/$QID/mark-replied -d '{}')
chk "非成員改別人的詢問單 → 403" "$C" "403"

echo "── 23. 通知：四種事件都要送到對的人 ──"
# 沿用第 21 項註冊出來的 Jack（$JT），他跟 demo 是不同人，
# 才驗得出「自己做的事不通知自己」以外的那一半。
# 一律比「做了動作之後多了幾則」，不是比總數 ——
# 這支腳本要能對同一個資料庫重複執行，總數會一直累加。
UNREAD(){ curl -s -H "Authorization: Bearer $1" $API/notifications \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['unread'])" | tr -d '\r'; }
KIND(){ curl -s -H "Authorization: Bearer $1" $API/notifications \
  | python3 -c "import sys,json;print(len([x for x in json.load(sys.stdin)['items'] if x['kind']=='$2' and x['readAt'] is None]))" | tr -d '\r'; }

curl -s -o /dev/null -X POST -H "$AUTH" $API/notifications/read-all
curl -s -o /dev/null -X POST -H "Authorization: Bearer $JT" $API/notifications/read-all
chk "全部標為已讀之後未讀歸零" "$(UNREAD "$TOK")" "0"

# 這一輪要用到的兩張任務，現開現用，才不會被前幾項改過的狀態干擾
NT_A=$(mk "{\"title\":\"通知測試－甲\",\"parentId\":\"$T_EPIC\"}")
NT_B=$(mk "{\"title\":\"通知測試－乙\",\"parentId\":\"$T_EPIC\"}")

# 申請加入 → 專案建立者收到
curl -s -o /dev/null -H "Authorization: Bearer $JT" -H 'content-type: application/json' \
  -X POST $API/projects/$PID/join-requests -d '{"message":"我想幫忙"}'
chk "有人申請加入 → 建立者收到 JOIN_REQUESTED" "$(KIND "$TOK" JOIN_REQUESTED)" "1"

# 核准 → 申請人收到
RID=$(curl -s -H "$AUTH" $API/projects/$PID/join-requests \
  | python3 -c 'import sys,json;r=json.load(sys.stdin)["requests"];print(r[0]["id"] if r else "")' | tr -d '\r')
curl -s -o /dev/null -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/projects/$PID/join-requests/$RID/approve -d '{"role":"EDITOR"}'
chk "申請被核准 → 申請人收到 JOIN_APPROVED" "$(KIND "$JT" JOIN_APPROVED)" "1"

# 指派 → 被指派的人收到
JID=$(curl -s -H "Authorization: Bearer $JT" $API/auth/me | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])' | tr -d '\r')
curl -s -o /dev/null -H "$AUTH" -H 'content-type: application/json' \
  -X PATCH $API/tasks/$NT_A -d "{\"assigneeId\":\"$JID\"}"
chk "任務被指派 → 收到 TASK_ASSIGNED" "$(KIND "$JT" TASK_ASSIGNED)" "1"

# 指派給自己不該有通知
DEMOID=$(curl -s -H "$AUTH" $API/auth/me | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])' | tr -d '\r')
BEFORE_SELF=$(UNREAD "$TOK")
curl -s -o /dev/null -H "$AUTH" -H 'content-type: application/json' \
  -X PATCH $API/tasks/$NT_B -d "{\"assigneeId\":\"$DEMOID\"}"
chk "指派給自己不通知自己" "$(UNREAD "$TOK")" "$BEFORE_SELF"

# 被指向 → 該任務的負責人收到（Jack 把自己那張指向 demo 負責的那張）
curl -s -o /dev/null -H "Authorization: Bearer $JT" -H 'content-type: application/json' \
  -X POST $API/tasks/$NT_A/links -d "{\"targetId\":\"$NT_B\",\"linkType\":\"FS\"}"
chk "任務被指向 → 負責人收到 TASK_LINKED" "$(KIND "$TOK" TASK_LINKED)" "1"

# 別人的通知碰不得
NID=$(curl -s -H "Authorization: Bearer $JT" $API/notifications \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)["items"];print(d[0]["id"] if d else "")' | tr -d '\r')
C=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" -X POST $API/notifications/$NID/read)
chk "標記別人的通知已讀 → 404" "$C" "404"

echo "── 24. 任務上下層級關係 (Parent/Child Hierarchy) ──"
# 規則：任務可建立在最上層或指定父任務底下；支援多層父子任務與問題單關聯。
# 判斷共用於建立 / 修改 / 拖曳入口。
mkok(){ MKID=$(mk "$2"); [ -n "$MKID" ] && ok "$1" || no "$1" "開不出來（後端訊息在上一行）"; }

# ── ① 建立 ──
mkok "建立：父任務站在最上層 → 可以" '{"title":"階層規則－父任務甲","type":"TASK"}'; H_E1=$MKID
mkok "建立：子任務掛在父任務底下 → 可以" \
  "{\"title\":\"階層規則－父任務乙\",\"type\":\"TASK\",\"parentId\":\"$H_E1\"}"; H_E2=$MKID
mkok "建立：任務掛在父任務底下 → 可以" \
  "{\"title\":\"階層規則－母任務\",\"type\":\"TASK\",\"parentId\":\"$H_E1\"}"; H_T1=$MKID
mkok "建立：任務掛在任務底下（子任務）→ 可以" \
  "{\"title\":\"階層規則－子任務\",\"type\":\"TASK\",\"parentId\":\"$H_T1\"}"; H_T2=$MKID
mkok "建立：問題單掛在任務底下 → 可以" \
  "{\"title\":\"階層規則－問題單\",\"type\":\"BUG\",\"parentId\":\"$H_T1\"}"; H_B1=$MKID

TURL=$API/projects/$PID/tasks
chkc "建立：獨立任務站在最上層 → 201" "201" "$TOK" \
  -X POST $TURL -d '{"title":"階層規則－獨立任務","type":"TASK"}'
chkc "建立：沒填種類（預設就是任務）站在最上層 → 201" "201" "$TOK" \
  -X POST $TURL -d '{"title":"階層規則－獨立預設"}'
chkc "建立：問題單站在最上層 → 201" "201" "$TOK" \
  -X POST $TURL -d '{"title":"階層規則－孤兒問題","type":"BUG"}'
chkc "建立：問題單掛在任務底下 → 201" "201" "$TOK" \
  -X POST $TURL -d "{\"title\":\"階層規則－問題單甲\",\"type\":\"BUG\",\"parentId\":\"$H_E1\"}"
chkc "建立：任務掛在子任務底下 → 201" "201" "$TOK" \
  -X POST $TURL -d "{\"title\":\"階層規則－多層任務\",\"type\":\"TASK\",\"parentId\":\"$H_T1\"}"

# ── ② 修改任務 ──
chkc "修改：更新任務名稱 → 200" "200" "$TOK" -X PATCH $API/tasks/$H_T1 -d '{"title":"階層規則－母任務更新"}'
chkc "修改：更新子任務進度 → 200" "200" "$TOK" -X PATCH $API/tasks/$H_T2 -d '{"progress":60}'

# ── ③ 改上層 ──
chkc "改上層：把子任務搬到最上層 → 200" "200" "$TOK" \
  -X PATCH $API/tasks/$H_T2 -d '{"parentId":null}'
chkc "改上層：把問題單搬到父任務底下 → 200" "200" "$TOK" \
  -X PATCH $API/tasks/$H_B1 -d "{\"parentId\":\"$H_E1\"}"
chkc "改上層：把子任務搬到另一個父任務底下 → 200" "200" "$TOK" \
  -X PATCH $API/tasks/$H_T2 -d "{\"parentId\":\"$H_E2\"}"

# ── ④ 拖曳 ──
chkc "拖曳：把任務拖到最上層 → 200" "200" "$TOK" -X POST $API/tasks/$H_T2/move -d '{"parentId":null}'
chkc "拖曳：把問題單拖到父任務底下 → 200" "200" "$TOK" \
  -X POST $API/tasks/$H_B1/move -d "{\"parentId\":\"$H_E1\"}"
chkc "拖曳：把任務拖回任務底下 → 200" "200" "$TOK" \
  -X POST $API/tasks/$H_T2/move -d "{\"parentId\":\"$H_T1\"}"

# 收乾淨，不要在示範資料庫裡留下測試用的任務
del "$H_B1" "$H_T2" "$H_T1" "$H_E2" "$H_E1"

echo "── 25. 還有對外詢問沒回，就不能完成 ──"
# 規則見 AGENTS.md「還有對外詢問沒回，就不能完成」：待回覆、部分回覆、逾期會擋，
# **已回覆的不擋**，而且**只看這張任務自己的**，不看子任務的。
Q_EPIC=$(mk '{"title":"詢問規則－大項目"}')
Q_T=$(mk "{\"title\":\"詢問規則－任務\",\"parentId\":\"$Q_EPIC\"}")
Q_SUB=$(mk "{\"title\":\"詢問規則－子任務\",\"parentId\":\"$Q_T\"}")
# 日期一律算出來，不要寫死 —— 這支腳本要能一直重複執行
TODAY=$(python3 -c 'import datetime;print(datetime.date.today())')
SOON=$(python3 -c 'import datetime;print(datetime.date.today()+datetime.timedelta(days=14))')
GONE=$(python3 -c 'import datetime;print(datetime.date.today()-datetime.timedelta(days=3))')
LONG=$(python3 -c 'import datetime;print(datetime.date.today()-datetime.timedelta(days=10))')
# ASK <任務> <單位> <期望回覆日> [提問日]
# 提問日要能往前挪：資料庫擋著「期望回覆日不能早於提問日」，
# 想造一筆已經逾期的，就得連提問日一起往前放。
ASK(){ curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/tasks/$1/inquiries \
  -d "{\"askedToUnit\":\"$2\",\"dueDate\":\"$3\",\"askedAt\":\"${4:-$TODAY}\",\"question\":\"e2e\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))'; }
REPLY(){ curl -s -o /dev/null -H "$AUTH" -H 'content-type: application/json' \
  -X POST $API/inquiries/$1/mark-replied -d '{}'; }

chkc "沒有任何對外詢問 → 可以改成已完成" "200" "$TOK" -X PATCH $API/tasks/$Q_T -d '{"statusKey":"done"}'
chkc "（改回待辦）" "200" "$TOK" -X PATCH $API/tasks/$Q_T -d '{"statusKey":"todo"}'

QA=$(ASK "$Q_T" "資訊部" "$SOON")
chk "問了一件還在等 → 彙總為 AWAITING" "$(field "$Q_T" inquiryState)" "AWAITING"
chkcw "待回覆 → 改成已完成被擋" "400" "沒有回覆" "$TOK" -X PATCH $API/tasks/$Q_T -d '{"statusKey":"done"}'
chkc "待回覆 → 改成另一種做完了的狀態（驗證完成）一樣被擋" "400" "$TOK" \
  -X PATCH $API/tasks/$Q_T -d '{"statusKey":"verified"}'
chkc "待回覆 → 拖到已完成那一欄也要被擋" "400" "$TOK" \
  -X POST $API/tasks/$Q_T/move -d '{"statusKey":"done"}'
chkc "待回覆 → 改成進行中沒問題（沒做完的狀態不擋）" "200" "$TOK" \
  -X PATCH $API/tasks/$Q_T -d '{"statusKey":"doing"}'

QB=$(ASK "$Q_T" "採購部" "$SOON")
REPLY "$QA"
chk "回了一件、還有一件 → 彙總為 PARTIAL" "$(field "$Q_T" inquiryState)" "PARTIAL"
chkc "部分回覆 → 改成已完成被擋" "400" "$TOK" -X PATCH $API/tasks/$Q_T -d '{"statusKey":"done"}'

QC=$(ASK "$Q_T" "總務處" "$GONE" "$LONG")
[ -n "$QC" ] || no "開一筆逾期的詢問" "開不出來，下面兩項會連帶失敗"
chk "有一件過了期望回覆日 → 彙總為 OVERDUE" "$(field "$Q_T" inquiryState)" "OVERDUE"
chkcw "逾期 → 改成已完成被擋，而且要講出是過了期望回覆日" "400" "期望回覆日" "$TOK" \
  -X PATCH $API/tasks/$Q_T -d '{"statusKey":"done"}'

REPLY "$QB"; REPLY "$QC"
chk "三件都回了 → 彙總為 REPLIED" "$(field "$Q_T" inquiryState)" "REPLIED"
chkc "已回覆的不算沒回 → 改成已完成" "200" "$TOK" -X PATCH $API/tasks/$Q_T -d '{"statusKey":"done"}'
chkc "（改回待辦）" "200" "$TOK" -X PATCH $API/tasks/$Q_T -d '{"statusKey":"todo"}'

# 只看這張任務自己的：子任務還有沒回的，父任務照樣結得掉
QS=$(ASK "$Q_SUB" "法務室" "$SOON")
chk "子任務自己是 AWAITING" "$(field "$Q_SUB" inquiryState)" "AWAITING"
chkc "子任務有沒回的詢問 → 子任務自己不能完成" "400" "$TOK" \
  -X PATCH $API/tasks/$Q_SUB -d '{"statusKey":"done"}'
chkc "子任務有沒回的詢問 → 父任務不受影響，照樣完成得了" "200" "$TOK" \
  -X PATCH $API/tasks/$Q_T -d '{"statusKey":"done"}'

del "$Q_SUB" "$Q_T" "$Q_EPIC"

echo "── 26. 大項目與任務之間開放排程依賴 (CR-066) ──"
# 規則見 CR-066：大項目與一般任務統一為事件層級，開放自由建立排程與語意關聯依賴。
L_E1=$(mk '{"title":"依賴規則－大項目甲"}')
L_E2=$(mk '{"title":"依賴規則－大項目乙"}')
L_T1=$(mk "{\"title\":\"依賴規則－任務甲\",\"parentId\":\"$L_E1\"}")
L_T2=$(mk "{\"title\":\"依賴規則－任務乙\",\"parentId\":\"$L_E1\"}")
for LT in FS SS FF SF; do
  chkc "大項目→任務 建 $LT → 201" "201" "$TOK" \
    -X POST $API/tasks/$L_E2/links -d "{\"targetId\":\"$L_T1\",\"linkType\":\"$LT\"}"
done
L_E3=$(mk '{"title":"依賴規則－大項目丙"}')
L_E4=$(mk '{"title":"依賴規則－大項目丁"}')
L_T3=$(mk "{\"title\":\"依賴規則－任務丙\",\"parentId\":\"$L_E1\"}")
chkc "任務→大項目 反向建立 → 201" "201" "$TOK" \
  -X POST $API/tasks/$L_T3/links -d "{\"targetId\":\"$L_E3\",\"linkType\":\"FS\"}"
chkc "大項目→大項目 建 FS → 201（兩個階段的先後）" "201" "$TOK" \
  -X POST $API/tasks/$L_E1/links -d "{\"targetId\":\"$L_E4\",\"linkType\":\"FS\"}"
chkc "任務→任務 建 FS → 201" "201" "$TOK" \
  -X POST $API/tasks/$L_T1/links -d "{\"targetId\":\"$L_T2\",\"linkType\":\"FS\"}"
chkc "大項目→任務 建「相關」→ 201（不影響排程的不受限制）" "201" "$TOK" \
  -X POST $API/tasks/$L_E2/links -d "{\"targetId\":\"$L_T1\",\"linkType\":\"RELATES\"}"
chkc "大項目→任務 建「阻擋」→ 201" "201" "$TOK" \
  -X POST $API/tasks/$L_E2/links -d "{\"targetId\":\"$L_T1\",\"linkType\":\"BLOCKS\"}"
del "$L_E4" "$L_T3" "$L_E3" "$L_T2" "$L_T1" "$L_E2" "$L_E1"

echo "── 27. 誰能改任務、誰能填問題與登錄回覆 ──"
# 規則見 AGENTS.md「誰能做什麼」：任務只有開這張任務的人與專案管理者能改；
# 但**任何人都能填「目前遇到的問題」與登錄對外詢問的回覆**。
# 沿用第 23 項那個 Jack（$JT）—— 他是 EDITOR、是專案成員，但不是 demo 那些任務的開單人。
P_EPIC=$(mk '{"title":"權限規則－大項目"}')
P_T=$(mk "{\"title\":\"權限規則－demo 開的任務\",\"parentId\":\"$P_EPIC\"}")

chkcw "別人開的任務：改標題 → 403" "403" "只有開這張任務的人" "$JT" \
  -X PATCH $API/tasks/$P_T -d '{"title":"Jack 改的"}'
chkcw "別人開的任務：換負責人 → 403" "403" "只有開這張任務的人" "$JT" \
  -X PATCH $API/tasks/$P_T -d "{\"assigneeId\":\"$JID\"}"
chkc "別人開的任務：拖曳換欄 → 403" "403" "$JT" -X POST $API/tasks/$P_T/move -d '{"statusKey":"doing"}'
# DELETE 沒有內容，所以不能沿用 chkc（它一律宣告 content-type: application/json，
# Fastify 會先擋掉空 body，測到的就不是權限了）
chk "別人開的任務：刪掉 → 403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $JT" -X DELETE $API/tasks/$P_T)" "403"
chkc "別人開的任務：只填「目前遇到的問題」→ 200" "200" "$JT" \
  -X PATCH $API/tasks/$P_T -d '{"problem":"廠商還沒給我們機櫃圖"}'
chk "問題真的寫進去了" "$(field "$P_T" problem "$JT")" "廠商還沒給我們機櫃圖"
# 混在一起就不算「只填問題」，整筆要被擋 —— 不然改標題只要順手帶一個 problem 就繞過去了
chkc "把問題跟標題混在一起送 → 403" "403" "$JT" \
  -X PATCH $API/tasks/$P_T -d '{"problem":"還是沒給","title":"偷改的標題"}'
chk "標題沒有被改掉" "$(field "$P_T" title "$JT")" "權限規則－demo 開的任務"

# 對外詢問的回覆：誰收到誰登錄，不卡編輯權
P_Q=$(ASK "$P_T" "資訊部" "$SOON")
chkc "別人開的任務：登錄對外詢問的回覆 → 200" "200" "$JT" \
  -X POST $API/inquiries/$P_Q/mark-replied -d '{"repliedByUnit":"資訊部"}'
chk "登錄完彙總變成 REPLIED" "$(field "$P_T" inquiryState)" "REPLIED"

# 自己開的任務自己改得動；管理者則是誰的都改得動
P_J=$(curl -s -H "Authorization: Bearer $JT" -H 'content-type: application/json' \
  -X POST $API/projects/$PID/tasks -d "{\"title\":\"權限規則－Jack 開的任務\",\"parentId\":\"$P_EPIC\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')
[ -n "$P_J" ] && ok "成員自己開得了任務" || no "成員開任務" "開不出來"
chkc "自己開的任務：改標題 → 200" "200" "$JT" -X PATCH $API/tasks/$P_J -d '{"title":"Jack 改自己的"}'
chkc "專案管理者：改別人開的任務 → 200" "200" "$TOK" -X PATCH $API/tasks/$P_J -d '{"title":"管理者改的"}'

del "$P_J" "$P_T" "$P_EPIC"

echo "── 28. 圖的排版存進資料庫，專案共用（Ref: CR-138）──"
# 規則：畫布排版是**專案共用**的，不是個人偏好 —— 甲排好的版，乙進來要看到同一份。
# 所以這一段測的重點不是「存得進去」，而是三件會被人忽略的事：
#   ① 換一個帳號讀出來是一樣的（不然就跟原本存在 localStorage 沒有差別）
#   ② 逐節點合併時，沒送到的那些節點一個字都不會被動到（兩個人各拖各的不互蓋）
#   ③ 整份 jsonb 的那一種擋得住覆蓋（帶過期的版本要回 409，不是默默蓋掉）
CV_A=$(mk '{"title":"排版測試－甲"}')
CV_B=$(mk '{"title":"排版測試－乙"}')

# CVN <節點 id> <欄位> [token] [視角] —— 讀某個節點在畫布上的某個值
CVN(){ curl -s -H "Authorization: Bearer ${3:-$TOK}" $API/projects/$PID/canvas/${4:-simple-graph} \
  | python3 -c "
import sys, json
v = json.load(sys.stdin)['nodes'].get('$1', {}).get('$2', '')
print(int(v) if isinstance(v, (int, float)) else v)" | tr -d '\r'; }

chkc "整份存排版 → 200" "200" "$TOK" -X PUT $API/projects/$PID/canvas/simple-graph \
  -d "{\"nodes\":{\"$CV_A\":{\"x\":100,\"y\":200,\"width\":300,\"height\":120,\"mode\":\"card\"},\"$CV_B\":{\"x\":500,\"y\":260}}}"
chk "座標讀得回來" "$(CVN "$CV_A" x)" "100"
chk "收納盒尺寸也存得下來" "$(CVN "$CV_A" width)" "300"
# ① 這一項是整件事的重點：排版不是個人偏好
chk "換一個帳號讀到同一份排版" "$(CVN "$CV_A" x "$JT")" "100"

# ② 逐節點合併：Jack 只拖了甲，demo 排的乙不該受影響
chkc "逐節點合併存檔 → 200" "200" "$JT" -X PATCH $API/projects/$PID/canvas/simple-graph \
  -d "{\"nodes\":{\"$CV_A\":{\"x\":111,\"y\":222}}}"
chk "有送到的節點被改掉" "$(CVN "$CV_A" x)" "111"
chk "沒送到的節點位置沒被蓋掉" "$(CVN "$CV_B" x)" "500"

# 欄位層級也是合併的 —— 只切換收納模式不該把座標洗成空的
chkc "只送收納模式 → 200" "200" "$TOK" -X PATCH $API/projects/$PID/canvas/simple-graph \
  -d "{\"nodes\":{\"$CV_A\":{\"mode\":\"box\"}}}"
chk "收納模式存下來了" "$(CVN "$CV_A" mode)" "box"
chk "只送模式不會把座標洗掉" "$(CVN "$CV_A" x)" "111"

chkc "把某個節點的排版拿掉 → 200" "200" "$TOK" -X PATCH $API/projects/$PID/canvas/simple-graph \
  -d "{\"nodes\":{},\"remove\":[\"$CV_B\"]}"
chk "拿掉的節點讀不到了" "$(CVN "$CV_B" x)" ""

chkc "視角代號不合法 → 400" "400" "$TOK" -X PUT $API/projects/$PID/canvas/BadKey -d '{"nodes":{}}'
chkc "不是自己的專案 → 403" "403" "$TOK" \
  $API/projects/00000000-0000-0000-0000-000000000000/canvas/simple-graph

# ③ 系統流程圖是「整份文件」，走 jsonb 那一種
chkc "存整份系統流程圖 → 200" "200" "$TOK" -X PUT $API/projects/$PID/canvas-docs/system-flow \
  -d '{"data":{"pages":[{"id":"page-1","title":"主要流程","nodes":[],"edges":[]}]}}'
DOCT(){ curl -s -H "Authorization: Bearer ${1:-$TOK}" $API/projects/$PID/canvas-docs/system-flow \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['pages'][0]['title'])" | tr -d '\r'; }
chk "整份內容讀得回來" "$(DOCT)" "主要流程"
chk "換一個帳號看到同一份流程圖" "$(DOCT "$JT")" "主要流程"

chkc "帶過期的版本要存 → 409" "409" "$TOK" -X PUT $API/projects/$PID/canvas-docs/system-flow \
  -d '{"data":{"pages":[]},"baseUpdatedAt":"2020-01-01T00:00:00.000Z"}'
chk "被擋下來之後內容沒有被動到" "$(DOCT)" "主要流程"
DOCTS=$(curl -s -H "$AUTH" $API/projects/$PID/canvas-docs/system-flow \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['updatedAt'])" | tr -d '\r')
chkc "帶正確的版本要存 → 200" "200" "$TOK" -X PUT $API/projects/$PID/canvas-docs/system-flow \
  -d "{\"data\":{\"pages\":[{\"id\":\"page-1\",\"title\":\"改過的流程\",\"nodes\":[],\"edges\":[]}]},\"baseUpdatedAt\":\"$DOCTS\"}"
chk "存進去的是新的內容" "$(DOCT)" "改過的流程"
# DELETE 沒有內容，不能沿用 chkc（它一律宣告 content-type: application/json，
# Fastify 會先擋掉空 body，測到的就不是這支端點了）——理由同第 27 項
chk "刪掉整份 → 204" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" \
     -X DELETE $API/projects/$PID/canvas-docs/system-flow)" "204"
chk "刪掉之後讀到 null" \
  "$(curl -s -H "$AUTH" $API/projects/$PID/canvas-docs/system-flow \
     | python3 -c "import sys,json;print(json.load(sys.stdin)['data'])" | tr -d '\r')" "None"

# 關聯線兩端的接點掛在關聯線上，關聯圖要跟著邊一起帶回來
CV_L=$(curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/tasks/$CV_A/links \
  -d "{\"targetId\":\"$CV_B\",\"linkType\":\"FS\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' | tr -d '\r')
chkc "存關聯線的接點 → 200" "200" "$TOK" -X PATCH $API/links/$CV_L/handles \
  -d '{"sourceHandle":"right-source","targetHandle":"left-target"}'
chk "關聯圖把接點一起帶回來" \
  "$(curl -s -H "$AUTH" $API/projects/$PID/graph \
     | python3 -c "import sys,json;print(([e for e in json.load(sys.stdin)['edges'] if e['id']=='$CV_L'] or [{}])[0].get('sourceHandle',''))" | tr -d '\r')" \
  "right-source"

chk "重置排版 → 204" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" \
     -X DELETE $API/projects/$PID/canvas/simple-graph)" "204"
chk "重置之後整個視角是空的" "$(CVN "$CV_A" x)" ""

del "$CV_A" "$CV_B"

echo "── 29. 非關係人不得異動別人建立的資料：關聯線與對外詢問單（Ref: CR-130）──"
# 規則見 CR-130：角色過了還要是「關係人」（系統管理者／專案管理者／開單人／負責人／代理人）。
# 沿用第 23 項那個 Jack（$JT）—— 他是專案 EDITOR，但下面這兩張任務跟他完全無關。
# **關聯線只驗發起的那一端**：跨人依賴（我的任務要等你的做完）是核心用法，
# 兩端都驗等於把它整個關掉，所以「成功面」那一項是防回歸用的，不能拿掉。
# 任務本身的「改不動 / 只填問題可以」在第 27 項已經驗過，這裡不重複。
S_A=$(mk '{"title":"關係人規則－demo 的任務甲"}')
S_B=$(mk '{"title":"關係人規則－demo 的任務乙"}')
S_J=$(curl -s -H "Authorization: Bearer $JT" -H 'content-type: application/json' \
  -X POST $API/projects/$PID/tasks -d '{"title":"關係人規則－Jack 的任務"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' | tr -d '\r')
[ -n "$S_J" ] && ok "Jack 開得了自己的任務（跨人依賴的起點）" || no "Jack 開任務" "開不出來"

# ── 關聯線：建立驗發起端 ──
chkcw "別人的任務：從它拉一條關聯線出去 → 403" "403" "關聯線" "$JT" \
  -X POST $API/tasks/$S_A/links -d "{\"targetId\":\"$S_B\",\"linkType\":\"FS\"}"
chkc "跨人依賴：Jack 從自己的任務拉 FS 指到 demo 的任務 → 201" "201" "$JT" \
  -X POST $API/tasks/$S_J/links -d "{\"targetId\":\"$S_A\",\"linkType\":\"FS\"}"

# ── 關聯線：刪除也驗發起端 ──
S_L=$(curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/tasks/$S_A/links \
  -d "{\"targetId\":\"$S_B\",\"linkType\":\"FS\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' | tr -d '\r')
[ -n "$S_L" ] && ok "demo 在自己兩張任務之間建了一條關聯線" || no "建關聯線" "建不出來"
# DELETE 沒有內容，不能沿用 chkc（理由同第 27 項）
chk "別人任務上的關聯線：非關係人剪不掉 → 403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $JT" -X DELETE $API/links/$S_L)" "403"
chk "同一條線：關係人自己剪得掉 → 204" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" -X DELETE $API/links/$S_L)" "204"

# ── 對外詢問單：改／重開／刪要守門，登錄回覆刻意開放 ──
S_Q=$(ASK "$S_A" "資訊部" "$SOON")
[ -n "$S_Q" ] && ok "demo 在自己的任務上開了一筆對外詢問" || no "開詢問單" "開不出來"
chkcw "別人開的詢問單：改題目 → 403" "403" "對外詢問單" "$JT" \
  -X PATCH $API/inquiries/$S_Q -d '{"question":"Jack 偷改的"}'
chkc "別人開的詢問單：抽回已回覆狀態 → 403" "403" "$JT" \
  -X POST $API/inquiries/$S_Q/reopen -d '{}'
chk "別人開的詢問單：刪掉 → 403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $JT" -X DELETE $API/inquiries/$S_Q)" "403"
chk "被擋下來之後題目沒有被改掉" \
  "$(curl -s -H "Authorization: Bearer $JT" $API/tasks/$S_A \
     | python3 -c "import sys,json;print(([i for i in json.load(sys.stdin)['inquiries'] if i['id']=='$S_Q'] or [{}])[0].get('question',''))" | tr -d '\r')" \
  "e2e"
chkc "登錄回覆刻意開放給所有專案成員 → 200" "200" "$JT" \
  -X POST $API/inquiries/$S_Q/mark-replied -d '{"repliedByUnit":"資訊部"}'
chk "登錄完彙總變成 REPLIED" "$(field "$S_A" inquiryState)" "REPLIED"
chkc "開單人自己改得動題目 → 200" "200" "$TOK" \
  -X PATCH $API/inquiries/$S_Q -d '{"question":"demo 自己改的"}'
chkc "開單人自己刪得掉整筆詢問 → 204" "204" "$TOK" -X DELETE $API/inquiries/$S_Q -d '{}'

del "$S_J" "$S_B" "$S_A"

echo "── 30. 父任務不能跨專案、帳號清單與身分切換要收緊（Ref: CR-134）──"
PID2=$(echo "$PROJ" | python3 -c 'import sys,json;d=json.load(sys.stdin)["projects"];print(([p for p in d if p["key"]!="MRG"] or [{}])[0].get("id",""))' | tr -d '\r')
[ -n "$PID2" ] && ok "找得到第二個專案（跨專案測試用）" || no "第二個專案" "只有一個專案，下面幾項會連帶失敗"

X_OUT=$(curl -s -H "$AUTH" -H 'content-type: application/json' -X POST $API/projects/$PID2/tasks \
  -d '{"title":"跨專案規則－別的專案的任務"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' | tr -d '\r')
[ -n "$X_OUT" ] && ok "在另一個專案開了一張任務" || no "開任務" "開不出來"
X_IN=$(mk '{"title":"跨專案規則－本專案的父任務"}')
X_CH=$(mk "{\"title\":\"跨專案規則－本專案的子任務\",\"parentId\":\"$X_IN\"}")

# ── ① 建立 ──
mkok "建立：父任務在同一個專案 → 可以" \
  "{\"title\":\"跨專案規則－同專案子任務\",\"parentId\":\"$X_IN\"}"; X_OK=$MKID
chkcw "建立：父任務在別的專案 → 400" "400" "父任務" "$TOK" \
  -X POST $API/projects/$PID/tasks -d "{\"title\":\"跨專案規則－跨專案子任務\",\"parentId\":\"$X_OUT\"}"
# ── ② 改上層 ──
chkc "改上層：搬到同專案的父任務底下 → 200" "200" "$TOK" \
  -X PATCH $API/tasks/$X_CH -d "{\"parentId\":\"$X_IN\"}"
chkcw "改上層：搬到別的專案的任務底下 → 400" "400" "父任務" "$TOK" \
  -X PATCH $API/tasks/$X_CH -d "{\"parentId\":\"$X_OUT\"}"
# ── ③ 拖曳 ──
chkc "拖曳：拖到同專案的父任務底下 → 200" "200" "$TOK" \
  -X POST $API/tasks/$X_CH/move -d "{\"parentId\":\"$X_IN\"}"
chkcw "拖曳：拖到別的專案的任務底下 → 400" "400" "父任務" "$TOK" \
  -X POST $API/tasks/$X_CH/move -d "{\"parentId\":\"$X_OUT\"}"
chk "三條路徑都擋住之後，上層還在原本的專案裡" "$(field "$X_CH" parentId)" "$X_IN"

del "$X_OK" "$X_CH" "$X_IN" "$X_OUT"

# ── 帳號清單：整份通訊錄不是任何成員都能撈的 ──
chkcw "帳號清單：一般成員撈不走整份通訊錄 → 403" "403" "工作區管理者" "$JT" \
  "$API/admin/users?workspaceId=$WSID"
chkc "帳號清單：工作區擁有者看得到 → 200" "200" "$TOK" "$API/admin/users?workspaceId=$WSID"

# ── 身分切換：這支端點直接發別人的權杖，只准工作區 OWNER/ADMIN 用 ──
# 「一般使用者打不動」不管站有沒有開放都成立，所以一律驗；
# 後面兩項要看這個站開不開放（CR-137 起正式環境預設關閉，容器裡跑的就是關的），
# 所以先探一次再決定驗哪一組 —— 兩條路都各驗兩項，通過數在哪個環境都一樣。
chkc "身分切換：一般使用者不能用 → 403" "403" "$JT" \
  -X POST $API/auth/impersonate -d "{\"targetUserId\":\"$DEMOID\"}"
IMP=$(apic "$TOK" -X POST $API/auth/impersonate -d "{\"targetUserId\":\"$JID\"}")
IMPC=$(echo "$IMP" | tail -1); IMPB=$(echo "$IMP" | head -n -1)
if echo "$IMPB" | grep -q "沒有開放身分切換"; then
  # 這個站把身分切換關掉了（正式環境的預設）—— 那就連工作區擁有者也不該切得動
  chk "身分切換：這個站關閉了這支端點，連工作區擁有者也擋 → 403" "$IMPC" "403"
  chkcw "身分切換：關閉時要講清楚是「沒有開放」而不是權限不足" "403" "沒有開放身分切換" "$TOK" \
    -X POST $API/auth/impersonate -d '{"targetUserId":"00000000-0000-0000-0000-000000000000"}'
else
  chk "身分切換：工作區擁有者切同工作區的人 → 200" "$IMPC" "200"
  chkc "身分切換：切不到不在自己工作區的帳號 → 400" "400" "$TOK" \
    -X POST $API/auth/impersonate -d '{"targetUserId":"00000000-0000-0000-0000-000000000000"}'
fi

echo "── 31. COMMENTER 角色已移除（Ref: CR-145）──"
# 用隨機信箱，讓這支腳本可以對同一個資料庫重複執行；驗完就把他移出專案
BOBMAIL="bob-$(date +%s)-$RANDOM@example.com"
curl -s -o /dev/null -X POST $API/auth/register -H 'content-type: application/json; charset=utf-8' \
  -d "{\"email\":\"$BOBMAIL\",\"password\":\"hunter2024\",\"displayName\":\"Bob\"}"
BT=$(curl -s -X POST $API/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$BOBMAIL\",\"password\":\"hunter2024\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("accessToken",""))' | tr -d '\r')
BOBID=$(curl -s -H "Authorization: Bearer $BT" $API/auth/me \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])' | tr -d '\r')
[ -n "$BOBID" ] && ok "另外註冊一個帳號來驗角色值" || no "註冊" "$BOBMAIL 開不出來"

chkc "加成員：送已移除的 COMMENTER → 400" "400" "$TOK" \
  -X POST $API/projects/$PID/members -d "{\"userId\":\"$BOBID\",\"role\":\"COMMENTER\"}"
chkc "加成員：送還在的檢視者 → 201" "201" "$TOK" \
  -X POST $API/projects/$PID/members -d "{\"userId\":\"$BOBID\",\"role\":\"VIEWER\"}"
chkc "改角色：送已移除的 COMMENTER → 400" "400" "$TOK" \
  -X PATCH $API/projects/$PID/members/$BOBID -d '{"role":"COMMENTER"}'
chkc "改角色：送還在的編輯者 → 200" "200" "$TOK" \
  -X PATCH $API/projects/$PID/members/$BOBID -d '{"role":"EDITOR"}'
# DELETE 沒有內容，不能沿用 chkc（理由同第 27 項）
chk "把測試用的成員移出專案 → 204" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" \
     -X DELETE $API/projects/$PID/members/$BOBID)" "204"

# 前面幾項開出來的任務也一起收掉。留著的話對同一個資料庫每跑一次就多四張，
# 到最後得靠 clean-demo-junk.bat 去撿 —— 測試自己製造的垃圾自己收。
del "$NEWA" "$NEWB" "$NT_A" "$NT_B"

echo
echo "════════ 通過 $pass 項，失敗 $fail 項 ════════"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
