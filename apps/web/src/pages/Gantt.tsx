import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Gantt as DhtmlxGantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { Api, type Task, type LinkType } from '../lib/api'
import { rollup } from '../lib/rollup'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { todayYmd, shiftYmd } from '../lib/date'
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

const GANTT_ROW_COLORS = [
  '#2563eb', // Blue
  '#7c3aed', // Violet
  '#059669', // Emerald
  '#d97706', // Amber
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#ea580c', // Orange
  '#0d9488', // Teal
  '#9333ea', // Purple
  '#0284c7', // Sky
  '#16a34a', // Green
  '#c026d3', // Fuchsia
]

function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  if (!y || !m) return monthKey
  return `${y} 年 ${parseInt(m, 10)} 月`
}

function getTaskMonthKeys(t: Task, rolledMap: Map<string, any>): string[] {
  const r = rolledMap.get(t.id)
  const rawStart = r?.startDate ?? t.startDate
  const rawDue = r?.dueDate ?? t.dueDate
  if (!rawStart && !rawDue) return []

  const s = (rawStart || rawDue)!.slice(0, 10)
  const e = (rawDue || rawStart)!.slice(0, 10)
  const sMonth = s.slice(0, 7)
  const eMonth = e.slice(0, 7)

  if (sMonth === eMonth) return [sMonth]

  const months: string[] = []
  const [sY, sM] = sMonth.split('-').map(Number)
  const [eY, eM] = eMonth.split('-').map(Number)
  let curY = sY
  let curM = sM
  while (curY < eY || (curY === eY && curM <= eM)) {
    months.push(`${curY}-${String(curM).padStart(2, '0')}`)
    curM++
    if (curM > 12) {
      curM = 1
      curY++
    }
  }
  return months
}

export default function GanttView({
  projectId, tasks, onOpen, onSelectTask, focusedTaskId,
}: {
  projectId: string
  tasks: Task[]
  onOpen: (id: string) => void
  onSelectTask?: (id: string) => void
  focusedTaskId?: string | null
}) {
  const onSelectTaskRef = useRef(onSelectTask)
  useEffect(() => { onSelectTaskRef.current = onSelectTask }, [onSelectTask])
  const onOpenRef = useRef(onOpen)
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])

  const [hiddenCols, setHiddenCols] = useRemembered<string[]>(`gantt.hiddenCols.${projectId}`, [])
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({})

  const toggleCol = (colKey: string) => {
    const next = hiddenCols.includes(colKey)
      ? hiddenCols.filter(k => k !== colKey)
      : [...hiddenCols, colKey]
    setHiddenCols(next)
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

  const nonBugTasks = useMemo(() => tasks.filter(t => t.type !== 'BUG'), [tasks])
  const rolled = useMemo(() => rollup(nonBugTasks), [nonBugTasks])
  const kidsSet = useMemo(() => new Set(nonBugTasks.map(t => t.parentId).filter((id): id is string => Boolean(id))), [nonBugTasks])
  const validTaskIds = useMemo(() => new Set(nonBugTasks.map(t => t.id)), [nonBugTasks])

  const containerBoxSet = useMemo(() => {
    try {
      const saved = localStorage.getItem('pmflow_graph_container_boxes')
      if (saved) return new Set<string>(JSON.parse(saved))
    } catch {}
    return new Set<string>()
  }, [])

  // 計算卡住 (blockedBy) 狀態
  const blockedByMap = useMemo(() => {
    const map = new Map<string, string[]>()
    const edges = graph?.edges ?? []
    if (!nonBugTasks.length || !edges.length) return map

    const taskMap = new Map<string, Task>(nonBugTasks.map((t: Task) => [t.id, t]))
    const isDone = (t?: Task) => {
      if (!t) return false
      const kids = nonBugTasks.filter((k: Task) => k.parentId === t.id)
      if (kids.length > 0) {
        const allKidsDone = kids.every((k: Task) => k.progress >= 100 || k.statusKey === 'DONE')
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
        const list = map.get(tId) || []
        list.push(sId)
        map.set(tId, list)
      }
    }
    return map
  }, [nonBugTasks, graph])

  const parallelSet = useMemo(() => {
    const set = new Set<string>()
    const edges = graph?.edges ?? []
    for (const e of edges) {
      const sHandle = String((e as any).sourceHandle || '')
      const tHandle = String((e as any).targetHandle || '')
      if (sHandle.includes('top') || sHandle.includes('bottom') || tHandle.includes('top') || tHandle.includes('bottom')) {
        set.add(String(e.sourceId || (e as any).source))
        set.add(String(e.targetId || (e as any).target))
      }
    }
    return set
  }, [graph])

  // 依月份彙整任務清單
  const { monthGroups, undatedTasks } = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    const undated: Task[] = []
    const allTaskMap = new Map<string, Task>(nonBugTasks.map((t: Task) => [t.id, t]))

    for (const t of nonBugTasks) {
      const mKeys = getTaskMonthKeys(t, rolled)
      if (mKeys.length === 0) {
        undated.push(t)
      } else {
        for (const mk of mKeys) {
          if (!groups[mk]) groups[mk] = []
          groups[mk].push(t)
        }
      }
    }

    // 確保每個月分區內的子任務若存在，其父任務/收納盒亦被納入保持樹狀層級
    for (const mk of Object.keys(groups)) {
      const set = new Set(groups[mk].map(t => t.id))
      const toAdd: Task[] = []
      for (const t of groups[mk]) {
        let pId = t.parentId
        while (pId && allTaskMap.has(pId) && !set.has(pId)) {
          const parentTask = allTaskMap.get(pId)
          if (!parentTask) break
          toAdd.push(parentTask)
          set.add(pId)
          pId = parentTask.parentId
        }
      }
      if (toAdd.length > 0) {
        groups[mk] = [...toAdd, ...groups[mk]]
      }
    }

    const sortedMonthKeys = Object.keys(groups).sort()
    if (sortedMonthKeys.length === 0 && undated.length === 0) {
      sortedMonthKeys.push(todayYmd().slice(0, 7))
      groups[todayYmd().slice(0, 7)] = []
    }

    return {
      monthGroups: sortedMonthKeys.map(mk => ({ monthKey: mk, tasks: groups[mk] })),
      undatedTasks: undated,
    }
  }, [nonBugTasks, rolled])

  // 當外部 focusedTaskId 變更時，自動展開所在月份
  useEffect(() => {
    if (!focusedTaskId) return
    for (const mg of monthGroups) {
      if (mg.tasks.some(t => t.id === focusedTaskId)) {
        setCollapsedMonths(prev => ({ ...prev, [mg.monthKey]: false }))
        const el = document.getElementById(`month-section-${mg.monthKey}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        break
      }
    }
  }, [focusedTaskId, monthGroups])

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))
  }

  const expandAllMonths = () => setCollapsedMonths({})
  const collapseAllMonths = () => {
    const next: Record<string, boolean> = {}
    monthGroups.forEach(mg => { next[mg.monthKey] = true })
    setCollapsedMonths(next)
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <style>{`
        .gantt_task_content {
          display: none !important;
        }
        .gantt_task_progress {
          background-image: repeating-linear-gradient(
            -45deg,
            rgba(255, 255, 255, 0.35),
            rgba(255, 255, 255, 0.35) 6px,
            transparent 6px,
            transparent 12px
          ) !important;
        }
        .gantt_task_line {
          border-width: 1px !important;
        }
        ${GANTT_ROW_COLORS.map((c, i) => `
        .gantt_task_line.gantt-row-${i} {
          background-color: ${c}22 !important;
          border-color: ${c} !important;
        }
        .gantt_task_line.gantt-row-${i} .gantt_task_progress {
          background-color: ${c} !important;
        }
        `).join('\n')}
        /* 移除 dhtmlx 預設粗紅外框 */
        .gantt_task_line.critical,
        .gantt_task_line.inq-overdue,
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
        /* 欄位調整 Handle 游標樣式支援 */
        .gantt_grid_resize_area,
        .gantt_resizer {
          cursor: col-resize !important;
        }
        .gantt_grid_head_cell {
          position: relative !important;
        }
      `}</style>

      {/* ── 頂部導覽與欄位自訂工具列 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900 text-xs shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <span>📊 甘特圖視圖</span>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              月份分區模式
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-600">|</span>

          {/* 月份快速跳轉與展開/收折按鈕 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAllMonths}
              className="rounded px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
            >
              全部展開
            </button>
            <button
              type="button"
              onClick={collapseAllMonths}
              className="rounded px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
            >
              全部收折
            </button>
          </div>

          {/* 各月份快捷標籤 */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-md scrollbar-none">
            {monthGroups.map(mg => (
              <button
                key={mg.monthKey}
                type="button"
                onClick={() => {
                  setCollapsedMonths(p => ({ ...p, [mg.monthKey]: false }))
                  const el = document.getElementById(`month-section-${mg.monthKey}`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="shrink-0 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:hover:bg-blue-950/40 dark:text-slate-300 dark:hover:text-blue-300 border border-slate-200/60 dark:border-slate-700/60 transition cursor-pointer"
              >
                {formatMonthTitle(mg.monthKey)} ({mg.tasks.length})
              </button>
            ))}
          </div>
        </div>

        {/* 欄位開關切換 */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400">顯示欄位:</span>
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
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 shrink-0">
          {sched.cyclic
            ? G.cyclic
            : <>{G.conflicts(sched.conflicts.length)}
                {sched.conflicts.slice(0, 3).map(c => (
                  <span key={c.taskId} className="ml-2">{G.conflictItem(c.label, c.reason)}</span>
                ))}
              </>}
        </div>
      )}

      {/* ── 月份分區垂直滾動清單（選項 B） ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {monthGroups.map(mg => {
          const isCollapsed = !!collapsedMonths[mg.monthKey]
          return (
            <MonthGanttSection
              key={mg.monthKey}
              monthKey={mg.monthKey}
              tasks={mg.tasks}
              rolled={rolled}
              kidsSet={kidsSet}
              validTaskIds={validTaskIds}
              containerBoxSet={containerBoxSet}
              blockedByMap={blockedByMap}
              parallelSet={parallelSet}
              critical={new Set(sched?.criticalPath ?? [])}
              unreadTaskIds={unreadTaskIds}
              hiddenCols={hiddenCols}
              markTaskRead={markTaskRead}
              onOpen={id => onOpenRef.current(id)}
              onSelectTask={id => onSelectTaskRef.current?.(id)}
              focusedTaskId={focusedTaskId}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => toggleMonthCollapse(mg.monthKey)}
            />
          )
        })}

        {/* 未排期任務區塊 */}
        {undatedTasks.length > 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>⏳</span> 未定日期任務 ({undatedTasks.length})
              </span>
              <span className="text-xs text-slate-400">尚未設定開始日或到期日之任務</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {undatedTasks.map(t => (
                <div
                  key={t.id}
                  onClick={() => onOpenRef.current(t.id)}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-blue-400 hover:shadow-xs transition cursor-pointer text-xs"
                >
                  <div className="font-mono text-[11px] font-bold text-blue-500 mb-0.5">{t.ref}</div>
                  <div className="truncate font-medium text-slate-800 dark:text-slate-100">{t.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 單一月份圖視區塊 (MonthGanttSection)
 */
function MonthGanttSection({
  monthKey, tasks, rolled, kidsSet, validTaskIds, containerBoxSet, blockedByMap,
  parallelSet, critical, unreadTaskIds, hiddenCols, markTaskRead, onOpen, onSelectTask,
  focusedTaskId, isCollapsed, onToggleCollapse,
}: {
  monthKey: string
  tasks: Task[]
  rolled: Map<string, any>
  kidsSet: Set<string>
  validTaskIds: Set<string>
  containerBoxSet: Set<string>
  blockedByMap: Map<string, string[]>
  parallelSet: Set<string>
  critical: Set<string>
  unreadTaskIds: Set<string>
  hiddenCols: string[]
  markTaskRead: (id: string) => void
  onOpen: (id: string) => void
  onSelectTask: (id: string) => void
  focusedTaskId?: string | null
  isCollapsed: boolean
  onToggleCollapse: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<ReturnType<typeof DhtmlxGantt.getGanttInstance> | null>(null)

  const [year, monthNum] = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number)
    return [y, m]
  }, [monthKey])

  // 取得各欄位配置（全欄位支援 resize: true 自由拉寬度）
  const getCols = (hidden: string[]) => [
    {
      name: 'text',
      label: G.col.task,
      tree: true,
      width: 240,
      min_width: 120,
      resize: true,
      template: (t: any) => {
        const color = t.rowColor || '#2563eb'
        return `<span style="color: ${color}; font-weight: 600;">${t.text}</span>`
      },
    },
    ...(!hidden.includes('start_date') ? [{ name: 'start_date', label: G.col.start, align: 'center' as const, width: 88, min_width: 70, resize: true }] : []),
    ...(!hidden.includes('duration') ? [{ name: 'duration', label: G.col.duration, align: 'center' as const, width: 44, min_width: 40, resize: true }] : []),
  ]

  // 初始化該月份獨立甘特圖實例
  useEffect(() => {
    if (isCollapsed || !hostRef.current) return
    const g = DhtmlxGantt.getGanttInstance()
    ganttRef.current = g

    g.config.fit_tasks = false
    g.config.date_format = '%Y-%m-%d'
    g.config.readonly = true
    g.config.drag_progress = false
    g.config.drag_links = false
    g.config.drag_move = false
    g.config.drag_resize = false
    g.config.grid_resize = true // 支援左右拖曳調整左側網格寬度
    g.config.keep_grid_width = false // 欄位擴展時自動延伸網格
    g.config.row_height = 34
    g.config.scale_height = 54

    // 嚴格將時間軸限定於當月，杜絕無限向右橫向滾動
    g.config.start_date = new Date(year, monthNum - 1, 1)
    g.config.end_date = new Date(year, monthNum, 1)

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

    g.templates.task_class = (_s: Date, _e: Date, t: any) => {
      const cls: string[] = [`gantt-row-${t.colorIndex ?? 0}`]
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

    g.attachEvent('onTaskClick', (id: string | number) => {
      const taskId = String(id)
      if (unreadTaskIds.has(taskId)) markTaskRead(taskId)
      onSelectTask(taskId)
      return true
    }, {})

    g.attachEvent('onTaskSelected', (id: string | number) => {
      onSelectTask(String(id))
      return true
    }, {})

    g.attachEvent('onTaskDblClick', (id: string | number) => {
      const taskId = String(id)
      if (unreadTaskIds.has(taskId)) markTaskRead(taskId)
      onOpen(taskId)
      return false
    }, {})

    return () => {
      g.destructor()
      ganttRef.current = null
    }
  }, [monthKey, isCollapsed])

  // 餵資料
  useEffect(() => {
    if (isCollapsed) return
    const g = ganttRef.current
    if (!g) return

    if (!tasks.length) {
      g.clearAll()
      return
    }

    const data = tasks.map((t, idx) => {
      const r = rolled.get(t.id)
      const rawStart = r?.startDate ?? t.startDate
      const rawDue = r?.dueDate ?? t.dueDate
      const noDates = !rawStart && !rawDue
      const defaultMonthStart = `${monthKey}-01`
      const startDate = rawStart ?? rawDue ?? defaultMonthStart
      const dueDate = rawDue ?? rawStart ?? startDate

      const isBox = kidsSet.has(t.id) || t.type === 'EPIC' || containerBoxSet.has(t.id)
      const blockedBy = blockedByMap.get(t.id) ?? []
      const isParallel = parallelSet.has(t.id)
      const isOverdue = Boolean(t.dueDate && t.dueDate < todayYmd() && t.progress < 100 && t.statusKey !== 'DONE')
      const colorIndex = idx % GANTT_ROW_COLORS.length
      const rowColor = GANTT_ROW_COLORS[colorIndex]

      return {
        id: t.id,
        text: `${t.ref} ${t.title}`,
        start_date: startDate.slice(0, 10),
        end_date: shiftYmd(dueDate.slice(0, 10), 1),
        progress: (r?.progress ?? t.progress ?? 0) / 100,
        parent: (t.parentId && validTaskIds.has(t.parentId)) ? t.parentId : 0,
        type: t.type === 'MILESTONE' ? 'milestone' : isBox ? 'project' : undefined,
        isBox,
        colorIndex,
        rowColor,
        critical: critical.has(t.id),
        inquiry: t.inquiryState,
        problem: t.problem,
        taskType: t.type,
        blockedBy,
        isParallel,
        isOverdue,
        noDates,
        open: true,
      }
    })

    g.config.columns = getCols(hiddenCols)
    g.clearAll()
    g.parse({ data, links: [] })

    if (focusedTaskId && g.isTaskExists(focusedTaskId)) {
      g.selectTask(focusedTaskId)
      g.showTask(focusedTaskId)
    }
  }, [tasks, rolled, hiddenCols, isCollapsed, focusedTaskId])

  // 計算適合當前任務數量的視窗高度，避免留白浪費
  const height = Math.max(130, Math.min(500, 54 + tasks.length * 34 + 10))

  return (
    <div
      id={`month-section-${monthKey}`}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
    >
      {/* 月份分區標頭 */}
      <div
        onClick={onToggleCollapse}
        className="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 w-4 text-center">
            {isCollapsed ? '▶' : '▼'}
          </span>
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>📅 {formatMonthTitle(monthKey)}</span>
            <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-[10px] px-2 py-0.5">
              {tasks.length} 個任務
            </span>
          </span>
        </div>

        <span className="text-xs text-slate-400 dark:text-slate-500">
          {isCollapsed ? '點擊展開圖視' : '點擊收折'}
        </span>
      </div>

      {/* 甘特圖容器 */}
      {!isCollapsed && (
        <div className="p-1">
          <div ref={hostRef} style={{ height: `${height}px` }} className="w-full" />
        </div>
      )}
    </div>
  )
}
