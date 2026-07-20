import type { SelectHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

type SelectSize = 'sm' | 'md' | 'lg';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  selectSize?: SelectSize;
  error?: boolean;
}

const sizeStyles: Record<SelectSize, string> = {
  sm: 'px-2 py-1.5 text-base md:text-sm min-h-[44px]',
  md: 'px-3 py-2 text-base md:text-sm min-h-[44px]',
  lg: 'px-4 py-3 text-base min-h-[44px]',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ selectSize = 'md', error = false, className = '', disabled, id, children, ...props }, ref) => {
    const generatedId = useId();
    const resolvedId = id ?? generatedId;
    const baseStyles = 'w-full bg-[var(--surface-2)] text-[var(--ink)] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]';
    const errorStyles = error ? 'ring-2 ring-red-500' : '';
    const disabledStyles = disabled ? 'bg-[var(--surface)] text-[var(--ink-faint)] cursor-not-allowed' : '';

    return (
      <select
        ref={ref}
        id={resolvedId}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[selectSize]} ${errorStyles} ${disabledStyles} ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
