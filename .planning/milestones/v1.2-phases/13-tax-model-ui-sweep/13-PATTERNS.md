# Phase 13: Tax Model + UI Sweep - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 12 (3 new + 9 modified)
**Analogs found:** 12 / 12 — every new and modified file has a strong in-repo analog. No "research-only" fallbacks.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/costCalc.ts` (MODIFY — append `calculateTax`) | util — pure math | transform (scalar → scalar) | `calculateLabor` in same file (`src/utils/costCalc.ts:104-111`) | exact (same file, sibling shape) |
| `src/utils/costCalc.test.ts` (MODIFY — activate `it.todo`) | test | unit test (Vitest) | `describe('calculateLabor', ...)` (already in same file) and sibling describe blocks at `src/utils/costCalc.test.ts:108-156` | exact |
| `src/utils/taxResolution.ts` (NEW) | util — pure logic + types | transform (input record → discriminated union) | `src/utils/costCalc.ts` (pure-util convention) + the existing `Currency` discriminator pattern in `src/types.ts:12-30` | role-match (no existing discriminated-union resolver in the project; closest sibling is the typed-input-to-typed-output `calculateCost` orchestrator at `src/utils/costCalc.ts:124-184`) |
| `src/utils/taxResolution.test.ts` (NEW) | test | unit test (Vitest) | `src/utils/costCalc.test.ts` (same Vitest setup, fixture-builder pattern) | exact |
| `src/data/taxRates.ts` (NEW) | data — static export | data-only (no functions) | `src/data/bambuFilaments.ts` (typed `readonly` array of objects, header comment with provenance) | exact |
| `src/components/SettingsModal.tsx` (MODIFY — Default Tax Rate field + migrate 3 descriptive `<p>` → InfoTooltip + sweep) | component — page section | request-response (props in, callbacks out) | `Default Profit Margin` block in same file (`SettingsModal.tsx:237-261`) | exact (same tab, sibling block) |
| `src/components/CostCalculator.tsx` (MODIFY — per-job Tax Rate input + Tax/Total row + UI sweep + NewBadge removal) | component — calculator | event-driven (form edits → useMemo recompute → save) | (a) **per-job Tax Rate input**: `Profit Margin` field at `CostCalculator.tsx:1150-1164` (wide, `pl-8`, `%` prefix overlay); (b) **Tax/Total row**: Subtotal+Failure block at `CostCalculator.tsx:1294-1303` and "Cost Per Unit" total at `:1305-1313`; (c) **label-with-InfoTooltip-and-NewBadge**: Model URL label at `CostCalculator.tsx:710-713`; (d) **save persistence**: `handleSaveJob` update/create paths at `CostCalculator.tsx:506-558` | exact (multiple in-file analogs) |
| `src/components/AssetLibrary.tsx` (MODIFY — sweep 7 numeric inputs, migrate "For reusable items" placeholder, remove 2 NewBadge sites) | component — list/form | CRUD form | `Default Profit Margin` Input pattern (`SettingsModal.tsx:244-256`) for `compact` + step + `value ?? ''`; `InfoTooltip` label pattern from `CostCalculator.tsx:861-863` | exact |
| `src/components/JobsManager.tsx` (MODIFY — sweep 3 Record Sale numeric inputs) | component — list/modal | CRUD form | Sibling Sale Quantity/Price inputs at `JobsManager.tsx:540-555` (compare to `SettingsModal.tsx:243-256` for the target shape) | exact |
| `src/components/PrinterSettings.tsx` (MODIFY — sweep 6 numeric inputs, migrate 3 `<p>` descriptions to InfoTooltip) | component — page section | CRUD form | `Starting Hours` input at `PrinterSettings.tsx:135-140`; `<p className="text-xs text-slate-500 mt-1">` descriptions at `:156, :171, :181` (migrate to InfoTooltip on label like `CostCalculator.tsx:861-863`) | exact |
| `src/components/UserProfileModal.tsx` (MODIFY — remove 1 NewBadge site) | component — modal | UI-10 cleanup only | `NewBadge` removal sites in CostCalculator are sibling examples | exact |
| `src/components/GcodeImport.tsx` (MODIFY — remove 2 NewBadge sites + import line) | component — modal | UI-10 cleanup only | Same NewBadge cleanup pattern | exact |
| `src/features.ts` (MODIFY — prune 9 stale entries, add `default-tax-rate`) | config — registry | data-only | The file is itself the canonical pattern (no analog needed); see "Registry Edit" section | exact |
| `src/components/CsvImportModal.tsx` (UNCHANGED — documented no-op) | n/a | n/a | n/a | n/a — RESEARCH inventory confirms zero numeric inputs and zero NewBadge sites |

---

## Pattern Assignments

### `src/utils/costCalc.ts` — append `calculateTax` (util, transform)

**Analog:** `calculateLabor` in the same file at `src/utils/costCalc.ts:104-111` (chosen because it is the simplest sibling — scalars-in / scalar-out, no IO, no React).

**Imports pattern** (top of file, lines 1-10) — leave untouched; `calculateTax` adds no new imports.

**Core pattern — sibling pure-function shape** (`src/utils/costCalc.ts:102-111`):
```typescript
// Labor: ((prepTimeMinutes + postProcessingMinutes) / 60) × hourlyRate
// (matches CostCalculator.tsx:418-419).
export function calculateLabor(
  prepTimeMinutes: number,
  postProcessingMinutes: number,
  laborHourlyRate: number,
): number {
  const totalLaborMinutes = prepTimeMinutes + postProcessingMinutes;
  return (totalLaborMinutes / 60) * laborHourlyRate;
}
```

**Adapt to `calculateTax`** per RESEARCH Example 1 (`13-RESEARCH.md:193-203`):
- Append at the end of the file as a new exported function, BEFORE the `calculateCost` orchestrator if you want it co-located with the other sub-helpers, or AFTER it (planner picks — both placements respect the file's "sub-helpers above, orchestrator below" rhythm).
- Return shape is `{ taxAmount: number; ratePercent: number }` (RESEARCH Example 1 line 195) — slightly richer than `calculateLabor`'s scalar return because the consumer needs the rate back for the `Tax (X.X%)` label.
- Guard with `if (!Number.isFinite(...) || ... <= 0) return { taxAmount: 0, ratePercent: 0 or rate };` — matches the defensive style already in `calculateDepreciation` (`src/utils/costCalc.ts:75-80`, the `totalRecoveryHours > 0 ? ... : 0` guard).
- Use `Math.round(sellingPrice * ratePercent) / 100` exactly (RESEARCH Pitfall 2 lock at `13-RESEARCH.md:366-371`). **No `Number.EPSILON`. No `toFixed`. No `Intl.NumberFormat`.**

**Error handling pattern:** The file's idiom is to return safe zeros instead of throwing — see `calculateElectricityCost` (`:62-66`, ternary returns 0 when `selectedPrinter` is undefined) and `calculateDepreciation` (`:79`, ternary returns 0 when `totalRecoveryHours <= 0`). Mirror that — no `throw` statements.

**Test analog (lives in `costCalc.test.ts`):** `describe('calculateLabor', ...)` at the appropriate location in `src/utils/costCalc.test.ts` (see next section).

---

### `src/utils/costCalc.test.ts` — activate `it.todo` and add `describe('calculateTax', ...)` (test, unit)

**Analog:** sibling `describe` blocks at `src/utils/costCalc.test.ts:108-156` (`calculateFilamentCost`, `calculateElectricityCost`, `calculateDepreciation`). The `it.todo` to activate is at `src/utils/costCalc.test.ts:444`.

**Imports pattern** (`src/utils/costCalc.test.ts:1-21`):
```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  calculateFilamentCost,
  calculateElectricityCost,
  calculateDepreciation,
  calculateNozzleWear,
  calculateLabor,
  calculateAmortization,
} from './costCalc';
```
**Adapt:** add `calculateTax` to the existing destructured import list. No new test-fixture helpers needed — `calculateTax` takes plain scalars, so no `makePrinter` / `makeRow` builder.

**Describe-block pattern** (`src/utils/costCalc.test.ts:108-139`):
```typescript
describe('calculateFilamentCost', () => {
  it('Test 1 (TEST-01): returns 0 for empty rows', () => {
    expect(calculateFilamentCost([])).toBe(0);
  });
  // ... 5 more `it(...)` cases
});
```

**Adapt for `calculateTax`** per RESEARCH Example 1 (`13-RESEARCH.md:602-650`) — 7 assertions are locked by VALIDATION (`13-VALIDATION.md:44-50`):
1. rate=0 → returns `{ taxAmount: 0, ratePercent: 0 }`
2. UK 20% on 50.00 → 10.00
3. AU 10% on 25.00 → 2.50
4. EU-average 21% on 100.00 → 21.00
5. centime rounding: 23% on 12.50 → 2.88
6. order-of-operations guard: tax uses `sellingPrice`, not `subtotal`
7. (Optional) guard: `sellingPrice` ≤ 0 → returns `{ taxAmount: 0 }`

**Replacement at line 444:** Convert `it.todo('tax/VAT applies after subtotal — activates in v1.2');` to a complete `describe` block. The `it.todo` lives INSIDE the existing `describe('calculateCost', ...)` integration block (line ~444 is near the end of that block) — RESEARCH recommends a new top-level `describe('calculateTax', ...)` AFTER the integration block, which is consistent with the rest of the file's organization (one describe per pure function). Planner picks placement; both options satisfy `! grep -n "it.todo" src/utils/costCalc.test.ts` (VALIDATION row 7, `13-VALIDATION.md:50`).

---

### `src/utils/taxResolution.ts` (NEW — util, transform)

**Analog:** No exact analog exists — this is the first discriminated-union resolver in the codebase. Closest siblings:
- `src/utils/costCalc.ts:124-184` (`calculateCost` orchestrator) for the typed-input-record + typed-output pattern.
- `src/types.ts:12-30` (`Currency` union) for the existing string-literal discriminator style.

**Imports pattern** (mirror `src/utils/costCalc.ts:1-10`):
```typescript
import type { Currency } from '../types';
import { TAX_RATES, EU_AVERAGE_RATE, type TaxRateEntry } from '../data/taxRates';
```

**Core pattern — exported types + pure functions** (RESEARCH Example 2, `13-RESEARCH.md:213-266`):
```typescript
export type TaxRateSource =
  | { kind: 'override'; rate: number }
  | { kind: 'settings'; rate: number }
  | { kind: 'region'; rate: number; region: string; rateAsOf: string; note?: string }
  | { kind: 'eu-average'; rate: number; note: string }
  | { kind: 'manual'; rate: 0 };

export interface ResolveTaxRateInput {
  jobOverride: number | undefined;
  settingsDefault: number | undefined;
  currency: Currency;
}

export function resolveTaxRate(input: ResolveTaxRateInput): TaxRateSource { ... }
export function isRateStale(rateAsOf: string, now: Date = new Date()): boolean { ... }
export function tooltipForSource(source: TaxRateSource): string { ... }
```

**Error handling pattern:** Same as `costCalc.ts` — no `throw`. The `kind: 'manual'` branch is the explicit "we couldn't resolve, ask the user" sentinel; consumers handle it. `isRateStale` guards `Number.isNaN(asOf.getTime())` and returns `false` (RESEARCH `13-RESEARCH.md:261-265`).

**Tooltip strings** are locked verbatim in UI-SPEC (`13-UI-SPEC.md:113-122`) — copy from that table directly into the `switch (source.kind)` of `tooltipForSource`.

**Test analog:** `src/utils/taxResolution.test.ts` mirrors `costCalc.test.ts` describe-block shape (next entry).

---

### `src/utils/taxResolution.test.ts` (NEW — test, unit)

**Analog:** `src/utils/costCalc.test.ts:108-156` (`describe('calculateFilamentCost', ...)`).

**Imports pattern** (mirror `src/utils/costCalc.test.ts:1-21`):
```typescript
import { describe, it, expect } from 'vitest';
import { resolveTaxRate, isRateStale, tooltipForSource } from './taxResolution';
import type { TaxRateSource } from './taxResolution';
```

**Describe-block coverage** (locked by VALIDATION `13-VALIDATION.md:51-55` + Wave 0 requirements `:73`):
- `describe('resolveTaxRate', ...)` — 5 branches:
  - `'US region default'` — currency=USD, no override, no settings → `kind: 'region'` rate=0 with US note
  - `'EU average'` — currency=EUR, no override, no settings → `kind: 'eu-average'` rate=21
  - `'manual (unknown region)'` — currency=ZAR (or any currency not in TAX_RATES), no override, no settings → `kind: 'manual'` rate=0
  - (additional) override wins over settings; settings wins over region
- `describe('isRateStale', ...)` — 2 branches:
  - `'is stale'` — `rateAsOf` more than 18 months before `now` → `true`
  - `'is fresh'` — `rateAsOf` within 18 months → `false`
  - (additional) invalid date string → `false`

**Test fixture pattern:** Unlike `costCalc.test.ts`, no `makeFoo()` builders are needed because `ResolveTaxRateInput` has only 3 scalar fields. Inline object literals are clearer.

---

### `src/data/taxRates.ts` (NEW — data, data-only)

**Analog:** `src/data/bambuFilaments.ts` (the only existing precedent under `src/data/` matching the "typed-array-of-objects" shape).

**Imports pattern** (`src/data/bambuFilaments.ts:1`):
```typescript
import type { Asset } from '../types';
```
**Adapt to taxRates.ts:**
```typescript
import type { Currency } from '../types';
```

**Header-comment pattern** (`src/data/bambuFilaments.ts:3-5`):
```typescript
// Bambu Lab filament catalog with USD pricing
// Scraped from us.store.bambulab.com on 2025-02-14
// Run scripts/scrape-bambu-filaments.ts to refresh this data
```
**Adapt** — RESEARCH provides the exact provenance text (`13-RESEARCH.md:289-291`):
```typescript
// Static tax-rate table keyed off Currency for the resolveTaxRate fallback chain.
// 27 EU member states + UK/AU/CA/US. EU is consumed via the EU_AVERAGE_RATE
// branch in resolveTaxRate (D-05); the per-country rows are reference data.
// Source: Tax Foundation "2026 VAT Rates in Europe" + EU Commission TEDB.
```

**Core pattern — typed `readonly` array of objects** (`src/data/bambuFilaments.ts:7-20`):
```typescript
export const bambuFilaments: Omit<Asset, 'id'>[] = [
  {
    name: 'Bambu PLA Basic',
    category: 'filament',
    brand: 'Bambu Lab',
    filamentType: 'PLA',
    unit: 'g',
    unitsPerPackage: 1000,
    packageCost: 12.99,
    costPerUnit: 0.01299,
    currency: 'USD',
    tags: ['bambu-import', '1kg'],
  },
  // ... ~50 more entries
];
```

**Adapt to TAX_RATES** per RESEARCH Example 3 (`13-RESEARCH.md:279-334`):
- Export a `TaxRateEntry` interface (RESEARCH `:279-286`).
- Export `EU_AVERAGE_RATE = 21` constant (RESEARCH `:292`).
- Export `TAX_RATES: readonly TaxRateEntry[] = [...]` — note `readonly` modifier (RESEARCH `:294`); `bambuFilaments` does not use `readonly` because it is mutated by import logic — `TAX_RATES` is pure lookup data and should be `readonly`.
- 32 rows total: 5 currency-keyed (`USD`, `GBP`, `AUD`, `CAD`, plus EUR handled by branch) + 27 EU country reference rows.
- US row gets the marketplace-facilitator note string verbatim from UI-SPEC `13-UI-SPEC.md:117`.
- CA row gets the federal-GST note verbatim from UI-SPEC `13-UI-SPEC.md:118`.

**No new functions in this file** — it is pure data. All lookup logic lives in `taxResolution.ts`.

---

### `src/components/SettingsModal.tsx` (MODIFY — Default Tax Rate field, UI sweep)

**Analog:** `Default Profit Margin` block at `src/components/SettingsModal.tsx:237-261` — same tab (`activeTab === 'costs'`), same layout intent, sibling section that the new field slots in NEXT TO.

**Imports pattern (existing):** `Input`, `NewBadge` are already imported. Verify `InfoTooltip` is imported — RESEARCH `:441-443` flags 3 `<p>` blocks in this file to migrate, which requires the import. If missing, add it next to the existing `Input` import.

**Section-wrapper pattern** (`SettingsModal.tsx:237-241`):
```tsx
<div className="pt-4 border-t border-slate-700">
  <h3 className="text-sm font-medium text-slate-300 mb-3 relative inline-block">
    Default Profit Margin
    <NewBadge feature="default-profit-margin" className="absolute top-0 left-full ml-2 pointer-events-none" />
  </h3>
  <div>
    ...
```
**Critical adopt** for Default Tax Rate (UI-SPEC `13-UI-SPEC.md:143-146`):
- `<h3 className="... relative inline-block">` is the `relative` host for the absolute-positioned `<NewBadge>`. **Do not nest the badge inside a flex-1 container** — anti-pattern called out in CLAUDE.md memory.
- `feature="default-tax-rate"` — register today's date (`2026-05-21`) in `src/features.ts` (UI-SPEC `:143`).

**Input pattern** (`SettingsModal.tsx:243-256`):
```tsx
<label className="block text-xs text-slate-400 mb-1">Profit Margin (%)</label>
<Input
  type="number"
  step="0.1"
  min="0"
  max="99.9"
  compact
  value={userProfile.defaultProfitMargin ?? 30}
  onChange={e => {
    const parsed = parseFloat(e.target.value);
    const next = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 99.9) : 0;
    onUserProfileChange({ ...userProfile, defaultProfitMargin: next });
  }}
/>
```
**Critical adopt + ONE divergence** for Default Tax Rate (UI-SPEC `13-UI-SPEC.md:255-268`):
- Same `type="number" step="0.1" min="0" max="99.9" compact`.
- **DIVERGENCE — `value`**: use `value={userProfile.defaultTaxRate ?? ''}` (NOT `?? 30`). Per RESEARCH Pitfall 3 (`13-RESEARCH.md:372-376`) and CONTEXT D-04, the Default Tax Rate must start empty / unset. Writing `0` on first render breaks the fallback chain.
- **DIVERGENCE — `onChange`**: when the input is empty, write `defaultTaxRate: undefined` (not `0`). Pattern reference: `PrinterSettings.tsx:152-153` (`newInstancePurchasePrice` uses exactly this `e.target.value ? parseFloat(...) : undefined` shape).

**Label-with-InfoTooltip pattern** (mirror `CostCalculator.tsx:861-863`):
```tsx
<label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
  <span>Tax Rate (%)</span>
  <InfoTooltip text={userCurrency === 'USD' ? US_NOTE : NON_USD_NOTE} />
</label>
```
Where `US_NOTE` and `NON_USD_NOTE` are the locked strings from UI-SPEC `13-UI-SPEC.md:135-136`.

**Migrate 3 descriptive `<p>` blocks → InfoTooltip on label** (RESEARCH `:441-443`):
- `SettingsModal.tsx:213-215` (electricity description)
- `SettingsModal.tsx:231-233` (hourly rate description)
- `SettingsModal.tsx:257-259` (profit margin description)

For each: delete the `<p className="text-xs text-slate-500 mt-2">...</p>` and rewrite the preceding `<label>` from `block` to `flex items-center gap-1.5` per the CostCalculator Prep Time pattern (`:861-863`). Move the descriptive text into `<InfoTooltip text="...">`.

**No descriptive `<p>` below the new Default Tax Rate Input** (UI-SPEC `:138` — divergence from Default Profit Margin). The same wave rewrites Default Profit Margin to match this new "no `<p>` below" shape.

---

### `src/components/CostCalculator.tsx` (MODIFY — per-job Tax + Tax row + UI sweep + NewBadge removal)

**Analog 1 — per-job Tax Rate input:** `Profit Margin` field at `src/components/CostCalculator.tsx:1150-1164`:
```tsx
<div>
  <label className="block text-sm font-medium text-white mb-1">Profit Margin</label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">%</span>
    <Input
      type="number"
      value={profitMarginPercent || ''}
      onChange={e => {
        setProfitMarginPercent(parseFloat(e.target.value) || 0);
        setLastEdited('margin');
      }}
      className="pl-8"
    />
  </div>
</div>
```
**Adapt** per UI-SPEC `13-UI-SPEC.md:176-188`:
- Change the parent grid at `:1150` from `md:grid-cols-3` → `md:grid-cols-4` to make room for a 4th column.
- Mirror the `pl-8 + %` prefix overlay verbatim.
- Wide style, NOT `compact` (UI-SPEC `:188` — these are "primary inputs").
- `value={editingJob?.taxRate ?? ''}`; `onChange` writes `editingJob.taxRate = e.target.value ? parseFloat(...) : undefined` (mirrors `PrinterSettings.tsx:152-153`).

**Analog 2 — Tax row + Total row in Cost Breakdown:** Subtotal+Failure block at `src/components/CostCalculator.tsx:1294-1303`, plus "Cost Per Unit" total at `:1305-1313`:
```tsx
<div className="border-t border-slate-700 pt-2 mt-2">
  <div className="flex justify-between text-slate-300">
    <span>Subtotal</span>
    <span className="font-mono">{currencySymbol}{(costs.subtotal + totalShippingCost).toFixed(2)}</span>
  </div>
  <div className="flex justify-between text-yellow-400">
    <span>+ Failure Adjustment ({failureRate}%)</span>
    <span className="font-mono">+{currencySymbol}{(costs.failureAdjusted - costs.subtotal).toFixed(2)}</span>
  </div>
</div>

<div className="border-t border-slate-600 pt-3 mt-3">
  <div className="flex justify-between text-white text-lg font-semibold">
    <span>Cost Per Unit</span>
    <span className="font-mono">{currencySymbol}{trueCost.toFixed(2)}</span>
  </div>
  ...
</div>
```
**Adapt** per UI-SPEC `13-UI-SPEC.md:151-167` (locked JSX). Drop-in location: after the `Cost Per Unit` block at line `:1313`, BEFORE the Marketplace Fee Note at `:1316`. Wrap the entire new fragment in `{tax.ratePercent > 0 && (...)}` per UI-SPEC interaction rules `:215-220`.

**Class-string contract** (UI-SPEC `:170-174`):
- Outer wrapper: `border-t border-slate-700 pt-2 mt-2` (mirrors Subtotal/Failure wrapper at `:1294`).
- Row container: `flex justify-between text-slate-300` (mirrors Filament row at `:1255`).
- Label span: `flex items-center gap-1.5` (matches Prep Time at `:861`).
- Value span: `font-mono` (mirrors every Cost Breakdown value, e.g. `:1257`).
- Total row: `flex justify-between text-white font-semibold mt-1` (mirrors `:1306` but drop `text-lg` for compactness).

**Analog 3 — label with InfoTooltip + (new) NewBadge sibling pattern:** Model URL at `src/components/CostCalculator.tsx:710-713`:
```tsx
<label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
  <span>Model URL</span>
  <InfoTooltip text="Save the source link so you can find it again later (works for free models too)" />
  <NewBadge feature="model-url" />
</label>
```
**Adapt** for the Tax row label (UI-SPEC `:152-160`): order is `<span>Tax (X.X%)</span>` → `<InfoTooltip text={tooltipForSource(taxSource)} />`. No `NewBadge` on this label (UI-SPEC `:142` — the only new badge in Phase 13 is on the SettingsModal h3).

**Analog 4 — save persistence:** `handleSaveJob` update path at `src/components/CostCalculator.tsx:506-525` and create path at `:534-553`:
```tsx
if (editingJob) {
  const updatedJob: PrintJob = {
    ...editingJob,
    name: printName.trim(),
    // ... other fields
    sellingPrice,
  };
  onUpdateJob(updatedJob);
  ...
} else {
  const job: PrintJob = {
    id: `job-${Date.now()}`,
    // ... other fields
    sellingPrice,
    copiesSold: 0,
  };
  onSaveJob(job, printTimeHours);
  ...
}
```
**Adapt:** add `taxRate: editingJob?.taxRate ?? undefined` and `taxAmount: tax.taxAmount` to BOTH the update and create blocks. `taxAmount` is persisted derived so historic jobs reproduce their math even if regional rates change (RESEARCH `:72`).

**Per-job Tax rate state hookup** (RESEARCH Example 2 `:660-672`):
```tsx
const taxSource = useMemo(
  () => resolveTaxRate({
    jobOverride: editingJob?.taxRate,
    settingsDefault: userProfile.defaultTaxRate,
    currency: userCurrency,
  }),
  [editingJob?.taxRate, userProfile.defaultTaxRate, userCurrency]
);
const tax = useMemo(
  () => calculateTax(sellingPrice, taxSource.rate),
  [sellingPrice, taxSource.rate]
);
```

**NewBadge removal sites in this file:**
- Line 748: `<NewBadge feature="per-unit-licensing" />` — inside the Per-unit license label, leaves `<span>` + checkbox.
- Line 756: `<NewBadge feature="author-min-price" />` — inside Author Min Price label, leaves `<span>` + `<InfoTooltip>`.
- Line 1016: `<NewBadge feature="packaging-materials" />` — inside an `<h3>`. The `<h3>` keeps `flex items-center gap-2` for the future-proofed flex; UI-SPEC `:198` confirms no `relative` cleanup needed.

**Compact-input sweep (CostCalculator):**
- Line 922-928: Materials Used Quantity — replace `className="w-20 text-right"` with `compact className="text-right"` (preserve right-align).
- Line 970-981: Shipping Distance — add `compact`; optionally add `InfoTooltip text="Round-trip distance"` to the label (RESEARCH `:428`).
- Line 988-996: Carrier Cost — add `compact`.
- Line 794-800: Grams (per filament row) — planner judgment; the existing `className="w-24"` is already narrow.

**Failure Rate optional InfoTooltip** (RESEARCH `:424`): label currently has no description. Adding `<InfoTooltip text="Expected % of prints that fail and need to be redone" />` is consistent with D-16 but the field has no description today, so per RESEARCH this is OPTIONAL — planner picks.

---

### `src/components/AssetLibrary.tsx` (MODIFY — sweep + InfoTooltip migration + NewBadge removal)

**Analog for compact Input:** `Default Profit Margin` Input at `SettingsModal.tsx:244-256` — show that `compact` + `step="0.01"` + `value={x || ''}` + `placeholder` is the established shape.

**Analog for "For reusable items" placeholder migration (UI-09 / D-15):** The CostCalculator Prep Time label at `:861-863` is the canonical example of moving a description from placeholder text into `<InfoTooltip>` on the label. Migrate `AssetLibrary.tsx:1040` `placeholder="For reusable items"` → `placeholder=""` (or empty) and rewrite the preceding `<label>` (`:1035`) from `block text-xs text-slate-400 mb-1` to `flex items-center gap-1.5 text-xs text-slate-400 mb-1` with a `<span>` + `<InfoTooltip text="For items that get reused (e.g., a brush)">`.

**7 numeric inputs to add `compact` to** (RESEARCH `:462-475`): Purchase Price (printer), Wattage, Expected Lifespan, Nozzle Cost, Nozzle Lifespan, Package Cost, Units per Package, Lifespan Units. Each follows the same `value={x || ''}` shape already present (`:955, :965, :975, :985, :995, :1018, :1028, :1038`).

**NewBadge removals:**
- Line 763: `<NewBadge feature="csv-import" ... />` — verify parent class.
- Line 845: `{cat === 'packaging' && <NewBadge feature="packaging-materials" />}` — **remove the entire conditional expression**, not just the inner JSX (UI-SPEC `:200`).
- After both removals: `grep -n "import.*NewBadge" src/components/AssetLibrary.tsx` → zero matches → delete the import line (UI-SPEC `:204`).

---

### `src/components/JobsManager.tsx` (MODIFY — Record Sale form sweep)

**Analog:** Sibling `Sale Quantity` / `Price per Unit` inputs at `src/components/JobsManager.tsx:540-555`:
```tsx
<div>
  <label className="block text-xs text-slate-400 mb-1">Quantity</label>
  <Input
    type="number"
    min="1"
    value={saleQuantity}
    onChange={e => setSaleQuantity(parseInt(e.target.value) || 1)}
  />
</div>
<div>
  <label className="block text-xs text-slate-400 mb-1">Price per Unit ($)</label>
  <Input
    type="number"
    step="0.01"
    value={salePrice}
    onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
  />
</div>
```

**Adapt** per RESEARCH `:483-489`:
- Add `compact` to lines 541 (Quantity), 550 (Price per Unit), 589 (Shipping Cost).
- No description migration needed — these have no descriptive `<p>` blocks (RESEARCH `:490`).
- `placeholder` not currently set; can stay empty or add `"0"`/`"0.00"` example values per D-15.

---

### `src/components/PrinterSettings.tsx` (MODIFY — sweep + 3 InfoTooltip migrations)

**Analog for compact:** `Starting Hours` input at `PrinterSettings.tsx:135-140`:
```tsx
<label className="block text-xs text-slate-400 mb-1">Starting Hours</label>
<Input
  type="number"
  value={newInstanceHours}
  onChange={e => setNewInstanceHours(parseFloat(e.target.value) || 0)}
  placeholder="0"
/>
```

**Adapt:** add `compact` to lines 136, 150 (Purchase Price), 175 (Monthly Print Hours), 276, 284, 308 (Edit form mirrors).

**Analog for `<p>` description migration:** Same pattern as SettingsModal — rewrite label from `block` to `flex items-center gap-1.5` and move text into `<InfoTooltip text="...">`. 3 sites per RESEARCH `:499, :501, :506`:
- `:156` `<p>What you paid</p>` → InfoTooltip `"What you paid (may differ from MSRP)"` on the Purchase Price label `:149`.
- `:171` `<p>Target to break even</p>` → InfoTooltip `"Target months to recover your investment via printed-job sales"` on the Recovery Period label `:159`.
- `:181` `<p>Expected usage</p>` → InfoTooltip `"Expected hours/month — used to estimate cost recovery"` on the Monthly Print Hours label `:174`.

**Import check:** If `InfoTooltip` is not already imported in this file, add it.

---

### `src/components/UserProfileModal.tsx` (MODIFY — NewBadge removal only)

**Action:** Remove `<NewBadge feature="multi-currency" />` at line 79. After removal, `grep -n "import.*NewBadge" src/components/UserProfileModal.tsx` → if zero, delete the import line (UI-SPEC `:204`).

---

### `src/components/GcodeImport.tsx` (MODIFY — NewBadge removal only)

**Action:** Remove `<NewBadge feature="gcode-import" />` at line 282 AND `<NewBadge feature="3mf-import" />` at line 283. After both removals, `grep -n "import.*NewBadge"` → zero matches → delete the import line.

---

### `src/features.ts` (MODIFY — registry edit)

**File is itself the canonical pattern.** Current state (`src/features.ts:5-19`):
```typescript
export const featureReleases: Record<string, Date> = {
  'per-unit-licensing': new Date('2026-01-24'),
  'author-min-price': new Date('2026-01-24'),
  'configurable-marketplace-fees': new Date('2026-01-25'),
  'custom-carriers': new Date('2026-01-25'),
  'multi-currency': new Date('2026-01-25'),
  'packaging-materials': new Date('2026-01-25'),
  'settings-reorg': new Date('2026-05-20'),
  'csv-import': new Date('2026-02-14'),
  'gcode-import': new Date('2026-02-14'),
  '3mf-import': new Date('2026-04-15'),
  'default-profit-margin': new Date('2026-05-18'),
  'model-url': new Date('2026-05-20'),
  // Add new features here with their release date
};
```

**Target state** (UI-SPEC `:207, :342`) — 4 entries:
```typescript
export const featureReleases: Record<string, Date> = {
  'settings-reorg': new Date('2026-05-20'),
  'default-profit-margin': new Date('2026-05-18'),
  'model-url': new Date('2026-05-20'),
  'default-tax-rate': new Date('2026-05-21'), // NEW for Phase 13
};
```

**Removal/audit gate:** Per RESEARCH Pitfall 6 (`:390-394`), REMOVE the JSX sites FIRST. Only after `grep -rE 'NewBadge feature="(per-unit-licensing|author-min-price|configurable-marketplace-fees|custom-carriers|multi-currency|packaging-materials|csv-import|gcode-import|3mf-import)"' src/` returns ZERO matches is it safe to delete the registry entries. VALIDATION row 19 enforces this (`13-VALIDATION.md:62`).

---

## Shared Patterns

### Pattern S1: `compact` numeric Input

**Source:** `src/components/ui/Input.tsx:11, 23` (primitive — `compact` prop caps width at `max-w-28` / 112px).

**Apply to:** All ~22 numeric input sites in the UI sweep (CostCalculator, AssetLibrary, JobsManager, PrinterSettings, SettingsModal Custom Carrier + Custom Marketplace Add). Per CONTEXT D-14, numeric-only (currency, %, count, time). Text inputs stay full-width.

**Excerpt** (`src/components/ui/Input.tsx:20-35`):
```typescript
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', error = false, compact = false, className = '', disabled, ...props }, ref) => {
    const baseStyles = 'w-full bg-slate-700 text-white rounded-lg border-0 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
    const compactStyles = compact ? 'max-w-28' : '';
    ...
```

**Anti-pattern (rejected by UI-SPEC `:188`):** the 3 financial-targets inputs in CostCalculator (Profit Margin, Target Profit, Selling Price at `:1150-1198`) and the new per-job Tax Rate input STAY WIDE with `pl-8` + prefix overlay — they are intentionally not compact.

---

### Pattern S2: `InfoTooltip`-on-label

**Source:** Primitive at `src/components/ui/InfoTooltip.tsx:11-48`. Canonical consumer example: CostCalculator Prep Time label at `src/components/CostCalculator.tsx:861-863`:
```tsx
<label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
  <span>Prep Time (min)</span>
  <InfoTooltip text="Slicing, bed prep, etc." />
</label>
```

**Apply to:** Every label whose field currently has a descriptive `<p>` underneath or a sentence-length placeholder (CONTEXT D-15 / D-16). Concrete sites (RESEARCH `:441-443, :474, :498-506`):
- SettingsModal: electricity description (`:213-215`), hourly rate description (`:231-233`), profit margin description (`:257-259`), new Default Tax Rate (with US/non-USD branch text).
- AssetLibrary: Lifespan Units "For reusable items" placeholder (`:1040`).
- PrinterSettings: "What you paid" (`:156`), "Target to break even" (`:171`), "Expected usage" (`:181`).
- CostCalculator (optional): Failure Rate label.

**Class-string contract:**
- Label transitions from `className="block text-xs text-slate-400 mb-1"` → `className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"`.
- Children become `<span>label text</span>` + `<InfoTooltip text="..." />`.
- The original `<p className="text-xs text-slate-500 mt-2">...</p>` is deleted.

---

### Pattern S3: `NewBadge` placement (anti-pattern-safe)

**Source:** Primitive at `src/components/NewBadge.tsx:34-72`. Two correct host patterns:

**Pattern S3a — absolute on an `<h3>`** (`src/components/SettingsModal.tsx:237-241`):
```tsx
<h3 className="text-sm font-medium text-slate-300 mb-3 relative inline-block">
  Default Profit Margin
  <NewBadge feature="default-profit-margin" className="absolute top-0 left-full ml-2 pointer-events-none" />
</h3>
```
The `<h3>` is `relative inline-block` so the badge can be `absolute` without consuming layout width. **This is the pattern for the new `Default Tax Rate` h3.**

**Pattern S3b — inline at end of a label flex chain** (`src/components/CostCalculator.tsx:710-713`):
```tsx
<label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
  <span>Model URL</span>
  <InfoTooltip text="..." />
  <NewBadge feature="model-url" />
</label>
```
The label is NOT itself a `flex-1` peer in its parent flex chain — it is just a label whose own `flex items-center` is short. The badge appearing/disappearing does not reflow neighboring fields.

**Apply to:** ONLY the new `Default Tax Rate` h3. Per UI-SPEC `13-UI-SPEC.md:142-145`, no other new badges in Phase 13.

**Anti-pattern (banned by CLAUDE.md memory):** Inline `<NewBadge>` placement inside `flex-1` containers (tab bars, equal-width nav, grid columns whose width is shared). A `flex-1` child that gets a badge widens to accommodate the badge and forces siblings to wrap or truncate.

---

### Pattern S4: Optional-field `value` handling (`undefined` vs `0`)

**Source:** `src/components/PrinterSettings.tsx:152-153`:
```tsx
value={newInstancePurchasePrice ?? selectedPrinterConfig?.purchasePrice ?? ''}
onChange={e => setNewInstancePurchasePrice(e.target.value ? parseFloat(e.target.value) : undefined)}
```

**Apply to:**
- New `userProfile.defaultTaxRate` in SettingsModal (CRITICAL — per CONTEXT D-04 and RESEARCH Pitfall 3 `:372-376`, must NOT default to `0`).
- New per-job `editingJob.taxRate` in CostCalculator (same reason — undefined means "fall through the chain", `0` means "user explicitly set 0%").

**Contrast — pattern NOT to copy:** `userProfile.defaultProfitMargin ?? 30` at `SettingsModal.tsx:250`. Profit margin has a sensible default (30%) and `0` is a meaningful value; Tax Rate is different.

---

### Pattern S5: Pure-util module shape (`costCalc.ts` convention)

**Source:** `src/utils/costCalc.ts:1-184`.

**Apply to:** `src/utils/taxResolution.ts` (NEW). All four conventions:
1. Header comment explaining what the module owns + where the math/logic originated.
2. Exported `interface` / `type` for input shapes at the top.
3. Each operation is a separate named `export function` (no default export).
4. Defensive returns over throws (return safe zero / `kind: 'manual'` sentinel rather than throwing).

**Excerpt** (`src/utils/costCalc.ts:11-23`):
```typescript
// Pure cost-calculation module. Mirrors the math in
// src/components/CostCalculator.tsx:374-446 (the `useMemo((): CostBreakdown => {…})`)
// with byte-for-byte identical semantics. No React, no Dexie, no IO.

export interface CalcInputFilamentRow {
  filamentId: string;
  ...
}
```

---

### Pattern S6: Vitest test-file shape

**Source:** `src/utils/costCalc.test.ts:1-21, :108-156`.

**Apply to:** New `src/utils/taxResolution.test.ts` and the new `describe('calculateTax', ...)` block in `costCalc.test.ts`.

**Conventions:**
- Import `describe, it, expect` from `vitest`.
- Import functions under test as named imports from the relative `./` sibling.
- One top-level `describe(<functionName>, ...)` per exported function.
- Test names use descriptive sentences (e.g. `'returns 0 for empty rows'`); the locked phase-13 names from VALIDATION (`13-VALIDATION.md:44-55`) get the exact `-t "..."` substrings the harness greps for.
- Use `toBeCloseTo(value, 2)` for floating-point assertions where rounding is incidental; use `toBe(value)` for tax centime-rounding assertions where the round is contract-locked.

---

### Pattern S7: Static-data file shape

**Source:** `src/data/bambuFilaments.ts:1-20`.

**Apply to:** New `src/data/taxRates.ts`.

**Conventions:**
- Single `import type {...} from '../types'` at the top.
- 3-line header comment with: what the data is, where it came from, how to refresh.
- One or more named `export const` constants — no default exports, no functions.
- Typed-array-of-objects shape; one object per row; comma at the end of each row (the existing `bambuFilaments` file uses one entry per `{...},` block for diff-friendly editing).
- **Divergence for taxRates.ts:** add the `readonly` modifier (`readonly TaxRateEntry[]`) and use the literal-narrowing `region` string field for type safety. `bambuFilaments.ts` is mutated by import flow and so is NOT `readonly`; `TAX_RATES` is pure lookup data and SHOULD be `readonly` (RESEARCH `:294`).

---

## No Analog Found

None. Every new/modified file in this phase has a strong, role-and-data-flow-aligned analog already in the codebase. Phase 13 is composition over creation (UI-SPEC `:26`, RESEARCH `:356`) — the only genuinely-new code shapes are:

1. **Discriminated-union return type** (`TaxRateSource` in `taxResolution.ts`) — not directly precedented but trivially-typed; the `Currency` union in `src/types.ts:12-30` is the closest local example of TypeScript string-literal discrimination.
2. **The `tooltipForSource` switch over a discriminated union** — also unprecedented in this repo but is a standard TypeScript idiom; UI-SPEC `:113-122` provides the exact string-by-string contract so the planner does not need a stylistic reference.

Both are bounded enough that RESEARCH Example 2 (`13-RESEARCH.md:213-266`) and Example 3 (`:695-..`) function as the de facto pattern source.

---

## Metadata

**Analog search scope:**
- `src/components/` (12 files inspected: CostCalculator.tsx, SettingsModal.tsx, AssetLibrary.tsx, JobsManager.tsx, PrinterSettings.tsx, UserProfileModal.tsx, GcodeImport.tsx, CsvImportModal.tsx, NewBadge.tsx, ui/Input.tsx, ui/InfoTooltip.tsx)
- `src/utils/` (costCalc.ts, costCalc.test.ts)
- `src/data/` (bambuFilaments.ts, defaultMaterials.ts)
- `src/` root (features.ts, types.ts)

**Files scanned:** 17 source files + 4 phase-planning documents (`13-CONTEXT.md`, `13-RESEARCH.md`, `13-UI-SPEC.md`, `13-VALIDATION.md`).

**Stop condition:** Reached the 3-5-strong-matches threshold for every new/modified file. Most files have 1-2 in-file or near-file analogs (e.g., Default Profit Margin block is the dominant analog for Default Tax Rate; Subtotal+Failure block is the dominant analog for Tax+Total row). No additional analog scanning would change the assignments.

**Pattern extraction date:** 2026-05-21.
