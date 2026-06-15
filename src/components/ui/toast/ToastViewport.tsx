import { createPortal } from 'react-dom';
import { Button } from '../Button';
import type { Toast, ToastVariant } from './types';

interface ToastViewportProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const VARIANT_BORDER: Record<ToastVariant, string> = {
  success: 'border-green-500/40',
  error: 'border-red-500/40',
  info: 'border-blue-500/40',
};

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  info: 'text-blue-400',
};

// Heroicons-style single-path glyphs, matching the icons the old inline toasts used.
const VARIANT_ICON_PATH: Record<ToastVariant, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  // Errors interrupt assertively; success/info announce politely.
  const isError = toast.variant === 'error';

  return (
    <div
      data-toast
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`pointer-events-auto bg-slate-800 border ${VARIANT_BORDER[toast.variant]} rounded-lg p-3 shadow-lg shadow-black/30 flex items-start justify-between gap-3 max-w-sm animate-in`}
    >
      <div className="flex items-start gap-3 text-sm text-slate-200">
        <svg
          aria-hidden="true"
          className={`w-5 h-5 shrink-0 ${VARIANT_ICON_COLOR[toast.variant]}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={VARIANT_ICON_PATH[toast.variant]} />
        </svg>
        <div className="min-w-0">{toast.content}</div>
      </div>
      <Button
        variant="ghost"
        btnSize="sm"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="ml-2 shrink-0 text-slate-500 hover:text-slate-300"
      >
        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}

/**
 * Single fixed, top-right viewport that stacks all active toasts. The
 * container is click-through (pointer-events-none); each toast re-enables
 * pointer events so its dismiss button stays clickable.
 */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  // No document → non-browser/SSR context, skip the portal. No toasts → don't
  // mount an empty fixed container.
  if (typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}
