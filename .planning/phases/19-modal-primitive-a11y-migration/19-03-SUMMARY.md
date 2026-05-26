---
phase: 19-modal-primitive-a11y-migration
plan: "03"
subsystem: ui-primitives
tags: [a11y, fix, InfoTooltip, CollapsibleSection, useId, aria-controls]
dependency_graph:
  requires: []
  provides: [unique-tooltip-ids-per-instance, always-mounted-collapsible-body]
  affects: [SettingsModal, any-consumer-of-CollapsibleSection]
tech_stack:
  added: []
  patterns: [useId-for-stable-unique-ids, html-hidden-attribute-over-conditional-render]
key_files:
  created:
    - src/components/ui/InfoTooltip.test.tsx
  modified:
    - src/components/ui/InfoTooltip.tsx
    - src/components/ui/CollapsibleSection.tsx
    - src/components/ui/CollapsibleSection.test.ts
decisions:
  - "useId() replaces static 'info-tooltip-content' string — each InfoTooltip instance gets a unique id per React design"
  - "HTML hidden attribute chosen over CSS display:none — standard HTML5 boolean, React handles hidden={false} by omitting the attribute"
  - "CollapsibleSection.test.ts Test 1 updated: asserts hidden='' attribute present instead of asserting body absence from DOM"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-26T17:31:24Z"
---

# Phase 19 Plan 03: Primitive A11Y Fixes — InfoTooltip + CollapsibleSection Summary

**One-liner:** InfoTooltip switches static `'info-tooltip-content'` id to `useId()` per-instance; CollapsibleSection always renders body with `hidden={!open}` so `aria-controls` always references a real DOM id.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | InfoTooltip useId() + multi-instance test (A11Y-04) | 9b6a0fd | InfoTooltip.tsx (+3 lines), InfoTooltip.test.tsx (new, 75 lines) |
| 2 | CollapsibleSection always-rendered hidden body (A11Y-08) | 9010180 | CollapsibleSection.tsx (-4/+3 lines), CollapsibleSection.test.ts (+6/-4 lines) |

## Changes Detail

### Task 1 — InfoTooltip.tsx (A11Y-04)

**LOC delta:** +3 lines (import `useId`, `const tooltipId = useId()`, two string literals replaced with expression)

**What changed:**
- `import { useState } from 'react'` → `import { useState, useId } from 'react'`
- Added `const tooltipId = useId();` after `const [open, setOpen] = useState(false);`
- `aria-describedby={open ? 'info-tooltip-content' : undefined}` → `aria-describedby={open ? tooltipId : undefined}`
- `id="info-tooltip-content"` → `id={tooltipId}`

**Result:** Every InfoTooltip instance generates a unique stable id (React's `useId()` guarantees uniqueness per component instance). The SettingsModal Costs & Rates tab with 6+ InfoTooltips visible simultaneously now produces 6 distinct tooltip ids — no id collision. Closes A11Y-04 (HIGH).

**Public API:** Unchanged. `InfoTooltipProps` is `{ text: string; className?: string }` — no new props.

### InfoTooltip.test.tsx (new file)

**Test count:** 2 `it(...)` blocks, both passing.

**What it asserts:**
1. `'renders without colliding ids when two instances are mounted'` — mounts two InfoTooltips, clicks both to open them, queries both `[role="tooltip"]` spans, asserts their `id` attributes are distinct non-empty strings. Locks the A11Y-04 multi-instance unique-id contract.
2. `'does not reuse the static "info-tooltip-content" id'` — mounts one InfoTooltip, opens it, asserts `container.querySelector('#info-tooltip-content')` is null. Guards against regression to the pre-fix static id.

**Convention:** Raw `createRoot` + `act` pattern (D-21). No `@testing-library/react` or `@testing-library/user-event` imported.

### Task 2 — CollapsibleSection.tsx (A11Y-08)

**LOC delta:** net -1 line (conditional `{open && (...)}` wrapper removed; `hidden={!open}` added inline)

**What changed:**
```tsx
// Before:
{open && (
  <div id={bodyId} className="mt-4">
    {children}
  </div>
)}

// After:
<div id={bodyId} hidden={!open} className="mt-4">
  {children}
</div>
```

**Result:** Body div is always mounted in the DOM. `aria-controls={bodyId}` always points to a present DOM element regardless of open state. HTML `hidden` attribute hides the body visually and from the a11y tree when collapsed — screen readers see reliable expand/collapse semantics. Closes A11Y-08 (MEDIUM).

**Public API:** Unchanged. `CollapsibleSectionProps` is unmodified.

### CollapsibleSection.test.ts — updated

**What changed:** Test 1 assertion updated from `expect(html).not.toContain('body content')` to `expect(html).toContain('body content')` + `expect(html).toMatch(/hidden=""/)`. The test now correctly asserts that the body is present but hidden, not absent from the DOM.

**Test 2 and Test 3:** Unchanged — both still pass.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc -b` | EXIT 0 |
| `npx vitest run src/components/ui/InfoTooltip.test.tsx` | 2/2 passed |
| `npx vitest run src/components/ui/CollapsibleSection.test.ts` | 3/3 passed |
| `npx vitest run` (full suite) | 19 files, 278 tests passed, 1 todo |
| `grep -c "info-tooltip-content" InfoTooltip.tsx` | 0 |
| `grep -c "hidden={!open}" CollapsibleSection.tsx` | 1 |

## Deviations from Plan

**1. [Rule 1 - Bug] CollapsibleSection.test.ts Test 1 updated to match new behavior**
- **Found during:** Task 2 verification
- **Issue:** Test 1 asserted `expect(html).not.toContain('body content')` — valid for the old conditional-render pattern but now incorrect since body is always mounted. Running vitest confirmed 1 failure.
- **Fix:** Updated Test 1 to assert `hidden=""` attribute is present in the static markup and that body content IS in the HTML, not absent. This matches the new always-rendered behavior while preserving the D-03 collapsed-by-default semantic.
- **Files modified:** `src/components/ui/CollapsibleSection.test.ts`
- **Commit:** 9010180 (included in the same task commit per plan instructions)

No other deviations. Plan executed as written.

## Stub Tracking

None. These are pure a11y fixes with no data-binding or placeholder content.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Changes are confined to UI component layer — DOM id uniqueness fix and ARIA attribute correctness fix. No threat flags.

## Self-Check: PASSED

- [x] `src/components/ui/InfoTooltip.tsx` — modified, exists
- [x] `src/components/ui/InfoTooltip.test.tsx` — created, exists
- [x] `src/components/ui/CollapsibleSection.tsx` — modified, exists
- [x] `src/components/ui/CollapsibleSection.test.ts` — modified, exists
- [x] Commit 9b6a0fd exists (Task 1)
- [x] Commit 9010180 exists (Task 2)
- [x] All acceptance criteria met
- [x] No regressions in full vitest run (278 pass, 1 todo, 0 fail)

## Notes

- SettingsModal Costs & Rates tab now produces unique tooltip ids for all 6+ InfoTooltip instances — closes the original A11Y-04 audit symptom.
- CollapsibleSection consumers get the ARIA fix for free — no consumer changes needed.
