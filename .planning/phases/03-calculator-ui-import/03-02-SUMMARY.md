---
phase: 03-calculator-ui-import
plan: 02
subsystem: calculator-ui
tags: [state-refactor, multi-filament, ui]
dependency_graph:
  requires: [03-01]
  provides: [FilamentRow-state, dynamic-filament-rows]
  affects: [src/components/CostCalculator.tsx]
tech_stack:
  added: []
  patterns: [array-state-replace-scalars, helper-functions, temporary-shims]
key_files:
  created: []
  modified:
    - src/components/CostCalculator.tsx
    - src/components/JobsManager.tsx
decisions:
  - "TEMPORARY shims (filamentId/filamentGrams/editedFilamentPrice/editedFilamentCurrency) extract row[0] values to keep cost calc and save logic compiling until Plan 03 refactors them"
  - "makeDefaultRow is a function not a constant — captures userCurrency at call time per Pitfall 6 from research"
  - "FilamentRow interface is internal-only (not exported) — distinct from DB FilamentUsage type"
metrics:
  duration: 25min
  completed: "2026-04-15"
  tasks: 2
  files: 2
---

# Phase 03 Plan 02: FilamentRow State Refactor Summary

**One-liner:** Replaced four scalar filament state variables with a `FilamentRow[]` array and rendered dynamic add/remove row UI in CostCalculator.tsx.

## What Was Built

### Task 1: Replace scalar filament state with FilamentRow[] array

- Defined `FilamentRow` interface inside `CostCalculator.tsx` (internal form state, NOT the DB `FilamentUsage` type)
- Added `makeDefaultRow(currency)` function (not a constant — captures `userCurrency` at call time)
- Replaced `filamentGrams`, `filamentId`, `editedFilamentPrice`, `editedFilamentCurrency` useState calls with `filamentRows` state
- Added `addFilamentRow`, `removeFilamentRow`, `updateFilamentRow` helpers
- Updated `clearForm` to reset to `[makeDefaultRow(userCurrency)]`
- Updated `editingJob` restore effect to map `FilamentUsage[]` to `FilamentRow[]`
- Updated session storage persistence to use `filamentRows` instead of four scalars
- Added TEMPORARY shims (`const filamentId = filamentRows[0]?.filamentId ?? ''` etc.) so cost calc and save logic continue to compile
- Updated `handleSaveJob` to write `filaments: [...]` to `PrintJob` (shim approach — Plan 03 maps all rows)
- Updated `GcodeImport` onImport handler for new multi-filament callback signature

### Task 2: Render dynamic filament rows with add/remove controls

- Replaced single `FilamentSelector` + grams input with `filamentRows.map()` dynamic list
- Entire filament section spans `lg:col-span-3` for full-width rows
- Each row has its own `FilamentSelector` with independent `editedPrice`/`editedCurrency`
- `+ Add Filament` button with `type="button"`, disabled at 16 rows
- Remove button (X icon) on rows where `index > 0`, with `type="button"` and `aria-label`
- Grams input inline per row (`w-24` compact)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing JobsManager.tsx scalar field references**
- **Found during:** Task 1 (tsc -b verification)
- **Issue:** `JobsManager.tsx` line 217 referenced `job.filamentId` and `job.filamentGrams` which no longer exist on `PrintJob` (removed in Phase 01). This was a pre-existing error.
- **Fix:** Updated to `job.filaments?.[0]?.filamentId ?? ''` and `job.filaments?.[0]?.grams ?? 0`
- **Files modified:** `src/components/JobsManager.tsx`
- **Commit:** `678e082`

**2. [Rule 1 - Bug] Fixed GcodeImport onImport handler signature**
- **Found during:** Task 1 (tsc -b verification)
- **Issue:** `GcodeImport` was already updated in Phase 02 to emit `{ filaments[], printTimeHours, printName }` but the caller in `CostCalculator.tsx` still destructured the old `{ filamentGrams, filamentId, ... }` shape.
- **Fix:** Updated the `onImport` callback to destructure `filaments[]` and use `filaments[0]` for the shim approach
- **Files modified:** `src/components/CostCalculator.tsx`
- **Commit:** `678e082`

**3. [Rule 1 - Bug] Updated handleSaveJob to use filaments[] field**
- **Found during:** Task 1 (tsc -b verification)
- **Issue:** `handleSaveJob` wrote `filamentId` and `filamentGrams` directly onto `PrintJob` which no longer has those fields (Phase 01 removed them)
- **Fix:** Updated to write `filaments: [{ filamentId, grams: filamentGrams, pricePerGram: editedFilamentPrice, currency: editedFilamentCurrency }]` using shim values (Plan 03 maps all rows)
- **Files modified:** `src/components/CostCalculator.tsx`
- **Commit:** `678e082`

## Success Criteria Verification

- [x] FilamentRow[] state replaces four scalar state variables
- [x] Dynamic filament rows render with add/remove controls
- [x] First row has no remove button; subsequent rows do
- [x] "+" button disabled at 16 rows
- [x] Each row has independent FilamentSelector with price/currency
- [x] tsc -b passes (zero errors)

## Self-Check: PASSED

- `src/components/CostCalculator.tsx` exists and modified
- `src/components/JobsManager.tsx` exists and modified
- Commit `678e082` exists
