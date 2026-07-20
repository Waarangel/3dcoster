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

export const MONTHLY_PRICE_LABEL = 'EUR 6.90';
export const ANNUAL_PRICE_LABEL = 'EUR 69';

/** "EUR 6.90/mo · EUR 69/yr" — reused across the 3 marketing pricing spots. */
export const PRO_PRICE_SUMMARY = `${MONTHLY_PRICE_LABEL}/mo · ${ANNUAL_PRICE_LABEL}/yr`;
