import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api, ApiError, type Task, type TaskStatus } from '../lib/api'
import { InquiryBadge, ProblemBadge, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { T } from '../strings'
import { DEFAULT_TYPE_COLORS } from '../components/EpicSidebar'

/**
 * 看板：dnd-kit 拖曳。
 *
 * 樂觀更新：放開的瞬間就改本地快取，畫面不等網路。
 * 失敗才回滾 —— 這是所有拖曳互動共用的協定。
 */
export default function Board({
  projectId, tasks, statuses, onOpen, onEdit, focusedTaskId,
}: {
  projectId: string
  tasks: Task[]
  statuses: TaskStatus[]
  onOpen: (id: string) => void
  onEdit?: (id: string) => void
  focusedTaskId?: string | null
}) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null) // Ref: CR-043

  /*
   * 拖一張卡片就是改它的狀態，走的是 POST /tasks/:id/move ——
   * 後端要編輯者以上而且還要是開這張任務的人，專案管理者一律放行。
   * 拖得動卻被退回是最糟的互動，所以拖不了的卡片直接不給拖。
   * queryKey 跟 App 那一層同一組，讀到的是快取。
   */
  const { user } = useAuth()
  const { data: project } = useQuery({
    queryKey: ['project', projectId], queryFn: () => Api.project(projectId),
  })

  const { data: graph } = useQuery({
    queryKey: ['graph', projectId],
    queryFn: () => Api.graph(projectId),
    enabled: !!projectId,
  })

  const blockedByMap = useMemo(() => {
    const map = new Map<string, string[]>()
    const edges = graph?.edges ?? []
    if (!tasks.length || !edges.length) return map

    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    const statusCatMap = new Map(project?.statuses?.map((s) => [s.key, s.category]) ?? [])

    const isDone = (t?: Task) => {
      if (!t) return false
      if (t.progress >= 100) return true
      const cat = statusCatMap.get(t.statusKey)
      return cat === 'DONE' || t.statusKey === 'DONE'
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
  }, [graph, tasks, project?.statuses])
  /*
   * 我的角色要從成員名單裡撈自己那一列 —— GET /projects/:id 只回成員名單，
   * 沒有「我是什麼角色」這個欄位（回那個欄位的是專案清單 GET /projects）。
   */
  const role = project?.members.find(m => m.id === user?.id)?.role
  // 專案建立者在建立專案時就拿到 MANAGER，所以判斷一律看角色
  const canDrag = (t: Task) =>
    role === 'MANAGER' || (role === 'EDITOR' && !!user && t.createdById === user.id)

  const sensors = useSensors(
    // 要拖 6px 才算開始拖，否則單純點擊會被誤判
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // 鍵盤操作路徑：拖曳功能必須有非滑鼠的替代方式
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const columns = useMemo(() => statuses.map(s => ({
    ...s,
    tasks: tasks.filter(t => t.statusKey === s.key)
                .sort((a, b) => Number(a.rank) - Number(b.rank)),
  })), [statuses, tasks])

  /**
   * 這個專案最急的那一級＝優先度清單排最後的那一個（後端已依 rank 排好）。
   * 清單是空的（舊資料還沒補上）就不標。
   */
  const priorities = project?.priorities ?? []
  const topPriority = priorities.length ? priorities[priorities.length - 1] : undefined

  const move = useMutation({
    mutationFn: ({ id, ...v }: { id: string; statusKey?: string; beforeId?: string | null; afterId?: string | null }) =>
      Api.moveTask(id, v),
    onMutate: async vars => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] })
      const prev = qc.getQueryData(['tasks', projectId])
      qc.setQueryData(['tasks', projectId], (old: { tasks: Task[] } | undefined) => {
        if (!old) return old
        return {
          tasks: old.tasks.map(t =>
            t.id === vars.id && vars.statusKey ? { ...t, statusKey: vars.statusKey } : t),
        }
      })
      return { prev }
    },
    onError: (e: unknown, _v, ctx) => { // Ref: CR-043
      if (ctx?.prev) qc.setQueryData(['tasks', projectId], ctx.prev)
      const msg = e instanceof ApiError ? (e.detail || e.title) : String((e as Error)?.message || T.task.board.moveFailed)
      setError(msg)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  function onDragStart(e: DragStartEvent) {
    setError(null)
    setDragging(tasks.find(t => t.id === e.active.id) ?? null)
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const { active, over } = e
    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return
    // 卡片本身已經設成不能拖，這一行是鍵盤與程式路徑的最後一道
    if (!canDrag(activeTask)) return

    // 放在欄的空白處 → over.id 是欄的 key；放在卡片上 → over.id 是卡片 id
    const overColumn = statuses.find(s => s.key === over.id)
    const overTask = tasks.find(t => t.id === over.id)
    const targetStatus = overColumn?.key ?? overTask?.statusKey
    if (!targetStatus) return
    if (targetStatus === activeTask.statusKey && over.id === active.id) return

    const column = columns.find(c => c.key === targetStatus)!
    const list = column.tasks.filter(t => t.id !== active.id)
    const idx = overTask ? list.findIndex(t => t.id === overTask.id) : list.length

    move.mutate({
      id: activeTask.id,
      statusKey: targetStatus,
      afterId: idx > 0 ? list[idx - 1].id : null,
      beforeId: idx < list.length ? list[idx].id : null,
    })
  }

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold hover:opacity-80">✕</button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCorners}
                  onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {columns.map(col => (
            <Column key={col.key} column={col} onOpen={onOpen} onEdit={onEdit} canDrag={canDrag}
                    topPriority={topPriority} focusedTaskId={focusedTaskId} blockedByMap={blockedByMap} />
          ))}
        </div>
        <DragOverlay>
          {dragging && <Card task={dragging} overlay draggable onOpen={() => {}}
                               topPriority={topPriority} />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function Column({
  column, onOpen, onEdit, canDrag, topPriority, focusedTaskId, blockedByMap,
}: {
  column: TaskStatus & { tasks: Task[] }
  onOpen: (id: string) => void
  onEdit?: (id: string) => void
  topPriority?: { key: string; name: string; color: string }
  /** 這張卡片這個人能不能拖 —— 拖曳等於改狀態，權限跟改任務同一條 */
  canDrag: (t: Task) => boolean
  focusedTaskId?: string | null
  blockedByMap?: Map<string, string[]>
}) {
  const { setNodeRef, isOver } = useSortable({ id: column.key, data: { type: 'column' } })
  const overdue = column.tasks.filter(t => t.inquiryState === 'OVERDUE').length

  return (
    <div ref={setNodeRef}
         className={cx(
           // 欄的底色在深色下要比卡片再暗一階，卡片才浮得起來（淺色是反過來的）
           'flex w-72 shrink-0 flex-col rounded-lg bg-slate-100/80 ring-1 dark:bg-slate-900/50',
           isOver ? 'ring-2 ring-blue-400' : 'ring-slate-200 dark:ring-slate-700'
         )}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="h-2 w-2 rounded-full" style={{ background: column.color }} />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{column.name}</span>
        <span className="rounded bg-white px-1.5 text-xs text-slate-500
                         dark:bg-slate-800 dark:text-slate-400">{column.tasks.length}</span>
        {overdue > 0 && (
          <span className="ml-auto rounded bg-red-100 px-1.5 text-xs font-medium text-red-700
                           dark:bg-red-500/15 dark:text-red-300">
            {T.task.board.overdueCount(overdue)}
          </span>
        )}
      </div>
      <SortableContext items={column.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
          {column.tasks.map(task => (
            <SortableCard key={task.id} task={task} onOpen={onOpen} onEdit={onEdit} canDrag={canDrag(task)}
                          topPriority={topPriority} focusedTaskId={focusedTaskId} blockedBy={blockedByMap?.get(task.id)} />
          ))}
          {column.tasks.length === 0 && (
            <div className="rounded-md border-2 border-dashed border-slate-200 py-6 text-center text-xs
                            text-slate-400 dark:border-slate-700 dark:text-slate-400">
              {T.task.board.dropHere}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function SortableCard({ task, onOpen, onEdit, canDrag, topPriority, focusedTaskId, blockedBy }: {
  task: Task; onOpen: (id: string) => void; onEdit?: (id: string) => void; canDrag: boolean
  topPriority?: { key: string; name: string; color: string }
  focusedTaskId?: string | null
  blockedBy?: string[]
}) {
  // disabled 讓 dnd-kit 連感應器都不掛上去，滑鼠與鍵盤兩條路徑一起擋掉
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !canDrag })
  const isFocused = task.id === focusedTaskId

  return (
    <div ref={el => {
           setNodeRef(el)
           if (el && isFocused) {
             el.scrollIntoView({ behavior: 'smooth', block: 'center' })
           }
         }}
         {...attributes} {...listeners}
         style={{ transform: CSS.Transform.toString(transform), transition }}
         className={isDragging ? 'opacity-30' : ''}>
      <Card task={task} onOpen={onOpen} onEdit={onEdit} draggable={canDrag} topPriority={topPriority} isFocused={isFocused} blockedBy={blockedBy} />
    </div>
  )
}

function Card({
  task, onOpen, onEdit, overlay, draggable, topPriority, isFocused, blockedBy,
}: {
  task: Task; onOpen: (id: string) => void; onEdit?: (id: string) => void; overlay?: boolean
  /** 拖不動的卡片不要長成「可以拖」的樣子 —— 手形游標本身就是一種承諾 */
  draggable?: boolean
  topPriority?: { key: string; name: string; color: string }
  isFocused?: boolean
  blockedBy?: string[]
}) {
  const { unreadTaskIds, markTaskRead } = useUnreadNotifications()
  const hasUnread = unreadTaskIds.has(task.id)

  return (
    <div
      onClick={() => {
        if (hasUnread) markTaskRead(task.id)
        onOpen(task.id)
      }}
      onDoubleClick={() => {
        if (hasUnread) markTaskRead(task.id)
        if (onEdit) onEdit(task.id)
      }}
      title={draggable ? undefined : T.task.permission.cannotDragCard}
      className={cx(
        'rounded-lg p-2.5 transition-all',
        isFocused
          ? 'ring-2 ring-blue-500 bg-blue-50/90 dark:bg-blue-900/40 dark:ring-blue-400 shadow-md'
          : 'bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 hover:ring-slate-300 dark:hover:ring-slate-600',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        overlay ? 'rotate-2 shadow-xl' : '',
        hasUnread && 'pmflow-flash'
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">{task.ref}</span>
          {/* 類型徽章對齊 MRG 右側 */}
          {task.type && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              style={{ borderColor: DEFAULT_TYPE_COLORS[task.type] || '#94a3b8', borderWidth: '1px' }}
            >
              <span
                className="h-2 w-0.5 rounded-full"
                style={{ background: DEFAULT_TYPE_COLORS[task.type] || '#94a3b8' }}
              />
              {task.type === 'EPIC' ? '大項目' : task.type === 'TASK' ? '任務' : task.type === 'BUG' ? '問題' : task.type === 'MILESTONE' ? '里程碑' : task.type}
            </span>
          )}
          {task.type === 'MILESTONE' && <span className="text-[11px]">◆</span>}
          {topPriority && task.priority === topPriority.key && (
            <span className="rounded px-1 text-[10px] font-medium"
                  style={{
                    backgroundColor: topPriority.color + '26',   // 15% 透明，淺色深色都吃得下
                    color: topPriority.color,
                  }}>
              {topPriority.name}
            </span>
          )}
        </div>

        {/* 警示徽章放在卡片頂部右側 */}
        {(task.inquiryState !== 'NONE' || task.problem || (blockedBy && blockedBy.length > 0)) && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <InquiryBadge state={task.inquiryState} />
            <ProblemBadge problem={task.problem} />
            {blockedBy && blockedBy.length > 0 && (
              <span
                title={`卡住：要等 ${blockedBy.join('、')}`}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 select-none"
              >
                ⛔ 卡住
              </span>
            )}
          </div>
        )}
      </div>
      <div className="text-sm leading-snug text-slate-800 dark:text-slate-200">{task.title}</div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-400">
        {task.dueDate && <span>📅 {task.dueDate.slice(5, 10).replace('-', '/')}</span>}
        {task.assigneeName && <span>👤 {task.assigneeName}</span>}
        {task.progress > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <span className="h-1 w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <span className={cx("block h-full", task.progress >= 100 ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${task.progress}%` }} />
            </span>
            {task.progress}%
          </span>
        )}
      </div>
    </div>
  )
}
