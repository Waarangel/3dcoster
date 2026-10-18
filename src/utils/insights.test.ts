import { describe, it, expect } from 'vitest';
import {
  normalizeProductKey,
  computeProductRanking,
  computeWageHeadline,
  computePrinterPayback,
  buildCalcInputFromJob,
  computeScenario,
  type ScenarioDeps,
} from './insights';
import type {
  Asset,
  ElectricityConfig,
  FailureEvent,
  MaintenanceEvent,
  PrintJob,
  PrinterConfig,
  PrinterInstance,
  Sale,
} from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let jobSeq = 0;
function makeJob(overrides: Partial<PrintJob> = {}): PrintJob {
  jobSeq += 1;
  return {
    id: overrides.id ?? `job${jobSeq}`,
    name: 'Phone Stand',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    filaments: [],
    printTimeHours: 2,
    printerInstanceId: 'printer1',
    modelCost: 0,
    prepTimeMinutes: 30,
    postProcessingMinutes: 30,
    materialsUsed: [],
    failureRate: 5,
    costPerUnit: 4,
    sellingPrice: 20,
    copiesSold: 1,
    currency: 'USD',
    ...overrides,
  };
}

let saleSeq = 0;
function makeSale(overrides: Partial<Sale> = {}): Sale {
  saleSeq += 1;
  return {
    id: overrides.id ?? `sale${saleSeq}`,
    jobId: 'job1',
    quantity: 1,
    unitPrice: 20,
    totalRevenue: 20,
    soldAt: new Date('2026-06-15T12:00:00.000Z'),
    currency: 'USD',
    ...overrides,
  };
}

function makeInstance(overrides: Partial<PrinterInstance> = {}): PrinterInstance {
  return {
    id: 'printer1',
    printerConfigId: 'config1',
    nickname: 'Printer One',
    printHours: 100,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    id: 'config1',
    name: 'Generic FDM',
    purchasePrice: 500,
    expectedLifespanHours: 5000,
    wattage: 200,
    nozzleCost: 5,
    nozzleLifespanCm3: 500,
    ...overrides,
  };
}

function makeFailure(overrides: Partial<FailureEvent> = {}): FailureEvent {
  return {
    id: overrides.id ?? `fail-${Math.random()}`,
    printerInstanceId: 'printer1',
    materialId: 'mat1',
    percentComplete: 50,
    reason: 'adhesion',
    failedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeMaintenance(overrides: Partial<MaintenanceEvent> = {}): MaintenanceEvent {
  return {
    id: overrides.id ?? `maint-${Math.random()}`,
    printerInstanceId: 'printer1',
    partType: 'nozzle',
    cost: 10,
    occurredAt: new Date('2026-04-01T00:00:00.000Z'),
    printerHoursAtEvent: 50,
    ...overrides,
  };
}

function makeMaterial(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'mat1',
    name: 'PLA Basic',
    category: 'filament',
    costPerUnit: 0.02, // $/gram
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeProductKey (D-01)
// ---------------------------------------------------------------------------

describe('normalizeProductKey', () => {
  it('trims and lowercases', () => {
    expect(normalizeProductKey('  Phone Stand ')).toBe('phone stand');
  });

  it('treats "phone stand v2" and "Phone Stand" as distinct keys (no fuzzy matching)', () => {
    expect(normalizeProductKey('phone stand v2')).not.toBe(normalizeProductKey('Phone Stand'));
  });
});

// ---------------------------------------------------------------------------
// computeProductRanking (INS-01, D-02)
// ---------------------------------------------------------------------------

describe('computeProductRanking', () => {
  it('ranks a sold product by net-of-fees profit per printer-hour', () => {
    const job = makeJob({ id: 'j1', name: 'Phone Stand', printTimeHours: 2, costPerUnit: 4 });
    const sale = makeSale({ jobId: 'j1', quantity: 1, totalRevenue: 20, marketplaceFee: 2 });
    const r = computeProductRanking([job], [sale], 'USD', null);

    expect(r.unsold).toEqual([]);
    expect(r.ranked).toHaveLength(1);
    // profit = 20 - 2 - 4 = 14; hours = 2*1 = 2; profitPerHour = 7
    expect(r.ranked[0].totalProfit).toBe(14);
    expect(r.ranked[0].totalPrinterHours).toBe(2);
    expect(r.ranked[0].profitPerHour).toBe(7);
    expect(r.ranked[0].tone).toBe('good');
    expect(r.hasPartialData).toBe(false);
  });

  it('sorts ranked products highest profit-per-hour first', () => {
    const jobA = makeJob({ id: 'jA', name: 'Dragon', printTimeHours: 10, costPerUnit: 5 });
    const saleA = makeSale({ jobId: 'jA', totalRevenue: 20 }); // profit 15 / 10hrs = 1.5/hr
    const jobB = makeJob({ id: 'jB', name: 'Phone Stand', printTimeHours: 2, costPerUnit: 4 });
    const saleB = makeSale({ jobId: 'jB', totalRevenue: 20 }); // profit 16 / 2hrs = 8/hr

    const r = computeProductRanking([jobA, jobB], [saleA, saleB], 'USD', null);
    expect(r.ranked.map(p => p.key)).toEqual(['phone stand', 'dragon']);
  });

  it('keeps "phone stand v2" and "Phone Stand" as separate ranking entries', () => {
    const job1 = makeJob({ id: 'j1', name: 'Phone Stand', printTimeHours: 2, costPerUnit: 4 });
    const job2 = makeJob({ id: 'j2', name: 'phone stand v2', printTimeHours: 2, costPerUnit: 4 });
    const sale1 = makeSale({ jobId: 'j1', totalRevenue: 20 });
    const sale2 = makeSale({ jobId: 'j2', totalRevenue: 20 });

    const r = computeProductRanking([job1, job2], [sale1, sale2], 'USD', null);
    expect(r.ranked.map(p => p.key).sort()).toEqual(['phone stand', 'phone stand v2']);
  });

  it('D-02: a job with copiesSold > 0 but zero Sale records lands in unsold, not ranked', () => {
    const job = makeJob({ id: 'j1', name: 'Dragon', copiesSold: 3 });
    const r = computeProductRanking([job], [], 'USD', null);

    expect(r.ranked).toEqual([]);
    expect(r.unsold).toHaveLength(1);
    expect(r.unsold[0]).toMatchObject({ key: 'dragon', copiesSold: 3, jobIds: ['j1'] });
  });

  it('groups multiple jobs of the same normalized product together', () => {
    const job1 = makeJob({ id: 'j1', name: 'Phone Stand', printTimeHours: 2, costPerUnit: 4 });
    const job2 = makeJob({ id: 'j2', name: 'Phone Stand', printTimeHours: 3, costPerUnit: 5 });
    const sale1 = makeSale({ jobId: 'j1', totalRevenue: 20 });
    const sale2 = makeSale({ jobId: 'j2', totalRevenue: 25 });

    const r = computeProductRanking([job1, job2], [sale1, sale2], 'USD', null);
    expect(r.ranked).toHaveLength(1);
    expect(r.ranked[0].jobIds).toEqual(['j1', 'j2']);
    expect(r.ranked[0].saleCount).toBe(2);
    expect(r.ranked[0].totalProfit).toBe(16 + 20); // (20-4) + (25-5)
  });

  it('flags hasPartialData when a sale has no FX rate, without treating it as 0', () => {
    const job = makeJob({ id: 'j1', name: 'Phone Stand', costPerUnit: 4, currency: 'CAD' });
    const sale = makeSale({ jobId: 'j1', totalRevenue: 20, currency: 'GBP' }); // no GBP rate in a null table
    const r = computeProductRanking([job], [sale], 'CAD', null);

    expect(r.hasPartialData).toBe(true);
    expect(r.ranked[0].totalProfit).toBeNull();
    expect(r.ranked[0].profitPerHour).toBeNull();
    expect(r.ranked[0].tone).toBe('na');
  });

  it('handles empty data (no jobs, no sales)', () => {
    const r = computeProductRanking([], [], 'USD', null);
    expect(r).toEqual({ ranked: [], unsold: [], hasPartialData: false });
  });
});

// ---------------------------------------------------------------------------
// computeWageHeadline (INS-01, D-03, P-05)
// ---------------------------------------------------------------------------

describe('computeWageHeadline', () => {
  it('computes effective hourly wage = net profit / labor hours', () => {
    const job = makeJob({ id: 'j1', costPerUnit: 4, prepTimeMinutes: 30, postProcessingMinutes: 30 }); // 1 labor hr
    const sale = makeSale({ jobId: 'j1', totalRevenue: 20 }); // profit 16
    const r = computeWageHeadline([job], [sale], 'USD', null);

    expect(r.netProfit).toBe(16);
    expect(r.laborHours).toBe(1);
    expect(r.effectiveHourlyWage).toBe(16);
    expect(r.gap).toBeNull();
  });

  it('P-05: sums labor hours ONCE per unique sold job, never multiplied by sale.quantity', () => {
    const job = makeJob({ id: 'j1', costPerUnit: 4, prepTimeMinutes: 30, postProcessingMinutes: 30 }); // 1 labor hr
    // Two separate sale records for the SAME job, quantities 3 and 2 — labor hours must stay 1, not 5.
    const sale1 = makeSale({ jobId: 'j1', quantity: 3, totalRevenue: 60 });
    const sale2 = makeSale({ jobId: 'j1', quantity: 2, totalRevenue: 40 });
    const r = computeWageHeadline([job], [sale1, sale2], 'USD', null);

    expect(r.laborHours).toBe(1);
  });

  it('returns the gap when a target hourly rate is supplied', () => {
    const job = makeJob({ id: 'j1', costPerUnit: 4, prepTimeMinutes: 30, postProcessingMinutes: 30 });
    const sale = makeSale({ jobId: 'j1', totalRevenue: 20 }); // profit 16, 1 labor hr → wage 16
    const r = computeWageHeadline([job], [sale], 'USD', null, 20);

    expect(r.effectiveHourlyWage).toBe(16);
    expect(r.targetHourlyRate).toBe(20);
    expect(r.gap).toBe(-4);
  });

  it('effectiveHourlyWage is null when laborHours is 0', () => {
    const job = makeJob({ id: 'j1', prepTimeMinutes: 0, postProcessingMinutes: 0 });
    const sale = makeSale({ jobId: 'j1', totalRevenue: 20 });
    const r = computeWageHeadline([job], [sale], 'USD', null);
    expect(r.effectiveHourlyWage).toBeNull();
  });

  it('handles empty data (no sales)', () => {
    const r = computeWageHeadline([], [], 'USD', null);
    expect(r.netProfit).toBe(0);
    expect(r.laborHours).toBe(0);
    expect(r.effectiveHourlyWage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computePrinterPayback (INS-02, D-05..D-08)
// ---------------------------------------------------------------------------

describe('computePrinterPayback', () => {
  const now = new Date('2026-07-08T00:00:00.000Z');

  it('flags missingPurchasePrice rather than reporting a false payback when no price is resolvable', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: undefined });
    const config = makeConfig({ id: 'c1', purchasePrice: 0 });
    const r = computePrinterPayback([], [], [instance], [config], [], [], [], 'USD', null, now);

    expect(r).toHaveLength(1);
    expect(r[0].missingPurchasePrice).toBe(true);
    expect(r[0].paidOff).toBe(false);
    expect(r[0].purchasePrice).toBeNull();
  });

  it('resolves purchase price from instance.actualPurchasePrice over config.purchasePrice', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 300 });
    const config = makeConfig({ id: 'c1', purchasePrice: 999 });
    const r = computePrinterPayback([], [], [instance], [config], [], [], [], 'USD', null, now);
    expect(r[0].purchasePrice).toBe(300);
  });

  it('is paidOff when cumulative net profit >= purchase price, with an actual break-even date', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 100 });
    const config = makeConfig({ id: 'c1' });
    const job = makeJob({ id: 'j1', printerInstanceId: 'p1', costPerUnit: 5 });
    const sale1 = makeSale({ id: 's1', jobId: 'j1', totalRevenue: 60, soldAt: new Date('2026-01-01T00:00:00.000Z') }); // profit 55
    const sale2 = makeSale({ id: 's2', jobId: 'j1', totalRevenue: 60, soldAt: new Date('2026-02-01T00:00:00.000Z') }); // profit 55, cumulative 110 >= 100

    const r = computePrinterPayback([job], [sale1, sale2], [instance], [config], [], [], [], 'USD', null, now);
    expect(r[0].paidOff).toBe(true);
    expect(r[0].cumulativeNetProfit).toBe(110);
    expect(r[0].breakEvenDate).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(r[0].projectedDate).toBeNull();
  });

  it('D-07: subtracts logged maintenance cumulativeCost AND failure scrap cost from cumulative net profit', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 100, printHours: 100 });
    const config = makeConfig({ id: 'c1' });
    const job = makeJob({ id: 'j1', printerInstanceId: 'p1', costPerUnit: 5 });
    const sale = makeSale({ jobId: 'j1', totalRevenue: 60 }); // profit 55
    const maintenance = makeMaintenance({ printerInstanceId: 'p1', cost: 10 });
    const failure = makeFailure({ printerInstanceId: 'p1', jobId: 'j1', percentComplete: 50 }); // 5 * 0.5 = 2.5 scrap

    const r = computePrinterPayback(
      [job], [sale], [instance], [config], [failure], [maintenance], [], 'USD', null, now,
    );
    // 55 (sale profit) - 10 (maintenance) - 2.5 (failure scrap) = 42.5
    expect(r[0].cumulativeNetProfit).toBe(42.5);
  });

  it('standalone failure (no jobId) with gramsWasted uses the failure material costPerUnit', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 100, printHours: 100 });
    const config = makeConfig({ id: 'c1' });
    const material = makeMaterial({ id: 'mat1', costPerUnit: 0.02 });
    const failure = makeFailure({ printerInstanceId: 'p1', jobId: undefined, materialId: 'mat1', gramsWasted: 100 }); // 100 * 0.02 = 2

    const r = computePrinterPayback([], [], [instance], [config], [failure], [], [material], 'USD', null, now);
    expect(r[0].cumulativeNetProfit).toBe(-2);
  });

  it('standalone failure with no gramsWasted contributes 0 scrap cost', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 100 });
    const config = makeConfig({ id: 'c1' });
    const failure = makeFailure({ printerInstanceId: 'p1', jobId: undefined, gramsWasted: undefined });

    const r = computePrinterPayback([], [], [instance], [config], [failure], [], [], 'USD', null, now);
    expect(r[0].cumulativeNetProfit).toBe(0);
  });

  it('empty ledgers subtract 0 (no maintenance/failure events for this printer)', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 100 });
    const config = makeConfig({ id: 'c1' });
    const job = makeJob({ id: 'j1', printerInstanceId: 'p1', costPerUnit: 5 });
    const sale = makeSale({ jobId: 'j1', totalRevenue: 60 });

    const r = computePrinterPayback([job], [sale], [instance], [config], [], [], [], 'USD', null, now);
    expect(r[0].cumulativeNetProfit).toBe(55);
  });

  it('D-08: sales from jobs with no printerInstanceId aggregate into an Unassigned bucket', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 100 });
    const config = makeConfig({ id: 'c1' });
    const job = makeJob({ id: 'j1', printerInstanceId: '', costPerUnit: 5 });
    const sale = makeSale({ jobId: 'j1', totalRevenue: 60 }); // profit 55

    const r = computePrinterPayback([job], [sale], [instance], [config], [], [], [], 'USD', null, now);
    expect(r).toHaveLength(2);
    const unassigned = r.find(x => x.printerInstanceId === 'unassigned');
    expect(unassigned).toBeDefined();
    expect(unassigned?.label).toBe('Unassigned');
    expect(unassigned?.cumulativeNetProfit).toBe(55);
    expect(unassigned?.missingPurchasePrice).toBe(false);
    expect(unassigned?.paidOff).toBe(false);
  });

  it('projects a break-even date from recent profit pace when not yet paid off', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1', actualPurchasePrice: 1000 });
    const config = makeConfig({ id: 'c1' });
    const job = makeJob({ id: 'j1', printerInstanceId: 'p1', costPerUnit: 5 });
    // A single sale 10 days before `now`, profit 55 → pace = 55 / 10 days = 5.5/day (span < 90 days, all-time fallback)
    const sale = makeSale({ jobId: 'j1', totalRevenue: 60, soldAt: new Date('2026-06-28T00:00:00.000Z') });

    const r = computePrinterPayback([job], [sale], [instance], [config], [], [], [], 'USD', null, now);
    expect(r[0].paidOff).toBe(false);
    expect(r[0].projectedDate).not.toBeNull();
    expect((r[0].projectedDate as Date).getTime()).toBeGreaterThan(now.getTime());
  });

  it('handles empty data (no printers)', () => {
    const r = computePrinterPayback([], [], [], [], [], [], [], 'USD', null, now);
    expect(r).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCalcInputFromJob / computeScenario (INS-03, D-10, D-11)
// ---------------------------------------------------------------------------

function makeElectricity(overrides: Partial<ElectricityConfig> = {}): ElectricityConfig {
  return { costPerKwh: 0.1, ...overrides };
}

// Deliberately no printer instance match (printerInstanceId: '') so
// depreciation/nozzleWear/electricity cost are all 0 — isolates the
// fidelity check to filament + labor cost, computed exactly (no FX rounding).
function makeScenarioJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return makeJob({
    printerInstanceId: '',
    filaments: [{ filamentId: 'mat1', grams: 100, pricePerGram: 0.02 }], // 100 * 0.02 = 2
    printTimeHours: 2,
    prepTimeMinutes: 30,
    postProcessingMinutes: 30, // 1 labor hr
    failureRate: 0,
    modelCost: 0,
    sellingPrice: 10,
    costPerUnit: 4, // filament 2 + labor (1hr * $2/hr) = 4, matches deps.laborHourlyRate below
    ...overrides,
  });
}

function makeScenarioDeps(overrides: Partial<ScenarioDeps> = {}): ScenarioDeps {
  return {
    printerInstances: [],
    printerConfigs: [],
    electricity: makeElectricity(),
    materials: [makeMaterial({ id: 'mat1', costPerUnit: 0.02 })],
    laborHourlyRate: 2,
    ...overrides,
  };
}

describe('buildCalcInputFromJob', () => {
  it('maps filament rows, printer, and job fields into a CalcInput', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1' });
    const config = makeConfig({ id: 'c1' });
    const job = makeScenarioJob({ printerInstanceId: 'p1' });
    const deps = makeScenarioDeps({ printerInstances: [instance], printerConfigs: [config] });

    const input = buildCalcInputFromJob(job, deps);
    expect(input.selectedInstance).toBe(instance);
    expect(input.selectedPrinter).toBe(config);
    expect(input.filamentRows).toEqual([{ filamentId: 'mat1', grams: 100, editedPrice: 0.02, editedCurrency: 'USD' }]);
    expect(input.printTimeHours).toBe(2);
    expect(input.laborHourlyRate).toBe(2);
  });

  it('falls back editedPrice to the material costPerUnit when pricePerGram is unset', () => {
    const job = makeScenarioJob({ filaments: [{ filamentId: 'mat1', grams: 50 }] });
    const deps = makeScenarioDeps();
    const input = buildCalcInputFromJob(job, deps);
    expect(input.filamentRows[0].editedPrice).toBe(0.02);
  });

  it('passes the job one-off materials through; packaging one-offs stay out of CalcInput (47.1 D-05/D-07)', () => {
    const manualMaterials = [{ id: 'm', name: 'Auger', cost: 6 }];
    const job = makeScenarioJob({
      manualMaterials,
      manualPackaging: [{ id: 'p', name: 'Gift wrap', cost: 3.5 }],
    });
    const input = buildCalcInputFromJob(job, makeScenarioDeps());
    expect(input.manualMaterials).toEqual(manualMaterials);
    expect(Object.keys(input)).not.toContain('manualPackaging');
  });
});

describe('computeScenario', () => {
  it('reconstruction fidelity: live margin === stored margin at zero overrides (exact)', () => {
    const job = makeScenarioJob();
    const deps = makeScenarioDeps();
    const r = computeScenario(job, {}, deps);

    const storedMargin = ((job.sellingPrice - job.costPerUnit) / job.sellingPrice) * 100;
    expect(r.margin).not.toBeNull();
    expect(Math.abs((r.margin as number) - storedMargin)).toBeLessThan(1e-9);
    expect(r.deltas.marginPts).not.toBeNull();
    expect(r.deltas.marginPts).toBe(0);
    expect(r.deltas.profit).toBe(0);
  });

  // 40-05 Task 4 checkpoint feedback: "Why does every option show my profit
  // in the negative?" — buildCalcInputFromJob can never perfectly replay
  // every input that produced job.costPerUnit (shipping + packaging cost is
  // computed entirely OUTSIDE calculateCost, in useCostDerivedValues.ts, and
  // is never snapshotted as its own field; a live-only input — labor rate,
  // TOU bands, a since-repriced material — can also drift after save). The
  // reconciliation residual must absorb ALL of that gap so a job that is
  // genuinely profitable in the calculator can never open the simulator
  // showing a negative baseline.
  it('reconciles a cost-basis gap the reconstruction cannot see (e.g. shipping/packaging) — baseline stays exact and positive', () => {
    // costPerUnit bakes in $3 of cost buildCalcInputFromJob has no way to
    // reconstruct (stand-in for shipping + packaging, which CostCalculator.tsx
    // adds on top of calculateCost's failureAdjusted but which PrintJob never
    // snapshots as a standalone, replayable field).
    const reconstructableCost = 4; // filament 2 + labor (1hr * $2/hr), matches makeScenarioDeps
    const unreconstructableGap = 3;
    const job = makeScenarioJob({ sellingPrice: 10, costPerUnit: reconstructableCost + unreconstructableGap });
    const deps = makeScenarioDeps();

    const r = computeScenario(job, {}, deps);

    const storedProfit = job.sellingPrice - job.costPerUnit; // 10 - 7 = 3, genuinely profitable
    expect(storedProfit).toBeGreaterThan(0);
    expect(r.profit).not.toBeNull();
    expect(r.profit as number).toBeCloseTo(storedProfit, 9);
    expect(r.margin as number).toBeGreaterThan(0);
    expect(r.deltas.profit).toBe(0);
    expect(r.deltas.marginPts).toBe(0);
  });

  it('reconciles a live-only input drifting since save (labor rate changed) — baseline stays exact', () => {
    // Job was saved when labor cost was $2/hr (costPerUnit: 4 = filament 2 + labor 2).
    // The CURRENT (live) labor rate has since changed to $10/hr — computeScenario must
    // still reproduce the job's saved numbers exactly at zero overrides.
    const job = makeScenarioJob();
    const deps = makeScenarioDeps({ laborHourlyRate: 10 });

    const r = computeScenario(job, {}, deps);

    const storedMargin = ((job.sellingPrice - job.costPerUnit) / job.sellingPrice) * 100;
    expect(r.margin as number).toBeCloseTo(storedMargin, 9);
    expect(r.deltas.marginPts).toBe(0);
    expect(r.deltas.profit).toBe(0);
  });

  it('reconciles a fixed-cost basis gap (e.g. depreciation inputs changed since save) — break-even stays exact at rest', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1' });
    const config = makeConfig({ id: 'c1', wattage: 200, purchasePrice: 500 });
    const job = makeScenarioJob({
      printerInstanceId: 'p1',
      costPerUnit: 4 + (200 / 1000) * 2 * 0.1,
      // Saved fixed costs reflect a DIFFERENT purchase price / recovery window than
      // the live printer config now resolves to (e.g. actualPurchasePrice was edited
      // after this job was saved).
      fixedCostsAtSave: { depreciation: 50, nozzleWear: 1 },
    });
    const deps = makeScenarioDeps({ printerInstances: [instance], printerConfigs: [config] });

    const r = computeScenario(job, {}, deps);

    expect(r.deltas.breakEven).toBe(0);
  });

  it('a higher filament price than saved lowers live margin (directional effect)', () => {
    const job = makeScenarioJob();
    const deps = makeScenarioDeps();
    const r = computeScenario(job, { filamentPricePerGram: 0.10 }, deps); // saved price was 0.02

    expect(r.margin).not.toBeNull();
    const baselineMargin = ((job.sellingPrice - job.costPerUnit) / job.sellingPrice) * 100;
    expect(r.margin as number).toBeLessThan(baselineMargin);
    expect(r.deltas.marginPts as number).toBeLessThan(0);
  });

  it('a higher failure rate than saved lowers live margin (directional effect)', () => {
    const job = makeScenarioJob({ failureRate: 0 });
    const deps = makeScenarioDeps();
    const r = computeScenario(job, { failureRate: 50 }, deps);

    const baselineMargin = ((job.sellingPrice - job.costPerUnit) / job.sellingPrice) * 100;
    expect(r.margin as number).toBeLessThan(baselineMargin);
    expect(r.deltas.marginPts as number).toBeLessThan(0);
  });

  it('a higher electricity rate than saved lowers live margin when a printer is selected', () => {
    const instance = makeInstance({ id: 'p1', printerConfigId: 'c1' });
    const config = makeConfig({ id: 'c1', wattage: 200 });
    const job = makeScenarioJob({ printerInstanceId: 'p1', costPerUnit: 4 + (200 / 1000) * 2 * 0.1 }); // + electricity at baseline rate
    const deps = makeScenarioDeps({ printerInstances: [instance], printerConfigs: [config] });

    const baseline = computeScenario(job, {}, deps);
    const r = computeScenario(job, { electricityRatePerKwh: 1.0 }, deps); // much higher than the saved 0.1

    expect(r.margin as number).toBeLessThan(baseline.margin as number);
  });

  it('accepts exactly the three override keys (filamentPricePerGram, electricityRatePerKwh, failureRate)', () => {
    const job = makeScenarioJob();
    const deps = makeScenarioDeps();
    const r = computeScenario(job, { filamentPricePerGram: 0.05, electricityRatePerKwh: 0.2, failureRate: 10 }, deps);
    expect(r.margin).not.toBeNull();
  });

  it('never returns NaN/Infinity for extreme filament/electricity overrides — finite numbers or null', () => {
    const job = makeScenarioJob();
    const deps = makeScenarioDeps();
    const r = computeScenario(job, { filamentPricePerGram: 1e10, electricityRatePerKwh: 1e10 }, deps);

    if (r.margin !== null) expect(Number.isFinite(r.margin)).toBe(true);
    if (r.profit !== null) expect(Number.isFinite(r.profit)).toBe(true);
    if (r.breakEven !== null) expect(Number.isFinite(r.breakEven)).toBe(true);
    if (r.deltas.marginPts !== null) expect(Number.isFinite(r.deltas.marginPts)).toBe(true);
  });

  it('one-off materials: zero overrides report exactly zero deltas (47.1 MC-06)', () => {
    // library cost 4 (filament 2 + labor 2) + one-off 6 = saved costPerUnit 10
    const job = makeScenarioJob({
      manualMaterials: [{ id: 'm', name: 'Auger', cost: 6 }],
      costPerUnit: 10,
    });
    const r = computeScenario(job, {}, makeScenarioDeps());
    expect(r.deltas.profit).toBe(0);
    expect(r.deltas.marginPts).toBe(0);
  });

  it('one-off materials stay flat under a failure-rate override (D-07): only the library cost scales', () => {
    const job = makeScenarioJob({
      manualMaterials: [{ id: 'm', name: 'Auger', cost: 6 }],
      costPerUnit: 10,
    });
    const r = computeScenario(job, { failureRate: 50 }, makeScenarioDeps());
    // 10 - ((2 + 2) / (1 - 0.5) + 6) = -4. A failure-scaled one-off would give -10.
    expect(r.profit).toBeCloseTo(-4, 9);
  });

  it('clamps an out-of-range failureRate override the same way calculateCost does internally', () => {
    const job = makeScenarioJob();
    const deps = makeScenarioDeps();
    const r = computeScenario(job, { failureRate: 500 }, deps); // calculateCost clamps to 99
    expect(r.margin).not.toBeNull();
    expect(Number.isFinite(r.margin as number)).toBe(true);
  });
});
