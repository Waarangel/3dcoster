// Pure tax-resolution module — owns the fallback chain (override → settings →
// eu-average → region → manual). No React, no Dexie, no IO. Consumed by
// SettingsModal Default Tax Rate field and CostCalculator Tax row.

import type { Currency } from '../types';
import { TAX_RATES, EU_AVERAGE_RATE, US_MARKETPLACE_FACILITATOR_NOTE, findProvincialEntry } from '../data/taxRates';

// Re-export under the local name used by the tooltip de-dup guard. Single
// source of truth lives in taxRates.ts — the US row's `note` field uses the
// same constant by reference, so the includes() check below is back-stopped
// by reference equality, not byte-equality.
const US_NOTE = US_MARKETPLACE_FACILITATOR_NOTE;

// Discriminated provenance for the resolved rate. Six variants — never extend
// without also extending tooltipForSource and the consumer call sites.
//
// `region` is the country-level lookup (currency-keyed or address-keyed).
// `province` is the sub-national lookup (Canada only today) — strictly more
// specific than region, so it wins when address.province is recognised.
export type TaxRateSource =
  | { kind: 'override'; rate: number }
  | { kind: 'settings'; rate: number }
  | { kind: 'province'; rate: number; provinceCode: string; provinceName: string; countryCode: string; rateAsOf: string; lastVerified: string; note?: string }
  | { kind: 'region'; rate: number; region: string; rateAsOf: string; lastVerified: string; note?: string }
  | { kind: 'eu-average'; rate: number; note: string }
  | { kind: 'manual'; rate: 0 };

// Fully-formed input to resolveTaxRate. The `| undefined` is explicit (not `?:`)
// so call sites can't silently drop a field.
export interface ResolveTaxRateInput {
  jobOverride: number | undefined;
  settingsDefault: number | undefined;
  currency: Currency;
  // Seller's address. When `country` is set, address-keyed lookup runs BEFORE
  // currency-keyed lookup so Canadian sellers get their provincial combined
  // rate (e.g., Ontario 13% HST) instead of the federal-GST default (5%).
  // `province` is freeform user input — matched case-insensitively against
  // province code / name / aliases (see findProvincialEntry in taxRates.ts).
  address: { country?: string; province?: string } | undefined;
}

// Chain order (locked, per TAX-03 — extended in v1.2 with address-aware steps):
//   1. Per-job override (PrintJob.taxRate)
//   2. Settings default (UserProfile.defaultTaxRate)
//   3. Provincial lookup (address.country + address.province → combined rate;
//      Canada only today; strictly more specific than country/currency)
//   4. Country lookup by address (address.country → TAX_RATES row by `region`
//      code; surfaces previously-dead EU country rows for EUR-currency users)
//   5. EU-average branch (currency === 'EUR' with no resolvable address —
//      kept BEFORE the currency .find() to prevent Pitfall 4)
//   6. Region-table lookup by currency
//   7. Manual sentinel (unknown region — never silently default to 0% via
//      fallthrough; this is the explicit "enter manually" flag)
export function resolveTaxRate(input: ResolveTaxRateInput): TaxRateSource {
  if (typeof input.jobOverride === 'number') {
    return { kind: 'override', rate: input.jobOverride };
  }
  if (typeof input.settingsDefault === 'number') {
    return { kind: 'settings', rate: input.settingsDefault };
  }
  const province = findProvincialEntry(input.address?.country, input.address?.province);
  if (province) {
    return {
      kind: 'province',
      rate: province.rate,
      provinceCode: province.provinceCode,
      provinceName: province.provinceName,
      countryCode: province.countryCode,
      rateAsOf: province.rateAsOf,
      lastVerified: province.lastVerified,
      note: province.note,
    };
  }
  if (input.address?.country) {
    const country = input.address.country.trim().toUpperCase();
    const row = TAX_RATES.find(r => r.region === country);
    if (row) {
      return {
        kind: 'region',
        rate: row.rate,
        region: row.region,
        rateAsOf: row.rateAsOf,
        lastVerified: row.lastVerified,
        note: row.note,
      };
    }
  }
  if (input.currency === 'EUR') {
    return {
      kind: 'eu-average',
      rate: EU_AVERAGE_RATE,
      note: 'EU midpoint rate — verify for your country',
    };
  }
  const row = TAX_RATES.find(r => r.currency === input.currency);
  if (row) {
    return {
      kind: 'region',
      rate: row.rate,
      region: row.region,
      rateAsOf: row.rateAsOf,
      lastVerified: row.lastVerified,
      note: row.note,
    };
  }
  return { kind: 'manual', rate: 0 };
}

// D-03 staleness: returns true when the input date is more than 18 months
// before `now`. Intended to be called against `lastVerified` (the date
// 3DCoster checked the row) — NOT `rateAsOf` (the statutory effective date).
// Sweden's 25% has been in force since 1996-01-01 and that's still correct
// today; what matters is "did anyone check recently".
// Uses 30.44 days/month (average) to dodge Pitfall 5 (timezone-dependent
// parsing flakiness at the boundary). Returns false for invalid date strings
// — defensive no-throw idiom matching the rest of the util layer.
export function isRateStale(date: string, now: Date = new Date()): boolean {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;
  const ageMs = now.getTime() - parsed.getTime();
  const monthsApprox = ageMs / (1000 * 60 * 60 * 24 * 30.44);
  return monthsApprox > 18;
}

// Tooltip body for the active TaxRateSource. The `userCurrency` argument powers
// D-12 / D-13: when the user is in USD, the locked marketplace-facilitator note
// is appended for ALL source.kind values (not just `region`). The de-dup guard
// at the end skips the append when the base string already contains the US note
// (i.e. the `region` US row, whose source.note carries the string inline).
export function tooltipForSource(source: TaxRateSource, userCurrency: Currency): string {
  let base: string;
  switch (source.kind) {
    case 'override':
      base = `Per-job override — ${source.rate}%`;
      break;
    case 'settings':
      base = `From Settings default — ${source.rate}%`;
      break;
    case 'province': {
      // Staleness judged on `lastVerified`, same as region branch.
      const stale = isRateStale(source.lastVerified)
        ? ' — verify locally, may be out of date'
        : '';
      const note = source.note ? `\n${source.note}` : '';
      base = `From your address (${source.provinceName}, ${source.countryCode} — ${source.rate}%, effective since ${source.rateAsOf}; verified ${source.lastVerified}${stale}).${note}`;
      break;
    }
    case 'region': {
      // Staleness is judged on `lastVerified` (when we checked the row),
      // NOT `rateAsOf` (the statutory effective date). A 1996 rate that's still
      // correct today is not stale — it just hasn't changed in 30 years.
      const stale = isRateStale(source.lastVerified)
        ? ' — verify locally, may be out of date'
        : '';
      const note = source.note ? `\n${source.note}` : '';
      base = `From your region (${source.region} — ${source.rate}%, effective since ${source.rateAsOf}; verified ${source.lastVerified}${stale}).${note}`;
      break;
    }
    case 'eu-average':
      base = `${source.note} (${source.rate}%)`;
      break;
    case 'manual':
      base = "Unknown region — enter manually. We don't have a default rate for your currency yet.";
      break;
  }

  // D-12 + D-13: USD-append. De-dup guard skips append when the base already
  // contains the US note (region US row carries it inline via source.note).
  if (userCurrency === 'USD' && !base.includes(US_NOTE)) {
    return `${base}\n${US_NOTE}`;
  }
  return base;
}

// Compact provenance label shown inline next to the Tax row rate, so the
// fallback-chain source is visible without hovering the InfoTooltip.
// Pairs with tooltipForSource — same source kinds, terser form.
export function labelForSource(source: TaxRateSource): string {
  switch (source.kind) {
    case 'override': return 'per-job override';
    case 'settings': return 'Settings default';
    case 'province': return `${source.provinceName}, ${source.countryCode}`;
    case 'region': return `${source.region} region`;
    case 'eu-average': return 'EU midpoint';
    case 'manual': return 'manual';
  }
}

// ============================================
// PDF quote helpers (Phase 16)
// ============================================

// EU27 ISO 3166-1 alpha-2 codes — used by taxLabelFor() below.
// Note: uses GR (ISO standard for Greece) not EL (Eurostat notation).
// ES is intentionally in this set — EU check fires FIRST in taxLabelFor,
// so ES → 'VAT' even though MX → 'IVA'. See RESEARCH.md Pattern 9.
const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
  'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

// Region-aware tax label for PDF quote (D-06).
// Branch order: EU check fires FIRST (so ES → 'VAT' despite appearing in IVA list
// per CONTEXT.md D-06 — EU sellers expect 'VAT'; deliberate trade-off per Pattern 9).
export function taxLabelFor(countryCode?: string): 'VAT' | 'GST' | 'IVA' | 'Sales Tax' | 'Tax' {
  if (!countryCode) return 'Tax';
  const code = countryCode.trim().toUpperCase();
  if (!code) return 'Tax';
  if (EU_COUNTRY_CODES.has(code) || code === 'GB') return 'VAT';
  if (['AU', 'NZ', 'IN', 'CA'].includes(code)) return 'GST';
  if (['ES', 'MX'].includes(code)) return 'IVA';
  if (code === 'US') return 'Sales Tax';
  return 'Tax';
}
