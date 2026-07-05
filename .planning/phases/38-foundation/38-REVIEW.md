---
phase: 38-foundation
reviewed: 2026-07-05T01:47:23Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/App.test.tsx
  - src/App.tsx
  - src/components/calculator/CostCalculator.test.tsx
  - src/components/calculator/CostCalculator.tsx
  - src/components/calculator/CostFormSection.tsx
  - src/components/calculator/CostParametersSection.tsx
  - src/components/calculator/CostSummaryPanel.tsx
  - src/components/calculator/PricingSection.tsx
  - src/components/calculator/ShippingSection.tsx
  - src/components/calculator/__fixtures__/goldenScenarios.ts
  - src/components/calculator/__snapshots__/outputEquivalence.test.tsx.snap
  - src/components/calculator/coverageGaps.test.tsx
  - src/components/calculator/fieldIds.ts
  - src/components/calculator/outputEquivalence.test.tsx
  - src/components/calculator/pricingSequence.test.tsx
  - src/components/calculator/renderCount.test.tsx
  - src/hooks/useCostDerivedValues.test.ts
  - src/hooks/useCostDerivedValues.ts
  - src/hooks/useCostForm.ts
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-07-05T01:47:23Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the Phase 38 Foundation refactor: the `useCostForm` / `useCostDerivedValues` hook extraction (including the PERF-11 useReducer pricing interlink), the five-section split of `CostCalculator`, the tab-in-URL migration in `App.tsx`, and the equivalence/sequence/render-count test harness. Every claimed behavior-parity point was verified against the pre-split component at the diff base (`05677f2:src/components/CostCalculator.tsx`), not taken on faith.

The reducer redesign is largely sound — the per-render reducer recreation is a correct use of React's `useReducer` semantics, the SEED/RECALC interplay avoids the dependency-array race it documents, and the renderCount tightening to exactly 1 commit is legitimate. However, **two real behavior drifts from the pre-split component exist that the mount-time snapshot gate structurally cannot catch** (both are interaction-time, not mount-time): the reducer silently discards pricing-field input while `trueCost <= 0` (CR-01), and the reducer's fee shape is permanently the `sellingPrice: 0` decomposition, so the Facebook-shipped minimum-fee floor is never modeled in derivations (WR-01). This is exactly the failure class the project's own memory flags: "source-string/contract tests pass while logic regresses."

The tab-in-URL work is correct for the tested paths but introduces duplicate history pushes on active-tab re-clicks (WR-04). The section split itself introduced no math drift I could find — but all five `memo()` wrappers are inert (WR-03), and the orchestrator's persistence effect now fires on every render (WR-02), both quiet regressions from the pre-split wiring.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Pricing reducer silently discards user input into Margin/Profit/Price fields while trueCost <= 0 — behavior regression vs pre-split, with controlled-input desync

**File:** `src/hooks/useCostDerivedValues.ts:91` (guard), `src/components/calculator/PricingSection.tsx:58-95` (dispatch sites), `src/hooks/useCostDerivedValues.test.ts:158-171` (test locking the wrong behavior)

**Issue:** The reducer places `if (trueCost <= 0) return state;` *before* the `EDIT_MARGIN` / `EDIT_PROFIT` / `EDIT_PRICE` cases, so any keystroke into the three pricing fields is dropped entirely when the form has no cost basis yet (fresh form: no filament, no print time → `trueCost === 0`).

The pre-split component had a fundamentally different contract, verified at the diff base: the input's `onChange` called `setSellingPrice(...)` / `setProfitMarginPercent(...)` **unconditionally** and only the *derivation effect* was gated on `trueCost <= 0` (pre-split lines ~1435-1480 and the `if (trueCost <= 0) return;` at the top of the effect). So pre-split, a user could type "I want to sell this at $25" first, the value was stored, persisted to sessionStorage, and once costs were entered the effect derived margin/profit from the typed price (`lastEdited: 'price'`).

Post-split consequences for that same workflow:
1. The dispatch produces an identical state → React's eager-reducer bailout means **no re-render**; the DOM input keeps showing the typed "25" while component state remains `0` (controlled-input desync).
2. The typed value never reaches sessionStorage persistence.
3. When the user then enters print time (`trueCost > 0`), the next render snaps the price field back to empty and the RECALC effect derives from the stale `lastEdited` (typically `'margin'`, 30% default) — the typed price is silently lost and replaced by a derived one.

This is silent user-input loss in a plausible flow, invisible to the equivalence gate (mount-time only), invisible to `pricingSequence.test.tsx` (both sequences seed `trueCost > 0` before typing), and actively **locked in** by `useCostDerivedValues.test.ts` ("returns state unchanged for EDIT_MARGIN when trueCost is 0"), which codifies the drift rather than the pre-split contract.

**Fix:** For `EDIT_*` actions under `trueCost <= 0`, store the edited field and `lastEdited` without running the derivation (mirroring pre-split), e.g.:

```ts
// in pricingReducer, replace the blanket guard for EDIT_* with per-case fallbacks:
case 'EDIT_MARGIN': {
  if (trueCost <= 0) return { ...state, profitMarginPercent: action.value, lastEdited: 'margin' };
  const { price, netProfit } = priceFromMargin(trueCost, action.value, fee);
  ...
}
case 'EDIT_PROFIT': {
  if (trueCost <= 0) return { ...state, targetProfit: action.value, lastEdited: 'profit' };
  ...
}
case 'EDIT_PRICE': {
  if (trueCost <= 0) return { ...state, sellingPrice: action.value, lastEdited: 'price' };
  ...
}
// keep the guard for RECALC only.
```

Update the `trueCost<=0 guard` unit tests to assert the value-stored/derivation-skipped contract, and add a `pricingSequence` case that types a price *before* seeding print time.

### Warnings

#### WR-01: Reducer fee shape is permanently the `sellingPrice: 0` decomposition — Facebook-shipped min-fee floor never modeled; hook comment claiming "this bootstrapping value never leaks" is false

**File:** `src/hooks/useCostDerivedValues.ts:344-357` and `463-469`; `src/utils/marketplaceFee.ts:85-107`

**Issue:** `feeShapeForReducer` is computed with `sellingPrice: 0` (line 345) and is the shape passed to **every** reducer invocation — including the RECALC dispatched when the *real* `marketplaceFeeParts` changes. The comment (lines 340-343) claims the bootstrap value "never leaks into a rendered/persisted result" because RECALC re-fires off the real parts — but RECALC is *processed* with the bootstrap shape, not the real one, so re-firing cannot correct it.

For Etsy this is harmless (pct/fixed are price-independent). For `facebook_shipped` it is not: `computeMarketplaceFee` at `sellingPrice <= 0` returns `{ pctFees: 0.129, fixedFees: 0 }`, whereas when the $0.80 floor binds (price below ~$8 at default fees) the real decomposition is `{ pctFees: 0.029, fixedFees: minFee }`. The pre-split component read `feeShapeRef.current`, which was assigned from the **live, floor-aware** `marketplaceFeeParts` every render (pre-split lines 460-461, verified) — so pre-split derivations respected the floor; post-split they never do.

Observable drift: Facebook-shipped sale at $5 — displayed Platform Fee tile shows the floor-aware total ($0.95), while Net Profit / Net Margin (reducer state) are computed with a $0.645 fee. Targeting a 30% net margin on a low-cost item produces a price whose *actual* net margin is materially lower. The equivalence snapshot cannot catch this: no fixture prices below the floor (random scenarios seed $20-$100), and it's interaction-time anyway.

**Fix:** Feed the reducer the floor-aware shape. Simplest parity-preserving option is the pre-split pattern — a ref updated after `marketplaceFeeParts` is computed, read inside the reducer factory:

```ts
const feeShapeRef = useRef<FeeShape>({ pctFees: 0, fixedFees: 0 });
// after marketplaceFeeParts useMemo:
feeShapeRef.current = { pctFees: marketplaceFeeParts.pctFees, fixedFees: marketplaceFeeParts.fixedFees };
// reducer factory closes over feeShapeRef instead of feeShapeForReducer
```

Alternatively, solve the floor piecewise inside `pricingInterlink` (derive with the no-floor shape, check whether the floor binds at the resulting price, re-derive with the floor shape if so). Either way, delete or correct the "never leaks" comment, and delete `feeShapeForReducer` if it becomes unused.

#### WR-02: sessionStorage persistence effect fires on every render — `nonPricingFormState` is a fresh object literal each render

**File:** `src/components/calculator/CostCalculator.tsx:175-187`; `src/hooks/useCostForm.ts:161-181`

**Issue:** `nonPricingFormState` is assembled as a plain object literal on every `useCostForm` call, so its identity changes every render. The orchestrator's persistence effect deps it directly, meaning `JSON.stringify` + `sessionStorage.setItem` run on **every** CostCalculator render — including renders caused by unrelated prop changes (fxTable refresh, stock-event updates, parent re-renders), not just field edits. The pre-split effect depped each scalar field individually (verified at diff base, lines ~278-284) and only ran on actual changes. Functionally idempotent, but a quiet perf/dep-hygiene regression in the phase whose purpose is perf hygiene, and it makes the dep array dishonest in effect (deps that always differ).

**Fix:** Wrap the blob in `useMemo` keyed on its constituent fields inside `useCostForm`:

```ts
const nonPricingFormState = useMemo(() => ({ printName, filamentRows, /* ... */ etsyChecks }),
  [printName, filamentRows, selectedInstanceId, printTimeHours, modelCost, modelCostPerUnit,
   authorMinPrice, modelUrl, prepTimeMinutes, postProcessingMinutes, failureRate, materialsUsed,
   taxRateOverride, shippingMethod, shippingDistanceKm, shippingOverrideCost, packagingMaterials,
   marketplace, etsyChecks]);
```

#### WR-03: All five section `memo()` wrappers are inert — every prop path defeats memoization

**File:** `src/components/calculator/CostCalculator.tsx:49-68, 363, 396-426`; `CostFormSection.tsx:43`; `CostParametersSection.tsx:33`; `ShippingSection.tsx:44`; `PricingSection.tsx:32`; `CostSummaryPanel.tsx:42`

**Issue:** Each section is wrapped in `memo(...)`, but every section receives at least one prop whose identity changes on every orchestrator render: `form` (fresh object returned by `useCostForm`), `derived` (fresh object returned by `useCostDerivedValues`), `ids` (fresh object literal around stable `useId` strings), and inline lambdas (`onAddPackagingMaterial`, `onRemovePackagingMaterial`, `onViewJobs`-style closures). `memo`'s shallow compare therefore never bails — all five sections re-render on every orchestrator render, identical to having no `memo` at all. Not a correctness bug (renderCount's `=== 1` assertion counts commits, not bailed subtrees), but it is dead code that advertises an optimization that does not exist, and it blocks the plan's own stated follow-up of narrowing the render-count probe to the PricingSection subtree.

**Fix:** Either remove the `memo()` wrappers (honest, zero behavior change), or make them effective: `useMemo` the `ids` object, stabilize `derived`/`form` (or pass the primitive fields sections actually read), and `useCallback` the inline handlers. Removing is the lower-risk option for this phase.

#### WR-04: Clicking the already-active tab pushes duplicate history entries — drift from pre-split useState no-op

**File:** `src/App.tsx:58-65, 345-360`

**Issue:** `navigateToTab` calls `setSearchParams(...)` unconditionally with push semantics. react-router pushes a new history entry even when the resulting URL is identical, so re-clicking the active tab (a very common idle interaction) stacks duplicate entries — Back then appears to "do nothing" once per redundant click. Pre-split, tab clicks were `setState` no-ops with zero history impact. Arrow-key navigation additionally pushes one entry per keypress (that part is per D-05's push decision, but it compounds the pollution: arrowing across the bar plus a few re-clicks yields a long chain of near-identical entries).

**Fix:**

```ts
const navigateToTab = useCallback((tab: Tab, options?: { replace?: boolean }) => {
  if (tab === activeTab && !options?.replace) return; // no-op on re-click, matches pre-split
  setSearchParams(tab === 'calculator' ? {} : { tab }, { replace: options?.replace ?? false });
}, [setSearchParams, activeTab]);
```

Consider (separately, as a D-05 amendment) `replace: true` for arrow-key roving activation so keyboard exploration doesn't multiply entries.

#### WR-05: Output-equivalence oracle scenarios are order-coupled — component is never remounted between scenarios, so undefined-on-job fields leak from one scenario into the next snapshot entry

**File:** `src/components/calculator/outputEquivalence.test.tsx:158-190`; `src/components/calculator/__fixtures__/goldenScenarios.ts:208-231`; `src/hooks/useCostForm.ts:202-206`

**Issue:** The loop calls `root.render(...)` on the same root for all ~120 scenarios. Same element type at the same position means React **updates** the existing component instance — the `useState`/`useReducer` initializers run only for scenario 1; subsequent scenarios only re-fire the `editingJob`-population effects. `useCostForm`'s populate effect deliberately skips fields the job leaves `undefined` (`shippingMethod`, `shippingDistanceKm`, `shippingOverrideCost`, `packagingMaterials`, `marketplace` — lines 202-206), so those fields **carry the previous scenario's values forward**. Example: `none-04` sets `shippingMethod: 'ups'`; the next scenario (`multi-material`, which doesn't set a shipping method) is actually snapshotted *with UPS shipping cost included in trueCost*. The baseline was captured with the same accumulation, so the gate still proves split-vs-pre-split parity — but only while scenario **order** is frozen. Reordering, inserting, or removing any scenario silently changes the effective inputs of every scenario after it, per-scenario snapshot values do not mean what their names claim, and a future fixture edit could mask a real regression behind an "expected" snapshot churn.

**Fix:** Unmount/recreate the root (or render with a changing `key`) between scenarios so each mounts fresh:

```ts
for (const scenario of ALL_SCENARIOS) {
  const scenarioRoot = createRoot(container!);
  await act(async () => { scenarioRoot.render(<ToastProvider><CostCalculatorUnderTest {...scenario.props} /></ToastProvider>); });
  // capture...
  act(() => scenarioRoot.unmount());
}
```

This requires re-capturing the baseline once (against the pre-split component at the diff base, per D-01) — do that in a dedicated commit so the re-capture is auditable.

#### WR-06: sessionStorage leaks between tests via the persistence effect — order-dependent state in coverageGaps (and pricingSequence)

**File:** `src/components/calculator/coverageGaps.test.tsx:78-188`; `src/components/calculator/pricingSequence.test.tsx:163-225`

**Issue:** Tests that mount with `editingJob: null` trigger the real persistence effect, which writes the full form blob to `sessionStorage` under `costCalculatorForm`. jsdom's sessionStorage persists across tests within a file, and only one test cleans up after itself (line 187). Each subsequent `editingJob: null` mount in the same file therefore restores the *previous test's* form state (printer selection, shipping method, print time, margin) before the test drives its own inputs. Currently every test happens to overwrite the fields it asserts on, so the suite passes — but the tests are order-coupled, and a future test asserting a default value (or an initializer branch) will pass/fail depending on which test ran before it.

**Fix:** Add `sessionStorage.clear()` to the shared `beforeEach` in all component-mount test files in this directory.

### Info

#### IN-01: Duplicated comment line

**File:** `src/hooks/useCostDerivedValues.ts:444-445`
**Issue:** Two consecutive "True cost = ..." comment lines; the first is the stale pre-packaging wording.
**Fix:** Delete line 444.

#### IN-02: D-07 URL-strip assertion is vacuous under MemoryRouter

**File:** `src/App.test.tsx:271-290`
**Issue:** `expect(search === '' || search === undefined).toBeTruthy()` reads `window.location.search`, which MemoryRouter never touches (the test's own comment admits this) — it passes whether or not the strip effect exists. The "one selected tab" fallback assertion would also pass without the effect. The D-07 replace behavior is effectively untested.
**Fix:** Use the `createMemoryRouter` harness for this case and assert `router.state.location.search === ''` after the effect flushes.

#### IN-03: sessionStorage restore has no shape validation

**File:** `src/hooks/useCostForm.ts:8-20, 81-100`
**Issue:** `getStoredValue` returns whatever was parsed if the key exists — no type/shape check. A malformed persisted blob (e.g., `grams: "abc"`, `filamentRows` items missing fields) flows straight into cost math as `NaN`. Trust boundary is same-origin sessionStorage, so exploitability is nil, but a corrupted blob produces NaN readouts instead of a clean fallback.
**Fix:** Cheap `typeof` guards per field (or a small validator for the array fields) before accepting stored values; fall back to the default on mismatch.

#### IN-04: Filament-row cap check uses render-closure length alongside a functional update

**File:** `src/hooks/useCostForm.ts:103-106`
**Issue:** `if (filamentRows.length >= 16) return;` reads the render snapshot but the append is functional — two invocations batched in one frame both pass the guard at 15 and yield 17 rows. Also `16` is a magic number.
**Fix:** Move the guard inside the updater: `setFilamentRows(prev => prev.length >= MAX_FILAMENT_ROWS ? prev : [...prev, makeDefaultRow(userCurrency)])` with a named constant.

#### IN-05: `navigateToTab` drops all non-tab search params

**File:** `src/App.tsx:58-60, 72-76`
**Issue:** `setSearchParams({} | { tab })` rebuilds the query from scratch, wiping any other params (e.g., UTM params on a shared /app link, or future deep-link params such as the v2.0 instant-quote token). Same for the D-07 cleanup replace.
**Fix:** Use the functional form: `setSearchParams(prev => { const next = new URLSearchParams(prev); if (tab === 'calculator') next.delete('tab'); else next.set('tab', tab); return next; }, ...)`.

#### IN-06: Mixed functional / snapshot setState in material handlers

**File:** `src/components/calculator/CostCalculator.tsx:312-331, 402-408`
**Issue:** `updateMaterialUsage`/`updatePackagingMaterial` use functional updaters (per HYG-11), but `addMaterialUsage`, `removeMaterialUsage`, `onAddPackagingMaterial`, and `onRemovePackagingMaterial` still spread/filter the render snapshot (`[...materialsUsed, ...]`, `materialsUsed.filter(...)`). Low practical risk (single-user-click cadence), but inconsistent with the HYG-11 rule the same file's tests enforce.
**Fix:** Convert the remaining four to `setX(prev => ...)` form.

---

_Reviewed: 2026-07-05T01:47:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
