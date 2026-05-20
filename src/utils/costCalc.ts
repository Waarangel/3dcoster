import type {
  CostBreakdown,
  Material,
  PrinterConfig,
  PrinterInstance,
  ElectricityConfig,
  MaterialUsage,
  Currency,
} from '../types';
import { getMaterialDensity } from './gcodeParser';

// Pure cost-calculation module. Mirrors the math in
// src/components/CostCalculator.tsx:374-446 (the `useMemo((): CostBreakdown => {…})`)
// with byte-for-byte identical semantics. No React, no Dexie, no IO.

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

// Filament cost: Σ row.grams × row.editedPrice across rows with a truthy
// filamentId and editedPrice > 0 (matches CostCalculator.tsx:376-379).
export function calculateFilamentCost(filamentRows: CalcInput['filamentRows']): number {
  return filamentRows.reduce((sum, row) => {
    if (!row.filamentId || row.editedPrice <= 0) return sum;
    return sum + row.grams * row.editedPrice;
  }, 0);
}

// Electricity cost: (wattage / 1000) × printTimeHours × costPerKwh; 0 if no printer
// (matches CostCalculator.tsx:382-384).
export function calculateElectricityCost(
  printTimeHours: number,
  selectedPrinter: PrinterConfig | undefined,
  electricity: ElectricityConfig,
): number {
  return selectedPrinter
    ? (selectedPrinter.wattage / 1000) * printTimeHours * electricity.costPerKwh
    : 0;
}

// Depreciation: (purchasePrice / (recoveryMonths × monthlyHours)) × printTimeHours;
// 0 if recovery hours collapse to 0 (matches CostCalculator.tsx:388-393).
export function calculateDepreciation(
  printTimeHours: number,
  selectedPrinter: PrinterConfig | undefined,
  selectedInstance: PrinterInstance | undefined,
): number {
  const purchasePrice = selectedInstance?.actualPurchasePrice ?? selectedPrinter?.purchasePrice ?? 0;
  const recoveryMonths = selectedInstance?.recoveryMonths ?? 12;
  const monthlyHours = selectedInstance?.estimatedMonthlyPrintHours ?? 40;
  const totalRecoveryHours = recoveryMonths * monthlyHours;
  const depreciationPerHour = totalRecoveryHours > 0 ? purchasePrice / totalRecoveryHours : 0;
  return depreciationPerHour * printTimeHours;
}

// Nozzle wear: Σ (grams / getMaterialDensity(material.filamentType)) → volumeCm³,
// then × (nozzleCost / nozzleLifespanCm³); 0 if no printer
// (matches CostCalculator.tsx:397-405).
export function calculateNozzleWear(
  filamentRows: CalcInput['filamentRows'],
  materials: Material[],
  selectedPrinter: PrinterConfig | undefined,
): number {
  const totalVolumeCm3 = filamentRows.reduce((sum, row) => {
    if (row.grams <= 0) return sum;
    const asset = materials.find(m => m.id === row.filamentId);
    const density = getMaterialDensity(asset?.filamentType ?? null);
    return sum + row.grams / density;
  }, 0);
  return selectedPrinter
    ? (totalVolumeCm3 / selectedPrinter.nozzleLifespanCm3) * selectedPrinter.nozzleCost
    : 0;
}

// Labor: ((prepTimeMinutes + postProcessingMinutes) / 60) × hourlyRate
// (matches CostCalculator.tsx:418-419).
export function calculateLabor(
  prepTimeMinutes: number,
  postProcessingMinutes: number,
  laborHourlyRate: number,
): number {
  const totalLaborMinutes = prepTimeMinutes + postProcessingMinutes;
  return (totalLaborMinutes / 60) * laborHourlyRate;
}

// Model amortization: currently always 0. Reserved for a future fixed-cost
// amortization path (mirrors `const modelAmortization = 0;` at
// CostCalculator.tsx:408). Helper is exported so the test plan can lock
// the contract — when the amortization path lands, change this body and
// every consumer/test will pick it up automatically.
export function calculateAmortization(): number {
  return 0;
}

// Orchestrator. Returns the full 12-field CostBreakdown contract,
// byte-for-byte identical to the useMemo at CostCalculator.tsx:374-446.
export function calculateCost(input: CalcInput): CostBreakdown {
  const filamentCost = calculateFilamentCost(input.filamentRows);
  const electricityCost = calculateElectricityCost(
    input.printTimeHours,
    input.selectedPrinter,
    input.electricity,
  );
  const depreciation = calculateDepreciation(
    input.printTimeHours,
    input.selectedPrinter,
    input.selectedInstance,
  );
  const nozzleWear = calculateNozzleWear(
    input.filamentRows,
    input.materials,
    input.selectedPrinter,
  );
  const modelAmortization = calculateAmortization();
  const laborCost = calculateLabor(
    input.prepTimeMinutes,
    input.postProcessingMinutes,
    input.laborHourlyRate,
  );

  // Materials cost (consumables - per unit) — matches CostCalculator.tsx:411-415.
  const materialsCost = input.materialsUsed.reduce((total: number, usage: MaterialUsage) => {
    const material = input.materials.find(m => m.id === usage.materialId);
    if (!material) return total;
    return total + usage.quantity * (material.costPerUnit ?? 0);
  }, 0);

  // Per-unit model license cost (if enabled) — matches CostCalculator.tsx:421-422.
  const perUnitModelCost = input.modelCostPerUnit ? input.modelCost : 0;

  // Per-unit subtotal (consumables only — NOT including depreciation/nozzle).
  // When modelCostPerUnit is true, model cost is included here instead of fixed costs.
  // Matches CostCalculator.tsx:425-426.
  const perUnitSubtotal = filamentCost + electricityCost + materialsCost + laborCost + perUnitModelCost;

  // Failure-adjusted per-unit cost (clamp to 0-99 to prevent division by zero).
  // Clamp lives INSIDE calculateCost per D-02 — matches CostCalculator.tsx:428-431.
  const clampedFailureRate = Math.min(Math.max(input.failureRate, 0), 99);
  const failureMultiplier = 1 / (1 - clampedFailureRate / 100);
  const failureAdjusted = perUnitSubtotal * failureMultiplier;

  // Field order matches CostCalculator.tsx:433-446 for diff cleanliness.
  return {
    filament: filamentCost,
    electricity: electricityCost,
    printerDepreciation: depreciation, // Fixed cost - shown separately
    nozzleWear: nozzleWear,             // Fixed cost - shown separately
    modelAmortization: modelAmortization,
    materials: materialsCost,
    labor: laborCost,
    subtotal: perUnitSubtotal,          // Per-unit only (no depreciation/nozzle)
    failureAdjusted: failureAdjusted,   // Per-unit failure adjusted
    profitMargin: input.profitMarginPercent,
    targetProfit: input.targetProfit,
    sellingPrice: input.sellingPrice,
  };
}
