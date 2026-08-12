# PMFlow Project Long-Term Memory & Agent Rules

This file documents the long-term memory, project guidelines, user preferences, and Graph View refactoring rules for PMFlow.

---

## 1. Interaction & Workflow Rules
- **Response Format**: Keep responses concise and focused under 100 words unless detailed explanation is specifically requested.
- **Phased Verification & Approval**: Divide major tasks into clear phases (Phase 1: Cards, Phase 2: Storage Boxes, Phase 3: Lines, Phase 4: Common/Menu). Wait for user approval before moving to the next phase.
- **Multi-Input Problem Confirmation**: Before starting code modifications for bug fixes or feature requests, confirm problem details and symptoms through multi-turn user interaction to verify it is indeed the target issue.
- **Git & Build Rules**: Perform only local git commits. Do not push to remote without explicit instructions. Always rebuild Docker dev containers (`docker compose -f docker-compose.dev.yml up --build -d web`) after changes.
- **Strict Scope Rule**: Only modify code/features explicitly requested by the user. Do NOT make any unrequested changes or modifications.

---

## 2. Graph View Core Layout & Interaction Rules

### A. Storage Box Rules
1. **Vertical Column-First Alignment**:
   - Cards inside storage boxes fill vertically down Column 0 (5 cards max: rows 0 to 4), then move right to Column 1 (5 cards max), filling top to bottom.
2. **Initial Drop vs Internal Manual Drag**:
   - Auto-grid layout ONLY applies when a card is FIRST moved into a storage box.
   - Internal drags inside a box retain their relative manual offsets without forcing unmoved cards to re-sort.

### B. Dragging Interaction Rules
1. **Single Card Drag (Default)**:
   - Standard dragging MUST move ONLY the single dragged card. Storage boxes and sibling cards stay completely still.
2. **Batch Drag (Modifier Key Required)**:
   - Moving multiple cards or a container box with its children MUST require holding modifier keys (`Shift` or `Ctrl`).
3. **Smooth Entry & Exit (No Jump/Snap)**:
   - **Moving OUT of a Box**: The card becomes independent (`parentId: null`). Its resting position IS the canvas drop position `{ targetX, targetY }` where the mouse was released. It must NOT snap to other cards or topological columns.
   - **Moving IN to a Box**: The card becomes a child (`parentId: boxId`). It is automatically assigned the next inside-box grid slot position `{ x: 24 + cIdx * 312, y: 60 + rIdx * 120 }`.

### C. Dependency Line & Modal Rules
1. **Clean Line Labels**:
   - Ordinary 1-on-1 dependency lines do NOT render text labels (such as "完成後開始").
   - ONLY Junction/Hub nodes render "同時開始" (Fork) or "同時完成" (Join) text labels.
2. **Delete Line Modal Text**:
   - The deletion modal prompt MUST state: `是否刪除 [上游卡片Ref] 與 [下游卡片Ref] 的關聯？` (e.g. `是否刪除 MRG-1 與 MRG-2 的關聯？`).

---

## 3. Left Menu Sidebar Sorting Rules
The menu sidebar follows a strict 3-tier group sorting hierarchy:
1. **Group 1 (Top)**: Storage Boxes (Containers), sorted numerically by MRG / Ref number (`MRG-1`, `MRG-2`...).
2. **Group 2 (Middle)**: Linked Cards (with dependency lines), sorted by topological rank (upstream cards first, downstream cards immediately following).
3. **Divider Line**: Placed immediately below the last linked card in Group 2.
4. **Group 3 (Bottom)**: Unlinked Standalone Cards (without dependency lines), sorted numerically by MRG / Ref number (`MRG-1`, `MRG-2`...).

---

## 4. Change History & Code Index Pointer (AI 啟動必載入導引)
- **Change Log & Code Index**: All feature modification logs, bug fixes, and exact file/line number indexes are documented in [CHANGELOG_INDEX.md](file:///D:/NewProject/pmflow-git/CHANGELOG_INDEX.md).
- **AI Startup Requirement**: On every startup or when asked to locate/modify code, AI MUST consult [CHANGELOG_INDEX.md](file:///D:/NewProject/pmflow-git/CHANGELOG_INDEX.md) to quickly pinpoint affected modules and review historical implementation rules before making edits.
