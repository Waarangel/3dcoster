---
phase: 36-performance-tier-5
plan: 02
subsystem: ui
tags: [react, useEffect, performance, dep-array, eslint-disable]

requires:
  - phase: 34-live-papercut-fixes
    provides: FIX-04 source-contract test pattern for CostCalculator.test.tsx
  - phase: 36-performance-tier-5 plan 01
    provides: PERF-09 + PERF-10 (JobsManager hotspots closed; this plan closes PERF-11)

provides:
  - CostCalculator pricing useEffect dep array trimmed to [trueCost, lastEdited]
  - Eliminates double render per keystroke on cost inputs
  - Source-contract tests proving dep array shape, eslint-disable present, body unchanged

affects: [36-performance-tier-5, v1.9-hardening milestone]

tech-stack:
  added: []
  patterns:
    - "Intentional dep-array omission with eslint-disable-next-line react-hooks/exhaustive-deps + inline PERF rationale comment"

key-files:
  created: []
  modified:
    - src/components/CostCalculator.tsx
    - src/components/CostCalculator.test.tsx

key-decisions:
  - "Option A (dep trimming) chosen over Option B (event-handler) per research: event-handler approach would need a second useEffect watching trueCost, recreating the same problem"
  - "eslint-disable-next-line comment placed immediately before closing dep array line per RESEARCH Pitfall 3"
  - "Test uses per-line check (split newlines, find dep-array line) not regex across the full source to avoid false-match against the PERF-11 rationale comment which mentions the removed deps by name"

patterns-established:
  - "PERF-11 pattern: when a useEffect sets state values that are also listed as deps, trim those set-values from the dep array and document with an inline rationale comment (React 18 batch semantics make the closure safe at keystroke time)"

requirements-completed: [PERF-11]

duration: 12min
completed: 2026-06-26
---

# Phase 36 Plan 02: Performance Tier 5 — PERF-11 Summary

**Pricing useEffect dep array trimmed to [trueCost, lastEdited] eliminating double render per keystroke on CostCalculator cost inputs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-26T08:48:00Z
- **Completed:** 2026-06-26T09:00:00Z
- **Tasks:** 2 (Task 1: code + tests; Task 2: regression gate)
- **Files modified:** 2

## Accomplishments

- Trimmed the pricing useEffect dep array from `[trueCost, lastEdited, profitMarginPercent, targetProfit, sellingPrice]` to `[trueCost, lastEdited]` — the three removed values are set BY the effect, so including them caused the effect to fire a second time after each render, producing two derivation passes per keystroke
- Added `// eslint-disable-next-line react-hooks/exhaustive-deps` with an inline PERF-11 rationale comment explaining the stale-closure safety analysis (React 18 batch semantics, no async setter on trueCost)
- Effect body (trueCost <= 0 guard + three branch keywords margin/profit/price) left byte-for-byte identical — zero behavioral change
- editingJob rebase path preserved: `setLastEdited('price')` in the editingJob population effect still triggers the pricing effect, re-deriving profit/margin against current trueCost
- Added 6 source-contract tests to CostCalculator.test.tsx covering: dep array shape, removed deps absent from the closing dep-array line, eslint-disable comment present, PERF-11 token present, guard and all three branch keywords present
- Full regression gate: 744 tests passed, `tsc -b` clean, `npm run lint` clean (0 errors, 21 pre-existing warnings; exhaustive-deps warning on pricing effect correctly silenced)

## Task Commits

Each task was committed atomically:

1. **Task 1: Trim pricing useEffect dep array + source-contract tests** - `60cb940` (perf)
2. **Task 2: Regression gate** - verification-only; no code changes beyond Task 1

**Plan metadata:** committed with SUMMARY below

## Files Created/Modified

- `src/components/CostCalculator.tsx` — pricing useEffect line 825 dep array trimmed; PERF-11 rationale comment block added on lines 825-831 above the new `}, [trueCost, lastEdited]);` closing line
- `src/components/CostCalculator.test.tsx` — PERF-11 source-contract describe block added (6 tests); all 15 tests pass (14 active + 1 todo)

## Decisions Made

- Option A (dep trimming) chosen over Option B (event-handler) per RESEARCH §PERF-11: event-handler approach would need a second useEffect watching trueCost, recreating the exact problem. Dep trimming is minimal, directly targets the documented double-render, and leaves the component structure intact.
- `// eslint-disable-next-line react-hooks/exhaustive-deps` placed immediately before the closing dep-array line (RESEARCH Pitfall 3 guidance).
- Test for "removed deps not on dep-array line" uses line-by-line scanning (find the specific `}, [trueCost, lastEdited])` line, then assert it contains no removed deps) rather than a broad regex — the PERF-11 rationale comment itself contains the removed dep names, so a naive regex would false-match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test regex false-matched PERF-11 rationale comment**

- **Found during:** Task 1 (TDD GREEN — first test run after implementing the fix)
- **Issue:** The source-contract test `expect(COST_CALC_SRC).not.toMatch(/\[trueCost.*profitMarginPercent/)` failed because the PERF-11 rationale comment I added contains `[trueCost, lastEdited]. profitMarginPercent` on a single line — the regex matched the comment, not the dep array
- **Fix:** Replaced the broad regex with a line-level check: split source on newlines, find the line containing `}, [trueCost, lastEdited])`, assert that line does not contain the removed dep names
- **Files modified:** `src/components/CostCalculator.test.tsx`
- **Verification:** `npx vitest run src/components/CostCalculator.test.tsx` exits 0 with 14 passing tests
- **Committed in:** `60cb940` (included in Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test precision bug)
**Impact on plan:** Necessary correction for a test that would have been a false negative. No scope creep.

## Issues Encountered

None beyond the auto-fixed test precision issue above.

## Threat Flags

None — no new attack surface. This plan modifies only a local React state derivation hook with no network, auth, file, or schema boundaries touched.

## Known Stubs

None — no stub values introduced.

## Self-Check

- [x] `src/components/CostCalculator.tsx` modified — dep array line confirmed as `}, [trueCost, lastEdited]);`
- [x] `src/components/CostCalculator.test.tsx` modified — PERF-11 describe block present with 6 tests
- [x] Commit `60cb940` exists (verified via git log)
- [x] 744 tests pass (`npx vitest run`)
- [x] `tsc -b` exits 0
- [x] `npm run lint` exits 0 (0 errors)

## Self-Check: PASSED

## Next Phase Readiness

Phase 36 (Performance Tier 5) is now fully complete — all three requirements closed:
- PERF-09: useQuotes() lifted to JobsManager parent (plan 01)
- PERF-10: materialsById Map O(1) lookup (plan 01)
- PERF-11: pricing useEffect dep trimming (this plan)

v1.9 hardening milestone status: Phases 34 and 35 complete; Phase 36 complete; Phase 37 (HYG-11/12, STRETCH) remains. Ready to proceed to Phase 37 or close v1.9 if Phase 37 is dropped.

---
*Phase: 36-performance-tier-5*
*Completed: 2026-06-26*
