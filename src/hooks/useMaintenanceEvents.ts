import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { MaintenanceEvent } from '../types';

const EMPTY: MaintenanceEvent[] = [];

function makeId(prefix: string): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`;
}

export type LogMaintenanceEventInput = Omit<MaintenanceEvent, 'id'>;

/**
 * Live maintenanceEvents ledger (Phase 39 WEAR-01/02). Mirrors the
 * useStockEvents/useFailureEvents three-part shape: useLiveQuery read,
 * useCallback writer with Number.isFinite guards on every numeric field
 * (cost, printerHoursAtEvent) before the Dexie write.
 */
export function useMaintenanceEvents() {
  const events = useLiveQuery(() => db.maintenanceEvents.toArray(), [], EMPTY);

  const logMaintenanceEvent = useCallback(async (input: LogMaintenanceEventInput): Promise<string | undefined> => {
    if (!Number.isFinite(input.cost)) {
      console.error('[logMaintenanceEvent] ignored non-finite cost:', input.cost);
      return undefined;
    }
    if (!Number.isFinite(input.printerHoursAtEvent)) {
      console.error('[logMaintenanceEvent] ignored non-finite printerHoursAtEvent:', input.printerHoursAtEvent);
      return undefined;
    }

    const id = makeId('maint');
    await db.maintenanceEvents.add({ ...input, id });
    return id;
  }, []);

  const deleteMaintenanceEvent = useCallback(async (id: string): Promise<void> => {
    await db.maintenanceEvents.delete(id);
  }, []);

  return { events, logMaintenanceEvent, deleteMaintenanceEvent };
}
