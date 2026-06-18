import type { TextareaHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

type TextareaSize = 'sm' | 'md' | 'lg';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  textareaSize?: TextareaSize;
  error?: boolean;
}

const sizeStyles: Record<TextareaSize, string> = {
  sm: 'px-2 py-1.5 text-base md:text-sm',
  md: 'px-3 py-2 text-base md:text-sm',
  lg: 'px-4 py-3 text-base',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ textareaSize = 'md', error = false, className = '', disabled, id, ...props }, ref) => {
    const generatedId = useId();
    const resolvedId = id ?? generatedId;
    const baseStyles = 'w-full bg-[var(--surface-2)] text-[var(--ink)] rounded-lg border-0 placeholder-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none';
    const errorStyles = error ? 'ring-2 ring-red-500' : '';
    const disabledStyles = disabled ? 'bg-[var(--surface)] text-[var(--ink-faint)] cursor-not-allowed' : '';

    return (
      <textarea
        ref={ref}
        id={resolvedId}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[textareaSize]} ${errorStyles} ${disabledStyles} ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
