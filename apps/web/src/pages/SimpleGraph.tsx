import { useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  NodeResizeControl,
  type Node,
  type NodeChange,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Task } from '../lib/api'
import { Button } from '../components/ui'

export type NodeMode = 'card' | 'box'

export type SimpleGraphNodeData = {
  label: string
  refText?: string
  mode: NodeMode
  onToggleMode?: (id: string) => void
}

export type CustomSimpleNode = Node<SimpleGraphNodeData, 'simpleNode'>

// 自由切換的節點 UI (包含右下角 ↘ 尺寸縮放按鈕)
function SimpleNodeView({ id, data }: NodeProps<CustomSimpleNode>) {
  const isBox = data.mode === 'box'

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onToggleMode?.(id)
  }

  if (isBox) {
    return (
      <div className="relative w-full h-full min-w-[280px] min-h-[160px] rounded-xl border-2 border-dashed border-indigo-400/80 bg-indigo-50/40 p-3 dark:border-indigo-500/60 dark:bg-indigo-950/20 select-none shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
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
          <div className="mt-3 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            {data.label || '收納盒'}
          </div>
        </div>

        <div className="mb-2 text-center text-xs text-indigo-400/70 dark:text-indigo-400/40">
          (純拖曳收納盒 - 右下角可調整尺寸)
        </div>

        {/* 右下角縮放控制紐 */}
        <NodeResizeControl
          position="bottom-right"
          minWidth={280}
          minHeight={160}
          className="!w-4 !h-4 !bottom-1 !right-1 !border-0 !bg-transparent"
        >
          <div
            className="w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded bg-indigo-200/80 dark:bg-indigo-800/80 hover:bg-indigo-300 dark:hover:bg-indigo-700 text-indigo-700 dark:text-indigo-200 border border-indigo-300/80 dark:border-indigo-600/80 cursor-se-resize shadow-xs select-none"
            title="按住拖曳調整收納盒尺寸"
          >
            ↘
          </div>
        </NodeResizeControl>
      </div>
    )
  }

  return (
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
  )
}

const nodeTypes = {
  simpleNode: SimpleNodeView,
}

const initialNodes: Node[] = [
  {
    id: 'node-1',
    type: 'simpleNode',
    position: { x: 50, y: 80 },
    style: { width: 320, height: 192 },
    data: { label: '專案核心組件收納盒', refText: 'MRG-1', mode: 'box' },
  },
  {
    id: 'node-2',
    type: 'simpleNode',
    position: { x: 420, y: 80 },
    style: { width: 320, height: 192 },
    data: { label: '後端服務收納盒', refText: 'MRG-2', mode: 'box' },
  },
  {
    id: 'node-3',
    type: 'simpleNode',
    position: { x: 80, y: 320 },
    data: { label: '設計 Graph View 基礎 UI', refText: 'MRG-3', mode: 'card' },
  },
  {
    id: 'node-4',
    type: 'simpleNode',
    position: { x: 360, y: 350 },
    data: { label: '實作純拖曳功能', refText: 'MRG-4', mode: 'card' },
  },
  {
    id: 'node-5',
    type: 'simpleNode',
    position: { x: 650, y: 320 },
    data: { label: '串接 API 與狀態管理', refText: 'MRG-5', mode: 'card' },
  },
]

export interface SimpleGraphProps {
  projectId?: string
  tasks?: Task[]
  onOpenTask?: (taskId: string) => void
}

export default function SimpleGraph({ projectId, tasks }: SimpleGraphProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)

  const handleToggleMode = useCallback((nodeId: string) => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === nodeId) {
          const currentMode = (n.data as SimpleGraphNodeData).mode
          const nextMode: NodeMode = currentMode === 'box' ? 'card' : 'box'
          return {
            ...n,
            style: nextMode === 'box' ? { width: 320, height: 192 } : undefined,
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

  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onToggleMode: handleToggleMode,
    },
  }))

  const handleAddCard = () => {
    const newId = `node-${Date.now()}`
    const refNum = nodes.length + 1
    const newNode: Node = {
      id: newId,
      type: 'simpleNode',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: `新增卡片 ${refNum}`, refText: `MRG-${refNum}`, mode: 'card' },
    }
    setNodes((nds) => [...nds, newNode])
  }

  const handleAddBox = () => {
    const newId = `node-${Date.now()}`
    const refNum = nodes.length + 1
    const newNode: Node = {
      id: newId,
      type: 'simpleNode',
      position: { x: 150 + Math.random() * 200, y: 150 + Math.random() * 200 },
      style: { width: 320, height: 192 },
      data: { label: `新增收納盒 ${refNum}`, refText: `MRG-${refNum}`, mode: 'box' },
    }
    setNodes((nds) => [...nds, newNode])
  }

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* 頂部操作列 */}
      <div className="z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            靶心關聯表 (純位移 + 切換 + 縮放)
          </span>
          <span className="text-xs text-slate-400">
            收納盒右下角 (↘) 可按住拖曳調整寬高
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={handleAddCard}>
            + 新增卡片
          </Button>
          <Button variant="primary" onClick={handleAddBox}>
            + 新增收納盒
          </Button>
        </div>
      </div>

      {/* ReactFlow 畫布 */}
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodesWithHandlers}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
