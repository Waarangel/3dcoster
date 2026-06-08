import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchUsdRateTable } from './fxRates';

// Helpers to fake the fetch() Response shape fetchJson() consumes.
function okJson(data: unknown) {
  return { ok: true, json: async () => data };
}
const notOk = { ok: false, json: async () => ({}) };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchUsdRateTable', () => {
  it('builds a table from the fawazahmed provider (lowercase keys) and forces USD=1', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      okJson({ date: '2026-06-07', usd: { cad: 1.37, eur: 0.92, zar: 18.1 } }),
    ));

    const table = await fetchUsdRateTable();
    expect(table).not.toBeNull();
    expect(table?.base).toBe('USD');
    expect(table?.date).toBe('2026-06-07');
    expect(table?.rates.USD).toBe(1);
    expect(table?.rates.CAD).toBe(1.37);
    expect(table?.rates.EUR).toBe(0.92);
    expect(table?.rates.ZAR).toBe(18.1);
  });

  it('falls back to frankfurter (uppercase keys) when fawazahmed providers fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('frankfurter')) {
        return okJson({ date: '2026-06-06', rates: { CAD: 1.38, EUR: 0.9 } });
      }
      return notOk; // both fawazahmed URLs
    }));

    const table = await fetchUsdRateTable();
    expect(table?.date).toBe('2026-06-06');
    expect(table?.rates.CAD).toBe(1.38);
    expect(table?.rates.USD).toBe(1);
  });

  it('omits non-finite or non-positive rates rather than storing garbage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      okJson({ date: '2026-06-07', usd: { cad: 1.37, eur: 'oops', gbp: 0, jpy: -5 } }),
    ));

    const table = await fetchUsdRateTable();
    expect(table?.rates.CAD).toBe(1.37);
    expect(table?.rates.EUR).toBeUndefined();
    expect(table?.rates.GBP).toBeUndefined();
    expect(table?.rates.JPY).toBeUndefined();
  });

  it('returns null when every provider fails (never invents rates)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => notOk));
    expect(await fetchUsdRateTable()).toBeNull();
  });

  it('returns null when a provider responds but carries no usable rates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ date: '2026-06-07', usd: {} })));
    expect(await fetchUsdRateTable()).toBeNull();
  });
});
