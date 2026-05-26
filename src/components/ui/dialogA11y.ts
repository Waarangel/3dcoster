import { useEffect, useRef, type RefObject } from 'react';

// ---------------------------------------------------------------------------
// Shared WAI-ARIA dialog a11y lifecycle.
//
// Used by Modal (centered) and SidePanel (right-anchored) — both implement the
// dialog pattern, only the visual chrome differs. Extract here so the
// focus-trap, scroll-lock, keyboard handling, dev guard, and focus-restoration
// rules stay in one place.
//
// Reference: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
// ---------------------------------------------------------------------------

/** Selector for elements that can receive keyboard focus. */
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Pick the element to receive initial focus when a dialog opens.
 *
 * Precedence (WR-02):
 *   1. First non-Close focusable descendant inside the card
 *   2. The Close button (only when it's the sole focusable)
 *   3. The card itself (relies on `tabIndex={-1}` on the card) when there
 *      are zero focusable descendants
 *
 * Exported so unit tests can exercise the zero-focusable fallback directly —
 * the in-component test cannot easily construct that case because dialogs
 * always render their own Close button.
 */
export function findInitialFocusTarget(card: HTMLElement): HTMLElement {
  const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (focusable.length === 0) return card;
  const nonClose = focusable.find(el => el.getAttribute('aria-label') !== 'Close');
  return nonClose ?? focusable[0];
}

/**
 * Module-level guard — count of currently-mounted, open dialog primitives.
 *
 * A boolean was monotonically reset to `false` by any dialog's cleanup,
 * corrupting the flag under StrictMode setup → cleanup → setup and under
 * legitimate overlapping dialogs. A numeric counter tracks concurrent mounts
 * correctly; cleanup decrements with floor, mount increments.
 */
let openDialogCount = 0;

export interface UseDialogA11yArgs {
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the focusable card element that hosts the dialog content. */
  cardRef: RefObject<HTMLDivElement | null>;
  /** Opt-in target for initial focus (WR-02). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Mount-time a11y wiring for dialog-pattern primitives.
 *
 * Provides:
 *   - Body scroll-lock while open (restored exactly on cleanup)
 *   - Initial focus into the card (consumer-supplied or auto-detected)
 *   - Tab / Shift+Tab focus trap that re-queries focusables every keystroke
 *   - Escape-to-close
 *   - Focus restoration to whoever had focus before open
 *   - Dev-mode single-dialog-only warning when a second one mounts
 */
export function useDialogA11y({ isOpen, onClose, cardRef, initialFocusRef }: UseDialogA11yArgs): void {
  // Stable refs so the keydown handler doesn't re-register on each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!isOpen) return;

    // Dev-mode single-dialog-only guard.
    if (openDialogCount > 0 && import.meta.env.DEV) {
      console.warn(
        '[dialog] A second dialog mounted while one is already open. This project enforces single-dialog-only.',
      );
    }
    openDialogCount += 1;

    // Body scroll-lock — capture prior value; restore exact value on cleanup.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Capture who had focus before open.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable descendant, or fall back to the card itself.
    const focusFirst = () => {
      const card = cardRef.current;
      if (!card) return;

      // Opt-in: if consumer pointed initialFocusRef at an element inside the
      // dialog, focus that first.
      const explicit = initialFocusRefRef.current?.current;
      if (explicit && card.contains(explicit)) {
        explicit.focus();
        return;
      }

      findInitialFocusTarget(card).focus();
    };
    // Defer via setTimeout so the portal DOM is fully committed before we focus.
    // setTimeout(fn, 0) works in both browser and jsdom (unlike rAF in jsdom).
    const timerId = setTimeout(focusFirst, 0);

    // Keyboard handler.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const card = cardRef.current;
        if (!card) return;
        // Re-query on every Tab to handle dynamic children.
        const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
          // No focusable descendants — clamp focus to the card itself (which
          // has tabIndex={-1}) so Tab does not escape the dialog.
          e.preventDefault();
          card.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        // If activeElement is the dialog card, document.body, or any
        // non-focusable descendant, the previous boundary checks (=== first /
        // === last) silently fell through to the browser's native Tab order
        // and let focus escape the dialog. Treat "not in the focusable list"
        // as a boundary too, and clamp focus back inside.
        const activeIsInsideFocusableList =
          active instanceof HTMLElement && focusable.includes(active);

        if (e.shiftKey) {
          if (!activeIsInsideFocusableList || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
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

      document.body.style.overflow = previousOverflow;

      // Restore focus.
      //  - Skip restoration when previouslyFocused was document.body (no
      //    meaningful prior focus, e.g. deep-link / auto-opened dialog).
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

      openDialogCount = Math.max(0, openDialogCount - 1);
    };
  }, [isOpen, cardRef]);
}
