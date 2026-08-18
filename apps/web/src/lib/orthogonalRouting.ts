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
 * 1. 遞迴取得 sourceId 與 targetId 的所有祖先節點 ID (包含自身父收納盒與更上層收納盒)。
 * 2. 排除 sourceId、targetId 自身。
 * 3. 排除所有 frame / annotationFrame（標示框，純視覺附加元件）。
 * 4. 排除所有 text / annotationText（純文字註記，純視覺附加元件）。
 * 5. 排除屬於 sourceId 或 targetId 之父容器/祖先容器的收納盒（當下收納盒），允許線在內部穿行或進出該盒。
 * 6. 其餘所有卡片（包含同盒內的其它卡片、畫布上所有卡片）與其它第三方收納盒皆作為不可穿透之 ObstacleRect。
 */
export function getObstaclesFromNodes(
  nodes: Node[],
  sourceId?: string,
  targetId?: string
): ObstacleRect[] {
  if (!nodes || nodes.length === 0) return []

  const nodeMap = new Map<string, Node>()
  for (const n of nodes) {
    if (n && n.id) {
      nodeMap.set(n.id, n)
    }
  }

  // 1. 遞迴取得 sourceId 與 targetId 的所有祖先節點 ID
  const getAncestors = (id?: string): Set<string> => {
    const ancestors = new Set<string>()
    if (!id) return ancestors
    let cur = nodeMap.get(id)
    const visited = new Set<string>()
    while (cur?.parentId && !visited.has(cur.parentId)) {
      ancestors.add(cur.parentId)
      visited.add(cur.parentId)
      cur = nodeMap.get(cur.parentId)
    }
    return ancestors
  }

  const exemptContainerIds = new Set([
    ...getAncestors(sourceId),
    ...getAncestors(targetId),
  ])

  const obstacles: ObstacleRect[] = []

  for (const n of nodes) {
    if (!n || !n.id) continue

    // 排除起點、終點自身
    if (n.id === sourceId || n.id === targetId) continue

    // 排除隱藏節點
    if (n.hidden) continue

    const nodeData = n.data as Record<string, unknown> | undefined
    const nodeType = n.type || ''
    const nodeMode = nodeData?.mode

    // 排除所有 frame / annotationFrame（標示框）
    const isFrame = Boolean(
      nodeMode === 'frame' ||
      nodeType === 'frame' ||
      nodeType === 'annotationFrame'
    )
    if (isFrame) continue

    // 排除所有 text / annotationText（純文字）
    const isText = Boolean(
      nodeMode === 'text' ||
      nodeType === 'text' ||
      nodeType === 'annotationText'
    )
    if (isText) continue

    // 判斷是否為收納盒 (Box)
    const isBox = Boolean(
      nodeMode === 'box' ||
      nodeType === 'box' ||
      (n.style && typeof n.style.width === 'number' && n.style.width >= 340)
    )

    // 若為起點或終點的父容器/祖先收納盒，允許穿行進出（不列為障礙物）
    if (isBox && exemptContainerIds.has(n.id)) {
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

/**
 * 檢查正交線段是否穿透障礙物矩形 (留 eps 餘裕以避免外緣貼齊誤判)
 */
function isSegmentCrossingBox(
  p1: Point,
  p2: Point,
  b: ObstacleRect,
  eps = 2
): boolean {
  const isHoriz = Math.abs(p1.y - p2.y) < eps
  const isVert = Math.abs(p1.x - p2.x) < eps

  if (isHoriz) {
    const y = (p1.y + p2.y) / 2
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    return (
      y > b.top + eps &&
      y < b.bottom - eps &&
      maxX > b.left + eps &&
      minX < b.right - eps
    )
  } else if (isVert) {
    const x = (p1.x + p2.x) / 2
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    return (
      x > b.left + eps &&
      x < b.right - eps &&
      maxY > b.top + eps &&
      minY < b.bottom - eps
    )
  }

  const minX = Math.min(p1.x, p2.x)
  const maxX = Math.max(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  return !(
    maxX <= b.left + eps ||
    minX >= b.right - eps ||
    maxY <= b.top + eps ||
    minY >= b.bottom - eps
  )
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
 * 計算折線上視覺最平穩的折點 / 標籤座標 (px, py)
 */
export function getPolylineMidpoint(pts: Point[]): { px: number; py: number } {
  if (pts.length <= 1) {
    return { px: pts[0]?.x ?? 0, py: pts[0]?.y ?? 0 }
  }
  if (pts.length === 2) {
    return {
      px: Math.round((pts[0].x + pts[1].x) / 2),
      py: Math.round((pts[0].y + pts[1].y) / 2),
    }
  }

  // 尋找最長內部線段（優先選擇避障繞道通道線段）
  let bestSegIdx = 0
  let maxSegLen = -1

  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y)
    const isMiddle = i > 0 && i < pts.length - 2
    const weightedLen = isMiddle ? len * 1.3 : len
    if (weightedLen > maxSegLen) {
      maxSegLen = weightedLen
      bestSegIdx = i
    }
  }

  const p1 = pts[bestSegIdx]
  const p2 = pts[bestSegIdx + 1]
  return {
    px: Math.round((p1.x + p2.x) / 2),
    py: Math.round((p1.y + p2.y) / 2),
  }
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
    const mid = getPolylineMidpoint(pts)
    px = mid.px
    py = mid.py
  }

  return {
    path,
    px: Math.round(px),
    py: Math.round(py),
  }
}

function getDirectionVector(pos: Position): { dx: number; dy: number } {
  switch (pos) {
    case Position.Left:
      return { dx: -1, dy: 0 }
    case Position.Right:
      return { dx: 1, dy: 0 }
    case Position.Top:
      return { dx: 0, dy: -1 }
    case Position.Bottom:
      return { dx: 0, dy: 1 }
    default:
      return { dx: 1, dy: 0 }
  }
}

/**
 * 在正交網格 (Steiner Grid) 上使用 A* 尋找 0 碰撞、最少彎折與最短繞行路徑
 */
function findGridAStarPath(
  start: Point,
  end: Point,
  s0: Point,
  t0: Point,
  obstacles: ObstacleRect[],
  xCoords: number[],
  yCoords: number[]
): Point[] | null {
  const cleanCoords = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b)
    const res: number[] = []
    for (const val of sorted) {
      if (res.length === 0 || Math.abs(val - res[res.length - 1]) > 4) {
        res.push(val)
      }
    }
    return res
  }

  const xs = cleanCoords(xCoords)
  const ys = cleanCoords(yCoords)

  if (xs.length < 2 || ys.length < 2) return null

  const findClosestIdx = (coords: number[], val: number) => {
    let bestIdx = 0
    let minDiff = Infinity
    for (let i = 0; i < coords.length; i++) {
      const diff = Math.abs(coords[i] - val)
      if (diff < minDiff) {
        minDiff = diff
        bestIdx = i
      }
    }
    return bestIdx
  }

  const startXi = findClosestIdx(xs, start.x)
  const startYi = findClosestIdx(ys, start.y)
  const endXi = findClosestIdx(xs, end.x)
  const endYi = findClosestIdx(ys, end.y)

  // Node state in A*: (xi, yi, dir) where dir: 0 = none, 1 = H, 2 = V
  const toKey = (xi: number, yi: number, dir: number): string => `${xi},${yi},${dir}`

  interface AStarNode {
    xi: number
    yi: number
    dir: number
    g: number
    f: number
    parent?: AStarNode
  }

  const openSet = new Map<string, AStarNode>()
  const closedSet = new Set<string>()

  const startNode: AStarNode = {
    xi: startXi,
    yi: startYi,
    dir: 0,
    g: 0,
    f: Math.abs(xs[startXi] - xs[endXi]) + Math.abs(ys[startYi] - ys[endYi]),
  }
  openSet.set(toKey(startXi, startYi, 0), startNode)

  let maxIterations = 3000
  let bestEndNode: AStarNode | null = null

  while (openSet.size > 0 && maxIterations-- > 0) {
    let current: AStarNode | null = null
    let lowestF = Infinity
    for (const node of openSet.values()) {
      if (node.f < lowestF) {
        lowestF = node.f
        current = node
      }
    }

    if (!current) break

    const curKey = toKey(current.xi, current.yi, current.dir)
    openSet.delete(curKey)
    closedSet.add(curKey)

    if (current.xi === endXi && current.yi === endYi) {
      bestEndNode = current
      break
    }

    const curX = xs[current.xi]
    const curY = ys[current.yi]

    // 4 directions: Right, Left, Down, Up
    const neighbors: Array<{ xi: number; yi: number; dir: number }> = [
      { xi: current.xi + 1, yi: current.yi, dir: 1 },
      { xi: current.xi - 1, yi: current.yi, dir: 1 },
      { xi: current.xi, yi: current.yi + 1, dir: 2 },
      { xi: current.xi, yi: current.yi - 1, dir: 2 },
    ]

    for (const n of neighbors) {
      if (n.xi < 0 || n.xi >= xs.length || n.yi < 0 || n.yi >= ys.length) continue

      const nKey = toKey(n.xi, n.yi, n.dir)
      if (closedSet.has(nKey)) continue

      const nX = xs[n.xi]
      const nY = ys[n.yi]

      const segP1: Point = { x: curX, y: curY }
      const segP2: Point = { x: nX, y: nY }

      let segmentCollisions = 0
      for (const obs of obstacles) {
        if (isSegmentCrossingBox(segP1, segP2, obs)) {
          segmentCollisions++
        }
      }

      const dist = Math.abs(nX - curX) + Math.abs(nY - curY)
      // 降低直角轉彎權重 (20)，允許路徑在複雜障礙物間多次轉直角靈活避開
      const bendCost = current.dir !== 0 && current.dir !== n.dir ? 20 : 0
      const collisionCost = segmentCollisions * 1000000

      const tentativeG = current.g + dist + bendCost + collisionCost
      const h = Math.abs(nX - xs[endXi]) + Math.abs(nY - ys[endYi])
      const tentativeF = tentativeG + h

      const existing = openSet.get(nKey)
      if (!existing || tentativeG < existing.g) {
        openSet.set(nKey, {
          xi: n.xi,
          yi: n.yi,
          dir: n.dir,
          g: tentativeG,
          f: tentativeF,
          parent: current,
        })
      }
    }
  }

  if (!bestEndNode) return null

  const gridPoints: Point[] = []
  let curr: AStarNode | undefined = bestEndNode
  while (curr) {
    gridPoints.unshift({ x: xs[curr.xi], y: ys[curr.yi] })
    curr = curr.parent
  }

  return simplifyPoints([s0, start, ...gridPoints, end, t0])
}

/**
 * 智慧直角避障路徑演算法 (極速、零抖動、幾何推移繞道與正交網格搜尋)
 * 1. 使用者自訂 waypoint 享最高優先權
 * 2. 檢測路徑是否穿透盒內其他卡片、畫布其他卡片或第三方收納盒
 * 3. 若碰撞障礙物，精準生成 20px 接點延伸 Stub，並在多通道候選與正交 Steiner Grid 中選取 0 碰撞的最短折線路徑
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
  if (
    waypoint &&
    typeof waypoint.x === 'number' &&
    typeof waypoint.y === 'number' &&
    Number.isFinite(waypoint.x) &&
    Number.isFinite(waypoint.y)
  ) {
    const px = waypoint.x
    const py = waypoint.y
    const a = srcHoriz ? { x: px, y: sy } : { x: sx, y: py }
    const b = tgtHoriz ? { x: px, y: ty } : { x: tx, y: py }
    const raw = [{ x: sx, y: sy }, a, { x: px, y: py }, b, { x: tx, y: ty }]
    return toSvgPath(raw, px, py)
  }

  const s0: Point = { x: sx, y: sy }
  const t0: Point = { x: tx, y: ty }
  const sVec = getDirectionVector(sourcePosition)
  const tVec = getDirectionVector(targetPosition)
  const sStub: Point = { x: sx + sVec.dx * margin, y: sy + sVec.dy * margin }
  const tStub: Point = { x: tx + tVec.dx * margin, y: ty + tVec.dy * margin }

  // 構建標準預設直角折線路徑
  let basePoints: Point[]
  if (srcHoriz && tgtHoriz) {
    const midX = (sStub.x + tStub.x) / 2
    if ((sVec.dx > 0 && tVec.dx < 0 && sStub.x <= tStub.x) || (sVec.dx < 0 && tVec.dx > 0 && sStub.x >= tStub.x)) {
      basePoints = [s0, sStub, { x: midX, y: sStub.y }, { x: midX, y: tStub.y }, tStub, t0]
    } else {
      const midY = (sStub.y + tStub.y) / 2
      basePoints = [s0, sStub, { x: sStub.x, y: midY }, { x: tStub.x, y: midY }, tStub, t0]
    }
  } else if (!srcHoriz && !tgtHoriz) {
    const midY = (sStub.y + tStub.y) / 2
    if ((sVec.dy > 0 && tVec.dy < 0 && sStub.y <= tStub.y) || (sVec.dy < 0 && tVec.dy > 0 && sStub.y >= tStub.y)) {
      basePoints = [s0, sStub, { x: sStub.x, y: midY }, { x: tStub.x, y: midY }, tStub, t0]
    } else {
      const midX = (sStub.x + tStub.x) / 2
      basePoints = [s0, sStub, { x: midX, y: sStub.y }, { x: midX, y: tStub.y }, tStub, t0]
    }
  } else if (srcHoriz && !tgtHoriz) {
    basePoints = [s0, sStub, { x: tStub.x, y: sStub.y }, tStub, t0]
  } else {
    basePoints = [s0, sStub, { x: sStub.x, y: tStub.y }, tStub, t0]
  }

  basePoints = simplifyPoints(basePoints)

  if (!obstacles || obstacles.length === 0) {
    return toSvgPath(basePoints)
  }

  // 快速過濾與當前起訖點連線區域相關的障礙物 (包含卡片與第三方收納盒)
  const zoneMinX = Math.min(sx, tx, sStub.x, tStub.x) - margin * 3 - 60
  const zoneMaxX = Math.max(sx, tx, sStub.x, tStub.x) + margin * 3 + 60
  const zoneMinY = Math.min(sy, ty, sStub.y, tStub.y) - margin * 3 - 60
  const zoneMaxY = Math.max(sy, ty, sStub.y, tStub.y) + margin * 3 + 60

  const relevantObstacles = obstacles.filter(
    (b) => !(b.right < zoneMinX || b.left > zoneMaxX || b.bottom < zoneMinY || b.top > zoneMaxY)
  )

  if (relevantObstacles.length === 0 || countPolylineCollisions(basePoints, relevantObstacles) === 0) {
    return toSvgPath(basePoints)
  }

  // 【規則二：多通道幾何推移繞道 (Multi-Corridor Geometric Detour) & 正交網格求解】
  const hittingObstacles = relevantObstacles.filter((b) => {
    for (let i = 0; i < basePoints.length - 1; i++) {
      if (isSegmentCrossingBox(basePoints[i], basePoints[i + 1], b)) {
        return true
      }
    }
    return false
  })

  const obsList = hittingObstacles.length > 0 ? hittingObstacles : relevantObstacles

  let minLeft = Infinity
  let maxRight = -Infinity
  let minTop = Infinity
  let maxBottom = -Infinity

  for (const b of obsList) {
    if (b.left < minLeft) minLeft = b.left
    if (b.right > maxRight) maxRight = b.right
    if (b.top < minTop) minTop = b.top
    if (b.bottom > maxBottom) maxBottom = b.bottom
  }

  const yLevels = new Set<number>([
    minTop - margin,
    maxBottom + margin,
    sy,
    ty,
    sStub.y,
    tStub.y,
    (sStub.y + tStub.y) / 2,
  ])

  const xLevels = new Set<number>([
    minLeft - margin,
    maxRight + margin,
    sx,
    tx,
    sStub.x,
    tStub.x,
    (sStub.x + tStub.x) / 2,
  ])

  for (const b of obsList) {
    yLevels.add(b.top - margin)
    yLevels.add(b.bottom + margin)
    xLevels.add(b.left - margin)
    xLevels.add(b.right + margin)
  }

  // 障礙物間隙通道
  for (let i = 0; i < obsList.length; i++) {
    for (let j = i + 1; j < obsList.length; j++) {
      const b1 = obsList[i]
      const b2 = obsList[j]
      if (b1.bottom < b2.top && b2.top - b1.bottom >= margin) {
        yLevels.add((b1.bottom + b2.top) / 2)
      }
      if (b2.bottom < b1.top && b1.top - b2.bottom >= margin) {
        yLevels.add((b2.bottom + b1.top) / 2)
      }
      if (b1.right < b2.left && b2.left - b1.right >= margin) {
        xLevels.add((b1.right + b2.left) / 2)
      }
      if (b2.right < b1.left && b1.left - b2.right >= margin) {
        xLevels.add((b2.right + b1.left) / 2)
      }
    }
  }

  const candidatePaths: Point[][] = [basePoints]

  // 生成幾何通道候選路徑
  for (const yCorr of yLevels) {
    candidatePaths.push(
      simplifyPoints([
        s0,
        sStub,
        { x: sStub.x, y: yCorr },
        { x: tStub.x, y: yCorr },
        tStub,
        t0,
      ])
    )
    if (srcHoriz) {
      const midX = (sStub.x + tStub.x) / 2
      candidatePaths.push(
        simplifyPoints([
          s0,
          sStub,
          { x: midX, y: sStub.y },
          { x: midX, y: yCorr },
          { x: tStub.x, y: yCorr },
          tStub,
          t0,
        ])
      )
    }
  }

  for (const xCorr of xLevels) {
    candidatePaths.push(
      simplifyPoints([
        s0,
        sStub,
        { x: xCorr, y: sStub.y },
        { x: xCorr, y: tStub.y },
        tStub,
        t0,
      ])
    )
    if (!srcHoriz) {
      const midY = (sStub.y + tStub.y) / 2
      candidatePaths.push(
        simplifyPoints([
          s0,
          sStub,
          { x: sStub.x, y: midY },
          { x: xCorr, y: midY },
          { x: xCorr, y: tStub.y },
          tStub,
          t0,
        ])
      )
    }
  }

  // 雙軸通道候選
  for (const xCorr of [minLeft - margin, maxRight + margin]) {
    for (const yCorr of [minTop - margin, maxBottom + margin]) {
      candidatePaths.push(
        simplifyPoints([
          s0,
          sStub,
          { x: sStub.x, y: yCorr },
          { x: xCorr, y: yCorr },
          { x: xCorr, y: tStub.y },
          tStub,
          t0,
        ])
      )
      candidatePaths.push(
        simplifyPoints([
          s0,
          sStub,
          { x: xCorr, y: sStub.y },
          { x: xCorr, y: yCorr },
          { x: tStub.x, y: yCorr },
          tStub,
          t0,
        ])
      )
    }
  }

  // 網格 A* 求解
  const aStarPoints = findGridAStarPath(
    sStub,
    tStub,
    s0,
    t0,
    relevantObstacles,
    Array.from(xLevels),
    Array.from(yLevels)
  )
  if (aStarPoints) {
    candidatePaths.push(aStarPoints)
  }

  let bestPoints = basePoints
  let bestScore = Infinity

  for (const points of candidatePaths) {
    const collisions = countPolylineCollisions(points, relevantObstacles)
    const bends = Math.max(0, points.length - 2)
    const len = polylineLength(points)
    // 優先保證 0 碰撞 (零穿透)，同時允許靈活多次直角折線繞道
    const score = collisions * 1000000 + bends * 20 + len

    if (score < bestScore) {
      bestScore = score
      bestPoints = points
    }
  }

  return toSvgPath(bestPoints)
}
