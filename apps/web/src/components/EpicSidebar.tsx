import { Fragment, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api, type Project, type ProjectParam, type Task } from '../lib/api'
import { canBeUnder, typesAllowedUnder } from '../lib/hierarchy'
import { rollup } from '../lib/rollup'
import { T } from '../strings'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { Button, Input, Select, ColorOption, readableColor, cx } from './ui'
import { useTheme } from '../lib/theme'

/**
 * Ref: CR-006 (專案樹狀側欄架構與折疊狀態持久化，詳見 CHANGELOG.md)
 */

export const DEFAULT_TYPE_COLORS: Record<string, string> = {
  EPIC: '#d97706',
  TASK: '#3178c6',
  BUG: '#dc2626',
  MILESTONE: '#8b5cf6',
}

/**
 * 收折狀態存在瀏覽器。
 *
 * 「側欄要不要收起來」是看螢幕決定的 —— 在筆電上為了甘特圖寬一點而收起來的人，
 * 換到大螢幕未必想收。存進帳號會讓兩台裝置互相蓋掉，跟深色模式同一個道理。
 */
export function divideAndSortLinked(
  taskList: Task[],
  edges: Array<{ sourceId: string; targetId: string; linkType?: string }>,
  allTasks?: Task[]
): { linkedTasks: Task[]; unlinkedTasks: Task[] } {
  if (!taskList.length) return { linkedTasks: [], unlinkedTasks: [] }

  const itemMap = new Map(taskList.map(t => [t.id, t]))
  const parentOfMap = new Map<string, string>()

  if (allTasks) {
    for (const t of allTasks) {
      if (t.parentId) {
        parentOfMap.set(t.id, t.parentId)
      }
    }
  }

  const compareRef = (a: Task, b: Task) => {
    const numA = a.number ?? 0
    const numB = b.number ?? 0
    if (numA !== numB) return numA - numB
    return a.ref.localeCompare(b.ref, undefined, { numeric: true })
  }

  const SCHEDULING_SET = new Set(['FS', 'SS', 'FF', 'SF'])
  const isHorizontalLink = (linkType?: string) => !linkType || SCHEDULING_SET.has(linkType)

  // 將子任務的連線向上映射至頂層大項目，並區分為左右關聯與上下關聯
  const horizEdges: Array<{ sourceId: string; targetId: string }> = []
  const vertEdges: Array<{ sourceId: string; targetId: string }> = []

  for (const e of edges) {
    let src = e.sourceId
    let tgt = e.targetId
    while (parentOfMap.has(src) && !itemMap.has(src)) {
      src = parentOfMap.get(src)!
    }
    while (parentOfMap.has(tgt) && !itemMap.has(tgt)) {
      tgt = parentOfMap.get(tgt)!
    }
    if (itemMap.has(src) && itemMap.has(tgt) && src !== tgt) {
      if (isHorizontalLink(e.linkType)) {
        horizEdges.push({ sourceId: src, targetId: tgt })
      } else {
        vertEdges.push({ sourceId: src, targetId: tgt })
      }
    }
  }

  const horizIds = new Set<string>()
  for (const e of horizEdges) {
    horizIds.add(e.sourceId)
    horizIds.add(e.targetId)
  }

  const vertIds = new Set<string>()
  for (const e of vertEdges) {
    if (!horizIds.has(e.sourceId)) vertIds.add(e.sourceId)
    if (!horizIds.has(e.targetId)) vertIds.add(e.targetId)
  }

  const sortSubGroup = (groupTasks: Task[], groupEdges: Array<{ sourceId: string; targetId: string }>): Task[] => {
    if (!groupTasks.length) return []
    const gMap = new Map(groupTasks.map(t => [t.id, t]))
    const inDegree = new Map<string, number>()
    const childrenMap = new Map<string, string[]>()

    for (const t of groupTasks) {
      inDegree.set(t.id, 0)
      childrenMap.set(t.id, [])
    }

    for (const e of groupEdges) {
      if (gMap.has(e.sourceId) && gMap.has(e.targetId)) {
        childrenMap.get(e.sourceId)?.push(e.targetId)
        inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1)
      }
    }

    const roots = groupTasks.filter(t => (inDegree.get(t.id) ?? 0) === 0).sort(compareRef)
    const res: Task[] = []
    const visited = new Set<string>()

    function dfs(id: string) {
      if (visited.has(id)) return
      visited.add(id)
      const task = gMap.get(id)
      if (task) res.push(task)

      const nextTasks = (childrenMap.get(id) ?? [])
        .map(nid => gMap.get(nid))
        .filter((t): t is Task => !!t && !visited.has(t.id))
        .sort(compareRef)

      for (const next of nextTasks) {
        dfs(next.id)
      }
    }

    for (const root of roots) {
      dfs(root.id)
    }

    for (const t of groupTasks) {
      if (!visited.has(t.id)) res.push(t)
    }
    return res
  }

  const horizGroup = taskList.filter(t => horizIds.has(t.id))
  const vertGroup = taskList.filter(t => vertIds.has(t.id))
  const unlinkedTasks = taskList.filter(t => !horizIds.has(t.id) && !vertIds.has(t.id)).sort(compareRef)

  const sortedHoriz = sortSubGroup(horizGroup, horizEdges)
  const sortedVert = sortSubGroup(vertGroup, vertEdges)

  // 左右關聯排序在最上面 (收納盒下方)，上下關聯緊跟在後
  return { linkedTasks: [...sortedHoriz, ...sortedVert], unlinkedTasks }
}

const COLLAPSE_KEY = 'pmflow.sidebar'

function storedCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'collapsed'
  } catch {
    // 隱私模式下 localStorage 會直接丟例外，那就當作沒收起來
    return false
  }
}

function rememberCollapsed(v: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? 'collapsed' : 'expanded')
  } catch {
    // 存不進去就只有這次有效，不值得為它中斷操作
  }
}

export function EpicSidebar({
  project, tasks, types = [], selectedEpicId, onSelectEpic, view, selectedTaskId, onOpenTask, onOpenEditTask,
  onSwitchProject,
}: {
  project?: Project
  tasks: Task[]
  /**
   * 這個專案的任務種類。側欄每一列要標出自己是哪一種 ——
   * 少了它，最上層的大項目跟最上層的任務長得一模一樣，
   * 掛在任務底下的錯誤也看不出來跟兄弟任務有什麼不同。
   */
  types?: ProjectParam[]
  /** null = 全部任務（不篩選） */
  selectedEpicId: string | null
  onSelectEpic: (id: string | null) => void
  /** 目前右側運行的頁籤視角 */
  view?: string
  /** 目前在右邊顯示詳情的任務 */
  selectedTaskId: string | null
  /** 點小項目 → 在右邊顯示那張任務 */
  onOpenTask: (id: string) => void
  /** 點擊 ✏️ 鉛筆按鈕 → 開啟編輯詳細內容抽屜 */
  onOpenEditTask?: (id: string) => void
  onSwitchProject: () => void
}) {
  const qc = useQueryClient()
  const { resolved } = useTheme()
  const dark = resolved === 'dark'
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const typeList = useMemo<ProjectParam[]>(() => {
    const list: ProjectParam[] = types.length ? [...types] : [
      { id: 'def-task', key: 'TASK', name: '任務單', color: '#3178c6', kind: 'type', rank: 1, inUse: 0 },
    ]
    if (!list.some(t => t.key === 'BUG')) {
      list.push({ id: 'def-bug', key: 'BUG', name: '問題單', color: '#dc2626', kind: 'type', rank: 999999, inUse: 0 })
    }
    return list
  }, [types])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<boolean>(() => storedCollapsed())

  const [containerBoxTick, setContainerBoxTick] = useState(0)

  useEffect(() => {
    const handleUpdate = () => setContainerBoxTick(t => t + 1)
    window.addEventListener('pmflow_container_boxes_changed', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('pmflow_container_boxes_changed', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const { data: graphData } = useQuery({
    queryKey: ['graph', project?.id],
    queryFn: () => Api.graph(project!.id),
    enabled: !!project?.id,
  })

  const blockedByMap = useMemo(() => {
    const map = new Map<string, string[]>()
    const edges = graphData?.edges ?? []
    if (!tasks || !tasks.length || !edges || !edges.length) return map

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
  }, [tasks, graphData])

  const { epics, lastContainerBoxId, stat, looseCount, childrenOf, bugsUnder, overdueIn, inquiriesIn, dividerAfterTaskIdSet } = useMemo(() => {
    const edges = graphData?.edges ?? []
    const ids = new Set(tasks.map(t => t.id))
    const containerBoxSet = (() => {
      try {
        const saved = localStorage.getItem('pmflow_graph_container_boxes')
        if (saved) return new Set<string>(JSON.parse(saved))
      } catch {}
      return new Set<string>()
    })()

    const rawKids = new Map<string, Task[]>()
    const hasKidsSet = new Set<string>()
    for (const t of tasks) {
      if (!t.parentId || !ids.has(t.parentId)) continue
      hasKidsSet.add(t.parentId)
      const a = rawKids.get(t.parentId) ?? []; a.push(t); rawKids.set(t.parentId, a)
    }

    const isBox = (t: Task) => t.type !== 'BUG' && (containerBoxSet.has(t.id) || hasKidsSet.has(t.id))

    const rawEpics = tasks.filter(t => !t.parentId)

    const compareRef = (a: Task, b: Task) => {
      const numA = a.number ?? 0
      const numB = b.number ?? 0
      if (numA !== numB) return numA - numB
      return a.ref.localeCompare(b.ref, undefined, { numeric: true })
    }

    // 1. 第一優先：收納盒 (Storage Boxes)，依 MRG / Ref 數字大小排序
    const boxesGroup = rawEpics.filter(t => isBox(t)).sort(compareRef)

    // 2. 第二優先：有相依關聯線的卡片 (Linked Cards)，依拓撲相依結構排序
    // 3. 第三優先：沒有關聯線的獨立卡片 (Unlinked Cards)，依 MRG / Ref 數字大小排序
    const nonBoxEpics = rawEpics.filter(t => !isBox(t))
    const { linkedTasks, unlinkedTasks } = divideAndSortLinked(nonBoxEpics, edges, tasks)

    const epics = [...boxesGroup, ...linkedTasks, ...unlinkedTasks]

    // 4. 插入分隔線位置：每個收納盒區塊下方皆繪製一條分隔線！連線卡片區塊下方也繪製一條分隔線！
    const dividerAfterTaskIdSet = new Set<string>()
    for (const box of boxesGroup) {
      dividerAfterTaskIdSet.add(box.id)
    }
    if (linkedTasks.length > 0) {
      dividerAfterTaskIdSet.add(linkedTasks[linkedTasks.length - 1].id)
    }

    const lastContainerBoxId = null
    const rolled = rollup(tasks)

    const kids = new Map<string, Task[]>()
    for (const [pId, list] of rawKids.entries()) {
      const { linkedTasks: kLinked, unlinkedTasks: kUnlinked } = divideAndSortLinked(list, edges, tasks)
      kids.set(pId, [...kLinked, ...kUnlinked])
    }
    const overdueIn = (rootId: string): number => {
      let n = 0
      const walk = (id: string, seen = new Set<string>()) => {
        if (seen.has(id)) return
        seen.add(id)
        const self = tasks.find(t => t.id === id)
        if (self?.inquiryState === 'OVERDUE') n++
        for (const k of kids.get(id) ?? []) walk(k.id, seen)
      }
      walk(rootId)
      return n
    }

    /**
     * 這一支有幾件**還沒逾期**的對外詢問（含自己）。
     *
     * 刻意扣掉逾期的：逾期已經有自己的徽章了，兩邊都算的話同一件事會被數兩次，
     * 而「外 3 逾 1」也會被讀成「總共四件」。分開之後兩個數字加起來
     * 才剛好是「這一支發出去的對外詢問」的總數。
     *
     * **已回覆的不算**：那件事已經完成了。這兩顆徽章同時是「還能不能結案」的
     * 儀表板（見 AGENTS.md「還有對外詢問沒回，就不能完成」）——
     * 把已回覆的算進來的話，任務只要問過一次就永遠有數字、永遠結不了案。
     */
    const inquiriesIn = (rootId: string): number => {
      let n = 0
      const walk = (id: string, seen = new Set<string>()) => {
        if (seen.has(id)) return
        seen.add(id)
        const self = tasks.find(t => t.id === id)
        if (self?.inquiryState === 'AWAITING' || self?.inquiryState === 'PARTIAL') n++
        for (const k of kids.get(id) ?? []) walk(k.id, seen)
      }
      walk(rootId)
      return n
    }

    /**
     * 這個節點**底下**有幾張問題（不含自己）。
     *
     * 收著的大項目顯示整棵子樹的總數，展開之後每張任務再各自顯示自己底下的 ——
     * 所以要走完整棵子樹，不能只看直屬子任務，不然收合前後看到的數字會對不上。
     *
     * 不含自己是刻意的：一張問題自己就掛著「問題」的種類徽章了，
     * 旁邊再標一個「1」只會讓人以為它底下還有東西。
     */
    const bugsUnder = (rootId: string): number => {
      let n = 0
      const walk = (id: string, seen = new Set<string>()) => {
        if (seen.has(id)) return
        seen.add(id)
        for (const k of kids.get(id) ?? []) {
          if (k.type === 'BUG') n++
          walk(k.id, seen)
        }
      }
      walk(rootId)
      return n
    }

    const stat = new Map(tasks.map(e => {
      const r = rolled.get(e.id)
      const prog = r?.progress ?? e.progress
      return [e.id, {
        progress: prog,
        // 葉節點的 totalCount 是 1（自己），對大項目沒有意義，一律以子任務數為準
        done: r?.derived ? r.doneCount : (prog >= 100 ? 1 : 0),
        total: r?.derived ? r.totalCount : 1,
        hasChildren: !!r?.derived,
        overdue: overdueIn(e.id),
        bugs: bugsUnder(e.id),
      }]
    }))

    const looseCount = tasks.filter(t => t.parentId && !ids.has(t.parentId)).length

    return { epics, lastContainerBoxId, stat, looseCount, childrenOf: kids, bugsUnder, overdueIn, inquiriesIn, dividerAfterTaskIdSet }
  }, [tasks, graphData, containerBoxTick])

  const relatedTaskIds = useMemo(() => {
    const activeId = selectedTaskId || selectedEpicId
    if (!activeId) return null
    const result = new Set<string>()
    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    const childrenMap = new Map<string, string[]>()
    tasks.forEach((t) => {
      if (t.parentId) {
        const list = childrenMap.get(t.parentId) || []
        list.push(t.id)
        childrenMap.set(t.parentId, list)
      }
    })

    const collectSubtreeIfBox = (id: string) => {
      if (result.has(id)) return
      result.add(id)
      const t = taskMap.get(id)
      const isBox = t?.type === 'EPIC' || childrenMap.has(id)
      if (isBox) {
        const kids = childrenMap.get(id) || []
        kids.forEach((kId) => collectSubtreeIfBox(kId))
      }
    }

    const collectAncestors = (id: string) => {
      let cur = taskMap.get(id)
      const visited = new Set<string>()
      while (cur?.parentId && !visited.has(cur.id)) {
        visited.add(cur.id)
        result.add(cur.parentId)
        cur = taskMap.get(cur.parentId)
      }
    }

    collectSubtreeIfBox(activeId)
    collectAncestors(activeId)

    const isDone = (id: string) => {
      const t = taskMap.get(id)
      if (!t) return false
      if (t.progress >= 100) return true
      const kids = tasks.filter(k => k.parentId === t.id)
      if (kids.length > 0) {
        return kids.every(k => k.progress >= 100 || k.statusKey === 'DONE')
      }
      return t.statusKey === 'DONE'
    }

    const edges = graphData?.edges ?? []
    let changed = true
    while (changed) {
      changed = false
      for (const e of edges) {
        const sId = String(e.sourceId)
        const tId = String(e.targetId)
        if (result.has(sId) && !result.has(tId)) {
          collectSubtreeIfBox(tId)
          collectAncestors(tId)
          changed = true
        }
        if (result.has(tId) && !result.has(sId)) {
          if (!isDone(sId)) {
            collectSubtreeIfBox(sId)
            collectAncestors(sId)
            changed = true
          }
        }
      }
    }

    return result
  }, [selectedTaskId, selectedEpicId, tasks, graphData])

  /** 一列任務的問題數：底下的，加上自己（如果它本身就是一張問題） */
  const bugCount = (t: Task) => bugsUnder(t.id) + (t.type === 'BUG' ? 1 : 0)

  // 當右側選擇新任務時，自動遞迴展開該任務的所有祖先父節點，確保在左側側欄中完好呈現在視野中
  useEffect(() => {
    if (!selectedTaskId) return
    const parentsToExpand = new Set<string>()
    let cur = tasks.find(t => t.id === selectedTaskId)
    const guard = new Set<string>()
    while (cur?.parentId && !guard.has(cur.id)) {
      guard.add(cur.id)
      parentsToExpand.add(cur.parentId)
      cur = tasks.find(t => t.id === cur!.parentId)
    }
    if (parentsToExpand.size > 0) {
      setExpanded(prev => {
        let changed = false
        const next = new Set(prev)
        for (const pId of parentsToExpand) {
          if (!next.has(pId)) {
            next.add(pId)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [selectedTaskId, tasks])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  /**
   * 只展開、不收合。
   *
   * 在某一列底下新增子任務之後一定要展開那一列 —— 收著的話，
   * 建立完什麼都沒有變，看的人不知道剛剛那張跑去哪了。
   */
  function expand(id: string) {
    setExpanded(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
  }

  function setCollapse(v: boolean) {
    setCollapsed(v)
    rememberCollapsed(v)
  }

  const [createType, setCreateType] = useState<string>('EPIC')

  const create = useMutation({
    mutationFn: (v: { title: string; type: string }) =>
      Api.createTask(project!.id, { title: v.title, type: v.type }),
    onSuccess: () => {
      setTitle(''); setAdding(false)
      qc.invalidateQueries({ queryKey: ['tasks', project!.id] })
    },
  })

  /**
   * 收起來之後留一條窄條，不是整個消失 ——
   * 整個藏掉的話，「怎麼把它叫回來」就變成一個要學的秘密。
   *
   * 窄條上只剩展開與專案色點：對外詢問已經是上面那排頁籤的一個，
   * 成員搬到右上角的頭像選單，兩個都不再需要側欄的入口。
   */
  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-slate-200
                        bg-white py-3 dark:border-slate-700 dark:bg-slate-900 select-none">
        <button onClick={() => setCollapse(false)}
                title={T.nav.sidebar.expandSidebar}
                aria-label={T.nav.sidebar.expandSidebar}
                className="rounded-md p-1.5 text-sm text-slate-400 hover:bg-slate-100
                           hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800
                           dark:hover:text-slate-300 cursor-pointer">
          »
        </button>

        <div className="flex flex-col items-center gap-2.5 mt-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                title={project?.name ?? T.common.none}
                style={{ background: project?.color ?? '#94a3b8' }} />
          {project?.name && (
            <div
              className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wider whitespace-nowrap"
              style={{ writingMode: 'vertical-lr' }}
            >
              {project.name}
            </div>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white
                      dark:border-slate-700 dark:bg-slate-900">

      {/* ── 專案標頭 (與右側頂欄第一層 h-12 完美對齊) ── */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: project?.color ?? '#94a3b8' }} />
          {project?.key && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
              {project.key}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-base font-bold text-slate-800
                           dark:text-slate-100">
            {project?.name ?? T.common.none}
          </span>
        </div>
        <button onClick={() => setCollapse(true)}
                title={T.nav.sidebar.collapseSidebar}
                aria-label={T.nav.sidebar.collapseSidebar}
                className="shrink-0 rounded px-1 text-sm text-slate-400 hover:text-slate-700
                           dark:text-slate-400 dark:hover:text-slate-300">
          «
        </button>
      </div>

      <div className="px-4 pb-1 pt-3">
        <div className="text-xs font-medium tracking-wide text-slate-400 dark:text-slate-400">
          {T.nav.sidebar.epics}
        </div>

      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <button
          onClick={() => onSelectEpic(null)}
          className={cx(
            'mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
            selectedEpicId === null
              ? 'bg-slate-100 font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
          )}>
          <span className="text-slate-400 dark:text-slate-400">☰</span>
          <span className="flex-1">{T.nav.sidebar.allTasks}</span>
          <span className="text-xs tabular-nums text-slate-400 dark:text-slate-400">
            {tasks.length}
          </span>
        </button>

        {epics.length === 0 && (
          <div className="px-2.5 py-3 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
            {T.nav.sidebar.emptyTitle}<br />
            {T.nav.sidebar.emptyHint}
          </div>
        )}

        {epics.map(epic => (
          <Fragment key={epic.id}>
            <TreeNode
              task={epic}
              depth={0}
              projectId={project?.id}
              childrenOf={childrenOf}
              stat={stat.get(epic.id)}
              statMap={stat}
              blockedByMap={blockedByMap}
              bugsUnder={bugsUnder}
              overdueIn={overdueIn}
              inquiriesIn={inquiriesIn}
              types={typeList}
              expanded={expanded}
              toggle={toggle}
              expand={expand}
              selectedEpicId={selectedEpicId}
              selectedTaskId={selectedTaskId}
              relatedTaskIds={relatedTaskIds}
              dividerAfterTaskIdSet={dividerAfterTaskIdSet}
              onSelectEpic={onSelectEpic}
              onOpenTask={onOpenTask}
              onOpenEditTask={onOpenEditTask}
            />
            {lastContainerBoxId === epic.id && (
              <div className="my-2 border-b border-slate-200 dark:border-slate-700/60" />
            )}
          </Fragment>
        ))}

        {adding ? (
          <div className="mt-2 space-y-1.5 rounded-md bg-slate-50 p-2 dark:bg-slate-800">
            <div className="flex gap-1.5 items-center">
              {(() => {
                const activeColor =
                  typeList.find(t => t.key === createType)?.color ||
                  DEFAULT_TYPE_COLORS[createType] ||
                  '#3178c6'
                return (
                  <>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: activeColor }}
                    />
                    <span className="text-xs text-slate-500 shrink-0">類型：</span>
                    <Select
                      value={createType}
                      onChange={e => setCreateType(e.target.value)}
                      style={{ color: readableColor(activeColor, dark) }}
                      className="text-xs py-1 flex-1 font-semibold"
                    >
                      {typeList.map(t => {
                        const tColor = t.color || DEFAULT_TYPE_COLORS[t.key] || '#3178c6'
                        return (
                          <ColorOption
                            key={t.key}
                            value={t.key}
                            color={tColor}
                            dark={dark}
                          >
                            ● {t.name}
                          </ColorOption>
                        )
                      })}
                    </Select>
                  </>
                )
              })()}
            </div>
            <Input value={title} onChange={e => setTitle(e.target.value)}
                   placeholder="事件名稱" autoFocus
                   onKeyDown={e => {
                     if (e.key === 'Enter' && title.trim()) create.mutate({ title: title.trim(), type: createType })
                     if (e.key === 'Escape') { setAdding(false); setTitle('') }
                   }} />
            <div className="flex gap-1">
              <Button variant="primary" className="flex-1 justify-center text-xs"
                      disabled={!title.trim() || create.isPending}
                      onClick={() => create.mutate({ title: title.trim(), type: createType })}>{T.common.create}</Button>
              <Button className="text-xs" onClick={() => { setAdding(false); setTitle('') }}>
                {T.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} disabled={!project}
                  className="mt-1 w-full rounded-md px-2.5 py-2 text-left text-sm text-slate-400
                             hover:bg-slate-50 disabled:opacity-50
                             dark:text-slate-400 dark:hover:bg-slate-800">
            ＋ 新增事件
          </button>
        )}
      </nav>

    </aside>
  )
}

/**
 * 樹上的一列，會遞迴畫出自己底下的每一層。
 *
 * **為什麼要遞迴**：原本只畫兩層（大項目 → 直屬子項），所以掛在任務底下的錯誤
 * 根本不會出現在側欄上 —— 而種類的上下關係就規定錯誤只能掛在任務底下
 * （見 AGENTS.md）。畫不出來的話，左邊看到的結構跟實際的結構是兩回事。
 *
 * 深度只影響縮排與字級：最上層那一列（大項目）多一條進度條與 x/y，
 * 底下每一層都是同一種緊湊的樣子，再深也不會多出新花樣。
 */
function TreeNode({
  task, depth, projectId, childrenOf, stat, statMap, blockedByMap, bugsUnder, overdueIn, inquiriesIn, types,
  expanded, toggle, expand, selectedEpicId, selectedTaskId, relatedTaskIds, dividerAfterTaskIdSet, onSelectEpic, onOpenTask, onOpenEditTask,
}: {
  task: Task
  depth: number
  /** 沒有專案就畫不出「＋」（建立要它） */
  projectId?: string
  types: ProjectParam[]
  childrenOf: Map<string, Task[]>
  stat?: { progress: number; done: number; total: number; hasChildren: boolean }
  statMap?: Map<string, { progress: number; done: number; total: number; hasChildren: boolean }>
  blockedByMap?: Map<string, string[]>
  bugsUnder: (id: string) => number
  overdueIn: (id: string) => number
  inquiriesIn: (id: string) => number
  expanded: Set<string>
  toggle: (id: string) => void
  /** 新增完子任務要把這一列展開，不然看不到剛剛建的那張 */
  expand: (id: string) => void
  selectedEpicId: string | null
  selectedTaskId: string | null
  relatedTaskIds?: Set<string> | null
  dividerAfterTaskIdSet?: Set<string>
  onSelectEpic: (id: string) => void
  onOpenTask: (id: string) => void
  onOpenEditTask?: (id: string) => void
}) {
  const qc = useQueryClient()
  const [addingChild, setAddingChild] = useState(false)
  const [childTitle, setChildTitle] = useState('')
  const kids = childrenOf.get(task.id) ?? []
  const open = expanded.has(task.id)

  const showDivider = useMemo(() => {
    if (!dividerAfterTaskIdSet) return false
    if (dividerAfterTaskIdSet.has(task.id) && (!open || kids.length === 0)) {
      return true
    }
    if (!open && kids.length > 0) {
      const hasHiddenTarget = (tList: Task[]): boolean => {
        for (const k of tList) {
          if (dividerAfterTaskIdSet.has(k.id)) return true
          const subK = childrenOf.get(k.id) ?? []
          if (subK.length > 0 && hasHiddenTarget(subK)) return true
        }
        return false
      }
      return hasHiddenTarget(kids)
    }
    return false
  }, [dividerAfterTaskIdSet, task.id, open, kids, childrenOf])
  // Ref: CR-086 — 設定預設種類顏色對映，修改種類時側欄即時切換顏色
  const kind = types.find(t => t.key === task.type)
  const kindName = kind?.name ?? task.type
  const kindColor = kind?.color ?? DEFAULT_TYPE_COLORS[task.type] ?? '#94a3b8'
  const isRoot = depth === 0
  const active = task.id === selectedTaskId || (isRoot && selectedEpicId === task.id)

  const { unreadTaskIds, markTaskRead } = useUnreadNotifications()
  const hasUnread = unreadTaskIds.has(task.id)

  /*
   * 收著的時候標整支子樹的量，展開之後只標「這一列自己」的 ——
   * 底下每一列都各自標著自己的數字了，上面再留一個總數，
   * 同一個畫面就有兩層數字在互相解釋。
   *
   * 錯誤**不含自己**：一張錯誤本來就長得像錯誤（種類徽章、縮排位置都看得到），
   * 旁邊再標一個「錯 1」只會讓人以為它底下還有東西。
   * 逾期含自己 —— 那是狀態不是身分，不標就看不出來。
   */
  const bugs = open ? 0 : bugsUnder(task.id)
  const overdue = open
    ? (task.inquiryState === 'OVERDUE' ? 1 : 0)
    : overdueIn(task.id)
  const asked = open
    ? (task.inquiryState === 'AWAITING' || task.inquiryState === 'PARTIAL' ? 1 : 0)
    : inquiriesIn(task.id)

  /*
   * 「＋」要建的種類 —— 合不合法一律問 `lib/hierarchy.ts`，不要在這裡自己再寫一套
   * （後端 `apps/api/src/lib/hierarchy.ts` 才是守門員，兩邊的判斷要對得起來，
   * 不然這顆按鈕按下去只會拿到 400）。
   *
   * 優先挑「任務」：掛在大項目底下就是任務，掛在任務底下就是子任務，
   * 兩種都是這顆按鈕最常見的用途。任務不合法時退而求其次挑第一個合法的種類；
   * 一種都不合法就整顆不畫 —— 畫一顆按下去必定被拒絕的按鈕比沒有更糟。
   */
  const addType = useMemo(() => {
    const allowed = typesAllowedUnder(types, task.type)
    const pick = allowed.find(t => t.key === 'TASK') ?? allowed[0]
    if (pick) return pick.key
    // 種類清單還沒載進來（types 是選填的）：直接問規則本身，別讓按鈕整個消失
    return types.length === 0 && canBeUnder('TASK', task.type) ? 'TASK' : null
  }, [types, task.type])

  const createChild = useMutation({
    mutationFn: (t: string) =>
      Api.createTask(projectId!, { title: t, type: addType!, parentId: task.id }),
    onSuccess: () => {
      setChildTitle(''); setAddingChild(false)
      expand(task.id)
      qc.invalidateQueries({ queryKey: ['tasks', projectId!] })
    },
  })

  function cancelAdd() { setAddingChild(false); setChildTitle('') }

  const isRelated = relatedTaskIds ? relatedTaskIds.has(task.id) : true

  return (
    <div className={isRoot ? 'mb-0.5' : undefined}>
      <div className={cx(
        'group/row flex items-center rounded-md transition-all duration-150',
        active
          ? 'bg-blue-100/90 dark:bg-blue-900/70 ring-1 ring-blue-500/50 opacity-100 font-semibold shadow-xs'
          : isRelated
            ? (relatedTaskIds ? 'bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-400/40 opacity-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800')
            : 'opacity-30 hover:opacity-75',
        hasUnread && 'pmflow-flash'
      )}>

        {/* 沒有子項的列一樣佔一格箭頭的寬度，不然同一層的文字會左右參差 */}
        <button
          onClick={e => { e.stopPropagation(); toggle(task.id) }}
          disabled={!kids.length}
          aria-label={open ? T.nav.sidebar.collapseEpic : T.nav.sidebar.expandEpic}
          aria-expanded={open}
          style={{ marginLeft: depth * 12 }}
          className={cx('w-6 shrink-0 text-xs', isRoot ? 'py-2.5' : 'py-1.5',
            kids.length
              ? 'text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              : 'text-transparent')}>
          {open ? '▾' : '▸'}
        </button>

        <button
          onClick={() => {
            if (hasUnread) markTaskRead(task.id)
            if (isRoot) onSelectEpic(task.id)
            onOpenTask(task.id)
          }}
          title={isRoot && stat?.hasChildren
            ? `[${task.ref}] ${task.title} (${stat.done}/${stat.total})`
            : `[${task.ref}] ${task.title}`}
          aria-current={!isRoot && active ? 'true' : undefined}
          className={cx('block min-w-0 flex-1 rounded-md pr-2.5 text-left',
                        isRoot ? 'py-2' : 'py-1.5')}>
          <div className="flex flex-col gap-1 min-w-0">
            {/* 第一行：卡片/收納盒圖示 + 色槓 + MRG編號 + 警示徽章 + 完成打勾(進度100%) */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cx('shrink-0 rounded-full', isRoot ? 'h-4 w-1' : 'h-3 w-0.5')}
                    title={kindName}
                    style={{ background: kindColor }} />
              <span className="shrink-0 text-xs select-none">
                {task.type !== 'BUG' && (kids.length > 0 || (typeof window !== 'undefined' && (() => {
                  try {
                    const saved = localStorage.getItem('pmflow_graph_container_boxes')
                    return saved ? new Set(JSON.parse(saved)).has(task.id) : false
                  } catch { return false }
                })())) ? '📦' : '📄'}
              </span>
              <span className="shrink-0 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                {task.ref || (task.number ? `MRG-${task.number}` : '')}
              </span>

              {/* 警示徽章區域 */}
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {((task.type !== 'BUG' && task.problem ? 1 : 0) + bugs) === 0 && blockedByMap?.get(task.id) && blockedByMap.get(task.id)!.length > 0 && (
                  <span title={`卡住：要等 ${blockedByMap.get(task.id)!.join('、')}`}
                        className="shrink-0 rounded bg-red-50 px-1 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300">
                    ⛔卡住
                  </span>
                )}
                {((task.type !== 'BUG' && task.problem ? 1 : 0) + bugs) > 0 && (
                  <span title={task.problem || T.nav.sidebar.bugsUnder((task.type !== 'BUG' && task.problem ? 1 : 0) + bugs)}
                        className="shrink-0 rounded bg-red-100 px-1 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    {T.nav.sidebar.bugBadge((task.type !== 'BUG' && task.problem ? 1 : 0) + bugs)}
                  </span>
                )}
                {asked > 0 && (
                  <span title={T.nav.sidebar.askedUnder(asked)}
                        className="shrink-0 rounded bg-blue-100 px-1 text-[10px] font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    {T.nav.sidebar.askedBadge(asked)}
                  </span>
                )}
                {overdue > 0 && (
                  <span title={T.nav.sidebar.overdueUnder(overdue)}
                        className="shrink-0 rounded bg-red-100 px-1 text-[10px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    {T.nav.sidebar.overdueBadge(overdue)}
                  </span>
                )}
              </div>

              {/* 完成打勾：進度 100% 才能打勾 */}
              {task.type !== 'BUG' && (stat ? stat.progress >= 100 : task.progress >= 100) && (
                <span aria-hidden title={T.nav.sidebar.doneDot}
                      className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-auto">✓</span>
              )}
            </div>

            {/* 第二行：任務標題 */}
            <div className={cx('min-w-0 truncate text-xs leading-snug',
              isRoot ? 'text-sm font-medium' : 'text-[13px]',
              active
                ? 'font-semibold text-blue-900 dark:text-blue-100'
                : 'text-slate-700 dark:text-slate-300'
            )}>
              {task.title}
            </div>

            {/* 第三行：進度條 */}
            {task.type !== 'BUG' && stat && (
              <div className="flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <span className={cx('block h-full transition-all duration-300',
                          stat.progress >= 100 ? 'bg-emerald-500' : 'bg-red-500')}
                        style={{ width: `${stat.progress}%` }} />
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-400">
                  {stat.progress}%
                </span>
                {stat.hasChildren && (
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-400">
                    {stat.done}/{stat.total}
                  </span>
                )}
              </div>
            )}
          </div>
        </button>

        {/*
          * 滑鼠移到這一列才冒出來的「＋」。
          *
          * 一直畫出來的話整排右邊會變成一面按鈕牆，把標題與錯／外／逾三顆徽章擠掉。
          * 但**位子一直留著**（用 opacity 不用條件渲染）—— 進出滑鼠就重排一次的話，
          * 標題會跟著抽動，比按鈕牆更難看。
          *
          * `focus:opacity-100` 不能省：只認 hover 的話，用鍵盤 Tab 過來的人
          * 會停在一顆看不見的按鈕上，永遠不知道它在那裡。
          */}
        <button
          onClick={e => { e.stopPropagation(); (onOpenEditTask ?? onOpenTask)(task.id) }}
          title="編輯詳細內容"
          aria-label="編輯詳細內容"
          className={cx('w-5 h-5 shrink-0 rounded flex items-center justify-center text-[11px] transition-colors cursor-pointer border select-none',
            'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
            'dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900',
            'opacity-0 group-hover/row:opacity-100 focus:opacity-100')}>
          ✏️
        </button>
        {addType && projectId && !addingChild && (
          <button
            onClick={e => { e.stopPropagation(); expand(task.id); setAddingChild(true) }}
            title={T.nav.sidebar.addSubtaskUnder(task.title)}
            aria-label={T.nav.sidebar.addSubtaskUnder(task.title)}
            className={cx('w-6 shrink-0 rounded text-xs opacity-0 transition-opacity',
              'group-hover/row:opacity-100 focus:opacity-100',
              isRoot ? 'py-2.5' : 'py-1.5',
              'text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300')}>
            ＋
          </button>
        )}
      </div>

      {/* 就地展開的輸入框，縮排到子項那一層 —— 它建出來的東西會落在那裡 */}
      {addingChild && (
        <div className="my-1 space-y-1.5 rounded-md bg-slate-50 p-2 dark:bg-slate-800"
             style={{ marginLeft: (depth + 1) * 12 + 24 }}>
          <Input value={childTitle} onChange={e => setChildTitle(e.target.value)}
                 placeholder={T.nav.sidebar.subtaskNamePlaceholder} autoFocus
                 onKeyDown={e => {
                   if (e.key === 'Enter' && childTitle.trim()) createChild.mutate(childTitle.trim())
                   if (e.key === 'Escape') cancelAdd()
                 }} />
          <div className="flex gap-1">
            <Button variant="primary" className="flex-1 justify-center text-xs"
                    disabled={!childTitle.trim() || createChild.isPending}
                    onClick={() => createChild.mutate(childTitle.trim())}>
              {T.common.create}
            </Button>
            <Button className="text-xs" onClick={cancelAdd}>{T.common.cancel}</Button>
          </div>
        </div>
      )}

      {open && kids.map(kid => (
        <TreeNode
          key={kid.id}
          task={kid}
          depth={depth + 1}
          projectId={projectId}
          childrenOf={childrenOf}
          stat={statMap?.get(kid.id)}
          statMap={statMap}
          blockedByMap={blockedByMap}
          bugsUnder={bugsUnder}
          overdueIn={overdueIn}
          inquiriesIn={inquiriesIn}
          types={types}
          expanded={expanded}
          toggle={toggle}
          expand={expand}
          selectedEpicId={selectedEpicId}
          selectedTaskId={selectedTaskId}
          relatedTaskIds={relatedTaskIds}
          dividerAfterTaskIdSet={dividerAfterTaskIdSet}
          onSelectEpic={onSelectEpic}
          onOpenTask={onOpenTask}
          onOpenEditTask={onOpenEditTask}
        />
      ))}

      {/* 整個關聯群組的最後一個任務列後面加上分隔線 */}
      {dividerAfterTaskIdSet?.has(task.id) && (
        <div className="my-2 border-b border-slate-200 dark:border-slate-700/60" />
      )}
    </div>
  )
}
