interface LowStockBarProps {
  /** Assets currently at/below their threshold or out of stock. */
  lowAssets: { id: string; name: string }[];
}

const MAX_NAMES = 4;

/**
 * A header strip summarising materials that need restocking. Renders nothing
 * when nothing is low, so it only appears when it has something to say.
 */
export function LowStockBar({ lowAssets }: LowStockBarProps) {
  if (lowAssets.length === 0) return null;

  const shown = lowAssets.slice(0, MAX_NAMES).map(a => a.name).join(', ');
  const moreCount = lowAssets.length - MAX_NAMES;
  const more = moreCount > 0 ? ` +${moreCount} more` : '';

  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
    >
      <span aria-hidden="true">⚠</span>
      <span>
        <strong>{lowAssets.length} material{lowAssets.length === 1 ? '' : 's'} low on stock:</strong> {shown}{more}
      </span>
    </div>
  );
}
