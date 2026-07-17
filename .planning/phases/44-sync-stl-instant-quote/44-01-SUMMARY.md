---
phase: 44-sync-stl-instant-quote
plan: 01
subsystem: sync
tags: [dexie, backup, sync, lww, tombstone, vitest, typescript]

# Dependency graph
requires:
  - phase: 43-pro-backend
    provides: Dexie v12 schema shape (final v2.0 stores) the sync envelope evolves from
provides:
  - Sync-file envelope contract (SyncFile/SyncTombstone/SyncFileMeta) extending BackupFile
  - updatedAt on every BACKUP_STORES entry's DATE_FIELDS (LWW basis)
  - validateSyncFile — schema-version gate + tombstones/syncMeta checks, delegating
    all structural/forbidden-key/count validation to validateBackupFile
  - computeMerge — pure LWW + tombstone edit-wins (both directions) + conflict-flagged
    per-store merge planner, no Dexie I/O
  - Both v2.0 Phase 44 NEW-badge keys (sync-devices, stl-estimate)
affects: [44-02, 44-03, 44-04, 44-05, 44-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure merge planner (computeMerge) — mirrors src/db/backfill.ts reconcile* pure-function style, no Dexie/React import"
    - "Envelope extension (SyncFile extends BackupFile) lets validateSyncFile delegate to validateBackupFile instead of re-implementing structural validation"

key-files:
  created:
    - src/utils/syncMerge.ts
    - src/utils/syncMerge.test.ts
  modified:
    - src/utils/backupSchema.ts
    - src/utils/backupSchema.test.ts
    - src/utils/backupRestore.ts
    - src/features.ts

key-decisions:
  - "Symmetric tombstone handling: computeMerge resolves BOTH directions — a remote tombstone vs a surviving local edit (explicit plan bullet), and a local tombstone vs a resurrecting remote edit (added for correctness/symmetry, not explicitly spelled out in the plan's behavior bullets but required by the MergeInput signature carrying both localTombstones and remoteTombstones)"
  - "Exported isPlainRecord/hasForbiddenKey from backupRestore.ts (previously private) so syncMerge.ts's tombstone-array validation reuses the exact same forbidden-key guard instead of writing a second, weaker validator"
  - "Conflict flag scoped strictly to the two-live-records case (both updatedAt > lastSyncedAt) per the plan's literal D-07 wording — a tombstone-vs-record collision is resolved by the edit-wins rule, not additionally counted as a conflict"

requirements-completed: [SYNC-01]

coverage:
  - id: D1
    description: "backupSchema.ts carries the sync-file envelope contract (SyncTombstone/SyncFile/SyncFileMeta types, SYNC_TOMBSTONE_RETENTION_DAYS=90) and updatedAt in every store's DATE_FIELDS, without bumping BACKUP_FORMAT_VERSION"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/backupSchema.test.ts — DATE_FIELDS/SyncTombstone/SyncFile/SYNC_TOMBSTONE_RETENTION_DAYS describe blocks"
        status: pass
    human_judgment: false
  - id: D2
    description: "validateSyncFile rejects wrong-format-version and forbidden-key sync files with clear messages, delegating structural checks to validateBackupFile"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncMerge.test.ts — 'validateSyncFile — schema version gate' and 'delegates structural + forbidden-key checks' describe blocks"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeMerge implements last-write-wins (newer updatedAt wins, missing=oldest, equal=local), tombstone edit-wins in both directions, per-store added/updated/deleted counts with a distinct conflict flag, and retention-pruned tombstone propagation"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncMerge.test.ts — 'computeMerge — last-write-wins', 'tombstone edit-wins', 'summary counts + conflicts', 'tombstone retention pruning' describe blocks"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both v2.0 Phase 44 NEW-badge keys (sync-devices, stl-estimate) registered in features.ts"
    verification:
      - kind: other
        ref: "grep -c \"sync-devices\" src/features.ts / grep -c \"stl-estimate\" src/features.ts — both return 1"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-17
status: complete
---

# Phase 44 Plan 01: Sync-File Envelope + Merge Planner Summary

**Pure LWW/tombstone merge planner (`computeMerge`) and schema-version-gated `validateSyncFile`, built on a `SyncFile` envelope that extends the existing `BackupFile` contract with `updatedAt`-stamped DATE_FIELDS and tombstones — zero Dexie access, fully unit-tested.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-17T13:46:25Z
- **Completed:** 2026-07-17T13:51:59Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Extended `backupSchema.ts` with `SyncTombstone`/`SyncFile`/`SyncFileMeta` types, `TOMBSTONE_DATE_FIELDS`, and `SYNC_TOMBSTONE_RETENTION_DAYS = 90`; appended `updatedAt` to every one of the 11 `BACKUP_STORES`' `DATE_FIELDS` entries additively, without bumping `BACKUP_FORMAT_VERSION`
- Built `syncMerge.ts` with two pure exports: `validateSyncFile` (schema-version gate + tombstones/syncMeta checks, delegating structural/forbidden-key/count validation to `validateBackupFile`) and `computeMerge` (LWW + tombstone edit-wins in both directions + per-store conflict-flagged summary + retention-pruned tombstone propagation)
- Registered both Phase 44 NEW-badge keys (`sync-devices`, `stl-estimate`) in `features.ts`, following the Phase 39 Plan 01 single-owner convention

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1: Extend the backup contract into a sync-file envelope** — `f652a6d` (test, RED) → `292d190` (feat, GREEN)
2. **Task 2: syncMerge.ts — validateSyncFile + LWW/tombstone computeMerge** — `2c98fe1` (test, RED) → `5c98a56` (feat, GREEN)
3. **Task 3: Register both phase NEW-badge keys in features.ts** — `b3912bb` (feat)

_TDD tasks 1 and 2 each ran full RED→GREEN cycles; no REFACTOR commit was needed for either._

## Files Created/Modified
- `src/utils/syncMerge.ts` - `validateSyncFile` + `computeMerge` pure functions, plus their supporting types
- `src/utils/syncMerge.test.ts` - LWW / tombstone (both directions) / schema-version / summary-counts / retention-pruning / settings-keyed-by-key coverage (20 tests)
- `src/utils/backupSchema.ts` - `SyncTombstone`/`SyncFile`/`SyncFileMeta` types, `TOMBSTONE_DATE_FIELDS`, `SYNC_TOMBSTONE_RETENTION_DAYS`, `updatedAt` added to all 11 stores' `DATE_FIELDS`
- `src/utils/backupSchema.test.ts` - new Phase 44-01 describe blocks + updated two Phase 39 exact-equality assertions to containment (additive `updatedAt`)
- `src/utils/backupRestore.ts` - exported `isPlainRecord`/`hasForbiddenKey` (previously private) for reuse by `syncMerge.ts`
- `src/features.ts` - `sync-devices` and `stl-estimate` NEW-badge keys dated 2026-07-17

## Decisions Made
- Symmetric tombstone handling implemented in both directions (see key-decisions above) — the plan's explicit truth only names the remote-tombstone-vs-local-edit case, but `MergeInput` carries both `localTombstones` and `remoteTombstones`, and omitting the mirror case would silently resurrect nothing when a local deletion should be overridden by a newer remote edit
- Reused `validateBackupFile`'s `isPlainRecord`/`hasForbiddenKey` (exported, not duplicated) for tombstone-array validation, keeping the "never a second weaker validator" contract from the plan's threat model (T-44-01-01)
- Conflict flag scoped to the two-live-records LWW case only, per the plan's literal wording

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing exact-equality DATE_FIELDS tests broke under the additive `updatedAt` change**
- **Found during:** Task 1 (backupSchema.ts extension)
- **Issue:** Two Phase 39 tests (`backupSchema.test.ts`) asserted `DATE_FIELDS.failureEvents`/`.maintenanceEvents` with `toEqual(['failedAt'])`/`toEqual(['occurredAt'])` — exact-array equality that legitimately breaks once `updatedAt` is appended, even though the underlying behavior (existing field preserved) is correct per the plan
- **Fix:** Changed the two assertions to `toContain` (containment), matching the "additive, not replaced" contract the plan itself specifies
- **Files modified:** `src/utils/backupSchema.test.ts`
- **Verification:** `npx vitest run src/utils/backupSchema.test.ts` — all 27 tests pass
- **Committed in:** `f652a6d` (Task 1 RED commit, since the fix was part of writing the correct RED baseline)

**2. [Rule 3 - Blocking] `__proto__` test fixture used object-literal syntax, which sets the prototype rather than creating an own property**
- **Found during:** Task 2 (syncMerge.ts tests)
- **Issue:** `{ id: 'm1', __proto__: {...} }` written as an object literal does not create an own `__proto__` property (JS language semantics), so `hasForbiddenKey`'s `Object.keys()` scan never saw it — test passed the wrong assertion path
- **Fix:** Rebuilt the fixture via `JSON.parse('{"id":"m1","__proto__":{...}}')`, mirroring the existing `backupRestore.test.ts` prototype-pollution-defense pattern; also typed `emptyData()`'s return as `Record<string, unknown[]>` so the JSON.parse-derived record type-checks under `tsc -b`
- **Files modified:** `src/utils/syncMerge.test.ts`
- **Verification:** `npx tsc -b` exits 0; `npx vitest run src/utils/syncMerge.test.ts` — all 20 tests pass
- **Committed in:** `5c98a56` (Task 2 GREEN commit)

**3. [Rule 3 - Blocking] Comment text duplicated the literal `sync-devices`/`stl-estimate` key strings, breaking the plan's own `grep -c ... returns 1` acceptance criterion**
- **Found during:** Task 3 (features.ts registration)
- **Issue:** First draft of the ownership comment named both keys again in prose (`44-06 consumes 'sync-devices'`), so `grep -c "sync-devices" src/features.ts` returned 2, not 1
- **Fix:** Reworded the comment to describe the consuming UI surfaces without repeating the literal quoted key strings
- **Files modified:** `src/features.ts`
- **Verification:** `grep -c "sync-devices" src/features.ts` and `grep -c "stl-estimate" src/features.ts` both return 1; `npx tsc -b` exits 0
- **Committed in:** `b3912bb` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All three were required to make the plan's own stated behaviors/acceptance criteria hold. No scope creep — no functionality was added beyond what Tasks 1–3 specified.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `syncMerge.ts` (`validateSyncFile` + `computeMerge`) and the extended `backupSchema.ts` envelope are ready for plan 44-03's `applyMerge` Dexie-transaction executor to consume directly — no further shape changes expected
- `updatedAt` stamping at every write call site (D-05) and delete→tombstone conversion (D-06) are NOT yet wired into `useDatabase.ts` — that write-layer work is explicitly out of scope for this plan and belongs to a later Wave-1/Wave-2 plan per the phase's plan breakdown
- Both NEW-badge keys are registered; no other Wave-1 plan should write `src/features.ts`

---
*Phase: 44-sync-stl-instant-quote*
*Completed: 2026-07-17*
