# Phase 47: Cloud sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 47-cloud-sync
**Areas discussed:** Sync engine shape, Customer-data privacy, Conflict & merge UX, Account & lapse lifecycle

---

## Sync engine shape

### What should the cloud unit of sync be?

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot blob | One sync-file blob per account in Supabase — the Phase 44 sync file with the cloud replacing the Dropbox folder; devices fetch, merge locally, push back | ✓ |
| Generic change-log rows | Single `sync_changes` JSONB table with cursor-based pulls; incremental but new server schema + clumsier E2E encryption | |
| Per-store mirrored tables | Real Postgres table per Dexie store with RLS + Realtime; most work, plaintext-only in practice, likely blows the 1–2wk estimate | |

**User's choice:** Snapshot blob (recommended)

### How live does sync between devices need to be?

| Option | Description | Selected |
|--------|-------------|----------|
| Live push while open | Supabase Realtime channel notifies other open devices to fetch + merge within seconds; plus launch sync + debounced push | ✓ |
| Launch + after-write only | File-sync cadence; second device sees changes on next launch — arguably not "real-time" | |
| Polling interval | Check every N minutes; laggier than push for more cost | |

**User's choice:** Live push while open (recommended)

### How quickly should local changes upload to the cloud?

| Option | Description | Selected |
|--------|-------------|----------|
| Short debounce ~3–5s | Batch rapid edits then push; other device sees changes in under 10s | ✓ |
| Reuse the 15s file-sync debounce | One shared constant, but 15–20s lag undercuts real-time feel | |
| Immediate per-write | Truest real-time but redundant uploads during save bursts | |

**User's choice:** Short debounce ~3–5s (recommended)

### Can file-based sync and cloud sync be active at the same time?

| Option | Description | Selected |
|--------|-------------|----------|
| Both can be active | Independent channels sharing one merge engine; Dropbox file doubles as user-owned backup | ✓ |
| Cloud supersedes while Pro | One active pipe, simpler QA, but removes the user-owned copy while paying | |
| User picks one explicitly | Artificial either/or with no technical basis | |

**User's choice:** Both can be active (recommended)

---

## Customer-data privacy

### What should the encryption posture of the cloud snapshot be?

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-knowledge E2E | Client encrypts (WebCrypto AES-GCM) with passphrase-derived key; Supabase stores ciphertext only | ✓ |
| Encrypted, key in account | Client-side encryption but data key in the account row — not zero-knowledge, we could decrypt | |
| Plaintext blob, RLS + at-rest only | Simplest, but customer emails/addresses become readable server-side data | |

**User's choice:** Zero-knowledge E2E (recommended)

### What should the user's encryption secret look like?

| Option | Description | Selected |
|--------|-------------|----------|
| User-chosen passphrase | Set once, typed once per device, derived key cached locally; strong KDF + strength check | ✓ |
| Generated recovery code | Stronger cryptographically but "where did I save that code" friction | |
| Passphrase + recovery code | Most robust, two secrets to explain in a 1–2wk phase | |

**User's choice:** User-chosen passphrase (recommended)

### When a user forgets their sync passphrase, how does recovery work?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset cloud copy | Self-serve: wipe server blob, set new passphrase, re-upload from current device; nothing local lost | ✓ |
| Reset + require confirmation email | Same flow gated behind email link; extra protection for a non-destructive flow | |
| No self-serve reset | Support-mediated; needless friction | |

**User's choice:** Reset cloud copy (recommended)

### What plaintext metadata may the server see alongside the encrypted blob?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal envelope | Account id, monotonic version counter, updated-at, blob size; everything else in ciphertext | ✓ |
| Envelope + device metadata | Server-backed connected-devices view at the cost of a bigger inventory entry | |
| Envelope + schema version | Marginal server-side compat checks; leaks an app-version fingerprint | |

**User's choice:** Minimal envelope (recommended)

---

## Conflict & merge UX

### How should routine incoming cloud changes apply?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent + gate risky merges | Routine LWW merges auto-apply; confirm gate only for mass deletions / long-offline divergence | ✓ |
| Fully silent, always | Purest real-time; undo snapshot as only defense | |
| Confirm-gate like file sync | Maximum safety, cancels the real-time choice | |

**User's choice:** Silent + gate risky merges (recommended)

### What happens when a device connects to cloud sync for the first time?

| Option | Description | Selected |
|--------|-------------|----------|
| Preview + confirm merge | Existing SyncMergeSummary for the initial merge, confirm-gated, pre-merge snapshot; trivial variant for empty installs | ✓ |
| Keep/replace/merge picker | More control but "use X" is destructive by design | |
| Silent from the start | Zero preview for the exact case the confirm gate was invented for | |

**User's choice:** Preview + confirm merge (recommended)

### What undo protection should silent cloud merges keep?

| Option | Description | Selected |
|--------|-------------|----------|
| Rolling pre-merge snapshots | Silent snapshot before each applied merge, small rolling window; Restore affordance in Settings → Data | ✓ |
| Snapshot only on gated merges | Less churn but routine bad merges have no undo | |
| Daily safety snapshot | Same-day bad merge can bury up to a day of work | |

**User's choice:** Rolling pre-merge snapshots (recommended)

### How visible should silent cloud sync activity be?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings-only status | "Last synced Xs ago" + quiet conflict note in Settings → Data; no toasts, no header chrome | ✓ |
| One-time toast per incoming merge | Explains data changing "by itself" but gets naggy | |
| Small header sync indicator | The exact new chrome Phase 44 D-03 declined | |

**User's choice:** Settings-only status (recommended)

---

## Account & lapse lifecycle

### When Pro lapses, what happens to the cloud snapshot?

| Option | Description | Selected |
|--------|-------------|----------|
| Retain ~90 days, then delete | Sync pauses; ciphertext kept as grace window / dead-device lifeline; auto-deleted after; stated in policy | ✓ |
| Retain until account deletion | Friendliest to returners, weakest data-minimization story | |
| Delete promptly (~14–30 days) | Aggressive minimization; forfeits the dead-device lifeline | |

**User's choice:** Retain ~90 days, then delete (recommended)

### How should users delete their cloud sync data / account?

| Option | Description | Selected |
|--------|-------------|----------|
| Self-serve, two levels | In-app cloud-copy wipe (keeps account) + full account deletion (blob + auth + entitlements, billing retention respected) | ✓ |
| Self-serve blob wipe, email for account | Defers account deletion to manual ops | |
| All by email request | Minimum build, weakest posture | |

**User's choice:** Self-serve, two levels (recommended)

### How does cloud sync appear in Settings and to free users?

| Option | Description | Selected |
|--------|-------------|----------|
| Pro-chipped in Data tab | Subsection of Backup, Restore & Sync; visible to all; Pro chip opens extended ProPitchModal | ✓ |
| Hidden until Pro | Throws away the highest-intent upsell moment | |
| Separate Sync tab | Churns the Phase 44 one-home decision for no new capability | |

**User's choice:** Pro-chipped in Data tab (recommended)

### Do the cloud-sync marketing flips happen in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Flip in-phase | /features pill → shipped Pro pill; /pricing gains cloud sync + zero-knowledge line; /roadmap entry off | ✓ |
| Defer flips to Phase 51 | Atomic launch messaging but leaves /features claiming "Coming" for shipped work | |

**User's choice:** Flip in-phase (recommended)

---

## Claude's Discretion

- Blob storage mechanism (Storage object vs table row) + Realtime channel mechanics
- KDF choice/parameters, passphrase strength rule, derived-key caching per device
- Risky-merge thresholds and rolling-snapshot retention tuning
- Sync-scope parity details and dual-debounce interplay at the `syncStamp` choke-point
- Offline/reconnect queue + Realtime backoff behavior
- 90-day retention enforcement mechanism + /privacy wording
- All flow copy (setup, passphrase warnings, reset, lapse, pitch modal)
- NEW-badge registration
- DATA-FLOW-INVENTORY entry structure + privacy-policy drafting (sequencing locked; wording discretion)

## Deferred Ideas

- Server-backed "connected devices" management view (declined with minimal envelope)
- Recovery code alongside passphrase (declined; revisit if resets are frequent)
- Toast/header sync indicators (declined; revisit on user confusion)
- Per-record change-log / mirrored-table sync (declined; zero-knowledge forecloses its benefits)
- Paddle PricePreview todo reviewed, not folded — stays in Phase 51 (blocked on SKU creation)
