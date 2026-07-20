import type { ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'support';

export interface ToastOptions {
  /** Auto-dismiss delay in ms. 0 disables auto-dismiss. */
  duration?: number;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  content: ReactNode;
  duration: number;
}

export interface ToastApi {
  /** Show a toast of any variant. Returns the toast id (for manual dismiss). */
  show: (variant: ToastVariant, content: ReactNode, options?: ToastOptions) => string;
  success: (content: ReactNode, options?: ToastOptions) => string;
  error: (content: ReactNode, options?: ToastOptions) => string;
  info: (content: ReactNode, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

/** Default auto-dismiss when a call site does not specify one. */
export const DEFAULT_TOAST_DURATION = 5000;
