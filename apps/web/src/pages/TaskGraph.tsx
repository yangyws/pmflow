import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  ConnectionMode,
  ConnectionLineType,
  NodeResizeControl,
  BaseEdge,
  EdgeLabelRenderer,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeProps,
  type EdgeProps,
  type Viewport,
  type CoordinateExtent,
  type DefaultEdgeOptions,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Api, type Task } from '../lib/api'
import { DEFAULT_TYPE_COLORS } from '../components/EpicSidebar'
import { cx, ProblemBadge, TypeBadge } from '../components/ui'
import { CanvasPermissionModal } from '../components/CanvasPermissionModal'
import { rollup } from '../lib/rollup'
import { T } from '../strings' // Ref: CR-146
import { getObstaclesFromNodes, buildOrthogonalPath, type ObstacleRect } from '../lib/orthogonalRouting'

// 依據出發接點（左右出發為紅色實線、上下出發為紫色虛線，或自訂顏色）與標頭箭頭方向產生邊樣式
function getEdgeStyleAndMarker(sourceHandle?: string | null, customColor?: string) {
  const isLeftRight = !sourceHandle || sourceHandle.includes('left') || sourceHandle.includes('right')
  const strokeColor = customColor || (isLeftRight ? '#ef4444' : '#8b5cf6')
  return {
    animated: false,
    style: {
      strokeWidth: 2.5,
      stroke: strokeColor,
      strokeDasharray: isLeftRight ? 'none' : '5 5',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: strokeColor,
      width: 16,
      height: 16,
    },
  }
}

// 安全計算畫布大座標 (非遞迴，累加所有父節點 relative offset)
function getNodeAbsPos(nId: string, allNodes: Node[]): { x: number; y: number } {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  let cur = nodeMap.get(nId)
  let totalX = 0
  let totalY = 0
  const visited = new Set<string>()

  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id)
    totalX += cur.position?.x ?? 0
    totalY += cur.position?.y ?? 0
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined
  }
  return { x: totalX, y: totalY }
}

// 檢查某節點是否為另一節點的父級/祖先收納盒
function isAncestorNode(nodeId: string, potentialAncestorId: string, allNodes: Node[]): boolean {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  let cur = nodeMap.get(nodeId)
  const visited = new Set<string>()
  while (cur?.parentId && !visited.has(cur.id)) {
    visited.add(cur.id)
    if (cur.parentId === potentialAncestorId) return true
    cur = nodeMap.get(cur.parentId)
  }
  return false
}

/*
 * Ref: CR-152 這幾個常數本來寫成 JSX 上的行內物件，每次 render 都是新的參照；
 * React Flow 的 StoreUpdater 是用參照比對決定要不要寫回 store，
 * 行內物件等於每個 pointermove 都通知一次全部訂閱者。提到模組層就不會再變。
 */
const NODE_EXTENT: CoordinateExtent = [
  [-100000, -100000],
  [100000, 100000],
]
const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  type: 'orthogonal',
  animated: false,
  style: { strokeWidth: 2.5, stroke: '#ef4444' },
}
const PRO_OPTIONS = { hideAttribution: true }

const getStorageKeyViewport = (projectId?: string) =>
  projectId ? `pmflow_simple_graph_viewport_${projectId}` : 'pmflow_simple_graph_viewport'

// 讀取先前儲存的畫面焦點與縮放比例 (Viewport)
function loadSavedViewport(projectId?: string): Viewport | undefined {
  try {
    const raw = (projectId ? localStorage.getItem(`pmflow_simple_graph_viewport_${projectId}`) : null)
      || localStorage.getItem('pmflow_simple_graph_viewport')
    if (raw) {
      const parsed = JSON.parse(raw) as Viewport
      if (parsed && typeof parsed.zoom === 'number' && parsed.zoom >= 0.05) {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return undefined
}

// 確保父收納盒節點在 nodes 陣列中優先於子卡片 (對齊 Graph.tsx: React Flow 要求父節點排在子節點前面，否則子節點座標會對不上)
// Ref: CR-152 深度只算一次並記起來；本來就照順序時直接回傳原陣列，不排序也不配置新陣列
function orderParentNodesFirst(nodes: Node[]): Node[] {
  const parentMap = new Map(nodes.map((n) => [n.id, n.parentId]))
  const depthCache = new Map<string, number>()
  const getDepth = (id: string): number => {
    const cached = depthCache.get(id)
    if (cached !== undefined) return cached
    let d = 0
    let cur = parentMap.get(id)
    while (cur && d < 20) {
      d++
      const memo = depthCache.get(cur)
      if (memo !== undefined) {
        d += memo
        break
      }
      cur = parentMap.get(cur)
    }
    depthCache.set(id, d)
    return d
  }

  const depths = nodes.map((n) => getDepth(n.id))
  for (let i = 1; i < depths.length; i++) {
    if (depths[i - 1] > depths[i]) {
      return [...nodes].sort((a, b) => getDepth(a.id) - getDepth(b.id))
    }
  }
  return nodes
}

export type NodeMode = 'card' | 'box'

export type TaskGraphNodeData = {
  label: string
  refText?: string
  mode: NodeMode
  progress?: number
  typeColor?: string
  typeName?: string
  taskType?: string
  problem?: string | null
  problemCount?: number
  blockedCount?: number
  overdueCount?: number
  inquiryCount?: number
  inquiryOverdueCount?: number
  inquiryAwaitingCount?: number
  blockedBy?: string[]
  isParallel?: boolean
  parallelPeers?: string[]
  childCount?: number
  isOverdue?: boolean
  dueDate?: string | null
  inquiryState?: string | null
  isSelected?: boolean
  isRelated?: boolean
  hasSelectionActive?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: (id: string) => void
  minWidth?: number
  minHeight?: number
  onToggleMode?: (id: string) => void
  onOpenTask?: (id: string) => void
}

export type CustomTaskNode = Node<TaskGraphNodeData, 'simpleNode'>
export type SimpleGraphNodeData = TaskGraphNodeData
export type CustomSimpleNode = CustomTaskNode

function NodeProgressBar({ progress }: { progress: number }) {
  const barColor = progress >= 100 ? '#10b981' : '#ef4444'
  return (
    <div className="mt-1.5 flex items-center gap-1.5 w-full select-none pointer-events-none">
      <div className="h-1 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-1 rounded transition-all duration-300 ${progress === 0 ? 'opacity-40' : ''}`}
          style={{
            width: `${Math.min(100, Math.max(progress, progress === 0 ? 100 : progress))}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      {progress >= 100 ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-sm" title={T.flow.relationGraph.done}>
          ✓
        </span>
      ) : progress === 0 ? (
        <span className="text-[10px] tabular-nums font-normal text-slate-400 dark:text-slate-500" title={T.flow.relationGraph.notStarted}>
          {T.flow.relationGraph.notStarted}
        </span>
      ) : (
        <span className="text-[10px] tabular-nums font-medium text-slate-600 dark:text-slate-300">
          {progress}%
        </span>
      )}
    </div>
  )
}

// 計算收納盒邊界與最小尺寸 (依據盒內所有卡片與子收納盒的最大座標與邊界 (x+width, y+height))
function computeBoxDimensions(
  boxId: string,
  childNodes: Node[],
  currentResizedW?: number,
  currentResizedH?: number,
  visited = new Set<string>(),
  isCollapsed = false
): { minWidth: number; minHeight: number; width: number; height: number } {
  if (isCollapsed) {
    return {
      minWidth: 320,
      minHeight: 90,
      width: Math.max(320, currentResizedW ?? 0),
      height: 90,
    }
  }
  if (visited.has(boxId)) {
    return { minWidth: 340, minHeight: 260, width: Math.max(340, currentResizedW ?? 0), height: Math.max(260, currentResizedH ?? 0) }
  }
  visited.add(boxId)

  const kids = childNodes.filter((cn) => cn.parentId === boxId)
  // Ref: CR-136 空收納盒回到初始尺寸（＝一張卡片大小）
  const baseW = kids.length === 0 ? 256 : 340
  const baseH = kids.length === 0 ? 90 : 280
  let maxRight = baseW
  let maxBottom = baseH

  kids.forEach((k) => {
    const isKBox = (k.data as SimpleGraphNodeData)?.mode === 'box'
    const kX = k.position?.x ?? 24
    const kY = k.position?.y ?? 70
    let kW = Number(k.style?.width ?? k.width ?? (k as any).measured?.width ?? (isKBox ? 340 : 256))
    let kH = Number((k as any).measured?.height ?? k.style?.height ?? k.height ?? (isKBox ? 280 : 90))

    if (isKBox) {
      const subDims = computeBoxDimensions(k.id, childNodes, undefined, undefined, new Set(visited))
      kW = Math.max(kW, subDims.width)
      kH = Math.max(kH, subDims.height)
    }

    const right = kX + kW + 24
    const bottom = kY + kH + 20
    if (right > maxRight) maxRight = right
    if (bottom > maxBottom) maxBottom = bottom
  })

  const reqW = Math.max(baseW, Math.ceil(maxRight))
  const reqH = Math.max(baseH, Math.ceil(maxBottom))

  return {
    minWidth: reqW,
    minHeight: reqH,
    width: Math.max(reqW, currentResizedW ?? 0),
    height: Math.max(reqH, currentResizedH ?? 0),
  }
}

// 自由切換的節點 UI (包含四向 Handle 接點，允許上下左右任意拉線)
function SimpleNodeView({ id, data, width, height, isConnectable }: NodeProps<CustomSimpleNode>) {
  const isBox = data.mode === 'box'
  const nodeW = width ?? (isBox ? 340 : 256)
  const nodeH = height ?? (isBox ? 260 : undefined)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    data.onToggleMode?.(id)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    data.onOpenTask?.(id)
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        width: nodeW,
        height: isBox ? (data.isCollapsed ? undefined : nodeH) : undefined,
        minHeight: 90,
      }}
      className={cx('relative select-none', isBox ? (data.isCollapsed ? 'w-full pointer-events-auto' : 'w-full h-full pointer-events-none') : 'w-full pointer-events-auto')}
    >
      {isBox ? (
        <div
          className={cx(
            'relative w-full rounded-lg border bg-slate-50/40 dark:bg-slate-900/50 shadow-sm hover:shadow-md transition-colors duration-150 flex flex-col justify-between overflow-hidden opacity-100',
            data.isCollapsed ? 'min-h-[90px] pointer-events-auto cursor-grab active:cursor-grabbing' : 'h-full min-w-[320px] min-h-[240px] pointer-events-none',
            data.isSelected
              ? 'border-blue-500 ring-2 ring-blue-500 shadow-xl'
              : 'border-slate-300 dark:border-slate-700'
          )}
        >
          <div>
            <div
              className="h-1 rounded-t-lg shrink-0 pointer-events-auto"
              style={{ backgroundColor: data.typeColor || '#6366f1' }}
            />
            <div className="px-2.5 py-1.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 flex flex-col justify-start gap-1 pointer-events-auto cursor-grab active:cursor-grabbing">
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={handleToggle}
                    className="nodrag shrink-0 w-[58px] inline-flex items-center justify-center rounded py-0.5 text-[9px] font-medium transition-colors cursor-pointer border text-center select-none bg-slate-100 text-slate-800 border-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-500"
                    title={T.flow.relationGraph.boxToggleTitle}
                  >
                    {T.flow.relationGraph.boxBadge}
                  </button>
                  <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 pointer-events-none select-none">
                    {data.refText || 'MRG-BOX'}
                  </span>
                  <TypeBadge name={data.typeName || T.flow.relationGraph.typeTask} color={data.typeColor || '#3178c6'} />
                  {((typeof data.childCount === 'number' && data.childCount > 0) ||
                    (typeof data.problemCount === 'number' && data.problemCount > 0)) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        data.onToggleCollapse?.(id)
                      }}
                      className="nodrag shrink-0 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors cursor-pointer border text-center select-none bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 shadow-xs"
                      title={data.isCollapsed ? T.flow.relationGraph.expandBoxHint : T.flow.relationGraph.collapseBoxHint}
                    >
                      {data.isCollapsed ? T.flow.relationGraph.expand : T.flow.relationGraph.collapse}
                    </button>
                  )}
                </div>
              </div>

              {/* 第二行：收納盒警示徽章 */}
              {((typeof data.childCount === 'number' && data.childCount > 0) ||
                (typeof data.problemCount === 'number' && data.problemCount > 0) ||
                (typeof data.blockedCount === 'number' && data.blockedCount > 0) ||
                (data.blockedBy && data.blockedBy.length > 0) ||
                data.isParallel ||
                (typeof data.overdueCount === 'number' && data.overdueCount > 0) ||
                (typeof data.inquiryOverdueCount === 'number' && data.inquiryOverdueCount > 0) ||
                (typeof data.inquiryAwaitingCount === 'number' && data.inquiryAwaitingCount > 0) ||
                (typeof data.inquiryCount === 'number' && data.inquiryCount > 0)) && (
                <div className="flex flex-wrap items-center gap-1 min-w-0">
                  {typeof data.childCount === 'number' && data.childCount > 0 && (
                    <span className="shrink-0 whitespace-nowrap rounded px-1 text-[10px] bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 font-medium pointer-events-none select-none">
                      {T.flow.relationGraph.childCount(data.childCount)}
                    </span>
                  )}
                  {typeof data.problemCount === 'number' && data.problemCount > 0 && (
                    <ProblemBadge problem={data.problem || '遭遇問題'} count={data.problemCount} isBox={true} />
                  )}
                  {typeof data.blockedCount === 'number' && data.blockedCount > 0 ? (
                    <span
                      title={data.blockedBy && data.blockedBy.length > 0
                        ? `收納盒受 ${data.blockedBy.join('、')} 依賴阻塞，且盒內有 ${data.blockedCount} 張子任務受阻`
                        : `盒內有 ${data.blockedCount} 張子任務受上游依賴阻塞`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 pointer-events-none select-none"
                    >
                      <span aria-hidden>⛔</span>{T.flow.relationGraph.blockedBadge} {data.blockedCount}
                    </span>
                  ) : (data.blockedBy && data.blockedBy.length > 0 && (
                    <span
                      title={T.flow.relationGraph.blockedCardTitle(data.blockedBy.join('、'))}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 pointer-events-none select-none"
                    >
                      <span aria-hidden>⛔</span>{T.flow.relationGraph.blockedBadge}
                    </span>
                  ))}
                  {data.isParallel && (
                    <span
                      title={T.flow.relationGraph.parallelTitle(data.parallelPeers?.join('、'))}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 pointer-events-none select-none"
                    >
                      {T.flow.relationGraph.parallelBadge}
                    </span>
                  )}
                  {typeof data.overdueCount === 'number' && data.overdueCount > 0 && (
                    <span
                      title={T.flow.relationGraph.overdueTitle(data.dueDate || '')}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 pointer-events-none select-none"
                    >
                      {T.flow.relationGraph.overdueBadge} {data.overdueCount}
                    </span>
                  )}
                  {typeof data.inquiryOverdueCount === 'number' && data.inquiryOverdueCount > 0 && (
                    <span
                      title={`盒內有 ${data.inquiryOverdueCount} 筆對外詢問逾期未回`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-indigo-700 bg-indigo-50 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-500/15 dark:text-indigo-300 pointer-events-none select-none"
                    >
                      <span aria-hidden>📨</span>{T.inquiry.badge.overdue} {data.inquiryOverdueCount}
                    </span>
                  )}
                  {typeof data.inquiryAwaitingCount === 'number' && data.inquiryAwaitingCount > 0 && (
                    <span
                      title={`盒內有 ${data.inquiryAwaitingCount} 筆對外詢問待回覆`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 pointer-events-none select-none"
                    >
                      <span aria-hidden>⏳</span>{T.inquiry.badge.awaiting} {data.inquiryAwaitingCount}
                    </span>
                  )}
                </div>
              )}
              <div className="font-semibold text-slate-800 text-xs dark:text-slate-100 pointer-events-none select-none break-words w-full leading-snug" title={data.label}>
                {data.label || T.flow.relationGraph.untitledBox}
              </div>
              <NodeProgressBar progress={data.progress ?? 0} />
            </div>
          </div>

          {/* 底部邊框上方提示（展開狀態下顯示於收納盒底部邊框上方） */}
          {!data.isCollapsed && (
            <div className="px-3 py-1 flex items-center justify-between pointer-events-none select-none text-[10px] text-slate-400/80 dark:text-slate-500/80">
              <span>{T.flow.relationGraph.boxCapacityHint}</span>
            </div>
          )}

          {/* 右下角縮放控制鈕 */}
          {!data.isCollapsed && (isConnectable ?? true) && (
            <NodeResizeControl
              position="bottom-right"
              minWidth={data.minWidth ?? 340}
              minHeight={data.minHeight ?? 280}
              className="nodrag !w-4 !h-4 !bottom-1 !right-1 !border-0 !bg-transparent pointer-events-auto"
            >
              <div
                className="w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 border border-slate-300/80 dark:border-slate-600/80 cursor-se-resize shadow-xs select-none"
                title={T.flow.relationGraph.resizeBox}
              >
                ↘
              </div>
            </NodeResizeControl>
          )}
        </div>
      ) : (
        <div
          className={cx(
            'w-full min-w-[256px] min-h-[90px] rounded-lg border bg-white shadow-sm hover:shadow-md transition-colors duration-150 dark:bg-slate-900 select-none cursor-grab active:cursor-grabbing pointer-events-auto flex flex-col justify-between overflow-hidden opacity-100',
            data.isSelected
              ? 'border-blue-500 ring-2 ring-blue-500 shadow-xl'
              : 'border-slate-200 dark:border-slate-800'
          )}
        >
          <div
            className="h-1 rounded-t-lg shrink-0"
            style={{ backgroundColor: data.typeColor || '#3b82f6' }}
          />
          <div className="p-2.5 flex flex-col justify-between flex-1 gap-1.5 min-w-0">
            {/* 第一行：卡片按鈕 + MRG編號 + 種類名稱 + 折疊按鈕 */}
            <div className="flex items-center justify-between gap-1 w-full min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 min-w-0 shrink overflow-hidden">
                {data.taskType !== 'BUG' && (
                  <button
                    type="button"
                    onClick={handleToggle}
                    className="nodrag shrink-0 w-[58px] inline-flex items-center justify-center rounded py-0.5 text-[9px] font-medium transition-colors cursor-pointer border text-center select-none bg-white text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    title={T.flow.relationGraph.cardToggleTitle}
                  >
                    {T.flow.relationGraph.card}
                  </button>
                )}
                <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 pointer-events-none select-none">
                  {data.refText || 'MRG-1'}
                </span>
                <TypeBadge name={data.typeName || T.flow.relationGraph.typeTask} color={data.typeColor || '#3178c6'} />
              </div>
              {((typeof data.childCount === 'number' && data.childCount > 0) ||
                (typeof data.problemCount === 'number' && data.problemCount > 0)) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    data.onToggleCollapse?.(id)
                  }}
                  className="nodrag shrink-0 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors cursor-pointer border text-center select-none bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 shadow-xs"
                  title={data.isCollapsed ? T.flow.relationGraph.expandCardHint : T.flow.relationGraph.collapseCardHint}
                >
                  {data.isCollapsed ? T.flow.relationGraph.expand : T.flow.relationGraph.collapse}
                </button>
              )}
            </div>

            {/* 第二行：警示徽章 */}
            {((data.taskType !== 'BUG' && typeof data.problemCount === 'number' && data.problemCount > 0) ||
              (data.blockedBy && data.blockedBy.length > 0) ||
              data.isParallel ||
              data.isOverdue ||
              data.inquiryState === 'AWAITING' ||
              data.inquiryState === 'PARTIAL' ||
              data.inquiryState === 'OVERDUE') && (
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {data.taskType !== 'BUG' && typeof data.problemCount === 'number' && data.problemCount > 0 && (
                  <ProblemBadge
                    problem={data.problem || `內有 ${data.problemCount} 張未完成問題單`}
                    count={data.problemCount}
                    isShort={true}
                  />
                )}
                {data.blockedBy && data.blockedBy.length > 0 && (
                  <span
                    title={T.flow.relationGraph.blockedCardTitle(data.blockedBy.join('、'))}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 pointer-events-none select-none"
                  >
                    <span aria-hidden>⛔</span>{T.flow.relationGraph.blockedBadge}
                  </span>
                )}
                {data.isParallel && (
                  <span
                    title={T.flow.relationGraph.parallelTitle(data.parallelPeers?.join('、'))}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 pointer-events-none select-none"
                  >
                    {T.flow.relationGraph.parallelBadge}
                  </span>
                )}
                {data.isOverdue && (
                  <span
                    title={T.flow.relationGraph.overdueTitle(data.dueDate || '')}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 pointer-events-none select-none"
                  >
                    {T.flow.relationGraph.overdueBadge}
                  </span>
                )}
                {data.inquiryState === 'OVERDUE' && (
                  <span
                    title={T.flow.relationGraph.inquiryOverdueTitle}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-indigo-700 bg-indigo-50 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-500/15 dark:text-indigo-300 pointer-events-none select-none"
                  >
                    <span aria-hidden>📨</span>{T.inquiry.badge.overdue}
                  </span>
                )}
                {(data.inquiryState === 'AWAITING' || data.inquiryState === 'PARTIAL') && (
                  <span
                    title={T.flow.relationGraph.inquiryTitle}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 pointer-events-none select-none"
                  >
                    <span aria-hidden>{data.inquiryState === 'PARTIAL' ? '◐' : '⏳'}</span>{data.inquiryState === 'PARTIAL' ? T.inquiry.badge.partial : T.inquiry.badge.awaiting}
                  </span>
                )}
              </div>
            )}
            <div className="font-semibold text-slate-800 text-xs dark:text-slate-100 pointer-events-none select-none break-words w-full leading-snug" title={data.label}>
              {data.label || T.flow.relationGraph.untitledTask}
            </div>
            {data.taskType !== 'BUG' && <NodeProgressBar progress={data.progress ?? 0} />}
          </div>
        </div>
      )}

      {/* 接點 (Handles) - 僅在可連線狀態時渲染，四向加大且顏色分明 (左右紅色排程相依、上下紫色階層關係)，支援懸停動態放大 */}
      {(isConnectable ?? true) && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="left-in"
            style={{ top: '50%', backgroundColor: '#ef4444' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="left-out"
            style={{ top: '50%', backgroundColor: '#ef4444' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
          <Handle
            type="target"
            position={Position.Right}
            id="right-in"
            style={{ top: '50%', backgroundColor: '#ef4444' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right-out"
            style={{ top: '50%', backgroundColor: '#ef4444' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
          <Handle
            type="target"
            position={Position.Top}
            id="top-in"
            style={{ left: '50%', backgroundColor: '#8b5cf6' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
          <Handle
            type="source"
            position={Position.Top}
            id="top-out"
            style={{ left: '50%', backgroundColor: '#8b5cf6' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
          <Handle
            type="target"
            position={Position.Bottom}
            id="bottom-in"
            style={{ left: '50%', backgroundColor: '#8b5cf6' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom-out"
            style={{ left: '50%', backgroundColor: '#8b5cf6' }}
            className="!w-5 !h-5 !border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag shadow-sm transition-transform hover:scale-125 after:absolute after:content-[''] after:-inset-3 after:rounded-full after:cursor-crosshair"
            isConnectable={isConnectable ?? true}
            isConnectableStart={true}
            isConnectableEnd={true}
          />
        </>
      )}
    </div>
  )
}

const nodeTypes = {
  simpleNode: memo(SimpleNodeView),
  // Ref: CR-144
  annotationText: memo(SimpleTextNode),
  annotationFrame: memo(SimpleFrameNode),
}

// Ref: CR-139
const WAYPOINT_KEY_PREFIX = 'pmflow_simple_graph_edge_waypoints_'

type Waypoint = { x: number; y: number }
type WaypointMap = Record<string, Waypoint>

function loadWaypoints(projectId?: string): WaypointMap {
  if (!projectId) return {}
  try {
    const raw = localStorage.getItem(`${WAYPOINT_KEY_PREFIX}${projectId}`)
    return raw ? (JSON.parse(raw) as WaypointMap) : {}
  } catch {
    return {}
  }
}

function saveWaypoints(projectId: string | undefined, map: WaypointMap) {
  if (!projectId) return
  try {
    if (Object.keys(map).length > 0) {
      localStorage.setItem(`${WAYPOINT_KEY_PREFIX}${projectId}`, JSON.stringify(map))
    } else {
      localStorage.removeItem(`${WAYPOINT_KEY_PREFIX}${projectId}`)
    }
  } catch {
    // ignore
  }
}

// Ref: CR-150 關聯線文字：與折點共用同一組 key，之後要改打後端 API 只改這兩個函式
const EDGE_TEXT_KEY_PREFIX = 'pmflow_simple_graph_edge_texts_'

type EdgeTextMap = Record<string, string>

function loadEdgeTexts(projectId?: string): EdgeTextMap {
  if (!projectId) return {}
  try {
    const raw = localStorage.getItem(`${EDGE_TEXT_KEY_PREFIX}${projectId}`)
    return raw ? (JSON.parse(raw) as EdgeTextMap) : {}
  } catch {
    return {}
  }
}

function saveEdgeTexts(projectId: string | undefined, map: EdgeTextMap) {
  if (!projectId) return
  try {
    if (Object.keys(map).length > 0) {
      localStorage.setItem(`${EDGE_TEXT_KEY_PREFIX}${projectId}`, JSON.stringify(map))
    } else {
      localStorage.removeItem(`${EDGE_TEXT_KEY_PREFIX}${projectId}`)
    }
  } catch {
    // ignore
  }
}

// Ref: CR-188 關聯線顏色配置
const EDGE_COLOR_KEY_PREFIX = 'pmflow_simple_graph_edge_colors_'

type EdgeColorMap = Record<string, string>

const EDGE_COLOR_OPTIONS = [
  { name: '預設紅', color: '#ef4444' },
  { name: '科技藍', color: '#3b82f6' },
  { name: '翡翠綠', color: '#10b981' },
  { name: '紫羅蘭', color: '#8b5cf6' },
  { name: '琥珀橘', color: '#f59e0b' },
  { name: '玫瑰粉', color: '#ec4899' },
  { name: '青綠色', color: '#06b6d4' },
  { name: '深岩灰', color: '#475569' },
]

function loadEdgeColors(projectId?: string): EdgeColorMap {
  if (!projectId) return {}
  try {
    const raw = localStorage.getItem(`${EDGE_COLOR_KEY_PREFIX}${projectId}`)
    return raw ? (JSON.parse(raw) as EdgeColorMap) : {}
  } catch {
    return {}
  }
}

function saveEdgeColors(projectId: string | undefined, map: EdgeColorMap) {
  if (!projectId) return
  try {
    if (Object.keys(map).length > 0) {
      localStorage.setItem(`${EDGE_COLOR_KEY_PREFIX}${projectId}`, JSON.stringify(map))
    } else {
      localStorage.removeItem(`${EDGE_COLOR_KEY_PREFIX}${projectId}`)
    }
  } catch {
    // ignore
  }
}


// Ref: CR-141 折點把手是 EdgeLabelRenderer portal，合成事件仍沿 React 樹冒泡到該條 edge 的 <g onClick>
let waypointClickGuard = false
let waypointGuardTimer: ReturnType<typeof setTimeout> | null = null

function armWaypointClickGuard() {
  waypointClickGuard = true
  if (waypointGuardTimer) {
    clearTimeout(waypointGuardTimer)
    waypointGuardTimer = null
  }
}

function scheduleWaypointGuardRelease() {
  if (waypointGuardTimer) clearTimeout(waypointGuardTimer)
  waypointGuardTimer = setTimeout(() => {
    waypointClickGuard = false
    waypointGuardTimer = null
  }, 400)
}

function consumeWaypointClickGuard(): boolean {
  if (!waypointClickGuard) return false
  waypointClickGuard = false
  if (waypointGuardTimer) {
    clearTimeout(waypointGuardTimer)
    waypointGuardTimer = null
  }
  return true
}

type OrthogonalEdgeData = {
  waypoint?: Waypoint | null
  obstacles?: ObstacleRect[]
  onWaypointChange?: (edgeId: string, p: Waypoint) => void
  onWaypointReset?: (edgeId: string) => void
  // Ref: CR-150
  text?: string
  onSaveText?: (edgeId: string, text: string) => void
  // Ref: CR-151
  onWaypointDragStart?: () => void
  onWaypointDragEnd?: () => void
  onEdgeClick?: () => void
}

// Ref: CR-139 & CR-154 支援智慧直角避障與手動折點
function OrthogonalEdge({
  id,
  source: _source,
  target: _target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow()
  const draggingRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)
  const eData = data as OrthogonalEdgeData | undefined
  // Ref: CR-151 折點與文字一律用這條關聯線自己的 id 當鍵（對稱型關聯的兩端會被後端對調）
  const wpKey = id

  // 障礙物資訊由父層 styledEdges 統一預算並帶入，避免在 Edge 內部呼叫 getNodes() 引發無窮重新渲染迴圈
  const obstacles = eData?.waypoint ? [] : (eData?.obstacles ?? [])
  const isConnectable = (eData as any)?.isConnectable ?? true

  // Ref: CR-150
  const edgeText = eData?.text || ''
  const [isEditingText, setIsEditingText] = useState(false)
  const [textDraft, setTextDraft] = useState('')

  const finishTextEdit = (commit: boolean) => {
    if (commit) eData?.onSaveText?.(wpKey, textDraft)
    setIsEditingText(false)
  }

  // Ref: CR-139 & CR-154 智慧避障直角路徑運算
  const { path, px, py } = buildOrthogonalPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    eData?.waypoint,
    obstacles
  )

  // 接點距離過近且未手動拖折點時，隱藏中央折點圓點避免視覺擁擠
  const isTooClose = !eData?.waypoint && Math.hypot(targetX - sourceX, targetY - sourceY) < 70

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isConnectable) return
    e.stopPropagation()
    draggingRef.current = true
    hasMovedRef.current = false
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isConnectable || !draggingRef.current) return
    e.stopPropagation()
    if (
      pointerStartRef.current &&
      Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y) > 3
    ) {
      if (!hasMovedRef.current) {
        hasMovedRef.current = true
        armWaypointClickGuard()
        eData?.onWaypointDragStart?.()
      }
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      eData?.onWaypointChange?.(wpKey, { x: Math.round(p.x), y: Math.round(p.y) })
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.stopPropagation()
    if (hasMovedRef.current) {
      scheduleWaypointGuardRelease()
      eData?.onWaypointDragEnd?.()
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* 組合方案 A+B：全線 36px 寬幅點擊熱區 ＋ 純 CSS 零跳動懸停加粗發光 ＋ 折點中心鎖定 */}
      <g
        className={cx(
          "react-flow__edge group/edge",
          isConnectable ? "cursor-pointer pointer-events-stroke" : "pointer-events-none"
        )}
        style={{ pointerEvents: isConnectable ? 'stroke' : 'none' }}
        onClick={(e) => {
          if (!isConnectable) return
          e.stopPropagation()
          if (hasMovedRef.current || consumeWaypointClickGuard()) return
          eData?.onEdgeClick?.()
        }}
      >
        {/* 全線 36px 寬幅透明熱區：滑鼠靠近整條連線任何位置皆可輕鬆 hover 與點擊 */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={36}
          style={{ pointerEvents: isConnectable ? 'stroke' : 'none' }}
          className="react-flow__edge-interaction peer/hit cursor-pointer pointer-events-stroke"
          onClick={(e) => {
            if (!isConnectable) return
            e.stopPropagation()
            if (hasMovedRef.current || consumeWaypointClickGuard()) return
            eData?.onEdgeClick?.()
          }}
        />
        {/* 實體關聯線：懸停時純 CSS 即時加粗為 4px 並帶亮藍柔和發光，0ms 延遲、零 React 重繪、零跳動 */}
        <path
          id={id}
          d={path}
          fill="none"
          markerEnd={markerEnd}
          style={{
            ...style,
            pointerEvents: isConnectable ? 'stroke' : 'none',
            stroke: selected ? '#3b82f6' : (style?.stroke ?? '#ef4444'),
            strokeWidth: selected ? 4 : (style?.strokeWidth ?? 2.5),
            filter: selected ? 'drop-shadow(0 0 5px rgba(59, 130, 246, 0.6))' : undefined,
          }}
          className={cx(
            "react-flow__edge-path cursor-pointer pointer-events-stroke",
            "peer-hover/hit:!stroke-[#3b82f6] peer-hover/hit:!stroke-[4px] peer-hover/hit:[filter:drop-shadow(0_0_5px_rgba(59,130,246,0.6))]",
            "hover:!stroke-[#3b82f6] hover:!stroke-[4px] hover:[filter:drop-shadow(0_0_5px_rgba(59,130,246,0.6))]"
          )}
          onClick={(e) => {
            if (!isConnectable) return
            e.stopPropagation()
            if (hasMovedRef.current || consumeWaypointClickGuard()) return
            eData?.onEdgeClick?.()
          }}
        />
      </g>

      {isConnectable && !isTooClose && (
        <EdgeLabelRenderer>
          <div
            className={cx(
              "nodrag nopan absolute h-3.5 w-3.5 rounded-full border-2 border-white/95 dark:border-slate-800 shadow-xs z-[1000] select-none cursor-grab active:cursor-grabbing",
              "after:absolute after:content-[''] after:-inset-[14px] after:rounded-full after:cursor-grab active:after:cursor-grabbing",
              "hover:scale-135 hover:!bg-blue-500 hover:ring-4 hover:ring-blue-400/40 hover:shadow-md hover:shadow-blue-500/50 hover:z-[1001]",
              selected && "scale-135 !bg-blue-500 ring-4 ring-blue-400/40 shadow-md shadow-blue-500/50 z-[1001]"
            )}
            style={{
              backgroundColor: style?.stroke ?? '#ef4444',
              transform: `translate(-50%, -50%) translate(${px}px, ${py}px)`,
              pointerEvents: 'all',
            }}
            title={T.flow.relationGraph.waypointHint}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={(e) => {
              e.stopPropagation()
              if (hasMovedRef.current || consumeWaypointClickGuard()) return
              eData?.onEdgeClick?.()
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              armWaypointClickGuard()
              scheduleWaypointGuardRelease()
              eData?.onWaypointReset?.(wpKey)
            }}
          />
        </EdgeLabelRenderer>
      )}

      {/* Ref: CR-151 關聯線文字：版面與互動照 SystemFlow.tsx 同一套，跟著折點 (px, py) 走，空的時候完全不畫 */}
      {(edgeText || isEditingText) && (
        <EdgeLabelRenderer>
          <div
            className={cx('nodrag nopan absolute', isEditingText ? 'pointer-events-auto' : 'pointer-events-none')}
            /*
             * Ref: CR-151 .react-flow__edgelabel-renderer 沒有 z-index 且排在 .react-flow__nodes 前面，
             * 而這一頁每張卡片都帶 zIndex(1~30)，不墊高的話文字會被卡片蓋掉而看起來像消失。
             */
            style={{ transform: `translate(-50%, -100%) translate(${px}px, ${py - 14}px)`, zIndex: 1000 }}
          >
            {isEditingText ? (
              // Ref: CR-152 輸入框寬度跟著內容走，只留一個合理的最小寬度
              <input
                type="text"
                value={textDraft}
                autoFocus
                onChange={(e) => setTextDraft(e.target.value)}
                onBlur={() => finishTextEdit(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishTextEdit(true)
                  if (e.key === 'Escape') finishTextEdit(false)
                }}
                placeholder={T.flow.relationGraph.edgeTextPlaceholder}
                style={{ width: `${Math.min(28, Math.max(7, textDraft.length + 2))}ch` }}
                className="rounded-md border border-blue-500 bg-white px-2 py-0.5 text-sm font-semibold text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
              />
            ) : (
              // Ref: CR-152 字放大到 text-sm，命中區就是這塊文字本身（外層容器不吃事件、沒有最小寬度）
              <span
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  if (!isConnectable) return
                  e.stopPropagation()
                  setTextDraft(edgeText)
                  setIsEditingText(true)
                }}
                title={T.flow.relationGraph.edgeTextHint}
                className={cx(
                  "pointer-events-auto inline-block whitespace-nowrap rounded-md border border-slate-200 bg-white/95 px-2 py-0.5 text-sm font-semibold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200",
                  isConnectable ? "cursor-text" : "cursor-default"
                )}
              >
                {edgeText}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = {
  orthogonal: memo(OrthogonalEdge),
}

// Ref: CR-146
const ANNOTATION_STRINGS = T.flow.shared.annotation
const ANNOTATION_COLOR_OPTIONS = T.flow.relationGraph.colorOptions

// Ref: CR-144 文字註記與區域標示框都不是任務，只是畫布上的附加物
const ANNOTATION_KEY_PREFIX = 'pmflow_simple_graph_annotations_'
const TEXT_ID_PREFIX = 'sg-text-'
const FRAME_ID_PREFIX = 'sg-frame-'

type TextAnnotation = { id: string; x: number; y: number; text: string; color: string }
type AreaFrame = { id: string; x: number; y: number; width: number; height: number; label: string; color: string }
type CanvasAnnotations = { texts: TextAnnotation[]; frames: AreaFrame[] }

function isAnnotationId(id: string): boolean {
  return id.startsWith(TEXT_ID_PREFIX) || id.startsWith(FRAME_ID_PREFIX)
}

function loadCanvasAnnotations(projectId?: string): CanvasAnnotations {
  if (!projectId) return { texts: [], frames: [] }
  try {
    const raw = localStorage.getItem(`${ANNOTATION_KEY_PREFIX}${projectId}`)
    if (!raw) return { texts: [], frames: [] }
    const parsed = JSON.parse(raw) as Partial<CanvasAnnotations>
    return {
      texts: Array.isArray(parsed.texts) ? parsed.texts : [],
      frames: Array.isArray(parsed.frames) ? parsed.frames : [],
    }
  } catch {
    return { texts: [], frames: [] }
  }
}

function saveCanvasAnnotations(projectId: string | undefined, data: CanvasAnnotations) {
  if (!projectId) return
  try {
    if (data.texts.length > 0 || data.frames.length > 0) {
      localStorage.setItem(`${ANNOTATION_KEY_PREFIX}${projectId}`, JSON.stringify(data))
    } else {
      localStorage.removeItem(`${ANNOTATION_KEY_PREFIX}${projectId}`)
    }
  } catch {
    // ignore
  }
}

// Ref: CR-151 舊資料是用 `${source}_${target}` 當鍵存的，對稱型關聯重整後兩端會被後端對調而找不到，
// 讀到就順手搬成 link id
function migrateLegacyEdgeKeys<T>(map: Record<string, T>, allEdges: Edge[]): Record<string, T> {
  if (!allEdges.length) return map
  let changed = false
  const next = { ...map }
  for (const e of allEdges) {
    if (next[e.id] !== undefined) continue
    const forward = `${e.source}_${e.target}`
    const reversed = `${e.target}_${e.source}`
    const legacy = next[forward] !== undefined ? forward : next[reversed] !== undefined ? reversed : null
    if (!legacy) continue
    next[e.id] = next[legacy]
    delete next[legacy]
    changed = true
  }
  return changed ? next : map
}

type SimpleAnnotationNodeData = {
  label: string
  color: string
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

// Ref: CR-144 純文字註記：沒有外框、沒有底色、不給接點
function SimpleTextNode({ id, data }: NodeProps) {
  const d = data as unknown as SimpleAnnotationNodeData
  return (
    <div className="group relative cursor-grab select-none active:cursor-grabbing">
      <div
        className={cx(
          'max-w-[420px] whitespace-pre-wrap break-words rounded px-1.5 py-1 text-sm font-semibold leading-relaxed',
          !d.color && 'text-slate-700 dark:text-slate-200'
        )}
        style={d.color ? { color: d.color } : undefined}
      >
        {d.label || ANNOTATION_STRINGS.textFallback}
      </div>

      {/* Ref: CR-153 兩顆鈕整組移到文字上方（bottom-full），短字時也不會壓在字上 */}
      {d.onEdit && (
        <div className="absolute right-0 bottom-full mb-1 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              d.onEdit?.(id)
            }}
            title={ANNOTATION_STRINGS.editText}
            className="cursor-pointer rounded p-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              d.onDelete?.(id)
            }}
            title={ANNOTATION_STRINGS.deleteText}
            className="cursor-pointer rounded p-0.5 text-[11px] text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}

// Ref: CR-144 & CR-154 區域標示框：背景穿透點擊，標頭/縮放控制保留操作
function SimpleFrameNode({ id, data }: NodeProps) {
  const d = data as unknown as SimpleAnnotationNodeData
  const color = d.color || '#8b5cf6'
  return (
    <div className="group relative h-full w-full pointer-events-none select-none">
      {/* 框身背景 (pointer-events-none，點擊可穿透選取線與畫布) */}
      <div
        className="h-full w-full rounded-2xl border-2 border-dashed pointer-events-none"
        style={{ borderColor: color, backgroundColor: `${color}12` }}
      />

      {/* Ref: CR-153 & CR-154 版面與互動逐項對齊 SystemFlow.tsx 的 FlowFrameNode */}
      <div
        className="absolute -top-3 left-3 flex max-w-[85%] cursor-grab items-center gap-1 rounded-lg border bg-white px-2 py-0.5 shadow-xs active:cursor-grabbing dark:bg-slate-900 pointer-events-auto"
        style={{ borderColor: color }}
      >
        <span className="shrink-0 text-[11px]">🏷️</span>
        <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
          {d.label || ANNOTATION_STRINGS.frameFallback}
        </span>
        {d.onEdit && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                d.onEdit?.(id)
              }}
              title={ANNOTATION_STRINGS.editFrame}
              className="cursor-pointer rounded p-0.5 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-blue-600 dark:hover:text-blue-400 pointer-events-auto"
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                d.onDelete?.(id)
              }}
              title={ANNOTATION_STRINGS.deleteFrame}
              className="cursor-pointer rounded p-0.5 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 pointer-events-auto"
            >
              🗑️
            </button>
          </>
        )}
      </div>

      {/* 縮放控制點 (保留 pointer-events-auto) */}
      {d.onEdit && (
        <NodeResizeControl
          minWidth={220}
          minHeight={160}
          style={{ background: 'transparent', border: 'none' }}
          className="nodrag pointer-events-auto"
        >
          <div
            title={T.flow.relationGraph.resizeFrame}
            className="absolute right-1 bottom-1 cursor-se-resize select-none p-1 text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 pointer-events-auto"
          >
            ↘
          </div>
        </NodeResizeControl>
      )}
    </div>
  )
}

export interface TaskGraphProps {
  projectId?: string
  tasks?: Task[]
  onOpenTask?: (taskId: string) => void
  focusedTaskId?: string | null
  menuFocusTarget?: { id: string | null; ts: number } | null
  onSelectTask?: (taskId: string) => void
  canManage?: boolean
}
export type SimpleGraphProps = TaskGraphProps

type ConfirmDeleteEdgeState = {
  edgeId: string
  sourceRef: string
  targetRef: string
  // Ref: CR-151 文字直接掛在 link id 上，不再另外組鍵
  text: string
  color?: string
}

type LogItem = {
  id: string
  time: string
  type: 'move' | 'move_in' | 'move_out' | 'toggle' | 'resize'
  message: string
}

function TaskGraphInner({ projectId, tasks, onOpenTask, focusedTaskId, menuFocusTarget, onSelectTask, canManage = false }: TaskGraphProps) {
  const { fitView, setCenter, getViewport, zoomIn, zoomOut } = useReactFlow()
  const queryClient = useQueryClient()
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => Api.project(projectId!),
    enabled: !!projectId,
  })

  const { data: extraDocRes } = useQuery({
    queryKey: ['canvasDoc', projectId, 'task-graph-extra'],
    queryFn: () => Api.canvasDoc(projectId!, 'task-graph-extra'),
    enabled: !!projectId,
  })

  const { data: canvasNodesRes } = useQuery({
    queryKey: ['canvasNodes', projectId, 'task-graph'],
    queryFn: () => Api.canvasNodes(projectId!, 'task-graph'),
    enabled: !!projectId,
  })

  const typeColorOf = useCallback((typeKey?: string) => {
    if (!typeKey) return '#3178c6'
    const custom = project?.types?.find((p) => p.key === typeKey)?.color
    return custom || DEFAULT_TYPE_COLORS[typeKey] || '#3178c6'
  }, [project])

  const typeNameOf = useCallback((typeKey?: string) => {
    if (!typeKey) return T.flow.relationGraph.typeTask
    const custom = project?.types?.find((p) => p.key === typeKey)?.name
    const DEFAULT_MAP: Record<string, string> = {
      TASK: T.flow.relationGraph.typeTask,
      BUG: T.flow.relationGraph.typeBug,
    }
    return custom || DEFAULT_MAP[typeKey] || (typeKey === 'BUG' ? T.flow.relationGraph.typeBug : T.flow.relationGraph.typeTask)
  }, [project])

  const rolledMap = useMemo(() => rollup(tasks ?? []), [tasks])

  const today = useMemo(() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  const savedViewport = useMemo(() => loadSavedViewport(projectId), [projectId])

  // 後端畫布編輯授權白名單查詢 (Ref: CR-194)
  const { data: permData } = useQuery({
    queryKey: ['canvasPermissions', projectId, 'task-graph'],
    queryFn: () => Api.canvasPermissions(projectId!, 'task-graph'),
    enabled: !!projectId,
  })
  const canManagePerms = Boolean(project?.isCreator || permData?.canManage)
  const isAllowedToEdit = permData ? permData.isAllowed : true
  const [isPermModalOpen, setIsPermModalOpen] = useState(false)

  // 全螢幕檢視狀態控制
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  // 實質編輯狀態：依據後端授權白名單控制
  const effectiveEditable = isAllowedToEdit
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const lastFocusedTsRef = useRef<number>(0)
  const lastFocusedTaskIdRef = useRef<string | null>(null)
  const connectStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null)

  const centerOnNode = useCallback(
    (nodeId: string, duration = 500) => {
      const targetNode = nodes.find((n) => n.id === nodeId)
      if (!targetNode) return false

      let absX = targetNode.position.x
      let absY = targetNode.position.y

      if (targetNode.parentId) {
        let curParentId: string | undefined = targetNode.parentId
        const visited = new Set<string>()
        while (curParentId && !visited.has(curParentId)) {
          visited.add(curParentId)
          const pNode = nodes.find((n) => n.id === curParentId)
          if (pNode) {
            absX += pNode.position.x
            absY += pNode.position.y
            curParentId = pNode.parentId
          } else {
            break
          }
        }
      }

      const isBox = (targetNode.data as SimpleGraphNodeData)?.mode === 'box'
      const w = (targetNode.measured?.width || targetNode.width || (isBox ? 360 : 220)) as number
      const h = (targetNode.measured?.height || targetNode.height || (isBox ? 260 : 80)) as number

      const centerX = absX + w / 2
      const centerY = absY + h / 2

      const currentZoom = getViewport()?.zoom || 1
      const targetZoom = isBox ? Math.min(Math.max(currentZoom, 0.6), 1.0) : Math.min(Math.max(currentZoom, 0.8), 1.2)

      setCenter(centerX, centerY, { duration, zoom: targetZoom })
      return true
    },
    [nodes, setCenter, getViewport]
  )

  // 僅限於從左側 Menu 點擊項目時，才觸發關聯圖鏡頭平滑移動並聚焦至該目標；點擊「全部任務」時觸發顯示全部
  useEffect(() => {
    if (!menuFocusTarget || menuFocusTarget.ts === lastFocusedTsRef.current || !nodes.length) return
    lastFocusedTsRef.current = menuFocusTarget.ts

    if (!menuFocusTarget.id) {
      // 點擊「全部任務」：清除節點選取狀態，並重設鏡頭平滑顯示全圖
      setSelectedNodeId(null)
      fitView({ duration: 500, padding: 0.2 })
      return
    }

    setSelectedNodeId(menuFocusTarget.id)
    centerOnNode(menuFocusTarget.id, 600)
  }, [menuFocusTarget, nodes, fitView, centerOnNode])

  // 當切換頁籤回來或外部 focusedTaskId 變更時，自動平滑聚焦至目標任務卡片
  useEffect(() => {
    if (!focusedTaskId || !nodes.length) return
    if (lastFocusedTaskIdRef.current === focusedTaskId) return
    lastFocusedTaskIdRef.current = focusedTaskId

    setSelectedNodeId(focusedTaskId)
    requestAnimationFrame(() => {
      centerOnNode(focusedTaskId, 400)
    })
  }, [focusedTaskId, nodes, centerOnNode])

  const parallelMap = useMemo(() => {
    const map = new Map<string, { isParallel: boolean; peers: string[] }>()
    if (!edges || !tasks) return map

    const targetMap = new Map<string, Array<{ id: string; ref: string }>>()
    edges.forEach((e) => {
      const sId = String(e.source)
      const tId = String(e.target)
      const sTask = tasks.find((t) => t.id === sId)
      if (!sTask) return
      const sRef = sTask.ref || (sTask.number ? `MRG-${sTask.number}` : (sTask.type === 'BUG' ? T.flow.relationGraph.typeBug : T.flow.relationGraph.typeTask))
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
  }, [edges, tasks])

  const activeSelectedId = selectedNodeId || focusedTaskId

  const relatedSet = useMemo(() => {
    if (!activeSelectedId) return null
    const result = new Set<string>()
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const childrenMap = new Map<string, string[]>()
    nodes.forEach((n) => {
      if (n.parentId) {
        const list = childrenMap.get(n.parentId) || []
        list.push(n.id)
        childrenMap.set(n.parentId, list)
      }
    })

    const collectSubtreeIfBox = (id: string) => {
      if (result.has(id)) return
      result.add(id)
      const n = nodeMap.get(id)
      const isBox = (n?.data as SimpleGraphNodeData)?.mode === 'box'
      if (isBox) {
        const kids = childrenMap.get(id) || []
        kids.forEach((kId) => collectSubtreeIfBox(kId))
      }
    }

    const collectAncestors = (id: string) => {
      let cur = nodeMap.get(id)
      const visited = new Set<string>()
      while (cur?.parentId && !visited.has(cur.id)) {
        visited.add(cur.id)
        result.add(cur.parentId)
        cur = nodeMap.get(cur.parentId)
      }
    }

    // 1. 收集點選節點本身、其祖先收納盒，若為收納盒亦收集其內部所有子節點
    collectSubtreeIfBox(activeSelectedId)
    collectAncestors(activeSelectedId)

    const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]))
    const statusCatMap = new Map(project?.statuses?.map((s) => [s.key, s.category]) ?? [])
    const isDone = (id: string) => {
      const t = taskMap.get(id)
      if (!t) return false
      if (t.progress >= 100) return true
      const cat = statusCatMap.get(t.statusKey)
      return cat === 'DONE' || t.statusKey === 'DONE'
    }

    // 2. 沿依賴連線 (edges) 遞迴搜尋關聯網絡
    // - 下游 (sId 已在高亮中)：持續向下游傳播
    // - 上游 (tId 已在高亮中)：僅當上游任務未完成 (!isDone(sId)) 造成卡住時才高亮
    let changed = true
    while (changed) {
      changed = false
      for (const e of edges) {
        const sHandle = String(e.sourceHandle || '')
        const tHandle = String(e.targetHandle || '')
        // 上下出發/到達的接點不會造成下游卡住，亦不傳播依賴
        const isTopOrBottom = sHandle.includes('top') || sHandle.includes('bottom') || tHandle.includes('top') || tHandle.includes('bottom')
        if (isTopOrBottom) continue

        const sId = String(e.source)
        const tId = String(e.target)
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
  }, [activeSelectedId, edges, nodes, tasks, project?.statuses])

  const blockedByMap = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!tasks || !tasks.length || !edges || !edges.length) return map

    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    const statusCatMap = new Map(project?.statuses?.map((s) => [s.key, s.category]) ?? [])

    const isDone = (t?: Task) => {
      if (!t) return false
      const rolled = rolledMap.get(t.id)
      const prog = rolled?.progress ?? t.progress ?? 0
      // 只要進度未達 100%，即使收納盒本體狀態被誤設為 DONE 也不算完成
      if (prog < 100) return false

      const cat = statusCatMap.get(t.statusKey)
      return cat === 'DONE' || t.statusKey === 'DONE' || prog >= 100
    }

    for (const e of edges) {
      const sHandle = String(e.sourceHandle || '')
      const tHandle = String(e.targetHandle || '')
      // 只有左右出發/到達的接點會造成卡住；上下出發/到達的接點不會造成卡住
      const isTopOrBottom = sHandle.includes('top') || sHandle.includes('bottom') || tHandle.includes('top') || tHandle.includes('bottom')
      if (isTopOrBottom) continue

      const sId = String(e.source)
      const tId = String(e.target)
      const srcTask = taskMap.get(sId)
      const dstTask = taskMap.get(tId)

      if (srcTask && dstTask && !isDone(srcTask) && !isDone(dstTask)) {
        const srcRef = srcTask.ref || (srcTask.number ? `MRG-${srcTask.number}` : T.flow.relationGraph.upstreamFallback)
        const list = map.get(dstTask.id) || []
        if (!list.includes(srcRef)) {
          list.push(srcRef)
        }
        map.set(dstTask.id, list)
      }
    }

    return map
  }, [tasks, edges, project?.statuses, rolledMap])

  const isDraggingRef = useRef(false)

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isAnnotationId(node.id)) return // Ref: CR-144
      if (isDraggingRef.current) return
      setSelectedNodeId(node.id)
      onSelectTask?.(node.id)
    },
    [onSelectTask]
  )

  const onPaneClick = useCallback(() => {
    if (isDraggingRef.current) return
    setSelectedNodeId(null)
    onSelectTask?.('')
  }, [onSelectTask])
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [confirmDeleteEdge, setConfirmDeleteEdge] = useState<ConfirmDeleteEdgeState | null>(null)
  const [confirmUnboxModal, setConfirmUnboxModal] = useState<{ boxId: string; refText: string; count: number } | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [showLogPanel, setShowLogPanel] = useState<boolean>(false)
  const [showHelpTooltip, setShowHelpTooltip] = useState<boolean>(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((type: LogItem['type'], message: string) => {
    const time = new Date().toLocaleTimeString('zh-TW', { hour12: false })
    setLogs((prev) => [...prev.slice(-99), { id: Math.random().toString(), time, type, message }])
  }, [])

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])
  /** 使用者手動切換的模式 (box / card)。按專案 projectId 持久化於 localStorage */
  const [toggledModes, setToggledModes] = useState<Record<string, NodeMode>>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_simple_graph_toggled_modes_${projectId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  /** 收納盒與卡片的折疊狀態。按專案 projectId 持久化於 localStorage */
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_simple_graph_collapsed_${projectId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const handleToggleCollapse = useCallback(
    (nodeId: string) => {
      setCollapsedNodes((prev) => {
        const next = { ...prev, [nodeId]: !prev[nodeId] }
        try {
          if (projectId) {
            localStorage.setItem(`pmflow_simple_graph_collapsed_${projectId}`, JSON.stringify(next))
          }
        } catch {}
        return next
      })
    },
    [projectId]
  )

  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set<string>()
    const addChildrenOf = (pId: string) => {
      nodes.filter((n) => n.parentId === pId).forEach((child) => {
        hidden.add(child.id)
        addChildrenOf(child.id)
      })
    }
    Object.entries(collapsedNodes).forEach(([pId, isCollapsed]) => {
      if (isCollapsed) {
        addChildrenOf(pId)
      }
    })
    return hidden
  }, [nodes, collapsedNodes])

  const dragStartPosMap = useRef<Record<string, { x: number; y: number }>>({})
  const hasFittedRef = useRef(false)
  const isLoadedRef = useRef(false)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const executeToggleMode = useCallback(
    (nodeId: string) => {
      const currentNodes = nodesRef.current
      const targetNode = currentNodes.find((n) => n.id === nodeId)
      const currentMode = toggledModes[nodeId] ?? (targetNode?.data as SimpleGraphNodeData)?.mode ?? 'card'
      const nextMode: NodeMode = currentMode === 'box' ? 'card' : 'box'

      // 若從收納盒轉回卡片，將盒內所有子卡片移出
      if (currentMode === 'box' && nextMode === 'card') {
        const childKids = currentNodes.filter((cn) => cn.parentId === nodeId)
        if (childKids.length > 0) {
          const childIds = new Set(childKids.map((k) => k.id))
          const parentBoxId = targetNode?.parentId || null

          if (parentBoxId) {
            // 若原收納盒自身位於上一層收納盒中，子卡片自動移入該上一層收納盒並自動網格排版
            const parentExistingKids = currentNodes.filter(
              (cn) => cn.parentId === parentBoxId && !childIds.has(cn.id)
            )
            const occupiedSlots = new Set<string>()
            parentExistingKids.forEach((k) => {
              const c = Math.round(((k.position?.x ?? 24) - 24) / 280)
              const r = Math.round(((k.position?.y ?? 110) - 110) / 115)
              if (c >= 0 && r >= 0 && r < 5) {
                occupiedSlots.add(`${c},${r}`)
              }
            })

            const newDraggedEntries: Record<string, { x: number; y: number }> = {}
            const newPosMap = new Map<string, { x: number; y: number }>()

            childKids.forEach((k) => {
              let slotIdx = 0
              let tCol = 0
              let tRow = 0
              while (slotIdx < 10000) {
                tCol = Math.floor(slotIdx / 5)
                tRow = slotIdx % 5
                if (!occupiedSlots.has(`${tCol},${tRow}`)) {
                  occupiedSlots.add(`${tCol},${tRow}`)
                  break
                }
                slotIdx++
              }
              const targetSlotPos = { x: 24 + tCol * 280, y: 110 + tRow * 115 }
              newDraggedEntries[k.id] = targetSlotPos
              newPosMap.set(k.id, targetSlotPos)

              Api.moveTask(k.id, { parentId: parentBoxId }).catch((err) =>
                console.error('Failed to move task to parent box:', err)
              )
            })

            if (projectId) {
              queryClient.setQueryData(['tasks', projectId], (oldData: { tasks: Task[] } | undefined) => {
                if (!oldData || !Array.isArray(oldData.tasks)) return oldData
                return {
                  ...oldData,
                  tasks: oldData.tasks.map((t) => (childIds.has(t.id) ? { ...t, parentId: parentBoxId } : t)),
                }
              })
            }

            setDragged((prev) => ({
              ...prev,
              ...newDraggedEntries,
            }))

            setNodes((prevNodes) =>
              prevNodes.map((n) => {
                if (n.id === nodeId) {
                  return {
                    ...n,
                    width: 256,
                    height: undefined,
                    style: { width: 256 },
                    data: {
                      ...n.data,
                      mode: 'card',
                    },
                  }
                }
                if (childIds.has(n.id)) {
                  const p = newPosMap.get(n.id) ?? n.position
                  return {
                    ...n,
                    parentId: parentBoxId,
                    position: p,
                  }
                }
                return n
              })
            )
          } else {
            // 若原收納盒位於畫布最外層，呼叫 API 將子卡片的 parentId 設為 null，轉換為畫布絕對座標原地展開
            childKids.forEach((k) => {
              Api.moveTask(k.id, { parentId: null }).catch((err) =>
                console.error('Failed to move task out of box:', err)
              )
            })

            if (projectId) {
              queryClient.setQueryData(['tasks', projectId], (oldData: { tasks: Task[] } | undefined) => {
                if (!oldData || !Array.isArray(oldData.tasks)) return oldData
                return {
                  ...oldData,
                  tasks: oldData.tasks.map((t) => (childIds.has(t.id) ? { ...t, parentId: null } : t)),
                }
              })
            }

            const boxX = targetNode?.position.x ?? 0
            const boxY = targetNode?.position.y ?? 0

            const newDraggedEntries: Record<string, { x: number; y: number }> = {}
            childKids.forEach((k) => {
              newDraggedEntries[k.id] = {
                x: boxX + k.position.x,
                y: boxY + k.position.y,
              }
            })
            setDragged((prev) => ({
              ...prev,
              ...newDraggedEntries,
            }))

            setNodes((prevNodes) =>
              prevNodes.map((n) => {
                if (n.id === nodeId) {
                  return {
                    ...n,
                    width: 256,
                    height: undefined,
                    style: { width: 256 },
                    data: {
                      ...n.data,
                      mode: 'card',
                    },
                  }
                }
                if (childIds.has(n.id)) {
                  return {
                    ...n,
                    parentId: undefined,
                    position: {
                      x: boxX + n.position.x,
                      y: boxY + n.position.y,
                    },
                  }
                }
                return n
              })
            )
          }
        }
      } else {
        // 沒有子卡片時的純模式切換
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                width: nextMode === 'box' ? 340 : 256,
                height: nextMode === 'box' ? 260 : undefined,
                style: nextMode === 'box' ? { width: 340, minHeight: 240 } : { width: 256 },
                data: {
                  ...n.data,
                  mode: nextMode,
                },
              }
            }
            return n
          })
        )
      }

      setToggledModes((prev) => {
        const currentNodes = nodesRef.current
        const targetNode = currentNodes.find((n) => n.id === nodeId)
        const refText = (targetNode?.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card
        addLog('toggle', T.flow.relationGraph.log.modeToggled(refText, nextMode === 'box' ? T.flow.relationGraph.box : T.flow.relationGraph.card))

        try {
          const savedBoxesStr = localStorage.getItem('pmflow_graph_container_boxes')
          const boxSet = new Set<string>(savedBoxesStr ? JSON.parse(savedBoxesStr) : [])
          if (nextMode === 'box') {
            boxSet.add(nodeId)
          } else {
            boxSet.delete(nodeId)
          }
          localStorage.setItem('pmflow_graph_container_boxes', JSON.stringify(Array.from(boxSet)))
          window.dispatchEvent(new Event('pmflow_container_boxes_changed'))
        } catch (e) {
          console.error('Failed to sync container box to localStorage:', e)
        }

        if (projectId) {
          Api.patchCanvasNodes(projectId, 'task-graph', {
            nodes: { [nodeId]: { mode: nextMode } },
          }).catch(() => {})
        }

        return {
          ...prev,
          [nodeId]: nextMode,
        }
      })
    },
    [addLog, projectId, queryClient, toggledModes]
  )

  const handleToggleMode = useCallback(
    (nodeId: string) => {
      if (!effectiveEditable) return
      const currentNodes = nodesRef.current
      const targetNode = currentNodes.find((n) => n.id === nodeId)
      const nodeData = targetNode?.data as SimpleGraphNodeData
      if (nodeData?.taskType === 'BUG') {
        return
      }
      const currentMode = toggledModes[nodeId] ?? nodeData?.mode ?? 'card'
      const refText = nodeData?.refText || T.flow.relationGraph.box

      if (currentMode === 'box') {
        const childKids = currentNodes.filter((cn) => cn.parentId === nodeId)
        if (childKids.length > 0) {
          const childIds = new Set(childKids.map((k) => k.id))
          const currentEdges = edgesRef.current
          const affectedEdges = currentEdges.filter(
            (e) => childIds.has(String(e.source)) || childIds.has(String(e.target))
          )
          if (affectedEdges.length > 0) {
            setAlertMsg(T.flow.relationGraph.alertUnboxBoxHasEdges(refText))
            return
          }
          setConfirmUnboxModal({
            boxId: nodeId,
            refText,
            count: childKids.length,
          })
          return
        }
      }

      executeToggleMode(nodeId)
    },
    [toggledModes, executeToggleMode]
  )

  /** 使用者拖過的節點位置。按專案 projectId 持久化於 localStorage (對齊 Graph.tsx) */
  const [dragged, setDragged] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_simple_graph_dragged_${projectId}`)
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      const clean: Record<string, { x: number; y: number }> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof (v as any).x === 'number' && typeof (v as any).y === 'number') {
          clean[k] = { x: (v as any).x, y: (v as any).y }
        }
      }
      return clean
    } catch {
      return {}
    }
  })

  // Ref: CR-139
  const [waypoints, setWaypoints] = useState<WaypointMap>(() => loadWaypoints(projectId))

  // Ref: CR-150
  const [edgeTexts, setEdgeTexts] = useState<EdgeTextMap>(() => loadEdgeTexts(projectId))

  // Ref: CR-188
  const [edgeColors, setEdgeColors] = useState<EdgeColorMap>(() => loadEdgeColors(projectId))

  // Ref: CR-144
  const [annotations, setAnnotations] = useState<CanvasAnnotations>(() => loadCanvasAnnotations(projectId))
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations
  const [editingAnnotation, setEditingAnnotation] = useState<
    { id: string; kind: 'text' | 'frame'; label: string; color: string } | null
  >(null)

  const backendExtraSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedExtraJsonRef = useRef<string>('')
  const lastAppliedExtraUpdatedAtRef = useRef<string | null>(null)

  const backendNodesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedNodesJsonRef = useRef<string>('')
  const lastAppliedNodesJsonRef = useRef<string>('')
  const isApplyingServerSyncRef = useRef<boolean>(false)

  // 監聽即時廣播事件：當其他使用者更新畫布或任務時立即刷新快取 (Ref: CR-213, CR-225)
  useEffect(() => {
    const handleRealtimeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<any>
      const ev = customEvent.detail
      if (!ev) return

      if (ev.projectId && ev.projectId === projectId) {
        if (ev.type === 'canvas:changed' || ev.type === 'task:changed') {
          queryClient.invalidateQueries({ queryKey: ['canvasNodes', projectId, 'task-graph'] })
          queryClient.invalidateQueries({ queryKey: ['canvasDoc', projectId, 'task-graph-extra'] })
          queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
          queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
        }
      }
    }

    window.addEventListener('pmflow_realtime_event', handleRealtimeEvent)
    return () => window.removeEventListener('pmflow_realtime_event', handleRealtimeEvent)
  }, [projectId, queryClient])

  // 載入後端共享註記、折點與文字 (task-graph-extra) 並即時同步 (Ref: CR-213)
  useEffect(() => {
    if (!extraDocRes?.data || !projectId) return
    const extraData = extraDocRes.data as {
      annotations?: CanvasAnnotations
      waypoints?: WaypointMap
      edgeTexts?: EdgeTextMap
      edgeColors?: EdgeColorMap
    }
    if (!extraData || typeof extraData !== 'object') return

    const incomingJson = JSON.stringify(extraData)
    if (incomingJson === lastSavedExtraJsonRef.current) return
    lastSavedExtraJsonRef.current = incomingJson

    if (extraData.annotations && (Array.isArray(extraData.annotations.texts) || Array.isArray(extraData.annotations.frames))) {
      const cleanAnn: CanvasAnnotations = {
        texts: Array.isArray(extraData.annotations.texts) ? extraData.annotations.texts : [],
        frames: Array.isArray(extraData.annotations.frames) ? extraData.annotations.frames : [],
      }
      setAnnotations(cleanAnn)
      saveCanvasAnnotations(projectId, cleanAnn)
    }
    if (extraData.waypoints && typeof extraData.waypoints === 'object') {
      setWaypoints(extraData.waypoints)
      saveWaypoints(projectId, extraData.waypoints)
    }
    if (extraData.edgeTexts && typeof extraData.edgeTexts === 'object') {
      setEdgeTexts(extraData.edgeTexts)
      saveEdgeTexts(projectId, extraData.edgeTexts)
    }
    if (extraData.edgeColors && typeof extraData.edgeColors === 'object') {
      setEdgeColors(extraData.edgeColors)
      saveEdgeColors(projectId, extraData.edgeColors)
    }
  }, [extraDocRes, projectId])

  // 載入後端共享節點排版與收納狀態 (canvas/task-graph) 並即時同步 (Ref: CR-213, CR-225)
  useEffect(() => {
    if (!canvasNodesRes?.nodes || !projectId) return
    const rawNodes = canvasNodesRes.nodes
    const nodeEntries = Object.entries(rawNodes)
    if (nodeEntries.length === 0) return

    const incomingJson = JSON.stringify(rawNodes)
    if (incomingJson === lastAppliedNodesJsonRef.current) return

    lastAppliedNodesJsonRef.current = incomingJson
    isApplyingServerSyncRef.current = true

    const serverDragged: Record<string, { x: number; y: number }> = {}
    const serverResized: Record<string, { width: number; height: number }> = {}
    const serverModes: Record<string, NodeMode> = {}

    for (const [nodeId, n] of nodeEntries) {
      if (n && typeof n.x === 'number' && typeof n.y === 'number') {
        serverDragged[nodeId] = { x: n.x, y: n.y }
      }
      if (n && typeof n.width === 'number' && typeof n.height === 'number') {
        serverResized[nodeId] = { width: n.width, height: n.height }
      }
      if (n && (n.mode === 'box' || n.mode === 'card')) {
        serverModes[nodeId] = n.mode
      }
    }

    if (Object.keys(serverDragged).length > 0) {
      draggedRef.current = { ...draggedRef.current, ...serverDragged }
      setDragged((prev) => {
        const merged = { ...prev, ...serverDragged }
        try {
          localStorage.setItem(`pmflow_simple_graph_dragged_${projectId}`, JSON.stringify(merged))
        } catch {}
        return merged
      })
    }

    if (Object.keys(serverResized).length > 0) {
      resizedRef.current = { ...resizedRef.current, ...serverResized }
      setResized((prev) => {
        const merged = { ...prev, ...serverResized }
        try {
          localStorage.setItem(`pmflow_simple_graph_resized_${projectId}`, JSON.stringify(merged))
        } catch {}
        return merged
      })
    }

    if (Object.keys(serverModes).length > 0) {
      toggledModesRef.current = { ...toggledModesRef.current, ...serverModes }
      setToggledModes((prev) => {
        const merged = { ...prev, ...serverModes }
        try {
          localStorage.setItem(`pmflow_simple_graph_toggled_modes_${projectId}`, JSON.stringify(merged))
        } catch {}
        return merged
      })
    }

    // 若使用者當前未在拖曳中，即時同步更新畫布節點位置與樣式
    if (!interactingRef.current && !isDraggingRef.current) {
      setNodes((prevNodes) => {
        let hasChanges = false
        const next = prevNodes.map((n) => {
          const sPos = serverDragged[n.id]
          const sSize = serverResized[n.id]
          const sMode = serverModes[n.id]
          if (!sPos && !sSize && !sMode) return n

          let nodeChanged = false
          let nextPos = n.position
          if (sPos && (sPos.x !== n.position.x || sPos.y !== n.position.y)) {
            nextPos = sPos
            nodeChanged = true
          }
          let nextStyle = n.style
          let nextWidth = n.width
          let nextHeight = n.height
          if (sSize && (sSize.width !== n.width || sSize.height !== n.height)) {
            nextWidth = sSize.width
            nextHeight = sSize.height
            nextStyle = { ...(n.style || {}), width: sSize.width, height: sSize.height }
            nodeChanged = true
          }
          let nextData = n.data
          if (sMode && (n.data as SimpleGraphNodeData)?.mode !== sMode) {
            nextData = { ...(n.data || {}), mode: sMode }
            nodeChanged = true
          }

          if (nodeChanged) {
            hasChanges = true
            return {
              ...n,
              position: nextPos,
              width: nextWidth,
              height: nextHeight,
              style: nextStyle,
              data: nextData,
            }
          }
          return n
        })
        return hasChanges ? orderParentNodesFirst(next) : prevNodes
      })
    }

    setTimeout(() => {
      isApplyingServerSyncRef.current = false
    }, 400)
  }, [canvasNodesRes, projectId])

  const saveExtraToBackend = useCallback(
    (nextAnn: CanvasAnnotations, nextWp: WaypointMap, nextTexts: EdgeTextMap, nextColors: EdgeColorMap) => {
      if (!projectId) return
      const payload = { annotations: nextAnn, waypoints: nextWp, edgeTexts: nextTexts, edgeColors: nextColors }
      const json = JSON.stringify(payload)
      if (json === lastSavedExtraJsonRef.current) return

      if (backendExtraSaveTimerRef.current) {
        clearTimeout(backendExtraSaveTimerRef.current)
      }
      backendExtraSaveTimerRef.current = setTimeout(async () => {
        backendExtraSaveTimerRef.current = null
        try {
          lastSavedExtraJsonRef.current = json
          await Api.saveCanvasDoc(projectId, 'task-graph-extra', { data: payload })
        } catch (err) {
          console.error('Failed to save task-graph-extra canvas doc to backend:', err)
        }
      }, 600)
    },
    [projectId]
  )

  const saveNodesToBackend = useCallback(
    (
      currentDragged: Record<string, { x: number; y: number }>,
      currentResized: Record<string, { width: number; height: number }>,
      currentModes: Record<string, NodeMode>
    ) => {
      if (!projectId || isApplyingServerSyncRef.current) return

      const allNodeIds = new Set([
        ...Object.keys(currentDragged),
        ...Object.keys(currentResized),
        ...Object.keys(currentModes),
      ])
      if (allNodeIds.size === 0) return

      const patchPayload: Record<
        string,
        { x?: number | null; y?: number | null; width?: number | null; height?: number | null; mode?: string | null }
      > = {}

      for (const id of allNodeIds) {
        patchPayload[id] = {
          x: currentDragged[id]?.x ?? null,
          y: currentDragged[id]?.y ?? null,
          width: currentResized[id]?.width ?? null,
          height: currentResized[id]?.height ?? null,
          mode: currentModes[id] ?? null,
        }
      }

      const json = JSON.stringify(patchPayload)
      if (json === lastSavedNodesJsonRef.current) return

      if (backendNodesSaveTimerRef.current) {
        clearTimeout(backendNodesSaveTimerRef.current)
      }
      backendNodesSaveTimerRef.current = setTimeout(async () => {
        backendNodesSaveTimerRef.current = null
        try {
          lastSavedNodesJsonRef.current = json
          await Api.patchCanvasNodes(projectId, 'task-graph', { nodes: patchPayload })
        } catch (err) {
          console.error('Failed to save task-graph canvas nodes to backend:', err)
        }
      }, 600)
    },
    [projectId]
  )

  /*
   * Ref: CR-151 落盤策略改成跟 SystemFlow.tsx 同一套：拖曳／縮放進行中只把待寫的內容記起來不落盤，
   * 放開才寫一次；另留一個保險計時器，避免收不到結束事件時整段互動都沒存到。
   */
  const interactingRef = useRef(false)
  const pendingWritesRef = useRef<Record<string, () => void>>({})
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commitCanvas = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingWritesRef.current
    pendingWritesRef.current = {}
    Object.values(pending).forEach((write) => write())
  }, [])

  const queueCanvasWrite = useCallback(
    (key: string, write: () => void) => {
      pendingWritesRef.current[key] = write
      if (!interactingRef.current) {
        commitCanvas()
        return
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        commitCanvas()
      }, 800)
    },
    [commitCanvas]
  )

  const beginInteraction = useCallback(() => {
    interactingRef.current = true
  }, [])

  const endInteraction = useCallback(() => {
    interactingRef.current = false
    if (Object.keys(pendingWritesRef.current).length > 0) commitCanvas()
  }, [commitCanvas])

  useEffect(() => () => commitCanvas(), [commitCanvas])

  // Ref: CR-151
  useEffect(() => {
    queueCanvasWrite('waypoints', () => {
      saveWaypoints(projectId, waypoints)
      saveExtraToBackend(annotationsRef.current, waypoints, edgeTexts, edgeColors)
    })
  }, [waypoints, projectId, queueCanvasWrite, saveExtraToBackend, edgeTexts, edgeColors])

  const handleWaypointChange = useCallback((key: string, p: Waypoint) => {
    setWaypoints((prev) => ({ ...prev, [key]: p }))
  }, [])

  const handleWaypointReset = useCallback((key: string) => {
    setWaypoints((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // Ref: CR-150
  useEffect(() => {
    queueCanvasWrite('edgeTexts', () => {
      saveEdgeTexts(projectId, edgeTexts)
      saveExtraToBackend(annotationsRef.current, waypoints, edgeTexts, edgeColors)
    })
  }, [edgeTexts, projectId, queueCanvasWrite, saveExtraToBackend, waypoints, edgeColors])

  const handleSaveEdgeText = useCallback((edgeId: string, text: string) => {
    const trimmed = text.trim()
    setEdgeTexts((prev) => {
      if ((prev[edgeId] ?? '') === trimmed) return prev
      const next = { ...prev }
      if (trimmed) {
        next[edgeId] = trimmed
      } else {
        delete next[edgeId]
      }
      return next
    })
  }, [])

  // Ref: CR-188
  useEffect(() => {
    queueCanvasWrite('edgeColors', () => {
      saveEdgeColors(projectId, edgeColors)
      saveExtraToBackend(annotationsRef.current, waypoints, edgeTexts, edgeColors)
    })
  }, [edgeColors, projectId, queueCanvasWrite, saveExtraToBackend, waypoints, edgeTexts])

  const handleSaveEdgeColor = useCallback((edgeId: string, color: string) => {
    const trimmed = color.trim()
    setEdgeColors((prev) => {
      if ((prev[edgeId] ?? '') === trimmed) return prev
      const next = { ...prev }
      if (trimmed) {
        next[edgeId] = trimmed
      } else {
        delete next[edgeId]
      }
      return next
    })
  }, [])

  // Ref: CR-151 關聯線一進來就把舊鍵搬成 link id，使用者已經拖好的轉角與寫過的文字不會歸零
  useEffect(() => {
    if (edges.length === 0) return
    setWaypoints((prev) => migrateLegacyEdgeKeys(prev, edges))
    setEdgeTexts((prev) => migrateLegacyEdgeKeys(prev, edges))
    setEdgeColors((prev) => migrateLegacyEdgeKeys(prev, edges))
  }, [edges])

  // Ref: CR-151
  useEffect(() => {
    queueCanvasWrite('annotations', () => {
      saveCanvasAnnotations(projectId, annotations)
      saveExtraToBackend(annotations, waypoints, edgeTexts, edgeColors)
    })
  }, [annotations, projectId, queueCanvasWrite, saveExtraToBackend, waypoints, edgeTexts, edgeColors])

  const handleAddTextAnnotation = useCallback(() => {
    if (!effectiveEditable) return
    const id = `${TEXT_ID_PREFIX}${Date.now()}`
    setAnnotations((prev) => ({
      ...prev,
      texts: [
        ...prev.texts,
        {
          id,
          x: 120 + Math.round(Math.random() * 80),
          y: 100 + Math.round(Math.random() * 80),
          text: ANNOTATION_STRINGS.newTextDefault,
          color: '',
        },
      ],
    }))
  }, [effectiveEditable])

  const handleAddAreaFrame = useCallback(() => {
    if (!effectiveEditable) return
    const id = `${FRAME_ID_PREFIX}${Date.now()}`
    setAnnotations((prev) => ({
      ...prev,
      frames: [
        ...prev.frames,
        {
          id,
          x: 60 + Math.round(Math.random() * 60),
          y: 40 + Math.round(Math.random() * 60),
          width: 420,
          height: 300,
          label: ANNOTATION_STRINGS.newFrameDefault,
          color: '#8b5cf6',
        },
      ],
    }))
  }, [effectiveEditable])

  const handleEditAnnotation = useCallback((id: string) => {
    if (!effectiveEditable) return
    const cur = annotationsRef.current
    const t = cur.texts.find((x) => x.id === id)
    if (t) {
      setEditingAnnotation({ id, kind: 'text', label: t.text, color: t.color })
      return
    }
    const f = cur.frames.find((x) => x.id === id)
    if (f) setEditingAnnotation({ id, kind: 'frame', label: f.label, color: f.color })
  }, [effectiveEditable])

  const handleDeleteAnnotation = useCallback((id: string) => {
    if (!effectiveEditable) return
    setAnnotations((prev) => ({
      texts: prev.texts.filter((t) => t.id !== id),
      frames: prev.frames.filter((f) => f.id !== id),
    }))
    setEditingAnnotation((prev) => (prev?.id === id ? null : prev))
  }, [effectiveEditable])

  const handleSaveAnnotationEdit = useCallback(() => {
    if (!effectiveEditable) return
    setEditingAnnotation((cur) => {
      if (!cur) return null
      setAnnotations((prev) =>
        cur.kind === 'text'
          ? { ...prev, texts: prev.texts.map((t) => (t.id === cur.id ? { ...t, text: cur.label, color: cur.color } : t)) }
          : { ...prev, frames: prev.frames.map((f) => (f.id === cur.id ? { ...f, label: cur.label, color: cur.color } : f)) }
      )
      return null
    })
  }, [effectiveEditable])

  // Ref: CR-148
  const annotationNodeCacheRef = useRef(new Map<string, { key: string; node: Node }>())

  /*
   * Ref: CR-153 隔壁的註記節點住在 nodes 裡，React Flow 量完會透過 dimensions 變更把 measured
   * 寫回節點物件，之後每次 `{...node}` 都原封帶著走；這一頁的註記是每次從 x/y/文字重新組出來的，
   * measured 一直是空的，adoptUserNodes 就會判定「還沒量過」而把節點畫成 visibility:hidden
   * （＝按住文字就消失）。這裡自己把量到的尺寸記下來，組節點時補回去。
   */
  const annotationMeasuredRef = useRef(new Map<string, { width: number; height: number }>())

  const annotationNodes = useMemo<Node[]>(() => {
    // Ref: CR-148
    const prevCache = annotationNodeCacheRef.current
    const nextCache = new Map<string, { key: string; node: Node }>()
    const reuseOrBuild = (id: string, key: string, build: () => Node): Node => {
      const hit = prevCache.get(id)
      if (hit && hit.key === key) {
        nextCache.set(id, hit)
        return hit.node
      }
      const node = build()
      if (!node.measured && hit?.node.measured) node.measured = hit.node.measured
      nextCache.set(id, { key, node })
      return node
    }

    const frameNodes: Node[] = annotations.frames.map((f) =>
      reuseOrBuild(f.id, `${f.x}|${f.y}|${f.width}|${f.height}|${f.label}|${f.color}|${effectiveEditable}`, () => ({
        id: f.id,
        type: 'annotationFrame',
        position: { x: f.x, y: f.y },
        style: { width: f.width, height: f.height },
        width: f.width,
        height: f.height,
        measured: { width: f.width, height: f.height },
        draggable: effectiveEditable,
        selectable: false,
        connectable: false,
        deletable: false,
        // Ref: CR-152 墊到所有卡片(1~30)與關聯線之下，框身可拖但搶不走它們的點擊
        zIndex: -1,
        data: { label: f.label, color: f.color, onEdit: effectiveEditable ? handleEditAnnotation : undefined, onDelete: effectiveEditable ? handleDeleteAnnotation : undefined },
      }))
    )
    const textNodes: Node[] = annotations.texts.map((t) =>
      reuseOrBuild(t.id, `${t.x}|${t.y}|${t.text}|${t.color}|${effectiveEditable}`, () => ({
        id: t.id,
        type: 'annotationText',
        position: { x: t.x, y: t.y },
        // Ref: CR-153
        measured: annotationMeasuredRef.current.get(t.id),
        draggable: effectiveEditable,
        selectable: false,
        connectable: false,
        deletable: false,
        zIndex: 25,
        data: { label: t.text, color: t.color, onEdit: effectiveEditable ? handleEditAnnotation : undefined, onDelete: effectiveEditable ? handleDeleteAnnotation : undefined },
      }))
    )
    annotationNodeCacheRef.current = nextCache
    return [...frameNodes, ...textNodes]
  }, [annotations, effectiveEditable, handleEditAnnotation, handleDeleteAnnotation])

  /** 使用者手動調整大小的框。按專案 projectId 持久化於 localStorage (對齊 Graph.tsx) */
  const [resized, setResized] = useState<Record<string, { width: number; height: number }>>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_simple_graph_resized_${projectId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const draggedRef = useRef(dragged)
  draggedRef.current = dragged
  const resizedRef = useRef(resized)
  resizedRef.current = resized
  const toggledModesRef = useRef(toggledModes)
  toggledModesRef.current = toggledModes

  // 切換專案時自動重置對焦狀態並載入該專案的持久化位置、尺寸與模式
  useEffect(() => {
    hasFittedRef.current = false
    try {
      const savedD = localStorage.getItem(`pmflow_simple_graph_dragged_${projectId}`)
      if (savedD) {
        const parsed = JSON.parse(savedD)
        const clean: Record<string, { x: number; y: number }> = {}
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof (v as any).x === 'number' && typeof (v as any).y === 'number') {
            clean[k] = { x: (v as any).x, y: (v as any).y }
          }
        }
        setDragged(clean)
      } else {
        setDragged({})
      }
      const savedR = localStorage.getItem(`pmflow_simple_graph_resized_${projectId}`)
      setResized(savedR ? JSON.parse(savedR) : {})

      const savedM = localStorage.getItem(`pmflow_simple_graph_toggled_modes_${projectId}`)
      setToggledModes(savedM ? JSON.parse(savedM) : {})
    } catch {
      setDragged({})
      setResized({})
      setToggledModes({})
    }
    isLoadedRef.current = true
  }, [projectId])

  // 卸載 (切換頁籤/專案) 前備份所有節點當前位置至 localStorage 與後端
  useEffect(() => {
    return () => {
      if (!projectId) return
      if (backendExtraSaveTimerRef.current) {
        clearTimeout(backendExtraSaveTimerRef.current)
        backendExtraSaveTimerRef.current = null
        Api.saveCanvasDoc(projectId, 'task-graph-extra', {
          data: {
            annotations: annotationsRef.current,
            waypoints,
            edgeTexts,
          },
        }).catch(() => {})
      }
      if (backendNodesSaveTimerRef.current) {
        clearTimeout(backendNodesSaveTimerRef.current)
        backendNodesSaveTimerRef.current = null
        const patchPayload: Record<
          string,
          { x?: number | null; y?: number | null; width?: number | null; height?: number | null; mode?: string | null }
        > = {}
        for (const [id, pos] of Object.entries(draggedRef.current)) {
          patchPayload[id] = {
            x: pos.x,
            y: pos.y,
            width: resizedRef.current[id]?.width ?? null,
            height: resizedRef.current[id]?.height ?? null,
            mode: toggledModes[id] ?? null,
          }
        }
        if (Object.keys(patchPayload).length > 0) {
          Api.patchCanvasNodes(projectId, 'task-graph', { nodes: patchPayload }).catch(() => {})
        }
      }
    }
  }, [projectId, waypoints, edgeTexts, toggledModes])

  const { data: graphData } = useQuery({
    queryKey: ['graph', projectId],
    queryFn: () => Api.graph(projectId ?? ''),
    enabled: !!projectId,
  })

  // 載入專案真實關聯線 (Edges) 並帶入正確使用者選取的接點 (sourceHandle & targetHandle)
  useEffect(() => {
    if (!graphData?.edges) return
    let savedMap: Record<string, { sourceHandle?: string; targetHandle?: string }> = {}
    try {
      const savedStr = localStorage.getItem(`pmflow_simple_graph_edge_handles_${projectId}`)
      if (savedStr) savedMap = JSON.parse(savedStr)
    } catch {}

    const taskIds = new Set(((graphData as any).nodes ?? tasks ?? []).map((t: any) => t.id))
    const linkList = (graphData as any).edges || (graphData as any).links || []
    const realEdges: Edge[] = linkList
      .filter((e: any) => taskIds.has(e.sourceId) && taskIds.has(e.targetId))
      .map((e: any) => {
        const edgeKey = `${e.sourceId}_${e.targetId}`
        const hData = savedMap[edgeKey] || savedMap[e.id]
        const sHandle = e.sourceHandle || hData?.sourceHandle
        const tHandle = e.targetHandle || hData?.targetHandle
        const { style, markerEnd } = getEdgeStyleAndMarker(sHandle)
        return {
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          sourceHandle: sHandle,
          targetHandle: tHandle,
          type: 'orthogonal',
          animated: true,
          style,
          markerEnd,
        }
      })

    setEdges((prevEds) => {
      // 保留正在連線或尚未包含在本次 graphData 中的樂觀連線，防止伺服器快取刷新時差抹除連線
      const pendingOptimistic = prevEds.filter((e) =>
        !realEdges.some((re) =>
          re.id === e.id ||
          (re.source === e.source && re.target === e.target &&
           re.sourceHandle === e.sourceHandle && re.targetHandle === e.targetHandle)
        )
      )
      return [...realEdges, ...pendingOptimistic]
    })
  }, [graphData, projectId, tasks])

  // 僅當「完全沒有儲存過 Viewport 且沒有指定聚焦任務」時，首次進入才執行 fitView
  useEffect(() => {
    if (savedViewport || focusedTaskId) return // 已有儲存視角或有選中焦點時，保留焦點或使用者視角，不自動重置

    if (nodes.length > 0 && !hasFittedRef.current) {
      const allMeasured = nodes.every(
        (n) => n.measured && typeof n.measured.width === 'number' && n.measured.width > 0
      )
      if (allMeasured) {
        hasFittedRef.current = true
        requestAnimationFrame(() => {
          fitView({ padding: 0.2, duration: 250 })
        })
      } else {
        const timer = setTimeout(() => {
          if (!hasFittedRef.current) {
            hasFittedRef.current = true
            fitView({ padding: 0.2, duration: 250 })
          }
        }, 150)
        return () => clearTimeout(timer)
      }
    }
  }, [nodes, fitView, savedViewport, focusedTaskId])

  // 每次拖曳移位自動寫入 localStorage 與後端保存 (僅在載入完成後生效)
  useEffect(() => {
    if (!projectId || !isLoadedRef.current || isApplyingServerSyncRef.current) return
    queueCanvasWrite('dragged', () => {
      try {
        if (Object.keys(dragged).length > 0) {
          localStorage.setItem(`pmflow_simple_graph_dragged_${projectId}`, JSON.stringify(dragged))
        } else {
          localStorage.removeItem(`pmflow_simple_graph_dragged_${projectId}`)
        }
      } catch {}
      saveNodesToBackend(dragged, resizedRef.current, toggledModes)
    })
  }, [dragged, projectId, queueCanvasWrite, saveNodesToBackend, toggledModes])

  // 每次調整大小自動寫入 localStorage 與後端保存 (僅在載入完成後生效)
  // Ref: CR-151
  useEffect(() => {
    if (!projectId || !isLoadedRef.current || isApplyingServerSyncRef.current) return
    queueCanvasWrite('resized', () => {
      try {
        if (Object.keys(resized).length > 0) {
          localStorage.setItem(`pmflow_simple_graph_resized_${projectId}`, JSON.stringify(resized))
        } else {
          localStorage.removeItem(`pmflow_simple_graph_resized_${projectId}`)
        }
      } catch {}
      saveNodesToBackend(draggedRef.current, resized, toggledModes)
    })
  }, [resized, projectId, queueCanvasWrite, saveNodesToBackend, toggledModes])

  // 每次切換模式自動寫入 localStorage 與後端保存 (僅在載入完成後生效)
  useEffect(() => {
    if (!projectId || !isLoadedRef.current || isApplyingServerSyncRef.current) return
    queueCanvasWrite('toggledModes', () => {
      try {
        if (Object.keys(toggledModes).length > 0) {
          localStorage.setItem(
            `pmflow_simple_graph_toggled_modes_${projectId}`,
            JSON.stringify(toggledModes)
          )
        } else {
          localStorage.removeItem(`pmflow_simple_graph_toggled_modes_${projectId}`)
        }
      } catch {}
      saveNodesToBackend(draggedRef.current, resizedRef.current, toggledModes)
    })
  }, [toggledModes, projectId, queueCanvasWrite, saveNodesToBackend])

  // 當 props.tasks 變動時，自動將 Left Menu 任務動態轉換為關聯圖節點
  useEffect(() => {
    if (interactingRef.current || isDraggingRef.current) return
    if (!tasks || tasks.length === 0) {
      setNodes([])
      return
    }

    const draggedMap = draggedRef.current
    const resizedMap = resizedRef.current
    const currentModes = toggledModesRef.current
    const statusCatMap = new Map(project?.statuses?.map((s) => [s.key, s.category]) ?? [])

    const parentIdSet = new Set<string>()
    tasks.forEach((t) => {
      if (t.parentId) parentIdSet.add(t.parentId)
      if (t.type === 'EPIC') parentIdSet.add(t.id)
    })

    const childrenMap = new Map<string, Task[]>()
    tasks.forEach((t) => {
      if (t.parentId) {
        const list = childrenMap.get(t.parentId) || []
        list.push(t)
        childrenMap.set(t.parentId, list)
      }
    })

    const collectActiveProblemBugs = (rootId: string): Task[] => {
      const result: Task[] = []
      const visited = new Set<string>()
      const walk = (pId: string) => {
        if (visited.has(pId)) return
        visited.add(pId)
        const directKids = childrenMap.get(pId) || []
        for (const k of directKids) {
          const kCat = statusCatMap.get(k.statusKey)
          const isDone = kCat === 'DONE' || k.statusKey === 'DONE' || (k.progress ?? 0) >= 100
          if (!isDone && k.type === 'BUG') {
            result.push(k)
          }
          walk(k.id)
        }
      }
      walk(rootId)
      return result
    }

    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    const rootTasks = tasks.filter((t) => !t.parentId || !taskMap.has(t.parentId))

    const newNodes: Node[] = []
    let rootIndex = 0
    const processedTaskIds = new Set<string>()

    const prevNodesMap = new Map(nodesRef.current.map((n) => [n.id, n]))

    const processTask = (t: Task, parentBoxId?: string, rootX = 50, rootY = 80) => {
      if (processedTaskIds.has(t.id)) return
      processedTaskIds.add(t.id)

      const existingNode = prevNodesMap.get(t.id)
      const existingMode = (existingNode?.data as SimpleGraphNodeData)?.mode
      const kids = childrenMap.get(t.id) || []
      const hasKids = kids.length > 0
      const isDefaultBox = parentIdSet.has(t.id) || hasKids
      // 只要該任務底下有子卡片，一律自動恢復為收納盒 (box) 模式呈現，完整組織盒內子卡片；空盒或單卡才套用記憶模式
      const mode = hasKids ? 'box' : (currentModes[t.id] ?? (existingMode === 'box' ? 'box' : isDefaultBox ? 'box' : 'card'))
      const isBox = mode === 'box'

      if (isBox) {
        const rawBoxPos = draggedMap[t.id]
        const isValidChildBoxPos =
          parentBoxId &&
          rawBoxPos &&
          typeof rawBoxPos.x === 'number' &&
          typeof rawBoxPos.y === 'number' &&
          rawBoxPos.x >= 10 &&
          rawBoxPos.y >= 35
        const boxPos = parentBoxId
          ? (isValidChildBoxPos ? rawBoxPos : { x: 312, y: 70 })
          : (rawBoxPos ?? { x: rootX, y: rootY })

        // 預估目前盒內所有子卡片與子收納盒
        const childNodesList: Node[] = kids.map((k, idx) => {
          const cCol = Math.floor(idx / 5)
          const cRow = idx % 5
          const defaultSlotPos = { x: 24 + cCol * 280, y: 110 + cRow * 115 }
          const rawPos = draggedMap[k.id]
          const isValidChildPos =
            rawPos &&
            typeof rawPos.x === 'number' &&
            typeof rawPos.y === 'number' &&
            rawPos.x >= 10 &&
            rawPos.y >= 90
          const kPos = isValidChildPos ? rawPos : defaultSlotPos

          const kDefaultBox = parentIdSet.has(k.id)
          const kMode = toggledModes[k.id] ?? (kDefaultBox ? 'box' : 'card')
          const isKBox = kMode === 'box'
          const kW = isKBox ? Math.max(340, resizedMap[k.id]?.width ?? 340) : 256
          const kH = isKBox ? Math.max(280, resizedMap[k.id]?.height ?? 280) : 90

          const kStatusCat = statusCatMap.get(k.statusKey)
          const kOverdue = !!(k.dueDate && k.dueDate < today && (k.progress ?? 0) < 100 && kStatusCat !== 'DONE' && k.statusKey !== 'DONE')
          const kParallelInfo = parallelMap.get(k.id)

          return {
            id: k.id,
            type: 'simpleNode',
            parentId: t.id,
            position: kPos,
            width: kW,
            height: kH,
            style: { width: kW, height: kH },
            data: {
              label: k.title,
              refText: k.ref,
              mode: isKBox ? 'box' : 'card',
              typeColor: typeColorOf(k.type),
              typeName: typeNameOf(k.type),
              taskType: k.type,
              problem: k.problem,
              isOverdue: kOverdue,
              dueDate: k.dueDate,
              inquiryState: k.inquiryState,
              isParallel: kParallelInfo?.isParallel,
              parallelPeers: kParallelInfo?.peers,
              onToggleMode: handleToggleMode,
              onOpenTask,
            },
          }
        })

        const isBoxCollapsed = !!collapsedNodes[t.id]
        const dims = computeBoxDimensions(t.id, childNodesList, resizedMap[t.id]?.width, resizedMap[t.id]?.height, undefined, isBoxCollapsed)

        const tStatusCat = statusCatMap.get(t.statusKey)
        const tIsDone = tStatusCat === 'DONE' || t.statusKey === 'DONE' || (t.progress ?? 0) >= 100
        const tOverdue = !!(t.dueDate && t.dueDate < today && !tIsDone)
        const tParallelInfo = parallelMap.get(t.id)

        // 遞迴統計盒內所有未完成之「問題單 (BUG)」數量
        const activeProblemKids = collectActiveProblemBugs(t.id)
        const problemCount = activeProblemKids.length
        const problemTooltip =
          problemCount > 0
            ? `盒內有 ${problemCount} 張未完成問題單：${activeProblemKids.map((k) => k.ref || k.title).join('、')}`
            : null

        const activeBlockedKids = kids.filter((k) => {
          const kCat = statusCatMap.get(k.statusKey)
          const isDone = kCat === 'DONE' || k.statusKey === 'DONE' || (k.progress ?? 0) >= 100
          if (isDone) return false
          const b = blockedByMap.get(k.id)
          return b && b.length > 0
        })
        const activeOverdueKids = kids.filter((k) => {
          const kCat = statusCatMap.get(k.statusKey)
          const isDone = kCat === 'DONE' || k.statusKey === 'DONE' || (k.progress ?? 0) >= 100
          if (isDone) return false
          return !!(k.dueDate && k.dueDate < today)
        })
        const activeInquiryKids = kids.filter((k) => {
          const kCat = statusCatMap.get(k.statusKey)
          const isDone = kCat === 'DONE' || k.statusKey === 'DONE' || (k.progress ?? 0) >= 100
          if (isDone) return false
          return k.inquiryState === 'AWAITING' || k.inquiryState === 'PARTIAL' || k.inquiryState === 'OVERDUE'
        })
        const activeInquiryOverdueKids = kids.filter((k) => {
          const kCat = statusCatMap.get(k.statusKey)
          const isDone = kCat === 'DONE' || k.statusKey === 'DONE' || (k.progress ?? 0) >= 100
          if (isDone) return false
          return k.inquiryState === 'OVERDUE'
        })
        const activeInquiryAwaitingKids = kids.filter((k) => {
          const kCat = statusCatMap.get(k.statusKey)
          const isDone = kCat === 'DONE' || k.statusKey === 'DONE' || (k.progress ?? 0) >= 100
          if (isDone) return false
          return k.inquiryState === 'AWAITING' || k.inquiryState === 'PARTIAL'
        })

        newNodes.push({
          id: t.id,
          type: 'simpleNode',
          parentId: parentBoxId,
          position: boxPos,
          zIndex: 1,
          style: { width: dims.width, height: dims.height },
          width: dims.width,
          height: dims.height,
          measured: { width: dims.width, height: dims.height },
          data: {
            label: t.title,
            refText: t.ref,
            mode: 'box',
            progress: rolledMap.get(t.id)?.progress ?? t.progress ?? 0,
            typeColor: typeColorOf(t.type),
            typeName: typeNameOf(t.type),
            taskType: t.type,
            problem: problemTooltip,
            problemCount,
            blockedBy: blockedByMap.get(t.id),
            blockedCount: activeBlockedKids.length,
            overdueCount: activeOverdueKids.length,
            inquiryCount: activeInquiryKids.length,
            inquiryOverdueCount: activeInquiryOverdueKids.length,
            inquiryAwaitingCount: activeInquiryAwaitingKids.length,
            childCount: kids.length,
            isOverdue: false,
            dueDate: t.dueDate,
            inquiryState: t.inquiryState,
            isParallel: tParallelInfo?.isParallel,
            parallelPeers: tParallelInfo?.peers,
            minWidth: dims.minWidth,
            minHeight: dims.minHeight,
            isCollapsed: isBoxCollapsed,
            onToggleCollapse: handleToggleCollapse,
            onToggleMode: handleToggleMode,
            onOpenTask,
          },
        })

        kids.forEach((k, idx) => {
          const cCol = Math.floor(idx / 5)
          const cRow = idx % 5
          const defaultSlotPos = { x: 24 + cCol * 280, y: 110 + cRow * 115 }
          const kDefaultBox = parentIdSet.has(k.id)
          const kMode = currentModes[k.id] ?? (kDefaultBox ? 'box' : 'card')

          if (kMode !== 'box') {
            processedTaskIds.add(k.id)
            const rawPos = draggedMap[k.id]
            const isValidChildPos =
              rawPos &&
              typeof rawPos.x === 'number' &&
              typeof rawPos.y === 'number' &&
              rawPos.x >= 10 &&
              rawPos.x <= dims.width - 60 &&
              rawPos.y >= 90 &&
              rawPos.y <= dims.height - 30
            const kPos = isValidChildPos ? rawPos : defaultSlotPos
            const kStatusCat = statusCatMap.get(k.statusKey)
            const kIsDone = kStatusCat === 'DONE' || k.statusKey === 'DONE' || (k.progress ?? 0) >= 100
            const kOverdue = !!(k.dueDate && k.dueDate < today && !kIsDone)
            const kParallelInfo = parallelMap.get(k.id)

            const kActiveProblemKids = collectActiveProblemBugs(k.id)
            const kProblemCount = kActiveProblemKids.length
            const kProblemTooltip =
              kProblemCount > 0
                ? `內有 ${kProblemCount} 張未完成問題單：${kActiveProblemKids.map((ck) => ck.ref || ck.title).join('、')}`
                : null

            newNodes.push({
              id: k.id,
              type: 'simpleNode',
              parentId: t.id,
              position: kPos,
              zIndex: 10,
              width: 256,
              style: { width: 256 },
              data: {
                label: k.title,
                refText: k.ref,
                mode: 'card',
                progress: rolledMap.get(k.id)?.progress ?? k.progress ?? 0,
                typeColor: typeColorOf(k.type),
                typeName: typeNameOf(k.type),
                taskType: k.type,
                problem: kProblemTooltip,
                problemCount: kProblemCount,
                isOverdue: kOverdue,
                dueDate: k.dueDate,
                inquiryState: k.inquiryState,
                isParallel: kParallelInfo?.isParallel,
                parallelPeers: kParallelInfo?.peers,
                onToggleMode: handleToggleMode,
                onOpenTask,
              },
            })
          } else {
            processTask(k, t.id, defaultSlotPos.x, defaultSlotPos.y)
          }
        })
      } else {
        const cardPos = draggedMap[t.id] ?? (!parentBoxId ? { x: rootX, y: rootY } : { x: 24, y: 110 })
        const tStatusCat = statusCatMap.get(t.statusKey)
        const tIsDone = tStatusCat === 'DONE' || t.statusKey === 'DONE' || (t.progress ?? 0) >= 100
        const tOverdue = !!(t.dueDate && t.dueDate < today && !tIsDone)
        const tParallelInfo = parallelMap.get(t.id)

        const tKids = childrenMap.get(t.id) || []
        const tActiveProblemKids = tKids.filter((ck) => {
          const ckCat = statusCatMap.get(ck.statusKey)
          const ckDone = ckCat === 'DONE' || ck.statusKey === 'DONE' || (ck.progress ?? 0) >= 100
          if (ckDone) return false
          return ck.type === 'BUG'
        })
        const tProblemCount = tActiveProblemKids.length
        const tProblemTooltip =
          tProblemCount > 0
            ? `內有 ${tProblemCount} 張未完成問題單：${tActiveProblemKids.map((ck) => ck.ref || ck.title).join('、')}`
            : null

        newNodes.push({
          id: t.id,
          type: 'simpleNode',
          parentId: parentBoxId,
          position: cardPos,
          zIndex: parentBoxId ? 10 : 2,
          width: 256,
          style: { width: 256 },
          data: {
            label: t.title,
            refText: t.ref,
            mode: 'card',
            progress: rolledMap.get(t.id)?.progress ?? t.progress ?? 0,
            typeColor: typeColorOf(t.type),
            typeName: typeNameOf(t.type),
            taskType: t.type,
            problem: tProblemTooltip,
            problemCount: tProblemCount,
            isOverdue: tOverdue,
            dueDate: t.dueDate,
            inquiryState: t.inquiryState,
            isParallel: tParallelInfo?.isParallel,
            parallelPeers: tParallelInfo?.peers,
            childCount: tKids.length,
            isCollapsed: !!collapsedNodes[t.id],
            onToggleCollapse: handleToggleCollapse,
            onToggleMode: handleToggleMode,
            onOpenTask,
          },
        })
      }
    }

    rootTasks.forEach((t) => {
      const col = rootIndex % 3
      const row = Math.floor(rootIndex / 3)
      const rX = 50 + col * 380
      const rY = 80 + row * 320
      processTask(t, undefined, rX, rY)
      rootIndex++
    })

    tasks.forEach((t) => {
      if (!processedTaskIds.has(t.id)) {
        const col = rootIndex % 3
        const row = Math.floor(rootIndex / 3)
        const rX = 50 + col * 380
        const rY = 80 + row * 320
        processTask(t, undefined, rX, rY)
        rootIndex++
      }
    })

    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n]))
      const merged = newNodes.map((newNode) => {
        const existing = prevMap.get(newNode.id)
        const savedPos = draggedMap[newNode.id]
        const savedSize = resizedMap[newNode.id]

        if (newNode.parentId) {
          const parentChanged = (existing?.parentId ?? null) !== (newNode.parentId ?? null)
          const modeChanged =
            (existing?.data as SimpleGraphNodeData)?.mode !==
            (newNode.data as SimpleGraphNodeData)?.mode

          if (!parentChanged && !modeChanged && existing) {
            const parentNode =
              newNodes.find((pn) => pn.id === newNode.parentId) ||
              prevNodes.find((pn) => pn.id === newNode.parentId)
            const parentW = Number(parentNode?.style?.width ?? parentNode?.width ?? 340)
            const parentH = Number(parentNode?.style?.height ?? parentNode?.height ?? 260)

            const pos = savedPos || existing.position
            const isValidPos =
              pos &&
              typeof pos.x === 'number' &&
              typeof pos.y === 'number' &&
              pos.x >= 10 &&
              pos.y >= 35 &&
              pos.x <= Math.max(10, parentW - 60) &&
              pos.y <= Math.max(35, parentH - 30)

            if (isValidPos) {
              return {
                ...newNode,
                position: pos,
                style: existing.style ?? newNode.style,
                width: existing.width ?? newNode.width,
                height: existing.height ?? newNode.height,
                measured: existing.measured ?? newNode.measured,
              }
            }
          }
          return newNode
        }

        const parentChanged = (existing?.parentId ?? null) !== (newNode.parentId ?? null)
        const modeChanged =
          (existing?.data as SimpleGraphNodeData)?.mode !==
          (newNode.data as SimpleGraphNodeData)?.mode

        if (parentChanged || modeChanged) {
          return newNode
        }

        const isBoxNode = (newNode.data as SimpleGraphNodeData)?.mode === 'box'
        const targetPos = savedPos ?? existing?.position ?? newNode.position

        if (isBoxNode) {
          const defaultW = 340
          const defaultH = 260
          const targetW = Math.max(defaultW, existing?.width ?? savedSize?.width ?? newNode.width ?? defaultW)
          const targetH = Math.max(defaultH, existing?.height ?? savedSize?.height ?? newNode.height ?? defaultH)
          const styleObj = {
            ...(existing?.style || newNode.style),
            width: targetW,
            height: targetH,
          }
          return {
            ...newNode,
            position: targetPos,
            style: styleObj,
            width: targetW,
            height: targetH,
            measured: { width: targetW, height: targetH },
          }
        }

        return {
          ...newNode,
          position: targetPos,
          style: { width: 256 },
          width: 256,
        }
      })

      return orderParentNodesFirst(merged)
    })
  }, [tasks, project?.statuses, today])

  const onNodesChange = useCallback((rawChanges: NodeChange[]) => {
    if (!effectiveEditable) {
      const selectChanges = rawChanges.filter((c) => c.type === 'select' && !('id' in c && isAnnotationId((c as { id: string }).id)))
      if (selectChanges.length > 0) {
        setNodes((nds) => applyNodeChanges(selectChanges, nds))
      }
      return
    }

    /*
     * Ref: CR-151 React Flow 的拖曳會帶 dragging、NodeResizeControl 會帶 resizing
     * (`XYResizer` 的 onResize 一律 resizing: true、onEnd 補一筆 resizing: false)，
     * 用它判斷「互動中」，互動期間所有落盤都只記不寫。
     */
    for (const ch of rawChanges) {
      const flag =
        ch.type === 'position'
          ? ch.dragging
          : ch.type === 'dimensions'
            ? (ch as { resizing?: boolean }).resizing
            : undefined
      if (typeof flag !== 'boolean') continue
      if (flag) beginInteraction()
      else endInteraction()
    }

    // Ref: CR-144 文字註記與區域標示框不是任務，改動只寫進 annotations，不進任務節點流程
    const annChanges = rawChanges.filter((c) => 'id' in c && isAnnotationId((c as { id: string }).id))
    if (annChanges.length > 0) {
      // Ref: CR-153 React Flow 量到的尺寸先記下來，重組註記節點時補回 measured
      for (const ch of annChanges) {
        if (ch.type === 'dimensions' && ch.dimensions && ch.dimensions.width > 0 && ch.dimensions.height > 0) {
          annotationMeasuredRef.current.set(ch.id, {
            width: ch.dimensions.width,
            height: ch.dimensions.height,
          })
        }
      }
      setAnnotations((prev) => {
        let texts = prev.texts
        let frames = prev.frames
        let changed = false
        for (const ch of annChanges) {
          if (ch.type === 'position' && ch.position) {
            const nx = Math.round(ch.position.x)
            const ny = Math.round(ch.position.y)
            texts = texts.map((t) => {
              if (t.id !== ch.id || (t.x === nx && t.y === ny)) return t
              changed = true
              return { ...t, x: nx, y: ny }
            })
            frames = frames.map((f) => {
              if (f.id !== ch.id || (f.x === nx && f.y === ny)) return f
              changed = true
              return { ...f, x: nx, y: ny }
            })
          } else if (ch.type === 'dimensions' && ch.dimensions) {
            const nw = Math.round(ch.dimensions.width)
            const nh = Math.round(ch.dimensions.height)
            frames = frames.map((f) => {
              if (f.id !== ch.id || (f.width === nw && f.height === nh)) return f
              changed = true
              return { ...f, width: nw, height: nh }
            })
          }
        }
        return changed ? { texts, frames } : prev
      })
    }

    const changes = rawChanges.filter((c) => !('id' in c) || !isAnnotationId((c as { id: string }).id))
    if (changes.length === 0) return

    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds)

      // 當有尺寸調整 (NodeResizeControl) 時，自動校驗 minWidth/minHeight 並寫入 resized 持久化
      const dimChanges = changes.filter((c) => c.type === 'dimensions')
      if (dimChanges.length > 0) {
        setTimeout(() => {
          setResized((prev) => {
            const nextResized = { ...prev }
            dimChanges.forEach((dc) => {
              const updatedNode = next.find((n) => n.id === (dc as any).id)
              if (updatedNode && (updatedNode.data as SimpleGraphNodeData)?.mode === 'box') {
                const minW = (updatedNode.data as SimpleGraphNodeData)?.minWidth ?? 340
                const minH = (updatedNode.data as SimpleGraphNodeData)?.minHeight ?? 260
                const rawW = Number(updatedNode.width ?? (updatedNode as any).style?.width ?? 340)
                const rawH = Number(updatedNode.height ?? (updatedNode as any).style?.height ?? 260)
                const enforcedW = Math.max(rawW, minW)
                const enforcedH = Math.max(rawH, minH)
                nextResized[(dc as any).id] = { width: enforcedW, height: enforcedH }
                if (projectId) {
                  Api.patchCanvasNodes(projectId, 'task-graph', {
                    nodes: { [(dc as any).id]: { width: enforcedW, height: enforcedH } },
                  }).catch(() => {})
                }
              }
            })
            return nextResized
          })
        }, 0)
      }

      // 關鍵修復：強制父收納盒優先排序，防止 DOM 層級蓋過子卡片造成移動畫布 (Pan)
      return orderParentNodesFirst(next)
    })
  }, [effectiveEditable, beginInteraction, endInteraction, projectId])

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!effectiveEditable) {
        const selectChanges = changes.filter((c) => c.type === 'select')
        if (selectChanges.length > 0) {
          setEdges((eds) => applyEdgeChanges(selectChanges, eds))
        }
        return
      }
      setEdges((eds) => applyEdgeChanges(changes, eds))
    },
    [effectiveEditable]
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (!effectiveEditable) return
      deletedEdges.forEach((e) => {
        Api.deleteLink(e.id).catch((err) => console.error('Failed to delete link on edge delete:', err))
        handleSaveEdgeText(e.id, '')
      })
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
        queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
        queryClient.invalidateQueries({ queryKey: ['task'] })
      }
    },
    [effectiveEditable, projectId, handleSaveEdgeText, queryClient]
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent | null, edge: Edge) => {
      if (!effectiveEditable) return
      if (consumeWaypointClickGuard()) return // Ref: CR-141
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const targetNode = nodes.find((n) => n.id === edge.target)
      const sourceTask = tasks?.find((t) => t.id === edge.source)
      const targetTask = tasks?.find((t) => t.id === edge.target)

      const sourceRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || sourceTask?.ref || T.flow.relationGraph.card
      const targetRef = (targetNode?.data as SimpleGraphNodeData)?.refText || targetTask?.ref || T.flow.relationGraph.card
      const isLeftRight = !edge.sourceHandle || edge.sourceHandle.includes('left') || edge.sourceHandle.includes('right')
      const defaultColor = isLeftRight ? '#ef4444' : '#8b5cf6'

      setConfirmDeleteEdge({
        edgeId: edge.id,
        sourceRef,
        targetRef,
        // Ref: CR-151
        text: edgeTexts[edge.id] ?? '',
        color: edgeColors[edge.id] ?? defaultColor,
      })
    },
    [effectiveEditable, nodes, tasks, edgeTexts, edgeColors]
  )

  const onEdgeClickRef = useRef(onEdgeClick)
  onEdgeClickRef.current = onEdgeClick

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return false

      // 嚴格阻擋跨收納盒連線 (Ref: CR-180)
      const srcNode = nodes.find((n) => n.id === connection.source)
      const tgtNode = nodes.find((n) => n.id === connection.target)
      if (
        (srcNode?.parentId && srcNode.parentId !== tgtNode?.parentId) ||
        (tgtNode?.parentId && tgtNode.parentId !== srcNode?.parentId)
      ) {
        return false
      }

      return true
    },
    [nodes]
  )

  const onConnectStart = useCallback(
    (_e: unknown, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
      if (!effectiveEditable) return
      connectStartRef.current = {
        nodeId: params?.nodeId ?? null,
        handleId: params?.handleId ?? null,
        handleType: params?.handleType ?? null,
      }
    },
    [effectiveEditable]
  )

  const onConnect = useCallback(
    (params: Connection) => {
      if (!effectiveEditable || !params.source || !params.target || params.source === params.target) return

      // 若使用者是從 target 類型接點起拉，React Flow 會將 source 與 target 顛倒
      // 依據實際按下滑鼠的起點換回正確方向，確保箭頭永遠位於滑鼠放開的終點端（支援右到左、下到上等任意方向）
      const startInfo = connectStartRef.current
      const startedAtTarget =
        startInfo?.nodeId === params.target &&
        (!startInfo.handleId || startInfo.handleId === params.targetHandle)

      const connection: Connection = startedAtTarget
        ? {
            source: params.target,
            sourceHandle: params.targetHandle,
            target: params.source,
            targetHandle: params.sourceHandle,
          }
        : params

      connectStartRef.current = null

      const sHandle = connection.sourceHandle ?? undefined
      const tHandle = connection.targetHandle ?? undefined

      const sIsHoriz = !sHandle || sHandle.includes('left') || sHandle.includes('right')
      const tIsHoriz = !tHandle || tHandle.includes('left') || tHandle.includes('right')

      // 任務關聯圖：左右接點只能連左右接點，上下接點只能連上下接點
      if (sIsHoriz !== tIsHoriz) return

      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)

      const sourceParent = sourceNode?.parentId
      const targetParent = targetNode?.parentId

      // Ref: CR-131
      if (
        (sourceParent && sourceParent !== targetParent) ||
        (targetParent && targetParent !== sourceParent)
      ) {
        const srcRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card
        const tgtRef = (targetNode?.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card
        setAlertMsg(T.flow.relationGraph.alertCrossBox(srcRef, tgtRef))
        return
      }

      const sId = String(connection.source)
      const tId = String(connection.target)

      const existingEdge = edges.find(
        (e) =>
          String(e.source) === sId && String(e.target) === tId &&
          e.sourceHandle === sHandle && e.targetHandle === tHandle
      )

      if (existingEdge) return

      const tempId = `xy-edge__${sId}${sHandle ?? ''}-${tId}${tHandle ?? ''}`
      const { style, markerEnd } = getEdgeStyleAndMarker(sHandle)
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: tempId,
            type: 'orthogonal',
            animated: true,
            style,
            markerEnd,
          },
          eds
        )
      )

      if (connection.source && connection.target) {
        Api.addLink(connection.source, {
          targetId: connection.target,
          linkType: 'FS',
          sourceHandle: sHandle ?? null,
          targetHandle: tHandle ?? null,
        })
          .then((newLink: any) => {
            if (newLink?.id) {
              setEdges((eds) =>
                eds.map((e) =>
                  (e.id === tempId || (e.source === connection.source && e.target === connection.target && e.id.startsWith('xy-edge__')))
                    ? { ...e, id: newLink.id }
                    : e
                )
              )
            }
            queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
            queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
            queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
          })
          .catch((err: any) => {
            console.error('Failed to add link in DB:', err)
            setEdges((eds) =>
              eds.filter(
                (e) =>
                  e.id !== tempId &&
                  !(e.source === connection.source && e.target === connection.target && e.id.startsWith('xy-edge__'))
              )
            )
            const msg = err?.detail || err?.title || err?.message || '建立關聯失敗'
            setAlertMsg(msg)
            queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
          })
      }
    },
    [effectiveEditable, nodes, edges, projectId, queryClient]
  )

  const onNodeDragStart = useCallback((_: unknown, node: Node) => {
    if (!effectiveEditable) return
    if (isAnnotationId(node.id)) return // Ref: CR-144
    isDraggingRef.current = true
    dragStartPosMap.current[node.id] = { ...node.position }
  }, [effectiveEditable])

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      if (!effectiveEditable) return
      // Ref: CR-144 標示框/文字純視覺，絕不進入收納盒歸屬判定，也不打任何任務 API
      if (isAnnotationId(node.id)) return
      setTimeout(() => {
        isDraggingRef.current = false
      }, 100)
      const isBoxNode = (node.data as SimpleGraphNodeData)?.mode === 'box'
      const cardRef = (node.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card

      setNodes((currentNodes) => {
        // 安全的非遞迴 getAbsPos 避免死迴圈與 TypeError
        const getAbsPos = (nId: string): { x: number; y: number } => {
          const visited = new Set<string>()
          let curId: string | undefined = nId
          let x = 0
          let y = 0
          while (curId && !visited.has(curId) && visited.size < 20) {
            visited.add(curId)
            const target: Node | undefined = curId === node.id ? node : currentNodes.find((cn) => cn.id === curId)
            if (!target || !target.position) break
            x += target.position.x || 0
            y += target.position.y || 0
            curId = target.parentId
          }
          return { x, y }
        }

        const cardAbsPos = getAbsPos(node.id)
        const cardWidth = 256
        const cardHeight = 84
        const cardCenterX = cardAbsPos.x + cardWidth / 2
        const cardCenterY = cardAbsPos.y + cardHeight / 2

        const getBoxDepth = (bId: string): number => {
          let depth = 0
          let cur: string | undefined = bId
          const visited = new Set<string>()
          while (cur && !visited.has(cur)) {
            visited.add(cur)
            const n = currentNodes.find((cn) => cn.id === cur)
            if (!n || !n.parentId) break
            depth++
            cur = n.parentId
          }
          return depth
        }

        const boxNodes = currentNodes
          .filter((cn) => (cn.data as SimpleGraphNodeData)?.mode === 'box' && cn.id !== node.id)
          .sort((a, b) => getBoxDepth(b.id) - getBoxDepth(a.id))

        let targetBox: Node | undefined = undefined
        for (const b of boxNodes) {
          const bAbsPos = getAbsPos(b.id)
          const bW = Number(b.style?.width ?? 340)
          const bH = Number(b.style?.height ?? 260)

          if (
            cardCenterX >= bAbsPos.x &&
            cardCenterX <= bAbsPos.x + bW &&
            cardCenterY >= bAbsPos.y &&
            cardCenterY <= bAbsPos.y + bH
          ) {
            targetBox = b
            break
          }
        }

        const currentParentId = node.parentId
        const isBoxNode = (node.data as SimpleGraphNodeData)?.mode === 'box'
        const nodeTypeStr = isBoxNode ? T.flow.relationGraph.box : T.flow.relationGraph.card
        let nextNodes = currentNodes

        // Ref: CR-136 卡片移出後依剩餘卡片實際佔用範圍收斂收納盒尺寸（只縮不放）
        const shrinkBoxAfterRemoval = (boxId: string, removedId: string) => {
          const listWithoutRemoved = currentNodes.map((n) =>
            n.id === removedId ? { ...n, parentId: undefined } : n
          )
          const remaining = listWithoutRemoved.filter((n) => n.parentId === boxId)
          if (remaining.length === 0) {
            setResized((prev) => {
              if (!prev[boxId]) return prev
              const next = { ...prev }
              delete next[boxId]
              return next
            })
            return
          }
          const req = computeBoxDimensions(boxId, listWithoutRemoved)
          setResized((prev) => {
            const cur = prev[boxId]
            if (!cur) return prev
            const nextW = Math.min(cur.width, req.minWidth)
            const nextH = Math.min(cur.height, req.minHeight)
            if (nextW === cur.width && nextH === cur.height) return prev
            return { ...prev, [boxId]: { width: nextW, height: nextH } }
          })
        }

        if (!targetBox && currentParentId) {
          // 移出收納盒：檢查是否有關聯線連著，若有則跳出提示禁止移出並彈回原位，絕不刪除使用者的關聯線
          const visitedSubtree = new Set<string>()
          const collectSubtreeIds = (nId: string) => {
            if (visitedSubtree.has(nId)) return
            visitedSubtree.add(nId)
            currentNodes.filter((cn) => cn.parentId === nId).forEach((cn) => collectSubtreeIds(cn.id))
          }
          collectSubtreeIds(node.id)

          const hasEdgesInSubtree = edges.some(
            (e) => visitedSubtree.has(String(e.source)) || visitedSubtree.has(String(e.target))
          )

          if (hasEdgesInSubtree) {
            setAlertMsg(T.flow.relationGraph.alertMoveOutHasEdges(cardRef))
            addLog('move_out', T.flow.relationGraph.log.moveOutFailed(cardRef))
            const startPos = dragStartPosMap.current[node.id]
            return currentNodes.map((n) =>
              n.id === node.id
                ? { ...n, parentId: currentParentId, position: startPos || n.position }
                : n
            )
          }

          shrinkBoxAfterRemoval(currentParentId, node.id) // Ref: CR-136
          // 移出收納盒：離開巢狀結構
          addLog('move_out', T.flow.relationGraph.log.moveOut(nodeTypeStr, cardRef, Math.round(cardAbsPos.x), Math.round(cardAbsPos.y)))
          setDragged((prev) => ({
            ...prev,
            [node.id]: cardAbsPos,
          }))

          if (projectId) {
            Api.patchCanvasNodes(projectId, 'task-graph', {
              nodes: { [node.id]: { x: Math.round(cardAbsPos.x), y: Math.round(cardAbsPos.y) } },
            }).catch(() => {})

            queryClient.setQueryData(['tasks', projectId], (oldData: { tasks: Task[] } | undefined) => {
              if (!oldData || !Array.isArray(oldData.tasks)) return oldData
              return {
                ...oldData,
                tasks: oldData.tasks.map((t) => (t.id === node.id ? { ...t, parentId: null } : t)),
              }
            })

            Api.moveTask(node.id, { parentId: null })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
                queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
              })
              .catch((err: unknown) =>
                console.error('Failed to moveTask in DB:', err)
              )
          }

          nextNodes = currentNodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                parentId: undefined,
                position: cardAbsPos,
              }
            }
            return n
          })
        } else if (targetBox && targetBox.id !== currentParentId) {
          if (currentParentId) shrinkBoxAfterRemoval(currentParentId, node.id) // Ref: CR-136
          // 移入收納盒：禁止帶有任何連線
          const targetBoxRef = (targetBox.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.box
          const visitedSubtree = new Set<string>()
          const collectSubtreeIds = (nId: string) => {
            if (visitedSubtree.has(nId)) return
            visitedSubtree.add(nId)
            currentNodes.filter((cn) => cn.parentId === nId).forEach((cn) => collectSubtreeIds(cn.id))
          }
          collectSubtreeIds(node.id)

          const hasEdgesInSubtree = edges.some(
            (e) => visitedSubtree.has(String(e.source)) || visitedSubtree.has(String(e.target))
          )

          if (hasEdgesInSubtree) {
            setAlertMsg(T.flow.relationGraph.alertMoveInHasEdges(nodeTypeStr, cardRef, targetBoxRef))
            addLog('move_in', T.flow.relationGraph.log.moveInFailed(nodeTypeStr, cardRef, targetBoxRef))
            const startPos = dragStartPosMap.current[node.id]
            return currentNodes.map((n) =>
              n.id === node.id
                ? { ...n, parentId: currentParentId, position: startPos || n.position }
                : n
            )
          }

          // 移入收納盒：進入巢狀結構
          const targetKids = currentNodes.filter((cn) => cn.parentId === targetBox!.id && cn.id !== node.id)
          const occupiedSlots = new Set(
            targetKids.map((k) => `${Math.round((k.position.x - 24) / (isBoxNode ? 360 : 280))},${Math.round((k.position.y - 110) / 115)}`)
          )

          let targetSlotPos = { x: 24, y: 110 }
          if (isBoxNode) {
            let maxRightX = 0
            targetKids.forEach((k) => {
              const rightX = (k.position?.x ?? 24) + Number(k.width ?? (k as any).measured?.width ?? 256)
              if (rightX > maxRightX) maxRightX = rightX
            })
            targetSlotPos = { x: Math.max(312, maxRightX + 24), y: 110 }
          } else {
            let slotIdx = 0
            let tCol = 0
            let tRow = 0
            while (slotIdx < 10000) {
              tCol = Math.floor(slotIdx / 5)
              tRow = slotIdx % 5
              if (!occupiedSlots.has(`${tCol},${tRow}`)) break
              slotIdx++
            }
            targetSlotPos = { x: 24 + tCol * 280, y: 110 + tRow * 115 }
          }
          const targetBoxAbsPos = getAbsPos(targetBox!.id)
          const realAbsX = Math.round(targetBoxAbsPos.x + targetSlotPos.x)
          const realAbsY = Math.round(targetBoxAbsPos.y + targetSlotPos.y)
          addLog('move_in', T.flow.relationGraph.log.moveIn(nodeTypeStr, cardRef, targetBoxRef, realAbsX, realAbsY))

          setDragged((prev) => ({
            ...prev,
            [node.id]: targetSlotPos,
            [targetBox!.id]: prev[targetBox!.id] ?? targetBox!.position,
          }))

          if (projectId) {
            Api.patchCanvasNodes(projectId, 'task-graph', {
              nodes: {
                [node.id]: { x: Math.round(targetSlotPos.x), y: Math.round(targetSlotPos.y) },
                [targetBox!.id]: { x: Math.round(targetBox!.position.x), y: Math.round(targetBox!.position.y) },
              },
            }).catch(() => {})

            queryClient.setQueryData(['tasks', projectId], (oldData: { tasks: Task[] } | undefined) => {
              if (!oldData || !Array.isArray(oldData.tasks)) return oldData
              return {
                ...oldData,
                tasks: oldData.tasks.map((t) => (t.id === node.id ? { ...t, parentId: targetBox!.id } : t)),
              }
            })

            Api.moveTask(node.id, { parentId: targetBox!.id })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
                queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
              })
              .catch((err: unknown) =>
                console.error('Failed to moveTask in DB:', err)
              )
          }

          const nodeBoxDims = isBoxNode ? computeBoxDimensions(node.id, currentNodes, resized[node.id]?.width, resized[node.id]?.height) : undefined
          const nodeBoxW = nodeBoxDims ? nodeBoxDims.width : Number(node.style?.width ?? node.width ?? (isBoxNode ? 340 : 256))
          const nodeBoxH = nodeBoxDims ? nodeBoxDims.height : Number(node.style?.height ?? node.height ?? 260)

          const updatedMap = new Map(currentNodes.map((n) => [n.id, n]))
          const movedNode = updatedMap.get(node.id)
          if (movedNode) {
            updatedMap.set(node.id, {
              ...movedNode,
              parentId: targetBox!.id,
              position: targetSlotPos,
              style: isBoxNode ? { width: nodeBoxW, height: nodeBoxH } : { width: 256 },
              width: isBoxNode ? nodeBoxW : 256,
              height: isBoxNode ? nodeBoxH : undefined,
              data: {
                ...movedNode.data,
                mode: isBoxNode ? 'box' : 'card',
              },
            })
          }

          let curBoxId: string | undefined = targetBox!.id
          while (curBoxId) {
            const bNode = updatedMap.get(curBoxId)
            if (!bNode) break

            const allNodesList = Array.from(updatedMap.values())
            const bNewDims = computeBoxDimensions(
              curBoxId,
              allNodesList,
              resized[curBoxId]?.width,
              resized[curBoxId]?.height
            )

            const oldW = Number(bNode.style?.width ?? bNode.width ?? 340)
            const oldH = Number(bNode.style?.height ?? bNode.height ?? 260)
            const needsExpand = bNewDims.width > oldW || bNewDims.height > oldH

            if (needsExpand) {
              updatedMap.set(curBoxId, {
                ...bNode,
                style: { width: bNewDims.width, height: bNewDims.height },
                width: bNewDims.width,
                height: bNewDims.height,
                measured: { width: bNewDims.width, height: bNewDims.height },
                data: {
                  ...bNode.data,
                  minWidth: bNewDims.minWidth,
                  minHeight: bNewDims.minHeight,
                },
              })
            }
            curBoxId = bNode.parentId
          }

          nextNodes = Array.from(updatedMap.values())
        } else {
          const isChild = !!node.parentId
          if (isChild) {
            addLog('move', T.flow.relationGraph.log.moveInner(cardRef, Math.round(node.position.x), Math.round(node.position.y), Math.round(cardAbsPos.x), Math.round(cardAbsPos.y)))
          } else {
            addLog('move', T.flow.relationGraph.log.moveNode(cardRef, Math.round(node.position.x), Math.round(node.position.y)))
          }
        setDragged((prev) => ({
          ...prev,
          [node.id]: { x: node.position.x, y: node.position.y },
        }))
        if (projectId) {
          Api.patchCanvasNodes(projectId, 'task-graph', {
            nodes: { [node.id]: { x: Math.round(node.position.x), y: Math.round(node.position.y) } },
          }).catch(() => {})
        }
        nextNodes = currentNodes.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        )
      }

      // 自動遞迴檢查所有上層收納盒，若盒內卡片/子收納盒超出範圍即自動擴大收納盒尺寸
      const updatedMap = new Map(nextNodes.map((n) => [n.id, n]))
      let curBoxId: string | undefined = targetBox?.id || node.parentId
      const visitedBoxes = new Set<string>()

      while (curBoxId && !visitedBoxes.has(curBoxId)) {
        visitedBoxes.add(curBoxId)
        const bNode = updatedMap.get(curBoxId)
        if (!bNode) break

        const allNodesList = Array.from(updatedMap.values())
        const bNewDims = computeBoxDimensions(
          curBoxId,
          allNodesList,
          resized[curBoxId]?.width,
          resized[curBoxId]?.height
        )

        const oldW = Number(bNode.style?.width ?? bNode.width ?? 340)
        const oldH = Number(bNode.style?.height ?? bNode.height ?? 260)
        const newW = Math.max(oldW, bNewDims.width)
        const newH = Math.max(oldH, bNewDims.height)

        if (newW > oldW || newH > oldH || bNewDims.minWidth !== (bNode.data as SimpleGraphNodeData)?.minWidth || bNewDims.minHeight !== (bNode.data as SimpleGraphNodeData)?.minHeight) {
          updatedMap.set(curBoxId, {
            ...bNode,
            style: { width: newW, height: newH },
            width: newW,
            height: newH,
            measured: { width: newW, height: newH },
            data: {
              ...bNode.data,
              minWidth: bNewDims.minWidth,
              minHeight: bNewDims.minHeight,
            },
          })
        }
        curBoxId = bNode.parentId
      }

      nextNodes = Array.from(updatedMap.values())
      return orderParentNodesFirst(nextNodes)
    })
  }, [edges, projectId, queryClient, resized, addLog])

  const handleMoveEnd = useCallback(
    (_: unknown, viewport: Viewport) => {
      if (nodes.length === 0 || !viewport || typeof viewport.zoom !== 'number' || viewport.zoom < 0.05) {
        return
      }
      try {
        const key = getStorageKeyViewport(projectId)
        localStorage.setItem(key, JSON.stringify(viewport))
      } catch {
        // ignore
      }
    },
    [nodes.length, projectId]
  )

  /*
   * Ref: CR-152 逐張卡片快取衍生節點物件。原本每個 pointermove 都把全部卡片重造一次，
   * React Flow 的 adoptUserNodes 是靠物件參照判斷有沒有變（checkEquality），
   * 參照一換整頁每個節點元件都會重繪；改成只有真的變了的那張才換新物件。
   */
  const derivedNodeCacheRef = useRef(new Map<string, { src: Node; key: string; node: Node }>())

  const toggleHandlerRef = useRef(handleToggleMode)

  const nodesWithHandlers = useMemo(() => {
    // Ref: CR-152 handleToggleMode 會隨 toggledModes 換新，換掉就整份重造，不能發舊的閉包出去
    if (toggleHandlerRef.current !== handleToggleMode) {
      toggleHandlerRef.current = handleToggleMode
      derivedNodeCacheRef.current = new Map()
    }
    const prevCache = derivedNodeCacheRef.current
    const nextCache = new Map<string, { src: Node; key: string; node: Node }>()

    const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]))
    const statusCatMap = new Map(project?.statuses?.map((s) => [s.key, s.category]) ?? [])

    const isTaskUnfinishedBug = (tId: string) => {
      const t = taskMap.get(tId)
      if (!t || t.type !== 'BUG') return false
      const cat = statusCatMap.get(t.statusKey)
      return cat !== 'DONE' && t.statusKey !== 'DONE' && (t.progress ?? 0) < 100
    }

    // 建立畫布上即時的 parentId 關係（包含收納盒與巢狀子節點）
    const nodeChildrenMap = new Map<string, string[]>()
    for (const n of nodes) {
      if (n.parentId) {
        const arr = nodeChildrenMap.get(n.parentId) ?? []
        arr.push(n.id)
        nodeChildrenMap.set(n.parentId, arr)
      }
    }

    // 遞迴統計畫布上目前位於該節點子樹內的所有未完成問題單 (BUG)
    const getSubtreeProblemBugs = (rootId: string): Task[] => {
      const result: Task[] = []
      const visited = new Set<string>()
      const walk = (id: string) => {
        if (visited.has(id)) return
        visited.add(id)
        for (const childId of nodeChildrenMap.get(id) ?? []) {
          if (isTaskUnfinishedBug(childId)) {
            const t = taskMap.get(childId)
            if (t) result.push(t)
          }
          walk(childId)
        }
      }
      walk(rootId)
      return result
    }

    // 遞迴統計畫布上目前位於該節點子樹內的所有未完成逾期任務數量
    const getSubtreeOverdueCount = (rootId: string): number => {
      let count = 0
      const visited = new Set<string>()
      const walk = (id: string) => {
        if (visited.has(id)) return
        visited.add(id)
        for (const childId of nodeChildrenMap.get(id) ?? []) {
          const t = taskMap.get(childId)
          if (t && t.dueDate && t.dueDate < today) {
            const cat = statusCatMap.get(t.statusKey)
            const isDone = cat === 'DONE' || t.statusKey === 'DONE' || (t.progress ?? 0) >= 100
            if (!isDone) count++
          }
          walk(childId)
        }
      }
      walk(rootId)
      return count
    }

    // 遞迴統計畫布上目前位於該節點子樹內的所有對外詢問逾期 (OVERDUE) 數量
    const getSubtreeInquiryOverdueCount = (rootId: string): number => {
      let count = 0
      const visited = new Set<string>()
      const walk = (id: string) => {
        if (visited.has(id)) return
        visited.add(id)
        for (const childId of nodeChildrenMap.get(id) ?? []) {
          const t = taskMap.get(childId)
          if (t && t.inquiryState === 'OVERDUE') {
            const cat = statusCatMap.get(t.statusKey)
            const isDone = cat === 'DONE' || t.statusKey === 'DONE' || (t.progress ?? 0) >= 100
            if (!isDone) count++
          }
          walk(childId)
        }
      }
      walk(rootId)
      return count
    }

    // 遞迴統計畫布上目前位於該節點子樹內的所有對外詢問待回覆 (AWAITING/PARTIAL) 數量
    const getSubtreeInquiryAwaitingCount = (rootId: string): number => {
      let count = 0
      const visited = new Set<string>()
      const walk = (id: string) => {
        if (visited.has(id)) return
        visited.add(id)
        for (const childId of nodeChildrenMap.get(id) ?? []) {
          const t = taskMap.get(childId)
          if (t && (t.inquiryState === 'AWAITING' || t.inquiryState === 'PARTIAL')) {
            const cat = statusCatMap.get(t.statusKey)
            const isDone = cat === 'DONE' || t.statusKey === 'DONE' || (t.progress ?? 0) >= 100
            if (!isDone) count++
          }
          walk(childId)
        }
      }
      walk(rootId)
      return count
    }

    const derived = nodes.map((node) => {
      const isSelected = activeSelectedId === node.id
      const isRelated = relatedSet ? relatedSet.has(node.id) : true
      const nodeBlockedBy = blockedByMap.get(node.id)
      const currentMode = toggledModes[node.id] ?? (node.data as SimpleGraphNodeData)?.mode ?? 'card'
      const isBox = currentMode === 'box'
      const liveChildCount = nodeChildrenMap.get(node.id)?.length ?? 0

      // 只有收納盒非空 (liveChildCount > 0) 時，才統計畫布上歸屬於該收納盒的未完成受阻卡片數
      const childBlockedCount =
        isBox && liveChildCount > 0
          ? (nodeChildrenMap.get(node.id) ?? []).filter((cId) => (blockedByMap.get(cId)?.length ?? 0) > 0).length
          : 0

      // 收納盒自身受阻或盒內卡片受阻時皆計算 blockedCount
      const blockedCount = isBox
        ? childBlockedCount
        : nodeBlockedBy && nodeBlockedBy.length > 0
          ? 1
          : 0

      // 動態統計目前子樹內的未完成問題單，一旦移出收納盒即時歸零
      const liveProblemBugs = getSubtreeProblemBugs(node.id)
      const problemCount = liveProblemBugs.length
      const problemTooltip =
        problemCount > 0
          ? isBox
            ? `盒內有 ${problemCount} 張未完成問題單：${liveProblemBugs.map((k) => k.ref || k.title).join('、')}`
            : `內有 ${problemCount} 張未完成問題單：${liveProblemBugs.map((k) => k.ref || k.title).join('、')}`
          : null

      const liveOverdueCount = isBox ? getSubtreeOverdueCount(node.id) : 0
      const liveInquiryOverdueCount = isBox ? getSubtreeInquiryOverdueCount(node.id) : 0
      const liveInquiryAwaitingCount = isBox ? getSubtreeInquiryAwaitingCount(node.id) : 0
      const liveInquiryCount = liveInquiryOverdueCount + liveInquiryAwaitingCount

      // 動態由 parallelMap 取得最新並行狀態，連線刪除時即時歸零並移除徽章
      const parallelInfo = parallelMap.get(node.id)
      const isParallel = !!parallelInfo?.isParallel
      const parallelPeers = parallelInfo?.peers

      const isCollapsed = !!collapsedNodes[node.id]
      const isHidden = hiddenNodeIds.has(node.id)

      const key = `${isSelected}|${isRelated}|${!!relatedSet}|${nodeBlockedBy?.join(',') ?? ''}|${blockedCount}|${problemCount}|${liveChildCount}|${liveOverdueCount}|${liveInquiryOverdueCount}|${liveInquiryAwaitingCount}|${isParallel}|${parallelPeers?.join(',') ?? ''}|${currentMode}|${isCollapsed}|${isHidden}`

      const hit = prevCache.get(node.id)
      if (hit && hit.src === node && hit.key === key) {
        nextCache.set(node.id, hit)
        return hit.node
      }

      const built: Node = {
        ...node,
        hidden: isHidden,
        draggable: effectiveEditable && !isHidden,
        selectable: !isHidden,
        connectable: effectiveEditable,
        width: isBox && isCollapsed ? Math.max(320, (node.style?.width as number) ?? 320) : node.width,
        height: isBox && isCollapsed ? undefined : node.height,
        style: {
          ...node.style,
          width: isBox && isCollapsed ? Math.max(320, (node.style?.width as number) ?? 320) : node.style?.width,
          height: isBox && isCollapsed ? undefined : node.style?.height,
          minHeight: 90,
        },
        zIndex: isSelected
          ? 50
          : isRelated
            ? 35
            : isBox
              ? 2
              : node.parentId
                ? 25
                : 20,
        extent: NODE_EXTENT,
        data: {
          ...node.data,
          mode: currentMode,
          isSelected,
          isRelated,
          hasSelectionActive: !!relatedSet,
          blockedBy: nodeBlockedBy,
          blockedCount,
          problemCount,
          problem: problemTooltip,
          childCount: isBox ? liveChildCount : (nodeChildrenMap.get(node.id)?.length ?? node.data?.childCount),
          overdueCount: isBox ? liveOverdueCount : node.data?.overdueCount,
          inquiryOverdueCount: isBox ? liveInquiryOverdueCount : (node.data?.inquiryState === 'OVERDUE' ? 1 : 0),
          inquiryAwaitingCount: isBox ? liveInquiryAwaitingCount : (node.data?.inquiryState === 'AWAITING' || node.data?.inquiryState === 'PARTIAL' ? 1 : 0),
          inquiryCount: isBox ? liveInquiryCount : node.data?.inquiryCount,
          isParallel,
          parallelPeers,
          isCollapsed,
          onToggleCollapse: handleToggleCollapse,
          onToggleMode: handleToggleMode,
        },
      }
      nextCache.set(node.id, { src: node, key, node: built })
      return built
    })

    derivedNodeCacheRef.current = nextCache
    return orderParentNodesFirst(derived)
  }, [nodes, activeSelectedId, effectiveEditable, relatedSet, blockedByMap, parallelMap, handleToggleMode, handleToggleCollapse, toggledModes, collapsedNodes, hiddenNodeIds, tasks, project?.statuses, today])

  // Ref: CR-144 標示框墊最底、任務節點居中、文字註記疊最上；三者不混進 nodes 狀態
  const renderedNodes = useMemo(() => {
    const frames = annotationNodes.filter((n) => n.type === 'annotationFrame')
    const texts = annotationNodes.filter((n) => n.type === 'annotationText')
    return [...frames, ...nodesWithHandlers, ...texts]
  }, [annotationNodes, nodesWithHandlers])

  const derivedEdgeCacheRef = useRef<Map<string, { src: Edge; key: string; edge: Edge }>>(new Map())

  const styledEdges = useMemo(() => {
    const prevCache = derivedEdgeCacheRef.current
    const nextCache = new Map<string, { src: Edge; key: string; edge: Edge }>()

    const result = edges.map((e) => {
      const isHidden = hiddenNodeIds.has(String(e.source)) || hiddenNodeIds.has(String(e.target))
      const color = edgeColors[e.id]
      const edgeStyleAndMarker = getEdgeStyleAndMarker(e.sourceHandle, color)
      const obstacles = waypoints[e.id] ? [] : getObstaclesFromNodes(nodes, e.source, e.target)
      const wp = waypoints[e.id] ?? null
      const txt = edgeTexts[e.id] ?? ''

      const obstaclesKey = obstacles.map((o) => `${o.id}:${o.left},${o.top},${o.right},${o.bottom}`).join(';')
      const key = `${isHidden}|${e.sourceHandle}|${e.targetHandle}|${wp ? `${wp.x},${wp.y}` : ''}|${txt}|${color ?? ''}|${obstaclesKey}|${effectiveEditable}`

      const hit = prevCache.get(e.id)
      if (hit && hit.src === e && hit.key === key) {
        nextCache.set(e.id, hit)
        return hit.edge
      }

      const built: Edge = {
        ...e,
        ...edgeStyleAndMarker,
        hidden: isHidden,
        // Ref: CR-139 全檔統一直角折線 + 可拖曳折點
        type: 'orthogonal',
        data: {
          ...(e.data ?? {}),
          // Ref: CR-151 折點與文字都用 link id 當鍵
          waypoint: wp,
          obstacles,
          isConnectable: effectiveEditable,
          onWaypointChange: effectiveEditable ? handleWaypointChange : undefined,
          onWaypointReset: effectiveEditable ? handleWaypointReset : undefined,
          text: txt,
          onSaveText: effectiveEditable ? handleSaveEdgeText : undefined,
          onWaypointDragStart: effectiveEditable ? beginInteraction : undefined,
          onWaypointDragEnd: effectiveEditable ? endInteraction : undefined,
          onEdgeClick: effectiveEditable ? () => onEdgeClickRef.current?.(null, e) : undefined,
        },
        animated: false,
        style: {
          ...edgeStyleAndMarker.style,
          ...e.style,
          stroke: edgeStyleAndMarker.style.stroke,
          strokeDasharray: edgeStyleAndMarker.style.strokeDasharray,
          strokeWidth: 2.5,
          opacity: 1,
        },
        markerEnd: edgeStyleAndMarker.markerEnd,
      }
      nextCache.set(e.id, { src: e, key, edge: built })
      return built
    })

    derivedEdgeCacheRef.current = nextCache
    return result
  }, [
    edges,
    nodes,
    waypoints,
    effectiveEditable,
    handleWaypointChange,
    handleWaypointReset,
    edgeTexts,
    handleSaveEdgeText,
    edgeColors,
    handleSaveEdgeColor,
    beginInteraction,
    endInteraction,
    onEdgeClick,
    hiddenNodeIds,
  ])

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Ref: CR-148 */}
      <div className="h-12 shrink-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5 shrink-0">
            <span>🕸️</span> 任務關聯圖
          </span>

          {/* 管理者授權設定按鈕 (固定於左側標題旁) */}
          {canManagePerms && (
            <button
              type="button"
              onClick={() => setIsPermModalOpen(true)}
              title={T.flow.shared.permissions.btnHint}
              className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <span>⚙️</span> {T.flow.shared.permissions.btn}
            </button>
          )}

          {!effectiveEditable && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 select-none font-medium shrink-0">
              🔒 {T.flow.shared.readOnly}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {effectiveEditable && (
            <>
              <button
                type="button"
                onClick={handleAddTextAnnotation}
                title={ANNOTATION_STRINGS.addTextHint}
                className="flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>📝</span> {ANNOTATION_STRINGS.addText}
              </button>
              <button
                type="button"
                onClick={handleAddAreaFrame}
                title={T.flow.relationGraph.addFrameHint}
                className="flex items-center gap-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>🏷️</span> {ANNOTATION_STRINGS.addFrame}
              </button>
            </>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* 全螢幕切換按鈕 */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? '結束全螢幕 (Esc)' : '全螢幕檢視'}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            {isFullscreen ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="10" y1="14" x2="3" y2="21" />
                </svg>
                <span>縮小</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                <span>全螢幕</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex flex-row overflow-hidden">
        <div className="relative flex-1">
          <ReactFlow
            nodes={renderedNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onEdgeClick={onEdgeClick}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={(_, node) => {
              if (isAnnotationId(node.id)) return // Ref: CR-144
              onOpenTask?.(node.id)
            }}
            onPaneClick={onPaneClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onMoveEnd={handleMoveEnd}
            nodesDraggable={effectiveEditable}
            nodesConnectable={effectiveEditable}
            elementsSelectable={true}
            defaultViewport={savedViewport}
            fitView={!savedViewport && !focusedTaskId}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Step}
            connectionRadius={30}
            isValidConnection={isValidConnection}
            proOptions={PRO_OPTIONS}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            minZoom={0.05}
            maxZoom={2.5}
            zoomOnPinch={true}
            panOnScroll={false}
            preventScrolling={true}
            elevateEdgesOnSelect={true}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls
              showZoom={false}
              showFitView={false}
              showInteractive={false}
              className="!bg-white dark:!bg-slate-800 !border !border-slate-300 dark:!border-slate-600 !shadow-md !rounded-lg overflow-hidden [&_button]:!bg-white dark:[&_button]:!bg-slate-800 [&_button]:!text-slate-800 dark:[&_button]:!text-slate-100 [&_button]:!border-b [&_button]:!border-slate-200 dark:[&_button]:!border-slate-700 hover:[&_button]:!bg-slate-100 dark:hover:[&_button]:!bg-slate-700"
            >
              <ControlButton onClick={() => zoomIn({ duration: 250 })} title={T.flow.shared.zoomIn} aria-label={T.flow.shared.zoomIn}>
                <span className="text-sm font-bold select-none">➕</span>
              </ControlButton>
              <ControlButton onClick={() => zoomOut({ duration: 250 })} title={T.flow.shared.zoomOut} aria-label={T.flow.shared.zoomOut}>
                <span className="text-sm font-bold select-none">➖</span>
              </ControlButton>
              <ControlButton
                onClick={() => {
                  if (nodes.length === 0) {
                    setCenter(0, 0, { zoom: 1, duration: 300 })
                    return
                  }
                  const targetId = focusedTaskId || nodes[0]?.id
                  const targetNode = nodes.find((n) => n.id === targetId)
                  if (targetNode) {
                    const w = targetNode.measured?.width ?? 260
                    const h = targetNode.measured?.height ?? 90
                    setCenter(targetNode.position.x + w / 2, targetNode.position.y + h / 2, { zoom: 1, duration: 300 })
                  } else {
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
                    nodes.forEach((n) => {
                      if (n.parentId) return
                      const x = n.position.x
                      const y = n.position.y
                      const w = n.measured?.width ?? 260
                      const h = n.measured?.height ?? 90
                      if (x < minX) minX = x
                      if (x + w > maxX) maxX = x + w
                      if (y < minY) minY = y
                      if (y + h > maxY) maxY = y + h
                    })
                    const midX = minX !== Infinity ? (minX + maxX) / 2 : 0
                    const midY = minY !== Infinity ? (minY + maxY) / 2 : 0
                    setCenter(midX, midY, { zoom: 1, duration: 300 })
                  }
                }}
                title={T.flow.shared.centerTitle}
                aria-label={T.flow.shared.center}
              >
                <span className="text-sm select-none">🎯</span>
              </ControlButton>
              <ControlButton
                onClick={() => {
                  onSelectTask?.(null as unknown as string)
                  fitView({ padding: 0.12, duration: 350, minZoom: 0.05 })
                }}
                title={T.flow.relationGraph.fitAllTitle}
                aria-label={T.flow.shared.fitAll}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              </ControlButton>
              <ControlButton
                onClick={() => setShowHelpTooltip((prev) => !prev)}
                onMouseEnter={() => setShowHelpTooltip(true)}
                onMouseLeave={() => setShowHelpTooltip(false)}
                title={T.flow.relationGraph.legendTitle}
                aria-label={T.flow.shared.legend}
                className="!text-amber-500 font-bold"
              >
                ℹ️
              </ControlButton>
              <ControlButton
                onClick={toggleFullscreen}
                title={isFullscreen ? '結束全螢幕 (Esc)' : '全螢幕檢視'}
                aria-label={isFullscreen ? '縮小' : '全螢幕'}
              >
                {isFullscreen ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="10" y1="14" x2="3" y2="21" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </ControlButton>
            </Controls>
          </ReactFlow>

          {/* 左下角工具列說明懸浮視窗 */}
          {showHelpTooltip && (
            <div
              onMouseEnter={() => setShowHelpTooltip(true)}
              onMouseLeave={() => setShowHelpTooltip(false)}
              className="absolute left-14 bottom-3 z-30 w-80 rounded-xl border border-slate-200 bg-white/98 p-4 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/98 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in slide-in-from-left-2 duration-150 pointer-events-auto max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                  <span>ℹ️</span>
                  <span>{T.flow.relationGraph.help.title}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">{T.flow.relationGraph.help.subtitle}</span>
              </div>

              <div className="space-y-3 leading-relaxed text-slate-600 dark:text-slate-300">
                {/* 關聯線條 */}
                <div>
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1">
                    <span>🔗</span> {T.flow.relationGraph.help.edgeSection}
                  </div>
                  <div className="space-y-1 pl-1 text-[11px]">
                    <p className="flex items-center gap-1.5">
                      <span className="shrink-0 font-semibold text-red-500">{T.flow.relationGraph.help.solidRed}</span>{T.flow.relationGraph.help.solidRedDesc}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="shrink-0 font-semibold text-purple-600 dark:text-purple-400">{T.flow.relationGraph.help.dashedPurple}</span>{T.flow.relationGraph.help.dashedPurpleDesc}
                    </p>
                  </div>
                </div>

                {/* 狀態與警示 */}
                <div>
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1">
                    <span>🚩</span> {T.flow.relationGraph.help.badgeSection}
                  </div>
                  <div className="space-y-1 pl-1 text-[11px]">
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1 py-0.5 font-semibold text-[10px]">{T.flow.relationGraph.help.problem}</span>
                      <span>{T.flow.relationGraph.help.problemDesc}</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 rounded bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-600/20 px-1 py-0.5 font-semibold text-[10px]">{T.flow.relationGraph.help.blocked}</span>
                      <span>{T.flow.relationGraph.help.blockedDesc}</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-1 py-0.5 font-semibold text-[10px]">{T.flow.relationGraph.help.overdue}</span>
                      <span>{T.flow.relationGraph.help.overdueDesc}</span>
                    </p>
                  </div>
                </div>

                {/* 卡片與容器 */}
                <div>
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1">
                    <span>📦</span> {T.flow.relationGraph.help.typeSection}
                  </div>
                  <div className="space-y-1 pl-1 text-[11px]">
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 font-semibold">{T.flow.relationGraph.boxBadge}</span>
                      <span>{T.flow.relationGraph.help.boxDesc}</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 font-semibold text-blue-600 dark:text-blue-400">{T.flow.relationGraph.help.taskCard}</span>
                      <span>{T.flow.relationGraph.help.taskCardDesc}</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 font-semibold text-rose-600 dark:text-rose-400">{T.flow.relationGraph.help.bugCard}</span>
                      <span>{T.flow.relationGraph.help.bugCardDesc}</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-semibold">{T.flow.relationGraph.help.doneMark}</span>
                      <span>{T.flow.relationGraph.help.doneMarkDesc}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 右下角 即時 Log 開關按鈕 (僅管理者具備權限查看) */}
          {canManage && (
            <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setShowLogPanel((prev) => !prev)}
                className={cx(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all duration-150 cursor-pointer shadow-lg border select-none',
                  showLogPanel
                    ? 'bg-slate-900 text-white border-slate-700 dark:bg-slate-800'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                )}
                title={T.flow.relationGraph.log.toggleTitle}
              >
                📋
              </button>
            </div>
          )}
        </div>

        {canManage && showLogPanel && (
          <div className="w-80 border-l border-slate-200 bg-slate-900 text-slate-100 flex flex-col z-20 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 bg-slate-950/80">
              <div className="flex items-center gap-1.5 font-medium text-xs text-indigo-400">
                <span>📋</span>
                <span>{T.flow.relationGraph.log.panelTitle}</span>
                <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[10px] text-indigo-300 border border-indigo-500/30">
                  {logs.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  title={T.flow.relationGraph.log.clearTitle}
                >
                  {T.flow.relationGraph.log.clear}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogPanel(false)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  title={T.flow.relationGraph.log.closeTitle}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 font-mono text-[11px] leading-relaxed select-text" ref={logContainerRef}>
              {logs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {T.flow.relationGraph.log.emptyLine1}<br />{T.flow.relationGraph.log.emptyLine2}
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="rounded border border-slate-800 bg-slate-950/60 p-2 space-y-0.5 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`font-bold px-1 py-0.2 rounded ${
                        log.type === 'move_in' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' :
                        log.type === 'move_out' ? 'bg-amber-950 text-amber-400 border border-amber-800/50' :
                        log.type === 'toggle' ? 'bg-purple-950 text-purple-400 border border-purple-800/50' :
                        log.type === 'resize' ? 'bg-sky-950 text-sky-400 border border-sky-800/50' :
                        'bg-indigo-950 text-indigo-400 border border-indigo-800/50'
                      }`}>
                        {T.flow.relationGraph.log.type[log.type]}
                      </span>
                      <span className="text-slate-500 text-[10px]">{log.time}</span>
                    </div>
                    <div className="text-slate-200 break-all pt-0.5">{log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ref: CR-144 */}
      {editingAnnotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <span>✏️</span>
              {editingAnnotation.kind === 'text'
                ? ANNOTATION_STRINGS.editTextTitle
                : ANNOTATION_STRINGS.editFrameTitle}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {editingAnnotation.kind === 'text'
                    ? ANNOTATION_STRINGS.fieldTextContent
                    : ANNOTATION_STRINGS.fieldFrameLabel}
                </label>
                {editingAnnotation.kind === 'text' ? (
                  <textarea
                    value={editingAnnotation.label}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, label: e.target.value })}
                    rows={3}
                    placeholder={ANNOTATION_STRINGS.textPlaceholder}
                    className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <input
                    type="text"
                    value={editingAnnotation.label}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, label: e.target.value })}
                    placeholder={T.flow.relationGraph.framePlaceholder}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {editingAnnotation.kind === 'text'
                    ? ANNOTATION_STRINGS.fieldTextColor
                    : ANNOTATION_STRINGS.fieldFrameColor}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ANNOTATION_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.color}
                      type="button"
                      onClick={() => setEditingAnnotation({ ...editingAnnotation, color: opt.color })}
                      className={cx(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                        editingAnnotation.color === opt.color
                          ? 'border-blue-500 bg-blue-50 text-slate-800 ring-2 ring-blue-500/40 dark:bg-blue-950/40 dark:text-slate-100'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60'
                      )}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
                      <span className="truncate">{opt.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingAnnotation(null)}
                className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {T.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveAnnotationEdit}
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {T.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Ref: CR-150 同一個彈窗兼做「編輯文字」與「刪除」，不另外再開一個 */}
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
              <span className="text-xl">🔗</span>
              <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">
                {T.flow.relationGraph.edgeModalTitle}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {T.flow.relationGraph.deleteEdgeMessage(confirmDeleteEdge.sourceRef, confirmDeleteEdge.targetRef)}
            </p>

            <label className="mt-4 mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {T.flow.relationGraph.fieldEdgeText}
            </label>
            <input
              type="text"
              value={confirmDeleteEdge.text}
              onChange={(e) => setConfirmDeleteEdge({ ...confirmDeleteEdge, text: e.target.value })}
              placeholder={T.flow.relationGraph.edgeTextPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {/* Ref: CR-188 連線顏色選擇 */}
            <label className="mt-4 mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              連線顏色
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {EDGE_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.color}
                  type="button"
                  onClick={() => setConfirmDeleteEdge({ ...confirmDeleteEdge, color: opt.color })}
                  className={cx(
                    'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                    confirmDeleteEdge.color === opt.color
                      ? 'border-blue-500 bg-blue-50 text-slate-800 ring-2 ring-blue-500/40 dark:bg-blue-950/40 dark:text-slate-100'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  )}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full shadow-xs" style={{ backgroundColor: opt.color }} />
                  <span className="truncate">{opt.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const edgeIdToDelete = confirmDeleteEdge.edgeId
                  setEdges((eds) => eds.filter((e) => e.id !== edgeIdToDelete))
                  handleSaveEdgeText(edgeIdToDelete, '')
                  handleSaveEdgeColor(edgeIdToDelete, '')
                  setConfirmDeleteEdge(null)

                  const key = `pmflow_simple_graph_edge_handles_${projectId}`
                  try {
                    const savedStr = localStorage.getItem(key)
                    if (savedStr) {
                      const handleMap = JSON.parse(savedStr)
                      delete handleMap[edgeIdToDelete]
                      localStorage.setItem(key, JSON.stringify(handleMap))
                    }
                  } catch {}

                  Api.deleteLink(edgeIdToDelete)
                    .then(() => {
                      if (projectId) {
                        queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
                        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
                        queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
                        queryClient.invalidateQueries({ queryKey: ['task'] })
                      }
                    })
                    .catch((err) => {
                      console.error('Failed to delete link:', err)
                      if (projectId) {
                        queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
                      }
                    })
                }}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-3.5 py-2 text-sm font-medium text-white transition-colors cursor-pointer shadow-sm"
              >
                {T.flow.relationGraph.deleteEdge}
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteEdge(null)}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  {T.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveEdgeText(confirmDeleteEdge.edgeId, confirmDeleteEdge.text)
                    if (confirmDeleteEdge.color) {
                      handleSaveEdgeColor(confirmDeleteEdge.edgeId, confirmDeleteEdge.color)
                    }
                    setConfirmDeleteEdge(null)
                  }}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer shadow-sm"
                >
                  {T.common.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmUnboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <span className="text-xl">⚠️</span>
              <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">
                {T.flow.relationGraph.unboxTitle}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {T.flow.relationGraph.unboxMessage.before} <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{confirmUnboxModal.refText}</span> {T.flow.relationGraph.unboxMessage.middle} <span className="font-bold text-red-600 dark:text-red-400">{confirmUnboxModal.count}</span> {T.flow.relationGraph.unboxMessage.after}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmUnboxModal(null)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                {T.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const bId = confirmUnboxModal.boxId
                  setConfirmUnboxModal(null)
                  executeToggleMode(bId)
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer shadow-sm"
              >
                {T.flow.relationGraph.unboxConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <span className="text-xl">⚠️</span>
              <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">
                {T.flow.relationGraph.alertTitle}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {alertMsg}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setAlertMsg(null)}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer shadow-sm"
              >
                {T.flow.relationGraph.alertOk}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 畫布共同編輯授權名單 Modal (Ref: CR-194) */}
      <CanvasPermissionModal
        open={isPermModalOpen}
        onClose={() => setIsPermModalOpen(false)}
        projectId={projectId || ''}
        canvasKey="task-graph"
        canvasTitle="任務關聯圖"
      />
    </div>
  )
}

export default function TaskGraph(props: TaskGraphProps) {
  return (
    <ReactFlowProvider>
      <TaskGraphInner {...props} />
    </ReactFlowProvider>
  )
}
export { TaskGraph as SimpleGraph }
