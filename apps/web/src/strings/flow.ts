/**
 * 兩張「畫布」頁面的文字：關聯圖（pages/TaskGraph.tsx）與系統流程圖（pages/SystemFlow.tsx）。
 * 寫法見 strings/index.ts。
 *
 * 分成三組：
 * - `shared`：兩張畫布逐字相同的說法（縮放控制、文字註記與區域標示框）。
 *   兩頁本來就是同一套附加物，寫兩份一定會走鐘。
 * - `relationGraph`：只有關聯圖有的東西（收納盒／卡片、警示徽章、動作紀錄）。
 * - `systemFlow`：只有系統流程圖有的東西（流程步驟／模組容器、多頁面、連線文字）。
 *
 * 只差一兩個字的**不要**硬湊進 shared（例如「縮放容納所有卡片」與
 * 「縮放容納所有節點」）—— 那是兩句不同的話，湊在一起改一邊就會害到另一邊。
 * 到處都在用的「取消／儲存／刪除」一律用 common，這裡不重複一份。
 */
export const flow = {
  /** 兩張畫布逐字相同的說法 */
  shared: {
    zoomIn: '放大畫布',
    zoomOut: '縮小畫布',
    centerTitle: '置中視野 (100% 原始比例)',
    center: '置中視野',
    fitAll: '顯示全部',
    legend: '圖示說明',
    confirmDelete: '確定刪除',
    coEditing: '✏️ 共同編輯中',
    readOnly: '🔒 唯讀檢視',
    coEditingHint: '目前處於共同編輯狀態，所有操作將自動儲存。點擊切換為唯讀檢視模式。',
    readOnlyHint: '目前處於唯讀檢視模式，畫布已鎖定。點擊切換為共同編輯模式。',
    permissions: {
      btn: '授權',
      btnHint: '設定可編輯此畫布的成員名單',
      title: (name: string) => `${name} 共同編輯授權設定`,
      modeAll: '全體專案編輯者可編輯（預設）',
      modeAllHint: '專案內具備 EDITOR 與 MANAGER 權限的所有成員皆可編輯。',
      modeWhitelist: '指定成員名單可編輯',
      modeWhitelistHint: '僅有被勾選的成員（以及專案管理者）可以編輯此畫布，其他人僅能檢視。',
      searchPlaceholder: '搜尋成員姓名或 Email…',
      selectAll: '全選',
      clearAll: '全不選',
      managerBadge: '管理者（永久具備權限）',
      saveSuccess: '授權設定已儲存',
      forbiddenHint: '此畫布已被專案管理者限制編輯名單，您目前僅具備檢視權限。',
    },

    /**
     * 文字註記與區域標示框：兩張畫布上都掛得了的附加物，說法完全一致。
     * `editText` 是滑過按鈕的提示，`editTextTitle` 是彈窗標題 —— 字一樣但位置不同，
     * 所以分成兩個鍵，日後只想改其中一邊時不會連坐。
     */
    annotation: {
      addText: '新增文字',
      addTextHint: '在畫布上放一段純文字說明',
      addFrame: '新增區域標示框',
      newTextDefault: '在這裡輸入說明文字',
      newFrameDefault: '新的區域標示框',
      textFallback: '文字說明',
      frameFallback: '區域標示框',
      editText: '編輯文字內容',
      deleteText: '刪除文字',
      editFrame: '編輯區域標示框標題與顏色',
      deleteFrame: '刪除區域標示框',
      editTextTitle: '編輯文字內容',
      editFrameTitle: '編輯區域標示框',
      fieldTextContent: '文字內容',
      fieldFrameLabel: '區域標示框標題',
      fieldTextColor: '文字顏色',
      fieldFrameColor: '框線顏色',
      textPlaceholder: '輸入要放在畫布上的說明文字…',
    },
  },

  /** 關聯圖（pages/TaskGraph.tsx） */
  relationGraph: {
    /** 收納盒／卡片這兩個模式的名字。按鈕、紀錄、提示都講同一個詞 */
    box: '收納盒',
    card: '卡片',
    boxBadge: '📦 收納盒',
    boxToggleTitle: '【收納盒】點擊轉換回卡片',
    cardToggleTitle: '【卡片】點擊轉換為收納盒',
    boxCapacityHint: '(移入卡片自動擴大容量)',
    resizeBox: '按住拖曳調整收納盒尺寸',
    untitledBox: '無標題收納盒',
    untitledTask: '無標題任務',
    collapse: '▲ 摺疊',
    expand: '▼ 展開',
    collapseBoxHint: '摺疊收納盒 (隱藏內部子卡片)',
    expandBoxHint: '展開收納盒 (顯示內部子卡片)',
    collapseCardHint: '摺疊子項目 (隱藏內部子任務與問題單)',
    expandCardHint: '展開子項目 (顯示內部子任務與問題單)',

    /** 任務種類的預設名字（專案沒有自訂種類時用） */
    typeTask: '任務單',
    typeBug: '問題單',
    upstreamFallback: '上游任務',

    /** 進度條 */
    done: '已完成',
    notStarted: '未開始 (0%)',

    /** 卡片上的警示徽章 */
    blockedBadge: '卡住',
    blockedTitle: (who: string) => `卡住：${who}`,
    blockedCardTitle: (who: string) => `卡住：要等 ${who}`,
    blockedBoxFallback: '盒內任務受阻',
    parallelBadge: '⚡並行',
    parallelTitle: (peers?: string) => `並行：與 ${peers} 匯合`,
    overdueBadge: '⏰ 逾期',
    overdueTitle: (due: string) => `已逾期（應到日期：${due}）`,
    inquiryBadge: '⏳ 待回',
    inquiryTitle: '對外詢問待回覆',
    inquiryOverdueBadge: '📨 逾回',
    inquiryOverdueTitle: '對外詢問逾期未回',
    childCount: (n: number) => `內含 ${n} 張`,

    /** 連線 */
    waypointHint: '拖曳可移動轉角位置，雙擊回到自動位置',

    /**
     * 關聯線上的文字。Ref: CR-150
     *
     * 跟系統流程圖的說法刻意分開：那一頁講「流程連線」，這一頁講「關聯線」，
     * 兩邊本來就是不同的東西，硬合併會逼出一個兩邊都不對的名字。
     */
    edgeTextHint: '雙擊編輯關聯線文字',
    edgeModalTitle: '編輯關聯線',
    fieldEdgeText: '關聯線文字 (選填，留空則不顯示)',
    edgeTextPlaceholder: '例如：完成後才能開始',
    edgeTextHelp: '也可以直接在畫布上雙擊關聯線文字就地修改。',
    deleteEdge: '刪除這條關聯線',

    /** 工具列 */
    fitAllTitle: '顯示全部 (縮放容納所有卡片)',
    addFrameHint: '拉一個區域標示框，把一群卡片圈起來標示',
    framePlaceholder: '例如：第一階段範圍',
    resizeFrame: '拖曳可調整區域標示框大小',
    legendTitle: '圖示說明 (警示圖示)',

    /** 圖例懸浮視窗 */
    help: {
      title: '圖表與警示圖示說明',
      subtitle: '完整圖例',
      edgeSection: '關聯線條',
      solidRed: '🔴 紅色實線',
      solidRedDesc: '：左右接點，前後相依關聯（完成後開始）。',
      dashedPurple: '🟣 紫色虛線',
      dashedPurpleDesc: '：上下接點，模組與輔助關聯。',
      badgeSection: '警示徽章',
      problem: '⚑ 問題 / 問 N',
      problemDesc: '：包含未解決之問題單或遭遇問題說明。',
      blocked: '⛔ 卡住 / ⛔ 卡 N',
      blockedDesc: '：任務進度受阻、等待外部資源中。',
      overdue: '⏰ 逾期 / 逾 N',
      overdueDesc: '：已超過預定結束日且尚未達到 100%。',
      typeSection: '容器與事件類型',
      boxDesc: '：父層容器，內部收納子任務並自動加總內部警示。',
      taskCard: '📄 任務單',
      taskCardDesc: '：標準事件卡片，支援自訂類型與顏色標籤。',
      bugCard: '🐛 問題單',
      bugCardDesc: '：系統固定類型，專門追蹤修復與解決方案。',
      doneMark: '✓ 100%',
      doneMarkDesc: '：進度達 100% 即標示為已完成。',
    },

    /** 動作與座標紀錄視窗 */
    log: {
      toggleTitle: '即時 Log 視窗開關',
      panelTitle: '動作與座標 Log 視窗',
      clearTitle: '清空 Log 紀錄',
      clear: '清空',
      closeTitle: '關閉視窗',
      emptyLine1: '尚未有移動或切換紀錄',
      emptyLine2: '在畫布上拖曳卡片時將在此即時顯示',
      type: {
        move_in: '📥 移入',
        move_out: '📤 移出',
        toggle: '📦 模式',
        resize: '📐 縮放',
        move: '📍 移動',
      },
      modeToggled: (ref: string, mode: string) => `${ref} 模式切換為 [${mode}]`,
      moveOutFailed: (ref: string) => `卡片 (${ref}) 移出失敗：尚存在關聯線`,
      moveOut: (kind: string, ref: string, x: number, y: number) =>
        `${kind} (${ref}) 移出收納盒，離開巢狀結構 | 畫布大座標 (x: ${x}, y: ${y})`,
      moveInFailed: (kind: string, ref: string, box: string) =>
        `${kind} (${ref}) 移入 (${box}) 失敗：尚存在關聯線`,
      moveIn: (kind: string, ref: string, box: string, x: number, y: number) =>
        `${kind} (${ref}) 移入 (${box})，進入巢狀結構 | 畫布大座標 (x: ${x}, y: ${y})`,
      moveInner: (ref: string, sx: number, sy: number, ax: number, ay: number) =>
        `盒內卡片 (${ref}) 移動，槽位 (x: ${sx}, y: ${sy}) | 畫布大座標 (x: ${ax}, y: ${ay})`,
      moveNode: (ref: string, x: number, y: number) => `節點 (${ref}) 移動至 (x: ${x}, y: ${y})`,
    },

    /** 註記顏色（關聯圖只給顏色名，不解釋用途） */
    colorOptions: [
      { name: '藍色', color: '#3b82f6' },
      { name: '綠色', color: '#10b981' },
      { name: '紫色', color: '#8b5cf6' },
      { name: '琥珀色', color: '#f59e0b' },
      { name: '紅色', color: '#ef4444' },
      { name: '灰色', color: '#64748b' },
    ],

    /** 彈窗 */
    deleteEdgeTitle: '刪除關聯線',
    deleteEdgeMessage: (source: string, target: string) => `是否刪除 ${source} 與 ${target} 的關聯？`,
    unboxTitle: '轉換為卡片提示',
    /** 中間夾著兩個要標色的數字，所以拆成三段，不要在元件裡拼字串 */
    unboxMessage: {
      before: '收納盒',
      middle: '轉回卡片後，內含的',
      after: '張卡片將移出收納盒。是否確定轉換？',
    },
    unboxConfirm: '確定轉換',
    alertTitle: '關聯建立受限',
    alertOk: '我知道了',
    alertCrossBox: (source: string, target: string) =>
      `收納盒內部的卡片 (${source} / ${target}) 無法與外部直接建立關聯。請將關聯連線接至收納盒本體！`,
    alertDuplicate: (source: string, target: string) =>
      `【${source}】與【${target}】之間已存在關聯線，任何第二個接點皆不可重複相連！`,
    alertMoveOutHasEdges: (ref: string) =>
      `卡片 (${ref}) 在收納盒內尚存在關聯線，無法移出收納盒。請先刪除關聯線後再移動！`,
    alertUnboxBoxHasEdges: (boxRef: string) =>
      `收納盒 (${boxRef}) 內部的卡片尚存在關聯線，無法轉換為普通卡片。請先刪除關聯線後再轉換！`,
    alertMoveInHasEdges: (kind: string, ref: string, box: string) =>
      `${kind} (${ref}) 尚存在關聯線，無法移入收納盒 (${box})。請先刪除關聯線後再移入！`,
  },

  /** 系統流程圖（pages/SystemFlow.tsx） */
  systemFlow: {
    title: '系統流程圖',
    subtitle: '| 多頁面獨立繪圖',

    /** 節點 */
    stepFallback: '流程步驟',
    boxFallback: '系統模組容器',
    newStep: '新流程步驟',
    newStepDesc: '點擊 ✏️ 編輯內容描述',
    newBox: '新系統模組',
    addStep: '新增流程步驟',
    addBox: '新增模組容器',
    addFrameHint: '拉一個區域標示框，把一群節點圈起來標示',
    editBoxTitle: '編輯模組名稱、詳細說明與顏色',
    deleteBoxTitle: '刪除模組容器',
    editNodeTitle: '編輯節點',
    deleteNodeTitle: '刪除節點',

    /** 連線 */
    waypointHint: '拖曳可移動轉角位置，連點兩下回到自動位置',
    edgeTextHint: '連點兩下編輯連線文字',

    /** 多頁面 */
    mainPageTitle: '主要流程',
    pageDefaultTitle: (n: number) => `流程頁面 ${n}`,
    duplicateTitle: (title: string) => `${title} (副本)`,
    pagesLabel: '流程頁面：',
    nodeCount: (n: number) => `(${n} 個節點)`,
    tabDragHint: '拖曳排序頁籤',
    tabMoveLeft: '向左移動頁籤',
    tabMoveRight: '向右移動頁籤',
    tabRename: '點擊重新命名 (或連點兩下標籤)',
    tabDuplicate: '複製此頁面',
    tabDelete: '刪除此流程頁面',
    addPageTitle: '新增流程頁面',
    addPage: '新增頁面',

    /** 工具列 */
    fitAllTitle: '顯示全部 (縮放容納所有節點)',
    legendTitle: '流程圖示說明',

    /** 圖例懸浮視窗 */
    help: {
      title: '系統流程圖示說明',
      subtitle: '流程圖例',
      nodeSection: '節點與容器',
      step: '📄 流程步驟',
      stepDesc: '：代表具體系統行為、API 呼叫或操作。',
      box: '📦 模組容器',
      boxDesc: '：系統子模組，可拖曳收納多個步驟；標題下方顯示詳細說明。',
      text: '📝 文字',
      textDesc: '：畫布上的純文字註記，不參與連線。',
      frame: '🏷️ 區域標示框',
      frameDesc: '：只做視覺圈選，墊在最底層，不建立隸屬關係。',
      edgeSection: '四向接點與連線',
      freeConnection: '🔗 四向自由連線',
      freeConnectionDesc: '：支援上下左右任意接點雙向拉線與連入，無顏色與方向限制。',
      clickEdge: '⚙ 點擊連線',
      clickEdgeDesc: '：點擊連線可編輯連線文字或刪除連線。',
      arrow: '➡ 箭頭方向',
      arrowDesc: '：箭頭永遠指向你放開滑鼠的那一端。',
    },

    /** 編輯彈窗 */
    editNodeContent: '編輯節點內容',
    fieldNodeLabel: '節點標題',
    nodeLabelPlaceholder: '例如：API 閘道 (Gateway)',
    fieldDesc: '詳細說明 (選填)',
    descPlaceholder: '補充說明此步驟或模組之功能職責…',
    fieldThemeColor: '主題識別色',
    saveChanges: '儲存變更',

    /** 連線彈窗 */
    edgeModalTitle: '編輯流程連線',
    fieldEdgeText: '連線文字 (選填，留空則不顯示)',
    edgeTextPlaceholder: '例如：驗證成功後',
    edgeTextHelp: '也可以直接在畫布上連點兩下連線文字就地修改。',
    deleteEdge: '刪除這條連線',

    /** 刪除頁面彈窗（頁面名稱要標粗體，所以拆成前後兩段） */
    deletePageTitle: '刪除流程頁面',
    deletePageMessage: {
      before: '是否確定要刪除「',
      after: '」？此頁面內的全部節點與流程連線將一併移除。',
    },

    /**
     * 主題識別色。括號裡是這個顏色慣例上代表什麼，
     * 畫面上只顯示空白前的第一段（`name.split(' ')[0]`）。
     */
    colorOptions: [
      { name: '藍色 (處理/服務)', color: '#3b82f6' },
      { name: '綠色 (起點/成功)', color: '#10b981' },
      { name: '紫色 (模組/邏輯)', color: '#8b5cf6' },
      { name: '琥珀 (判斷/驗證)', color: '#f59e0b' },
      { name: '紅色 (錯誤/終點)', color: '#ef4444' },
      { name: '灰色 (資料/儲存)', color: '#64748b' },
    ],

    /** 新專案第一次打開時的示範內容 */
    sample: {
      backend: '應用後端服務 (Backend Service)',
      client: '客戶端請求 (Client)',
      clientDesc: '發起 API 呼叫與身分憑證',
      gateway: 'API 閘道 (Gateway)',
      gatewayDesc: '權限驗證與速率限制',
      controller: '業務邏輯核心 (Controller)',
      controllerDesc: '資料處理與流程排程',
      database: '資料庫 (PostgreSQL)',
      databaseDesc: '持久化資料存取與交易',
    },
  },
} as const
