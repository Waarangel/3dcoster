---
phase: 39-cost-realism
plan: 04
subsystem: database
tags: [dexie, react-hooks, typescript, maintenance, wear-tracking]

# Dependency graph
requires:
  - phase: 39-cost-realism
    provides: "Plan 01's Dexie v12 maintenanceEvents store, MaintenanceEvent/PrinterInstance.nozzleType/Asset.isAbrasive types, useMaintenanceEvents hook, 'maintenance-log' NEW-badge key"
provides:
  - "src/utils/abrasive.ts: detectIsAbrasive/resolveIsAbrasive/resolveNozzleType pure matchers (D-13)"
  - "src/db/maintenanceAmortization.ts: deriveMaintenanceAmortization + predictNextSwap pure derivations (D-14/D-15)"
  - "src/hooks/useMaintenanceAmortization.ts: index-scoped read-only derivation hook consumed by Plan 05's CostParametersSection hint row"
  - "src/components/LogMaintenanceModal.tsx: maintenance-event entry form with instance-level nozzle-type update"
  - "src/components/PrinterSettings.tsx: per-printer Maintenance drill-in (log button, history, cumulative cost, abrasive-hours, next-swap prediction)"
affects: [39-05-calculator-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveNozzleType(instance) — the ONLY sanctioned way to read PrinterInstance.nozzleType; never a literal `=== 'brass'` check on the raw optional field"
    - "resolveIsAbrasive(asset) — explicit Asset.isAbrasive override wins over the ABRASIVE_PATTERNS auto-detect regex"
    - "Prediction-only derivation: deriveMaintenanceAmortization/predictNextSwap never touch costCalc.ts or calculateNozzleWear (Assumption A4 kept distinct)"

key-files:
  created:
    - src/utils/abrasive.ts
    - src/utils/abrasive.test.ts
    - src/db/maintenanceAmortization.ts
    - src/db/maintenanceAmortization.test.ts
    - src/hooks/useMaintenanceAmortization.ts
    - src/hooks/useMaintenanceAmortization.test.tsx
    - src/components/LogMaintenanceModal.tsx
    - src/components/LogMaintenanceModal.test.tsx
  modified:
    - src/components/PrinterSettings.tsx
    - src/components/PrinterSettings.test.tsx

key-decisions:
  - "MaintenanceSection calls useMaintenanceEvents/useMaintenanceAmortization directly inside PrinterSettings.tsx rather than lifting them into App.tsx — these are already-abstracted hooks (not a raw useLiveQuery/db import), and files_modified for this plan scoped App.tsx out entirely to avoid a merge conflict with parallel Plans 02/03 also touching App.tsx this wave"
  - "The Maintenance drill-in toggle uses the shared Button primitive (variant=\"ghost\", fullWidth) instead of a raw <button>, to satisfy the project's lint:no-raw-html build gate (CollapsibleSection.tsx's raw <button> is exempt only because it lives in src/components/ui/)"
  - "abrasiveHours accumulates a job's printTimeHours only when its dominant (highest-gram) filament resolves abrasive AND the instance's resolveNozzleType() is 'brass' — hardened/ruby nozzles accrue zero abrasive-hours"

patterns-established:
  - "Recent-pace fallback: trailing-30-day avg printTimeHours/day for the instance; all-time average if fewer than 5 jobs fall in that window (RESEARCH.md Open Question 3)"

requirements-completed: [WEAR-01, WEAR-02]

# Metrics
duration: ~55min
completed: 2026-07-06
---

# Phase 39 Plan 04: Maintenance & Wear Data-Consumer + UI Summary

**Abrasive-material auto-detection (CF/GF/glow/metal-fill pattern matcher with override), maintenance $/hr amortization + per-part-category next-swap prediction, a LogMaintenanceModal form, and a per-printer Maintenance drill-in in Printer Settings — all read-only/prediction-only, leaving costCalc.ts and the existing 500h alert untouched.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-06 (worktree spawn)
- **Completed:** 2026-07-06
- **Tasks:** 2
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments
- `detectIsAbrasive`/`resolveIsAbrasive`/`resolveNozzleType` pure matchers implementing D-13's auto-detect + override semantic and the default-to-brass nozzle resolution Plan 01 documented
- `deriveMaintenanceAmortization` (total cost ÷ printer hours, null-guarded at 0 hours) + `predictNextSwap` (per-part-category average interval, projected via trailing-30-day print pace with an all-time fallback) as pure, index-scoped-friendly derivations
- `useMaintenanceAmortization` hook queries `db.jobs.where('printerInstanceId').equals(id)` (never `.toArray()` on the full table) plus `db.materials`/`db.maintenanceEvents`, memoized into the two derivations
- `LogMaintenanceModal` — partType/cost/date/printer-hours form, with a nozzleType Select that appears only for `partType === 'nozzle'` and, on submit, both logs the event AND updates the owning `PrinterInstance.nozzleType`
- `PrinterSettings.tsx` gained an additive, collapsible per-instance "Maintenance" section: log button, event history (icon-labelled delete), cumulative cost, abrasive-hours, and a per-part-type next-swap line that reads "Not enough history yet" when no prediction is derivable — the existing `App.tsx` 500h alert is untouched and remains the fallback for that case
- Zero writes to `src/features.ts`, `src/utils/costCalc.ts`, or `src/App.tsx` — verified via `git diff --name-only` after both commits

## Task Commits

Each task was committed atomically:

1. **Task 1: abrasive matcher + amortization/prediction math** - `3b694ce` (feat)
2. **Task 2: LogMaintenanceModal + per-printer Maintenance drill-in** - `9dcdf6f` (feat)

_Both tasks were `tdd="true"`; tests were authored alongside the implementation and passed on first full run — no red-then-fix cycle was needed beyond two self-caught test-authoring bugs (see Deviations)._

## Files Created/Modified
- `src/utils/abrasive.ts` - `detectIsAbrasive`, `resolveIsAbrasive`, `resolveNozzleType` pure matchers
- `src/utils/abrasive.test.ts` - matcher + override + default-to-brass coverage
- `src/db/maintenanceAmortization.ts` - `deriveMaintenanceAmortization` + `predictNextSwap` pure derivations
- `src/db/maintenanceAmortization.test.ts` - divide-by-zero guard, per-part interval tracking, abrasive-hours brass/hardened gating
- `src/hooks/useMaintenanceAmortization.ts` - index-scoped read-only derivation hook
- `src/hooks/useMaintenanceAmortization.test.tsx` - fake-indexeddb-backed hook coverage incl. cross-instance job isolation
- `src/components/LogMaintenanceModal.tsx` - maintenance-event entry form + nozzle-type instance update
- `src/components/LogMaintenanceModal.test.tsx` - conditional nozzleType Select, submit payload, nozzle-type update assertions
- `src/components/PrinterSettings.tsx` - additive `MaintenanceSection` sub-component per instance card
- `src/components/PrinterSettings.test.tsx` - extended with fake-indexeddb setup + 4 new Maintenance drill-in tests

## Decisions Made
- Called `useMaintenanceEvents`/`useMaintenanceAmortization` directly inside `PrinterSettings.tsx`'s new `MaintenanceSection` rather than lifting them into `App.tsx`. The plan's `files_modified` list scoped this plan to `PrinterSettings.tsx` only (no `App.tsx`), and two other wave-2 plans (02, 03) run concurrently and may also touch `App.tsx` — adding hook calls there risked a worktree-merge conflict. Since `useMaintenanceEvents`/`useMaintenanceAmortization` are already-abstracted hooks (not a raw `useLiveQuery`/`db` import), this satisfies the plan's acceptance-criteria grep (`useLiveQuery|from '.*database'` returns nothing in `PrinterSettings.tsx`) while keeping the Dexie-in-orchestrator discipline one layer removed.
- Converted the Maintenance section's collapse/expand toggle to the shared `Button` primitive (`variant="ghost"`, `fullWidth`) instead of a raw `<button>` — the project's `lint:no-raw-html` build gate forbids raw form elements in `src/components/*` outside `src/components/ui/` (where `CollapsibleSection.tsx`'s own raw button lives, exempt only by directory).
- Abrasive-hours accumulation gates on `resolveNozzleType(instance) === 'brass'` (never a literal `instance.nozzleType === 'brass'`), so every pre-Phase-39 instance with `nozzleType: undefined` correctly defaults to brass and participates in abrasive-hours tracking rather than being silently excluded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-authoring bug: default parameter silently overrode an explicit `undefined` argument**
- **Found during:** Task 1 verification (`useMaintenanceAmortization.test.tsx`)
- **Issue:** The test harness's `render(instance: PrinterInstance | undefined = INSTANCE)` used a JS default parameter. Calling `render(undefined)` to test the "no instance" case still received `INSTANCE` because JS default parameters apply whenever the argument is literally `undefined` — the hook itself was correct, the test was wrong.
- **Fix:** Removed the default value and updated all call sites to pass `INSTANCE` explicitly.
- **Files modified:** `src/hooks/useMaintenanceAmortization.test.tsx`
- **Verification:** `npx vitest run src/hooks/useMaintenanceAmortization.test.tsx` — all 5 tests pass
- **Committed in:** `3b694ce` (Task 1 commit)

**2. [Rule 1 - Bug] Raw `<button>` toggle violated the project's `lint:no-raw-html` build gate**
- **Found during:** Task 2 commit attempt (pre-commit hook)
- **Issue:** The Maintenance drill-in's collapse/expand toggle used a raw `<button>` in `src/components/PrinterSettings.tsx`, which lives outside the lint script's `src/components/ui/` exemption.
- **Fix:** Replaced the raw `<button>` with the shared `Button` primitive (`variant="ghost"`, `fullWidth`, `!justify-between !px-0` to preserve the existing layout).
- **Files modified:** `src/components/PrinterSettings.tsx`
- **Verification:** `node scripts/lint-no-raw-html.mjs` passes; `npx vitest run src/components/PrinterSettings.test.tsx` — all 6 tests pass
- **Committed in:** `9dcdf6f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test/lint correctness, no scope creep)
**Impact on plan:** Both fixes were required to get accurate green tests and a passing commit; neither changed the plan's intended behavior or scope.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useMaintenanceAmortization` is ready for Plan 05 to consume for the amortized-$/hr hint + Apply in `CostParametersSection` (Suggestion-Not-Mutation pattern, D-14) — this plan intentionally left `CostParametersSection.tsx` and `costCalc.ts` untouched.
- `resolveIsAbrasive`/`resolveNozzleType` are ready for Plan 05's abrasive-surcharge fold-in (additive new cost line, per RESEARCH.md Pitfall 1 — never a silent `calculateNozzleWear` modification).
- Full suite green: 925 tests / 1 todo, `tsc -b` clean, `lint:no-raw-html` clean.
- No blockers or concerns — `App.tsx`, `src/features.ts`, and `src/utils/costCalc.ts` are unmodified by this plan, confirmed via `git diff --name-only`.

---
*Phase: 39-cost-realism*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created files verified present on disk; task commit hashes (`3b694ce`, `9dcdf6f`) verified present in git log.
