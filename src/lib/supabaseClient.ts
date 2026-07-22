import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// supabaseClient — Supabase singleton for web AND desktop (Phase 46-02, D-08).
//
// The client is `null` when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
// not configured — every consumer MUST guard on it. This is the ONLY case
// that produces a null client now: desktop (Tauri) is no longer web-only
// (D-08 reverses Phase 43's D-12 web-first scoping). The free-floor
// calculator must keep working with zero backend dependency on BOTH shells
// (PRO-01), so a missing env var degrades to "Pro features unavailable"
// instead of throwing at module-import time and taking the whole app down.
//
// Session storage disposition (threat model T-43-09, ACCEPTED — extended to
// desktop by T-46-04): supabase-js stores the auth session in localStorage.
// On web, a pure SPA with no server has no httpOnly-cookie session path; the
// strict production CSP (`script-src 'self'`, no unsafe-inline — see
// vercel.json) is the compensating XSS control. On desktop, the session
// persists in the Tauri WebView's own localStorage (WKWebView / WebView2 /
// WebKitGTK all persist it across restarts by default — RESEARCH A1); no new
// Tauri plugin (Stronghold/Keyring) is introduced — same accepted threat
// model as web, single-local-user desktop app, OS file permissions protect
// WebView storage.
// ---------------------------------------------------------------------------

function buildClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) {
    // Not an error: the free floor is fully functional without a backend.
    // Surfacing a warn (not throw) keeps a misconfigured deploy usable.
    console.warn(
      '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not configured — Pro sign-in disabled.'
    );
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      // supabase-js v2 magic-link flow: PKCE (never read tokens off
      // location.hash — that is the deprecated implicit-flow pattern),
      // session persisted to localStorage (T-43-09 disposition above),
      // and the redirect-callback code exchange handled automatically.
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/**
 * The app-wide Supabase client singleton (web AND desktop, D-08).
 *
 * `null` on web or desktop builds without Supabase env config — every call
 * site must guard (`if (!supabase) return;`) so the free floor never touches
 * the backend (PRO-01).
 */
export const supabase: SupabaseClient | null = buildClient();
