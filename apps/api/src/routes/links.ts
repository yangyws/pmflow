import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql } from '../lib/db.js'
import { assertTaskStakeholder, authenticate, requireTaskAccess } from '../lib/auth.js'
import { assertNoCycle, isScheduling, SYMMETRIC } from '../lib/graph.js'
import { notify } from '../lib/notify.js'
import { emitRealtimeEvent } from '../lib/events.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'

const createBody = z.object({
  targetId: z.string().uuid(),
  linkType: z.enum(['FS', 'SS', 'FF', 'SF', 'RELATES', 'BLOCKS', 'DUPLICATES', 'REQUIRES']),
  lagDays: z.number().int().min(-365).max(365).optional(),
  sourceHandle: z.string().max(80).nullable().optional(),
  targetHandle: z.string().max(80).nullable().optional(),
})

const patchBody = z.object({
  linkType: z.enum(['FS', 'SS', 'FF', 'SF', 'RELATES', 'BLOCKS', 'DUPLICATES', 'REQUIRES']).optional(),
  lagDays: z.number().int().min(-365).max(365).optional(),
  sourceHandle: z.string().max(80).nullable().optional(),
  targetHandle: z.string().max(80).nullable().optional(),
})

export default async function linkRoutes(app: FastifyInstance) {

  app.post<{ Params: { id: string } }>('/tasks/:id/links', async (req, reply) => {
    const user = await authenticate(req)
    const b = createBody.parse(req.body)

    // 兩端都要驗權限。只驗一端就是 Vikunja 2026 那個關聯 IDOR（GO-2026-4847）。
    const src = await requireTaskAccess(user.id, req.params.id, 'EDITOR')
    const tgt = await requireTaskAccess(user.id, b.targetId, 'EDITOR')

    /*
     * Ref: CR-130 —— 角色過了還要是「關係人」，否則任何 EDITOR 都能去剪接別人的關聯。
     * 只驗**發起的那一端**：跨人依賴（我的任務要等你的任務做完）是這套系統的核心用法，
     * 兩端都要求關係人等於把它整個關掉。指到誰身上只需要對那張有編輯權（上面已驗）。
     */
    await assertTaskStakeholder(req.params.id, user.id, src.role, '關聯線')

    if (src.workspaceId !== tgt.workspaceId) throw forbidden('不能跨工作區建立關聯')
    if (req.params.id === b.targetId) throw badRequest('任務不能關聯到自己')

    // 對稱型只存一列，用字典序決定方向，從資料層杜絕重複
    let sourceId = req.params.id
    let targetId = b.targetId
    let sHandle = b.sourceHandle ?? null
    let tHandle = b.targetHandle ?? null
    if (SYMMETRIC.has(b.linkType) && sourceId > targetId) {
      [sourceId, targetId] = [targetId, sourceId];
      [sHandle, tHandle] = [tHandle, sHandle]
    }

    const link = await sql.begin(async tx => {
      // 排程類才需要擋環與階層限制；語意類（RELATES / BLOCKS…）不影響日期，不受限制
      if (isScheduling(b.linkType)) {
        // 先驗祖先／後代關係。順序很重要：階層邊本身也算在環裡，
        // 若先跑 assertNoCycle，使用者只會看到「會造成循環依賴」這種
        // 不知所云的訊息，而不是真正的原因。具體的錯誤要先講。
        const [anc] = await tx<{ one: number }[]>`
          SELECT 1 AS one FROM task_closure
          WHERE (ancestor_id = ${sourceId} AND descendant_id = ${targetId})
             OR (ancestor_id = ${targetId} AND descendant_id = ${sourceId})`
        if (anc) throw conflict('父子任務之間不能建立排程依賴', '父任務的日期已由子任務彙總')

        await assertNoCycle(tx, sourceId, targetId)
      }

      const [l] = await tx<{ id: string }[]>`
        INSERT INTO task_link (workspace_id, source_id, target_id, link_type, lag_days, source_handle, target_handle, created_by)
        VALUES (${src.workspaceId}, ${sourceId}, ${targetId}, ${b.linkType},
                ${b.lagDays ?? 0}, ${sHandle}, ${tHandle}, ${user.id})
        ON CONFLICT (workspace_id, source_id, target_id, link_type)
        DO UPDATE SET source_handle = EXCLUDED.source_handle, target_handle = EXCLUDED.target_handle
        RETURNING id`

      // 當建立關聯時，將 target 的 rank 設為 source.rank + 1 (緊跟在 source 正下方/正後方)，確保 Menu 順序緊密相連
      const [srcT] = await tx<{ rank: number }[]>`SELECT rank FROM task WHERE id = ${sourceId}`
      if (srcT) {
        await tx`UPDATE task SET rank = ${srcT.rank + 1} WHERE id = ${targetId}`
      }

      await tx`INSERT INTO activity (workspace_id, task_id, kind, actor_id, actor_name, body)
               VALUES (${src.workspaceId}, ${sourceId}, 'LINK_CHANGE', ${user.id},
                       ${user.displayName},
                       ${sql.json({ action: 'add', linkType: b.linkType, targetId })})`

      // ── 通知被指向的那一端 ──
      //
      // 用 b.targetId 而不是上面算過的 targetId：對稱型關聯會依字典序把兩端對調，
      // 那是儲存細節。使用者的認知是「我把 A 指到了 B」，該被通知的一直是 B 的負責人。
      const [pointed] = await tx<{
        assignee_id: string | null; project_id: string
      }[]>`
        SELECT assignee_id, project_id FROM task WHERE id = ${b.targetId}`
      if (pointed?.assignee_id) {
        const [from] = await tx<{ ref: string; title: string }[]>`
          SELECT p.key || '-' || t.number AS ref, t.title
          FROM task t JOIN project p ON p.id = t.project_id
          WHERE t.id = ${req.params.id}`
        await notify({
          db: tx,
          workspaceId: src.workspaceId,
          userId: pointed.assignee_id,
          kind: 'TASK_LINKED',
          actorId: user.id,
          actorName: user.displayName,
          projectId: pointed.project_id,
          taskId: b.targetId,
          // 前端要能講出「要等 MRG-3 完成，我才能開始」，所以連對方的代號一起存下來
          body: { linkType: b.linkType, otherRef: from?.ref, otherTitle: from?.title },
        })
      }
      return l
    })

    emitRealtimeEvent({
      type: 'task:changed',
      projectId: src.projectId,
      workspaceId: src.workspaceId,
      actorId: user.id,
      actorName: user.displayName,
      payload: { action: 'link_added', linkId: link.id, sourceId: req.params.id, targetId: b.targetId },
    })

    const [row] = await sql`
      SELECT l.id, l.link_type AS "linkType", l.lag_days AS "lagDays",
             l.source_id AS "sourceId", l.target_id AS "targetId"
      FROM task_link l WHERE l.id = ${link.id}`
    return reply.code(201).send(row)
  })

  app.patch<{ Params: { id: string } }>('/links/:id', async (req, reply) => {
    const user = await authenticate(req)
    const b = patchBody.parse(req.body)
    const [l] = await sql<{ source_id: string; target_id: string; created_by: string | null }[]>`
      SELECT source_id, target_id, created_by FROM task_link WHERE id = ${req.params.id}`
    if (!l) throw notFound('找不到這條關聯')
    const { role, projectId, workspaceId } = await requireTaskAccess(user.id, l.source_id, 'EDITOR')

    let isAllowed = role === 'MANAGER' || (l.created_by && l.created_by === user.id) || role === 'EDITOR'
    if (!isAllowed) {
      try {
        await assertTaskStakeholder(l.source_id, user.id, role, '關聯線')
        isAllowed = true
      } catch {
        const tgt = await requireTaskAccess(user.id, l.target_id, 'EDITOR')
        await assertTaskStakeholder(l.target_id, user.id, tgt.role, '關聯線')
        isAllowed = true
      }
    }

    await sql`
      UPDATE task_link
      SET ${sql(b, 'linkType', 'lagDays', 'sourceHandle', 'targetHandle')}
      WHERE id = ${req.params.id}`

    emitRealtimeEvent({
      type: 'task:changed',
      projectId,
      workspaceId,
      actorId: user.id,
      actorName: user.displayName,
      payload: { action: 'link_updated', linkId: req.params.id },
    })

    const [row] = await sql`
      SELECT l.id, l.link_type AS "linkType", l.lag_days AS "lagDays",
             l.source_id AS "sourceId", l.target_id AS "targetId",
             l.source_handle AS "sourceHandle", l.target_handle AS "targetHandle"
      FROM task_link l WHERE l.id = ${req.params.id}`
    return row
  })

  app.delete<{ Params: { id: string } }>('/links/:id', async (req, reply) => {
    const user = await authenticate(req)
    const [l] = await sql<{ source_id: string; target_id: string; created_by: string | null }[]>`
      SELECT source_id, target_id, created_by FROM task_link WHERE id = ${req.params.id}`
    if (!l) throw notFound('找不到這條關聯')
    const { role, projectId, workspaceId } = await requireTaskAccess(user.id, l.source_id, 'EDITOR')

    let isAllowed = role === 'MANAGER' || (l.created_by && l.created_by === user.id) || role === 'EDITOR'
    if (!isAllowed) {
      try {
        await assertTaskStakeholder(l.source_id, user.id, role, '關聯線')
        isAllowed = true
      } catch {
        const tgt = await requireTaskAccess(user.id, l.target_id, 'EDITOR')
        await assertTaskStakeholder(l.target_id, user.id, tgt.role, '關聯線')
        isAllowed = true
      }
    }

    await sql`DELETE FROM task_link WHERE id = ${req.params.id}`

    emitRealtimeEvent({
      type: 'task:changed',
      projectId,
      workspaceId,
      actorId: user.id,
      actorName: user.displayName,
      payload: { action: 'link_deleted', linkId: req.params.id },
    })

    return reply.code(204).send()
  })

  /** 關聯網路圖用：一次拿整個專案的節點與邊 */
  app.get<{ Params: { id: string } }>('/projects/:id/graph', async req => {
    const user = await authenticate(req)
    const { requireProjectRole } = await import('../lib/auth.js')
    await requireProjectRole(user.id, req.params.id, 'VIEWER')

    const nodes = await sql`
      SELECT t.id, p.key || '-' || t.number AS ref, t.title, t.type,
             t.status_key AS "statusKey", t.progress, t.parent_id AS "parentId",
             t.inquiry_state AS "inquiryState",
             t.problem
      FROM task t JOIN project p ON p.id = t.project_id
      WHERE t.project_id = ${req.params.id} AND t.deleted_at IS NULL`

    const edges = await sql`
      SELECT l.id, l.source_id AS "sourceId", l.target_id AS "targetId",
             l.link_type AS "linkType", l.lag_days AS "lagDays",
             -- Ref: CR-138 線從哪一邊出去、接到哪一邊，跟著關聯線一起帶回去
             l.source_handle AS "sourceHandle", l.target_handle AS "targetHandle"
      FROM task_link l
      JOIN task s ON s.id = l.source_id
      WHERE s.project_id = ${req.params.id}`

    return { nodes, edges, links: edges }
  })
}
