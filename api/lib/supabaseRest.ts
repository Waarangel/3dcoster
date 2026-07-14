/**
 * api/lib/supabaseRest.ts
 *
 * Tiny raw-`fetch` RPC helper for Vercel Serverless Functions that need to
 * reach Supabase's PostgREST RPC endpoint. Deliberately does NOT depend on
 * `@supabase/supabase-js` (the web app's client library, added in plan
 * 43-03) — Vercel Functions live in a separate deploy bundle from the SPA
 * and have no reason to carry that dependency.
 *
 * Reads `SUPABASE_URL` / `SUPABASE_ANON_KEY` from server-side Vercel env
 * (NOT the `VITE_`-prefixed browser-facing pair from plan 43-03 — those are
 * bundled into client JS and are a different, if same-valued, pair).
 *
 * This helper NEVER reads a service-role key. Every RPC it calls
 * (`get_hosted_quote`, `approve_quote_decision`) is anon-executable by
 * design — see supabase/migrations/0001_pro_backend.sql section 8 grants.
 */

export class SupabaseRestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SupabaseRestError';
    this.status = status;
  }
}

function getServerConfig(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseRestError(
      'Missing SUPABASE_URL / SUPABASE_ANON_KEY server env — cannot reach Supabase.',
    );
  }
  return { url, anonKey };
}

/**
 * Calls a Postgres function exposed to the `anon` role via PostgREST's
 * `/rest/v1/rpc/<fn>` endpoint.
 *
 * Examples:
 *   callRpc<HostedQuoteRow[]>('get_hosted_quote', { p_token: token })
 *     → `[]` for an unpublished/expired/unknown token (D-16 same-shape
 *       response — the caller renders the branded 404 for all three).
 *
 *   callRpc<boolean>('approve_quote_decision', { p_token, p_decision: 'approved', p_note: '' })
 *     → `true` only when a row actually transitioned from `decision is null`
 *       (D-15) — a replayed/forged second write returns `false`.
 *
 * Returns: whatever JSON body PostgREST responds with, typed by the caller.
 * Throws `SupabaseRestError` on a non-2xx response or missing server env.
 */
export async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { url, anonKey } = getServerConfig();

  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    throw new SupabaseRestError(`Supabase RPC "${fn}" failed with HTTP ${res.status}`, res.status);
  }

  return (await res.json()) as T;
}
