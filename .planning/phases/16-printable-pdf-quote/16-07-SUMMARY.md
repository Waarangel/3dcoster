---
phase: 16-printable-pdf-quote
plan: "07"
subsystem: JobsManager UI
tags: [rename, button-variant, affordance, gap-closure, D-14, gap-B]
dependency_graph:
  requires: [16-04]
  provides: [Print Quote button rename, secondary variant, price-gate disable]
  affects: [src/components/JobsManager.tsx]
tech_stack:
  added: []
  patterns: [Button variant=secondary btnSize=sm, NewBadge absolute overlay]
key_files:
  modified:
    - src/components/JobsManager.tsx
decisions:
  - "D-14: Rename Generate PDF → Print Quote and switch to secondary Button variant (affordance parity with Edit/Delete)"
  - "Disabled condition extended to include job.sellingPrice <= 0 per plan spec — title tooltip 'Set a selling price first' wired"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-23T17:30:00Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 16 Plan 07: Rename Generate PDF → Print Quote Summary

**One-liner:** JobsManager accordion's Generate PDF button renamed to Print Quote with secondary Button variant, price-gate disabled state, and tooltip — behavior handler unchanged (deferred to 16-10).

## What Was Built

Plan 16-07 is a pure rename + styling change. The JobsManager accordion's action row button was updated in `src/components/JobsManager.tsx`:

1. **Label**: `'Generate PDF'` → `'Print Quote'` (the `isGeneratingPdf` fallback `'Generating...'` retained as-is).
2. **Variant**: Was already `variant="secondary"` — confirmed correct, no change needed.
3. **Disabled condition**: Extended from `isGeneratingPdf` to `isGeneratingPdf || job.sellingPrice <= 0` — aligns with D-14's requirement that the button is gated by a valid selling price.
4. **Tooltip**: `title={job.sellingPrice <= 0 ? 'Set a selling price first' : undefined}` added — surfaces the gate reason to the user on hover.
5. **NewBadge**: Preserved at `className="absolute -top-1 -right-1"` inside the `<div className="relative">` wrapper — CLAUDE.md overlay rule honored.
6. **Handler**: `onGeneratePdf(job)` → `handleGeneratePdf` unchanged. Behavior swap to `PrintQuoteModal` is deferred to Plan 16-10.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rename Generate PDF → Print Quote and switch to secondary Button variant | e065fba | src/components/JobsManager.tsx |

## Verification Results

All acceptance criteria from the plan satisfied:

| Check | Result |
|-------|--------|
| `grep -c "Print Quote" JobsManager.tsx` >= 1 | PASS (count: 1) |
| `! grep -q "Generate PDF" JobsManager.tsx` | PASS (0 occurrences) |
| `variant="secondary"` on Print Quote button | PASS (confirmed) |
| `NewBadge feature="pdf-quote"` count = 1 | PASS |
| `className="absolute -top-1 -right-1"` present | PASS |
| `"Set a selling price first"` count = 1 | PASS |
| `npx tsc -b` | PASS (exit 0) |
| `npx vitest run` | PASS (181/181 tests) |
| `node scripts/lint-no-raw-html.mjs` | PASS |

## Deviations from Plan

None - plan executed exactly as written.

**Note**: The plan's task description mentioned confirming the variant was already `"secondary"` or changing it from `"ghost"`. Reading the file confirmed it was already `variant="secondary"`. The variant prop needed no change — only the label, disabled condition, and tooltip were modified.

## Known Stubs

None. The click handler still calls the existing `handleGeneratePdf` (silent most-recent-sale fallback). This is intentional — Plan 16-10 will replace the handler with the `PrintQuoteModal` opener (D-18). The button label is correct (`Print Quote`); only the behavior is deferred.

## Threat Flags

None. No new trust boundaries or security-relevant surfaces introduced. This is a label and styling change only.

## Self-Check: PASSED

- `src/components/JobsManager.tsx` — confirmed modified and committed
- Commit `e065fba` — confirmed present in git log
- All grep acceptance criteria verified before commit
- tsc -b exit 0, vitest run 181/181 passing
