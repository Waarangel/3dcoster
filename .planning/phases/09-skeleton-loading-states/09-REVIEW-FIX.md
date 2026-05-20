---
phase: 09-skeleton-loading-states
fixed_at: 2026-05-20T00:35:00Z
review_path: .planning/phases/09-skeleton-loading-states/09-REVIEW.md
iteration: 2
findings_in_scope: 9
fixed: 8
skipped: 1
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-05-20T00:35:00Z (iteration 2; iteration 1 at 2026-05-19T20:24:00Z)
**Source review:** `.planning/phases/09-skeleton-loading-states/09-REVIEW.md`
**Iteration:** 2 (cumulative — covers iteration 1 warnings + iteration 2 info findings)

**Summary:**

- Findings in scope: 9 (0 critical, 4 warnings, 5 info — `fix_scope: all`)
- Fixed: 8 (4 warnings in iteration 1, 4 info in iteration 2)
- Skipped: 1 (IN-03 — auto-resolved by the WR-01 fix; no code change needed)
- Status: `all_fixed` — every in-scope finding is either committed or verified-as-resolved-by-another-fix.

Verification across both iterations: `tsc -b` clean, `npm test` 23/23 passing (was 20 pre-WR-01; +1 for Test 8 in WR-01; +2 for Tests 9 & 10 in IN-04), `lint:no-raw-html` clean, full `npm run build` succeeds.

## Fixed Issues

### WR-01: Skeleton variant baseline collides with consumer-supplied `rounded`/`height`/`width` overrides

**Files modified:** `src/components/ui/Skeleton.tsx`, `src/components/ui/Skeleton.test.ts`
**Commit:** `7cadf70` (iteration 1)
**Applied fix:** Split `variantStyles` (a single class string with baked-in `h-*`/`w-*`/`rounded*`) into `variantDefaults` with separate `{ h, w, rounded }` keys per variant, then made each consumer prop a true conditional fallback via `height ?? v.h`, `width ?? v.w`, `rounded ?? v.rounded`. The DOM now carries the variant default OR the override, never both. Added Test 8 (`variant="card"` + `width="w-12"` + `rounded="rounded-full"` → does NOT contain `w-full` or `rounded-xl`) to lock the contract. Pre-existing Tests 1–7 still pass.

### WR-02: AssetLibrary empty state uses raw `assets`, not the displayed slice

**Files modified:** `src/components/AssetLibrary.tsx`
**Commit:** `1c6f5d0` (iteration 1)
**Applied fix:** Changed the empty-state gate from `shouldShowEmptyState(assets, isLoading)` to `shouldShowEmptyState(displayAssets, isLoading)` so a printer-only library on the "All" tab now shows the empty-state hero rather than populated chrome with an empty table. Renamed `startAddingFilament` → `startAddingForEmptyState`, which seeds the Add form's category from `filterCategory` (`'filament'` when `filterCategory === 'all'`, otherwise the active filter). The empty-state copy + CTA branch on `filterCategory`: a printer tab gets "No printers in your library yet" + "Add Printer", the "All" tab keeps the existing "No materials" + "Add Material" copy, and other category tabs get a generic per-category empty hero. Search-empty cases continue to use the inner `"No X found"` text path because `shouldShowEmptyState` is checked before search filtering.

**Note:** Render-logic change — verification status is `fixed: requires human verification`. Tests pass and TypeScript is clean, but the empty-state branching should be eyeballed at UAT to confirm the per-tab copy reads naturally.

### WR-03: JobsManager dead helper `_getPrinterName` kept alive by `void` — anti-pattern

**Files modified:** `src/components/JobsManager.tsx`, `src/App.tsx`
**Commit:** `5b267ee` (iteration 1)
**Applied fix:** Deleted `_getPrinterName` and the `void _getPrinterName` silencer. This made the destructured `printers` and `printerInstances` props unused (tsc flagged with TS6133), which is exactly the rule that `.claude/CLAUDE.md` says we should not silence — so I also removed those props from the `JobsManagerProps` interface, the destructure, the `PrinterConfig` / `PrinterInstance` type imports in `JobsManager.tsx`, and the `<JobsManager>` call site in `App.tsx`. If the jobs list ever needs printer-name resolution in the future, re-introduce both the helper and the props together.

### WR-04: `getBreakEvenInfo` can return `breakEvenCopies = Infinity` which leaks to the UI

**Files modified:** `src/components/JobsManager.tsx`
**Commit:** `15c3f2c` (iteration 1)
**Applied fix:** Normalized `getBreakEvenInfo` to return `breakEvenCopies: number | null` (and matching `remainingToBreakEven: number | null`), where `null` represents "unreachable at current sell price" (i.e., `effectiveProfitPerUnit <= 0 && job.modelCost > 0`, which previously produced `Infinity`). Updated both render consumers:

- The break-even badge now renders "Break-even not reachable at current price" when `remainingToBreakEven === null`, instead of "Infinity more to break even".
- The progress-bar block renders an informational line ("Break-even progress unavailable — sell price does not exceed cost per unit.") when `breakEvenCopies === null` and skips the bar entirely. As a defensive bonus, the bar width also explicitly handles `breakEvenCopies === 0` (`'100%'`) to avoid the latent `NaN%` div-by-zero arithmetic the reviewer flagged.

**Note:** Logic-bearing change with new render branches — verification status is `fixed: requires human verification`. Build + tests are green, but UAT should confirm: (a) a job with sell price ≤ cost per unit shows the new "not reachable" copy, (b) the progress bar disappears in that case, (c) normal jobs with positive break-even still render the bar correctly.

### IN-01: `AssetListSkeleton` table column count mismatch — 6 placeholder columns vs 7 in printer table

**Files modified:** `src/components/AssetLibrary.tsx`
**Commit:** `2ce3c6c` (iteration 2)
**Applied fix:** Added a 7th `<th>` placeholder in the skeleton table header and a 7th `<td>` placeholder in each skeleton row. The skeleton now matches the worst-case (printer) column count of 7 (Printer / Brand / Type / Price / Wattage / Nozzle / Actions). The materials table has 6 columns; rendering 7 here means the skeleton shows one extra placeholder column on the materials tab for a frame or two, but the printer tab — which previously dropped the Actions column placeholder entirely — now matches the real shape. Per D-03 (co-located skeletons must stay in sync with real list shapes), this is the correct tradeoff because the skeleton renders before the filter is meaningful.

### IN-02: `AssetListSkeleton` mobile cards missing `border-t` divider between content and action buttons

**Files modified:** `src/components/AssetLibrary.tsx`
**Commit:** `153c6ab` (iteration 2)
**Applied fix:** Added `border-t border-slate-700/50` to the skeleton's mobile-card action-button row so the divider matches the real card (which uses the same classes). Previously the skeleton's two button placeholders floated below the previous block; the real card has a clear sectioned divider. Small but visible shape fidelity gain per D-03.

### IN-03: `PrinterListSkeleton` progress-bar placeholder height collision

**Files modified:** _none — auto-resolved by WR-01_
**Commit:** _none — no code change required_
**Applied fix:** Verified at fix time that the WR-01 fix (variant defaults are now conditional fallbacks via `height ?? v.h`) auto-resolves this finding. Rendered the exact consumer call from `PrinterSettings.tsx:29` (`<Skeleton variant="line" height="h-full" width="w-1/3" rounded="rounded-full" />`) through a replica of the post-WR-01 `Skeleton` component; the output is `class="bg-slate-700 animate-pulse h-full w-1/3 rounded-full"` — single height class, no `h-4` baseline leak. The `h-1.5` parent + `h-full` child now composes correctly with no class duplication. **Status:** `skipped: auto-resolved by WR-01 fix (verified via render test).`

### IN-04: `Skeleton.test.ts` missing tests for `aria-busy` and props spread

**Files modified:** `src/components/ui/Skeleton.test.ts`
**Commit:** `6d18b2d` (iteration 2)
**Applied fix:** Added Test 9 (asserts `aria-busy="true"` on the default render — locks the a11y contract documented in CONTEXT.md) and Test 10 (asserts the `...props` spread forwards `id` and `data-testid` to the root div — locks the typed prop-spread contract). Used a `React.HTMLAttributes<HTMLDivElement>` cast on the test props object so TS strict mode is happy with the `data-testid` key. Test count is now 23 (was 21 after iteration 1).

### IN-05: `materials` derived inline in App.tsx creates fresh array reference every render

**Files modified:** `src/App.tsx`
**Commit:** `cb7305d` (iteration 2)
**Applied fix:** Wrapped the `materials` derivation in `useMemo(() => assets.filter(a => a.category !== 'printer'), [assets])` and added `useMemo` to the `react` import. The array reference is now stable across renders unless `assets` itself changes, so downstream memoization in `CostCalculator`, `JobsManager`, and `AssetLibrary` that takes `materials` in a deps array will no longer invalidate on every App render. This is doubly relevant after Phase 9 removed the global loading gate, which made App render more frequently.

## Skipped Issues

### IN-03: `PrinterListSkeleton` progress-bar placeholder height collision

**File:** `src/components/PrinterSettings.tsx:28-30`
**Reason:** Auto-resolved by the WR-01 fix (verified at fix time via a render test of the exact consumer call). Post-WR-01, `<Skeleton variant="line" height="h-full" ... />` emits the override class once (no `h-4` baseline leak), so the `h-1.5` parent + `h-full` child composition is correct. No code change required in `PrinterSettings.tsx`; the original finding hinged on the WR-01 collision pattern which no longer exists. See the entry under "Fixed Issues" above for the verification detail.
**Original issue:** "PrinterListSkeleton progress-bar placeholder uses h-1.5 parent + h-full skeleton child, but Skeleton's `line` variant baseline forces h-4 into the DOM (see WR-01). The DOM ends up with `h-4 ... h-full` on the inner div — the h-full override happens to win, but only because CSS source-order does the right thing."

---

_Fixed (iteration 2): 2026-05-20T00:35:00Z_
_Fixed (iteration 1): 2026-05-19T20:24:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Cumulative iteration: 2_
