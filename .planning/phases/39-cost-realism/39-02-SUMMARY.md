---
phase: 39-cost-realism
plan: 02
subsystem: ui
tags: [failure-tracking, dexie, react-hooks, dexie-react-hooks, jobs-manager, reports]

# Dependency graph
requires:
  - phase: 39-cost-realism
    plan: 01
    provides: "failureEvents Dexie store, FailureEvent type, useFailureEvents CRUD hook, log-failure NewBadge key"
provides:
  - "deriveFailureRate pure fn (D-05..D-08 empirical rate math with printer-fallback provenance)"
  - "useFailureRate read-only hook (indexed db.jobs.where('printerInstanceId') query + derivation)"
  - "LogFailureModal (standalone or job-linked failure entry form)"
  - "JobsManager per-row Log Failure icon action with stock-deduction prefill"
  - "ReportsSection Failures ledger sub-section (grouped by printer/material + standalone log)"
affects: [39-05-calculator-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-level provenance fallback (exact -> printer-fallback, never global) for empirical rate derivation"
    - "Indexed Dexie query (where('printerInstanceId')) instead of full toArray() for a read-only derived-value hook"
    - "Prefill-object pattern for a shared modal opened from two different call sites (job row vs standalone ledger)"

key-files:
  created:
    - src/db/failureRate.ts
    - src/db/failureRate.test.ts
    - src/hooks/useFailureRate.ts
    - src/hooks/useFailureRate.test.tsx
    - src/components/LogFailureModal.tsx
    - src/components/LogFailureModal.test.tsx
    - src/components/ReportsSection.test.tsx
  modified:
    - src/components/JobsManager.tsx
    - src/components/JobsManager.test.tsx
    - src/components/ReportsSection.tsx
    - src/App.tsx

key-decisions:
  - "useFailureRate is read-only and intentionally unused by any UI in this plan — it is exported for Plan 05's calculator orchestrator to consume, per the plan's explicit scope boundary (no calculator files touched here)"
  - "ReportsSection computes its own printer/material grouping internally via useMemo rather than requiring the orchestrator to pre-group — simpler prop surface (raw failureEvents + printerInstances + filamentAssets) while staying props-in"
  - "JobsManager gained a new required printerInstances prop (threaded from App.tsx's existing usePrinterInstances() call) to populate LogFailureModal's printer Select — no new hook subscription needed"
  - "Delete-confirmation in ReportsSection reuses the shared ConfirmModal primitive rather than a hand-rolled dialog, matching project convention"

requirements-completed: [FAIL-01, FAIL-02, FAIL-04]

# Metrics
duration: 45min
completed: 2026-07-06
---

# Phase 39 Plan 2: Failure-Engine Data Consumer + UI Summary

**Empirical failure-rate derivation (pure fn + read-only hook) and the full FAIL-01/04 UI layer: LogFailureModal, a one-tap per-row "Log Failure" action in JobsManager with stock-deduction prefill, and a grouped Failures ledger in the Reports tab.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-06T15:05:17Z
- **Tasks:** 3
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments

- `deriveFailureRate` (src/db/failureRate.ts) implements D-05..D-08: `rate = failures / (jobs + failures)` per printer×material combo, returns `null` below the 5-attempt threshold (D-06), and applies a one-level printer-wide fallback with `provenance: 'printer-fallback'` when the exact combo is thin but the printer as a whole clears the threshold — **never** cascading to a global all-printers rate
- `dominantMaterialId` picks the highest-grams `FilamentUsage` row per job (D-08), null-safe for jobs with no filament rows
- `useFailureRate(printerInstanceId, materialId)` wires the pure fn to live Dexie data via an **indexed** `db.jobs.where('printerInstanceId').equals(...)` query (never a full `.toArray()` over every saved job, per Pitfall 4) combined with `useFailureEvents()` via `useMemo`; this hook is read-only and unused by any UI in this plan — it is the interface Plan 05's calculator orchestrator will consume
- `LogFailureModal` — a form modal (Modal + Select/Input/Textarea/InfoTooltip shell matching `DeclineQuoteModal`'s chrome) with a printer Select, material Select, clamped 0–100 %-completion input, a whitelisted 6-option reason enum (adhesion/stringing/clog/mechanical/power_loss/other), and optional notes rendered as plain text. Job-linked submissions compute `gramsWasted = jobFilamentGrams × (%completion / 100)`, which `useFailureEvents.logFailure` deducts from stock (D-03); standalone submissions accept an optional manual grams field
- JobsManager: a one-tap "Log Failure" icon action added to every job row (shared `IconButton`, warning-triangle icon, amber tint, `aria-label="Log Failure {job.name}"`), positioned after Edit/Delete, guarded with `e.stopPropagation()` so it doesn't trigger row expand/collapse. Pre-fills the modal with the row's `printerInstanceId`, dominant material, and total filament grams (summed across all filament rows). References the `log-failure` NewBadge key already registered by Plan 01 (no `features.ts` write — avoiding the parallel Plan 04 write conflict)
- JobsManager gained a new `printerInstances` prop (threaded from App.tsx's existing `usePrinterInstances()` call) so the modal's printer Select has real printer nicknames
- ReportsSection: a new "Failures" sub-section rendered beneath the existing sales report — **not a new top-level tab** (D-04) — showing grouped failure counts by printer and by material, a chronological ledger (reason/percent-complete/relative date/notes), per-entry delete via the shared `DeleteButton` (routes to `useFailureEvents().deleteFailure`, which self-corrects any paired stock deduction), and a standalone "Log failure" primary-CTA button that opens `LogFailureModal` with no job prefill (D-01)
- App.tsx threads `failureEvents` (new `useFailureEvents()` call), `printerInstances`, and a new `filamentAssets` memo (assets filtered to `category === 'filament'`) into both `JobsManager` and `ReportsSection` — additive, no calculator files touched

## Task Commits

Each task was committed atomically (all `tdd="true"` — tests authored alongside the implementation in the same commit, matching Plan 01's convention):

1. **Task 1: deriveFailureRate pure fn + useFailureRate hook** - `429ef29` (feat)
2. **Task 2: LogFailureModal + JobsManager row action + stock deduction** - `38a004f` (feat)
3. **Task 3: Failures ledger section in Reports tab + standalone log button** - `fc0f636` (feat)

## Files Created/Modified

- `src/db/failureRate.ts` - `deriveFailureRate` + `dominantMaterialId` pure functions (D-05..D-08)
- `src/db/failureRate.test.ts` - 8 tests covering exact/fallback/null/dominant-material/null-safety paths
- `src/hooks/useFailureRate.ts` - read-only hook, indexed Dexie query + derivation via useMemo
- `src/hooks/useFailureRate.test.tsx` - 4 tests (createRoot+act harness, fake-indexeddb)
- `src/components/LogFailureModal.tsx` - failure-entry form modal (standalone or job-linked)
- `src/components/LogFailureModal.test.tsx` - 4 tests covering the trio, prefill, and gramsWasted computation
- `src/components/JobsManager.tsx` - per-row Log Failure icon action, `printerInstances` prop, `handleLogFailure`/`handleCloseLogFailureModal`, `filamentAssets` memo, `LogFailureModal` render, `WarningTriangleIcon`
- `src/components/JobsManager.test.tsx` - `onLogFailure={noop}` added to 4 direct `JobCard` fixtures (TypeScript required-prop fix)
- `src/components/ReportsSection.tsx` - Failures sub-section (grouping memos, ledger, standalone log button, delete confirm via `ConfirmModal`), new props (`failureEvents`, `printerInstances`, `filamentAssets`)
- `src/components/ReportsSection.test.tsx` - 5 tests covering the grouped display, empty state, standalone-log flow, delete + stock reversal, and the no-`dangerouslySetInnerHTML` guarantee
- `src/App.tsx` - `useFailureEvents()` call, `filamentAssets` memo, `printerInstances` threaded to `JobsManager`, all three new props threaded to `ReportsSection`

## Decisions Made

- `useFailureRate` is deliberately not consumed by any UI in this plan — it's the read-only interface Plan 05's calculator orchestrator will wire into the cost hint, keeping this plan's scope strictly to the failure-logging/ledger UI (no calculator/costCalc files touched, confirmed by `git diff --stat` against the base commit).
- ReportsSection computes its own printer/material grouping via `useMemo` rather than requiring the orchestrator (App.tsx) to pre-aggregate — kept the prop surface simple (raw `failureEvents` + `printerInstances` + `filamentAssets`) while staying props-in per the plan's architecture note.
- Reused the shared `ConfirmModal` primitive for the Failures-ledger delete confirmation instead of a hand-rolled dialog — matches the project's established a11y/styling convention (Modal focus trap, consistent danger-button treatment).
- Added a `WarningTriangleIcon` module-scope SVG component in JobsManager.tsx (no existing icon fit); mirrors the file's existing `ChevronRightIcon`/`TagIcon` pattern rather than adding a new file to `src/components/ui/icons/` for a single-use icon.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JobsManager.test.tsx directly renders `<JobCard>` at 4 sites, all of which needed the new required `onLogFailure` prop**
- **Found during:** Task 2, `npx tsc -b` verification pass
- **Issue:** Adding `onLogFailure` as a required field on `JobCardProps` (to keep the interface consistent with every other row-action callback, all of which are required) broke 4 existing direct `<JobCard>` fixtures in the test file with `TS2741: Property 'onLogFailure' is missing`.
- **Fix:** Added `onLogFailure={noop}` immediately after the existing `onDeleteSale={noop}` line at all 4 call sites (existing `noop` fixture already imported/defined in the test file).
- **Files modified:** `src/components/JobsManager.test.tsx`
- **Verification:** `npx tsc -b` clean; `npx vitest run src/components/JobsManager.test.tsx` 77/77 passing.
- **Committed in:** `38a004f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking TypeScript fix, no behavior change to existing tests)
**Impact on plan:** None — mechanical prop-completeness fix required by the new interface field; no test assertions or behavior changed.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `useFailureRate` (the empirical-rate hook) is ready for Plan 05 to consume in the CostCalculator's derived-values layer, exactly per this plan's scope boundary.
- The `log-failure` NewBadge key (registered by Plan 01) is now live on both the JobsManager row action and, implicitly, discoverable via the Reports Failures section's standalone Log button.
- No blockers or concerns — `src/features.ts` and all calculator/costCalc files remain untouched, confirmed by `git diff --stat` against the phase's wave-2 base commit. Full project test suite: 910 passing / 1 todo, `tsc -b` clean.

---
*Phase: 39-cost-realism*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created files verified present on disk; all three task commit hashes (`429ef29`, `38a004f`, `fc0f636`) verified present in git log.
