// ---------------------------------------------------------------------------
// Inventory ledger — pure helpers (v1.8, feature #20). No Dexie import here so
// the consumption/derivation logic is unit-testable in isolation; the Dexie
// read/write wrappers live alongside the hooks. See docs/V1.8_PLAN.md.
// ---------------------------------------------------------------------------
import type { PrintJob, MaterialUsage, StockEvent } from '../types';

/** The subset of a job needed to compute its stock consumption. */
export type JobStockSource = Pick<PrintJob, 'id' | 'filaments' | 'materialsUsed' | 'packagingMaterials'>;

export interface BuildJobStockEventsOptions {
  /** Deduct packaging materials too (boxes, tape, labels). Default true. */
  includePackaging?: boolean;
}

/**
 * Build the stock-deduction events a job produces — one negative-delta event
 * per consumed asset, aggregated across rows (a filament used in two rows
 * deducts the sum). Filament consumes grams; other materials consume their
 * `quantity` (the asset's own unit). `now` is injected so this stays pure.
 *
 * The id is deterministic (`${jobId}__${assetId}`): the Dexie writer deletes a
 * job's prior events before inserting these, so create / edit / delete all
 * converge on "the ledger reflects the job's current saved state" with no
 * double-counting. Zero/empty lines are skipped.
 *
 * Examples:
 *   buildJobStockEvents({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 120 }],
 *     materialsUsed: [], packagingMaterials: [] }, now)
 *     → [{ id: 'j1__pla', assetId: 'pla', delta: -120, kind: 'job', refId: 'j1', timestamp: now }]
 *
 *   // same asset across two rows aggregates:
 *   buildJobStockEvents({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 80 },
 *     { filamentId: 'pla', grams: 40 }], materialsUsed: [], packagingMaterials: [] }, now)
 *     → [{ id: 'j1__pla', assetId: 'pla', delta: -120, ... }]
 */
export function buildJobStockEvents(
  job: JobStockSource,
  now: Date,
  options: BuildJobStockEventsOptions = {},
): StockEvent[] {
  const includePackaging = options.includePackaging ?? true;
  // assetId -> total amount consumed (positive)
  const consumed = new Map<string, number>();

  for (const f of job.filaments ?? []) {
    if (!f.filamentId || !(f.grams > 0)) continue;
    consumed.set(f.filamentId, (consumed.get(f.filamentId) ?? 0) + f.grams);
  }

  const addUsage = (list: MaterialUsage[] | undefined) => {
    for (const m of list ?? []) {
      if (!m.materialId || !(m.quantity > 0)) continue;
      consumed.set(m.materialId, (consumed.get(m.materialId) ?? 0) + m.quantity);
    }
  };
  addUsage(job.materialsUsed);
  if (includePackaging) addUsage(job.packagingMaterials);

  return [...consumed.entries()].map(([assetId, amount]) => ({
    id: `${job.id}__${assetId}`,
    assetId,
    delta: -amount,
    kind: 'job' as const,
    refId: job.id,
    timestamp: now,
  }));
}

/**
 * Derive current stock per asset from a ledger: SUM(delta) per assetId.
 * Positive = in stock. Assets with no events are simply absent from the map.
 *
 * Examples:
 *   deriveStockByAsset([
 *     { assetId: 'pla', delta: 1000, ... },   // bought a spool
 *     { assetId: 'pla', delta: -120, ... },   // a job consumed 120g
 *   ]) → Map { 'pla' => 880 }
 */
export function deriveStockByAsset(events: readonly StockEvent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of events) {
    map.set(e.assetId, (map.get(e.assetId) ?? 0) + e.delta);
  }
  return map;
}
