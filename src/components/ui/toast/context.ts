import { createContext } from 'react';
import type { ToastApi } from './types';

// Lives in its own module (not ToastProvider.tsx) so the provider file exports
// only a component — keeps Vite fast-refresh happy (react-refresh/only-export-components).
export const ToastContext = createContext<ToastApi | null>(null);
