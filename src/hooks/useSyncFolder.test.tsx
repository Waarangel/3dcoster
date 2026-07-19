// ---------------------------------------------------------------------------
// useSyncFolder — TDD suite written BEFORE the implementation (Task 1, RED).
//
// Contract locks (per 44-06-PLAN.md Task 1 <behavior>):
//  - A confirmed merge ALWAYS writes the pre-merge snapshot (buildBackupFile,
//    D-08) to settings BEFORE applyMerge overwrites the local DB.
//  - The whole read->merge->write cycle runs inside withSyncLock — two
//    concurrent auto-write cycles serialize rather than race.
//  - A divergent launch-time sync file (remote has a newer/added/deleted
//    record) NEVER auto-commits — it surfaces a pendingMerge for the UI to
//    confirm, leaving the local DB untouched until confirmMerge() runs.
//
// Test strategy: raw createRoot + act harness (project precedent — see
// useFailureEvents.test.tsx). No renderHook library in this codebase.
// fake-indexeddb + a fresh per-test Dexie instance (applyMerge.test.ts /
// BackupRestoreSection.test.tsx precedent) is passed as useSyncFolder's
// injectable `database` argument. `../db/database` (getSetting/setSetting,
// the singleton `db`) is mocked exactly like syncFileIO.test.ts's pattern,
// since useSyncFolder's own device-local bookkeeping (deviceId,
// lastSyncedAt, the pre-merge snapshot) is deliberately stored through the
// existing settings-store helpers, not through the injectable `database`.
// `../utils/syncFileIO` is mocked at the I/O boundary (folder pick/read/
// write); syncMerge/applyMerge/backupExport/backupRestore run FOR REAL so
// the merge math itself is exercised, not stubbed away.
// ---------------------------------------------------------------------------
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import Dexie from 'dexie';
import { BACKUP_FORMAT_VERSION } from '../utils/backupSchema';

// -- Mock the settings store (device-local bookkeeping) — same pattern as
// syncFileIO.test.ts. `db` itself is never used directly by the hook (every
// call site takes the injected `database` argument instead), but the mock
// factory must still export it since '../db/database' is mocked wholesale.
const settingsStore = new Map<string, string>();
vi.mock('../db/database', () => ({
  db: {},
  getSetting: vi.fn(async (key: string, defaultValue: unknown) =>
    settingsStore.has(key) ? JSON.parse(settingsStore.get(key)!) : defaultValue,
  ),
  setSetting: vi.fn(async (key: string, value: unknown) => {
    settingsStore.set(key, JSON.stringify(value));
  }),
}));

// -- Mock the sync-folder I/O boundary — capability/target/read/write.
const mockGetPersistedSyncTarget = vi.fn();
const mockSelectSyncFolder = vi.fn();
const mockReadSyncFile = vi.fn();
const mockWriteSyncFileAtomic = vi.fn();
vi.mock('../utils/syncFileIO', () => ({
  syncCapability: vi.fn(() => 'auto'),
  selectSyncFolder: (...args: unknown[]) => mockSelectSyncFolder(...args),
  getPersistedSyncTarget: (...args: unknown[]) => mockGetPersistedSyncTarget(...args),
  clearSyncTarget: vi.fn(),
  readSyncFile: (...args: unknown[]) => mockReadSyncFile(...args),
  writeSyncFileAtomic: (...args: unknown[]) => mockWriteSyncFileAtomic(...args),
}));

let useSyncFolderModule: typeof import('./useSyncFolder');

const FAKE_TARGET = { kind: 'desktop' as const, path: '/tmp/sync' };

function nowIso(offsetMs = 0): string {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0) + offsetMs).toISOString();
}

let dbCounter = 0;
function makeTestDb(): Dexie {
  const database = new Dexie(`UseSyncFolderTest-${++dbCounter}`);
  database.version(13).stores({
    materials: 'id, category, brand, filamentType, currency',
    printers: 'id, name',
    printerInstances: 'id, printerConfigId, nickname',
    jobs: 'id, name, createdAt, printerInstanceId',
    sales: 'id, jobId, soldAt',
    settings: 'key',
    customers: 'id, name, email, lastUsedAt',
    quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
    stockEvents: 'id, assetId, refId, timestamp',
    failureEvents: 'id, printerInstanceId, materialId, jobId, failedAt',
    maintenanceEvents: 'id, printerInstanceId, partType, occurredAt',
    syncTombstones: 'id, store, deletedAt',
  });
  return database;
}

/** A syntactically-valid empty SyncFile envelope — tests override `data`/`tombstones`. */
function makeRemoteSyncFile(overrides: { jobs?: unknown[]; tombstones?: unknown[] } = {}): unknown {
  return {
    meta: {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      appSchemaVersion: 13,
      appVersion: '2.0.0-test',
      exportedAt: nowIso(),
    },
    data: {
      materials: [], printers: [], printerInstances: [],
      jobs: overrides.jobs ?? [],
      sales: [], settings: [], customers: [], quotes: [],
      stockEvents: [], failureEvents: [], maintenanceEvents: [],
    },
    tombstones: overrides.tombstones ?? [],
    syncMeta: { deviceId: 'remote-device', lastSyncedAt: nowIso() },
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestApi: import('./useSyncFolder').UseSyncFolderResult | null = null;

function Harness({
  database,
  onReady,
}: {
  database: Dexie;
  onReady: (api: import('./useSyncFolder').UseSyncFolderResult) => void;
}) {
  const api = useSyncFolderModule.useSyncFolder(database);
  onReady(api);
  return <div data-testid="status">{api.status}</div>;
}

function render(database: Dexie) {
  act(() => {
    root!.render(<Harness database={database} onReady={(api) => { latestApi = api; }} />);
  });
}

function api(): import('./useSyncFolder').UseSyncFolderResult {
  if (!latestApi) throw new Error('hook API not ready — call render() first');
  return latestApi;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  vi.resetModules();
  settingsStore.clear();
  mockGetPersistedSyncTarget.mockReset();
  mockSelectSyncFolder.mockReset();
  mockReadSyncFile.mockReset();
  mockWriteSyncFileAtomic.mockReset();
  mockWriteSyncFileAtomic.mockResolvedValue(undefined);
  useSyncFolderModule = await import('./useSyncFolder');
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
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useSyncFolder — confirmed merge snapshot ordering (D-08)', () => {
  it('writes the pre-merge snapshot BEFORE applyMerge overwrites the local record', async () => {
    const database = makeTestDb();
    await database.table('jobs').put({ id: 'job-1', name: 'Local Name', updatedAt: new Date('2020-01-01T00:00:00.000Z') });

    mockGetPersistedSyncTarget.mockResolvedValue(FAKE_TARGET);
    mockReadSyncFile.mockResolvedValue(JSON.stringify(makeRemoteSyncFile({
      jobs: [{ id: 'job-1', name: 'Remote Name', updatedAt: nowIso() }],
    })));

    render(database);
    await flush();

    await act(async () => {
      await api().syncNow();
    });

    // A conflicting update must NOT auto-commit — local record is untouched
    // and a pendingMerge is surfaced for confirmation.
    expect((await database.table('jobs').get('job-1'))?.name).toBe('Local Name');
    expect(api().pendingMerge).not.toBeNull();
    expect(api().pendingMerge?.plan.summary.jobs.updated).toBe(1);

    await act(async () => {
      await api().confirmMerge();
    });

    // Merge applied — the winning (remote) record is now in the local DB.
    expect((await database.table('jobs').get('job-1'))?.name).toBe('Remote Name');

    // The pre-merge snapshot was captured BEFORE applyMerge ran — it must
    // still show the OLD name. Since buildBackupFile+setSetting always run
    // strictly before applyMerge in confirmMerge()'s implementation, and
    // JS is single-threaded, this is only possible if the snapshot was
    // taken first.
    const stored = settingsStore.get('syncPreMergeSnapshot');
    expect(stored).toBeTruthy();
    const snapshot = JSON.parse(stored!) as { data: { jobs: { id: string; name: string }[] } };
    expect(snapshot.data.jobs.find(j => j.id === 'job-1')?.name).toBe('Local Name');

    expect(api().canUndo).toBe(true);
    expect(api().pendingMerge).toBeNull();
  });
});

describe('useSyncFolder — lock serialization', () => {
  it('serializes two concurrent syncNow() calls through withSyncLock', async () => {
    const database = makeTestDb();
    mockGetPersistedSyncTarget.mockResolvedValue(FAKE_TARGET);

    const events: string[] = [];
    let resolveFirstRead: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => { resolveFirstRead = resolve; });
    let readCallCount = 0;
    mockReadSyncFile.mockImplementation(async () => {
      readCallCount += 1;
      if (readCallCount === 1) {
        events.push('first-read-start');
        await firstGate;
        events.push('first-read-end');
        return null;
      }
      events.push('second-read');
      return null;
    });

    // A minimal serializing navigator.locks mock — same technique as
    // syncLock.test.ts's createSerializingLocksMock: queues callbacks
    // through a promise chain rather than passing them through same-tick.
    let queue: Promise<unknown> = Promise.resolve();
    const locksMock = {
      request: vi.fn(
        (_name: string, _options: unknown, callback: () => Promise<unknown>) => {
          const run = queue.then(() => callback());
          queue = run.catch(() => undefined);
          return run;
        },
      ),
    };
    vi.stubGlobal('navigator', { locks: locksMock });

    render(database);
    await flush();

    // NOTE: deliberately NOT wrapped in React's act() — act() does not
    // support overlapping/concurrent invocations (it corrupts React's
    // internal act-environment tracking for the rest of the test file, see
    // #2070-style cross-test pollution). This test only asserts async
    // ordering via the `events` array, not React-rendered DOM state, so a
    // plain (unwrapped) Promise pair is the correct tool here — mirrors
    // syncLock.test.ts's own non-React concurrency test.
    const p1 = api().syncNow();
    const p2 = api().syncNow();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['first-read-start']);

    resolveFirstRead();
    await act(async () => {
      await Promise.all([p1, p2]);
    });

    expect(events).toEqual(['first-read-start', 'first-read-end', 'second-read']);
    expect(locksMock.request).toHaveBeenCalled();
  });
});

describe('useSyncFolder — launch-time divergence never auto-commits', () => {
  it('checkOnLaunch() surfaces a pendingMerge instead of applying a divergent remote change', async () => {
    const database = makeTestDb();
    await database.table('jobs').put({ id: 'job-1', name: 'Local', updatedAt: new Date('2020-01-01T00:00:00.000Z') });

    mockGetPersistedSyncTarget.mockResolvedValue(FAKE_TARGET);
    mockReadSyncFile.mockResolvedValue(JSON.stringify(makeRemoteSyncFile({
      jobs: [{ id: 'job-1', name: 'Remote', updatedAt: nowIso() }],
    })));

    render(database);
    await flush();

    await act(async () => {
      await api().checkOnLaunch();
    });

    expect(api().pendingMerge).not.toBeNull();
    expect(api().pendingMerge?.plan.summary.jobs.updated).toBe(1);
    // Never auto-committed — local DB is untouched.
    expect((await database.table('jobs').get('job-1'))?.name).toBe('Local');
    // writeSyncFileAtomic must not have been called — nothing was published.
    expect(mockWriteSyncFileAtomic).not.toHaveBeenCalled();
  });

  it('checkOnLaunch() auto-publishes when local is strictly ahead (nothing to confirm)', async () => {
    const database = makeTestDb();
    await database.table('jobs').put({ id: 'job-1', name: 'Local Newer', updatedAt: new Date('2027-01-01T00:00:00.000Z') });

    mockGetPersistedSyncTarget.mockResolvedValue(FAKE_TARGET);
    mockReadSyncFile.mockResolvedValue(JSON.stringify(makeRemoteSyncFile({
      jobs: [{ id: 'job-1', name: 'Remote Older', updatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString() }],
    })));

    render(database);
    await flush();

    await act(async () => {
      await api().checkOnLaunch();
    });

    expect(api().pendingMerge).toBeNull();
    expect(mockWriteSyncFileAtomic).toHaveBeenCalledTimes(1);
  });
});
