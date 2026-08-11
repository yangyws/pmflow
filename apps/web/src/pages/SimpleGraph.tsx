import { useState, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
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
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Task } from '../lib/api'

export type NodeMode = 'card' | 'box'

export type SimpleGraphNodeData = {
  label: string
  refText?: string
  mode: NodeMode
  onToggleMode?: (id: string) => void
}

export type CustomSimpleNode = Node<SimpleGraphNodeData, 'simpleNode'>

// 計算收納盒裝載 N 張卡片所需的最適尺寸
function computeBoxSize(kidCount: number, currentW = 340, currentH = 260) {
  if (kidCount === 0) return { width: 340, height: 260 }
  const cols = Math.ceil(kidCount / 5)
  const rows = Math.min(kidCount, 5)
  const reqW = 24 + cols * 280 + 24
  const reqH = 50 + rows * 100 + 20
  return {
    width: Math.max(currentW, reqW),
    height: Math.max(currentH, reqH),
  }
}

// 自由切換的節點 UI (包含四向雙向 Handle 接點，允許上下左右任意拉線)
function SimpleNodeView({ id, data }: NodeProps<CustomSimpleNode>) {
  const isBox = data.mode === 'box'

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onToggleMode?.(id)
  }

  return (
    <div className="relative w-full h-full">
      {/* 接點 (Handles) - 上下左右 4 個方向皆為 Loose 雙向接點，z-index 提高確保拖曳無阻礙 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-out"
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right-in"
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />

      <Handle
        type="target"
        position={Position.Top}
        id="top-in"
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-out"
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-in"
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-out"
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair"
      />

      {isBox ? (
        <div className="relative w-full h-full min-w-[320px] min-h-[220px] rounded-xl border-2 border-dashed border-indigo-400/80 bg-indigo-50/40 p-3 dark:border-indigo-500/60 dark:bg-indigo-950/20 select-none shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-indigo-200/60 pb-1.5 dark:border-indigo-800/60">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                  {data.refText || 'MRG-BOX'}
                </span>
                <button
                  type="button"
                  onClick={handleToggle}
                  className="rounded bg-indigo-100 hover:bg-indigo-200 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 dark:hover:bg-indigo-800 transition-colors cursor-pointer border border-indigo-300 dark:border-indigo-700"
                  title="【點擊切換】為卡片"
                >
                  📦 收納盒
                </button>
              </div>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Box</span>
            </div>
            <div className="mt-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              {data.label || '收納盒'}
            </div>
          </div>

          <div className="mb-2 text-center text-xs text-indigo-400/70 dark:text-indigo-400/40 select-none">
            (正交 90 度折線，自動避開穿透)
          </div>

          {/* 右下角縮放控制鈕 */}
          <NodeResizeControl
            position="bottom-right"
            minWidth={320}
            minHeight={220}
            style={{
              position: 'absolute',
              right: '12px',
              bottom: '12px',
              transform: 'none',
              width: '20px',
              height: '20px',
              border: 'none',
              background: 'transparent',
              zIndex: 10,
            }}
          >
            <div
              className="w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded bg-indigo-200/90 dark:bg-indigo-800/90 hover:bg-indigo-300 dark:hover:bg-indigo-700 text-indigo-800 dark:text-indigo-200 border border-indigo-400/80 dark:border-indigo-600/80 cursor-se-resize shadow-xs select-none"
              title="按住拖曳調整收納盒尺寸"
            >
              ↘
            </div>
          </NodeResizeControl>
        </div>
      ) : (
        <div className="w-64 rounded-lg border border-slate-300 bg-white p-3 shadow-sm hover:shadow-md transition-shadow dark:border-slate-700 dark:bg-slate-800 select-none">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                {data.refText || 'MRG-1'}
              </span>
              <button
                type="button"
                onClick={handleToggle}
                className="rounded bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer border border-slate-200 dark:border-slate-600"
                title="【點擊切換】為收納盒"
              >
                📦 卡片
              </button>
            </div>
            <span className="text-xs text-slate-400 font-mono">Card</span>
          </div>
          <div className="mt-2 font-medium text-slate-800 text-sm dark:text-slate-200">
            {data.label || '無標題任務'}
          </div>
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  simpleNode: SimpleNodeView,
}

const initialNodes: Node[] = [
  {
    id: 'box-1',
    type: 'simpleNode',
    position: { x: 50, y: 80 },
    style: { width: 340, height: 260 },
    data: { label: '專案核心組件收納盒', refText: 'MRG-1', mode: 'box' },
  },
  {
    id: 'box-2',
    type: 'simpleNode',
    position: { x: 450, y: 80 },
    style: { width: 340, height: 260 },
    data: { label: '後端服務收納盒', refText: 'MRG-2', mode: 'box' },
  },
  {
    id: 'card-1',
    type: 'simpleNode',
    parentId: 'box-1',
    position: { x: 24, y: 50 },
    data: { label: '設計 Graph View 基礎 UI', refText: 'MRG-3', mode: 'card' },
  },
  {
    id: 'card-2',
    type: 'simpleNode',
    parentId: 'box-1',
    position: { x: 24, y: 150 },
    data: { label: '實作純拖曳功能', refText: 'MRG-4', mode: 'card' },
  },
  {
    id: 'card-3',
    type: 'simpleNode',
    position: { x: 850, y: 120 },
    data: { label: '串接 API 與狀態管理', refText: 'MRG-5', mode: 'card' },
  },
]

const initialEdges: Edge[] = [
  {
    id: 'edge-box1-box2',
    source: 'box-1',
    sourceHandle: 'right-out',
    target: 'box-2',
    targetHandle: 'left-in',
    type: 'smoothstep',
    animated: true,
  },
]

export interface SimpleGraphProps {
  projectId?: string
  tasks?: Task[]
  onOpenTask?: (taskId: string) => void
}

export default function SimpleGraph({ projectId, tasks }: SimpleGraphProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const dragStartPosMap = useRef<Record<string, { x: number; y: number }>>({})

  const handleToggleMode = useCallback((nodeId: string) => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === nodeId) {
          const currentMode = (n.data as SimpleGraphNodeData).mode
          const nextMode: NodeMode = currentMode === 'box' ? 'card' : 'box'
          return {
            ...n,
            style: nextMode === 'box' ? { width: 340, height: 260 } : undefined,
            data: {
              ...n.data,
              mode: nextMode,
            },
          }
        }
        return n
      })
    )
  }, [])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: true,
          },
          eds
        )
      ),
    []
  )

  const onNodeDragStart = useCallback((_: unknown, node: Node) => {
    dragStartPosMap.current[node.id] = { ...node.position }
  }, [])

  // 處理卡片移入 / 移出收納盒判斷與收納盒自動擴大尺寸
  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    const isBoxNode = (node.data as SimpleGraphNodeData)?.mode === 'box'
    if (isBoxNode) return

    setNodes((currentNodes) => {
      const getAbsPos = (nId: string): { x: number; y: number } => {
        const target = currentNodes.find((cn) => cn.id === nId)
        if (!target) return { x: 0, y: 0 }
        if (target.parentId) {
          const parentAbs = getAbsPos(target.parentId)
          return { x: parentAbs.x + target.position.x, y: parentAbs.y + target.position.y }
        }
        return { ...target.position }
      }

      const cardAbsPos = getAbsPos(node.id)
      const cardWidth = 256
      const cardHeight = 84
      const cardCenterX = cardAbsPos.x + cardWidth / 2
      const cardCenterY = cardAbsPos.y + cardHeight / 2

      const boxNodes = currentNodes.filter((cn) => (cn.data as SimpleGraphNodeData)?.mode === 'box')

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

      if (!targetBox && currentParentId) {
        const oldBox = currentNodes.find((cn) => cn.id === currentParentId)
        const remainingKids = currentNodes.filter((cn) => cn.parentId === currentParentId && cn.id !== node.id)
        const oldBoxNewSize = computeBoxSize(
          remainingKids.length,
          Number(oldBox?.style?.width ?? 340),
          Number(oldBox?.style?.height ?? 260)
        )

        return currentNodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              parentId: undefined,
              position: cardAbsPos,
            }
          }
          if (n.id === currentParentId) {
            return {
              ...n,
              style: oldBoxNewSize,
            }
          }
          return n
        })
      }

      if (targetBox && targetBox.id !== currentParentId) {
        const existingKids = currentNodes.filter((cn) => cn.parentId === targetBox!.id && cn.id !== node.id)
        const newKidCount = existingKids.length + 1

        const curW = Number(targetBox.style?.width ?? 340)
        const curH = Number(targetBox.style?.height ?? 260)
        const targetBoxNewSize = computeBoxSize(newKidCount, curW, curH)

        const oldBox = currentParentId ? currentNodes.find((cn) => cn.id === currentParentId) : undefined
        const oldBoxRemainingKids = currentParentId
          ? currentNodes.filter((cn) => cn.parentId === currentParentId && cn.id !== node.id)
          : []
        const oldBoxNewSize = oldBox
          ? computeBoxSize(oldBoxRemainingKids.length, Number(oldBox.style?.width ?? 340), Number(oldBox.style?.height ?? 260))
          : undefined

        const kidIndex = existingKids.length
        const cIdx = Math.floor(kidIndex / 5)
        const rIdx = kidIndex % 5
        const slotX = 24 + cIdx * 280
        const slotY = 50 + rIdx * 100

        return currentNodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              parentId: targetBox!.id,
              position: { x: slotX, y: slotY },
            }
          }
          if (n.id === targetBox!.id) {
            return {
              ...n,
              style: targetBoxNewSize,
            }
          }
          if (currentParentId && n.id === currentParentId && oldBoxNewSize) {
            return {
              ...n,
              style: oldBoxNewSize,
            }
          }
          return n
        })
      }

      return currentNodes
    })
  }, [])

  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onToggleMode: handleToggleMode,
    },
  }))

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* 頂部說明列 (行動端彈性折行) */}
      <div className="z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-3 sm:px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 flex-wrap sm:flex-nowrap gap-1 sm:gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
            靶心關聯表 (90 度正交直角避讓連線)
          </span>
          <span className="hidden sm:inline-block text-xs text-slate-400">
            連線採用 90 度正交直角折線，確保離框 16px 自動轉折不穿透卡片與收納盒
          </span>
        </div>
      </div>

      {/* ReactFlow 畫布 (預設 90 度 smoothstep 直角折線避讓) */}
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { strokeWidth: 2, stroke: '#6366f1' },
          }}
          zoomOnPinch={true}
          panOnScroll={false}
          preventScrolling={true}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
