import { describe, it, expect } from 'vitest';
import { buildCostAllocation, COST_ALLOCATION_COLORS } from './costAllocation';

describe('buildCostAllocation', () => {
  it('computes per-component % that sum to 100 for a simple job', () => {
    const segs = buildCostAllocation({ filament: 6, labor: 3, electricity: 1 });
    const byKey = Object.fromEntries(segs.map(s => [s.key, s.pct]));
    expect(byKey.filament).toBe(60);
    expect(byKey.labor).toBe(30);
    expect(byKey.electricity).toBe(10);
    expect(segs.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });

  it('normalizes rounded pcts to exactly 100 via largest-remainder (three equal thirds)', () => {
    const segs = buildCostAllocation({ filament: 1, labor: 1, electricity: 1 });
    expect(segs.reduce((s, x) => s + x.pct, 0)).toBe(100);
    // 33.33 each → 34/33/33; the leftover point goes to the first (tie broken by order)
    expect(segs.map(s => s.pct).sort((a, b) => b - a)).toEqual([34, 33, 33]);
  });

  it('returns [] at total = 0 (empty form) — never NaN/Infinity (SC1 0-guard)', () => {
    expect(buildCostAllocation({})).toEqual([]);
    expect(buildCostAllocation({ filament: 0, labor: 0 })).toEqual([]);
    const segs = buildCostAllocation({ filament: 0 });
    expect(segs).toEqual([]);
  });

  it('returns a single 100% segment when only one component is non-zero', () => {
    const segs = buildCostAllocation({ filament: 5 });
    expect(segs).toHaveLength(1);
    expect(segs[0].key).toBe('filament');
    expect(segs[0].pct).toBe(100);
  });

  it('omits value<=0 components and treats negative/NaN as 0 (defensive)', () => {
    const segs = buildCostAllocation({ filament: NaN, labor: -2, electricity: 4, materials: 0 });
    expect(segs).toHaveLength(1);
    expect(segs[0].key).toBe('electricity');
    expect(segs[0].pct).toBe(100);
    expect(Number.isFinite(segs[0].pct)).toBe(true);
  });

  it('orders segments stably and carries a color per component', () => {
    const segs = buildCostAllocation({ labor: 2, filament: 8 });
    // stable component order: filament before labor regardless of input order
    expect(segs.map(s => s.key)).toEqual(['filament', 'labor']);
    expect(segs[0].color).toBe(COST_ALLOCATION_COLORS.filament);
    expect(segs[1].color).toBe(COST_ALLOCATION_COLORS.labor);
  });
});
