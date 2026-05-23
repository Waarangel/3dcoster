import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveTaxRate } from '../utils/taxResolution';
import { calculateTax } from '../utils/costCalc';

// ---------------------------------------------------------------------------
// CostCalculator — Generate PDF surface retired (Phase 16 gap closure, D-13)
// The PDF button subcomponent and its 4 disabled-state tests were removed here
// in 16-06 because the CostCalculator no longer surfaces PDF generation.
// The only PDF entry point is the Print Quote modal in JobsManager (D-14 + D-18).
// Tests for that surface live in JobsManager.test.tsx.
// ---------------------------------------------------------------------------

describe('CostCalculator', () => {
  it.todo('CostCalculator tests TBD — PDF button retired per D-13');
});

// ---------------------------------------------------------------------------
// D-21 tax save site regression (Phase 16-08, gap H)
// Locks the save-site contract: persisted job.taxRate must be the RESOLVED
// rate (post-fallback chain), NOT the raw form-state override. Previously
// `taxRate: taxRateOverride` saved `undefined` when the user left the field
// blank, even though the user's default tax rate was non-zero — silently
// undercharging the customer on the rendered PDF.
//
// Tests combine a source-contract check (proves the save sites use the
// correct expression) with a chain-contract check (proves the expression
// produces the right value for the bug scenarios).
// ---------------------------------------------------------------------------

describe('D-21 tax save site regression', () => {
  const COST_CALC_SRC = readFileSync(
    resolve(__dirname, 'CostCalculator.tsx'),
    'utf8',
  );

  it('source: zero occurrences of `taxRate: taxRateOverride` (raw form state must not be persisted)', () => {
    const matches = COST_CALC_SRC.match(/taxRate:\s*taxRateOverride/g) ?? [];
    expect(matches.length).toBe(0);
  });

  it('source: two occurrences of `taxRate: tax.ratePercent` (resolved rate persisted at both save sites)', () => {
    const matches = COST_CALC_SRC.match(/taxRate:\s*tax\.ratePercent/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('chain: blank override + 13% default + USD currency → ratePercent === 13 (the bug scenario)', () => {
    const source = resolveTaxRate({
      jobOverride: undefined,
      settingsDefault: 13,
      currency: 'USD',
      address: undefined,
    });
    const tax = calculateTax(100, source.rate);
    expect(tax.ratePercent).toBe(13);
    expect(tax.taxAmount).toBeGreaterThan(0);
  });

  it('chain: explicit 7% override + 13% default → ratePercent === 7 (override wins)', () => {
    const source = resolveTaxRate({
      jobOverride: 7,
      settingsDefault: 13,
      currency: 'USD',
      address: undefined,
    });
    const tax = calculateTax(100, source.rate);
    expect(tax.ratePercent).toBe(7);
  });

  it('chain: explicit 0% override + 13% default → ratePercent === 0 (explicit zero respected, not coerced as fallback trigger)', () => {
    const source = resolveTaxRate({
      jobOverride: 0,
      settingsDefault: 13,
      currency: 'USD',
      address: undefined,
    });
    const tax = calculateTax(100, source.rate);
    expect(tax.ratePercent).toBe(0);
    expect(tax.taxAmount).toBe(0);
  });
});
