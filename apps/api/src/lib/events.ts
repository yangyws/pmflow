import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'

/**
 * 即時推播與即時通知 (Real-time Push & Real-time Notifications) 事件中樞。
 *
 * 採用單機內建 EventEmitter 作為即時事件 Bus，提供各路由發布事件 (emitRealtimeEvent)，
 * 並由 SSE 端點 (/api/v1/events) 即時串流推送給線上瀏覽器客戶端。
 */

export type RealtimeEventType =
  | 'notification:new'
  | 'project:changed'
  | 'task:changed'
  | 'canvas:changed'
  | 'inquiry:changed'
  | 'member:changed'

export interface RealtimeEvent<T = Record<string, unknown>> {
  id: string
  type: RealtimeEventType
  workspaceId?: string | null
  projectId?: string | null
  /** 收件人 ID。若指定 (例如個人通知)，則只有該使用者會收到推播 */
  userId?: string | null
  /** 操作者 ID (發起異動的使用者) */
  actorId?: string | null
  /** 操作者名稱 */
  actorName?: string | null
  payload?: T
  timestamp: string
}

export type EmitEventInput<T = Record<string, unknown>> = {
  id?: string
  type: RealtimeEventType
  workspaceId?: string | null
  projectId?: string | null
  userId?: string | null
  actorId?: string | null
  actorName?: string | null
  payload?: T
  timestamp?: string
}

class RealtimeEventBus extends EventEmitter {
  constructor() {
    super()
    // 提高監聽器上限以支援多個 SSE 連線
    this.setMaxListeners(2000)
  }
}

export const realtimeEventBus = new RealtimeEventBus()

/**
 * 發送即時廣播事件至全域事件中樞
 */
export function emitRealtimeEvent<T = Record<string, unknown>>(input: EmitEventInput<T>): RealtimeEvent<T> {
  const event: RealtimeEvent<T> = {
    id: input.id ?? randomUUID(),
    type: input.type,
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    userId: input.userId ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    payload: input.payload,
    timestamp: input.timestamp ?? new Date().toISOString(),
  }

  realtimeEventBus.emit('realtime', event)
  return event
}
