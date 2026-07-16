import { initializePaddle, type Paddle } from '@paddle/paddle-js';

// ---------------------------------------------------------------------------
// paddle — web-only Paddle Billing checkout singleton (Phase 43-06, PRO-04).
//
// Paddle is the Merchant of Record (D-01): it resells 3DCoster Pro on our
// behalf and remits EU VAT / global sales tax, so a Canadian solo dev does
// zero tax registrations. This module only ever opens the OVERLAY checkout —
// the money/tax flow lives entirely on Paddle's side. Entitlement truth is
// written exclusively by the signature-verified webhook
// (api/webhooks/paddle.ts); nothing in the client bundle can grant Pro.
//
// Config is env-driven and PUBLIC-only (Pitfall 4 / T-43-02):
//   VITE_PADDLE_CLIENT_TOKEN      — client-side token, safe to bundle
//   VITE_PADDLE_PRICE_ID_MONTHLY  — the EUR 6.90/mo price id (public)
//   VITE_PADDLE_PRICE_ID_ANNUAL   — the EUR 69/yr price id (public)
// The Paddle API key / webhook secret / service-role key are SERVER-only
// and must never appear in src/ or with a VITE_ prefix.
//
// Degrade contract (free floor, PRO-01): when any of the three vars is
// absent — no Paddle seller account exists yet, or an unconfigured deploy —
// `isBillingConfigured()` is false, `openCheckout` rejects with a friendly
// message, and nothing crashes at module load. Under __IS_TAURI__ (D-12)
// billing is compiled out entirely, mirroring src/lib/supabaseClient.ts.
// ---------------------------------------------------------------------------

const IS_TAURI: boolean = typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__;

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;

/**
 * Public Paddle price ids for the two Pro plans (D-03: monthly + annual).
 * The displayed prices (EUR 6.90/mo, EUR 69/yr) live in BillingPanel and
 * MUST stay identical to the ToS values from plan 43-02 — the price ids
 * here only tell Paddle which SKU to charge.
 */
export const PADDLE_PRICE_IDS = {
  monthly: import.meta.env.VITE_PADDLE_PRICE_ID_MONTHLY as string | undefined,
  annual: import.meta.env.VITE_PADDLE_PRICE_ID_ANNUAL as string | undefined,
} as const;

/**
 * True when the client-side billing surface can open a checkout: web build
 * (not Tauri) with the client token and both price ids configured.
 *
 * Examples:
 *   isBillingConfigured() → false  (Tauri, or no Paddle env vars — free floor)
 *   isBillingConfigured() → true   (web deploy with all three VITE_PADDLE_* set)
 */
export function isBillingConfigured(): boolean {
  return !IS_TAURI && !!CLIENT_TOKEN && !!PADDLE_PRICE_IDS.monthly && !!PADDLE_PRICE_IDS.annual;
}

let paddlePromise: Promise<Paddle | undefined> | null = null;

/**
 * Lazily initialise Paddle.js exactly once. Sandbox vs production is derived
 * from the client token prefix (`test_` = sandbox) so no extra env var is
 * needed to flip environments.
 */
function getPaddle(): Promise<Paddle | undefined> {
  if (IS_TAURI || !CLIENT_TOKEN) return Promise.resolve(undefined);
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: CLIENT_TOKEN,
      environment: CLIENT_TOKEN.startsWith('test_') ? 'sandbox' : 'production',
    }).catch((err: unknown) => {
      // Allow a retry on the next call instead of caching the failure forever.
      paddlePromise = null;
      console.error('[paddle] initializePaddle failed:', err);
      return undefined;
    });
  }
  return paddlePromise;
}

/**
 * Opens the Paddle OVERLAY checkout for one of the two Pro plans.
 *
 * `userId` (the Supabase auth user id) is carried as checkout `customData`
 * so the webhook (api/webhooks/paddle.ts) can map the resulting
 * subscription back to the entitlements row — this is the ONLY user_id
 * mapping mechanism; the client never writes entitlements itself.
 *
 * Examples:
 *   openCheckout(PADDLE_PRICE_IDS.monthly!, { userId, email }) → overlay opens for EUR 6.90/mo
 *   openCheckout(PADDLE_PRICE_IDS.annual!, { userId, email })  → overlay opens for EUR 69/yr
 *   openCheckout(priceId, { userId }) with no Paddle env       → rejects ("not available yet")
 *
 * Throws when billing is unconfigured or Paddle.js fails to load — callers
 * surface the message via toast; the free floor never crashes.
 */
export async function openCheckout(
  priceId: string,
  options: { userId: string; email?: string },
): Promise<void> {
  if (!isBillingConfigured()) {
    throw new Error('Pro subscriptions are not available just yet.');
  }
  const paddle = await getPaddle();
  if (!paddle) {
    throw new Error('The checkout could not be loaded. Please try again.');
  }

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(options.email ? { customer: { email: options.email } } : {}),
    customData: { user_id: options.userId },
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      showAddDiscounts: false,
    },
  });
}
