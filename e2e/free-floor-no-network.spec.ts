import { test, expect } from '@playwright/test';

// Phase 43-03 (PRO-01) — the automated free-floor boundary guarantee.
//
// PRO-01's hard boundary: the free-floor calculator must load AND save with
// ZERO requests to the Supabase origin while signed out. Accounts exist ONLY
// for Pro features; the moment any free-floor code path touches the backend,
// this test fails.
//
// Runs against the built app on the pinned :4173 preview server
// (playwright.config.ts) — the same harness as consent-gate.spec.ts. The
// production build bakes VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in, so the
// supabase client IS constructed on app load; the assertion below proves that
// construction alone (plus a full signed-out calculator + save-job flow)
// never crosses the network boundary.
//
// Matches any *.supabase.co origin (covers the configured project URL and
// any accidental hardcoded ref) — mirrors the vercel.json connect-src scope.
const SUPABASE_REQUEST_PATTERN = /^https?:\/\/[^/]*\bsupabase\.co\//i;

test.describe('Free floor is backend-silent when signed out (PRO-01)', () => {
  test('full calculator + save-job flow makes zero Supabase-origin requests', async ({ page }) => {
    // Belt: record every request so the final assertion can list offenders.
    const supabaseRequests: string[] = [];
    page.on('request', (request) => {
      if (SUPABASE_REQUEST_PATTERN.test(request.url())) {
        supabaseRequests.push(request.url());
      }
    });

    // Braces: hard-block the origin at the routing layer too, so even a
    // request that raced past the listener can never actually reach the
    // backend from this test.
    await page.route(/supabase\.co/i, (route) => {
      supabaseRequests.push(route.request().url());
      return route.abort();
    });

    // Signed-out free-floor session: straight into the calculator app.
    await page.goto('/app');

    // Fresh profile → the Phase 42 onboarding wizard shows (no owned printer
    // instances). Add a printer via the wizard's step-0 tile — saving a job
    // requires an owned printer instance, and this is the natural new-user
    // path — then skip the remaining steps.
    const wizard = page.getByLabel('Guided setup');
    await wizard.waitFor({ state: 'visible' });
    await wizard.getByRole('button', { name: 'Bambu Lab A1 mini' }).click();
    await wizard.getByRole('button', { name: /Skip — I know what I'm doing/ }).click();
    await wizard.waitFor({ state: 'hidden' });

    // Enter values: name the print, pick a filament, set grams. These are
    // the three gates on the Save button (name + filament + trueCost > 0).
    await page.getByLabel('Print Name *').fill('Free floor smoke print');

    // The dropdown trigger's accessible name is "Filament" (aria-labelledby
    // points at the field label, overriding the "Select filament..." text).
    await page.getByRole('button', { name: 'Filament', exact: true }).click();
    await page.getByLabel('Search filaments').fill('PLA');
    await page.getByRole('menuitem').first().click();

    await page.getByLabel('Grams', { exact: true }).fill('120');

    // Save the job — the flow the PRO-01 boundary protects end-to-end.
    const saveButton = page.getByRole('button', { name: 'Save Job for Tracking' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(page.getByText('Job saved.')).toBeVisible();

    // The PRO-01 guarantee: the entire signed-out load + enter + save flow
    // produced ZERO requests to the Supabase origin.
    expect(supabaseRequests).toEqual([]);
  });
});
