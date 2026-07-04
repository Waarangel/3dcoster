---
phase: 38-foundation
plan: 01
subsystem: testing
tags: [vitest, react, cost-calculator, output-equivalence, regression-testing, react-profiler]

# Dependency graph
requires: []
provides:
  - Golden-scenario fixtures (CURATED_SCENARIOS: 20, RANDOM_SCENARIOS: 100, seed 1337) as CostCalculatorProps-shaped inputs
  - Pre-split output-equivalence snapshot oracle (rendered-string baseline)
  - Pricing-sequence consistency tests (same-field re-edit + field-to-field chains, none + fee-bearing)
  - Render-count PERF-11 tripwire pinned to the observed 3-commit pre-fix baseline
affects: [38-02, 38-03, 38-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mulberry32 fixed-seed PRNG for reproducible random test fixtures (no new dependency)"
    - "editingJob as the mount-time seeding channel for internal form state (marketplace, sellingPrice, failureRate) that has no corresponding CostCalculatorProps field"
    - "React.Profiler onRender for commit-counting in tests (not a manual useRef-in-wrapper counter, which does not track a child's independent setState-driven renders)"
    - "Local per-file jsdom polyfills (window.matchMedia, Element.scrollIntoView) for tests that mount components with FIX-04-style effects, rather than a shared global setup file"

key-files:
  created:
    - src/components/calculator/__fixtures__/goldenScenarios.ts
    - src/components/calculator/outputEquivalence.test.tsx
    - src/components/calculator/__snapshots__/outputEquivalence.test.tsx.snap
    - src/components/calculator/pricingSequence.test.tsx
    - src/components/calculator/renderCount.test.tsx
  modified: []

key-decisions:
  - "marketplace/sellingPrice/failureRate/filaments are seeded via editingJob, not a CostCalculatorProps override, because the current (pre-split) component only reads those as internal useState form fields defaulting from sessionStorage — editingJob's population effect is the only mount-time channel that deterministically seeds them"
  - "Render-count probe uses React.Profiler (not a manual wrapper) after the wrapper approach was proven not to work (0 renders observed) — Profiler correctly counts commits of a subtree regardless of what triggered them"
  - "Render-count baseline is 3 commits per single margin keystroke (input state + locked derivation effect + fee-shape re-fire effect, since marketplaceFeeParts depends on the sellingPrice the first effect just changed), not 1 or 2 — documented explicitly with the causal chain so Plan 03's useReducer redesign has a concrete number to tighten"

patterns-established:
  - "Pattern: fixture-factory-with-overrides at the full component-props surface (makeScenarioProps), one level up from the existing makeCalcInput pure-function fixture factory"
  - "Pattern: output-equivalence via rendered-string capture (not parsed floats), asserted well-formed and snapshotted as the pre-refactor oracle"

requirements-completed: [FOUND-01, FOUND-02]

# Metrics
duration: 55min
completed: 2026-07-03
---

# Phase 38 Plan 01: Golden Fixtures + Output-Equivalence + PERF-11 Tripwires Summary

**Golden-scenario fixture factory (20 curated + 100 seeded-random) plus a pre-split output-equivalence snapshot oracle, a pricing-sequence consistency suite, and a React.Profiler-based render-count tripwire pinning the PERF-11 pre-fix baseline at 3 commits per keystroke — all captured against the CURRENT, unmodified CostCalculator before any code extraction.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-03T20:39:00Z
- **Completed:** 2026-07-03T21:34:32Z
- **Tasks:** 3
- **Files modified:** 5 created (1 fixture, 3 test files, 1 committed snapshot)

## Accomplishments
- Captured 120 total golden scenarios (20 hand-picked landmines + 100 fixed-seed random combos) as `CostCalculatorProps`-shaped fixtures, spanning multi-material filaments, FX-converted marketplace fees (JPY/EUR/CAD), tax modes (VAT, region-lookup, none), break-even scenarios, and combined labor/shipping/packaging cost centers — with 14 zero-fee `marketplace: 'none'` baselines so the default path isn't crowded out (well above the required minimum of 4)
- Mounted the CURRENT (pre-split) `CostCalculator` against all 120 scenarios and captured a committed rendered-string snapshot (`True Cost`, `Sell Price`, `Net Profit`, `Net Margin`, `Cost Per Unit`, `Break-even Units`) as the byte-for-byte oracle every later plan in this phase must reproduce
- Reproduced the exact PERF-11 failure mode as a first-class test: rapid same-field re-edits and field-to-field chains stay mutually consistent after every step, verified against both a zero-fee and an Etsy fee-bearing scenario
- Measured and pinned the actual render-count baseline via `React.Profiler`: a single pricing keystroke on the current component commits 3 times (not 1), with the causal chain documented (input commit → locked derivation effect → fee-shape re-fire effect cascading off the just-changed `sellingPrice`) — giving Plan 03's `useReducer` redesign a concrete, falsifiable target

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the golden-scenario fixture factory captured from the current component** - `3e2b4c8` (test)
2. **Task 2: Output-equivalence oracle — mount the current component, snapshot rendered strings** - `5f58ab6` (test)
3. **Task 3: Sequence test + render-count probe (the PERF-11 tripwires)** - `600e08a` (test)

_No TDD multi-commit chains — these are new pre-refactor test/fixture files, not RED/GREEN pairs against not-yet-written production code._

## Files Created/Modified
- `src/components/calculator/__fixtures__/goldenScenarios.ts` - `makeScenarioProps` factory, `CURATED_SCENARIOS` (20), `RANDOM_SCENARIOS` (100, seed `FIXTURE_SEED = 1337`)
- `src/components/calculator/outputEquivalence.test.tsx` - mounts `CostCalculatorUnderTest` (bound to `../CostCalculator`) for every scenario, asserts well-formed rendered strings, `toMatchSnapshot()`
- `src/components/calculator/__snapshots__/outputEquivalence.test.tsx.snap` - committed pre-split baseline snapshot (120 scenario entries)
- `src/components/calculator/pricingSequence.test.tsx` - same-field rapid re-edit + field-to-field chain tests, `marketplace: 'none'` and Etsy fee-bearing runs, expectations recomputed via `priceFromMargin`/`priceFromProfit`/`marginFromPrice`
- `src/components/calculator/renderCount.test.tsx` - `React.Profiler`-based commit counter, PERF-11-tagged, baseline pinned at 3 commits/keystroke

## Decisions Made
- **`editingJob` as the seeding channel, not a nonexistent prop override:** `marketplace`, `sellingPrice`, `failureRate`, and `filaments` are internal `useState` form fields on the current (pre-split) `CostCalculator`, not fields of `CostCalculatorProps`. The only deterministic mount-time way to seed them (without first driving DOM events) is via `editingJob`, whose population effect (`CostCalculator.tsx` lines 287-337) copies those fields into form state on mount. This was caught mid-Task-1 by re-reading the component after drafting an initial fixture design that passed `marketplace` as a prop override — the override was silently absorbed by the object spread and did nothing. Corrected before committing.
- **`React.Profiler` over a manual render-counting wrapper:** The first render-count implementation used a `useRef` counter incremented in a wrapper component's render body plus a `useEffect` to report it. This measured 0 renders because the wrapper itself never re-renders when only `CostCalculator`'s internal state changes — the wrapper's render count and its child's render count are independent. Switched to `React.Profiler`'s `onRender` callback, which correctly fires once per commit of the profiled subtree regardless of what triggered it.
- **Render-count baseline pinned at 3, not 2 or 1:** Initial assumption (per the plan's own phrasing, "MAY currently record ... 2") was that the historical two-effects design would show 2 commits. Measurement showed 3: the input's own state commit, the locked derivation effect's commit, AND a third commit from the marketplace fee-shape re-fire effect — because that effect's dependency (`marketplaceFeeParts.pctFees`/`fixedFees`, itself derived from `sellingPrice`) changes as a *side effect* of the locked effect's own `setSellingPrice` call, causing it to re-run even though the user only touched one field once. This is documented explicitly in the test file and is itself evidence for why FOUND-02's `useReducer` redesign (collapsing both effects into one reducer dispatch) is needed, not just a dep-array trim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed fixture design that silently ignored marketplace/failureRate/sellingPrice overrides**
- **Found during:** Task 1 (fixture factory)
- **Issue:** Initial draft of `goldenScenarios.ts` passed `marketplace: 'etsy'` etc. as an override to `makeScenarioProps` (which spreads onto `CostCalculatorProps`). Since `marketplace` is not a field of `CostCalculatorProps` — it's internal component `useState` — the override was silently absorbed and had no effect on the mounted component. This would have produced fixtures that looked like they exercised marketplace-fee/failure-rate/tax paths but actually all rendered the `'none'`/default path, defeating the fixture's purpose before any test even ran.
- **Fix:** Redesigned the fixture factory to build an `editingJob: PrintJob` for every scenario that needs non-default marketplace/sellingPrice/failureRate/filaments, using a new `makeEditingJob` helper. The component's existing editingJob-population effect (unchanged, pre-existing code) now correctly seeds those fields on mount.
- **Files modified:** `src/components/calculator/__fixtures__/goldenScenarios.ts` (caught and fixed before first commit — no separate fix commit)
- **Verification:** Re-ran typecheck + a scratch vitest count-check confirming `CURATED_SCENARIOS.length === 20`, `RANDOM_SCENARIOS.length === 100`, and 14 scenarios with `editingJob.marketplace === 'none'`
- **Committed in:** `3e2b4c8` (Task 1 commit — fix was folded into the initial commit since caught pre-commit)

**2. [Rule 3 - Blocking] Added local jsdom polyfills for window.matchMedia and Element.scrollIntoView**
- **Found during:** Task 2 (output-equivalence test)
- **Issue:** jsdom does not implement `window.matchMedia` or `Element.scrollIntoView`. The current `CostCalculator`'s FIX-04 editing-banner scroll effect calls both whenever `editingJob` is truthy — which every fixture sets (per the `editingJob`-seeding decision above). Mounting any scenario threw `TypeError: window.matchMedia is not a function`, then after that fix, `TypeError: bannerRef.current.scrollIntoView is not a function`.
- **Fix:** Added minimal local (per-file, not global-setup) polyfills at the top of `outputEquivalence.test.tsx`, `pricingSequence.test.tsx`, and `renderCount.test.tsx`: a no-op `matchMedia` returning `matches: false`, and a no-op `scrollIntoView`. No other mounted-component test in the project currently needs these (verified via grep — `CostCalculator.test.tsx` is source-contract-only and never mounts), so a shared `vitest.config.ts` setup file was deliberately avoided to keep the blast radius scoped to these three new files.
- **Files modified:** `src/components/calculator/outputEquivalence.test.tsx`, `src/components/calculator/pricingSequence.test.tsx`, `src/components/calculator/renderCount.test.tsx`
- **Verification:** All three test files mount successfully and pass; full project suite (`npx vitest run`) still green at 824/824 passing tests across 67 files
- **Committed in:** `5f58ab6` (Task 2), `600e08a` (Task 3 — same polyfill pattern repeated per-file)

**3. [Rule 3 - Blocking] Switched input lookup from CSS id-selector to getElementById**
- **Found during:** Task 3 (pricingSequence.test.tsx)
- **Issue:** The DOM-input-lookup helper initially used `container.querySelector(`#${CSS.escape(id)}`)` to find inputs by their `useId()`-generated `id` attribute. jsdom does not implement `CSS.escape`, throwing `Cannot read properties of undefined (reading 'escape')` on every lookup.
- **Fix:** Replaced with `document.getElementById(id)`, which sidesteps CSS selector syntax entirely (also correctly handles the `:` characters `useId()` can produce, which are invalid in an unescaped raw CSS selector).
- **Files modified:** `src/components/calculator/pricingSequence.test.tsx`, `src/components/calculator/renderCount.test.tsx`
- **Verification:** Both test files run green
- **Committed in:** `600e08a` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All three were necessary to make the mount-based tests function at all against jsdom + the current component's existing (unmodified) behavior. No scope creep — no production code was touched; all fixes are confined to the new test/fixture files this plan creates.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The pre-split output-equivalence snapshot (`outputEquivalence.test.tsx.snap`) is committed and ready to serve as the correctness gate for Plan 02 (research spike confirmation) and Plans 03/04 (the actual `useCostForm`/`useCostDerivedValues`/section-component extraction and the `useReducer` PERF-11 fix)
- `CostCalculatorUnderTest` in all three test files is bound through a single import line (`const { CostCalculator: CostCalculatorUnderTest } = await import('../CostCalculator')`) — Plan 04 can repoint this to `./CostCalculator` after the folder move by changing one line per file
- The render-count baseline (3 commits/keystroke) gives Plan 03 a concrete, falsifiable number to tighten toward `=== 1` as the `useReducer` redesign collapses the two pricing effects into one dispatch
- No blockers. Full project test suite remains green (824 tests, 67 files) with these 3 new files added on top

---
*Phase: 38-foundation*
*Completed: 2026-07-03*
