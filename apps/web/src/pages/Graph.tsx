import {
  useCallback, useEffect, useMemo, useRef, useState,
  type MouseEvent as ReactMouseEvent, type MouseEventHandler, type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Background, BackgroundVariant, Handle, MarkerType, NodeResizeControl, Panel, Position, ReactFlow,
  ReactFlowProvider, useNodesInitialized, useReactFlow,
  type Connection, type Edge, type FitViewOptions, type Node, type NodeChange, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Api, ApiError, type InquiryState, type LinkType, type ProjectParam, type Task, type TaskStatus,
} from '../lib/api'
import { Button, Empty, INQUIRY_META, Select, Spinner, cx } from '../components/ui'
import { LINK_CHIP, LINK_LABEL } from '../lib/linkText'
import { useTheme } from '../lib/theme'
import { useUnreadNotifications } from '../lib/useUnreadNotifications'
import { rollup } from '../lib/rollup'
import { T } from '../strings'

/**
 * 關聯網路圖 —— 把「上下左右」三種關聯一次畫出來。
 *
 * 用 @xyflow/react (React Flow, MIT)。這裡跟行事曆不一樣，沒有自己畫：
 * 平移縮放、節點拖曳、邊的路由與端點標記自己寫要好幾百行，而且
 * React Flow 不需要第二套拖曳引擎（行事曆當初棄用 react-big-calendar，
 * 是因為它的拖曳外掛要另外帶 react-dnd，會跟 dnd-kit 搶指標事件）。
 *
 * 但**佈局是自己算的**，沒有用官方文件推薦的 elkjs —— 它是 EPL-2.0，
 * 過不了 ci.yml 的授權白名單。dagre 授權乾淨但 2018 年後就沒動了。
 * 我們要的只是「依賴由左往右分層」，自己寫的最長路徑分層約六十行就夠。
 *
 * 介面一律不出現 FS / SS / FF / SF。邊上掛的是短句（完成後開始…），
 * 側欄的關聯清單講完整句型，跟任務詳情頁同一套說法。
 *
 * 線分兩類，走的方向刻意不一樣：
 *
 *   排程依賴（完成後開始那四種）有先後 → 左進右出，由左往右讀就是時間順序
 *   任務相關（相關／阻擋／重複於／需要）沒有先後 → 走上下
 *
 * 相關類如果也畫成左右，會被讀成「先做這個再做那個」，但它們根本不推動日期。
 */

// ── 畫面上的字全在 strings/chart.ts，跟任務詳情與通知講的是同一套說法 ──
const G = T.chart.graph

const SCHEDULING = ['FS', 'SS', 'FF', 'SF'] as const
type SchedulingType = (typeof SCHEDULING)[number]
const isScheduling = (t: LinkType): t is SchedulingType =>
  (SCHEDULING as readonly string[]).includes(t)

/**
 * 四種排程依賴各給一個顏色。刻意不「只靠顏色」區分 ——
 * 每條線上都掛著中文短句，色弱或列印成黑白也讀得出來，顏色只是加速掃視。
 */
const SCHEDULING_COLOR: Record<SchedulingType, string> = {
  FS: '#dc2626', SS: '#ea580c', FF: '#7c3aed', SF: '#0891b2',
}
/**
 * 虛線只有一個意思：**這條線不會推動日期**。
 *
 * 任務相關（相關／阻擋／重複於／需要）畫得深、畫長虛線，而且走上下 ——
 * 排程依賴走左右，兩類光看方向就分得開。加上線上本來就有的中文短句，
 * 就算色弱或列印成黑白也不會混在一起。
 */
const RELATION_COLOR = '#64748b'
const RELATION_DASH = '7 4'

/**
 * 節點上的四個接點。
 *
 *   左（in）／右（out）＝排程依賴。有先後，所以由左往右流。
 *   上（rel-in）／下（rel-out）＝任務相關。沒有先後，走上下才不會被讀成順序。
 *
 * 邊一定要指定 sourceHandle / targetHandle，不然 React Flow 會自己挑一個，
 * 兩類就會混在同一側。
 */
const H_IN = 'in'
const H_OUT = 'out'
const H_REL_IN = 'rel-in'
const H_REL_OUT = 'rel-out'

/**
 * 線上的字不加白底方框。
 *
 * 方框會把線壓斷一整段，密的地方看起來像線斷掉了。改成在字的外圍描一圈
 * 跟畫布同色的邊（paint-order: stroke 先描邊再填字），字一樣讀得清楚，
 * 但線只被字本身的筆畫遮住，走向仍然看得出來。
 */
/**
 * 描邊要跟畫布同色，深色模式下畫布是 slate-950 —— 寫死淺色的話，
 * 深色下每個標籤外面會多一圈白暈。用 CSS 變數讓它跟著主題走（定義在 index.css）。
 */
const HALO = 'var(--graph-halo)'
const labelText = (color: string, faded: boolean) => ({
  fontSize: 10,
  fill: color,
  opacity: faded ? 0.15 : 1,
  paintOrder: 'stroke' as const,
  stroke: HALO,
  strokeWidth: 4,
  strokeLinejoin: 'round' as const,
})

/**
 * 刻意不替圖例保留空間。
 *
 * 試過在 fitView 裡留出圖例的高度，結果在矮一點的視窗上（實測畫布只有 368px 高）
 * 光圖例就吃掉快一半，整張圖被壓到看不清字。圖例改成工具列上的切換鈕、預設收起
 * —— 每條線上本來就有中文短句，圖例是輔助不是必需。
 */
const FIT_OPTIONS: FitViewOptions = {
  duration: 200,
  padding: { top: '16px', right: '24px', bottom: '16px', left: '16px' },
}

// ── 佈局參數 ────────────────────────────────────────────
/** 欄距要留得下匯合點加它前後的兩段線與標籤，見 JUNCTION_GAP (384 = 16 * 24) */
const COL_GAP = 384
const ROW_GAP = 96
/** 一層塞不下就折成下一個子欄，不然會拉成一條看不完的長條 */
const MAX_PER_COL = 10
/** 節點寬度 (288 = 12 * 24px 網點) */
const NODE_W = 288
/** 節點預設高度 (96 = 4 * 24px 網點，中心 Handle 落在 48px = 2 * 24px 網點橫線上) */
const NODE_H_FALLBACK = 96
/** 匯合點是一個小圓點 (24px 網點) */
const JUNCTION_SIZE = 24
/** 匯合點離任務節點多遠 (48 = 2 * 24px 網點) */
const JUNCTION_GAP = 48
/** 從任務的外緣算起，一個匯合點總共要吃掉多寬 (72 = 3 * 24px 網點) */
const JUNCTION_SPAN = JUNCTION_GAP + JUNCTION_SIZE

/** 強制將像素高度/尺寸轉換為 48px 網格倍數，確保 Handle 垂直中點 (height / 2) 精確落於 24px 背景網點點陣上 */
const even = (v: number): number => {
  return Math.ceil(Math.max(v, LEAF_H) / 48) * 48
}

/** 強制將 Y 座標對齊 48px 網格（允許任意正負座標，不受尺寸下限限制） */
const evenPos = (v: number): number => {
  return Math.round(v / 48) * 48
}

type TaskNodeData = {
  id: string
  ref: string
  title: string
  /** 顏色不存在節點裡，每次算 —— 見下面建立節點那段的說明 */
  statusKey: string
  taskType: string
  typeColor?: string
  typeName?: string
  color: string
  progress: number
  inquiryState: InquiryState
  isEpic: boolean
  isBug: boolean
  isMilestone: boolean
  isContainerMode: boolean
  onToggleContainer?: () => void
  onOpenEditDrawer?: (id: string) => void
  /** 框裡直接放著幾張任務。0＝不是框 */
  childCount: number
  /**
   * 在框裡面，而且沒有任何同框的上游 —— 這一包從這幾張開始。
   *
   * 一支箭頭指進框，意思是「這一整包要等」，實際被擋住的就是這幾張。
   * 不標出來的話，框裡有好幾個起點時會看不出來要從哪裡下手。
   */
  isEntry: boolean
  dimmed: boolean
  focused: boolean
  selected?: boolean
  hasUnread?: boolean
  /**
   * 只因為「階層」而被留亮的鄰居 —— 選中任務的上層或下層，兩者之間**沒有依賴**。
   * null＝不是這種情況（沒在聚焦、或它跟選中的那張真的有關聯線）。
   */
  kin: 'parent' | 'child' | null
  /** 卡住這張任務的上游（任務編號）。空陣列＝沒被卡住，或使用者關掉了這個標記 */
  blockedBy: string[]
  /**
   * 目前遇到的問題（人自己寫下的那一段字），沒寫就是 null。
   *
   * 跟 blockedBy 分成兩個欄位而不是合成一個「有狀況」：卡住是這張圖自己
   * 算出來的、上游一完成就消失；問題只有人能寫、也只有人能清。
   * 併成一個的話畫面就沒辦法回答「這是系統推的還是人講的」。
   */
  problem: string | null
  /**
   * 可以跟這張任務同時做的任務（任務編號），依「怎麼個同時法」分開。同上，關掉標記時是空的。
   *
   * 三者互斥：同一對任務只會落在其中一類，先判同時開始／同時完成，都不是才算單純重疊。
   */
  parallel: ParallelPeers
  showBadges?: boolean
  /**
   * 框自動算出來的大小 —— 同時也是使用者往內縮的下限：再小就會蓋掉裡面的任務。
   * 不是框的節點就是 null。
   */
  minSize: { w: number; h: number } | null
}

/** 同時開始／同時完成／期間重疊，各自列出對方的任務編號 */
type ParallelPeers = { sameStart: string[]; sameFinish: string[]; overlap: string[] }
const NO_PARALLEL: ParallelPeers = { sameStart: [], sameFinish: [], overlap: [] }
type TaskNode = Node<TaskNodeData, 'task' | 'box'>

// ── 最下面那兩排說明的文字 ──────────────────────────────
// 同一段文字要給兩個地方用：游標停著出現的 title，以及點一下釘在列上方的說明。
// 寫成常數才不會兩邊各寫一份、改一邊忘另一邊。

const HELP = G.help

/**
 * 說明列「圖示」那一排。顏色跟節點上的徽章同一組，掃過去對得起來。
 *
 * 「同時開始」「同時完成」刻意不在這裡 —— 它們在圖上還有一個長相（匯合點的圓點），
 * 兩排各講一次就是同一件事講兩遍。合併成上面那一排的圓點，說明裡一次講完兩個長相。
 */
const ICON_HELP: Array<{ label: string; className?: string; text: string }> = [
  { label: HELP.icon.blocked.label, text: HELP.icon.blocked.text },
  { label: HELP.icon.problem.label, className: 'text-fuchsia-700 dark:text-fuchsia-400',
    text: HELP.icon.problem.text },
  { label: HELP.icon.overlap.label, className: 'text-teal-700 dark:text-teal-400',
    text: HELP.icon.overlap.text },
  { label: HELP.icon.entry.label, className: 'text-emerald-700 dark:text-emerald-400',
    text: HELP.icon.entry.text },
  { label: HELP.icon.childCount.label, className: 'text-violet-700 dark:text-violet-400',
    text: HELP.icon.childCount.text },
  { label: HELP.icon.milestone.label, className: 'text-amber-700 dark:text-amber-400',
    text: HELP.icon.milestone.text },
]

/** 節點上那排小徽章的共同樣式。一律 shrink-0＋不換行，擠不下就被裁掉，不折行 */
const BADGE = 'shrink-0 whitespace-nowrap rounded px-1 text-[10px]'

/**
 * 徽章的顏色。深色底下淺色的 bg-X-50 會亮得刺眼，一律照 index.css 那張表
 * 換成半透明的 X-500/15 —— 節點本身是深色卡片，色塊要透出底色才不會浮起來。
 */
const BADGE_VIOLET = 'bg-violet-100 font-medium text-violet-700 '
  + 'dark:bg-violet-500/20 dark:text-violet-300'
const BADGE_VIOLET_SOFT = 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
const BADGE_EMERALD = 'bg-emerald-50 font-medium text-emerald-700 '
  + 'dark:bg-emerald-500/15 dark:text-emerald-300'
const BADGE_RED = 'bg-red-50 font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300'
const BADGE_FUCHSIA = 'bg-fuchsia-50 font-medium text-fuchsia-700 '
  + 'dark:bg-fuchsia-500/15 dark:text-fuchsia-300'
const BADGE_AMBER = 'bg-amber-50 font-medium text-amber-700 '
  + 'dark:bg-amber-500/15 dark:text-amber-300'
const BADGE_AMBER_SOFT = 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
const BADGE_PURPLE = 'bg-purple-50 font-medium text-purple-700 '
  + 'dark:bg-purple-500/15 dark:text-purple-300'
const BADGE_TEAL = 'bg-teal-50 font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
const BADGE_ROSE_SOFT = 'bg-rose-50 font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
const BADGE_SKY_SOFT = 'bg-sky-50 font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'

// Ref: CR-087 — 關聯圖事件框頂線與外框配色與系統種類配色對齊
function getTypeColor(taskType: string, customColor?: string): string {
  if (customColor) return customColor
  const DEFAULT_MAP: Record<string, string> = {
    EPIC: '#d97706',      // 大項目 (琥珀橘)
    TASK: '#3178c6',      // 任務 (經典藍)
    BUG: '#dc2626',       // 問題 (鮮紅)
    MILESTONE: '#8b5cf6', // 里程碑 (紫羅蘭)
  }
  return DEFAULT_MAP[taskType] ?? '#64748b'
}

function getTypeName(taskType: string, customName?: string): string {
  if (customName) return customName
  const DEFAULT_NAMES: Record<string, string> = {
    EPIC: '大項目',
    TASK: '事件',
    BUG: '問題',
    MILESTONE: '里程碑',
  }
  return DEFAULT_NAMES[taskType] ?? taskType
}

// ── 節點 ────────────────────────────────────────────────

/**
 * 外框的樣式。一般任務與大項目的框共用一套，只差在大小與底色 ——
 * 兩者都是任務，被卡住、被聚焦、只因階層而亮，三種狀態的畫法都要一致。
 */
function frameClass(data: TaskNodeData): string {
  return cx(
    'rounded-lg border shadow-sm transition-all',
    data.hasUnread && 'pmflow-flash',
    data.selected || data.focused ? 'border-blue-500 ring-2 ring-blue-500/40 font-semibold'
      // 卡住＝現在動不了，是圖上最該被看到的狀態，給整圈紅框加紅暈
      : data.blockedBy.length ? 'border-red-500 ring-2 ring-red-500/25'
      // Ref: CR-088 — 未設定特殊狀態時移除預設灰框，讓事件種類 color 精確套用至外框邊線
      : data.kin ? 'border-violet-400 ring-2 ring-violet-200 dark:ring-violet-500/30'
      : '',
    data.dimmed && 'opacity-20'
  )
}

/** 左右那兩個接點（排程依賴）。四個節點型別共用一組樣式 */
const HANDLE_DOT = '!h-2 !w-2 !border !border-white !bg-slate-400 dark:!border-slate-900'
/**
 * 上下那兩個接點（任務相關）。一樣是小圓點、一樣的大小，只是顏色壓淡 ——
 * 平常不該讓人覺得節點多長了兩顆疣，要拉線的時候看得到就夠了。
 */
const HANDLE_DOT_REL = '!h-2 !w-2 !border !border-white !bg-slate-300 '
  + 'dark:!border-slate-900 dark:!bg-slate-600'

/** 四個接點。任務與框都要有，相關類的線才有地方接上下 */
function NodeHandles({ sideYStyle }: { sideYStyle?: React.CSSProperties }) {
  return (
    <>
      <Handle id={H_IN} type="target" position={Position.Left} className={HANDLE_DOT} style={sideYStyle} />
      <Handle id={H_OUT} type="source" position={Position.Right} className={HANDLE_DOT} style={sideYStyle} />
      <Handle id={H_REL_IN} type="target" position={Position.Top} className={HANDLE_DOT_REL} />
      <Handle id={H_REL_OUT} type="source" position={Position.Bottom} className={HANDLE_DOT_REL} />
    </>
  )
}

/** 拉框把手的顏色。跟「大項目」徽章同一個紫，深淺兩個主題下都看得見 */
const RESIZE_COLOR = '#8b5cf6'

/**
 * 大項目＝一個框，底下的任務排在框裡面（它們是 React Flow 的子節點，畫在框上面）。
 *
 * 框裡面刻意留空、只有很淡的底色：真正的內容是那些子節點，框只負責圈範圍。
 * 標題列做成一整條可以點的區域，點它就是點這張任務（聚焦、雙擊開啟都照舊）。
 *
 * 框的大小預設是佈局算出來的，但使用者可以自己拉（NodeResizer，React Flow 內建）。
 * 把手只在框被選起來時出現 —— 常駐的話每個框的四角都多四顆點，圖會很吵。
 * 下限是自動佈局算出來的尺寸：再小就會把裡面的任務蓋掉。
 */
function NodeProgressBar({ progress }: { progress: number; accentColor?: string }) {
  const barColor = progress >= 100 ? '#10b981' : '#ef4444'
  return (
    <div className="mt-1.5 flex items-center gap-1.5 w-full">
      <div className="h-1 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
        <div
          className={cx("h-1 rounded transition-all duration-300", progress === 0 && "opacity-40")}
          style={{
            width: `${Math.min(100, Math.max(progress, progress === 0 ? 100 : progress))}%`,
            backgroundColor: barColor
          }}
        />
      </div>
      {progress >= 100 ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-sm" title="已完成">
          ✓
        </span>
      ) : progress === 0 ? (
        <span className="text-[10px] tabular-nums font-normal text-slate-400 dark:text-slate-500" title="未開始/無進度事件">
          未開始 (0%)
        </span>
      ) : (
        <span className="text-[10px] tabular-nums font-medium text-slate-600 dark:text-slate-300">
          {progress}%
        </span>
      )}
    </div>
  )
}

function BoxNodeView({ data }: NodeProps<TaskNode>) {
  const accentColor = getTypeColor(data.taskType, data.typeColor ?? data.color)
  return (
    <div
      className={cx(frameClass(data), 'h-full w-full bg-white dark:bg-slate-900 rounded-lg overflow-hidden border shadow-sm flex flex-col justify-start relative group/node')}
      style={{ borderColor: !data.focused && !data.blockedBy.length && !data.kin ? accentColor : undefined }}
    >
      <NodeHandles />
      <div className="h-1 rounded-t-lg shrink-0" style={{ backgroundColor: accentColor }} />
      
      <div className="px-2.5 py-2 shrink-0 flex flex-col justify-start">
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  data.onToggleContainer?.()
                }}
                className={cx(
                  'shrink-0 w-[58px] inline-flex items-center justify-center rounded py-0.5 text-[9px] font-medium transition-colors cursor-pointer border text-center select-none',
                  data.isContainerMode
                    ? 'bg-slate-100 text-slate-800 border-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-500'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                )}
                title={data.isContainerMode ? '【收納盒】點擊轉換回卡片' : '【卡片】點擊轉換為收納盒（允許其它卡片拖放進入內部）'}
              >
                {data.isContainerMode ? '📦 收納盒' : '📦 卡片'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  data.onOpenEditDrawer?.(data.id)
                }}
                className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer font-bold select-none"
                title="編輯詳細內容"
                aria-label="編輯詳細內容"
              >
                ✏️
              </button>
              <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                {data.ref}
              </span>
              <span
                className={cx(BADGE, 'shrink-0 border')}
                style={{
                  backgroundColor: `${accentColor}18`,
                  color: accentColor,
                  borderColor: `${accentColor}40`,
                }}
              >
                {getTypeName(data.taskType, data.typeName)}
              </span>
            </div>
          </div>

          <div className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-slate-800 dark:text-slate-100" title={data.title}>
            {data.title}
          </div>

          <NodeProgressBar progress={data.progress} accentColor={accentColor} />
        </div>
      </div>

      {data.isContainerMode && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={data.minSize?.w ? Math.ceil(data.minSize.w / 24) * 24 : 288}
          minHeight={data.minSize?.h ? Math.ceil(data.minSize.h / 24) * 24 : 96}
          className="!w-4 !h-4 !bottom-0.5 !right-0.5 !border-0 !bg-transparent"
        >
          <div
            className="w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 border border-slate-300/80 dark:border-slate-600/80 cursor-se-resize shadow-xs select-none"
            title="按住拖曳調整收納盒尺寸"
          >
            ↘
          </div>
        </NodeResizeControl>
      )}
    </div>
  )
}

function TaskNodeView({ data }: NodeProps<TaskNode>) {
  const accentColor = getTypeColor(data.taskType, data.typeColor ?? data.color)
  return (
    <div
      className={cx(frameClass(data), data.isContainerMode ? 'h-full w-full' : 'w-[288px] h-[96px]', 'bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden border flex flex-col justify-start relative group/node')}
      style={{ borderColor: !data.focused && !data.blockedBy.length && !data.kin ? accentColor : undefined }}
    >
      <NodeHandles />
      <div className="h-1 rounded-t-lg shrink-0" style={{ backgroundColor: accentColor }} />

      <div className="px-2.5 py-2 shrink-0 flex flex-col justify-start">
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1 overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data.onToggleContainer?.()
              }}
              className={cx(
                'shrink-0 w-[58px] inline-flex items-center justify-center rounded py-0.5 text-[9px] font-medium transition-colors cursor-pointer border text-center select-none',
                data.isContainerMode
                  ? 'bg-slate-100 text-slate-800 border-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-500'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              )}
              title={data.isContainerMode ? '【收納盒】點擊轉換回卡片' : '【卡片】點擊轉換為收納盒（允許其它卡片拖放進入內部）'}
            >
              {data.isContainerMode ? '📦 收納盒' : '📦 卡片'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data.onOpenEditDrawer?.(data.id)
              }}
              className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer font-bold select-none"
              title="編輯詳細內容"
              aria-label="編輯詳細內容"
            >
              ✏️
            </button>
            <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {data.ref}
            </span>
            <span
              className={cx(BADGE, 'shrink-0 border')}
              style={{
                backgroundColor: `${accentColor}18`,
                color: accentColor,
                borderColor: `${accentColor}40`,
              }}
            >
              {getTypeName(data.taskType, data.typeName)}
            </span>
            {data.showBadges && data.kin && (
              <span className={cx(BADGE, BADGE_VIOLET)}
                    title={data.kin === 'parent' ? G.badge.kinParentTaskTip : G.badge.kinChildTip}>
                {data.kin === 'parent' ? G.badge.kinParent : G.badge.kinChild}
              </span>
            )}
            {data.showBadges && data.isEntry && (
              <span className={cx(BADGE, BADGE_EMERALD)} title={G.badge.entryTaskTip}>
                {G.badge.entry}
              </span>
            )}
            {data.showBadges && data.blockedBy.length > 0 && (
              <span className={cx(BADGE, BADGE_RED)}
                    title={G.badge.blockedTip(data.blockedBy.join('、'))}>{G.badge.blocked}</span>
            )}
            {data.showBadges && data.problem && (
              <span className={cx(BADGE, BADGE_FUCHSIA)}
                    title={G.badge.problemTip(data.problem)}>{G.badge.problem}</span>
            )}
          </div>
        </div>

        <div className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-slate-800 dark:text-slate-100" title={data.title}>
          {data.title}
        </div>

        <NodeProgressBar progress={data.progress} accentColor={accentColor} />
      </div>

      {data.isContainerMode && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={data.minSize?.w ? Math.ceil(data.minSize.w / 24) * 24 : 288}
          minHeight={data.minSize?.h ? Math.ceil(data.minSize.h / 24) * 24 : 96}
          className="!w-4 !h-4 !bottom-0.5 !right-0.5 !border-0 !bg-transparent"
        >
          <div
            className="w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 border border-slate-300/80 dark:border-slate-600/80 cursor-se-resize shadow-xs select-none"
            title="按住拖曳調整收納盒尺寸"
          >
            ↘
          </div>
        </NodeResizeControl>
      )}
    </div>
  )
}

/**
 * 匯合點 —— 「同時開始」與「同時完成」不是兩張任務之間的一支箭頭。
 *
 * 兩張同一天起跑的任務，畫成 A →  B 就是在說 B 因為 A 才動；實際上它們是
 * **同一個時間點分出去的兩路**。所以這兩種依賴改畫成一個小圓點：
 *
 *   同時開始：一支箭頭進來 → 圓點 → 多支箭頭出去（分岔，放在該欄的左邊）
 *   同時完成：多支箭頭進來 → 圓點 → 一支箭頭出去（合流，放在該欄的右邊）
 *
 * 圓點放在群組的垂直中點，扇形自己會張開，不需要一根跟群組一樣高的直條
 * 去「連住」它們 —— 那條線看起來像另一種依賴，反而更難讀。
 *
 * 圓點**拖得動**（位置跟任務節點一樣記進 dragged，按「重新排列」放回算出來的位置）——
 * 整張圖只有它拖不動的話，使用者一定會以為是壞了。但它不是任務：不能選取、
 * 不能從它拉線、點兩下也開不出東西，它只是把「同時」這件事畫出來。
 */
type JunctionData = { kind: 'fork' | 'join'; dimmed: boolean }
type JunctionNode = Node<JunctionData, 'junction'>

function JunctionNodeView({ data }: NodeProps<JunctionNode>) {
  const fork = data.kind === 'fork'
  const color = SCHEDULING_COLOR[fork ? 'SS' : 'FF']
  return (
    <div className={cx('relative h-full w-full transition-opacity', data.dimmed && 'opacity-20')}
         title={fork ? G.junction.forkTip : G.junction.joinTip}>
      <Handle id={H_IN} type="target" position={Position.Left} isConnectable={false}
              className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      {/* 圓點本身只有 10px，縮小看的時候剩兩三個像素，滑鼠根本壓不到 ——
          往外墊一圈看不見的抓取範圍，拖的還是同一顆點 */}
      <div className="absolute -inset-2 cursor-grab" aria-hidden />
      {/* 白色外圈讓圓點在穿過它的線上仍然看得出來 */}
      <div className="h-full w-full rounded-full ring-2 ring-white dark:ring-slate-950"
           style={{ backgroundColor: color }} />
      {/* 圓點只有 10px 寬，字掛在下面才不會把線壓住。同樣用描邊代替白底方框 */}
      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap
                       text-[10px] leading-4"
            style={{
              color,
              textShadow: `0 0 3px ${HALO}, 0 0 3px ${HALO}, 0 0 3px ${HALO}`,
            }}>
        {fork ? G.junction.fork : G.junction.join}
      </span>
      <Handle id={H_OUT} type="source" position={Position.Right} isConnectable={false}
              className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </div>
  )
}

const nodeTypes = { task: TaskNodeView, box: BoxNodeView, junction: JunctionNodeView }

type FlowNode = TaskNode | JunctionNode

/** 任務編號補零，讓 PMF-7 排在 PMF-10 前面 */
function pad(ref: string): string {
  return ref.slice(ref.lastIndexOf('-') + 1).padStart(8, '0')
}

/**
 * 版面：大項目是一個框，它底下的任務排在框裡面。
 *
 * 為什麼是框而不是連一條「包含」線：使用者連問三次「這兩張到底什麼關係」。
 * 一條灰虛線得先看懂圖例才知道是階層，框不用 —— 東西在框裡面就是它的一部分。
 * 而且框本身還是一張任務，可以指向後續任務，「這一整包做完才能接下去」
 * 就變成一支從框拉出去的箭頭，那正是使用者要的表達方式。
 *
 * 每一層（最外層、以及每個框的裡面）都各自跑同一套排法：
 *
 *   最長路徑分層：排程類依賴由左往右流。任務相關不參與分層 ——
 *   它們不推動日期，讓它們影響 X 座標只會把「誰卡住誰」弄糊。
 *
 *   四種排程依賴裡只有兩種真的有先後。「同時開始」「同時完成」講的是
 *   兩張任務貼在時間軸的同一個點，把它們也算成往右一欄，畫出來會變成
 *   一條假的接力賽。所以先把「同時」連起來的任務併成同一欄，
 *   再拿「完成後開始」「開始後完成」去排欄與欄之間的先後。
 *
 * 跨層的依賴（框裡的任務指到框外面）不參與內層排序，但線照畫 ——
 * React Flow 的邊本來就跨得過父子邊界。
 */

/** 一般任務的尺寸 (288x96px，四個接點 100% 精確壓在 24px 背景網點陣列上) */
const LEAF_W = NODE_W
const LEAF_H = 96
/** 框的內距 (24px) 與標題列高度 (72px) */
const BOX_PAD = 24
const BOX_HEADER = 96

type Box = { w: number; h: number }

/**
 * 真的會畫成圓點的那幾群（見下面 simul 的說明）。
 * 佈局只需要知道「誰是成員、往左還是往右伸出去」，好在框裡把位置讓出來。
 */
type Hub = { kind: 'fork' | 'join'; members: string[] }

type LayoutResult = {
  /** 相對於「父框內容區」的位置。沒有父框的就是畫布座標 */
  rel: Map<string, { x: number; y: number }>
  /** 每個節點佔多大。框的尺寸是裡面排完之後算出來的 */
  size: Map<string, Box>
  /** 畫布上的絕對位置。匯合點要用（它掛在最外層） */
  abs: Map<string, { x: number; y: number }>
  /** 有小孩的任務＝框 */
  boxes: Set<string>
  /** 框裡直接放著幾張任務 */
  childCount: Map<string, number>
  /** 框裡面沒有同框上游的任務＝這一包的起點 */
  entries: Set<string>
}

function layout(
  ids: string[],
  parentOf: Map<string, string | null>,
  refOf: Map<string, string>,
  schedEdges: Array<{ sourceId: string; targetId: string; linkType: LinkType }>,
  hubs: Hub[],
  measuredRects?: Record<string, { width: number; height: number }>,
  allEdges?: Array<{ sourceId: string; targetId: string; linkType: LinkType }>,
  customBoxIds?: Set<string>,
  draggedOffsets?: Record<string, { x: number; y: number }>
): LayoutResult {
  const present = new Set(ids)
  const usable = schedEdges.filter(e => present.has(e.sourceId) && present.has(e.targetId))
  const allUsableEdges = (allEdges ?? schedEdges).filter(e => present.has(e.sourceId) && present.has(e.targetId))
  const isSimultaneous = (t: LinkType) => t === 'SS' || t === 'FF'

  /** 每個框底下有哪些任務。父層不在畫面上的（被篩掉了）算最外層 */
  const kidsOf = new Map<string | null, string[]>()
  for (const id of ids) {
    const p = parentOf.get(id)
    const key = p && present.has(p) ? p : null
    kidsOf.set(key, [...(kidsOf.get(key) ?? []), id])
  }
  const boxes = new Set([
    ...ids.filter(id => (kidsOf.get(id) ?? []).length > 0),
    ...Array.from(customBoxIds ?? []).filter(id => present.has(id))
  ])

  /** 任務在 ids 陣列中的原始順序索引，確保加入卡片時不會跳動重排 */
  const sortKey = new Map<string, number>()
  for (let i = 0; i < ids.length; i++) {
    sortKey.set(ids[i], i)
  }

  const rel = new Map<string, { x: number; y: number }>()
  const size = new Map<string, Box>()

  const getNodeH = (id: string) => even(Math.max(measuredRects?.[id]?.height ?? 0, measure(id).h))
  const getNodeW = (id: string) => Math.max(measuredRects?.[id]?.width ?? 0, measure(id).w)
  /** 實體 Handle 接點相對於節點左上角的垂直偏移量 (100% 垂直置中於節點邊線中心，且貼合 24px 網點) */
  const getHandleOffsetY = (id: string): number => getNodeH(id) / 2

  /** 這個節點多大：一般任務是固定尺寸，框要先把裡面排完才知道，若不夠大則自動放大最外框 */
  const measure = (id: string): Box => {
    const cached = size.get(id)
    if (cached) return cached
    const kids = kidsOf.get(id) ?? []
    const isContainerBox = boxes.has(id)
    let box: Box
    if (isContainerBox) {
      if (kids.length) {
        box = place(kids, true)
      } else {
        box = { w: LEAF_W, h: LEAF_H }
      }
    } else {
      box = { w: LEAF_W, h: LEAF_H }
    }
    size.set(id, box)
    return box
  }

  /** 一個子欄裡最寬的那個 */
  const colWidth = (col: string[]) =>
    col.reduce((w, id) => Math.max(w, getNodeW(id)), LEAF_W)

  const sortMembers = (members: string[]): string[] => {
    if (members.length <= 1) return members
    const itemSet = new Set(members)
    const inDegree = new Map<string, number>()
    const childrenMap = new Map<string, string[]>()
    for (const id of members) {
      inDegree.set(id, 0)
      childrenMap.set(id, [])
    }

    for (const e of usable) {
      if (itemSet.has(e.sourceId) && itemSet.has(e.targetId) && e.sourceId !== e.targetId) {
        childrenMap.get(e.sourceId)?.push(e.targetId)
        inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1)
      }
    }

    const compareRef = (a: string, b: string) => {
      const refA = refOf.get(a) ?? ''
      const refB = refOf.get(b) ?? ''
      return refA.localeCompare(refB, undefined, { numeric: true })
    }

    const roots = members.filter(id => (inDegree.get(id) ?? 0) === 0).sort(compareRef)
    const result: string[] = []
    const visited = new Set<string>()

    function dfs(id: string) {
      if (visited.has(id)) return
      visited.add(id)
      result.push(id)
      const nexts = (childrenMap.get(id) ?? [])
        .filter(nid => !visited.has(nid))
        .sort(compareRef)
      for (const nextId of nexts) {
        dfs(nextId)
      }
    }

    for (const rootId of roots) {
      dfs(rootId)
    }

    for (const id of members) {
      if (!visited.has(id)) {
        result.push(id)
      }
    }

    return result
  }

  /**
   * 把一組同層的任務排好，回傳它們佔掉的範圍。
   * 位置寫進 rel，相對於這一層的左上角。
   */
  function place(members: string[], isInsideBoxParam = false): Box {
    for (const id of members) measure(id)
    const inLevel = new Set(members)
    const isInsideBox = isInsideBoxParam || (members.length > 0 && !!parentOf.get(members[0]))
    const orderedMembers = members

    if (isInsideBox) {
      const assigned = new Map<string, { x: number; y: number }>()
      const occupiedSlots = new Set<number>()

      // 1. 若卡片在收納盒內有手動拖曳座標，先鎖定其相對座標並記錄佔用槽位索引
      for (const id of orderedMembers) {
        if (draggedOffsets?.[id]) {
          const posX = Math.max(24, Math.round(draggedOffsets[id].x / 24) * 24)
          const posY = Math.max(60, evenPos(Math.round(draggedOffsets[id].y / 48) * 48))
          assigned.set(id, { x: posX, y: posY })

          const cIdx = Math.max(0, Math.round((posX - 24) / 312))
          const rIdx = Math.max(0, Math.min(4, Math.round((posY - 60) / 120)))
          occupiedSlots.add(cIdx * 5 + rIdx)
        }
      }

      // 2. 對於未手動移動的卡片，從 Slot 0 開始依時序掃描第一個空白槽位 (Rule 2.B.3: y=60 + rIdx*120)
      let slotIdx = 0
      for (const id of orderedMembers) {
        if (!assigned.has(id)) {
          while (occupiedSlots.has(slotIdx)) {
            slotIdx++
          }
          const cIdx = Math.floor(slotIdx / 5)
          const rIdx = slotIdx % 5
          const defaultPos = { x: 24 + cIdx * 312, y: 60 + rIdx * 120 }
          assigned.set(id, defaultPos)
          occupiedSlots.add(slotIdx)
          slotIdx++
        }

        const pos = assigned.get(id)!
        rel.set(id, pos)
      }

      // 依據自動網格槽位容量計算外框尺寸，手動拖移卡片 100% 不拉大 layoutSize
      const totalCount = orderedMembers.length
      const cols = Math.ceil(Math.max(1, totalCount) / 5)
      const maxRows = Math.min(5, Math.max(1, totalCount))
      const gridW = Math.max(288, 24 + cols * 312)
      const gridH = Math.max(96, even(60 + maxRows * 120))

      return { w: gridW, h: gridH }
    }

    const colGap = isInsideBox ? 24 : COL_GAP - LEAF_W

    // ── 併欄（union-find）：同時開始／同時完成的併成一欄 ──
    const uf = new Map(members.map(id => [id, id]))
    const find = (id: string): string => {
      let root = id
      while (uf.get(root) !== root) root = uf.get(root)!
      for (let cur = id; uf.get(cur) !== root;) {
        const nx = uf.get(cur)!
        uf.set(cur, root)
        cur = nx
      }
      return root
    }
    for (const e of usable) {
      if (!isSimultaneous(e.linkType)) continue
      if (!inLevel.has(e.sourceId) || !inLevel.has(e.targetId)) continue
      const a = find(e.sourceId)
      const b = find(e.targetId)
      if (a !== b) uf.set(a, b)
    }

    // ── 欄與欄之間的先後 ──
    const cols = [...new Set(members.map(find))]
    const next = new Map<string, string[]>()
    const indeg = new Map<string, number>()
    for (const c of cols) { next.set(c, []); indeg.set(c, 0) }
    for (const e of usable) {
      if (isSimultaneous(e.linkType)) continue
      if (!inLevel.has(e.sourceId) || !inLevel.has(e.targetId)) continue
      const from = find(e.sourceId)
      const to = find(e.targetId)
      // 併欄之後兩端落在同一欄（A 同時開始 B、又 B 完成後開始 A）——
      // 這種矛盾後端擋環時擋不點，畫面上就當它沒有先後
      if (from === to) continue
      next.get(from)!.push(to)
      indeg.set(to, indeg.get(to)! + 1)
    }

    const layerOf = new Map<string, number>()
    const queue = cols.filter(c => indeg.get(c) === 0)
    for (const c of queue) layerOf.set(c, 0)
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i]
      for (const to of next.get(c)!) {
        layerOf.set(to, Math.max(layerOf.get(to) ?? 0, layerOf.get(c)! + 1))
        indeg.set(to, indeg.get(to)! - 1)
        if (indeg.get(to) === 0) queue.push(to)
      }
    }
    // 後端擋過環，照理不會有剩。真的有就統一放第 0 層 ——
    // 畫得出來比畫不出來重要，環本身在甘特頁會另外報
    for (const c of cols) if (!layerOf.has(c)) layerOf.set(c, 0)

    // 同一欄的要上下相鄰，不然「同時開始」的兩張會被別人插在中間
    const colKey = new Map<string, number>()
    for (const id of members) {
      const c = find(id)
      const k = sortKey.get(id) ?? 0
      if (!colKey.has(c) || k < colKey.get(c)!) colKey.set(c, k)
    }

    // 這一層裡跟誰都沒關係的沉到最下面：它們全部落在第 0 層，
    // 照編號排會插在最上面，看起來像整張圖的開頭，其實只是還沒被接上
    const connected = new Set<string>()
    for (const e of usable) {
      if (!inLevel.has(e.sourceId) || !inLevel.has(e.targetId)) continue
      connected.add(e.sourceId)
      connected.add(e.targetId)
    }

    const byLayer = new Map<number, string[]>()
    for (const id of members) {
      const l = layerOf.get(find(id))!
      byLayer.set(l, [...(byLayer.get(l) ?? []), id])
    }

    const NODE_V_GAP = 24 // 節點與框之間的垂直留白距離，確保 100% 貼合 24px 網點

    /** 計算任意節點在畫布上的絕對 Y 座標（包含跨層框體與內部任務位移） */
    const getAbsCanvasY = (id: string): number | null => {
      const r = rel.get(id)
      if (!r) return null
      let p = parentOf.get(id)
      let py = 0
      while (p && present.has(p)) {
        const pr = rel.get(p)
        if (pr) {
          py += pr.y + BOX_HEADER
          p = parentOf.get(p) ?? null
        } else {
          break
        }
      }
      return py + r.y
    }

    let x = 0
    let maxBottom = 0
    for (const l of [...byLayer.keys()].sort((a, b) => a - b)) {
      // 算出每一個節點對應已有位置之關聯節點的首選 Y 座標 (精確支援跨大項目框與單一任務點對點對齊)
      const getUpstreamY = (id: string): number | null => {
        const connectedEdges = allUsableEdges.filter(
          e => (e.targetId === id && getAbsCanvasY(e.sourceId) !== null) ||
               (e.sourceId === id && getAbsCanvasY(e.targetId) !== null)
        )
        if (connectedEdges.length === 0) return null
        const candidateYs = connectedEdges.map(e => {
          const otherId = e.targetId === id ? e.sourceId : e.targetId
          const otherAbsY = getAbsCanvasY(otherId)!
          const otherHandleY = otherAbsY + getHandleOffsetY(otherId)
          const idealAbsY = otherHandleY - getHandleOffsetY(id)

          let p = parentOf.get(id)
          let py = 0
          while (p && present.has(p)) {
            const pr = rel.get(p)
            if (pr) {
              py += pr.y + BOX_HEADER
              p = parentOf.get(p) ?? null
            } else {
              break
            }
          }
          return idealAbsY - py
        })
        return Math.min(...candidateYs)
      }

      // 將 bucket 裡的節點照併欄 (find(id)) 分群
      const groupsInLayer: string[][] = []
      const groupMap = new Map<string, string[]>()
      for (const id of byLayer.get(l)!) {
        const root = find(id)
        const g = groupMap.get(root)
        if (g) g.push(id)
        else {
          const newG = [id]
          groupMap.set(root, newG)
          groupsInLayer.push(newG)
        }
      }

      // 排序分群：優先依照上游 Y 座標（upstreamY）升序對齊，確保關聯鏈點跟點 100% 平行對齊
      groupsInLayer.sort((grpA, grpB) => {
        let minYA: number | null = null
        for (const id of grpA) {
          const uy = getUpstreamY(id)
          if (uy !== null && (minYA === null || uy < minYA)) minYA = uy
        }

        let minYB: number | null = null
        for (const id of grpB) {
          const uy = getUpstreamY(id)
          if (uy !== null && (minYB === null || uy < minYB)) minYB = uy
        }

        if (minYA !== null && minYB !== null) return minYA - minYB
        if (minYA !== null) return -1
        if (minYB !== null) return 1

        const ca = colKey.get(find(grpA[0])) ?? 0
        const cb = colKey.get(find(grpB[0])) ?? 0
        return ca !== cb
          ? ca - cb
          : (sortKey.get(grpA[0]) ?? 0) - (sortKey.get(grpB[0]) ?? 0)
      })

      // 這一層折成幾個子欄。按 idealY 點對點對齊，任何在當前欄位會與現有節點重疊的 group，自動向右開啟新子欄
      const columns: string[][][] = [[]]

      for (const grp of groupsInLayer) {
        let idealY: number | null = null
        for (const id of grp) {
          const uy = getUpstreamY(id)
          if (uy !== null && (idealY === null || uy < idealY)) idealY = uy
        }

        let assignedColIndex = -1
        if (idealY !== null) {
          const grpH = grp.reduce((acc, id) => acc + getNodeH(id) + NODE_V_GAP, 0)
          for (let c = 0; c < columns.length; c++) {
            let colOverlaps = false
            for (const existingGrp of columns[c]) {
              for (const exId of existingGrp) {
                const exY = rel.get(exId)?.y
                if (exY !== undefined) {
                  const exH = getNodeH(exId)
                  if (
                    idealY! < exY + exH + NODE_V_GAP &&
                    idealY! + grpH + NODE_V_GAP > exY
                  ) {
                    colOverlaps = true
                    break
                  }
                }
              }
              if (colOverlaps) break
            }
            if (!colOverlaps) {
              assignedColIndex = c
              break
            }
          }
        }

        if (assignedColIndex >= 0) {
          columns[assignedColIndex].push(grp)
        } else {
          // 預設一欄最多放置 5 張事件卡片；滿 5 張即自動向右開啟第二欄 (排) 繼續向下延伸
          let targetCol = 0
          while (targetCol < columns.length && columns[targetCol].length >= 5) {
            targetCol++
          }
          if (targetCol >= columns.length) {
            columns.push([grp])
          } else {
            columns[targetCol].push(grp)
          }
        }
      }

      let widest = 0
      let colX = x

      for (const col of columns) {
        // 在這個 column 內擺放各個 group，點對點完全水平對齊上游任務的 Y 座標
        const usedYInCol = new Set<number>()

        for (const grp of col) {
          let idealY: number | null = null
          for (const id of grp) {
            const uy = getUpstreamY(id)
            if (uy !== null && (idealY === null || uy < idealY)) idealY = uy
          }

          let startY = idealY ?? 0

          const overlaps = (candidateY: number) => {
            let yCursor = candidateY
            for (const id of grp) {
              const h = getNodeH(id)
              for (let checkY = Math.floor(yCursor); checkY < Math.ceil(yCursor + h + NODE_V_GAP); checkY += 8) {
                if (usedYInCol.has(checkY)) return true
              }
              yCursor += h + NODE_V_GAP
            }
            return false
          }

          while (overlaps(startY)) {
            startY += 24
          }

          let yCursor = startY
          for (const id of grp) {
            const snappedY = Math.round(yCursor / 24) * 24
            rel.set(id, { x: Math.round(colX / 24) * 24, y: snappedY })
            const h = getNodeH(id)
            for (let markY = Math.floor(yCursor); markY < Math.ceil(yCursor + h + NODE_V_GAP); markY += 8) {
              usedYInCol.add(markY)
            }
            yCursor += h + NODE_V_GAP
          }
          maxBottom = Math.max(maxBottom, yCursor - NODE_V_GAP)
        }

        const w = colWidth(col.flat())
        widest = Math.max(widest, colX - x + w)
        colX += w + colGap
      }

      x += Math.max(widest, LEAF_W) + colGap
    }

    // ── 水平 Y 軸對齊校正 (在 100% 絕不重疊前提下對齊中心 Y 軸) ──
    for (let pass = 0; pass < 3; pass++) {
      for (const e of allUsableEdges) {
        if (!inLevel.has(e.sourceId) || !inLevel.has(e.targetId)) continue
        const srcPos = rel.get(e.sourceId)
        const tgtPos = rel.get(e.targetId)
        if (!srcPos || !tgtPos) continue

        const srcHandleY = srcPos.y + getHandleOffsetY(e.sourceId)
        const tgtHandleY = tgtPos.y + getHandleOffsetY(e.targetId)

        if (Math.abs(srcHandleY - tgtHandleY) > 0.5) {
          const alignedTgtY = Math.round((srcHandleY - getHandleOffsetY(e.targetId)) / 24) * 24
          
          // 檢查改至 alignedTgtY 是否會跟同層/同欄的其他節點重疊遮擋 (採用真實 2D AABB 矩形防撞檢測)
          let collides = false
          const tgtW = getNodeW(e.targetId)
          const tgtH = getNodeH(e.targetId)

          for (const otherId of members) {
            if (otherId === e.targetId) continue
            const otherPos = rel.get(otherId)
            if (!otherPos) continue
            const otherW = getNodeW(otherId)
            const otherH = getNodeH(otherId)

            const xOverlap = tgtPos.x < otherPos.x + otherW && tgtPos.x + tgtW > otherPos.x
            const yOverlap = alignedTgtY < otherPos.y + otherH + NODE_V_GAP && alignedTgtY + tgtH + NODE_V_GAP > otherPos.y

            if (xOverlap && yOverlap) {
              collides = true
              break
            }
          }

          if (!collides) {
            rel.set(e.targetId, { x: tgtPos.x, y: alignedTgtY })
          }
        }
      }
    }

    /**
     * 匯合點的留白。
     *
     * 圓點畫在成員的外側 —— 分岔在左、合流在右。成員之間本來就有欄距（84px）
     * 放得下，但排在這一層最左邊（或最右邊）的那一欄沒有，圓點就會掉到
     * 框外面去。這裡把那一段寬度讓出來，圓點才落得進它成員所屬的那個框裡。
     *
     * 只有真的會畫出來的那幾群要算（hubs）—— 退回成直線的那幾群沒有圓點，
     * 留白只會讓框莫名其妙變寬。
     */
    let lead = 0
    let tail = 0
    for (const g of hubs) {
      for (const m of g.members) {
        const r = rel.get(m)
        if (!inLevel.has(m) || !r) continue
        if (g.kind === 'fork') lead = Math.max(lead, JUNCTION_SPAN - r.x)
        else tail = Math.max(tail, r.x + measure(m).w + JUNCTION_SPAN)
      }
    }
    if (lead > 0) {
      const leadSnap = Math.ceil(lead / 24) * 24
      for (const id of members) {
        const r = rel.get(id)!
        rel.set(id, { x: r.x + leadSnap, y: r.y })
      }
      tail += leadSnap
    }

    return { w: Math.max(x - colGap + lead, tail, 0), h: maxBottom }
  }

  place(kidsOf.get(null) ?? [])

  // React Flow 的子節點座標是「相對於父節點的左上角」，不是相對於框的內容區。
  // 排版時是照內容區算的，所以這裡把標題列與內距補回去 ——
  // 少了這一步，第一張子任務會直接蓋在框的標題上。
  for (const [parent, kids] of kidsOf) {
    if (!parent) continue
    for (const k of kids) {
      const r = rel.get(k)
      if (r) rel.set(k, { x: r.x + BOX_PAD, y: r.y + BOX_HEADER })
    }
  }

  // 匯合點掛在最外層，要的是畫布座標 —— 把每一層的位移一路加上來
  const abs = new Map<string, { x: number; y: number }>()
  const walk = (id: string, ox: number, oy: number) => {
    const r = rel.get(id) ?? { x: 0, y: 0 }
    const x = ox + r.x
    const y = oy + r.y
    abs.set(id, { x, y })
    for (const k of kidsOf.get(id) ?? []) walk(k, x, y)
  }
  const refreshAbs = () => {
    abs.clear()
    for (const id of kidsOf.get(null) ?? []) walk(id, 0, 0)
  }
  refreshAbs()

  const getRootParent = (id: string): string => {
    let root = id
    let p = parentOf.get(root)
    while (p && present.has(p)) {
      root = p
      p = parentOf.get(root)
    }
    return root
  }

  // ── 全局畫布階層對齊校正 (Global Grid-First Handle Y-Center Alignment Pass) ──
  // 確保無論是框對框、框對任務、還是跨大項目框/子功能任務之間的連結點，100% 處於同一條水平 Y 軸線上，且在不碰撞前提下對齊
  for (let pass = 0; pass < 5; pass++) {
    for (const e of allUsableEdges) {
      const srcAbs = abs.get(e.sourceId)
      const tgtAbs = abs.get(e.targetId)
      if (!srcAbs || !tgtAbs) continue

      const srcHandleY = srcAbs.y + getHandleOffsetY(e.sourceId)
      const tgtHandleY = tgtAbs.y + getHandleOffsetY(e.targetId)
      const rawDiffY = srcHandleY - tgtHandleY

      if (Math.abs(rawDiffY) > 0.5) {
        const diffY = Math.round(rawDiffY / 24) * 24
        if (diffY !== 0) {
          const rootSourceId = getRootParent(e.sourceId)
          const rootTargetId = getRootParent(e.targetId)

          if (rootSourceId !== rootTargetId) {
            // 跨根框連線：移動目標的根外框，前提是絕對不與畫布上其他根節點 (Root Nodes) 重疊遮擋
            const tgtRel = rel.get(rootTargetId)
            if (tgtRel) {
              const newRootY = tgtRel.y + diffY
              const rootW = getNodeW(rootTargetId)
              const rootH = getNodeH(rootTargetId)

              let collides = false
              const rootNodes = kidsOf.get(null) ?? []
              for (const otherRootId of rootNodes) {
                if (otherRootId === rootTargetId) continue
                const otherRel = rel.get(otherRootId)
                if (!otherRel) continue
                const otherW = getNodeW(otherRootId)
                const otherH = getNodeH(otherRootId)

                const xOverlap = tgtRel.x < otherRel.x + otherW && tgtRel.x + rootW > otherRel.x
                const yOverlap = newRootY < otherRel.y + otherH + BOX_PAD && newRootY + rootH + BOX_PAD > otherRel.y

                if (xOverlap && yOverlap) {
                  collides = true
                  break
                }
              }

              if (!collides) {
                rel.set(rootTargetId, { x: tgtRel.x, y: newRootY })
                refreshAbs()
              }
            }
          } else {
            // 同根框內外連線：不移動最外框，僅在不與框內同層夥伴碰撞的前提下微調 target
            const tgtRel = rel.get(e.targetId)
            if (tgtRel && parentOf.get(e.targetId) != null) {
              const parentId = parentOf.get(e.targetId)!
              const siblings = kidsOf.get(parentId) ?? []
              const newY = tgtRel.y + diffY
              const tgtW = getNodeW(e.targetId)
              const tgtH = getNodeH(e.targetId)

              let collides = false
              for (const sibId of siblings) {
                if (sibId === e.targetId) continue
                const sibRel = rel.get(sibId)
                if (!sibRel) continue
                const sibW = getNodeW(sibId)
                const sibH = getNodeH(sibId)

                const xOverlap = tgtRel.x < sibRel.x + sibW && tgtRel.x + tgtW > sibRel.x
                const yOverlap = newY < sibRel.y + sibH + 24 && newY + tgtH + 24 > sibRel.y

                if (xOverlap && yOverlap) {
                  collides = true
                  break
                }
              }

              if (!collides) {
                rel.set(e.targetId, { x: tgtRel.x, y: newY })
                refreshAbs()
              }
            }
          }
        }
      }
    }
  }

  // ── 依據內部對齊後的節點靜態位置計算外框大小 (`size`) ──
  // 不計入即時拖曳座標 (draggedOffsets)，確保拖曳卡片時框體尺寸絕對固定，卡片往右/向下拖移可順暢移出框外
  for (const bId of boxes) {
    size.set(bId, { w: 288, h: 96 })
  }

  refreshAbs()

  const childCount = new Map<string, number>()
  for (const id of boxes) childCount.set(id, (kidsOf.get(id) ?? []).length)

  // 框裡的起點：同一個框底下有排程依賴時，指明「這一包從這幾張開始」。
  // 若框內完全沒有任何關聯線，則不顯示「入口起點」警示徽章，避免無謂的畫面干擾。
  const entries = new Set<string>()
  for (const [parent, kids] of kidsOf) {
    if (!parent || kids.length < 2) continue
    const inBox = new Set(kids)
    const hasUpstream = new Set<string>()
    let hasInBoxLinks = false
    for (const e of usable) {
      if (inBox.has(e.sourceId) && inBox.has(e.targetId)) {
        hasUpstream.add(e.targetId)
        hasInBoxLinks = true
      }
    }
    if (hasInBoxLinks) {
      for (const k of kids) if (!hasUpstream.has(k)) entries.add(k)
    }
  }
return { rel, size, abs, boxes, childCount, entries }
}

export default function GraphView(props: {
  projectId: string
  tasks: Task[]
  statuses: TaskStatus[]
  types?: ProjectParam[]
  onOpen: (id: string) => void
  focusedTaskId?: string | null
}) {
  // useReactFlow（fitView / zoom）必須在 Provider 底下才拿得到
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  )
}

function GraphCanvas({
  projectId, tasks, statuses, types, onOpen, focusedTaskId,
}: {
  projectId: string
  tasks: Task[]
  statuses: TaskStatus[]
  types?: ProjectParam[]
  onOpen: (id: string) => void
  focusedTaskId?: string | null
}) {
  const qc = useQueryClient()
  const { unreadTaskIds, markTaskRead } = useUnreadNotifications()
  const { fitView, getViewport, setViewport, screenToFlowPosition } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  // 背景點陣的顏色是 SVG 屬性，吃不到 CSS 變數，只能自己看現在是哪一個主題
  const dark = useTheme().resolved === 'dark'

  /** 使用者拖過的節點位置。按專案 projectId 持久化於 localStorage */
  const [dragged, setDragged] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_graph_dragged_${projectId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  /** 使用者手動調整大小的框。按專案 projectId 持久化於 localStorage */
  const [resized, setResized] = useState<Record<string, { width: number; height: number }>>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_graph_resized_${projectId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  /** 樂觀 UI 覆蓋 parentId，解鎖 API 非同步傳輸期間的座標與圖像卡片彈射消失 Bug */
  const [parentOverrides, setParentOverrides] = useState<Record<string, string | null>>({})

  // 切換專案時自動載入該專案的持久化位置
  useEffect(() => {
    try {
      const savedD = localStorage.getItem(`pmflow_graph_dragged_${projectId}`)
      setDragged(savedD ? JSON.parse(savedD) : {})
      const savedR = localStorage.getItem(`pmflow_graph_resized_${projectId}`)
      setResized(savedR ? JSON.parse(savedR) : {})
    } catch {
      setDragged({})
      setResized({})
    }
  }, [projectId])

  // 每次拖曳移位自動寫入 localStorage 保存
  useEffect(() => {
    if (!projectId) return
    try {
      if (Object.keys(dragged).length > 0) {
        localStorage.setItem(`pmflow_graph_dragged_${projectId}`, JSON.stringify(dragged))
      } else {
        localStorage.removeItem(`pmflow_graph_dragged_${projectId}`)
      }
    } catch {
      // ignore
    }
  }, [dragged, projectId])

  // 每次調整大小自動寫入 localStorage 保存
  useEffect(() => {
    if (!projectId) return
    try {
      if (Object.keys(resized).length > 0) {
        localStorage.setItem(`pmflow_graph_resized_${projectId}`, JSON.stringify(resized))
      } else {
        localStorage.removeItem(`pmflow_graph_resized_${projectId}`)
      }
    } catch {
      // ignore
    }
  }, [resized, projectId])
  /**
   * React Flow 量到的節點尺寸。這個一定要自己收好再疊回節點上。
   *
   * 節點是每次 render 重算的（見下面 baseNodes / styledNodes），而 React Flow
   * 收到新的 nodes 陣列時是「照著 node.measured 重建內部尺寸」—— 我們給的物件
   * 沒有 measured，等於每次 render 都把它剛量到的尺寸抹成 undefined。結果是
   * 節點永遠停在量測前的 visibility:hidden、nodesInitialized 永遠是 false，
   * fitView 也就永遠等不到。
   */
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (focusedTaskId !== undefined) {
      setFocusId(focusedTaskId)
    }
  }, [focusedTaskId])
  /** 排程依賴（FS / SS / FF / SF 實線）要不要畫 */
  const [showSchedLines, setShowSchedLines] = useState(true)
  /** 任務相關（相關／阻擋／重複於／需要）那幾條線要不要畫 */
  const [showRelated, setShowRelated] = useState(true)
  /** 連線上的標籤文字要不要顯示 (持久化於 localStorage) */
  const [showEdgeLabels, setShowEdgeLabels] = useState(() => {
    const saved = localStorage.getItem('pmflow_graph_show_edge_labels')
    return saved !== null ? saved === 'true' : true
  })
  /** 任務卡片與框內部的警示標籤要不要顯示 (預設強制隱藏) */
  const [showBadges, setShowBadges] = useState(true)
  const [showLegendPopover, setShowLegendPopover] = useState(false)
  const legendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleLegendPopover = () => {
    if (showLegendPopover) {
      if (legendTimerRef.current) clearTimeout(legendTimerRef.current)
      setShowLegendPopover(false)
    } else {
      if (legendTimerRef.current) clearTimeout(legendTimerRef.current)
      setShowLegendPopover(true)
      legendTimerRef.current = setTimeout(() => {
        setShowLegendPopover(false)
      }, 5000)
    }
  }

  useEffect(() => {
    localStorage.setItem('pmflow_graph_show_edge_labels', String(showEdgeLabels))
  }, [showEdgeLabels])

  useEffect(() => {
    localStorage.setItem('pmflow_graph_show_badges', String(showBadges))
  }, [showBadges])

  // Esc 鍵一鍵解除所有選取 (Rule 1.2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds({})
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  /** 開著時左鍵是拉框選取，不是平移畫面 */
  const [boxSelect, setBoxSelect] = useState(false)
  /** 按「重新排列」時 +1，把拖亂的節點放回自動佈局的位置 */
  const [relayout, setRelayout] = useState(0)
  const [newLinkType, setNewLinkType] = useState<LinkType>('FS')
  const [containerBoxIds, setContainerBoxIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('pmflow_graph_container_boxes')
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })


  const [error, setError] = useState<string | null>(null)
  /** 按過「全部顯示」或「重新排列」，要求即使節點沒變也重新框一次 */
  const fitPending = useRef(false)
  /** 上一次框過的節點集合，用來判斷「換資料了，該重新框」 */
  const lastFitKey = useRef('')
  /** 已經替哪個專案畫過第一張圖了。換專案才算是「新的一張圖」 */
  const fittedProject = useRef<string | null>(null)
  /**
   * 使用者自己平移縮放、拖過節點或拉過框之後，就不要再自動搶走他的視角。
   *
   * 只有兩種情況會把它歸零：換了專案（那是新的一張圖，他還沒表達過視角），
   * 以及他自己按「全部顯示」／「重新排列」（那本來就是在要全景）。
   * **千萬不要**在每次重新佈局時歸零 —— 之前就是那樣寫的，結果背景重抓資料、
   * 或側欄換個篩選，畫面就把他放大看的地方硬拉回全景。
   */
  const userAdjusted = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const justDroppedUntilRef = useRef<Record<string, number>>({})

  const { data: graph, isLoading } = useQuery({
    queryKey: ['graph', projectId],
    queryFn: () => Api.graph(projectId),
  })

  /**
   * 相依刻意用「攤平成字串的內容」而不是 statuses 陣列本身。
   *
   * 上層傳進來的是 `project?.statuses ?? []`，每次 render 都是一個新陣列。
   * 直接依賴它的話 statusColor 每次都是新函式，styledNodes 跟著每次都產生
   * 全新的節點物件，React Flow 會一直把節點當成新的、反覆重新量測，結果是
   * 節點永遠停在 visibility:hidden（量到之前它會先藏起來），連帶 fitView
   * 也永遠等不到 nodesInitialized。這個 bug 表現成「有時候正常、有時候整張圖
   * 縮不起來還被切掉」，很難看出來跟顏色有關。
   */
  const statusColorKey = statuses.map(s => `${s.key}:${s.color}`).join('|')
  const statusColor = useMemo(() => {
    const m = new Map(statuses.map(s => [s.key, s.color]))
    return (key: string) => m.get(key) ?? '#94a3b8'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusColorKey])

  const typeColorKey = (types ?? []).map(t => `${t.key}:${t.color}`).join('|')
  const typeColorMap = useMemo(() => {
    const m = new Map<string, string>()
    m.set('EPIC', '#d97706')      // 大項目 (琥珀橘)
    m.set('TASK', '#3178c6')      // 任務 (經典藍)
    m.set('BUG', '#dc2626')       // 問題 (鮮紅)
    m.set('MILESTONE', '#8b5cf6') // 里程碑 (紫羅蘭)
    for (const t of (types ?? [])) {
      if (t.color) m.set(t.key, t.color)
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeColorKey])

  const typeNameKey = (types ?? []).map(t => `${t.key}:${t.name}`).join('|')
  const typeNameMap = useMemo(() => {
    const m = new Map<string, string>()
    m.set('EPIC', '大項目')
    m.set('TASK', '事件')
    m.set('BUG', '問題')
    m.set('MILESTONE', '里程碑')
    for (const t of (types ?? [])) {
      if (t.name) m.set(t.key, t.name)
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeNameKey])

  // 側欄選了大項目時，主視圖只顯示那棵子樹 —— 關聯圖跟其他視圖看同一份 tasks，
  // 免得「清單看到 5 張、關聯圖卻畫出 40 張」這種對不起來的情況。
  const visibleIds = useMemo(() => new Set(tasks.map(t => t.id)), [tasks])

  const shownNodes = useMemo(
    () => (graph?.nodes ?? []).filter(n => visibleIds.has(n.id)),
    [graph, visibleIds]
  )

  const schedEdges = useMemo(
    () => (graph?.edges ?? []).filter(
      e => isScheduling(e.linkType) && visibleIds.has(e.sourceId) && visibleIds.has(e.targetId)
    ),
    [graph, visibleIds]
  )

  /**
   * Ref: CR-005 (同時開始/同時完成匯合點收納與 hub 校驗機制，詳見 CHANGELOG.md)
   */
  const simul = useMemo(() => {
    const groups: Array<{
      id: string; kind: 'fork' | 'join'; members: string[]; hub: boolean
    }> = []
    const forkOf = new Map<string, (typeof groups)[number]>()
    const joinOf = new Map<string, (typeof groups)[number]>()

    // 1. 同時開始 (Fork / SS): 必須是「一個任務 (source) 指向 2 個 (含) 以上的任務 (targets.length >= 2)」
    const ssBySource = new Map<string, string[]>()
    for (const e of schedEdges) {
      if (e.linkType === 'SS') {
        ssBySource.set(e.sourceId, [...(ssBySource.get(e.sourceId) ?? []), e.targetId])
      }
    }
    for (const [sourceId, targets] of ssBySource) {
      if (targets.length >= 2) {
        const members = [sourceId, ...targets]
        const ms = new Set(members)
        const hub = schedEdges.some(e => ms.has(e.targetId) && !ms.has(e.sourceId))
        const g = { id: `fork:${sourceId}`, kind: 'fork' as const, members, hub }
        groups.push(g)
        for (const m of members) forkOf.set(m, g)
      }
    }

    // 2. 同時結束 (Join / FF): 必須是「2 個 (含) 以上的任務 (sources) 指向一個任務 (sources.length >= 2)」
    const ffByTarget = new Map<string, string[]>()
    for (const e of schedEdges) {
      if (e.linkType === 'FF') {
        ffByTarget.set(e.targetId, [...(ffByTarget.get(e.targetId) ?? []), e.sourceId])
      }
    }
    for (const [targetId, sources] of ffByTarget) {
      if (sources.length >= 2) {
        const members = [...sources, targetId]
        const ms = new Set(members)
        const hub = schedEdges.some(e => ms.has(e.sourceId) && !ms.has(e.targetId))
        const g = { id: `join:${targetId}`, kind: 'join' as const, members, hub }
        groups.push(g)
        for (const m of members) joinOf.set(m, g)
      }
    }

    return { groups, hubs: groups.filter(g => g.hub), forkOf, joinOf }
  }, [schedEdges])

  /**
   * 佈局：只在節點集合或排程依賴變動時重算。
   *
   * 這個 effect 的相依刻意只有這幾項。顏色、聚焦、圖層開關都不能放進來 ——
   * setNodes 會把 position 一起蓋掉，使用者拖過的位置就沒了。上層傳進來的
   * statuses 是 `project?.statuses ?? []`，每次 render 都是新陣列，放進相依
   * 等於「父層一 render 就把版面洗掉」。所以顏色改在 styledNodes 那邊算。
   */
  const { baseNodes, layoutAbs, layoutRel, layoutSize } = useMemo(() => {
    const present = new Set(shownNodes.map(n => n.id))
    const getEffectiveParent = (id: string): string | null => {
      const p = parentOverrides[id]
      return p !== undefined ? (p ?? null) : (shownNodes.find(n => n.id === id)?.parentId ?? null)
    }

    const parentOf = new Map(shownNodes.map(n => [n.id, getEffectiveParent(n.id)]))
    const refOf = new Map(shownNodes.map(n => [n.id, n.ref]))
    const L = layout(shownNodes.map(n => n.id), parentOf, refOf, schedEdges, simul.hubs, measured, graph?.edges, containerBoxIds, dragged)

    const nodes: TaskNode[] = shownNodes.map(n => {
      const isBox = L.boxes.has(n.id)
      const pId = getEffectiveParent(n.id)
      const parent = pId && present.has(pId) ? pId : undefined
      const size = L.size.get(n.id)
      return {
        id: n.id,
        type: 'task',
        position: L.rel.get(n.id) ?? { x: 0, y: 0 },
        // Ref: CR-086 — 有父框時解鎖 extent 限制，允許自由穿透框線拖移離框
        extent: [[-100000, -100000], [100000, 100000]],
        ...(parent ? { parentId: parent } : {}),
        // 框的大小是算出來的，直接告訴 React Flow，不要等它量
        ...(isBox && size
          ? {
              style: { width: size.w, height: size.h },
              measured: { width: size.w, height: size.h },
            }
          : {}),
        data: {
          id: n.id,
          ref: n.ref,
          title: n.title,
          statusKey: n.statusKey,
          taskType: n.type ?? 'TASK',
          color: '#94a3b8',        // 佔位，實際顏色在 styledNodes 補
          progress: n.progress ?? 0,
          inquiryState: n.inquiryState,
          isEpic: n.type === 'EPIC',
          isContainerMode: isBox || containerBoxIds.has(n.id),
          onToggleContainer: () => toggleContainerMode(n.id),
          onOpenEditDrawer: onOpen,
          childCount: L.childCount.get(n.id) ?? 0,
          isEntry: L.entries.has(n.id),
          isBug: n.type === 'BUG',
          isMilestone: n.type === 'MILESTONE',
          dimmed: false,
          focused: false,
          kin: null,
          blockedBy: [],           // 佔位，實際內容在 styledNodes 補
          // 問題是任務身上就有的欄位，不像卡住要看整張圖才算得出來，
          // 所以在這裡直接放進去，不必等 styledNodes
          problem: n.problem,
          parallel: NO_PARALLEL,
          // 算出來的尺寸同時是「往內縮的下限」，交給 NodeResizer 當 minWidth／minHeight
          minSize: isBox && size ? size : null,
        },
      }
    })

    // React Flow 要求父節點排在子節點前面，不然子節點的座標會對不上
    const depth = (id: string) => {
      let d = 0
      let cur = parentOf.get(id)
      while (cur && present.has(cur) && d < 20) { d++; cur = parentOf.get(cur) }
      return d
    }
    nodes.sort((a, b) => depth(a.id) - depth(b.id))

    return { baseNodes: nodes, layoutAbs: L.abs, layoutRel: L.rel, layoutSize: L.size }
  }, [shownNodes, schedEdges, simul, measured, graph, containerBoxIds, dragged, parentOverrides])

  const nodeKey = useMemo(() => baseNodes.map(n => n.id).join(','), [baseNodes])

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    const dims: Record<string, { width: number; height: number }> = {}
    const sizes: Record<string, { width: number; height: number }> = {}

    for (const c of changes) {
      if (c.type === 'dimensions' && c.dimensions) {
        if (c.resizing === undefined) dims[c.id] = c.dimensions
        else sizes[c.id] = {
          width: Math.round(c.dimensions.width / 24) * 24,
          height: Math.round(c.dimensions.height / 24) * 24,
        }
      }
    }
    if (Object.keys(sizes).length) {
      userAdjusted.current = true
      setResized(r => ({ ...r, ...sizes }))
    }
    if (Object.keys(dims).length) {
      setMeasured(m => {
        const changed = Object.entries(dims).some(
          ([id, d]) => m[id]?.width !== d.width || m[id]?.height !== d.height
        )
        return changed ? { ...m, ...dims } : m
      })
    }
  }, [])

  useEffect(() => {
    if (!nodesInitialized || !baseNodes.length) return
    const fresh = fittedProject.current !== projectId
    const asked = fitPending.current

    fittedProject.current = projectId
    lastFitKey.current = nodeKey

    if (asked) {
      fitPending.current = false
      userAdjusted.current = false
      try {
        localStorage.removeItem(`pmflow_graph_viewport_${projectId}`)
      } catch {}
      fitView(FIT_OPTIONS)
      return
    }

    // 嘗試還原使用者上次離開關聯圖時的焦點位置與縮放比率 (x, y, zoom)
    try {
      const savedV = localStorage.getItem(`pmflow_graph_viewport_${projectId}`)
      if (savedV) {
        const vp = JSON.parse(savedV)
        if (vp && typeof vp.x === 'number' && typeof vp.y === 'number' && typeof vp.zoom === 'number') {
          setViewport(vp, { duration: 0 })
          userAdjusted.current = true
          return
        }
      }
    } catch {}

    if (fresh || !userAdjusted.current) {
      fitView(FIT_OPTIONS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesInitialized, nodeKey, baseNodes.length, projectId, fitView, setViewport])

  const zoomBy = useCallback((factor: number) => {
    const el = wrapperRef.current
    const { x, y, zoom } = getViewport()
    const next = Math.min(2, Math.max(0.15, zoom * factor))
    if (next === zoom) return
    userAdjusted.current = true
    const cx = (el?.clientWidth ?? 0) / 2
    const cy = (el?.clientHeight ?? 0) / 2
    const newVp = { x: cx - ((cx - x) / zoom) * next, y: cy - ((cy - y) / zoom) * next, zoom: next }
    setViewport(newVp, { duration: 150 })
    if (projectId) {
      try {
        localStorage.setItem(`pmflow_graph_viewport_${projectId}`, JSON.stringify(newVp))
      } catch {}
    }
  }, [getViewport, setViewport, projectId])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (userAdjusted.current) return
      try {
        if (localStorage.getItem(`pmflow_graph_viewport_${projectId}`)) return
      } catch {}
      if (el.clientWidth === 0 || el.clientHeight === 0) return
      fitView(FIT_OPTIONS)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitView, projectId])

  const statusCatKey = statuses.map(s => `${s.key}:${s.category}`).join('|')
  const categoryOf = useMemo(() => {
    const m = new Map(statuses.map(s => [s.key, s.category]))
    return (key: string | undefined) => (key ? m.get(key) : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusCatKey])

  const { blockedBy, blockerIds } = useMemo(() => {
    const out = new Map<string, string[]>()
    const ids = new Map<string, string[]>()
    const byId = new Map(shownNodes.map(n => [n.id, n]))
    const direct = new Map<string, Array<{ id: string; label: string }>>()
    const startsWith = new Map<string, string[]>()
    for (const e of graph?.edges ?? []) {
      const src = byId.get(e.sourceId)
      const dst = byId.get(e.targetId)
      if (!src || !dst) continue
      const srcCat = categoryOf(src.statusKey)
      if (e.linkType === 'FS' || e.linkType === 'BLOCKS' || e.linkType === 'REQUIRES') {
        if (srcCat === 'DONE') continue
        direct.set(dst.id, [...(direct.get(dst.id) ?? []),
                            { id: src.id, label: G.blockedReason.finish(src.ref) }])
      } else if (e.linkType === 'SS') {
        if (srcCat !== 'TODO') continue
        startsWith.set(dst.id, [...(startsWith.get(dst.id) ?? []), src.id])
      }
    }

    const resolve = (id: string, seen: Set<string>): Array<{ id: string; label: string }> => {
      if (seen.has(id)) return []
      seen.add(id)
      const reasons = [...(direct.get(id) ?? [])]
      for (const peerId of startsWith.get(id) ?? []) {
        const upstream = resolve(peerId, seen)
        if (upstream.length) reasons.push(...upstream)
        else reasons.push({ id: peerId, label: G.blockedReason.start(byId.get(peerId)!.ref) })
      }
      return reasons
    }

    for (const n of shownNodes) {
      if (categoryOf(n.statusKey) === 'DONE') continue
      const reasons = resolve(n.id, new Set())
      if (!reasons.length) continue
      const seenLabel = new Set<string>()
      const uniq = reasons.filter(r => !seenLabel.has(r.label) && seenLabel.add(r.label))
      out.set(n.id, uniq.map(r => r.label))
      ids.set(n.id, uniq.map(r => r.id))
    }
    return { blockedBy: out, blockerIds: ids }
  }, [graph, shownNodes, categoryOf])

  // ── 聚焦子圖：選中的節點與它的鄰居留亮，其餘淡出 ──
  /**
   * 留亮的有三種，而且**畫法要不一樣**：
   *
   *   有關聯線的      → 這是依賴，實線外框
   *   上層／下層      → 這只是階層位置，虛線外框 ＋ 角落標「上層」「下層」
   *   卡住它的源頭    → 紅框（節點本來就會標紅），可能隔了好幾張才是真正的源頭
   *
   * 前兩種畫成一樣的話，點一張任務會看到它的大項目跟著亮，卻看不出那不是依賴 ——
   * 使用者會以為兩張任務之間有先後關係。階層仍然要留亮：不知道自己在哪一塊底下，
   * 光看依賴線也讀不懂這張圖。
   *
   * 第三種是後來補的：MRG-7 跟 MRG-6 同時開始，而 MRG-6 在等 MRG-5 ——
   * 卡住的說明上寫著 MRG-5，MRG-5 卻是暗的，「說在等它，卻看不到它」。
   */
  const { neighbours, kin } = useMemo(() => {
    if (!focusId) return { neighbours: null, kin: new Map<string, 'parent' | 'child'>() }
    const keep = new Set<string>([focusId])
    const linked = new Set<string>()
    for (const e of graph?.edges ?? []) {
      if (e.sourceId === focusId) { keep.add(e.targetId); linked.add(e.targetId) }
      if (e.targetId === focusId) { keep.add(e.sourceId); linked.add(e.sourceId) }
    }
    for (const id of blockerIds.get(focusId) ?? []) { keep.add(id); linked.add(id) }
    const k = new Map<string, 'parent' | 'child'>()
    for (const n of shownNodes) {
      if (n.parentId === focusId) { keep.add(n.id); if (!linked.has(n.id)) k.set(n.id, 'child') }
      if (n.id === focusId && n.parentId) {
        keep.add(n.parentId)
        if (!linked.has(n.parentId)) k.set(n.parentId, 'parent')
      }
    }
    return { neighbours: keep, kin: k }
  }, [focusId, graph, shownNodes, blockerIds])

  // ── 並行：這幾張可以同時派人做 ──────────────────────────────
  /**
   * 「同時並行」＝ 日期真的重疊，而且彼此之間沒有先後。分成三種講：
   *
   *   同時開始：連了「同時開始」，或同一天起跑 —— 人力要在同一天到位
   *   同時完成：連了「同時完成」，或同一天結束 —— 驗收會撞在同一天
   *   並行：只是期間重疊，開始與結束都各走各的
   *
   * 只看日期會把「A 完成後 B 開始、但兩張都跨了同一週」也算成並行，那是錯的；
   * 所以先用排程依賴算出可達性（含遞移），互相到得了的一律排除。SS/FF 不建立
   * 先後（見 layout 的說明），不放進可達性圖。父子也排除 —— 大項目的日期本來
   * 就是把小項目包起來，必然重疊，標出來沒有資訊量。
   */
  const parallelWith = useMemo(() => {
    const out = new Map<string, ParallelPeers>()

    const ids = shownNodes.map(n => n.id)
    const nextOf = new Map<string, string[]>(ids.map(id => [id, []]))
    for (const e of schedEdges) {
      if (e.linkType === 'SS' || e.linkType === 'FF') continue
      nextOf.get(e.sourceId)?.push(e.targetId)
    }
    /** id → 從它出發到得了的所有任務 */
    const reach = new Map<string, Set<string>>()
    for (const id of ids) {
      const seen = new Set<string>()
      const stack = [...(nextOf.get(id) ?? [])]
      while (stack.length) {
        const cur = stack.pop()!
        if (seen.has(cur)) continue
        seen.add(cur)
        stack.push(...(nextOf.get(cur) ?? []))
      }
      reach.set(id, seen)
    }

    const parentOf = new Map(shownNodes.map(n => [n.id, n.parentId]))
    const isKin = (a: string, b: string) => {
      for (const [from, to] of [[a, b], [b, a]] as const) {
        let cur: string | null | undefined = parentOf.get(from)
        for (let d = 0; cur && d < 20; d++) {
          if (cur === to) return true
          cur = parentOf.get(cur)
        }
      }
      return false
    }

    const span = new Map<string, { s: string; e: string }>()
    for (const t of tasks) {
      if (t.startDate && t.dueDate) span.set(t.id, { s: t.startDate, e: t.dueDate })
    }
    const refOf = new Map(shownNodes.map(n => [n.id, n.ref]))
    const add = (id: string, kind: keyof ParallelPeers, peer: string) => {
      const cur = out.get(id) ?? { sameStart: [], sameFinish: [], overlap: [] }
      cur[kind] = [...cur[kind], peer]
      out.set(id, cur)
    }

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j]
        if (isKin(a, b)) continue                          // 父子／祖孫
        // 必須要有明確建立的排程依賴連線 (forkA / joinA)，才算同時開始與同時完成。
        // 當完全沒有任何關聯連線時，不依據日期自動猜測「同時開始」、「同時完成」或「重疊」，避免畫面誤判警示。
        const forkA = simul.forkOf.get(a)
        const joinA = simul.joinOf.get(a)
        const sameStart = !!forkA && forkA === simul.forkOf.get(b)
        const sameFinish = !!joinA && joinA === simul.joinOf.get(b)

        if (sameStart) { add(a, 'sameStart', refOf.get(b)!); add(b, 'sameStart', refOf.get(a)!) }
        if (sameFinish) { add(a, 'sameFinish', refOf.get(b)!); add(b, 'sameFinish', refOf.get(a)!) }
      }
    }
    return out
  }, [shownNodes, schedEdges, tasks, simul])

  const styledNodes = useMemo(
    () => {
      const rolled = rollup(tasks)
      const kidsMap = new Map<string, typeof baseNodes>()
      for (const node of baseNodes) {
        const effectiveP = parentOverrides[node.id] !== undefined
          ? (parentOverrides[node.id] ?? undefined)
          : node.parentId
        if (effectiveP) {
          kidsMap.set(effectiveP, [...(kidsMap.get(effectiveP) ?? []), node])
        }
      }

      const result = baseNodes.map(n => {
        const isBox = n.type === 'box' || containerBoxIds.has(n.id)
        const userSize = resized[n.id]

        const effectiveP = parentOverrides[n.id] !== undefined
          ? (parentOverrides[n.id] ?? undefined)
          : n.parentId

        let width = userSize?.width ?? layoutSize.get(n.id)?.w ?? 288
        let height = userSize?.height ? even(userSize.height) : (layoutSize.get(n.id)?.h ?? 96)

        if (width) width = Math.ceil(width / 24) * 24
        if (height) height = even(height)

        const sizeStyle = isBox && width && height ? { width, height } : { width: 288, height: 96 }
        const boxMinSize = isBox ? { w: width, h: height } : undefined

        const rolledProgress = rolled.get(n.id)?.progress
        const effectiveProgress = (isBox || n.data.isContainerMode) && rolledProgress !== undefined
          ? rolledProgress
          : n.data.progress

        return {
          ...n,
          parentId: effectiveP,
          zIndex: isBox ? -1 : 10,
          position: dragged[n.id] ?? n.position,
          selected: !!selectedIds[n.id],
          style: { ...n.style, ...sizeStyle },
          measured: isBox && width && height ? { width, height } : { width: 288, height: 96 },
          data: {
            ...n.data,
            progress: effectiveProgress,
            selected: !!selectedIds[n.id],
            typeColor: typeColorMap.get(n.data.taskType) ?? getTypeColor(n.data.taskType),
            typeName: typeNameMap.get(n.data.taskType) ?? getTypeName(n.data.taskType),
            color: statusColor(n.data.statusKey),
            dimmed: !!neighbours && !neighbours.has(n.id),
            focused: n.id === focusId,
            hasUnread: unreadTaskIds.has(n.id),
            kin: kin.get(n.id) ?? null,
            blockedBy: blockedBy.get(n.id) ?? [],
            parallel: parallelWith.get(n.id) ?? NO_PARALLEL,
            showBadges,
            minSize: boxMinSize ?? n.data.minSize,
          },
        }
      })

      //依據 React Flow SKILL (Rule 73)：確保父收納盒節點在 nodes 陣列中始終排列於子卡片之前！
      const boxNodes = result.filter(n => n.type === 'box' || containerBoxIds.has(n.id))
      const cardNodes = result.filter(n => n.type !== 'box' && !containerBoxIds.has(n.id))
      return [...boxNodes, ...cardNodes]
    },
    [baseNodes, dragged, resized, measured, selectedIds, neighbours, kin, focusId, statusColor,
     blockedBy, parallelWith, unreadTaskIds, showBadges, layoutRel, layoutSize, parentOverrides, containerBoxIds, typeColorMap, typeNameMap, tasks]
  )

  const junctionNodes = useMemo<JunctionNode[]>(() => {
    // 先一律換算成畫布座標：框裡的任務位置是相對的，成員又可能分在不同的框裡。
    // 使用者拖過的位置同樣是相對的，所以只把差值疊上去。
    const pos = new Map(baseNodes.map(n => {
      const base = layoutAbs.get(n.id) ?? n.position
      const d = dragged[n.id]
      return [n.id, d
        ? { x: base.x + (d.x - n.position.x), y: base.y + (d.y - n.position.y) }
        : base]
    }))
    const heightOf = (id: string) =>
      even(measured[id]?.height ?? layoutSize.get(id)?.h ?? NODE_H_FALLBACK)
    const widthOf = (id: string) => layoutSize.get(id)?.w ?? NODE_W
    const parentOf = new Map(shownNodes.map(n => [n.id, n.parentId]))
    const present = new Set(shownNodes.map(n => n.id))

    // 只畫外側接得到任務的那幾群，其餘退回成兩張任務之間直接一條線（見 simul）
    return simul.hubs.flatMap(g => {
      const ms = g.members.filter(m => pos.has(m))
      if (ms.length < 2) return []
      // 錨點＝最外側那一張。圓點就貼在它旁邊，也跟著它住進同一個框
      const outer = (a: string, b: string) => g.kind === 'fork'
        ? pos.get(a)!.x < pos.get(b)!.x
        : pos.get(a)!.x + widthOf(a) > pos.get(b)!.x + widthOf(b)
      const anchor = ms.reduce((best, m) => (outer(m, best) ? m : best), ms[0])
      // 只拿跟錨點同一欄的成員算高度：它們上下相鄰，中線落在兩張之間的空隙，
      // 壓不到任何一張。別欄（別的框裡）的成員由扇形的線自己拉過去
      const anchorCenterY = pos.get(anchor)!.y + heightOf(anchor) / 2
      const mid = Math.round(anchorCenterY / 24) * 24
      const x = g.kind === 'fork'
        ? pos.get(anchor)!.x - JUNCTION_SPAN
        : pos.get(anchor)!.x + widthOf(anchor) + JUNCTION_GAP

      // 錨點在框裡的話，圓點就掛在同一個框底下 —— 不然它會飄在框外面。
      // React Flow 的子節點座標是相對於父節點左上角的，換算回去。
      const parent = parentOf.get(anchor)
      const origin = parent && present.has(parent) ? layoutAbs.get(parent) : undefined

      return [{
        id: g.id,
        type: 'junction' as const,
        ...(origin && parent ? { parentId: parent } : {}),
        // 圓點也可以自己拖，拖過的位置跟任務節點記在同一個地方（dragged），
        // 「重新排列」清掉之後就回到這裡算出來的位置
        position: dragged[g.id] ?? {
          x: x - (origin?.x ?? 0),
          y: mid - JUNCTION_SIZE / 2 - (origin?.y ?? 0),
        },
        measured: { width: JUNCTION_SIZE, height: JUNCTION_SIZE },
        style: { width: JUNCTION_SIZE, height: JUNCTION_SIZE },
        // 大項目的框是 1000。圓點要疊在框之上，不然框一蓋過來就抓不到它
        zIndex: 1400,
        // 拖得動，但不是任務：選不起來、也不能從它拉線
        selectable: false,
        connectable: false,
        data: {
          kind: g.kind,
          // 聚焦時，群裡沒有任何一張亮著就跟著淡出
          dimmed: !!neighbours && !ms.some(m => neighbours.has(m)),
        },
      }]
    })
  }, [simul, baseNodes, layoutAbs, layoutSize, shownNodes, dragged, measured, neighbours])

  const allNodes = useMemo<FlowNode[]>(
    () => [...styledNodes, ...junctionNodes], [styledNodes, junctionNodes]
  )

  // ── 邊 ──────────────────────────────────────────────────
  const edges = useMemo<Edge[]>(() => {
    const out: Edge[] = []
    const dim = (a: string, b: string) =>
      !!neighbours && !(neighbours.has(a) && neighbours.has(b))

    // 階層不再畫線 —— 大項目直接把底下的任務框起來（見 layout 的說明）。
    // 一條「包含」虛線得先看懂圖例才知道是什麼，框不用。

    // ── 匯合點的扇形：分岔點射向群裡每一張，群裡每一張射進合流點 ──
    // 只有外側接得到任務的那幾群才有圓點（見 simul），其餘在下面畫成直線
    if (showSchedLines) {
      for (const g of simul.hubs) {
        const color = SCHEDULING_COLOR[g.kind === 'fork' ? 'SS' : 'FF']
        const faded = !!neighbours && !g.members.some(m => neighbours.has(m))
        for (const m of g.members) {
          if (!visibleIds.has(m)) continue
          out.push({
            id: `${g.id}~${m}`,
            source: g.kind === 'fork' ? g.id : m,
            target: g.kind === 'fork' ? m : g.id,
            sourceHandle: H_OUT,
            targetHandle: H_IN,
            type: 'straight',
            selectable: false,
            // 這幾支箭頭不掛字：字寫在棒子上，一群有幾張就重複幾次會太吵
            style: { stroke: color, strokeWidth: 1.8, opacity: faded ? 0.15 : 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          })
        }
      }
    }

    const seen = new Set<string>()

    for (const e of graph?.edges ?? []) {
      if (!visibleIds.has(e.sourceId) || !visibleIds.has(e.targetId)) continue
      const type = e.linkType
      const scheduling = isScheduling(type)
      if (!scheduling) continue // 只保留 FS, SS, FF, SF 四項核心排程關聯，無視一般非排程關聯
      if (!showSchedLines) continue

      /**
       * 同時開始／同時完成：收成圓點的那幾群這裡不畫（扇形上面畫過了）；
       * 圓點沒畫出來的那幾群 —— 外側接不到任何任務 —— 就退回成兩張任務之間
       * 直接一條線，線上一樣掛「同時開始」「同時完成」那個短句。
       */
      const simultaneous = type === 'SS' || type === 'FF'
      if (simultaneous) {
        const g = type === 'SS' ? simul.forkOf.get(e.sourceId) : simul.joinOf.get(e.sourceId)
        if (g?.hub) continue
      }

      let source = e.sourceId
      let target = e.targetId
      // 退回成直線的那幾條不能被改道 —— 它講的就是這兩張任務之間的事
      if (scheduling && !simultaneous) {
        const fg = simul.forkOf.get(target)
        if (fg?.hub && !fg.members.includes(source)) target = fg.id
        const jg = simul.joinOf.get(source)
        if (jg?.hub && !jg.members.includes(target)) source = jg.id
      }
      const dedup = `${source}>${target}:${type}`
      if (seen.has(dedup)) continue
      seen.add(dedup)

      const color = scheduling ? SCHEDULING_COLOR[type] : RELATION_COLOR
      const faded = dim(e.sourceId, e.targetId)
      const lag = e.lagDays
        ? G.lag(e.lagDays)
        : ''

        const isJunctionLine = source.startsWith('fork:') || source.startsWith('join:') || target.startsWith('fork:') || target.startsWith('join:')
        const edgeLabelText = isJunctionLine ? (LINK_CHIP[e.linkType] + lag) : (lag || undefined)
        out.push({
          id: e.id,
          source,
          target,
          sourceHandle: scheduling && !simultaneous ? H_OUT : H_REL_OUT,
          targetHandle: scheduling && !simultaneous ? H_IN : H_REL_IN,
          type: 'smoothstep',
          label: showEdgeLabels ? edgeLabelText : undefined,
          labelShowBg: showEdgeLabels && !!edgeLabelText,
        labelBgStyle: {
          fill: dark ? '#090d16' : '#ffffff',
          stroke: color,
          strokeWidth: 1,
          rx: 4,
          ry: 4,
          opacity: faded ? 0.25 : 1,
        },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        labelStyle: {
          fontSize: 10,
          fontWeight: 600,
          fill: color,
          opacity: faded ? 0.25 : 1,
        },
        style: {
          stroke: color,
          strokeWidth: scheduling ? 1.8 : 1.2,
          strokeDasharray: scheduling ? undefined : RELATION_DASH,
          opacity: faded ? 0.15 : 1,
        },
        markerEnd: {
          type: scheduling ? MarkerType.ArrowClosed : MarkerType.Arrow,
          color, width: 16, height: 16,
        },
      })
    }
    return out
  }, [graph, shownNodes, visibleIds, showRelated, neighbours, simul, showEdgeLabels, dark])

  // ── 建立 / 刪除關聯 ──────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['graph', projectId] })
    qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    qc.invalidateQueries({ queryKey: ['schedule', projectId] })
  }

  const addLink = useMutation({
    mutationFn: (v: { source: string; target: string; linkType: LinkType }) =>
      Api.addLink(v.source, { targetId: v.target, linkType: v.linkType }),
    onSuccess: () => { setError(null); invalidate() },
    // 後端擋下循環依賴／父子衝突時，把它的中文理由原封不動顯示出來
    onError: (e: unknown) => setError(
      e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : G.link.addFailed
    ),
  })

  const delLink = useMutation({
    mutationFn: (id: string) => Api.deleteLink(id),
    onSuccess: () => { setError(null); invalidate() },
  })

  const taskTypeMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tasks) {
      map.set(t.id, t.type)
    }
    if (graph?.nodes) {
      for (const n of graph.nodes) {
        map.set(n.id, n.type)
      }
    }
    return map
  }, [tasks, graph?.nodes])

  /**
   * 簡化拉線體驗：任意接點皆可自由拉線，完全不設限，拉線即完成連線。
   */
  const isValidConnection = useCallback((c: Connection | Edge) => {
    return !!c.source && !!c.target && c.source !== c.target
  }, [])

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    const viaRelation = c.sourceHandle === H_REL_OUT || c.targetHandle === H_REL_IN
    const linkType: LinkType = viaRelation ? 'RELATES' : 'FS'
    addLink.mutate({ source: c.source, target: c.target, linkType })
  }, [addLink])

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    for (const edge of edgesToDelete) {
      if (edge.id && !edge.id.includes('~')) {
        delLink.mutate(edge.id)
      }
    }
  }, [delLink])

  const parentOfMap = useMemo(() => {
    const map = new Map(shownNodes.map(n => [n.id, n.parentId ?? null]))
    for (const [id, pId] of Object.entries(parentOverrides)) {
      map.set(id, pId)
    }
    return map
  }, [shownNodes, parentOverrides])

  const updateTaskParent = useMutation({
    mutationFn: (v: { id: string; parentId: string | null }) =>
      Api.patchTask(v.id, { parentId: v.parentId }),
    onSuccess: (_data, variables) => {
      setError(null)
      invalidate()
      setParentOverrides(prev => {
        const next = { ...prev }
        delete next[variables.id]
        return next
      })
    },
    onError: (e: unknown, variables) => {
      setParentOverrides(prev => {
        const next = { ...prev }
        delete next[variables.id]
        return next
      })
      setError(
        e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : G.link.addFailed
      )
    },
  })

  const [confirmCloseContainer, setConfirmCloseContainer] = useState<{ id: string; count: number } | null>(null)

  const doCloseContainer = useCallback((id: string) => {
    const kids = shownNodes.filter(n => n.parentId === id)
    setContainerBoxIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      try {
        localStorage.setItem('pmflow_graph_container_boxes', JSON.stringify([...next]))
        window.dispatchEvent(new Event('pmflow_container_boxes_changed'))
      } catch {}
      return next
    })
    if (kids.length > 0) {
      Promise.all(kids.map(k => Api.patchTask(k.id, { parentId: null })))
        .then(() => invalidate())
        .catch(e => {
          setError(e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : G.link.addFailed)
        })
    }
  }, [shownNodes, invalidate])

  /**
   * 切換容器收納模式：
   * 1. 點擊開啟 (📦 收納(開))：允許其它事件卡片拖放進內部。
   * 2. 點擊關閉 (📦 收納(關))：取消容器模式，若框內有事件卡片則彈出自訂提示視窗。
   */
  const toggleContainerMode = useCallback((id: string) => {
    setContainerBoxIds(prev => {
      const isTurningOff = prev.has(id)
      if (isTurningOff) {
        // Ref: CR-091/CR-097 — 關閉收納模式時若框內有事件框，彈出自訂 Modal 提示對話框
        const kids = shownNodes.filter(n => n.parentId === id)
        if (kids.length > 0) {
          setConfirmCloseContainer({ id, count: kids.length })
          return prev
        }
        const next = new Set(prev)
        next.delete(id)
        setResized(r => {
          if (!r[id]) return r
          const nr = { ...r }
          delete nr[id]
          return nr
        })
        try {
          localStorage.setItem('pmflow_graph_container_boxes', JSON.stringify([...next]))
          window.dispatchEvent(new Event('pmflow_container_boxes_changed'))
        } catch {}
        return next
      } else {
        const next = new Set(prev)
        next.add(id)
        try {
          localStorage.setItem('pmflow_graph_container_boxes', JSON.stringify([...next]))
          window.dispatchEvent(new Event('pmflow_container_boxes_changed'))
        } catch {}
        return next
      }
    })
  }, [shownNodes])

  const dragStartPos = useRef<Record<string, { x: number; y: number }>>({})
  const initialDraggedState = useRef<Record<string, { x: number; y: number } | undefined>>({})

  const onNodeDragStart = useCallback((e: unknown, node: Node) => {
    if (node.type !== 'task' && node.type !== 'box') return
    const mouseEvt = e as MouseEvent
    const isModifierPressed = !!(mouseEvt?.shiftKey || mouseEvt?.ctrlKey || mouseEvt?.metaKey)

    // 沒按住 Shift / Ctrl 快捷鍵時，強制定格為僅選取單一卡片，避免累積選取父收納盒或其他卡片
    if (!isModifierPressed) {
      setSelectedIds({ [node.id]: true })
    }

    const selectedList = isModifierPressed
      ? Object.keys(selectedIds).filter(id => selectedIds[id])
      : [node.id]

    // 預設拖曳一律獨立單獨移動該卡片；只有按住 Shift / Ctrl 快捷鍵且已多選時，才允許整批多選拖移！
    const activeGroup = (isModifierPressed && selectedList.includes(node.id) && selectedList.length > 1)
      ? selectedList
      : [node.id]

    const startMap: Record<string, { x: number; y: number }> = {}
    const initDraggedMap: Record<string, { x: number; y: number } | undefined> = {}
    for (const id of activeGroup) {
      const nObj = allNodes.find(n => n.id === id)
      if (nObj) {
        startMap[id] = { ...nObj.position }
      }
      initDraggedMap[id] = dragged[id] ? { ...dragged[id] } : undefined
    }
    dragStartPos.current = startMap
    initialDraggedState.current = initDraggedMap
  }, [allNodes, selectedIds, dragged])

  const onNodeDrag = useCallback((_: unknown, node: Node) => {
    if (node.type !== 'task' && node.type !== 'box') return
    const startPos = dragStartPos.current[node.id] ?? node.position
    const dx = node.position.x - startPos.x
    const dy = node.position.y - startPos.y

    const activeGroup = Object.keys(dragStartPos.current)
    const targetGroup = activeGroup.length > 0 ? activeGroup : [node.id]

    const groupUpdates: Record<string, { x: number; y: number }> = {}
    for (const id of targetGroup) {
      const sPos = dragStartPos.current[id]
      if (sPos) {
        groupUpdates[id] = {
          x: sPos.x + dx,
          y: sPos.y + dy,
        }
      } else if (id === node.id) {
        groupUpdates[id] = node.position
      }
    }
    setDragged(prev => ({ ...prev, ...groupUpdates }))
  }, [])

  /**
   * 空間拖曳動態階層管理 (Spatial Drag-and-Drop Hierarchy Engine)：
   * 卡片移入/移出收納盒僅更動 Menu 階層 (parentId)，絕不觸發任何收納盒位置或尺寸推移調整！
   */
  const onNodeDragStop = useCallback((evt: unknown, node: Node) => {
    if (node.type !== 'task' && node.type !== 'box') return
    const nId = node.id
    const getEffectiveParent = (id: string): string | null =>
      parentOverrides[id] !== undefined ? parentOverrides[id] : (parentOfMap.get(id) ?? null)

    const currentParentId = getEffectiveParent(nId)

    const startPos = dragStartPos.current[nId] ?? node.position
    const dx = node.position.x - startPos.x
    const dy = node.position.y - startPos.y

    const activeGroup = Object.keys(dragStartPos.current)
    if (activeGroup.length > 1) {
      const groupUpdates: Record<string, { x: number; y: number }> = {}
      for (const id of activeGroup) {
        const sPos = dragStartPos.current[id]
        if (sPos) {
          groupUpdates[id] = {
            x: Math.round((sPos.x + dx) / 24) * 24,
            y: evenPos(Math.round((sPos.y + dy) / 48) * 48),
          }
        }
      }
      setDragged(prev => ({ ...prev, ...groupUpdates }))
    }
    dragStartPos.current = {}

    // 換算正確的即時全畫布絕對座標 (遞迴向上累加所有父層座標與拖曳位移)
    const getAbs = (id: string, nObj?: Node): { x: number; y: number } => {
      const pId = getEffectiveParent(id)
      const d = (nObj && id === nObj.id ? nObj.position : undefined) ?? dragged[id]
      if (pId) {
        const pAbs = getAbs(pId)
        const rel = d ?? layoutAbs.get(id) ?? { x: 0, y: 0 }
        return { x: pAbs.x + rel.x, y: pAbs.y + rel.y }
      }
      return d ?? layoutAbs.get(id) ?? { x: 0, y: 0 }
    }

    const nAbs = getAbs(nId, node)
    const nodeW = measured[nId]?.width ?? layoutSize.get(nId)?.w ?? LEAF_W
    const nodeH = even(measured[nId]?.height ?? layoutSize.get(nId)?.h ?? LEAF_H)

    const nCenterX = nAbs.x + nodeW / 2
    const nCenterY = nAbs.y + nodeH / 2

    let newParentId: string | null = null

    // 1. 若卡片目前隶屬某收納盒 (currentParentId)，檢查是否依然在該盒內部範圍
    if (currentParentId) {
      const bNode = allNodes.find(n => n.id === currentParentId)
      if (bNode) {
        const bAbs = getAbs(bNode.id)
        const userSize = resized[bNode.id]
        const bW = userSize?.width ?? layoutSize.get(bNode.id)?.w ?? 288
        const bH = userSize?.height ? even(userSize.height) : (layoutSize.get(bNode.id)?.h ?? 96)

        const relX = nAbs.x - bAbs.x
        const relY = nAbs.y - bAbs.y

        // 當卡片右側/下側/左側/上側超越收納盒實體邊界時，判定脫離收納盒
        const cardRight = relX + nodeW
        const cardBottom = relY + nodeH

        const inBox = relX >= 12 && relY >= 36 && cardRight <= (bW - 12) && cardBottom <= (bH - 12)

        if (inBox) {
          newParentId = currentParentId
        }
      }
    }

    // 2. 若卡片已脫離原收納盒 (或原本無父層)，檢查是否放置於【其它】收納盒範圍內
    if (!newParentId) {
      const otherBoxes = allNodes.filter(
        n => n.id !== nId && n.id !== currentParentId && (containerBoxIds.has(n.id) || n.type === 'box')
      )
      for (const bNode of otherBoxes) {
        const bAbs = getAbs(bNode.id)
        const userSize = resized[bNode.id]
        const bW = userSize?.width ?? layoutSize.get(bNode.id)?.w ?? 288
        const bH = userSize?.height ? even(userSize.height) : (layoutSize.get(bNode.id)?.h ?? 96)

        if (
          nCenterX >= bAbs.x + 12 &&
          nCenterX <= bAbs.x + bW - 12 &&
          nCenterY >= bAbs.y + 36 &&
          nCenterY <= bAbs.y + bH - 12
        ) {
          newParentId = bNode.id
          break
        }
      }
    }

    if (newParentId && newParentId !== currentParentId) {
      // 1. [需求 1] 檢查是否與目標收納盒存在相依關聯線，有線則禁止移入並彈窗提示
      const hasDirectEdge = edges.some(
        e => (e.source === nId && e.target === newParentId) || (e.source === newParentId && e.target === nId)
      ) || (graph?.edges ?? []).some(
        e => (e.sourceId === nId && e.targetId === newParentId) || (e.sourceId === newParentId && e.targetId === nId)
      )

      if (hasDirectEdge) {
        const cardNode = shownNodes.find(n => n.id === nId)
        const boxNode = shownNodes.find(n => n.id === newParentId)
        const cardRef = cardNode?.ref ?? nId
        const boxRef = boxNode?.ref ?? newParentId
        setError(`無法移入收納盒：卡片 [${cardRef}] 與收納盒 [${boxRef}] 之間存在相依關聯線，無法放入收納盒中。`)
        
        const prevInit = initialDraggedState.current[nId]
        setDragged(prev => {
          const next = { ...prev }
          if (prevInit) {
            next[nId] = { ...prevInit }
          } else {
            delete next[nId]
          }
          return next
        })
        return
      }
    }

    // 僅更新父子階層連動 (parentId)
    if (newParentId !== currentParentId) {
      if (newParentId === null) {
        // 移出收納盒：極致精確換算「卡片放開時的左上角畫布絕對座標」= (原父盒絕對座標 + 卡片相對位移)
        const pAbs = currentParentId ? getAbs(currentParentId) : { x: 0, y: 0 }
        const absX = pAbs.x + node.position.x
        const absY = pAbs.y + node.position.y
        const targetX = Math.max(0, Math.round(absX / 24) * 24)
        const targetY = Math.max(0, evenPos(Math.round(absY / 48) * 48))

        const frozen: Record<string, { x: number; y: number }> = {}
        if (currentParentId) {
          const remaining = shownNodes.filter(
            n => n.id !== nId && (getEffectiveParent(n.id) === currentParentId || n.parentId === currentParentId)
          )
          for (const rChild of remaining) {
            const rRel = dragged[rChild.id] ?? layoutRel.get(rChild.id) ?? { x: 24, y: 48 }
            frozen[rChild.id] = { ...rRel }
          }
        }

        setParentOverrides(prev => ({ ...prev, [nId]: null }))
        setDragged(prev => {
          const next = { ...prev, ...frozen, [nId]: { x: targetX, y: targetY } }
          if (projectId) {
            try {
              localStorage.setItem(`pmflow_graph_dragged_${projectId}`, JSON.stringify(next))
            } catch {}
          }
          return next
        })
      } else {
        // 移入收納盒：
        // 1. 取得目標收納盒現有的所有子卡片
        const currentChildren = shownNodes.filter(
          n => n.id !== nId && (getEffectiveParent(n.id) === newParentId || n.parentId === newParentId)
        )

        // 2. 統計現有子卡片佔用的槽位索引 (cIdx * 5 + rIdx)
        const occupiedSlots = new Set<number>()
        const frozen: Record<string, { x: number; y: number }> = {}
        for (const child of currentChildren) {
          const childRel = dragged[child.id] ?? layoutRel.get(child.id) ?? { x: 24, y: 60 }
          frozen[child.id] = { ...childRel }

          const cIdx = Math.max(0, Math.round((childRel.x - 24) / 312))
          const rIdx = Math.max(0, Math.min(4, Math.round((childRel.y - 60) / 120)))
          occupiedSlots.add(cIdx * 5 + rIdx)
        }

        // 3. 從 Slot 0 開始掃描第一個空白槽位 (空位優先填補；無空位則自動推至末端 N+1)
        let slotIdx = 0
        while (occupiedSlots.has(slotIdx)) {
          slotIdx++
        }

        const cIdx = Math.floor(slotIdx / 5)
        const rIdx = slotIdx % 5
        const targetPos = { x: 24 + cIdx * 312, y: 60 + rIdx * 120 }

        // 4. [需求 4] 判斷塞不塞得下，若塞不下自動擴大收納盒尺寸 (寬度/高度)
        const totalCount = occupiedSlots.size + 1
        const cols = Math.ceil(totalCount / 5)
        const maxRows = Math.min(5, totalCount)
        const reqW = Math.max(288, 24 + cols * 312)
        const reqH = Math.max(96, even(60 + maxRows * 120))

        const userSize = resized[newParentId]
        const curW = userSize?.width ?? layoutSize.get(newParentId)?.w ?? 288
        const curH = userSize?.height ? even(userSize.height) : (layoutSize.get(newParentId)?.h ?? 96)

        if (reqW > curW || reqH > curH) {
          const newSize = { width: Math.max(curW, reqW), height: Math.max(curH, reqH) }
          setResized(prev => ({ ...prev, [newParentId]: newSize }))
          userAdjusted.current = true
        }

        setParentOverrides(prev => ({ ...prev, [nId]: newParentId }))
        setDragged(prev => {
          const next = { ...prev, ...frozen, [nId]: targetPos }
          if (projectId) {
            try {
              localStorage.setItem(`pmflow_graph_dragged_${projectId}`, JSON.stringify(next))
            } catch {}
          }
          return next
        })
      }
      updateTaskParent.mutate({ id: nId, parentId: newParentId })
    } else if (currentParentId === null) {
      // 獨立卡片在畫布主體間拖移：保留滑鼠釋放時的絕對座標
      const targetX = Math.round(nAbs.x / 24) * 24
      const targetY = evenPos(Math.round(nAbs.y / 48) * 48)
      setDragged(prev => {
        const next = { ...prev, [nId]: { x: targetX, y: targetY } }
        if (projectId) {
          try {
            localStorage.setItem(`pmflow_graph_dragged_${projectId}`, JSON.stringify(next))
          } catch {}
        }
        return next
      })
    } else {
      // 在同一收納盒內拖移：保留相對座標，絕不觸發收納盒擴大 (尺寸 100% 保持固定)
      const bAbs = getAbs(currentParentId)
      const relX = Math.max(24, Math.round((nAbs.x - bAbs.x) / 24) * 24)
      const relY = Math.max(48, evenPos(Math.round((nAbs.y - bAbs.y) / 48) * 48))

      setDragged(prev => {
        const next = { ...prev, [nId]: { x: relX, y: relY } }
        if (projectId) {
          try {
            localStorage.setItem(`pmflow_graph_dragged_${projectId}`, JSON.stringify(next))
          } catch {}
        }
        return next
      })
    }
    justDroppedUntilRef.current[nId] = Date.now() + 500
  }, [allNodes, containerBoxIds, dragged, layoutAbs, layoutSize, measured, parentOfMap, resized, updateTaskParent])

  const [deleteTargetEdge, setDeleteTargetEdge] = useState<{ id: string; sourceRef: string; targetRef: string } | null>(null)

  const onEdgeClick = useCallback((_: unknown, edge: Edge) => {
    const rawEdge = graph?.edges?.find(e => e.id === edge.id)
    const srcId = rawEdge?.sourceId ?? edge.source
    const tgtId = rawEdge?.targetId ?? edge.target

    const srcTask = tasks.find(t => t.id === srcId)
    const tgtTask = tasks.find(t => t.id === tgtId)

    const sourceRef = srcTask?.ref ?? srcId
    const targetRef = tgtTask?.ref ?? tgtId

    setDeleteTargetEdge({ id: edge.id, sourceRef, targetRef })
  }, [graph, tasks])

  const focused = focusId ? shownNodes.find(n => n.id === focusId) : undefined
  const focusedLinks = useMemo(() => {
    if (!focusId) return []
    return (graph?.edges ?? [])
      .filter(e => e.sourceId === focusId || e.targetId === focusId)
      .map(e => ({
        id: e.id,
        outgoing: e.sourceId === focusId,
        linkType: e.linkType,
        other: shownNodes.find(n => n.id === (e.sourceId === focusId ? e.targetId : e.sourceId)),
      }))
  }, [focusId, graph, shownNodes])

  if (isLoading) return <Spinner label={G.loading} />
  if (!shownNodes.length) return <Empty>{G.empty}</Empty>

  return (
    <div className="flex h-full flex-col">
      {/* ── 工具列 ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2
                      dark:border-slate-700 dark:bg-slate-900">
        {/* 用按鈕縮放也是「他自己選了視角」—— 不記下來的話，畫布一改尺寸
            下面那個 ResizeObserver 就會把他放大看的地方拉回全景 */}
        <Button variant="ghost" onClick={() => zoomBy(1.25)}
                aria-label={G.toolbar.zoomIn}>＋</Button>
        <Button variant="ghost" onClick={() => zoomBy(1 / 1.25)}
                aria-label={G.toolbar.zoomOut}>－</Button>
        {/* 他親口要全景，視角的主導權就還給自動佈局 */}
        <Button onClick={() => {
                  userAdjusted.current = false
                  try {
                    localStorage.removeItem(`pmflow_graph_viewport_${projectId}`)
                  } catch {}
                  fitView(FIT_OPTIONS)
                }}
                title={G.toolbar.fitAllTip}>{G.toolbar.fitAll}</Button>
        {/* 提示新增功能的文字佔位符 */}
        <span className="inline-flex items-center rounded border border-dashed border-blue-300 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          📍【預留功能位置：可在此提示要加入的功能】
        </span>
        <Button
          onClick={() => {
            setDragged({})
            setResized({})
            try {
              localStorage.removeItem(`pmflow_graph_dragged_${projectId}`)
              localStorage.removeItem(`pmflow_graph_resized_${projectId}`)
              localStorage.removeItem(`pmflow_graph_viewport_${projectId}`)
            } catch {}
            userAdjusted.current = false
            fitPending.current = true
            fitView(FIT_OPTIONS)
          }}
          title="清空已儲存的拖曳位置、尺寸與視角，還原為初始自動排版"
        >
          ↺ 重置位置
        </Button>
        {/* 框選本來按住 Shift 拉框就有，但沒有人看得出來。給它一顆按鈕，
            開著的時候左鍵直接拉框、右鍵平移 */}
        <Button
          onClick={() => setBoxSelect(v => !v)}
          className={boxSelect
            ? 'border-blue-500 bg-blue-50 text-blue-700 '
              + 'dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
            : undefined}
          title={boxSelect ? G.toolbar.boxSelectTipOn : G.toolbar.boxSelectTipOff}>
          {boxSelect ? G.toolbar.boxSelectOn : G.toolbar.boxSelect}
        </Button>
        <Button
          onClick={() => setShowBadges(v => !v)}
          className={showBadges
            ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-300'
            : undefined}
          title={showBadges ? '點擊隱藏節點與框內的警示標籤' : '點擊顯示節點與框內的警示標籤'}>
          {showBadges ? '🏷️ 警示標籤：顯示' : '🏷️ 警示標籤：預設隱藏'}
        </Button>

        {/* 最右側：說明按鈕與圖示說明浮動面板 */}
        <div className="relative ml-auto">
          <Button
            onClick={toggleLegendPopover}
            onMouseEnter={() => {
              if (legendTimerRef.current) clearTimeout(legendTimerRef.current)
              setShowLegendPopover(true)
            }}
            onMouseLeave={() => {
              if (legendTimerRef.current) clearTimeout(legendTimerRef.current)
              legendTimerRef.current = setTimeout(() => setShowLegendPopover(false), 5000)
            }}
            className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-medium px-3 py-1 text-xs"
            title="點擊保留說明 5 秒鐘，或懸浮檢視圖示說明"
          >
            說明
          </Button>

          {showLegendPopover && (
            <div
              onMouseEnter={() => {
                if (legendTimerRef.current) clearTimeout(legendTimerRef.current)
                setShowLegendPopover(true)
              }}
              onMouseLeave={() => {
                if (legendTimerRef.current) clearTimeout(legendTimerRef.current)
                legendTimerRef.current = setTimeout(() => setShowLegendPopover(false), 5000)
              }}
              className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-lg border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 text-xs select-none"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2 flex items-center justify-between">
                <span>🏷️ 圖示說明</span>
                <span className="text-[10px] font-normal text-slate-400">Icon Legend</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {ICON_HELP.map(h => (
                  <span key={h.label} className={cx('rounded px-1.5 py-0.5 text-[11px] font-medium border border-slate-200 dark:border-slate-800', h.className)} title={h.text}>
                    {h.label}
                  </span>
                ))}
              </div>
              <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">
                <span>💬 發文狀態說明</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['AWAITING', 'OVERDUE', 'PARTIAL', 'REPLIED'] as const).map(st => (
                  <span key={st} className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300" title={HELP.inquiry[st]}>
                    <span>{INQUIRY_META[st].icon}</span>
                    <span>{INQUIRY_META[st].label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700
                        dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600 dark:hover:text-red-200">✕</button>
        </div>
      )}

      <div ref={wrapperRef} className="relative min-h-0 flex-1">
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={allNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodeExtent={[[-100000, -100000], [100000, 100000]]}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          isValidConnection={isValidConnection}
          onEdgeClick={onEdgeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(evt, n) => {
            if (n.type !== 'task' && n.type !== 'box') return
            if (unreadTaskIds.has(n.id)) markTaskRead(n.id)
            const mouseEvt = evt as React.MouseEvent
            const isMultiSelectKey = !!(mouseEvt?.shiftKey || mouseEvt?.ctrlKey || mouseEvt?.metaKey)
            if (isMultiSelectKey) {
              setSelectedIds(prev => ({
                ...prev,
                [n.id]: !prev[n.id],
              }))
            } else {
              setSelectedIds({ [n.id]: true })
            }
            setFocusId(n.id)
          }}
          onNodeDoubleClick={(_, n) => {
            if (n.type === 'task' || n.type === 'box') {
              if (unreadTaskIds.has(n.id)) markTaskRead(n.id)
              onOpen(n.id)
            }
          }}
          onPaneClick={() => {
            setSelectedIds({})
            setFocusId(null)
          }}
          // event 為 null 代表是程式呼叫的（fitView 自己），只有真人拖曳縮放才算
          onMoveStart={(e) => { if (e) userAdjusted.current = true }}
          onMoveEnd={(_, vp) => {
            userAdjusted.current = true
            if (projectId) {
              try {
                localStorage.setItem(`pmflow_graph_viewport_${projectId}`, JSON.stringify(vp))
              } catch {}
            }
          }}
          nodesConnectable
          elevateEdgesOnSelect
          /*
           * 預設只要 1px 就算拖曳，點一下節點常常會夾帶一兩個 px 的位移，
           * 被 onNodesChange 收進 dragged 之後，那張任務就永遠偏離它那一欄
           * 一兩個 px —— 畫面上看起來就是「同一欄卻沒對齊」。拉高門檻，
           * 真的要拖才算拖。
           */
          nodeDragThreshold={4}
          /*
           * 框選：開著時左鍵拉框、右鍵（與中鍵）平移；關著時左鍵平移，
           * 按住 Shift 一樣拉得出框。選起來的節點拖一張就一起動 ——
           * onNodesChange 本來就會收到每一個被移動節點的 position。
           */
          snapToGrid
          snapGrid={[24, 24]}
          selectionOnDrag={boxSelect}
          panOnDrag={boxSelect ? [1, 2] : true}
          selectionKeyCode="Shift"
          multiSelectionKeyCode={null}
          minZoom={0.15}
          maxZoom={2}
          fitView
          fitViewOptions={FIT_OPTIONS}
          className="bg-slate-50 dark:bg-slate-950"
        >
          {/* 網點背景與網格點陣對齊 (24px 網點對齊) */}
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5}
                      color={dark ? '#475569' : '#94a3b8'} />
        </ReactFlow>
      </div>

      {deleteTargetEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                刪除連線確認
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              是否刪除 <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">{deleteTargetEdge.sourceRef}</span> 與 <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">{deleteTargetEdge.targetRef}</span> 的關聯？
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setDeleteTargetEdge(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  delLink.mutate(deleteTargetEdge.id)
                  setDeleteTargetEdge(null)
                }}
              >
                確定刪除
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmCloseContainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                關閉收納盒確認
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              收納盒內尚有 <span className="font-semibold text-slate-900 dark:text-slate-100">{confirmCloseContainer.count}</span> 個事件卡片，關閉收納盒將會把內部事件卡片移出至畫布，確定要轉換回事件卡片嗎？
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setConfirmCloseContainer(null)}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  doCloseContainer(confirmCloseContainer.id)
                  setConfirmCloseContainer(null)
                }}
              >
                確定關閉
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

/** 工具列上的開關。三個長得一樣，深色配色只寫一次 */
function GraphToggle({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-slate-600 dark:text-slate-300">
      <input type="checkbox" checked={checked}
             onChange={e => onChange(e.target.checked)}
             className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
      {label}
    </label>
  )
}

/** 聚焦面板上的一條說明。顏色由呼叫端給，其餘的間距與字級一致 */
function FocusNote({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('mt-2 rounded px-2 py-1 text-xs', className)}>{children}</div>
}

/** 一排說明。左邊固定一個小標，右邊的內容超出寬度就左右滑，不折行 */
function LegendRowStrip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-1">
      <span className="shrink-0 font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-x-4 overflow-x-auto
                      whitespace-nowrap [scrollbar-width:thin]">
        {children}
      </div>
    </div>
  )
}

/**
 * 說明列上的一項。
 *
 * 刻意不用瀏覽器原生的 `title` —— 它要停住不動一秒才出現、樣子不能控制、
 * 觸控螢幕也叫不出來。滑過去與點一下都走自己畫的那個提示框。
 */
type LegendItemProps = {
  onClick?: MouseEventHandler<HTMLButtonElement>
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>
  onMouseLeave?: () => void
}

function LegendChip({ className, children, ...h }: LegendItemProps & {
  className?: string; children: ReactNode
}) {
  return (
    <button type="button" {...h}
            className={cx('shrink-0 cursor-help hover:text-slate-800 dark:hover:text-slate-100',
                          className)}>
      {children}
    </button>
  )
}

/** 說明列上的一顆圓點。跟圖上的匯合點畫的是同一顆，顏色也一樣 */
function LegendDot({ color, label, ...h }: LegendItemProps & {
  color: string; label: string
}) {
  return (
    <button type="button" {...h}
            className="flex shrink-0 cursor-help items-center gap-1.5
                       hover:text-slate-800 dark:hover:text-slate-100">
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }} />
      {label}
    </button>
  )
}

/**
 * 把一條關聯講成一句完整的話，而且分方向講。
 * 同一條「完成後開始」站在上游和下游看到的意思相反 —— 這是最容易看錯的地方。
 * 與任務詳情頁的說法保持一致。
 */
function sentence(type: LinkType, outgoing: boolean, ref: string): string {
  return G.sentence[type][outgoing ? 'outgoing' : 'incoming'](ref)
}
