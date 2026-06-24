import { describe, it, expect } from 'vitest';
import type { ShippingConfig } from '../types';
import { computeJobShipping } from './jobShipping';
import { pricePerGallonToPerLiter, milesToKm, mpgToLitersPer100Km } from './currency';

/**
 * The dropoff branch is metric-internal: it spends litres of fuel
 * (km × 2 / 100 × L/100km) at `gasPricePerLiter`. Every test here feeds it the
 * canonical per-litre price; the US scenarios convert a per-gallon entry first,
 * exactly as the Settings field must.
 */
const baseConfig: ShippingConfig = {
  maxDeliveryRadiusKm: 25,
  gasPricePerLiter: 1.5,
  vehicleFuelEfficiency: 10, // L/100km
  upsBaseCost: 15,
  fedexBaseCost: 15,
  purolatorBaseCost: 12,
  uspsBaseCost: 10,
  dhlBaseCost: 20,
  royalMailBaseCost: 8,
  australiaPostBaseCost: 12,
  canadaPostBaseCost: 15,
  customCarriers: [],
};

describe('computeJobShipping — dropoff fuel math', () => {
  it('computes a metric (CAD, per-litre) dropoff correctly', () => {
    // 20 km each way at 10 L/100km = 40km round trip → 4.0 L → ×$1.50/L = $6.00
    const cost = computeJobShipping(
      { shippingMethod: 'dropoff', shippingDistanceKm: 20, shippingOverrideCost: undefined },
      { ...baseConfig, gasPricePerLiter: 1.5, vehicleFuelEfficiency: 10 },
    );
    expect(cost).toBeCloseTo(6.0, 2);
  });

  it('matches a hand-computed US gallon scenario once the price is converted to per-litre', () => {
    // US user: 10 miles away, 25 MPG, $3.50/gal.
    // Imperial truth: 20 mi round trip ÷ 25 MPG = 0.8 gal × $3.50 = $2.80.
    const config: ShippingConfig = {
      ...baseConfig,
      vehicleFuelEfficiency: mpgToLitersPer100Km(25), // stored as L/100km
      gasPricePerLiter: pricePerGallonToPerLiter(3.5), // stored as per-litre
    };
    const cost = computeJobShipping(
      {
        shippingMethod: 'dropoff',
        shippingDistanceKm: milesToKm(10), // stored as km
        shippingOverrideCost: undefined,
      },
      config,
    );
    // ceil-to-cent + unit round-trips leave at most a penny of slack.
    expect(cost).toBeGreaterThanOrEqual(2.8);
    expect(cost).toBeLessThanOrEqual(2.82);
  });

  it('would overstate the US dropoff ~3.785× if the per-gallon entry were stored unconverted (the bug)', () => {
    const shared = {
      ...baseConfig,
      vehicleFuelEfficiency: mpgToLitersPer100Km(25),
    };
    const job = {
      shippingMethod: 'dropoff' as const,
      shippingDistanceKm: milesToKm(10),
      shippingOverrideCost: undefined,
    };
    const correct = computeJobShipping(job, { ...shared, gasPricePerLiter: pricePerGallonToPerLiter(3.5) });
    const buggy = computeJobShipping(job, { ...shared, gasPricePerLiter: 3.5 }); // raw $/gal stored as $/L
    expect(buggy / correct).toBeCloseTo(3.785411784, 1);
  });
});
