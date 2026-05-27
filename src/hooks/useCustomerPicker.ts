import { useState, useMemo, useCallback } from 'react';
import type { Customer } from '../types';

// ---------------------------------------------------------------------------
// useCustomerPicker — Phase 22 HYG-08 / HYG-02 (plan 22-01).
//
// Consolidates the picker state triplet + 60-LOC keyDown handler that was
// duplicated between JobsManager.tsx (Record Sale modal) and PrintQuoteModal.
// Hook is standalone — consumers (plan 22-03) pass their `customers` array and
// an `onPick(c)` callback. The hook owns query/open/activeIndex, derives
// filteredCustomers + visibleCustomers, and exposes a shared handleKeyDown +
// pick + reset surface.
//
// CRITICAL — Pitfall 1 (RESEARCH §): the hook MUST NOT carry consumer-specific
// state. PrintQuoteModal's `pickedExistingCustomerId` (used at createQuote
// time for library linking) is the consumer's concern — the consumer wires
// that inside its own `onPick` callback. The hook only resets the picker
// triplet after pick() fires.
//
// D-05 — PICKER_VISIBLE_LIMIT is exported from this module so the overflow
// footer ("Showing first N of M matches") and the slice limit cannot drift.
// ---------------------------------------------------------------------------

// Phase 15.1 (CL-04 / IN-04) — Maximum number of customer-picker dropdown rows
// shown before the "Showing first N of M matches" overflow footer appears.
// UI-SPEC §5 sets this to 8; centralized here so the slice limit and the
// overflow-footer threshold can never drift out of sync.
export const PICKER_VISIBLE_LIMIT = 8;

export function useCustomerPicker(
  customers: Customer[],
  { onPick }: { onPick: (c: Customer) => void }
): {
  query: string;
  open: boolean;
  activeIndex: number;
  visibleCustomers: Customer[];
  filteredCustomers: Customer[];
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  pick: (c: Customer) => void;
  reset: () => void;
} {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Phase 15.1 (CL-04) — filter customers by Name OR Email substring
  // (case-insensitive). Empty query keeps the dropdown closed (UI-SPEC §5).
  // Copied verbatim from JobsManager.tsx:1280-1287.
  const filteredCustomers = useMemo<Customer[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, query]);

  // Top PICKER_VISIBLE_LIMIT visible; the rest get an overflow footer per UI-SPEC §5.
  const visibleCustomers = useMemo<Customer[]>(
    () => filteredCustomers.slice(0, PICKER_VISIBLE_LIMIT),
    [filteredCustomers]
  );

  // D-04: pick(c) invokes the consumer's onPick callback, then resets the
  // picker triplet so the dropdown closes and the next search starts fresh.
  const pick = useCallback((c: Customer) => {
    onPick(c);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  }, [onPick]);

  // reset() clears the picker triplet WITHOUT calling onPick — used by
  // consumers when their modal opens/edits to clear stale picker state
  // without re-firing the consumer's pick side-effect.
  const reset = useCallback(() => {
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  }, []);

  // Phase 15.1 (CL-04) — WAI-ARIA combobox keyboard handler per UI-SPEC §5.
  // Ported verbatim from JobsManager.tsx:1317-1370 with state names shortened
  // (customerPickerOpen → open, etc.). All inline comments preserved.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // WR-04 fix: do not open an empty dropdown. If the user typed a query
      // that matches nothing, ArrowDown has nothing to navigate — leave the
      // dropdown state alone so the user isn't shown an active-index pointing
      // at a non-existent row.
      if (visibleCustomers.length === 0) return;
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
      } else {
        // wrap: last → first
        setActiveIndex(i => (i + 1) % visibleCustomers.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // wrap: first → last
      setActiveIndex(i =>
        visibleCustomers.length === 0 ? 0 : (i - 1 + visibleCustomers.length) % visibleCustomers.length
      );
    } else if (e.key === 'Enter') {
      // WR-01 fix: the Record Sale modal is not a <form>, so there is no
      // implicit submit handler. Treat Enter-with-no-match as "dismiss the
      // dropdown" so the user has a clear next step (fill the fields below).
      // Enter on the empty/unopened state is a no-op — do NOT attempt to
      // submit the surrounding modal.
      if (open) {
        const picked = visibleCustomers[activeIndex];
        if (picked) {
          e.preventDefault();
          pick(picked);
        } else if (query.trim()) {
          // No match — close suggestions so the user can fill the fields below.
          e.preventDefault();
          setOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        // CR-04 fix: prevent the surrounding Modal's document-level Escape
        // listener from also firing — without stopPropagation, Escape on the
        // picker would close the parent Record Sale modal and lose the user's
        // in-progress entry. Mirrors the PrintQuoteModal picker pattern
        // (PrintQuoteModal.tsx:162-167).
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === 'Tab') {
      // Per UI-SPEC §5: Tab closes the dropdown and advances focus naturally (do NOT auto-pick)
      setOpen(false);
    }
  }, [open, activeIndex, query, visibleCustomers, pick]);

  return {
    query,
    open,
    activeIndex,
    visibleCustomers,
    filteredCustomers,
    setQuery,
    setOpen,
    setActiveIndex,
    handleKeyDown,
    pick,
    reset,
  };
}
