---
phase: 47-cloud-sync
plan: 08
subsystem: marketing
tags: [features-page, pricing-page, roadmap, shipped-only-honesty]

# Dependency graph
requires:
  - phase: 47-cloud-sync
    provides: "47-07 mounted CloudSyncSetup + cloud launch-merge — the capability these flips advertise actually ships"
provides:
  - "/features 'Cloud / real-time device sync' row shows shipped Pro 'Yes' (ComingCell removed), label carries the zero-knowledge truth"
  - "/pricing Pro card advertises real-time cloud sync with the end-to-end-encrypted / we-can't-read-your-data line"
  - "src/roadmap.ts no longer lists 'Real-time device sync' (ship-and-remove contract), keeping /roadmap in lockstep with the /features Coming strip"
affects: [51-launch-prep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-16 flip pattern (46 D-15 precedent): marketing ComingCell → shipped Pro 'Yes' only AFTER the capability lands, with the roadmap entry removed in the same plan"

key-files:
  created: []
  modified:
    - src/pages/FeaturesPage.tsx
    - src/pages/PricingPage.tsx
    - src/roadmap.ts
    - src/pages/FAQPage.tsx

key-decisions:
  - "Cloud-sync row label updated to '(hosted, end-to-end encrypted)' so the /features table itself carries the zero-knowledge claim, not just /pricing"
  - "ComingCell doc comment + PHASE-51-LAUNCH-PREP marker phase range updated 47-50 → 48-50 (cloud sync no longer pending)"

patterns-established: []

requirements-completed: [D-16]

coverage:
  - id: F1
    description: "/features cloud-sync row flips from ComingCell to shipped Pro 'Yes'; COMING_TO_PRO strip and intro paragraph no longer present cloud sync as coming; Etsy/carrier/QuickBooks ComingCell rows untouched"
    requirement: "D-16"
    verification:
      - kind: automated
        ref: "grep: no ComingCell on the cloud-sync row; COMING_TO_PRO = Etsy/carrier/QuickBooks only; full vitest suite 1601 passed"
        status: pass
    human_judgment: false
  - id: F2
    description: "/pricing PRO_FEATURES gains the cloud-sync bullet including the zero-knowledge line; price constants untouched"
    requirement: "D-16"
    verification:
      - kind: automated
        ref: "grep 'end-to-end encrypted' in PricingPage.tsx; git diff src/pricing.ts empty (USD 7.99/79 intact)"
        status: pass
    human_judgment: false
  - id: F3
    description: "'Real-time device sync' removed from src/roadmap.ts; remaining pro:true entries (Etsy, carrier, QuickBooks) mirror the /features Coming strip"
    requirement: "D-16"
    verification:
      - kind: automated
        ref: "grep 'Real-time device sync' src/roadmap.ts → no match; 3 pro:true entries remain, matching the 3-item COMING_TO_PRO strip"
        status: pass
    human_judgment: false

duration: single session
completed: 2026-07-24
status: complete
---

# Phase 47 Plan 08: Cloud Sync Marketing Flips Summary

**The D-16 shipped-only-honesty flips: /features cloud-sync ComingCell → shipped Pro "Yes", /pricing Pro card gains the zero-knowledge cloud-sync bullet, and the shipped feature is removed from the public roadmap — with price constants untouched.**

## Accomplishments

- FeaturesPage: cloud-sync row flipped to `yesPro` "Yes" (label now "(hosted, end-to-end encrypted)"), removed from the `COMING_TO_PRO` strip, intro paragraph moves cloud sync into the shipped-Pro clause; Etsy/carrier/QuickBooks stay "Coming" (Phases 48–50); ComingCell doc comment phase range corrected to 48–50.
- PricingPage: `PRO_FEATURES` bullet "Real-time cloud sync across all your devices — end-to-end encrypted, so we can't read your data". `src/pricing.ts` untouched.
- roadmap.ts: "Real-time device sync" entry removed per its ship-and-remove contract; /roadmap and the /features Coming strip stay in comment-lockstep (both now list exactly Etsy, carrier rates, QuickBooks).

## Task Commits

1. **Task 1: /features flip** - `f48db8e` (feat)
2. **Task 2: /pricing bullet + roadmap removal** - `36a6e31` (feat)

## Deviations from Plan

**1. [Rule 2 - stale copy] FAQ still claimed cloud sync doesn't exist**
- **Found during:** Task 2 leftover-reference sweep
- **Issue:** `src/pages/FAQPage.tsx` "Will my data sync between devices?" answered "Not currently … Cloud sync is being considered for future versions" — doubly stale (free file-based sync shipped earlier; cloud sync now ships with Pro) and directly contradicting the flipped marketing surfaces.
- **Fix:** Answer rewritten to the free-floor/Pro-ceiling truth: free = file-based folder sync (no account), Pro = real-time end-to-end-encrypted cloud sync.
- **Committed in:** `36a6e31`

## Verification

- Plan verify greps all pass (no ComingCell on the cloud row; pricing bullet present; roadmap entry gone; `USD 7.99` intact in pricing.ts)
- `npm run build` green (main chunk 105.2 KB gz, under budget)
- Full vitest suite: **1601 passed | 8 skipped | 1 todo** (143 files)

## Next Phase Readiness

- Phase 47 plans 01–08 all executed. 47-07-SUMMARY.md is still owned by the parallel UAT session (uncommitted wrap-up in the main checkout at time of writing) — phase close-out (`/gsd-verify-work 47`) should follow once that lands.
- Phase 51's final truth sweep now has only the three Phase 48–50 ComingCell rows left to flip.

---
*Phase: 47-cloud-sync*
*Completed: 2026-07-24*
