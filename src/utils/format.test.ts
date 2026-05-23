import { describe, it, expect } from 'vitest';
import { formatQuoteNumber, customerNameSlug } from './format';

// ---------------------------------------------------------------------------
// Phase 16 — format utility tests (Wave 1, Plan 02)
// ---------------------------------------------------------------------------

describe('formatQuoteNumber', () => {
  it("formatQuoteNumber(1) → 'Q-0001'", () => {
    expect(formatQuoteNumber(1)).toBe('Q-0001');
  });

  it("formatQuoteNumber(42) → 'Q-0042'", () => {
    expect(formatQuoteNumber(42)).toBe('Q-0042');
  });

  it("formatQuoteNumber(1000) → 'Q-1000'", () => {
    expect(formatQuoteNumber(1000)).toBe('Q-1000');
  });

  it("formatQuoteNumber(10000) → 'Q-10000' (acceptable overflow — more than 4 digits)", () => {
    expect(formatQuoteNumber(10000)).toBe('Q-10000');
  });

  it("formatQuoteNumber(0) → 'Q-0000' (edge case — counter seed is ?? 1, but defensive)", () => {
    expect(formatQuoteNumber(0)).toBe('Q-0000');
  });

  it("formatQuoteNumber(9999) → 'Q-9999' (maximum 4-digit value)", () => {
    expect(formatQuoteNumber(9999)).toBe('Q-9999');
  });

  it("formatQuoteNumber(100) → 'Q-0100' (3-digit padded to 4)", () => {
    expect(formatQuoteNumber(100)).toBe('Q-0100');
  });
});

describe('customerNameSlug', () => {
  it("undefined → ''", () => {
    expect(customerNameSlug(undefined)).toBe('');
  });

  it("empty string → ''", () => {
    expect(customerNameSlug('')).toBe('');
  });

  it("'Alice Test' → 'alice-test'", () => {
    expect(customerNameSlug('Alice Test')).toBe('alice-test');
  });

  it("'Acme Co.' → 'acme-co' (period stripped)", () => {
    expect(customerNameSlug('Acme Co.')).toBe('acme-co');
  });

  it("'Jean-François' → 'jean-franois' (accent stripped, hyphen preserved)", () => {
    expect(customerNameSlug('Jean-François')).toBe('jean-franois');
  });

  it("'Ça va' → 'a-va' (Ç stripped, space → hyphen)", () => {
    expect(customerNameSlug('Ça va')).toBe('a-va');
  });

  it("'A'.repeat(50) → 'a'.repeat(30) (capped at 30 chars)", () => {
    expect(customerNameSlug('A'.repeat(50))).toBe('a'.repeat(30));
  });

  it("'   ' → '' (whitespace-only → empty after strip)", () => {
    expect(customerNameSlug('   ')).toBe('');
  });
});
