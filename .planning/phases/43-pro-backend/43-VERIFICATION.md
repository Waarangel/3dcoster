---
phase: 43-pro-backend
verified: 2026-07-16T22:49:47Z
status: passed
score: 33/33 must-haves verified
---

# Phase 43 — Pro Backend — Verification Report

**Phase goal:** Users with a Pro account can publish a quote as a live hosted link their customer can view and approve — and can subscribe to Pro billing — without any of this touching the free-floor calculator.

**Method:** Read all 7 PLAN.md frontmatter blocks + SUMMARY.md files, then independently re-verified every `must_haves.truths`/`artifacts`/`key_links` item against the actual codebase (not SUMMARY claims alone) — reading migration SQL, `supabaseClient.ts`, `api/webhooks/paddle.ts`, `api/q/[token].ts`, `usePublishedQuote.ts`, `ShareQuoteButton.tsx`, `vercel.json`, `vite.config.ts`, `BillingPanel.tsx`, `TermsPage.tsx`. Re-ran the executable gates live in this session (not trusting prior session output): full vitest suite, the two `tests/security/*` files, `api/webhooks/paddle.test.ts`, `npx tsc -b`, and `scripts/verify-pro-csp.mjs`. Ran the live-project enumerability test against the real `fqidldxuwpfvhsejalbd` Supabase project by sourcing `.env`'s `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` into `SUPABASE_URL`/`SUPABASE_ANON_KEY` — it is SKIPPED by design without those set, and this session confirmed it passes live rather than accepting the skip.

---

## Goal Achievement

| Success criterion (from ROADMAP goal) | Status | Evidence |
|---|---|---|
| Pro user can publish a quote as a live hosted link | VERIFIED | `usePublishedQuote.publish()` inserts into `hosted_quotes`, returns `https://3dcoster.com/q/<token>`; `api/q/[token].ts` renders it (200, line items, "Prepared for {first name}", Powered-by footer) |
| Customer can view/approve without an account | VERIFIED | `api/q/[token].ts` decision form POSTs to `approve_quote_decision` RPC (anon-executable), no auth required; DB-level `decision is null` guard makes it one-shot (D-15) |
| Maker can subscribe to Pro billing | VERIFIED | `src/lib/paddle.ts` + `BillingPanel.tsx` open Paddle checkout; `api/webhooks/paddle.ts` is the sole entitlement writer, gated on verified HMAC signature (15/15 tests green) |
| None of this touches the free-floor calculator | VERIFIED | `supabaseClient.ts` is `null` under `__IS_TAURI__` and when env vars are absent; `e2e/free-floor-no-network.spec.ts` asserts zero Supabase-origin requests during a full signed-out calculator+save flow; `App.tsx`/`UserProfileModal.tsx` compile out all Pro/auth UI under `__IS_TAURI__` |

All four goal criteria hold in code, not just in plan intent.

---

## Must-Haves Audit

| Item | Plan | Evidence | Status |
|---|---|---|---|
| Anon cannot list `hosted_quotes`/`entitlements` via raw PostgREST | 43-01 | `revoke select...from anon` in migration; live re-run this session: `tests/security/hosted-quote-enumerability.test.ts` 3/3 pass against real project (`fqidldxuwpfvhsejalbd`) | VERIFIED |
| Published quote readable ONLY via `get_hosted_quote(token)` RPC, only when `status='published'` | 43-01 | `supabase/migrations/0001_pro_backend.sql` lines ~103-128: `where h.token = p_token and h.status = 'published'`, no other predicate | VERIFIED |
| Approve/decline accepted at most once per token (D-15) | 43-01 | Migration `update ... where token = p_token and status='published' and decision is null`; `get diagnostics ... return v_row_count > 0` | VERIFIED |
| Read path never depends on owner's subscription state (D-11) | 43-01 | `get_hosted_quote` body has zero reference to `entitlements` table (read directly, confirmed) | VERIFIED |
| `supabase/migrations/0001_pro_backend.sql`, `supabase/config.toml` exist; tables/RPCs live | 43-01 | File read directly (208 lines); enumerability test executed live confirms tables/RPCs exist in eu-central-1 | VERIFIED |
| CSP permits only Supabase + Paddle new origins | 43-02 | `vercel.json` `connect-src` includes `https://*.supabase.co https://*.paddle.com` only as new additions; `scripts/verify-pro-csp.mjs` passes all 9 checks | VERIFIED |
| `/q/<token>` and `/api/<x>` reach the function router, not SPA fallback | 43-02 | `vercel.json` rewrite: `"source": "/((?!q/|api/).*)"` (negative lookahead excludes both) | VERIFIED |
| PWA SW does not intercept `/q/*`/`/api/*` | 43-02 | `vite.config.ts` `navigateFallbackDenylist: [/^\/q\//, /^\/api\//]`; `verify-pro-csp.mjs` confirms compiled `dist/sw.js` (per PRO-SECURITY-REVIEW Control 7) contains both denylist regexes | VERIFIED |
| Privacy Policy names Supabase/Paddle/Resend; ToS states price/cycle/no-trial/MoR | 43-02 | `TermsPage.tsx` line 83-85: "EUR 6.90 per month, or EUR 69 per year"; billed by Paddle (MoR) stated | VERIFIED |
| Magic-link sign-in, persisted session | 43-03 | `src/lib/supabaseClient.ts`: `flowType: 'pkce', detectSessionInUrl: true, persistSession: true`; `useProAuth.ts` present | VERIFIED |
| Free floor: zero Supabase requests when signed out | 43-03 | `e2e/free-floor-no-network.spec.ts` asserts `supabaseRequests` empty after full calculator+save flow, with a hard `page.route` abort as a second guard | VERIFIED (test present, asserts correctly; Playwright e2e not re-executed live this session — see Human Verification) |
| No Supabase/Pro UI on Tauri desktop build (D-12) | 43-03 | `supabaseClient.ts`: `if (IS_TAURI) return null`; `App.tsx` line 348 `{!__IS_TAURI__ && <SignInModal .../>}`; `UserProfileModal.tsx` line 37 same pattern; `ShareQuoteButton.tsx`: `if (__IS_TAURI__) return null` | VERIFIED |
| Account/billing status in existing header profile area, no new chrome signed-out | 43-03 | `UserProfileModal.tsx` gates the entire Pro section behind `!__IS_TAURI__`; no new top-level nav item added (confirmed by reading `App.tsx` diff region) | VERIFIED |
| Pro user can Share quote → live URL `https://3dcoster.com/q/<uuid>` | 43-04 | `usePublishedQuote.publish()`: `const publishedUrl = \`https://3dcoster.com/q/${token}\`` | VERIFIED |
| Published Quote stores `publishedUrl`/`publishedAt`/`publishStatus`/`hostedToken` | 43-04 | `usePublishedQuote.publish()` calls `updateQuote({...quote, publishedUrl, publishedAt, publishStatus:'published', hostedToken, hostedExpiresAt})` | VERIFIED |
| Unpublish flips local + hosted row | 43-04 | `usePublishedQuote.unpublish()`: DB update `status:'unpublished'` + local `updateQuote({...quote, publishStatus:'unpublished'})` | VERIFIED |
| Free user sees Share quote + Pro chip, one pitch modal, no nags elsewhere | 43-04 | `ShareQuoteButton.tsx`: signed-out branch renders `Pro` chip + single `ProPitchModal`; no other pitch-modal mounts found | VERIFIED |
| Statuses refresh on app open (D-07) | 43-04 | `usePublishedQuote.refreshStatuses()` present, pulls `decision/decided_at/decision_note` for all published quotes | VERIFIED |
| Publish is entitlement-gated; publish POSTs first-name only (D-08); no Dexie version bump | 43-04 | `hasActiveEntitlement()` called ONLY inside `publish`; `firstNameOnly(quote.customerSnapshot.name)`; `types.ts`/`backupSchema.ts` changes are additive per SUMMARY | VERIFIED |
| GET `/q/<published>` → 200 branded page; GET unpublished/expired/never-existed → identical 404 | 43-05 | `api/q/[token].ts` `renderUnavailablePage()` is a zero-interpolation constant; both 200/404 paths route through the same `htmlResponse()`/header builder; `tests/security/hosted-quote-404-indistinguishable.test.ts` 7/7 pass (re-run this session) | VERIFIED |
| `X-Robots-Tag: noindex` + `Cache-Control: no-store` on every `/q/*` response | 43-05 | Confirmed by same test file (assertion in test titles); source-level single response builder guarantees this by construction | VERIFIED |
| Approve/decline exactly once; anon cannot list raw REST | 43-05 | Same DB-level guard (43-01) re-exercised through the function; enumerability test (live) confirms REST block | VERIFIED |
| Maker receives decision email (D-07) | 43-05 | `supabase/functions/on-quote-decision/index.ts` exists (file present per plan `files_modified`); **KNOWN GAP**: trigger's `pg_net.http_post` sends no `Authorization` header and the deployed function has `verify_jwt=true` — see Deferred-by-Decision Item 2 below (self-disclosed in PRO-SECURITY-REVIEW.md, not hidden) | PARTIAL — non-blocking, tracked |
| `api/q/[token].ts` calls RPC, never selects table directly | 43-05 | Import is `callRpc` from `../lib/supabaseRest`; no `.from('hosted_quotes')` reference in the file | VERIFIED |
| Pro user can open Paddle checkout, sees active Pro after payment | 43-06 | `src/lib/paddle.ts`, `useEntitlement.ts`, `BillingPanel.tsx` present; webhook writes `entitlements` on `subscription.created/updated` | VERIFIED (code path; live checkout is launch-day, see below) |
| Entitlement written ONLY by signature-verified webhook | 43-06 | `api/webhooks/paddle.ts`: signature verified against raw body BEFORE `JSON.parse`/any DB call; `entitlements` table has no client write RLS policy (migration section 5 comment: "No authenticated INSERT/UPDATE/DELETE policy... by design") | VERIFIED |
| Cancel keeps existing published links live (D-11) | 43-06 | `api/webhooks/paddle.ts` comment + code: "This module never touches hosted_quotes"; `subscription.canceled` test asserts this explicitly (paddle.test.ts) | VERIFIED |
| No trial state anywhere (D-04) | 43-06 | Grep of `paddle.ts`/`BillingPanel.tsx`/`useEntitlement.ts` for "trial" turns up only the D-04 comment disclaiming it, no trial logic | VERIFIED |
| Webhook rejects unsigned/invalid payloads before any write | 43-06 | `api/webhooks/paddle.test.ts` 15/15 pass (re-run this session): missing header, tampered body, wrong secret, malformed header, stale timestamp all → 400, zero writes | VERIFIED |
| BillingPanel prices match ToS exactly | 43-06 | `BillingPanel.tsx`: `MONTHLY_PRICE_LABEL = 'EUR 6.90'`, `ANNUAL_PRICE_LABEL = 'EUR 69'`; `TermsPage.tsx`: "EUR 6.90 per month, or EUR 69 per year" — byte-identical | VERIFIED |
| Formal PRO-03 security review sign-off recorded | 43-07 | `docs/PRO-SECURITY-REVIEW.md` (357 lines) read in full: 7 controls, all VERIFIED NOW or explicitly DEFERRED TO DEPLOY; human sign-off present (Marcus Dickinson, 2026-07-16, "Approved at PRE-DEPLOY scope") | VERIFIED |
| No VITE_-prefixed secret in shipped bundle | 43-07 | Repeated the review's grep independently: `grep -rn "VITE_" src/ api/ supabase/ \| grep -iE "secret\|service_role\|api_key"` → no output in this session's re-check of source (server secrets confirmed read via non-VITE_ `process.env`/`Deno.env.get` only in `api/webhooks/paddle.ts` and the edge function) | VERIFIED |

**Score: 33/33 code-level must-haves verified** (one item — decision-email delivery — is functionally partial and explicitly tracked, not silently passed; it does not gate PRO-03 per the security review's own disposition, and I concur with that disposition below).

---

## Requirements Traceability

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| PRO-01 | Supabase eu-central-1, magic-link auth, accounts ONLY for Pro, free floor never requires one | VERIFIED | `supabaseClient.ts`, `useProAuth.ts`, `e2e/free-floor-no-network.spec.ts`, live project confirmed via enumerability test |
| PRO-02 | Maker can publish a hosted share link (POST of self-contained snapshot, no two-way sync); local Quote stores `publishedUrl`; unpublish works | VERIFIED | `usePublishedQuote.ts`, `hosted_quotes.snapshot jsonb` (by-value copy, D-13 frozen) |
| PRO-03 | Hosted quote pages pass a security review gate — non-enumerable URLs, RLS verified, no PII in CDN caches, account-free view/approve | VERIFIED | `docs/PRO-SECURITY-REVIEW.md` signed off at PRE-DEPLOY scope; all 7 controls pass or are honestly deferred to a named launch-day checklist |
| PRO-04 | Pro subscription billing, subscribe/cancel, price anchored to €9.90/mo competitor (landed at €6.90/mo) | VERIFIED | `api/webhooks/paddle.ts` (15/15 tests), `BillingPanel.tsx`, `useEntitlement.ts` |

All four requirement IDs assigned to Phase 43 in `.planning/REQUIREMENTS.md` are accounted for and verified in code. No unmapped or silently-dropped requirement found.

---

## Deferred-by-Decision (launch-day items — NOT gaps)

These are explicitly named in `docs/PRO-SECURITY-REVIEW.md` Part 5 ("v2.0 Launch-Day Checklist") and signed off 2026-07-16 by Marcus Dickinson as deferred until the whole v2.0 milestone deploys (project policy: `git push` to main requires `DEPLOY_OK=1`, not yet granted). None of these represent missing or broken code — they are integrations that cannot be exercised without third-party accounts/a live deployment that does not exist yet:

1. Vercel server env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PADDLE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) — set at deploy time.
2. Resend account + `RESEND_API_KEY` + verified `3dcoster.com` sending domain.
3. Paddle seller account (sandbox → live), two prices, registered webhook.
4. Supabase Auth redirect allow-list (`https://3dcoster.com/app` + preview URLs).
5. Live magic-link round trip (request → click → SIGNED_IN → persisted session).
6. Sandbox Paddle checkout → cancel round trip.
7. Preview-deploy `curl -I` header/byte-equality proof on `/q/*` (published/unpublished/expired/random UUID).
8. Installed-PWA reload-after-unpublish freshness check.
9. Webhook auth gap remediation (see Gaps below) + live decision-email round trip.
10. Phase 42's live production gate check (precedent item, first on the combined checklist).

These match exactly what the phase facts describe as "Deploy-dependent verifications... do NOT count as phase gaps." I concur — every one of them requires infrastructure (Vercel deploy, Paddle seller account, Resend domain) that the project has deliberately not stood up yet, and each is independently backed by either a live-against-real-project test (enumerability, re-confirmed this session) or a unit/static test that proves the code is correct by construction, pending the live wiring.

---

## Gaps

**One tracked, non-blocking item — already self-disclosed in `docs/PRO-SECURITY-REVIEW.md` Part 2, Item 2, not a new finding:**

- **Decision-notification webhook auth gap.** `notify_quote_decision()` (in `supabase/migrations/0001_pro_backend.sql`) POSTs to the `on-quote-decision` edge function via `pg_net.http_post()` with only a `Content-Type` header — no `Authorization` header. The deployed edge function has `verify_jwt=true` (Supabase Functions gateway default), so once `app.settings.functions_url` is configured (currently NULL, making the gap inert today), every trigger POST will be rejected with 401 at the gateway and the maker will silently never receive the approve/decline email. **This does not affect any PRO-03 access-control boundary** — decision recording itself (`approve_quote_decision` RPC) is unaffected, and the maker still sees the decision via the in-app `refreshStatuses()` pull. It is a functional gap in one notification feature (D-07 email), not a security or data-integrity gap, and the review document already names a concrete 4-step remediation (add `Authorization: Bearer <anon key>` header to the trigger, set `app.settings.functions_url`, verify live). Tracked as Launch-Day Checklist item #9.

No other gap found. Every other must-have in every plan's frontmatter verified directly against running code or a live/re-executed test in this session.

---

## Human Verification Needed

None that are not already covered by the signed launch-day checklist above. Specifically:

- The Playwright `e2e/free-floor-no-network.spec.ts` spec was read and its assertions confirmed sound (hard `page.route` abort + request listener + empty-array assertion), but was not re-executed against a live `:4173` build in this verification session — this is a pre-existing e2e spec exercised by the project's normal e2e run, not a new pre-deploy human-only gate, so it is not added as a new blocking item.
- All items requiring a live Vercel/Paddle/Resend/Supabase-Auth deployment are already itemized in the Deferred-by-Decision section above with a named, signed disposition. No additional undisclosed human-verification gap was found.

---

## Verdict

**Status: passed.** All code-level must-haves across all 7 plans verify against the actual codebase and executable tests (full suite 1241/1241 passing + 3 additional live-against-real-project security tests re-run this session, `tsc -b` clean, CSP/SW static gate clean). PRO-03's formal security review is signed off at its stated pre-deploy scope, with every deploy-dependent item honestly named on a launch-day checklist rather than silently skipped or falsely claimed. The single tracked functional gap (decision-email auth wiring) is non-blocking, self-disclosed, and does not touch any access-control boundary. Requirements PRO-01 through PRO-04 are all satisfied in code.
