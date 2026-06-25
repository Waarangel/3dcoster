---
phase: 34-live-papercut-fixes
plan: "02"
subsystem: calculator-ui
tags: [fix, modal, a11y, ux, scroll, reduced-motion]
dependency_graph:
  requires: []
  provides: [ResetAssetsModal, edit-job-scroll-to-banner]
  affects: [AssetLibrary, CostCalculator]
tech_stack:
  added: []
  patterns: [Modal-driven confirm flow, useRef+useEffect scroll, matchMedia reduced-motion gate]
key_files:
  created:
    - src/components/ResetAssetsModal.tsx
    - src/components/ResetAssetsModal.test.tsx
  modified:
    - src/components/AssetLibrary.tsx
    - src/components/CostCalculator.tsx
    - src/components/CostCalculator.test.tsx
decisions:
  - "source-contract tests for CostCalculator scroll behavior — follows existing test pattern in that file; component is not mounted in the test suite due to heavy Dexie/prop dependencies"
  - "ResetAssetsModal uses mode='printer'|'material'|null driver (null=closed) — mirrors DeclineQuoteModal's quote|null pattern exactly"
  - "handleResetConfirm re-throws on failure so ResetAssetsModal's internal error state displays the message; resetError in AssetLibrary remains for any future surface"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-25"
  tasks_completed: 2
  files_changed: 5
---

# Phase 34 Plan 02: Calculator Papercut Fixes (FIX-03 + FIX-04) Summary

**One-liner:** Styled counts-showing confirm modal replaces window.confirm() on destructive Reset All; edit-job jump scrolls calculator to the Editing banner with reduced-motion awareness.

## What Was Built

### FIX-03 — ResetAssetsModal (window.confirm() replaced with styled modal)

Created `src/components/ResetAssetsModal.tsx` built on the shared `<Modal>` primitive (same pattern as `DeclineQuoteModal`). Props: `mode: 'printer' | 'material' | null` (null = closed), `count: number`, `onConfirm`, `onClose`.

- Shows the exact count of items about to be replaced: "This will replace your 5 custom printers with the default printer list."
- Singular/plural handled correctly (1 custom printer / N custom printers).
- Danger confirm button ("Reset printers" / "Reset materials") is the ONLY path to `onConfirm` — no auto-confirm on mount, no default/Enter-through that destroys data (satisfies threat T-34-03).
- Cancel and Escape/backdrop call `onClose` without touching data.
- Uses shared `Button` (never raw `<button>`); `lint:no-raw-html` passes.

Wired in `src/components/AssetLibrary.tsx`:
- Added `resetMode: 'printer' | 'material' | null` state.
- `handleReset` now just sets `resetMode` (no more browser confirm dialog).
- `handleResetConfirm` runs `onResetPrinters()` / `onResetMaterials()` and re-throws on error so the modal's error surface fires.
- `ResetAssetsModal` rendered at the bottom of AssetLibrary's JSX with count computed from `assets` prop (printers = `category === 'printer'`, materials = rest).
- Existing `resetError` `role="alert"` surface preserved.

### FIX-04 — Scroll to Editing banner on edit-job jump (CostCalculator)

Two surgical additions to `src/components/CostCalculator.tsx`:

1. `bannerRef = useRef<HTMLDivElement>(null)` attached to the editing-banner container div (the `bg-blue-600/20` element).
2. `useEffect` keyed on `editingJob`: when `editingJob` is truthy and `bannerRef.current` is mounted, calls `bannerRef.current.scrollIntoView({ block: 'start', behavior })` where `behavior` is `'auto'` when `window.matchMedia('(prefers-reduced-motion: reduce)').matches` (motion reduced), `'smooth'` otherwise. Null-guarded — no scroll fires when `editingJob` is null.

No changes to `App.tsx` — `handleEditJob` already sets `editingJob` and switches to the calculator tab, which is the "confirmed jump" that triggers the scroll.

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| ResetAssetsModal | 5 | PASS |
| CostCalculator (FIX-04 + existing) | 8 + 1 todo | PASS |
| Full suite (52 files) | 673 | PASS |

TDD gate compliance:
- Task 1: RED (test file fails with missing import) then GREEN (ResetAssetsModal + AssetLibrary wiring)
- Task 2: RED (3 source-contract tests fail) then GREEN (bannerRef + useEffect in CostCalculator)

## Verification

- `npm test -- ResetAssetsModal`: 5/5 pass
- `npm test -- CostCalculator`: 8/8 pass + 1 todo
- `node scripts/lint-no-raw-html.mjs`: passed
- `grep -n "window.confirm" src/components/AssetLibrary.tsx`: no output (fully removed)
- `npx tsc -b`: clean, no errors
- Full suite: 52 test files, 673 tests pass

## Deviations from Plan

None — plan executed exactly as written.

The source-contract test approach for CostCalculator is consistent with the existing established test pattern in that file (D-21 tax regression tests are also source-level). The CostCalculator component is not mounted in the test suite due to its heavy coupling to Dexie, multiple context providers, and ~30 props — consistent with how this file has been tested throughout v1.3 and v1.8.

## Known Stubs

None. Both fixes wire real behavior.

## Threat Flags

None new. The changes close threat T-34-03 (no auto-confirm destroy on Reset All) as planned.

## TDD Gate Compliance

- RED gate (test commits): present for both tasks
- GREEN gate (feat commits): present for both tasks
- REFACTOR: not needed — implementation was clean on first pass

## Self-Check: PASSED

- `src/components/ResetAssetsModal.tsx`: FOUND
- `src/components/ResetAssetsModal.test.tsx`: FOUND
- `src/components/AssetLibrary.tsx` (modified): FOUND, contains `ResetAssetsModal`, no `window.confirm` calls
- `src/components/CostCalculator.tsx` (modified): FOUND, contains `bannerRef`, `scrollIntoView`, `matchMedia`
- Task 1 commit `43762d9`: in git log
- Task 2 commit `9489ab3`: in git log
