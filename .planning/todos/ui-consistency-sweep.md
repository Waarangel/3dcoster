# UI Consistency Sweep — Apply rules everywhere

These items extend the rules we codified in MEMORY:
- [Narrow currency/numeric inputs](../../.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/feedback_narrow_currency_inputs.md) — use Input `compact`
- [Info icon over descriptive placeholder](../../.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/feedback_info_icon_over_placeholder.md) — use InfoTooltip
- [User-facing only NEW badges](../../.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md#new-badge-requirement) — features.ts hygiene

Bundle these into a "polish sweep" pre-v1.2 OR fold each into the relevant feature phase.

---

## Compact prop rollout (5 components)

- [ ] **CostCalculator** — per-filament price override inputs in the filament rows; selling-price / target-profit / profit-margin pricing inputs; shipping override cost; failure-rate row (already compact? verify)
- [ ] **AssetLibrary** — unit cost, package cost, units-per-package, wattage, purchase price, lifespan hours, nozzle cost, nozzle lifespan inputs in the asset edit form
- [ ] **JobsManager** — sale price input in record-sale modal; shipping override input (if present)
- [ ] **PrinterSettings** — wattage, purchase price, expected lifespan hours, nozzle cost, nozzle lifespan inputs in the printer add/edit form
- [ ] **CsvImportModal / BambuImport / GcodeImport** — any numeric fields these expose during the import flow

Pattern: `<Input type="number" compact ... />` — caps at max-w-28 (112px).

## InfoTooltip rollout (replace descriptive placeholders)

- [ ] **CostCalculator** — replace any remaining "Slicing, bed prep, etc." style placeholders with example values + `<InfoTooltip text="..." />` on the label
- [ ] **AssetLibrary** — fields like "Brand", "Notes", "Tags" if their placeholders contain instructions; the printer-specific lifespan fields commonly have descriptive placeholders
- [ ] **PrinterSettings** — nozzle / lifespan fields often need explanation (e.g., "Manufacturer rated hours"); move to tooltip
- [ ] **JobsManager** — sale form's customer name, channel, notes — confirm what's a hint vs an example
- [ ] **UserProfileModal** — address hints (city/province/postal placeholders are fine as examples; keep as-is)

Pattern: label → `<InfoTooltip text="explanation" />` → NewBadge (if any). Placeholders become bare example values.

## features.ts cleanup (dead NewBadge JSX)

- [ ] **Remove dead `<NewBadge>` call sites** — 10 entries past the 14-day MAX_AGE window will never render. JSX still in source:
  - `<NewBadge feature="per-unit-licensing" />` in CostCalculator
  - `<NewBadge feature="author-min-price" />` in CostCalculator
  - `<NewBadge feature="csv-import" />` in AssetLibrary or wherever
  - `<NewBadge feature="gcode-import" />` in GcodeImport
  - `<NewBadge feature="3mf-import" />` in GcodeImport
  - `<NewBadge feature="multi-currency" />` in UserProfileModal
  - `<NewBadge feature="packaging-materials" />` (2 sites) in AssetLibrary
  - `<NewBadge feature="configurable-marketplace-fees" />` indirectly via SettingsModal tabs (already pruned from tabs array, verify)
  - `<NewBadge feature="custom-carriers" />` indirectly via SettingsModal tabs (already pruned, verify)
- [ ] **Also prune `features.ts` entries** for keys with zero JSX consumers post-cleanup

Run `node` audit: for each key in features.ts, grep src/ for `feature=["']<key>["']` AND for the key in array literals. If zero hits → remove from features.ts. If hits exist but feature is past MAX_AGE → leave entry, remove JSX.

## Uniform-width chunks in flex-wrap layouts

- [ ] **Apply `min-w-[160px]` (or similar) to flex-wrap chunk containers** wherever currency/numeric inputs sit side-by-side with mixed-length labels. Today: applied in CostCalculator Print Job Details (this session). Future: any new flex-wrap form section.

## Settings/Profile reorg follow-ups

- [ ] **PrinterSettings** could use a similar visual refresh — the printer add/edit form is the next dense form needing the compact-input + InfoTooltip + flex-wrap treatment

---

*Created: 2026-05-20*
