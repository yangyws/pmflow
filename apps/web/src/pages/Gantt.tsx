import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Gantt as DhtmlxGantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { Api, type Task, type LinkType } from '../lib/api'
import { rollup } from '../lib/rollup'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { todayYmd } from '../lib/date'
import { T } from '../strings'
import { Button, cx } from '../components/ui'
import { useRemembered } from '../lib/remember'

import { DEFAULT_TYPE_COLORS } from '../components/EpicSidebar'

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
  projectId, tasks, onOpen, focusedTaskId,
}: {
  projectId: string
  tasks: Task[]
  onOpen: (id: string) => void
  focusedTaskId?: string | null
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<ReturnType<typeof DhtmlxGantt.getGanttInstance> | null>(null)
  const qc = useQueryClient()
  const [hiddenCols, setHiddenCols] = useRemembered<string[]>(`gantt.hiddenCols.${projectId}`, [])

  const toggleCol = (colKey: string) => {
    const next = hiddenCols.includes(colKey)
      ? hiddenCols.filter(k => k !== colKey)
      : [...hiddenCols, colKey]
    setHiddenCols(next)
    const g = ganttRef.current
    if (g) {
      g.config.columns = getCols(next)
      g.render()
    }
  }

  const { data: sched } = useQuery({
    queryKey: ['schedule', projectId],
    queryFn: () => Api.schedule(projectId),
  })
  const { data: graph } = useQuery({
    queryKey: ['graph', projectId],
    queryFn: () => Api.graph(projectId),
  })
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => Api.project(projectId),
  })

  const { unreadTaskIds, markTaskRead } = useUnreadNotifications()

  const getCols = (hidden: string[]) => [
    {
      name: 'text',
      label: G.col.task,
      tree: true,
      width: 240,
      resize: true,
      template: (t: any) => {
        const color = t.color || '#3178c6'
        return `<span style="color: ${color}; font-weight: 600;">${t.text}</span>`
      },
    },
    ...(!hidden.includes('start_date') ? [{ name: 'start_date', label: G.col.start, align: 'center' as const, width: 88 }] : []),
    ...(!hidden.includes('duration') ? [{ name: 'duration', label: G.col.duration, align: 'center' as const, width: 44 }] : []),
  ]

  // ── 掛載一次，之後只餵資料 ──
  useEffect(() => {
    if (!hostRef.current) return
    const g = DhtmlxGantt.getGanttInstance()
    ganttRef.current = g

    // Ref: CR-099 - 關閉甘特圖互動式拖拉改期與依賴連線編輯功能，改為純唯讀模式
    g.config.fit_tasks = true
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
    g.config.columns = getCols(hiddenCols)

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

    // 關鍵路徑與對外詢問及收納盒/卡片區分上色
    g.templates.task_class = (_s: Date, _e: Date, t: any) => {
      const cls: string[] = []
      if (t.isBox) cls.push('gantt-bar-box')
      else cls.push('gantt-bar-card')
      if (t.critical) cls.push('critical')
      if (t.inquiry === 'OVERDUE') cls.push('inq-overdue')
      else if (t.inquiry === 'AWAITING' || t.inquiry === 'PARTIAL') cls.push('inq-awaiting')
      if (t.noDates) cls.push('no-dates')
      if (t.id && unreadTaskIds.has(String(t.id))) cls.push('pmflow-flash')
      return cls.join(' ')
    }
    g.templates.task_text = () => ''

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
    const rolled = rollup(tasks)
    const kidsSet = new Set(tasks.map(t => t.parentId).filter(Boolean))
    const containerBoxSet = (() => {
      try {
        const saved = localStorage.getItem('pmflow_graph_container_boxes')
        if (saved) return new Set<string>(JSON.parse(saved))
      } catch {}
      return new Set<string>()
    })()

    // 計算卡住 (blockedBy) 狀態
    const blockedByMap = (() => {
      const map = new Map<string, string[]>()
      const edges = graph?.edges ?? []
      if (!tasks.length || !edges.length) return map

      const taskMap = new Map(tasks.map((t) => [t.id, t]))
      const isDone = (t?: Task) => {
        if (!t) return false
        const kids = tasks.filter(k => k.parentId === t.id)
        if (kids.length > 0) {
          const allKidsDone = kids.every(k => k.progress >= 100 || k.statusKey === 'DONE')
          if (!allKidsDone) return false
        }
        return t.progress >= 100 || t.statusKey === 'DONE'
      }

      for (const e of edges) {
        const sHandle = String((e as any).sourceHandle || '')
        const tHandle = String((e as any).targetHandle || '')
        const isTopOrBottom = sHandle.includes('top') || sHandle.includes('bottom') || tHandle.includes('top') || tHandle.includes('bottom')
        if (isTopOrBottom) continue

        const sId = String(e.sourceId || (e as any).source)
        const tId = String(e.targetId || (e as any).target)
        const srcTask = taskMap.get(sId)
        const dstTask = taskMap.get(tId)

        if (srcTask && dstTask && !isDone(srcTask) && !isDone(dstTask)) {
          const srcRef = srcTask.ref || (srcTask.number ? `MRG-${srcTask.number}` : '上游任務')
          const list = map.get(dstTask.id) || []
          if (!list.includes(srcRef)) {
            list.push(srcRef)
          }
          map.set(dstTask.id, list)
        }
      }
      return map
    })()

    // 計算並行 (isParallel) 狀態
    const parallelSet = (() => {
      const set = new Set<string>()
      const edges = graph?.edges ?? []
      if (!edges.length || !tasks.length) return set
      const targetMap = new Map<string, string[]>()
      edges.forEach((e) => {
        const tId = String(e.targetId || (e as any).target)
        const list = targetMap.get(tId) || []
        list.push(String(e.sourceId || (e as any).source))
        targetMap.set(tId, list)
      })
      targetMap.forEach((sources) => {
        if (sources.length >= 2) {
          sources.forEach((sId) => set.add(sId))
        }
      })
      return set
    })()

    let defaultStart = todayYmd()
    const validDates = tasks.map(t => t.startDate || t.dueDate).filter((x): x is string => Boolean(x))
    if (validDates.length > 0) {
      validDates.sort()
      defaultStart = validDates[0]
    }

    const data = tasks.map(t => {
      const r = rolled.get(t.id)
      const rawStart = r?.startDate ?? t.startDate
      const rawDue = r?.dueDate ?? t.dueDate
      const noDates = !rawStart && !rawDue
      const startDate = rawStart ?? rawDue ?? defaultStart
      const dueDate = rawDue ?? rawStart ?? startDate

      const isBox = kidsSet.has(t.id) || t.type === 'EPIC' || containerBoxSet.has(t.id)
      const blockedBy = blockedByMap.get(t.id) ?? []
      const isParallel = parallelSet.has(t.id)
      const isOverdue = Boolean(t.dueDate && t.dueDate < todayYmd() && t.progress < 100 && t.statusKey !== 'DONE')

      const boxKids = isBox ? tasks.filter(k => k.parentId === t.id) : []
      const boxProblemCount = isBox ? ((t.problem ? 1 : 0) + boxKids.filter(k => k.type === 'BUG' || k.problem).length) : 0
      const boxBlockedCount = isBox ? ((blockedBy.length ? 1 : 0) + boxKids.filter(k => (blockedByMap.get(k.id)?.length ?? 0) > 0).length) : 0
      const boxOverdueCount = isBox ? ((isOverdue ? 1 : 0) + boxKids.filter(k => Boolean(k.dueDate && k.dueDate < todayYmd() && k.progress < 100 && k.statusKey !== 'DONE')).length) : 0

      const taskColor = project?.types?.find(type => type.key === t.type)?.color || DEFAULT_TYPE_COLORS[t.type] || '#3178c6'

      return {
        id: t.id,
        text: `${t.ref} ${t.title}`,
        start_date: startDate.slice(0, 10),
        end_date: addDay(dueDate.slice(0, 10)),
        progress: (r?.progress ?? t.progress ?? 0) / 100,
        parent: t.parentId ?? 0,
        type: t.type === 'MILESTONE' ? 'milestone' : isBox ? 'project' : undefined,
        isBox,
        color: taskColor,
        critical: critical.has(t.id),
        inquiry: t.inquiryState,
        problem: t.problem,
        taskType: t.type,
        blockedBy,
        isParallel,
        isOverdue,
        boxKidsCount: boxKids.length,
        boxProblemCount,
        boxBlockedCount,
        boxOverdueCount,
        noDates,
        open: true,
      }
    })

    // Ref: 依需求移除甘特圖上的關聯線 (links 設為空陣列)
    const links: any[] = []

    g.config.columns = getCols(hiddenCols)

    g.clearAll()
    g.parse({ data, links })

    if (focusedTaskId && g.isTaskExists(focusedTaskId)) {
      g.selectTask(focusedTaskId)
      g.showTask(focusedTaskId)
    }
  }, [tasks, sched, graph, hiddenCols, project])

  // 當外部 focusedTaskId 變更時自動定位與高亮
  useEffect(() => {
    const g = ganttRef.current
    if (!g || !focusedTaskId) return
    if (g.isTaskExists(focusedTaskId)) {
      g.selectTask(focusedTaskId)
      g.showTask(focusedTaskId)
    }
  }, [focusedTaskId])

  return (
    <div className="flex h-full flex-col">
      <style>{`
        .gantt_task_content {
          display: none !important;
        }
        .gantt_task_progress {
          background-color: rgba(0, 0, 0, 0.22) !important;
          background-image: repeating-linear-gradient(
            -45deg,
            rgba(255, 255, 255, 0.25),
            rgba(255, 255, 255, 0.25) 6px,
            transparent 6px,
            transparent 12px
          ) !important;
        }
        .gantt_task_line {
          border-color: rgba(0, 0, 0, 0.15) !important;
        }
        /* 移除 dhtmlx 預設關鍵路徑/逾期之粗紅外框 (紅框) */
        .gantt_task_line.critical,
        .gantt_task_line.inq-overdue {
          outline: none !important;
          box-shadow: none !important;
        }
        .gantt_task_line.gantt-bar-box.critical,
        .gantt_task_line.gantt-bar-box.inq-overdue {
          outline: none !important;
          box-shadow: none !important;
        }
        /* 列表列 hover 與選取反白配色優化 */
        .gantt_row:hover, .gantt_task_row:hover {
          background-color: #f1f5f9 !important;
        }
        .gantt_row.gantt_selected, .gantt_task_row.gantt_selected {
          background-color: #e2e8f0 !important;
        }
        .gantt_row.gantt_selected .gantt_cell, .gantt_row:hover .gantt_cell {
          background-color: transparent !important;
        }
        .dark .gantt_row:hover, .dark .gantt_task_row:hover {
          background-color: #1e293b !important;
        }
        .dark .gantt_row.gantt_selected, .dark .gantt_task_row.gantt_selected {
          background-color: #334155 !important;
        }
      `}</style>
      {/* ── 欄位顯示開關工具列 ── */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900 text-xs">
        <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
          <span>📊 甘特圖視圖</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-slate-500 dark:text-slate-400 mr-1">顯示欄位:</span>
          <button
            type="button"
            onClick={() => toggleCol('start_date')}
            className={cx(
              'rounded px-2 py-1 transition-colors cursor-pointer',
              !hiddenCols.includes('start_date')
                ? 'bg-blue-50 font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/30'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            )}
          >
            {!hiddenCols.includes('start_date') ? '✓' : ''} 開始日期
          </button>
          <button
            type="button"
            onClick={() => toggleCol('duration')}
            className={cx(
              'rounded px-2 py-1 transition-colors cursor-pointer',
              !hiddenCols.includes('duration')
                ? 'bg-blue-50 font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/30'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            )}
          >
            {!hiddenCols.includes('duration') ? '✓' : ''} 工期
          </button>
        </div>
      </div>

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
      {/* Ref: CR-100 - 依需求移除頂部關鍵路徑提示列 */}
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  )
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)
const addDay = (s: string) => {
  const d = new Date(s + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
