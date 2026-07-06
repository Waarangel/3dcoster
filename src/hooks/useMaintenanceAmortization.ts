import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  deriveMaintenanceAmortization,
  predictNextSwap,
  type MaintenanceAmortization,
  type NextSwapPrediction,
} from '../db/maintenanceAmortization';
import type { Asset, MaintenanceEvent, PrintJob, PrinterInstance } from '../types';

const EMPTY_EVENTS: MaintenanceEvent[] = [];
const EMPTY_JOBS: PrintJob[] = [];
const EMPTY_ASSETS: Asset[] = [];

export interface UseMaintenanceAmortizationResult {
  amortization: MaintenanceAmortization | null;
  nextSwap: Record<MaintenanceEvent['partType'], NextSwapPrediction | null>;
}

/**
 * Read-only, index-scoped derivation hook for a single printer instance's
 * maintenance amortization + next-swap prediction (Phase 39 WEAR-01/02,
 * D-14/D-15). Queries db.maintenanceEvents + the instance-scoped subset of
 * db.jobs (Pitfall 4 in 39-RESEARCH.md — index-scoped `.where()`, not
 * `.toArray()` on the whole table) and db.materials (for abrasive-hours'
 * dominant-filament lookup).
 *
 * MUST be called in the orchestrator (App-level container / PrinterSettings
 * container), never inside a calculator section component — this hook writes
 * nothing to Dexie, it is purely derived data for display.
 */
export function useMaintenanceAmortization(instance: PrinterInstance | undefined): UseMaintenanceAmortizationResult {
  const events = useLiveQuery(() => db.maintenanceEvents.toArray(), [], EMPTY_EVENTS);

  const instanceJobs = useLiveQuery(
    () =>
      instance
        ? db.jobs.where('printerInstanceId').equals(instance.id).toArray()
        : Promise.resolve(EMPTY_JOBS),
    [instance?.id],
    EMPTY_JOBS,
  );

  const assets = useLiveQuery(() => db.materials.toArray(), [], EMPTY_ASSETS);

  const assetsById = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);

  const amortization = useMemo(() => {
    if (!instance) return null;
    return deriveMaintenanceAmortization(events, instanceJobs, instance, assetsById);
  }, [events, instanceJobs, instance, assetsById]);

  const nextSwap = useMemo(() => {
    if (!instance) {
      return { nozzle: null, belt: null, bed: null, other: null } as Record<
        MaintenanceEvent['partType'],
        NextSwapPrediction | null
      >;
    }
    return predictNextSwap(events, instanceJobs, instance);
  }, [events, instanceJobs, instance]);

  return { amortization, nextSwap };
}
