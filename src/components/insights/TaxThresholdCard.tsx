import { useEffect } from 'react';
import type { Currency, Sale, TaxJurisdiction } from '../../types';
import type { FxRateTable } from '../../utils/fxConvert';
import { computeTaxThresholdProgress } from '../../utils/taxThreshold';
import { formatCurrency } from '../../utils/currency';
import { InfoTooltip, useToast } from '../ui';
import { NewBadge } from '../NewBadge';

interface TaxThresholdCardProps {
  /** Lifetime sales — NOT the PeriodPicker-scoped range (matches printer payback's D-05 pattern). */
  sales: Sale[];
  jurisdiction: TaxJurisdiction | undefined;
  userCurrency: Currency;
  fxTable: FxRateTable | null;
  customAmount?: number;
  customLabel?: string;
}

// Research date the four jurisdictions' figures were sourced/verified against
// (41-RESEARCH.md — UK live-verified, DE/AU/US structurally cross-checked).
// Non-negotiable card text (D-16) — never omit regardless of jurisdiction.
const DATA_AS_OF = '2026-07-09';

const GROSS_REVENUE_TOOLTIP =
  'Uses your GROSS sale revenue (marketplace fees are not deducted) because UK/DE/AU thresholds are legally defined on gross turnover — deliberately different from the net-of-fees profit shown elsewhere in Insights.';

const STORAGE_KEY = '3dcoster-tax-threshold-alerted';

function alreadyAlerted(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === key;
  } catch {
    return false;
  }
}

function markAlerted(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // localStorage may be full or unavailable — the toast still fires this session.
  }
}

/**
 * Phase 41 LIFE-02 (D-13/D-15/D-16): a disclaimed, jurisdiction-correct
 * gross-revenue progress bar toward the local hobby-to-business tax
 * threshold, driven exclusively by computeTaxThresholdProgress (never a
 * second/forked threshold calculation). US renders an informational
 * badges-of-trade note with NO bar. Fires a ONE-TIME toast the first time
 * revenue crosses the threshold for the current tax year, persisted via
 * localStorage so it survives reloads but re-fires once a new tax year starts
 * (the alert key includes the tax-year label).
 */
export function TaxThresholdCard({ sales, jurisdiction, userCurrency, fxTable, customAmount, customLabel }: TaxThresholdCardProps) {
  const toast = useToast();
  const money = (n: number) => formatCurrency(n, userCurrency);

  const custom = customAmount !== undefined && customAmount > 0
    ? { amount: customAmount, label: customLabel || 'Custom threshold' }
    : undefined;

  const result = jurisdiction
    ? computeTaxThresholdProgress(sales, jurisdiction, userCurrency, fxTable, custom)
    : { hasBar: false as const };

  const alertKey = jurisdiction && result.hasBar && result.taxYearLabel
    ? `${jurisdiction}:${result.taxYearLabel}`
    : null;

  useEffect(() => {
    if (!alertKey || !result.crossed) return;
    if (alreadyAlerted(alertKey)) return;
    markAlerted(alertKey);
    toast.info(`You've crossed the ${result.label ?? 'tax'} threshold for ${result.taxYearLabel} — you may want to talk to an accountant.`);
    // Only re-run when the crossing state or the tax-year key actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey, result.crossed]);

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 relative">
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className="text-sm font-medium text-slate-300">Tax threshold</h3>
        <NewBadge feature="tax-threshold" className="relative -top-1 pointer-events-none" />
      </div>

      {!jurisdiction && (
        <p className="text-sm text-slate-500">Set your jurisdiction in Settings to track your tax threshold.</p>
      )}

      {jurisdiction === 'US' && (
        <p className="text-sm text-slate-400">
          The US has no fixed-dollar hobby-to-business threshold. The IRS instead weighs several
          "badges of trade" factors (profit motive, regularity, business-like conduct) — this app
          can't compute a single number for that.
        </p>
      )}

      {jurisdiction && jurisdiction !== 'US' && !result.hasBar && (
        <p className="text-sm text-slate-500">
          {jurisdiction === 'OTHER'
            ? 'Enter a custom threshold amount in Settings to track your progress.'
            : 'Not enough exchange-rate data to show your progress right now.'}
        </p>
      )}

      {jurisdiction && jurisdiction !== 'US' && result.hasBar && (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-200">{result.label}</span>
            <span className="text-xs text-slate-500">{result.taxYearLabel}</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${result.crossed ? 'bg-amber-500' : (result.fraction ?? 0) > 0.75 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, (result.fraction ?? 0) * 100))}%` }}
            />
          </div>
          <p className="text-xs mt-1 text-slate-400">
            {money(result.revenue ?? 0)} / {money(result.threshold ?? 0)}
            {' '}({Math.round((result.fraction ?? 0) * 100)}%)
            {result.crossed && <span className="text-amber-400 font-medium"> — threshold crossed</span>}
          </p>
        </>
      )}

      <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-start gap-1.5">
        <p className="text-xs text-slate-500 flex-1">
          Not tax advice — consult a qualified accountant. Data current as of {DATA_AS_OF}.
        </p>
        {jurisdiction && jurisdiction !== 'US' && <InfoTooltip text={GROSS_REVENUE_TOOLTIP} />}
      </div>
    </div>
  );
}
