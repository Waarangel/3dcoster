// ---------------------------------------------------------------------------
// Phase 39 Plan 01 (Task 1) — locks the backupSchema contract extension for
// the two new v12 stores (failureEvents, maintenanceEvents). Complements the
// existing full-file round-trip coverage in backupExport.test.ts /
// backupRestore.test.ts by asserting the schema constants themselves are
// correct, independent of any Dexie instance.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  BACKUP_STORES,
  DATE_FIELDS,
  TOMBSTONE_DATE_FIELDS,
  SYNC_TOMBSTONE_RETENTION_DAYS,
  type BackupData,
  type SyncTombstone,
  type SyncFile,
  type SyncFileMeta,
} from './backupSchema';

describe('BACKUP_STORES (Phase 39 — new stores registered)', () => {
  it('includes failureEvents and maintenanceEvents', () => {
    expect(BACKUP_STORES).toContain('failureEvents');
    expect(BACKUP_STORES).toContain('maintenanceEvents');
  });

  it('still includes every pre-existing v11 store (additive only)', () => {
    const preExisting = [
      'materials', 'printers', 'printerInstances', 'jobs',
      'sales', 'settings', 'customers', 'quotes', 'stockEvents',
    ] as const;
    for (const store of preExisting) {
      expect(BACKUP_STORES).toContain(store);
    }
  });

  it('has exactly 11 stores (9 pre-existing + 2 new)', () => {
    expect(BACKUP_STORES).toHaveLength(11);
  });
});

describe('DATE_FIELDS (Phase 39 — new store date-field maps)', () => {
  // Phase 44-01 (SYNC-01, D-05) appended 'updatedAt' to every store's
  // DATE_FIELDS additively — these assertions now check containment rather
  // than exact equality (see the dedicated Phase 44-01 describe block below
  // for full updatedAt coverage).
  it('maps failureEvents to failedAt (plus updatedAt)', () => {
    expect(DATE_FIELDS.failureEvents).toContain('failedAt');
  });

  it('maps maintenanceEvents to occurredAt (plus updatedAt)', () => {
    expect(DATE_FIELDS.maintenanceEvents).toContain('occurredAt');
  });

  it('has a DATE_FIELDS entry for every BACKUP_STORES name (no drift)', () => {
    for (const store of BACKUP_STORES) {
      expect(DATE_FIELDS).toHaveProperty(store);
      expect(Array.isArray(DATE_FIELDS[store])).toBe(true);
    }
  });
});

describe('DATE_FIELDS.quotes (Phase 43-04 — hosted-quote publish metadata round-trips)', () => {
  it('includes publishedAt', () => {
    expect(DATE_FIELDS.quotes).toContain('publishedAt');
  });

  it('includes hostedDecisionAt', () => {
    expect(DATE_FIELDS.quotes).toContain('hostedDecisionAt');
  });

  it('includes hostedExpiresAt (Rule 1: same round-trip requirement as the other two Date fields)', () => {
    expect(DATE_FIELDS.quotes).toContain('hostedExpiresAt');
  });

  it('still includes every pre-existing quotes Date field (additive only)', () => {
    for (const field of ['createdAt', 'sentAt', 'decisionAt', 'convertedAt']) {
      expect(DATE_FIELDS.quotes).toContain(field);
    }
  });
});

describe('BackupData shape (Phase 39 — type-level contract)', () => {
  it('accepts an object literal with failureEvents and maintenanceEvents arrays', () => {
    // Type-level assertion: this will fail to compile (tsc -b) if the
    // BackupData interface does not declare these two fields.
    const sample: BackupData = {
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
    expect(Array.isArray(sample.failureEvents)).toBe(true);
    expect(Array.isArray(sample.maintenanceEvents)).toBe(true);
  });
});

describe('DATE_FIELDS (Phase 44-01 SYNC-01 — updatedAt on every store, D-05)', () => {
  it('includes updatedAt for every BACKUP_STORES entry', () => {
    for (const store of BACKUP_STORES) {
      expect(DATE_FIELDS[store]).toContain('updatedAt');
    }
  });

  it('materials keeps openedAt AND gains updatedAt (additive, not replaced)', () => {
    expect(DATE_FIELDS.materials).toContain('updatedAt');
    expect(DATE_FIELDS.materials).toContain('openedAt');
  });

  it('printerInstances keeps purchaseDate AND gains updatedAt', () => {
    expect(DATE_FIELDS.printerInstances).toContain('updatedAt');
    expect(DATE_FIELDS.printerInstances).toContain('purchaseDate');
  });

  it('sales keeps soldAt AND gains updatedAt', () => {
    expect(DATE_FIELDS.sales).toContain('updatedAt');
    expect(DATE_FIELDS.sales).toContain('soldAt');
  });

  it('customers keeps createdAt/lastUsedAt AND gains updatedAt', () => {
    expect(DATE_FIELDS.customers).toContain('updatedAt');
    expect(DATE_FIELDS.customers).toContain('createdAt');
    expect(DATE_FIELDS.customers).toContain('lastUsedAt');
  });

  it('quotes keeps its existing Date fields AND gains updatedAt', () => {
    expect(DATE_FIELDS.quotes).toContain('updatedAt');
    for (const field of ['createdAt', 'sentAt', 'decisionAt', 'convertedAt', 'publishedAt', 'hostedDecisionAt', 'hostedExpiresAt']) {
      expect(DATE_FIELDS.quotes).toContain(field);
    }
  });

  it('stockEvents keeps timestamp AND gains updatedAt', () => {
    expect(DATE_FIELDS.stockEvents).toContain('updatedAt');
    expect(DATE_FIELDS.stockEvents).toContain('timestamp');
  });

  it('failureEvents keeps failedAt AND gains updatedAt', () => {
    expect(DATE_FIELDS.failureEvents).toContain('updatedAt');
    expect(DATE_FIELDS.failureEvents).toContain('failedAt');
  });

  it('maintenanceEvents keeps occurredAt AND gains updatedAt', () => {
    expect(DATE_FIELDS.maintenanceEvents).toContain('updatedAt');
    expect(DATE_FIELDS.maintenanceEvents).toContain('occurredAt');
  });

  it('jobs already had updatedAt (unchanged) AND keeps createdAt', () => {
    expect(DATE_FIELDS.jobs).toContain('updatedAt');
    expect(DATE_FIELDS.jobs).toContain('createdAt');
  });

  it('settings gains updatedAt (row-level LWW support for 44-03)', () => {
    expect(DATE_FIELDS.settings).toContain('updatedAt');
  });

  it('printers gains updatedAt', () => {
    expect(DATE_FIELDS.printers).toContain('updatedAt');
  });
});

describe('SyncTombstone / TOMBSTONE_DATE_FIELDS (Phase 44-01 SYNC-01, D-06)', () => {
  it('a SyncTombstone value type-checks with id/store/deletedAt', () => {
    const tombstone: SyncTombstone = {
      id: 'abc123',
      store: 'jobs',
      deletedAt: new Date('2026-07-17T00:00:00.000Z'),
    };
    expect(tombstone.store).toBe('jobs');
  });

  it('TOMBSTONE_DATE_FIELDS lists deletedAt for rehydration', () => {
    expect(TOMBSTONE_DATE_FIELDS).toEqual(['deletedAt']);
  });
});

describe('SYNC_TOMBSTONE_RETENTION_DAYS (Phase 44-01 SYNC-01)', () => {
  it('is 90 days', () => {
    expect(SYNC_TOMBSTONE_RETENTION_DAYS).toBe(90);
  });
});

describe('SyncFile / SyncFileMeta (Phase 44-01 SYNC-01 — sync envelope = backup envelope + tombstones + syncMeta)', () => {
  it('a SyncFile value type-checks as BackupFile + tombstones + syncMeta', () => {
    const syncMeta: SyncFileMeta = {
      deviceId: 'device-uuid-1',
      lastSyncedAt: '2026-07-17T00:00:00.000Z',
    };
    const syncFile: SyncFile = {
      meta: {
        backupFormatVersion: 1,
        appSchemaVersion: 12,
        appVersion: '2.0.0',
        exportedAt: '2026-07-17T00:00:00.000Z',
      },
      data: {
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
      },
      tombstones: [],
      syncMeta,
    };
    expect(syncFile.syncMeta.deviceId).toBe('device-uuid-1');
    expect(Array.isArray(syncFile.tombstones)).toBe(true);
  });
});
