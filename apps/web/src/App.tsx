import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Api, type AppNotification, type Task, type WorkspaceRole } from './lib/api'
import { useAuth } from './lib/auth'
import { useRealtimeSync } from './lib/useRealtimeSync'
import { T } from './strings'
import { Button, Spinner, cx } from './components/ui'
import { useRemembered } from './lib/remember'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskDrawer } from './components/TaskDrawer'
import { EpicSidebar } from './components/EpicSidebar'
import { NotificationBell } from './components/NotificationBell'
import { UserMenu } from './components/UserMenu'
import { AiSkillModal } from './components/AiSkillModal'
import { DesktopRecommendedNotice } from './components/DesktopRecommendedNotice'
import Login from './pages/Login'
import Board from './pages/Board'
import ListView from './pages/List'
// dhtmlx-gantt 有 700KB+，只在真的切到甘特頁時才載入，
// 不要讓只想看看板的人也付這個代價
const GanttView = lazy(() => import('./pages/Gantt'))
// React Flow 同理，只有關聯圖用得到
const TaskGraphView = lazy(() => import('./pages/TaskGraph'))
const SystemFlowView = lazy(() => import('./pages/SystemFlow'))
const PlaygroundView = lazy(() => import('./pages/Playground'))
import CalendarView from './pages/Calendar'
import InquiryBoard from './pages/InquiryBoard'
import ProjectPicker from './pages/ProjectPicker'
import MembersPanel from './components/MembersPanel'
import MembersView from './pages/Members'
import ProjectSettings from './components/ProjectSettings'
import AccountPanel from './components/AccountPanel'
import AdminPanel from './components/AdminPanel'
// 儀表板一進去就要打兩支要算的 API，圖表本身也只有這一頁用得到，
// 跟甘特、關聯圖一樣延後載入
const DashboardView = lazy(() => import('./pages/Dashboard'))
const DeletedTasksView = lazy(() => import('./pages/DeletedTasks'))

type View = 'list' | 'board' | 'calendar' | 'gantt' | 'simpleGraph' | 'systemFlow' | 'playground' | 'dashboard'
  | 'inquiry' | 'members' | 'deletedTasks' | 'memberAdmin' | 'settings'

/**
 * 帳號設定與系統管理不是專案底下的視圖 —— 沒選專案也要進得去，
 * 所以獨立成一層蓋在最上面，離開就回到原本看到的畫面。
 */
type AccountView = 'profile' | 'admin' | null

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'list', label: T.nav.views.list },
  { key: 'board', label: T.nav.views.board },
  { key: 'calendar', label: T.nav.views.calendar },
  { key: 'gantt', label: T.nav.views.gantt },
  { key: 'simpleGraph', label: T.nav.views.graph },
  { key: 'systemFlow', label: T.nav.views.systemFlow },
  { key: 'playground', label: T.nav.views.playground },
  // 儀表板排在幾張「看任務」的圖後面：它看的是整個專案的走勢，
  // 不是同一批任務的另一種排法，翻它的時機也不一樣（回報進度的時候才看）
  { key: 'dashboard', label: T.nav.views.dashboard },
  // 發文追蹤放在這一排：它跟其他頁籤一樣是「這個專案的任務」的一種看法 ——
  // 只是看的是「發出去的事情回了沒」。不再是跨專案的入口。
  { key: 'inquiry', label: T.nav.views.inquiry },
  /*
   * 成員原本刻意不在這一排（理由是「這排是同一批任務的不同看法，成員是專案設定」）。
   * 2026-08-06 推翻：成員頁現在回答的是「這個人手上有什麼、以前經手過什麼」，
   * 那就是同一批任務按人切的一種看法，該站到這一排來。
   *
   * 頭像選單那個入口留著，但指向的是**管理**成員（改角色、核准加入申請），
   * 走 `memberAdmin` —— 看人跟管人是兩件事，混在一頁只會兩邊都難用。
   */
  { key: 'members', label: T.nav.views.members },
  { key: 'deletedTasks', label: T.nav.views.deletedTasks },
]

/**
 * 這幾個畫面不吃側欄「大項目」那個篩選 —— 發文追蹤與成員本來就跟大項目無關，
 * 儀表板則是整個專案一起算的。停在這些畫面上點大項目，按下去會沒有任何反應，
 * 所以一律先回清單。
 */
const NOT_FILTERED_BY_EPIC: View[] = [
  'inquiry', 'members', 'memberAdmin', 'settings', 'dashboard', 'playground',
]

const VALID_VIEWS = new Set<View>([
  'list', 'board', 'calendar', 'gantt', 'simpleGraph', 'systemFlow', 'playground', 'dashboard',
  'inquiry', 'members', 'deletedTasks', 'memberAdmin', 'settings',
])

function parseUrlState(): {
  projectId: string | null
  view: View
  openTask: string | null
  account: AccountView
  epicId: string | null
} {
  if (typeof window === 'undefined') {
    return { projectId: null, view: 'list', openTask: null, account: null, epicId: null }
  }
  const params = new URLSearchParams(window.location.search)
  const proj = params.get('project') || null
  let v = params.get('view') as View | null
  if (v === ('graph' as any)) v = 'simpleGraph'
  const finalView = v && VALID_VIEWS.has(v) ? v : 'list'
  const task = params.get('task') || null
  const accRaw = params.get('account')
  const account: AccountView = accRaw === 'profile' || accRaw === 'admin' ? accRaw : null
  const epic = params.get('epic') || null
  return { projectId: proj, view: finalView, openTask: task, account, epicId: epic }
}

function updateUrlState(state: {
  projectId: string | null
  view: View
  openTask: string | null
  account: AccountView
  epicId: string | null
}) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (state.account) {
    params.set('account', state.account)
  }
  if (state.projectId) {
    params.set('project', state.projectId)
    if (state.view && state.view !== 'list') {
      params.set('view', state.view)
    }
    if (state.openTask) {
      params.set('task', state.openTask)
    }
    if (state.epicId) {
      params.set('epic', state.epicId)
    }
  }
  const search = params.toString()
  const newUrl = search ? `${window.location.pathname}?${search}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (newUrl !== currentUrl) {
    window.history.replaceState(null, '', newUrl)
  }
}

export default function App() {
  const { user, workspaces, ready, logout } = useAuth()
  useRealtimeSync()
  // projectId 為 null＝還沒選專案，顯示選擇頁。
  // 專案、視圖與選中任務狀態同步至網址 Query String，確保 F5 重新整理時留在當前畫面與專案。
  const [projectId, setProjectId] = useState<string | null>(() => parseUrlState().projectId)
  const [view, setView] = useState<View>(() => parseUrlState().view)
  const [openTask, setOpenTask] = useState<string | null>(() => parseUrlState().openTask)
  const [epicId, setEpicId] = useState<string | null>(() => parseUrlState().epicId)
  /**
   * 從通知點進來的那張任務，要閃紅框指出來是哪一張。
   *
   * 存的是 id 不是布林值：連點兩則不同的通知時，第二則要能重新觸發
   * （`key` 換掉 → 元素重掛 → 動畫從頭跑）。
   *
   * **不設定時器自動收掉。** 人不見得正看著螢幕，閃完就退場等於沒發生過 ——
   * 要等他真的在那張任務上動一下（點、按鍵、或關掉）才清。
   * 動畫三下就停，之後留著一圈靜止的紅框（見 index.css 的 `.pmflow-flash`）。
   */
  const [flashTask, setFlashTask] = useState<string | null>(null)
  const [account, setAccount] = useState<AccountView>(() => parseUrlState().account)
  const [showAiSkillModal, setShowAiSkillModal] = useState(false)

  /**
   * 記錄已完成身分驗證的使用者 ID。
   * 僅在「真正切換至不同使用者帳號」時，才重設專案與視圖狀態，
   * 避免初次載入 (auth/refresh) 時誤將 URL 帶入的專案與頁籤清除。
   */
  const [activeUserId, setActiveUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (user?.id) {
      if (activeUserId && activeUserId !== user.id) {
        // 真正切換至不同使用者帳號
        setProjectId(null)
        setView('list')
        setOpenTask(null)
        setEpicId(null)
        setAccount(null)
      }
      setActiveUserId(user.id)
    } else {
      // 登出
      setActiveUserId(null)
      setProjectId(null)
      setView('list')
      setOpenTask(null)
      setEpicId(null)
      setAccount(null)
    }
  }, [ready, user?.id, activeUserId])

  // 同步導覽狀態至網址 Query String (F5 重新整理或複製網址時保留當前狀態)
  useEffect(() => {
    if (!ready || !user) return
    updateUrlState({ projectId, view, openTask, account, epicId })
  }, [ready, user, projectId, view, openTask, account, epicId])

  // 支援瀏覽器上一頁 / 下一頁 (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const current = parseUrlState()
      setProjectId(current.projectId)
      setView(current.view)
      setOpenTask(current.openTask)
      setEpicId(current.epicId)
      setAccount(current.account)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const { data: projectsData, isSuccess: isProjectsLoaded } = useQuery({
    queryKey: ['projects'], queryFn: Api.projects, enabled: !!user,
  })
  const projects = projectsData?.projects ?? []

  // 專案清單載入後，若網址指定的專案不在清單中，自動退回專案選擇頁
  useEffect(() => {
    if (ready && isProjectsLoaded && projectId) {
      const exists = projects.some(p => p.id === projectId)
      if (!exists) {
        setProjectId(null)
        setView('list')
        setOpenTask(null)
        setEpicId(null)
      }
    }
  }, [ready, isProjectsLoaded, projects, projectId])

  if (!ready) return <Spinner label={T.nav.starting} />
  if (!user) return <Login />

  /**
   * 點通知就跳到那件事發生的地方 —— 通知只是入口，看不到內容的話等於沒通知。
   *
   * 導覽狀態都在這一層，所以鈴鐺不管畫在哪裡（選擇頁、側欄、帳號設定），
   * 都把選中的那一則交回來由這裡處理。
   */
  const openNotification = (n: AppNotification) => {
    setAccount(null)
    if (!n.projectId) return
    setProjectId(n.projectId)
    setOpenTask(n.taskId)
    setEpicId(null)
    /*
     * 閃一下紅框指出「就是這一張」。一次點下去畫面上換掉太多東西
     * （可能換專案、換頁籤、再開抽屜），眼睛不知道該看哪裡。
     * 動畫本身在 index.css 的 `.pmflow-flash`，閃三下就停。
     */
    setFlashTask(n.taskId)
    // 有人來敲門要在成員**管理**那一頁才核准得了（頁籤上那個成員頁只看不管）
    setView(n.kind === 'JOIN_REQUESTED' ? 'memberAdmin' : 'list')
  }
  const bell = <NotificationBell onOpen={openNotification} />

  const workspaceId = workspaces[0]?.id ?? projects[0]?.workspaceId ?? ''
  // 系統管理（帳號與工作區）：只有全域超級管理者或工作區 OWNER / ADMIN 具備權限
  const isSuperOrWorkspaceOwner = workspaces.some(w => w.role?.toUpperCase() === 'OWNER')
  const isWorkspaceAdmin = isSuperOrWorkspaceOwner || workspaces.some(w => w.role?.toUpperCase() === 'ADMIN')
  const myAdminRole: WorkspaceRole = isSuperOrWorkspaceOwner ? 'OWNER' : (isWorkspaceAdmin ? 'ADMIN' : ((workspaces[0]?.role ?? 'MEMBER') as WorkspaceRole))

  const curProject = projects.find(p => p.id === projectId)
  const pendingJoins = curProject?.pendingJoinRequestCount ?? 0
  // 專案管理（成員與系統參數）：超級管理者、工作區管理者、專案建立者（擁有者）或專案管理者 (MANAGER)
  const userRole = curProject?.role
  const isProjectCreator = curProject?.isCreator ?? false
  const canManageProject = isWorkspaceAdmin || isProjectCreator || userRole === 'MANAGER'

  // 成員、系統參數、帳號設定、系統管理、外觀、登出都收在右上角的頭像底下
  // （見 components/UserMenu.tsx）。前兩項只有人在專案裡的時候才給 ——
  // 沒選專案時「這個專案的成員」與「這個專案的參數」都是空話
  const userMenu = (
    <UserMenu
      userName={user.displayName}
      isWorkspaceAdmin={isWorkspaceAdmin}
      onAccount={() => setAccount('profile')}
      onAdmin={() => setAccount('admin')}
      onLogout={logout}
      onMembers={projectId
        ? () => { setAccount(null); setView('memberAdmin'); setOpenTask(null) }
        : undefined}
      onSettings={projectId && canManageProject
        ? () => { setAccount(null); setView('settings'); setOpenTask(null) }
        : undefined}
      onSwitchProject={projectId ? () => {
        setProjectId(null)
        setView('list')
        setOpenTask(null)
        setEpicId(null)
        setAccount(null)
      } : undefined}
      onAiSkill={() => setShowAiSkillModal(true)}
      pendingJoins={pendingJoins}
    />
  )

  // ── 帳號設定／系統管理：蓋在最上面，離開就回到原本的畫面 ──
  if (account) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 py-2.5
                           dark:border-slate-700 dark:bg-slate-900">
          <Button variant="ghost" onClick={() => setAccount(null)}>← {T.common.back}</Button>
          <span className="mx-2 text-slate-200 dark:text-slate-500">|</span>
          <AccountTab active={account === 'profile'}
                      onClick={() => setAccount('profile')}>{T.nav.accountSettings}</AccountTab>
          {isWorkspaceAdmin && (
            <AccountTab active={account === 'admin'}
                        onClick={() => setAccount('admin')}>{T.nav.systemAdmin}</AccountTab>
          )}
          <div className="ml-auto flex items-center gap-2">{bell}{userMenu}</div>
        </header>
        <div className="min-h-0 flex-1">
          {account === 'profile'
            ? <AccountPanel />
            : <AdminPanel workspaceId={workspaceId}
                          myRole={myAdminRole} />}
        </div>
        <AiSkillModal
          open={showAiSkillModal}
          onClose={() => setShowAiSkillModal(false)}
          currentProjectId={projectId}
        />
      </div>
    )
  }

  // ── 還沒選專案 → 選擇頁 ──
  // 發文追蹤不再是這一頁的入口：它是專案裡的頁籤，要進到專案才看得到
  if (!projectId) {
    return (
      <>
        <ProjectPicker
          projects={projects}
          workspaceId={workspaceId}
          onPick={id => {
            setProjectId(id)
            setView('list')
            setOpenTask(null)
            setEpicId(null)
            setAccount(null)
          }}
          bell={bell}
          menu={userMenu}
        />
        <AiSkillModal
          open={showAiSkillModal}
          onClose={() => setShowAiSkillModal(false)}
          currentProjectId={projectId}
        />
      </>
    )
  }

  return (
    <>
      <ProjectWorkspace
        key={projectId}
        projectId={projectId}
        workspaceId={workspaceId}
        canManageProject={canManageProject}
        view={view} setView={setView}
        openTask={openTask} setOpenTask={setOpenTask}
        epicId={epicId} setEpicId={setEpicId}
        flashTask={flashTask}
        onFlashSeen={() => setFlashTask(null)}
        onSwitchProject={() => {
          setProjectId(null)
          setView('list')
          setOpenTask(null)
          setEpicId(null)
          setAccount(null)
        }}
        bell={bell}
        menu={userMenu}
      />
      <AiSkillModal
        open={showAiSkillModal}
        onClose={() => setShowAiSkillModal(false)}
        currentProjectId={projectId}
      />
    </>
  )
}

function AccountTab({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: ReactNode
}) {
  return (
    <button onClick={onClick}
            className={cx('rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200')}>
      {children}
    </button>
  )
}

/**
 * 單一可拖曳頁籤項目
 */
function SortableTabRow({
  item,
  on,
  stuck,
  onToggle,
}: {
  item: { key: View; label: string }
  on: boolean
  stuck: boolean
  onToggle: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs border select-none transition-colors',
        isDragging
          ? 'z-50 opacity-90 shadow-lg ring-2 ring-blue-500 bg-white dark:bg-slate-800 border-blue-400'
          : on
            ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700'
            : 'bg-slate-100/40 dark:bg-slate-900/20 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
      )}
    >
      <label
        title={stuck ? '至少需保留一個頁籤顯示' : undefined}
        className={cx(
          'flex min-w-0 flex-1 items-center gap-2',
          stuck ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <input
          type="checkbox"
          checked={on}
          disabled={stuck}
          onChange={onToggle}
          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40 dark:border-slate-600 dark:bg-slate-900 cursor-pointer"
        />
        <span
          className={cx(
            'truncate font-medium',
            on ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 line-through'
          )}
        >
          {item.label}
        </span>
      </label>

      {/* 三條線拖曳手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0 transition-colors touch-none"
        title="按住拖曳調整順序"
      >
        <svg className="w-4 h-4 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h14a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h14a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h14a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  )
}

/**
 * 頁籤顯示與順序管理面板：支援勾選顯示/隱藏、三條線拖曳手柄排序與一鍵重設。
 * 只影響本機瀏覽器偏好設定。
 */
function TabPrefs({ hidden, setHidden, ordered, onReorder, onResetOrder, view, setView }: {
  hidden: View[]
  setHidden: (v: View[]) => void
  ordered: Array<{ key: View; label: string }>
  onReorder: (activeKey: View, overKey: View) => void
  onResetOrder: () => void
  view: View
  setView: (v: View) => void
}) {
  const [open, setOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const shown = ordered.filter((v) => !hidden.includes(v.key))
  const lastOne = shown.length <= 1

  function toggle(key: View) {
    const next = hidden.includes(key)
      ? hidden.filter((k) => k !== key)
      : [...hidden, key]
    setHidden(next)
    // 若隱藏的剛好是目前瀏覽頁面，自動切換至剩餘的第一個顯示頁籤
    if (key === view && next.includes(key)) {
      const first = ordered.find((v) => !next.includes(v.key))
      if (first) setView(first.key)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onReorder(active.id as View, over.id as View)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="自訂頁籤顯示與排序"
        aria-label="自訂頁籤顯示與排序"
        aria-expanded={open}
        className={cx(
          'flex items-center justify-center rounded-md p-1.5 text-xs font-medium transition cursor-pointer',
          open
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        )}
      >
        <span className="text-sm select-none">⚙</span>
      </button>

      {open && (
        <>
          {/* 透明遮罩 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <span>⚙️</span> 頁籤顯示與排序
              </div>
              <span className="text-[10px] text-slate-400">僅本機偏好</span>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              勾選顯示或隱藏頁籤，按住 ☰ 拖曳上下順序：
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ordered.map((v) => v.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-2.5 space-y-1.5 max-h-72 overflow-y-auto pr-0.5 select-none">
                  {ordered.map((v) => (
                    <SortableTabRow
                      key={v.key}
                      item={v}
                      on={!hidden.includes(v.key)}
                      stuck={!hidden.includes(v.key) && lastOne}
                      onToggle={() => toggle(v.key)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setHidden([])
                  onResetOrder()
                }}
                className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition cursor-pointer"
              >
                重設為預設
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * 有選定專案時的主畫面：左側大項目、右側視圖。
 * 查詢集中在這一層，側欄和主視圖吃同一份資料，不會各抓一次。
 */
function ProjectWorkspace({
  projectId, workspaceId, canManageProject = false, view: requestedView, setView, openTask, setOpenTask,
  epicId, setEpicId,
  flashTask, onFlashSeen, onSwitchProject, bell, menu,
}: {
  projectId: string
  workspaceId: string
  canManageProject?: boolean
  view: View
  setView: (v: View) => void
  openTask: string | null
  setOpenTask: (id: string | null) => void
  epicId: string | null
  setEpicId: (id: string | null) => void
  /** 剛從通知點進來的那張任務，要閃紅框指出來。null＝不閃 */
  flashTask: string | null
  /** 他在那張任務上動了一下，或關掉了 —— 紅框可以收走了 */
  onFlashSeen: () => void
  onSwitchProject: () => void
  /** 通知鈴鐺。由 App 建立，因為點下去要跳去哪是 App 的導覽狀態 */
  bell: ReactNode
  /** 右上角的頭像選單。同樣由 App 建立 —— 點下去是換畫面，那是 App 的事 */
  menu: ReactNode
}) {
  /** 側欄點擊選擇的事件，供右側視圖連動與高亮 */
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(() => epicId)
  /** 側欄點擊觸發的聚焦目標（附帶時間戳以確保只在點擊瞬間平移視角一次，null id 表示顯示全部） */
  const [menuFocusTarget, setMenuFocusTarget] = useState<{ id: string | null; ts: number } | null>(() => epicId ? { id: epicId, ts: Date.now() } : null)

  /**
   * 藏起來的頁籤。**每個人自己的偏好，存這台瀏覽器**（見 AGENTS.md）——
   * 不做成專案設定：一個人嫌甘特圖礙眼把它收掉，會連帶害到同專案
   * 每天都在看甘特圖的人。跟側欄收合、行事曆勾選同一套 `lib/remember.ts`。
   */
  const [hiddenTabs, setHiddenTabs] = useRemembered<View[]>('tabs.hidden', [])
  /**
   * 頁籤由左到右的順序，一樣是自己這台瀏覽器的偏好。
   *
   * 存下來的清單**不能直接拿來用**：版本更新多一個頁籤時，舊的存值裡沒有它，
   * 照著存值畫就等於那個新頁籤永遠出不來。所以一律「先照存值排，
   * 存值裡沒有的照 VIEWS 原順序補在後面，存值裡有但已經不存在的跳過」。
   */
  const [tabOrder, setTabOrder] = useRemembered<View[]>('tabs.order', [])
  const [customTabNames, setCustomTabNames] = useRemembered<Record<string, string>>('tabs.customNames', {})

  useEffect(() => {
    const onTabNamesChanged = () => {
      try {
        const raw = localStorage.getItem('pmflow.pref.tabs.customNames')
        if (raw) setCustomTabNames(JSON.parse(raw))
        else setCustomTabNames({})
      } catch {}
    }
    window.addEventListener('pmflow_tab_names_changed', onTabNamesChanged)
    return () => window.removeEventListener('pmflow_tab_names_changed', onTabNamesChanged)
  }, [setCustomTabNames])

  const allViewsWithCustomLabels = useMemo(() => {
    return VIEWS.map(v => ({
      ...v,
      label: customTabNames[v.key]?.trim() || v.label,
    }))
  }, [customTabNames])

  const orderedViews = useMemo(() => {
    const known = new Map(allViewsWithCustomLabels.map(v => [v.key, v]))
    const out = tabOrder.map(k => known.get(k)).filter(v => v !== undefined)
    for (const v of allViewsWithCustomLabels) if (!out.includes(v)) out.push(v)
    return out
  }, [tabOrder, allViewsWithCustomLabels])
  const shownViews = orderedViews.filter(v => !hiddenTabs.includes(v.key))

  /**
   * 存下來的偏好可能正好藏著現在這一頁（上次藏完就關掉、或換了一台裝置），
   * 那就退到還留著的第一個 —— 不然會停在一個「上面沒有任何頁籤亮著」的畫面，
   * 看起來就像壞掉了。成員管理與系統參數不在頁籤那一排，不受影響。
   */
  const view: View = VIEWS.some(v => v.key === requestedView) && hiddenTabs.includes(requestedView)
    ? (shownViews[0]?.key ?? 'list')
    : requestedView

  /** 拖曳調整頁籤左右順序。存的是完整順序，不是差異 */
  function reorderTab(activeKey: View, overKey: View) {
    const keys = orderedViews.map(v => v.key)
    const oldIndex = keys.indexOf(activeKey)
    const newIndex = keys.indexOf(overKey)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
    setTabOrder(arrayMove(keys, oldIndex, newIndex))
  }

  function moveTab(key: View, direction: 'up' | 'down') {
    const keys = orderedViews.map(v => v.key)
    const oldIndex = keys.indexOf(key)
    if (oldIndex < 0) return
    const newIndex = direction === 'up' ? oldIndex - 1 : oldIndex + 1
    if (newIndex < 0 || newIndex >= keys.length) return
    setTabOrder(arrayMove(keys, oldIndex, newIndex))
  }

  const { data: project } = useQuery({
    queryKey: ['project', projectId], queryFn: () => Api.project(projectId),
  })
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', projectId], queryFn: () => Api.tasks(projectId),
  })
  const tasks = tasksData?.tasks ?? []

  // 任務清單載入後，若網址指定的大項目不存在，自動清除篩選
  useEffect(() => {
    if (tasksData?.tasks && epicId) {
      const exists = tasks.some(t => t.id === epicId)
      if (!exists) {
        setEpicId(null)
      }
    }
  }, [tasksData, tasks, epicId, setEpicId])

  // 選了大項目 → 主視圖只顯示它和它底下的小項目（含更深的層）
  const visible = useMemo(() => {
    if (!epicId) return tasks
    const kids = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.parentId) continue
      const a = kids.get(t.parentId) ?? []; a.push(t); kids.set(t.parentId, a)
    }
    const out: Task[] = []
    const seen = new Set<string>()
    const walk = (id: string) => {
      if (seen.has(id)) return
      seen.add(id)
      const self = tasks.find(t => t.id === id)
      if (self) out.push(self)
      for (const k of kids.get(id) ?? []) walk(k.id)
    }
    walk(epicId)
    return out
  }, [tasks, epicId])

  const epic = epicId ? tasks.find(t => t.id === epicId) : undefined
  const selectedTask = (focusedTaskId ? tasks.find(t => t.id === focusedTaskId) : undefined) ?? epic
  const selectedRef = selectedTask ? (selectedTask.ref || (selectedTask.number ? `MRG-${selectedTask.number}` : '')) : ''
  const selectedLabel = selectedTask ? `${selectedRef ? `${selectedRef} ` : ''}${selectedTask.title}` : undefined
  const overdue = visible.filter(t => t.inquiryState === 'OVERDUE').length

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleTaskSelect = (id: string) => {
    setFocusedTaskId(id)
    if (isMobile) {
      // 手機版：點擊任意任務開啟任務詳情（清單檢視下可編輯，其他檢視下唯讀）
      setOpenTask(id)
    } else {
      setOpenTask(null)
    }
    if (id) setMenuFocusTarget({ id, ts: Date.now() })
  }

  const handleTaskEdit = (id: string) => {
    setFocusedTaskId(id)
    setOpenTask(id)
  }

  return (
    <div className="flex h-full w-full max-w-full overflow-hidden">
      <EpicSidebar
        project={project}
        tasks={tasks}
        types={project?.types ?? []}
        selectedEpicId={epicId}
        onSelectEpic={id => {
          setEpicId(id)
          setOpenTask(null)
          setFocusedTaskId(id)
          setMenuFocusTarget({ id, ts: Date.now() })
        }}
        view={view}
        selectedTaskId={focusedTaskId ?? openTask}
        onOpenTask={handleTaskSelect}
        onOpenEditTask={handleTaskEdit}
        onSwitchProject={onSwitchProject}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden w-full max-w-full">
        <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {/* 第一層 (h-10 sm:h-12)：頁籤區 (左) + 通知與頭像選單 (右)，常駐顯示 */}
          <div className="flex h-10 sm:h-12 items-center border-b border-slate-200 px-1.5 sm:px-3 dark:border-slate-700 min-w-0">
            <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto whitespace-nowrap min-w-0 flex-1 pr-1 scrollbar-none">
              {shownViews.map(v => (
                <button key={v.key} onClick={() => { setView(v.key); setOpenTask(null) }}
                        className={cx(
                          'flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors select-none cursor-pointer',
                          view === v.key && !openTask
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        )}>
                  {v.label}
                </button>
              ))}
            </nav>
            <div className="ml-auto shrink-0 flex items-center gap-1 sm:gap-2">
              <TabPrefs hidden={hiddenTabs} setHidden={setHiddenTabs}
                        ordered={orderedViews} onReorder={reorderTab}
                        onResetOrder={() => setTabOrder([])}
                        view={view} setView={setView} />
              {bell}
              {menu}
            </div>
          </div>

          {/* 第二層 (min-h-8 sm:min-h-9)：當前顯示事件 / 編輯模式麵包屑 */}
          <div className="flex min-h-8 sm:min-h-9 items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-0.5 sm:py-1 text-[11px] sm:text-xs font-medium bg-slate-50/50 dark:bg-slate-800/40 flex-wrap sm:flex-nowrap">
            {openTask ? (
              <div className="flex items-center gap-1.5 sm:gap-2 truncate flex-1 min-w-0">
                <button
                  onClick={() => { setOpenTask(null) }}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 shrink-0 font-medium cursor-pointer"
                >
                  <span aria-hidden>←</span>
                  <span className="hidden sm:inline">{project?.name}</span>
                  <span className="sm:hidden">返回</span>
                </button>
                {(() => {
                  const t = tasks.find(x => x.id === openTask)
                  const parent = t?.parentId ? tasks.find(x => x.id === t.parentId) : undefined
                  return parent ? (
                    <>
                      <span className="text-slate-300 dark:text-slate-600 shrink-0">/</span>
                      <button
                        onClick={() => { setEpicId(parent.id); setOpenTask(null) }}
                        className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 truncate max-w-[80px] sm:max-w-[120px] cursor-pointer"
                      >
                        {parent.title}
                      </button>
                    </>
                  ) : null
                })()}
                <span className="text-slate-300 dark:text-slate-600 shrink-0">/</span>
                <span className="truncate font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 sm:px-2 py-0.5 rounded ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/30">
                  {(() => {
                    const current = tasks.find(x => x.id === openTask)
                    if (!current) return T.nav.fallbackTaskTitle
                    const ref = current.ref || (current.number ? `MRG-${current.number}` : '')
                    return `${ref ? `${ref} ` : ''}${current.title}`
                  })()}
                </span>
                <button
                  onClick={() => setOpenTask(null)}
                  className="ml-auto px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  title="關閉編輯"
                >
                  <span className="hidden sm:inline">關閉編輯 </span>✕
                </button>
              </div>
            ) : selectedLabel ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="shrink-0 text-slate-400 dark:text-slate-400 font-normal">當前顯示：</span>
                <span className="truncate font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 sm:px-2 py-0.5 rounded ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/30">
                  {selectedLabel}
                </span>
              </div>
            ) : (
              <span className="truncate text-slate-500 dark:text-slate-400">
                (當前顯示：全專案事件 - {shownViews.find(v => v.key === view)?.label ?? T.common.none})
              </span>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isLoading ? <Spinner /> : openTask ? (
            // 主從式：左邊選了任務，右邊就是那張任務的詳情
            <TaskDrawer
              key={openTask}
              taskId={openTask}
              workspaceId={workspaceId}
              statuses={project?.statuses ?? []}
              allTasks={tasks}
              flash={flashTask === openTask}
              onSeen={onFlashSeen}
              onClose={() => { onFlashSeen(); setOpenTask(null) }}
              onSelectTask={setOpenTask}
              readOnly={isMobile && view !== 'list'}
              onSwitchToList={() => { setView('list'); }}
            />
          ) : (
            <>
              {view === 'list' && (
                <ListView projectId={projectId} tasks={visible} parentForNew={epicId}
                          statuses={project?.statuses ?? []} onOpen={handleTaskSelect} onEdit={handleTaskEdit}
                          focusedTaskId={focusedTaskId} />
              )}
              {view === 'board' && (
                <Board projectId={projectId} tasks={visible}
                       statuses={project?.statuses ?? []} onOpen={handleTaskSelect} onEdit={handleTaskEdit}
                       focusedTaskId={focusedTaskId} />
              )}
              {view === 'calendar' && (
                <CalendarView projectId={projectId} workspaceId={workspaceId}
                              tasks={visible} statuses={project?.statuses ?? []}
                              onOpen={handleTaskSelect} onEdit={handleTaskEdit}
                              focusedTaskId={focusedTaskId} />
              )}
              {view === 'gantt' && (
                <DesktopRecommendedNotice
                  viewName={shownViews.find(v => v.key === 'gantt')?.label ?? T.nav.views.gantt}
                  onSwitchToList={() => setView('list')}
                >
                  <Suspense fallback={<Spinner label={T.nav.loadingGantt} />}>
                    <GanttView projectId={projectId} tasks={visible} onOpen={handleTaskEdit} onSelectTask={handleTaskSelect} focusedTaskId={focusedTaskId} />
                  </Suspense>
                </DesktopRecommendedNotice>
              )}
              {view === 'simpleGraph' && (
                <DesktopRecommendedNotice
                  viewName={shownViews.find(v => v.key === 'simpleGraph')?.label ?? T.nav.views.graph}
                  onSwitchToList={() => setView('list')}
                >
                  <Suspense fallback={<Spinner label={T.nav.loadingGraph} />}>
                    <TaskGraphView
                      projectId={projectId}
                      tasks={tasks}
                      onOpenTask={handleTaskEdit}
                      focusedTaskId={focusedTaskId ?? epicId}
                      menuFocusTarget={menuFocusTarget}
                      onSelectTask={(id) => setFocusedTaskId(id)}
                      canManage={canManageProject}
                    />
                  </Suspense>
                </DesktopRecommendedNotice>
              )}
              {view === 'systemFlow' && (
                <DesktopRecommendedNotice
                  viewName={shownViews.find(v => v.key === 'systemFlow')?.label ?? T.nav.views.systemFlow}
                  onSwitchToList={() => setView('list')}
                >
                  <Suspense fallback={<Spinner label={T.nav.loadingGraph} />}>
                    <SystemFlowView projectId={projectId} />
                  </Suspense>
                </DesktopRecommendedNotice>
              )}
              {view === 'playground' && (
                <DesktopRecommendedNotice
                  viewName={shownViews.find(v => v.key === 'playground')?.label ?? T.nav.views.playground}
                  onSwitchToList={() => setView('list')}
                >
                  <Suspense fallback={<Spinner label={`載入${shownViews.find(v => v.key === 'playground')?.label ?? T.nav.views.playground}…`} />}>
                    <PlaygroundView
                      projectId={projectId}
                      title={shownViews.find(v => v.key === 'playground')?.label ?? T.nav.views.playground}
                    />
                  </Suspense>
                </DesktopRecommendedNotice>
              )}
              {/*
                * 刻意不傳 visible：燃盡圖與熱圖是整個專案的走勢，後端一次算完。
                * 跟著側欄選的大項目變的話，看到的數字會跟他嘴上說的「專案進度」對不起來。
                */}
              {view === 'dashboard' && (
                <Suspense fallback={<Spinner label={T.nav.loadingDashboard} />}>
                  <DashboardView projectId={projectId} onOpenTask={handleTaskSelect} focusedTaskId={focusedTaskId ?? epicId} />
                </Suspense>
              )}
              {view === 'inquiry' && (
                <InquiryBoard projectId={projectId} workspaceId={workspaceId} tasks={tasks}
                              onOpenTask={handleTaskSelect} onEditTask={handleTaskEdit}
                              focusedTaskId={focusedTaskId ?? epicId} />
              )}
              {/* 頁籤上的成員頁：看人手上有什麼、以前經手過什麼 */}
              {view === 'members' && (
                <MembersView projectId={projectId} workspaceId={workspaceId}
                             onOpenTask={handleTaskSelect} onEditTask={handleTaskEdit}
                             focusedTaskId={focusedTaskId ?? epicId} />
              )}
              {view === 'deletedTasks' && (
                <Suspense fallback={<Spinner label="載入已刪除事件…" />}>
                  <DeletedTasksView projectId={projectId} />
                </Suspense>
              )}
              {/* 頭像選單進來的成員管理：改角色、核准加入申請 */}
              {view === 'memberAdmin' && (
                <MembersPanel projectId={projectId} workspaceId={workspaceId} />
              )}
              {view === 'settings' && <ProjectSettings projectId={projectId} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
