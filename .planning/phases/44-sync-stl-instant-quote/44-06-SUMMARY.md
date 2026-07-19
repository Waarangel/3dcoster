---
phase: 44-sync-stl-instant-quote
plan: 06
subsystem: sync
tags: [dexie, web-locks, filesystem-access-api, tauri-persisted-scope, react-hooks, useSyncExternalStore]

# Dependency graph
requires:
  - phase: 44-01
    provides: sync contract (SyncFile/MergePlan types), validateSyncFile, computeMerge (pure LWW/tombstone merge core)
  - phase: 44-03
    provides: db v13 syncTombstones store, centralized updatedAt stamping, applyMerge transactional executor
  - phase: 44-04
    provides: withSyncLock (Web Locks mutex), notifyPeers/subscribeToPeers (BroadcastChannel), readSyncFile/writeSyncFileAtomic, syncCapability, selectSyncFolder, getPersistedSyncTarget
provides:
  - useSyncFolder.ts orchestration hook — setup, debounced auto-write, launch-time merge check, confirm-gated commit, undo
  - SyncSetup.tsx — folder setup/status/manual actions/capability note/undo, mounted in the Data tab
  - SyncMergeSummary.tsx — pre-commit per-store change summary with conflict flags and explicit confirm/cancel
  - BackupRestoreSection "Backup, Restore & Sync" heading with Sync as a third subsection
  - App.tsx launch-time newer-sync-file check (opt-in, no-op when unconfigured)
  - End-to-end SYNC-01 feature complete and human-verified across web/desktop/multi-tab/Safari-Firefox
affects: [45-brand-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scoped external store (useSyncExternalStore) shares one live sync state across App.tsx's launch check and SyncSetup's status/actions without prop-drilling"
    - "Confirm-gated merge commit: a divergent merge always surfaces SyncMergeSummary and only applies on explicit user confirm; only strictly-local-ahead / already-in-sync states auto-apply"
    - "Pre-merge snapshot-before-apply: buildBackupFile snapshot always lands in local settings storage before applyMerge runs, enabling one-click 'Restore pre-merge state' undo"

key-files:
  created:
    - src/hooks/useSyncFolder.ts
    - src/hooks/useSyncFolder.test.tsx
    - src/components/SyncMergeSummary.tsx
    - src/components/SyncMergeSummary.test.tsx
    - src/components/SyncSetup.tsx
  modified:
    - src/components/BackupRestoreSection.tsx
    - src/App.tsx

key-decisions:
  - "useSyncFolder composes the Wave 1-2 primitives in the exact key_links order: withSyncLock wraps readSyncFile -> validateSyncFile+computeMerge -> confirm-gated applyMerge -> writeSyncFileAtomic -> notifyPeers"
  - "SyncMergeSummary takes the full MergePlan (not the bare MergeSummary named in the plan's action text) since only MergePlan carries the per-record names/ids the plan's own behavior spec requires for expand-detail"
  - "15s debounced auto-write is driven by Dexie creating/updating/deleting hooks across every BACKUP_STORES table, resetting the timer on each new write"
  - "Rule 1/2 auto-fix: useSyncFolder's ensureInitialized/checkOnLaunch now catch platform-capability probe failures (no IndexedDB, __IS_TAURI__ undefined outside Tauri/non-define contexts) instead of leaving an unhandled promise rejection, since sync is opt-in (D-01) and must never crash a host component's mount"

patterns-established:
  - "Staged-confirm accessibility for destructive/high-stakes actions: Cancel gets focus on mount, Confirm is the deliberate secondary action — mirrors BackupRestoreSection's existing confirm-panel pattern, now reused by SyncMergeSummary"

requirements-completed: [SYNC-01]

coverage:
  - id: D1
    description: "useSyncFolder.ts orchestrates setup, debounced locked auto-write, launch merge check, confirm-gated commit with pre-merge snapshot, and undo; manual fallback exposed when capability is 'manual'"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/hooks/useSyncFolder.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "SyncMergeSummary shows per-store added/updated/deleted counts + expandable detail + distinctly flagged conflicts; commits only on explicit confirm"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/components/SyncMergeSummary.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Data tab reads 'Backup, Restore & Sync' with a Sync subsection (SyncSetup: folder setup/status/manual actions/capability note/undo); App.tsx runs the opt-in launch merge check; Backup/Restore subsections unchanged; no new chrome outside the Data tab"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "npm test (full suite, 1401 tests)"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D4
    description: "End-to-end cross-device sync flow works in real conditions: web folder sync + browser-restart persistence, two-tab concurrent-edit merge with true-conflict detection, desktop Tauri persisted-scope sync surviving an app relaunch, pre-merge-snapshot undo, and Safari/Firefox manual export/import fallback with the capability note"
    requirement: "SYNC-01"
    verification:
      - kind: manual_procedural
        ref: "Task 4 checkpoint:human-verify — 5-point how-to-verify script (web restart persistence, two-tab merge/conflict, desktop persisted-scope restart, pre-merge undo, Safari/Firefox fallback)"
        status: pass
    human_judgment: true
    rationale: "Folder-handle persistence across a real browser restart and Tauri persisted-scope persistence across a real app relaunch need an actual permission UI + restart cycle that jsdom/vitest cannot exercise (VALIDATION.md: Manual-Only)."

# Metrics
duration: 8min (Tasks 1-3, autonomous) + human-verify UAT session (Task 4, approved)
completed: 2026-07-19
status: complete
---

# Phase 44 Plan 06: Sync UI + Orchestration Summary

**useSyncFolder.ts orchestration hook (Web Locks-mutexed setup/debounced auto-write/launch-check/undo) wired into a new "Backup, Restore & Sync" Data-tab subsection, with SyncMergeSummary gating every divergent merge behind an explicit user confirm — completes SYNC-01 end-to-end and human-verified across web, desktop, multi-tab, and Safari/Firefox.**

## Performance

- **Duration:** ~8 min autonomous execution (Tasks 1-3) + a human-verify UAT session (Task 4), approved
- **Started:** 2026-07-19T16:28:38Z (first task commit)
- **Completed:** 2026-07-19T17:28:53Z (checkpoint approval)
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify)
- **Files modified:** 7

## Accomplishments
- `useSyncFolder.ts` composes every Wave 1-2 primitive into one orchestration hook: folder setup, 15s-debounced Dexie-write-triggered auto-write, launch-time newer-file check, confirm-gated merge commit with a pre-merge `buildBackupFile` snapshot, one-click undo, and a manual-capability fallback for Safari/Firefox — all locked-and-serialized through `withSyncLock`.
- `SyncMergeSummary.tsx` renders a per-store "X added, Y updated, Z deleted" headline with expandable record-level detail and a distinct conflict marker; nothing commits without an explicit Confirm click (D-07, roadmap success criterion 2).
- The Settings Data tab now reads "Backup, Restore & Sync" — `SyncSetup.tsx` mounts as a third subsection with folder-picker, last-synced status, "Sync now", the D-02 capability note for Safari/Firefox, "Restore pre-merge state" undo, and the `sync-devices` NEW badge; Backup/Restore subsections are untouched (D-03).
- `App.tsx` mounts one long-lived `useSyncFolder()` instance driving `checkOnLaunch()` once at boot, opt-in and a no-op when sync is unconfigured or capability is manual, surfacing a global `SyncMergeSummary` banner when a divergent sync file is found (never auto-commits).
- Task 4 human-verify UAT approved all 5 verification points: web folder sync + browser-restart persistence, two-tab concurrent-edit merge with correct per-store counts and conflict flagging, desktop Tauri persisted-scope surviving a real app relaunch, pre-merge-snapshot undo, and the Safari/Firefox manual export/import fallback with capability note.

## Task Commits

Each task was committed atomically:

1. **Task 1: useSyncFolder.ts — orchestration hook** - `5032a65` (feat, tdd)
2. **Task 2: SyncMergeSummary.tsx — pre-commit change summary + confirm** - `d79a6bf` (feat, tdd)
3. **Task 3: SyncSetup + BackupRestoreSection "Backup, Restore & Sync" + App.tsx launch check** - `7495de4` (feat)
4. **Task 4: Human-verify end-to-end sync** - checkpoint:human-verify, no code changes — APPROVED

**Plan metadata:** (this commit) `docs(44-06): complete sync UI + orchestration plan`

## Files Created/Modified
- `src/hooks/useSyncFolder.ts` - Orchestration hook: setup, debounced locked auto-write, launch merge check, confirm-gated commit, pre-merge snapshot + undo, manual-capability fallback
- `src/hooks/useSyncFolder.test.tsx` - Snapshot-before-apply ordering, lock serialization of concurrent auto-writes, launch-divergence-needs-confirm behavior
- `src/components/SyncMergeSummary.tsx` - Per-store added/updated/deleted headline, expandable detail, distinct conflict flag, explicit confirm/cancel
- `src/components/SyncMergeSummary.test.tsx` - Headline counts, conflict flag, expand-reveals-records, onConfirm/onCancel wiring
- `src/components/SyncSetup.tsx` - Folder-picker, status line, Sync now, manual export/import, D-02 capability note, undo affordance, NEW badge
- `src/components/BackupRestoreSection.tsx` - Heading extended to "Backup, Restore & Sync"; mounts SyncSetup as a third subsection
- `src/App.tsx` - Mounts the launch-time newer-sync-file check via `useSyncFolder().checkOnLaunch()`, opt-in/no-op when unconfigured

## Decisions Made
- `useSyncFolder` composes the Wave 1-2 primitives in the exact `withSyncLock -> readSyncFile -> validateSyncFile+computeMerge -> confirm-gated applyMerge -> writeSyncFileAtomic -> notifyPeers` order specified in the plan's key_links, with a module-scoped `useSyncExternalStore` so App.tsx's launch check and SyncSetup's status/actions share one live sync state without prop-drilling.
- `SyncMergeSummary` takes the full `MergePlan` rather than the bare `MergeSummary` the plan's action text named, since only `MergePlan` carries the per-record names/ids that the plan's own behavior spec requires the expand-detail to show.
- 15s debounced auto-write is driven directly by Dexie creating/updating/deleting hooks across every `BACKUP_STORES` table (not a separate write-signal counter), resetting the timer on each new write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug + Missing error handling] Unhandled promise rejections from platform-capability probes when useSyncFolder mounts globally**
- **Found during:** Task 3 (SyncSetup + BackupRestoreSection + App.tsx launch check), via `npm test`
- **Issue:** Mounting `useSyncFolder()` globally in `App.tsx` surfaced unhandled promise rejections across `App.test.tsx`, `SettingsModal.test.tsx`, and `BackupRestoreSection.test.tsx` — none of those pre-existing test suites stub the sync I/O boundary, and `ensureInitialized`/`checkOnLaunch` had no catch around platform-capability probes (no IndexedDB, `__IS_TAURI__` undefined outside Tauri/non-define contexts).
- **Fix:** `ensureInitialized`/`checkOnLaunch` now catch platform-capability probe failures instead of letting them reject unhandled — sync is an opt-in enhancement (D-01) and must never crash a host component's mount.
- **Files modified:** `src/hooks/useSyncFolder.ts`
- **Verification:** `npm test` clean (no unhandled rejections), full 1401-test suite green
- **Committed in:** `7495de4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1/2 — bug + missing error handling)
**Impact on plan:** Necessary for correctness — an unhandled rejection from an opt-in feature crashing unrelated component mounts would have been a regression across the whole test suite. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required. Sync is fully local (user-owned cloud folder), no backend involved.

## Human-Verify Checkpoint (Task 4)

**Status: APPROVED by user.** All 5 verification points confirmed:
1. Chromium web: folder setup, sync-file creation, ~15s debounced auto-write, and folder-handle persistence across a browser restart.
2. Two tabs: concurrent edits produce a correct per-store merge summary, a true conflict is flagged when both tabs edit the same record, only the confirmed merge commits, and the other tab is notified.
3. Desktop (Tauri): sync-folder setup, write, app quit/relaunch, and persisted-scope auto-write continuing without re-picking the folder.
4. Pre-merge snapshot + "Restore pre-merge state" undo restores state correctly.
5. Safari/Firefox: manual export/import fallback and the D-02 capability note appear, with sync still working manually.

## Self-Check: PASSED

- FOUND: src/hooks/useSyncFolder.ts
- FOUND: src/hooks/useSyncFolder.test.tsx
- FOUND: src/components/SyncMergeSummary.tsx
- FOUND: src/components/SyncMergeSummary.test.tsx
- FOUND: src/components/SyncSetup.tsx
- FOUND: src/components/BackupRestoreSection.tsx (modified)
- FOUND: src/App.tsx (modified)
- FOUND commit 5032a65 (Task 1)
- FOUND commit d79a6bf (Task 2)
- FOUND commit 7495de4 (Task 3)
- `npx vitest run src/hooks/useSyncFolder.test.tsx src/components/SyncMergeSummary.test.tsx` — 2 files, 14 tests, all passed

## Next Phase Readiness

This is the final plan of Phase 44 (Sync & STL Instant Quote) — all 6 plans (44-01 through 44-06) are now complete. SYNC-01 and CONN-02 are both fully delivered and human-verified end-to-end. Phase 45 (Brand & Launch — Cost-Truth Dark redesign merge) can proceed once Phase 43's Pro pricing is finalized; no blockers carried forward from Phase 44.

---
*Phase: 44-sync-stl-instant-quote*
*Completed: 2026-07-19*
