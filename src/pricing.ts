// ---------------------------------------------------------------------------
// src/pricing.ts — single source of truth for marketing-site Pro pricing copy
// (Phase 45-03, BRAND-01 D-06).
//
// These values MUST stay byte-identical to
// src/components/pro/BillingPanel.tsx's MONTHLY_PRICE_LABEL /
// ANNUAL_PRICE_LABEL (Phase 43-06, PRO-04) — the shipped billing truth. Every
// marketing pricing spot (this /pricing page — 45-03, the landing-page Pro
// teaser — 45-04, the features-table Pro column — 45-05) imports from here
// instead of re-typing the strings, so there is exactly one place to update.
//
// src/pages/PricingPage.test.tsx is the regex-guard test (mirroring the
// TermsPage.test.tsx precedent) that fails if BillingPanel.tsx's literals
// ever drift from these exports.
//
// Do NOT modify BillingPanel.tsx to "match" this file — this file mirrors
// BillingPanel.tsx, not the other way around.
// ---------------------------------------------------------------------------

import type { Currency } from './types';

export const MONTHLY_PRICE_LABEL = 'USD 7.99';
export const ANNUAL_PRICE_LABEL = 'USD 79';

/** "USD 7.99/mo · USD 79/yr" — reused across the 3 marketing pricing spots. */
export const PRO_PRICE_SUMMARY = `${MONTHLY_PRICE_LABEL}/mo · ${ANNUAL_PRICE_LABEL}/yr`;

// ---------------------------------------------------------------------------
// Phase 45-12 (G-45-CURRENCY) — numeric + billing-currency constants, added
// ALONGSIDE the label constants above (which stay byte-identical to
// BillingPanel.tsx and the byte-match guard). These give the home-currency
// approximation layer (src/utils/pricingDisplay.ts, src/hooks/useDisplayPrice.ts)
// numbers to convert from, without ever hardcoding a converted figure.
//
// Phase 45-14 (G-45-BILLING-CURRENCY) — re-based from the prior Euro-billed
// price to USD 7.99/USD 79 (founder decision, UAT chat 2026-07-20: the
// company is Canadian; bill in USD). Paddle (Merchant of Record) will
// localize checkout later — nothing Paddle-side to code here.
// ---------------------------------------------------------------------------

export const MONTHLY_PRICE_AMOUNT = 7.99;
export const ANNUAL_PRICE_AMOUNT = 79;
export const BILLING_CURRENCY: Currency = 'USD';
