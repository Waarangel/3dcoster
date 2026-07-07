import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { FailureEvent } from '../types';

const EMPTY: FailureEvent[] = [];

function makeId(prefix: string): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`;
}

/** Deterministic refId for the paired stockEvent a failure log writes when it
 *  deducts wasted filament — lets deleteFailure find and remove the same
 *  stockEvent by construction, mirroring the v1.8 job-keyed deduct/reversal
 *  convention (buildJobStockEvents' `${jobId}__${assetId}` id scheme). */
function failureStockRefId(failureId: string): string {
  return `failure-${failureId}`;
}

export type LogFailureInput = Omit<FailureEvent, 'id'>;

/**
 * Live failureEvents ledger (Phase 39 FAIL-01..04). Read side is a plain
 * useLiveQuery; write side guards every numeric field with Number.isFinite
 * before the Dexie write (v1.9 DATA-06 convention from useStockEvents), and
 * additionally writes a paired stockEvent deduction whenever gramsWasted > 0
 * is supplied (D-03) — job-linked (computed from %completion) or standalone
 * (user-entered). Standalone failures without gramsWasted skip deduction.
 */
export function useFailureEvents() {
  const events = useLiveQuery(() => db.failureEvents.toArray(), [], EMPTY);

  const logFailure = useCallback(async (input: LogFailureInput): Promise<string | undefined> => {
    if (!Number.isFinite(input.percentComplete)) {
      console.error('[logFailure] ignored non-finite percentComplete:', input.percentComplete);
      return undefined;
    }
    if (input.gramsWasted !== undefined && !Number.isFinite(input.gramsWasted)) {
      console.error('[logFailure] ignored non-finite gramsWasted:', input.gramsWasted);
      return undefined;
    }

    const id = makeId('failure');

    // WR-01: the failure row and its paired stock deduction commit atomically —
    // a quota error / tab close / versionchange reload mid-write can no longer
    // leave a failure event without its deduction (which a retry would then
    // double-count under a fresh random id). Mirrors the v1.9 stock-atomicity
    // convention for job save/delete paths.
    await db.transaction('rw', db.failureEvents, db.stockEvents, async () => {
      await db.failureEvents.add({ ...input, id });

      // D-03: deduct stock whenever a gramsWasted amount was computed (job-linked)
      // or explicitly entered (standalone) — materialId is always present, so a
      // standalone failure with grams deducts against the selected material too.
      if (input.gramsWasted !== undefined && input.gramsWasted > 0) {
        await db.stockEvents.add({
          id: failureStockRefId(id),
          assetId: input.materialId,
          delta: -input.gramsWasted,
          kind: 'manual',
          refId: failureStockRefId(id),
          timestamp: input.failedAt,
          note: 'Failed print — filament waste',
        });
      }
    });

    return id;
  }, []);

  const deleteFailure = useCallback(async (id: string): Promise<void> => {
    // WR-01: delete + reversal are atomic — a failed reversal rolls the whole
    // delete back instead of orphaning the deduction forever.
    await db.transaction('rw', db.failureEvents, db.stockEvents, async () => {
      await db.failureEvents.delete(id);
      // Self-correcting reversal: delete the paired stockEvent (if any) by its
      // deterministic refId. No-op (Dexie delete on a missing key is a no-op)
      // for standalone failures that never wrote one.
      await db.stockEvents.delete(failureStockRefId(id));
    });
  }, []);

  return { events, logFailure, deleteFailure };
}
