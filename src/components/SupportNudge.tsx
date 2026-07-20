import { useContext } from 'react';
import { ToastContext } from './ui/toast/context';
import {
  shouldShowSupportNudge,
  markSupportNudgeShown,
  markSupportNudgeClicked,
  openProUpgradeLink,
} from '../utils/supportNudge';

/** Let the success feedback (job save/quote create/sale record) land first, then the nudge follows. */
const SHOW_DELAY_MS = 1000;
/** Long enough to read and act on, then it clears itself. Non-interruptive. */
const NUDGE_DURATION_MS = 12000;

function SparkleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 3v4" />
      <path d="M17 5h4" />
    </svg>
  );
}

function SupportNudgeContent({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="leading-relaxed">
        Glad that helped — I&apos;m MJ, I build 3DCoster solo. When you&apos;re ready to send a
        customer a live quote they can approve online (not just a PDF), that&apos;s what 3DCoster
        Pro does.
      </p>
      {/* allow-raw-html: bespoke amber CTA matching the landing "Pro" band; the shared Button has no amber variant */}
      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex items-center gap-2 self-start rounded-lg bg-[var(--amber)] px-3.5 py-2 text-sm font-semibold text-[#3a2a06] transition duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98]"
      >
        <SparkleIcon />
        See 3DCoster Pro
      </button>
    </div>
  );
}

/**
 * Returns a function that shows the support nudge if the gate allows. Call it
 * at a value moment (job saved, sale recorded, quote created); it self-gates,
 * so it is always safe to call.
 *
 * Reads the toast context directly rather than via useToast() so that, when
 * there is no <ToastProvider> (e.g. a modal rendered in isolation in a unit
 * test), it degrades to a no-op instead of throwing. The nudge is non-critical,
 * so silent degradation is the correct failure mode.
 */
export function useSupportNudge(): () => void {
  const toast = useContext(ToastContext);

  return () => {
    if (!toast) return;
    if (!shouldShowSupportNudge()) return;
    markSupportNudgeShown();

    window.setTimeout(() => {
      let id = '';
      const handleUpgrade = () => {
        openProUpgradeLink();
        markSupportNudgeClicked();
        toast.dismiss(id);
      };
      id = toast.show('support', <SupportNudgeContent onUpgrade={handleUpgrade} />, {
        duration: NUDGE_DURATION_MS,
      });
    }, SHOW_DELAY_MS);
  };
}
