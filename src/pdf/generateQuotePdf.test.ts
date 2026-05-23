import { describe, it, expect } from 'vitest';
import type { PrintJob, UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Wave 0 scaffold — Phase 16 PDF-02 integration coverage
// These tests are scaffolded with it.todo() to ensure the file compiles and
// vitest runs green today. Real assertions will be flipped in plan 03 once
// src/pdf/generateQuotePdf.ts exists.
// ---------------------------------------------------------------------------

// Minimal fixture helpers — mirrors makePrinter() in costCalc.test.ts pattern.
// Cast with `as PrintJob` / `as UserProfile` to satisfy TS without all required fields.
function makeJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-1',
    name: 'Test Print',
    createdAt: new Date('2026-05-23'),
    updatedAt: new Date('2026-05-23'),
    filaments: [],
    printTimeHours: 2,
    printerInstanceId: 'instance-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 5.00,
    sellingPrice: 15.00,
    copiesSold: 0,
    ...overrides,
  } as PrintJob;
}

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    currency: 'USD',
    laborHourlyRate: 20,
    ...overrides,
  } as UserProfile;
}

// Scaffold tests — exported for use in plan 03 when assertions are flipped.
export { makeJob, makeUserProfile };

describe('generateQuotePdf', () => {
  it.todo('output starts with %PDF- magic bytes');
  it.todo('PDF contains the formatted quote number (e.g. Q-0042)');
  it.todo('PDF includes the customer block when sale.customer is provided');
  it.todo('PDF omits the customer block when no customer is provided');
  it.todo('PDF shows Tax row when taxRate > 0 and hides it when taxRate === 0');
  it.todo('PDF Notes/Terms section omits when both PrintJob.notes and UserProfile.defaultTerms are empty');

  // Scaffold: proves the test file runs green today even without the generator
  it('scaffold: fixture helpers produce valid minimal objects', () => {
    const job = makeJob({ sellingPrice: 20.00, quoteNumber: 42 });
    const profile = makeUserProfile({ nextQuoteNumber: 43 });
    expect(job.sellingPrice).toBe(20.00);
    expect(job.quoteNumber).toBe(42);
    expect(profile.nextQuoteNumber).toBe(43);
  });
});
