import type { FastifyInstance } from 'fastify'
import { authenticate } from '../lib/auth.js'
import { realtimeEventBus, type RealtimeEvent } from '../lib/events.js'

/**
 * 即時推播與即時通知 (Server-Sent Events) 路由。
 *
 * 提供全系統前端客戶端建立持久性 SSE 連線，即時接收：
 * - notification:new (新通知推播，更新鈴鐺未讀數與清單)
 * - project:changed (專案資訊、成員加入/異動、申請審核)
 * - task:changed (任務建立/修改/拖曳/刪除/甘特排程/關聯線)
 * - canvas:changed (流程圖、關聯圖排版與畫布文件更新)
 * - inquiry:changed (發文追蹤與詢問單狀態更新)
 */

export default async function eventRoutes(app: FastifyInstance) {
  app.get('/events', async (req, reply) => {
    const user = await authenticate(req)

    reply.hijack()

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    })
    reply.raw.flushHeaders?.()

    // 建立連線成功事件
    reply.raw.write('event: connected\ndata: {"status":"connected"}\n\n')

    // 每 15 秒發送心跳包，防止代理伺服器或瀏覽器連線逾時
    const keepaliveTimer = setInterval(() => {
      try {
        reply.raw.write(':keepalive\n\n')
      } catch {
        cleanup()
      }
    }, 15_000)

    const onEvent = (ev: RealtimeEvent) => {
      // 若事件指定特定接收人 (如個人通知)，非該使用者則予以過濾
      if (ev.userId && ev.userId !== user.id) {
        return
      }

      try {
        reply.raw.write(`id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`)
      } catch {
        cleanup()
      }
    }

    realtimeEventBus.on('realtime', onEvent)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      clearInterval(keepaliveTimer)
      realtimeEventBus.off('realtime', onEvent)
      try {
        reply.raw.end()
      } catch {}
    }

    req.raw.on('close', cleanup)
    req.raw.on('error', cleanup)
  })
}
