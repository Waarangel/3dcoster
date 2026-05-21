---
status: resolved
phase: 13-tax-model-ui-sweep
source: [13-VERIFICATION.md]
started: 2026-05-21T13:35:00Z
updated: 2026-05-21T13:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Default Tax Rate field renders below Default Profit Margin
expected: Open Settings → Costs & Rates tab. Confirm a "Default Tax Rate" h3 with a NEW badge appears below "Default Profit Margin". On a fresh profile the field placeholder shows the region default (e.g., "20" for GBP/EUR/AUD users) with a caption "Region default: X% — leave blank to inherit." beneath. Type "20", close/reopen Settings — value persists. Clearing writes `undefined` and reverts to the region placeholder.
result: pass — fixed 2026-05-21: Settings field now shows region default as placeholder with explanatory caption.

### 2. Per-job Tax Rate Input pre-populates from chain
expected: In the calculator, the per-job Tax Rate input placeholder shows the inherited rate (Settings default → region → manual fallback). User who's happy with the inherited rate doesn't type. Setting an override + saving + reopening round-trips correctly.
result: pass — fixed 2026-05-21: input placeholder shows `inheritedTaxRate` from chain (without the override). User sees what they'd get if they leave it blank.

### 3. Tax row hides at 0% (and is visible when inheriting)
expected: When tax.ratePercent === 0 (USD region with no overrides), the Tax row + "Total (with Tax)" row are absent. When the per-job field is blank but Settings/region has a default > 0, the Tax row appears using the inherited rate — caption "(Settings default)" or "(UK region)" makes the source visible.
result: pass — fixed 2026-05-21: inline source caption added next to rate so "blank field but tax row showing" now reads as "(UK region)" or "(Settings default)" — provenance is no longer hidden.

### 4. Fallback chain visual verification — tooltip + inline source
expected: Tax row now carries TWO source signals — (a) inline caption next to rate: "(per-job override)" / "(Settings default)" / "(UK region)" / "(EU midpoint)" / "(manual)"; (b) brighter InfoTooltip icon (slate-400, w-4) hovers for the full sentence including rateAsOf date + US marketplace-facilitator note.
result: pass — fixed 2026-05-21: added `labelForSource` inline caption + bumped InfoTooltip from slate-500/w-3.5 to slate-400/w-4.

### 5. Set Financial Targets grid layout (4 columns on md+)
expected: Resize browser to ≥768px width. Open the cost calculator. The Set Financial Targets section shows 4 equal-width columns: Profit Margin, Target Profit, Selling Price, Tax Rate. Below 768px it stacks to 1 column.
result: pass — approved by user 2026-05-21.

### 6. NewBadge `default-tax-rate` renders + does NOT push siblings
expected: On a fresh install/localStorage, open Settings → Costs & Rates. A "NEW" badge appears next to the "Default Tax Rate" h3 text and does NOT push the h3 text to wrap or shift the field below. Badge positioned absolutely top-right of the h3; h3 text and field below remain in their natural position.
result: pass — approved by user 2026-05-21.

### 7. Stale NewBadge sites no longer render
expected: On a fresh install (or clean localStorage), open these surfaces and confirm no "NEW" badges appear: Cost calculator licensing checkbox, Cost calculator author min price label, Packaging Materials section, AssetLibrary CSV import button, AssetLibrary packaging category dropdown, GcodeImport drop-zone, UserProfileModal Currency label. Zero "NEW" badges on these surfaces.
result: pass — approved by user 2026-05-21.

### 8. UI-08 compact width visual consistency
expected: Visually compare numeric inputs across swept forms (AssetLibrary, JobsManager Record Sale, PrinterSettings Add/Edit, SettingsModal, CostCalculator Materials/Shipping/Carrier). Numeric inputs are visibly narrower than text inputs (capped at max-w-28 = 112px). Customer Name / Asset Name / other text inputs remain wide per D-14. The new per-job Tax Rate Input is wide per UI-SPEC line 188 (primary financial inputs stay wide).
result: pass — approved by user 2026-05-21.

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
