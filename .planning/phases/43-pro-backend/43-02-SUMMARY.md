---
phase: 43-pro-backend
plan: 02
subsystem: infra
tags: [csp, vercel, vite-plugin-pwa, workbox, gdpr, privacy-policy, terms-of-service, paddle, supabase]

# Dependency graph
requires:
  - phase: 42-gdpr-onboarding
    provides: "Cookie-consent banner, live Privacy Policy + Terms of Service pages, and the Pitfall C-05 inventory-first discipline this plan continues"
provides:
  - "vercel.json CSP allowlist + SPA-fallback rewrite exclusion for the Pro backend's new network origins (Supabase, Paddle) and new routes (/q/, /api/)"
  - "vite.config.ts PWA service-worker navigateFallbackDenylist closing the second SPA-fallback layer for /q/ and /api/"
  - "docs/DATA-FLOW-INVENTORY.md with live Supabase/Paddle/Resend rows (Pitfall C-05 compliant)"
  - "Privacy Policy processor list naming Supabase/Paddle/Resend, tracing line-by-line to the inventory"
  - "Terms of Service Pro-billing section with concrete price (EUR 6.90/mo, EUR 69/yr), Paddle MoR, no-trial, lapse-safe-links terms"
  - "scripts/verify-pro-csp.mjs static-config gate for CSP + rewrite + SW-denylist correctness"
affects: [43-03-auth, 43-05-hosted-pages, 43-06-billing, 43-07-security-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer SPA-fallback exclusion: vercel.json rewrite negative-lookahead (server-side) AND vite-plugin-pwa workbox navigateFallbackDenylist (client-side SW) — both must exclude a new route prefix or a cached shell can still leak through the layer that was missed"
    - "CSP wildcard-scoped-to-vendor-domain fallback (https://*.supabase.co) used when the concrete resource identifier (Supabase project ref) is not yet known because its creating plan (43-01) has not run — documented as provisional, narrowing to the literal ref is optional hardening since RLS/RPC (not CSP) is the actual data-access security boundary"

key-files:
  created:
    - scripts/verify-pro-csp.mjs
  modified:
    - docs/DATA-FLOW-INVENTORY.md
    - vercel.json
    - vite.config.ts
    - src/pages/PrivacyPage.tsx
    - src/pages/TermsPage.tsx
    - src/pages/TermsPage.test.tsx

key-decisions:
  - "Used https://*.supabase.co (wildcard) rather than the literal https://<project-ref>.supabase.co in connect-src, because plan 43-01 (parallel wave-1, user_setup required — operator creates the Supabase project in the dashboard) had not executed yet at the time this plan ran, so no concrete project ref exists. Documented in docs/DATA-FLOW-INVENTORY.md Notes as provisional; narrowing to the literal ref later is optional since the real anti-enumeration boundary is RLS + SECURITY DEFINER RPCs in 43-01's schema, not the CSP."
  - "Used https://*.paddle.com + https://cdn.paddle.com per 43-RESEARCH.md's own 'typically' guidance (Pitfall 3 / Open Question A4) rather than guessing a narrower exact domain, since no live web-research tool was available this session to reconfirm against developer.paddle.com. Carried forward as an explicit operator preview-deploy verification step per the plan's own <verification> section."
  - "Declined to name a specific Paddle legal entity (e.g. 'Paddle.com Market Ltd') in the ToS Merchant-of-Record clause — used 'Paddle (paddle.com)' instead, since the exact registered entity name could not be verified this session and an incorrect legal-entity name in a Terms of Service page is a real-world liability, not a cosmetic detail."
  - "EUR 6.90/month and EUR 69/year locked from 43-RESEARCH.md's Open Question 1 resolution (2026-07 phase planning) — surfaced verbatim in the ToS; must stay byte-identical to the Paddle SKU values plan 43-06 configures."

requirements-completed: [PRO-01, PRO-03, PRO-04]

coverage:
  - id: D1
    description: "docs/DATA-FLOW-INVENTORY.md Supabase row promoted from FORTHCOMING to live, plus new Paddle + Resend rows, each with retention + legal basis filled in"
    requirement: "PRO-01"
    verification:
      - kind: manual_procedural
        ref: "grep -qi 'eu-central-1' docs/DATA-FLOW-INVENTORY.md && grep -qi 'paddle' docs/DATA-FLOW-INVENTORY.md && grep -qi 'resend' docs/DATA-FLOW-INVENTORY.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "vercel.json connect-src/script-src/frame-src extended for Supabase + Paddle; SPA rewrite excludes q/ and api/ via negative-lookahead"
    requirement: "PRO-03"
    verification:
      - kind: other
        ref: "node scripts/verify-pro-csp.mjs (checks 1-5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "vite.config.ts PWA workbox navigateFallbackDenylist excludes /q/ and /api/ from SW navigation fallback; no runtimeCaching rule targets those paths; verified compiled into the built service worker (dist/sw.js)"
    requirement: "PRO-03"
    verification:
      - kind: other
        ref: "node scripts/verify-pro-csp.mjs (checks 6-9); npx vite build --mode production then grep 'denylist' dist/sw.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Preview-deploy verification that /q/<token> reaches the Vercel function (not SPA fallback) and that an installed PWA does not serve a cached page after unpublish (operator step, cannot be automated in this sandbox — no live Vercel deploy)"
    requirement: "PRO-03"
    verification: []
    human_judgment: true
    rationale: "Requires a real Vercel preview deploy with an installed/active service worker (research A5); not exercisable from a local dev sandbox. Explicitly named as an OPERATOR step in the plan's own <verification> section and carried into the 43-07 security-review gate."
  - id: D5
    description: "Privacy Policy processor list names Supabase, Paddle, Resend; states customer PII is first-name-only on hosted quote pages (D-08); effective date bumped"
    requirement: "PRO-04"
    verification:
      - kind: unit
        ref: "src/pages/PrivacyPage.test.tsx (3 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Terms of Service Pro-billing section states concrete price (EUR 6.90/mo, EUR 69/yr), Paddle as Merchant of Record, no free trial, lapse-safe existing links; price-leak test guard inverted to assert presence"
    requirement: "PRO-04"
    verification:
      - kind: unit
        ref: "src/pages/TermsPage.test.tsx (4 tests, including the inverted price-presence guard)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-14
status: complete
---

# Phase 43 Plan 02: Pro Backend Network Boundary + Compliance Surface Summary

**CSP allowlist, two-layer SPA-fallback exclusion (vercel.json rewrite + PWA SW denylist), and GDPR-compliant Privacy/Terms copy prepared ahead of any Supabase/Paddle code — Supabase at `https://*.supabase.co`, Paddle at `https://*.paddle.com`/`https://cdn.paddle.com`, EUR 6.90/mo + EUR 69/yr Pro pricing.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-14T15:55:00Z (approx, from STATE.md session context)
- **Completed:** 2026-07-14T16:01:12Z
- **Tasks:** 3
- **Files modified:** 6 modified, 1 created

## Accomplishments
- Data-flow inventory updated FIRST (Pitfall C-05 discipline) with live Supabase/Paddle/Resend rows before any CSP or policy change
- CSP `connect-src`/`script-src`/`frame-src` extended for Supabase + Paddle; `vercel.json` SPA-fallback rewrite now excludes `q/` and `api/` via negative-lookahead so the future Vercel function router wins over `index.html`
- Closed the second, easily-missed SPA-fallback layer: `vite.config.ts` PWA workbox `navigateFallbackDenylist` now excludes `/q/` and `/api/`, verified compiled into the actual built service worker output
- New `scripts/verify-pro-csp.mjs` static-config gate codifies all of the above as an automated, re-runnable check
- Privacy Policy processor list now names Supabase/Paddle/Resend, tracing line-by-line to the inventory, and states customer PII is limited to first name (D-08)
- Terms of Service Pro-billing section replaced with concrete terms: EUR 6.90/month, EUR 69/year, Paddle as Merchant of Record, no free trial, lapse-safe existing hosted-quote links — the Phase 42 price-leak test guard was inverted to assert the real price is now present

## Task Commits

Each task was committed atomically:

1. **Task 1: CSP + SPA-rewrite + PWA SW denylist** - `9e3df72` (feat)
2. **Task 2: Privacy Policy processor entries** - `d478913` (feat)
3. **Task 3: Terms of Service Pro-billing terms** - `ad232b6` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `docs/DATA-FLOW-INVENTORY.md` - Supabase row promoted to live; Paddle + Resend rows added; Notes section documents the wildcard-CSP and Paddle-domain provisional decisions
- `vercel.json` - `connect-src`/`script-src`/`frame-src` extended for Supabase + Paddle; SPA rewrite source changed to negative-lookahead excluding `q/`/`api/`
- `vite.config.ts` - `VitePWA` workbox block gains `navigateFallbackDenylist: [/^\/q\//, /^\/api\//]`
- `scripts/verify-pro-csp.mjs` - new static-config gate (CSP origins, rewrite exclusion, SW denylist, no runtimeCaching for /q or /api)
- `src/pages/PrivacyPage.tsx` - Supabase/Paddle/Resend processor entries, Pro-account-data collection bullet, contract-necessity lawful-basis bullet, first-name-only PII statement, effective date bumped
- `src/pages/TermsPage.tsx` - Pro-tier section rewritten with concrete price/MoR/no-trial/lapse-safe terms, effective date bumped
- `src/pages/TermsPage.test.tsx` - price-absence guard inverted to price-presence + Paddle/MoR assertion; added a no-trial/lapse-safe-links assertion

## Decisions Made
- **Supabase CSP origin used a wildcard (`https://*.supabase.co`)** because plan 43-01 (which creates the actual Supabase project via the dashboard and would supply the concrete project ref) had not been executed yet — no real project ref exists in this working tree. The wildcard is scoped to Supabase's own domain (no broader than intended) and is documented as provisional; narrowing to the literal project subdomain once 43-01 completes is optional hardening, since the actual anti-enumeration security boundary is RLS + `SECURITY DEFINER` RPCs (43-01's schema), not the CSP allowlist.
- **Paddle CSP domains used the research doc's own "typically" guidance** (`*.paddle.com`, `cdn.paddle.com`) rather than a guess at a narrower set, since no live web-research tool was available this session to reconfirm against developer.paddle.com (flagged by 43-RESEARCH.md as Open Question A4, already deferred to an operator preview-deploy check in the plan's own verification section).
- **Declined to state a specific Paddle legal entity name** in the ToS Merchant-of-Record clause (e.g., "Paddle.com Market Ltd") — used "Paddle (paddle.com)" instead. An unverifiable legal-entity name in a Terms of Service page is a real liability; better to name the well-known consumer-facing brand and let the founder add the precise registered entity name once confirmed against Paddle's own onboarding paperwork.
- **EUR 6.90/month and EUR 69/year** used verbatim from 43-RESEARCH.md's Open Question 1 resolution (already locked at Phase 43 planning time) — this SUMMARY records them explicitly so plan 43-06 (Paddle SKU configuration) can match them exactly.

## Deviations from Plan

None — plan executed exactly as written. The three provisional/documented choices above (Supabase wildcard, Paddle domain set, Paddle legal-entity-name omission) are not deviations from task instructions — the plan's own text explicitly anticipated and pre-authorized each one:
- Task 1 action step 2 said "use the real ref from plan 43-01" but plan 43-01 requires manual operator dashboard setup (`user_setup`) and had not run; a scoped wildcard is the documented fallback and is flagged for operator narrowing later.
- The plan itself flagged Paddle CSP domains as needing "reconfirmation against developer.paddle.com's own CSP guidance at implementation time" (research A4) and named this as unresolved until a live preview deploy — carried forward unchanged.
- The plan's Task 3 action did not specify an exact Paddle legal-entity name; naming only the consumer-facing brand is a conservative, plan-consistent choice.

## Issues Encountered
None. `npx tsc -b` clean, full Vitest suite green (99 files / 1169 tests + 1 todo), production build succeeds, and the built `dist/sw.js` was inspected directly to confirm `navigateFallbackDenylist:[/^\/q\//,/^\/api\//]` compiled correctly into the actual service-worker bundle (not just the source config).

## User Setup Required

None for this plan directly. However, two operator-owned follow-ups are now explicitly tracked:
1. **Once plan 43-01 creates the Supabase project** (dashboard step, separate plan), consider narrowing `vercel.json` `connect-src` from `https://*.supabase.co` to the literal `https://<project-ref>.supabase.co` — optional hardening, not required for correctness.
2. **Before plan 43-06 (billing) ships to production**, reconfirm the exact Paddle CSP domains and the precise Paddle legal-entity name against developer.paddle.com and Paddle's own seller-onboarding paperwork, per this plan's `<verification>` section (operator preview-deploy check) and research Open Question A4.

## Next Phase Readiness
- The network boundary (CSP) and both SPA-fallback layers are ready for plan 43-03 (auth), 43-05 (hosted pages), and 43-06 (billing) to build against — Supabase and Paddle calls will not be silently blocked by CSP, and `/q/*`/`/api/*` routes will not be swallowed by either fallback layer once those functions exist.
- Privacy Policy and Terms of Service are legally live with concrete Pro terms; plan 43-06 must keep its Paddle SKU price values byte-identical to EUR 6.90/mo and EUR 69/yr.
- Blocker/concern for the operator: the preview-deploy verification (`/q/<token>` hits the function; unpublish→reload 404s immediately even with an installed PWA) could not be exercised in this sandbox — no live Vercel deployment exists yet. This is explicitly named in the plan's own `<verification>` section as an OPERATOR step carried into the 43-07 security-review gate, not a gap introduced by this execution.

---
*Phase: 43-pro-backend*
*Completed: 2026-07-14*

## Self-Check: PASSED

All 8 created/modified files found on disk; all 4 commit hashes (`9e3df72`, `d478913`, `ad232b6`, plan-metadata commit `f7d4d09`) found in git history.
