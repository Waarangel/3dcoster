import { useContext } from 'react';
import { ToastContext } from './context';
import type { ToastApi } from './types';

/** Access the toast API. Must be called under a <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
