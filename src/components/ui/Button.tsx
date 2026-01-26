import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  btnSize?: ButtonSize;
  fullWidth?: boolean;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, BaseButtonProps {}

export const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30',
  ghost: 'bg-transparent hover:bg-slate-700 text-slate-300',
};

export const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const baseButtonStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900';
export const disabledButtonStyles = 'disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-600';

export function getButtonClasses(
  variant: ButtonVariant = 'primary',
  btnSize: ButtonSize = 'md',
  fullWidth = false,
  className = ''
): string {
  const widthStyles = fullWidth ? 'w-full' : '';
  return `${baseButtonStyles} ${variantStyles[variant]} ${sizeStyles[btnSize]} ${disabledButtonStyles} ${widthStyles} ${className}`.trim();
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', btnSize = 'md', fullWidth = false, className = '', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={getButtonClasses(variant, btnSize, fullWidth, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// For use with Link components - export the class generator
interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, BaseButtonProps {}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = 'primary', btnSize = 'md', fullWidth = false, className = '', children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={getButtonClasses(variant, btnSize, fullWidth, className)}
        {...props}
      >
        {children}
      </a>
    );
  }
);

ButtonLink.displayName = 'ButtonLink';
