---
phase: 11-performance-optimization
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - vite.config.ts
  - scripts/assert-bundle-size.mjs
  - src/components/JobsManager.tsx
  - src/components/AssetLibrary.tsx
  - package.json
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 11 ships virtualization for `JobsManager` and `AssetLibrary`, a `manualChunks` split,
and a gzipped main-chunk budget enforced by `scripts/assert-bundle-size.mjs`. The build-gate
script and chunk-split config are sound. The virtualization work, however, contains several
**correctness** bugs that defeat the optimization or actively cause visual / behavioral
regressions when the virtualized branch fires:

1. **All row components are declared inside the parent function body.** Every parent render
   creates fresh `JobCard` / `JobRow` / `MobileCardItem` / `PrinterRow` / `MaterialRow` (+ their
   adapters). react-window v2 internally calls `React.memo(rowComponent)` — when the function
   identity changes on every render, the memo wrapper is rebuilt, and **every visible row
   remounts on every parent render**. This is the single most impactful bug in the phase: it
   converts virtualization from a perf win into a perf regression for long lists. It also
   blows away any per-row state (focus, in-flight transitions) on each unrelated parent
   re-render.
2. **Asset rows use fixed `rowHeight={56}` (desktop) and `rowHeight={280}` (mobile)** even
   though the row content is dynamic: `notes` adds a second text line; `tags` wrap to N lines;
   filament rows render an extra badge row. Tall rows will visually overlap or get clipped
   against the following row, because the virtual layout reserves only the fixed height.
3. **`JobCard` reads selection state, sales data, and handlers via closure**, but
   `rowProps={{ jobs }}` only declares `jobs`. react-window v2 re-renders rows only when
   `rowProps` shallow-changes, so changes to `selectedJobId`, `sales`, or callbacks would not
   propagate through the documented channel. In practice the bug is masked because (a) every
   render currently remounts the rows due to the identity bug above, and (b) the
   `useDynamicRowHeight({ key: selectedJobId })` cache reset forces a re-measure. Once
   findings 1 / Mason are fixed, this becomes a real staleness bug.

Build-gate and chunk-split work are clean modulo small comment/scope nits called out below.

The structural pattern (plain Row component + thin adapter) is a fine sidestep of v2's
`RowComponentProps` constraint — but it must be applied at **module scope**, not inside the
component, to retain the perf wins.

## Critical Issues

### CR-01: Row components declared inside parent body — react-window memo identity churns every render, remounting all visible rows

**File:** `src/components/JobsManager.tsx:233-407`, `src/components/AssetLibrary.tsx:457-710`

**Issue:**

In `JobsManager`, `JobCard` (line 233) and `JobRow` (line 405) are declared inside the
`JobsManager` function body. Same pattern in `AssetLibrary`: `MobileCardItem` (line 457),
`MobileCardRow` (line 575), `PrinterRow` (line 580), `PrinterRowAdapter` (line 640),
`MaterialRow` (line 645), `MaterialRowAdapter` (line 708). Every parent render produces new
function instances.

react-window v2's `<List>` internally wraps the `rowComponent` prop with `React.memo` and
recomputes that memoized component with `useMemo(() => memo(f, ...), [f])` (verified in
`node_modules/react-window/dist/react-window.js:725`). When `f` is a new function reference
on every parent render, the memo wrapper is rebuilt and **every visible row unmounts and
remounts on every parent render** — the worst possible outcome:

- Throws away any local row state (in-progress focus, transitions, hover).
- Re-runs `JobCard`'s `getBreakEvenInfo`, `getFilamentName`, etc. for every visible row even
  when nothing relevant changed.
- Defeats the entire purpose of virtualization. With 100 rows in the JobsManager, every
  state change in the parent (e.g., typing in the sale-quantity input while the modal is
  open) re-mounts ~20 visible rows.
- Worse than no virtualization in many cases.

The same identity-churn problem also breaks the small-list branch (`jobs.length <= 100` in
JobsManager; mobile `<= 50` and desktop `<= 50` in AssetLibrary), where `<JobCard>` /
`<MobileCardItem>` / `<PrinterRow>` / `<MaterialRow>` are rendered directly. Even with `key`
props, React treats a new component type as a different component and remounts every card on
every parent render. (Test: try typing in the sale-form quantity input — every visible job
card will re-mount.)

**Fix:**

Move every Row / Adapter pair **out of the component function body** and into module scope,
then pass the variable parts through `rowProps`:

```tsx
// At module scope (outside JobsManager):
type JobCardProps = {
  job: PrintJob;
  isSelected: boolean;
  info: BreakEvenInfo;
  sales: Sale[];
  onSelect: (id: string) => void;
  onRecordSale: (job: PrintJob) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  getFilamentName: (id: string) => string;
  style?: React.CSSProperties;
};

const JobCard = React.memo(function JobCard(props: JobCardProps) { /* ... */ });

type JobRowProps = {
  jobs: PrintJob[];
  selectedJobId: string | null;
  // ...all the closure-captured handlers/state
};

const JobRow = ({ index, style, jobs, selectedJobId, ...rest }: RowComponentProps<JobRowProps>) => (
  <JobCard
    job={jobs[index]}
    isSelected={selectedJobId === jobs[index].id}
    style={style}
    {...rest}
  />
);
```

In JobsManager, pass everything the row needs through `rowProps`:

```tsx
<List
  rowComponent={JobRow}
  rowCount={jobs.length}
  rowHeight={rowHeightCache}
  rowProps={{
    jobs,
    selectedJobId,
    salesByJob,
    onSelect: setSelectedJobId,
    onRecordSale: (job) => { setShowSaleForm(true); setSalePrice(job.sellingPrice); },
    onEdit: handleEditJob,
    onDelete: handleDeleteJob,
    getFilamentName,
    /* ...etc */
  }}
  /* ... */
/>
```

Apply the same pattern to all five `AssetLibrary` row components. After this fix, the row
function identity is stable across parent renders, `React.memo` actually memoizes, and
react-window's `rowProps` shallow comparison drives re-render of only the rows whose data
changed.

---

### CR-02: Fixed `rowHeight` for AssetLibrary rows clips/overlaps dynamic content

**File:** `src/components/AssetLibrary.tsx:1120, 1162, 1193` (desktop `rowHeight={56}`; mobile `rowHeight={280}`)

**Issue:**

Desktop printer/material rows use `rowHeight={56}` and mobile cards use `rowHeight={280}`.
The row content is dynamic:

- `PrinterRow` (line 580) and `MaterialRow` (line 645) both render `asset.notes` as a second
  text line when present, plus an N-row wrapping tag chip cluster (`flex flex-wrap gap-1
  mt-1` at line 593/657). A row with `notes` plus three tags spread across two wrapped lines
  is easily 80-100px tall. With `py-2` (16px vertical padding) plus the multi-line content
  and `border-b`, exceeding 56px is the common case, not the edge case.
- `MobileCardItem` (line 457) similarly varies dramatically: a plain consumable without notes
  / tags / lifespan is ~180-200px; a printer with full lifespan + nozzle data + 5 tags +
  notes is well over 280px (line 519-549 alone adds 4 grid rows plus action buttons).

react-window v2 with a numeric `rowHeight` allocates exactly that height per row using
absolute positioning. Content taller than the allocated height overflows into the next row's
slot, producing visually overlapping text. Content shorter leaves a gap (less harmful but
still ugly). The skeleton in `AssetListSkeleton` (line 22) even acknowledges that real cards
have multi-line content with the IN-01 note about column counts — but the real virtualized
branch ignores this.

JobsManager handles this correctly via `useDynamicRowHeight` + the `key: selectedJobId` cache
invalidation. AssetLibrary does not.

**Fix:**

Use `useDynamicRowHeight` (already imported and used in `JobsManager.tsx`) for the three
asset list slots:

```tsx
const printerRowHeight = useDynamicRowHeight({ defaultRowHeight: 64 });
const materialRowHeight = useDynamicRowHeight({ defaultRowHeight: 64 });
const mobileCardHeight = useDynamicRowHeight({ defaultRowHeight: 240 });
```

Pass each cache as `rowHeight={...}` instead of the fixed number. Note that
`useDynamicRowHeight` is documented as "not as efficient as predetermined sizes" — for the
desktop tables this is the right trade-off because content height genuinely varies. If you
want fixed heights for max perf, you must constrain the rendered content (e.g., truncate
notes to a single line, hide tags in the virtualized slot, render no wrapping).

Without this fix, any user with a populated library (notes or tags on assets) above the 50-
or 100-row threshold will see visually broken rows.

---

### CR-03: `JobCard` reads `selectedJobId`, `sales`, and handlers via closure but they are not in `rowProps`

**File:** `src/components/JobsManager.tsx:233-397`, `429`

**Issue:**

`JobCard` reads from the surrounding `JobsManager` closure:

- `selectedJobId` (lines 235, 240) — drives `isSelected` and the expanded-detail render.
- `sales` (line 377) and the destructured `addSale` flow (indirectly through `setShowSaleForm`).
- `setShowSaleForm`, `setSalePrice`, `handleEditJob`, `handleDeleteJob`, `getBreakEvenInfo`,
  `getFilamentName` — all closed over.

But `rowProps={{ jobs }}` (line 429) only declares `jobs`. From the v2 type declaration
(`react-window.d.ts:412`): *"List will automatically re-render rows when values in this
object change."* If `selectedJobId` changes and nothing in `rowProps` shallow-changed,
react-window's memoized row will not re-render.

This bug is currently masked by two unrelated things:
1. CR-01 — every parent render rebuilds the memoized rowComponent, so every row re-renders
   regardless of `rowProps`.
2. The `useDynamicRowHeight({ key: selectedJobId ?? '' })` cache reset (line 228) — when
   `selectedJobId` changes, the height cache key changes, the List re-measures everything,
   and that forces a re-render path.

Once CR-01 is fixed (rowComponent identity made stable), this becomes a real staleness bug:
toggling selection will not visually update the rows because `selectedJobId` lives only in
the closure, not in `rowProps`. The selection will appear "stuck" until something else
triggers a re-render via `rowProps`.

**Fix:**

Pair this with CR-01: move all closure-captured state into `rowProps`:

```tsx
<List
  rowComponent={JobRow}
  rowCount={jobs.length}
  rowHeight={rowHeightCache}
  rowProps={{
    jobs,
    selectedJobId,           // <-- add
    salesByJob,              // <-- pass map, not the single-row sales array
    onToggleSelect: setSelectedJobId,
    onRecordSale: handleOpenSaleForm,
    onEdit: handleEditJob,
    onDelete: handleDeleteJob,
    getFilamentName,
    getBreakEvenInfo,
  }}
  overscanCount={4}
  style={{ height: '70vh' }}
/>
```

Also note: `sales` from `useSales(selectedJobId)` (line 54) is the **filtered** list for the
selected job only — feeding it to every `JobCard` makes only the selected row's
"Recent Sales" panel correct; every other row would see the wrong job's sales if it tried to
render them. Today only the selected card renders sales (gated by `{isSelected && ...}`), so
this works by accident. Pass `salesByJob` instead and have the card pick its own entries —
that makes the data flow explicit and matches `getBreakEvenInfo`'s usage.

## Warnings

### WR-01: `manualChunks` comment is incorrect — `/dexie/` does NOT match `/dexie-react-hooks/`

**File:** `vite.config.ts:82-90`

**Issue:**

The comment at lines 83-84 states *"the hooks package must be caught by its own substring
match (NOT the shorter `/dexie/`, which would also match it via path prefix)."* This is
factually wrong. `String.prototype.includes('/dexie/')` requires the literal substring
`/dexie/` (with trailing slash), which is **not** present in `node_modules/dexie-react-hooks/...`.
The longer match isn't needed for disambiguation — `/dexie/` and `/dexie-react-hooks/` are
disjoint. The current code happens to be correct, but the rationale documented in the comment
is wrong, which will confuse the next maintainer who tries to "simplify" by removing the
second clause and verifies via the (false) comment instead of testing.

**Fix:** Either remove the misleading rationale or rewrite to reflect the real reason both
clauses are present (they catch different but adjacent packages and both belong in the same
chunk):

```ts
// Both Dexie and its companion hooks package live in node_modules/. We catch
// each path explicitly so a future refactor of dexie's directory layout
// (e.g., subpath exports) can't silently drop one of them into the catch-all
// vendor chunk.
if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
```

---

### WR-02: `assert-bundle-size.mjs` only fails on `index-*.js` — vendor chunks can balloon undetected

**File:** `scripts/assert-bundle-size.mjs:14, 16-18`

**Issue:**

The regex `^index-[A-Za-z0-9_-]+\.js$` matches the entry chunk only. The new `manualChunks`
config (vite.config.ts:85) emits `react-vendor`, `dexie-vendor`, and `vendor` chunks with
hashed filenames like `react-vendor-AbCd1234.js` — none of these are gated by the budget. A
runaway dependency that ends up in `vendor` (e.g., someone imports `papaparse` eagerly
instead of behind a `React.lazy`) will inflate the total gzipped bytes shipped to the user
without tripping the gate.

The budget docs in the script header ("Keeps the main app chunk under the PERF-01 budget")
say "main app chunk," but PERF-01's intent (from `.planning/phases/11-performance-optimization/`)
is total initial-load payload, not just the entry. As written, the gate is a partial signal
that will silently degrade as vendor chunks grow.

**Fix:** Compute the sum of all eagerly-loaded chunks (entry + vendor chunks). Lazy route
chunks are loaded on demand and can legitimately stay out of the budget. One approach:

```js
const EAGER_PATTERN = /^(index|react-vendor|dexie-vendor|vendor)-[A-Za-z0-9_-]+\.js$/;
// Then sum gzipped sizes of all matches and compare to budget.
```

Alternatively, raise the budget to reflect the full eager payload and document that the gate
is intentionally "main + vendors." Either is acceptable; the current state — strict gate on
one of N chunks — does not match PERF-01's stated goal.

---

### WR-03: `useDynamicRowHeight({ key: selectedJobId })` re-measures every row on every selection change

**File:** `src/components/JobsManager.tsx:226-229`

**Issue:**

The `key` prop on `useDynamicRowHeight` resets the **entire** measurement cache when it
changes. The comment at line 222-225 frames this as a feature ("the previously-expanded row
collapses back to ~88px and the newly-selected row grows to its measured ~400px height") —
but the cost is that *every* row's measured height is also forgotten and must be re-measured
on next paint via `ResizeObserver`. With overscan 4 plus a tall viewport, that's 15-25 rows
re-measured on every click.

The first paint after each toggle uses `defaultRowHeight: 88`, so on selection-toggle of a
deeply expanded row, the list height jumps (height collapses to defaults, then immediately
expands as measurements complete). Users will perceive flicker / scroll-jump on every
collapse, especially noticeable on the 100+ row list this is meant to optimize for.

react-window's `useDynamicRowHeight` is designed to handle row-height changes via
`ResizeObserver` *without* a cache reset — the `key` arg is for "the whole dataset changed"
(e.g., switching tabs or filters), not for per-row state toggles.

**Fix:** Remove the `key` arg or scope it to changes that genuinely invalidate all rows:

```ts
const rowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88 });
```

The `ResizeObserver` inside `useDynamicRowHeight` already detects per-row size changes when
the expanded section unmounts; the cache reset is unnecessary. If you observe flicker after
removing `key`, the real fix is to ensure the expanded card's `style={style}` is preserved
and the inner expansion uses normal flow so the row's outer height grows naturally.

---

### WR-04: `parseInt`/`parseFloat` patterns silently coerce invalid input to `0` or `1`, hiding user errors

**File:** `src/components/JobsManager.tsx:457, 466, 506` and `src/components/AssetLibrary.tsx:923, 933, 943, 953, 962, 986, 996, 1006`

**Issue:**

The pattern `parseInt(e.target.value) || 1` (line 457) coerces empty string, `NaN`, and
**legitimate zero** to 1. `parseFloat(e.target.value) || 0` (line 466) coerces empty and
`NaN` to 0 but also coerces a typed `0` to 0 (harmless), and negative-typed values to the
parsed negative (because `-5 || 0` evaluates `-5`, but `0 || 0` and empty `'' || 0` both go
to 0). Net effect:

- Typing "0" in `saleQuantity` snaps it back to 1 silently — user thinks they typed 0 but
  the model says 1. There's a `saleQuantity <= 0` guard at line 168, but it never fires
  because the state was just normalized to 1.
- Typing "abc" in any of the price/cost fields zeroes them silently — no validation feedback.
- For `formData.wattage` in AssetLibrary (line 933), typing an invalid value sets wattage to
  `NaN` (because `parseFloat('abc') = NaN`, and `NaN || undefined` short-circuits... actually
  there's no `|| 0` here, so `setFormData({ ..., wattage: parseFloat(e.target.value) })`
  stores `NaN` directly). Then the `formData.wattage` check at line 293 fires `!NaN = true`,
  blocking submit with "Name, purchase price, and wattage are required" — but the field
  visually contains "abc" with no validation hint.

These were pre-existing patterns inherited into Phase 11's edits (the file under review),
not new in Phase 11, but they live in the reviewed files.

**Fix:** Standardize to `Number()` with explicit `Number.isFinite` guards, or to controlled
inputs with explicit validation messaging:

```tsx
onChange={e => {
  const raw = e.target.value;
  const n = raw === '' ? 0 : Number(raw);
  if (Number.isFinite(n)) setSaleQuantity(n);
}}
// then validate `saleQuantity < 1` at submit and show the user *why* it's rejected
```

If you want the existing "snap to 1" behavior, at least surface it: render a hint when the
typed value is non-positive.

---

### WR-05: `overflow-x-auto` wrapper around `<List>` likely conflicts with virtualization

**File:** `src/components/AssetLibrary.tsx:1143`

**Issue:**

The wrapper `<div className="hidden md:block overflow-x-auto">` is meant for the old
`<table>` markup (tables can overflow horizontally on narrow screens). The virtualized
`<List>` sets its own `style.height` and uses absolute-positioned rows inside an
overflow-y-scrolled container. Wrapping the List in another scroll container will at minimum
create competing scroll containers (mouse-wheel events may bubble unpredictably) and may
clip the list's own measurement of available height.

Worse: the inner row content uses `grid-cols-7 gap-x-4` (line 585) and `grid-cols-6
gap-x-4` (line 650). Grid columns size themselves to the **list's** width, not the wrapper's
— but the header row (line 1148, 1180) is rendered outside the List, also as a grid, and
will size against the wrapper width. If the wrapper is wider than the List's measured width
(e.g., after a window resize), the header columns and body row columns will misalign.

**Fix:** Drop `overflow-x-auto` for the virtualized branch, or move the wrapper inside the
non-virtualized branch only. Verify on narrow desktop viewports (e.g., 768-900px) that
column headers and row cells still align:

```tsx
<div className="hidden md:block">
  {/* header row (sized by container) */}
  <div role="row" className="grid grid-cols-7 ...">…</div>
  {/* body — virtualized or not */}
  {effectiveItemsPerPage > 50 ? <List … /> : <div>…</div>}
</div>
```

---

### WR-06: `getDefaultShippingCost` silently returns 0 for the `dropoff` method offered to CAD users

**File:** `src/components/JobsManager.tsx:74, 114-123`

**Issue:**

`availableShippingMethods` for CAD includes `{ value: 'dropoff', label: 'Dropoff' }` (line
74). When a user selects "Dropoff" from the shipping method `<Select>`, the change handler
calls `setSaleShippingCost(getDefaultShippingCost(method))` (line 492). `getDefaultShippingCost`
(line 114) has no `dropoff` branch — it hits the `default` and returns 0.

If the user previously had a non-zero cost typed in, that value is silently zeroed when they
pick Dropoff. There is no UI affordance explaining "Dropoff is variable / you must enter the
cost manually." The user may submit a sale with cost 0 thinking the system auto-filled it.

This is pre-existing in the file but lives in the reviewed scope.

**Fix:** Either add a `dropoff` case to `getDefaultShippingCost` (with a `shippingConfig.dropoffBaseCost`
or `null` sentinel), or preserve the current cost on dropoff:

```ts
const handleShippingMethodChange = (method: ShippingMethodType) => {
  setSaleShippingMethod(method);
  // Methods with a configured default; others (including 'dropoff') keep current cost.
  const defaultCost = getDefaultShippingCost(method);
  if (method !== 'dropoff' && method !== saleShippingMethod) {
    setSaleShippingCost(defaultCost);
  }
};
```

---

### WR-07: Skeleton table column count hard-coded to 7, mismatches material tab (6 cols)

**File:** `src/components/AssetLibrary.tsx:62-87`

**Issue:**

`AssetListSkeleton` renders 7 `<th>` and 7 `<td>` per row. The IN-01 comment in the file
(line 54-60) acknowledges this and explains the trade-off ("matches the worst-case (printer)
column count of 7" / "the materials table has 6 columns; rendering 7 here means the skeleton
may show one extra placeholder column on the materials tab"). The real table conditionally
renders 6 vs 7 columns based on `filterCategory === 'printer'` (line 1144). The skeleton
does not.

The result: on the materials tab during initial load, the skeleton shows an empty extra
column on the right. The user sees the structure of the real table "shift left" by one
column when data arrives. The skeleton is supposed to **prevent** layout shift, not introduce
it.

**Fix:** Pass `filterCategory` (or a derived `isPrinterView`) into the skeleton and render
the correct column count:

```tsx
function AssetListSkeleton({ isPrinterView }: { isPrinterView: boolean }) {
  const columns = isPrinterView ? 7 : 6;
  return (
    // ... mobile cards unchanged ...
    <div className="hidden md:block">
      <table className="w-full text-sm">
        <thead><tr>{Array.from({ length: columns }).map(...)}</tr></thead>
        <tbody>{[0,1,2,3,4].map(i => (
          <tr key={i}>{Array.from({ length: columns }).map(...)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
```

Then call as `<AssetListSkeleton isPrinterView={filterCategory === 'printer'} />`.

## Info

### IN-01: `assert-bundle-size.mjs` ignores brotli — production gzip likely diverges from local

**File:** `scripts/assert-bundle-size.mjs:9, 29`

**Issue:** The script uses Node's `zlib.gzipSync` at default level 6. Vercel's edge CDN
serves either gzip (typically level 9) or brotli depending on `Accept-Encoding`. The local
budget check is a useful proxy but it is *not* the bytes the user actually downloads. A 295
KB local-gzip result could be a 270 KB brotli payload (under budget) or a 310 KB level-9 gzip
on a different runtime. Document this clearly in the script header, or use level 9 and add a
brotli computation.

**Fix:**

```js
const gzipped = gzipSync(buf, { level: 9 }).length;
```

And/or also compute `brotliCompressSync(buf).length` (Node ≥ 12) and report both, gating on
the smaller (since users get whichever the CDN sends).

---

### IN-02: Mixing `<table>` skeleton with `<div role="row">` real markup will not visually match

**File:** `src/components/AssetLibrary.tsx:62-87` (skeleton uses `<table>`) vs `1146-1207` (real markup uses `<div role="row">` grids)

**Issue:** Phase 11-05 replaced the desktop `<table>` with `<div>` grid markup, but the
skeleton still uses `<table>`. Native `<table>` column sizing uses the browser's auto-layout
algorithm (column widths derived from content); CSS Grid with `grid-cols-7` uses
equal-fraction columns by default. The skeleton's column proportions will not match the real
grid's, producing a visible "snap" of column widths when data arrives.

**Fix:** Re-implement the skeleton with the same `grid-cols-7 gap-x-4` / `grid-cols-6 gap-x-4`
markup the real table now uses. Then the column widths are guaranteed to match.

---

### IN-03: `JobCard` re-defined inside parent shadows is harmless but Eslint `react/no-unstable-nested-components` would flag it

**File:** `src/components/JobsManager.tsx:233`, `src/components/AssetLibrary.tsx:457, 580, 645`

**Issue:** This is the lint-level companion to CR-01. The project's ESLint config does not
include `eslint-plugin-react/no-unstable-nested-components`, so the bug ships uncaught. Add
the rule (or upgrade the eslint config to `react/recommended`) so the next round of nested
component drift is caught at lint time, not at perf-investigation time.

**Fix:**

```js
// eslint.config.js — add to plugins.react.rules
'react/no-unstable-nested-components': ['error', { allowAsProps: false }],
```

---

### IN-04: `_` and similar single-letter loop vars in skeleton; `q`/`F`/`V`/`I` in compiled react-window output

**File:** N/A — only authored sources reviewed

**Issue:** Authored code uses readable names; no single-letter shadowing in scope. The
single-letter names in `node_modules/react-window/dist/react-window.js` quoted above are
post-minifier and not part of this review. Mentioned only to acknowledge the codebase as
clean on naming.

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
