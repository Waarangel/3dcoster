---
phase: 46-white-label-quotes
plan: 10
subsystem: pro-billing
tags: [react, vitest, tauri, supabase, hosted-quotes]

# Dependency graph
requires:
  - phase: 46-white-label-quotes (plan 02)
    provides: desktop Supabase client, useProAuth OTP path, *.supabase.co CSP allowance
  - phase: 46-white-label-quotes (plan 04)
    provides: usePublishedQuote hook (publish/unpublish/refreshStatuses), the container-level PERF-09 threading pattern ShareQuoteButton consumes
provides:
  - ShareQuoteButton renders on desktop (Tauri) for both signed-out and signed-in states, closing the last desktop-parity gap for Share-quote publishing
  - Corrected 46-UAT.md test-6 expectation (button PRESENT on desktop, not absent)
  - Documented supersession of 46-02-PLAN.md:49's "stays web-only" scope decision by G-46-6 / D-08
affects: [46-white-label-quotes, launch-checklist, BillingPanel-web-only-open-question]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/components/pro/ShareQuoteButton.tsx
    - src/components/pro/ShareQuoteButton.test.tsx
    - .planning/phases/46-white-label-quotes/46-UAT.md

key-decisions:
  - "G-46-6 / D-08 supersedes 46-02-PLAN.md:49's narrow scope decision ('Hosted-quote PUBLISHING stays web-only … Do not remove ShareQuoteButton's gate') — the founder's standing product rule (ALL Pro features work on both web and desktop for v2.0, no exceptions) wins."
  - "No new dependency added — the existing toast-with-full-URL clipboard fallback already gives desktop parity; the optional tauri-plugin-clipboard-manager polish from the debug session was deliberately declined to avoid an unnecessary package-legitimacy gate."
  - "OPEN QUESTION for founder: BillingPanel.tsx:50 carries a SEPARATE web-only Pro gate for Paddle billing management, deliberately NOT touched by this plan. Founder must rule on whether the 'no web-only Pro features' rule extends to billing management, or stays scoped to feature surfaces like Share-quote."

requirements-completed: [D-08]

coverage:
  - id: D1
    description: "ShareQuoteButton renders on desktop (Tauri) for the signed-in Share/Unpublish control and the signed-out Pro pitch chip, with the __IS_TAURI__ gate removed"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "src/components/pro/ShareQuoteButton.test.tsx#ShareQuoteButton — desktop parity (G-46-6) > renders the signed-in Share control under the Tauri global"
        status: pass
      - kind: unit
        ref: "src/components/pro/ShareQuoteButton.test.tsx#ShareQuoteButton — desktop parity (G-46-6) > renders the signed-out Pro pitch chip under the Tauri global"
        status: pass
    human_judgment: false
  - id: D2
    description: "Existing signed-out (Pro chip -> pitch modal) and signed-in (publish/unpublish/error toast) web behaviors remain unchanged after the gate removal"
    verification:
      - kind: unit
        ref: "src/components/pro/ShareQuoteButton.test.tsx (5 pre-existing cases, all still passing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "46-UAT.md test-6 expected text corrected to assert the Share-quote button is PRESENT on desktop (was: stays ABSENT everywhere on desktop); no other UAT content changed"
    verification:
      - kind: other
        ref: "grep -qi 'present' 46-UAT.md && ! grep -qi 'stays ABSENT everywhere on desktop' 46-UAT.md"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 10: Desktop Share-Quote Parity (G-46-6 Gap Closure) Summary

**Removed the single `__IS_TAURI__` self-gate on ShareQuoteButton so hosted-quote publishing works identically on web and desktop, closing the last "web-only Pro feature" gap from the 46-UAT round.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-23T15:41:08Z
- **Completed:** 2026-07-23T15:43:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ShareQuoteButton now renders on desktop for both signed-out (Pro pitch chip) and signed-in (Share/Unpublish control) states — no code changes needed at any of the three unconditional mount sites (JobsManager pending/declined rows, PrintQuoteModal)
- Inverted the desktop-gate test into two desktop-parity cases (signed-in control renders, signed-out chip renders); all 5 pre-existing web-behavior cases pass unchanged
- Corrected 46-UAT.md test-6's expected text to assert the button's presence on desktop instead of its absence, so a future re-verification checks the right thing
- Documented that G-46-6/D-08 explicitly supersedes 46-02-PLAN.md:49's earlier "Do not remove ShareQuoteButton's gate" scope decision

## Task Commits

1. **Task 1: Remove the desktop gate on ShareQuoteButton and invert the desktop test** - `9f07ac5` (test, RED), `93389f6` (feat, GREEN)
2. **Task 2: Correct the UAT test-6 expectation to the new (both-platform) truth** - `8083882` (docs)

**Plan metadata:** (this commit, docs: complete plan)

_TDD flow followed: RED (9f07ac5, confirmed both new cases failed against the still-gated component) → GREEN (93389f6, all 7 cases pass). No refactor commit needed._

## Files Created/Modified
- `src/components/pro/ShareQuoteButton.tsx` - Removed the `if (__IS_TAURI__) return null` early return; rewrote the header comment to record the D-08/G-46-6 supersession of the 46-02 web-only scope decision
- `src/components/pro/ShareQuoteButton.test.tsx` - Replaced the single "renders nothing under __IS_TAURI__" case with two parity cases (signed-in control renders, signed-out chip renders) under `describe('ShareQuoteButton — desktop parity (G-46-6)')`
- `.planning/phases/46-white-label-quotes/46-UAT.md` - Test 6 expected text corrected from "stays ABSENT everywhere on desktop" to "is PRESENT on quote rows"

## Decisions Made
- G-46-6/D-08 supersedes 46-02-PLAN.md:49 — the founder's standing "ALL Pro features work on both platforms" rule overrides the earlier narrower scope decision that kept hosted-quote publishing web-only.
- Zero new dependencies: the optional tauri-plugin-clipboard-manager / `@tauri-apps/plugin-shell` open-hosted-page polish flagged in the debug session was intentionally NOT implemented — the existing toast-with-full-URL fallback already delivers desktop parity, and adding a Rust plugin here would require an unnecessary package-legitimacy checkpoint for zero incremental parity benefit.
- BillingPanel.tsx:50's separate web-only Paddle billing gate was deliberately left untouched and is flagged below as an open question for the founder.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Open Question for Founder

**BillingPanel.tsx:50** carries a SEPARATE web-only Pro gate for Paddle billing management (unrelated code path from ShareQuoteButton). This plan's scope was limited to Share-quote parity per G-46-6 and deliberately does NOT touch BillingPanel. The founder's repeated "no web-only Pro features" rule could reasonably be read to extend to billing management too — this needs an explicit founder ruling before it's either fixed or explicitly accepted as an intentional exception (billing management arguably differs from a feature surface: Paddle's own customer portal is web-based by nature). Tracked here rather than actioned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- G-46-6 gap closed; 46-UAT.md test-6 now reflects the correct expected behavior for future re-verification via `/gsd-verify-work`.
- BillingPanel.tsx:50 open question remains for founder decision — does not block phase completion, tracked as a pending item.
- Full suite (1493 tests) and build (main chunk 101.6 KB gz, pdf/three lazy-chunk gates) pass with no regressions from this change.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*
