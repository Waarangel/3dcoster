---
phase: 45-brand-launch
plan: 15
subsystem: ui
tags: [react, marketing-copy, changelog]

# Dependency graph
requires:
  - phase: 45-brand-launch
    provides: "45-14 re-based Pro price from EUR to USD in code (src/pricing.ts); this plan re-bases the same price in prose (CHANGELOG + launch comms)"
provides:
  - "Single feature name 'Cost-Truth Engine' (title case, hyphenated) across /features, /landing, CHANGELOG, and launch comms"
  - "/features Free-vs-Pro intro no longer duplicates the Free card's feature list"
  - "/features desktop-app card + comparison-table row name Windows, macOS, and Linux"
  - "CHANGELOG [2.0.0] and docs/launch/LAUNCH-COMMS.md quote the USD Pro price ($7.99/mo, $79/yr)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/pages/LandingPage.tsx
    - src/pages/FeaturesPage.tsx
    - CHANGELOG.md
    - docs/launch/LAUNCH-COMMS.md

key-decisions:
  - "Free-vs-Pro intro paragraph on /features rewritten to drop its inline feature list entirely (kept free-forever + one-thing-added framing) rather than trimming it, since the full list already lives in the Free card ten lines below"
  - "STAGES table header title left at full 'Cost-Truth Engine' length without shortening the blurb — the workflow-coverage table already sits inside an overflow-x-auto/min-w-[640px] wrapper, so the longer title cannot visually crowd the header"

requirements-completed: [BRAND-01]

coverage:
  - id: D1
    description: "Feature name standardized to 'Cost-Truth Engine' (title case, hyphenated) at every user-facing use on /features and /landing; no user-facing 'cost realism' remains"
    requirement: BRAND-01
    verification:
      - kind: automated_ui
        ref: "grep -RIn 'cost realism' src/pages/ (excluding comments) returns nothing; grep 'Cost-Truth Engine' matches both pages"
        status: pass
    human_judgment: false
  - id: D2
    description: "/features Free-vs-Pro intro no longer duplicates the Free card's feature list"
    requirement: BRAND-01
    verification:
      - kind: manual_procedural
        ref: "Read-verified rewrite of the intro paragraph at FeaturesPage.tsx:313"
        status: pass
    human_judgment: true
    rationale: "Copy-quality/wording judgment (does the rewrite read well and truly drop duplication) is not automatable"
  - id: D3
    description: "Desktop-app differentiator card and comparison-table row on /features both name Windows, macOS, and Linux"
    requirement: BRAND-01
    verification:
      - kind: automated_ui
        ref: "grep 'Linux' src/pages/FeaturesPage.tsx matches both the card (line 45) and the table row (line 478)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CHANGELOG [2.0.0] and docs/launch/LAUNCH-COMMS.md quote $7.99/$79 USD (no EUR figure) and name the feature 'Cost-Truth Engine'"
    requirement: BRAND-01
    verification:
      - kind: automated_ui
        ref: "grep -n 'EUR 6.90|EUR 69' CHANGELOG.md docs/launch/LAUNCH-COMMS.md returns nothing; node scripts/extract-changelog.cjs v2.0.0 prints [2.0.0] with no fallback warning"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-22
status: complete
---

# Phase 45 Plan 15: Terminology & Linux Copy Gap-Closure Summary

**Standardized the feature name to 'Cost-Truth Engine' across every marketing surface, named Linux alongside Windows/macOS on /features, de-duplicated the Free-vs-Pro intro, and re-based CHANGELOG/launch-comms prose from EUR to the founder-locked USD price ($7.99/$79).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-22T01:33:38Z
- **Completed:** 2026-07-22T01:37:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- 'Cost-truth engine' / 'Cost truth' / 'cost realism engine' unified to 'Cost-Truth Engine' (title case, hyphenated) on LandingPage.tsx and FeaturesPage.tsx — comments and the distinct "Cost-Truth Dark" theme name left untouched
- /features Free-vs-Pro intro rewritten to drop its inline feature list (which duplicated the Free card ten lines below), while preserving the free-forever + "Pro adds one thing" framing
- /features "Fully offline desktop app" differentiator card and the comparison-table "Desktop app" row both now name Windows, macOS, and Linux (Linux shipped v1.7.0; the /pricing Free column already named all three)
- CHANGELOG [2.0.0] summary line and Pro-price bullet, plus all four EUR price mentions across docs/launch/LAUNCH-COMMS.md (header note, changelog-writeup body, Reddit draft, Twitter-thread draft), re-based to the USD Pro price ($7.99/mo, $79/yr)

## Task Commits

Each task was committed atomically:

1. **Task 1: Marketing page copy — Cost-Truth Engine terminology, de-duplicate the /features list, Linux** - `12e2694` (feat)
2. **Task 2: Release docs — Cost-Truth Engine + USD price in CHANGELOG and launch comms** - `d7e2fdd` (docs)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `src/pages/LandingPage.tsx` - PILLARS pillar title + pillars-section closing copy: 'Cost-truth engine' -> 'Cost-Truth Engine'
- `src/pages/FeaturesPage.tsx` - STAGES title, desktop-app card/table Linux naming, Free-vs-Pro intro rewrite, Free-card body feature-name fix
- `CHANGELOG.md` - [2.0.0] summary line feature-name capitalization; Pro price bullet EUR -> USD
- `docs/launch/LAUNCH-COMMS.md` - header note, changelog-writeup title/body, Reddit draft, Twitter-thread draft: EUR price -> USD; feature-name capitalization

## Decisions Made
- Free-vs-Pro intro rewritten to drop its list entirely (not trimmed) — the Free card below is now the single source of the feature list, closing the duplication cleanly rather than partially
- STAGES table header title kept at full length ('Cost-Truth Engine') without shortening the blurb — the workflow-coverage table already lives inside an `overflow-x-auto`/`min-w-[640px]` wrapper, so no visual crowding risk existed

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their line-numbered targets precisely; no additional 'cost realism' or stale EUR price mentions were found beyond what the plan enumerated.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BRAND-01 gap-closure items G-45-TERMINOLOGY and G-45-LINUX-COPY closed; G-45-BILLING-CURRENCY comms portion closed (code portion landed in 45-14)
- `npm run build` and the full `npx vitest run` suite (1430 passed, 4 skipped, 1 todo) both green after the edits
- `node scripts/extract-changelog.cjs v2.0.0` confirmed the [2.0.0] section extracts cleanly with the updated USD price and no fallback warning
- No blockers for remaining phase-45 gap-closure plans

---
*Phase: 45-brand-launch*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: src/pages/LandingPage.tsx
- FOUND: src/pages/FeaturesPage.tsx
- FOUND: CHANGELOG.md
- FOUND: docs/launch/LAUNCH-COMMS.md
- FOUND: 12e2694 (Task 1 commit)
- FOUND: d7e2fdd (Task 2 commit)
