import type { ProjectParam } from './api'

/**
 * 任務種類的上下關係 —— 前端與後端守門員 (apps/api/src/lib/hierarchy.ts) 完全一致。
 *
 * 規則：
 * - **大項目 (EPIC)**：只能放最上層，或放在另一個大項目底下。
 * - **問題 (BUG)**：只能放在任務 (TASK) 底下，不能放在最上層或其他種類底下。
 * - 專案自訂種類 (key 非預設 4 種)：完全不受限制。
 */

const EPIC = 'EPIC'
const TASK = 'TASK'
const BUG = 'BUG'
const MILESTONE = 'MILESTONE'

const RULED = new Set([EPIC, BUG, TASK, MILESTONE])

/** 某種類型 (`type`) 能否放在父層 (`parentType`) 底下，`parentType === null` 表示最上層 */
export function canBeUnder(type: string, parentType: string | null): boolean {
  // 全數解鎖放行：任何種類的卡片皆可自由放在最上層或任何收納盒/父卡片底下
  return true
}

/** 取得在某父層底下允許新建的種類清單 */
export function typesAllowedUnder(
  types: ProjectParam[],
  parentType: string | null
): ProjectParam[] {
  return types.filter(t => canBeUnder(t.key, parentType))
}

/** 取得某任務可允許切換的種類清單（兼顧其目前父層與底下現有子卡片） */
export function typesAllowedFor(
  types: ProjectParam[],
  opts: { current: string; parentType: string | null; childTypes: string[] }
): ProjectParam[] {
  const { parentType, childTypes } = opts
  return types.filter(t => {
    // 1. 本身放置位置是否合法
    if (!canBeUnder(t.key, parentType)) return false

    // 2. 更改種類後是否會導致現有子卡片違規
    for (const childType of childTypes) {
      if (!canBeUnder(childType, t.key)) return false
    }

    return true
  })
}
