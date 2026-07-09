// ---------------------------------------------------------------------------
// CONN-01 — Reprice alert scan (Phase 41 Plan 02). Pure module (no React, no
// Dexie, no IO). When a material's price changes on save in the Asset
// Library, this scans every saved job that used that material AT ITS LIVE
// PRICE (no per-row override) and flags the ones whose margin now falls
// below the user's global target.
//
// Routes EXCLUSIVELY through buildCalcInputFromJob + calculateCost
// (the same reconstruction the what-if simulator uses, insights.ts) and
// priceFromMargin (pricingInterlink.ts) — never a forked cost or pricing
// formula (PITFALLS C-03 / T-41-02a). The RECONCILIATION RESIDUAL pattern
// documented on computeScenario is mirrored here: buildCalcInputFromJob
// cannot perfectly replay every input that produced job.costPerUnit at save
// time, so the gap between "reconstructed at the OLD material price" and
// "what was actually saved" is captured once as a residual and carried
// through to the NEW-price reconstruction.
// ---------------------------------------------------------------------------
import type {
  Currency,
  ElectricityConfig,
  Material,
  PrinterConfig,
  PrinterInstance,
  PrintJob,
} from '../types';
import { buildCalcInputFromJob, type ScenarioDeps } from './insights';
import { calculateCost } from './costCalc';
import { priceFromMargin } from './pricingInterlink';

export interface AffectedJob {
  jobId: string;
  jobTitle: string;
  /** Percent, derived from the job's OWN stored sellingPrice/costPerUnit — never recomputed. */
  oldMargin: number;
  /** Percent, recomputed at the new material price. */
  newMargin: number;
  /** priceFromMargin(newTrueCost, targetMargin).price — the price that restores targetMargin. */
  suggestedPrice: number;
  currency: Currency;
}

export interface RepriceScanParams {
  /** The Asset.id whose costPerUnit just changed on save. */
  changedAssetId: string;
  jobs: readonly PrintJob[];
  /** The full materials list BEFORE the save (still holding the old costPerUnit). */
  oldMaterials: readonly Material[];
  /** The full materials list AFTER the save (the changed asset holds its new costPerUnit). */
  newMaterials: readonly Material[];
  printerInstances: readonly PrinterInstance[];
  printerConfigs: readonly PrinterConfig[];
  electricity: ElectricityConfig;
  /** Current Settings labor rate — not snapshotted on PrintJob (mirrors ScenarioDeps). */
  laborHourlyRate: number;
  /** The resolved UserProfile.defaultProfitMargin (or its documented fallback). */
  targetMargin: number;
}

/**
 * Pitfall 2: a job is only "affected" when a filament row references the
 * changed asset AND has no per-row price override (pricePerGram === undefined).
 * A row with an explicit pricePerGram never reads the asset's live costPerUnit,
 * so a material price change can never move that job's cost.
 */
function referencesLivePrice(job: PrintJob, changedAssetId: string): boolean {
  return job.filaments.some(f => f.filamentId === changedAssetId && f.pricePerGram === undefined);
}

/**
 * Scans every saved job that used `changedAssetId` at its live (non-override)
 * price and returns the ones whose margin now falls below `targetMargin` at
 * the new material price, sorted ascending by newMargin (worst first).
 *
 * Examples:
 *   scanAffectedJobs({ changedAssetId: 'mat-1', jobs, oldMaterials, newMaterials, ..., targetMargin: 30 })
 *     → [{ jobId: 'job-2', jobTitle: 'Phone Stand', oldMargin: 33.3, newMargin: -12.5, suggestedPrice: 71.43, currency: 'USD' }]
 *   // A job with no filament row on the changed asset, or only an
 *   // explicit-override row, is never included regardless of margin.
 */
export function scanAffectedJobs(params: RepriceScanParams): AffectedJob[] {
  const {
    changedAssetId,
    jobs,
    oldMaterials,
    newMaterials,
    printerInstances,
    printerConfigs,
    electricity,
    laborHourlyRate,
    targetMargin,
  } = params;

  const baseDeps: Omit<ScenarioDeps, 'materials'> = {
    printerInstances,
    printerConfigs,
    electricity,
    laborHourlyRate,
  };

  const changedAssetNew = newMaterials.find(m => m.id === changedAssetId);

  const affected: AffectedJob[] = [];

  for (const job of jobs) {
    if (!referencesLivePrice(job, changedAssetId)) continue;

    // Reconstruct at the OLD material price to derive the reconciliation
    // residual (mirrors computeScenario's costResidual pattern exactly).
    const oldBreakdown = calculateCost(buildCalcInputFromJob(job, { ...baseDeps, materials: oldMaterials }));
    const costResidual = job.costPerUnit - oldBreakdown.failureAdjusted;

    // Reconstruct at the NEW material price and carry the residual forward.
    const newBreakdown = calculateCost(buildCalcInputFromJob(job, { ...baseDeps, materials: newMaterials }));
    const newTrueCost = newBreakdown.failureAdjusted + costResidual;

    const oldMargin = job.sellingPrice > 0 ? ((job.sellingPrice - job.costPerUnit) / job.sellingPrice) * 100 : 0;
    const newMargin = job.sellingPrice > 0 ? ((job.sellingPrice - newTrueCost) / job.sellingPrice) * 100 : 0;

    if (newMargin >= targetMargin) continue;

    const { price: suggestedPrice } = priceFromMargin(newTrueCost, targetMargin);
    const currency: Currency = job.currency ?? changedAssetNew?.currency ?? 'USD';

    affected.push({
      jobId: job.id,
      jobTitle: job.name,
      oldMargin,
      newMargin,
      suggestedPrice,
      currency,
    });
  }

  return affected.sort((a, b) => a.newMargin - b.newMargin);
}
