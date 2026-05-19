---
phase: 08
fixed_at: 2026-05-19T20:40:00Z
review_path: .planning/phases/08-empty-states-with-ctas/08-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 2
status: partial
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-05-19T20:40:00Z
**Source review:** `.planning/phases/08-empty-states-with-ctas/08-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 1 (WR-01 only, per user selection)
- Fixed: 1
- Skipped: 2 (WR-02, WR-03 — out of scope per user selection)

User scoped this iteration to WR-01 only. WR-02, WR-03, and all five Info findings were explicitly not in scope. They are not failures — they remain available for a future iteration.

## Fixed Issues

### WR-01: AssetLibrary empty-state CTA opens form pre-selected to "consumable", contradicting the "Add Material" CTA label and the "No materials in your library yet" headline

**Files modified:** `src/components/AssetLibrary.tsx`
**Commit:** `72c40f6`
**Applied fix:** Option A from REVIEW.md. Introduced `startAddingFilament` adjacent to the existing `startAdding` handler (inserted at line 323, immediately after `startAdding` ends at line 321). The new helper unconditionally sets `formData.category` to `'filament'` while preserving the rest of `startAdding`'s state machine (clears `editingId`, `showCustomCategory`, `customCategoryInput`, sets `isAdding`). The empty-state `EmptyState` CTA at line 409 was rewired from `onClick: startAdding` to `onClick: startAddingFilament`. The pre-existing top-right "+ Add Material" button (line 394) still calls `startAdding`, preserving the populated-state behaviour of "pre-select from current filter."

Verification:
- `npx tsc -b` exit 0
- `npm test -- --run` exit 0 (13 tests passing — no test regressions)
- `npm run lint:no-raw-html` passed

## Skipped Issues

### WR-02: Settings tab stacks two `NewBadge` instances at the same anchor

**File:** `src/App.tsx:258-261`
**Reason:** out of scope per user selection — this iteration is scoped to WR-01 only.
**Original issue:** Two `NewBadge` calls inside the same Settings tab button — a pre-existing inline badge (`feature="printer-maintenance-alerts"`) and the new Phase 8 overlay badge (`feature="empty-states"`). The inline badge is currently age-gated off, so the issue is latent. Plan 02 acknowledged this as PD-09 / "tech debt logged." Recommended fix in REVIEW.md is Option A: delete the stale `feature="printer-maintenance-alerts"` badge and its `features.ts` entry.

### WR-03: Empty-state CTA on a touch device can fire twice (CTA-in-context + top-bar duplicate)

**Files:** `src/components/AssetLibrary.tsx:357-388` + `:392-398`; `src/components/PrinterSettings.tsx:80-82` + `:200-205`
**Reason:** out of scope per user selection — this iteration is scoped to WR-01 only.
**Original issue:** In AssetLibrary and PrinterSettings, the top-right "+ Add" button stays visible while the EmptyState renders below it. Both controls invoke the same handler. This is acceptable per PATTERNS Pattern 5 ("CTA-in-context is the whole point") but the design contract did not lock a differentiation rule. AssetLibrary's top-bar "Reset" button is also still active in the empty state with copy that becomes misleading. REVIEW.md flagged this as "defer or close" with no code change required for v1 ship if the team explicitly accepts the redundancy.

## Info findings

All five Info findings (IN-01 through IN-05) were not in scope per user selection. They remain in REVIEW.md for future consideration.

---

_Fixed: 2026-05-19T20:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
