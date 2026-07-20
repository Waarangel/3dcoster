import { test, expect } from '@playwright/test';

// Phase 45-08 (D-12 vs D-02) — proves the route-scoped consent-banner brand
// override lands on marketing routes only, and never touches /app.
//
// Both assertions run in fresh (no-consent) contexts and never accept/reject
// the banner — this spec must not disturb the free-floor-no-network (PRO-01)
// or consent-gate (D-14) invariants those other specs guard.
const BRAND_DARK_BG = '#0a0e18';
const SLATE_BG = '#0f172a';

test.describe('Consent-banner brand scoping (D-12 vs D-02)', () => {
  test('marketing route renders the banner in the Cost-Truth Dark palette', async ({ page }) => {
    // Same navigator.webdriver override as consent-gate.spec.ts — vanilla-
    // cookieconsent's hideFromBots (default true) otherwise skips rendering
    // #cc-main entirely under Playwright's Chromium.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto('/');

    await expect(page.locator('body')).toHaveClass(/route-marketing/);

    const ccMain = page.locator('#cc-main');
    await ccMain.waitFor({ state: 'attached' });

    const ccBg = await ccMain.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--cc-bg').trim(),
    );
    expect(ccBg).toBe(BRAND_DARK_BG);
  });

  test('/app renders the banner in the slate palette, no route-marketing marker', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto('/app');

    await expect(page.locator('body')).not.toHaveClass(/route-marketing/);

    const ccMain = page.locator('#cc-main');
    await ccMain.waitFor({ state: 'attached' });

    const ccBg = await ccMain.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--cc-bg').trim(),
    );
    expect(ccBg).toBe(SLATE_BG);
  });
});
