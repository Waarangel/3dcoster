// ---------------------------------------------------------------------------
// Phase 44-01 (SYNC-01) — pure merge-planner tests. No fake-indexeddb: every
// case here is constructed plain records, since validateSyncFile/computeMerge
// perform NO Dexie I/O (that's plan 44-03's applyMerge executor).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { BACKUP_FORMAT_VERSION } from './backupSchema';
import { validateSyncFile, computeMerge, type MergeInput } from './syncMerge';

function validMeta() {
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    appSchemaVersion: 12,
    appVersion: '2.0.0',
    exportedAt: '2026-07-17T00:00:00.000Z',
  };
}

function emptyData(): Record<string, unknown[]> {
  return {
    materials: [],
    printers: [],
    printerInstances: [],
    jobs: [],
    sales: [],
    settings: [],
    customers: [],
    quotes: [],
    stockEvents: [],
    failureEvents: [],
    maintenanceEvents: [],
  };
}

function validSyncMeta() {
  return { deviceId: 'device-a', lastSyncedAt: '2026-07-01T00:00:00.000Z' };
}

describe('validateSyncFile — schema version gate (SYNC-01)', () => {
  it('accepts a sync file with matching backupFormatVersion', () => {
    const result = validateSyncFile({
      meta: validMeta(),
      data: emptyData(),
      tombstones: [],
      syncMeta: validSyncMeta(),
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a sync file whose backupFormatVersion differs, with a clear message', () => {
    const result = validateSyncFile({
      meta: { ...validMeta(), backupFormatVersion: 2 },
      data: emptyData(),
      tombstones: [],
      syncMeta: validSyncMeta(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain('different app version');
    }
  });

  it('rejects when tombstones is missing or not an array', () => {
    const result = validateSyncFile({
      meta: validMeta(),
      data: emptyData(),
      syncMeta: validSyncMeta(),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when syncMeta is missing', () => {
    const result = validateSyncFile({
      meta: validMeta(),
      data: emptyData(),
      tombstones: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('validateSyncFile — delegates structural + forbidden-key checks to validateBackupFile', () => {
  it('rejects a record carrying a __proto__ key (whole-file rejection)', () => {
    // JSON.parse creates __proto__ as a plain own property (mirrors a real
    // attack payload) — object-literal syntax would set the actual prototype
    // instead, which is a different (non-attack) shape.
    const evilRecord = JSON.parse('{"id":"m1","__proto__":{"evil":true}}');
    const data = emptyData();
    data.materials = [evilRecord];
    const result = validateSyncFile({
      meta: validMeta(),
      data,
      tombstones: [],
      syncMeta: validSyncMeta(),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when the data section is missing entirely', () => {
    const result = validateSyncFile({
      meta: validMeta(),
      tombstones: [],
      syncMeta: validSyncMeta(),
    });
    expect(result.ok).toBe(false);
  });
});

describe('computeMerge — last-write-wins (D-05)', () => {
  it('remote wins when its updatedAt is strictly newer', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-01') }] },
      remoteByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-10') }] },
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: '2026-06-01T00:00:00.000Z',
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.winnersByStore.jobs).toHaveLength(1);
    expect(plan.winnersByStore.jobs[0]).toMatchObject({ id: 'j1' });
    expect(plan.summary.jobs.updated).toBe(1);
    expect(plan.summary.jobs.added).toBe(0);
  });

  it('local wins (no write) on equal timestamps', () => {
    const sameTime = new Date('2026-07-10');
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: sameTime, tag: 'local' }] },
      remoteByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: sameTime, tag: 'remote' }] },
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: '2026-06-01T00:00:00.000Z',
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.winnersByStore.jobs).toHaveLength(0);
    expect(plan.summary.jobs.updated).toBe(0);
  });

  it('a record with no updatedAt loses to any stamped record', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1' }] }, // no updatedAt
      remoteByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-01-01') }] },
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.winnersByStore.jobs).toHaveLength(1);
    expect(plan.summary.jobs.updated).toBe(1);
  });

  it('remote-only record is added', () => {
    const input: MergeInput = {
      localByStore: emptyByStore(),
      remoteByStore: { ...emptyByStore(), jobs: [{ id: 'j2', updatedAt: new Date('2026-07-10') }] },
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.winnersByStore.jobs).toHaveLength(1);
    expect(plan.summary.jobs.added).toBe(1);
    expect(plan.summary.jobs.updated).toBe(0);
  });

  it('local-only record is left untouched', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j3', updatedAt: new Date('2026-07-10') }] },
      remoteByStore: emptyByStore(),
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.winnersByStore.jobs).toHaveLength(0);
    expect(plan.deleteIdsByStore.jobs).toHaveLength(0);
    expect(plan.summary.jobs.added).toBe(0);
    expect(plan.summary.jobs.updated).toBe(0);
  });

  it('settings records are keyed by "key", not "id"', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), settings: [{ key: 'targetWage', value: '20', updatedAt: new Date('2026-07-01') }] },
      remoteByStore: { ...emptyByStore(), settings: [{ key: 'targetWage', value: '25', updatedAt: new Date('2026-07-10') }] },
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.winnersByStore.settings).toHaveLength(1);
    expect(plan.winnersByStore.settings[0]).toMatchObject({ key: 'targetWage', value: '25' });
  });
});

describe('computeMerge — tombstone edit-wins (D-06)', () => {
  it('a remote tombstone deletes the local record when local has no newer edit', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-01') }] },
      remoteByStore: emptyByStore(),
      localTombstones: [],
      remoteTombstones: [{ id: 'j1', store: 'jobs', deletedAt: new Date('2026-07-10') }],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.deleteIdsByStore.jobs).toContain('j1');
    expect(plan.summary.jobs.deleted).toBe(1);
  });

  it('a remote tombstone deletes the local record when local has no updatedAt at all', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1' }] },
      remoteByStore: emptyByStore(),
      localTombstones: [],
      remoteTombstones: [{ id: 'j1', store: 'jobs', deletedAt: new Date('2026-07-10') }],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.deleteIdsByStore.jobs).toContain('j1');
  });

  it('local edit wins when local updatedAt is newer than the remote tombstone deletedAt', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-15') }] },
      remoteByStore: emptyByStore(),
      localTombstones: [],
      remoteTombstones: [{ id: 'j1', store: 'jobs', deletedAt: new Date('2026-07-10') }],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.deleteIdsByStore.jobs).toHaveLength(0);
    // Tombstone is dropped (superseded) — not carried forward for re-propagation.
    expect(plan.tombstonesToWrite.find(t => t.id === 'j1' && t.store === 'jobs')).toBeUndefined();
  });

  it('resurrects a locally-deleted record when the remote edit postdates the local tombstone', () => {
    const input: MergeInput = {
      localByStore: emptyByStore(),
      remoteByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-15') }] },
      localTombstones: [{ id: 'j1', store: 'jobs', deletedAt: new Date('2026-07-10') }],
      remoteTombstones: [],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.winnersByStore.jobs).toHaveLength(1);
    expect(plan.summary.jobs.added).toBe(1);
  });
});

describe('computeMerge — summary counts + conflicts (D-07)', () => {
  it('flags a conflict when both sides mutated the same id since lastSyncedAt', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-05') }] },
      remoteByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-10') }] },
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: '2026-07-01T00:00:00.000Z',
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.summary.jobs.conflicts).toBe(1);
  });

  it('does not flag a conflict when only one side mutated since lastSyncedAt', () => {
    const input: MergeInput = {
      localByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-06-15') }] },
      remoteByStore: { ...emptyByStore(), jobs: [{ id: 'j1', updatedAt: new Date('2026-07-10') }] },
      localTombstones: [],
      remoteTombstones: [],
      lastSyncedAt: '2026-07-01T00:00:00.000Z',
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.summary.jobs.conflicts).toBe(0);
  });
});

describe('computeMerge — tombstone retention pruning', () => {
  it('drops tombstones older than SYNC_TOMBSTONE_RETENTION_DAYS from tombstonesToWrite', () => {
    const input: MergeInput = {
      localByStore: emptyByStore(),
      remoteByStore: emptyByStore(),
      localTombstones: [{ id: 'old1', store: 'jobs', deletedAt: new Date('2020-01-01') }],
      remoteTombstones: [],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.tombstonesToWrite.find(t => t.id === 'old1')).toBeUndefined();
  });

  it('keeps tombstones within the retention window', () => {
    const input: MergeInput = {
      localByStore: emptyByStore(),
      remoteByStore: emptyByStore(),
      localTombstones: [{ id: 'recent1', store: 'jobs', deletedAt: new Date('2026-07-01') }],
      remoteTombstones: [],
      lastSyncedAt: undefined,
      now: new Date('2026-07-17'),
    };
    const plan = computeMerge(input);
    expect(plan.tombstonesToWrite.find(t => t.id === 'recent1')).toBeDefined();
  });
});

function emptyByStore(): MergeInput['localByStore'] {
  return {
    materials: [],
    printers: [],
    printerInstances: [],
    jobs: [],
    sales: [],
    settings: [],
    customers: [],
    quotes: [],
    stockEvents: [],
    failureEvents: [],
    maintenanceEvents: [],
  };
}
