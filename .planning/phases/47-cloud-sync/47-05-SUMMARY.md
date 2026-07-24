---
phase: 47-cloud-sync
plan: 05
subsystem: sync
tags: [react, useSyncExternalStore, dexie, supabase-realtime, aes-gcm, cloud-sync]

# Dependency graph
requires:
  - phase: 47-cloud-sync (plan 03)
    provides: syncCrypto.ts (encryptSyncFile/decryptSyncFile/deriveKeyFromPassphrase/deriveSaltFromAccountId/checkPassphraseStrength) + syncKeyCache.ts (cacheDerivedKey/getCachedDerivedKey/clearDerivedKey)
  - phase: 47-cloud-sync (plan 04)
    provides: cloudBlobIO.ts transport (downloadBlob/uploadBlob/uploadWithRetry/resetCloudBlob/getLastKnownVersion/setLastKnownVersion/broadcastBlobUpdated/subscribeToCloudPeers)
  - phase: 44-sync-stl-quote (plan 01/03/04/06)
    provides: computeMerge/applyMerge/validateSyncFile (unchanged merge core), buildBackupFile, withSyncLock/SYNC_LOCK_NAME, useSyncFolder.ts shape precedent
provides:
  - src/utils/cloudSyncGates.ts — needsRiskyConfirmation (D-09) + pushPreMergeSnapshot (D-11) pure predicates, distinct from useSyncFolder's needsConfirmation
  - src/hooks/useCloudSync.ts — the cloud sync orchestration hook (setup/enterPassphrase/syncNow/checkOnLaunch/confirmMerge/cancelMerge/restorePreMerge/resetCloudSync/turnOffAndDeleteCloud)
affects: [47-cloud-sync plan 06 (UI wiring — SyncSetup-equivalent surface), 47-cloud-sync plan 07/08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scoped singleton store + useSyncExternalStore for a second sync channel (cloud), mirroring useSyncFolder.ts's shape exactly but with a distinct debounce constant, settings-key namespace, and gate predicates"
    - "authContext module-level mutable object updated from the hook's own useEffect (React owns live user/isPro/isSignedIn via useProAuth/useEntitlement), read synchronously by module-scoped async cycle functions triggered by Dexie hooks/debounce timers/Realtime callbacks outside any component render"

key-files:
  created:
    - src/utils/cloudSyncGates.ts
    - src/utils/cloudSyncGates.test.ts
    - src/hooks/useCloudSync.ts
    - src/hooks/useCloudSync.test.tsx
  modified: []

key-decisions:
  - "needsRiskyConfirmation deliberately does NOT import useSyncFolder's needsConfirmation — a separate, looser, graduated predicate (RISKY_DELETION_THRESHOLD=10, RISKY_DIVERGENCE_DAYS=30) so routine cloud merges apply silently instead of confirm-gating on any change"
  - "cloudSyncGates constants (RISKY_DELETION_THRESHOLD=10, RISKY_DIVERGENCE_DAYS=30, MAX_PRE_MERGE_SNAPSHOTS=3, PRE_MERGE_SNAPSHOT_TTL_HOURS=24) shipped as the 47-RESEARCH.md Open Question 1 reasoned starting points, exported and documented for later tuning"
  - "syncMeta.deviceId for the cloud channel is generated in-memory only (crypto.randomUUID, not persisted to a settings key) since computeMerge never reads it and the plan's Artifacts section names exactly 4 settings keys — persisting a 5th (device id) would have exceeded the declared surface for a field that is diagnostic-only"
  - "Cloud ciphertext base64<->bytes conversion (bytesToBase64/base64ToBytes) implemented locally in useCloudSync.ts since supabase/migrations/0002_cloud_sync.sql's sync_blobs.ciphertext column is base64 TEXT (not bytea — PostgREST hex-encodes bytea, which would break decrypt), and no existing shared base64<->Uint8Array utility exists in the codebase for arbitrary binary"
  - "reDeriveCiphertextOnConflict (the uploadWithRetry CAS-rejection callback) re-downloads, re-merges silently, and re-encrypts rather than re-running the full confirm-gate flow — the cycle has already committed to publishing at that point; uploadWithRetry's bounded 3-attempt loop remains the outer guarantee against a silent lost write, and the callback is best-effort (falls through to re-encrypting the current local state on any internal failure)"
  - "runCloudSyncCycle checks getCachedDerivedKey BEFORE downloadBlob (Pitfall 5) — signed-in-with-no-cached-key sets needsPassphrase and returns without any network call, verified by an explicit test asserting downloadBlob was never invoked"
  - "isCloudSyncActive() (supabase non-null AND isSignedIn AND isPro AND userId present) is the single gate function reused across setup/enterPassphrase/syncNow/checkOnLaunch/confirmMerge/resetCloudSync/turnOffAndDeleteCloud/scheduleCloudAutoWrite/ensureCloudPeerSubscription — one choke-point rather than the guard being re-derived per call site"

patterns-established:
  - "cloudSyncGates.ts as the canonical location for cloud-sync-specific merge-risk predicates, kept separate from file-sync's syncMerge-adjacent needsConfirmation — future cloud-sync gate tuning (threshold changes) has one file to touch without touching useSyncFolder.ts"

requirements-completed: [D-02, D-03, D-04, D-09, D-10, D-11, D-13]

coverage:
  - id: D1
    description: "needsRiskyConfirmation (D-09) returns false for routine merges and true for over-threshold deletions or long-offline divergence; pushPreMergeSnapshot (D-11) caps to MAX_PRE_MERGE_SNAPSHOTS and prunes past the TTL"
    requirement: "D-09"
    verification:
      - kind: unit
        ref: "src/utils/cloudSyncGates.test.ts (11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useCloudSync composes syncCrypto+cloudBlobIO with the unchanged Phase 44 merge core; the encrypted upload payload is a byte-identical SyncFile that validateSyncFile accepts (assumption-delta invariant)"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "src/hooks/useCloudSync.test.tsx#useCloudSync — SyncFile round-trip invariant"
        status: pass
    human_judgment: false
  - id: D3
    description: "First connect on a device is always confirm-gated (D-10); a routine merge after first-connect applies silently with a rolling pre-merge snapshot written first (D-11); a merge with over-threshold deletions is gated even after first-connect (D-09)"
    requirement: "D-10"
    verification:
      - kind: unit
        ref: "src/hooks/useCloudSync.test.tsx#useCloudSync — merge gating (D-09/D-10) (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "isProStatus false pauses setup/sync/push with zero network (D-13); signed-in with no cached derived key sets needsPassphrase without downloading (Pitfall 5); supabase null leaves the hook fully inert"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "src/hooks/useCloudSync.test.tsx (lapse pause / needsPassphrase / free-floor inertness describe blocks, 3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The debounced auto-write, checkOnLaunch, and Realtime peer-notify wiring (D-02/D-03/D-04) are only exercised at the unit level here — a live browser round trip across two real devices against the deployed Supabase project is not covered by this plan's tests"
    verification: []
    human_judgment: true
    rationale: "Real-time cross-device push/pull and the 3-5s debounce timing require a live UAT session against the deployed backend and two browser contexts; unit tests mock the transport boundary (cloudBlobIO/syncCrypto/syncKeyCache) by design (47-05-PLAN.md read_first note), so live wiring is deferred to the phase's UAT pass in a later plan"

duration: 22min
completed: 2026-07-23
status: complete
---

# Phase 47 Plan 05: Cloud Sync Orchestration Hook Summary

**useCloudSync composes syncCrypto (AES-256-GCM encrypt/decrypt) and cloudBlobIO (Supabase CAS transport) around the UNCHANGED Phase 44 merge core (computeMerge/applyMerge/validateSyncFile), producing a real-time-feeling cloud sync that applies routine merges silently and confirm-gates only first-connect and risky (mass-deletion / long-divergence) merges.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-23T22:42:00-04:00 (approx, from context load)
- **Completed:** 2026-07-23T23:04:43-04:00
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `src/utils/cloudSyncGates.ts` — pure `needsRiskyConfirmation` (D-09) and `pushPreMergeSnapshot` (D-11) predicates, deliberately separate from `useSyncFolder.ts`'s `needsConfirmation` contract (RESEARCH Pitfall 4)
- `src/hooks/useCloudSync.ts` — the orchestration hook mirroring `useSyncFolder.ts`'s module-scoped-singleton + `useSyncExternalStore` shape, driving the cloud transport: debounced auto-write (3-5s `CLOUD_DEBOUNCE_MS`, distinct from file-sync's 15s `DEBOUNCE_MS`), locked download→decrypt→merge→(silent-apply | confirm-gate)→re-encrypt→CAS-upload→broadcast cycle, Realtime peer-notify subscription, D-13 lapse pause, and the Pitfall 5 needs-passphrase branch
- 18 new passing tests (11 gates + 7 hook) exercising the SyncFile round-trip invariant, first-connect/risky gating, silent routine merges, lapse pause, needsPassphrase, and free-floor inertness

## Task Commits

Each task was committed atomically:

1. **Task 1: cloudSyncGates.ts — risky-merge + first-connect + rolling-snapshot pure helpers** - `ff5ba3a` (feat)
2. **Task 2: useCloudSync.ts — the orchestration hook (compose crypto + transport + unchanged merge)** - `1fb7e28` (feat)

**Plan metadata:** committed via `docs(47-05): complete cloud-sync-hook plan` (final commit below)

## Files Created/Modified
- `src/utils/cloudSyncGates.ts` - `needsRiskyConfirmation`/`pushPreMergeSnapshot` + 4 tunable constants
- `src/utils/cloudSyncGates.test.ts` - 11 tests covering routine/risky-deletion/divergence/TTL/cap behavior
- `src/hooks/useCloudSync.ts` - the cloud sync orchestration hook
- `src/hooks/useCloudSync.test.tsx` - 7 tests covering the SyncFile round-trip invariant, merge gating, lapse pause, needsPassphrase, free-floor inertness

## Decisions Made
See `key-decisions` in frontmatter — summarized: cloudSyncGates stays a separate contract from file-sync's needsConfirmation; deviceId for the cloud envelope is in-memory-only (not a 5th settings key); ciphertext base64 conversion is implemented locally since the DB column is base64 TEXT (not bytea); CAS-conflict retry re-merges best-effort rather than re-running the confirm gate a second time.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>` and `<behavior>` requirements were implemented as specified; all `<acceptance_criteria>` items verified directly (see Task Commits and verification below).

## Issues Encountered
None. Both TDD task test suites passed on first implementation attempt against the design derived from the plan's `read_first` composition order and Phase 44/47-03/47-04 precedents.

## User Setup Required

None - no external service configuration required. This plan is pure application code; the Supabase backend (sync_blobs table, RPCs, Realtime channel policies) was already deployed in plan 47-02.

## Next Phase Readiness

- `useCloudSync()` is ready to be wired into a UI surface (CloudSyncSetup-equivalent component, plan 47-06) that reads `pendingMerge`/`conflictNote`/`needsPassphrase`/`error` and drives `setupCloudSync`/`enterPassphrase`/`confirmMerge`/`cancelMerge`/`restorePreMerge`/`resetCloudSync`/`turnOffAndDeleteCloud`
- App.tsx will need to mount one long-lived `useCloudSync()` instance (mirroring `useSyncFolder()`'s App.tsx mount) to drive `checkOnLaunch()` and the debounced background auto-write for the app's lifetime
- Live cross-device Realtime push/pull and the debounce timing are unverified beyond unit-level mocks — flagged as `coverage.D5` (`human_judgment: true`) for the phase's UAT pass
- No blockers for plan 47-06

---
*Phase: 47-cloud-sync*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 4 created files found on disk; both task commits (`ff5ba3a`, `1fb7e28`) found in git log.
