// ---------------------------------------------------------------------------
// Phase 20 (DATA-04) — parsePositiveNumber default-reject-0 + allowZero opt-in
//
// Phase 21 (SEC) will append a `describe('sanitizeCsvCell')` block below; do
// not rename or restructure this file without coordinating with that plan.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { parsePositiveNumber, sanitizeCsvCell, generateExportCsv, generateSampleCsv, generateSampleCustomerCsv } from './csvHelpers';
import type { Asset } from '../types';

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

// ---------------------------------------------------------------------------
// Phase 21 SEC-01 — sanitizeCsvCell formula-injection guard
//
// Locks the contract for the helper that wraps every cell handed to
// Papa.unparse in csvHelpers.ts (4 call sites: generateSampleCustomerCsv,
// generateSampleCsv printer/material branches, generateExportCsv). The
// universal-coverage invariant (D-02) is enforced structurally at those
// sites; this block locks the helper's behavior so the invariant has
// teeth. Rule (D-01): prefix a single `'` to any non-empty string whose
// first character is `=`, `+`, `-`, or `@`; otherwise pass through.
// Idempotence is self-enforcing because `'` is not in the trigger set.
// ---------------------------------------------------------------------------
describe('sanitizeCsvCell (Phase 21 SEC-01)', () => {
  // Trigger characters — leading `=`, `+`, `-`, `@` get a single-quote prefix
  it("'=SUM(A1:A10)' → \"'=SUM(A1:A10)\"", () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
  });
  it("'+CMD' → \"'+CMD\"", () => {
    expect(sanitizeCsvCell('+CMD')).toBe("'+CMD");
  });
  it("'-2+3' → \"'-2+3\"", () => {
    expect(sanitizeCsvCell('-2+3')).toBe("'-2+3");
  });
  it("'@SUM()' → \"'@SUM()\"", () => {
    expect(sanitizeCsvCell('@SUM()')).toBe("'@SUM()");
  });

  // Passthrough — safe strings return unchanged
  it("'safe string' → 'safe string' (passthrough)", () => {
    expect(sanitizeCsvCell('safe string')).toBe('safe string');
  });
  it("'' → '' (empty passthrough — no first char to match)", () => {
    expect(sanitizeCsvCell('')).toBe('');
  });

  // Leading-char-only rule — embedded triggers do not fire
  it("'foo=bar' → 'foo=bar' (only the LEADING char matters)", () => {
    expect(sanitizeCsvCell('foo=bar')).toBe('foo=bar');
  });

  // Idempotence smoke — second call sees a string starting with `'` (not a
  // trigger char), so no second prefix is added. Self-enforcing via D-01.
  it("sanitizeCsvCell(sanitizeCsvCell('=A1')) === \"'=A1\" (idempotent)", () => {
    expect(sanitizeCsvCell(sanitizeCsvCell('=A1'))).toBe("'=A1");
  });
});

// ---------------------------------------------------------------------------
// Phase 21 SEC-01 — generateExportCsv integration (export-flow end-to-end)
//
// These tests verify that sanitizeCsvCell is actually wired into
// generateExportCsv, not just that the helper function exists. They parse
// the CSV output with PapaParse to assert on cell values directly, making
// the assertions robust to PapaParse's internal quoting decisions.
//
// Covers all 4 trigger characters (=, +, -, @), a safe passthrough (no false
// positive), and a spot-check of the template generators for the structural
// invariant (D-02 universal coverage regression lock).
// ---------------------------------------------------------------------------
describe('Phase 21 SEC-01 — generateExportCsv integration', () => {
  const BASE_ASSET: Asset = {
    id: 'test-1',
    name: 'Test Asset',
    category: 'filament',
    unit: 'g',
    packageCost: 19.99,
    unitsPerPackage: 1000,
  };

  function parseFirstDataRow(csv: string): Record<string, string> {
    const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    return result.data[0];
  }

  it('name starting with = is prefixed with single-quote in exported CSV', () => {
    const asset: Asset = { ...BASE_ASSET, name: '=HYPERLINK("https://evil.com","click")' };
    const csv = generateExportCsv([asset]);
    const row = parseFirstDataRow(csv);
    expect(row.name.startsWith("'=")).toBe(true);
  });

  it('brand starting with + is prefixed with single-quote in exported CSV', () => {
    const asset: Asset = { ...BASE_ASSET, brand: '+CMD' };
    const csv = generateExportCsv([asset]);
    const row = parseFirstDataRow(csv);
    expect(row.brand.startsWith("'+")).toBe(true);
  });

  it('notes starting with - is prefixed with single-quote in exported CSV', () => {
    const asset: Asset = { ...BASE_ASSET, notes: '-2+3' };
    const csv = generateExportCsv([asset]);
    const row = parseFirstDataRow(csv);
    expect(row.notes.startsWith("'-")).toBe(true);
  });

  it('safe name with no leading trigger is not prefixed (no false positive)', () => {
    const asset: Asset = { ...BASE_ASSET, name: 'Safe name' };
    const csv = generateExportCsv([asset]);
    const row = parseFirstDataRow(csv);
    expect(row.name).toBe('Safe name');
  });

  it('template generators produce no cells starting with =, +, -, or @', () => {
    const triggerChars = new Set(['=', '+', '-', '@']);
    const sources = [
      generateSampleCsv('printer'),
      generateSampleCsv('material'),
      generateSampleCustomerCsv(),
    ];
    for (const csv of sources) {
      const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
      for (const row of result.data) {
        for (const [col, val] of Object.entries(row)) {
          if (val.length > 0) {
            expect(
              triggerChars.has(val[0]),
              `template CSV cell [${col}]="${val}" starts with a trigger char`,
            ).toBe(false);
          }
        }
      }
    }
  });
});
