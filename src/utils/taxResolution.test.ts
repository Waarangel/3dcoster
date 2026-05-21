import { describe, it, expect } from 'vitest';
import { resolveTaxRate, isRateStale, tooltipForSource } from './taxResolution';
import type { TaxRateSource } from './taxResolution';
import { US_MARKETPLACE_FACILITATOR_NOTE } from '../data/taxRates';

// Single source of truth — same constant the data file ships in the US row's
// `note` field and the resolver appends for USD users. Importing here ensures
// the de-dup test catches drift instead of duplicating it.
const US_NOTE_FIXTURE = US_MARKETPLACE_FACILITATOR_NOTE;

// ---------------------------------------------------------------------------
// resolveTaxRate — fallback chain
// ---------------------------------------------------------------------------

describe('resolveTaxRate', () => {
  it('returns kind override when jobOverride is set (override wins over settings and region)', () => {
    const result = resolveTaxRate({ jobOverride: 8, settingsDefault: 20, currency: 'USD' });
    expect(result).toEqual({ kind: 'override', rate: 8 });
  });

  it('returns kind settings when only settingsDefault is set (settings wins over region)', () => {
    const result = resolveTaxRate({ jobOverride: undefined, settingsDefault: 15, currency: 'GBP' });
    expect(result).toEqual({ kind: 'settings', rate: 15 });
  });

  it('US region default returns kind region with rate 0 and marketplace-facilitator note', () => {
    const result = resolveTaxRate({ jobOverride: undefined, settingsDefault: undefined, currency: 'USD' });
    expect(result.kind).toBe('region');
    if (result.kind === 'region') {
      expect(result.rate).toBe(0);
      expect(result.region).toBe('US');
      expect(result.rateAsOf).toBe('2025-01-01');
      expect(result.note).toContain('marketplaces');
    }
  });

  it('EU average returns kind eu-average with rate 21 for EUR currency', () => {
    const result = resolveTaxRate({ jobOverride: undefined, settingsDefault: undefined, currency: 'EUR' });
    expect(result.kind).toBe('eu-average');
    expect(result.rate).toBe(21);
  });

  it('manual (unknown region) returns kind manual rate 0 for currency not in TAX_RATES', () => {
    const result = resolveTaxRate({ jobOverride: undefined, settingsDefault: undefined, currency: 'ZAR' });
    expect(result).toEqual({ kind: 'manual', rate: 0 });
  });

  it('GBP region default returns kind region with rate 20', () => {
    const result = resolveTaxRate({ jobOverride: undefined, settingsDefault: undefined, currency: 'GBP' });
    expect(result.kind).toBe('region');
    if (result.kind === 'region') {
      expect(result.rate).toBe(20);
      expect(result.region).toBe('GB');
    }
  });
});

// ---------------------------------------------------------------------------
// isRateStale — 18-month threshold, NaN guard
// ---------------------------------------------------------------------------

describe('isRateStale', () => {
  it('is stale when lastVerified is more than 18 months before now', () => {
    // 2024-01-01 to 2026-05-21 ≈ 28.5 months — well past the 18-month cutoff
    expect(isRateStale('2024-01-01', new Date('2026-05-21'))).toBe(true);
  });

  it('is fresh when lastVerified is within 18 months of now', () => {
    // 2025-08-01 to 2026-05-21 ≈ 9.7 months — well inside the 18-month cutoff
    expect(isRateStale('2025-08-01', new Date('2026-05-21'))).toBe(false);
  });

  it('returns false for invalid date string (NaN guard)', () => {
    expect(isRateStale('not-a-date', new Date('2026-05-21'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tooltipForSource — locked UI-SPEC strings + USD-append (D-12 + D-13)
// ---------------------------------------------------------------------------

describe('tooltipForSource', () => {
  it('override + non-USD currency: contains per-job override text and NOT the marketplace note', () => {
    const source: TaxRateSource = { kind: 'override', rate: 8 };
    const result = tooltipForSource(source, 'GBP');
    expect(result).toContain('Per-job override —');
    expect(result).not.toContain('marketplaces');
  });

  it('override + USD: appends the marketplace-facilitator note (D-12)', () => {
    const source: TaxRateSource = { kind: 'override', rate: 8 };
    const result = tooltipForSource(source, 'USD');
    expect(result).toContain('Per-job override —');
    expect(result).toContain('marketplaces (Etsy, eBay, Amazon)');
  });

  it('settings + non-USD currency: contains settings-default text and NOT the marketplace note', () => {
    const source: TaxRateSource = { kind: 'settings', rate: 15 };
    const result = tooltipForSource(source, 'GBP');
    expect(result).toContain('From Settings default —');
    expect(result).not.toContain('marketplaces');
  });

  it('settings + USD: appends the marketplace-facilitator note (D-13)', () => {
    const source: TaxRateSource = { kind: 'settings', rate: 15 };
    const result = tooltipForSource(source, 'USD');
    expect(result).toContain('From Settings default —');
    expect(result).toContain('marketplaces');
  });

  it('region + non-USD (GBP): contains region text and NOT the marketplace note', () => {
    const source: TaxRateSource = {
      kind: 'region',
      rate: 20,
      region: 'GB',
      rateAsOf: '2011-01-04',
      lastVerified: '2026-05-21',
    };
    const result = tooltipForSource(source, 'GBP');
    expect(result).toContain('From your region (GB');
    expect(result).not.toContain('marketplaces');
  });

  it('region + USD (de-dup guard): contains marketplace note exactly ONCE', () => {
    const source: TaxRateSource = {
      kind: 'region',
      rate: 0,
      region: 'US',
      rateAsOf: '2025-01-01',
      lastVerified: '2026-05-21',
      note: US_NOTE_FIXTURE,
    };
    const result = tooltipForSource(source, 'USD');
    expect(result).toContain('From your region (US');
    expect(result).toContain('marketplaces');
    // de-dup guard: source.note already carries the US string, so the USD-append
    // step MUST skip — otherwise we get the note twice.
    expect(result.split('marketplaces').length - 1).toBe(1);
  });

  it('eu-average + EUR: contains EU midpoint text and NOT the marketplace note', () => {
    const source: TaxRateSource = {
      kind: 'eu-average',
      rate: 21,
      note: 'EU midpoint rate — verify for your country',
    };
    const result = tooltipForSource(source, 'EUR');
    expect(result).toContain('EU midpoint rate');
    expect(result).not.toContain('marketplaces');
  });

  it('manual + non-USD: contains Unknown region text and NOT the marketplace note', () => {
    const source: TaxRateSource = { kind: 'manual', rate: 0 };
    const result = tooltipForSource(source, 'CAD');
    expect(result).toContain('Unknown region');
    expect(result).not.toContain('marketplaces');
  });

  it('manual + USD: appends the marketplace-facilitator note (D-13 even for manual sentinel)', () => {
    const source: TaxRateSource = { kind: 'manual', rate: 0 };
    const result = tooltipForSource(source, 'USD');
    expect(result).toContain('Unknown region');
    expect(result).toContain('marketplaces');
  });
});
