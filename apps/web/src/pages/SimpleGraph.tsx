import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Api, type Task } from '../lib/api'
import { DEFAULT_TYPE_COLORS } from '../components/EpicSidebar'
import { cx, ProblemBadge, TypeBadge } from '../components/ui'
import { rollup } from '../lib/rollup'
import { T } from '../strings' // Ref: CR-146

// 依據出發接點（左右出發為紅色實線、上下出發為紫色虛線）與標頭箭頭方向產生邊樣式
function getEdgeStyleAndMarker(sourceHandle?: string | null) {
  const isLeftRight = !sourceHandle || sourceHandle.includes('left') || sourceHandle.includes('right')
  const strokeColor = isLeftRight ? '#ef4444' : '#8b5cf6'
  return {
    animated: false,
    style: {
      strokeWidth: 2,
      stroke: strokeColor,
      strokeDasharray: isLeftRight ? 'none' : '5 5',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: strokeColor,
      width: 14,
      height: 14,
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

const STORAGE_KEY_VIEWPORT = 'pmflow_simple_graph_viewport'

// 讀取先前儲存的畫面焦點與縮放比例 (Viewport)
function loadSavedViewport(): Viewport | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VIEWPORT)
    if (raw) {
      const parsed = JSON.parse(raw) as Viewport
      if (parsed && typeof parsed.zoom === 'number' && parsed.zoom >= 0.1) {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return undefined
}

const savedViewport = loadSavedViewport()

// 確保父收納盒節點在 nodes 陣列中優先於子卡片 (對齊 Graph.tsx: React Flow 要求父節點排在子節點前面，否則子節點座標會對不上)
function orderParentNodesFirst(nodes: Node[]): Node[] {
  const parentMap = new Map(nodes.map((n) => [n.id, n.parentId]))
  const getDepth = (id: string) => {
    let d = 0
    let cur = parentMap.get(id)
    while (cur && d < 20) {
      d++
      cur = parentMap.get(cur)
    }
    return d
  }
  return [...nodes].sort((a, b) => getDepth(a.id) - getDepth(b.id))
}

export type NodeMode = 'card' | 'box'

export type SimpleGraphNodeData = {
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
  minWidth?: number
  minHeight?: number
  onToggleMode?: (id: string) => void
  onOpenTask?: (id: string) => void
}

export type CustomSimpleNode = Node<SimpleGraphNodeData, 'simpleNode'>

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
  visited = new Set<string>()
): { minWidth: number; minHeight: number; width: number; height: number } {
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
    let kH = Number(k.style?.height ?? k.height ?? (k as any).measured?.height ?? (isKBox ? 280 : 90))

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

// 自由切換的節點 UI (包含四向雙向 Handle 接點，允許上下左右任意拉線)
function SimpleNodeView({ id, data, width, height }: NodeProps<CustomSimpleNode>) {
  const isBox = data.mode === 'box'
  const boxW = width ?? 340
  const boxH = height ?? 260

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
      style={isBox ? { width: boxW, height: boxH } : { width: 256 }}
      className="relative w-full h-auto cursor-grab active:cursor-grabbing select-none pointer-events-auto"
    >
      {/* 接點 (Handles) - 4 個邊各保留 1 個中央精準接點，帶 nodrag 避免拉線時誤觸卡片拖曳 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-out"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right-in"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />

      <Handle
        type="target"
        position={Position.Top}
        id="top-in"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-out"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-in"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-out"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag after:absolute after:content-[''] after:-inset-2 after:rounded-full"
      />

      {isBox ? (
        <div
          className={cx(
            'relative w-full h-full min-w-[320px] min-h-[240px] rounded-lg border bg-slate-50/40 dark:bg-slate-900/50 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-grab active:cursor-grabbing pointer-events-auto overflow-hidden opacity-100',
            data.isSelected
              ? 'border-blue-500 ring-2 ring-blue-500 shadow-xl'
              : 'border-slate-300 dark:border-slate-700'
          )}
        >
          <div>
            <div
              className="h-1 rounded-t-lg shrink-0"
              style={{ backgroundColor: data.typeColor || '#6366f1' }}
            />
            <div className="px-2.5 py-1.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 flex flex-col justify-start gap-1">
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1.5 flex-1 min-w-0 whitespace-nowrap overflow-x-auto no-scrollbar">
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
                </div>
                <span className="text-[10px] text-slate-400/90 dark:text-slate-500/90 font-normal shrink-0 select-none pointer-events-none pl-1">
                  {T.flow.relationGraph.boxCapacityHint}
                </span>
              </div>

              {/* 第二行：收納盒警示徽章 */}
              {((typeof data.childCount === 'number' && data.childCount > 0) ||
                data.problem ||
                (typeof data.problemCount === 'number' && data.problemCount > 0) ||
                (typeof data.blockedCount === 'number' && data.blockedCount > 0) ||
                (data.blockedBy && data.blockedBy.length > 0) ||
                data.isParallel ||
                (typeof data.overdueCount === 'number' && data.overdueCount > 0) ||
                data.isOverdue ||
                (typeof data.inquiryCount === 'number' && data.inquiryCount > 0) ||
                data.inquiryState === 'AWAITING' ||
                data.inquiryState === 'PARTIAL' ||
                data.inquiryState === 'OVERDUE') && (
                <div className="flex flex-wrap items-center gap-1 min-w-0">
                  {typeof data.childCount === 'number' && data.childCount > 0 && (
                    <span className="shrink-0 whitespace-nowrap rounded px-1 text-[10px] bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 font-medium pointer-events-none select-none">
                      {T.flow.relationGraph.childCount(data.childCount)}
                    </span>
                  )}
                  <ProblemBadge problem={data.problem} count={data.problemCount} isBox={true} />
                  {((typeof data.blockedCount === 'number' && data.blockedCount > 0) || (data.blockedBy && data.blockedBy.length > 0)) && (
                    <span
                      title={T.flow.relationGraph.blockedTitle(data.blockedBy?.join('、') || T.flow.relationGraph.blockedBoxFallback)}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 pointer-events-none select-none"
                    >
                      <span aria-hidden>⛔</span>{T.flow.relationGraph.blockedBadge} {typeof data.blockedCount === 'number' && data.blockedCount > 0 ? data.blockedCount : ''}
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
                  {((typeof data.overdueCount === 'number' && data.overdueCount > 0) || data.isOverdue) && (
                    <span
                      title={T.flow.relationGraph.overdueTitle(data.dueDate || '')}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 pointer-events-none select-none"
                    >
                      {T.flow.relationGraph.overdueBadge} {typeof data.overdueCount === 'number' && data.overdueCount > 0 ? data.overdueCount : ''}
                    </span>
                  )}
                  {((typeof data.inquiryCount === 'number' && data.inquiryCount > 0) || data.inquiryState === 'AWAITING' || data.inquiryState === 'PARTIAL' || data.inquiryState === 'OVERDUE') && (
                    <span
                      title={T.flow.relationGraph.inquiryTitle}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 pointer-events-none select-none"
                    >
                      {T.flow.relationGraph.inquiryBadge} {typeof data.inquiryCount === 'number' && data.inquiryCount > 0 ? data.inquiryCount : ''}
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

          {/* 右下角縮放控制鈕 */}
          <NodeResizeControl
            position="bottom-right"
            minWidth={data.minWidth ?? 340}
            minHeight={data.minHeight ?? 280}
            className="nodrag !w-4 !h-4 !bottom-1 !right-1 !border-0 !bg-transparent"
          >
            <div
              className="w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 border border-slate-300/80 dark:border-slate-600/80 cursor-se-resize shadow-xs select-none"
              title={T.flow.relationGraph.resizeBox}
            >
              ↘
            </div>
          </NodeResizeControl>
        </div>
      ) : (
        <div
          className={cx(
            'min-w-[256px] w-max max-w-[480px] min-h-[90px] h-auto rounded-lg border bg-white shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-900 select-none cursor-grab active:cursor-grabbing pointer-events-auto flex flex-col justify-start overflow-hidden opacity-100',
            data.isSelected
              ? 'border-blue-500 ring-2 ring-blue-500 shadow-xl'
              : 'border-slate-200 dark:border-slate-800'
          )}
        >
          <div
            className="h-1 rounded-t-lg shrink-0"
            style={{ backgroundColor: data.typeColor || '#3b82f6' }}
          />
          <div className="p-2.5 flex flex-col justify-start flex-1 gap-1 min-w-0">
            {/* 第一行：卡片按鈕 + MRG編號 + 種類名稱 */}
            <div className="flex items-center gap-1.5 w-max min-w-full whitespace-nowrap overflow-visible">
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

            {/* 第二行：警示徽章 */}
            {((data.taskType !== 'BUG' && data.problem) ||
              (data.blockedBy && data.blockedBy.length > 0) ||
              data.isParallel ||
              data.isOverdue ||
              data.inquiryState === 'AWAITING' ||
              data.inquiryState === 'PARTIAL' ||
              data.inquiryState === 'OVERDUE') && (
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {data.taskType !== 'BUG' && <ProblemBadge problem={data.problem} />}
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
                {(data.inquiryState === 'AWAITING' || data.inquiryState === 'PARTIAL' || data.inquiryState === 'OVERDUE') && (
                  <span
                    title={T.flow.relationGraph.inquiryTitle}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 pointer-events-none select-none"
                  >
                    {T.flow.relationGraph.inquiryBadge}
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
    </div>
  )
}

const nodeTypes = {
  simpleNode: SimpleNodeView,
  // Ref: CR-144
  annotationText: SimpleTextNode,
  annotationFrame: SimpleFrameNode,
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

// Ref: CR-139 全程只由水平/垂直線段組成，折點 (px, py) 決定在哪裡轉彎
function buildOrthogonalPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sourcePosition: Position,
  targetPosition: Position,
  waypoint?: Waypoint | null
): { path: string; px: number; py: number } {
  const px = waypoint ? waypoint.x : (sx + tx) / 2
  const py = waypoint ? waypoint.y : (sy + ty) / 2
  const srcHoriz = sourcePosition === Position.Left || sourcePosition === Position.Right
  const tgtHoriz = targetPosition === Position.Left || targetPosition === Position.Right

  const a = srcHoriz ? { x: px, y: sy } : { x: sx, y: py }
  const b = tgtHoriz ? { x: px, y: ty } : { x: tx, y: py }
  const raw: Waypoint[] = [{ x: sx, y: sy }, a, { x: px, y: py }, b, { x: tx, y: ty }]

  const pts: Waypoint[] = []
  for (const p of raw) {
    const last = pts[pts.length - 1]
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) pts.push(p)
  }

  return {
    path: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' '),
    px,
    py,
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
  onWaypointChange?: (key: string, p: Waypoint) => void
  onWaypointReset?: (key: string) => void
}

// Ref: CR-139
function OrthogonalEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow()
  const draggingRef = useRef(false)
  const eData = data as OrthogonalEdgeData | undefined
  const wpKey = `${source}_${target}`

  const { path, px, py } = buildOrthogonalPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    eData?.waypoint
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    draggingRef.current = true
    armWaypointClickGuard() // Ref: CR-141
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    e.stopPropagation()
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    eData?.onWaypointChange?.(wpKey, { x: Math.round(p.x), y: Math.round(p.y) })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.stopPropagation()
    scheduleWaypointGuardRelease() // Ref: CR-141
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={20} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute h-2.5 w-2.5 rounded-full border border-white/80 bg-slate-400/70 hover:bg-blue-500 dark:border-slate-900/80 dark:bg-slate-500/70 cursor-move after:absolute after:content-[''] after:-inset-[9px] after:rounded-full"
          style={{
            transform: `translate(-50%, -50%) translate(${px}px, ${py}px)`,
            pointerEvents: 'all',
          }}
          title={T.flow.relationGraph.waypointHint}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(e) => {
            // Ref: CR-141
            e.stopPropagation()
          }}
          onDoubleClick={(e) => {
            // Ref: CR-141
            e.stopPropagation()
            e.preventDefault()
            armWaypointClickGuard()
            scheduleWaypointGuardRelease()
            eData?.onWaypointReset?.(wpKey)
          }}
        />
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = {
  orthogonal: OrthogonalEdge,
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

type SimpleAnnotationNodeData = {
  label: string
  color: string
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

// Ref: CR-144 純文字註記：沒有外框、沒有底色、不給接點
function SimpleTextNode({ id, data }: NodeProps) {
  const d = data as unknown as SimpleAnnotationNodeData
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
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

      <div className="nodrag absolute -top-3 -right-3 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onPointerDown={stop}
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
          onPointerDown={stop}
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
    </div>
  )
}

// Ref: CR-144 區域標示框：純視覺、墊最底層、框身不吃點擊
function SimpleFrameNode({ id, data }: NodeProps) {
  const d = data as unknown as SimpleAnnotationNodeData
  const color = d.color || '#8b5cf6'
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <div className="group pointer-events-none relative h-full w-full">
      <div
        className="h-full w-full rounded-2xl border-2 border-dashed"
        style={{ borderColor: color, backgroundColor: `${color}12` }}
      />

      <div
        className="pointer-events-auto absolute -top-3 left-3 flex max-w-[85%] cursor-grab items-center gap-1 rounded-lg border bg-white px-2 py-0.5 shadow-xs active:cursor-grabbing dark:bg-slate-900"
        style={{ borderColor: color }}
      >
        <span className="shrink-0 text-[11px]">🏷️</span>
        <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
          {d.label || ANNOTATION_STRINGS.frameFallback}
        </span>
        <button
          type="button"
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation()
            d.onEdit?.(id)
          }}
          title={ANNOTATION_STRINGS.editFrame}
          className="nodrag cursor-pointer rounded p-0.5 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-blue-600 dark:hover:text-blue-400"
        >
          ✏️
        </button>
        <button
          type="button"
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation()
            d.onDelete?.(id)
          }}
          title={ANNOTATION_STRINGS.deleteFrame}
          className="nodrag cursor-pointer rounded p-0.5 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400"
        >
          🗑️
        </button>
      </div>

      <NodeResizeControl
        minWidth={220}
        minHeight={160}
        style={{ background: 'transparent', border: 'none' }}
        className="nodrag pointer-events-auto"
      >
        <div
          title={T.flow.relationGraph.resizeFrame}
          className="absolute right-1 bottom-1 cursor-se-resize select-none p-1 text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          ↘
        </div>
      </NodeResizeControl>
    </div>
  )
}

export interface SimpleGraphProps {
  projectId?: string
  tasks?: Task[]
  onOpenTask?: (taskId: string) => void
  focusedTaskId?: string | null
  menuFocusTarget?: { id: string | null; ts: number } | null
  onSelectTask?: (taskId: string) => void
}

type ConfirmDeleteEdgeState = {
  edgeId: string
  sourceRef: string
  targetRef: string
}

type LogItem = {
  id: string
  time: string
  type: 'move' | 'move_in' | 'move_out' | 'toggle' | 'resize'
  message: string
}

function SimpleGraphInner({ projectId, tasks, onOpenTask, focusedTaskId, menuFocusTarget, onSelectTask }: SimpleGraphProps) {
  const { fitView, setCenter, getViewport, zoomIn, zoomOut } = useReactFlow()
  const queryClient = useQueryClient()
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => Api.project(projectId!),
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

  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const lastFocusedTsRef = useRef<number>(0)

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

    const targetNode = nodes.find((n) => n.id === menuFocusTarget.id)
    if (!targetNode) return

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

    setCenter(centerX, centerY, { duration: 600, zoom: targetZoom })
  }, [menuFocusTarget, nodes, setCenter, getViewport])

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

      // 若從收納盒轉回卡片，將盒內所有子卡片移出，並移除它們的所有相關關聯線
      if (currentMode === 'box' && nextMode === 'card') {
        const childKids = currentNodes.filter((cn) => cn.parentId === nodeId)
        if (childKids.length > 0) {
          const childIds = new Set(childKids.map((k) => k.id))

          // 1. 找出所有與移出卡片相連的關聯線，呼叫 API 刪除並從前端即時移除
          const currentEdges = edgesRef.current
          const affectedEdges = currentEdges.filter(
            (e) => childIds.has(String(e.source)) || childIds.has(String(e.target))
          )
          const affectedEdgeIds = new Set(affectedEdges.map((e) => e.id))

          affectedEdges.forEach((e) => {
            Api.deleteLink(e.id).catch((err) => console.error('Failed to delete link on unbox:', err))
          })

          if (affectedEdgeIds.size > 0) {
            setEdges((eds) => eds.filter((e) => !affectedEdgeIds.has(e.id)))
          }

          // 2. 呼叫 API 將子卡片的 parentId 設為 null，並即時更新 react-query tasks 快取
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

          // 3. 計算移出後的畫布絕對座標，同步更新 dragged 狀態避免後續切換時卡片重新跑進去
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
          if ((v as any).x > 0 || (v as any).y > 0) {
            clean[k] = v as any
          }
        }
      }
      return clean
    } catch {
      return {}
    }
  })

  // Ref: CR-139
  const [waypoints, setWaypoints] = useState<WaypointMap>(() => loadWaypoints(projectId))

  useEffect(() => {
    setWaypoints(loadWaypoints(projectId))
  }, [projectId])

  useEffect(() => {
    saveWaypoints(projectId, waypoints)
  }, [waypoints, projectId])

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

  // Ref: CR-144
  const [annotations, setAnnotations] = useState<CanvasAnnotations>(() => loadCanvasAnnotations(projectId))
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations
  const [editingAnnotation, setEditingAnnotation] = useState<
    { id: string; kind: 'text' | 'frame'; label: string; color: string } | null
  >(null)

  useEffect(() => {
    setAnnotations(loadCanvasAnnotations(projectId))
  }, [projectId])

  useEffect(() => {
    saveCanvasAnnotations(projectId, annotations)
  }, [annotations, projectId])

  const handleAddTextAnnotation = useCallback(() => {
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
    setEditingAnnotation({ id, kind: 'text', label: ANNOTATION_STRINGS.newTextDefault, color: '' })
  }, [])

  const handleAddAreaFrame = useCallback(() => {
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
  }, [])

  const handleEditAnnotation = useCallback((id: string) => {
    const cur = annotationsRef.current
    const t = cur.texts.find((x) => x.id === id)
    if (t) {
      setEditingAnnotation({ id, kind: 'text', label: t.text, color: t.color })
      return
    }
    const f = cur.frames.find((x) => x.id === id)
    if (f) setEditingAnnotation({ id, kind: 'frame', label: f.label, color: f.color })
  }, [])

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => ({
      texts: prev.texts.filter((t) => t.id !== id),
      frames: prev.frames.filter((f) => f.id !== id),
    }))
    setEditingAnnotation((prev) => (prev?.id === id ? null : prev))
  }, [])

  const handleSaveAnnotationEdit = useCallback(() => {
    setEditingAnnotation((cur) => {
      if (!cur) return null
      setAnnotations((prev) =>
        cur.kind === 'text'
          ? { ...prev, texts: prev.texts.map((t) => (t.id === cur.id ? { ...t, text: cur.label, color: cur.color } : t)) }
          : { ...prev, frames: prev.frames.map((f) => (f.id === cur.id ? { ...f, label: cur.label, color: cur.color } : f)) }
      )
      return null
    })
  }, [])

  const annotationNodes = useMemo<Node[]>(() => {
    const frameNodes: Node[] = annotations.frames.map((f) => ({
      id: f.id,
      type: 'annotationFrame',
      position: { x: f.x, y: f.y },
      style: { width: f.width, height: f.height, pointerEvents: 'none' },
      width: f.width,
      height: f.height,
      draggable: true,
      selectable: false,
      connectable: false,
      deletable: false,
      zIndex: 0,
      data: { label: f.label, color: f.color, onEdit: handleEditAnnotation, onDelete: handleDeleteAnnotation },
    }))
    const textNodes: Node[] = annotations.texts.map((t) => ({
      id: t.id,
      type: 'annotationText',
      position: { x: t.x, y: t.y },
      draggable: true,
      selectable: false,
      connectable: false,
      deletable: false,
      zIndex: 25,
      data: { label: t.text, color: t.color, onEdit: handleEditAnnotation, onDelete: handleDeleteAnnotation },
    }))
    return [...frameNodes, ...textNodes]
  }, [annotations, handleEditAnnotation, handleDeleteAnnotation])

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

  // 切換專案時自動重置對焦狀態並載入該專案的持久化位置、尺寸與模式
  useEffect(() => {
    hasFittedRef.current = false
    isLoadedRef.current = false
    try {
      const savedD = localStorage.getItem(`pmflow_simple_graph_dragged_${projectId}`)
      if (savedD) {
        const parsed = JSON.parse(savedD)
        const clean: Record<string, { x: number; y: number }> = {}
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof (v as any).x === 'number' && typeof (v as any).y === 'number') {
            if ((v as any).x > 0 || (v as any).y > 0) {
              clean[k] = v as any
            }
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
    const timer = setTimeout(() => {
      isLoadedRef.current = true
    }, 50)
    return () => clearTimeout(timer)
  }, [projectId])

  // 卸載 (切換頁籤) 前備份所有節點當前位置至 localStorage
  useEffect(() => {
    return () => {
      if (!projectId || nodesRef.current.length === 0) return
      try {
        const currentDragged: Record<string, { x: number; y: number }> = {}
        nodesRef.current.forEach((n) => {
          if (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number') {
            currentDragged[n.id] = { x: n.position.x, y: n.position.y }
          }
        })
        if (Object.keys(currentDragged).length > 0) {
          const saved = localStorage.getItem(`pmflow_simple_graph_dragged_${projectId}`)
          const existing = saved ? JSON.parse(saved) : {}
          const merged = { ...existing, ...currentDragged }
          localStorage.setItem(`pmflow_simple_graph_dragged_${projectId}`, JSON.stringify(merged))
        }
      } catch {
        // ignore
      }
    }
  }, [projectId])

  // 載入專案真實關聯線 (Edges) 並帶入正確使用者選取的接點 (sourceHandle & targetHandle)
  useEffect(() => {
    if (!projectId) return
    Api.graph(projectId)
      .then((res) => {
        if (res.edges) {
          let savedMap: Record<string, { sourceHandle?: string; targetHandle?: string }> = {}
          try {
            const savedStr = localStorage.getItem(`pmflow_simple_graph_edge_handles_${projectId}`)
            if (savedStr) savedMap = JSON.parse(savedStr)
          } catch {}

          const realEdges: Edge[] = res.edges.map((e) => {
            const edgeKey = `${e.sourceId}_${e.targetId}`
            const hData = savedMap[edgeKey] || savedMap[e.id]
            const sHandle = hData?.sourceHandle
            const tHandle = hData?.targetHandle
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
          setEdges(realEdges)
        }
      })
      .catch((err) => console.error('Failed to fetch graph edges:', err))
  }, [projectId])

  // 僅當「完全沒有儲存過 Viewport」時，首次進入才執行 fitView
  useEffect(() => {
    if (savedViewport) return // 已有儲存視角時，保留使用者上次的位置與縮放，不自動重置

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
  }, [nodes, fitView])

  // 每次拖曳移位自動寫入 localStorage 保存 (僅在載入完成後生效)
  useEffect(() => {
    if (!projectId || !isLoadedRef.current) return
    try {
      if (Object.keys(dragged).length > 0) {
        localStorage.setItem(`pmflow_simple_graph_dragged_${projectId}`, JSON.stringify(dragged))
      } else {
        localStorage.removeItem(`pmflow_simple_graph_dragged_${projectId}`)
      }
    } catch {
      // ignore
    }
  }, [dragged, projectId])

  // 每次調整大小自動寫入 localStorage 保存 (僅在載入完成後生效)
  useEffect(() => {
    if (!projectId || !isLoadedRef.current) return
    try {
      if (Object.keys(resized).length > 0) {
        localStorage.setItem(`pmflow_simple_graph_resized_${projectId}`, JSON.stringify(resized))
      } else {
        localStorage.removeItem(`pmflow_simple_graph_resized_${projectId}`)
      }
    } catch {
      // ignore
    }
  }, [resized, projectId])

  // 每次切換模式自動寫入 localStorage 保存 (僅在載入完成後生效)
  useEffect(() => {
    if (!projectId || !isLoadedRef.current) return
    try {
      if (Object.keys(toggledModes).length > 0) {
        localStorage.setItem(
          `pmflow_simple_graph_toggled_modes_${projectId}`,
          JSON.stringify(toggledModes)
        )
      } else {
        localStorage.removeItem(`pmflow_simple_graph_toggled_modes_${projectId}`)
      }
    } catch {
      // ignore
    }
  }, [toggledModes, projectId])

  // 當 props.tasks 變動時，自動將 Left Menu 任務動態轉換為關聯圖節點
  useEffect(() => {
    if (!tasks || tasks.length === 0) {
      setNodes([])
      return
    }

    const draggedMap = draggedRef.current
    const resizedMap = resizedRef.current
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
      const isDefaultBox = parentIdSet.has(t.id)
      const mode = toggledModes[t.id] ?? (existingMode === 'box' ? 'box' : isDefaultBox ? 'box' : 'card')
      const isBox = mode === 'box'
      const kids = childrenMap.get(t.id) || []

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

        const dims = computeBoxDimensions(t.id, childNodesList, resizedMap[t.id]?.width, resizedMap[t.id]?.height)

        const tStatusCat = statusCatMap.get(t.statusKey)
        const tOverdue = !!(t.dueDate && t.dueDate < today && (t.progress ?? 0) < 100 && tStatusCat !== 'DONE' && t.statusKey !== 'DONE')
        const tParallelInfo = parallelMap.get(t.id)

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
            problem: t.problem,
            problemCount: (t.problem ? 1 : 0) + kids.filter(k => k.type === 'BUG' || k.problem).length,
            blockedCount: (blockedByMap.get(t.id)?.length ? 1 : 0) + kids.filter(k => blockedByMap.get(k.id) && blockedByMap.get(k.id)!.length > 0).length,
            overdueCount: (tOverdue ? 1 : 0) + kids.filter(k => !!(k.dueDate && k.dueDate < today && (k.progress ?? 0) < 100 && statusCatMap.get(k.statusKey) !== 'DONE' && k.statusKey !== 'DONE')).length,
            inquiryCount: ((t.inquiryState === 'AWAITING' || t.inquiryState === 'PARTIAL' || t.inquiryState === 'OVERDUE') ? 1 : 0) + kids.filter(k => k.inquiryState === 'AWAITING' || k.inquiryState === 'PARTIAL' || k.inquiryState === 'OVERDUE').length,
            childCount: kids.length,
            isOverdue: tOverdue,
            dueDate: t.dueDate,
            inquiryState: t.inquiryState,
            isParallel: tParallelInfo?.isParallel,
            parallelPeers: tParallelInfo?.peers,
            minWidth: dims.minWidth,
            minHeight: dims.minHeight,
            onToggleMode: handleToggleMode,
            onOpenTask,
          },
        })

        kids.forEach((k, idx) => {
          const cCol = Math.floor(idx / 5)
          const cRow = idx % 5
          const defaultSlotPos = { x: 24 + cCol * 280, y: 110 + cRow * 115 }
          const kDefaultBox = parentIdSet.has(k.id)
          const kMode = toggledModes[k.id] ?? (kDefaultBox ? 'box' : 'card')

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
            const kOverdue = !!(k.dueDate && k.dueDate < today && (k.progress ?? 0) < 100 && kStatusCat !== 'DONE' && k.statusKey !== 'DONE')
            const kParallelInfo = parallelMap.get(k.id)

            newNodes.push({
              id: k.id,
              type: 'simpleNode',
              parentId: t.id,
              position: kPos,
              zIndex: 10,
              data: {
                label: k.title,
                refText: k.ref,
                mode: 'card',
                progress: rolledMap.get(k.id)?.progress ?? k.progress ?? 0,
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
            })
          } else {
            processTask(k, t.id, defaultSlotPos.x, defaultSlotPos.y)
          }
        })
      } else {
        const cardPos = draggedMap[t.id] ?? (!parentBoxId ? { x: rootX, y: rootY } : { x: 24, y: 110 })
        const tStatusCat = statusCatMap.get(t.statusKey)
        const tOverdue = !!(t.dueDate && t.dueDate < today && (t.progress ?? 0) < 100 && tStatusCat !== 'DONE' && t.statusKey !== 'DONE')
        const tParallelInfo = parallelMap.get(t.id)

        newNodes.push({
          id: t.id,
          type: 'simpleNode',
          parentId: parentBoxId,
          position: cardPos,
          zIndex: parentBoxId ? 10 : 2,
          data: {
            label: t.title,
            refText: t.ref,
            mode: 'card',
            progress: rolledMap.get(t.id)?.progress ?? t.progress ?? 0,
            typeColor: typeColorOf(t.type),
            typeName: typeNameOf(t.type),
            taskType: t.type,
            problem: t.problem,
            isOverdue: tOverdue,
            dueDate: t.dueDate,
            inquiryState: t.inquiryState,
            isParallel: tParallelInfo?.isParallel,
            parallelPeers: tParallelInfo?.peers,
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
        const defaultBoxW = 340
        const defaultBoxH = 260

        const targetPos = savedPos ?? existing?.position ?? newNode.position
        const targetW = isBoxNode
          ? Math.max(defaultBoxW, existing?.width ?? savedSize?.width ?? newNode.width ?? defaultBoxW)
          : (existing?.width ?? savedSize?.width ?? newNode.width)

        const targetH = isBoxNode
          ? Math.max(defaultBoxH, existing?.height ?? savedSize?.height ?? newNode.height ?? defaultBoxH)
          : (existing?.height ?? savedSize?.height ?? newNode.height)

        const styleObj = isBoxNode
          ? {
              ...(existing?.style || newNode.style),
              width: targetW,
              height: targetH,
            }
          : {
              ...(existing?.style || newNode.style),
              ...(targetW ? { width: targetW } : {}),
              ...(targetH ? { height: targetH } : {}),
            }

        const dimObj = isBoxNode
          ? { width: targetW!, height: targetH! }
          : (targetW && targetH ? { width: targetW, height: targetH } : undefined)

        return {
          ...newNode,
          position: targetPos,
          style: styleObj,
          width: targetW,
          height: targetH,
          measured: dimObj,
        }
      })

      return orderParentNodesFirst(merged)
    })
  }, [tasks, toggledModes])

  const onNodesChange = useCallback((rawChanges: NodeChange[]) => {
    // Ref: CR-144 文字註記與區域標示框不是任務，改動只寫進 annotations，不進任務節點流程
    const annChanges = rawChanges.filter((c) => 'id' in c && isAnnotationId((c as { id: string }).id))
    if (annChanges.length > 0) {
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
              }
            })
            return nextResized
          })
        }, 0)
      }

      // 關鍵修復：強制父收納盒優先排序，防止 DOM 層級蓋過子卡片造成移動畫布 (Pan)
      return orderParentNodesFirst(next)
    })
  }, [])

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (consumeWaypointClickGuard()) return // Ref: CR-141
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const targetNode = nodes.find((n) => n.id === edge.target)

      const sourceRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card
      const targetRef = (targetNode?.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card

      setConfirmDeleteEdge({
        edgeId: edge.id,
        sourceRef,
        targetRef,
      })
    },
    [nodes]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return

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

      const hasDuplicateEdge = edges.some(
        (e) =>
          (String(e.source) === sId && String(e.target) === tId) ||
          (String(e.source) === tId && String(e.target) === sId)
      )

      if (hasDuplicateEdge) {
        const srcRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card
        const tgtRef = (targetNode?.data as SimpleGraphNodeData)?.refText || T.flow.relationGraph.card
        setAlertMsg(T.flow.relationGraph.alertDuplicate(srcRef, tgtRef))
        return
      }

      // Ref: CR-131 穿透其他卡片不再否決建立關聯（排版問題非合法性問題）

      if (connection.source && connection.target) {
        const sHandle = connection.sourceHandle ?? undefined
        const tHandle = connection.targetHandle ?? undefined

        try {
          const key = `pmflow_simple_graph_edge_handles_${projectId}`
          const savedStr = localStorage.getItem(key)
          const handleMap = savedStr ? JSON.parse(savedStr) : {}
          const edgeKey = `${connection.source}_${connection.target}`
          handleMap[edgeKey] = { sourceHandle: sHandle, targetHandle: tHandle }
          localStorage.setItem(key, JSON.stringify(handleMap))
        } catch (e) {
          console.error(e)
        }

        Api.addLink(connection.source, { targetId: connection.target, linkType: 'FS' })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
            queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
            queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
            if (projectId) Api.graph(projectId).then((res) => {
              if (res.edges) {
                let savedMap: Record<string, { sourceHandle?: string; targetHandle?: string }> = {}
                try {
                  const savedStr = localStorage.getItem(`pmflow_simple_graph_edge_handles_${projectId}`)
                  if (savedStr) savedMap = JSON.parse(savedStr)
                } catch {}

                setEdges(res.edges.map((e) => {
                  const edgeKey = `${e.sourceId}_${e.targetId}`
                  const hData = savedMap[edgeKey] || savedMap[e.id]
                  const sH = hData?.sourceHandle
                  const tH = hData?.targetHandle
                  const { style, markerEnd } = getEdgeStyleAndMarker(sH)
                  return {
                    id: e.id,
                    source: e.sourceId,
                    target: e.targetId,
                    sourceHandle: sH,
                    targetHandle: tH,
                    type: 'orthogonal',
                    animated: true,
                    style,
                    markerEnd,
                  }
                }))
              }
            })
          })
          .catch((err) => console.error('Failed to add link in DB:', err))
      }

      const { style, markerEnd } = getEdgeStyleAndMarker(connection.sourceHandle)
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'orthogonal',
            animated: true,
            style,
            markerEnd,
          },
          eds
        )
      )
    },
    [nodes, edges, projectId]
  )

  const onNodeDragStart = useCallback((_: unknown, node: Node) => {
    if (isAnnotationId(node.id)) return // Ref: CR-144
    isDraggingRef.current = true
    dragStartPosMap.current[node.id] = { ...node.position }
  }, [])

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
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
        const isMovingOut = currentParentId && (!targetBox || targetBox.id !== currentParentId)

        if (isMovingOut) {
          const hasEdges = edges.some((e) => e.source === node.id || e.target === node.id)
          if (hasEdges) {
            setAlertMsg(T.flow.relationGraph.alertMoveOutHasEdges(cardRef))
            addLog('move_out', T.flow.relationGraph.log.moveOutFailed(cardRef))
            const startPos = dragStartPosMap.current[node.id]
            return currentNodes.map((n) =>
              n.id === node.id
                ? { ...n, parentId: currentParentId, position: startPos || n.position }
                : n
            )
          }
        }

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
          shrinkBoxAfterRemoval(currentParentId, node.id) // Ref: CR-136
          // 移出收納盒：離開巢狀結構
          addLog('move_out', T.flow.relationGraph.log.moveOut(nodeTypeStr, cardRef, Math.round(cardAbsPos.x), Math.round(cardAbsPos.y)))
          setDragged((prev) => ({
            ...prev,
            [node.id]: cardAbsPos,
          }))

          if (projectId) {
            queryClient.setQueryData(['tasks', projectId], (oldData: { tasks: Task[] } | undefined) => {
              if (!oldData || !Array.isArray(oldData.tasks)) return oldData
              return {
                ...oldData,
                tasks: oldData.tasks.map((t) => (t.id === node.id ? { ...t, parentId: null } : t)),
              }
            })

            Api.moveTask(node.id, { parentId: null }).catch((err: unknown) =>
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
            queryClient.setQueryData(['tasks', projectId], (oldData: { tasks: Task[] } | undefined) => {
              if (!oldData || !Array.isArray(oldData.tasks)) return oldData
              return {
                ...oldData,
                tasks: oldData.tasks.map((t) => (t.id === node.id ? { ...t, parentId: targetBox!.id } : t)),
              }
            })

            Api.moveTask(node.id, { parentId: targetBox!.id }).catch((err: unknown) =>
              console.error('Failed to moveTask in DB:', err)
            )
          }

          const nodeBoxDims = isBoxNode ? computeBoxDimensions(node.id, currentNodes, resized[node.id]?.width, resized[node.id]?.height) : undefined
          const nodeBoxW = nodeBoxDims ? nodeBoxDims.width : Number(node.style?.width ?? node.width ?? (isBoxNode ? 340 : 256))
          const nodeBoxH = nodeBoxDims ? nodeBoxDims.height : Number(node.style?.height ?? node.height ?? (isBoxNode ? 260 : 72))

          const updatedMap = new Map(currentNodes.map((n) => [n.id, n]))
          const movedNode = updatedMap.get(node.id)
          if (movedNode) {
            updatedMap.set(node.id, {
              ...movedNode,
              parentId: targetBox!.id,
              position: targetSlotPos,
              style: { width: nodeBoxW, height: nodeBoxH },
              width: nodeBoxW,
              height: nodeBoxH,
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
      if (nodes.length === 0 || !viewport || typeof viewport.zoom !== 'number' || viewport.zoom < 0.1) {
        return
      }
      try {
        localStorage.setItem(STORAGE_KEY_VIEWPORT, JSON.stringify(viewport))
      } catch {
        // ignore
      }
    },
    [nodes.length]
  )

  const nodesWithHandlers = useMemo(() => {
    return orderParentNodesFirst(
      nodes.map((node) => {
        const isSelected = activeSelectedId === node.id
        const isRelated = relatedSet ? relatedSet.has(node.id) : true
        const nodeBlockedBy = blockedByMap.get(node.id)
        const isBox = (node.data as SimpleGraphNodeData)?.mode === 'box'
        const childBlockedCount = isBox
          ? (tasks ?? []).filter((k) => k.parentId === node.id && (blockedByMap.get(k.id)?.length ?? 0) > 0).length
          : 0

        return {
          ...node,
          draggable: true,
          selectable: true,
          zIndex: isSelected ? 30 : isRelated ? 15 : node.parentId ? 10 : isBox ? 1 : 5,
          extent: [[-100000, -100000], [100000, 100000]],
          data: {
            ...node.data,
            isSelected,
            isRelated,
            hasSelectionActive: !!relatedSet,
            blockedBy: nodeBlockedBy,
            blockedCount: (nodeBlockedBy?.length ? 1 : 0) + childBlockedCount,
            onToggleMode: handleToggleMode,
          },
        }
      })
    )
  }, [nodes, activeSelectedId, relatedSet, blockedByMap, handleToggleMode, tasks])

  // Ref: CR-144 標示框墊最底、任務節點居中、文字註記疊最上；三者不混進 nodes 狀態
  const renderedNodes = useMemo(() => {
    const frames = annotationNodes.filter((n) => n.type === 'annotationFrame')
    const texts = annotationNodes.filter((n) => n.type === 'annotationText')
    return [...frames, ...nodesWithHandlers, ...texts]
  }, [annotationNodes, nodesWithHandlers])

  const styledEdges = useMemo(() => {
    return edges.map((e) => {
      const edgeStyleAndMarker = getEdgeStyleAndMarker(e.sourceHandle)
      return {
        ...e,
        ...edgeStyleAndMarker,
        // Ref: CR-139 全檔統一直角折線 + 可拖曳折點
        type: 'orthogonal',
        data: {
          ...(e.data ?? {}),
          waypoint: waypoints[`${e.source}_${e.target}`] ?? null,
          onWaypointChange: handleWaypointChange,
          onWaypointReset: handleWaypointReset,
        },
        animated: false,
        style: {
          ...edgeStyleAndMarker.style,
          ...e.style,
          stroke: edgeStyleAndMarker.style.stroke,
          strokeDasharray: edgeStyleAndMarker.style.strokeDasharray,
          strokeWidth: 2,
          opacity: 1,
        },
        markerEnd: edgeStyleAndMarker.markerEnd,
      }
    })
  }, [edges, waypoints, handleWaypointChange, handleWaypointReset])

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div className="relative flex-1 flex flex-row overflow-hidden">
        <div className="relative flex-1 cursor-move">
          <ReactFlow
            nodes={renderedNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            defaultViewport={savedViewport}
            fitView={!savedViewport}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Step}
            connectionRadius={30}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'orthogonal',
              animated: false,
              style: { strokeWidth: 2, stroke: '#ef4444' },
            }}
            minZoom={0.05}
            maxZoom={2.5}
            zoomOnPinch={true}
            panOnScroll={false}
            preventScrolling={true}
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
              {/* Ref: CR-144 */}
              <ControlButton
                onClick={handleAddTextAnnotation}
                title={ANNOTATION_STRINGS.addTextHint}
                aria-label={ANNOTATION_STRINGS.addText}
              >
                <span className="text-sm select-none">📝</span>
              </ControlButton>
              <ControlButton
                onClick={handleAddAreaFrame}
                title={T.flow.relationGraph.addFrameHint}
                aria-label={ANNOTATION_STRINGS.addFrame}
              >
                <span className="text-sm select-none">🏷️</span>
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
                      <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1 py-0.5 font-semibold text-[10px]">{T.flow.relationGraph.help.blocked}</span>
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

          {/* 右下角 即時 Log 開關按鈕 */}
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
        </div>

        {showLogPanel && (
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
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <span className="text-xl">🗑️</span>
              <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">
                {T.flow.relationGraph.deleteEdgeTitle}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {T.flow.relationGraph.deleteEdgeMessage(confirmDeleteEdge.sourceRef, confirmDeleteEdge.targetRef)}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
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
                  Api.deleteLink(confirmDeleteEdge.edgeId)
                    .then(() => {
                      setEdges((eds) => eds.filter((e) => e.id !== confirmDeleteEdge.edgeId))
                      if (projectId) queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
                    })
                    .catch((err) => console.error('Failed to delete link:', err))
                  setConfirmDeleteEdge(null)
                }}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer shadow-sm"
              >
                {T.flow.shared.confirmDelete}
              </button>
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
    </div>
  )
}

export default function SimpleGraph(props: SimpleGraphProps) {
  return (
    <ReactFlowProvider>
      <SimpleGraphInner {...props} />
    </ReactFlowProvider>
  )
}
