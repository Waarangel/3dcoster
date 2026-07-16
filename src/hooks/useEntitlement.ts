import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useProAuth } from './useProAuth';

// ---------------------------------------------------------------------------
// useEntitlement — read-only view of the signed-in user's Pro entitlement
// (Phase 43-06, PRO-04).
//
// The entitlements row is written EXCLUSIVELY by the signature-verified
// Paddle webhook (api/webhooks/paddle.ts) via the service role — the table
// has no client INSERT/UPDATE/DELETE policy at all (see
// supabase/migrations/0001_pro_backend.sql). This hook only ever SELECTs the
// user's own row through the owner-scoped `entitlements_owner_select` RLS
// policy; it can never write, and it never reads anyone else's row.
//
// Safe to call unconditionally: when `supabase` is null (Tauri desktop or
// unconfigured web build) or the user is signed out, it reports a permanent
// not-Pro state and touches no network (PRO-01 free-floor guarantee).
// ---------------------------------------------------------------------------

/**
 * The single home of the "which Paddle statuses count as Pro" vocabulary.
 * `active`   — subscription in good standing.
 * `past_due` — a renewal payment failed and Paddle is retrying (dunning
 *              grace); the maker keeps Pro until Paddle resolves or cancels.
 * There is NO trial state anywhere (D-04) — `trialing` is deliberately not
 * accepted; the free tier is the trial.
 *
 * Examples:
 *   isProStatus('active')   → true
 *   isProStatus('past_due') → true
 *   isProStatus('canceled') → false
 *   isProStatus(null)       → false
 */
export function isProStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'past_due';
}

export interface Entitlement {
  /** True when status is active or past-due-grace (see isProStatus). */
  isPro: boolean;
  /** 'monthly' | 'annual' as written by the webhook, or null when no row exists. */
  plan: string | null;
  /** Paddle subscription status verbatim ('active' | 'past_due' | 'canceled' | 'paused'), or null. */
  status: string | null;
  /** End of the current paid period (renewal date, or access-until date after cancel). */
  currentPeriodEnd: Date | null;
  /** Re-reads the entitlements row (e.g. after a checkout completes). */
  refresh: () => Promise<void>;
}

interface EntitlementRow {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
}

export function useEntitlement(): Entitlement {
  const { user } = useProAuth();
  const userId = user?.id ?? null;

  const [row, setRow] = useState<EntitlementRow | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!supabase || !userId) {
      setRow(null);
      return;
    }
    try {
      // Owner-scoped RLS read of the user's OWN row only — never a write.
      const { data, error } = await supabase
        .from('entitlements')
        .select('plan, status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('[useEntitlement] read failed:', error.message);
        return;
      }
      setRow((data as EntitlementRow | null) ?? null);
    } catch (err) {
      console.error('[useEntitlement] read failed:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId) {
      setRow(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  return {
    isPro: isProStatus(row?.status),
    plan: row?.plan ?? null,
    status: row?.status ?? null,
    currentPeriodEnd: row?.current_period_end ? new Date(row.current_period_end) : null,
    refresh,
  };
}
