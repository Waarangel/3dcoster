import type { ManualCostLine, Material, MaterialUsage } from '../../types';
import { NewBadge } from '../NewBadge';
import { Button, FieldWarning, Input, RemoveButton, Select, InfoTooltip } from '../ui';
import type { MaterialRow } from '../../hooks/useCostForm';
import type { CalculatorFieldIds } from './fieldIds';
import type { DerivedFailureRate } from '../../db/failureRate';
// WR-09: parseHHMM is a pure string parser (no IO, no Dexie, no business math)
// — importing it here stays within the D-11 props-in/callbacks-out contract.
// It powers the inline warning when the typed start time isn't valid HH:MM.
import { parseHHMM } from '../../utils/touElectricity';

// Phase 39 WEAR-01/02 (D-14): amortized-maintenance suggestion shape, mirroring
// the orchestrator's maintenance-amortization derivation result — kept as a
// small local shape so this props-in/callbacks-out section never imports the
// Dexie-backed derivation hook itself (contract preserved).
export interface AmortizedMaintenanceSuggestion {
  amortizedPerHour: number;
}

// Phase 39 TOU-02 (D-10/D-11): a savings hint surfaced when the CURRENT start
// time is not the cheapest available option.
export interface TouSavingsHint {
  cheapestStart: string;
  saving: number;
}

interface CostParametersSectionProps {
  printTimeHours: number;
  onPrintTimeHoursChange: (value: number) => void;
  failureRate: number;
  onFailureRateChange: (value: number) => void;
  prepTimeMinutes: number;
  onPrepTimeMinutesChange: (value: number) => void;
  postProcessingMinutes: number;
  onPostProcessingMinutesChange: (value: number) => void;
  materialsUsed: MaterialRow[];
  materialsInProfile: Material[];
  nonFilaments: Material[];
  currencySymbol: string;
  onAddMaterialUsage: () => void;
  onUpdateMaterialUsage: (index: number, field: keyof MaterialUsage, value: string | number) => void;
  onRemoveMaterialUsage: (index: number) => void;
  // Phase 47.1 (MC-01): manual one-off post-processing lines (name + cost, no library
  // asset). Rows are keyed/edited by persisted line.id, never by array index.
  manualMaterials: ManualCostLine[];
  onAddManualMaterial: () => void;
  onUpdateManualMaterial: (id: string, patch: Partial<Pick<ManualCostLine, 'name' | 'cost'>>) => void;
  onRemoveManualMaterial: (id: string) => void;
  ids: CalculatorFieldIds;

  // --- Phase 39 additions (all optional-by-shape via explicit null, never
  // speculative — every prop here is consumed by a concrete hint row below) ---

  /** FAIL-02: the empirical failure-rate suggestion for the current printer×material combo, or null below the sample-size threshold / before a printer+material are selected. */
  empiricalFailureRate?: DerivedFailureRate | null;
  /** Apply the suggested rate — routes through the EXISTING onFailureRateChange setter (never a silent auto-write). */
  onApplyEmpiricalFailureRate?: () => void;

  /** TOU-02: the print's "HH:MM" start time. Undefined = flat rate is used. */
  touStartTime?: string;
  onTouStartTimeChange?: (value: string | undefined) => void;
  /** Whether the user has configured any TOU bands in Settings — gates whether the start-time picker renders at all. */
  touBandsConfigured?: boolean;
  /** A one-line savings hint when the current start time isn't the cheapest available band. */
  touSavingsHint?: TouSavingsHint | null;

  /** WEAR-02 (D-14): the manual maintenance-cost $/hr input — a NEW field, since no prior maintenance-cost input existed. */
  maintenanceCostPerHour?: number;
  onMaintenanceCostPerHourChange?: (value: number) => void;
  /** The amortized $/hr suggestion derived from logged maintenance history, or null with insufficient history. */
  amortizedMaintenancePerHour?: AmortizedMaintenanceSuggestion | null;
  /** Apply the suggested amortized rate — routes through onMaintenanceCostPerHourChange. */
  onApplyAmortizedMaintenance?: () => void;
}

/**
 * Print parameters (time / failure rate / prep / post-processing minutes) +
 * Post-Processing Materials list. Props-in, callbacks-out; no Dexie access,
 * no business math (D-11). Per D-10, this is the section Phase 39's
 * failure/TOU/wear inputs attach to as ordinary additions — no speculative
 * extension props are added ahead of that need.
 */
export function CostParametersSection({
  printTimeHours,
  onPrintTimeHoursChange,
  failureRate,
  onFailureRateChange,
  prepTimeMinutes,
  onPrepTimeMinutesChange,
  postProcessingMinutes,
  onPostProcessingMinutesChange,
  materialsUsed,
  materialsInProfile,
  nonFilaments,
  currencySymbol,
  onAddMaterialUsage,
  onUpdateMaterialUsage,
  onRemoveMaterialUsage,
  manualMaterials,
  onAddManualMaterial,
  onUpdateManualMaterial,
  onRemoveManualMaterial,
  ids,
  empiricalFailureRate,
  onApplyEmpiricalFailureRate,
  touStartTime,
  onTouStartTimeChange,
  touBandsConfigured,
  touSavingsHint,
  maintenanceCostPerHour,
  onMaintenanceCostPerHourChange,
  amortizedMaintenancePerHour,
  onApplyAmortizedMaintenance,
}: CostParametersSectionProps) {
  return (
    <>
      {/* Print parameters — flex-wrap so compact inputs pack tightly left-to-right (matches SettingsModal pattern). */}
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        <div>
          <label htmlFor={ids.printTime} className="block text-xs text-slate-400 mb-1">Print Time (hours)</label>
          <Input
            id={ids.printTime}
            type="number"
            step="0.1"
            min="0"
            compact
            value={printTimeHours || ''}
            onChange={e => onPrintTimeHoursChange(Math.max(parseFloat(e.target.value) || 0, 0))}
            placeholder="0"
          />
        </div>

        <div>
          <label htmlFor={ids.failureRate} className="block text-xs text-slate-400 mb-1">Failure Rate (%)</label>
          <Input
            id={ids.failureRate}
            type="number"
            min="0"
            max="99"
            compact
            value={failureRate || ''}
            onChange={e => onFailureRateChange(Math.min(parseFloat(e.target.value) || 0, 99))}
            placeholder="5"
          />
          {/* Phase 39 FAIL-02: empirical failure-rate suggestion. The manual
              input above stays authoritative — Apply routes through the SAME
              onFailureRateChange setter the input itself uses; nothing here
              ever auto-writes the field. */}
          {empiricalFailureRate && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <span>
                Logged: {empiricalFailureRate.rate.toFixed(0)}%
                {empiricalFailureRate.provenance === 'printer-fallback' ? ' (printer avg)' : ''}
              </span>
              <InfoTooltip
                text={`Based on ${empiricalFailureRate.sampleSize} logged attempts${empiricalFailureRate.provenance === 'printer-fallback' ? ' across all materials on this printer' : ' for this printer + material'}. Applying replaces the manual rate above — it stays editable.`}
              />
              <Button
                variant="ghost"
                btnSize="sm"
                className="!px-2 !py-0.5 underline"
                onClick={onApplyEmpiricalFailureRate}
              >
                Apply
              </Button>
            </div>
          )}
        </div>

        <div>
          <label htmlFor={ids.prepTime} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Prep Time (min)</span>
            <InfoTooltip text="Slicing, bed prep, etc." />
          </label>
          <Input
            id={ids.prepTime}
            type="number"
            min="0"
            compact
            value={prepTimeMinutes || ''}
            onChange={e => onPrepTimeMinutesChange(Math.max(parseInt(e.target.value) || 0, 0))}
            placeholder="0"
          />
        </div>

        <div>
          <label htmlFor={ids.postProcessing} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Post-Processing (min)</span>
            <InfoTooltip text="Support removal, sanding, etc." />
          </label>
          <Input
            id={ids.postProcessing}
            type="number"
            min="0"
            compact
            value={postProcessingMinutes || ''}
            onChange={e => onPostProcessingMinutesChange(Math.max(parseInt(e.target.value) || 0, 0))}
            placeholder="0"
          />
        </div>

        {/* Phase 39 TOU-02: print-start-time picker — renders ONLY when the
            user has configured TOU bands in Settings. Empty value = flat rate. */}
        {touBandsConfigured && (
          <div>
            <label htmlFor="tou-start-time" className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <span>Print Start Time</span>
              <InfoTooltip text="Used to price electricity against your configured time-of-use rate bands. Leave blank to use the flat rate." />
            </label>
            <Input
              id="tou-start-time"
              type="text"
              placeholder="22:00"
              maxLength={5}
              compact
              value={touStartTime ?? ''}
              onChange={e => onTouStartTimeChange?.(e.target.value || undefined)}
            />
            {/* WR-09: without this, an invalid time (e.g. "9:30" — the strict
                parser requires zero-padded HH:MM) silently prices the job at
                the flat rate and persists onto the saved job. */}
            <FieldWarning
              message={
                touStartTime && parseHHMM(touStartTime) === null
                  ? 'Enter time as HH:MM (e.g. 09:30) — the flat rate is used until this is valid.'
                  : null
              }
            />
            {touSavingsHint && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                <span>
                  Cheapest start: {touSavingsHint.cheapestStart} (save {currencySymbol}{touSavingsHint.saving.toFixed(2)})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Phase 39 WEAR-02 (D-14): manual maintenance-cost input — a NEW
            field (no prior maintenance-cost input existed on this form). */}
        <div>
          <label htmlFor="maintenance-cost-per-hour" className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Maintenance ({currencySymbol}/hr)</span>
            <InfoTooltip text="An optional manual maintenance cost per print hour, added as its own labeled cost line." />
          </label>
          <Input
            id="maintenance-cost-per-hour"
            type="number"
            decimals={2}
            step="0.01"
            min="0"
            compact
            value={maintenanceCostPerHour || ''}
            onChange={e => onMaintenanceCostPerHourChange?.(Math.max(parseFloat(e.target.value) || 0, 0))}
            placeholder="0.00"
          />
          {amortizedMaintenancePerHour && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <span>
                Amortized: {currencySymbol}{amortizedMaintenancePerHour.amortizedPerHour.toFixed(2)}/hr
              </span>
              <InfoTooltip text="Derived from this printer's logged maintenance history and cumulative print hours. Applying replaces the manual value above — it stays editable." />
              <Button
                variant="ghost"
                btnSize="sm"
                className="!px-2 !py-0.5 underline"
                onClick={onApplyAmortizedMaintenance}
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Post-Processing Materials */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Post-Processing Materials</h2>
          <div className="flex items-center gap-2">
            <Button
              btnSize="sm"
              onClick={onAddMaterialUsage}
              disabled={nonFilaments.length === 0}
            >
              + Add Material
            </Button>
            {/* Phase 47.1: never disabled — it must not inherit "+ Add Material"'s
                empty-library disable, since users with an empty library benefit most. */}
            <span className="relative inline-flex">
              <Button variant="secondary" btnSize="sm" onClick={onAddManualMaterial}>
                + One-off cost
              </Button>
              <NewBadge feature="manual-cost-lines" className="absolute -top-1.5 -right-1.5 pointer-events-none" />
            </span>
            <InfoTooltip text="Add a one-time cost that isn't in your asset library, like a tool bought for this job. The full amount is added to this job's cost once. Your failure rate doesn't increase it." />
          </div>
        </div>

        {materialsUsed.length === 0 && manualMaterials.length === 0 ? (
          <p className="text-slate-500 text-sm">No post-processing materials added yet.</p>
        ) : (
          <div className="space-y-2">
            {materialsUsed.map((usage, index) => {
              const material = materialsInProfile.find(m => m.id === usage.materialId);
              return (
                <div key={usage.uid} className="flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg">
                  <Select
                    value={usage.materialId}
                    onChange={e => onUpdateMaterialUsage(index, 'materialId', e.target.value)}
                    className="flex-1"
                  >
                    {nonFilaments.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={usage.quantity}
                      onChange={e => onUpdateMaterialUsage(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="text-right"
                    />
                    <span className="text-slate-400 text-sm w-12">{material?.unit || ''}</span>
                  </div>
                  <span className="text-slate-300 text-sm font-mono w-16 text-right">
                    {currencySymbol}{material ? (usage.quantity * (material.costPerUnit ?? 0)).toFixed(2) : '0.00'}
                  </span>
                  <RemoveButton
                    label={material?.name ?? 'material'}
                    onClick={() => onRemoveMaterialUsage(index)}
                  />
                </div>
              );
            })}
            {manualMaterials.map((line, index) => (
              <div
                key={line.id}
                role="group"
                aria-label={`One-off cost ${index + 1}${line.name ? `: ${line.name}` : ''}`}
                className="flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg"
              >
                <span className="text-xs text-slate-400 bg-slate-600/60 rounded px-2 py-0.5">One-off</span>
                <Input
                  type="text"
                  aria-label="One-off item name"
                  placeholder="Thread tap set"
                  value={line.name}
                  onChange={e => onUpdateManualMaterial(line.id, { name: e.target.value })}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">{currencySymbol}</span>
                  <Input
                    type="number"
                    decimals={2}
                    step="0.01"
                    min="0"
                    compact
                    aria-label="One-off item cost"
                    placeholder="0.00"
                    value={line.cost || ''}
                    onChange={e => onUpdateManualMaterial(line.id, { cost: Math.max(parseFloat(e.target.value) || 0, 0) })}
                    className="text-right"
                  />
                </div>
                <RemoveButton
                  label={line.name || 'one-off cost'}
                  onClick={() => onRemoveManualMaterial(line.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
