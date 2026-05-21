// Static tax-rate table keyed off Currency for the resolveTaxRate fallback chain.
// 27 EU member states + UK + AU + CA + US. EU is consumed via the EU_AVERAGE_RATE
// branch in resolveTaxRate (D-05); per-country rows are reference data (not hit by
// the currency-keyed lookup today, kept for future country-keyed lookup).
// Source: Tax Foundation 2026 VAT Rates + EU Commission TEDB.

import type { Currency } from '../types';

export interface TaxRateEntry {
  currency: Currency;
  region: string;
  label: string;
  rate: number;
  // Date the rate was last changed by the taxing authority (e.g., Sweden's
  // 25% has been effective since 1996-01-01). Stable; only updates when the
  // statutory rate actually moves.
  rateAsOf: string;
  // Date 3DCoster last verified this row against an authoritative source.
  // This is what the staleness check uses — `rateAsOf` can be 20 years old
  // and still correct, but `lastVerified` should refresh every release.
  lastVerified: string;
  note?: string;
}

// Bumped on every release that re-verifies the rate table against an
// authoritative source (Tax Foundation, EU Commission TEDB, gov.uk/HMRC,
// ato.gov.au, canada.ca). Applied to every TAX_RATES row by default; rows
// with a more recent change carry their own `lastVerified` if it predates
// this bump (none today — all rows verified at this date).
export const TAX_RATES_VERIFIED_AT = '2026-05-21';

// EU-average compromise per D-05.
// Note: D-05 calls 21% the "mean", but the actual unweighted mean of 27 EU standard
// rates is 21.9% (Tax Foundation 2026). 21% is the MEDIAN. The user locked 21% in
// the discussion — keep it. See RESEARCH Discrepancy 2.
export const EU_AVERAGE_RATE = 21;

// D-11 / D-12 / D-13 locked string — appended to USD tooltips wherever the
// active TaxRateSource doesn't already carry it inline. Single source of truth
// so the de-dup guard in tooltipForSource compares against THIS constant, not
// a duplicated copy that can silently drift.
export const US_MARKETPLACE_FACILITATOR_NOTE =
  'Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.';

// All rows verified against authoritative source on TAX_RATES_VERIFIED_AT.
// `rateAsOf` is the statutory effective date (when the taxing authority last
// changed it). `lastVerified` is the date 3DCoster checked the row.
const V = TAX_RATES_VERIFIED_AT;

export const TAX_RATES: readonly TaxRateEntry[] = [
  // ─── Currency-keyed lookup rows (the ones the resolveTaxRate chain actually hits today) ───
  { currency: 'USD', region: 'US', label: 'United States', rate: 0, rateAsOf: '2025-01-01', lastVerified: V,
    note: US_MARKETPLACE_FACILITATOR_NOTE },
  { currency: 'GBP', region: 'GB', label: 'United Kingdom', rate: 20, rateAsOf: '2011-01-04', lastVerified: V },
  { currency: 'AUD', region: 'AU', label: 'Australia', rate: 10, rateAsOf: '2000-07-01', lastVerified: V },
  { currency: 'CAD', region: 'CA', label: 'Canada (federal GST)', rate: 5, rateAsOf: '2008-01-01', lastVerified: V,
    note: 'Federal GST only. Provincial sales tax (PST/HST) varies — override for your province.' },
  // EU is handled by the EU_AVERAGE_RATE branch in resolveTaxRate (D-05), but the
  // 27 country rows below are kept as reference data for future country-keyed lookup.
  // Sweden (SEK/SE) is the 5th currency-keyed lookup row AND one of the 27 EU member
  // state rows — listed once below in the EU block.

  // ─── 27 EU member states (reference rows; Sweden also serves as the SEK currency lookup) ───
  // Source: Tax Foundation "2026 VAT Rates in Europe" + EU Commission TEDB.
  // Non-EUR-currency EU members (CZ/DK/PL/SE) carry their native currency tag so the
  // currency-keyed .find() resolves correctly. HU/RO/BG/HR use their local currency
  // in real life, but those currencies are not in the Currency union — kept as EUR
  // reference rows since they will never be hit by the currency-keyed lookup.
  { currency: 'EUR', region: 'AT', label: 'Austria',     rate: 20,   rateAsOf: '2023-01-01', lastVerified: V },
  { currency: 'EUR', region: 'BE', label: 'Belgium',     rate: 21,   rateAsOf: '1996-01-01', lastVerified: V },
  { currency: 'EUR', region: 'BG', label: 'Bulgaria',    rate: 20,   rateAsOf: '1999-01-01', lastVerified: V },
  { currency: 'EUR', region: 'HR', label: 'Croatia',     rate: 25,   rateAsOf: '2012-03-01', lastVerified: V },
  { currency: 'EUR', region: 'CY', label: 'Cyprus',      rate: 19,   rateAsOf: '2014-01-13', lastVerified: V },
  { currency: 'CZK', region: 'CZ', label: 'Czech Rep.',  rate: 21,   rateAsOf: '2013-01-01', lastVerified: V },
  { currency: 'DKK', region: 'DK', label: 'Denmark',     rate: 25,   rateAsOf: '1992-01-01', lastVerified: V },
  { currency: 'EUR', region: 'EE', label: 'Estonia',     rate: 24,   rateAsOf: '2025-07-01', lastVerified: V },
  { currency: 'EUR', region: 'FI', label: 'Finland',     rate: 25.5, rateAsOf: '2024-09-01', lastVerified: V },
  { currency: 'EUR', region: 'FR', label: 'France',      rate: 20,   rateAsOf: '2014-01-01', lastVerified: V },
  { currency: 'EUR', region: 'DE', label: 'Germany',     rate: 19,   rateAsOf: '2007-01-01', lastVerified: V },
  { currency: 'EUR', region: 'GR', label: 'Greece',      rate: 24,   rateAsOf: '2016-06-01', lastVerified: V },
  { currency: 'EUR', region: 'HU', label: 'Hungary',     rate: 27,   rateAsOf: '2012-01-01', lastVerified: V },
  { currency: 'EUR', region: 'IE', label: 'Ireland',     rate: 23,   rateAsOf: '2012-01-01', lastVerified: V },
  { currency: 'EUR', region: 'IT', label: 'Italy',       rate: 22,   rateAsOf: '2013-10-01', lastVerified: V },
  { currency: 'EUR', region: 'LV', label: 'Latvia',      rate: 21,   rateAsOf: '2012-07-01', lastVerified: V },
  { currency: 'EUR', region: 'LT', label: 'Lithuania',   rate: 21,   rateAsOf: '2009-09-01', lastVerified: V },
  { currency: 'EUR', region: 'LU', label: 'Luxembourg',  rate: 17,   rateAsOf: '2024-01-01', lastVerified: V },
  { currency: 'EUR', region: 'MT', label: 'Malta',       rate: 18,   rateAsOf: '2004-01-01', lastVerified: V },
  { currency: 'EUR', region: 'NL', label: 'Netherlands', rate: 21,   rateAsOf: '2012-10-01', lastVerified: V },
  { currency: 'PLN', region: 'PL', label: 'Poland',      rate: 23,   rateAsOf: '2011-01-01', lastVerified: V },
  { currency: 'EUR', region: 'PT', label: 'Portugal',    rate: 23,   rateAsOf: '2011-01-01', lastVerified: V },
  { currency: 'EUR', region: 'RO', label: 'Romania',     rate: 21,   rateAsOf: '2025-08-01', lastVerified: V },
  { currency: 'EUR', region: 'SK', label: 'Slovakia',    rate: 23,   rateAsOf: '2025-01-01', lastVerified: V },
  { currency: 'EUR', region: 'SI', label: 'Slovenia',    rate: 22,   rateAsOf: '2013-07-01', lastVerified: V },
  { currency: 'EUR', region: 'ES', label: 'Spain',       rate: 21,   rateAsOf: '2012-09-01', lastVerified: V },
  { currency: 'SEK', region: 'SE', label: 'Sweden',      rate: 25,   rateAsOf: '1996-01-01', lastVerified: V },
];
