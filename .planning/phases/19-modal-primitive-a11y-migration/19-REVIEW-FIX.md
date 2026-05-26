---
phase: 19
fixed_at: 2026-05-26T14:30:00Z
review_path: .planning/phases/19-modal-primitive-a11y-migration/19-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-05-26
**Source review:** `.planning/phases/19-modal-primitive-a11y-migration/19-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (4 Critical + 8 Warning)
- Fixed: 12
- Skipped: 0
- Info findings (5): out of scope per `fix_scope=critical_and_warning`; deferred

**Baseline → final state:**
- `npx tsc -b` — exit 0 (was clean before, still clean)
- `npx vitest run` — 304 tests passing | 1 todo across 21 files (was 301 passing; +3 net new tests added by WR-03 and WR-07)

## Fixed Issues

### CR-01: Modal focus trap can be escaped via Tab from a non-focusable element

**Files modified:** `src/components/ui/Modal.tsx`
**Commit:** `c825eeb` (combined with CR-02/CR-03/WR-05 — all touch the same `useEffect` block in Modal.tsx and CR-03 references the counter variable introduced by CR-02; splitting them would have left broken intermediate commits)
**Applied fix:** Replaced boundary checks that only `preventDefault`ed when `activeElement === first` / `=== last`. The handler now computes `activeIsInsideFocusableList = active instanceof HTMLElement && focusable.includes(active)` and treats "not in the focusable list" as a boundary — clamping focus back to `first` (Tab) or `last` (Shift+Tab). When `focusable.length === 0`, the handler now `preventDefault`s and focuses the card itself (relying on the existing `tabIndex={-1}`) so Tab can never escape the dialog even with no focusable children.

### CR-02: `isAnyModalOpen` flag corrupted when two Modals overlap

**Files modified:** `src/components/ui/Modal.tsx`
**Commit:** `c825eeb`
**Applied fix:** Replaced the module-level `let isAnyModalOpen = false` boolean with `let openModalCount = 0`. Mount increments (`openModalCount += 1`); cleanup decrements with a floor (`openModalCount = Math.max(0, openModalCount - 1)`). The dev warn now fires when `openModalCount > 0` at mount-time, which correctly tracks concurrent / StrictMode-double-invoke states. WR-07 below pins this invariant with a third-modal warn assertion.

### CR-03: Focus restoration unstable under React 18 StrictMode

**Files modified:** `src/components/ui/Modal.tsx`
**Commit:** `c825eeb`
**Applied fix:** Cleanup now skips focus restoration in three cases: (1) `previouslyFocused === document.body` (no meaningful prior focus — deep-link / auto-opened modal scenarios), (2) the previously-focused element is no longer in the document, (3) the captured element is INSIDE the about-to-unmount dialog (`!cardRef.current?.contains(previouslyFocused)`) — this guards the StrictMode setup→cleanup→setup race where `setTimeout(focusFirst, 0)` may have already advanced focus into the dialog by the time first cleanup snapshots it.

### CR-04: JobsManager picker Escape now closes the entire Sale Modal

**Files modified:** `src/components/JobsManager.tsx`
**Commit:** `1160855`
**Applied fix:** Added `e.stopPropagation()` to the customer picker's Escape branch at `src/components/JobsManager.tsx:1327-1331`, mirroring the existing PrintQuoteModal pattern verbatim. The native event no longer reaches Modal's document-level keydown listener, so dismissing the picker dropdown leaves the parent Record Sale modal open.

### WR-01: AssetLibrary nests `<List role="list">` inside `<div role="grid">`, breaking ARIA hierarchy

**Files modified:** `src/components/AssetLibrary.tsx`, `src/components/CustomerLibrary.tsx`, `src/components/JobsManager.tsx`
**Commit:** `cf4b1d6`
**Applied fix:** AssetLibrary's two virtualized desktop tables (printer at line 1190, materials at line 1223) now pass `role="rowgroup"` to `<List>` and drop `aria-rowcount` (the outer `<div role="grid">` already exposes the row count). CustomerLibrary (line 275) and JobsManager (line 1755) keep `role="list"` because they ARE standalone lists, but drop the invalid `aria-rowcount` attribute (WAI-ARIA 1.2 only permits `aria-rowcount` on `grid` / `table` / `treegrid`).

### WR-02: Modal first-focus lands on the X (Close) button

**Files modified:** `src/components/ui/Modal.tsx`, `src/components/ui/Modal.test.tsx`
**Commit:** `4f91888`
**Applied fix:** Added an opt-in `initialFocusRef?: RefObject<HTMLElement | null>` prop. By default, `focusFirst` now skips the Close button when other focusable descendants exist (`focusable.find(el => el.getAttribute('aria-label') !== 'Close') ?? focusable[0]`). Only falls back to Close when it's the sole focusable. The previously-passing test that locked in "focus must land on Close" was rewritten to assert the new behavior (`activeElement` should be the first non-Close focusable). A read-through-stable-ref pattern (`initialFocusRefRef`) keeps the `useEffect` dependency array intact.

### WR-03: Modal "no focusable descendants" fallback is not tested

**Files modified:** `src/components/ui/Modal.tsx`, `src/components/ui/Modal.test.tsx`
**Commit:** `f59adb4`
**Applied fix:** Extracted the focus-target selection into an exported pure helper `findInitialFocusTarget(card: HTMLElement): HTMLElement` (precedence: skip-Close-if-others → Close-if-alone → card-if-nothing). Replaced the misleading "focuses dialog card if no focusable descendants" test (which had a code comment admitting it could not actually trigger the fallback) with three direct helper unit tests covering each precedence branch. Modal's `focusFirst` now delegates to the helper.

### WR-04: CustomerCsvImportModal / CsvImportModal embed an interactive Back button inside the dialog heading

**Files modified:** `src/components/ui/Modal.tsx`, `src/components/CustomerCsvImportModal.tsx`, `src/components/CsvImportModal.tsx`
**Commit:** `492d6a5`
**Applied fix:** Added a `headerLeft?: ReactNode` prop to Modal that renders OUTSIDE the `<h3 id={titleId}>` (symmetric with the Close button's slot on the right). Restructured the header to a `flex` row containing `[headerLeft, <h3>{title}</h3>]` on the left and the Close button on the right. CustomerCsvImportModal and CsvImportModal now pass their Back button via `headerLeft` instead of smuggling it inside the `title` prop — the dialog's accessible name (via `aria-labelledby`) is now clean ("Preview customer import" only, not "Back to upload Preview customer import"). Also added `truncate` + `min-w-0` to keep long titles from pushing the Close button off-screen.

### WR-05: `process.env.NODE_ENV` is used in client code without Vite import.meta.env guard

**Files modified:** `src/components/ui/Modal.tsx`
**Commit:** `c825eeb` (folded into the Modal.tsx Critical batch — the dev-warn block was the only `process.env.NODE_ENV` usage in Modal.tsx and it sits two lines below CR-02's counter init)
**Applied fix:** Replaced `process.env.NODE_ENV !== 'production'` with `import.meta.env.DEV` — Vite-native, hard-coded boolean replaced at build time, no shim required.

### WR-06: PrintQuoteModal's edit-mode title interpolation can render "Q-undefined"

**Files modified:** `src/components/PrintQuoteModal.tsx`
**Commit:** `a5702bf`
**Applied fix:** Imported `formatQuoteNumber` from `../utils/format` (already used by DeclineQuoteModal and PDF generation). Title is now `editingQuote ? \`Edit Quote ${formatQuoteNumber(editingQuote.quoteNumber)} — ${job.name}\` : \`Create Quote — ${job.name}\`` — dropped the dead inner `editingQuote ? ... : ''` ternary (impossible state — `isEdit` is derived from the same prop in the same render pass) and consolidated the formatting through the canonical helper. `isEdit` is still used elsewhere (line 483, button label).

### WR-07: Modal Group 6 single-modal-warn test relies on module-level state from prior tests

**Files modified:** `src/components/ui/Modal.test.tsx`
**Commit:** `561b77f`
**Applied fix:** Added a second test in Group 6 ("still warns when a third Modal opens after only one of two has closed") that explicitly pins the CR-02 counter invariant: open two modals → first warn fires → close ONLY the second modal → open a third → second warn fires (because one modal is still up). Under the old boolean implementation this test would have failed (closing either modal would have flipped the flag to false, silencing the third warn).

### WR-08: CustomerEditModal's hydration useEffect keyed only on `initialCustomer?.id` misses non-id field changes

**Files modified:** `src/components/CustomerEditModal.tsx`
**Commit:** `59d193d`
**Applied fix:** Replaced the `initialCustomer?.id`-keyed effect (with `eslint-disable react-hooks/exhaustive-deps`) with an `isOpen`-transition-keyed effect using a `useRef` to track the previous value. Hydration now runs ONLY on the false→true transition — which is the actual contract this modal has (HYG-09 unmounts children on close, so a fresh mount runs every time the modal opens). The `eslint-disable` was removed; the dep array is now honest (`[isOpen, initialCustomer]`).

> **Note — requires human verification:** WR-08 is a behavior change in hydration timing. Per the spec's logic-bug guidance, manually confirm:
> 1. Opening the Add Customer modal still shows empty fields (no `initialCustomer`).
> 2. Opening Edit on a row still pre-fills with that customer's values.
> 3. While the modal is open, parent re-renders (e.g., other state changes in CustomerLibrary) do NOT clobber in-progress edits — which was the goal.
> Full test suite passes (304/304 + 1 todo), and the modal is unmounted/remounted by Modal's HYG-09 absorption on every open/close cycle, so the false→true transition is structurally identical to a mount-time hydration.

## Skipped Issues

None — all 12 in-scope findings were fixed.

## Out-of-scope (Info — `fix_scope=critical_and_warning`)

Deferred per config; documented in REVIEW.md for future iteration:
- IN-01: `Modal.test.tsx` declares local `type ModalProps` shadowing the real export
- IN-02: SettingsModal labels not connected to inputs via `htmlFor` / `id`
- IN-03: `CollapsibleSection.test.ts` uses `React.createElement` instead of `.tsx` + JSX
- IN-04: JobsManager picker uses static `customer-picker-*` ids (would collide if two pickers ever render simultaneously)
- IN-05: MaintenanceAlertModal title SVG sized `w-6` vs other modals' `w-5`

---

_Fixed: 2026-05-26T14:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
