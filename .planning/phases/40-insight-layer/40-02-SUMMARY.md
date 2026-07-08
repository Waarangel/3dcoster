---
phase: 40-insight-layer
plan: 02
subsystem: ui
tags: [react, typescript, vitest, sales-report, period-picker, refactor]

requires:
  - phase: 40-insight-layer/01
    provides: "money-math boundary decision (computePerSaleProfit vs calculateCost) that 40-02..40-05 must never add a third home to"
provides:
  - "resolveDateRange(mode, parts) pure util — single home for RangeMode + period math (src/utils/periodRange.ts)"
  - "PeriodPicker reusable component (src/components/ui/PeriodPicker.tsx), re-exported from src/components/ui"
  - "ReportsSection migrated onto both with byte-identical report output"
affects: [40-insight-layer/03]

tech-stack:
  added: []
  patterns:
    - "Controlled-picker-owns-state + callback-out pattern: PeriodPicker owns mode/year/month/quarter/custom state internally, calls stable-identity callback props (state setters) to report the resolved range and the custom-range-invalid guard back to the parent — avoids effect-loop by requiring callers to pass useState setters directly, not inline arrows"

key-files:
  created:
    - src/utils/periodRange.ts
    - src/utils/periodRange.test.ts
    - src/components/ui/PeriodPicker.tsx
  modified:
    - src/components/ReportsSection.tsx
    - src/components/ui/index.ts

key-decisions:
  - "PeriodPicker exposes onCustomRangeInvalidChange as a second optional callback (beyond the plan's literal onRangeChange) so ReportsSection can still disable the Download buttons and show the backwards-range message exactly as before — required to preserve the T-40-03 threat mitigation without ReportsSection re-deriving mode/customStart/customEnd itself, which would have reintroduced the duplicate state machine the plan explicitly prohibits"
  - "ReportsSection seeds its range state with resolveDateRange('month', ...) at useState init time (not an empty placeholder) so the first paint before PeriodPicker's mount effect fires matches the default the picker settles on — avoids a one-frame flash of an empty/wrong range label"

requirements-completed: [INS-01]

coverage:
  - id: D1
    description: "resolveDateRange(mode, parts) is a pure function producing the same start/end/label as the pre-extraction ReportsSection inline logic for month/quarter/year/ytd/custom, including Dec and Q4 boundaries"
    requirement: "INS-01"
    verification:
      - kind: unit
        ref: "src/utils/periodRange.test.ts — all 7 tests (month, month-December, quarter Q2, quarter Q4, year, ytd, custom)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PeriodPicker renders the mode Select plus mode-specific controls (month/year, quarter/year, year, custom From/To) with useId-associated labels, and reports range + custom-range-invalid state back to the parent"
    requirement: "INS-01"
    verification:
      - kind: unit
        ref: "src/components/ReportsSection.test.tsx — 5 existing tests pass unchanged against ReportsSection rendering <PeriodPicker>"
      - kind: other
        ref: "node scripts/lint-no-raw-html.mjs && npx tsc -b — both exit 0"
        status: pass
    human_judgment: true
    rationale: "No dedicated PeriodPicker.test.tsx was authored this plan — visual/interactive correctness of the mode-switching UI (month <-> quarter <-> year <-> custom control swap, backwards-range message) was verified via existing ReportsSection tests + manual code read, not a new isolated component test. Flagging for human UAT sign-off on the Reports tab period selector."
  - id: D3
    description: "ReportsSection consumes periodRange + PeriodPicker with unchanged report output — no duplicate RangeMode declaration anywhere else in the codebase"
    requirement: "INS-01"
    verification:
      - kind: unit
        ref: "full vitest suite: 89 files / 1083 tests passed, 1 todo"
        status: pass
      - kind: other
        ref: "grep -rn 'type RangeMode' src/ — only src/utils/periodRange.ts declares it"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-08
status: complete
---

# Phase 40 Plan 02: Extract PeriodPicker Summary

**Extracted ReportsSection's inline period-picker state machine into a pure `resolveDateRange` util + reusable `PeriodPicker` component, then migrated ReportsSection onto both with zero behavioral change — the "one shared component" D-04 promised but that didn't exist yet.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-08T16:23:25-04:00
- **Completed:** 2026-07-08T16:26:24-04:00
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `resolveDateRange(mode, parts)` is now the single pure implementation of month/quarter/year/ytd/custom range resolution — proven byte-identical to the pre-extraction ReportsSection logic via 7 unit tests including Dec/Q4 boundaries
- `PeriodPicker` is a reusable, fully-accessible (useId-labelled) period-selection control with zero duplicated state — the Insights tab (40-03) can now import it directly
- `ReportsSection` renders `<PeriodPicker>` in place of ~125 lines of inline mode/year/month/quarter/custom JSX + state, with the Failures sub-section, PDF/CSV handlers, and report table completely untouched
- `RangeMode` has exactly one home (`src/utils/periodRange.ts`) — grep-verified

## Task Commits

Each task was committed atomically (TDD RED/GREEN split for Task 1):

1. **Task 1: Extract resolveDateRange + RangeMode into a pure util**
   - `00009d5` (test) — RED: 7 failing tests against a throwing stub
   - `3f99d6f` (feat) — GREEN: full implementation, all 7 tests pass
2. **Task 2: Build PeriodPicker component and migrate ReportsSection onto it** - `8e654e7` (feat)

**Plan metadata:** commit pending (docs: complete plan)

## Files Created/Modified
- `src/utils/periodRange.ts` - `RangeMode`, `PeriodParts`, `MONTHS`, `nowParts`/`isoDay`/`endOfToday`, `resolveDateRange(mode, parts)` — pure, no React
- `src/utils/periodRange.test.ts` - 7 unit tests covering all 5 modes + Dec/Q4 boundaries
- `src/components/ui/PeriodPicker.tsx` - Owns mode/year/month/quarter/custom state; renders the mode Select + mode-specific controls; reports range + custom-range-invalid via callback props
- `src/components/ReportsSection.tsx` - Deleted local `RangeMode`/`MONTHS`/`nowParts`/`isoDay`/`endOfToday`/range-useMemo; renders `<PeriodPicker>`; range now lives in `useState` fed by the picker's callback
- `src/components/ui/index.ts` - Re-exports `PeriodPicker` + `PeriodPickerProps`

## Decisions Made
- Added `onCustomRangeInvalidChange` as a second PeriodPicker callback prop (beyond the plan's literal `onRangeChange`) — required so ReportsSection can still disable the Download PDF/CSV buttons and show the "From is after To" message exactly as before, without ReportsSection re-deriving `customStart`/`customEnd` itself (which would reintroduce the duplicate state machine Plan 40-02 explicitly prohibits). This is Rule 2 (missing critical functionality) — the T-40-03 threat mitigation depends on it.
- Seeded ReportsSection's `range` state with `resolveDateRange('month', ...)` at mount instead of a placeholder, so the range label doesn't flash empty before PeriodPicker's mount-time effect reports the real default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added a validity callback so the customRangeInvalid guard survives the state-lifting**
- **Found during:** Task 2 (PeriodPicker + ReportsSection migration)
- **Issue:** The plan's `<action>` describes `onRangeChange(range: SalesReportRange)` as PeriodPicker's only callback, but ReportsSection needs to know when the custom "From" > "To" guard is tripped (to disable the Download buttons and show the warning message) — the threat register's T-40-03 mitigation. Lifting `customStart`/`customEnd` state into PeriodPicker without a way to report the invalid flag back would have either broken that mitigation or forced ReportsSection to re-derive it independently (recreating the duplicated state machine this plan exists to eliminate).
- **Fix:** Added an optional `onCustomRangeInvalidChange(isInvalid: boolean)` prop to `PeriodPickerProps`, fired from a `useEffect` alongside the existing `onRangeChange` effect. ReportsSection wires it to a new `customRangeInvalid` state slot via `setCustomRangeInvalid` (a stable setState identity, avoiding effect loops the same way `onRangeChange={setRange}` does).
- **Files modified:** `src/components/ui/PeriodPicker.tsx`, `src/components/ReportsSection.tsx`
- **Verification:** `src/components/ReportsSection.test.tsx` (5 tests) + full vitest suite (1083 tests) pass; `node scripts/lint-no-raw-html.mjs` and `npx tsc -b` both exit 0
- **Committed in:** `8e654e7` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Additive only — preserves an explicit threat-model mitigation (T-40-03) that the plan's literal callback signature would otherwise have dropped. No scope creep; no change to report output, Failures sub-section, or PDF/CSV handlers.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`PeriodPicker` and `resolveDateRange`/`RangeMode` are ready for the Insights tab (40-03) to import with zero duplication, per the plan's prohibition. `ReportsSection` behavior is unchanged — Reports tab period selection produces identical totals to before this plan.

No blockers or concerns.

---
*Phase: 40-insight-layer*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created/modified files found on disk; all 3 task commits (`00009d5`, `3f99d6f`, `8e654e7`) found in git log.
