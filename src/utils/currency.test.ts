import { describe, it, expect } from 'vitest';
import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('formats positive amounts with the currency symbol and decimal places', () => {
    expect(formatCurrency(15.5, 'USD')).toBe('$15.50');
    expect(formatCurrency(1234.5, 'EUR')).toBe('€1234.50');
    expect(formatCurrency(100, 'JPY')).toBe('¥100'); // 0 decimal places
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
