import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { act } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Quote } from '../types';

// ---------------------------------------------------------------------------
// usePublishedQuote tests (Phase 43-04, PRO-02).
//
// Follows the project's ONLY component-mount test harness (createRoot + act —
// see useProAuth.test.tsx / App.test.tsx for the origin of this idiom).
// `useProAuth` is mocked directly (fixed session/isSignedIn per test) so
// these tests exercise publish/unpublish/refreshStatuses logic without
// going through the full magic-link auth state machine. `supabase` is
// mocked as a minimal fluent query-builder — every chain method returns the
// same thenable builder so `await supabase.from(...).eq(...).eq(...)` and
// `await supabase.from(...).select(...).eq(...).maybeSingle()` both resolve.
// ---------------------------------------------------------------------------

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface MockBuilder extends PromiseLike<QueryResult> {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function makeBuilder(result: QueryResult): MockBuilder {
  const resolved: QueryResult = { data: null, error: null, ...result };
  const builder: MockBuilder = {
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => resolved),
    then: (onfulfilled, onrejected) => Promise.resolve(resolved).then(onfulfilled, onrejected),
  };
  return builder;
}

function makeSession(userId = 'user-1'): Session {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: userId, email: 'maker@example.com', aud: 'authenticated' },
  } as unknown as Session;
}

function makeQuote(overrides?: Partial<Quote>): Quote {
  return {
    id: 'quote-1',
    quoteNumber: 1,
    printJobId: 'job-1',
    customerSnapshot: { name: 'Jane Doe', email: 'jane@example.com' },
    lineItemsSnapshot: {
      jobTitle: 'Custom Bracket',
      sellingPrice: 25,
      shippingCost: 0,
      resolvedTaxRate: 0,
      taxAmount: 0,
      currency: 'USD',
      notes: '',
      terms: '',
    },
    status: 'sent',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    sentAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  } as Quote;
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

const { usePublishedQuote } = await import('./usePublishedQuote');
type Hook = ReturnType<typeof usePublishedQuote>;

let latest: Hook;
let updateQuoteSpy: ReturnType<typeof vi.fn<(quote: Quote) => Promise<void>>>;

function Probe({ businessName }: { businessName?: string }) {
  latest = usePublishedQuote(businessName, updateQuoteSpy);
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderProbe(businessName?: string): Promise<void> {
  await act(async () => {
    root!.render(createElement(Probe, { businessName }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  updateQuoteSpy = vi.fn(async () => {});
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

describe('usePublishedQuote — publish', () => {
  it('throws when signed out', async () => {
    mockAuth = { session: null };
    mockSupabase = { from: vi.fn() };
    await renderProbe();

    await expect(latest.publish(makeQuote())).rejects.toThrow('Sign in');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('throws (and never inserts) when the user has no active entitlement (D-11)', async () => {
    mockAuth = { session: makeSession() };
    const fromSpy = vi.fn((table: string) => {
      if (table === 'entitlements') return makeBuilder({ data: null });
      throw new Error(`unexpected table: ${table}`);
    });
    mockSupabase = { from: fromSpy };
    await renderProbe();

    await expect(latest.publish(makeQuote())).rejects.toThrow('active Pro subscription');
    expect(fromSpy).toHaveBeenCalledWith('entitlements');
    expect(fromSpy).not.toHaveBeenCalledWith('hosted_quotes');
  });

  it('inserts a hosted_quotes row and updates the local Quote when entitled', async () => {
    mockAuth = { session: makeSession('user-42') };
    let insertPayload: Record<string, unknown> | undefined;
    const fromSpy = vi.fn((table: string) => {
      if (table === 'entitlements') return makeBuilder({ data: { status: 'active' } });
      if (table === 'hosted_quotes') {
        const builder = makeBuilder({ error: null });
        builder.insert = vi.fn((payload: Record<string, unknown>) => {
          insertPayload = payload;
          return builder;
        });
        return builder;
      }
      throw new Error(`unexpected table: ${table}`);
    });
    mockSupabase = { from: fromSpy };
    await renderProbe('Acme Prints');

    const quote = makeQuote();
    let url = '';
    await act(async () => {
      url = await latest.publish(quote);
    });

    expect(url).toMatch(/^https:\/\/3dcoster\.com\/q\/.+/);
    expect(insertPayload).toMatchObject({
      owner_id: 'user-42',
      status: 'published',
      customer_first_name: 'Jane', // D-08: first name only
    });
    expect(insertPayload?.snapshot).toMatchObject({
      jobTitle: 'Custom Bracket',
      businessName: 'Acme Prints',
    });
    // D-08: the full customerSnapshot (email) must never be posted.
    expect(JSON.stringify(insertPayload)).not.toContain('jane@example.com');

    expect(updateQuoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        publishStatus: 'published',
        publishedUrl: url,
        hostedToken: expect.any(String),
      }),
    );
  });

  it('omits businessName from the snapshot when none is provided', async () => {
    mockAuth = { session: makeSession() };
    let insertPayload: Record<string, unknown> | undefined;
    const fromSpy = vi.fn((table: string) => {
      if (table === 'entitlements') return makeBuilder({ data: { status: 'active' } });
      const builder = makeBuilder({ error: null });
      builder.insert = vi.fn((payload: Record<string, unknown>) => {
        insertPayload = payload;
        return builder;
      });
      return builder;
    });
    mockSupabase = { from: fromSpy };
    await renderProbe(undefined);

    await act(async () => {
      await latest.publish(makeQuote());
    });

    expect(insertPayload?.snapshot).not.toHaveProperty('businessName');
  });
});

describe('usePublishedQuote — unpublish (D-11: never reads entitlements)', () => {
  it('flips the hosted row + local Quote to unpublished without checking entitlements', async () => {
    mockAuth = { session: makeSession('user-42') };
    const fromSpy = vi.fn((table: string) => {
      if (table === 'hosted_quotes') return makeBuilder({ error: null });
      throw new Error(`unexpected table: ${table}`);
    });
    mockSupabase = { from: fromSpy };
    await renderProbe();

    const quote = makeQuote({ publishStatus: 'published', hostedToken: 'token-1' });
    await act(async () => {
      await latest.unpublish(quote);
    });

    expect(fromSpy).not.toHaveBeenCalledWith('entitlements');
    expect(updateQuoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ publishStatus: 'unpublished' }),
    );
  });

  it('no-ops when the quote has no hostedToken', async () => {
    mockAuth = { session: makeSession() };
    const fromSpy = vi.fn();
    mockSupabase = { from: fromSpy };
    await renderProbe();

    await act(async () => {
      await latest.unpublish(makeQuote());
    });

    expect(fromSpy).not.toHaveBeenCalled();
    expect(updateQuoteSpy).not.toHaveBeenCalled();
  });
});

describe('usePublishedQuote — refreshStatuses (D-11: never reads entitlements)', () => {
  it('pulls decision/decided_at/decision_note back onto published quotes', async () => {
    mockAuth = { session: makeSession('user-42') };
    const fromSpy = vi.fn((table: string) => {
      if (table === 'hosted_quotes') {
        return makeBuilder({
          data: [
            { token: 'token-1', decision: 'approved', decided_at: '2026-07-10T00:00:00Z', decision_note: 'Looks great' },
          ],
        });
      }
      throw new Error(`unexpected table: ${table}`);
    });
    mockSupabase = { from: fromSpy };
    await renderProbe();

    const quote = makeQuote({ publishStatus: 'published', hostedToken: 'token-1' });
    await act(async () => {
      await latest.refreshStatuses([quote]);
    });

    expect(fromSpy).not.toHaveBeenCalledWith('entitlements');
    expect(updateQuoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        hostedDecision: 'approved',
        hostedDecisionNote: 'Looks great',
      }),
    );
  });

  it('skips quotes that are not published or have no hostedToken (no network call)', async () => {
    mockAuth = { session: makeSession() };
    const fromSpy = vi.fn();
    mockSupabase = { from: fromSpy };
    await renderProbe();

    await act(async () => {
      await latest.refreshStatuses([makeQuote({ publishStatus: 'unpublished' }), makeQuote({})]);
    });

    expect(fromSpy).not.toHaveBeenCalled();
    expect(updateQuoteSpy).not.toHaveBeenCalled();
  });

  it('does not write when the pulled decision is unchanged from local state', async () => {
    mockAuth = { session: makeSession('user-42') };
    const fromSpy = vi.fn(() =>
      makeBuilder({
        data: [{ token: 'token-1', decision: 'approved', decided_at: '2026-07-10T00:00:00Z', decision_note: null }],
      }),
    );
    mockSupabase = { from: fromSpy };
    await renderProbe();

    const quote = makeQuote({
      publishStatus: 'published',
      hostedToken: 'token-1',
      hostedDecision: 'approved',
      hostedDecisionNote: undefined,
    });
    await act(async () => {
      await latest.refreshStatuses([quote]);
    });

    expect(updateQuoteSpy).not.toHaveBeenCalled();
  });
});
