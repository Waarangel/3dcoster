---
phase: 47-cloud-sync
plan: 07
subsystem: app-shell
tags: [cloud-sync, settings, launch-merge, free-floor, realtime, uat-gap-closure]

# Dependency graph
requires:
  - phase: 47-cloud-sync
    provides: "47-05/47-06 artifacts: useCloudSync hook, CloudSyncSetup component, cloudBlobIO, cloudSyncGates"
provides:
  - "CloudSyncSetup mounted in Settings → Data alongside file-sync SyncSetup (D-04 coexist)"
  - "App shell cloud launch-merge: useCloudSync.checkOnLaunch in the launch effect + cloud SyncMergeSummary render (D-10)"
  - "Free-floor no-network E2E extended to prove the mounted cloud-sync UI adds zero Supabase calls signed-out (PRO-01)"
  - "Realtime propagation actually works: shared persistent channel per topic + setAuth-before-join + bounded join timeout (T-47-05)"
affects: [47-08, 51-launch-prep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabase-js Realtime: client.channel(topic) DEDUPES by topic — never removeChannel() a topic another subscriber is using; keep one shared persistent channel per topic"
    - "RealtimeChannel.subscribe() reads accessTokenValue synchronously; call realtime.setAuth(session.access_token) explicitly before every private-channel join or the join can go out as anon and be silently RLS-rejected"
    - "Notification-only broadcasts stay OUTSIDE withSyncLock's awaited chain (fire-and-forget) so a hung channel join can't trip the 30s critical-section watchdog"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/components/BackupRestoreSection.tsx
    - src/components/SettingsModal.tsx
    - src/components/CloudSyncSetup.tsx
    - src/components/SyncSetup.tsx
    - src/hooks/useCloudSync.ts
    - src/utils/cloudBlobIO.ts
    - src/utils/cloudSyncGates.ts
    - e2e/free-floor-no-network.spec.ts

key-decisions:
  - "Empty merge plans (zero adds/updates/deletes) apply silently — isMergePlanEmpty() gate — instead of surfacing a 'No changes to merge' review panel"
  - "Pending-merge review renders FIRST in CloudSyncSetup, above status/actions; 'Sync now' disabled with a hint while a merge is pending; off-switch reachable from locked AND synced states"
  - "NEW badge side-anchor pattern (left-full ml-2) applied to both CloudSyncSetup and the file-sync SyncSetup headings"

patterns-established:
  - "UAT-driven gap closure in-session: founder two-device test found real-time propagation dead; root cause traced at supabase-js/realtime-js SOURCE level (channel dedupe + token race), not guessed"

requirements-completed: [D-04, D-10]

coverage:
  - id: W1
    description: "CloudSyncSetup mounted in Settings → Data next to SyncSetup; cloud checkOnLaunch + cloud SyncMergeSummary wired in App.tsx"
    requirement: "D-04, D-10"
    verification:
      - kind: other
        ref: "grep CloudSyncSetup in BackupRestoreSection.tsx + useCloudSync in App.tsx; npm run build green; full vitest suite 1601 passed (2026-07-24)"
        status: pass
    human_judgment: false
  - id: W2
    description: "Free floor stays backend-silent with the cloud UI mounted: signed-out Settings → Data + calculator use produces zero Supabase-origin requests"
    requirement: "PRO-01 boundary (phase truth 3)"
    verification:
      - kind: e2e
        ref: "npx playwright test e2e/free-floor-no-network.spec.ts — 1 passed (re-run fresh 2026-07-24 during summary reconstruction)"
        status: pass
    human_judgment: false
  - id: W3
    description: "Real two-device flow: edit on A appears on B within seconds (D-02), first connect confirm-gated (D-10), wrong-passphrase friendly, risky-merge gate + pre-merge restore, file+cloud coexist, self-serve delete"
    requirement: "D-02, D-09, D-10, D-11, D-14, SYNC-02"
    rationale: "Founder ran the two-device UAT 2026-07-24 (gaps found → all fixed, see Deviations); post-fix re-confirmation NOT recorded in any artifact — this is the phase's primary human UAT test"
    verification: []
    human_judgment: true

duration: session of 2026-07-24 (executor + live founder UAT); summary reconstructed same day
completed: 2026-07-24
status: complete
---

# Phase 47 Plan 07: Mount CloudSyncSetup + Cloud Launch-Merge Summary

**Cloud sync became reachable and real: CloudSyncSetup mounted in Settings → Data beside file sync, cloud launch-merge wired into the App shell, the free-floor E2E proves the mounted UI stays backend-silent signed-out — and a live two-device founder UAT drove three root-caused gap-closure fixes, including the one that made real-time propagation actually work.**

> **Reconstruction note:** the executing session ended without writing this summary; it was reconstructed 2026-07-24 by a follow-up session from the plan, the commit trail (`ad5f280`, `bb63334`, `066c9c2`, `539b3f4`, `169c2b5`, `e49d6a5` + docs commits `f4490b1`, `e8a2ec1`, `1b56751`), and a fresh re-run of the automated verifications. Everything below is traceable to those artifacts; nothing is claimed beyond them.

## Task Commits

1. **Task 1: Mount CloudSyncSetup + wire cloud launch-merge into App shell** - `ad5f280` (feat) — also touched SettingsModal(+test) and vite.config.ts as wiring fallout
2. **Task 2: Extend free-floor E2E to cover mounted CloudSyncSetup** - `bb63334` (test) — re-run green 2026-07-24: 1 passed
3. **Task 3: [BLOCKING] Human two-device UAT** — executed live by the founder 2026-07-24; found gaps, closed in-session (below). Post-fix re-confirmation is the one outstanding human item.

## Deviations from Plan (UAT gap closure)

**1. [Critical] Real-time propagation never worked — edits never appeared on device B**
- **Found during:** Task 3 founder UAT
- **Root cause (source-level trace of supabase-js/realtime-js, not guessed):** `client.channel(topic)` dedupes by topic, so `broadcastBlobUpdated` re-used the SAME channel object `subscribeToCloudPeers` had joined, then `removeChannel()`'d it after every publish — destroying the account's only listening channel after the first write. Separately, `RealtimeChannel.subscribe()` reads the socket's `accessTokenValue` synchronously (populated by an async un-awaited setAuth), a race that could join the private channel as anon and be silently RLS-rejected (T-47-05).
- **Fix:** one shared persistent channel per topic (never torn down by a broadcast), explicit `realtime.setAuth()` before every join, bounded join timeout surfacing failures via status callback, `subscribeToCloudPeers` gains `onError`.
- **Committed in:** `066c9c2` (cloudBlobIO.ts + tests)

**2. [Major] Empty merge plan surfaced a pointless review panel; peer-notify inside the sync lock tripped the 30s watchdog**
- **Fix:** `isMergePlanEmpty()` predicate (cloudSyncGates.ts) — zero-change merges apply silently; `publishLocalSnapshot`'s notification-only broadcast moved outside the awaited `withSyncLock` chain (fire-and-forget), `onError` wired into hook error state.
- **Committed in:** `539b3f4` (useCloudSync.ts, cloudSyncGates.ts + tests)

**3. [Major] CloudSyncSetup UI issues (UAT bugs #2/#7):** pending-merge review buried below action buttons; "Sync now" a silent no-op while a merge pending; off-switch buried at panel bottom; NEW badge overlay mispositioned.
- **Fix:** review renders first; "Sync now" disabled with hint while pending; "Turn off cloud sync & delete cloud copy" moved under the primary status area, reachable from locked and synced states; NEW badge switched to the `left-full ml-2` side-anchor.
- **Committed in:** `169c2b5` (CloudSyncSetup.tsx + test); companion file-sync SyncSetup badge fix found uncommitted from that session, landed as `e49d6a5`.

## Launch-checklist progress recorded en route (docs commits)

- `f4490b1` — flagged the dev-pointed Supabase `site_url`/redirect allow-list on launch checklist item 4
- `e8a2ec1` + `1b56751` — Resend SMTP configured for Supabase Auth; 3dcoster.com domain verified in Resend; Auth sender now support@3dcoster.com (launch items 2 + 10 done)

## UAT findings deferred as todos (not 47-07 defects)

- `.planning/todos/pending/auth-error-fragment-silently-swallowed.md` — auth `#error` fragments silently swallowed on app load + PKCE client ignores implicit-grant fragments; same-browser magic-link limitation documented (from 47 UAT sign-in debugging)
- `.planning/todos/pending/cancel-retention-workflow.md` — cancel/retention flow captured for founder decision

## Verification

- `npm run build` green; full vitest suite **1601 passed | 8 skipped | 1 todo** (2026-07-24, post-merge)
- `npx playwright test e2e/free-floor-no-network.spec.ts` — **1 passed** (fresh re-run 2026-07-24)
- **Outstanding human item:** post-fix re-confirmation of the full two-device checklist (real-time D-02, first-connect gate D-10, wrong passphrase, risky-merge gate D-09 + pre-merge restore D-11, file+cloud coexist D-04, self-serve delete D-14) — carried to `/gsd-verify-work 47` as the phase's primary UAT test.

## Next Phase Readiness

- 47-08 (marketing flips) already executed 2026-07-24 — all 8 phase-47 plans now have summaries.
- Phase close-out: `/gsd-verify-work 47` (owns the two-device re-confirmation above).

---
*Phase: 47-cloud-sync*
*Completed: 2026-07-24*
