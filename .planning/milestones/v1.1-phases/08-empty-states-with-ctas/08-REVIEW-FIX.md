---
phase: 08
fixed_at: 2026-05-19T20:40:00Z
updated_at: 2026-05-19T20:46:00Z
review_path: .planning/phases/08-empty-states-with-ctas/08-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-05-19T20:40:00Z
**Updated at:** 2026-05-19T20:46:00Z (WR-02 + WR-03 applied per expanded user scope)
**Source review:** `.planning/phases/08-empty-states-with-ctas/08-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0

Iteration 1 applied WR-01 only (commit `72c40f6`). Iteration 2 expanded the scope to include WR-02 and WR-03 per user direction. All three Warning findings are now resolved. The five Info findings (IN-01 through IN-05) remain out of scope and are unchanged in REVIEW.md for future consideration.

## Fixed Issues

### WR-01: AssetLibrary empty-state CTA opens form pre-selected to "consumable", contradicting the "Add Material" CTA label and the "No materials in your library yet" headline

**Files modified:** `src/components/AssetLibrary.tsx`
**Commit:** `72c40f6`
**Applied fix:** Option A from REVIEW.md. Introduced `startAddingFilament` adjacent to the existing `startAdding` handler (inserted at line 323, immediately after `startAdding` ends at line 321). The new helper unconditionally sets `formData.category` to `'filament'` while preserving the rest of `startAdding`'s state machine (clears `editingId`, `showCustomCategory`, `customCategoryInput`, sets `isAdding`). The empty-state `EmptyState` CTA at line 409 was rewired from `onClick: startAdding` to `onClick: startAddingFilament`. The pre-existing top-right "+ Add Material" button (line 394) still calls `startAdding`, preserving the populated-state behaviour of "pre-select from current filter."

Verification:
- `npx tsc -b` exit 0
- `npm test -- --run` exit 0 (13 tests passing — no test regressions)
- `npm run lint:no-raw-html` passed

### WR-02: Settings tab stacks two `NewBadge` instances at the same anchor — pre-existing inline badge + new absolute-overlay badge — without a layering plan

**Files modified:** `src/App.tsx`, `src/features.ts`
**Commit:** `544fc2e`
**Applied fix:** Option A from REVIEW.md (smallest diff, removes the latent collision entirely). Deleted the inline `{tab.id === 'settings' && <NewBadge feature="printer-maintenance-alerts" />}` line from `src/App.tsx` (was at line 258). Removed the `'printer-maintenance-alerts': new Date('2026-04-15'),` entry from `src/features.ts` (was at line 19). The Phase 8 absolute-overlay `empty-states` NewBadge on jobs/materials/settings tabs is intact and is now the only NewBadge rendered on the Settings tab. The NEW badge project-memory rule is preserved: the surviving badge uses the canonical `absolute -top-1 -right-1` overlay pattern on a `relative` host (the tab `<button>` already has `relative` from line 250's `transition-colors relative whitespace-nowrap`).

Verification:
- `npx tsc -b` exit 0
- `npm test -- --run` exit 0 (13 tests passing)
- `npm run lint:no-raw-html` passed

### WR-03: Empty-state CTA on a touch device can fire twice (CTA-in-context + top-bar duplicate) — visible UX, no error, but accepted-without-flag

**Files modified:** `src/components/AssetLibrary.tsx`
**Commit:** `7b433e1`
**Applied fix:** Surgical sub-fix from REVIEW.md ("in the empty state branch only, replace the Reset button with no-op or hide it. One-line change inside `{!isAdding && (<>…</>)}` block"). Wrapped the existing AssetLibrary "Reset All" Button (lines 384-391) in an `{assets.length > 0 && (...)}` guard so the Reset button is hidden when the library is empty. This removes the misleading "replace your current materials with the default list" confirm copy from the empty state where there are zero materials to replace. The top-right "+ Add Material" button is deliberately left visible to preserve the intentional CTA-in-context duplication called out in PATTERNS Pattern 5 — REVIEW.md explicitly says "No code change required for v1 ship if the team explicitly accepts the redundancy," so the duplicate-CTA half of WR-03 (part a) is intentionally not addressed. PrinterSettings's "+ Add Printer" is also untouched for the same reason. The Import CSV button is unchanged (independent of asset count).

Verification:
- `npx tsc -b` exit 0
- `npm test -- --run` exit 0 (13 tests passing)
- `npm run lint:no-raw-html` passed

## Skipped Issues

None — all three in-scope Warning findings (WR-01, WR-02, WR-03) were applied successfully.

## Info findings

All five Info findings (IN-01 through IN-05) were not in scope per user selection. They remain in REVIEW.md for future consideration.

---

_Fixed (iteration 1): 2026-05-19T20:40:00Z_
_Updated (iteration 2): 2026-05-19T20:46:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
