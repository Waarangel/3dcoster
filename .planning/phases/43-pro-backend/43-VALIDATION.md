---
phase: 43
slug: pro-backend
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-14
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 (unit/integration) + Playwright ^1.61.1 (E2E) — both installed |
| **Config file** | `vite.config.ts` (Vitest), `playwright.config.ts` (E2E, chromium, :4173 preview) |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm test` (unit) + `npx playwright test` (E2E) |
| **Estimated runtime** | ~30-90 seconds (unit), Playwright adds ~30s per spec against the preview server |

Backend-touching tests (enumerability, hosted-page HTTP semantics, webhook) require a live/test Supabase project + a Vercel preview deploy — see Wave 0 gaps. These are gated to skip-with-reason when the test env is absent rather than pass silently.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched module>`
- **After every plan wave:** Run `npm test` + the relevant Playwright specs
- **Before `/gsd-verify-work`:** Full suite green AND the PRO-03 anon-enumerability test green (not skipped) against the live/test project
- **Max feedback latency:** ~90 seconds (unit); preview-deploy checks are operator-run at wave/gate boundaries

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | PRO-03 | T-43-01 | Anon SELECT revoked; only SECURITY DEFINER RPCs reachable; no permissive anon policy | unit (structural) | `grep`-gate on 0001_pro_backend.sql (Task 1 verify) | ❌ W0 | ⬜ pending |
| 43-01-02 | 01 | 1 | PRO-01/03/04 | T-43-01 | Live schema enforces RLS; anon `?select=*` returns no rows | integration | `supabase migration list` | ❌ W0 | ⬜ pending |
| 43-02-01 | 02 | 1 | PRO-03 | T-43-08/02 | CSP permits only Supabase+Paddle; /q/ + /api/ excluded from SPA fallback | unit | `node scripts/verify-pro-csp.mjs` | ❌ W0 | ⬜ pending |
| 43-02-02 | 02 | 1 | PRO-01 | T-43-02 | Privacy processor list matches inventory (no drift) | unit | `npx vitest run src/pages/PrivacyPage.test.tsx` | ✅ | ⬜ pending |
| 43-02-03 | 02 | 1 | PRO-04 | — | ToS states real price; leak-guard inverted | unit | `npx vitest run src/pages/TermsPage.test.tsx` | ✅ | ⬜ pending |
| 43-03-01 | 03 | 2 | PRO-01 | T-43-02/09 | Client null under Tauri; no VITE_ secret leak | unit | `npx vitest run src/lib/supabaseClient.test.ts src/hooks/useProAuth.test.ts` | ❌ W0 | ⬜ pending |
| 43-03-02 | 03 | 2 | PRO-01 | T-43-10 | Free floor makes ZERO Supabase-origin requests | E2E | `npx playwright test e2e/free-floor-no-network.spec.ts` | ❌ W0 | ⬜ pending |
| 43-04-01 | 04 | 3 | PRO-02 | T-43-07/11 | Entitlement gated on publish only; name-only PII; backup round-trip | unit | `npx vitest run src/hooks/usePublishedQuote.test.ts src/utils/backupSchema.test.ts` | ❌ W0 | ⬜ pending |
| 43-04-02 | 04 | 3 | PRO-02 | T-43-12 | Pro chip + single pitch modal; owner-scoped writes; desktop hidden | unit | `npx vitest run src/components/pro/ShareQuoteButton.test.tsx src/components/pro/ProPitchModal.test.tsx` | ❌ W0 | ⬜ pending |
| 43-05-01 | 05 | 2 | PRO-03 | T-43-13/05 | Identical 404 body+status across unpublished/expired/unknown; noindex+no-store | integration | `npx vitest run tests/security/hosted-quote-404-indistinguishable.test.ts` | ❌ W0 | ⬜ pending |
| 43-05-02 | 05 | 2 | PRO-03 | T-43-01/02 | Anon cannot list hosted_quotes; Resend key server-only | security | `npx vitest run tests/security/hosted-quote-enumerability.test.ts` | ❌ W0 | ⬜ pending |
| 43-06-01 | 06 | 3 | PRO-04 | T-43-02 | Client token only public; reads own entitlement; no trial; desktop hidden | unit | `npx vitest run src/hooks/useEntitlement.test.ts src/components/pro/BillingPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 43-06-02 | 06 | 3 | PRO-04 | T-43-03/14 | Invalid signature → 400, no write; entitlements service-role-only | integration | `npx vitest run api/webhooks/paddle.test.ts` | ❌ W0 | ⬜ pending |
| 43-07-01 | 07 | 4 | PRO-03 | T-43-01/03/13 | Aggregated PRO-03 controls all PASS with evidence | security | `npx vitest run tests/security/ api/webhooks/paddle.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Checkpoint tasks (43-03 supabase-js legitimacy, 43-05 resend legitimacy, 43-06 paddle legitimacy, 43-07 security sign-off) are human gates — no automated verify (exempt from Nyquist).

---

## Wave 0 Requirements

New from-scratch backend — Wave 0 is substantial for this phase:

- [ ] `supabase/migrations/0001_pro_backend.sql` + `entitlements` table — no Supabase schema exists yet (43-01)
- [ ] `scripts/verify-pro-csp.mjs` — CSP + rewrite assertion script (43-02)
- [ ] `src/lib/supabaseClient.test.ts`, `src/hooks/useProAuth.test.ts` — client-gate + auth-hook stubs (43-03)
- [ ] `e2e/free-floor-no-network.spec.ts` — PRO-01 no-network E2E (43-03)
- [ ] `src/hooks/usePublishedQuote.test.ts` — publish/unpublish/refresh stubs (43-04)
- [ ] `src/components/pro/ShareQuoteButton.test.tsx`, `ProPitchModal.test.tsx` (43-04)
- [ ] `tests/security/hosted-quote-404-indistinguishable.test.ts` — PRO-03 404 semantics (43-05)
- [ ] `tests/security/hosted-quote-enumerability.test.ts` — PRO-03 anon-listing regression, the single most important new test (43-05)
- [ ] `src/hooks/useEntitlement.test.ts`, `src/components/pro/BillingPanel.test.tsx` (43-06)
- [ ] `api/webhooks/paddle.test.ts` — webhook signature + entitlement upsert (43-06)
- [ ] Test harness for a local/test Supabase project (service-role test client, seeded fixtures) — shared infra
- [ ] Playwright fixture for driving the Vercel `/q/[token]` function in preview/CI (Vercel Functions do not run under `vite dev`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/q/[token]` real HTTP 404 + noindex + no-store on a preview deploy | PRO-03 | Vercel Functions don't run under `vite dev`; needs a deployed preview | `curl -I https://<preview>/q/<real-token>` (200) vs `/q/<random-uuid>` and an unpublished token (identical 404s + headers) |
| SPA `/app` still routes after the rewrite exclusion | PRO-01/03 | Rewrite precedence must be verified live (research A5) | Load `/app` on the preview; confirm the calculator renders and `/q/*` reaches the function |
| Magic-link end-to-end sign-in | PRO-01 | Requires a real inbox + Supabase Auth redirect | Request a link on preview, click it, confirm SIGNED_IN + persisted session on reload |
| Paddle sandbox subscribe → cancel keeps links live | PRO-04/D-11 | Requires a Paddle sandbox account + webhook delivery | Complete a sandbox checkout, confirm entitlement + Pro status; cancel; confirm an existing published link still resolves |
| Approval-notification email delivery | D-07 | Requires Resend domain verification + edge deploy | Approve a test hosted quote; confirm the maker's account address receives the email |

---

## Validation Sign-Off

- [x] All non-checkpoint tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s (unit); preview checks operator-run at gates
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready — Wave 0 test scaffolds authored inside their owning plans; `wave_0_complete` flips true once those files exist and the live/test Supabase + preview env are wired.
