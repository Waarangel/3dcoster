import type { ChangeEvent, FocusEvent, InputHTMLAttributes } from 'react';
import { forwardRef, useId, useState } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: InputSize;
  error?: boolean;
  // Caps the input at 7rem (112px) — use for currency, percentages, and other
  // small numeric values so they don't stretch in wide containers.
  compact?: boolean;
  // Display-only fixed precision for numeric inputs (money uses 2). While the
  // field has focus it shows exactly what the user typed; once it loses focus
  // the value renders as e.g. "3.50". Stored values are never touched.
  decimals?: number;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'px-2 py-1.5 text-base md:text-sm min-h-[44px]',
  md: 'px-3 py-2 text-base md:text-sm min-h-[44px]',
  lg: 'px-4 py-3 text-base min-h-[44px]',
};

type InputValue = InputHTMLAttributes<HTMLInputElement>['value'];

function toNumber(value: InputValue | string): number | null {
  if (value === undefined || value === null || Array.isArray(value)) return null;
  const text = String(value).trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Formats a numeric value at fixed precision; empty / non-numeric values pass through unchanged. */
function formatFixedDecimals(value: InputValue, decimals: number): InputValue {
  const n = toNumber(value);
  return n === null ? value : n.toFixed(decimals);
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', error = false, compact = false, decimals, className = '', disabled, id, value, onChange, onFocus, onBlur, ...props }, ref) => {
    const generatedId = useId();
    const resolvedId = id ?? generatedId;
    // Text the user is typing while a `decimals` field is focused (null = not editing).
    const [draft, setDraft] = useState<string | null>(null);
    const baseStyles = 'w-full bg-[var(--surface-2)] text-[var(--ink)] rounded-lg border-0 placeholder-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]';
    const compactStyles = compact ? 'max-w-28' : '';
    const errorStyles = error ? 'ring-2 ring-red-500' : '';
    const disabledStyles = disabled ? 'bg-[var(--surface)] text-[var(--ink-faint)] cursor-not-allowed' : '';

    let displayValue = value;
    if (decimals !== undefined && value !== undefined) {
      // Keep the typed text while it still means the same number as the parent's
      // value ("0", "", "1.50" all survive mid-entry); if the parent changed it
      // (clamped, reset), show the parent's value instead. Compared at display
      // precision so focusing a stored 7.8100000000000005 / 3.456 keeps "7.81" /
      // "3.46" rather than jumping to the raw float.
      const draftMatchesValue = draft !== null
        && (toNumber(draft) ?? 0).toFixed(decimals) === (toNumber(value) ?? 0).toFixed(decimals);
      displayValue = draftMatchesValue ? draft : draft !== null ? value : formatFixedDecimals(value, decimals);
    }

    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
      if (decimals !== undefined) setDraft(e.target.value);
      onFocus?.(e);
    };
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (decimals !== undefined) setDraft(e.target.value);
      onChange?.(e);
    };
    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      if (decimals !== undefined) setDraft(null);
      onBlur?.(e);
    };

    return (
      <input
        ref={ref}
        id={resolvedId}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[inputSize]} ${compactStyles} ${errorStyles} ${disabledStyles} ${className}`}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
