// supabase/functions/on-quote-decision/index.ts
//
// Phase 43 Plan 05 (D-07 email notification). Triggered by the
// `hosted_quotes_decision_webhook` Postgres trigger
// (supabase/migrations/0001_pro_backend.sql, section 9), which calls
// `net.http_post` with body `{ hosted_quote_token: <uuid> }` the moment a
// hosted quote's `decision` column transitions from null to
// approved/declined.
//
// This function:
//   1. Looks up the full `hosted_quotes` row via the SERVICE ROLE client
//      (bypasses RLS — this function never runs with the anon key, and
//      never receives the row contents from the untrusted customer POST;
//      it re-reads from the database as the source of truth).
//   2. Resolves the maker's account email via `auth.users` (owner_id).
//   3. Emails the maker via Resend: "Your quote was {approved|declined}",
//      including the decision note when present (D-07: "declines with a
//      reason are gold").
//
// `RESEND_API_KEY` is read from THIS function's own secret env (set via
// `supabase secrets set RESEND_API_KEY=...` at deploy time), NEVER a
// `VITE_`-prefixed var (Pitfall 4 in 43-RESEARCH.md) — it never reaches the
// browser or any other codebase surface. When it is absent (e.g. before the
// operator has configured Resend), this function degrades gracefully: the
// decision is still recorded in the database and surfaced in-app via plan
// 43-04's `refreshStatuses()`, it just skips the email rather than erroring.
//
// Deploy (operator step, NOT run by this executor — no Supabase CLI
// credentials are configured in this session):
//   supabase functions deploy on-quote-decision
//   supabase secrets set RESEND_API_KEY=<key-from-Resend-dashboard>
//
// Deno import map: dependencies are pulled via the `npm:` specifier
// (native support in the Supabase Edge Runtime / Deno 2), so no separate
// `import_map.json` is required for this function.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@6';

interface DecisionWebhookPayload {
  hosted_quote_token?: string;
}

interface HostedQuoteRow {
  token: string;
  owner_id: string;
  customer_first_name: string | null;
  decision: 'approved' | 'declined' | null;
  decision_note: string | null;
  decided_at: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: DecisionWebhookPayload;
  try {
    payload = (await req.json()) as DecisionWebhookPayload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const token = payload.hosted_quote_token;
  if (!token) {
    return new Response('Missing hosted_quote_token', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // SUPABASE_SERVICE_ROLE_KEY is automatically injected into every Supabase
  // Edge Function's environment — it is never something this codebase sets
  // or stores itself.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('on-quote-decision: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY edge env');
    return new Response('Server misconfigured', { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: quoteRow, error: quoteError } = await admin
    .from('hosted_quotes')
    .select('token, owner_id, customer_first_name, decision, decision_note, decided_at')
    .eq('token', token)
    .maybeSingle<HostedQuoteRow>();

  if (quoteError || !quoteRow || !quoteRow.decision) {
    console.error('on-quote-decision: could not load a decided hosted_quotes row', quoteError);
    return new Response('Quote not found or not decided', { status: 404 });
  }

  const { data: ownerData, error: ownerError } = await admin.auth.admin.getUserById(quoteRow.owner_id);
  const makerEmail = ownerData?.user?.email;
  if (ownerError || !makerEmail) {
    console.error('on-quote-decision: could not resolve the maker account email', ownerError);
    return new Response('Maker account not found', { status: 404 });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    // Graceful no-op: Resend has not been configured for this deploy yet.
    // The decision is already recorded in hosted_quotes — the in-app
    // refreshStatuses() pull-back (plan 43-04) still surfaces it even if
    // this email never sends.
    console.warn('on-quote-decision: RESEND_API_KEY not set — skipping email, decision was still recorded');
    return new Response('OK (email skipped — RESEND_API_KEY not configured)', { status: 200 });
  }

  const resend = new Resend(resendApiKey);
  const verb = quoteRow.decision === 'approved' ? 'approved' : 'declined';
  const customerLabel = quoteRow.customer_first_name?.trim() || 'Your customer';
  const noteLine = quoteRow.decision_note?.trim()
    ? `\n\nTheir note: "${quoteRow.decision_note.trim()}"`
    : '';

  const { error: sendError } = await resend.emails.send({
    from: 'quotes@3dcoster.com',
    to: makerEmail,
    subject: `Your quote was ${verb}`,
    text:
      `${customerLabel} just ${verb} the quote you shared via 3DCoster.${noteLine}\n\n` +
      'Sign in at https://3dcoster.com to see the full status.',
  });

  if (sendError) {
    console.error('on-quote-decision: Resend send failed', sendError);
    return new Response('Email send failed', { status: 502 });
  }

  return new Response('OK', { status: 200 });
});
