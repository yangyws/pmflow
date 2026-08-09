# PMFlow Customization Rules & Long-Term Memory

- **Responses**: Always keep responses short and under 100 words.
- **Git Commits**: Local git commits only.
- **Docker Workflow**: Always build and restart web container via `docker compose -f docker-compose.dev.yml up --build -d web`.
- **Phased Approvals**: Work in 4 distinct phases (Cards ➔ Storage Boxes ➔ Lines ➔ Common/Menu) and wait for user approval after each phase.
- **Graph Rules**:
  1. Box grid: 5 vertical cards per column (Column 0 down 5 cards, then Column 1).
  2. Single drag default (1 card only); modifier keys (`Shift`/`Ctrl`) required for multi-drag.
  3. Ordinary lines hide labels; Junction nodes show "同時開始" / "同時完成".
  4. Line delete modal: `是否刪除 [上游Ref] 與 [下游Ref] 的關聯？`.
  5. Box entry/exit: Exit stays at canvas release position `{targetX, targetY}`; Entry aligns to box slot `{24 + cIdx*312, 60 + rIdx*120}`.
  6. Menu sorting: Storage Boxes (top, by Ref) ➔ Linked Cards (middle, topological) ➔ [Divider Line] ➔ Unlinked Cards (bottom, by Ref).
