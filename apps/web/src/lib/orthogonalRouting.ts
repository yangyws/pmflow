import { Position, type Node } from '@xyflow/react'

export interface Point {
  x: number
  y: number
}

export interface ObstacleRect {
  id?: string
  left: number
  top: number
  right: number
  bottom: number
  isBox?: boolean
}

/**
 * 從畫布上的節點陣列中提取收納盒中介障礙物（排除起點、終點及其各自的父容器收納盒）
 */
export function getObstaclesFromNodes(
  nodes: Node[],
  sourceId?: string,
  targetId?: string
): ObstacleRect[] {
  if (!nodes || nodes.length === 0) return []

  const nodeMap = new Map<string, Node>()
  for (const n of nodes) {
    nodeMap.set(n.id, n)
  }

  const sourceNode = sourceId ? nodeMap.get(sourceId) : undefined
  const targetNode = targetId ? nodeMap.get(targetId) : undefined
  const sourceParentId = sourceNode?.parentId
  const targetParentId = targetNode?.parentId

  const obstacles: ObstacleRect[] = []

  for (const n of nodes) {
    // 排除起點、終點及它們所在的父層收納盒
    if (n.id === sourceId || n.id === targetId) continue
    if (n.id === sourceParentId || n.id === targetParentId) continue

    const nodeData = n.data as Record<string, unknown> | undefined
    const isBox = Boolean(
      nodeData?.mode === 'box' ||
      n.type === 'box' ||
      (n.style && typeof n.style.width === 'number' && n.style.width >= 340)
    )

    // 只有收納盒 (Box) 會被視為不能穿透的障礙框，一般卡片不阻擋連線
    if (!isBox) continue

    const absX = n.position?.x ?? 0
    const absY = n.position?.y ?? 0

    const width =
      n.measured?.width ??
      (typeof n.style?.width === 'number'
        ? n.style.width
        : typeof n.width === 'number'
        ? n.width
        : 340)
    const height =
      n.measured?.height ??
      (typeof n.style?.height === 'number'
        ? n.style.height
        : typeof n.height === 'number'
        ? n.height
        : 260)

    obstacles.push({
      id: n.id,
      left: absX,
      top: absY,
      right: absX + width,
      bottom: absY + height,
      isBox: true,
    })
  }

  return obstacles
}

function isSegmentCrossingBox(
  p1: Point,
  p2: Point,
  b: ObstacleRect,
  eps = 2
): boolean {
  const isHoriz = Math.abs(p1.y - p2.y) < eps
  const isVert = Math.abs(p1.x - p2.x) < eps

  if (isHoriz) {
    const y = p1.y
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    return y > b.top + eps && y < b.bottom - eps && maxX > b.left + eps && minX < b.right - eps
  } else if (isVert) {
    const x = p1.x
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    return x > b.left + eps && x < b.right - eps && maxY > b.top + eps && minY < b.bottom - eps
  }
  return false
}

/**
 * 簡化同線段連續共線座標點
 */
export function simplifyPoints(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const res: Point[] = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const prev = res[res.length - 1]
    const cur = points[i]
    const next = i + 1 < points.length ? points[i + 1] : null

    if (Math.abs(cur.x - prev.x) < 0.01 && Math.abs(cur.y - prev.y) < 0.01) {
      continue
    }

    if (next) {
      const isCollinearX = Math.abs(prev.x - cur.x) < 0.01 && Math.abs(cur.x - next.x) < 0.01
      const isCollinearY = Math.abs(prev.y - cur.y) < 0.01 && Math.abs(cur.y - next.y) < 0.01
      if (isCollinearX || isCollinearY) {
        continue
      }
    }

    res.push(cur)
  }

  return res
}

/**
 * 將直角折線座標陣列轉成 SVG Path 與中介折點 (px, py)
 */
export function toSvgPath(
  rawPoints: Point[],
  explicitPx?: number,
  explicitPy?: number
): { path: string; px: number; py: number } {
  const pts = simplifyPoints(rawPoints)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  let px = explicitPx
  let py = explicitPy

  if (px === undefined || py === undefined) {
    if (pts.length <= 2) {
      px = (pts[0].x + pts[pts.length - 1].x) / 2
      py = (pts[0].y + pts[pts.length - 1].y) / 2
    } else {
      const midIdx = Math.floor(pts.length / 2)
      const p1 = pts[midIdx - 1]
      const p2 = pts[midIdx]
      px = (p1.x + p2.x) / 2
      py = (p1.y + p2.y) / 2
    }
  }

  return {
    path,
    px: Math.round(px),
    py: Math.round(py),
  }
}

/**
 * 智慧直角避障路徑演算法 (極速、零抖動、幾何推移繞道)
 * 1. 使用者自訂 waypoint 享最高優先權
 * 2. 未自訂折點時，若預設路徑穿透收納盒，自動計算外圍繞道座標 (帶 28px 安全邊界)
 */
export function buildOrthogonalPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sourcePosition: Position,
  targetPosition: Position,
  waypoint?: Point | null,
  obstacles: ObstacleRect[] = [],
  margin = 28
): { path: string; px: number; py: number } {
  const srcHoriz = sourcePosition === Position.Left || sourcePosition === Position.Right
  const tgtHoriz = targetPosition === Position.Left || targetPosition === Position.Right

  // 【規則一：手動拖曳自訂折點 (Waypoint) 享最高優先權】
  if (waypoint && typeof waypoint.x === 'number' && typeof waypoint.y === 'number') {
    const px = waypoint.x
    const py = waypoint.y
    const a = srcHoriz ? { x: px, y: sy } : { x: sx, y: py }
    const b = tgtHoriz ? { x: px, y: ty } : { x: tx, y: py }
    const raw = [{ x: sx, y: sy }, a, { x: px, y: py }, b, { x: tx, y: ty }]
    return toSvgPath(raw, px, py)
  }

  const px = (sx + tx) / 2
  const py = (sy + ty) / 2

  let basePoints: Point[]
  if (srcHoriz && tgtHoriz) {
    basePoints = [{ x: sx, y: sy }, { x: px, y: sy }, { x: px, y: ty }, { x: tx, y: ty }]
  } else if (!srcHoriz && !tgtHoriz) {
    basePoints = [{ x: sx, y: sy }, { x: sx, y: py }, { x: tx, y: py }, { x: tx, y: ty }]
  } else if (srcHoriz && !tgtHoriz) {
    basePoints = [{ x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }]
  } else {
    basePoints = [{ x: sx, y: sy }, { x: sx, y: ty }, { x: tx, y: ty }]
  }

  if (!obstacles || obstacles.length === 0) {
    return toSvgPath(basePoints, px, py)
  }

  // 檢測基本路徑是否穿越任何收納盒
  const crossingBoxes = obstacles.filter((b) => {
    for (let i = 0; i < basePoints.length - 1; i++) {
      if (isSegmentCrossingBox(basePoints[i], basePoints[i + 1], b)) {
        return true
      }
    }
    return false
  })

  if (crossingBoxes.length === 0) {
    return toSvgPath(basePoints, px, py)
  }

  // 【規則二：幾何推移繞道避開收納盒】
  let minLeft = Infinity
  let maxRight = -Infinity
  let minTop = Infinity
  let maxBottom = -Infinity

  for (const b of crossingBoxes) {
    if (b.left < minLeft) minLeft = b.left
    if (b.right > maxRight) maxRight = b.right
    if (b.top < minTop) minTop = b.top
    if (b.bottom > maxBottom) maxBottom = b.bottom
  }

  if (srcHoriz && tgtHoriz) {
    const detourTopY = minTop - margin
    const detourBottomY = maxBottom + margin
    const avgY = (sy + ty) / 2
    const chosenDetourY =
      Math.abs(avgY - detourTopY) <= Math.abs(avgY - detourBottomY) ? detourTopY : detourBottomY

    const midX = (sx + tx) / 2
    const detourPoints: Point[] = [
      { x: sx, y: sy },
      { x: sx + (sourcePosition === Position.Left ? -margin : margin), y: sy },
      { x: sx + (sourcePosition === Position.Left ? -margin : margin), y: chosenDetourY },
      { x: tx + (targetPosition === Position.Left ? -margin : margin), y: chosenDetourY },
      { x: tx + (targetPosition === Position.Left ? -margin : margin), y: ty },
      { x: tx, y: ty },
    ]
    return toSvgPath(detourPoints, midX, chosenDetourY)
  } else {
    const detourLeftX = minLeft - margin
    const detourRightX = maxRight + margin
    const avgX = (sx + tx) / 2
    const chosenDetourX =
      Math.abs(avgX - detourLeftX) <= Math.abs(avgX - detourRightX) ? detourLeftX : detourRightX

    const midY = (sy + ty) / 2
    const detourPoints: Point[] = [
      { x: sx, y: sy },
      { x: sx, y: sy + (sourcePosition === Position.Top ? -margin : margin) },
      { x: chosenDetourX, y: sy + (sourcePosition === Position.Top ? -margin : margin) },
      { x: chosenDetourX, y: ty + (targetPosition === Position.Top ? -margin : margin) },
      { x: tx, y: ty + (targetPosition === Position.Top ? -margin : margin) },
      { x: tx, y: ty },
    ]
    return toSvgPath(detourPoints, chosenDetourX, midY)
  }
}
