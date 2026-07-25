---
created: 2026-07-25
source: Phase 47 UAT session (founder observation after two-device test passed)
area: settings / data UX copy
resolves_phase: 51 (or a quick task sooner)
---

# Backup & Restore copy is stale for cloud-sync-enabled Pro users

Founder observation (2026-07-25, screenshot in session): the Backup section in
Settings → Data still says **"Your data lives only in this browser, so a backup
is your safety net against a cleared profile or a new computer."** That was
true pre-Phase-47. For a Pro user with cloud sync ENABLED it is now wrong on
its face — their data also lives as an end-to-end-encrypted copy in the cloud
and follows them to any signed-in device.

## What should change (recommendation)

Make the Backup blurb state-aware (same `isPro && isEnabled` signal
CloudSyncSetup already uses):

- **Cloud sync OFF (free floor / Pro-not-enabled)** — keep today's copy verbatim.
- **Cloud sync ON** — e.g.: "Your data syncs end-to-end encrypted across your
  signed-in devices. A backup file is still worth keeping: it's the only way
  back in if you ever forget your sync passphrase (we can't recover it), and
  it works without an account."

## Why Backup stays relevant for Pro (do NOT remove it)

1. **Passphrase loss = cloud copy unreadable by design** (zero-knowledge,
   Argon2id + AES-GCM; unrecoverable-passphrase warning is already in the
   setup flow). The plaintext backup file is the ONLY recovery path.
2. Plain-file **export/portability** (open-source, no-lock-in promise on
   /features) — independent of any account or subscription.
3. **Pre-merge / pre-restore safety net** and offline archival.
4. Cloud blob is a single latest-state snapshot, not a point-in-time archive —
   a downloaded backup is the user's version history.

Small copy-only change in `BackupRestoreSection.tsx` (+ its test). No data-flow
or schema impact. Litmus: user-describable → gets a NEW badge? No — copy
correction, not a feature.

## Resolved

2026-07-25, same day: state-aware `backupBlurb(cloudSyncOn)` in BackupRestoreSection.tsx keyed on the same `isPro && cloud.isEnabled` signal CloudSyncSetup uses; TDD (RED→GREEN), full suite 1604 green.
