---
phase: 10-cost-calculation-unit-tests
plan: 02
subsystem: testing
tags:
  - testing
  - cost-calculation
  - integration
  - refactor

# Dependency graph
requires:
  - phase: 10-01 (Pure costCalc module scaffold)
    provides: calculateCost(input: CalcInput): CostBreakdown + CalcInput interface
provides:
  - CostCalculator.tsx now consumes calculateCost via a thin useMemo wrapper
  - Stable integration seam — Plan 03's tests lock the same module the UI runs against
  - Plan 04 (coverage gate) can now block regressions for the live UI consumer
affects:
  - 10-03 (costCalc.test.ts — already runs against the same module)
  - 10-04 (build chain + coverage gate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useMemo-to-pure-module integration pattern (consumer side — first instance)

key-files:
  created: []
  modified:
    - src/components/CostCalculator.tsx

key-decisions:
  - "D-01 honored: CostCalculator imports and calls calculateCost — same UI, same behavior, math now isolated"
  - "D-04 honored: pricing pipeline (trueCost, fixedCosts, breakEvenInfo, packaging/shipping/marketplace/profit/target/selling-price) untouched below line 452"
  - "getMaterialDensity import dropped — only call site moved to costCalc.ts; tsc -b under noUnusedLocals would have failed if kept"
  - "Dependency array (16 entries) preserved verbatim — no new re-renders, no removed re-renders"

requirements-completed:
  - TEST-01

# Metrics
duration: 5min
completed: 2026-05-20
---

# Phase 10 Plan 02: CostCalculator Integration Refactor Summary

**Refactored the `useMemo((): CostBreakdown => {…})` at `CostCalculator.tsx:374` into a thin wrapper that calls `calculateCost` from `src/utils/costCalc.ts` (Plan 01) — byte-for-byte UI behavior preserved, dep array verbatim, pricing pipeline below line 452 untouched per D-04.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-20 (Wave 2)
- **Completed:** 2026-05-20
- **Tasks:** 1
- **Files created:** 0
- **Files modified:** 1

## Diff Stats

```
src/components/CostCalculator.tsx | 96 ++++++++-------------------------------
1 file changed, 20 insertions(+), 76 deletions(-)
```

**Net change:** −56 lines (within the plan's expected envelope of "~75 deleted, ~18 added"). The 1-line import swap + 1-line provenance comment + 18-line thin wrapper + dep array replace 76 lines of inline math.

## Accomplishments

- The `costs` useMemo at `CostCalculator.tsx:374` is now a thin wrapper: `useMemo((): CostBreakdown => calculateCost({...}), [...preserved deps])`
- All 16 closure variables previously read inline are now passed as `CalcInput` object literal fields
- Dependency array (lines 391–395 in the new file) is verbatim identical to the pre-refactor array — same 16 entries in the same order: `materials, filamentRows, printTimeHours, selectedPrinter, electricity, selectedInstance, materialsUsed, laborHourlyRate, prepTimeMinutes, postProcessingMinutes, failureRate, profitMarginPercent, targetProfit, sellingPrice, modelCost, modelCostPerUnit`
- `getMaterialDensity` import removed — its only call site moved to `costCalc.ts` in Plan 01; under Vercel's `tsc -b` with `noUnusedLocals` the unused import would have failed the build
- Provenance comment added: `// Cost calculation extracted to src/utils/costCalc.ts for testability (Phase 10, D-01)`
- All inline math deleted: filament reduce, electricity ternary, depreciation block (`purchasePrice`, `recoveryMonths`, `monthlyHours`, `totalRecoveryHours`, `depreciationPerHour`), nozzle wear block, `modelAmortization` const, materials reduce, labor calc, `perUnitSubtotal`, failure clamp/multiplier/adjusted, return literal
- Pricing pipeline below line 452 (UNCHANGED per D-04): `trueCost`, `fixedCosts` useMemo, `breakEvenInfo` useMemo, packaging/shipping/marketplace/profit/target/selling-price logic
- `npx tsc -b` exits 0 with zero new errors
- `npm run build` exits 0 — full chain (lint-no-raw-html → tsc -b → vite build) passes
- 12-field `CostBreakdown` consumer contract preserved (`costs.filament`, `costs.electricity`, `costs.printerDepreciation`, `costs.nozzleWear`, `costs.modelAmortization`, `costs.materials`, `costs.labor`, `costs.subtotal`, `costs.failureAdjusted`, `costs.profitMargin`, `costs.targetProfit`, `costs.sellingPrice` — every consumer keeps working)

## Task Commits

1. **Task 1: Replace inline useMemo body with calculateCost call** — `ba63cdf` (refactor)

## Files Created/Modified

- `src/components/CostCalculator.tsx` (MODIFIED, +20 / −76)
  - Line 8: `import { getMaterialDensity } from '../utils/gcodeParser';` → `import { calculateCost } from '../utils/costCalc';`
  - Lines 373–452 (old): inline math + return literal + dep array → Lines 373–395 (new): provenance comment + thin `calculateCost({...})` wrapper + verbatim dep array
  - Lines 454+: untouched (pricing pipeline preserved per D-04)

## Decisions Made

- **`getMaterialDensity` import dropped, not kept.** The Patterns doc suggested "conservative default: keep the import; ESLint will flag if truly unused" — but the project's `tsconfig.json` enables `noUnusedLocals`, and Vercel runs `tsc -b` (per user CLAUDE.md). Leaving the unused import would fail the production build immediately. The plan's action step 1 already mandated unconditional removal; this confirms the planner's reading.
- **Dep array preserved exactly.** Even though the array could theoretically be rewritten to match the alphabetical / functional order of the `CalcInput` object-literal fields, the plan explicitly requires verbatim preservation to avoid even cosmetic churn in the React-hook lint signature. No reorder, no add, no remove.
- **Object-literal field order matches `CalcInput` declaration order in `costCalc.ts`.** This makes the call site read top-to-bottom with the type definition; a reviewer cross-checking field names against the interface gets visual alignment.
- **Comment placement above the useMemo, not inside.** Inline comments inside a one-line arrow expression hurt readability; the provenance pointer goes above so the reader sees it before the call.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance criterion verified by grep + build + tsc.

## Issues Encountered

None.

## Threat Surface Changes

None. This is a pure code-organization refactor: the math moved behind a function call inside the same TypeScript build, with no new IO, no new dependency, no new user-input parsing. Same attack surface as pre-refactor. (Confirms `T-10-N/A` from the plan's threat register.)

## User Setup Required

None — pure code change, no external services, no env vars, no migrations, no version bumps. Web app behavior is byte-for-byte identical at runtime.

## Acceptance Criteria Verification

All criteria from the plan, verified:

| Criterion | Expected | Actual |
|-----------|----------|--------|
| `grep -c "import { calculateCost } from '../utils/costCalc'" src/components/CostCalculator.tsx` | 1 | 1 |
| `grep -c "import { getMaterialDensity }" src/components/CostCalculator.tsx` | 0 | 0 |
| `grep -c "calculateCost(" src/components/CostCalculator.tsx` | ≥1 | 1 |
| `grep -c "clampedFailureRate" src/components/CostCalculator.tsx` | 0 | 0 |
| `grep -c "totalRecoveryHours" src/components/CostCalculator.tsx` | 0 | 0 |
| `grep -c "depreciationPerHour" src/components/CostCalculator.tsx` | 0 | 0 |
| Dep array has 16 entries (materials, filamentRows, printTimeHours, selectedPrinter, electricity, selectedInstance, materialsUsed, laborHourlyRate, prepTimeMinutes, postProcessingMinutes, failureRate, profitMarginPercent, targetProfit, sellingPrice, modelCost, modelCostPerUnit) | yes | yes |
| `npx tsc -b` exit code | 0 | 0 |
| `npm run build` exit code | 0 | 0 |
| `grep -c "const trueCost = " src/components/CostCalculator.tsx` | 1 | 1 |
| `grep -c "const fixedCosts = useMemo" src/components/CostCalculator.tsx` | 1 | 1 |

## Next Phase Readiness

**Ready for sequencing:**
- **Plan 03 (costCalc.test.ts):** Already runs in parallel against the same `calculateCost` module — this plan does not change anything Plan 03 depends on, but now the UI consumer is locked into the same code path the tests cover.
- **Plan 04 (build chain + coverage gate):** Can wire `vitest run --coverage` into `npm run build` knowing that a regression in `costCalc.ts` would now break both the test suite AND the visible UI cost output — the gate is now actually load-bearing.

**Blockers/concerns:**
- None. Build is green. UI behavior is byte-for-byte identical (the math runs through `calculateCost`, which is itself a byte-for-byte port of the same inline block per Plan 01's Self-Check).

## Self-Check

- File `src/components/CostCalculator.tsx` modified: **FOUND** (`git diff --stat` shows +20/-76)
- Commit `ba63cdf` (Task 1) exists in `git log`: **FOUND**
- `npx tsc -b` exit 0: **PASS** (`/tmp/plan10-02-tsc.log` has 0 error TS lines)
- `npm run build` exit 0: **PASS** (PWA generated, vite reported "built in 1.27s")
- Import `calculateCost` from `'../utils/costCalc'` present: **PASS** (grep count 1)
- Import `getMaterialDensity` removed: **PASS** (grep count 0)
- Inline math fragments removed (`clampedFailureRate`, `totalRecoveryHours`, `depreciationPerHour`): **PASS** (all grep counts 0)
- Dep array preserved (16 entries, original order): **PASS** (verified via `grep -A 6 "calculateCost({" ...` + manual sed inspection)
- Pricing pipeline untouched (`trueCost`, `fixedCosts`): **PASS** (grep counts 1, 1)
- 12-field `CostBreakdown` contract intact: **PASS** (`calculateCost` from Plan 01 returns the same 12 fields; no consumer code changed)

## Self-Check: PASSED

---
*Phase: 10-cost-calculation-unit-tests*
*Completed: 2026-05-20*
