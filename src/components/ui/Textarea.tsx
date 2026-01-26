import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

type TextareaSize = 'sm' | 'md' | 'lg';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  textareaSize?: TextareaSize;
  error?: boolean;
}

const sizeStyles: Record<TextareaSize, string> = {
  sm: 'px-2 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ textareaSize = 'md', error = false, className = '', disabled, ...props }, ref) => {
    const baseStyles = 'w-full bg-slate-700 text-white rounded-lg border-0 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
    const errorStyles = error ? 'ring-2 ring-red-500' : '';
    const disabledStyles = disabled ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : '';

    return (
      <textarea
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[textareaSize]} ${errorStyles} ${disabledStyles} ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
