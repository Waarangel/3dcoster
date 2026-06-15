import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastViewport } from './ToastViewport';
import { ToastContext } from './context';
import { DEFAULT_TOAST_DURATION, type Toast, type ToastApi, type ToastOptions, type ToastVariant } from './types';

/**
 * App-level toast provider. Owns the toast queue and the auto-dismiss timers,
 * and renders a single portal viewport that stacks every active toast — so
 * call sites never reimplement the fixed-position container, the dismiss
 * button, or the timer lifecycle.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (variant: ToastVariant, content: ReactNode, options?: ToastOptions): string => {
      const id = `toast-${++idCounter.current}`;
      const duration = options?.duration ?? DEFAULT_TOAST_DURATION;
      setToasts((prev) => [...prev, { id, variant, content, duration }]);

      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (content: ReactNode, options?: ToastOptions) => show('success', content, options),
    [show]
  );
  const error = useCallback(
    (content: ReactNode, options?: ToastOptions) => show('error', content, options),
    [show]
  );
  const info = useCallback(
    (content: ReactNode, options?: ToastOptions) => show('info', content, options),
    [show]
  );

  // Clear any outstanding timers if the provider unmounts.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ show, success, error, info, dismiss }),
    [show, success, error, info, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
