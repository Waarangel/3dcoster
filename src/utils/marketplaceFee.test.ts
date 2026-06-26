import { describe, it, expect } from 'vitest';
import { computeMarketplaceFee } from './marketplaceFee';
import { defaultMarketplaceFees } from '../hooks/useDatabase';
import type { FxRateTable } from './fxConvert';

// 1 USD = 150 JPY, 1 USD = 1.37 CAD. Fixed-dollar fees are stored in USD and
// must convert through this table; percentage fees are currency-agnostic.
const fx: FxRateTable = {
  base: 'USD',
  rates: { USD: 1, JPY: 150, CAD: 1.37, EUR: 0.92 },
  date: '2026-06-26',
};

const fees = defaultMarketplaceFees;

describe('computeMarketplaceFee — fixed fees convert through FX, percentages do not', () => {
  it('USD Etsy sale is unchanged (fixed fees already in USD)', () => {
    // $20 sale: 20*0.065 + 20*0.03 + 0.25 + 0.20 = 1.30 + 0.60 + 0.45 = 2.35
    const r = computeMarketplaceFee({ sellingPrice: 20, marketplace: 'etsy', fees, userCurrency: 'USD', fxTable: fx });
    expect(r.pctFees).toBeCloseTo(0.095, 10);
    expect(r.fixedFees).toBeCloseTo(0.45, 10);
    expect(r.total).toBeCloseTo(2.35, 10);
  });

  it('JPY Etsy sale scales the fixed fee by the FX rate (~150x), not the raw USD number', () => {
    // ¥3000 sale, 1 USD = 150 JPY → fixed 0.45 USD = ¥67.5
    // pct portion: 3000 * 0.095 = 285 → total 352.5
    const r = computeMarketplaceFee({ sellingPrice: 3000, marketplace: 'etsy', fees, userCurrency: 'JPY', fxTable: fx });
    expect(r.pctFees).toBeCloseTo(0.095, 10);
    expect(r.fixedFees).toBeCloseTo(67.5, 6); // NOT 0.45
    expect(r.total).toBeCloseTo(352.5, 6);
    // Regression guard: the un-converted (buggy) value would be 285 + 0.45 = 285.45.
    expect(r.total).not.toBeCloseTo(285.45, 2);
  });

  it('CAD Etsy offsite-ad sale converts both fixed fees and adds the ad percentage', () => {
    // 1 USD = 1.37 CAD → fixed (0.25 + 0.20) USD = 0.45 USD = 0.6165 CAD
    // pct: (6.5 + 3 + 15)/100 = 0.245
    const r = computeMarketplaceFee({ sellingPrice: 100, marketplace: 'etsy_offsite_ad', fees, userCurrency: 'CAD', fxTable: fx });
    expect(r.pctFees).toBeCloseTo(0.245, 10);
    expect(r.fixedFees).toBeCloseTo(0.6165, 6);
    expect(r.total).toBeCloseTo(100 * 0.245 + 0.6165, 6);
  });

  it('falls back to the raw USD fixed fee when no FX rate is available', () => {
    const r = computeMarketplaceFee({ sellingPrice: 20, marketplace: 'etsy', fees, userCurrency: 'JPY', fxTable: null });
    // No table → fixed fees fall back to raw USD (0.45), percentages unaffected.
    expect(r.fixedFees).toBeCloseTo(0.45, 10);
    expect(r.total).toBeCloseTo(20 * 0.095 + 0.45, 10);
  });

  it('returns zero for no-fee platforms regardless of price', () => {
    for (const mk of ['none', 'facebook_local', 'kijiji'] as const) {
      const r = computeMarketplaceFee({ sellingPrice: 999, marketplace: mk, fees, userCurrency: 'JPY', fxTable: fx });
      expect(r).toEqual({ pctFees: 0, fixedFees: 0, total: 0 });
    }
  });

  it('returns zero total for non-positive selling prices but keeps the pct rate', () => {
    const r = computeMarketplaceFee({ sellingPrice: 0, marketplace: 'etsy', fees, userCurrency: 'USD', fxTable: fx });
    expect(r.total).toBe(0);
    expect(r.pctFees).toBeCloseTo(0.095, 10);
  });

  describe('facebook_shipped floor handling', () => {
    it('uses the percentage path on a normal-priced sale (floor inactive)', () => {
      // $50 sale: selling fee = max(0.80, 5.00) = 5.00 (floor inactive)
      //           processing = 50 * 0.029 = 1.45 → total 6.45
      const r = computeMarketplaceFee({ sellingPrice: 50, marketplace: 'facebook_shipped', fees, userCurrency: 'USD', fxTable: fx });
      expect(r.total).toBeCloseTo(6.45, 10);
      expect(r.pctFees).toBeCloseTo(0.129, 10);
      expect(r.fixedFees).toBe(0);
    });

    it('converts and applies the min-fee floor on a tiny sale', () => {
      // ¥150 sale (1 USD), floor 0.80 USD = ¥120. selling % = 150*0.10 = 15 < 120 → floor binds.
      // processing = 150 * 0.029 = 4.35 → total = 120 + 4.35 = 124.35
      const r = computeMarketplaceFee({ sellingPrice: 150, marketplace: 'facebook_shipped', fees, userCurrency: 'JPY', fxTable: fx });
      expect(r.fixedFees).toBeCloseTo(120, 6);
      expect(r.total).toBeCloseTo(124.35, 6);
    });
  });
});
