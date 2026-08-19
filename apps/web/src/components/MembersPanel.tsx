import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api, ApiError, type ProjectRole, type WorkspaceUser } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Empty, Input, Select, Spinner, cx } from '../components/ui'
import { T } from '../strings'
import { Avatar } from './Avatar'

/**
 * 專案成員管理。
 *
 * 規則只有一條：**這個專案的管理者才能決定誰進得來。** 其他人看得到成員名單
 * （知道要找誰問事情很重要），但看不到有誰在敲門、也按不了核准 —— 待審清單
 * 與所有操作按鈕都掛在 canManage 底下，那是後端回的，不是前端自己猜的。
 *
 * 要加誰進來用搜尋的：沒打字時列出同工作區的帳號（跟以前一樣），
 * 打了字就跨工作區找 —— 要找來一起做事的人不見得已經在這個工作區裡。
 *
 * 沒有做通知信，所以「有人申請」只靠這個頁籤上的紅點提醒。
 */

const ROLE_LABEL = T.account.projectRole
const ROLES = Object.keys(ROLE_LABEL) as ProjectRole[]
const M = T.account.members

export default function MembersPanel({
  projectId, workspaceId,
}: {
  projectId: string
  workspaceId: string
}) {
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<{ id: string; name: string } | null>(null)
  const [confirmTransferUser, setConfirmTransferUser] = useState<{ id: string; name: string } | null>(null)
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  /** 準備加進來的帳號；null＝還沒挑 */
  const [picked, setPicked] = useState<WorkspaceUser | null>(null)
  const [pickRole, setPickRole] = useState<ProjectRole>('EDITOR')
  /** 每筆申請核准時要給的角色，沒挑過就是 EDITOR */
  const [reqRole, setReqRole] = useState<Record<string, ProjectRole>>({})

  /** 找人的關鍵字。打字打到一半不要每個字都送一次查詢 */
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['members', projectId], queryFn: () => Api.members(projectId),
  })
  const canManage = !!data?.canManage
  const canTransferOwnership = !!data?.canTransferOwnership || canManage

  const { data: reqData } = useQuery({
    queryKey: ['joinRequests', projectId], queryFn: () => Api.joinRequests(projectId),
    enabled: canManage,
  })
  const { data: usersData, isFetching: searching } = useQuery({
    queryKey: ['workspaceUsers', workspaceId, query, projectId],
    // 跨工作區搜尋要帶專案：後端據此確認你是這個專案的管理者
    queryFn: () => Api.workspaceUsers(workspaceId, query, projectId),
    enabled: canManage,
  })

  const members = data?.members ?? []
  const requests = reqData?.requests ?? []
  const memberIds = new Set(members.map(m => m.id))
  const addable = (usersData?.users ?? []).filter(u => !memberIds.has(u.id))

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['members', projectId] })
    qc.invalidateQueries({ queryKey: ['joinRequests', projectId] })
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['project', projectId] })
  }
  const fail = (e: unknown) => setErr(
    e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : T.common.failed
  )
  const ok = () => { setErr(null); refresh() }

  const approve = useMutation({
    mutationFn: (v: { reqId: string; role: ProjectRole }) =>
      Api.approveJoin(projectId, v.reqId, { role: v.role }),
    onSuccess: ok, onError: fail,
  })
  const reject = useMutation({
    mutationFn: (reqId: string) => Api.rejectJoin(projectId, reqId),
    onSuccess: ok, onError: fail,
  })
  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: ProjectRole }) =>
      Api.setMemberRole(projectId, v.userId, v.role),
    onSuccess: ok, onError: fail,
  })
  const remove = useMutation({
    mutationFn: (userId: string) => Api.removeMember(projectId, userId),
    onSuccess: ok, onError: fail,
  })
  const transfer = useMutation({
    mutationFn: (newOwnerId: string) => Api.transferProjectOwnership(projectId, newOwnerId),
    onSuccess: () => { setConfirmTransferUser(null); ok() },
    onError: fail,
  })
  const add = useMutation({
    mutationFn: () => Api.addMember(projectId, { userId: picked!.id, role: pickRole }),
    // 加完就清空，免得手滑再按一次又送同一個人（後端會擋，但那是一則紅字）
    onSuccess: () => { setPicked(null); setSearch(''); ok() }, onError: fail,
  })

  if (isLoading) return <Spinner label={M.loading} />

  return (
    <div className="h-full overflow-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-6 py-8">

        {err && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50
                          px-3 py-2 text-sm text-red-700
                          dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            <span className="flex-1">{err}</span>
            <button onClick={() => setErr(null)}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-200">✕</button>
          </div>
        )}

        {/* ── 待審申請。只有建立者看得到 ── */}
        {canManage && (
          <section className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {M.requestsTitle}
              </h2>
              {requests.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800
                                 dark:bg-amber-500/15 dark:text-amber-300">
                  {M.requestsPending(requests.length)}
                </span>
              )}
            </div>
            {requests.length === 0 ? (
              <div className="rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-400
                              ring-1 ring-slate-200
                              dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                {M.requestsEmpty}
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map(r => (
                  <div key={r.id}
                       className="rounded-xl bg-white p-4 ring-1 ring-amber-200
                                  dark:bg-slate-900 dark:ring-amber-500/30">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          {r.displayName}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-400">{r.email}</div>
                        {r.message && (
                          <div className="mt-1.5 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600
                                          dark:bg-slate-800 dark:text-slate-300">
                            {M.quotedMessage(r.message)}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* 核准的同時就決定角色，不必事後再改一次 */}
                        <Select value={reqRole[r.id] ?? 'EDITOR'}
                                onChange={e => setReqRole(m => ({
                                  ...m, [r.id]: e.target.value as ProjectRole,
                                }))}>
                          {ROLES.map(v => <option key={v} value={v}>{ROLE_LABEL[v]}</option>)}
                        </Select>
                        <Button
                          variant="primary"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate({
                            reqId: r.id, role: reqRole[r.id] ?? 'EDITOR',
                          })}>{M.approve}</Button>
                        <Button disabled={reject.isPending}
                                onClick={() => reject.mutate(r.id)}>{M.reject}</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 成員清單 ── */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{M.title}</h2>
            <span className="text-xs text-slate-400 dark:text-slate-400">{M.count(members.length)}</span>
            {!canManage && (
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-400">
                {M.readonlyHint}
              </span>
            )}
          </div>

          {members.length === 0 ? (
            <Empty>{M.empty}</Empty>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200
                            dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-700">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar userId={m.id} name={m.displayName} hasAvatar={m.hasAvatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {m.displayName}
                      </span>
                      {m.isCreator && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700
                                         dark:bg-blue-500/15 dark:text-blue-300">
                          {M.creator}
                        </span>
                      )}
                      {m.id === me?.id && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600
                                         dark:bg-slate-800 dark:text-slate-300">
                          {M.me}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-slate-400 dark:text-slate-400">{m.email}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 轉移專案擁有者：管理者或建立者可將擁有權移交給其他成員 */}
                    {canTransferOwnership && !m.isCreator && (
                      <button
                        onClick={() => setConfirmTransferUser({ id: m.id, name: m.displayName })}
                        title={M.transferOwnership}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10">
                        👑 {M.transferOwnership}
                      </button>
                    )}

                    {canManage && !m.isCreator && m.id !== me?.id ? (
                      <>
                        <Select value={m.role} disabled={setRole.isPending}
                                onChange={e => setRole.mutate({
                                  userId: m.id, role: e.target.value as ProjectRole,
                                })}>
                          {ROLES.map(v => <option key={v} value={v}>{ROLE_LABEL[v]}</option>)}
                        </Select>
                        <button
                          onClick={() => setConfirmRemoveUser({ id: m.id, name: m.displayName })}
                          className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600
                                     dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400">
                          {T.common.remove}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[m.role]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 直接加人。不必等對方申請 ── */}
        {canManage && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {M.addTitle}
            </h2>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200
                            dark:bg-slate-900 dark:ring-slate-700">
              <Input value={search} onChange={e => setSearch(e.target.value)}
                     placeholder={M.searchPlaceholder} />

              {/* 挑好的人固定顯示在上面，接著往下打字找別人也不會弄丟他 */}
              {picked && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2
                                dark:bg-blue-500/10">
                  <span className="min-w-0 flex-1 truncate text-sm text-blue-800 dark:text-blue-200">
                    {M.picked(M.userOption(picked.displayName, picked.email))}
                  </span>
                  <button onClick={() => setPicked(null)}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-300">
                    {M.clearPick}
                  </button>
                  <Select value={pickRole}
                          onChange={e => setPickRole(e.target.value as ProjectRole)}>
                    {ROLES.map(v => <option key={v} value={v}>{ROLE_LABEL[v]}</option>)}
                  </Select>
                  <Button variant="primary" disabled={add.isPending}
                          onClick={() => add.mutate()}>{M.add}</Button>
                </div>
              )}

              {/* 找到的人。點一下就是選他，不再多一個下拉 */}
              {addable.length > 0 && (
                <div className="mt-2 max-h-56 divide-y divide-slate-100 overflow-auto rounded-lg
                                ring-1 ring-slate-200
                                dark:divide-slate-800 dark:ring-slate-700">
                  {addable.map(u => (
                    <button key={u.id} onClick={() => setPicked(u)}
                            className={cx(
                              'flex w-full items-center gap-2 px-3 py-2 text-left',
                              u.id === picked?.id
                                ? 'bg-blue-50 dark:bg-blue-500/10'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800')}>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                        {M.userOption(u.displayName, u.email)}
                      </span>
                      {!u.role && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800
                                         dark:bg-amber-500/15 dark:text-amber-300">
                          {M.outsideWorkspace}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {addable.length === 0 && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {searching ? M.searching : query ? M.searchEmpty : M.addNoneLeft}
                </p>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-400">{M.addHint}</p>
          </section>
        )}

      </div>

      {confirmRemoveUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                移除成員確認
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {M.confirmRemove(confirmRemoveUser.name)}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setConfirmRemoveUser(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(confirmRemoveUser.id)
                  setConfirmRemoveUser(null)
                }}
              >
                確定移除
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmTransferUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-lg">
                👑
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {M.transferOwnership}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {M.confirmTransfer(confirmTransferUser.name)}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setConfirmTransferUser(null)}>
                取消
              </Button>
              <Button
                variant="primary"
                disabled={transfer.isPending}
                onClick={() => transfer.mutate(confirmTransferUser.id)}
              >
                確定轉移
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
