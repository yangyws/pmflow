import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { getAccessToken } from './api'

/**
 * 即時推播與即時同步 Hook (Real-time Push & Real-time Synchronization)。
 *
 * 當使用者登入時自動以 EventSource 建立持久性 SSE 串流連線 (/api/v1/events)，
 * 收到後端推播事件時自動依頻道與事件類型作廢 (invalidateQueries) 對應的 React Query 快取：
 *
 * 1. 【notification:new】：鈴鐺通知即時 +1，未讀與通知清單 0 秒刷新。
 * 2. 【project:changed】：專案建立、資訊變更、新成員加入、申請與審核通過立即同步。
 * 3. 【task:changed】：清單、看板、週檢視、甘特圖、行事曆、任務關聯圖、燃盡圖、熱圖全自動即時刷新。
 * 4. 【canvas:changed】：系統流程圖、關聯圖排版與節點位置變更即時同步。
 * 5. 【inquiry:changed】：發文追蹤看板、任務抽屜內詢問單即時同步。
 *
 * 內建 150ms 防抖批次處理，兼具零延遲體驗與效能。
 */

export interface RealtimeEventPayload {
  id?: string
  type: 'notification:new' | 'project:changed' | 'task:changed' | 'canvas:changed' | 'inquiry:changed' | 'member:changed'
  workspaceId?: string | null
  projectId?: string | null
  userId?: string | null
  actorId?: string | null
  actorName?: string | null
  payload?: Record<string, unknown>
  timestamp?: string
}

export function useRealtimeSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const pendingEventsRef = useRef<RealtimeEventPayload[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    let active = true
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const processBatch = () => {
      const events = [...pendingEventsRef.current]
      pendingEventsRef.current = []
      debounceTimerRef.current = null

      if (events.length === 0) return

      const invalidatedKeys = new Set<string>()

      const invalidate = (queryKey: readonly unknown[]) => {
        const keyStr = JSON.stringify(queryKey)
        if (!invalidatedKeys.has(keyStr)) {
          invalidatedKeys.add(keyStr)
          qc.invalidateQueries({ queryKey: queryKey as unknown[] })
        }
      }

      for (const ev of events) {
        // 發布全域 DOM 事件供特殊元件即時響應
        try {
          window.dispatchEvent(new CustomEvent('pmflow_realtime_event', { detail: ev }))
        } catch {}

        // 【關鍵防抖防回彈】：過濾使用者自己發出的即時事件
        // 當前使用者本機已經擁有最新記憶體狀態與座標，若被自己發出的 SSE 廣播回彈作廢快取，
        // 會引發 React Query 重新打 API 取得舊座標並觸發整個畫布重算與閃爍。
        if (ev.actorId && user?.id && ev.actorId === user.id) {
          if (ev.type === 'canvas:changed' || ev.type === 'task:changed' || ev.type === 'inquiry:changed') {
            continue
          }
        }

        switch (ev.type) {
          case 'notification:new': {
            invalidate(['notifications'])
            invalidate(['unread-count'])
            break
          }

          case 'project:changed': {
            invalidate(['projects'])
            invalidate(['joinableProjects'])
            invalidate(['myJoinRequests'])
            if (ev.projectId) {
              invalidate(['project', ev.projectId])
              invalidate(['members', ev.projectId])
              invalidate(['joinRequests', ev.projectId])
            }
            break
          }

          case 'task:changed': {
            invalidate(['tasks'])
            invalidate(['graph'])
            invalidate(['schedule'])
            invalidate(['burndown'])
            invalidate(['workload'])
            invalidate(['deletedTasks'])
            invalidate(['canvasNodes'])
            if (ev.projectId) {
              invalidate(['tasks', ev.projectId])
              invalidate(['graph', ev.projectId])
              invalidate(['schedule', ev.projectId])
              invalidate(['burndown', ev.projectId])
              invalidate(['workload', ev.projectId])
              invalidate(['deletedTasks', ev.projectId])
              invalidate(['canvasNodes', ev.projectId])
              invalidate(['project', ev.projectId])
            }
            if (ev.payload?.taskId && typeof ev.payload.taskId === 'string') {
              invalidate(['task', ev.payload.taskId])
              invalidate(['inquiries', ev.payload.taskId])
              invalidate(['activities', ev.payload.taskId])
            }
            break
          }

          case 'canvas:changed': {
            invalidate(['canvas'])
            invalidate(['canvasDoc'])
            invalidate(['canvas-doc'])
            invalidate(['canvasNodes'])
            invalidate(['canvasPermissions'])
            invalidate(['graph'])
            invalidate(['tasks'])
            if (ev.projectId) {
              invalidate(['canvas', ev.projectId])
              invalidate(['canvasDoc', ev.projectId])
              invalidate(['canvas-doc', ev.projectId])
              invalidate(['canvasNodes', ev.projectId])
              invalidate(['canvasPermissions', ev.projectId])
              invalidate(['graph', ev.projectId])
              invalidate(['tasks', ev.projectId])
            }
            break
          }

          case 'inquiry:changed': {
            invalidate(['inquiryBoard'])
            invalidate(['inquiries'])
            invalidate(['inquiry-stats'])
            if (ev.payload?.taskId && typeof ev.payload.taskId === 'string') {
              invalidate(['task', ev.payload.taskId])
              invalidate(['inquiries', ev.payload.taskId])
            }
            if (ev.projectId) {
              invalidate(['tasks', ev.projectId])
            }
            break
          }
        }
      }
    }

    const scheduleProcess = (ev: RealtimeEventPayload) => {
      pendingEventsRef.current.push(ev)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(processBatch, 80)
    }

    const eventTypes = [
      'notification:new',
      'project:changed',
      'task:changed',
      'canvas:changed',
      'inquiry:changed',
      'member:changed',
    ] as const

    function connect() {
      if (!active) return

      const token = getAccessToken()
      if (!token) {
        reconnectTimer = setTimeout(connect, 3000)
        return
      }

      if (es) {
        try { es.close() } catch {}
        es = null
      }

      const url = `/api/v1/events?token=${encodeURIComponent(token)}`
      const source = new EventSource(url, { withCredentials: true })
      es = source

      for (const type of eventTypes) {
        source.addEventListener(type, (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data) as RealtimeEventPayload
            scheduleProcess(payload)
          } catch {
            // ignore parsing error
          }
        })
      }

      source.onerror = () => {
        if (!active) return
        try { source.close() } catch {}
        if (es === source) es = null
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            connect()
          }, 3000)
        }
      }
    }

    connect()

    return () => {
      active = false
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (es) {
        try { es.close() } catch {}
        es = null
      }
    }
  }, [user, qc])
}
