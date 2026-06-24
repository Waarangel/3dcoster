import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  LITERS_PER_US_GALLON,
  pricePerLiterToPerGallon,
  pricePerGallonToPerLiter,
} from './currency';

describe('formatCurrency', () => {
  it('formats positive amounts with the currency symbol and decimal places', () => {
    expect(formatCurrency(15.5, 'USD')).toBe('$15.50');
    expect(formatCurrency(1234.5, 'EUR')).toBe('€1,234.50');
    expect(formatCurrency(100, 'JPY')).toBe('¥100'); // 0 decimal places
  });

  it('groups thousands in the numeric portion', () => {
    expect(formatCurrency(1234567.89, 'USD')).toBe('$1,234,567.89');
    expect(formatCurrency(1000, 'USD')).toBe('$1,000.00');
    expect(formatCurrency(1234567, 'JPY')).toBe('¥1,234,567'); // grouped, still 0 decimals
    expect(formatCurrency(999.99, 'USD')).toBe('$999.99'); // below grouping threshold, unchanged
  });

  it('respects an explicit locale for grouping/decimal separators (i18n seam)', () => {
    // German locale: dot for grouping, comma for decimal. Symbol stays curated/prefixed.
    expect(formatCurrency(1234.5, 'EUR', 'de-DE')).toBe('€1.234,50');
    // Negative + locale: sign still leads the symbol.
    expect(formatCurrency(-1234.5, 'EUR', 'de-DE')).toBe('-€1.234,50');
  });

  it('places the minus sign BEFORE the symbol for negative amounts', () => {
    // "-$15.50", not "$-15.50" — the summary bar's Total Profit can go
    // negative prominently (text-2xl), so the sign order must read as money.
    expect(formatCurrency(-15.5, 'USD')).toBe('-$15.50');
    expect(formatCurrency(-0.01, 'EUR')).toBe('-€0.01');
    expect(formatCurrency(-100, 'JPY')).toBe('-¥100');
  });

  it('does not show a minus sign for zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    expect(formatCurrency(-0, 'USD')).toBe('$0.00');
  });
});

describe('fuel price unit conversion (per-litre canonical storage ↔ per-gallon US display)', () => {
  it('uses the exact US liquid gallon (3.785411784 L)', () => {
    expect(LITERS_PER_US_GALLON).toBeCloseTo(3.785411784, 9);
  });

  it('converts a stored per-litre price up to a per-gallon display value', () => {
    // $1.50/L is the metric default; in US gallons that's ~$5.68/gal.
    expect(pricePerLiterToPerGallon(1.5)).toBeCloseTo(5.678, 3);
  });

  it('converts a per-gallon entry down to the per-litre value we store', () => {
    // A US user types $3.50/gal → we must store ~$0.9246/L for the metric dropoff math.
    expect(pricePerGallonToPerLiter(3.5)).toBeCloseTo(0.924602, 5);
  });

  it('round-trips without drift (gallon → litre → gallon)', () => {
    expect(pricePerLiterToPerGallon(pricePerGallonToPerLiter(3.5))).toBeCloseTo(3.5, 10);
  });

  it('maps zero to zero', () => {
    expect(pricePerGallonToPerLiter(0)).toBe(0);
    expect(pricePerLiterToPerGallon(0)).toBe(0);
  });
});
