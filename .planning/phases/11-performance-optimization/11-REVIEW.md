---
phase: 11-performance-optimization
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/JobsManager.tsx
  - src/components/AssetLibrary.tsx
  - src/components/CostCalculator.tsx
  - vite.config.ts
  - scripts/assert-bundle-size.mjs
  - package.json
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 11: Code Review Report (Post-Remediation)

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found (no Critical findings; Warning-level only)

## Summary

This is the post-remediation re-review after commits `652941d` (CR-01/02/03 fixes) and
`d77f940` (Print Job Details row-jump fix).

**Resolution status for prior Critical findings:**

- **CR-01 RESOLVED.** All row components are now at module scope. `JobsManager.tsx` declares
  `JobCard` (memo-wrapped, lines 46–207) and `JobRow` (lines 226–255) outside the parent
  function body. `AssetLibrary.tsx` declares `MobileCardItem` (152), `MobileCardRow` (270),
  `PrinterRow` (275), `PrinterRowAdapter` (341), `MaterialRow` (346), and `MaterialRowAdapter`
  (415) at module scope; the three plain row components are wrapped in `React.memo`. The
  thin `*Adapter` components for `<List>` are not memoized, which is correct: react-window v2
  internally wraps `rowComponent` in `React.memo`, so an extra wrap on the adapter would be
  redundant.
- **CR-02 RESOLVED.** AssetLibrary lines 733–735 replace the prior numeric `rowHeight` values
  (`56` / `280`) with three `useDynamicRowHeight({ defaultRowHeight: ... })` caches: mobile
  240, printer 64, material 64. Initial-render defaults are close enough to the common case
  that the `ResizeObserver` correction is small.
- **CR-03 RESOLVED.** `rowProps` (JobsManager.tsx lines 473–483) now contains every value the
  row needs: `jobs`, `selectedJobId`, `selectedSales: sales`, `getFilamentName`,
  `getBreakEvenInfo`, and the four handlers (`onToggleSelect`, `onOpenSaleForm`, `onEdit`,
  `onDelete`). All handler callbacks that close over component state (`handleToggleSelect`,
  `handleOpenSaleForm`, `handleDeleteJob`, `getFilamentName`) are wrapped in `useCallback`.
  `rowProps` itself is memoized with the correct dependency array.

**New bugs introduced by the refactor:** None at Critical level. The refactor is structurally
sound. A minor data-flow note (IN-03) discusses why feeding `selectedSales` to every row is
acceptable but worth documenting.

**Status of prior warnings:**

| Prior ID | Disposition |
|----------|-------------|
| WR-01 (`/dexie/` comment) | UNCHANGED — still incorrect. Re-listed as WR-01. |
| WR-02 (vendor chunk gate) | UNCHANGED — still gates only `index-*.js`. Re-listed as WR-02. |
| WR-03 (`key: selectedJobId` cache reset) | UNCHANGED — now more costly with CR-01 fixed. Re-listed as WR-03 (upgraded reasoning). |
| WR-04 (`parseInt \|\| 1` etc.) | UNCHANGED — same patterns at lines 545, 554, 593. Not re-listed (out of refactor scope, pre-existing). |
| WR-05 (`overflow-x-auto` wrapper) | UNCHANGED — line 1175 still wraps `<List>`. Re-listed as WR-04. |
| WR-06 (dropoff cost) | UNCHANGED — `getDefaultShippingCost` (line 352) still has no `dropoff` case. Not re-listed (pre-existing, out of refactor scope). |
| WR-07 (skeleton column count) | UNCHANGED — `AssetListSkeleton` (line 22) still takes no args and hard-codes 7 columns. Re-listed as WR-05. |
| IN-01 (gzip level vs CDN) | UNCHANGED. Re-listed as IN-01. |
| IN-02 (`<table>` skeleton vs grid real) | UNCHANGED. Re-listed as IN-02. |
| IN-03 (eslint rule) | UNCHANGED. Not re-listed (configuration-only, no longer load-bearing now that CR-01 is fixed; track separately). |

**Three brand-new findings** flagged in this review that did not appear in the prior report:
- WARNING: shared `mobileCardHeightCache` measures both printer and material cards (different
  sizes) — see new WR-06 below.
- INFO: `console.log` debug artifact in CostCalculator (pre-existing but in scope) — see new
  IN-03 below.

Build verification per the phase context: `tsc -b` exit 0, main chunk 45.4 KB gz. Build-gate
and chunk-split changes from prior review remain in scope (warnings unchanged).

---

## Warnings

### WR-01: `manualChunks` comment is incorrect — `/dexie/` does NOT match `/dexie-react-hooks/`

**File:** `vite.config.ts:82–88`

**Issue:**

The comment at lines 82–84 still states *"the hooks package must be caught by its own
substring match (NOT the shorter `/dexie/`, which would also match it via path prefix)."*
This is factually wrong. `String.prototype.includes('/dexie/')` requires the literal
substring `/dexie/` (with trailing slash), which is **not** present in
`node_modules/dexie-react-hooks/...` paths. The two clauses match disjoint directory names.
The current code is functionally correct, but the stated rationale will mislead the next
maintainer who tries to "simplify" by deleting one branch and trusting the false comment
instead of testing.

**Fix:**

```ts
// Both Dexie and its companion hooks package are bundled as vendor code. We
// catch each directory explicitly so a future refactor of dexie's layout
// (e.g., subpath exports under /dexie/) can't silently drop one into the
// catch-all vendor chunk.
if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
```

---

### WR-02: `assert-bundle-size.mjs` only gates `index-*.js` — vendor chunks can balloon undetected

**File:** `scripts/assert-bundle-size.mjs:14, 16–18`

**Issue:**

The regex `^index-[A-Za-z0-9_-]+\.js$` matches the entry chunk only. The `manualChunks`
config emits `react-vendor`, `dexie-vendor`, and `vendor` chunks (hashed filenames like
`react-vendor-AbCd1234.js`) that are **not** gated. A future commit that eagerly imports a
heavy dependency (e.g., `papaparse` not behind a `React.lazy`) will inflate the total
initial-load payload without tripping the budget. The script header reads "Keeps the main app
chunk under the PERF-01 budget," but PERF-01's stated intent is total eager payload, not just
the entry. The script currently provides a partial signal that will silently degrade.

**Fix:** Either widen the match to cover all eager chunks and sum their gzipped sizes, or
explicitly scope the budget to "entry only" in the script + docs.

```js
const EAGER_PATTERN = /^(index|react-vendor|dexie-vendor|vendor)-[A-Za-z0-9_-]+\.js$/;
const eagerChunks = readdirSync(DIST_DIR).filter(n => EAGER_PATTERN.test(n));
const totalGzipped = eagerChunks
  .map(n => gzipSync(readFileSync(join(DIST_DIR, n))).length)
  .reduce((a, b) => a + b, 0);
// compare totalGzipped to MAX_GZIPPED_BYTES
```

---

### WR-03: `useDynamicRowHeight({ key: selectedJobId ?? '' })` flushes the entire row-height cache on every selection toggle — now more costly post-CR-01

**File:** `src/components/JobsManager.tsx:464–467`

**Issue:**

This was WR-03 in the prior review and remains unchanged. The reasoning is **upgraded** now
that CR-01 is fixed: previously, every parent render remounted every visible row anyway, so
the cache flush had no marginal cost beyond what was already happening. With the row
components correctly memoized at module scope, the system is now in the steady state the
optimization was designed for — and the cache flush sticks out as the only mechanism that
forces wasted re-measurement.

Each click on a job card changes `selectedJobId`, which flips the `key` arg, which resets the
measurement cache. react-window then re-measures every overscanned row (~15–25 rows) using
`ResizeObserver`, briefly rendering each at the 88px `defaultRowHeight` until measurement
completes. Users will see a visible height jump / scroll-jump every time they collapse a
deeply-expanded row. The 100+ row list this is meant to optimize for is exactly where this
hurts most.

`useDynamicRowHeight`'s built-in `ResizeObserver` already detects the per-row size change
when an expanded card collapses. The `key` arg is intended for "the entire dataset changed"
events (filter/sort/tab switch), not per-row state toggles.

**Fix:**

```ts
// Just this — no `key`. ResizeObserver handles per-row size changes.
const rowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88 });
```

If a visible flicker remains after dropping `key`, the deeper fix is to ensure the
expanded-detail block renders inside the row's outer `<div style={style}>` so the natural
height-change is observed cleanly.

---

### WR-04: `overflow-x-auto` wrapper around virtualized `<List>` creates competing scroll containers

**File:** `src/components/AssetLibrary.tsx:1175`

**Issue:**

Unchanged from the prior review's WR-05. The desktop table branch still renders inside
`<div className="hidden md:block overflow-x-auto">`, which wraps either the non-virtualized
row list or the virtualized `<List>`. The List sets its own `style.height: '60vh'` and uses
internal scrolling for the virtualized body — wrapping it in a horizontal-overflow container
is a vestige of the old `<table>` markup (where horizontal overflow was needed on narrow
viewports).

With grid-based rows (lines 285, 356), horizontal overflow shouldn't occur — `grid-cols-7`
and `grid-cols-6` are fraction-based and adapt to the container width. The wrapper now does
nothing useful and risks competing wheel-scroll handlers on narrow desktop widths.

**Fix:** Drop `overflow-x-auto` for the virtualized branch (or for the entire block, since
grids no longer need it):

```tsx
<div className="hidden md:block">
  {/* header + body, virtualized or not */}
</div>
```

---

### WR-05: `AssetListSkeleton` still hard-codes 7 columns; materials tab shows wrong column count during load

**File:** `src/components/AssetLibrary.tsx:22, 60–87, 788`

**Issue:**

Unchanged from the prior review's WR-07. `AssetListSkeleton()` takes no arguments and always
renders 7 `<th>` / `<td>` per row. The materials view (`filterCategory !== 'printer'`)
renders 6 columns in reality (line 1211). The IN-01 comment in the file acknowledges this
trade-off but it's still a layout-shift bug: the skeleton is supposed to **prevent** layout
shift, and instead introduces a one-column "snap" when data arrives on the materials tab.

**Fix:**

```tsx
function AssetListSkeleton({ isPrinterView }: { isPrinterView: boolean }) {
  const columns = isPrinterView ? 7 : 6;
  // ... render `columns` <th> and <td> placeholders
}
// Call site:
<AssetListSkeleton isPrinterView={filterCategory === 'printer'} />
```

---

### WR-06: Shared `mobileCardHeightCache` measures both printer and material cards — wrong cached heights survive tab switches

**File:** `src/components/AssetLibrary.tsx:733, 1153`

**Issue:**

`mobileCardHeightCache` (line 733) is a single `useDynamicRowHeight` cache reused across
both the printer-tab and material-tab mobile views (line 1153 — only one `<List>` is rendered
at a time, but the cache persists across tab switches because it lives in the component
scope, not inside a category-specific branch). Printer cards (lines 202–224) render a 4-row
grid with up to 8 cells (price/wattage/nozzle cost + lifespan) and are typically ~250–300px
tall. Material cards (lines 226–247) render 2–3 baseline-aligned rows and are typically
~150–180px tall.

When the user switches between Printer and Material tabs on mobile, the cache still contains
heights measured for the *previous* category's items at indices 0..N. The first paint after
the tab switch shows rows at the wrong heights until `ResizeObserver` re-measures, producing
a visible jump.

In contrast, desktop has two separate caches (`printerRowHeightCache` and
`materialRowHeightCache` at lines 734–735), avoiding this issue. The same separation should
apply on mobile.

**Fix:**

Either give mobile a `key` arg that invalidates on tab switch (mirror the desktop split with
two caches, since per WR-03 we want to avoid `key` resets for normal use), or split the
mobile cache:

```ts
const printerMobileCardHeightCache = useDynamicRowHeight({ defaultRowHeight: 280 });
const materialMobileCardHeightCache = useDynamicRowHeight({ defaultRowHeight: 200 });
// In render:
rowHeight={filterCategory === 'printer' ? printerMobileCardHeightCache : materialMobileCardHeightCache}
```

The same concern applies (less severely) to pagination: when paginatedAssets changes, the
height at index N now corresponds to a different asset. The `ResizeObserver` re-measures
correctly but the first frame uses the previous page's height. Same fix shape if you decide
this matters.

---

## Info

### IN-01: `assert-bundle-size.mjs` uses default gzip level (6); production CDN serves gzip-9 or brotli

**File:** `scripts/assert-bundle-size.mjs:29`

**Issue:** Unchanged from the prior review. The local budget gate uses Node's `gzipSync` at
default level 6. Vercel's edge CDN serves gzip-9 or brotli depending on `Accept-Encoding`.
The local number is a useful proxy but isn't the bytes shipped to users. A 299 KB local-gzip
result could be 270 KB brotli (well under) or 305 KB gzip-9 (over).

**Fix:**

```js
const gzipped = gzipSync(buf, { level: 9 }).length;
// Optionally also compute brotliCompressSync(buf).length and report both.
```

---

### IN-02: Skeleton uses `<table>` but real markup uses `<div role="row">` grid — column proportions won't match

**File:** `src/components/AssetLibrary.tsx:61–88` (skeleton uses `<table>`) vs `1178–1235` (real markup uses `<div>` grids)

**Issue:** Unchanged from the prior review. The skeleton still uses native `<table>` while
the real virtualized branch uses `<div role="row" className="grid grid-cols-7 ...">`. Native
table column-sizing (auto-layout from content widths) and `grid-cols-7` (equal-fraction by
default) produce different column proportions. The user sees a column-width "snap" when data
arrives.

**Fix:** Re-implement the skeleton with the same grid markup the real table now uses
(`grid grid-cols-7 gap-x-4` / `grid grid-cols-6 gap-x-4`). Then column widths are guaranteed
to match.

---

### IN-03: `selectedSales` is passed to every row but only used by the selected row — and `console.log` left in CostCalculator

Two unrelated minor items collected here.

**File 1:** `src/components/JobsManager.tsx:292, 476, 246`

**Issue:** `useSales(selectedJobId || undefined)` returns the **filtered** sales for the
selected job (or all sales if nothing is selected). That single array is then passed to every
row via `selectedSales` in `rowProps`. Only the selected row actually reads it (line 246:
`recentSales={isSelected ? selectedSales : undefined}`). This works correctly today and is
deliberate — passing `salesByJob` (the full map) to every row would create more
re-measurement churn. But it's a subtle data-flow contract: `selectedSales` is "the sales for
*the* selected row, ignored by all other rows," not "this row's sales." A short JSDoc on the
`JobRowProps.selectedSales` field would help future maintainers.

**Fix:**

```ts
type JobRowProps = {
  // ...
  /**
   * Sales records for the currently-selected job, or `undefined` when no row is selected.
   * Non-selected rows IGNORE this — only the row matching selectedJobId reads it for the
   * "Recent Sales" panel. Passing the full salesByJob map per-row was rejected to keep
   * rowProps shallow comparison cheap.
   */
  selectedSales: Sale[];
  // ...
};
```

**File 2:** `src/components/CostCalculator.tsx:218`

**Issue:** Pre-existing `console.log('Auto-selecting printer:', printerInstances[0].id, ...)`
in the printer-auto-select effect. This is debug noise in production. Pre-existing in the
file (was not added by Phase 11 commits, confirmed via git blame to initial commit) but lives
in the reviewed scope.

**Fix:** Remove the line. If the auto-select event is interesting for analytics, route it
through Vercel Analytics instead of stdout.

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
