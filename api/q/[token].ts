/**
 * api/q/[token].ts
 *
 * Phase 43 Plan 05 (PRO-02 view + PRO-03 security): the customer-facing
 * hosted-quote surface. This is a Vercel Serverless Function living OUTSIDE
 * the Vite/SPA bundle — it is the only place in the codebase that can
 * produce a genuine HTTP status code, per-token response headers, and an
 * uncacheable response (43-RESEARCH.md Pitfall 2: a React Router route
 * cannot do any of this, since Vercel's SPA rewrite already returns 200
 * with `index.html` before any client JS runs).
 *
 * Design invariants (see supabase/migrations/0001_pro_backend.sql +
 * .planning/phases/43-pro-backend/43-CONTEXT.md for the full rationale):
 *   D-05  Maker-branded page + discreet "Powered by 3DCoster" footer.
 *   D-06  Approve/Decline + optional free-text note, no customer account.
 *   D-08  Customer PII is name-only — "Prepared for {first name}".
 *   D-14  Expired quotes are treated as unavailable (see D-16 below —
 *         this plan renders expired the SAME as unpublished/unknown,
 *         overriding a distinct "expired" message so non-enumerability
 *         is never weakened by a differentiated response).
 *   D-15  Decision is final — a second Approve/Decline attempt is a no-op;
 *         the DB-level `decision is null` guard (supabase/migrations) is
 *         the actual enforcement, this function just re-renders whatever
 *         the RPC reports as current truth after any write attempt.
 *   D-16  Unpublished / expired / never-existed tokens are BYTE-IDENTICAL
 *         404 responses — no per-case wording differences, ever.
 *
 * Every response (200 and 404) sets `X-Robots-Tag: noindex` and
 * `Cache-Control: no-store` — no PII (even first-name-only PII) may ever
 * sit in a CDN cache (PRO-03).
 *
 * This function calls `get_hosted_quote` / `approve_quote_decision` via the
 * raw-fetch RPC helper in `./lib/supabaseRest` — it NEVER selects the
 * `hosted_quotes` table directly (that path has anon SELECT revoked
 * entirely; see the migration's Pitfall-1 comment).
 */

import { callRpc } from '../lib/supabaseRest';
import { isValidLogoDataUrl } from '../lib/logoDataUrl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by the `get_hosted_quote` RPC (one row, or zero rows). */
interface HostedQuoteRow {
  snapshot: HostedSnapshot;
  customer_first_name: string | null;
  status: 'published' | 'unpublished';
  decision: 'approved' | 'declined' | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string | null;
}

/**
 * By-value copy of `Quote.lineItemsSnapshot` (src/types.ts) at publish time,
 * as written by plan 43-04's publish flow.
 *
 * `businessName` is OPTIONAL and NOT YET populated by plan 43-04 as
 * currently scoped (its publish INSERT sets `snapshot: quote.lineItemsSnapshot`
 * verbatim, which has no business-identity field). This function renders it
 * when present and degrades gracefully (omits the line, never fabricates a
 * business name) when absent — see this plan's SUMMARY.md "For Plan 43-04"
 * note for the follow-up needed to actually populate it end-to-end.
 */
interface HostedSnapshot {
  jobTitle?: string;
  sellingPrice?: number;
  shippingCost?: number;
  resolvedTaxRate?: number;
  taxAmount?: number;
  currency?: string;
  notes?: string;
  terms?: string;
  businessName?: string;
  /**
   * D-11: baked into the snapshot at publish time by
   * src/hooks/usePublishedQuote.ts, ALREADY validated client-side via
   * src/utils/logoDataUrl.ts. Re-validated here via the lockstep
   * api/lib/logoDataUrl.ts copy before ever reaching the rendered HTML
   * (Pitfall 4 defense-in-depth — a tampered/malformed Supabase row can
   * never produce an <img src="..."> or bypass the D-09 footer rule).
   */
  logoDataUrl?: string;
  variantsSnapshot?: {
    quantities: number[];
    unitPrices: number[];
    currency?: string;
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Accepts any RFC 4122 UUID shape (not just v4) — the DB column default is
// gen_random_uuid() (v4), but validation only needs to reject obviously
// malformed input before it ever reaches Postgres (ASVS V5).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function extractToken(req: Request): string {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return '';
  }
  const fromQuery = url.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const segments = url.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

// ---------------------------------------------------------------------------
// HTML rendering helpers
// ---------------------------------------------------------------------------

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: number, currency?: string): string {
  if (typeof currency === 'string' && /^[A-Z]{3}$/i.test(currency)) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount);
    } catch {
      // Unknown/unsupported ISO code — fall through to a plain number
      // rather than fabricating a currency symbol that wasn't provided.
    }
  }
  return amount.toFixed(2);
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * D-09: `showFooter` defaults to true (unchanged for every existing caller,
 * including the D-16 unavailable page) and is only ever set to false by
 * `renderHostedQuotePage` when a valid logo is present on the snapshot.
 */
function pageShell(title: string, bodyHtml: string, showFooter = true): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: #0f172a;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    justify-content: center;
    padding: 48px 20px;
  }
  .wrap { width: 100%; max-width: 640px; }
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 32px;
  }
  h1 { font-size: 1.4rem; margin: 0 0 8px; color: #f8fafc; }
  .eyebrow { color: #93c5fd; font-size: 0.85rem; font-weight: 600; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  p { line-height: 1.5; color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #334155; font-size: 0.9rem; }
  th { color: #94a3b8; font-weight: 600; }
  .totals td { text-align: right; }
  .totals .label { text-align: left; color: #94a3b8; }
  .totals .grand td { font-weight: 700; color: #f8fafc; border-top: 2px solid #475569; }
  .status-pill {
    display: inline-block; padding: 4px 12px; border-radius: 999px;
    font-size: 0.85rem; font-weight: 600; margin-bottom: 16px;
  }
  .status-pill.approved { background: #14532d; color: #86efac; }
  .status-pill.declined { background: #450a0a; color: #fca5a5; }
  form.decision-form { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
  textarea {
    width: 100%; min-height: 72px; margin-top: 12px; padding: 10px;
    background: #0f172a; border: 1px solid #475569; border-radius: 8px;
    color: #e2e8f0; font-family: inherit; font-size: 0.9rem;
  }
  button {
    padding: 10px 20px; border-radius: 8px; border: none;
    font-size: 0.95rem; font-weight: 600; cursor: pointer;
  }
  button.approve { background: #16a34a; color: white; }
  button.decline { background: #475569; color: #e2e8f0; }
  .footer { margin-top: 28px; text-align: center; font-size: 0.8rem; color: #64748b; }
  .footer a { color: #93c5fd; text-decoration: none; }
  .note-block { margin-top: 16px; padding: 12px; background: #0f172a; border-radius: 8px; border: 1px solid #334155; }
</style>
</head>
<body>
<div class="wrap">
${bodyHtml}
${showFooter ? '<p class="footer">Powered by <a href="https://3dcoster.com">3DCoster</a></p>' : ''}
</div>
</body>
</html>`;
}

/**
 * D-16: the SAME branded unavailable page for unpublished, expired, and
 * never-existed tokens — no per-request interpolation whatsoever, so the
 * response body is byte-identical across all three cases.
 */
function renderUnavailablePage(): string {
  return pageShell(
    'Quote unavailable — 3DCoster',
    `<div class="card">
  <h1>This quote is no longer available</h1>
  <p>The link you followed has been unpublished, has expired, or never existed. Please contact the person who sent it to you for an updated quote.</p>
</div>`,
  );
}

function renderLineItemsTable(snapshot: HostedSnapshot): string {
  const description = `Custom 3D print${snapshot.jobTitle ? ` — ${escapeHtml(snapshot.jobTitle)}` : ''}`;
  const currency = snapshot.currency;
  const variants = snapshot.variantsSnapshot;

  const rows =
    variants && variants.quantities.length > 0
      ? variants.quantities
          .map((qty, i) => {
            const unitPrice = variants.unitPrices[i] ?? 0;
            const amount = qty * unitPrice;
            return `<tr><td>${description}</td><td>${qty}</td><td>${formatMoney(unitPrice, variants.currency ?? currency)}</td><td>${formatMoney(amount, variants.currency ?? currency)}</td></tr>`;
          })
          .join('')
      : `<tr><td>${description}</td><td>1</td><td>${formatMoney(snapshot.sellingPrice ?? 0, currency)}</td><td>${formatMoney(snapshot.sellingPrice ?? 0, currency)}</td></tr>`;

  return `<table>
  <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function renderTotals(snapshot: HostedSnapshot): string {
  const sellingPrice = snapshot.sellingPrice ?? 0;
  const shippingCost = snapshot.shippingCost ?? 0;
  const resolvedTaxRate = snapshot.resolvedTaxRate ?? 0;
  const taxAmount = snapshot.taxAmount ?? 0;
  const currency = snapshot.currency;

  const showShipping = shippingCost > 0;
  const showTax = resolvedTaxRate > 0 && taxAmount > 0;
  const total = sellingPrice + (showShipping ? shippingCost : 0) + (showTax ? taxAmount : 0);

  const rows = [
    `<tr class="totals"><td class="label">Subtotal</td><td>${formatMoney(sellingPrice, currency)}</td></tr>`,
    showShipping
      ? `<tr class="totals"><td class="label">Shipping</td><td>${formatMoney(shippingCost, currency)}</td></tr>`
      : '',
    showTax
      ? `<tr class="totals"><td class="label">Tax (${resolvedTaxRate}%)</td><td>${formatMoney(taxAmount, currency)}</td></tr>`
      : '',
    `<tr class="totals grand"><td class="label">Total</td><td>${formatMoney(total, currency)}</td></tr>`,
  ].join('');

  return `<table><tbody>${rows}</tbody></table>`;
}

function renderNotesAndTerms(snapshot: HostedSnapshot): string {
  const notes = (snapshot.notes ?? '').trim();
  const terms = (snapshot.terms ?? '').trim();
  if (!notes && !terms) return '';

  const parts: string[] = [];
  if (notes) parts.push(`<p><strong>Notes</strong><br />${escapeHtml(notes).replace(/\n/g, '<br />')}</p>`);
  if (terms) parts.push(`<p><strong>Terms</strong><br />${escapeHtml(terms).replace(/\n/g, '<br />')}</p>`);
  return parts.join('');
}

function renderDecisionForm(): string {
  return `<form class="decision-form" method="POST">
  <textarea name="note" placeholder="Optional note (visible to the maker)" maxlength="2000"></textarea>
  <div style="display:flex; gap:12px; width:100%;">
    <button class="approve" type="submit" name="decision" value="approved">Approve</button>
    <button class="decline" type="submit" name="decision" value="declined">Decline</button>
  </div>
</form>`;
}

function renderLockedDecision(row: HostedQuoteRow): string {
  const label = row.decision === 'approved' ? 'Approved' : 'Declined';
  const cssClass = row.decision === 'approved' ? 'approved' : 'declined';
  const dateStr = formatDate(row.decided_at);
  const noteHtml = row.decision_note
    ? `<div class="note-block"><strong>Note:</strong> ${escapeHtml(row.decision_note)}</div>`
    : '';
  return `<span class="status-pill ${cssClass}">${label}${dateStr ? ` on ${dateStr}` : ''}</span>
${noteHtml}`;
}

/**
 * D-05/D-06/D-08: the maker-branded hosted quote page for a valid,
 * non-expired, published row. Business-identity rendering degrades
 * gracefully (see HostedSnapshot doc comment above) rather than
 * fabricating a name when the publish payload doesn't carry one yet.
 */
function renderHostedQuotePage(row: HostedQuoteRow): string {
  const snapshot = row.snapshot ?? {};
  const preparedFor = row.customer_first_name?.trim() ? escapeHtml(row.customer_first_name.trim()) : 'you';
  const businessLine = snapshot.businessName
    ? `<p class="eyebrow">${escapeHtml(snapshot.businessName)}</p>`
    : '';

  // D-09/Pitfall 4: re-validate the snapshot's logo through the lockstep
  // server allowlist. A tampered/malformed row (javascript:, svg, an
  // attribute-breakout string, or one over the length cap) fails here and
  // is treated identically to "no logo" — no <img>, footer stays.
  const hasLogo = isValidLogoDataUrl(snapshot.logoDataUrl);
  // The allowlist regex IS the escaping for this attribute+scheme case
  // (base64-alphabet-only, no quotes/angle-brackets can pass) — only ever
  // interpolate the value once `hasLogo` has confirmed it matched.
  const logoLine = hasLogo
    ? `<img src="${snapshot.logoDataUrl}" alt="${escapeHtml(snapshot.businessName ?? 'Maker logo')}" style="max-width:180px;max-height:64px;margin-bottom:12px;" />`
    : '';

  const decisionSection = row.decision ? renderLockedDecision(row) : renderDecisionForm();

  return pageShell(
    `Quote — ${snapshot.jobTitle ?? '3DCoster'}`,
    `<div class="card">
  ${logoLine}
  ${businessLine}
  <h1>Prepared for ${preparedFor}</h1>
  ${renderLineItemsTable(snapshot)}
  ${renderTotals(snapshot)}
  ${renderNotesAndTerms(snapshot)}
  ${decisionSection}
</div>`,
    // D-09: the footer disappears ONLY when a valid logo is actually present.
    !hasLogo,
  );
}

// ---------------------------------------------------------------------------
// Response builders — every branch sets the same PRO-03 header pair.
// ---------------------------------------------------------------------------

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store',
    },
  });
}

function unavailableResponse(): Response {
  return htmlResponse(renderUnavailablePage(), 404);
}

function okResponse(row: HostedQuoteRow): Response {
  return htmlResponse(renderHostedQuotePage(row), 200);
}

// ---------------------------------------------------------------------------
// Core read path — shared by GET and the POST-then-re-render flow.
// ---------------------------------------------------------------------------

async function loadAndRespond(token: string): Promise<Response> {
  if (!isValidUuid(token)) {
    return unavailableResponse();
  }

  let rows: HostedQuoteRow[];
  try {
    rows = await callRpc<HostedQuoteRow[]>('get_hosted_quote', { p_token: token });
  } catch {
    // Any RPC failure (missing server env, network error, non-2xx) fails
    // closed to the branded 404 rather than leaking a stack trace or raw
    // error detail to the customer.
    return unavailableResponse();
  }

  const row = rows[0];
  if (!row) {
    return unavailableResponse();
  }

  // D-14 (superseded by D-16 non-enumerability): the RPC only filters on
  // `status = 'published'`, NOT `expires_at` — an expired-but-published row
  // is still returned by the DB. This function is the one place that
  // enforces validity, and it renders the SAME 404 as unpublished/unknown.
  if (row.expires_at) {
    const expiry = new Date(row.expires_at).getTime();
    if (!Number.isNaN(expiry) && expiry < Date.now()) {
      return unavailableResponse();
    }
  }

  return okResponse(row);
}

async function handlePost(req: Request, token: string): Promise<Response> {
  if (!isValidUuid(token)) {
    return unavailableResponse();
  }

  let decision = '';
  let note = '';
  try {
    const form = await req.formData();
    decision = String(form.get('decision') ?? '');
    note = String(form.get('note') ?? '').slice(0, 2000);
  } catch {
    return unavailableResponse();
  }

  if (decision !== 'approved' && decision !== 'declined') {
    return unavailableResponse();
  }

  try {
    // The write is authorised ONLY by possession of the unguessable token
    // (capability-based) — this function never accepts or trusts a
    // caller-supplied owner/session identity. D-15 (one transition only)
    // is enforced at the DB level (`decision is null` guard); a replayed
    // second POST simply returns `false` here and changes nothing.
    await callRpc<boolean>('approve_quote_decision', {
      p_token: token,
      p_decision: decision,
      p_note: note,
    });
  } catch {
    // Fall through — re-fetching below renders whatever is actually true
    // in the database regardless of whether this particular write landed.
  }

  return loadAndRespond(token);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  const token = extractToken(req);

  if (req.method === 'POST') {
    return handlePost(req, token);
  }

  return loadAndRespond(token);
}
