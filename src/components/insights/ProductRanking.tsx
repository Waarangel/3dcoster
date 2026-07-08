import type { Currency } from '../../types';
import type { ProductRankingResult, ProductEarner } from '../../utils/insights';
import type { PrintHourTone } from '../../utils/printHourProfit';
import { formatCurrency } from '../../utils/currency';
import { InfoTooltip } from '../ui';

interface ProductRankingProps {
  ranking: ProductRankingResult;
  userCurrency: Currency;
}

const TONE_CLASSES: Record<PrintHourTone, string> = {
  good: 'text-green-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  na: 'text-slate-500',
};

// D-14/RESEARCH P-04: rule-of-thumb framing, corroborated across sources —
// deliberately NOT a single cited authoritative figure.
const BENCHMARK_TOOLTIP =
  'Based on the typical $1–5 per printer-hour range reported across several desktop-FDM maker-business guides — a rough, corroborated range, not a single authoritative figure.';

/**
 * D-01/D-02: only sold products rank (by net profit-per-printer-hour);
 * unsold products render in a separate "No sales yet" list, never mixed
 * into the earnings ranking with modeled numbers.
 */
export function ProductRanking({ ranking, userCurrency }: ProductRankingProps) {
  const { ranked, unsold, hasPartialData } = ranking;
  const money = (n: number) => formatCurrency(n, userCurrency);

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="text-sm font-medium text-slate-300">Product profitability</h3>
        <InfoTooltip text={BENCHMARK_TOOLTIP} />
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-slate-500">No sold products yet in this period.</p>
      ) : (
        <ul className="space-y-2">
          {ranked.map((earner, index) => (
            <ProductRow
              key={earner.key}
              earner={earner}
              money={money}
              isTop={index === 0 && earner.profitPerHour !== null}
              isBottom={index === ranked.length - 1 && ranked.length > 1 && earner.profitPerHour !== null}
            />
          ))}
        </ul>
      )}

      {hasPartialData && (
        <p className="text-xs text-amber-400/80 mt-3">Some products are missing an exchange rate, so their profit may be incomplete.</p>
      )}

      {unsold.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700">
          <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-2">No sales yet</h4>
          <ul className="space-y-1">
            {unsold.map(product => (
              <li key={product.key} className="text-sm text-slate-400 flex justify-between">
                <span>{product.name}</span>
                <span className="text-slate-500">{product.copiesSold} made</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProductRow({ earner, money, isTop, isBottom }: {
  earner: ProductEarner;
  money: (n: number) => string;
  isTop: boolean;
  isBottom: boolean;
}) {
  const borderColor = isTop ? 'border-green-500' : isBottom ? 'border-red-500' : 'border-transparent';

  return (
    <li className={`flex items-center justify-between gap-3 bg-slate-900/40 rounded-lg pl-3 pr-3 py-2 border-l-4 ${borderColor}`}>
      <div className="min-w-0">
        <div className="text-sm text-slate-200 truncate flex items-center gap-2">
          {earner.name}
          {isTop && <span className="text-[10px] font-medium uppercase tracking-wide text-green-400">Top earner</span>}
          {isBottom && <span className="text-[10px] font-medium uppercase tracking-wide text-red-400">Lowest earner</span>}
        </div>
        <div className="text-xs text-slate-500">{earner.saleCount} sale{earner.saleCount === 1 ? '' : 's'} · {earner.copiesSold} sold</div>
      </div>
      <div className={`shrink-0 font-mono text-sm font-semibold ${TONE_CLASSES[earner.tone]}`}>
        {earner.profitPerHour === null ? '—' : `${money(earner.profitPerHour)}/hr`}
      </div>
    </li>
  );
}
