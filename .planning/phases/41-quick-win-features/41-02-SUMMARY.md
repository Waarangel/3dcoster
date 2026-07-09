---
phase: 41-quick-win-features
plan: 02
subsystem: pricing
tags: [react, dexie, cost-calc, margin, toast, modal]

# Dependency graph
requires:
  - phase: 41-quick-win-features (plan 01)
    provides: Type/schema/registry spine (reprice-alerts NEW-badge key, no schema fields consumed directly by this plan)
  - phase: 40-insight-layer
    provides: buildCalcInputFromJob + computeScenario's reconciliation-residual pattern (insights.ts), reused byte-for-byte for the scan's old/new cost reconstruction
provides:
  - "src/utils/repriceAlert.ts — pure scanAffectedJobs() that flags saved jobs whose margin falls below target after a material price change, excluding per-row price-override jobs"
  - "src/components/RepriceReviewModal.tsx — shared-Modal affected-jobs review surface with per-job non-destructive Apply"
  - "AssetLibrary.handleSubmit material-update path wired to detect a live price change, scan, and surface toast + re-openable banner + modal"
affects: [41-03-PLAN, 41-04-PLAN, 41-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pure alert-scan module (repriceAlert.ts) reuses buildCalcInputFromJob + calculateCost + priceFromMargin exclusively — never forks a cost or pricing formula, mirroring computeScenario's RECONCILIATION RESIDUAL pattern (old-price reconstruction minus job.costPerUnit = residual, carried forward into the new-price reconstruction) so cost drift sources unrelated to the material price change are neutralized."
    - "A component-owned alert with two independent re-open paths: a toast's inline Review action (dismissable) and a persistent banner driven by the same held state (D-03) — both point at one Modal, neither writes anything itself."
    - "Container components (AssetLibrary) that are otherwise prop-driven can still add their OWN narrow Dexie subscriptions (useJobs/useUserProfile/usePrinterInstances/useElectricitySettings) for a single cross-cutting feature, rather than threading five new props through App.tsx."

key-files:
  created:
    - src/utils/repriceAlert.ts
    - src/utils/repriceAlert.test.ts
    - src/components/RepriceReviewModal.tsx
  modified:
    - src/components/AssetLibrary.tsx
    - src/components/AssetLibrary.test.tsx

key-decisions:
  - "scanAffectedJobs mirrors computeScenario's costResidual pattern exactly: reconstruct at the OLD material price to derive job.costPerUnit's reconciliation residual, then apply that same residual to the NEW-price reconstruction — never a second/forked cost formula."
  - "The reprice alert is held in AssetLibrary's own component state (not lifted to App.tsx) with a re-openable banner (D-03) so dismissing the toast never loses the alert; the banner and modal share the same scan result until a later save produces a new one."
  - "AssetLibrary gained its own useJobs/useUserProfile/usePrinterInstances/useElectricitySettings subscriptions scoped narrowly to feed the scan, instead of threading five new props through App.tsx (plan's explicit instruction)."
  - "Apply writes exclusively through the existing updateJob hook, one job at a time — scanAffectedJobs and RepriceReviewModal are both read-only; no bulk mutation path exists (T-41-02b)."

patterns-established:
  - "AssetLibrary.test.tsx now needs `import 'fake-indexeddb/auto'` + a <ToastProvider> wrapper around every render, matching the LogFailureModal.test.tsx harness — any future AssetLibrary hook addition that reads Dexie or calls useToast must keep this test harness intact."

requirements-completed: [CONN-01]

coverage:
  - id: D1
    description: "scanAffectedJobs flags a live-priced job whose margin falls below target after a material price change, excludes an explicit-pricePerGram-override row (Pitfall 2), and its suggestedPrice matches a direct priceFromMargin call exactly"
    requirement: "CONN-01"
    verification:
      - kind: unit
        ref: "src/utils/repriceAlert.test.ts (6 tests: inclusion, override-exclusion, no-reference-exclusion, above-target-exclusion, oldMargin/newMargin derivation, suggestedPrice equality)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RepriceReviewModal renders inside the shared Modal primitive, lists each affected job's old->new margin and suggested price, and its per-job Apply carries an aria-label naming the job"
    requirement: "CONN-01"
    verification:
      - kind: unit
        ref: "npx tsc -b (exits 0); grep confirms no hand-rolled `className=\"fixed` overlay"
        status: pass
    human_judgment: false
  - id: D3
    description: "Editing a material's price in the Asset Library fires a toast naming affected saved jobs, and Apply reprices through the existing updateJob hook without any bulk mutation"
    requirement: "CONN-01"
    verification: []
    human_judgment: true
    rationale: "The end-to-end save -> toast -> modal -> Apply -> job.sellingPrice flow is UI-driven and best confirmed via UAT (deferred per the plan's own verification section); tsc + the full test suite (1096 passed) prove the wiring compiles and doesn't regress existing behavior, but the visual/interactive flow itself needs a human look."

# Metrics
duration: ~25min
completed: 2026-07-09
status: complete
---

# Phase 41 Plan 02: Reprice Alerts (CONN-01) Summary

**Pure repriceAlert.ts scan module (reusing buildCalcInputFromJob/calculateCost/priceFromMargin), a RepriceReviewModal, and AssetLibrary wiring that surfaces a toast + re-openable banner + per-job Apply when a material's price change drops a saved job below the user's target margin.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-09T16:58:00Z (approx, continuing directly after 41-01)
- **Completed:** 2026-07-09T17:17:30Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `src/utils/repriceAlert.ts` exports `scanAffectedJobs()` — a pure function that, for every saved job referencing a changed material AT ITS LIVE PRICE (no per-row override), reconstructs the job's cost at both the old and new material price via `buildCalcInputFromJob` + `calculateCost`, applies the same reconciliation-residual pattern `computeScenario` uses, and flags jobs whose recomputed margin falls below `targetMargin`. The suggested reprice comes from `priceFromMargin` — never a forked pricing formula.
- 6 unit tests cover: live-price inclusion, explicit-override exclusion (Pitfall 2), no-reference exclusion, above-target exclusion, oldMargin/newMargin derivation source, and exact `suggestedPrice` equality against a direct `priceFromMargin` call.
- `src/components/RepriceReviewModal.tsx` renders inside the shared `Modal` primitive: header states the affected count and target margin, each row shows old→new margin (color-coded), the suggested price via `formatCurrency`, and a per-job "Apply" button (`aria-label="Apply suggested price to {jobTitle}"`) that marks the row applied without closing the modal — no bulk apply.
- `AssetLibrary.tsx`'s material-update branch now detects a real `costPerUnit` change against the pre-save asset, runs the scan against its own `useJobs`/`useUserProfile`/`usePrinterInstances`/`useElectricitySettings` subscriptions, and on a non-empty result: fires a toast (count + target margin + inline "Review" action) and holds the result in component state so a persistent amber banner can re-open the modal after the toast is dismissed (D-03). Falls back to a 30% target with adjusted copy when `defaultProfitMargin` is unset (D-02). Apply persists via the existing `updateJob` hook, one job at a time.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure reprice scan module (reuses buildCalcInputFromJob + priceFromMargin) with tests** - `bb45d18` (test)
2. **Task 2: RepriceReviewModal — shared-Modal affected-jobs list with per-job Apply** - `9e8b163` (feat)
3. **Task 3: Wire the scan into AssetLibrary.handleSubmit — price-change detection, toast, re-openable modal, Apply→updateJob** - `75f8666` (feat)

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified
- `src/utils/repriceAlert.ts` - Pure `scanAffectedJobs()` + `AffectedJob`/`RepriceScanParams` types
- `src/utils/repriceAlert.test.ts` - 6 tests covering the scan's inclusion/exclusion/margin-derivation/suggested-price contract
- `src/components/RepriceReviewModal.tsx` - Shared-Modal affected-jobs review surface with per-job Apply
- `src/components/AssetLibrary.tsx` - `runRepriceScan` helper wired into the material-update branch of `handleSubmit`; new `useJobs`/`useUserProfile`/`usePrinterInstances`/`useElectricitySettings`/`useToast` subscriptions; re-openable banner + `RepriceReviewModal` render; `handleApplyRepricedJob` writing through `updateJob`
- `src/components/AssetLibrary.test.tsx` - Added `fake-indexeddb/auto` import and wrapped every render in `<ToastProvider>` (AssetLibrary now reads Dexie and calls `useToast`)

## Decisions Made
- Mirrored `computeScenario`'s RECONCILIATION RESIDUAL pattern exactly rather than inventing a simpler diff — this is what keeps `scanAffectedJobs` from drifting out of sync with the what-if simulator's cost math (T-41-02a).
- Kept the reprice alert entirely inside `AssetLibrary`'s own component state (banner + modal), rather than lifting it to `App.tsx`, per the plan's explicit "do not thread new state through App.tsx" instruction.
- Placed the re-open banner as a top-of-component amber `role="status"` bar (mirroring the existing `showStockPrompt` banner pattern) rather than a per-row affordance inside the virtualized `react-window` material list — the plan left this to planner/executor discretion, and touching the row-rendering pipeline (`AssetRowCallbacks`, `RowComponentProps`) for a single cross-cutting feature would have been a materially larger, riskier change for no functional benefit (the banner is equally re-openable and always visible regardless of scroll/pagination position).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed AssetLibrary.test.tsx to supply the Dexie + Toast context its new dependencies require**
- **Found during:** Task 3 verification (`npm run test`)
- **Issue:** Adding `useJobs`/`useUserProfile`/`usePrinterInstances`/`useElectricitySettings` (real Dexie reads) and `useToast()` (throws outside a `ToastProvider`) to `AssetLibrary` broke all 16 existing `AssetLibrary.test.tsx` tests — `useToast must be used within a ToastProvider`, and Dexie calls would fail without a real IndexedDB shim in jsdom.
- **Fix:** Added `import 'fake-indexeddb/auto'` as the test file's first import and wrapped every `root!.render(<AssetLibrary ... />)` call in `<ToastProvider>`, mirroring the existing `LogFailureModal.test.tsx` harness pattern used by other Dexie+toast-dependent component tests in this codebase.
- **Files modified:** src/components/AssetLibrary.test.tsx
- **Verification:** `npx vitest run src/components/AssetLibrary.test.tsx` — 16/16 pass; full `npm run test` — 90/90 files, 1096 passed.
- **Committed in:** 75f8666 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the existing AssetLibrary test suite green after adding the new hooks/context the scan wiring requires. No scope creep — the fix only touches test harness setup, not test assertions or AssetLibrary's public behavior.

## Issues Encountered
- One unrelated test (`src/components/calculator/outputEquivalence.test.tsx`) timed out once under full-suite parallel load (a pre-existing 5000ms-budget scenario-mount test, untouched by this plan). Reproduced in isolation both with and without this plan's diff — passed cleanly both times, and a second full-suite run passed 90/90 files. Confirmed pre-existing flakiness under load, not a regression from this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `npx tsc -b` exits 0; full test suite green (90/90 files, 1096 passed, 1 todo).
- The end-to-end save → toast → modal → Apply flow is implemented per the plan's `<verification>` section but deferred to `/gsd-verify-work` UAT, matching the plan's own instruction ("Manual/UAT (deferred to /gsd-verify-work)").
- No blockers for Plans 41-03 through 41-05 — this plan touched only `src/utils/repriceAlert.ts` (new), `src/components/RepriceReviewModal.tsx` (new), and `src/components/AssetLibrary.tsx`/`.test.tsx`, none of which are in other Wave 2 plans' `files_modified`.

---
*Phase: 41-quick-win-features*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/utils/repriceAlert.ts
- FOUND: src/utils/repriceAlert.test.ts
- FOUND: src/components/RepriceReviewModal.tsx
- FOUND: src/components/AssetLibrary.tsx
- FOUND: src/components/AssetLibrary.test.tsx
- FOUND: .planning/phases/41-quick-win-features/41-02-SUMMARY.md
- FOUND: bb45d18
- FOUND: 9e8b163
- FOUND: 75f8666
