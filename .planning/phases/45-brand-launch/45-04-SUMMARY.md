---
phase: 45-brand-launch
plan: 04
subsystem: ui
tags: [landing-page, cost-truth-dark, a11y, pricing, motion]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "01"
    provides: Cost-Truth Dark CSS custom-property token layer, MarketingThemeScope, Reveal/CostReveal motion primitives
  - phase: 45-brand-launch
    plan: "02"
    provides: Token-scoped Header/Footer (brand-restyled, /pricing nav already wired)
  - phase: 45-brand-launch
    plan: "03"
    provides: src/pricing.ts (MONTHLY_PRICE_LABEL) and the live /pricing route
provides:
  - "Reconciled LandingPage.tsx — Cost-Truth Dark hero (CostReveal), feature bento, a new four-pillar 'What's new' section, CTA, and the D-07 Pro teaser"
affects: [45-05, 45-06, 45-07, 45-08, 45-09, 45-10, 45-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pillar naming convention reused verbatim from PricingPage.tsx's FREE_FEATURES copy ('File-based sync ... no account required', 'STL instant quote from a 3D file', 'Printer ROI ... insights') so the same v2.0 pillars read consistently across marketing surfaces"
    - "Pro-teaser card pattern: floor statement ('Free, forever') stated first, Pro price card second, single CTA to /pricing — the repeatable D-06/D-07/D-08 floor-then-ceiling layout this phase establishes"

key-files:
  created: []
  modified:
    - src/pages/LandingPage.tsx
    - .planning/phases/45-brand-launch/deferred-items.md

key-decisions:
  - "Added a dedicated 'What's new in 3DCoster' pillars section (4 cards: cost-truth engine, sync, STL instant quote, insights/printer-ROI) rather than only relying on the hero + bento to imply the pillars — D-11 says 'all four v2.0 pillars get headline billing,' and the hero's show-don't-tell demonstration alone doesn't name failure-rate/TOU/wear-amortization or the other three pillars in copy"
  - "Replaced the branch's CLOSING_FEATURE ('Free, no account, yours') with 'Works offline' in the small bento trio, to avoid duplicating the new pillars section's device-sync card with near-identical copy"
  - "Dropped the branch's entire 'Buy Me a Coffee' support section rather than restyling it — D-03 (one monetization voice at launch) and deferred-items.md both call this out; Footer.tsx's own donation link is untouched (out of scope, not in this plan's files_modified) and logged as still-open in deferred-items.md"
  - "Pro teaser (Task 2) placed as the last content section before Footer, after the main CTA — keeps the CTA singularly focused on 'try the app' and gives pricing its own distinct, floor-first section rather than crowding the CTA panel"
  - "Logged a pre-existing flaky test (src/components/calculator/outputEquivalence.test.tsx, unrelated file) to deferred-items.md rather than fixing it — confirmed via git stash that it times out identically on unmodified main under vitest's coverage run; out of scope per the scope-boundary rule"

patterns-established:
  - "Any future marketing page that needs to headline a shipped v2.0 feature can reuse the PillarCard/FeatureIcon pattern (icon + font-display heading + description, aria-hidden svg) established here"

requirements-completed: []

coverage:
  - id: D45-04-hero-a11y
    description: "LandingPage renders the CostReveal hero + Cost-Truth Dark styling and preserves Phase 37's <main> landmark, aria-labelledby sections, and aria-hidden decorative icons"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q '<main' src/pages/LandingPage.tsx && grep -q 'aria-labelledby' src/pages/LandingPage.tsx → LANDING_A11Y_OK; source inspection confirms every decorative <svg> (FeatureIcon, hero CTA arrow, hero-aura div) carries aria-hidden=\"true\", which the branch's originals lacked"
        status: pass
    human_judgment: false
  - id: D45-04-pillars
    description: "Sections name all four v2.0 pillars: cost-truth engine, device sync (no accounts), STL instant quote, insights/printer-ROI"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "Source inspection: PILLARS array in LandingPage.tsx has exactly 4 entries with the required titles/descriptions, rendered in a new aria-labelledby=\"pillars-heading\" section"
        status: pass
    human_judgment: false
  - id: D45-04-no-mtnearz
    description: "No docs/references mtnearz competitor image referenced on the landing page (D-14)"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q 'docs/references' src/pages/LandingPage.tsx → no match"
        status: pass
    human_judgment: false
  - id: D45-04-pro-teaser
    description: "LandingPage imports MONTHLY_PRICE_LABEL from src/pricing.ts and renders a 'Pro from EUR 6.90/mo' card linking to /pricing, leading with a free-forever statement, with no donation ask anywhere on the page"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q 'MONTHLY_PRICE_LABEL' src/pages/LandingPage.tsx && grep -q '/pricing' src/pages/LandingPage.tsx → TEASER_OK; grep -n 'buymeacoffee' src/pages/LandingPage.tsx → no match (only comment mentions of 'donation ask' as negation)"
        status: pass
    human_judgment: false
  - id: D45-04-build-green
    description: "npm run build's constituent gates (tsc -b, vite build, bundle-size assert, lint:no-raw-html) pass; full vitest suite green outside the known pre-existing flaky test"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "npx vitest run (no coverage) — 1412 passed, 4 skipped, 1 todo, 124/125 files passed"
        status: pass
      - kind: other
        ref: "npx tsc -b (clean), npx vite build (main chunk 101.5 KB gz, under 300 KB gate), node scripts/assert-bundle-size.mjs (pass), node scripts/lint-no-raw-html.mjs (pass) — all run independently and confirmed green"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 04: LandingPage Cost-Truth Dark Port + Pro Teaser Summary

**Ported LandingPage to the Cost-Truth Dark system (branch's animated CostReveal hero + feature bento), re-applied Phase 37's a11y hardening the branch had dropped, added a new four-pillar "What's new" section naming all shipped v2.0 features, dropped the donation-ask support section, and added the D-07 Pro teaser (free-forever floor + "Pro from EUR 6.90/mo" card linking to /pricing).**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-20T10:56:00Z (approx, following 45-09's completion)
- **Completed:** 2026-07-20T11:06:12Z
- **Tasks:** 2 (both auto)
- **Files modified:** 1 (`src/pages/LandingPage.tsx`), plus `deferred-items.md` (logging, not a plan artifact)

## Accomplishments
- Ported the branch's `test/design-skills-experiment` LandingPage redesign onto main: `var(--brand)`/`var(--surface)`/`var(--ink)` token styling throughout, the animated `CostReveal` hero card, `Reveal` motion choreography (mount-trigger hero, inView-trigger below-the-fold sections), and the varied bento feature grid — all rendering inside `MarketingThemeScope` via the existing marketing layout route (no per-page wrapper needed, following the `PricingPage.tsx` precedent from 45-03)
- Re-applied main's Phase 37 a11y hardening that the branch's older rewrite predates: a single `<main>` landmark wrapping all sections, `aria-labelledby` on every `<section>` (`hero-heading`, `features-heading`, `pillars-heading`, `cta-heading`, `pro-teaser-heading`), and `aria-hidden="true"` on every decorative SVG icon (the branch's `FeatureIcon` component and hero CTA arrow icon had none of this)
- Added a new "What's new in 3DCoster" section headlining all four v2.0 pillars per D-11, now that v2.0 secrecy expires at launch: cost-truth engine (failure-rate/TOU-electricity/wear-amortization, reinforcing the hero), sync across devices with no account, STL instant quote, and insights/printer-ROI — copy phrasing matches `PricingPage.tsx`'s `FREE_FEATURES` wording for cross-page consistency
- Dropped the branch's entire "Buy Me a Coffee" support section — D-03's "one monetization voice at launch" and `deferred-items.md`'s existing flag both called for this; `Footer.tsx`'s own donation link remains (out of scope for this plan, already logged)
- Added the D-07 landing Pro teaser: a compact card leading with "Free, forever" (the floor) then "Pro from EUR 6.90/mo" (the ceiling, `MONTHLY_PRICE_LABEL` imported from `src/pricing.ts`, never re-typed), linking to `/pricing`
- Verified `npm run build`'s constituent gates independently (since the full chain is currently blocked by a confirmed pre-existing, unrelated flaky test — see Deviations): `tsc -b` clean, `vite build` green (main chunk 101.5 KB gz, well under the 300 KB gate), `assert-bundle-size.mjs` and `lint-no-raw-html.mjs` both pass, and the full `npx vitest run` (no coverage) suite is green at 1412/1412 non-skipped tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the branch LandingPage redesign + re-apply main's a11y landmarks + name the four v2.0 pillars** - `3873b83` (feat)
2. **Task 2: Add the D-07 landing Pro teaser (free-forever + "Pro from EUR 6.90/mo" → /pricing)** - `40f6aee` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/pages/LandingPage.tsx` - Full port: Cost-Truth Dark hero/bento styling, a11y landmarks restored, new pillars section, donation section removed, Pro teaser added
- `.planning/phases/45-brand-launch/deferred-items.md` - Logged: (1) LandingPage's donation link is now removed (Footer.tsx's remains, still deferred), (2) a pre-existing flaky test unrelated to this plan, confirmed reproducible on unmodified main

## Decisions Made
See `key-decisions` in frontmatter. Most notable: adding a standalone four-pillar section (rather than relying solely on the hero + existing bento to imply the pillars) was judged necessary to literally satisfy D-11's "all four v2.0 pillars get headline billing" — the hero's show-don't-tell property covers the cost-truth engine implicitly, but sync/STL-quote/insights have no other section naming them plainly anywhere on the page.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written, with one additive decision (the pillars section) made under Claude's-discretion scope per the plan's own emphasis on D-11 pillar hierarchy, not a bug fix.

### Out-of-scope items logged (not fixed)

**1. Pre-existing flaky test — `src/components/calculator/outputEquivalence.test.tsx`**
- **Found during:** Task 1 build verification (`npm run build`)
- **Issue:** The test's single scenario-iteration case intermittently times out at the default 5000ms when run inside the full coverage suite, but passes reliably standalone
- **Scope decision:** Out of scope (unrelated file, not caused by this plan's changes) — confirmed via `git stash` that the same failure reproduces identically against unmodified `main`
- **Verification performed instead:** Ran `tsc -b`, `vite build`, `assert-bundle-size.mjs`, and `lint-no-raw-html.mjs` independently (all green), plus `npx vitest run` without coverage (1412/1412 passed) to confirm this plan's actual change is fully verified
- **Logged:** `.planning/phases/45-brand-launch/deferred-items.md`

**2. Footer.tsx's donation link (pre-existing, out of `files_modified`)**
- Already logged prior to this plan in `deferred-items.md`; this plan's port removes LandingPage.tsx's copy of the same link but does not touch `Footer.tsx` (not in this plan's scope). Updated the existing deferred-items.md entry to reflect the partial resolution.

## Issues Encountered
The full `npm run build` chain currently fails on the flaky test above before reaching `tsc -b`/`vite build`/bundle-size checks — see Deviations. Those later gates were verified to pass independently; the flakiness itself is tracked as a deferred item for a future plan or the phase's pre-launch pass to fix (e.g. raising the test's timeout).

## User Setup Required
None.

## Next Phase Readiness
- `src/pricing.ts`'s `MONTHLY_PRICE_LABEL` now has 2 of 3 marketing pricing spots wired (`/pricing` from 45-03, landing teaser from this plan) — 45-05's features-table Pro column (D-08) is the third and final spot.
- LandingPage is fully ported to Cost-Truth Dark and launch-ready in isolation; no further landing-page work is expected in this phase unless review surfaces issues.
- The `outputEquivalence.test.tsx` flakiness should be resolved before the phase's final `/gsd-verify-work` pass so `npm run build` is reliably green for launch (D-15/D-16).
- REQUIREMENTS.md `BRAND-01` checkbox intentionally left unmarked — spans all 11 plans in this phase, per 45-01/45-02/45-03's established precedent.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

`src/pages/LandingPage.tsx` confirmed present on disk with both commits' content. Both commits (`3873b83`, `40f6aee`) confirmed present in `git log --oneline -5`. `deferred-items.md` update confirmed present on disk.
