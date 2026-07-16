import { useState } from 'react';
import { useProAuth } from '../../hooks/useProAuth';
import { useEntitlement } from '../../hooks/useEntitlement';
import { openCheckout, isBillingConfigured, PADDLE_PRICE_IDS } from '../../lib/paddle';
import { Button, useToast } from '../ui';

// ---------------------------------------------------------------------------
// BillingPanel — subscribe / view status / cancel for 3DCoster Pro
// (Phase 43-06, PRO-04). Mounted in UserProfileModal's Account & Pro
// section (the slot plan 43-03 reserved), signed-in branch only.
//
// Prices shown here (EUR 6.90/mo, EUR 69/yr) MUST stay byte-identical to
// the ToS values from plan 43-02 (D-02 price band, D-03 monthly+annual).
// There is NO trial state or trial copy anywhere (D-04).
//
// D-11 lapse-safe: cancellation never takes down already-published quote
// links — stated plainly in the cancel copy below; the webhook never
// touches hosted_quotes and the entitlement gate applies only to NEW
// publishes (enforced in usePublishedQuote.publish, plan 43-04).
//
// D-12: web-only — renders nothing under __IS_TAURI__ (self-contained gate,
// mirroring ShareQuoteButton).
//
// Degrade contract: with no Paddle env configured (no seller account yet /
// unconfigured deploy), the panel shows a quiet "not available yet" note
// instead of the plans — the free floor never crashes (PRO-01). An already
// -Pro user still sees their status (that read comes from Supabase, not
// Paddle).
// ---------------------------------------------------------------------------

const MONTHLY_PRICE_LABEL = 'EUR 6.90';
const ANNUAL_PRICE_LABEL = 'EUR 69';

/** Paddle-hosted cancel/portal link (public). Optional until the operator
 * creates the Paddle seller account; without it we point at Paddle's
 * receipt-email manage links instead of dead-ending the user. */
const CANCEL_URL = import.meta.env.VITE_PADDLE_CANCEL_URL as string | undefined;

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function BillingPanel() {
  const { user, isSignedIn } = useProAuth();
  const { isPro, plan, status, currentPeriodEnd, refresh } = useEntitlement();
  const toast = useToast();
  const [busyPlan, setBusyPlan] = useState<'monthly' | 'annual' | null>(null);

  if (__IS_TAURI__) return null; // D-12: Pro billing is web-only
  if (!isSignedIn || !user) return null; // parent gates on signed-in; belt and braces

  const subscribe = async (planKey: 'monthly' | 'annual') => {
    const priceId = PADDLE_PRICE_IDS[planKey];
    if (!priceId) {
      toast.error('Pro subscriptions are not available just yet.');
      return;
    }
    setBusyPlan(planKey);
    try {
      await openCheckout(priceId, { userId: user.id, email: user.email ?? undefined });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The checkout could not be opened.');
    } finally {
      setBusyPlan(null);
    }
  };

  if (isPro) {
    const planLabel = plan === 'annual' ? 'Annual' : plan === 'monthly' ? 'Monthly' : 'Pro';
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">3DCoster Pro — {planLabel} plan</p>
            <p className="text-xs text-slate-400">
              {status === 'past_due'
                ? 'Payment issue — Paddle is retrying your card. Pro stays active meanwhile.'
                : currentPeriodEnd
                  ? `Renews ${formatDate(currentPeriodEnd)}`
                  : 'Active'}
            </p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-600/30 text-blue-300 rounded shrink-0">
            Pro
          </span>
        </div>
        <div className="pt-1 border-t border-slate-700/60">
          {CANCEL_URL ? (
            <a
              href={CANCEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-blue-400 underline underline-offset-2"
            >
              Cancel or manage your subscription (Paddle)
            </a>
          ) : (
            <p className="text-xs text-slate-500">
              Cancel anytime from the subscription link in your Paddle receipt email.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Cancelling never takes down quote links you&apos;ve already shared — only
            publishing new ones needs an active subscription.
          </p>
        </div>
      </div>
    );
  }

  // Cancelled-but-still-not-lapsed rows land in the branch above (status
  // past_due) or here once fully canceled — either way, resubscribing goes
  // through the same two plans below.

  if (!isBillingConfigured()) {
    return (
      <p className="text-xs text-slate-500">
        Pro subscriptions are not available just yet — hosted quote links are coming soon.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Go Pro to publish quotes as live links your customers can approve online.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-700 p-3 flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium text-white">{MONTHLY_PRICE_LABEL}</p>
            <p className="text-xs text-slate-500">per month</p>
          </div>
          <Button
            type="button"
            variant="primary"
            btnSize="sm"
            disabled={busyPlan !== null}
            onClick={() => void subscribe('monthly')}
            aria-label="Subscribe to 3DCoster Pro monthly"
          >
            {busyPlan === 'monthly' ? 'Opening…' : 'Subscribe'}
          </Button>
        </div>
        <div className="rounded-xl border border-blue-500/40 p-3 flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium text-white">{ANNUAL_PRICE_LABEL}</p>
            <p className="text-xs text-slate-500">per year — 2 months free</p>
          </div>
          <Button
            type="button"
            variant="primary"
            btnSize="sm"
            disabled={busyPlan !== null}
            onClick={() => void subscribe('annual')}
            aria-label="Subscribe to 3DCoster Pro annual"
          >
            {busyPlan === 'annual' ? 'Opening…' : 'Subscribe'}
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Billed by Paddle (our Merchant of Record). Prices include applicable VAT/sales tax.
        Cancel anytime — existing shared links stay live.
      </p>
      {/* Post-checkout: the webhook writes the entitlement; give the user a
          manual refresh in case the overlay closed before the row landed. */}
      {/* allow-raw-html: quiet text-link refresh affordance (Button primitive would read as a CTA); has its own aria-label */}
      <button
        type="button"
        onClick={() => void refresh()}
        className="text-xs text-slate-500 hover:text-blue-400 underline underline-offset-2"
        aria-label="Refresh subscription status"
      >
        Just subscribed? Refresh status
      </button>
    </div>
  );
}
