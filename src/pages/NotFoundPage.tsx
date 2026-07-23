import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

// Gap closure G-46-18 (46-12 Task 2) — friendly themed NotFound page.
//
// The web (!__IS_TAURI__) router previously had no `path="*"` catch-all, so
// any unmatched location (a stale hosted-quote link before the v2.0 deploy,
// a typo'd URL, an old bookmark) rendered `null` — a blank page with only a
// console "No routes matched location" warning. This page is the last-line
// safety net wired into src/main.tsx as the final child route inside
// MarketingLayout, so it inherits the Cost-Truth Dark theme scope plus the
// shared Header/Footer, matching every neighboring marketing page.
//
// 100% developer-authored static JSX — no dangerouslySetInnerHTML, no
// request-derived HTML sink. The requested path is never echoed into the
// page at all (T-46-12-02).
export function NotFoundPage() {
  // Keep the SPA fallback route out of search indexes. This app has no
  // head-management library (no react-helmet), so a small mount/unmount
  // effect is the proportionate way to inject a single noindex meta tag.
  // Each effect run creates and removes its OWN element instance, so a
  // StrictMode mount->unmount->mount double-invoke can never leave two
  // metas behind — the cleanup for run N always removes exactly the
  // element run N added, before run N+1 adds its own.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex');
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--bg)] via-[var(--surface)] to-[var(--bg)] flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center pt-24 pb-16 px-6" aria-labelledby="not-found-heading">
        <div className="max-w-xl mx-auto text-center">
          <h1 id="not-found-heading" className="font-display text-4xl font-bold text-[var(--ink)] mb-4">
            Page not found
          </h1>
          <p className="text-[var(--ink-soft)] leading-relaxed mb-8">
            We couldn&apos;t find the page you were looking for. It may have moved,
            or the link you followed may be out of date.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]"
          >
            Back to home
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
