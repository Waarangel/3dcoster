import { describe, it, expect } from 'vitest';
import { scanAffectedJobs, type RepriceScanParams } from './repriceAlert';
import { priceFromMargin } from './pricingInterlink';
import type { Material, PrintJob } from '../types';

const CHANGED_ASSET_ID = 'mat-1';
const TARGET_MARGIN = 30;

function makeAsset(costPerUnit: number): Material {
  return {
    id: CHANGED_ASSET_ID,
    name: 'PLA Basic',
    category: 'filament',
    costPerUnit,
    currency: 'USD',
  };
}

function makeOtherAsset(): Material {
  return {
    id: 'mat-2',
    name: 'PETG',
    category: 'filament',
    costPerUnit: 0.03,
    currency: 'USD',
  };
}

function makeJob(overrides: Partial<PrintJob> & Pick<PrintJob, 'id' | 'name' | 'filaments' | 'sellingPrice' | 'costPerUnit'>): PrintJob {
  return {
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    printTimeHours: 1,
    printerInstanceId: 'no-such-printer', // unmatched on purpose: selectedInstance/selectedPrinter resolve undefined,
                                            // so electricity/depreciation/nozzleWear/abrasiveSurcharge all contribute 0.
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    copiesSold: 0,
    ...overrides,
  };
}

function baseParams(jobs: PrintJob[], oldPrice: number, newPrice: number): RepriceScanParams {
  return {
    changedAssetId: CHANGED_ASSET_ID,
    jobs,
    oldMaterials: [makeAsset(oldPrice), makeOtherAsset()],
    newMaterials: [makeAsset(newPrice), makeOtherAsset()],
    printerInstances: [],
    printerConfigs: [],
    electricity: { costPerKwh: 0.12 },
    laborHourlyRate: 0,
    targetMargin: TARGET_MARGIN,
  };
}

describe('scanAffectedJobs', () => {
  it('includes a live-priced job whose recomputed margin falls below targetMargin', () => {
    // 1000g @ $0.02/g = $20 old cost; sellingPrice $30 → oldMargin 33.3% (>= target, job was fine before).
    // New price $0.05/g → newCost $50 → newMargin -66.7% (< target 30%) → included.
    const job = makeJob({
      id: 'job-1',
      name: 'Live-Priced Job',
      filaments: [{ filamentId: CHANGED_ASSET_ID, grams: 1000 }],
      sellingPrice: 30,
      costPerUnit: 20,
    });

    const result = scanAffectedJobs(baseParams([job], 0.02, 0.05));

    expect(result).toHaveLength(1);
    expect(result[0].jobId).toBe('job-1');
    expect(result[0].newMargin).toBeCloseTo(-66.666, 2);
  });

  it('excludes a job whose filament row has an explicit pricePerGram override', () => {
    // Same grams/prices as the included case, but the row pins its own price —
    // a material cost change can never move this job.
    const job = makeJob({
      id: 'job-2',
      name: 'Override Job',
      filaments: [{ filamentId: CHANGED_ASSET_ID, grams: 1000, pricePerGram: 0.02 }],
      sellingPrice: 30,
      costPerUnit: 20,
    });

    const result = scanAffectedJobs(baseParams([job], 0.02, 0.05));

    expect(result).toHaveLength(0);
  });

  it('excludes a job that does not reference the changed asset at all', () => {
    const job = makeJob({
      id: 'job-3',
      name: 'Unrelated Job',
      filaments: [{ filamentId: 'mat-2', grams: 500 }],
      sellingPrice: 30,
      costPerUnit: 15,
    });

    const result = scanAffectedJobs(baseParams([job], 0.02, 0.05));

    expect(result).toHaveLength(0);
  });

  it('excludes a live-priced job that stays at/above targetMargin after the price change', () => {
    // Only 10g exposed to the price change — a $0.03/g swing barely dents a $100 sale.
    const job = makeJob({
      id: 'job-4',
      name: 'Barely-Exposed Job',
      filaments: [{ filamentId: CHANGED_ASSET_ID, grams: 10 }],
      sellingPrice: 100,
      costPerUnit: 0.2,
    });

    const result = scanAffectedJobs(baseParams([job], 0.02, 0.05));

    expect(result).toHaveLength(0);
  });

  it('derives oldMargin from the job\'s stored sellingPrice/costPerUnit and newMargin from the recomputed true cost', () => {
    const job = makeJob({
      id: 'job-5',
      name: 'Margin Math Job',
      filaments: [{ filamentId: CHANGED_ASSET_ID, grams: 1000 }],
      sellingPrice: 30,
      costPerUnit: 20, // matches the reconstructed old-price cost exactly (residual 0)
    });

    const result = scanAffectedJobs(baseParams([job], 0.02, 0.05));

    expect(result).toHaveLength(1);
    // oldMargin: (30 - 20) / 30 * 100
    expect(result[0].oldMargin).toBeCloseTo(33.333, 2);
    // newMargin: (30 - 50) / 30 * 100  (newTrueCost = 1000g * $0.05/g = $50, residual 0)
    expect(result[0].newMargin).toBeCloseTo(-66.666, 2);
  });

  it('suggestedPrice equals a direct priceFromMargin(newTrueCost, targetMargin).price call', () => {
    const job = makeJob({
      id: 'job-6',
      name: 'Suggested Price Job',
      filaments: [{ filamentId: CHANGED_ASSET_ID, grams: 1000 }],
      sellingPrice: 30,
      costPerUnit: 20,
    });

    const result = scanAffectedJobs(baseParams([job], 0.02, 0.05));

    expect(result).toHaveLength(1);
    // newTrueCost = 1000g * $0.05/g = $50 (residual 0)
    const expected = priceFromMargin(50, TARGET_MARGIN).price;
    expect(result[0].suggestedPrice).toBe(expected);
  });
});
