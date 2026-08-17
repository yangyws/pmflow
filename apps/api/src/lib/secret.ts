import { randomBytes } from 'node:crypto'
import { sql } from './db.js'
import { env } from './env.js'

/**
 * JWT 簽章金鑰的取得。Ref: CR-149
 *
 * 兩條路，優先序固定：
 *  1. **有設 PMFLOW_JWT_SECRET（≥32 字元）就一律以它為準。**
 *     既有部署一個字都不用改，行為與過去完全相同。
 *  2. 沒設 → 第一次啟動自己產一組**存進資料庫**，之後每次啟動都讀回同一組。
 *     以前的做法是「正式環境沒設就拒絕啟動、開發環境每次隨機」——
 *     前者讓人被迫把金鑰寫死在公開的 compose 檔裡（那比沒有更糟），
 *     後者讓每次重啟所有人被登出。
 *
 * 為什麼存資料庫不存檔案：資料庫是備份排程裡本來就有的那一份，容器重建、
 * 換映像、換 NAS 都跟著走；檔案要另外挑一個掛載路徑，而那個路徑每個人都不一樣，
 * 沒掛到就等於每次重建都換一把金鑰（全站登出），而且不會有人發現。
 *
 * **時序**：金鑰可能要查資料庫，所以不能像以前那樣在模組載入時就算好。
 * 這支模組只在 index.ts 啟動流程裡（migrate() 之後、app.listen() 之前）
 * 初始化一次，其他地方一律用 jwtKey() 現拿 —— 沒初始化就直接丟例外，
 * 不會安靜地用 undefined 當金鑰簽出誰都驗得過的權杖。
 */
const JWT_SECRET_KEY = 'jwt_secret'

let cached: Uint8Array | null = null

interface Logger { info(o: object, m?: string): void; warn(o: object, m?: string): void }

export async function initJwtSecret(log?: Logger): Promise<void> {
  if (cached) return

  if (env.jwtSecret) {
    cached = new TextEncoder().encode(env.jwtSecret)
    return
  }

  /*
   * 並行安全：兩個實例同時第一次啟動時，各自產一組是不行的
   * （兩邊簽出來的權杖對方都驗不過，使用者會互相被踢掉）。
   * INSERT ... ON CONFLICT DO NOTHING 只會有一個人寫成功，
   * 然後**兩邊都以資料庫裡那一筆為準** —— 自己產的那組寫不進去就丟掉。
   */
  const candidate = randomBytes(48).toString('base64')
  await sql`
    INSERT INTO app_secret (key, value) VALUES (${JWT_SECRET_KEY}, ${candidate})
    ON CONFLICT (key) DO NOTHING`
  const [row] = await sql<{ value: string }[]>`
    SELECT value FROM app_secret WHERE key = ${JWT_SECRET_KEY}`
  if (!row?.value) throw new Error('無法取得或建立 JWT 簽章金鑰（app_secret）')

  cached = new TextEncoder().encode(row.value)
  log?.[row.value === candidate ? 'info' : 'warn'](
    { generated: row.value === candidate },
    row.value === candidate
      ? '未設定 PMFLOW_JWT_SECRET，已自動產生一組並存入資料庫（之後重啟沿用同一組）'
      : '未設定 PMFLOW_JWT_SECRET，沿用資料庫裡既有的那一組')
}

/** 現拿金鑰。初始化之前呼叫是程式錯誤，寧可炸掉也不要簽出無效的權杖 */
export function jwtKey(): Uint8Array {
  if (!cached) {
    throw new Error(
      'JWT 簽章金鑰尚未初始化：initJwtSecret() 必須在 migrate() 之後、' +
      '任何簽章／驗章之前呼叫（見 index.ts 的啟動流程）')
  }
  return cached
}
