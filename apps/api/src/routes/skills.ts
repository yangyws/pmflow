import type { FastifyInstance } from 'fastify'
import { sql } from '../lib/db.js'
import { authenticate } from '../lib/auth.js'
import { listProjectParams } from './parameters.js'

export default async function skillRoutes(app: FastifyInstance) {
  /**
   * AI 技能與 API 規格探索端點。
   * AI 助理（如 Claude / Gemini / ChatGPT / Cursor 等）透過此端點獲取當前使用者的可用專案、自訂欄位、操作 API 規格與呼叫指引。
   */
  app.get('/skills', async req => {
    const user = await authenticate(req)

    // 取得使用者參與的所有專案與參數定義
    const projects = await sql<{
      id: string; key: string; name: string; description: string | null; role: string; isCreator: boolean
    }[]>`
      SELECT p.id, p.key, p.name, p.description, pm.role, (p.created_by = ${user.id}) AS "isCreator"
      FROM project p
      JOIN project_member pm ON pm.project_id = p.id AND pm.user_id = ${user.id}
      WHERE p.archived_at IS NULL
      ORDER BY p.rank, p.created_at`

    const enrichedProjects = await Promise.all(
      projects.map(async p => {
        const statuses = await sql<{ id: string; key: string; name: string; category: string }[]>`
          SELECT id, key, name, category FROM task_status WHERE project_id = ${p.id} ORDER BY rank`
        const priorities = await listProjectParams(sql, p.id, 'priority')
        const types = await listProjectParams(sql, p.id, 'type')
        const members = await sql<{ id: string; displayName: string; email: string; role: string }[]>`
          SELECT u.id, u.display_name AS "displayName", u.email, pm.role
          FROM project_member pm JOIN app_user u ON u.id = pm.user_id
          WHERE pm.project_id = ${p.id} ORDER BY u.display_name`

        return {
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          myRole: p.role,
          statuses: statuses.map(s => ({ key: s.key, name: s.name, category: s.category })),
          priorities: priorities.map(pr => ({ key: pr.key, name: pr.name })),
          types: types.map(t => ({ key: t.key, name: t.name })),
          members: members.map(m => ({ id: m.id, displayName: m.displayName, email: m.email })),
        }
      })
    )

    return {
      service: 'PMFlow API & AI Agent Discovery',
      version: '1.0.0',
      authenticatedUser: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      },
      instructions: [
        'You are an autonomous AI project assistant interacting directly with PMFlow via REST API.',
        '1. Inspect the "projects" array below to find the target project ID, valid types, valid priorities, and members.',
        '2. When the user gives you a list of tasks/requirements, analyze them and make sequential or batch POST/PATCH requests to the API endpoints listed under "endpoints".',
        '3. When creating tasks (POST /api/v1/projects/:projectId/tasks), the "type" and "priority" values MUST match the "key" defined in that project (case-sensitive).',
        '4. When creating dependency links (POST /api/v1/tasks/:sourceTaskId/links), use "FS" for sequential dependencies ("A finishes before B starts"), "SS" for parallel starts, "FF" for parallel finishes, or "RELATES" for semantic links.',
        '5. To create subtasks, specify the "parentId" of the parent task.',
        '6. Always check if a task with the same title already exists in the project before creating it to ensure idempotency.',
      ],
      projects: enrichedProjects,
      endpoints: {
        list_tasks: {
          method: 'GET',
          path: '/api/v1/projects/:projectId/tasks',
          description: '取得專案內所有任務清單（包含 id, ref, title, type, priority, status, parentId, dueDate 等）',
        },
        create_task: {
          method: 'POST',
          path: '/api/v1/projects/:projectId/tasks',
          description: '在指定專案建立新任務或子任務卡片',
          body: {
            title: 'string (必填，任務標題)',
            description: 'string (選填，詳細內容/規格)',
            type: 'string (選填，任務類型，必須是該專案 types 中的 key，如 TASK / BUG / EPIC / MILESTONE)',
            priority: 'string (選填，優先度，必須是該專案 priorities 中的 key，如 HIGH / NORMAL / LOW)',
            status: 'string (選填，狀態 key，如 todo / doing / done，預設為 todo)',
            assigneeId: 'string uuid (選填，指派給專案成員的 user id)',
            parentId: 'string uuid (選填，掛載於哪個父任務底下，形成子項目)',
            startDate: 'YYYY-MM-DD (選填，開始日期)',
            dueDate: 'YYYY-MM-DD (選填，到期日期)',
            estimatedHours: 'number (選填，預估工時)',
          },
        },
        update_task: {
          method: 'PATCH',
          path: '/api/v1/tasks/:taskId',
          description: '修改任務資料、進度或問題備註',
          body: {
            title: 'string (選填)',
            description: 'string (選填)',
            type: 'string (選填)',
            priority: 'string (選填)',
            status: 'string (選填)',
            assigneeId: 'string uuid | null (選填)',
            parentId: 'string uuid | null (選填)',
            startDate: 'YYYY-MM-DD | null (選填)',
            dueDate: 'YYYY-MM-DD | null (選填)',
            progress: 'number 0~100 (選填，完成進度百分比)',
            problem: 'string | null (選填，目前遇到的問題/障礙說明)',
          },
        },
        create_link: {
          method: 'POST',
          path: '/api/v1/tasks/:sourceTaskId/links',
          description: '在兩張任務之間建立前後排程關聯線或語意關係',
          body: {
            targetId: 'string uuid (必填，下游目標任務 ID)',
            linkType: 'FS | SS | FF | SF | RELATES | BLOCKS (選填，預設 FS：來源完成後目標開始)',
            lagDays: 'number (選填，延遲天數，預設 0)',
          },
        },
        delete_link: {
          method: 'DELETE',
          path: '/api/v1/links/:linkId',
          description: '刪除指定的任務關聯線',
        },
        create_inquiry: {
          method: 'POST',
          path: '/api/v1/tasks/:taskId/inquiries',
          description: '為任務登錄對外詢問 / 發文追蹤單',
          body: {
            question: 'string (必填，發問內容)',
            expectedDueDays: 'number (選填，期望幾天內回覆，預設 7)',
            recipientName: 'string (選填，受詢問單位或窗口名稱)',
          },
        },
        transfer_ownership: {
          method: 'POST',
          path: '/api/v1/projects/:projectId/transfer-ownership',
          description: '轉移專案擁有者（建立者）給其他專案成員',
          body: {
            newOwnerId: 'string uuid (必填，新擁有者 ID)',
          },
        },
      },
    }
  })
}
