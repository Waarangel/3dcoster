---
phase: 40-insight-layer
plan: 03
subsystem: ui
tags: [react, typescript, dexie, insights, wage-analytics, product-ranking]

# Dependency graph
requires:
  - phase: 40-insight-layer (40-01)
    provides: computeWageHeadline / computeProductRanking / computePrinterPayback pure derivation utilities in src/utils/insights.ts
  - phase: 40-insight-layer (40-02)
    provides: extracted shared PeriodPicker component + resolveDateRange period-range util
provides:
  - Insights tab registered in App.tsx (Tab union, VALID_TABS, tabs array, roving-tabindex keyboard nav)
  - InsightsPanel orchestrator that owns its own Dexie hooks (useJobs/useAllSales/usePrinterInstances/useUserProfile) — no data prop-drilling through App.tsx
  - WageInsight: aggregate true-hourly-wage headline + optional target-wage gap (no per-product wage column, no judgment score)
  - ProductRanking: sold-product profitability ranking (top/bottom visually distinguished) + separate "No sales yet" unsold list + rule-of-thumb benchmark InfoTooltip
  - UserProfile.targetHourlyRate optional field + Settings "Costs & Rates" input
  - PeriodPicker 'all-time' RangeMode (additive, D-04 default for Insights; ReportsSection default unchanged at 'month')
affects: [40-04-printer-roi, 40-05-what-if-simulator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab-owns-its-data: new App.tsx tabs call their own Dexie hooks directly instead of receiving props from App.tsx (precedent: ReportsSection; now also InsightsPanel)"
    - "Shared range-picker widening: extending an existing enum (RangeMode) + optional prop (defaultMode) instead of forking a second picker/state machine when a new consumer needs a different default"

key-files:
  created:
    - src/components/insights/InsightsPanel.tsx
    - src/components/insights/WageInsight.tsx
    - src/components/insights/ProductRanking.tsx
  modified:
    - src/App.tsx
    - src/features.ts
    - src/types.ts
    - src/components/SettingsModal.tsx
    - src/components/ui/PeriodPicker.tsx
    - src/utils/periodRange.ts
    - src/utils/periodRange.test.ts
    - src/components/ui/icons/index.ts
    - src/components/ui/icons/TrendingUpIcon.tsx

key-decisions:
  - "PeriodPicker gained an 'all-time' RangeMode + defaultMode prop (Rule 2 deviation) rather than duplicating a second range picker for the Insights tab, to satisfy the locked D-04 all-time default without touching ReportsSection's existing 'month' default"
  - "InsightsPanel filters sales into the selected PeriodPicker range itself before calling computeWageHeadline/computeProductRanking, since insights.ts has no built-in range parameter"

patterns-established:
  - "New App tabs own their Dexie hooks directly — App.tsx passes only callbacks (onSwitchTab, onEditJob), never data props"

requirements-completed: [INS-01]

coverage:
  - id: D1
    description: "Insights tab reachable at /app?tab=insights with roving-tabindex keyboard nav matching other tabs; URL survives refresh"
    requirement: "INS-01"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 2-3 (URL + keyboard)"
        status: pass
    human_judgment: true
    rationale: "Keyboard focus behavior and URL-survives-refresh require a human driving a real browser session; not covered by an automated test in this plan"
  - id: D2
    description: "Wage headline shows aggregate true hourly wage and, once a target wage is set in Settings, the gap versus that target — no per-product wage column, no judgment score"
    requirement: "INS-01"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 4 and step 6"
        status: pass
    human_judgment: true
    rationale: "Correct rendering against the user's real seeded job/sale data and Settings round-trip needs visual/human confirmation"
  - id: D3
    description: "Product ranking lists sold products by profit-per-printer-hour with top/bottom visually distinguished, benchmark InfoTooltip reads as a rough range (not a single cited source), and unsold products appear separately under a 'No sales yet' heading"
    requirement: "INS-01"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 4-5"
        status: pass
    human_judgment: true
    rationale: "Visual distinction and tooltip copy tone require human judgment, not just presence-of-text assertions"
  - id: D4
    description: "Period picker narrows wage/ranking numbers; empty period shows an honest empty state"
    requirement: "INS-01"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 7"
        status: pass
    human_judgment: true
    rationale: "Requires interactively changing the period and observing the derived numbers change, plus confirming empty-state honesty"
  - id: D5
    description: "npx tsc -b and node scripts/lint-no-raw-html.mjs both exit 0 across all Insights tab files"
    requirement: "INS-01"
    verification:
      - kind: other
        ref: "npx tsc -b (exit 0); node scripts/lint-no-raw-html.mjs (exit 0), re-run at continuation resume"
        status: pass
    human_judgment: false

# Metrics
duration: ~5min active work (Tasks 1-2) + human-verify checkpoint hold
completed: 2026-07-08
status: complete
---

# Phase 40 Plan 03: Insights Tab — Wage Headline & Product Ranking Summary

**Insights tab live at /app?tab=insights with an aggregate true-hourly-wage headline + target-wage gap and a profit-per-printer-hour product ranking, both driven by a shared all-time-default period picker; InsightsPanel owns its own Dexie subscriptions with zero data prop-drilling through App.tsx.**

## Performance

- **Duration:** ~5 min active implementation (Tasks 1-2, 16:43-16:46 local); checkpoint held for human verification before this continuation resumed and closed it out
- **Started:** 2026-07-08T20:33:08Z (plan start, per prior executor)
- **Completed:** 2026-07-08T21:27:36Z (continuation close-out)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 12 (3 created, 9 modified)

## Accomplishments
- Registered the Insights tab end-to-end: `Tab` union, `VALID_TABS`, tabs array, and roving-tabindex keyboard nav in `App.tsx`, with a `NewBadge` overlay registered under `insights-tab` in `features.ts`
- Built `InsightsPanel` as a self-contained orchestrator that calls `useJobs`/`useAllSales`/`usePrinterInstances`/`useUserProfile` directly — no insight data threaded through `App.tsx` props, matching the plan's explicit prohibition
- Shipped `WageInsight` (single aggregate true-hourly-wage stat + optional target-wage gap phrasing, no per-product column, no judgment score) and `ProductRanking` (sold-product ranking by profit/printer-hour with top/bottom visually distinguished, separate "No sales yet" unsold list, and a rule-of-thumb — not single-source — benchmark `InfoTooltip`)
- Added an optional `targetHourlyRate` field to `UserProfile` and a matching "Target hourly wage" input in Settings → Costs & Rates, wired through the existing `onUserProfileChange` update pattern
- Extended the shared `PeriodPicker`/`resolveDateRange` with an additive `'all-time'` `RangeMode` (plus `defaultMode` prop) so the Insights tab defaults to all-time (D-04) without disturbing `ReportsSection`'s existing 'month' default
- Human-verify checkpoint (Task 3) presented and **approved** by the user — no issues reported

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the Insights tab and mount InsightsPanel orchestrator** - `6cd806b` (feat)
2. **Task 2: WageInsight headline, product ranking, and target-wage Setting** - `3e6feb8` (feat)
3. **Task 3: Human-verify the Insights tab** - checkpoint, no code changes; approved by user this session (no commit — verification-only task)

**Plan metadata:** (this commit) `docs(40-03): complete insights-tab-wage-and-ranking plan`

## Files Created/Modified
- `src/components/insights/InsightsPanel.tsx` - Orchestrator: owns Dexie hooks, holds selected period range (default all-time), renders PeriodPicker + WageInsight + ProductRanking, empty state
- `src/components/insights/WageInsight.tsx` - Aggregate true-hourly-wage stat + optional target gap
- `src/components/insights/ProductRanking.tsx` - Ranked sold-product list, unsold list, benchmark InfoTooltip
- `src/App.tsx` - Tab union/VALID_TABS/tabs array entry, `<InsightsPanel onSwitchTab onEditJob />` render (no data props)
- `src/features.ts` - `insights-tab` NEW-badge registry key
- `src/types.ts` - `UserProfile.targetHourlyRate?: number`
- `src/components/SettingsModal.tsx` - Target hourly wage input in Costs & Rates tab
- `src/components/ui/PeriodPicker.tsx` - `defaultMode` prop (defaults to `'month'`, unchanged for existing callers)
- `src/utils/periodRange.ts` - `'all-time'` added to `RangeMode` + `resolveDateRange` handling
- `src/utils/periodRange.test.ts` - Coverage for the new `'all-time'` mode
- `src/components/ui/icons/TrendingUpIcon.tsx`, `src/components/ui/icons/index.ts` - New icon used on the Insights tab/headline

## Decisions Made
- Extended the existing `PeriodPicker`/`RangeMode` with an `'all-time'` value and `defaultMode` prop instead of building a second range picker for Insights — keeps a single source of truth for period selection across Reports and Insights (Rule 2 deviation, see below)
- `InsightsPanel` performs its own sales-range filtering before calling `computeWageHeadline`/`computeProductRanking`, since those pure functions in `insights.ts` don't take a range parameter — filtering lives at the UI-composition layer, not in the math layer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added 'all-time' RangeMode + PeriodPicker defaultMode prop**
- **Found during:** Task 1 (Register the Insights tab and mount InsightsPanel)
- **Issue:** The plan's `must_haves.truths` locks D-04 ("all-time is the default" for the Insights period picker), but the 40-02-extracted `PeriodPicker`/`RangeMode` only supported `month|quarter|year|ytd|custom` (ReportsSection's original modes) with no all-time option and no way to set a different default per consumer. Without this, the Insights tab could not satisfy its own locked truth using the shared picker the plan explicitly requires reusing.
- **Fix:** Added `'all-time'` to `RangeMode` in `periodRange.ts` with corresponding `resolveDateRange` handling, and added an optional `defaultMode` prop to `PeriodPicker` (default `'month'`, so `ReportsSection`'s existing behavior is unchanged). `InsightsPanel` passes `defaultMode="all-time"`.
- **Files modified:** `src/utils/periodRange.ts`, `src/utils/periodRange.test.ts`, `src/components/ui/PeriodPicker.tsx`
- **Verification:** New Vitest cases for the `'all-time'` mode pass; `npx tsc -b` and `node scripts/lint-no-raw-html.mjs` both exit 0; ReportsSection's default-to-'month' behavior confirmed unchanged (no regression in its existing tests)
- **Committed in:** `6cd806b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 2 - missing critical)
**Impact on plan:** Necessary to satisfy the plan's own locked D-04 truth using the shared picker as instructed (no duplicate state machine created). No scope creep — ReportsSection behavior is provably unchanged.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `InsightsPanel` is now the established orchestrator slot for 40-04 (printer ROI) and 40-05 (what-if simulator) to extend with additional sections
- `PeriodPicker`'s `defaultMode` prop is available for any future consumer needing a non-'month' default
- No blockers for 40-04/40-05

---
*Phase: 40-insight-layer*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 9 key files (InsightsPanel.tsx, WageInsight.tsx, ProductRanking.tsx, App.tsx, features.ts, types.ts, SettingsModal.tsx, PeriodPicker.tsx, periodRange.ts) confirmed present on disk. Both task commits (`6cd806b`, `3e6feb8`) confirmed present in `git log --oneline --all`.
</content>
