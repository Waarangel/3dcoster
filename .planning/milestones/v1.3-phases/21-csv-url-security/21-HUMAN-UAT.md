---
status: complete
phase: 21-csv-url-security
source: [21-VERIFICATION.md]
started: 2026-05-27T09:18:00Z
updated: 2026-05-28T16:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. CSV formula-injection — external spreadsheet render
expected: Export a customer CSV containing a customer named `=HYPERLINK("https://example.com","click")`; open the exported file in Excel / Numbers / LibreOffice Calc. The cell shows the literal string (with the leading single-quote stripped by the spreadsheet's text-cell convention) — NOT a clickable hyperlink. No formula execution.
result: skipped
reason: "Customer CSV export feature does not exist in the codebase. Phase 21 SC#5 named a UAT test for an unbuilt feature — only assets export (`generateExportCsv(assets)`) shipped, with sanitization hardening. User deprioritized adding customer export right now (2026-05-28). The sanitization helper itself (`sanitizeCsvCell`) is regression-locked at the unit-test layer (csvHelpers.test.ts + customerCsv.test.ts) — defense-in-depth preserved even without the export path."
follow_up: "Backlog item — add customer CSV export when needed; route through `sanitizeCsvCell` at the Papa.unparse boundary per D-02."

### 2. `javascript:` Model URL render-guard — live browser
expected: In the calculator (dev server on port 4173), enter `javascript:alert(1)` (and `data:text/html,<script>alert(1)</script>`) as a job's Model URL; save; navigate to Jobs and expand the job card. The Model source row shows the URL as plain muted text (slate-400, no underline) with a hover tooltip reading `Link blocked: must start with http:// or https://`. Clicking the text does NOT navigate, does NOT execute the payload, does NOT show an alert dialog.
result: pass
verified_on: 2026-05-28

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

(none — Test 1 skipped with reason, Test 2 passed)

## Out-of-scope findings

Discovered during UAT but not in Phase 21 scope — captured for follow-up:

- **Customer Import modal layout parity:** `CustomerCsvImportModal.tsx` renders the "Customer template" download section BELOW the upload zone with no icon prefix. `CsvImportModal.tsx` (Assets) renders the equivalent section ABOVE the upload zone with emoji-prefixed buttons (📦 Materials template, 🖨️ Printers template). Visual rhythm is inconsistent across the two import modals. Polish — see `.planning/todos/pending/customer-import-modal-parity.md`.
