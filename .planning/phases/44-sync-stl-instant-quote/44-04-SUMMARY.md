---
phase: 44-sync-stl-instant-quote
plan: 04
subsystem: sync
tags: [web-locks, broadcastchannel, file-system-access-api, tauri, rust, vitest, typescript]

# Dependency graph
requires:
  - phase: 44-01
    provides: SyncFile envelope + computeMerge/validateSyncFile the I/O layer built here will carry
provides:
  - withSyncLock — Web Locks exclusive critical-section wrapper with a bounded-timeout guard and a
    best-effort (no-lock) fallback when navigator.locks is unavailable
  - notifyPeers/subscribeToPeers — BroadcastChannel cross-tab notification (explicitly NOT the mutex)
  - syncCapability/selectSyncFolder/getPersistedSyncTarget/clearSyncTarget/readSyncFile/writeSyncFileAtomic —
    platform-branched (__IS_TAURI__) folder pick, persistence, and atomic read/write
  - tauri-plugin-persisted-scope registered so a desktop-picked sync folder's fs scope survives an app restart
affects: [44-06]

# Tech tracking
tech-stack:
  added:
    - "tauri-plugin-persisted-scope 2.x (Cargo.toml — official tauri-apps/plugins-workspace crate)"
  patterns:
    - "Web Locks (navigator.locks.request) as the actual mutex; BroadcastChannel as notification-only — never conflate the two (RESEARCH.md anti-pattern)"
    - "Web-side FileSystemDirectoryHandle persisted in a dedicated hand-rolled IndexedDB store, NOT the JSON settings store (handles are structured-clonable, not JSON-serializable)"
    - "Desktop atomic write = write-temp-then-rename with best-effort temp cleanup on rename failure (RESEARCH.md Pattern 2)"

key-files:
  created:
    - src/utils/syncLock.ts
    - src/utils/syncLock.test.ts
    - src/utils/syncFileIO.ts
    - src/utils/syncFileIO.test.ts
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/main.rs
    - src-tauri/capabilities/default.json
    - src-tauri/gen/schemas/capabilities.json
    - src-tauri/Cargo.lock

key-decisions:
  - "writeSyncFileAtomic's bytes parameter is typed Uint8Array<ArrayBuffer> (not the bare generic Uint8Array) so it type-checks against FileSystemWriteChunkType/BufferSource under TS 5.9's generic-ArrayBuffer Uint8Array — matches what TextEncoder.encode() already returns, so callers need no cast"
  - "Desktop sync-folder path persists through the EXISTING settings store (setSetting/getSetting, plain string) while the web FileSystemDirectoryHandle gets its own tiny hand-rolled IndexedDB key-value store — the two persistence mechanisms are deliberately different because a directory handle is structured-clonable but not JSON-serializable"
  - "getPersistedSyncTarget() on web re-checks (and if needed re-requests) the stored handle's readwrite permission before returning it, since a Chrome 122+ persistent grant can still lapse between sessions; a denied re-request returns null rather than a broken handle"

requirements-completed: [SYNC-01]

coverage:
  - id: D1
    description: "withSyncLock wraps a callback in the exclusive SYNC_LOCK_NAME Web Lock, serializing two racing callers through navigator.locks.request, with a best-effort no-lock fallback when Web Locks is unavailable and a bounded 30s timeout so a hung callback cannot hold the lock forever"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncLock.test.ts — 'withSyncLock' describe block (serialization, no-lock fallback, timeout)"
        status: pass
    human_judgment: false
  - id: D2
    description: "notifyPeers()/subscribeToPeers() provide cross-tab BroadcastChannel notification, explicitly documented and tested as notification-only (never the mutex)"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncLock.test.ts — 'notifyPeers / subscribeToPeers' describe block"
        status: pass
    human_judgment: false
  - id: D3
    description: "syncCapability() returns 'auto' for Tauri desktop or Chromium web (showDirectoryPicker present), 'manual' otherwise (Safari/Firefox)"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncFileIO.test.ts — 'syncCapability' describe block"
        status: pass
    human_judgment: false
  - id: D4
    description: "Web writeSyncFileAtomic obtains a writable via createWritable(), writes, then closes (atomic swap-on-close, native FSA behavior) in that exact order"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncFileIO.test.ts — 'writeSyncFileAtomic — web (createWritable atomic swap)'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Desktop writeSyncFileAtomic writes to a .tmp-<timestamp> path then renames onto the real path; a rename failure removes the temp file and rethrows, leaving the real path untouched; a 'forbidden path:' write failure maps to a friendly restricted-location message"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncFileIO.test.ts — 'writeSyncFileAtomic — desktop (atomic write via write-temp-then-rename)'"
        status: pass
    human_judgment: false
  - id: D6
    description: "selectSyncFolder()/getPersistedSyncTarget() round-trip the chosen folder on both platforms (web: IndexedDB-stored handle with permission re-check; desktop: settings-stored path string), and handle a cancelled dialog / a denied permission re-request as null"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "src/utils/syncFileIO.test.ts — 'selectSyncFolder / getPersistedSyncTarget' describe block"
        status: pass
    human_judgment: false
  - id: D7
    description: "tauri-plugin-persisted-scope is registered in the Tauri Builder chain after tauri_plugin_fs::init(), so a desktop-picked sync folder's fs scope grant survives an app restart; dialog:allow-open is granted; the static fs:allow-write-file allowlist stays DOWNLOAD/DOCUMENT/DESKTOP (no $HOME/** widen)"
    requirement: "SYNC-01"
    verification:
      - kind: other
        ref: "cargo check in src-tauri (plugin resolves, Builder registers it) + grep-based acceptance criteria (Cargo.toml/main.rs/capabilities/default.json)"
        status: pass
    human_judgment: true
    rationale: "The literal restart-persistence behavior (pick folder → quit app → relaunch → sync still works without re-prompting) requires an actual desktop build + restart cycle, which the plan explicitly defers to 44-06's human-verify checkpoint — this plan only proves the plugin is correctly wired and compiles."

# Metrics
duration: 20min
completed: 2026-07-19
status: complete
---

# Phase 44 Plan 04: Sync Platform I/O + Concurrency Primitives Summary

**Web Locks critical-section wrapper + BroadcastChannel notification, platform-branched atomic sync-file read/write (native `createWritable()` swap-on-close for web, hand-rolled write-temp-then-rename for desktop), and `tauri-plugin-persisted-scope` registration so a desktop-picked sync folder survives an app restart.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-19T12:58:59Z
- **Completed:** 2026-07-19T13:12:14Z
- **Tasks:** 3
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments
- `syncLock.ts`: `withSyncLock<T>(fn)` wraps a callback in the exclusive `3dcoster-sync-critical-section` Web Lock (`navigator.locks.request`), serializing racing callers; degrades to best-effort (no lock) when Web Locks is unavailable; bounds the callback with a 30s timeout so a hung-but-alive holder cannot starve the lock forever. `notifyPeers()`/`subscribeToPeers()` provide BroadcastChannel-based cross-tab notification, explicitly documented and tested as notification-only — Web Locks is the actual mutex.
- `syncFileIO.ts`: `syncCapability()` gates the auto (Tauri desktop or Chromium web) vs. manual (Safari/Firefox) sync path. Web folder selection persists the `FileSystemDirectoryHandle` in a dedicated hand-rolled IndexedDB store (not the JSON settings store); desktop persists the chosen path string through the existing settings store. Web writes use `createWritable()`'s native swap-on-close atomicity; desktop writes use write-temp-then-rename with best-effort temp cleanup on failure and a friendly "forbidden path:" scope-denial message.
- `tauri-plugin-persisted-scope` registered in the Tauri Builder chain (after `tauri_plugin_fs::init()`) and `dialog:allow-open` granted, so the dialog-picked sync folder's fs scope grant survives a desktop app restart — without widening the static `fs:allow-write-file` allowlist beyond `DOWNLOAD`/`DOCUMENT`/`DESKTOP` (v1.9 hardening preserved).

## Task Commits

Each task was committed atomically (TDD RED→GREEN where applicable):

1. **Task 1: syncLock.ts — Web Locks critical section + BroadcastChannel notify** — `f824ee7` (test, RED) → `12125ff` (feat, GREEN)
2. **Task 2: syncFileIO.ts — platform folder pick, persistence, atomic read/write** — `1c3dfeb` (test, RED) → `22cedd5` (feat, GREEN)
3. **Task 3: Tauri desktop — persisted-scope plugin + dialog-extended fs scope** — `319ed68` (feat)

_TDD tasks 1 and 2 each ran full RED→GREEN cycles; no REFACTOR commit was needed for either._

## Files Created/Modified
- `src/utils/syncLock.ts` - `withSyncLock`, `notifyPeers`, `subscribeToPeers`, `SYNC_LOCK_NAME` constant
- `src/utils/syncLock.test.ts` - serialization, no-lock fallback, bounded-timeout, and BroadcastChannel round-trip coverage (5 tests)
- `src/utils/syncFileIO.ts` - `syncCapability`, `selectSyncFolder`, `getPersistedSyncTarget`, `clearSyncTarget`, `readSyncFile`, `writeSyncFileAtomic`, plus the internal IndexedDB handle store and Tauri write-temp-then-rename helper
- `src/utils/syncFileIO.test.ts` - capability detection, web/desktop atomic-write ordering and failure cleanup, forbidden-path mapping, and folder-selection/persistence round-trip coverage (11 tests)
- `src-tauri/Cargo.toml` - added `tauri-plugin-persisted-scope = "2"` dependency
- `src-tauri/src/main.rs` - registered `.plugin(tauri_plugin_persisted_scope::init())` after `tauri_plugin_fs::init()`
- `src-tauri/capabilities/default.json` - added `dialog:allow-open`; `fs:allow-write-file` static allowlist unchanged
- `src-tauri/gen/schemas/capabilities.json` - regenerated by `cargo check` (see Deviations — fixed a pre-existing stale-schema drift as a side effect)
- `src-tauri/Cargo.lock` - lockfile update for the new crate

## Decisions Made
See `key-decisions` in frontmatter: `Uint8Array<ArrayBuffer>` typing for `writeSyncFileAtomic`'s bytes parameter, the dual persistence mechanism (settings store for the desktop path string vs. a dedicated IndexedDB store for the non-JSON web handle), and the permission re-check/re-request on `getPersistedSyncTarget()`'s web path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing stale `gen/schemas/capabilities.json` fixed as a side effect of `cargo check`**
- **Found during:** Task 3 (`cargo check` run to verify the plugin resolves)
- **Issue:** The generated capabilities schema still reflected a `$HOME/**/*` fs write allowlist — a leftover from before v1.9's fs-scope narrowing (`capabilities/default.json` itself was already correctly narrowed to `DOWNLOAD`/`DOCUMENT`/`DESKTOP`, but the generated schema had never been regenerated since). This is exactly the "widened to `$HOME/**`" anti-pattern the phase's threat model explicitly forbids, sitting undetected in a generated artifact.
- **Fix:** `cargo check` regenerated `gen/schemas/capabilities.json` from the current `capabilities/default.json` as part of resolving the new `dialog:allow-open` permission and the plugin registration — the regenerated file now correctly shows `$DOWNLOAD/**`, `$DOCUMENT/**`, `$DESKTOP/**` and no `$HOME` reference.
- **Files modified:** `src-tauri/gen/schemas/capabilities.json`
- **Verification:** `grep -c "HOME" src-tauri/capabilities/default.json` returns 0; `git diff` on the schema file shows the `$HOME/**/*` entry replaced by the three narrowed paths
- **Committed in:** `319ed68` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was a side effect of running the plan's own verification command (`cargo check`) and directly reinforces the plan's own threat-model requirement (no `$HOME/**` widen). No scope creep — no functionality was added beyond what Task 3 specified.

## Issues Encountered
None beyond the auto-fixed item above.

## User Setup Required
None - no external service configuration required. `tauri-plugin-persisted-scope` needs no runtime configuration beyond the Builder registration done in this plan.

## Next Phase Readiness
- `withSyncLock`/`notifyPeers`/`subscribeToPeers` and the full `syncFileIO.ts` surface (`syncCapability`, `selectSyncFolder`, `getPersistedSyncTarget`, `clearSyncTarget`, `readSyncFile`, `writeSyncFileAtomic`) are ready for 44-06's orchestration layer to compose into the actual launch-check + debounced-auto-write sync flow, alongside 44-01's `computeMerge`/`validateSyncFile` and 44-03's `applyMerge`/tombstone write layer.
- Restart-persistence of the desktop sync folder (pick → quit → relaunch → still works) is explicitly NOT verified here — it requires a real desktop build + restart cycle and is deferred to 44-06's human-verify checkpoint per the plan's own `<verification>` block.
- No UI surfaces were built in this plan (no `SyncSetup.tsx`/`SyncMergeSummary.tsx`) — those, plus the debounced-write scheduler and launch-time newer-file check, remain for later Wave-2/Wave-3 plans in this phase.

---
*Phase: 44-sync-stl-instant-quote*
*Completed: 2026-07-19*

## Self-Check: PASSED

All created/modified files and all 5 task commit hashes verified present on disk / in `git log`.
