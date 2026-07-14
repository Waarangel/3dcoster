# Phase 43: Pro Backend - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users with a Pro account can publish a quote as a live hosted link their customer can view and approve — and can subscribe to Pro billing — without any of this touching the free-floor calculator. First backend in the project's history: Supabase eu-central-1 (Frankfurt, locked), magic-link auth (locked), hosted quote pages at `3dcoster.com/q/[uuid-v4]` (locked), one-way snapshot POST with no two-way sync (locked). Requirements PRO-01..PRO-04.

</domain>

<decisions>
## Implementation Decisions

### Billing & pricing (PRO-04)
- **D-01: Merchant of record.** Payment provider research is scoped to the MoR class (Paddle / Lemon Squeezy tier) — the provider resells on our behalf and remits EU VAT / global sales tax. A Canadian solo dev selling to EU customers does zero tax registrations. Raw Stripe (self-merchant, OSS/VAT filings) is rejected. Researcher produces the concrete pick (fees, checkout embed vs redirect, payout-to-Canada, EU invoice compliance, webhook → Supabase entitlement update).
- **D-02: Undercut the anchor: ~€6.90–7.90/mo.** Cheaper than 3DPrintQuote's €9.90 while our hosted-quote feature is new; "early supporter" framing acceptable. Final number chosen at plan/launch time within this band and feeds the BRAND-01 pricing spots (Phase 45).
- **D-03: Monthly + annual at launch.** Annual at roughly "2 months free" (e.g. €69/yr if €6.90/mo). Both SKUs configured in the MoR provider.
- **D-04: No trial.** The free tier is the trial — PDF quotes are the free floor of sharing; hosted live links are the Pro ceiling of the same capability. No trial states, no trial-abuse handling. Matches PRO-01 "accounts exist only for Pro features".

### Customer approval experience (PRO-02, PRO-03)
- **D-05: Maker's brand + powered-by.** Hosted page carries the maker's business identity (same UserProfile source as the PDF header) with a discreet "Powered by 3DCoster" footer link. Implements the free/paid principle: "paid when the tool wears your brand to your customers."
- **D-06: Approve/Decline + optional note.** Two buttons, timestamped status flip, optional free-text note on either action. No customer account, no signature ceremony.
- **D-07: Email + in-app notification.** Maker gets an email (to their account address) the moment a customer approves/declines, AND the app refreshes published-quote statuses on open. Introduces one transactional-email dependency (e.g. Resend free tier via Supabase edge function) — researcher validates provider/mechanism. Status pull-back is NOT two-way sync of quote content; only the hosted status/note/timestamp flows back.
- **D-08: Customer PII = name only.** Hosted page shows "Prepared for {customer name}" — email/address never leave the device. Smallest possible GDPR surface for the DATA-FLOW-INVENTORY update and the PRO-03 security review.

### Pro account & gating UX (PRO-01)
- **D-09: Contextual sign-in + profile home.** Hitting "Share quote" opens the magic-link sign-in inline; account/billing status lives in the existing user-profile area (header profile button). Zero new chrome for signed-out users — no-account stays first-class.
- **D-10: Share quote visible with Pro badge.** Free users see the button with a small "Pro" chip; clicking opens one short pitch modal (what a hosted link does) + signup. No nags, toasts, or banners anywhere else.
- **D-11: Lapse-safe links.** When a subscription lapses/cancels, existing hosted links STAY LIVE (the maker's customer is an innocent third party mid-deal); publishing NEW links requires active Pro. No scheduled takedowns.
- **D-12: Web first; desktop parity by launch.** Phase 43 ships Pro fully on the web app only. Tauri magic-link deep-linking / keyring session storage is explicitly OUT of this phase — it lands as a follow-up before the Phase 45 launch tag. Pro UI in the desktop build should degrade gracefully (researcher/planner decide: hide or "available on web" note).

### Publish lifecycle (PRO-02, PRO-03)
- **D-13: Frozen once published.** A hosted page is immutable — matches the local snapshot-at-generate model. Revision path: unpublish → regenerate quote → publish again (new URL; old one 404s). No in-place snapshot replacement.
- **D-14: Honor quote validity.** If the quote carries a valid-until date, the hosted page flips to "expired — contact {maker} for a fresh quote" after it and disables Approve. NOTE for planner: verify whether `Quote.lineItemsSnapshot` currently carries a validity date; if not, adding one is an additive snapshot field (planner confirms against `src/types.ts`).
- **D-15: Decision is final.** After approve/decline the page locks into "Approved/Declined on {date}"; changing their mind means contacting the maker (unpublish/republish). One state transition.
- **D-16: Branded unavailable page.** Unpublished, expired-removed, and never-existed `/q/` URLs all return the SAME friendly 3DCoster-styled "this quote is no longer available — contact the person who sent it" page with the SAME HTTP 404 status — indistinguishable responses so token existence never leaks (PRO-03 non-enumerability).

### Claude's Discretion
- Exact MoR provider pick (within D-01 class) and checkout integration shape — research-driven
- Final price within the €6.90–7.90 band and annual number; currency display strategy
- Transactional email provider/mechanism for D-07 (edge function + Resend or provider-native)
- Hosted page visual design (within maker-brand + powered-by constraint) and how much line-item detail / quote-variant tiers (Phase 41) render
- Supabase schema, RLS policy design, session/cookie mechanics — research flag territory
- Desktop degrade presentation for D-12 (hide vs teaser)
- In-app "published" status surfaces on the local Quote (badges, JobsManager/quote list treatment) and NEW-badge registration for Share quote (user-facing → `src/features.ts`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GDPR / privacy carry-forwards (Phase 42)
- `docs/DATA-FLOW-INVENTORY.md` — Pitfall C-05 defense: this phase adds backend data flows (account email, quote snapshots, customer first name, approval events, billing status). UPDATE THE INVENTORY FIRST, then `/privacy` policy text second. (Phase 42 D-08.)
- `.planning/phases/42-gdpr-onboarding/42-CONTEXT.md` — D-06: ToS Pro section gets concrete billing terms via a ToS update with a new effective date, in this phase. D-07: privacy@3dcoster.com is live (verified 2026-07-13).
- `docs/GATE-VERIFICATION.md` — the production consent gate check; Phase 42 test 4 runs at the v2.0 launch deploy. New Pro network calls must also respect the consent architecture (Supabase calls are functional, not analytics — but the inventory must say so).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — PRO-01..PRO-04 exact text; backend locked to Supabase eu-central-1 on the "How to Project" org.
- `.planning/ROADMAP.md` §Phase 43 — success criteria, research flag (auth flow implementation, RLS non-enumerability, payment provider), security gate note (PRO-03 formal review before hosted endpoint ships).

### Existing model the backend snapshots
- `src/types.ts` §Quote (~line 357) — `Quote.lineItemsSnapshot` is the exact self-contained payload PRO-02 POSTs; `customerSnapshot` holds PII that must NOT be uploaded beyond first name (D-08). Check for a validity-date field (D-14).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Quote.lineItemsSnapshot` (src/types.ts): already self-contained by design (D-17 G4 from v1.2) — the publish payload exists; publishing is a POST of this + first name + branding fields
- `UserProfile` business identity fields: same source the PDF header uses → hosted page branding (D-05)
- `useToast` + modal patterns, `Button`/`Card` UI kit: sign-in modal, Pro pitch modal, publish confirmation
- Phase 42 Playwright harness: extend for hosted-page E2E (approve flow, 404 indistinguishability)
- `src/features.ts` NEW-badge registry: "Share quote" is a user-facing feature → badge

### Established Patterns
- Snapshot-at-generate immutability (quotes) → D-13 frozen hosted pages are the same philosophy server-side
- `!__IS_TAURI__` compile-time gating (Phase 42 D-03) → D-12 web-first Pro uses the same gate style
- Additive-only schema changes, Dexie migrations, backupSchema DATE_FIELDS updates for any new local fields (publishedUrl, publishedAt, hostedStatus)
- No-nag conventions: one contextual pitch modal only (D-10), consistent with donation-strategy and NEW-badge rules

### Integration Points
- First-ever backend: Supabase project (eu-central-1) + RLS + edge functions; app gains a network boundary that must stay OUT of the free-floor path (PRO-01)
- Local `Quote` gains publish metadata (publishedUrl per PRO-02; likely publishedAt/status) — backup/export schema must follow
- `/q/[token]` route: server-rendered or edge-served page OUTSIDE the SPA free-floor bundle (noindex headers, 404 semantics) — researcher decides hosting shape (Vercel function vs Supabase-served)
- MoR provider webhooks → Supabase entitlement state → app reads billing status

</code_context>

<specifics>
## Specific Ideas

- Approval is "the money moment" — the email notification (D-07) exists because makers aren't in the app all day
- Decline notes matter: "declines with a reason are gold"
- The lapse rule (D-11) exists specifically to protect the maker's customer mid-negotiation — never yank a quote out of a live deal over a failed card payment

</specifics>

<deferred>
## Deferred Ideas

- **Full white-label hosted pages** (no 3DCoster mention) — potential higher-tier perk later; launch keeps the powered-by footer (D-05)
- **Desktop (Tauri) Pro parity** — explicitly deferred out of this phase to a pre-launch follow-up (D-12); needs magic-link deep-link/code-entry + keyring research
- **Customer decision changes / re-approval flows** — v1 is final-once-acted (D-15); revisit only if real usage shows fat-finger pain
- **Refund policy / dunning specifics** — not discussed; MoR provider defaults at launch, revisit with real subscribers

</deferred>

---

*Phase: 43-pro-backend*
*Context gathered: 2026-07-13*
