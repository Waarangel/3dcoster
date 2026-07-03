---
phase: 35-accessibility-tier-4
plan: 01
subsystem: ui
tags: [accessibility, wcag, aria, tabs, roving-tabindex, react, vitest, settings-modal]

# Dependency graph
requires:
  - phase: 34-live-papercut-fixes
    provides: shared icon-button components (EditButton/DeleteButton) + dialogA11y focus trap already in place
provides:
  - "Keyboard-operable Settings inner tabs (Left/Right/Home/End, roving tabindex, focus-to-panel) — WCAG 2.4.3"
  - "Verified descriptive aria-labels on Settings marketplace edit/delete icon buttons — WCAG 4.1.2"
  - "SettingsModal.test.tsx — first test coverage for the Settings modal (arrow-key nav + icon-button labels)"
affects: [accessibility-tier-4 remaining plans, v1.9 phase smoke test, future SettingsModal edits]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WAI-ARIA APG Tabs (automatic activation): roving tabindex + arrow-key handler + tabIndex=-1 panel programmatic focus"
    - "Per-keypress act() isolation in createRoot+act tests to avoid the stale-closure trap on sequential state updates"

key-files:
  created:
    - src/components/SettingsModal.test.tsx
  modified:
    - src/components/SettingsModal.tsx

key-decisions:
  - "Roving tabindex (not aria-activedescendant) — native <button> tabs make tabIndex toggling the natural APG fit (RESEARCH §A11Y-10, locked)"
  - "Automatic activation (arrow key selects + moves focus) — Settings panel renders synchronously, no latency concern"
  - "A11Y-12 needed no source change: marketplace section already used EditButton/DeleteButton label={mp.name}; covered by a confirming test instead"

patterns-established:
  - "Settings tablist keyboard contract: handleTablistKeyDown computes next index (modulo wrap for arrows, 0/len-1 for Home/End), setActiveTab, focus tab button, then panelRef.focus()"
  - "Test convention: raw createRoot+act, query document.body (SidePanel renders via createPortal), dispatch KeyboardEvent on the role=tablist node"

requirements-completed: [A11Y-10, A11Y-12]

# Metrics
duration: 18min
completed: 2026-06-26
---

# Phase 35 Plan 01: Settings Tabs Keyboard Nav + Icon-Button Labels Summary

**WAI-ARIA APG roving-tabindex keyboard navigation (Left/Right/Home/End + focus-to-panel) on the Settings inner tabs, plus verified descriptive aria-labels on the marketplace edit/delete icon buttons — closing WCAG-Critical A11Y-10 and the SettingsModal half of A11Y-12.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-26T00:50Z
- **Completed:** 2026-06-26T01:08Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- **A11Y-10 (WCAG 2.4.3, Critical):** Settings inner tabs now implement the full APG Tabs keyboard contract. A keyboard-only user can move between tabs with Left/Right (wrapping), Home (first), and End (last); exactly one tab is tab-reachable (roving tabindex); the active tabpanel receives programmatic focus on switch (`tabIndex={-1}` + `panelRef.focus()`). Previously the tablist declared the ARIA roles but shipped zero keyboard interaction — a keyboard user was trapped on the first tab.
- **A11Y-12 (WCAG 4.1.2):** Confirmed the marketplace-section `EditButton`/`DeleteButton` already announce `Edit {name}` / `Delete {name}`. No source change needed; locked in with a regression test asserting every icon-only button in the marketplace panel has an `aria-label`.
- **Test coverage:** New `SettingsModal.test.tsx` with 13 passing assertions — the first automated coverage for this modal.

## Task Commits

Both tasks share the same two files (`SettingsModal.tsx` + `SettingsModal.test.tsx`); they were implemented together under one TDD cycle and committed atomically:

1. **Task 1 + Task 2 (A11Y-10 arrow-key nav + A11Y-12 icon-button label verification)** - `9f8e786` (feat)

**Plan metadata:** (this SUMMARY commit)

_TDD note: test file written first and run RED (8 failing), then implementation made it GREEN (13/13). Single commit since the implementation and tests are inseparable for these two coupled tasks._

## Files Created/Modified
- `src/components/SettingsModal.test.tsx` (created) - 13 assertions: roving tabindex (single tabIndex=0), ArrowRight/ArrowLeft with wrap, Home/End, panel tabIndex=-1, and marketplace Edit/Delete aria-labels. Raw `createRoot+act`, queries `document.body` (portal).
- `src/components/SettingsModal.tsx` (modified) - Added `useRef` import, `panelRef`, `handleTablistKeyDown`; `onKeyDown` on the `role="tablist"` div; `tabIndex={activeTab === tab.id ? 0 : -1}` on each `role="tab"` button; `ref={panelRef}` + `tabIndex={-1}` on the `role="tabpanel"` div.

## Decisions Made
- **Roving tabindex over aria-activedescendant** — native `<button>` tabs make `tabIndex` toggling the idiomatic APG fit (RESEARCH §A11Y-10 locked this).
- **Automatic activation** — arrow key both selects and moves focus; the Settings panel renders synchronously so there is no latency concern (APG guidance).
- **A11Y-12 was a verify-not-change task** — the marketplace icon buttons already used the shared labelled components correctly (as RESEARCH assumption A3 anticipated). Closed it with a confirming/regression test rather than a code edit.

## Deviations from Plan

None - plan executed exactly as written. The only nuance: Task 2 required no source modification (marketplace buttons were already compliant), which the plan explicitly anticipated ("If they already use the shared components ... confirm via the test and make no change").

## Issues Encountered
- **Stale-closure trap in the wrap test:** the initial "ArrowRight wraps" test dispatched multiple keydowns inside a single `act()`. Because `handleTablistKeyDown` reads `activeTab` from the render-time closure, all batched presses saw the same stale value and the assertion failed. This is a test-authoring artifact, not an implementation bug (each real user keypress re-renders before the next handler runs). Fixed by dispatching each keydown in its own `act()` so React flushes the state update between presses. All 13 tests then passed.

## Verification
- `npx vitest run src/components/SettingsModal.test.tsx` → 13 passed.
- `npx vitest run` (full suite) → 55 files, 691 passed, 1 todo, 0 failures (no regressions).
- `lint:no-raw-html` pre-commit hook → passed.
- Note: standalone `tsc --noEmit` and `npm run lint` were blocked by the sandbox; changes are type-safe by inspection (`useRef<HTMLDivElement>`, `React.KeyboardEvent<HTMLDivElement>`, standard `tabIndex`/`ref` props). Full TS+lint runs as the build/CI gate before the v1.9 tag.
- Manual VoiceOver check (active tab announced on arrow-key switch) deferred to the phase smoke test per the plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- A11Y-10 (one of the two phase WCAG-Critical items) is closed. A11Y-11 (form-error association, the other Critical) is handled by a separate plan in this phase.
- The roving-tabindex + focus-to-panel pattern established here is reusable for the App.tsx main tabpanel `tabIndex={-1}` cleanup in A11Y-15.
- No blockers.

## Self-Check: PASSED

---
*Phase: 35-accessibility-tier-4*
*Completed: 2026-06-26*
