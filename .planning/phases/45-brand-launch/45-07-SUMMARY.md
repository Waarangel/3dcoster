---
phase: 45-brand-launch
plan: "07"
subsystem: ui
tags: [css-custom-properties, design-tokens, react-router, motion, markdown-security, roadmap-content]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "01"
    provides: Cost-Truth Dark CSS custom-property token layer (src/index.css), MarketingThemeScope
  - phase: 45-brand-launch
    plan: "02"
    provides: Token-scoped shared ui/ primitives (Button, Card, Input, Select, Textarea) + brand-ported Header/Footer
provides:
  - ChangelogPage ported to Cost-Truth Dark with the branch's featured-latest-release + version-timeline layout, preserving main's isSafeHttpUrl markdown-link guard
  - RoadmapPage ported to Cost-Truth Dark (journey-spine layout) with D-13 content refresh — three post-launch candidates (CURR-01, SYNC-02, TOU-03) added to src/roadmap.ts
  - FeedbackPage ported to Cost-Truth Dark, Formspree flow and desktop-slate boundary preserved
affects: [45-08, 45-09, 45-10, 45-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Marketing pages omit the branch's undefined `.hero-aura` decorative-glow div (never defined in src/index.css) — consistent with the precedent already set by 45-06's FAQPage port"
    - "Section-level a11y: <main> landmark + aria-labelledby per <section> (heading id referenced) + aria-hidden on every decorative icon/dot/svg, re-applied on every ported page per Phase 37 precedent"

key-files:
  created: []
  modified:
    - src/pages/ChangelogPage.tsx
    - src/pages/RoadmapPage.tsx
    - src/pages/FeedbackPage.tsx
    - src/roadmap.ts

key-decisions:
  - "ChangelogPage: kept the literal 'All Releases on GitHub' CTA button (text + href) from main instead of the branch's replacement 'View the roadmap' button, per the plan's explicit must_haves requirement — the branch's featured/timeline visual layout was ported around it unchanged"
  - "RoadmapPage content refresh: no shipped v2.0 feature was ever present in src/roadmap.ts's roadmapItems array (the four pre-existing items — marketplace pricing, marketplace order sync, shipping rates, i18n — are unrelated pre-v2.0 backlog items) — so D-13's 'remove shipped items' half was a no-op; only the 'add post-launch candidates' half required a change"
  - "Post-launch candidate item copy and stage placement (CURR-01 'planning' since well-scoped/low-effort per REQUIREMENTS.md; SYNC-02 and TOU-03 'research' since both have real unresolved blockers — EU-residency confirmation and grid-carbon API integration respectively) — exercised the plan's explicit discretion grant for exact roadmap-page item copy"
  - "FeedbackPage: verified no page-level theme-brand-dark class was introduced — var(--x) tokens resolve purely from the MarketingThemeScope route-wrapper ancestor (45-01), so the desktop /feedback route (outside that wrapper) keeps slate per D-02"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "ChangelogPage restyled to Cost-Truth Dark (featured latest release + version-anchored timeline) while using isSafeHttpUrl (not the branch's weaker inline url.startsWith check) in the markdown-link renderer"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q isSafeHttpUrl src/pages/ChangelogPage.tsx && ! grep -q \"url.startsWith('http\" src/pages/ChangelogPage.tsx → CHANGELOG_OK"
        status: pass
      - kind: other
        ref: "npm run build — main chunk 101.0 KB gzipped (under 300 KB gate); lint:no-raw-html passed; tsc -b passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "RoadmapPage restyled to Cost-Truth Dark (journey-spine layout) with a <main> landmark and Phase 37 a11y pattern re-applied"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q '<main' src/pages/RoadmapPage.tsx → ROADMAP_OK"
        status: pass
      - kind: other
        ref: "npm run build green (same run as D1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "RoadmapPage content refreshed per D-13: no shipped v2.0 feature present (verified — none ever was), and three post-launch candidates sourced from the v2-deferred requirement pool (CURR-01 currency expansion, SYNC-02 real-time sync ceiling, TOU-03 green-print nudge) added to src/roadmap.ts"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -c 'CURR-01\\|More currencies\\|Real-time device sync\\|Green-print nudge' — manual read of src/roadmap.ts confirms all 3 items present at appropriate stages, zero shipped-feature titles present"
        status: pass
    human_judgment: false
  - id: D4
    description: "FeedbackPage restyled to Cost-Truth Dark; Formspree submission flow (endpoint mbdgwnjl) and validation unchanged; no page-level theme-brand-dark class hardcoded so the desktop /feedback route stays slate"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q '<main' src/pages/FeedbackPage.tsx && ! grep -q theme-brand-dark src/pages/FeedbackPage.tsx → FEEDBACK_OK"
        status: pass
      - kind: other
        ref: "npm run build green (same run as D1); fetch('https://formspree.io/f/mbdgwnjl', ...) call site byte-identical to pre-port version"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full existing test suite stays green after the port"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "npx vitest run — 1403 passed, 4 skipped, 1 todo (one unrelated CostCalculator output-equivalence test timed out at the default 5000ms in this run; re-run with --testTimeout 30000 in isolation passed cleanly in 2.28s — a pre-existing flaky-timeout issue in an unrelated calculator test, not a regression from this plan's page-only changes)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 07: Changelog, Roadmap & Feedback Pages Summary

**Ported ChangelogPage (Cost-Truth Dark restyle preserving main's isSafeHttpUrl markdown-link guard), RoadmapPage (Cost-Truth Dark restyle + D-13 content refresh adding CURR-01/SYNC-02/TOU-03 post-launch candidates), and FeedbackPage (Cost-Truth Dark restyle, Formspree flow untouched) to the brand system.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-20T10:20:00-04:00 (approx)
- **Completed:** 2026-07-20T10:26:08-04:00
- **Tasks:** 3 (all auto)
- **Files modified:** 4 (ChangelogPage.tsx, RoadmapPage.tsx, FeedbackPage.tsx, roadmap.ts)

## Accomplishments
- Ported the branch's Cost-Truth Dark visual treatment onto `ChangelogPage.tsx` — a featured "latest release" card plus a version-anchored timeline for older releases, brand tokens (`var(--brand)`/`var(--surface)`/etc.), semantic Keep-a-Changelog category chips, and `Reveal` scroll-in motion — while keeping main's `isSafeHttpUrl` guard in the markdown-link renderer (the branch's rewrite still used the weaker inline `url.startsWith('http')` check per Pitfall 7; grep-asserted absent). Kept `MAX_RELEASES_DISPLAYED` at 5 and the literal "All Releases on GitHub" CTA button.
- Ported the branch's journey-spine visual layout onto `RoadmapPage.tsx` (research → planning → in-development → ships, with featured in-development cards and editorial earlier-stage lists), re-applying `<main>` landmark + `aria-labelledby` + `aria-hidden` a11y (Phase 37 pattern) that the branch's older rewrite predates.
- Refreshed `src/roadmap.ts` per D-13: confirmed no shipped v2.0 feature was ever present in the roadmap data (the four existing items are unrelated pre-v2.0 backlog: marketplace pricing, marketplace order sync, shipping rates, i18n), then added three post-launch candidates sourced from the v2-deferred requirement pool — currency expansion (CURR-01, "planning" stage), real-time device sync (SYNC-02, "research" stage — blocked on EU-residency confirmation), and the green-print grid-carbon nudge (TOU-03, "research" stage — blocked on API integration work).
- Ported the branch's Cost-Truth Dark styling onto `FeedbackPage.tsx` (hero copy, success-state card, form styling, `Reveal` stagger), keeping the Formspree POST flow and validation byte-identical, and confirming no page-level `theme-brand-dark` class was introduced so the desktop `/feedback` route (outside `MarketingThemeScope`) keeps slate per D-02.
- `npm run build` green across all three ports in one run: main chunk 101.0 KB gzipped (under the 300 KB gate), `tsc -b` clean, `lint:no-raw-html` passed on every commit, bundle/pdf/three asserts all passed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Port ChangelogPage — brand restyle + isSafeHttpUrl markdown-link safety** - `01b31f2` (feat)
2. **Task 2: Port RoadmapPage — brand restyle + D-13 content refresh + a11y** - `ee01503` (feat)
3. **Task 3: Port FeedbackPage to the brand system** - `31cd806` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/pages/ChangelogPage.tsx` - Cost-Truth Dark restyle (featured release + timeline layout), `isSafeHttpUrl` guard preserved, `aria-hidden` added to decorative bullet glyphs
- `src/pages/RoadmapPage.tsx` - Cost-Truth Dark restyle (journey-spine layout), `<main>` landmark + `aria-labelledby`/`aria-hidden` a11y re-applied
- `src/pages/FeedbackPage.tsx` - Cost-Truth Dark restyle, Formspree flow and validation unchanged, no page-level theme class
- `src/roadmap.ts` - Added three post-launch candidate items (currency expansion, real-time device sync, green-print nudge) sourced from `.planning/REQUIREMENTS.md`'s v2-deferred pool

## Decisions Made
See `key-decisions` in frontmatter. Most notable: the RoadmapPage "shipped items removed" half of D-13 required no code change since no shipped v2.0 feature was ever listed in `roadmapItems` — verified by reading the pre-port file rather than assumed, avoiding a false "nothing to do" conclusion without checking.

## Deviations from Plan

None — plan executed exactly as written. All three `<acceptance_criteria>` grep/build checks pass as specified in the plan.

## Issues Encountered

One test (`src/components/calculator/outputEquivalence.test.tsx`) timed out at the default 5000ms during the full-suite `npx vitest run`. This test is unrelated to any file this plan touched (a CostCalculator output-equivalence oracle, not a marketing page); re-running it in isolation with a longer timeout passed cleanly in 2.28s, confirming this is a pre-existing environment-dependent flaky timeout, not a regression introduced by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ChangelogPage, RoadmapPage, and FeedbackPage are now on Cost-Truth Dark; combined with 45-01 through 45-06, six of the seven original marketing pages plus the new `/pricing` page are ported.
- REQUIREMENTS.md `BRAND-01` checkbox intentionally left unmarked — per 45-01/45-02's established precedent, it spans all 11 plans in this phase and should be marked complete once the full port (including legal-surface restyle, SupportNudge retarget, docs, and release prep) lands.
- `src/roadmap.ts`'s post-launch candidates are ready to be referenced by any future roadmap-adjacent copy (e.g. FAQPage, landing page) without further roadmap-content work.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*
