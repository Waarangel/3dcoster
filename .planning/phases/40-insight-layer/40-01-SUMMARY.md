---
phase: 40-insight-layer
plan: 01
subsystem: analytics
tags: [pure-derivation, cost-calc-reuse, product-ranking, printer-payback, what-if-simulator, phase-33-absorption]

# Dependency graph
requires:
  - phase: 39-cost-realism
    provides: deriveMaintenanceAmortization (src/db/maintenanceAmortization.ts), dominantMaterialId (src/db/failureRate.ts), FailureEvent/MaintenanceEvent stores
  - phase: 38-foundation
    provides: costCalc.ts CalcInput/calculateCost contract, salesReportAggregates.ts net-of-fees pattern
provides:
  - src/utils/insights.ts — normalizeProductKey, computeProductRanking, computeWageHeadline, computePrinterPayback, buildCalcInputFromJob, computeScenario (all pure, unit-tested)
  - src/utils/salesReportAggregates.ts — computePerSaleProfit (single home for net-of-fees per-sale profit)
  - src/utils/printHourProfit.ts, pricingCoach.ts, costAllocation.ts — ported Phase 33 pure utils + tests
affects: [40-02, 40-03, 40-04, 40-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure derivation module with zero React/Dexie imports — every money number routes through computePerSaleProfit (historical) or calculateCost (scenario), never a forked formula"
    - "Reuse a grading function's tone/value output by passing already-netted numbers as its raw inputs (computePrintHourProfit reused for product-ranking grade via sellingPrice=totalProfit, cost=0)"
    - "Named, commented time windows for projection math instead of black-box smoothing (90-day trailing pace, explicit fallback to all-time average)"

key-files:
  created:
    - src/utils/insights.ts
    - src/utils/insights.test.ts
    - src/utils/printHourProfit.ts
    - src/utils/printHourProfit.test.ts
    - src/utils/pricingCoach.ts
    - src/utils/pricingCoach.test.ts
    - src/utils/costAllocation.ts
    - src/utils/costAllocation.test.ts
  modified:
    - src/utils/salesReportAggregates.ts

key-decisions:
  - "computePrinterPayback's Unassigned bucket never carries a purchase-price/payoff concept (paidOff always false, missingPurchasePrice always false) — it exists purely so sale totals from unlinked jobs stay visible rather than silently dropped (D-08)"
  - "buildCalcInputFromJob reconstructs a scenario using the CURRENT live electricity/materials/laborHourlyRate config (via caller-supplied deps), not a historical replay — only fields PrintJob itself snapshots (touStartTime, maintenanceCostAtSave) come from the job. Labor rate is not a PrintJob field, so it must come from the caller's live Settings, same as electricity."
  - "Standalone failure-event scrap cost (ASSUMPTION A-40-1, flagged in code comment) uses the failure's OWN recorded FailureEvent.materialId × gramsWasted rather than a job-derived dominant material, since FailureEvent already carries its own required materialId field — there is no ambiguity to resolve with a job-scoped dominant-material lookup for a standalone (jobId-less) failure."
  - "computeScenario represents 'will never break even' as null rather than Infinity, keeping WhatIfScenarioResult's contract to 'finite numbers or null' throughout (no Infinity ever escapes to a caller)"

patterns-established:
  - "Insight Layer money math has exactly two homes: computePerSaleProfit (historical sale profit) and calculateCost (scenario/live cost) — 40-02..40-05 must never add a third"

requirements-completed: [INS-01, INS-02, INS-03]

coverage:
  - id: D1
    description: "Ported Phase 33 pure utils (printHourProfit, pricingCoach, costAllocation) verbatim with their test suites — foundation math for the Insight Layer, no UI wiring"
    requirement: INS-01
    verification:
      - kind: unit
        ref: "src/utils/printHourProfit.test.ts, src/utils/pricingCoach.test.ts, src/utils/costAllocation.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "computePerSaleProfit added to salesReportAggregates.ts as the single net-of-fees per-sale profit home, reused by every insight derivation"
    requirement: INS-01
    verification:
      - kind: unit
        ref: "src/utils/salesReportAggregates.test.ts (unchanged, still passes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeProductRanking groups sold jobs by normalized title and ranks by net profit-per-printer-hour, separating unsold products (D-01/D-02)"
    requirement: INS-01
    verification:
      - kind: unit
        ref: "src/utils/insights.test.ts#computeProductRanking"
        status: pass
    human_judgment: false
  - id: D4
    description: "computeWageHeadline computes effective hourly wage with labor hours summed once per unique sold job (never × quantity) plus optional target gap (D-03, P-05)"
    requirement: INS-01
    verification:
      - kind: unit
        ref: "src/utils/insights.test.ts#computeWageHeadline"
        status: pass
    human_judgment: false
  - id: D5
    description: "computePrinterPayback computes cumulative NET profit (sale profit minus maintenance minus failure scrap) against purchase price, with missing-price flag, Unassigned bucket, and actual/projected break-even dates (D-05/D-06/D-07/D-08)"
    requirement: INS-02
    verification:
      - kind: unit
        ref: "src/utils/insights.test.ts#computePrinterPayback"
        status: pass
    human_judgment: false
  - id: D6
    description: "buildCalcInputFromJob + computeScenario recompute margin/profit/break-even for a saved job with the INS-03 slider trio applied, routing exclusively through calculateCost (D-10/D-11)"
    requirement: INS-03
    verification:
      - kind: unit
        ref: "src/utils/insights.test.ts#computeScenario"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-07-08
status: complete
---

# Phase 40 Plan 01: Insight Layer Foundation Summary

**Pure derivation module (src/utils/insights.ts) for product ranking, hourly wage, printer payback, and what-if scenarios — every money number routes through exactly two shared functions (computePerSaleProfit, calculateCost), never a forked formula**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-08T20:05:35Z
- **Completed:** 2026-07-08T20:18:50Z
- **Tasks:** 3 completed
- **Files modified:** 9 (6 created for Task 1, 3 created + 1 modified for Tasks 2-3)

## Accomplishments

- Ported the three Phase 33 pure utils (`printHourProfit.ts`, `pricingCoach.ts`, `costAllocation.ts` + their test suites) verbatim from `feat/insight-pricing-coach`, absorbing that branch's tested foundation math without any of its calculator-UI wiring (D-13)
- Added `computePerSaleProfit` to `salesReportAggregates.ts` — the single, additive home for net-of-fees per-sale profit, factored out of `computeSalesReport`'s existing accumulation without altering its behavior
- Built `computeProductRanking` (D-01/D-02/D-14): exact normalized-title grouping, sold-only ranking by profit-per-printer-hour, unsold products kept in a separate list, benchmark grade reused from `computePrintHourProfit`
- Built `computeWageHeadline` (D-03): aggregate effective hourly wage with labor hours summed once per unique sold job (Pitfall P-05 guard against multiplying by sale quantity), plus optional target-wage gap
- Built `computePrinterPayback` (D-05/D-06/D-07/D-08): cumulative NET profit against resolved purchase price, subtracting logged maintenance amortization and failure scrap cost, with a missing-price flag, an honest `Unassigned` bucket for unlinked sales, and actual/projected break-even dates from a named 90-day trailing pace window
- Built `buildCalcInputFromJob` + `computeScenario` (D-10/D-11): reconstructs a `CalcInput` from a saved job and recomputes margin/profit/break-even under the exactly-three INS-03 overrides (filament price, electricity rate, failure rate), exclusively via `calculateCost` — verified reconstruction fidelity at zero overrides and directional correctness for every slider

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the three Phase 33 pure utils + their tests** - `3ca6c37` (feat)
2. **Task 2: Add shared per-sale profit helper + insights.ts ranking, wage & payback derivations** - `61a837d` (feat)
3. **Task 3: Add what-if scenario math (buildCalcInputFromJob + computeScenario)** - `e11b135` (feat)

_All three tasks were single-commit (no TDD RED/GREEN split needed beyond the task-level test-then-verify loop already captured in each commit)._

## Files Created/Modified

- `src/utils/printHourProfit.ts` / `.test.ts` - Ported profit-per-print-hour metric + $1–5/hr benchmark grading
- `src/utils/pricingCoach.ts` / `.test.ts` - Ported margin-band pricing coach (utils-only; UI deferred to Phase 45)
- `src/utils/costAllocation.ts` / `.test.ts` - Ported cost-breakdown %-segment builder (utils-only; UI deferred to Phase 45)
- `src/utils/salesReportAggregates.ts` - Added `computePerSaleProfit` (additive; `computeSalesReport` untouched)
- `src/utils/insights.ts` - New: `normalizeProductKey`, `computeProductRanking`, `computeWageHeadline`, `computePrinterPayback`, `buildCalcInputFromJob`, `computeScenario` + all result types
- `src/utils/insights.test.ts` - 33 tests covering every behavior bullet, edge cases, and empty-data paths

## Decisions Made

- **Unassigned bucket has no payoff concept.** `computePrinterPayback`'s `'unassigned'` entry always reports `paidOff: false`, `missingPurchasePrice: false`, and no break-even dates — it exists solely so sale totals from jobs without a printer assignment stay visible in the totals, never to imply a phantom printer that could be "paid off."
- **Scenario reconstruction uses live config, not historical replay.** `buildCalcInputFromJob` pulls electricity/materials/labor-rate from the caller's current Settings (via `deps`), because only `touStartTime` and `maintenanceCostAtSave` are actually snapshotted onto `PrintJob` — everything else reflects "what if I changed X *today*," which is the correct framing for a what-if simulator.
- **Standalone failure scrap cost uses the failure event's own `materialId`.** `FailureEvent.materialId` is a required field, so a standalone (no `jobId`) failure with `gramsWasted` looks up cost via its own recorded material rather than needing a job-derived "dominant material" lookup (ASSUMPTION A-40-1, flagged in a code comment for user confirmation, same class as P-05).
- **`WhatIfScenarioResult` never returns `Infinity`.** "Will never break even" is represented as `null`, keeping the entire result contract to "finite numbers or null" per the plan's NaN/Infinity guard requirement.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria were met without needing Rule 1-4 auto-fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`src/utils/insights.ts` is a complete, fully-tested foundation: 40-02 through 40-05 (Insights tab composition, product ranking UI, printer payback UI, what-if simulator UI) can now import `computeProductRanking`, `computeWageHeadline`, `computePrinterPayback`, `buildCalcInputFromJob`, and `computeScenario` directly, with the guarantee that every money number they display traces back to exactly `computePerSaleProfit` or `calculateCost`. No blockers. `pricingCoach.ts`/`costAllocation.ts` remain intentionally unimported by any component this phase (their calculator-UI re-attachment is deferred to Phase 45 per D-13).

---
*Phase: 40-insight-layer*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 9 files created/modified verified present on disk; all 3 task commits (`3ca6c37`, `61a837d`, `e11b135`) verified present in git history.
