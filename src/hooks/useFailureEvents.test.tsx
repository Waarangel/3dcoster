import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { db } from '../db/database';
import { useFailureEvents, type LogFailureInput } from './useFailureEvents';

// ---------------------------------------------------------------------------
// useFailureEvents — Phase 39 Plan 01 Task 2.
//
// Test strategy: raw createRoot + act + DOM dispatch (project precedent —
// see useCustomerPicker.test.tsx). No renderHook library in this codebase.
// fake-indexeddb/auto gives the real `db` singleton a working IndexedDB shim,
// scoped to this file only (per the database.migrations.test.ts convention).
// ---------------------------------------------------------------------------

function FailureHarness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useFailureEvents>) => void;
}) {
  const api = useFailureEvents();
  onReady(api);
  return <div data-testid="count">{api.events.length}</div>;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestApi: ReturnType<typeof useFailureEvents> | null = null;

beforeEach(async () => {
  await db.failureEvents.clear();
  await db.stockEvents.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  latestApi = null;
});

function render() {
  act(() => {
    root!.render(<FailureHarness onReady={(api) => { latestApi = api; }} />);
  });
}

function api(): ReturnType<typeof useFailureEvents> {
  if (!latestApi) throw new Error('hook API not ready — call render() first');
  return latestApi;
}

const BASE_INPUT: LogFailureInput = {
  printerInstanceId: 'printer-1',
  materialId: 'mat-pla',
  percentComplete: 40,
  reason: 'adhesion',
  failedAt: new Date('2026-07-06T10:00:00.000Z'),
};

describe('useFailureEvents — logFailure', () => {
  it('adds a failureEvents row with all required fields', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure(BASE_INPUT);
    });

    expect(id).toBeTruthy();
    const rows = await db.failureEvents.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      printerInstanceId: 'printer-1',
      materialId: 'mat-pla',
      percentComplete: 40,
      reason: 'adhesion',
    });
  });

  it('rejects a non-finite percentComplete and writes no row', async () => {
    render();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure({ ...BASE_INPUT, percentComplete: NaN });
    });

    expect(id).toBeUndefined();
    expect(await db.failureEvents.count()).toBe(0);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('rejects a non-finite gramsWasted and writes no row', async () => {
    render();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure({ ...BASE_INPUT, gramsWasted: Infinity });
    });

    expect(id).toBeUndefined();
    expect(await db.failureEvents.count()).toBe(0);
    errSpy.mockRestore();
  });

  it('writes a paired stockEvent with a deterministic refId when jobId + gramsWasted are present (D-03)', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure({ ...BASE_INPUT, jobId: 'job-1', gramsWasted: 45 });
    });

    expect(id).toBeTruthy();
    const stockRows = await db.stockEvents.toArray();
    expect(stockRows).toHaveLength(1);
    expect(stockRows[0]).toMatchObject({
      id: `failure-${id}`,
      refId: `failure-${id}`,
      assetId: 'mat-pla',
      delta: -45,
    });
  });

  it('deducts stock for a standalone failure (no jobId) when gramsWasted is supplied (D-03)', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure({ ...BASE_INPUT, gramsWasted: 20 });
    });

    const stockRows = await db.stockEvents.toArray();
    expect(stockRows).toHaveLength(1);
    expect(stockRows[0]).toMatchObject({
      refId: `failure-${id}`,
      assetId: 'mat-pla',
      delta: -20,
    });
  });

  it('skips stock deduction for a standalone failure with no gramsWasted', async () => {
    render();
    await act(async () => {
      await api().logFailure(BASE_INPUT);
    });

    expect(await db.stockEvents.count()).toBe(0);
  });
});

describe('useFailureEvents — per-material breakdown (WR-08)', () => {
  const BREAKDOWN_INPUT: LogFailureInput = {
    ...BASE_INPUT,
    jobId: 'job-1',
    gramsWasted: 250, // 500g job total × 50%
    materialBreakdown: [
      { materialId: 'mat-pla', grams: 150 }, // 300g × 50%
      { materialId: 'mat-pva', grams: 100 }, // 200g × 50%
    ],
  };

  it('writes one stockEvent per material instead of the job total against one material', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure(BREAKDOWN_INPUT);
    });

    const stockRows = (await db.stockEvents.toArray()).sort((a, b) => a.assetId.localeCompare(b.assetId));
    expect(stockRows).toHaveLength(2);
    expect(stockRows[0]).toMatchObject({
      id: `failure-${id}__mat-pla`,
      refId: `failure-${id}`,
      assetId: 'mat-pla',
      delta: -150,
    });
    expect(stockRows[1]).toMatchObject({
      id: `failure-${id}__mat-pva`,
      refId: `failure-${id}`,
      assetId: 'mat-pva',
      delta: -100,
    });
  });

  it('does NOT persist materialBreakdown on the failureEvents row', async () => {
    render();
    await act(async () => {
      await api().logFailure(BREAKDOWN_INPUT);
    });

    const rows = await db.failureEvents.toArray();
    expect(rows).toHaveLength(1);
    expect('materialBreakdown' in rows[0]).toBe(false);
    expect(rows[0].gramsWasted).toBe(250); // ledger keeps the D-08 total
  });

  it('deleteFailure reverses EVERY per-material stockEvent by refId', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure(BREAKDOWN_INPUT);
    });
    expect(await db.stockEvents.count()).toBe(2);

    await act(async () => {
      await api().deleteFailure(id!);
    });

    expect(await db.failureEvents.count()).toBe(0);
    expect(await db.stockEvents.count()).toBe(0);
  });

  it('rejects a breakdown containing non-finite grams and writes nothing', async () => {
    render();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure({
        ...BREAKDOWN_INPUT,
        materialBreakdown: [{ materialId: 'mat-pla', grams: NaN }],
      });
    });

    expect(id).toBeUndefined();
    expect(await db.failureEvents.count()).toBe(0);
    expect(await db.stockEvents.count()).toBe(0);
    errSpy.mockRestore();
  });
});

describe('useFailureEvents — deleteFailure', () => {
  it('deletes the failure row and its paired stockEvent by the deterministic refId', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure({ ...BASE_INPUT, jobId: 'job-1', gramsWasted: 45 });
    });
    expect(await db.failureEvents.count()).toBe(1);
    expect(await db.stockEvents.count()).toBe(1);

    await act(async () => {
      await api().deleteFailure(id!);
    });

    expect(await db.failureEvents.count()).toBe(0);
    expect(await db.stockEvents.count()).toBe(0);
  });

  it('deleting a standalone failure (no paired stockEvent) is a safe no-op for the stock ledger', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logFailure(BASE_INPUT);
    });

    await act(async () => {
      await api().deleteFailure(id!);
    });

    expect(await db.failureEvents.count()).toBe(0);
    expect(await db.stockEvents.count()).toBe(0);
  });
});
