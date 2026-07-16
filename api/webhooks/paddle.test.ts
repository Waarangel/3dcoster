// @vitest-environment node
/**
 * api/webhooks/paddle.test.ts
 *
 * Phase 43-06 (PRO-04) — the billing source of truth. The Paddle webhook is
 * the ONLY writer of the `entitlements` table, so this suite locks:
 *
 *   T-43-03 (Spoofing/Tampering): the Paddle-Signature header is verified
 *   against PADDLE_WEBHOOK_SECRET BEFORE any DB write. Missing, malformed,
 *   tampered, and stale-timestamp signatures all yield 400 with ZERO
 *   side effects — a forged/replayed "subscription active" payload can
 *   never mint an entitlement.
 *
 *   T-43-14 (Elevation of Privilege): a verified event upserts through the
 *   Supabase REST endpoint with the SERVICE ROLE key (the table has no
 *   client write policy at all).
 *
 *   D-11 (lapse-safe): subscription.canceled updates entitlement status
 *   only — hosted_quotes is NEVER touched, so existing published customer
 *   links stay live after cancellation.
 *
 *   D-04 (no trial): the handler passes Paddle statuses through verbatim
 *   and nothing here fabricates or special-cases a trial state.
 *
 * `fetch` is mocked globally — the handler writes via raw fetch to
 * PostgREST, so no live Supabase project is needed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import handler from './paddle';

const WEBHOOK_SECRET = 'pdl_ntfset_test_secret_01';
const USER_ID = '9b2f8c64-1234-4abc-8def-0123456789ab';

const ENV_KEYS = ['PADDLE_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
let savedEnv: Record<string, string | undefined> = {};

function signatureFor(rawBody: string, secret: string, ts: number): string {
  const h1 = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

interface EventOverrides {
  status?: string;
  customData?: Record<string, unknown> | null;
  interval?: string;
  endsAt?: string | null;
}

function makeEvent(eventType: string, overrides: EventOverrides = {}): string {
  const {
    status = 'active',
    customData = { user_id: USER_ID },
    interval = 'month',
    endsAt = '2026-08-14T12:00:00Z',
  } = overrides;
  return JSON.stringify({
    event_id: 'evt_01',
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    data: {
      id: 'sub_01',
      status,
      customer_id: 'ctm_01',
      custom_data: customData,
      current_billing_period: endsAt ? { starts_at: '2026-07-14T12:00:00Z', ends_at: endsAt } : null,
      items: [
        {
          price: {
            id: interval === 'year' ? 'pri_annual_456' : 'pri_monthly_123',
            billing_cycle: { interval, frequency: 1 },
          },
        },
      ],
    },
  });
}

function makeRequest(rawBody: string, signature?: string, method = 'POST'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (signature !== undefined) headers['Paddle-Signature'] = signature;
  return new Request('https://3dcoster.com/api/webhooks/paddle', {
    method,
    headers,
    ...(method === 'POST' ? { body: rawBody } : {}),
  });
}

function signedRequest(rawBody: string, ts = Math.floor(Date.now() / 1000)): Request {
  return makeRequest(rawBody, signatureFor(rawBody, WEBHOOK_SECRET, ts));
}

let fetchSpy: ReturnType<typeof vi.fn>;

function upsertCalls(): Array<{ url: string; init: RequestInit }> {
  return fetchSpy.mock.calls.map(([url, init]) => ({ url: String(url), init: init as RequestInit }));
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.PADDLE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

  fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

describe('signature gate (T-43-03) — verified BEFORE any write', () => {
  it('rejects a missing Paddle-Signature header with 400 and zero writes', async () => {
    const res = await handler(makeRequest(makeEvent('subscription.created')));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a tampered body (signature no longer matches) with 400 and zero writes', async () => {
    const original = makeEvent('subscription.created');
    const ts = Math.floor(Date.now() / 1000);
    const goodSignature = signatureFor(original, WEBHOOK_SECRET, ts);
    // Forge: swap the body after signing — the classic replay/tamper attempt.
    const forged = makeEvent('subscription.created', { status: 'active', customData: { user_id: USER_ID } })
      .replace('sub_01', 'sub_evil');
    const res = await handler(makeRequest(forged, goodSignature));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a signature computed with the wrong secret with 400 and zero writes', async () => {
    const body = makeEvent('subscription.created');
    const ts = Math.floor(Date.now() / 1000);
    const res = await handler(makeRequest(body, signatureFor(body, 'wrong_secret', ts)));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a malformed signature header with 400 and zero writes', async () => {
    const res = await handler(makeRequest(makeEvent('subscription.created'), 'not-a-signature'));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a stale timestamp (replay defense) with 400 and zero writes', async () => {
    const body = makeEvent('subscription.created');
    const staleTs = Math.floor(Date.now() / 1000) - 60 * 60; // 1h old
    const res = await handler(makeRequest(body, signatureFor(body, WEBHOOK_SECRET, staleTs)));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 503 (no side effects) when PADDLE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const res = await handler(signedRequest(makeEvent('subscription.created')));
    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('verified subscription events — service-role entitlement upsert (T-43-14)', () => {
  it('upserts the entitlements row for subscription.created (monthly)', async () => {
    const res = await handler(signedRequest(makeEvent('subscription.created')));
    expect(res.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const { url, init } = upsertCalls()[0];
    expect(url).toContain('https://example.supabase.co/rest/v1/entitlements');
    expect(url).toContain('on_conflict=user_id');

    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('service-role-test-key');
    expect(headers.Authorization).toBe('Bearer service-role-test-key');
    expect(headers.Prefer).toContain('resolution=merge-duplicates');

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.user_id).toBe(USER_ID);
    expect(body.plan).toBe('monthly');
    expect(body.status).toBe('active');
    expect(body.current_period_end).toBe('2026-08-14T12:00:00Z');
  });

  it('maps a yearly billing cycle to the annual plan on subscription.updated', async () => {
    const res = await handler(signedRequest(makeEvent('subscription.updated', { interval: 'year' })));
    expect(res.status).toBe(200);
    const body = JSON.parse(String(upsertCalls()[0].init.body)) as Record<string, unknown>;
    expect(body.plan).toBe('annual');
  });

  it('subscription.canceled writes status canceled and NEVER touches hosted_quotes (D-11)', async () => {
    const res = await handler(
      signedRequest(makeEvent('subscription.canceled', { status: 'canceled' })),
    );
    expect(res.status).toBe(200);

    const calls = upsertCalls();
    expect(calls.length).toBe(1);
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body.status).toBe('canceled');

    // D-11 lapse-safe: no request in the whole handler run may touch hosted_quotes.
    for (const call of calls) {
      expect(call.url).not.toContain('hosted_quotes');
    }
  });

  it('acknowledges (200) but writes nothing when custom_data.user_id is missing', async () => {
    const res = await handler(signedRequest(makeEvent('subscription.created', { customData: null })));
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('acknowledges (200) but writes nothing when user_id is not a UUID', async () => {
    const res = await handler(
      signedRequest(makeEvent('subscription.created', { customData: { user_id: 'DROP TABLE;' } })),
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ignores unrelated (but validly signed) event types without writing', async () => {
    const res = await handler(signedRequest(makeEvent('transaction.completed')));
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 500 (so Paddle retries) when the Supabase upsert fails', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('permission denied', { status: 401 }));
    const res = await handler(signedRequest(makeEvent('subscription.created')));
    expect(res.status).toBe(500);
  });

  it('returns 500 (so Paddle retries once configured) when Supabase server env is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await handler(signedRequest(makeEvent('subscription.created')));
    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('method gate', () => {
  it('rejects non-POST methods with 405', async () => {
    const res = await handler(makeRequest('', undefined, 'GET'));
    expect(res.status).toBe(405);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
