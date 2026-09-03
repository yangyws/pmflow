import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api, ApiError, type AdminUser, type WorkspaceRole, type DeletedProject } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Field, Input, Select, Spinner, cx } from './ui'
import { T } from '../strings'
import { Avatar } from './Avatar'

/**
 * 系統管理 —— 工作區裡的帳號。
 *
 * 管的是「誰能登入這個站」：開帳號、停用帳號、刪帳號、調整工作區角色、代設密碼。
 * **不管專案內容** —— 管理者不會因此看得到任何一個專案，那仍然要專案建立者放行。
 * 兩套權限刻意分開，見 api/src/lib/auth.ts 的說明。
 *
 * **擁有者在這一頁看到的是完全不同的東西**：他管不到帳號，只能決定誰是管理者。
 * 開站的人不必然是該看每個人帳號的人；但不留這一項給他，最後一個管理者離職
 * 之後就沒有人能再指派下一個了。
 *
 * 站上沒有寄信的能力，所以新帳號的密碼是管理者當面給的，重設密碼也一樣。
 * 這件事在畫面上要寫清楚，不然管理者會等一封永遠不會寄出的信。
 * 連管理者自己都進不來的時候，最後一招是在主機上放檔案（api/src/lib/breakglass.ts）。
 */

const ROLE_LABEL = T.account.workspaceRole
const ROLE_HINT = T.account.workspaceRoleHint
const STATUS_LABEL = T.account.userStatus
const A = T.account.admin
const O = T.account.owner

const STATUS_CLS: Record<AdminUser['status'], string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-800/60 font-medium',
  PENDING: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700 font-medium',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 dark:border dark:border-red-800/60 font-medium',
}

const errText = (e: unknown) =>
  e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : T.common.failed

export default function AdminPanel(
  { workspaceId, myRole }: { workspaceId: string; myRole: WorkspaceRole }
) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'admins' | 'deletedProjects'>('users')
  const isSuperOrOwner = myRole === 'OWNER' || !!user?.isSuperAdmin

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white px-6 pt-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('users')}
            className={cx(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer',
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}>
            👥 成員帳號管理（停用/註銷/密碼）
          </button>
          {myRole === 'OWNER' && (
            <button
              onClick={() => setActiveTab('admins')}
              className={cx(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer',
                activeTab === 'admins'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}>
              🛡️ 指派管理者（Owner 專屬權限）
            </button>
          )}
          {isSuperOrOwner && (
            <button
              onClick={() => setActiveTab('deletedProjects')}
              className={cx(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer',
                activeTab === 'deletedProjects'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}>
              🗑️ 已刪除專案（還原管理）
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === 'admins' && myRole === 'OWNER' ? (
          <OwnerPanel workspaceId={workspaceId} />
        ) : activeTab === 'deletedProjects' ? (
          <DeletedProjectsPanel />
        ) : (
          <UserAdminPanel workspaceId={workspaceId} />
        )}
      </div>
    </div>
  )
}

function UserAdminPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    email: '', displayName: '', password: '', role: 'MEMBER' as WorkspaceRole,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', workspaceId], queryFn: () => Api.adminUsers(workspaceId),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['adminUsers', workspaceId] })
  const fail = (e: unknown) => { setMsg(null); setErr(errText(e)) }
  const done = (text: string) => { setErr(null); setMsg(text); refresh() }

  const patch = useMutation({
    mutationFn: (v: { userId: string; json: Parameters<typeof Api.adminPatchUser>[2] }) =>
      Api.adminPatchUser(workspaceId, v.userId, v.json),
    onSuccess: () => done(A.updated), onError: fail,
  })
  const create = useMutation({
    mutationFn: () => Api.adminCreateUser({ workspaceId, ...form }),
    onSuccess: () => {
      done(A.created(form.displayName))
      setForm({ email: '', displayName: '', password: '', role: 'MEMBER' })
      setCreating(false)
    },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (u: AdminUser) => Api.adminDeleteUser(workspaceId, u.id),
    onSuccess: (r, u) => done(
      r.projectsTransferred > 0
        ? A.deletedWithProjects(u.displayName, r.projectsTransferred)
        : A.deleted(u.displayName)
    ),
    onError: fail,
  })

  if (isLoading || !data) return <Spinner label={A.loading} />

  const users = data.users
  // 擁有者或超級管理者可以管理所有帳號；管理者可管理非擁有者帳號
  const isSuperOrOwner = data.myRole === 'OWNER'
  const canEdit = (u: AdminUser) => u.id !== user?.id && (isSuperOrOwner || u.role !== 'OWNER')
  const canChangeRole = (u: AdminUser) => canEdit(u) && (isSuperOrOwner || u.role !== 'ADMIN')
  const canDelete = (u: AdminUser) => canEdit(u) && (isSuperOrOwner || u.role !== 'ADMIN')

  return (
    <div className="h-full overflow-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{A.title}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500
                           dark:bg-slate-800 dark:text-slate-400">
            {A.myRole(ROLE_LABEL[data.myRole])}
          </span>
          <Button className="ml-auto" variant="primary"
                  onClick={() => { setCreating(c => !c); setMsg(null); setErr(null) }}>
            {creating ? T.common.cancel : A.createToggle}
          </Button>
        </div>

        {err && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50
                          px-3 py-2 text-sm text-red-700">
            <span className="flex-1">{err}</span>
            <button onClick={() => setErr(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        {msg && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50
                          px-3 py-2 text-sm text-emerald-700
                          dark:border-emerald-500/30 dark:bg-emerald-500/15
                          dark:text-emerald-300">{msg}</div>
        )}

        {/* ── 新增帳號 ── */}
        {creating && (
          <section className="mb-6 rounded-xl bg-white p-5 ring-1 ring-slate-200
                              dark:bg-slate-900 dark:ring-slate-700">
            <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {A.createTitle}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={A.email}>
                <Input value={form.email} type="email"
                       onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label={A.displayName}>
                <Input value={form.displayName}
                       onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
              </Field>
              <Field label={A.initialPassword}>
                <Input value={form.password} type="text" autoComplete="off"
                       onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </Field>
              <Field label={A.role}>
                <Select value={form.role} className="w-full"
                        onChange={e => setForm(f => ({ ...f, role: e.target.value as WorkspaceRole }))}>
                  {data.roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
              </Field>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {ROLE_HINT[form.role]}
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {A.noMailHint}
            </p>
            <div className="mt-4">
              <Button variant="primary"
                      disabled={
                        !form.email.trim() || !form.displayName.trim()
                        || form.password.length < 8 || create.isPending
                      }
                      onClick={() => create.mutate()}>{T.common.create}</Button>
            </div>
          </section>
        )}

        {/* ── 帳號清單 ── */}
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200
                        dark:bg-slate-900 dark:ring-slate-700">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2
                          text-xs font-medium text-slate-500
                          dark:border-slate-800 dark:text-slate-400">
            <span className="flex-1">{A.colAccount}</span>
            <span className="w-24 text-center">{A.colStatus}</span>
            <span className="w-28 text-center">{A.colProjects}</span>
            <span className="w-28 text-center">{A.colRole}</span>
            <span className="w-40" />
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map(u => (
              <UserRow key={u.id} user={u} isMe={u.id === user?.id} editable={canEdit(u)}
                       roleEditable={canChangeRole(u)} canDelete={canDelete(u)} roles={data.roles}
                       busy={patch.isPending || remove.isPending}
                       onPatch={json => patch.mutate({ userId: u.id, json })}
                       onDelete={() => remove.mutate(u)} />
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400 dark:text-slate-400">{A.footHint}</p>
      </div>
    </div>
  )
}

function UserRow({
  user: u, isMe, editable, roleEditable, canDelete, roles, busy, onPatch, onDelete,
}: {
  user: AdminUser
  isMe: boolean
  editable: boolean
  roleEditable: boolean
  canDelete: boolean
  roles: WorkspaceRole[]
  busy: boolean
  onPatch: (json: Parameters<typeof Api.adminPatchUser>[2]) => void
  onDelete: () => void
}) {
  const suspended = u.status === 'SUSPENDED'
  const [confirmActionModal, setConfirmActionModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  return (
    <div className={cx('flex items-center gap-3 px-4 py-3',
                       suspended && 'bg-slate-50 dark:bg-slate-950/60')}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cx('truncate text-sm font-medium',
                              suspended
                                ? 'text-slate-400 dark:text-slate-400'
                                : 'text-slate-800 dark:text-slate-100')}>
            {u.displayName}
          </span>
          {isMe && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700
                             dark:bg-blue-500/15 dark:text-blue-300">{A.me}</span>
          )}
        </div>
        <div className="truncate text-xs text-slate-400 dark:text-slate-400">{u.email}</div>
      </div>

      <span className={cx('w-24 rounded px-2 py-0.5 text-center text-[11px]', STATUS_CLS[u.status])}>
        {STATUS_LABEL[u.status]}
      </span>

      {/* 停用之前先看得到他手上有什麼，不然沒人知道誰要接手 */}
      <span className="w-28 text-center text-xs text-slate-500 dark:text-slate-400">
        {A.projectCount(Number(u.projectCount))}
        {Number(u.createdCount) > 0 && (
          <span className="text-slate-400 dark:text-slate-400">
            {A.createdCount(Number(u.createdCount))}
          </span>
        )}
      </span>

      <div className="w-28 text-center">
        {roleEditable ? (
          <Select value={u.role} disabled={busy} className="w-full px-1.5 py-1 text-xs"
                  onChange={e => onPatch({ role: e.target.value as WorkspaceRole })}>
            {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[u.role]}</span>
        )}
      </div>

      <div className="flex w-40 items-center justify-end gap-1">
        {editable && (
          <>
            <button
              onClick={() => {
                const pw = window.prompt(A.promptNewPassword(u.displayName))
                if (pw && pw.length >= 8) onPatch({ newPassword: pw })
                else if (pw) window.alert(A.passwordTooShort)
              }}
              className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700
                         dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
              {A.resetPassword}
            </button>
            <button
              onClick={() => {
                const next = suspended ? 'ACTIVE' : 'SUSPENDED'
                const ask = suspended
                  ? A.confirmResume(u.displayName)
                  : A.confirmSuspend(u.displayName)
                setConfirmActionModal({
                  title: suspended ? '帳號復權確認' : '停權帳號確認',
                  message: ask,
                  onConfirm: () => onPatch({ status: next }),
                })
              }}
              className={cx('rounded px-1.5 py-1 text-xs font-medium',
                            suspended
                              ? 'text-emerald-600 hover:bg-emerald-50 '
                                + 'dark:text-emerald-400 dark:hover:bg-emerald-500/10'
                              : 'text-amber-600 hover:bg-amber-50 hover:text-amber-700 '
                                + 'dark:text-amber-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-300')}>
              {suspended ? A.resume : A.suspend}
            </button>
            {/* 刪除：擁有者可刪除所有非擁有者帳號；管理者可刪除非管理者與非擁有者 */}
            {canDelete && (
              <button
                onClick={() => {
                  const created = Number(u.createdCount)
                  const ask = [
                    A.confirmDelete(u.displayName),
                    created > 0 ? A.confirmDeleteProjects(created) : '',
                    A.confirmDeleteTasks,
                    A.confirmDeleteSuspendInstead,
                  ].filter(Boolean).join('\n')
                  setConfirmActionModal({
                    title: '註銷 / 刪除帳號確認',
                    message: ask,
                    onConfirm: () => onDelete(),
                  })
                }}
                disabled={busy}
                className="rounded px-1.5 py-1 text-xs font-medium text-red-500
                           hover:bg-red-50 hover:text-red-700 disabled:opacity-50
                           dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300">
                註銷
              </button>
            )}
          </>
        )}
      </div>

      {confirmActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {confirmActionModal.title}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
              {confirmActionModal.message}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setConfirmActionModal(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  confirmActionModal.onConfirm()
                  setConfirmActionModal(null)
                }}
              >
                確定
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 擁有者看到的系統管理：只有「誰是管理者」這一件事。
 *
 * 這裡刻意只列名字與 email —— 帳號的狀態、參與幾個專案那些細節是管理者的事。
 * 後端也不會回那些欄位，不是前端自己藏起來的。
 */
function OwnerPanel({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['adminAdministrators', workspaceId],
    queryFn: () => Api.adminAdministrators(workspaceId),
  })

  const setAdmin = useMutation({
    mutationFn: (v: { userId: string; isAdmin: boolean }) =>
      Api.adminSetAdministrator(workspaceId, v.userId, v.isAdmin),
    onSuccess: () => {
      setErr(null)
      qc.invalidateQueries({ queryKey: ['adminAdministrators', workspaceId] })
      qc.invalidateQueries({ queryKey: ['adminUsers', workspaceId] })
    },
    onError: e => setErr(errText(e)),
  })

  if (isLoading || !data) return <Spinner label={O.loading} />

  const admins = data.users.filter(u => u.isAdmin)

  return (
    <div className="h-full overflow-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{A.title}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500
                           dark:bg-slate-800 dark:text-slate-400">
            {O.myRole}
          </span>
        </div>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{O.intro}</p>

        {err && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700
                          dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {err}
          </div>
        )}

        {admins.length === 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800
                          dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
            {O.noAdmins}
          </div>
        )}

        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200
                        dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-700">
          {data.users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar userId={u.id} name={u.displayName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {u.displayName}
                  </span>
                  {u.isOwner && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700
                                     dark:bg-blue-500/15 dark:text-blue-300">
                      {u.id === user?.id ? O.meOwner : '擁有者'}
                    </span>
                  )}
                  {u.id === user?.id && !u.isOwner && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700
                                     dark:bg-blue-500/15 dark:text-blue-300">
                      {A.me}
                    </span>
                  )}
                  {u.isAdmin && (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700
                                     dark:bg-emerald-500/15 dark:text-emerald-300">
                      {O.isAdmin}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-slate-400 dark:text-slate-400">{u.email}</div>
              </div>

              {!u.isOwner && (
                <Button
                  variant={u.isAdmin ? 'ghost' : 'primary'}
                  disabled={setAdmin.isPending}
                  onClick={() => {
                    const ask = u.isAdmin
                      ? O.confirmRevoke(u.displayName)
                      : O.confirmGrant(u.displayName)
                    if (window.confirm(ask)) {
                      setAdmin.mutate({ userId: u.id, isAdmin: !u.isAdmin })
                    }
                  }}>
                  {u.isAdmin ? O.revoke : O.grant}
                </Button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-400 dark:text-slate-400">{O.footHint}</p>
      </div>
    </div>
  )
}

function DeletedProjectsPanel() {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [restoringProject, setRestoringProject] = useState<DeletedProject | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['deletedProjects'],
    queryFn: () => Api.deletedProjects(),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['deletedProjects'] })
    qc.invalidateQueries({ queryKey: ['projects'] })
  }

  const restoreMutation = useMutation({
    mutationFn: (id: string) => Api.restoreProject(id),
    onSuccess: (res) => {
      setRestoringProject(null)
      setErr(null)
      setMsg(`專案「${res.name}」已成功恢復！`)
      refresh()
    },
    onError: (e: unknown) => {
      setErr(e instanceof ApiError ? [e.title, e.detail].filter(Boolean).join('：') : '恢復專案失敗')
    },
  })

  if (isLoading) return <Spinner label="載入已刪除專案清單中..." />

  const projects = data?.projects ?? []

  return (
    <div className="h-full overflow-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">已刪除專案管理</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              此處列出全站所有已標記刪除的專案。超級管理者可隨時將其一鍵還原回使用狀態。
            </p>
          </div>
        </div>

        {msg && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800">
            <span>✓ {msg}</span>
            <button onClick={() => setMsg(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">✕</button>
          </div>
        )}

        {err && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800">
            <span>⚠️ {err}</span>
            <button onClick={() => setErr(null)} className="text-red-500 hover:text-red-700 cursor-pointer">✕</button>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="text-3xl mb-2 select-none">🎉</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">目前沒有已刪除的專案</div>
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">所有被刪除的專案都會完整封存於此處以供還原。</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-xs ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
            {projects.map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {p.key}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {p.name}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-400">
                      <span>建立者：{p.creatorName ?? '未知'} ({p.creatorEmail ?? '-'})</span>
                      <span>•</span>
                      <span>任務數：{p.taskCount ?? 0}</span>
                      <span>•</span>
                      <span className="text-red-500/90 dark:text-red-400">
                        刪除時間：{new Date(p.archivedAt).toLocaleString('zh-TW', { hour12: false })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer shadow-xs"
                    onClick={() => setRestoringProject(p)}
                  >
                    ↺ 恢復專案
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 恢復專案確認彈窗 */}
        {restoringProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-lg select-none">
                  ↺
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">恢復專案確認</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">將專案解除刪除並重新對成員開放</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                確定要恢復專案「<strong className="text-slate-900 dark:text-slate-100 font-semibold">{restoringProject.name}</strong>」（代碼：<span className="font-mono font-bold text-blue-600 dark:text-blue-400">{restoringProject.key}</span>）嗎？
                <div className="mt-2 text-slate-500 dark:text-slate-400 space-y-1">
                  <div>• 恢復後專案將立刻重新出現在成員的專案清單與導航中。</div>
                  <div>• 專案內所有既有任務、排版與成員權限均維持原樣。</div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <Button
                  variant="ghost"
                  onClick={() => setRestoringProject(null)}
                  disabled={restoreMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate(restoringProject.id)}
                >
                  {restoreMutation.isPending ? '正在恢復...' : '確認恢復專案'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
