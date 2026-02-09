import type { SelectHTMLAttributes } from 'react';
import { forwardRef } from 'react';

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
  ({ selectSize = 'md', error = false, className = '', disabled, children, ...props }, ref) => {
    const baseStyles = 'w-full bg-slate-700 text-white rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500';
    const errorStyles = error ? 'ring-2 ring-red-500' : '';
    const disabledStyles = disabled ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : '';

    return (
      <select
        ref={ref}
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
