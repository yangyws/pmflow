import type { FastifyInstance } from 'fastify'
import type { TransactionSql } from 'postgres'
import { z } from 'zod'
import { sql } from '../lib/db.js'
import { authenticate, requireProjectRole, requireTaskAccess } from '../lib/auth.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'

/*
 * 圖的排版與整份畫布內容。Ref: CR-138
 *
 * 這一支刻意跟 tasks.ts / links.ts 分開：它存的是**畫面長什麼樣**，
 * 不是任務本身。權限也因此不一樣 —— 排版是**專案共用的**，
 * 誰排的就是大家看到的，所以只看專案角色（讀 VIEWER、寫 EDITOR），
 * 不套 CR-130 那條「非關係人不能改別人建的資料」。
 * 卡片擺在哪裡不是誰的私有財產，套上去只會讓一張圖上永遠有幾張別人排不動的卡片。
 */

/** view_key / doc_key：前端自己取名，不做白名單（多一個視角不該要一次 migration） */
const KEY = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, '視角代號只能用小寫英數、底線與減號')

/** 一次最多幾個節點。一個專案的圖再大也不該到這個量級，超過多半是前端送錯東西 */
const MAX_NODES = 5000
/** 整份 jsonb 的上限。全域 bodyLimit 是 5MB，這裡再收一道，錯誤訊息才講得清楚 */
const MAX_DOC_BYTES = 2 * 1024 * 1024

const nodeValue = z.object({
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().min(0).max(100000).optional(),
  height: z.number().finite().min(0).max(100000).optional(),
  /** 'card' / 'box'…前端自己定義。null 代表清掉，回到預設 */
  mode: z.string().max(40).nullable().optional(),
})

const nodesBody = z.object({
  nodes: z.record(z.string().min(1).max(200), nodeValue)
    .refine(n => Object.keys(n).length <= MAX_NODES, `一次最多 ${MAX_NODES} 個節點`),
  /** 只有 PATCH 會用到：把這幾個節點的排版刪掉 */
  remove: z.array(z.string().min(1).max(200)).max(MAX_NODES).optional(),
})

const docBody = z.object({
  data: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  /**
   * 樂觀鎖。帶上你讀到的那個 updatedAt，中間有人改過就回 409，
   * 不會默默把對方的東西蓋掉。不帶就是「我確定要覆蓋」。
   */
  baseUpdatedAt: z.string().optional(),
})

const handlesBody = z.object({
  sourceHandle: z.string().max(80).nullable().optional(),
  targetHandle: z.string().max(80).nullable().optional(),
})

interface NodeRow {
  nodeId: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  mode: string | null
}

const toMap = (rows: NodeRow[]) => {
  const out: Record<string, Record<string, unknown>> = {}
  for (const r of rows) {
    const v: Record<string, unknown> = {}
    if (r.x !== null) v.x = r.x
    if (r.y !== null) v.y = r.y
    if (r.width !== null) v.width = r.width
    if (r.height !== null) v.height = r.height
    if (r.mode !== null) v.mode = r.mode
    out[r.nodeId] = v
  }
  return out
}

const readNodes = (projectId: string, viewKey: string) => sql<NodeRow[]>`
  SELECT node_id AS "nodeId", x, y, width, height, mode
  FROM project_canvas_node
  WHERE project_id = ${projectId} AND view_key = ${viewKey}`

const readMeta = (projectId: string, viewKey: string) => sql<{
  updatedAt: Date | null; updatedBy: string | null; updatedByName: string | null
}[]>`
  SELECT c.updated_at AS "updatedAt", c.updated_by AS "updatedBy",
         u.display_name AS "updatedByName"
  FROM project_canvas_node c
  LEFT JOIN app_user u ON u.id = c.updated_by
  WHERE c.project_id = ${projectId} AND c.view_key = ${viewKey}
  ORDER BY c.updated_at DESC LIMIT 1`

export default async function canvasRoutes(app: FastifyInstance) {

  // ── 每個節點一列的排版（座標、寬高、收納模式）─────────────

  /** 讀一個視角的整份排版。沒存過就回空的 map，不是 404 —— 前端不必分兩種情況處理 */
  app.get<{ Params: { id: string; viewKey: string } }>(
    '/projects/:id/canvas/:viewKey', async req => {
      const user = await authenticate(req)
      await requireProjectRole(user.id, req.params.id, 'VIEWER')
      const viewKey = KEY.parse(req.params.viewKey)

      const [rows, meta] = await Promise.all([
        readNodes(req.params.id, viewKey),
        readMeta(req.params.id, viewKey),
      ])
      return {
        viewKey,
        nodes: toMap(rows),
        updatedAt: meta[0]?.updatedAt ?? null,
        updatedBy: meta[0]?.updatedBy ?? null,
        updatedByName: meta[0]?.updatedByName ?? null,
      }
    })

  /**
   * 整份覆蓋。「重新自動排版之後存起來」用這個 —— 沒送到的節點會被刪掉。
   * 日常拖曳不要用它：兩個人同時各拖各的會互相蓋掉，那種情況用 PATCH。
   */
  app.put<{ Params: { id: string; viewKey: string } }>(
    '/projects/:id/canvas/:viewKey', async req => {
      const user = await authenticate(req)
      await requireProjectRole(user.id, req.params.id, 'EDITOR')
      const viewKey = KEY.parse(req.params.viewKey)
      const b = nodesBody.parse(req.body)
      const entries = Object.entries(b.nodes)

      await sql.begin(async tx => {
        const keep = entries.map(([k]) => k)
        if (keep.length) {
          await tx`
            DELETE FROM project_canvas_node
            WHERE project_id = ${req.params.id} AND view_key = ${viewKey}
              AND node_id <> ALL(${keep})`
        } else {
          await tx`
            DELETE FROM project_canvas_node
            WHERE project_id = ${req.params.id} AND view_key = ${viewKey}`
        }
        await upsert(tx, req.params.id, viewKey, entries, user.id, false)
        await linkTaskIds(tx, req.params.id, viewKey)
      })

      return { viewKey, nodes: toMap(await readNodes(req.params.id, viewKey)) }
    })

  /**
   * 逐節點合併。**拖曳存檔一律用這個。**
   * 只送動到的那幾個，沒送到的別人排的位置一個字都不會動 ——
   * 這就是為什麼座標要一個節點一列，而不是整份 json 存一格。
   * 單一欄位也是合併的：只送 mode 不會把座標洗成 NULL。
   */
  app.patch<{ Params: { id: string; viewKey: string } }>(
    '/projects/:id/canvas/:viewKey', async req => {
      const user = await authenticate(req)
      await requireProjectRole(user.id, req.params.id, 'EDITOR')
      const viewKey = KEY.parse(req.params.viewKey)
      const b = nodesBody.parse(req.body)
      const entries = Object.entries(b.nodes)

      await sql.begin(async tx => {
        if (b.remove?.length) {
          await tx`
            DELETE FROM project_canvas_node
            WHERE project_id = ${req.params.id} AND view_key = ${viewKey}
              AND node_id = ANY(${b.remove})`
        }
        await upsert(tx, req.params.id, viewKey, entries, user.id, true)
        await linkTaskIds(tx, req.params.id, viewKey)
      })

      return { viewKey, nodes: toMap(await readNodes(req.params.id, viewKey)) }
    })

  /** 「重置排版」按鈕。整個視角清掉，下次進來就是自動排版的結果 */
  app.delete<{ Params: { id: string; viewKey: string } }>(
    '/projects/:id/canvas/:viewKey', async (req, reply) => {
      const user = await authenticate(req)
      await requireProjectRole(user.id, req.params.id, 'EDITOR')
      const viewKey = KEY.parse(req.params.viewKey)
      await sql`
        DELETE FROM project_canvas_node
        WHERE project_id = ${req.params.id} AND view_key = ${viewKey}`
      return reply.code(204).send()
    })

  // ── 一個 view 一份 jsonb（系統流程圖、語法演練片段）──────

  app.get<{ Params: { id: string; docKey: string } }>(
    '/projects/:id/canvas-docs/:docKey', async req => {
      const user = await authenticate(req)
      await requireProjectRole(user.id, req.params.id, 'VIEWER')
      const docKey = KEY.parse(req.params.docKey)

      const [row] = await sql<{
        data: unknown; updatedAt: Date; updatedBy: string | null; updatedByName: string | null
      }[]>`
        SELECT d.data, d.updated_at AS "updatedAt", d.updated_by AS "updatedBy",
               u.display_name AS "updatedByName"
        FROM project_canvas_doc d
        LEFT JOIN app_user u ON u.id = d.updated_by
        WHERE d.project_id = ${req.params.id} AND d.doc_key = ${docKey}`

      // 沒存過回 data: null 而不是 404 —— 前端就用它來決定「要不要套內建的預設內容」
      return {
        docKey,
        data: row?.data ?? null,
        updatedAt: row?.updatedAt ?? null,
        updatedBy: row?.updatedBy ?? null,
        updatedByName: row?.updatedByName ?? null,
      }
    })

  /**
   * 整份存。系統流程圖那種「分頁 + 節點 + 連線」是一份文件，沒有辦法只存一半。
   *
   * **後寫的會蓋掉先寫的**，這是 jsonb 存整份必然的代價。要避開就帶
   * baseUpdatedAt（讀進來時拿到的那個），中間被人改過會回 409 而不是默默覆蓋。
   */
  app.put<{ Params: { id: string; docKey: string } }>(
    '/projects/:id/canvas-docs/:docKey', async req => {
      const user = await authenticate(req)
      await requireProjectRole(user.id, req.params.id, 'EDITOR')
      const docKey = KEY.parse(req.params.docKey)
      const b = docBody.parse(req.body)

      const json = JSON.stringify(b.data)
      if (Buffer.byteLength(json, 'utf8') > MAX_DOC_BYTES) {
        throw badRequest('內容太大存不下', `單一視角上限 ${MAX_DOC_BYTES / 1024 / 1024} MB`)
      }

      const saved = await sql.begin(async tx => {
        const [cur] = await tx<{ updatedAt: Date }[]>`
          SELECT updated_at AS "updatedAt" FROM project_canvas_doc
          WHERE project_id = ${req.params.id} AND doc_key = ${docKey}
          FOR UPDATE`
        if (b.baseUpdatedAt && cur && cur.updatedAt.toISOString() !== b.baseUpdatedAt) {
          throw conflict('這份內容在你編輯的期間被別人改過',
            '請重新載入，確認對方改了什麼再存一次，否則會蓋掉他的修改')
        }
        const [row] = await tx<{ updatedAt: Date }[]>`
          INSERT INTO project_canvas_doc (project_id, doc_key, data, updated_by)
          VALUES (${req.params.id}, ${docKey}, ${tx.json(b.data as never)}, ${user.id})
          ON CONFLICT (project_id, doc_key) DO UPDATE
            SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = now()
          RETURNING updated_at AS "updatedAt"`
        return row
      })

      return { docKey, updatedAt: saved.updatedAt, updatedBy: user.id }
    })

  app.delete<{ Params: { id: string; docKey: string } }>(
    '/projects/:id/canvas-docs/:docKey', async (req, reply) => {
      const user = await authenticate(req)
      await requireProjectRole(user.id, req.params.id, 'EDITOR')
      const docKey = KEY.parse(req.params.docKey)
      await sql`
        DELETE FROM project_canvas_doc
        WHERE project_id = ${req.params.id} AND doc_key = ${docKey}`
      return reply.code(204).send()
    })

  // ── 關聯線兩端的接點 ────────────────────────────────

  /**
   * 線要從卡片的哪一邊出去、接到對方的哪一邊。
   *
   * 只要 EDITOR，**不套關係人檢查** —— 這跟 links.ts 的建立／刪除不一樣：
   * 那兩件事會改變「誰依賴誰」，這件事只改變線畫在哪裡，跟拖卡片是同一類。
   */
  app.patch<{ Params: { id: string } }>('/links/:id/handles', async req => {
    const user = await authenticate(req)
    const b = handlesBody.parse(req.body)
    if (b.sourceHandle === undefined && b.targetHandle === undefined) {
      throw badRequest('沒有要修改的內容')
    }

    const [l] = await sql<{ sourceId: string }[]>`
      SELECT source_id AS "sourceId" FROM task_link WHERE id = ${req.params.id}`
    if (!l) throw notFound('找不到這條關聯')
    await requireTaskAccess(user.id, l.sourceId, 'EDITOR')

    const [row] = await sql`
      UPDATE task_link SET
        source_handle = ${b.sourceHandle === undefined ? sql`source_handle` : b.sourceHandle},
        target_handle = ${b.targetHandle === undefined ? sql`target_handle` : b.targetHandle}
      WHERE id = ${req.params.id}
      RETURNING id, source_handle AS "sourceHandle", target_handle AS "targetHandle"`
    return row
  })
}

type Tx = TransactionSql<Record<string, never>>

/**
 * 逐節點 upsert。merge=true 時空值不覆蓋既有的（PATCH 語意），
 * merge=false 時整列照送進來的樣子寫（PUT 語意）。
 */
async function upsert(
  tx: Tx, projectId: string, viewKey: string,
  entries: [string, z.infer<typeof nodeValue>][], userId: string, merge: boolean
) {
  if (!entries.length) return
  const rows = entries.map(([nodeId, v]) => ({
    project_id: projectId,
    view_key: viewKey,
    node_id: nodeId,
    x: v.x ?? null,
    y: v.y ?? null,
    width: v.width ?? null,
    height: v.height ?? null,
    mode: v.mode ?? null,
    updated_by: userId,
  }))
  const cols = [
    'project_id', 'view_key', 'node_id', 'x', 'y', 'width', 'height', 'mode', 'updated_by',
  ] as const

  if (merge) {
    await tx`
      INSERT INTO project_canvas_node ${tx(rows, ...cols)}
      ON CONFLICT (project_id, view_key, node_id) DO UPDATE SET
        x = COALESCE(EXCLUDED.x, project_canvas_node.x),
        y = COALESCE(EXCLUDED.y, project_canvas_node.y),
        width = COALESCE(EXCLUDED.width, project_canvas_node.width),
        height = COALESCE(EXCLUDED.height, project_canvas_node.height),
        mode = COALESCE(EXCLUDED.mode, project_canvas_node.mode),
        updated_at = now(), updated_by = EXCLUDED.updated_by`
  } else {
    await tx`
      INSERT INTO project_canvas_node ${tx(rows, ...cols)}
      ON CONFLICT (project_id, view_key, node_id) DO UPDATE SET
        x = EXCLUDED.x, y = EXCLUDED.y,
        width = EXCLUDED.width, height = EXCLUDED.height, mode = EXCLUDED.mode,
        updated_at = now(), updated_by = EXCLUDED.updated_by`
  }
}

/**
 * 把指得回任務的那些節點掛上 task_id，任務被刪掉時排版才會跟著級聯清掉。
 *
 * 比對用 t.id::text = c.node_id 而不是把 node_id 轉成 uuid：
 * 圖上的虛擬節點（同時開始的橘點、收納盒）id 根本不是 uuid，
 * 反過來轉會整批寫入直接噴錯。
 */
function linkTaskIds(tx: Tx, projectId: string, viewKey: string) {
  return tx`
    UPDATE project_canvas_node c SET task_id = t.id
    FROM task t
    WHERE c.project_id = ${projectId} AND c.view_key = ${viewKey}
      AND t.project_id = ${projectId} AND t.id::text = c.node_id
      AND c.task_id IS DISTINCT FROM t.id`
}
