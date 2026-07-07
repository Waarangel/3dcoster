import { describe, it, expect } from 'vitest';
import { deriveFailureRate, dominantMaterialId } from './failureRate';
import type { FailureEvent, PrintJob } from '../types';

// ---------------------------------------------------------------------------
// deriveFailureRate — Phase 39 Plan 02 Task 1 (FAIL-02, D-05..D-08).
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-1',
    name: 'Test job',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    filaments: [{ filamentId: 'pla', grams: 100 }],
    printTimeHours: 2,
    printerInstanceId: 'printer-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 0,
    sellingPrice: 0,
    copiesSold: 0,
    ...overrides,
  } as PrintJob;
}

function makeFailure(overrides: Partial<FailureEvent> = {}): FailureEvent {
  return {
    id: 'failure-1',
    printerInstanceId: 'printer-1',
    materialId: 'pla',
    percentComplete: 40,
    reason: 'adhesion',
    failedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('deriveFailureRate', () => {
  it('returns the exact combo rate when combined attempts >= 5', () => {
    const jobs = Array.from({ length: 7 }, (_, i) => makeJob({ id: `job-${i}` }));
    const failures = Array.from({ length: 3 }, (_, i) => makeFailure({ id: `f-${i}` }));

    const result = deriveFailureRate(failures, jobs, 'printer-1', 'pla');

    expect(result).not.toBeNull();
    expect(result!.rate).toBeCloseTo(30.0, 5);
    expect(result!.sampleSize).toBe(10);
    expect(result!.provenance).toBe('exact');
  });

  it('returns null (hint hidden) when combined attempts < 5 and printer-fallback also < 5', () => {
    const jobs = [makeJob({ id: 'job-1' })];
    const failures = [makeFailure({ id: 'f-1' })];

    const result = deriveFailureRate(failures, jobs, 'printer-1', 'pla');

    expect(result).toBeNull();
  });

  it('falls back to printer-level rate (provenance printer-fallback) when the exact combo is below threshold but the printer clears it across materials', () => {
    // Exact combo (printer-1 x pla): 1 job + 1 failure = 2 attempts (below 5).
    const jobs = [
      makeJob({ id: 'job-pla', filaments: [{ filamentId: 'pla', grams: 100 }] }),
      // Other materials on the SAME printer bring the printer-level total to 6.
      makeJob({ id: 'job-petg-1', filaments: [{ filamentId: 'petg', grams: 100 }] }),
      makeJob({ id: 'job-petg-2', filaments: [{ filamentId: 'petg', grams: 100 }] }),
      makeJob({ id: 'job-petg-3', filaments: [{ filamentId: 'petg', grams: 100 }] }),
    ];
    const failures = [
      makeFailure({ id: 'f-pla', materialId: 'pla' }),
      makeFailure({ id: 'f-petg', materialId: 'petg' }),
    ];
    // printer-level total = 4 jobs + 2 failures = 6 attempts, 2 failures → 33.33%

    const result = deriveFailureRate(failures, jobs, 'printer-1', 'pla');

    expect(result).not.toBeNull();
    expect(result!.provenance).toBe('printer-fallback');
    expect(result!.sampleSize).toBe(6);
    expect(result!.rate).toBeCloseTo((2 / 6) * 100, 5);
  });

  it('never returns a global (all-printers) rate — only exact or one-level printer-fallback', () => {
    // Combo below threshold, printer-level ALSO below threshold (only 2 total
    // attempts on printer-1), but there is plenty of data on a DIFFERENT printer.
    const jobs = [
      makeJob({ id: 'job-1', printerInstanceId: 'printer-1' }),
      ...Array.from({ length: 10 }, (_, i) => makeJob({ id: `other-${i}`, printerInstanceId: 'printer-2' })),
    ];
    const failures = [makeFailure({ id: 'f-1', printerInstanceId: 'printer-1' })];

    const result = deriveFailureRate(failures, jobs, 'printer-1', 'pla');

    expect(result).toBeNull();
  });

  it('dominant material is the FilamentUsage with the highest grams', () => {
    const job = makeJob({
      filaments: [
        { filamentId: 'pla', grams: 50 },
        { filamentId: 'petg', grams: 120 },
        { filamentId: 'abs', grams: 10 },
      ],
    });

    expect(dominantMaterialId(job)).toBe('petg');
  });

  it('dominantMaterialId returns undefined for a job with no filaments (null-safe)', () => {
    const job = makeJob({ filaments: [] });
    expect(dominantMaterialId(job)).toBeUndefined();
  });

  it('is null-safe against jobs with a missing printerInstanceId', () => {
    const jobs = [makeJob({ printerInstanceId: '' as unknown as string })];
    const failures: FailureEvent[] = [];

    expect(() => deriveFailureRate(failures, jobs, 'printer-1', 'pla')).not.toThrow();
    expect(deriveFailureRate(failures, jobs, 'printer-1', 'pla')).toBeNull();
  });

  it('counts a job toward a combo only when its dominant material matches', () => {
    // 4 jobs dominant in petg + 1 failure in pla — pla combo should have 0 jobs, 1 failure = 1 attempt (below threshold).
    const jobs = Array.from({ length: 4 }, (_, i) =>
      makeJob({ id: `job-${i}`, filaments: [{ filamentId: 'petg', grams: 100 }] })
    );
    const failures = [makeFailure({ id: 'f-1', materialId: 'pla' })];

    const result = deriveFailureRate(failures, jobs, 'printer-1', 'pla');
    // exact combo: 0 jobs + 1 failure = 1 (below 5)
    // printer-fallback: 4 jobs + 1 failure = 5 (meets threshold)
    expect(result).not.toBeNull();
    expect(result!.provenance).toBe('printer-fallback');
    expect(result!.sampleSize).toBe(5);
  });
});
