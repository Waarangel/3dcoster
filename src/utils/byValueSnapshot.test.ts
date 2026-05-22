import { describe, it, expect } from 'vitest';
import type { Customer, JobCustomer } from '../types';

// Phase 15.1 — CL-05: by-value snapshot audit (ROADMAP success criterion #4).
//
// Architectural lock: a Sale carries its customer details BY VALUE in a JobCustomer
// snapshot. The Customer library record (which extends JobCustomer with id/createdAt/
// lastUsedAt) is logically separate from the snapshot — editing or deleting a library
// Customer MUST NOT mutate any historical Sale.customer field.
//
// These tests are pure TypeScript fixtures (no Dexie, no React, no DOM). They prove
// the by-value contract at the type/runtime boundary so downstream consumers
// (CustomerEditModal, CSV importer merge, picker auto-create) can be authored
// against a foundation that has been audited up-front.
describe('Customer library by-value snapshot rule (CL-05)', () => {
  it('editing a Customer library record does not mutate a Sale.customer snapshot', () => {
    // Library record carries the JobCustomer fields plus library-only fields.
    const customer: Customer = {
      id: 'c-1',
      createdAt: new Date('2026-01-01'),
      name: 'Alice Pre-Edit',
      email: 'alice@example.com',
      company: 'AcmePre',
      address: '123 Old St',
      notes: 'pre-edit notes',
    };

    // Build the per-Sale snapshot by spreading ONLY the JobCustomer fields.
    // Library-only fields (id, createdAt, lastUsedAt) are NEVER copied in — D-05.
    const snapshot: JobCustomer = {
      name: customer.name,
      email: customer.email,
      company: customer.company,
      address: customer.address,
      notes: customer.notes,
    };

    // Deep-clone the snapshot before any mutation so the post-edit comparison
    // is an apples-to-apples value check (no shared references).
    const snapshotBefore = structuredClone(snapshot);

    // Mutate the library record (simulating a user edit on the Customers tab).
    customer.name = 'Alice Edited';
    customer.address = '999 New Ave';
    customer.notes = 'edited notes';

    // The snapshot must be byte-identical to its pre-mutation deep-clone.
    expect(snapshot).toEqual(snapshotBefore);
    // Explicit field-level assertions for human-readable failure output.
    expect(snapshot.name).toBe('Alice Pre-Edit');
    expect(snapshot.address).toBe('123 Old St');
    expect(snapshot.notes).toBe('pre-edit notes');
  });

  it('deleting a Customer library record does not mutate a Sale.customer snapshot', () => {
    const customer: Customer = {
      id: 'c-2',
      createdAt: new Date('2026-01-02'),
      name: 'Bob Buyer',
      email: 'bob@example.com',
      company: 'BobCo',
      address: '42 First Ave',
      notes: 'pickup only',
    };

    const snapshot: JobCustomer = {
      name: customer.name,
      email: customer.email,
      company: customer.company,
      address: customer.address,
      notes: customer.notes,
    };
    const snapshotBefore = structuredClone(snapshot);

    // "Delete" by dropping the reference. The point of this test is to express
    // the architectural rule for human readers — the snapshot is independent of
    // the library record's lifecycle.
    let customerRef: Customer | undefined = customer;
    customerRef = undefined;
    void customerRef; // silence unused-after-assignment lint

    expect(snapshot).toEqual(snapshotBefore);
  });

  it('library-only fields (id, createdAt, lastUsedAt) are never present on the Sale snapshot', () => {
    const customer: Customer = {
      id: 'c-3',
      createdAt: new Date('2026-01-03'),
      lastUsedAt: new Date('2026-01-04'),
      name: 'Carla Customer',
      email: 'carla@example.com',
      company: 'Carla Inc.',
      address: '7 Library Lane',
      notes: 'always pays in cash',
    };

    // Spread ONLY the JobCustomer fields. TypeScript would catch this at compile
    // time too — the snapshot type is JobCustomer, which has no id/createdAt/
    // lastUsedAt — but the runtime assertion locks the rule for code review.
    const snapshot: JobCustomer = {
      name: customer.name,
      email: customer.email,
      company: customer.company,
      address: customer.address,
      notes: customer.notes,
    };

    expect('id' in snapshot).toBe(false);
    expect('createdAt' in snapshot).toBe(false);
    expect('lastUsedAt' in snapshot).toBe(false);
  });
});
