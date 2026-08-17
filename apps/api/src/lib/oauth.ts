import { randomBytes, createHash } from 'node:crypto'
import {
  SignJWT, jwtVerify, createRemoteJWKSet, importPKCS8, decodeJwt,
} from 'jose'
import { env } from './env.js'
import { badRequest } from './errors.js'
// Ref: CR-149 —— state／綁定券／Facebook 內部 JWT 都用站台的簽章金鑰，用到才拿
import { jwtKey } from './secret.js'

/**
 * 用 Google／Apple／Facebook 的帳號登入 —— 協定那一層。
 *
 * 這個檔只做「跟對方講話」：組授權網址、拿授權碼換權杖、驗那張 id_token。
 * 「換到的人是誰、要開新帳號還是綁到既有帳號」是產品規則，在 routes/oauth.ts。
 */

export const PROVIDERS = ['GOOGLE', 'APPLE', 'FACEBOOK'] as const
export type ProviderId = (typeof PROVIDERS)[number]

/** 網址上用小寫（/auth/oauth/google/...），資料庫與程式裡用大寫 */
export function toProviderId(s: string): ProviderId | null {
  const up = s.toUpperCase()
  return (PROVIDERS as readonly string[]).includes(up) ? (up as ProviderId) : null
}

/** 講給人聽的名字。畫面上與錯誤訊息都用這個，不要出現 provider 代碼 */
export const PROVIDER_LABEL: Record<ProviderId, string> = {
  GOOGLE: 'Google',
  APPLE: 'Apple',
  FACEBOOK: 'Facebook',
}

interface ProviderMeta {
  authorizeUrl: string
  tokenUrl: string
  jwksUrl: string
  issuer: string
  scope: string
  formPost: boolean
}

const META: Record<ProviderId, ProviderMeta> = {
  GOOGLE: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
    scope: 'openid email profile',
    formPost: false,
  },
  APPLE: {
    authorizeUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuer: 'https://appleid.apple.com',
    scope: 'name email',
    formPost: true,
  },
  FACEBOOK: {
    authorizeUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    jwksUrl: '',
    issuer: 'https://www.facebook.com',
    scope: 'email,public_profile',
    formPost: false,
  },
}

/** 每家的 client id。Apple 用的是 Services ID，不是 App ID */
export const clientId = (p: ProviderId): string => {
  if (p === 'GOOGLE') return env.oauth.google.clientId
  if (p === 'APPLE') return env.oauth.apple.clientId
  return env.oauth.facebook.clientId
}

/**
 * 這一家設定齊了沒有。
 *
 * `publicUrl` 也算在內：callback 網址是拿它拼出來的，沒有它連授權網址都組不出來。
 * 沒齊的那一家登入頁不會畫按鈕，端點也會回一句看得懂的話（不是 500）。
 */
export function isProviderConfigured(p: ProviderId): boolean {
  if (!env.publicUrl) return false
  if (p === 'GOOGLE') {
    return !!(env.oauth.google.clientId && env.oauth.google.clientSecret)
  }
  if (p === 'FACEBOOK') {
    return !!(env.oauth.facebook.clientId && env.oauth.facebook.clientSecret)
  }
  const a = env.oauth.apple
  return !!(a.clientId && a.teamId && a.keyId && a.privateKey)
}

export const configuredProviders = (): ProviderId[] => PROVIDERS.filter(isProviderConfigured)

/** 設定不齊時到底缺什麼，只回給呼叫端點的人看（不會出現在登入頁上） */
export function assertConfigured(p: ProviderId): void {
  if (isProviderConfigured(p)) return
  const label = PROVIDER_LABEL[p]
  if (!env.publicUrl) {
    throw badRequest(
      `這個站還沒有啟用「用 ${label} 帳號登入」`,
      '尚未設定站台的對外網址（PMFLOW_PUBLIC_URL），callback 網址組不出來。' +
      '設定步驟見 README。')
  }
  if (p === 'GOOGLE') {
    throw badRequest(`這個站還沒有啟用「用 ${label} 帳號登入」`, '缺少 PMFLOW_GOOGLE_CLIENT_ID 或 PMFLOW_GOOGLE_CLIENT_SECRET。設定步驟見 README。')
  }
  if (p === 'FACEBOOK') {
    throw badRequest(`這個站還沒有啟用「用 ${label} 帳號登入」`, '缺少 PMFLOW_FACEBOOK_CLIENT_ID 或 PMFLOW_FACEBOOK_CLIENT_SECRET。設定步驟見 README。')
  }
  throw badRequest(
    `這個站還沒有啟用「用 ${label} 帳號登入」`,
    '缺少 PMFLOW_APPLE_CLIENT_ID／TEAM_ID／KEY_ID／PRIVATE_KEY 其中之一。設定步驟見 README。')
}

/**
 * callback 網址。跟申請時登記的必須一字不差，
 * 所以它是從 PMFLOW_PUBLIC_URL 拼出來的，不從請求標頭猜
 */
export const redirectUri = (p: ProviderId): string =>
  `${env.publicUrl}/api/v1/auth/oauth/${p.toLowerCase()}/callback`

// ── state：綁瀏覽器、綁這一次流程 ──────────────────────────

/** state 的有效期。使用者在對方的頁面上磨蹭太久就重按一次，比放寬到一小時安全 */
const STATE_TTL = '10m'

/** 綁定流程用的一次性入場券：從已登入的頁面換出來，只活 60 秒 */
const LINK_TICKET_TTL = '60s'

export type OauthMode = 'login' | 'link'

export interface OauthState {
  provider: ProviderId
  mode: OauthMode
  /** 綁定模式才有：要把這個身分綁到誰身上 */
  userId?: string
  nonce: string
  /** cookie 裡那段亂數的雜湊。對不起來就是別人誘導出來的 callback */
  cookieHash: string
}

/** cookie 與 state 是一組的：cookie 存亂數本體，state 存它的雜湊 */
export function newStateSecret() {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: createHash('sha256').update(raw).digest('hex') }
}

export const hashStateSecret = (raw: string) =>
  createHash('sha256').update(raw).digest('hex')

export async function signState(s: OauthState): Promise<string> {
  return new SignJWT({
    p: s.provider, m: s.mode, u: s.userId, n: s.nonce, c: s.cookieHash,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(jwtKey())
}

export async function verifyState(token: string): Promise<OauthState> {
  const payload = await jwtVerify(token, jwtKey()).then(r => r.payload).catch(() => {
    throw badRequest(
      '這次登入的識別碼已失效，請重新登入一次',
      '授權頁面停留超過 10 分鐘，或這個連結不是從登入頁按出來的。')
  })
  const provider = toProviderId(String(payload.p ?? ''))
  if (!provider) throw badRequest('登入流程的識別碼不正確，請重新登入一次')
  return {
    provider,
    mode: payload.m === 'link' ? 'link' : 'login',
    userId: payload.u ? String(payload.u) : undefined,
    nonce: String(payload.n ?? ''),
    cookieHash: String(payload.c ?? ''),
  }
}

export async function signLinkTicket(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'oauth-link' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(LINK_TICKET_TTL)
    .sign(jwtKey())
}

export async function verifyLinkTicket(ticket: string): Promise<string> {
  const payload = await jwtVerify(ticket, jwtKey()).then(r => r.payload).catch(() => {
    throw badRequest(
      '這張綁定用的憑證已失效，請回到帳號設定再按一次',
      '它只有 60 秒的有效期，這樣就算網址被記進日誌也拿不來做別的事。')
  })
  if (payload.purpose !== 'oauth-link' || !payload.sub) {
    throw badRequest('這張綁定用的憑證不正確，請回到帳號設定再按一次')
  }
  return payload.sub
}

export const newNonce = () => randomBytes(16).toString('base64url')

// ── 導向授權頁 ─────────────────────────────────────────────

export function authorizeUrl(p: ProviderId, state: string, nonce: string): string {
  const meta = META[p]
  const q = new URLSearchParams({
    client_id: clientId(p),
    redirect_uri: redirectUri(p),
    response_type: 'code',
    scope: meta.scope,
    state,
    nonce,
  })
  if (meta.formPost) q.set('response_mode', 'form_post')
  if (p === 'GOOGLE') q.set('prompt', 'select_account')
  return `${meta.authorizeUrl}?${q}`
}

export const usesFormPost = (p: ProviderId): boolean => META[p].formPost

// ── Apple 的 client secret：現算的 ES256 JWT ─────────────────

async function appleClientSecret(): Promise<string> {
  const a = env.oauth.apple
  const key = await importPKCS8(a.privateKey, 'ES256')
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: a.keyId })
    .setIssuer(a.teamId)
    .setSubject(a.clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key)
}

const clientSecret = async (p: ProviderId): Promise<string> => {
  if (p === 'GOOGLE') return env.oauth.google.clientSecret
  if (p === 'APPLE') return appleClientSecret()
  return env.oauth.facebook.clientSecret
}

// ── 授權碼換權杖 ───────────────────────────────────────────

interface TokenResponse {
  id_token?: string
  access_token?: string
  error?: string
  error_description?: string
}

export async function exchangeCode(p: ProviderId, code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(p),
    client_id: clientId(p),
    client_secret: await clientSecret(p),
  })

  const res = await fetch(META[p].tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)

  if (!res) {
    throw badRequest(
      `連不上 ${PROVIDER_LABEL[p]}`,
      '這台伺服器要連得到外網才能完成登入，請檢查對外連線或防火牆。')
  }

  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || (!data.id_token && !data.access_token)) {
    throw badRequest(
      `${PROVIDER_LABEL[p]} 沒有核發登入權杖`,
      data.error_description ?? data.error ?? `對方回應 HTTP ${res.status}`)
  }

  // Facebook 不發 id_token，拿 access_token 呼叫 Graph API 取得個人資料並封裝成內部簽章 JWT
  if (p === 'FACEBOOK' && data.access_token) {
    const fbRes = await fetch(
      `https://graph.facebook.com/v20.0/me?fields=id,name,email&access_token=${encodeURIComponent(data.access_token)}`,
      { signal: AbortSignal.timeout(10_000) }
    ).catch(() => null)
    if (!fbRes || !fbRes.ok) {
      throw badRequest('無法從 Facebook 取得個人資訊，請重試')
    }
    const fbProfile = (await fbRes.json().catch(() => ({}))) as { id?: string; name?: string; email?: string }
    if (!fbProfile.id) throw badRequest('Facebook 回傳的使用者識別碼無效')

    // 簽一張內部 JWT
    return new SignJWT({
      sub: String(fbProfile.id),
      name: fbProfile.name ?? '',
      email: fbProfile.email ?? '',
      email_verified: !!fbProfile.email,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(META.FACEBOOK.issuer)
      .setAudience(clientId('FACEBOOK'))
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(jwtKey())
  }

  return data.id_token!
}

// ── 驗 id_token ───────────────────────────────────────────

const jwks: Record<'GOOGLE' | 'APPLE', ReturnType<typeof createRemoteJWKSet>> = {
  GOOGLE: createRemoteJWKSet(new URL(META.GOOGLE.jwksUrl)),
  APPLE: createRemoteJWKSet(new URL(META.APPLE.jwksUrl)),
}

export interface IdentityClaims {
  subject: string
  email: string | null
  emailVerified: boolean
  displayName: string | null
}

export async function verifyIdToken(
  p: ProviderId, idToken: string, expectedNonce: string
): Promise<IdentityClaims> {
  let payload: Record<string, unknown>
  try {
    if (p === 'FACEBOOK') {
      const res = await jwtVerify(idToken, jwtKey(), {
        issuer: META.FACEBOOK.issuer,
        audience: clientId('FACEBOOK'),
      })
      payload = res.payload as Record<string, unknown>
    } else {
      const res = await jwtVerify(idToken, jwks[p], {
        issuer: META[p].issuer,
        audience: clientId(p),
      })
      payload = res.payload as Record<string, unknown>
    }
  } catch {
    throw badRequest(
      `${PROVIDER_LABEL[p]} 回傳的登入憑證無法驗證`,
      '簽章、發行者或有效期不正確。請重新登入一次；持續失敗請確認站台時間是否正確。')
  }

  // nonce 對不上代表這張 token 不是這一次流程換來的
  if (expectedNonce && p !== 'FACEBOOK' && payload.nonce !== expectedNonce) {
    throw badRequest('登入流程對不起來，請重新登入一次')
  }

  const raw = payload.email_verified
  const emailVerified = raw === true || raw === 'true'

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''

  return {
    subject: String(payload.sub),
    email: email || null,
    emailVerified,
    displayName: name || null,
  }
}

export function appleNameFromForm(userField: unknown): string | null {
  if (typeof userField !== 'string' || !userField.trim()) return null
  try {
    const parsed = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } }
    const parts = [parsed.name?.lastName, parsed.name?.firstName]
      .map(s => (s ?? '').trim()).filter(Boolean)
    return parts.length ? parts.join(' ') : null
  } catch { return null }
}

export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  return local.trim() || email
}

export const peekJwt = (token: string) => {
  try { return decodeJwt(token) } catch { return null }
}
