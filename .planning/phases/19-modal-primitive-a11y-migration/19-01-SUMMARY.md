---
phase: 19-modal-primitive-a11y-migration
plan: 01
subsystem: ui
tags: [react, typescript, aria, accessibility, focus-trap, portal, vitest]

# Dependency graph
requires: []
provides:
  - "Modal primitive at src/components/ui/Modal.tsx with WAI-ARIA dialog pattern"
  - "Focus trap (Tab/Shift+Tab cycle, re-queried per keystroke)"
  - "Body scroll-lock with prior-value capture/restore"
  - "Portal to document.body via createPortal"
  - "Dev-mode single-modal-only guard (console.warn)"
  - "HYG-09 absorption: children unmount on close via early-return gate"
  - "17 Vitest tests covering ARIA structure, focus, scroll-lock, Escape, backdrop, dev-warn, size"
  - "Barrel re-export: export { Modal } from './Modal'"
affects: [19-04, 19-05, 22-jobsmanager-decomposition]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WAI-ARIA dialog pattern via createPortal + useId + hand-rolled focus trap"
    - "Module-level isAnyModalOpen flag for single-modal-only enforcement"
    - "useRef(onClose) to keep stable keydown handler without re-registration on each render"
    - "setTimeout(focusFirst, 0) for deferred focus — jsdom-compatible (not requestAnimationFrame)"

key-files:
  created:
    - src/components/ui/Modal.tsx
    - src/components/ui/Modal.test.tsx
  modified:
    - src/components/ui/index.ts

key-decisions:
  - "Modal uses useEffect keyed on isOpen (not on mount/unmount) so all hooks are unconditional — avoids Rules-of-Hooks violation"
  - "early-return `if (!isOpen) return null` placed AFTER hooks; useEffect guards internally with `if (!isOpen) return`"
  - "Focus deferred via setTimeout(0) not requestAnimationFrame — rAF does not fire in jsdom"
  - "onCloseRef pattern (ref.current = onClose each render) keeps keydown handler stable without re-registering"
  - "Close button (X) is the first focusable descendant — focus on mount lands on it; test updated to reflect reality"

patterns-established:
  - "Modal primitive: single-instance, portal-first, ARIA-complete — all future modals in Phase 19-04/05 consume this"
  - "Test convention: vi.useFakeTimers() + vi.runAllTimers() to advance deferred focus setTimeout in jsdom"

requirements-completed: [A11Y-01, A11Y-02, HYG-09]

# Metrics
duration: 7min
completed: 2026-05-26
---

# Phase 19 Plan 01: Modal Primitive Summary

**WAI-ARIA dialog primitive with portal, hand-rolled focus trap, scroll-lock, dev-mode single-modal guard, and 17 Vitest tests — closes A11Y-01, A11Y-02, HYG-09**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-26T17:28:04Z
- **Completed:** 2026-05-26T17:35:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- New `src/components/ui/Modal.tsx` (208 LOC): role="dialog" + aria-modal="true" + aria-labelledby via useId() + hand-rolled focus trap + scroll-lock + portal to document.body + HYG-09 absorption + dev-mode single-modal guard
- New `src/components/ui/Modal.test.tsx` (455 LOC): 17 tests across 7 groups, all passing — no @testing-library/react dependency
- Barrel export updated in `src/components/ui/index.ts`

## 6 Key Public Surface Assertions

| Assertion | Implementation |
|-----------|----------------|
| `role="dialog"` | Card div: `role="dialog"` |
| `aria-modal="true"` | Card div: `aria-modal="true"` |
| `aria-labelledby={titleId}` | Card div: `aria-labelledby={titleId}` |
| `useId()` on title | `const titleId = useId()` → `<h3 id={titleId}>` |
| X button `aria-label="Close"` | `<Button aria-label="Close">` in header |
| Portal target = `document.body` | `createPortal(jsx, document.body)` |

## HYG-09 Closure Note

HYG-09 is closed by `Modal`'s `isOpen ? children : null` pattern (implemented as early-return `if (!isOpen) return null` after hooks). Children unmount when `isOpen` becomes false — consumers no longer need close-reset `useEffect` guards.

## Task Commits

1. **Task 1: Modal primitive with ARIA + focus trap + scroll-lock + portal + dev-warn** — `299bd9e` (feat)
2. **Task 2: Vitest coverage — ARIA, focus, scroll-lock, Escape/backdrop, dev-warn** — `cec2550` (test)

## Files Created/Modified

- `src/components/ui/Modal.tsx` — 208 LOC; WAI-ARIA dialog primitive with createPortal, useId, focus trap, scroll-lock, dev guard
- `src/components/ui/Modal.test.tsx` — 455 LOC; 17 Vitest tests, 7 groups; raw createRoot + act convention; no new deps
- `src/components/ui/index.ts` — appended `export { Modal } from './Modal'`

## Test Results

- **17 / 17 tests pass** (`npx vitest run src/components/ui/Modal.test.tsx`)
- **Full suite: 293 / 293 pass** (no regressions; 1 pre-existing todo)
- **TypeScript: `npx tsc -b` exits 0**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Modal useEffect unconditional — no Rules-of-Hooks violation**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan specified `if (!isOpen) return null` BEFORE the portal call, with eslint-disable for conditional hook. This violates React's Rules of Hooks and causes linting errors.
- **Fix:** Moved early-return guard AFTER all hooks. `useEffect` has an internal `if (!isOpen) return` guard so it only activates when open. The `if (!isOpen) return null` at the end gates portal rendering. HYG-09 semantics preserved — children don't render when closed.
- **Files modified:** `src/components/ui/Modal.tsx`
- **Verification:** `tsc -b` exits 0; all tests pass; focus/scroll-lock/dev-warn all work correctly

**2. [Rule 1 - Bug] rAF → setTimeout(0) for jsdom focus deferral**
- **Found during:** Task 2 (testing)
- **Issue:** `requestAnimationFrame` does not fire in jsdom test environment, causing all 3 focus-management tests to fail.
- **Fix:** Replaced `requestAnimationFrame(focusFirst)` with `setTimeout(focusFirst, 0)`. Both defer focus until after the portal DOM is committed; setTimeout(0) fires in jsdom when flushed via `vi.runAllTimers()`.
- **Files modified:** `src/components/ui/Modal.tsx`, `src/components/ui/Modal.test.tsx` (uses `vi.useFakeTimers()` + `vi.runAllTimers()`)
- **Verification:** All 17 tests pass

**3. [Rule 1 - Bug] Close button is first focusable descendant (test assertion corrected)**
- **Found during:** Task 2 (testing)
- **Issue:** Plan Test 6 expected focus on "first focusable child of children" (e.g., `<input>`), but the Modal auto-renders a Close button in the header which is the actual first focusable descendant.
- **Fix:** Updated test assertion to expect the Close button as first focus target. Added a second test asserting that `tabIndex={-1}` on the card enables programmatic focus fallback. This is correct WAI-ARIA behavior — focusing the first focusable element (the dismiss control) is standard for dialog patterns.
- **Files modified:** `src/components/ui/Modal.test.tsx`
- **Verification:** Test clearly documents the Close button focus behavior; all 17 tests pass

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 1 test correction)
**Impact on plan:** All fixes necessary for correctness. The component semantics (WAI-ARIA dialog, focus trap, scroll-lock, HYG-09 absorption) are identical to the plan spec. No scope changes.

## Issues Encountered

- `node_modules` in the worktree was nearly empty — `npm install` was required to install packages added in later phases (react-window, jspdf, jspdf-autotable, @tauri-apps/plugin-*). Running `npm install` resolved all pre-existing `tsc -b` errors.

## Threat Model Coverage

All mitigations from the plan's STRIDE register are implemented:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-19-01 | Capture prior `document.body.style.overflow` at mount; restore exact value on unmount | ✓ Implemented + tested |
| T-19-02 | Focus trap re-queries only on Tab keystroke (not in setInterval) | ✓ Implemented |
| T-19-03 | `console.warn` gated on `process.env.NODE_ENV !== 'production'` | ✓ Implemented + tested |
| T-19-04 | Accepted (dev hygiene guard, not a security boundary) | ✓ Accepted |

## Next Phase Readiness

- `<Modal>` primitive is ready for consumption by plans 19-04 and 19-05 (modal migrations)
- Focus trap re-queries on each Tab — handles dynamic children (combobox dropdowns in PrintQuoteModal per D-07)
- Portal to `document.body` — no stacking context issues with virtualized lists or fixed headers
- HYG-09 absorbed — migrated modals can remove their close-reset useEffects

---
*Phase: 19-modal-primitive-a11y-migration*
*Completed: 2026-05-26*
