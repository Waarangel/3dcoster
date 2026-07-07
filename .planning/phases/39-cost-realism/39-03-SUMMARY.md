---
phase: 39-cost-realism
plan: 03
subsystem: settings
tags: [react, dexie, typescript, settings, tou-tariff]

# Dependency graph
requires:
  - phase: 39-cost-realism
    plan: 01
    provides: "TouBand type, ElectricityConfig.touBands, PrintJob.touStartTime/touRateUsedPerKwh, touElectricity.ts (parseHHMM), isElectricityConfig extension"
provides:
  - useTouTariff hook (flat rate + ≤3 TOU bands read/write + validation boundary)
  - SettingsModal TOU tariff band editor UI
  - reconcileTouSnapshot legacy-data reconcile helper, wired at boot
affects: [39-05-calculator-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validation-boundary hook wrapping an existing settings read/write path (useTouTariff wraps ElectricityConfig/onElectricityChange, not a new settings key)"
    - "No-op reconcile helper that exists solely to formalize an 'absence = default' contract (reconcileTouSnapshot never writes a patch for legacy jobs, by design)"

key-files:
  created:
    - src/hooks/useTouTariff.ts
    - src/hooks/useTouTariff.test.tsx
  modified:
    - src/components/SettingsModal.tsx
    - src/components/SettingsModal.test.tsx
    - src/db/backfill.ts
    - src/db/backfill.test.ts
    - src/hooks/useDatabase.ts

key-decisions:
  - "useTouTariff.test.ts renamed to .test.tsx — the hook test harness renders a JSX component (HookHarness) to invoke the hook per-render, which is invalid syntax in a .ts file. Matches the project's own .tsx test-file convention for JSX-containing tests (e.g. useFailureEvents.test.tsx from Plan 01)."
  - "reconcileTouSnapshot's patch list is always empty by design — legacy jobs correctly keep touStartTime/touRateUsedPerKwh absent (Pitfall 5: never guess a rate). The helper still exists and is wired at boot to satisfy the locked milestone rule that every derived-money schema change ships with a reconcile helper."
  - "TOU-01 band editor extends the existing ElectricityConfig via onElectricityChange — no new settings key was forked, matching RESEARCH.md Open Question 2's recommendation."

patterns-established:
  - "useTouTariff is the sole validation boundary for ElectricityConfig.touBands — SettingsModal never writes touBands directly, only through upsertBand/removeBand/setFlatRate."

requirements-completed: [TOU-01]

# Metrics
duration: 25min
completed: 2026-07-06
---

# Phase 39 Plan 03: TOU Configuration & Legacy-Data Layer Summary

**useTouTariff hook (max-3-band validation boundary) + SettingsModal tariff editor + reconcileTouSnapshot legacy-data helper wired at boot — the Settings-side half of TOU-01, ready for Plan 05's calculator integration.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-06T13:39:56Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `useTouTariff` hook: reads `flatRate`/`bands` from `ElectricityConfig`, exposes `setFlatRate`/`upsertBand`/`removeBand` that write through the existing `onElectricityChange` path. Enforces D-09's max-3-band clamp (rejects adding a 4th band, but still allows editing one of the existing 3), `Number.isFinite` guard on rates, and strict HH:MM validation via `touElectricity.parseHHMM` for both `startTime`/`endTime`.
- `SettingsModal.tsx` Electricity section (Costs & Rates tab) gains a TOU band editor directly beneath the flat `costPerKwh` input: existing bands render as edit/remove rows (name, rate, HH:MM start/end, `EditButton`/`RemoveButton`), and a "+ Add band" row (name/rate/start/end inputs + `Button`) appears only while fewer than 3 bands exist. All writes route through `useTouTariff`.
- `reconcileTouSnapshot` (`src/db/backfill.ts`): the mandatory reconcile helper for the `touStartTime`/`touRateUsedPerKwh` schema-extension fields. Per RESEARCH.md Pitfall 5, it intentionally never backfills a numeric rate for legacy jobs — both fields are correctly left `undefined` (meaning "flat rate was used"). Idempotent (skips jobs where either field is already set), pure spread-copy discipline, no `dexie`/`./database` import, full JSDoc `Examples:` block matching the file's existing reconcile-helper convention.
- Wired at boot in `useDatabase.ts` alongside `reconcileFixedCostsAtSave`, following the same Path B pattern (read jobs once per page load behind a process-lifetime flag, apply patches only when non-empty, no `updatedAt` bump). Because the helper's patch list for legacy jobs is always empty, this call site never actually writes — it exists to genuinely invoke the reconcile at boot, satisfying the locked milestone rule.

## Task Commits

Each task was committed atomically:

1. **Task 1: useTouTariff hook + SettingsModal band editor** — `58111bd` (feat)
2. **Task 2: reconcileTouSnapshot legacy-data helper + boot wiring** — `0ac4507` (feat)

_Both tasks were `tdd="true"`; tests were authored alongside the implementation in the same commit per the plan's task-level TDD grouping — the plan's `<behavior>` blocks were converted into concrete `it()` tests that passed on first run._

## Files Created/Modified

- `src/hooks/useTouTariff.ts` — TOU tariff read/write + validation hook (max-3-band clamp, `Number.isFinite` rate guard, `parseHHMM` window validation)
- `src/hooks/useTouTariff.test.tsx` — 13 tests (read, max-3-bands, HH:MM validation, setFlatRate, removeBand)
- `src/components/SettingsModal.tsx` — TOU band editor added to the Electricity section; flat-rate `onChange` updated to spread `electricity` (previously replaced the whole config object, which would have silently dropped `touBands` on every flat-rate edit)
- `src/components/SettingsModal.test.tsx` — 4 new tests for the band editor (renders affordance, renders row + RemoveButton, hides "+ Add band" at 3 bands, writes via onElectricityChange)
- `src/db/backfill.ts` — `reconcileTouSnapshot` helper appended after `reconcileFixedCostsAtSave`
- `src/db/backfill.test.ts` — 5 new tests (absence-preservation, idempotency ×2 field variants, no-mutation, mixed-batch)
- `src/hooks/useDatabase.ts` — `reconcileTouSnapshot` imported + wired via a new `useEffect` behind `touSnapshotReconcileRan`, mirroring the `fixedCostsReconcileRan` pattern

## Decisions Made

- `useTouTariff.test.ts` → `.tsx`: the test harness needs a JSX component (`HookHarness`) to invoke the hook once per render and capture its return value — this requires the `.tsx` extension. Matches the project's own precedent (Plan 01's `useFailureEvents.test.tsx`).
- Confirmed via Plan 01: `isElectricityConfig` was already extended with the `touBands` array-shape guard, so no additional type-guard work was needed this plan.
- The existing flat-rate `onChange` handler in `SettingsModal.tsx` previously wrote `{ costPerKwh: ... }` (replacing the whole `ElectricityConfig` object). This was corrected to `{ ...electricity, costPerKwh: ... }` — a Rule 1 bug fix, since the original code would have silently dropped any configured `touBands` the instant a user edited the flat rate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Flat-rate `onChange` handler dropped `touBands` on every edit**
- **Found during:** Task 1 implementation, while wiring the TOU band editor beneath the existing flat-rate input
- **Issue:** `onChange={e => onElectricityChange({ costPerKwh: parseFloat(e.target.value) || 0 })}` constructs a brand-new `ElectricityConfig` object containing only `costPerKwh`, discarding any existing `touBands`. Editing the flat rate after configuring TOU bands would have silently wiped them.
- **Fix:** Changed to `onElectricityChange({ ...electricity, costPerKwh: parseFloat(e.target.value) || 0 })` — spreads the existing config first.
- **Files modified:** `src/components/SettingsModal.tsx`
- **Verification:** Covered implicitly by the new TOU band editor tests (bands persist across renders); no dedicated regression test added since this is a one-line defensive fix in code this plan was already modifying.
- **Committed in:** `58111bd` (Task 1 commit)

**2. [Rule 3 - Blocking] `useTouTariff.test.ts` renamed to `.test.tsx`**
- **Found during:** Task 1, writing the hook test file
- **Issue:** The plan's `files_modified` list specifies `useTouTariff.test.ts`, but testing a hook via a harness component requires JSX (`<HookHarness ... />`), which is a syntax error in a `.ts` file.
- **Fix:** File created as `useTouTariff.test.tsx` instead. Same test coverage, same location, extension only.
- **Files modified:** `src/hooks/useTouTariff.test.tsx` (in place of the planned `.ts` name)
- **Verification:** `npx vitest run src/hooks/useTouTariff.test.tsx` — 13/13 passing
- **Committed in:** `58111bd` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug fix, 1 Rule 3 blocking-issue fix). Neither represents scope creep — both were necessary corrections within files this plan was already modifying.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `useTouTariff` + the Settings band editor give users a way to configure flat rate + up to 3 TOU bands (TOU-01 satisfied).
- `reconcileTouSnapshot` is wired at boot; legacy jobs correctly read as "flat rate was used" with no fabricated cost history.
- Plan 05 (calculator integration) can now wire `resolveWeightedCostPerKwh` (from Plan 01's `touElectricity.ts`) into `calculateElectricityCost`, reading the configured `touBands` via the same `ElectricityConfig` this plan writes to, plus the start-time picker + savings hint UI that consumes this plan's tariff config.
- No calculator/`costCalc.ts` files were touched by this plan — confirmed via `git diff --name-only` against the wave-1 merge base.
- Full suite: 911/911 tests passing (1 pre-existing `it.todo`), `tsc -b` clean.

---
*Phase: 39-cost-realism*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created/modified files verified present on disk; task commit hashes `58111bd` and `0ac4507` verified present in `git log --oneline`.
