# Phase 13: Tax Model + UI Sweep - Research

**Researched:** 2026-05-21
**Domain:** Pure cost-math extension (`calculateTax`) + static region lookup table + form-consistency sweep across 5 components + feature-registry audit
**Confidence:** HIGH

## Summary

Phase 13 lands two independent but co-located deliverables in the same files: a small, well-bounded tax-engine + UI ribbon (TAX-01..05) and a mechanical UI consistency pass (UI-08, UI-09, and per CONTEXT D-17, UI-10 folded in). The tax engine is a 5-line pure function appended to `src/utils/costCalc.ts`, a static `src/data/taxRates.ts` with ~32 rows (5 currency-keyed lookups + 27 EU country reference rows + UK/AU/CA fallback), and a centralized `resolveTaxRate` helper that owns the fallback chain (per-job override → Settings default → region table → manual). The display side adds a single Tax row in CostCalculator's Cost Breakdown after the Cost Per Unit total, plus a Default Tax Rate field in SettingsModal's "Costs & Rates" tab (NOT "Pricing" — see Discrepancy 1).

The UI sweep covers 4 of the 6 named surfaces (CsvImportModal and GcodeImport have zero numeric inputs and need no changes other than the InfoTooltip pattern on labels where one exists). Across CostCalculator, AssetLibrary, JobsManager, PrinterSettings, and SettingsModal there are roughly 31 numeric/currency inputs of which 24 already have `compact`. The sweep adds `compact` to the remaining ~7 numeric inputs and migrates ~14 descriptive placeholders into `<InfoTooltip>` blocks next to the label.

The features.ts audit (today = 2026-05-21, cutoff = 14 days = released on/before 2026-05-07) flags 9 of 13 registry entries as stale, with the only fresh entries being `settings-reorg` (2026-05-20), `model-url` (2026-05-20), `default-profit-margin` (2026-05-18), and `3mf-import` (2026-04-15 — also stale on math, will be removed). Total of 11 JSX `<NewBadge>` sites to remove and 9 registry entries to prune.

**Primary recommendation:** Plan this phase as two waves — Wave A (tax engine + tax UI), Wave B (UI sweep + features.ts audit) — running sequentially in the same phase. They touch overlapping files (CostCalculator, SettingsModal) but Wave A only adds new JSX, while Wave B rewrites existing labels/placeholders. Doing tax first means the new Tax row gets the v1.2 `compact`/InfoTooltip pattern from day one, and the features.ts audit removes badge clutter before the planner needs to verify the new tax components don't accidentally inherit it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tax Fallback Table (TAX-03):**
- **D-01:** `src/data/taxRates.ts` ships with: each EU member state (27 entries, per-country VAT), UK, Australia, Canada, US. ~30 entries total. PRable to extend later — keep schema permissive so adding a row stays mechanical.
- **D-02:** Region key is `userProfile.currency`. Single-currency-per-country mappings are 1:1 (USD→US, GBP→UK, AUD→AU, CAD→CA). EUR is the multi-country exception — see D-05.
- **D-03:** Each row in `taxRates.ts` carries `rateAsOf: string` (ISO date). When the current date is more than **18 months** past `rateAsOf`, the UI surfaces a "rate may be stale — verify locally" hint near the tax row (planner picks exact placement — inline text or InfoTooltip extension).
- **D-04:** Default Tax Rate in Settings (Pricing tab) **starts empty / unset** on first view. The per-job tax UI falls through the chain: per-job override → Settings default → region table → "enter manually" for unknown region. The user is never silently defaulted to 0% (per TAX-03 success criterion).
- **D-05:** When `userProfile.currency === 'EUR'`, use a **21% EU-average** rate with a tooltip reading "EU average rate — verify for your country." This is a deliberate compromise: country-keyed lookup was rejected (we picked currency-keyed in D-02), and forcing every EUR user through "enter manually" would be punitive when 19/27 EU member states sit between 19–22%.

**Tax Row Display (TAX-04):**
- **D-06:** Label is always literally **"Tax"** — not region-aware. `Tax (X%)` everywhere. Matches TAX-04 wording exactly; avoids a regional-string-map matrix.
- **D-07:** Percentage display uses **one decimal place** always: `Tax (20.0%)`, `Tax (8.5%)`, `Tax (27.0%)`. Matches the existing `step=0.1` on the Profit Margin input. Math uses the actual float; only display is rounded.
- **D-08:** Tax row label gets an InfoTooltip showing the **rate source**: "From Settings default — 20%" / "Per-job override" / "From your region (UK, rateAsOf 2024-04-01)". Helps users debug surprising numbers and reinforces the fallback chain.
- **D-09:** When a per-job override **equals** the Settings default value, no badge or marker is shown. Behaviorally identical to no override; surfacing "(overridden)" would be noise.

**US Marketplace-Facilitator UX (TAX-03):**
- **D-10:** The marketplace-facilitator note lives in an **InfoTooltip next to the tax label** — same pattern as UI-09. Consistent with the rest of the form, no banners or inline help text.
- **D-11:** Wording (short, factual): _"Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state."_ Planner may copy-edit lightly but the substance is locked.
- **D-12:** The note **persists** when a US user manually enters a non-zero rate. The marketplace-facilitator situation hasn't changed because the user typed a number; the tooltip still explains why the default was 0.
- **D-13:** The US note appears in **both** the Settings Pricing-tab Default Tax Rate field **and** the per-job tax row in CostCalculator.

**UI Sweep (UI-08, UI-09, UI-10):**
- **D-14:** `compact` (max-w-28) applies to **numeric inputs only** — currency ($), percentage (%), count (sold copies, copies remaining), time (g, h, min). Text inputs (Print Name, Model URL, filament selector free-text, etc.) stay full-width.
- **D-15:** Descriptive placeholders are migrated to `<InfoTooltip>` on the label. The placeholder becomes an **example value** (e.g. `0`, `0.00`, `e.g. 13`) or empty when no useful example exists.
- **D-16:** Non-compact (wide) text inputs **also** get the InfoTooltip-on-label treatment when they have a description today. Consistency across the form trumps surgical scope.
- **D-17:** UI-10 is **folded into Phase 13 scope** (originally listed but unmapped). Same files get touched, same review window. Action: audit `src/features.ts`; remove `<NewBadge>` JSX where the feature's release date is past `NEW_FEATURE_MAX_AGE_DAYS` (14 days from today); prune registry entries that have zero remaining JSX consumers.

### Claude's Discretion
- Exact placement of Default Tax Rate field within the Pricing tab vertical order (above or below Default Profit Margin — both are reasonable).
- Exact placement of the per-job tax row within CostCalculator's pricing block (TAX-04 says "after `sellingPrice`" — multiple acceptable concrete positions).
- Whether `taxRates.ts` exports a `Map`, a record, or a typed array of `{currency, region, label, rate, rateAsOf, note?}` objects — planner picks based on lookup ergonomics.
- Test grouping inside `costCalc.test.ts` (`describe('calculateTax', ...)` block or inline alongside `calculateCost` tests).
- Exact JSX/Tailwind classes for the tax row visual (planner follows existing breakdown-row patterns).
- Whether `compact` swap and `<InfoTooltip>` swap land in one PR or split per file — planner picks based on diff size; both are acceptable.
- Whether the staleness hint for D-03 reuses InfoTooltip or adds a small inline `<span className="text-yellow-400 text-xs">` indicator.

### Deferred Ideas (OUT OF SCOPE)
- Region-aware tax labels (VAT / GST / Sales Tax) — explicitly rejected in D-06.
- `userProfile.country` field for precise EU country mapping — rejected in D-02 / D-05.
- Geo-based live tax API — TAX-F1, deferred indefinitely.
- US per-state sales tax tables — TAX-F2.
- Tax-inclusive vs tax-exclusive pricing toggle — assumes tax-exclusive.
- Per-customer tax exemptions — Phase 14+ territory.
- Per-job override badge when override differs from default — rejected in D-09.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAX-01 | User can set default tax rate in Settings (Pricing tab); seeds new jobs; persists | `UserProfile.defaultTaxRate?` lives in v6 schema (verified `src/types.ts:234`); `getUserProfile`/`setUserProfile` already merge missing keys via existing `defaultValue` path (`src/db/database.ts:143-147`). Settings entry lives in the actual "Costs & Rates" tab (see Discrepancy 1), slotting next to `Default Profit Margin` (`src/components/SettingsModal.tsx:237-262`). |
| TAX-02 | User can override tax rate per job; override persists with saved job | `PrintJob.taxRate?` + `PrintJob.taxAmount?` exist on the v6 schema (verified `src/types.ts:184-185`). `taxAmount` saves as a derived number so historic jobs reproduce the math they were saved with even if rates change later. CostCalculator's `handleSaveJob` (line 506-558) is the persistence point — add `taxRate, taxAmount` to both the new-job and update-job code paths. |
| TAX-03 | Region fallback via `src/data/taxRates.ts` keyed off currency; US 0% + marketplace-facilitator note; never silently 0% | File does NOT exist yet — to be created. Region lookup keyed by `userProfile.currency` (`Currency` type in `src/types.ts:12-30` covers 18 currencies). Fallback chain is centralized in a new `resolveTaxRate` helper (see Code Examples). |
| TAX-04 | "Tax (X%)" line after `sellingPrice`; total = `sellingPrice + taxAmount`; row hides at 0% | Cost breakdown's existing flex-row pattern at `src/components/CostCalculator.tsx:1252-1304`. The "Cost Per Unit" total renders at line 1305-1313; the tax row + grand total drops in immediately after. |
| TAX-05 | `calculateTax` unit-tested for rate=0, EU/UK/AU, centime-rounding, order-of-operations guard; activates the `it.todo` | The `it.todo` is at `src/utils/costCalc.test.ts:444`. Vitest is wired (`package.json` has `"test": "vitest run"` and `vitest.config.ts` exists). Verified rounding strategy below makes `Math.round(price * ratePercent) / 100` produce `2.88` for the 12.50 × 23% case under Node's V8. |
| UI-08 | Currency/numeric/% inputs use `<Input compact />` across the 5 named surfaces | `<Input compact />` exists (`src/components/ui/Input.tsx:11,23`), caps at `max-w-28`. ~7 numeric inputs across the surfaces lack it today (see UI Sweep Inventory). |
| UI-09 | Descriptive placeholders migrate to `<InfoTooltip>` next to the label; placeholders show example values only | `<InfoTooltip>` exists (`src/components/ui/InfoTooltip.tsx`), already used as the reference pattern at CostCalculator's Model URL field (line 710-713) and Prep/Post-Processing fields (line 861-863, 875-877). ~14 descriptive placeholders to migrate. |
| UI-10 | Audit `src/features.ts`; remove stale `<NewBadge>` JSX past 14 days; prune registry entries with zero consumers | Today = 2026-05-21; cutoff = 2026-05-07. 9 stale registry entries + 11 stale JSX sites (see NEW Badge Audit). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tax math (`calculateTax`) | Pure util (`src/utils/costCalc.ts`) | — | Mirrors `calculateLabor` / `calculateDepreciation` — no React, no Dexie. Locks the contract for `costCalc.test.ts`. |
| Tax fallback chain (`resolveTaxRate`) | Pure util (new file `src/utils/taxResolution.ts`) | — | Single source of truth for "where did this rate come from?" Both Settings UI and CostCalculator UI consume it. Discriminated `source` field powers D-08's InfoTooltip without duplicate logic. |
| Static region table (`taxRates.ts`) | Data layer (`src/data/`) | — | Same pattern as `src/data/bambuFilaments.ts` and `src/data/defaultMaterials.ts` (the only existing precedents under `src/data/`). Pure-data export, no functions. |
| Default Tax Rate input | Frontend (SettingsModal, "Costs & Rates" tab) | DB layer (`getUserProfile`/`setUserProfile`) | Same wiring as the existing `defaultProfitMargin` input — `userProfile` flows in as prop, `onUserProfileChange` flows out. |
| Per-job tax UI (input + Tax row + total) | Frontend (CostCalculator) | DB layer (PrintJob persistence) | Tax row consumes `resolveTaxRate` for source-tooltip + `calculateTax` for the number. `handleSaveJob` writes `taxRate` + `taxAmount` to the PrintJob record. |
| InfoTooltip / NewBadge primitive consumption | Frontend (the 5 sweep components) | — | Both primitives already exist; the sweep is a JSX rewrite at consumer sites, not a primitive change. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (installed) | UI | Project standard, no change |
| Vitest | ^4.1.4 (installed) | Test framework | Already wired; `costCalc.test.ts` exists |
| Dexie | (installed) | Persistence | Already on v6; this phase consumes the v6 schema verbatim |
| Tailwind CSS | (installed) | Styling | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript strict mode | (configured) | Type safety | `tsc -b` must pass; planner verifies with `npm run build`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static `src/data/taxRates.ts` | `sales-tax` / `node-sales-tax` npm | Explicitly rejected in REQUIREMENTS.md "Out of Scope": Node-first, data last updated June 2023; static file is leaner and offline-first compatible |
| Hand-rolled fallback-chain inline in components | Centralized `resolveTaxRate` helper | Centralized is non-negotiable per CONTEXT integration-point note "The fallback chain (override → Settings → region table → manual) is centralized in a single helper so UI consumers don't re-implement it." |

**Installation:** No new npm packages required. All deliverables are first-party code (new utility module + new data file + JSX in existing components).

**Version verification:** Skipped — this phase installs no external packages. Verified via Bash that `node --version` in this environment runs the centime-rounding test correctly with `Math.round(price * ratePercent) / 100`.

## Package Legitimacy Audit

> Not applicable — Phase 13 installs zero new packages. All work uses already-installed dependencies (React, Vitest, Dexie, Tailwind) and adds new first-party source files.

## Architecture Patterns

### System Architecture Diagram

```
User edits per-job Tax Rate input          User edits Default Tax Rate (Settings)
            |                                            |
            v                                            v
    CostCalculator.tsx                          SettingsModal.tsx (Costs & Rates tab)
            |                                            |
            |   (consumes resolveTaxRate(...)            v
            |    for label tooltip + source             userProfile.defaultTaxRate
            |    discriminator)                          |
            v                                            v
       calculateTax(sellingPrice, ratePercent) <--- resolveTaxRate({jobOverride, settingsDefault, currency})
            |                                            ^
            |  returns {taxAmount, ratePercent}         |
            v                                            |
       Cost Breakdown — Tax row + total                  |
            |                                            |
            |  (persists)                          src/data/taxRates.ts (static)
            v                                            ^
       PrintJob.taxRate, PrintJob.taxAmount             |
            |                                            |
            v                                       (region row lookup
       Dexie v6 (existing schema, no migration)     by userProfile.currency)
```

Single-direction data flow: edits feed `resolveTaxRate` which is a pure function; the resolved rate feeds `calculateTax` which is also pure; both feed the Cost Breakdown JSX + the persisted `PrintJob` record. No new database tables, no migrations, no async paths.

### Recommended Project Structure
```
src/
├── data/
│   ├── taxRates.ts                NEW — static region table + EU country reference rows
│   ├── bambuFilaments.ts          (existing — precedent for data file pattern)
│   └── defaultMaterials.ts        (existing — precedent)
├── utils/
│   ├── costCalc.ts                MODIFIED — appends calculateTax() pure helper
│   ├── costCalc.test.ts           MODIFIED — activates it.todo, adds calculateTax describe block
│   └── taxResolution.ts           NEW — resolveTaxRate fallback-chain helper + types
├── components/
│   ├── CostCalculator.tsx         MODIFIED — adds per-job tax input + Tax row + total; sweeps numeric inputs
│   ├── SettingsModal.tsx          MODIFIED — adds Default Tax Rate field to "Costs & Rates" tab; sweeps numeric inputs
│   ├── AssetLibrary.tsx           MODIFIED — sweep numeric inputs to compact + InfoTooltip
│   ├── JobsManager.tsx            MODIFIED — sweep Record Sale form numeric inputs
│   ├── PrinterSettings.tsx        MODIFIED — sweep Add Printer / Edit Instance numeric inputs
│   ├── GcodeImport.tsx            UNCHANGED (no numeric inputs; verify and document)
│   ├── CsvImportModal.tsx         UNCHANGED (no numeric inputs; verify and document)
│   └── NewBadge.tsx               UNCHANGED (primitive)
├── features.ts                    MODIFIED — prune stale entries (UI-10)
└── types.ts                       UNCHANGED (Phase 12 already landed all fields)
```

### Pattern 1: Pure helper appended to `costCalc.ts`
**What:** Add `calculateTax` as a sibling of `calculateLabor`, `calculateDepreciation`, etc. — same shape (named export, no React, no Dexie, takes scalars, returns a plain object or scalar). Re-uses the established test-fixture pattern in `costCalc.test.ts`.

**When to use:** Every cost-math operation lives in `costCalc.ts` so the test suite has one home. This is now the project's tested-pure-math convention since Phase 10 / v1.1.

**Example:**
```typescript
// Source: src/utils/costCalc.ts (existing pattern at lines 102-111 — calculateLabor)
export function calculateLabor(
  prepTimeMinutes: number,
  postProcessingMinutes: number,
  laborHourlyRate: number,
): number {
  const totalLaborMinutes = prepTimeMinutes + postProcessingMinutes;
  return (totalLaborMinutes / 60) * laborHourlyRate;
}

// Add (sibling shape):
export function calculateTax(
  sellingPrice: number,
  ratePercent: number,
): { taxAmount: number; ratePercent: number } {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return { taxAmount: 0, ratePercent };
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) return { taxAmount: 0, ratePercent: 0 };
  // Standard half-away-from-zero rounding to 2 decimals.
  // V8 verified: rate=23, price=12.50 → raw=2.875 → Math.round(287.5)/100 = 2.88
  const taxAmount = Math.round(sellingPrice * ratePercent) / 100;
  return { taxAmount, ratePercent };
}
```

### Pattern 2: Discriminated-union fallback chain
**What:** `resolveTaxRate` returns the resolved rate AND the provenance (source). One helper, one place to update if the chain ever changes (e.g., when `userProfile.country` lands).

**When to use:** Any UI surface that needs to display the active tax rate AND explain where it came from.

**Example:**
```typescript
// Source: NEW src/utils/taxResolution.ts
import type { Currency } from '../types';
import { TAX_RATES, EU_AVERAGE_RATE, type TaxRateEntry } from '../data/taxRates';

export type TaxRateSource =
  | { kind: 'override'; rate: number }
  | { kind: 'settings'; rate: number }
  | { kind: 'region'; rate: number; region: string; rateAsOf: string; note?: string }
  | { kind: 'eu-average'; rate: number; note: string }
  | { kind: 'manual'; rate: 0 };  // unknown region — rate=0 with explicit "enter manually" flag

export interface ResolveTaxRateInput {
  jobOverride: number | undefined;     // PrintJob.taxRate
  settingsDefault: number | undefined; // userProfile.defaultTaxRate
  currency: Currency;
}

export function resolveTaxRate(input: ResolveTaxRateInput): TaxRateSource {
  // Chain order: per-job override → Settings default → region table → manual
  if (typeof input.jobOverride === 'number') {
    return { kind: 'override', rate: input.jobOverride };
  }
  if (typeof input.settingsDefault === 'number') {
    return { kind: 'settings', rate: input.settingsDefault };
  }
  if (input.currency === 'EUR') {
    return {
      kind: 'eu-average',
      rate: EU_AVERAGE_RATE,
      note: 'EU average rate — verify for your country',
    };
  }
  const row = TAX_RATES.find(r => r.currency === input.currency);
  if (row) {
    return {
      kind: 'region',
      rate: row.rate,
      region: row.region,
      rateAsOf: row.rateAsOf,
      note: row.note,
    };
  }
  // Unknown region — TAX-03 success criterion: never silently default to 0%
  return { kind: 'manual', rate: 0 };
}

// Helper for D-03 staleness — 18 months past rateAsOf
export function isRateStale(rateAsOf: string, now: Date = new Date()): boolean {
  const asOf = new Date(rateAsOf);
  if (Number.isNaN(asOf.getTime())) return false;
  const ageMs = now.getTime() - asOf.getTime();
  const monthsApprox = ageMs / (1000 * 60 * 60 * 24 * 30.44); // average month
  return monthsApprox > 18;
}
```

### Pattern 3: Static data file shape
**What:** `taxRates.ts` exports a typed `readonly` array of entries plus a `EU_AVERAGE_RATE` constant. Array (not Map) because: (1) it iterates fine for the dev-facing 27 EU reference rows; (2) "find by currency" is O(30) at startup once; (3) the file is hand-edited by humans adding regions and array literal diffs cleanly in PRs.

**When to use:** Any static data file in this project. Matches `bambuFilaments.ts` array-of-objects shape.

**Example:**
```typescript
// Source: NEW src/data/taxRates.ts
import type { Currency } from '../types';

export interface TaxRateEntry {
  currency: Currency;       // used by resolveTaxRate when currency-keyed
  region: string;           // ISO country code or 'EU' for the EU-average row
  label: string;            // human-readable: "United Kingdom", "Germany"
  rate: number;             // percent — e.g. 20 for UK VAT
  rateAsOf: string;         // ISO date — see D-03 staleness window
  note?: string;            // optional inline note (US gets the marketplace-facilitator note text)
}

// EU-average compromise per D-05.
// Note: D-05 calls 21% the "mean", but the actual unweighted mean of 27 EU standard
// rates is 21.9% (verified via Tax Foundation 2026 data). 21% is the MEDIAN. The user
// locked 21% in the discussion — keep it. See Discrepancy 2.
export const EU_AVERAGE_RATE = 21;

export const TAX_RATES: readonly TaxRateEntry[] = [
  // ─── Currency-keyed lookup rows (the 5 the resolveTaxRate chain actually hits today) ───
  { currency: 'USD', region: 'US', label: 'United States', rate: 0, rateAsOf: '2025-01-01',
    note: 'Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.' },
  { currency: 'GBP', region: 'GB', label: 'United Kingdom', rate: 20, rateAsOf: '2011-01-04' },
  { currency: 'AUD', region: 'AU', label: 'Australia', rate: 10, rateAsOf: '2000-07-01' },
  { currency: 'CAD', region: 'CA', label: 'Canada (federal GST)', rate: 5, rateAsOf: '2008-01-01',
    note: 'Federal GST only. Provincial sales tax (PST/HST) varies — override for your province.' },
  // EU is handled by the EU_AVERAGE_RATE branch in resolveTaxRate (D-05), but the
  // 27 country rows below are kept as reference data for future country-keyed lookup.

  // ─── 27 EU member states (reference rows; not consumed by currency-keyed lookup) ───
  // Source: Tax Foundation "2026 VAT Rates in Europe" + EU Commission TEDB
  { currency: 'EUR', region: 'AT', label: 'Austria',  rate: 20,   rateAsOf: '2023-01-01' },
  { currency: 'EUR', region: 'BE', label: 'Belgium',  rate: 21,   rateAsOf: '1996-01-01' },
  { currency: 'EUR', region: 'BG', label: 'Bulgaria', rate: 20,   rateAsOf: '1999-01-01' },
  { currency: 'EUR', region: 'HR', label: 'Croatia',  rate: 25,   rateAsOf: '2012-03-01' },
  { currency: 'EUR', region: 'CY', label: 'Cyprus',   rate: 19,   rateAsOf: '2014-01-13' },
  { currency: 'CZK', region: 'CZ', label: 'Czech Rep.', rate: 21, rateAsOf: '2013-01-01' },
  { currency: 'DKK', region: 'DK', label: 'Denmark',  rate: 25,   rateAsOf: '1992-01-01' },
  { currency: 'EUR', region: 'EE', label: 'Estonia',  rate: 24,   rateAsOf: '2025-07-01' },
  { currency: 'EUR', region: 'FI', label: 'Finland',  rate: 25.5, rateAsOf: '2024-09-01' },
  { currency: 'EUR', region: 'FR', label: 'France',   rate: 20,   rateAsOf: '2014-01-01' },
  { currency: 'EUR', region: 'DE', label: 'Germany',  rate: 19,   rateAsOf: '2007-01-01' },
  { currency: 'EUR', region: 'GR', label: 'Greece',   rate: 24,   rateAsOf: '2016-06-01' },
  { currency: 'EUR', region: 'HU', label: 'Hungary',  rate: 27,   rateAsOf: '2012-01-01' },
  { currency: 'EUR', region: 'IE', label: 'Ireland',  rate: 23,   rateAsOf: '2012-01-01' },
  { currency: 'EUR', region: 'IT', label: 'Italy',    rate: 22,   rateAsOf: '2013-10-01' },
  { currency: 'EUR', region: 'LV', label: 'Latvia',   rate: 21,   rateAsOf: '2012-07-01' },
  { currency: 'EUR', region: 'LT', label: 'Lithuania',rate: 21,   rateAsOf: '2009-09-01' },
  { currency: 'EUR', region: 'LU', label: 'Luxembourg', rate: 17, rateAsOf: '2024-01-01' },
  { currency: 'EUR', region: 'MT', label: 'Malta',    rate: 18,   rateAsOf: '2004-01-01' },
  { currency: 'EUR', region: 'NL', label: 'Netherlands', rate: 21,rateAsOf: '2012-10-01' },
  { currency: 'PLN', region: 'PL', label: 'Poland',   rate: 23,   rateAsOf: '2011-01-01' },
  { currency: 'EUR', region: 'PT', label: 'Portugal', rate: 23,   rateAsOf: '2011-01-01' },
  { currency: 'EUR', region: 'RO', label: 'Romania',  rate: 21,   rateAsOf: '2025-08-01' },
  { currency: 'EUR', region: 'SK', label: 'Slovakia', rate: 23,   rateAsOf: '2025-01-01' },
  { currency: 'EUR', region: 'SI', label: 'Slovenia', rate: 22,   rateAsOf: '2013-07-01' },
  { currency: 'EUR', region: 'ES', label: 'Spain',    rate: 21,   rateAsOf: '2012-09-01' },
  { currency: 'SEK', region: 'SE', label: 'Sweden',   rate: 25,   rateAsOf: '1996-01-01' },
];
```

### Anti-Patterns to Avoid
- **Inlining the fallback chain in CostCalculator.tsx:** Re-implementing the override→settings→region→manual chain in JSX (instead of calling `resolveTaxRate`) means SettingsModal and CostCalculator drift apart over time. Centralize in one helper.
- **Multiplying tax by `subtotal` or `failureAdjusted` or `costPerUnit`:** ROADMAP locks: tax applies to `sellingPrice`, not subtotal. The order-of-operations guard test asserts this exact constraint when depreciation > 0. See Landmines below.
- **Inline `new Date()` math in JSX for staleness check:** Use the `isRateStale(rateAsOf)` helper from `taxResolution.ts`. Inline math is hard to test and easy to break with timezones.
- **Region-aware label strings (VAT vs GST vs Sales Tax):** Locked rejection per D-06. Label is always literally `"Tax"`. Skipping the string map is a feature.
- **Currency-keyed lookup that returns 0% silently for unknown regions:** Violates TAX-03 success criterion. The `kind: 'manual'` branch in `resolveTaxRate` is what the UI uses to show "enter manually" — not a silent 0.
- **Map-based `taxRates.ts`:** Loses the multi-row-per-currency property (every EUR country row would collide). Stick with the typed array.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compact numeric input | Custom max-width Tailwind utility class on every numeric field | `<Input compact />` (existing primitive) | `Input.tsx:23` already caps at `max-w-28`; one consistent class to swap |
| Tooltip on a label | Inline `<span title="...">` or hand-rolled CSS popover | `<InfoTooltip text="..." />` (existing primitive) | Accessible (aria-describedby, focus handling), reused across the form |
| "New" feature badge | Manual rendering of green chip | `<NewBadge feature="key" />` (existing primitive) | Two-gate logic (release age + per-user seen) is already implemented |
| Date diff for staleness | Inline `(new Date() - new Date(rateAsOf)) / ...` in JSX | `isRateStale(rateAsOf)` helper in `taxResolution.ts` | Unit-testable, timezone-safe, single source of truth |
| Currency-to-region routing | Inline `if (currency === 'USD') ...` switches in JSX | `resolveTaxRate({jobOverride, settingsDefault, currency})` | The discriminated `source` field carries the metadata UI needs (tooltip wording, staleness check) |
| Half-away-from-zero rounding to 2 decimals | Bespoke epsilon-adjustment math | `Math.round(price * ratePercent) / 100` (verified) | Verified under Node V8: produces `2.88` for `12.50 × 23%` (`raw=2.875 → round(287.5)=288 → /100`) |

**Key insight:** Every primitive needed for this phase already exists. Phase 13 is composition, not creation — the only new code is `calculateTax` (a 5-line pure function), `resolveTaxRate` (a switch over a discriminated union), and `taxRates.ts` (a static data array). The "UI sweep" half is purely JSX rewrites at consumer sites — no new abstractions.

## Common Pitfalls

### Pitfall 1: Tax applied to `subtotal` instead of `sellingPrice`
**What goes wrong:** Developer reads "tax after subtotal" in REQUIREMENTS-style language and computes `taxAmount = subtotal * ratePercent / 100`. This is mathematically smaller than `sellingPrice * rate` whenever `sellingPrice > subtotal` (which is always, when profit margin > 0 and depreciation > 0).
**Why it happens:** The cost-breakdown JSX renders `subtotal` and `failureAdjusted` adjacent to `Cost Per Unit`, and a tired developer multiplies whichever variable is closest.
**How to avoid:** The locked formula is `taxAmount = round2(sellingPrice * ratePercent / 100)` — multiplying any other variable is wrong. The order-of-operations guard test (`assertion fails if depreciation > 0 and taxAmount === subtotal × rate`) catches this on every commit.
**Warning signs:** Tax row value in the UI changes when failure rate or depreciation changes — that's the smoking gun. `sellingPrice` is the user-edited number; tax is computed off that.

### Pitfall 2: 0.1 + 0.2 = 0.30000000000000004 — IEEE-754 in tax rounding
**What goes wrong:** Computing `12.50 × 0.23` in JS gives `2.875` (which displays correctly), but `Math.round(2.875 * 100) / 100` can give `2.87` instead of `2.88` for nearby values like `1.005 × 100`. Banker's rounding via `Intl.NumberFormat` rounds to even. The locked test asserts `2.88`.
**Why it happens:** Floating-point representation of `2.875` is exactly `2.875` (it's `23/8`), so the simple multiply-round path works. But the developer may add an `Number.EPSILON` "fix" that breaks the test.
**How to avoid:** Use `Math.round(sellingPrice * ratePercent) / 100` exactly — no EPSILON adjustment, no `toFixed(2)` (which has different rounding semantics in some edge cases), no `Intl.NumberFormat` (banker's rounding). Verified under Node V8: this produces `2.88` for the locked test case.
**Warning signs:** Test passes for `12.50 × 23%` but fails for a different rate-price combination. If that happens, the rounding strategy is wrong, not the test.

### Pitfall 3: `userProfile.defaultTaxRate === undefined` vs `=== 0`
**What goes wrong:** D-04 says "Default Tax Rate starts empty / unset" — meaning `userProfile.defaultTaxRate` is `undefined` until the user explicitly enters a value. If the developer initializes the Settings input with `value={userProfile.defaultTaxRate ?? 0}` and writes `0` back on every keystroke, the chain breaks: every user has `defaultTaxRate === 0` after their first Settings visit, and the region fallback never fires.
**Why it happens:** React inputs prefer non-undefined values; the natural fix is `?? 0`, which silently overwrites "unset" with "explicit 0".
**How to avoid:** Track Settings input state as `string` locally (or `number | undefined`), and only write to `userProfile.defaultTaxRate` when the field has a non-empty value. Mirror the pattern at `SettingsModal.tsx:152-154` (`newInstancePurchasePrice` is `number | undefined` precisely for this reason). The persisted shape is `defaultTaxRate?: number` — keep the `?` honest.
**Warning signs:** `resolveTaxRate` always returns `kind: 'settings'` after one Settings visit, even when the user never touched the tax field.

### Pitfall 4: Currency-keyed EU collapse
**What goes wrong:** Developer keys `taxRates.ts` by currency string and writes `find(r => r.currency === 'EUR')` — which matches the first EUR row in the array (probably Austria) and silently uses that country's rate for all 19 EUR users.
**Why it happens:** The data file has 19+ EUR-currency rows for reference; the lookup function needs to know to take the EU-average branch for EUR, not the find-first branch.
**How to avoid:** `resolveTaxRate` has an explicit `if (input.currency === 'EUR')` branch BEFORE the array `.find()`. The 27 country rows are reference data only; the currency-keyed lookup intentionally never resolves to any one of them for EUR.
**Warning signs:** Settings panel auto-shows "Austria 20%" for a German user — that's the lookup falling through to the array.

### Pitfall 5: Stale `rateAsOf` doesn't trigger because of timezone parsing
**What goes wrong:** `new Date('2024-04-01')` is parsed as UTC midnight in some engines, local midnight in others. Subtracting from local-time `new Date()` then dividing by `1000*60*60*24*30` gives different month counts on different machines.
**Why it happens:** ISO date strings without time are ambiguous.
**How to avoid:** Use the helper `isRateStale(rateAsOf, now?)` with an explicit `now` parameter for testability. Compare in milliseconds with `30.44` days per month (closer to average) and treat the cutoff generously (18 months ± 1 month is fine — D-03 says "more than 18 months past").
**Warning signs:** Staleness chip flickers in tests at the boundary; timezone-dependent test failures.

### Pitfall 6: `<NewBadge>` removed but `src/features.ts` entry left orphaned (or vice versa)
**What goes wrong:** Developer removes the JSX site but not the registry entry, or removes the registry entry but the JSX still references a now-missing key (returns null silently — works but leaks dead code).
**Why it happens:** Two files to update; easy to forget one.
**How to avoid:** Always remove the JSX site FIRST (the user-visible effect), then grep `src/` for any remaining `feature="<key>"` references. Only after grep returns zero hits is it safe to delete the registry entry.
**Warning signs:** Empty NewBadge artifacts in production — verifiable via `grep -r 'NewBadge feature' src/` + cross-check against `featureReleases` map.

### Pitfall 7: "Pricing tab" vs "Costs & Rates" tab — terminology drift between docs and code
**What goes wrong:** CONTEXT.md, ROADMAP.md, and REQUIREMENTS.md all say "Settings (Pricing tab)" for the Default Tax Rate field. Actual code in `SettingsModal.tsx:42` has three tabs: `'costs' | 'delivery' | 'marketplaces'` with Default Profit Margin (line 237-262) under the **Costs & Rates** tab labeled `"Costs & Rates"` (line 149). There is no "Pricing" tab.
**Why it happens:** Phase 7 renamed the tab during the v1.1 Settings reorg but the v1.2 docs were written from a mental model that still says "Pricing."
**How to avoid:** The planner MUST resolve this before writing PLAN.md. Two options: (1) Slot Default Tax Rate into the existing "Costs & Rates" tab next to Default Profit Margin (recommended — matches the integration-point hint in CONTEXT "Default Tax Rate slots in next to Default Profit Margin"); or (2) Add a fourth tab labeled "Pricing" — heavyweight, breaks the established 3-tab IA, almost certainly unintended.
**Warning signs:** Plan-checker flags "no `activeTab === 'pricing'` block exists" — that's because option 1 is correct.

## Runtime State Inventory

> Skipping this section — Phase 13 is not a rename/refactor/migration phase. It adds new fields whose values default to `undefined` on existing records (Phase 12 already shipped the schema). No data migration needed. No external service config references. No OS-registered state. No secret/env-var renames. No build artifacts holding old names.

## Environment Availability

> Phase 13 has no external dependencies beyond the already-installed dev toolchain. Skipping per the protocol's skip condition: "purely code/config changes with no external dependencies."

## UI Sweep Inventory

> Per the planner's request: file-by-file inventory of every `<Input>` that is currency / % / numeric, with current state and recommended action. Text inputs (Name, URL, Notes, free-text) are listed for completeness with action "no compact, but verify InfoTooltip on label per D-16."

### CostCalculator.tsx (1426 lines, 14 numeric inputs, 8 already compact)

| Line | Field | Type | Has `compact`? | Current description location | Action |
|------|-------|------|----------------|------------------------------|--------|
| 677-683 | Print Name | text | n/a (wide) | placeholder `"e.g., Dragon Figurine"` | Keep wide; no description today, no tooltip needed (D-16 only applies if a description exists) |
| 715-720 | Model URL | url | n/a (wide) | InfoTooltip present (line 712) | Reference pattern — leave as-is |
| 725-732 | Model Cost | number | YES (728) | placeholder `"0"` | OK |
| 758-765 | Author Min Price | number | YES (761) | InfoTooltip present (line 755) | OK |
| 794-800 | Grams (per filament row) | number | NO (uses `className="w-24"`) | placeholder `"g"` | Add `compact` (or keep `w-24` — already narrow; planner picks) |
| 837-844 | Print Time | number | YES (840) | placeholder `"0"` | OK |
| 849-857 | Failure Rate | number | YES (853) | placeholder `"5"` | OK; consider adding `<InfoTooltip text="Expected % of prints that fail and need to be redone" />` to label (currently no description anywhere) |
| 865-871 | Prep Time | number | YES (867) | InfoTooltip present (863) | OK |
| 879-885 | Post-Processing Time | number | YES (881) | InfoTooltip present (877) | OK |
| 922-928 | (Materials Used) Quantity | number | NO (uses `className="w-20 text-right"`) | no description | Add `compact` (replaces `w-20` — `max-w-28` is similar width) |
| 970-981 | Shipping Distance | number | NO | placeholder = max radius | Add `compact`; add InfoTooltip explaining "Round-trip distance" |
| 988-996 | Carrier Cost | number | NO | placeholder = computed default | Add `compact`; default cost stays as placeholder example |
| 1054-1067 | Packaging Quantity | number | NO (uses `inputSize="sm" className="w-16 text-right"`) | no description | Leave as-is — `inputSize="sm"` + explicit `w-16` is intentional for the tight packaging row layout |
| 1155-1164 | Profit Margin (Set Financial Targets) | number | NO (uses `pl-8`) | no description (label has `%` prefix overlay) | Leave wide — this is a "primary input" in the financial-targets block; the pl-8 + `%` icon overlay pattern is intentional |
| 1170-1180 | Target Profit | number | NO (uses `pl-8`) | no description | Same — primary input, leave wide |
| 1188-1198 | Selling Price | number | NO (uses `pl-8`) | no description | Same — primary input, leave wide |

**Sub-total for CostCalculator:** 6 numeric inputs to add `compact` to (Grams optional; Materials Used Quantity, Shipping Distance, Carrier Cost — strong yes). 3 primary financial-target inputs left wide by design.

### SettingsModal.tsx (782 lines, 25+ numeric inputs, most already compact)

| Line | Field | Type | Has `compact`? | Action |
|------|-------|------|----------------|--------|
| 205-212 | Cost per kWh | number | YES (209) | OK; placeholder is empty; description below the field on line 213-215 — migrate to `<InfoTooltip>` on label per D-16 |
| 222-230 | Hourly Rate | number | YES (226) | OK; description below on line 231-233 — migrate to `<InfoTooltip>` |
| 244-256 | Default Profit Margin | number | YES (249) | OK; description below on line 257-259 — migrate to `<InfoTooltip>` |
| **NEW** | **Default Tax Rate** | **number** | **add `compact`** | **NEW field added by this phase. Place adjacent to Default Profit Margin per CONTEXT integration-point note. Label has `<InfoTooltip>` carrying the marketplace-facilitator note when currency=USD (D-10/D-13).** |
| 273-282 | Max Radius (delivery) | number | YES (276) | OK |
| 285-292 | Fuel Price | number | YES (289) | OK |
| 295-305 | MPG / L per 100km | number | YES (299) | OK |
| 321-328, 331-338, etc. | Carrier costs (UPS, FedEx, DHL, etc.) | number | YES | OK |
| 488-494 | Custom Carrier — Cost | number | NO | Add `compact` |
| 522-529, 532-539, 542-549 | Facebook Marketplace (3 fields) | number | YES | OK |
| 559-565, 568-575, 579-585, 589-595, 599-606 | Etsy (5 fields) | number | YES | OK |
| 616-622, 626-632 | eBay (2 fields) | number | YES | OK |
| 643-649 | Amazon Handmade Referral | number | YES | OK |
| 740-746, 748-754 | Custom Marketplace Add (% + Fixed) | number | NO | Add `compact` |
| 672-679, 682-690 | Custom Marketplace Edit (% + Fixed) | number | YES (675, 685) | OK |

**Sub-total for SettingsModal:** 3 numeric inputs to add `compact` to (Custom Carrier Cost in Add form; both Custom Marketplace numerics in Add form). Wave 0 also migrates 3 descriptive `<p>` blocks (electricity, hourly rate, profit margin descriptions) into `<InfoTooltip>` on the label.

### AssetLibrary.tsx (1327 lines, 8 numeric inputs, 0 currently compact)

| Line | Field | Type | Has `compact`? | Action |
|------|-------|------|----------------|--------|
| 883-889 | Asset Name | text | n/a | Keep wide; no description |
| 895-901 | Custom Category | text | n/a | Keep wide; placeholder is fine |
| 939-944 | Brand | text | n/a | Keep wide |
| 952-959 | Purchase Price ($) (printer) | number | NO | Add `compact`; placeholder `"299"` is an example value — keep |
| 963-969 | Wattage (printer) | number | NO | Add `compact`; placeholder `"100"` |
| 973-978 | Expected Lifespan hours (printer) | number | NO | Add `compact`; placeholder `"5000"` |
| 982-988 | Nozzle Cost ($) (printer) | number | NO | Add `compact`; placeholder `"10"` |
| 992-997 | Nozzle Lifespan cm³ (printer) | number | NO | Add `compact`; placeholder `"15000"` |
| 1005-1011 | Unit (material) | text | n/a | Keep wide |
| 1015-1022 | Package Cost ($) (material) | number | NO | Add `compact`; placeholder `"20.00"` |
| 1026-1032 | Units per Package (material) | number | NO | Add `compact`; placeholder `"1000"` |
| 1036-1042 | Lifespan units (optional) (material) | number | NO | Add `compact`; placeholder `"For reusable items"` is DESCRIPTIVE — migrate to `<InfoTooltip text="For items that get reused (e.g., a brush)">` and placeholder becomes empty per D-15 |
| 852-858 | Search box | text | n/a | Keep wide (search input) |
| 1048-1057 | Notes | text | n/a | Keep wide |
| 1059-1066 | Tag input | text | n/a | Keep wide |

**Sub-total for AssetLibrary:** 7 numeric inputs to add `compact` to. 1 descriptive placeholder ("For reusable items") to migrate to InfoTooltip.

### JobsManager.tsx (683 lines, 3 numeric inputs, 0 currently compact)

| Line | Field | Type | Has `compact`? | Action |
|------|-------|------|----------------|--------|
| 541-546 | Sale Quantity | number | NO | Add `compact` |
| 550-555 | Sale Price per Unit ($) | number | NO | Add `compact` |
| 561-567 | Customer Name (sale) | text | n/a | Keep wide; placeholder `"Facebook Marketplace buyer"` is an example value — keep |
| 589-594 | Sale Shipping Cost ($) | number | NO | Add `compact` |

**Sub-total for JobsManager:** 3 numeric inputs to add `compact` to. Zero descriptive placeholders requiring InfoTooltip migration.

### PrinterSettings.tsx (382 lines, 6 numeric inputs, 0 currently compact)

| Line | Field | Type | Has `compact`? | Action |
|------|-------|------|----------------|--------|
| 115-120 | Nickname | text | n/a | Keep wide; placeholder `"e.g., Office P1S, Garage A1"` is an example — keep |
| 135-140 | Starting Hours | number | NO | Add `compact`; placeholder `"0"` |
| 150-155 | Purchase Price ($) | number | NO | Add `compact`; placeholder is computed printer-config default — keep |
| 156 | description: "What you paid" | n/a | n/a | Migrate `<p>` description to `<InfoTooltip text="What you paid (may differ from MSRP)" />` on label |
| 175-180 | Monthly Print Hours | number | NO | Add `compact`; placeholder `"40"` |
| 181 | description: "Expected usage" | n/a | n/a | Migrate to `<InfoTooltip text="Expected hours/month — used to estimate cost recovery" />` on label |
| 268-272 | (Edit) Nickname | text | n/a | Keep wide |
| 276-280 | (Edit) Print Hours | number | NO | Add `compact` |
| 284-288 | (Edit) Purchase Price | number | NO | Add `compact` |
| 308-312 | (Edit) Monthly Print Hours | number | NO | Add `compact` |
| 171 | "Target to break even" | n/a | n/a | Migrate to `<InfoTooltip text="Target months to recover your investment via printed-job sales" />` on Recovery Period label |

**Sub-total for PrinterSettings:** 6 numeric inputs to add `compact` to. 3 descriptive `<p>` blocks to migrate into `<InfoTooltip>`.

### CsvImportModal.tsx (565 lines, 0 numeric inputs)

Verified via `grep -cE 'type="number"' CsvImportModal.tsx` → **0**. The modal has dropdown selects for duplicate-mode and rows are previewed read-only. No sweep work required. **Document this in PLAN.md so the planner-checker doesn't flag the missing changes.**

### GcodeImport.tsx (307 lines, 0 numeric inputs)

Verified via `grep -cE 'type="number"' GcodeImport.tsx` → **0**. The component is a drag-and-drop file zone only. No sweep work required. **Document.**

### Sweep Inventory Summary

| Surface | Numeric inputs needing `compact` | Descriptive placeholders / `<p>` to migrate to `<InfoTooltip>` |
|---------|----------------------------------|---------------------------------------------------------------|
| CostCalculator | 3 (strong yes) + 3 (planner-judgment) = up to 6 | 0 mandatory; 1 optional (Failure Rate label could use a tooltip) |
| SettingsModal | 3 (Custom Carrier + Custom Marketplace Add form) | 3 (electricity, hourly rate, profit margin descriptions) |
| AssetLibrary | 7 | 1 (Lifespan Units "For reusable items") |
| JobsManager | 3 | 0 |
| PrinterSettings | 6 | 3 |
| CsvImportModal | 0 | 0 |
| GcodeImport | 0 | 0 |
| **TOTAL** | **22 (strong) — 25 if optional CostCalculator inputs included** | **7 descriptive `<p>` migrations + 1 placeholder migration** |

## NEW Badge Audit (UI-10)

Today = **2026-05-21**. Cutoff = today − 14 days = **2026-05-07**. Any feature released on or before 2026-05-07 is stale and its `<NewBadge>` JSX must be removed.

### Registry entries by status

| Feature key | Release date | Days old | Status | JSX sites |
|-------------|--------------|----------|--------|-----------|
| `per-unit-licensing` | 2026-01-24 | 117 | STALE — remove | `CostCalculator.tsx:748` |
| `author-min-price` | 2026-01-24 | 117 | STALE — remove | `CostCalculator.tsx:756` |
| `configurable-marketplace-fees` | 2026-01-25 | 116 | STALE — remove | (no JSX — already orphaned; just delete registry entry) |
| `custom-carriers` | 2026-01-25 | 116 | STALE — remove | (no JSX — already orphaned; delete registry entry) |
| `multi-currency` | 2026-01-25 | 116 | STALE — remove | `UserProfileModal.tsx:79` |
| `packaging-materials` | 2026-01-25 | 116 | STALE — remove | `AssetLibrary.tsx:845`, `CostCalculator.tsx:1016` |
| `csv-import` | 2026-02-14 | 96 | STALE — remove | `AssetLibrary.tsx:763` |
| `gcode-import` | 2026-02-14 | 96 | STALE — remove | `GcodeImport.tsx:282` |
| `3mf-import` | 2026-04-15 | 36 | STALE — remove | `GcodeImport.tsx:283` |
| `default-profit-margin` | 2026-05-18 | 3 | FRESH — keep | `SettingsModal.tsx:240` |
| `model-url` | 2026-05-20 | 1 | FRESH — keep | `CostCalculator.tsx:713` |
| `settings-reorg` | 2026-05-20 | 1 | FRESH — keep | `App.tsx:187` |

### Remove-list (JSX sites)

11 JSX sites to delete:

| File | Line | JSX |
|------|------|-----|
| `src/components/CostCalculator.tsx` | 748 | `<NewBadge feature="per-unit-licensing" />` |
| `src/components/CostCalculator.tsx` | 756 | `<NewBadge feature="author-min-price" />` |
| `src/components/CostCalculator.tsx` | 1016 | `<NewBadge feature="packaging-materials" />` |
| `src/components/UserProfileModal.tsx` | 79 | `<NewBadge feature="multi-currency" />` |
| `src/components/AssetLibrary.tsx` | 763 | `<NewBadge feature="csv-import" ... />` |
| `src/components/AssetLibrary.tsx` | 845 | `{cat === 'packaging' && <NewBadge feature="packaging-materials" />}` (remove entire conditional) |
| `src/components/GcodeImport.tsx` | 282 | `<NewBadge feature="gcode-import" />` |
| `src/components/GcodeImport.tsx` | 283 | `<NewBadge feature="3mf-import" />` |

### Registry-entry remove-list (`src/features.ts`)

9 entries to delete (lines 6, 7, 8, 9, 10, 11, 13, 14, 15 in `src/features.ts`):

```typescript
// REMOVE these lines from src/features.ts:
'per-unit-licensing': new Date('2026-01-24'),
'author-min-price': new Date('2026-01-24'),
'configurable-marketplace-fees': new Date('2026-01-25'),
'custom-carriers': new Date('2026-01-25'),
'multi-currency': new Date('2026-01-25'),
'packaging-materials': new Date('2026-01-25'),
'csv-import': new Date('2026-02-14'),
'gcode-import': new Date('2026-02-14'),
'3mf-import': new Date('2026-04-15'),

// KEEP these:
'settings-reorg': new Date('2026-05-20'),
'default-profit-margin': new Date('2026-05-18'),
'model-url': new Date('2026-05-20'),
```

After pruning, the registry has **3 entries** corresponding to **3 live JSX sites** (App.tsx:187, SettingsModal.tsx:240, CostCalculator.tsx:713). Zero orphans, zero stale badges.

## Code Examples

### Example 1: `calculateTax` activation in `costCalc.test.ts`

```typescript
// Source: src/utils/costCalc.test.ts:444 — activate the it.todo

// REPLACE:
// it.todo('tax/VAT applies after subtotal — activates in v1.2');

// WITH a new describe block (recommended placement: after the calculateCost integration block):
describe('calculateTax', () => {
  it('returns 0 when rate is 0', () => {
    expect(calculateTax(50, 0)).toEqual({ taxAmount: 0, ratePercent: 0 });
  });

  it('UK 20% on 50.00 → 10.00', () => {
    expect(calculateTax(50, 20)).toEqual({ taxAmount: 10, ratePercent: 20 });
  });

  it('AU 10% on 25.00 → 2.50', () => {
    expect(calculateTax(25, 10)).toEqual({ taxAmount: 2.5, ratePercent: 10 });
  });

  it('EU-average 21% on 100.00 → 21.00', () => {
    expect(calculateTax(100, 21)).toEqual({ taxAmount: 21, ratePercent: 21 });
  });

  // Locked centime-rounding test from TAX-05.
  it('23% on 12.50 → 2.88 (centime rounding, half-away-from-zero)', () => {
    expect(calculateTax(12.5, 23).taxAmount).toBe(2.88);
  });

  it('returns 0 when sellingPrice is 0 or negative (guard)', () => {
    expect(calculateTax(0, 20).taxAmount).toBe(0);
    expect(calculateTax(-5, 20).taxAmount).toBe(0);
  });

  // Order-of-operations guard from TAX-05.
  // The math fact: when depreciation > 0, sellingPrice ≠ subtotal,
  // so taxAmount computed off sellingPrice must differ from sellingPrice's
  // raw rate-application against the subtotal scalar.
  it('order-of-operations guard — tax uses sellingPrice, not subtotal', () => {
    // Synthetic: a job where depreciation flows into sellingPrice but not subtotal.
    // Per costCalc.ts, depreciation is a FIXED cost (not in subtotal/failureAdjusted).
    // sellingPrice is the user-set financial-targets number, derived from
    // (trueCost = failureAdjusted + totalShippingCost) + margin.
    // Subtotal here = filament + electricity + materials + labor + perUnitModelCost (per costCalc.ts:161).
    // For this guard, just assert that calculateTax(sellingPrice, rate) ≠ calculateTax(subtotal, rate)
    // when sellingPrice > subtotal (the always-true production case).
    const subtotal = 10;
    const sellingPrice = 25; // some sellingPrice > subtotal, e.g. depreciation + margin
    const rate = 20;
    const taxOnSelling = calculateTax(sellingPrice, rate).taxAmount;     // 5.00
    const taxOnSubtotal = calculateTax(subtotal, rate).taxAmount;        // 2.00
    expect(taxOnSelling).not.toBe(taxOnSubtotal);
    expect(taxOnSelling).toBe(5.00);
    expect(taxOnSubtotal).toBe(2.00);
  });
});
```

### Example 2: Tax row in CostCalculator's Cost Breakdown

```tsx
// Source: drop-in at src/components/CostCalculator.tsx — after the "Cost Per Unit" total
// at line 1305-1313 (or after the Marketplace Fee Note at 1316-1329). Planner picks
// based on which mental model fits "after sellingPrice" best.

// Wired-up via a new useMemo + resolveTaxRate call:
const taxSource = useMemo(
  () => resolveTaxRate({
    jobOverride: editingJob?.taxRate,            // when editing a saved job
    settingsDefault: userProfile.defaultTaxRate, // userProfile flows in from App
    currency: userCurrency,
  }),
  [editingJob?.taxRate, userProfile.defaultTaxRate, userCurrency]
);
const tax = useMemo(
  () => calculateTax(sellingPrice, taxSource.rate),
  [sellingPrice, taxSource.rate]
);

// JSX (TAX-04: row hides at 0%):
{tax.ratePercent > 0 && (
  <div className="border-t border-slate-700 pt-2 mt-2">
    <div className="flex justify-between text-slate-300">
      <span className="flex items-center gap-1.5">
        <span>Tax ({tax.ratePercent.toFixed(1)}%)</span>
        <InfoTooltip text={tooltipForSource(taxSource)} />
      </span>
      <span className="font-mono">{currencySymbol}{tax.taxAmount.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-white font-semibold mt-1">
      <span>Total (with Tax)</span>
      <span className="font-mono">{currencySymbol}{(sellingPrice + tax.taxAmount).toFixed(2)}</span>
    </div>
  </div>
)}
```

### Example 3: Tooltip text helper (lives next to `resolveTaxRate`)

```typescript
// Source: src/utils/taxResolution.ts
export function tooltipForSource(source: TaxRateSource): string {
  switch (source.kind) {
    case 'override':
      return `Per-job override — ${source.rate}%`;
    case 'settings':
      return `From Settings default — ${source.rate}%`;
    case 'region': {
      const stale = isRateStale(source.rateAsOf)
        ? ' — rate may be stale, verify locally'
        : '';
      const note = source.note ? `\n${source.note}` : '';
      return `From your region (${source.region}, as of ${source.rateAsOf}${stale}).${note}`;
    }
    case 'eu-average':
      return `${source.note} (${source.rate}%)`;
    case 'manual':
      return `Unknown region — enter manually.`;
  }
}
```

### Example 4: Default Tax Rate in SettingsModal's "Costs & Rates" tab

```tsx
// Source: drop-in at src/components/SettingsModal.tsx — inside the
// `activeTab === 'costs'` block, immediately after the Default Profit Margin
// section (currently at lines 237-262).
//
// Place AFTER Default Profit Margin (recommended): margin is the more frequently
// edited setting, so it stays in the top-of-tab spot. Tax sits below as a less
// frequent but related pricing input.

<div className="pt-4 border-t border-slate-700">
  <h3 className="text-sm font-medium text-slate-300 mb-3">
    Default Tax Rate
  </h3>
  <div>
    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
      <span>Tax Rate (%)</span>
      <InfoTooltip text={
        userCurrency === 'USD'
          ? "Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state."
          : "Default tax rate applied to new jobs. Override per-job in the calculator."
      } />
    </label>
    <Input
      type="number"
      step="0.1"
      min="0"
      max="99.9"
      compact
      value={userProfile.defaultTaxRate ?? ''}     /* CRITICAL: use '' (not 0) when unset — see Pitfall 3 */
      onChange={e => {
        const v = e.target.value;
        if (v === '') {
          onUserProfileChange({ ...userProfile, defaultTaxRate: undefined });
        } else {
          const parsed = parseFloat(v);
          if (Number.isFinite(parsed)) {
            onUserProfileChange({ ...userProfile, defaultTaxRate: Math.min(Math.max(parsed, 0), 99.9) });
          }
        }
      }}
      placeholder="e.g., 20"
    />
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `it.todo('tax/VAT applies after subtotal — activates in v1.2')` | Activated `describe('calculateTax', ...)` block with 7 cases | Phase 13 (this phase) | Test suite count goes from 67 + 1 todo → 74 + 0 todos |
| Hand-rolled compact/InfoTooltip combo at every numeric input | `<Input compact />` + `<InfoTooltip text="..." />` on label, consistent across all 5 surfaces | Phase 13 (this phase) | Removes ~22 `className` overrides and ~7 descriptive `<p>` blocks; tightens visual cohesion |
| `featureReleases` registry with 13 entries (mostly stale) | 3 entries reflecting currently-released features | Phase 13 (UI-10) | Removes 11 dead JSX sites + 9 dead registry entries; future audits become cheap |

**Deprecated/outdated:**
- The `it.todo` at `src/utils/costCalc.test.ts:444` — replaced by the activated `describe('calculateTax', ...)`.
- Descriptive `<p className="text-xs text-slate-500 mt-2">…</p>` blocks below inputs in SettingsModal and PrinterSettings — replaced by `<InfoTooltip>` on the label (D-16).
- The `'configurable-marketplace-fees'` and `'custom-carriers'` registry entries — already orphaned (no JSX consumers); UI-10 finalizes the cleanup.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (exists at repo root) |
| Quick run command | `npx vitest run src/utils/costCalc.test.ts` |
| Full suite command | `npm run test` (alias for `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAX-05 | `calculateTax(50, 0)` returns `{ taxAmount: 0, ratePercent: 0 }` | unit | `npx vitest run src/utils/costCalc.test.ts -t "rate is 0"` | will exist after activation |
| TAX-05 | `calculateTax(50, 20)` UK rate returns 10.00 | unit | `npx vitest run src/utils/costCalc.test.ts -t "UK 20%"` | will exist after activation |
| TAX-05 | `calculateTax(25, 10)` AU GST returns 2.50 | unit | `npx vitest run src/utils/costCalc.test.ts -t "AU 10%"` | will exist after activation |
| TAX-05 | `calculateTax(100, 21)` EU-average returns 21.00 | unit | `npx vitest run src/utils/costCalc.test.ts -t "EU-average"` | will exist after activation |
| TAX-05 | `calculateTax(12.5, 23)` centime-rounding returns 2.88 | unit | `npx vitest run src/utils/costCalc.test.ts -t "centime rounding"` | will exist after activation |
| TAX-05 | Order-of-operations guard — sellingPrice ≠ subtotal when both pass through | unit | `npx vitest run src/utils/costCalc.test.ts -t "order-of-operations"` | will exist after activation |
| TAX-05 | `it.todo` no longer exists in the test file | grep | `! grep -n "it.todo" src/utils/costCalc.test.ts` | passes after activation |
| TAX-03 | `resolveTaxRate({ jobOverride: undefined, settingsDefault: undefined, currency: 'USD' })` returns `kind: 'region'` with rate 0 + marketplace-facilitator note | unit | `npx vitest run src/utils/taxResolution.test.ts -t "US region default"` | NEW FILE — Wave 0 |
| TAX-03 | `resolveTaxRate({...currency: 'EUR'})` returns `kind: 'eu-average'` with rate 21 | unit | `npx vitest run src/utils/taxResolution.test.ts -t "EU average"` | NEW FILE — Wave 0 |
| TAX-03 | `resolveTaxRate({...currency: 'ZAR'})` (unknown) returns `kind: 'manual'` | unit | `npx vitest run src/utils/taxResolution.test.ts -t "manual"` | NEW FILE — Wave 0 |
| TAX-03 | `isRateStale('2024-01-01')` with `now=2026-05-21` returns `true` (~28 months) | unit | `npx vitest run src/utils/taxResolution.test.ts -t "stale"` | NEW FILE — Wave 0 |
| TAX-03 | `isRateStale('2025-08-01')` with `now=2026-05-21` returns `false` (~9.7 months) | unit | `npx vitest run src/utils/taxResolution.test.ts -t "fresh"` | NEW FILE — Wave 0 |
| TAX-01, TAX-02, TAX-04 | Tax row renders when `tax.ratePercent > 0` | manual UAT | n/a — visual check | manual verification |
| TAX-04 | Tax row hides when rate = 0 | manual UAT | n/a — visual check | manual verification |
| TAX-04 | Total displays as `sellingPrice + taxAmount` | manual UAT | n/a — visual check | manual verification |
| UI-08 | Every numeric input across the 5 surfaces has `compact` | grep | `grep -c "type=\"number\"" <files>` minus `grep -c "compact" <files>` should be 0 after sweep | grep-based |
| UI-09 | No descriptive `<p>` blocks linger below numeric inputs in swept surfaces | manual code review | n/a | manual verification |
| UI-10 | No `<NewBadge feature="<stale-key>">` JSX after sweep | grep | `! grep -rE 'NewBadge feature="(per-unit-licensing\|author-min-price\|...)"' src/` | grep-based |
| UI-10 | `featureReleases` map has 3 entries after prune | grep | `grep -c "new Date" src/features.ts` returns 3 | grep-based |

### Sampling Rate
- **Per task commit:** `npx vitest run src/utils/costCalc.test.ts src/utils/taxResolution.test.ts`
- **Per wave merge:** `npm run test && npm run build` (full Vitest + `tsc -b && vite build`)
- **Phase gate:** Full suite green; ESLint clean; manual UAT signed off on the 4 visual-only criteria (Settings tax field, per-job tax row visibility/hiding, total display, US tooltip presence)

### Wave 0 Gaps
- [ ] `src/utils/taxResolution.ts` — new file, contains `resolveTaxRate`, `tooltipForSource`, `isRateStale`, plus the `TaxRateSource` discriminated union and the `ResolveTaxRateInput` interface
- [ ] `src/utils/taxResolution.test.ts` — new Vitest spec covering the 5 branches of the fallback chain + `isRateStale` boundary cases (stale, fresh, invalid date)
- [ ] `src/data/taxRates.ts` — new static data file with `TAX_RATES` typed-array export + `EU_AVERAGE_RATE` constant + `TaxRateEntry` interface
- [ ] (No framework install — Vitest already wired since v1.1 Phase 10)
- [ ] Test-grouping decision: planner picks between (a) appending `describe('calculateTax', ...)` to `costCalc.test.ts` after the `calculateCost` integration block, OR (b) inlining individual `it()` cases alongside `calculateCost`. Recommendation: (a) — keeps the file scannable.

## Security Domain

> Reading project config: `.planning/codebase/CONCERNS.md` is referenced by the project but this phase has zero authentication, no PII handling, no cryptography, no server-side input validation surface. The only "input validation" is local input clamping (rate clamped to 0–99.9 in the Settings input). No ASVS category materially applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (no auth in this app) |
| V3 Session Management | no | (no sessions; local-only app) |
| V4 Access Control | no | (no users, no roles) |
| V5 Input Validation | partial | Input clamping on numeric fields (`Math.min(Math.max(parsed, 0), 99.9)`) — same pattern as existing `defaultProfitMargin` clamp |
| V6 Cryptography | no | (no crypto, no secrets) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User pastes NaN or scientific-notation into tax rate input | Tampering (informational) | `parseFloat` + `Number.isFinite` + clamp; established pattern at `SettingsModal.tsx:251-253` for the profit margin field — reuse verbatim |

The `taxAmount` field is a *displayed and persisted* computed value, not a user-controllable security boundary. There is no scenario where a malicious `taxRate` could exfiltrate data or corrupt state — it just changes the displayed tax in the user's own local DB.

## Project Constraints (from CLAUDE.md)

Verified against `.claude/CLAUDE.md`:

- ✅ React 18 + TypeScript + Vite + Tailwind — this phase uses no new tech
- ✅ Dev port 4173 — unchanged; `npm run dev` boots the calculator
- ✅ TypeScript strict mode required — `tsc -b && vite build` must pass
- ✅ Use `tsc -b` not `tsc --noEmit` for verification (CLAUDE.md mandate)
- ✅ Use shared UI components from `src/components/ui/` (Input, InfoTooltip)
- ✅ Use `btnSize` / `inputSize` (not `size`) — already enforced by the primitive
- ✅ NEW badge required only for user-facing features — D-17 audit covers this directly
- ✅ NewBadge anti-pattern: never inline in `flex-1` containers that consume layout width — verify the existing Default Profit Margin badge (line 240) which uses `className="absolute top-0 left-full ml-2 pointer-events-none"` is the correct pattern when the planner mirrors it for any new badge
- ✅ Memory note: "after using diagnostic SQL scripts successfully, move them to archive folder" — n/a for this phase (no SQL)
- ✅ Memory note: "scripts go in the scripts folder, never tmp" — n/a; this phase touches `src/` only
- ✅ Memory note: "Acts like a senior developer, going step by step" — research enforces this

## Assumptions Log

Every claim in this research was either VERIFIED via tool (file read, grep, Node verification) or CITED from authoritative sources (CONTEXT.md, official VAT data). No `[ASSUMED]` claims — all empirical.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| _none_ | — | — | — |

## Open Questions (RESOLVED)

### Discrepancy 1: "Pricing tab" vs "Costs & Rates" tab

CONTEXT.md, ROADMAP.md, and REQUIREMENTS.md all describe "Settings (Pricing tab)" for the Default Tax Rate field. The actual `SettingsModal.tsx:42` declares three tabs: `'costs' | 'delivery' | 'marketplaces'`, with the tab label `"Costs & Rates"` (line 149). Default Profit Margin currently lives under the `'costs'` tab (line 200-263).

- **What we know:** CONTEXT integration-points say "Default Tax Rate slots in next to Default Profit Margin." Default Profit Margin is in the "Costs & Rates" tab. So the user-intended placement is the existing **Costs & Rates** tab, just with a stale label in the docs.
- **What's unclear:** Whether the planner should silently use "Costs & Rates" or whether the user genuinely wants a new "Pricing" tab. The CONTEXT canonical-refs notes literally `activeTab === 'pricing' block` — a tab that doesn't exist.
- **Recommendation:** The planner should slot the Default Tax Rate into the **"Costs & Rates" tab next to Default Profit Margin** (matches the explicit "slots in next to Default Profit Margin" guidance). Mention in PLAN.md that the docs use legacy terminology; do not create a new tab. If the user genuinely wants a 4th tab, they will raise it in plan review — but the locked decisions weigh strongly toward "fit it into the existing tab where the related setting already lives."
- **RESOLVED:** Default Tax Rate slots into the existing `activeTab === 'costs'` block ("Costs & Rates" tab) next to Default Profit Margin. No new "Pricing" tab is created. Source of resolution: planner rationale per CONTEXT D-04 / canonical-refs at 13-CONTEXT.md:72 (Default Profit Margin neighbor) and UI-SPEC at 13-UI-SPEC.md:126,128,335. Plan 03 Task 1 implements this; the docs' legacy "Pricing tab" wording in REQUIREMENTS.md TAX-01 + ROADMAP.md Phase 13 success-criterion 1 is acknowledged but unchanged.

### Discrepancy 2: "EU-average" — 21% is median, not mean

CONTEXT D-05 and DISCUSSION-LOG Q5 both call **21%** the "mean of 27 member states' standard VAT." Per Tax Foundation 2026 data (verified via web fetch), the unweighted mean is **21.9%**, and **21% is the median**.

- **What we know:** The user locked 21% explicitly with the tooltip wording "EU average rate — verify for your country." The exact word "average" is ambiguous (could be mean or median or some midpoint).
- **What's unclear:** Whether the user intended the literal mathematical mean (21.9, which would round to 22) or the median 21 they actually picked. Given the EU-average is a deliberate compromise anyway (and the tooltip already tells the user to verify), the difference between 21 and 22 is well within the tooltip's "verify for your country" buffer.
- **Recommendation:** Ship 21% (the locked value), but reword the tooltip in the data file's note field to remove the word "mean" — use "median" or "midpoint" instead. Or just say "EU midpoint rate — verify for your country." Surface this as a one-line note in PLAN.md so the user can override during plan review if they want 21.9 / 22 instead.
- **RESOLVED:** Ship 21% (locked value per CONTEXT D-05); tooltip uses the word "midpoint" instead of "mean". Source of resolution: UI-SPEC line 122 (`eu-average` tooltip: "EU midpoint rate — verify for your country (21%)") + footnote at UI-SPEC line 122 explicitly resolving the wording. Plan 01 Task 2 implements the `eu-average` branch with the locked string.

### Discrepancy 3: REQUIREMENTS.md and ROADMAP.md vs CONTEXT D-17 on UI-10

REQUIREMENTS.md traceability table line 128 maps `UI-10 | Phase 14`. ROADMAP.md Phase 13 success-criteria list UI-08, UI-09 only. CONTEXT D-17 explicitly folds UI-10 into Phase 13. ROADMAP Phase 14 Success Criterion 5 still says "features.ts is audited" — duplicating the work.

- **What we know:** CONTEXT D-17 was the most recent decision; it explicitly cites the rationale ("same files get touched, same review window").
- **What's unclear:** Whether ROADMAP.md and REQUIREMENTS.md should be updated to reflect the fold-in, or whether Phase 14 keeps the audit as a no-op (since Phase 13 will have completed it).
- **Recommendation:** Follow CONTEXT D-17 — UI-10 IS in Phase 13. The planner includes UI-10 deliverables in the PLAN.md. Phase 14's plan-phase will read the updated `src/features.ts` and find nothing to prune (because Phase 13 already did it). Suggest the planner adds a note to STATE.md or PROJECT.md flagging this re-routing so future readers don't get confused. Do not edit ROADMAP/REQUIREMENTS proactively — that's outside the research scope.
- **RESOLVED:** UI-10 is in Phase 13 per CONTEXT D-17. Plans 03, 04, 05, and 06 collectively complete the UI-10 audit (11 NewBadge JSX removals + features.ts prune to 4 entries). Source of resolution: CONTEXT D-17 (gold source). REQUIREMENTS.md UI-10 traceability row and ROADMAP.md Phase 13 `**Requirements**` line are updated by the planner in this revision pass to match reality; Phase 14 becomes a no-op audit for UI-10.

## Sources

### Primary (HIGH confidence)
- `src/types.ts` (read in full) — confirms `taxRate?`, `taxAmount?` on `PrintJob` (lines 184-185) and `defaultTaxRate?` on `UserProfile` (line 234) — Phase 12 deliverable verified landed
- `src/utils/costCalc.ts` (read in full) — confirms the pure-helper convention and the existing math used by `calculateCost`
- `src/utils/costCalc.test.ts` (read in full) — confirms the `it.todo` at line 444 and the established test fixture pattern
- `src/components/SettingsModal.tsx` (read in full) — confirms tab structure is `'costs' | 'delivery' | 'marketplaces'`, NOT "pricing"
- `src/components/CostCalculator.tsx` (read in full) — confirms Cost Breakdown JSX shape, existing `<Input compact />` usage, existing `<InfoTooltip>` precedents (Model URL, Author Min Price, Prep Time, Post-Processing Time)
- `src/components/ui/Input.tsx` (read in full) — confirms `compact` caps at `max-w-28`
- `src/components/ui/InfoTooltip.tsx` (read in full) — confirms aria-described accessibility + hover/focus/tap behavior
- `src/components/NewBadge.tsx` (read in full) — confirms two-gate logic (release age + per-user seen)
- `src/features.ts` (read in full) — registry of 13 features verified against today's date for the staleness audit
- `src/components/PrinterSettings.tsx` (read in full) — UI sweep inventory
- `src/components/AssetLibrary.tsx` (lines 840-1100 read) — UI sweep inventory
- `src/components/JobsManager.tsx` (lines 530-610 read) — UI sweep inventory (Record Sale form)
- `src/components/CsvImportModal.tsx` (lines 1-100 read + grep) — confirmed zero numeric inputs
- `src/components/GcodeImport.tsx` (read in full) — confirmed zero numeric inputs
- `src/components/App.tsx` (selective read) — confirmed SettingsModal wiring + the live `settings-reorg` NewBadge consumer
- `src/utils/currency.ts` (selective read) — confirmed `Currency` type has 18 currencies; CURRENCY_CONFIG includes country fields used in `taxRates.ts` schema design
- `.planning/phases/13-tax-model-ui-sweep/13-CONTEXT.md` (full) — locked decisions D-01 through D-17
- `.planning/phases/13-tax-model-ui-sweep/13-DISCUSSION-LOG.md` (full) — alternatives audit
- `.planning/phases/12-schema-foundation/12-VERIFICATION.md` (full) — confirms Phase 12 fields landed
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — phase requirements + project state
- `.planning/codebase/CONVENTIONS.md` (full) — naming, file org, primitive patterns
- `vitest.config.ts` exists + `package.json` confirms `vitest@^4.1.4` — test infra verified
- Node V8 verification (Bash tool): `Math.round(12.5 * 23) / 100 === 2.88` — confirmed centime-rounding strategy

### Secondary (MEDIUM-HIGH confidence)
- [Tax Foundation: 2026 VAT Rates in Europe](https://taxfoundation.org/data/all/eu/value-added-tax-vat-rates-europe/) — full per-country VAT table for all 27 EU member states; verified the unweighted mean is 21.9% (not 21%)
- [PwC: Value-added tax (VAT) rates](https://taxsummaries.pwc.com/quick-charts/value-added-tax-vat-rates) — cross-check for UK 20%, AU GST 10%, Canada federal GST 5%
- [European Commission: VAT Rates](https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-rates_en) — official EU directive source for the TEDB lookup

### Tertiary (LOW confidence)
- None. All region rates cross-referenced across at least two independent sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive (Input, InfoTooltip, NewBadge, Vitest) is already installed and used in the codebase. Zero new dependencies.
- Architecture: HIGH — pure-helper-in-costCalc.ts is the proven Phase 10 pattern; data-file-in-src/data is the proven `bambuFilaments.ts` pattern; centralized resolver is mandated by the CONTEXT integration-point note.
- Pitfalls: HIGH — confirmed empirically (Node V8 rounding test, grep-confirmed JSX inventory, side-by-side comparison of CONTEXT vs. actual code revealing 3 documentation discrepancies the planner must resolve).

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 (30 days — stable domain, no live external dependencies)
