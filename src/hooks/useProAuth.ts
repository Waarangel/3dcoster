import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

// ---------------------------------------------------------------------------
// useProAuth — magic-link auth hook for the Pro tier (Phase 43-03, PRO-01).
//
// Wraps supabase.auth.signInWithOtp / onAuthStateChange / signOut behind the
// same return-object + useCallback-action conventions as useDatabase.ts hooks.
//
// Safe to call unconditionally from any component: when `supabase` is null
// (Tauri desktop build, or web build without Supabase env config) every
// action is a no-op and the hook reports a permanently signed-out state —
// no effect subscribes, no network is touched (PRO-01 free-floor guarantee).
// ---------------------------------------------------------------------------

/** Auth lifecycle for UI surfaces (SignInModal button/toast states). */
export type ProAuthStatus =
  | 'unavailable'   // supabase client is null (Tauri / unconfigured web)
  | 'signed-out'
  | 'sending-link'  // signInWithEmail in flight
  | 'link-sent'     // magic link email + OTP code dispatched — waiting on the user
  | 'signed-in';

export interface ProAuth {
  session: Session | null;
  user: User | null;
  isSignedIn: boolean;
  status: ProAuthStatus;
  /**
   * Request a magic link for `email`. Resolves to an error message on
   * failure, or null on success (link dispatched). No-op (returns null)
   * when the client is unavailable.
   */
  signInWithEmail: (email: string) => Promise<string | null>;
  /**
   * Exchange the email OTP code (delivered in the SAME email as the magic
   * link, D-08 desktop OTP entry) for a session. The code length is a
   * per-project Supabase dashboard setting — 6-10 digits depending on
   * config, currently 8 digits in production (live-verified 2026-07-22) —
   * so this hook does not assume a fixed length; that's the caller's (UI)
   * concern. Resolves to an error message on failure, or null on success —
   * the session itself arrives via the existing onAuthStateChange
   * subscription, same as the web magic-link flow. No-op (returns null)
   * when the client is unavailable.
   */
  verifyEmailCode: (email: string, code: string) => Promise<string | null>;
  /** Sign out and clear the persisted session. No-op when unavailable. */
  signOut: () => Promise<void>;
  /**
   * User-driven exit from the 'link-sent' dead-end — return to the editable
   * email step. No-op while signed in; no-op-safe when the client is
   * unavailable. Before this action existed, `status` had no way back to
   * 'signed-out' short of a real auth event/error or a full app restart, so
   * an abandoned sign-in (typo'd email, closed modal) left the UI stuck on
   * a disabled email field forever (G-46-4).
   */
  resetSignIn: () => void;
}

export function useProAuth(): ProAuth {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<ProAuthStatus>(
    supabase ? 'signed-out' : 'unavailable'
  );

  useEffect(() => {
    if (!supabase) return; // Tauri / unconfigured web: never subscribe (D-12)

    let cancelled = false;

    // Seed from the persisted session (localStorage) so a reload restores
    // the signed-in state without waiting for the first auth event.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setSession(data.session);
        setStatus('signed-in');
      }
    }).catch((err: unknown) => {
      console.error('[useProAuth] getSession failed:', err);
    });

    // onAuthStateChange drives all subsequent state: SIGNED_IN (magic-link
    // redirect completes the PKCE code exchange), TOKEN_REFRESHED, SIGNED_OUT.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession);
        setStatus(nextSession ? 'signed-in' : 'signed-out');
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string): Promise<string | null> => {
    if (!supabase) return null; // no-op on Tauri / unconfigured web
    setStatus('sending-link');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Land back on the calculator app after the magic link is clicked;
          // supabase-js (detectSessionInUrl) completes the PKCE exchange there.
          emailRedirectTo: window.location.origin + '/app',
          // New emails must be able to create an account: this is now a
          // documented decision, not an accidental supabase-js default. The
          // 'Confirm signup' template carries {{ .Token }} (46-08 / G-46-2)
          // so the emailed code works for first-time (new-user) sign-ins too.
          shouldCreateUser: true,
        },
      });
      if (error) {
        setStatus('signed-out');
        return error.message;
      }
      setStatus('link-sent');
      return null;
    } catch (err) {
      console.error('[useProAuth] signInWithOtp failed:', err);
      setStatus('signed-out');
      return err instanceof Error ? err.message : 'Could not send the magic link.';
    }
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string): Promise<string | null> => {
    if (!supabase) return null; // no-op on Tauri / unconfigured web
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) return error.message;
      // Success: onAuthStateChange fires SIGNED_IN and flips status/session —
      // no extra state juggling needed here (mirrors signInWithEmail).
      return null;
    } catch (err) {
      console.error('[useProAuth] verifyOtp failed:', err);
      return err instanceof Error ? err.message : 'Could not verify the code.';
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) return; // no-op on Tauri / unconfigured web
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('[useProAuth] signOut failed:', error.message);
    } catch (err) {
      console.error('[useProAuth] signOut failed:', err);
    }
    // onAuthStateChange fires SIGNED_OUT and clears session/status; set
    // eagerly too so the UI never lags behind a slow network round-trip.
    setSession(null);
    setStatus(supabase ? 'signed-out' : 'unavailable');
  }, []);

  const resetSignIn = useCallback((): void => {
    // Gate on `session` (the same source isSignedIn derives from) rather
    // than `status`, so a signed-in user can never be knocked back to
    // signed-out by this action (T-46-4-01) and there's no stale-closure
    // risk reading `status` inside this callback.
    if (session !== null) return;
    setStatus(supabase ? 'signed-out' : 'unavailable');
  }, [session]);

  return {
    session,
    user: session?.user ?? null,
    isSignedIn: session !== null,
    status,
    signInWithEmail,
    verifyEmailCode,
    signOut,
    resetSignIn,
  };
}
