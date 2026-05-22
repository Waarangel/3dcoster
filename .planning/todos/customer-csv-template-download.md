---
created: 2026-05-22
title: Customer CSV import — add template download link
area: ui
origin: Phase 15.1 UAT (Plan 15.1-05 Task 3, step 4)
files:
  - src/components/CustomerCsvImportModal.tsx
  - src/utils/customerCsv.ts (may need a generateSampleCustomerCsv() helper)
references:
  - src/components/CsvImportModal.tsx:265-285 (existing template-download pattern for materials/printers)
  - src/utils/csvHelpers.ts (downloadCsv + generateSampleCsv helpers)
---

# Customer CSV import — add template download link

`CustomerCsvImportModal.tsx` currently opens straight into the dropzone. The sibling `CsvImportModal.tsx` (assets) renders "Download a sample template to get started" with one-click downloads for Materials and Printers templates. UAT noted this asymmetry — users dropping into the customer importer cold don't know the column order (`name,email,company,address,notes`) without reading the inline guidance.

## What to add

A template download link above (or beside) the dropzone in `CustomerCsvImportModal.tsx`:

```jsx
<button onClick={() => downloadCsv(generateSampleCustomerCsv(), '3dcoster-customers-template.csv')}>
  👤 Customers template
</button>
```

## What the template should contain

Header row + 2-3 sample rows that demonstrate the supported columns and the optional fields:

```csv
name,email,company,address,notes
Alice Example,alice@example.com,Acme Co,123 Main St,VIP customer
Bob Sample,bob@sample.com,,,
,carol@only-email.com,,,
```

## Implementation notes

- Add `generateSampleCustomerCsv()` to `src/utils/customerCsv.ts` (or extend the existing `generateSampleCsv` switch in `src/utils/csvHelpers.ts` with a `'customer'` case).
- The `downloadCsv` helper already exists — reuse it.
- Keep the button style consistent with the materials/printers template buttons.

## Why this matters

The Plan 03 CSV importer accepts the format documented in `15.1-CONTEXT.md` (D-08, D-09) and validated by `parseCustomerCsv()`, but discoverability is poor without a one-click template. Asset Library set the precedent — Customer Library should match.

## Sizing

Small. ~30-50 LOC across `customerCsv.ts` + `CustomerCsvImportModal.tsx`. Could be folded into a v1.2 polish phase or shipped standalone.
