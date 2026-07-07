---
phase: 39-cost-realism
plan: 05
subsystem: calculator
tags: [cost-calc, tou-electricity, failure-rate, maintenance-amortization, abrasive-wear, output-equivalence]

# Dependency graph
requires:
  - phase: 39-cost-realism
    plan: 01
    provides: "Dexie v12 schema, touElectricity.ts, PrintJob snapshot fields"
  - phase: 39-cost-realism
    plan: 02
    provides: "useFailureRate read-only hook, dominantMaterialId"
  - phase: 39-cost-realism
    plan: 03
    provides: "useTouTariff / ElectricityConfig.touBands read/write boundary (Settings)"
  - phase: 39-cost-realism
    plan: 04
    provides: "useMaintenanceAmortization hook, abrasive.ts matchers"
provides:
  - "CalcInput extended with touStartTime + maintenanceCostPerHour (optional, byte-identical defaults)"
  - "calculateElectricityCost is TOU-aware via resolveWeightedCostPerKwh; resolveElectricityRatePerKwh snapshot helper"
  - "calculateAbrasiveSurcharge — additive brass-nozzle abrasive-wear cost line"
  - "CostBreakdown extended with touRateUsedPerKwh/maintenanceCost/abrasiveSurcharge"
  - "CostCalculator orchestrator wires useFailureRate/useMaintenanceAmortization + a TOU savings-hint computation"
  - "3 new Apply-gated hint rows in CostParametersSection (failure rate, TOU start time, maintenance amortization)"
  - "Save path snapshots touStartTime/touRateUsedPerKwh/maintenanceCostAtSave onto PrintJob"
  - "3 appended golden scenarios + re-captured output-equivalence baseline"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass CalcInput extension: pure calculateElectricityCost overload (touStartTime param) + a sibling resolveElectricityRatePerKwh snapshot helper so the orchestrator never duplicates TOU-resolution logic"
    - "Additive-line cost gating: abrasiveSurcharge computed as a NEW CostBreakdown field entirely separate from calculateNozzleWear's own return value (never modifies the wear formula)"
    - "Suggestion-not-mutation UI pattern: all 3 new hint rows render read-only derived values with an Apply button that calls the EXISTING setter — no new write path introduced"

key-files:
  created:
    - src/components/calculator/CostParametersSection.test.tsx
  modified:
    - src/utils/costCalc.ts
    - src/utils/costCalc.test.ts
    - src/types.ts
    - src/hooks/useCostForm.ts
    - src/hooks/useCostDerivedValues.ts
    - src/components/calculator/CostCalculator.tsx
    - src/components/calculator/CostParametersSection.tsx
    - src/components/calculator/__fixtures__/goldenScenarios.ts
    - src/components/calculator/__snapshots__/outputEquivalence.test.tsx.snap

key-decisions:
  - "Abrasive surcharge amount = the SAME nozzle-wear cost again (a simple auditable doubling), rather than a second wear model — keeps the new cost line easy to explain and verify against the existing nozzleWear figure"
  - "CostCalculator does not call useTouTariff (which requires an onElectricityChange write callback the calculator doesn't own) — it reads electricity.touBands directly for the read-only 'is TOU configured' + savings-hint computation; useTouTariff remains the Settings-side write boundary only"
  - "touRateUsedPerKwh/maintenanceCostAtSave snapshot at save time only when touStartTime/maintenanceCostPerHour are actually set — undefined for non-TOU/non-maintenance jobs, matching legacy jobs exactly (no silent reprice of history)"

requirements-completed: [FAIL-02, FAIL-03, TOU-02, WEAR-02]

# Metrics
duration: ~55min
completed: 2026-07-06
---

# Phase 39 Plan 5: Calculator Convergence — TOU/Failure/Maintenance Wiring Summary

**Wires the empirical failure-rate suggestion, TOU-weighted electricity, and amortized-maintenance suggestion into the calculator via 3 new Apply-gated hint rows, extending costCalc.ts additively (new maintenance-cost line + brass-nozzle abrasive surcharge) while keeping the Phase 38 output-equivalence/render-count/pricing-sequence tripwires green.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 of 3 complete (Task 3's `checkpoint:human-verify` gate APPROVED by the user; the orchestrator independently verified the snapshot diff is append-only and the calculator suite is green)
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- `costCalc.ts`: `CalcInput` extended with optional `touStartTime`/`maintenanceCostPerHour`; `calculateElectricityCost` resolves the $/kWh rate via `resolveWeightedCostPerKwh` when TOU bands + a start time are present, otherwise falls back to the flat rate unchanged (byte-identical for non-TOU jobs); new `resolveElectricityRatePerKwh` helper exposes the same resolved rate for save-time snapshotting; new `calculateAbrasiveSurcharge` adds an additive brass-nozzle abrasive-wear cost line, gated on the dominant filament resolving abrasive (`resolveIsAbrasive`) AND the instance's nozzle resolving to `'brass'` (`resolveNozzleType`, defaulting undefined → brass) — `calculateNozzleWear`'s own formula is untouched (verified via `git diff` showing no edits inside its body)
- `CostBreakdown` extended with `touRateUsedPerKwh`/`maintenanceCost`/`abrasiveSurcharge`
- `useCostForm.ts`: new `touStartTime`/`maintenanceCostPerHour` form fields — Apply-gated (never auto-written), restored from `editingJob.touStartTime`/`maintenanceCostAtSave` on resume, reset on `clearForm`, included in the existing `nonPricingFormState` sessionStorage blob
- `useCostDerivedValues.ts`: threads `touStartTime`/`maintenanceCostPerHour` into both `calculateCost` passes (`costsForTrueCost` + `costs`), with honest dep arrays
- `CostCalculator.tsx` (orchestrator): calls `useFailureRate(selectedInstanceId, dominantFilamentId)` and `useMaintenanceAmortization(selectedInstance)` — both hooks live HERE, never inside `CostParametersSection` (verified via grep); computes a TOU savings hint by comparing the currently-selected start time's weighted rate against the cheapest configured band for the same duration; save path snapshots `touStartTime`/`touRateUsedPerKwh`/`maintenanceCostAtSave` onto the `PrintJob` only when actually set (undefined for non-TOU/non-maintenance jobs)
- `CostParametersSection.tsx`: 3 new additive hint rows — (1) the empirical failure-rate suggestion with provenance + Apply beside the existing failure-rate input, (2) a TOU start-time picker (renders only when bands are configured) + a savings hint, (3) a new manual maintenance-cost `$/hr` input (D-14 — no such field existed before) + amortized-rate hint + Apply. All Apply handlers route through the EXISTING setters (`onFailureRateChange`/`onMaintenanceCostPerHourChange`) — no new write path. The section still imports zero Dexie/hooks (verified via grep)
- `CostParametersSection.test.tsx` (new): 12 tests covering all 3 hint rows, their null/absent states, Apply-click behavior, and the props-in/callbacks-out/no-Dexie contract
- `goldenScenarios.ts`: 3 new scenarios APPENDED to the end of `CURATED_SCENARIOS` (FROZEN-ORDER rule respected — no reordering) exercising TOU-active electricity, a CF-on-brass abrasive surcharge, and an empirical-rate-applied failure rate
- `outputEquivalence.test.tsx.snap`: re-captured in its own dedicated commit — diff is a pure 24-line addition (the 3 new scenarios' captured values) with zero changes to any pre-existing scenario, confirming no accidental reprice of history

## Task Commits

1. **Task 1: Extend CalcInput + costCalc.ts** — `c808c47` (feat)
2. **Task 2: Wire hooks in orchestrator + 3 hint rows + TOU snapshot at save** — `a5bd1f4` (feat)
3. **Task 3: Extend golden fixtures + re-capture baseline (human-verified)** — `bcde91f` (test)

Task 3 is `type="checkpoint:human-verify" gate="blocking"` per the plan. The executor completed the automation (fixture extension + baseline re-capture + full-suite/tsc/build verification), stopped at the gate without self-approving (per `autonomous: false`), and returned the checkpoint state. The user APPROVED the gate; the orchestrator independently confirmed the snapshot diff is append-only and the calculator suite is green. See "Checkpoint Status" below.

## Files Created/Modified

- `src/utils/costCalc.ts` — TOU-aware `calculateElectricityCost`, `resolveElectricityRatePerKwh`, `calculateAbrasiveSurcharge`, extended `calculateCost` orchestrator
- `src/utils/costCalc.test.ts` — byte-identical-defaults assertions + TOU/maintenance/abrasive-surcharge test coverage (18 new tests)
- `src/types.ts` — `CostBreakdown` extended with `touRateUsedPerKwh`/`maintenanceCost`/`abrasiveSurcharge`
- `src/hooks/useCostForm.ts` — `touStartTime`/`maintenanceCostPerHour` form state
- `src/hooks/useCostDerivedValues.ts` — threads the two new fields into `calculateCost`
- `src/components/calculator/CostCalculator.tsx` — hook wiring, TOU savings-hint computation, save-path snapshot fields
- `src/components/calculator/CostParametersSection.tsx` — 3 new hint rows + extended props interface
- `src/components/calculator/CostParametersSection.test.tsx` — new, 12 tests
- `src/components/calculator/__fixtures__/goldenScenarios.ts` — 3 appended scenarios
- `src/components/calculator/__snapshots__/outputEquivalence.test.tsx.snap` — re-captured baseline

## Decisions Made

- Abrasive surcharge amount is the SAME nozzle-wear cost again (a simple, auditable doubling) rather than a second wear model — keeps the new line easy to explain against the existing `nozzleWear` breakdown figure.
- `CostCalculator` does not call `useTouTariff` (it requires an `onElectricityChange` write callback the calculator doesn't own) — it reads `electricity.touBands` directly for the read-only "is TOU configured" check and the savings-hint computation. `useTouTariff` remains exclusively the Settings-side read/write validation boundary.
- `touRateUsedPerKwh`/`maintenanceCostAtSave` are snapshotted only when `touStartTime`/`maintenanceCostPerHour` are actually set — both stay `undefined` for jobs that don't use TOU/maintenance input, matching legacy jobs byte-for-byte.

## Deviations from Plan

None — plan executed as written. All acceptance-criteria greps pass:
- `calculateNozzleWear` body unmodified (verified via `git diff`)
- `costCalc.ts` remains pure (no react/dexie imports)
- New `CalcInput` fields optional (`maintenanceCostPerHour?`)
- `CostParametersSection.tsx` has zero Dexie/hook imports
- Hooks called in the orchestrator (`useFailureRate` present in `CostCalculator.tsx`)
- Save path snapshots `touRateUsedPerKwh`
- `renderCount`/`pricingSequence` PERF-11 tripwires remain green (exactly 1 commit per keystroke)
- Baseline re-capture is its own dedicated commit (`bcde91f`), diff is a pure addition

## Verification Run (pre-checkpoint)

- `npx vitest run` — **997 passed, 1 todo** (84 test files, all green)
- `npx tsc -b` — clean, 0 errors
- `npm run build` — clean; main chunk 81.8 KB gzipped (under the 300 KB gate)
- `npx vitest run src/components/calculator/` — 42 passed, 1 todo (outputEquivalence/renderCount/pricingSequence/CostParametersSection/CostCalculator all green)

## Checkpoint Status

**Task 3 (`checkpoint:human-verify`, `gate="blocking"`): APPROVED.** The executor completed the automation half (3 appended scenarios, re-captured baseline, full-suite/tsc/build all green), then stopped at the gate WITHOUT self-approving — per the plan's `autonomous: false` directive and the workflow config (`workflow.auto_advance` not `"true"`) — and returned the checkpoint state. The user responded "approved"; the orchestrator additionally verified independently that the snapshot diff is append-only and the calculator suite is green.

**Verification checklist (all confirmed before + at approval):**
1. `bcde91f` is a clean, dedicated commit naming the 3 appended scenarios (not folded into a feature commit, not an unaudited `--update`) — confirmed via `git log`.
2. The 3 scenarios are appended at the end of `CURATED_SCENARIOS` with no reordering — confirmed via `git diff --stat` (pure 24-line addition).
3. Each new scenario actually varies its target field (TOU rate / CF-on-brass / applied failure rate) — confirmed via the scenario definitions and their distinct captured snapshot values.
4. Full suite + tsc + build all green — confirmed above.
5. No saved job reprices silently — the save path (`CostCalculator.tsx` `sharedFields`) only sets `touRateUsedPerKwh`/`maintenanceCostAtSave` when the corresponding input was actually used; both are `undefined` otherwise.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 39 (Cost Realism) is complete: FAIL-01..04, TOU-01/02, WEAR-01/02 all satisfied across Plans 01-05.
- No blockers — all 5 plans converge cleanly on the shared calculator surface with the shared-file risk isolated to this single plan, per the plan's own design.

---
*Phase: 39-cost-realism*
*Completed: 2026-07-06 (all 3/3 tasks; human-verify gate approved)*

## Self-Check: PASSED

All created/modified files verified present on disk; task commit hashes (`c808c47`, `a5bd1f4`, `bcde91f`) verified present in `git log --oneline`.
