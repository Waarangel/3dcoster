---
status: partial
phase: 13-tax-model-ui-sweep
source: [13-VERIFICATION.md]
started: 2026-05-21T13:35:00Z
updated: 2026-05-21T13:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Default Tax Rate field renders below Default Profit Margin
expected: Open Settings → Costs & Rates tab. Confirm a "Default Tax Rate" h3 with a NEW badge appears below "Default Profit Margin", and the field starts empty (placeholder "e.g., 20") on a fresh profile. Type "20", close/reopen Settings — value persists across modal close/reopen and across full app reload (IndexedDB-backed). Clearing the field writes `undefined`, not `0` (next reopen shows empty, not "0").
result: [pending]

### 2. Per-job Tax Rate Input round-trip
expected: In the calculator, set sellingPrice=10, per-job Tax Rate=20%, save the job. Reopen the saved job via JobsManager. The per-job Tax Rate input shows "20" on reopen. The Tax row shows "Tax (20.0%) $2.00" and Total (with Tax) = $12.00.
result: [pending]

### 3. Tax row hides at 0%
expected: Clear the per-job Tax Rate input. Confirm no Settings default is configured. Confirm currency is USD (region rate = 0%). The Tax row + "Total (with Tax)" row are completely absent from the Cost Breakdown when `tax.ratePercent === 0`.
result: [pending]

### 4. Fallback chain visual verification — tooltip provenance
expected: Hover the Tax row's info icon under the four scenarios — (1) per-job override set → tooltip says "Per-job override — X%"; (2) clear override, Settings default set → "From Settings default — X%"; (3) clear both, currency=EUR → "EU midpoint rate — verify for your country (21%)"; (4) clear both, currency=USD → tooltip starts with "From your region (US..." AND contains "marketplaces (Etsy, eBay, Amazon)" (D-11). USD case appends the marketplace-facilitator note when source.kind != region.
result: [pending]

### 5. Set Financial Targets grid layout (4 columns on md+)
expected: Resize browser to ≥768px width. Open the cost calculator. The Set Financial Targets section shows 4 equal-width columns: Profit Margin, Target Profit, Selling Price, Tax Rate. Below 768px it stacks to 1 column.
result: [pending]

### 6. NewBadge `default-tax-rate` renders + does NOT push siblings
expected: On a fresh install/localStorage, open Settings → Costs & Rates. A "NEW" badge appears next to the "Default Tax Rate" h3 text and does NOT push the h3 text to wrap or shift the field below. Badge positioned absolutely top-right of the h3; h3 text and field below remain in their natural position.
result: [pending]

### 7. Stale NewBadge sites no longer render
expected: On a fresh install (or clean localStorage), open these surfaces and confirm no "NEW" badges appear: Cost calculator licensing checkbox, Cost calculator author min price label, Packaging Materials section, AssetLibrary CSV import button, AssetLibrary packaging category dropdown, GcodeImport drop-zone, UserProfileModal Currency label. Zero "NEW" badges on these surfaces.
result: [pending]

### 8. UI-08 compact width visual consistency
expected: Visually compare numeric inputs across swept forms (AssetLibrary, JobsManager Record Sale, PrinterSettings Add/Edit, SettingsModal, CostCalculator Materials/Shipping/Carrier). Numeric inputs are visibly narrower than text inputs (capped at max-w-28 = 112px). Customer Name / Asset Name / other text inputs remain wide per D-14. The new per-job Tax Rate Input is wide per UI-SPEC line 188 (primary financial inputs stay wide).
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
