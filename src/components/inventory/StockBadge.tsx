import { memo } from 'react';

interface StockBadgeProps {
  /** Current derived stock in the asset's native unit. `null`/`undefined` = not tracked → renders nothing. */
  stock: number | null | undefined;
  /** Low-stock threshold (asset's unit). `undefined` = no threshold set. */
  threshold?: number;
  /** Display unit, e.g. `g` for filament or the asset's own unit. */
  unit?: string;
}

/** Round to at most 1 decimal, dropping a trailing `.0`. Stock can be fractional. */
function formatStock(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/**
 * Shows how much stock is on hand and flags low / out-of-stock. Renders nothing
 * when `stock` is null/undefined so assets the user hasn't started tracking stay
 * visually clean. Never colour-alone: an out/low state also shows a ⚠ + words.
 */
export const StockBadge = memo(function StockBadge({ stock, threshold, unit }: StockBadgeProps) {
  if (stock == null) return null;

  const isOut = stock <= 0;
  const isLow = !isOut && threshold != null && stock <= threshold;

  const tone = isOut
    ? 'bg-red-500/15 text-red-300 border-red-500/30'
    : isLow
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-slate-700/50 text-slate-300 border-slate-600/50';

  const label = isOut ? 'Out of stock' : `${formatStock(stock)}${unit ? ` ${unit}` : ''} left`;
  // Surface the low/out state + threshold to assistive tech (title isn't reachable
  // by keyboard/AT). Plain in-stock badges fall back to their visible text.
  const ariaLabel = isOut
    ? 'Out of stock'
    : isLow
      ? `Low stock — ${label}, threshold ${formatStock(threshold!)}${unit ? ` ${unit}` : ''}`
      : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${tone}`}
      aria-label={ariaLabel}
    >
      {(isOut || isLow) && <span aria-hidden="true">⚠</span>}
      {label}
    </span>
  );
});
