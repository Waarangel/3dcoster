import type { Currency } from '../types';

/**
 * Result of a successful USD→target rate lookup. `rate` is how many units of
 * `target` one USD buys; `date` is the publish date the provider reported
 * (kept so the one-time seed conversion can record provenance for debugging).
 */
export interface UsdRate {
  rate: number;
  date: string;
}

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
 * Fetch the current USD→`target` exchange rate from a keyless, CORS-enabled
 * public provider. Tries frankfurter.dev first, then the fawazahmed0
 * currency-api jsDelivr CDN, then its Cloudflare Pages mirror. Returns the
 * first valid rate, or `null` if every provider fails or returns garbage.
 *
 * NEVER invents or estimates a rate — a `null` return tells the caller to
 * defer the one-time seed conversion and retry on a later online launch
 * (project rule: no arbitrary numbers).
 *
 * Examples:
 *   await fetchUsdRate('CAD') → { rate: 1.3854, date: '2026-05-28' }
 *   await fetchUsdRate('USD') → { rate: 1, date: <today-ish> }   // identity short-circuit
 *   await fetchUsdRate('EUR') → null                              // all providers offline/blocked
 *
 * Returns:
 *   Promise<UsdRate | null> — UsdRate { rate (number > 0), date (string) }, or null.
 */
export async function fetchUsdRate(target: Currency): Promise<UsdRate | null> {
  // USD→USD is the identity; no network call needed.
  if (target === 'USD') {
    return { rate: 1, date: new Date().toISOString().slice(0, 10) };
  }

  const lower = target.toLowerCase();

  // Provider 1 — frankfurter.dev (ECB data). Response:
  // { "amount": 1.0, "base": "USD", "date": "YYYY-MM-DD", "rates": { "CAD": 1.3854 } }
  const frank = await fetchJson(
    `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${target}`,
  );
  if (frank && typeof frank === 'object') {
    const o = frank as { date?: unknown; rates?: Record<string, unknown> };
    const rate = o.rates?.[target];
    if (isFinitePositive(rate) && typeof o.date === 'string') {
      return { rate, date: o.date };
    }
  }

  // Providers 2 & 3 — fawazahmed0 currency-api (jsDelivr, then Cloudflare
  // mirror). Response: { "date": "YYYY-MM-DD", "usd": { "cad": 1.3867, ... } }
  // Lowercase keys. frankfurter omits some of our 18 currencies (e.g. no MXN
  // for a period historically); this provider covers the long tail.
  const fawazUrls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/usd.json`,
  ];
  for (const url of fawazUrls) {
    const data = await fetchJson(url);
    if (data && typeof data === 'object') {
      const o = data as { date?: unknown; usd?: Record<string, unknown> };
      const rate = o.usd?.[lower];
      if (isFinitePositive(rate) && typeof o.date === 'string') {
        return { rate, date: o.date };
      }
    }
  }

  return null;
}
