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
import { resolveWeightedCostPerKwh } from './touElectricity';
import { resolveIsAbrasive, resolveNozzleType } from './abrasive';

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
  // Phase 39 TOU-02: "HH:MM" print-start time. Undefined = flat electricity.costPerKwh
  // rate is used (existing behavior, byte-identical). Only takes effect when
  // electricity.touBands is also configured (see calculateElectricityCost below).
  touStartTime?: string;
  // Phase 39 WEAR-02 (D-14): manual maintenance-cost input, $/hour. Undefined/0 =
  // no maintenance cost line (existing behavior, byte-identical).
  maintenanceCostPerHour?: number;
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
//
// Phase 39 TOU-02: when electricity.touBands is configured AND a touStartTime is
// supplied, the $/kWh rate is resolved via resolveWeightedCostPerKwh (touElectricity.ts)
// instead of the flat electricity.costPerKwh — the (wattage/1000) × printTimeHours
// multiplication itself is UNCHANGED. Absent bands/startTime, resolveWeightedCostPerKwh
// itself falls back to the flat rate, so the byte-identical-for-non-TOU-jobs guarantee
// holds without a separate branch here.
export function calculateElectricityCost(
  printTimeHours: number,
  selectedPrinter: PrinterConfig | undefined,
  electricity: ElectricityConfig,
  touStartTime?: string,
): number {
  if (!selectedPrinter) return 0;
  const rate = resolveWeightedCostPerKwh(electricity.touBands, electricity.costPerKwh, touStartTime, printTimeHours);
  return (selectedPrinter.wattage / 1000) * printTimeHours * rate;
}

// Resolves the same $/kWh rate calculateElectricityCost uses internally, so the
// orchestrator (CostCalculator.tsx) can snapshot `touRateUsedPerKwh` onto the saved
// PrintJob at save time (D-12) without duplicating the TOU-resolution logic.
export function resolveElectricityRatePerKwh(
  printTimeHours: number,
  electricity: ElectricityConfig,
  touStartTime?: string,
): number {
  return resolveWeightedCostPerKwh(electricity.touBands, electricity.costPerKwh, touStartTime, printTimeHours);
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

// Dominant-material abrasive check: does the filament row with the HIGHEST grams
// resolve as abrasive (resolveIsAbrasive)? Mirrors dominantMaterialId's
// "highest-grams wins" semantic (src/db/failureRate.ts D-08) but works directly off
// CalcInputFilamentRow (the form-state shape) rather than the persisted FilamentUsage[]
// shape, so it can run before a job is saved.
function isDominantMaterialAbrasive(filamentRows: CalcInput['filamentRows'], materials: Material[]): boolean {
  let best: CalcInputFilamentRow | undefined;
  for (const row of filamentRows) {
    if (row.grams <= 0 || !row.filamentId) continue;
    if (!best || row.grams > best.grams) best = row;
  }
  if (!best) return false;
  const asset = materials.find(m => m.id === best!.filamentId);
  if (!asset) return false;
  return resolveIsAbrasive(asset);
}

// Abrasive surcharge (Phase 39 WEAR-02, D-13): a NEW additive cost line, NEVER a
// modification to calculateNozzleWear's own formula (RESEARCH.md Pitfall 1). Applies
// ONLY when the dominant (highest-grams) filament resolves abrasive AND the printer
// instance's nozzle resolves to 'brass' (resolveNozzleType defaults undefined -> 'brass').
// Surcharge amount = the SAME nozzle-wear cost again (i.e. abrasive filament on a
// stock brass nozzle doubles the wear cost) — a simple, auditable multiplier rather
// than a second wear model. 0 when the gate doesn't apply (byte-identical default).
export function calculateAbrasiveSurcharge(
  filamentRows: CalcInput['filamentRows'],
  materials: Material[],
  selectedPrinter: PrinterConfig | undefined,
  selectedInstance: PrinterInstance | undefined,
): number {
  if (!selectedInstance) return 0;
  if (resolveNozzleType(selectedInstance) !== 'brass') return 0;
  if (!isDominantMaterialAbrasive(filamentRows, materials)) return 0;
  return calculateNozzleWear(filamentRows, materials, selectedPrinter);
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

// Tax: Math.round(sellingPrice * ratePercent) / 100 — JS Math.round uses
// half-to-positive-infinity rounding (Math.round(0.5) === 1, Math.round(-0.5) === 0).
// sellingPrice <= 0 short-circuits to 0 so negative rounding semantics are unreachable.
// TAX-05 lock: tax applies to sellingPrice (not subtotal); see costCalc.test.ts order-of-operations guard.
export function calculateTax(
  sellingPrice: number,
  ratePercent: number,
): { taxAmount: number; ratePercent: number } {
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
    return { taxAmount: 0, ratePercent: 0 };
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    return { taxAmount: 0, ratePercent };
  }
  const taxAmount = Math.round(sellingPrice * ratePercent) / 100;
  return { taxAmount, ratePercent };
}

// Orchestrator. Returns the full CostBreakdown contract, byte-for-byte
// identical to the useMemo at CostCalculator.tsx:374-446 when the new Phase 39
// fields (touStartTime, maintenanceCostPerHour) are absent/zero and no
// abrasive-on-brass condition is met.
export function calculateCost(input: CalcInput): CostBreakdown {
  const filamentCost = calculateFilamentCost(input.filamentRows);
  const electricityCost = calculateElectricityCost(
    input.printTimeHours,
    input.selectedPrinter,
    input.electricity,
    input.touStartTime,
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

  // Phase 39 WEAR-02 (D-14): NEW additive maintenance-cost line. Default
  // (undefined/0) contributes 0 — byte-identical to pre-Phase-39 jobs.
  const maintenanceCost = (input.maintenanceCostPerHour ?? 0) * input.printTimeHours;

  // Phase 39 WEAR-01 (D-13): NEW additive abrasive surcharge. Gated on the
  // dominant filament resolving abrasive AND the instance's nozzle resolving
  // to 'brass' — see calculateAbrasiveSurcharge. Never a silent change to
  // calculateNozzleWear's own formula.
  const abrasiveSurcharge = calculateAbrasiveSurcharge(
    input.filamentRows,
    input.materials,
    input.selectedPrinter,
    input.selectedInstance,
  );

  // Per-unit subtotal (consumables only — NOT including depreciation/nozzle).
  // When modelCostPerUnit is true, model cost is included here instead of fixed costs.
  // Matches CostCalculator.tsx:425-426, extended additively with maintenanceCost +
  // abrasiveSurcharge (both 0 by default).
  const perUnitSubtotal = filamentCost + electricityCost + materialsCost + laborCost + perUnitModelCost + maintenanceCost + abrasiveSurcharge;

  // Failure-adjusted per-unit cost (clamp to 0-99 to prevent division by zero).
  // Clamp lives INSIDE calculateCost per D-02 — matches CostCalculator.tsx:428-431.
  const clampedFailureRate = Math.min(Math.max(input.failureRate, 0), 99);
  const failureMultiplier = 1 / (1 - clampedFailureRate / 100);
  const failureAdjusted = perUnitSubtotal * failureMultiplier;

  // Field order matches CostCalculator.tsx:433-446 for diff cleanliness; new
  // Phase 39 fields (touRateUsedPerKwh, maintenanceCost, abrasiveSurcharge)
  // appended at the end.
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
    touRateUsedPerKwh: resolveElectricityRatePerKwh(input.printTimeHours, input.electricity, input.touStartTime),
    maintenanceCost,
    abrasiveSurcharge,
  };
}
