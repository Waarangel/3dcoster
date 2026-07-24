// Phase 47-04 (SYNC-02) — cloudBlobIO.ts transport tests. Mocks
// `supabase.rpc`/`auth.getSession` — no live Supabase project involved.
// Follows the project's `vi.mock('../lib/supabaseClient', ...)` getter
// pattern (useEntitlement.test.ts precedent) so reassigning `mockSupabase`
// between tests is picked up by cloudBlobIO.ts's live module binding.
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface RpcResult {
  data?: unknown;
  error?: { message: string } | null;
}

let mockRpc: ReturnType<typeof vi.fn>;
let mockGetSession: ReturnType<typeof vi.fn>;
let mockSupabase: {
  rpc: typeof mockRpc;
  auth: { getSession: typeof mockGetSession };
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

const { downloadBlob, uploadBlob, uploadWithRetry, resetCloudBlob, getLastKnownVersion, setLastKnownVersion } =
  await import('./cloudBlobIO');

const SIGNED_IN_SESSION = { data: { session: { user: { id: 'user-1' } } } };
const SIGNED_OUT_SESSION = { data: { session: null } };

function setSignedIn(): void {
  mockGetSession.mockResolvedValue(SIGNED_IN_SESSION);
}

function rpcResult(result: RpcResult): void {
  mockRpc.mockResolvedValue(result);
}

beforeEach(() => {
  settingsStore.clear();
  mockRpc = vi.fn(async () => ({ data: null, error: null }) as RpcResult);
  mockGetSession = vi.fn().mockResolvedValue(SIGNED_OUT_SESSION);
  mockSupabase = {
    rpc: mockRpc,
    auth: { getSession: mockGetSession },
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
