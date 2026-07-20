import { Modal, Button } from '../ui';

// ---------------------------------------------------------------------------
// ProPitchModal — the pitch surface for Share quote (Phase 43-04, D-10).
//
// Opens only from ShareQuoteButton's signed-out/non-Pro branch. Explains
// what a hosted quote link does in one short paragraph and hands off to the
// existing contextual sign-in flow (D-09) — this modal does not itself
// collect an email; it defers to SignInModal via `onSignIn`.
//
// As of Phase 45 (D-03), SupportNudge (src/components/SupportNudge.tsx) is a
// SECOND surface that pitches Pro — a calm gold toast on job-save/quote-
// create/sale-record success, gated by a 90-day cooldown and shown at most
// once per session. The two are contextually distinct and need no shared
// cooldown: this modal only opens from an explicit, in-context click (Share
// quote), never ambiently, while SupportNudge only fires ambiently on
// save-success. They realistically never stack in the same session — see
// 45-RESEARCH.md Open Question 3 for the reasoning.
// ---------------------------------------------------------------------------

interface ProPitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the existing sign-in flow (D-09 contextual sign-in). */
  onSignIn: () => void;
}

export function ProPitchModal({ isOpen, onClose, onSignIn }: ProPitchModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share a live quote link" size="sm">
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">Share quote</span> is a Pro
          feature. Instead of only a PDF, your customer gets a live link
          branded with your business — they can Approve or Decline right
          there, and you see the result in the app the moment they respond.
        </p>
        <p className="text-sm text-slate-400">
          Sign in to get started — there&apos;s no separate account signup,
          just a magic link to your email.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => { onClose(); onSignIn(); }}
            aria-label="Sign in for Pro"
          >
            Sign in for Pro
          </Button>
        </div>
      </div>
    </Modal>
  );
}
