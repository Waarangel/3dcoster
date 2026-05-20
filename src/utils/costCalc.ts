import type {
  CostBreakdown,
  Material,
  PrinterConfig,
  PrinterInstance,
  ElectricityConfig,
  MaterialUsage,
  Currency,
} from '../types';

// Pure cost-calculation module. Mirrors the math in
// src/components/CostCalculator.tsx:374-446 (the `useMemo((): CostBreakdown => {…})`)
// with byte-for-byte identical semantics. No React, no Dexie, no IO.
//
// Task 1 (this commit): types + skeleton + acceptance scaffolding (throws).
// Task 2: implements bodies, adds the `getMaterialDensity` import, removes throws.

// Internal form-state shape (matches the FilamentRow interface inside CostCalculator.tsx:47-52).
// Re-declared here so the pure module does not depend on the component file.
export interface CalcInputFilamentRow {
  filamentId: string;
  grams: number;
  editedPrice: number;
  editedCurrency: Currency;
}

// Every closure variable the useMemo at CostCalculator.tsx:374 reads.
// Optionality mirrors the source: selectedPrinter and selectedInstance are
// treated as nullable via `?.` / `??` callsites.
export interface CalcInput {
  filamentRows: CalcInputFilamentRow[];
  printTimeHours: number;
  selectedPrinter: PrinterConfig | undefined;
  selectedInstance: PrinterInstance | undefined;
  electricity: ElectricityConfig;
  materials: Material[];
  materialsUsed: MaterialUsage[];
  prepTimeMinutes: number;
  postProcessingMinutes: number;
  laborHourlyRate: number;
  failureRate: number;
  profitMarginPercent: number;
  targetProfit: number;
  sellingPrice: number;
  modelCost: number;
  modelCostPerUnit: boolean;
}

// Filament cost: Σ row.grams × row.editedPrice across rows passing the row guard.
// TODO(Task 2): implement.
export function calculateFilamentCost(_filamentRows: CalcInput['filamentRows']): number {
  throw new Error('not implemented');
}

// Electricity cost: (wattage / 1000) × printTimeHours × costPerKwh; 0 if no printer.
// TODO(Task 2): implement.
export function calculateElectricityCost(
  _printTimeHours: number,
  _selectedPrinter: PrinterConfig | undefined,
  _electricity: ElectricityConfig,
): number {
  throw new Error('not implemented');
}

// Depreciation per hour × printTimeHours; 0 if recovery hours collapses to 0.
// TODO(Task 2): implement.
export function calculateDepreciation(
  _printTimeHours: number,
  _selectedPrinter: PrinterConfig | undefined,
  _selectedInstance: PrinterInstance | undefined,
): number {
  throw new Error('not implemented');
}

// Nozzle wear: Σ (grams / density) → volume; × (nozzleCost / nozzleLifespanCm3).
// TODO(Task 2): implement (will add `getMaterialDensity` import from './gcodeParser').
export function calculateNozzleWear(
  _filamentRows: CalcInput['filamentRows'],
  _materials: Material[],
  _selectedPrinter: PrinterConfig | undefined,
): number {
  throw new Error('not implemented');
}

// Labor: ((prepTime + postProcessing) / 60) × hourlyRate.
// TODO(Task 2): implement.
export function calculateLabor(
  _prepTimeMinutes: number,
  _postProcessingMinutes: number,
  _laborHourlyRate: number,
): number {
  throw new Error('not implemented');
}

// Model amortization: currently always 0. Reserved for a future
// fixed-cost amortization path (mirrors `modelAmortization = 0` at
// CostCalculator.tsx:408). Helper is exported so the test plan can lock the contract.
// TODO(Task 2): implement (returns 0).
export function calculateAmortization(): number {
  throw new Error('not implemented');
}

// Orchestrator. Returns the full 12-field CostBreakdown contract.
// TODO(Task 2): implement.
export function calculateCost(_input: CalcInput): CostBreakdown {
  throw new Error('not implemented');
}
