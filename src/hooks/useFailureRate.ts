import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { deriveFailureRate, type DerivedFailureRate } from '../db/failureRate';
import { useFailureEvents } from './useFailureEvents';
import type { PrintJob } from '../types';

const EMPTY_JOBS: PrintJob[] = [];

/**
 * Phase 39 FAIL-02 — READ-ONLY hook wiring deriveFailureRate to live Dexie
 * data. Queries jobs with an INDEXED `where('printerInstanceId')` scope
 * (Pitfall 4 — never a full `.toArray()` over every saved job) and combines
 * that indexed subset with the live failureEvents ledger via useMemo.
 *
 * This hook never writes to Dexie. It is intended to be called from the
 * Plan 05 calculator orchestrator (CostCalculator's derived-values layer),
 * not from inside a section component — see 39-02-PLAN.md Task 1.
 *
 * Examples:
 *   useFailureRate('printer-1', 'pla')
 *     → { rate: 30, sampleSize: 10, provenance: 'exact' }   (>=5 combined attempts)
 *   useFailureRate('printer-1', 'petg')   // fewer than 5 attempts, printer also thin
 *     → null
 */
export function useFailureRate(
  printerInstanceId: string | undefined,
  materialId: string | undefined,
): DerivedFailureRate | null {
  const { events: failures } = useFailureEvents();

  // Indexed scope: only jobs for this specific printer instance are fetched,
  // never the full jobs table. Skipped entirely (empty query) when no
  // printerInstanceId is selected yet.
  const jobsForPrinter = useLiveQuery(
    () => (printerInstanceId
      ? db.jobs.where('printerInstanceId').equals(printerInstanceId).toArray()
      : Promise.resolve(EMPTY_JOBS)),
    [printerInstanceId],
    EMPTY_JOBS,
  );

  return useMemo(() => {
    if (!printerInstanceId || !materialId) return null;
    return deriveFailureRate(failures, jobsForPrinter, printerInstanceId, materialId);
  }, [failures, jobsForPrinter, printerInstanceId, materialId]);
}
