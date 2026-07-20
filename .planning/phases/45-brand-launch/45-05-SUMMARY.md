---
phase: 45-brand-launch
plan: 05
subsystem: ui
tags: [features-page, cost-truth-dark, pricing, a11y, competitor-comparison]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "01"
    provides: Cost-Truth Dark CSS custom-property token layer, MarketingThemeScope, Reveal motion primitive
  - phase: 45-brand-launch
    plan: "02"
    provides: Token-scoped Header/Footer (brand-restyled, /pricing nav already wired)
  - phase: 45-brand-launch
    plan: "03"
    provides: src/pricing.ts (MONTHLY_PRICE_LABEL) — the single source of truth for the third pricing spot
provides:
  - "Reconciled FeaturesPage.tsx — Cost-Truth Dark competitor-matrix port with Phase 37 a11y re-applied, 9 new comparison-table rows representing every shipped v2.0 capability (D-11), and the D-08 3DCoster Pro column (priced from src/pricing.ts)"
affects: [45-06, 45-07, 45-08, 45-09, 45-10, 45-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pro column mirrors the Free column's value on every row except the single genuinely Pro-only capability (hosted quote links) — the floor-and-ceiling model made visible cell-by-cell, not just in prose"
    - "Unverified competitor cells on newly-added v2.0 rows use \"—\" (the table's own pre-existing convention for \"not stated\"), never an asserted \"No\" without a verified data point"

key-files:
  created: []
  modified:
    - src/pages/FeaturesPage.tsx

key-decisions:
  - "Ported the branch's competitor-matrix structure (3DCoster/Prusa Calculator/Calc3dprint/LayerMath/SlicePrice3D) rather than main's older 3DPrintForce-anchored table — the branch's competitor set was independently re-verified via a live logged-in walkthrough (commit d76cdaf, 'correct SlicePrice3D cells from verified logged-in walkthrough'), so it is the more current, more accurate dataset, per D-01's 'branch is the design reference' posture"
  - "D-11's 'everything shipped in v2.0 is represented in the /features table' interpreted as the literal comparison <table>, not the 'Only in 3DCoster' bento (which stays as ported, unmodified) — 9 new rows added across a new 'Insights & operations' section plus extensions to Cost calculation / Quotes & compliance / Platform & access"
  - "New v2.0 rows use '—' for all 4 competitors rather than inventing 'No' verdicts — no live competitor audit was run for TOU tariffs, insights, reprice alerts, spool/moisture tracking, tax-threshold tracking, sync, or hosted quotes this plan, and the table's own caption already defines '—' as exactly this 'not verified' meaning"
  - "3DCoster Pro column added as the 2nd column (immediately right of Free) rather than appended at the end — reads as an upsell adjacent to the floor it extends, not a bolted-on afterthought"
  - "Pro column value = Free column value on every row except 'Hosted, branded quote links (share + live approve/decline)' (Free=No, Pro=Yes) — the only Pro-gated capability that exists in the codebase (usePublishedQuote/ProPitchModal), matching 45-03's PricingPage precedent for what Pro actually contains"
  - "Added a floor-and-ceiling note directly above the table ('Everything above is free, forever... 3DCoster Pro adds one thing on top...', linking to /pricing) so the Pro column reads as additive even for users who never expand the collapsed table"

patterns-established:
  - "Any future comparison-table Pro column can reuse the tdPro/yesPro/noPro style triad (a lighter blue tint than the Free column's tdUs/yesUs/noUs, never amber — amber stays quarantined to support/warnings per DESIGN.md)"

requirements-completed: []  # BRAND-01 spans all 11 plans in this phase; left unmarked per 45-01/45-02/45-06..09 precedent until the full redesign port lands

coverage:
  - id: D45-05-a11y
    description: "FeaturesPage renders inside a <main> landmark with aria-labelledby on every section and aria-hidden on every decorative icon, re-applying main's Phase 37 a11y hardening that the branch's older rewrite predates"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q '<main' src/pages/FeaturesPage.tsx && grep -q 'aria-labelledby' src/pages/FeaturesPage.tsx -> FEATURES_A11Y_OK; source inspection confirms all 6 <section> elements carry aria-labelledby, all Glyph/status-flow/chevron SVGs carry aria-hidden=\"true\""
        status: pass
    human_judgment: false
  - id: D45-05-v2-features
    description: "Every shipped v2.0 capability (failure engine, TOU electricity, wear/maintenance amortization, insights/printer-ROI, what-if simulator, reprice alerts, spool lifecycle, tax-threshold tracker, device sync, STL instant quote, hosted quotes) is represented as a row in the comparison table; no unbuilt/roadmap feature is listed as shipped"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "Source inspection: 9 new rows added (TOU tariffs, what-if simulator, hourly-wage/profitability, printer ROI, reprice alerts, spool lifecycle/moisture, tax-threshold tracking, multi-device sync, STL/3MF instant quote) plus the existing failure/nozzle-wear rows extended with amortization language; every new row cross-checked against REQUIREMENTS.md's shipped v1 IDs (TOU-01/02, INS-01/02/03, CONN-01/02, LIFE-01/02, SYNC-01) — no roadmap-only item referenced"
        status: pass
    human_judgment: false
  - id: D45-05-pro-column
    description: "The comparison table has a 3DCoster Pro column with the price (from src/pricing.ts) in its header, Free column still shows the full free floor, and the price label is imported never re-typed"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -qi 'Pro' src/pages/FeaturesPage.tsx && ! grep -q 'no Pro tier' src/pages/FeaturesPage.tsx && grep -q 'MONTHLY_PRICE_LABEL' src/pages/FeaturesPage.tsx -> PRO_COLUMN_OK; Playwright screenshot (1280px, reducedMotion) confirms the header renders '3DCoster Pro' / 'EUR 6.90/mo', the Price row shows 'Free forever' / 'EUR 6.90/mo', and the Hosted-quote-links row is the only row where Free != Pro (No / Yes)"
        status: pass
      - kind: unit
        ref: "npx vitest run — 1412 passed, 4 skipped, 1 todo (124/125 files) — full suite unaffected"
        status: pass
    human_judgment: false
  - id: D45-05-no-false-claim
    description: "The string 'no Pro tier' (or an equivalent free-forever-only claim contradicting the Pro column) does not appear anywhere on the page"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q 'no Pro tier' src/pages/FeaturesPage.tsx -> no match. The branch source ported in this plan never carried this line (it predates Pro entirely); the floor-and-ceiling note added above the table explicitly frames Pro as additive, reinforcing rather than contradicting the Pro column"
        status: pass
    human_judgment: false
  - id: D45-05-build-green
    description: "npm run build's constituent gates (tsc -b, vite build, bundle-size assert, lint:no-raw-html) pass; full vitest suite green"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "npm run build — main chunk 101.5 KB gzipped (under 300 KB gate); tsc -b clean; lint:no-raw-html passed at both commits; assert-bundle-size.mjs/pdf/three static-import asserts all passed"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 05: FeaturesPage Cost-Truth Dark Port + Pro Column Summary

**Ported FeaturesPage's competitor-matrix redesign to Cost-Truth Dark with Phase 37 a11y re-applied, added 9 new comparison-table rows representing every shipped v2.0 capability, and added the D-08 "3DCoster Pro" column (EUR 6.90/mo, imported from src/pricing.ts) that mirrors the Free column everywhere except the one genuinely Pro-only row (hosted quote links).**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-20T11:57:43Z (approx, following 45-04's completion)
- **Completed:** 2026-07-20T12:52:29Z
- **Tasks:** 2 (both auto)
- **Files modified:** 1 (`src/pages/FeaturesPage.tsx`)

## Accomplishments
- Ported the `test/design-skills-experiment` branch's competitor-matrix `FeaturesPage` redesign onto main: `var(--brand)`/`var(--surface)`/`var(--ink)` token styling throughout, the "Only in 3DCoster" bento, the coverage-dot selling-workflow summary, and the collapsible full-breakdown comparison table — chose the branch's competitor set (3DCoster/Prusa Calculator/Calc3dprint/LayerMath/SlicePrice3D) over main's older 3DPrintForce-anchored table since the branch's cells were independently re-verified via a live logged-in walkthrough
- Re-applied main's Phase 37 a11y hardening the branch's older rewrite predates: a `<main>` landmark, `aria-labelledby` on all 6 `<section>` elements, and `aria-hidden="true"` added to every decorative icon (`Glyph` component's `<svg>`, the status-flow arrow, the collapse/expand chevron — none of which the branch source had)
- Added 9 new comparison-table rows to satisfy D-11 ("everything shipped in v2.0 is represented in the /features table"): time-of-use electricity tariffs, what-if margin simulator (Cost calculation section); hourly wage + profitability ranking, printer payback/ROI, automatic reprice alerts, spool lifecycle + moisture tracking, tax-threshold progress tracking (new "Insights & operations" section); multi-device sync, STL/3MF instant quote (Platform & access section) — plus extended the existing nozzle-wear and failure-loss row labels to name the amortization/ledger mechanics now shipped
- Added the D-08 "3DCoster Pro" column immediately right of the Free column, headed with `{MONTHLY_PRICE_LABEL}/mo` imported from `src/pricing.ts` — every row's Pro value mirrors its Free value except "Hosted, branded quote links (share + live approve/decline)" (Free=No, Pro=Yes), the one Pro-gated capability that actually exists in the codebase
- Confirmed the "no Pro tier hiding the business features" self-contradiction Pitfall 9 warned about was never present in the ported (branch-sourced) copy — nothing to fix "in the same stroke" since the branch predates Pro entirely — and added a floor-and-ceiling note above the table ("Everything above is free, forever... 3DCoster Pro adds one thing on top...") linking to `/pricing`, so the Pro column reads as additive even without expanding the table
- Verified via headless Playwright screenshot (1280px, `reducedMotion: 'reduce'`) that the Pro column renders correctly end-to-end: header shows "3DCoster Pro" / "EUR 6.90/mo", the Hosted-quote-links row shows No/Yes with an inline "Pro" tag, and the Price row shows "Free forever" / "EUR 6.90/mo"
- `npm run build` green (main chunk 101.5 KB gz, well under the 300 KB gate), `npx tsc -b` clean, `npx vitest run` — 1412/1412 non-skipped tests passing, `lint:no-raw-html` passed on both task commits

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the FeaturesPage redesign + re-apply a11y + list the shipped v2.0 features** - `55196e9` (feat)
2. **Task 2: Add the 3DCoster Pro column (price header) + fix the self-contradicting free-forever copy** - `4d84307` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/pages/FeaturesPage.tsx` - Full port: Cost-Truth Dark competitor-matrix styling, a11y landmarks/labels/aria-hidden restored, 9 new v2.0-capability rows across the comparison table, new "3DCoster Pro" column with price header and floor-and-ceiling note

## Decisions Made
See `key-decisions` in frontmatter. Most notable: choosing the branch's competitor-matrix structure (with its more recently re-verified SlicePrice3D data) over main's older table, and using "—" rather than an invented "No" for the 4 competitors on every newly-added v2.0 row where no live audit was run this plan — consistent with the project's standing rule to never assert a data point that wasn't verified.

## Deviations from Plan

None — plan executed as written. The floor-and-ceiling note above the table and the "Pro" inline tag on the hosted-quote-links row are additive clarity improvements within the plan's own D-08 scope (making the Pro column self-explanatory), not scope changes.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- All 3 of the D-06/D-07/D-08 marketing pricing spots (`/pricing` page, landing-page teaser, features-table Pro column) are now live and import `MONTHLY_PRICE_LABEL` from the same `src/pricing.ts` source — `PricingPage.test.tsx`'s regex guard covers drift protection for the shared constant, and this page's own Pro column literal was verified against it via the plan's grep check.
- FeaturesPage is fully ported to Cost-Truth Dark and launch-ready in isolation; no further features-page work is expected in this phase unless review surfaces issues.
- REQUIREMENTS.md `BRAND-01` checkbox intentionally left unmarked — per 45-01/45-02/45-06..09's established precedent, it spans all 11 plans in this phase (this plan is 05 of 11, executed after 06-09 were already completed) and should be marked complete once the whole port (legal-surface restyle, SupportNudge retarget, docs, release prep, launch-comms — plans 10-11) lands.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

`src/pages/FeaturesPage.tsx` confirmed present on disk with both task commits' content. Both commits (`55196e9`, `4d84307`) confirmed present in `git log --oneline --all`. `45-05-SUMMARY.md` confirmed present on disk at `.planning/phases/45-brand-launch/`.
