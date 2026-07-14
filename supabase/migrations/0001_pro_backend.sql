-- Migration: 0001_pro_backend
-- Phase 43 (Pro Backend) — hosted_quotes + entitlements schema, RLS, the two
-- SECURITY DEFINER RPCs that are anon's ONLY data path, and the decision
-- webhook trigger.
--
-- Design invariants locked by 43-CONTEXT.md / 43-RESEARCH.md (do not weaken
-- these without updating both docs):
--   D-08  Customer PII stored is name-only (customer_first_name) — never
--         email/address/full customerSnapshot.
--   D-11  Lapse-safe reads: get_hosted_quote() must NEVER join entitlements.
--         A published link's visibility depends only on its own row, never
--         the owner's current subscription state.
--   D-13  Hosted pages are frozen once published (no in-place snapshot
--         replace — revision path is unpublish -> regenerate -> republish).
--   D-14  Quote validity honored via expires_at.
--   D-15  Decision is final — approve_quote_decision() enforces
--         `decision is null` in the UPDATE ... WHERE clause so a
--         replayed/forged second write is rejected at the DB level.
--   D-16  Unpublished / expired / never-existed tokens all resolve to zero
--         rows from get_hosted_quote() — the caller renders the SAME
--         branded 404 for all three cases (non-enumerability).
--
-- Threat register (43-01-PLAN.md <threat_model>):
--   T-43-01 (critical, Information Disclosure) — anon SELECT revoked
--           entirely on hosted_quotes; NO permissive anon policy of any
--           kind is created anywhere in this file (Pitfall 1).
--   T-43-04 (high, Tampering) — approve_quote_decision `decision is null`
--           guard.
--   T-43-07 (medium, Elevation of Privilege) — get_hosted_quote has no
--           entitlements join.

-- 1. Extensions ---------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- 2. Tables ---------------------------------------------------------------

create table public.hosted_quotes (
  token uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  customer_first_name text,
  status text not null default 'published' check (status in ('published', 'unpublished')),
  decision text check (decision in ('approved', 'declined')),
  decision_note text,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.hosted_quotes is
  'Phase 43 PRO-02/PRO-03: hosted, token-gated read-only quote snapshots. '
  'Anon may reach this data ONLY via public.get_hosted_quote()/'
  'public.approve_quote_decision(); owners read/write directly via the '
  'owner-scoped RLS policies below. Frozen once published (D-13).';
comment on column public.hosted_quotes.snapshot is
  'By-value copy of Quote.lineItemsSnapshot at publish time (D-13 frozen — never live-recomputed).';
comment on column public.hosted_quotes.customer_first_name is
  'D-08: name-only PII. NEVER store customer email/address/full customerSnapshot here.';
comment on column public.hosted_quotes.expires_at is
  'D-14: quote validity. Hosted page flips to "expired" and disables Approve once past this.';

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text,
  status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.entitlements is
  'Phase 43 PRO-04: Pro subscription state. Written ONLY by the Paddle '
  'webhook (service role) in plan 43-06 — no client INSERT/UPDATE/DELETE '
  'policy exists on this table. get_hosted_quote() must never join this '
  'table (D-11 lapse-safe).';

-- 3. Row Level Security -----------------------------------------------------

alter table public.hosted_quotes enable row level security;
alter table public.entitlements enable row level security;

-- 4. Revoke ALL anon table access (T-43-01 / Pitfall 1) ----------------------
-- Anon gets zero direct table access. Do NOT add any permissive anon policy
-- of any kind, including `using (true)` — see Pitfall 1 in 43-RESEARCH.md.
revoke select, insert, update, delete on public.hosted_quotes from anon;
revoke select on public.entitlements from anon;

-- 5. Owner-only policies for the `authenticated` role ------------------------

create policy hosted_quotes_owner_select on public.hosted_quotes
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy hosted_quotes_owner_insert on public.hosted_quotes
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy hosted_quotes_owner_update on public.hosted_quotes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy hosted_quotes_owner_delete on public.hosted_quotes
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy entitlements_owner_select on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));
-- No authenticated INSERT/UPDATE/DELETE policy on entitlements by design —
-- writes are service-role only (Paddle webhook, plan 43-06).

-- 6. get_hosted_quote(): the ONLY anon READ path (D-11, D-16) ----------------
-- D-11 LAPSE-SAFE INVARIANT: the function body below must never reference
-- the entitlements table. A published row's visibility depends only on its
-- own status/expires_at, never on the owner's current subscription state.

create or replace function public.get_hosted_quote(p_token uuid)
returns table (
  snapshot jsonb,
  customer_first_name text,
  status text,
  decision text,
  decided_at timestamptz,
  decision_note text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select h.snapshot, h.customer_first_name, h.status, h.decision,
           h.decided_at, h.decision_note, h.expires_at
    from public.hosted_quotes h
    where h.token = p_token
      and h.status = 'published';
  -- Zero rows for unpublished/expired/unknown tokens — the caller (the
  -- Vercel Function serving /q/[token]) renders the D-16 branded 404,
  -- indistinguishable across all three cases. See the D-11 note above this
  -- function for why no other table is ever joined in here.
end;
$$;

-- 7. approve_quote_decision(): the ONLY anon WRITE path (D-15) ---------------

create or replace function public.approve_quote_decision(p_token uuid, p_decision text, p_note text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
begin
  if p_decision not in ('approved', 'declined') then
    raise exception 'approve_quote_decision: invalid decision %', p_decision
      using errcode = '22023';
  end if;

  update public.hosted_quotes
    set decision = p_decision,
        decision_note = p_note,
        decided_at = now()
    where token = p_token
      and status = 'published'
      and decision is null; -- D-15: reject a second/replayed/forged decision write at the DB level.

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

-- 8. Grant anon EXECUTE on the two RPCs — the ONLY anon-reachable data paths -

revoke all on function public.get_hosted_quote(uuid) from public;
grant execute on function public.get_hosted_quote(uuid) to anon;

revoke all on function public.approve_quote_decision(uuid, text, text) from public;
grant execute on function public.approve_quote_decision(uuid, text, text) to anon;

-- 9. Decision webhook: fires the approval-email edge function ----------------
-- The `on-quote-decision` edge function itself is deployed in plan 43-06.
-- Until then this POST harmlessly 404s against the Supabase Functions
-- gateway (email simply does not send) — see 43-01-PLAN.md Task 1 step 10.

create or replace function public.notify_quote_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := coalesce(current_setting('app.settings.functions_url', true), '') || '/on-quote-decision',
    body := jsonb_build_object('hosted_quote_token', new.token),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end;
$$;

create trigger hosted_quotes_decision_webhook
  after update of decision on public.hosted_quotes
  for each row
  when (old.decision is null and new.decision is not null)
  execute function public.notify_quote_decision();
