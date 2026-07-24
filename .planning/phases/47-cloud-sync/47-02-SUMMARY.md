---
phase: 47-cloud-sync
plan: 02
subsystem: database
tags: [supabase, postgres, rls, pg_cron, realtime, edge-function, e2e-encryption]

# Dependency graph
requires:
  - phase: 43-pro-backend
    provides: "Live Supabase eu-central-1 project (fqidldxuwpfvhsejalbd), entitlements table + isProStatus vocabulary, 0001_pro_backend.sql RLS/SECURITY DEFINER/anon-revoke idiom"
  - phase: 47-cloud-sync
    provides: "47-01 GDPR privacy-policy disclosure of cloud sync as a Supabase processor extension"
provides:
  - "Live public.sync_blobs table: one ciphertext row per account, owner-only RLS, D-08 minimal envelope"
  - "Atomic CAS RPCs: download_sync_blob, upload_sync_blob (version compare-and-swap), reset_sync_blob"
  - "Private realtime.messages RLS authorizing sync:<uid> channel per account"
  - "pg_cron cloud_sync_retention job (daily 03:00 UTC, 90-day lapsed-account deletion)"
  - "delete-account edge function (D-14 level-2 cascade deletion)"
  - "Anon-enumerability regression test proven PASSING against the live project"
  - "Repo migration chain (0002 + 0003) reproducing the live schema byte-for-byte, including two live-applied anon-revoke follow-ups"
affects: [47-03, 47-04, 47-05, 47-06, 47-07, 47-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CAS upload RPC (update ... where version = p_expected_version, GET DIAGNOSTICS row_count) instead of blind upsert, closing the cross-device lost-update race"
    - "Realtime Authorization RLS on realtime.messages scoped to realtime.topic() = 'sync:' || auth.uid()::text for private per-account Broadcast channels"
    - "pg_cron server-side retention job keyed off entitlements.updated_at as the lapse-timestamp proxy (documented assumption, not a new lapsed_at column)"
    - "Follow-up anon-revoke migration pattern: Supabase's default-privileges trigger grants anon EXECUTE/table-ACL directly per-role at CREATE time — `revoke ... from public` alone does not remove it; a targeted `revoke ... from anon` (function EXECUTE) and `revoke all on table ... from anon` (table ACL) are both required for true zero-anon-access"

key-files:
  created:
    - supabase/migrations/0002_cloud_sync.sql
    - supabase/migrations/0003_cloud_sync_anon_revoke.sql
    - supabase/functions/delete-account/index.ts
    - tests/security/sync-blobs-enumerability.test.ts
  modified: []

key-decisions:
  - "Task 3 applied live via Supabase MCP apply_migration (Phase 43-01/46 precedent, no CLI credentials) with explicit founder approval, not the dashboard SQL editor"
  - "First apply failed on 'relation \"realtime.messages\" does not exist' because Realtime had never been used against this project (Phase 43 never touched it); resolved with a one-shot anon Realtime client channel-subscribe probe that bootstrapped the tenant's own migrations (creating realtime.messages + partitions), after which 0002 applied cleanly"
  - "Live verification found anon still held EXECUTE on all 3 sync RPCs and TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on sync_blobs, via Supabase's per-role default-privileges grants surviving 0002's PUBLIC-scoped revokes; closed live with two follow-up migrations (cloud_sync_anon_revoke, cloud_sync_anon_revoke_table_all), reconciled into the repo as 0003_cloud_sync_anon_revoke.sql so the migration chain matches the live database exactly"

patterns-established:
  - "Realtime tenant bootstrap: a fresh Supabase project with Realtime enabled in config but never actually used has no realtime.messages/realtime.* tables until the first client channel subscription runs — any migration referencing realtime.messages on a Realtime-virgin project needs a bootstrap probe first"
  - "Supabase anon-revoke migrations must explicitly target the anon role (not just PUBLIC) for both function EXECUTE and table ACLs, since default privileges grant anon directly at object-creation time"

requirements-completed: [D-01, D-05, D-08, D-13, D-14, SYNC-02]

coverage:
  - id: D1
    description: "public.sync_blobs holds one ciphertext row per account with a monotonic CAS version and D-08 minimal envelope columns only"
    requirement: "D-01"
    verification:
      - kind: manual_procedural
        ref: "Supabase MCP list_tables confirmed live: user_id uuid PK, ciphertext text, version bigint, blob_size int, updated_at/created_at timestamptz, RLS enabled"
        status: pass
    human_judgment: false
  - id: D2
    description: "Anon has zero access to sync_blobs (both table ACL and RPC EXECUTE); authenticated owners read/write only their own row via RLS; upload_sync_blob performs an atomic CAS"
    requirement: "D-05, D-08"
    verification:
      - kind: e2e
        ref: "tests/security/sync-blobs-enumerability.test.ts — run live with SUPABASE_URL/SUPABASE_ANON_KEY set, 3/3 assertions PASSED (not skipped)"
        status: pass
      - kind: manual_procedural
        ref: "Supabase MCP confirmed RPC ACLs postgres/authenticated/service_role only (post 0003); sync_blobs table ACL has zero anon entries"
        status: pass
    human_judgment: false
  - id: D3
    description: "pg_cron deletes lapsed accounts' blobs ~90 days after Pro lapse; a delete-account edge function removes blob+auth+entitlement via FK cascade"
    requirement: "D-13, D-14"
    verification:
      - kind: manual_procedural
        ref: "Supabase MCP confirmed cron job cloud_sync_retention scheduled '0 3 * * *' active=true; delete-account edge function deployed version 1, ACTIVE, verify_jwt=true"
        status: pass
    human_judgment: false
  - id: D4
    description: "Realtime private channel sync:<uid> is authorized only for the owning account"
    requirement: "SYNC-02"
    verification:
      - kind: manual_procedural
        ref: "Supabase MCP confirmed 2 realtime.messages policies (\"own account channel only select\"/\"own account channel only insert\", authenticated, scoped to realtime.topic() = 'sync:' || auth.uid()::text)"
        status: pass
    human_judgment: false

duration: continuation (Task 3 checkpoint resolution)
completed: 2026-07-24
status: complete
---

# Phase 47 Plan 02: Cloud Sync Supabase Backend Summary

**Live `sync_blobs` table, CAS upload RPC, private Realtime channel auth, 90-day retention cron, and delete-account cascade — applied to production eu-central-1 with anon-enumerability proven closed by a live-passing regression test.**

## Performance

- **Duration:** continuation session (prior executor: Tasks 1-2; this session: Task 3 resolution)
- **Tasks:** 3/3 complete
- **Files modified:** 4 (0002_cloud_sync.sql, 0003_cloud_sync_anon_revoke.sql, delete-account/index.ts, sync-blobs-enumerability.test.ts)

## Accomplishments

- `public.sync_blobs` migration (0002) with owner-only RLS, atomic CAS `upload_sync_blob`, `download_sync_blob`, `reset_sync_blob`, private `realtime.messages` Authorization RLS for `sync:<uid>`, and a `pg_cron` `cloud_sync_retention` daily job
- `delete-account` edge function (service-role, verifies caller JWT, calls `auth.admin.deleteUser`, relies on FK cascade for D-14 level-2 deletion)
- `tests/security/sync-blobs-enumerability.test.ts` mirroring the Phase 43 hosted-quote pattern
- [BLOCKING] Task 3 checkpoint resolved: migration + edge function applied/deployed live to `fqidldxuwpfvhsejalbd`, with two anon-access residues discovered during verification and closed live, then reconciled back into the repo as a new migration (0003)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0002_cloud_sync.sql — sync_blobs table, RLS, CAS RPC, Realtime RLS, pg_cron retention** - `7e43497` (feat)
2. **Task 2: delete-account edge function + anon-enumerability security test** - `f100d53` (feat)
3. **Task 3: [BLOCKING] Apply the migration + deploy the edge function to the live project — repo-side reconciliation** - `518f258` (fix)

**Plan metadata:** committed separately below

_Note: Task 3 was executed as an out-of-band live-apply action (Supabase MCP, orchestrator + founder approval) followed by an in-repo reconciliation commit — there was no automated test/build step to gate it, per the plan's own framing ("Executor cannot self-apply to production")._

## Files Created/Modified

- `supabase/migrations/0002_cloud_sync.sql` - sync_blobs table, RLS, CAS RPC, Realtime RLS, pg_cron retention (Task 1, unchanged from original apply)
- `supabase/migrations/0003_cloud_sync_anon_revoke.sql` - NEW, reconciles the repo with two live-applied anon-revoke follow-up migrations (Task 3)
- `supabase/functions/delete-account/index.ts` - service-role edge function, D-14 level-2 deletion (Task 2)
- `tests/security/sync-blobs-enumerability.test.ts` - anon-enumerability regression test, now proven PASSING live (Task 2 authored it; Task 3 proved it passes against production)

## Decisions Made

- Task 3 applied live via Supabase MCP `apply_migration` (Phase 43-01/46 precedent — no CLI credentials configured), with explicit founder approval, following the established pattern rather than the dashboard SQL editor.
- Realtime tenant bootstrap: the first `apply_migration` attempt failed with `relation "realtime.messages" does not exist` because this project's Realtime service had never been used (Phase 43 never touched it) — its tenant-scoped tables (`realtime.messages` + partitions) only materialize on first genuine use. Resolved with a one-shot anon Realtime client connection (a channel-subscribe probe), which triggered Realtime's own internal migrations and created the missing tables. The cloud-sync migration then applied cleanly as `cloud_sync`.
- Anon-revoke residue discovered during live verification and closed with two follow-up migrations, now reconciled into the repo as `0003_cloud_sync_anon_revoke.sql` (see Deviations below for full detail).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Realtime tenant tables absent, blocking first apply**
- **Found during:** Task 3 (live apply)
- **Issue:** `apply_migration` failed with `relation "realtime.messages" does not exist` — the eu-central-1 project's Realtime service had `[realtime] enabled = true` in config but had never actually been used by any prior phase, so its per-tenant `realtime.messages` table (and partitions) had never been created.
- **Fix:** A one-shot anon Realtime client connection (channel-subscribe probe) was made against the live project, which triggers Realtime's own internal bootstrap migrations and creates `realtime.messages` + partitions. The `0002_cloud_sync.sql` migration was then re-applied and succeeded cleanly, recorded live as `cloud_sync`.
- **Files modified:** None (live-only bootstrap action; no repo file needed since the tenant bootstrap is a Realtime-internal, non-idempotent-relevant step that happens automatically on any real client's first connection in production use)
- **Verification:** `apply_migration` succeeded on retry; `realtime.messages` policies confirmed present via Supabase MCP.
- **Committed in:** N/A (live infrastructure action, not a repo change — the resulting schema state IS captured by 0002's already-committed content)

**2. [Rule 2 - Missing Critical] Anon retained EXECUTE on all 3 sync RPCs (T-47-03 gap)**
- **Found during:** Task 3 (live verification)
- **Issue:** Despite `revoke all on function ... from public` in 0002, live inspection showed `anon` still held EXECUTE on `download_sync_blob`, `upload_sync_blob`, and `reset_sync_blob`. Root cause: Supabase's default-privileges rule (`alter default privileges in schema public grant execute on functions to anon, authenticated, service_role`) grants `anon` EXECUTE directly, per-role, at function-creation time — a `revoke ... from public` only removes the PUBLIC pseudo-role's grant, not a privilege already held directly by `anon`. Not practically exploitable (auth.uid() is NULL for anon, so all three RPCs no-op/error), but it violates the T-47-03 zero-anon-access invariant literally, not just practically.
- **Fix:** Applied live as follow-up migration `cloud_sync_anon_revoke`: `revoke execute on function public.download_sync_blob() from anon;` (+ the same for `upload_sync_blob(text, bigint)` and `reset_sync_blob()`). Reconciled into the repo as part of `0003_cloud_sync_anon_revoke.sql`.
- **Files modified:** `supabase/migrations/0003_cloud_sync_anon_revoke.sql`
- **Verification:** Supabase MCP confirmed post-fix RPC ACLs are postgres/authenticated/service_role only.
- **Committed in:** `518f258`

**3. [Rule 2 - Missing Critical] Anon retained table-level ACL residue on sync_blobs**
- **Found during:** Task 3 (live verification, same investigation as #2)
- **Issue:** Live table ACL inspection showed `anon=Dxtm` on `sync_blobs` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) via the same default-privileges mechanism — 0002 had only revoked select/insert/update/delete from anon, leaving these four privileges granted.
- **Fix:** Applied live as follow-up migration `cloud_sync_anon_revoke_table_all`: `revoke all on table public.sync_blobs from anon;`. Reconciled into the repo as part of `0003_cloud_sync_anon_revoke.sql`.
- **Files modified:** `supabase/migrations/0003_cloud_sync_anon_revoke.sql`
- **Verification:** Supabase MCP confirmed `sync_blobs` now has zero anon ACL entries of any kind.
- **Committed in:** `518f258`

---

**Total deviations:** 3 auto-fixed (1 blocking infra bootstrap, 2 missing-critical security closures)
**Impact on plan:** All three were necessary to reach a truthfully-live, T-47-03-compliant state. No scope creep — the plan's own Task 3 acceptance criteria (anon zero access) demanded the two anon-revoke fixes; the Realtime bootstrap was a pure infrastructure prerequisite with no design implication. The repo migration chain (0002 + 0003) now reproduces the live database exactly.

## Issues Encountered

None beyond the two deviations documented above — both were investigated, root-caused (Supabase's default-privileges mechanism), fixed live, and reconciled into the repo migration history in the same session.

## User Setup Required

None further — Task 3's `user_setup` (apply migration + deploy edge function to the live eu-central-1 project) was completed by the orchestrator with founder approval during this checkpoint resolution. See Decisions Made above for the exact live-apply path used (Supabase MCP `apply_migration`, no dashboard SQL editor).

## Next Phase Readiness

- Live backend is fully verified: `sync_blobs` table, all 3 RPCs, Realtime private-channel auth, retention cron, and delete-account edge function all confirmed present and correctly scoped via Supabase MCP.
- `tests/security/sync-blobs-enumerability.test.ts` passes (not skips) against the real project — anon-enumerability regression coverage is now live-proven, not just locally-asserted.
- Ready for 47-03+ (client-side sync integration: cloudBlobIO retry loop against `upload_sync_blob`'s CAS, Realtime Broadcast notify against `sync:<uid>`).
- No blockers carried forward from this plan.

---
*Phase: 47-cloud-sync*
*Completed: 2026-07-24*
