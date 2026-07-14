// @vitest-environment node
/**
 * tests/security/hosted-quote-404-indistinguishable.test.ts
 *
 * PRO-03 core regression test (D-16 non-enumerability): unpublished,
 * expired, and never-existed `/q/[token]` requests must return the SAME
 * HTTP 404 status and byte-identical body — a crawler, monitoring tool, or
 * attacker probing tokens must never be able to distinguish "this token
 * never existed" from "this token existed but the maker unpublished it" or
 * "this token existed but expired."
 *
 * Also covers: malformed-token rejection before any RPC call, the
 * noindex/no-store header pair on every response, XSS-safe rendering of
 * untrusted snapshot content, the 200 render's required content (line
 * items, "Prepared for {first name}", Powered-by footer), and the one-shot
 * approve/decline write path (D-15).
 *
 * `fetch` is mocked at the global level — api/lib/supabaseRest.ts calls the
 * ambient `fetch`, so no HTTP server or real Supabase project is needed for
 * this file (that live-network check is tests/security/hosted-quote-enumerability.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../api/q/[token]';

const EXPIRED_TOKEN = '33333333-3333-4333-8333-333333333333';
const UNPUBLISHED_TOKEN = '44444444-4444-4444-8444-444444444444';
const NEVER_EXISTED_TOKEN = '55555555-5555-4555-8555-555555555555';
const PUBLISHED_TOKEN = '66666666-6666-4666-8666-666666666666';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseRpcBody(init: RequestInit | undefined): Record<string, unknown> {
  if (!init?.body) return {};
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

function baseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    snapshot: {
      jobTitle: 'Custom Bracket',
      sellingPrice: 42.5,
      shippingCost: 0,
      resolvedTaxRate: 0,
      taxAmount: 0,
      currency: 'USD',
      notes: '',
      terms: '',
    },
    customer_first_name: 'Riley',
    status: 'published',
    decision: null,
    decided_at: null,
    decision_note: null,
    expires_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  vi.restoreAllMocks();
});

describe('D-16: unpublished / expired / never-existed render the SAME 404', () => {
  it('returns byte-identical 404 status + body across all three cases', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = parseRpcBody(init);
      if (body.p_token === EXPIRED_TOKEN) {
        // The RPC only filters status='published' — an expired-but-published
        // row is still returned; the handler must apply the expiry check.
        return jsonResponse([baseRow({ expires_at: '2000-01-01T00:00:00Z' })]);
      }
      // Unpublished (status != 'published') and never-existed both resolve
      // to zero rows from the RPC — identical shape, by design (D-16).
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const unpublishedRes = await handler(new Request(`http://localhost/q/${UNPUBLISHED_TOKEN}`));
    const neverExistedRes = await handler(new Request(`http://localhost/q/${NEVER_EXISTED_TOKEN}`));
    const expiredRes = await handler(new Request(`http://localhost/q/${EXPIRED_TOKEN}`));

    expect(unpublishedRes.status).toBe(404);
    expect(neverExistedRes.status).toBe(404);
    expect(expiredRes.status).toBe(404);

    const [unpublishedBody, neverExistedBody, expiredBody] = await Promise.all([
      unpublishedRes.text(),
      neverExistedRes.text(),
      expiredRes.text(),
    ]);

    expect(unpublishedBody).toBe(neverExistedBody);
    expect(neverExistedBody).toBe(expiredBody);
  });

  it('rejects malformed tokens before any RPC call, with the same 404 body as the other cases', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const malformedRes = await handler(new Request('http://localhost/q/not-a-uuid'));
    expect(malformedRes.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();

    const unpublishedRes = await handler(new Request(`http://localhost/q/${UNPUBLISHED_TOKEN}`));

    const [malformedBody, unpublishedBody] = await Promise.all([
      malformedRes.text(),
      unpublishedRes.text(),
    ]);
    expect(malformedBody).toBe(unpublishedBody);
  });

  it('sets X-Robots-Tag: noindex and Cache-Control: no-store on 404 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])));
    const res = await handler(new Request(`http://localhost/q/${NEVER_EXISTED_TOKEN}`));
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('valid published render (D-05/D-06/D-08)', () => {
  it('renders 200 with line items, "Prepared for {first name}", and the Powered-by footer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([baseRow()])),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toContain('Prepared for Riley');
    expect(body).toContain('Custom Bracket');
    expect(body).toContain('Powered by');
    expect(body).toContain('3DCoster');
  });

  it('escapes untrusted snapshot/customer content to prevent stored XSS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          baseRow({
            snapshot: {
              jobTitle: '<script>alert(1)</script>',
              sellingPrice: 1,
              shippingCost: 0,
              resolvedTaxRate: 0,
              taxAmount: 0,
              currency: 'USD',
              notes: '',
              terms: '',
            },
            customer_first_name: '<img src=x onerror=alert(2)>',
          }),
        ]),
      ),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();
    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).not.toContain('<img src=x onerror=alert(2)>');
  });
});

describe('D-15: approve/decline is one-shot', () => {
  it('records a decision, renders the locked state, and a second write attempt cannot change it', async () => {
    let decided = false;

    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes('/rpc/approve_quote_decision')) {
        if (decided) {
          // D-15 DB-level guard: a second write against an already-decided
          // row is rejected — the RPC returns false, nothing changes.
          return jsonResponse(false);
        }
        decided = true;
        return jsonResponse(true);
      }
      // get_hosted_quote — reflects the CURRENT decided state.
      return jsonResponse([
        baseRow(
          decided
            ? {
                decision: 'approved',
                decided_at: '2026-07-14T12:00:00Z',
                decision_note: 'Looks great!',
              }
            : {},
        ),
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstPost = new Request(`http://localhost/q/${PUBLISHED_TOKEN}`, {
      method: 'POST',
      body: new URLSearchParams({ decision: 'approved', note: 'Looks great!' }),
    });
    const firstRes = await handler(firstPost);
    const firstBody = await firstRes.text();
    expect(firstBody).toContain('Approved');
    expect(firstBody).toContain('Looks great!');

    const secondPost = new Request(`http://localhost/q/${PUBLISHED_TOKEN}`, {
      method: 'POST',
      body: new URLSearchParams({ decision: 'declined', note: 'changed my mind' }),
    });
    const secondRes = await handler(secondPost);
    const secondBody = await secondRes.text();

    // Still shows the ORIGINAL approved decision — the replayed decline
    // never touched the database (D-15 guard), and this function only ever
    // re-renders current DB truth after a write attempt.
    expect(secondBody).toContain('Approved');
    expect(secondBody).not.toContain('Declined on');
  });

  it('rejects a POST with an invalid decision value without calling the write RPC', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([baseRow()]));
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(
      new Request(`http://localhost/q/${PUBLISHED_TOKEN}`, {
        method: 'POST',
        body: new URLSearchParams({ decision: 'maybe' }),
      }),
    );

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
