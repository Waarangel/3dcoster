-- Migration: 0002_cloud_sync
-- Phase 47 (Cloud Sync) — zero-knowledge E2E encrypted cloud sync backend.
-- One `sync_blobs` ciphertext row per account, owner-only RLS, an atomic
-- version compare-and-swap (CAS) upload RPC, private-channel Realtime
-- Authorization for live push notify, and a pg_cron 90-day retention job
-- for lapsed accounts. Plus the D-14 level-2 account-deletion edge
-- function's supporting cascade (deploy is out-of-band, plan 47-02 Task 2).
--
-- Design invariants locked by 47-CONTEXT.md / 47-RESEARCH.md (do not
-- weaken these without updating both docs):
--   D-01  Snapshot blob per account — one ciphertext row, no per-record
--         server schema, no server-side merge. The server is a relay.
--   D-05  Zero-knowledge E2E encryption — the server sees ciphertext only.
--   D-08  Minimal plaintext envelope — server-visible metadata is ONLY
--         user_id, ciphertext, version, blob_size, updated_at, created_at.
--         Device names, schema version, record counts all live inside the
--         ciphertext, never as separate columns.
--   D-13  Lapse pauses sync; blob retained ~90 days after lapse, then
--         deleted by a server-side, auditable pg_cron job (never
--         client-triggered cleanup-on-access as the sole mechanism).
--   D-14  Self-serve deletion, two levels — level 1 (this migration's
--         reset_sync_blob RPC) wipes just the blob; level 2 (the
--         delete-account edge function, plan 47-02 Task 2) removes
--         blob + auth + entitlement via the FK cascade declared below.
--
-- Threat register (47-02-PLAN.md <threat_model>):
--   T-47-03 (high, Information Disclosure) — anon has ZERO access to
--           sync_blobs; revoked entirely, no permissive anon policy of any
--           kind (mirrors T-43-01's Pitfall 1 discipline from 0001).
--   T-47-04 (high, Tampering/lost-update) — upload_sync_blob's CAS
--           (`where version = p_expected_version`) closes the cross-device
--           race that the local Web Lock cannot reach (RESEARCH Pitfall 1).
--   T-47-05 (medium, Spoofing) — realtime.messages RLS scopes the private
--           `sync:<uid>` channel to auth.uid() only.
--   T-47-06 (medium, Denial of privacy Service) — the retention job is a
--           native pg_cron schedule, independently auditable, not a
--           client-triggered best-effort.
--   T-47-07 (high, Elevation of Privilege) — handled in the edge function
--           (plan 47-02 Task 2), not this file; noted here because the FK
--           cascades this migration declares are what make that function's
--           single `auth.admin.deleteUser` call sufficient.

-- 1. Extensions ---------------------------------------------------------
-- Same managed-extension enable pattern as pg_net in 0001_pro_backend.sql.
create extension if not exists pg_cron;

-- 2. Table ----------------------------------------------------------------

create table public.sync_blobs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ciphertext text not null default '',
  version bigint not null default 0,
  blob_size integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.sync_blobs is
  'Phase 47 SYNC-02: one zero-knowledge encrypted sync-file blob per '
  'account (D-01). Anon has zero access; owners read/write only their own '
  'row via RLS or the SECURITY DEFINER RPCs below. The server never sees '
  'plaintext (D-05) and stores only the D-08 minimal envelope — device '
  'names, schema version, and record counts all live inside the '
  'ciphertext, never as separate columns here.';
comment on column public.sync_blobs.ciphertext is
  'Base64 TEXT (client-produced), NOT bytea — PostgREST serializes bytea '
  'as hex, not base64, breaking decrypt on the client (47-RESEARCH.md '
  'Pitfall 2). AES-256-GCM ciphertext with a prepended IV, produced by '
  'src/utils/syncCrypto.ts. The server never derives or holds the key.';
comment on column public.sync_blobs.version is
  'Monotonic compare-and-swap counter (T-47-04). Every accepted write via '
  'upload_sync_blob() increments this by exactly 1. This is the ONLY '
  'defense against the cross-device lost-update race — the local Web '
  'Lock (src/utils/syncLock.ts) does not reach a second physical device.';

-- 3. Row Level Security -----------------------------------------------------

alter table public.sync_blobs enable row level security;

-- 4. Revoke ALL anon table access (T-47-03, mirrors 0001's Pitfall 1) --------
-- Anon gets zero direct table access. Do NOT add any permissive anon
-- policy of any kind, including `using (true)`.
revoke select, insert, update, delete on public.sync_blobs from anon;

-- 5. Owner-only policies for the `authenticated` role ------------------------

create policy sync_blobs_owner_select on public.sync_blobs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy sync_blobs_owner_insert on public.sync_blobs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy sync_blobs_owner_update on public.sync_blobs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy sync_blobs_owner_delete on public.sync_blobs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 6. download_sync_blob(): caller's own row, or zero rows when none exists --
-- The client reads via this RPC so the read surface stays uniform with the
-- owner-only RLS boundary above (direct owner SELECT via RLS also works;
-- this RPC exists for a single, stable client call shape mirroring upload).

create or replace function public.download_sync_blob()
returns table (
  ciphertext text,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select s.ciphertext, s.version, s.updated_at
    from public.sync_blobs s
    where s.user_id = auth.uid();
  -- Zero rows when the caller has never uploaded a blob — the client
  -- treats this as "no cloud data yet," not an error.
end;
$$;

-- 7. upload_sync_blob(): the CAS core (T-47-04, RESEARCH Pattern 1) ---------
-- Never a blind upsert — that would reintroduce the cross-device
-- lost-update race. A write is accepted ONLY when the caller's expected
-- version matches the row currently stored (or, for a brand-new account,
-- when expected_version = 0 and no row exists yet).

create or replace function public.upload_sync_blob(
  p_ciphertext text,
  p_expected_version bigint default 0
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

  if v_row_count = 0 and p_expected_version = 0 then
    -- No existing row and the caller expected a fresh account (version 0)
    -- — first-ever upload for this user. Insert at version 1.
    insert into public.sync_blobs (user_id, ciphertext, version, blob_size)
    values (auth.uid(), p_ciphertext, 1, length(p_ciphertext))
    on conflict (user_id) do nothing
    returning version into v_new_version;

    get diagnostics v_row_count = row_count;
  end if;

  return query select v_new_version, v_row_count > 0;
end;
$$;

-- 8. reset_sync_blob(): D-07/D-14 level-1 self-serve delete ------------------

create or replace function public.reset_sync_blob()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
begin
  delete from public.sync_blobs where user_id = auth.uid();
  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

-- 9. Grants: authenticated only — cloud sync is a signed-in Pro path,      --
--    unlike 0001's anon-reachable hosted-quote RPCs.

revoke all on function public.download_sync_blob() from public;
grant execute on function public.download_sync_blob() to authenticated;

revoke all on function public.upload_sync_blob(text, bigint) from public;
grant execute on function public.upload_sync_blob(text, bigint) to authenticated;

revoke all on function public.reset_sync_blob() from public;
grant execute on function public.reset_sync_blob() to authenticated;

-- 10. Realtime Authorization: private `sync:<uid>` channel (T-47-05) -------
-- Source: supabase.com/docs/guides/realtime/authorization. Required for
-- Broadcast on a `{ config: { private: true } }` channel — without these
-- policies no authenticated client (including the legitimate owner) can
-- publish/subscribe to the topic.

create policy "own account channel only select" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'sync:' || auth.uid()::text);

create policy "own account channel only insert" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'sync:' || auth.uid()::text);

-- 11. pg_cron: 90-day retention for lapsed accounts (D-13, T-47-06) --------
-- Deletes a sync_blobs row once its owner's entitlement has been
-- non-Pro (not 'active'/'past_due' — see src/hooks/useEntitlement.ts's
-- isProStatus vocabulary) for at least ~90 days.
--
-- ASSUMPTION (47-RESEARCH.md Open Question 2, carried into this migration
-- deliberately rather than a new lapsed_at column): this keys off
-- entitlements.updated_at as the lapse-timestamp proxy. That column is
-- stamped on every Paddle webhook write, including the write that flips
-- status away from active/past_due, so it is usually an accurate proxy for
-- "when Pro lapsed." A future entitlements write unrelated to status
-- (e.g. a plan-field-only update) could in principle reset this timestamp
-- and extend the retention window — that would be a coordinated schema
-- change to catch, not a silent regression to worry about today; flagged
-- here so it is not missed if entitlements' write patterns ever change.
--
-- A user with NO entitlements row at all (never subscribed) is also
-- eligible once ~90 days have passed since their sync_blobs row was last
-- updated — covers the edge case of a Pro trial that never converted, or
-- an entitlements row deleted independently of sync_blobs.

select cron.schedule(
  'cloud_sync_retention',
  '0 3 * * *', -- daily at 03:00 UTC
  $$
  delete from public.sync_blobs s
  where not exists (
    select 1
    from public.entitlements e
    where e.user_id = s.user_id
      and e.status in ('active', 'past_due')
  )
  and (
    -- Lapsed Pro: entitlements row exists but is not in a Pro status, and
    -- has been that way for ~90 days.
    exists (
      select 1
      from public.entitlements e
      where e.user_id = s.user_id
        and e.updated_at < now() - interval '90 days'
    )
    -- Never-Pro / no entitlements row at all: fall back to the blob's own
    -- updated_at as the staleness proxy.
    or (
      not exists (select 1 from public.entitlements e where e.user_id = s.user_id)
      and s.updated_at < now() - interval '90 days'
    )
  );
  $$
);
