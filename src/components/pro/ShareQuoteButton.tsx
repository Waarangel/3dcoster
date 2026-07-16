import { useState } from 'react';
import type { Quote } from '../../types';
import type { PublishOptions } from '../../hooks/usePublishedQuote';
import { useProAuth } from '../../hooks/useProAuth';
import { Button, useToast } from '../ui';
import { formatQuoteNumber } from '../../utils/format';
import { NewBadge } from '../NewBadge';
import { ProPitchModal } from './ProPitchModal';
import { SignInModal } from './SignInModal';

// ---------------------------------------------------------------------------
// ShareQuoteButton — publish/unpublish a hosted quote link (Phase 43-04,
// PRO-02) or, for a signed-out user, the D-10 Pro chip + one pitch modal.
//
// D-12: web-first — renders nothing under __IS_TAURI__ regardless of caller
// (self-contained gate, so every mount site stays correct even if a future
// caller forgets to gate it).
//
// `publish`/`unpublish` are injected from a SINGLE `usePublishedQuote()` call
// at the container level (JobsManager / PrintQuoteModal), not called here —
// mirrors the project's PERF-09 "lift the subscription, thread it down"
// convention and avoids one Supabase round-trip per rendered quote row.
// ---------------------------------------------------------------------------

interface ShareQuoteButtonProps {
  quote: Quote;
  publish: (quote: Quote, options?: PublishOptions) => Promise<string>;
  unpublish: (quote: Quote) => Promise<void>;
}

export function ShareQuoteButton({ quote, publish, unpublish }: ShareQuoteButtonProps) {
  const { isSignedIn } = useProAuth();
  const toast = useToast();
  const [showPitch, setShowPitch] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (__IS_TAURI__) return null; // D-12: Pro is web-only

  const isPublished = quote.publishStatus === 'published';
  const label = formatQuoteNumber(quote.quoteNumber);

  if (!isSignedIn) {
    return (
      <>
        <div className="relative inline-flex">
          <Button
            type="button"
            variant="secondary"
            btnSize="sm"
            onClick={(e) => { e.stopPropagation(); setShowPitch(true); }}
            aria-label={`Share quote ${label} (Pro feature)`}
          >
            Share quote
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-600/30 text-blue-300 rounded">
              Pro
            </span>
          </Button>
          <NewBadge feature="share-quote" className="absolute -top-1 -right-1 pointer-events-none" />
        </div>
        <ProPitchModal
          isOpen={showPitch}
          onClose={() => setShowPitch(false)}
          onSignIn={() => setShowSignIn(true)}
        />
        <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
      </>
    );
  }

  const handlePublish = async () => {
    setIsBusy(true);
    try {
      const url = await publish(quote);
      try {
        await navigator.clipboard?.writeText(url);
        toast.success(`Quote published — link copied to your clipboard: ${url}`);
      } catch {
        toast.success(`Quote published: ${url}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish this quote.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnpublish = async () => {
    setIsBusy(true);
    try {
      await unpublish(quote);
      toast.success('Quote unpublished — the link no longer works.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unpublish this quote.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <Button
        type="button"
        variant={isPublished ? 'secondary' : 'primary'}
        btnSize="sm"
        disabled={isBusy}
        onClick={(e) => {
          e.stopPropagation();
          void (isPublished ? handleUnpublish() : handlePublish());
        }}
        aria-label={isPublished ? `Unpublish quote ${label}` : `Share quote ${label}`}
      >
        {isBusy ? (isPublished ? 'Unpublishing…' : 'Publishing…') : (isPublished ? 'Unpublish' : 'Share quote')}
      </Button>
      {!isPublished && <NewBadge feature="share-quote" className="absolute -top-1 -right-1 pointer-events-none" />}
    </div>
  );
}
