import { useRef, useState } from 'react';
import { Modal, Button, Input, useToast } from '../ui';
import { useProAuth } from '../../hooks/useProAuth';

// ---------------------------------------------------------------------------
// SignInModal — contextual magic-link sign-in (Phase 43-03, PRO-01 / D-09).
//
// Opens ONLY from an explicit user action (the profile panel's "Sign in for
// Pro" entry — D-09 contextual sign-in): signed-out users browsing the free
// floor never see auth chrome. Web-only: App.tsx gates the mount on
// `!__IS_TAURI__` (D-12), and useProAuth is additionally no-op-safe if that
// gate is ever bypassed.
//
// Note for dev/testing: magic-link emails go through Supabase's built-in
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

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const { signInWithEmail, status } = useProAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const trimmed = email.trim();
  const looksLikeEmail = EMAIL_SHAPE.test(trimmed);
  const isSending = status === 'sending-link';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!looksLikeEmail || isSending) return;
    const error = await signInWithEmail(trimmed);
    if (error) {
      toast.error(`Could not send the magic link: ${error}`);
      return;
    }
    toast.success('Magic link sent — check your email to finish signing in.');
    setEmail('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sign in for Pro" initialFocusRef={emailRef}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <p className="text-sm text-slate-400">
          Enter your email and we&apos;ll send you a magic link — no password
          needed. The free calculator never requires an account; signing in
          only unlocks Pro features.
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
          />
        </div>
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
      </form>
    </Modal>
  );
}
