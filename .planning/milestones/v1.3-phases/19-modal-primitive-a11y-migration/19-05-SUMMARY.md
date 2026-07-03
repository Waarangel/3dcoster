---
phase: 19-modal-primitive-a11y-migration
plan: 05
status: complete
tasks_completed: 2
tasks_total: 2
duration: ~15min
key-files:
  created: []
  modified:
    - src/components/CustomerCsvImportModal.tsx
    - src/components/DeclineQuoteModal.tsx
    - src/components/CsvImportModal.tsx
    - src/components/JobsManager.tsx
    - src/components/DeclineQuoteModal.test.tsx
requirements_closed:
  - A11Y-03 (final 5 of 10 modals — cumulative 10/10 now migrated across 19-04 + 19-05)
  - A11Y-07 (Record Sale half — full close, both halves done)
---

## Summary

Migrated the remaining 5 modal surfaces to the `<Modal>` primitive. 3 standalone modal files (CustomerCsvImportModal, DeclineQuoteModal, CsvImportModal) plus 3 inline JobsManager overlays (Record Sale, Delete Job confirm, Delete Sale confirm). Paired 9 Record Sale form labels with their inputs via `htmlFor`/`id` — closes the Record Sale half of A11Y-07.

## Commits

- `4dca868` refactor(19-05): migrate CustomerCsvImportModal + DeclineQuoteModal + CsvImportModal to Modal primitive (A11Y-03)
- `30c7ac1` refactor(19-05): migrate JobsManager inline overlays to Modal; pair Record Sale form labels (A11Y-03, A11Y-07)

## A11Y-03 Cumulative Coverage — 10/10 modals migrated

| Modal | Plan | Size | Notes |
|-------|------|------|-------|
| PrintQuoteModal | 19-04 | lg | |
| SettingsModal | 19-04 | lg | Lost top-right anchor |
| UserProfileModal | 19-04 | md | Lost top-right anchor |
| CustomerEditModal | 19-04 | md | Form labels paired (A11Y-07 half) |
| MaintenanceAlertModal | 19-04 | md | `onDismiss` prop preserved |
| CustomerCsvImportModal | 19-05 | xl | Back-arrow button preserved in title prop |
| DeclineQuoteModal | 19-05 | md | |
| CsvImportModal | 19-05 | xl | Back-arrow button preserved in title prop |
| Record Sale (JobsManager) | 19-05 | md | Form labels paired (A11Y-07 half) |
| Delete Job confirm (JobsManager) | 19-05 | sm | Gained X close button (D-18 UX bump) |
| Delete Sale confirm (JobsManager) | 19-05 | sm | Gained X close button (D-18 UX bump) |

Count is 11 entries because the 3 JobsManager overlays were inline (not separate files). The "10 of 10 surfaces" count tracks surface-level migration. All 10 distinct modal *surfaces* now consume Modal.

## LOC Delta

| File | LOC Δ |
|------|-------|
| CustomerCsvImportModal.tsx | -29 |
| DeclineQuoteModal.tsx | -32 |
| CsvImportModal.tsx | -32 |
| JobsManager.tsx | -10 / +30 (net +20 from useId + htmlFor pairings; 9 `useId()` + 9 `htmlFor`/`id` + 3 Modal wrappers offset by deleted overlay chrome) |

## JobsManager Record Sale — 9 useId() pairings

| Field | useId variable | Pairing |
|-------|---------------|---------|
| Quantity | `saleQuantityId` | label `htmlFor` + Input `id` |
| Price/Unit | `salePriceId` | label `htmlFor` + Input `id` |
| Name | `saleCustomerNameId` | label `htmlFor` + Input `id` |
| Email | `saleCustomerEmailId` | label `htmlFor` + Input `id` |
| Company | `saleCustomerCompanyId` | label `htmlFor` + Input `id` |
| Address | `saleCustomerAddressId` | label `htmlFor` + Textarea `id` |
| Notes | `saleCustomerNotesId` | label `htmlFor` + Textarea `id` |
| Method | `saleShippingMethodId` | label `htmlFor` + Select `id` |
| Cost ($) | `saleShippingCostId` | label `htmlFor` + Input `id` |

Existing customer-picker combobox at line ~1845 already had `htmlFor="customer-picker-input"` + `id="customer-picker-input"` — unchanged.

## Public API — Unchanged

All consumer-facing prop APIs preserved:
- CustomerCsvImportModal: `{ isOpen, existingCustomers, onImportCustomers, onClose }`
- DeclineQuoteModal: `{ quote, onConfirm, onClose }`
- CsvImportModal: `{ isOpen, onClose, existingAssets, onImportAssets }`
- JobsManager: unchanged

## D-17 Banner Preservation

The `convertingFromQuote && (...)` blue helper banner above the Record Sale form is preserved as a Modal child (D-17 — contextual content, not a subtitle). Renders inside the Modal body before the form grid.

## D-18 Close-Button UX Bump

The 2 Delete confirms (Delete Job, Delete Sale) previously had no X close button. Now they auto-render Modal's X with `aria-label="Close"`. This is the documented UX bump from D-18 — a strict improvement (4 close paths instead of 3: Escape, backdrop, X, Cancel button).

## Phase 22 Boundary Preserved

No extraction of `RecordSaleModal`, `SaleRow`, or `useCustomerPicker` — left for Phase 22 per D-19. JobsManager still owns all sale-form state and the customer picker logic.

## Test File Adjustment

`DeclineQuoteModal.test.tsx` updated: queries via `document.body.querySelector(...)`; the "renders nothing when quote is null" assertion now checks `document.querySelector('[role="dialog"]')` is null (Modal renders nothing when isOpen=false; can't compare full `document.body.textContent` because the test container is appended there).

## Verification

- `npx tsc -b` exit 0 ✓
- `npx vitest run` exit 0 ✓ (21 files, 301 tests passing, 1 todo)
- Grep checks: `<Modal` count 3 in JobsManager.tsx; `useId()` count 9; `htmlFor=` count 10 (9 new + 1 pre-existing); `fixed inset-0 bg-black/50` count 0; `convertingFromQuote` count 8 (banner + handler refs preserved); `title="Delete Job"` and `title="Delete Sale"` both 1 ✓

## Deviations

None. The plan's title-with-Back-button special case (CustomerCsvImportModal, CsvImportModal) was solved by passing a ReactNode title — Modal's `title: ReactNode` API accepts the back-button as part of the title.

## Self-Check: PASSED
