import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Api } from '../lib/api'
import { Button, Input, Spinner, TypeBadge, ProblemBadge, cx } from '../components/ui'
import { T } from '../strings'

export default function DeletedTasks({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [restorePrompt, setRestorePrompt] = useState<
    | {
        type: 'box'
        task: any
        deletedKids: any[]
      }
    | {
        type: 'child_with_deleted_parent'
        task: any
        deletedParent: any
      }
    | {
        type: 'child_with_active_parent'
        task: any
        activeParent: any
      }
    | {
        type: 'simple'
        task: any
      }
    | null
  >(null)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => Api.project(projectId),
    enabled: !!projectId,
  })

  const { data: activeTasksData } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => Api.tasks(projectId),
    enabled: !!projectId,
  })
  const activeTasks = activeTasksData?.tasks ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['deletedTasks', projectId],
    queryFn: () => Api.deletedTasks(projectId),
    enabled: !!projectId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const tasks = data?.tasks ?? []

  const typesMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    for (const t of project?.types ?? []) {
      map.set(t.key, { name: t.name, color: t.color || '#3178c6' })
    }
    if (!map.has('TASK')) map.set('TASK', { name: '任務單', color: '#3178c6' })
    if (!map.has('BUG')) map.set('BUG', { name: '問題單', color: '#dc2626' })
    return map
  }, [project?.types])

  const statusesMap = useMemo(() => {
    const map = new Map<string, { name: string; category: string }>()
    for (const s of project?.statuses ?? []) {
      map.set(s.key, { name: s.name, category: s.category })
    }
    if (!map.has('todo')) map.set('todo', { name: '待處理', category: 'TODO' })
    if (!map.has('in_progress')) map.set('in_progress', { name: '進行中', category: 'IN_PROGRESS' })
    if (!map.has('done')) map.set('done', { name: '已完成', category: 'DONE' })
    return map
  }, [project?.statuses])

  const restoreMutation = useMutation({
    mutationFn: ({ taskId, mode }: { taskId: string; mode?: 'all' | 'self_only' | 'detach_parent' }) =>
      Api.restoreTask(taskId, { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedTasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['graph', projectId] })
      queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
      setRestorePrompt(null)
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
      const typeInfo = typesMap.get(t.type || 'TASK')
      const statusInfo = statusesMap.get(t.statusKey || 'todo')
      return (
        t.title.toLowerCase().includes(q) ||
        ref.toLowerCase().includes(q) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(q)) ||
        (typeInfo?.name && typeInfo.name.toLowerCase().includes(q)) ||
        (statusInfo?.name && statusInfo.name.toLowerCase().includes(q))
      )
    })
  }, [tasks, search, typesMap, statusesMap])

  const handleRestoreClick = (t: any) => {
    const deletedKids = tasks.filter((d) => d.parentId === t.id)
    if (deletedKids.length > 0) {
      setRestorePrompt({ type: 'box', task: t, deletedKids })
      return
    }

    if (t.parentId) {
      const deletedParent = tasks.find((d) => d.id === t.parentId)
      if (deletedParent) {
        setRestorePrompt({ type: 'child_with_deleted_parent', task: t, deletedParent })
        return
      }
      const activeParent = activeTasks.find((a) => a.id === t.parentId)
      if (activeParent) {
        setRestorePrompt({ type: 'child_with_active_parent', task: t, activeParent })
        return
      }
    }

    setRestorePrompt({ type: 'simple', task: t })
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
            placeholder="搜尋編號、標題、種類或狀態…"
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
                  <th className="px-4 py-3 font-semibold w-24">種類</th>
                  <th className="px-4 py-3 font-semibold">事件標題</th>
                  <th className="px-4 py-3 font-semibold w-28 hidden sm:table-cell">指派給</th>
                  <th className="px-4 py-3 font-semibold w-28 hidden md:table-cell">狀態</th>
                  <th className="px-4 py-3 font-semibold w-36 hidden sm:table-cell">原本進度</th>
                  <th className="px-4 py-3 font-semibold w-36 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filtered.map((t) => {
                  const ref = t.ref || (t.number ? `MRG-${t.number}` : '')
                  const typeInfo = typesMap.get(t.type || 'TASK') || { name: '任務單', color: '#3178c6' }
                  const statusInfo = statusesMap.get(t.statusKey || 'todo') || { name: t.statusKey || '待處理', category: 'TODO' }
                  const progress = Math.min(100, Math.max(0, t.progress ?? 0))

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 編號 */}
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {ref || '-'}
                      </td>

                      {/* 種類 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TypeBadge name={typeInfo.name} color={typeInfo.color} />
                      </td>

                      {/* 事件標題與問題指示 */}
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="line-clamp-1">{t.title}</span>
                            {t.problem && <ProblemBadge problem={t.problem} />}
                          </div>
                          {t.description && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">
                              {t.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 指派給 */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap">
                        {t.assigneeName || '未指派'}
                      </td>

                      {/* 狀態 */}
                      <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                        <span
                          className={cx(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border',
                            statusInfo.category === 'DONE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              : statusInfo.category === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          )}
                        >
                          {statusInfo.name}
                        </span>
                      </td>

                      {/* 原本進度 */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={cx(
                                'h-full rounded-full transition-all',
                                progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                            {progress}%
                          </span>
                        </div>
                      </td>

                      {/* 操作按鈕 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="default"
                            onClick={() => handleRestoreClick(t)}
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

      {/* 還原互動確認彈窗 */}
      {restorePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            {restorePrompt.type === 'box' && (
              <>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                  <span className="text-xl">📦</span>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      還原收納盒確認
                    </h3>
                    <p className="text-xs text-slate-400">
                      收納盒：{restorePrompt.task.ref || ''} {restorePrompt.task.title}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 mb-5 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  此收納盒底下包含 <strong className="font-bold underline">{restorePrompt.deletedKids.length}</strong> 張處於已刪除狀態的子卡片。請選擇還原方式：
                </div>

                <div className="flex flex-col gap-2.5">
                  <Button
                    variant="primary"
                    onClick={() =>
                      restoreMutation.mutate({ taskId: restorePrompt.task.id, mode: 'all' })
                    }
                    disabled={restoreMutation.isPending}
                    className="w-full justify-center py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <span>📦 一併還原收納盒與全部子卡片</span>
                  </Button>
                  <Button
                    variant="default"
                    onClick={() =>
                      restoreMutation.mutate({ taskId: restorePrompt.task.id, mode: 'self_only' })
                    }
                    disabled={restoreMutation.isPending}
                    className="w-full justify-center py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700"
                  >
                    <span>🗃️ 僅還原收納盒自己（子卡片保留已刪除）</span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setRestorePrompt(null)}
                    disabled={restoreMutation.isPending}
                    className="w-full justify-center py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mt-1"
                  >
                    取消
                  </Button>
                </div>
              </>
            )}

            {restorePrompt.type === 'child_with_deleted_parent' && (
              <>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                  <span className="text-xl">📄</span>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      還原子卡片確認
                    </h3>
                    <p className="text-xs text-slate-400">
                      子卡片：{restorePrompt.task.ref || ''} {restorePrompt.task.title}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 p-3 mb-5 text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                  此子卡片原屬於已刪除的收納盒「<strong className="font-bold">{restorePrompt.deletedParent.ref || ''} {restorePrompt.deletedParent.title}</strong>」。請選擇還原方式：
                </div>

                <div className="flex flex-col gap-2.5">
                  <Button
                    variant="primary"
                    onClick={() =>
                      restoreMutation.mutate({ taskId: restorePrompt.deletedParent.id, mode: 'all' })
                    }
                    disabled={restoreMutation.isPending}
                    className="w-full justify-center py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <span>📦 連同收納盒一起還原（卡片放回收納盒內）</span>
                  </Button>
                  <Button
                    variant="default"
                    onClick={() =>
                      restoreMutation.mutate({ taskId: restorePrompt.task.id, mode: 'detach_parent' })
                    }
                    disabled={restoreMutation.isPending}
                    className="w-full justify-center py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700"
                  >
                    <span>📄 僅還原此子卡片（移至最外層獨立卡片）</span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setRestorePrompt(null)}
                    disabled={restoreMutation.isPending}
                    className="w-full justify-center py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mt-1"
                  >
                    取消
                  </Button>
                </div>
              </>
            )}

            {restorePrompt.type === 'child_with_active_parent' && (
              <>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                  <span className="text-xl">🔄</span>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      還原子卡片確認
                    </h3>
                    <p className="text-xs text-slate-400">
                      事件：{restorePrompt.task.ref || ''} {restorePrompt.task.title}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                  確定要還原此事件並放回所屬收納盒「<strong className="font-bold">{restorePrompt.activeParent.ref || ''} {restorePrompt.activeParent.title}</strong>」內嗎？
                </p>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setRestorePrompt(null)}
                    disabled={restoreMutation.isPending}
                    className="text-xs"
                  >
                    取消
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      restoreMutation.mutate({ taskId: restorePrompt.task.id, mode: 'all' })
                    }
                    disabled={restoreMutation.isPending}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    確定還原
                  </Button>
                </div>
              </>
            )}

            {restorePrompt.type === 'simple' && (
              <>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                  <span className="text-xl">🔄</span>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      還原事件確認
                    </h3>
                    <p className="text-xs text-slate-400">
                      事件：{restorePrompt.task.ref || ''} {restorePrompt.task.title}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                  確定要還原事件「<strong>{restorePrompt.task.title}</strong>」嗎？
                </p>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setRestorePrompt(null)}
                    disabled={restoreMutation.isPending}
                    className="text-xs"
                  >
                    取消
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      restoreMutation.mutate({ taskId: restorePrompt.task.id, mode: 'all' })
                    }
                    disabled={restoreMutation.isPending}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    確定還原
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
