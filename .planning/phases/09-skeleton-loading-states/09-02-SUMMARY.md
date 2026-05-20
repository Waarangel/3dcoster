---
phase: 09-skeleton-loading-states
plan: "02"
subsystem: ui
tags:
  - skeleton
  - loading
  - react
  - tailwind
  - wiring

# Dependency graph
requires:
  - phase: 09-01
    provides: "Skeleton primitive + shouldShowEmptyState exported from src/components/ui barrel"
  - phase: 08-01
    provides: "EmptyState primitive + shouldShowEmptyState predicate (activated by this plan)"
provides:
  - "AssetListSkeleton co-located in AssetLibrary.tsx — responsive (mobile cards + desktop table)"
  - "JobsListSkeleton co-located in JobsManager.tsx — 4-row placeholder, single-return refactor"
  - "PrinterListSkeleton co-located in PrinterSettings.tsx — 3-row printer instance placeholder"
  - "App.tsx global loading gate removed; per-consumer isLoading props drilled to 3 consumers"
  - "shouldShowEmptyState activated — no longer dead code (resolves 08-REVIEW IN-01)"
affects:
  - "10: any phase touching AssetLibrary, JobsManager, or PrinterSettings list rendering"
  - "verifier: Phase 9 verification pass"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Co-located list skeletons: top-level function in consumer file, not exported, not in skeletons/"
    - "D-10 ternary order: isLoading ? <Skeleton> : shouldShowEmptyState(items, isLoading) ? <EmptyState> : <RealList>"
    - "Responsive skeleton: AssetListSkeleton uses md:hidden/hidden md:block to mirror real list's dual layout"
    - "Single-return refactor: JobsManager converted from early-return pattern to single ternary, modals stay mounted"
    - "Per-consumer loading gate: App.tsx aggregate dropped, each consumer reads its own loading flag"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/components/AssetLibrary.tsx
    - src/components/JobsManager.tsx
    - src/components/PrinterSettings.tsx

key-decisions:
  - "PD-07: App.tsx drops global isLoading aggregate entirely; 5 unused destructurings removed, 3 needed kept"
  - "PD-08: list skeletons are top-level functions in consumer files — not shared, not exported, co-located per D-03"
  - "PD-09: JobsManager converts to single-return ternary so modals stay mounted across loading/empty/list branches"
  - "PD-10: AssetListSkeleton renders both mobile-card (md:hidden) and desktop-table (hidden md:block) variants"
  - "PD-11: JobsManager _getPrinterName dead-code block left as-is — Phase 9 is not a cleanup pass (D-09)"
  - "PD-12: no debounce, no setTimeout, no fade delay — skeletons render immediately per D-05"
  - "PD-13: each consumer render site gets exactly one new prop (isLoading=...) — minimal diff"

patterns-established:
  - "Co-located skeleton pattern: compose <Skeleton> + structural divs/table elements inline in consumer file"
  - "D-10 ternary: the canonical loading/empty/content render order for list screens"
  - "shouldShowEmptyState(items, isLoading): the correct predicate — never inline isLoading check separately"

requirements-completed:
  - UI-05

# Metrics
duration: "~15min (tasks) + UAT checkpoint"
completed: "2026-05-19"
---

# Phase 9 Plan 02: Skeleton Consumer Wiring Summary

**App.tsx global loading gate removed and per-consumer animate-pulse skeletons wired into AssetLibrary, JobsManager, and PrinterSettings — activating Phase 8's dormant `shouldShowEmptyState` predicate.**

## Performance

- **Duration:** ~15 min (tasks 1-4) + manual UAT checkpoint (task 5)
- **Started:** 2026-05-19T22:12:00Z
- **Completed:** 2026-05-19T22:16:00Z (tasks); UAT PASSED same session
- **Tasks:** 5 (4 code tasks + 1 UAT checkpoint)
- **Files modified:** 4

## Accomplishments

- Removed the monolithic `if (isLoading) → "Loading..."` gate from App.tsx that blocked the entire UI shell; the Calculator tab, header, and tab bar are now immediately interactive during data load
- Wired three co-located list skeletons (`AssetListSkeleton`, `JobsListSkeleton`, `PrinterListSkeleton`) into their consumers using the D-10 canonical ternary order — activating the previously dead `shouldShowEmptyState` Phase 8 predicate in all three list screens
- Pruned 5 unused `isLoading` destructurings from App.tsx hook calls (TypeScript `noUnusedLocals` would have failed the build) and refactored JobsManager from early-return to single-return so Sale Form and Delete Confirmation modals stay mounted across all render branches

## Task Commits

Each task was committed atomically:

1. **Task 1: App.tsx — remove global loading gate, prune unused destructurings, drill isLoading** — `662f59e` (feat)
2. **Task 2: AssetLibrary — add isLoading prop, AssetListSkeleton, D-10 render order** — `ab17fa5` (feat)
3. **Task 3: JobsManager — add isLoading prop, JobsListSkeleton, D-10 single-return refactor** — `31d4a6a` (feat)
4. **Task 4: PrinterSettings — add isLoading prop, PrinterListSkeleton, D-10 render order** — `5250cc6` (feat)
5. **Task 5 (UAT checkpoint):** User confirmed UAT PASSED — no commit needed

**Plan metadata:** _(this SUMMARY commit)_ (docs: complete skeleton consumer wiring plan summary)

## Files Created/Modified

| File | Status | Change | Description |
|------|--------|--------|-------------|
| `src/App.tsx` | Modified | +3 / -15 | Remove global gate + aggregate; prune 5 unused destructurings; drill isLoading to 3 consumers |
| `src/components/AssetLibrary.tsx` | Modified | +64 / -2 | Add isLoading prop, AssetListSkeleton (responsive mobile+desktop), D-10 ternary |
| `src/components/JobsManager.tsx` | Modified | +38 / -16 | Add isLoading prop, JobsListSkeleton (4-row), single-return refactor, D-10 ternary |
| `src/components/PrinterSettings.tsx` | Modified | +31 / -2 | Add isLoading prop, PrinterListSkeleton (3-row), D-10 ternary |

## Decisions Made

Per the PLAN.md planner decision record:

- **PD-07:** The global `isLoading` aggregate (`const isLoading = assetsLoading || ...`) was dropped entirely. Five unused `xxxLoading` destructurings (settings, printers, profile, shipping, fees) were removed — `tsc -b noUnusedLocals` mandated this. Three needed flags (assets, jobs, instances) were kept and drilled to their consumers.
- **PD-08:** List skeletons are top-level functions in their consumer files — not exported, not shared, not in a `skeletons/` directory. Placement between imports and the main export function makes them visible to lint tools while keeping shapes co-located with the real layout they mirror (D-03).
- **PD-09:** JobsManager was converted from an early-return pattern to a single-return ternary. The Sale Form Modal and Delete Confirmation Modal now sit at the bottom of the single JSX tree and stay mounted across loading, empty, and list branches — preventing unexpected unmount/remount behavior.
- **PD-10:** `AssetListSkeleton` renders both a mobile-card variant (`md:hidden`, 3 rows) and a desktop-table variant (`hidden md:block`, 5 rows). JobsListSkeleton and PrinterListSkeleton are single-layout each (their real UIs have no responsive switch).
- **PD-11:** `_getPrinterName` dead-code block in JobsManager was left as-is per D-09 (Phase 9 is not a cleanup pass).
- **PD-12:** No debounce, no `setTimeout`, no `useEffect` delay. Skeletons render and disappear immediately (D-05).
- **PD-13:** Each consumer render site received exactly one new prop (`isLoading={xxxLoading}`) — minimum diff, minimum blast radius.

## Decisions Honored from CONTEXT.md

| Decision | Honored |
|----------|---------|
| D-01: per-consumer loading gate (not App.tsx aggregate) | Yes — global gate removed |
| D-02: Skeleton primitive consumed, not duplicated | Yes — all three skeletons import `<Skeleton>` from `./ui` |
| D-03: list skeletons co-located in consumer files | Yes — top-level functions in same file |
| D-04: animate-pulse from Tailwind (no custom CSS) | Yes — baked into Skeleton primitive from Plan 01 |
| D-05: render immediately (no debounce) | Yes — PD-12 |
| D-06: scope is exactly AssetLibrary, JobsManager, PrinterSettings | Yes — CostCalculator and modals untouched |
| D-07: CostCalculator not patched | Yes |
| D-08: no skeleton-loading feature key, no NewBadge | Yes — src/features.ts not modified |
| D-09: no inline "Loading…" sweep outside App.tsx | Yes |
| D-10: canonical ternary order in all three consumers | Yes |
| D-11: lint guard stays green | Yes — only `<Skeleton>` + structural divs in list skeletons |

## Deviations from Plan

None — plan executed exactly as written. All PD-07 through PD-13 decisions were pre-locked in the plan frontmatter and implemented as specified.

## UAT Results

**Status: PASSED** (user confirmed in browser at http://localhost:4173/)

| UAT Check | Result |
|-----------|--------|
| Cold reload shows skeleton briefly in each list tab before content/EmptyState | PASS |
| App shell stays interactive during loading window | PASS |
| Calculator tab shows immediately (no skeleton, no delay) | PASS |
| No "Loading..." text appears anywhere | PASS |
| Existing data/modals/icons unaffected | PASS |

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` (tsc -b + vite build) | PASS |
| `npm test` | PASS (all tests) |
| `npm run lint:no-raw-html` | PASS (confirmed pre-checkpoint) |
| Manual UAT | PASS |
| src/features.ts unmodified (no skeleton-loading key) | PASS |

## Issues Encountered

None.

## Next Phase Readiness

- Phase 9 (Skeleton Loading States) is complete — both Plan 01 (primitive) and Plan 02 (consumer wiring) are done
- All three list screens now follow the canonical D-10 ternary pattern; any future list screen should adopt the same pattern
- `shouldShowEmptyState` is now active in three consumers — the 08-REVIEW IN-01 dead-code flag is resolved
- JobsManager's `_getPrinterName` dead-code block remains (Phase 08-REVIEW IN-03) — flagged for a future cleanup phase if desired
- CostCalculator empty-dropdown flash on initial load remains accepted per D-07

## Known Stubs

None. All three list skeletons display during actual IndexedDB loading and transition to real content.

## Threat Flags

None. This plan is purely presentational — it adds `isLoading` prop drilling and conditional rendering. No new network endpoints, auth paths, file access patterns, or schema changes.

---

## Self-Check

### Created files exist

- No new files were created in this plan — all changes were modifications to existing files.

### Modified files exist

- `src/App.tsx` — FOUND (confirmed by git show --stat 662f59e)
- `src/components/AssetLibrary.tsx` — FOUND (confirmed by git show --stat ab17fa5)
- `src/components/JobsManager.tsx` — FOUND (confirmed by git show --stat 31d4a6a)
- `src/components/PrinterSettings.tsx` — FOUND (confirmed by git show --stat 5250cc6)

### Commits exist

- `662f59e` — FOUND: `feat(09-02): App.tsx — remove global loading gate, prune 5 unused destructurings, drill isLoading to three consumers`
- `ab17fa5` — FOUND: `feat(09-02): AssetLibrary — add isLoading prop, AssetListSkeleton, D-10 render order`
- `31d4a6a` — FOUND: `feat(09-02): JobsManager — add isLoading prop, JobsListSkeleton, D-10 single-return refactor`
- `5250cc6` — FOUND: `feat(09-02): PrinterSettings — add isLoading prop, PrinterListSkeleton, D-10 render order`

## Self-Check: PASSED

---
*Phase: 09-skeleton-loading-states*
*Completed: 2026-05-19*
