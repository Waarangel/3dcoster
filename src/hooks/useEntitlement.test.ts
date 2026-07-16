import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// useEntitlement — Phase 43-06 (PRO-04).
//
// Follows the project's createRoot + act Probe harness (usePublishedQuote
// .test.ts precedent) with the same fluent query-builder supabase mock.
// Asserts the hook is STRICTLY read-only (never insert/update/delete on
// entitlements — the signature-verified webhook is the only writer) and
// that the Pro-status vocabulary matches what api/webhooks/paddle.ts
// writes: active + past_due count as Pro, canceled/paused do not, and
// there is no trial state anywhere (D-04).
// ---------------------------------------------------------------------------

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface MockBuilder extends PromiseLike<QueryResult> {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function makeBuilder(result: QueryResult): MockBuilder {
  const resolved: QueryResult = { data: null, error: null, ...result };
  const builder: MockBuilder = {
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => resolved),
    then: (onfulfilled, onrejected) => Promise.resolve(resolved).then(onfulfilled, onrejected),
  };
  return builder;
}

function makeSession(userId = 'user-1'): Session {
  return {
    access_token: 'jwt-token',
    user: { id: userId, email: 'maker@example.com', aud: 'authenticated' },
  } as unknown as Session;
}

let mockSupabase: { from: ReturnType<typeof vi.fn> } | null = null;
let mockAuth: { session: Session | null } = { session: null };

vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

vi.mock('./useProAuth', () => ({
  useProAuth: () => ({
    session: mockAuth.session,
    user: mockAuth.session?.user ?? null,
    isSignedIn: mockAuth.session !== null,
    status: mockAuth.session ? 'signed-in' : 'signed-out',
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const { useEntitlement, isProStatus } = await import('./useEntitlement');
type Hook = ReturnType<typeof useEntitlement>;

let latest: Hook;

function Probe() {
  latest = useEntitlement();
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderProbe(): Promise<void> {
  await act(async () => {
    root!.render(createElement(Probe));
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
  mockAuth = { session: null };
  vi.clearAllMocks();
});

describe('isProStatus (the single status-vocabulary home)', () => {
  it('accepts active and past_due (dunning grace) only', () => {
    expect(isProStatus('active')).toBe(true);
    expect(isProStatus('past_due')).toBe(true);
    expect(isProStatus('canceled')).toBe(false);
    expect(isProStatus('paused')).toBe(false);
    expect(isProStatus(null)).toBe(false);
    expect(isProStatus(undefined)).toBe(false);
  });

  it('rejects trialing — there is no trial state anywhere (D-04)', () => {
    expect(isProStatus('trialing')).toBe(false);
  });
});

describe('useEntitlement', () => {
  it('reports not-Pro and touches nothing when the supabase client is null', async () => {
    mockSupabase = null;
    mockAuth.session = makeSession();

    await renderProbe();

    expect(latest.isPro).toBe(false);
    expect(latest.plan).toBeNull();
    expect(latest.status).toBeNull();
    expect(latest.currentPeriodEnd).toBeNull();
  });

  it('reads nothing while signed out', async () => {
    const fromSpy = vi.fn(() => makeBuilder({ data: null }));
    mockSupabase = { from: fromSpy };
    mockAuth.session = null;

    await renderProbe();

    expect(fromSpy).not.toHaveBeenCalled();
    expect(latest.isPro).toBe(false);
  });

  it('reads only the OWN entitlements row (owner-scoped) when signed in', async () => {
    const builder = makeBuilder({
      data: { plan: 'monthly', status: 'active', current_period_end: '2026-08-14T00:00:00Z' },
    });
    const fromSpy = vi.fn(() => builder);
    mockSupabase = { from: fromSpy };
    mockAuth.session = makeSession('user-42');

    await renderProbe();

    expect(fromSpy).toHaveBeenCalledWith('entitlements');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-42');
    expect(latest.isPro).toBe(true);
    expect(latest.plan).toBe('monthly');
    expect(latest.status).toBe('active');
    expect(latest.currentPeriodEnd).toEqual(new Date('2026-08-14T00:00:00Z'));
  });

  it('treats past_due as Pro (grace) and canceled as not-Pro', async () => {
    const builder = makeBuilder({
      data: { plan: 'annual', status: 'past_due', current_period_end: '2026-08-01T00:00:00Z' },
    });
    mockSupabase = { from: vi.fn(() => builder) };
    mockAuth.session = makeSession();

    await renderProbe();
    expect(latest.isPro).toBe(true);

    const canceledBuilder = makeBuilder({
      data: { plan: 'annual', status: 'canceled', current_period_end: '2026-08-01T00:00:00Z' },
    });
    mockSupabase = { from: vi.fn(() => canceledBuilder) };
    await act(async () => {
      root!.unmount();
    });
    root = createRoot(container!);
    await renderProbe();

    expect(latest.isPro).toBe(false);
    expect(latest.status).toBe('canceled');
    // The canceled row still exposes its access-until date (lapse-aware UI).
    expect(latest.currentPeriodEnd).toEqual(new Date('2026-08-01T00:00:00Z'));
  });

  it('reports not-Pro when no entitlements row exists', async () => {
    const builder = makeBuilder({ data: null });
    mockSupabase = { from: vi.fn(() => builder) };
    mockAuth.session = makeSession();

    await renderProbe();

    expect(latest.isPro).toBe(false);
    expect(latest.plan).toBeNull();
    expect(latest.status).toBeNull();
  });

  it('NEVER writes — no insert/update/delete on any builder', async () => {
    const builder = makeBuilder({
      data: { plan: 'monthly', status: 'active', current_period_end: null },
    });
    mockSupabase = { from: vi.fn(() => builder) };
    mockAuth.session = makeSession();

    await renderProbe();
    await act(async () => {
      await latest.refresh();
    });

    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.update).not.toHaveBeenCalled();
    expect(builder.delete).not.toHaveBeenCalled();
  });

  it('refresh() re-reads the row', async () => {
    const builder = makeBuilder({ data: null });
    const fromSpy = vi.fn(() => builder);
    mockSupabase = { from: fromSpy };
    mockAuth.session = makeSession();

    await renderProbe();
    const callsAfterMount = fromSpy.mock.calls.length;

    await act(async () => {
      await latest.refresh();
    });

    expect(fromSpy.mock.calls.length).toBe(callsAfterMount + 1);
  });
});
