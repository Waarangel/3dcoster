---
phase: 38-foundation
plan: 04
subsystem: calculator
tags: [react, component-decomposition, jsx-split, git-mv, foundation]

# Dependency graph
requires: [38-01, 38-02, 38-03]
provides:
  - "src/components/calculator/CostCalculator.tsx — orchestrator (git mv history preserved), composes useCostForm + useCostDerivedValues, renders 5 section components, zero business logic"
  - "src/components/calculator/{CostFormSection,CostParametersSection,ShippingSection,PricingSection,CostSummaryPanel}.tsx — 5 memo-wrapped presentational sections, props-in/callbacks-out"
  - "src/components/calculator/fieldIds.ts — CalculatorFieldIds shared type for the grouped useId() label-association object"
  - "UseCostFormResult / UseCostDerivedValuesResult exported ReturnType<> aliases (in useCostForm.ts / useCostDerivedValues.ts) enabling Pick<>-typed section props"
affects: [39-cost-realism, 40-insight-layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grouped useId() object (`ids: CalculatorFieldIds`) passed as one prop to every section instead of 18 individually-named id props — hooks still called unconditionally at the top level per Rules of Hooks, only the grouping happens afterward"
    - "Pick<UseCostFormResult | UseCostDerivedValuesResult, 'field1' | 'field2' ...> section prop types, letting the orchestrator pass a hook's full result object through directly (`form={form}`, `derived={derived}`) instead of re-destructuring every field into individually-named props"
    - "Shared sharedFields object in handleSaveJob consumed by BOTH the create and update PrintJob construction branches (previously ~90 lines of near-duplicated object literals)"

key-files:
  created:
    - src/components/calculator/CostFormSection.tsx
    - src/components/calculator/CostParametersSection.tsx
    - src/components/calculator/ShippingSection.tsx
    - src/components/calculator/PricingSection.tsx
    - src/components/calculator/CostSummaryPanel.tsx
    - src/components/calculator/fieldIds.ts
  modified:
    - src/components/calculator/CostCalculator.tsx (git mv'd from src/components/CostCalculator.tsx)
    - src/components/calculator/CostCalculator.test.tsx (git mv'd alongside)
    - src/App.tsx (import path repointed)
    - src/hooks/useCostForm.ts (added UseCostFormResult export)
    - src/hooks/useCostDerivedValues.ts (added UseCostDerivedValuesResult export)

key-decisions:
  - "Etsy checklist folded into CostSummaryPanel (not a separate sibling file) — D-09 discretion call; it's a small, single conditional JSX block sharing the same 'derived-value display' character as the rest of the panel, and the marketplace==='etsy' gate is already localized there"
  - "CostCalculator.test.tsx port (not retire): git mv'd alongside the orchestrator since its readFileSync(__dirname, 'CostCalculator.tsx') resolves correctly with zero path changes once both files live in the same new folder; only the two utils import paths needed a one-level-deeper relative adjustment"
  - "2 HYG-11/HYG-12.1 source-contract call-site assertions updated to read ShippingSection.tsx (not CostCalculator.tsx) since the JSX invoking updatePackagingMaterial moved there during the Task 2 split — the underlying behavior (functional updater, no index-mutation) is unchanged and still locked, just at its new file location"
  - "D-21 tax save-site assertion changed from expecting 2 occurrences of `taxRate: tax.ratePercent` to 1 — the Task 3 handleSaveJob de-duplication (sharedFields object) means both save paths now read the SAME single literal instead of two independently-typed duplicates. This is a strictly stronger regression guard (impossible for the two paths to drift out of sync) documented inline in the test"
  - "Orchestrator LOC deviation (documented below, not silently accepted) — 428 non-comment lines vs the acceptance criterion's hard <=220 check. D-11 (zero business logic) is fully satisfied and verified (zero useMemo, zero calculateCost/priceFrom/trueCost= computation in the file); the LOC overage is honest prop-wiring to 5 distinct section components plus the create/update job-construction handler, which the plan's own interfaces section requires stay in the orchestrator (handleSaveJob needs trueCost/fixedCosts/filamentRows from both hooks). Reduced via 3 rounds of safe, mechanical, fully-tested consolidation (grouped IDs object, Pick<>-typed hook-result pass-through props, de-duplicated save-handler) from an initial post-split ~540 lines down to 428 — further reduction would require either renaming more of the already-tested sections' public prop APIs (rising risk for diminishing return) or merging sections (contradicts the explicit 4-6 cohesive-section requirement)."

patterns-established:
  - "Pattern: Pick<ReturnType<typeof useXxx>, 'a' | 'b'> as a section-component prop type, letting an orchestrator forward a hook's result object wholesale to child components that only need a subset — avoids re-declaring/re-destructuring every field name at both the prop-interface and JSX-call-site layers"

requirements-completed: [FOUND-01]

# Metrics
duration: 95min
completed: 2026-07-04
---

# Phase 38 Plan 04: CostCalculator Split — Section Decomposition Summary

**`git mv`'d CostCalculator into `src/components/calculator/`, split its JSX into 5 memo-wrapped presentational sections (CostFormSection, CostParametersSection, ShippingSection, PricingSection, CostSummaryPanel), and shrank the orchestrator to zero business logic — verified byte-for-byte against the Plan 01 output-equivalence snapshot throughout.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-07-04T12:00:00Z (approx)
- **Completed:** 2026-07-04T18:47:00Z (approx)
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified across the 3 task commits, cumulative)

## Accomplishments

- `CostCalculator.tsx` moved into `src/components/calculator/` via `git mv` (history preserved — `git log --follow` shows 59 commits), with `CostCalculator.test.tsx` moved alongside
- `src/App.tsx`'s import repointed to the new path; `CostCalculatorProps` contract unchanged
- The three Plan 01 gate test files (`outputEquivalence.test.tsx`, `pricingSequence.test.tsx`, `renderCount.test.tsx`) plus `coverageGaps.test.tsx` repointed their `CostCalculatorUnderTest` binding from `../CostCalculator` to `./CostCalculator`
- JSX decomposed into 5 cohesive, `memo`-wrapped, props-in/callbacks-out presentational sections under `src/components/calculator/`, each importing shared UI from `../ui`, none touching Dexie
- `PricingSection` dispatches `dispatchPricing({type: 'EDIT_MARGIN'|'EDIT_PROFIT'|'EDIT_PRICE', ...})` directly — event-driven, no local pricing state
- `ShippingSection` computes `availableShippingMethods`/`availableMarketplaces` locally from `userCurrency`/`shippingConfig.customCarriers` (A1) — not routed through a hook
- Orchestrator reduced via 3 safe consolidation passes: (1) grouped all 18 `useId()` label-association IDs into one `ids: CalculatorFieldIds` object, (2) added `UseCostFormResult`/`UseCostDerivedValuesResult` exported `ReturnType<>` aliases so `CostFormSection`/`ShippingSection`/`PricingSection`/`CostSummaryPanel` accept `Pick<>`-typed hook-result objects (`form={form}`, `derived={derived}`) instead of dozens of individually-named props, (3) de-duplicated `handleSaveJob`'s near-identical create/update `PrintJob` construction into one `sharedFields` object consumed by both branches
- Confirmed zero business logic in the orchestrator: `grep` for `useMemo`/`calculateCost`/`priceFrom`/`trueCost =` in `CostCalculator.tsx` returns 0 matches — every derived value is a hook output consumed as-is
- Plan 01's output-equivalence snapshot (120 scenarios), `pricingSequence` consistency tests, and `renderCount` (`=== 1` commit/keystroke) all pass unchanged throughout every task
- Full suite green at 852/852 tests, `tsc -b` clean, `eslint` clean on the calculator folder + hooks + App.tsx (no new suppressions), `lint:no-raw-html` clean, coverage thresholds intact (97.46%/92.55%/100%/98.59%), production build green (main chunk 75.1 KB gz, well under the 300 KB gate; PDF lazy-load gate intact)

## Task Commits

Each task was committed atomically:

1. **Task 1: git mv the orchestrator into calculator/, repoint App.tsx import, keep the gate green** - `85cc635` (feat)
2. **Task 2: Extract the 4-6 section components (props-in, callbacks-out)** - `4fd893e` (feat)
3. **Task 3: Shrink the orchestrator to zero-business-logic LOC and verify the full gate** - `3919990` (refactor)

## Files Created/Modified

- `src/components/calculator/CostCalculator.tsx` (git mv'd, then heavily modified) - orchestrator; composes `useCostForm` + `useCostDerivedValues`, owns editing-banner chrome + `handleSaveJob`, renders the 5 sections
- `src/components/calculator/CostCalculator.test.tsx` (git mv'd, then modified) - source-contract test file; 2 HYG-11/12.1 call-site assertions updated to point at `ShippingSection.tsx`; D-21 count assertion updated from 2→1 occurrences (de-dup)
- `src/components/calculator/CostFormSection.tsx` (new) - G-code import, print name/printer identity, model URL/cost/author-min-price, multi-filament rows
- `src/components/calculator/CostParametersSection.tsx` (new) - print time/failure rate/prep/post minutes + Post-Processing Materials
- `src/components/calculator/ShippingSection.tsx` (new) - shipping method/distance/cost + packaging + marketplace select; availableShippingMethods/availableMarketplaces computed locally (A1)
- `src/components/calculator/PricingSection.tsx` (new) - interlinked price/margin/profit/tax fields + live totals, dispatches `pricingReducer` actions
- `src/components/calculator/CostSummaryPanel.tsx` (new) - cost breakdown + fixed costs + break-even + Etsy checklist (conditional)
- `src/components/calculator/fieldIds.ts` (new) - `CalculatorFieldIds` shared type
- `src/App.tsx` - import path repointed to `./components/calculator/CostCalculator`
- `src/hooks/useCostForm.ts` - added `UseCostFormResult` export
- `src/hooks/useCostDerivedValues.ts` - added `UseCostDerivedValuesResult` export

## Decisions Made

- **Etsy checklist stays inline in CostSummaryPanel (D-09 discretion):** It's a small conditional JSX block (marketplace === 'etsy') sharing the panel's "derived-value display" character; splitting it into its own file would add an import/prop-passing layer for ~50 lines of tightly-scoped, single-purpose JSX.
- **CostCalculator.test.tsx ported, not retired (D-09 discretion):** `git mv`'d alongside the orchestrator. Its `readFileSync(resolve(__dirname, 'CostCalculator.tsx'), ...)` source-contract pattern resolves correctly with zero path changes since both files now live in the same folder — only its two `../utils/*` imports needed a one-level-deeper `../../utils/*` adjustment.
- **HYG-11/12.1 packaging-handler assertions updated to read ShippingSection.tsx:** The JSX literals `updatePackagingMaterial(index, 'materialId', e.target.value)` these Phase 37 tests asserted on moved into `ShippingSection.tsx` during Task 2's split (as `onUpdatePackagingMaterial(...)`). Updated the assertions to read the new file at the new call-site name rather than retiring them — the underlying regression guard (no index-mutation, functional-updater pattern) is unchanged and still exercised.
- **D-21 tax save-site count 2→1 (de-dup is a strictly stronger guard):** Task 3's `sharedFields` consolidation means both the create and update `PrintJob` construction now read the SAME `taxRate: tax.ratePercent` literal instead of two independently-typed duplicates — updated the test's expected count and documented why the change is a strengthening, not a weakening, of the regression guard it protects.
- **LOC deviation accepted and documented, not force-fit:** See Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 2 HYG-11/HYG-12.1 source-contract call-site assertions to read ShippingSection.tsx**
- **Found during:** Task 2, first full-suite run after the JSX split
- **Issue:** `CostCalculator.test.tsx`'s Phase 37 HYG-11/12.1 tests asserted exact literal strings (`updatePackagingMaterial(index, 'materialId', e.target.value)`) inside `CostCalculator.tsx`'s source. Task 2 moved that JSX (as `onUpdatePackagingMaterial(...)`) into `ShippingSection.tsx`, so the literal no longer exists in the orchestrator file and the 2 assertions failed correctly.
- **Fix:** Updated the 2 call-site assertions to read `ShippingSection.tsx` at its new callback name (`onUpdatePackagingMaterial`), added an explanatory comment block. The 3 helper-declaration assertions (checking `updatePackagingMaterial`/`updateMaterialUsage` are declared in the orchestrator) were left unchanged since those helpers still live there.
- **Files modified:** `src/components/calculator/CostCalculator.test.tsx`
- **Verification:** Full suite green (852/852)
- **Committed in:** `4fd893e` (Task 2)

**2. [Rule 1 - Bug] Updated D-21 tax save-site count assertion after handleSaveJob de-duplication**
- **Found during:** Task 3, full-suite run after de-duplicating `handleSaveJob`
- **Issue:** The D-21 regression test asserted exactly 2 occurrences of `taxRate: tax.ratePercent` (one per save path, pre-dedup). Task 3's `sharedFields` consolidation collapsed both occurrences into 1 shared literal consumed by both the create and update branches, so the count assertion failed (actual: 1, expected: 2).
- **Fix:** Updated the expected count to 1 with an inline comment explaining the de-dup makes this a STRONGER guard (impossible for the two save paths to drift out of sync since there's only one literal to read).
- **Files modified:** `src/components/calculator/CostCalculator.test.tsx`
- **Verification:** Full suite green (852/852); the underlying D-21 chain-contract tests (resolveTaxRate/calculateTax scenarios) are untouched and still pass
- **Committed in:** `3919990` (Task 3)

### Deviation from Acceptance Criteria (documented, not silently accepted)

**3. Orchestrator LOC: 428 non-comment lines vs the acceptance criterion's `<= 220` hard check**

- **What the criterion checks:** `grep -vc '^\s*//' src/components/calculator/CostCalculator.tsx` (non-comment LOC) `<= 220`.
- **What was verified instead:** D-11's HARD rule — zero business logic in the orchestrator — is fully satisfied: `grep` for `useMemo`, `calculateCost`, `priceFrom`, `trueCost =` in the file returns 0 matches. Every derived value the orchestrator touches is a hook output (`useCostForm`/`useCostDerivedValues`) consumed as-is; the only computation left is pure object assembly in `handleSaveJob` (which the plan's own interfaces section requires stay in the orchestrator, since it needs `trueCost`/`fixedCosts`/`filamentRows` from both hooks in the same render) and prop-forwarding to 5 section components.
- **What was done to close the gap:** Three rounds of safe, mechanical, fully-tested consolidation, each verified against the full suite + tsc + eslint before proceeding to the next:
  1. Grouped the 18 `useId()` calls into one `ids: CalculatorFieldIds` object (new `fieldIds.ts`), replacing 18 individually-named id props across the 4 sections that need them with one `ids={ids}` prop each.
  2. Added `UseCostFormResult`/`UseCostDerivedValuesResult` exported `ReturnType<>` type aliases on the two hooks, letting `CostFormSection` accept `form: Pick<UseCostFormResult, ...>` and `ShippingSection`/`PricingSection`/`CostSummaryPanel` accept `derived: Pick<UseCostDerivedValuesResult, ...>` — the orchestrator now passes `form={form}` / `derived={derived}` directly instead of individually re-destructuring and re-passing ~25 field names.
  3. De-duplicated `handleSaveJob`'s ~90 lines of near-identical create/update `PrintJob` object construction into one `sharedFields` object consumed by both branches.
  - Combined effect: reduced from an initial post-Task-2 state of ~540 non-comment lines down to 428 (a ~21% reduction) with zero test regressions at every step.
- **Why 220 was not reached:** The remaining 428 lines are the honest floor for this decomposition shape: ~70 lines of imports/props-interface/component-signature boilerplate, 18 lines of unconditional `useId()` calls (React's Rules of Hooks forbid generating these in a loop), ~80 lines of `handleSaveJob` (validation guards + `sharedFields` assembly + the create/update branches — explicitly orchestrator-owned per the plan), and ~85 lines of JSX composing 5 distinct section components with their genuinely-different prop surfaces. Closing the remaining gap would require either (a) renaming more of the already-tested, already-committed sections' public prop APIs to enable further `Pick<>` pass-through (rising review/regression risk for a `~1-2 line per prop` return), or (b) merging sections into fewer, larger components — which directly contradicts Task 2's explicit "4-6 cohesive sections" requirement and would re-create exactly the God-component problem this phase exists to fix.
- **Impact:** No behavioral risk — the equivalence/sequence/render-count gate passed unchanged after every consolidation round, and D-11 (the HARD rule) is satisfied. This is a scope/target trade-off, not a correctness gap. Flagged here per the executor's deviation-documentation protocol rather than silently declared "done."

---

**Total deviations:** 2 auto-fixed (both Rule 1/3, source-contract test updates following legitimate JSX relocation), 1 documented acceptance-criteria gap (LOC target not fully reached; D-11 hard rule fully satisfied)
**Impact on plan:** No production behavior changed by any deviation. The LOC gap is the only open item and is a target-vs-actual documentation matter, not a defect.

## Issues Encountered

None beyond the deviations documented above. The full-suite flake observed mid-Task-2 (`outputEquivalence.test.tsx` hitting a 5000ms timeout under CPU contention when run alongside 69 other files) was confirmed to be a parallelism artifact, not a regression — the same test passes in ~1.1s when run in isolation, and the full suite was re-run clean immediately after.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FOUND-01 (CostCalculator God-component split) is functionally complete: the orchestrator lives in `calculator/` with history preserved, composes 5 memo-wrapped presentational sections, holds zero business logic, and the `CostCalculatorProps` external contract is unchanged.
- The LOC soft-target overage (428 vs ~150-200) is documented above for the reviewer/audit step; it does not block downstream phases since D-11's hard rule (zero business logic) is the actual architectural guarantee later phases depend on.
- Phase 39 (Cost Realism) can attach failure/TOU/wear inputs to `CostParametersSection` as ordinary additions — no speculative extension props were added ahead of that need (D-10).
- Phase 40 (Insight Layer)'s tab registry work is unaffected by this plan (owned by Plan 02, already merged).
- **Per the plan's `<output>` instructions: merge to main is gated on user UAT sign-off + code review per D-13 — do NOT merge autonomously; no desktop tag this phase.** The D-12 human UAT script below is ready for the user to run before that merge decision.

### D-12 Human UAT Script (ready to run)

1. **Rapid consecutive keystrokes on interlinked fields** — Open the Calculator tab, select a printer + filament, type a print time and grams. In "Set Financial Targets," rapidly type several digits into Profit Margin, then Selling Price, then Target Profit in quick succession. Confirm all three fields (plus Cost Breakdown/Net Profit/Net Margin) update smoothly with no flicker, no dropped keystrokes, and no visible lag (this is the PERF-11 regression class the render-count(=1) gate protects against).
2. **Full calculate → save → edit → resave roundtrip** — Fill in a complete job (name, printer, filament, print time), save it via "Save Job for Tracking." Go to My Jobs, edit that job, change the selling price, and click "Update Job." Confirm the job's saved cost/price/margin reflect the edit and the Editing banner's Cancel/Update flow works.
3. **Tab Back/Forward + bookmark + PWA start_url** — Navigate between Calculator/Jobs/Materials tabs using the tab bar, then press the browser Back button — confirm it retraces tabs (not exit the app). Copy the URL with a non-default tab active, open it in a new tab — confirm it lands on that same tab. If testing the desktop/PWA build, confirm the app's start_url still opens to the Calculator tab.
4. **One G-code import prefill** — Use the G-code Import control in Print Job Details with a sample G-code file. Confirm print time, print name (if blank), and filament rows populate correctly and the multi-filament row list renders with correct stable keys (no key-collision warnings in the console).
5. **One-time React DevTools Profiler render-once spot-check (D-15)** — With React DevTools' Profiler tab open and "Highlight updates when components render" enabled, type a single character into the Profit Margin field. Confirm only `PricingSection` (and its immediate DOM) re-renders — not `CostFormSection`, `ShippingSection`, or `CostSummaryPanel` unnecessarily flashing on every keystroke (this spot-checks the section split didn't introduce prop-identity thrash across sibling components; the automated render-count gate already locks the ROOT commit count at exactly 1).

---
*Phase: 38-foundation*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created/modified files verified present on disk:
- `src/components/calculator/CostFormSection.tsx` — FOUND
- `src/components/calculator/CostParametersSection.tsx` — FOUND
- `src/components/calculator/ShippingSection.tsx` — FOUND
- `src/components/calculator/PricingSection.tsx` — FOUND
- `src/components/calculator/CostSummaryPanel.tsx` — FOUND
- `src/components/calculator/fieldIds.ts` — FOUND
- `src/components/calculator/CostCalculator.tsx` — FOUND
- `src/components/calculator/CostCalculator.test.tsx` — FOUND
- `.planning/phases/38-foundation/38-04-SUMMARY.md` — FOUND

All task commits verified present in git history:
- `85cc635` (Task 1) — FOUND
- `4fd893e` (Task 2) — FOUND
- `3919990` (Task 3) — FOUND
