---
phase: 07-styling-primitives-pass
plan: 02
subsystem: ui
tags: [react, tailwind, primitives, refactor, form-submit]

# Dependency graph
requires:
  - phase: 07-styling-primitives-pass
    plan: 03
    provides: lint-no-raw-html guard + Button/Input/Select primitive recipes
provides:
  - AssetLibrary refactored onto Button/Input/Select primitives (40 raw elements addressed)
  - JobsManager refactored onto Button/Input/Select primitives (13 raw elements addressed; zero opt-outs)
  - <form onSubmit> semantics preserved end-to-end (only the explicit submit button submits; Cancel + custom-category Cancel + tag Add + tag remove + custom-category +New all explicitly type="button")
  - browser-native required validation preserved on Name + Unit + numeric required inputs (8 occurrences)
  - parseInt/parseFloat coercion preserved on JobsManager number inputs
affects: [07-01 (heavy forms — sibling plan in wave 1), all future phases adding new UI surface to AssetLibrary/JobsManager]

# Tech tracking
tech-stack:
  added: []  # No new packages
  patterns:
    - "Inside a <form>, every <Button> child carries explicit type= (Button primitive passes type= through {...props} without defaulting — Pitfall 1 / L-1 / L-6)"
    - "Filter tabs with conditional active/inactive className stay raw with /* allow-raw-html */ JSX comment immediately above (matches the SettingsModal tab pattern from plan 07-03)"
    - "Compact compound buttons (8x8 pagination squares, badge-internal × close) use Button primitive with Tailwind v4 important prefix !w-8 !min-w-0 !min-h-0 !px-0 to override primitive sm-size padding/min-height"
    - "Solid-red final-action confirmations (JobsManager Delete confirm) use Button with bg-red-600 hover:bg-red-700 className override rather than the translucent danger variant — preserves the strong visual emphasis of an irreversible action"

key-files:
  created: []
  modified:
    - src/components/AssetLibrary.tsx
    - src/components/JobsManager.tsx

key-decisions:
  - "Filter tab buttons (All + per-category .map) kept raw with allow-raw-html — same conditional-class rationale as SettingsModal tabs (plan 07-03). 2 opt-outs in AssetLibrary."
  - "Tag remove × inside the tag pill uses Button ghost btnSize=sm with !p-0 !min-h-0 — keeps the lint guard happy without inflating the inline tag badge layout."
  - "Pagination page-number squares (8x8) use !w-8 !min-w-0 !min-h-0 !px-0 h-8 overrides on Button — primitive sm-size min-h-[36px] would break the square grid otherwise."
  - "JobsManager Delete-confirm uses solid bg-red-600 className override (not variant=danger) — final-action emphasis trade-off; variant=danger is too soft for an irreversible job delete."
  - "Cancel-buttons inside AssetLibrary's <form> retained their explicit type=\"button\" attribute on the Button primitive (5 type=\"button\" total: submit-form Cancel, custom-category Cancel, custom-category +New, tag Add, tag remove ×). Submit button retained explicit type=\"submit\". Without these, the Button primitive's pass-through {...props} would inherit the browser default of type=\"submit\" inside a form — clicking any non-submit button would submit the form (Pitfall 1)."

patterns-established:
  - "Form-internal Button discipline: when refactoring a file containing <form>, audit every <Button> child of the form for an explicit type= and add type=\"button\" if missing (default-submit-inside-form is the trap)."
  - "Preserve required attribute on Input via {...props} passthrough — verified by grep count >= 1 in AssetLibrary post-refactor."

requirements-completed: [UI-01, UI-02]

# Metrics
duration: 6min
completed: 2026-05-19
---

# Phase 07 Plan 02: Medium Forms (AssetLibrary + JobsManager) Summary

**AssetLibrary and JobsManager refactored onto shared Button/Input/Select primitives — 53 raw form elements replaced or opted out, the codebase's only `<form onSubmit>` keeps strict submit-vs-button discipline, required validation and parseInt/parseFloat coercion intact.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-19T14:28:25Z
- **Completed:** 2026-05-19T14:34:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Refactored `src/components/AssetLibrary.tsx` (40 raw elements → primitives + 2 filter-tab opt-outs)
- Refactored `src/components/JobsManager.tsx` (13 raw elements → primitives, zero opt-outs)
- AssetLibrary's `<form onSubmit={handleSubmit}>` semantics fully preserved: 1 `type="submit"` Button (final Add/Update), 5 `type="button"` Buttons (Cancel, custom-category Cancel, custom-category +New, tag Add, tag remove ×). No accidental form submissions.
- `required` validation preserved on AssetLibrary inputs (8 grep hits — covers Name, Unit, Purchase Price, Wattage, Package Cost, Units per Package + comments referencing it).
- JobsManager number-input coercion (parseInt, parseFloat) preserved verbatim — sale quantity, unit price, shipping cost, marketplace fee logic unaffected.
- Lint guard reports 0 violations for both files; TypeScript build and Vite build green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor AssetLibrary.tsx (40 raw elements + filter-tab opt-outs; form-submit semantics preserved)** — `466aef6` (refactor)
2. **Task 2: Refactor JobsManager.tsx (13 raw elements → primitives, zero opt-outs)** — `951b679` (refactor)

## Files Created/Modified

### Modified
- `src/components/AssetLibrary.tsx` — Added `import { Button, Input, Select } from './ui';`. Replaced:
  - 3 top-right action buttons (Import CSV / Reset / + Add) → Button secondary/secondary/primary btnSize=sm with `relative flex-1 sm:flex-none gap-1.5` className for the Import CSV button (preserves NewBadge absolute overlay).
  - 2 filter tab buttons (All + per-category .map) kept raw with `/* allow-raw-html */` JSX comment on the line above (conditional active/inactive className).
  - Search input → Input with `pl-9 pr-8 placeholder-slate-500` className (preserves search-icon left-padding and clear-button right-padding).
  - Search clear (×) button → Button variant=ghost btnSize=sm with absolute positioning className.
  - 5 form section inputs (Name, Custom Category, Brand, Notes, Tags-add) + 5 printer-specific inputs (Purchase Price, Wattage, Lifespan, Nozzle Cost, Nozzle Lifespan) + 4 material-specific inputs (Unit, Package Cost, Units per Package, Lifespan) → Input primitive (15 total). `required` preserved on 6 inputs (Name + Unit + Purchase Price + Wattage + Package Cost + Units per Package).
  - Category Select (with `flex-1` retained) + custom-category Cancel/+New buttons (`type="button"`).
  - Tag Add button (`type="button"`, secondary) + Tag remove × button (`type="button"`, ghost sm with `!p-0 !min-h-0` for badge-internal compact).
  - Submit button (`type="submit"`, primary md default) + Cancel button (`type="button"`, secondary md) — the form's terminal pair.
  - Mobile Sort Select (selectSize=sm) + sort-direction toggle Button (secondary sm).
  - Mobile card Edit/Delete buttons (Button secondary with text-blue-400 / text-red-400 className overrides, `flex-1`).
  - Desktop printer + materials table Edit/Delete buttons (Button ghost sm with text-blue-400 / text-red-400 hover overrides).
  - Items-per-page Select (selectSize=sm).
  - Pagination Prev/Next buttons (Button secondary sm) + page-number buttons (Button primary/secondary sm with `!w-8 !min-w-0 !min-h-0 !px-0 h-8` for compact 8x8 squares).
- `src/components/JobsManager.tsx` — Added `import { Button, Input, Select } from './ui';`. Replaced:
  - 3 job-row action buttons: Record Sale → Button success sm; Edit → Button primary (default) sm; Delete → Button danger sm. e.stopPropagation() preserved on all three.
  - Sale form inputs (Quantity number `min="1"`, Price `step="0.01"`, Customer Name text, Shipping Cost `step="0.01"`) → Input primitive with parseInt/parseFloat coercion preserved.
  - Shipping Method Select (preserves the `setSaleShippingCost(getDefaultShippingCost(method))` side-effect in onChange).
  - Marketplace Select.
  - Sale-form footer: Record Sale → Button success md with `flex-1`; Cancel → Button secondary md.
  - Delete-confirmation: Cancel → Button secondary; Delete → Button with `bg-red-600 hover:bg-red-700` className override (solid red, final-action emphasis).

## Decisions Made

1. **Filter tabs stay raw** — AssetLibrary has 2 filter tab call-sites (`onClick={() => handleFilterChange('all')}` for the "All" tab + the dynamic `allCategories.map(cat => ...)` loop). Both use conditional className that switches between `bg-slate-600 text-white` (active) and `bg-slate-700 text-slate-400 hover:text-white` (inactive). No single Button variant covers both states. Marked each with `/* allow-raw-html */` on the line above. Total opt-outs = 2 (matches the count of `handleFilterChange` call-sites).

2. **Tag remove × uses Button with `!p-0 !min-h-0`** — The remove button lives inside an inline `<span>` tag pill with `px-2 py-0.5 text-xs`. Button's sm-size adds `min-h-[36px]` and `px-3 py-1.5` which would visually inflate the pill. Tailwind v4 important prefix `!p-0 !min-h-0` overrides both. Tradeoff: 16 chars of className complexity in exchange for keeping a single consistent Button primitive across the file.

3. **Pagination page-number squares use `!w-8 !min-w-0 !min-h-0 !px-0 h-8` overrides** — Original page squares were 32x32px (`w-8 h-8`). Button primitive's sm-size has `min-h-[36px]` which would make them rectangles. Tailwind v4 important prefix is again the path of least disruption. The variant logic (primary for current page, secondary for others) is captured via a ternary on `variant=` prop, not in className.

4. **JobsManager Delete-confirm uses solid `bg-red-600` className override (not `variant="danger"`)** — The danger variant (`bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30`) is the translucent in-row "Delete" button used on the job list. The Delete-confirmation modal is a final-action irreversible step that warrants stronger visual emphasis. Used `<Button onClick={confirmDeleteJob} className="bg-red-600 hover:bg-red-700">` to preserve the solid red look while still going through the Button primitive (lint guard happy, focus rings + min-touch-target + base typography all inherited).

5. **Disabled state on pagination Prev/Next** — Original had explicit `disabled:bg-slate-800 disabled:text-slate-600` className. Per RESEARCH § "Disabled state — never repeat it", Button already includes `disabledButtonStyles = 'disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-600'`. Dropped the explicit override — accept primitive defaults per D-06.

## Deviations from Plan

**None — plan executed as written.** The CRITICAL form-submit discipline was the single highest-risk transformation in this plan; verified via 5 `type="button"` count + 1 `type="submit"` + 1 `<form>` (the only one in the codebase). All onClick/onChange/value/disabled/required/aria-* attributes preserved verbatim per D-08.

## Issues Encountered

- **Shared pre-commit hook race with parallel plan 07-01** — Both my plan (07-02) and the sibling plan (07-01) execute in worktrees that share the main repo's `.git/hooks/` directory. Plan 07-03's hook is active and rejects any commit while the cross-plan tree still has raw form elements (07-01's SettingsModal + CostCalculator + PrinterSettings haven't been refactored yet from my worktree's view). Solution per the plan's parallel_execution instructions: `chmod -x .git/hooks/pre-commit` immediately before each per-task commit and `chmod +x` immediately after. This worked for both Task 1 and Task 2, but there is a race window: between my `chmod -x` and `git commit`, the 07-01 executor can `chmod +x` (as it does for its own SUMMARY commit etc.). On the first commit attempt the hook did fire and reject the commit; retrying immediately succeeded because my chmod -x landed before the next `git commit` call. Documented for transparency. No data loss; both task commits are present in the worktree branch.

- **No <form> in JobsManager** — Confirmed by grep: zero `<form` tags. JobsManager handles its "submit" via `onClick={handleRecordSale}` etc., not a native form submission. This was anticipated by the plan and required no special handling.

## User Setup Required

None.

## Next Phase Readiness

- **07-01 (sibling Wave 1 plan)** can land at any time; my changes don't touch its files (SettingsModal, CostCalculator, PrinterSettings). No conflict expected.
- **All 14 in-scope phase 7 files** will be clean once 07-01 lands. At that point the pre-commit hook will stop rejecting commits.
- **No blockers** for downstream phases (8 empty-states, 9 skeletons, 10 dark mode, 11 unit tests, 12 perf optimization).

## Self-Check: PASSED

- Commits exist:
  - `466aef6` (refactor: AssetLibrary onto primitives): FOUND
  - `951b679` (refactor: JobsManager onto primitives): FOUND
- Files modified exist (relative paths):
  - `src/components/AssetLibrary.tsx`: FOUND
  - `src/components/JobsManager.tsx`: FOUND
- Lint state for in-scope files:
  - `node scripts/lint-no-raw-html.mjs` reports 0 violations against `src/components/AssetLibrary.tsx`
  - `node scripts/lint-no-raw-html.mjs` reports 0 violations against `src/components/JobsManager.tsx`
- Acceptance criteria met:
  - `grep -c '<form' src/components/AssetLibrary.tsx` = 1 (form preserved)
  - `grep -c 'type="submit"' src/components/AssetLibrary.tsx` = 1 (satisfies >= 1)
  - `grep -c 'type="button"' src/components/AssetLibrary.tsx` = 5 (satisfies >= 2)
  - `grep -c 'required' src/components/AssetLibrary.tsx` = 8 (satisfies >= 1)
  - `grep -c 'allow-raw-html' src/components/AssetLibrary.tsx` = 2 (matches handleFilterChange call count)
  - `grep -cE '<(button|input|select|textarea)[ />]' src/components/JobsManager.tsx` = 0
  - `grep -c 'allow-raw-html' src/components/JobsManager.tsx` = 0
  - `npx tsc -b` exits 0
  - `npx vite build` exits 0
- Handlers preserved by grep against AssetLibrary: handleSubmit, cancelEdit, setShowCustomCategory, setCustomCategoryInput, setSortField, setCurrentPage, handleFilterChange — all 34 hits found.
- Handlers preserved by grep against JobsManager: handleRecordSale, handleEditJob, handleDeleteJob, confirmDeleteJob, setShowSaleForm, setSaleShippingMethod, setSaleShippingCost, setSaleMarketplace — 23 hits found.

---
*Phase: 07-styling-primitives-pass*
*Completed: 2026-05-19*
