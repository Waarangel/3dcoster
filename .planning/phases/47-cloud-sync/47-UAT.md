---
status: testing
phase: 47-cloud-sync
source: [47-01-SUMMARY.md, 47-02-SUMMARY.md, 47-03-SUMMARY.md, 47-04-SUMMARY.md, 47-05-SUMMARY.md, 47-06-SUMMARY.md, 47-07-SUMMARY.md, 47-08-SUMMARY.md]
started: 2026-07-24T19:05:00Z
updated: 2026-07-24T19:05:00Z
---

## Current Test

number: 2
name: Two-device cloud sync — full checklist (47-07 Task 3 re-confirmation)
expected: |
  See test 2 below — the 7-step two-device checklist (passphrase setup, first-connect
  gate, real-time propagation, wrong passphrase, file+cloud coexist, risky merge +
  restore, turn off & delete). Requires the founder with a Pro account on two
  devices/browser profiles.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Fresh dev-server start + fresh /app load boots clean — no console errors, calculator interactive, Settings → Data tab opens with both sync sections mounted.
result: pass
note: "Verified by Claude 2026-07-24 via preview browser (DOM-read method — hidden-pane gotcha): fresh npm run dev on 4173, /app boots, grams=100/hours=5 produced live True Cost/Cost Breakdown numbers, Settings → Data shows BOTH the file-sync section (shared folder/Dropbox) AND Cloud sync (NEW badge, zero-knowledge copy, 'Set up cloud sync' with PRO chip while signed out — 47-06 D1 behavior). Zero console errors; zero *.supabase.co requests (only localhost dev-module loads of supabaseClient.ts)."


### 2. Two-device cloud sync — full checklist (47-07 Task 3 re-confirmation)
expected: |
  On a signed-in Pro account with the live backend (two devices or two browser profiles):
  1. Device A: Settings → Data → Cloud sync → set a strong passphrase (strength meter + unrecoverable-passphrase warning show). Setup succeeds.
  2. Device B (same account): enter the SAME passphrase → the FIRST-CONNECT merge summary appears and is confirm-gated (D-10), then applies.
  3. Create a job/sale on A → it appears on B within a few seconds WITHOUT refresh (D-02 real-time). No toast/header chrome (D-12).
  4. Wrong passphrase on a third device/profile → friendly "didn't unlock" message, no crash (Pitfall 5).
  5. File sync (shared folder) still works independently at the same time (D-04).
  6. Risky merge (delete many records on B while A is offline, reconnect) → risky-merge confirm gate appears (D-09); "Restore pre-merge state" works (D-11).
  7. "Turn off cloud sync & delete cloud copy" → cloud blob gone, local data intact (D-14 level 1).
  NOTE: this is the post-fix re-confirmation of 47-07 Task 3 — the original run found real-time propagation dead (fixed in 066c9c2/539b3f4/169c2b5); no re-test was recorded.
result: [pending]
coverage_id: 47-07/W3

### 3. Auto-write cadence (no manual Sync now needed)
expected: During test 2, edits on a device publish automatically within ~3–5 seconds (debounced auto-write) without pressing any "Sync now" button, and the launch check runs on app open (a device that was closed during remote edits sees them after reopening). (47-05 D5 — unit-tested only; live timing needs real devices.)
result: [pending]
coverage_id: 47-05/D5

### 4. GDPR inventory row for sync blob (47-01 D1)
expected: docs/DATA-FLOW-INVENTORY.md has a sync-blob row - ciphertext-only, D-08 minimal envelope.
result: pass
source: automated
coverage_id: 47-01/D1

### 5. Privacy policy discloses cloud sync (47-01 D2)
expected: PrivacyPage.tsx discloses the end-to-end encrypted cloud sync blob and ~90-day lapsed retention.
result: pass
source: automated
coverage_id: 47-01/D2

### 6. sync_blobs schema + CAS version (47-02 D1)
expected: public.sync_blobs holds one ciphertext row per account with a monotonic CAS version and D-08 minimal envelope columns only.
result: pass
source: automated
coverage_id: 47-02/D1

### 7. Anon zero-access + owner RLS + atomic CAS (47-02 D2)
expected: Anon has zero access to sync_blobs (table ACL + RPC EXECUTE); authenticated owners read/write only their own row; upload_sync_blob is an atomic CAS.
result: pass
source: automated
coverage_id: 47-02/D2

### 8. Retention cron + delete-account cascade (47-02 D3)
expected: pg_cron deletes lapsed accounts' blobs ~90 days after Pro lapse; delete-account edge function removes blob+auth+entitlement via FK cascade.
result: pass
source: automated
coverage_id: 47-02/D3

### 9. Realtime private channel authorization (47-02 D4)
expected: Realtime private channel sync:<uid> is authorized only for the owning account.
result: pass
source: automated
coverage_id: 47-02/D4

### 10. AES-256-GCM round-trip (47-03 D1)
expected: encryptSyncFile/decryptSyncFile AES-256-GCM round-trip returns byte-identical plaintext.
result: pass
source: automated
coverage_id: 47-03/D1

### 11. Argon2id key derivation + deterministic salt (47-03 D2)
expected: deriveKeyFromPassphrase (Argon2id via hash-wasm) + deriveSaltFromAccountId work as specified.
result: pass
source: automated
coverage_id: 47-03/D2

### 12. Passphrase strength gate (47-03 D3)
expected: checkPassphraseStrength rejects weak, accepts strong (lazy zxcvbn).
result: pass
source: automated
coverage_id: 47-03/D3

### 13. Non-extractable key cache (47-03 D4)
expected: Derived key cached as a non-extractable CryptoKey in a dedicated IndexedDB store.
result: pass
source: automated
coverage_id: 47-03/D4

### 14. Risky-merge detection (47-05 D1)
expected: needsRiskyConfirmation (D-09) false for routine merges, true for over-threshold deletes.
result: pass
source: automated
coverage_id: 47-05/D1

### 15. useCloudSync composition (47-05 D2)
expected: useCloudSync composes syncCrypto+cloudBlobIO with the unchanged Phase 44 merge core.
result: pass
source: automated
coverage_id: 47-05/D2

### 16. First-connect confirm gate logic (47-05 D3)
expected: First connect on a device is always confirm-gated (D-10); routine merges after are silent.
result: pass
source: automated
coverage_id: 47-05/D3

### 17. Pro gating / zero network when not Pro (47-05 D4)
expected: isProStatus false pauses setup/sync/push with zero network (D-13).
result: pass
source: automated
coverage_id: 47-05/D4

### 18. Free users see Pro chip (47-06 D1)
expected: Free/signed-out users see a Pro chip (not the passphrase form) in CloudSyncSetup.
result: pass
source: automated
coverage_id: 47-06/D1

### 19. Strength meter + unrecoverable warning (47-06 D2)
expected: Pro setup flow shows a live zxcvbn strength meter and the unrecoverable-passphrase warning.
result: pass
source: automated
coverage_id: 47-06/D2

### 20. New-device passphrase entry state (47-06 D3)
expected: needsPassphrase renders a passphrase ENTRY field (not setup).
result: pass
source: automated
coverage_id: 47-06/D3

### 21. Quiet status + conflict note (47-06 D4)
expected: Status shows "Last synced Xs ago" plus a quiet conflictNote line, no toast/header chrome (D-12).
result: pass
source: automated
coverage_id: 47-06/D4

### 22. Both D-14 self-serve deletion levels in UI (47-06 D5)
expected: Turn off cloud sync + delete account both reachable.
result: pass
source: automated
coverage_id: 47-06/D5

### 23. ProPitchModal mentions cloud sync (47-06 D6)
expected: Bundle-pitch paragraph mentions real-time cloud sync.
result: pass
source: automated
coverage_id: 47-06/D6

### 24. CloudSyncSetup mounted + launch-merge wired (47-07 W1)
expected: CloudSyncSetup mounted in Settings → Data next to SyncSetup; cloud checkOnLaunch + cloud SyncMergeSummary wired in App.tsx.
result: pass
source: automated
coverage_id: 47-07/W1

### 25. Free floor backend-silent with cloud UI mounted (47-07 W2)
expected: Signed-out Settings → Data + calculator use produces zero Supabase-origin requests (playwright e2e green, fresh re-run 2026-07-24).
result: pass
source: automated
coverage_id: 47-07/W2

### 26. /features cloud-sync row shipped Pro Yes (47-08 F1)
expected: ComingCell removed, COMING_TO_PRO strip and intro updated, Etsy/carrier/QuickBooks rows untouched.
result: pass
source: automated
coverage_id: 47-08/F1

### 27. /pricing zero-knowledge cloud-sync bullet (47-08 F2)
expected: PRO_FEATURES includes the end-to-end-encrypted bullet; price constants untouched.
result: pass
source: automated
coverage_id: 47-08/F2

### 28. Roadmap ship-and-remove (47-08 F3)
expected: "Real-time device sync" removed from src/roadmap.ts; remaining pro:true entries mirror the Coming strip.
result: pass
source: automated
coverage_id: 47-08/F3

## Summary

total: 28
passed: 26
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

[none yet]
