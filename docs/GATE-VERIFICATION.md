# GDPR Consent-Gate Verification (Phase 42, D-13/D-14)

Phase 42 is a **hard gate**: the consent banner must be confirmed live and network-verified
in production, with zero analytics requests firing before consent, before Phase 43 (Pro
Backend) begins. This document is the runbook for that verification — both the automated
check (runs anywhere, anytime) and the manual production check (runs once, right after deploy).

## 1. Automated check — `e2e/consent-gate.spec.ts`

This is the project's first E2E test. It drives the real consent banner
(`src/components/consent/CookieConsentManager.tsx`) against a production-equivalent build
served on the pinned `:4173` preview server, and asserts:

1. Zero analytics beacon requests (`/_vercel/insights/*`, `insights/script.js`) fire before
   any consent decision.
2. "Reject All" is exactly one click — no intermediate preferences screen.
3. "Accept All" and "Reject All" carry identical visual weight (same computed
   `font-weight`, same bounding-box width/height) — the C-04 dark-pattern checklist.

### How to run it

```bash
npm run build
npm run test:e2e
```

or, to run only the consent-gate spec directly:

```bash
npx playwright test e2e/consent-gate.spec.ts
```

This is the regression-safety net: it fails loudly the moment a future dependency bump
(vanilla-cookieconsent, @vercel/analytics) or a styling change reintroduces pre-consent
analytics or an unequal-weight button pair. It runs against the local build — it does
**not** replace the manual production check below, because it cannot observe the real
Vercel-served production environment (CDN caching, real DNS, real CSP headers).

## 2. Manual production check (operator, post-deploy — D-13/D-14)

This step is **required** and cannot be automated — it verifies behavior against the real,
live, publicly-deployed site (3dcoster.com), not a local build. **The phase is not complete
until this passes on production.**

Run this immediately after the Phase 42 production deploy (per D-13: UAT + review, then one
production push):

1. Open a **fresh incognito/private browser window** (no existing cookies, no cached consent
   decision) and navigate to `https://3dcoster.com`.
2. Open DevTools → **Network** tab, and enable "Preserve log" if available.
3. **Hard-reload** the page (Cmd+Shift+R / Ctrl+Shift+R) so nothing is served from cache.
4. Before clicking anything, inspect the Network tab requests. Confirm **zero** requests to
   `/_vercel/insights/*` or any URL containing `insights/script.js` have fired. The consent
   banner should be visible at this point with "Accept All" and "Reject All" both present.
5. Click **Accept All**. Confirm the `/_vercel/insights/script.js` beacon request now
   appears in the Network tab (and, on subsequent navigation, a `/_vercel/insights/view`
   POST — Vercel Analytics' page-view event).
6. Reload the page in the same incognito window. Confirm the banner does **not** reappear
   (consent choice persisted) and the analytics beacon fires immediately (consent already
   granted).
7. Open a **second, separate incognito window** and repeat steps 1–4, but this time click
   **Reject All**. Confirm the banner dismisses in one click and **no** analytics beacon
   request ever appears in that window's Network tab, even after reloading and navigating
   between pages.

If any step fails, the gate is **not** verified — do not proceed to Phase 43 until the
underlying issue is fixed and this checklist is re-run clean.

## 3. Scope note

This harness is deliberately minimal (chromium only, one spec file) per D-14 — the full
Playwright/E2E milestone remains explicitly deferred (see `.planning/phases/42-gdpr-onboarding/42-CONTEXT.md`,
Deferred Ideas). Do not expand `e2e/` beyond the consent gate without a dedicated E2E
milestone decision.
