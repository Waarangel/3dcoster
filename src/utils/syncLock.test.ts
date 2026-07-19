// Phase 44-04 (SYNC-01) — withSyncLock (Web Locks critical section) +
// notifyPeers/subscribeToPeers (BroadcastChannel notification) tests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSyncLock, notifyPeers, subscribeToPeers, SYNC_LOCK_NAME } from './syncLock';

// ---------------------------------------------------------------------------
// A minimal navigator.locks.request mock that actually serializes callbacks
// the way the real exclusive Web Lock would — a promise chain, not a
// same-tick pass-through. This is what proves withSyncLock delegates
// exclusion to Web Locks rather than reimplementing it.
// ---------------------------------------------------------------------------
function createSerializingLocksMock() {
  let queue: Promise<unknown> = Promise.resolve();
  const request = vi.fn(
    (_name: string, _options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
      const run = queue.then(() => callback(null));
      // Swallow rejections in the internal chain so one failed holder doesn't
      // starve subsequent lock requests — same externally-visible `run`
      // promise still rejects for its own caller.
      queue = run.catch(() => undefined);
      return run;
    },
  );
  return { request };
}

describe('withSyncLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('serializes two racing withSyncLock calls through navigator.locks.request', async () => {
    const locksMock = createSerializingLocksMock();
    vi.stubGlobal('navigator', { locks: locksMock });

    const events: string[] = [];
    let resolveFirst: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const p1 = withSyncLock(async () => {
      events.push('first-start');
      await firstGate;
      events.push('first-end');
    });
    const p2 = withSyncLock(async () => {
      events.push('second-start');
      events.push('second-end');
    });

    // Flush microtasks — the second call must NOT have started yet because
    // the mock lock queues it behind the still-pending first call.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['first-start']);

    resolveFirst();
    await p1;
    await p2;

    expect(events).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
    expect(locksMock.request).toHaveBeenCalledTimes(2);
    expect(locksMock.request.mock.calls[0][0]).toBe(SYNC_LOCK_NAME);
    expect(locksMock.request.mock.calls[0][1]).toEqual({ mode: 'exclusive' });
  });

  it('degrades to best-effort (no lock) when navigator.locks is absent, without throwing', async () => {
    vi.stubGlobal('navigator', {});

    const result = await withSyncLock(async () => 'ran-without-lock');

    expect(result).toBe('ran-without-lock');
  });

  it('bounds a hung locked callback with a timeout so it cannot hold the lock forever', async () => {
    vi.useFakeTimers();
    const locksMock = {
      request: vi.fn((_name: string, _options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) =>
        callback(null),
      ),
    };
    vi.stubGlobal('navigator', { locks: locksMock });

    const hung = withSyncLock<never>(() => new Promise<never>(() => {}));
    const assertion = expect(hung).rejects.toThrow(/exceeded|lock starvation/i);

    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});

describe('notifyPeers / subscribeToPeers', () => {
  let unsubscribe: (() => void) | null = null;

  beforeEach(() => {
    unsubscribe = null;
  });

  afterEach(() => {
    unsubscribe?.();
  });

  it('delivers a notifyPeers() message to a subscribeToPeers() listener', async () => {
    const received: string[] = [];
    unsubscribe = subscribeToPeers(() => received.push('changed'));

    notifyPeers();

    // BroadcastChannel delivery is asynchronous even within the same process.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received).toEqual(['changed']);
  });

  it('unsubscribe stops further notifications from reaching the listener', async () => {
    const received: string[] = [];
    unsubscribe = subscribeToPeers(() => received.push('changed'));

    unsubscribe();
    unsubscribe = null;

    notifyPeers();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received).toEqual([]);
  });
});
