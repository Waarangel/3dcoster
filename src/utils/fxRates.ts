import type { Currency } from '../types';
import { CURRENCY_CONFIG } from './currency';
import type { FxRateTable } from './fxConvert';

// Every currency the app supports — used to extract a full table from a
// provider's USD cross-rates. Derived from the single source of truth so a new
// currency in CURRENCY_CONFIG is picked up automatically.
const ALL_CURRENCIES = Object.keys(CURRENCY_CONFIG) as Currency[];

// Hard cap per provider so a hung request can't stall app startup. The FX
// fetch runs off the critical path (after seeds load), but a 30s socket hang
// would still delay the "deferred" decision on a flaky network.
const FETCH_TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Network failure, abort, CORS, or malformed JSON → treat as "no data"
    // from this provider; the caller falls through to the next one.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Fetch the full USD→all-currencies cross-rate table from the same keyless
 * public providers, for display-time conversion. fawazahmed0 covers every
 * currency we support, so it is tried first here (frankfurter omits some);
 * frankfurter is the fallback. Returns a partial table — a currency the
 * provider didn't quote is simply absent, and callers treat that as no-data.
 *
 * NEVER invents a missing rate. Returns `null` only if every provider fails or
 * yields no usable rates at all (project rule: no arbitrary numbers).
 *
 * Examples:
 *   await fetchUsdRateTable() → { base:'USD', rates:{ USD:1, CAD:1.385, EUR:0.92, … }, date:'2026-06-07' }
 *   await fetchUsdRateTable() → null   // all providers offline/blocked
 *
 * Returns:
 *   Promise<FxRateTable | null> — { base:'USD', rates (Partial<Record<Currency,number>>, includes USD:1), date (string) }
 */
export async function fetchUsdRateTable(): Promise<FxRateTable | null> {
  // fawazahmed0 first: a table needs broad coverage, and it quotes all 18
  // currencies while frankfurter omits some.
  const fawazUrls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/usd.json`,
  ];
  for (const url of fawazUrls) {
    const data = await fetchJson(url);
    if (data && typeof data === 'object') {
      const o = data as { date?: unknown; usd?: Record<string, unknown> };
      if (o.usd && typeof o.date === 'string') {
        const table = buildTable(code => o.usd?.[code.toLowerCase()], o.date);
        if (table) return table;
      }
    }
  }

  // Fallback — frankfurter.dev, all symbols. Response:
  // { "amount": 1.0, "base": "USD", "date": "YYYY-MM-DD", "rates": { "CAD": 1.3854, … } }
  const frank = await fetchJson(`https://api.frankfurter.dev/v1/latest?base=USD`);
  if (frank && typeof frank === 'object') {
    const o = frank as { date?: unknown; rates?: Record<string, unknown> };
    if (o.rates && typeof o.date === 'string') {
      const table = buildTable(code => o.rates?.[code], o.date);
      if (table) return table;
    }
  }

  return null;
}

// Assemble an FxRateTable from a provider lookup. USD is forced to 1. A rate is
// included only when finite-positive; everything else is omitted (no-data).
// Returns null if not a single non-USD rate came through (provider garbage).
function buildTable(
  lookup: (code: Currency) => unknown,
  date: string,
): FxRateTable | null {
  const rates: Partial<Record<Currency, number>> = { USD: 1 };
  let count = 0;
  for (const code of ALL_CURRENCIES) {
    if (code === 'USD') continue;
    const rate = lookup(code);
    if (isFinitePositive(rate)) {
      rates[code] = rate;
      count++;
    }
  }
  return count > 0 ? { base: 'USD', rates, date } : null;
}
