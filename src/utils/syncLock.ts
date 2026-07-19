// Phase 44-04 (SYNC-01) — Web Locks critical-section wrapper + BroadcastChannel
// peer notification.
//
// RESEARCH.md Pattern 1 + Anti-Patterns "Treating BroadcastChannel as the mutex":
// the multi-tab lost-update race (T-44-04-01) is solved by wrapping the ENTIRE
// read-merge-write cycle in a named exclusive Web Lock (navigator.locks.request),
// not by hand-rolling a localStorage-polling lock and NOT by using BroadcastChannel
// as if it provided mutual exclusion. BroadcastChannel has no built-in exclusion —
// it is a pub/sub message bus, used here ONLY to notify other same-origin tabs
// that the sync file changed after a lock-holder finishes writing. Web Locks is
// the actual mutex; BroadcastChannel is notification-only. Never conflate the two.
//
// T-44-04-02 (crashed tab holds lock): Web Locks auto-releases when the holding
// tab closes/crashes per spec, but a hung-but-alive callback (e.g. a stuck fetch)
// would otherwise hold the lock forever. The bounded timeout below defends against
// that narrower case.

/** Name of the exclusive Web Lock guarding the sync read-merge-write cycle. */
export const SYNC_LOCK_NAME = '3dcoster-sync-critical-section';

/** Name of the BroadcastChannel used for cross-tab "sync file changed" pings. */
const PEER_CHANNEL_NAME = '3dcoster-sync';

/** Message payload posted on the peer channel after a lock-holder writes. */
const PEER_MESSAGE = 'sync-file-changed';

/**
 * Bounded guard (T-44-04-02): if the locked callback runs longer than this, it
 * is treated as hung and the lock is released via rejection rather than held
 * indefinitely. 30s comfortably covers a real read-merge-write cycle (local
 * IndexedDB + a folder read/write) while still bounding a genuinely stuck run.
 */
const LOCK_TIMEOUT_MS = 30_000;

/**
 * Runs `fn` inside the exclusive `SYNC_LOCK_NAME` Web Lock, serializing it
 * against any other `withSyncLock` call (same tab or a different same-origin
 * tab/window) racing the same critical section. Falls back to running `fn`
 * directly — best-effort, no lock — when `navigator.locks` is unavailable
 * (older Safari/WebKitGTK); D-02 already restricts the AUTO sync path to
 * Chromium web + desktop, so this fallback is a narrow, accepted risk rather
 * than a silent race on the primary flow.
 */
export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!('locks' in navigator)) {
    return fn();
  }
  return navigator.locks.request(SYNC_LOCK_NAME, { mode: 'exclusive' }, async () =>
    withTimeout(fn(), LOCK_TIMEOUT_MS),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Sync critical section exceeded ${ms}ms — aborting to avoid lock starvation`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

let sharedPeerChannel: BroadcastChannel | null = null;

function getSharedPeerChannel(): BroadcastChannel {
  if (!sharedPeerChannel) {
    sharedPeerChannel = new BroadcastChannel(PEER_CHANNEL_NAME);
  }
  return sharedPeerChannel;
}

/**
 * Notifies other same-origin tabs that the sync file changed. Purely a
 * notification — carries no exclusion semantics (see file header).
 */
export function notifyPeers(): void {
  getSharedPeerChannel().postMessage(PEER_MESSAGE);
}

/**
 * Subscribes to peer "sync file changed" notifications. Returns an
 * unsubscribe function that closes the underlying BroadcastChannel.
 */
export function subscribeToPeers(cb: () => void): () => void {
  const channel = new BroadcastChannel(PEER_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data === PEER_MESSAGE) cb();
  };
  return () => channel.close();
}
