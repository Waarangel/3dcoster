// ---------------------------------------------------------------------------
// Pure jurisdiction-aware tax-threshold tracker (Phase 41 LIFE-02, D-13/14/15/16).
// Mirrors src/utils/periodRange.ts's { start; end; label } range shape and
// src/utils/salesReportAggregates.ts's convert()-over-sales summation pattern
// — but builds an INDEPENDENT jurisdiction window, not the PeriodPicker's
// RangeMode state (D-13: this is a separate concern from the Insights range
// picker). Deliberately sums GROSS Sale.totalRevenue (D-15) — never profit —
// because UK/DE/AU thresholds are legally defined on gross turnover.
// ---------------------------------------------------------------------------
import type { Currency, Sale, TaxJurisdiction } from '../types';
import { convert, type FxRateTable } from './fxConvert';

export interface TaxYearRange {
  start: Date;
  end: Date;
  /** e.g. "2026/27" for UK/AU (year straddles the boundary), "2026" for Jan-1 jurisdictions. */
  label: string;
}

/**
 * Tax-year start boundary per jurisdiction (0-indexed month, per Date convention).
 * Source: FEATURES.md §6 + live-verified UK 2026/27 figure (2026-07-09,
 * gov.uk/litrg.org.uk via WebSearch — see 41-RESEARCH.md "Verified UK trading
 * allowance"). DE/AU/US structural shape cross-checked against FEATURES.md §6,
 * not independently re-verified this session — carries the mandatory "data
 * current as of" disclaimer on the card regardless (D-16).
 */
export const TAX_YEAR_START: Record<TaxJurisdiction, { month: number; day: number }> = {
  UK: { month: 3, day: 6 },    // April 6
  AU: { month: 6, day: 1 },    // July 1
  DE: { month: 0, day: 1 },    // January 1
  US: { month: 0, day: 1 },    // January 1 (no bar — badges-of-trade note only)
  OTHER: { month: 0, day: 1 }, // Calendar year default for a user-defined custom threshold
};

interface ThresholdInfo {
  amount: number;
  currency: Currency;
  label: string;
}

/**
 * Fixed, research-sourced threshold table (D-16). US intentionally excluded —
 * it has no fixed-dollar threshold, only an informational "badges of trade"
 * note (no progress bar). 'OTHER' is intentionally excluded — its
 * amount/currency/label come from the user's own Settings entry, not this table.
 * Source: FEATURES.md §6; UK figure live-verified 2026-07-09 for the 2026/27
 * tax year (6 April 2026 – 5 April 2027), gross income before expenses.
 */
export const THRESHOLDS: Partial<Record<TaxJurisdiction, ThresholdInfo>> = {
  UK: { amount: 1000, currency: 'GBP', label: 'Trading Allowance' },
  DE: { amount: 25000, currency: 'EUR', label: 'Kleinunternehmer threshold' },
  AU: { amount: 75000, currency: 'AUD', label: 'GST registration threshold' },
};

/**
 * Resolve the current tax-year window for a jurisdiction relative to a
 * reference date (defaults to now). The window is the most recent
 * {month,day} boundary on/before referenceDate through one year later minus
 * 1ms — rolling back to the PRIOR calendar year's boundary when
 * referenceDate falls before this year's boundary (D-14).
 *
 * Examples:
 *   resolveTaxYearRange('UK', new Date('2026-05-01')) → { start: 2026-04-06, end: 2027-04-05T23:59:59.999, label: '2026/27' }
 *   resolveTaxYearRange('UK', new Date('2026-03-01')) → { start: 2025-04-06, end: 2026-04-05T23:59:59.999, label: '2025/26' } // rolls back — before this year's Apr 6
 *   resolveTaxYearRange('AU', new Date('2026-08-15')) → { start: 2026-07-01, end: 2027-06-30T23:59:59.999, label: '2026/27' }
 *   resolveTaxYearRange('DE', new Date('2026-08-15')) → { start: 2026-01-01, end: 2026-12-31T23:59:59.999, label: '2026' }
 *
 * Returns: TaxYearRange { start: Date; end: Date; label: string }
 */
export function resolveTaxYearRange(jurisdiction: TaxJurisdiction, referenceDate: Date = new Date()): TaxYearRange {
  const { month, day } = TAX_YEAR_START[jurisdiction];
  const refYear = referenceDate.getFullYear();

  // This calendar year's boundary date; roll back one year if referenceDate
  // falls before it (e.g. a March reference date is still inside the tax
  // year that started the PREVIOUS April 6).
  const boundaryThisYear = new Date(refYear, month, day, 0, 0, 0, 0);
  const startYear = referenceDate.getTime() < boundaryThisYear.getTime() ? refYear - 1 : refYear;

  const start = new Date(startYear, month, day, 0, 0, 0, 0);
  const end = new Date(startYear + 1, month, day, 0, 0, 0, 0);
  end.setMilliseconds(end.getMilliseconds() - 1);

  // Jan-1 jurisdictions get a plain calendar-year label; boundary-straddling
  // jurisdictions (UK/AU) get the "2026/27" shorthand.
  const label = (month === 0 && day === 1)
    ? String(startYear)
    : `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;

  return { start, end, label };
}

export interface TaxThresholdResult {
  hasBar: boolean;
  /** Present only when hasBar is true. All money fields are in userCurrency. */
  revenue?: number;
  threshold?: number;
  currency?: Currency;
  /** Threshold's display label, e.g. "Trading Allowance". */
  label?: string;
  /** Tax-year window label, e.g. "2026/27". */
  taxYearLabel?: string;
  fraction?: number;
  crossed?: boolean;
  /** Set only for US — no numeric threshold, informational note instead of a bar. */
  note?: 'badges-of-trade';
}

/**
 * Sum gross Sale.totalRevenue (D-15 — deliberately gross, not net-of-fees
 * profit) for sales whose soldAt falls within the jurisdiction's current tax
 * year, converted into userCurrency, and express it as a fraction of the
 * jurisdiction's threshold (UK/DE/AU thresholds are fixed in GBP/EUR/AUD —
 * also converted into userCurrency so `revenue / threshold` is a valid
 * same-currency comparison, never GBP-vs-USD arithmetic). Sales — and the
 * threshold itself — with no resolvable FX rate are skipped/return no-bar
 * (matches computeSalesReport/computePerSaleProfit's null-on-no-rate
 * contract) rather than guessed.
 *
 * US returns { hasBar: false, note: 'badges-of-trade' } — no fixed-dollar
 * threshold exists, so no progress bar is rendered (D-16). 'OTHER' requires
 * a positive customAmount (already in userCurrency — there's no separate
 * currency field for a user-defined threshold); without one it also renders
 * with no bar.
 *
 * Examples:
 *   computeTaxThresholdProgress(sales, 'UK', 'USD', fxTable) // sales in GBP/USD, threshold 1000 GBP
 *     → { hasBar: true, revenue: 530, threshold: 1270, currency: 'USD', label: 'Trading Allowance', taxYearLabel: '2026/27', fraction: 0.42, crossed: false }
 *   computeTaxThresholdProgress(sales, 'US', 'USD', fxTable) → { hasBar: false, note: 'badges-of-trade' }
 *   computeTaxThresholdProgress(sales, 'OTHER', 'CAD', fxTable, { amount: 5000, label: 'My province threshold' })
 *     → { hasBar: true, revenue: ..., threshold: 5000, currency: 'CAD', label: 'My province threshold', ... }
 *
 * Returns: TaxThresholdResult
 */
export function computeTaxThresholdProgress(
  sales: Sale[],
  jurisdiction: TaxJurisdiction,
  userCurrency: Currency,
  fxTable: FxRateTable | null,
  custom?: { amount: number; label: string },
): TaxThresholdResult {
  if (jurisdiction === 'US') {
    return { hasBar: false, note: 'badges-of-trade' };
  }

  const thresholdInfo: ThresholdInfo | undefined = jurisdiction === 'OTHER'
    ? (custom && Number.isFinite(custom.amount) && custom.amount > 0
      ? { amount: custom.amount, currency: userCurrency, label: custom.label || 'Custom threshold' }
      : undefined)
    : THRESHOLDS[jurisdiction];

  if (!thresholdInfo) {
    return { hasBar: false };
  }

  // Convert the fixed threshold amount (GBP/EUR/AUD, or already userCurrency
  // for OTHER) into userCurrency once, up front — a missing rate here means
  // we cannot render a truthful bar at all (never guess, D-16 spirit).
  const thresholdInUserCurrency = convert(thresholdInfo.amount, thresholdInfo.currency, userCurrency, fxTable);
  if (thresholdInUserCurrency === null) {
    return { hasBar: false };
  }

  const range = resolveTaxYearRange(jurisdiction);
  const start = range.start.getTime();
  const end = range.end.getTime();

  let revenue = 0;
  for (const sale of sales) {
    const t = sale.soldAt.getTime();
    if (t < start || t > end) continue;
    const from = sale.currency ?? userCurrency;
    const converted = convert(sale.totalRevenue, from, userCurrency, fxTable);
    if (converted === null) continue; // no rate — skip rather than guess (matches salesReportAggregates)
    revenue += converted;
  }

  const fraction = thresholdInUserCurrency > 0 ? revenue / thresholdInUserCurrency : 0;

  return {
    hasBar: true,
    revenue,
    threshold: thresholdInUserCurrency,
    currency: userCurrency,
    label: thresholdInfo.label,
    taxYearLabel: range.label,
    fraction,
    crossed: revenue >= thresholdInUserCurrency,
  };
}
