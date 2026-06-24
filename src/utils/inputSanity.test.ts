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

  // Guards the SettingsModal seam: with the per-gallon conversion fix the field
  // passes the DISPLAYED per-gallon value here, so a US cents misentry must warn
  // against the per-gallon ceiling and a normal pump price must stay silent.
  it('warns on a US per-gallon cents misentry but not a normal pump price', () => {
    expect(fuelPriceWarning(150, 'gal', '$')).not.toBeNull();
    expect(fuelPriceWarning(3.5, 'gal', '$')).toBeNull();
  });

  it('leaves the per-litre path unchanged (151¢/L misentry still warns)', () => {
    expect(fuelPriceWarning(0.9, 'L', '$')).toBeNull();
    expect(fuelPriceWarning(151, 'L', '$')).not.toBeNull();
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
