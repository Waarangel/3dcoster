import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// useProAuth tests (Phase 43-03, PRO-01).
//
// Follows the project's ONLY component-mount test harness (createRoot + act,
// no @testing-library/react — see App.test.tsx for the origin of this idiom),
// with a minimal Probe component that surfaces the hook's return value.
//
// The supabaseClient module is mocked with a swappable holder so each test
// can choose between `null` (Tauri / unconfigured web — every action must
// no-op) and a scripted mock client (web auth flows).
// ---------------------------------------------------------------------------

type AuthCallback = (event: string, session: Session | null) => void;

interface MockClient {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
    signInWithOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  /** Test helper: fire the captured onAuthStateChange callback. */
  fireAuthChange: (event: string, session: Session | null) => void;
  /** Test helper: the unsubscribe spy handed back to the hook's effect. */
  unsubscribe: ReturnType<typeof vi.fn>;
}

function makeSession(email = 'maker@example.com'): Session {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'user-1', email, aud: 'authenticated' },
  } as unknown as Session;
}

function makeMockClient(options?: { persistedSession?: Session | null }): MockClient {
  let callback: AuthCallback | undefined;
  const unsubscribe = vi.fn();
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: options?.persistedSession ?? null } })),
      onAuthStateChange: vi.fn((cb: AuthCallback) => {
        callback = cb;
        return { data: { subscription: { unsubscribe } } };
      }),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    fireAuthChange: (event, session) => callback?.(event, session),
    unsubscribe,
  };
}

// Swappable mock holder — the getter re-resolves on every access so each
// test controls what `import { supabase }` sees at hook runtime.
let mockSupabase: MockClient | null = null;

vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

const { useProAuth } = await import('./useProAuth');
type ProAuth = ReturnType<typeof useProAuth>;

let latest: ProAuth;
function Probe() {
  latest = useProAuth();
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderProbe(): Promise<void> {
  await act(async () => {
    root!.render(<Probe />);
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  mockSupabase = null;
  vi.clearAllMocks();
});

describe('useProAuth — unavailable client (Tauri / unconfigured web)', () => {
  it('reports unavailable and every action is a safe no-op', async () => {
    mockSupabase = null;
    await renderProbe();

    expect(latest.status).toBe('unavailable');
    expect(latest.isSignedIn).toBe(false);
    expect(latest.session).toBeNull();
    expect(latest.user).toBeNull();

    // Both actions must resolve without touching anything (D-12: safe to
    // call unconditionally on desktop).
    let result: string | null = 'unset';
    await act(async () => {
      result = await latest.signInWithEmail('maker@example.com');
      await latest.signOut();
    });
    expect(result).toBeNull();
    expect(latest.status).toBe('unavailable');

    // verifyEmailCode (D-08 desktop OTP) is likewise a safe no-op when the
    // client is unavailable — never touches a null supabase.
    let codeResult: string | null = 'unset';
    await act(async () => {
      codeResult = await latest.verifyEmailCode('maker@example.com', '123456');
    });
    expect(codeResult).toBeNull();
    expect(latest.status).toBe('unavailable');
  });
});

describe('useProAuth — web client', () => {
  it('starts signed-out and seeds signed-in from a persisted session', async () => {
    const session = makeSession();
    mockSupabase = makeMockClient({ persistedSession: session });
    await renderProbe();

    expect(latest.isSignedIn).toBe(true);
    expect(latest.status).toBe('signed-in');
    expect(latest.user?.email).toBe('maker@example.com');
    expect(mockSupabase.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it('onAuthStateChange drives sign-in and sign-out state', async () => {
    mockSupabase = makeMockClient();
    await renderProbe();

    expect(latest.status).toBe('signed-out');
    expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);

    const session = makeSession('pro@example.com');
    await act(async () => {
      mockSupabase!.fireAuthChange('SIGNED_IN', session);
    });
    expect(latest.isSignedIn).toBe(true);
    expect(latest.status).toBe('signed-in');
    expect(latest.user?.email).toBe('pro@example.com');

    await act(async () => {
      mockSupabase!.fireAuthChange('SIGNED_OUT', null);
    });
    expect(latest.isSignedIn).toBe(false);
    expect(latest.status).toBe('signed-out');
    expect(latest.session).toBeNull();
  });

  it('signInWithEmail sends a magic link redirecting to /app and reports link-sent', async () => {
    mockSupabase = makeMockClient();
    await renderProbe();

    let result: string | null = 'unset';
    await act(async () => {
      result = await latest.signInWithEmail('maker@example.com');
    });

    expect(result).toBeNull();
    expect(latest.status).toBe('link-sent');
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'maker@example.com',
      options: {
        emailRedirectTo: window.location.origin + '/app',
        shouldCreateUser: true,
      },
    });
  });

  it('signInWithEmail surfaces the error message and returns to signed-out', async () => {
    mockSupabase = makeMockClient();
    mockSupabase.auth.signInWithOtp.mockResolvedValueOnce({
      error: { message: 'Email rate limit exceeded' },
    });
    await renderProbe();

    let result: string | null = null;
    await act(async () => {
      result = await latest.signInWithEmail('maker@example.com');
    });

    expect(result).toBe('Email rate limit exceeded');
    expect(latest.status).toBe('signed-out');
  });

  it('verifyEmailCode calls verifyOtp with type: email and the typed code as token', async () => {
    mockSupabase = makeMockClient();
    await renderProbe();

    let result: string | null = 'unset';
    await act(async () => {
      result = await latest.verifyEmailCode('maker@example.com', '123456');
    });

    expect(result).toBeNull();
    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'maker@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('verifyEmailCode passes an 8-digit code through untouched (hook is length-agnostic — production issues 8 digits)', async () => {
    mockSupabase = makeMockClient();
    await renderProbe();

    let result: string | null = 'unset';
    await act(async () => {
      result = await latest.verifyEmailCode('maker@example.com', '74359066');
    });

    expect(result).toBeNull();
    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'maker@example.com',
      token: '74359066',
      type: 'email',
    });
  });

  it('verifyEmailCode surfaces an error message on a wrong/expired code', async () => {
    mockSupabase = makeMockClient();
    mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Token has expired or is invalid' },
    });
    await renderProbe();

    let result: string | null = null;
    await act(async () => {
      result = await latest.verifyEmailCode('maker@example.com', '000000');
    });

    expect(result).toBe('Token has expired or is invalid');
  });

  it('verifyEmailCode success flips status to signed-in via onAuthStateChange', async () => {
    mockSupabase = makeMockClient();
    await renderProbe();

    const session = makeSession('pro@example.com');
    // Supabase's real verifyOtp() fires onAuthStateChange('SIGNED_IN', ...)
    // as a side effect of a successful exchange — the hook relies on the
    // SAME subscription already used for the magic-link flow, no extra
    // state juggling (plan Task 2 action).
    mockSupabase.auth.verifyOtp.mockImplementationOnce(async () => {
      mockSupabase!.fireAuthChange('SIGNED_IN', session);
      return { data: { session }, error: null };
    });

    let result: string | null = 'unset';
    await act(async () => {
      result = await latest.verifyEmailCode('pro@example.com', '654321');
    });

    expect(result).toBeNull();
    expect(latest.status).toBe('signed-in');
    expect(latest.isSignedIn).toBe(true);
  });

  it('signOut clears the session eagerly', async () => {
    const session = makeSession();
    mockSupabase = makeMockClient({ persistedSession: session });
    await renderProbe();
    expect(latest.isSignedIn).toBe(true);

    await act(async () => {
      await latest.signOut();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(latest.isSignedIn).toBe(false);
    expect(latest.status).toBe('signed-out');
  });

  it('unsubscribes the auth listener on unmount (effect cleanup)', async () => {
    mockSupabase = makeMockClient();
    await renderProbe();
    const { unsubscribe } = mockSupabase;
    expect(unsubscribe).not.toHaveBeenCalled();

    act(() => {
      root!.unmount();
    });
    root = null;

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useProAuth — resetSignIn (G-46-4 user-driven exit from link-sent)', () => {
  it('returns status to signed-out from link-sent', async () => {
    mockSupabase = makeMockClient();
    await renderProbe();

    await act(async () => {
      await latest.signInWithEmail('maker@example.com');
    });
    expect(latest.status).toBe('link-sent');

    act(() => {
      latest.resetSignIn();
    });

    expect(latest.status).toBe('signed-out');
  });

  it('is a no-op while signed in — never knocks a signed-in user back to signed-out', async () => {
    const session = makeSession();
    mockSupabase = makeMockClient({ persistedSession: session });
    await renderProbe();
    expect(latest.status).toBe('signed-in');

    act(() => {
      latest.resetSignIn();
    });

    expect(latest.status).toBe('signed-in');
    expect(latest.isSignedIn).toBe(true);
    expect(latest.session).not.toBeNull();
  });

  it('resolves to unavailable when the client is null', async () => {
    mockSupabase = null;
    await renderProbe();
    expect(latest.status).toBe('unavailable');

    act(() => {
      latest.resetSignIn();
    });

    expect(latest.status).toBe('unavailable');
  });
});
