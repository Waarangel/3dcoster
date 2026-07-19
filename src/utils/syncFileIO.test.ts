// Phase 44-04 (SYNC-01) — syncFileIO.ts platform-branched folder pick,
// persistence, and atomic read/write tests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the settings store (desktop path persistence) — same pattern as other
// component tests that stub db/database.ts rather than pulling in real Dexie.
const settingsStore = new Map<string, string>();
vi.mock('../db/database', () => ({
  getSetting: vi.fn(async (key: string, defaultValue: unknown) =>
    settingsStore.has(key) ? JSON.parse(settingsStore.get(key)!) : defaultValue,
  ),
  setSetting: vi.fn(async (key: string, value: unknown) => {
    settingsStore.set(key, JSON.stringify(value));
  }),
}));

// Mock Tauri plugin modules — hoisted, only exercised when __IS_TAURI__ is stubbed true.
const tauriDialogOpen = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: tauriDialogOpen,
}));

const tauriWriteFile = vi.fn();
const tauriReadTextFile = vi.fn();
const tauriExists = vi.fn();
const tauriRename = vi.fn();
const tauriRemove = vi.fn();
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: (...args: unknown[]) => tauriWriteFile(...args),
  readTextFile: (...args: unknown[]) => tauriReadTextFile(...args),
  exists: (...args: unknown[]) => tauriExists(...args),
  rename: (...args: unknown[]) => tauriRename(...args),
  remove: (...args: unknown[]) => tauriRemove(...args),
}));

// ---------------------------------------------------------------------------
// Minimal fake indexedDB — models just enough of the real API (open with
// onupgradeneeded/onsuccess, a single-store transaction with get/put/delete
// and oncomplete) for the hand-rolled handle-store in syncFileIO.ts. Values
// are stored by direct reference (no structured-clone simulation) since we
// are testing OUR wrapper logic, not the browser's clone algorithm.
// ---------------------------------------------------------------------------
interface FakeRequest<T> {
  result?: T;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
}

function createFakeIndexedDB() {
  let created = false;
  const stores = new Map<string, Map<string, unknown>>();

  const fakeDb = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return {};
    },
    transaction: (storeName: string) => {
      const store = stores.get(storeName);
      if (!store) throw new Error(`no such store: ${storeName}`);
      const tx: { objectStore: (name: string) => unknown; oncomplete?: () => void; onerror?: () => void } = {
        objectStore: () => ({
          get: (key: string) => {
            const req: FakeRequest<unknown> = {};
            queueMicrotask(() => {
              req.result = store.get(key);
              req.onsuccess?.();
            });
            return req;
          },
          put: (value: unknown, key: string) => {
            store.set(key, value);
          },
          delete: (key: string) => {
            store.delete(key);
          },
        }),
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };

  return {
    open: (_name: string, _version: number) => {
      const req: FakeRequest<typeof fakeDb> = {};
      queueMicrotask(() => {
        const isNew = !created;
        created = true;
        req.result = fakeDb;
        if (isNew) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

type PermissionCheckFn = (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;

interface MockDirectoryHandleOverrides {
  getFileHandle?: FileSystemDirectoryHandle['getFileHandle'];
  queryPermission?: PermissionCheckFn;
  requestPermission?: PermissionCheckFn;
}

function makeDirectoryHandle(overrides: MockDirectoryHandleOverrides = {}) {
  return {
    kind: 'directory' as const,
    getFileHandle: vi.fn(),
    queryPermission: vi.fn(async () => 'granted' as PermissionState),
    requestPermission: vi.fn(async () => 'granted' as PermissionState),
    ...overrides,
  } as unknown as FileSystemDirectoryHandle;
}

let syncFileIO: typeof import('./syncFileIO');

beforeEach(async () => {
  vi.resetModules();
  settingsStore.clear();
  tauriDialogOpen.mockReset();
  tauriWriteFile.mockReset();
  tauriReadTextFile.mockReset();
  tauriExists.mockReset();
  tauriRename.mockReset();
  tauriRemove.mockReset();
  vi.stubGlobal('indexedDB', createFakeIndexedDB());
  syncFileIO = await import('./syncFileIO');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncCapability', () => {
  it('returns "auto" when __IS_TAURI__ is true', () => {
    vi.stubGlobal('__IS_TAURI__', true);
    expect(syncFileIO.syncCapability()).toBe('auto');
  });

  it('returns "auto" on web when showDirectoryPicker exists', () => {
    vi.stubGlobal('__IS_TAURI__', false);
    vi.stubGlobal('window', { showDirectoryPicker: vi.fn() });
    expect(syncFileIO.syncCapability()).toBe('auto');
  });

  it('returns "manual" on web without showDirectoryPicker (Safari/Firefox)', () => {
    vi.stubGlobal('__IS_TAURI__', false);
    vi.stubGlobal('window', {});
    expect(syncFileIO.syncCapability()).toBe('manual');
  });
});

describe('writeSyncFileAtomic — web (createWritable atomic swap)', () => {
  it('obtains a writable via createWritable(), writes, then closes — in that order', async () => {
    const callOrder: string[] = [];
    const writable = {
      write: vi.fn(async () => {
        callOrder.push('write');
      }),
      close: vi.fn(async () => {
        callOrder.push('close');
      }),
    };
    const fileHandle = {
      kind: 'file' as const,
      createWritable: vi.fn(async () => {
        callOrder.push('createWritable');
        return writable;
      }),
    };
    const dirHandle = makeDirectoryHandle({
      getFileHandle: vi.fn(async () => fileHandle) as unknown as FileSystemDirectoryHandle['getFileHandle'],
    });

    const bytes = new TextEncoder().encode('{"hello":"world"}');
    await syncFileIO.writeSyncFileAtomic({ kind: 'web', handle: dirHandle }, bytes);

    expect(callOrder).toEqual(['createWritable', 'write', 'close']);
    expect(writable.write).toHaveBeenCalledWith(bytes);
  });
});

describe('writeSyncFileAtomic — desktop (atomic write via write-temp-then-rename)', () => {
  it('writes to a .tmp path then renames onto the real path', async () => {
    tauriWriteFile.mockResolvedValue(undefined);
    tauriRename.mockResolvedValue(undefined);

    const bytes = new TextEncoder().encode('{"hello":"world"}');
    await syncFileIO.writeSyncFileAtomic({ kind: 'desktop', path: '/tmp/sync' }, bytes);

    expect(tauriWriteFile).toHaveBeenCalledTimes(1);
    const [tmpPath, writtenBytes] = tauriWriteFile.mock.calls[0] as [string, Uint8Array];
    expect(tmpPath).toMatch(/^\/tmp\/sync\/3dcoster-sync\.json\.tmp-\d+$/);
    expect(writtenBytes).toBe(bytes);

    expect(tauriRename).toHaveBeenCalledWith(tmpPath, '/tmp/sync/3dcoster-sync.json');
    expect(tauriRemove).not.toHaveBeenCalled();
  });

  it('removes the temp file and rethrows when rename() fails, leaving the real path untouched', async () => {
    tauriWriteFile.mockResolvedValue(undefined);
    tauriRename.mockRejectedValue(new Error('disk full'));
    tauriRemove.mockResolvedValue(undefined);

    const bytes = new TextEncoder().encode('{}');
    await expect(
      syncFileIO.writeSyncFileAtomic({ kind: 'desktop', path: '/tmp/sync' }, bytes),
    ).rejects.toThrow('disk full');

    expect(tauriRemove).toHaveBeenCalledTimes(1);
    const [tmpPath] = tauriRemove.mock.calls[0] as [string];
    expect(tmpPath).toMatch(/\.tmp-\d+$/);
  });

  it('maps a "forbidden path:" write failure to a friendly message', async () => {
    tauriWriteFile.mockRejectedValue(new Error('forbidden path: /tmp/sync/3dcoster-sync.json.tmp-1'));

    await expect(
      syncFileIO.writeSyncFileAtomic({ kind: 'desktop', path: '/tmp/sync' }, new Uint8Array()),
    ).rejects.toThrow(/restricted/i);
  });
});

describe('selectSyncFolder / getPersistedSyncTarget', () => {
  it('web: selectSyncFolder persists the handle, getPersistedSyncTarget returns it back', async () => {
    vi.stubGlobal('__IS_TAURI__', false);
    const handle = makeDirectoryHandle();
    vi.stubGlobal('window', { showDirectoryPicker: vi.fn(async () => handle) });

    const selected = await syncFileIO.selectSyncFolder();
    expect(selected).toEqual({ kind: 'web', handle });

    const persisted = await syncFileIO.getPersistedSyncTarget();
    expect(persisted).toEqual({ kind: 'web', handle });
  });

  it('desktop: selectSyncFolder persists the path, getPersistedSyncTarget returns it back', async () => {
    vi.stubGlobal('__IS_TAURI__', true);
    tauriDialogOpen.mockResolvedValue('/Users/maker/Dropbox/3dcoster');

    const selected = await syncFileIO.selectSyncFolder();
    expect(selected).toEqual({ kind: 'desktop', path: '/Users/maker/Dropbox/3dcoster' });

    const persisted = await syncFileIO.getPersistedSyncTarget();
    expect(persisted).toEqual({ kind: 'desktop', path: '/Users/maker/Dropbox/3dcoster' });
  });

  it('returns null when the user cancels the dialog', async () => {
    vi.stubGlobal('__IS_TAURI__', true);
    tauriDialogOpen.mockResolvedValue(null);

    expect(await syncFileIO.selectSyncFolder()).toBeNull();
  });

  it('web: getPersistedSyncTarget returns null when permission was revoked and re-request is denied', async () => {
    vi.stubGlobal('__IS_TAURI__', false);
    const handle = makeDirectoryHandle({
      queryPermission: vi.fn(async () => 'prompt' as PermissionState),
      requestPermission: vi.fn(async () => 'denied' as PermissionState),
    });
    vi.stubGlobal('window', { showDirectoryPicker: vi.fn(async () => handle) });

    await syncFileIO.selectSyncFolder();
    const persisted = await syncFileIO.getPersistedSyncTarget();

    expect(persisted).toBeNull();
  });
});
