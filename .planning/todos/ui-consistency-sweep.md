---
created: 2026-05-20
title: UI Consistency Sweep — Apply rules everywhere
area: ui
resolves_phase: [13, 14]
files:
  - src/components/CostCalculator.tsx
  - src/components/AssetLibrary.tsx
  - src/components/JobsManager.tsx
  - src/components/PrinterSettings.tsx
  - src/components/CsvImportModal.tsx
  - src/components/BambuImport.tsx
  - src/components/GcodeImport.tsx
  - src/features.ts
---

# UI Consistency Sweep — Apply rules everywhere

These items extend the rules we codified in MEMORY:
- [Narrow currency/numeric inputs](../../.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/feedback_narrow_currency_inputs.md) — use Input `compact`
- [Info icon over descriptive placeholder](../../.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/feedback_info_icon_over_placeholder.md) — use InfoTooltip
- [User-facing only NEW badges](../../.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md#new-badge-requirement) — features.ts hygiene

Bundle these into a "polish sweep" pre-v1.2 OR fold each into the relevant feature phase.

---

## Compact prop rollout (5 components)

- [x] **CostCalculator** — per-filament price override inputs in the filament rows; selling-price / target-profit / profit-margin pricing inputs; shipping override cost; failure-rate row (already compact? verify)
<!-- audited 2026-05-25: verified at CostCalculator.tsx:809,840,919,932,946,960,1004,1056,1077 -->
- [x] **AssetLibrary** — unit cost, package cost, units-per-package, wattage, purchase price, lifespan hours, nozzle cost, nozzle lifespan inputs in the asset edit form
<!-- audited 2026-05-25: verified at AssetLibrary.tsx:953,964,975,986,996,1021,1032,1046 -->
- [x] **JobsManager** — sale price input in record-sale modal; shipping override input (if present)
<!-- audited 2026-05-25: verified at JobsManager.tsx:1796,1806,1960 -->
- [x] **PrinterSettings** — wattage, purchase price, expected lifespan hours, nozzle cost, nozzle lifespan inputs in the printer add/edit form
<!-- audited 2026-05-25: verified at PrinterSettings.tsx:138,157,187,288,297,322 -->
- [ ] **CsvImportModal / BambuImport / GcodeImport** — any numeric fields these expose during the import flow
<!-- audited 2026-05-25: still open — these components expose file upload UI only (no numeric Input fields found); subtask may be N/A -->

Pattern: `<Input type="number" compact ... />` — caps at max-w-28 (112px).

## InfoTooltip rollout (replace descriptive placeholders)

- [x] **CostCalculator** — replace any remaining "Slicing, bed prep, etc." style placeholders with example values + `<InfoTooltip text="..." />` on the label
<!-- audited 2026-05-25: verified at CostCalculator.tsx:793,835,942,956,1052,1435 — InfoTooltip in use -->
- [x] **AssetLibrary** — fields like "Brand", "Notes", "Tags" if their placeholders contain instructions; the printer-specific lifespan fields commonly have descriptive placeholders
<!-- audited 2026-05-25: verified at AssetLibrary.tsx:1042 — InfoTooltip in use -->
- [x] **PrinterSettings** — nozzle / lifespan fields often need explanation (e.g., "Manufacturer rated hours"); move to tooltip
<!-- audited 2026-05-25: verified at PrinterSettings.tsx:153,166,183 — InfoTooltip in use for purchase price, recovery months, hours/month -->
- [ ] **JobsManager** — sale form's customer name, channel, notes — confirm what's a hint vs an example
<!-- audited 2026-05-25: still open — no InfoTooltip usages found in JobsManager.tsx -->
- [ ] **UserProfileModal** — address hints (city/province/postal placeholders are fine as examples; keep as-is)
<!-- audited 2026-05-25: still open — placeholders are example values (Your name, 123 Main St, etc.); per todo, keep as-is; subtask may be N/A -->

Pattern: label → `<InfoTooltip text="explanation" />` → NewBadge (if any). Placeholders become bare example values.

## features.ts cleanup (dead NewBadge JSX)

- [x] **Remove dead `<NewBadge>` call sites** — 10 entries past the 14-day MAX_AGE window will never render. JSX still in source:
<!-- audited 2026-05-25: dead JSX confirmed ALREADY REMOVED — Phase 13 pruned features.ts from 12 to 4 entries; none of the listed call sites (per-unit-licensing, author-min-price, csv-import, gcode-import, 3mf-import, multi-currency, packaging-materials, configurable-marketplace-fees, custom-carriers) exist in src/ as of 2026-05-25. Current features.ts has 10 entries all within 14-day window. No removal needed. -->
  - `<NewBadge feature="per-unit-licensing" />` in CostCalculator
  - `<NewBadge feature="author-min-price" />` in CostCalculator
  - `<NewBadge feature="csv-import" />` in AssetLibrary or wherever
  - `<NewBadge feature="gcode-import" />` in GcodeImport
  - `<NewBadge feature="3mf-import" />` in GcodeImport
  - `<NewBadge feature="multi-currency" />` in UserProfileModal
  - `<NewBadge feature="packaging-materials" />` (2 sites) in AssetLibrary
  - `<NewBadge feature="configurable-marketplace-fees" />` indirectly via SettingsModal tabs (already pruned from tabs array, verify)
  - `<NewBadge feature="custom-carriers" />` indirectly via SettingsModal tabs (already pruned, verify)
- [x] **Also prune `features.ts` entries** for keys with zero JSX consumers post-cleanup
<!-- audited 2026-05-25: all 10 current features.ts entries have active JSX consumers; prune step N/A -->

Run `node` audit: for each key in features.ts, grep src/ for `feature=["']<key>["']` AND for the key in array literals. If zero hits → remove from features.ts. If hits exist but feature is past MAX_AGE → leave entry, remove JSX.

## Uniform-width chunks in flex-wrap layouts

- [ ] **Apply `min-w-[160px]` (or similar) to flex-wrap chunk containers** wherever currency/numeric inputs sit side-by-side with mixed-length labels. Today: applied in CostCalculator Print Job Details (this session). Future: any new flex-wrap form section.
<!-- audited 2026-05-25: still open — structural work; not audited exhaustively per D-06 spot-check guidance -->

## Settings/Profile reorg follow-ups

- [ ] **PrinterSettings** could use a similar visual refresh — the printer add/edit form is the next dense form needing the compact-input + InfoTooltip + flex-wrap treatment
<!-- audited 2026-05-25: still open — compact + InfoTooltip confirmed shipped in PrinterSettings; flex-wrap structural refresh not yet applied -->

---

*Created: 2026-05-20*
