---
phase: 09-skeleton-loading-states
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/App.tsx
  - src/components/AssetLibrary.tsx
  - src/components/JobsManager.tsx
  - src/components/PrinterSettings.tsx
  - src/components/ui/Skeleton.tsx
  - src/components/ui/Skeleton.test.ts
  - src/components/ui/index.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 9 ships the `Skeleton` primitive plus three co-located list skeletons and rewires the three list consumers (AssetLibrary, JobsManager, PrinterSettings) to render `loading → skeleton → empty → content`. The locked decisions are respected: D-08 (no NEW badge) is honored; D-10 ordering is correct in all three consumers; `shouldShowEmptyState` is now called everywhere (resolving Phase 8 IN-01); the Skeleton primitive lives in `src/components/ui/` and the composed skeletons are co-located with their consumers; `animate-pulse` is baked in; `role="status"` is present; `Skeleton.test.ts` uses `React.createElement` (no JSX) per the vitest constraint.

The most serious correctness issue is in the `Skeleton` primitive itself: every variant's preset already contains a `rounded*` class, but the className builder appends `rounded` (the consumer override) AFTER the variant string, which means class-collision behavior is not the override the API contract advertises. Real consumers already exercise this — `AssetListSkeleton` passes `rounded="rounded-full"` for the badge-shaped placeholder but the element will also carry the variant's plain `rounded` class, and `PrinterListSkeleton`'s progress-bar fill passes `rounded="rounded-full"` plus `height="h-full"` on a `line` variant that already has `h-4`. Because Tailwind classes here are not conflict-resolved, both the variant default and the override end up in the DOM; visually the override wins (last class on a non-arbitrary spec rules), but the API claim of "override" is leaky.

Beyond that, there are several warnings around dead code that survived the refactor (`_getPrinterName` in JobsManager, an empty `<div>` wrapping a single mobile card-header child, an unused `effectiveItemsPerPage` arithmetic branch when `itemsPerPage === 0`), plus a brittle empty-state coupling in AssetLibrary (the global empty state uses `assets` instead of `displayAssets`, so a user who imported only a printer will see "No materials" while sitting on the All tab even though the library has 1 item).

No security issues, no secrets, no injection vectors, no unsafe deserialization. Pure UI refactor — risk surface is correctness and contract clarity, not security.

## Warnings

### WR-01: Skeleton variant baseline collides with consumer-supplied `rounded`/`height`/`width` overrides

**File:** `src/components/ui/Skeleton.tsx:12-16, 31`
**Issue:** The variant style strings bake in dimensional + radius classes:
```
line:   'h-4 w-full rounded'
card:   'h-24 w-full rounded-xl'
circle: 'h-10 w-10 rounded-full'
```
The render concatenates as `variantStyles[variant] ${width} ${height} ${rounded} ${className}`. Tailwind does not collapse conflicting utility classes at runtime — both `rounded` (from `line`) and `rounded-full` (from `rounded={'rounded-full'}`) land in the DOM. In practice the later class wins for the same property thanks to CSS source order, but:

1. The Skeleton API documents `rounded`, `width`, `height` as configurables; the variant baselines silently fight them. The `card` variant is the worst case — `rounded-xl` ships before any consumer override, and `h-24 w-full` will collide with `width="w-12"` or `height="h-8"`.
2. Real consumers already trigger this collision pattern:
   - `AssetLibrary.tsx:30` — `<Skeleton variant="line" width="w-16" height="h-5" rounded="rounded-full" />` — DOM ends up with `h-4 w-full rounded ... w-16 h-5 rounded-full`.
   - `AssetLibrary.tsx:41-42` — `<Skeleton variant="line" height="h-9" className="flex-1" />` — DOM ends up with `h-4 w-full rounded h-9 flex-1`. Renders `h-9` correctly today but the duplication is dead bytes and a maintenance trap.
   - `PrinterSettings.tsx:29-30` — progress-bar fill uses `<Skeleton variant="line" height="h-full" width="w-1/3" rounded="rounded-full" />`, parent only has `h-1.5` → the `h-4` baseline is meaningless inside an `h-1.5` container but still emitted.

**Fix:** Strip dimensional/radius classes from variant baselines and let the props own them (the variant should pick the *shape archetype* only — radius defaults belong with the variant's spec, but should be omitted whenever an override is provided). Simplest patch:
```ts
type SkeletonVariant = 'line' | 'card' | 'circle';

const variantDefaults: Record<SkeletonVariant, { h: string; w: string; rounded: string }> = {
  line:   { h: 'h-4',  w: 'w-full', rounded: 'rounded' },
  card:   { h: 'h-24', w: 'w-full', rounded: 'rounded-xl' },
  circle: { h: 'h-10', w: 'w-10',   rounded: 'rounded-full' },
};

export function Skeleton({ variant = 'line', width, height, rounded, className = '', ...props }: SkeletonProps) {
  const v = variantDefaults[variant];
  const cls = [
    'bg-slate-700 animate-pulse',
    height ?? v.h,
    width  ?? v.w,
    rounded ?? v.rounded,
    className,
  ].filter(Boolean).join(' ').trim();
  return <div role="status" aria-label="Loading" aria-busy="true" className={cls} {...props} />;
}
```
This is also testable — add a Test 8: `renders Skeleton variant="card" width="w-12" → does NOT contain "w-full"`.

**Classification:** WARNING (current behavior happens to render correctly because CSS source order favors the override; the bug is in the contract, not the pixels).

---

### WR-02: AssetLibrary empty state uses raw `assets`, not the displayed slice — false negative on "All" tab

**File:** `src/components/AssetLibrary.tsx:466-474`
**Issue:** The render gate is:
```tsx
{isLoading ? (
  <AssetListSkeleton />
) : shouldShowEmptyState(assets, isLoading) ? (
  <EmptyState ... title="No materials in your library yet" .../>
) : ( ... )}
```
But the actual list shown on the `All` tab filters printers out (`displayAssets = filteredAssets.filter(a => a.category !== 'printer')`). A user who imported only printers (e.g., via CSV) will see the full populated UI with filter tabs, search, an empty table, and the small `"No materials found"` text at line 1077/925 — never the empty-state hero. Worse: a user who deleted all materials but kept printers will see the same broken state.

Conversely, the empty-state CTA `startAddingFilament` (line 387-393) forces `category: 'filament'` regardless of `filterCategory`, which is correct when the library is empty, but if a user is on the `printer` filter tab with zero printers, they will be told to add a "Material" with filament pre-selected even though they wanted to add a printer.

**Fix:** Either gate empty state on `displayAssets` (current view) so the hero matches what the user is looking at, or — simpler — keep the global check but make the predicate `assets.length === 0` explicit and document that the "All" tab is the canonical empty surface. Recommended:
```tsx
) : shouldShowEmptyState(assets, isLoading) ? (
  // Empty library: show the global empty state with material CTA (matches D-10 intent)
  <EmptyState ... />
) : (
  ...
)
```
Then add a per-tab empty hint inside the printer/filter branches when `displayAssets.length === 0` but `assets.length > 0` (already partially handled by lines 924-925 and 1076-1078, which display a small "No X found" text — but that text says "No printers found" while sitting on the printer tab even when there ARE printers if a search clears them; that's the search-empty case and it's currently conflated with the filter-empty case).

**Classification:** WARNING (functional gap — printer-only library shows the wrong empty surface).

---

### WR-03: JobsManager has dead helper `_getPrinterName` kept alive by `void` — anti-pattern

**File:** `src/components/JobsManager.tsx:212-218`
**Issue:**
```ts
const _getPrinterName = (printerInstanceId: string) => {
  const instance = printerInstances.find(p => p.id === printerInstanceId);
  if (!instance) return 'Unknown';
  const config = printers.find(p => p.id === instance.printerConfigId);
  return `${instance.nickname} (${config?.name || 'Unknown'})`;
};
void _getPrinterName; // Silence unused warning
```
This is a dead function shipped to production to silence `noUnusedLocals`. Two problems:
1. It pulls `printers` and `printerInstances` into the function's closure on every render (they're already props, but the lint-silencer pattern teaches the wrong lesson — that "underscore-prefix + `void`" is acceptable for surviving a stricter `tsc -b`).
2. The Phase 9 refactor removed early-return modal mounting branches; this helper appears to be a leftover from a prior branch and was never used in the new single-return body.

`grep -n _getPrinterName src/components/JobsManager.tsx` confirms zero call sites.

**Fix:** Delete the function and the `void`:
```ts
// remove lines 212-218 entirely
```
If a future feature needs the printer name in the jobs list, re-introduce it then.

**Classification:** WARNING (dead code shipped intentionally — pattern to discourage).

---

### WR-04: JobsManager break-even progress bar can produce `NaN%` / `Infinity` width when `breakEvenCopies` is `Infinity`

**File:** `src/components/JobsManager.tsx:141-145, 313`
**Issue:** `getBreakEvenInfo` returns `breakEvenCopies = Infinity` when `effectiveProfitPerUnit <= 0 && job.modelCost > 0`. Two consumers then use that value:
- Line 308: `{job.copiesSold} / {info.breakEvenCopies} copies` → renders "0 / Infinity copies" in the UI.
- Line 313: `style={{ width: ${Math.min(100, (job.copiesSold / info.breakEvenCopies) * 100)}% }}` → with `breakEvenCopies = Infinity`, `copiesSold / Infinity = 0`, so width becomes `0%`. That part is OK.

The numeric display "Infinity" leaks to the user. Also, when `info.breakEvenCopies === 0` (zero model cost and zero profit per unit), the same line divides by zero → `NaN%`, which CSS treats as `0%` but is still wrong arithmetic.

Note this is technically a pre-existing bug in `getBreakEvenInfo` rather than introduced by Phase 9 — but Phase 9 reorganized the surrounding control flow (early returns → single return), and the badge `info.remainingToBreakEven` (line 261, computed as `Math.max(0, Infinity - copiesSold)` = `Infinity`) now renders inside the jobs list along with the progress bar instead of being short-circuited. Verify with a job priced at or below cost.

**Fix:** Normalize the values in `getBreakEvenInfo` before they reach JSX:
```ts
const breakEvenCopiesRaw = effectiveProfitPerUnit > 0
  ? Math.ceil(job.modelCost / effectiveProfitPerUnit)
  : job.modelCost > 0 ? Infinity : 0;
const breakEvenCopies = Number.isFinite(breakEvenCopiesRaw) ? breakEvenCopiesRaw : null;
const remainingToBreakEven = breakEvenCopies === null
  ? null
  : Math.max(0, breakEvenCopies - job.copiesSold);
```
Then render `breakEvenCopies === null ? '∞' : breakEvenCopies` and skip the progress bar when `null`.

**Classification:** WARNING (existing logic, reactivated by Phase 9 refactor — the "Loading…" gate previously delayed exposure of this state; the early-return-free body now exposes it on first paint).

---

## Info

### IN-01: `AssetListSkeleton` table-header skeletons mismatch the real table shape (6 columns of placeholder, real header has 7 columns including Actions)

**File:** `src/components/AssetLibrary.tsx:51-59` vs `:935-943, :1004-1013`
**Issue:** The skeleton table renders 6 `<th>` cells but the real Materials table renders 6 columns (Name/Brand/Type/Cost/Package/Actions) and the real Printers table renders 7 (Printer/Brand/Type/Price/Wattage/Nozzle/Actions). The skeleton picks the smaller shape — fine for materials, off-by-one for printers. Per D-03 the co-located skeletons are supposed to "stay in sync with the real list shapes when the layout changes." This is the first drift.

**Fix:** Add a 7th `<th>` in the skeleton header and a 7th `<td>` in each skeleton row to match the worst-case (printer view), since the user can switch tabs after data loads but the skeleton renders before the filter is meaningful.

### IN-02: `AssetListSkeleton` mobile cards render a non-functional `<div className="flex gap-2 pt-2">` of two equal-width buttons — the real card has the action buttons separated by a `border-t` divider

**File:** `src/components/AssetLibrary.tsx:40-43` vs `:905-920`
**Issue:** The skeleton renders the action-button row without the `border-t border-slate-700/50` that the real card uses (line 905). Visually the skeleton's button pair floats while the real version is sectioned. Minor, but the whole point of co-located skeletons is shape fidelity.

**Fix:** Add `border-t border-slate-700/50` to the skeleton button row and change spacing to `pt-2 border-t border-slate-700/50` to match.

### IN-03: `PrinterListSkeleton` progress-bar placeholder uses `h-1.5` parent + `h-full` skeleton child, but Skeleton's `line` variant baseline forces `h-4` into the DOM (see WR-01)

**File:** `src/components/PrinterSettings.tsx:28-30`
**Issue:** The skeleton wraps a Skeleton (variant="line", height="h-full") inside an `h-1.5` parent. The DOM ends up with `h-4 ... h-full` on the inner div — the `h-full` override happens to win, but only because CSS source-order does the right thing. After WR-01 is fixed this works correctly; until then it's coincidental.

**Fix:** Once WR-01 lands, this works automatically. If WR-01 is rejected, switch to `<div className="h-full w-1/3 bg-slate-700 animate-pulse rounded-full" role="status" aria-label="Loading" />` here to bypass the variant baseline.

### IN-04: `Skeleton` test file does not exercise the `aria-busy` attribute nor the consumer-supplied `...props` spread

**File:** `src/components/ui/Skeleton.test.ts:6-53`
**Issue:** Test coverage is good for class composition but omits two contract surfaces: (a) `aria-busy="true"` is part of the a11y contract per CONTEXT.md, but no test asserts it, so a future refactor that drops it will pass; (b) the `...props` spread (line 32 of Skeleton.tsx) is what lets consumers pass `id`, `data-testid`, `style`, etc. Without a test, that surface can regress silently.

**Fix:** Add:
```ts
it('Test 8 (UI-05 a11y): renders aria-busy="true"', () => {
  const html = renderToStaticMarkup(React.createElement(Skeleton));
  expect(html).toMatch(/aria-busy="true"/);
});

it('Test 9 (UI-05 props spread): forwards arbitrary attributes', () => {
  const html = renderToStaticMarkup(React.createElement(Skeleton, { 'data-testid': 'sk-1' }));
  expect(html).toContain('data-testid="sk-1"');
});
```

### IN-05: `materials` prop derived inline from `assets.filter(...)` in App.tsx creates a fresh array on every render

**File:** `src/App.tsx:57`
**Issue:** `const materials = assets.filter(a => a.category !== 'printer');` — re-runs on every App render, and passes a new array reference into `CostCalculator`, `JobsManager`, and `AssetLibrary` each time. JobsManager's `getFilamentName` uses `materials` via closure (line 206-209), and the `useCallback` for `getBreakEvenInfo` (line 127) doesn't depend on it, but any future memoization that does depend on `materials` will be invalidated every render. Not a Phase 9 regression — pre-existing — but Phase 9 doubled the render frequency by removing the global loading gate, which makes this hot. Worth a `useMemo` wrap.

**Fix:**
```ts
const materials = useMemo(() => assets.filter(a => a.category !== 'printer'), [assets]);
```

---

## Decision Compliance (Phase 9 locked decisions)

Quick audit against `09-CONTEXT.md`:

| Decision | Status | Note |
|---|---|---|
| D-01 (per-consumer loading) | PASS | `assetsLoading`/`jobsLoading`/`instancesLoading` drilled into each consumer (App.tsx:277, 292, 308) |
| D-02 (Skeleton primitive in ui/) | PASS | Located at `src/components/ui/Skeleton.tsx`, exported from `index.ts` |
| D-03 (composed skeletons co-located) | PASS | `AssetListSkeleton`, `JobsListSkeleton`, `PrinterListSkeleton` all live in consumer files |
| D-04 (`animate-pulse`, no custom CSS) | PASS | Baked into `Skeleton.tsx:31` |
| D-05 (no debounce / no min display) | PASS | Renders immediately on `isLoading` |
| D-08 (no NEW badge) | PASS | No `features.ts` entry for skeleton-loading (confirmed: no import/usage in any of the three consumer files) |
| D-10 (loading → skeleton → empty → content order) | PASS | All three consumers use the explicit ternary chain. AssetLibrary:466, JobsManager:226, PrinterSettings:226 |
| `shouldShowEmptyState` activated | PASS | Called in all three consumers (Phase 8 IN-01 resolved) |
| `role="status"` for a11y | PASS | Skeleton.tsx:28 |
| Test file uses `React.createElement` (no JSX) | PASS | Skeleton.test.ts:9, 17, 23, 30, 37, 44, 50 |
| App.tsx removes "Loading…" string + global gate | PASS | `grep -n Loading App.tsx` returns only the `isLoading` destructures and the `isLoading` prop passes — no "Loading…" string, no global gate |
| `btnSize`/`selectSize` naming | PASS | All Skeleton-adjacent Button/Select usages use the correct prop name |

No decision violations detected.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
