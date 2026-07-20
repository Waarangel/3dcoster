---
phase: 45-brand-launch
plan: 13
subsystem: ui
tags: [marketing, layout, pricing, roadmap, accessibility]

# Dependency graph
requires:
  - phase: 45-brand-launch (plan 12)
    provides: src/hooks/useDisplayPrice.ts (home-currency approximation of the Pro price)
provides:
  - /features rendered fully contained (hero + "Only in 3DCoster") inside the shared max-w-6xl mx-auto container at wide widths
  - A visible Free vs Pro section on /features (no expand required) with an honest "Coming to Pro" roadmap-linked strip
  - src/roadmap.ts pro?: boolean flag + 5 Pro-badged paid-tier trajectory items
  - RoadmapPage.tsx ProBadge rendering on pro:true items
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Outer max-w-6xl mx-auto Reveal wrapping an inner narrower sub-constraint (e.g. max-w-2xl heading, max-w-3xl hero block) — the established FeaturesPage sibling-section containment pattern, now applied uniformly to every section on the page"
    - "Roadmap pro flag mirrored 1:1 between src/roadmap.ts (RoadmapItem.pro) and the /features 'Coming to Pro' strip copy, so the two roadmap-linked surfaces never drift"

key-files:
  created: []
  modified:
    - src/pages/FeaturesPage.tsx
    - src/roadmap.ts
    - src/pages/RoadmapPage.tsx

key-decisions:
  - "Hero inner block wrapped in an additional outer max-w-6xl mx-auto Reveal (keeping its existing max-w-3xl mx-auto text-center as a sub-constraint) even though the hero was not visually full-bleed before — done for structural consistency with every sibling section's outer/inner container nesting pattern, matching the plan's explicit instruction to apply 'the same container treatment to the hero inner'"
  - "New Free vs Pro section placed between 'Follow the selling workflow' and the opt-in 'Full breakdown' table — narratively it completes the at-a-glance summary (workflow coverage -> Free vs Pro differentiation) before the reader opts into the exhaustive competitor table"
  - "Coming to Pro strip content (5 items) is a plain string array on FeaturesPage.tsx, not derived from src/roadmap.ts's pro:true items — the two lists are independently authored but kept in lockstep by comment cross-reference, since importing roadmap.ts's RoadmapItem shape into FeaturesPage would couple marketing copy tone (roadmap descriptions are longer-form) to a compact strip UI"
  - "'Live marketplace order sync' roadmap description copy aligned to explicitly name 'Etsy (90-day order history via the Etsy API)' per the plan's key_links requirement, without changing its stage (still research) or introducing a second entry"

requirements-completed: [BRAND-01]

coverage:
  - id: D1
    description: "All /features sections render inside the shared centered max-w-6xl mx-auto container at 1280/1440/1920; nothing full-bleed"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "npm run build (tsc -b, vite build, 300 KB gz gate, lint:no-raw-html)"
        status: pass
    human_judgment: true
    rationale: "Visual width-matching across 1280/1440/1920 viewports is best confirmed by a human measuring the bento grid bounding box against the 'Follow the selling workflow' container, per the plan's human-check verification step. The JSX structural change mirrors the sibling section's proven container pattern exactly (outer max-w-6xl mx-auto Reveal, inner sub-constraint), which is strong structural evidence of correctness."
  - id: D2
    description: "A visible Free vs Pro section shows Pro's value without expanding the breakdown table, with the Pro price sourced from useDisplayPrice()"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/pages/PricingPage.test.tsx (byte-match guard on pricing constants)"
        status: pass
      - kind: unit
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Confirming the section renders regardless of showTable state and that the price approximation/disclosure format reads correctly is a visual check per the plan's human-check step; the underlying price data comes from the same useDisplayPrice() hook already unit-tested in 45-12."
  - id: D3
    description: "Unbuilt Pro items appear only as a roadmap-linked 'Coming to Pro' strip, never claimed as shipped; the breakdown table's Live Etsy order sync row stays No/No"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "npx vitest run (full suite, 1426 tests, no regressions)"
        status: pass
    human_judgment: false
    rationale: "Verified by direct code inspection — the breakdown table's Etsy-sync row (line 375 of FeaturesPage.tsx) was not touched by any task; the new strip's 5 items are each rendered with an explicit '— on the roadmap' suffix and link to /roadmap, never a Yes/available state."
  - id: D4
    description: "/roadmap carries accessible Pro badges on >=5 paid-tier items; RoadmapItem.pro flag added; badges consistent with the features strip"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "npx vitest run (full suite green)"
        status: pass
      - kind: unit
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Confirming the ProBadge renders visibly and accessibly on /roadmap for all 5 pro:true items (live marketplace order sync, live shipping rates & labels, white-label hosted quotes, QuickBooks sync, real-time device sync) and that non-Pro items show no badge is a visual check per the plan's human-check step."

# Metrics
duration: 5min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 13: Features layout containment + Free/Pro visibility Summary

**Contained the /features hero and "Only in 3DCoster" section inside the shared max-w-6xl centered container, added a visible Free-vs-Pro section with an honest roadmap-linked "Coming to Pro" strip, and Pro-badged 5 paid-tier trajectory items on /roadmap — closing gaps G-45-FEATURES-LAYOUT and G-45-FREE-PRO-VISIBILITY.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-20T23:08:50Z
- **Completed:** 2026-07-20T23:14:45Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `FeaturesPage.tsx` hero inner block and "Only in 3DCoster" heading + bento grid both now sit inside the same `max-w-6xl mx-auto` outer container the sibling "Follow the selling workflow" and "hidden costs" sections already use, with their prior narrower blocks (`max-w-3xl`, `max-w-2xl`) preserved as inner sub-constraints — no copy, icon, or grid-column changes
- New always-visible "Free vs Pro" `<section>` (renders regardless of the `showTable` toggle) with a Free card (free-forever summary) and a Pro card showing the home-currency approximate launch price + "billed as {billingLabel}" disclosure via `useDisplayPrice()`, linking to `/pricing`
- "Coming to Pro" strip lists the 5 genuine paid-tier trajectory items (white-label hosted quotes, live Etsy 90-day order sync, live carrier rates, QuickBooks sync, cloud/real-time sync), each explicitly suffixed "— on the roadmap" and linking to `/roadmap`; the breakdown table's "Live Etsy order sync" row was left untouched (still No/No)
- `src/roadmap.ts` gained an optional `RoadmapItem.pro` flag; marked "Live marketplace order sync" (copy aligned to name Etsy's 90-day API import), "Live shipping rates & labels", and "Real-time device sync" as `pro: true`; added two new items — "White-label, branded hosted quotes" and "QuickBooks accounting sync" — both at `research` stage
- `RoadmapPage.tsx` gained a `ProBadge` component (brand-soft chip, `aria-label="Pro tier"`) rendered on `pro: true` items in both the `StageList` editorial list and the in-development card grid; non-Pro item rendering is untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Contain the /features hero + "Only in 3DCoster" section** - `13f7ca9` (feat)
2. **Task 2: Add a visible Free vs Pro section + "Coming to Pro" strip on /features** - `aff6e1f` (feat)
3. **Task 3: Pro-badged roadmap entries + Pro badge rendering** - `d7d28d3` (feat)

**Plan metadata:** (this commit) `docs(45-13): complete features-layout + free-pro-visibility gap closure plan`

## Files Created/Modified
- `src/pages/FeaturesPage.tsx` - Hero + "Only in 3DCoster" containment; new Free vs Pro section + Coming to Pro strip; `COMING_TO_PRO` data array added
- `src/roadmap.ts` - `RoadmapItem.pro?: boolean` field; 3 existing items marked `pro:true`; 2 new Pro items added
- `src/pages/RoadmapPage.tsx` - `ProBadge` component; rendered on `pro:true` items in `StageList` and the in-development card grid

## Decisions Made
- Hero inner block wrapped in an additional outer `max-w-6xl mx-auto` Reveal (keeping the existing `max-w-3xl mx-auto text-center` as a sub-constraint) even though the hero was not visually full-bleed beforehand — done for structural consistency with every sibling section's container-nesting pattern, per the plan's explicit instruction
- New Free vs Pro section placed between "Follow the selling workflow" and the opt-in "Full breakdown" table, completing the at-a-glance narrative before the reader opts into the exhaustive competitor table
- "Coming to Pro" strip content is a plain string array on `FeaturesPage.tsx`, kept in lockstep with `roadmap.ts`'s `pro:true` items by comment cross-reference rather than importing `RoadmapItem` directly — the roadmap's longer-form descriptions don't fit the compact strip UI
- "Live marketplace order sync" roadmap copy updated to explicitly name Etsy's 90-day API import per the plan's key_links requirement, without changing its stage or adding a duplicate entry

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

Both gaps (G-45-FEATURES-LAYOUT, G-45-FREE-PRO-VISIBILITY) closed. `npm run build` green (main chunk 100.2 KB gz, well under the 300 KB gate; `lint:no-raw-html` passed). Full test suite green: 1426 passed / 4 skipped / 1 todo across 127 files, no regressions. No new dependencies added. Nothing pushed to remote — release timing remains the user's call per project convention.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

All 3 modified source files confirmed present on disk; all 3 task commit hashes (13f7ca9, aff6e1f, d7d28d3) confirmed in git log.
