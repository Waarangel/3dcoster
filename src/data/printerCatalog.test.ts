import { describe, it, expect } from 'vitest';
import { defaultPrinterAssets } from './defaultMaterials';

// ---------------------------------------------------------------------------
// Default printer catalog integrity. Codifies the rules from the 2026-06-15
// sourced spec audit so the PSU-rating bug (peak wattage mistaken for average
// draw) cannot silently return.
// ---------------------------------------------------------------------------

describe('default printer catalog', () => {
  it('has a healthy number of models', () => {
    expect(defaultPrinterAssets.length).toBeGreaterThanOrEqual(24);
  });

  it('has unique ids', () => {
    const ids = defaultPrinterAssets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every model has all required specs populated and positive', () => {
    for (const p of defaultPrinterAssets) {
      expect(p.category).toBe('printer');
      expect(p.name.trim()).not.toBe('');
      expect(p.purchasePrice).toBeGreaterThan(0);
      expect(p.expectedLifespanHours).toBeGreaterThan(0);
      expect(p.wattage).toBeGreaterThan(0);
      expect(p.nozzleCost).toBeGreaterThan(0);
      expect(p.nozzleLifespanCm3).toBeGreaterThan(0);
    }
  });

  it('no wattage exceeds 250W — a higher value is almost certainly a mis-entered PSU/peak rating, not average printing draw', () => {
    const offenders = defaultPrinterAssets
      .filter((p) => (p.wattage ?? 0) > 250)
      .map((p) => `${p.name} (${p.wattage}W)`);
    expect(offenders).toEqual([]);
  });

  it('keeps the audited wattage corrections (regression guard for the 4 PSU-rating errors)', () => {
    const byId = Object.fromEntries(defaultPrinterAssets.map((p) => [p.id, p]));
    expect(byId['creality-ender3-v3'].wattage).toBe(120);
    expect(byId['creality-k1'].wattage).toBe(150);
    expect(byId['anycubic-kobra3'].wattage).toBe(160);
    expect(byId['elegoo-neptune4-pro'].wattage).toBe(140);
  });
});
