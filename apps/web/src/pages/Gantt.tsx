import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Gantt as DhtmlxGantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { Api, type Task, type LinkType } from '../lib/api'
import { rollup } from '../lib/rollup'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { T } from '../strings'
import { Button } from '../components/ui'

/**
 * 甘特圖：dhtmlx-gantt v10（v10.0.0 起才是 MIT，9.x 以前是 GPL-2.0，務必鎖 ^10）。
 *
 * 兩個關鍵處理：
 * 1. dhtmlx 是命令式 API，不要用 React state 驅動它。
 *    React 只負責掛載／卸載與餵資料快照，內部互動事件轉成我們自己的 action 往外送。
 * 2. 自動排程與關鍵路徑是 dhtmlx 的 PRO 功能 —— 我們在後端自己算，
 *    前端只拿 criticalPath 陣列上色。
 */

// dhtmlx 的 link type 是數字字串：0=FS 1=SS 2=FF 3=SF
const TO_DHX: Partial<Record<LinkType, string>> = { FS: '0', SS: '1', FF: '2', SF: '3' }
const FROM_DHX: Record<string, LinkType> = { '0': 'FS', '1': 'SS', '2': 'FF', '3': 'SF' }

const G = T.chart.gantt

export default function GanttView({
  projectId, tasks, onOpen,
}: {
  projectId: string
  tasks: Task[]
  onOpen: (id: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<ReturnType<typeof DhtmlxGantt.getGanttInstance> | null>(null)
  const qc = useQueryClient()

  const { data: sched } = useQuery({
    queryKey: ['schedule', projectId],
    queryFn: () => Api.schedule(projectId),
  })
  const { data: graph } = useQuery({
    queryKey: ['graph', projectId],
    queryFn: () => Api.graph(projectId),
  })

  const { unreadTaskIds, markTaskRead } = useUnreadNotifications()

  // ── 掛載一次，之後只餵資料 ──
  useEffect(() => {
    if (!hostRef.current) return
    const g = DhtmlxGantt.getGanttInstance()
    ganttRef.current = g

    // Ref: CR-099 - 關閉甘特圖互動式拖拉改期與依賴連線編輯功能，改為純唯讀模式
    g.config.date_format = '%Y-%m-%d'
    g.config.readonly = true
    g.config.drag_progress = false
    g.config.drag_links = false
    g.config.drag_move = false
    g.config.drag_resize = false
    g.config.row_height = 34
    g.config.scale_height = 54
    g.config.scales = [
      { unit: 'month', step: 1, format: G.scale.month },
      { unit: 'day', step: 1, format: G.scale.day },
    ]
    g.config.columns = [
      { name: 'text', label: G.col.task, tree: true, width: 240, resize: true },
      { name: 'start_date', label: G.col.start, align: 'center', width: 88 },
      { name: 'duration', label: G.col.duration, align: 'center', width: 44 },
      { name: 'inquiry', label: G.col.inquiry, align: 'center', width: 62,
        template: (t: unknown) =>
          INQ_CELL[(t as { inquiry?: string }).inquiry ?? 'NONE'] ?? '' },
    ]
    // 中文化：一定要「取出內建 locale 再覆蓋」，
    // 直接丟一個只有部分欄位的物件進去，dhtmlx 會缺鍵並噴 "Invalid day index"。
    const base = g.i18n.getLocale('en')
    g.i18n.addLocale('zh-TW', {
      ...base,
      date: {
        ...base.date,
        month_full: [...G.locale.monthFull],
        month_short: [...G.locale.monthShort],
        day_full: [...G.locale.dayFull],
        day_short: [...G.locale.dayShort],
      },
      labels: {
        ...base.labels,
        new_task: G.locale.newTask,
        icon_save: T.common.save, icon_cancel: T.common.cancel, icon_delete: T.common.delete,
        section_description: G.locale.sectionDescription,
        section_time: G.locale.sectionTime,
        confirm_link_deleting: G.locale.confirmLinkDeleting,
        message_ok: T.common.confirm, message_cancel: T.common.cancel,
      },
    })
    g.i18n.setLocale('zh-TW')

    // 關鍵路徑與對外詢問的狀態上色
    g.templates.task_class = (_s: Date, _e: Date, t: { id?: string | number; critical?: boolean; inquiry?: string; type?: string }) => {
      const cls: string[] = []
      if (t.critical) cls.push('critical')
      if (t.inquiry === 'OVERDUE') cls.push('inq-overdue')
      else if (t.inquiry === 'AWAITING' || t.inquiry === 'PARTIAL') cls.push('inq-awaiting')
      if (t.id && unreadTaskIds.has(String(t.id))) cls.push('pmflow-flash')
      return cls.join(' ')
    }

    g.init(hostRef.current)

    // 雙擊任務開啟詳情頁
    g.attachEvent('onTaskDblClick', (id: string | number) => {
      if (unreadTaskIds.has(String(id))) markTaskRead(String(id))
      onOpen(String(id))
      return false
    }, {})

    // Ref: CR-098 - 區分甘特圖左右區塊滾輪：左側清單上下捲動，右側進度條左右捲動
    const hostEl = hostRef.current
    const handleWheel = (e: WheelEvent) => {
      if (!ganttRef.current) return
      const target = e.target as HTMLElement | null
      if (target?.closest('.gantt_grid')) return // 左側任務清單維持原生上下捲動

      const delta = e.deltaY || e.deltaX
      if (delta && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        e.preventDefault()
        const pos = ganttRef.current.getScrollState()
        ganttRef.current.scrollTo(Math.max(0, pos.x + delta), pos.y)
      }
    }

    if (hostEl) {
      hostEl.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (hostEl) hostEl.removeEventListener('wheel', handleWheel)
      g.destructor()
      ganttRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ── 餵資料 ──
  useEffect(() => {
    const g = ganttRef.current
    if (!g || !tasks.length) return

    const critical = new Set(sched?.criticalPath ?? [])
    // 父任務進度用彙總值，跟清單視圖同一套算法，兩邊數字才會一致
    const rolled = rollup(tasks)
    const data = tasks
      .filter(t => t.startDate && t.dueDate)
      .map(t => ({
        id: t.id,
        text: `${t.ref} ${t.title}`,
        start_date: t.startDate!.slice(0, 10),
        // dhtmlx 的 end_date 是「不含」的，我們的 dueDate 是含尾，所以要 +1 天
        end_date: addDay(t.dueDate!.slice(0, 10)),
        progress: (rolled.get(t.id)?.progress ?? t.progress ?? 0) / 100,
        parent: t.parentId ?? 0,
        type: t.type === 'MILESTONE' ? 'milestone' : undefined,
        critical: critical.has(t.id),
        inquiry: t.inquiryState,
        open: true,
      }))

    // 只把排程類依賴畫成連線；語意類（RELATES / BLOCKS…）不影響日期，
    // 畫在甘特上只會變成雜訊，改在任務詳情頁呈現。
    const links = (graph?.edges ?? [])
      .filter(e => TO_DHX[e.linkType])
      .map(e => ({
        id: e.id, source: e.sourceId, target: e.targetId,
        type: TO_DHX[e.linkType]!, lag: e.lagDays,
      }))

    g.clearAll()
    g.parse({ data, links })

    // 不要在 parse() 之後馬上呼叫 showDate()：那時時間軸的欄位還沒算出來，
    // columnIndexByDate 會回 -1，畫面右上角就跳 "Invalid day index"。
    // dhtmlx 本來就會把視窗對到資料的最早日期，這裡什麼都不用做。
  }, [tasks, sched, graph])

  return (
    <div className="flex h-full flex-col">
      {sched && (sched.conflicts.length > 0 || sched.cyclic) && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800
                        dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
          {sched.cyclic
            ? G.cyclic
            : <>{G.conflicts(sched.conflicts.length)}
                {sched.conflicts.slice(0, 3).map(c => (
                  <span key={c.taskId} className="ml-2">{G.conflictItem(c.label, c.reason)}</span>
                ))}
              </>}
        </div>
      )}
      {sched && sched.criticalPath.length > 0 && (
        <div className="border-b border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500
                        dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <span className="mr-1 inline-block h-2 w-4 rounded-sm bg-red-600 align-middle" />
          {G.criticalPath(sched.criticalPath.length)}
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  )
}

const INQ_CELL: Record<string, string> = {
  NONE: '',
  AWAITING: `<span title="${G.inquiryCell.AWAITING}">⏳</span>`,
  OVERDUE: `<span title="${G.inquiryCell.OVERDUE}">⚠️</span>`,
  PARTIAL: `<span title="${G.inquiryCell.PARTIAL}">◐</span>`,
  REPLIED: `<span title="${G.inquiryCell.REPLIED}">✓</span>`,
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)
const addDay = (s: string) => {
  const d = new Date(s + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
