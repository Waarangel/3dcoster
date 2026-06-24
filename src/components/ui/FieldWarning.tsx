interface FieldWarningProps {
  /** Warning text, or null to render nothing. */
  message: string | null;
}

/**
 * Inline, non-blocking amber warning shown beneath a settings input when the
 * entered value is almost certainly a unit-entry mistake (e.g. cents typed
 * into a dollars field). `role="alert"` so it is announced when it appears.
 */
export function FieldWarning({ message }: FieldWarningProps) {
  if (!message) return null;

  return (
    <p role="alert" className="mt-1 flex items-start gap-1.5 text-xs text-amber-400">
      <svg
        aria-hidden="true"
        className="w-3.5 h-3.5 shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <span>{message}</span>
    </p>
  );
}
