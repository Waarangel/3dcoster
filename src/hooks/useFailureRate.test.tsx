import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { db } from '../db/database';
import { useFailureRate } from './useFailureRate';
import type { PrintJob, FailureEvent } from '../types';

// ---------------------------------------------------------------------------
// useFailureRate — Phase 39 Plan 02 Task 1.
//
// Light wiring coverage (the primary rate-math coverage lives in
// src/db/failureRate.test.ts). Same raw createRoot + act harness as
// useFailureEvents.test.tsx (no renderHook library in this codebase).
// ---------------------------------------------------------------------------

function RateHarness({
  printerInstanceId,
  materialId,
  onReady,
}: {
  printerInstanceId: string | undefined;
  materialId: string | undefined;
  onReady: (result: ReturnType<typeof useFailureRate>) => void;
}) {
  const result = useFailureRate(printerInstanceId, materialId);
  onReady(result);
  return <div data-testid="rate">{result ? result.rate : 'null'}</div>;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latest: ReturnType<typeof useFailureRate> = null;

beforeEach(async () => {
  await db.failureEvents.clear();
  await db.jobs.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  latest = null;
});

function render(printerInstanceId: string | undefined, materialId: string | undefined) {
  act(() => {
    root!.render(
      <RateHarness
        printerInstanceId={printerInstanceId}
        materialId={materialId}
        onReady={(r) => { latest = r; }}
      />
    );
  });
}

function makeJob(id: string, printerInstanceId: string, filamentId: string): PrintJob {
  return {
    id,
    name: `job-${id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    filaments: [{ filamentId, grams: 100 }],
    printTimeHours: 2,
    printerInstanceId,
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 0,
    sellingPrice: 0,
    copiesSold: 0,
  };
}

function makeFailure(id: string, printerInstanceId: string, materialId: string): FailureEvent {
  return {
    id,
    printerInstanceId,
    materialId,
    percentComplete: 50,
    reason: 'adhesion',
    failedAt: new Date(),
  };
}

describe('useFailureRate', () => {
  it('returns null when printerInstanceId or materialId is undefined', async () => {
    render(undefined, undefined);
    await act(async () => { await Promise.resolve(); });
    expect(latest).toBeNull();
  });

  it('returns null when combined attempts are below the 5-attempt threshold', async () => {
    await db.jobs.bulkAdd([makeJob('j1', 'printer-1', 'pla')]);
    render('printer-1', 'pla');
    await act(async () => { await Promise.resolve(); });
    expect(latest).toBeNull();
  });

  it('derives the exact rate once combined attempts reach the threshold', async () => {
    await db.jobs.bulkAdd([
      makeJob('j1', 'printer-1', 'pla'),
      makeJob('j2', 'printer-1', 'pla'),
      makeJob('j3', 'printer-1', 'pla'),
      makeJob('j4', 'printer-1', 'pla'),
    ]);
    await db.failureEvents.bulkAdd([makeFailure('f1', 'printer-1', 'pla')]);

    render('printer-1', 'pla');
    // Allow the live queries to resolve.
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    expect(latest).not.toBeNull();
    expect(latest!.provenance).toBe('exact');
    expect(latest!.sampleSize).toBe(5);
  });

  it('queries jobs with an indexed where(printerInstanceId) scope, not the full table', () => {
    const source = readFileSync(join(__dirname, 'useFailureRate.ts'), 'utf-8');
    expect(source).toMatch(/where\('printerInstanceId'\)/);
  });
});
