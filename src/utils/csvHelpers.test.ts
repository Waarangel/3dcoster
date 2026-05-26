// ---------------------------------------------------------------------------
// Phase 20 (DATA-04) — parsePositiveNumber default-reject-0 + allowZero opt-in
//
// Phase 21 (SEC) will append a `describe('sanitizeCsvCell')` block below; do
// not rename or restructure this file without coordinating with that plan.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parsePositiveNumber } from './csvHelpers';

describe('parsePositiveNumber', () => {
  // happy-path baselines
  it("'10' → 10", () => expect(parsePositiveNumber('10')).toBe(10));
  it("'10.5' → 10.5", () => expect(parsePositiveNumber('10.5')).toBe(10.5));

  // default behavior — rejects 0 (DATA-04 core requirement)
  it("'0' → null (default rejects zero per DATA-04)", () => {
    expect(parsePositiveNumber('0')).toBeNull();
  });
  it("'0.0' → null (default rejects zero — string variant)", () => {
    expect(parsePositiveNumber('0.0')).toBeNull();
  });

  // default rejects negatives (regression — current behavior maintained)
  it("'-1' → null", () => expect(parsePositiveNumber('-1')).toBeNull());
  it("'abc' → null", () => expect(parsePositiveNumber('abc')).toBeNull());
  it("undefined → null", () => expect(parsePositiveNumber(undefined)).toBeNull());
  it("'' → null", () => expect(parsePositiveNumber('')).toBeNull());
  it("'   ' → null (whitespace-only)", () => expect(parsePositiveNumber('   ')).toBeNull());

  // opt-in allowZero
  it("'0' with allowZero: true → 0 (packageCost free-packaging case)", () => {
    expect(parsePositiveNumber('0', { allowZero: true })).toBe(0);
  });
  it("'-0' with allowZero: true → 0", () => {
    // JavaScript Number('-0') === -0, which is === 0 — the helper accepts it
    expect(parsePositiveNumber('-0', { allowZero: true })).toBe(-0);
  });
  it("'-1' with allowZero: true → null (allowZero must NOT allow negatives)", () => {
    expect(parsePositiveNumber('-1', { allowZero: true })).toBeNull();
  });
});
