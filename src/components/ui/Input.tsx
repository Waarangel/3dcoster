import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: InputSize;
  error?: boolean;
  // Caps the input at 7rem (112px) — use for currency, percentages, and other
  // small numeric values so they don't stretch in wide containers.
  compact?: boolean;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'px-2 py-1.5 text-base md:text-sm min-h-[44px]',
  md: 'px-3 py-2 text-base md:text-sm min-h-[44px]',
  lg: 'px-4 py-3 text-base min-h-[44px]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', error = false, compact = false, className = '', disabled, id, ...props }, ref) => {
    const generatedId = useId();
    const resolvedId = id ?? generatedId;
    const baseStyles = 'w-full bg-slate-700 text-white rounded-lg border-0 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
    const compactStyles = compact ? 'max-w-28' : '';
    const errorStyles = error ? 'ring-2 ring-red-500' : '';
    const disabledStyles = disabled ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : '';

    return (
      <input
        ref={ref}
        id={resolvedId}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[inputSize]} ${compactStyles} ${errorStyles} ${disabledStyles} ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
