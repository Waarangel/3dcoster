import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { MONTHLY_PRICE_LABEL, ANNUAL_PRICE_LABEL } from '../pricing';

// ---------------------------------------------------------------------------
// Phase 45-03 — pricing byte-match guard (BRAND-01, D-06).
//
// Mirrors the TermsPage.test.tsx regex-guard precedent (Phase 43-02): the
// marketing site's Pro price labels (this /pricing page, plus 45-04's
// landing teaser and 45-05's features-table Pro column, both of which import
// from src/pricing.ts) must never drift from the shipped billing truth in
// BillingPanel.tsx. This closes the Wave-0 content-lock gap flagged in
// 45-VALIDATION.md.
// ---------------------------------------------------------------------------

const BILLING_PANEL_SRC = readFileSync(
  resolve(__dirname, '../components/pro/BillingPanel.tsx'),
  'utf8',
);

describe('pricing constants (src/pricing.ts)', () => {
  it('exports the locked Pro price labels', () => {
    expect(MONTHLY_PRICE_LABEL).toBe('EUR 6.90');
    expect(ANNUAL_PRICE_LABEL).toBe('EUR 69');
  });

  it("BillingPanel.tsx still contains the byte-identical price literals (catches drift)", () => {
    expect(BILLING_PANEL_SRC).toMatch(/EUR 6\.90/);
    expect(BILLING_PANEL_SRC).toMatch(/EUR 69/);
  });

  it('src/pricing.ts values equal the literals BillingPanel.tsx defines', () => {
    expect(BILLING_PANEL_SRC).toContain(`'${MONTHLY_PRICE_LABEL}'`);
    expect(BILLING_PANEL_SRC).toContain(`'${ANNUAL_PRICE_LABEL}'`);
  });
});
