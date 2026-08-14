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
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cx } from '../components/ui'

export interface SystemFlowProps {
  projectId?: string
}

export type FlowNodeType = 'step' | 'box'

export interface FlowNodeData extends Record<string, unknown> {
  label: string
  desc?: string
  color: string
  mode: FlowNodeType
  isSelected?: boolean
  onEdit?: (nodeId: string) => void
  onDelete?: (nodeId: string) => void
}

const COLOR_OPTIONS = [
  { name: '藍色 (處理/服務)', color: '#3b82f6' },
  { name: '綠色 (起點/成功)', color: '#10b981' },
  { name: '紫色 (模組/邏輯)', color: '#8b5cf6' },
  { name: '琥珀 (判斷/驗證)', color: '#f59e0b' },
  { name: '紅色 (錯誤/終點)', color: '#ef4444' },
  { name: '灰色 (資料/儲存)', color: '#64748b' },
]

function getEdgeStyleAndMarker(sourceHandle?: string | null) {
  const isLeftRight = !sourceHandle || sourceHandle.includes('left') || sourceHandle.includes('right')
  const strokeColor = isLeftRight ? '#ef4444' : '#8b5cf6'
  return {
    animated: false,
    style: {
      strokeWidth: 2,
      stroke: strokeColor,
      strokeDasharray: isLeftRight ? 'none' : '5 5',
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

function orderParentNodesFirst(nodes: Node[]): Node[] {
  const parents: Node[] = []
  const children: Node[] = []
  const independent: Node[] = []

  const boxIds = new Set(nodes.filter((n) => n.type === 'box').map((n) => n.id))

  nodes.forEach((n) => {
    if (n.type === 'box') {
      parents.push(n)
    } else if (n.parentId && boxIds.has(n.parentId)) {
      children.push(n)
    } else {
      independent.push(n)
    }
  })

  return [...parents, ...independent, ...children]
}

// 系統流程圖：模組/收納盒節點
function FlowBoxNode({ id, data, isConnectable }: NodeProps) {
  const nodeData = data as FlowNodeData
  return (
    <div className="relative w-full h-full group">
      {/* 四向連接點 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-in"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-out"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />

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
          <div className="px-3.5 py-2 border-b border-indigo-200/60 dark:border-indigo-900/60 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-base shrink-0">📦</span>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                {nodeData.label || '系統模組容器'}
              </span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  nodeData.onEdit?.(id)
                }}
                title="編輯模組名稱與顏色"
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
                title="刪除模組容器"
                className="p-1 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition cursor-pointer"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>

        {/* 底部邊界縮放控制柄 */}
        <NodeResizeControl
          minWidth={320}
          minHeight={220}
          style={{ background: 'transparent', border: 'none' }}
          className="nodrag"
        >
          <div className="absolute right-1 bottom-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs select-none cursor-se-resize p-1">
            ↘
          </div>
        </NodeResizeControl>
      </div>
    </div>
  )
}

// 系統流程圖：流程步驟/卡片節點
function FlowStepNode({ id, data, isConnectable }: NodeProps) {
  const nodeData = data as FlowNodeData
  return (
    <div className="relative group">
      {/* 四向連接點 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        style={{ top: '50%', backgroundColor: '#ef4444' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-in"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-out"
        style={{ left: '50%', backgroundColor: '#8b5cf6' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900 !z-30 cursor-crosshair nodrag"
        isConnectable={isConnectable}
      />

      <div
        className={cx(
          'min-w-[240px] max-w-[360px] rounded-xl border bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg transition-all duration-150 select-none cursor-grab active:cursor-grabbing overflow-hidden',
          nodeData.isSelected ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-xl' : 'border-slate-200 dark:border-slate-800'
        )}
      >
        {/* 頂部彩色條 */}
        <div className="h-1.5 rounded-t-xl" style={{ backgroundColor: nodeData.color || '#3b82f6' }} />

        <div className="p-3.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-base shrink-0">⚡</span>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                {nodeData.label || '流程步驟'}
              </span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  nodeData.onEdit?.(id)
                }}
                title="編輯節點"
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
                title="刪除節點"
                className="p-1 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition cursor-pointer"
              >
                🗑️
              </button>
            </div>
          </div>

          {nodeData.desc && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
              {nodeData.desc}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const nodeTypes = {
  step: FlowStepNode,
  box: FlowBoxNode,
}

const INITIAL_NODES: Node[] = [
  {
    id: 'node-1',
    type: 'step',
    position: { x: 80, y: 160 },
    data: { label: '客戶端請求 (Client)', desc: '發起 API 呼叫與身分憑證', color: '#10b981', mode: 'step' },
  },
  {
    id: 'box-1',
    type: 'box',
    position: { x: 380, y: 80 },
    style: { width: 360, height: 280 },
    data: { label: '應用後端服務 (Backend Service)', color: '#8b5cf6', mode: 'box' },
  },
  {
    id: 'node-2',
    type: 'step',
    parentId: 'box-1',
    position: { x: 30, y: 70 },
    data: { label: 'API 閘道 (Gateway)', desc: '權限驗證與速率限制', color: '#3b82f6', mode: 'step' },
  },
  {
    id: 'node-3',
    type: 'step',
    parentId: 'box-1',
    position: { x: 30, y: 160 },
    data: { label: '業務邏輯核心 (Controller)', desc: '資料處理與流程排程', color: '#8b5cf6', mode: 'step' },
  },
  {
    id: 'node-4',
    type: 'step',
    position: { x: 820, y: 160 },
    data: { label: '資料庫 (PostgreSQL)', desc: '持久化資料存取與交易', color: '#64748b', mode: 'step' },
  },
]

const INITIAL_EDGES: Edge[] = [
  {
    id: 'e1-2',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
  {
    id: 'e2-3',
    source: 'node-2',
    target: 'node-3',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    ...getEdgeStyleAndMarker('bottom-out'),
  },
  {
    id: 'e3-4',
    source: 'node-3',
    target: 'node-4',
    sourceHandle: 'right-out',
    targetHandle: 'left-in',
    ...getEdgeStyleAndMarker('right-out'),
  },
]

function SystemFlowInner({ projectId = 'default' }: SystemFlowProps) {
  const storageKey = `pmflow_system_flow_canvas_${projectId}`
  const { fitView } = useReactFlow()

  const [nodes, setNodes] = useState<Node[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          return orderParentNodesFirst(parsed.nodes)
        }
      }
    } catch {
      // ignore
    }
    return orderParentNodesFirst(INITIAL_NODES)
  })

  const [edges, setEdges] = useState<Edge[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.edges && Array.isArray(parsed.edges)) {
          return parsed.edges.map((e: Edge) => ({
            ...e,
            ...getEdgeStyleAndMarker(e.sourceHandle),
          }))
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_EDGES
  })

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<{ id: string; label: string; desc: string; color: string } | null>(null)
  const [confirmDeleteEdge, setConfirmDeleteEdge] = useState<{ edgeId: string; source: string; target: string } | null>(null)

  // 自動保存至獨立 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ nodes, edges }))
    } catch {
      // ignore
    }
  }, [nodes, edges, storageKey])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    const edgeStyleAndMarker = getEdgeStyleAndMarker(params.sourceHandle)
    const newEdge: Edge = {
      ...params,
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...edgeStyleAndMarker,
    }
    setEdges((eds) => addEdge(newEdge, eds))
  }, [])

  // 拖曳結束判斷：拖入容器收納 / 拖出容器為獨立節點
  const onNodeDragStop = useCallback((_event: unknown, draggedNode: Node) => {
    if (draggedNode.type !== 'step') return

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
  }, [])

  const handleEditNode = useCallback((nodeId: string) => {
    setNodes((currentNodes) => {
      const target = currentNodes.find((n) => n.id === nodeId)
      if (target) {
        const data = target.data as FlowNodeData
        setEditingNode({
          id: nodeId,
          label: data.label || '',
          desc: data.desc || '',
          color: data.color || '#3b82f6',
        })
      }
      return currentNodes
    })
  }, [])

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId && n.parentId !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
  }, [selectedNodeId])

  const handleSaveEdit = () => {
    if (!editingNode) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === editingNode.id
          ? {
              ...n,
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

  // 新增步驟節點
  const handleAddStep = () => {
    const newId = `step-${Date.now()}`
    const newNode: Node = {
      id: newId,
      type: 'step',
      position: { x: 200 + Math.random() * 80, y: 150 + Math.random() * 80 },
      data: {
        label: '新流程步驟',
        desc: '點擊 ✏️ 編輯內容描述',
        color: '#3b82f6',
        mode: 'step',
      },
    }
    setNodes((nds) => orderParentNodesFirst([...nds, newNode]))
    setSelectedNodeId(newId)
  }

  // 新增模組容器盒
  const handleAddBox = () => {
    const newId = `box-${Date.now()}`
    const newNode: Node = {
      id: newId,
      type: 'box',
      position: { x: 180 + Math.random() * 60, y: 100 + Math.random() * 60 },
      style: { width: 360, height: 260 },
      data: {
        label: '新系統模組',
        color: '#8b5cf6',
        mode: 'box',
      },
    }
    setNodes((nds) => orderParentNodesFirst([newNode, ...nds]))
    setSelectedNodeId(newId)
  }

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      draggable: true,
      selectable: true,
      zIndex: node.id === selectedNodeId ? 30 : node.parentId ? 10 : (node.data as FlowNodeData)?.mode === 'box' ? 1 : 5,
      data: {
        ...node.data,
        isSelected: node.id === selectedNodeId,
        onEdit: handleEditNode,
        onDelete: handleDeleteNode,
      },
    }))
  }, [nodes, selectedNodeId, handleEditNode, handleDeleteNode])

  const styledEdges = useMemo(() => {
    return edges.map((e) => {
      const edgeStyleAndMarker = getEdgeStyleAndMarker(e.sourceHandle)
      return {
        ...e,
        ...edgeStyleAndMarker,
        animated: false,
        style: {
          ...edgeStyleAndMarker.style,
          strokeWidth: 2,
          opacity: 1,
        },
      }
    })
  }, [edges])

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* 頂部獨立工具列 */}
      <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>🗺️</span> 系統流程圖
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
            | 獨立系統架構繪圖
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddStep}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span>➕</span> 新增流程步驟
          </button>
          <button
            type="button"
            onClick={handleAddBox}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>📦</span> 新增模組容器
          </button>
          <button
            type="button"
            onClick={() => fitView({ padding: 0.2, duration: 400 })}
            className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
            title="縮放並置中畫布"
          >
            🎯 視野對焦
          </button>
        </div>
      </div>

      {/* 畫布主體 */}
      <div className="relative flex-1 cursor-move">
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          onEdgeClick={(_e, edge) => {
            setConfirmDeleteEdge({
              edgeId: edge.id,
              source: edge.source,
              target: edge.target,
            })
          }}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2.5}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" className="dark:opacity-30" />
          <Controls showInteractive={false} className="!bg-white dark:!bg-slate-800 !border !border-slate-200 dark:!border-slate-700 !shadow-lg !rounded-xl overflow-hidden">
            <ControlButton onClick={() => fitView({ padding: 0.2, duration: 400 })} title="置中全部">
              <span className="text-slate-700 dark:text-slate-200 text-sm">🎯</span>
            </ControlButton>
          </Controls>
        </ReactFlow>
      </div>

      {/* 編輯節點 Modal */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span>✏️</span> 編輯節點內容
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  節點標題
                </label>
                <input
                  type="text"
                  value={editingNode.label}
                  onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="例如：API 閘道 (Gateway)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  詳細說明 (選填)
                </label>
                <textarea
                  value={editingNode.desc}
                  onChange={(e) => setEditingNode({ ...editingNode, desc: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                  placeholder="補充說明此步驟或模組之功能職責…"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  主題識別色
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
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition cursor-pointer"
              >
                儲存變更
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除連線確認 Modal */}
      {confirmDeleteEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <span>🗑️</span> 刪除流程連線
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              是否確定要刪除這條流程連接線？
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteEdge(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setEdges((eds) => eds.filter((e) => e.id !== confirmDeleteEdge.edgeId))
                  setConfirmDeleteEdge(null)
                }}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer shadow-xs"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
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
