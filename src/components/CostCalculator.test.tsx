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
// FIX-04: Edit-job scroll-to-banner (Phase 34, plan 02)
//
// These are source-contract tests — they verify that CostCalculator.tsx
// contains the implementation contract for the scroll behavior, following the
// established pattern in this test file (see D-21 tax regression tests below).
//
// Why source-contract: CostCalculator depends on Dexie + ~30 props and is
// not mounted in this test suite. The existing test pattern for this file is
// source-level analysis (D-21 below), so we follow the same approach.
// ---------------------------------------------------------------------------

describe('FIX-04 edit-job scroll-to-banner', () => {
  const COST_CALC_SRC = readFileSync(
    resolve(__dirname, 'CostCalculator.tsx'),
    'utf8',
  );

  // Test 1: banner ref is attached to the editing-banner div and scrollIntoView is called
  // when editingJob becomes set (the effect fires on editingJob).
  it('source: scrollIntoView called in effect keyed on editingJob when truthy', () => {
    // The implementation must contain a scrollIntoView call
    expect(COST_CALC_SRC).toContain('scrollIntoView');
    // The effect must be keyed on editingJob (or editingJob?.id)
    expect(COST_CALC_SRC).toMatch(/useEffect\s*\(/);
    // The scroll must be guarded on editingJob being truthy
    expect(COST_CALC_SRC).toMatch(/editingJob.*scrollIntoView|scrollIntoView.*editingJob/s);
  });

  // Test 2: reduced-motion gating — behavior is non-smooth when matchMedia matches
  it('source: scrollIntoView behavior gated on matchMedia prefers-reduced-motion', () => {
    expect(COST_CALC_SRC).toContain('prefers-reduced-motion');
    expect(COST_CALC_SRC).toContain('matchMedia');
    // smooth or auto behavior based on media query
    expect(COST_CALC_SRC).toContain("'smooth'");
    expect(COST_CALC_SRC).toMatch(/'auto'|'instant'/);
  });

  // Test 3: null guard — no scroll fires when editingJob is null (effect guards truthy editingJob)
  it('source: scroll effect is guarded so it does not fire when editingJob is null', () => {
    // The effect must check ref.current (null guard for unmounted state)
    expect(COST_CALC_SRC).toContain('bannerRef.current');
    // The effect body must only call scrollIntoView when editingJob is truthy
    // (i.e. there's a conditional inside or it's keyed only when truthy)
    const hasNullGuard = COST_CALC_SRC.includes('if (editingJob') ||
      COST_CALC_SRC.includes('if (!editingJob') ||
      COST_CALC_SRC.includes('editingJob &&');
    expect(hasNullGuard).toBe(true);
  });
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
