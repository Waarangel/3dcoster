import { describe, it, expect } from 'vitest';
import { priceFromMargin, priceFromProfit, marginFromPrice } from './pricingInterlink';

// Default Etsy fee shape: pct = (6.5 + 3)/100 = 0.095, fixed = 0.45 (USD).
const ETSY = { pctFees: 0.095, fixedFees: 0.45 };
const NO_FEE = { pctFees: 0, fixedFees: 0 };

describe('pricingInterlink — no-marketplace path is byte-identical to the prior gross math', () => {
  // These assertions replicate the EXACT prior inline formulas to prove the
  // refactor introduces zero behavioral change when no platform is selected.
  it('priceFromMargin reduces to trueCost / (1 - m/100)', () => {
    const trueCost = 12.5;
    for (const m of [0, 10, 33.3, 50, 99.9, 150 /* clamps to 99.9 */]) {
      const { price, netProfit } = priceFromMargin(trueCost, m, NO_FEE);
      const clamped = Math.min(m, 99.9);
      const expectedPrice = trueCost / (1 - clamped / 100);
      expect(price).toBeCloseTo(expectedPrice, 10);
      expect(netProfit).toBeCloseTo(expectedPrice - trueCost, 10);
    }
  });

  it('priceFromProfit reduces to trueCost + profit', () => {
    const trueCost = 8.2;
    for (const p of [0, 5, 12.34, 100]) {
      const { price, marginPercent } = priceFromProfit(trueCost, p, NO_FEE);
      const expectedPrice = trueCost + p;
      expect(price).toBeCloseTo(expectedPrice, 10);
      const expectedMargin = expectedPrice > 0 ? ((expectedPrice - trueCost) / expectedPrice) * 100 : 0;
      expect(marginPercent).toBeCloseTo(expectedMargin, 10);
    }
  });

  it('marginFromPrice reduces to (price - trueCost) and its margin', () => {
    const trueCost = 9.99;
    for (const P of [0, 9.99, 15, 40]) {
      const { netProfit, marginPercent } = marginFromPrice(trueCost, P, NO_FEE);
      expect(netProfit).toBeCloseTo(P - trueCost, 10);
      const expectedMargin = P > 0 ? ((P - trueCost) / P) * 100 : 0;
      expect(marginPercent).toBeCloseTo(expectedMargin, 10);
    }
  });

  it('marginFromPrice on a zero price yields zero margin (no NaN)', () => {
    const r = marginFromPrice(10, 0, NO_FEE);
    expect(r.marginPercent).toBe(0);
    expect(Number.isFinite(r.netProfit)).toBe(true);
  });
});

describe('pricingInterlink — net-of-fee derivations (Etsy)', () => {
  it('priceFromMargin: a 40% NET margin price actually nets 40% after fees', () => {
    const trueCost = 10;
    const { price, netProfit } = priceFromMargin(trueCost, 40, ETSY);
    // Closed form: price = (10 + 0.45) / (1 - 0.095 - 0.40) = 10.45 / 0.505
    expect(price).toBeCloseTo(10.45 / 0.505, 8);
    // Verify the realized net margin == 40%.
    const realizedFee = ETSY.fixedFees + price * ETSY.pctFees;
    const realizedNet = price - trueCost - realizedFee;
    expect((realizedNet / price) * 100).toBeCloseTo(40, 6);
    expect(netProfit).toBeCloseTo(realizedNet, 8);
  });

  it('priceFromProfit: a $15 NET profit target nets exactly $15 after fees', () => {
    const trueCost = 10;
    const { price, marginPercent } = priceFromProfit(trueCost, 15, ETSY);
    // price = (10 + 0.45 + 15) / (1 - 0.095) = 25.45 / 0.905
    expect(price).toBeCloseTo(25.45 / 0.905, 8);
    const realizedFee = ETSY.fixedFees + price * ETSY.pctFees;
    const realizedNet = price - trueCost - realizedFee;
    expect(realizedNet).toBeCloseTo(15, 6);
    expect(marginPercent).toBeCloseTo((realizedNet / price) * 100, 6);
  });

  it('marginFromPrice: a user-entered price reports net profit/margin after fees', () => {
    const trueCost = 10;
    const price = 30;
    const { netProfit, marginPercent } = marginFromPrice(trueCost, price, ETSY);
    // fee = 0.45 + 30 * 0.095 = 0.45 + 2.85 = 3.30
    expect(netProfit).toBeCloseTo(30 - 10 - 3.3, 8); // 16.70
    expect(marginPercent).toBeCloseTo((16.7 / 30) * 100, 8);
  });

  it('round-trips: margin → price → margin is stable under fees', () => {
    const trueCost = 14.3;
    const { price } = priceFromMargin(trueCost, 35, ETSY);
    const { marginPercent } = marginFromPrice(trueCost, price, ETSY);
    expect(marginPercent).toBeCloseTo(35, 6);
  });

  it('round-trips: profit → price → profit is stable under fees', () => {
    const trueCost = 7.0;
    const { price } = priceFromProfit(trueCost, 22, ETSY);
    const { netProfit } = marginFromPrice(trueCost, price, ETSY);
    expect(netProfit).toBeCloseTo(22, 6);
  });

  it('guards a pathological denominator (high pct + high margin) against a sign flip', () => {
    // pct 0.25 + margin 0.90 → denom would be -0.15; clamp keeps price positive/finite.
    const { price } = priceFromMargin(10, 90, { pctFees: 0.25, fixedFees: 0.5 });
    expect(Number.isFinite(price)).toBe(true);
    expect(price).toBeGreaterThan(0);
  });
});
