---
phase: 03-calculator-ui-import
plan: 03
subsystem: ui
tags: [react, typescript, multi-material, cost-calculation, session-storage]

# Dependency graph
requires:
  - phase: 03-01
    provides: "GcodeImport emitting filaments[] array via onImport callback"
  - phase: 03-02
    provides: "FilamentRow[] state with dynamic add/remove UI; TEMPORARY shims for compilation"
provides:
  - "Multi-filament cost calculation: sum of (grams * pricePerGram) across all FilamentRow[]"
  - "Per-material nozzle wear using getMaterialDensity per row"
  - "handleSaveJob writing filaments: FilamentUsage[] with pricePerGram and currency"
  - "onImport handler mapping GcodeImport filaments[] to FilamentRow[] form state"
  - "Session storage persisting and restoring FilamentRow[]; old scalar format falls back to single default row"
affects: [CostCalculator, GcodeImport, types]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-row cost reduction: filamentRows.reduce((sum, row) => sum + row.grams * row.editedPrice, 0)"
    - "Per-material density: getMaterialDensity(asset?.filamentType ?? null) per row in volume reduction"
    - "Session storage backward compat: check Array.isArray(parsed.filamentRows) before using; old format falls through to default"
    - "Import wiring: filaments.map(f => ({ filamentId: f.filamentId ?? '', grams: f.grams, editedPrice: asset?.costPerUnit ?? 0 }))"

key-files:
  created: []
  modified:
    - src/components/CostCalculator.tsx

key-decisions:
  - "FILAMENT_DENSITY constant removed — getMaterialDensity called per row for correct per-material volume"
  - "handleSaveJob now writes filaments: FilamentUsage[] — old filamentId/filamentGrams fields fully removed"
  - "Session storage backward compat: old scalar format silently falls back to single default row (no error thrown)"
  - "UI polish: inline +/x buttons with matched heights committed as fix(03-03) after human verification"

requirements-completed: [COST-01, COST-02, COST-03, PERSIST-01, PERSIST-02]

# Metrics
duration: 30min
completed: 2026-04-15
---

# Phase 03 Plan 03: Multi-Filament Cost Calculation, Save/Restore, and Session Persistence Summary

**Multi-filament cost calculation wired end-to-end: summed filamentRows cost, per-material density for nozzle wear, FilamentUsage[] save/restore, GcodeImport handler, and backward-compatible session storage fallback**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-04-15
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments

- Removed the `FILAMENT_DENSITY = 1.24` hardcoded constant; replaced with `getMaterialDensity(asset?.filamentType ?? null)` called per row
- Removed TEMPORARY scalar shims (`filamentId`, `filamentGrams`, `editedFilamentPrice`, `editedFilamentCurrency`) added in Plan 02
- Updated `costs` useMemo to sum `filamentRows.reduce(...)` for both filament cost and total volume, with dependency array reduced to `[filamentRows]`
- Updated `handleSaveJob` validation to check `filamentRows.every(r => !r.filamentId)` instead of scalar check
- Updated `handleSaveJob` job creation to write `filaments: FilamentUsage[]` mapping from FilamentRow[] with `pricePerGram` and `currency`
- Wired `onImport` handler to map `GcodeImport` filaments array to `FilamentRow[]`, looking up asset price from materials library
- Added backward-compatible session storage initializer with explicit `Array.isArray(parsed.filamentRows)` check; old scalar format falls back to `[makeDefaultRow(userCurrency)]` without error
- Post-verification UI polish: inline `+`/`×` buttons, matched row heights, fixed-width columns for better multi-row readability
- Full production build (`tsc -b && vite build`) passes with zero errors

## Task Commits

Each task committed atomically:

1. **Task 1: Multi-filament cost calculation and import wiring** — `4c458f8` (feat)
2. **Task 2: Session storage migration with backward-compatible fallback** — `2aef24a` (feat)
3. **Task 3: Post-verification UI polish** — `1ffbed8` (fix)

## Files Created/Modified

- `src/components/CostCalculator.tsx` — Multi-filament cost calc, save/restore, import wiring, session persistence, UI polish

## Decisions Made

- `FILAMENT_DENSITY` constant removed — per-material density was a pre-existing correctness bug; fixing it here avoids carrying the bug into production
- `handleSaveJob` writes `filaments: FilamentUsage[]` — the old `filamentId`/`filamentGrams` fields are fully gone, completing the clean migration started in Phase 01
- Session storage backward compat uses explicit `Array.isArray` check — ensures old sessions don't silently produce an empty rows array
- UI polish committed separately after human verification — does not affect business logic, isolated to presentation layer

## Deviations from Plan

None - plan executed exactly as written. The post-verification UI polish commit (`1ffbed8`) was user-initiated after the checkpoint and does not represent a plan deviation.

## Issues Encountered

None — TypeScript compilation and production build passed with zero errors on first attempt.

## User Setup Required

None.

## Phase 03 Completion

This is the final plan of Phase 03 (Calculator UI + Import). The complete multi-material flow is now wired end-to-end:

- **Plan 01**: GcodeImport emits `filaments[]` array
- **Plan 02**: CostCalculator has `FilamentRow[]` state with dynamic add/remove UI
- **Plan 03**: Cost calculation, save/restore, import wiring, and session persistence all use `FilamentRow[]`

The feature is fully functional and deployed via Vercel on push to main.

---
*Phase: 03-calculator-ui-import*
*Completed: 2026-04-15*
