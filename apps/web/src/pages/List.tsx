import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api, type ProjectParam, type Task, type TaskStatus } from '../lib/api'
import { Button, InquiryBadge, ProblemBadge, TypeBadge, Empty, Input, Select, ColorOption, readableColor, cx } from '../components/ui'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../lib/auth'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { useTheme } from '../lib/theme'
import { rollup, isTaskOverdue } from '../lib/rollup'
import { T } from '../strings'
import { useRemembered } from '../lib/remember'
import { DEFAULT_TYPE_COLORS, divideAndSortLinked } from '../components/EpicSidebar' // Ref: CR-125



/** 清單／樹狀視圖：依 parentId 展開階層（上下關聯） */
export default function ListView({
  projectId, tasks, statuses, onOpen, onEdit, parentForNew, focusedTaskId,
}: {
  projectId: string
  tasks: Task[]; statuses: TaskStatus[]; onOpen: (id: string) => void; onEdit?: (id: string) => void
  /** 側欄選了大項目時，最下面那一列新增的任務要掛在它底下 */
  parentForNew?: string | null
  focusedTaskId?: string | null
}) {
  const qc = useQueryClient()
  const { unreadTaskIds, markTaskRead } = useUnreadNotifications()
  const statusName = useMemo(
    () => Object.fromEntries(statuses.map(s => [s.key, s])), [statuses])
  /* 狀態、種類的下拉要照他挑的顏色上色，深淺看現在的底色（見 ui.tsx 的 readableColor） */
  const { resolved } = useTheme()
  const dark = resolved === 'dark'

  /*
   * 我在這個專案是什麼角色。跟 App 那一層同一組 queryKey，讀到的是快取。
   *
   * 後端（apps/api/src/routes/tasks.ts）：改狀態走的是 PATCH /tasks/:id，
   * 要編輯者以上而且還要是開這張任務的人，專案管理者一律放行；
   * 新增任務只要編輯者，跟「誰開的」無關。
   */
  const { user } = useAuth()
  const { data: project } = useQuery({
    queryKey: ['project', projectId], queryFn: () => Api.project(projectId),
  })
  const statusCatMap = useMemo(
    () => new Map(project?.statuses?.map((s) => [s.key, s.category]) ?? []),
    [project?.statuses]
  )
  const { data: graph } = useQuery({
    queryKey: ['graph', projectId], queryFn: () => Api.graph(projectId),
  })

  /** 類型的中文由專案自己定（0011_project_parameters.sql），查不到就不顯示徽章 */
  const typeOf = (key: string) => project?.types?.find(t => t.key === key)?.name ?? ''
  const typeColorOf = (key: string) =>
    project?.types?.find(t => t.key === key)?.color || DEFAULT_TYPE_COLORS[key] || '#94a3b8'
  /*
   * 我的角色要從成員名單裡撈自己那一列 —— GET /projects/:id 只回成員名單，
   * 沒有「我是什麼角色」這個欄位（回那個欄位的是專案清單 GET /projects）。
   */
  const role = project?.members.find(m => m.id === user?.id)?.role
  // 專案建立者在建立專案時就拿到 MANAGER，所以判斷一律看角色
  const canCreate = role === 'MANAGER' || role === 'EDITOR'
  const canEditTask = (t: Task) =>
    role === 'MANAGER' || (canCreate && !!user && t.createdById === user.id)

  /**
   * 正在替哪一張任務加子任務。
   *
   * 原本要新增子任務只有右上角那一個輸入框，而且它加出來的是「跟目前篩選同一層」的任務 ——
   * 想掛在某一張底下得先選那個大項目、或事後再拖一次。在清單上每一列直接給一個入口，
   * 才對得上使用者的動作：他人就停在那一列上。
   */
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  /** 最下面那一列：新增跟目前這一層同級的任務 */
  const [addingTop, setAddingTop] = useState(false)
  const [topTitle, setTopTitle] = useState('')

  /**
   * 狀態直接在清單上改。
   *
   * 本來要改狀態得先點開那一張任務，或去看板拖 —— 但清單正是「一次看一整排」的地方，
   * 逐張點開等於把最順手的動作變成最慢的。
   */
  const setStatus = useMutation({
    mutationFn: (v: { id: string; statusKey: string }) =>
      Api.patchTask(v.id, { statusKey: v.statusKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  /**
   * 負責人也直接在清單上換，跟狀態同一個道理：一整排看下來，
   * 「這張該給誰」常常是連著好幾張一起決定的。
   *
   * 但這裡**不問交接說明** —— 那是逐張慢慢處理時才寫得出來的東西，
   * 每換一個人就跳一個輸入框，只會讓人一路按取消。要寫就開任務詳情。
   */
  const reassign = useMutation({
    mutationFn: (v: { id: string; assigneeId: string | null }) =>
      Api.reassignTask(v.id, { assigneeId: v.assigneeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  const members = project?.members ?? []
  /* 現任負責人被移出專案之後，成員名單裡就沒有他了。不補一項回去的話，
     下拉會顯示成名單上的第一個人，看起來像被誰偷偷換掉 */
  const assigneeOptions = (t: Task) =>
    t.assigneeId && !members.some(m => m.id === t.assigneeId)
      ? [...members,
         { id: t.assigneeId, role: '',
           displayName: T.task.reassign.optionFormerMember(t.assigneeName ?? '') }]
      : members

  /*
   * 新增任務時就能選種類。原本一律開成「任務」，開完再進抽屜改一次 ——
   * 而在清單上連開五張的時候，那等於五趟來回。
   * 選過的種類**留著不重設**：要連開三張問題的人不必每一張都再選一次。
   */
  const [newType, setNewType] = useState('')
  const rawTypes = project?.types ?? []
  const allTypes = useMemo<ProjectParam[]>(() => {
    const list: ProjectParam[] = rawTypes.length ? [...rawTypes] : [
      { id: 'def-task', key: 'TASK', name: '任務單', color: '#3178c6', kind: 'type', rank: 1, inUse: 0 },
    ]
    if (!list.some(t => t.key === 'BUG')) {
      list.push({ id: 'def-bug', key: 'BUG', name: '問題單', color: '#dc2626', kind: 'type', rank: 999999, inUse: 0 })
    }
    return list
  }, [rawTypes])
  // Ref: CR-127
  const typesUnder = (_parentType: string | null) => allTypes

  /**
   * 這張任務還有沒有對外詢問沒回。有的話「做完」那幾個狀態不給選 ——
   * 東西還在外面沒回來，這件事就沒有結束（見 AGENTS.md）。
   * 已回覆的不算，`REPLIED` 與 `NONE` 都放行。
   */
  const hasOpenInquiry = (t: Task) =>
    t.inquiryState === 'AWAITING' || t.inquiryState === 'PARTIAL'
    || t.inquiryState === 'OVERDUE'
  /**
   * 選過的種類留著（連開三張問題不用選三次），但換到不能放那一種的地方時要退回
   * 第一個合法的 —— 不然畫面顯示的跟真的送出去的會是兩回事。
   */
  const typeFor = (options: ProjectParam[]) =>
    options.some(t => t.key === newType) ? newType : (options[0]?.key ?? 'TASK')

  const create = useMutation({
    mutationFn: (v: { parentId: string | null; title: string; type: string }) =>
      Api.createTask(projectId, { title: v.title, parentId: v.parentId, type: v.type }),
    onSuccess: () => {
      setTitle('')
      setTopTitle('')
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      // 不關掉輸入框：一次要加好幾張子任務是常態，關掉的話每一張都要重點一次
    },
  })

  // 大項目的進度／起迄日由子任務彙總，不直接顯示資料庫存的值
  const rolled = useMemo(() => rollup(tasks), [tasks])
  const parent = parentForNew ? tasks.find(t => t.id === parentForNew) : undefined
  /** 最下面那一列加的是「跟目前這一層同級」的：側欄選了大項目就是掛在它底下 */
  const topTypes = typesUnder(parent?.type ?? null)

  const [collapsedTaskIds, setCollapsedTaskIds] = useRemembered<string[]>(`pmflow.list.collapsed.${projectId}`, [])
  const collapsedSet = useMemo(() => new Set(collapsedTaskIds), [collapsedTaskIds])

  const toggleCollapse = (id: string) => {
    setCollapsedTaskIds(collapsedTaskIds.includes(id)
      ? collapsedTaskIds.filter(k => k !== id)
      : [...collapsedTaskIds, id]
    )
  }

  // 依 3 階層選單規則排序：1. 收納盒/大項目 (置頂) -> 2. 拓撲關聯卡片 -> 3. 獨立卡片
  const ordered = useMemo(() => {
    if (!tasks.length) return []

    const containerBoxSet = new Set<string>()
    try {
      const saved = localStorage.getItem('pmflow_graph_container_boxes')
      if (saved) JSON.parse(saved).forEach((id: string) => containerBoxSet.add(id))
    } catch {}

    const hasKidsSet = new Set<string>()
    for (const t of tasks) {
      if (t.parentId) hasKidsSet.add(t.parentId)
    }

    const isBox = (t: Task) =>
      containerBoxSet.has(t.id) || hasKidsSet.has(t.id) || t.type === 'EPIC' || (t.type as string) === 'BOX'

    const edges = graph?.edges ?? []

    // 建立現有任務集合，若任務的 parentId 不在現有集合中，亦視為當前畫面的頂層根節點
    const taskIds = new Set(tasks.map(t => t.id))
    const isRoot = (t: Task) => !t.parentId || !taskIds.has(t.parentId)

    // 頂層卡片分組
    const rawEpics = tasks.filter(t => isRoot(t))
    const boxesGroup = rawEpics.filter(t => isBox(t)).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    const nonBoxEpics = rawEpics.filter(t => !isBox(t))
    const { linkedTasks, unlinkedTasks } = divideAndSortLinked(nonBoxEpics, edges, tasks)

    const sortedTop = [...boxesGroup, ...linkedTasks, ...unlinkedTasks]

    const rawKidsMap = new Map<string, Task[]>()
    for (const t of tasks) {
      if (t.parentId && taskIds.has(t.parentId)) {
        const list = rawKidsMap.get(t.parentId) || []
        list.push(t)
        rawKidsMap.set(t.parentId, list)
      }
    }

    const byParentMap = new Map<string, Task[]>()
    for (const [pId, list] of rawKidsMap.entries()) {
      const { linkedTasks: kLinked, unlinkedTasks: kUnlinked } = divideAndSortLinked(list, edges, tasks)
      byParentMap.set(pId, [...kLinked, ...kUnlinked])
    }

    const out: Array<Task & { depth: number; hasKids: boolean; isBox: boolean }> = []
    const processed = new Set<string>()

    const walk = (t: Task, depth: number) => {
      if (processed.has(t.id)) return
      processed.add(t.id)

      const kids = byParentMap.get(t.id) ?? []
      const hasKids = kids.length > 0
      out.push({ ...t, depth, hasKids, isBox: isBox(t) })
      if (hasKids && collapsedSet.has(t.id)) return
      for (const k of kids) {
        if (depth < 10) walk(k, depth + 1)
      }
    }

    for (const topT of sortedTop) {
      if (!processed.has(topT.id)) {
        walk(topT, 0)
      }
    }
    for (const t of tasks) {
      if (!processed.has(t.id)) {
        processed.add(t.id)
        out.push({ ...t, depth: 0, hasKids: false, isBox: isBox(t) })
      }
    }
    return out
  }, [tasks, graph, collapsedSet])

  const parallelMap = useMemo(() => {
    const map = new Map<string, { isParallel: boolean; peers: string[] }>()
    const edges = graph?.edges ?? []
    if (!edges.length || !tasks.length) return map

    const targetMap = new Map<string, Array<{ id: string; ref: string }>>()
    edges.forEach((e) => {
      const sId = String(e.sourceId)
      const tId = String(e.targetId)
      const sTask = tasks.find((t) => t.id === sId)
      if (!sTask) return
      const sRef = sTask.ref || (sTask.number ? `MRG-${sTask.number}` : '事件')
      const list = targetMap.get(tId) || []
      list.push({ id: sTask.id, ref: sRef })
      targetMap.set(tId, list)
    })

    targetMap.forEach((sources) => {
      if (sources.length >= 2) {
        sources.forEach((src) => {
          const peers = sources.filter((s) => s.id !== src.id).map((s) => s.ref)
          map.set(src.id, { isParallel: true, peers })
        })
      }
    })
    return map
  }, [graph, tasks])

  const blockedByMap = useMemo(() => {
    const map = new Map<string, string[]>()
    const edges = graph?.edges ?? []
    if (!tasks.length || !edges.length) return map

    const taskMap = new Map(tasks.map((t) => [t.id, t]))

    const isDone = (t?: Task) => {
      if (!t) return false
      const kids = tasks.filter(k => k.parentId === t.id)
      if (kids.length > 0) {
        const allKidsDone = kids.every(k => {
          if (k.progress >= 100) return true
          const cat = statusCatMap.get(k.statusKey)
          return cat === 'DONE' || k.statusKey === 'DONE'
        })
        if (!allKidsDone) return false
      }
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

  const newTop = () => {
    if (!topTitle.trim()) return
    create.mutate({ parentId: parentForNew ?? null, title: topTitle.trim(),
                    type: typeFor(topTypes) })
  }

  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full min-w-[76rem] table-fixed border-collapse overflow-hidden rounded-lg bg-white text-sm ring-1 ring-slate-200
                        dark:bg-slate-900 dark:ring-slate-700">
        <thead>
          <tr className="whitespace-nowrap bg-slate-50 text-left text-xs font-medium text-slate-500
                         dark:bg-slate-800 dark:text-slate-400">
            <th className="min-w-[340px] px-3 py-2">{T.task.list.colTask}</th>
            <th className="w-48 px-3 py-2">{T.task.list.colAlert}</th>
            <th className="w-36 px-3 py-2">{T.task.list.colAssignee}</th>
            <th className="w-28 px-3 py-2">{T.task.list.colStatus}</th>
            <th className="w-28 px-3 py-2">{T.task.list.colInquiry}</th>
            <th className="w-24 px-3 py-2">{T.task.list.colStart}</th>
            <th className="w-24 px-3 py-2">{T.task.list.colDue}</th>
            <th className="w-24 px-3 py-2">{T.task.list.colProgress}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map(t => {
            const st = statusName[t.statusKey]
            const r = rolled.get(t.id)
            const progress = r?.progress ?? t.progress
            const startDate = r?.startDate ?? t.startDate
            const dueDate = r?.dueDate ?? t.dueDate
            const overdue = isTaskOverdue(dueDate, progress)
            const hasUnread = unreadTaskIds.has(t.id)
            return (
              <Fragment key={t.id}>
              <tr ref={el => {
                    if (el && t.id === focusedTaskId) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }}
                  onClick={() => {
                    if (hasUnread) markTaskRead(t.id)
                    onOpen(t.id)
                  }}
                  onDoubleClick={() => {
                    if (hasUnread) markTaskRead(t.id)
                    if (onEdit) onEdit(t.id)
                  }}
                  className={cx(
                    'group cursor-pointer border-t border-slate-100 transition-colors dark:border-slate-800',
                    t.id === focusedTaskId
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                    hasUnread && 'pmflow-flash'
                  )}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 min-w-0" style={{ paddingLeft: t.depth * 16 }}>
                    {/* 折疊 / 展開 箭頭按鈕 */}
                    {t.hasKids ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          toggleCollapse(t.id)
                        }}
                        className="flex h-5 w-5 shrink-0 items-center justify-center text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 rounded transition-colors select-none"
                        title={collapsedSet.has(t.id) ? '展開關聯任務' : '收折關聯任務'}
                      >
                        {collapsedSet.has(t.id) ? '▸' : '▾'}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0 text-center select-none text-slate-300 dark:text-slate-600">
                        {t.depth > 0 ? '└' : ''}
                      </span>
                    )}
                    {/* 只有收納盒 (t.isBox) 顯示 📦 圖示，其餘一般卡片不顯示圖示 */}
                    {t.isBox && (
                      <span className="shrink-0 text-xs select-none ml-0.5">📦</span>
                    )}
                    {/* 種類色標：事件顏色+事件 */}
                    {typeOf(t.type) && (
                      <TypeBadge name={typeOf(t.type)} color={typeColorOf(t.type)} />
                    )}
                    <span className="shrink-0 whitespace-nowrap font-mono text-[11px] font-bold text-slate-500
                                     dark:text-slate-400">{t.ref}</span>
                    {/* 任務名稱 */}
                    <span
                      title={t.title}
                      className={cx('min-w-[120px] max-w-[460px] truncate', t.type === 'EPIC'
                        ? 'font-bold text-slate-900 dark:text-slate-100'
                        : 'text-slate-800 dark:text-slate-200')}>
                      {t.title}
                    </span>

                    {/* ✏️ 編輯筆按鈕：放在任務標題後面，滑過時顯示 */}
                    {onEdit && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onEdit(t.id)
                        }}
                        title="編輯任務詳情"
                        aria-label="編輯任務詳情"
                        className="ml-1 shrink-0 rounded p-0.5 text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400 transition-opacity duration-150"
                      >
                        ✏️
                      </button>
                    )}
                    {/* ＋ 新增關聯任務按鈕：放在任務標題與編輯筆後面 */}
                    {canCreate && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setAddingTo(id => (id === t.id ? null : t.id))
                        setTitle('')
                      }}
                      title={T.task.list.addChildTip(t.title)}
                      aria-label={T.task.list.addChildTip(t.title)}
                      className={cx(
                        'ml-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] transition-all duration-150',
                        addingTo === t.id
                          ? 'opacity-100 bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:bg-slate-200 hover:text-slate-700 '
                            + 'dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                      )}>
                      {T.task.list.addChild}
                    </button>
                    )}
                  </div>
                </td>
                {/* 警示欄位 */}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {t.isBox ? (() => {
                      const boxKids = tasks.filter(k => k.parentId === t.id)
                      const isTaskDone = (sKey: string, prog?: number | null) =>
                        statusCatMap.get(sKey) === 'DONE' || sKey === 'DONE' || (prog ?? 0) >= 100
                      const activeProblemKids = boxKids.filter(k => {
                        if (isTaskDone(k.statusKey, k.progress)) return false
                        return k.type === 'BUG' || (typeof k.problem === 'string' && k.problem.trim().length > 0)
                      })
                      const tHasActiveProblem = !isTaskDone(t.statusKey, t.progress) && typeof t.problem === 'string' && t.problem.trim().length > 0
                      const boxProblemCount = (tHasActiveProblem ? 1 : 0) + activeProblemKids.length
                      const boxBlockedCount = (blockedByMap.get(t.id)?.length ? 1 : 0) + boxKids.filter(k => blockedByMap.get(k.id) && blockedByMap.get(k.id)!.length > 0).length
                      const boxOverdueCount = (overdue ? 1 : 0) + boxKids.filter(k => isTaskOverdue(k.dueDate, k.progress)).length
                      return (
                        <>
                          {boxKids.length > 0 && (
                            <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                              內含 {boxKids.length} 張
                            </span>
                          )}
                          {boxProblemCount > 0 && <ProblemBadge problem={tHasActiveProblem ? t.problem : (activeProblemKids[0]?.problem || '遭遇問題')} count={boxProblemCount} isBox={true} />}
                          {boxBlockedCount > 0 && (
                            <span
                              title="盒內含受阻卡住之任務"
                              className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            >
                              ⛔ 卡住 {boxBlockedCount}
                            </span>
                          )}
                          {boxOverdueCount > 0 && (
                            <span
                              title="盒內含已逾期之任務"
                              className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            >
                              ⏰ 逾期 {boxOverdueCount}
                            </span>
                          )}
                        </>
                      )
                    })() : (
                      <>
                        {t.type !== 'BUG' && <ProblemBadge problem={t.problem} />}
                        {!t.problem && blockedByMap.get(t.id) && blockedByMap.get(t.id)!.length > 0 && (
                          <span
                            title={`卡住：要等 ${blockedByMap.get(t.id)!.join('、')}`}
                            className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          >
                            ⛔ 卡住
                          </span>
                        )}
                        {parallelMap.get(t.id)?.isParallel && (
                          <span
                            title={`與 [${parallelMap.get(t.id)?.peers.join(', ')}] 連至同一個對象（並行執行）`}
                            className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          >
                            ⚡並行
                          </span>
                        )}
                        {overdue && (
                          <span
                            title={`預計完成日: ${dueDate}`}
                            className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          >
                            ⏰ 逾期
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </td>
                {/* 點在下拉上不要順便把任務打開 */}
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  {canEditTask(t) ? (
                    <span className="inline-flex max-w-full items-center gap-1.5">
                      {t.assigneeId && t.assigneeName && (
                        <Avatar userId={t.assigneeId} name={t.assigneeName}
                                hasAvatar={t.assigneeHasAvatar} />
                      )}
                      <select
                        value={t.assigneeId ?? ''}
                        disabled={reassign.isPending}
                        title={T.task.reassign.listHint}
                        onChange={e => reassign.mutate({
                          id: t.id, assigneeId: e.target.value || null,
                        })}
                        className="-ml-0.5 min-w-0 cursor-pointer rounded border border-transparent
                                   bg-transparent py-0.5 pl-1 pr-5 text-xs text-slate-600
                                   hover:border-slate-300 hover:bg-white
                                   focus:border-blue-500 focus:bg-white focus:outline-none
                                   dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900
                                   dark:focus:bg-slate-900">
                        <option value="">{T.common.unassigned}</option>
                        {assigneeOptions(t).map(m => (
                          <option key={m.id} value={m.id}>{m.displayName}</option>
                        ))}
                      </select>
                    </span>
                  ) : t.assigneeName ? (
                    /* 改不動就不要畫成下拉。游標停著才說明原因 */
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                          title={T.task.permission.cannotChangeAssignee}>
                      <Avatar userId={t.assigneeId} name={t.assigneeName}
                              hasAvatar={t.assigneeHasAvatar} />
                      <span className="truncate">{t.assigneeName}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-500"
                          title={T.task.permission.cannotChangeAssignee}>
                      {T.common.unassigned}
                    </span>
                  )}
                </td>
                {/* 點在下拉上不要順便把任務打開 */}
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: st?.color ?? '#cbd5e1' }} />
                    {canEditTask(t) ? (
                      <select
                        value={t.statusKey}
                        disabled={setStatus.isPending}
                        onChange={e => setStatus.mutate({ id: t.id, statusKey: e.target.value })}
                        className="-ml-0.5 cursor-pointer rounded border border-transparent bg-transparent
                                   py-0.5 pl-1 pr-5 text-xs text-slate-600
                                   hover:border-slate-300 hover:bg-white
                                   focus:border-blue-500 focus:bg-white focus:outline-none
                                   dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900
                                   dark:focus:bg-slate-900">
                        {/* 還有對外詢問沒回就不給選「做完」那幾個（規矩見 AGENTS.md）。
                            灰掉而不是抽掉 —— 整個不見的話，看的人不知道那些狀態
                            跑哪去了。目前這一個一定選得到，否則下拉會顯示成別的狀態，
                            一存檔就把它靜悄悄改掉 */}
                        {statuses.map(s => (
                          <ColorOption key={s.key} value={s.key} color={s.color} dark={dark}
                                       disabled={hasOpenInquiry(t) && s.category === 'DONE'
                                                 && s.key !== t.statusKey}>
                            {s.name}
                          </ColorOption>
                        ))}
                      </select>
                    ) : (
                      /* 改不動就不要畫成下拉。游標停著才說明原因，
                         每一列都印一句「沒有權限」會把整張表變成告示欄 */
                      <span className="py-0.5 text-xs text-slate-600 dark:text-slate-300"
                            title={T.task.permission.cannotChangeStatus}>
                        {st?.name ?? T.common.none}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2"><InquiryBadge state={t.inquiryState} /></td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{fmt(startDate)}</td>
                {/* 只有「任務本身逾期」才染紅。單位逾期未回是另一件事，走上一欄的徽章 */}
                <td className={cx('px-3 py-2 text-xs', overdue
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400')}
                    title={overdue ? T.task.list.overdueTip : undefined}>
                  {fmt(dueDate)}
                </td>
                <td className="px-3 py-2">
                  {t.type === 'BUG' ? (
                    <span className="text-xs text-slate-300 dark:text-slate-600 select-none">—</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
                          title={r?.derived
                            ? T.task.list.derivedProgressTip(r.totalCount, r.doneCount)
                            : undefined}>
                      <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200
                                       dark:bg-slate-700">
                        <span className={cx('block h-full', progress >= 100 ? 'bg-emerald-500' : 'bg-red-500')}
                              style={{ width: `${progress}%` }} />
                      </span>
                      <span className="tabular-nums">{progress}%</span>
                      {r?.derived && <span className="text-slate-300 dark:text-slate-500" aria-hidden>∑</span>}
                    </span>
                  )}
                </td>
              </tr>

              {addingTo === t.id && (
                <tr className="border-t border-slate-100 bg-slate-50
                               dark:border-slate-800 dark:bg-slate-800">
                  <td colSpan={8} className="px-3 py-2">
                    <div className="flex items-center gap-2"
                         style={{ paddingLeft: (t.depth + 1) * 20 }}>
                      <span className="select-none text-slate-300 dark:text-slate-500">└</span>
                      <NewTaskType value={typeFor(typesUnder(t.type))}
                                   options={typesUnder(t.type)} onChange={setNewType} />
                      <Input
                        autoFocus
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && title.trim()) {
                            create.mutate({ parentId: t.id, title: title.trim(),
                                            type: typeFor(typesUnder(t.type)) })
                          }
                          if (e.key === 'Escape') { setAddingTo(null); setTitle('') }
                        }}
                        placeholder={T.task.list.addChildPlaceholder(t.title)}
                        className="max-w-md"
                      />
                      {/* 新增與取消都畫成真的按鈕。原本兩顆都是裸文字，
                          在一排輸入框旁邊看起來像說明文字，沒有人知道那可以按 */}
                      <Button variant="primary" className="shrink-0" disabled={!title.trim()}
                              onClick={() => title.trim()
                                && create.mutate({ parentId: t.id, title: title.trim(),
                                                   type: typeFor(typesUnder(t.type)) })}>
                        {T.task.list.addSubmit}
                      </Button>
                      <Button className="shrink-0" onClick={() => { setAddingTo(null); setTitle('') }}>
                        {T.common.cancel}
                      </Button>
                    </div>
                    {/* 提示自己一行。跟種類、標題、兩顆按鈕擠在同一行的話，
                        中文會在任何兩個字之間斷開，那句話就被折成兩截 */}
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-400"
                       style={{ paddingLeft: (t.depth + 1) * 20 }}>
                      {T.task.list.keepOpenHint}
                    </p>
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>

        {/* 新增任務的入口就放在清單最後 —— 東西加在哪裡，入口就在哪裡。
            上面每一列的「＋ 子任務」加的是那一張底下的，這裡加的是同一層的。
            沒有建立任務的權限就整列不畫 */}
        {canCreate && (
        <tfoot>
          <tr className="border-t border-slate-100 dark:border-slate-800">
            <td colSpan={8} className="px-3 py-2">
              {addingTop ? (
                <>
                <div className="flex items-center gap-2">
                  <NewTaskType value={typeFor(topTypes)} options={topTypes}
                               onChange={setNewType} />
                  <Input
                    autoFocus
                    value={topTitle}
                    onChange={e => setTopTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') newTop()
                      if (e.key === 'Escape') { setAddingTop(false); setTopTitle('') }
                    }}
                    placeholder={parent ? T.task.list.addChildPlaceholder(parent.title)
                                        : T.task.list.addTaskPlaceholder}
                    className="max-w-md"
                  />
                  <Button variant="primary" className="shrink-0" disabled={!topTitle.trim()} onClick={newTop}>
                    {T.task.list.addSubmit}
                  </Button>
                  <Button className="shrink-0" onClick={() => { setAddingTop(false); setTopTitle('') }}>
                    {T.common.cancel}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">
                  {T.task.list.keepOpenHint}
                </p>
                </>
              ) : (
                <button onClick={() => { setAddingTop(true); setTopTitle('') }}
                        className="rounded px-1.5 py-0.5 text-sm text-slate-400
                                   hover:bg-slate-100 hover:text-slate-700
                                   dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                  {T.task.list.addTask}
                </button>
              )}
            </td>
          </tr>
        </tfoot>
        )}
      </table>
    </div>
  )
}

/**
 * 新增任務時的種類下拉。兩個新增入口（列上的「＋ 子任務」與清單最後的
 * 「＋ 新增任務」）共用同一顆，選項與寬度才不會兩邊長得不一樣。
 *
 * 沒有標籤只有 `aria-label`：這一列是「種類 + 標題 + 取消」擠在一起的輸入列，
 * 再加一個文字標籤會把輸入框推掉一半寬度。下拉裡的選項本身就講得清楚了。
 */
function NewTaskType({ value, options, onChange }: {
  value: string
  options: ProjectParam[]
  onChange: (v: string) => void
}) {
  const { resolved } = useTheme()
  if (options.length === 0) return null
  const selectedColor = options.find(t => t.key === value)?.color
  const dark = resolved === 'dark'
  return (
    <Select value={value} onChange={e => onChange(e.target.value)}
            aria-label={T.task.drawer.fieldTaskType}
            style={selectedColor ? { color: readableColor(selectedColor, dark) } : undefined}
            className="w-28 shrink-0 font-medium">
      {options.map(t => (
        <ColorOption key={t.key} value={t.key} color={t.color} dark={dark}>
          {t.name}
        </ColorOption>
      ))}
    </Select>
  )
}

const fmt = (d: string | null) => (d ? d.slice(0, 10).replaceAll('-', '/').slice(5) : T.common.none)
