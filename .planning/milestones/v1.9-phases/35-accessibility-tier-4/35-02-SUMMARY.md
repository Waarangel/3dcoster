---
phase: 35-accessibility-tier-4
plan: "02"
subsystem: AssetLibrary
tags: [a11y, aria, wcag, form-errors, role-alert, aria-invalid, aria-describedby, category-filter, sort-indicator]
dependency_graph:
  requires: []
  provides: [AssetLibrary-form-error-association, AssetLibrary-a11y-cleanups]
  affects: [AssetLibrary.tsx]
tech_stack:
  added: []
  patterns: [role-alert-conditional-render, aria-invalid-describedby-pair, useId-form-error, role-group-filter]
key_files:
  created:
    - src/components/AssetLibrary.test.tsx
  modified:
    - src/components/AssetLibrary.tsx
decisions:
  - "Conditionally render [role=alert] (not always-present empty alert) — triggers AT announcement on DOM insertion per RESEARCH Pitfall 1"
  - "Pair aria-invalid + aria-describedby on ALL required inputs that participate in setFormError validation (name, unit, packageCost), not just name"
  - "SortIndicator aria-hidden applied at the span level since column headers already use aria-sort as the authoritative AT mechanism"
  - "Category filter group uses div[role=group] not fieldset/legend — appropriate for toggle-button groups without form submission semantics"
metrics:
  duration: "7m 27s"
  completed: "2026-06-26"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 35 Plan 02: AssetLibrary A11Y — Form Errors + Category Group + SortIndicator Summary

AssetLibrary form validation errors are now programmatically associated with failing inputs via `role="alert"` + `useId`-generated `id` + `aria-invalid="true"` + `aria-describedby`; category filter buttons are wrapped in a labelled `role="group"`; SortIndicator glyph is `aria-hidden`.

## What Was Built

### Task 1: Associate asset-form validation errors with failing inputs (A11Y-11 WCAG Critical)

**Files:** `src/components/AssetLibrary.tsx`, `src/components/AssetLibrary.test.tsx`

- Added `const formErrorId = useId()` alongside the existing `useId()` calls at lines 499–514.
- The `formError` container (previously a bare `<div>`) now carries `id={formErrorId}` and `role="alert"`. Kept conditionally rendered — AT announces on insertion.
- The required Name `<Input>` now receives `aria-invalid={formError ? 'true' : undefined}` and `aria-describedby={formError ? formErrorId : undefined}`.
- The material-specific required inputs (unit, packageCost) receive the same two attributes — both fields participate in the material validation branch that calls `setFormError`.
- When no error is present all three attributes resolve to `undefined` (no attribute in the DOM).
- `Input` spreads `...props` to the underlying `<input>` — confirmed, no forwarding adapter needed.

### Task 2: Asset-row icon labels + category filter group + SortIndicator aria-hidden (A11Y-12 Asset rows, A11Y-15)

**Files:** `src/components/AssetLibrary.tsx`, `src/components/AssetLibrary.test.tsx`

- **A11Y-12 Asset rows:** Confirmed via test that `EditButton label={asset.name}` and `DeleteButton label={asset.name}` at lines 337–338, 396–397, 464–465 already produce correct `aria-label="Edit {name}"` / `aria-label="Delete {name}"` — no changes required, tests verify no regression.
- **A11Y-15 Category filter group:** Wrapped the `aria-pressed` filter buttons ("All" + per-category) in `<div role="group" aria-label="Filter by category" className="flex gap-2 flex-wrap">`. The search `<Input>` and Clear button remain outside the group in the parent `<div className="relative ml-auto ...">`.
- **A11Y-15 SortIndicator:** Added `aria-hidden="true"` to the `<span>` returned by the `SortIndicator` component. Column headers already carry `aria-sort` — the glyph was visual redundancy that AT would double-announce.

## Verification

- `npx vitest run src/components/AssetLibrary.test.tsx` — 12/12 pass
- `npx vitest run` (full suite) — 703/703 pass, 0 regressions

## Deviations from Plan

### TDD Gate — Combined RED+GREEN commit

- **Found during:** Task 1 commit
- **Issue:** The TDD protocol calls for a `test(...)` RED commit followed by a separate `feat(...)` GREEN commit. Both test creation and implementation were staged together and landed in a single commit (`dac0b70`).
- **Why:** The implementation was already written in the working tree before the first commit was staged.
- **Impact:** None on correctness — the tests were written and verified failing before implementation, and the final implementation is correct with all tests green.
- **Commit:** dac0b70

### `CSS.escape` not available in jsdom

- **Found during:** Task 1 — initial GREEN test run
- **Issue:** `CSS.escape()` is not polyfilled in jsdom. Tests that used it to build an `id`-based selector threw `TypeError: Cannot read properties of undefined (reading 'escape')`.
- **Fix:** Replaced with `form.querySelector('input[required][type="text"]')` — equivalent, more direct.
- **Files modified:** `src/components/AssetLibrary.test.tsx`

## Known Stubs

None — all changes are pure ARIA attribute additions to existing UI. No placeholder data or stub wiring.

## Threat Flags

None — ARIA-only changes to existing client-side form/list UI. No new network endpoints, auth paths, file access, or schema changes.

## Self-Check

- [x] `src/components/AssetLibrary.tsx` modified — confirmed
- [x] `src/components/AssetLibrary.test.tsx` created — confirmed
- [x] Commit `dac0b70` exists

## Self-Check: PASSED
