import { describe, it, expect } from 'vitest';
import { computePrintHourProfit, PRINT_HOUR_SWEET_SPOT } from './printHourProfit';

describe('computePrintHourProfit', () => {
  it('returns na (value null) when printTimeHours <= 0', () => {
    expect(computePrintHourProfit({ sellingPrice: 20, cost: 5, printTimeHours: 0 }))
      .toEqual({ value: null, tone: 'na' });
  });

  it('returns na when printTimeHours is non-finite', () => {
    expect(computePrintHourProfit({ sellingPrice: 20, cost: 5, printTimeHours: NaN }).tone).toBe('na');
  });

  it('grades a loss (value < 0) as bad', () => {
    const r = computePrintHourProfit({ sellingPrice: 2, cost: 10, printTimeHours: 2 }); // -4/hr
    expect(r.value).toBe(-4);
    expect(r.tone).toBe('bad');
  });

  it('grades below the $1 floor as thin (warn)', () => {
    const r = computePrintHourProfit({ sellingPrice: 3, cost: 2, printTimeHours: 2 }); // 0.5/hr
    expect(r.value).toBe(0.5);
    expect(r.tone).toBe('warn');
  });

  it('grades the $1–5 sweet spot as good', () => {
    const r = computePrintHourProfit({ sellingPrice: 10, cost: 4, printTimeHours: 2 }); // 3/hr
    expect(r.value).toBe(3);
    expect(r.tone).toBe('good');
  });

  it('grades above the sweet spot as good (higher is better)', () => {
    const r = computePrintHourProfit({ sellingPrice: 20, cost: 4, printTimeHours: 2 }); // 8/hr
    expect(r.tone).toBe('good');
  });

  it('treats the $1 floor as inclusive (good at exactly the min)', () => {
    const r = computePrintHourProfit({ sellingPrice: 6, cost: 4, printTimeHours: 2 }); // 1/hr
    expect(r.value).toBe(PRINT_HOUR_SWEET_SPOT.min);
    expect(r.tone).toBe('good');
  });

  it('treats non-finite cost/price defensively (never a NaN value)', () => {
    const r = computePrintHourProfit({ sellingPrice: 12, cost: NaN, printTimeHours: 2 });
    expect(r.value).toBe(6);
    expect(Number.isFinite(r.value as number)).toBe(true);
    expect(r.tone).toBe('good');
  });
});
