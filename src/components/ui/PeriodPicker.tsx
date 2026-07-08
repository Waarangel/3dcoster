import { useEffect, useId, useMemo, useState } from 'react';
import type { SalesReportRange } from '../../utils/salesReportAggregates';
import { MONTHS, isoDay, nowParts, resolveDateRange, type RangeMode } from '../../utils/periodRange';
import { Select } from './Select';
import { Input } from './Input';

export interface PeriodPickerProps {
  /** Years to offer in the Year Select — typically derived from historical record dates + the current year. */
  saleYears: number[];
  /** Called with the resolved range whenever mode/year/month/quarter/custom-dates change. Pass a stable identity (e.g. a `useState` setter) to avoid re-firing every render. */
  onRangeChange: (range: SalesReportRange) => void;
  /** Called whenever the custom "From" > "To" guard flips, so the parent can disable actions and surface its own message (T-40-03 mitigation). Pass a stable identity for the same reason as onRangeChange. */
  onCustomRangeInvalidChange?: (isInvalid: boolean) => void;
}

/**
 * Reusable period-selection control — the mode Select plus the mode-specific
 * controls (month/year, quarter/year, year, or custom From/To). Shared by
 * ReportsSection (Phase 40 40-02) and the Insights tab (40-03) so RangeMode
 * and its range-resolution logic exist in exactly one place (periodRange.ts).
 */
export function PeriodPicker({ saleYears, onRangeChange, onCustomRangeInvalidChange }: PeriodPickerProps) {
  const [mode, setMode] = useState<RangeMode>('month');
  // One clock read at mount so year/month/quarter can't straddle a second boundary.
  const [initialNow] = useState(() => nowParts());
  const [year, setYear] = useState(initialNow.year);
  const [month, setMonth] = useState(initialNow.month);
  const [quarter, setQuarter] = useState(() => Math.floor(initialNow.month / 3));
  const [customStart, setCustomStart] = useState(() => isoDay(new Date(initialNow.year, initialNow.month, 1)));
  const [customEnd, setCustomEnd] = useState(() => isoDay(new Date()));

  // Associate each range control with its visible label for screen readers.
  const periodId = useId();
  const monthId = useId();
  const yearId = useId();
  const quarterId = useId();
  const fromId = useId();
  const toId = useId();

  // Guard a backwards custom range (From after To) — otherwise the report just
  // shows zero with no explanation (T-40-03).
  const customRangeInvalid = mode === 'custom' && customEnd < customStart;

  const range = useMemo<SalesReportRange>(
    () => resolveDateRange(mode, { year, month, quarter, customStart, customEnd }),
    [mode, year, month, quarter, customStart, customEnd],
  );

  useEffect(() => {
    onRangeChange(range);
  }, [range, onRangeChange]);

  useEffect(() => {
    onCustomRangeInvalidChange?.(customRangeInvalid);
  }, [customRangeInvalid, onCustomRangeInvalidChange]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label htmlFor={periodId} className="block text-xs text-slate-400 mb-1">Period</label>
        <Select id={periodId} selectSize="sm" value={mode} onChange={e => setMode(e.target.value as RangeMode)}>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
          <option value="ytd">Year to date</option>
          <option value="custom">Custom range</option>
        </Select>
      </div>
      {mode === 'month' && (
        <>
          <div>
            <label htmlFor={monthId} className="block text-xs text-slate-400 mb-1">Month</label>
            <Select id={monthId} selectSize="sm" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor={yearId} className="block text-xs text-slate-400 mb-1">Year</label>
            <Select id={yearId} selectSize="sm" value={year} onChange={e => setYear(Number(e.target.value))}>
              {saleYears.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </>
      )}
      {mode === 'quarter' && (
        <>
          <div>
            <label htmlFor={quarterId} className="block text-xs text-slate-400 mb-1">Quarter</label>
            <Select id={quarterId} selectSize="sm" value={quarter} onChange={e => setQuarter(Number(e.target.value))}>
              {[0, 1, 2, 3].map(q => (
                <option key={q} value={q}>Q{q + 1} ({MONTHS[q * 3].slice(0, 3)}–{MONTHS[q * 3 + 2].slice(0, 3)})</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor={yearId} className="block text-xs text-slate-400 mb-1">Year</label>
            <Select id={yearId} selectSize="sm" value={year} onChange={e => setYear(Number(e.target.value))}>
              {saleYears.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </>
      )}
      {mode === 'year' && (
        <div>
          <label htmlFor={yearId} className="block text-xs text-slate-400 mb-1">Year</label>
          <Select id={yearId} selectSize="sm" value={year} onChange={e => setYear(Number(e.target.value))}>
            {saleYears.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      )}
      {mode === 'custom' && (
        <>
          <div>
            <label htmlFor={fromId} className="block text-xs text-slate-400 mb-1">From</label>
            <Input id={fromId} inputSize="sm" type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor={toId} className="block text-xs text-slate-400 mb-1">To</label>
            <Input id={toId} inputSize="sm" type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </>
      )}
    </div>
  );
}
