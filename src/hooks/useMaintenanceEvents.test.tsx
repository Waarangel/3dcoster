import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { db } from '../db/database';
import { useMaintenanceEvents, type LogMaintenanceEventInput } from './useMaintenanceEvents';

// ---------------------------------------------------------------------------
// useMaintenanceEvents — Phase 39 Plan 01 Task 2. Same raw createRoot + act
// harness as useFailureEvents.test.tsx / useCustomerPicker.test.tsx.
// ---------------------------------------------------------------------------

function MaintenanceHarness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useMaintenanceEvents>) => void;
}) {
  const api = useMaintenanceEvents();
  onReady(api);
  return <div data-testid="count">{api.events.length}</div>;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestApi: ReturnType<typeof useMaintenanceEvents> | null = null;

beforeEach(async () => {
  await db.maintenanceEvents.clear();
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
    root!.render(<MaintenanceHarness onReady={(api) => { latestApi = api; }} />);
  });
}

function api(): ReturnType<typeof useMaintenanceEvents> {
  if (!latestApi) throw new Error('hook API not ready — call render() first');
  return latestApi;
}

const BASE_INPUT: LogMaintenanceEventInput = {
  printerInstanceId: 'printer-1',
  partType: 'nozzle',
  cost: 12.5,
  occurredAt: new Date('2026-07-06T10:00:00.000Z'),
  printerHoursAtEvent: 320,
  nozzleType: 'hardened',
};

describe('useMaintenanceEvents — logMaintenanceEvent', () => {
  it('adds a maintenanceEvents row with all fields', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logMaintenanceEvent(BASE_INPUT);
    });

    expect(id).toBeTruthy();
    const rows = await db.maintenanceEvents.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      printerInstanceId: 'printer-1',
      partType: 'nozzle',
      cost: 12.5,
      printerHoursAtEvent: 320,
      nozzleType: 'hardened',
    });
  });

  it('rejects a non-finite cost and writes no row', async () => {
    render();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let id: string | undefined;
    await act(async () => {
      id = await api().logMaintenanceEvent({ ...BASE_INPUT, cost: NaN });
    });

    expect(id).toBeUndefined();
    expect(await db.maintenanceEvents.count()).toBe(0);
    errSpy.mockRestore();
  });

  it('rejects a non-finite printerHoursAtEvent and writes no row', async () => {
    render();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let id: string | undefined;
    await act(async () => {
      id = await api().logMaintenanceEvent({ ...BASE_INPUT, printerHoursAtEvent: Infinity });
    });

    expect(id).toBeUndefined();
    expect(await db.maintenanceEvents.count()).toBe(0);
    errSpy.mockRestore();
  });
});

describe('useMaintenanceEvents — deleteMaintenanceEvent', () => {
  it('deletes the maintenance row by id', async () => {
    render();
    let id: string | undefined;
    await act(async () => {
      id = await api().logMaintenanceEvent(BASE_INPUT);
    });
    expect(await db.maintenanceEvents.count()).toBe(1);

    await act(async () => {
      await api().deleteMaintenanceEvent(id!);
    });

    expect(await db.maintenanceEvents.count()).toBe(0);
  });
});
