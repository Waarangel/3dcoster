---
phase: 45-brand-launch
plan: 03
subsystem: ui
tags: [pricing, marketing-pages, react-router, design-tokens, regex-guard]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "01"
    provides: Cost-Truth Dark CSS custom-property token layer, MarketingThemeScope, Reveal motion primitive
  - phase: 45-brand-launch
    plan: "02"
    provides: Token-scoped Header (with a /pricing nav entry already wired) and Footer (with a Pricing link already wired)
  - phase: 43-pro-backend
    provides: BillingPanel.tsx locked Pro price labels (EUR 6.90/mo, EUR 69/yr) — the billing truth this plan surfaces
provides:
  - src/pricing.ts — single shared constant (MONTHLY_PRICE_LABEL, ANNUAL_PRICE_LABEL, PRO_PRICE_SUMMARY) for all 3 marketing pricing spots
  - PricingPage component + /pricing route — Spot 1 of the 3 Pro-pricing spots (D-06)
  - src/pages/PricingPage.test.tsx — regex-guard test locking marketing pricing to BillingPanel.tsx
affects: [45-04, 45-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pricing constant + regex-guard test (mirrors TermsPage.test.tsx's price-lock precedent) — every marketing pricing surface imports labels from src/pricing.ts instead of re-typing strings, and a test fails if BillingPanel.tsx's literals ever drift"

key-files:
  created:
    - src/pricing.ts
    - src/pages/PricingPage.tsx
    - src/pages/PricingPage.test.tsx
  modified:
    - src/main.tsx

key-decisions:
  - "TDD RED/GREEN followed literally for Task 1: PricingPage.test.tsx written first and confirmed failing (src/pricing.ts did not exist — import resolution error), then src/pricing.ts created to make it pass"
  - "Pro feature list on the page (hosted quote links, branded pages, live approve/decline) derived from the actual shipped Pro surface (usePublishedQuote/ProPitchModal), not invented copy — the only Pro-gated capability in the codebase today is hosted quote links, so the page's Pro column reflects exactly the free-floor/Pro-ceiling boundary that already ships"
  - "Free column feature list enumerates the actual free-floor capabilities shipped across v1.x/v2.0 phases (failure-rate/TOU/wear cost modeling, insights, sync, STL quote, inventory, desktop app) rather than a generic 'everything' claim, so the page substantiates the floor-and-ceiling story with specifics"
  - "Page built natively against the Cost-Truth Dark token system per the plan's action text — uses var(--brand)/var(--surface)/var(--hairline)/var(--ink) classes throughout (matching Header.tsx/Card.tsx conventions from 45-01/45-02), not the slate-gradient classes still on LandingPage/FeaturesPage (those get ported in 45-04/45-05)"
  - "Used the Reveal motion primitive (mount trigger on hero, inView trigger on the two pricing cards) since this is the first NEW page built directly in the brand system rather than a ported/restyled existing page — matches docs/DESIGN.md's reveal-on-scroll guidance for brand surfaces"

patterns-established:
  - "Any future marketing page needing Pro price text imports MONTHLY_PRICE_LABEL/ANNUAL_PRICE_LABEL/PRO_PRICE_SUMMARY from src/pricing.ts — 45-04 (landing teaser) and 45-05 (features Pro column) should do the same, not re-type the strings"

requirements-completed: []

coverage:
  - id: D6-pricing-constant
    description: "src/pricing.ts exports MONTHLY_PRICE_LABEL='EUR 6.90' / ANNUAL_PRICE_LABEL='EUR 69', guarded against BillingPanel.tsx drift"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "npx vitest run src/pages/PricingPage.test.tsx — 3 passed (labels match, BillingPanel.tsx byte-match, cross-file literal containment)"
        status: pass
    human_judgment: false
  - id: D6-pricing-page
    description: "/pricing page renders Free ('everything, forever') vs Pro (EUR 6.90/mo, EUR 69/yr, early-supporter framing) columns; Pro CTA routes to /app only; no sign-in/checkout/urgency widget"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "npm run build green (main chunk 101.0 KB gz, under 300 KB gate); grep confirms /pricing route in main.tsx and pricing import in PricingPage.tsx"
        status: pass
      - kind: automated_ui
        ref: "Headless Playwright screenshots at 1280x1600 and 375x900 (both normal and reducedMotion) confirm: Free column lists 8 free-floor features, Pro column shows EUR 6.90/mo + EUR 69/yr + 'Launch price — EUR 6.90/mo for early supporters', CTA reads 'Start free, upgrade in-app', no countdown/urgency element present; /app's --brand computed style still resolves #2563eb (slate-equivalent default), confirming the D-02 boundary holds"
        status: pass
    human_judgment: false
  - id: D6-a11y
    description: "PricingPage re-applies the project's Phase 37 a11y pattern (<main> landmark, aria-labelledby sections, aria-hidden decorative icons)"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "Source inspection: <main> wraps all 3 sections; each <section> has aria-labelledby pointing at its heading id (or aria-labelledby on an sr-only h2 for the plans section, which itself needs no visible heading); all decorative SVG checkmarks/glow blob carry aria-hidden=\"true\""
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 03: Pro-Pricing Spot 1 — /pricing Page Summary

**Created the single shared pricing constant (`src/pricing.ts`, mirrored and byte-guarded against `BillingPanel.tsx`) and built the native Cost-Truth Dark `/pricing` page — Free ("everything, forever") vs Pro (EUR 6.90/mo · EUR 69/yr, early-supporter framing) — with an in-app-only CTA and no urgency mechanics.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-20T13:19:51Z (STATE.md marker after 45-02)
- **Completed:** 2026-07-20T13:28:00Z
- **Tasks:** 2 (1 TDD + 1 auto)
- **Files modified:** 4 (2 created — `src/pricing.ts`, `PricingPage.tsx` — plus `PricingPage.test.tsx` and `main.tsx`)

## Accomplishments
- `src/pricing.ts` created as the single source of truth for the 3 marketing pricing spots (this page, 45-04's landing teaser, 45-05's features Pro column), exporting `MONTHLY_PRICE_LABEL`/`ANNUAL_PRICE_LABEL`/`PRO_PRICE_SUMMARY`
- `src/pages/PricingPage.test.tsx` written first (TDD RED — confirmed failing since `src/pricing.ts` didn't exist yet), then made to pass (GREEN) — mirrors the `TermsPage.test.tsx` regex-guard precedent, reading `BillingPanel.tsx`'s source and asserting both the raw literals and cross-file containment against `src/pricing.ts`'s exports
- `PricingPage.tsx` built natively in the Cost-Truth Dark token system (`var(--brand)`/`var(--surface)`/`var(--hairline)`/`var(--ink)` throughout, `Reveal` motion primitive for entrance) — a Free column enumerating the actual shipped free-floor capabilities and a Pro column showing the real price + early-supporter launch line + the actual shipped Pro feature (hosted, branded, live-approve quote links)
- Pro CTA is "Start free, upgrade in-app" linking to `/app` — no sign-in, checkout, or countdown/urgency widget anywhere on the page
- `/pricing` registered in `src/main.tsx` inside the `MarketingThemeScope` layout route, lazy-loaded via `lazyWithRetry` like every other marketing page
- Verified via headless Playwright screenshots (desktop 1280px, mobile 375px, both normal and `reducedMotion: 'reduce'`) that the page renders correctly at both breakpoints, and that `/app`'s `--brand` custom property still resolves to the slate-equivalent `#2563eb` default (D-02 boundary intact — this page's new content did not touch shared token definitions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared pricing constant + byte-match guard test** - `159dca5` (test) — TDD RED confirmed (import failure), then `src/pricing.ts` created and the same commit landed both files GREEN
2. **Task 2: Build the /pricing page and register the route** - `488a135` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/pricing.ts` - New. Exports `MONTHLY_PRICE_LABEL`/`ANNUAL_PRICE_LABEL`/`PRO_PRICE_SUMMARY`, mirroring `BillingPanel.tsx`'s locked values
- `src/pages/PricingPage.test.tsx` - New. Regex-guard test: asserts `src/pricing.ts` values, asserts `BillingPanel.tsx` still contains the raw price literals, asserts cross-file literal containment
- `src/pages/PricingPage.tsx` - New. Free/Pro column page built on the brand-dark token system, `<main>` + `aria-labelledby`/`aria-hidden` a11y pattern, Pro CTA to `/app`
- `src/main.tsx` - Added lazy `PricingPage` import and `/pricing` route inside the existing `MarketingLayout` (`MarketingThemeScope`) route group

## Decisions Made
See `key-decisions` in frontmatter. Most notable: the Pro feature list on the page was derived from the actual shipped Pro surface (`usePublishedQuote`/`ProPitchModal`'s existing "Share quote" pitch copy) rather than invented — the only Pro-gated capability in the codebase today is hosted quote links, so the page's Pro column states exactly what Pro currently does, nothing aspirational.

## Deviations from Plan

None — plan executed exactly as written. The plan named "FAQ block, etc." as Claude's-discretion page composition; a short "Why is the calculator free?" reassurance section was added (not a full FAQ) to reinforce the floor-and-ceiling narrative without duplicating the site's dedicated `/faq` page.

## Issues Encountered
None. The initial headless-Playwright `fullPage` screenshot at 375px showed an apparent gap where the Pro card should render — this was a `whileInView`/IntersectionObserver timing artifact of Playwright's full-page screenshot stitching (the observer hadn't fired for the below-fold Pro card yet), not a real layout bug. Confirmed by re-capturing with `reducedMotion: 'reduce'` (which makes `Reveal` skip the animation and render the final state instantly, per its own accessibility contract) — the Pro card renders correctly and the layout is intact.

## User Setup Required
None.

## Next Phase Readiness
- `src/pricing.ts` is live and ready for 45-04 (landing-page Pro teaser) and 45-05 (features-table Pro column) to import from directly.
- `/pricing` is live on `main`, reachable from both Header and Footer nav (already wired in 45-02).
- `PricingPage.test.tsx`'s regex guard will fail any future plan that lets `BillingPanel.tsx`'s price literals drift without updating `src/pricing.ts` in the same change.
- REQUIREMENTS.md `BRAND-01` checkbox intentionally left unmarked — spans all 11 plans in this phase, per 45-01/45-02's established precedent.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

All 3 created/modified files present on disk (`src/pricing.ts`, `src/pages/PricingPage.tsx`, `src/pages/PricingPage.test.tsx`) plus `src/main.tsx`'s diff confirmed via `git show`. Both commits (`159dca5`, `488a135`) confirmed present in `git log --oneline -5`.
