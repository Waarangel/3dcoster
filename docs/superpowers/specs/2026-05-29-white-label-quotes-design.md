# White-Label Quotes (Paid Tier) — Design

**Date:** 2026-05-29
**Status:** Design — pending implementation plan
**Author:** Brainstorming session (Marcus + Claude)

## Summary

The first paid feature for 3DCoster: let a subscriber put **their own brand** on the
PDF quotes the app generates — logo, business identity, accent color, and removal of the
"Made with 3DCoster" footer. This is the canonical "the tool wears your brand to your
customers" paid feature already named in `PROJECT.md`.

Because the subscription model requires it, this release also stands up the **paid-tier
foundation** the app has never had: user accounts, a backend, and recurring billing. The
**free tier stays 100% local and offline-first** — the backend governs *only* the paid
entitlement. This foundation is deliberately reusable by future paid features (marketplace
order import, accounting integration), which all require a server for OAuth tokens and API
secrets.

## Target Customer

A side-seller / part-time maker who wants their quotes to look professional and on-brand
to their own customers. Lowest-lift, highest-fit first paid feature; the PDF engine already
exists, so the feature is "swap our branding for theirs."

## Decisions Locked (this session)

| Decision | Choice | Rationale |
|---|---|---|
| First paying customer | Side-seller wanting to look pro | Lowest lift, clearest value, already validated in roadmap |
| Monetization | Subscription (recurring) | User preference; recurring revenue |
| Backend platform | Supabase | Already configured in project; auth + Postgres + edge functions in one |
| Auth method | Magic link (passwordless) | No password surface; native Supabase; works web + desktop |
| Entitlement verification | Short-lived signed token + offline grace | Preserves offline-first; tamper-resistant; reusable primitive |
| Branding scope (v1) | Logo + business identity, remove/replace footer, brand accent color | Core "your brand" payload; multiple templates deferred |
| Branding capture | Snapshotted onto the Quote at creation time | Honors the locked D-17 PDF snapshot invariant |

## Critical Existing Constraint — D-17 PDF Snapshot Invariant

`generateQuotePdf(quote)` reads **only** from `Quote.lineItemsSnapshot` +
`Quote.customerSnapshot`, **never** from `UserProfile` at render time
(`src/pdf/generateQuotePdf.ts` header comment, "D-17 G4"). This exists so that editing
your profile never retroactively mutates an already-issued quote.

**White-label must honor this.** Branding is captured into a `brandingSnapshot` on the
`Quote` at creation time, and the PDF renderer reads only that snapshot. Entitlement is
therefore checked **once, at quote creation** — not at render time.

---

## Architecture

```
┌─ Free tier (existing, untouched) ─────────────────────┐
│  React + Dexie/IndexedDB · 100% offline               │
│  Calculator · Jobs · Customers · PDF quote (w/ footer) │
└────────────────────────────────────────────────────────┘
                    │  (only the entitlement gate touches the network)
┌─ Paid layer (new) ────────────────────────────────────┐
│  Supabase                                              │
│   • Auth: magic link (email)                           │
│   • Table `subscriptions` (user_id, status, current_   │
│     period_end, stripe_customer_id, stripe_sub_id)     │
│   • Edge fn `stripe-webhook` → upserts `subscriptions` │
│   • Edge fn `issue-entitlement` → signed JWT           │
│  Stripe                                                 │
│   • Checkout (subscribe) · Customer Portal (manage)    │
└────────────────────────────────────────────────────────┘
```

### Layer 1 — Entitlement foundation (reusable)

**Identity.** Supabase Auth, magic link. Web uses a normal redirect callback. Desktop
(Tauri) registers a custom protocol deep link (`3dcoster://auth-callback`); the magic-link
click opens the system browser, which redirects to the deep link the app captures to
establish the session.

**Subscription state.** A `subscriptions` row per user, kept current by the
`stripe-webhook` edge function (signature-verified) on Stripe events
(`customer.subscription.created/updated/deleted`, `invoice.payment_failed`). Row-Level
Security ensures a user can read only their own row.

**Entitlement token.** Client calls `issue-entitlement` (authenticated). The function
reads the user's `subscriptions` row and returns a **short-lived signed JWT**:
`{ userId, status: 'active' | 'inactive', exp: now + 7 days }`, signed with a private key
held only in Supabase secrets. The client **verifies the token offline** against a
**public key baked into the build**.

**Offline grace.** A valid token unlocks paid features for its 7-day life with no network.
On expiry, the app silently re-fetches when next online. A configurable grace window
(default +7 days past `exp`) covers a subscriber who has been offline for a stretch before
the gate closes. Entitlement state is cached locally (IndexedDB) between launches.

**Client interface.** A single `useEntitlement()` hook is the only entitlement surface the
rest of the app consumes:

```ts
useEntitlement(): {
  entitled: boolean;          // token valid (active) AND within life-or-grace
  status: 'active' | 'inactive' | 'unknown';
  withinGrace: boolean;       // true when relying on an expired-but-in-grace token
  refresh(): Promise<void>;   // force a re-fetch of issue-entitlement
}
```
Everything else (PDF capture, settings lock, upgrade CTAs) reads `entitled` and never
re-implements verification.

**Billing management.** Stripe Checkout to subscribe; Stripe Customer Portal for
cancel / update card — no custom billing UI.

### Layer 2 — White-label feature

**`UserProfile` additions** (stored as the JSON blob in `settings['userProfile']`;
`name`, `address`, `defaultTerms` already exist — these are additive, **no Dexie
migration**. Note: the current `isUserProfile` validator (`database.ts:355`) only checks
`currency` + `laborHourlyRate`, so it already accepts arbitrary optional fields — **do not
add required-field checks** for the new branding fields; they remain optional):

- `businessName?: string`
- `businessEmail?: string`
- `businessPhone?: string`
- `businessWebsite?: string`
- `businessLogo?: string` — base64 data URL (PNG/JPEG), downscaled + size-capped (~500 KB) on upload
- `brandAccentColor?: string` — hex (e.g. `#2563eb`)
- `quoteFooterText?: string` — replaces the footer; empty + subscribed ⇒ no footer

**`Quote` addition** (the `Quote` store already exists at the current schema v9; the new
property is **non-indexed**, so **no new schema version and no migration are introduced** —
old quote records simply lack it and render the default look):

```ts
interface BrandingSnapshot {
  whiteLabeled: boolean;        // was the user entitled at creation time?
  logo?: string;                // base64 data URL
  businessName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: { street?; city?; province?; postalCode?; country? };
  accentColor?: string;         // hex
  footerText?: string;          // undefined ⇒ suppress footer
}
// Quote gains:  brandingSnapshot?: BrandingSnapshot
```

**Capture flow (at quote creation):**

```
Create quote ──► entitled right now? (verify signed token, offline-OK)
        │
   yes ─┤─ no
        │   └─► brandingSnapshot = { whiteLabeled: false }
        └─────► brandingSnapshot = { whiteLabeled: true, ...from UserProfile }
                          │
              Quote.brandingSnapshot persisted with the quote
                          │
              generateQuotePdf(quote) reads ONLY brandingSnapshot
```

Consequences (all intended):
- Subscriber's quote bakes in branding at issue time; later profile edits never mutate it (D-17 holds).
- Subscription lapses → **new** quotes revert to the footer; **already-issued** quotes stay branded.
- Fully offline — the snapshot needs no network at render time.

**Edit mode (required rule — closes a D-17 hole).** `PrintQuoteModal` has an EDIT path
(D-27) that re-spreads `lineItemsSnapshot` from the *current* `UserProfile` and re-renders.
The branding rule on edit is the opposite of the line-items rule: **`brandingSnapshot` is
preserved verbatim from the existing `editingQuote` — never re-captured, never re-checked
against current entitlement.** Rationale:
- Re-capturing would *strip* branding from a quote that was legitimately issued while
  subscribed if it is edited after a lapse — violating "already-issued quotes stay branded."
- Dropping it (leaving `brandingSnapshot` undefined on the spread) would silently revert a
  branded quote to the footer on any edit.
Therefore edit must copy `editingQuote.brandingSnapshot` through unchanged. The
at-creation entitlement check fires **only** when a quote is first created, not on edit.
The capture (CREATE) and pass-through (EDIT) both live in `createQuote` / the quote-update
path inside the `useQuotes` hook (same transaction that writes the quote), not in the
component — so the snapshot is never built in React state.

## Data Flow

1. **Subscribe:** user signs in (magic link) → opens Stripe Checkout → completes payment →
   Stripe fires webhook → `stripe-webhook` upserts `subscriptions` row.
2. **Unlock:** app calls `issue-entitlement` → signed token → verified offline → paid
   features unlock; token cached.
3. **Edit branding:** user fills the Branding settings panel (logo, identity, accent,
   footer) → saved to `UserProfile` in IndexedDB.
4. **Create quote:** entitlement checked once → `brandingSnapshot` captured onto the Quote.
5. **Render PDF:** `generateQuotePdf(quote)` renders from `brandingSnapshot` only.
6. **Lapse:** Stripe fires `subscription.deleted` / `payment_failed` → webhook updates row
   → next `issue-entitlement` returns `inactive` → grace window → gate closes for new quotes.

## PDF Rendering Changes (`src/pdf/generateQuotePdf.ts`)

All driven by `quote.brandingSnapshot`; absent or `whiteLabeled: false` ⇒ today's exact output.

- **Header** (replaces hardcoded `'3DCoster'` wordmark, `:60`): white-labeled + logo →
  `doc.addImage(logo, ...)` top-left, aspect-ratio fit within a max box; else business
  name as text; not white-labeled → unchanged `'3DCoster'` wordmark.
- **Seller-identity block** (new — the PDF currently shows no seller info, only the
  customer block): business name/address/email/phone/website near the header, from the
  snapshot. Note `BrandingSnapshot.address` is a **structured object** (sourced from
  `UserProfile.address`), unlike `customerSnapshot.address` which is a freeform string — so
  this needs a small seller-address formatter (street / city, province postalCode / country).
- **Accent color:** applied to the header rule, the `autoTable` header fill, and the total
  row; absent → today's default color.
- **Footer** (`:258`): white-labeled → render `footerText` or nothing; not white-labeled →
  unchanged `'Made with 3DCoster — 3dcoster.vercel.app'`.

## Gating Surfaces (UI)

- **Branding settings panel** — visible to everyone with a live preview, **locked behind a
  "Pro" overlay + upgrade CTA** for non-subscribers.
- **At quote generation** — subscribers get the branded PDF automatically; free users see a
  subtle "Upgrade to put your brand on this quote" prompt by the download button (the
  willingness-to-pay moment).
- **Account / subscription status** — sign-in, subscription state, "Manage billing"
  (Stripe Portal), and a manual "Refresh entitlement" action.

## Error Handling

**Invariant: a quote PDF must never fail to render.**

- **Logo upload:** reject non-images; downscale via canvas and cap (~500 KB / max
  dimensions) *before* storing.
- **Render-time `addImage`:** wrapped in try/catch → fall back to business-name text if a
  logo is corrupt/oversized. **Terminal fallback** (white-labeled, logo fails, *and* no
  `businessName`): render no header brand mark at all (omit it) — do **not** reintroduce the
  `'3DCoster'` wordmark on a paid quote. The seller-identity block still renders any
  available contact fields. PDF never throws and never wrongly re-brands.
- **Accent color:** validate hex; invalid → default color.
- **Entitlement:** expired / invalid / offline-past-grace → treat new quotes as free
  (footer). **Never block quote creation.** Within grace → still branded.
- **Stripe webhook lag** (just subscribed, token not active yet): show "Activating —
  refresh in a moment" + the manual "Refresh entitlement" action.
- **Auth:** expired/used magic link → clear re-send messaging.
- **Desktop deep-link miss:** if the protocol callback fails, offer a "paste your sign-in
  link" fallback.

## Testing Strategy

- **Unit — token verification:** valid / expired / tampered-payload / wrong-key against the
  baked public key; offline grace-window boundary (just-inside vs just-outside).
- **Unit — snapshot capture:** entitled copies fields; not-entitled ⇒ `whiteLabeled:false`;
  **immutability** — edit `UserProfile` after creation, assert the Quote's
  `brandingSnapshot` is byte-identical (mirrors existing D-17 tests).
- **PDF render** (extend `generateQuotePdf.test.ts`): branded → logo + business name
  present, **no** "Made with 3DCoster"; default → existing "Made with 3DCoster" test stays
  green; accent applied; corrupt/oversized logo → graceful text fallback, no throw.
- **Supabase edge functions:** `issue-entitlement` returns active/inactive per the
  `subscriptions` row; `stripe-webhook` upserts the row on each event type and rejects
  unsigned/invalid-signature requests.
- **Manual UAT (Stripe test mode):** subscribe → unlock → branded PDF; cancel → new quote
  reverts, old stays branded; offline grace holds; desktop magic-link deep-link round-trip.

## Security

- Public key baked into the build is safe (public by design).
- Private signing key + Stripe secret live only in Supabase secrets, never in the client.
- RLS: a user reads only their own `subscriptions` row.
- Stripe webhook signature verified before any row write.
- Logo stored as data URL in local IndexedDB only; never uploaded anywhere.

## Out of Scope (this release)

- Multiple quote templates / themes (fast-follow once core ships).
- Branding applied to app UI (PDF only for v1).
- Team / multi-seat accounts.
- White-labeling any surface other than the quote PDF.
- The US Tax Reserve Estimator (separate free-tier feature — its own spec).

## Suggested Implementation Phasing (for writing-plans)

This spec spans two layers; natural phase boundary:

1. **Entitlement foundation** — Supabase auth (magic link, web + desktop), `subscriptions`
   table + RLS, `stripe-webhook` + `issue-entitlement` edge functions, Stripe
   Checkout/Portal wiring, client token verification + offline grace + `useEntitlement`
   hook + account UI. Shippable and testable on its own (gate exists, nothing yet gated).
2. **White-label feature** — `UserProfile`/`Quote` type + validator changes, Branding
   settings panel with Pro lock, snapshot capture at quote creation, `generateQuotePdf`
   branding rendering, upgrade CTAs, tests.
