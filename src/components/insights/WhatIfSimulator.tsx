import { useEffect, useMemo, useState } from 'react';
import type { Currency, Material, PrintJob } from '../../types';
import {
  useElectricitySettings,
  usePrinters,
  usePrinterInstances,
  useMaterials,
  useUserProfile,
} from '../../hooks/useDatabase';
import { dominantMaterialId } from '../../db/failureRate';
import { computeScenario } from '../../utils/insights';
import { Modal, InfoTooltip, Button } from '../ui';
import { formatCurrency } from '../../utils/currency';

// ---------------------------------------------------------------------------
// WhatIfSimulator — Phase 40 Plan 05 (INS-03, D-09/D-10/D-11/D-12).
//
// Shared Modal-based what-if margin simulator. Reachable from a JobsManager
// job-row icon action AND from an Insights-tab job picker — ONE component,
// identical behavior either way (D-09). Exactly three sliders (filament
// price, electricity rate, failure rate); every recompute routes through
// computeScenario (src/utils/insights.ts), which itself routes exclusively
// through calculateCost (costCalc.ts) — no forked cost formula (PITFALLS
// C-03). Holds ONLY local React state: no Dexie write, no "save as
// scenario". Closing the Modal discards everything (D-11/D-12, INS-03
// read-only invariant).
// ---------------------------------------------------------------------------

export interface WhatIfSimulatorProps {
  job: PrintJob | null;
  isOpen: boolean;
  onClose: () => void;
}

// D-11: exactly three sliders. Ranges are generous headroom over typical
// real-world values, widened per-job when the job's own saved value would
// otherwise fall outside the fixed floor (Claude's discretion — no arbitrary
// clamp that could hide the saved value off the end of the track).
const FILAMENT_PRICE_MIN = 0;
const FILAMENT_PRICE_MAX_FLOOR = 0.5; // $/g — typical spools run $0.02-0.08/g
const FILAMENT_PRICE_STEP = 0.001;

const ELECTRICITY_RATE_MIN = 0;
const ELECTRICITY_RATE_MAX_FLOOR = 1.0; // $/kWh — typical rates run $0.05-0.40/kWh
const ELECTRICITY_RATE_STEP = 0.01;

const FAILURE_RATE_MIN = 0;
const FAILURE_RATE_MAX = 99; // matches calculateCost's internal 0..99 clamp (costCalc.ts D-02)
const FAILURE_RATE_STEP = 1;

/**
 * D-10 baseline seed: the job's dominant filament row's own price override,
 * falling back to that material's costPerUnit, mirroring how
 * buildCalcInputFromJob resolves editedPrice for a filament row with no
 * override. Falls back to the job's FIRST filament row when no dominant
 * material is resolvable (empty filaments array).
 */
function resolveBaselineFilamentPrice(job: PrintJob, materials: readonly Material[]): number {
  const dominantId = dominantMaterialId(job);
  const row = job.filaments.find(f => f.filamentId === dominantId) ?? job.filaments[0];
  if (!row) return 0;
  if (typeof row.pricePerGram === 'number' && Number.isFinite(row.pricePerGram)) return row.pricePerGram;
  const asset = materials.find(m => m.id === row.filamentId);
  return typeof asset?.costPerUnit === 'number' && Number.isFinite(asset.costPerUnit) ? asset.costPerUnit : 0;
}

function resolveBaselineElectricityRate(job: PrintJob, flatRate: number): number {
  return typeof job.touRateUsedPerKwh === 'number' && Number.isFinite(job.touRateUsedPerKwh)
    ? job.touRateUsedPerKwh
    : flatRate;
}

/** Widens a fixed floor so a job's own saved value is never clamped off the visible track. */
function widenMax(floor: number, baseline: number): number {
  return Number.isFinite(baseline) && baseline * 2 > floor ? baseline * 2 : floor;
}

function fmtPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtSignedPercent(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}pts`;
}

function fmtCopies(n: number): string {
  return `${n} ${n === 1 ? 'copy' : 'copies'}`;
}

function fmtSignedCopies(n: number): string {
  return `${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? 'copy' : 'copies'}`;
}

/**
 * A single scenario metric row: "label   baseline → live   [delta chip]".
 * `higherIsBetter` controls the delta chip's green/red coloring — margin and
 * profit deltas are good when positive, but a break-even delta is good when
 * NEGATIVE (fewer copies needed to recover fixed costs).
 */
function MetricRow({
  label,
  tooltip,
  baseline,
  live,
  delta,
  formatValue,
  formatDelta,
  higherIsBetter = true,
  unreachableLabel = 'never',
}: {
  label: string;
  tooltip?: string;
  baseline: number | null;
  live: number | null;
  delta: number | null;
  formatValue: (n: number) => string;
  formatDelta: (n: number) => string;
  higherIsBetter?: boolean;
  unreachableLabel?: string;
}) {
  const liveText = live !== null && Number.isFinite(live) ? formatValue(live) : unreachableLabel;
  const baselineText = baseline !== null && Number.isFinite(baseline) ? formatValue(baseline) : unreachableLabel;
  const showArrow = baselineText !== liveText;
  const deltaText = delta !== null && Number.isFinite(delta) && delta !== 0 ? formatDelta(delta) : null;
  const deltaIsGood = delta === null ? null : higherIsBetter ? delta > 0 : delta < 0;
  const deltaColor = deltaIsGood === null ? 'text-slate-400' : deltaIsGood ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between text-sm gap-3">
      <span className="text-slate-400 flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className="font-mono text-slate-100 text-right">
        {showArrow ? `${baselineText} → ${liveText}` : liveText}
        {deltaText && <span className={`ml-2 text-xs font-medium ${deltaColor}`}>{deltaText}</span>}
      </span>
    </div>
  );
}

/** baseline = live - delta, the inverse of how computeScenario derives each delta. */
function deriveBaseline(live: number | null, delta: number | null): number | null {
  return live !== null && delta !== null && Number.isFinite(live) && Number.isFinite(delta) ? live - delta : null;
}

export function WhatIfSimulator({ job, isOpen, onClose }: WhatIfSimulatorProps) {
  const { electricity } = useElectricitySettings();
  const { printers: printerConfigs } = usePrinters();
  const { instances: printerInstances } = usePrinterInstances();
  const { materials } = useMaterials();
  const { profile: userProfile } = useUserProfile();

  const [filamentPricePerGram, setFilamentPricePerGram] = useState(0);
  const [electricityRatePerKwh, setElectricityRatePerKwh] = useState(0);
  const [failureRate, setFailureRate] = useState(0);

  const resetToSaved = useMemo(() => {
    return () => {
      if (!job) return;
      setFilamentPricePerGram(resolveBaselineFilamentPrice(job, materials));
      setElectricityRatePerKwh(resolveBaselineElectricityRate(job, electricity.costPerKwh));
      setFailureRate(job.failureRate);
    };
    // Rebuilt only when the seed inputs change; called imperatively (open effect + Reset button).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  // Re-seed every time the modal transitions closed -> open for a (possibly new)
  // job — mirrors LogFailureModal's reset-on-open pattern. Not re-run on every
  // materials/electricity re-render so mid-session live-config changes don't
  // yank the sliders out from under the user while they're mid-drag.
  useEffect(() => {
    if (!isOpen || !job) return;
    resetToSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job?.id]);

  const result = useMemo(() => {
    if (!job) return null;
    return computeScenario(
      job,
      { filamentPricePerGram, electricityRatePerKwh, failureRate },
      { printerInstances, printerConfigs, electricity, materials, laborHourlyRate: userProfile.laborHourlyRate },
    );
  }, [job, filamentPricePerGram, electricityRatePerKwh, failureRate, printerInstances, printerConfigs, electricity, materials, userProfile.laborHourlyRate]);

  const filamentPriceMax = job ? widenMax(FILAMENT_PRICE_MAX_FLOOR, resolveBaselineFilamentPrice(job, materials)) : FILAMENT_PRICE_MAX_FLOOR;
  const electricityRateMax = job ? widenMax(ELECTRICITY_RATE_MAX_FLOOR, resolveBaselineElectricityRate(job, electricity.costPerKwh)) : ELECTRICITY_RATE_MAX_FLOOR;

  const currency: Currency = job?.currency ?? userProfile.currency;

  const baselineMargin = result ? deriveBaseline(result.margin, result.deltas.marginPts) : null;
  const baselineProfit = result ? deriveBaseline(result.profit, result.deltas.profit) : null;
  const baselineBreakEven = result ? deriveBaseline(result.breakEven, result.deltas.breakEven) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={job ? `What-if: ${job.name}` : 'What-if simulator'} size="md">
      {!job || !result ? (
        <div className="p-4 text-sm text-slate-400">Select a job to simulate.</div>
      ) : (
        <div className="p-4 space-y-5">
          <p className="text-xs text-slate-500">
            Drag a slider to see how it would change this job&apos;s numbers. Nothing here is saved — close the
            simulator and the saved job is untouched.
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="whatif-filament-price" className="text-xs text-slate-400 flex items-center gap-1">
                  Filament price per gram
                  <InfoTooltip text="Overrides the price of every filament row on this job for the scenario only." />
                </label>
                <span className="text-xs font-mono text-slate-300">{formatCurrency(filamentPricePerGram, currency)}/g</span>
              </div>
              {/* allow-raw-html: native range input is the simulator's slider control — no shared Slider primitive exists in src/components/ui */}
              <input
                id="whatif-filament-price"
                type="range"
                aria-label="Filament price per gram"
                min={FILAMENT_PRICE_MIN}
                max={filamentPriceMax}
                step={FILAMENT_PRICE_STEP}
                value={filamentPricePerGram}
                onChange={(e) => setFilamentPricePerGram(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="whatif-electricity-rate" className="text-xs text-slate-400 flex items-center gap-1">
                  Electricity rate
                  <InfoTooltip text="Replaces this job's saved $/kWh rate for the scenario only." />
                </label>
                <span className="text-xs font-mono text-slate-300">{formatCurrency(electricityRatePerKwh, currency)}/kWh</span>
              </div>
              {/* allow-raw-html: native range input is the simulator's slider control — no shared Slider primitive exists in src/components/ui */}
              <input
                id="whatif-electricity-rate"
                type="range"
                aria-label="Electricity rate per kilowatt hour"
                min={ELECTRICITY_RATE_MIN}
                max={electricityRateMax}
                step={ELECTRICITY_RATE_STEP}
                value={electricityRatePerKwh}
                onChange={(e) => setElectricityRatePerKwh(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="whatif-failure-rate" className="text-xs text-slate-400 flex items-center gap-1">
                  Failure rate
                  <InfoTooltip text="Replaces this job's saved failure rate for the scenario only." />
                </label>
                <span className="text-xs font-mono text-slate-300">{failureRate}%</span>
              </div>
              {/* allow-raw-html: native range input is the simulator's slider control — no shared Slider primitive exists in src/components/ui */}
              <input
                id="whatif-failure-rate"
                type="range"
                aria-label="Failure rate percent"
                min={FAILURE_RATE_MIN}
                max={FAILURE_RATE_MAX}
                step={FAILURE_RATE_STEP}
                value={failureRate}
                onChange={(e) => setFailureRate(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-700 pt-3 space-y-2">
            <MetricRow
              label="Margin"
              baseline={baselineMargin}
              live={result.margin}
              delta={result.deltas.marginPts}
              formatValue={fmtPercent}
              formatDelta={fmtSignedPercent}
              higherIsBetter
              unreachableLabel="n/a"
            />
            <MetricRow
              label="Profit"
              baseline={baselineProfit}
              live={result.profit}
              delta={result.deltas.profit}
              formatValue={(n) => formatCurrency(n, currency)}
              formatDelta={(n) => `${n > 0 ? '+' : ''}${formatCurrency(n, currency)}`}
              higherIsBetter
              unreachableLabel="n/a"
            />
            <MetricRow
              label="Break-even"
              tooltip="Copies needed to recover this job's fixed costs (model fee, depreciation, nozzle wear) at the current profit per unit."
              baseline={baselineBreakEven}
              live={result.breakEven}
              delta={result.deltas.breakEven}
              formatValue={fmtCopies}
              formatDelta={fmtSignedCopies}
              higherIsBetter={false}
              unreachableLabel="never"
            />
          </div>

          <div className="flex justify-between items-center pt-1">
            <Button variant="secondary" btnSize="sm" onClick={resetToSaved}>Reset to saved</Button>
            <Button variant="secondary" btnSize="md" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
