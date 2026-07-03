---
phase: 35-accessibility-tier-4
plan: 05
subsystem: accessibility
tags: [a11y, aria, infotooltip, app-tabpanel, back-to-site, escape-dismiss, wcag-4-1-2]
dependency_graph:
  requires: [35-04]
  provides: [A11Y-15-complete]
  affects: [src/App.tsx, src/components/ui/InfoTooltip.tsx]
tech_stack:
  added: []
  patterns:
    - concise aria-label on tooltip trigger ("More information") per WAI-ARIA tooltip pattern
    - Escape-to-dismiss via onKeyDown with stopPropagation on InfoTooltip button
    - tabIndex={-1} on role="tabpanel" for programmatic focus receptibility
    - aria-label on icon-only Link with aria-hidden on children to prevent double-announcement
key_files:
  created:
    - src/App.a11y.test.tsx
  modified:
    - src/App.tsx
    - src/components/ui/InfoTooltip.tsx
    - src/components/ui/InfoTooltip.test.tsx
decisions:
  - "InfoTooltip button label changed from verbose {text} prop to canonical 'More information'; full text stays in role='tooltip' via aria-describedby"
  - "Escape handler calls e.stopPropagation() to prevent parent modal (SettingsModal) from intercepting the keypress"
  - "App.tsx full-render impractical in jsdom (Dexie DB hooks); used minimal replica subtrees in App.a11y.test.tsx per plan guidance"
metrics:
  duration_minutes: 91
  completed: "2026-06-26"
  tasks_total: 2
  tasks_completed: 2
  files_modified: 4
  tests_added: 12
  tests_total_suite: 731
---

# Phase 35 Plan 05: A11Y-15 App tabpanel + InfoTooltip AA cleanups Summary

**One-liner:** ARIA structural fixes to App.tsx (tabpanel tabIndex, back-to-site accessible name) and InfoTooltip (concise trigger label + Escape dismiss) closing the A11Y-15 AA cleanup requirement.

## What Was Built

### Task 1: Main tabpanel tabIndex + labelled mobile "Back to site" link (A11Y-15)

**`src/App.tsx`:**
- Added `tabIndex={-1}` to `<main role="tabpanel" id="app-tabpanel">` so a tab-switch handler can call `.focus()` on the panel (WCAG 2.4.3 programmatic focus support). No arrow-key nav added — that is A11Y-10 / SettingsModal only; the main tablist is out of scope.
- Added `aria-label="Back to site"` to the `<Link to="/">` back-to-site control so the link has an accessible name at all viewport widths (on mobile, the `<span className="hidden sm:inline">` is CSS-hidden and AT may skip it).
- Added `aria-hidden="true"` to both the icon `<svg>` and the `<span>` inside the link to prevent double-announcement against the link's `aria-label`.

**`src/App.a11y.test.tsx`** (new, 5 tests):
- Renders minimal replica subtrees (not full App — Dexie DB hooks are impractical in jsdom) per plan guidance.
- Asserts: `[role="tabpanel"]` has `tabindex="-1"`, correct `id` and `aria-labelledby`; back-to-site anchor has `aria-label="Back to site"`; icon SVG has `aria-hidden="true"`; text span has `aria-hidden="true"`.

### Task 2: InfoTooltip concise label + Escape dismiss (A11Y-15)

**`src/components/ui/InfoTooltip.tsx`:**
- Changed `aria-label={text}` (verbose — the full tooltip paragraph) to `aria-label="More information"` — the canonical concise label for a tooltip trigger per WAI-ARIA. Screen readers now announce "More information, button" on focus, then the full description when the tooltip opens via `aria-describedby`.
- Added `onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}` to the button. `stopPropagation()` prevents the Escape from also closing any parent modal (e.g. SettingsModal's focus trap).

**`src/components/ui/InfoTooltip.test.tsx`** (updated, 5 new tests added, 2 existing retained):
- New assertions: concise `aria-label="More information"` (not the text prop); full tooltip text still present in `role="tooltip"` span; `aria-describedby` links button to tooltip id when open; Escape closes the tooltip; Escape when already closed is a no-op.
- Existing unique-id tests unchanged and still passing.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run src/App.a11y.test.tsx` | 5/5 passed |
| `npx vitest run src/components/ui/InfoTooltip.test.tsx` | 7/7 passed |
| Full suite `npx vitest run` | 731 passed, 1 todo, 0 failures |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `098e7ae` | feat(35-05): add tabIndex={-1} to main tabpanel + label back-to-site link (A11Y-15) |
| 2 | `7b44c91` | feat(35-05): InfoTooltip concise aria-label + Escape-to-dismiss (A11Y-15) |

## Deviations from Plan

None — plan executed exactly as written.

The plan correctly anticipated that full App render would be impractical in jsdom and pre-authorised minimal replica subtrees. The test file implements that approach with a header comment documenting the reason. The InfoTooltip changes (label + Escape) matched the RESEARCH §15c specification precisely.

## Known Stubs

None. All changes are complete ARIA attribute and event handler additions with no placeholder content or deferred wiring.

## Threat Flags

None. Changes are ARIA attribute additions and a keyboard event handler on client-side UI only. No new network endpoints, auth paths, file access, or schema changes.

## Self-Check

Files exist:
- `src/App.a11y.test.tsx` — created ✓
- `src/App.tsx` — modified ✓  
- `src/components/ui/InfoTooltip.tsx` — modified ✓
- `src/components/ui/InfoTooltip.test.tsx` — modified ✓

Commits exist:
- `098e7ae` — Task 1 ✓
- `7b44c91` — Task 2 ✓

## Self-Check: PASSED
