---
phase: 36-performance-tier-5
plan: 01
subsystem: ui
tags: [react, performance, dexie, usememo, usecallback, react-memo]

# Dependency graph
requires:
  - phase: 35-accessibility-tier-4
    provides: JobsManager.tsx and JobsManager.test.tsx baseline with full a11y suite green
provides:
  - Single useQuotes() subscription in JobsManager parent; quotesForJob prop threaded to OrdersSection/OrdersQuoteRows
  - materialsById Map (O(1)) replacing Array.find per render in getFilamentName
  - Source-contract tests for both refactors
affects: [36-02-PLAN (PERF-11 in CostCalculator)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lift-and-thread: lift Dexie subscriptions to the parent JobsManager, pass slices down as props rather than calling hooks per row"
    - "getQuotesForJob useCallback([quotesByJobId]) — stable identity when Map ref unchanged, prevents JobCard memo bypass"
    - "useMemo Map for O(1) lookup: new Map(array.map(item => [item.id, item])) pattern"

key-files:
  created: []
  modified:
    - src/components/JobsManager.tsx
    - src/components/JobsManager.test.tsx

key-decisions:
  - "PERF-09: jobId prop kept in OrdersQuoteRows signature (renamed to _jobId internally) for API stability rather than removing it"
  - "PERF-09: source-contract test filters comment/JSDoc lines before counting useQuotes() invocations (regex alone would match documentation references)"
  - "PERF-10: materialsById placed above getFilamentName in the component body so getFilamentName useCallback can depend on it"

patterns-established:
  - "Prop-thread pattern: data hooks lifted to parent, per-row subcomponents receive pre-sliced arrays as props"
  - "Source-contract tests: readFileSync + line-level filtering to verify structural invariants without mounting the full component"

requirements-completed: [PERF-09, PERF-10]

# Metrics
duration: 15min
completed: 2026-06-26
---

# Phase 36 Plan 01: Performance Tier 5 (PERF-09 + PERF-10) Summary

**Eliminated 160 Dexie subscriptions-per-write by lifting useQuotes() to the JobsManager parent and passing quotesForJob props; replaced O(N×M) Array.find with a materialsById Map for O(1) filament name lookups**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-26T08:29:00Z
- **Completed:** 2026-06-26T08:36:00Z
- **Tasks:** 3 (2 TDD tasks + 1 regression gate)
- **Files modified:** 2

## Accomplishments

- PERF-09: Removed the two per-row `useQuotes()` calls in `OrdersSection` and `OrdersQuoteRows`. The single existing call in `JobsManager` now destructures `quotesByJobId`; a `getQuotesForJob` `useCallback([quotesByJobId])` threads stable slice access through `rowProps` → `JobRow` → `JobCard` → `OrdersSection` → `OrdersQuoteRows`. An 80-job list now holds 1 live Dexie subscription instead of 160.
- PERF-09: Corrected the false code comment claiming dexie-react-hooks deduplicates `useLiveQuery` subscriptions (it does not — each call creates an independent `Observable`).
- PERF-10: Built a `materialsById` Map once per `materials`-prop change via `useMemo`. `getFilamentName` now uses `materialsById.get()` with the character-identical fallback string; 12,000+ `Array.find` comparisons per render cycle eliminated.
- Added source-contract + output-equivalence tests proving the invariants hold.
- Full test suite green (738 tests), `tsc -b` clean.

## Task Commits

1. **Task 1 (RED): Add failing PERF-09 + PERF-10 tests** - `e3179e4` (test)
2. **Task 1 (GREEN): PERF-09 lift useQuotes() + thread quotesForJob** - `78a205d` (feat)
3. **Task 2 (GREEN): PERF-10 materialsById Map** - `908d986` (feat)
4. **Task 3 (regression gate): Fix TS6133 + non-virtualized JobCard path** - `26a4d95` (fix)

## Files Created/Modified

- `/Users/marcusdickinson/Projects/3DCoster/src/components/JobsManager.tsx` - PERF-09 prop threading + PERF-10 Map; false dedup comment removed
- `/Users/marcusdickinson/Projects/3DCoster/src/components/JobsManager.test.tsx` - All existing `OrdersQuoteRows`/`JobCard` mounts updated with new required props; source-contract + equivalence tests added

## Decisions Made

- Kept `jobId` in `OrdersQuoteRows` type signature (renamed to `_jobId` in destructure) for API stability — removing it would be a breaking change to external mount sites without benefit.
- Source-contract test filters comment and JSDoc lines before counting `useQuotes()` occurrences, since a naive regex counts documentation references alongside actual calls.
- Non-virtualized `JobCard` render path (map fallback, line ~1559) also needed `getQuotesForJob` + `updateQuote` — caught by `tsc -b` (Rule 3 auto-fix).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TS6133 — jobId declared but unused after PERF-09**
- **Found during:** Task 3 (tsc -b regression gate)
- **Issue:** `OrdersQuoteRows` prop `jobId` was destructured but no longer used in the function body after removing `quotesByJobId.get(jobId)`.
- **Fix:** Renamed destructured parameter to `_jobId` (TypeScript convention for intentionally unused). Kept in the type signature for API stability.
- **Files modified:** src/components/JobsManager.tsx
- **Verification:** `tsc -b` exits 0
- **Committed in:** `26a4d95` (regression gate commit)

**2. [Rule 3 - Blocking] Missing required props on non-virtualized JobCard render path**
- **Found during:** Task 3 (tsc -b regression gate)
- **Issue:** A second `JobCard` render path (non-virtualized fallback at line ~1559) was missing `getQuotesForJob` and `updateQuote`, which became required after PERF-09.
- **Fix:** Added both props pointing to `getQuotesForJob` and `updateQuoteFromHook` in scope.
- **Files modified:** src/components/JobsManager.tsx
- **Verification:** `tsc -b` exits 0, 738 tests green
- **Committed in:** `26a4d95` (regression gate commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking TypeScript errors caught by `tsc -b`)
**Impact on plan:** Both auto-fixes required to compile and pass typecheck. No behavioral change. No scope creep.

## Issues Encountered

- Source-contract regex `/useQuotes\(\)/g` matched 6 occurrences instead of 1 because comments and JSDoc strings also contain the string `useQuotes()`. Resolved by filtering to non-comment, non-JSDoc lines before counting.

## Known Stubs

None — these are pure refactors. All data paths flow from the same sources as before.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. PERF-09/10 are internal React render/subscription refactors only.

## Next Phase Readiness

- Plan 36-02 (PERF-11 — CostCalculator pricing useEffect dep trimming) can proceed independently. No dependencies on this plan's internals.
- `JobsManager.tsx` is ready for the Phase 37 code-health work (HYG-11/12) if the milestone isn't cut.

## Self-Check

- [x] `src/components/JobsManager.tsx` modified: confirmed
- [x] `src/components/JobsManager.test.tsx` modified: confirmed
- [x] Commits e3179e4, 78a205d, 908d986, 26a4d95: confirmed via `git log`
- [x] `npx vitest run`: 738 passed
- [x] `npx tsc -b`: exit 0

## Self-Check: PASSED

---
*Phase: 36-performance-tier-5*
*Completed: 2026-06-26*
