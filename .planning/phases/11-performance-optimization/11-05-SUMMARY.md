---
phase: 11-performance-optimization
plan: 05
subsystem: ui
tags: [virtualization, react-window, AssetLibrary, performance, perf-02, div-grid]

# Dependency graph
requires:
  - phase: 11-performance-optimization
    provides: react-window v2 runtime dep (Plan 11-01) and the validated JobsManager List+RowComponentProps pattern (Plan 11-04)
provides:
  - AssetLibrary virtualizes all three paginatedAssets.map call sites when effectiveItemsPerPage > 50 (D-07)
  - The two desktop tables are replaced with div-grid markup (role=row/columnheader/cell) so List can virtualize their bodies
  - Six new sub-components inside AssetLibrary (3 plain Row + 3 RowComponentProps adapters) following the JobsManager decoupling pattern
affects: [11-06 (manual UAT validates this at 100/All), future a11y hardening (semantic-loss documented), future AssetLibrary CRUD edits (now operate on div-grid not table)]

# Tech tracking
tech-stack:
  added: []  # react-window already on lockfile from 11-01
  patterns:
    - "div-grid table replacement (role=row/columnheader/cell) when virtualization requires a non-table outer container"
    - "Plain Row + RowComponentProps adapter pair, applied in triplicate (mobile cards, printer rows, material rows)"

key-files:
  created: []
  modified:
    - "src/components/AssetLibrary.tsx — three virtualization gates, two table → div-grid replacements, six new sub-components"

key-decisions:
  - "div-grid replaces both desktop tables (Q1 resolution) — iteration-1 tagName=tbody + colgroup was structurally broken because <col> widths do not apply once <tbody> becomes display:block for absolute row positioning"
  - "Direct-param RowComponentProps<...> typing on all three adapters (NOT React.FC) — matches JobsManager's JobRow post-11-04; react-window v2 rowComponent requires ReactElement|null not ReactNode"
  - "Fixed rowHeight numerics per D-08 bias: 280 for mobile cards, 56 for table rows; clipping check deferred to Plan 11-06 UAT"
  - "ARIA roles (row/columnheader/cell) carry the screen-reader semantics that <table>/<tr>/<th>/<td> previously provided; full semantic markup loss is accepted (T-11-A11Y2 disposition: accept)"

patterns-established:
  - "Pattern: triple decoupled Row+Adapter pair — when one component has N differently-shaped virtualized lists, declare N plain Row functions and N thin RowComponentProps adapters in lockstep, not a shared abstraction (matches PATTERNS.md's 'sibling-component reuse, not generalization' guidance)"
  - "Pattern: virtualized table body via div-grid with matching grid-cols-N on header AND row — the column count is computed once, applied symmetrically; alignment is preserved via Tailwind grid utilities not <colgroup>"

requirements-completed: [PERF-02]

# Metrics
duration: ~18min
completed: 2026-05-20
---

# Phase 11 Plan 05: AssetLibrary virtualization (three call sites) Summary

**AssetLibrary's three paginatedAssets.map call sites virtualize via react-window v2 List when effectiveItemsPerPage > 50, and both desktop `<table>` elements are replaced with `<div>`-grid markup carrying ARIA row/columnheader/cell roles.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-20T19:10:00Z (approx)
- **Completed:** 2026-05-20T19:28:00Z (approx)
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- All three AssetLibrary call sites (mobile cards, printer table, materials table) now conditionally virtualize on `effectiveItemsPerPage > 50`, honoring D-07's "all three must be virtualized when triggered" rule while keeping pagination as the primary UX
- Two desktop `<table>` elements removed; replaced with semantic-equivalent `<div role="row">` / `<div role="columnheader">` / `<div role="cell">` markup using Tailwind `grid grid-cols-7` (printer) and `grid grid-cols-6` (materials) — the structurally broken iteration-1 `tagName="tbody"` + `<colgroup>` approach was NOT used
- Six new sub-components declared inside `AssetLibrary` function scope (`MobileCardItem`/`MobileCardRow`, `PrinterRow`/`PrinterRowAdapter`, `MaterialRow`/`MaterialRowAdapter`) following the same plain-component + RowComponentProps-adapter pattern JobsManager established in 11-04
- `tsc -b`, `npm run build` (including bundle-size assertion), and `node scripts/lint-no-raw-html.mjs` all green; main chunk measured at 45.0 KB gzipped — 254 KB headroom under the 300 KB PERF-01 ceiling

## Task Commits

Each task was committed atomically:

1. **Task 1: Virtualize the three AssetLibrary call sites; replace desktop tables with div-grid** - `<this commit>` (feat)

## Files Created/Modified

- `src/components/AssetLibrary.tsx` — added `List`/`RowComponentProps` import; declared six sub-components (`MobileCardItem` + `MobileCardRow` adapter; `PrinterRow` + `PrinterRowAdapter`; `MaterialRow` + `MaterialRowAdapter`) between helpers and JSX return; replaced mobile cards block with `effectiveItemsPerPage > 50 ? <List> : map(MobileCardItem)`; replaced printer `<table>` with `<div className="w-full text-sm">` containing a `<div role="row" className="grid grid-cols-7 ...">` header and conditional `<List rowComponent={PrinterRowAdapter}>` vs `paginatedAssets.map(PrinterRow)` body; replaced materials `<table>` with the same structure at `grid-cols-6`. Net +352 / -261 lines.

## Decisions Made

### Design Q1 resolution (recorded)

The iteration-1 hybrid approach (`tagName="tbody"` + `<colgroup>` + `display:block`) was rejected and is NOT used anywhere in this plan. The rejection rationale: `<col>` width declarations only take effect under CSS table layout. The moment react-window v2 forces `display:block` on the `<tbody>` (which it must, to position rows absolutely via inline `top`/`height`), the table layout collapses and `<colgroup>` becomes dead markup. Header columns and row columns would drift apart visually with no way to keep them aligned. The chosen alternative — `<div>`-grid replacement with matching `grid grid-cols-N` on both the header row and every row — keeps alignment guaranteed by Tailwind's grid utilities, at the cost of losing `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` semantic markup. ARIA `role="row"` / `role="columnheader"` / `role="cell"` attributes provide screen-reader-equivalent semantics. This trade-off was explicitly accepted (T-11-A11Y2 disposition: accept).

### rowHeight measurement

- **Mobile cards (`MobileCardItem`):** `rowHeight={280}` (px). Measurement method: DevTools → Elements → outer mobile-card `<div>` → "Computed" tab on a populated card carrying name + brand + 1-line notes + 2 tags + cost grid + button row. The 280px figure matches PATTERNS.md's measured value and headroom for the printer-variant cards which carry the additional "Lifespan" pair when `expectedLifespanHours` is set.
- **Printer rows (`PrinterRow`):** `rowHeight={56}` (px). Measurement method: same approach on a single-line row (name only, no notes/tags). The `py-2` Tailwind class is `8px` top + `8px` bottom = `16px` padding; the inner text + Button height settles around `40px` for a `text-sm` row with `btn-sm` action buttons; total `56px`. Rows with notes+tags WILL clip at this height — that is the explicit clipping check Plan 11-06 UAT validates against the 20% seed-with-notes+tags fixture. If 11-06 UAT surfaces clipping, the follow-up is to swap `rowHeight={56}` for `useDynamicRowHeight` (Plan 04 pattern), without changing any other code.
- **Material rows (`MaterialRow`):** `rowHeight={56}` (px). Identical reasoning to printer rows; same clipping caveat.

### Pagination behavior pre/post identical for the default 10/page case

Confirmed by inspection: the new code path renders `paginatedAssets.map(asset => <MobileCardItem | PrinterRow | MaterialRow key={asset.id} asset={asset} />)` whenever `effectiveItemsPerPage <= 50`. The `paginatedAssets` slice, `currentPage` state, `totalPages` derivation, items-per-page select (10/25/50/100/0), Previous/Next buttons, and page-number buttons (lines 1147 onward) are all unchanged. The default value `itemsPerPage = 10` flows through unchanged from `userProfile.assetLibraryItemsPerPage ?? 10`, so the typical user never triggers virtualization.

### grid-cols-N counts and column labels (verbatim from source)

| Table | grid-cols-N | Column labels (in order) | Sort fields |
|-------|-------------|--------------------------|-------------|
| Printer | `grid-cols-7` | Printer / Brand / Type / Price / Wattage / Nozzle / Actions | name / brand / category / purchasePrice / wattage / nozzleCost / — |
| Materials | `grid-cols-6` | Material / Brand / Type / Cost/Unit / Package / Actions | name / brand / category / costPerUnit / packageCost / — |

All column labels and `toggleSort` field names were copied verbatim from the pre-existing `<th>` markup at lines 977–983 (printer) and 1048–1053 (materials). Nothing was invented.

### Acknowledged semantic loss

`<table>` / `<thead>` / `<tbody>` / `<tr>` / `<th>` / `<td>` markup is gone from both desktop tables. ARIA roles (`role="row"` / `role="columnheader"` / `role="cell"`) provide screen-reader-equivalent semantics — assistive tech announces the structure as a tabular region with header cells and data cells, the same way it announces a `<table>`. The `AssetListSkeleton` placeholder (lines 60–87) still uses real `<table>` markup; that is intentional and unchanged — the skeleton renders before assets load and never participates in virtualization. Future a11y hardening (e.g., adding `role="table"` to the outer `<div>`, or `aria-rowcount`/`aria-colindex` to the rows) is explicitly deferred — not in scope for Phase 11.

## Deviations from Plan

None — plan executed exactly as written.

The plan body anticipated the JobsManager `RowComponentProps` typing issue (11-04 hit TS2322 with `React.FC<RowComponentProps<...>>` because v2's rowComponent slot needs `ReactElement | null` not `ReactNode`) and pre-prescribed the direct-param typing fix as the recommended path. All three adapters in this plan used direct-param typing from the start — `tsc -b` passed on the first run with zero errors. No remediation needed.

## Issues Encountered

One transient grep-count mismatch during verification: the explanatory comment I added at the top of the desktop-table block originally read "…we can virtualize when `effectiveItemsPerPage > 50`", which pushed `grep -c "effectiveItemsPerPage > 50"` to `4` against the gate's strict `== 3` predicate. Resolved by rephrasing the comment to "…we can virtualize the body when the page-size predicate fires" — no code logic affected. The verify gate's `== 3` strictness is by design (one occurrence per call site; any extra means either an accidental duplicate gate or, in this case, a stray reference in a comment).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- AssetLibrary side of PERF-02 is implementation-complete; the JobsManager side shipped in Plan 11-04. Plan 11-06 (manual UAT) is the next step — it validates runtime smoothness on a 200+ asset library at 100/page and All-page, including the clipping check on 20% of seeded printer assets carrying notes+tags. If 11-06 surfaces clipping, the follow-up is to swap `rowHeight={56}` for `useDynamicRowHeight` (Plan 04 pattern), and is a single-file localized change.
- Bundle-size headroom is healthy (45.0 KB / 300 KB = 15%); no Phase 11 plan pushes it materially.
- No blockers carried forward.

## Self-Check: PASSED

- `src/components/AssetLibrary.tsx` exists and was modified (verified via `git diff --stat HEAD` showing +352 / -261)
- All 17 verify gates pass:
  - `tsc -b` exit 0; no TS errors in /tmp/tsc05.log
  - `grep -c "from 'react-window'"` = 1
  - `grep -c "effectiveItemsPerPage > 50"` = 3
  - `grep -c "function MobileCardItem|function PrinterRow|function MaterialRow"` = 1 each
  - `grep -c "MobileCardRow|PrinterRowAdapter|MaterialRowAdapter"` ≥ 2 each (decl + use)
  - `grep -c "rowComponent="` = 3
  - `grep -c "tagName=\"tbody\""` = 0 (excl. comments)
  - `grep -c "<colgroup"` = 0 (excl. comments)
  - `grep -c 'role="row"'` ≥ 4 (2 headers + 2 row components ≥ 4)
  - `grep -c 'role="columnheader"'` ≥ 11 (7 printer + 6 material headers = 13)
  - `node scripts/lint-no-raw-html.mjs` passed
  - `npm run build` passed including "main chunk: 45.0 KB gzipped (under 300 KB)"
  - `grep -c "filteredAssets.length === 0"` ≥ 1
  - `grep -c "toggleSort"` ≥ 4 (4 sortable printer cols + 4 sortable material cols on the desktop side, plus 2 small-list direct calls inside the mobile sort `<Select>` block — well above 4)

---
*Phase: 11-performance-optimization*
*Completed: 2026-05-20*
