---
phase: 39-cost-realism
plan: 01
subsystem: database
tags: [dexie, indexeddb, typescript, react-hooks, backup-restore]

# Dependency graph
requires:
  - phase: 38-foundation
    provides: CostCalculator split (useCostForm/useCostDerivedValues) that Plan 05 will extend with TOU-aware electricity cost
provides:
  - Dexie v12 schema with failureEvents + maintenanceEvents stores
  - FailureEvent, MaintenanceEvent, TouBand type definitions
  - PrintJob snapshot fields (touStartTime, touRateUsedPerKwh, maintenanceCostAtSave)
  - Asset.isAbrasive, PrinterInstance.nozzleType additive fields
  - Backup/restore support for both new stores
  - useFailureEvents / useMaintenanceEvents CRUD hooks
  - touElectricity.ts pure TOU rate-resolution module
  - features.ts NEW-badge keys (log-failure, maintenance-log) for Plans 02/04
affects: [39-02-failure-logging, 39-03-tou-settings, 39-04-maintenance-wear, 39-05-calculator-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only ledger with deterministic refId (failureEvents -> stockEvents reversal)"
    - "Snapshot-at-save pattern for TOU rate/start-time on PrintJob (mirrors fixedCostsAtSave)"
    - "Pure minutes-since-midnight modulo-1440 math for overnight TOU band wrap-around"

key-files:
  created:
    - src/hooks/useFailureEvents.ts
    - src/hooks/useMaintenanceEvents.ts
    - src/utils/touElectricity.ts
    - src/utils/backupSchema.test.ts
    - src/hooks/useFailureEvents.test.tsx
    - src/hooks/useMaintenanceEvents.test.tsx
    - src/utils/touElectricity.test.ts
  modified:
    - src/types.ts
    - src/db/database.ts
    - src/utils/backupSchema.ts
    - src/features.ts
    - src/utils/backupExport.test.ts
    - src/utils/backupRestore.test.ts
    - src/components/BackupRestoreSection.test.tsx

key-decisions:
  - "Both new Dexie stores land in a single v12 stanza with no .upgrade() block, following the v11 stockEvents precedent exactly (new empty stores need no backfill)"
  - "featureReleases keys for log-failure/maintenance-log registered in this foundation plan (not Plans 02/04) to avoid a wave-2 parallel-write conflict on features.ts"
  - "touElectricity.ts stays a pure module (no datetime library) using integer minute arithmetic with modulo 1440, per RESEARCH.md's YAGNI guidance"

patterns-established:
  - "Deterministic cross-store refId (failure-${id}) lets deleteFailure reverse a paired stockEvent deduction without a join table"
  - "isElectricityConfig extended with an additive Array.isArray(touBands) check, following the isShippingConfig/isMarketplaceFees optional-array precedent"

requirements-completed: [FAIL-01, TOU-01, TOU-02, WEAR-01]

# Metrics
duration: 35min
completed: 2026-07-06
---

# Phase 39 Plan 01: Data & Type Foundation Summary

**Dexie v12 schema (failureEvents + maintenanceEvents stores), FailureEvent/MaintenanceEvent/TouBand types, backup/restore extension, CRUD hooks, and a pure overnight-wrap-aware TOU electricity rate resolver — the shared foundation Plans 02-05 build on in parallel.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-06T12:24:00Z (approx, per STATE.md prior session)
- **Completed:** 2026-07-06T12:59:40Z
- **Tasks:** 2
- **Files modified:** 14 (7 created, 7 modified)

## Accomplishments
- Dexie bumped to v12 with two new empty stores (`failureEvents`, `maintenanceEvents`), no upgrade/backfill needed
- Full additive type surface: `FailureEvent`, `MaintenanceEvent`, `TouBand` interfaces; `PrintJob.touStartTime`/`touRateUsedPerKwh`/`maintenanceCostAtSave`; `Asset.isAbrasive`; `PrinterInstance.nozzleType`
- Both new stores wired into the backup/restore contract (`BackupData`, `BACKUP_STORES`, `DATE_FIELDS`) and locked with a new `backupSchema.test.ts`
- `useFailureEvents` / `useMaintenanceEvents` hooks match the `useStockEvents` three-part template (useLiveQuery -> useMemo/useCallback) with `Number.isFinite` guards on every numeric write
- `useFailureEvents.logFailure` writes a paired `stockEvents` deduction with a deterministic `failure-${id}` refId when a job + gramsWasted are present, and `deleteFailure` reverses it by the same refId
- `touElectricity.ts` pure module: `resolveWeightedCostPerKwh` handles same-day bands, multi-band prints, and overnight wrap-around via minutes-since-midnight modulo-1440 arithmetic; `parseHHMM` strictly validates "HH:MM" and falls back to the flat rate on any malformed input
- Both `log-failure` and `maintenance-log` NEW-badge keys registered in `features.ts` up front, so Plans 02 and 04 can reference them without touching the shared registry file themselves

## Task Commits

Each task was committed atomically:

1. **Task 1: New types, Dexie v12 stores, backup inclusion, and NEW-badge registry keys** - `ca93f6b` (feat)
2. **Task 2: Event-store hooks (useFailureEvents, useMaintenanceEvents) + touElectricity pure math** - `fe9266c` (feat)

_Both tasks were `tdd="true"`; tests were authored alongside the implementation in the same commit per the plan's task-level TDD grouping (RED+GREEN combined per task, not split into separate commits) — the plan's `<behavior>` blocks were converted into concrete `it()` tests that passed on first run without needing a red-then-fix cycle._

## Files Created/Modified
- `src/types.ts` - FailureEvent/MaintenanceEvent/TouBand interfaces; PrintJob/Asset/PrinterInstance/ElectricityConfig additive fields
- `src/db/database.ts` - db.version(12) stanza; EntityTable intersection; isElectricityConfig extension
- `src/utils/backupSchema.ts` - BackupData/BACKUP_STORES/DATE_FIELDS extended with both new stores
- `src/features.ts` - `log-failure` and `maintenance-log` NEW-badge keys
- `src/hooks/useFailureEvents.ts` - failureEvents CRUD hook with stock-deduction reversal
- `src/hooks/useMaintenanceEvents.ts` - maintenanceEvents CRUD hook
- `src/utils/touElectricity.ts` - pure `resolveWeightedCostPerKwh` + `parseHHMM`
- `src/utils/backupSchema.test.ts` - new test file locking the schema-constant contract
- `src/hooks/useFailureEvents.test.tsx` - hook tests via the project's raw createRoot+act harness
- `src/hooks/useMaintenanceEvents.test.tsx` - hook tests via the same harness
- `src/utils/touElectricity.test.ts` - pure-module tests incl. explicit overnight-wrap case
- `src/utils/backupExport.test.ts`, `src/utils/backupRestore.test.ts`, `src/components/BackupRestoreSection.test.tsx` - Rule 1 fixture-schema fixes (see below)

## Decisions Made
- Both new stores land in one v12 stanza with no `.upgrade()` block — matches the v11 `stockEvents` precedent (new empty stores never need backfill).
- `log-failure`/`maintenance-log` feature keys are owned by this plan (not Plans 02/04) specifically to avoid two wave-2 plans racing to edit `features.ts` in parallel.
- No TOU feature key was added — TOU is a Settings config surface per the plan's own guidance, not a discrete badged UI element (deferred to whichever later plan actually adds a user-facing TOU affordance, if any).
- `touElectricity.ts` intentionally has zero dependencies (no datetime library) — integer minute arithmetic with `% 1440` is sufficient and keeps the module trivially pure/testable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing backup-fixture tests broke once BACKUP_STORES grew from 9 to 11 entries**
- **Found during:** Task 1 verification (`npx vitest run src/utils/backupSchema.test.ts src/db`)
- **Issue:** `buildBackupFile`/`restoreBackup` iterate `BACKUP_STORES` generically and call `database.table(store)` for every entry. Three existing test files (`backupExport.test.ts`, `backupRestore.test.ts`, `BackupRestoreSection.test.tsx`) construct their own isolated `v10`-shaped Dexie test databases that only declare the original 9 stores. Once `BACKUP_STORES` included `failureEvents`/`maintenanceEvents`, every one of those tests threw `InvalidTableError: Table failureEvents does not exist`.
- **Fix:** Bumped each test file's local `makeTestDb()`/fixture Dexie definition from `db.version(10)` to `db.version(12)`, adding the two new store schema strings (`'id, printerInstanceId, materialId, jobId, failedAt'` / `'id, printerInstanceId, partType, occurredAt'`) verbatim from the production `database.ts` v12 stanza.
- **Files modified:** `src/utils/backupExport.test.ts`, `src/utils/backupRestore.test.ts`, `src/components/BackupRestoreSection.test.tsx`
- **Verification:** `npx vitest run` (full suite) — 74 files / 889 tests / 1 todo, all green
- **Committed in:** `ca93f6b` (backupExport/backupRestore fixes, part of Task 1 commit) and `fe9266c` (BackupRestoreSection fix, discovered during Task 2's full-suite sanity pass, included in Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — regression from the intentional schema growth this plan introduces)
**Impact on plan:** Necessary correctness fix; no scope creep. The three touched test files only had their fixture Dexie schema strings updated — no assertions or test intent changed.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dexie v12 schema, all Phase 39 types, backup/restore support, both event-store hooks, and the pure TOU math module are complete and fully tested (889/889 tests green, `tsc -b` clean).
- Plans 02 (failure logging UI), 03 (TOU settings UI), and 04 (maintenance/wear UI) can now build in parallel without touching shared schema/type/registry files.
- Plan 05 (calculator integration) has `resolveWeightedCostPerKwh` ready to wire into `calculateElectricityCost`, and the `touStartTime`/`touRateUsedPerKwh`/`maintenanceCostAtSave` snapshot fields ready for `calculateCost`'s save path.
- No blockers or concerns — calculator suite (`src/components/calculator/`) remains untouched and green, confirming this plan did not encroach on Plan 05's reserved files.

---
*Phase: 39-cost-realism*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created files verified present on disk; all task commit hashes (`ca93f6b`, `fe9266c`, `f655415`) verified present in git log.
