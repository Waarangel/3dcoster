import { useContext } from 'react';
import { ToastContext } from './ui/toast/context';
import {
  shouldShowSupportNudge,
  markSupportNudgeShown,
  markSupportNudgeClicked,
  openSupportLink,
} from '../utils/supportNudge';

/** Let the success feedback (sale/quote) land first, then the nudge follows. */
const SHOW_DELAY_MS = 1000;
/** Long enough to read and act on, then it clears itself. Non-interruptive. */
const NUDGE_DURATION_MS = 12000;

function CoffeeIcon() {
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
      <path d="M18 8h1a4 4 0 010 8h-1" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

function SupportNudgeContent({ onSupport }: { onSupport: () => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="leading-relaxed">
        Glad that helped — I&apos;m MJ, I build 3DCoster solo. If it&apos;s saving you from
        underpricing, a coffee keeps it free &amp; ad-free.
      </p>
      {/* allow-raw-html: bespoke amber CTA matching the landing "Buy me a coffee" button; the shared Button has no amber variant */}
      <button
        type="button"
        onClick={onSupport}
        className="inline-flex items-center gap-2 self-start rounded-lg bg-[var(--amber)] px-3.5 py-2 text-sm font-semibold text-[#3a2a06] transition duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98]"
      >
        <CoffeeIcon />
        Buy me a coffee
      </button>
    </div>
  );
}

/**
 * Returns a function that shows the support nudge if the gate allows. Call it
 * at a value moment (sale recorded, quote created); it self-gates, so it is
 * always safe to call.
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
      const handleSupport = () => {
        openSupportLink();
        markSupportNudgeClicked();
        toast.dismiss(id);
      };
      id = toast.show('support', <SupportNudgeContent onSupport={handleSupport} />, {
        duration: NUDGE_DURATION_MS,
      });
    }, SHOW_DELAY_MS);
  };
}
