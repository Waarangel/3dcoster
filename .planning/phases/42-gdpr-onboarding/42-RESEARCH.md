# Phase 42: GDPR & Onboarding - Research

**Researched:** 2026-07-09
**Domain:** GDPR cookie-consent management (vanilla-cookieconsent v3), consent-gated third-party analytics, EU legal pages, resumable first-run onboarding overlay, minimal Playwright E2E harness
**Confidence:** HIGH (all library claims verified against official docs + npm registry + installed source; codebase claims verified by reading the actual files)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Consent banner (GDPR-01)**
- **D-01: Full custom theme.** Override vanilla-cookieconsent v3's CSS variables to match the slate-900/blue-600 design system. The banner is the first thing an EU visitor sees — a stock white banner on the dark site reads as broken.
- **D-02: Revocation = Footer link + in-app Settings entry.** Marketing pages get a "Cookie settings" link in the shared `Footer`; the calculator (`/app` renders no Footer) gets a Cookie settings entry in its Settings tab. Both open the library's preferences modal; changes take effect without reload (success criterion 2).
- **D-03: Desktop ships ZERO analytics.** `<Analytics />` currently mounts unconditionally in `src/main.tsx` — including the Tauri build. Strip it from desktop entirely (`!__IS_TAURI__` gate): nothing to consent to → no banner needed, and it matches the local-first brand promise. This code lands now but reaches desktop users on a future tag (D-15).
- **D-04: Banner fires on every web route (marketing + /app); categories = Necessary (locked on) + Analytics.** Analytics runs site-wide, so consent must too. No Marketing category until a marketing script actually exists — no empty toggles (research anti-feature).

**Legal pages (GDPR-02, GDPR-03)**
- **D-05: Claude drafts, user reviews.** Both pages drafted from the actual data-flow inventory (Vercel Analytics, Supabase eu-central-1, FX API, Formspree feedback) — not a generic template — with plain-English GDPR sections (data collected, lawful basis, retention, data-subject rights, processors, contact). User reviews line-by-line before ship. Lawyer review deferrable to before Pro billing goes live.
- **D-06: Full ToS now, Pro section generic.** Free-tier terms fully concrete; Pro section covers the framework (accounts, acceptable use, payment obligations, cancellation, data on termination) without hard-coded prices. Phase 43 fills in billing specifics as a ToS update with a new effective date.
- **D-07: Contact = privacy@3dcoster.com.** Dedicated alias forwarding to the user's inbox (user sets up the forward — flag as a human prerequisite in planning). Keeps legal mail out of feedback channels and personal addresses off public pages.
- **D-08: React pages + data-flow inventory.** `PrivacyPage.tsx` / `TermsPage.tsx` at `/privacy` and `/terms`, following the existing lazy-loaded marketing-page pattern (Header/Footer, `lazyWithRetry`). PLUS `docs/DATA-FLOW-INVENTORY.md` — a table of what data / who collects / where it goes / retention / legal basis that the policy text is generated from. This is the Pitfall C-05 defense: Phase 43 updates the inventory first, policy second.

**Onboarding wizard (ONBD-01)**
- **D-09: Guided overlay on the real UI.** A floating step card navigates the user to the real tab for each step (Settings → add printer, Materials → add filament, Calculator → price a job) via the Phase 38 tab-in-URL routing, and advances when the real action completes. No duplicate mini-forms; the user learns the actual app. Resumable via `UserProfile.onboardingStep` (Dexie, NOT localStorage — Pitfall M-01); `onboardingCompletedAt` means never show again. Auto-skip when a printer already exists.
- **D-10: Core 3 steps only.** Add printer → add filament → price first job, exactly per the roadmap success criterion. No role/persona step (deferred).
- **D-11: Catalog quick-add tiles.** Printer and filament steps each show the top ~3 catalog entries as one-tap tiles plus a "mine isn't listed" path into the normal add form. Catalogs already exist (v1.7 printers, v1.8 materials).
- **D-12: Quiet finish + toast.** Step 3 completes when the first cost calculation shows; the overlay congratulates briefly via the existing `useToast` system ("You're ready — save this job or create a quote") and dismisses. No confetti dependency.

**Deploy & gate verification**
- **D-13: UAT + review, then ONE production deploy.** Finish the Phase 42 build → `/gsd-verify-work` UAT → release-diff code review across the staged 38–42 work → user gives the explicit `DEPLOY_OK=1` go → single production push → verify the gate on live. Deploy timing remains the user's call; the phase is not complete until the gate is verified in production.
- **D-14: Gate verification = automated test + manual prod check.** A Playwright (or equivalent) test asserts (a) no analytics network requests fire pre-consent and (b) Reject All is one click — runnable against the local build. PLUS a documented manual DevTools network check on live production after deploy (fresh incognito visit, network tab, zero analytics requests before any consent click). Note: this introduces the project's first E2E tooling — keep it minimal and scoped to the consent gate; the full E2E milestone remains deferred.
- **D-15: No desktop release this phase.** The desktop Analytics strip + wizard land in the codebase now but ship to desktop users whenever the user next cuts a `v*` tag (their call, per release-cadence rule — likely with the Phase 45 launch). The web deploy is what the hard gate needs.

### Claude's Discretion
- Banner copy/tone, consent expiry duration, exact CSS-variable theming values
- Consent state shape/versioning in localStorage (first-party, no PII — per research; note vanilla-cookieconsent manages its own storage)
- Overlay component structure (research sketch: `OnboardingOverlay` / `OnboardingStep` / `useOnboarding`, mounted in App.tsx after ToastProvider, reading the already-subscribed `useUserProfile`) — adapt as the code dictates
- Quick-add tile selection (which top-3 printers/materials) and layout
- Skip affordance wording/placement (must exist on every step; skip persists permanently)
- Exact Playwright setup scope (minimal harness vs. single spec file)
- NEW-badge treatment (wizard is user-facing → register in `src/features.ts`; consent banner and legal pages are NOT features — no badges)

### Deferred Ideas (OUT OF SCOPE)
- **Role/persona onboarding step** (hobbyist / Etsy seller / small business setting margin + marketplace defaults) — needs `userRole` field; revisit post-launch
- **First-job confetti celebration / milestone card** — retention hook if onboarding completion data warrants it
- **Marketing consent category** — add when an actual marketing/ad script exists (likely Pro launch)
- **Lawyer review of legal pages** — before Pro billing goes live (Phase 43/45 window)
- **ToS billing specifics** (price, cycle, refunds) — Phase 43 when pricing is final
- **Full E2E test milestone** — D-14 introduces only a minimal consent-gate spec; broader Playwright coverage stays a separate milestone
- **Desktop release carrying the Analytics strip + wizard** — user's call on the next `v*` tag (likely Phase 45 launch)

**Note on a stale ARCHITECTURE.md milestone-research detail (superseded by these locked decisions):** `.planning/research/ARCHITECTURE.md` §7's suggested onboarding step list includes a "Currency + region" first step and a 5-step flow. D-10 locks the wizard at exactly 3 steps (printer → filament → price a job) with no currency/region step and no role step. Plan against D-10, not the milestone sketch.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GDPR-01 | Cookie/consent banner (vanilla-cookieconsent v3) with equal-weight Accept/Reject on the first layer, granular categories, revocable at any time, consent stored — Vercel Analytics and any future script loads only after opt-in; skipped entirely in the Tauri desktop app | Verified `guiOptions.consentModal.equalWeightButtons` defaults `true`; verified `<Analytics />` only injects its beacon script inside a mount-time `useEffect` (source-read) so gating the render is sufficient; verified `__IS_TAURI__` is a compile-time define, dead-code-eliminated in the Tauri build |
| GDPR-02 | EU/GDPR-compliant privacy policy page — what's collected, lawful basis, retention, data-subject rights (access/export/delete), processors (Vercel, Supabase, FX API), contact | Verified actual `connect-src` allowlist in `vercel.json` — the real processor list is larger than the three named in CONTEXT.md (see Pitfalls); `lazyWithRetry` marketing-page pattern confirmed in `main.tsx` + `FAQPage.tsx` |
| GDPR-03 | Terms of Service page for the Pro tier | Same lazy-page pattern; no code dependencies beyond routing |
| ONBD-01 | First-run users get a guided, skippable, resumable onboarding wizard (add printer → add filament → price first job) that never blocks returning users or touches existing data | Verified `UserProfile` is untyped JSON in `db.settings` (DB at Dexie v12, confirmed via `types.ts` comment) so new optional fields need no migration; verified hook name is `useUserProfile`/`updateProfile` (not `updateUserProfile` as the milestone sketch names it); verified `EmptyState` shared component exists so the wizard is additive, not a replacement |
</phase_requirements>

## Summary

This phase has three independent workstreams that share almost no code: a GDPR consent banner (library-driven), two static legal pages (content-driven), and a resumable onboarding overlay (state-driven). All three are additive to the existing React 19 + Vite 7 + Tailwind 4 + Dexie 4 stack — no new heavyweight dependencies, no backend, no new Dexie schema version.

The consent banner should be built on `vanilla-cookieconsent` v3.1.0 (already locked in CONTEXT.md and STACK.md). Verified against the official config reference: `guiOptions.consentModal.equalWeightButtons` **defaults to `true`**, meaning the C-04 "Accept/Reject at equal visual weight" gate requirement is the library's out-of-the-box behavior, not something to build — the risk is a custom theme accidentally overriding it. Reading the actual `@vercel/analytics/react` v1.6.1 source confirms the beacon script is only injected inside a `useEffect(() => inject(...), [])` that runs on mount — so an `AnalyticsGate` component that conditionally renders `<Analytics />` based on consent state is sufficient to guarantee zero pre-consent network requests; no manual script-blocking is needed. One real gotcha found only by reading the source: once `<Analytics />` has mounted once, unmounting it does **not** remove the already-injected `<script>` tag or clear `window.va`/`window.vaq` — so a straightforward "revoke → unmount" implementation would leave the beacon technically still wired up for any code that calls `window.va(...)` directly (SPA route-change pageviews). The revoke path must also strip the script element and the `window.va*` globals to be a true no-reload revocation.

The legal pages follow the existing `lazyWithRetry` + `Header`/`Footer` marketing-page pattern used by `FAQPage.tsx` and others — no new infrastructure. The real data-flow inventory (read from `vercel.json`'s CSP `connect-src` allowlist, the actual network-egress source of truth) is larger than the three processors named in CONTEXT.md: it also includes GitHub's releases API (desktop update checks) and Formspree (feedback form) as of today. The Privacy Policy and the `docs/DATA-FLOW-INVENTORY.md` (D-08) must cover all of these, not just Vercel/Supabase/FX, or the policy is non-compliant with Pitfall C-05 on day one.

The onboarding overlay is the most architecturally novel piece but has no new dependencies: `UserProfile` is stored as untyped JSON in `db.settings` (Dexie is currently at schema v12 per `types.ts`), so `onboardingStep`/`onboardingCompletedAt` are free additions requiring no migration. The existing `useUserProfile()` hook (note: the actual exported updater is `updateProfile`, not `updateUserProfile` as the milestone ARCHITECTURE.md sketch names it) is the correct read/write surface. The wizard's 3 locked steps (D-10) supersede the milestone research's 5-step sketch — plan against CONTEXT.md, not `ARCHITECTURE.md` §7.

D-14 introduces this project's first E2E test tooling. `@playwright/test` 1.61.1 is current on npm (verified) with 43.8M weekly downloads from Microsoft's official repo; the project-legitimacy checker flagged it `SUS` purely on a "recently published" heuristic (the 1.61.1 patch release is from within the last month) — this is a well-understood false positive for an extremely high-download, first-party-maintained package, but per protocol it is still tagged and gated behind a lightweight human-verify checkpoint. `vite.config.ts` already pins the dev/preview port to 4173, which the Playwright `webServer` config should reuse as `baseURL`.

**Primary recommendation:** Build `AnalyticsGate` (mount-gated `<Analytics />` + explicit revoke cleanup) and a small `useSyncExternalStore`-based `useConsent()` hook driven by vanilla-cookieconsent's `onConsent`/`onChange`/`onFirstConsent` callbacks (NOT a `storage`-event listener — the library's default persistence is a first-party cookie, not localStorage, so `storage` events never fire for it). Ship the onboarding overlay exactly to D-10's 3 steps, reading/writing through the existing `useUserProfile()` hook with zero Dexie migration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Consent banner UI + state | Browser / Client | — | Vanilla JS library rendered client-side; no SSR in this Vite SPA |
| Consent-gated analytics loading | Browser / Client | CDN / Static (script origin) | `<Analytics />`'s injected script is served same-origin via Vercel's `/_vercel/insights/script.js` rewrite — gating happens entirely client-side before that request fires |
| Legal page content (Privacy/ToS) | Browser / Client | — | Static React pages, client-rendered like all other marketing pages in this SPA (no backend, no CMS) |
| Data-flow inventory (source of truth for legal copy) | Database / Storage (conceptual — actually `vercel.json` CSP config) | — | The `connect-src` allowlist in `vercel.json` IS the enforced list of external destinations this app can reach; it's the most authoritative inventory source available pre-Phase-43 |
| Onboarding wizard state | Browser / Client | Database / Storage (Dexie `db.settings`) | Ephemeral step-navigation UI lives in React state; persistence (resume, auto-skip, completion) lives in Dexie via the existing `UserProfile` JSON blob |
| Onboarding step → real-tab navigation | Browser / Client | — | Uses Phase 38's `?tab=` URL param routing (`useSearchParams` in `App.tsx`) — no new routing mechanism |
| E2E consent-gate test | Browser / Client (Playwright drives a real browser) | — | Playwright launches Chromium against the Vite preview server at :4173; asserts on network requests, not app internals |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vanilla-cookieconsent` | `3.1.0` [VERIFIED: npm registry] | GDPR consent banner + preferences modal, first-party cookie storage | Framework-agnostic, ~7 KB gz per STACK.md's original research; verified via `gsd-tools package-legitimacy check`: OK verdict, 268,882 weekly downloads, official `orestbida/cookieconsent` GitHub repo, no postinstall script, last published 2025-02-04 |
| `@playwright/test` | `1.61.1` [VERIFIED: npm registry] | Minimal E2E harness for the D-14 consent-gate spec | Industry-standard for this exact "assert on network requests + DOM state in a real browser" use case; 43.8M weekly downloads, Microsoft first-party. Flagged `SUS` by the legitimacy checker on a "too-new" heuristic (see Package Legitimacy Audit) — false positive given download volume and maintainer, but still gate behind human-verify per protocol |

### Supporting

No new supporting/runtime dependencies. Everything else (legal pages, onboarding overlay, `AnalyticsGate`, `useConsent`) is hand-written React using patterns already in this codebase (`lazyWithRetry`, `useSearchParams` tab routing, `useToast`, `useUserProfile`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vanilla-cookieconsent` v3 | `react-cookie-consent` / `react-gdpr` | Simple accept/reject only — no granular per-category consent, fails the GDPR granularity requirement documented in PITFALLS.md C-04. Rejected in STACK.md already; reconfirmed here. |
| `vanilla-cookieconsent` v3 | Paid CMP (Cookiebot, OneTrust, CookieHub) | $12–99/mo subscription for a capability the free OSS library already provides at this scale. Explicitly listed in REQUIREMENTS.md "Out of Scope". |
| `@playwright/test` | Cypress | Playwright has first-class network-request assertion (`page.on('request', ...)`) which is exactly what D-14's "zero analytics requests before consent" assertion needs; Cypress's network layer is more awkward for this. Both are legitimate choices — Playwright chosen for the sharper request-assertion API and because it's already the ecosystem-standard pick in this org's own testing rules (`~/.claude/rules/ecc/typescript/testing.md` names Playwright explicitly as the required E2E framework). |
| Hand-rolled banner | `vanilla-cookieconsent` | REQUIREMENTS.md already locks the library choice (GDPR-01 wording names it explicitly) — not a live decision for this phase. |

**Installation:**
```bash
npm install vanilla-cookieconsent@3.1.0
npm install -D @playwright/test@1.61.1
npx playwright install chromium   # only Chromium needed for a minimal gate spec
```

**Version verification:** Both versions above were confirmed live against the npm registry on 2026-07-09 via `npm view <pkg> version` and `gsd-tools query package-legitimacy check --ecosystem npm`. `vanilla-cookieconsent` last published 2025-02-04 (stable, no newer release since); `@playwright/test` last published 2026-06-23 (active, frequent-release cadence typical of Playwright).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `vanilla-cookieconsent` | npm | Latest (3.1.0) published 2025-02-04 (~17 mo) | 268,882/wk | github.com/orestbida/cookieconsent | OK | Approved |
| `@playwright/test` | npm | Latest (1.61.1) published 2026-06-23 (~2 wk before this research) | 43,864,616/wk | github.com/microsoft/playwright | SUS | Flagged — planner must add a `checkpoint:human-verify` task before `npm install`, but note: 43.8M weekly downloads + Microsoft's own GitHub org is a strong legitimacy signal on its own; the SUS verdict here is a "too-new" heuristic on the *patch* release, not a "few downloads / no repo" signal. The human-verify step should be a 30-second sanity check (`npm view @playwright/test repository`), not a deep audit. |

**Packages removed due to `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** `@playwright/test` (see disposition above — high-confidence false positive, still gated per protocol)

Neither package showed a `postinstall` script (checked via `npm view <pkg> scripts.postinstall` — both empty).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Web visitor (any route: marketing pages OR /app)                │
└───────────────────────────┬────────────────────────────────────┘
                             │ page load
                             ▼
                 ┌───────────────────────┐
                 │  main.tsx / Root()    │  __IS_TAURI__ check (compile-time)
                 └───────────┬───────────┘
                             │ web only
                             ▼
                 ┌───────────────────────┐
                 │ CookieConsentManager  │  mounts vanilla-cookieconsent
                 │ (useEffect, once)     │  CookieConsent.run({ categories,
                 └───────────┬───────────┘   guiOptions, onConsent, onChange })
                             │
              first-run? ────┴──── returning, no valid cookie?
                 │                        │
                 ▼                        ▼
        ┌─────────────────┐     ┌──────────────────────┐
        │ consentModal     │     │ silently restores      │
        │ (equal-weight    │     │ prior category state    │
        │  Accept/Reject)  │     │ from cc_cookie           │
        └────────┬─────────┘     └───────────┬──────────┘
                 │ user clicks Accept/Reject/     │
                 │ Save preferences                │
                 ▼                                 ▼
        ┌─────────────────────────────────────────────┐
        │ CookieConsent fires onFirstConsent/onConsent/ │
        │ onChange({ cookie, changedCategories })       │
        └───────────────────┬───────────────────────────┘
                             │ notifies subscribers
                             ▼
        ┌─────────────────────────────────────┐
        │ useConsent() — useSyncExternalStore   │  module-level store, NOT
        │ subscribed to a tiny event emitter    │  a storage-event listener
        │ updated inside the callbacks above    │  (default persistence is a
        └───────────────────┬───────────────────┘  cookie, not localStorage)
                             │ hasConsent('analytics')
                             ▼
        ┌─────────────────────────────────────┐
        │ AnalyticsGate (in main.tsx, replaces  │  true → mount <Analytics />
        │ the bare <Analytics /> render)        │  → useEffect(inject script)
        │                                        │  false/revoked → unmount +
        │                                        │  strip <script>, delete
        │                                        │  window.va/vaq/vam
        └───────────────────┬───────────────────┘
                             │ only if mounted
                             ▼
              GET /_vercel/insights/script.js (same-origin,
              already allowed by existing CSP script-src 'self')

──────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│  Footer "Cookie settings" link (marketing pages) OR               │
│  Settings entry (in-app, web only)                                 │
└───────────────────────────┬───────────────────────────────────────┘
                             │ onClick
                             ▼
                 CookieConsent.showPreferences()
                             │ user changes toggle → Save
                             ▼
                 onChange fires → useConsent() updates →
                 AnalyticsGate re-renders WITHOUT page reload

──────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│  First-run /app visit (web or desktop)                            │
└───────────────────────────┬───────────────────────────────────────┘
                             │ App.tsx mounts, useUserProfile() resolves
                             ▼
              userProfile.onboardingCompletedAt undefined
              AND no printer exists in Dexie (auto-skip check)?
                 │ no (has printer or already completed)     │ yes
                 ▼                                            ▼
            no overlay rendered                    ┌─────────────────────┐
                                                     │ OnboardingOverlay     │
                                                     │ reads onboardingStep  │
                                                     │ (0 = printer step)    │
                                                     └──────────┬────────────┘
                                                                │ "Add printer"
                                                                │ tile click or
                                                                │ real form save
                                                                ▼
                                                 navigateToTab('settings')
                                                 (Phase 38 ?tab= routing)
                                                 + writes real Printer via
                                                 existing addAsset/addPrinter
                                                                │
                                                                ▼
                                                 step completes → writes
                                                 onboardingStep via
                                                 useUserProfile().updateProfile
                                                 (Dexie db.settings, no
                                                  migration — JSON blob)
                                                                │
                                    (repeat for filament step, then
                                     price-a-job step, watching for the
                                     first computed cost to appear)
                                                                ▼
                                                 onboardingCompletedAt set,
                                                 useToast().success(...) fires,
                                                 overlay unmounts permanently
```

### Recommended Project Structure

```
src/
├── components/
│   ├── consent/
│   │   ├── CookieConsentManager.tsx   # mounts CookieConsent.run(), web-only
│   │   ├── AnalyticsGate.tsx          # consent-gated <Analytics /> + revoke cleanup
│   │   └── CookieSettingsLink.tsx     # thin button wrapping showPreferences()
│   └── onboarding/
│       ├── OnboardingOverlay.tsx      # reads onboardingStep, renders steps
│       ├── OnboardingStep.tsx         # reusable step card (title, tiles, skip, next)
│       └── useOnboarding.ts           # reads/writes onboardingStep via useUserProfile
├── hooks/
│   └── useConsent.ts                  # useSyncExternalStore over CookieConsent callbacks
├── utils/
│   └── consent.ts                     # ConsentCategory type, tiny pub/sub event target
├── pages/
│   ├── PrivacyPage.tsx                # lazyWithRetry pattern, Header/Footer
│   └── TermsPage.tsx                  # same pattern
docs/
└── DATA-FLOW-INVENTORY.md             # D-08: table feeding the Privacy Policy copy
e2e/
├── consent-gate.spec.ts               # D-14: single Playwright spec
playwright.config.ts                    # webServer → vite preview on :4173
```

### Pattern 1: Consent state via `useSyncExternalStore`, not `storage` events

**What:** A tiny module-level event target that the `CookieConsentManager`'s `onFirstConsent`/`onConsent`/`onChange` callbacks push updates into, consumed by React via `useSyncExternalStore`.

**When to use:** Any time a non-React library (vanilla-cookieconsent) needs to notify React components of state changes without a full page reload.

**Why not the `storage`-event pattern from the milestone ARCHITECTURE.md sketch:** vanilla-cookieconsent's default `cookie.useLocalStorage` is `false` — it persists to a first-party cookie named `cc_cookie` by default [VERIFIED: cookieconsent.orestbida.com/reference/configuration-reference.html]. Browser `storage` events only fire for `localStorage`/`sessionStorage` mutations, never for cookie writes, and never fire in the same tab that made the change anyway. A `storage`-event listener would silently never fire for same-tab preference changes — exactly the case success criterion 2 needs ("take effect on the current page without a reload").

**Example:**
```typescript
// Source: cookieconsent.orestbida.com/reference/api-reference.html (onChange signature)
//         + cookieconsent.orestbida.com/reference/configuration-reference.html (cookie storage default)
// src/utils/consent.ts
type ConsentListener = () => void;
const listeners = new Set<ConsentListener>();
let analyticsAccepted = false;

export function setAnalyticsConsent(accepted: boolean) {
  analyticsAccepted = accepted;
  listeners.forEach((l) => l());
}
export function subscribeConsent(listener: ConsentListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getAnalyticsConsentSnapshot() {
  return analyticsAccepted;
}

// src/hooks/useConsent.ts
import { useSyncExternalStore } from 'react';
import { subscribeConsent, getAnalyticsConsentSnapshot } from '../utils/consent';

export function useAnalyticsConsent(): boolean {
  return useSyncExternalStore(subscribeConsent, getAnalyticsConsentSnapshot);
}
```

```typescript
// src/components/consent/CookieConsentManager.tsx
import { useEffect } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { setAnalyticsConsent } from '../../utils/consent';

export function CookieConsentManager() {
  useEffect(() => {
    CookieConsent.run({
      mode: 'opt-in', // GDPR requires opt-in, not opt-out, for EU visitors
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: { enabled: false },
      },
      guiOptions: {
        consentModal: {
          layout: 'bar inline',      // non-blocking bottom bar, never a wall
          position: 'bottom',
          equalWeightButtons: true,  // library default — DO NOT override to false (C-04)
        },
        preferencesModal: { layout: 'box', position: 'right' },
      },
      onFirstConsent: ({ cookie }) => setAnalyticsConsent(!!cookie.categories?.includes('analytics')),
      onConsent: ({ cookie }) => setAnalyticsConsent(!!cookie.categories?.includes('analytics')),
      onChange: ({ cookie }) => setAnalyticsConsent(!!cookie.categories?.includes('analytics')),
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'We use cookies',
              description: 'We use analytics cookies to understand how 3DCoster is used. Your calculator data always stays on your device.',
              acceptAllBtn: 'Accept All',
              acceptNecessaryBtn: 'Reject All',
              showPreferencesBtn: 'Manage preferences',
            },
            preferencesModal: {
              title: 'Cookie preferences',
              acceptAllBtn: 'Accept All',
              acceptNecessaryBtn: 'Reject All',
              savePreferencesBtn: 'Save preferences',
              sections: [
                { title: 'Strictly necessary', description: 'Required for the consent banner itself.', linkedCategory: 'necessary' },
                { title: 'Analytics', description: 'Vercel Web Analytics — aggregate, no cross-site tracking.', linkedCategory: 'analytics' },
              ],
            },
          },
        },
      },
    });
  }, []);
  return null;
}
```

### Pattern 2: `AnalyticsGate` with explicit revoke cleanup

**What:** A component that conditionally mounts `<Analytics />` based on consent, AND actively tears down the script/globals on revoke — because unmounting alone does not undo what `inject()` already did.

**When to use:** Whenever a third-party analytics/tracking component's injection is a one-way `useEffect` side effect (true of `@vercel/analytics/react` 1.6.1, verified by reading `node_modules/@vercel/analytics/dist/react/index.mjs`).

**Why this matters (verified by reading source, not docs):** `Analytics()`'s `useEffect(() => inject({...}), [])` only runs once, on mount. `inject()` appends a `<script src="/_vercel/insights/script.js">` to `document.head` and calls `initQueue()`, which sets `window.va = function(...) { (window.vaq = window.vaq || []).push(params) }`. Unmounting the React component does not remove that script tag or reset `window.va`/`window.vaq`/`window.vam`. If the app calls `pageview()` on route changes (which requires reading `window.va`), a revoked-but-not-cleaned-up session would still queue analytics events. The gate must remove the script element and delete the globals on revoke to make revocation actually effective without a reload.

**Example:**
```tsx
// Source: node_modules/@vercel/analytics/dist/react/index.mjs (read directly — verified 2026-07-09)
// src/components/consent/AnalyticsGate.tsx
import { Analytics } from '@vercel/analytics/react';
import { useAnalyticsConsent } from '../../hooks/useConsent';
import { useEffect, useRef } from 'react';

export function AnalyticsGate() {
  const hasConsent = useAnalyticsConsent();
  const wasMounted = useRef(false);

  useEffect(() => {
    if (hasConsent) {
      wasMounted.current = true;
      return;
    }
    // Revoked after having been mounted — inject() left artifacts behind.
    // Strip them so a same-page revoke is actually effective (no reload).
    if (wasMounted.current) {
      document.head.querySelectorAll('script[src*="insights/script.js"]').forEach((el) => el.remove());
      delete (window as Window & { va?: unknown }).va;
      delete (window as Window & { vaq?: unknown }).vaq;
      delete (window as Window & { vam?: unknown }).vam;
      wasMounted.current = false;
    }
  }, [hasConsent]);

  return hasConsent ? <Analytics /> : null;
}
```

```tsx
// src/main.tsx — replaces the current bare `<Analytics />` (D-03/D-04)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
      {!__IS_TAURI__ && <CookieConsentManager />}
    </ErrorBoundary>
    {!__IS_TAURI__ && <AnalyticsGate />}
  </StrictMode>,
)
```

### Pattern 3: Onboarding step advance keyed to real Dexie writes, not form submit

**What:** Each wizard step listens for the ACTUAL data write (via the already-subscribed `useAssets`/`usePrinters` etc. hooks reacting to a live Dexie query) rather than intercepting the form's submit handler. This guarantees the step only advances when data genuinely landed in IndexedDB — matching D-09 ("navigates to the real tab... advances when the real action completes").

**When to use:** Any wizard step whose "success" criterion is "a real record now exists," to avoid a class of bugs where the step advances on click but the underlying save silently failed validation.

**Example:**
```tsx
// src/hooks/onboarding/useOnboarding.ts (sketch — Claude's Discretion per CONTEXT.md
// for exact component structure; this shows the state-flow shape only)
import { useUserProfile } from '../useDatabase';

export function useOnboarding() {
  const { profile, updateProfile } = useUserProfile();

  const advanceStep = async (nextStep: number) => {
    await updateProfile({ ...profile, onboardingStep: nextStep });
  };
  const complete = async () => {
    await updateProfile({ ...profile, onboardingCompletedAt: new Date().toISOString() });
  };
  const skip = () => complete(); // Skip = complete immediately, never re-shown (M-01)

  return {
    step: profile.onboardingStep,
    isDone: !!profile.onboardingCompletedAt,
    advanceStep,
    complete,
    skip,
  };
}
```

### Anti-Patterns to Avoid

- **Overriding `equalWeightButtons: false` for design reasons:** This is the exact CNIL/Honda-fine pattern documented in PITFALLS.md C-04. The library defaults to compliant; a "make Accept stand out more" design request must be pushed back on.
- **Gating `<Analytics />` with a CSS `display: none` wrapper instead of not rendering it:** CSS hiding does not stop the `useEffect` from firing — the script still loads and the beacon still fires. Must be a conditional *render*, not a conditional *style*.
- **Storing `onboardingStep` in `localStorage`:** Documented project pitfall M-01 — `localStorage` and IndexedDB clear independently; a returning user who clears storage but not IndexedDB would see the wizard try to re-seed a printer that already exists. `UserProfile.onboardingStep` in Dexie is the only correct home.
- **Building a second, simplified "quick add printer" form for the wizard:** D-09 explicitly rejects duplicate mini-forms. Navigate to the real Settings/Printers tab and let the existing add-printer flow do the work; the wizard's job is navigation + progress tracking, not data entry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GDPR-compliant consent banner | Custom modal + localStorage flag | `vanilla-cookieconsent` v3 | Getting equal-weight buttons, granular categories, re-consent on cookie expiry, and accessibility (focus trap, ARIA) all correct is a multi-week effort the library already solved; REQUIREMENTS.md locks this choice explicitly |
| Cross-component consent-state sync without reload | Polling `document.cookie` on an interval, or a custom Context re-rendered by a timer | `useSyncExternalStore` fed by the library's own `onChange`/`onConsent` callbacks | Polling is wasteful and laggy; the library already tells you exactly when state changes via callback — no polling needed |
| E2E network-assertion test | A manual QA checklist item ("open DevTools, check Network tab") as the *only* verification | Playwright's `page.on('request', ...)` assertion | D-14 explicitly requires an *automated* test as well as the manual production check — manual-only verification regresses silently on the next dependency bump |

**Key insight:** Every piece of this phase that touches compliance (consent parity, revocation effectiveness, data-flow accuracy) has a documented real-world enforcement precedent (CNIL €150M+€200M vs Google, Honda $632,500, SHEIN €150M — all in PITFALLS.md C-04/C-05). This is not a domain where "close enough" custom code is acceptable — use the audited library and verify its defaults rather than reconfiguring them away.

## Common Pitfalls

### Pitfall 1: Vercel Analytics revoke doesn't actually stop tracking without explicit cleanup

**What goes wrong:** A naive `{hasConsent && <Analytics />}` gate correctly prevents the FIRST injection, but if a user accepts, then later revokes via the preferences modal, unmounting `<Analytics />` leaves the already-injected `<script>` tag and `window.va`/`window.vaq` globals in place. Any code path that still calls `window.va('pageview', ...)` (e.g., a route-change tracker) continues to queue analytics events even though the UI shows the user as opted out.

**Why it happens:** `inject()` in `@vercel/analytics`'s source (verified by reading `node_modules/@vercel/analytics/dist/react/index.mjs`) is a one-way DOM mutation with no corresponding cleanup function returned from the `useEffect`. React's unmount lifecycle only stops running the component's *own* code — it does not know to reverse the side effect.

**How to avoid:** `AnalyticsGate` must explicitly remove `script[src*="insights/script.js"]` from `document.head` and `delete window.va`/`window.vaq`/`window.vam` on transition from consented → revoked (see Code Examples, Pattern 2).

**Warning signs:** DevTools Network tab still shows POST requests to `/_vercel/insights/view` after clicking "Reject All" in the preferences modal during a manual re-test; `window.va` is still defined in the console after revoking.

### Pitfall 2: Data-flow inventory undercounts actual processors

**What goes wrong:** CONTEXT.md names three processors (Vercel, Supabase, FX API) for the Privacy Policy. The actual `connect-src` allowlist in `vercel.json` — the enforced, authoritative list of every external domain this app can reach — is longer: `api.github.com` (release-check calls from `UpdateBanner`/desktop update flow), `cdn.jsdelivr.net` (announcement banner JSON per project memory), `latest.currency-api.pages.dev` + `api.frankfurter.dev` (the two FX providers, not one), and `formspree.io` (the feedback form, which can include a user-entered reply-to email — PII). Supabase is not yet in this list because Phase 43 hasn't shipped; the CSP will need a `connect-src` addition when it does.

**Why it happens:** The mental model "we send data to Vercel and Supabase" is the backend-centric view; the actual GDPR-relevant surface is every external HTTP destination the client can reach, which is broader and captured precisely in the CSP config.

**How to avoid:** Generate the `docs/DATA-FLOW-INVENTORY.md` (D-08) by walking the `connect-src` list in `vercel.json` line by line, plus any lazy-loaded API call not covered by CSP (there shouldn't be any — CSP would block them). Cross-check against `grep -rn "fetch(\|axios\|XMLHttpRequest" src/` to catch anything not yet reflected in the CSP.

**Warning signs:** A new `fetch()` call to a domain not in `connect-src` would be silently blocked by the browser in production (CSP violation) — this is actually a built-in safety net, but it means CSP violations in the browser console during dev/testing are a signal the inventory (and the CSP itself) needs updating.

### Pitfall 3: "Settings tab" is ambiguous in this codebase — two different UI surfaces share the name

**What goes wrong:** D-02 says the in-app Cookie settings entry goes in "the calculator's... Settings tab." The codebase has two distinct things that could be meant: (1) the URL-routed `?tab=settings` tab in `App.tsx`, which renders `<PrinterSettings />` (printer-specific settings only), and (2) the gear-icon-triggered `<SettingsModal />` (a `SidePanel`), which holds currency, electricity/TOU, shipping, marketplace fees, and general `UserProfile` fields — this is the app's actual "general settings" surface.

**Why it happens:** The name "Settings" is used informally for both; only one of them is the semantically correct home for a global preference like cookie consent (which has nothing to do with printers).

**How to avoid:** Place the Cookie settings entry inside `<SettingsModal />` (the gear-icon modal), not the `?tab=settings` printer tab — it groups with other cross-cutting `UserProfile`-level preferences (currency, tax rate, etc.), matching its existing content. Flag this explicitly for user confirmation during planning since D-02's wording is genuinely ambiguous between the two.

**Warning signs:** A user reports they can't find "Cookie settings" — check whether it landed in the printer-only tab instead of the general settings modal.

### Pitfall 4: FAQ page's existing "no data collection" claim contradicts GDPR-02 once shipped

**What goes wrong:** `src/pages/FAQPage.tsx` currently states: *"Is 3DCoster really free? Yes, completely free and open source... no ads, no premium tiers, no data collection."* This is already slightly inaccurate today (Vercel Analytics is active) and will be more clearly inaccurate once the consent banner and Privacy Policy ship and explicitly describe analytics collection. An EU visitor who reads the FAQ and then sees a cookie banner has a direct, visible contradiction on the same site.

**Why it happens:** The FAQ was written before Vercel Analytics existed and was never revisited (the exact drift pattern PITFALLS.md C-05 warns about, just on a marketing page instead of a legal page).

**How to avoid:** Update this specific FAQ answer as part of this phase (or flag it as an explicit task) to say something accurate like "no account required, and your project data never leaves your device — see our Privacy Policy for what limited analytics we collect." This is a small, low-risk copy fix but should not be silently missed since it directly undermines the credibility of the new Privacy Policy page.

**Warning signs:** A line-by-line CONTEXT.md D-05 user review of the Privacy Policy would likely catch this only if the reviewer also re-reads the FAQ — worth calling out explicitly in the plan so it isn't missed.

### Pitfall 5 (inherited from milestone PITFALLS.md, re-verified for this phase): Consent banner CSS override accidentally breaks equal-weight buttons (C-04)

**What goes wrong:** D-01 requires a full custom theme via CSS variables to match the slate-900/blue-600 design system. It is easy for a custom `--cc-btn-primary-bg` / `--cc-btn-secondary-bg` pairing to end up with different button sizes, weights, or prominence than the library's default equal-weight layout — especially if "Accept" gets a filled/solid treatment and "Reject" gets an outline/ghost treatment (a common design-system default that would recreate the C-04 violation via styling rather than config).

**How to avoid:** When theming, keep `.cc-btn.cc-btn-primary` (Accept) and `.cc-btn.cc-btn-secondary` (Reject/manage) — the classes vanilla-cookieconsent assigns based on `acceptAllBtn`/`acceptNecessaryBtn` translation keys with `equalWeightButtons: true` — visually matched: same padding, same font-weight, same border-radius, only a permissible hue/contrast difference. D-14's Playwright spec should assert this structurally (e.g., compare computed `font-weight` and bounding-box dimensions of both buttons), not just "both buttons exist."

## Code Examples

### Verified: `@vercel/analytics` beacon injection is `useEffect`-gated (source read, 2026-07-09)

```javascript
// Source: node_modules/@vercel/analytics/dist/react/index.mjs (v1.6.1, installed in this repo)
function Analytics(props) {
  useEffect(() => {
    inject({
      framework: props.framework || "react",
      basePath: props.basePath ?? getBasePath(),
      ...props,
    });
  }, []); // <- runs once, on mount. Not rendering <Analytics /> = never runs.
  return null;
}

// inject() from src/generic.ts (same package):
function inject(props) {
  if (!isBrowser()) return;
  initQueue(); // sets window.va = fn that pushes to window.vaq
  const src = getScriptSrc(props); // "/_vercel/insights/script.js" in prod
  if (document.head.querySelector(`script[src*="${src}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  script.defer = true;
  document.head.appendChild(script);
}
```

This is the concrete, verified evidence that a conditional-render `AnalyticsGate` (not a script-blocker, not a CSP trick) is sufficient to satisfy "zero analytics requests before consent" — and equally, why unmounting alone is insufficient for revocation (see Pitfall 1).

### Verified: vanilla-cookieconsent v3 config schema (fetched from official docs, 2026-07-09)

```javascript
// Source: https://cookieconsent.orestbida.com/reference/configuration-reference.html
CookieConsent.run({
  mode: 'opt-in',              // REQUIRED for EU — opt-out mode pre-checks analytics
  cookie: {
    name: 'cc_cookie',         // default; first-party cookie, NOT localStorage by default
    expiresAfterDays: 182,     // default 6 months — Claude's Discretion to change
  },
  categories: {
    necessary: { enabled: true, readOnly: true },
    analytics: { enabled: false },
  },
  guiOptions: {
    consentModal: {
      layout: 'box',                // or 'bar', 'cloud' — non-blocking, never a wall
      equalWeightButtons: true,     // DEFAULT — the C-04 compliance requirement
    },
  },
  onFirstConsent: ({ cookie }) => { /* first-ever decision */ },
  onConsent: ({ cookie }) => { /* fires on every page load once consent exists */ },
  onChange: ({ cookie, changedCategories, changedPreferences }) => { /* revocation */ },
});
```

### Verified: showing the preferences modal from a Footer link or Settings entry

```html
<!-- Source: https://cookieconsent.orestbida.com/essential/getting-started.html
     Declarative attribute form — works without importing the CookieConsent module -->
<button type="button" data-cc="show-preferencesModal">Cookie settings</button>
```

```typescript
// Programmatic form — use this in React so the click handler is type-checked
// and consistent with the rest of the codebase's event-handler style.
// Source: https://cookieconsent.orestbida.com/reference/api-reference.html
import * as CookieConsent from 'vanilla-cookieconsent';
<button onClick={() => CookieConsent.showPreferences()}>Cookie settings</button>
```

### Verified: `UserProfile` needs no Dexie migration for onboarding fields

```typescript
// src/types.ts (existing, read 2026-07-09) — UserProfile is a plain interface
// persisted as JSON under db.settings key 'userProfile'. Comparable optional
// fields already added this way for Phase 41 (taxJurisdiction, etc.) with
// "no Dexie version bump" comments — the same pattern applies here:
export interface UserProfile {
  // ...existing fields (currency, laborHourlyRate, address, taxJurisdiction, etc.)

  // Phase 42 ONBD-01: first-run onboarding wizard state. Optional,
  // non-indexed, no Dexie version bump (DB is at v12, JSON-in-settings).
  onboardingStep?: number;          // 0 = printer, 1 = filament, 2 = price-a-job
  onboardingCompletedAt?: string;   // ISO date; if present, wizard never shows
}
```

```typescript
// src/hooks/useDatabase.ts (existing, read 2026-07-09) — the correct read/write
// surface. NOTE: the exported updater function is named `updateProfile`,
// NOT `updateUserProfile` as the milestone ARCHITECTURE.md sketch names it.
export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);
  // ...
  const updateProfile = useCallback(async (value: UserProfile) => {
    setProfileState(value);
    await setUserProfile(value);
  }, []);
  return { profile, updateProfile, isLoading };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| "Accept + link to settings" consent banners | Equal-weight Accept/Reject on the first layer, one click each | Enforcement ramped sharply in 2025 (CNIL €150M + €200M vs Google, SHEIN €150M, Honda $632,500 — all cited in PITFALLS.md) | The old pattern is not just "less good UX," it is actively fined at scale in 2025–2026; vanilla-cookieconsent v3's `equalWeightButtons: true` default reflects this shift |
| localStorage-only consent persistence | First-party cookie (`cc_cookie`) by default in vanilla-cookieconsent v3, with an opt-in `cookie.useLocalStorage` flag | Library's v3 rewrite (per STACK.md, addressed ESM/framework integration issues from v2) | Directly affects the sync pattern chosen in this research — `storage` events are not a viable cross-tab/same-tab sync mechanism for the default config |

**Deprecated/outdated:** The milestone `ARCHITECTURE.md` §6 sketch's `storage`-event-based `useConsent` hook is superseded by the `useSyncExternalStore` + callback pattern documented above, once the actual default persistence mechanism (cookie, not localStorage) was verified against the official docs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The gz bundle size vanilla-cookieconsent adds to the production build is "~7 KB" as STACK.md originally estimated | Standard Stack | If actually larger, could threaten the 300 KB main-chunk gate (`scripts/assert-bundle-size.mjs`, MAX 307200 bytes) combined with existing app code — low risk given the app is well under budget today, but the plan should run `npm run build` after adding the dependency and read the actual gzipped size rather than trusting this estimate |
| A2 | "Settings tab" in D-02 means the gear-icon `<SettingsModal />`, not the `?tab=settings` `<PrinterSettings />` route | Pitfall 3 / Architecture | If the planner picks the wrong surface, the Cookie settings entry could land somewhere a user wouldn't expect (a printer-specific tab) — low severity (easily moved), but worth explicit confirmation before implementation since it affects which file gets edited |
| A3 | The FAQ page copy fix (Pitfall 4) is in scope for this phase rather than a separate cleanup | Pitfall 4 | If out of scope, ship with a minor, low-severity content inconsistency between FAQ and the new Privacy Policy — not a legal risk (FAQ is not the legal document) but worth a one-line planning decision either way |

**If this table is empty:** N/A — see rows above. All library/API/source-code claims in this document were verified via `npm view`, official docs fetches, the `gsd-tools package-legitimacy check` seam, or by directly reading installed source files — none are marked `[ASSUMED]` for library behavior. The three items above are project-specific interpretive calls, not unverified technical facts.

## Open Questions

1. **Which UI surface is "the calculator's Settings tab" for the Cookie settings entry (D-02)?**
   - What we know: Two candidate surfaces exist in the code — the `?tab=settings` route (renders `PrinterSettings`) and the gear-icon `SettingsModal` (renders currency/electricity/shipping/profile settings).
   - What's unclear: CONTEXT.md's wording doesn't disambiguate; both are plausible readings of "Settings."
   - Recommendation: Default to `SettingsModal` (Pitfall 3 rationale) but confirm with the user before implementation — a one-line clarifying question, not a blocking research gap.

2. **Does the D-08 data-flow inventory need to include GitHub API (release checks) and Formspree (feedback), or does CONTEXT.md's "Vercel, Supabase, FX API" list intentionally scope the Privacy Policy narrower for this phase?**
   - What we know: The actual CSP `connect-src` includes 5 external destinations today, not 3.
   - What's unclear: Whether CONTEXT.md's shorter list was a deliberate simplification (Supabase isn't even live yet — it's future-looking) or an incomplete enumeration.
   - Recommendation: Include all `connect-src` destinations in the inventory — GDPR's accountability principle (PITFALLS.md C-05) requires the policy to match actual processing, and Formspree in particular collects user-entered PII (feedback + optional reply email), which is squarely in scope for a privacy policy regardless of how CONTEXT.md phrased the summary.

3. **Should the Playwright E2E harness live at the repo root (`e2e/`, `playwright.config.ts`) or under `src/`?**
   - What we know: Vitest's `include` glob is scoped to `src/**/*.test.ts(x)`; Playwright specs are a different test runner with a different invocation (`playwright test`, not `vitest run`) and would be accidentally picked up by neither `vitest run` nor by the `lint:no-raw-html` script if placed correctly outside `src/`.
   - What's unclear: Nothing technical — this is a project convention choice, not a research gap.
   - Recommendation: Root-level `e2e/` directory, matching common Playwright project convention and keeping it clearly separate from the Vitest unit-test suite; add `npm run test:e2e` script.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | All new deps | ✓ (project already builds) | — | — |
| `vanilla-cookieconsent` | GDPR-01 | ✗ (not yet installed) | Install `3.1.0` | None needed — install is the task |
| `@playwright/test` | D-14 gate spec | ✗ (not yet installed, first E2E tool in repo) | Install `1.61.1` | None — `checkpoint:human-verify` per SUS flag, then install |
| Playwright browser binaries (Chromium) | D-14 gate spec | ✗ (not yet installed) | `npx playwright install chromium` | Minimal — only Chromium needed for a scoped consent-gate spec, not the full 3-browser matrix |
| Vite preview server on :4173 | Playwright `webServer` target | ✓ (port already pinned in `vite.config.ts`) | — | — |
| `privacy@3dcoster.com` email alias | GDPR-02 contact field | ✗ (D-07 flags this as a human prerequisite) | — | Ship with the alias documented as a pre-launch checklist item; do not block code from being written, but the alias must exist before the page goes live in production (D-13 gate) |

**Missing dependencies with no fallback:**
- `privacy@3dcoster.com` forwarding must be set up by the user before production deploy (D-07) — this is a human action, not something the plan can automate.

**Missing dependencies with fallback:**
- None of the npm packages have a fallback need — both are the correct, already-locked choices; "fallback" here is simply "install them," which is in scope for the phase's own tasks.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (existing, `jsdom` environment) + `@playwright/test` 1.61.1 (new, D-14 only) |
| Config file | `vitest.config.ts` (existing) + `playwright.config.ts` (new — Wave 0) |
| Quick run command | `npm test` (Vitest, existing) |
| Full suite command | `npm run build` (runs `vitest run --coverage && tsc -b && vite build && ...` gates, existing) — Playwright is a separate invocation: `npx playwright test` |

Note: `vitest.config.ts`'s `coverage.include` is scoped to exactly `['src/utils/costCalc.ts', 'src/hooks/useCostDerivedValues.ts']` with 95/100/90 thresholds — none of this phase's new files fall under that coverage gate, so no coverage-threshold work is required for consent/onboarding/legal-page code, though ordinary unit tests are still expected per project convention.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GDPR-01 | Accept All / Reject All equal visual weight, one-click reject, zero analytics network requests pre-consent | e2e | `npx playwright test e2e/consent-gate.spec.ts` | ❌ Wave 0 |
| GDPR-01 | Revocation via preferences modal updates state without reload | unit/component | `npx vitest run src/hooks/useConsent.test.ts` | ❌ Wave 0 |
| GDPR-01 | `AnalyticsGate` does not render `<Analytics />` before consent; strips script + globals on revoke | unit/component | `npx vitest run src/components/consent/AnalyticsGate.test.tsx` | ❌ Wave 0 |
| GDPR-01 | Tauri build renders no consent banner and no Analytics | unit (compile-time define check) | Existing `__IS_TAURI__`-gated component pattern — assert via a build-mode test or a direct `!__IS_TAURI__ &&` code-read check | ❌ Wave 0 (new test) |
| GDPR-02 | Privacy Policy page renders at `/privacy`, names all processors from the data-flow inventory | component | `npx vitest run src/pages/PrivacyPage.test.tsx` | ❌ Wave 0 |
| GDPR-03 | Terms of Service page renders at `/terms` | component | `npx vitest run src/pages/TermsPage.test.tsx` | ❌ Wave 0 |
| ONBD-01 | Wizard auto-skips when a printer already exists | unit | `npx vitest run src/components/onboarding/useOnboarding.test.ts` | ❌ Wave 0 |
| ONBD-01 | Skip button present and functional on every step; persists via Dexie, not localStorage | unit/component | `npx vitest run src/components/onboarding/OnboardingOverlay.test.tsx` | ❌ Wave 0 |
| ONBD-01 | Wizard resumes from `onboardingStep` on reload | unit | Same file as above | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (Vitest quick run — existing pattern)
- **Per wave merge:** `npm run build` (full existing gate chain) + `npx playwright test` (new, scoped to `e2e/consent-gate.spec.ts` only)
- **Phase gate:** Full suite green before `/gsd-verify-work`; PLUS the D-13/D-14 manual production DevTools network check after the single production deploy — this manual step cannot be automated away and is explicitly required by the locked decisions, not optional.

### Wave 0 Gaps

- [ ] `playwright.config.ts` — Wave 0: `webServer: { command: 'npm run preview', port: 4173, reuseExistingServer: !process.env.CI }`, `use: { baseURL: 'http://localhost:4173' }`, `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]` only (minimal scope per D-14)
- [ ] `e2e/consent-gate.spec.ts` — covers GDPR-01 network-assertion + one-click-reject + equal-weight-button assertions
- [ ] `src/hooks/useConsent.test.ts` — covers the `useSyncExternalStore` consent hook
- [ ] `src/components/consent/AnalyticsGate.test.tsx` — covers mount-gating and revoke cleanup
- [ ] `src/pages/PrivacyPage.test.tsx`, `src/pages/TermsPage.test.tsx` — smoke-test rendering, following the pattern of existing marketing-page tests (check `src/pages/*.test.tsx` for the closest existing analog, e.g. `FAQPage` if a test exists — verify at plan time)
- [ ] `src/components/onboarding/*.test.tsx` — covers auto-skip, resume, and skip-persistence
- [ ] Framework install: `npm install -D @playwright/test@1.61.1 && npx playwright install chromium` (gated behind the SUS `checkpoint:human-verify`, see Package Legitimacy Audit)
- [ ] `package.json` script addition: `"test:e2e": "playwright test"`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase has no auth — Pro accounts arrive in Phase 43 |
| V3 Session Management | Partial — consent state IS session-like | vanilla-cookieconsent's own cookie (`cc_cookie`, `Secure`, `SameSite: Lax` by default per docs) — do not weaken these cookie flags |
| V4 Access Control | No | No new protected resources |
| V5 Input Validation | Yes — feedback form (existing) unaffected, but any new user-facing text (banner copy, legal page copy) is static/developer-authored, not user input | N/A — no new user input surfaces in this phase |
| V6 Cryptography | No | No new crypto surfaces |
| V14 Configuration | Yes | `vercel.json` CSP must be re-verified after adding `vanilla-cookieconsent` (confirmed: no CSP change needed — the library ships all JS/CSS bundled into the app's own same-origin build, makes zero external network requests itself) and again when Phase 43 adds Supabase's domain to `connect-src` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Consent banner that appears compliant but silently continues tracking (dark pattern / non-compliance) | Repudiation (user can dispute "I never consented") | Verified `equalWeightButtons: true` default + `AnalyticsGate`'s explicit revoke cleanup (Pitfall 1) — both are mitigations already designed into this research |
| Privacy Policy under-disclosing actual data flows | Information Disclosure (indirect — a compliance/legal exposure, not a technical one) | Data-flow inventory sourced from the enforced `connect-src` CSP allowlist (Pitfall 2), not from memory or a template |
| XSS via legal page content if any inventory data is ever rendered from an untrusted source | Tampering | N/A for this phase — Privacy/Terms page content is 100% developer-authored static JSX, no `dangerouslySetInnerHTML`, no user-supplied content rendered on these pages |

## Sources

### Primary (HIGH confidence)
- `npm view vanilla-cookieconsent version` / `time.modified` / `versions` / `scripts.postinstall` — executed 2026-07-09, confirms 3.1.0 current, published 2025-02-04, no postinstall
- `npm view @playwright/test version` / `time.modified` — executed 2026-07-09, confirms 1.61.1 current, published 2026-06-23
- `gsd-tools query package-legitimacy check --ecosystem npm vanilla-cookieconsent @playwright/test` — executed 2026-07-09, OK / SUS verdicts with signals
- https://cookieconsent.orestbida.com/reference/configuration-reference.html — fetched 2026-07-09, full config schema (categories, guiOptions, cookie, callbacks, language/translations)
- https://cookieconsent.orestbida.com/reference/api-reference.html — fetched 2026-07-09, `run`/`show`/`showPreferences`/`acceptCategory`/`acceptedCategory` method signatures
- https://cookieconsent.orestbida.com/advanced/ui-customization.html — fetched 2026-07-09, CSS variable theming (`#cc-main` selector, `--cc-btn-primary-bg` etc.)
- https://cookieconsent.orestbida.com/essential/getting-started.html — fetched 2026-07-09, React `useEffect` mount pattern, `data-cc="show-preferencesModal"` attribute
- `node_modules/@vercel/analytics/dist/react/index.mjs` (installed v1.6.1) — read directly 2026-07-09, confirms `useEffect(() => inject(...), [])` mount-only injection, no unmount cleanup
- `node_modules/@vercel/analytics/dist/react/index.mjs` `inject()`/`initQueue()` internals — read directly 2026-07-09, confirms `window.va`/`window.vaq` global side effects
- `vercel.json` (this repo) — read directly 2026-07-09, actual CSP `connect-src` allowlist (5 destinations, not 3)
- `vite.config.ts` (this repo) — read directly 2026-07-09, confirms `__IS_TAURI__` compile-time define and port 4173
- `scripts/assert-bundle-size.mjs` (this repo) — read directly 2026-07-09, confirms 300 KB / 307200-byte gzipped main-chunk gate
- `vitest.config.ts` (this repo) — read directly 2026-07-09, confirms coverage scope excludes new phase-42 files
- `src/types.ts`, `src/hooks/useDatabase.ts`, `src/App.tsx`, `src/main.tsx`, `src/components/Footer.tsx`, `src/components/SettingsModal.tsx`, `src/components/PwaUpdatePrompt.tsx`, `src/data/defaultMaterials.ts`, `src/components/ui/toast/*`, `src/pages/FAQPage.tsx` (this repo) — all read directly 2026-07-09

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` Area 3, `.planning/research/PITFALLS.md` C-04/C-05/M-01, `.planning/research/FEATURES.md` §7/§10, `.planning/research/ARCHITECTURE.md` §6/§7 — milestone-level research from 2026-07-03, re-verified and in several places superseded by this phase's deeper source-level checks (noted explicitly where superseded)

### Tertiary (LOW confidence)
- None — all claims in this document trace to a tool-verified or directly-read source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both package versions confirmed live against npm registry; legitimacy checker run; no ASSUMED package names
- Architecture: HIGH — every pattern in this document is backed by either an official-docs fetch or a direct read of installed source/repo code, not training-data recall
- Pitfalls: HIGH for the two source-verified findings (Analytics revoke cleanup, data-flow inventory gap); HIGH for the milestone-inherited pitfalls (C-04/C-05/M-01, each with real enforcement-record citations already vetted in PITFALLS.md)

**Research date:** 2026-07-09
**Valid until:** 30 days (2026-08-08) for the architecture/pattern guidance; re-verify `@playwright/test` and `vanilla-cookieconsent` versions at plan time if this research is reused after that window, given Playwright's fast release cadence
