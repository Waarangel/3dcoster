---
phase: 10-cost-calculation-unit-tests
plan: 01
subsystem: testing
tags:
  - testing
  - cost-calculation
  - pure-module-extraction
  - typescript
  - react

# Dependency graph
requires:
  - phase: v1.0 Phase 02 (gcode-parser)
    provides: exported getMaterialDensity for per-material density lookup
  - phase: v1.0 Phase 01 (data-foundation)
    provides: CostBreakdown contract at src/types.ts:116-129
provides:
  - Pure src/utils/costCalc.ts module with CalcInput interface and 7 named exports
  - Stable interface for Plan 02 (refactor CostCalculator.tsx consumer) and Plan 03 (write test suite) to run in parallel against
  - Failure-rate clamp (Math.min(Math.max(failureRate, 0), 99)) preserved inline inside calculateCost per D-02
  - Per-material density preserved via getMaterialDensity (v1.0 nozzle-wear fix kept intact)
affects:
  - 10-02 (CostCalculator.tsx refactor — consumes calculateCost)
  - 10-03 (costCalc.test.ts — tests every exported helper)
  - 10-04 (build-script + coverage gate — gates this module)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure-utility module pattern (mirrors src/utils/gcodeParser.ts shape)
    - useMemo-to-pure-module extraction seam (first instance in this codebase)

key-files:
  created:
    - src/utils/costCalc.ts
  modified: []

key-decisions:
  - "D-02 enforced: failure-rate clamp lives INSIDE calculateCost, not as a separate exported helper"
  - "Internal FilamentRow shape re-declared as CalcInputFilamentRow in costCalc.ts so the pure module does not depend on CostCalculator.tsx"
  - "calculateAmortization() returns 0 (mirrors the placeholder at CostCalculator.tsx:408); helper exported so Plan 03 can lock the contract"
  - "getMaterialDensity import deferred from Task 1 to Task 2 to satisfy tsc -b under noUnusedLocals while keeping atomic per-task commits"

patterns-established:
  - "Pure cost-math module: one coarse entrypoint (calculateCost) + N named sub-helpers (one per cost factor) with strict TS types — matches D-02"
  - "Math-preservation pattern: each helper has a one-line comment naming the formula and a (matches CostCalculator.tsx:NNN-NNN) source-line citation for diff traceability"

requirements-completed:
  - TEST-01

# Metrics
duration: 4min
completed: 2026-05-20
---

# Phase 10 Plan 01: Pure costCalc Module Scaffold Summary

**Created src/utils/costCalc.ts as a pure-utility module with CalcInput contract, 6 named sub-helpers, and the calculateCost entrypoint — byte-for-byte math port of CostCalculator.tsx:374-446 with the failure-rate clamp preserved inline per D-02.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-20T13:59:21Z
- **Completed:** 2026-05-20T14:03:23Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 0 (Plan 02 wires CostCalculator.tsx)

## Accomplishments

- Pure module `src/utils/costCalc.ts` exists with zero React imports, zero IO, zero side effects — the testable seam for Plan 03's test suite
- Public API contract locked: `CalcInput` (16 fields covering every closure variable the source useMemo reads) + 7 named exports (`calculateFilamentCost`, `calculateElectricityCost`, `calculateDepreciation`, `calculateNozzleWear`, `calculateLabor`, `calculateAmortization`, `calculateCost`)
- Math semantics manually cross-checked block-by-block against `CostCalculator.tsx:374-446` — every formula, guard, and nullable-fallback chain matches
- Failure-rate clamp `Math.min(Math.max(failureRate, 0), 99)` lives inside `calculateCost` per D-02 (no separate clamp helper exported)
- Per-material density lookup preserved via `getMaterialDensity` — the v1.0 Phase 06 nozzle-wear fix stays intact; zero hardcoded densities in the new file
- `npx tsc -b` exits 0 with zero new TypeScript errors
- Plan 02 (refactor consumer) and Plan 03 (write tests) can now run in parallel against this stable interface

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/utils/costCalc.ts with CalcInput interface and module skeleton** — `4d996b5` (feat)
2. **Task 2: Implement 6 sub-helpers and calculateCost entrypoint with byte-for-byte math preservation** — `cfdd71e` (feat)

## Files Created/Modified

- `src/utils/costCalc.ts` (CREATED, 184 lines) — Pure cost-calculation module. Exports `CalcInput`, `CalcInputFilamentRow`, and 7 named functions. Imports `getMaterialDensity` from `./gcodeParser` and type-only imports from `../types`. Zero React, zero Dexie, zero IO.

## Decisions Made

- **D-02 honored at code level:** failure clamp is inlined inside `calculateCost`, not split into a separate `clampFailureRate` helper. The clamp's only use site is the orchestrator, and exporting it would invite drift where consumers double-clamp.
- **`CalcInputFilamentRow` re-declared in costCalc.ts** instead of imported from `CostCalculator.tsx`. The pure module must not depend on the React component file — importing `FilamentRow` from a component would re-introduce the coupling we just severed. The two shapes are structurally identical and consumers will pass the existing FilamentRow object literal at the Plan 02 call site (structural typing handles the assignability).
- **`calculateAmortization()` returns 0 and is exported** even though it has no logic today. The plan explicitly wanted it exported so Plan 03 can write a test that locks the contract — when a future plan adds real amortization logic, that single body change propagates to every consumer with zero call-site churn.
- **`getMaterialDensity` import moved from Task 1 to Task 2** to keep both task commits passing `tsc -b`. Documented as a Rule 3 deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Deferred `getMaterialDensity` import from Task 1 to Task 2**

- **Found during:** Task 1 (initial skeleton compile)
- **Issue:** Task 1's acceptance criteria require both (a) importing `getMaterialDensity` from `'./gcodeParser'` and (b) `npx tsc -b` exiting 0. The project's `tsconfig` enables `noUnusedLocals`, so importing a symbol that is not yet referenced (because Task 1's stubs throw before using it) produces `error TS6133: 'getMaterialDensity' is declared but its value is never read.` The two acceptance items are mutually exclusive when Task 1 is committed atomically.
- **Fix:** Task 1 omits the `getMaterialDensity` import; Task 2 adds it alongside the body of `calculateNozzleWear` that actually calls it. Both commits pass `tsc -b` cleanly. The end-state of the file (after both commits) still satisfies the plan's `key_links` frontmatter requirement (`from costCalc.ts → to gcodeParser.ts via getMaterialDensity import`).
- **Files modified:** `src/utils/costCalc.ts`
- **Verification:** `grep -c "getMaterialDensity" src/utils/costCalc.ts` → 3 (1 import + 1 doc comment + 1 callsite); `npx tsc -b` → exit 0 after both commits.
- **Committed in:** `cfdd71e` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** None — the end-state matches the plan's spec. The deviation only affects the intermediate state between Task 1 and Task 2 commits.

## Issues Encountered

None.

## User Setup Required

None — pure code change, no external services, no env vars, no migrations.

## Next Phase Readiness

**Ready for parallel execution:**
- **Plan 02 (refactor CostCalculator.tsx consumer):** Can replace the `useMemo` body at `CostCalculator.tsx:374-452` with `useMemo(() => calculateCost({…}), [deps])`. Import: `import { calculateCost } from '../utils/costCalc';`. The dependency array stays unchanged.
- **Plan 03 (write costCalc.test.ts):** Can `import { calculateCost, calculateFilamentCost, calculateElectricityCost, calculateDepreciation, calculateNozzleWear, calculateLabor, calculateAmortization } from './costCalc';` and write the test suite against the locked contract. All 13 edge cases from D-13 of 10-CONTEXT.md are reachable through this API.

**Blockers/concerns:**
- None. The interface is stable. The math is identical to source. The module compiles cleanly.

## Self-Check

- File `src/utils/costCalc.ts` exists: **FOUND**
- Commit `4d996b5` (Task 1) exists in `git log`: **FOUND**
- Commit `cfdd71e` (Task 2) exists in `git log`: **FOUND**
- `npx tsc -b` exit 0: **PASS**
- All 7 named exports present: **PASS**
- Zero React imports: **PASS**
- Zero hardcoded densities (1.24, 1.27, 1.04): **PASS**
- Failure clamp inside calculateCost (D-02): **PASS**
- CalcInput has 16 fields: **PASS**

## Self-Check: PASSED

---
*Phase: 10-cost-calculation-unit-tests*
*Completed: 2026-05-20*
