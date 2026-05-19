import type { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string | ReactNode;
  cta?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, cta, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex justify-center mb-4 text-slate-500">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">{description}</p>
      {cta && (
        <div className="mt-6 flex justify-center">
          <Button variant="primary" btnSize="md" onClick={cta.onClick}>
            {cta.label}
          </Button>
        </div>
      )}
    </div>
  );
}

export function shouldShowEmptyState<T>(items: T[], isLoading: boolean): boolean {
  return !isLoading && items.length === 0;
}
