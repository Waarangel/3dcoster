import { memo } from 'react';
import type { Material, PrinterConfig, PrinterInstance, Currency } from '../../types';
import { FilamentSelector } from '../FilamentSelector';
import { GcodeImport } from '../GcodeImport';
import { NewBadge } from '../NewBadge';
import { Button, Input, Select, InfoTooltip } from '../ui';
import type { FilamentRow } from '../../hooks/useCostForm';

interface CostFormSectionProps {
  materials: Material[];
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  userCurrency: Currency;
  currencySymbol: string;
  printName: string;
  onPrintNameChange: (value: string) => void;
  selectedInstanceId: string;
  onSelectedInstanceIdChange: (value: string) => void;
  modelUrl: string;
  onModelUrlChange: (value: string) => void;
  modelCost: number;
  onModelCostChange: (value: number) => void;
  modelCostPerUnit: boolean;
  onModelCostPerUnitChange: (value: boolean) => void;
  authorMinPrice: number;
  onAuthorMinPriceChange: (value: number) => void;
  filamentRows: FilamentRow[];
  onAddFilamentRow: () => void;
  onRemoveFilamentRow: (index: number) => void;
  onUpdateFilamentRow: (index: number, patch: Partial<FilamentRow>) => void;
  onImportFilamentRows: (rows: FilamentRow[]) => void;
  onImportPrintTime: (hours: number) => void;
  onImportPrintName: (name: string) => void;
  stockByAssetId: Map<string, number>;
  editingJob: boolean;
  makeDefaultRow: (currency: Currency) => FilamentRow;
  nextRowKey: () => string;
  // Stable IDs for label<->input associations, passed down from the orchestrator
  // (WCAG 1.3.1 / 4.1.2) so every field keeps its useId-generated id.
  printNameId: string;
  printerSelectId: string;
  modelUrlId: string;
  modelCostId: string;
  authorMinPriceId: string;
  gramsBaseId: string;
}

/**
 * Print Job Details — G-code import, print name/printer identity, model
 * URL/cost/author-min-price, and the multi-filament row list. Props-in,
 * callbacks-out; no Dexie access, no business math (D-11).
 */
export const CostFormSection = memo(function CostFormSection({
  materials,
  printers,
  printerInstances,
  userCurrency,
  currencySymbol,
  printName,
  onPrintNameChange,
  selectedInstanceId,
  onSelectedInstanceIdChange,
  modelUrl,
  onModelUrlChange,
  modelCost,
  onModelCostChange,
  modelCostPerUnit,
  onModelCostPerUnitChange,
  authorMinPrice,
  onAuthorMinPriceChange,
  filamentRows,
  onAddFilamentRow,
  onRemoveFilamentRow,
  onUpdateFilamentRow,
  onImportFilamentRows,
  onImportPrintTime,
  onImportPrintName,
  stockByAssetId,
  editingJob,
  makeDefaultRow,
  nextRowKey,
  printNameId,
  printerSelectId,
  modelUrlId,
  modelCostId,
  authorMinPriceId,
  gramsBaseId,
}: CostFormSectionProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">Print Job Details</h2>

      {/* G-code Import */}
      <GcodeImport
        assets={materials}
        onImport={({ filaments, printTimeHours: time, printName: name }) => {
          if (time > 0) onImportPrintTime(time);
          if (name && !printName) onImportPrintName(name);
          if (filaments.length > 0) {
            const newRows: FilamentRow[] = filaments.map(f => {
              const asset = f.filamentId ? materials.find(m => m.id === f.filamentId) : null;
              return {
                uid: nextRowKey(),
                filamentId: f.filamentId ?? '',
                grams: f.grams,
                editedPrice: asset?.costPerUnit ?? 0,
                editedCurrency: asset?.currency ?? userCurrency,
              };
            });
            onImportFilamentRows(newRows.length > 0 ? newRows : [makeDefaultRow(userCurrency)]);
          }
        }}
      />

      <div className="space-y-4">
        {/* Identity row — Print Name takes 2/3, Printer takes 1/3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
          <div className="md:col-span-2">
            <label htmlFor={printNameId} className="block text-xs text-slate-400 mb-1">Print Name *</label>
            <Input
              id={printNameId}
              type="text"
              value={printName}
              onChange={e => onPrintNameChange(e.target.value)}
              placeholder="e.g., Dragon Figurine"
            />
          </div>

          <div>
            <label htmlFor={printerSelectId} className="block text-xs text-slate-400 mb-1">Printer</label>
            {printerInstances.length === 0 ? (
              <p className="text-yellow-400 text-sm">No printers set up. Go to Printer Settings to add one.</p>
            ) : (
              <Select
                id={printerSelectId}
                value={selectedInstanceId}
                onChange={e => onSelectedInstanceIdChange(e.target.value)}
              >
                {printerInstances.map(instance => {
                  const config = printers.find(p => p.id === instance.printerConfigId);
                  return (
                    <option key={instance.id} value={instance.id}>
                      {instance.nickname} ({config?.name || 'Unknown'}) - {instance.printHours.toFixed(1)}h
                    </option>
                  );
                })}
              </Select>
            )}
          </div>
        </div>

        {/* Model context row — URL flexes to fill, Cost + Author Min are compact. Wraps on narrow viewports. */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex-1 min-w-[220px] max-w-md">
            <label htmlFor={modelUrlId} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <span>Model URL</span>
              <InfoTooltip text="Save the source link so you can find it again later (works for free models too)" />
              <NewBadge feature="model-url" />
            </label>
            <Input
              id={modelUrlId}
              type="url"
              value={modelUrl}
              onChange={e => onModelUrlChange(e.target.value)}
              placeholder="https://makerworld.com/..."
            />
          </div>

          <div>
            <label htmlFor={modelCostId} className="block text-xs text-slate-400 mb-1">Model Cost ({currencySymbol})</label>
            <Input
              id={modelCostId}
              type="number"
              step="0.01"
              min="0"
              compact
              value={modelCost || ''}
              onChange={e => onModelCostChange(Math.max(parseFloat(e.target.value) || 0, 0))}
              placeholder="0"
            />
            {/* Per-unit toggle slot — reserved at all times so the row never shifts.
                Visibility (not display) is toggled so the label still occupies its space. */}
            <label
              className={`flex items-center gap-2 mt-2 cursor-pointer ${modelCost > 0 ? '' : 'invisible'}`}
              aria-hidden={modelCost > 0 ? undefined : true}
            >
              {/* allow-raw-html: checkbox uses accent-blue + custom border styling not covered by Input primitive */}
              <input
                type="checkbox"
                checked={modelCostPerUnit}
                onChange={e => onModelCostPerUnitChange(e.target.checked)}
                tabIndex={modelCost > 0 ? 0 : -1}
                className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
              />
              <span className="text-xs text-slate-400">Per-unit license</span>
            </label>
          </div>

          <div>
            <label htmlFor={authorMinPriceId} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <span>Author Min Price ({currencySymbol})</span>
              <InfoTooltip text="Warn if selling below this" />
            </label>
            <Input
              id={authorMinPriceId}
              type="number"
              step="0.01"
              compact
              value={authorMinPrice || ''}
              onChange={e => onAuthorMinPriceChange(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Multi-Filament Rows */}
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">Filaments *</label>

          {filamentRows.map((row, index) => {
            // Stock hint (new jobs only — an edited job's grams are already in the ledger,
            // so comparing against post-deduction stock would double-count).
            const stock = row.filamentId ? stockByAssetId.get(row.filamentId) : undefined;
            const short = !editingJob && stock != null && row.grams > 0 && stock < row.grams;
            return (
            <div key={row.uid} className="bg-slate-700/30 p-3 rounded-lg">
              <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <FilamentSelector
                  materials={materials}
                  selectedFilamentId={row.filamentId}
                  onSelect={(filament) => onUpdateFilamentRow(index, {
                    filamentId: filament.id,
                    editedPrice: filament.costPerUnit ?? 0,
                    editedCurrency: filament.currency || userCurrency,
                  })}
                  onPriceChange={(price) => onUpdateFilamentRow(index, { editedPrice: price })}
                  onCurrencyChange={(currency) => onUpdateFilamentRow(index, { editedCurrency: currency })}
                />
              </div>
              <div className="shrink-0 w-[196px]">
                <label htmlFor={`${gramsBaseId}-${index}`} className="block text-xs text-slate-400 mb-1">Grams</label>
                <div className="flex gap-1 items-center">
                  <Input
                    id={`${gramsBaseId}-${index}`}
                    type="number"
                    min="0"
                    value={row.grams || ''}
                    onChange={e => onUpdateFilamentRow(index, { grams: Math.max(parseFloat(e.target.value) || 0, 0) })}
                    placeholder="g"
                    className="w-24"
                  />
                  {index === filamentRows.length - 1 && filamentRows.length < 16 && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onAddFilamentRow}
                      className="w-[44px] h-[44px] !px-0 !py-0 shrink-0"
                      aria-label="Add filament row"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Button>
                  )}
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onRemoveFilamentRow(index)}
                      className="w-[44px] h-[44px] !px-0 !py-0 shrink-0 text-red-400 hover:text-red-300"
                      aria-label="Remove filament row"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
              </div>
              {short && (
                <p className="mt-2 text-xs text-amber-400 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>
                    {stock != null && stock <= 0
                      ? `Out of stock — this print needs ${Math.round(row.grams)} g.`
                      : `Only ${Math.round(stock ?? 0)} g left in stock — ${Math.round(row.grams - (stock ?? 0))} g short for this print.`}
                  </span>
                </p>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
