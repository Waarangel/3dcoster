import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Currency } from '../../types';
import type { PrinterPaybackResult } from '../../utils/insights';
import { formatCurrency } from '../../utils/currency';
import { Button, InfoTooltip, useToast } from '../ui';

interface PrinterROIProps {
  payback: PrinterPaybackResult[];
  userCurrency: Currency;
  /** Widened beyond InsightsPanel's other CTAs — the missing-price CTA switches to Printer Settings. */
  onSwitchTab: (tab: 'settings') => void;
}

const PROJECTION_TOOLTIP_TEXT =
  'Projected from your net profit pace over the last 90 days of sales (or your full sales history, if shorter).';

/**
 * D-05/D-06/D-07/D-08: one payback card per printer instance, driven
 * exclusively by computePrinterPayback (InsightsPanel supplies the result
 * array) — never a second/forked payback formula (D-16). Renders a
 * missing-price CTA instead of a bar when purchasePrice can't be resolved,
 * and an honest "Unassigned" line for sales whose job has no printer.
 * Fires a ONE-TIME celebration toast when a printer's paidOff first flips to
 * true during this session — printers already paid off when the component
 * first mounts are snapshotted and never toast (D-06).
 */
export function PrinterROI({ payback, userCurrency, onSwitchTab }: PrinterROIProps) {
  const toast = useToast();
  const money = (n: number) => formatCurrency(n, userCurrency);

  // Snapshot-on-mount: printers already paid off the first time this
  // component sees data never toast. Lazily initialized via a ref (only set
  // once, on first render) rather than useState, since the set itself never
  // needs to trigger a re-render.
  const initialPaidOffIds = useRef<Set<string> | null>(null);
  if (initialPaidOffIds.current === null) {
    initialPaidOffIds.current = new Set(payback.filter(p => p.paidOff).map(p => p.printerInstanceId));
  }
  const toastedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const result of payback) {
      if (!result.paidOff) continue;
      if (initialPaidOffIds.current!.has(result.printerInstanceId)) continue;
      if (toastedIds.current.has(result.printerInstanceId)) continue;
      toastedIds.current.add(result.printerInstanceId);
      toast.success(`🎉 ${result.label} paid for itself!`);
    }
  }, [payback, toast]);

  if (payback.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mt-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Printer payback</h3>
      <ul className="space-y-2">
        {payback.map(result => (
          <PrinterROIRow key={result.printerInstanceId} result={result} money={money} onSwitchTab={onSwitchTab} />
        ))}
      </ul>
    </div>
  );
}

interface PrinterROIRowProps {
  result: PrinterPaybackResult;
  money: (n: number) => string;
  onSwitchTab: (tab: 'settings') => void;
}

function PrinterROIRow({ result, money, onSwitchTab }: PrinterROIRowProps) {
  // D-08: the Unassigned bucket has no payoff concept — it exists solely so
  // sale totals from jobs with no printer stay visible, never dropped.
  if (result.printerInstanceId === 'unassigned') {
    return (
      <li className="bg-slate-900/40 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-300">Unassigned</span>
          <span className="text-sm font-mono text-slate-400">
            {result.cumulativeNetProfit === null ? '—' : money(result.cumulativeNetProfit)}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Sales from jobs with no printer assigned — not counted toward any printer's payback.</p>
      </li>
    );
  }

  if (result.missingPurchasePrice) {
    return (
      <li className="bg-slate-900/40 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-slate-200">{result.label}</span>
          <Button btnSize="sm" variant="secondary" onClick={() => onSwitchTab('settings')}>
            Add purchase price to track payback
          </Button>
        </div>
      </li>
    );
  }

  const purchasePrice = result.purchasePrice ?? 0;
  const netProfit = result.cumulativeNetProfit;
  const percent = netProfit !== null && purchasePrice > 0 ? (netProfit / purchasePrice) * 100 : 0;

  let verdict: ReactNode;
  if (netProfit === null) {
    verdict = <span className="text-slate-500">Some sales are missing an exchange rate, so this number may be incomplete.</span>;
  } else if (result.paidOff) {
    verdict = (
      <span className="text-green-400">
        {result.breakEvenDate ? `Paid off on ${result.breakEvenDate.toLocaleDateString()}` : 'Paid off'} · net {money(netProfit)}
      </span>
    );
  } else {
    const tone = netProfit >= 0 ? 'text-slate-300' : 'text-amber-400';
    verdict = (
      <span className={tone}>
        net {netProfit >= 0 ? '+' : '−'}{money(Math.abs(netProfit))}
        {result.projectedDate && (
          <>
            {' '}· projected to pay off ~{result.projectedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            <InfoTooltip text={PROJECTION_TOOLTIP_TEXT} className="ml-1" />
          </>
        )}
      </span>
    );
  }

  return (
    <li className="bg-slate-900/40 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-200">{result.label}</span>
        <span className="text-xs text-slate-500">{money(purchasePrice)} purchase price</span>
      </div>
      <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${result.paidOff ? 'bg-green-500' : percent > 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <p className="text-xs mt-1">{verdict}</p>
      {result.hasPartialData && netProfit !== null && (
        <p className="text-xs text-amber-400/80 mt-1">Some sales are missing an exchange rate, so this number may be incomplete.</p>
      )}
    </li>
  );
}
