// Phase 47-04 (SYNC-02) — cloudBlobIO.ts transport tests. Mocks
// `supabase.rpc`/`auth.getSession`/`channel` — no live Supabase project
// involved. Follows the project's `vi.mock('../lib/supabaseClient', ...)`
// getter pattern (useEntitlement.test.ts precedent) so reassigning
// `mockSupabase` between tests is picked up by cloudBlobIO.ts's live
// module binding.
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface RpcResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface FakeChannel {
  subscribe: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

/** Mirrors realtime-js's real (verified) behavior: calling `.subscribe(cb)`
 *  a second time on an already-joined channel is a silent no-op — `cb` is
 *  NEVER invoked again. `respondStatus` controls what the FIRST subscribe
 *  call reports. */
function makeFakeChannel(respondStatus: string | null = 'SUBSCRIBED'): FakeChannel {
  let joined = false;
  const channel: FakeChannel = {
    subscribe: vi.fn((cb?: (status: string, err?: Error) => void) => {
      if (joined) return channel; // realtime-js no-op: cb is never called again
      joined = respondStatus !== null;
      if (respondStatus !== null) cb?.(respondStatus);
      return channel;
    }),
    send: vi.fn(async () => ({ status: 'ok' })),
    on: vi.fn(() => channel),
  };
  return channel;
}

let mockRpc: ReturnType<typeof vi.fn>;
let mockChannelFn: ReturnType<typeof vi.fn>;
let mockRemoveChannel: ReturnType<typeof vi.fn>;
let mockGetSession: ReturnType<typeof vi.fn>;
let mockSetAuth: ReturnType<typeof vi.fn>;
let mockSupabase: {
  rpc: typeof mockRpc;
  auth: { getSession: typeof mockGetSession };
  channel: typeof mockChannelFn;
  removeChannel: typeof mockRemoveChannel;
  realtime: { setAuth: typeof mockSetAuth };
} | null = null;

vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

const settingsStore = new Map<string, string>();
vi.mock('../db/database', () => ({
  getSetting: vi.fn(async (key: string, defaultValue: unknown) =>
    settingsStore.has(key) ? JSON.parse(settingsStore.get(key)!) : defaultValue,
  ),
  setSetting: vi.fn(async (key: string, value: unknown) => {
    settingsStore.set(key, JSON.stringify(value));
  }),
}));

const {
  downloadBlob,
  uploadBlob,
  uploadWithRetry,
  resetCloudBlob,
  getLastKnownVersion,
  setLastKnownVersion,
  broadcastBlobUpdated,
  subscribeToCloudPeers,
} = await import('./cloudBlobIO');

const SIGNED_IN_SESSION = { data: { session: { user: { id: 'user-1' } } } };
const SIGNED_IN_SESSION_WITH_TOKEN = {
  data: { session: { user: { id: 'user-1' }, access_token: 'jwt-user-1' } },
};
const SIGNED_OUT_SESSION = { data: { session: null } };

function setSignedIn(): void {
  mockGetSession.mockResolvedValue(SIGNED_IN_SESSION);
}

function setSignedInWithToken(): void {
  mockGetSession.mockResolvedValue(SIGNED_IN_SESSION_WITH_TOKEN);
}

function rpcResult(result: RpcResult): void {
  mockRpc.mockResolvedValue(result);
}

beforeEach(() => {
  settingsStore.clear();
  mockRpc = vi.fn(async () => ({ data: null, error: null }) as RpcResult);
  mockChannelFn = vi.fn(() => makeFakeChannel());
  mockRemoveChannel = vi.fn(async () => ({ status: 'ok' }));
  mockGetSession = vi.fn().mockResolvedValue(SIGNED_OUT_SESSION);
  mockSetAuth = vi.fn().mockResolvedValue(undefined);
  mockSupabase = {
    rpc: mockRpc,
    auth: { getSession: mockGetSession },
    channel: mockChannelFn,
    removeChannel: mockRemoveChannel,
    realtime: { setAuth: mockSetAuth },
  };
});

describe('downloadBlob', () => {
  it('returns null when supabase is null (free-floor no-op)', async () => {
    mockSupabase = null;
    const result = await downloadBlob();
    expect(result).toBeNull();
  });

  it('returns null when no user is signed in — no rpc call made', async () => {
    const result = await downloadBlob();
    expect(result).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns null when the caller has no row yet', async () => {
    setSignedIn();
    rpcResult({ data: [], error: null });
    const result = await downloadBlob();
    expect(result).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('download_sync_blob');
  });

  it('returns { ciphertext, version } for an existing row', async () => {
    setSignedIn();
    rpcResult({ data: [{ ciphertext: 'cipher-abc', version: 3 }], error: null });
    const result = await downloadBlob();
    expect(result).toEqual({ ciphertext: 'cipher-abc', version: 3 });
  });

  it('throws a clear error on an RPC error', async () => {
    setSignedIn();
    rpcResult({ data: null, error: { message: 'boom' } });
    await expect(downloadBlob()).rejects.toThrow(/Cloud sync download failed/);
  });
});

describe('uploadBlob', () => {
  it('short-circuits with accepted:false and no network when supabase is null', async () => {
    mockSupabase = null;
    const result = await uploadBlob('cipher', 5);
    expect(result).toEqual({ newVersion: 5, accepted: false });
  });

  it('short-circuits with accepted:false when no user is signed in', async () => {
    const result = await uploadBlob('cipher', 5);
    expect(result).toEqual({ newVersion: 5, accepted: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('maps the RPC { new_version, accepted } row', async () => {
    setSignedIn();
    rpcResult({ data: [{ new_version: 6, accepted: true }], error: null });
    const result = await uploadBlob('cipher', 5);
    expect(result).toEqual({ newVersion: 6, accepted: true });
    expect(mockRpc).toHaveBeenCalledWith('upload_sync_blob', {
      p_ciphertext: 'cipher',
      p_expected_version: 5,
    });
  });

  it('reports a CAS rejection as accepted:false', async () => {
    setSignedIn();
    rpcResult({ data: [{ new_version: 9, accepted: false }], error: null });
    const result = await uploadBlob('cipher', 5);
    expect(result).toEqual({ newVersion: 9, accepted: false });
  });
});

describe('getLastKnownVersion / setLastKnownVersion', () => {
  it('defaults to 0 when nothing has been persisted', async () => {
    expect(await getLastKnownVersion()).toBe(0);
  });

  it('round-trips a persisted version', async () => {
    await setLastKnownVersion(42);
    expect(await getLastKnownVersion()).toBe(42);
  });
});

describe('uploadWithRetry', () => {
  it('is a no-op when supabase is null', async () => {
    mockSupabase = null;
    const reDerive = vi.fn(async () => 'never-called');
    await uploadWithRetry('cipher', reDerive);
    expect(reDerive).not.toHaveBeenCalled();
  });

  it('is a no-op when no user is signed in', async () => {
    const reDerive = vi.fn(async () => 'never-called');
    await uploadWithRetry('cipher', reDerive);
    expect(reDerive).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('persists the new version and returns on immediate acceptance', async () => {
    setSignedIn();
    rpcResult({ data: [{ new_version: 1, accepted: true }], error: null });
    const reDerive = vi.fn(async () => 'never-called');
    await uploadWithRetry('cipher', reDerive);
    expect(reDerive).not.toHaveBeenCalled();
    expect(await getLastKnownVersion()).toBe(1);
  });

  it('on a CAS reject, re-derives ciphertext and retries until accepted', async () => {
    setSignedIn();
    mockRpc
      .mockResolvedValueOnce({ data: [{ new_version: 5, accepted: false }], error: null })
      .mockResolvedValueOnce({ data: [{ new_version: 6, accepted: true }], error: null });
    const reDerive = vi.fn(async () => 'cipher-remerged');

    await uploadWithRetry('cipher-v1', reDerive, 3);

    expect(reDerive).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'upload_sync_blob', {
      p_ciphertext: 'cipher-remerged',
      p_expected_version: 0,
    });
    expect(await getLastKnownVersion()).toBe(6);
  });

  it('throws a bounded conflict error after maxAttempts rejections', async () => {
    setSignedIn();
    rpcResult({ data: [{ new_version: 1, accepted: false }], error: null });
    const reDerive = vi.fn(async () => 'still-conflicting');

    await expect(uploadWithRetry('cipher', reDerive, 3)).rejects.toThrow(
      /Cloud sync conflict could not resolve after 3 attempts/,
    );
    expect(reDerive).toHaveBeenCalledTimes(3);
  });
});

describe('resetCloudBlob', () => {
  it('is a no-op when supabase is null', async () => {
    mockSupabase = null;
    await resetCloudBlob();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('is a no-op when no user is signed in', async () => {
    await resetCloudBlob();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls reset_sync_blob and clears the persisted version', async () => {
    setSignedIn();
    await setLastKnownVersion(7);
    rpcResult({ data: true, error: null });
    await resetCloudBlob();
    expect(mockRpc).toHaveBeenCalledWith('reset_sync_blob');
    expect(await getLastKnownVersion()).toBe(0);
  });

  it('throws a clear error on an RPC error', async () => {
    setSignedIn();
    rpcResult({ data: null, error: { message: 'boom' } });
    await expect(resetCloudBlob()).rejects.toThrow(/Cloud sync reset failed/);
  });
});

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('broadcastBlobUpdated', () => {
  it('is a no-op when supabase is null', async () => {
    mockSupabase = null;
    await broadcastBlobUpdated('user-1', 3, '2026-07-24T00:00:00.000Z');
    expect(mockChannelFn).not.toHaveBeenCalled();
  });

  it('sends only { version, updatedAt } on the private sync:<userId> channel', async () => {
    const fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel);

    await broadcastBlobUpdated('user-bcast-a', 3, '2026-07-24T00:00:00.000Z');

    expect(mockChannelFn).toHaveBeenCalledWith('sync:user-bcast-a', { config: { private: true } });
    expect(fakeChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'blob-updated',
      payload: { version: 3, updatedAt: '2026-07-24T00:00:00.000Z' },
    });
    // D-08 minimal envelope — the ciphertext must never appear in the payload.
    const sentPayload = fakeChannel.send.mock.calls[0][0].payload as Record<string, unknown>;
    expect(Object.keys(sentPayload).sort()).toEqual(['updatedAt', 'version']);
  });

  it('pushes the signed-in access token via realtime.setAuth before joining (T-47-05 fix)', async () => {
    setSignedInWithToken();
    const fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel);

    await broadcastBlobUpdated('user-bcast-b', 3, '2026-07-24T00:00:00.000Z');

    expect(mockSetAuth).toHaveBeenCalledWith('jwt-user-1');
    // setAuth must resolve BEFORE the channel is asked to join.
    const setAuthOrder = mockSetAuth.mock.invocationCallOrder[0];
    const subscribeOrder = fakeChannel.subscribe.mock.invocationCallOrder[0];
    expect(setAuthOrder).toBeLessThan(subscribeOrder);
  });

  it('never removes the channel — it is shared with the peer listener (D-02 fix)', async () => {
    const fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel);

    await broadcastBlobUpdated('user-bcast-c', 3, '2026-07-24T00:00:00.000Z');

    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it('reuses the SAME channel object across repeated broadcasts on the same topic (no double-subscribe)', async () => {
    const fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel);

    await broadcastBlobUpdated('user-bcast-d', 1, '2026-07-24T00:00:00.000Z');
    await broadcastBlobUpdated('user-bcast-d', 2, '2026-07-24T00:00:01.000Z');

    // client.channel() is called once per broadcast (it internally dedupes,
    // mirrored here by always returning the same fakeChannel instance), but
    // the underlying join is only ever attempted once.
    expect(fakeChannel.subscribe).toHaveBeenCalledTimes(1);
    expect(fakeChannel.send).toHaveBeenCalledTimes(2);
  });

  it('resolves without throwing when the channel join errors out (best-effort notify)', async () => {
    const fakeChannel = makeFakeChannel('CHANNEL_ERROR');
    mockChannelFn.mockReturnValue(fakeChannel);

    await expect(
      broadcastBlobUpdated('user-bcast-e', 3, '2026-07-24T00:00:00.000Z'),
    ).resolves.toBeUndefined();
    expect(fakeChannel.send).not.toHaveBeenCalled();
  });
});

describe('subscribeToCloudPeers', () => {
  it('returns a callable no-op unsubscribe when supabase is null', () => {
    mockSupabase = null;
    const cb = vi.fn();
    const unsubscribe = subscribeToCloudPeers('user-1', cb);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
    expect(mockChannelFn).not.toHaveBeenCalled();
  });

  it('subscribes on the private sync:<userId> channel and forwards broadcast payloads', async () => {
    const fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel);
    const cb = vi.fn();

    const unsubscribe = subscribeToCloudPeers('user-sub-a', cb);

    expect(mockChannelFn).toHaveBeenCalledWith('sync:user-sub-a', { config: { private: true } });
    expect(fakeChannel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'blob-updated' },
      expect.any(Function),
    );

    const onHandler = fakeChannel.on.mock.calls[0][2] as (arg: {
      payload: { version: number; updatedAt: string };
    }) => void;
    onHandler({ payload: { version: 4, updatedAt: '2026-07-24T00:00:00.000Z' } });
    expect(cb).toHaveBeenCalledWith({ version: 4, updatedAt: '2026-07-24T00:00:00.000Z' });

    await flushMicrotasks();
    unsubscribe();
    expect(mockRemoveChannel).toHaveBeenCalledWith(fakeChannel);
  });

  it('surfaces a join failure via onError instead of failing silently (D-02 fix)', async () => {
    const fakeChannel = makeFakeChannel('CHANNEL_ERROR');
    mockChannelFn.mockReturnValue(fakeChannel);
    const cb = vi.fn();
    const onError = vi.fn();

    subscribeToCloudPeers('user-sub-b', cb, onError);
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/subscribe failed|CHANNEL_ERROR/i);
  });

  it('shares one channel with broadcastBlobUpdated on the same topic — a later broadcast never removes the peer listener', async () => {
    const fakeChannel = makeFakeChannel();
    mockChannelFn.mockReturnValue(fakeChannel);
    const cb = vi.fn();

    subscribeToCloudPeers('user-sub-c', cb);
    await flushMicrotasks();

    await broadcastBlobUpdated('user-sub-c', 5, '2026-07-24T00:00:00.000Z');

    expect(mockRemoveChannel).not.toHaveBeenCalled();
    // The broadcast reused the already-joined channel rather than re-subscribing.
    expect(fakeChannel.subscribe).toHaveBeenCalledTimes(1);

    // The peer listener is still live: simulating an incoming broadcast still reaches cb.
    const onHandler = fakeChannel.on.mock.calls[0][2] as (arg: {
      payload: { version: number; updatedAt: string };
    }) => void;
    onHandler({ payload: { version: 6, updatedAt: '2026-07-24T00:00:01.000Z' } });
    expect(cb).toHaveBeenCalledWith({ version: 6, updatedAt: '2026-07-24T00:00:01.000Z' });
  });
});
