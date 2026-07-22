---
phase: 45-brand-launch
plan: 16
subsystem: ui
tags: [react, tailwind, marketing-site, pricing, accessibility]

requires:
  - phase: 45-brand-launch
    provides: 45-15's Cost-Truth Engine terminology sweep, Linux comparison-row label, and de-duplicated Free-vs-Pro intro on the same file
provides:
  - Expanded /features breakdown table showing the full launch-Pro bundle (white-label PDF quotes, white-label hosted quote page, live carrier rates & labels, QuickBooks/Wave sync, cloud/real-time device sync) with a distinct, accessible "Coming" cell treatment
  - PHASE-51-LAUNCH-PREP marker for launch-prep to grep and flip Coming cells to Yes as phases 46-50 ship
  - Reframed below-table summary sentence (Pro-today + coming set) with the dynamic USD price render preserved
affects: [46-white-label, 47-cloud-sync, 48-live-etsy-sync, 49-live-carrier-rates, 50-quickbooks-sync, 51-launch-prep]

tech-stack:
  added: []
  patterns:
    - "ComingCell helper component (outlined pill + sr-only text) for roadmap-not-yet-shipped Pro table cells — never a bare 'Yes'"

key-files:
  created: []
  modified:
    - src/pages/FeaturesPage.tsx

key-decisions:
  - "comingPro cell class deliberately reuses the same visual tint as yesPro (tdPro base + brand-soft text) so the Pro column reads as one consistent group; the outlined pill inside ComingCell (not the cell background) carries the 'not yet shipped' distinction"
  - "Removed the noPro constant (its only caller, the Etsy row's Pro cell, became ComingCell) rather than leave an unused-variable build error"
  - "All four competitor cells on the five new rows default to em dash — no concrete competitor data for white-label quotes, live carrier APIs, QuickBooks/Wave sync, or cloud device sync exists in 45-RESEARCH.md or elsewhere in the table"

requirements-completed: [BRAND-01]

coverage:
  - id: D1
    description: "Five new Pro-differentiating rows added to the /features breakdown table (white-label PDF quotes, white-label hosted quote page, live carrier rates & printable labels, QuickBooks/Wave accounting sync, cloud/real-time device sync), each Free: No / Pro: Coming / competitors: em dash"
    requirement: BRAND-01
    verification:
      - kind: automated_ui
        ref: "playwright screenshot — features-table-etsy-carrier.png, features-table-whitelabel.png (scratchpad)"
        status: pass
      - kind: other
        ref: "grep -Ec 'White-label PDF quotes|White-label hosted quote page|Live carrier rates|QuickBooks/Wave|Cloud / real-time device sync' src/pages/FeaturesPage.tsx -> 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "Existing Etsy row's Pro cell flipped from No to a Coming pill; LayerMath comparison cell (Yes £5/mo) left untouched"
    requirement: BRAND-01
    verification:
      - kind: automated_ui
        ref: "playwright screenshot — features-table-etsy-carrier.png"
        status: pass
    human_judgment: false
  - id: D3
    description: "Distinct, accessible Coming cell treatment: outlined pill (never a bare Yes) with sr-only 'to Pro — on the roadmap' text, tagged with a PHASE-51-LAUNCH-PREP marker for launch-prep to find and flip"
    requirement: BRAND-01
    verification:
      - kind: other
        ref: "grep -q 'comingPro' && grep -q 'PHASE-51-LAUNCH-PREP' src/pages/FeaturesPage.tsx -> both pass"
        status: pass
      - kind: automated_ui
        ref: "playwright screenshot confirms outlined pill visually distinct from solid 'Yes' text"
        status: pass
    human_judgment: false
  - id: D4
    description: "Below-table summary sentence reframed from 'Pro adds one thing on top' to Pro-today (hosted quote links) + the coming set (white-label, live Etsy & carrier APIs, QuickBooks, cloud sync), dynamic USD price render preserved verbatim"
    requirement: BRAND-01
    verification:
      - kind: other
        ref: "grep -q 'on the way' && grep -q 'monthly.approx' src/pages/FeaturesPage.tsx -> both pass"
        status: pass
      - kind: automated_ui
        ref: "playwright screenshot — features-summary.png shows 'USD 7.99/mo... on the way (see the Coming rows below)'"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-22
status: complete
---

# Phase 45 Plan 16: /features Pro-table gap closure (G-45-PRO-TABLE) Summary

**Expanded /features breakdown table with five new "Coming" Pro rows (white-label quotes, live carrier rates, QuickBooks sync, cloud sync) via an outlined-pill ComingCell component, flipped the Etsy row to Coming, and reframed the below-table summary to Pro-today + coming-set — all tagged with a PHASE-51-LAUNCH-PREP grep marker.**

## Performance

- **Duration:** 12min
- **Completed:** 2026-07-22T02:50:00Z
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments

- Closed G-45-PRO-TABLE (UAT round 2, test 53): the expanded table previously showed Free and Pro identical except one row, giving a comparison-shopper no reason to pay for Pro. It now truthfully presents the full launch-Pro bundle the founder expanded scope to build (phases 46-51), with every unbuilt capability marked "Coming" — never claimed as shipped.
- Added a reusable `ComingCell` helper (outlined pill, `text-xs`, sr-only "to Pro — on the roadmap") so the table's "not yet shipped" state is visually AND semantically distinct from the solid-text "Yes" used for shipped Pro capabilities.
- Reframed the below-table summary sentence from "adds one thing on top" to a Pro-today + coming-set framing, while leaving the 45-15-owned Free-vs-Pro intro paragraph (a different sentence, "Pro adds exactly one thing on top today, with more on the roadmap below") untouched.
- Verified visually via Playwright screenshots (dev server, not committed) that the Coming pills render correctly, all five new rows land in their correct table sections, and the summary paragraph shows the dynamic USD price ($7.99/mo from 45-14) with the reframed tail.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a distinct "Coming" cell treatment + the five new Pro rows, flip the Etsy row, add the launch-prep marker** - `c89f671` (feat)
2. **Task 2: Reframe the below-table summary sentence to Pro-today + the coming set** - `b8fc578` (docs)

_Note: no TDD tasks in this plan — plan type is `execute`, not `tdd`._

## Files Created/Modified

- `src/pages/FeaturesPage.tsx` - Added `comingPro` cell class + `ComingCell` helper component; inserted 5 new table rows (2 under Sales & business management, 2 under Quotes & compliance, 1 under Platform & access); flipped the Etsy row's Pro cell to `<ComingCell />`; removed the now-unused `noPro` constant; reframed the below-table summary paragraph.

## Decisions Made

- `comingPro` intentionally has the identical Tailwind value to `yesPro` (both `${tdPro} text-[var(--brand-soft)]`) — the plan's instruction was to keep the Pro column's tint consistent across shipped and coming cells, with the visual "not yet shipped" signal carried entirely by the `ComingCell` pill's border/pill treatment, not by a different cell background.
- Competitor cells on all five new rows default to em dash (`—`) per the no-arbitrary-numbers rule — 45-RESEARCH.md's competitor matrix has no concrete data point for white-label quote features, live carrier-rate APIs, QuickBooks/Wave sync, or cloud device sync on any of Prusa Calculator, Calc3dprint, LayerMath, or SlicePrice3D.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `noPro` constant left dangling by the Etsy-row edit**
- **Found during:** Task 1, first `npm run build` run
- **Issue:** `noPro`'s only caller (the Etsy row's Pro cell, `<td className={noPro}>No</td>`) was replaced with `<ComingCell />` per the plan's own instructions, leaving `const noPro = ...` unused. `tsc -b` (part of `npm run build`) fails hard on `noUnusedLocals` for unused top-level consts, breaking the build gate.
- **Fix:** Deleted the now-dead `const noPro = ...` line. No other file references `noPro`.
- **Files modified:** `src/pages/FeaturesPage.tsx`
- **Verification:** `npm run build` passed clean (1430 tests, tsc -b, bundle-size gate) after the removal.
- **Committed in:** `c89f671` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — build-breaking unused variable, direct consequence of this plan's own edit)
**Impact on plan:** Necessary correctness fix with zero scope creep — no functional or copy change beyond what the plan specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-45-PRO-TABLE is closed. The /features page now honestly represents the full launch-Pro bundle (shipped: hosted quote links; coming: white-label PDF quotes, white-label hosted quote page, live carrier rates & labels, QuickBooks/Wave sync, cloud/real-time device sync; Etsy live sync also flipped to Coming).
- The `PHASE-51-LAUNCH-PREP` marker (grep-able in `src/pages/FeaturesPage.tsx`) is the handoff point for phases 46-50: as each capability ships, its `<ComingCell />` flips to `<td className={yesPro}>Yes</td>`, with a final truth sweep across the table in phase 51.
- Plan 16 was the last of the appended gap-closure plans (14-16) for Phase 45. All three UAT round-2 gaps (G-45-PRICING-CONSISTENCY, G-45-BILLING-CURRENCY, G-45-TERMINOLOGY/G-45-LINUX-COPY, G-45-PRO-TABLE) are now closed.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: src/pages/FeaturesPage.tsx
- FOUND: .planning/phases/45-brand-launch/45-16-SUMMARY.md
- FOUND: commit c89f671 (Task 1)
- FOUND: commit b8fc578 (Task 2)
