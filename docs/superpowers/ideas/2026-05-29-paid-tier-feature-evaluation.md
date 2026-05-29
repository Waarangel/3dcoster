# Paid-Tier Feature Evaluation

**Date:** 2026-05-29
**Status:** Ideas / evaluation — no implementation committed
**Context:** Marcus wants to start planning paid-tier features and had five candidate ideas
but wasn't sure which make sense. This documents the evaluation. No build work is started.

## The governing premise (architectural red flag)

3DCoster is **local-first with no backend, no accounts, no billing**. Four of the five
candidate features need a server to hold API secrets and OAuth tokens — they **cannot** be
done safely client-side (API keys in a static Vercel/Tauri bundle = leaked keys). So the
real "Project 0" is the **paid-tier foundation**: identity + a way to take money +
entitlement gating.

The free/paid line is already set in `PROJECT.md`: *"Free for the person; paid when the
tool wears your brand to your customers, or works while you sleep"* — i.e. paid =
**branding + hosted + integrations + automation**. The free tier (calculator + every
cost-model improvement) stays free and 100% local forever.

## The five candidate ideas, ranked

| Idea | Fit (brand / automation) | Lift | Verdict |
|---|---|---|---|
| **White-label quotes** | Textbook "wears your brand." PDF engine already exists. Already named the flagship paid feature + "peak willingness-to-pay." | **Low** | **Chosen first** — see spec |
| **Marketplace API** (Etsy/eBay order import) | Textbook "works while you sleep." Auto-creates sales → real profit tracking. Highest ongoing value. | **High** — OAuth, backend, Etsy app approval | Strong second |
| **Accounting integration** (QuickBooks/Xero/Wave) | "Works while you sleep" for real businesses. Overlaps with taxes. | Medium — OAuth + backend | Serves most serious users |
| **Shipper API** (EasyPost/Shippo live rates) | Improves quote accuracy, but it's *convenience*, not brand/automation. Most hobbyist sellers estimate or ship flat-rate. | Medium | Niche; weakest standalone case |
| **Personal income & business taxes** | Highest liability + scope risk. Jurisdiction-heavy. | High | **Reframe** to a free-tier reserve *estimator*, not a tax engine — see separate doc |

## Decisions made this session

1. **First paying customer:** side-seller wanting to look professional → **white-label quotes**.
2. **Monetization:** subscription (recurring).
3. **Backend:** Supabase (already configured; auth + Postgres + edge functions in one).
4. **Auth:** magic link (passwordless).
5. **Entitlement:** short-lived signed token verified offline + grace window (reusable primitive).

The white-label design (which also stands up the reusable entitlement foundation) is fully
specified and review-approved in
[../specs/2026-05-29-white-label-quotes-design.md](../specs/2026-05-29-white-label-quotes-design.md).

## Suggested future sequencing (not committed)

1. **Entitlement foundation + white-label** (specified) — proves people will pay, with the
   lowest-lift feature.
2. **Marketplace order import** — reuses the foundation; highest automation value.
3. **Accounting integration** — for serious businesses; folds in the "accountant-ready
   export" angle that replaces a tax engine.
4. **Shipper live rates** — only if demand signals it; weakest standalone case.

## Open product questions (deferred, not blocking)

- Price point + billing cadence (monthly/annual) + free trial — business call; Stripe
  handles it, doesn't change architecture.
- Whether the tax reserve estimator stays free (recommended) or is bundled into a paid
  "business" tier later.
