import { useState, useCallback, useRef, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import '@xyflow/react/dist/style.css'
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
  BaseEdge,
  EdgeLabelRenderer,
  ConnectionLineType,
  type Node,
  type Edge,
  type NodeChange,
  type NodeDimensionChange,
  type EdgeChange,
  type Connection,
  type NodeProps,
  type EdgeProps,
  type Viewport,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { Api } from '../lib/api'
import { cx } from '../components/ui'
import { CanvasPermissionModal } from '../components/CanvasPermissionModal'
import { T } from '../strings' // Ref: CR-146
import { getObstaclesFromNodes, buildOrthogonalPath, type ObstacleRect } from '../lib/orthogonalRouting'

export interface SystemFlowProps {
  projectId?: string
}

// Ref: CR-140
export type FlowNodeType = 'step' | 'box' | 'text' | 'frame'

export interface FlowNodeData extends Record<string, unknown> {
  label: string
  title?: string
  desc?: string
  subtitle?: string
  role?: string
  icon?: string
  color: string
  mode: FlowNodeType
  isSelected?: boolean
  onEdit?: (nodeId: string) => void
  onDelete?: (nodeId: string) => void
}

// Ref: CR-140
export interface FlowEdgeData extends Record<string, unknown> {
  text?: string
  waypoint?: { x: number; y: number } | null
  obstacles?: ObstacleRect[]
  onSaveText?: (edgeId: string, text: string) => void
  onWaypointChange?: (edgeId: string, point: { x: number; y: number }) => void
  onWaypointReset?: (edgeId: string) => void
  // Ref: CR-148
  onWaypointDragStart?: () => void
  onWaypointDragEnd?: () => void
  onEdgeClick?: () => void
}

// Ref: CR-146
const COLOR_OPTIONS = T.flow.systemFlow.colorOptions

// 連線自訂顏色選項
const EDGE_COLOR_OPTIONS = [
  { name: '靛青藍', color: '#4f46e5' },
  { name: '經典藍', color: '#3b82f6' },
  { name: '翠玉綠', color: '#10b981' },
  { name: '優雅紫', color: '#8b5cf6' },
  { name: '活力橘', color: '#f97316' },
  { name: '熱情紅', color: '#ef4444' },
  { name: '深沉灰', color: '#64748b' },
  { name: '晴空青', color: '#06b6d4' },
  { name: '玫瑰粉', color: '#ec4899' },
]

function getEdgeStyleAndMarker(_sourceHandle?: string | null, customColor?: string) {
  const strokeColor = customColor || '#4f46e5'
  return {
    animated: false,
    style: {
      strokeWidth: 2,
      stroke: strokeColor,
      strokeDasharray: 'none',
      opacity: 1,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: strokeColor,
      width: 14,
      height: 14,
    },
  }
}

// Ref: CR-140 拖折點時把緊接著那次 click 吞掉 (合成事件會沿元件樹冒泡回連線本身)
const edgeDragGuard: { active: boolean; timer: ReturnType<typeof setTimeout> | null } = {
  active: false,
  timer: null,
}

function armEdgeDragGuard() {
  edgeDragGuard.active = true
  if (edgeDragGuard.timer) clearTimeout(edgeDragGuard.timer)
  edgeDragGuard.timer = setTimeout(() => {
    edgeDragGuard.active = false
    edgeDragGuard.timer = null
  }, 400)
}

function consumeEdgeDragGuard(): boolean {
  if (!edgeDragGuard.active) return false
  edgeDragGuard.active = false
  if (edgeDragGuard.timer) {
    clearTimeout(edgeDragGuard.timer)
    edgeDragGuard.timer = null
  }
  return true
}


// 確保區域標示框墊底、模組泳道盒置底、父節點優先於子卡片、文字註記疊頂
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
  return [...nodes].sort((a, b) => {
    const isFrameA = ((a.data as FlowNodeData)?.mode || a.type) === 'frame'
    const isFrameB = ((b.data as FlowNodeData)?.mode || b.type) === 'frame'
    if (isFrameA && !isFrameB) return -1
    if (!isFrameA && isFrameB) return 1

    const isBoxA = ((a.data as FlowNodeData)?.mode || a.type) === 'box'
    const isBoxB = ((b.data as FlowNodeData)?.mode || b.type) === 'box'
    if (isBoxA && !isBoxB) return -1
    if (!isBoxA && isBoxB) return 1

    const isTextA = a.type === 'text'
    const isTextB = b.type === 'text'
    if (isTextA && !isTextB) return 1
    if (!isTextA && isTextB) return -1

    return getDepth(a.id) - getDepth(b.id)
  })
}

// 四向全功能雙向接點元件 (每個方向同時掛載 in 與 out Handles，支援任意方向 16 種組合起拉與連入)
function FourWayHandles({
  isConnectable = true,
  color = '#4f46e5',
  sizeClass = '!w-4 !h-4',
  extraHandleClass = '',
}: {
  isConnectable?: boolean
  color?: string
  sizeClass?: string
  extraHandleClass?: string
}) {
  if (!isConnectable) return null

  const commonClass = cx(
    sizeClass,
    '!border-2 !border-white dark:!border-slate-900 !z-50 !cursor-crosshair cursor-crosshair nodrag pointer-events-auto after:absolute after:content-[\'\'] after:-inset-3 after:rounded-full after:cursor-crosshair',
    extraHandleClass
  )

  return (
    <>
      {/* Left Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        style={{ top: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-out"
        style={{ top: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />

      {/* Right Handles */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-in"
        style={{ top: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        style={{ top: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />

      {/* Top Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-in"
        style={{ left: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-out"
        style={{ left: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />

      {/* Bottom Handles */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-in"
        style={{ left: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-out"
        style={{ left: '50%', backgroundColor: color }}
        className={commonClass}
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={true}
      />
    </>
  )
}

// 系統流程圖：模組/收納盒節點
function FlowBoxNode({ id, data, isConnectable }: NodeProps) {
  const nodeData = data as FlowNodeData
  const title = (nodeData.label || nodeData.title || T.flow.systemFlow.boxFallback) as string
  const desc = (nodeData.desc || nodeData.subtitle) as string | undefined
  const icon = (nodeData.icon || '📦') as string
  return (
    <div className="relative w-full h-full group">
      <div
        className={cx(
          'relative w-full h-full min-w-[320px] min-h-[220px] rounded-xl border bg-indigo-50/30 dark:bg-indigo-950/20 backdrop-blur-xs shadow-sm hover:shadow-md transition-all duration-150 flex flex-col justify-between cursor-grab active:cursor-grabbing overflow-hidden',
          nodeData.isSelected ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-xl' : 'border-indigo-300 dark:border-indigo-800'
        )}
      >
        <div>
          {/* 頂部裝飾條 */}
          <div className="h-1.5 rounded-t-xl" style={{ backgroundColor: nodeData.color || '#6366f1' }} />
          {/* 標題欄 */}
          <div className="px-3.5 py-2 border-b border-indigo-200/60 dark:border-indigo-900/60 bg-white/80 dark:bg-slate-900/80 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{icon}</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                  {title}
                </span>
              </div>
              {/* Ref: CR-140 */}
              {desc && (
                <p
                  title={desc}
                  className="pl-6 text-xs text-slate-500 dark:text-slate-400 leading-snug line-clamp-2 break-words"
                >
                  {desc}
                </p>
              )}
            </div>

            {nodeData.onEdit && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    nodeData.onEdit?.(id)
                  }}
                  title={T.flow.systemFlow.editBoxTitle}
                  className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    nodeData.onDelete?.(id)
                  }}
                  title={T.flow.systemFlow.deleteBoxTitle}
                  className="p-1 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition cursor-pointer"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 底部邊界縮放控制柄 */}
        {nodeData.onEdit && (
          <NodeResizeControl
            minWidth={320}
            minHeight={220}
            style={{ background: 'transparent', border: 'none' }}
            className="nodrag pointer-events-auto"
          >
            <div
              title="拖曳縮放模組盒大小"
              className="absolute right-1 bottom-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs select-none cursor-se-resize p-1 pointer-events-auto"
            >
              ↘
            </div>
          </NodeResizeControl>
        )}
      </div>

      {/* 四向連接點 (全功能接點：四向皆支援出發與連入) */}
      <FourWayHandles isConnectable={Boolean(nodeData.onEdit)} color="#4f46e5" />
    </div>
  )
}

// 系統流程圖：流程步驟/卡片節點
function FlowStepNode({ id, data, isConnectable }: NodeProps) {
  const nodeData = data as FlowNodeData
  const title = (nodeData.label || nodeData.title || T.flow.systemFlow.stepFallback) as string
  const desc = (nodeData.desc || nodeData.subtitle) as string | undefined
  const icon = (nodeData.icon || '⚡') as string
  const role = nodeData.role as string | undefined

  return (
    <div className="relative group w-full h-full">
      <div
        className={cx(
          'w-full h-full min-w-[240px] max-w-[380px] rounded-xl border bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg transition-all duration-150 select-none cursor-grab active:cursor-grabbing overflow-hidden',
          nodeData.isSelected ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-xl' : 'border-slate-200 dark:border-slate-800'
        )}
      >
        {/* 頂部彩色條 */}
        <div className="h-1.5 rounded-t-xl" style={{ backgroundColor: nodeData.color || '#3b82f6' }} />

        <div className="p-3 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
              <span className="text-base shrink-0">{icon}</span>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 break-words leading-tight">
                {title}
              </span>
              {role && (
                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                  {role}
                </span>
              )}
            </div>

            {nodeData.onEdit && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    nodeData.onEdit?.(id)
                  }}
                  title={T.flow.systemFlow.editNodeTitle}
                  className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    nodeData.onDelete?.(id)
                  }}
                  title={T.flow.systemFlow.deleteNodeTitle}
                  className="p-1 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition cursor-pointer"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>

          {desc && (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
              {desc}
            </p>
          )}
        </div>
      </div>

      {/* 四向連接點 (清晰 4 向接點，支援十字游標與滑鼠直接點擊拉線) */}
      <FourWayHandles isConnectable={isConnectable ?? true} color="#4f46e5" />
    </div>
  )
}

// Ref: CR-140
function FlowTextNode({ id, data, isConnectable }: NodeProps) {
  const nodeData = data as FlowNodeData
  const color = nodeData.color || '#4f46e5'
  return (
    <div className="group relative cursor-grab active:cursor-grabbing select-none">
      <div
        className={cx(
          'max-w-[420px] whitespace-pre-wrap break-words rounded px-1.5 py-1 text-sm font-semibold leading-relaxed',
          !nodeData.color && 'text-slate-700 dark:text-slate-200',
          nodeData.isSelected && 'ring-2 ring-blue-500/50'
        )}
        style={nodeData.color ? { color: nodeData.color } : undefined}
      >
        {nodeData.label || T.flow.shared.annotation.textFallback}
      </div>

      {/* Ref: CR-154 —— 按鈕列擺在文字上緣之外 */}
      {nodeData.onEdit && (
        <div className="absolute bottom-full right-0 mb-1 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              nodeData.onEdit?.(id)
            }}
            title={T.flow.shared.annotation.editText}
            className="cursor-pointer rounded p-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              nodeData.onDelete?.(id)
            }}
            title={T.flow.shared.annotation.deleteText}
            className="cursor-pointer rounded p-0.5 text-[11px] text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            🗑️
          </button>
        </div>
      )}

      {/* 四向連接點 (全功能接點：四向皆支援出發與連入) */}
      <FourWayHandles
        isConnectable={isConnectable ?? true}
        color={color}
        sizeClass="!w-3 !h-3"
        extraHandleClass="opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  )
}

// Ref: CR-140 & CR-154 區域標示框：背景穿透點擊，標頭/縮放控制/接點保留操作
function FlowFrameNode({ id, data, isConnectable }: NodeProps) {
  const nodeData = data as FlowNodeData
  const color = nodeData.color || '#8b5cf6'
  return (
    <div className="relative h-full w-full group pointer-events-none select-none">
      {/* 框身背景 (pointer-events-none，點擊可穿透選取線與畫布) */}
      <div
        className={cx(
          'h-full w-full rounded-2xl border-2 border-dashed pointer-events-none',
          nodeData.isSelected && 'ring-2 ring-blue-500/50'
        )}
        style={{ borderColor: color, backgroundColor: `${color}12` }}
      />

      {/* 標籤標題列 (保留 pointer-events-auto 可抓取拖曳與點擊操作) */}
      <div
        className="absolute -top-3 left-3 flex max-w-[85%] items-center gap-1 rounded-lg border bg-white px-2 py-0.5 shadow-xs dark:bg-slate-900 cursor-grab active:cursor-grabbing pointer-events-auto"
        style={{ borderColor: color }}
      >
        <span className="shrink-0 text-[11px]">🏷️</span>
        <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
          {nodeData.label || T.flow.shared.annotation.frameFallback}
        </span>
        {nodeData.onEdit && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                nodeData.onEdit?.(id)
              }}
              title={T.flow.shared.annotation.editFrame}
              className="cursor-pointer rounded p-0.5 text-[11px] text-slate-400 opacity-0 transition hover:text-blue-600 group-hover:opacity-100 dark:hover:text-blue-400 pointer-events-auto"
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                nodeData.onDelete?.(id)
              }}
              title={T.flow.shared.annotation.deleteFrame}
              className="cursor-pointer rounded p-0.5 text-[11px] text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400 pointer-events-auto"
            >
              🗑️
            </button>
          </>
        )}
      </div>

      {/* 縮放控制點 (保留 pointer-events-auto) */}
      {nodeData.onEdit && (
        <NodeResizeControl
          minWidth={220}
          minHeight={160}
          style={{ background: 'transparent', border: 'none' }}
          className="nodrag pointer-events-auto"
        >
          <div
            title={T.flow.relationGraph.resizeFrame || '拖曳縮放標示框大小'}
            className="absolute right-1 bottom-1 cursor-se-resize select-none p-1 text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 pointer-events-auto"
          >
            ↘
          </div>
        </NodeResizeControl>
      )}

      {/* 四向連接點 (全功能接點：四向皆支援出發與連入) */}
      <FourWayHandles isConnectable={Boolean(nodeData.onEdit)} color={color} />
    </div>
  )
}

const nodeTypes = {
  step: FlowStepNode,
  box: FlowBoxNode,
  text: FlowTextNode,
  frame: FlowFrameNode,
}

// Ref: CR-140 & CR-154 支援智慧直角避障與手動折點
function FlowLabeledEdge({
  id,
  source: _source,
  target: _target,
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
  const edgeData = data as FlowEdgeData | undefined
  const { screenToFlowPosition } = useReactFlow()
  const draggingRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)

  // 障礙物資訊由父層 styledEdges 統一預算並帶入，避免在 Edge 內部呼叫 getNodes() 引發無窮重新渲染迴圈
  const obstacles = edgeData?.waypoint ? [] : (edgeData?.obstacles ?? [])

  // Ref: CR-140 & CR-154 智慧避障直角路徑運算
  const { path, px, py } = buildOrthogonalPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    edgeData?.waypoint,
    obstacles
  )

  // 接點距離過近且未手動拖折點時，隱藏中央折點圓點避免視覺擁擠
  const isTooClose = !edgeData?.waypoint && Math.hypot(targetX - sourceX, targetY - sourceY) < 70

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const text = edgeData?.text || ''

  const finish = (commit: boolean) => {
    if (commit) edgeData?.onSaveText?.(id, draft)
    setIsEditing(false)
  }

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement | SVGPathElement>) => {
    e.stopPropagation()
    draggingRef.current = true
    hasMovedRef.current = false
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement | SVGPathElement>) => {
    if (!draggingRef.current) return
    e.stopPropagation()
    if (
      pointerStartRef.current &&
      Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y) > 3
    ) {
      if (!hasMovedRef.current) {
        hasMovedRef.current = true
        armEdgeDragGuard()
        edgeData?.onWaypointDragStart?.()
      }
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      edgeData?.onWaypointChange?.(id, { x: Math.round(p.x), y: Math.round(p.y) })
    }
  }

  const onHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement | SVGPathElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.stopPropagation()
    if (hasMovedRef.current) {
      armEdgeDragGuard()
      edgeData?.onWaypointDragEnd?.()
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const isConnectable = (edgeData as any)?.isConnectable ?? true

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={0} />

      {/* 寬幅連線拖曳感應熱區：滑鼠懸浮或按住任意線條區段皆可直接拖曳拉動折線，點擊彈出編輯/刪除 */}
      {isConnectable && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={36}
          style={{ pointerEvents: 'stroke' }}
          className="react-flow__edge-interaction cursor-pointer pointer-events-stroke"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onClick={(e) => {
            if (!isConnectable) return
            e.stopPropagation()
            if (hasMovedRef.current || consumeEdgeDragGuard()) return
            edgeData?.onEdgeClick?.()
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            armEdgeDragGuard()
            edgeData?.onWaypointReset?.(id)
          }}
        />
      )}

      {isConnectable && !isTooClose && (
        <EdgeLabelRenderer>
          {/* 轉角控制把手：高對比顯色、懸浮放大、按住拖曳、雙擊還原 */}
          <div
            className={cx(
              "nodrag nopan absolute h-3.5 w-3.5 rounded-full border-2 border-white/95 dark:border-slate-800 shadow-md z-[1000] select-none cursor-grab active:cursor-grabbing",
              "after:absolute after:content-[''] after:-inset-[14px] after:rounded-full after:cursor-grab active:after:cursor-grabbing",
              "hover:scale-135 hover:!bg-blue-500 hover:ring-4 hover:ring-blue-400/40 hover:shadow-md hover:shadow-blue-500/50 hover:z-[1001]",
              draggingRef.current && "scale-135 !bg-blue-500 ring-4 ring-blue-400/40 shadow-md shadow-blue-500/50 z-[1001]"
            )}
            style={{
              backgroundColor: style?.stroke ?? '#6366f1',
              transform: `translate(-50%, -50%) translate(${px}px, ${py}px)`,
              pointerEvents: 'all'
            }}
            title={T.flow.systemFlow.waypointHint}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            onClick={(e) => {
              e.stopPropagation()
              if (hasMovedRef.current || consumeEdgeDragGuard()) return
              edgeData?.onEdgeClick?.()
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              armEdgeDragGuard()
              edgeData?.onWaypointReset?.(id)
            }}
          />
        </EdgeLabelRenderer>
      )}
      {(text || isEditing) && (
        <EdgeLabelRenderer>
          {/* Ref: CR-140 連線文字跟著折點走 */}
          {/* Ref: CR-152 */}
          <div
            className={cx('nodrag nopan absolute', isEditing ? 'pointer-events-auto' : 'pointer-events-none')}
            style={{ transform: `translate(-50%, -100%) translate(${px}px, ${py - 24}px)` }}
          >
            {isEditing ? (
              <input
                type="text"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => finish(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finish(true)
                  if (e.key === 'Escape') finish(false)
                }}
                // Ref: CR-152
                style={{ width: `${Math.max(draft.length + 1, 5)}ch` }}
                className="min-w-[4rem] max-w-[26rem] rounded-md border border-blue-500 bg-white px-2 py-1 text-[13px] font-medium text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
              />
            ) : (
              <span
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setDraft(text)
                  setIsEditing(true)
                }}
                title={T.flow.systemFlow.edgeTextHint}
                className="pointer-events-auto inline-block cursor-text whitespace-nowrap rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[13px] font-medium leading-tight text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
              >
                {text}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = {
  flowEdge: FlowLabeledEdge,
}

const INITIAL_NODES: Node[] = [
  {
    id: 'frame-pcalt',
    type: 'frame',
    position: { x: 20, y: 20 },
    style: { width: 2260, height: 720 },
    width: 2260,
    height: 720,
    dragging: false,
    data: {
      label: '保誠人壽 PCALT VFA2.0 遠距投保系統架構與作業流程 (v1.5)',
      color: '#6366f1',
    },
  },
  {
    id: 'box-client',
    type: 'box',
    position: { x: 60, y: 70 },
    style: { width: 380, height: 640 },
    width: 380,
    height: 640,
    dragging: false,
    data: {
      label: '前端－客戶端 (Customer Client)',
      color: '#10b981',
      mode: 'box',
    },
  },
  {
    id: 'node-c-1',
    type: 'step',
    parentId: 'box-client',
    position: { x: 50, y: 55 },
    dragging: false,
    data: {
      label: '階段一：身分驗證與登入 (Auth)',
      desc: '網投會員 OTP 驗證或 TWCA MID 行動身分識別進入會議室',
      color: '#10b981',
      mode: 'step',
    },
  },
  {
    id: 'node-c-2',
    type: 'step',
    parentId: 'box-client',
    position: { x: 50, y: 205 },
    dragging: false,
    data: {
      label: '階段二：同意聲明與錄影 (C1)',
      desc: '確認招攬員登錄證、審閱三份同意書並口頭聲明 (第一段錄影)',
      color: '#10b981',
      mode: 'step',
    },
  },
  {
    id: 'node-c-3',
    type: 'step',
    parentId: 'box-client',
    position: { x: 50, y: 355 },
    dragging: false,
    data: {
      label: '階段三：人臉與身分證辨識 (OCR)',
      desc: '合輪作業：人臉即時註冊比對 + 身分證件正面拍照 OCR 驗證',
      color: '#10b981',
      mode: 'step',
    },
  },
  {
    id: 'node-c-4',
    type: 'step',
    parentId: 'box-client',
    position: { x: 50, y: 505 },
    dragging: false,
    data: {
      label: '階段四：文件審閱與電子簽署 (C2/C3)',
      desc: '核對健告事項、要保文件在線簽署與投保聲明 (第二/三段錄影)',
      color: '#10b981',
      mode: 'step',
    },
  },
  {
    id: 'box-advisor',
    type: 'box',
    position: { x: 500, y: 70 },
    style: { width: 380, height: 640 },
    width: 380,
    height: 640,
    dragging: false,
    data: {
      label: '前端－業務端 (Advisor Client)',
      color: '#3b82f6',
      mode: 'box',
    },
  },
  {
    id: 'node-a-1',
    type: 'step',
    parentId: 'box-advisor',
    position: { x: 50, y: 55 },
    dragging: false,
    data: {
      label: '階段一：發起邀請與建立會議',
      desc: '自 ePOS 轉入會議室、發送邀請簡訊/Email 及進房密碼給要保人',
      color: '#3b82f6',
      mode: 'step',
    },
  },
  {
    id: 'node-a-2',
    type: 'step',
    parentId: 'box-advisor',
    position: { x: 50, y: 205 },
    dragging: false,
    data: {
      label: '階段二：出示登錄證與同步引導',
      desc: '出示招攬員登錄證、啟動 C0 重點摘要宣告與 C1 同意錄影',
      color: '#3b82f6',
      mode: 'step',
    },
  },
  {
    id: 'node-a-3',
    type: 'step',
    parentId: 'box-advisor',
    position: { x: 50, y: 355 },
    dragging: false,
    data: {
      label: '階段三：文件共享與健告核對',
      desc: '桌面/要保書同步滾動導讀、前序健告問項逐條再次核對確認',
      color: '#3b82f6',
      mode: 'step',
    },
  },
  {
    id: 'node-a-4',
    type: 'step',
    parentId: 'box-advisor',
    position: { x: 50, y: 505 },
    dragging: false,
    data: {
      label: '階段四：招攬員簽名與送件確認',
      desc: '招攬員雙方簽署確認、高齡錄音(若有)、送件前確認與保費提醒',
      color: '#3b82f6',
      mode: 'step',
    },
  },
  {
    id: 'box-api-gw',
    type: 'box',
    position: { x: 940, y: 70 },
    style: { width: 380, height: 640 },
    width: 380,
    height: 640,
    dragging: false,
    data: {
      label: 'API 閘道與介接服務 (API Layer)',
      color: '#f59e0b',
      mode: 'box',
    },
  },
  {
    id: 'node-gw-auth',
    type: 'step',
    parentId: 'box-api-gw',
    position: { x: 50, y: 55 },
    dragging: false,
    data: {
      label: '階段一：API 閘道 (Gateway / Auth)',
      desc: 'ePOS 授權鑑別、房間 Token 簽發、請求路由轉發與流量安全防護',
      color: '#f59e0b',
      mode: 'step',
    },
  },
  {
    id: 'node-api-3rd',
    type: 'step',
    parentId: 'box-api-gw',
    position: { x: 50, y: 205 },
    dragging: false,
    data: {
      label: '階段二：第三方介接 API (Adapter)',
      desc: '介接 TWCA MID 行動身分識別、簡訊 OTP 閘道與身分證 OCR 辨識',
      color: '#06b6d4',
      mode: 'step',
    },
  },
  {
    id: 'box-meet-service',
    type: 'box',
    position: { x: 1380, y: 70 },
    style: { width: 380, height: 640 },
    width: 380,
    height: 640,
    dragging: false,
    data: {
      label: '保誠會議核心服務 (Meet Service)',
      color: '#8b5cf6',
      mode: 'box',
    },
  },
  {
    id: 'node-m-1',
    type: 'step',
    parentId: 'box-meet-service',
    position: { x: 50, y: 55 },
    dragging: false,
    data: {
      label: '階段一：信令與 WebSocket 廣播',
      desc: 'WebRTC 即時影音串流交換、/topic/GetMessage/{roomName} 狀態同步',
      color: '#8b5cf6',
      mode: 'step',
    },
  },
  {
    id: 'node-m-2',
    type: 'step',
    parentId: 'box-meet-service',
    position: { x: 50, y: 205 },
    dragging: false,
    data: {
      label: '階段二：分段錄影與狀態控管',
      desc: 'C0~C3 錄影分段控制、錄影失敗通知機制、補件與案件狀態機',
      color: '#8b5cf6',
      mode: 'step',
    },
  },
  {
    id: 'node-m-3',
    type: 'step',
    parentId: 'box-meet-service',
    position: { x: 50, y: 355 },
    dragging: false,
    data: {
      label: '階段三：投保結果聚合與回報',
      desc: 'PDF 套印、簽署雜湊封裝，回傳 ePOS (doRmSignSuccess / Failed)',
      color: '#6366f1',
      mode: 'step',
    },
  },
  {
    id: 'box-external',
    type: 'box',
    position: { x: 1820, y: 70 },
    style: { width: 380, height: 640 },
    width: 380,
    height: 640,
    dragging: false,
    data: {
      label: '外部系統與資料儲存 (External & DB)',
      color: '#ec4899',
      mode: 'box',
    },
  },
  {
    id: 'node-ext-epos',
    type: 'step',
    parentId: 'box-external',
    position: { x: 50, y: 55 },
    dragging: false,
    data: {
      label: '階段一：ePOS 核心系統 (eAppForm)',
      desc: '發起 registerMeetingRoom 申請開房、接收遠距簽署結果與要保調整',
      color: '#ec4899',
      mode: 'step',
    },
  },
  {
    id: 'node-ext-3rd',
    type: 'step',
    parentId: 'box-external',
    position: { x: 50, y: 205 },
    dragging: false,
    data: {
      label: '階段二：第三方服務 (TWCA/OTP/OCR)',
      desc: 'TWCA Mobile ID 電信認證、電信簡訊閘道、身分證 OCR 辨識引擎',
      color: '#ec4899',
      mode: 'step',
    },
  },
  {
    id: 'node-ext-db',
    type: 'step',
    parentId: 'box-external',
    position: { x: 50, y: 355 },
    dragging: false,
    data: {
      label: '階段三：核心資料庫與 Redis 快取',
      desc: 'rm_case 案件主檔、rm_recording_segment 錄影片段、rm_sign_result',
      color: '#64748b',
      mode: 'step',
    },
  },
]

const INITIAL_EDGES: Edge[] = [
  {
    id: 'e-c1-c2',
    source: 'node-c-1',
    target: 'node-c-2',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-c2-c3',
    source: 'node-c-2',
    target: 'node-c-3',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-c3-c4',
    source: 'node-c-3',
    target: 'node-c-4',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-a1-a2',
    source: 'node-a-1',
    target: 'node-a-2',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-a2-a3',
    source: 'node-a-2',
    target: 'node-a-3',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-a3-a4',
    source: 'node-a-3',
    target: 'node-a-4',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-gw1-gw2',
    source: 'node-gw-auth',
    target: 'node-api-3rd',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-m1-m2',
    source: 'node-m-1',
    target: 'node-m-2',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-m2-m3',
    source: 'node-m-2',
    target: 'node-m-3',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-ext1-ext2',
    source: 'node-ext-epos',
    target: 'node-ext-3rd',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-ext2-ext3',
    source: 'node-ext-3rd',
    target: 'node-ext-db',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e-epos-to-gw',
    source: 'node-ext-epos',
    target: 'node-gw-auth',
    sourceHandle: 'left-out',
    targetHandle: 'right-in',
    ...getEdgeStyleAndMarker('left-out'),
  },
  {
    id: 'e-a1-to-gw',
    source: 'node-a-1',
    target: 'node-gw-auth',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
  {
    id: 'e-c1-to-gw',
    source: 'node-c-1',
    target: 'node-gw-auth',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
  {
    id: 'e-gw-to-m1',
    source: 'node-gw-auth',
    target: 'node-m-1',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
  {
    id: 'e-adapter-to-ext3rd',
    source: 'node-api-3rd',
    target: 'node-ext-3rd',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
  {
    id: 'e-m2-to-adapter',
    source: 'node-m-2',
    target: 'node-api-3rd',
    sourceHandle: 'left-out',
    targetHandle: 'right-in',
    ...getEdgeStyleAndMarker('left-out'),
  },
  {
    id: 'e-m2-to-db',
    source: 'node-m-2',
    target: 'node-ext-db',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
  {
    id: 'e-m3-to-epos',
    source: 'node-m-3',
    target: 'node-ext-epos',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
]

export interface FlowPage {
  id: string
  title: string
  createdById?: string | null
  createdByName?: string | null
  nodes: Node[]
  edges: Edge[]
}

function loadInitialPages(projectId: string): FlowPage[] {
  const storageKeyPages = `pmflow_system_flow_pages_${projectId}`
  const storageKeyLegacy = `pmflow_system_flow_canvas_${projectId}`
  try {
    const savedPages = localStorage.getItem(storageKeyPages)
    if (savedPages) {
      const parsed = JSON.parse(savedPages)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p, idx) => ({
          id: p.id || `page-${idx + 1}`,
          title: p.title || T.flow.systemFlow.pageDefaultTitle(idx + 1),
          createdById: p.createdById || null,
          createdByName: p.createdByName || null,
          nodes: Array.isArray(p.nodes) ? orderParentNodesFirst(p.nodes) : [],
          edges: Array.isArray(p.edges)
            ? p.edges.map((e: Edge) => ({
                ...e,
                ...getEdgeStyleAndMarker(e.sourceHandle, (e.data as any)?.color || (e.style?.stroke as string)),
              }))
            : [],
        }))
      }
    }

    // 舊版單頁結構相容性轉移
    const savedLegacy = localStorage.getItem(storageKeyLegacy)
    if (savedLegacy) {
      const parsedLegacy = JSON.parse(savedLegacy)
      if (parsedLegacy?.nodes && Array.isArray(parsedLegacy.nodes)) {
        return [
          {
            id: 'page-1',
            title: T.flow.systemFlow.mainPageTitle,
            createdById: null,
            createdByName: null,
            nodes: orderParentNodesFirst(parsedLegacy.nodes),
            edges: Array.isArray(parsedLegacy.edges)
              ? parsedLegacy.edges.map((e: Edge) => ({
                  ...e,
                  ...getEdgeStyleAndMarker(e.sourceHandle, (e.data as any)?.color || (e.style?.stroke as string)),
                }))
              : [],
          },
        ]
      }
    }
  } catch {
    // ignore
  }

  return [
    {
      id: 'page-1',
      title: T.flow.systemFlow.mainPageTitle,
      createdById: null,
      createdByName: null,
      nodes: orderParentNodesFirst(INITIAL_NODES),
      edges: INITIAL_EDGES,
    },
  ]
}

function SystemFlowInner({ projectId = 'default' }: SystemFlowProps) {
  const storageKeyPages = `pmflow_system_flow_pages_${projectId}`
  const backendSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedJsonRef = useRef<string>('')

  const savePagesToBackend = useCallback((next: FlowPage[]) => {
    if (!projectId || projectId === 'default') return
    const json = JSON.stringify(next)
    if (json === lastSavedJsonRef.current) return

    if (backendSaveTimerRef.current) {
      clearTimeout(backendSaveTimerRef.current)
    }
    backendSaveTimerRef.current = setTimeout(async () => {
      backendSaveTimerRef.current = null
      try {
        lastSavedJsonRef.current = json
        await Api.saveCanvasDoc(projectId, 'system-flow', { data: next })
      } catch (err) {
        console.error('Failed to save system-flow canvas doc to backend:', err)
      }
    }, 600)
  }, [projectId])

  // Ref: CR-140 整份文件的寫入統一走這一個出口 (同時寫入 localStorage 與後端)
  const savePagesToStore = useCallback(
    (next: FlowPage[]) => {
      try {
        localStorage.setItem(storageKeyPages, JSON.stringify(next))
      } catch {
        // ignore
      }
      savePagesToBackend(next)
    },
    [storageKeyPages, savePagesToBackend]
  )

  const { fitView, zoomIn, zoomOut, setCenter, setViewport } = useReactFlow()
  const { user } = useAuth()
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => Api.project(projectId),
    enabled: !!projectId && projectId !== 'default',
  })

  const { data: canvasDocRes } = useQuery({
    queryKey: ['canvasDoc', projectId, 'system-flow'],
    queryFn: () => Api.canvasDoc(projectId, 'system-flow'),
    enabled: !!projectId && projectId !== 'default',
  })

  const role = project?.members?.find((m) => m.id === user?.id)?.role
  const isManager = role === 'MANAGER'
  const isOwner = role === 'OWNER'
  const isProjectCreator = Boolean(project?.isCreator)

  const [pages, setPages] = useState<FlowPage[]>(() => loadInitialPages(projectId))

  const [activePageId, setActivePageId] = useState<string>(() => {
    const initPages = loadInitialPages(projectId)
    return initPages[0]?.id || 'page-1'
  })
  const activePageIdRef = useRef<string>(activePageId)
  activePageIdRef.current = activePageId

  // 讀取先前儲存的畫面焦點與縮放比例 (Viewport)
  const savedViewport = useMemo(() => {
    try {
      const raw = localStorage.getItem(`pmflow_system_flow_viewport_${projectId}_${activePageId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as Viewport
        if (parsed && typeof parsed.zoom === 'number' && parsed.zoom >= 0.1) {
          return parsed
        }
      }
    } catch {}
    return undefined
  }, [projectId, activePageId])

  // 後端畫布編輯授權白名單查詢 (Ref: CR-194)
  const { data: permData } = useQuery({
    queryKey: ['canvasPermissions', projectId, 'system-flow'],
    queryFn: () => Api.canvasPermissions(projectId, 'system-flow'),
    enabled: !!projectId,
  })
  const canManagePerms = Boolean(isProjectCreator || permData?.canManage)
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

  const hasFittedRef = useRef<boolean>(false)
  const lastAppliedUpdatedAtRef = useRef<string | null>(null)

  // 當後端有共享資料時載入並即時同步
  useEffect(() => {
    if (!canvasDocRes?.data) return
    const rawData = canvasDocRes.data
    const updatedAt = canvasDocRes.updatedAt ?? null

    // 如果後端版本已套用過且內容未變則略過
    if (updatedAt && updatedAt === lastAppliedUpdatedAtRef.current) return

    if (Array.isArray(rawData) && rawData.length > 0) {
      const incomingJson = JSON.stringify(rawData)
      if (incomingJson === lastSavedJsonRef.current) {
        lastAppliedUpdatedAtRef.current = updatedAt
        return
      }

      lastAppliedUpdatedAtRef.current = updatedAt
      const serverPages: FlowPage[] = rawData.map((p, idx) => ({
        id: p.id || `page-${idx + 1}`,
        title: p.title || T.flow.systemFlow.pageDefaultTitle(idx + 1),
        createdById: p.createdById || null,
        createdByName: p.createdByName || null,
        nodes: Array.isArray(p.nodes) ? orderParentNodesFirst(p.nodes) : [],
        edges: Array.isArray(p.edges)
          ? p.edges.map((e: Edge) => ({
              ...e,
              ...getEdgeStyleAndMarker(e.sourceHandle, (e.data as any)?.color || (e.style?.stroke as string)),
            }))
          : [],
      }))
      lastSavedJsonRef.current = JSON.stringify(serverPages)
      setPages(serverPages)
      try {
        localStorage.setItem(storageKeyPages, JSON.stringify(serverPages))
      } catch {}
      const curPageId = activePageIdRef.current || activePageId || 'page-1'
      const found = serverPages.find((p) => p.id === curPageId)
      const nextId = found ? curPageId : serverPages[0].id
      const targetPage = serverPages.find((p) => p.id === nextId) || serverPages[0]
      setActivePageId(nextId)
      setNodes(orderParentNodesFirst(targetPage.nodes))
      setEdges(
        targetPage.edges.map((e: Edge) => ({
          ...e,
          ...getEdgeStyleAndMarker(e.sourceHandle, (e.data as any)?.color || (e.style?.stroke as string)),
        }))
      )
    }
  }, [canvasDocRes, projectId, storageKeyPages, activePageId])

  // 當元件卸載或切換專案時，若有未送出的排程儲存則立刻寫回後端
  useEffect(() => {
    return () => {
      if (backendSaveTimerRef.current) {
        clearTimeout(backendSaveTimerRef.current)
        backendSaveTimerRef.current = null
        try {
          const currentStr = localStorage.getItem(storageKeyPages)
          if (currentStr && currentStr !== lastSavedJsonRef.current && projectId && projectId !== 'default') {
            const parsed = JSON.parse(currentStr)
            Api.saveCanvasDoc(projectId, 'system-flow', { data: parsed }).catch(() => {})
          }
        } catch {}
      }
    }
  }, [projectId, storageKeyPages])

  // 當前畫布的 nodes 與 edges
  const activePage = useMemo(() => {
    return pages.find((p) => p.id === activePageId) || pages[0]
  }, [pages, activePageId])

  const [nodes, setNodes] = useState<Node[]>(() => activePage?.nodes ?? [])
  const [edges, setEdges] = useState<Edge[]>(() => activePage?.edges ?? [])

  // 僅當「完全沒有儲存過 Viewport」時，首次進入才執行 fitView (對齊 TaskGraph: 確保測量就緒後再置中，避免排版亂掉或無法移動)
  useEffect(() => {
    if (savedViewport) return

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
  }, [nodes, fitView, savedViewport])

  const handleMoveEnd = useCallback((_e: unknown, vp: Viewport) => {
    if (nodes.length === 0) return
    if (typeof vp.zoom === 'number' && vp.zoom >= 0.1) {
      try {
        localStorage.setItem(`pmflow_system_flow_viewport_${projectId}_${activePageId}`, JSON.stringify(vp))
      } catch {
        // ignore
      }
    }
  }, [nodes.length, projectId, activePageId])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<{ id: string; label: string; desc: string; color: string; mode: FlowNodeType } | null>(null)
  const [confirmDeleteEdge, setConfirmDeleteEdge] = useState<{ edgeId: string; source: string; target: string; text: string; color?: string } | null>(null)
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)

  // 頁面重新命名與刪除狀態
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>('')
  const [confirmDeletePage, setConfirmDeletePage] = useState<FlowPage | null>(null)

  // 頁籤拖曳排序狀態
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)

  // 拖曳重排頁籤
  const handleReorderTabs = (sourceId: string | null, targetId: string) => {
    if (!effectiveEditable || !sourceId || sourceId === targetId) return
    setPages((prev) => {
      const srcIdx = prev.findIndex((p) => p.id === sourceId)
      const tgtIdx = prev.findIndex((p) => p.id === targetId)
      if (srcIdx === -1 || tgtIdx === -1) return prev
      const next = [...prev]
      const [removed] = next.splice(srcIdx, 1)
      next.splice(tgtIdx, 0, removed)
      savePagesToStore(next)
      return next
    })
    setDraggedTabId(null)
    setDragOverTabId(null)
  }

  // Ref: CR-148
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const interactingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeViewCacheRef = useRef(new Map<string, { src: Node; selected: boolean; out: Node }>())
  const edgeViewCacheRef = useRef(new Map<string, { src: Edge; out: Edge }>())
  const edgeHandlersRef = useRef<unknown[]>([])

  // 立即將目前進行中／尚未落盤的分頁畫布變更刷新至 pages 與 store (避免換頁時被非同步定時器寫錯頁)
  const flushCurrentPageChanges = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!pendingSaveRef.current) return pages
    pendingSaveRef.current = false
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current
    const updated = pages.map((p) => {
      if (p.id === activePageId) {
        return { ...p, nodes: currentNodes, edges: currentEdges }
      }
      return p
    })
    savePagesToStore(updated)
    return updated
  }, [pages, activePageId, savePagesToStore])

  // Ref: CR-148 整份文件的組裝與寫入集中在這裡，出口仍然只有 savePagesToStore 一個
  const commitCanvas = useCallback(() => {
    pendingSaveRef.current = false
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setPages((prevPages) => {
      const updated = prevPages.map((p) => {
        if (p.id === activePageId) {
          return { ...p, nodes: nodesRef.current, edges: edgesRef.current }
        }
        return p
      })
      savePagesToStore(updated)
      return updated
    })
  }, [activePageId, savePagesToStore])

  const beginInteraction = useCallback(() => {
    interactingRef.current = true
  }, [])

  // Ref: CR-148 放開後補上這次互動唯一的一筆寫入 (拖折點沒有後續 state 變動，要在這裡收尾)
  const endInteraction = useCallback(() => {
    interactingRef.current = false
    if (pendingSaveRef.current) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        if (pendingSaveRef.current) commitCanvas()
      }, 500)
    }
  }, [commitCanvas])

  // 自動同步當前畫布至 pages 狀態與 localStorage
  // Ref: CR-148 拖曳/縮放/拖折點進行中只記旗標不落盤，另留保險計時器避免收不到結束事件時漏存
  // 加入防抖 (Debounce 500ms)，避免畫布狀態微調時造成同步 loop
  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
    pendingSaveRef.current = true

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    if (interactingRef.current) {
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        if (pendingSaveRef.current) commitCanvas()
      }, 800)
      return
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      if (pendingSaveRef.current) commitCanvas()
    }, 500)
  }, [nodes, edges, activePageId, commitCanvas])

  // Ref: CR-148 離開頁面時把還沒落盤的最後一筆補寫回去
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (pendingSaveRef.current) commitCanvas()
    }
  }, [commitCanvas])

  // 切換頁面 (完整重置上一頁的暫存、快取與彈窗狀態，避免跨頁資訊殘留)
  const handleSwitchPage = (targetId: string) => {
    if (targetId === activePageId) return
    const currentPages = flushCurrentPageChanges()
    const target = currentPages.find((p) => p.id === targetId)
    if (!target) return

    // 1. 清理跨頁殘留的選取、連線、編輯快取與彈窗狀態
    setSelectedNodeId(null)
    setEditingNode(null)
    setConfirmDeleteEdge(null)
    setEditingPageId(null)
    connectStartRef.current = null
    interactingRef.current = false
    nodeViewCacheRef.current.clear()
    edgeViewCacheRef.current.clear()

    // 2. 載入目標分頁節點與連線
    const nextNodes = orderParentNodesFirst(target.nodes)
    const nextEdges = target.edges.map((e: Edge) => ({
      ...e,
      ...getEdgeStyleAndMarker(e.sourceHandle, (e.data as any)?.color || (e.style?.stroke as string)),
    }))

    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
    setActivePageId(targetId)
    setNodes(nextNodes)
    setEdges(nextEdges)

    // 3. Viewport: 若目標分頁已有儲存的視角則還原，若無則執行置中適應
    setTimeout(() => {
      try {
        const raw = localStorage.getItem(`pmflow_system_flow_viewport_${projectId}_${targetId}`)
        if (raw) {
          const vp = JSON.parse(raw) as Viewport
          if (vp && typeof vp.zoom === 'number' && vp.zoom >= 0.05) {
            setViewport(vp, { duration: 200 })
            return
          }
        }
      } catch {}
      fitView({ padding: 0.2, duration: 250 })
    }, 50)
  }

  // 新增頁面
  const handleAddPage = () => {
    if (!effectiveEditable) return
    const currentPages = flushCurrentPageChanges()
    const newId = `page-${Date.now()}`
    const newTitle = T.flow.systemFlow.pageDefaultTitle(currentPages.length + 1)
    const newPage: FlowPage = {
      id: newId,
      title: newTitle,
      createdById: user?.id || null,
      createdByName: user?.displayName || user?.email || null,
      nodes: [],
      edges: [],
    }
    const updated = [...currentPages, newPage]
    setSelectedNodeId(null)
    setEditingNode(null)
    setConfirmDeleteEdge(null)
    setEditingPageId(null)
    connectStartRef.current = null
    interactingRef.current = false
    nodeViewCacheRef.current.clear()
    edgeViewCacheRef.current.clear()

    nodesRef.current = []
    edgesRef.current = []
    setPages(updated)
    setActivePageId(newId)
    setNodes([])
    setEdges([])
    savePagesToStore(updated)
  }

  // 刪除頁面 (若刪除唯一／最後一個分頁，將自動建立全新空白分頁)
  const handleDeletePage = (pageId: string) => {
    if (!effectiveEditable) return
    const currentPages = flushCurrentPageChanges()
    const target = currentPages.find((p) => p.id === pageId)
    if (!target) return
    let nextPages = currentPages.filter((p) => p.id !== pageId)
    try {
      localStorage.removeItem(`pmflow_system_flow_viewport_${projectId}_${pageId}`)
    } catch {}
    setConfirmDeletePage(null)
    setSelectedNodeId(null)
    setEditingNode(null)
    setConfirmDeleteEdge(null)
    setEditingPageId(null)
    connectStartRef.current = null
    interactingRef.current = false
    nodeViewCacheRef.current.clear()
    edgeViewCacheRef.current.clear()

    // 若所有分頁皆被刪除，自動產生一個全新空白分頁
    if (nextPages.length === 0) {
      const newId = `page-${Date.now()}`
      const fallbackPage: FlowPage = {
        id: newId,
        title: T.flow.systemFlow.pageDefaultTitle(1),
        createdById: user?.id || null,
        createdByName: user?.displayName || user?.email || null,
        nodes: [],
        edges: [],
      }
      nextPages = [fallbackPage]
      nodesRef.current = []
      edgesRef.current = []
      setActivePageId(newId)
      setNodes([])
      setEdges([])
      setPages(nextPages)
      savePagesToStore(nextPages)
      return
    }

    if (activePageId === pageId) {
      const nextActive = nextPages[0]
      const nextNodes = orderParentNodesFirst(nextActive.nodes)
      const nextEdges = nextActive.edges.map((e: Edge) => ({
        ...e,
        ...getEdgeStyleAndMarker(e.sourceHandle, (e.data as any)?.color || (e.style?.stroke as string)),
      }))
      nodesRef.current = nextNodes
      edgesRef.current = nextEdges
      setActivePageId(nextActive.id)
      setNodes(nextNodes)
      setEdges(nextEdges)
      setTimeout(() => {
        try {
          const raw = localStorage.getItem(`pmflow_system_flow_viewport_${projectId}_${nextActive.id}`)
          if (raw) {
            const vp = JSON.parse(raw) as Viewport
            if (vp && typeof vp.zoom === 'number' && vp.zoom >= 0.05) {
              setViewport(vp, { duration: 200 })
              return
            }
          }
        } catch {}
        fitView({ padding: 0.2, duration: 250 })
      }, 50)
    }
    setPages(nextPages)
    savePagesToStore(nextPages)
  }

  // 開始重新命名
  const handleStartRenamePage = (id: string, currentTitle: string) => {
    if (!effectiveEditable) return
    setEditingPageId(id)
    setEditingTitle(currentTitle)
  }

  // 完成重新命名
  const handleFinishRenamePage = () => {
    if (!effectiveEditable || !editingPageId) return
    const trimmed = editingTitle.trim()
    if (trimmed) {
      setPages((prev) => {
        const updated = prev.map((p) => (p.id === editingPageId ? { ...p, title: trimmed } : p))
        savePagesToStore(updated)
        return updated
      })
    }
    setEditingPageId(null)
  }

  // Ref: CR-148 dragging / resizing 旗標就是「互動中」的判準；收到 false 才放行落盤，
  // 實際寫入交給後面那個 effect (它才拿得到套用完的最新節點)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!effectiveEditable) {
      const filtered = changes.filter((c) => c.type === 'select')
      if (filtered.length) {
        setNodes((nds) => applyNodeChanges(filtered, nds))
      }
      return
    }
    let ended = false
    for (const c of changes) {
      if (c.type === 'position' && typeof c.dragging === 'boolean') {
        if (c.dragging) beginInteraction()
        else ended = true
      } else if (c.type === 'dimensions' && typeof c.resizing === 'boolean') {
        if (c.resizing) beginInteraction()
        else ended = true
      }
    }
    if (ended) interactingRef.current = false
    setNodes((nds) => {
      let next = applyNodeChanges(changes, nds)
      const dimChanges = changes.filter(
        (c): c is NodeDimensionChange => c.type === 'dimensions' && Boolean(c.dimensions)
      )
      if (dimChanges.length > 0) {
        next = next.map((n: Node) => {
          const dc = dimChanges.find((c) => c.id === n.id)
          if (dc?.dimensions && dc.dimensions.width && dc.dimensions.height) {
            const nw = Math.round(dc.dimensions.width)
            const nh = Math.round(dc.dimensions.height)
            return {
              ...n,
              width: nw,
              height: nh,
              style: {
                ...(n.style || {}),
                width: nw,
                height: nh,
              },
              measured: { width: nw, height: nh },
            }
          }
          return n
        })
      }
      // Ref: CR-152
      if (changes.some((c) => c.type === 'select')) {
        const frameIds = new Set(
          next.filter((n) => ((n.data as FlowNodeData)?.mode || n.type) === 'frame').map((n) => n.id)
        )
        if (frameIds.size > 0) {
          const kept = changes.filter((c) => !(c.type === 'select' && frameIds.has(c.id)))
          return applyNodeChanges(kept, next)
        }
      }
      if (ended) {
        return orderParentNodesFirst(next)
      }
      return next
    })
  }, [effectiveEditable, beginInteraction])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!effectiveEditable) {
      const filtered = changes.filter((c) => c.type === 'select')
      if (filtered.length) {
        setEdges((eds) => applyEdgeChanges(filtered, eds))
      }
      return
    }
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [effectiveEditable])

  // 記住使用者是從哪一顆節點與接點開始拉線的
  const connectStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null)

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

  const onConnect = useCallback((params: Connection) => {
    if (!effectiveEditable || !params.source || !params.target) return

    // 如果使用者是從被 React Flow 標為 target 的接點起拉，React Flow 會將 source 與 target 顛倒
    // 依據實際按下滑鼠的起點節點換回正確方向，確保箭頭永遠位於滑鼠放開的終點端（支援右到左、下到上等任意方向）
    const startInfo = connectStartRef.current
    const startedAtTarget =
      startInfo?.nodeId === params.target &&
      (!startInfo.handleId || startInfo.handleId === params.targetHandle)

    const resolved: Connection = startedAtTarget
      ? {
          source: params.target,
          sourceHandle: params.targetHandle,
          target: params.source,
          targetHandle: params.sourceHandle,
        }
      : params

    connectStartRef.current = null

    const edgeStyleAndMarker = getEdgeStyleAndMarker(resolved.sourceHandle, '#4f46e5')
    const newEdge: Edge = {
      ...resolved,
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...edgeStyleAndMarker,
      data: { text: '', color: '#4f46e5' },
    }
    setEdges((eds) => addEdge(newEdge, eds))
  }, [effectiveEditable])

  // 拖曳結束判斷：拖入容器收納 / 拖出容器為獨立節點
  const onNodeDragStop = useCallback((_event: unknown, draggedNode: Node) => {
    if (!effectiveEditable || draggedNode.type !== 'step') return

    setNodes((currentNodes) => {
      const nodeMap = new Map(currentNodes.map((n) => [n.id, n]))
      const latestDragged = nodeMap.get(draggedNode.id) || draggedNode

      // 計算拖曳節點絕對座標
      let absX = latestDragged.position.x
      let absY = latestDragged.position.y
      if (latestDragged.parentId) {
        const parent = nodeMap.get(latestDragged.parentId)
        if (parent) {
          absX += parent.position.x
          absY += parent.position.y
        }
      }

      const draggedW = latestDragged.measured?.width ?? 260
      const draggedH = latestDragged.measured?.height ?? 90
      const centerX = absX + draggedW / 2
      const centerY = absY + draggedH / 2

      // 檢查是否落入某個收納盒
      const boxes = currentNodes.filter((n) => n.type === 'box' && n.id !== latestDragged.id)
      let targetBox: Node | null = null

      for (const box of boxes) {
        const bX = box.position.x
        const bY = box.position.y
        const bW = typeof box.style?.width === 'number' ? box.style.width : (box.measured?.width ?? 360)
        const bH = typeof box.style?.height === 'number' ? box.style.height : (box.measured?.height ?? 260)

        if (centerX >= bX && centerX <= bX + bW && centerY >= bY && centerY <= bY + bH) {
          targetBox = box
          break
        }
      }

      if (targetBox) {
        // 拖入收納盒：轉為子節點
        const relX = Math.max(20, absX - targetBox.position.x)
        const relY = Math.max(50, absY - targetBox.position.y)

        const updatedDragged: Node = {
          ...latestDragged,
          parentId: targetBox.id,
          position: { x: relX, y: relY },
        }

        // 自動擴展收納盒尺寸以容納子節點
        const curW = typeof targetBox.style?.width === 'number' ? targetBox.style.width : (targetBox.measured?.width ?? 360)
        const curH = typeof targetBox.style?.height === 'number' ? targetBox.style.height : (targetBox.measured?.height ?? 260)
        const neededW = Math.max(curW, relX + draggedW + 24)
        const neededH = Math.max(curH, relY + draggedH + 24)

        const updatedBox: Node = {
          ...targetBox,
          style: { ...targetBox.style, width: neededW, height: neededH },
        }

        const nextNodes = currentNodes.map((n) => {
          if (n.id === updatedDragged.id) return updatedDragged
          if (n.id === updatedBox.id) return updatedBox
          return n
        })

        return orderParentNodesFirst(nextNodes)
      } else if (latestDragged.parentId) {
        // 拖出收納盒：恢復為獨立節點
        const updatedDragged: Node = {
          ...latestDragged,
          parentId: undefined,
          position: { x: absX, y: absY },
        }

        const nextNodes = currentNodes.map((n) => (n.id === updatedDragged.id ? updatedDragged : n))
        return orderParentNodesFirst(nextNodes)
      }
      return currentNodes
    })
  }, [effectiveEditable])

  // 點擊節點開啟編輯視窗
  const handleEditNode = useCallback((nodeId: string) => {
    if (!effectiveEditable) return
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setEditingNode({
      id: node.id,
      label: (node.data?.label as string) || (node.data?.title as string) || '',
      desc: (node.data?.desc as string) || (node.data?.subtitle as string) || '',
      color: (node.data?.color as string) || '#3b82f6',
      mode: (node.type as FlowNodeType) || (node.data?.mode as FlowNodeType) || 'step',
    })
  }, [nodes, effectiveEditable])

  // 刪除節點 (連帶刪除相連 edges，若是 box 連帶解散/刪除 child)
  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!effectiveEditable) return
    setNodes((nds) => {
      const target = nds.find((n) => n.id === nodeId)
      if (!target) return nds
      if (target.type === 'box') {
        return nds
          .filter((n) => n.id !== nodeId)
          .map((n) => {
            if (n.parentId === nodeId) {
              const copy = { ...n }
              delete copy.parentId
              copy.position = {
                x: target.position.x + n.position.x,
                y: target.position.y + n.position.y,
              }
              return copy
            }
            return n
          })
      }
      return nds.filter((n) => n.id !== nodeId)
    })
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
  }, [effectiveEditable])

  // 保存節點編輯
  const handleSaveEdit = () => {
    if (!editingNode) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === editingNode.id
          ? {
              ...n,
              type: editingNode.mode,
              data: {
                ...n.data,
                label: editingNode.label,
                desc: editingNode.desc,
                color: editingNode.color,
              },
            }
          : n
      )
    )
    setEditingNode(null)
  }

  const handleSaveEdgeProperties = useCallback((edgeId: string, text: string, color?: string) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e
        const nextColor = color || (e.data as any)?.color || (e.style?.stroke as string) || '#4f46e5'
        return {
          ...e,
          style: {
            ...(e.style || {}),
            stroke: nextColor,
          },
          markerEnd: {
            ...(typeof e.markerEnd === 'object' ? e.markerEnd : {}),
            type: MarkerType.ArrowClosed,
            color: nextColor,
            width: 14,
            height: 14,
          },
          data: {
            ...(e.data || {}),
            text,
            color: nextColor,
          },
        }
      })
    )
  }, [])

  const handleSaveEdgeText = useCallback((edgeId: string, text: string) => {
    handleSaveEdgeProperties(edgeId, text)
  }, [handleSaveEdgeProperties])

  const handleWaypointChange = useCallback((edgeId: string, waypoint: { x: number; y: number } | null) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e
        return {
          ...e,
          data: {
            ...(e.data || {}),
            waypoint,
          },
        }
      })
    )
  }, [])

  const handleWaypointReset = useCallback((edgeId: string) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e
        const nextData = { ...(e.data || {}) }
        delete (nextData as any).waypoint
        return {
          ...e,
          data: nextData,
        }
      })
    )
  }, [])

  // 新增步驟節點
  const handleAddStep = () => {
    if (!effectiveEditable) return
    const newId = `step-${Date.now()}`
    const newNode: Node = {
      id: newId,
      type: 'step',
      position: { x: 200 + Math.random() * 80, y: 150 + Math.random() * 80 },
      data: {
        label: T.flow.systemFlow.newStep,
        desc: T.flow.systemFlow.newStepDesc,
        color: '#3b82f6',
        mode: 'step',
      },
    }
    setNodes((nds) => orderParentNodesFirst([...nds, newNode]))
    setSelectedNodeId(newId)
  }

  // 新增模組容器盒
  const handleAddBox = () => {
    if (!effectiveEditable) return
    const newId = `box-${Date.now()}`
    const newNode: Node = {
      id: newId,
      type: 'box',
      position: { x: 180 + Math.random() * 60, y: 100 + Math.random() * 60 },
      style: { width: 360, height: 260 },
      data: {
        label: T.flow.systemFlow.newBox,
        color: '#8b5cf6',
        mode: 'box',
      },
    }
    setNodes((nds) => orderParentNodesFirst([...nds, newNode]))
    setSelectedNodeId(newId)
  }

  const handleAddText = () => {
    if (!effectiveEditable) return
    const newId = `text-${Date.now()}`
    const newNode: Node = {
      id: newId,
      type: 'text',
      position: { x: 120 + (nodes.length % 5) * 30, y: 120 + (nodes.length % 5) * 30 },
      data: {
        label: T.flow.shared.annotation.newTextDefault,
        color: '#475569',
      },
    }
    setNodes((nds) => [...nds, newNode])
  }

  const handleAddFrame = () => {
    if (!effectiveEditable) return
    const newId = `frame-${Date.now()}`
    const newNode: Node = {
      id: newId,
      type: 'frame',
      position: { x: 60 + (nodes.length % 4) * 40, y: 60 + (nodes.length % 4) * 40 },
      style: { width: 400, height: 300 },
      data: {
        label: T.flow.shared.annotation.newFrameDefault,
        color: '#8b5cf6',
      },
    }
    setNodes((nds) => orderParentNodesFirst([newNode, ...nds]))
  }

  const nodesWithHandlers = useMemo(() => {
    const prevCache = nodeViewCacheRef.current
    const nextCache = new Map<string, { src: Node; selected: boolean; out: Node }>()

    const mapped = nodes.map((node) => {
      const selected = node.id === selectedNodeId
      const hit = prevCache.get(node.id)
      if (hit && hit.src === node && hit.selected === selected) {
        nextCache.set(node.id, hit)
        return hit.out
      }

      const nodeMode = (node.type as FlowNodeType) || 'step'
      const isFrame = nodeMode === 'frame'
      const defaultW = nodeMode === 'box' ? 360 : isFrame ? 400 : 280
      const defaultH = nodeMode === 'box' ? 400 : isFrame ? 300 : 100
      const nodeW =
        typeof (node.style as Record<string, unknown> | undefined)?.width === 'number' &&
        ((node.style as Record<string, unknown>).width as number) > 0
          ? ((node.style as Record<string, unknown>).width as number)
          : typeof node.width === 'number' && node.width > 0
            ? node.width
            : defaultW
      const nodeH =
        typeof (node.style as Record<string, unknown> | undefined)?.height === 'number' &&
        ((node.style as Record<string, unknown>).height as number) > 0
          ? ((node.style as Record<string, unknown>).height as number)
          : typeof node.height === 'number' && node.height > 0
            ? node.height
            : defaultH
      const dimObj = { width: nodeW, height: nodeH }
      const style =
        isFrame && node.style && 'pointerEvents' in node.style
          ? (() => {
              const { pointerEvents: _drop, ...rest } = node.style as Record<string, unknown>
              return rest as Node['style']
            })()
          : node.style
      const finalStyle = {
        ...style,
        ...(nodeMode !== 'text' ? { width: nodeW, height: nodeH } : {}),
      }
      const out: Node = {
        ...node,
        style: finalStyle,
        width: nodeMode !== 'text' ? nodeW : node.width,
        height: nodeMode !== 'text' ? nodeH : node.height,
        measured: dimObj,
        draggable: effectiveEditable,
        selectable: isFrame ? false : true,
        connectable: effectiveEditable,
        selected: isFrame ? false : node.selected,
        // Ref: CR-152 標示框墊最底(-1)，框身可拖但搶不走卡片、收納盒與關聯線的點擊
        zIndex: isFrame
          ? -1
          : selected
            ? 50
            : nodeMode === 'box'
              ? 2
              : node.parentId
                ? 25
                : 20,
        data: {
          ...node.data,
          isSelected: selected,
          onEdit: effectiveEditable ? handleEditNode : undefined,
          onDelete: effectiveEditable ? handleDeleteNode : undefined,
        },
      }
      nextCache.set(node.id, { src: node, selected, out })
      return out
    })
    nodeViewCacheRef.current = nextCache
    return orderParentNodesFirst(mapped)
  }, [nodes, selectedNodeId, effectiveEditable, handleEditNode, handleDeleteNode])

  const handleEdgeClick = useCallback((_e: React.MouseEvent | null, edge: Edge) => {
    if (!effectiveEditable) return
    if (consumeEdgeDragGuard()) return
    setConfirmDeleteEdge({
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      text: ((edge.data as FlowEdgeData | undefined)?.text as string) || '',
      color: ((edge.data as any)?.color as string) || (edge.style?.stroke as string) || '#4f46e5',
    })
  }, [effectiveEditable])

  const handleEdgeClickRef = useRef(handleEdgeClick)
  handleEdgeClickRef.current = handleEdgeClick

  const styledEdges = useMemo(() => {
    const handlers: unknown[] = [
      effectiveEditable,
      handleSaveEdgeText,
      handleWaypointChange,
      handleWaypointReset,
      beginInteraction,
      endInteraction,
    ]
    const handlersChanged =
      edgeHandlersRef.current.length !== handlers.length ||
      handlers.some((h, i) => edgeHandlersRef.current[i] !== h)
    edgeHandlersRef.current = handlers
    const prevCache = handlersChanged ? new Map<string, { src: Edge; out: Edge }>() : edgeViewCacheRef.current
    const nextCache = new Map<string, { src: Edge; out: Edge }>()

    const mapped = edges.map((e) => {
      const edgeColor = (e.data as any)?.color || (e.style?.stroke as string) || '#4f46e5'
      const edgeStyleAndMarker = getEdgeStyleAndMarker(e.sourceHandle, edgeColor)
      const obstacles = e.data?.waypoint ? [] : getObstaclesFromNodes(nodes, e.source, e.target)
      const out: Edge = {
        ...e,
        ...edgeStyleAndMarker,
        type: 'flowEdge',
        animated: false,
        data: {
          ...(e.data || {}),
          color: edgeColor,
          obstacles,
          isConnectable: effectiveEditable,
          onSaveText: effectiveEditable ? handleSaveEdgeText : undefined,
          onWaypointChange: effectiveEditable ? handleWaypointChange : undefined,
          onWaypointReset: effectiveEditable ? handleWaypointReset : undefined,
          onWaypointDragStart: effectiveEditable ? beginInteraction : undefined,
          onWaypointDragEnd: effectiveEditable ? endInteraction : undefined,
          onEdgeClick: effectiveEditable ? () => handleEdgeClickRef.current?.(null, e) : undefined,
        },
        style: {
          ...edgeStyleAndMarker.style,
          stroke: edgeColor,
          strokeWidth: 2,
          opacity: 1,
        },
        markerEnd: {
          ...edgeStyleAndMarker.markerEnd,
          color: edgeColor,
        },
      }
      nextCache.set(e.id, { src: e, out })
      return out
    })

    edgeViewCacheRef.current = nextCache
    return mapped
  }, [nodes, edges, effectiveEditable, handleSaveEdgeText, handleWaypointChange, handleWaypointReset, beginInteraction, endInteraction])

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* 頂部獨立工具列 */}
      <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5 shrink-0">
            <span>🗺️</span> {T.flow.systemFlow.title}
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

          <span className="text-xs text-slate-400 dark:text-slate-500 hidden md:inline truncate">
            {T.flow.systemFlow.subtitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {effectiveEditable && (
            <>
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>➕</span> {T.flow.systemFlow.addStep}
              </button>
              <button
                type="button"
                onClick={handleAddBox}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>📦</span> {T.flow.systemFlow.addBox}
              </button>
              <button
                type="button"
                onClick={handleAddText}
                title={T.flow.shared.annotation.addTextHint}
                className="flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>📝</span> {T.flow.shared.annotation.addText}
              </button>
              <button
                type="button"
                onClick={handleAddFrame}
                title={T.flow.systemFlow.addFrameHint}
                className="flex items-center gap-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>🏷️</span> {T.flow.shared.annotation.addFrame}
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

      {/* 多頁面切換標籤列 (Page Tabs) */}
      <div className="h-10 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 px-4 flex items-center gap-1.5 overflow-x-auto select-none z-10 shrink-0">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 shrink-0 flex items-center gap-1">
          <span>📄</span> {T.flow.systemFlow.pagesLabel}
        </span>

        {pages.map((p, idx) => {
          const isActive = p.id === activePageId
          const isEditing = editingPageId === p.id
          const nodeCount = p.id === activePageId ? nodes.length : p.nodes.length
          const isDragging = draggedTabId === p.id
          const isDragOver = dragOverTabId === p.id && !isDragging

          return (
            <div
              key={p.id}
              draggable={effectiveEditable && !isEditing}
              onDragStart={(e) => {
                if (!effectiveEditable) return
                setDraggedTabId(p.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', p.id)
              }}
              onDragOver={(e) => {
                if (!effectiveEditable) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragOverTabId !== p.id) setDragOverTabId(p.id)
              }}
              onDragLeave={() => {
                if (dragOverTabId === p.id) setDragOverTabId(null)
              }}
              onDrop={(e) => {
                if (!effectiveEditable) return
                e.preventDefault()
                handleReorderTabs(draggedTabId, p.id)
              }}
              onDragEnd={() => {
                setDraggedTabId(null)
                setDragOverTabId(null)
              }}
              onClick={() => {
                if (!isActive && !isEditing) handleSwitchPage(p.id)
              }}
              onDoubleClick={() => {
                if (effectiveEditable) handleStartRenamePage(p.id, p.title)
              }}
              className={cx(
                'group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer border shrink-0',
                isDragging && 'opacity-40 scale-95',
                isDragOver && 'border-blue-500 ring-2 ring-blue-400/50 bg-blue-50/50 dark:bg-blue-950/40',
                isActive
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700/80 shadow-xs ring-1 ring-blue-500/20'
                  : 'bg-white/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              {/* 拖曳手柄圖示 */}
              {effectiveEditable && (
                <span
                  className="text-[10px] text-slate-400/80 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing select-none"
                  title={T.flow.systemFlow.tabDragHint}
                >
                  ⠿
                </span>
              )}

              {isEditing ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleFinishRenamePage}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRenamePage()
                    if (e.key === 'Escape') setEditingPageId(null)
                  }}
                  autoFocus
                  className="w-24 bg-transparent outline-none border-b border-blue-500 text-xs font-bold text-slate-900 dark:text-slate-100 py-0.5"
                />
              ) : (
                <>
                  <span className="truncate max-w-[120px] font-semibold">{p.title}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {T.flow.systemFlow.nodeCount(nodeCount)}
                  </span>

                  {/* 常駐刪除按鈕 (刪除最後一個分頁時將自動產生全新空白分頁) */}
                  {effectiveEditable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeletePage(p)
                      }}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded p-0.5 transition ml-0.5 cursor-pointer font-bold text-xs flex items-center justify-center w-4 h-4 shrink-0"
                      title={T.flow.systemFlow.tabDelete}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}

        {effectiveEditable && (
          <button
            type="button"
            onClick={handleAddPage}
            className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1 text-xs font-medium transition cursor-pointer shrink-0"
            title={T.flow.systemFlow.addPageTitle}
          >
            <span>➕</span> {T.flow.systemFlow.addPage}
          </button>
        )}
      </div>

      {/* 畫布主體 */}
      <div className="relative flex-1 w-full h-full min-h-0">
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => {
            // Ref: CR-140 拖折點時不要順手清掉選取
            if (consumeEdgeDragGuard()) return
            setSelectedNodeId(null)
          }}
          onEdgeClick={handleEdgeClick}
          onMoveEnd={handleMoveEnd}
          connectionMode={ConnectionMode.Loose}
          // Ref: CR-140 拉線當下的預覽線也要直角
          connectionLineType={ConnectionLineType.Step}
          connectionRadius={30}
          defaultViewport={savedViewport}
          fitView={!savedViewport}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.05}
          maxZoom={2.5}
          nodesDraggable={effectiveEditable}
          nodesConnectable={effectiveEditable}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnPinch={true}
          panOnScroll={false}
          preventScrolling={true}
          elevateEdgesOnSelect={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" className="dark:opacity-30" />
          <Controls
            showZoom={false}
            showFitView={false}
            showInteractive={false}
            className="!bg-white dark:!bg-slate-800 !border !border-slate-200 dark:!border-slate-700 !shadow-lg !rounded-xl overflow-hidden [&_button]:!bg-white dark:[&_button]:!bg-slate-800 [&_button]:!text-slate-700 dark:[&_button]:!text-slate-200 [&_button]:!border-b [&_button]:!border-slate-100 dark:[&_button]:!border-slate-700/60 hover:[&_button]:!bg-slate-100 dark:hover:[&_button]:!bg-slate-700"
          >
            <ControlButton onClick={() => zoomIn({ duration: 300 })} title={T.flow.shared.zoomIn} aria-label={T.flow.shared.zoomIn}>
              <span className="text-sm font-bold select-none">➕</span>
            </ControlButton>
            <ControlButton onClick={() => zoomOut({ duration: 300 })} title={T.flow.shared.zoomOut} aria-label={T.flow.shared.zoomOut}>
              <span className="text-sm font-bold select-none">➖</span>
            </ControlButton>
            <ControlButton
              onClick={() => {
                if (nodes.length === 0) {
                  setCenter(0, 0, { zoom: 1, duration: 300 })
                  return
                }
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
              }}
              title={T.flow.shared.centerTitle}
              aria-label={T.flow.shared.center}
            >
              <span className="text-sm select-none">🎯</span>
            </ControlButton>
            <ControlButton
              onClick={() => fitView({ padding: 0.12, duration: 350, minZoom: 0.05 })}
              title={T.flow.systemFlow.fitAllTitle}
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
              title={T.flow.systemFlow.legendTitle}
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
                <span>{T.flow.systemFlow.help.title}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">{T.flow.systemFlow.help.subtitle}</span>
            </div>

            <div className="space-y-3 leading-relaxed text-slate-600 dark:text-slate-300">
              {/* 流程節點 */}
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1">
                  <span>📦</span> {T.flow.systemFlow.help.nodeSection}
                </div>
                <div className="space-y-1 pl-1 text-[11px]">
                  <p className="flex items-start gap-1.5">
                    <span className="shrink-0 font-semibold text-blue-600 dark:text-blue-400">{T.flow.systemFlow.help.step}</span>{T.flow.systemFlow.help.stepDesc}
                  </p>
                  <p className="flex items-start gap-1.5">
                    <span className="shrink-0 font-semibold text-indigo-600 dark:text-indigo-400">{T.flow.systemFlow.help.box}</span>{T.flow.systemFlow.help.boxDesc}
                  </p>
                  {/* Ref: CR-140 */}
                  <p className="flex items-start gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600 dark:text-slate-300">{T.flow.systemFlow.help.text}</span>{T.flow.systemFlow.help.textDesc}
                  </p>
                  <p className="flex items-start gap-1.5">
                    <span className="shrink-0 font-semibold text-violet-600 dark:text-violet-400">{T.flow.systemFlow.help.frame}</span>{T.flow.systemFlow.help.frameDesc}
                  </p>
                </div>
              </div>

              {/* 連接點與線條 */}
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1">
                  <span>🔗</span> {T.flow.systemFlow.help.edgeSection}
                </div>
                <div className="space-y-1 pl-1 text-[11px]">
                  <p className="flex items-start gap-1.5">
                    <span className="shrink-0 font-semibold text-indigo-600 dark:text-indigo-400">{T.flow.systemFlow.help.freeConnection}</span>{T.flow.systemFlow.help.freeConnectionDesc}
                  </p>
                  {/* Ref: CR-140 */}
                  <p className="flex items-start gap-1.5">
                    <span className="shrink-0 font-semibold">{T.flow.systemFlow.help.clickEdge}</span>{T.flow.systemFlow.help.clickEdgeDesc}
                  </p>
                  <p className="flex items-start gap-1.5">
                    <span className="shrink-0 font-semibold">{T.flow.systemFlow.help.arrow}</span>{T.flow.systemFlow.help.arrowDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 編輯節點 Modal */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span>✏️</span>{' '}
              {editingNode.mode === 'text'
                ? T.flow.shared.annotation.editTextTitle
                : editingNode.mode === 'frame'
                  ? T.flow.shared.annotation.editFrameTitle
                  : T.flow.systemFlow.editNodeContent}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {editingNode.mode === 'text'
                    ? T.flow.shared.annotation.fieldTextContent
                    : editingNode.mode === 'frame'
                      ? T.flow.shared.annotation.fieldFrameLabel
                      : T.flow.systemFlow.fieldNodeLabel}
                </label>
                {/* Ref: CR-140 */}
                {editingNode.mode === 'text' ? (
                  <textarea
                    value={editingNode.label}
                    onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                    placeholder={T.flow.shared.annotation.textPlaceholder}
                  />
                ) : (
                  <input
                    type="text"
                    value={editingNode.label}
                    onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder={T.flow.systemFlow.nodeLabelPlaceholder}
                  />
                )}
              </div>

              {(editingNode.mode === 'step' || editingNode.mode === 'box') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {T.flow.systemFlow.fieldDesc}
                  </label>
                  <textarea
                    value={editingNode.desc}
                    onChange={(e) => setEditingNode({ ...editingNode, desc: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                    placeholder={T.flow.systemFlow.descPlaceholder}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {editingNode.mode === 'text'
                    ? T.flow.shared.annotation.fieldTextColor
                    : editingNode.mode === 'frame'
                      ? T.flow.shared.annotation.fieldFrameColor
                      : T.flow.systemFlow.fieldThemeColor}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.color}
                      type="button"
                      onClick={() => setEditingNode({ ...editingNode, color: opt.color })}
                      className={cx(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer',
                        editingNode.color === opt.color
                          ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-50/50 dark:bg-blue-950/40 text-slate-800 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                      <span className="truncate">{opt.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNode(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {T.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition cursor-pointer"
              >
                {T.flow.systemFlow.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除連線確認 Modal */}
      {confirmDeleteEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>🔗</span> {T.flow.systemFlow.edgeModalTitle}
            </h3>

            {/* Ref: CR-140 連線文字 (留空即不顯示標籤) */}
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {T.flow.systemFlow.fieldEdgeText}
            </label>
            <input
              type="text"
              value={confirmDeleteEdge.text}
              onChange={(e) => setConfirmDeleteEdge({ ...confirmDeleteEdge, text: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder={T.flow.systemFlow.edgeTextPlaceholder}
            />
            <p className="mt-1.5 mb-3 text-[11px] text-slate-500 dark:text-slate-400">
              {T.flow.systemFlow.edgeTextHelp}
            </p>

            {/* 連線顏色選擇 */}
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              連線顏色
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {EDGE_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.color}
                  type="button"
                  onClick={() => setConfirmDeleteEdge({ ...confirmDeleteEdge, color: opt.color })}
                  className={cx(
                    'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition',
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

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setEdges((eds) => eds.filter((e) => e.id !== confirmDeleteEdge.edgeId))
                  setConfirmDeleteEdge(null)
                }}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer shadow-xs"
              >
                {T.flow.systemFlow.deleteEdge}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteEdge(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {T.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveEdgeProperties(confirmDeleteEdge.edgeId, confirmDeleteEdge.text, confirmDeleteEdge.color)
                    setConfirmDeleteEdge(null)
                  }}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer shadow-xs"
                >
                  {T.flow.systemFlow.saveChanges}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 刪除流程頁面確認 Modal */}
      {confirmDeletePage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <span>🗑️</span> {T.flow.systemFlow.deletePageTitle}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              {T.flow.systemFlow.deletePageMessage.before}<strong>{confirmDeletePage.title}</strong>{T.flow.systemFlow.deletePageMessage.after}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePage(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {T.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleDeletePage(confirmDeletePage.id)}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer shadow-xs"
              >
                {T.flow.shared.confirmDelete}
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
        canvasKey="system-flow"
        canvasTitle={T.flow.systemFlow.title || '系統流程圖'}
      />
    </div>
  )
}

export default function SystemFlow(props: SystemFlowProps) {
  return (
    <ReactFlowProvider>
      <SystemFlowInner {...props} />
    </ReactFlowProvider>
  )
}
