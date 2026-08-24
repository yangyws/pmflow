import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api } from '../lib/api'
import { Button, Input, Spinner, cx } from './ui'
import { T } from '../strings'

export function CanvasPermissionModal({
  open,
  onClose,
  projectId,
  canvasKey,
  canvasTitle,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  canvasKey: string
  canvasTitle: string
}) {
  const qc = useQueryClient()
  const P = T.flow.shared.permissions

  const { data: memberData, isLoading: loadingMembers } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => Api.members(projectId),
    enabled: open,
  })

  const { data: permData, isLoading: loadingPerms } = useQuery({
    queryKey: ['canvasPermissions', projectId, canvasKey],
    queryFn: () => Api.canvasPermissions(projectId, canvasKey),
    enabled: open,
  })

  const [mode, setMode] = useState<'ALL' | 'WHITELIST'>('ALL')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !permData) return
    const allowed = permData.allowedUserIds
    if (allowed && Array.isArray(allowed) && allowed.length > 0) {
      setMode('WHITELIST')
      setSelectedUserIds(new Set(allowed))
    } else {
      setMode('ALL')
      setSelectedUserIds(new Set())
    }
    setSearch('')
    setErr(null)
  }, [open, permData])

  const members = memberData?.members ?? []

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.displayName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
    )
  }, [members, search])

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedUserIds(new Set(members.map((m) => m.id)))
  }

  const handleClearAll = () => {
    setSelectedUserIds(new Set())
  }

  const saveMutation = useMutation({
    mutationFn: (allowedUserIds: string[] | null) =>
      Api.saveCanvasPermissions(projectId, canvasKey, { allowedUserIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canvasPermissions', projectId, canvasKey] })
      onClose()
    },
    onError: (e: any) => {
      setErr(e?.detail || e?.message || '儲存失敗，請重試')
    },
  })

  const handleSave = () => {
    setErr(null)
    const payload = mode === 'ALL' ? null : Array.from(selectedUserIds)
    saveMutation.mutate(payload)
  }

  if (!open) return null

  const isLoading = loadingMembers || loadingPerms

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {P.title(canvasTitle)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {P.btnHint}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Spinner />
              <span className="text-xs text-slate-400">載入中…</span>
            </div>
          ) : (
            <>
              {err && (
                <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800">
                  {err}
                </div>
              )}

              {/* Mode Selection */}
              <div className="space-y-3">
                <label
                  className={cx(
                    'flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none',
                    mode === 'ALL'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                >
                  <input
                    type="radio"
                    name="permMode"
                    value="ALL"
                    checked={mode === 'ALL'}
                    onChange={() => setMode('ALL')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {P.modeAll}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {P.modeAllHint}
                    </div>
                  </div>
                </label>

                <label
                  className={cx(
                    'flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none',
                    mode === 'WHITELIST'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                >
                  <input
                    type="radio"
                    name="permMode"
                    value="WHITELIST"
                    checked={mode === 'WHITELIST'}
                    onChange={() => setMode('WHITELIST')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {P.modeWhitelist}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {P.modeWhitelistHint}
                    </div>
                  </div>
                </label>
              </div>

              {/* Member Selection List (Only in WHITELIST mode) */}
              {mode === 'WHITELIST' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      placeholder={P.searchPlaceholder}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="text-xs py-1.5"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleSelectAll}
                        className="text-xs py-1 px-2 h-auto cursor-pointer"
                      >
                        {P.selectAll}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearAll}
                        className="text-xs py-1 px-2 h-auto cursor-pointer"
                      >
                        {P.clearAll}
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-1">
                    {filteredMembers.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        無相符的專案成員
                      </div>
                    ) : (
                      filteredMembers.map((m) => {
                        const isManager = m.role === 'MANAGER'
                        const isChecked = isManager || selectedUserIds.has(m.id)

                        return (
                          <div
                            key={m.id}
                            onClick={() => !isManager && toggleUser(m.id)}
                            className={cx(
                              'flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer select-none',
                              isManager
                                ? 'opacity-90 bg-slate-100/70 dark:bg-slate-800/70 cursor-default'
                                : isChecked
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/40'
                                : 'hover:bg-white dark:hover:bg-slate-800'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isManager}
                                onChange={() => {}}
                                className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-75"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                                  <span>{m.displayName}</span>
                                  {isManager && (
                                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                                      {P.managerBadge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                  {m.email} ({m.role})
                                </div>
                              </div>
                            </div>

                            <span className="text-xs font-medium text-slate-400">
                              {isChecked ? '✓' : ''}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
          <Button type="button" variant="default" onClick={onClose} className="cursor-pointer">
            {T.common.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={saveMutation.isPending || isLoading}
            className="cursor-pointer"
          >
            {saveMutation.isPending ? '儲存中…' : T.common.save}
          </Button>
        </div>
      </div>
    </div>
  )
}
