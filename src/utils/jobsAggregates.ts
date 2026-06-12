import type { PrintJob, Sale, Currency } from '../types';
import { convert, type FxRateTable } from './fxConvert';

// ---------------------------------------------------------------------------
// Pure aggregation logic for the My Jobs summary totals bar.
//
// Lives outside JobsManager.tsx so the component file keeps only component
// exports (react-refresh/only-export-components) and so tests can import the
// math without mounting any React scaffolding.
// ---------------------------------------------------------------------------

// Fixed costs a job must recover, in the JOB's snapshot currency (Calculator
// formula, Phase 22.1 D-01 + CR-02): the model fee only when NOT per-unit
// licensed (per-unit fees are amortized into costPerUnit), plus the
// fixedCostsAtSave snapshot. Single source of truth shared by
// computeBreakEvenInfo (JobsManager.tsx) and computeJobsAggregates — the
// summary bar must never grow a third cost formula.
export function computeJobFixedCosts(job: PrintJob): number {
  const fixedModelCost = job.modelCostPerUnit ? 0 : job.modelCost;
  return fixedModelCost
    + (job.fixedCostsAtSave?.depreciation ?? 0)
    + (job.fixedCostsAtSave?.nozzleWear ?? 0);
}

export type JobsAggregates = {
  /**
   * Net revenue (Σ sale.totalRevenue - marketplaceFee) in the user's display
   * currency. null when any record's snapshot currency has no cached FX rate —
   * the UI renders "—" instead of a cross-currency sum (project rule: never
   * arbitrary numbers).
   */
  totalRevenue: number | null;
  /** totalRevenue minus Σ per-job (costPerUnit × copiesSold + computeJobFixedCosts). Same null contract. */
  totalProfit: number | null;
  /** Σ grams-per-copy × copiesSold. Currency-free — always available. */
  totalGrams: number;
  /** Σ printTimeHours × copiesSold. Currency-free — always available. */
  totalHours: number;
};

/**
 * Aggregate revenue / profit / filament / print time across ALL jobs.
 *
 * Money fields are stored in per-record snapshot currencies (Sale.currency,
 * PrintJob.currency — undefined on legacy records means the user's currency),
 * so every amount converts to `userCurrency` at display time via the cached
 * USD-based rate table. Profit reuses computeJobFixedCosts so the cost side
 * stays identical to the break-even pill — no third formula.
 */
export function computeJobsAggregates(
  jobs: PrintJob[],
  salesByJob: Map<string, Sale[]>,
  userCurrency: Currency,
  fxTable: FxRateTable | null,
): JobsAggregates {
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalGrams = 0;
  let totalHours = 0;
  let moneyAvailable = true;

  for (const job of jobs) {
    const gramsPerCopy = (job.filaments ?? []).reduce((sum, f) => sum + (f.grams ?? 0), 0);
    totalGrams += gramsPerCopy * job.copiesSold;
    totalHours += job.printTimeHours * job.copiesSold;

    if (!moneyAvailable) continue; // keep accumulating the currency-free totals

    let jobNetRevenue = 0;
    for (const sale of salesByJob.get(job.id) ?? []) {
      const net = sale.totalRevenue - (sale.marketplaceFee ?? 0);
      const converted = convert(net, sale.currency ?? userCurrency, userCurrency, fxTable);
      if (converted === null) { moneyAvailable = false; break; }
      jobNetRevenue += converted;
    }
    // ORDER MATTERS: this `continue` must stay ABOVE the totalRevenue/totalProfit
    // writes below. When the inner loop breaks mid-job, jobNetRevenue holds a
    // PARTIAL sum — adding it to the totals would leak a wrong number into a
    // result that is about to be nulled out anyway.
    if (!moneyAvailable) continue;

    const jobCostNative = job.costPerUnit * job.copiesSold + computeJobFixedCosts(job);
    const jobCost = convert(jobCostNative, job.currency ?? userCurrency, userCurrency, fxTable);
    if (jobCost === null) { moneyAvailable = false; continue; }

    totalRevenue += jobNetRevenue;
    totalProfit += jobNetRevenue - jobCost;
  }

  return {
    totalRevenue: moneyAvailable ? totalRevenue : null,
    totalProfit: moneyAvailable ? totalProfit : null,
    totalGrams,
    totalHours,
  };
}

/**
 * "812 g" below 1 kg, "1.50 kg" at and above. The branch keys on the ROUNDED
 * display value so 999.5 renders "1.00 kg", never "1000 g" (mirrors the
 * formatHours 99.96 guard — the rule is about what the user SEES).
 */
export function formatFilament(grams: number): string {
  const rounded = Math.round(grams);
  return rounded >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : `${rounded} g`;
}

/**
 * One decimal under 100h ("5.0"), whole hours from 100h ("150"). The branch
 * keys on the ROUNDED display value so 99.96 renders "100", never "100.0".
 */
export function formatHours(hours: number): string {
  const oneDecimal = hours.toFixed(1);
  return Number(oneDecimal) >= 100 ? hours.toFixed(0) : oneDecimal;
}
