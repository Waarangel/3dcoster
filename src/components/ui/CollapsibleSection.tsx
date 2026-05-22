import { useState, useId, type ReactNode } from 'react';

export interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;        // default false (D-03 locks collapsed-by-default)
  badge?: ReactNode;            // slot for <NewBadge ... className="absolute -top-1 -right-1" />
  right?: ReactNode;            // optional right-of-chevron slot (future PDF preview button, etc.)
  subtitle?: ReactNode;
  children?: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  right,
  subtitle,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      {/* `relative` host: badge slot sits OUTSIDE the <button> flex flow per MEMORY.md */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="w-full flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded min-h-[44px]"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{title}</span>
            {subtitle && <span className="text-sm text-slate-400">{subtitle}</span>}
          </div>
          <div className="flex items-center gap-3">
            {right}
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {badge}
      </div>
      {open && (
        <div id={bodyId} className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}
