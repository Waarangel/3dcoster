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
  rateAsOf: string;
  note?: string;
}

// EU-average compromise per D-05.
// Note: D-05 calls 21% the "mean", but the actual unweighted mean of 27 EU standard
// rates is 21.9% (Tax Foundation 2026). 21% is the MEDIAN. The user locked 21% in
// the discussion — keep it. See RESEARCH Discrepancy 2.
export const EU_AVERAGE_RATE = 21;

export const TAX_RATES: readonly TaxRateEntry[] = [
  // ─── Currency-keyed lookup rows (the ones the resolveTaxRate chain actually hits today) ───
  { currency: 'USD', region: 'US', label: 'United States', rate: 0, rateAsOf: '2025-01-01',
    note: 'Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.' },
  { currency: 'GBP', region: 'GB', label: 'United Kingdom', rate: 20, rateAsOf: '2011-01-04' },
  { currency: 'AUD', region: 'AU', label: 'Australia', rate: 10, rateAsOf: '2000-07-01' },
  { currency: 'CAD', region: 'CA', label: 'Canada (federal GST)', rate: 5, rateAsOf: '2008-01-01',
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
  { currency: 'EUR', region: 'AT', label: 'Austria',     rate: 20,   rateAsOf: '2023-01-01' },
  { currency: 'EUR', region: 'BE', label: 'Belgium',     rate: 21,   rateAsOf: '1996-01-01' },
  { currency: 'EUR', region: 'BG', label: 'Bulgaria',    rate: 20,   rateAsOf: '1999-01-01' },
  { currency: 'EUR', region: 'HR', label: 'Croatia',     rate: 25,   rateAsOf: '2012-03-01' },
  { currency: 'EUR', region: 'CY', label: 'Cyprus',      rate: 19,   rateAsOf: '2014-01-13' },
  { currency: 'CZK', region: 'CZ', label: 'Czech Rep.',  rate: 21,   rateAsOf: '2013-01-01' },
  { currency: 'DKK', region: 'DK', label: 'Denmark',     rate: 25,   rateAsOf: '1992-01-01' },
  { currency: 'EUR', region: 'EE', label: 'Estonia',     rate: 24,   rateAsOf: '2025-07-01' },
  { currency: 'EUR', region: 'FI', label: 'Finland',     rate: 25.5, rateAsOf: '2024-09-01' },
  { currency: 'EUR', region: 'FR', label: 'France',      rate: 20,   rateAsOf: '2014-01-01' },
  { currency: 'EUR', region: 'DE', label: 'Germany',     rate: 19,   rateAsOf: '2007-01-01' },
  { currency: 'EUR', region: 'GR', label: 'Greece',      rate: 24,   rateAsOf: '2016-06-01' },
  { currency: 'EUR', region: 'HU', label: 'Hungary',     rate: 27,   rateAsOf: '2012-01-01' },
  { currency: 'EUR', region: 'IE', label: 'Ireland',     rate: 23,   rateAsOf: '2012-01-01' },
  { currency: 'EUR', region: 'IT', label: 'Italy',       rate: 22,   rateAsOf: '2013-10-01' },
  { currency: 'EUR', region: 'LV', label: 'Latvia',      rate: 21,   rateAsOf: '2012-07-01' },
  { currency: 'EUR', region: 'LT', label: 'Lithuania',   rate: 21,   rateAsOf: '2009-09-01' },
  { currency: 'EUR', region: 'LU', label: 'Luxembourg',  rate: 17,   rateAsOf: '2024-01-01' },
  { currency: 'EUR', region: 'MT', label: 'Malta',       rate: 18,   rateAsOf: '2004-01-01' },
  { currency: 'EUR', region: 'NL', label: 'Netherlands', rate: 21,   rateAsOf: '2012-10-01' },
  { currency: 'PLN', region: 'PL', label: 'Poland',      rate: 23,   rateAsOf: '2011-01-01' },
  { currency: 'EUR', region: 'PT', label: 'Portugal',    rate: 23,   rateAsOf: '2011-01-01' },
  { currency: 'EUR', region: 'RO', label: 'Romania',     rate: 21,   rateAsOf: '2025-08-01' },
  { currency: 'EUR', region: 'SK', label: 'Slovakia',    rate: 23,   rateAsOf: '2025-01-01' },
  { currency: 'EUR', region: 'SI', label: 'Slovenia',    rate: 22,   rateAsOf: '2013-07-01' },
  { currency: 'EUR', region: 'ES', label: 'Spain',       rate: 21,   rateAsOf: '2012-09-01' },
  { currency: 'SEK', region: 'SE', label: 'Sweden',      rate: 25,   rateAsOf: '1996-01-01' },
];
