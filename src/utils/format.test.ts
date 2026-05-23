import { describe, it } from 'vitest';

// ---------------------------------------------------------------------------
// Wave 0 scaffold — Phase 16 format utility coverage
// formatQuoteNumber + customerNameSlug don't exist yet (plan 02 adds them).
// Scaffolded with it.todo() so the file runs green today.
// Plan 02 will:
//   1. Create src/utils/format.ts with formatQuoteNumber + customerNameSlug
//   2. Replace these it.todo() calls with real import + assertions
// ---------------------------------------------------------------------------

describe('formatQuoteNumber', () => {
  it.todo("formatQuoteNumber(1) → 'Q-0001'");
  it.todo("formatQuoteNumber(42) → 'Q-0042'");
  it.todo("formatQuoteNumber(1000) → 'Q-1000'");
  it.todo("formatQuoteNumber(10000) → 'Q-10000' (acceptable overflow — more than 4 digits)");
});

describe('customerNameSlug', () => {
  it.todo("undefined → ''");
  it.todo("empty string → ''");
  it.todo("'Alice Test' → 'alice-test'");
  it.todo("'Ça va' → 'a-va' (strips non-ASCII characters)");
  it.todo('31-char name → 30-char slug (max 30 chars enforced)');
});
