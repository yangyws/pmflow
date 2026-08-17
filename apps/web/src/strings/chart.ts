/** 關聯圖、日曆、甘特 用到的文字。寫法見 strings/index.ts */
export const chart = {
  /**
   * 關聯類型的說法。舊的關聯圖頁（pages/Graph.tsx）刪掉之後，
   * 這一組只剩「怎麼講一條關聯」還有人用（lib/linkText.ts → 任務詳情、通知）。
   */
  graph: {
    /**
     * 關聯類型的說法，一律不出現 FS／SS／FF／SF ——
     * 資料庫存的是縮寫，畫面上永遠講完整句型。
     *
     * chip 是掛在線上的短句（線很擠，只放得下四個字），
     * label 是下拉選單與清單用的完整句型。兩者指的是同一件事，改要一起改。
     */
    linkChip: {
      FS: '完成後開始', SS: '同時開始', FF: '同時完成', SF: '開始後完成',
      RELATES: '相關', BLOCKS: '阻擋', DUPLICATES: '重複於', REQUIRES: '需要',
    },
    linkLabel: {
      FS: '等待任務完成，才能開始',
      SS: '等待任務開始，才能開始',
      FF: '等待任務完成，才能完成',
      SF: '等待任務開始，才能完成',
      RELATES: '相關', BLOCKS: '阻擋', DUPLICATES: '重複於', REQUIRES: '需要',
    },

    /**
     * 把一條關聯講成一句完整的話，而且分方向講。
     * 同一條「完成後開始」站在上游和下游看到的意思相反 —— 這是最容易看錯的地方。
     * 與任務詳情頁的說法保持一致。
     */
    sentence: {
      FS: {
        outgoing: (ref: string) => `${ref} 要等我完成，才能開始`,
        incoming: (ref: string) => `要等 ${ref} 完成，我才能開始`,
      },
      SS: {
        outgoing: (ref: string) => `${ref} 要等我開始，才能開始`,
        incoming: (ref: string) => `要等 ${ref} 開始，我才能開始`,
      },
      FF: {
        outgoing: (ref: string) => `${ref} 要等我完成，才能完成`,
        incoming: (ref: string) => `要等 ${ref} 完成，我才能完成`,
      },
      SF: {
        outgoing: (ref: string) => `${ref} 要等我開始，才能完成`,
        incoming: (ref: string) => `要等 ${ref} 開始，我才能完成`,
      },
      RELATES: {
        outgoing: (ref: string) => `與 ${ref} 相關`,
        incoming: (ref: string) => `與 ${ref} 相關`,
      },
      BLOCKS: {
        outgoing: (ref: string) => `阻擋 ${ref}`,
        incoming: (ref: string) => `被 ${ref} 阻擋`,
      },
      DUPLICATES: {
        outgoing: (ref: string) => `重複於 ${ref}`,
        incoming: (ref: string) => `被 ${ref} 重複`,
      },
      REQUIRES: {
        outgoing: (ref: string) => `需要 ${ref}`,
        incoming: (ref: string) => `被 ${ref} 需要`,
      },
    },
  },

  /** 甘特圖（dhtmlx-gantt） */
  gantt: {
    col: {
      task: '任務',
      start: '開始',
      duration: '天',
      inquiry: '詢問',
    },

    /**
     * dhtmlx 內建的 locale。月份與星期是畫面上讀得到的字，所以一併集中在這裡；
     * 少了任何一個鍵 dhtmlx 會噴 "Invalid day index"，不要只補一半。
     */
    locale: {
      monthFull: ['一月', '二月', '三月', '四月', '五月', '六月',
                  '七月', '八月', '九月', '十月', '十一月', '十二月'],
      monthShort: ['1月', '2月', '3月', '4月', '5月', '6月',
                   '7月', '8月', '9月', '10月', '11月', '12月'],
      dayFull: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
      dayShort: ['日', '一', '二', '三', '四', '五', '六'],
      newTask: '新任務',
      sectionDescription: '說明',
      sectionTime: '時間區間',
      confirmLinkDeleting: '要刪除這條關聯嗎？',
    },

    /** 時間軸刻度。%Y／%n／%j 是 dhtmlx 的日期格式符號，不要翻譯 */
    scale: {
      month: '%Y 年 %n 月',
      day: '%j',
    },

    /** 對外詢問那一欄的小圖示，游標停著看是什麼狀態 */
    inquiryCell: {
      AWAITING: '待回覆',
      OVERDUE: '逾期未回',
      PARTIAL: '部分已回',
      REPLIED: '已回覆',
    },

    cyclic: '⚠️ 偵測到循環依賴，排程無法推算。請先移除造成環的關聯。',
    conflicts: (count: number) => `⚠️ ${count} 個排程衝突：`,
    conflictItem: (label: string, reason: string) => `${label}（${reason}）`,
    criticalPath: (count: number) =>
      `關鍵路徑共 ${count} 個節點`,
    dragHint: '拖曳長條可改期並連動下游，雙擊連線可刪除依賴，從長條端點拉線可建立依賴',
    addLinkFailed: '建立關聯失敗',
  },
} as const
