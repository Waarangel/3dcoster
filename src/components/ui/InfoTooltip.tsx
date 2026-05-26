import { useState, useId } from 'react';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

// Small info-circle icon that reveals a tooltip on hover/focus/tap.
// Use it next to a field label when the field needs explanation but
// you don't want to burn placeholder space on descriptive text.
export function InfoTooltip({ text, className = '' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* allow-raw-html: button is a small icon trigger, not a form action; Button primitive's min-h-[44px] would dwarf the label */}
      <button
        type="button"
        aria-label={text}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        className="text-slate-400 hover:text-slate-200 focus:text-slate-200 focus:outline-none transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 max-w-xs w-max z-50 pointer-events-none shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
