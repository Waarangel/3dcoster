import { test, expect } from '@playwright/test';

// Phase 42 GDPR-01/D-14 — the automated half of the hard-gate verification.
// Drives the real CookieConsentManager banner (src/components/consent/CookieConsentManager.tsx)
// against the built app on the pinned :4173 preview server (playwright.config.ts).
//
// Asserts three things, all traced to the C-04 checklist:
//   1. (T-42-03) Zero analytics beacon requests fire before any consent decision —
//      catches a regression the moment @vercel/analytics or AnalyticsGate.tsx changes,
//      unlike a manual-only checklist that silently rots.
//   2. Reject All is exactly one click — no intermediate preferences screen required.
//   3. Accept All and Reject All carry identical visual weight (Pitfall 5) — verified
//      structurally via computed font-weight and bounding-box dimensions, not merely
//      "both buttons exist".
const ANALYTICS_REQUEST_PATTERN = /insights\/script\.js|\/_vercel\/insights\//;

test.describe('Consent gate (D-14)', () => {
  test('no analytics before consent, one-click Reject All, equal-weight buttons', async ({ page }) => {
    // vanilla-cookieconsent's `hideFromBots` option (default true) checks
    // `navigator.webdriver` and silently skips rendering the banner entirely
    // when it is true — which Playwright's Chromium sets by default. Real
    // visitors never have `navigator.webdriver === true` (only WebDriver-
    // automated browsers do), so this override is test-environment-only and
    // does not change production behavior: it makes the automated browser
    // observable exactly as a real visitor would be, rather than disabling
    // the library's bot-detection for everyone.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Register the request listener BEFORE navigating so nothing fired during
    // initial page load can slip past the capture.
    const requestUrls: string[] = [];
    page.on('request', (request) => {
      requestUrls.push(request.url());
    });

    await page.goto('/');

    const acceptButton = page.getByRole('button', { name: 'Accept All' });
    const rejectButton = page.getByRole('button', { name: 'Reject All' });
    await expect(acceptButton).toBeVisible();
    await expect(rejectButton).toBeVisible();

    // 1. Zero analytics requests up to and including the moment the banner is visible.
    const analyticsRequestsBeforeConsent = requestUrls.filter((url) => ANALYTICS_REQUEST_PATTERN.test(url));
    expect(analyticsRequestsBeforeConsent).toEqual([]);

    // 3. Equal visual weight (Pitfall 5) — structural equality of the styling
    // that actually communicates "these two options are equally prominent":
    // identical font-weight, font-size, padding, and border. "Accept All" and
    // "Reject All" are both 10-character labels but individual glyphs (e.g. a
    // narrow "j" vs a wider "cc") render at slightly different natural widths
    // even with byte-identical CSS — so width itself is asserted with a
    // generous tolerance, while the styling properties that a themer could
    // actually get wrong (e.g. giving Reject an outline/ghost treatment) are
    // asserted for exact equality.
    const readButtonStyle = (el: Element) => {
      const cs = window.getComputedStyle(el);
      return {
        fontWeight: cs.fontWeight,
        fontSize: cs.fontSize,
        padding: cs.padding,
        border: cs.border,
      };
    };
    const acceptStyle = await acceptButton.evaluate(readButtonStyle);
    const rejectStyle = await rejectButton.evaluate(readButtonStyle);
    expect(acceptStyle).toEqual(rejectStyle);

    const acceptBox = await acceptButton.boundingBox();
    const rejectBox = await rejectButton.boundingBox();
    expect(acceptBox).not.toBeNull();
    expect(rejectBox).not.toBeNull();

    // Height must match exactly — it is driven purely by padding + font-size +
    // line-height, none of which vary by text content.
    expect(acceptBox!.height).toBe(rejectBox!.height);

    // Width tolerates natural glyph-width variance between the two labels but
    // still catches a real equal-weight violation (e.g. one button rendered
    // materially smaller because it lost its padding/border in a theme change).
    const WIDTH_TOLERANCE_PX = 12;
    expect(Math.abs(acceptBox!.width - rejectBox!.width)).toBeLessThanOrEqual(WIDTH_TOLERANCE_PX);

    // 2. One click on Reject All dismisses the banner entirely — no preferences
    // screen interposed between the click and the decision taking effect.
    await rejectButton.click();
    await expect(rejectButton).toBeHidden();
    await expect(acceptButton).toBeHidden();

    // Rejecting must never trigger the analytics beacon either.
    const analyticsRequestsAfterReject = requestUrls.filter((url) => ANALYTICS_REQUEST_PATTERN.test(url));
    expect(analyticsRequestsAfterReject).toEqual([]);
  });
});
