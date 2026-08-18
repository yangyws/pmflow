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
 * 從畫布上的節點陣列中提取所有中介障礙物（排除起點、終點及其各自的父容器收納盒）
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
    // 排除起點、終點及它們所在的父層收納盒（允許從自身收納盒自然出入）
    if (n.id === sourceId || n.id === targetId) continue
    if (n.id === sourceParentId || n.id === targetParentId) continue

    const nodeData = n.data as Record<string, unknown> | undefined
    const isBox = Boolean(
      nodeData?.isBox ||
      nodeData?.mode === 'box' ||
      n.type === 'box' ||
      n.id.startsWith('box-')
    )

    const isFrame = Boolean(
      nodeData?.mode === 'frame' ||
      n.type === 'frame' ||
      n.type === 'annotationFrame'
    )

    // 標示框為純視覺背景，不視為阻擋障礙物；收納盒與卡片節點為實質障礙物
    if (isFrame) continue

    // 計算絕對座標（累加所有父層 relative offset）
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
        ? 648
        : 256)
    const height =
      n.measured?.height ??
      (typeof n.style?.height === 'number'
        ? n.style.height
        : typeof n.height === 'number'
        ? n.height
        : isBox
        ? 620
        : 120)

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

function dedupeCoords(coords: number[], tolerance = 2): number[] {
  const sorted = [...coords].sort((a, b) => a - b)
  const res: number[] = []
  for (const c of sorted) {
    if (res.length === 0 || Math.abs(c - res[res.length - 1]) > tolerance) {
      res.push(c)
    }
  }
  return res
}

function findClosestIndex(arr: number[], val: number): number {
  let bestIdx = 0
  let bestDiff = Math.abs(arr[0] - val)
  for (let i = 1; i < arr.length; i++) {
    const diff = Math.abs(arr[i] - val)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIdx = i
    }
  }
  return bestIdx
}

function isSegmentBlocked(
  p1: Point,
  p2: Point,
  obstacles: ObstacleRect[],
  eps = 0.01
): boolean {
  const isHoriz = Math.abs(p1.y - p2.y) < eps
  const isVert = Math.abs(p1.x - p2.x) < eps

  if (isHoriz) {
    const y = p1.y
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    for (const b of obstacles) {
      if (y > b.top + eps && y < b.bottom - eps && maxX > b.left + eps && minX < b.right - eps) {
        return true
      }
    }
  } else if (isVert) {
    const x = p1.x
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    for (const b of obstacles) {
      if (x > b.left + eps && x < b.right - eps && maxY > b.top + eps && minY < b.bottom - eps) {
        return true
      }
    }
  }
  return false
}

function isPolylineBlocked(points: Point[], obstacles: ObstacleRect[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (isSegmentBlocked(points[i], points[i + 1], obstacles)) {
      return true
    }
  }
  return false
}

function getStubPoint(pt: Point, pos: Position, stubLen = 24): Point {
  switch (pos) {
    case Position.Right:
      return { x: pt.x + stubLen, y: pt.y }
    case Position.Left:
      return { x: pt.x - stubLen, y: pt.y }
    case Position.Bottom:
      return { x: pt.x, y: pt.y + stubLen }
    case Position.Top:
      return { x: pt.x, y: pt.y - stubLen }
    default:
      return { x: pt.x + stubLen, y: pt.y }
  }
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
      // 挑選折線中央主線段的中點作為預設折點拖曳把手位置
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
 * 智慧直角避障路徑演算法 (Obstacle Avoidance & Auto-Turn Orthogonal Routing)
 * 1. 使用者自訂 waypoint 享最高優先權
 * 2. 未自訂 waypoint 時，檢測路徑是否穿透非自身父層的收納盒與障礙節點
 * 3. 若碰撞障礙物，自動以 24px~32px 安全邊界推算平滑外圍繞行直角路徑
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

  const S: Point = { x: sx, y: sy }
  const T: Point = { x: tx, y: ty }
  const S_stub = getStubPoint(S, sourcePosition, 24)
  const T_stub = getStubPoint(T, targetPosition, 24)

  // 展開障礙物安全邊界 (24px~32px，預設 28px)
  const expandedObstacles: ObstacleRect[] = obstacles.map((b) => ({
    id: b.id,
    left: b.left - margin,
    top: b.top - margin,
    right: b.right + margin,
    bottom: b.bottom + margin,
    isBox: b.isBox,
  }))

  // 快速過濾與此連線相關的障礙物範圍
  const minZoneX = Math.min(sx, tx, S_stub.x, T_stub.x) - margin - 80
  const maxZoneX = Math.max(sx, tx, S_stub.x, T_stub.x) + margin + 80
  const minZoneY = Math.min(sy, ty, S_stub.y, T_stub.y) - margin - 80
  const maxZoneY = Math.max(sy, ty, S_stub.y, T_stub.y) + margin + 80

  const relevantObstacles = expandedObstacles.filter(
    (b) => !(b.right < minZoneX || b.left > maxZoneX || b.bottom < minZoneY || b.top > maxZoneY)
  )

  // 構建標準預設直角折線路徑
  let defaultPoints: Point[]
  if (srcHoriz && tgtHoriz) {
    const midX = (S_stub.x + T_stub.x) / 2
    defaultPoints = [S, S_stub, { x: midX, y: S_stub.y }, { x: midX, y: T_stub.y }, T_stub, T]
  } else if (!srcHoriz && !tgtHoriz) {
    const midY = (S_stub.y + T_stub.y) / 2
    defaultPoints = [S, S_stub, { x: S_stub.x, y: midY }, { x: T_stub.x, y: midY }, T_stub, T]
  } else if (srcHoriz && !tgtHoriz) {
    defaultPoints = [S, S_stub, { x: T_stub.x, y: S_stub.y }, T_stub, T]
  } else {
    defaultPoints = [S, S_stub, { x: S_stub.x, y: T_stub.y }, T_stub, T]
  }

  // 若預設路徑無任何障礙穿透，直接採用乾淨預設路徑
  if (relevantObstacles.length === 0 || !isPolylineBlocked(defaultPoints, relevantObstacles)) {
    const px = (sx + tx) / 2
    const py = (sy + ty) / 2
    return toSvgPath(defaultPoints, px, py)
  }

  // 【規則二：檢測穿透障礙物，執行直角網格避障推算】
  const candX = [
    S.x,
    S_stub.x,
    T.x,
    T_stub.x,
    (S_stub.x + T_stub.x) / 2,
    ...relevantObstacles.flatMap((b) => [b.left, b.right]),
  ]
  const candY = [
    S.y,
    S_stub.y,
    T.y,
    T_stub.y,
    (S_stub.y + T_stub.y) / 2,
    ...relevantObstacles.flatMap((b) => [b.top, b.bottom]),
  ]

  const xs = dedupeCoords(candX, 2)
  const ys = dedupeCoords(candY, 2)

  const sXIdx = findClosestIndex(xs, S_stub.x)
  const sYIdx = findClosestIndex(ys, S_stub.y)
  const tXIdx = findClosestIndex(xs, T_stub.x)
  const tYIdx = findClosestIndex(ys, T_stub.y)

  // A* 搜尋最短低轉折直角路徑
  interface NodeState {
    xIdx: number
    yIdx: number
    dir: number // 0: 水平, 1: 垂直, 2: 初始
    g: number
    f: number
    parent?: NodeState
  }

  const openList: NodeState[] = [
    {
      xIdx: sXIdx,
      yIdx: sYIdx,
      dir: 2,
      g: 0,
      f: Math.abs(xs[sXIdx] - xs[tXIdx]) + Math.abs(ys[sYIdx] - ys[tYIdx]),
    },
  ]

  const closedMap = new Map<string, number>()
  let foundState: NodeState | null = null
  let maxIters = 400

  while (openList.length > 0 && maxIters-- > 0) {
    let bestIdx = 0
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) {
        bestIdx = i
      }
    }
    const cur = openList.splice(bestIdx, 1)[0]

    if (cur.xIdx === tXIdx && cur.yIdx === tYIdx) {
      foundState = cur
      break
    }

    const key = `${cur.xIdx},${cur.yIdx},${cur.dir}`
    const recordedG = closedMap.get(key)
    if (recordedG !== undefined && recordedG <= cur.g) {
      continue
    }
    closedMap.set(key, cur.g)

    const curPt: Point = { x: xs[cur.xIdx], y: ys[cur.yIdx] }

    // 探尋水平鄰居 (左、右)
    const horizNeighbors = [cur.xIdx - 1, cur.xIdx + 1]
    for (const nX of horizNeighbors) {
      if (nX < 0 || nX >= xs.length) continue
      const nextPt: Point = { x: xs[nX], y: curPt.y }
      if (isSegmentBlocked(curPt, nextPt, relevantObstacles)) continue

      const segDist = Math.abs(nextPt.x - curPt.x)
      const turnPenalty = cur.dir === 1 ? 40 : 0
      const nextG = cur.g + segDist + turnPenalty
      const h = Math.abs(nextPt.x - xs[tXIdx]) + Math.abs(nextPt.y - ys[tYIdx])

      openList.push({
        xIdx: nX,
        yIdx: cur.yIdx,
        dir: 0,
        g: nextG,
        f: nextG + h,
        parent: cur,
      })
    }

    // 探尋垂直鄰居 (上、下)
    const vertNeighbors = [cur.yIdx - 1, cur.yIdx + 1]
    for (const nY of vertNeighbors) {
      if (nY < 0 || nY >= ys.length) continue
      const nextPt: Point = { x: curPt.x, y: ys[nY] }
      if (isSegmentBlocked(curPt, nextPt, relevantObstacles)) continue

      const segDist = Math.abs(nextPt.y - curPt.y)
      const turnPenalty = cur.dir === 0 ? 40 : 0
      const nextG = cur.g + segDist + turnPenalty
      const h = Math.abs(nextPt.x - xs[tXIdx]) + Math.abs(nextPt.y - ys[tYIdx])

      openList.push({
        xIdx: cur.xIdx,
        yIdx: nY,
        dir: 1,
        g: nextG,
        f: nextG + h,
        parent: cur,
      })
    }
  }

  if (foundState) {
    const rawAStar: Point[] = []
    let curr: NodeState | undefined = foundState
    while (curr) {
      rawAStar.unshift({ x: xs[curr.xIdx], y: ys[curr.yIdx] })
      curr = curr.parent
    }
    const finalPoints = [S, ...rawAStar, T]
    return toSvgPath(finalPoints)
  }

  // 【安全退避：若網格無法抵達，自動依包圍外邊界繞行】
  const minObsTop = Math.min(...relevantObstacles.map((b) => b.top))
  const maxObsBottom = Math.max(...relevantObstacles.map((b) => b.bottom))
  const minObsLeft = Math.min(...relevantObstacles.map((b) => b.left))
  const maxObsRight = Math.max(...relevantObstacles.map((b) => b.right))

  if (srcHoriz && tgtHoriz) {
    const midY = (sy + ty) / 2
    const detourY =
      Math.abs(minObsTop - midY) <= Math.abs(maxObsBottom - midY)
        ? minObsTop - 8
        : maxObsBottom + 8
    const bypassPoints: Point[] = [
      S,
      S_stub,
      { x: S_stub.x, y: detourY },
      { x: T_stub.x, y: detourY },
      T_stub,
      T,
    ]
    return toSvgPath(bypassPoints)
  }

  if (!srcHoriz && !tgtHoriz) {
    const midX = (sx + tx) / 2
    const detourX =
      Math.abs(minObsLeft - midX) <= Math.abs(maxObsRight - midX)
        ? minObsLeft - 8
        : maxObsRight + 8
    const bypassPoints: Point[] = [
      S,
      S_stub,
      { x: detourX, y: S_stub.y },
      { x: detourX, y: T_stub.y },
      T_stub,
      T,
    ]
    return toSvgPath(bypassPoints)
  }

  return toSvgPath(defaultPoints)
}
