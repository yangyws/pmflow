import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { SignJWT, jwtVerify } from 'jose'
import type { FastifyRequest } from 'fastify'
import { env } from './env.js'
import { sql } from './db.js'
import { jwtKey } from './secret.js'   // Ref: CR-149 —— 金鑰是啟動時才備妥的，用到才拿
import { unauthorized, forbidden } from './errors.js'

const scrypt = promisify(_scrypt) as (
  pw: string | Buffer, salt: string | Buffer, len: number, opts?: object
) => Promise<Buffer>

// scrypt 是 Node 內建的，不用任何原生相依 —— Alpine 容器裡不會有編譯問題。
// N=2^15 在一般硬體上約 100ms，對登入來說是合適的成本。
// maxmem 必須明講：需要 128*N*r ≈ 33.5MB，超過 Node 預設的 32MB 上限，
// 不設會直接噴 ERR_CRYPTO_INVALID_SCRYPT_PARAMS。
const SCRYPT = { N: 32768, r: 8, p: 1 }
const MAXMEM = 96 * 1024 * 1024
const KEYLEN = 64

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, KEYLEN, { ...SCRYPT, maxmem: MAXMEM })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) return false
  const [alg, N, r, p, saltB64, keyB64] = stored.split('$')
  if (alg !== 'scrypt') return false
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scrypt(pw, salt, expected.length, { N: +N, r: +r, p: +p, maxmem: MAXMEM })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export interface AuthUser {
  id: string
  email: string
  displayName: string
}

export async function signAccessToken(u: AuthUser): Promise<string> {
  return new SignJWT({ email: u.email, name: u.displayName })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime(`${env.accessTtlSec}s`)
    .sign(jwtKey())
}

export function newRefreshToken() {
  const raw = randomBytes(48).toString('base64url')
  return { raw, hash: createHash('sha256').update(raw).digest('hex') }
}

export const hashRefreshToken = (raw: string) =>
  createHash('sha256').update(raw).digest('hex')

// ── 給機器用的長期權杖 ──────────────────────────────────
/**
 * 權杖的固定開頭。有這個字串才做得到兩件事：
 *  1. 驗證時不用猜 —— 看一眼就知道該走權杖那條路還是 JWT 那條路。
 *  2. 誤貼進程式碼、貼進聊天室時，掃描工具有東西可以比對。
 * 改這個字串等於讓所有已發出的權杖失效，不要動。
 */
export const API_TOKEN_PREFIX = 'pmflow_'

/** 清單上顯示的可辨識片段長度（前綴 + 7 碼亂數） */
const API_TOKEN_HINT_LEN = API_TOKEN_PREFIX.length + 7

/**
 * 32 位元組亂數 = 256 位元熵，猜中的機率跟猜中 UUID 一樣不值得討論。
 *
 * 雜湊用 sha256 而不是 scrypt：這不是使用者取的密碼，沒有字典可查，
 * 慢雜湊擋的攻擊在這裡不存在；而每一次 API 呼叫都要驗一次，
 * scrypt 的 100ms 成本會讓外部系統根本沒辦法用。跟 refresh token 同理。
 */
export function newApiToken() {
  const raw = API_TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return {
    raw,
    hash: hashApiToken(raw),
    prefix: raw.slice(0, API_TOKEN_HINT_LEN),
  }
}

export const hashApiToken = (raw: string) =>
  createHash('sha256').update(raw).digest('hex')

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
    /** 這次請求是哪一把權杖帶進來的。走 JWT 進來就是 undefined */
    apiTokenId?: string
  }
}

/**
 * 驗證 Authorization: Bearer，掛到 request.user。
 *
 * 兩種憑證共用同一個入口，因為**權限完全一樣** —— 拿權杖呼叫就等於發權杖的
 * 那個人在呼叫，後面所有 require* 檢查都不必知道差別。刻意不為機器另外發明
 * 一套角色：多一套就多一個會跟主線走鐘的地方，人離職時也收不乾淨。
 *
 * 走哪一條看開頭：我們自己發的權杖一定以 API_TOKEN_PREFIX 起頭，JWT 不可能
 * 長成那樣（它一定是 base64url 的 `{"alg"...` 也就是 `eyJ`）。所以既有的
 * 瀏覽器登入那條路的行為一個字都沒有改變。
 */
export async function authenticate(req: FastifyRequest): Promise<AuthUser> {
  const header = req.headers.authorization
  let credential: string | undefined
  if (header?.startsWith('Bearer ')) {
    credential = header.slice(7)
  } else if (typeof (req.query as Record<string, unknown> | undefined)?.token === 'string') {
    credential = (req.query as Record<string, string>).token
  } else if (typeof (req.query as Record<string, unknown> | undefined)?.access_token === 'string') {
    credential = (req.query as Record<string, string>).access_token
  }

  if (!credential) throw unauthorized()

  if (credential.startsWith(API_TOKEN_PREFIX)) return authenticateApiToken(req, credential)

  try {
    const { payload } = await jwtVerify(credential, jwtKey())
    const user: AuthUser = {
      id: payload.sub as string,
      email: payload.email as string,
      displayName: payload.name as string,
    }
    req.user = user
    return user
  } catch {
    throw unauthorized('登入已過期，請重新登入')
  }
}

/**
 * 權杖驗證。查得到雜湊只是第一關，還要確認它沒被撤銷、沒過期，
 * 而且**背後那個人現在還是啟用中的帳號** —— 帳號被停用時沒有人會記得去
 * 撤他的權杖，所以這裡每次都重新確認一次 status。
 */
async function authenticateApiToken(req: FastifyRequest, raw: string): Promise<AuthUser> {
  const [row] = await sql<{
    id: string; user_id: string; email: string; display_name: string
    status: string; revoked: boolean; expired: boolean; stale: boolean
  }[]>`
    SELECT t.id, t.user_id, u.email, u.display_name, u.status,
           (t.revoked_at IS NOT NULL) AS revoked,
           (t.expires_at IS NOT NULL AND t.expires_at < now()) AS expired,
           (t.last_used_at IS NULL OR t.last_used_at < now() - interval '1 minute') AS stale
    FROM api_token t JOIN app_user u ON u.id = t.user_id
    WHERE t.token_hash = ${hashApiToken(raw)}`

  // 無效、撤銷、過期一律回同一句話：訊息分得越細，拿到權杖的人越好猜
  if (!row || row.revoked || row.expired) throw unauthorized('權杖無效、已撤銷或已過期')
  if (row.status !== 'ACTIVE') throw forbidden('這個帳號已被停用')

  // 「最後使用時間」只是給人看的參考值，不值得讓每一次呼叫都多一次寫入。
  // 一分鐘內只寫一次，而且不等它完成 —— 寫失敗也不該讓 API 呼叫失敗。
  if (row.stale) {
    void sql`UPDATE api_token SET last_used_at = now() WHERE id = ${row.id}`.catch(() => {})
  }

  const user: AuthUser = { id: row.user_id, email: row.email, displayName: row.display_name }
  req.user = user
  req.apiTokenId = row.id
  return user
}

export type ProjectRole = 'MANAGER' | 'EDITOR' | 'VIEWER'
const RANK: Record<ProjectRole, number> = { VIEWER: 0, EDITOR: 1, MANAGER: 2 }

/**
 * 檢查使用者是否為環境變數指定的超級管理者 (Super Admin)。
 * 超級管理者在全系統任何工作區與專案皆具備全域最高權限。
 */
export async function isSuperAdmin(userOrId: AuthUser | string | null | undefined): Promise<boolean> {
  if (!userOrId) return false
  if (!env.adminEmails.length) return false
  if (typeof userOrId === 'object' && userOrId.email) {
    return env.adminEmails.includes(userOrId.email.toLowerCase())
  }
  const userId = typeof userOrId === 'string' ? userOrId : (userOrId as AuthUser).id
  if (!userId) return false
  const [row] = await sql<{ email: string }[]>`SELECT email FROM app_user WHERE id = ${userId}`
  if (!row?.email) return false
  return env.adminEmails.includes(row.email.toLowerCase())
}

/**
 * 代理人：請假的時候可以指定一個人代他，**代理期間就是那筆請假的起訖日**
 * （見 migrations/0016_leave_deputy.sql）。
 *
 * 實作的原則只有一句：**在既有的判斷裡把代理人當成請假者本人**，兩邊取聯集。
 * 刻意不發一個新角色、也不另外做一套平行的權限檢查 —— 多一套就多一個
 * 會跟主線走鐘的地方，而且事後沒有人查得出某個人到底是憑什麼改到那張任務。
 * 所以這條規則只落在兩個點上：
 *   1. 這裡（專案角色取聯集）—— 決定「進不進得去、能不能編輯」。
 *   2. routes/tasks.ts 的 assertCanEditTask —— 決定「是不是這張任務的關係人」。
 *
 * **不做遞迴**：A 代 B、B 代 C 不等於 A 代 C。下面的 SQL 只往回找一層
 * leave_record，沒有遞迴查詢就是這條規則的實作。
 *
 * 日期比較用 CURRENT_DATE：容器的 TZ 是 Asia/Taipei，跟整份程式判斷逾期
 * （lib/inquiry.ts）用的是同一個基準，不要在這裡自己算今天。
 */
/**
 * 專案層權限檢查。所有路由都必須走這裡拿 projectId，
 * 不可以直接信任前端傳來的 workspaceId。
 *
 * 回傳的是**有效角色** = 自己的角色 ∪ 目前代理中的那些人的角色，取最高的那個。
 * 代理進來的權限跟自己原本的權限沒有先後 —— 誰高就用誰，這就是「取聯集」。
 * 一個查詢就把兩邊都撈出來，不為了代理再多跑一趟。
 */
export async function requireProjectRole(
  userId: string, projectId: string, min: ProjectRole
): Promise<{ role: ProjectRole; workspaceId: string }> {
  const rows = await sql<{ role: ProjectRole | null; workspace_id: string; ws_role: string | null }[]>`
    SELECT pm.role, p.workspace_id, wm.role AS ws_role
    FROM project p
    LEFT JOIN project_member pm ON pm.project_id = p.id
      AND (
        pm.user_id = ${userId}
        -- 我今天正在代理的人，他在這個專案裡的角色也算我的。
        -- 限定同一個工作區：在 A 工作區請的假，不該讓人在 B 工作區的專案裡動手。
        OR EXISTS (
          SELECT 1 FROM leave_record l
          WHERE l.deputy_id = ${userId}
            AND l.user_id = pm.user_id
            AND l.workspace_id = p.workspace_id
            AND CURRENT_DATE BETWEEN l.start_date AND l.end_date
        )
      )
    LEFT JOIN workspace_member wm
      ON wm.workspace_id = p.workspace_id AND wm.user_id = ${userId}
    WHERE p.id = ${projectId}`
  if (!rows.length) throw forbidden('找不到專案，或你沒有權限')
  // 超級管理者或系統管理者（工作區 OWNER/ADMIN）在任何專案裡都具備最高管理者 (MANAGER) 權限
  const isSuper = await isSuperAdmin(userId)
  const candidates = rows.map(r => r.role).filter((r): r is ProjectRole => !!r)
  if (isSuper || rows.some(r => r.ws_role === 'OWNER' || r.ws_role === 'ADMIN')) candidates.push('MANAGER')
  if (!candidates.length) throw forbidden('你不是這個專案的成員')
  const role = candidates.reduce((a, b) => (RANK[b] > RANK[a] ? b : a))
  if (RANK[role] < RANK[min]) throw forbidden(`這個操作需要 ${min} 以上權限，你目前是 ${role}`)
  return { role, workspaceId: rows[0].workspace_id }
}

/**
 * 今天我正在代理哪些人。
 *
 * 只給「跟身分有關」的判斷用（例如「這張任務是不是他開的」）——
 * 專案角色那一段已經在 requireProjectRole 裡一起算完了，不要再問一次。
 * 同樣不做遞迴，只看一層。
 */
export async function currentDeputyPrincipals(deputyId: string): Promise<string[]> {
  const rows = await sql<{ user_id: string }[]>`
    SELECT DISTINCT l.user_id FROM leave_record l
    WHERE l.deputy_id = ${deputyId}
      AND CURRENT_DATE BETWEEN l.start_date AND l.end_date`
  return rows.map(r => r.user_id)
}

/**
 * 這個人動不動得了「掛在某張任務底下」的資料（關聯線、對外詢問單…）。
 * Ref: CR-130
 *
 * 判準跟任務本身一致：**系統管理者／專案管理者／開單人／負責人／上面那些人的代理人**。
 * 只有專案角色是不夠的 —— 光看 EDITOR 會讓任何編輯者去動別人任務的關聯線。
 */
export async function assertTaskStakeholder(
  taskId: string, userId: string, role: ProjectRole, what = '這筆資料'
): Promise<void> {
  if (role === 'MANAGER' || (await isSuperAdmin(userId))) return
  const [row] = await sql<{ taskCreator: string | null; assigneeId: string | null; projectCreator: string | null }[]>`
    SELECT t.created_by AS "taskCreator", t.assignee_id AS "assigneeId",
           p.created_by AS "projectCreator"
    FROM task t JOIN project p ON p.id = t.project_id
    WHERE t.id = ${taskId}`
  if (!row) throw forbidden('找不到任務，或你沒有權限')

  const owners = [row.taskCreator, row.assigneeId, row.projectCreator].filter((v): v is string => !!v)
  if (owners.includes(userId)) return

  const principals = await currentDeputyPrincipals(userId)
  if (principals.some(p => owners.includes(p))) return

  throw forbidden(`只有開這張任務的人、負責人、專案管理者及其代理人可以修改${what}`)
}

/**
 * 管理成員能做的事：放人進來、核准或婉拒申請、改角色、把人移出去。
 *
 * 原本只認「開專案的那個人」，現在放寬成**這個專案的管理者**。
 * 開專案的人建立時就被寫成 MANAGER，所以舊的行為完全包含在新規則裡，
 * 沒有人因此少掉權限；差別只在於他可以再指定幾個人一起管。
 *
 * 不用 requireProjectRole(..., 'MANAGER') 是為了訊息 —— 那條路會把
 * 角色代碼原封不動吐進畫面，而成員頁的錯誤是直接顯示給人看的。
 * 順便回報他是不是建立者，成員頁有幾條保護要靠這個判斷。
 */
export async function requireProjectManager(
  userId: string, projectId: string
): Promise<{ workspaceId: string; createdBy: string | null }> {
  const rows = await sql<{
    workspace_id: string; created_by: string | null; role: ProjectRole | null; ws_role: string | null
  }[]>`
    SELECT p.workspace_id, p.created_by, pm.role, wm.role AS ws_role
    FROM project p
    LEFT JOIN project_member pm ON pm.project_id = p.id AND pm.user_id = ${userId}
    LEFT JOIN workspace_member wm ON wm.workspace_id = p.workspace_id AND wm.user_id = ${userId}
    WHERE p.id = ${projectId}`
  if (!rows.length) throw forbidden('找不到專案，或你沒有權限')
  const isSuper = await isSuperAdmin(userId)
  const isCreator = rows[0].created_by === userId
  const isOwner = rows[0].ws_role === 'OWNER' || rows[0].ws_role === 'ADMIN'
  const isManager = rows[0].role === 'MANAGER'
  if (!isSuper && !isCreator && !isOwner && !isManager) {
    throw forbidden('只有專案建立者或管理者以上可以更改與保存系統參數')
  }
  return { workspaceId: rows[0].workspace_id, createdBy: rows[0].created_by }
}

/** 同一個工作區的成員才看得到、才申請得了這個工作區裡的專案 */
export async function requireWorkspaceMember(
  userId: string, workspaceId: string
): Promise<{ role: string }> {
  const rows = await sql<{ role: string }[]>`
    SELECT role FROM workspace_member
    WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
  if (!rows.length) {
    if (await isSuperAdmin(userId)) return { role: 'OWNER' }
    throw forbidden('你不是這個工作區的成員')
  }
  return rows[0]
}

/** 工作區層級的角色。OWNER 是開站的人，ADMIN 是他指定的、真正在管帳號的人 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'

/**
 * 站台管理者、擁有者與專案管理者能做的事：開帳號、停用帳號、刪帳號、代設密碼。
 *
 * 允許角色為 OWNER 或 ADMIN 的使用者，或在該工作區任一專案為 MANAGER 的專案管理者皆可進行成員管理。
 */
export async function requireWorkspaceAdmin(
  userId: string, workspaceId: string
): Promise<{ role: WorkspaceRole }> {
  if (await isSuperAdmin(userId)) return { role: 'OWNER' }
  const { role } = await requireWorkspaceMember(userId, workspaceId)
  if (role === 'OWNER') return { role: 'OWNER' }
  if (role === 'ADMIN') return { role: 'ADMIN' }

  // 若使用者的 workspace_member.role 不是 OWNER/ADMIN，但為該工作區內專案的建立者（擁有者）或管理者，亦賦予相應角色
  const [projectOwner] = await sql<{ id: string }[]>`
    SELECT p.id FROM project p
    WHERE p.workspace_id = ${workspaceId} AND p.created_by = ${userId}
    LIMIT 1`
  if (projectOwner) {
    return { role: 'OWNER' }
  }

  const [projectManager] = await sql<{ id: string }[]>`
    SELECT p.id FROM project p
    JOIN project_member pm ON pm.project_id = p.id AND pm.user_id = ${userId}
    WHERE p.workspace_id = ${workspaceId} AND pm.role = 'MANAGER'
    LIMIT 1`

  if (projectManager) {
    return { role: 'ADMIN' }
  }

  throw forbidden('這個操作需要工作區管理者、擁有者或專案管理者權限')
}

/** 擁有者專用。他唯一還能對別人的帳號做的事，就是決定誰是管理者 */
export async function requireWorkspaceOwner(
  userId: string, workspaceId: string
): Promise<{ role: WorkspaceRole }> {
  if (await isSuperAdmin(userId)) return { role: 'OWNER' }
  const { role } = await requireWorkspaceMember(userId, workspaceId)
  if (role === 'OWNER') return { role: 'OWNER' }

  // 專案建立者亦視同專案層級之擁有者
  const [projectOwner] = await sql<{ id: string }[]>`
    SELECT p.id FROM project p
    WHERE p.workspace_id = ${workspaceId} AND p.created_by = ${userId}
    LIMIT 1`
  if (projectOwner) {
    return { role: 'OWNER' }
  }

  throw forbidden('只有工作區的擁有者可以指派管理者')
}

/**
 * 由 task id 反查專案再驗權限。
 * 子資源端點（/tasks/:id、/inquiries/:id、/links/:id）一定要走這條，
 * 不能因為前端拿得到 id 就放行 —— 這正是 Vikunja 2026 那個關聯 IDOR 的成因。
 */
export async function requireTaskAccess(
  userId: string, taskId: string, min: ProjectRole
): Promise<{ role: ProjectRole; workspaceId: string; projectId: string }> {
  const rows = await sql<{ project_id: string }[]>`
    SELECT project_id FROM task WHERE id = ${taskId} AND deleted_at IS NULL`
  if (!rows.length) throw forbidden('找不到任務，或你沒有權限')
  const projectId = rows[0].project_id
  const r = await requireProjectRole(userId, projectId, min)
  return { ...r, projectId }
}
