import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { db } from '../db/database';
import { useMaintenanceAmortization, type UseMaintenanceAmortizationResult } from './useMaintenanceAmortization';
import type { Asset, MaintenanceEvent, PrintJob, PrinterInstance } from '../types';

// ---------------------------------------------------------------------------
// useMaintenanceAmortization — Phase 39 Plan 04 Task 1. Same raw createRoot +
// act harness as useMaintenanceEvents.test.tsx.
// ---------------------------------------------------------------------------

const INSTANCE: PrinterInstance = {
  id: 'inst-1',
  printerConfigId: 'cfg-1',
  nickname: 'Test Printer',
  printHours: 100,
};

function Harness({
  instance,
  onReady,
}: {
  instance: PrinterInstance | undefined;
  onReady: (api: UseMaintenanceAmortizationResult) => void;
}) {
  const api = useMaintenanceAmortization(instance);
  onReady(api);
  return <div data-testid="ready">{api.amortization ? 'has-amortization' : 'no-amortization'}</div>;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestApi: UseMaintenanceAmortizationResult | null = null;

beforeEach(async () => {
  await db.maintenanceEvents.clear();
  await db.jobs.clear();
  await db.materials.clear();
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
  latestApi = null;
});

function render(instance: PrinterInstance | undefined) {
  act(() => {
    root!.render(<Harness instance={instance} onReady={(api) => { latestApi = api; }} />);
  });
}

function api(): UseMaintenanceAmortizationResult {
  if (!latestApi) throw new Error('hook API not ready — call render() first');
  return latestApi;
}

async function waitForAsync() {
  // useLiveQuery resolves the initial Dexie promise asynchronously; flush.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

const MAINT_EVENT: MaintenanceEvent = {
  id: 'evt-1',
  printerInstanceId: 'inst-1',
  partType: 'nozzle',
  cost: 25,
  occurredAt: new Date('2026-01-01'),
  printerHoursAtEvent: 50,
};

describe('useMaintenanceAmortization', () => {
  it('derives amortization from live maintenanceEvents for the instance', async () => {
    await db.maintenanceEvents.add(MAINT_EVENT);
    render(INSTANCE);
    await waitForAsync();

    expect(api().amortization).not.toBeNull();
    expect(api().amortization!.cumulativeCost).toBe(25);
    expect(api().amortization!.amortizedPerHour).toBeCloseTo(0.25);
  });

  it('returns null amortization when instance is undefined', async () => {
    render(undefined);
    await waitForAsync();
    expect(api().amortization).toBeNull();
  });

  it('returns null nextSwap predictions for all part types with no history', async () => {
    render(INSTANCE);
    await waitForAsync();
    expect(api().nextSwap.nozzle).toBeNull();
    expect(api().nextSwap.belt).toBeNull();
    expect(api().nextSwap.bed).toBeNull();
    expect(api().nextSwap.other).toBeNull();
  });

  it('predicts nozzle swap interval from two logged nozzle events', async () => {
    await db.maintenanceEvents.bulkAdd([
      { ...MAINT_EVENT, id: 'evt-1', printerHoursAtEvent: 0 },
      { ...MAINT_EVENT, id: 'evt-2', printerHoursAtEvent: 50 },
    ]);
    render(INSTANCE);
    await waitForAsync();

    expect(api().nextSwap.nozzle).not.toBeNull();
    expect(api().nextSwap.nozzle!.intervalHours).toBe(50);
  });

  it('scopes jobs query to the instance via an indexed where clause (does not include other instances)', async () => {
    const asset: Asset = { id: 'mat-cf', name: 'PLA-CF', category: 'filament', filamentType: 'PLA-CF' };
    await db.materials.add(asset);
    const jobOtherInstance: PrintJob = {
      id: 'job-other',
      name: 'Other',
      createdAt: new Date(),
      updatedAt: new Date(),
      filaments: [{ filamentId: 'mat-cf', grams: 100 }],
      printTimeHours: 999,
      printerInstanceId: 'inst-OTHER',
      modelCost: 0,
      prepTimeMinutes: 0,
      postProcessingMinutes: 0,
      materialsUsed: [],
      failureRate: 0,
      costPerUnit: 0,
      sellingPrice: 0,
      copiesSold: 0,
    };
    await db.jobs.add(jobOtherInstance);
    await db.maintenanceEvents.add(MAINT_EVENT);

    render(INSTANCE);
    await waitForAsync();

    // abrasiveHours must NOT include the other instance's 999h job.
    expect(api().amortization!.abrasiveHours).toBe(0);
  });
});
