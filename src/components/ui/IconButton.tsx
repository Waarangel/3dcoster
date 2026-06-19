import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { Button } from './Button';
import { PencilIcon, TrashIcon, CloseIcon } from './icons';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required accessible label, e.g. the item name. Becomes the button's aria-label. */
  label: string;
  /** The icon to render (defaults to 24x24 currentColor stroke SVGs from icons/). */
  icon: ReactNode;
  variant?: ButtonVariant;
  btnSize?: ButtonSize;
}

/**
 * Icon-only action button. Wraps the shared `Button` primitive (never a raw
 * `<button>`, which the `lint-no-raw-html` build check forbids) and always sets
 * an `aria-label` so the icon-only control is screen-reader labelled.
 *
 * Prefer the `EditButton` / `DeleteButton` / `RemoveButton` wrappers for the
 * common row/item actions; use `IconButton` directly for one-off icon actions.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, variant = 'ghost', btnSize = 'sm', className = '', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        btnSize={btnSize}
        aria-label={label}
        className={`!px-2 ${className}`.trim()}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

interface RowActionProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Descriptive label for the target item, e.g. the item name. */
  label: string;
  className?: string;
}

const ICON_CLASS = 'w-4 h-4';

/**
 * Pencil icon button for editing a row/item. aria-label is `Edit {label}`.
 * Tinted with the app's blue accent to match prior edit-action styling.
 */
export const EditButton = forwardRef<HTMLButtonElement, RowActionProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <IconButton
        ref={ref}
        label={`Edit ${label}`}
        icon={<PencilIcon className={ICON_CLASS} />}
        variant="ghost"
        className={`text-blue-400 hover:text-blue-300 ${className}`.trim()}
        {...props}
      />
    );
  }
);

EditButton.displayName = 'EditButton';

/**
 * Trash icon button for deleting a row/item. aria-label is `Delete {label}`.
 * Tinted red to match prior delete-action styling.
 */
export const DeleteButton = forwardRef<HTMLButtonElement, RowActionProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <IconButton
        ref={ref}
        label={`Delete ${label}`}
        icon={<TrashIcon className={ICON_CLASS} />}
        variant="ghost"
        className={`text-red-400 hover:text-red-300 ${className}`.trim()}
        {...props}
      />
    );
  }
);

DeleteButton.displayName = 'DeleteButton';

/**
 * Small "✕" icon button for removing a sub-item inline (e.g. a tag chip or a
 * repeated input row). aria-label is `Remove {label}`. Tinted red.
 */
export const RemoveButton = forwardRef<HTMLButtonElement, RowActionProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <IconButton
        ref={ref}
        label={`Remove ${label}`}
        icon={<CloseIcon className={ICON_CLASS} />}
        variant="ghost"
        className={`text-red-400 hover:text-red-300 ${className}`.trim()}
        {...props}
      />
    );
  }
);

RemoveButton.displayName = 'RemoveButton';
