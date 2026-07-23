---
phase: 46-white-label-quotes
plan: 07
subsystem: ui
tags: [marketing, features-page, pricing-page, roadmap, honesty-rule]

# Dependency graph
requires:
  - phase: 46-04
    provides: White-label PDF quotes (logo, no "Made with 3DCoster" footer)
  - phase: 46-05
    provides: White-label hosted quote page (branding, not 3DCoster's)
  - phase: 46-06
    provides: Branding UI in UserProfileModal (logo upload, Pro-gated)
provides:
  - Two /features white-label rows flipped from "Coming" pill to shipped Pro "Yes"
  - White-label removed from the /features "Coming to Pro" strip
  - /pricing Pro card lists white-label branding as a shipped Pro feature
  - White-label item removed from /roadmap (roadmap.ts) per its own ship-and-remove contract
affects: [51-launch-prep-redux]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/pages/FeaturesPage.tsx
    - src/pages/PricingPage.tsx
    - src/roadmap.ts

key-decisions:
  - "Only the two white-label rows flipped in FeaturesPage.tsx — the four other ComingCell rows (Live Etsy order sync, Live carrier rates, QuickBooks/Wave, Cloud/real-time device sync) were left untouched since they ship in their own phases (47-50)"
  - "ComingCell doc comment updated to drop white-label from its 'not yet shipped' phase range (was 46-50, now 47-50) since the comment is documentation that must stay accurate, not shipped UI copy"
  - "src/pricing.ts and all price strings left untouched — this plan changes only marketing copy/roadmap content, never pricing"

requirements-completed: [D-15]

coverage:
  - id: D1
    description: "The two white-label /features rows show a shipped Pro 'Yes' cell instead of a 'Coming' pill (D-15a)"
    requirement: D-15
    verification:
      - kind: unit
        ref: "node -e ComingCell count check (src/pages/FeaturesPage.tsx) — expects exactly 4 remaining ComingCell instances"
        status: pass
    human_judgment: false
  - id: D2
    description: "The /features 'Coming to Pro' strip and Free-vs-Pro / full-breakdown intro copy no longer describe white-label as future work (D-15a)"
    requirement: D-15
    verification:
      - kind: unit
        ref: "node -e regex check — 'White-label, branded hosted quotes' absent from FeaturesPage.tsx COMING_TO_PRO array"
        status: pass
    human_judgment: false
  - id: D3
    description: "The /pricing Pro card lists white-label branding as a shipped Pro feature (D-15b)"
    requirement: D-15
    verification:
      - kind: unit
        ref: "node -e regex check — /white-?label/i present in src/pages/PricingPage.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "White-label no longer appears on /roadmap (roadmap.ts), keeping /roadmap and the Coming-to-Pro strip in lockstep (D-15c)"
    requirement: D-15
    verification:
      - kind: unit
        ref: "node -e regex check — 'White-label, branded hosted quotes' absent from src/roadmap.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "src/pricing.ts and all price strings remain unchanged; other Coming pills (Etsy, carrier rates, QuickBooks, cloud sync) untouched; full test suite and tsc -b stay green"
    requirement: D-15
    verification:
      - kind: unit
        ref: "npx tsc -b (clean) and npx vitest run (1485 passed, 4 skipped, 1 todo)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 07: Flip White-Label Marketing Surfaces to Shipped Summary

**Flipped the two white-label /features rows to a shipped Pro "Yes", added a white-label bullet to the /pricing Pro card, and removed the now-shipped white-label item from /roadmap — closing the loop opened by 46-04/46-05/46-06 per the shipped-only honesty rule (D-15).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T13:02:38Z
- **Completed:** 2026-07-23T13:10:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- FeaturesPage.tsx: white-label PDF quotes and white-label hosted quote page rows now render `<td className={yesPro}>Yes</td>` instead of the outlined `<ComingCell />` pill; the `COMING_TO_PRO` strip array dropped its white-label entry; the Free-vs-Pro and full-breakdown intro paragraphs now describe white-label branding as a Pro capability that ships today
- PricingPage.tsx: `PRO_FEATURES` gained a white-label bullet ("your logo on PDF quotes and hosted quote pages, no 'Made with 3DCoster' footer"), consistent in voice with the existing hosted-quote-link bullets
- roadmap.ts: removed the entire "White-label, branded hosted quotes" roadmap item per the file's own "REMOVE it when it ships" honesty contract, keeping /roadmap in lockstep with the /features strip

## Task Commits

Each task was committed atomically:

1. **Task 1: Flip the two white-label /features rows + strip + intro** - `c28cc4a` (feat)
2. **Task 2: Add white-label to the /pricing Pro card + remove from /roadmap** - `4af3fd0` (feat)

_Note: no TDD tasks in this plan — content flips only._

## Files Created/Modified
- `src/pages/FeaturesPage.tsx` - Two white-label rows flipped to shipped Pro; `COMING_TO_PRO` strip entry removed; `ComingCell` doc comment corrected (46-50 → 47-50); Free-vs-Pro and full-breakdown intros reworded
- `src/pages/PricingPage.tsx` - White-label bullet added to `PRO_FEATURES`
- `src/roadmap.ts` - White-label roadmap item removed

## Decisions Made
- Only the two white-label rows in FeaturesPage.tsx were flipped; the four other `ComingCell` rows (Live Etsy order sync, Live carrier rates, QuickBooks/Wave, Cloud/real-time device sync) were deliberately left untouched — they ship in Phases 47-50 and Phase 51 does the final sweep
- Updated the `ComingCell` doc comment's phase range from "46-50" to "47-50" since white-label (Phase 46) is no longer in that "not yet shipped" set — this is a documentation-accuracy fix, not a scope change
- Did not touch `src/pricing.ts` or any price string — this plan is a content-only flip per its own scope note

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the plan's own automated ComingCell-count verify script to not false-match the doc comment**
- **Found during:** Task 1 verification
- **Issue:** The plan's automated check `node -e "...(c.match(/<ComingCell \/>/g)||[]).length..."` counts literal occurrences of the string `<ComingCell />` in the file. The `ComingCell` component's own doc comment (pre-existing, above the function) contained that exact literal string as a documentation example, so the regex matched 5 (4 real JSX usages + 1 comment reference) instead of the expected 4, even though the actual JSX flip was correct.
- **Fix:** Reworded the doc comment to say "flip its ComingCell usage below" instead of quoting the literal `<ComingCell />` JSX tag, preserving the comment's meaning while making the regex match only real usages.
- **Files modified:** src/pages/FeaturesPage.tsx
- **Verification:** Re-ran the plan's exact verify command — now prints `features flips ok` with count 4.
- **Committed in:** c28cc4a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — verification script false-positive from a doc comment)
**Impact on plan:** No scope creep; the fix only reworded a code comment so the plan's own verification script measures what it intends to measure. No user-facing text changed.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 46 (white-label-quotes) is now fully complete: all 7 plans executed, and the marketing surfaces (`/features`, `/pricing`, `/roadmap`) truthfully reflect the shipped capability.
- Phase 51 (Launch-prep redux) still owns the final truth sweep across the remaining `ComingCell` rows (Etsy, carrier rates, QuickBooks, cloud sync) as those phases ship.
- Full test suite green (1485 passed, 4 skipped, 1 todo) and `tsc -b` clean after this plan.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: src/pages/FeaturesPage.tsx
- FOUND: src/pages/PricingPage.tsx
- FOUND: src/roadmap.ts
- FOUND commit: c28cc4a
- FOUND commit: 4af3fd0
