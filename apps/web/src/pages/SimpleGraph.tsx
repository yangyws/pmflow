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
  NodeResizeControl,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeProps,
  type Viewport,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Api, type Task } from '../lib/api'
import { DEFAULT_TYPE_COLORS } from '../components/EpicSidebar'
import { cx, ProblemBadge } from '../components/ui'
import { rollup } from '../lib/rollup'

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
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-sm" title="已完成">
          ✓
        </span>
      ) : progress === 0 ? (
        <span className="text-[10px] tabular-nums font-normal text-slate-400 dark:text-slate-500" title="未開始 (0%)">
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
  let maxRight = 340
  let maxBottom = 280

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

  const reqW = Math.max(340, Math.ceil(maxRight))
  const reqH = Math.max(280, Math.ceil(maxBottom))

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
      style={isBox ? { width: boxW, height: boxH } : { width: 256, height: 72 }}
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none pointer-events-auto"
    >
      {/* 接點 (Handles) - 4 個邊各保留 1 個中央精準接點，帶 nodrag 避免拉線時誤觸卡片拖曳 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-out"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right-in"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
      />

      <Handle
        type="target"
        position={Position.Top}
        id="top-in"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-out"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-in"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-out"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
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
                    title="【收納盒】點擊轉換回卡片"
                  >
                    📦 收納盒
                  </button>
                  <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 pointer-events-none select-none">
                    {data.refText || 'MRG-BOX'}
                  </span>
                  <span
                    className="shrink-0 whitespace-nowrap rounded px-1 text-[10px] border pointer-events-none select-none font-medium"
                    style={{
                      backgroundColor: `${data.typeColor || '#3178c6'}18`,
                      color: data.typeColor || '#3178c6',
                      borderColor: `${data.typeColor || '#3178c6'}40`,
                    }}
                  >
                    {data.typeName || '任務單'}
                  </span>
                  {typeof data.childCount === 'number' && data.childCount > 0 && (
                    <span className="shrink-0 whitespace-nowrap rounded px-1 text-[10px] bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 font-medium pointer-events-none select-none">
                      內含 {data.childCount} 張
                    </span>
                  )}
                  <ProblemBadge problem={data.problem} count={data.problemCount} isBox={true} />
                  {((typeof data.blockedCount === 'number' && data.blockedCount > 0) || (data.blockedBy && data.blockedBy.length > 0)) && (
                    <span
                      title={`卡住：${data.blockedBy?.join('、') || '盒內任務受阻'}`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 pointer-events-none select-none"
                    >
                      <span aria-hidden>⛔</span>卡住 {typeof data.blockedCount === 'number' && data.blockedCount > 0 ? data.blockedCount : ''}
                    </span>
                  )}
                  {data.isParallel && (
                    <span
                      title={`並行：與 ${data.parallelPeers?.join('、')} 匯合`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 pointer-events-none select-none"
                    >
                      ⚡並行
                    </span>
                  )}
                  {((typeof data.overdueCount === 'number' && data.overdueCount > 0) || data.isOverdue) && (
                    <span
                      title={`已逾期（應到日期：${data.dueDate || ''}）`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 pointer-events-none select-none"
                    >
                      ⏰ 逾期 {typeof data.overdueCount === 'number' && data.overdueCount > 0 ? data.overdueCount : ''}
                    </span>
                  )}
                  {((typeof data.inquiryCount === 'number' && data.inquiryCount > 0) || data.inquiryState === 'AWAITING' || data.inquiryState === 'PARTIAL' || data.inquiryState === 'OVERDUE') && (
                    <span
                      title="對外詢問待回覆"
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 pointer-events-none select-none"
                    >
                      ❓ 待回覆 {typeof data.inquiryCount === 'number' && data.inquiryCount > 0 ? data.inquiryCount : ''}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400/90 dark:text-slate-500/90 font-normal shrink-0 select-none pointer-events-none pl-1">
                  (移入卡片自動擴大容量)
                </span>
              </div>
              <div className="font-semibold text-slate-800 text-xs dark:text-slate-100 pointer-events-none select-none break-words w-full leading-snug" title={data.label}>
                {data.label || '無標題收納盒'}
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
              title="按住拖曳調整收納盒尺寸"
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
            <div className="flex items-center gap-1.5 w-max min-w-full whitespace-nowrap overflow-visible">
              {data.taskType !== 'BUG' && (
                <button
                  type="button"
                  onClick={handleToggle}
                  className="nodrag shrink-0 w-[58px] inline-flex items-center justify-center rounded py-0.5 text-[9px] font-medium transition-colors cursor-pointer border text-center select-none bg-white text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  title="【卡片】點擊轉換為收納盒"
                >
                  📄 卡片
                </button>
              )}
              <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 pointer-events-none select-none">
                {data.refText || 'MRG-1'}
              </span>
              <span
                className="shrink-0 whitespace-nowrap rounded px-1 text-[10px] border pointer-events-none select-none font-medium"
                style={{
                  backgroundColor: `${data.typeColor || '#3178c6'}18`,
                  color: data.typeColor || '#3178c6',
                  borderColor: `${data.typeColor || '#3178c6'}40`,
                }}
              >
                {data.typeName || '任務單'}
              </span>
              <ProblemBadge problem={data.problem} />
              {data.blockedBy && data.blockedBy.length > 0 && (
                <span
                  title={`卡住：要等 ${data.blockedBy.join('、')}`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 pointer-events-none select-none"
                >
                  <span aria-hidden>⛔</span>卡住
                </span>
              )}
              {data.isParallel && (
                <span
                  title={`並行：與 ${data.parallelPeers?.join('、')} 匯合`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 pointer-events-none select-none"
                >
                  ⚡並行
                </span>
              )}
              {data.isOverdue && (
                <span
                  title={`已逾期（應到日期：${data.dueDate || ''}）`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 pointer-events-none select-none"
                >
                  ⏰ 逾期
                </span>
              )}
              {(data.inquiryState === 'AWAITING' || data.inquiryState === 'PARTIAL' || data.inquiryState === 'OVERDUE') && (
                <span
                  title="對外詢問待回覆"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-medium text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 pointer-events-none select-none"
                >
                  ❓ 待回覆
                </span>
              )}
            </div>
            <div className="font-semibold text-slate-800 text-xs dark:text-slate-100 pointer-events-none select-none break-words w-full leading-snug" title={data.label}>
              {data.label || '無標題任務'}
            </div>
            <NodeProgressBar progress={data.progress ?? 0} />
          </div>
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  simpleNode: SimpleNodeView,
}

export interface SimpleGraphProps {
  projectId?: string
  tasks?: Task[]
  onOpenTask?: (taskId: string) => void
  focusedTaskId?: string | null
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

function SimpleGraphInner({ projectId, tasks, onOpenTask, focusedTaskId, onSelectTask }: SimpleGraphProps) {
  const { fitView } = useReactFlow()
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
    if (!typeKey) return '任務單'
    const custom = project?.types?.find((p) => p.key === typeKey)?.name
    const DEFAULT_MAP: Record<string, string> = {
      TASK: '任務單',
      BUG: '問題單',
    }
    return custom || DEFAULT_MAP[typeKey] || (typeKey === 'BUG' ? '問題單' : '任務單')
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

  const parallelMap = useMemo(() => {
    const map = new Map<string, { isParallel: boolean; peers: string[] }>()
    if (!edges || !tasks) return map

    const targetMap = new Map<string, Array<{ id: string; ref: string }>>()
    edges.forEach((e) => {
      const sId = String(e.source)
      const tId = String(e.target)
      const sTask = tasks.find((t) => t.id === sId)
      if (!sTask) return
      const sRef = sTask.ref || (sTask.number ? `MRG-${sTask.number}` : (sTask.type === 'BUG' ? '問題單' : '任務單'))
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
        const srcRef = srcTask.ref || (srcTask.number ? `MRG-${srcTask.number}` : '上游任務')
        const list = map.get(dstTask.id) || []
        if (!list.includes(srcRef)) {
          list.push(srcRef)
        }
        map.set(dstTask.id, list)
      }
    }

    return map
  }, [tasks, edges, project?.statuses])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      onSelectTask?.(node.id)
    },
    [onSelectTask]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    onSelectTask?.('')
  }, [onSelectTask])
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [confirmDeleteEdge, setConfirmDeleteEdge] = useState<ConfirmDeleteEdgeState | null>(null)
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

  const handleToggleMode = useCallback(
    (nodeId: string) => {
      setToggledModes((prev) => {
        const currentNodes = nodesRef.current
        const targetNode = currentNodes.find((n) => n.id === nodeId)
        const nodeData = targetNode?.data as SimpleGraphNodeData
        if (nodeData?.taskType === 'BUG') {
          return prev
        }
        const currentMode = prev[nodeId] ?? (targetNode?.data as SimpleGraphNodeData)?.mode ?? 'card'
        const nextMode: NodeMode = currentMode === 'box' ? 'card' : 'box'
        const refText = (targetNode?.data as SimpleGraphNodeData)?.refText || '卡片'
        addLog('toggle', `${refText} 模式切換為 [${nextMode === 'box' ? '收納盒' : '卡片'}]`)

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
    [addLog]
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
              type: 'smoothstep',
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
          const defaultSlotPos = { x: 24 + cCol * 280, y: 85 + cRow * 110 }
          const rawPos = draggedMap[k.id]
          const isValidChildPos =
            rawPos &&
            typeof rawPos.x === 'number' &&
            typeof rawPos.y === 'number' &&
            rawPos.x >= 10 &&
            rawPos.y >= 70
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
          const defaultSlotPos = { x: 24 + cCol * 280, y: 85 + cRow * 110 }
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
              rawPos.y >= 70 &&
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
        const cardPos = draggedMap[t.id] ?? (!parentBoxId ? { x: rootX, y: rootY } : { x: 24, y: 85 })
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

  const onNodesChange = useCallback((changes: NodeChange[]) => {
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
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const targetNode = nodes.find((n) => n.id === edge.target)

      const sourceRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || '卡片'
      const targetRef = (targetNode?.data as SimpleGraphNodeData)?.refText || '卡片'

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

      if (
        (sourceNode?.data as SimpleGraphNodeData)?.taskType === 'BUG' ||
        (targetNode?.data as SimpleGraphNodeData)?.taskType === 'BUG'
      ) {
        setAlertMsg('問題單無法建立前後相依連線。')
        return
      }

      if (
        (sourceParent && sourceParent !== targetParent) ||
        (targetParent && targetParent !== sourceParent)
      ) {
        const srcRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || '卡片'
        const tgtRef = (targetNode?.data as SimpleGraphNodeData)?.refText || '卡片'
        setAlertMsg(
          `收納盒內部的卡片 (${srcRef} / ${tgtRef}) 無法與外部直接建立關聯。請將關聯連線接至收納盒本體！`
        )
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
        const srcRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || '卡片'
        const tgtRef = (targetNode?.data as SimpleGraphNodeData)?.refText || '卡片'
        setAlertMsg(
          `【${srcRef}】與【${tgtRef}】之間已存在關聯線，任何第二個接點皆不可重複相連！`
        )
        return
      }

      // 檢查關聯線是否會穿透其他卡片或收納盒
      const srcAbs = getNodeAbsPos(connection.source, nodes)
      const tgtAbs = getNodeAbsPos(connection.target, nodes)

      const isSrcBox = (sourceNode?.data as SimpleGraphNodeData)?.mode === 'box'
      const isTgtBox = (targetNode?.data as SimpleGraphNodeData)?.mode === 'box'
      const srcW = Number(sourceNode?.style?.width ?? sourceNode?.width ?? (isSrcBox ? 340 : 256))
      const srcH = Number(sourceNode?.style?.height ?? sourceNode?.height ?? (isSrcBox ? 280 : 90))
      const tgtW = Number(targetNode?.style?.width ?? targetNode?.width ?? (isTgtBox ? 340 : 256))
      const tgtH = Number(targetNode?.style?.height ?? targetNode?.height ?? (isTgtBox ? 280 : 90))

      const sHandleStr = connection.sourceHandle ?? ''
      const tHandleStr = connection.targetHandle ?? ''

      const getPoint = (abs: { x: number; y: number }, w: number, h: number, handleId: string) => {
        if (handleId.includes('top')) return { x: abs.x + w / 2, y: abs.y }
        if (handleId.includes('bottom')) return { x: abs.x + w / 2, y: abs.y + h }
        if (handleId.includes('left')) return { x: abs.x, y: abs.y + h / 2 }
        if (handleId.includes('right')) return { x: abs.x + w, y: abs.y + h / 2 }
        return { x: abs.x + w / 2, y: abs.y + h / 2 }
      }

      const p1 = getPoint(srcAbs, srcW, srcH, sHandleStr)
      const p2 = getPoint(tgtAbs, tgtW, tgtH, tHandleStr)

      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2

      const segments = [
        { x1: p1.x, y1: p1.y, x2: midX, y2: p1.y },
        { x1: midX, y1: p1.y, x2: midX, y2: p2.y },
        { x1: midX, y1: p2.y, x2: p2.x, y2: p2.y },
        { x1: p1.x, y1: p1.y, x2: p1.x, y2: midY },
        { x1: p1.x, y1: midY, x2: p2.x, y2: midY },
        { x1: p2.x, y1: midY, x2: p2.x, y2: p2.y },
      ]

      for (const n of nodes) {
        if (n.id === connection.source || n.id === connection.target) continue
        if (n.id === sourceParent || n.id === targetParent) continue
        if (isAncestorNode(connection.source, n.id, nodes) || isAncestorNode(connection.target, n.id, nodes)) continue

        const nAbs = getNodeAbsPos(n.id, nodes)
        const isNBox = (n.data as SimpleGraphNodeData)?.mode === 'box'
        const nW = Number(n.style?.width ?? n.width ?? (isNBox ? 340 : 256))
        const nH = Number(n.style?.height ?? n.height ?? (isNBox ? 280 : 90))

        const rLeft = nAbs.x + 8
        const rTop = nAbs.y + 8
        const rRight = nAbs.x + nW - 8
        const rBottom = nAbs.y + nH - 8

        for (const seg of segments) {
          const isHoriz = Math.abs(seg.y1 - seg.y2) < 0.1
          const isVert = Math.abs(seg.x1 - seg.x2) < 0.1

          if (isHoriz) {
            const y = seg.y1
            const minX = Math.min(seg.x1, seg.x2)
            const maxX = Math.max(seg.x1, seg.x2)
            if (y > rTop && y < rBottom && maxX > rLeft && minX < rRight) {
              const cRef = (n.data as SimpleGraphNodeData)?.refText || '卡片/收納盒'
              const srcRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || '卡片'
              const tgtRef = (targetNode?.data as SimpleGraphNodeData)?.refText || '卡片'
              setAlertMsg(`【${srcRef}】與【${tgtRef}】之間的關聯線會穿透【${cRef}】，無法建立關聯！請調整卡片位置。`)
              return
            }
          } else if (isVert) {
            const x = seg.x1
            const minY = Math.min(seg.y1, seg.y2)
            const maxY = Math.max(seg.y1, seg.y2)
            if (x > rLeft && x < rRight && maxY > rTop && minY < rBottom) {
              const cRef = (n.data as SimpleGraphNodeData)?.refText || '卡片/收納盒'
              const srcRef = (sourceNode?.data as SimpleGraphNodeData)?.refText || '卡片'
              const tgtRef = (targetNode?.data as SimpleGraphNodeData)?.refText || '卡片'
              setAlertMsg(`【${srcRef}】與【${tgtRef}】之間的關聯線會穿透【${cRef}】，無法建立關聯！請調整卡片位置。`)
              return
            }
          }
        }
      }

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
                    type: 'smoothstep',
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
            type: 'smoothstep',
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
    dragStartPosMap.current[node.id] = { ...node.position }
  }, [])

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const isBoxNode = (node.data as SimpleGraphNodeData)?.mode === 'box'
      const cardRef = (node.data as SimpleGraphNodeData)?.refText || '卡片'

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
            setAlertMsg(
              `卡片 (${cardRef}) 在收納盒內尚存在關聯線，無法移出收納盒。請先刪除關聯線後再移動！`
            )
            addLog('move_out', `卡片 (${cardRef}) 移出失敗：尚存在關聯線`)
            const startPos = dragStartPosMap.current[node.id]
            return currentNodes.map((n) =>
              n.id === node.id
                ? { ...n, parentId: currentParentId, position: startPos || n.position }
                : n
            )
          }
        }

        const isBoxNode = (node.data as SimpleGraphNodeData)?.mode === 'box'
        const nodeTypeStr = isBoxNode ? '收納盒' : '卡片'
        let nextNodes = currentNodes

        if (!targetBox && currentParentId) {
          // 移出收納盒：離開巢狀結構
          addLog('move_out', `${nodeTypeStr} (${cardRef}) 移出收納盒，離開巢狀結構 | 畫布大座標 (x: ${Math.round(cardAbsPos.x)}, y: ${Math.round(cardAbsPos.y)})`)
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
          // 移入收納盒：禁止帶有任何連線
          const targetBoxRef = (targetBox.data as SimpleGraphNodeData)?.refText || '收納盒'
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
            setAlertMsg(
              `${nodeTypeStr} (${cardRef}) 尚存在關聯線，無法移入收納盒 (${targetBoxRef})。請先刪除關聯線後再移入！`
            )
            addLog('move_in', `${nodeTypeStr} (${cardRef}) 移入 (${targetBoxRef}) 失敗：尚存在關聯線`)
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
            targetKids.map((k) => `${Math.round((k.position.x - 24) / (isBoxNode ? 360 : 280))},${Math.round((k.position.y - 85) / 110)}`)
          )

          let targetSlotPos = { x: 24, y: 70 }
          if (isBoxNode) {
            let maxRightX = 0
            targetKids.forEach((k) => {
              const rightX = (k.position?.x ?? 24) + Number(k.width ?? (k as any).measured?.width ?? 256)
              if (rightX > maxRightX) maxRightX = rightX
            })
            targetSlotPos = { x: Math.max(312, maxRightX + 24), y: 70 }
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
            targetSlotPos = { x: 24 + tCol * 280, y: 85 + tRow * 110 }
          }
          const targetBoxAbsPos = getAbsPos(targetBox!.id)
          const realAbsX = Math.round(targetBoxAbsPos.x + targetSlotPos.x)
          const realAbsY = Math.round(targetBoxAbsPos.y + targetSlotPos.y)
          addLog('move_in', `${nodeTypeStr} (${cardRef}) 移入 (${targetBoxRef})，進入巢狀結構 | 畫布大座標 (x: ${realAbsX}, y: ${realAbsY})`)

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
            addLog('move', `盒內卡片 (${cardRef}) 移動，槽位 (x: ${Math.round(node.position.x)}, y: ${Math.round(node.position.y)}) | 畫布大座標 (x: ${Math.round(cardAbsPos.x)}, y: ${Math.round(cardAbsPos.y)})`)
          } else {
            addLog('move', `節點 (${cardRef}) 移動至 (x: ${Math.round(node.position.x)}, y: ${Math.round(node.position.y)})`)
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
        return {
          ...node,
          draggable: true,
          selectable: true,
          zIndex: isSelected ? 30 : isRelated ? 15 : node.parentId ? 10 : (node.data as SimpleGraphNodeData)?.mode === 'box' ? 1 : 5,
          extent: [[-100000, -100000], [100000, 100000]],
          data: {
            ...node.data,
            isSelected,
            isRelated,
            hasSelectionActive: !!relatedSet,
            blockedBy: blockedByMap.get(node.id),
            onToggleMode: handleToggleMode,
          },
        }
      })
    )
  }, [nodes, activeSelectedId, relatedSet, blockedByMap, handleToggleMode])

  const styledEdges = useMemo(() => {
    return edges.map((e) => {
      const edgeStyleAndMarker = getEdgeStyleAndMarker(e.sourceHandle)
      return {
        ...e,
        ...edgeStyleAndMarker,
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
  }, [edges])

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div className="relative flex-1 flex flex-row overflow-hidden">
        <div className="relative flex-1 cursor-move">
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={(_, node) => onOpenTask?.(node.id)}
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
            connectionMode={ConnectionMode.Loose}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: false,
              style: { strokeWidth: 2, stroke: '#ef4444' },
            }}
            zoomOnPinch={true}
            panOnScroll={false}
            preventScrolling={true}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls
              showFitView={true}
              showInteractive={true}
              className="!bg-white dark:!bg-slate-800 !border !border-slate-300 dark:!border-slate-600 !shadow-md !rounded-lg overflow-hidden [&_button]:!bg-white dark:[&_button]:!bg-slate-800 [&_button]:!text-slate-800 dark:[&_button]:!text-slate-100 [&_button]:!border-b [&_button]:!border-slate-200 dark:[&_button]:!border-slate-700 hover:[&_button]:!bg-slate-100 dark:hover:[&_button]:!bg-slate-700 [&_button_svg]:!fill-slate-800 dark:[&_button_svg]:!fill-slate-100"
            >
              <ControlButton
                onClick={() => setShowHelpTooltip((prev) => !prev)}
                onMouseEnter={() => setShowHelpTooltip(true)}
                onMouseLeave={() => setShowHelpTooltip(false)}
                title="圖示說明 (警示圖示)"
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
              className="absolute left-14 bottom-3 z-30 w-72 rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in slide-in-from-left-2 duration-150 pointer-events-auto"
            >
              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 mb-2">
                <span className="text-base">⚑</span>
                <span>警示與線條圖示說明</span>
              </div>
              <div className="space-y-1.5 leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  <span className="font-semibold text-fuchsia-600 dark:text-fuchsia-400">⚑ 問題標記：</span>
                  當事件/任務包含尚未解決的「問題說明」時，會在 MRG 與標題右側顯示粉紫色的 ⚑ 問題警示徽章。
                </p>
                <p>
                  <span className="font-semibold text-red-500">🔴 紅色實線：</span>
                  由卡片或收納盒的左右接點出發的關聯線。
                </p>
                <p>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">🟣 紫色虛線：</span>
                  由卡片或收納盒的上下接點出發的關聯線。
                </p>
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
              title="即時 Log 視窗開關"
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
                <span>動作與座標 Log 視窗</span>
                <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[10px] text-indigo-300 border border-indigo-500/30">
                  {logs.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="清空 Log 紀錄"
                >
                  清空
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogPanel(false)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="關閉視窗"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 font-mono text-[11px] leading-relaxed select-text" ref={logContainerRef}>
              {logs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  尚未有移動或切換紀錄<br />在畫布上拖曳卡片時將在此即時顯示
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
                        {log.type === 'move_in' ? '📥 移入' :
                         log.type === 'move_out' ? '📤 移出' :
                         log.type === 'toggle' ? '📦 模式' :
                         log.type === 'resize' ? '📐 縮放' : '📍 移動'}
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

      {confirmDeleteEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <span className="text-xl">🗑️</span>
              <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">
                刪除關聯線
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              是否刪除 {confirmDeleteEdge.sourceRef} 與 {confirmDeleteEdge.targetRef} 的關聯？
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteEdge(null)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                取消
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
                確定刪除
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
                關聯建立受限
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
                我知道了
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
