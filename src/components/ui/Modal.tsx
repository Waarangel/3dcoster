import { useEffect, useRef, useId, type ReactNode, type RefObject } from 'react';
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
  /**
   * WR-02 fix: opt-in target for initial focus. When provided AND the
   * referenced element is inside the dialog card at mount time, focus lands
   * there instead of the default first-focusable scan. Use this for form
   * modals where focusing the first input is the right UX.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * WR-04 fix: optional slot rendered to the LEFT of the title (outside the
   * `<h3>`) — symmetric with the Close button's slot on the right. Use this
   * for header-level controls (e.g., a "Back" button) that previously had to
   * be smuggled inside the `title` prop, polluting the dialog's accessible
   * name (aria-labelledby would include the button's text).
   */
  headerLeft?: ReactNode;
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

/**
 * Pick the element to receive initial focus when a Modal opens.
 *
 * Precedence (WR-02):
 *   1. First non-Close focusable descendant inside the card
 *   2. The Close button (only when it's the sole focusable)
 *   3. The card itself (relies on `tabIndex={-1}` on the card) when there
 *      are zero focusable descendants
 *
 * Exported (WR-03) so unit tests can exercise the zero-focusable fallback
 * directly — the in-component test cannot easily construct that case
 * because the Modal always renders its own Close button.
 */
export function findInitialFocusTarget(card: HTMLElement): HTMLElement {
  const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (focusable.length === 0) return card;
  const nonClose = focusable.find(el => el.getAttribute('aria-label') !== 'Close');
  return nonClose ?? focusable[0];
}

// CR-02 fix: a module-level boolean was monotonically reset to `false` by any
// Modal's cleanup. Two real overlapping Modals would leave the flag wrong
// (and StrictMode's setup → cleanup → setup would also corrupt it). A numeric
// counter tracks concurrent mounts correctly; cleanup decrements, mount
// increments, and a > 0 check at mount-time gives the dev warn.
/** Module-level guard — count of currently-mounted, open Modals. */
let openModalCount = 0;

/**
 * Modal
 *
 * Portal-rendered WAI-ARIA dialog with focus trap, body scroll-lock,
 * Escape-to-close, and backdrop-click-to-close.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */
export function Modal({ isOpen, onClose, title, children, size = 'md', initialFocusRef, headerLeft }: ModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  // Stable ref for onClose so the keydown handler doesn't re-register on each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // WR-02: read initialFocusRef through a stable indirection so changing
  // refs across renders doesn't re-fire the [isOpen] effect.
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;

  // Focus management, scroll-lock, keyboard trap — all keyed on isOpen.
  // When isOpen transitions false → true: mount effects fire.
  // When isOpen transitions true → false: cleanup fires.
  useEffect(() => {
    if (!isOpen) return;

    // Dev-mode single-modal-only guard (D-11)
    // WR-05 fix: prefer import.meta.env.DEV (Vite-native, replaced at build
    // time) over process.env.NODE_ENV (relies on Vite's shim, brittle long-term).
    if (openModalCount > 0 && import.meta.env.DEV) {
      console.warn(
        '[Modal] A second Modal mounted while one is already open. This project enforces single-modal-only.',
      );
    }
    openModalCount += 1;

    // Body scroll-lock (D-10): capture prior value; restore exact value on cleanup.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus management (D-05, D-06): capture who had focus before open.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable descendant, or fall back to the card itself.
    const focusFirst = () => {
      const card = cardRef.current;
      if (!card) return;

      // WR-02 fix (opt-in): if a consumer pointed initialFocusRef at an
      // element inside the dialog, focus that first.
      const explicit = initialFocusRefRef.current?.current;
      if (explicit && card.contains(explicit)) {
        explicit.focus();
        return;
      }

      // WR-02 / WR-03: delegate to the exported helper so the precedence rules
      // (skip-Close, then card fallback) are testable in isolation.
      findInitialFocusTarget(card).focus();
    };
    // Defer via setTimeout so the portal DOM is fully committed before we focus.
    // setTimeout(fn, 0) works in both browser and jsdom (unlike rAF in jsdom).
    const timerId = setTimeout(focusFirst, 0);

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
        if (focusable.length === 0) {
          // CR-01 fix: no focusable descendants — clamp focus to the card itself
          // (which has tabIndex={-1}) so Tab does not escape the dialog.
          e.preventDefault();
          card.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        // CR-01 fix: if activeElement is the dialog card, document.body, or any
        // non-focusable descendant, the previous boundary checks (=== first /
        // === last) silently fell through to the browser's native Tab order
        // and let focus escape the dialog. Treat "not in the focusable list"
        // as a boundary too, and clamp focus back inside.
        const activeIsInsideFocusableList =
          active instanceof HTMLElement && focusable.includes(active);

        if (e.shiftKey) {
          // Shift+Tab: wrap from first → last (or re-enter from outside the list → last)
          if (!activeIsInsideFocusableList || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: wrap from last → first (or re-enter from outside the list → first)
          if (!activeIsInsideFocusableList || active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore scroll-lock (D-10)
      document.body.style.overflow = previousOverflow;

      // Restore focus (D-06)
      // CR-03 fix:
      //  - Skip restoration when previouslyFocused was document.body (no
      //    meaningful prior focus, e.g. deep-link / auto-opened modal).
      //  - Skip restoration when the captured element is inside the
      //    about-to-unmount dialog. This guards the React 18 StrictMode dev
      //    double-invoke race: setup → cleanup → setup runs the first cleanup
      //    immediately, and by then setTimeout(focusFirst, 0) may have already
      //    advanced focus INTO the dialog. Restoring to a dialog-internal
      //    element on the imminent real close would land on a now-unmounted
      //    node.
      if (
        previouslyFocused &&
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused !== document.body &&
        document.body.contains(previouslyFocused) &&
        !cardRef.current?.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }

      // CR-02 fix: decrement (with floor) so concurrent / strict-mode mounts
      // settle to the right count instead of corrupting a boolean.
      openModalCount = Math.max(0, openModalCount - 1);
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
        {/* Header — WR-04: optional headerLeft slot renders OUTSIDE <h3> so
            interactive controls (e.g. Back button) don't pollute the dialog's
            accessible name via aria-labelledby. */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            {headerLeft}
            <h3 id={titleId} className="text-lg font-semibold text-white truncate">
              {title}
            </h3>
          </div>
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
