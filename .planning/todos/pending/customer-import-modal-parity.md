---
created: 2026-05-28
title: Customer Import modal — match Asset Import modal layout
area: ui
severity: minor
source: 21-HUMAN-UAT.md out-of-scope finding
files:
  - src/components/CustomerCsvImportModal.tsx
  - src/components/CsvImportModal.tsx
---

# Customer Import modal — match Asset Import modal layout parity

Discovered during Phase 21 HUMAN-UAT (2026-05-28). Two import modals use the
same building blocks but different layout/visual rhythm, making the customer
template harder to find than the asset templates.

## Current state

**`CsvImportModal.tsx` (Assets)** — `Import Assets from CSV`:

```
┌──────────────────────────────────────┐
│ Download a sample template to get started:
│ [📦 Materials template]  [🖨️ Printers template]
├──────────────────────────────────────┤
│  ☁ Drop .csv file here or click...   │
│  (large dashed upload zone)          │
└──────────────────────────────────────┘
```

**`CustomerCsvImportModal.tsx` (Customers)** — `Import customers from CSV`:

```
┌──────────────────────────────────────┐
│  ☁ Drop a .csv file here or click... │
│  (large dashed upload zone)          │
├──────────────────────────────────────┤
│ Download a sample template to get started:
│ [Customer template]   ← plain text, no icon
└──────────────────────────────────────┘
```

## What to fix

In `src/components/CustomerCsvImportModal.tsx`:

1. **Move** the "Template download" block (currently lines 300-310) to appear
   ABOVE the upload zone (lines 281-298), matching the asset-modal ordering.
2. **Add an emoji prefix** to the "Customer template" button label — e.g.
   `👤 Customer template` or `📇 Customer template`. Match the visual weight
   of `📦 Materials template` / `🖨️ Printers template` in the asset modal.
3. (Optional) Use the same wrapper container styles so the two modals are
   visually interchangeable.

No functional change to `generateSampleCustomerCsv` or `downloadCsv` — UI
shape only.

## Acceptance criteria

- `Import customers from CSV` modal renders template section ABOVE the drop
  zone (matches asset modal ordering)
- Customer template button label has an emoji prefix
- `CustomerCsvImportModal.test.tsx` still passes (button selector may need
  updating if the label text changed)
- `npx tsc -b` exits 0
- Visual diff with asset modal: same vertical layout, same template-block
  styling

## Not in scope

- Customer CSV **export** functionality (separate backlog — see
  `21-HUMAN-UAT.md` Test 1 skip reason)
- Preview / dedup-mode UX differences (already different by design — assets
  don't dedup, customers do)
