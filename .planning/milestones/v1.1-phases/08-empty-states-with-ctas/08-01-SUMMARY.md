---
phase: 08-empty-states-with-ctas
plan: 01
subsystem: ui-primitives
tags:
  - ui
  - primitive
  - empty-state
  - foundation
requirements:
  - UI-04
dependency_graph:
  requires:
    - "src/components/ui/Button.tsx (Phase 7 primitive — consumed by EmptyState CTA)"
  provides:
    - "EmptyState primitive (composite icon + heading + body + optional CTA)"
    - "shouldShowEmptyState<T>(items, isLoading): boolean predicate"
    - "PackageIcon, ClipboardListIcon, PrinterIcon (inline SVG components)"
    - "src/components/ui/icons/ barrel namespace"
    - "empty-states feature key in src/features.ts (for Plan 02 NewBadge)"
  affects:
    - "src/components/ui/index.ts (one-line append)"
    - "src/features.ts (one-line registry append)"
tech-stack:
  added: []   # zero new dependencies; pure composition over existing React/Tailwind/vitest
  patterns:
    - "Phase 7 primitive shape (Card.tsx analog — type-only imports, interface ComponentProps, className composition)"
    - "Sub-barrel namespace for icons (NOT re-exported through top-level ui/index.ts per PD-04)"
    - "renderToStaticMarkup() from react-dom/server for component output tests (avoids @testing-library/react install)"
    - "React.createElement() in .test.ts files (avoids JSX-in-.ts parse error; matches vitest include glob)"
key-files:
  created:
    - "src/components/ui/EmptyState.tsx (36 lines) — EmptyState component + shouldShowEmptyState predicate"
    - "src/components/ui/EmptyState.test.ts (73 lines) — 7 vitest assertions (4 predicate branches + 3 render contract)"
    - "src/components/ui/icons/PackageIcon.tsx (21 lines)"
    - "src/components/ui/icons/ClipboardListIcon.tsx (23 lines)"
    - "src/components/ui/icons/PrinterIcon.tsx (20 lines)"
    - "src/components/ui/icons/index.ts (3 lines) — sub-barrel"
  modified:
    - "src/components/ui/index.ts (+1 line) — EmptyState named export added after Card"
    - "src/features.ts (+1 line) — 'empty-states' entry added before trailing comment"
decisions:
  - "PD-01 honored: AssetLibrary CTA will reuse startAdding without overriding category (Plan 02 scope)"
  - "PD-02 honored: 24x24 viewBox + strokeWidth=1.5 (NOT UI-SPEC's 48x48) — crisper effective stroke at consumer w-12 h-12 against dark slate"
  - "PD-03 honored: EmptyState uses `export function` (no forwardRef) — composite component unlikely to need a ref"
  - "PD-04 honored: icons barrel is its own namespace; NOT re-exported through src/components/ui/index.ts"
  - "PD-05 honored: test file extension is .test.ts (matches vitest include glob); React.createElement style used throughout — no JSX literal"
  - "PD-06 honored: shouldShowEmptyState co-located in EmptyState.tsx (single file for executor + consumers)"
metrics:
  duration: "~10 minutes (wall-clock, within worktree)"
  completed: "2026-05-19"
  tasks_completed: 3
  files_created: 6
  files_modified: 2
  total_lines_added: 178
  tests_added: 7
  tests_total_passing: 13
---

# Phase 8 Plan 01: EmptyState Primitive Foundation Summary

**One-liner:** EmptyState primitive (composite icon + heading + body + optional CTA) ships with a co-located `shouldShowEmptyState` predicate, three Lucide-style outline icons (Package/ClipboardList/Printer), barrel updates, and seven passing vitest assertions — the reviewable foundation Plan 02 will wire into AssetLibrary/JobsManager/PrinterSettings.

---

## What Shipped

### EmptyState primitive (`src/components/ui/EmptyState.tsx`)

- `interface EmptyStateProps` with the locked UI-SPEC shape: `icon: ReactNode`, `title: string`, `description: string | ReactNode`, `cta?: { label; onClick }`, `className?: string`.
- `export function EmptyState(...)` renders the locked UI-SPEC contract: root `text-center py-12` block, icon wrapper (`flex justify-center mb-4 text-slate-500`), `<h3>` heading (`text-lg font-semibold text-white mb-2`), `<p>` paragraph (`text-sm text-slate-500 leading-relaxed max-w-md mx-auto`), optional CTA block using the Phase 7 `<Button variant="primary" btnSize="md">` primitive.
- `description: string | ReactNode` permits JSX with mid-paragraph `<br/>` so JobsManager's locked verbatim copy (`JobsManager.tsx:200-202`) can be preserved when Plan 02 wires it in.
- `shouldShowEmptyState<T>(items, isLoading): boolean` co-located per PD-06 — pure predicate, `!isLoading && items.length === 0`.
- No `forwardRef` per PD-03 (composite component, unlikely to need a ref).
- No raw `<button>` introduced — CTA uses Phase 7 Button primitive (D-11 + lint guard compliant).

### Three Lucide-style outline icons (`src/components/ui/icons/`)

- `PackageIcon.tsx` — AssetLibrary consumer (Plan 02).
- `ClipboardListIcon.tsx` — JobsManager consumer (Plan 02).
- `PrinterIcon.tsx` — PrinterSettings consumer (Plan 02).
- All three share the canonical pattern: `import type { SVGProps } from 'react'`; `export function {Name}Icon(props: SVGProps<SVGSVGElement>)`; `<svg>` with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.5}`, `strokeLinecap="round"`, `strokeLinejoin="round"`, then `{...props}` last so consumers can override `className`/`aria-label` while preserving locked defaults if unspecified.
- Path data hand-derived from Lucide MIT-licensed `package`, `clipboard-list`, and `printer` icons (no Lucide dependency installed — D-02 honored).
- 24×24 viewBox + strokeWidth 1.5 per PD-02 (overrides UI-SPEC's stated 48×48 — effective stroke ~3px at consumer `w-12 h-12` is crisper against dark slate than the 1.5px the 48 viewBox would produce). UAT can flip this if visual review rejects; one-line change per icon.

### Barrel + registry updates

- `src/components/ui/index.ts`: appended `export { EmptyState } from './EmptyState';` after the existing `Card` export. `EmptyStateProps` deliberately not re-exported (PD-04 — barrel symmetry with Button/Card which also don't re-export their Props types).
- `src/components/ui/icons/index.ts` (NEW): three-line sub-barrel re-exporting the three icons. NOT re-exported through the top-level `src/components/ui/index.ts` — keeps the primitives surface focused (PD-04). Consumers will import via `from './ui/icons'`.
- `src/features.ts`: added `'empty-states': new Date('2026-05-19')` between the pre-existing `'default-profit-margin'` line and the trailing `// Add new features here…` comment. Plan 02 will render the `<NewBadge feature="empty-states" />` overlay on the relevant tab heading.

### Tests (`src/components/ui/EmptyState.test.ts`)

Seven vitest assertions in one `describe('EmptyState', () => { … })` block, matching the existing `threeMfParser.test.ts` style (leading line comments tag each `it` with `UI-04`):

| # | Test ID | Behavior |
|---|---------|----------|
| 1 | UI-04 trigger | `shouldShowEmptyState([], true)` → `false` (loading suppresses empty state) |
| 2 | UI-04 trigger | `shouldShowEmptyState([], false)` → `true` (not loading + empty → show) |
| 3 | UI-04 trigger | `shouldShowEmptyState([1], false)` → `false` (non-empty list suppresses) |
| 4 | UI-04 trigger | `shouldShowEmptyState([1, 2, 3], true)` → `false` (loading + non-empty also suppresses) |
| 5 | UI-04 render with cta | `renderToStaticMarkup` of EmptyState with `cta` prop → output contains title, description, and `<button` |
| 6 | UI-04 render without cta | `renderToStaticMarkup` of EmptyState without `cta` → output contains title/description but NO `<button` |
| 7 | UI-04 render description as ReactNode | `description={<>A<br/>B</>}` → output contains `<br` (proves the prop accepts ReactNode for JobsManager's `<br/>` preservation downstream) |

All seven pass. Pre-existing `threeMfParser` 6-test suite continues to pass — no regression. Total vitest output: `Test Files 2 passed (2)`, `Tests 13 passed (13)`.

---

## TDD Gate Compliance

| Gate | Commit | Verification |
|------|--------|--------------|
| RED | `0a86e70` — `test(08-01): add failing test for EmptyState primitive + shouldShowEmptyState` | Vitest run shows `Failed to resolve import "./EmptyState"` — test file references symbols not yet exported. |
| GREEN | `66054b0` — `feat(08-01): implement EmptyState primitive + shouldShowEmptyState predicate` | All 7 EmptyState tests pass; tsc -b clean; lint guard exits 0. |
| REFACTOR | n/a — no refactor needed (RED→GREEN was direct; no smell to clean up). |

---

## Verification Output

### `npm test`
```
Test Files  2 passed (2)
Tests       13 passed (13)
Duration    ~800ms
```
The EmptyState describe block contributes 7 tests; the pre-existing `parseThreeMf` suite contributes 6.

### `npx tsc -b`
Exit code 0. No output (strict TypeScript clean across all new files including the SVGProps-typed icon components and the generic `shouldShowEmptyState<T>` predicate).

### `npm run lint:no-raw-html`
```
lint:no-raw-html passed
```
Pre-commit hook also runs this on every task commit — all four task commits passed it. New files under `src/components/ui/` and `src/components/ui/icons/` are correctly excluded via the guard's `startsWith('src/components/ui')` rule (Pitfall 1 verified — no guard change needed).

### `npm run build`
Full pipeline: lint guard → `tsc -b` → `vite build` → PWA generateSW. All steps green. Build artifacts unchanged in shape (only the new ~178 added source lines contributed; main bundle 635.72 kB → no material size change).

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `0a86e70` | test(08-01) | RED — add failing test for EmptyState primitive + shouldShowEmptyState |
| `66054b0` | feat(08-01) | GREEN — implement EmptyState primitive + shouldShowEmptyState predicate |
| `360db2e` | feat(08-01) | add three Lucide-style outline icons + icons barrel |
| `5d1d1d3` | chore(08-01) | export EmptyState from ./ui barrel + register empty-states feature |

Four commits, one per logical unit. Each commit passed `tsc -b` and `lint:no-raw-html` via pre-commit hook.

---

## Deviations from Plan

**None — plan executed exactly as written.** All six PD-XX decisions were honored as planned; no auto-fixes (Rules 1–3) needed; no architectural questions (Rule 4) surfaced; no checkpoints triggered.

The only structural choice the planner left to executor discretion within the locked decisions — TDD gate cadence — was applied as the canonical RED → GREEN cycle in Task 1 (test file committed before implementation; both verified separately via `npm test` between commits).

---

## Open Questions for Plan 02

None blocking. Restating the planner-flagged items the user should be aware of when Plan 02 starts:

1. **NewBadge tab placement (RESEARCH Open Question 1, planner Assumption A3):** Plan 02 must decide whether `<NewBadge feature="empty-states" className="absolute -top-1 -right-1" />` overlays one tab (e.g., Settings) or all three affected tabs (Materials/Jobs/Settings). RESEARCH recommends Option A (all three — shared `feature` key means the first-seen window clears all three at once).
2. **PD-01 / AssetLibrary CTA mismatch (RESEARCH Open Question 2):** The CTA copy says "Add Material" but `startAdding` defaults `formData.category` to `'consumable'` when `filterCategory === 'all'`. Plan 02 ships PD-01 as-stated (reuse `startAdding` directly; user switches category in the form dropdown). Surface for confirmation if visual review rejects the small mismatch.
3. **PD-02 viewBox/strokeWidth visual check:** Plan 02's UAT pass should confirm the 24×24 viewBox + strokeWidth 1.5 renders crisply at `w-12 h-12`. If too thin against dark slate, swap each icon's `viewBox="0 0 24 24"` → `viewBox="0 0 48 48"` and `strokeWidth={1.5}` → `strokeWidth={2.5}` (one-line edit per icon).

---

## Known Stubs

None. Every shipped file is wired to its consumer in Plan 02; nothing renders empty/placeholder UI that would mislead a verifier.

---

## Self-Check: PASSED

- [x] `src/components/ui/EmptyState.tsx` exists (36 lines)
- [x] `src/components/ui/EmptyState.test.ts` exists (73 lines)
- [x] `src/components/ui/icons/PackageIcon.tsx` exists (21 lines)
- [x] `src/components/ui/icons/ClipboardListIcon.tsx` exists (23 lines)
- [x] `src/components/ui/icons/PrinterIcon.tsx` exists (20 lines)
- [x] `src/components/ui/icons/index.ts` exists (3 lines)
- [x] `src/components/ui/index.ts` updated (EmptyState added; pre-existing exports preserved)
- [x] `src/features.ts` updated (empty-states added; pre-existing entries preserved)
- [x] Commit `0a86e70` found in `git log` (RED)
- [x] Commit `66054b0` found in `git log` (GREEN)
- [x] Commit `360db2e` found in `git log` (icons)
- [x] Commit `5d1d1d3` found in `git log` (barrel + features)
- [x] `npm test` exits 0 with 13 tests passing (6 pre-existing + 7 new)
- [x] `npx tsc -b` exits 0
- [x] `npm run lint:no-raw-html` exits 0
- [x] `npm run build` completes the full pipeline (lint + tsc + vite + PWA)
