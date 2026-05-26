// ---------------------------------------------------------------------------
// Phase 20 (DATA-05, DATA-06) — versionchange handler + getSetting validator + is-predicates
//
// Three test surfaces in one file (kept together per RESEARCH.md Wave 0 Gaps note:
// "small surface; do not stuff into database.migrations.test.ts"):
//   A. versionchange handler awaits db.close() before reload (DATA-05)
//   B. getSetting<T> with optional structural validator (DATA-06)
//   C. Six hand-rolled is-predicates for typed getters (DATA-06)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from 'vitest';
import { db, getSetting, handleVersionchange, isPrinterConfig, isElectricityConfig, isLaborConfig, isUserProfile, isShippingConfig, isMarketplaceFees } from './database';
import type { PrinterConfig } from '../types';

// ---------------------------------------------------------------------------
// A. versionchange handler — DATA-05
// ---------------------------------------------------------------------------

describe('versionchange handler (DATA-05)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awaits db.close() before window.location.reload()', async () => {
    const callOrder: string[] = [];

    // Spy on db.close — resolves after tracking order
    vi.spyOn(db, 'close').mockImplementation(async () => {
      callOrder.push('close');
    });

    // Stub window.location.reload
    const reloadMock = vi.fn(() => { callOrder.push('reload'); });
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    await handleVersionchange();

    expect(callOrder).toEqual(['close', 'reload']);
    expect(callOrder.indexOf('close')).toBeLessThan(callOrder.indexOf('reload'));
  });
});

// ---------------------------------------------------------------------------
// B. getSetting<T> with validator — DATA-06
// ---------------------------------------------------------------------------

const defaultPrinterConfig: PrinterConfig = {
  id: 'default',
  name: 'Default Printer',
  purchasePrice: 300,
  expectedLifespanHours: 5000,
  wattage: 250,
  nozzleCost: 10,
  nozzleLifespanCm3: 15000,
};

describe('getSetting<T> with validator (DATA-06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaultValue when no settings row exists', async () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue(undefined);
    const result = await getSetting<PrinterConfig>('printer', defaultPrinterConfig, isPrinterConfig);
    expect(result).toBe(defaultPrinterConfig);
  });

  it('returns defaultValue when stored JSON fails to parse', async () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue({ key: 'printer', value: 'not-valid-json{{{' });
    const result = await getSetting<PrinterConfig>('printer', defaultPrinterConfig, isPrinterConfig);
    expect(result).toBe(defaultPrinterConfig);
  });

  it('returns defaultValue when validator rejects parsed shape', async () => {
    // Well-formed JSON but wrong shape (missing numeric fields)
    vi.spyOn(db.settings, 'get').mockResolvedValue({
      key: 'printer',
      value: JSON.stringify({ id: 'p1', name: 'Bambu' }),
    });
    const result = await getSetting<PrinterConfig>('printer', defaultPrinterConfig, isPrinterConfig);
    expect(result).toBe(defaultPrinterConfig);
  });

  it('returns parsed value when validator accepts parsed shape', async () => {
    const stored: PrinterConfig = {
      id: 'p1',
      name: 'Bambu',
      purchasePrice: 500,
      expectedLifespanHours: 8000,
      wattage: 200,
      nozzleCost: 8,
      nozzleLifespanCm3: 12000,
    };
    vi.spyOn(db.settings, 'get').mockResolvedValue({
      key: 'printer',
      value: JSON.stringify(stored),
    });
    const result = await getSetting<PrinterConfig>('printer', defaultPrinterConfig, isPrinterConfig);
    expect(result).toEqual(stored);
  });

  it('console.warn fires when validator rejects in dev (import.meta.env.DEV is true in Vitest)', async () => {
    // import.meta.env.DEV is always true in Vitest test mode (it is a Vite compile-time constant
    // that cannot be changed via vi.stubEnv). We assert the warn fires in dev mode here.
    // The `if (import.meta.env.DEV)` guard in getSetting ensures the warn is silent in production
    // builds — verified by code inspection (Vite replaces import.meta.env.DEV with false at build time).
    vi.spyOn(db.settings, 'get').mockResolvedValue({
      key: 'printer',
      value: JSON.stringify({ id: 'p1', name: 'Bambu' }),
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await getSetting<PrinterConfig>('printer', defaultPrinterConfig, isPrinterConfig);

    expect(warnSpy).toHaveBeenCalledWith('[getSetting] validator rejected stored "printer"; using default');
  });
});

// ---------------------------------------------------------------------------
// C. is-predicates — DATA-06
// ---------------------------------------------------------------------------

describe('isPrinterConfig (DATA-06)', () => {
  it('accepts a well-formed PrinterConfig', () => {
    expect(isPrinterConfig({
      id: 'p1',
      name: 'Bambu X1C',
      purchasePrice: 1200,
      expectedLifespanHours: 8000,
      wattage: 350,
      nozzleCost: 12,
      nozzleLifespanCm3: 15000,
    })).toBe(true);
  });

  it('rejects a missing required numeric field (wattage)', () => {
    expect(isPrinterConfig({
      id: 'p1',
      name: 'Bambu X1C',
      purchasePrice: 1200,
      expectedLifespanHours: 8000,
      nozzleCost: 12,
      nozzleLifespanCm3: 15000,
    })).toBe(false);
  });

  it('rejects a non-object (null)', () => {
    expect(isPrinterConfig(null)).toBe(false);
  });

  it('rejects a non-object (number)', () => {
    expect(isPrinterConfig(42)).toBe(false);
  });
});

describe('isElectricityConfig (DATA-06)', () => {
  it('accepts a well-formed ElectricityConfig', () => {
    expect(isElectricityConfig({ costPerKwh: 0.12 })).toBe(true);
  });

  it('rejects a missing numeric field (costPerKwh)', () => {
    expect(isElectricityConfig({})).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isElectricityConfig('0.12')).toBe(false);
  });
});

describe('isLaborConfig (DATA-06)', () => {
  it('accepts a well-formed LaborConfig', () => {
    expect(isLaborConfig({ hourlyRate: 25 })).toBe(true);
  });

  it('rejects a missing numeric field (hourlyRate)', () => {
    expect(isLaborConfig({ hourlyRateX: 25 })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isLaborConfig(null)).toBe(false);
  });
});

describe('isUserProfile (DATA-06)', () => {
  it('accepts a well-formed UserProfile', () => {
    expect(isUserProfile({
      currency: 'CAD',
      laborHourlyRate: 20,
    })).toBe(true);
  });

  it('accepts any string for currency (does NOT narrow Currency union)', () => {
    // Locks RESEARCH.md DATA-06 landmine A4: be loose on string fields
    expect(isUserProfile({
      currency: 'ZZZ',
      laborHourlyRate: 20,
    })).toBe(true);
  });

  it('rejects a missing required numeric field (laborHourlyRate)', () => {
    expect(isUserProfile({
      currency: 'CAD',
    })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isUserProfile(null)).toBe(false);
  });
});

describe('isShippingConfig (DATA-06)', () => {
  it('accepts a well-formed ShippingConfig', () => {
    expect(isShippingConfig({
      maxDeliveryRadiusKm: 50,
      gasPricePerLiter: 1.75,
      vehicleFuelEfficiency: 9.5,
      upsBaseCost: 15,
      fedexBaseCost: 16,
      purolatorBaseCost: 14,
      uspsBaseCost: 12,
      dhlBaseCost: 18,
      royalMailBaseCost: 10,
      australiaPostBaseCost: 13,
      canadaPostBaseCost: 14,
      customCarriers: [],
    })).toBe(true);
  });

  it('rejects a missing required numeric field (gasPricePerLiter)', () => {
    expect(isShippingConfig({
      maxDeliveryRadiusKm: 50,
      vehicleFuelEfficiency: 9.5,
      upsBaseCost: 15,
      fedexBaseCost: 16,
      purolatorBaseCost: 14,
      uspsBaseCost: 12,
      dhlBaseCost: 18,
      royalMailBaseCost: 10,
      australiaPostBaseCost: 13,
      canadaPostBaseCost: 14,
      customCarriers: [],
    })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isShippingConfig([])).toBe(false);
  });
});

describe('isMarketplaceFees (DATA-06)', () => {
  it('accepts a well-formed MarketplaceFees', () => {
    expect(isMarketplaceFees({
      facebookShippedPercent: 10,
      facebookMinFee: 0.8,
      facebookProcessingPercent: 2.9,
      etsyTransactionPercent: 6.5,
      etsyPaymentPercent: 3,
      etsyPaymentFixed: 0.25,
      etsyListingFee: 0.2,
      etsyOffsiteAdPercent: 15,
      kijijiFeaturedFee: 0,
      ebayFinalValuePercent: 12.9,
      ebayFixedFee: 0.3,
      amazonHandmadePercent: 15,
      customMarketplaces: [],
    })).toBe(true);
  });

  it('rejects a missing required numeric field (ebayFinalValuePercent)', () => {
    expect(isMarketplaceFees({
      facebookShippedPercent: 10,
      facebookMinFee: 0.8,
      facebookProcessingPercent: 2.9,
      etsyTransactionPercent: 6.5,
      etsyPaymentPercent: 3,
      etsyPaymentFixed: 0.25,
      etsyListingFee: 0.2,
      etsyOffsiteAdPercent: 15,
      kijijiFeaturedFee: 0,
      // ebayFinalValuePercent missing
      ebayFixedFee: 0.3,
      amazonHandmadePercent: 15,
      customMarketplaces: [],
    })).toBe(false);
  });

  it('rejects a non-object (string)', () => {
    expect(isMarketplaceFees('fees')).toBe(false);
  });
});
