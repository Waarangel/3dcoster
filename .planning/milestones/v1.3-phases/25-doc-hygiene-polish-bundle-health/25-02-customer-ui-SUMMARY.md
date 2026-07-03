---
phase: 25-doc-hygiene-polish-bundle-health
plan: "02"
subsystem: customer-ui
tags: [polish, css, csv-template, tailwind, customer-library]
dependency_graph:
  requires: []
  provides: [generateSampleCustomerCsv, customer-row-vertical-center]
  affects: [src/components/CustomerLibrary.tsx, src/components/CustomerCsvImportModal.tsx, src/utils/csvHelpers.ts]
tech_stack:
  added: []
  patterns: [papaparse-unparse, downloadCsv-blob-pattern, tailwind-items-center]
key_files:
  created: []
  modified:
    - src/components/CustomerLibrary.tsx
    - src/components/CustomerCsvImportModal.tsx
    - src/utils/csvHelpers.ts
decisions:
  - POL-01 used parent-class change (items-start → items-center) rather than per-child self-center; simpler and achieves identical result
  - POL-02 placed template download block after drop zone, before column-reference text; mirrors CsvImportModal placement style
  - POL-02 template button uses Button primitive with variant="ghost" btnSize="sm" matching CsvImportModal sibling pattern
  - No test file added (csvHelpers.test.ts does not exist; test scaffolding is Phase 23 scope)
  - No NewBadge or features.ts entry (Phase 25 hardening-only rule)
metrics:
  duration_minutes: 25
  completed: "2026-05-26T01:24:43Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 25 Plan 02: Customer UI Polish Summary

Customer-UI polish batch closing POL-01 and POL-02: CustomerLibrary "Last used" vertical centering + CustomerCsvImportModal template-download button backed by new `generateSampleCustomerCsv()` helper.

## What Was Built

### Task 1: POL-01 — CustomerLibrary row vertical centering (commit e316d0f)

**Before:**
```tsx
<div className="flex items-start justify-between gap-3">
```
**After:**
```tsx
<div className="flex items-center justify-between gap-3">
```

Single class change on the outer flex container in `CustomerRowItem` (line 48 of `CustomerLibrary.tsx`). The "Last used" text cell (hidden on mobile, visible on sm+) now vertically aligns with the Edit/Delete action buttons. The customer name/subline block at `flex-1` stretches to fill vertical space, which is the intended layout.

The skeleton row at line 330 (inside `CustomerListSkeleton`) retains `items-start` — that's a loading placeholder and not part of POL-01 scope. Its alignment is inconsequential since it's replaced by real rows.

### Task 2: POL-02 — generateSampleCustomerCsv() + template-download button (commit 38fd22e)

**csvHelpers.ts** — inserted before `generateSampleCsv()` (lines ~67 in original):

```typescript
const CUSTOMER_COLUMNS = ['name', 'email', 'company', 'address', 'notes'] as const;

export function generateSampleCustomerCsv(): string {
  return Papa.unparse({
    fields: [...CUSTOMER_COLUMNS],
    data: [
      ['Jane Smith', 'jane@example.com', 'Acme Co', '123 Main St', 'Repeat buyer'],
      ['Bob Jones', 'bob@example.com', '', '', ''],
    ],
  });
}
```

**CustomerCsvImportModal.tsx** — added import and template button block in UploadStep (after drop zone div, before column-reference `<p>`):

```typescript
import { generateSampleCustomerCsv, downloadCsv } from '../utils/csvHelpers';
```

```tsx
{/* Template download */}
<div className="bg-slate-700/50 rounded-lg p-3">
  <p className="text-sm text-slate-300 mb-2">Download a sample template to get started:</p>
  <Button
    type="button"
    variant="ghost"
    btnSize="sm"
    onClick={() => downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv')}
    className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
  >
    Customer template
  </Button>
</div>
```

**Downloaded customer-template.csv contents:**
```
name,email,company,address,notes
Jane Smith,jane@example.com,Acme Co,123 Main St,Repeat buyer
Bob Jones,bob@example.com,,,
```

Header row + 2 data rows (confirmed via node + papaparse local verify). Second row demonstrates optional fields (company, address, notes) with empty strings.

**No test file added** — `src/utils/csvHelpers.test.ts` does not exist in the codebase. Per plan and Phase 23 scope rules, no new test file was scaffolded.

## Verification Results

| Check | Result |
|-------|--------|
| `tsc -b` exits 0 | PASS |
| `items-center justify-between gap-3` in CustomerLibrary.tsx | PASS |
| `export function generateSampleCustomerCsv` in csvHelpers.ts | PASS |
| `generateSampleCustomerCsv` imported in CustomerCsvImportModal.tsx | PASS |
| `customer-template.csv` literal in CustomerCsvImportModal.tsx | PASS |
| No `features.ts` entry added | PASS |
| No `<NewBadge>` JSX added | PASS |
| Unexpected file deletions | None |

Manual UAT (captured for traceability): Clicking the "Customer template" button in the CustomerCsvImportModal UploadStep triggers `downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv')`. The download produces a CSV with the exact contents shown above. The file opens in spreadsheet apps with 5 columns matching the modal's column-reference text. (Cannot verify in headless agent context — relies on `downloadCsv` being the already-tested blob-pattern helper.)

## Deviations from Plan

None — plan executed exactly as written.

The plan mentioned noting whether `items-start` on the outer container would affect the name/subline block. It does not: the name block uses `flex-1 min-w-0` which stretches to fill the container's cross-axis height regardless of `items-center`; the visual character is unchanged. Preferred approach (parent-class change) was used.

## Threat Flags

None — POL-01 is CSS-only (no new security surface). POL-02 reuses the fully-tested `downloadCsv` blob pattern with hard-coded literal content (zero user-input flows into the CSV template). T-25-02-01/02/03 threats from the plan's threat model are all accepted/mitigated without new surface introduction.

## Self-Check: PASSED

- `src/components/CustomerLibrary.tsx` — modified, verified `items-center` present at line 48
- `src/utils/csvHelpers.ts` — modified, `generateSampleCustomerCsv` exported
- `src/components/CustomerCsvImportModal.tsx` — modified, template button wired
- Commits: e316d0f (POL-01) and 38fd22e (POL-02) both in `git log`
