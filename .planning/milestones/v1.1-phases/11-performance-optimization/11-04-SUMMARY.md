---
phase: 11-performance-optimization
plan: 04
subsystem: ui
tags: [virtualization, react-window, JobsManager, performance, useDynamicRowHeight]

# Dependency graph
requires:
  - phase: 11-performance-optimization
    provides: react-window@^2.2.7 runtime dep installed (Plan 11-01)
provides:
  - Conditional virtualized rendering of JobsManager's jobs list using react-window v2 `<List>` when `jobs.length > 100`
  - Selection-driven row-height cache invalidation via `useDynamicRowHeight`'s `key` arg (D-08 design Q2 resolution)
  - Plain `JobCard` sub-component reusable across both small-list and virtualized branches
  - Thin `JobRow` adapter typed with `RowComponentProps` for the `<List>` slot
affects: [11-05-AssetLibrary-virtualization, 11-06-PERF-UAT, future v1.2 features that touch JobsManager]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-window v2 conditional virtualization (threshold-gated to >100 items)"
    - "useDynamicRowHeight + key-arg cache invalidation for bimodal row heights"
    - "Plain card component + thin RowComponentProps adapter pattern (sidesteps ariaAttributes requirement on direct calls)"

key-files:
  created: []
  modified:
    - src/components/JobsManager.tsx

key-decisions:
  - "Use `useDynamicRowHeight` with `defaultRowHeight: 88` instead of fixed `rowHeight={88}` — the bimodal collapsed/expanded heights (88px vs ~400px) would clip the expanded card if fixed, and v2 has no `FixedSizeList`/`VariableSizeList` split anyway (only the unified `<List>`)"
  - "Use `key: selectedJobId ?? ''` arg to invalidate the row-height cache — the v2 `DynamicRowHeight` object has NO `.reset()` method (verified against react-window@2.2.7/dist/*.d.ts), so the `key` arg is the only v2-idiomatic invalidation path"
  - "Drop `React.FC` typing on `JobRow` — react-window v2's `rowComponent` slot expects a function returning `ReactElement | null`, but `React.FC` returns `ReactNode` (which includes `Promise<ReactNode>`), causing TS2322. Direct param typing `(props: RowComponentProps<...>) => ...` is the correct shape."
  - "Small-list (<=100) renders `<JobCard />` directly, not through `JobRow` — JobCard's plain typing has no `ariaAttributes` requirement, so the direct call site is TS-clean. Explicitly acknowledged behavior, not a bug."

patterns-established:
  - "Pattern: conditional virtualized branch — `count > threshold ? <List ...> : <flatmap>` preserves byte-for-byte small-list rendering while paying the virtualization cost only when it earns its keep"
  - "Pattern: plain JSX component + RowComponentProps adapter — keeps virtualization-specific typing out of the card body and lets the small-list branch reuse the card directly"
  - "Pattern: selection-keyed dynamic-height cache — `useDynamicRowHeight({ defaultRowHeight, key: selectionId })` is the v2-idiomatic replacement for v1's `resetAfterIndex(...)` imperative call"

requirements-completed: [PERF-02]

# Metrics
duration: 8min
completed: 2026-05-20
---

# Phase 11 Plan 04: Virtualize JobsManager Summary

**JobsManager renders its jobs list via react-window v2's `<List>` + `useDynamicRowHeight` when `jobs.length > 100`; below 100, the existing `<div className="space-y-3">` flat-map render is preserved byte-for-byte through a shared `JobCard` sub-component.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-20T19:03:00Z (approx, plan execution kick-off)
- **Completed:** 2026-05-20T19:11:36Z
- **Tasks:** 1 / 1
- **Files modified:** 1

## Accomplishments

- Conditional virtualized rendering wired into JobsManager via `jobs.length > 100 ? <List ...> : <flatmap>` at post-edit line **424** of `src/components/JobsManager.tsx`
- `useDynamicRowHeight({ defaultRowHeight: 88, key: selectedJobId ?? '' })` declared after the existing useState block (post-edit line 227); cache automatically rebuilds on every selection toggle, so the previously-expanded row collapses back to ~88px and the newly-selected row grows to its measured ~400px without any imperative `.reset()` call (the v2 API has none)
- Two new sub-components declared inside the `JobsManager` function (close over `getBreakEvenInfo`, `selectedJobId`, `setSelectedJobId`, `setShowSaleForm`, `setSalePrice`, `sales`, `getFilamentName`, `handleEditJob`, `handleDeleteJob`):
  - `function JobCard({ job, style })` — plain typing, no react-window dependency; receives optional `style` prop applied to the outer div (omitted in small-list branch, supplied by react-window in virtualized branch)
  - `const JobRow = ({ index, style, jobs }: RowComponentProps<{ jobs: PrintJob[] }>) => ...` — thin adapter for the `<List>` `rowComponent` slot
- `import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window'` added as a single consolidated line at line 2
- All existing JobsManager features preserved: break-even badge (reached / not-reachable / N-more variants), filament list, revenue display, expanded cost grid, model URL, progress bar (with WR-04 fallback), Record Sale / Edit / Delete buttons, Recent Sales section
- `EmptyState` (post-edit lines 418–423) and `JobsListSkeleton` (lines 18–40) blocks **byte-identical** to pre-edit — verified by `git diff` showing only the populated-jobs branch and the new hook/component declarations changed
- All 14 grep verification gates intact (see Gate Notes below for two cosmetic gate-count mismatches that are pre-existing and not regressions)

## Task Commits

1. **Task 1: Virtualize JobsManager jobs.map when jobs.length > 100** — see commit hash recorded in `git log` after this SUMMARY is committed (`feat(11-04): virtualize JobsManager with react-window v2 List + useDynamicRowHeight`)

## Files Created/Modified

- `src/components/JobsManager.tsx` — Added react-window v2 import; declared `useDynamicRowHeight` cache wired to `selectedJobId`; extracted row JSX verbatim into `JobCard` (plain) and `JobRow` (RowComponentProps adapter) sub-components inside the JobsManager function; replaced the flat `jobs.map(...)` seam with a `jobs.length > 100 ? <List ...> : <div className="space-y-3">{...}</div>` ternary
- `.planning/phases/11-performance-optimization/11-04-SUMMARY.md` — This summary

## Decisions Made

### Design Q2 resolution: `useDynamicRowHeight` over fixed `rowHeight={88}`

The JobsManager card is bimodal: ~88px collapsed (header + filament+time row + revenue right-side, all inside `p-4`), and ~400px when expanded (additional cost grid + optional model URL + progress bar + 3 action buttons + optional recent-sales list). A fixed `rowHeight={88}` would either clip every expanded card's bottom half (BAD — Record Sale / Edit / Delete buttons hidden) or, if set high enough to fit expanded, leave ~312px of wasted vertical space below every collapsed card (BAD — only one or two cards visible per viewport). react-window v2 has no `FixedSizeList`/`VariableSizeList` split anyway — only the unified `<List>` whose `rowHeight` prop accepts a number, function, or a `DynamicRowHeight` cache. So the cleanest expression of D-08's "bias toward fixed sizing, dynamic only if breakage" is: pass a `useDynamicRowHeight` cache with `defaultRowHeight: 88` (the collapsed measurement, used for the pre-measurement initial render of every row). The cache measures actual heights as rows render, handling both modes. Selection-driven invalidation uses the v2-idiomatic `key` arg — when `selectedJobId` changes, react-window builds a fresh cache and forces re-measurement of both the previously-expanded row (now collapsed) and the newly-selected row (now expanded). There is NO `.reset()` method on the cache object in v2 (verified directly against `node_modules/react-window/dist/react-window.d.ts` — the `DynamicRowHeight` type exposes only `getAverageRowHeight`, `getRowHeight(index)`, `setRowHeight(index, size)`, `observeRowElements(elements)`).

### `defaultRowHeight: 88` value

Honors D-08's "bias toward fixed sizing" by giving the pre-measurement initial render of every row a correct collapsed-card height, so the first paint of the list doesn't visibly shift after measurement. 88 = `p-4` (32px) + header row (~24px) + filament+time row (~20px) + small margins (~12px).

### Small-list branch routes through `JobCard` directly (not `JobRow`)

When `jobs.length <= 100`, the render is `<JobCard key={job.id} job={job} />` — no `style`, no `index`, no `ariaAttributes`. JobCard's plain typing has no `ariaAttributes` requirement, so the call site is TS-clean. Going through `JobRow` would either require synthesizing a fake `ariaAttributes` object at the call site (ugly, error-prone) or duplicating the type — `RowComponentProps`-typed components fail TS2741 ("Property 'ariaAttributes' is missing") when called directly outside `<List>`. This split is **explicit, acknowledged behavior, NOT a bug**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drop `React.FC` typing on JobRow to fix TS2322**

- **Found during:** Task 1 (initial verify gate `tsc -b`)
- **Issue:** The plan's `<interfaces>` block suggested `const JobRow: React.FC<RowComponentProps<{ jobs: PrintJob[] }>> = (...)`. But react-window v2's `rowComponent` slot is typed as `(props: ...) => ReactElement<unknown, string | JSXElementConstructor<any>> | null` — it requires a `ReactElement` return, NOT `ReactNode`. `React.FC` returns `ReactNode | Promise<ReactNode>` (the wider type), so the assignment failed with TS2322: `Type 'undefined' is not assignable to type 'ReactElement<...> | null'`.
- **Fix:** Replaced `const JobRow: React.FC<RowComponentProps<{ jobs: PrintJob[] }>> = ({ index, style, jobs }) => (...)` with `const JobRow = ({ index, style, jobs }: RowComponentProps<{ jobs: PrintJob[] }>) => (...)`. Direct param typing keeps the inferred return type as the literal JSX expression (which IS a `ReactElement`), satisfying the slot's signature.
- **Files modified:** src/components/JobsManager.tsx
- **Verification:** `tsc -b` exits 0 after the change; the JobRow declaration is still 1 line, RowComponentProps usage is still single, and `JobRow` is still referenced (3 occurrences: declaration + comment + use in `<List rowComponent={JobRow}>`).
- **Committed in:** (part of Task 1 commit — see git log)

---

**Total deviations:** 1 auto-fixed (1 bug — TypeScript signature mismatch between `React.FC` return type and react-window v2's `rowComponent` slot expectation)
**Impact on plan:** No scope creep. The fix preserves every load-bearing invariant the plan specified (RowComponentProps typing on JobRow, plain JobCard with no react-window typing, direct-call sidestep for ariaAttributes). The plan-author's `<interfaces>` block suggested `React.FC` as the typing shape but didn't actually verify it against the v2 typings — the verified `.d.ts` file shows the slot expects `ReactElement`, not `ReactNode`.

## Issues Encountered

### Gate-count mismatches (cosmetic, pre-existing, not regressions)

Two of the 14 grep gates in the plan are written with `^1$` expectations but the actual file has 2 matches each, because the gate counted only the target line and missed pre-existing comment/import lines:

1. `grep -c "defaultRowHeight: 88"` returns **2** (one in the doc comment above the hook explaining the value, one in the actual hook call). The plan author wrote the doc comment in the action spec but specified `^1$` for the gate — internal inconsistency in the plan, not a file regression.
2. `grep -c "shouldShowEmptyState"` returns **2** (line 5 import — pre-existing from before this plan — and line 417 usage). This count was 2 BEFORE this plan's edit too (verified by `git stash` + grep + `git stash pop` round-trip), so the gate's `^1$` expectation was always wrong.

The underlying invariants these gates were trying to enforce are intact:
- Exactly one `useDynamicRowHeight({ defaultRowHeight: 88, ... })` runtime call (verified by the separate `useDynamicRowHeight({` gate which DID return 1).
- Exactly one `shouldShowEmptyState(...)` runtime call (the import has been there since Phase 9 and is unchanged by this plan).

Surfaced for transparency; no remediation needed.

## User Setup Required

None — this is internal performance work with no UI-visible change at jobs.length ≤ 100, and no new external service config.

## Next Phase Readiness

- JobsManager half of PERF-02 satisfied. AssetLibrary virtualization (Plan 11-05) is the remaining half.
- The Plan 11-06 manual UAT will validate runtime behavior: load a 500-item Jobs fixture, throttle CPU 4× in DevTools Performance tab, scroll the list, verify no dropped frames (>16ms) and confirm expand/collapse correctness on rapidly-toggled rows (the `key`-arg invalidation path is the load-bearing piece for that UAT).
- Bundle-size gate remains green: main chunk = 44.7 KB gzipped, well under the 300 KB threshold (PERF-01).

## Self-Check

Verified after Write:

- [x] `src/components/JobsManager.tsx` contains `import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';` on line 2 (single consolidated line, gate returns 1)
- [x] `useDynamicRowHeight({ defaultRowHeight: 88, key: selectedJobId ?? '' })` declared on lines 226–229
- [x] `function JobCard({ job, style }: { job: PrintJob; style?: React.CSSProperties })` declared (gate returns 1)
- [x] `JobRow` declared and referenced (gate returns 3 ≥ 2)
- [x] `jobs.length > 100` conditional present on line 424 (gate returns 1)
- [x] ZERO `.reset(` calls outside comments (gate returns 0)
- [x] `JobsListSkeleton` and `shouldShowEmptyState` invocations unchanged (`EmptyState` JSX at lines 418–423 byte-identical to pre-edit)
- [x] `tsc -b` exits 0
- [x] `npm run build` exits 0 including the bundle-size gate (`✓ main chunk: 44.7 KB gzipped (under 300 KB) — index-GoAv6syX.js`)
- [x] `node scripts/lint-no-raw-html.mjs` exits 0

## Self-Check: PASSED

---
*Phase: 11-performance-optimization*
*Completed: 2026-05-20*
