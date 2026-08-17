import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api, ApiError, type LinkType, type ProjectParam, type ProblemHistoryItem, type Task, type TaskDetail, type TaskStatus } from '../lib/api'
import { LINK_LABEL, LINK_CHIP, SCHEDULING, SEMANTIC, linkSentence } from '../lib/linkText'
import { Button, Input, Select, Field, Spinner, ColorOption, readableColor, cx, ProblemBadge, TypeBadge } from './ui'
import { InquiryTable } from './InquiryTable'
import { useAuth } from '../lib/auth'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { useTheme } from '../lib/theme'
import { T } from '../strings'
import { typesAllowedFor } from '../lib/hierarchy'
import { DEFAULT_TYPE_COLORS } from './EpicSidebar'

/**
 * 任務詳情。
 *
 * variant='pane'（預設）：內嵌在右側主區，左邊選了哪張就顯示哪張——主從式版面。
 * variant='overlay'：舊的覆蓋式抽屜，保留給之後可能需要的浮動情境。
 */
/**
 * 抽屜外層容器（抽離至模組層級，避免父層重繪時重新宣告導致 DOM 樹銷毀與焦點遺失）
 */
function TaskDrawerShell({
  variant,
  shouldFlash,
  seen,
  onClose,
  children,
}: {
  variant: 'pane' | 'overlay'
  shouldFlash: boolean
  seen: Record<string, unknown>
  onClose: () => void
  children: React.ReactNode
}) {
  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20 dark:bg-slate-950/60"
           onClick={onClose}>
        {/* 覆蓋式抽屜是疊在卡片上的浮層，深色底要比卡片再亮一階才分得出層次 */}
        <div className={cx('flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl',
                           'dark:bg-slate-800', shouldFlash && 'pmflow-flash')}
             {...seen}
             onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className={cx('flex h-full min-h-0 flex-col bg-white dark:bg-slate-900',
                       shouldFlash && 'pmflow-flash')}
         {...seen}>
      {children}
    </div>
  )
}

export function TaskDrawer({
  taskId, workspaceId, statuses, allTasks, onClose, onSelectTask, variant = 'pane', flash = false, onSeen,
}: {
  taskId: string
  workspaceId: string
  statuses: TaskStatus[]
  allTasks: Task[]
  onClose: () => void
  onSelectTask?: (taskId: string) => void
  variant?: 'pane' | 'overlay'
  /**
   * 從通知點進來的就閃一下紅框，指出「就是這一張」——
   * 那一下畫面上換掉太多東西，眼睛不知道該看哪裡。
   * 動畫在 `index.css` 的 `.pmflow-flash`，閃三下之後**紅框留著不會自己消失**。
   */
  flash?: boolean
  /**
   * 他在這張任務上動了一下（點、按鍵）就通知上層把紅框收走 ——
   * 到那一刻才確定他真的看到了。不設時器自動收：人不見得正看著螢幕。
   */
  onSeen?: () => void
}) {
  const qc = useQueryClient()
  /*
   * 下拉選項要照他挑的顏色上色，深淺得看現在是淺色還是深色底 ——
   * readableColor 會把顏色推到讀得到的那一側（見 ui.tsx）。
   */
  const { resolved } = useTheme()
  const dark = resolved === 'dark'
  const { data, isLoading } = useQuery({ queryKey: ['task', taskId], queryFn: () => Api.task(taskId) })
  const [linkError, setLinkError] = useState<string | null>(null)

  /*
   * 我在這個專案是什麼角色。跟 App 那一層用同一組 queryKey 與同一支查詢，
   * 所以這裡讀到的是快取，不會多打一次 API。
   *
   * 後端的規則（apps/api/src/routes/tasks.ts）：
   *   改任務內容  → 要編輯者以上，而且還要是開這張任務的人；專案管理者一律放行
   *   建立／移除關聯 → 兩端都要編輯者，但跟「誰開的」無關（routes/links.ts）
   *   目前遇到的問題、登錄對外詢問的回覆 → 專案成員都可以，所以永遠留著
   */
  const { user } = useAuth()
  const { data: project } = useQuery({
    queryKey: ['project', data?.projectId ?? ''],
    queryFn: () => Api.project(data!.projectId),
    enabled: !!data?.projectId,
  })

  /**
   * 類型與優先度的中文是**這個專案自己定的**（見 0011_project_parameters.sql），
   * 不再是寫死的四種。查不到就退回原始值 —— 那代表清單被改過而任務還指著舊值，
   * 顯示代碼總比顯示空白好，至少看得出來是哪裡對不上。
   */
  const priorities = project?.priorities ?? []
  const priorityOf = (key: string) => priorities.find(p => p.key === key)?.name ?? key
  const types = project?.types ?? []
  const typeOf = (key: string) => types.find(t => t.key === key)?.name ?? ''
  /*
   * 我的角色要從成員名單裡撈自己那一列 —— GET /projects/:id 只回成員名單，
   * 沒有「我是什麼角色」這個欄位（回那個欄位的是專案清單 GET /projects）。
   */
  const role = project?.members.find(m => m.id === user?.id)?.role
  const isManager = role === 'MANAGER'
  const isTaskCreator = Boolean(data?.createdById && data.createdById === user?.id)
  const isProjectCreator = Boolean(project?.isCreator)
  const isAssignee = Boolean(data?.assigneeId && data.assigneeId === user?.id)
  /*
   * Ref: CR-130 — 權限一律以後端回的 canEdit / canDelete 為準。
   * 後端才知道代理人是誰、這張有沒有被完成鎖定；前端自己算一套一定對不起來。
   * 舊版後端沒有這兩個欄位時才退回角色＋關係人的近似判斷。
   * Ref: CR-086 — EDITOR 與 MANAGER 皆可編輯與保存。
   */
  const canEdit = data?.canEdit
    ?? ((isManager || role === 'EDITOR') && (isManager || isTaskCreator || isAssignee || isProjectCreator))
  const canEditLinks = canEdit
  const canDelete = data?.canDelete ?? (isManager || role === 'OWNER' || isTaskCreator || isProjectCreator)

  // Esc 關閉抽屜。在輸入框裡按 Esc 不關，免得打到一半誤觸把內容弄丟。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (variant !== 'overlay') return
      if (e.key !== 'Escape') return
      const el = document.activeElement
      const typing = el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
         el.isContentEditable)
      if (typing) { (el as HTMLElement).blur(); return }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, variant])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task', taskId] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['schedule'] })
    // 關聯圖是另一支查詢，節點上也掛著任務的標記（例如「有問題」），
    // 不一起失效的話，改完切過去看到的還是舊的那一張圖
    qc.invalidateQueries({ queryKey: ['graph'] })
  }
  const patch = useMutation({
    mutationFn: (v: Record<string, unknown>) => Api.patchTask(taskId, v), onSuccess: invalidate,
  })
  const addLink = useMutation({
    mutationFn: (v: { targetId: string; linkType: LinkType; lagDays: number }) => Api.addLink(taskId, v),
    onSuccess: () => { setLinkError(null); invalidate() },
    onError: (e: unknown) => setLinkError(
      e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : T.task.link.addFailed),
  })
  const delLink = useMutation({ mutationFn: (id: string) => Api.deleteLink(id), onSuccess: invalidate })

  const [saveError, setSaveError] = useState<string | null>(null)

  /** 按下保存才送出。只送動過的那幾格 */
  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => Api.patchTask(taskId, v),
    onSuccess: () => { setDraft({}); setSaveError(null); invalidate() },
    onError: (e: unknown) => {
      setSaveError(e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : '保存失敗')
    },
  })
  const remove = useMutation({
    mutationFn: () => Api.deleteTask(taskId),
    onSuccess: () => { invalidate(); onClose() },
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [solutionText, setSolutionText] = useState('')

  const resolveProblem = useMutation({
    mutationFn: (solution?: string) => Api.resolveProblem(taskId, { solution }),
    onSuccess: () => {
      setSolutionText('')
      setDraft(d => {
        const next = { ...d }
        delete next.problem
        return next
      })
      invalidate()
    },
  })

  const createProblemCard = useMutation({
    mutationFn: async (v: { title: string; content: string }) => {
      // 1. 確保目前卡片標記為收納盒
      try {
        const key = 'pmflow_graph_container_boxes'
        const saved = localStorage.getItem(key)
        const set = new Set<string>(saved ? JSON.parse(saved) : [])
        set.add(taskId)
        localStorage.setItem(key, JSON.stringify(Array.from(set)))
      } catch {}

      // 2. 找到專案中對應的「問題」類型 key（優先尋找 BUG 或名稱包含問題的種類）
      const bugTypeKey = types.find(t => t.key === 'BUG' || t.name.includes('問題'))?.key ?? 'BUG'

      // 3. 建立問題子卡片 (類型設為問題單，並指定 parentId 收納於當前卡片)
      const createdTask = await Api.createTask(data!.projectId, {
        title: v.title,
        description: v.content || null,
        type: bugTypeKey,
        parentId: taskId,
      })

      // 4. 自動建立與原任務單的關聯線 (Link)
      if (createdTask?.id) {
        try {
          await Api.addLink(taskId, {
            targetId: createdTask.id,
            linkType: 'FS',
            lagDays: 0,
          })
        } catch (e) {
          console.error('Failed to link problem task to parent task:', e)
        }
      }

      // 5. 記錄問題至父卡片
      await Api.patchTask(taskId, { problem: v.title })
    },
    onSuccess: () => {
      invalidate()
    },
  })

  /*
   * 轉派走專屬的端點，不走 patch —— 換人是欄位，交接說明是話，
   * 兩者要一起寫進同一筆活動紀錄（理由見 api 的 routes/tasks.ts）。
   *
   * reassignTo：正在轉派給誰。null＝沒有在轉派；''＝要收回、不指派給任何人。
   * 選了人先停在這裡，按下「確認轉派」才真的送出 —— 中間那一步就是留給
   * 交接說明的，改完馬上送出的話那句話永遠沒有地方寫。
   */
  const [reassignTo, setReassignTo] = useState<string | null>(null)
  const [handoverNote, setHandoverNote] = useState('')
  const closeReassign = () => { setReassignTo(null); setHandoverNote('') }
  const reassign = useMutation({
    mutationFn: (v: { assigneeId: string | null; note?: string }) => Api.reassignTask(taskId, v),
    onSuccess: () => { closeReassign(); invalidate() },
  })

  const members = project?.members ?? []
  /* 現任負責人被移出專案之後，成員名單裡就沒有他了。不補一項回去的話，
     下拉會顯示成名單上的第一個人，看起來像被誰偷偷換掉 */
  const assigneeOptions = data?.assigneeId && !members.some(m => m.id === data.assigneeId)
    ? [...members,
       { id: data.assigneeId, role: '',
         displayName: T.task.reassign.optionFormerMember(data.assigneeName ?? '') }]
    : members
  const nameOf = (id: string) => members.find(m => m.id === id)?.displayName ?? ''

  const allAvailableTypes = useMemo(() => {
    const list = types.length ? [...types] : [
      { id: 'def-task', key: 'TASK', name: '任務單', color: '#3178c6', kind: 'type' as const, rank: 1, inUse: 0 },
    ]
    if (!list.some(t => t.key === 'BUG')) {
      list.push({ id: 'def-bug', key: 'BUG', name: '問題單', color: '#dc2626', kind: 'type' as const, rank: 999999, inUse: 0 })
    }
    return list
  }, [types])

  /*
   * 種類的下拉要濾掉放不進去的選項。上層與子任務都從 allTasks 找 ——
   * `data.children` 只有 id／標題／狀態，沒有種類。
   */
  const typeChoices = typesAllowedFor(allAvailableTypes, {
    current: data?.type ?? '',
    parentType: allTasks.find(t => t.id === data?.parentId)?.type ?? null,
    childTypes: allTasks.filter(t => t.parentId === data?.id).map(t => t.type),
  })

  /**
   * 還有幾件對外詢問沒回。已回覆的不算 —— 那件事已經完成了。
   * 這個數字決定「做完了」那幾個狀態畫不畫得出來（見 AGENTS.md）。
   */
  const openInquiries = (data?.inquiries ?? []).filter(q => !q.isReplied).length

  /** 標題列上那幾顆：還在等的、已經逾期的、還是全部都回來了 */
  const inquiryCounts = (() => {
    const all = data?.inquiries ?? []
    const overdue = all.filter(q => !q.isReplied && q.status === 'OVERDUE').length
    const waiting = all.filter(q => !q.isReplied && q.status !== 'OVERDUE').length
    return { waiting, overdue, allReplied: all.length > 0 && waiting + overdue === 0 }
  })()

  /*
   * ── 草稿 ──
   *
   * 欄位改了先留在這裡，按「保存」才送出。原本是改一格存一次 ——
   * 改三個欄位就是三筆活動紀錄、三次重畫，而且中途反悔沒有辦法收回。
   *
   * 存的是「動過的那幾格」而不是整份任務：只送真的改過的欄位，
   * 後端的活動紀錄才不會每次都寫上一整排沒變的值。
   *
   * 「目前遇到的問題」不走這裡，維持改完就存 —— 那一欄的權限跟其他欄位不同
   * （誰遇到誰寫，不必是開任務的人），混進同一顆保存鈕的話，
   * 沒有編輯權的人就沒有東西可以按。
   */
  type Draft = Partial<Pick<TaskDetail,
    'title' | 'description' | 'problem' | 'type' | 'statusKey' | 'priority' | 'progress'
    | 'startDate' | 'dueDate' | 'scheduleMode'>>
  const [draft, setDraft] = useState<Draft>({})
  const edit = (v: Draft) => setDraft(d => ({ ...d, ...v }))
  /** 畫面上顯示的值：伺服器的資料疊上還沒保存的修改 */
  const form = { ...(data as TaskDetail | undefined), ...draft } as TaskDetail
  const dirty = !!data && (Object.keys(draft) as Array<keyof Draft>)
    .some(k => draft[k] !== data[k])

  const isContainerBox = useMemo(() => {
    if (!data) return false
    if (data.children && data.children.length > 0) return true
    if (data.type === 'EPIC') return true
    try {
      const saved = localStorage.getItem('pmflow_graph_container_boxes')
      if (saved) return new Set<string>(JSON.parse(saved)).has(data.id)
    } catch {}
    return false
  }, [data])

  const nonBugChildren = useMemo(() => {
    return data?.children?.filter(c => c.type !== 'BUG') ?? []
  }, [data?.children])

  const isBlocked = useMemo(() => {
    if (!data?.links) return false
    const incomingDeps = data.links.filter(
      l => l.direction === 'incoming' && (l.linkType === 'FS' || l.linkType === 'BLOCKS' || l.linkType === 'REQUIRES')
    )
    if (incomingDeps.length === 0) return false
    const taskMap = new Map((allTasks ?? []).map(t => [t.id, t]))
    return incomingDeps.some(l => {
      const src = taskMap.get(l.otherId)
      if (!src) return true
      return (src.progress ?? 0) < 100
    })
  }, [data?.links, allTasks])

  const displayProgress = useMemo(() => {
    if (nonBugChildren.length > 0) {
      const sum = nonBugChildren.reduce((acc, c) => acc + (c.progress ?? 0), 0)
      return Math.round(sum / nonBugChildren.length)
    }
    return form.progress
  }, [nonBugChildren, form.progress])

  const isDoneStatus = statuses.some(s => s.key === data?.statusKey && s.category === 'DONE')
  const isTaskLocked = isDoneStatus && !isManager

  /**
   * 選了「做完了」那一類、但還有對外詢問沒回，或者已完成任務被鎖定 —— 保存鈕要變灰。
   */
  const saveBlocked = isTaskLocked || (openInquiries > 0
    && statuses.some(s => s.key === form?.statusKey && s.category === 'DONE'))

  const [targetId, setTargetId] = useState('')
  const [linkType, setLinkType] = useState<LinkType>('FS')
  const [lag, setLag] = useState(0)

  /*
   * 大項目（EPIC）與一般任務統一為事件層級，皆可建立排程與語意關聯。
   */
  const schedulingAllowed = true

  const { unreadTaskIds, markTaskRead } = useUnreadNotifications()
  const hasUnread = unreadTaskIds.has(taskId)
  const shouldFlash = flash || hasUnread

  const handleSeen = () => {
    if (hasUnread) markTaskRead(taskId)
    if (flash && onSeen) onSeen()
  }

  /*
   * 紅框在他動一下之後收走。用 capture 掛在最外層：底下的控制項各自
   * 有自己的 handler，不 capture 的話點在按鈕上就傳不上來。
   * 沒在閃的時候不掛，省得每一次點擊都跑一趟沒有作用的 setState。
   */
  const seen = shouldFlash
    ? { onPointerDownCapture: handleSeen, onKeyDownCapture: handleSeen }
    : {}

  return (
    <TaskDrawerShell
      variant={variant}
      shouldFlash={Boolean(shouldFlash)}
      seen={seen}
      onClose={onClose}
    >
      {isLoading || !data ? <Spinner /> : (
          <>
            <header className="flex items-start justify-between border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4
                               dark:border-slate-700">
              {/* flex-1 不能省：沒有它這一格只有內容寬，
                  標題就只用得到畫面的一小段，長標題會被擠成很窄的一直條 */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500
                                   dark:bg-slate-800 dark:text-slate-400">
                    {data.ref}
                  </span>
                  {/* 顏色是那一種種類自己的（系統參數頁裡挑的） */}
                  {typeOf(data.type) && (
                    <TypeBadge
                      name={typeOf(data.type)}
                      color={types.find(t => t.key === data.type)?.color ?? '#94a3b8'}
                    />
                  )}

                  {/*
                    * 對外詢問的狀況接在種類後面。原本這裡是一顆只講狀態的徽章
                    * （待回覆／逾期未回），但一張任務可以同時問好幾個單位 ——
                    * 沒有數字就看不出來是還剩一件還是剩五件。
                    * 寫法跟側欄一致（「外 1」「逾 1」），兩邊要對得起來。
                    */}
                  {inquiryCounts.waiting > 0 && (
                    <span title={T.task.drawer.inquiryWaitingTip(inquiryCounts.waiting)}
                          className="rounded bg-blue-100 px-1 text-[11px] font-medium text-blue-700
                                     dark:bg-blue-500/15 dark:text-blue-300">
                      {T.task.drawer.inquiryWaiting(inquiryCounts.waiting)}
                    </span>
                  )}
                  {inquiryCounts.overdue > 0 && (
                    <span title={T.task.drawer.inquiryOverdueTip(inquiryCounts.overdue)}
                          className="rounded bg-red-100 px-1 text-[11px] font-medium text-red-700
                                     dark:bg-red-500/15 dark:text-red-300">
                      {T.task.drawer.inquiryOverdue(inquiryCounts.overdue)}
                    </span>
                  )}
                  {inquiryCounts.allReplied && (
                    <span className="rounded bg-emerald-100 px-1.5 text-[11px] font-medium
                                     text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {T.task.drawer.inquiryAllReplied}
                    </span>
                  )}
                </div>
                {canEdit ? (
                  <TitleBox
                    value={form.title}
                    onCommit={v => v !== form.title && edit({ title: v })}
                  />
                ) : (
                  /* 改不動就不要畫成輸入框 —— 看起來能打字卻存不進去最難懂 */
                  <h2 className="mt-1.5 text-xl font-semibold text-slate-800 dark:text-slate-100">
                    {data.title}
                  </h2>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/*
                  * 保存與刪除放在標題列右邊，不放在整頁最下面 ——
                  * 這一頁很長（欄位、問題、對外詢問、關聯、活動紀錄），
                  * 按鈕擺在底下的話，改完上面那排欄位還要先捲到最後才存得了。
                  */}
                {canEdit && (
                  <Button
                    variant="primary"
                    disabled={!dirty || save.isPending || saveBlocked}
                    title={saveBlocked
                      ? T.task.drawer.saveBlockedByInquiry(openInquiries)
                      : (!dirty ? T.task.drawer.nothingToSave : undefined)}
                    onClick={() => save.mutate(draft as Record<string, unknown>)}>
                    {save.isPending ? T.task.drawer.saving : T.task.drawer.save}
                  </Button>
                )}
                {canEdit && dirty && (
                  <Button onClick={() => setDraft({})}>{T.task.drawer.discard}</Button>
                )}

                {/* 刪除兩段式：按一次問一句，再按一次才真的刪。
                    只有建立者、專案建立者或管理者以上有權限刪除 */}
                {canDelete && (confirmDelete ? (
                  <>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {(data.children?.length ?? 0) > 0
                        ? T.task.drawer.deleteHasChildren(data.children.length)
                        : T.task.drawer.deleteConfirm}
                    </span>
                    <Button variant="danger" disabled={remove.isPending}
                            onClick={() => remove.mutate()}>
                      {T.task.drawer.deleteYes}
                    </Button>
                    <Button onClick={() => setConfirmDelete(false)}>{T.common.cancel}</Button>
                  </>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    {T.task.drawer.delete}
                  </Button>
                ))}

                <Button variant="ghost" onClick={onClose} className="text-lg leading-none">✕</Button>
              </div>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
              {/* 欄位都變成純文字之後，總要有一個地方講原因 */}
              {!canEdit && role && (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-inset
                                ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300
                                dark:ring-amber-400/30">
                  <p className="font-medium">{T.task.permission.readOnlyTitle}</p>
                  <p className="mt-0.5">{T.task.permission.readOnlyWhy}</p>
                </div>
              )}

              {/*
                * ── 基本欄位 ──
                *
                * 排法有三件事是刻意的：
                * 1. **開始日與結束日一定要落在同一列**。七個欄位塞進四欄的話它們會
                *    被切到兩列去，而那兩個是一起看的 —— 所以放在同一格裡並排。
                * 2. **進度排在日期前面**。回報進度的時候先看的是「做到哪了」，
                *    不是「哪天開始的」。
                * 3. 進度給拖拉條 + 數字兩種輸入。拖拉條快，鍵盤打字準，
                *    只給其中一種一定有人不順手。
                *
                * 格線是**六欄**不是四欄。四欄的話進度與日期各佔兩欄就把第二列填滿，
                * 排程模式被擠到第三列自己一個人站著 —— 那一列看起來像是後來
                * 補上去的東西，而它只是眾多欄位裡的一個。
                */}
              {/*
                * 「做完了」那幾個狀態還在清單上，只是選不動（`disabled`）——
                * 整個抽掉的話，看的人不知道那些狀態跑哪去了，
                * 灰掉才看得出來「有這個選項，但現在不行」。
                *
                * 說明放在整排欄位**上面一整行**，不放在狀態那一格底下：
                * 那一格只有六分之一寬，一句話會被擠成三、四行，
                * 把整排欄位撐開。
                */}
              {saveError && (
                <p className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs leading-relaxed
                              text-rose-700 ring-1 ring-inset ring-rose-600/20
                              dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30">
                  {saveError}
                </p>
              )}

              {canEdit && openInquiries > 0 && (
                <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed
                              text-amber-700 ring-1 ring-inset ring-amber-600/20
                              dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30">
                  {T.task.drawer.statusBlockedByInquiry(openInquiries)}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Field label={T.task.drawer.fieldTaskType}>
                  {canEdit ? (
                    /*
                     * 能改成哪幾種，要同時看**上層是誰**與**底下掛了什麼**：
                     * 大項目不能放在任務底下；底下還掛著問題的話，自己就不能
                     * 從任務變成別的（問題的上層一定要是任務）。
                     * 判斷在 lib/hierarchy.ts，後端有同一份守門員。
                     */
                    <Select value={form.type}
                            onChange={e => edit({ type: e.target.value as TaskDetail['type'] })}
                            style={{ color: typeChoices.find(t => t.key === form.type)?.color || DEFAULT_TYPE_COLORS[form.type] || '#3178c6' }}
                            className="w-full font-semibold">
                      {typeChoices.map(t => (
                        <ColorOption key={t.key} value={t.key} color={t.color || DEFAULT_TYPE_COLORS[t.key] || '#3178c6'} dark={dark}>
                          ● {t.name}
                        </ColorOption>
                      ))}
                    </Select>
                  ) : (
                    <ReadOnlyValue>{typeOf(form.type) || form.type}</ReadOnlyValue>
                  )}
                </Field>
                <Field label={T.task.drawer.fieldStatus}>
                  {canEdit ? (
                    /*
                     * 還有對外詢問沒回的時候，「算是做完了」那幾個狀態不畫出來
                     * （規矩見 AGENTS.md；後端也擋，這裡只是不要畫出按了會被拒絕的選項）。
                     * 目前這一個永遠留著 —— 既有資料可能本來就違反，
                     * 拿掉的話下拉會顯示成別的狀態，然後一存檔就靜悄悄改掉它。
                     */
                    <Select value={form.statusKey}
                            onChange={e => edit({ statusKey: e.target.value })}
                            className="w-full">
                      {statuses.map(s => (
                        <ColorOption key={s.key} value={s.key} color={s.color} dark={dark}
                                     disabled={openInquiries > 0 && s.category === 'DONE'
                                               && s.key !== data.statusKey}>
                          {s.name}
                        </ColorOption>
                      ))}
                    </Select>
                  ) : (
                    <ReadOnlyValue>
                      {statuses.find(s => s.key === form.statusKey)?.name ?? T.common.none}
                    </ReadOnlyValue>
                  )}
                </Field>
                <div className="sm:col-span-2">
                <Field label={T.task.drawer.fieldAssignee}>
                  {canEdit ? (
                    /* 選了人不會馬上送出：下面會跳出交接說明，按了才算數 */
                    <Select value={reassignTo ?? (data.assigneeId ?? '')}
                            onChange={e => {
                              const v = e.target.value
                              setHandoverNote('')
                              setReassignTo(v === (data.assigneeId ?? '') ? null : v)
                            }}
                            className="w-full">
                      <option value="">{T.task.reassign.optionUnassigned}</option>
                      {assigneeOptions.map(m => (
                        <option key={m.id} value={m.id}>{m.displayName}</option>
                      ))}
                    </Select>
                  ) : (
                    <ReadOnlyValue>{data.assigneeName ?? T.common.unassigned}</ReadOnlyValue>
                  )}
                </Field>
                </div>
                <Field label={T.task.drawer.fieldPriority}>
                  {canEdit ? (
                    <Select value={form.priority}
                            onChange={e => edit({ priority: e.target.value as TaskDetail['priority'] })}
                            className="w-full">
                      {priorities.map(p => (
                        <ColorOption key={p.key} value={p.key} color={p.color} dark={dark}>
                          {p.name}
                        </ColorOption>
                      ))}
                    </Select>
                  ) : (
                    <ReadOnlyValue>{priorityOf(form.priority)}</ReadOnlyValue>
                  )}
                </Field>
                <Field label={T.task.drawer.fieldScheduleMode}>
                  {canEdit ? (
                    <Select value={form.scheduleMode}
                            onChange={e => edit({ scheduleMode: e.target.value as TaskDetail['scheduleMode'] })}
                            className="w-full">
                      <option value="AUTO">{T.task.drawer.scheduleAuto}</option>
                      <option value="MANUAL">{T.task.drawer.scheduleManual}</option>
                    </Select>
                  ) : (
                    <ReadOnlyValue>
                      {form.scheduleMode === 'AUTO'
                        ? T.task.drawer.scheduleAuto
                        : T.task.drawer.scheduleManual}
                    </ReadOnlyValue>
                  )}
                </Field>
                {/* 進度佔兩欄：拖拉條再窄就拖不準了（問題單不需要進度條） */}
                {form.type !== 'BUG' && data.type !== 'BUG' && (
                  <div className="sm:col-span-2">
                    <Field label={T.task.drawer.fieldProgress}>
                      {canEdit && nonBugChildren.length === 0 ? (
                        <>
                          <ProgressField value={displayProgress}
                                         isBlocked={isBlocked}
                                         onCommit={v => edit({ progress: v })} />
                          {isBlocked && (
                            <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <span>⛔</span>
                              <span>受上游任務依賴阻塞（卡住中），進度最高限制為 99%，無法設為 100%。</span>
                            </p>
                          )}
                        </>
                      ) : (
                        <ReadOnlyValue>
                          {T.task.drawer.progressValue(displayProgress)}
                          {nonBugChildren.length > 0 ? (
                            <span className="ml-1.5 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                              (目前由子任務進度總和為主)
                            </span>
                          ) : isBlocked ? (
                            <span className="ml-1.5 text-[11px] font-normal text-rose-600 dark:text-rose-400">
                              (受上游阻塞中，最高 99%)
                            </span>
                          ) : null}
                        </ReadOnlyValue>
                      )}
                    </Field>
                  </div>
                )}
                {/* 開始與結束擺在同一格，中間一個破折號 —— 它們是一段期間，不是兩個欄位 */}
                <div className="sm:col-span-4">
                  <Field label={`${T.task.drawer.fieldStart} – ${T.task.drawer.fieldDue}`}>
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Input type="date" className="min-w-0 flex-1"
                               value={form.startDate?.slice(0, 10) ?? ''}
                               aria-label={T.task.drawer.fieldStart}
                               onChange={e => edit({ startDate: e.target.value || null })} />
                        <span aria-hidden className="text-slate-400 dark:text-slate-400">–</span>
                        <Input type="date" className="min-w-0 flex-1"
                               value={form.dueDate?.slice(0, 10) ?? ''}
                               aria-label={T.task.drawer.fieldDue}
                               onChange={e => edit({ dueDate: e.target.value || null })} />
                      </div>
                    ) : (
                      <ReadOnlyValue>
                        {fmtDate(form.startDate)} – {fmtDate(form.dueDate)}
                      </ReadOnlyValue>
                    )}
                  </Field>
                </div>
              </div>

              {/* ── 轉派的交接說明 ──
                  刻意放在基本欄位「下面」而不是塞進那一格：那一格只有四分之一寬，
                  一句交接說明打不了幾個字就看不到開頭 */}
              {canEdit && reassignTo !== null && (
                <div className="rounded-md bg-blue-50 px-3 py-2.5 ring-1 ring-inset ring-blue-600/20
                                dark:bg-blue-500/15 dark:ring-blue-400/30">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {reassignTo
                      ? (data.assigneeName
                          ? T.task.reassign.confirmChange(data.assigneeName, nameOf(reassignTo))
                          : T.task.reassign.confirmAssign(nameOf(reassignTo)))
                      : (data.assigneeName
                          ? T.task.reassign.confirmClear(data.assigneeName)
                          : T.task.reassign.confirmClearNobody)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      autoFocus
                      value={handoverNote}
                      onChange={e => setHandoverNote(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !reassign.isPending) {
                          reassign.mutate({ assigneeId: reassignTo || null, note: handoverNote })
                        }
                        if (e.key === 'Escape') closeReassign()
                      }}
                      placeholder={T.task.reassign.notePlaceholder}
                      className="min-w-56 flex-1"
                    />
                    <Button variant="primary" disabled={reassign.isPending}
                            onClick={() => reassign.mutate({
                              assigneeId: reassignTo || null, note: handoverNote,
                            })}>
                      {T.task.reassign.submit}
                    </Button>
                    <Button variant="ghost" onClick={closeReassign}>{T.common.cancel}</Button>
                  </div>
                  <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-200">
                    {T.task.reassign.noteHint}
                  </p>
                </div>
              )}

              {/* ── 內容區塊：任務單顯示「任務內容」；問題單顯示「問題內容」與「解決內容」 ── */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-4">
                {/* 任務內容 / 問題內容 */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{form.type === 'BUG' ? '⚠️' : '📝'}</span>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {form.type === 'BUG' ? '問題內容' : '任務內容'}
                      </h3>
                    </div>
                  </div>
                  {canEdit ? (
                    <textarea
                      value={form.description ?? ''}
                      onChange={e => edit({ description: e.target.value || null })}
                      rows={3}
                      placeholder={form.type === 'BUG' ? '描述遭遇問題的詳細狀況、影響範圍或排查線索…' : '填寫任務的詳細說明、需求背景或執行指引…'}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 px-3 py-2 text-sm
                                 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none
                                 focus:ring-2 focus:ring-blue-500/40 dark:text-slate-100"
                    />
                  ) : (
                    <div className="rounded-md border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {form.description?.trim() ? form.description : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">
                          {form.type === 'BUG' ? '（無問題內容）' : '（無任務內容）'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 問題單專屬：解決內容 */}
                {form.type === 'BUG' && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">💡</span>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          解決內容
                        </h3>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          （填寫即視為 100% 完成解決）
                        </span>
                      </div>
                    </div>
                    {canEdit ? (
                      <textarea
                        value={form.problem ?? ''}
                        onChange={e => {
                          const val = e.target.value
                          const hasContent = val.trim().length > 0
                          edit({
                            problem: val || null,
                            progress: hasContent ? 100 : 0,
                          })
                        }}
                        rows={3}
                        placeholder="填寫問題的解決方式、排解步驟或因應措施（填寫即視為100%解決）…"
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 px-3 py-2 text-sm
                                   placeholder:text-slate-400 focus:border-blue-500 focus:outline-none
                                   focus:ring-2 focus:ring-blue-500/40 dark:text-slate-100"
                      />
                    ) : (
                      <div className="rounded-md border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {form.problem?.trim() ? form.problem : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs">（尚未填寫解決內容）</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── 遭遇問題與解決歷程（問題事件本身不顯示問題區） ── */}
              {form.type !== 'BUG' && data.type !== 'BUG' && (
                <ProblemSection
                  taskId={taskId}
                  projectId={data.projectId}
                  problemValue={form.problem ?? ''}
                  solutionValue={solutionText}
                  childProblems={data.children?.filter(c => c.type === 'BUG' || c.problem)}
                  onChangeProblem={val => edit({ problem: val || null })}
                  onChangeSolution={val => setSolutionText(val)}
                  problemHistory={data.problemHistory}
                  onResolveProblem={solution => resolveProblem.mutate(solution)}
                  onClearProblem={() => edit({ problem: null })}
                  onSelectTask={onSelectTask}
                  isResolving={resolveProblem.isPending}
                  onCreateProblemCard={(title, content) => createProblemCard.mutate({ title, content })}
                  isCreatingCard={createProblemCard.isPending}
                />
              )}

              {/* ── 對外詢問：核心功能 ──
                  canEdit 一律給 true。登錄回覆後端只要求專案成員，是「誰收到誰登錄」，
                  絕不能因為任務不是自己開的就收起來；而這個元件目前用同一個
                  canEdit 同時管著新增與登錄回覆，收掉就會把回覆一起收掉。
                  要分開得改 InquiryTable，那個檔不在這次可以改的範圍。 */}
              <InquiryTable taskId={taskId} workspaceId={workspaceId}
                            inquiries={data.inquiries} canEdit />

              {/* ── 前後相依（僅一般任務單可建立，問題單不參與流程相依） ── */}
              {data.type !== 'BUG' && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {T.task.link.title}{' '}
                    <span className="font-normal text-slate-400 dark:text-slate-400">
                      {T.task.link.titleHint}
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {data.links.length === 0 && (
                      <p className="text-sm text-slate-400 dark:text-slate-400">{T.task.link.empty}</p>
                    )}
                    {[...data.links].sort((a, b) => {
                      const numA = parseInt(a.otherRef?.replace(/\D/g, '') || '0', 10)
                      const numB = parseInt(b.otherRef?.replace(/\D/g, '') || '0', 10)
                      return numA - numB
                    }).map(l => (
                      <div key={l.id + l.direction}
                           className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-sm
                                      dark:bg-slate-800">
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                          <span className="font-mono font-semibold text-slate-500 dark:text-slate-400 mr-2">{l.otherRef}</span>
                          <span>{l.otherTitle}</span>
                        </span>
                        {canEditLinks && (
                          <Button variant="ghost" className="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                                  onClick={() => delLink.mutate(l.id)}>✕</Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {!canEditLinks && role && (
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-400">
                      {T.task.permission.linkReadOnly}
                    </p>
                  )}

                  {canEditLinks && (
                  <div className="mt-3 flex items-end gap-2">
                    <div className="min-w-56 flex-1">
                      <Field label={T.task.link.fieldTarget}>
                        <Select value={targetId} onChange={e => setTargetId(e.target.value)}
                                className="w-full">
                          <option value="">{T.task.link.pickTask}</option>
                          {allTasks.filter(t => t.id !== taskId && t.type !== 'BUG').sort((a, b) => {
                            const numA = parseInt(a.ref?.replace(/\D/g, '') || '0', 10)
                            const numB = parseInt(b.ref?.replace(/\D/g, '') || '0', 10)
                            return numA - numB
                          }).map(t => (
                            <option key={t.id} value={t.id}>{t.ref} {t.title}</option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <Button variant="primary" disabled={!targetId || addLink.isPending}
                            onClick={() => addLink.mutate({ targetId, linkType: 'FS', lagDays: 0 })}>
                      {T.task.link.add}
                    </Button>
                  </div>
                  )}
                  {linkError && (
                    <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200
                                    dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30">
                      {linkError}
                    </div>
                  )}
                </div>
              )}

              {/* ── 上下階層（所屬父任務 / 子任務清單，排除問題單） ── */}
              {(allTasks.find(t => t.id === data.parentId) || data.children.filter(c => c.type !== 'BUG').length > 0) && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {T.task.children.title}{' '}
                    <span className="font-normal text-slate-400 dark:text-slate-400">
                      {T.task.children.titleHint}
                    </span>
                  </h3>

                  {/* 所屬父任務 */}
                  {allTasks.find(t => t.id === data.parentId) && (() => {
                    const p = allTasks.find(t => t.id === data.parentId)!
                    return (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                          <span>所屬父任務（收納盒）</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectTask?.(p.id)}
                          className="flex w-full items-center gap-2 rounded-md bg-blue-50/70 border border-blue-200/80 px-3 py-2 text-sm text-left transition-colors hover:bg-blue-100 dark:bg-slate-800 dark:border-blue-900/50 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer group"
                          title="點擊前往所屬父任務"
                        >
                          <span className="shrink-0 text-xs">📦</span>
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline">{p.ref}</span>
                          <span className="flex-1 truncate font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">{p.title}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-400">{p.progress}%</span>
                          <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        </button>
                      </div>
                    )
                  })()}

                  {/* 子任務清單 */}
                  {data.children.filter(c => c.type !== 'BUG').length > 0 && (
                    <div>
                      {allTasks.find(t => t.id === data.parentId) && (
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                          子任務清單
                        </div>
                      )}
                      <div className="space-y-1">
                        {data.children.filter(c => c.type !== 'BUG').sort((a, b) => {
                          const numA = parseInt(a.ref?.replace(/\D/g, '') || '0', 10)
                          const numB = parseInt(b.ref?.replace(/\D/g, '') || '0', 10)
                          return numA - numB
                        }).map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelectTask?.(c.id)}
                            className="flex w-full items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-left transition-colors hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer group"
                            title="點擊打開該子任務事件詳情頁"
                          >
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">{c.ref}</span>
                            <span className="flex-1 truncate font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">{c.title}</span>
                            {c.problem && <ProblemBadge problem={c.problem} />}
                            <span className="text-xs text-slate-400 dark:text-slate-400">{c.progress}%</span>
                            <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 活動時間軸 ── */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {T.task.drawer.activityTitle}
                </h3>
                <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {data.activities.slice(0, 15).map(a => (
                    <li key={a.id}>
                      <div className="flex gap-2">
                        <span className="text-slate-400 dark:text-slate-400">
                          {new Date(a.createdAt).toLocaleString('zh-TW')}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {a.actorName ?? T.task.drawer.systemActor}
                        </span>
                        <span>{describeActivity(a.kind, a.body, { statuses, priorities, types })}</span>
                      </div>
                      {/* 交接說明另起一行帶引號 —— 那是一句人講的話，
                          接在「把負責人從誰換成誰」後面會跟事實糊在一起 */}
                      {handoverNoteOf(a.body) && (
                        <p className="mt-0.5 pl-1 text-slate-600 dark:text-slate-300">
                          {T.task.activity.handoverNote(handoverNoteOf(a.body))}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
    </TaskDrawerShell>
  )
}

/**
 * 沒有修改權限時，欄位只留值本身。
 * 高度刻意跟輸入框對齊，換一個人看同一張任務時版面不會整個跳掉。
 */
function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 py-1.5 text-sm text-slate-800 dark:text-slate-100">{children}</div>
  )
}

const fmtDate = (d: string | null) =>
  (d ? d.slice(0, 10).replaceAll('-', '/') : T.common.none)

/**
 * 任務標題。**會自己長高，不是單行輸入框。**
 *
 * 原本是 `<input>`：一行放不下的標題不會換行，只是往旁邊捲出去 ——
 * 「外部系統自動建立的任務（API 權杖測試）」在畫面上被切成
 * 「外部系統自動建立的任務（API 檔」，而且看不出來後面還有字。
 * 標題是最不該被截斷的東西。
 *
 * 用 `<textarea>` 而不是加 `title=`：滑過去才看得到全文，等於要求他先發現
 * 有東西被藏起來。改成看得到全部，框自己長。
 * 按 Enter 不換行 —— 標題是一句話，換行只會把版面撐開又存不進意義。
 */
function TitleBox({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  /** 開始編輯時把游標放到最後面，而不是選起來 —— 多半是要接著打，不是整句重寫 */
  useEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    fit()
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  /** 高度跟著內容長。標題是最不該被截斷的東西，所以不捲、直接長高 */
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const base = 'mt-1.5 w-full text-xl font-semibold leading-snug text-slate-800 dark:text-slate-100'

  if (!editing) {
    /*
     * 平常就是一行字，點一下才變輸入框。
     *
     * 原本一進來就是輸入框（只是長得像文字）—— 那讓「看」跟「改」分不出來：
     * 想選字複製會不小心改到，而真的要改的人也看不出來這裡能改。
     * 用 button 不用 div：鍵盤 Tab 得到、Enter 也進得去。
     */
    return (
      <button type="button" onClick={() => setEditing(true)} title={T.task.drawer.editTitle}
              className={cx(base, 'block rounded text-left hover:bg-slate-100',
                            'dark:hover:bg-slate-800')}>
        {value}
      </button>
    )
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={value}
      onInput={fit}
      onKeyDown={e => {
        // Enter 存檔（標題是一句話，不需要換行）；Esc 放棄這次的修改
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        if (e.key === 'Escape') { e.currentTarget.value = value; e.currentTarget.blur() }
      }}
      onBlur={e => { setEditing(false); onCommit(e.target.value.trim()) }}
      className={cx(base, 'resize-none overflow-hidden rounded border-0 bg-transparent p-0',
                    'focus:outline-none focus:ring-0')}
    />
  )
}

/**
 * 進度：拖拉條 + 數字，兩種都能改。
 *
 * **拖的過程不送出**（`onChange` 只更新本地的數字，`onPointerUp`／`onKeyUp`
 * 才真的存）—— 一路拖過去每一格都打一次 PATCH 的話，一次拖曳會發出上百個請求，
 * 而且回來的順序不保證，畫面會跳。
 *
 * 外面的值變了（例如別的地方改了進度、或存檔失敗被打回）就跟著回正，
 * 但**正在拖的時候不要被蓋掉**，不然手還按著數字就自己跳回去。
 */
function ProgressField({ value, onCommit, isBlocked }: {
  value: number
  onCommit: (v: number) => void
  isBlocked?: boolean
}) {
  const maxAllowed = isBlocked ? 99 : 100
  // useId 產出的字串帶冒號，當 HTML id 用要先換掉
  const ticksId = `ticks-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [draft, setDraft] = useState(Math.min(maxAllowed, value))
  const dragging = useRef(false)
  useEffect(() => { if (!dragging.current) setDraft(Math.min(maxAllowed, value)) }, [value, maxAllowed])

  const commit = (v: number) => {
    dragging.current = false
    const clamped = Math.min(maxAllowed, Math.max(0, Math.round(v)))
    setDraft(clamped)
    if (clamped !== value) onCommit(clamped)
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={0} max={maxAllowed} step={isBlocked ? 1 : 10} list={isBlocked ? undefined : ticksId} value={draft}
        aria-label={T.task.drawer.progressAria}
        onPointerDown={() => { dragging.current = true }}
        onChange={e => setDraft(Math.min(maxAllowed, Number(e.target.value)))}
        onPointerUp={e => commit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={e => commit(Number((e.target as HTMLInputElement).value))}
        onBlur={() => commit(draft)}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full
                   bg-slate-200 accent-blue-600 dark:bg-slate-700 dark:accent-blue-500"
      />
      {/* 十格刻度。拖的時候會吸附到整十，也看得出來現在大概在第幾格 */}
      {!isBlocked && (
        <datalist id={ticksId}>
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}

      {/*
        * 數字也能直接打 —— 要 35% 的時候拖拉條對不準。
        * 寬度掛在外面這層 div，不是掛在 Input 上：`Input` 自己帶 `w-full`，
        * 跟 `w-16` 是同一個 specificity，誰贏要看 CSS 的順序 ——
        * 實際上是 `w-full` 贏，數字框會把拖拉條整條擠掉。
        */}
      <div className="flex w-20 shrink-0 items-center gap-1">
        <Input
          type="number" min={0} max={maxAllowed} value={draft}
          aria-label={T.task.drawer.fieldProgress}
          onChange={e => setDraft(Math.min(maxAllowed, Number(e.target.value)))}
          onBlur={e => commit(Number(e.target.value))}
          className="text-right tabular-nums"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">%</span>
      </div>
    </div>
  )
}

/** 這筆活動紀錄有沒有附交接說明（只有轉派會有）。沒有就回空字串 */
function handoverNoteOf(body: Record<string, unknown> | null): string {
  return body?.reassign && body.note ? String(body.note) : ''
}

function describeActivity(
  kind: string,
  body: Record<string, unknown> | null,
  meta?: {
    statuses?: Array<{ key: string; name: string }>
    priorities?: Array<{ key: string; name: string }>
    types?: Array<{ key: string; name: string }>
  }
): string {
  const nameOf = (key: unknown, list?: Array<{ key: string; name: string }>) => {
    if (!key) return '（無）'
    const kStr = String(key)
    return list?.find(x => x.key === kStr)?.name ?? kStr
  }

  switch (kind) {
    case 'CREATED': return T.task.activity.created
    case 'COMMENT': return T.task.activity.comment(String(body?.text ?? ''))
    case 'LINK_CHANGE': {
      const t = String(body?.linkType ?? '') as LinkType
      return T.task.activity.linkChange(LINK_CHIP[t] ?? t)
    }
    case 'INQUIRY_CHANGE':
      return body?.action === 'ask'
        ? T.task.activity.inquiryAsk(String(body?.unit ?? ''))
        : T.task.activity.inquiryReply(body?.repliedByUnit ? String(body.repliedByUnit) : '')
    default:
      if (body?.reassign) {
        const from = body.previousAssigneeName ? String(body.previousAssigneeName) : ''
        const to = body.assigneeName ? String(body.assigneeName) : ''
        if (to) return from ? T.task.activity.reassigned(from, to) : T.task.activity.assigned(to)
        return from ? T.task.activity.unassignedFrom(from) : T.task.activity.unassignedNobody
      }
      if (body) {
        const changes: string[] = []
        if ('title' in body) {
          const from = body.titleBefore ? `「${body.titleBefore}」` : '（無）'
          const to = body.title ? `「${body.title}」` : '（無）'
          changes.push(`將標題由 ${from} 改為 ${to}`)
        }
        if ('statusKey' in body) {
          const from = nameOf(body.statusKeyBefore, meta?.statuses)
          const to = nameOf(body.statusKey, meta?.statuses)
          changes.push(`將狀態由「${from}」改為「${to}」`)
        }
        if ('problem' in body) {
          const from = body.problemBefore ? String(body.problemBefore) : ''
          changes.push(body.problem ? `記下遭遇問題：「${body.problem}」` : `已解決遭遇問題（原：${from}）`)
        }
        if ('priority' in body) {
          const from = nameOf(body.priorityBefore, meta?.priorities)
          const to = nameOf(body.priority, meta?.priorities)
          changes.push(`將優先度由「${from}」改為「${to}」`)
        }
        if ('type' in body) {
          const from = nameOf(body.typeBefore, meta?.types)
          const to = nameOf(body.type, meta?.types)
          changes.push(`將種類由「${from}」改為「${to}」`)
        }
        if ('progress' in body) {
          changes.push(`將進度由 ${body.progressBefore ?? 0}% 改為 ${body.progress}%`)
        }
        if ('startDate' in body || 'dueDate' in body) {
          changes.push('調整了計畫日期')
        }
        if (changes.length > 0) return changes.join('；')
      }
      return T.task.activity.fieldUpdated
  }
}

/**
 * 遭遇問題與解決方案獨立區塊（支援開立問題卡片並自動收納至收納盒）
 */
function ProblemSection({
  taskId,
  projectId,
  problemValue,
  solutionValue,
  childProblems,
  onChangeProblem,
  onChangeSolution,
  problemHistory,
  onResolveProblem,
  onClearProblem,
  onSelectTask,
  isResolving,
  onCreateProblemCard,
  isCreatingCard,
}: {
  taskId: string
  projectId: string
  problemValue: string
  solutionValue: string
  childProblems?: Array<{ id: string; ref: string; title: string; statusKey: string; progress: number; type?: string; problem?: string | null }>
  onChangeProblem: (v: string) => void
  onChangeSolution: (v: string) => void
  problemHistory?: ProblemHistoryItem[]
  onResolveProblem: (solution: string) => void
  onClearProblem: () => void
  onSelectTask?: (id: string) => void
  isResolving: boolean
  onCreateProblemCard: (title: string, content: string) => void
  isCreatingCard: boolean
}) {
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const hasProblem = problemValue.trim().length > 0 || (childProblems && childProblems.length > 0)
  const resolvedList = (problemHistory ?? []).filter(h => h.resolvedAt)

  const handleCreate = () => {
    if (!newTitle.trim()) return
    onCreateProblemCard(newTitle.trim(), newContent.trim())
    setNewTitle('')
    setNewContent('')
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">⚠️</span>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {T.task.problem.label}
          </h3>
        </div>
      </div>

      {/* 現有收納中的問題卡片清單 */}
      {childProblems && childProblems.length > 0 && (
        <div className="mb-3 space-y-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
            <span>📦</span> 已收納之問題卡片 ({childProblems.length} 張)：
          </p>
          <div className="space-y-1 mt-1.5">
            {childProblems.map(p => (
              <div
                key={p.id}
                onClick={() => onSelectTask?.(p.id)}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{p.ref}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{p.title}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 shrink-0 font-medium">
                  問題單
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 填寫新問題並開立問題卡片收納 */}
      <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3.5 mb-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            問題標題 <span className="text-rose-500">*</span>
          </label>
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="請輸入問題標題（建立後此事件自動轉為收納盒，並將問題卡片收納其中）…"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            遭遇問題內容 / 描述
          </label>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={2}
            placeholder="描述遭遇問題的詳細狀況、影響範圍或排查線索…"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm
                       placeholder:text-slate-400 focus:border-blue-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500/40 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            disabled={!newTitle.trim() || isCreatingCard}
            onClick={handleCreate}
            className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 shadow-xs"
          >
            <span>📦</span> 開立問題卡片並收納
          </Button>
        </div>
      </div>

      {/* 歷史已解決問題 (折疊/收納清單) */}
      {resolvedList.length > 0 && (
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800/80 pt-3">
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>📜</span> 歷史已解決問題 ({resolvedList.length} 件)
            </span>
            <span>{showHistory ? '▲ 收合' : '▼ 展開'}</span>
          </button>

          {showHistory && (
            <div className="mt-2.5 space-y-2.5">
              {resolvedList.map(h => (
                <div key={h.id} className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      ❌ 問題：{h.problem}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {h.resolvedAt ? new Date(h.resolvedAt).toLocaleDateString('zh-TW') : ''}
                    </span>
                  </div>
                  {h.solution && (
                    <div className="mt-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded p-2 border border-emerald-200/50 dark:border-emerald-900/50">
                      💡 解決方案：{h.solution}
                    </div>
                  )}
                  {h.resolvedByName && (
                    <div className="mt-1 text-[10px] text-slate-400 text-right">
                      排解人：{h.resolvedByName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

