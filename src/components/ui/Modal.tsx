import { useRef, useId, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useDialogA11y, findInitialFocusTarget } from './dialogA11y';

// ---------------------------------------------------------------------------
// Modal — WAI-ARIA Dialog (Modal) primitive, centered layout.
//
// Reference: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
//
// Size → max-width mapping:
//   sm  → max-w-sm   (small confirmations)
//   md  → max-w-md   (default — UserProfile, CustomerEdit, Decline, Maintenance)
//   lg  → max-w-lg   (Settings, PrintQuote)
//   xl  → max-w-3xl  (CsvImport, CustomerCsvImport — wide preview tables)
//
// Shared a11y lifecycle lives in `useDialogA11y` so SidePanel (right-anchored
// dialog) and Modal stay behaviorally identical.
// ---------------------------------------------------------------------------

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** ReactNode so callers can pass dynamic strings e.g. `Edit Sale — ${job.name}` */
  title: ReactNode;
  children: ReactNode;
  /** Size tier controlling max-width. Default: 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Opt-in target for initial focus (WR-02). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Optional slot rendered to the LEFT of the title (outside the `<h3>`) — for header-level controls (e.g. Back button). */
  headerLeft?: ReactNode;
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-3xl',
};

// Re-export so existing Modal.test.tsx imports continue to work.
export { findInitialFocusTarget };

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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useDialogA11y({ isOpen, onClose, cardRef, initialFocusRef });

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCloseRef.current();
  };

  // HYG-09 absorption: children only render when isOpen is true. Their useEffect
  // cleanups run on unmount — consumers no longer need close-reset useEffects.
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
        {/* Header — headerLeft renders OUTSIDE <h3> so interactive controls (Back button) don't pollute the dialog's accessible name via aria-labelledby. */}
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
