import { useEffect, useRef, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

// ---------------------------------------------------------------------------
// Modal — WAI-ARIA Dialog (Modal) primitive
//
// Reference: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
//
// Size → max-width mapping:
//   sm  → max-w-sm   (small confirmations)
//   md  → max-w-md   (default — UserProfile, CustomerEdit, Decline, Maintenance)
//   lg  → max-w-lg   (Settings, PrintQuote)
//   xl  → max-w-3xl  (CsvImport, CustomerCsvImport — wide preview tables)
//
// Focus management:
//   - On open: focuses the first focusable descendant inside the dialog card,
//     or the card itself (via tabIndex={-1}) if no focusable child exists.
//   - On close: restores focus to the element that had focus before the modal
//     opened, provided it is still in the DOM. If the previously-focused element
//     has been unmounted, focus falls to document.body.
//   - Tab / Shift+Tab cycle within focusable descendants only; focus list is
//     re-queried on each keystroke to handle dynamically-rendered children
//     (e.g., customer picker dropdown in PrintQuoteModal).
//
// Single-modal-only constraint:
//   This project enforces one modal open at a time. In dev/test mode a
//   console.warn fires if a second Modal mounts while one is already open.
//   Production builds are silent.
// ---------------------------------------------------------------------------

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** ReactNode so callers can pass dynamic strings e.g. `Edit Sale — ${job.name}` */
  title: ReactNode;
  children: ReactNode;
  /** Size tier controlling max-width. Default: 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-3xl',
};

/** Selector for elements that can receive keyboard focus. */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Module-level guard — true while any Modal is mounted and open. */
let isAnyModalOpen = false;

/**
 * Modal
 *
 * Portal-rendered WAI-ARIA dialog with focus trap, body scroll-lock,
 * Escape-to-close, and backdrop-click-to-close.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */
export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  // Stable ref for onClose so the keydown handler doesn't re-register on each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus management, scroll-lock, keyboard trap — all keyed on isOpen.
  // When isOpen transitions false → true: mount effects fire.
  // When isOpen transitions true → false: cleanup fires.
  useEffect(() => {
    if (!isOpen) return;

    // Dev-mode single-modal-only guard (D-11)
    if (isAnyModalOpen && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Modal] A second Modal mounted while one is already open. This project enforces single-modal-only.',
      );
    }
    isAnyModalOpen = true;

    // Body scroll-lock (D-10): capture prior value; restore exact value on cleanup.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus management (D-05, D-06): capture who had focus before open.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable descendant, or fall back to the card itself.
    const focusFirst = () => {
      const card = cardRef.current;
      if (!card) return;
      const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        card.focus();
      }
    };
    // Defer slightly so the DOM has settled after the portal renders.
    const rafId = requestAnimationFrame(focusFirst);

    // Keyboard handler (D-04, D-07, D-08)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const card = cardRef.current;
        if (!card) return;
        // Re-query on every Tab to handle dynamic children (D-07).
        const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: wrap from first → last
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: wrap from last → first
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore scroll-lock (D-10)
      document.body.style.overflow = previousOverflow;

      // Restore focus (D-06)
      if (
        previouslyFocused &&
        previouslyFocused instanceof HTMLElement &&
        document.body.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }

      isAnyModalOpen = false;
    };
  }, [isOpen]);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCloseRef.current();
  };

  // HYG-09 absorption: children are only rendered when isOpen is true.
  // When isOpen transitions to false, children unmount and their useEffect
  // cleanups run — consumers no longer need close-reset useEffects.
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-slate-800 rounded-xl border border-slate-700 w-full ${sizeMap[size]} shadow-xl max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
          <h3 id={titleId} className="text-lg font-semibold text-white">
            {title}
          </h3>
          <Button variant="ghost" btnSize="sm" onClick={() => onCloseRef.current()} aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Body — consumers control layout/padding */}
        {children}
      </div>
    </div>,
    document.body,
  );
}
