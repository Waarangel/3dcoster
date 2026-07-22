import type { Currency } from '../types';
import { formatCurrency, getCurrencySymbol } from './currency';
import { convert, type FxRateTable } from './fxConvert';

// ---------------------------------------------------------------------------
// pricingDisplay — Phase 45-12 (G-45-CURRENCY, BRAND-01).
//
// Pure (no React, no IO) currency-resolution + display-conversion layer for
// the marketing Pro price. Billing truth stays a fixed USD constant
// (src/pricing.ts, mirrored from BillingPanel.tsx) — this module only
// decides which currency to APPROXIMATE that fixed price in, and formats the
// approximation. Callers (src/hooks/useDisplayPrice.ts) always pair the
// approximation with the verbatim USD billing label; never render one
// without the other (T-45-12-01).
//
// Phase 45-14 (G-45-PRICING-CONSISTENCY) — dollar-collision currencies
// (CAD/AUD/NZD/MXN) format with a leading bare '$' via src/utils/currency.ts,
// which reads identically to the USD billing base. formatApproxPrice
// disambiguates those with a prefixed symbol (CA$/A$/NZ$/MX$); formatZeroPrice
// gives the Free-card zero the same treatment so it never renders €0/$0 next
// to a Pro figure shown in a different currency (T-45-14-02). This module
// deliberately never touches src/utils/currency.ts's formatCurrency, which
// the /app calculator and PDF quotes rely on.
// ---------------------------------------------------------------------------

/**
 * Dollar-collision display currencies: src/utils/currency.ts formats each of
 * these with a bare leading '$' (identical to USD), which would be
 * ambiguous next to the USD billing label. USD itself is deliberately
 * OMITTED — it is the billing base and is shown only via the ISO-code
 * label, never as an approx symbol, so its display stays a bare '$'.
 */
const DOLLAR_DISAMBIGUATION: Partial<Record<Currency, string>> = {
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  MXN: 'MX$',
};

/**
 * ISO 3166-1 alpha-2 region → supported Currency. Direct country matches from
 * CURRENCY_CONFIG, plus eurozone members (which don't have their own entry in
 * CURRENCY_CONFIG since EUR is already shared across them). Regions with no
 * entry here fall through to the USD default in resolveDisplayCurrency.
 */
export const REGION_TO_CURRENCY: Record<string, Currency> = {
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  BR: 'BRL',
  MX: 'MXN',
  ZA: 'ZAR',
  // Eurozone members.
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  AT: 'EUR',
  BE: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  SK: 'EUR',
  SI: 'EUR',
  LT: 'EUR',
  LV: 'EUR',
  EE: 'EUR',
  LU: 'EUR',
  CY: 'EUR',
  MT: 'EUR',
};

/**
 * Resolve the ISO 3166-1 alpha-2 region from a BCP 47 language tag (e.g.
 * `navigator.language`). Uses `Intl.Locale` maximization first (handles
 * language-only tags like "de" by filling in the likely region); falls back
 * to a defensive split on '-' for environments/tags where `Intl.Locale`
 * throws or yields no region. Returns undefined when nothing resolves,
 * including when `tag` itself is undefined.
 *
 * Examples:
 *   regionFromLanguageTag('en-GB') → 'GB'
 *   regionFromLanguageTag('de-DE') → 'DE'
 *   regionFromLanguageTag('xx')    → undefined
 *   regionFromLanguageTag(undefined) → undefined
 */
export function regionFromLanguageTag(tag: string | undefined): string | undefined {
  if (!tag) return undefined;
  try {
    const region = new Intl.Locale(tag).maximize().region;
    if (region) return region;
  } catch {
    // Fall through to the defensive split below.
  }
  const parts = tag.split('-');
  const candidate = parts.find((part) => /^[A-Za-z]{2}$/.test(part) && part !== parts[0]);
  return candidate ? candidate.toUpperCase() : undefined;
}

/**
 * Resolve which currency to APPROXIMATE the fixed USD billing price in, per
 * the founder-confirmed ladder: stored app currency preference → locale
 * inference → USD fallback. This choice affects the DISPLAY currency ONLY —
 * it never alters the billing amount itself.
 *
 * Examples:
 *   resolveDisplayCurrency('JPY', 'en-GB') → 'JPY'   // stored wins
 *   resolveDisplayCurrency(null, 'en-GB')  → 'GBP'   // locale inference
 *   resolveDisplayCurrency(null, 'xx')     → 'USD'   // unresolvable → USD
 *   resolveDisplayCurrency(null, undefined) → 'USD'  // no locale → USD
 *
 * Returns: Currency
 */
export function resolveDisplayCurrency(
  stored: Currency | null,
  languageTag: string | undefined,
): Currency {
  if (stored !== null) return stored;
  const region = regionFromLanguageTag(languageTag);
  if (region && region in REGION_TO_CURRENCY) return REGION_TO_CURRENCY[region];
  return 'USD';
}

/**
 * Format a home-currency approximation of a fixed billing amount. Returns
 * null — never a guessed number — when the display currency equals the
 * billing currency (no approximation needed, billing label alone is
 * correct) or when the FX table can't cover the conversion. The approx is
 * ALWAYS the secondary value: callers pair it with the verbatim billing
 * label (never call this without also rendering billing) per T-45-12-01.
 *
 * Dollar-collision display currencies (CAD/AUD/NZD/MXN) get a disambiguated
 * prefix (CA$/A$/NZ$/MX$) so the approximation can never be mistaken for the
 * USD billing amount shown alongside it.
 *
 * Examples:
 *   formatApproxPrice(7.99, 'USD', 'USD', table) → null           // same currency
 *   formatApproxPrice(7.99, 'USD', 'GBP', null)  → null           // no table
 *   formatApproxPrice(7.99, 'USD', 'GBP', table) → '£6.31'        // converted
 *   formatApproxPrice(7.99, 'USD', 'CAD', table) → 'CA$10.87'     // disambiguated
 *
 * Returns: string (formatted approx price) or null (no approximation to show)
 */
export function formatApproxPrice(
  billingAmount: number,
  billingCurrency: Currency,
  displayCurrency: Currency,
  table: FxRateTable | null,
): string | null {
  if (displayCurrency === billingCurrency) return null;
  const converted = convert(billingAmount, billingCurrency, displayCurrency, table);
  if (converted === null) return null;
  const formatted = formatCurrency(converted, displayCurrency);
  const disambiguated = DOLLAR_DISAMBIGUATION[displayCurrency];
  // These currencies all format with a leading '$' for the positive prices
  // this layer handles — strip index 0 and prepend the disambiguated symbol.
  // Avoid String.replace to sidestep '$'-pattern interpretation.
  return disambiguated ? disambiguated + formatted.slice(1) : formatted;
}

/**
 * A decimal-free zero in the given currency, disambiguated the same way as
 * formatApproxPrice. Needs no FX table — zero is zero in every currency.
 *
 * Examples:
 *   formatZeroPrice('EUR') → '€0'
 *   formatZeroPrice('CAD') → 'CA$0'
 *   formatZeroPrice('USD') → '$0'
 *
 * Returns: string
 */
export function formatZeroPrice(currency: Currency): string {
  return `${DOLLAR_DISAMBIGUATION[currency] ?? getCurrencySymbol(currency)}0`;
}
