---
status: partial
phase: 21-csv-url-security
source: [21-VERIFICATION.md]
started: 2026-05-27T09:18:00Z
updated: 2026-05-27T09:18:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CSV formula-injection — external spreadsheet render
expected: Export a customer CSV containing a customer named `=HYPERLINK("https://example.com","click")`; open the exported file in Excel / Numbers / LibreOffice Calc. The cell shows the literal string (with the leading single-quote stripped by the spreadsheet's text-cell convention) — NOT a clickable hyperlink. No formula execution.
result: [pending]

### 2. `javascript:` Model URL render-guard — live browser
expected: In the calculator (dev server on port 4173), enter `javascript:alert(1)` (and `data:text/html,<script>alert(1)</script>`) as a job's Model URL; save; navigate to Jobs and expand the job card. The Model source row shows the URL as plain muted text (slate-400, no underline) with a hover tooltip reading `Link blocked: must start with http:// or https://`. Clicking the text does NOT navigate, does NOT execute the payload, does NOT show an alert dialog.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
