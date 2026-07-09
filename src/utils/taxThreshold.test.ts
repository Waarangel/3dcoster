import { describe, it, expect } from 'vitest';
import { resolveTaxYearRange, computeTaxThresholdProgress, TAX_YEAR_START, THRESHOLDS } from './taxThreshold';
import type { Sale, Currency } from '../types';
import type { FxRateTable } from './fxConvert';

let n = 0;
function sale(p: Partial<Sale> = {}): Sale {
  return {
    id: `s${++n}`,
    jobId: 'j1',
    quantity: 1,
    unitPrice: 100,
    totalRevenue: 100,
    soldAt: new Date('2026-06-15T12:00:00.000Z'),
    currency: 'GBP',
    ...p,
  } as Sale;
}

// USD-based table: 1 USD buys these many units of each currency.
const FX_TABLE: FxRateTable = {
  base: 'USD',
  date: '2026-07-09',
  rates: { GBP: 0.8, EUR: 0.9, AUD: 1.5, CAD: 1.35 },
};

describe('TAX_YEAR_START / THRESHOLDS', () => {
  it('UK boundary is April 6 and the trading allowance is 1000 GBP with a cited label', () => {
    expect(TAX_YEAR_START.UK).toEqual({ month: 3, day: 6 });
    expect(THRESHOLDS.UK).toEqual({ amount: 1000, currency: 'GBP', label: 'Trading Allowance' });
  });
});

describe('resolveTaxYearRange', () => {
  it('UK: a reference date in March resolves to the PRIOR year\'s April 6 window', () => {
    const range = resolveTaxYearRange('UK', new Date('2026-03-15T00:00:00.000Z'));
    expect(range.start.getFullYear()).toBe(2025);
    expect(range.start.getMonth()).toBe(3); // April (0-indexed)
    expect(range.start.getDate()).toBe(6);
    expect(range.end.getFullYear()).toBe(2026);
    expect(range.end.getMonth()).toBe(3);
    expect(range.end.getDate()).toBe(5);
    expect(range.label).toBe('2025/26');
  });

  it('UK: a reference date on/after April 6 resolves to THIS year\'s window', () => {
    const range = resolveTaxYearRange('UK', new Date('2026-05-01T00:00:00.000Z'));
    expect(range.start).toEqual(new Date(2026, 3, 6, 0, 0, 0, 0));
    expect(range.label).toBe('2026/27');
  });

  it('AU: tax year starts July 1', () => {
    const range = resolveTaxYearRange('AU', new Date('2026-08-15T00:00:00.000Z'));
    expect(range.start).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(range.label).toBe('2026/27');
  });

  it('DE/US/OTHER: tax year starts January 1 with a plain calendar-year label', () => {
    for (const j of ['DE', 'US', 'OTHER'] as const) {
      const range = resolveTaxYearRange(j, new Date('2026-08-15T00:00:00.000Z'));
      expect(range.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
      expect(range.label).toBe('2026');
    }
  });
});

describe('computeTaxThresholdProgress', () => {
  it('US: no bar, badges-of-trade note only', () => {
    const result = computeTaxThresholdProgress([sale()], 'US', 'USD', FX_TABLE);
    expect(result).toEqual({ hasBar: false, note: 'badges-of-trade' });
  });

  it('sums multi-currency in-window sales into userCurrency and compares against the (also-converted) threshold', () => {
    // userCurrency = USD. 1 USD = 0.8 GBP, so 800 GBP revenue == 1000 USD.
    // Threshold: 1000 GBP == 1250 USD (1000 / 0.8).
    const sales = [
      sale({ totalRevenue: 400, currency: 'GBP', soldAt: new Date('2026-05-01T00:00:00.000Z') }), // in UK 2026/27 window
      sale({ totalRevenue: 500, currency: 'EUR', soldAt: new Date('2026-05-02T00:00:00.000Z') }),
    ];
    const result = computeTaxThresholdProgress(sales, 'UK', 'USD', FX_TABLE);
    expect(result.hasBar).toBe(true);
    // 400 GBP -> USD: 400 / 0.8 = 500 USD. 500 EUR -> USD: 500 / 0.9 = 555.555...
    const expectedRevenue = 400 / 0.8 + 500 / 0.9;
    expect(result.revenue).toBeCloseTo(expectedRevenue, 5);
    expect(result.currency).toBe('USD');
    expect(result.threshold).toBeCloseTo(1000 / 0.8, 5);
    expect(result.taxYearLabel).toBe('2026/27');
  });

  it('excludes sales outside the resolved tax-year window', () => {
    const inWindow = sale({ totalRevenue: 100, currency: 'GBP', soldAt: new Date('2026-05-01T00:00:00.000Z') });
    const beforeWindow = sale({ totalRevenue: 999, currency: 'GBP', soldAt: new Date('2026-04-01T00:00:00.000Z') });
    const result = computeTaxThresholdProgress([inWindow, beforeWindow], 'UK', 'GBP', FX_TABLE);
    expect(result.revenue).toBe(100);
  });

  it('skips sales with no resolvable FX rate rather than guessing', () => {
    const noRate = sale({ totalRevenue: 100, currency: 'JPY' as Currency, soldAt: new Date('2026-05-01T00:00:00.000Z') });
    const withRate = sale({ totalRevenue: 50, currency: 'GBP', soldAt: new Date('2026-05-01T00:00:00.000Z') });
    const result = computeTaxThresholdProgress([noRate, withRate], 'UK', 'GBP', FX_TABLE);
    expect(result.revenue).toBe(50);
  });

  it('flags crossed=true once revenue reaches the threshold', () => {
    const bigSale = sale({ totalRevenue: 1200, currency: 'GBP', soldAt: new Date('2026-05-01T00:00:00.000Z') });
    const result = computeTaxThresholdProgress([bigSale], 'UK', 'GBP', FX_TABLE);
    expect(result.crossed).toBe(true);
    expect(result.fraction).toBeGreaterThan(1);
  });

  it('OTHER: uses the custom amount/label (already in userCurrency) with no threshold conversion needed', () => {
    const s = sale({ totalRevenue: 200, currency: 'CAD', soldAt: new Date('2026-05-01T00:00:00.000Z') });
    const result = computeTaxThresholdProgress([s], 'OTHER', 'CAD', FX_TABLE, { amount: 5000, label: 'My province threshold' });
    expect(result.hasBar).toBe(true);
    expect(result.threshold).toBe(5000);
    expect(result.label).toBe('My province threshold');
    expect(result.revenue).toBe(200);
    expect(result.crossed).toBe(false);
  });

  it('OTHER: renders no bar when no valid custom amount is supplied', () => {
    const result = computeTaxThresholdProgress([sale()], 'OTHER', 'CAD', FX_TABLE);
    expect(result.hasBar).toBe(false);
    const negative = computeTaxThresholdProgress([sale()], 'OTHER', 'CAD', FX_TABLE, { amount: -5, label: 'Bad' });
    expect(negative.hasBar).toBe(false);
  });
});
