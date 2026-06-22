import type { Currency } from '../types';

/**
 * A cached USD-based exchange-rate table. `rates[X]` is how many units of
 * currency `X` one US dollar buys (so `rates.USD` is always 1). `date` is the
 * provider's publish date, kept for staleness checks and provenance display.
 *
 * Stored as a partial record: a provider may not cover every currency we
 * support, and a missing key means "no rate available" — callers must treat
 * that as no-data, never as zero.
 */
export interface FxRateTable {
  base: 'USD';
  rates: Partial<Record<Currency, number>>;
  /** The provider's publish date (YYYY-MM-DD). Provenance only. */
  date: string;
  /**
   * Epoch ms of when WE fetched and cached this table. Used for staleness —
   * prefer this over `date`, which is the provider's publish date and can lag
   * (e.g. weekend ECB data), making a freshly-fetched table look already stale.
   * Optional: tables cached before this field existed fall back to `date`.
   */
  cachedAt?: number;
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Look up the USD→`currency` rate from a table. USD is the identity (1) and
 * never needs to be present in `rates`. Returns null when the rate is absent or
 * corrupt (non-finite / non-positive).
 */
function rateForCurrency(currency: Currency, table: FxRateTable): number | null {
  if (currency === 'USD') return 1;
  const rate = table.rates[currency];
  return isFinitePositive(rate) ? rate : null;
}

/**
 * True when `amount` can be converted from `from` to `to` given `table`.
 * Identical currencies are always convertible (no table needed); otherwise both
 * currencies must resolve to a valid rate.
 *
 * Examples:
 *   canConvert('CAD', 'CAD', null)  → true   // identity
 *   canConvert('CAD', 'EUR', table) → true   // both present
 *   canConvert('CAD', 'ZAR', table) → false  // ZAR missing
 *
 * Returns: boolean
 */
export function canConvert(
  from: Currency,
  to: Currency,
  table: FxRateTable | null | undefined,
): boolean {
  if (from === to) return true;
  if (!table) return false;
  return rateForCurrency(from, table) !== null && rateForCurrency(to, table) !== null;
}

/**
 * Convert `amount` from one currency to another using a USD-based rate table.
 *
 * Conversion goes through the USD base: `amount * rate(to) / rate(from)`.
 * Returns the original amount when `from === to` (no table required).
 * Returns **null** — never a guessed number — when the table is missing, a
 * currency is absent, a rate is corrupt, or `amount` is non-finite. Callers
 * must render a no-data state for null (project rule: no arbitrary numbers).
 *
 * Examples:
 *   convert(10, 'USD', 'CAD', table)   → 13.7           // 1 USD = 1.37 CAD
 *   convert(13.7, 'CAD', 'USD', table) → 10             // inverse
 *   convert(13.7, 'CAD', 'EUR', table) → 9.2            // via USD base
 *   convert(10, 'USD', 'CAD', null)    → null           // no rate data
 *
 * Returns: number (converted amount) or null (no data / invalid input)
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  table: FxRateTable | null | undefined,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (amount === 0) return 0; // zero is zero in any currency — never needs a rate
  if (from === to) return amount;
  if (!table) return null;

  const fromRate = rateForCurrency(from, table);
  const toRate = rateForCurrency(to, table);
  if (fromRate === null || toRate === null) return null;

  return amount * (toRate / fromRate);
}
