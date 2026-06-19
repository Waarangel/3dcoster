import { describe, it, expect } from 'vitest';
import { buildJobStockEvents, deriveStockByAsset, type JobStockSource } from './stockEvents';
import type { StockEvent } from '../types';

const NOW = new Date('2026-06-19T12:00:00.000Z');

function job(partial: Partial<JobStockSource> & { id: string }): JobStockSource {
  return {
    filaments: [],
    materialsUsed: [],
    packagingMaterials: [],
    ...partial,
  };
}

describe('buildJobStockEvents', () => {
  it('emits one negative-delta event per filament, in grams', () => {
    const events = buildJobStockEvents(
      job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 120 }] }),
      NOW,
    );
    expect(events).toEqual([
      { id: 'j1__pla', assetId: 'pla', delta: -120, kind: 'job', refId: 'j1', timestamp: NOW },
    ]);
  });

  it('aggregates the same asset used across multiple rows', () => {
    const events = buildJobStockEvents(
      job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 80 }, { filamentId: 'pla', grams: 40 }] }),
      NOW,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ assetId: 'pla', delta: -120 });
  });

  it('deducts post-processing materials and packaging by quantity', () => {
    const events = buildJobStockEvents(
      job({
        id: 'j1',
        materialsUsed: [{ materialId: 'resin-clear', quantity: 3 }],
        packagingMaterials: [{ materialId: 'box-small', quantity: 1 }],
      }),
      NOW,
    );
    const byAsset = Object.fromEntries(events.map(e => [e.assetId, e.delta]));
    expect(byAsset).toEqual({ 'resin-clear': -3, 'box-small': -1 });
  });

  it('excludes packaging when includePackaging is false', () => {
    const events = buildJobStockEvents(
      job({ id: 'j1', packagingMaterials: [{ materialId: 'box-small', quantity: 2 }] }),
      NOW,
      { includePackaging: false },
    );
    expect(events).toHaveLength(0);
  });

  it('skips empty ids and non-positive quantities', () => {
    const events = buildJobStockEvents(
      job({
        id: 'j1',
        filaments: [{ filamentId: '', grams: 50 }, { filamentId: 'pla', grams: 0 }],
        materialsUsed: [{ materialId: 'x', quantity: 0 }, { materialId: 'y', quantity: -2 }],
      }),
      NOW,
    );
    expect(events).toEqual([]);
  });

  it('uses deterministic ids and the injected timestamp (idempotent re-save)', () => {
    const j = job({ id: 'j9', filaments: [{ filamentId: 'petg', grams: 200 }] });
    const first = buildJobStockEvents(j, NOW);
    const later = buildJobStockEvents(j, new Date('2026-07-01T00:00:00.000Z'));
    expect(first[0].id).toBe('j9__petg');
    expect(later[0].id).toBe('j9__petg'); // same id → replaces prior on re-save
    expect(later[0].timestamp).toEqual(new Date('2026-07-01T00:00:00.000Z'));
  });

  it('returns no events for a job that consumes nothing', () => {
    expect(buildJobStockEvents(job({ id: 'empty' }), NOW)).toEqual([]);
  });
});

describe('deriveStockByAsset', () => {
  const ev = (assetId: string, delta: number): StockEvent => ({
    id: `${assetId}-${delta}`, assetId, delta, kind: 'manual', refId: 'r', timestamp: NOW,
  });

  it('sums deltas per asset (stock in minus consumption)', () => {
    const map = deriveStockByAsset([ev('pla', 1000), ev('pla', -120), ev('petg', 500)]);
    expect(map.get('pla')).toBe(880);
    expect(map.get('petg')).toBe(500);
  });

  it('returns an empty map for no events', () => {
    expect(deriveStockByAsset([]).size).toBe(0);
  });

  it('can go negative when consumption exceeds recorded stock', () => {
    const map = deriveStockByAsset([ev('pla', 100), ev('pla', -250)]);
    expect(map.get('pla')).toBe(-150);
  });
});
