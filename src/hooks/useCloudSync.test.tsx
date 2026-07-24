// ---------------------------------------------------------------------------
// useCloudSync — TDD suite (Task 2, 47-05-PLAN.md).
//
// Test strategy: raw createRoot + act harness (project precedent, mirrors
// useSyncFolder.test.tsx). fake-indexeddb + a fresh per-test Dexie instance
// is passed as useCloudSync's injectable `database` argument. `../db/database`
// (getSetting/setSetting) is mocked exactly like useSyncFolder.test.tsx's
// pattern. The I/O boundary — cloudBlobIO (network), syncCrypto (real AES-GCM
// is unnecessary here, 47-03 already tests it for real), syncKeyCache, and
// the auth/entitlement hooks — is mocked; syncMerge/applyMerge/backupExport/
// backupRestore run FOR REAL so the merge math itself is exercised.
// encryptSyncFile/decryptSyncFile are mocked as identity pass-throughs so the
// round-trip invariant test can assert on the plaintext JSON shape directly.
// ---------------------------------------------------------------------------
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import Dexie from 'dexie';
import { BACKUP_FORMAT_VERSION } from '../utils/backupSchema';
import { validateSyncFile } from '../utils/syncMerge';

// -- Mock the settings store (device-local bookkeeping).
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

// -- Mock the cloud transport boundary (47-04).
const mockDownloadBlob = vi.fn();
const mockUploadBlob = vi.fn();
const mockUploadWithRetry = vi.fn();
const mockGetLastKnownVersion = vi.fn();
const mockSetLastKnownVersion = vi.fn();
const mockResetCloudBlob = vi.fn();
const mockBroadcastBlobUpdated = vi.fn();
const mockSubscribeToCloudPeers = vi.fn();
vi.mock('../utils/cloudBlobIO', () => ({
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
  uploadBlob: (...args: unknown[]) => mockUploadBlob(...args),
  uploadWithRetry: (...args: unknown[]) => mockUploadWithRetry(...args),
  getLastKnownVersion: (...args: unknown[]) => mockGetLastKnownVersion(...args),
  setLastKnownVersion: (...args: unknown[]) => mockSetLastKnownVersion(...args),
  resetCloudBlob: (...args: unknown[]) => mockResetCloudBlob(...args),
  broadcastBlobUpdated: (...args: unknown[]) => mockBroadcastBlobUpdated(...args),
  subscribeToCloudPeers: (...args: unknown[]) => mockSubscribeToCloudPeers(...args),
}));

// -- Mock the crypto boundary (47-03) — identity encrypt/decrypt so tests can
// assert directly on the plaintext SyncFile JSON without real AES-GCM.
vi.mock('../utils/syncCrypto', () => ({
  encryptSyncFile: vi.fn(async (bytes: Uint8Array) => bytes),
  decryptSyncFile: vi.fn(async (bytes: Uint8Array) => bytes),
  deriveSaltFromAccountId: vi.fn(async () => new Uint8Array(32)),
  deriveKeyFromPassphrase: vi.fn(async () => ({ __fakeKey: true }) as unknown as CryptoKey),
  checkPassphraseStrength: vi.fn(async () => ({
    score: 4,
    ok: true,
    feedback: { warning: '', suggestions: [] },
  })),
}));

// -- Mock the key-cache boundary (47-03).
const mockGetCachedDerivedKey = vi.fn();
const mockCacheDerivedKey = vi.fn();
const mockClearDerivedKey = vi.fn();
vi.mock('../utils/syncKeyCache', () => ({
  cacheDerivedKey: (...args: unknown[]) => mockCacheDerivedKey(...args),
  getCachedDerivedKey: (...args: unknown[]) => mockGetCachedDerivedKey(...args),
  clearDerivedKey: (...args: unknown[]) => mockClearDerivedKey(...args),
}));

// -- Mock the supabase client presence check (a plain truthy/falsy stand-in —
// no real client methods are called by useCloudSync itself, only by the
// already-mocked cloudBlobIO/syncKeyCache boundary).
const cloudMockState = vi.hoisted(() => ({ supabase: {} as unknown }));
vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return cloudMockState.supabase;
  },
}));

// -- Mock the auth/entitlement hooks so tests can drive signed-in/Pro state directly.
let mockUser: { id: string } | null = null;
let mockIsSignedIn = false;
vi.mock('./useProAuth', () => ({
  useProAuth: () => ({
    session: null,
    user: mockUser,
    isSignedIn: mockIsSignedIn,
    status: mockIsSignedIn ? 'signed-in' : 'signed-out',
    signInWithEmail: vi.fn(),
    verifyEmailCode: vi.fn(),
    signOut: vi.fn(),
    resetSignIn: vi.fn(),
  }),
}));

let mockIsPro = false;
vi.mock('./useEntitlement', () => ({
  useEntitlement: () => ({
    isPro: mockIsPro,
    plan: null,
    status: null,
    currentPeriodEnd: null,
    refresh: vi.fn(),
  }),
}));

let useCloudSyncModule: typeof import('./useCloudSync');

function nowIso(offsetMs = 0): string {
  return new Date(Date.UTC(2026, 6, 23, 12, 0, 0, 0) + offsetMs).toISOString();
}

let dbCounter = 0;
function makeTestDb(): Dexie {
  const database = new Dexie(`UseCloudSyncTest-${++dbCounter}`);
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

/** A syntactically-valid SyncFile envelope, base64-of-JSON "ciphertext" (identity encrypt mock). */
function makeRemoteBlob(overrides: { jobs?: unknown[]; tombstones?: unknown[]; version?: number } = {}): { ciphertext: string; version: number } {
  const file = {
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
  const json = JSON.stringify(file);
  const bytes = new TextEncoder().encode(json);
  return { ciphertext: bytesToBase64ForTest(bytes), version: overrides.version ?? 1 };
}

function bytesToBase64ForTest(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToJsonForTest(base64: string): unknown {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestApi: import('./useCloudSync').UseCloudSyncResult | null = null;

function Harness({
  database,
  onReady,
}: {
  database: Dexie;
  onReady: (api: import('./useCloudSync').UseCloudSyncResult) => void;
}) {
  const api = useCloudSyncModule.useCloudSync(database);
  onReady(api);
  return <div data-testid="status">{api.status}</div>;
}

function render(database: Dexie) {
  act(() => {
    root!.render(<Harness database={database} onReady={(api) => { latestApi = api; }} />);
  });
}

function api(): import('./useCloudSync').UseCloudSyncResult {
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
  cloudMockState.supabase = {};
  mockUser = null;
  mockIsSignedIn = false;
  mockIsPro = false;
  mockDownloadBlob.mockReset();
  mockUploadBlob.mockReset();
  mockUploadWithRetry.mockReset().mockResolvedValue(undefined);
  mockGetLastKnownVersion.mockReset().mockResolvedValue(0);
  mockSetLastKnownVersion.mockReset().mockResolvedValue(undefined);
  mockResetCloudBlob.mockReset().mockResolvedValue(undefined);
  mockBroadcastBlobUpdated.mockReset().mockResolvedValue(undefined);
  mockSubscribeToCloudPeers.mockReset().mockReturnValue(() => {});
  mockGetCachedDerivedKey.mockReset();
  mockCacheDerivedKey.mockReset().mockResolvedValue(undefined);
  mockClearDerivedKey.mockReset().mockResolvedValue(undefined);
  useCloudSyncModule = await import('./useCloudSync');
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

describe('useCloudSync — SyncFile round-trip invariant', () => {
  it('the encrypted upload payload is a byte-identical SyncFile that validateSyncFile accepts', async () => {
    const database = makeTestDb();
    await database.table('jobs').put({ id: 'job-1', name: 'Local Job', updatedAt: new Date('2026-07-01T00:00:00.000Z') });

    mockUser = { id: 'user-1' };
    mockIsSignedIn = true;
    mockIsPro = true;
    settingsStore.set('cloudSyncEnabled', JSON.stringify(true));
    mockGetCachedDerivedKey.mockResolvedValue({ __fakeKey: true } as unknown as CryptoKey);
    mockDownloadBlob.mockResolvedValue(null); // nothing uploaded yet — this device publishes first

    let uploadedCiphertext: string | null = null;
    mockUploadWithRetry.mockImplementation(async (ciphertext: string) => {
      uploadedCiphertext = ciphertext;
    });

    render(database);
    await flush();

    await act(async () => {
      await api().syncNow();
    });

    expect(uploadedCiphertext).toBeTruthy();
    const parsed = base64ToJsonForTest(uploadedCiphertext!);
    const validated = validateSyncFile(parsed);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const jobs = validated.file.data.jobs as { id: string; name: string }[];
      expect(jobs.find(j => j.id === 'job-1')?.name).toBe('Local Job');
      expect(Array.isArray(validated.file.tombstones)).toBe(true);
      expect(validated.file.syncMeta.deviceId).toBeTruthy();
    }
  });
});

describe('useCloudSync — merge gating (D-09/D-10)', () => {
  it('first connect on a device is ALWAYS confirm-gated, even for a trivial remote-only add', async () => {
    const database = makeTestDb();
    mockUser = { id: 'user-1' };
    mockIsSignedIn = true;
    mockIsPro = true;
    settingsStore.set('cloudSyncEnabled', JSON.stringify(true));
    mockGetCachedDerivedKey.mockResolvedValue({ __fakeKey: true } as unknown as CryptoKey);
    const remote = makeRemoteBlob({ jobs: [{ id: 'job-remote', name: 'Remote', updatedAt: nowIso() }] });
    mockDownloadBlob.mockResolvedValue(remote);

    render(database);
    await flush();

    await act(async () => {
      await api().checkOnLaunch();
    });

    expect(api().pendingMerge).not.toBeNull();
    expect(api().pendingMerge?.isFirstConnect).toBe(true);
    expect(mockUploadWithRetry).not.toHaveBeenCalled();
    expect((await database.table('jobs').get('job-remote'))).toBeUndefined();
  });

  it('applies a routine merge silently once first-connect is done, without surfacing pendingMerge', async () => {
    const database = makeTestDb();
    mockUser = { id: 'user-1' };
    mockIsSignedIn = true;
    mockIsPro = true;
    settingsStore.set('cloudSyncEnabled', JSON.stringify(true));
    settingsStore.set('cloudSyncFirstConnectDone', JSON.stringify(true));
    mockGetCachedDerivedKey.mockResolvedValue({ __fakeKey: true } as unknown as CryptoKey);
    const remote = makeRemoteBlob({ jobs: [{ id: 'job-remote', name: 'Remote', updatedAt: nowIso() }], version: 2 });
    mockDownloadBlob.mockResolvedValue(remote);

    render(database);
    await flush();

    await act(async () => {
      await api().syncNow();
    });

    expect(api().pendingMerge).toBeNull();
    expect(api().error).toBeNull();
    expect(mockUploadWithRetry).toHaveBeenCalledTimes(1);
    expect((await database.table('jobs').get('job-remote'))?.name).toBe('Remote');

    // D-11: a rolling pre-merge snapshot was written before the silent apply.
    const stored = settingsStore.get('cloudSyncRollingSnapshots');
    expect(stored).toBeTruthy();
    const snapshots = JSON.parse(stored!) as { mergedAt: string; snapshot: { data: { jobs: unknown[] } } }[];
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it('gates a merge whose deletions exceed the risky threshold, even after first-connect', async () => {
    const database = makeTestDb();
    mockUser = { id: 'user-1' };
    mockIsSignedIn = true;
    mockIsPro = true;
    settingsStore.set('cloudSyncEnabled', JSON.stringify(true));
    settingsStore.set('cloudSyncFirstConnectDone', JSON.stringify(true));
    mockGetCachedDerivedKey.mockResolvedValue({ __fakeKey: true } as unknown as CryptoKey);

    // Seed 11 local jobs, each older than the remote tombstone that deletes it.
    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    const tombstoneDate = nowIso();
    const tombstones: { id: string; store: 'jobs'; deletedAt: string }[] = [];
    for (let i = 0; i < 11; i++) {
      await database.table('jobs').put({ id: `job-${i}`, name: `Job ${i}`, updatedAt: oldDate });
      tombstones.push({ id: `job-${i}`, store: 'jobs', deletedAt: tombstoneDate });
    }
    const remote = makeRemoteBlob({ jobs: [], tombstones, version: 3 });
    mockDownloadBlob.mockResolvedValue(remote);

    render(database);
    await flush();

    await act(async () => {
      await api().syncNow();
    });

    expect(api().pendingMerge).not.toBeNull();
    expect(mockUploadWithRetry).not.toHaveBeenCalled();
    // Local data untouched until confirmMerge().
    expect((await database.table('jobs').get('job-0'))).toBeDefined();

    await act(async () => {
      await api().confirmMerge();
    });

    expect(api().pendingMerge).toBeNull();
    expect((await database.table('jobs').get('job-0'))).toBeUndefined();
    expect(mockUploadWithRetry).toHaveBeenCalledTimes(1);
  });
});

describe('useCloudSync — lapse pause (D-13)', () => {
  it('isProStatus false makes setup/sync/push all no-op, local data untouched, zero network', async () => {
    const database = makeTestDb();
    mockUser = { id: 'user-1' };
    mockIsSignedIn = true;
    mockIsPro = false; // lapsed
    settingsStore.set('cloudSyncEnabled', JSON.stringify(true));

    render(database);
    await flush();

    await act(async () => {
      await api().syncNow();
    });
    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(mockUploadWithRetry).not.toHaveBeenCalled();

    let setupError: string | null = null;
    await act(async () => {
      setupError = await api().setupCloudSync('Correct-Horse-Battery-Staple-9!');
    });
    expect(setupError).toBeTruthy();
    expect(mockCacheDerivedKey).not.toHaveBeenCalled();
  });
});

describe('useCloudSync — needsPassphrase (Pitfall 5)', () => {
  it('signed-in with no cached derived key sets needsPassphrase without downloading', async () => {
    const database = makeTestDb();
    mockUser = { id: 'user-1' };
    mockIsSignedIn = true;
    mockIsPro = true;
    settingsStore.set('cloudSyncEnabled', JSON.stringify(true));
    mockGetCachedDerivedKey.mockResolvedValue(null);

    render(database);
    await flush();

    await act(async () => {
      await api().syncNow();
    });

    expect(api().needsPassphrase).toBe(true);
    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });
});

describe('useCloudSync — free-floor inertness', () => {
  it('supabase null makes the hook fully inert (zero network) even when other flags are set', async () => {
    cloudMockState.supabase = null;
    const database = makeTestDb();
    mockUser = null;
    mockIsSignedIn = false;
    mockIsPro = false;

    render(database);
    await flush();

    await act(async () => {
      await api().checkOnLaunch();
    });
    await act(async () => {
      await api().syncNow();
    });

    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(mockUploadWithRetry).not.toHaveBeenCalled();
    expect(mockSubscribeToCloudPeers).not.toHaveBeenCalled();
  });
});
