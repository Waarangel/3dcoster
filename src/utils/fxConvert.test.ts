import { describe, it, expect } from 'vitest';
import { convert, canConvert, type FxRateTable } from './fxConvert';

// A USD-based rate table: rates[X] = units of X per 1 USD. USD is implicitly 1.
const TABLE: FxRateTable = {
  base: 'USD',
  rates: { USD: 1, CAD: 1.37, EUR: 0.92, GBP: 0.79, JPY: 150 },
  date: '2026-06-07',
};

describe('convert', () => {
  it('returns the amount unchanged when from and to are the same currency', () => {
    expect(convert(12.5, 'CAD', 'CAD', TABLE)).toBe(12.5);
  });

  it('returns the amount unchanged for same currency even without a table', () => {
    // Identity must never depend on rate data — it is always knowable.
    expect(convert(9.99, 'EUR', 'EUR', null)).toBe(9.99);
  });

  it('converts USD to a target using the target rate directly', () => {
    // 1 USD → 1.37 CAD
    expect(convert(10, 'USD', 'CAD', TABLE)).toBeCloseTo(13.7, 10);
  });

  it('converts a non-USD currency back to USD via the inverse rate', () => {
    // 13.7 CAD → 10 USD
    expect(convert(13.7, 'CAD', 'USD', TABLE)).toBeCloseTo(10, 10);
  });

  it('converts between two non-USD currencies through the USD base', () => {
    // CAD → EUR: amount * rates.EUR / rates.CAD
    expect(convert(13.7, 'CAD', 'EUR', TABLE)).toBeCloseTo(13.7 * (0.92 / 1.37), 10);
  });

  it('preserves zero amounts', () => {
    expect(convert(0, 'USD', 'CAD', TABLE)).toBe(0);
  });

  it('returns null when the source currency is missing from the table', () => {
    expect(convert(10, 'ZAR', 'CAD', TABLE)).toBeNull();
  });

  it('returns null when the target currency is missing from the table', () => {
    expect(convert(10, 'CAD', 'ZAR', TABLE)).toBeNull();
  });

  it('returns null when the table is null and currencies differ (no guessing)', () => {
    expect(convert(10, 'USD', 'CAD', null)).toBeNull();
  });

  it('returns null for a non-finite amount rather than propagating NaN', () => {
    expect(convert(Number.NaN, 'USD', 'CAD', TABLE)).toBeNull();
  });

  it('returns null when a rate is zero or negative (corrupt data)', () => {
    const bad: FxRateTable = { base: 'USD', rates: { USD: 1, CAD: 0 }, date: '2026-06-07' };
    expect(convert(10, 'USD', 'CAD', bad)).toBeNull();
    expect(convert(10, 'CAD', 'USD', bad)).toBeNull();
  });
});

describe('canConvert', () => {
  it('is true for identical currencies regardless of table', () => {
    expect(canConvert('CAD', 'CAD', null)).toBe(true);
  });

  it('is true when both currencies are present in the table', () => {
    expect(canConvert('CAD', 'EUR', TABLE)).toBe(true);
  });

  it('is false when either currency is missing', () => {
    expect(canConvert('CAD', 'ZAR', TABLE)).toBe(false);
    expect(canConvert('USD', 'CAD', null)).toBe(false);
  });
});
