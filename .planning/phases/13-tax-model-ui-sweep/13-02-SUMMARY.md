---
phase: 13-tax-model-ui-sweep
plan: 02
subsystem: util
tags: [tax, costCalc, vitest, pure-function, tdd]

# Dependency graph
requires:
  - phase: 10-cost-calc-tests
    provides: Vitest infrastructure, sibling describe-block pattern, `it.todo` placeholder at costCalc.test.ts:444
provides:
  - calculateTax(sellingPrice, ratePercent) pure function in src/utils/costCalc.ts
  - 7 unit tests locking the TAX-05 math contract (rate=0 guard, regional rates, centime rounding 23%/12.50 → 2.88, sellingPrice guard, order-of-operations guard)
  - it.todo at costCalc.test.ts:444 REMOVED — VALIDATION row 7 satisfied
affects: [13-03-settings-default-tax-rate, 13-05-costcalculator-tax-row, 13-pdf-quote, 13-resolve-tax-rate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling pure-function shape (scalars-in / record-out) matching calculateLabor"
    - "Defensive-zero return idiom mirroring calculateElectricityCost / calculateDepreciation — no throws"
    - "Locked centime rounding: Math.round(sellingPrice * ratePercent) / 100 — no EPSILON, no toFixed, no Intl.NumberFormat"

key-files:
  created: []
  modified:
    - src/utils/costCalc.ts (calculateTax appended between calculateAmortization and calculateCost)
    - src/utils/costCalc.test.ts (calculateTax named-import added; it.todo at line 444 removed; new top-level describe block with 7 tests)

key-decisions:
  - "Placement: calculateTax sits between calculateAmortization and calculateCost — keeps the 'sub-helpers above, orchestrator below' rhythm established by costCalc.ts"
  - "Guard ordering: rate-guard checked BEFORE sellingPrice-guard so the explicit 'rate is 0' return path (with ratePercent: 0) takes precedence over the sellingPrice guard. Matches PATTERNS.md S5 + RESEARCH Pitfall 2."
  - "describe('calculateTax') placed as a NEW top-level describe block AFTER the calculateCost integration block (PATTERNS.md line 102 recommended). One describe per pure function — consistent with the rest of the file."

patterns-established:
  - "S5/S6: pure-util + Vitest describe-per-function convention extended to a function returning a typed record (rather than a scalar) — sets the shape calculateCost orchestrator + future taxResolution can reuse"

requirements-completed: [TAX-05]

# Metrics
duration: 4min
completed: 2026-05-21
---

# Phase 13 Plan 02: Tax Model + UI Sweep — calculateTax + Test Activation Summary

**calculateTax pure function with locked centime rounding (Math.round(price * rate) / 100) and 7 Vitest assertions activating the v1.2 it.todo — TAX-05 math contract now enforced by CI.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-21T15:00:59Z
- **Completed:** 2026-05-21T15:04:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `calculateTax(sellingPrice, ratePercent)` shipped in `src/utils/costCalc.ts` with the locked rounding strategy (`Math.round(sellingPrice * ratePercent) / 100`). Defensive returns: zero rate → `{ taxAmount: 0, ratePercent: 0 }`; zero/negative price → `{ taxAmount: 0, ratePercent }` (rate preserved so callers can still render the percent label).
- `it.todo` at `src/utils/costCalc.test.ts:444` REMOVED — replaced by a new top-level `describe('calculateTax', ...)` block with 7 tests covering all VALIDATION-locked substrings (`rate is 0`, `UK 20%`, `AU 10%`, `EU-average`, `centime rounding`, `order-of-operations`, plus the sellingPrice guard).
- Full vitest run on `costCalc.test.ts` is green: **46 tests pass** (39 pre-existing + 7 new). No regressions.
- `npx tsc -b` exits 0.
- Order-of-operations guard test asserts the math fact that distinguishes "tax × sellingPrice" from "tax × subtotal" — locks the contract Plans 03 and 05 depend on.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append calculateTax to src/utils/costCalc.ts** — `d7be4c7` (feat)
2. **Task 2: Activate it.todo + add describe('calculateTax') block** — `0213199` (test)

_Note: Task 1 + Task 2 together form the TDD GREEN+RED gate inversion called out in the plan — the implementation lands first (Task 1) so that Task 2's tests run green on first commit. This is the plan-prescribed order (the plan structures Task 2 as "tests that exercise Task 1's function") and is documented in the plan's `<tasks>` block._

## Files Created/Modified

- `src/utils/costCalc.ts` — Added `calculateTax(sellingPrice: number, ratePercent: number): { taxAmount: number; ratePercent: number }` between `calculateAmortization` (line 118) and `calculateCost` orchestrator (line 140). 16-line addition; no other changes.
- `src/utils/costCalc.test.ts` — Added `calculateTax` to the named-import list; removed the `it.todo` line at the bottom of the `calculateCost` integration block; appended a new top-level `describe('calculateTax', ...)` with 7 `it(...)` cases. Net diff: +44 −1.

## Decisions Made

- **calculateTax placement** — appended between `calculateAmortization` and `calculateCost` per the plan's "sub-helpers above, orchestrator below" rhythm. Matches PATTERNS.md S5 and keeps `calculateCost` the last function in the file.
- **Guard order in calculateTax** — rate-guard runs FIRST (returns `ratePercent: 0` to signal "hide the row entirely"), price-guard runs SECOND (returns `ratePercent` preserved so callers can still display the percent label even when price is 0). This ordering is locked in the plan acceptance criteria.
- **`toBe` (not `toBeCloseTo`) for the 2.88 centime assertion** — rounding is contract-locked per PATTERNS.md S6. `Math.round(287.5) = 288 → 288/100 = 2.88` exactly; any drift indicates a contract regression.
- **`describe('calculateTax')` placement** — new top-level describe block AFTER the `calculateCost` integration block, NOT nested inside it. Mirrors the rest of the file's "one describe per exported function" organization.
- **Order-of-operations guard test** — uses the synthetic case from RESEARCH Example 1 (subtotal=10, sellingPrice=25, rate=20). Asserts both branches individually (`toBe(5)` and `toBe(2)`) AND their inequality, so a future regression that swaps `sellingPrice` for `subtotal` in any consumer fails with a clear diff.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Installed missing npm dependencies in the worktree**

- **Found during:** Task 1 verify (`npx tsc -b`)
- **Issue:** Worktree had an empty `node_modules/`. `tsc -b` reported `Cannot find module 'react-window'` and `Cannot find module 'rollup-plugin-visualizer'` from `src/components/AssetLibrary.tsx`, `src/components/JobsManager.tsx`, and `vite.config.ts`. These are pre-existing project dependencies already declared in `package.json` — not newly added packages. The empty `node_modules/` was a worktree-setup artifact (Claude Code worktrees don't inherit the main repo's `node_modules`).
- **Fix:** Ran `npm install --no-audit --no-fund` inside the worktree. 619 packages installed in 4s. Confirmed legitimacy: every missing module is already locked in `package-lock.json` at the version recorded in `package.json` (`react-window@^2.2.7`, `rollup-plugin-visualizer@^5.14.0`) — no slopsquat surface.
- **Files modified:** None tracked (`node_modules/` is gitignored; `package.json` / `package-lock.json` untouched).
- **Verification:** Post-install `npx tsc -b` exits 0 with zero errors.
- **Committed in:** N/A (no tracked files changed).

---

**Total deviations:** 1 auto-fixed (1 blocking environment setup)
**Impact on plan:** No code changes. Restored the worktree's tooling environment to the state the plan assumed. Zero scope creep.

## Issues Encountered

- During the per-substring `-t` verification loop, the shell loop initially reported `exit=1` for each `vitest -t` invocation. Direct re-runs showed `RAW_EXIT=0` and `1 passed | 45 skipped`. The exit=1 was a shell scripting artifact (likely stdin handling in the loop body running under a non-interactive context); the actual test outcomes were never in question. The full file run (`npx vitest run src/utils/costCalc.test.ts`) and each individually-invoked filtered run both exit 0.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **calculateTax is ready for consumption** by Plans 03 (Settings → Default Tax Rate) and 05 (Cost Breakdown Tax row). The signature `(sellingPrice: number, ratePercent: number) → { taxAmount: number; ratePercent: number }` is locked and TypeScript-verified.
- **Plan 04 (resolveTaxRate)** is unblocked — `calculateTax` is the math primitive `resolveTaxRate`'s output (`source.rate`) feeds.
- **Order-of-operations contract** is now machine-enforced. Any future consumer that accidentally calls `calculateTax(subtotal, rate)` instead of `calculateTax(sellingPrice, rate)` will produce different outputs and downstream `taxAmount` will be wrong — but the math fact itself is now locked by Test 7.
- No blockers or concerns.

## Self-Check

- File check: `src/utils/costCalc.ts` exists, contains `export function calculateTax` (line 124). FOUND.
- File check: `src/utils/costCalc.test.ts` exists, contains `describe('calculateTax'` (line 447). FOUND.
- Commit check: `d7be4c7` (Task 1) present in `git log`. FOUND.
- Commit check: `0213199` (Task 2) present in `git log`. FOUND.
- Verification: `npx tsc -b` exits 0. PASS.
- Verification: `npx vitest run src/utils/costCalc.test.ts` exits 0, 46/46 pass. PASS.
- Verification: `! grep -n "it.todo" src/utils/costCalc.test.ts` → 0 matches. PASS.
- Verification: All 6 VALIDATION substrings present (`rate is 0`, `UK 20%`, `AU 10%`, `EU-average`, `centime rounding`, `order-of-operations`). PASS.

## Self-Check: PASSED

---
*Phase: 13-tax-model-ui-sweep*
*Completed: 2026-05-21*
