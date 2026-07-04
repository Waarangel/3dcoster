---
phase: 38-foundation
plan: 03
subsystem: calculator
tags: [react, useReducer, useEffect, form-extraction, pricing-interlink, perf-11]

# Dependency graph
requires: [38-01]
provides:
  - "src/hooks/useCostForm.ts — form state (19 fields) + sessionStorage persistence + editingJob/printer effects, extracted verbatim from CostCalculator.tsx"
  - "src/hooks/useCostDerivedValues.ts — currency memos + derived cost chain + useReducer pricing interlink (pricingReducer), replacing the two-useEffect + feeShapeRef architecture"
  - "pricingReducer actions (EDIT_MARGIN/EDIT_PROFIT/EDIT_PRICE/RECALC/SEED_FROM_JOB/RESET) as the canonical pattern for future mutually-derived state in this codebase"
affects: [38-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useReducer built fresh each render from current external inputs (createPricingReducer(trueCost, fee)) — React re-reads the reducer function argument on the render that processes a dispatch, verified via direct test, not assumed from docs"
    - "Two-pass cost computation (costsForTrueCost with placeholder pricing pass-through vs the real costs) to resolve a hook-internal ordering dependency: trueCost must exist before the reducer can be constructed, but costs (which needs pricing.* as pass-through fields) is normally computed after the reducer"
    - "Sibling-hook state combination lifted to the orchestrator: useCostForm's sessionStorage persistence effect moved to CostCalculator.tsx since it's the natural place both hooks' outputs (form fields + live pricing snapshot) are both available in the same render without a ref bridge"

key-files:
  created:
    - src/hooks/useCostForm.ts
    - src/hooks/useCostDerivedValues.ts
    - src/hooks/useCostDerivedValues.test.ts
    - src/components/calculator/coverageGaps.test.tsx
  modified:
    - src/components/CostCalculator.tsx
    - src/components/CostCalculator.test.tsx
    - src/components/calculator/renderCount.test.tsx
    - vitest.config.ts

key-decisions:
  - "Pricing state (sellingPrice/targetProfit/profitMarginPercent/lastEdited) moved OUT of useCostForm (where Task 1 initially placed it verbatim) and into the useCostDerivedValues reducer for Task 2 — this is the explicit handoff the plan's Task 2 action text specifies (Return { ..., pricing: {...}, dispatchPricing })"
  - "sessionStorage persistence lifted from useCostForm into the CostCalculator.tsx orchestrator: a ref-bridge approach to keep the effect inside useCostForm was tried first and rejected — it read/wrote a ref during render, triggering the react-hooks/refs lint rule (a genuine unsafe pattern under concurrent rendering), not just a lint nag"
  - "SEED_FROM_JOB rebases against the CURRENT trueCost immediately inside the reducer branch, not via a separately-dispatched RECALC — found via the Plan 01 equivalence gate: RECALC's dep array [trueCost, fee] can be unchanged between two consecutive editingJob scenarios with different saved cost bases but the same printer/materials, causing RECALC to skip re-firing and leaving the naive seeded (uncorrected) profit/margin on screen"
  - "4 PERF-11 source-contract tests in CostCalculator.test.tsx retired (not ported) — they asserted string literals of the eliminated two-effect implementation (`}, [trueCost, lastEdited...`, `lastEdited === 'margin'` etc). Per 38-PATTERNS.md's explicit discretion note, retirement was chosen because the Plan 01 mount-based equivalence/sequence/render-count suite covers the same behavior more rigorously"
  - "renderCount.test.tsx's conditional 1-or-3 assertion tightened to an unconditional === 1 per the plan's explicit instruction, after empirically confirming exactly 1 commit per keystroke"

patterns-established:
  - "Pattern: two-pass CostBreakdown computation to break a hook-internal ordering dependency (trueCost independent of pricing pass-through fields, but the reducer that produces pricing needs trueCost) — reusable if a future hook has a similar circular-looking-but-actually-linear dependency"
  - "Pattern: lift sessionStorage/localStorage persistence effects to the orchestrator when two sibling hooks' state must combine into one persisted blob — avoids ref-bridging hacks between hooks that would otherwise need each other's output in the same render"

requirements-completed: [FOUND-01, FOUND-02]

# Metrics
duration: 105min
completed: 2026-07-04
---

# Phase 38 Plan 03: useCostForm + useCostDerivedValues Extraction Summary

**Extracted the calculator's ~19-field form state (verbatim) into `useCostForm` and its derived cost/tax/breakeven math into `useCostDerivedValues`, replacing the two-`useEffect` + `feeShapeRef` pricing interlink with a single `useReducer` state machine that structurally eliminates the PERF-11 double-render/desync class — verified against the Plan 01 byte-for-byte output-equivalence snapshot and a tightened render-count(===1) tripwire.**

## Performance

- **Duration:** 105 min
- **Started:** 2026-07-04T07:20:00Z (approx)
- **Completed:** 2026-07-04T08:34:00Z (approx)
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- `src/hooks/useCostForm.ts` holds `FORM_STORAGE_KEY`, `getStoredValue`, the `rowKeySeq`/`nextRowKey` counter, all ~19 form-state fields, sessionStorage persistence (moved to the orchestrator in Task 2 — see Decisions), the editingJob-population effect (with its intentional, verbatim-preserved `eslint-disable-next-line react-hooks/exhaustive-deps` on `[editingJob]`), and the printer auto-select effect
- `src/hooks/useCostDerivedValues.ts` holds the currency-conversion memos (dep arrays preserved exactly), the full derived cost chain (shipping/packaging costs, marketplace fee decomposition, `filamentRowsForCalc`, `costs` via the unchanged `calculateCost`, `trueCost`, `fixedCosts`, `breakEvenInfo`, tax resolution), and the `pricingReducer` `useReducer` state machine
- `feeShapeRef` and both pre-split pricing `useEffect`s are completely eliminated — `grep -c "feeShapeRef" src/hooks/useCostDerivedValues.ts src/components/CostCalculator.tsx` returns 0
- Exactly one pricing-path `useEffect` remains (the `RECALC` dispatcher), keyed on `[trueCost, marketplaceFeeParts.pctFees, marketplaceFeeParts.fixedFees]` with an honest, unsuppressed dep array — zero `eslint-disable` in `useCostDerivedValues.ts`
- Field-level `onChange` handlers dispatch `EDIT_MARGIN`/`EDIT_PROFIT`/`EDIT_PRICE` directly (event-driven, not effect-driven) — the React-idiomatic fix
- Render-count tripwire tightened from the Plan 01 pre-fix baseline (3 commits/keystroke) to an unconditional, verified `=== 1`
- Plan 01's output-equivalence snapshot passes byte-for-byte (120 curated + random scenarios) after fixing a real bootstrapping bug the gate caught (see Deviations)
- `useCostDerivedValues.test.ts` (16 tests) unit-tests the reducer directly: all three `EDIT_*` branches, `RECALC` re-derivation for each `lastEdited` branch (including a fee-shape-change re-fire), the `trueCost<=0` guard, `SEED_FROM_JOB`/`RESET` bypassing that guard, and the no-fee `{0,0}` invariant matching pre-fee gross math exactly
- `vitest.config.ts` `coverage.include` widened to add `useCostDerivedValues.ts`; a small `coverageGaps.test.tsx` closes shipping-carrier-switch and pricing-seed-fallback branches so the file meets the same 95%/100%/90% thresholds as `costCalc.ts` (this coverage run is part of `npm run build`)
- Full suite: 852/852 tests passing, `tsc -b` clean, `eslint` clean on all touched files

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract useCostForm — verbatim relocation of form state + effects + row-key counter** - `529ced2` (feat)
2. **Task 2: Extract useCostDerivedValues with the useReducer pricing interlink (the PERF-11 fix)** - `00cda9d` (feat)

## Files Created/Modified

- `src/hooks/useCostForm.ts` (new) - form state, sessionStorage seed helper, editingJob/printer-select effects, `clearForm`
- `src/hooks/useCostDerivedValues.ts` (new) - currency memos, derived cost chain, `pricingReducer` + `createPricingReducer`, the one `RECALC` effect, tax resolution
- `src/hooks/useCostDerivedValues.test.ts` (new) - 16 direct reducer unit tests
- `src/components/calculator/coverageGaps.test.tsx` (new) - 10 targeted tests closing shipping-carrier and pricing-seed-fallback coverage gaps
- `src/components/CostCalculator.tsx` (modified) - orchestrator now consumes both hooks; sessionStorage persistence effect lifted here; pricing field `onChange` handlers dispatch reducer actions; `clearFormAndPricing()` combines `clearForm()` + `RESET` dispatch
- `src/components/CostCalculator.test.tsx` (modified) - 4 obsolete PERF-11 source-contract tests retired with an explanatory pointer to the new location and the Plan 01 equivalence gate
- `src/components/calculator/renderCount.test.tsx` (modified) - assertion tightened from conditional 1-or-3 to unconditional `=== 1`
- `vitest.config.ts` (modified) - `coverage.include` widened to add `useCostDerivedValues.ts`

## Decisions Made

- **Pricing state ownership handoff (Task 1 → Task 2):** Task 1's interfaces spec listed `profitMarginPercent`/`targetProfit`/`sellingPrice`/`lastEdited` as part of `useCostForm`'s ~19 fields (satisfied verbatim in the Task 1 commit). Task 2's action text is explicit that the reducer must own this slice (`Return { ..., pricing: {...}, dispatchPricing }`), so Task 2 moved it out of `useCostForm` into `useCostDerivedValues`. This is the plan's own designed sequencing, not a deviation.
- **sessionStorage persistence lifted to the orchestrator, not bridged via ref:** An initial implementation kept the single persistence effect inside `useCostForm` and bridged `useCostDerivedValues`' `pricing` output back in via a `useRef` (since the two hooks have a one-render circular need for each other's output). This tripped the `react-hooks/refs` ESLint rule (`Cannot access ref value during render` / `Cannot update ref during render`) — a real safety issue, not a false positive, since reading/writing a ref during render is unsafe under concurrent rendering and React's own docs flag it. Resolved by moving the single `sessionStorage.setItem` persistence effect into `CostCalculator.tsx` itself, which naturally has both hooks' outputs in the same render with no ordering conflict. `useCostForm` now exposes a plain `nonPricingFormState` object (no effect) that the orchestrator merges with `useCostDerivedValues`' `pricing` snapshot.
- **SEED_FROM_JOB rebases against current trueCost inline:** Caught by the Plan 01 equivalence gate. The initial reducer design had `SEED_FROM_JOB` naively seed `sellingPrice`/`targetProfit`/`profitMarginPercent` from the job's saved cost basis, relying on a separately-dispatched `RECALC` (keyed on `[trueCost, fee]`) to rebase against the current cost. This failed for scenario sequences where `trueCost` happened to be unchanged between two consecutive `editingJob` values with different saved bases but the same printer/materials configuration — React skipped re-running `RECALC` (unchanged deps), leaving the naive (uncorrected) seed value rendered. Fixed by having `SEED_FROM_JOB` itself call `marginFromPrice(trueCost, action.sellingPrice, fee)` immediately, matching the `RECALC`/`lastEdited: 'price'` branch's math inline — eliminating the race entirely rather than trying to force the effect to re-fire.
- **4 PERF-11 source-contract tests retired, not ported:** These tests asserted exact source-code string literals of the pre-split two-effect implementation (e.g. `}, [trueCost, lastEdited, ...])`, `lastEdited === 'margin'` as literal substrings of `CostCalculator.tsx`). Since that implementation moved entirely into `useCostDerivedValues.ts` and was replaced by a different pattern (a reducer, no literal `lastEdited === 'margin'` comparison), porting these assertions to check the new file would just re-encode an implementation detail as a test. 38-PATTERNS.md flagged this exact decision as "Claude's Discretion" for the planner/implementer; retirement was chosen because Plan 01's mount-based equivalence (`outputEquivalence.test.tsx`), sequence (`pricingSequence.test.tsx`), and render-count (`renderCount.test.tsx`) tests cover the same regression class more rigorously (real DOM behavior, not source strings).
- **Two-pass cost computation to resolve reducer-construction ordering:** `useReducer`'s reducer-function argument needs the CURRENT render's `trueCost`/fee shape to compute pricing derivations correctly, but the full `CostBreakdown` (`costs`) needs `pricing.profitMarginPercent`/`targetProfit`/`sellingPrice` as pass-through display fields. Rather than accepting a stale-by-one-render `trueCost` in the reducer, `costsForTrueCost` is computed first with placeholder `0` pass-through values (verified these never affect `failureAdjusted`/`printerDepreciation`/`nozzleWear` — confirmed by reading `costCalc.ts`), giving an accurate `trueCostForReducer` before the `useReducer` call; the real, pricing-inclusive `costs` is computed afterward using the reducer's actual output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a real pricing-desync bug the equivalence gate caught (SEED_FROM_JOB not rebasing against current trueCost)**
- **Found during:** Task 2, first full run of the Plan 01 equivalence gate
- **Issue:** The output-equivalence snapshot diffed on multiple scenarios — `netMargin`/`netProfit` showed the NAIVE (uncorrected) saved-job margin instead of the trueCost-rebased value the pre-split component produced. Root cause: `SEED_FROM_JOB` seeded `sellingPrice` from the job but relied on a separately-dispatched `RECALC` effect (keyed on `[trueCost, fee]`) to rebase profit/margin — and that effect's dep array could be unchanged between two consecutive scenarios with different saved cost bases but the same printer/material config, so React skipped re-running it.
- **Fix:** `SEED_FROM_JOB`'s reducer branch now calls `marginFromPrice(trueCost, action.sellingPrice, fee)` immediately and returns the rebased profit/margin, eliminating the race.
- **Files modified:** `src/hooks/useCostDerivedValues.ts`
- **Verification:** Re-ran the full equivalence gate (120 scenarios) — byte-for-byte match restored; added explicit reducer unit-test coverage for `SEED_FROM_JOB` bypassing the `trueCost<=0` guard.
- **Committed in:** `00cda9d` (Task 2 — caught and fixed before commit, folded into the single Task 2 commit)

**2. [Rule 1 - Bug] Fixed a ref-access-during-render violation in the initial hook-ordering bridge**
- **Found during:** Task 2, eslint pass after first wiring `CostCalculator.tsx`
- **Issue:** An initial design bridged `useCostDerivedValues`' `pricing` output back into `useCostForm`'s persistence effect via a `useRef` read/write during render (`pricingSnapshotRef.current`), to resolve the two hooks' one-render circular dependency. ESLint's `react-hooks/refs` rule flagged both the read and the write as unsafe (`Cannot access/update ref value during render`) — correctly, since this is unsafe under concurrent rendering, not a stylistic nag.
- **Fix:** Removed the ref bridge entirely. `useCostForm` no longer owns the sessionStorage persistence effect — it exposes a plain `nonPricingFormState` object; `CostCalculator.tsx` (which calls both hooks and has both outputs in the same render) owns the single `sessionStorage.setItem` effect that merges them.
- **Files modified:** `src/hooks/useCostForm.ts`, `src/components/CostCalculator.tsx`
- **Verification:** `npx eslint` clean; `pricingSequence.test.tsx` (Plan 01 sequence tests exercising sessionStorage-adjacent state) still green.
- **Committed in:** `00cda9d` (Task 2 — caught and fixed before commit)

**3. [Rule 3 - Blocking] Retired 4 obsolete PERF-11 source-contract tests that asserted eliminated implementation strings**
- **Found during:** Task 2, full-suite run after wiring the reducer
- **Issue:** `CostCalculator.test.tsx`'s "Pricing useEffect deps (PERF-11 revert)" describe block asserted exact source-string literals of the two-effect implementation Task 2's own mandate eliminates (e.g. `}, [trueCost, lastEdited, ...])`, `lastEdited === 'margin'`). These now fail correctly since the implementation legitimately moved to a different file with a different pattern.
- **Fix:** Retired the 4 assertions with an explanatory comment block documenting where the equivalent (stronger) coverage now lives (`useCostDerivedValues.test.ts`, `pricingSequence.test.tsx`, `renderCount.test.tsx`). Per 38-PATTERNS.md's explicit "Claude's Discretion" flag for this exact decision.
- **Files modified:** `src/components/CostCalculator.test.tsx`
- **Verification:** Full suite green (852/852); the retired tests' regression-guard intent is superseded by Plan 01's stronger mount-based gate.
- **Committed in:** `00cda9d` (Task 2)

**4. [Rule 3 - Blocking] Added targeted coverage-gap tests to satisfy the newly-gated coverage thresholds**
- **Found during:** Task 2, after widening `vitest.config.ts` coverage.include per Assumption A2
- **Issue:** `npx vitest run --coverage` (part of `npm run build`) failed the 95%/100%/90% thresholds once `useCostDerivedValues.ts` was added to `coverage.include` — several `shippingCost` carrier-switch branches (fedex/dhl/purolator/usps/royal_mail/australia_post/canada_post, custom-carrier match, and the unmatched-fallback-to-0 branch) and the "editingJob exists but has no saved cost basis yet" pricing-seed fallback weren't exercised by the existing golden-scenario fixtures.
- **Fix:** Added `src/components/calculator/coverageGaps.test.tsx` — 10 small, targeted component-mount tests closing exactly these gaps, rather than expanding the shared `goldenScenarios.ts` fixture set (scoped to D-01 output-equivalence, not general branch coverage).
- **Files modified:** `src/components/calculator/coverageGaps.test.tsx` (new)
- **Verification:** `npx vitest run --coverage` now passes all three thresholds (97.3% branches... final: lines 98.59%, functions 100%, branches 92.55%).
- **Committed in:** `00cda9d` (Task 2)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking). All within Rules 1-3 — no architectural changes, no user decision required.
**Impact on plan:** All four were necessary to make the reducer correct and to satisfy the plan's own coverage-tracking mandate (Assumption A2). No scope creep beyond Task 2's stated deliverables.

## Issues Encountered

None beyond the deviations documented above. The hook-ordering puzzle (reducer needs `trueCost`, `trueCost`'s computation needs pricing pass-through fields) required careful reasoning and one direct empirical test (verifying React's reducer-function-argument re-read behavior) before landing on the two-pass `costsForTrueCost`/`costs` split — documented inline in `useCostDerivedValues.ts` for future maintainers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FOUND-01 (verbatim extraction) and FOUND-02 (useReducer PERF-11 fix) are both fully satisfied for this plan's scope.
- `CostCalculator.tsx` is now wired to consume `useCostForm` + `useCostDerivedValues`; its JSX and external prop contract are UNCHANGED (per plan scope — the section-component split is Plan 04's job).
- Plan 04 can proceed to extract `CostFormSection`/`CostParametersSection`/`ShippingSection`/`PricingSection`/`CostSummaryPanel` from the now-slimmer orchestrator, consuming the same two hooks' outputs as props.
- The Plan 01 equivalence/sequence/render-count gate remains green and is now a stronger regression guard than before (render-count tightened to `=== 1`).
- No blockers for Plan 04.

---
*Phase: 38-foundation*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created files verified present on disk:
- `src/hooks/useCostForm.ts` — FOUND
- `src/hooks/useCostDerivedValues.ts` — FOUND
- `src/hooks/useCostDerivedValues.test.ts` — FOUND
- `src/components/calculator/coverageGaps.test.tsx` — FOUND
- `.planning/phases/38-foundation/38-03-SUMMARY.md` — FOUND

All task commits verified present in git history:
- `529ced2` (Task 1) — FOUND
- `00cda9d` (Task 2) — FOUND
