---
phase: 35-accessibility-tier-4
plan: "03"
subsystem: FilamentSelector
tags: [a11y, wcag-4.1.2, aria-labelledby, aria-label, menu, tdd]
dependency_graph:
  requires: []
  provides: [FilamentSelector-a11y-label-association]
  affects: [src/components/FilamentSelector.tsx]
tech_stack:
  added: []
  patterns: [static-aria-label-on-menu, aria-labelledby-label-association]
key_files:
  created: [src/components/FilamentSelector.test.tsx]
  modified: [src/components/FilamentSelector.tsx]
decisions:
  - "Added static id to <label> and aria-labelledby on trigger (not htmlFor/id) to keep the existing Button ref pattern unchanged"
  - "Used static aria-label={brand} on submenu div (not aria-labelledby) per RESEARCH Pitfall 5: trigger text is dynamic so labelledby on the menu would cause dynamic name changes while open"
  - "No live region or aria-activedescendant added — existing focus-based nav already announces items on focus"
metrics:
  duration: ~8 minutes
  completed: 2026-06-26
  tasks_completed: 1
  files_count: 2
---

# Phase 35 Plan 03: FilamentSelector Accessible Name (A11Y-13) Summary

Close A11Y-13 (WCAG 4.1.2) with `id` + `aria-labelledby` label association on the trigger and `aria-label={brand}` on each open brand submenu.

## What Was Built

**A11Y-13 — FilamentSelector accessible name (WCAG 4.1.2)**

Two targeted ARIA additions to `FilamentSelector.tsx`:

1. **Label association** (`id` + `aria-labelledby`): The `<label>Filament</label>` at line 297 received `id="filament-trigger-label"`. The trigger `<Button>` received `aria-labelledby="filament-trigger-label"`. Without this, AT announced the selected filament name (e.g. "Bambu PLA Matte") but never the field purpose ("Filament").

2. **Brand submenu accessible name** (`aria-label={brand}`): The submenu `<div role="menu">` at line 410 (rendered once per open brand) received `aria-label={brand}`. Without this, every open submenu was an unnamed menu — AT could not tell users which brand's filament list they were viewing.

No live region or `aria-activedescendant` was added. The component's existing arrow-key handlers call `.focus()` directly on each menu item, so AT already announces items on focus — the APG-verified pattern for this case.

The main `role="menu" aria-label="Filaments"` was left unchanged (regression guard test confirms this).

**New test file** `FilamentSelector.test.tsx`: 4 assertions covering all three aspects — label `id`, trigger `aria-labelledby`, brand submenu `aria-label`, and the regression guard for the main menu name.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Associate trigger label + name brand submenu (A11Y-13) | 37a42af | FilamentSelector.tsx, FilamentSelector.test.tsx |

## Verification

- `npx vitest run src/components/FilamentSelector.test.tsx`: 4/4 pass
- `npx vitest run` (full suite): 707/707 pass, 1 todo, 0 failures
- TypeScript: no errors (no type changes — ARIA props are valid on existing JSX elements)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan adds ARIA attributes only; no data flows or placeholders.

## Threat Flags

None. ARIA label additions to an existing client-side menu; no new attack surface.

## Self-Check: PASSED

- [x] `src/components/FilamentSelector.tsx` modified: confirmed
- [x] `src/components/FilamentSelector.test.tsx` created: confirmed
- [x] Commit `37a42af` exists: confirmed
- [x] Full suite 707 tests pass: confirmed
