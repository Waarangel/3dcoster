// ---------------------------------------------------------------------------
// Empirical failure-rate derivation — pure helpers (Phase 39 FAIL-02). No
// Dexie/React import here, mirroring the src/db/stockEvents.ts convention —
// the derivation math is unit-testable in isolation; the Dexie/live-query
// wiring lives in src/hooks/useFailureRate.ts.
//
// Formula (D-05..D-08, see 39-RESEARCH.md / 39-PATTERNS.md):
//   rate = failures / (savedJobs + failures)               for a printer×material combo
//   D-06: hide the hint entirely below 5 combined attempts (savedJobs + failures)
//   D-07: if the exact combo is below threshold but the printer-level
//         (all materials on that printer) clears it, surface THAT rate with
//         provenance='printer-fallback'. There is no further cascade — a
//         global (all-printers) rate is NEVER computed or returned.
//   D-08: a job's "dominant material" is the FilamentUsage row with the
//         highest grams (ties resolve to the first row encountered).
// ---------------------------------------------------------------------------
import type { FailureEvent, PrintJob, FilamentUsage } from '../types';

/** Minimum combined attempts (saved jobs + failures) before a rate is surfaced (D-06). */
export const MIN_ATTEMPTS_THRESHOLD = 5;

export type FailureRateProvenance = 'exact' | 'printer-fallback';

export interface DerivedFailureRate {
  /** 0-100 percentage. */
  rate: number;
  /** Combined attempts (savedJobs + failures) backing this rate. */
  sampleSize: number;
  provenance: FailureRateProvenance;
}

/**
 * D-08: the FilamentUsage with the highest grams. Returns undefined for a job
 * with no filament rows (null-safe per Assumption A3) — callers must treat
 * "no dominant material" as "this job doesn't participate in any combo".
 *
 * Examples:
 *   dominantMaterialId({ filaments: [{ filamentId: 'pla', grams: 50 }, { filamentId: 'petg', grams: 120 }] })
 *     → 'petg'
 *   dominantMaterialId({ filaments: [] }) → undefined
 */
export function dominantMaterialId(job: Pick<PrintJob, 'filaments'>): string | undefined {
  const filaments = job.filaments ?? [];
  if (filaments.length === 0) return undefined;

  let best: FilamentUsage | undefined;
  for (const f of filaments) {
    if (!best || f.grams > best.grams) best = f;
  }
  return best?.filamentId;
}

/**
 * Counts "saved jobs" and "failures" for the given printerInstanceId, keyed by
 * the job's/failure's material — used internally to build both the exact
 * combo counts and the printer-level (all-materials) counts.
 */
function countAttempts(
  failures: readonly FailureEvent[],
  jobs: readonly PrintJob[],
  printerInstanceId: string,
  materialId?: string,
): { jobCount: number; failureCount: number } {
  let jobCount = 0;
  for (const job of jobs) {
    if (!job.printerInstanceId || job.printerInstanceId !== printerInstanceId) continue;
    if (materialId !== undefined) {
      const dominant = dominantMaterialId(job);
      if (dominant !== materialId) continue;
    }
    jobCount += 1;
  }

  let failureCount = 0;
  for (const f of failures) {
    if (!f.printerInstanceId || f.printerInstanceId !== printerInstanceId) continue;
    if (materialId !== undefined && f.materialId !== materialId) continue;
    failureCount += 1;
  }

  return { jobCount, failureCount };
}

/**
 * Derives the empirical failure rate for a printer×material combo (D-05..D-07).
 *
 * Examples:
 *   deriveFailureRate(3 failures, 7 jobs matching printer1×pla, 'printer1', 'pla')
 *     → { rate: 30, sampleSize: 10, provenance: 'exact' }
 *   deriveFailureRate(1 failure, 2 jobs matching printer1×pla — 3 total, below threshold,
 *     but printer1 has 6 total attempts across all materials)
 *     → { rate: <printer-level %>, sampleSize: 6, provenance: 'printer-fallback' }
 *   deriveFailureRate(0 failures, 2 jobs, printer with < 5 total attempts) → null
 */
export function deriveFailureRate(
  failures: readonly FailureEvent[],
  jobs: readonly PrintJob[],
  printerInstanceId: string,
  materialId: string,
): DerivedFailureRate | null {
  const exact = countAttempts(failures, jobs, printerInstanceId, materialId);
  const exactSample = exact.jobCount + exact.failureCount;

  if (exactSample >= MIN_ATTEMPTS_THRESHOLD) {
    return {
      rate: (exact.failureCount / exactSample) * 100,
      sampleSize: exactSample,
      provenance: 'exact',
    };
  }

  // D-07: one-level printer-wide fallback (all materials on this printer).
  // Never cascades further — no global all-printers rate is ever computed.
  const printerLevel = countAttempts(failures, jobs, printerInstanceId);
  const printerSample = printerLevel.jobCount + printerLevel.failureCount;

  if (printerSample >= MIN_ATTEMPTS_THRESHOLD) {
    return {
      rate: (printerLevel.failureCount / printerSample) * 100,
      sampleSize: printerSample,
      provenance: 'printer-fallback',
    };
  }

  return null;
}
