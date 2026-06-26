import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { deriveStockByAsset } from '../db/stockEvents';
import type { StockEvent } from '../types';

const EMPTY: StockEvent[] = [];

function newManualId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `manual-${crypto.randomUUID()}`
    : `manual-${Date.now()}`;
}

/**
 * Live inventory state derived from the stockEvents ledger.
 * `stockByAssetId` maps assetId → current stock (SUM of deltas, in the asset's
 * native unit — grams for filament, units otherwise). Job deductions are
 * written by useJobs; this hook is the read side plus manual adjustments.
 */
export function useStockEvents() {
  const events = useLiveQuery(() => db.stockEvents.toArray(), [], EMPTY);
  const stockByAssetId = useMemo(() => deriveStockByAsset(events), [events]);

  // Hand-entered stock change — e.g. "bought a new spool" (positive delta) or a
  // correction. Manual events use a fresh id as their own refId so the
  // job-keyed delete-by-refId never touches them.
  const logManualAdjustment = useCallback(async (assetId: string, delta: number, note?: string) => {
    // v1.9 DATA-06: reject a non-finite delta (NaN/±Infinity from a bad
    // parseFloat upstream). Writing one would poison deriveStockByAsset's SUM,
    // turning the asset's whole derived stock into NaN with no way to recover
    // short of editing IndexedDB. A no-op is the safe failure here.
    if (!Number.isFinite(delta)) {
      console.error(`[logManualAdjustment] ignored non-finite delta for asset ${assetId}:`, delta);
      return;
    }
    const id = newManualId();
    await db.stockEvents.add({ id, assetId, delta, kind: 'manual', refId: id, timestamp: new Date(), note });
  }, []);

  return { events, stockByAssetId, logManualAdjustment };
}
