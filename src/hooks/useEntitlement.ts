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

// ---------------------------------------------------------------------------
// D-07 — last-known-good entitlement cache.
//
// An offline paying user must still get a white-label PDF (D-07 explicitly
// accepts the small window where a just-canceled user generates a few
// white-label PDFs before their next successful read reverts them, D-06).
// The cache is scoped per-user-id in localStorage and is ONLY ever:
//   - written after a SUCCESSFUL read (Pro or not — a successful non-Pro
//     read overwrites/clears a stale Pro cache, D-06 lapse-revert)
//   - read as a fallback after a FAILED read, and only when a userId is
//     present (a signed-out user never reads the cache — no phantom Pro
//     can leak into the free floor, T-46-10).
// ---------------------------------------------------------------------------

const ENTITLEMENT_CACHE_PREFIX = 'entitlement-cache:';

function cacheKey(userId: string): string {
  return `${ENTITLEMENT_CACHE_PREFIX}${userId}`;
}

function readCache(userId: string): EntitlementRow | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as EntitlementRow;
  } catch {
    return null;
  }
}

function writeCache(userId: string, row: EntitlementRow | null): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(row));
  } catch {
    // Storage unavailable/full — the cache is a best-effort offline aid,
    // never a correctness requirement while online reads keep working.
  }
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
        // D-07: fall back to the last-known-good cached status for THIS user
        // rather than collapsing to not-Pro when the read fails (offline).
        setRow(readCache(userId));
        return;
      }
      const nextRow = (data as EntitlementRow | null) ?? null;
      setRow(nextRow);
      // Successful read (Pro or not) is the new last-known-good — a
      // successful non-Pro read overwrites a stale Pro cache (D-06).
      writeCache(userId, nextRow);
    } catch (err) {
      console.error('[useEntitlement] read failed:', err);
      setRow(readCache(userId));
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
