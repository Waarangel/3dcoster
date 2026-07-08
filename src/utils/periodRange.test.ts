import { describe, it, expect } from 'vitest';
import { resolveDateRange, type PeriodParts } from './periodRange';

// Base parts with sane defaults; each test overrides only what it needs.
function parts(overrides: Partial<PeriodParts> = {}): PeriodParts {
  return {
    year: 2026,
    month: 5, // June (0-based)
    quarter: 0,
    customStart: '2026-06-01',
    customEnd: '2026-06-30',
    ...overrides,
  };
}

describe('resolveDateRange', () => {
  it('month: resolves start/end/label for a mid-year month', () => {
    const range = resolveDateRange('month', parts({ year: 2026, month: 5 }));
    expect(range.start).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
    expect(range.label).toBe('June 2026');
  });

  it('month: handles December boundary (no rollover into next year)', () => {
    const range = resolveDateRange('month', parts({ year: 2026, month: 11 }));
    expect(range.start).toEqual(new Date(2026, 11, 1, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
    expect(range.label).toBe('December 2026');
  });

  it('quarter: resolves Q2 2026 (Apr 1 - Jun 30) from 0-based quarter index 1', () => {
    const range = resolveDateRange('quarter', parts({ year: 2026, quarter: 1 }));
    expect(range.start).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
    expect(range.label).toBe('Q2 2026');
  });

  it('quarter: handles Q4 boundary (Oct 1 - Dec 31, no rollover into next year)', () => {
    const range = resolveDateRange('quarter', parts({ year: 2026, quarter: 3 }));
    expect(range.start).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
    expect(range.label).toBe('Q4 2026');
  });

  it('year: resolves Jan 1 - Dec 31', () => {
    const range = resolveDateRange('year', parts({ year: 2026 }));
    expect(range.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
    expect(range.label).toBe('2026');
  });

  it('ytd: resolves Jan 1 of the current year through end of today', () => {
    const range = resolveDateRange('ytd', parts());
    const now = new Date();
    expect(range.start).toEqual(new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0));
    expect(range.end.getFullYear()).toBe(now.getFullYear());
    expect(range.end.getMonth()).toBe(now.getMonth());
    expect(range.end.getDate()).toBe(now.getDate());
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMinutes()).toBe(59);
    expect(range.end.getSeconds()).toBe(59);
    expect(range.end.getMilliseconds()).toBe(999);
    expect(range.label).toBe(`${now.getFullYear()} YTD`);
  });

  it('custom: resolves an inclusive custom date range with a locale-formatted label', () => {
    const range = resolveDateRange(
      'custom',
      parts({ customStart: '2026-04-15', customEnd: '2026-06-18' }),
    );
    const expectedStart = new Date('2026-04-15T00:00:00');
    const expectedEnd = new Date('2026-06-18T23:59:59.999');
    expect(range.start).toEqual(expectedStart);
    expect(range.end).toEqual(expectedEnd);
    expect(range.label).toBe(`${expectedStart.toLocaleDateString()} – ${expectedEnd.toLocaleDateString()}`);
  });
});
