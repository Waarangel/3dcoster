// ---------------------------------------------------------------------------
// Phase 39 Plan 01 (Task 1) — locks the backupSchema contract extension for
// the two new v12 stores (failureEvents, maintenanceEvents). Complements the
// existing full-file round-trip coverage in backupExport.test.ts /
// backupRestore.test.ts by asserting the schema constants themselves are
// correct, independent of any Dexie instance.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { BACKUP_STORES, DATE_FIELDS, type BackupData } from './backupSchema';

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
  it('maps failureEvents to ["failedAt"]', () => {
    expect(DATE_FIELDS.failureEvents).toEqual(['failedAt']);
  });

  it('maps maintenanceEvents to ["occurredAt"]', () => {
    expect(DATE_FIELDS.maintenanceEvents).toEqual(['occurredAt']);
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
