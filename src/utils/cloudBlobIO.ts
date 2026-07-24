// Phase 47-04 (SYNC-02, D-01/D-02/D-07) — cloudBlobIO: the cloud transport
// layer, direct sibling of `syncFileIO.ts`. Where syncFileIO.ts moves the
// sync-file's bytes to/from a Dropbox-style folder, this module moves the
// SAME payload — already opaque CIPHERTEXT (produced by syncCrypto.ts, the
// hook's job, 47-03) — to/from one Supabase `sync_blobs` row per account.
//
// This module NEVER imports syncCrypto.ts and NEVER sees plaintext: it is
// pure transport, deliberately dumb about what the ciphertext contains.
//
// Cross-device lost-update defense (RESEARCH Pattern 1, T-47-04): the local
// Web Lock (syncLock.ts) only serializes tabs ON ONE DEVICE — it has no
// reach into a second physical device. The server-side compare-and-swap on
// `version` (supabase/migrations/0002_cloud_sync.sql upload_sync_blob) is
// what actually closes the cross-device race. uploadWithRetry implements
// the client side of that contract: read the last-known version, attempt
// the CAS write, and on rejection invoke the caller's re-fetch/re-merge/
// re-encrypt callback before retrying — bounded, never a silent lost write.
//
// Free-floor guard (PRO-01): every exported function that could touch the
// network short-circuits to a safe no-op/empty result when `supabase` is
// null (unconfigured deploy) or no user is signed in. Cloud sync is a
// signed-in Pro path; the free floor must never make a network call here.
import { supabase } from '../lib/supabaseClient';
import { getSetting, setSetting } from '../db/database';

/** Settings-store key for the last cloud blob version this device has observed. */
const CLOUD_SYNC_LAST_KNOWN_VERSION_KEY = 'cloudSyncLastKnownVersion';

/**
 * Resolves the signed-in user id, or `null` when `supabase` is unconfigured
 * or there is no active session. Every network-touching export below gates
 * on this first (PRO-01 free-floor guarantee).
 */
async function getSignedInUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Fetches the caller's own ciphertext + version via the `download_sync_blob`
 * RPC. Returns `null` when the caller has never uploaded a blob yet, OR when
 * `supabase` is null / no user is signed in (free-floor no-op, zero network).
 */
export async function downloadBlob(): Promise<{ ciphertext: string; version: number } | null> {
  const userId = await getSignedInUserId();
  if (!userId) return null;

  const { data, error } = await supabase!.rpc('download_sync_blob');
  if (error) {
    throw new Error(`Cloud sync download failed: ${error.message}`);
  }
  const row = data?.[0] as { ciphertext: string; version: number | string } | undefined;
  if (!row) return null;
  return { ciphertext: row.ciphertext, version: Number(row.version) };
}

/**
 * Calls the `upload_sync_blob` CAS RPC directly (single attempt, no retry —
 * `uploadWithRetry` below is the retry-aware entry point most callers want).
 * Returns `{ newVersion: expectedVersion, accepted: false }` with zero
 * network touched when `supabase` is null / no user is signed in.
 */
export async function uploadBlob(
  ciphertext: string,
  expectedVersion: number,
): Promise<{ newVersion: number; accepted: boolean }> {
  const userId = await getSignedInUserId();
  if (!userId) return { newVersion: expectedVersion, accepted: false };

  const { data, error } = await supabase!.rpc('upload_sync_blob', {
    p_ciphertext: ciphertext,
    p_expected_version: expectedVersion,
  });
  if (error) {
    throw new Error(`Cloud sync upload failed: ${error.message}`);
  }
  const row = data?.[0] as { new_version: number | string; accepted: boolean } | undefined;
  if (!row) return { newVersion: expectedVersion, accepted: false };
  return { newVersion: Number(row.new_version), accepted: row.accepted === true };
}

/**
 * Reads the last cloud blob version this device has observed. Defaults to 0
 * (no prior successful upload/download) — a local settings-store read only,
 * never network, so this stays safe to call unconditionally.
 */
export async function getLastKnownVersion(): Promise<number> {
  return getSetting<number>(CLOUD_SYNC_LAST_KNOWN_VERSION_KEY, 0);
}

/** Persists the last cloud blob version this device has observed. */
export async function setLastKnownVersion(version: number): Promise<void> {
  await setSetting<number>(CLOUD_SYNC_LAST_KNOWN_VERSION_KEY, version);
}

/**
 * The CAS upload + bounded retry loop (RESEARCH Pattern 1, the phase's core
 * new risk). Reads the last-known version, attempts `uploadBlob`; on
 * `accepted: true` persists the new version and returns. On a CAS rejection
 * (another device wrote first), invokes the caller-injected
 * `reDeriveCiphertext` — the hook's re-fetch -> decrypt -> re-merge ->
 * re-encrypt callback (computeMerge is pure/idempotent, safe to re-run) —
 * then retries with the freshly-derived ciphertext, up to `maxAttempts`.
 * Throws a clear conflict error if every attempt is rejected.
 *
 * No-op (zero network, zero retry) when `supabase` is null / no user is
 * signed in — the free floor never reaches this loop in practice, but the
 * guard is here for defense in depth (PRO-01).
 */
export async function uploadWithRetry(
  ciphertext: string,
  reDeriveCiphertext: () => Promise<string>,
  maxAttempts = 3,
): Promise<void> {
  const userId = await getSignedInUserId();
  if (!userId) return;

  let nextCiphertext = ciphertext;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const expected = await getLastKnownVersion();
    const { newVersion, accepted } = await uploadBlob(nextCiphertext, expected);
    if (accepted) {
      await setLastKnownVersion(newVersion);
      return;
    }
    // CAS rejected: someone else wrote first. Re-fetch/re-merge/re-encrypt via
    // the injected callback, then retry with the fresh ciphertext.
    nextCiphertext = await reDeriveCiphertext();
  }
  throw new Error(`Cloud sync conflict could not resolve after ${maxAttempts} attempts.`);
}

/**
 * Wipes the caller's server row (D-07 self-serve reset) and clears the
 * persisted last-known-version so a subsequent upload starts fresh at
 * version 0. No-op when `supabase` is null / no user is signed in.
 */
export async function resetCloudBlob(): Promise<void> {
  const userId = await getSignedInUserId();
  if (!userId) return;

  const { error } = await supabase!.rpc('reset_sync_blob');
  if (error) {
    throw new Error(`Cloud sync reset failed: ${error.message}`);
  }
  await setLastKnownVersion(0);
}
