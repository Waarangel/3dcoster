---
phase: 39-cost-realism
plan: 06
subsystem: ui
tags: [react, tailwind, forms, accessibility, tou-tariff]

# Dependency graph
requires:
  - phase: 39-03
    provides: SettingsModal TOU band editor UI (native time inputs, initial implementation)
  - phase: 39-05
    provides: CostParametersSection TOU-02 start-time picker + savings hint
provides:
  - Usable HH:MM text-input TOU band window entry in Settings (new-band + edit-mode rows)
  - Reachable "+ Add band" gate with real validation feedback (name / rate+time / overlap)
  - Consistent HH:MM text-input Print Start Time picker in the calculator
  - Regression tests exercising the real add-band typing + click interaction path
affects: [39-cost-realism, insight-layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native <input type=\"time\"> avoided in cramped/dark-themed grids — plain type=\"text\" HH:MM inputs validated through an existing strict parser (parseHHMM) are both more usable AND more testable in jsdom (no segmented-control opacity to jsdom's native-setter+input-event simulation)."
    - "Button disabled-gates keep to the single truly-required precondition (a name), pushing all other validation through the domain layer's returned error message so the feedback path is always reachable instead of permanently dead."

key-files:
  created: []
  modified:
    - src/components/SettingsModal.tsx
    - src/components/calculator/CostParametersSection.tsx
    - src/components/SettingsModal.test.tsx

key-decisions:
  - "Replaced native type=\"time\" TOU band/start-time inputs with type=\"text\" HH:MM inputs validated entirely through the existing upsertBand/parseHHMM boundary — no validation logic was weakened or duplicated."
  - "\"+ Add band\" now disables only on an empty name; rate/time/overlap rejections surface via the existing bandError alert instead of a silent permanently-disabled button."

requirements-completed: [TOU-01, TOU-02]

# Metrics
duration: 25min
completed: 2026-07-07
---

# Phase 39 Plan 06: TOU Band Editor UX Gap Closure Summary

**Replaced native `<input type="time">` controls (unusable in dark theme + cramped grids, and untestable/permanently-disabled in the add-band flow) with validated HH:MM text inputs across Settings' TOU band editor and the calculator's Print Start Time picker, fixing the button-disabled deadlock that made the entire TOU feature unreachable.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- TOU band start/end time fields (new-band grid + edit-mode rows) in `SettingsModal.tsx` are now plain HH:MM text inputs with `placeholder="22:00"`, `maxLength={5}`, and descriptive `aria-label`s — no clipped segments, no light-scheme clock glyph on the dark field.
- Root cause of gap 2 fixed: `"+ Add band"` was hard-gated on all four fields being non-empty, but a native time input reports `value === ''` until every segment is filled, so the button never enabled. It's now gated only on a non-empty name; `handleAddTouBand` routes every other validation outcome (empty/malformed time, invalid rate, overlap) through `upsertBand`'s returned message, rendered by the existing `bandError` alert.
- Calculator's `#tou-start-time` picker (`CostParametersSection.tsx`) swapped to the same HH:MM text-input pattern, fixing the identical dark-glyph problem noted in UAT and keeping entry consistent between Settings and the calculator.
- 3 new regression tests added to the existing `SettingsModal — TOU-01` describe block, exercising the real typing + click path (happy path, invalid/incomplete time, overlap) that the pre-existing tests never touched — they only asserted rendered markup and the Remove-button write path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap SettingsModal band windows to validated HH:MM text inputs + feedback gate** - `51fce5d` (fix)
2. **Task 2: Align calculator Print Start Time picker to the HH:MM text field** - `41d4dd4` (fix)
3. **Task 3: Regression tests for the real add-band interaction path** - `b7d9fc0` (test)

## Files Created/Modified
- `src/components/SettingsModal.tsx` - Band window text inputs (new-band grid + edit-mode row), widened grid columns, rewritten `handleAddTouBand` feedback gate, `"+ Add band"` disabled condition simplified
- `src/components/calculator/CostParametersSection.tsx` - `#tou-start-time` picker swapped from `type="time"` to `type="text"` with HH:MM placeholder/maxLength
- `src/components/SettingsModal.test.tsx` - 3 new tests: happy-path add, invalid/incomplete-time feedback, overlap feedback

## Decisions Made
- Kept all rate/time/overlap validation exclusively inside `useTouTariff.upsertBand`/`parseHHMM` — the text-input swap only changes the UI's ability to reach that validation boundary, never its logic. `parseFloat(newBandRate)` is passed through as-is (including `NaN` on empty input) and `upsertBand`'s own `Number.isFinite` check produces the existing "Enter a valid rate and HH:MM start/end times." message.
- Grid columns for the new-band time fields widened 5rem → 5.5rem so the "22:00" placeholder renders in full without wrapping.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched the plan's `<action>` blocks; no Rule 1-4 auto-fixes were needed beyond what the plan itself specified as the fix.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - no stubs introduced; this plan closes a UAT-surfaced usability gap in already-implemented, already-wired functionality.

## Next Phase Readiness
- TOU-01/TOU-02 gap closure complete: the band editor and calculator start-time picker are both usable, and the "+ Add band" deadlock (which made the entire calculator TOU path unreachable per UAT test 6) is fixed.
- Full build gate green: 84 test files / 1020 tests passed, `lint:no-raw-html` clean, `tsc -b` clean, main chunk 82.7 KB gzipped (under the 300 KB gate), pdf-chunk lazy-load asserts intact.
- No blockers for Phase 40 (Insight Layer) — this was a self-contained UI fix with no schema, pricing-math, or interface changes.

---
*Phase: 39-cost-realism*
*Completed: 2026-07-07*

## Self-Check: PASSED
