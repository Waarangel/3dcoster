---
phase: 19-modal-primitive-a11y-migration
plan: 04
status: complete
tasks_completed: 2
tasks_total: 2
duration: ~12min
key-files:
  created: []
  modified:
    - src/components/PrintQuoteModal.tsx
    - src/components/SettingsModal.tsx
    - src/components/UserProfileModal.tsx
    - src/components/CustomerEditModal.tsx
    - src/components/MaintenanceAlertModal.tsx
    - src/components/PrintQuoteModal.test.tsx
requirements_closed:
  - A11Y-03 (5 of 10 modals migrated)
  - A11Y-06 (Settings + UserProfile close-button labels)
  - A11Y-07 (CustomerEditModal half — Record Sale form closes in 19-05)
---

## Summary

Migrated 5 modal surfaces to consume the new `<Modal>` primitive from plan 19-01. CustomerEditModal additionally paired its 5 form labels with their Input/Textarea inputs via `htmlFor`/`id` using plan 19-02's auto-id-capable primitives.

## Commits

- `0076753` refactor(19-04): migrate PrintQuoteModal + SettingsModal + UserProfileModal to Modal primitive (A11Y-03, A11Y-06)
- `dce7c30` refactor(19-04): migrate CustomerEditModal + MaintenanceAlertModal to Modal; pair CustomerEditModal labels (A11Y-03, A11Y-07)

## LOC Delta

| File | LOC Δ | Notes |
|------|-------|-------|
| PrintQuoteModal.tsx | -29 | Deleted Escape useEffect, backdrop div, card div, header chrome, X button |
| SettingsModal.tsx | -28 | Deleted Escape useEffect, backdropClick handler, modalRef, top-right anchor styles, header chrome, X button. Settings icon moved into title prop |
| UserProfileModal.tsx | -33 | Deleted Escape useEffect, backdropClick handler, modalRef, header chrome, X button. Top-right anchor dropped — now centered |
| CustomerEditModal.tsx | -25 / +12 | Deleted Escape effect + close-reset effect, backdrop, card, header. Added 5 `useId()` calls + `htmlFor`/`id` pairings |
| MaintenanceAlertModal.tsx | -28 / +18 | Replaced via Modal; consumer-facing `onDismiss` prop preserved, internal wiring is `onClose={onDismiss}`. Title moved to ReactNode with icon |

## Public API — Unchanged

All 5 modals export the same props they did before:
- PrintQuoteModal: `{ job, userProfile, isOpen, onClose, onQuoteCreated?, editingQuote? }`
- SettingsModal: full settings config props + `{ isOpen, onClose }`
- UserProfileModal: `{ isOpen, onClose, userProfile, onProfileChange }`
- CustomerEditModal: `{ isOpen, initialCustomer?, onSave, onClose }`
- MaintenanceAlertModal: `{ alert, printerInstances, onDismiss }` — **NOT renamed** to `onClose`

## Visual Changes — Flag for UAT (Plan 19-06)

- **SettingsModal** loses its top-right anchor (`mt-12 mr-2 max-h-[calc(100vh-100px)]`) and is now viewport-centered like every other modal.
- **UserProfileModal** loses its top-right anchor and is now viewport-centered.
- **All 5 modals** now have an `aria-label="Close"` X button (Modal auto-renders it). Previously SettingsModal + UserProfileModal had a close button with no accessible label.

## CustomerEditModal A11Y-07 — 5 Label Pairings

| Field | useId variable | Both label & input use |
|-------|---------------|------------------------|
| Name | `nameId` | `htmlFor={nameId}` + `id={nameId}` on Input |
| Email | `emailId` | `htmlFor={emailId}` + `id={emailId}` on Input |
| Company | `companyId` | `htmlFor={companyId}` + `id={companyId}` on Input |
| Address | `addressId` | `htmlFor={addressId}` + `id={addressId}` on Textarea |
| Notes | `notesId` | `htmlFor={notesId}` + `id={notesId}` on Textarea |

Clicking any label now focuses its paired input (browser default `<label htmlFor>` behavior).

## Test File Adjustment

`PrintQuoteModal.test.tsx` updated: queries via `document.body.querySelector(...)` instead of `container!.querySelector(...)`. The test still mounts into a container appended to `document.body`, but Modal portals to `document.body`, so the modal content lives as a sibling of the test container, not inside it. Behavioral assertions unchanged.

## Verification

- `npx tsc -b` exit 0 ✓
- `npx vitest run` exit 0 ✓ (21 files, 301 tests passing, 1 todo)
- All grep acceptance criteria from PLAN met ✓

## Deviations

None. The plan acknowledged the test-selector adjustment as expected.

## Self-Check: PASSED
