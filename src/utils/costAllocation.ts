/**
 * Pure, React-free cost-allocation math for the calculator's Cost Breakdown viz.
 *
 * Re-shapes the ALREADY-COMPUTED cost components (filament, labor, electricity,
 * depreciation, …) into ordered %-segments for a stacked bar + legend. It does
 * NO new cost math — every value is passed in already derived by calculateCost /
 * the fixedCosts memo. Integer percents are normalized with the largest-remainder
 * method so the bar and legend always sum to exactly 100 (SC1), independent of
 * CSS width rounding. At total = 0 it returns [] so the renderer shows nothing
 * (no NaN/Infinity/empty-bar noise).
 */

export interface AllocationSegment {
  key: string;
  label: string;
  value: number;
  /** integer percent; the returned segments sum to exactly 100 */
  pct: number;
  /** hex, shared by the bar segment and the legend swatch so they can't drift */
  color: string;
}

export interface CostAllocationInput {
  filament?: number;
  materials?: number; // post-processing supplies (costs.materials)
  labor?: number;
  electricity?: number;
  depreciation?: number;
  nozzleWear?: number;
  modelCost?: number;
  packaging?: number;
  shipping?: number;
}

// Stable, ordered component spec — order = bar segment order = legend order.
// Colors are concrete hex (used inline for bar `background` + legend swatch) drawn
// from the Tailwind palette so they sit naturally on the slate dark theme.
const COMPONENTS: ReadonlyArray<{ key: keyof CostAllocationInput; label: string; color: string }> = [
  { key: 'filament', label: 'Filament', color: '#3b82f6' }, // blue-500
  { key: 'materials', label: 'Supplies', color: '#14b8a6' }, // teal-500
  { key: 'labor', label: 'Labor', color: '#8b5cf6' }, // violet-500
  { key: 'electricity', label: 'Electricity', color: '#f59e0b' }, // amber-500
  { key: 'depreciation', label: 'Depreciation', color: '#64748b' }, // slate-500
  { key: 'nozzleWear', label: 'Nozzle wear', color: '#f43f5e' }, // rose-500
  { key: 'modelCost', label: 'Model cost', color: '#d946ef' }, // fuchsia-500
  { key: 'packaging', label: 'Packaging', color: '#0ea5e9' }, // sky-500
  { key: 'shipping', label: 'Shipping', color: '#06b6d4' }, // cyan-500
];

/** key → color, so callers can reuse a single source of truth for swatches. */
export const COST_ALLOCATION_COLORS: Record<string, string> = Object.fromEntries(
  COMPONENTS.map(c => [c.key, c.color]),
);

/** Treat negative / NaN / non-finite / missing as 0 — never propagate into a pct. */
function clean(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export function buildCostAllocation(input: CostAllocationInput): AllocationSegment[] {
  const present = COMPONENTS.map(c => ({ ...c, value: clean(input[c.key]) })).filter(c => c.value > 0);

  const total = present.reduce((sum, c) => sum + c.value, 0);
  if (total <= 0) return [];

  // Largest-remainder rounding: floor each exact %, then hand the leftover whole
  // points to the largest fractional parts (ties broken by stable component order).
  const rows = present.map(c => {
    const exact = (c.value / total) * 100;
    const pct = Math.floor(exact);
    return { ...c, pct, frac: exact - pct };
  });

  let remainder = 100 - rows.reduce((sum, c) => sum + c.pct, 0);
  const byFrac = [...rows.keys()].sort((a, b) => rows[b].frac - rows[a].frac || a - b);
  for (let i = 0; i < byFrac.length && remainder > 0; i++) {
    rows[byFrac[i]].pct += 1;
    remainder--;
  }

  return rows.map(c => ({ key: c.key, label: c.label, value: c.value, pct: c.pct, color: c.color }));
}
