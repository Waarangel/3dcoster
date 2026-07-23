import { useRef, useState } from 'react';
import { Modal, Button, Input, useToast } from '../ui';
import { useProAuth } from '../../hooks/useProAuth';

// ---------------------------------------------------------------------------
// SignInModal — contextual magic-link + OTP-code sign-in (Phase 43-03/46-02,
// PRO-01 / D-09 / D-08).
//
// Opens ONLY from an explicit user action (the profile panel's "Sign in for
// Pro" entry — D-09 contextual sign-in): signed-out users browsing the free
// floor never see auth chrome. Works on BOTH web and desktop (D-08 reverses
// Phase 43's web-only D-12 scoping): the SAME email dispatches a magic link
// (web click-through) AND a one-time code (desktop/either-platform entry) —
// this step is additive and never branches on __IS_TAURI__ (Pitfall 2/D-08).
// useProAuth is no-op-safe when the client is unavailable on either shell.
//
// Code length: Supabase's email-OTP length is a per-project dashboard
// setting, NOT a fixed constant — the production project (fqidldxuwpfvhsejalbd)
// currently issues 8-digit codes (live-verified 2026-07-22), not the 6-digit
// default assumed when this modal first shipped (46-02). The input below
// accepts 6-10 digits so it stays correct across dashboard config drift
// instead of hardcoding whatever the server happens to issue today.
//
// Note for dev/testing: magic-link/code emails go through Supabase's built-in
// email service until a custom SMTP sender is configured (plan 43-06 /
// Resend) — its rate limit is a few emails per hour.
// ---------------------------------------------------------------------------

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Light shape check only — Supabase performs real validation server-side.
// This just keeps the CTA disabled until the input plausibly is an email.
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

// Supabase's email-OTP code length is a per-project dashboard setting (not
// a fixed constant) — accept 6-10 digits so this stays correct regardless of
// how the project is configured (currently 8 digits in production, see the
// module comment above).
const CODE_SHAPE = /^\d{6,10}$/;

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const { signInWithEmail, verifyEmailCode, status } = useProAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const trimmed = email.trim();
  const looksLikeEmail = EMAIL_SHAPE.test(trimmed);
  const isSending = status === 'sending-link';
  // 'link-sent' means the email (link + code) has been dispatched — reveal
  // the code-entry step. The same email now serves both platforms' flows.
  const codeStepVisible = status === 'link-sent';
  const looksLikeCode = CODE_SHAPE.test(code.trim());

  const resetAndClose = () => {
    setEmail('');
    setCode('');
    onClose();
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!looksLikeEmail || isSending) return;
    const error = await signInWithEmail(trimmed);
    if (error) {
      toast.error(`Could not send the magic link: ${error}`);
      return;
    }
    toast.success('Check your email — click the link, or enter the one-time code below.');
  };

  const handleCodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!looksLikeCode || isVerifying) return;
    setIsVerifying(true);
    const error = await verifyEmailCode(trimmed, code.trim());
    setIsVerifying(false);
    if (error) {
      toast.error(`Could not verify the code: ${error}`);
      return;
    }
    toast.success('Signed in — Pro features unlocked.');
    resetAndClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sign in for Pro" initialFocusRef={emailRef}>
      <form onSubmit={handleEmailSubmit} className="p-4 space-y-4">
        <p className="text-sm text-slate-400">
          Enter your email and we&apos;ll send you a magic link and a
          one-time code — no password needed. Click the link (web) or type
          the code below (any platform). The free calculator never requires
          an account; signing in only unlocks Pro features.
        </p>
        <div>
          <label htmlFor="pro-signin-email" className="block text-xs text-slate-400 mb-1">
            Email address
          </label>
          <Input
            ref={emailRef}
            id="pro-signin-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address for Pro sign-in"
            autoComplete="email"
            inputMode="email"
            disabled={codeStepVisible}
          />
        </div>
        {!codeStepVisible && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} aria-label="Cancel sign-in">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!looksLikeEmail || isSending}
              aria-label="Send magic link"
            >
              {isSending ? 'Sending…' : 'Send magic link'}
            </Button>
          </div>
        )}
      </form>
      {codeStepVisible && (
        <form onSubmit={handleCodeSubmit} className="px-4 pb-4 space-y-4">
          <div>
            <label htmlFor="pro-signin-code" className="block text-xs text-slate-400 mb-1">
              One-time code
            </label>
            <Input
              ref={codeRef}
              id="pro-signin-code"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="123456"
              aria-label="One-time sign-in code"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={10}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={resetAndClose} aria-label="Cancel sign-in">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!looksLikeCode || isVerifying}
              aria-label="Verify code"
            >
              {isVerifying ? 'Verifying…' : 'Verify code'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
