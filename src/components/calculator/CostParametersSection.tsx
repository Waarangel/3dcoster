import { memo } from 'react';
import type { Material, MaterialUsage } from '../../types';
import { Button, Input, RemoveButton, Select, InfoTooltip } from '../ui';
import type { MaterialRow } from '../../hooks/useCostForm';
import type { CalculatorFieldIds } from './fieldIds';

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
  ids: CalculatorFieldIds;
}

/**
 * Print parameters (time / failure rate / prep / post-processing minutes) +
 * Post-Processing Materials list. Props-in, callbacks-out; no Dexie access,
 * no business math (D-11). Per D-10, this is the section Phase 39's
 * failure/TOU/wear inputs attach to as ordinary additions — no speculative
 * extension props are added ahead of that need.
 */
export const CostParametersSection = memo(function CostParametersSection({
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
  ids,
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
      </div>

      {/* Post-Processing Materials */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Post-Processing Materials</h2>
          <Button
            btnSize="sm"
            onClick={onAddMaterialUsage}
            disabled={nonFilaments.length === 0}
          >
            + Add Material
          </Button>
        </div>

        {materialsUsed.length === 0 ? (
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
          </div>
        )}
      </div>
    </>
  );
});
