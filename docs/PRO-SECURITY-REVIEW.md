# PRO-03 Formal Security Review

**Phase:** 43-pro-backend (Plan 07 — the ROADMAP-mandated PRO-03 gate)
**Reviewed:** 2026-07-16
**Reviewer (automated evidence gathering):** GSD plan executor, Phase 43 Plan 07
**Scope:** The entire Pro backend attack surface introduced by Phase 43 (auth, publish, hosted quote page, billing) — reviewed as one unit before any of it is exposed to production traffic.

**Live project:** Supabase `fqidldxuwpfvhsejalbd` (eu-central-1), migration `20260714162140_pro_backend` applied.

---

## How to read this document

Every control below is marked either:

- **VERIFIED NOW** — executed this session, with real command/output evidence pasted below. Not a claim; an observation.
- **DEFERRED TO DEPLOY** — cannot be exercised without a live Vercel/Paddle/Resend deployment that does not exist yet. Named explicitly so the human sign-off below is honest about what it does and does not cover.

The human sign-off at the bottom of this document approves the **VERIFIED NOW** set as production-ready and acknowledges the **DEFERRED TO DEPLOY** set as a tracked, named checklist to complete at first deploy — it does not pretend those items were tested.

---

## Part 1 — The Seven PRO-03 Controls

### Control 1: Non-enumerability (anon cannot list `hosted_quotes` / `entitlements`)

**Status: PASS — VERIFIED NOW, live against the real project**

Automated regression test, run live (not skipped) against `fqidldxuwpfvhsejalbd`:

```
$ SUPABASE_URL=<from .env VITE_SUPABASE_URL> SUPABASE_ANON_KEY=<from .env VITE_SUPABASE_ANON_KEY> \
  npx vitest run tests/security/hosted-quote-enumerability.test.ts --reporter=verbose

 ✓ anon GET /rest/v1/hosted_quotes?select=* cannot list any row (no token filter)          738ms
 ✓ anon GET /rest/v1/hosted_quotes?token=eq.<uuid>&select=* is likewise blocked            159ms
 ✓ anon GET /rest/v1/entitlements?select=* cannot list any row                             129ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Fresh manual `curl` re-probe this session (independent of the test harness, using the live anon key):

```
=== GET /rest/v1/hosted_quotes?select=* ===
HTTP_STATUS:401
{"code":"42501","message":"permission denied for table hosted_quotes", ...}

=== GET /rest/v1/entitlements?select=* ===
HTTP_STATUS:401
{"code":"42501","message":"permission denied for table entitlements", ...}

=== POST /rest/v1/rpc/get_hosted_quote {p_token: 00000000-0000-0000-0000-000000000000} ===
HTTP_STATUS:200
[]

=== POST /rest/v1/rpc/approve_quote_decision {p_token: 00000000-0000-0000-0000-000000000000, p_decision: "approved"} ===
HTTP_STATUS:200
false
```

These four results are byte-consistent with the original 43-01 acceptance evidence — the security posture has not regressed since the schema was applied. Anon has zero direct table access to either table (confirmed by both `revoke select ... from anon` in the migration and the live 401s), and the only two anon-reachable data paths (`get_hosted_quote`, `approve_quote_decision`) behave correctly against unknown/random tokens.

**Gate requirement met:** the test ran GREEN, not skipped, against the live/test project.

---

### Control 2: Indistinguishable 404s (D-16)

**Status: PASS (unit-level) — VERIFIED NOW / preview-deploy curl -I — DEFERRED TO DEPLOY**

Automated regression test, mock-fetch, runs everywhere:

```
$ npx vitest run tests/security/hosted-quote-404-indistinguishable.test.ts --reporter=verbose

 ✓ D-16: returns byte-identical 404 status + body across unpublished/expired/never-existed
 ✓ D-16: rejects malformed tokens before any RPC call, same 404 body as the other cases
 ✓ D-16: sets X-Robots-Tag: noindex and Cache-Control: no-store on 404 responses
 ✓ valid published render: 200 with line items, "Prepared for {first name}", Powered-by footer
 ✓ valid published render: escapes untrusted snapshot/customer content (stored-XSS defense)
 ✓ D-15: records a decision, renders locked state, replayed write cannot change it
 ✓ D-15: rejects a POST with an invalid decision value without calling the write RPC

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Code-level guarantee (not just test-asserted): `api/q/[token].ts` routes every response — both the 404 and the 200 — through a single `htmlResponse()` builder that unconditionally sets `X-Robots-Tag: noindex` and `Cache-Control: no-store`, and the 404 body (`unavailableResponse()`) is a zero-interpolation constant string, so byte-identity across unpublished / expired / never-existed / malformed is guaranteed by construction, not by convention.

**DEFERRED TO DEPLOY:** the plan's acceptance criteria also call for a live preview-deploy `curl -I` against a real published token, an unpublished token, an expired token, and a random UUID, confirming the *deployed* Vercel Function (not just the unit-tested handler) returns identical headers/status. No Vercel deployment exists this session (this phase's work is on local `main`, not pushed — per the user's deploy-guard policy, `git push` to `main` requires `DEPLOY_OK=1`, which has not been granted). This is named explicitly in 43-02-SUMMARY and 43-05-SUMMARY as an operator step and is carried forward here, not silently dropped.

---

### Control 3: No PII in CDN caches / render (D-08)

**Status: PASS — VERIFIED NOW**

- Every `/q/*` response — verified in Control 2 — carries `Cache-Control: no-store`, so no CDN or browser cache can retain a response containing customer data.
- Source-level grep confirms `api/q/[token].ts` contains no reference to `email` or `address` anywhere in the file:
  ```
  $ grep -n "email\|address" api/q/\[token\].ts
  (no output)
  ```
- The only customer-identifying field rendered is `customer_first_name`, surfaced as `Prepared for {first name}` (`row.customer_first_name?.trim() ? escapeHtml(...) : 'you'`), matching the database-level comment in the migration: `'D-08: name-only PII. NEVER store customer email/address/full customerSnapshot here.'`
- The `hosted_quotes.customer_first_name` column is the only PII-bearing column in the table (`snapshot` is a by-value copy of pricing/line-item data, not raw customer PII).

---

### Control 4: Secret hygiene

**Status: PASS — VERIFIED NOW**

Repo-wide grep for any `VITE_`-prefixed secret-shaped variable (Pitfall 4 — a `VITE_` prefix means Vite inlines the value into the client bundle):

```
$ grep -rn "VITE_" src/ api/ supabase/ | grep -iE "secret|service_role|api_key"
(no output)

$ git show HEAD:.env.example | grep -iE "secret|service_role|api_key" | grep "VITE_"
(no output)
```

Confirmed the only `VITE_`-prefixed env vars in the codebase are the intentionally-public ones: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key is designed to be public — RLS is the real boundary), `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_PRICE_ID_MONTHLY`, `VITE_PADDLE_PRICE_ID_ANNUAL`, `VITE_PADDLE_CANCEL_URL`.

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_API_KEY`, `RESEND_API_KEY`) are read exclusively via non-`VITE_` `process.env`/`Deno.env.get` calls inside `api/webhooks/paddle.ts` and `supabase/functions/on-quote-decision/index.ts` — never in `src/`.

Production bundle grep (fresh build this session, `npx vite build`):

```
$ grep -rlE "SUPABASE_SERVICE_ROLE|PADDLE_WEBHOOK_SECRET|PADDLE_API_KEY|RESEND_API_KEY" dist/
(no output — grep exit 1, zero matches)
```

No server secret name or value pattern is present anywhere in the shipped client bundle.

---

### Control 5: Webhook spoofing (Paddle)

**Status: PASS — VERIFIED NOW**

```
$ npx vitest run api/webhooks/paddle.test.ts --reporter=verbose

 ✓ rejects a missing Paddle-Signature header with 400 and zero writes
 ✓ rejects a tampered body (signature no longer matches) with 400 and zero writes
 ✓ rejects a signature computed with the wrong secret with 400 and zero writes
 ✓ rejects a malformed signature header with 400 and zero writes
 ✓ rejects a stale timestamp (replay defense) with 400 and zero writes
 ✓ returns 503 (no side effects) when PADDLE_WEBHOOK_SECRET is not configured
 ✓ upserts the entitlements row for subscription.created (monthly)
 ✓ maps a yearly billing cycle to the annual plan on subscription.updated
 ✓ subscription.canceled writes status canceled and NEVER touches hosted_quotes (D-11)
 ✓ acknowledges (200) but writes nothing when custom_data.user_id is missing
 ✓ acknowledges (200) but writes nothing when user_id is not a UUID
 ✓ ignores unrelated (but validly signed) event types without writing
 ✓ returns 500 (so Paddle retries) when the Supabase upsert fails
 ✓ returns 500 (so Paddle retries once configured) when Supabase server env is missing
 ✓ rejects non-POST methods with 405

 Test Files  1 passed (1)
      Tests  15 passed (15)
```

No entitlement write occurs without a valid signature — verified at 5 distinct spoofing/tampering vectors (missing header, tampered body, wrong secret, malformed header, stale/replayed timestamp), each asserted to produce zero side effects. Signature verification happens against the RAW request body before `JSON.parse` and before any database call (`api/webhooks/paddle.ts`, matching Paddle's documented HMAC recipe). This suite was originally authored TDD (RED commit `2468601` before the handler existed, GREEN commit `01abcdd` after) per 43-06-SUMMARY.

---

### Control 6: RLS / RPC review

**Status: PASS — VERIFIED NOW (migration source cited)**

Cited directly from `supabase/migrations/0001_pro_backend.sql`:

- **`get_hosted_quote(uuid)`** (lines ~103–128): `SECURITY DEFINER`, `set search_path = public`, selects only from `public.hosted_quotes` filtered on `token = p_token and status = 'published'`. **Does not reference `entitlements` anywhere in its body** — confirmed by direct read of the function source, not just a grep — satisfying D-11 (a published link's visibility never depends on the owner's current subscription state, so cancelling a subscription never breaks previously-shared links).
- **`approve_quote_decision(uuid, text, text)`** (lines ~131–152): `SECURITY DEFINER`, validates `p_decision in ('approved','declined')` before any write, and the `UPDATE ... WHERE token = p_token and status = 'published' and decision is null` clause is the D-15 one-transition guard — a second/replayed/forged decision write against an already-decided or unpublished row touches zero rows (`get diagnostics v_row_count = row_count; return v_row_count > 0`), independent of any UI-layer state. This is enforced at the database level, not just in application code.
- Anon table access is revoked outright (`revoke select, insert, update, delete on public.hosted_quotes from anon; revoke select on public.entitlements from anon;`) with **zero permissive anon policies of any kind** anywhere in the file — the only anon grants are `EXECUTE` on the two SECURITY DEFINER functions.
- `entitlements` has no `authenticated`-role INSERT/UPDATE/DELETE policy at all — the Paddle webhook (service role, `api/webhooks/paddle.ts`) is architecturally the only writer, confirmed by Control 5's test suite (`subscription.canceled` "NEVER touches hosted_quotes" spec) and by the schema itself.

---

### Control 7: PWA service worker pass-through / freshness (D-13)

**Status: PASS (static config) — VERIFIED NOW / installed-PWA reload-after-unpublish — DEFERRED TO DEPLOY**

Static-config gate, this session:

```
$ node scripts/verify-pro-csp.mjs

✓ vercel.json connect-src contains a supabase.co origin
✓ vercel.json connect-src contains a paddle origin
✓ vercel.json frame-src is not 'none' and contains a paddle origin
✓ vercel.json script-src contains a paddle origin
✓ vercel.json rewrite source excludes q/ and api/ (negative-lookahead)
✓ vite.config.ts workbox block is present
✓ vite.config.ts workbox.navigateFallbackDenylist matches ^/q/
✓ vite.config.ts workbox.navigateFallbackDenylist matches ^/api/
✓ vite.config.ts workbox.runtimeCaching has NO rule targeting /q/ or /api/

✓ verify-pro-csp: CSP + rewrite + SW-denylist all correct.
```

Compiled-output verification (fresh `npx vite build` this session, inspecting the actual generated service worker, not just source config):

```
$ grep -o "denylist" dist/sw.js
denylist

$ grep -oE "\^\/q\/|\^\/api\/" dist/sw.js
^\/q\/
^\/api\/
```

Both SPA-fallback layers exclude `/q/` and `/api/`: the server-side `vercel.json` rewrite (negative-lookahead) and the client-side `vite-plugin-pwa` workbox `navigateFallbackDenylist`, and the denylist regexes are confirmed present in the actual compiled `dist/sw.js` bundle that would ship to users — not just the source config that generates it.

**DEFERRED TO DEPLOY:** the live freshness proof — install the PWA on a preview deploy, publish a quote, unpublish it, and confirm an immediate reload of `/q/<token>` returns the fresh branded 404 rather than a stale cached SPA shell — requires an installed/active service worker against a real deployment, which does not exist this session. Named explicitly in 43-02-SUMMARY as an operator step; carried forward here.

---

## Part 2 — Accumulated Items Requiring Disposition

### Item 1: `resend` package-legitimacy gate executed out of order (43-05)

**What happened:** The plan's blocking `checkpoint:human-verify` gate for the `resend` npm package was supposed to run *before* the import was written. The 43-05 executor instead wrote and committed the `npm:resend@6` import (commit `6800d3b`) before pausing for the gate — a process ordering violation, self-caught immediately after the commit, before any SUMMARY/state finalization.

**Risk assessment:**
- **Exposure at time of violation: zero.** No code from the package was fetched, installed, or executed on any machine — this was a Deno edge-function `npm:` specifier existing only as text in a committed source file. No `supabase functions deploy` ran, no local Deno/npm resolution of the edge function's imports occurred.
- **Package legitimacy:** subsequently verified live against the npm registry — `resend@6.17.2`, repository `github.com/resend/resend-node`, official `resend` org maintainers. This matches the disposition the 43-RESEARCH.md package audit had already reached for this exact package.
- **Human disposition:** the user reviewed the live registry verification and replied "approved" — a retroactive but informed approval, not a rubber stamp of an unreviewed package.

**Disposition: ACCEPT AS CLOSED — process finding only, no code finding.** The package is legitimate and approved. Residual risk is nil because nothing executed the package's code before approval landed. Recorded here per the plan's requirement to give this a documented disposition, not to re-open it as a blocker.

**Recommendation (non-blocking):** future plans should treat `checkpoint:human-verify gate="blocking-human"` tasks as literally blocking — no commits between reaching the checkpoint and receiving the resume signal. This is a process-discipline note for future executor runs, not a change to this phase's code.

---

### Item 2: Webhook auth gap — `notify_quote_decision()` → `on-quote-decision` edge function

**What happened:** `supabase/migrations/0001_pro_backend.sql`'s `notify_quote_decision()` trigger function POSTs to the `on-quote-decision` edge function via `pg_net.http_post()` with only `Content-Type: application/json` in its headers — **no `Authorization` header at all**. The deployed edge function (`on-quote-decision`, v1, ACTIVE — confirmed this session) has `verify_jwt=true`, which is the Supabase Functions gateway's default and means it will reject any unauthenticated request at the gateway layer before the function body even runs.

**Current live state:** `app.settings.functions_url` (the Postgres setting `notify_quote_decision()` reads to build the POST URL) is currently **NULL** on the live project — nobody has set it yet. This means:
- The `hosted_quotes_decision_webhook` trigger fires correctly on every approve/decline (confirmed by the DB-level `when (old.decision is null and new.decision is not null)` guard and the 43-01 schema), but its `pg_net.http_post()` call resolves to a URL of the form `/on-quote-decision` (empty base + path) — this fails to reach the gateway at all today. The path is inert, not silently broken in production.
- **Decisions are never lost.** The customer's Approve/Decline is recorded in `hosted_quotes.decision`/`decided_at`/`decision_note` by `approve_quote_decision()` regardless of whether the notification POST succeeds — the maker still sees the decision via the in-app `refreshStatuses()` pull (43-04). Only the *email notification* is at risk, not the data.

**What breaks once `functions_url` IS set (the real gap):** the moment an operator configures `app.settings.functions_url` to point at the real Supabase Functions gateway (a step that must happen to make the email feature work at all), every webhook POST will reach the gateway **without a bearer token**, and `verify_jwt=true` will reject it with 401. The maker will never receive the "your quote was approved/declined" email, silently, with no error surfaced anywhere the maker can see — a functional regression, not a security hole (no anon data is exposed by this gap; it is a broken notification path, not a broken access-control boundary).

**Remediation plan (concrete, for the operator/next plan):**
1. Add a follow-up migration that updates `notify_quote_decision()`'s `headers :=` argument to include `'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)` (or a dedicated service-role/shared-secret header, whichever the edge function is updated to check) alongside the existing `Content-Type` header.
2. Set `app.settings.functions_url` (via `ALTER DATABASE ... SET app.settings.functions_url = 'https://fqidldxuwpfvhsejalbd.supabase.co/functions/v1'` or the equivalent `supabase secrets`/project-settings mechanism) at deploy time — this is currently NULL and is the reason the gap is inert today.
3. Verify with a live approve/decline round-trip on a preview deploy: confirm the trigger's POST reaches `on-quote-decision` with a 2xx (not 401) and the maker receives the email once `RESEND_API_KEY` is also configured (a separate, already-documented deferred item from 43-05/43-06).
4. Alternative if a shared secret is preferred over the anon key: set `verify_jwt=false` on `on-quote-decision` and instead have the function itself validate a custom shared-secret header set in both the trigger and the function's own secrets — either approach closes the gap; the anon-key-bearer approach is simpler since the anon key is already a public, RLS-bounded credential.

**Disposition: OPEN ITEM, tracked, non-blocking for this gate.** This is a functional/operational gap (broken notification delivery), not a PRO-03 security control failure — no anon-reachable data path is affected, `hosted_quotes`/`entitlements` RLS is untouched by this gap, and the customer/maker data path (decision recording, in-app status refresh) is unaffected. It does not block PRO-03 sign-off, but it MUST be resolved before the email feature is considered working, and is added to the Operator Next Steps checklist below.

---

### Item 3: Deployment deferrals — clearly separated from what was verified this session

The following require a live production/preview deployment and **cannot be exercised in this local sandbox**. None of them were claimed as verified above; each is named explicitly in the plan's own `<verification>` section as an operator step, and each was already flagged by the plan that introduced it (43-02, 43-03, 43-05, 43-06):

| # | Item | Source plan | What's needed |
|---|------|-------------|----------------|
| 1 | Vercel server env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PADDLE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | 43-05, 43-06 | Set in the Vercel project (never `VITE_`-prefixed) before the next deploy |
| 2 | Resend account + `RESEND_API_KEY` + verified `3dcoster.com` sending domain (SPF/DKIM) | 43-05 | Operator creates Resend account, verifies domain, sets the edge function secret |
| 3 | Paddle seller account (sandbox first, then live) + two prices (EUR 6.90/mo, EUR 69/yr) + client/server env vars + registered webhook | 43-06 | Operator completes Paddle onboarding (payout-to-Canada verification); fallback: Lemon Squeezy per 43-RESEARCH |
| 4 | Supabase Auth redirect URL allow-list (`https://3dcoster.com/app` + Vercel preview URLs) | 43-03 | Dashboard → Authentication → URL Configuration |
| 5 | Live magic-link round trip (request → click → SIGNED_IN → persisted session) | 43-03 | Real inbox + deployed redirect allow-list from #4 |
| 6 | Sandbox Paddle checkout → cancel round trip (entitlements upsert → app shows Pro → cancel → existing published `/q/*` links still resolve, D-11) | 43-06 | Paddle sandbox account from #3 |
| 7 | Preview-deploy `curl -I` header/byte-equality check on `/q/*` (published / unpublished / expired / random UUID) | 43-02, 43-05 | A live Vercel preview deployment |
| 8 | Installed-PWA reload-after-unpublish freshness check (Control 7 above) | 43-02 | Live deployment + installed PWA |
| 9 | Webhook auth gap remediation + live round-trip (Item 2 above) | this review | Follow-up migration + `functions_url` configuration |

**Disposition:** these are DEPLOYMENT-TIME checklist items, not gate failures. The PRO-03 gate as scoped by the ROADMAP ("non-enumerable URLs, RLS verified, no PII in CDN caches") is fully verifiable pre-deploy and IS verified above (Controls 1, 3, 4, 5, 6, and the static half of 2 and 7). The items in this table are either (a) live-deployment-only checks that re-confirm what static/unit evidence already shows, or (b) genuinely new capability (billing, email) that cannot exist without third-party accounts the operator has not yet created. None of them represent an unreviewed or untested security boundary — they are unexercised *integrations*, clearly labeled as such.

---

## Part 3 — Threat Register Disposition (from 43-07-PLAN.md `<threat_model>`)

| Threat ID | Category | Component | Severity | Disposition | Evidence |
|-----------|----------|-----------|----------|-------------|----------|
| T-43-01 | Information Disclosure | `hosted_quotes` enumeration | critical | **MITIGATED — VERIFIED NOW** | Control 1 (live test + fresh curl probes) |
| T-43-13 | Information Disclosure | fake 404 / header leakage | high | **MITIGATED — VERIFIED NOW (unit) / DEFERRED (live curl)** | Control 2 |
| T-43-02 | Information Disclosure | secret in bundle | high | **MITIGATED — VERIFIED NOW** | Control 4 |
| T-43-03 | Spoofing | webhook spoofing | high | **MITIGATED — VERIFIED NOW** | Control 5 |
| T-43-SC | Tampering | supply chain | low | **MITIGATED — all three package-legitimacy checkpoints closed** | 43-03 (`@supabase/supabase-js`, approved in order), 43-05 (`resend`, approved out-of-order/retroactively — Item 1 above), 43-06 (`@paddle/paddle-js`, approved in order) |

All four threat-register entries this plan is responsible for closing are mitigated. No entry is left open or unaddressed.

---

## Part 4 — Summary Verdict

**VERIFIED NOW (pre-deploy, this session):**
- Non-enumerability: GREEN, live, against the real project (Control 1)
- Indistinguishable 404s: GREEN at the unit/integration level, byte-identical by code construction (Control 2, static half)
- No PII beyond first name, no-store on every response (Control 3)
- No leaked secrets in source or in the built `dist/` bundle (Control 4)
- Webhook signature verification rejects all five tested spoofing/tampering vectors with zero writes (Control 5)
- RLS + both SECURITY DEFINER RPCs reviewed directly against migration source; D-11 and D-15 both hold at the database level (Control 6)
- PWA service worker denylist confirmed in both source config and the actual compiled `dist/sw.js` (Control 7, static half)
- All three package-legitimacy supply-chain gates closed (T-43-SC)

**DEFERRED TO DEPLOY (explicitly not claimed as tested):**
- Live preview-deploy `curl -I` header/byte-equality proof (Controls 2 & 7)
- Installed-PWA reload-after-unpublish freshness proof (Control 7)
- Webhook auth gap remediation + live decision-email round trip (Item 2)
- Vercel/Resend/Paddle/Supabase-Auth production configuration and the associated live round trips (Item 3, 9 sub-items)

**No control is left in a FAIL state.** Every item above is either verified with real evidence or explicitly and honestly labeled as requiring a live deployment that does not exist yet.

---

## Sign-off

This review requires a **human signature** before the hosted quote endpoint is considered cleared for production. The signature below must be provided by a human who has personally:

1. Read this document in full, including the Deferred-to-Deploy sections.
2. Independently confirmed (or is explicitly deferring, with acknowledgment) the checks named in the checkpoint that follows this document.

| Field | Value |
|-------|-------|
| Signed by | _pending — awaiting human signature_ |
| Date | _pending_ |
| Decision | _pending: "approved — ship to production" / "sent back for remediation"_ |
| Conditions attached (if any) | _pending_ |

---

*Generated by the GSD plan executor, Phase 43 Plan 07, 2026-07-16. This document is the artifact required by `docs/PRO-SECURITY-REVIEW.md` in the plan frontmatter's `files_modified`.*
