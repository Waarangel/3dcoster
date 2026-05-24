---
phase: 15-tags-search-quick-duplicate
plan: "09"
subsystem: jobs-manager
tags: [jobs-manager, chip-filter-removal, cache-key-narrowing, scope-refinement, tags-02-withdrawn, gap-closure, gap-C]
dependency_graph:
  requires: ["15-08"]
  provides:
    - JobsManager without chip-filter row, selectedChips state, tagCounts/selectedChipsKey/jobsAfterChipFilter memos
    - useDynamicRowHeight bi-key (selectedJobId|debouncedSearchQuery)
    - filter-empty-state renamed to "No jobs match your search" / "Clear search"
  affects:
    - src/components/JobsManager.tsx
tech_stack:
  added: []
  patterns:
    - Surgical removal of multi-step filter pipeline (jobs → jobsAfterChipFilter → searchedJobs collapses to jobs → searchedJobs)
    - Cache key narrowing: tri-key → bi-key (pipe-delimited; TAGS-04 contract preserved)
key_files:
  modified:
    - src/components/JobsManager.tsx
  created: []
decisions:
  - "Kept filter-empty-state CTA as renamed link (Clear search) rather than replacing with inline clear-X or removing. Rationale: lowest blast radius; the search input already has a clear-X × button (conditionally rendered when searchQuery is non-empty), so the filter-empty-state CTA is a redundant-but-discoverable affordance. Renaming to 'Clear search' costs 0 structural change and preserves the keyboard/mouse/screen-reader-discoverable target."
  - "Named callback clearSearch (not clearFilter or clearInput) to mirror the new CTA copy 'Clear search' and be semantically narrower than the old clearFilters now that search is the only filter dimension."
  - "Renamed filter-empty-state heading from 'No jobs match your filter' to 'No jobs match your search' — 'filter' is misleading when the only filter is search. Mirrors the language in the search input placeholder ('Search jobs by title, tag, or customer')."
  - "Updated stray JSDoc comment referencing 'chip filter row re-derives its tag counts' in handleSaveTags to say 'JobCard tag chips re-render automatically' — keeps the explanation accurate post-Gap-C."
  - "Updated sticky sub-header comment from 'D-03 layout' to 'search-input-only after Gap C' — the D-03 contract is now collapsed."
metrics:
  duration: "~10 minutes"
  completed: "2026-05-24"
  tasks_completed: 1
  files_changed: 1
---

# Phase 15 Plan 09: Gap C — Remove Chip-Filter Row; Narrow Cache Key Summary

**One-liner:** Surgical removal of the multi-select chip-filter row and its state/memos from JobsManager; useDynamicRowHeight cache key narrowed from tri-key to bi-key; TAGS-02 now visibly Withdrawn at the runtime layer.

---

## What Was Built

Gap C gap-closure plan executed. The chip-filter row (D-03) added in Phase 15 Plan 04 has been completely removed from the JobsManager sticky sub-header. The filter pipeline collapses from `jobs → jobsAfterChipFilter → searchedJobs` to `jobs → searchedJobs` directly. The search input is now the canonical and only filter mechanism.

### Removal sites (all in `src/components/JobsManager.tsx`):

1. **`selectedChips` state** — `useState<Set<string>>(() => new Set())` declaration and its associated JSDoc removed. The comment above the remaining search state is updated to reference TAGS-03/TAGS-04 only.

2. **`tagCounts` memo** — Entire `useMemo` block (alphabetical counts `pla · 3`) removed, including JSDoc.

3. **`selectedChipsKey` memo** — Entire `useMemo` block (stable string repr for dep arrays) removed, including JSDoc.

4. **`jobsAfterChipFilter` memo** — Entire `useMemo` block (AND-across-chips filter) removed, including JSDoc.

5. **`searchedJobs` memo** — Edited (not removed): replaced `jobsAfterChipFilter` with `jobs` in the body and dependency array. JSDoc updated to note direct operation on `jobs` (Gap C reference added).

6. **`useDynamicRowHeight` cache key** — Narrowed from tri-key to bi-key:
   - Old: `` `${selectedJobId ?? ''}|${selectedChipsKey}|${debouncedSearchQuery}` ``
   - **New: `` `${selectedJobId ?? ''}|${debouncedSearchQuery}` ``**
   - Comment updated from "tri-key" to "bi-key"; removed "chip filter" segment from explanation. TAGS-04 contract preserved (pipe-delimited, collision-proof).

7. **`clearFilters` callback** — Renamed to `clearSearch`, simplified from two-setter (`setSelectedChips(new Set()); setSearchQuery('')`) to single-setter (`setSearchQuery('')`). JSDoc updated.

8. **Chip-row JSX** — Entire `{tagCounts.length > 0 && (...)}` block removed from sticky sub-header, including: `flex-nowrap sm:flex-wrap gap-1.5 items-center overflow-x-auto sm:overflow-visible` wrapper, `tagCounts.map(...)` button chips, and the in-header "Clear filters" link. Sub-header now contains only the search input wrapper.

9. **Filter-empty-state** — Updated copy:
   - Heading: `No jobs match your filter` → `No jobs match your search`
   - Body: `Try different search terms or chip selections.` → `Try a different search term, or clear search to see all jobs.`
   - Button: `Clear filters` → `Clear search` (onClick: `clearFilters` → `clearSearch`)
   - Comment updated to reference the search clear-X affordance (no longer mirrors a chip-row link).

10. **Stray comments cleaned** — Two additional stray chip-filter comments updated:
    - `handleSaveTags` JSDoc: "chip filter row re-derives its tag counts" → "JobCard tag chips re-render automatically"
    - Sticky sub-header comment: "D-03 layout" → "search-input-only after Gap C"

---

## Files Modified

| File | Change | Line delta |
|------|--------|-----------|
| `src/components/JobsManager.tsx` | Removed chip-filter state/memos/JSX; narrowed cache key; renamed clearFilters→clearSearch; updated empty-state copy | -74 lines (2015 → 1941) |

---

## Vitest Results

**Test run after Gap C changes:**

- Test Files: 18 passed (18)
- Tests: **263 passed | 1 todo (264)**
- 0 failed

Matches the pre-plan baseline exactly. No new test cases for Gap C; existing tests untouched.

---

## TypeScript Results

`npx tsc -b` exits 0. Zero new errors introduced.

---

## useDynamicRowHeight Key (exact expression for posterity)

```
key: `${selectedJobId ?? ''}|${debouncedSearchQuery}`
```

This is the new bi-key value at commit `c03fbb5`. Pipe-delimited; two segments (`selectedJobId` + `debouncedSearchQuery`); cannot collide. TAGS-04 cache invalidation contract is preserved — any change to either segment invalidates the cache, react-window resets row heights, list scrolls to top.

---

## searchedJobs Now Operates Directly on `jobs`

Confirmed. The `searchedJobs` memo dependency array is `[jobs, salesByJob, debouncedSearchQuery]`. No intermediate `jobsAfterChipFilter` memo exists anywhere in the file. The filter pipeline is: `jobs → searchedJobs` (single step).

---

## Decisions Made

1. **Kept filter-empty-state CTA as renamed "Clear search" link** — Rather than replacing it with the inline clear-X button (which already exists on the search input) or removing it entirely, the link was renamed. Rationale: lowest blast radius; the search input's × button is conditionally rendered and only visible when focus is near the input — the filter-empty-state CTA is a redundant-but-discoverable affordance that guides the user when the list is empty and the × button may not be visible. This satisfies VERIFICATION.md Gap C's "decide between rename / inline clear / remove entirely" with the lowest-risk option.

2. **Named callback `clearSearch`** — Semantically narrower than `clearFilters`; matches the "Clear search" CTA copy. The old name `clearFilters` implied multiple filter dimensions (chips + search); now that search is the only dimension, the name is more accurate.

3. **Renamed empty-state heading to "No jobs match your search"** — "Filter" was misleading; "search" mirrors the input placeholder language ("Search jobs by title, tag, or customer").

---

## LOCKED File Integrity

| File | Status |
|------|--------|
| `src/utils/duplicateJob.ts` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/utils/duplicateJob.test.ts` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/features.ts` | BYTE-IDENTICAL — `git diff` output: empty |

Confirmed by: `git diff src/utils/duplicateJob.ts src/utils/duplicateJob.test.ts` → no output; `git diff src/features.ts` → no output.

---

## Search Input Affordance Byte-Identical

The search input wrapper (`<div className="relative mb-3">` + `<SearchIcon>` + `<Input>` + `×` clear-X `<Button>` + `<NewBadge feature="search-jobs" className="absolute -top-1 -right-1" />`) is untouched. The 250ms debounce `useEffect` (`const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 250)`) is untouched.

---

## TAGS-02 Withdrawal — Three Locations Confirmed

TAGS-02 is consistently Withdrawn across all three authoritative locations:

1. **REQUIREMENTS.md** — TAGS-02 marked `Withdrawn` with reason "superseded by TAGS-03 search per user product feedback 2026-05-24" (recorded in Plan 15-06).
2. **ROADMAP.md** — Phase 15 Success Criterion #2 annotated as withdrawn (recorded in Plan 15-06).
3. **Runtime (JobsManager.tsx, commit `c03fbb5`)** — Zero occurrences of `selectedChips`, `tagCounts`, `selectedChipsKey`, `jobsAfterChipFilter`, chip-row JSX, or `overflow-x-auto`. This plan closes the code layer.

---

## Audit Counters (all at expected values)

| Grep target | Expected | Actual |
|-------------|----------|--------|
| `selectedChips\|selectedChipsKey\|tagCounts\|jobsAfterChipFilter` | 0 | 0 |
| `clearFilters` | 0 | 0 |
| `Clear filters` | 0 | 0 |
| `Clear search` | 1 | 1 |
| `clearSearch` | 2 | 2 |
| bi-key (`\|${debouncedSearchQuery}\``) | 1 | 1 |
| `overflow-x-auto` | 0 | 0 |
| `No jobs match your search` | 1 | 1 |
| `No jobs match your filter` | 0 | 0 |
| `tri-key` | 0 | 0 |

---

## Deviations from Plan

None. Plan executed exactly as written. All 10 steps from the action spec were applied in sequence. The only judgment call was choosing "rename to Clear search" over "replace with inline clear-X" or "remove entirely" for the filter-empty-state CTA — this was explicitly listed as a decision point in the plan (Step 9 / Decision log). The "rename" option was selected as the lowest blast radius choice.

---

## Known Stubs

None. All removed surfaces were UI-only; no data stubs introduced.

---

## Threat Flags

None. This plan only removes UI surface — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

---

## Self-Check

- `src/components/JobsManager.tsx` exists and was modified: confirmed (1941 lines, -74 from pre-plan 2015)
- Commit `c03fbb5` exists: confirmed (`git rev-parse --short HEAD` = `c03fbb5`)
- LOCKED files byte-identical: confirmed (`git diff` empty for both)
- `git diff src/features.ts` empty: confirmed
- All 10 audit counters at expected values: confirmed
- `npx tsc -b` exits 0: confirmed
- `npm test -- --run` reports 263 passed / 1 todo / 0 failed: confirmed

## Self-Check: PASSED
