# Phase 33 — ABSORBED INTO PHASE 40 (2026-07-08)

**Status: archived.** This directory holds Phase 33's original GSD records
(SPEC + 33-01/02/03 plans and summaries), copied verbatim from the parked
`feat/insight-pricing-coach` branch onto `main` for historical reference.
Phase 33 itself is retired and its branch is being decommissioned (D-15).

## What actually happened

Phase 33 was scoped and partially executed on a standalone branch before
v2.0's Phase 40 (Insight Layer) was roadmapped. Rather than merging the
branch wholesale, v2.0 planning (2026-07-03) folded Phase 33's intent into
Phase 40's INS-01/02/03 requirements and re-derived the implementation from
scratch against the post-Phase-38/39 codebase:

- **Ported as-is:** the three pure math utilities and their test suites —
  `printHourProfit.ts` (profit-per-print-hour + $1-5/hr benchmark grading),
  `pricingCoach.ts` (margin-band pricing coach math), and
  `costAllocation.ts` (cost-breakdown %-segment builder). These landed in
  Phase 40 Plan 01 (`3ca6c37`) byte-for-byte from the branch, tests included.
- **Deferred to Phase 45:** the calculator-UI wiring for `pricingCoach.ts`
  and `costAllocation.ts` (cost-allocation visualization bar, "Why this
  price?" dynamic coach) was intentionally NOT re-attached to any component
  in Phase 40 — that UI work rides along with the Phase 45 Cost-Truth Dark
  redesign, where it fits the new calculator layout rather than the old one.
- **Superseded by INS-01/02/03:** the "profit/hr-vs-target gauge" idea
  became Phase 40's true-hourly-wage headline (`WageInsight`) and per-printer
  payback tracker (`PrinterROI`), built against the richer Phase 39 cost
  model (failure rate, TOU electricity, maintenance amortization) that
  didn't exist when Phase 33 was originally scoped.

## Where to look instead

- `src/utils/printHourProfit.ts`, `src/utils/pricingCoach.ts`,
  `src/utils/costAllocation.ts` — the ported utils, live on `main`.
- `.planning/phases/40-insight-layer/` — the actual delivered Insight Layer
  (Insights tab, wage headline, product ranking, printer ROI, what-if
  simulator).

## Retiring the branch

The `feat/insight-pricing-coach` branch and its worktree
(`/Users/marcusdickinson/Projects/3DCoster-insight`) are retired manually
after this archive lands — see Phase 40 Plan 05 Task 5 (human-gated,
destructive git action).
