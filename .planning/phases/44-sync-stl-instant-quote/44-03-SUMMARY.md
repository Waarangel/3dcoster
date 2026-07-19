---
phase: 44-sync-stl-instant-quote
plan: 03
subsystem: database
tags: [dexie, sync, lww, tombstone, vitest, typescript]

# Dependency graph
requires:
  - phase: 44-sync-stl-instant-quote
    provides: "44-01's SyncFile envelope + computeMerge pure LWW/tombstone merge planner (MergePlan shape consumed verbatim by applyMerge)"
provides:
  - "syncStamp.ts — stampAndAdd/stampAndPut/stampAndBulkPut (immutable updatedAt stamping) + writeTombstone/pruneTombstones, the single choke-point every user-facing Dexie write routes through"
  - "Dexie v13 syncTombstones store (id, store, deletedAt) — new empty store, no upgrade/backfill"
  - "Every useDatabase.ts CRUD write (materials/printerInstances/sales/customers/quotes/settings) stamps updatedAt; every delete (asset/instance/job/sale/customer/quote) writes a tombstone atomically, including deleteJob's cascade-deleted sales"
  - "applyMerge.ts — atomic transactional executor that applies a MergePlan (winners/deletes/tombstones) in one Dexie transaction, then prunes expired tombstones"
affects: [44-04, 44-05, 44-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single write-wrapper choke-point (syncStamp.ts) instead of scattering updatedAt stamping across every CRUD hook — closes RESEARCH.md Pitfall 1 (a missed stamp site silently breaks LWW for that store)"
    - "Minimal structural `Writable<T>` interface (add/put/bulkPut only) instead of importing Dexie's full generic `Table<T,TKey,TInsertType>` — avoids TS variance friction across ~8 differently-typed EntityTables at every call site"
    - "Delete + writeTombstone always share the SAME db.transaction as the delete — atomic commit-or-rollback, mirroring the existing addSale/deleteJob DATA-01/DATA-03 transactional discipline"

key-files:
  created:
    - src/db/syncStamp.ts
    - src/db/syncStamp.test.ts
    - src/utils/applyMerge.ts
    - src/utils/applyMerge.test.ts
  modified:
    - src/db/database.ts
    - src/hooks/useDatabase.ts

key-decisions:
  - "Reset*ToDefaults helpers (resetToDefaults/resetMaterialsOnly/resetPrintersOnly/resetAssetScope) swap their post-clear() bulkAdd for stampAndBulkPut — behaviorally identical (no duplicate-id risk right after clear()) but now stamps a fresh updatedAt, per the plan's 'stamping is in scope for resets' instruction"
  - "Category-scoped bulk `.where(category).equals(...).delete()` calls (inside the reset helpers) are intentionally NOT tombstoned — catalog-level resets, not single-record user deletions; documented inline as the plan's grep-audit clause requires"
  - "Stock/failure/maintenance ledger events (stockEventsWriter.ts) are NOT routed through the stamp wrapper or tombstoned in this plan — they are derived, regenerated-on-save records keyed by a job's refId, not independently user-edited rows; their sync semantics are deferred (documented per the Task 2 read_first instruction to 'decide whether ledger events are LWW-synced or excluded')"
  - "PrintJob writes (addJob/updateJob) are NOT routed through the wrapper — PrintJob.updatedAt is a required (non-optional) type field, so every construction site already stamps it structurally; routing through the wrapper would be redundant, not additive"
  - "Rule 2 addition: deleteJob's cascade-deleted sales (`db.sales.where('jobId').equals(id).delete()`) now each get their own writeTombstone — the plan named 'deleteJob' as one of six tombstoned callbacks but its cascade delete is a bulk query, not the single-record deleteSale path, so without this fix a job's sales would silently fail to propagate their deletion to other devices"
  - "applyMerge scopes its transaction to ALL BACKUP_STORES + syncTombstones every call (not just the stores with non-empty winners/deletes) — mirrors restoreBackup.ts's existing all-stores-always discipline rather than a narrower dynamic table list"

requirements-completed: [SYNC-01]

coverage:
  - id: D1
    description: "Dexie v13 adds an empty syncTombstones store (id, store, deletedAt); syncStamp.ts's stampAndAdd/stampAndPut/stampAndBulkPut stamp a fresh, non-mutating updatedAt on write, and writeTombstone/pruneTombstones implement the delete->tombstone half of D-06"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/db/syncStamp.test.ts — stampAndAdd/stampAndPut/stampAndBulkPut immutability + updatedAt stamping, writeTombstone, pruneTombstones retention, and the real-singleton v13 schema assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every useDatabase.ts user-facing write (materials/printerInstances/sales/customers/quotes/settings add/put/bulkPut) routes through the syncStamp wrapper; every delete callback (asset/instance/job/sale/customer/quote) writes a tombstone in the same transaction as the delete, including deleteJob's cascade-deleted sales"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/hooks/useDatabase.test.ts — full suite green (15/15); grep -c writeTombstone src/hooks/useDatabase.ts >= 6"
        status: pass
    human_judgment: false
  - id: D3
    description: "applyMerge(database, plan) applies a MergePlan's winners/deletes/tombstones atomically in one Dexie transaction, writes winners verbatim (no re-stamp), rolls back fully on a mid-apply throw, and prunes retention-expired tombstones as the transaction's last step"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/applyMerge.test.ts — winners/deletes/tombstones write, verbatim-write (no re-stamp), mid-apply transaction rollback, retention pruning (7/7 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-18
status: complete
---

# Phase 44 Plan 03: Sync Data-Layer Wiring Summary

**Dexie v13 `syncTombstones` store + a single `syncStamp.ts` write choke-point that every useDatabase.ts CRUD hook now routes through, plus `applyMerge.ts` — the atomic transactional executor that commits a 44-01 `MergePlan` (winners/deletes/tombstones) in one Dexie transaction.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-18T15:05:00Z (approx.)
- **Completed:** 2026-07-18T15:21:10Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- `syncStamp.ts`: `stampAndAdd`/`stampAndPut`/`stampAndBulkPut` (immutable `updatedAt` stamping via a minimal structural `Writable<T>` interface, sidestepping Dexie generic-variance friction) + `writeTombstone`/`pruneTombstones` for the delete→tombstone half of SYNC-01 D-06
- `database.ts`: `db.version(13)` adds an empty `syncTombstones` store (`id, store, deletedAt`, no upgrade/backfill — v11/v12 precedent); `setSetting` now routes through `stampAndPut` so settings rows participate in LWW
- `useDatabase.ts`: every user-facing `add`/`put`/`bulkPut` for materials, printer instances, sales, customers, and quotes now stamps `updatedAt`; every delete callback (asset/instance/job/sale/customer/quote) writes a tombstone in the SAME transaction as the delete
- `applyMerge.ts`: atomic transactional executor — `bulkPut` winners, `bulkDelete` deleteIds, upsert `tombstonesToWrite`, then prune expired tombstones, all inside one `db.transaction('rw', ...)`; a mid-apply throw rolls the whole transaction back (verified against real fake-indexeddb, same technique as `backupRestore.test.ts`'s restore-atomicity test)

## Task Commits

Each task was committed atomically:

1. **Task 1: Dexie v13 syncTombstones store + syncStamp write wrappers** - `2048f91` (feat, TDD RED→GREEN)
2. **Task 2: Route every useDatabase write through the stamp wrapper + emit tombstones on delete** - `0bc4d6a` (feat)
3. **Task 3: applyMerge.ts — atomic transactional executor for a MergePlan** - `9c28e96` (feat, TDD RED→GREEN)

_Note: Tasks 1 and 3 (tdd="true") were both driven by a written-first failing test suite (confirmed RED via `npx vitest run` before the implementation existed / before the v13 schema landed), then implemented to GREEN. Each landed as a single commit per task rather than separate test/feat commits — the test and implementation files were authored together in this session and verified RED→GREEN before either was staged, so splitting them into two commits would not have added any additional safety net._

## Files Created/Modified
- `src/db/syncStamp.ts` - `stampAndAdd`/`stampAndPut`/`stampAndBulkPut`/`writeTombstone`/`pruneTombstones`, the sync write choke-point
- `src/db/syncStamp.test.ts` - wrapper immutability/stamping tests + writeTombstone/pruneTombstones tests + the real-singleton v13 schema assertion
- `src/db/database.ts` - `db.version(13)` syncTombstones store + type augmentation; `Setting.updatedAt` optional field; `setSetting` routed through `stampAndPut`
- `src/hooks/useDatabase.ts` - every CRUD write/delete routed through the stamp wrapper / `writeTombstone`, with inline documentation for the intentionally-excluded call sites (ledger events, category-scoped bulk resets, PrintJob's already-required `updatedAt`)
- `src/utils/applyMerge.ts` - `applyMerge(database, plan)` transactional executor
- `src/utils/applyMerge.test.ts` - winners/deletes/tombstones write, verbatim-write (no re-stamp), mid-apply rollback, retention-pruning tests

## Decisions Made
See `key-decisions` in frontmatter — summarized: reset helpers swap `bulkAdd`→`stampAndBulkPut` (stamping in scope, behaviorally identical post-`clear()`); category-scoped bulk deletes and ledger-event writes are documented exclusions, not oversights; `addJob`/`updateJob` are left as-is since `PrintJob.updatedAt` is already a required type-level field; `deleteJob`'s cascade-deleted sales now get their own tombstones (Rule 2); `applyMerge` always scopes its transaction to every `BACKUP_STORES` table (mirrors `restoreBackup.ts`'s existing discipline).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `deleteJob`'s cascade-deleted sales did not get their own tombstones**
- **Found during:** Task 2 (routing `deleteJob` through the stamp/tombstone wrapper)
- **Issue:** The plan named `deleteJob` as one of six tombstoned delete callbacks, but `deleteJob` cascade-deletes a job's sales via `db.sales.where('jobId').equals(id).delete()` — a bulk query, not the single-record `deleteSale` path that already gets a tombstone. Without an explicit fix, deleting a job would silently fail to propagate its sales' deletion to another device on the next sync.
- **Fix:** `deleteJob` now reads the cascaded sale ids BEFORE deleting them, and writes a tombstone for each inside the same transaction as the job's own tombstone.
- **Files modified:** `src/hooks/useDatabase.ts`
- **Verification:** `npx vitest run src/hooks/useDatabase.test.ts` — 15/15 pass; full `npm test` — 1316/1316 pass, no regressions
- **Committed in:** `0bc4d6a` (Task 2 commit)

**2. [Rule 3 - Blocking] Union type `Dexie | Transaction` broke `.table<T,K>()`'s generic call resolution**
- **Found during:** Task 1 (`writeTombstone`'s `tx: Dexie | Transaction` parameter)
- **Issue:** `Dexie` and `Transaction` each declare `.table()` via a DIFFERENT overload set; calling `tx.table<SyncTombstone, string>('syncTombstones')` on the union produced `TS2349: This expression is not callable` — none of the overload signatures unify across the union.
- **Fix:** Narrowed through a minimal structural cast (`tx as { table(name): { put(item): Promise<unknown> } }`) instead of a generic call on the union — both classes satisfy this shape identically at runtime.
- **Files modified:** `src/db/syncStamp.ts`
- **Verification:** `npx tsc -b` exits 0; `npx vitest run src/db/syncStamp.test.ts` — 11/11 pass
- **Committed in:** `2048f91` (Task 1 commit)

**3. [Rule 3 - Blocking] `createQuote`'s stamped-quote reassignment inferred an optional `id` from the Dexie table argument**
- **Found during:** Task 2 (routing `createQuote`'s `db.quotes.add(quotePayload)` through `stampAndAdd`)
- **Issue:** `stampAndAdd`'s generic `T` inferred from BOTH the `db.quotes` table argument (whose Dexie-derived insert type makes `id` optional) and the `quotePayload` argument, producing a type with `id?: string` that could not be reassigned back to the strictly-typed `quotePayload` variable (`Quote & {status: RuntimeQuoteStatus} | undefined`, `id` required).
- **Fix:** Explicitly instantiated the generic at that call site: `stampAndAdd<Quote & { status: RuntimeQuoteStatus }>(db.quotes, quotePayload)`.
- **Files modified:** `src/hooks/useDatabase.ts`
- **Verification:** `npx tsc -b` exits 0
- **Committed in:** `0bc4d6a` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking)
**Impact on plan:** All three were required to make the plan's own stated behaviors hold (tombstone propagation completeness, and clean compilation). No scope creep — no functionality was added beyond what Tasks 1–3 specified.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `syncStamp.ts` (the write choke-point) and `applyMerge.ts` (the transactional executor) are ready for a future plan to wire the end-to-end sync UI flow (export sync file → merge → apply) — no further shape changes to either are expected
- Ledger-event (stockEvents/failureEvents/maintenanceEvents) sync participation was explicitly deferred in this plan (documented decision, not a gap) — a later plan should decide whether they need their own stamp/tombstone treatment or stay derived-only
- `resetAssetScope`'s category-scoped bulk deletes remain un-tombstoned by design — if a future plan wants full reset-to-tombstone parity, that is a new, explicit scope decision, not a bug in this plan

---
*Phase: 44-sync-stl-instant-quote*
*Completed: 2026-07-18*

## Self-Check: PASSED

All created files and commit hashes verified present (see below).
