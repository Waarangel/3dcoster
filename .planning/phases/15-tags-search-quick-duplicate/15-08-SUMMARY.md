---
phase: 15-tags-search-quick-duplicate
plan: "08"
subsystem: jobs-manager
tags: [jobs-manager, overflow-menu-removal, quick-duplicate-withdrawn, scope-refinement, gap-closure, gap-D]
dependency_graph:
  requires: []
  provides:
    - JobsManager without [⋯] overflow trigger or Duplicate menu
    - features.ts with quick-duplicate entry removed (10 entries)
  affects:
    - src/components/JobsManager.tsx
    - src/features.ts
tech_stack:
  added: []
  patterns:
    - Surgical prop-chain removal across JobCardProps / JobRowProps / JobCard fn / JobRow fn / non-virtualized fallback
key_files:
  modified:
    - src/components/JobsManager.tsx
    - src/features.ts
  created: []
decisions:
  - "Kept `relative` class on the JobCard action-row wrapper (flex gap-2 flex-wrap relative) — it is harmless and Gap B (Plan 15-10) may use it for an unrelated overlay. Minimizes Gap D diff blast radius."
  - "Did NOT add an inline-panel Duplicate button as a v1.2 consumer of duplicateJob — VERIFICATION.md Gap B Recommended fix surface does not call for one. The helper is left dormant for v1.3+."
  - "The `aria-label=More actions` at line 178 (QuoteRow overflow, Phase 16 ext2 D-29) is PRESERVED — it is a legitimate pre-existing [⋯] for the 3-action Pending Quote row, not the single-item JobCard duplicate trigger."
  - "DUP-01 is now visibly Withdrawn-from-v1.2; DUP-02 (duplicateJob helper + 7-case Vitest contract) ships standalone for v1.3+ consumption."
metrics:
  duration: "~15 minutes"
  completed: "2026-05-24"
  tasks_completed: 1
  files_changed: 2
---

# Phase 15 Plan 08: Gap D — Remove Quick Duplicate UI Summary

**One-liner:** Surgical removal of the `[⋯]` overflow-menu trigger, Duplicate menu item, post-duplicate highlight ring, and `quick-duplicate` features.ts entry from JobsManager — DUP-01 withdrawn from v1.2; DUP-02 helper locked for v1.3+ consumption.

---

## What Was Built

Gap D gap-closure plan executed. The `[⋯]` overflow-menu UI surface added in Phase 15 Plan 05 has been completely removed from JobsManager. The `duplicateJob` pure helper at `src/utils/duplicateJob.ts` and its 7-case Vitest contract at `src/utils/duplicateJob.test.ts` are byte-identical to their pre-plan state.

### Removal sites (all in `src/components/JobsManager.tsx`):

1. **Import** — `import { duplicateJob, nextCopyName } from '../utils/duplicateJob'` removed (line 16). No consumer remains in this file.

2. **JobCardProps** — Four fields removed: `onDuplicate`, `isHighlighted`, `overflowOpen`, `onToggleOverflow` (with JSDoc comments).

3. **JobCard function destructure** — Same four props removed from the function parameter list.

4. **JobCard root className** — `${isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' : ''}` segment removed from the template literal.

5. **JobCard action row JSX** — Entire `<div className="relative">` block removed: the `[⋯]` `<button aria-label="More actions">`, the `<NewBadge feature="quick-duplicate" />`, and the conditional `{overflowOpen && <div role="menu">...</div>}` dropdown.

6. **JobRowProps** — Four fields removed: `overflowOpenJobId`, `onToggleOverflow`, `onDuplicate`, `highlightedJobId` (plus the comment line).

7. **JobRow function destructure** — Same four props removed from the destructure list.

8. **JobRow `<JobCard>` forwarding** — Four JSX props removed: `onDuplicate`, `isHighlighted`, `overflowOpen`, `onToggleOverflow`.

9. **Parent state** — Two `useState` declarations removed: `overflowOpenJobId` and `highlightedJobId`, with their JSDoc comments.

10. **Click-outside useEffect** — The `useEffect` block that attached a `window.addEventListener('click', handler)` conditional on `overflowOpenJobId` was removed.

11. **`handleDuplicate` useCallback** — Removed (including the long multi-line comment block above it).

12. **`handleToggleOverflow` useCallback** — Removed.

13. **`handleStartEditTags`** — The `setOverflowOpenJobId(null)` call inside this callback was removed (the callback itself is kept; it still sets `editingTagsJobId`). Comment updated to remove the overflow-menu mention.

14. **rowProps useMemo** — Four fields removed: `overflowOpenJobId`, `onToggleOverflow`, `onDuplicate`, `highlightedJobId`. Four tokens removed from the dependency array. Comment updated.

15. **Non-virtualized JobCard fallback** — Four JSX props removed from `{searchedJobs.map(...)}`: `onDuplicate`, `isHighlighted`, `overflowOpen`, `onToggleOverflow`.

### Removal in `src/features.ts`:

- Line `'quick-duplicate': new Date('2026-05-24'),` removed.
- `tags: new Date('2026-05-24')` and `search-jobs: new Date('2026-05-24')` preserved byte-identically.
- Entry count: 11 → 10.

---

## Files Modified

| File | Change | Line delta |
|------|--------|-----------|
| `src/components/JobsManager.tsx` | Removed overflow UI, handlers, state, props, types, imports | -128 lines |
| `src/features.ts` | Removed quick-duplicate entry | -1 line |

---

## LOCKED File Integrity

| File | Status |
|------|--------|
| `src/utils/duplicateJob.ts` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/utils/duplicateJob.test.ts` | BYTE-IDENTICAL — `git diff` output: empty |

Confirmed by: `git diff src/utils/duplicateJob.ts src/utils/duplicateJob.test.ts` → no output.

---

## Vitest Results

**Test run after Gap D changes:**

- Test Files: 2 failed | 16 passed (18) — **identical to pre-plan baseline**
- Tests: 222 passed | 1 todo (223) — **identical to pre-plan baseline**

The 2 failing test files (`JobsManager.test.tsx` and `generateQuotePdf.test.ts`) fail due to missing npm packages (`react-window`, `jspdf`) in the worktree environment — a pre-existing environment issue confirmed by running tests against the pre-plan commit (stash+test+pop). Our changes have zero effect on the test count.

**DUP-02 D-15 Vitest contract — all 7 cases PASS:**

- `duplicateJob (DUP-02 D-15 locked contract) > resets PII, tax, copiesSold, id; preserves tags (TAGS-F3)` ✓
- `duplicateJob — by-value isolation (D-09) > filaments are deep-copied` ✓
- `duplicateJob — by-value isolation (D-09) > materialsUsed are deep-copied` ✓
- `duplicateJob — by-value isolation (D-09) > quoteNumber resets to undefined` ✓
- `nextCopyName (D-08 collision helper) > returns "{base} (copy)" when no collision` ✓
- `nextCopyName (D-08 collision helper) > returns "{base} (copy 2)" when "(copy)" already exists` ✓
- `nextCopyName (D-08 collision helper) > caps at 99 when all 1-99 are taken` ✓

The D-15 locked assertion `expect(dup.customer).toBeUndefined()` remains in `src/utils/duplicateJob.test.ts` (1 occurrence confirmed by grep).

---

## TypeScript Results

`npx tsc -b` produces only pre-existing "Cannot find module" errors for `react-window`, `jspdf`, `jspdf-autotable`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, and `rollup-plugin-visualizer` — all missing npm packages in the worktree environment. Zero errors attributable to our changes. The JobsManager.tsx props are correctly typed after all four removal steps (JobCardProps, JobCard fn, JobRowProps, JobRow fn).

---

## Decisions Made

1. **Kept `relative` on the action-row wrapper** — `<div className="flex gap-2 flex-wrap relative">` retained as-is. The `relative` was added in Plan 15-05 to anchor the `absolute right-0 top-full` dropdown. Post-Gap-D no absolute-positioned dropdown is anchored there, but the class is harmless and Gap B (Plan 15-10) may reuse it for a hover tag icon overlay. Keeping it minimizes diff blast radius.

2. **Did NOT add an inline-panel Duplicate button** — VERIFICATION.md Gap B "Recommended fix surface" does not call for a Duplicate button inside the title-click inline panel. No v1.2 consumer is created. The `duplicateJob` helper is left dormant for v1.3+ (job-detail panel, batch-action menu, command palette — wherever clone-and-tweak fits).

3. **QuoteRow `aria-label="More actions"` preserved** — The `aria-label="More actions"` at line 178 belongs to the QuoteRow component's `[⋯]` overflow for Pending Quote rows (Phase 16 ext2 D-29 pattern, which hosts 3 actions: Convert to Sale, Edit Quote, Decline). This is correct and must be kept — it is a different surface from the single-item JobCard Duplicate trigger.

4. **DUP-01 visibly withdrawn** — No row-action UI for Quick Duplicate exists anywhere in the codebase. DUP-01 requirement is withdrawn from v1.2.

5. **DUP-02 ships standalone** — `src/utils/duplicateJob.ts` + `src/utils/duplicateJob.test.ts` are untouched. The 7-case Vitest contract continues to pass. The helper is ready for a v1.3+ surface to consume.

---

## Deviations from Plan

None. Plan executed exactly as written. All 13 steps from the action spec were applied in sequence. The only judgment call was confirming that the QuoteRow `aria-label="More actions"` is a legitimate pre-existing element to preserve (plan said to audit for the JobCard overflow trigger specifically).

---

## Known Stubs

None. All removed surfaces were UI-only; no data stubs introduced.

---

## Threat Flags

None. This plan only removes UI surface — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

---

## Self-Check

Verifying claims made in this summary:

- `src/components/JobsManager.tsx` exists and was modified: confirmed (git diff shows 2 files changed)
- `src/features.ts` exists and was modified: confirmed
- Commit `0f4c8d3` exists: confirmed (`git rev-parse --short HEAD` = `0f4c8d3`)
- LOCKED files byte-identical: confirmed (`git diff` = empty for both)
- All 9 banned strings at 0 occurrences: confirmed by grep audit
- features.ts has 10 entries: confirmed by `grep -c "new Date"` = 10
- tags + search-jobs entries preserved: confirmed (grep -c = 1 each)

## Self-Check: PASSED
