import { describe, it, expect } from 'vitest';
import {
  electricityRateWarning,
  fuelPriceWarning,
  printerLifespanWarning,
} from './inputSanity';

describe('electricityRateWarning', () => {
  it('is silent for a realistic per-kWh rate', () => {
    expect(electricityRateWarning(0.15, '$')).toBeNull();
    expect(electricityRateWarning(0.4, '$')).toBeNull();
  });

  it('warns when cents were typed as dollars (the 100x trap)', () => {
    const msg = electricityRateWarning(15, '$');
    expect(msg).not.toBeNull();
    expect(msg).toContain('cents');
  });
});

describe('fuelPriceWarning', () => {
  it('is silent for a realistic per-litre price', () => {
    expect(fuelPriceWarning(1.5, 'L', '$')).toBeNull();
  });

  it('warns when a per-litre price looks like cents (e.g. Canada 150.9¢/L)', () => {
    const msg = fuelPriceWarning(150, 'L', '$');
    expect(msg).not.toBeNull();
    expect(msg).toContain('cents');
  });

  it('uses a higher threshold for per-gallon pricing', () => {
    expect(fuelPriceWarning(4, 'gal', '$')).toBeNull();
    expect(fuelPriceWarning(25, 'gal', '$')).not.toBeNull();
  });
});

describe('printerLifespanWarning', () => {
  it('is silent for a realistic print-hour lifespan', () => {
    expect(printerLifespanWarning(5000)).toBeNull();
  });

  it('is silent for an unset (zero) value', () => {
    expect(printerLifespanWarning(0)).toBeNull();
  });

  it('warns when years were entered instead of hours', () => {
    const msg = printerLifespanWarning(5);
    expect(msg).not.toBeNull();
    expect(msg).toContain('years');
  });
});
