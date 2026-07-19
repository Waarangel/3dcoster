import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type Dexie from 'dexie';
import { db, getSetting, setSetting } from '../db/database';
import { withSyncLock, notifyPeers } from '../utils/syncLock';
import {
  syncCapability,
  selectSyncFolder,
  getPersistedSyncTarget,
  readSyncFile,
  writeSyncFileAtomic,
  type SyncCapability,
  type SyncTarget,
} from '../utils/syncFileIO';
import { validateSyncFile, computeMerge, type MergePlan } from '../utils/syncMerge';
import { applyMerge } from '../utils/applyMerge';
import { buildBackupFile } from '../utils/backupExport';
import { restoreBackup } from '../utils/backupRestore';
import { BACKUP_STORES, MAX_BACKUP_BYTES, type BackupFile, type BackupStoreName, type SyncFile, type SyncTombstone } from '../utils/backupSchema';

// ---------------------------------------------------------------------------
// Phase 44-06 (SYNC-01) — the orchestration hook that composes the Wave 1-2
// primitives into the actual sync flow: setup (D-01), the debounced locked
// auto-write (D-04), the launch-time merge check (D-01/D-07), the
// pre-commit confirm gate (D-07), the pre-merge snapshot + undo (D-08), and
// the manual-capability fallback (D-02).
//
// Composition order (44-06-PLAN.md key_links, verbatim):
//   withSyncLock (44-04) wraps
//     readSyncFile (44-04)
//       -> validateSyncFile + computeMerge (44-01)
//         -> SyncMergeSummary confirm
//           -> buildBackupFile snapshot (D-08)
//             -> applyMerge (44-03)
//               -> writeSyncFileAtomic (44-04)
//                 -> notifyPeers (44-04)
//
// Module-scoped singleton store (not component-local state): App.tsx mounts
// one long-lived useSyncFolder() instance to drive the launch check and the
// debounced auto-write for the app's entire lifetime, while SyncSetup.tsx
// mounts its own instance (only while the Data tab is open) to read status
// and drive manual actions. Both instances must observe the SAME pending
// merge / status — a per-call-site useState would silently fork that state.
// useSyncExternalStore (the React-supported way to subscribe to any
// external store) keeps every call site in sync without prop-drilling the
// hook's result through SettingsModal -> BackupRestoreSection -> SyncSetup,
// and without a new Context provider (out of this plan's file scope).
// ---------------------------------------------------------------------------

/** D-04: 15s debounce band (10-30s) — batches rapid successive Dexie writes
 *  into a single locked read-merge-write cycle instead of one per keystroke. */
const DEBOUNCE_MS = 15_000;

const SYNC_DEVICE_ID_KEY = 'syncDeviceId';
const SYNC_LAST_SYNCED_AT_KEY = 'syncLastSyncedAt';
const SYNC_PRE_MERGE_SNAPSHOT_KEY = 'syncPreMergeSnapshot';

export interface PendingMerge {
  plan: MergePlan;
  target: SyncTarget;
}

export interface UseSyncFolderResult {
  capability: SyncCapability;
  isConfigured: boolean;
  lastSyncedAt: string | null;
  pendingMerge: PendingMerge | null;
  canUndo: boolean;
  error: string | null;
  status: 'idle' | 'syncing';
  setupSync: () => Promise<void>;
  syncNow: () => Promise<void>;
  checkOnLaunch: () => Promise<void>;
  confirmMerge: () => Promise<void>;
  cancelMerge: () => void;
  undoLastMerge: () => Promise<void>;
}

interface SyncFolderState {
  capability: SyncCapability;
  isConfigured: boolean;
  lastSyncedAt: string | null;
  pendingMerge: PendingMerge | null;
  canUndo: boolean;
  error: string | null;
  status: 'idle' | 'syncing';
}

let state: SyncFolderState = {
  capability: 'manual',
  isConfigured: false,
  lastSyncedAt: null,
  pendingMerge: null,
  canUndo: false,
  error: null,
  status: 'idle',
};

const listeners = new Set<() => void>();

function setState(patch: Partial<SyncFolderState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SyncFolderState {
  return state;
}

// ---------------------------------------------------------------------------
// One-time module wiring — guarded so re-mounting components (StrictMode,
// remounts across tab switches) never register duplicate Dexie hooks or
// re-run the async settings read twice.
// ---------------------------------------------------------------------------
let initPromise: Promise<void> | null = null;
let dexieListenerRegistered = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncCycleRunning = false;
let launchCheckRan = false;

function getOrCreateDeviceId(): Promise<string> {
  return (async () => {
    const existing = await getSetting<string | null>(SYNC_DEVICE_ID_KEY, null);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await setSetting(SYNC_DEVICE_ID_KEY, id);
    return id;
  })();
}

/** True when the plan contains changes a user would perceive (added, updated,
 *  or deleted records) — the D-07 confirm gate applies only to these. A
 *  plan carrying ONLY tombstone propagation, or nothing at all, is safe to
 *  auto-apply (nothing locally visible is being overwritten). */
function needsConfirmation(plan: MergePlan): boolean {
  return BACKUP_STORES.some(store => {
    const counts = plan.summary[store];
    return counts.added > 0 || counts.updated > 0 || counts.deleted > 0;
  });
}

async function readLocalTombstones(database: Dexie): Promise<SyncTombstone[]> {
  return database.table<SyncTombstone, string>('syncTombstones').toArray();
}

/** Publishes the CURRENT local DB (post-merge or local-ahead) as the sync
 *  file: builds the envelope, writes it atomically, stamps this device's
 *  lastSyncedAt, and pings peer tabs. */
async function writeLocalSnapshotToFile(database: Dexie, target: SyncTarget): Promise<void> {
  const backup = await buildBackupFile(database);
  const tombstones = await readLocalTombstones(database);
  const deviceId = await getOrCreateDeviceId();
  const now = new Date();
  const syncFile: SyncFile = {
    ...backup,
    tombstones,
    syncMeta: { deviceId, lastSyncedAt: now.toISOString() },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(syncFile));
  await writeSyncFileAtomic(target, bytes);
  await setSetting(SYNC_LAST_SYNCED_AT_KEY, now.toISOString());
  notifyPeers();
  setState({ lastSyncedAt: now.toISOString() });
}

/** The locked read -> merge -> (auto-write | surface pendingMerge) cycle
 *  shared by setupSync, syncNow, the debounced auto-write, and
 *  checkOnLaunch. Never applies a plan that needs confirmation — it only
 *  ever auto-commits the "nothing to confirm" branch (D-07). */
async function runSyncCycle(database: Dexie): Promise<void> {
  const target = await getPersistedSyncTarget();
  if (!target) {
    setState({ isConfigured: false });
    return;
  }

  setState({ isConfigured: true, status: 'syncing', error: null });
  syncCycleRunning = true;
  try {
    await withSyncLock(async () => {
      const raw = await readSyncFile(target);

      if (raw === null) {
        // First write into this folder — publish current local state.
        await writeLocalSnapshotToFile(database, target);
        return;
      }

      // T-44-06-04: reject an oversized sync file BEFORE JSON.parse — same
      // gate BackupRestoreSection applies to an untrusted restore file.
      if (raw.length > MAX_BACKUP_BYTES) {
        throw new Error('Sync file is unexpectedly large — refusing to merge. Check the sync folder.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Sync file is not valid JSON — it may be corrupted.');
      }

      const validated = validateSyncFile(parsed);
      if (!validated.ok) {
        throw new Error(validated.error);
      }

      const localBackup = await buildBackupFile(database);
      const localByStore = localBackup.data as unknown as Record<BackupStoreName, Record<string, unknown>[]>;
      const localTombstones = await readLocalTombstones(database);
      const lastSyncedAt = await getSetting<string | null>(SYNC_LAST_SYNCED_AT_KEY, null);

      const plan = computeMerge({
        localByStore,
        remoteByStore: validated.file.data as unknown as Record<BackupStoreName, Record<string, unknown>[]>,
        localTombstones,
        remoteTombstones: validated.file.tombstones,
        lastSyncedAt: lastSyncedAt ?? undefined,
        now: new Date(),
      });

      if (needsConfirmation(plan)) {
        // T-44-06-01/roadmap success criterion 2: a divergent merge NEVER
        // auto-commits — surface it for SyncMergeSummary to confirm.
        setState({ pendingMerge: { plan, target } });
        return;
      }

      // Nothing to confirm (in sync already, or local strictly ahead) —
      // apply any tombstone-only propagation and republish local state.
      await applyMerge(database, plan);
      await writeLocalSnapshotToFile(database, target);
    });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'Sync failed.' });
  } finally {
    syncCycleRunning = false;
    setState({ status: 'idle' });
  }
}

/** Commits a previously-surfaced pendingMerge: pre-merge snapshot (D-08)
 *  ALWAYS lands before applyMerge — the ordering the plan's own test
 *  contract locks in. */
async function confirmPendingMergeAction(database: Dexie): Promise<void> {
  const pending = state.pendingMerge;
  if (!pending) return;

  setState({ status: 'syncing', error: null });
  syncCycleRunning = true;
  try {
    await withSyncLock(async () => {
      const snapshot = await buildBackupFile(database);
      await setSetting<BackupFile>(SYNC_PRE_MERGE_SNAPSHOT_KEY, snapshot);
      setState({ canUndo: true });

      await applyMerge(database, pending.plan);
      await writeLocalSnapshotToFile(database, pending.target);
    });
    setState({ pendingMerge: null });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'Merge failed.' });
  } finally {
    syncCycleRunning = false;
    setState({ status: 'idle' });
  }
}

function cancelPendingMergeAction(): void {
  setState({ pendingMerge: null });
}

async function undoLastMergeAction(database: Dexie): Promise<void> {
  const snapshot = await getSetting<BackupFile | null>(SYNC_PRE_MERGE_SNAPSHOT_KEY, null);
  if (!snapshot) return;
  await restoreBackup(database, snapshot);
  window.location.reload();
}

async function setupSyncAction(database: Dexie): Promise<void> {
  setState({ error: null });
  const target = await selectSyncFolder();
  if (!target) return; // user cancelled the picker
  setState({ isConfigured: true });
  await runSyncCycle(database);
}

function scheduleAutoWrite(database: Dexie): void {
  // Skip while our OWN writes are still in flight (applyMerge/writeSyncFile
  // during a cycle also fire the Dexie hooks below) — otherwise a sync
  // cycle would perpetually re-schedule itself.
  if (syncCycleRunning) return;
  if (!state.isConfigured || syncCapability() !== 'auto') return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSyncCycle(database);
  }, DEBOUNCE_MS);
}

/** Registers a lightweight Dexie change signal (creating/updating/deleting
 *  hooks across every BACKUP_STORES table) that (re)schedules the debounced
 *  auto-write. Registered ONCE per module lifetime — every store write,
 *  including settings (routed through setSetting/stampAndPut), reschedules
 *  the same timer. */
function registerChangeListener(database: Dexie): void {
  if (dexieListenerRegistered) return;
  dexieListenerRegistered = true;
  for (const store of BACKUP_STORES) {
    const table = database.table(store);
    table.hook('creating', () => scheduleAutoWrite(database));
    table.hook('updating', () => scheduleAutoWrite(database));
    table.hook('deleting', () => scheduleAutoWrite(database));
  }
}

function ensureInitialized(database: Dexie): Promise<void> {
  if (!initPromise) {
    // Rule 2 (missing critical error handling): this runs unconditionally
    // on every mount of every component that calls useSyncFolder() —
    // including test/SSR-like environments with no IndexedDB or platform
    // globals, and real browsers in restrictive modes (private browsing
    // without IndexedDB). NEVER let this reject — an uncaught rejection
    // here would surface as an unhandled promise rejection on ordinary app
    // boot for users on those environments, and would break every other
    // component's tests that happen to render something mounting this hook.
    initPromise = (async () => {
      try {
        registerChangeListener(database);
        const capability = syncCapability();
        const [target, lastSyncedAt, snapshot] = await Promise.all([
          getPersistedSyncTarget(),
          getSetting<string | null>(SYNC_LAST_SYNCED_AT_KEY, null),
          getSetting<BackupFile | null>(SYNC_PRE_MERGE_SNAPSHOT_KEY, null),
        ]);
        setState({
          capability,
          isConfigured: target !== null,
          lastSyncedAt,
          canUndo: snapshot !== null,
        });
      } catch {
        // Sync is an opt-in enhancement (D-01) — a platform without the
        // required capabilities (or a test environment with no
        // IndexedDB/__IS_TAURI__) simply stays unconfigured/manual rather
        // than crashing the host component's mount.
        setState({ capability: 'manual', isConfigured: false });
      }
    })();
  }
  return initPromise;
}

async function checkOnLaunchAction(database: Dexie): Promise<void> {
  if (launchCheckRan) return;
  launchCheckRan = true;
  try {
    if (syncCapability() !== 'auto') return;
    await ensureInitialized(database);
    await runSyncCycle(database);
  } catch {
    // Same opt-in-enhancement reasoning as ensureInitialized above — never
    // let a platform-capability probe crash app boot.
  }
}

/**
 * Sync orchestration hook (SYNC-01 D-01/D-02/D-04/D-07/D-08). Composes the
 * Wave 1-2 primitives (syncLock, syncFileIO, syncMerge, applyMerge,
 * backupExport, backupRestore) into setup, a debounced locked auto-write,
 * a launch-time merge check, a confirm-gated commit with a pre-merge
 * snapshot, one-click undo, and the manual-capability fallback exposed via
 * `capability`.
 */
export function useSyncFolder(database: Dexie = db): UseSyncFolderResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureInitialized(database);
  }, [database]);

  const setupSync = useCallback(() => setupSyncAction(database), [database]);
  const syncNow = useCallback(() => runSyncCycle(database), [database]);
  const checkOnLaunch = useCallback(() => checkOnLaunchAction(database), [database]);
  const confirmMerge = useCallback(() => confirmPendingMergeAction(database), [database]);
  const cancelMerge = useCallback(() => cancelPendingMergeAction(), []);
  const undoLastMerge = useCallback(() => undoLastMergeAction(database), [database]);

  return {
    capability: snapshot.capability,
    isConfigured: snapshot.isConfigured,
    lastSyncedAt: snapshot.lastSyncedAt,
    pendingMerge: snapshot.pendingMerge,
    canUndo: snapshot.canUndo,
    error: snapshot.error,
    status: snapshot.status,
    setupSync,
    syncNow,
    checkOnLaunch,
    confirmMerge,
    cancelMerge,
    undoLastMerge,
  };
}
