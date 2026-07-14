# Phase 43: Pro Backend - Research

**Researched:** 2026-07-14
**Domain:** First-ever backend integration (Supabase auth + Postgres + Edge Functions), public token-gated hosted pages on a static SPA host, Merchant-of-Record subscription billing
**Confidence:** MEDIUM (stack choices HIGH; hosting-shape and RLS pitfalls MEDIUM-cross-checked; MoR pricing/regulatory details MEDIUM, always verify at signup time since fee schedules move)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Billing & pricing (PRO-04)**
- D-01: Merchant of record. Payment provider research is scoped to the MoR class (Paddle / Lemon Squeezy tier) — the provider resells on our behalf and remits EU VAT / global sales tax. A Canadian solo dev selling to EU customers does zero tax registrations. Raw Stripe (self-merchant, OSS/VAT filings) is rejected. Researcher produces the concrete pick (fees, checkout embed vs redirect, payout-to-Canada, EU invoice compliance, webhook → Supabase entitlement update).
- D-02: Undercut the anchor: ~€6.90–7.90/mo. Cheaper than 3DPrintQuote's €9.90 while our hosted-quote feature is new; "early supporter" framing acceptable. Final number chosen at plan/launch time within this band and feeds the BRAND-01 pricing spots (Phase 45).
- D-03: Monthly + annual at launch. Annual at roughly "2 months free" (e.g. €69/yr if €6.90/mo). Both SKUs configured in the MoR provider.
- D-04: No trial. The free tier is the trial — PDF quotes are the free floor of sharing; hosted live links are the Pro ceiling of the same capability. No trial states, no trial-abuse handling. Matches PRO-01 "accounts exist only for Pro features".

**Customer approval experience (PRO-02, PRO-03)**
- D-05: Maker's brand + powered-by. Hosted page carries the maker's business identity (same UserProfile source as the PDF header) with a discreet "Powered by 3DCoster" footer link. Implements the free/paid principle: "paid when the tool wears your brand to your customers."
- D-06: Approve/Decline + optional note. Two buttons, timestamped status flip, optional free-text note on either action. No customer account, no signature ceremony.
- D-07: Email + in-app notification. Maker gets an email (to their account address) the moment a customer approves/declines, AND the app refreshes published-quote statuses on open. Introduces one transactional-email dependency (e.g. Resend free tier via Supabase edge function) — researcher validates provider/mechanism. Status pull-back is NOT two-way sync of quote content; only the hosted status/note/timestamp flows back.
- D-08: Customer PII = name only. Hosted page shows "Prepared for {customer name}" — email/address never leave the device. Smallest possible GDPR surface for the DATA-FLOW-INVENTORY update and the PRO-03 security review.

**Pro account & gating UX (PRO-01)**
- D-09: Contextual sign-in + profile home. Hitting "Share quote" opens the magic-link sign-in inline; account/billing status lives in the existing user-profile area (header profile button). Zero new chrome for signed-out users — no-account stays first-class.
- D-10: Share quote visible with Pro badge. Free users see the button with a small "Pro" chip; clicking opens one short pitch modal (what a hosted link does) + signup. No nags, toasts, or banners anywhere else.
- D-11: Lapse-safe links. When a subscription lapses/cancels, existing hosted links STAY LIVE (the maker's customer is an innocent third party mid-deal); publishing NEW links requires active Pro. No scheduled takedowns.
- D-12: Web first; desktop parity by launch. Phase 43 ships Pro fully on the web app only. Tauri magic-link deep-linking / keyring session storage is explicitly OUT of this phase — it lands as a follow-up before the Phase 45 launch tag. Pro UI in the desktop build should degrade gracefully (researcher/planner decide: hide or "available on web" note).

**Publish lifecycle (PRO-02, PRO-03)**
- D-13: Frozen once published. A hosted page is immutable — matches the local snapshot-at-generate model. Revision path: unpublish → regenerate quote → publish again (new URL; old one 404s). No in-place snapshot replacement.
- D-14: Honor quote validity. If the quote carries a valid-until date, the hosted page flips to "expired — contact {maker} for a fresh quote" after it and disables Approve. NOTE for planner: verify whether `Quote.lineItemsSnapshot` currently carries a validity date; if not, adding one is an additive snapshot field (planner confirms against `src/types.ts`).
- D-15: Decision is final. After approve/decline the page locks into "Approved/Declined on {date}"; changing their mind means contacting the maker (unpublish/republish). One state transition.
- D-16: Branded unavailable page. Unpublished, expired-removed, and never-existed `/q/` URLs all return the SAME friendly 3DCoster-styled "this quote is no longer available — contact the person who sent it" page with the SAME HTTP 404 status — indistinguishable responses so token existence never leaks (PRO-03 non-enumerability).

### Claude's Discretion

- Exact MoR provider pick (within D-01 class) and checkout integration shape — research-driven
- Final price within the €6.90–7.90 band and annual number; currency display strategy
- Transactional email provider/mechanism for D-07 (edge function + Resend or provider-native)
- Hosted page visual design (within maker-brand + powered-by constraint) and how much line-item detail / quote-variant tiers (Phase 41) render
- Supabase schema, RLS policy design, session/cookie mechanics — research flag territory
- Desktop degrade presentation for D-12 (hide vs teaser)
- In-app "published" status surfaces on the local Quote (badges, JobsManager/quote list treatment) and NEW-badge registration for Share quote (user-facing → `src/features.ts`)

### Deferred Ideas (OUT OF SCOPE)

- Full white-label hosted pages (no 3DCoster mention) — potential higher-tier perk later; launch keeps the powered-by footer (D-05)
- Desktop (Tauri) Pro parity — explicitly deferred out of this phase to a pre-launch follow-up (D-12); needs magic-link deep-link/code-entry + keyring research
- Customer decision changes / re-approval flows — v1 is final-once-acted (D-15); revisit only if real usage shows fat-finger pain
- Refund policy / dunning specifics — not discussed; MoR provider defaults at launch, revisit with real subscribers
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRO-01 | Supabase project (eu-central-1) with magic-link auth — accounts exist ONLY for Pro features; free floor never requires one | Standard Stack (Supabase Auth PKCE flow), Architecture Patterns (compile-time web-only gate mirroring `!__IS_TAURI__`), Common Pitfalls (auth bundle must not load on free path) |
| PRO-02 | Maker can publish a quote as a hosted share link — POST of `Quote.lineItemsSnapshot`, local Quote stores `publishedUrl`, maker can unpublish | Architecture Patterns (snapshot POST + Dexie publish-metadata fields), Code Examples (publish/unpublish RPC calls) |
| PRO-03 | Hosted quote pages pass a security review gate — non-enumerable URLs, RLS verified, no PII in CDN caches, customer can view/approve without account | Common Pitfalls (RLS `using(true)` table-exposure trap), Architecture Patterns (SECURITY DEFINER RPC + Vercel Function hosting shape), Security Domain |
| PRO-04 | Pro subscription billing — subscribe/cancel; price anchored against 3DPrintQuote's €9.90/mo | Standard Stack (Paddle Billing pick), Package Legitimacy Audit, Code Examples (webhook → entitlement sync) |
</phase_requirements>

## Summary

Phase 43 is the project's first backend integration, so the primary research risk isn't "which library" — it's **hosting-shape and access-control correctness** on top of a stack that is otherwise well-trodden (Supabase Auth + Postgres + a Merchant-of-Record biller). The 3DCoster web app is a pure Vite SPA on Vercel with a single catch-all `vercel.json` rewrite (`/(.*)  → /`) and no existing `/api` directory — there is no server-rendering today. That matters because two of the phase's hardest requirements (PRO-03's "same HTTP 404 status" for unpublished/expired/never-existed links, and "noindex headers on all /q/* routes") are **not achievable from a client-side React Router route**: the Vercel edge already returns HTTP 200 with `index.html` for every non-API path before any JS runs, so a React-rendered "404 page" is still a 200 response with no ability to set response headers per-token. The hosted quote view must be served by a Vercel Serverless (or Edge) Function that sits outside the SPA bundle, does the Supabase lookup server-side, and controls the status code, `X-Robots-Tag: noindex`, and `Cache-Control: no-store` directly. `vercel.json`'s rewrite needs to explicitly exclude `/q/*` (and any new `/api/*`) so the SPA fallback doesn't swallow the function route.

The second hard risk is Row Level Security for the token-gated public read. The intuitive pattern — `create policy "public read" on hosted_quotes for select using (true)` — is a well-documented anti-pattern: PostgREST's default `GET /rest/v1/hosted_quotes?select=*` will return **every row**, not just the one matching a token the client happens to know, because RLS is table-scoped, not query-parameter-scoped. The correct pattern for a capability-style share link is a `SECURITY DEFINER` Postgres function invoked via `supabase.rpc('get_hosted_quote', { token })`, with direct anon `SELECT` **revoked** on the underlying table. The function does the token lookup, checks unpublished/expired state, and returns null (which the Edge Function turns into the branded 404) rather than exposing a general-purpose read policy.

For billing, both providers in the requested class (Paddle Billing, Lemon Squeezy) are true Merchants of Record and both support Canada payouts and EU VAT remittance. Paddle is the stronger pick for this project: flat 5%+$0.50 with no international/recurring surcharge (vs Lemon Squeezy's ~7%+$0.50 for international subscriptions plus stacking add-ons), broader jurisdiction coverage, and — critically — Lemon Squeezy was acquired by Stripe in 2024 and Stripe is actively steering customers toward its own "Stripe Managed Payments" successor product, which is a live migration-risk signal for a brand-new 2026 integration.

**Primary recommendation:** Supabase Auth (magic-link, PKCE, default localStorage session) gated behind the existing `!__IS_TAURI__` compile-time pattern for web-only Pro UI; a `hosted_quotes` table with RLS-revoked anon SELECT plus a `SECURITY DEFINER` RPC for token lookup; `/q/[token]` served by a new Vercel Serverless Function (not a React Router route) with explicit 404/noindex/no-store headers; Paddle Billing (overlay checkout, webhook → Supabase Edge Function → entitlement row) for PRO-04; Resend (via a Supabase Edge Function triggered by a Database Webhook on `hosted_quotes` status UPDATE) for the D-07 approval-notification email.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-link auth (session issuance, token exchange) | API / Backend (Supabase Auth) | Browser (supabase-js client, PKCE code verifier) | Auth tokens must be issued/verified server-side; the SPA only holds the resulting session |
| Free-floor calculator (no account) | Browser / Client | — | Must never call the API tier — PRO-01's hard boundary |
| Hosted quote page rendering (`/q/[token]`) | CDN / Static-adjacent (Vercel Function) | Database / Storage (Supabase RPC) | Needs true per-request HTTP status/header control, which the SPA's client-side router cannot provide |
| Non-enumerability / access control for hosted quotes | Database / Storage (Postgres RLS + SECURITY DEFINER RPC) | API / Backend (Vercel Function calling the RPC) | Authorization must live at the data layer, not be re-implemented in each caller |
| Approve/Decline write-back | API / Backend (Vercel Function or direct RPC) | Database / Storage | Anonymous customer writes one row; must be tightly scoped (own-row-only via token, not open UPDATE) |
| Publish/unpublish from the local app | Browser / Client (authenticated fetch/RPC) | API / Backend | Maker is authenticated; local Dexie `Quote.publishedUrl`/status stays the source of "is this published" for the UI |
| Approval-email notification | API / Backend (Supabase Edge Function + Resend) | Database / Storage (Database Webhook trigger) | Transactional email must be triggered server-side off a DB event, not from the customer's anonymous browser session |
| Subscription billing + entitlement | API / Backend (Paddle webhook → Supabase Edge Function) | Database / Storage (entitlement table) | Webhooks are the billing source of truth; the app only ever reads the resulting entitlement row |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.110.x [ASSUMED — verify at install time, moves fast] | Supabase client (auth + Postgres REST/RPC) in the browser and in Edge Functions | Official isomorphic client; 18.6M weekly downloads; only supported way to talk to Supabase from JS |
| Paddle.js (`@paddle/paddle-js`) | ^1.6.x [ASSUMED] | Overlay/inline checkout embed, client-side | Official Paddle Billing checkout SDK; required for embedded (not redirect) checkout |
| `resend` (Node SDK, used inside a Supabase Edge Function) | ^6.x [ASSUMED] | Sends the D-07 approval/decline notification email | Official Supabase docs example uses Resend for edge-function email; generous free tier fits a solo-dev launch |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase CLI | latest | Local dev stack, migrations, Edge Function scaffolding/deploy, generating typed DB types | Every Supabase schema/RLS/Edge Function change in this phase — do not hand-write migrations against the live project without a CLI-tracked migration file |
| `@vercel/node` (implicit — Vercel's default Node runtime for `api/*.ts`) | platform-provided | Runtime for the `/q/[token]` and Paddle-webhook Vercel Functions | Needed the moment any file lands in an `api/` directory; no separate install required for the Node runtime |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Paddle Billing | Lemon Squeezy | Nicer/faster indie checkout UX and license-key primitives, but higher effective international-subscription fee and real platform-continuity risk post-Stripe-acquisition (Stripe is steering LSQ customers toward "Stripe Managed Payments") |
| Vercel Serverless Function for `/q/[token]` | Client-side React Router route with `<meta name="robots">` injected via JS | Cannot produce a true HTTP 404 status code or `Cache-Control`/`X-Robots-Tag` headers — fails PRO-03's literal requirement; also risks the CDN caching a 200 response that briefly contained now-unpublished quote data |
| SECURITY DEFINER RPC for hosted-quote lookup | Table-level RLS `using (true)` policy | Table-level `true` policy is NOT scoped to the caller's token — it makes the whole table listable via PostgREST's default `select=*`, defeating non-enumerability entirely (see Common Pitfalls) |
| Supabase Edge Function for outbound email | Direct client → Resend API call from the customer's browser | Would leak the Resend API key to the browser and let anyone trigger emails; must stay server-side |

**Installation:**
```bash
npm install @supabase/supabase-js @paddle/paddle-js
# Resend SDK is installed inside the Supabase Edge Function's own deno/npm import, not the web app's package.json
```

**Version verification:** Run before finalizing the plan:
```bash
npm view @supabase/supabase-js version
npm view @paddle/paddle-js version
npm view resend version
```
All three were confirmed to exist on the npm registry and resolve to actively-maintained, high-download packages as of 2026-07-14 (see Package Legitimacy Audit) — re-run `npm view` at plan/implementation time since Supabase in particular ships frequent patch releases.

## Package Legitimacy Audit

| Package | Registry | Age/Last Publish | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|-----------|--------------|---------|-------------|
| `@supabase/supabase-js` | npm | Latest patch 2026-07-14 (long-lived package, 775 versions) | 18.66M/wk | github.com/supabase/supabase-js | SUS (`too-new` — flags on very recent patch release, not package age) | Approved — high download count + official org repo overrides the "too-new" heuristic |
| `@paddle/paddle-js` | npm | 2026-04-21 | 100K/wk | none in registry metadata | SUS (`no-repository`) | Approved with note — official Paddle-maintained SDK per Paddle's own developer docs; registry metadata simply omits the repo field. `checkpoint:human-verify` recommended before install to confirm package identity against developer.paddle.com's install instructions |
| `@lemonsqueezy/lemonsqueezy.js` | npm | 2024-11-05 | 86K/wk | github.com/lmsqueezy/lemonsqueezy.js | OK | Not used (Paddle selected instead) — listed for completeness since it was the alternative evaluated |
| `resend` | npm | Latest patch 2026-07-08 | 7.18M/wk | github.com/resend/resend-node | SUS (`too-new` — same recency heuristic) | Approved — very high download count + official resend org repo |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@supabase/supabase-js`, `@paddle/paddle-js`, `resend` — all flagged only on the automated "too-new"/"no-repository" heuristics, not on any actual legitimacy concern; all three are extremely high-download, well-known official packages. The planner should still add one `checkpoint:human-verify` task before the `@paddle/paddle-js` install specifically (the one with no repo field) to have the human confirm the exact package name against Paddle's official docs at install time — Paddle's checkout SDK naming has changed before (`@paddle/paddle-js` replaced an older `paddle-sdk`).

*Package names in this research were discovered via WebSearch, not Context7 (unavailable in this session) — treat all package-name claims as `[ASSUMED]` until the planner/implementer re-runs `npm view` immediately before install.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│  3DCoster Web SPA        │         │  Vercel Serverless Functions  │
│  (Vite + React Router)   │         │  (new — outside SPA bundle)   │
│                           │         │                                │
│  Free-floor calculator ──┼── NO ──▶│  (never called — PRO-01 gate) │
│  (no account, IndexedDB) │  network │                                │
│                           │  call    │                                │
│  Pro UI (web-only, gated │         │  api/q/[token].ts              │
│  by !__IS_TAURI__):       │         │   - RPC: get_hosted_quote(tok) │
│   - Sign-in modal ───────┼────────▶│   - 200 + branded HTML, or     │
│     (magic-link OTP)      │  auth   │     404 (SAME for unpub/       │
│   - Share-quote button   │  calls   │     expired/never-existed)     │
│   - Publish/unpublish ────┼────────▶│   - headers: noindex, no-store │
│   - Billing status panel │  publish │                                │
│                           │  RPC     │  api/webhooks/paddle.ts        │
└───────────┬───────────────┘         │   - verify signature            │
            │                          │   - upsert entitlement row      │
            │ supabase-js               └───────────┬────────────────────┘
            ▼ (PKCE / session)                       │
┌─────────────────────────────────────────────────────▼─────────────────┐
│  Supabase (eu-central-1)                                               │
│                                                                          │
│  auth.users (magic-link accounts)                                       │
│  public.hosted_quotes  (RLS: anon SELECT REVOKED; owner-only UPDATE)     │
│    - token (uuid v4, unique)  - snapshot jsonb  - status  - expires_at   │
│  public.get_hosted_quote(token)  [SECURITY DEFINER RPC — the ONLY read  │
│    path for anon; returns null for unpublished/expired/unknown token]    │
│  public.entitlements  (user_id, plan, status — written only by webhook) │
│                                                                          │
│  Edge Function: on-quote-decision                                       │
│   - triggered by Database Webhook (UPDATE on hosted_quotes.status)      │
│   - calls Resend API → emails the maker's account address (D-07)        │
└──────────────────────────────────────────────────────────────────────────┘

Customer browser (no account) ──▶ Vercel Function /q/[token] ──▶ RPC ──▶ Approve/Decline write (own-row-only, via the same token as the write key)
```

### Recommended Project Structure

```
api/                         # NEW — Vercel Serverless Functions (outside src/, not part of the Vite SPA build)
├── q/
│   └── [token].ts            # Hosted quote view: server-rendered HTML, real 404, noindex, no-store
└── webhooks/
    └── paddle.ts              # Paddle webhook receiver → writes entitlements table

supabase/                    # NEW — Supabase CLI project (migrations tracked in git)
├── migrations/
│   └── 00xx_hosted_quotes.sql
├── functions/
│   └── on-quote-decision/    # Edge Function: Resend email on approve/decline
└── config.toml

src/
├── lib/
│   └── supabaseClient.ts     # supabase-js singleton, web-only (guarded by !__IS_TAURI__ at call sites)
├── components/
│   ├── pro/
│   │   ├── SignInModal.tsx    # D-09 contextual magic-link sign-in
│   │   ├── ProPitchModal.tsx  # D-10 one-shot pitch for free users
│   │   ├── ShareQuoteButton.tsx
│   │   └── BillingPanel.tsx   # subscribe/cancel, price anchor display
│   └── ...
├── hooks/
│   └── usePublishedQuote.ts   # publish/unpublish/refresh-status calls
```

### Pattern 1: Web-only backend gate (mirrors Phase 42 D-03)

**What:** Every Supabase/Pro code path is compiled out of the Tauri desktop build.
**When to use:** All auth UI, publish/billing calls, and the supabase-js client import.
**Example:**
```typescript
// src/lib/supabaseClient.ts
// __IS_TAURI__ is a Vite `define` build-time constant (see vite.config.ts)
export const supabase = __IS_TAURI__
  ? null
  : createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
```
Desktop components should check `!__IS_TAURI__` before rendering Pro UI at all (D-12: hide or "available on web" note — planner/UX decision), not just before making the network call, so no dead sign-in button ships to desktop users.

### Pattern 2: Token-gated read via SECURITY DEFINER RPC, not table RLS

**What:** The only anonymous read path into `hosted_quotes` is a Postgres function.
**When to use:** Any public/anonymous single-row lookup by unguessable token (PRO-03).
**Example:**
```sql
-- Source: Supabase RLS docs (supabase.com/docs/guides/database/postgres/row-level-security)
--         + PostgREST db-authz docs, synthesized for this use case
revoke select on public.hosted_quotes from anon, authenticated;
alter table public.hosted_quotes enable row level security;
-- No permissive anon policy is created at all — anon has zero table access.

create or replace function public.get_hosted_quote(p_token uuid)
returns table (snapshot jsonb, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select h.snapshot, h.status, h.expires_at
    from hosted_quotes h
    where h.token = p_token
      and h.status = 'published';
  -- Returns zero rows for unpublished/expired/never-existed — caller
  -- (the Vercel Function) treats "no row" as the D-16 branded 404,
  -- indistinguishable across all three cases.
end;
$$;

grant execute on function public.get_hosted_quote(uuid) to anon;
```

### Pattern 3: Serving `/q/[token]` outside the SPA fallback

**What:** Scope the SPA catch-all rewrite so `/q/*` (and any future `/api/*`) reach the filesystem/function router instead of `index.html`.
**When to use:** Immediately — the current `vercel.json` rewrite (`/(.*)  → /`) will otherwise swallow every `/q/[token]` request before the new function ever runs.
**Example:**
```json
{
  "rewrites": [
    { "source": "/((?!q/|api/).*)", "destination": "/" }
  ]
}
```
Verify this negative-lookahead pattern against a real Vercel preview deploy before relying on it — the planner should treat "does `/q/abc123` actually hit the function, and does `/app` still SPA-route correctly" as an explicit verification step, not an assumption.

### Anti-Patterns to Avoid

- **Client-rendered "404" for hosted quotes:** Returns HTTP 200 from the CDN's perspective; fails PRO-03's literal requirement and risks the response being cached with real quote data still in the initial HTML/JSON payload.
- **`using (true)` RLS policy "for the demo, we'll lock it down later":** This is the single most common Supabase data-leak pattern reported in the wild ("most exfiltrated databases are dumped this way — not via SQL injection, just via the published API"). Do not ship this even temporarily.
- **Calling Resend directly from the browser:** Exposes the API key; must run inside a Supabase Edge Function or Vercel Function with the secret in server-side env, never `VITE_`-prefixed.
- **Storing the Paddle/billing secret key as `VITE_PADDLE_API_KEY`:** Any `VITE_`-prefixed env var is bundled into client JS and public. Only the Paddle **client token** (publishable) should be `VITE_`-prefixed; the API key used for webhook verification lives in the Vercel Function's server-only env.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Magic-link email delivery + token verification | Custom email-OTP + JWT issuance | Supabase Auth (`signInWithOtp` + PKCE) | Supabase already handles rate-limiting, token expiry, replay protection, and secure cookie/localStorage session semantics |
| Non-enumerable share tokens | Sequential IDs + hashing scheme | Native `uuid` v4 column + Postgres `gen_random_uuid()` default | UUID v4 has 122 bits of randomness; no custom entropy/collision logic needed |
| VAT/sales-tax calculation and remittance | Manual tax-rate lookup tables + filings | Paddle Billing (Merchant of Record) | This is precisely what D-01 already locked in — Paddle/LSQ exist so a solo dev never touches tax registration |
| Webhook signature verification | Custom HMAC parsing | Paddle's official webhook-signature verification helper (in their Node/JS SDK or documented raw-body HMAC recipe) | Signature schemes have subtle timing-attack and encoding pitfalls; use the vendor's tested helper |
| Transactional email templating/deliverability | SMTP + custom bounce handling | Resend | Free tier covers a low-volume approval-notification use case; deliverability infrastructure (SPF/DKIM, bounce handling) is already solved |

**Key insight:** Every piece of this phase that touches security-sensitive plumbing (auth tokens, tax compliance, webhook signatures, email deliverability) has a vendor-owned, battle-tested primitive. The only genuinely custom code in this phase is the RLS/RPC authorization design and the Vercel Function that bridges the SPA to that backend — and that custom code is exactly where the Common Pitfalls below concentrate.

## Common Pitfalls

### Pitfall 1: RLS `using (true)` silently defeats non-enumerability
**What goes wrong:** A policy written to "let anyone with the link view it" ends up letting anyone list every hosted quote via the raw PostgREST endpoint, because RLS evaluates per-row against `true` with no reference to the caller-supplied token at all.
**Why it happens:** It's the simplest thing that "makes the demo work" — a maker's own token-filtered fetch (`?token=eq.<uuid>`) looks correct in manual testing, masking that an unfiltered `?select=*` call also succeeds.
**How to avoid:** Revoke anon table SELECT entirely; expose reads only through the `SECURITY DEFINER` RPC pattern in Architecture Patterns above.
**Warning signs:** Any RLS policy body that is literally `using (true)`, or a Supabase security review (PRO-03's gate) that doesn't include a "call the endpoint with no token filter" test.

### Pitfall 2: SPA client-side routing cannot deliver real HTTP semantics
**What goes wrong:** A `/q/:token` React Router route is built, looks correct in the browser, but crawlers/monitoring/Cache-Control all see HTTP 200 with generic SPA markup, and PRO-03's "same 404 status" requirement is unmet.
**Why it happens:** The rest of the app is 100% client-routed, so it's the path of least resistance to extend that pattern to the new route.
**How to avoid:** Build `/q/[token]` as a Vercel Serverless/Edge Function outside the Vite build, and explicitly test response status codes with `curl -I` against a preview deploy, not just visually in a browser.
**Warning signs:** No `api/` directory exists yet in this repo — its absence is itself the signal that this phase introduces a genuinely new deployment shape, not just new React components.

### Pitfall 3: CSP blocks the new network origins
**What goes wrong:** `vercel.json`'s existing CSP (`connect-src 'self' https://api.github.com https://cdn.jsdelivr.net ...`, `script-src 'self'`) will block Supabase REST/Auth calls and the Paddle.js checkout script/iframe the moment they're added, with no visible error beyond a silent console CSP violation.
**Why it happens:** CSP is allowlist-based and this project's list has never needed to include a backend or payment-provider origin before.
**How to avoid:** Add the Supabase project URL (`https://<project-ref>.supabase.co`) to `connect-src`, and Paddle's checkout domains (confirm exact domains from Paddle's own CSP guidance at implementation time — typically `https://*.paddle.com` / `https://cdn.paddle.com` for `script-src`/`frame-src`, plus their API origin for `connect-src`) — update `docs/DATA-FLOW-INVENTORY.md` FIRST per the existing Pitfall C-05 process, then the CSP, then the Privacy Policy.
**Warning signs:** Sign-in modal or checkout silently does nothing; check the browser console for CSP violation messages before assuming a code bug.

### Pitfall 4: `VITE_`-prefixed secrets leak to the client bundle
**What goes wrong:** A webhook-verification secret or Paddle API key gets named `VITE_PADDLE_SECRET` "to make it easy to read in code" and ships in the public JS bundle.
**Why it happens:** Vite requires the `VITE_` prefix for any env var used in browser code, and it's an easy copy-paste mistake to prefix a server-only secret the same way out of habit.
**How to avoid:** Only the Paddle **client token** (already meant to be public) and the Supabase **anon key** (already meant to be public, protected by RLS) get `VITE_` prefixes. Webhook secrets and Resend API keys live only in Vercel Function / Supabase Edge Function server env and are never referenced from `src/`.
**Warning signs:** `grep -rn "VITE_.*SECRET\|VITE_.*API_KEY" src/` turning up anything billing- or email-related.

### Pitfall 5: Lapse-safe links (D-11) requires entitlement checks scoped to "new publish," not "any hosted-quote read"
**What goes wrong:** A naive implementation gates the `/q/[token]` RPC itself on "maker has active Pro," which would 404 out every existing customer-facing link the moment a card fails — directly violating D-11.
**Why it happens:** It's the more obvious place to check entitlement, since it's the one function that touches both the quote and (transitively) the owning user.
**How to avoid:** Entitlement checks belong only on the **publish** action (creating a new `hosted_quotes` row / setting status to `published`), never on the **read** RPC. Once published, a row's visibility depends only on its own `status`/`expires_at`, never on the current state of the owner's subscription.
**Warning signs:** Any code path that joins `hosted_quotes` to `entitlements` inside `get_hosted_quote` — that join should not exist.

## Code Examples

### Magic-link sign-in (client)
```typescript
// Source: supabase.com/docs/guides/auth/auth-email-passwordless (CITED)
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${window.location.origin}/app` }
})
// User clicks the emailed link → redirected back with a PKCE code in the URL.
// supabase-js v2's default detectSessionInUrl handles the exchange automatically
// when the client is initialized on that redirect page; listen for the result:
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') { /* update UI, close SignInModal */ }
})
```

### Publish a quote (client → RPC, authenticated)
```typescript
// Maker is signed in; the write is scoped by RLS to rows the caller owns.
const token = crypto.randomUUID()
const { error } = await supabase
  .from('hosted_quotes')
  .insert({
    token,
    owner_id: session.user.id,   // RLS: owner-only INSERT/UPDATE policy (standard, not the anon-read RPC)
    snapshot: quote.lineItemsSnapshot,
    customer_first_name: quote.customerSnapshot.name?.split(' ')[0] ?? '',
    status: 'published',
    expires_at: quote.lineItemsSnapshot.validUntil ?? null, // D-14, pending confirmation this field exists
  })
if (!error) {
  await updateQuote(quote.id, { publishedUrl: `https://3dcoster.com/q/${token}`, publishStatus: 'published' })
}
```

### Hosted-quote lookup (server, inside the Vercel Function)
```typescript
// api/q/[token].ts — Source: synthesized from Supabase RPC docs (CITED) + Vercel Functions docs (CITED)
export default async function handler(req: Request): Promise<Response> {
  const token = new URL(req.url).pathname.split('/').pop()
  const { data, error } = await supabaseAdmin.rpc('get_hosted_quote', { p_token: token })
  if (error || !data?.length) {
    return new Response(renderBrandedUnavailablePage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' },
    })
  }
  return new Response(renderHostedQuotePage(data[0]), {
    status: 200,
    headers: { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' },
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Supabase implicit-grant auth flow (tokens in URL fragment) | PKCE flow (auth code + code-verifier exchange) | supabase-js v2 default | More secure default for SPAs; no action needed beyond using current supabase-js — just be aware `exchangeCodeForSession`/`detectSessionInUrl` is the mechanism, not "read tokens from the hash" |
| Lemon Squeezy as the default indie MoR recommendation | Paddle Billing as the safer long-term MoR pick | Since the 2024 Stripe/Lemon-Squeezy acquisition, reinforced by 2026 "Stripe Managed Payments" rollout | A recommendation that was common in 2023-era tutorials (Lemon Squeezy) now carries platform-continuity risk for a brand-new integration |

**Deprecated/outdated:**
- Implicit-grant Supabase auth flow: superseded by PKCE; do not follow older tutorials that read `access_token` directly from `location.hash`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Exact package versions (`@supabase/supabase-js` ^2.110.x, `@paddle/paddle-js` ^1.6.x, `resend` ^6.x) | Standard Stack | Low — these are checked again via `npm view` immediately before install per the Package Legitimacy Audit; version drift is expected and harmless as long as re-verified |
| A2 | Exact Paddle fee schedule (5%+$0.50) and Lemon Squeezy (~7%+$0.50 international) | Standard Stack, Summary | Medium — MoR pricing pages change; the founder must re-confirm actual current pricing on paddle.com/pricing before committing to the final €6.90–7.90 price point, since fee % directly affects margin at that price |
| A3 | Paddle payout-to-Canada mechanics (wire/Payoneer, ~3 business days, possible $15 SWIFT fee) | Standard Stack | Medium — payout details should be re-verified directly in the Paddle dashboard once the seller account is created, before relying on this for cash-flow planning |
| A4 | Paddle CSP domains (`*.paddle.com`, `cdn.paddle.com`) | Common Pitfalls | Low-Medium — get the exact current CSP allowlist from Paddle's own integration docs at implementation time rather than guessing domain names |
| A5 | `vercel.json` negative-lookahead rewrite pattern (`/((?!q/|api/).*)`) will correctly let a new `api/q/[token].ts` function win over the SPA fallback | Architecture Patterns | Medium — must be verified against a real Vercel preview deploy; Vercel's rewrite-vs-filesystem-function precedence should be tested explicitly, not assumed from general Vercel docs |
| A6 | `Quote.lineItemsSnapshot` does not currently carry a validity/expiry date field (feeds D-14) | Code Examples, phase_requirements | Low — this is explicitly flagged in CONTEXT.md D-14 for the planner to confirm against `src/types.ts`; confirmed by this research's own read of `src/types.ts` lines 357-399, which shows no validity-date field today, so D-14 will require an additive snapshot field |

**If this table is empty:** N/A — see entries above; all are flagged for confirmation at plan or implementation time, none block starting the plan.

## Open Questions

1. **Exact final Pro price point and annual price**
   - What we know: Band is €6.90–7.90/mo locked (D-02); annual ≈ "2 months free."
   - What's unclear: The precise number, and whether it should be set before or during Phase 43 planning vs. held until Phase 45 (BRAND-01 pricing spots).
   - Recommendation: Set it during Phase 43 planning so Paddle SKUs can be created once — Phase 45 then just reads the already-configured price, avoiding a second Paddle-dashboard pass.

2. **Whether the Vercel Function approach requires converting the whole deployment off pure static hosting**
   - What we know: Adding one `api/` directory to a Vite project on Vercel is a supported, common pattern (confirmed via WebSearch on Vercel's own rewrite/functions docs) and does not require a framework change (no Next.js needed).
   - What's unclear: Whether the existing `vite-plugin-pwa` service-worker precache (`workbox.globPatterns`) needs any adjustment so it doesn't try to precache `/q/*` responses (it currently globs build output, not runtime routes, so likely no change needed — but this should be an explicit plan verification step).
   - Recommendation: Planner adds a task to verify the PWA service worker does not intercept `/q/*` requests (it registers scope `/` per `vite.config.ts`).

3. **Whether Paddle's overlay checkout iframe requires a CSP `frame-src` addition beyond the current `frame-src 'none'`**
   - What we know: The current CSP has `frame-src 'none'`, which will block any iframe-based checkout outright.
   - What's unclear: Paddle's exact current overlay-checkout domain(s) for `frame-src`.
   - Recommendation: Confirm against Paddle's own CSP integration guidance at implementation time and update `vercel.json` + `docs/DATA-FLOW-INVENTORY.md` together.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Supabase project (eu-central-1) | PRO-01..03 | Not yet created (locked decision, not yet provisioned) | — | None — must be created before implementation; no fallback since backend choice is locked in REQUIREMENTS.md |
| Supabase CLI | Local dev/migrations | Not checked in this session — planner/implementer should run `supabase --version` before starting | — | Install via `npm install -g supabase` or Homebrew if missing |
| Paddle seller account | PRO-04 | Not yet created | — | None with fallback — Lemon Squeezy is the documented alternative within the same D-01 MoR class if Paddle onboarding is rejected/blocked for any reason |
| Resend account | D-07 email | Not yet created | — | Supabase's own SMTP-relay-based email (lower deliverability, more setup) is a documented fallback per Supabase's own docs, but Resend is the recommended default |
| Vercel project (existing) | Hosting for new `api/` functions | ✓ (already deployed) | — | — |

**Missing dependencies with no fallback:**
- Supabase project must be created (eu-central-1) — this is the locked backend, no alternative.

**Missing dependencies with fallback:**
- Paddle account → Lemon Squeezy (same MoR class, D-01 discretion)
- Resend → Supabase's built-in email relay (lower deliverability, acceptable fallback for low volume)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit) ^4.1.4 + Playwright (E2E) ^1.61.1 — both already installed, confirmed in `package.json` |
| Config file | `vite.config.ts` (Vitest config), `playwright.config.ts` [confirm exact path at plan time] |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npm test` (unit) + `npx playwright test` (E2E) — confirm exact scripts in `package.json` at plan time |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| PRO-01 | Free calculator loads/saves with zero network calls when signed out | integration | Playwright test asserting no requests to the Supabase origin during a full free-floor flow | ❌ Wave 0 |
| PRO-01 | Magic-link sign-in completes and session persists | E2E | Playwright test against a Supabase local/test project (mocked email link) | ❌ Wave 0 |
| PRO-02 | Publish creates a row, sets `publishedUrl`, unpublish flips status | integration | Vitest test against a local/test Supabase instance (or mocked RPC) | ❌ Wave 0 |
| PRO-03 | Unpublished/expired/never-existed tokens return identical 404 response | integration | A direct HTTP test (`fetch`/`curl`) against the deployed/preview `/q/[token]` function comparing status+body shape across all three cases | ❌ Wave 0 |
| PRO-03 | Anon cannot list `hosted_quotes` via raw REST (`select=*`, no token) | security | A scripted `curl` call to `${SUPABASE_URL}/rest/v1/hosted_quotes?select=*` with the anon key, asserting empty/forbidden | ❌ Wave 0 — this is the PRO-03 security-gate's core regression test and should be automated, not just manually eyeballed once |
| PRO-04 | Webhook updates entitlement; app reflects subscribe/cancel | integration | Vitest test simulating a signed Paddle webhook payload against the webhook handler | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted `npx vitest run` on the touched module
- **Per wave merge:** full `npm test` + relevant Playwright specs
- **Phase gate:** Full suite green before `/gsd-verify-work`, AND the PRO-03 anon-listing security test passes explicitly before the security review gate is considered closed

### Wave 0 Gaps

- [ ] `supabase/migrations/00xx_hosted_quotes.sql` + `entitlements` table — no Supabase schema exists yet
- [ ] Test harness for hitting a local/test Supabase project from Vitest (service-role test client, seeded fixtures)
- [ ] Playwright fixture for driving the Vercel `/q/[token]` function in preview/CI (may require deploying to a preview URL rather than the local dev server, since Vercel Functions don't run under `vite dev`)
- [ ] `tests/security/hosted-quote-enumerability.test.ts` (or equivalent) — the anon-listing regression test named above; this is the single most important new test in the phase given the PRO-03 security gate

*(None of these exist today — this is a from-scratch backend, so Wave 0 is substantial for this phase specifically.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | yes | Supabase Auth magic-link (PKCE), no passwords to manage |
| V3 Session Management | yes | supabase-js default session storage (localStorage) + `onAuthStateChange`; consider session expiry/refresh behavior explicitly in the plan |
| V4 Access Control | yes | Postgres RLS (owner-only writes) + `SECURITY DEFINER` RPC (token-scoped anonymous reads) — this is the phase's central security surface |
| V5 Input Validation | yes | Token must be validated as a well-formed UUID before the RPC call (reject malformed input early, don't let malformed strings reach Postgres) |
| V6 Cryptography | no direct hand-rolling | UUID v4 generation via `crypto.randomUUID()` (client) or `gen_random_uuid()` (Postgres) — never hand-roll token generation; webhook signature verification uses Paddle's official helper, never a hand-rolled HMAC compare |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Full-table enumeration via permissive RLS (`using(true)`) | Information Disclosure | `SECURITY DEFINER` RPC, anon SELECT revoked on the table (Pitfall 1) |
| Token guessing / brute-force of `/q/[token]` | Information Disclosure | UUID v4 (122 bits entropy) — not sequential; rate-limit the Vercel Function if abuse is observed (not required at launch scope, but worth a plan note) |
| Webhook spoofing (fake "subscription active" events) | Spoofing/Tampering | Verify Paddle's webhook signature on every request before writing to `entitlements`; reject unsigned/invalid requests with 400 |
| CSRF-adjacent: anonymous customer's Approve/Decline write being replayable or forgeable by a third party who doesn't have the link | Tampering | The write must be scoped by the same unguessable token used for the read (capability-based), and D-15 "decision is final" should be enforced at the RPC/DB level (a second write attempt after a decision exists is rejected), not just hidden in the UI |
| PII leakage via CDN cache of hosted quote HTML | Information Disclosure | `Cache-Control: no-store` on every `/q/[token]` response (D-08's "customer name only" already minimizes what's exposed, but the response still must not be cacheable) |

## Sources

### Primary (HIGH confidence)
- None fetched via Context7 or an authenticated docs tool this session (Context7 MCP unavailable) — see Secondary below for the official-docs URLs that were reached via WebSearch instead.

### Secondary (MEDIUM confidence — WebSearch results citing official documentation)
- supabase.com/docs/guides/auth/auth-email-passwordless — magic-link setup
- supabase.com/docs/guides/auth/sessions/pkce-flow — PKCE flow mechanics
- supabase.com/docs/guides/database/postgres/row-level-security — RLS fundamentals, `using(true)` semantics
- supabase.com/docs/guides/api/securing-your-api — PostgREST/anon-role exposure risk
- supabase.com/docs/guides/functions/examples/send-emails — Edge Function + Resend pattern
- supabase.com/docs/guides/database/webhooks — Database Webhooks triggering Edge Functions
- developer.paddle.com/concepts/sell/supported-countries-locales — Paddle country/payout coverage
- paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid — Paddle payout timing/fees
- paddle.com/compare/lemon-squeezy — Paddle vs Lemon Squeezy vendor comparison (treat as vendor-biased, cross-checked against independent blog comparisons)
- lemonsqueezy.com/blog/2026-update — Stripe/Lemon Squeezy post-acquisition status
- vercel.com/docs/routing/rewrites — rewrite/SPA-fallback-exclusion patterns
- npmjs.com/package/@supabase/supabase-js — version/download verification

### Tertiary (LOW confidence — WebSearch only, independent blogs/community posts, flagged for validation)
- Various 2026 "Stripe vs Paddle vs Lemon Squeezy" comparison blogs (globalsolo.global, fintechspecs.com, buildmvpfast.com, f3fundit.com) — used to cross-check fee percentages; treat exact fee numbers as needing reconfirmation against paddle.com/pricing and lemonsqueezy.com/pricing directly before finalizing PRO-04's price point
- GitHub Discussions (supabase/discussions #41133, #3269, #36942) — community Q&A on PKCE and SECURITY DEFINER pitfalls, consistent with official docs but not official sources themselves

## Metadata

**Confidence breakdown:**
- Standard stack (Supabase, Resend): HIGH — official docs directly confirm the patterns used
- Standard stack (Paddle vs Lemon Squeezy pick): MEDIUM — fee/feature comparison drawn from a mix of vendor pages and independent 2026 blog posts; founder should re-verify exact current pricing before committing
- Architecture (hosting shape for `/q/[token]`): MEDIUM — the *problem* (SPA can't produce real 404s/headers) is HIGH confidence and independently verifiable by inspecting `vercel.json`/`main.tsx` in this repo; the *exact* rewrite regex and Vercel Function precedence behavior is MEDIUM and needs a live preview-deploy check
- Security (RLS/RPC pattern): HIGH — the `using(true)` full-table-exposure pitfall is well-documented across Supabase's own docs and independent security write-ups, consistently
- Pitfalls: MEDIUM-HIGH — grounded in both official docs and this repo's actual current CSP/routing config (read directly, not assumed)

**Research date:** 2026-07-14
**Valid until:** 14 days (payment-provider fee schedules and Supabase/Paddle SDK versions move fast; re-verify pricing and package versions if planning is delayed past late July 2026)
