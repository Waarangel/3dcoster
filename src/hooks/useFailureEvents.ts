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
 * additionally writes a paired stockEvent deduction when a jobId + gramsWasted
 * are both present (D-03) — standalone failures (no jobId) skip stock
 * deduction unless gramsWasted is explicitly supplied.
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
    await db.failureEvents.add({ ...input, id });

    // D-03: only deduct stock when this failure is tied to a saved job AND a
    // gramsWasted amount was computed/entered. Standalone failures (no jobId)
    // have no asset to deduct against unless the user also supplies one.
    if (input.jobId && input.gramsWasted !== undefined && input.gramsWasted > 0) {
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

    return id;
  }, []);

  const deleteFailure = useCallback(async (id: string): Promise<void> => {
    await db.failureEvents.delete(id);
    // Self-correcting reversal: delete the paired stockEvent (if any) by its
    // deterministic refId. No-op (Dexie delete on a missing key is a no-op)
    // for standalone failures that never wrote one.
    await db.stockEvents.delete(failureStockRefId(id));
  }, []);

  return { events, logFailure, deleteFailure };
}
