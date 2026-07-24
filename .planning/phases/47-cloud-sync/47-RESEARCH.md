# Phase 47: Cloud sync - Research

**Researched:** 2026-07-23
**Domain:** Zero-knowledge E2E encrypted cloud sync on Supabase (blob transport + Realtime notify) layered on the existing Phase 44 LWW merge engine
**Confidence:** HIGH (architecture, crypto primitives, Supabase mechanics — all verified against official docs/OWASP/registry) / MEDIUM (exact risky-merge thresholds, KDF parameter tuning — reasoned recommendations, not externally mandated numbers)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sync engine shape**
- D-01: Snapshot blob per account. The cloud unit of sync is one encrypted sync-file blob per account in Supabase (Storage object or table row — planner picks) — exactly the Phase 44 sync file, with the cloud replacing the Dropbox folder. Devices fetch, merge locally with the existing `computeMerge`/`applyMerge` LWW engine, push back. No per-record server schema, no per-store mirrored tables, no server-side merge.
- D-02: Live push while open. Supabase Realtime channel per account: when device A uploads a new snapshot, other open devices are notified and fetch + merge within seconds. Plus sync on launch and debounced push after writes.
- D-03: Short upload debounce (~3–5s). Batch rapid edits, then push. Deliberately faster than the 15s file-sync debounce — a separate constant, not shared.
- D-04: File sync and cloud sync coexist. Both can be active simultaneously — independent channels sharing one merge engine (`updatedAt` stamps + tombstones are common infrastructure).

**Privacy & encryption**
- D-05: Zero-knowledge E2E encryption. The client encrypts the snapshot (WebCrypto AES-GCM) before upload; Supabase stores ciphertext only.
- D-06: User-chosen sync passphrase. Set once at cloud-sync setup, typed once per new device (derived key cached locally thereafter). Strong KDF (Argon2/PBKDF2-high-iterations — researcher validates the WebCrypto-compatible choice) + a minimum-strength check.
- D-07: Lost passphrase = self-serve cloud reset. "Reset cloud sync" wipes the server blob; user sets a new passphrase and the current device re-uploads. Nothing local is ever lost.
- D-08: Minimal plaintext envelope. Server-visible metadata is only: account id, monotonic version counter, updated-at timestamp, blob size. Device names, schema version, record counts all live inside the ciphertext.

**Conflict & merge UX**
- D-09: Silent LWW for routine merges; gate risky ones. Incoming cloud changes auto-apply silently. A confirm gate appears only for risky merges — mass deletions above a threshold, or long-offline reconnect with large divergence (planner tunes thresholds).
- D-10: First connect is confirm-gated. The initial merge on a newly-connected device shows the existing `SyncMergeSummary`, confirm-gated, with a pre-merge snapshot. After this one gate, sync goes silent per D-09.
- D-11: Rolling pre-merge snapshots. Silent local snapshot before each applied cloud merge, retained on a small rolling window (last few merges / ~24h — planner tunes). "Restore pre-merge state" affordance stays in Settings → Data.
- D-12: Settings-only visibility. "Last synced Xs ago" + a quiet note when LWW resolved conflicts inside Settings → Data. No toasts on incoming merges, no header chrome.

**Account & lapse lifecycle**
- D-13: Lapse pauses sync; blob retained ~90 days, then deleted. On `isProStatus` false, uploads/downloads stop; the ciphertext blob is kept as a grace window, auto-deleted after the window. Retention stated in the privacy policy.
- D-14: Self-serve deletion, two levels. (1) "Turn off cloud sync & delete cloud copy" — wipes the blob, keeps the account; (2) "Delete account" — removes blob + auth + entitlement records, with any live hosted quotes surfaced in the confirmation flow.
- D-15: Pro-chipped subsection in the Data tab. Cloud sync joins the Backup, Restore & Sync home in Settings → Data — visible to everyone, Pro chip for free users, click opens the `ProPitchModal` extended with the cloud-sync story. No separate Sync tab.
- D-16: Marketing flips in-phase. The /features "cloud/real-time sync" Coming pill flips to a shipped Pro pill, /pricing's Pro card gains cloud sync (including the zero-knowledge line), and the Pro-badged /roadmap entry comes off.

### Claude's Discretion
- Supabase storage mechanism for the blob (Storage bucket object vs bytea/base64 table row) and the Realtime channel mechanics (postgres_changes on the envelope row vs broadcast)
- KDF choice + parameters and passphrase minimum-strength rule; local derived-key caching mechanism (per-device; desktop may use the Phase 46 session-persistence approach)
- Risky-merge thresholds (deletion count, divergence age) and rolling-snapshot retention tuning (D-09/D-11)
- Sync-scope parity with file sync (full backup-schema store set) and how the two debounced writers share the `syncStamp` choke-point without redundant work
- Offline/reconnect queue behavior, Realtime reconnect/backoff handling, and conflict-free interplay between launch merge + Realtime notify
- Exact 90-day retention enforcement mechanism (scheduled edge function vs cleanup-on-access) and its statement wording in /privacy
- Copy for setup flow, passphrase warnings, reset flow, lapse messaging; ProPitchModal cloud-sync copy
- NEW-badge registration (`src/features.ts`) for the cloud sync subsection (user-facing → badge, absolute-overlay rule)
- DATA-FLOW-INVENTORY.md entry structure + privacy-policy section drafting (inventory first, policy second — sequencing is locked, wording is discretion)

### Deferred Ideas (OUT OF SCOPE)
- Server-backed "connected devices" management view — declined with the minimal envelope (D-08); device names stay inside the ciphertext. Revisit only if account-management demand appears.
- Recovery code in addition to passphrase — declined (D-06 single secret); revisit if lost-passphrase resets show up frequently in support.
- Toast/header indicators for sync activity — declined (D-12); revisit only if users report confusion about data "changing by itself."
- Per-record change-log / mirrored-table sync — declined (D-01 snapshot blob); would only matter for future server-side features (querying data server-side, multi-user), which zero-knowledge deliberately forecloses anyway.
- Paddle PricePreview localized pricing todo — reviewed, not folded; stays in Phase 51 (blocked on Paddle SKU creation).
</user_constraints>

## Summary

Phase 47 is a **transport + encryption** phase, not a merge-logic phase. The entire conflict-resolution core (`computeMerge`, `applyMerge`, tombstones, `updatedAt` LWW) built in Phase 44 is reused **unchanged** — cloud sync is a second producer/consumer of the exact same `SyncFile` JSON shape that file sync already validates and merges, just moved through Supabase instead of a Dropbox folder, and encrypted before it ever leaves the device.

Three new pieces carry the phase: (1) a **crypto layer** (`src/utils/syncCrypto.ts`) that encrypts the JSON sync-file bytes with WebCrypto AES-256-GCM, deriving the key from a user passphrase via Argon2id (WASM, lazy-loaded — `hash-wasm`, 11 KB gz); (2) a **cloud transport** (`src/utils/cloudBlobIO.ts` + a new Supabase table) that is the direct sibling of `syncFileIO.ts` but talks to one Postgres row per account instead of a folder; and (3) a **Realtime notify** layer (Supabase Broadcast, private per-account channel) that is the cloud analog of the existing `BroadcastChannel` peer-notify in `syncLock.ts`. A new `useCloudSync.ts` hook mirrors `useSyncFolder.ts`'s shape (module-scoped singleton + `useSyncExternalStore`) and composes these three pieces with the *unchanged* `syncMerge`/`applyMerge` core, reusing the same `withSyncLock` mutex name so file-sync and cloud-sync critical sections never interleave on the same device.

The single most important non-obvious finding: **the local Web Locks mutex from Phase 44 does not protect against two different physical devices racing a concurrent read-merge-write cycle** — it only serializes same-origin tabs on one device. Cloud sync is the first place this project has two devices writing to a *shared remote resource* at once, and it needs its own defense: an optimistic-concurrency compare-and-swap on a server-side `version` counter, with a re-fetch-merge-retry loop on conflict. This is new work, not a Phase 44 carryover, and it is the crux of the "Live push while open" (D-02) design actually being safe.

**Primary recommendation:** One new Supabase table (`sync_blobs`, one row per account, base64-**text** ciphertext column — not `bytea`, see Pitfall 3), owner-only RLS mirroring `entitlements`/`hosted_quotes`, a `version bigint` CAS column, Argon2id-via-`hash-wasm` for key derivation (OWASP-anchored parameters, salt derived deterministically from `auth.uid()` so it needs no new envelope column), AES-256-GCM via native WebCrypto for the payload, and Supabase Broadcast on a private per-account channel for live notify. Everything else — merge logic, tombstones, snapshot/undo pattern, Data-tab UI shape — is reused verbatim from Phase 44.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Passphrase entry, strength check, key derivation, encrypt/decrypt | Browser/Desktop Client | — | Zero-knowledge (D-05) — the server must never see plaintext or the passphrase; this is 100% client-side, WebCrypto + WASM |
| Conflict resolution (LWW merge, tombstones) | Browser/Desktop Client | — | Unchanged Phase 44 `computeMerge`/`applyMerge` — pure functions, no server-side merge (D-01: no per-record server schema) |
| Local persistence (Dexie/IndexedDB) | Browser/Desktop Client | — | Existing local-first store; cloud sync never becomes the source of truth (D-07/D-13 framing: "cloud is a relay") |
| Ciphertext blob storage + version counter | API/Backend (Supabase Postgres) | — | Server sees ciphertext + minimal envelope only (D-08); RLS is the access-control boundary |
| Live notify between open devices | API/Backend (Supabase Realtime) | Browser/Desktop Client | Server relays a minimal `{version, updatedAt}` broadcast message; client decides whether to pull |
| Entitlement / lapse gating | API/Backend (Supabase Postgres, `entitlements`) | Browser/Desktop Client | Existing Phase 43/46 `useEntitlement` + cached-offline pattern; sync enable/pause reads this, never writes it |
| 90-day retention enforcement | API/Backend (Supabase pg_cron) | — | Must run server-side and be independently auditable for the privacy policy — cannot depend on a client ever reconnecting |
| Settings-tab UI, Pro-chip, pitch modal | Browser/Desktop Client | — | Existing React component tree (`SyncSetup`, `ProPitchModal`) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.110.5 (already installed) | Table read/write + Realtime Broadcast channel | Already the project's Supabase client (Phase 43/46) — no new install |
| WebCrypto `crypto.subtle` | Native (browser + Tauri WebView) | AES-256-GCM encrypt/decrypt of the sync-file bytes | Zero-dependency, hardware-accelerated where available, present in every Chromium/WebKit/Gecko engine this app already targets |
| `hash-wasm` | 4.12.0 [VERIFIED: npm registry] | Argon2id key derivation from the user passphrase | Only 11 KB gz, WASM (not asm.js), fastest of the audited browser-Argon2 options (438 ops/s vs `argon2-browser`'s 213 ops/s for equivalent params) [CITED: github.com/Daninet/hash-wasm] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@zxcvbn-ts/core` | 4.1.2 [VERIFIED: npm registry] | Client-side passphrase strength meter (D-06 "minimum-strength check") | Setup-flow passphrase field only — lazy-loaded, never on the free floor |
| `@zxcvbn-ts/language-en` | 4.1.2 [VERIFIED: npm registry] | English dictionary pack for `@zxcvbn-ts/core` | Paired with core; `@zxcvbn-ts/language-common` also required — see Package Legitimacy Audit for its `[SUS]` flag |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Argon2id (`hash-wasm`) | PBKDF2-SHA256 (native `SubtleCrypto.deriveKey`, zero new dependency) | OWASP's current cheat sheet lists Argon2id as the *primary* recommendation and PBKDF2-SHA256 at 600,000 iterations as the fallback "reserved for FIPS-140 compliance" [CITED: cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html]. PBKDF2 is iteration-only (no memory cost), making it materially weaker against GPU/ASIC brute-force of a *user-chosen* passphrase — the realistic threat model here (an attacker who exfiltrates the ciphertext blob and brute-forces offline). Given this phase's marquee "we can't read your data" claim and real customer PII behind it, Argon2id is the recommended default; PBKDF2 is the documented zero-dependency fallback if the 11 KB lazy-loaded WASM chunk is unacceptable. |
| `sync_blobs` table row (base64 text) | Supabase Storage bucket object | Storage buys nothing here: RLS on a table row is exactly as expressive as Storage's `storage.objects` policies for this single-owner-single-object shape, and a table row keeps the whole feature inside the existing owner-scoped-RLS + SECURITY DEFINER pattern already proven by `hosted_quotes`/`entitlements` (Phase 43). A `bytea`/base64 payload well under Postgres's TOAST-handled multi-MB range needs no object-storage machinery. [CITED: supabase.com/docs/guides/storage/security/access-control] |
| Realtime Broadcast (private channel) | Realtime Postgres Changes | Supabase's own current guidance: "Broadcast for most database-change use cases because it scales better... If you expect more than ~3,000 concurrent subscribers on the same changes, use Broadcast." [CITED: supabase.com/docs/guides/realtime/postgres-changes]. This project's channel has 1 account's few devices, so scale isn't the driver — but Broadcast also lets the payload be a hand-built minimal message (`{version, updatedAt}`) instead of Postgres Changes' full-row payload, which is the better fit for D-08's "we see that you sync and when — never what" envelope discipline. |

**Installation:**
```bash
npm install hash-wasm @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en
```

**Version verification:** confirmed live against the npm registry this session — `hash-wasm@4.12.0`, `@zxcvbn-ts/core@4.1.2` [VERIFIED: npm registry].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `hash-wasm` | npm | published 2024-11-19, long-lived project | 1,137,822/wk | github.com/Daninet/hash-wasm | OK | Approved |
| `@zxcvbn-ts/core` | npm | published 2026-06-16 | 1,068,423/wk | github.com/zxcvbn-ts/zxcvbn | OK | Approved |
| `@zxcvbn-ts/language-en` | npm | published 2026-06-16 | 494,712/wk | github.com/zxcvbn-ts/zxcvbn | OK | Approved |
| `@zxcvbn-ts/language-common` | npm | published 2026-07-16 (18 days old at research time) | 989,196/wk | github.com/zxcvbn-ts/zxcvbn | **SUS** ("too-new" signal) | Flagged — planner must add `checkpoint:human-verify` before install |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@zxcvbn-ts/language-common` — the legitimacy check's automated "too-new" signal fired on its publish date, but the package shares the exact same GitHub repo, maintainer org, and ~1M weekly downloads as the already-`OK` `@zxcvbn-ts/core`/`@zxcvbn-ts/language-en` packages published the same month — almost certainly a routine version-lockstep release from an established monorepo, not a supply-chain risk. Still gate it behind a human-verify checkpoint per protocol rather than silently trusting the read.

No `postinstall` scripts were found on any of the four packages (`npm view <pkg> scripts.postinstall` returned empty for all).

## Architecture Patterns

### System Architecture Diagram

```
                    DEVICE A (any tab/window)                         DEVICE B
        ┌───────────────────────────────────────┐         ┌───────────────────────────────────────┐
        │  Dexie/IndexedDB write (job/sale/etc)  │         │  Dexie/IndexedDB write                 │
        │            │ (syncStamp choke-point)   │         │            │                            │
        │            ▼                            │         │            ▼                            │
        │  scheduleCloudAutoWrite (3-5s debounce) │         │  Realtime channel subscription          │
        │            │                            │         │  ('sync:<user_id>', private)            │
        │            ▼                            │         │            ▲                            │
        │  withSyncLock('3dcoster-sync-critical-  │         │            │ broadcast: {version,        │
        │   section')  ─┐                          │         │            │  updatedAt}                │
        │               │ buildBackupFile()        │         │            │                            │
        │               │ readLocalTombstones()    │         │            │                            │
        │               ▼                          │         │            │                            │
        │  syncCrypto.encrypt(passphrase-derived   │         │            │                            │
        │   key, AES-256-GCM) ──► ciphertext bytes │         │            │                            │
        │               │                          │         │            │                            │
        │               ▼                          │         │            │                            │
        │  cloudBlobIO.upload(ciphertext,          │         │            │                            │
        │   expectedVersion) ──────────────────────┼────►┌───┴────────────┴──────────┐                 │
        │               │                          │     │   Supabase (eu-central-1)  │                 │
        │   (CAS reject → refetch/re-merge/retry)  │     │  sync_blobs (owner RLS)     │                 │
        │               │                          │     │  UPDATE ... WHERE           │                 │
        │               ▼ on success                │    │   version = $expected       │                 │
        │  broadcast({version, updatedAt}) ─────────┼────►  RETURNING version           │                 │
        └───────────────────────────────────────┘     │      │                        │                 │
                                                        │      ▼ trigger/client         │                 │
                                                        │  Realtime Broadcast fan-out    │                 │
                                                        └────────────────────────────────┘                │
                                                                     │                                     │
                                                                     ▼                                     │
                                                        ┌───────────────────────────────────────┐          │
                                                        │  Device B: notify received →           │◄─────────┘
                                                        │  cloudBlobIO.download() → ciphertext    │
                                                        │  syncCrypto.decrypt() → SyncFile JSON   │
                                                        │  validateSyncFile() (UNCHANGED)         │
                                                        │  computeMerge() (UNCHANGED, D-05/D-06)  │
                                                        │  needsRiskyConfirmation(plan)? ──┐       │
                                                        │     no → applyMerge() silently   │       │
                                                        │     yes → SyncMergeSummary gate  │       │
                                                        │  rolling pre-merge snapshot (D-11)      │
                                                        └───────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── utils/
│   ├── syncCrypto.ts          # NEW — pure: AES-GCM encrypt/decrypt, Argon2id derive, passphrase strength
│   ├── cloudBlobIO.ts         # NEW — Supabase table read/write + CAS retry (sibling of syncFileIO.ts)
│   ├── syncMerge.ts           # UNCHANGED — computeMerge/validateSyncFile reused verbatim
│   ├── syncLock.ts            # UNCHANGED — same SYNC_LOCK_NAME reused for cloud cycles too
│   ├── applyMerge.ts          # UNCHANGED
│   └── backupExport.ts        # UNCHANGED — buildBackupFile() reused for both pre-merge snapshot AND upload payload
├── hooks/
│   ├── useCloudSync.ts        # NEW — mirrors useSyncFolder.ts shape, own module-scoped state
│   └── useSyncFolder.ts       # UNCHANGED
├── components/
│   ├── CloudSyncSetup.tsx     # NEW — Pro-chipped subsection in Settings → Data (D-15)
│   ├── SyncSetup.tsx          # UNCHANGED (file sync)
│   └── SyncMergeSummary.tsx   # UNCHANGED — reused for the D-10 first-connect gate
└── db/
    └── syncStamp.ts           # UNCHANGED — same updatedAt choke-point cloud debounce hooks into

supabase/
└── migrations/
    └── 0002_cloud_sync.sql    # NEW — sync_blobs table, RLS, CAS RPC, pg_cron retention job
```

### Pattern 1: Server-side compare-and-swap for the blob write (the phase's core new risk)

**What:** Every upload must be conditioned on the version the client last observed, not a blind overwrite.
**When to use:** Any write to `sync_blobs`.
**Why it's new (not a Phase 44 carryover):** `withSyncLock` (Web Locks) only serializes same-origin critical sections *on one device*. It has no reach into a second physical device. Two devices can each read version N, each merge locally against N, and each attempt to write — a naive `UPDATE sync_blobs SET ciphertext = $1` would let the second write silently discard the first device's just-applied changes (a classic lost update), even though each device's *local* merge was individually correct.

```sql
-- Source: pattern adapted from the project's existing approve_quote_decision()
-- one-transition-guard idiom (supabase/migrations/0001_pro_backend.sql)
create or replace function public.upload_sync_blob(
  p_ciphertext text,
  p_expected_version bigint
)
returns table (new_version bigint, accepted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
  v_new_version bigint;
begin
  update public.sync_blobs
    set ciphertext = p_ciphertext,
        version = version + 1,
        blob_size = length(p_ciphertext),
        updated_at = now()
    where user_id = auth.uid()
      and version = p_expected_version
    returning version into v_new_version;

  get diagnostics v_row_count = row_count;
  return query select v_new_version, v_row_count > 0;
end;
$$;
```

```typescript
// Source: pattern for cloudBlobIO.ts — the client-side retry loop
async function uploadWithRetry(ciphertext: string, maxAttempts = 3): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const expected = await getLastKnownVersion();
    const { data } = await supabase!.rpc('upload_sync_blob', {
      p_ciphertext: ciphertext,
      p_expected_version: expected,
    });
    if (data?.[0]?.accepted) {
      await setLastKnownVersion(data[0].new_version);
      return;
    }
    // Version mismatch — someone else wrote first. Re-fetch, re-merge
    // (computeMerge is idempotent/pure), re-encrypt, retry.
    await runCloudSyncCycle(); // re-fetch + merge + re-derive ciphertext
  }
  throw new Error('Cloud sync conflict could not resolve after 3 attempts.');
}
```

### Pattern 2: Deterministic per-account salt (resolves a real tension between D-06 and D-08)

**What:** D-06 requires a KDF salt to derive the passphrase-based key; D-08 caps server-visible envelope fields at account id, version, updated-at, blob size — no room for a stored random salt.
**When to use:** Key derivation setup and every subsequent device's re-derivation.
**Resolution:** Derive the salt deterministically from `auth.uid()` (already known to any signed-in device, needs zero new server storage) instead of generating and storing a random salt. A cryptographic salt's purpose is to defeat rainbow-table reuse *across different accounts* — a per-account-unique, non-secret, deterministic value satisfies that purpose exactly as well as a random one, since no two accounts share a `uid`.

```typescript
// Source: syncCrypto.ts pattern — HKDF-derived salt from auth.uid(), no server round-trip
import { argon2id } from 'hash-wasm';

async function deriveSaltFromAccountId(accountId: string): Promise<Uint8Array> {
  // SHA-256 the UUID string to get 32 bytes of salt material — deterministic,
  // reproducible on any device that knows the signed-in user's id, and
  // unique per account without touching the server.
  const encoded = new TextEncoder().encode(accountId);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(hash);
}

// KDF params are a FIXED APP CONSTANT, never per-account/server-stored —
// every device deriving the key for the same account must use identical
// params, so these can never be "tuned" without a coordinated migration.
export const ARGON2ID_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MiB — above OWASP's 19 MiB minimum, desktop/modern-mobile safe
  hashLength: 32,     // 256-bit key for AES-256-GCM
} as const;
```

### Pattern 3: Realtime private-channel notify (cloud analog of `syncLock.ts`'s `BroadcastChannel`)

**What:** After a successful `upload_sync_blob`, tell other open devices a new version exists.
**When to use:** Post-upload, client-triggered (not a DB trigger — simpler, avoids the `pg_net`-auth gap already tracked as an open item for the existing `notify_quote_decision` trigger).

```typescript
// Source: Supabase Realtime Broadcast + Authorization docs
// (supabase.com/docs/guides/realtime/broadcast, .../realtime/authorization)
const channel = supabase!.channel(`sync:${userId}`, {
  config: { private: true }, // requires realtime.messages RLS below
});

await channel.subscribe();

// After a successful upload:
await channel.send({
  type: 'broadcast',
  event: 'blob-updated',
  payload: { version: newVersion, updatedAt: new Date().toISOString() }, // D-08 minimal envelope, nothing else
});

// Other devices:
channel.on('broadcast', { event: 'blob-updated' }, ({ payload }) => {
  if (payload.version > lastAppliedVersion) void runCloudSyncCycle();
});
```

```sql
-- Realtime Authorization RLS — required for private channels
-- Source: supabase.com/docs/guides/realtime/authorization
create policy "own account channel only"
on realtime.messages for select
to authenticated
using (realtime.topic() = 'sync:' || auth.uid()::text);

create policy "own account channel only insert"
on realtime.messages for insert
to authenticated
with check (realtime.topic() = 'sync:' || auth.uid()::text);
```

### Anti-Patterns to Avoid
- **Storing the ciphertext as `bytea`:** PostgREST/PostgreSQL serializes `bytea` columns as hex-prefixed text (`\x4845...`) in JSON responses by default, not base64 — a real, well-documented gotcha [CITED: PostgREST issue #2310, postgresql.org bytea docs]. Since the payload is already a JSON string being encrypted, store it as a `text` column holding a base64 string produced client-side (`Uint8Array` → base64) and avoid the hex round-trip entirely.
- **Treating Postgres Changes as the notify mechanism:** would require an RLS SELECT policy exposing the full row (including ciphertext) to the Realtime subscription path, working against the D-08 minimal-envelope goal even though the actual *table* RLS still blocks direct REST reads. Broadcast keeps the notify payload hand-built and minimal by construction.
- **A single shared Web Lock name being treated as sufficient cross-device protection:** it is not — see Pattern 1. Reusing `SYNC_LOCK_NAME` protects same-device races between file-sync and cloud-sync; it does nothing for the true cross-device race, which needs the server-side CAS.
- **Storing rolling pre-merge snapshots (D-11) in a new Dexie table:** avoid a schema migration for this. `setSetting`/`getSetting` already handles arbitrary JSON blobs (`BackupFile` objects) for the existing single-snapshot undo (`SYNC_PRE_MERGE_SNAPSHOT_KEY`) — extend to an array of `{ mergedAt, snapshot }` under one new settings key, capped to the last 3-5 entries by slicing on write. Zero new Dexie version bump for this whole phase is achievable (see Common Pitfalls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Passphrase-based key derivation | A custom PBKDF loop or a naive SHA-256(passphrase) "key" | Argon2id via `hash-wasm` (or PBKDF2 via native `SubtleCrypto.deriveKey` as the zero-dep fallback) | Memory-hard KDFs exist specifically because naive hashing is trivially GPU-crackable for human-chosen secrets — this is the exact mistake OWASP's cheat sheet exists to prevent |
| AES-GCM encryption primitive | Any pure-JS AES implementation | Native `crypto.subtle.encrypt('AES-GCM', ...)` | Already available with zero dependency in every target runtime (browser + Tauri WebView), constant-time and hardware-accelerated where the platform supports it — a hand-rolled cipher is a security liability with no upside |
| Passphrase strength scoring | A hand-rolled length/character-class checker | `@zxcvbn-ts/core` (pattern-aware, dictionary-based) | Simple composition rules (8 chars + 1 number + 1 symbol) are well-documented as weak signal; zxcvbn's crack-time estimation is the industry-standard approach popularized by Dropbox specifically because naive rules both reject strong passphrases and accept weak ones |
| Cross-device write conflict resolution | A custom last-write-wins-by-timestamp check on the blob row alone | Postgres compare-and-swap (`UPDATE ... WHERE version = $expected`) + re-fetch/re-merge/retry loop | A timestamp check has a race window between the check and the write; a single atomic `UPDATE ... WHERE` is what actually closes it — this is the standard optimistic-concurrency pattern, not a novel invention |
| 90-day retention scheduling | A client-side or ad-hoc script triggered on next login | Supabase Cron (`pg_cron` extension) — a native scheduled job inside the database | Must be independently auditable and must not depend on any client ever reconnecting (the exact lapsed-and-never-returns scenario the grace window exists to cover); `pg_net` is already a precedent extension in this project's migration |

**Key insight:** every genuinely hard problem in this phase — the merge itself, the encryption primitive, the strength scoring, the concurrency control — already has a correct, standard, small solution. The temptation to hand-roll anything here (a lighter cipher, a simpler KDF, a home-grown lock) is exactly where a zero-knowledge privacy claim would quietly become false.

## Common Pitfalls

### Pitfall 1: Cross-device lost-update race (see Architecture Pattern 1)
**What goes wrong:** Two devices read the same blob version, both merge locally, both write — the second write silently clobbers the first device's freshly-merged data.
**Why it happens:** The existing Web Locks mutex only reaches one device; there is no equivalent local primitive for two separate machines.
**How to avoid:** Server-side compare-and-swap (`version` column, `UPDATE ... WHERE version = $expected`) plus a client retry loop that re-fetches, re-merges, and re-uploads on rejection.
**Warning signs:** A plan that writes the blob with a plain `UPD ATE`/`upsert` and no expected-version parameter has this bug.

### Pitfall 2: `bytea` column hex-encoding surprise (see Anti-Patterns)
**What goes wrong:** Ciphertext round-trips through PostgREST as a hex string (`\x...`) instead of the base64 the client encoded, breaking decrypt on download unless every read/write site remembers to `encode()`/`decode()`.
**Why it happens:** PostgreSQL's default `bytea` output format is hex, and PostgREST serializes it as-is into JSON.
**How to avoid:** Use a `text` column holding client-produced base64 directly — no server-side encode/decode step needed at all.
**Warning signs:** A migration with `ciphertext bytea` instead of `ciphertext text`.

### Pitfall 3: KDF parameter drift across devices
**What goes wrong:** If Argon2id `iterations`/`memorySize` are ever tuned between an app release that set up sync and a later release, a device on the old version derives a different key than a device on the new version — sync silently fails to decrypt for whichever device is out of date.
**Why it happens:** The KDF params are effectively part of the account's cryptographic identity, not a tunable runtime setting.
**How to avoid:** Ship the params as a fixed, versioned constant (`ARGON2ID_PARAMS` with a comment: "changing this requires a coordinated re-key migration, never a silent bump"). If params ever must change, that is a distinct future migration task (re-encrypt with new params under both old and new key during a transition window), not a routine tweak.
**Warning signs:** KDF params read from a mutable config/settings value instead of a hardcoded exported constant.

### Pitfall 4: Conflating the D-09 "silent" gate with the D-10 "first-connect" gate
**What goes wrong:** The existing `needsConfirmation(plan)` (file sync, `useSyncFolder.ts`) returns `true` for *any* add/update/delete — that is deliberately the right behavior for file sync's every-cycle confirm gate, but D-09 for cloud sync wants routine merges to apply *silently* and gate only risky ones (mass deletion, long-offline divergence). Reusing the exact same predicate for both would either make cloud sync nag constantly (defeating the point of "real-time, silent") or accidentally loosen file sync's existing tested confirm behavior if someone "fixes" the shared function instead of writing a second one.
**Why it happens:** The two predicates look similar (both consume a `MergePlan`) but encode different UX contracts.
**How to avoid:** Two separate functions — `needsConfirmation` (file sync, unchanged) and a new `needsRiskyConfirmation(plan, lastSyncedAt, now)` (cloud sync, D-09) that only trips on a graduated risk threshold; D-10's first-connect gate is a *third*, simpler condition ("is this the very first cloud sync for this device?") that always confirms regardless of risk level.
**Warning signs:** A single shared predicate function being imported by both `useSyncFolder.ts` and `useCloudSync.ts`.

### Pitfall 5: Forgetting the passphrase is a second, independent secret from account sign-in
**What goes wrong:** Treating the Supabase magic-link/OTP session as sufficient to decrypt data — it isn't; being signed in only proves account ownership, not passphrase knowledge. A UI that assumes "signed in ⇒ can decrypt" will crash or silently fail on a fresh device that hasn't entered the passphrase yet.
**Why it happens:** The existing Phase 43/46 auth flow (magic link/OTP) has no passphrase step at all — cloud sync introduces the *first* secret in this app that isn't held server-side in any form.
**How to avoid:** Every cloud-sync surface must explicitly branch on "signed in AND have a locally-cached derived key" vs. "signed in but passphrase not yet entered on this device" (D-06's "typed once per new device, derived key cached locally thereafter").
**Warning signs:** Any code path that calls `cloudBlobIO.download()` without first confirming a derived key is available in memory/cache.

## Code Examples

### AES-256-GCM encrypt/decrypt of the sync-file bytes
```typescript
// Source: MDN SubtleCrypto.deriveKey/encrypt, standard WebCrypto pattern
// (developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
export async function encryptSyncFile(bytes: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // fresh IV every encryption — never reuse
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  // Prepend the IV — it is not secret, must travel with the ciphertext to decrypt.
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return combined;
}

export async function decryptSyncFile(combined: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(plaintext);
}
```

### Deriving an AES-GCM `CryptoKey` from Argon2id output
```typescript
// Source: hash-wasm README (github.com/Daninet/hash-wasm) + MDN importKey
import { argon2id } from 'hash-wasm';

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const rawKeyHex = await argon2id({
    password: passphrase,
    salt,
    parallelism: ARGON2ID_PARAMS.parallelism,
    iterations: ARGON2ID_PARAMS.iterations,
    memorySize: ARGON2ID_PARAMS.memorySize,
    hashLength: ARGON2ID_PARAMS.hashLength,
    outputType: 'binary',
  });
  return crypto.subtle.importKey('raw', rawKeyHex, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Realtime Postgres Changes for most sync/notify use cases | Realtime Broadcast (private channels + Authorization RLS) | Supabase's own guidance now steers new builds toward Broadcast for anything beyond a handful of concurrent subscribers, and for finer control over payload shape | Directly relevant here — Broadcast's hand-built minimal payload is a better fit for D-08 than Postgres Changes' full-row emission |
| bcrypt/scrypt as the default password-hashing recommendation | Argon2id as OWASP's primary recommendation | OWASP Password Storage Cheat Sheet's current revision | This phase should not default to an older KDF just because it's more familiar |

**Deprecated/outdated:** none directly relevant to this phase's stack — `@supabase/supabase-js` v2's Realtime client already supports the current Broadcast/Authorization APIs used above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Argon2id parameters of `m=64MiB, t=3, p=1` are an appropriate default for this app's threat model (a WASM-capable desktop/modern-mobile browser or Tauri WebView, protecting real customer PII) | Architecture Pattern 2 / Pitfall 3 | If too aggressive, setup could feel slow on low-end devices (a few hundred ms to ~1s is typical for these params — should be verified on a real low-end Android/older-laptop target during planning); if too weak, offline brute-force of a leaked blob is more feasible. This is Claude's Discretion per CONTEXT.md — flagging as assumed rather than externally mandated. |
| A2 | Deriving the KDF salt deterministically from `auth.uid()` (rather than a stored random salt) is an acceptable resolution of the D-06/D-08 tension | Architecture Pattern 2 | If the planner or a future security review disagrees, the alternative (store a random salt as one additional non-secret envelope column) is a small, well-understood fallback — not a security regression either way, since salts are not secret. |
| A3 | Risky-merge thresholds are not externally specified anywhere in this project's docs — the specific numbers (e.g., "more than N records deleted" or "more than N days since last successful sync") in any plan built from this research are reasoned starting points, not researched-and-verified figures | Not directly stated as a concrete number in this document — flagged as a planning-time decision | If set too low, D-09's "silent for routine merges" promise breaks (too many gates); if too high, a genuinely risky merge (e.g., a factory-reset device re-syncing) could auto-apply destructively. Explicitly called out in CONTEXT.md as Claude's Discretion — the planner should propose concrete numbers and the resulting plan should be treated as needing a light validation pass, not as verified research. |

## Open Questions

1. **Exact risky-merge thresholds (D-09) and rolling-snapshot window (D-11)**
   - What we know: CONTEXT.md explicitly defers both to "Claude's Discretion" / "planner tunes"; no external standard exists for "how many deleted records is risky" in a sole-trader inventory app.
   - What's unclear: The concrete numbers.
   - Recommendation: Plan-time decision, informed by realistic data volumes for this app's user base (typically dozens to low-hundreds of jobs/materials/customers, not thousands) — e.g., "more than 10 records deleted in one merge" or "more than 30 days since last successful cloud sync" as a starting point for risky-gate thresholds, and "last 3 merges" for the rolling snapshot window (bounded, matches the existing single-snapshot pattern's storage shape scaled up modestly).

2. **Whether the 90-day retention cron should key off `entitlements.updated_at` or a dedicated `lapsed_at` column**
   - What we know: `entitlements.updated_at` already stamps on every Paddle webhook write, including the write that flips status away from `active`/`past_due` — so it is *usually* an accurate proxy for "when Pro lapsed."
   - What's unclear: Whether any future entitlements-table write (not status-related) could unintentionally reset that timestamp and extend the retention window past what the privacy policy promises.
   - Recommendation: Reuse `entitlements.updated_at` for the initial implementation (avoids a new column and migration), but the retention SQL comment should explicitly document this assumption so a future entitlements-table change doesn't silently break the 90-day promise without anyone noticing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (`fqidldxuwpfvhsejalbd`, eu-central-1) | All cloud sync tables/RPCs/Realtime | ✓ | Live since Phase 43 | — |
| `@supabase/supabase-js` | Table access, Realtime Broadcast | ✓ | 2.110.5 (already installed) | — |
| WebCrypto `crypto.subtle` | AES-GCM encrypt/decrypt | ✓ | Native — universal in target browsers + Tauri WebView | — |
| `pg_cron` extension | 90-day retention scheduled job | Needs enabling via migration (`create extension if not exists pg_cron;`) | Built into Supabase-managed Postgres, same pattern as the existing `pg_net` extension already enabled in `0001_pro_backend.sql` | Cleanup-on-access as a defensive backstop if the extension enable step is deferred |
| `hash-wasm`, `@zxcvbn-ts/*` | Argon2id KDF, passphrase strength | Not yet installed | See Standard Stack | PBKDF2 native fallback for KDF if the WASM dependency is rejected at plan time |

**Missing dependencies with no fallback:** none — every dependency here has either a native/already-installed path or a documented fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + jsdom (component/unit), Playwright 1.61.1 (E2E) |
| Config file | `vitest.config.ts` (root), `playwright.config.ts` |
| Quick run command | `npx vitest run src/utils/syncCrypto.test.ts` (or the specific new test file) |
| Full suite command | `npm test` (vitest run, all `src/**/*.test.ts(x)` + `tests/**/*.test.ts` + `api/**/*.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-02 (encrypt/decrypt round-trip) | `encryptSyncFile`/`decryptSyncFile` produce identical plaintext after round-trip; wrong key fails to decrypt | unit | `npx vitest run src/utils/syncCrypto.test.ts` | ❌ Wave 0 |
| SYNC-02 (KDF determinism) | Same passphrase + same `auth.uid()`-derived salt → same key across two independent derivations | unit | `npx vitest run src/utils/syncCrypto.test.ts` | ❌ Wave 0 |
| SYNC-02 (CAS conflict retry) | A version-mismatch upload triggers re-fetch/re-merge/retry, not data loss | unit (mocked Supabase RPC) | `npx vitest run src/utils/cloudBlobIO.test.ts` | ❌ Wave 0 |
| SYNC-02 (RLS enforcement) | Anon cannot read/write `sync_blobs`; owner can only read/write their own row | security regression (live/test project, mirrors `tests/security/hosted-quote-enumerability.test.ts`) | `npx vitest run tests/security/sync-blobs-enumerability.test.ts` | ❌ Wave 0 |
| SYNC-02 (lapse pauses sync, retains blob ~90d) | `useEntitlement.isPro === false` blocks upload/download; retention SQL deletes rows past window | unit + SQL-level test | `npx vitest run src/hooks/useCloudSync.test.tsx` | ❌ Wave 0 |
| SYNC-02 (free-floor no-network) | Signed-out / non-Pro path never calls Supabase | E2E regression, extends the existing `e2e/free-floor-no-network.spec.ts` | `npx playwright test e2e/free-floor-no-network.spec.ts` | ✓ exists, needs extension not a new file |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <changed-file>.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + `npx playwright test` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/syncCrypto.test.ts` — covers encrypt/decrypt round-trip, KDF determinism, wrong-passphrase failure
- [ ] `src/utils/cloudBlobIO.test.ts` — covers CAS retry loop, mocked Supabase RPC responses
- [ ] `tests/security/sync-blobs-enumerability.test.ts` — mirrors the existing `hosted-quote-enumerability.test.ts` pattern for the new table
- [ ] `src/hooks/useCloudSync.test.tsx` — mirrors `useSyncFolder.test.tsx`'s shape for the new hook
- [ ] Framework install: none — Vitest/Playwright already configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (unchanged) | Existing Supabase magic-link/OTP session (Phase 43/46) — cloud sync setup requires an already-signed-in Pro session, no new auth surface |
| V3 Session Management | yes (unchanged) | Existing `supabase-js` localStorage session + strict CSP compensating control (T-43-09/T-46-04) |
| V4 Access Control | yes | RLS owner-only policies on `sync_blobs` (mirrors `hosted_quotes`/`entitlements`); zero anon grants; Realtime `realtime.messages` RLS scoped to `auth.uid()` for the private channel |
| V5 Input Validation | yes | `validateSyncFile` (unchanged, Phase 44) rejects malformed/oversized/forbidden-key payloads BEFORE any Dexie write, applied identically to the decrypted cloud payload |
| V6 Cryptography (the core of this phase) | yes | AES-256-GCM (native WebCrypto) for confidentiality/integrity of the payload; Argon2id (OWASP-primary KDF) for passphrase-to-key derivation — never a hand-rolled cipher or naive hash (see Don't Hand-Roll) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Attacker exfiltrates the `sync_blobs` row via a Supabase misconfiguration or leaked service-role key | Information Disclosure | Zero-knowledge design means the exfiltrated data is ciphertext only — the mitigation is architectural (D-05), not just access control; RLS/anon-revoke is the second, independent layer (same pattern as `hosted_quotes`) |
| Offline brute-force of a stolen ciphertext blob against the user's passphrase | Information Disclosure | Argon2id memory-hard KDF (Pitfall/Pattern above) — makes each guess expensive even with GPU/ASIC parallelism |
| Two devices racing a concurrent write, one silently discarding the other's changes | Tampering (data-integrity sense) | Server-side CAS on `version` (Pattern 1) |
| A device replaying an old, stale ciphertext blob to roll back another device's changes | Tampering | The `version` CAS column prevents this too — a write with a version number lower than or equal to the current row's version is rejected by the same `WHERE version = $expected` clause (an attacker/bug attempting to write against a stale expected-version fails the same way a legitimate lost race does) |
| Realtime broadcast message forged by a non-owner to trigger a spurious pull-and-merge on the victim's device | Spoofing | Private channel + Realtime Authorization RLS scoped to `auth.uid()` (Pattern 3) — only the account owner's own authenticated devices can publish/subscribe to `sync:<their-uid>` |
| Retention cron fails silently, blob never deleted past the promised 90-day window | Denial of (privacy) Service — a policy-honesty failure, not a classic DoS | `pg_cron` job with a documented, auditable schedule (not client-triggered cleanup-on-access as the sole mechanism) — matches how the privacy policy states retention as an unconditional promise |

## Sources

### Primary (HIGH confidence)
- OWASP Password Storage Cheat Sheet — Argon2id primary recommendation, PBKDF2-SHA256 600,000-iteration FIPS fallback (cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- Supabase Realtime docs — Broadcast vs Postgres Changes scaling guidance, Realtime Authorization/private channels (supabase.com/docs/guides/realtime/broadcast, .../postgres-changes, .../authorization)
- Supabase Storage access-control docs — RLS-on-`storage.objects` vs table-row tradeoff (supabase.com/docs/guides/storage/security/access-control)
- Supabase Cron / `pg_cron` docs — scheduled retention job pattern (supabase.com/docs/guides/database/extensions/pg_cron, supabase.com/blog/supabase-cron)
- npm registry — `hash-wasm@4.12.0`, `@zxcvbn-ts/core@4.1.2` version/repo/postinstall verification via `npm view`
- MDN `SubtleCrypto.deriveKey`/`encrypt` — WebCrypto AES-GCM/PBKDF2 API shape (developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
- Direct codebase reads: `src/utils/syncMerge.ts`, `src/hooks/useSyncFolder.ts`, `src/utils/syncFileIO.ts`, `src/utils/syncLock.ts`, `src/utils/backupSchema.ts`, `src/hooks/useEntitlement.ts`, `src/lib/supabaseClient.ts`, `supabase/migrations/0001_pro_backend.sql`, `docs/DATA-FLOW-INVENTORY.md`, `docs/PRO-SECURITY-REVIEW.md`, `vercel.json`

### Secondary (MEDIUM confidence)
- `hash-wasm` GitHub README performance comparison vs `argon2-browser` (github.com/Daninet/hash-wasm) — WebSearch-sourced, cross-checked against the package's own registry metadata
- PostgREST GitHub issue #2310 — `bytea`-as-hex-in-JSON gotcha (github.com/PostgREST/postgrest/issues/2310)

### Tertiary (LOW confidence)
- None — every claim above traces to an official doc, the npm registry, or direct codebase inspection. Where a specific number is not externally mandated (risky-merge thresholds, exact Argon2id memory/time cost above the OWASP floor), it is logged in the Assumptions table rather than presented as researched fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version-verified against the npm registry this session; crypto primitive choices anchored to the current OWASP cheat sheet
- Architecture: HIGH — built directly on the already-shipped, already-tested Phase 44 merge engine; the one genuinely new mechanism (cross-device CAS) is a standard, well-documented optimistic-concurrency pattern
- Pitfalls: HIGH — each pitfall traces to either an official doc's documented gotcha (bytea/PostgREST) or a structural gap identified by direct comparison against the existing Phase 44 code (Web Locks' single-device reach)

**Research date:** 2026-07-23
**Valid until:** 2026-08-22 (30 days — stable domain: WebCrypto/Postgres/Supabase Realtime APIs and OWASP KDF guidance change slowly; re-verify npm package versions if planning is delayed past this window)
