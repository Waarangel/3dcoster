import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useDialogA11y } from './dialogA11y';

// ---------------------------------------------------------------------------
// SidePanel — right-anchored dialog primitive.
//
// Same WAI-ARIA dialog semantics as Modal (role="dialog", aria-modal, focus
// trap, Escape close, backdrop close, scroll lock, focus restore) but laid
// out as a full-height panel sliding in from the right edge of the viewport.
// Use for surfaces where tab-switching causes height changes (Settings) or
// where the user benefits from a fixed-position editing surface (Profile).
//
// Width tiers (full-height always):
//   sm  → max-w-sm   (~384px)
//   md  → max-w-md   (~448px)
//   lg  → max-w-lg   (~512px)
//   xl  → max-w-xl   (~576px)
//
// Mobile: full width below sm breakpoint (the max-w-* values cap at md+).
// ---------------------------------------------------------------------------

export interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Optional slot rendered to the LEFT of the title (outside the `<h2>`). */
  headerLeft?: ReactNode;
}

const sizeMap: Record<NonNullable<SidePanelProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
};

/**
 * SidePanel
 *
 * Portal-rendered, right-anchored WAI-ARIA dialog. Slides in from the right
 * edge with a transform transition on open. Closes immediately (no exit
 * animation) to keep lifecycle simple and match Modal.
 */
export function SidePanel({ isOpen, onClose, title, children, size = 'md', initialFocusRef, headerLeft }: SidePanelProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Enter-animation gate: render mounted-but-off-screen for one frame, then
  // flip to visible so the CSS transform transition runs.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
  }, [isOpen]);

  useDialogA11y({ isOpen, onClose, cardRef, initialFocusRef });

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCloseRef.current();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 bg-black/50 z-50 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`fixed top-0 right-0 h-full w-full ${sizeMap[size]} bg-slate-800 border-l border-slate-700 shadow-2xl flex flex-col transform transition-transform duration-200 ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            {headerLeft}
            <h2 id={titleId} className="text-lg font-semibold text-white truncate">
              {title}
            </h2>
          </div>
          <Button variant="ghost" btnSize="sm" onClick={() => onCloseRef.current()} aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Body — fills remaining height, scrolls internally. Consumers control padding. */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
