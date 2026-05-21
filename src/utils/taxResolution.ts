// Pure tax-resolution module — owns the fallback chain (override → settings →
// eu-average → region → manual). No React, no Dexie, no IO. Consumed by
// SettingsModal Default Tax Rate field and CostCalculator Tax row.

import type { Currency } from '../types';
import { TAX_RATES, EU_AVERAGE_RATE } from '../data/taxRates';

// Locked D-11 US marketplace-facilitator note. Appended to tooltipForSource
// output for ALL source.kind values when userCurrency === 'USD' (implements
// D-12 + D-13). The de-dup guard in tooltipForSource prevents double-append
// for the `region` US row, whose source.note already contains this string.
const US_NOTE =
  'Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.';

// Discriminated provenance for the resolved rate. Five variants — never extend
// without also extending tooltipForSource and the consumer call sites.
export type TaxRateSource =
  | { kind: 'override'; rate: number }
  | { kind: 'settings'; rate: number }
  | { kind: 'region'; rate: number; region: string; rateAsOf: string; note?: string }
  | { kind: 'eu-average'; rate: number; note: string }
  | { kind: 'manual'; rate: 0 };

// Fully-formed input to resolveTaxRate. The `| undefined` is explicit (not `?:`)
// so call sites can't silently drop a field.
export interface ResolveTaxRateInput {
  jobOverride: number | undefined;
  settingsDefault: number | undefined;
  currency: Currency;
}

// Chain order (locked, per TAX-03):
//   1. Per-job override (PrintJob.taxRate)
//   2. Settings default (UserProfile.defaultTaxRate)
//   3. EU-average branch (currency === 'EUR' — BEFORE the .find() to prevent
//      Pitfall 4: currency-keyed EU collapse where .find() returns the first
//      EUR row and silently uses that country's rate for all EUR users)
//   4. Region-table lookup by currency
//   5. Manual sentinel (unknown region — never silently default to 0% via
//      fallthrough; this is the explicit "enter manually" flag)
export function resolveTaxRate(input: ResolveTaxRateInput): TaxRateSource {
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
      note: row.note,
    };
  }
  return { kind: 'manual', rate: 0 };
}

// D-03 staleness: returns true when rateAsOf is more than 18 months before `now`.
// Uses 30.44 days/month (average) to dodge Pitfall 5 (timezone-dependent parsing
// flakiness at the boundary). Returns false for invalid date strings — defensive
// no-throw idiom matching the rest of the util layer.
export function isRateStale(rateAsOf: string, now: Date = new Date()): boolean {
  const asOf = new Date(rateAsOf);
  if (Number.isNaN(asOf.getTime())) return false;
  const ageMs = now.getTime() - asOf.getTime();
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
    case 'region': {
      const stale = isRateStale(source.rateAsOf)
        ? ' — rate may be stale, verify locally'
        : '';
      const note = source.note ? `\n${source.note}` : '';
      base = `From your region (${source.region}, as of ${source.rateAsOf}${stale}).${note}`;
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
