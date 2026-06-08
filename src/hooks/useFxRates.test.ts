import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isStale } from './useFxRates';
import type { FxRateTable } from '../utils/fxConvert';

const base = { base: 'USD' as const, rates: { USD: 1, CAD: 1.37 } };

// "now" is fixed at 2026-06-08T12:00:00Z for every test below.
describe('isStale', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is fresh when cachedAt is within 24h', () => {
    const t: FxRateTable = { ...base, date: '2026-06-01', cachedAt: Date.parse('2026-06-08T06:00:00Z') }; // 6h ago
    expect(isStale(t)).toBe(false);
  });

  it('is stale when cachedAt is older than 24h', () => {
    const t: FxRateTable = { ...base, date: '2026-06-08', cachedAt: Date.parse('2026-06-06T06:00:00Z') }; // ~54h ago
    expect(isStale(t)).toBe(true);
  });

  it('prefers cachedAt over the provider publish date (the bug this fixes)', () => {
    // Publish date is weeks old, but we fetched it an hour ago → must be fresh.
    const t: FxRateTable = { ...base, date: '2026-05-01', cachedAt: Date.parse('2026-06-08T11:00:00Z') };
    expect(isStale(t)).toBe(false);
  });

  it('falls back to the publish date for legacy tables with no cachedAt', () => {
    const today: FxRateTable = { ...base, date: '2026-06-08' };   // 12h ago → fresh
    const week: FxRateTable = { ...base, date: '2026-06-01' };    // 7d ago → stale
    expect(isStale(today)).toBe(false);
    expect(isStale(week)).toBe(true);
  });

  it('treats an unparseable date with no cachedAt as stale', () => {
    const t: FxRateTable = { ...base, date: 'not-a-date' };
    expect(isStale(t)).toBe(true);
  });
});
