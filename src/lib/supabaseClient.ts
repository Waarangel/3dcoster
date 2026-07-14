import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// supabaseClient — web-only Supabase singleton (Phase 43-03, PRO-01 / D-12).
//
// The client is `null` in two cases and every consumer MUST guard on it:
//   1. Tauri desktop builds (`__IS_TAURI__` compile-time define is true) —
//      D-12 web-first: the desktop app ships no Pro/auth surface at all, so
//      after Vite's define replacement the whole `createClient(...)` branch
//      (and the supabase-js import with it) is dead code the bundler drops.
//   2. Web builds without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set —
//      the free-floor calculator must keep working with zero backend
//      dependency (PRO-01), so a missing env var degrades to "Pro features
//      unavailable" instead of throwing at module-import time and taking the
//      whole app down with it.
//
// The `typeof` guard exists for Vitest: the `__IS_TAURI__` define is a Vite
// build-time constant that does not exist under the test runner unless a test
// stubs it (vi.stubGlobal). In real builds esbuild replaces the entire
// `typeof __IS_TAURI__ ...` expression with a constant, so this costs nothing.
//
// Session storage disposition (threat model T-43-09, ACCEPTED): supabase-js
// stores the auth session in localStorage. A pure SPA with no server has no
// httpOnly-cookie session path; the strict production CSP
// (`script-src 'self'`, no unsafe-inline — see vercel.json) is the
// compensating XSS control. Revisit only if an SSR/auth-helper layer is ever
// introduced.
// ---------------------------------------------------------------------------

const IS_TAURI: boolean = typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__;

function buildClient(): SupabaseClient | null {
  if (IS_TAURI) return null;

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
 * The app-wide Supabase client singleton.
 *
 * `null` on Tauri desktop builds and on web builds without Supabase env
 * config — every call site must guard (`if (!supabase) return;`) so the
 * free floor never touches the backend (PRO-01).
 */
export const supabase: SupabaseClient | null = buildClient();
