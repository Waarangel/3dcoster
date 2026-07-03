---
phase: 10-cost-calculation-unit-tests
plan: 03
subsystem: testing
tags:
  - testing
  - cost-calculation
  - vitest
  - regression-lock

# Dependency graph
requires:
  - phase: 10-01 (pure costCalc module scaffold)
    provides: 7 named exports + CalcInput contract that this test suite exercises
  - phase: v1.0 Phase 02 (gcode-parser)
    provides: getMaterialDensity for D-11 hybrid smoke tests
provides:
  - Vitest test suite locking the 7 cost factors + failure-rate clamp + per-material density
  - Coverage baseline for Plan 04's `vitest run --coverage` threshold gate
  - it.todo placeholder marker for v1.2 tax/VAT activation
affects:
  - 10-04 (build-script + coverage gate — measures coverage against this suite)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure-utility test pattern (mirrors src/utils/threeMfParser.test.ts shape)
    - Synthetic fixture-builder helpers (makePrinter, makeInstance, makeMaterial, makeRow, makeCalcInput)
    - D-11 hybrid fixtures (synthetic math + real-data getMaterialDensity smoke tests)

key-files:
  created:
    - src/utils/costCalc.test.ts
  modified: []

key-decisions:
  - "D-12 honored: it.todo uses em-dash (U+2014) literal — 'tax/VAT applies after subtotal — activates in v1.2'"
  - "D-13 edge cases all present as named tests: 1/2/16 filament rows, failureRate 0/99/150/-10, PLA/PETG/ABS/UnknownXYZ/null density"
  - "Synthetic-fixture helpers added at file top to keep individual it() bodies declarative and verifiable by eye"
  - "Zero React imports — pure-math classification per CONTEXT scope; tests run without DOM"
  - "16-filament test uses Array.from({ length: 16 }, …) (Bambu AMS Hub max per PROJECT.md v1.0)"

patterns-established:
  - "Co-located *.test.ts next to *.ts module (matches vitest include glob src/**/*.test.ts; no config change needed)"
  - "describe per sub-helper + describe('calculateCost', ...) for the orchestrator integration tests"
  - "toBeCloseTo(value, 2) for monetary assertions; toBe(value) for exact zeros / table lookups / passthrough fields"
  - "it.todo(string) as a single-arg vitest call to mark not-yet-implemented behaviors"

requirements-completed:
  - TEST-01

# Metrics
duration: 3min
completed: 2026-05-20
---

# Phase 10 Plan 03: costCalc Test Suite Summary

**Created src/utils/costCalc.test.ts (445 lines, 39 passing tests + 1 it.todo) locking every D-13 edge case, every sub-helper, the calculateCost integration, the failure-rate clamp boundaries, and the per-material density table — the regression net that lets Plan 04's coverage gate measure something meaningful.**

## Performance

- **Duration:** ~3 min (analysis + writing + verification + commit)
- **Test wall-clock:** 509ms (vitest run src/utils/costCalc.test.ts)
- **Full-project wall-clock:** 783ms (vitest run across 4 test files)
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- `src/utils/costCalc.test.ts` exists, is picked up by vitest's `src/**/*.test.ts` include glob, and exits 0 with **39 passing + 1 todo**.
- Full project `npx vitest run` exits 0 across 4 test files (**62 passing + 1 todo total** — threeMfParser, Skeleton, EmptyState, and the new costCalc suite).
- `npx tsc -b` exits 0 — strict noUnusedLocals / noUnusedParameters pass for the new test file.
- Zero React imports, zero DOM imports — pure-math classification (`grep -c "from 'react'" → 0`).
- D-12 placeholder present with exact em-dash (U+2014) phrasing: `it.todo('tax/VAT applies after subtotal — activates in v1.2')`. Verified by `grep -c` returning 1.
- All 8 required describe blocks present (one per sub-helper + getMaterialDensity smoke + calculateCost integration).
- D-13 edge cases all materialised as named tests:
  - Multi-filament: 1 row, 2 rows, 16 rows (Bambu AMS Hub max)
  - Failure-rate clamp: 0, 99, 150 (clamps to 99), -10 (clamps to 0)
  - Per-material density: PLA, PETG, ABS, UnknownXYZ (fallback), null (default branch)
  - No-printer-selected → electricity & nozzleWear & depreciation == 0
  - Zero-recovery-hours guard → depreciation == 0 (recoveryMonths=0 and estimatedMonthlyPrintHours=0 paths)
  - profitMargin / targetProfit / sellingPrice pass-through (locks the consumer contract)
  - Per-unit model cost flows into subtotal when modelCostPerUnit=true

## Test Counts by describe block

| Describe block                          | Tests | Notes                                                |
| --------------------------------------- | ----- | ---------------------------------------------------- |
| `calculateFilamentCost`                 | 6     | empty / single / empty-id guard / 0-price / -price / multi-row sum |
| `calculateElectricityCost`              | 3     | no-printer / happy path 0.024 / linear scaling       |
| `calculateDepreciation`                 | 5     | no-printer-no-instance / instance happy / printer fallback / recoveryMonths=0 / monthlyHours=0 |
| `calculateNozzleWear`                   | 5     | no-printer / single-material / multi-material density / grams<=0 / unknown-id fallback |
| `calculateLabor`                        | 3     | zeros / happy 20.00 / rate=0                         |
| `calculateAmortization`                 | 1     | placeholder returns 0                                |
| `getMaterialDensity (smoke tests)`      | 5     | PLA / PETG / ABS / UnknownXYZ / null (D-11 hybrid)   |
| `calculateCost (integration)`           | 11 + 1 todo | 12-field shape / 2-row sum / 16-row AMS max / failureRate 0/99/150/-10 / no-printer / pass-through / materialsUsed / per-unit model cost / **it.todo tax/VAT** |
| **Total**                               | **39 + 1 todo** | matches `Tests 39 passed | 1 todo (40)` reported by vitest |

## Task Commits

1. **Task 1: Create costCalc.test.ts with synthetic-fixture helpers, 6 sub-helper describes, getMaterialDensity smoke tests, and calculateCost integration** — `c057d0b` (test)

## Files Created/Modified

- `src/utils/costCalc.test.ts` (CREATED, 445 lines) — Vitest test suite for the pure cost-calculation module. Imports: `{ describe, it, expect } from 'vitest'`, 7 named exports from `./costCalc`, `getMaterialDensity` from `./gcodeParser`, type-only imports from `../types` and `./costCalc`. Zero runtime side effects, zero React, zero filesystem fixtures.

## Decisions Made

- **D-12 exact em-dash phrasing:** the literal U+2014 character (—) was used in `it.todo('tax/VAT applies after subtotal — activates in v1.2')`. Verified via `grep -c "it.todo('tax/VAT applies after subtotal — activates in v1.2'" src/utils/costCalc.test.ts → 1`. The plan's grep gate explicitly requires the em-dash, not a hyphen.
- **D-13 edge-case mapping:** every edge case in the plan's `<acceptance_criteria>` got a dedicated `it(...)` block. The 16-filament test uses `Array.from({ length: 16 }, …)` (one of the three acceptable patterns per the gate); failure-rate boundary tests use the literal values 0/99/150/-10 (grep gate found 9 matches — well over the required ≥4).
- **Synthetic-fixture helper layout:** five small builders (`makePrinter`, `makeInstance`, `makeMaterial`, `makeRow`, `makeCalcInput`) live at the top of the file, matching the `makeSlicedZip`/`makeUnslicedZip` pattern in `threeMfParser.test.ts`. This keeps each `it(...)` body short and the math verifiable by eye.
- **`unknown filamentId` test added under `calculateNozzleWear`** — when a row's `filamentId` does not match any registered material, `materials.find(...)` returns `undefined`, `asset?.filamentType ?? null` is `null`, and `getMaterialDensity(null)` returns 1.24. This isn't explicitly in D-13 but is implied by the "unrecognized string" density edge case, and locks the existing nullable-chain semantics in `calculateNozzleWear`.
- **`materialsUsed` and `modelCostPerUnit` integration tests added** — these are part of the full `calculateCost` orchestration path. Even though they aren't D-13 edges, they're inside the orchestrator's actual code path; testing them locks the consumer contract (the `materials` and `subtotal` fields of `CostBreakdown`) for Plan 02's refactor.

## Deviations from Plan

None — plan executed exactly as written.

The plan's tasks all completed as specified. Every acceptance gate from the `<acceptance_criteria>` block was checked and passes:

| Gate | Result |
| --- | --- |
| File `src/utils/costCalc.test.ts` exists | OK |
| `grep -c "import { describe, it, expect } from 'vitest'"` == 1 | OK |
| `grep -c "from 'react'"` == 0 | OK |
| All 8 describe blocks present (one per gate) | OK |
| `grep -c "it.todo('tax/VAT applies after subtotal — activates in v1.2'"` == 1 | OK |
| 16-filament edge case pattern match | OK (2 matches: declaration + length assertion) |
| failureRate boundaries grep ≥ 4 | OK (9 matches) |
| `npx vitest run src/utils/costCalc.test.ts` exits 0 | OK |
| `npx vitest run` (full project) exits 0 | OK |

## Issues Encountered

None.

## User Setup Required

None — pure code change, no external services, no env vars, no migrations.

## Next Phase Readiness

**Ready for Plan 04 (build-script + coverage gate):**
- The test suite produces measurable coverage signal for `src/utils/costCalc.ts` (every exported function has at least one test that exercises a non-trivial code path).
- The full project `npx vitest run` is green, so wiring `vitest run --coverage` into the build pipeline (D-05 / D-06) will not introduce a flaky baseline.
- Coverage thresholds locked to `src/utils/costCalc.ts` only (D-08) — the new test file does the locking; Plan 04 wires the gate.

**Blockers/concerns:**
- None. Test suite is deterministic — no IndexedDB, no browser API, no network, no React rendering.

## Self-Check

- File `src/utils/costCalc.test.ts` exists: **FOUND**
- Commit `c057d0b` (Task 1) exists in `git log`: **FOUND**
- `npx vitest run src/utils/costCalc.test.ts` exits 0 (39 passed + 1 todo): **PASS**
- `npx vitest run` full project exits 0 (62 passed + 1 todo across 4 files): **PASS**
- `npx tsc -b` exits 0: **PASS**
- `grep -c "it.todo('tax/VAT applies after subtotal — activates in v1.2'"` == 1 (D-12 em-dash): **PASS**
- `grep -c "from 'react'"` == 0 (pure math): **PASS**
- All 8 describe blocks present: **PASS**
- 16-filament edge case present (Array.from({ length: 16 })): **PASS**
- Failure-rate boundaries 0/99/150/-10 all present: **PASS**
- Per-material density PLA/PETG/ABS/UnknownXYZ/null all tested: **PASS**

## Self-Check: PASSED

---
*Phase: 10-cost-calculation-unit-tests*
*Completed: 2026-05-20*
