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

/** One filament's share of the waste on a multi-material job failure (WR-08). */
export interface FailureMaterialWaste {
  materialId: string;
  grams: number;
}

/**
 * `materialBreakdown` (WR-08) is a WRITE-TIME directive only — one stock
 * deduction per filament actually on the failed job, already scaled by
 * %completion by the caller. It is NOT persisted onto the FailureEvent row
 * (the stored ledger keeps the D-08 dominant `materialId` + total
 * `gramsWasted`). When absent, the whole gramsWasted deducts from
 * `materialId` (single-material jobs and standalone failures).
 */
export type LogFailureInput = Omit<FailureEvent, 'id'> & {
  materialBreakdown?: FailureMaterialWaste[];
};

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
    if (input.materialBreakdown?.some(e => !Number.isFinite(e.grams))) {
      console.error('[logFailure] ignored non-finite materialBreakdown grams:', input.materialBreakdown);
      return undefined;
    }

    // WR-08: the breakdown is a write-time directive, never a persisted field.
    const { materialBreakdown, ...event } = input;
    const deductions = (materialBreakdown ?? []).filter(e => e.materialId && e.grams > 0);

    const id = makeId('failure');

    // WR-01: the failure row and its paired stock deduction commit atomically —
    // a quota error / tab close / versionchange reload mid-write can no longer
    // leave a failure event without its deduction (which a retry would then
    // double-count under a fresh random id). Mirrors the v1.9 stock-atomicity
    // convention for job save/delete paths.
    await db.transaction('rw', db.failureEvents, db.stockEvents, async () => {
      await db.failureEvents.add({ ...event, id });

      if (deductions.length > 0) {
        // WR-08: multi-material job — one deduction per filament actually on
        // the job, scaled by %completion by the caller, instead of dumping the
        // job's TOTAL grams onto the single dominant material. Ids mirror the
        // v1.8 `${jobId}__${assetId}` per-asset convention; refId stays the
        // failure-keyed value so deleteFailure reverses the whole set.
        for (const entry of deductions) {
          await db.stockEvents.add({
            id: `${failureStockRefId(id)}__${entry.materialId}`,
            assetId: entry.materialId,
            delta: -entry.grams,
            kind: 'manual',
            refId: failureStockRefId(id),
            timestamp: event.failedAt,
            note: 'Failed print — filament waste',
          });
        }
      } else if (event.gramsWasted !== undefined && event.gramsWasted > 0) {
        // D-03: deduct stock whenever a gramsWasted amount was computed
        // (job-linked, single material) or explicitly entered (standalone).
        await db.stockEvents.add({
          id: failureStockRefId(id),
          assetId: event.materialId,
          delta: -event.gramsWasted,
          kind: 'manual',
          refId: failureStockRefId(id),
          timestamp: event.failedAt,
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
      // Self-correcting reversal: delete every paired stockEvent (if any) by
      // the deterministic refId — covers both the single-deduction shape and
      // the WR-08 per-material set. No-op for standalone failures that never
      // wrote one (a where().delete() on no matches deletes nothing).
      await db.stockEvents.where('refId').equals(failureStockRefId(id)).delete();
    });
  }, []);

  return { events, logFailure, deleteFailure };
}
