---
phase: 38-foundation
fixed_at: 2026-07-05T21:26:42Z
review_path: .planning/phases/38-foundation/38-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 38: Code Review Fix Report

**Fixed at:** 2026-07-05T21:26:42Z
**Source review:** .planning/phases/38-foundation/38-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (fix_scope: critical_warning — 1 Critical + 6 Warnings; 6 Info findings out of scope)
- Fixed: 7
- Skipped: 0

**Final verification gate (all green):**
- `npx vitest run` — 70 files, 855 passed, 1 todo, 0 failures (includes the byte-for-byte output-equivalence snapshot oracle, unchanged)
- `npx tsc -b` — 0 errors
- `npx eslint .` — 0 errors, 21 warnings (identical to pre-fix baseline; no new warnings introduced — `src/hooks/useCostDerivedValues.ts` is now warning-free)

## Fixed Issues

### CR-01: Pricing reducer silently discards Margin/Profit/Price input while trueCost <= 0

**Status:** fixed: requires human verification (logic fix — please confirm the type-price-first flow manually)
**Files modified:** `src/hooks/useCostDerivedValues.ts`, `src/hooks/useCostDerivedValues.test.ts`, `src/components/calculator/pricingSequence.test.tsx`
**Commit:** 7b84ea0
**Applied fix:** Replaced the blanket `if (trueCost <= 0) return state;` guard with per-case fallbacks exactly as the review prescribed: `EDIT_MARGIN`/`EDIT_PROFIT`/`EDIT_PRICE` now store the edited field + `lastEdited` (skipping only the derivation) when `trueCost <= 0`; only `RECALC` keeps the full guard. Verified against the pre-split contract at `05677f2:src/components/CostCalculator.tsx` (onChange setters were unconditional; only the derivation effect was guarded). Rewrote the unit tests that locked in the wrong behavior (they now assert the value-stored/derivation-skipped contract for all three EDIT actions), and added the review-requested interaction test to `pricingSequence.test.tsx`: types $25 into Selling Price on a fresh form (trueCost 0), asserts the controlled input retains it, asserts it reaches sessionStorage (`sellingPrice: 25`, `lastEdited: 'price'`), then seeds print time and asserts profit/margin are derived FROM the typed price.

### WR-01: Reducer fee shape permanently the sellingPrice:0 decomposition — Facebook-shipped min-fee floor never modeled

**Status:** fixed: requires human verification (logic fix — please spot-check a facebook_shipped sale below ~$8: Net Profit/Net Margin should now agree with the floor-aware Platform Fee tile)
**Files modified:** `src/hooks/useCostDerivedValues.ts`
**Commits:** 21c91da, 7b25a7a (lint-clean amendment)
**Applied fix:** The review's primary option — the pre-split `feeShapeRef` pattern. `createPricingReducer` now accepts `FeeShape | (() => FeeShape)` (resolved at invocation time, so the existing unit-test call sites are unchanged); the hook passes `() => feeShapeRef.current`, and the ref is kept in lockstep with the real, floor-aware `marketplaceFeeParts`. Deleted the bootstrap `feeShapeForReducer` useMemo and the false "never leaks" comment. Amendment 7b25a7a: the ref assignment lives in a `useEffect` declared before the RECALC effect (rather than a render-body write) so discarded renders can't leak into the ref and the new `react-hooks/refs` lint warning is avoided; the one inherent getter warning carries a justified targeted `eslint-disable-next-line`. Semantics match pre-split: the reducer reads the last committed decomposition, and the RECALC effect (keyed on pct/fixed) converges immediately on shape changes. The equivalence snapshot is byte-identical after this change (Etsy shapes are price-independent; no fixture prices below the FB floor), as the review predicted.

### WR-02: sessionStorage persistence effect fired on every render

**Files modified:** `src/hooks/useCostForm.ts`
**Commit:** 0470a3a
**Applied fix:** Wrapped `nonPricingFormState` in `useMemo` keyed on all 19 constituent fields (the review's exact fix), restoring the pre-split behavior of one `JSON.stringify` + `sessionStorage.setItem` per actual field change instead of per render. Comment updated to explain the identity contract.

### WR-03: All five section memo() wrappers inert

**Files modified:** `src/components/calculator/CostFormSection.tsx`, `src/components/calculator/CostParametersSection.tsx`, `src/components/calculator/ShippingSection.tsx`, `src/components/calculator/PricingSection.tsx`, `src/components/calculator/CostSummaryPanel.tsx`
**Commit:** 752bf72
**Applied fix:** Took the review's explicitly lower-risk option: removed the `memo()` wrappers (and now-unused `memo` imports) from all five sections, converting each back to a plain `export function`. Zero behavior change (the wrappers never bailed — `form`/`derived`/`ids`/inline-lambda props defeated shallow compare on every render); the code no longer advertises an optimization that does not exist. `renderCount.test.tsx`'s `=== 1` commit assertion is unaffected (it counts commits, not bailed subtrees) and still passes.

### WR-04: Re-clicking the active tab pushed duplicate history entries

**Status:** fixed: requires human verification (behavioral fix — please confirm Back still retraces tab switches and a re-click adds no entry)
**Files modified:** `src/App.tsx`
**Commit:** bbeeb6a
**Applied fix:** Added the review's no-op guard to `navigateToTab`: `if (tab === activeTab && !options?.replace) return;` with `activeTab` added to the useCallback deps — matching the pre-split `setState`-to-same-value no-op. Replace-mode calls (D-07 invalid-param cleanup, A3 edit-nav) pass through untouched since they never grow the history stack. The review's separate suggestion of `replace: true` for arrow-key roving activation was NOT applied — it is flagged as a D-05 decision amendment, which is out of scope for a fixer (documented here for the phase owner). All 6 `App.test.tsx` tab tests pass.

### WR-05: Output-equivalence oracle scenarios are order-coupled

**Files modified:** `src/components/calculator/outputEquivalence.test.tsx`, `src/components/calculator/__fixtures__/goldenScenarios.ts`
**Commit:** e945fdb
**Applied fix — judgment call, deliberately NOT the remount option:** The review's primary fix (unmount/remount per scenario) requires re-capturing the snapshot baseline against the pre-split component at the diff base — every per-scenario entry would change, and I cannot re-verify ~120 re-captured values against `05677f2`'s component from this session without rebuilding the deleted pre-split component. Blindly remounting + `--update`ing the snapshot would destroy the phase's correctness oracle. I applied the review's sanctioned alternative instead: loud, mirrored FROZEN-ORDER warning blocks in both the test and the fixture header, spelling out (a) why entries carry state forward (populate effect skips `undefined` job fields), (b) that per-scenario values do not mean "this fixture in isolation", and (c) that any reorder/insert/remove — or a switch to per-scenario remounts — REQUIRES re-capturing the baseline against `05677f2:src/components/CostCalculator.tsx` in a dedicated, auditable commit. Note vitest's snapshot serialization is key-order-sensitive, so a reorder already fails loudly; the documentation exists to stop the failure being "fixed" with a casual `--update`. **Follow-up recommended:** do the remount + fresh baseline re-capture as its own auditable task when someone can run the pre-split component side-by-side.

### WR-06: sessionStorage leaked between component-mount tests

**Files modified:** `src/components/calculator/coverageGaps.test.tsx`, `src/components/calculator/pricingSequence.test.tsx`, `src/components/calculator/outputEquivalence.test.tsx`, `src/components/calculator/renderCount.test.tsx`
**Commit:** dc65b2b
**Applied fix:** Added `sessionStorage.clear()` to the shared `beforeEach` in all four component-mount test files in the directory (the review named coverageGaps + pricingSequence; outputEquivalence and renderCount got the same treatment for consistency — `CostCalculator.test.tsx` is source-string-only and mounts nothing). The coverageGaps test that pre-seeds sessionStorage itself does so after `beforeEach`, so it is unaffected. Full directory suite passes with tests now order-decoupled.

## Skipped Issues

None — all 7 in-scope findings were fixed.

## Notes for the orchestrator

- 8 commits total (`fix(38): CR-01 …` through `fix(38): WR-01 lint-clean …`); WR-01 spans two commits (primary fix + lint-clean amendment).
- Info findings (IN-01 … IN-06) were out of scope (`fix_scope: critical_warning`) and remain open.
- The three findings marked "requires human verification" all have automated tests asserting the corrected behavior, but they change runtime logic that snapshot/syntax verification cannot semantically prove — a quick manual pass of (1) type-price-first flow, (2) low-price facebook_shipped margin agreement, (3) tab re-click/Back behavior is recommended before the phase verifier signs off.

---

_Fixed: 2026-07-05T21:26:42Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
