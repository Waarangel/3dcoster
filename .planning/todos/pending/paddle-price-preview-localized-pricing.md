---
created: 2026-07-22
title: Marketing pricing — Paddle price preview in visitor's currency, retire "Billed as USD" line
area: pricing
resolves_phase: 51
origin: Founder decision 2026-07-22 (post-45 gap-closure chat) — MUST land before launch
files:
  - src/hooks/useDisplayPrice.ts (FX approximation to be replaced by Paddle preview)
  - src/utils/pricingDisplay.ts (resolveDisplayCurrency ladder + formatApproxPrice)
  - src/pricing.ts (USD 7.99/79 billing constants + guarded labels)
  - src/pages/PricingPage.tsx, src/pages/LandingPage.tsx, src/pages/FeaturesPage.tsx (the 3 Pro-pricing spots)
  - src/lib/paddle.ts
references:
  - Paddle.js PricePreview API (returns the ACTUAL localized price Paddle will charge for a market, incl. per-market overrides and tax presentation)
  - .planning/phases/45-brand-launch/45-UAT.md gaps G-45-CURRENCY + G-45-BILLING-CURRENCY (why the current FX-approximation + disclosure design exists)
---

# Marketing pricing — show Paddle's real localized price, drop the "Billed as USD" line

**Blocked on:** Paddle SKUs being created (phase 46–51 window; founder also decides per-market
price overrides vs Paddle auto-localization at SKU creation time).

**Why:** Today the marketing pages show OUR FX approximation ("~€6.31/mo · Billed as USD 7.99/mo")
because Paddle SKUs don't exist yet — USD 7.99 is the only number we control, and our FX estimate
will never exactly match what Paddle charges at checkout. Once SKUs exist, Paddle's PricePreview
returns the exact localized amount the visitor would pay, so displayed price = charged price and
the disclosure line loses its purpose.

**What to do (before launch, natural home = phase 51 launch-prep redux):**
1. After SKU creation, wire Paddle.js PricePreview into the 3 marketing Pro-pricing spots to show
   the visitor's real localized price in their own currency.
2. Remove (or demote to fine print) the "Billed as USD 7.99/mo" disclosure in markets where the
   preview resolves — founder leans remove.
3. Keep a truthful fallback when the preview can't resolve (offline/PWA, JS blocked, Paddle
   outage, unsupported market): fall back to the current USD label (+ optional FX approximation).
   Never render a blank or a guessed number — no-arbitrary-numbers rule.
4. Update the guard tests: PricingPage.test.tsx byte-match, pricingDisplay/useDisplayPrice unit
   tests, BillingPanel byte-match lockstep if labels change shape.
5. Sanity-check the display ladder still makes sense: PricePreview needs a country — stored app
   currency pref / locale inference can seed the market guess, Paddle IP-geolocation can refine.

**Do NOT do this before SKUs exist** — the whole point is showing Paddle's real number, not
another estimate.
