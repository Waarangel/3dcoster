---
phase: 47-cloud-sync
plan: 06
subsystem: ui
tags: [react, dexie, supabase, cloud-sync, pro-gating, confirm-modal]

# Dependency graph
requires:
  - phase: 47-cloud-sync (47-05)
    provides: useCloudSync orchestration hook (setup/enter/status/reset/delete + pendingMerge)
provides:
  - CloudSyncSetup component (Pro-chipped cloud-sync subsection UI, not yet mounted)
  - ProPitchModal extended to cover cloud sync (one bundle pitch, three entry points)
  - cloud-sync NEW-badge key registered in features.ts
affects: [47-07 (mounts CloudSyncSetup + wires App.tsx launch checks), 47-08 (marketing flips)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Free/signed-out Pro-chip -> owned ProPitchModal state -> onOpenSignIn prop deferring to App-level SignInModal (mirrors BrandingSection/UserProfileModal D-13/D-14 exactly)"
    - "D-14 level-2 delete confirmation reads a live count from LOCAL Dexie data (quotes.publishStatus) instead of an extra network round trip before the destructive edge-function call"

key-files:
  created: [src/components/CloudSyncSetup.tsx, src/components/CloudSyncSetup.test.tsx]
  modified: [src/components/pro/ProPitchModal.tsx, src/features.ts]

key-decisions:
  - "CloudSyncSetup calls useCloudSync() unconditionally (Rules of Hooks) and branches its four UI states (free/signed-out, Pro-not-set-up, Pro-needs-passphrase, Pro-status) purely on the returned isPro/isEnabled/needsPassphrase flags — no new gating logic duplicated from the hook"
  - "The D-14 level-2 'Delete account' confirm body counts live hosted quotes via database.table('quotes').toCollection().filter(q => q.publishStatus === 'published').count() — publishStatus is not a Dexie index, so .filter() (not .where()) is used to avoid a SchemaError"
  - "Wrong-passphrase / decrypt-failure messaging is NOT synthesized in this component — it renders useCloudSync's existing cloud.error string verbatim, since the hook (47-05) already produces the exact friendly message from cloudSyncCycleInner's decrypt catch block"
  - "supabase.functions.invoke('delete-account') is called directly from the component (no new util file) since files_modified scoped this plan to CloudSyncSetup.tsx/test.tsx, ProPitchModal.tsx, and features.ts only"

requirements-completed: [D-06, D-07, D-10, D-12, D-14, D-15]

coverage:
  - id: D1
    description: "Free/signed-out users see a Pro chip (not the passphrase form) in CloudSyncSetup; clicking it opens the shared ProPitchModal, which defers sign-in to onOpenSignIn without collecting an email itself (D-15)"
    requirement: D-15
    verification:
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — free / signed-out path (D-15) > shows the Pro chip, not the passphrase form, and clicking it opens ProPitchModal"
        status: pass
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — free / signed-out path (D-15) > defers sign-in to onOpenSignIn from the pitch modal, without collecting an email itself"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pro setup flow shows a live zxcvbn strength meter and the unrecoverable-passphrase warning, with submit disabled until the min-strength rule passes (D-06/D-07)"
    requirement: D-06
    verification:
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — Pro, not yet set up (D-06/D-07) > shows the strength meter and unrecoverable-passphrase warning, with submit disabled until strength passes"
        status: pass
    human_judgment: false
  - id: D3
    description: "A new-device state (needsPassphrase) renders a passphrase ENTRY field (not setup) and a wrong passphrase surfaces the hook's friendly decrypt-failure message (Pitfall 5)"
    requirement: D-10
    verification:
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — Pro, new device (needsPassphrase, Pitfall 5) > renders a passphrase ENTRY field (not setup) and calls enterPassphrase on submit"
        status: pass
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — Pro, new device (needsPassphrase, Pitfall 5) > surfaces a friendly decrypt-failure message from a wrong passphrase via the hook error state"
        status: pass
    human_judgment: false
  - id: D4
    description: "Status shows 'Last synced Xs ago' plus a quiet conflictNote line with no toast/header chrome (D-12)"
    requirement: D-12
    verification:
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — Pro, enabled + key present (quiet status, D-12) > shows 'Last synced' status with no toast/header chrome, and a Sync now button"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both D-14 self-serve deletion levels (turn off cloud sync + delete account) are present for a Pro user, each confirm-gated via the shared ConfirmModal and never firing on render alone; the delete-account confirmation surfaces the live hosted-quote count from local data; neither control renders for a free/signed-out user"
    requirement: D-14
    verification:
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — D-14 self-serve deletion, confirm-gated > shows both deletion controls for a Pro signed-in user, each confirm-gated (never auto-fires)"
        status: pass
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — D-14 self-serve deletion, confirm-gated > surfaces the live hosted-quote count from local data in the Delete account confirmation"
        status: pass
      - kind: unit
        ref: "src/components/CloudSyncSetup.test.tsx#CloudSyncSetup — no destructive controls for a free/signed-out user > does not render either D-14 deletion control when not Pro"
        status: pass
    human_judgment: false
  - id: D6
    description: "ProPitchModal's single bundle-pitch paragraph now mentions real-time cloud sync and the end-to-end/zero-knowledge line without adding a second modal; features.ts registers a 'cloud-sync' NEW-badge key"
    requirement: D-15
    verification:
      - kind: other
        ref: "grep -qi cloud src/components/pro/ProPitchModal.tsx && grep -q cloud-sync src/features.ts"
        status: pass
      - kind: unit
        ref: "npx vitest run src/components/pro (36 tests, all existing ProPitchModal/BillingPanel/etc. suites unaffected)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-23
status: complete
---

# Phase 47 Plan 06: CloudSyncSetup UI Summary

**Pro-chipped CloudSyncSetup component (passphrase setup/entry/status/reset/delete) plus a ProPitchModal extended with the cloud-sync/zero-knowledge story and a registered `cloud-sync` NEW badge — component built but not yet mounted (mounting is 47-07).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-23T23:04:00-04:00
- **Completed:** 2026-07-23T23:16:19-04:00
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `CloudSyncSetup.tsx`: a new Data-tab subsection driven entirely by `useEntitlement().isPro` and `useCloudSync()` — free/signed-out users see one Pro chip opening the shared `ProPitchModal`; Pro users get first-time passphrase setup (zxcvbn strength meter, submit gated on `score >= 3`, the unrecoverable-passphrase warning), per-device passphrase entry on `needsPassphrase`, quiet "Last synced Xs ago" + `conflictNote` status with no toasts/header chrome, `Sync now` / `Restore pre-merge state`, and both D-14 deletion levels
- Both destructive deletion controls (`Turn off cloud sync & delete cloud copy`, `Delete account`) are confirm-gated through the shared `ConfirmModal` — neither ever fires from a render or a single click; `Delete account`'s confirmation body reads a live count of this device's `published` hosted quotes from local Dexie data (no extra network round trip) before calling the `delete-account` edge function
- `ProPitchModal.tsx`'s one pitch paragraph extended to mention real-time cloud sync and the "end-to-end encrypted, we can't read your data" line, alongside the existing hosted-quote-links + white-label story — still one modal, one voice, now opened from three entry points (ShareQuoteButton, BrandingSection, CloudSyncSetup)
- `features.ts` gained a `'cloud-sync'` `featureReleases` key (2026-07-23) for the whole Data-tab subsection's NEW badge
- 9 new unit tests in `CloudSyncSetup.test.tsx` cover every branch: free/signed-out Pro chip, strength-gated setup, needsPassphrase entry + decrypt-failure error surfacing, quiet status, and both deletion levels (including the free-user absence check)

## Task Commits

Each task was committed atomically:

1. **Task 1: CloudSyncSetup component — Pro chip, passphrase setup/entry, status, reset, two-level delete** - `59c70d5` (feat)
2. **Task 2: Extend ProPitchModal copy + register the cloud-sync NEW badge** - `006c028` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/CloudSyncSetup.tsx` - Pro-chipped cloud-sync Data-tab subsection (setup/entry/status/reset/delete)
- `src/components/CloudSyncSetup.test.tsx` - 9 unit tests covering every branch and both D-14 deletion levels
- `src/components/pro/ProPitchModal.tsx` - bundle-pitch paragraph extended with the cloud-sync/zero-knowledge line
- `src/features.ts` - `cloud-sync` NEW-badge key registered

## Decisions Made
- `CloudSyncSetup` owns its own `ProPitchModal` open/close state and takes an `onOpenSignIn: () => void` prop, mirroring `BrandingSection`'s `onOpenPitch` + `UserProfileModal`'s `onOpenSignIn` pattern exactly — sign-in itself stays deferred to the existing App-level `SignInModal` (D-09), never collected here
- The setup passphrase strength check runs in a `useEffect` keyed on the passphrase value with a `cancelled` guard, so a fast typist's overlapping async `checkPassphraseStrength` calls never apply a stale result
- The live hosted-quote count for the `Delete account` confirmation uses `.toCollection().filter(...)` rather than `.where('publishStatus').equals(...)` because `publishStatus` is not a Dexie index on the `quotes` table (would throw a SchemaError)
- On successful account deletion, the component calls `window.location.reload()` (mirroring `restorePreMergeAction`'s existing post-destructive-op reload pattern in `useCloudSync.ts`) so the whole app shell re-derives its now-signed-out state, rather than hand-rolling local sign-out bookkeeping
- `ConfirmModal`'s built-in `onConfirm` try/catch + error-display is relied on directly for both deletion flows (`turnOffAndDeleteCloud`, `handleDeleteAccount`) — no duplicate error state was added in the component

## Deviations from Plan

None — plan executed exactly as written. `files_modified` in the plan frontmatter (`CloudSyncSetup.tsx`, `CloudSyncSetup.test.tsx`, `ProPitchModal.tsx`, `features.ts`) matches the actual diff exactly.

## Issues Encountered
- The first test attempt queried `container!.querySelector('[role="dialog"]')` for the portal-rendered `Modal`, which fails since `Modal` renders via `createPortal(..., document.body)` outside the test's local `container` div. Fixed by querying `document.querySelector` instead — caught immediately by the first test run, no production code change needed.
- Directly setting a controlled `<input>`'s `.value` and dispatching a plain `Event('input')` does not trigger React's synthetic `onChange` (React tracks value changes via its own property-descriptor interception). Used the project's existing `setInputValue` native-setter helper pattern (established in `LogMaintenanceModal.test.tsx` et al.) instead.

## User Setup Required
None - no external service configuration required. (The `delete-account` edge function this component calls was already deployed live in 47-02.)

## Next Phase Readiness
- `CloudSyncSetup` and the extended `ProPitchModal` are ready to be mounted — 47-07 wires `CloudSyncSetup` into `BackupRestoreSection.tsx` alongside the existing file-sync `SyncSetup`, and adds the cloud launch-merge check + cloud pending-merge `SyncMergeSummary` to `App.tsx`, at which point `onOpenSignIn` gets threaded from `App.tsx` the same way `UserProfileModal` already receives it.
- No blockers. Full project test suite (141 files, 1583 tests) passes with no regressions; `tsc -b`, `eslint`, and `lint:no-raw-html` are all clean.

---
*Phase: 47-cloud-sync*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`59c70d5`, `006c028`) verified present in git log.
