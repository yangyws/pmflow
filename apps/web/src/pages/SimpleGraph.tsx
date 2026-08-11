import { useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Task } from '../lib/api'

export type CardNodeData = { label: string; refText?: string; status?: string }
export type BoxNodeData = { label: string; refText?: string }

export type CustomCardNode = Node<CardNodeData, 'cardNode'>
export type CustomBoxNode = Node<BoxNodeData, 'boxNode'>

// 1. 卡片 (Card) 視覺 UI
function CardNodeView({ data }: NodeProps<CustomCardNode>) {
  return (
    <div className="w-64 rounded-lg border border-slate-300 bg-white p-3 shadow-sm hover:shadow-md transition-shadow dark:border-slate-700 dark:bg-slate-800 select-none">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-700/60">
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
          {data.refText || 'MRG-1'}
        </span>
        <span className="text-xs text-slate-400 font-mono">Card</span>
      </div>
      <div className="mt-2 font-medium text-slate-800 text-sm dark:text-slate-200">
        {data.label || '無標題任務'}
      </div>
    </div>
  )
}

// 2. 收納盒 (Storage Box) 視覺 UI (目前不進行容器化 / 不作子節點階層限制)
function StorageBoxNodeView({ data }: NodeProps<CustomBoxNode>) {
  return (
    <div className="w-80 h-48 rounded-xl border-2 border-dashed border-indigo-400/80 bg-indigo-50/40 p-3 dark:border-indigo-500/60 dark:bg-indigo-950/20 select-none">
      <div className="flex items-center justify-between border-b border-indigo-200/60 pb-1.5 dark:border-indigo-800/60">
        <span className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
          {data.refText || 'MRG-BOX-1'}
        </span>
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">收納盒</span>
      </div>
      <div className="mt-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        {data.label || '新收納盒'}
      </div>
      <div className="mt-8 text-center text-xs text-indigo-400/70 dark:text-indigo-400/40 select-none">
        (獨立收納盒 UI)
      </div>
    </div>
  )
}

const nodeTypes = {
  cardNode: CardNodeView,
  boxNode: StorageBoxNodeView,
}

const initialNodes: Node[] = [
  {
    id: 'box-1',
    type: 'boxNode',
    position: { x: 50, y: 50 },
    data: { label: '專案核心組件收納盒', refText: 'MRG-1' },
  },
  {
    id: 'box-2',
    type: 'boxNode',
    position: { x: 420, y: 50 },
    data: { label: '後端服務收納盒', refText: 'MRG-2' },
  },
  {
    id: 'card-1',
    type: 'cardNode',
    position: { x: 80, y: 250 },
    data: { label: '設計 Graph View 基礎 UI', refText: 'MRG-3' },
  },
  {
    id: 'card-2',
    type: 'cardNode',
    position: { x: 360, y: 280 },
    data: { label: '實作純拖曳功能', refText: 'MRG-4' },
  },
  {
    id: 'card-3',
    type: 'cardNode',
    position: { x: 650, y: 250 },
    data: { label: '串接 API 與狀態管理', refText: 'MRG-5' },
  },
]

export interface SimpleGraphProps {
  projectId?: string
  tasks?: Task[]
  onOpenTask?: (taskId: string) => void
}

export default function SimpleGraph({ projectId, tasks }: SimpleGraphProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-950">
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
