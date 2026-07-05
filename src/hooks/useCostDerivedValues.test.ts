import { describe, it, expect } from 'vitest';
import { createPricingReducer, type PricingState } from './useCostDerivedValues';
import { priceFromMargin, priceFromProfit, marginFromPrice, type FeeShape } from '../utils/pricingInterlink';

// ---------------------------------------------------------------------------
// Unit tests for pricingReducer — the useReducer state machine that replaces
// the pre-split two-useEffect + feeShapeRef architecture (Plan 03 Task 2,
// FOUND-02). Tested directly (no component mount needed): createPricingReducer
// returns a plain, pure reducer function closed over trueCost/fee.
// ---------------------------------------------------------------------------

const NO_FEE: FeeShape = { pctFees: 0, fixedFees: 0 };
const ETSY_FEE: FeeShape = { pctFees: 0.095, fixedFees: 0.45 };

function makeState(overrides: Partial<PricingState> = {}): PricingState {
  return {
    sellingPrice: 0,
    targetProfit: 0,
    profitMarginPercent: 30,
    lastEdited: 'margin',
    ...overrides,
  };
}

describe('pricingReducer', () => {
  describe('EDIT_MARGIN', () => {
    it('derives sellingPrice + targetProfit from a target margin (no fee)', () => {
      const trueCost = 10;
      const reducer = createPricingReducer(trueCost, NO_FEE);
      const state = makeState();
      const next = reducer(state, { type: 'EDIT_MARGIN', value: 25 });

      const expected = priceFromMargin(trueCost, 25, NO_FEE);
      expect(next.sellingPrice).toBeCloseTo(parseFloat(expected.price.toFixed(2)), 5);
      expect(next.targetProfit).toBeCloseTo(parseFloat(expected.netProfit.toFixed(2)), 5);
      expect(next.profitMarginPercent).toBe(25);
      expect(next.lastEdited).toBe('margin');
    });

    it('derives sellingPrice + targetProfit from a target margin (Etsy fee)', () => {
      const trueCost = 10;
      const reducer = createPricingReducer(trueCost, ETSY_FEE);
      const next = reducer(makeState(), { type: 'EDIT_MARGIN', value: 25 });

      const expected = priceFromMargin(trueCost, 25, ETSY_FEE);
      expect(next.sellingPrice).toBeCloseTo(parseFloat(expected.price.toFixed(2)), 5);
      expect(next.targetProfit).toBeCloseTo(parseFloat(expected.netProfit.toFixed(2)), 5);
      expect(next.lastEdited).toBe('margin');
    });
  });

  describe('EDIT_PROFIT', () => {
    it('derives sellingPrice + profitMarginPercent from a target net profit (no fee)', () => {
      const trueCost = 10;
      const reducer = createPricingReducer(trueCost, NO_FEE);
      const next = reducer(makeState(), { type: 'EDIT_PROFIT', value: 5 });

      const expected = priceFromProfit(trueCost, 5, NO_FEE);
      expect(next.sellingPrice).toBeCloseTo(parseFloat(expected.price.toFixed(2)), 5);
      expect(next.targetProfit).toBe(5);
      expect(next.profitMarginPercent).toBeCloseTo(parseFloat(expected.marginPercent.toFixed(1)), 5);
      expect(next.lastEdited).toBe('profit');
    });

    it('derives sellingPrice + profitMarginPercent from a target net profit (Etsy fee)', () => {
      const trueCost = 10;
      const reducer = createPricingReducer(trueCost, ETSY_FEE);
      const next = reducer(makeState(), { type: 'EDIT_PROFIT', value: 5 });

      const expected = priceFromProfit(trueCost, 5, ETSY_FEE);
      expect(next.sellingPrice).toBeCloseTo(parseFloat(expected.price.toFixed(2)), 5);
      expect(next.lastEdited).toBe('profit');
    });
  });

  describe('EDIT_PRICE', () => {
    it('derives targetProfit + profitMarginPercent from a user-entered price (no fee)', () => {
      const trueCost = 10;
      const reducer = createPricingReducer(trueCost, NO_FEE);
      const next = reducer(makeState(), { type: 'EDIT_PRICE', value: 20 });

      const expected = marginFromPrice(trueCost, 20, NO_FEE);
      expect(next.sellingPrice).toBe(20);
      expect(next.targetProfit).toBeCloseTo(parseFloat(expected.netProfit.toFixed(2)), 5);
      expect(next.profitMarginPercent).toBeCloseTo(parseFloat(expected.marginPercent.toFixed(1)), 5);
      expect(next.lastEdited).toBe('price');
    });

    it('derives targetProfit + profitMarginPercent from a user-entered price (Etsy fee)', () => {
      const trueCost = 10;
      const reducer = createPricingReducer(trueCost, ETSY_FEE);
      const next = reducer(makeState(), { type: 'EDIT_PRICE', value: 20 });

      const expected = marginFromPrice(trueCost, 20, ETSY_FEE);
      expect(next.targetProfit).toBeCloseTo(parseFloat(expected.netProfit.toFixed(2)), 5);
      expect(next.lastEdited).toBe('price');
    });
  });

  describe('RECALC', () => {
    it('re-derives off the CURRENT lastEdited=margin branch, never flips lastEdited', () => {
      const trueCost = 12;
      const reducer = createPricingReducer(trueCost, NO_FEE);
      const state = makeState({ lastEdited: 'margin', profitMarginPercent: 40 });
      const next = reducer(state, { type: 'RECALC' });

      const expected = priceFromMargin(trueCost, 40, NO_FEE);
      expect(next.sellingPrice).toBeCloseTo(parseFloat(expected.price.toFixed(2)), 5);
      expect(next.targetProfit).toBeCloseTo(parseFloat(expected.netProfit.toFixed(2)), 5);
      expect(next.profitMarginPercent).toBe(40); // unchanged — margin is the input, not the output
      expect(next.lastEdited).toBe('margin');
    });

    it('re-derives off the CURRENT lastEdited=profit branch, never flips lastEdited', () => {
      const trueCost = 12;
      const reducer = createPricingReducer(trueCost, NO_FEE);
      const state = makeState({ lastEdited: 'profit', targetProfit: 8 });
      const next = reducer(state, { type: 'RECALC' });

      const expected = priceFromProfit(trueCost, 8, NO_FEE);
      expect(next.sellingPrice).toBeCloseTo(parseFloat(expected.price.toFixed(2)), 5);
      expect(next.targetProfit).toBe(8); // unchanged — profit is the input, not the output
      expect(next.profitMarginPercent).toBeCloseTo(parseFloat(expected.marginPercent.toFixed(1)), 5);
      expect(next.lastEdited).toBe('profit');
    });

    it('re-derives off the CURRENT lastEdited=price branch, never flips lastEdited', () => {
      const trueCost = 12;
      const reducer = createPricingReducer(trueCost, NO_FEE);
      const state = makeState({ lastEdited: 'price', sellingPrice: 30 });
      const next = reducer(state, { type: 'RECALC' });

      const expected = marginFromPrice(trueCost, 30, NO_FEE);
      expect(next.sellingPrice).toBe(30); // unchanged — price is the input, not the output
      expect(next.targetProfit).toBeCloseTo(parseFloat(expected.netProfit.toFixed(2)), 5);
      expect(next.profitMarginPercent).toBeCloseTo(parseFloat(expected.marginPercent.toFixed(1)), 5);
      expect(next.lastEdited).toBe('price');
    });

    it('re-fires the SAME branch when the fee shape changes (marketplace-platform sync)', () => {
      const trueCost = 12;
      const state = makeState({ lastEdited: 'margin', profitMarginPercent: 30 });

      const noFeeReducer = createPricingReducer(trueCost, NO_FEE);
      const withFeeState = noFeeReducer(state, { type: 'RECALC' });

      const etsyReducer = createPricingReducer(trueCost, ETSY_FEE);
      const withEtsyFee = etsyReducer(withFeeState, { type: 'RECALC' });

      const expected = priceFromMargin(trueCost, 30, ETSY_FEE);
      expect(withEtsyFee.sellingPrice).toBeCloseTo(parseFloat(expected.price.toFixed(2)), 5);
      expect(withEtsyFee.lastEdited).toBe('margin');
      // Fee shape change should produce a DIFFERENT price than the no-fee derivation.
      expect(withEtsyFee.sellingPrice).not.toBe(withFeeState.sellingPrice);
    });
  });

  describe('trueCost<=0 guard', () => {
    // CR-01: the pre-split contract stores EDIT_* input unconditionally and
    // only skips the DERIVATION while trueCost <= 0 — a user can type a target
    // price/margin/profit before entering any cost basis and the value must be
    // kept (and persisted), not silently dropped.
    it('stores the edited margin + lastEdited WITHOUT deriving when trueCost is 0', () => {
      const reducer = createPricingReducer(0, NO_FEE);
      const state = makeState({ sellingPrice: 5, targetProfit: 1, profitMarginPercent: 20, lastEdited: 'price' });
      const next = reducer(state, { type: 'EDIT_MARGIN', value: 50 });
      expect(next.profitMarginPercent).toBe(50);
      expect(next.lastEdited).toBe('margin');
      // Derivation skipped — the other two fields are untouched.
      expect(next.sellingPrice).toBe(5);
      expect(next.targetProfit).toBe(1);
    });

    it('stores the edited profit + lastEdited WITHOUT deriving when trueCost is 0', () => {
      const reducer = createPricingReducer(0, NO_FEE);
      const state = makeState({ sellingPrice: 5, targetProfit: 1, profitMarginPercent: 20 });
      const next = reducer(state, { type: 'EDIT_PROFIT', value: 7 });
      expect(next.targetProfit).toBe(7);
      expect(next.lastEdited).toBe('profit');
      expect(next.sellingPrice).toBe(5);
      expect(next.profitMarginPercent).toBe(20);
    });

    it('stores the edited price + lastEdited WITHOUT deriving when trueCost is 0', () => {
      const reducer = createPricingReducer(0, NO_FEE);
      const state = makeState({ sellingPrice: 5, targetProfit: 1, profitMarginPercent: 20 });
      const next = reducer(state, { type: 'EDIT_PRICE', value: 25 });
      expect(next.sellingPrice).toBe(25);
      expect(next.lastEdited).toBe('price');
      expect(next.targetProfit).toBe(1);
      expect(next.profitMarginPercent).toBe(20);
    });

    it('returns state unchanged for RECALC when trueCost is negative', () => {
      const reducer = createPricingReducer(-5, NO_FEE);
      const state = makeState({ lastEdited: 'price', sellingPrice: 10 });
      const next = reducer(state, { type: 'RECALC' });
      expect(next).toEqual(state);
    });

    it('SEED_FROM_JOB and RESET bypass the trueCost<=0 guard (mount-time seeding must work even before trueCost is known)', () => {
      const reducer = createPricingReducer(0, NO_FEE);
      const seeded = reducer(makeState(), { type: 'SEED_FROM_JOB', sellingPrice: 20, targetProfit: 8, profitMarginPercent: 40 });
      expect(seeded.sellingPrice).toBe(20);
      expect(seeded.lastEdited).toBe('price');

      const reset = reducer(seeded, { type: 'RESET', profitMarginPercent: 15 });
      expect(reset).toEqual({ sellingPrice: 0, targetProfit: 0, profitMarginPercent: 15, lastEdited: 'margin' });
    });
  });

  describe('no-fee invariant (Pitfall 5)', () => {
    it('EDIT_MARGIN with {pctFees:0, fixedFees:0} equals the pre-fee gross math exactly', () => {
      const trueCost = 15;
      const reducer = createPricingReducer(trueCost, { pctFees: 0, fixedFees: 0 });
      const next = reducer(makeState(), { type: 'EDIT_MARGIN', value: 33 });

      // Pre-fee gross math: price = trueCost / (1 - m/100)
      const grossPrice = trueCost / (1 - 33 / 100);
      const grossProfit = grossPrice - trueCost;
      expect(next.sellingPrice).toBeCloseTo(parseFloat(grossPrice.toFixed(2)), 5);
      expect(next.targetProfit).toBeCloseTo(parseFloat(grossProfit.toFixed(2)), 5);
    });

    it('EDIT_PROFIT with {pctFees:0, fixedFees:0} equals the pre-fee gross math exactly', () => {
      const trueCost = 15;
      const reducer = createPricingReducer(trueCost, { pctFees: 0, fixedFees: 0 });
      const next = reducer(makeState(), { type: 'EDIT_PROFIT', value: 6 });

      // Pre-fee gross math: price = trueCost + profit
      const grossPrice = trueCost + 6;
      const grossMargin = (6 / grossPrice) * 100;
      expect(next.sellingPrice).toBeCloseTo(parseFloat(grossPrice.toFixed(2)), 5);
      expect(next.profitMarginPercent).toBeCloseTo(parseFloat(grossMargin.toFixed(1)), 5);
    });

    it('EDIT_PRICE with {pctFees:0, fixedFees:0} equals the pre-fee gross math exactly', () => {
      const trueCost = 15;
      const reducer = createPricingReducer(trueCost, { pctFees: 0, fixedFees: 0 });
      const next = reducer(makeState(), { type: 'EDIT_PRICE', value: 25 });

      // Pre-fee gross math: profit = price - trueCost; margin = profit/price
      const grossProfit = 25 - trueCost;
      const grossMargin = (grossProfit / 25) * 100;
      expect(next.targetProfit).toBeCloseTo(parseFloat(grossProfit.toFixed(2)), 5);
      expect(next.profitMarginPercent).toBeCloseTo(parseFloat(grossMargin.toFixed(1)), 5);
    });
  });
});
