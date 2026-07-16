/**
 * api/webhooks/paddle.ts
 *
 * Phase 43 Plan 06 (PRO-04): the Paddle Billing webhook — the ONLY writer
 * of the `entitlements` table and therefore the billing source of truth
 * (Architectural Responsibility Map: webhooks write, the app only reads).
 *
 * Security invariants (threat model 43-06):
 *   T-43-03  The Paddle-Signature header is verified against
 *            PADDLE_WEBHOOK_SECRET BEFORE anything else — before JSON
 *            parsing, before any network call. Missing/invalid/stale
 *            signatures return 400 with zero side effects, so a forged or
 *            replayed "subscription active" payload can never mint Pro.
 *            Verification follows Paddle's documented recipe
 *            (developer.paddle.com/webhooks/signature-verification):
 *            HMAC-SHA256 over `${ts}:${rawBody}` with the endpoint's
 *            signing secret, compared timing-safe, with a max-age window
 *            on `ts` as the replay defense.
 *   T-43-14  Writes go through Supabase REST with the SERVICE ROLE key
 *            (server env, never VITE_-prefixed) — `entitlements` has no
 *            client write policy at all, so this handler is the single
 *            write path (deliberate RLS bypass, gated by the signature).
 *   D-11     LAPSE-SAFE: subscription.canceled updates the entitlement row
 *            only. This module never touches hosted_quotes — existing
 *            published customer links stay live after cancellation; the
 *            entitlement gates only NEW publishes (enforced client-side in
 *            usePublishedQuote.publish and re-checked at insert-time RLS).
 *   D-04     No trial: Paddle statuses pass through verbatim; nothing here
 *            fabricates or special-cases a trial state.
 *
 * user_id mapping: `openCheckout` (src/lib/paddle.ts) sets
 * `customData: { user_id }` at checkout; Paddle copies that custom data
 * onto the transaction AND the subscription, so every subscription.*
 * event carries it back. A payload without a valid UUID user_id is
 * acknowledged (200) but not written — retrying would not conjure the id,
 * and a non-2xx would just make Paddle hammer the endpoint. (PADDLE_API_KEY
 * is reserved for a future API-lookup fallback; not used today.)
 *
 * The raw request body is read with `req.text()` and the SAME string is
 * both verified and parsed — never let a framework pre-parse/re-serialize
 * the body or the signature check breaks on byte differences.
 */

// ---------------------------------------------------------------------------
// Signature verification (Paddle's documented recipe)
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Reject webhook timestamps older than this (seconds) — replay defense. */
const MAX_SIGNATURE_AGE_SECONDS = 300;

interface ParsedSignature {
  ts: number;
  h1: string[];
}

/** Parses `ts=1671552777;h1=abc...;h1=def...` (h1 may repeat during secret rotation). */
function parsePaddleSignature(header: string): ParsedSignature | null {
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 'ts' && /^\d+$/.test(value)) ts = Number(value);
    if (key === 'h1' && /^[0-9a-f]+$/i.test(value)) h1.push(value);
  }
  if (ts === null || h1.length === 0) return null;
  return { ts, h1 };
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parsed = parsePaddleSignature(header);
  if (!parsed) return false;

  // Replay defense: the signed timestamp must be recent (Paddle sends the
  // event's dispatch time; retries are re-signed with a fresh ts).
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - parsed.ts);
  if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${parsed.ts}:${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  for (const candidate of parsed.h1) {
    const candidateBuf = Buffer.from(candidate, 'hex');
    if (candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Event payload (the subset of Paddle's subscription.* shape we consume)
// ---------------------------------------------------------------------------

interface PaddleSubscriptionItem {
  price?: {
    id?: string;
    billing_cycle?: { interval?: string; frequency?: number } | null;
  } | null;
}

interface PaddleSubscriptionData {
  id?: string;
  status?: string;
  custom_data?: Record<string, unknown> | null;
  current_billing_period?: { starts_at?: string; ends_at?: string } | null;
  items?: PaddleSubscriptionItem[] | null;
}

interface PaddleEvent {
  event_id?: string;
  event_type?: string;
  data?: PaddleSubscriptionData;
}

const HANDLED_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 'month' → 'monthly', 'year' → 'annual' — provider-authoritative, no env needed. */
function planFromInterval(interval: string | undefined): string | null {
  if (interval === 'month') return 'monthly';
  if (interval === 'year') return 'annual';
  return null;
}

// ---------------------------------------------------------------------------
// Entitlement upsert (service role — the deliberate, signature-gated RLS bypass)
// ---------------------------------------------------------------------------

interface EntitlementUpsert {
  user_id: string;
  status: string;
  updated_at: string;
  plan?: string;
  current_period_end?: string;
}

async function upsertEntitlement(row: EntitlementUpsert): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY server env.');
  }

  const res = await fetch(`${url}/rest/v1/entitlements?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      // Upsert: insert a fresh row, or merge the provided columns into the
      // existing one keyed on user_id (omitted columns keep prior values).
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    throw new Error(`entitlements upsert failed with HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json(405, { error: 'method not allowed' });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    // Operator hasn't wired the Paddle webhook secret yet (no seller account,
    // or a fresh deploy). Fail closed with zero side effects — 503 so the
    // misconfiguration is visible in Paddle's delivery log.
    console.error('[paddle-webhook] PADDLE_WEBHOOK_SECRET is not configured.');
    return json(503, { error: 'webhook not configured' });
  }

  // Signature FIRST, against the raw body string — before JSON.parse,
  // before any side effect (T-43-03).
  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers.get('Paddle-Signature'), secret)) {
    return json(400, { error: 'invalid signature' });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return json(400, { error: 'invalid payload' });
  }

  const eventType = event.event_type ?? '';
  if (!HANDLED_EVENTS.has(eventType)) {
    // Signed and genuine, just not a subscription lifecycle event we track.
    return json(200, { ok: true, ignored: eventType });
  }

  const data = event.data ?? {};
  const customUserId = data.custom_data?.['user_id'];
  if (typeof customUserId !== 'string' || !UUID_PATTERN.test(customUserId)) {
    // Cannot map this subscription to a Supabase user — acknowledge so
    // Paddle stops retrying (a retry carries the same payload), and leave a
    // loud log for the operator. Never guess or write a partial row.
    console.error(
      `[paddle-webhook] ${eventType} for ${data.id ?? 'unknown sub'} has no valid custom_data.user_id — skipped.`,
    );
    return json(200, { ok: true, skipped: 'no user mapping' });
  }

  const status = data.status ?? (eventType === 'subscription.canceled' ? 'canceled' : null);
  if (!status) {
    console.error(`[paddle-webhook] ${eventType} carried no subscription status — skipped.`);
    return json(200, { ok: true, skipped: 'no status' });
  }

  const plan = planFromInterval(data.items?.[0]?.price?.billing_cycle?.interval ?? undefined);
  const periodEnd = data.current_billing_period?.ends_at;

  const row: EntitlementUpsert = {
    user_id: customUserId,
    status,
    updated_at: new Date().toISOString(),
    // Omit unknown columns so a merge upsert never blanks prior values.
    ...(plan ? { plan } : {}),
    ...(periodEnd ? { current_period_end: periodEnd } : {}),
  };

  try {
    // D-11: this is the ONLY write in the handler — entitlements, keyed on
    // user_id. hosted_quotes is never read or written here; existing
    // published links survive cancellation untouched.
    await upsertEntitlement(row);
  } catch (err) {
    console.error('[paddle-webhook] entitlement upsert failed:', err);
    // Non-2xx → Paddle retries with backoff, which IS the desired behavior
    // for a transient DB/config failure.
    return json(500, { error: 'entitlement write failed' });
  }

  return json(200, { ok: true });
}
