import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type Dexie from 'dexie';
import { db, getSetting, setSetting } from '../db/database';
import { withSyncLock } from '../utils/syncLock';
import { supabase } from '../lib/supabaseClient';
import { useProAuth } from './useProAuth';
import { useEntitlement } from './useEntitlement';
import {
  downloadBlob,
  uploadWithRetry,
  resetCloudBlob,
  getLastKnownVersion,
  setLastKnownVersion,
  broadcastBlobUpdated,
  subscribeToCloudPeers,
} from '../utils/cloudBlobIO';
import {
  encryptSyncFile,
  decryptSyncFile,
  deriveKeyFromPassphrase,
  deriveSaltFromAccountId,
  checkPassphraseStrength,
} from '../utils/syncCrypto';
import { cacheDerivedKey, getCachedDerivedKey, clearDerivedKey } from '../utils/syncKeyCache';
import { needsRiskyConfirmation, pushPreMergeSnapshot } from '../utils/cloudSyncGates';
import { validateSyncFile, computeMerge, type MergePlan } from '../utils/syncMerge';
import { applyMerge } from '../utils/applyMerge';
import { buildBackupFile } from '../utils/backupExport';
import { restoreBackup } from '../utils/backupRestore';
import { BACKUP_STORES, MAX_BACKUP_BYTES, type BackupFile, type BackupStoreName, type SyncFile, type SyncTombstone } from '../utils/backupSchema';

// ---------------------------------------------------------------------------
// Phase 47-05 (SYNC-02, D-02/D-03/D-04/D-09/D-10/D-11/D-13) — the cloud
// sync orchestration hook. Mirrors useSyncFolder.ts's exact shape (module-
// scoped singleton + useSyncExternalStore + one-time-init + debounce +
// confirm-gate) but drives the cloud transport instead of a folder, and
// composes DIFFERENT pieces underneath:
//
// Composition order (47-05-PLAN.md key_links, verbatim):
//   Dexie write -> scheduleCloudAutoWrite (CLOUD_DEBOUNCE_MS, D-03)
//     -> withSyncLock (SAME mutex name as file-sync, so the two never
//        interleave a read-merge-write critical section on one device)
//       -> downloadBlob (47-04) -> decryptSyncFile (47-03)
//         -> validateSyncFile + computeMerge (UNCHANGED Phase 44 core)
//           -> needsRiskyConfirmation / first-connect gate (D-09/D-10)
//             -> pushPreMergeSnapshot (D-11) -> applyMerge (UNCHANGED)
//               -> encryptSyncFile -> uploadWithRetry (CAS, 47-04)
//                 -> broadcastBlobUpdated (47-04)
//
// The merge core (computeMerge/applyMerge/validateSyncFile/buildBackupFile)
// is imported and reused VERBATIM — this hook never forks it. The SyncFile
// envelope this hook produces/consumes is byte-identical in shape to the
// one useSyncFolder.ts produces (assumption-delta invariant, 47-05-PLAN.md).
// ---------------------------------------------------------------------------

/** D-03: 3-5s debounce band — deliberately SEPARATE from useSyncFolder's
 *  15s DEBOUNCE_MS. Cloud sync aims for a "real-time" feel; file sync
 *  batches more aggressively since a folder write is a heavier operation. */
const CLOUD_DEBOUNCE_MS = 4_000;

const CLOUD_SYNC_ENABLED_KEY = 'cloudSyncEnabled';
const CLOUD_SYNC_ROLLING_SNAPSHOTS_KEY = 'cloudSyncRollingSnapshots';
const CLOUD_SYNC_LAST_SYNCED_AT_KEY = 'cloudSyncLastSyncedAt';
const CLOUD_SYNC_FIRST_CONNECT_DONE_KEY = 'cloudSyncFirstConnectDone';

export interface PendingCloudMerge {
  plan: MergePlan;
  remoteVersion: number;
  /** True when this device has never completed a confirmed cloud merge before (D-10). */
  isFirstConnect: boolean;
}

export interface UseCloudSyncResult {
  status: 'idle' | 'syncing';
  isEnabled: boolean;
  needsPassphrase: boolean;
  lastSyncedAt: string | null;
  pendingMerge: PendingCloudMerge | null;
  conflictNote: string | null;
  error: string | null;
  /** First-time enable: strength-checks the passphrase, derives+caches the key, then publishes the first snapshot. */
  setupCloudSync: (passphrase: string) => Promise<string | null>;
  /** New-device unlock: derives+caches the key for an ALREADY-enabled account, then runs the first-connect cycle. */
  enterPassphrase: (passphrase: string) => Promise<string | null>;
  syncNow: () => Promise<void>;
  checkOnLaunch: () => Promise<void>;
  confirmMerge: () => Promise<void>;
  cancelMerge: () => void;
  /** Restores the most recent D-11 rolling pre-merge snapshot. */
  restorePreMerge: () => Promise<void>;
  /** D-07 self-serve reset: wipes the server blob and this device's cached key, prompting a new passphrase. */
  resetCloudSync: () => Promise<void>;
  /** D-14 level-1 delete: wipes the server blob, this device's cached key, and disables cloud sync. */
  turnOffAndDeleteCloud: () => Promise<void>;
}

interface CloudPreMergeSnapshotEntry {
  mergedAt: string;
  snapshot: BackupFile;
}

interface CloudSyncState {
  status: 'idle' | 'syncing';
  isEnabled: boolean;
  needsPassphrase: boolean;
  lastSyncedAt: string | null;
  pendingMerge: PendingCloudMerge | null;
  conflictNote: string | null;
  error: string | null;
}

let state: CloudSyncState = {
  status: 'idle',
  isEnabled: false,
  needsPassphrase: false,
  lastSyncedAt: null,
  pendingMerge: null,
  conflictNote: null,
  error: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<CloudSyncState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CloudSyncState {
  return state;
}

// ---------------------------------------------------------------------------
// Auth/entitlement context — updated from the hook's effect (React owns the
// live user/isPro/isSignedIn values via useProAuth/useEntitlement), read by
// the module-scoped async cycle functions below. Every network-touching path
// gates through isCloudSyncActive() (D-13 lapse pause + PRO-01 free floor).
// ---------------------------------------------------------------------------
interface CloudAuthContext {
  userId: string | null;
  isPro: boolean;
  isSignedIn: boolean;
}

let authContext: CloudAuthContext = { userId: null, isPro: false, isSignedIn: false };

function isCloudSyncActive(): boolean {
  return supabase !== null && authContext.isSignedIn && authContext.isPro && authContext.userId !== null;
}

// ---------------------------------------------------------------------------
// One-time module wiring — guarded so remounting components never register
// duplicate Dexie hooks or re-run the async settings read twice.
// ---------------------------------------------------------------------------
let initPromise: Promise<void> | null = null;
let cloudDexieListenerRegistered = false;
let cloudDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSyncCycleRunning = false;
let cloudLaunchCheckRan = false;
let cloudPeerUnsubscribe: (() => void) | null = null;
let cloudPeerSubscribedUserId: string | null = null;

/** In-memory-only device id (syncMeta.deviceId is diagnostic metadata,
 *  never read by computeMerge) — NOT persisted, so this hook introduces no
 *  settings key beyond the four listed in 47-05-PLAN.md Artifacts. */
let cachedCloudDeviceId: string | null = null;
function getCloudDeviceId(): string {
  if (!cachedCloudDeviceId) {
    cachedCloudDeviceId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `cloud-device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return cachedCloudDeviceId;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes as Uint8Array<ArrayBuffer>;
}

async function readLocalTombstones(database: Dexie): Promise<SyncTombstone[]> {
  return database.table<SyncTombstone, string>('syncTombstones').toArray();
}

function summarizeMergePlan(plan: MergePlan): string {
  let added = 0;
  let updated = 0;
  let deleted = 0;
  for (const store of BACKUP_STORES) {
    const counts = plan.summary[store];
    added += counts.added;
    updated += counts.updated;
    deleted += counts.deleted;
  }
  const parts: string[] = [];
  if (added > 0) parts.push(`${added} added`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (deleted > 0) parts.push(`${deleted} deleted`);
  return parts.length > 0 ? parts.join(', ') : 'No changes to review.';
}

/** Builds+encrypts the CURRENT local DB state as a SyncFile ciphertext, ready to upload. */
async function buildAndEncryptCurrentSnapshot(database: Dexie, key: CryptoKey): Promise<string> {
  const backup = await buildBackupFile(database);
  const tombstones = await readLocalTombstones(database);
  const syncFile: SyncFile = {
    ...backup,
    tombstones,
    syncMeta: { deviceId: getCloudDeviceId(), lastSyncedAt: new Date().toISOString() },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(syncFile));
  const encrypted = await encryptSyncFile(bytes, key);
  return bytesToBase64(encrypted);
}

/**
 * Called by uploadWithRetry (47-04) when a CAS write is rejected — another
 * device wrote first. computeMerge is pure/idempotent (uploadWithRetry's own
 * doc comment), so this re-fetches the now-current remote blob, silently
 * re-merges it into the just-applied local state, then re-encrypts a fresh
 * snapshot for the retry. Best-effort: any failure here still falls through
 * to publishing the current local snapshot, so the bounded retry loop
 * (max 3 attempts) remains the outer guarantee against a silent lost write.
 */
async function reDeriveCiphertextOnConflict(database: Dexie, key: CryptoKey): Promise<string> {
  try {
    const remote = await downloadBlob();
    if (remote) {
      await setLastKnownVersion(remote.version);
      const combined = base64ToBytes(remote.ciphertext);
      const plaintext = await decryptSyncFile(combined, key);
      const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
      const validated = validateSyncFile(parsed);
      if (validated.ok) {
        const localBackup = await buildBackupFile(database);
        const localTombstones = await readLocalTombstones(database);
        const lastSyncedAtRaw = await getSetting<string | null>(CLOUD_SYNC_LAST_SYNCED_AT_KEY, null);
        const plan = computeMerge({
          localByStore: localBackup.data as unknown as Record<BackupStoreName, Record<string, unknown>[]>,
          remoteByStore: validated.file.data as unknown as Record<BackupStoreName, Record<string, unknown>[]>,
          localTombstones,
          remoteTombstones: validated.file.tombstones,
          lastSyncedAt: lastSyncedAtRaw ?? undefined,
          now: new Date(),
        });
        await applyMerge(database, plan);
      }
    }
  } catch {
    // Best-effort re-merge — fall through to re-encrypting the current
    // local state either way; uploadWithRetry's bounded loop still protects
    // against a silent lost write.
  }
  return buildAndEncryptCurrentSnapshot(database, key);
}

/** Encrypts+uploads the current local snapshot, then broadcasts the new version to peers (D-02/D-08). */
async function publishLocalSnapshot(database: Dexie, key: CryptoKey): Promise<void> {
  const ciphertext = await buildAndEncryptCurrentSnapshot(database, key);
  await uploadWithRetry(ciphertext, () => reDeriveCiphertextOnConflict(database, key));

  const now = new Date().toISOString();
  await setSetting(CLOUD_SYNC_LAST_SYNCED_AT_KEY, now);
  setState({ lastSyncedAt: now });

  if (authContext.userId) {
    const version = await getLastKnownVersion();
    await broadcastBlobUpdated(authContext.userId, version, now);
  }
}

/** D-11: rolling pre-merge snapshot ALWAYS lands before applyMerge, for every silently-OR-confirm-applied merge. */
async function takePreMergeSnapshotAndApply(database: Dexie, plan: MergePlan): Promise<void> {
  const backup = await buildBackupFile(database);
  const existing = await getSetting<CloudPreMergeSnapshotEntry[]>(CLOUD_SYNC_ROLLING_SNAPSHOTS_KEY, []);
  const entry: CloudPreMergeSnapshotEntry = { mergedAt: new Date().toISOString(), snapshot: backup };
  const next = pushPreMergeSnapshot(existing, entry, new Date());
  await setSetting(CLOUD_SYNC_ROLLING_SNAPSHOTS_KEY, next);
  await applyMerge(database, plan);
}

/** The locked download -> decrypt -> merge -> (silent-apply | surface pendingMerge) -> publish cycle. */
async function cloudSyncCycleInner(database: Dexie, key: CryptoKey): Promise<void> {
  const remote = await downloadBlob();

  if (remote === null) {
    // Nothing uploaded to this account yet — this device publishes first.
    await publishLocalSnapshot(database, key);
    await setSetting(CLOUD_SYNC_FIRST_CONNECT_DONE_KEY, true);
    return;
  }

  await setLastKnownVersion(remote.version);

  const combined = base64ToBytes(remote.ciphertext);
  if (combined.byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Cloud sync data is unexpectedly large — refusing to merge.');
  }

  let plaintext: Uint8Array<ArrayBuffer>;
  try {
    plaintext = await decryptSyncFile(combined, key);
  } catch {
    throw new Error('Could not decrypt your cloud sync data — check your passphrase, or reset cloud sync from Settings.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error('Cloud sync data is not valid JSON — it may be corrupted.');
  }

  const validated = validateSyncFile(parsed);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const localBackup = await buildBackupFile(database);
  const localByStore = localBackup.data as unknown as Record<BackupStoreName, Record<string, unknown>[]>;
  const localTombstones = await readLocalTombstones(database);
  const lastSyncedAtRaw = await getSetting<string | null>(CLOUD_SYNC_LAST_SYNCED_AT_KEY, null);
  const now = new Date();

  const plan = computeMerge({
    localByStore,
    remoteByStore: validated.file.data as unknown as Record<BackupStoreName, Record<string, unknown>[]>,
    localTombstones,
    remoteTombstones: validated.file.tombstones,
    lastSyncedAt: lastSyncedAtRaw ?? undefined,
    now,
  });

  const firstConnectDone = await getSetting<boolean>(CLOUD_SYNC_FIRST_CONNECT_DONE_KEY, false);
  const isFirstConnect = !firstConnectDone;
  const risky = needsRiskyConfirmation(plan, lastSyncedAtRaw ? new Date(lastSyncedAtRaw) : undefined, now);

  if (isFirstConnect || risky) {
    // D-09/D-10: never auto-commit the first connect on a device, or a
    // risky merge — surface it for confirmMerge() to apply.
    setState({
      pendingMerge: { plan, remoteVersion: remote.version, isFirstConnect },
      conflictNote: summarizeMergePlan(plan),
    });
    return;
  }

  // Routine merge — apply silently (D-09) after taking the D-11 snapshot.
  await takePreMergeSnapshotAndApply(database, plan);
  await publishLocalSnapshot(database, key);
}

async function runCloudSyncCycle(database: Dexie): Promise<void> {
  if (!isCloudSyncActive() || !state.isEnabled) return;
  const userId = authContext.userId;
  if (!userId) return;

  const key = await getCachedDerivedKey(userId);
  if (!key) {
    // Pitfall 5: signed-in is not the same as having the derived key on
    // THIS device — never call download/decrypt without it.
    setState({ needsPassphrase: true });
    return;
  }

  setState({ needsPassphrase: false, status: 'syncing', error: null });
  cloudSyncCycleRunning = true;
  try {
    await withSyncLock(async () => {
      await cloudSyncCycleInner(database, key);
    });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'Cloud sync failed.' });
  } finally {
    cloudSyncCycleRunning = false;
    setState({ status: 'idle' });
  }
}

/** D-11: applies a previously-surfaced pendingMerge, snapshot-first, then publishes. */
async function confirmPendingCloudMergeAction(database: Dexie): Promise<void> {
  const pending = state.pendingMerge;
  if (!pending || !isCloudSyncActive() || !authContext.userId) return;

  const key = await getCachedDerivedKey(authContext.userId);
  if (!key) {
    setState({ needsPassphrase: true });
    return;
  }

  setState({ status: 'syncing', error: null });
  cloudSyncCycleRunning = true;
  try {
    await withSyncLock(async () => {
      await takePreMergeSnapshotAndApply(database, pending.plan);
      await publishLocalSnapshot(database, key);
      await setSetting(CLOUD_SYNC_FIRST_CONNECT_DONE_KEY, true);
    });
    setState({ pendingMerge: null, conflictNote: null });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'Cloud merge failed.' });
  } finally {
    cloudSyncCycleRunning = false;
    setState({ status: 'idle' });
  }
}

function cancelPendingCloudMergeAction(): void {
  setState({ pendingMerge: null, conflictNote: null });
}

async function restorePreMergeAction(database: Dexie): Promise<void> {
  const existing = await getSetting<CloudPreMergeSnapshotEntry[]>(CLOUD_SYNC_ROLLING_SNAPSHOTS_KEY, []);
  const latest = existing[existing.length - 1];
  if (!latest) return;
  await restoreBackup(database, latest.snapshot);
  window.location.reload();
}

async function setupCloudSyncAction(database: Dexie, passphrase: string): Promise<string | null> {
  if (!isCloudSyncActive() || !authContext.userId) {
    return 'Cloud sync requires an active Pro subscription and a signed-in account.';
  }
  const strength = await checkPassphraseStrength(passphrase);
  if (!strength.ok) {
    return strength.feedback.warning || 'Choose a stronger passphrase.';
  }

  const salt = await deriveSaltFromAccountId(authContext.userId);
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  await cacheDerivedKey(authContext.userId, key);
  await setSetting(CLOUD_SYNC_ENABLED_KEY, true);
  setState({ isEnabled: true, needsPassphrase: false, error: null });

  await runCloudSyncCycle(database);
  return null;
}

async function enterPassphraseAction(database: Dexie, passphrase: string): Promise<string | null> {
  if (!isCloudSyncActive() || !authContext.userId) {
    return 'Cloud sync requires an active Pro subscription and a signed-in account.';
  }

  const salt = await deriveSaltFromAccountId(authContext.userId);
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  await cacheDerivedKey(authContext.userId, key);
  setState({ needsPassphrase: false, error: null });

  await runCloudSyncCycle(database);
  return null;
}

async function resetCloudSyncAction(): Promise<void> {
  if (!isCloudSyncActive()) return;
  await resetCloudBlob();
  if (authContext.userId) await clearDerivedKey(authContext.userId);
  await setLastKnownVersion(0);
  await setSetting(CLOUD_SYNC_FIRST_CONNECT_DONE_KEY, false);
  setState({ needsPassphrase: true, pendingMerge: null, conflictNote: null, lastSyncedAt: null, error: null });
}

async function turnOffAndDeleteCloudAction(): Promise<void> {
  if (!isCloudSyncActive()) return;
  await resetCloudBlob();
  if (authContext.userId) await clearDerivedKey(authContext.userId);
  await setSetting(CLOUD_SYNC_ENABLED_KEY, false);
  await setSetting(CLOUD_SYNC_FIRST_CONNECT_DONE_KEY, false);
  setState({ isEnabled: false, needsPassphrase: false, pendingMerge: null, conflictNote: null, lastSyncedAt: null, error: null });
}

function scheduleCloudAutoWrite(database: Dexie): void {
  // Skip while our OWN writes are still in flight (applyMerge/buildBackupFile
  // during a cycle also fire the Dexie hooks below) — otherwise a cycle
  // would perpetually re-schedule itself.
  if (cloudSyncCycleRunning) return;
  if (!isCloudSyncActive() || !state.isEnabled) return;
  if (cloudDebounceTimer) clearTimeout(cloudDebounceTimer);
  cloudDebounceTimer = setTimeout(() => {
    cloudDebounceTimer = null;
    void runCloudSyncCycle(database);
  }, CLOUD_DEBOUNCE_MS);
}

function registerCloudChangeListener(database: Dexie): void {
  if (cloudDexieListenerRegistered) return;
  cloudDexieListenerRegistered = true;
  for (const store of BACKUP_STORES) {
    const table = database.table(store);
    table.hook('creating', () => scheduleCloudAutoWrite(database));
    table.hook('updating', () => scheduleCloudAutoWrite(database));
    table.hook('deleting', () => scheduleCloudAutoWrite(database));
  }
}

/** D-02: subscribes once per signed-in account to the private Realtime channel — a peer upload triggers a cycle. */
function ensureCloudPeerSubscription(database: Dexie): void {
  if (!isCloudSyncActive() || !authContext.userId) return;
  if (cloudPeerSubscribedUserId === authContext.userId) return;
  if (cloudPeerUnsubscribe) {
    cloudPeerUnsubscribe();
    cloudPeerUnsubscribe = null;
  }
  cloudPeerSubscribedUserId = authContext.userId;
  const userId = authContext.userId;
  cloudPeerUnsubscribe = subscribeToCloudPeers(userId, () => {
    void runCloudSyncCycle(database);
  });
}

/** Refreshes `needsPassphrase` from the device-local key cache WITHOUT touching the network (Pitfall 5). */
async function refreshNeedsPassphraseState(): Promise<void> {
  if (!isCloudSyncActive() || !authContext.userId) return;
  const enabled = await getSetting<boolean>(CLOUD_SYNC_ENABLED_KEY, false);
  if (!enabled) return;
  const key = await getCachedDerivedKey(authContext.userId);
  setState({ needsPassphrase: key === null });
}

function ensureInitialized(database: Dexie): Promise<void> {
  if (!initPromise) {
    // Rule 2 (missing critical error handling): never let this reject — an
    // uncaught rejection here would surface as an unhandled promise
    // rejection on ordinary app boot for users on environments without
    // IndexedDB/platform globals (mirrors useSyncFolder.ts's ensureInitialized).
    initPromise = (async () => {
      try {
        registerCloudChangeListener(database);
        const [enabled, lastSyncedAt] = await Promise.all([
          getSetting<boolean>(CLOUD_SYNC_ENABLED_KEY, false),
          getSetting<string | null>(CLOUD_SYNC_LAST_SYNCED_AT_KEY, null),
        ]);
        setState({ isEnabled: enabled, lastSyncedAt });
      } catch {
        setState({ isEnabled: false });
      }
    })();
  }
  return initPromise;
}

async function checkOnLaunchAction(database: Dexie): Promise<void> {
  if (cloudLaunchCheckRan) return;
  cloudLaunchCheckRan = true;
  try {
    await ensureInitialized(database);
    if (!isCloudSyncActive()) return;
    await runCloudSyncCycle(database);
  } catch {
    // Sync is an opt-in Pro enhancement — never crash app boot.
  }
}

/**
 * Cloud sync orchestration hook (SYNC-02 D-02/D-03/D-04/D-09/D-10/D-11/D-13).
 * Composes the syncCrypto (47-03) + cloudBlobIO (47-04) primitives with the
 * UNCHANGED Phase 44 merge core into a real-time, mostly-silent, zero-
 * knowledge cloud sync experience — first connect and risky merges gated,
 * everything else applied silently, snapshot-protected, lapse-paused, and
 * free-floor-inert.
 */
export function useCloudSync(database: Dexie = db): UseCloudSyncResult {
  const { user, isSignedIn } = useProAuth();
  const { isPro } = useEntitlement();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureInitialized(database);
  }, [database]);

  const userId = user?.id ?? null;
  useEffect(() => {
    authContext = { userId, isPro, isSignedIn };
    if (isCloudSyncActive()) {
      ensureCloudPeerSubscription(database);
      void refreshNeedsPassphraseState();
    }
  }, [database, userId, isPro, isSignedIn]);

  const setupCloudSync = useCallback(
    (passphrase: string) => setupCloudSyncAction(database, passphrase),
    [database],
  );
  const enterPassphrase = useCallback(
    (passphrase: string) => enterPassphraseAction(database, passphrase),
    [database],
  );
  const syncNow = useCallback(() => runCloudSyncCycle(database), [database]);
  const checkOnLaunch = useCallback(() => checkOnLaunchAction(database), [database]);
  const confirmMerge = useCallback(() => confirmPendingCloudMergeAction(database), [database]);
  const cancelMerge = useCallback(() => cancelPendingCloudMergeAction(), []);
  const restorePreMerge = useCallback(() => restorePreMergeAction(database), [database]);
  const resetCloudSync = useCallback(() => resetCloudSyncAction(), []);
  const turnOffAndDeleteCloud = useCallback(() => turnOffAndDeleteCloudAction(), []);

  return {
    status: snapshot.status,
    isEnabled: snapshot.isEnabled,
    needsPassphrase: snapshot.needsPassphrase,
    lastSyncedAt: snapshot.lastSyncedAt,
    pendingMerge: snapshot.pendingMerge,
    conflictNote: snapshot.conflictNote,
    error: snapshot.error,
    setupCloudSync,
    enterPassphrase,
    syncNow,
    checkOnLaunch,
    confirmMerge,
    cancelMerge,
    restorePreMerge,
    resetCloudSync,
    turnOffAndDeleteCloud,
  };
}
