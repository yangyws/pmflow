import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Api } from '../lib/api'
import { Button, Input, Spinner } from '../components/ui'
import { T } from '../strings'

export default function DeletedTasks({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['deletedTasks', projectId],
    queryFn: () => Api.deletedTasks(projectId),
    enabled: !!projectId,
  })

  const tasks = data?.tasks ?? []

  const restoreMutation = useMutation({
    mutationFn: (taskId: string) => Api.restoreTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedTasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
      queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (taskId: string) => Api.permanentDeleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedTasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
      queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => {
      const ref = t.ref || (t.number ? `MRG-${t.number}` : '')
      return (
        t.title.toLowerCase().includes(q) ||
        ref.toLowerCase().includes(q) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(q))
      )
    })
  }, [tasks, search])

  const handleRestore = (taskId: string, title: string) => {
    if (confirm(`確定要還原事件「${title}」嗎？`)) {
      restoreMutation.mutate(taskId)
    }
  }

  const handlePermanentDelete = (taskId: string, title: string) => {
    if (confirm(`⚠️ 警告：確定要永久刪除事件「${title}」嗎？此操作無法復原！`)) {
      permanentDeleteMutation.mutate(taskId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Spinner label="載入已刪除事件…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-red-500">
        載入已刪除事件失敗：{(error as Error).message}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* 頂部搜尋與資訊列 */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>🗑️</span> 已刪除事件
          </span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
            共 {tasks.length} 筆
          </span>
        </div>

        <div className="w-64 max-w-full">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋已刪除事件…"
            className="text-xs"
          />
        </div>
      </div>

      {/* 列表主體 */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center">
            <span className="text-3xl mb-2">🗑️</span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {search ? '沒有符合搜尋條件的已刪除事件' : '目前沒有任何已刪除的事件'}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              被刪除的任務會保存在這裡，可隨時一鍵還原。
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold w-24">編號</th>
                  <th className="px-4 py-3 font-semibold">事件標題</th>
                  <th className="px-4 py-3 font-semibold w-32 hidden sm:table-cell">指派給</th>
                  <th className="px-4 py-3 font-semibold w-32 hidden md:table-cell">狀態</th>
                  <th className="px-4 py-3 font-semibold w-40 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filtered.map((t) => {
                  const ref = t.ref || (t.number ? `MRG-${t.number}` : '')
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {ref || '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex flex-col">
                          <span className="line-clamp-1">{t.title}</span>
                          {t.description && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                              {t.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                        {t.assigneeName || '未指派'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {t.statusKey} ({t.progress}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="default"
                            onClick={() => handleRestore(t.id, t.title)}
                            disabled={restoreMutation.isPending}
                            className="text-xs py-1 px-2.5 flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800"
                          >
                            <span>🔄</span> 還原
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handlePermanentDelete(t.id, t.title)}
                            disabled={permanentDeleteMutation.isPending}
                            className="text-xs py-1 px-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            title="永久刪除"
                          >
                            <span>🗑️</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
