import { useCallback } from 'react';
import type { Quote } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useProAuth } from './useProAuth';
import { isProStatus } from './useEntitlement';
import { isValidLogoDataUrl } from '../utils/logoDataUrl';

// ---------------------------------------------------------------------------
// usePublishedQuote — publish/unpublish a hosted quote link + pull hosted
// approve/decline status back into the app (Phase 43-04, PRO-02).
//
// Design invariants (see supabase/migrations/0001_pro_backend.sql +
// .planning/phases/43-pro-backend/43-CONTEXT.md for the full rationale):
//   D-08  Publish POSTs the customer FIRST NAME ONLY — never the full
//         customerSnapshot (email/address never leave the device).
//   D-11  LAPSE-SAFE: the entitlement check lives ONLY inside `publish` —
//         `unpublish` and `refreshStatuses` never read `entitlements`, so a
//         lapsed subscription never yanks an already-published link.
//   D-13  Frozen once published — there is no "edit" action; the revision
//         path is unpublish, regenerate the Quote, publish again (new URL).
//   D-14  Optional expiry set AT SHARE TIME (`options.expiresAt`), mirrored
//         to the local `hostedExpiresAt` — this does NOT mutate the
//         Generate-time `lineItemsSnapshot`, which stays frozen per D-17 G4.
//
// Callers pass `businessName` + `updateQuote` explicitly (dependency
// injection) rather than this hook calling `useQuotes()`/`useUserProfile()`
// itself — JobsManager already lifted its ONE `useQuotes()` subscription to
// avoid the N-subscription regression PERF-09 fixed; a second internal
// subscription here (multiplied by one `usePublishedQuote()` call per quote
// row) would reintroduce exactly that problem. Callers own the single
// subscription and thread `updateQuote` down.
// ---------------------------------------------------------------------------

export interface PublishOptions {
  /** D-14: optional expiry. Past this, the hosted page renders the same D-16 branded 404 as unpublished/unknown. */
  expiresAt?: Date;
}

export interface UsePublishedQuoteResult {
  /** Publishes `quote` as a new hosted link. Throws when signed out or without an active entitlement (D-11). Resolves to the published URL. */
  publish: (quote: Quote, options?: PublishOptions) => Promise<string>;
  /** Flips the hosted row + local Quote to 'unpublished'. The URL stays recorded on the Quote but now 404s. Never entitlement-gated (D-11). */
  unpublish: (quote: Quote) => Promise<void>;
  /** Owner-scoped pull of decision/decided_at/decision_note for every published Quote in `quotes` (D-07). Never entitlement-gated (D-11). */
  refreshStatuses: (quotes: Quote[]) => Promise<void>;
}

interface HostedQuoteInsert {
  token: string;
  owner_id: string;
  snapshot: Record<string, unknown>;
  customer_first_name: string;
  status: 'published';
  expires_at: string | null;
}

interface HostedStatusRow {
  token: string;
  decision: 'approved' | 'declined' | null;
  decided_at: string | null;
  decision_note: string | null;
}

/** First whitespace-delimited token of a full name, or '' when no name was captured. D-08: never send more than this. */
function firstNameOnly(fullName: string | undefined): string {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}

function newToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // jsdom-safe fallback (mirrors src/utils/duplicateJob.ts / customerCsv.ts) — never hit in a real browser.
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * D-11 gate — called ONLY from `publish`. `entitlements` has no client
 * INSERT/UPDATE policy (service-role/webhook only, plan 43-06); this is a
 * plain owner-scoped read via the RLS `entitlements_owner_select` policy.
 */
async function hasActiveEntitlement(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('entitlements')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return false;
  // Status vocabulary is owned by useEntitlement.isProStatus — the Paddle
  // webhook (43-06) writes 'active' | 'past_due' | 'canceled' | 'paused';
  // active + past-due-grace count as Pro (no trial anywhere, D-04).
  return isProStatus((data as { status: string | null }).status);
}

export function usePublishedQuote(
  businessName: string | undefined,
  /**
   * D-11: the maker's CURRENT logo, injected the same way as `businessName`
   * (dependency injection — this hook never reads useUserProfile itself).
   * Validated via `isValidLogoDataUrl` before it ever reaches the publish
   * snapshot (client half of Pitfall 4's defense-in-depth; the server half
   * lives in api/lib/logoDataUrl.ts, a lockstep copy).
   */
  logoDataUrl: string | undefined,
  updateQuote: (quote: Quote) => Promise<void>,
): UsePublishedQuoteResult {
  const { session } = useProAuth();

  const publish = useCallback(
    async (quote: Quote, options?: PublishOptions): Promise<string> => {
      if (!supabase) {
        throw new Error('Pro features are unavailable.');
      }
      const userId = session?.user.id;
      if (!userId) {
        throw new Error('Sign in to publish a hosted quote.');
      }

      // D-11: the ONLY entitlement read in this whole file — scoped to
      // "new publish," never to any read/unpublish/refresh path.
      const entitled = await hasActiveEntitlement(userId);
      if (!entitled) {
        throw new Error('An active Pro subscription is required to publish a new quote link.');
      }

      const token = newToken();
      const trimmedBusinessName = businessName?.trim();
      // D-11: the logo is captured HERE, at publish time, from whatever is
      // CURRENTLY on the injected `logoDataUrl` — it freezes into this row
      // and a later profile logo change never touches already-published
      // rows. D-09: an invalid/absent logo is silently omitted (never a
      // malformed value), which is what lets the hosted page fall back to
      // the powered-by footer server-side.
      const validLogoDataUrl = isValidLogoDataUrl(logoDataUrl) ? logoDataUrl : undefined;
      const snapshot: Record<string, unknown> = {
        ...quote.lineItemsSnapshot,
        ...(trimmedBusinessName ? { businessName: trimmedBusinessName } : {}),
        ...(quote.variantsSnapshot ? { variantsSnapshot: quote.variantsSnapshot } : {}),
        ...(validLogoDataUrl ? { logoDataUrl: validLogoDataUrl } : {}),
      };

      const insertPayload: HostedQuoteInsert = {
        token,
        owner_id: userId,
        snapshot,
        // D-08: first name only — NEVER the full customerSnapshot (email/address stay on-device).
        customer_first_name: firstNameOnly(quote.customerSnapshot.name),
        status: 'published',
        expires_at: options?.expiresAt ? options.expiresAt.toISOString() : null,
      };

      const { error } = await supabase.from('hosted_quotes').insert(insertPayload);
      if (error) {
        throw new Error(error.message || 'Could not publish this quote.');
      }

      const publishedUrl = `https://3dcoster.com/q/${token}`;
      await updateQuote({
        ...quote,
        publishedUrl,
        publishedAt: new Date(),
        publishStatus: 'published',
        hostedToken: token,
        hostedExpiresAt: options?.expiresAt,
      });

      return publishedUrl;
    },
    [session, businessName, logoDataUrl, updateQuote],
  );

  const unpublish = useCallback(
    async (quote: Quote): Promise<void> => {
      if (!supabase) return;
      const userId = session?.user.id;
      if (!userId || !quote.hostedToken) return;

      // No entitlement read here (D-11) — a lapsed subscription must never block unpublish.
      const { error } = await supabase
        .from('hosted_quotes')
        .update({ status: 'unpublished' })
        .eq('token', quote.hostedToken)
        .eq('owner_id', userId);
      if (error) {
        throw new Error(error.message || 'Could not unpublish this quote.');
      }

      await updateQuote({ ...quote, publishStatus: 'unpublished' });
    },
    [session, updateQuote],
  );

  const refreshStatuses = useCallback(
    async (quotes: Quote[]): Promise<void> => {
      if (!supabase) return;
      const userId = session?.user.id;
      if (!userId) return;

      const published = quotes.filter(
        (q): q is Quote & { hostedToken: string } => q.publishStatus === 'published' && !!q.hostedToken,
      );
      if (published.length === 0) return;

      // No entitlement read here (D-11) — status pull-back must survive a lapsed subscription.
      const { data, error } = await supabase
        .from('hosted_quotes')
        .select('token, decision, decided_at, decision_note')
        .eq('owner_id', userId)
        .in('token', published.map(q => q.hostedToken));
      if (error || !data) return;

      const byToken = new Map((data as HostedStatusRow[]).map(row => [row.token, row]));

      for (const quote of published) {
        const row = byToken.get(quote.hostedToken);
        if (!row || !row.decision) continue;

        const decidedAt = row.decided_at ? new Date(row.decided_at) : undefined;
        const noteChanged = (row.decision_note ?? undefined) !== quote.hostedDecisionNote;
        const decisionChanged = row.decision !== quote.hostedDecision;
        if (!decisionChanged && !noteChanged) continue; // avoid a redundant local write

        await updateQuote({
          ...quote,
          hostedDecision: row.decision,
          hostedDecisionAt: decidedAt,
          hostedDecisionNote: row.decision_note ?? undefined,
        });
      }
    },
    [session, updateQuote],
  );

  return { publish, unpublish, refreshStatuses };
}
