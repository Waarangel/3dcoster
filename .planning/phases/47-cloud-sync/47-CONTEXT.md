# Phase 47: Cloud sync - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Pro users get **cloud/real-time multi-device sync on Supabase** — the ceiling above Phase 44's file-based sync, which stays the free floor completely untouched (architecture-as-feature: your data is never hostage to our server). The GDPR sequencing is part of the phase goal itself: `docs/DATA-FLOW-INVENTORY.md` updates FIRST, `/privacy` policy text SECOND, before any new user data goes server-side. Founder estimate: 1–2 weeks.

**Resolved from REQUIREMENTS SYNC-02:** the "Dexie Cloud or Supabase custom sync" question is settled — **Supabase custom sync** (the roadmap goal names Supabase; the existing eu-central-1 project from Phase 43 is the backend). CRDTs remain explicitly declined (wrong model for single-user multi-device); LWW is the law.

**Pro parity rule applies:** cloud sync works on BOTH web and desktop (desktop OTP auth shipped in Phase 46; never gate Pro behind `!__IS_TAURI__`).

**First-time PII escalation:** this is the first phase where the full database — including customer names, emails, physical addresses — leaves the device. Phase 43 capped server-side PII at "first name only." The zero-knowledge encryption decision (D-05) exists specifically to keep that promise's spirit: Supabase stores ciphertext it cannot read.

</domain>

<decisions>
## Implementation Decisions

### Sync engine shape
- **D-01: Snapshot blob per account.** The cloud unit of sync is one encrypted sync-file blob per account in Supabase (Storage object or table row — planner picks) — exactly the Phase 44 sync file, with the cloud replacing the Dropbox folder. Devices fetch, merge locally with the existing `computeMerge`/`applyMerge` LWW engine, push back. No per-record server schema, no per-store mirrored tables, no server-side merge.
- **D-02: Live push while open.** Supabase Realtime channel per account: when device A uploads a new snapshot, other open devices are notified and fetch + merge within seconds. Plus sync on launch and debounced push after writes. This is what makes the "real-time" pill honest.
- **D-03: Short upload debounce (~3–5s).** Batch rapid edits, then push. Deliberately faster than the 15s file-sync debounce — a separate constant, not shared.
- **D-04: File sync and cloud sync coexist.** Both can be active simultaneously — independent channels sharing one merge engine (`updatedAt` stamps + tombstones are common infrastructure). The Dropbox file doubles as a user-owned backup while cloud sync handles live multi-device.

### Privacy & encryption
- **D-05: Zero-knowledge E2E encryption.** The client encrypts the snapshot (WebCrypto AES-GCM) before upload; Supabase stores ciphertext only. We literally cannot read customer PII. This is the marquee privacy stance and a marketable differentiator.
- **D-06: User-chosen sync passphrase.** Set once at cloud-sync setup, typed once per new device (derived key cached locally thereafter). Strong KDF (Argon2/PBKDF2-high-iterations — researcher validates the WebCrypto-compatible choice) + a minimum-strength check.
- **D-07: Lost passphrase = self-serve cloud reset.** "Reset cloud sync" wipes the server blob; user sets a new passphrase and the current device re-uploads. Nothing local is ever lost — the cloud is a relay, not the source of truth. Setup copy states plainly: "We can't recover your passphrase. Resetting re-uploads from this device."
- **D-08: Minimal plaintext envelope.** Server-visible metadata is only: account id, monotonic version counter, updated-at timestamp, blob size. Device names, schema version, record counts all live inside the ciphertext. Inventory entry reads: "we see that you sync and when — never what."

### Conflict & merge UX
- **D-09: Silent LWW for routine merges; gate risky ones.** Incoming cloud changes auto-apply silently (live-query UI re-renders naturally). A confirm gate appears only for risky merges — mass deletions above a threshold, or long-offline reconnect with large divergence (planner tunes thresholds).
- **D-10: First connect is confirm-gated.** The initial merge on a newly-connected device shows the existing `SyncMergeSummary` (per-store counts + expandable detail), confirm-gated, with a pre-merge snapshot. Fresh empty installs get a trivial "pulling your data" variant. After this one gate, sync goes silent per D-09. No keep/replace/merge picker.
- **D-11: Rolling pre-merge snapshots.** Silent local snapshot before each applied cloud merge, retained on a small rolling window (last few merges / ~24h — planner tunes). "Restore pre-merge state" affordance stays in Settings → Data. Reuses the Phase 44 `buildBackupFile` snapshot pattern.
- **D-12: Settings-only visibility.** "Last synced Xs ago" + a quiet note when LWW resolved conflicts ("2 records took the newer edit") inside Settings → Data. No toasts on incoming merges, no header chrome — Phase 44 D-03's no-nag rule holds.

### Account & lapse lifecycle
- **D-13: Lapse pauses sync; blob retained ~90 days, then deleted.** On `isProStatus` false, uploads/downloads stop; the ciphertext blob is kept as a grace window (instant resume on re-subscribe; lifeline if a lapsed user's only device dies), auto-deleted after the window. Retention stated in the privacy policy. Local data is never touched.
- **D-14: Self-serve deletion, two levels.** In-app: (1) "Turn off cloud sync & delete cloud copy" — wipes the blob, keeps the account; (2) "Delete account" — removes blob + auth + entitlement records (subject to billing-record legal retention), with any live hosted quotes surfaced in the confirmation flow. No email-request dependency.
- **D-15: Pro-chipped subsection in the Data tab.** Cloud sync joins the Backup, Restore & Sync home in Settings → Data — visible to everyone, Pro chip for free users, click opens the `ProPitchModal` extended with the cloud-sync story (one monetization voice — mirrors 46 D-13/D-14 exactly). No separate Sync tab.
- **D-16: Marketing flips in-phase.** The /features "cloud/real-time sync" Coming pill flips to a shipped Pro pill, /pricing's Pro card gains cloud sync (including the zero-knowledge line — "end-to-end encrypted, we can't read your data"), and the Pro-badged /roadmap entry comes off. Per-phase flip pattern from 46 D-15.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The Phase 44 sync engine (reused wholesale)
- `src/utils/syncMerge.ts` — `validateSyncFile`/`computeMerge` LWW merge core + tombstone edit-wins; the cloud path calls this unchanged
- `src/db/syncStamp.ts` — `updatedAt` write choke-point on every CRUD path (incl. delete-cascade tombstones); cloud debounce hooks the same choke-point
- `src/utils/syncFileIO.ts` — platform-branched atomic file I/O; the cloud transport is a sibling of this, not a replacement
- `src/utils/syncLock.ts` — Web Locks mutex + BroadcastChannel peer notify; multi-tab safety must hold for cloud merges too
- `src/hooks/useSyncFolder.ts` — file-sync orchestration (15s debounce, launch-time check); the cloud hook mirrors this shape with its own 3–5s debounce (D-03)
- `src/components/SyncSetup.tsx` + `src/components/SyncMergeSummary.tsx` — the Settings → Data sync surface D-15 extends and the confirm-gated summary D-10 reuses
- `src/utils/backupSchema.ts` — envelope types + store list; the encrypted payload is this same sync-file shape

### Pro backend & entitlement (Phase 43/46 foundation)
- `src/hooks/useEntitlement.ts` — `isProStatus` locked vocabulary (active + past_due); D-13 lapse gating runs through this; cached entitlement wins offline (46 D-07)
- `src/components/pro/ProPitchModal.tsx` — the one pitch modal to extend with the cloud-sync story (D-15)
- `src/components/pro/SignInModal.tsx` — magic-link + desktop OTP sign-in; cloud-sync setup requires a signed-in Pro session
- `supabase/` — migrations, functions, config for the eu-central-1 project (`fqidldxuwpfvhsejalbd`); new envelope table/bucket + RLS + retention live here

### GDPR & security carry-forwards
- `docs/DATA-FLOW-INVENTORY.md` — MUST be updated FIRST with the sync-blob flow (ciphertext + minimal envelope per D-08) before any code ships data; then `/privacy` (Phase 42 C-05 defense — sequencing locked by the phase goal)
- `docs/PRO-SECURITY-REVIEW.md` — the standing security posture; the sync endpoint/bucket + RLS + zero-knowledge claims need review against it (and the launch-day checklist in Part 5 gains any new deploy-time items)
- `.planning/phases/42-gdpr-onboarding/42-CONTEXT.md` — consent architecture; sync network calls are functional, not analytics, but the inventory must say so

### Prior-phase decision sources (carry-forward constraints)
- `.planning/phases/44-sync-stl-instant-quote/44-CONTEXT.md` — D-03 (Data tab is the one sync home, no header chrome), D-05/D-06 (updatedAt LWW basis + tombstones), D-07/D-08 (merge summary + pre-merge snapshot patterns this phase selectively reuses)
- `.planning/phases/43-pro-backend/43-CONTEXT.md` — D-08 (first-name-only server PII — the ceiling D-05 zero-knowledge preserves in spirit), D-09/D-10 (contextual sign-in + Pro-chip pitch pattern), D-11 (lapse-safe philosophy)
- `.planning/phases/46-white-label-quotes/46-CONTEXT.md` — D-05/D-06/D-07 (automatic-when-Pro, lapse-reverts-keeps-data, cached-entitlement-offline), D-13/D-14 (Pro-chip + one-pitch-modal), D-15 (per-phase marketing flips)

### Marketing flip targets (D-16)
- `src/pages/FeaturesPage.tsx` — the cloud/real-time sync "Coming" pill + `PHASE-51-LAUNCH-PREP` flip-marker convention
- `src/pages/PricingPage.tsx` + `src/pricing.ts` — Pro card gains cloud sync; do NOT touch price constants (USD 7.99/mo · 79/yr locked)
- `src/data/roadmap.ts` — Pro-badged cloud-sync entry to remove, keeping the /features Coming-strip comment-lockstep from 45-13

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — SYNC-02 text (this phase resolves it: Supabase custom sync, CRDTs stay declined)
- `.planning/ROADMAP.md` §Phase 47 — goal text incl. the inventory-first/policy-second mandate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The entire Phase 44 sync engine (`syncMerge`, `syncStamp`, `syncLock`, `SyncMergeSummary`, pre-merge snapshot via `buildBackupFile`) — cloud sync is a new transport + encryption layer on an already-proven merge core
- Supabase client + auth + entitlements from Phases 43/46 — sign-in (web magic link, desktop OTP), `isProStatus`, RLS conventions, edge functions, webhooks all exist
- `ProPitchModal` / Pro-chip pattern — the upsell surface is a straight reuse
- WebCrypto (`crypto.subtle`) — AES-GCM + key derivation with zero new dependencies
- `useToast`, `ConfirmModal`, `Button`/`Card` UI kit — setup flow, reset flow, deletion confirms
- `src/features.ts` NEW-badge registry — cloud sync subsection is user-facing → badge

### Established Patterns
- Validate-everything-then-write-once + single Dexie transaction (`applyMerge`) — cloud merges inherit this unchanged
- No-nag conventions + Data-tab-as-sync-home (44 D-03) — D-12/D-15 continue them
- Automatic-when-Pro, lapse-reverts-keeps-local-data (46 D-05/D-06) — D-13 is the same philosophy with a server-side retention twist
- Inventory-first GDPR rule (42/43/46) — locked in the phase goal itself
- Free-floor no-network signed-out path (`e2e/free-floor-no-network.spec.ts`) — cloud sync code must not add network calls to the signed-out path
- Per-phase marketing flips with shipped-only honesty (46 D-15)

### Integration Points
- `syncStamp` write choke-point → second debounced writer (cloud, 3–5s) alongside the file writer (15s)
- Settings → Data tab (`SyncSetup` area) → new Pro-chipped cloud sync subsection (D-15)
- Supabase project: new storage object/table + RLS + Realtime channel + retention cleanup + account-deletion path
- `App.tsx` launch sequence → cloud launch-merge check alongside the existing file-sync check
- `useEntitlement` → sync enable/pause gating (D-13)
- Marketing pages (FeaturesPage/PricingPage/roadmap.ts) → D-16 flips

</code_context>

<specifics>
## Specific Ideas

- "We can't read your data" is a marketable truth — the zero-knowledge stance should appear in the /pricing Pro copy (D-16), not just the privacy policy
- The cloud is a relay, not the source of truth — this framing makes the lost-passphrase story (D-07) and the lapse story (D-13) *safe by construction*: local data always survives
- The 90-day retention window exists for a specific human scenario: a lapsed user whose only device dies — that's exactly when grace matters
- Real-time is the honest differentiator vs file sync: "edit on desktop, watch it appear on the laptop" (D-02)

</specifics>

<deferred>
## Deferred Ideas

- **Server-backed "connected devices" management view** — declined with the minimal envelope (D-08); device names stay inside the ciphertext. Revisit only if account-management demand appears.
- **Recovery code in addition to passphrase** — declined (D-06 single secret); revisit if lost-passphrase resets show up frequently in support.
- **Toast/header indicators for sync activity** — declined (D-12); revisit only if users report confusion about data "changing by itself."
- **Per-record change-log / mirrored-table sync** — declined (D-01 snapshot blob); would only matter for future server-side features (querying data server-side, multi-user), which zero-knowledge deliberately forecloses anyway.

### Reviewed Todos (not folded)
- **Paddle PricePreview localized pricing** (`.planning/todos/pending/paddle-price-preview-localized-pricing.md`) — keyword match (0.6) but explicitly `resolves_phase: 51` and blocked on Paddle SKU creation; Phase 46 reviewed it with the same conclusion. Stays in Phase 51.

</deferred>

---

*Phase: 47-cloud-sync*
*Context gathered: 2026-07-23*
