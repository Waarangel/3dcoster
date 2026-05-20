import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  calculateFilamentCost,
  calculateElectricityCost,
  calculateDepreciation,
  calculateNozzleWear,
  calculateLabor,
  calculateAmortization,
} from './costCalc';
import { getMaterialDensity } from './gcodeParser';
import type {
  Material,
  PrinterConfig,
  PrinterInstance,
  ElectricityConfig,
  MaterialUsage,
  FilamentType,
} from '../types';
import type { CalcInput, CalcInputFilamentRow } from './costCalc';

// ---------------------------------------------------------------------------
// Synthetic-fixture helpers (D-11: hand-built inputs where math is verifiable by eye)
// ---------------------------------------------------------------------------

function makePrinter(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    id: 'printer-1',
    name: 'Test Printer',
    purchasePrice: 1200,
    expectedLifespanHours: 5000,
    wattage: 100,
    nozzleCost: 20,
    nozzleLifespanCm3: 1000,
    ...overrides,
  };
}

function makeInstance(overrides: Partial<PrinterInstance> = {}): PrinterInstance {
  return {
    id: 'instance-1',
    printerConfigId: 'printer-1',
    nickname: 'Test Instance',
    printHours: 0,
    actualPurchasePrice: 1200,
    recoveryMonths: 12,
    estimatedMonthlyPrintHours: 40,
    ...overrides,
  };
}

function makeMaterial(id: string, filamentType: FilamentType): Material {
  return {
    id,
    name: `${filamentType} Spool`,
    category: 'filament',
    filamentType,
    unit: 'g',
    costPerUnit: 0.02,
    currency: 'USD',
  };
}

function makeRow(overrides: Partial<CalcInputFilamentRow> = {}): CalcInputFilamentRow {
  return {
    filamentId: 'mat-pla',
    grams: 500,
    editedPrice: 0.02,
    editedCurrency: 'USD',
    ...overrides,
  };
}

function makeElectricity(costPerKwh = 0.12): ElectricityConfig {
  return { costPerKwh };
}

// Build a baseline CalcInput so integration tests can override only what matters.
function makeCalcInput(overrides: Partial<CalcInput> = {}): CalcInput {
  const printer = makePrinter();
  const instance = makeInstance();
  const plaMat = makeMaterial('mat-pla', 'PLA');
  return {
    filamentRows: [makeRow({ filamentId: 'mat-pla', grams: 500, editedPrice: 0.02 })],
    printTimeHours: 2,
    selectedPrinter: printer,
    selectedInstance: instance,
    electricity: makeElectricity(0.12),
    materials: [plaMat],
    materialsUsed: [],
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    laborHourlyRate: 20,
    failureRate: 0,
    profitMarginPercent: 30,
    targetProfit: 5,
    sellingPrice: 25,
    modelCost: 0,
    modelCostPerUnit: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// describe blocks — one per sub-helper, then getMaterialDensity smoke, then integration
// ---------------------------------------------------------------------------

describe('calculateFilamentCost', () => {
  it('Test 1 (TEST-01): returns 0 for empty rows', () => {
    expect(calculateFilamentCost([])).toBe(0);
  });

  it('Test 2 (TEST-01): computes grams × editedPrice for a single valid row', () => {
    const row = makeRow({ filamentId: 'x', grams: 500, editedPrice: 0.02 });
    expect(calculateFilamentCost([row])).toBeCloseTo(10.00, 2);
  });

  it('Test 3 (TEST-01): row with empty filamentId contributes 0', () => {
    const valid = makeRow({ filamentId: 'x', grams: 500, editedPrice: 0.02 });
    const empty = makeRow({ filamentId: '', grams: 999, editedPrice: 0.05 });
    expect(calculateFilamentCost([valid, empty])).toBeCloseTo(10.00, 2);
  });

  it('Test 4 (TEST-01): row with editedPrice === 0 contributes 0 (guard)', () => {
    const zero = makeRow({ filamentId: 'x', grams: 500, editedPrice: 0 });
    expect(calculateFilamentCost([zero])).toBe(0);
  });

  it('Test 5 (TEST-01): row with editedPrice < 0 contributes 0 (guard)', () => {
    const negative = makeRow({ filamentId: 'x', grams: 500, editedPrice: -0.01 });
    expect(calculateFilamentCost([negative])).toBe(0);
  });

  it('Test 6 (TEST-01): sums across multiple valid rows', () => {
    const a = makeRow({ filamentId: 'a', grams: 100, editedPrice: 0.02 }); // 2.00
    const b = makeRow({ filamentId: 'b', grams: 250, editedPrice: 0.03 }); // 7.50
    expect(calculateFilamentCost([a, b])).toBeCloseTo(9.50, 2);
  });
});

describe('calculateElectricityCost', () => {
  it('Test 1 (TEST-01): returns 0 when no printer is selected', () => {
    expect(calculateElectricityCost(5, undefined, makeElectricity(0.12))).toBe(0);
  });

  it('Test 2 (TEST-01): 100W printer × 2h × $0.12/kWh = 0.024', () => {
    const printer = makePrinter({ wattage: 100 });
    expect(calculateElectricityCost(2, printer, makeElectricity(0.12))).toBeCloseTo(0.024, 4);
  });

  it('Test 3 (TEST-01): scales linearly with printTimeHours', () => {
    const printer = makePrinter({ wattage: 200 });
    // (200/1000) * 10 * 0.15 = 0.3
    expect(calculateElectricityCost(10, printer, makeElectricity(0.15))).toBeCloseTo(0.30, 2);
  });
});

describe('calculateDepreciation', () => {
  it('Test 1 (TEST-01): returns 0 when no printer and no instance are selected', () => {
    expect(calculateDepreciation(4, undefined, undefined)).toBe(0);
  });

  it('Test 2 (TEST-01): instance happy path — purchasePrice / (recoveryMonths × monthlyHours) × printTime', () => {
    const printer = makePrinter();
    const instance = makeInstance({
      actualPurchasePrice: 1200,
      recoveryMonths: 12,
      estimatedMonthlyPrintHours: 40,
    });
    // (1200 / (12 * 40)) * 4 = (1200 / 480) * 4 = 2.5 * 4 = 10.00
    expect(calculateDepreciation(4, printer, instance)).toBeCloseTo(10.00, 2);
  });

  it('Test 3 (TEST-01): falls back to selectedPrinter.purchasePrice when instance is undefined', () => {
    const printer = makePrinter({ purchasePrice: 960 });
    // recoveryMonths defaults to 12, monthlyHours to 40 → 12*40=480
    // (960 / 480) * 4 = 2 * 4 = 8.00
    expect(calculateDepreciation(4, printer, undefined)).toBeCloseTo(8.00, 2);
  });

  it('Test 4 (TEST-01): zero-recovery-hours guard — recoveryMonths=0 yields 0 (not NaN/Infinity)', () => {
    const printer = makePrinter();
    const instance = makeInstance({ recoveryMonths: 0, estimatedMonthlyPrintHours: 40 });
    expect(calculateDepreciation(4, printer, instance)).toBe(0);
  });

  it('Test 5 (TEST-01): zero-recovery-hours guard — estimatedMonthlyPrintHours=0 yields 0', () => {
    const printer = makePrinter();
    const instance = makeInstance({ recoveryMonths: 12, estimatedMonthlyPrintHours: 0 });
    expect(calculateDepreciation(4, printer, instance)).toBe(0);
  });
});

describe('calculateNozzleWear', () => {
  it('Test 1 (TEST-01): returns 0 when no printer is selected', () => {
    const rows = [makeRow({ filamentId: 'mat-pla', grams: 500, editedPrice: 0.02 })];
    const materials = [makeMaterial('mat-pla', 'PLA')];
    expect(calculateNozzleWear(rows, materials, undefined)).toBe(0);
  });

  it('Test 2 (TEST-01): single-material happy path — 124g PLA = 100cm³, × (20/1000) = 2.00', () => {
    // density(PLA) = 1.24 → 124g / 1.24 = 100 cm³
    // (100 / 1000) * 20 = 2.00
    const rows = [makeRow({ filamentId: 'mat-pla', grams: 124, editedPrice: 0.02 })];
    const materials = [makeMaterial('mat-pla', 'PLA')];
    const printer = makePrinter({ nozzleLifespanCm3: 1000, nozzleCost: 20 });
    expect(calculateNozzleWear(rows, materials, printer)).toBeCloseTo(2.00, 2);
  });

  it('Test 3 (TEST-01): multi-material density mixing — PLA + PETG sums per-material volumes', () => {
    // 124g PLA / 1.24 = 100 cm³
    // 127g PETG / 1.27 = 100 cm³
    // total = 200 cm³ → (200/1000) * 20 = 4.00
    const rows = [
      makeRow({ filamentId: 'mat-pla', grams: 124, editedPrice: 0.02 }),
      makeRow({ filamentId: 'mat-petg', grams: 127, editedPrice: 0.03 }),
    ];
    const materials = [
      makeMaterial('mat-pla', 'PLA'),
      makeMaterial('mat-petg', 'PETG'),
    ];
    const printer = makePrinter({ nozzleLifespanCm3: 1000, nozzleCost: 20 });
    expect(calculateNozzleWear(rows, materials, printer)).toBeCloseTo(4.00, 2);
  });

  it('Test 4 (TEST-01): rows with grams <= 0 contribute 0 to volume', () => {
    const rows = [
      makeRow({ filamentId: 'mat-pla', grams: 0, editedPrice: 0.02 }),
      makeRow({ filamentId: 'mat-pla', grams: -50, editedPrice: 0.02 }),
    ];
    const materials = [makeMaterial('mat-pla', 'PLA')];
    const printer = makePrinter({ nozzleLifespanCm3: 1000, nozzleCost: 20 });
    expect(calculateNozzleWear(rows, materials, printer)).toBe(0);
  });

  it('Test 5 (TEST-01): unknown filamentId falls back to default PLA density (1.24)', () => {
    // No material registered for filamentId 'mystery' → asset is undefined → density defaults to 1.24
    const rows = [makeRow({ filamentId: 'mystery', grams: 124, editedPrice: 0.02 })];
    const materials: Material[] = [];
    const printer = makePrinter({ nozzleLifespanCm3: 1000, nozzleCost: 20 });
    // 124 / 1.24 = 100 cm³ → (100/1000) * 20 = 2.00
    expect(calculateNozzleWear(rows, materials, printer)).toBeCloseTo(2.00, 2);
  });
});

describe('calculateLabor', () => {
  it('Test 1 (TEST-01): returns 0 when both prep and post are 0', () => {
    expect(calculateLabor(0, 0, 20)).toBe(0);
  });

  it('Test 2 (TEST-01): 30 prep + 30 post minutes @ $20/h = 20.00', () => {
    expect(calculateLabor(30, 30, 20)).toBeCloseTo(20.00, 2);
  });

  it('Test 3 (TEST-01): hourly rate of 0 yields 0 regardless of minutes', () => {
    expect(calculateLabor(60, 60, 0)).toBe(0);
  });
});

describe('calculateAmortization', () => {
  it('Test 1 (TEST-01): placeholder returns 0 (locks the contract for v1.2)', () => {
    expect(calculateAmortization()).toBe(0);
  });
});

describe('getMaterialDensity (smoke tests)', () => {
  // D-11 hybrid fixtures: real-data smoke tests locking the v1.0 nozzle-wear fix density table.
  it('Test 1: PLA → 1.24 g/cm³', () => {
    expect(getMaterialDensity('PLA')).toBe(1.24);
  });

  it('Test 2: PETG → 1.27 g/cm³', () => {
    expect(getMaterialDensity('PETG')).toBe(1.27);
  });

  it('Test 3: ABS → 1.04 g/cm³', () => {
    expect(getMaterialDensity('ABS')).toBe(1.04);
  });

  it('Test 4: unrecognized string ("UnknownXYZ") falls back to 1.24 (PLA default)', () => {
    expect(getMaterialDensity('UnknownXYZ')).toBe(1.24);
  });

  it('Test 5: null input falls back to 1.24 (PLA default branch)', () => {
    expect(getMaterialDensity(null)).toBe(1.24);
  });
});

describe('calculateCost (integration)', () => {
  it('Test 1 (TEST-01): single filament row produces the full 12-field CostBreakdown', () => {
    const input = makeCalcInput({
      filamentRows: [makeRow({ filamentId: 'mat-pla', grams: 500, editedPrice: 0.02 })],
      printTimeHours: 2,
      failureRate: 0,
    });
    const result = calculateCost(input);

    // 12 fields present
    expect(result).toHaveProperty('filament');
    expect(result).toHaveProperty('electricity');
    expect(result).toHaveProperty('printerDepreciation');
    expect(result).toHaveProperty('nozzleWear');
    expect(result).toHaveProperty('modelAmortization');
    expect(result).toHaveProperty('materials');
    expect(result).toHaveProperty('labor');
    expect(result).toHaveProperty('subtotal');
    expect(result).toHaveProperty('failureAdjusted');
    expect(result).toHaveProperty('profitMargin');
    expect(result).toHaveProperty('targetProfit');
    expect(result).toHaveProperty('sellingPrice');

    // filament: 500 * 0.02 = 10.00
    expect(result.filament).toBeCloseTo(10.00, 2);
    // model amortization placeholder
    expect(result.modelAmortization).toBe(0);
    // failureRate=0 → failureAdjusted equals subtotal
    expect(result.failureAdjusted).toBeCloseTo(result.subtotal, 6);
  });

  it('Test 2 (TEST-01): two-filament (multi-color) row sum matches generic multi-color path', () => {
    const input = makeCalcInput({
      filamentRows: [
        makeRow({ filamentId: 'mat-pla', grams: 200, editedPrice: 0.02 }),  // 4.00
        makeRow({ filamentId: 'mat-petg', grams: 100, editedPrice: 0.03 }), // 3.00
      ],
      materials: [
        makeMaterial('mat-pla', 'PLA'),
        makeMaterial('mat-petg', 'PETG'),
      ],
      failureRate: 0,
    });
    const result = calculateCost(input);
    expect(result.filament).toBeCloseTo(7.00, 2);
  });

  it('Test 3 (TEST-01): 16-filament rows (Bambu AMS Hub max per PROJECT.md v1.0)', () => {
    const rows: CalcInputFilamentRow[] = Array.from({ length: 16 }, (_, i) => ({
      filamentId: `mat-${i}`,
      grams: 50,
      editedPrice: 0.02,
      editedCurrency: 'USD',
    }));
    const materials: Material[] = Array.from({ length: 16 }, (_, i) =>
      makeMaterial(`mat-${i}`, 'PLA'),
    );
    const input = makeCalcInput({
      filamentRows: rows,
      materials,
      failureRate: 0,
    });
    expect(rows.length).toBe(16);
    const result = calculateCost(input);
    // 16 * (50 * 0.02) = 16 * 1.00 = 16.00
    expect(result.filament).toBeCloseTo(16.00, 2);
  });

  it('Test 4 (TEST-01): failure-rate 0 → multiplier 1 (failureAdjusted equals subtotal)', () => {
    const input = makeCalcInput({ failureRate: 0 });
    const result = calculateCost(input);
    expect(result.failureAdjusted).toBeCloseTo(result.subtotal, 6);
  });

  it('Test 5 (TEST-01): failure-rate 99 → multiplier 100 (failureAdjusted = subtotal * 100)', () => {
    const input = makeCalcInput({ failureRate: 99 });
    const result = calculateCost(input);
    expect(result.failureAdjusted).toBeCloseTo(result.subtotal * 100, 4);
  });

  it('Test 6 (TEST-01): failure-rate 150 clamps to 99 → multiplier 100', () => {
    const input = makeCalcInput({ failureRate: 150 });
    const result = calculateCost(input);
    // 150 clamps to 99; 1 / (1 - 0.99) = 100
    expect(result.failureAdjusted).toBeCloseTo(result.subtotal * 100, 4);
  });

  it('Test 7 (TEST-01): failure-rate -10 clamps to 0 → multiplier 1 (failureAdjusted equals subtotal)', () => {
    const input = makeCalcInput({ failureRate: -10 });
    const result = calculateCost(input);
    // -10 clamps to 0; 1 / (1 - 0) = 1
    expect(result.failureAdjusted).toBeCloseTo(result.subtotal, 6);
  });

  it('Test 8 (TEST-01): no-printer-selected → electricityCost == 0 AND nozzleWear == 0 in the breakdown', () => {
    const input = makeCalcInput({
      selectedPrinter: undefined,
      selectedInstance: undefined,
    });
    const result = calculateCost(input);
    expect(result.electricity).toBe(0);
    expect(result.nozzleWear).toBe(0);
    expect(result.printerDepreciation).toBe(0);
  });

  it('Test 9 (TEST-01): profitMargin / targetProfit / sellingPrice pass through from input unchanged', () => {
    const input = makeCalcInput({
      profitMarginPercent: 42.5,
      targetProfit: 7.77,
      sellingPrice: 99.99,
    });
    const result = calculateCost(input);
    expect(result.profitMargin).toBe(42.5);
    expect(result.targetProfit).toBe(7.77);
    expect(result.sellingPrice).toBe(99.99);
  });

  it('Test 10 (TEST-01): materialsUsed sums per-material costPerUnit × quantity', () => {
    const supplies: Material = {
      id: 'sandpaper-120',
      name: 'Sandpaper 120',
      category: 'finishing',
      unit: 'sheet',
      costPerUnit: 0.50,
    };
    const materialsUsed: MaterialUsage[] = [
      { materialId: 'sandpaper-120', quantity: 3 }, // 3 * 0.50 = 1.50
    ];
    const input = makeCalcInput({
      materials: [makeMaterial('mat-pla', 'PLA'), supplies],
      materialsUsed,
    });
    const result = calculateCost(input);
    expect(result.materials).toBeCloseTo(1.50, 2);
  });

  it('Test 11 (TEST-01): per-unit model cost flows into subtotal when modelCostPerUnit=true', () => {
    const input = makeCalcInput({
      filamentRows: [],
      materialsUsed: [],
      prepTimeMinutes: 0,
      postProcessingMinutes: 0,
      electricity: makeElectricity(0),
      selectedPrinter: undefined,
      selectedInstance: undefined,
      modelCost: 4,
      modelCostPerUnit: true,
      failureRate: 0,
    });
    const result = calculateCost(input);
    // Only the per-unit model cost survives in subtotal
    expect(result.subtotal).toBeCloseTo(4, 2);
    expect(result.failureAdjusted).toBeCloseTo(4, 2);
  });

  it.todo('tax/VAT applies after subtotal — activates in v1.2');
});
