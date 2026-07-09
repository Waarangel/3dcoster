---
phase: 41-quick-win-features
plan: 01
subsystem: database
tags: [typescript, dexie, backup-restore, types, feature-flags]

# Dependency graph
requires:
  - phase: 40-insight-layer
    provides: Stable Dexie v12 schema and existing optional-field/NEW-badge conventions (isAbrasive, targetHourlyRate, log-failure/maintenance-log badge keys) that this plan replicates for four new fields.
provides:
  - HygroscopicityClass and TaxJurisdiction string-literal unions in src/types.ts
  - Asset.openedAt/storageLocation/dryingLog/hygroscopicityOverride optional fields (LIFE-01 spool lifecycle)
  - Quote.variantsSnapshot optional by-value snapshot field (CONN-03 Quote Variants)
  - UserProfile.taxJurisdiction/customTaxThresholdAmount/customTaxThresholdLabel optional fields (LIFE-02 tax threshold)
  - Four featureReleases NEW-badge keys: reprice-alerts, quote-variants, spool-lifecycle, tax-threshold
  - DATE_FIELDS.materials now includes 'openedAt' so backup restore rehydrates it to a Date
affects: [41-02-PLAN, 41-03-PLAN, 41-04-PLAN, 41-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional, non-indexed field additions to existing Dexie stores need zero db.version()/.upgrade() — only a default-fallback at the read site (mirrors isAbrasive/lowStockThreshold/targetHourlyRate)."
    - "New Date-typed fields on any BACKUP_STORES table must be added to backupSchema.ts DATE_FIELDS or they silently stay ISO strings after restore (Pitfall 4, now closed for materials.openedAt)."

key-files:
  created: []
  modified:
    - src/types.ts
    - src/features.ts
    - src/utils/backupSchema.ts
    - src/utils/backupExport.test.ts

key-decisions:
  - "HygroscopicityClass override field (Asset.hygroscopicityOverride) uses a 3-value string-literal union, not a boolean, since hygroscopicity isn't a binary override like isAbrasive."
  - "Asset.dryingLog stores date-only ISO strings (string[]), NOT Date[] — deliberately excluded from DATE_FIELDS so the moisture-risk clock can parse the last entry at read time without corrupting free-text-shaped values."
  - "Quote.variantsSnapshot is a by-value snapshot computed at Generate time (mirrors the existing v1.2 D-17 snapshot rule for lineItemsSnapshot/customerSnapshot), not a live recompute."

patterns-established:
  - "Round-trip backup tests for new optional fields live alongside buildBackupFile/serializeBackup tests in backupExport.test.ts, importing restoreBackup from backupRestore.ts to prove the full export->JSON->restore cycle."

requirements-completed: [CONN-01, CONN-03, LIFE-01, LIFE-02]

coverage:
  - id: D1
    description: "types.ts exports HygroscopicityClass and TaxJurisdiction unions plus the new optional fields on Asset/Quote/UserProfile, with zero Dexie version bump"
    requirement: "LIFE-01"
    verification:
      - kind: unit
        ref: "npx tsc -b (exits 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "features.ts featureReleases registers reprice-alerts, quote-variants, spool-lifecycle, tax-threshold, each dated 2026-07-09"
    requirement: "CONN-01"
    verification:
      - kind: unit
        ref: "npx tsc -b (exits 0); src/features.ts manual inspection"
        status: pass
    human_judgment: false
  - id: D3
    description: "Backup restore rehydrates Asset.openedAt to a Date instance; storageLocation/dryingLog/hygroscopicityOverride/variantsSnapshot/taxJurisdiction survive the export->restore round-trip by value"
    requirement: "LIFE-01"
    verification:
      - kind: unit
        ref: "src/utils/backupExport.test.ts#Phase 41 fields survive export -> restore round-trip"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-07-09
status: complete
---

# Phase 41 Plan 01: Type/Schema/Registry Spine Summary

**Added four optional Dexie-backed fields to Asset/Quote/UserProfile, two shared string-literal unions, four NEW-badge registry keys, and closed the materials backup Date-rehydration gap — with zero Dexie version bump.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-09T16:58:00Z (approx)
- **Completed:** 2026-07-09T17:01:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `src/types.ts` gained `HygroscopicityClass`, `TaxJurisdiction`, and eight new optional fields across `Asset`, `Quote`, and `UserProfile` — all non-indexed, all documented with decision-ID doc comments, zero changes to `src/db/database.ts`.
- `src/features.ts` registered the four Phase 41 NEW-badge keys (`reprice-alerts`, `quote-variants`, `spool-lifecycle`, `tax-threshold`), each dated 2026-07-09, under a dedicated comment grouping.
- Closed RESEARCH.md Pitfall 4: `backupSchema.ts`'s `DATE_FIELDS.materials` was `[]`, meaning a future `Asset.openedAt` Date field would silently stay an ISO string after restore. Now `['openedAt']`.
- Extended `backupExport.test.ts` with three new round-trip tests proving `openedAt` rehydrates to a `Date` (equal epoch), `dryingLog` entries stay strings, `storageLocation`/`hygroscopicityOverride` survive by value, `Quote.variantsSnapshot` number arrays survive by value, and a `UserProfile.taxJurisdiction` value embedded in the opaque `settings.userProfile` JSON string round-trips unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the four features' optional type fields + two shared unions to types.ts, and register four NEW-badge keys in features.ts** - `3b3bbce` (feat)
2. **Task 2: Close the backup Date-rehydration gap for Asset.openedAt and prove the round-trip preserves all new fields** - `58c8125` (fix)

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified
- `src/types.ts` - Added `HygroscopicityClass`, `TaxJurisdiction` unions; `Asset.openedAt/storageLocation/dryingLog/hygroscopicityOverride`; `Quote.variantsSnapshot`; `UserProfile.taxJurisdiction/customTaxThresholdAmount/customTaxThresholdLabel`
- `src/features.ts` - Registered `reprice-alerts`, `quote-variants`, `spool-lifecycle`, `tax-threshold` NEW-badge keys (each `new Date('2026-07-09')`)
- `src/utils/backupSchema.ts` - `DATE_FIELDS.materials` changed from `[]` to `['openedAt']`
- `src/utils/backupExport.test.ts` - Added `restoreBackup` import and a new `describe` block with 3 round-trip tests covering all Phase 41 field additions

## Decisions Made
- `Asset.hygroscopicityOverride` uses the 3-value `HygroscopicityClass` union (not a boolean) since it mirrors `isAbrasive`'s override *semantic* (undefined = auto-detect) but not its boolean *shape* — hygroscopicity is inherently a 3-class enum per D-11.
- `Asset.dryingLog` deliberately excluded from `DATE_FIELDS` — it's an array of ISO date-only strings by design (D-10), not `Date[]`; adding it to the Date allowlist would have broken the string contract the moisture-risk reader depends on.
- Round-trip tests for the new fields were added to `backupExport.test.ts` (per plan's `files_modified`) even though they exercise `restoreBackup` from `backupRestore.ts` — this matches the plan's explicit instruction and keeps the "export produces a file that restore round-trips correctly" story in one file.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 41-02 through 41-05 can now import `HygroscopicityClass`, `TaxJurisdiction`, and reference every new `Asset`/`Quote`/`UserProfile` field and all four badge keys without touching `types.ts`, `features.ts`, or `backupSchema.ts` — eliminating the cross-plan write-conflict risk this plan existed to remove.
- `npx tsc -b` exits 0 and the full backup test suite (38 tests across `backupExport.test.ts`, `backupRestore.test.ts`, `backupSchema.test.ts`) is green.
- No blockers for wave 2 (Plans 02-05).

---
*Phase: 41-quick-win-features*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: 3b3bbce
- FOUND: 58c8125
- FOUND: src/types.ts
- FOUND: src/features.ts
- FOUND: src/utils/backupSchema.ts
- FOUND: src/utils/backupExport.test.ts
- FOUND: .planning/phases/41-quick-win-features/41-01-SUMMARY.md
