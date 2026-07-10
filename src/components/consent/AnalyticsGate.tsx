import { useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { useAnalyticsConsent } from '../../hooks/useConsent';

// Phase 42 GDPR-01/T-42-02/T-42-03 — Consent-gated Analytics mount.
//
// @vercel/analytics's <Analytics /> injects a <script src=".../insights/script.js">
// into document.head inside a mount-only useEffect (verified by reading
// node_modules/@vercel/analytics/dist/react/index.mjs). Not rendering it at all
// is sufficient to guarantee zero analytics network requests before consent
// (T-42-03) — but unmounting alone does NOT undo the script tag or the
// window.va/vaq/vam globals inject() already set (Pitfall 1). A revoke must
// explicitly strip both so a same-page "Reject All" after a prior "Accept All"
// is actually effective without a reload (T-42-02).
export function AnalyticsGate() {
  const hasConsent = useAnalyticsConsent();
  const wasMounted = useRef(false);

  useEffect(() => {
    if (hasConsent) {
      wasMounted.current = true;
      return;
    }
    if (wasMounted.current) {
      document.head.querySelectorAll('script[src*="insights/script.js"]').forEach((el) => el.remove());
      delete (window as Window & { va?: unknown }).va;
      delete (window as Window & { vaq?: unknown }).vaq;
      delete (window as Window & { vam?: unknown }).vam;
      wasMounted.current = false;
    }
  }, [hasConsent]);

  return hasConsent ? <Analytics /> : null;
}
