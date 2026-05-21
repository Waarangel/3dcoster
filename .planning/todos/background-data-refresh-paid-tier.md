---
created: 2026-05-21
title: Background data refresh — paid-tier feature (tax + marketplace + shipping rates)
area: monetization
resolves_phase: []
files:
  - (new backend service — separate repo)
  - src/services/rateRefresh.ts (new — paid-tier client)
  - src/data/taxRates.ts (existing — free-tier static fallback)
  - src/components/SettingsModal.tsx (new — Pro toggle + last-fetched badge)
---

# Background data refresh — paid-tier feature

## Why

Three independent free-tier data tables drift over time and the user has to
trust that 3DCoster bundles current numbers:

1. **Tax rates** (`src/data/taxRates.ts`) — statutory rates by region
2. **Marketplace fees** (`src/components/SettingsModal.tsx` marketplace tab) —
   Etsy, eBay, Amazon Handmade, etc. percentage + flat-fee schedules
3. **Shipping carrier base rates** (`src/components/SettingsModal.tsx`
   delivery tab) — USPS / UPS / FedEx / Royal Mail base costs

For a free-tier user this is fine — they get whatever the latest release
bundled, and can manually override anything. **For a small-business power
user pricing 20 jobs a week**, stale marketplace fees compound into real
margin error. This is exactly the "works while you sleep" arm of the
free/paid principle (PROJECT.md line 87):

> Free for the person; paid when the tool wears your brand to your
> customers, or works while you sleep.

A paid-tier subscriber should not have to wait for the next release to get
the new Etsy transaction fee, the new Royal Mail tracked-48 price, or the
2027 EU VAT rate change. The free tier stays honest (static data baked in,
clearly dated); the paid tier removes the staleness ceiling entirely.

## What

A paid-tier toggle in Settings → "Auto-refresh rates weekly" that:

1. **Boot-time fetch (lazy):** App calls `https://rates.3dcoster.io/v1/snapshot`
   (or similar — exact URL TBD) on launch, with `If-Modified-Since` so most
   cold starts cost zero bytes.
2. **Weekly background refresh:** A scheduled background fetch (service
   worker / Tauri scheduled task) pulls the snapshot once per week and
   merges into IndexedDB. If offline, no-op — next launch retries.
3. **Three feeds, one snapshot:**
   - `taxRates`: same shape as `src/data/taxRates.ts` `TAX_RATES`
   - `marketplaceFees`: schedule for Etsy/eBay/Amazon/Shopify/Gumroad/etc.
   - `shippingRates`: per-carrier base + per-kg schedules for USPS/UPS/
     FedEx/Royal Mail/Australia Post/Canada Post/DHL/etc.
4. **Settings indicator:** "Last refreshed: 2 days ago" + a "Refresh now"
   button. If a fetch failed: "Last refreshed: 2 days ago — last attempt
   2h ago failed (will retry)".
5. **Fallback to static:** If the snapshot endpoint is down or the user
   cancels their subscription, app falls back to the bundled
   `src/data/taxRates.ts` / marketplace defaults / shipping defaults from
   the last release. Nothing breaks; freshness just drops.

## Acceptance

- [ ] Backend service publishes a versioned `snapshot.json` (S3 + Cloudflare,
      cheap to serve). Backend code lives in a separate repo.
- [ ] App ships a paid-tier client at `src/services/rateRefresh.ts` that
      handles fetch / cache / merge / fallback.
- [ ] Settings → Costs & Rates tab gains a "Auto-refresh rates" toggle
      visible only to paid-tier users; free-tier users see "Available in Pro"
      with the standard upgrade affordance.
- [ ] "Last refreshed" indicator + "Refresh now" button render correctly in
      both stale and fresh states.
- [ ] Background fetch is rate-limited (no thundering herd if 10k users
      launch the app within 30s of each other on a release morning).
- [ ] Tauri desktop version uses Tauri's scheduled-task API; web version
      uses Background Sync via service worker.

## Constraints

- **Free-tier UX must not regress.** Free users see the same static
  experience they always did. The toggle and indicator are absent for them
  (not just disabled — invisible) to avoid feature-tease anti-pattern.
- **Privacy.** No user data leaves the device on the refresh fetch.
  Snapshot URL is unauthenticated (paid-tier check happens client-side
  against the user's license token; the bytes themselves are public). This
  keeps the snapshot CDN-cacheable and avoids the "we're sending your
  pricing to a server" trust question.
- **Offline-first remains the contract.** A user who's been offline for
  6 weeks sees their last-cached snapshot (or the bundled static fallback,
  whichever is newer). Nothing in the app blocks on a network call.

## Open product questions (for discuss-phase when this lands)

- Is this Pro-tier alone, or also part of the entry-level paid tier? The
  ROI math (a marketplace fee change can shift quote accuracy by 1–2%)
  argues for entry-level.
- What's the right refresh cadence? Weekly is the headline; daily for
  marketplace fees during fee-change periods might warrant a separate
  faster lane.
- Do we want a "subscribe to a region's tax authority RSS" granular option
  for power users? Probably not v1; revisit if signal warrants.
- Does this become the substrate for live Etsy / Shopify API integration
  (also paid-tier per PROJECT.md line 75)? Likely yes — same client-side
  service, different upstream feeds.

## Paid-tier strategy fit

Maps directly to the **"works while you sleep"** arm of the free/paid line:

| Free tier (always) | Paid tier (this todo) |
|--------------------|------------------------|
| Static data bundled at release | Live weekly refresh |
| Manual override always available | Manual override + auto fresh defaults |
| "Verified by 3DCoster {release date}" | "Verified by 3DCoster {fetched date}" |
| Maintenance via `scripts/refresh-tax-rates.ts` | Backend service publishes feeds |

The free-tier `scripts/refresh-tax-rates.ts`
([tax-rate-refresh-script](./tax-rate-refresh-script.md)) is the **same
underlying pipeline** — it scrapes the same authoritative sources and
produces the same `TaxRateEntry` shape. The free tier ships the output as
a static commit; the paid tier ships it as a JSON feed. Build the free-tier
script first; layer the paid-tier service on top.

## Related

- [tax-rate-refresh-script](./tax-rate-refresh-script.md) — the free-tier maintainer-time refresh, prerequisite for this
- [tax-currency-coverage-expansion](./tax-currency-coverage-expansion.md) — fills the IN-02 gap; both tiers benefit
- PROJECT.md line 87 — free/paid principle
- PROJECT.md line 75 — "Live marketplace / accounting integrations — paid tier"
- PROJECT.md line 76 — "Hosted sync / multi-device sync — paid tier"
