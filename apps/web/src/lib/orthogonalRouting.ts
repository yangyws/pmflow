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
 * 從畫布上的節點陣列中提取障礙物：
 * 1. 允許在同一個收納盒內部的卡片之間連線，以及自然出入自身父層收納盒
 * 2. 盒內的其他卡片、畫布上的其他卡片、非自身所屬的第三方收納盒皆為不能穿透之障礙物
 * 3. 區域標示框 (Frame) 為純視覺背景，不阻擋連線
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
    // 排除起點、終點自身
    if (n.id === sourceId || n.id === targetId) continue

    const nodeData = n.data as Record<string, unknown> | undefined
    const isFrame = Boolean(
      nodeData?.mode === 'frame' ||
      n.type === 'frame' ||
      n.type === 'annotationFrame'
    )

    // 標示框為純視覺背景，不視為阻擋障礙物
    if (isFrame) continue

    const isBox = Boolean(
      nodeData?.mode === 'box' ||
      n.type === 'box' ||
      (n.style && typeof n.style.width === 'number' && n.style.width >= 340)
    )

    // 若為收納盒，若屬於起點或終點的父容器，則允許線在該收納盒內穿透通行（不列為障礙物）
    if (isBox && (n.id === sourceParentId || n.id === targetParentId)) {
      continue
    }

    // 計算節點在畫布上的絕對座標（累加所有父層相對位移）
    let absX = n.position?.x ?? 0
    let absY = n.position?.y ?? 0
    let curParentId = n.parentId
    const visited = new Set<string>()
    while (curParentId && !visited.has(curParentId)) {
      visited.add(curParentId)
      const p = nodeMap.get(curParentId)
      if (p) {
        absX += p.position?.x ?? 0
        absY += p.position?.y ?? 0
        curParentId = p.parentId
      } else {
        break
      }
    }

    const width =
      n.measured?.width ??
      (typeof n.style?.width === 'number'
        ? n.style.width
        : typeof n.width === 'number'
        ? n.width
        : isBox
        ? 340
        : 256)
    const height =
      n.measured?.height ??
      (typeof n.style?.height === 'number'
        ? n.style.height
        : typeof n.height === 'number'
        ? n.height
        : isBox
        ? 260
        : 100)

    obstacles.push({
      id: n.id,
      left: absX,
      top: absY,
      right: absX + width,
      bottom: absY + height,
      isBox,
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

function countPolylineCollisions(points: Point[], obstacles: ObstacleRect[]): number {
  let count = 0
  for (let i = 0; i < points.length - 1; i++) {
    for (const b of obstacles) {
      if (isSegmentCrossingBox(points[i], points[i + 1], b)) {
        count++
      }
    }
  }
  return count
}

function polylineLength(points: Point[]): number {
  let len = 0
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y)
  }
  return len
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

    // 去除重疊點
    if (Math.abs(cur.x - prev.x) < 0.01 && Math.abs(cur.y - prev.y) < 0.01) {
      continue
    }

    // 去除同向共線的中介點
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
 * 2. 檢測路徑是否穿透盒內其他卡片、畫布其他卡片或第三方收納盒
 * 3. 若碰撞障礙物，自動以安全邊界 (margin = 20) 計算最短無碰撞繞道折線
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
  margin = 20
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

  // 構建標準預設直角折線路徑
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

  // 快速過濾與當前起訖點連線區域相關的障礙物 (包含卡片與收納盒)
  const minZoneX = Math.min(sx, tx) - margin - 40
  const maxZoneX = Math.max(sx, tx) + margin + 40
  const minZoneY = Math.min(sy, ty) - margin - 40
  const maxZoneY = Math.max(sy, ty) + margin + 40

  const relevantObstacles = obstacles.filter(
    (b) => !(b.right < minZoneX || b.left > maxZoneX || b.bottom < minZoneY || b.top > maxZoneY)
  )

  if (relevantObstacles.length === 0 || countPolylineCollisions(basePoints, relevantObstacles) === 0) {
    return toSvgPath(basePoints, px, py)
  }

  // 【規則二：多通道幾何推移繞道 (Multi-Corridor Geometric Detour)】
  // 找出所有碰撞障礙物的複合範圍
  const hittingObstacles = relevantObstacles.filter((b) => {
    for (let i = 0; i < basePoints.length - 1; i++) {
      if (isSegmentCrossingBox(basePoints[i], basePoints[i + 1], b)) {
        return true
      }
    }
    return false
  })

  let minLeft = Infinity
  let maxRight = -Infinity
  let minTop = Infinity
  let maxBottom = -Infinity

  for (const b of (hittingObstacles.length > 0 ? hittingObstacles : relevantObstacles)) {
    if (b.left < minLeft) minLeft = b.left
    if (b.right > maxRight) maxRight = b.right
    if (b.top < minTop) minTop = b.top
    if (b.bottom > maxBottom) maxBottom = b.bottom
  }

  const candidatePaths: Array<{ points: Point[]; px: number; py: number }> = []

  if (srcHoriz && tgtHoriz) {
    const topY = minTop - margin
    const bottomY = maxBottom + margin
    const sStubX = sx + (sourcePosition === Position.Left ? -margin : margin)
    const tStubX = tx + (targetPosition === Position.Left ? -margin : margin)

    // 候選通道 1：上方繞道
    candidatePaths.push({
      points: [
        { x: sx, y: sy },
        { x: sStubX, y: sy },
        { x: sStubX, y: topY },
        { x: tStubX, y: topY },
        { x: tStubX, y: ty },
        { x: tx, y: ty },
      ],
      px: (sx + tx) / 2,
      py: topY,
    })

    // 候選通道 2：下方繞道
    candidatePaths.push({
      points: [
        { x: sx, y: sy },
        { x: sStubX, y: sy },
        { x: sStubX, y: bottomY },
        { x: tStubX, y: bottomY },
        { x: tStubX, y: ty },
        { x: tx, y: ty },
      ],
      px: (sx + tx) / 2,
      py: bottomY,
    })
  } else if (!srcHoriz && !tgtHoriz) {
    const leftX = minLeft - margin
    const rightX = maxRight + margin
    const sStubY = sy + (sourcePosition === Position.Top ? -margin : margin)
    const tStubY = ty + (targetPosition === Position.Top ? -margin : margin)

    // 候選通道 1：左側繞道
    candidatePaths.push({
      points: [
        { x: sx, y: sy },
        { x: sx, y: sStubY },
        { x: leftX, y: sStubY },
        { x: leftX, y: tStubY },
        { x: tx, y: tStubY },
        { x: tx, y: ty },
      ],
      px: leftX,
      py: (sy + ty) / 2,
    })

    // 候選通道 2：右側繞道
    candidatePaths.push({
      points: [
        { x: sx, y: sy },
        { x: sx, y: sStubY },
        { x: rightX, y: sStubY },
        { x: rightX, y: tStubY },
        { x: tx, y: tStubY },
        { x: tx, y: ty },
      ],
      px: rightX,
      py: (sy + ty) / 2,
    })
  } else {
    const topY = minTop - margin
    const bottomY = maxBottom + margin
    const leftX = minLeft - margin
    const rightX = maxRight + margin

    candidatePaths.push(
      {
        points: [{ x: sx, y: sy }, { x: leftX, y: sy }, { x: leftX, y: ty }, { x: tx, y: ty }],
        px: leftX,
        py: (sy + ty) / 2,
      },
      {
        points: [{ x: sx, y: sy }, { x: rightX, y: sy }, { x: rightX, y: ty }, { x: tx, y: ty }],
        px: rightX,
        py: (sy + ty) / 2,
      },
      {
        points: [{ x: sx, y: sy }, { x: sx, y: topY }, { x: tx, y: topY }, { x: tx, y: ty }],
        px: (sx + tx) / 2,
        py: topY,
      },
      {
        points: [{ x: sx, y: sy }, { x: sx, y: bottomY }, { x: tx, y: bottomY }, { x: tx, y: ty }],
        px: (sx + tx) / 2,
        py: bottomY,
      }
    )
  }

  let bestPath = candidatePaths[0]
  let bestScore = Infinity

  for (const cand of candidatePaths) {
    const collisions = countPolylineCollisions(cand.points, relevantObstacles)
    const len = polylineLength(cand.points)
    const score = collisions * 100000 + len

    if (score < bestScore) {
      bestScore = score
      bestPath = cand
    }
  }

  return toSvgPath(bestPath.points, bestPath.px, bestPath.py)
}
