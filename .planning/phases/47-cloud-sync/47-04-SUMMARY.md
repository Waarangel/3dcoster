---
phase: 47-cloud-sync
plan: 04
subsystem: cloud-sync-transport
tags: [supabase, realtime, cas, optimistic-concurrency, sync]
status: complete
dependency-graph:
  requires: [47-01, 47-02]
  provides: [cloudBlobIO.ts]
  affects: [47-05, 47-06, 47-07]
tech-stack:
  added: []
  patterns:
    - "Server-side compare-and-swap (CAS) upload with client-side re-fetch/re-merge/retry loop"
    - "Supabase Realtime private-channel Broadcast notify (cloud analog of syncLock.ts's BroadcastChannel)"
key-files:
  created:
    - src/utils/cloudBlobIO.ts
    - src/utils/cloudBlobIO.test.ts
  modified: []
decisions:
  - "uploadBlob/downloadBlob/resetCloudBlob/uploadWithRetry/broadcastBlobUpdated/subscribeToCloudPeers each independently guard on !supabase / no signed-in session — no shared React-hook context, this is a pure transport module callable from anywhere"
  - "broadcastBlobUpdated opens a fresh channel per call (subscribe -> send -> removeChannel) rather than holding a persistent channel, keeping the function pure/testable and avoiding channel-lifecycle state in a non-hook module"
  - "getLastKnownVersion/setLastKnownVersion guard was intentionally NOT applied — they are pure local settings-store reads/writes (no network regardless of supabase state), so gating them on session would only break legitimate offline reads of the cached version"
metrics:
  duration: 12min
  tasks_completed: 2
  files_touched: 2
  completed: 2026-07-24
---

# Phase 47 Plan 04: cloudBlobIO cloud transport layer Summary

Built `src/utils/cloudBlobIO.ts` — the direct cloud sibling of `syncFileIO.ts` — implementing atomic compare-and-swap ciphertext upload with a bounded re-fetch/re-merge/retry loop, RPC-backed download/reset, last-known-version persistence, and a Supabase Realtime private-channel broadcast/subscribe notify pair, all guarded to stay network-silent on the free floor.

## What Was Built

**Task 1 — Transport core (download, CAS upload + retry, reset, version persistence):**
- `downloadBlob()` calls the `download_sync_blob` RPC, returns `{ ciphertext, version } | null`
- `uploadBlob(ciphertext, expectedVersion)` calls `upload_sync_blob`, maps `{ new_version, accepted }` → `{ newVersion, accepted }`
- `uploadWithRetry(ciphertext, reDeriveCiphertext, maxAttempts = 3)` — the CAS retry loop (RESEARCH Pattern 1, T-47-04): on `accepted: true` persists the version and returns; on a CAS rejection, invokes the injected `reDeriveCiphertext` callback (the hook's re-fetch → decrypt → re-merge → re-encrypt cycle) and retries with the fresh ciphertext, bounded by `maxAttempts`, then throws a clear conflict error
- `resetCloudBlob()` calls `reset_sync_blob` (D-07) and clears the persisted version
- `getLastKnownVersion()` / `setLastKnownVersion(v)` persist under the local settings key `cloudSyncLastKnownVersion` (default 0), mirroring `syncFileIO.ts`'s locally-scoped settings-key convention (not added to the central `settingsKeys` object, same as `SYNC_FOLDER_PATH_SETTING_KEY`)
- Every network-touching export short-circuits to a safe empty result with zero network calls when `supabase` is null or no session is signed in (PRO-01)

**Task 2 — Realtime private-channel notify:**
- `broadcastBlobUpdated(userId, version, updatedAt)` opens `sync:${userId}` as a private channel, waits for the `SUBSCRIBED` status via the callback-based `subscribe()` API (not a Promise-returning call in supabase-js v2 — implemented as a wrapped `new Promise` resolving on `SUBSCRIBED` / rejecting on `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`), sends `{ type: 'broadcast', event: 'blob-updated', payload: { version, updatedAt } }` (D-08 minimal envelope — ciphertext never included), then calls `removeChannel`
- `subscribeToCloudPeers(userId, cb)` subscribes to the same private channel's `blob-updated` broadcast event and returns an unsubscribe function that calls `removeChannel` — mirrors `syncLock.ts`'s `subscribeToPeers` contract exactly, the cross-device analog of the same-device `BroadcastChannel` notify
- No-op (callable, does-nothing unsubscribe) when `supabase` is null

## Verification

- `npx vitest run src/utils/cloudBlobIO.test.ts` — 24/24 passing (download null/row/error, upload accepted/CAS-reject/error, retry-then-success, retry-exhaustion-throws, version persistence round-trip, reset clears version, broadcast minimal-payload assertion, subscribe forward + no-op-when-null)
- `npx tsc -b` — clean, no errors
- Full suite `npx vitest run` — 1556 passed / 8 skipped / 1 todo, no regressions
- `grep syncCrypto src/utils/cloudBlobIO.ts` — only appears in comments (module never imports it; ciphertext-only transport confirmed)

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed in the same two files as specified (`src/utils/cloudBlobIO.ts`, `src/utils/cloudBlobIO.test.ts`), committed as two atomic commits matching the plan's task boundaries.

## Known Stubs

None. Every exported function is fully wired to its RPC/channel counterpart from 47-02; nothing is a placeholder awaiting a later plan.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-47-04, T-47-11, T-47-05, T-47-12, T-47-13) — all five are directly addressed by this plan's guards (CAS retry loop, minimal broadcast payload, non-null-supabase + signed-in-session gate on every network path).

## Self-Check: PASSED

- FOUND: src/utils/cloudBlobIO.ts
- FOUND: src/utils/cloudBlobIO.test.ts
- FOUND: commit 755a9a6 (Task 1)
- FOUND: commit c783ee6 (Task 2)
