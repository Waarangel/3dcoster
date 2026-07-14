# Phase 43: Pro Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 43-pro-backend
**Areas discussed:** Billing & pricing model, Customer approval experience, Pro account & gating UX, Publish lifecycle

---

## Billing & pricing model

| Option | Description | Selected |
|--------|-------------|----------|
| Merchant of record | Paddle/Lemon Squeezy resells, remits EU VAT/global sales tax; ~5% take; zero tax registrations | ✓ |
| Stripe direct | ~3% fees, full control, but self-merchant: EU VAT OSS, GST/HST, filings | |
| Research both | Comparison at plan time | |

**User's choice:** Merchant of record

| Option | Description | Selected |
|--------|-------------|----------|
| Undercut (~€6.90–7.90/mo) | Cheaper than €9.90 anchor; early-supporter framing | ✓ |
| Match (~€9.90/mo) | Parity, differentiate on local-first/desktop/open source | |
| Decide at Phase 45 | Placeholder price in test mode until launch | |

**User's choice:** Undercut (~€6.90–7.90/mo)

| Option | Description | Selected |
|--------|-------------|----------|
| Monthly + annual | Annual ≈ 2 months free | ✓ |
| Monthly only | Simplest first integration | |
| You decide | Per MoR provider ease | |

**User's choice:** Monthly + annual

| Option | Description | Selected |
|--------|-------------|----------|
| No trial — free tier is the trial | PDF quotes are the free floor of sharing | ✓ |
| 14-day free trial | MoR-managed trial states | |
| First hosted quote free | Metered taste-of-Pro | |

**User's choice:** No trial

---

## Customer approval experience

| Option | Description | Selected |
|--------|-------------|----------|
| Maker's brand + powered-by | Maker identity front and center, discreet 3DCoster footer | ✓ |
| 3DCoster-framed page | Tool-branded page showing maker's quote | |
| Full white-label | No 3DCoster mention (deferred as later perk) | |

**User's choice:** Maker's brand + powered-by

| Option | Description | Selected |
|--------|-------------|----------|
| Approve/Decline + optional note | Timestamped flip, note either way | ✓ |
| Approve/Decline + typed name | Quasi-signature on approve | |
| Approve/Decline only | No note field | |

**User's choice:** Approve/Decline + optional note

| Option | Description | Selected |
|--------|-------------|----------|
| Email + in-app status | Email on customer action + status refresh on app open | ✓ |
| In-app only | Poll on open, zero new infra | |
| You decide | Per research on email infra | |

**User's choice:** Email + in-app status

| Option | Description | Selected |
|--------|-------------|----------|
| Name only | "Prepared for {name}"; email/address stay local | ✓ |
| Full customer block | Mirror PDF (name/email/address) | |
| No customer identity | Fully anonymous page | |

**User's choice:** Name only

---

## Pro account & gating UX

| Option | Description | Selected |
|--------|-------------|----------|
| Contextual + profile home | Sign-in at Pro action; status in profile area | ✓ |
| Header account button | Always-visible account chip | |
| Settings only | Account section in Settings | |

**User's choice:** Contextual + profile home

| Option | Description | Selected |
|--------|-------------|----------|
| Visible with Pro badge | Button + Pro chip; click = one pitch modal | ✓ |
| Hidden until signed in | Free users never see Share quote | |
| You decide | | |

**User's choice:** Visible with Pro badge

| Option | Description | Selected |
|--------|-------------|----------|
| Stay live; no new publishes | Existing links survive lapse; new publishes gated | ✓ |
| Grace period, then 404 | ~30 days + email warning, scheduled takedown | |
| Immediate 404 on lapse | Strictest | |

**User's choice:** Stay live; no new publishes

| Option | Description | Selected |
|--------|-------------|----------|
| Web first, desktop by launch | Tauri deep-link/keyring off critical path; parity before Phase 45 tag | ✓ |
| Full parity this phase | Desktop auth edge cases in-phase | |
| You decide at plan time | | |

**User's choice:** Web first, desktop by launch

---

## Publish lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen once published | Immutable page; revise = unpublish + republish new URL | ✓ |
| Republish updates same URL | In-place snapshot replace + approval reset | |
| You decide | | |

**User's choice:** Frozen once published

| Option | Description | Selected |
|--------|-------------|----------|
| Honor quote validity | Page expires per quote's valid-until; Approve disabled | ✓ |
| No auto-expiry | Manual unpublish only | |
| Fixed TTL fallback | Validity else 90-day default | |

**User's choice:** Honor quote validity

| Option | Description | Selected |
|--------|-------------|----------|
| Final once acted | Locks to "Approved/Declined on {date}" | ✓ |
| Changeable until expiry | Customer can flip decision | |
| You decide | | |

**User's choice:** Final once acted

| Option | Description | Selected |
|--------|-------------|----------|
| Branded "no longer available" | Same friendly page + same 404 status for all dead/unknown tokens | ✓ |
| Plain 404 | Generic not-found | |
| You decide | | |

**User's choice:** Branded "no longer available"

---

## Claude's Discretion

- Exact MoR provider pick + checkout integration shape (research-driven)
- Final price within €6.90–7.90 band; annual number; currency display
- Transactional email provider/mechanism
- Hosted page visual design and line-item/variant detail depth
- Supabase schema, RLS design, session mechanics (research flag)
- Desktop degrade presentation (hide vs teaser)
- Local publish-status surfaces + NEW-badge registration

## Deferred Ideas

- Full white-label hosted pages (later-tier perk)
- Desktop Tauri Pro parity (pre-launch follow-up, out of this phase)
- Customer decision-change/re-approval flows
- Refund policy / dunning specifics (MoR defaults at launch)
