// ---------------------------------------------------------------------------
// Insight Layer — pure derivations (Phase 40 INS-01/02/03). No React, no
// Dexie, no forked pricing math. Every historical money number reuses
// computePerSaleProfit (salesReportAggregates.ts, the same net-of-fees
// contract computeSalesReport already uses); the what-if scenario (INS-03)
// reuses calculateCost (costCalc.ts). This file must never re-derive a
// second cost or profit formula (PITFALLS C-03 / D-16).
// ---------------------------------------------------------------------------
import type {
  Asset,
  Currency,
  FailureEvent,
  MaintenanceEvent,
  PrintJob,
  PrinterConfig,
  PrinterInstance,
  Sale,
} from '../types';
import type { FxRateTable } from './fxConvert';
import { computePerSaleProfit } from './salesReportAggregates';
import { computePrintHourProfit, type PrintHourTone } from './printHourProfit';
import { deriveMaintenanceAmortization } from '../db/maintenanceAmortization';

/** Never a real printerInstanceId — the D-08 bucket for sales whose job has no printer assignment. */
const UNASSIGNED_KEY = 'unassigned';

function finite(n: number | undefined | null): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// INS-01: Product ranking + true hourly wage headline
// ---------------------------------------------------------------------------

/**
 * D-01: exact normalized (trim + lowercase) title match — no fuzzy grouping.
 * 'phone stand v2' and 'Phone Stand' are intentionally DIFFERENT products.
 *
 * Examples:
 *   normalizeProductKey('  Phone Stand ') → 'phone stand'
 *   normalizeProductKey('Phone Stand v2') → 'phone stand v2'
 */
export function normalizeProductKey(name: string): string {
  return name.trim().toLowerCase();
}

export interface ProductEarner {
  key: string;
  /** The first-encountered job name for this product (original casing, for display). */
  name: string;
  jobIds: string[];
  saleCount: number;
  copiesSold: number;
  /** Net-of-fees profit summed across every sale for this product; null when any FX conversion is unavailable. */
  totalProfit: number | null;
  /** Σ (job.printTimeHours × sale.quantity) across every sale for this product. */
  totalPrinterHours: number;
  /** totalProfit / totalPrinterHours (same grading as computePrintHourProfit); null when unavailable. */
  profitPerHour: number | null;
  tone: PrintHourTone;
}

export interface UnsoldProduct {
  key: string;
  name: string;
  jobIds: string[];
  copiesSold: number;
}

export interface ProductRankingResult {
  /** Sorted highest profit-per-hour first; entries with an unavailable rate sort last. */
  ranked: ProductEarner[];
  unsold: UnsoldProduct[];
  hasPartialData: boolean;
}

interface ProductGroup {
  key: string;
  name: string;
  jobIds: string[];
  copiesSold: number;
  saleCount: number;
  totalProfit: number;
  totalPrinterHours: number;
  hasSales: boolean;
  profitAvailable: boolean;
}

/**
 * D-02: only products with >=1 recorded Sale rank, using actual net-of-fees
 * sale profit — never modeled/asking-price numbers. A product with
 * copiesSold > 0 but zero Sale rows lands in `unsold`, never in `ranked`.
 * The per-hour grade reuses computePrintHourProfit (D-14) — the already-netted
 * totalProfit is passed as `sellingPrice` with `cost: 0` so the SAME $1-5/hr
 * benchmark bands apply to `value = totalProfit / totalPrinterHours`.
 *
 * Examples:
 *   computeProductRanking(jobs, sales, 'USD', fx)
 *     → { ranked: [{ key:'phone stand', profitPerHour: 8.1, tone:'good', ... }], unsold: [], hasPartialData: false }
 */
export function computeProductRanking(
  jobs: readonly PrintJob[],
  sales: readonly Sale[],
  userCurrency: Currency,
  fxTable: FxRateTable | null,
): ProductRankingResult {
  const salesByJobId = new Map<string, Sale[]>();
  for (const sale of sales) {
    const list = salesByJobId.get(sale.jobId);
    if (list) list.push(sale);
    else salesByJobId.set(sale.jobId, [sale]);
  }

  const groups = new Map<string, ProductGroup>();
  for (const job of jobs) {
    const key = normalizeProductKey(job.name);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        name: job.name,
        jobIds: [],
        copiesSold: 0,
        saleCount: 0,
        totalProfit: 0,
        totalPrinterHours: 0,
        hasSales: false,
        profitAvailable: true,
      };
      groups.set(key, g);
    }
    g.jobIds.push(job.id);
    g.copiesSold += finite(job.copiesSold);

    const jobSales = salesByJobId.get(job.id) ?? [];
    for (const sale of jobSales) {
      g.hasSales = true;
      g.saleCount += 1;
      g.totalPrinterHours += finite(job.printTimeHours) * finite(sale.quantity);

      const profit = computePerSaleProfit(sale, job, userCurrency, fxTable);
      if (profit === null) g.profitAvailable = false;
      else if (g.profitAvailable) g.totalProfit += profit;
    }
  }

  const ranked: ProductEarner[] = [];
  const unsold: UnsoldProduct[] = [];
  let hasPartialData = false;

  for (const g of groups.values()) {
    if (!g.hasSales) {
      unsold.push({ key: g.key, name: g.name, jobIds: g.jobIds, copiesSold: g.copiesSold });
      continue;
    }
    if (!g.profitAvailable) hasPartialData = true;

    const totalProfit = g.profitAvailable ? g.totalProfit : null;
    const grade = totalProfit !== null
      ? computePrintHourProfit({ sellingPrice: totalProfit, cost: 0, printTimeHours: g.totalPrinterHours })
      : { value: null, tone: 'na' as PrintHourTone };

    ranked.push({
      key: g.key,
      name: g.name,
      jobIds: g.jobIds,
      saleCount: g.saleCount,
      copiesSold: g.copiesSold,
      totalProfit,
      totalPrinterHours: g.totalPrinterHours,
      profitPerHour: grade.value,
      tone: grade.tone,
    });
  }

  ranked.sort((a, b) => {
    if (a.profitPerHour === null && b.profitPerHour === null) return 0;
    if (a.profitPerHour === null) return 1;
    if (b.profitPerHour === null) return -1;
    return b.profitPerHour - a.profitPerHour;
  });

  return { ranked, unsold, hasPartialData };
}

export interface WageHeadlineResult {
  netProfit: number | null;
  laborHours: number;
  effectiveHourlyWage: number | null;
  targetHourlyRate: number | null;
  gap: number | null;
  hasPartialData: boolean;
}

/**
 * D-03: one aggregate headline — effective hourly wage across every sold job
 * in scope, plus the gap vs an optional target. Labor hours are summed ONCE
 * per unique sold job — (prepTimeMinutes + postProcessingMinutes) / 60 is a
 * per-PRINT-JOB cost, never multiplied by sale.quantity (RESEARCH Pitfall P-05).
 *
 * Examples:
 *   computeWageHeadline(jobs, sales, 'USD', fx, 20)
 *     → { effectiveHourlyWage: 14, targetHourlyRate: 20, gap: -6, ... }
 */
export function computeWageHeadline(
  jobs: readonly PrintJob[],
  sales: readonly Sale[],
  userCurrency: Currency,
  fxTable: FxRateTable | null,
  targetHourlyRate?: number,
): WageHeadlineResult {
  const jobsById = new Map(jobs.map(j => [j.id, j]));

  let netProfit = 0;
  let profitAvailable = true;
  const laborJobIds = new Set<string>();

  for (const sale of sales) {
    const job = jobsById.get(sale.jobId);
    const profit = computePerSaleProfit(sale, job, userCurrency, fxTable);
    if (profit === null) profitAvailable = false;
    else if (profitAvailable) netProfit += profit;

    if (job) laborJobIds.add(job.id);
  }

  let laborHours = 0;
  for (const jobId of laborJobIds) {
    const job = jobsById.get(jobId);
    if (!job) continue;
    laborHours += (finite(job.prepTimeMinutes) + finite(job.postProcessingMinutes)) / 60;
  }

  const total = profitAvailable ? netProfit : null;
  const effectiveHourlyWage = total !== null && laborHours > 0 ? total / laborHours : null;
  const target = typeof targetHourlyRate === 'number' && Number.isFinite(targetHourlyRate) ? targetHourlyRate : null;
  const gap = effectiveHourlyWage !== null && target !== null ? effectiveHourlyWage - target : null;

  return {
    netProfit: total,
    laborHours,
    effectiveHourlyWage,
    targetHourlyRate: target,
    gap,
    hasPartialData: !profitAvailable,
  };
}

// ---------------------------------------------------------------------------
// INS-02: Per-printer payback / ROI
// ---------------------------------------------------------------------------

export interface PrinterPaybackResult {
  /** instance.id, or the literal 'unassigned' bucket (D-08). */
  printerInstanceId: string;
  label: string;
  purchasePrice: number | null;
  missingPurchasePrice: boolean;
  /** Sale profit minus logged maintenance cost minus logged failure scrap cost; null when any FX conversion is unavailable. */
  cumulativeNetProfit: number | null;
  paidOff: boolean;
  /** Set once cumulative net profit first crosses purchasePrice (paidOff = true). */
  breakEvenDate: Date | null;
  /** Projected crossing date from recent profit pace (paidOff = false); null when pace <= 0. */
  projectedDate: Date | null;
  hasPartialData: boolean;
}

/** D-06/Open Question 2: named 90-day trailing window for the projection pace — no black-box smoothing. */
const RECENT_PACE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const RECENT_PACE_WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface PaybackSaleEntry {
  sale: Sale;
  job: PrintJob;
}

/**
 * D-05/D-07/D-08: per-printer cumulative NET profit (never gross revenue) —
 * sale profit (net of fees, via computePerSaleProfit) minus that printer's
 * logged maintenance cost (deriveMaintenanceAmortization) minus its logged
 * failure scrap cost, measured against the resolved purchase price
 * (instance.actualPurchasePrice ?? config.purchasePrice). A printer with no
 * resolvable price flags `missingPurchasePrice` rather than reporting a false
 * payback. Sales from jobs with no printerInstanceId roll into an explicit
 * 'unassigned' result entry so totals never silently drop them.
 *
 * ASSUMPTION A-40-1 (judgment call — flag for user confirmation, like P-05):
 * job-linked failure scrap cost = job.costPerUnit × (percentComplete / 100),
 * the fraction of that job's own per-unit cost wasted before the failure.
 * Standalone failures (no jobId) with a logged gramsWasted use the failure's
 * OWN recorded material (FailureEvent.materialId) costPerUnit × gramsWasted.
 * A standalone failure with no gramsWasted contributes 0 — there is no
 * reliable cost basis to deduct without a weight (matches the app's existing
 * FailureEvent skip-deduction rule elsewhere).
 *
 * Examples:
 *   computePrinterPayback(jobs, sales, instances, configs, [], [], materials, 'USD', fx)
 *     → [{ printerInstanceId:'p1', paidOff:false, missingPurchasePrice:false, ... }]
 */
export function computePrinterPayback(
  jobs: readonly PrintJob[],
  sales: readonly Sale[],
  printerInstances: readonly PrinterInstance[],
  printerConfigs: readonly PrinterConfig[],
  failureEvents: readonly FailureEvent[],
  maintenanceEvents: readonly MaintenanceEvent[],
  materials: readonly Asset[],
  userCurrency: Currency,
  fxTable: FxRateTable | null,
  now: Date = new Date(),
): PrinterPaybackResult[] {
  const jobsById = new Map(jobs.map(j => [j.id, j]));
  const configsById = new Map(printerConfigs.map(c => [c.id, c]));
  const assetsById = new Map(materials.map(a => [a.id, a]));

  const salesByPrinter = new Map<string, PaybackSaleEntry[]>();
  for (const sale of sales) {
    const job = jobsById.get(sale.jobId);
    if (!job) continue; // no job → no cost basis, nothing to attribute
    const printerInstanceId = job.printerInstanceId?.trim() || UNASSIGNED_KEY;
    const list = salesByPrinter.get(printerInstanceId);
    if (list) list.push({ sale, job });
    else salesByPrinter.set(printerInstanceId, [{ sale, job }]);
  }

  const results: PrinterPaybackResult[] = [];

  for (const instance of printerInstances) {
    const config = configsById.get(instance.printerConfigId);
    const resolvedPrice = instance.actualPurchasePrice ?? config?.purchasePrice;
    const missingPurchasePrice = !(typeof resolvedPrice === 'number' && resolvedPrice > 0);
    const purchasePrice = missingPurchasePrice ? null : (resolvedPrice as number);

    const entries = (salesByPrinter.get(instance.id) ?? []).slice()
      .sort((a, b) => a.sale.soldAt.getTime() - b.sale.soldAt.getTime());

    const instanceJobs = jobs.filter(j => j.printerInstanceId === instance.id);
    const amortization = deriveMaintenanceAmortization(maintenanceEvents, instanceJobs, instance, assetsById);
    const maintenanceCumulativeCost = amortization?.cumulativeCost ?? 0;

    let failureScrapCost = 0;
    for (const event of failureEvents) {
      if (event.printerInstanceId !== instance.id) continue;
      if (event.jobId) {
        const job = jobsById.get(event.jobId);
        failureScrapCost += finite(job?.costPerUnit) * (finite(event.percentComplete) / 100);
      } else if (typeof event.gramsWasted === 'number' && event.gramsWasted > 0) {
        const material = assetsById.get(event.materialId);
        failureScrapCost += event.gramsWasted * finite(material?.costPerUnit);
      }
    }

    let saleProfitSum = 0;
    let profitAvailable = true;
    for (const { sale, job } of entries) {
      const profit = computePerSaleProfit(sale, job, userCurrency, fxTable);
      if (profit === null) profitAvailable = false;
      else if (profitAvailable) saleProfitSum += profit;
    }

    const cumulativeNetProfit = profitAvailable
      ? saleProfitSum - maintenanceCumulativeCost - failureScrapCost
      : null;

    const paidOff = !missingPurchasePrice && cumulativeNetProfit !== null && purchasePrice !== null
      && cumulativeNetProfit >= purchasePrice;

    let breakEvenDate: Date | null = null;
    let projectedDate: Date | null = null;

    if (!missingPurchasePrice && profitAvailable && purchasePrice !== null) {
      const threshold = purchasePrice + maintenanceCumulativeCost + failureScrapCost;
      if (paidOff) {
        let running = 0;
        for (const { sale, job } of entries) {
          running += computePerSaleProfit(sale, job, userCurrency, fxTable) ?? 0;
          if (running >= threshold) {
            breakEvenDate = sale.soldAt;
            break;
          }
        }
      } else if (cumulativeNetProfit !== null) {
        const pace = recentDailyProfitPace(entries, userCurrency, fxTable, now);
        if (pace > 0) {
          const remaining = purchasePrice - cumulativeNetProfit;
          const days = remaining / pace;
          projectedDate = new Date(now.getTime() + days * MS_PER_DAY);
        }
      }
    }

    results.push({
      printerInstanceId: instance.id,
      label: instance.nickname,
      purchasePrice,
      missingPurchasePrice,
      cumulativeNetProfit,
      paidOff,
      breakEvenDate,
      projectedDate,
      hasPartialData: !profitAvailable,
    });
  }

  // D-08: 'Unassigned' — sales whose job has no printerInstanceId. No purchase
  // price / payoff concept applies; this bucket exists so totals stay honest.
  const unassignedEntries = salesByPrinter.get(UNASSIGNED_KEY) ?? [];
  if (unassignedEntries.length > 0) {
    let saleProfitSum = 0;
    let profitAvailable = true;
    for (const { sale, job } of unassignedEntries) {
      const profit = computePerSaleProfit(sale, job, userCurrency, fxTable);
      if (profit === null) profitAvailable = false;
      else if (profitAvailable) saleProfitSum += profit;
    }
    results.push({
      printerInstanceId: UNASSIGNED_KEY,
      label: 'Unassigned',
      purchasePrice: null,
      missingPurchasePrice: false,
      cumulativeNetProfit: profitAvailable ? saleProfitSum : null,
      paidOff: false,
      breakEvenDate: null,
      projectedDate: null,
      hasPartialData: !profitAvailable,
    });
  }

  return results;
}

/**
 * Trailing-90-day daily profit pace for the projected break-even date.
 * Falls back to the all-time average (total in-scope profit / day span since
 * the earliest sale) when the sales history itself spans fewer than 90 days.
 */
function recentDailyProfitPace(
  entries: readonly PaybackSaleEntry[],
  userCurrency: Currency,
  fxTable: FxRateTable | null,
  now: Date,
): number {
  if (entries.length === 0) return 0;

  const earliestMs = entries.reduce((min, e) => Math.min(min, e.sale.soldAt.getTime()), now.getTime());
  const spanMs = Math.max(0, now.getTime() - earliestMs);
  const hasFullWindow = spanMs >= RECENT_PACE_WINDOW_MS;

  const cutoff = now.getTime() - RECENT_PACE_WINDOW_MS;
  const inWindow = hasFullWindow ? entries.filter(e => e.sale.soldAt.getTime() >= cutoff) : entries;
  const windowDays = hasFullWindow ? RECENT_PACE_WINDOW_DAYS : Math.max(1, spanMs / MS_PER_DAY);

  let sum = 0;
  for (const { sale, job } of inWindow) {
    sum += computePerSaleProfit(sale, job, userCurrency, fxTable) ?? 0;
  }
  return sum / windowDays;
}
