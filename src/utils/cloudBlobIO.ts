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
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { getSetting, setSetting } from '../db/database';

/** Settings-store key for the last cloud blob version this device has observed. */
const CLOUD_SYNC_LAST_KNOWN_VERSION_KEY = 'cloudSyncLastKnownVersion';

/** Minimal Realtime notify envelope (D-08) — version + timestamp ONLY, never ciphertext. */
export interface CloudBlobUpdatedPayload {
  version: number;
  updatedAt: string;
}

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

// ---------------------------------------------------------------------------
// Realtime channel plumbing (UAT gap-closure, 47-07 Task 3).
//
// Root causes verified by reading the installed @supabase/supabase-js /
// @supabase/realtime-js source (not guessed):
//
// 1. `client.channel(topic, params)` (RealtimeClient.channel()) ALREADY
//    dedupes by topic string — it returns the SAME channel instance if one
//    is already registered for that topic. So the OLD code's
//    broadcastBlobUpdated, called after every publish, was NOT creating a
//    second independent channel — it was re-using the SAME channel object
//    subscribeToCloudPeers had already joined, then calling
//    `supabase.removeChannel(channel)` on it. That tore down the account's
//    ONLY listening channel after the very first publish in a session,
//    permanently killing real-time propagation for the rest of that session
//    on both ends (the exact "never appears on the other device" symptom).
// 2. `RealtimeChannel.subscribe(cb)` reads `this.socket.accessTokenValue`
//    SYNCHRONOUSLY when building the join payload. That value starts `null`
//    and is only populated by an async, un-awaited `_setAuthSafely('connect')`
//    kicked off from `RealtimeClient.connect()` — a real race: the FIRST
//    channel join of a session can go out before the signed-in JWT has been
//    fetched, joining as anon and getting silently rejected by
//    `realtime.messages`' `auth.uid()`-scoped RLS policy (T-47-05).
// 3. `RealtimeChannel.subscribe(cb)` is a silent no-op (never invokes `cb`
//    at all) when the channel is already joining/joined (`!isClosed()`) —
//    calling it a second time on the shared channel (as broadcastBlobUpdated
//    did) hangs forever with no resolve/reject, which is what tripped
//    withSyncLock's 30s critical-section watchdog on first sync.
//
// Fix shape: ONE shared, persistent channel per topic (never destroyed by a
// broadcast — only the peer-listener's own unsubscribe releases it),
// explicit `realtime.setAuth()` before every join, and a bounded join
// timeout so a hung/rejected join surfaces quickly instead of relying on the
// 30s outer watchdog.
// ---------------------------------------------------------------------------

/** Live Realtime channel per topic (`sync:<userId>`), shared between
 *  subscribeToCloudPeers (long-lived peer listener) and broadcastBlobUpdated
 *  (per-publish notifier) so neither call site can tear down the other's
 *  channel. */
const activeChannels = new Map<string, RealtimeChannel>();

/** In-flight/settled JOIN promise per channel — ensures only ONE `.subscribe()`
 *  call is ever made per channel object; a second call on an already
 *  non-closed channel is realtime-js's documented silent no-op. A rejected
 *  join is removed from this map so a later caller can retry a fresh join
 *  rather than replaying the same rejection forever. */
const channelJoinPromises = new WeakMap<RealtimeChannel, Promise<void>>();

/** Bounded wait for a channel join to settle (SUBSCRIBED / CHANNEL_ERROR /
 *  TIMED_OUT / CLOSED) — never hang the caller indefinitely even if the
 *  realtime server never replies at all. Comfortably below the 30s
 *  withSyncLock watchdog so a join failure surfaces on its own. */
const CHANNEL_JOIN_TIMEOUT_MS = 8_000;

function getSyncTopic(userId: string): string {
  return `sync:${userId}`;
}

function getOrCreateChannel(client: NonNullable<typeof supabase>, userId: string): RealtimeChannel {
  const topic = getSyncTopic(userId);
  let channel = activeChannels.get(topic);
  if (!channel) {
    channel = client.channel(topic, { config: { private: true } });
    activeChannels.set(topic, channel);
  }
  return channel;
}

function releaseChannel(client: NonNullable<typeof supabase>, userId: string): void {
  const topic = getSyncTopic(userId);
  const channel = activeChannels.get(topic);
  if (channel) {
    activeChannels.delete(topic);
    channelJoinPromises.delete(channel);
    void client.removeChannel(channel);
  }
}

/**
 * Pushes the current session's access token onto the Realtime socket BEFORE
 * a private-channel join. Best-effort: signed-out / token-fetch failure
 * leaves the join to fail on its own (surfaced via joinChannel's callback),
 * never throws.
 */
async function ensureRealtimeAuth(client: NonNullable<typeof supabase>): Promise<void> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    await client.realtime.setAuth(token);
  }
}

/** Joins `channel` at most once (cached by channel identity), rejecting on
 *  CHANNEL_ERROR/TIMED_OUT/CLOSED or after CHANNEL_JOIN_TIMEOUT_MS. */
function joinChannel(channel: RealtimeChannel): Promise<void> {
  let promise = channelJoinPromises.get(channel);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Realtime channel join timed out after ${CHANNEL_JOIN_TIMEOUT_MS}ms`));
      }, CHANNEL_JOIN_TIMEOUT_MS);
      channel.subscribe((status: string, err?: Error) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timer);
          reject(err ?? new Error(`Realtime channel subscribe failed: ${status}`));
        }
      });
    });
    channelJoinPromises.set(channel, promise);
    promise.catch(() => {
      channelJoinPromises.delete(channel);
    });
  }
  return promise;
}

/**
 * Broadcasts `{ version, updatedAt }` on the caller's private `sync:<userId>`
 * Realtime channel after a successful upload — the cloud analog of
 * `syncLock.ts`'s BroadcastChannel notify, but reaching every open device
 * on the account instead of just same-origin tabs on one device. The
 * payload carries ONLY version + updatedAt (D-08 minimal envelope) — the
 * ciphertext is NEVER broadcast. No-op when `supabase` is null.
 *
 * Never throws — this is best-effort notification only (D-08); a failed
 * join or send is swallowed so it can never block/fail the caller's publish
 * (useCloudSync.ts already treats this as fire-and-forget outside its lock).
 */
export async function broadcastBlobUpdated(
  userId: string,
  version: number,
  updatedAt: string,
): Promise<void> {
  if (!supabase) return;
  const client = supabase;
  const channel = getOrCreateChannel(client, userId);

  try {
    await ensureRealtimeAuth(client);
    await joinChannel(channel);
  } catch {
    return;
  }

  const payload: CloudBlobUpdatedPayload = { version, updatedAt };
  await channel.send({ type: 'broadcast', event: 'blob-updated', payload });
  // Deliberately NOT removed: this channel is shared with
  // subscribeToCloudPeers' long-lived peer listener (same topic, deduped by
  // supabase-js itself) — removing it here would kill that listener, which
  // was exactly the bug this fix closes.
}

/**
 * Subscribes to `{ version, updatedAt }` notify messages on the caller's
 * private `sync:<userId>` Realtime channel — open devices call this once to
 * learn when a new blob version has been uploaded elsewhere. Returns an
 * unsubscribe function (mirrors `syncLock.ts`'s subscribeToPeers contract).
 * No-op (callable, does-nothing unsubscribe) when `supabase` is null.
 *
 * `onError` (optional) is invoked with a friendly message if the channel
 * join fails or times out — the caller surfaces this into the hook's error
 * state instead of failing silently (UAT gap-closure 47-07).
 */
export function subscribeToCloudPeers(
  userId: string,
  cb: (payload: CloudBlobUpdatedPayload) => void,
  onError?: (message: string) => void,
): () => void {
  if (!supabase) return () => {};

  const client = supabase;
  const channel = getOrCreateChannel(client, userId);
  channel.on(
    'broadcast',
    { event: 'blob-updated' },
    ({ payload }: { payload: CloudBlobUpdatedPayload }) => cb(payload),
  );

  void (async () => {
    try {
      await ensureRealtimeAuth(client);
      await joinChannel(channel);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Cloud sync real-time connection failed.');
    }
  })();

  return () => {
    releaseChannel(client, userId);
  };
}
