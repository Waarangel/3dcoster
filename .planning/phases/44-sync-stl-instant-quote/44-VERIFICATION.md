---
phase: 44-sync-stl-instant-quote
verified: 2026-07-19T13:45:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
---

# Phase 44: Sync & STL Instant Quote Verification Report

**Phase Goal:** Users can sync their data between devices using their own cloud folder, and can get an instant estimated cost from an STL upload — both free, both local, no backend required
**Verified:** 2026-07-19T13:45:00Z
**Status:** passed

## Goal Achievement

### Observable Truths (roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can export full DB as structured JSON (incl. failureEvents/maintenanceEvents) and import on another device, with schema-version check rejecting incompatible files | ✓ VERIFIED | `src/utils/backupSchema.ts` extends `BackupFile`→`SyncFile` with `updatedAt` on all 11 `BACKUP_STORES`; `validateSyncFile` (`src/utils/syncMerge.ts`) rejects `backupFormatVersion != BACKUP_FORMAT_VERSION` before any merge is computed, delegating structural/forbidden-key checks to the existing `validateBackupFile`. 20 unit tests pass (`syncMerge.test.ts`). |
| 2 | Import on a device with existing data applies LWW; user shown a summary of what changed before committing | ✓ VERIFIED | `computeMerge` implements newer-`updatedAt`-wins with tombstone edit-wins both directions and per-store added/updated/deleted+conflict counts. `useSyncFolder.ts`'s `needsConfirmation()` (line 141-146) requires confirmation whenever ANY store has added/updated/deleted > 0 — never silently auto-commits a divergent merge; `SyncMergeSummary.tsx` renders the per-store breakdown + expandable detail + distinct conflict flag, gated behind an explicit Confirm click. 144 targeted unit tests pass across the sync stack. |
| 3 | User can upload STL/3MF and see estimated weight/cost pre-filled with infill input, units-detection warning, non-manifold warning, and "estimate — review before quoting" disclaimer | ✓ VERIFIED | `GcodeImport.tsx` routes `.stl` and non-sliced `.3mf` to `MeshEstimateCard.tsx`, which renders: 3D preview, infill input (default 15%, persisted via `useLocalStorage`), `detectUnitsWarning`/`convertInchesToMm` mm↔inch guard with one-click convert, `isNonManifold` warning, weight/cost breakdown, and the literal disclaimer text "This is an estimate — review before quoting." Apply-to-calculator only fires on explicit click (`onApply`/`onImport`), nothing pre-fills on mount. Human-verified across 3 UAT rounds (2 fix commits `60f10d2`, `e6ca1ce`), approved. |
| 4 | STL/3MF parsing never blocks the main thread or bloats the main bundle — three loads only on user-initiated upload, same CI gate as jsPDF | ✓ VERIFIED | `meshEstimate.worker.ts` is a module Worker that dynamic-imports `three/addons` (STLLoader/ThreeMFLoader) and runs `computeMeshEstimate` off-thread; `stlParser.ts`/`meshWeightModel.ts`/`unitsHeuristic.ts` have zero `three` imports (worker-callable, pure). `vite.config.ts` routes `three`/`three-stdlib` to a dedicated chunk ordered before the `node_modules` fallback. `scripts/assert-no-static-three-import.mjs` (cloned from the jsPDF gate) is wired into `npm run build`'s script chain and passes: `✓ three chunk: no static import from any non-three chunk in dist/assets/`. Main chunk verified at 100.5 KB gzipped (well under the 300 KB PERF-01 budget); `three` itself lands in its own 752.97 KB (193.63 KB gzip) chunk, loaded lazily. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/syncMerge.ts` | validateSyncFile + computeMerge pure functions | ✓ EXISTS + SUBSTANTIVE | 312 lines, no Dexie import, 20 passing tests |
| `src/utils/backupSchema.ts` | SyncTombstone/SyncFile/SyncFileMeta types, updatedAt on DATE_FIELDS | ✓ EXISTS + SUBSTANTIVE | Confirmed types + `SYNC_TOMBSTONE_RETENTION_DAYS=90` present |
| `src/db/database.ts` | Dexie v13 syncTombstones store | ✓ EXISTS + SUBSTANTIVE | `db.version(13).stores({ syncTombstones: 'id, store, deletedAt', ... })` confirmed at line 294-306 |
| `src/db/syncStamp.ts` | stampAndAdd/Put/BulkPut + writeTombstone/pruneTombstones | ✓ EXISTS + SUBSTANTIVE | 109 lines, imported and called from `useDatabase.ts` at 20+ call sites |
| `src/utils/applyMerge.ts` | Atomic transactional MergePlan executor | ✓ EXISTS + SUBSTANTIVE | 59 lines, single `db.transaction`, consumed by `useSyncFolder.ts` |
| `src/utils/syncLock.ts` | withSyncLock (Web Locks) + notifyPeers/subscribeToPeers | ✓ EXISTS + SUBSTANTIVE | 98 lines, wraps entire read-merge-write cycle in `useSyncFolder.ts` (not just the write) |
| `src/utils/syncFileIO.ts` | Platform-branched folder pick + atomic read/write | ✓ EXISTS + SUBSTANTIVE | 237 lines; web `createWritable()`, desktop write-temp-then-rename |
| `src-tauri` persisted-scope | tauri-plugin-persisted-scope registered | ✓ EXISTS | `Cargo.toml`/`main.rs` registration confirmed in 44-04-SUMMARY; human-verified relaunch persistence in 44-06 UAT |
| `src/workers/meshEstimate.worker.ts` | Off-thread STL/3MF parse | ✓ EXISTS + SUBSTANTIVE | 178 lines, calls `computeMeshEstimate` from `stlParser.ts` |
| `src/components/MeshEstimateCard.tsx` | Review card (preview/infill/warnings/Apply/disclaimer) | ✓ EXISTS + SUBSTANTIVE | 355 lines, all D-11..D-16 elements confirmed present via grep |
| `src/components/GcodeImport.tsx` | .stl / non-sliced-.3mf routing | ✓ EXISTS + SUBSTANTIVE | 417 lines; "exact from slicer" / "estimated from mesh" labels confirmed |
| `src/hooks/useSyncFolder.ts` | Sync orchestration hook | ✓ EXISTS + SUBSTANTIVE | 409 lines; composes withSyncLock→readSyncFile→validateSyncFile+computeMerge→confirm→snapshot→applyMerge→writeSyncFileAtomic→notifyPeers in that exact order |
| `src/components/SyncSetup.tsx` | Folder picker + status + manual actions + undo | ✓ EXISTS + SUBSTANTIVE | 104 lines, mounted in `BackupRestoreSection.tsx` |
| `src/components/SyncMergeSummary.tsx` | Pre-commit merge summary + confirm | ✓ EXISTS + SUBSTANTIVE | 143 lines, mounted in `App.tsx` |
| `scripts/assert-no-static-three-import.mjs` | CI gate | ✓ EXISTS | Wired into `package.json` build script chain, verified passing |

**Artifacts:** 15/15 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `SettingsModal.tsx` (Data tab) | `BackupRestoreSection.tsx` | direct render at line 1191 | ✓ WIRED | Confirmed `activeTab === 'data'` renders `<BackupRestoreSection />` |
| `BackupRestoreSection.tsx` | `SyncSetup.tsx` | direct render, "Backup, Restore & Sync" heading | ✓ WIRED | Line 237: `<SyncSetup database={database} />` under the renamed heading |
| `App.tsx` | `useSyncFolder().checkOnLaunch()` | `useEffect` on mount | ✓ WIRED | Line 198-201: hook called, `checkOnLaunch()` invoked once at boot |
| `App.tsx` | `SyncMergeSummary` | conditional render on `syncPendingMerge` | ✓ WIRED | Line 401, global banner sourced from the shared external store |
| `GcodeImport.tsx` | `MeshEstimateCard.tsx` | `.stl` / non-sliced-`.3mf` branch | ✓ WIRED | Line 225 routes `.stl`; mesh worker spun up at line 97; card rendered at line 363 |
| `meshEstimate.worker.ts` | `stlParser.computeMeshEstimate` | direct call | ✓ WIRED | Line 153, imported line 25 |
| `useSyncFolder.ts` | `computeMerge`/`validateSyncFile`/`applyMerge`/`syncLock`/`syncFileIO` | direct composition | ✓ WIRED | All 5 imports present and called in the documented order; `withSyncLock` wraps the FULL read→merge→write cycle (not just the low-level write), matching the plan's explicit anti-pattern warning |
| `useDatabase.ts` deletes | `writeTombstone` | same-transaction call | ✓ WIRED | 6+ delete call sites confirmed, including `deleteJob`'s cascade-deleted sales (verified by reading lines 968-990: `db.transaction('rw', ..., db.syncTombstones, ...)` tombstones both the job and each cascaded sale) |
| `useDatabase.ts` writes | `stampAndAdd`/`stampAndPut`/`stampAndBulkPut` | wrapper routing | ✓ WIRED | 20+ call sites across materials/printerInstances/sales/customers/quotes/settings |
| `vite.config.ts` manualChunks | `three`/`three-stdlib` | id-match branch before `node_modules` fallback | ✓ WIRED | Confirmed ordering; build output shows dedicated `three-6CF45DKQ.js` chunk (752.97 KB / 193.63 KB gzip), separate from main chunk (100.5 KB gzip) |
| `package.json` build script | `assert-no-static-three-import.mjs` | appended after pdf gates | ✓ WIRED | Confirmed in script chain; `npm run build` executed and gate printed PASS |

**Wiring:** 11/11 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|-----------------|
| SYNC-01: File-based device sync (LWW, schema-version checks, atomic writes, multi-tab safety) | ✓ SATISFIED | - |
| CONN-02: Instant local STL/3MF quote (units/infill/non-manifold guards, lazy three, CI gate) | ✓ SATISFIED | - |

**Coverage:** 2/2 requirements satisfied

## Anti-Patterns Found

None. No TODO/FIXME/stub markers in any of the 8 core sync/mesh source files scanned. All plan-documented deviations (deleteJob cascade tombstones, unhandled-rejection guards on global hook mount, camera-framing/pane-aspect fixes) were auto-fixed within their originating plan and are reflected in the current codebase — not left as gaps.

**Anti-patterns:** 0 found

## Human Verification Required

None beyond what the user already completed. Per the task brief, the following are counted as already human-verified and are NOT re-flagged here:
- three-package legitimacy checkpoint (44-02) — approved
- STL estimate 3D preview WebGL rendering, rotate/zoom feel, camera framing, pane proportions (44-05 Task 4, 3 rounds, 2 fix commits `60f10d2`/`e6ca1ce`) — approved
- End-to-end sync UAT (44-06 Task 4): web restart persistence, two-tab merge + true-conflict detection, desktop Tauri persisted-scope relaunch, pre-merge undo, Safari/Firefox manual-fallback — approved

No new gaps were found during this verification that require additional human eyes.

## Gaps Summary

**No gaps found.** Phase goal achieved. All 4 roadmap success criteria verified against the actual codebase (not just summaries), all 15 required artifacts exist and are substantive, all 11 key wiring links are confirmed connected, both requirement IDs (SYNC-01, CONN-02) are satisfied, and `npm run build` (including the new `assert-no-static-three-import.mjs` gate) plus 144 targeted unit tests across the sync/mesh stack pass cleanly. Ready to proceed to Phase 45.

## Verification Metadata

**Verification approach:** Goal-backward (derived from ROADMAP.md Phase 44 Success Criteria) + plan must_haves cross-reference
**Must-haves source:** ROADMAP.md Phase 44 Success Criteria (4) + 44-01..44-06-PLAN.md must_haves.truths (25 total, all covered by the 4 roadmap-level criteria)
**Automated checks:** `npm run build` (full gate chain incl. three CI gate) — pass; 144 targeted unit tests across 13 files — pass; manual grep-based wiring verification — 11/11 pass
**Human checks required:** 0 new (3 already completed by user, counted per task brief)
**Total verification time:** ~25 min

---
*Verified: 2026-07-19T13:45:00Z*
*Verifier: Claude (subagent)*
