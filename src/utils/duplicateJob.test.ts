import { describe, it, expect } from 'vitest';
import { duplicateJob, nextCopyName } from './duplicateJob';
import type { PrintJob } from '../types';

// Fixture factory mirrored from src/db/backfill.test.ts:46-65 (DUP-02 D-15 lock).
// Kept structurally identical so future PrintJob field additions force a parallel
// review in both files at the same time.
function makeMinimalJob(overrides: Partial<PrintJob>): PrintJob {
  return {
    id: 'job-x',
    name: 'Job X',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    filaments: [],
    printTimeHours: 1,
    printerInstanceId: 'p-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 1,
    sellingPrice: 10,
    copiesSold: 0,
    ...overrides,
  } as PrintJob;
}

// ---------------------------------------------------------------------------
// D-15 LOCKED test contract — CONTEXT.md lines 149-159 reproduced verbatim.
// Do NOT modify the assertion expressions below — they are the unit-test
// acceptance criteria for DUP-02 and are referenced by threat-model
// mitigation T-15-03. Shape refactoring (e.g., one it() per assertion,
// rename describe()) is permitted as long as every expect() line stays
// byte-identical and every threat-model mitigation remains locked.
// ---------------------------------------------------------------------------

describe('duplicateJob (DUP-02 D-15 locked contract)', () => {
  const jobWithCustomerAndTaxRate = makeMinimalJob({
    id: 'job-original',
    name: 'Original',
    createdAt: new Date('2026-01-01'),
    customer: { name: 'Alice', email: 'alice@example.com' },
    taxRate: 13,
    taxAmount: 1.30,
    copiesSold: 5,
    tags: ['phone-stand', 'pla'],
  });

  it('resets PII (customer) on the duplicate', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.customer).toBeUndefined();
  });

  it('resets taxRate on the duplicate', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.taxRate).toBeUndefined();
  });

  it('resets copiesSold to 0 on the duplicate', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.copiesSold).toBe(0);
  });

  it('rotates id — duplicate id differs from source id', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.id).not.toBe(jobWithCustomerAndTaxRate.id);
  });

  it('advances createdAt — duplicate is newer than source', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.createdAt.getTime()).toBeGreaterThan(jobWithCustomerAndTaxRate.createdAt.getTime());
  });

  it('preserves tags (TAGS-F3 lock)', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.tags).toEqual(jobWithCustomerAndTaxRate.tags);  // TAGS-F3 lock
  });
});

// ---------------------------------------------------------------------------
// D-09 explicit-allowlist consequences — by-value isolation for the array
// and object fields (filaments, materialsUsed, etsyChecks, packagingMaterials),
// plus quoteNumber RESET that wasn't covered by the D-15 6-assert block.
// ---------------------------------------------------------------------------

describe('duplicateJob — by-value isolation (D-09)', () => {
  it('filaments are deep-copied per row — mutating dup.filaments[0] does not mutate source.filaments[0]', () => {
    const source = makeMinimalJob({
      filaments: [{ filamentId: 'asset-1', grams: 25, pricePerGram: 0.05 }],
    });
    const dup = duplicateJob(source);

    expect(dup.filaments).not.toBe(source.filaments);
    expect(dup.filaments[0]).not.toBe(source.filaments[0]);

    // Mutate the duplicate's filament row; the source row must remain untouched.
    dup.filaments[0].grams = 999;
    expect(source.filaments[0].grams).toBe(25);
  });

  it('materialsUsed are deep-copied per row', () => {
    const source = makeMinimalJob({
      materialsUsed: [{ materialId: 'asset-glue', quantity: 2 }],
    });
    const dup = duplicateJob(source);

    expect(dup.materialsUsed).not.toBe(source.materialsUsed);
    expect(dup.materialsUsed[0]).not.toBe(source.materialsUsed[0]);

    dup.materialsUsed[0].quantity = 999;
    expect(source.materialsUsed[0].quantity).toBe(2);
  });

  it('quoteNumber resets to undefined even when source had one', () => {
    const source = makeMinimalJob({ quoteNumber: 42 });
    const dup = duplicateJob(source);
    expect(dup.quoteNumber).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 47.1 MC-04 — one-off lines are CARRIED as independent per-row copies.
// Optional fields bypass the compile-error safeguard, so this test is the guard.
// ---------------------------------------------------------------------------

describe('duplicateJob — one-off cost lines (47.1 MC-04)', () => {
  it('carries manualMaterials and manualPackaging (incl. libraryPrompted) as independent copies', () => {
    const source = makeMinimalJob({
      manualMaterials: [{ id: 'm1', name: 'Auger', cost: 200, libraryPrompted: true }],
      manualPackaging: [{ id: 'p1', name: 'Gift wrap', cost: 3.5 }],
    });
    const dup = duplicateJob(source);

    expect(dup.manualMaterials).toEqual(source.manualMaterials);
    expect(dup.manualPackaging).toEqual(source.manualPackaging);
    expect(dup.manualMaterials).not.toBe(source.manualMaterials);
    expect(dup.manualPackaging).not.toBe(source.manualPackaging);
    expect(dup.manualMaterials?.[0]).not.toBe(source.manualMaterials?.[0]);
    expect(dup.manualPackaging?.[0]).not.toBe(source.manualPackaging?.[0]);

    // Editing the copy's lines never changes the source job.
    (dup.manualMaterials as NonNullable<typeof dup.manualMaterials>)[0].name = 'Edited';
    (dup.manualPackaging as NonNullable<typeof dup.manualPackaging>)[0].cost = 99;
    expect(source.manualMaterials?.[0].name).toBe('Auger');
    expect(source.manualPackaging?.[0].cost).toBe(3.5);
  });

  it('leaves both fields undefined when the source has none', () => {
    const dup = duplicateJob(makeMinimalJob({}));
    expect(dup.manualMaterials).toBeUndefined();
    expect(dup.manualPackaging).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// D-08 collision-helper coverage: no-collision, single collision, 99-cap.
// ---------------------------------------------------------------------------

describe('nextCopyName (D-08 collision helper)', () => {
  it('returns "{base} (copy)" when no collision', () => {
    expect(nextCopyName('X', new Set())).toBe('X (copy)');
  });

  it('returns "{base} (copy 2)" when "(copy)" already exists', () => {
    expect(nextCopyName('X', new Set(['X (copy)']))).toBe('X (copy 2)');
  });

  it('caps at 99 when all 1-99 are taken', () => {
    // Build the full set: 'X (copy)' + 'X (copy 2)' through 'X (copy 99)'
    const taken = new Set<string>(['X (copy)']);
    for (let n = 2; n <= 99; n++) {
      taken.add(`X (copy ${n})`);
    }
    expect(nextCopyName('X', taken)).toBe('X (copy 99)');  // silent cap per D-08
  });
});
