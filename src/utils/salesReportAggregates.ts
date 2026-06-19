// ---------------------------------------------------------------------------
// Sales report aggregation (v1.8, feature #33). Pure `aggregate()` half of the
// aggregate()->render() split: no jsPDF, no React, fully unit-testable. The PDF
// renderer (src/pdf/generateSalesReportPdf.ts) consumes SalesReportData only, so
// a future Pro scheduled/emailed/branded report wraps the SAME computation.
//
// Money fields are per-record snapshot currencies (Sale.currency, PrintJob.currency
// — undefined on legacy rows = the user's currency) converted to userCurrency via
// the cached FX table. Same null-contract as computeJobsAggregates: when any
// in-scope conversion has no rate, the affected total is null (never a guessed
// cross-currency sum) and `hasPartialData` flags it.
// ---------------------------------------------------------------------------
import type { Sale, PrintJob, Currency, MarketplaceType } from '../types';
import { convert, type FxRateTable } from './fxConvert';

export interface SalesReportRange {
  start: Date;   // inclusive
  end: Date;     // inclusive (callers set to end-of-day)
  label: string; // e.g. "June 2026", "2026", "Apr 15 – Jun 18, 2026"
}

export interface MarketplaceSummary {
  marketplace: MarketplaceType;
  saleCount: number;
  itemCount: number;
  grossRevenue: number | null;
  fees: number | null;
  netRevenue: number | null;
}

export interface SalesReportData {
  range: SalesReportRange;
  userCurrency: Currency;
  saleCount: number;
  itemCount: number;
  grossRevenue: number | null;
  fees: number | null;
  netRevenue: number | null;   // gross - fees
  cost: number | null;         // Σ (job.costPerUnit × sale.quantity)
  profit: number | null;       // net - cost
  byMarketplace: MarketplaceSummary[];
  hasPartialData: boolean;
}

const NONE: MarketplaceType = 'none';

interface Bucket {
  saleCount: number;
  itemCount: number;
  gross: number;
  fees: number;
  available: boolean;
}

/**
 * Aggregate sales within a date range into a tax-/loan-ready summary.
 *
 * Examples:
 *   computeSalesReport(sales, jobsById, { start, end, label: 'June 2026' }, 'CAD', fx)
 *     → { saleCount, itemCount, grossRevenue, fees, netRevenue, cost, profit, byMarketplace, hasPartialData }
 */
export function computeSalesReport(
  sales: Sale[],
  jobsById: Map<string, PrintJob>,
  range: SalesReportRange,
  userCurrency: Currency,
  fxTable: FxRateTable | null,
): SalesReportData {
  const buckets = new Map<MarketplaceType, Bucket>();
  const bucketFor = (mk: MarketplaceType): Bucket => {
    let b = buckets.get(mk);
    if (!b) { b = { saleCount: 0, itemCount: 0, gross: 0, fees: 0, available: true }; buckets.set(mk, b); }
    return b;
  };

  let saleCount = 0;
  let itemCount = 0;
  let gross = 0;
  let fees = 0;
  let cost = 0;
  let moneyAvailable = true; // gross/fee conversions
  let costAvailable = true;  // cost conversions

  const start = range.start.getTime();
  const end = range.end.getTime();

  for (const sale of sales) {
    const t = sale.soldAt.getTime();
    if (t < start || t > end) continue;

    const mk = sale.marketplace ?? NONE;
    const b = bucketFor(mk);
    saleCount += 1;
    itemCount += sale.quantity;
    b.saleCount += 1;
    b.itemCount += sale.quantity;

    const from = sale.currency ?? userCurrency;
    const g = convert(sale.totalRevenue, from, userCurrency, fxTable);
    const f = convert(sale.marketplaceFee ?? 0, from, userCurrency, fxTable);
    if (g === null || f === null) {
      b.available = false;
      moneyAvailable = false;
    } else {
      if (b.available) { b.gross += g; b.fees += f; }
      if (moneyAvailable) { gross += g; fees += f; }
    }

    const job = jobsById.get(sale.jobId);
    const costNative = (job?.costPerUnit ?? 0) * sale.quantity;
    const c = convert(costNative, job?.currency ?? userCurrency, userCurrency, fxTable);
    if (c === null) costAvailable = false;
    else if (costAvailable) cost += c;
  }

  const byMarketplace: MarketplaceSummary[] = [...buckets.entries()]
    .map(([marketplace, b]) => ({
      marketplace,
      saleCount: b.saleCount,
      itemCount: b.itemCount,
      grossRevenue: b.available ? b.gross : null,
      fees: b.available ? b.fees : null,
      netRevenue: b.available ? b.gross - b.fees : null,
    }))
    .sort((a, z) => z.saleCount - a.saleCount);

  const grossRevenue = moneyAvailable ? gross : null;
  const totalFees = moneyAvailable ? fees : null;
  const netRevenue = moneyAvailable ? gross - fees : null;
  const totalCost = costAvailable ? cost : null;
  const profit = moneyAvailable && costAvailable ? gross - fees - cost : null;

  return {
    range,
    userCurrency,
    saleCount,
    itemCount,
    grossRevenue,
    fees: totalFees,
    netRevenue,
    cost: totalCost,
    profit,
    byMarketplace,
    hasPartialData: !moneyAvailable || !costAvailable,
  };
}
