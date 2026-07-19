// Phase 44-04 (SYNC-01) — platform-branched sync-folder selection/persistence
// and atomic sync-file read/write.
//
// Web: File System Access API. `FileSystemFileHandle.createWritable()` is
// ALREADY atomic (browser writes to a swap file, replaces the real file only
// on `close()` — RESEARCH.md), so no hand-rolled temp-then-rename is needed
// here. The folder handle itself is structured-clonable but NOT JSON, so it
// CANNOT go through db/database.ts's setSetting (JSON.stringify) — it lives
// in a tiny dedicated IndexedDB key-value store instead (below).
//
// Desktop: `@tauri-apps/plugin-fs` writeFile() has no atomicity guarantee, so
// writes go through write-temp-then-rename (RESEARCH.md Pattern 2). The
// chosen folder PATH is a plain string and persists fine through the
// existing settings store (setSetting/getSetting).
import { getSetting, setSetting } from '../db/database';

export type SyncCapability = 'auto' | 'manual';

export type SyncTarget =
  | { kind: 'web'; handle: FileSystemDirectoryHandle }
  | { kind: 'desktop'; path: string };

/** Single sync filename inside the user's chosen folder, on either platform. */
const SYNC_FILENAME = '3dcoster-sync.json';

/** Settings-store key for the desktop sync folder path. */
const SYNC_FOLDER_PATH_SETTING_KEY = 'syncFolderPath';

// -- Web-only: dedicated IndexedDB store for the FileSystemDirectoryHandle --
// (NOT the settings store — handles are not JSON-serializable.)
const HANDLE_DB_NAME = '3dcoster-sync-handles';
const HANDLE_STORE_NAME = 'handles';
const HANDLE_RECORD_KEY = 'syncFolderHandle';

declare global {
  interface Window {
    /** File System Access API — Chromium-only (D-02 gates the auto path on it). */
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

/** A FileSystemHandle augmented with the (not-yet-in-lib.dom) permission API. */
type PermissionAwareHandle = FileSystemHandle & {
  queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

/**
 * `'auto'` when the platform supports the full pick-once-then-automatic flow
 * (Tauri desktop, or a Chromium browser with the File System Access API);
 * `'manual'` otherwise (Safari/Firefox — D-02's export/import fallback).
 */
export function syncCapability(): SyncCapability {
  if (__IS_TAURI__) return 'auto';
  if (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') return 'auto';
  return 'manual';
}

// ---------------------------------------------------------------------------
// Web handle store — minimal hand-rolled IndexedDB key-value store. Deliberately
// NOT idb-keyval or any other dependency: the surface needed (get/set/delete one
// key) is tiny and this keeps the handle-storage contract self-contained and
// easy to unit test against a lightweight fake indexedDB.
// ---------------------------------------------------------------------------
function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        req.result.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
    const req = tx.objectStore(HANDLE_STORE_NAME).get(HANDLE_RECORD_KEY);
    req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSetHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    tx.objectStore(HANDLE_STORE_NAME).put(handle, HANDLE_RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClearHandle(): Promise<void> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    tx.objectStore(HANDLE_STORE_NAME).delete(HANDLE_RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Opens the platform folder picker and persists the selection (web: handle
 * in IndexedDB; desktop: path string in settings). Returns `null` if the
 * user cancels the dialog, or if called on a platform without the capability
 * (callers should gate the entry point on `syncCapability() === 'auto'`).
 */
export async function selectSyncFolder(): Promise<SyncTarget | null> {
  if (__IS_TAURI__) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true });
    if (!selected || Array.isArray(selected)) return null;
    await setSetting<string | null>(SYNC_FOLDER_PATH_SETTING_KEY, selected);
    return { kind: 'desktop', path: selected };
  }

  if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
    return null;
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await idbSetHandle(handle);
  return { kind: 'web', handle };
}

/**
 * Returns the previously-picked sync folder, or `null` if none has been set
 * (or, on web, if the stored handle's permission grant was revoked and the
 * user declines to re-grant it — Chrome 122+ persistent grants normally make
 * this a no-op re-check, not a re-prompt).
 */
export async function getPersistedSyncTarget(): Promise<SyncTarget | null> {
  if (__IS_TAURI__) {
    const path = await getSetting<string | null>(SYNC_FOLDER_PATH_SETTING_KEY, null);
    return path ? { kind: 'desktop', path } : null;
  }

  const handle = await idbGetHandle();
  if (!handle) return null;

  const permissionAware = handle as PermissionAwareHandle;
  if (typeof permissionAware.queryPermission === 'function') {
    const state = await permissionAware.queryPermission({ mode: 'readwrite' });
    if (state === 'granted') return { kind: 'web', handle };
    if (typeof permissionAware.requestPermission === 'function') {
      const requested = await permissionAware.requestPermission({ mode: 'readwrite' });
      if (requested === 'granted') return { kind: 'web', handle };
    }
    return null;
  }
  return { kind: 'web', handle };
}

/** Forgets the persisted sync folder (web handle or desktop path). */
export async function clearSyncTarget(): Promise<void> {
  if (__IS_TAURI__) {
    await setSetting<string | null>(SYNC_FOLDER_PATH_SETTING_KEY, null);
    return;
  }
  await idbClearHandle();
}

/**
 * Reads the sync file's raw text contents, or `null` if it does not exist
 * yet (first run for this folder).
 */
export async function readSyncFile(target: SyncTarget): Promise<string | null> {
  if (target.kind === 'desktop') {
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    const filePath = `${target.path}/${SYNC_FILENAME}`;
    if (!(await exists(filePath))) return null;
    return readTextFile(filePath);
  }

  try {
    const fileHandle = await target.handle.getFileHandle(SYNC_FILENAME, { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') return null;
    throw err;
  }
}

/**
 * Writes the sync file atomically. Web: `createWritable()` swap-on-close is
 * native atomicity. Desktop: write-temp-then-rename (RESEARCH.md Pattern 2) —
 * a mid-write crash leaves the real file untouched.
 */
export async function writeSyncFileAtomic(target: SyncTarget, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  if (target.kind === 'desktop') {
    return atomicWriteTauri(`${target.path}/${SYNC_FILENAME}`, bytes);
  }

  const fileHandle = await target.handle.getFileHandle(SYNC_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

async function atomicWriteTauri(path: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const { writeFile, rename, remove } = await import('@tauri-apps/plugin-fs');
  const tmpPath = `${path}.tmp-${Date.now()}`;

  try {
    await writeFile(tmpPath, bytes);
  } catch (err) {
    throw mapForbiddenPathError(err, path);
  }

  try {
    await rename(tmpPath, path);
  } catch (err) {
    await remove(tmpPath).catch(() => {});
    throw mapForbiddenPathError(err, path);
  }
}

/**
 * Maps a desktop fs-scope denial ("forbidden path: ...") to a friendly
 * message — same convention as backupExport.ts's downloadBackup().
 */
function mapForbiddenPathError(err: unknown, path: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().startsWith('forbidden path:')) {
    return new Error(
      `Cannot write to "${path}" — this location is restricted. ` +
      'Try picking a different sync folder, or reselect it in Settings.',
    );
  }
  return err instanceof Error ? err : new Error(msg);
}
