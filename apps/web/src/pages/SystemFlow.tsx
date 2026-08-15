import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { Api } from '../lib/api'
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

// 確保父收納盒節點在 nodes 陣列中優先於子卡片 (對齊 SimpleGraph / Graph: React Flow 要求父節點排在子節點前面，否則子節點座標對不上且會鎖死拖曳)
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
    id: 'box-1',
    type: 'box',
    position: { x: 380, y: 80 },
    style: { width: 380, height: 280 },
    measured: { width: 380, height: 280 },
    data: { label: '應用後端服務 (Backend Service)', color: '#8b5cf6', mode: 'box' },
  },
  {
    id: 'node-1',
    type: 'step',
    position: { x: 60, y: 160 },
    data: { label: '客戶端請求 (Client)', desc: '發起 API 呼叫與身分憑證', color: '#10b981', mode: 'step' },
  },
  {
    id: 'node-2',
    type: 'step',
    parentId: 'box-1',
    position: { x: 30, y: 60 },
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
    position: { x: 840, y: 160 },
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
          title: p.title || `流程頁面 ${idx + 1}`,
          createdById: p.createdById || null,
          createdByName: p.createdByName || null,
          nodes: Array.isArray(p.nodes) ? orderParentNodesFirst(p.nodes) : [],
          edges: Array.isArray(p.edges)
            ? p.edges.map((e: Edge) => ({
                ...e,
                ...getEdgeStyleAndMarker(e.sourceHandle),
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
            title: '主要流程',
            createdById: null,
            createdByName: null,
            nodes: orderParentNodesFirst(parsedLegacy.nodes),
            edges: Array.isArray(parsedLegacy.edges)
              ? parsedLegacy.edges.map((e: Edge) => ({
                  ...e,
                  ...getEdgeStyleAndMarker(e.sourceHandle),
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
      title: '主要流程',
      createdById: null,
      createdByName: null,
      nodes: orderParentNodesFirst(INITIAL_NODES),
      edges: INITIAL_EDGES,
    },
  ]
}

function SystemFlowInner({ projectId = 'default' }: SystemFlowProps) {
  const storageKeyPages = `pmflow_system_flow_pages_${projectId}`
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow()
  const { user } = useAuth()
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => Api.project(projectId),
    enabled: !!projectId && projectId !== 'default',
  })

  const role = project?.members?.find((m) => m.id === user?.id)?.role
  const isManager = role === 'MANAGER'
  const isOwner = role === 'OWNER'
  const isProjectCreator = Boolean(project?.isCreator)

  const [pages, setPages] = useState<FlowPage[]>(() => loadInitialPages(projectId))

  // 建立者以上權限 (專案建立者、Owner、Manager) 或「該分頁建立者」可刪除分頁
  const canDeletePage = useCallback(
    (p?: FlowPage | null) => {
      if (!p || pages.length <= 1) return false
      const isPageCreator = Boolean(p.createdById && user?.id && p.createdById === user.id)
      return isManager || isOwner || isProjectCreator || isPageCreator
    },
    [user?.id, isManager, isOwner, isProjectCreator, pages.length]
  )
  const [activePageId, setActivePageId] = useState<string>(() => {
    const initPages = loadInitialPages(projectId)
    return initPages[0]?.id || 'page-1'
  })

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

  const hasFittedRef = useRef<boolean>(false)

  // 當前畫布的 nodes 與 edges
  const activePage = useMemo(() => {
    return pages.find((p) => p.id === activePageId) || pages[0]
  }, [pages, activePageId])

  const [nodes, setNodes] = useState<Node[]>(() => activePage?.nodes ?? [])
  const [edges, setEdges] = useState<Edge[]>(() => activePage?.edges ?? [])

  // 僅當「完全沒有儲存過 Viewport」時，首次進入才執行 fitView (對齊 SimpleGraph: 確保測量就緒後再置中，避免排版亂掉或無法移動)
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
  const [editingNode, setEditingNode] = useState<{ id: string; label: string; desc: string; color: string } | null>(null)
  const [confirmDeleteEdge, setConfirmDeleteEdge] = useState<{ edgeId: string; source: string; target: string } | null>(null)

  // 頁面重新命名與刪除狀態
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>('')
  const [confirmDeletePage, setConfirmDeletePage] = useState<FlowPage | null>(null)

  // 頁籤拖曳排序狀態
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)

  // 拖曳重排頁籤
  const handleReorderTabs = (sourceId: string | null, targetId: string) => {
    if (!sourceId || sourceId === targetId) return
    setPages((prev) => {
      const srcIdx = prev.findIndex((p) => p.id === sourceId)
      const tgtIdx = prev.findIndex((p) => p.id === targetId)
      if (srcIdx === -1 || tgtIdx === -1) return prev
      const next = [...prev]
      const [removed] = next.splice(srcIdx, 1)
      next.splice(tgtIdx, 0, removed)
      try {
        localStorage.setItem(storageKeyPages, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
    setDraggedTabId(null)
    setDragOverTabId(null)
  }

  // 左右微調移動頁籤
  const handleMoveTab = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= pages.length) return
    setPages((prev) => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      try {
        localStorage.setItem(storageKeyPages, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // 自動同步當前畫布至 pages 狀態與 localStorage
  useEffect(() => {
    setPages((prevPages) => {
      const updated = prevPages.map((p) => {
        if (p.id === activePageId) {
          return { ...p, nodes, edges }
        }
        return p
      })
      try {
        localStorage.setItem(storageKeyPages, JSON.stringify(updated))
      } catch {
        // ignore
      }
      return updated
    })
  }, [nodes, edges, activePageId, storageKeyPages])

  // 切換頁面
  const handleSwitchPage = (targetId: string) => {
    if (targetId === activePageId) return
    const target = pages.find((p) => p.id === targetId)
    if (!target) return
    setActivePageId(targetId)
    setSelectedNodeId(null)
    setNodes(orderParentNodesFirst(target.nodes))
    setEdges(
      target.edges.map((e: Edge) => ({
        ...e,
        ...getEdgeStyleAndMarker(e.sourceHandle),
      }))
    )
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 })
    }, 50)
  }

  // 新增頁面
  const handleAddPage = () => {
    const newId = `page-${Date.now()}`
    const newTitle = `流程頁面 ${pages.length + 1}`
    const newPage: FlowPage = {
      id: newId,
      title: newTitle,
      createdById: user?.id || null,
      createdByName: user?.displayName || user?.email || null,
      nodes: [],
      edges: [],
    }
    const updated = [...pages, newPage]
    setPages(updated)
    setActivePageId(newId)
    setSelectedNodeId(null)
    setNodes([])
    setEdges([])
    try {
      localStorage.setItem(storageKeyPages, JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  // 複製當前頁面
  const handleDuplicatePage = (pageId: string) => {
    const source = pages.find((p) => p.id === pageId)
    if (!source) return
    const sourceNodes = pageId === activePageId ? nodes : source.nodes
    const sourceEdges = pageId === activePageId ? edges : source.edges

    const newId = `page-${Date.now()}`
    const newTitle = `${source.title} (副本)`
    const newPage: FlowPage = {
      id: newId,
      title: newTitle,
      createdById: user?.id || null,
      createdByName: user?.displayName || user?.email || null,
      nodes: JSON.parse(JSON.stringify(sourceNodes)),
      edges: JSON.parse(JSON.stringify(sourceEdges)),
    }
    const updated = [...pages, newPage]
    setPages(updated)
    setActivePageId(newId)
    setSelectedNodeId(null)
    setNodes(newPage.nodes)
    setEdges(newPage.edges)
    try {
      localStorage.setItem(storageKeyPages, JSON.stringify(updated))
    } catch {
      // ignore
    }
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 })
    }, 50)
  }

  // 刪除頁面
  const handleDeletePage = (pageId: string) => {
    const target = pages.find((p) => p.id === pageId)
    if (!target || !canDeletePage(target)) return
    const nextPages = pages.filter((p) => p.id !== pageId)
    setConfirmDeletePage(null)
    if (activePageId === pageId) {
      const nextActive = nextPages[0]
      setActivePageId(nextActive.id)
      setSelectedNodeId(null)
      setNodes(orderParentNodesFirst(nextActive.nodes))
      setEdges(
        nextActive.edges.map((e: Edge) => ({
          ...e,
          ...getEdgeStyleAndMarker(e.sourceHandle),
        }))
      )
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 })
      }, 50)
    }
    setPages(nextPages)
    try {
      localStorage.setItem(storageKeyPages, JSON.stringify(nextPages))
    } catch {
      // ignore
    }
  }

  // 開始重新命名
  const handleStartRenamePage = (id: string, currentTitle: string) => {
    setEditingPageId(id)
    setEditingTitle(currentTitle)
  }

  // 完成重新命名
  const handleFinishRenamePage = () => {
    if (!editingPageId) return
    const trimmed = editingTitle.trim()
    if (trimmed) {
      setPages((prev) => {
        const updated = prev.map((p) => (p.id === editingPageId ? { ...p, title: trimmed } : p))
        try {
          localStorage.setItem(storageKeyPages, JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })
    }
    setEditingPageId(null)
  }

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
    const mapped = nodes.map((node) => ({
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
    return orderParentNodesFirst(mapped)
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
            | 多頁面獨立繪圖
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
        </div>
      </div>

      {/* 多頁面切換標籤列 (Page Tabs) */}
      <div className="h-10 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 px-4 flex items-center gap-1.5 overflow-x-auto select-none z-10 shrink-0">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 shrink-0 flex items-center gap-1">
          <span>📄</span> 流程頁面：
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
              draggable={!isEditing}
              onDragStart={(e) => {
                setDraggedTabId(p.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', p.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragOverTabId !== p.id) setDragOverTabId(p.id)
              }}
              onDragLeave={() => {
                if (dragOverTabId === p.id) setDragOverTabId(null)
              }}
              onDrop={(e) => {
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
              onDoubleClick={() => handleStartRenamePage(p.id, p.title)}
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
              <span
                className="text-[10px] text-slate-400/80 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing select-none"
                title="拖曳排序頁籤"
              >
                ⠿
              </span>

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
                    ({nodeCount} 個節點)
                  </span>

                  {/* 左右微調移動按鈕 */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveTab(idx, -1)
                        }}
                        className="hover:text-blue-600 dark:hover:text-blue-400 text-slate-400 p-0.5 rounded transition cursor-pointer text-[10px]"
                        title="向左移動頁籤"
                      >
                        ◀
                      </button>
                    )}
                    {idx < pages.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveTab(idx, 1)
                        }}
                        className="hover:text-blue-600 dark:hover:text-blue-400 text-slate-400 p-0.5 rounded transition cursor-pointer text-[10px]"
                        title="向右移動頁籤"
                      >
                        ▶
                      </button>
                    )}
                  </div>

                  {/* 重新命名按鈕 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartRenamePage(p.id, p.title)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-blue-600 dark:hover:text-blue-400 text-slate-400 p-0.5 rounded transition cursor-pointer"
                    title="點擊重新命名 (或連點兩下標籤)"
                  >
                    ✏️
                  </button>

                  {/* 複製頁面按鈕 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDuplicatePage(p.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400 p-0.5 rounded transition cursor-pointer"
                    title="複製此頁面"
                  >
                    📑
                  </button>

                  {/* 刪除按鈕 (大於1頁且具備建立者以上權限或分頁建立者時可刪) */}
                  {pages.length > 1 && canDeletePage(p) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeletePage(p)
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 text-slate-400 p-0.5 rounded transition ml-0.5 cursor-pointer font-bold text-sm"
                      title="刪除此流程頁面"
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={handleAddPage}
          className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1 text-xs font-medium transition cursor-pointer shrink-0"
          title="新增流程頁面"
        >
          <span>➕</span> 新增頁面
        </button>
      </div>

      {/* 畫布主體 */}
      <div className="relative flex-1 w-full h-full min-h-0 cursor-move">
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
          onMoveEnd={handleMoveEnd}
          connectionMode={ConnectionMode.Loose}
          defaultViewport={savedViewport}
          fitView={!savedViewport}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2.5}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnPinch={true}
          panOnScroll={false}
          preventScrolling={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" className="dark:opacity-30" />
          <Controls
            showZoom={false}
            showFitView={false}
            showInteractive={false}
            className="!bg-white dark:!bg-slate-800 !border !border-slate-200 dark:!border-slate-700 !shadow-lg !rounded-xl overflow-hidden [&_button]:!bg-white dark:[&_button]:!bg-slate-800 [&_button]:!text-slate-700 dark:[&_button]:!text-slate-200 [&_button]:!border-b [&_button]:!border-slate-100 dark:[&_button]:!border-slate-700/60 hover:[&_button]:!bg-slate-100 dark:hover:[&_button]:!bg-slate-700"
          >
            <ControlButton onClick={() => zoomIn({ duration: 300 })} title="放大畫布" aria-label="放大畫布">
              <span className="text-sm font-bold select-none">➕</span>
            </ControlButton>
            <ControlButton onClick={() => zoomOut({ duration: 300 })} title="縮小畫布" aria-label="縮小畫布">
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
              title="置中視野 (100% 原始比例)"
              aria-label="置中視野"
            >
              <span className="text-sm select-none">🎯</span>
            </ControlButton>
            <ControlButton
              onClick={() => fitView({ padding: 0.15, duration: 350 })}
              title="顯示全部 (縮放容納所有節點)"
              aria-label="顯示全部"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
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

      {/* 刪除流程頁面確認 Modal */}
      {confirmDeletePage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <span>🗑️</span> 刪除流程頁面
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              是否確定要刪除「<strong>{confirmDeletePage.title}</strong>」？此頁面內的全部節點與流程連線將一併移除。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePage(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleDeletePage(confirmDeletePage.id)}
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
