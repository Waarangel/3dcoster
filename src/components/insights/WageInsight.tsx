import type { Currency } from '../../types';
import type { WageHeadlineResult } from '../../utils/insights';
import { formatCurrency } from '../../utils/currency';

interface WageInsightProps {
  headline: WageHeadlineResult;
  userCurrency: Currency;
}

/**
 * D-03: ONE aggregate headline (effective hourly wage over the selected
 * period) plus an optional gap vs. the Settings target — NEVER a
 * per-product wage column and NEVER a judgment/grade score. Just the
 * number and the gap.
 */
export function WageInsight({ headline, userCurrency }: WageInsightProps) {
  const money = (n: number) => formatCurrency(n, userCurrency);

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="text-xs text-slate-400 uppercase tracking-wide">True hourly wage</div>

      {headline.effectiveHourlyWage === null ? (
        <p className="mt-1 text-sm text-slate-500">
          Not enough data yet — this needs at least one sold job with logged prep/post-processing time.
        </p>
      ) : (
        <>
          <div className="mt-1 text-2xl font-bold text-white">
            {money(headline.effectiveHourlyWage)}<span className="text-base font-normal text-slate-400">/hr</span>
          </div>
          {headline.targetHourlyRate !== null && headline.gap !== null && (
            <p className={`mt-1 text-sm ${headline.gap >= 0 ? 'text-green-400' : 'text-amber-400'}`}>
              Earning {money(headline.effectiveHourlyWage)}/hr vs your {money(headline.targetHourlyRate)}/hr target
              {' '}({headline.gap >= 0 ? '+' : ''}{money(headline.gap)}/hr)
            </p>
          )}
        </>
      )}

      {headline.hasPartialData && (
        <p className="text-xs text-amber-400/80 mt-2">Some sales are missing an exchange rate, so this number may be incomplete.</p>
      )}
    </div>
  );
}
