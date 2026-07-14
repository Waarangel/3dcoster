---
phase: 43-pro-backend
plan: 01
subsystem: database
tags: [supabase, postgres, rls, security-definer, postgrest, migration]

# Dependency graph
requires:
  - phase: 42-gdpr-onboarding
    provides: "GDPR hard gate (consent banner live in production) that must precede any backend call shipping user data off-device"
provides:
  - "Live Supabase project (eu-central-1) with public.hosted_quotes and public.entitlements tables"
  - "Non-enumerable read path via public.get_hosted_quote(uuid) SECURITY DEFINER RPC (anon has zero direct table access)"
  - "One-transition-only write path via public.approve_quote_decision(uuid, text, text) SECURITY DEFINER RPC (D-15)"
  - "Decision webhook trigger scaffold (hosted_quotes_decision_webhook) ready for the 43-06 edge function"
  - "Tracked migration supabase/migrations/0001_pro_backend.sql reproducible via supabase db push"
affects: [43-03-auth, 43-04-publish, 43-05-hosted-page, 43-06-billing-email, 43-07-verification]

# Tech tracking
tech-stack:
  added: ["supabase (CLI + hosted Postgres, eu-central-1)", "pgcrypto", "pg_net"]
  patterns:
    - "Anon-zero-table-access + SECURITY DEFINER RPC as the only anon data path (T-43-01 mitigation)"
    - "DB-level one-transition guard (`decision is null` in UPDATE ... WHERE) instead of UI-only enforcement (D-15)"
    - "Lapse-safe read RPC that never joins entitlements (D-11)"

key-files:
  created:
    - supabase/migrations/0001_pro_backend.sql
  modified:
    - supabase/config.toml

key-decisions:
  - "Live Supabase project created and migration applied via mcp__supabase__apply_migration (Supabase MCP), not `supabase db push` — CLI access token/DB password were never configured or needed. User approved project creation (How to Project org, $10/mo) via the MCP cost-confirmation flow."
  - "supabase/config.toml project_id updated to the real project ref (fqidldxuwpfvhsejalbd) so a future `supabase link` has the correct default; no secrets added to this file."

requirements-completed: [PRO-01, PRO-03, PRO-04]

coverage:
  - id: D1
    description: "hosted_quotes and entitlements tables live in eu-central-1 with RLS enabled and anon table access fully revoked"
    requirement: "PRO-01"
    verification:
      - kind: manual_procedural
        ref: "Supabase MCP list_tables: public.hosted_quotes (rls_enabled: true, 0 rows), public.entitlements (rls_enabled: true, 0 rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Anon cannot list hosted_quotes or entitlements via raw PostgREST (non-enumerability at the data layer)"
    requirement: "PRO-03"
    verification:
      - kind: manual_procedural
        ref: "curl GET /rest/v1/hosted_quotes?select=* with live anon key -> HTTP 401, 42501 permission denied for table hosted_quotes"
        status: pass
      - kind: manual_procedural
        ref: "curl GET /rest/v1/entitlements?select=* with live anon key -> HTTP 401, 42501 permission denied"
        status: pass
    human_judgment: false
  - id: D3
    description: "get_hosted_quote(token) RPC returns zero rows for unknown/unpublished tokens (D-16 same-404) and is the only anon read path"
    requirement: "PRO-03"
    verification:
      - kind: manual_procedural
        ref: "curl POST /rest/v1/rpc/get_hosted_quote {p_token: 00000000-0000-0000-0000-000000000000} -> HTTP 200, []"
        status: pass
    human_judgment: false
  - id: D4
    description: "approve_quote_decision(token, decision, note) RPC rejects writes against nonexistent/already-decided rows (D-15 one-transition, enforced in the database)"
    requirement: "PRO-03"
    verification:
      - kind: manual_procedural
        ref: "curl POST /rest/v1/rpc/approve_quote_decision {random token, approved} -> HTTP 200, false (no row touched)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Migration is tracked in git and reproducible (supabase/migrations/0001_pro_backend.sql + supabase/config.toml)"
    requirement: "PRO-01"
    verification:
      - kind: other
        ref: "git show d8b583d -- supabase/migrations/0001_pro_backend.sql"
        status: pass
    human_judgment: false

patterns-established:
  - "Pro-backend Supabase schema changes ship as tracked migrations under supabase/migrations/, applied to the live eu-central-1 project either via `supabase db push` (CLI, requires SUPABASE_ACCESS_TOKEN/SUPABASE_DB_PASSWORD) or via the Supabase MCP apply_migration tool (no CLI credentials needed, used this session)."

duration: ~20min
completed: 2026-07-14
status: complete
---

# Phase 43 Plan 01: Pro Backend Schema Summary

**Live Supabase eu-central-1 schema (hosted_quotes + entitlements) with RLS fully revoked from anon and all data access gated through two SECURITY DEFINER RPCs, verified non-enumerable via four live anon-key probes**

## Performance

- **Duration:** ~20 min (migration authored ~12:08 ET, applied + verified same session)
- **Tasks:** 2
- **Files modified:** 2 (`supabase/migrations/0001_pro_backend.sql` created, `supabase/config.toml` created then updated)

## Accomplishments

- Authored `supabase/migrations/0001_pro_backend.sql`: `public.hosted_quotes` (token-gated, name-only PII per D-08, frozen-on-publish per D-13, `expires_at` per D-14) and `public.entitlements` (service-role-write-only), both RLS-enabled with anon SELECT/INSERT/UPDATE/DELETE fully revoked and zero permissive anon policies of any kind.
- Authored `public.get_hosted_quote(uuid)` — the only anon read path, SECURITY DEFINER, never joins `entitlements` (D-11 lapse-safe), returns zero rows for unpublished/expired/unknown tokens so the caller renders the same branded 404 in all three cases (D-16).
- Authored `public.approve_quote_decision(uuid, text, text)` — the only anon write path, SECURITY DEFINER, `WHERE ... AND decision is null` guard rejects any second/replayed/forged decision write at the database level (D-15), independent of UI state.
- Authored the `hosted_quotes_decision_webhook` trigger + `notify_quote_decision()` function that will POST to the `on-quote-decision` edge function (deployed in plan 43-06) via `pg_net`.
- Created the live Supabase project `3dcoster` (ref `fqidldxuwpfvhsejalbd`, org "How to Project", region eu-central-1/Frankfurt) and applied the migration to it.
- Verified the PRO-03 non-enumerability guarantee live against the real anon key with four probes (see Deviations section and coverage block above) — all passed.

## Task Commits

1. **Task 1: Author the Supabase CLI project and the 0001_pro_backend migration** - `d8b583d` (feat)
2. **Task 2: [BLOCKING] Apply the migration to the live eu-central-1 project** - applied via Supabase MCP `apply_migration` this session (no local file change to commit for the push itself); `supabase/config.toml` project_id update committed as part of this plan's closing commit (see Plan metadata below)

**Plan metadata:** committed alongside this SUMMARY (see final commit)

## Files Created/Modified

- `supabase/migrations/0001_pro_backend.sql` - hosted_quotes + entitlements schema, RLS revocation, both SECURITY DEFINER RPCs, decision webhook trigger
- `supabase/config.toml` - Supabase CLI project config; `project_id` updated from the `supabase init` default (`"3DCoster"`) to the real project ref `fqidldxuwpfvhsejalbd` so a future `supabase link` targets the correct project by default. No secrets stored.

## Live Project Reference (no secrets)

- **Project name:** `3dcoster`
- **Project ref:** `fqidldxuwpfvhsejalbd`
- **Org:** How to Project
- **Region:** eu-central-1 (Frankfurt) — matches the locked REQUIREMENTS.md decision
- **Created:** 2026-07-14T16:20:02Z
- **API URL:** https://fqidldxuwpfvhsejalbd.supabase.co
- **Applied migration (remote):** version `20260714162140`, name `pro_backend` (via `list_migrations`)
- **Live tables (via `list_tables`):** `public.hosted_quotes` (rls_enabled: true, 0 rows), `public.entitlements` (rls_enabled: true, 0 rows)

## Acceptance Evidence — Task 2 Manual Probe (PRO-03 core guarantee)

Run with the live anon key against the deployed project:

1. `GET /rest/v1/hosted_quotes?select=*` → **HTTP 401**, `42501 permission denied for table hosted_quotes` — never a row list.
2. `GET /rest/v1/entitlements?select=*` → **HTTP 401**, `42501 permission denied for table entitlements`.
3. `POST /rest/v1/rpc/get_hosted_quote` with `{"p_token": "00000000-0000-0000-0000-000000000000"}` → **HTTP 200**, `[]` (zero rows — D-16 same-404 contract holds).
4. `POST /rest/v1/rpc/approve_quote_decision` with a random unknown token → **HTTP 200**, `false` (no row touched — D-15 holds even against a token that was never published).

All four match the acceptance criteria exactly: no row enumeration is possible via raw REST, and both RPCs behave correctly against unknown input.

## Decisions Made

- **MCP apply path instead of `supabase db push`:** The project was created and the migration applied via `mcp__supabase__apply_migration` (Supabase MCP tool) rather than the CLI `supabase link && supabase db push` flow described in the plan. This was a user-approved substitution (see Deviations below) — no `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` were ever configured or required. The resulting live schema is byte-for-byte equivalent to `supabase/migrations/0001_pro_backend.sql` (MCP naming differs — remote migration is recorded as `20260714162140_pro_backend`, local file is `0001_pro_backend.sql` — contents match minus header comments).
- **`supabase/config.toml` project_id updated** to the real project ref so a future CLI-based `supabase link` / `supabase db push` (e.g. for migration `0002_...` in a later plan) targets the correct project without manual lookup.

## Deviations from Plan

### Auto-fixed / User-approved Substitutions

**1. [Rule 4 - Architectural, user-approved] Applied the migration via Supabase MCP instead of the CLI `supabase db push` flow**
- **Found during:** Task 2 (the plan's `<action>` specified `supabase link --project-ref` + `supabase db push`, both requiring `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`)
- **Issue:** The Supabase project did not exist yet (`user_setup` in the plan frontmatter called for the operator to manually create it in the dashboard first). This is exactly the kind of "architectural/infrastructure" decision Rule 4 requires user sign-off on, since it changes how the schema gets applied and by which credential path.
- **Resolution:** User explicitly approved creating the project via the Supabase MCP (org "How to Project", $10/mo, confirmed through the MCP's built-in cost-confirmation flow) and applying the migration via `mcp__supabase__apply_migration`, bypassing the CLI credential setup entirely.
- **Outcome:** Live schema verified byte-equivalent to the tracked migration file; all four PRO-03 acceptance probes pass. No CLI credentials were stored anywhere (none were needed).
- **Follow-up (optional, not attempted):** A future `supabase link --project-ref fqidldxuwpfvhsejalbd` would give CLI-side `supabase migration list` parity (currently only checkable via the MCP `list_migrations` tool, not the local CLI, since the project was never `supabase link`ed). Not required for Phase 43 to proceed — deferred, no action needed unless a future plan needs local `supabase db push`.
- **Committed in:** N/A (remote-only DB change; the local config.toml pointer update is committed alongside this SUMMARY)

---

**Total deviations:** 1 user-approved substitution (Rule 4, architectural — MCP apply path instead of CLI push)
**Impact on plan:** None on correctness — the live schema is equivalent to the tracked migration and all Task 2 acceptance criteria (including the PRO-03 anon-enumerability probe) passed against the real deployed project.

## Issues Encountered

None beyond the expected `checkpoint:human-action` gate (the Supabase project did not exist yet, per the plan's `user_setup` frontmatter) — resolved by user-approved MCP project creation instead of manual dashboard creation, as documented above.

## User Setup Required

None remaining for this plan. The Supabase project now exists and the schema is live. Downstream plans (43-03 auth, 43-04 publish, 43-06 billing/email) will need the anon key and other env vars — those land in `.env` per plan 43-03, not here, and no secret was written to any file in this plan.

## Next Phase Readiness

- `public.hosted_quotes` and `public.entitlements` are live in eu-central-1 with the full RLS/RPC security surface verified against the real anon key.
- Plan 43-03 (auth) can now wire Supabase Auth against this same project (`fqidldxuwpfvhsejalbd`).
- Plan 43-06 (billing/email) has its webhook trigger scaffold (`hosted_quotes_decision_webhook`) already live and waiting for the `on-quote-decision` edge function to be deployed — until then the trigger's `pg_net` POST harmlessly 404s.
- Optional follow-up (not blocking): `supabase link --project-ref fqidldxuwpfvhsejalbd` if a future plan needs local CLI `db push`/`migration list` parity.

---
*Phase: 43-pro-backend*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: `supabase/migrations/0001_pro_backend.sql`
- FOUND: `supabase/config.toml`
- FOUND: `.planning/phases/43-pro-backend/43-01-SUMMARY.md`
- FOUND: commit `d8b583d` (Task 1 — migration authored)
- FOUND: commit `9b6d959` (config.toml project_id update)
- FOUND: `project_id = "fqidldxuwpfvhsejalbd"` in `supabase/config.toml`
