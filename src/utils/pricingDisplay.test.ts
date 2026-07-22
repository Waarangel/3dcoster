import { describe, it, expect } from 'vitest';
import {
  resolveDisplayCurrency,
  formatApproxPrice,
  regionFromLanguageTag,
  formatZeroPrice,
} from './pricingDisplay';
import type { FxRateTable } from './fxConvert';

// ---------------------------------------------------------------------------
// pricingDisplay — Phase 45-12 (G-45-CURRENCY, BRAND-01).
//
// Pure resolution-ladder + approx-price formatter. See useDisplayPrice.test.tsx
// for the hook-level wiring coverage (stored preference + FX table + React).
//
// Phase 45-14 (G-45-PRICING-CONSISTENCY) — dollar-collision disambiguation
// (CA$/A$/NZ$/MX$) and formatZeroPrice added; billing base is now USD.
// ---------------------------------------------------------------------------

const TABLE: FxRateTable = {
  base: 'USD',
  date: '2026-07-01',
  rates: { EUR: 0.92, GBP: 0.79, USD: 1, CAD: 1.36, AUD: 1.5, NZD: 1.65 },
};

describe('regionFromLanguageTag', () => {
  it('resolves a region from a full language tag', () => {
    expect(regionFromLanguageTag('en-GB')).toBe('GB');
    expect(regionFromLanguageTag('de-DE')).toBe('DE');
  });

  it('returns undefined for an unresolvable or absent tag', () => {
    expect(regionFromLanguageTag('xx')).toBeUndefined();
    expect(regionFromLanguageTag(undefined)).toBeUndefined();
  });
});

describe('resolveDisplayCurrency', () => {
  it('stored preference wins over locale inference (ladder precedence)', () => {
    expect(resolveDisplayCurrency('JPY', 'en-GB')).toBe('JPY');
  });

  it('falls through to locale inference when nothing is stored', () => {
    expect(resolveDisplayCurrency(null, 'en-GB')).toBe('GBP');
    expect(resolveDisplayCurrency(null, 'de-DE')).toBe('EUR');
    expect(resolveDisplayCurrency(null, 'fr-FR')).toBe('EUR');
    expect(resolveDisplayCurrency(null, 'en-US')).toBe('USD');
  });

  it('falls back to USD when the region is unknown or absent', () => {
    expect(resolveDisplayCurrency(null, 'xx')).toBe('USD');
    expect(resolveDisplayCurrency(null, undefined)).toBe('USD');
  });
});

describe('formatApproxPrice', () => {
  it('returns null when the display currency equals the billing currency', () => {
    expect(formatApproxPrice(6.9, 'EUR', 'EUR', TABLE)).toBeNull();
  });

  it('returns null when no FX table is available (no guessed number)', () => {
    expect(formatApproxPrice(6.9, 'EUR', 'GBP', null)).toBeNull();
  });

  it('returns a formatted string in the display currency when the table covers both', () => {
    const result = formatApproxPrice(6.9, 'EUR', 'USD', TABLE);
    expect(result).not.toBeNull();
    expect(result).toMatch(/^\$/);
  });

  it('disambiguates dollar-collision currencies with a prefixed symbol', () => {
    expect(formatApproxPrice(7.99, 'USD', 'CAD', TABLE)).toMatch(/^CA\$/);
    expect(formatApproxPrice(7.99, 'USD', 'AUD', TABLE)).toMatch(/^A\$/);
    expect(formatApproxPrice(7.99, 'USD', 'NZD', TABLE)).toMatch(/^NZ\$/);
  });

  it('leaves a non-dollar display currency unchanged (control)', () => {
    expect(formatApproxPrice(7.99, 'USD', 'GBP', TABLE)).toMatch(/^£/);
  });
});

describe('formatZeroPrice', () => {
  it('returns a decimal-free zero prefixed with the currency symbol', () => {
    expect(formatZeroPrice('EUR')).toBe('€0');
    expect(formatZeroPrice('GBP')).toBe('£0');
    expect(formatZeroPrice('USD')).toBe('$0');
  });

  it('disambiguates dollar-collision currencies', () => {
    expect(formatZeroPrice('CAD')).toBe('CA$0');
  });
});
