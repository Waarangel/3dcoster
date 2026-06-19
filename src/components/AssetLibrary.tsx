import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import type { Asset, AssetCategory, BuiltInCategory, Currency } from '../types';
import { convert, type FxRateTable } from '../utils/fxConvert';
import { downloadCsv, generateExportCsv } from '../utils/csvHelpers';
import { buildExportFilename } from '../utils/jobsExport';
import { CsvImportModal } from './CsvImportModal';
import { NewBadge } from './NewBadge';
import { StockBadge } from './inventory/StockBadge';
import { LowStockBar } from './inventory/LowStockBar';
import { useStockEvents } from '../hooks/useStockEvents';
import { Button, EditButton, DeleteButton, Input, Select, EmptyState, Skeleton, shouldShowEmptyState } from './ui';
import { InfoTooltip } from './ui/InfoTooltip';
import { PackageIcon } from './ui/icons';

interface AssetLibraryProps {
  assets: Asset[];
  isLoading: boolean;
  onAddAsset: (asset: Asset) => void;
  onUpdateAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
  onBulkImportAssets: (assets: Asset[]) => Promise<void>;
  onResetMaterials: () => void;
  onResetPrinters: () => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  userCurrency: Currency;
  fxTable: FxRateTable | null;
  loadError?: string | null;
}

function AssetListSkeleton() {
  return (
    <>
      {/* Mobile cards — 3 placeholder cards */}
      <div className="md:hidden space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton variant="line" width="w-32" />
              <Skeleton variant="line" width="w-16" height="h-5" rounded="rounded-full" />
            </div>
            <Skeleton variant="line" width="w-24" />
            <Skeleton variant="line" width="w-full" />
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
              <Skeleton variant="line" />
              <Skeleton variant="line" />
              <Skeleton variant="line" />
              <Skeleton variant="line" />
            </div>
            {/* IN-02: mirror the real mobile card's action-row divider
                (see the action-button row in the real card render). Without
                the border-t the skeleton's two button placeholders float
                while the real version is sectioned — a small but visible
                shape mismatch that D-03 calls out as a co-location bug. */}
            <div className="flex gap-2 pt-2 border-t border-slate-700/50">
              <Skeleton variant="line" height="h-9" className="flex-1" />
              <Skeleton variant="line" height="h-9" className="flex-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table — 5 placeholder rows.
          IN-01: matches the worst-case (printer) column count of 7
          (Printer / Brand / Type / Price / Wattage / Nozzle / Actions). The
          materials table has 6 columns; rendering 7 here means the skeleton
          may show one extra placeholder column on the materials tab for a
          frame or two, but the printer tab — which previously dropped the
          Actions column placeholder entirely — now matches the real shape. */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left border-b border-slate-700">
              <th className="pb-2 font-medium"><Skeleton variant="line" width="w-20" /></th>
              <th className="pb-2 font-medium"><Skeleton variant="line" width="w-16" /></th>
              <th className="pb-2 font-medium"><Skeleton variant="line" width="w-12" /></th>
              <th className="pb-2 font-medium text-right"><Skeleton variant="line" width="w-16" className="ml-auto" /></th>
              <th className="pb-2 font-medium text-right"><Skeleton variant="line" width="w-16" className="ml-auto" /></th>
              <th className="pb-2 font-medium text-right"><Skeleton variant="line" width="w-16" className="ml-auto" /></th>
              <th className="pb-2 font-medium text-right"><Skeleton variant="line" width="w-16" className="ml-auto" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {[0, 1, 2, 3, 4].map(i => (
              <tr key={i}>
                <td className="py-2"><Skeleton variant="line" width="w-32" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-24" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-16" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-20" className="ml-auto" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-20" className="ml-auto" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-20" className="ml-auto" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-24" className="ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Built-in category labels
const builtInCategoryLabels: Record<BuiltInCategory, string> = {
  filament: 'Filament',
  consumable: 'Consumables',
  finishing: 'Finishing',
  tool: 'Tools',
  packaging: 'Packaging',
  printer: 'Printers',
};

// Built-in category colors
const builtInCategoryColors: Record<BuiltInCategory, string> = {
  filament: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  consumable: 'bg-green-500/20 text-green-400 border-green-500/30',
  finishing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tool: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  packaging: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  printer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

// Default color for custom categories
const customCategoryColor = 'bg-pink-500/20 text-pink-400 border-pink-500/30';

const builtInCategories: BuiltInCategory[] = ['filament', 'consumable', 'finishing', 'tool', 'packaging', 'printer'];

// Helper functions
function getCategoryLabel(category: AssetCategory): string {
  if (category in builtInCategoryLabels) {
    return builtInCategoryLabels[category as BuiltInCategory];
  }
  // Capitalize first letter of custom category
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function getCategoryColor(category: AssetCategory): string {
  if (category in builtInCategoryColors) {
    return builtInCategoryColors[category as BuiltInCategory];
  }
  return customCategoryColor;
}

// ---------------------------------------------------------------------------
// Module-scope row components (CR-01 fix). Stable identity across parent
// renders so react-window's internal memo wrapper caches correctly and rows
// only re-render when their own props change. Closures (onEdit, onDelete)
// are passed in via rowProps for the virtualized branch and as direct props
// for the small-list branch.
// ---------------------------------------------------------------------------

// Stock is consumed in grams (filament) or each asset's own unit, but filament is
// bought/counted in SPOOLS. So for filament we show + enter spools (each spool =
// unitsPerPackage grams) and convert to grams (the consumption unit) behind the
// scenes; everything else uses its own unit. `perUnit` is grams-per-spool (or 1).
function stockUnit(asset: Pick<Asset, 'category' | 'unit' | 'unitsPerPackage'>): { unit: string; perUnit: number } {
  if (asset.category === 'filament' && asset.unitsPerPackage && asset.unitsPerPackage > 0) {
    return { unit: 'spools', perUnit: asset.unitsPerPackage };
  }
  return { unit: asset.unit || 'units', perUnit: 1 };
}

type AssetRowCallbacks = {
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  userCurrency: Currency;
  fxTable: FxRateTable | null;
  // v1.8 inventory: derived current stock per asset id. Optional so the printer
  // row path (which never shows stock) needs no threading.
  stockByAssetId?: ReadonlyMap<string, number>;
};

// Convert a stored price into the user's currency for display. Returns the
// formatted number plus the currency CODE to show — the profile currency
// normally, or the asset's native currency when no rate is cached yet (offline,
// before the first fetch), in which case the native amount is shown honestly
// rather than a guessed number. The code is rendered separately and AFTER the
// number (see PriceCell) so codes line up in a straight vertical column instead
// of floating before each value. ISO code, not symbol — CAD/USD/AUD share "$".
function convertForDisplay(
  amount: number,
  native: Currency | undefined,
  userCurrency: Currency,
  fxTable: FxRateTable | null,
  decimals: number,
): { value: string; code: Currency } {
  const from = native ?? userCurrency;
  const converted = convert(amount, from, userCurrency, fxTable);
  return converted === null
    ? { value: amount.toFixed(decimals), code: from }
    : { value: converted.toFixed(decimals), code: userCurrency };
}

// A price cell: right-aligned number with an optional `/unit` suffix and a muted
// trailing currency code. Putting the code last keeps the codes aligned at the
// cell's right edge so the column reads as a straight vertical, not a snake.
function PriceCell({
  amount,
  native,
  userCurrency,
  fxTable,
  decimals,
  unit,
}: {
  amount: number;
  native: Currency | undefined;
  userCurrency: Currency;
  fxTable: FxRateTable | null;
  decimals: number;
  unit?: string;
}) {
  const { value, code } = convertForDisplay(amount, native, userCurrency, fxTable, decimals);
  return (
    <>
      {value}{unit ? `/${unit}` : ''} <span className="text-slate-500">{code}</span>
    </>
  );
}

type AssetRowPropsForList = {
  assets: Asset[];
} & AssetRowCallbacks;

// --- Mobile card (Asset) ---
const MobileCardItem = memo(function MobileCardItem({
  asset,
  style,
  onEdit,
  onDelete,
  userCurrency,
  fxTable,
  stockByAssetId,
}: { asset: Asset; style?: React.CSSProperties } & AssetRowCallbacks) {
  const stock = stockByAssetId?.get(asset.id) ?? null;
  const su = stockUnit(asset);
  return (
    <div
      role="listitem"
      style={style}
      className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-base font-medium text-white truncate">
            {asset.name}
          </span>
          {asset.category === 'printer' ? (
            <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${getCategoryColor(asset.category)}`}>
              {getCategoryLabel(asset.category)}
            </span>
          ) : asset.category === 'filament' && asset.filamentType ? (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              {asset.filamentType}
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${getCategoryColor(asset.category)}`}>
              {getCategoryLabel(asset.category)}
            </span>
          )}
        </div>
      </div>

      {asset.brand && (
        <div className="text-sm text-slate-400 mb-1">{asset.brand}</div>
      )}

      {asset.notes && (
        <div className="text-sm text-slate-400 mb-2">{asset.notes}</div>
      )}

      {asset.tags && asset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {asset.tags.map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
              {tag}
            </span>
          ))}
        </div>
      )}

      {asset.category === 'printer' ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3 pt-2 border-t border-slate-700/50">
          <div className="text-slate-400">Price</div>
          <div className="text-right font-mono text-white">
            <PriceCell amount={asset.purchasePrice ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={2} />
          </div>
          <div className="text-slate-400">Wattage</div>
          <div className="text-right font-mono text-white">
            {asset.wattage || 0}W
          </div>
          <div className="text-slate-400">Nozzle Cost</div>
          <div className="text-right font-mono text-slate-400">
            <PriceCell amount={asset.nozzleCost ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={2} />
          </div>
          {asset.expectedLifespanHours && (
            <>
              <div className="text-slate-400">Lifespan</div>
              <div className="text-right font-mono text-slate-400">
                {asset.expectedLifespanHours.toLocaleString()}h
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-700/50 mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-slate-400">Cost/Unit</span>
            <span className="text-base font-mono font-medium text-white">
              <PriceCell amount={asset.costPerUnit ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={3} unit={asset.unit} />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-400">Package</span>
            <span className="text-sm font-mono text-slate-400">
              <PriceCell amount={asset.packageCost ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={2} />
            </span>
          </div>
          {asset.lifespanUnits && (
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm text-slate-400">Lifespan</span>
              <span className="text-sm font-mono text-slate-400">
                {asset.lifespanUnits.toLocaleString()} uses
              </span>
            </div>
          )}
          {stock != null && (
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm text-slate-400">In stock</span>
              <StockBadge stock={stock == null ? null : stock / su.perUnit} threshold={asset.lowStockThreshold == null ? undefined : asset.lowStockThreshold / su.perUnit} unit={su.unit} />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-700/50 justify-end">
        <EditButton label={asset.name} onClick={() => onEdit(asset)} />
        <DeleteButton label={asset.name} onClick={() => onDelete(asset.id)} />
      </div>
    </div>
  );
});

const MobileCardRow = ({ index, style, assets, onEdit, onDelete, userCurrency, fxTable, stockByAssetId }: RowComponentProps<AssetRowPropsForList>) => (
  <MobileCardItem asset={assets[index]} style={style} onEdit={onEdit} onDelete={onDelete} userCurrency={userCurrency} fxTable={fxTable} stockByAssetId={stockByAssetId} />
);

// --- Printer row (div-grid; 7 columns) ---
const PrinterRow = memo(function PrinterRow({
  asset,
  style,
  onEdit,
  onDelete,
  userCurrency,
  fxTable,
}: { asset: Asset; style?: React.CSSProperties } & AssetRowCallbacks) {
  return (
    <div
      role="row"
      style={style}
      className="grid grid-cols-7 gap-x-4 py-2 text-slate-300 border-b border-slate-700/50 items-start"
    >
      <div role="cell">
        <div>{asset.name}</div>
        {asset.notes && (
          <div className="text-xs text-slate-500">{asset.notes}</div>
        )}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {asset.tags.map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div role="cell" className="text-slate-400">
        {asset.brand || '-'}
      </div>
      <div role="cell">
        <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(asset.category)}`}>
          {getCategoryLabel(asset.category)}
        </span>
      </div>
      <div role="cell" className="text-right font-mono">
        <PriceCell amount={asset.purchasePrice ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={2} />
      </div>
      <div role="cell" className="text-right font-mono">
        {asset.wattage || 0}W
      </div>
      <div role="cell" className="text-right font-mono text-slate-400">
        <PriceCell amount={asset.nozzleCost ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={2} />
      </div>
      <div role="cell" className="text-right">
        <EditButton label={asset.name} onClick={() => onEdit(asset)} className="mr-1" />
        <DeleteButton label={asset.name} onClick={() => onDelete(asset.id)} />
      </div>
    </div>
  );
});

const PrinterRowAdapter = ({ index, style, assets, onEdit, onDelete, userCurrency, fxTable }: RowComponentProps<AssetRowPropsForList>) => (
  <PrinterRow asset={assets[index]} style={style} onEdit={onEdit} onDelete={onDelete} userCurrency={userCurrency} fxTable={fxTable} />
);

// --- Material row (div-grid; 6 columns) ---
const MaterialRow = memo(function MaterialRow({
  asset,
  style,
  onEdit,
  onDelete,
  userCurrency,
  fxTable,
  stockByAssetId,
}: { asset: Asset; style?: React.CSSProperties } & AssetRowCallbacks) {
  const stock = stockByAssetId?.get(asset.id) ?? null;
  const su = stockUnit(asset);
  return (
    <div
      role="row"
      style={style}
      className="grid grid-cols-6 gap-x-4 py-2 text-slate-300 border-b border-slate-700/50 items-start"
    >
      <div role="cell">
        <div>{asset.name}</div>
        {asset.notes && (
          <div className="text-xs text-slate-500">{asset.notes}</div>
        )}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {asset.tags.map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
                {tag}
              </span>
            ))}
          </div>
        )}
        {stock != null && (
          <div className="mt-1"><StockBadge stock={stock == null ? null : stock / su.perUnit} threshold={asset.lowStockThreshold == null ? undefined : asset.lowStockThreshold / su.perUnit} unit={su.unit} /></div>
        )}
      </div>
      <div role="cell" className="text-slate-400">
        {asset.brand || '-'}
      </div>
      <div role="cell">
        {asset.category === 'filament' && asset.filamentType ? (
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {asset.filamentType}
          </span>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(asset.category)}`}>
            {getCategoryLabel(asset.category)}
          </span>
        )}
      </div>
      <div role="cell" className="text-right font-mono">
        <PriceCell amount={asset.costPerUnit ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={3} unit={asset.unit} />
      </div>
      <div role="cell" className="text-right font-mono text-slate-400">
        <PriceCell amount={asset.packageCost ?? 0} native={asset.currency} userCurrency={userCurrency} fxTable={fxTable} decimals={2} />
      </div>
      <div role="cell" className="text-right">
        <EditButton label={asset.name} onClick={() => onEdit(asset)} className="mr-1" />
        <DeleteButton label={asset.name} onClick={() => onDelete(asset.id)} />
      </div>
    </div>
  );
});

const MaterialRowAdapter = ({ index, style, assets, onEdit, onDelete, userCurrency, fxTable, stockByAssetId }: RowComponentProps<AssetRowPropsForList>) => (
  <MaterialRow asset={assets[index]} style={style} onEdit={onEdit} onDelete={onDelete} userCurrency={userCurrency} fxTable={fxTable} stockByAssetId={stockByAssetId} />
);

const SortIndicator = ({ field, sortField, sortDirection }: { field: string; sortField: string; sortDirection: 'asc' | 'desc' }) => {
  if (sortField !== field) return null;
  return <span className="ml-1 text-[0.6em] align-middle">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
};

export function AssetLibrary({
  assets,
  isLoading,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
  onBulkImportAssets,
  onResetMaterials,
  onResetPrinters,
  itemsPerPage,
  onItemsPerPageChange,
  userCurrency,
  fxTable,
  loadError,
}: AssetLibraryProps) {
  // Stable per-instance ids wiring each form <label> to its input (WCAG 1.3.1 /
  // 4.1.2). Declared once at the top — this is a single-instance form, not a
  // loop — so the same id is reused whether the printer or material variant
  // renders.
  const nameId = useId();
  const categoryId = useId();
  const brandId = useId();
  const unitId = useId();
  const packageCostId = useId();
  const unitsPerPackageId = useId();
  const lifespanUnitsId = useId();
  const purchasePriceId = useId();
  const wattageId = useId();
  const expectedLifespanHoursId = useId();
  const nozzleCostId = useId();
  const nozzleLifespanId = useId();
  const notesId = useId();
  const tagsId = useId();
  const stockOnHandId = useId();
  const lowStockThresholdId = useId();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'all'>('all');
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [formData, setFormData] = useState<Partial<Asset>>({
    category: 'consumable',
  });
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Live inventory (v1.8): current stock per asset, shown as a StockBadge on each
  // material row. The threshold + manual stock level are set in the edit form.
  const { stockByAssetId, logManualAdjustment } = useStockEvents();
  // "Stock on hand" form field (transient — stock lives in the ledger, not the
  // asset). Pre-filled with the current derived stock when an edit opens; only
  // depends on editingId so it doesn't fight the user when the ledger updates.
  const [stockOnHandInput, setStockOnHandInput] = useState('');
  useEffect(() => {
    const asset = editingId ? assets.find(a => a.id === editingId) : undefined;
    const grams = editingId ? stockByAssetId.get(editingId) : undefined;
    // Pre-fill in the asset's display unit (grams ÷ grams-per-spool for filament).
    setStockOnHandInput(asset && grams != null ? String(grams / stockUnit(asset).perUnit) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);
  // Display unit for the stock fields, derived from the in-progress form values.
  const formStockUnit = stockUnit({ category: formData.category as AssetCategory, unit: formData.unit, unitsPerPackage: formData.unitsPerPackage });

  // Get all unique categories from assets (built-in + custom)
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>(builtInCategories);
    assets.forEach(a => categorySet.add(a.category));
    return Array.from(categorySet);
  }, [assets]);

  const filteredAssets = filterCategory === 'all'
    ? assets
    : assets.filter(a => a.category === filterCategory);

  // For display, separate printers and materials when showing "all"
  const displayAssets = filterCategory === 'all'
    ? filteredAssets.filter(a => a.category !== 'printer')  // Materials only for "all" view
    : filteredAssets;

  // Search filtering
  const searchedAssets = useMemo(() => {
    if (!searchQuery.trim()) return displayAssets;
    const q = searchQuery.toLowerCase();
    return displayAssets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.brand || '').toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q) ||
      (a.filamentType || '').toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q)) ||
      getCategoryLabel(a.category).toLowerCase().includes(q)
    );
  }, [displayAssets, searchQuery]);

  // Sorting
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedAssets = useMemo(() => {
    const sorted = [...searchedAssets];
    sorted.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'brand':
          aVal = (a.brand || '').toLowerCase();
          bVal = (b.brand || '').toLowerCase();
          break;
        case 'category':
          aVal = getCategoryLabel(a.category).toLowerCase();
          bVal = getCategoryLabel(b.category).toLowerCase();
          break;
        case 'costPerUnit':
          aVal = a.costPerUnit ?? 0;
          bVal = b.costPerUnit ?? 0;
          break;
        case 'packageCost':
          aVal = a.packageCost ?? 0;
          bVal = b.packageCost ?? 0;
          break;
        case 'purchasePrice':
          aVal = a.purchasePrice ?? 0;
          bVal = b.purchasePrice ?? 0;
          break;
        case 'wattage':
          aVal = a.wattage ?? 0;
          bVal = b.wattage ?? 0;
          break;
        case 'nozzleCost':
          aVal = a.nozzleCost ?? 0;
          bVal = b.nozzleCost ?? 0;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [searchedAssets, sortField, sortDirection]);

  // Pagination - itemsPerPage of 0 means show all
  const effectiveItemsPerPage = itemsPerPage === 0 ? sortedAssets.length : itemsPerPage;
  const totalPages = effectiveItemsPerPage > 0 ? Math.ceil(sortedAssets.length / effectiveItemsPerPage) : 1;
  const paginatedAssets = itemsPerPage === 0
    ? sortedAssets
    : sortedAssets.slice(
        (currentPage - 1) * effectiveItemsPerPage,
        currentPage * effectiveItemsPerPage
      );

  // Reset to page 1 when filter or items per page changes, and cancel any in-progress add/edit
  const handleFilterChange = (category: AssetCategory | 'all') => {
    setFilterCategory(category);
    setSearchQuery('');
    setCurrentPage(1);
    // Auto-cancel any in-progress add/edit when switching filters
    if (isAdding) {
      setFormData({ category: 'consumable' });
      setEditingId(null);
      setIsAdding(false);
      setShowCustomCategory(false);
      setCustomCategoryInput('');
    }
  };

  const handleItemsPerPageChange = (value: number) => {
    onItemsPerPageChange(value);
    setCurrentPage(1);
  };

  const isPrinterForm = formData.category === 'printer';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Handle custom category
    const finalCategory = showCustomCategory && customCategoryInput.trim()
      ? customCategoryInput.trim().toLowerCase()
      : formData.category;

    if (isPrinterForm) {
      // Printer validation
      if (!formData.name || !formData.purchasePrice || !formData.wattage) {
        setFormError('Name, purchase price, and wattage are required');
        return;
      }
      setFormError(null);

      const printer: Asset = {
        id: editingId || `printer-${Date.now()}`,
        name: formData.name,
        category: 'printer',
        brand: formData.brand,
        notes: formData.notes,
        tags: formData.tags,
        purchasePrice: formData.purchasePrice,
        expectedLifespanHours: formData.expectedLifespanHours || 5000,
        wattage: formData.wattage,
        nozzleCost: formData.nozzleCost || 10,
        nozzleLifespanCm3: formData.nozzleLifespanCm3 || 15000,
      };

      if (editingId) {
        onUpdateAsset(printer);
        setEditingId(null);
      } else {
        onAddAsset(printer);
      }
    } else {
      // Material validation
      if (!formData.name || !formData.unit || !formData.packageCost || !formData.unitsPerPackage) {
        setFormError('Name, unit, package cost, and units per package are required');
        return;
      }
      if (formData.unitsPerPackage <= 0) {
        setFormError('Units per package must be greater than zero');
        return;
      }
      setFormError(null);

      const material: Asset = {
        id: editingId || `material-${Date.now()}`,
        name: formData.name,
        category: finalCategory as AssetCategory,
        unit: formData.unit,
        costPerUnit: formData.packageCost / formData.unitsPerPackage,
        unitsPerPackage: formData.unitsPerPackage,
        packageCost: formData.packageCost,
        lifespanUnits: formData.lifespanUnits,
        lowStockThreshold: formData.lowStockThreshold,
        notes: formData.notes,
        brand: formData.brand,
        filamentType: formData.filamentType,
        currency: formData.currency ?? userCurrency,
        tags: formData.tags,
      };

      if (editingId) {
        onUpdateAsset(material);
        setEditingId(null);
      } else {
        onAddAsset(material);
      }
      // v1.8: set stock on hand to the entered value via a ledger adjustment
      // (delta from current derived stock). Empty input = leave stock untouched.
      if (stockOnHandInput.trim() !== '') {
        const target = parseFloat(stockOnHandInput);
        if (Number.isFinite(target)) {
          const targetBase = target * formStockUnit.perUnit; // spools → grams (×1 otherwise)
          const delta = targetBase - (stockByAssetId.get(material.id) ?? 0);
          if (delta !== 0) void logManualAdjustment(material.id, delta, 'Set in Asset Library');
        }
      }
      setStockOnHandInput('');
    }

    setFormData({ category: 'consumable' });
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    setTagInput('');
    setIsAdding(false);
  };

  // Stable identity so React.memo on the row components can skip unchanged rows.
  const startEdit = useCallback((asset: Asset) => {
    setFormData(asset);
    setEditingId(asset.id);
    setIsAdding(true);
    if (!builtInCategories.includes(asset.category as BuiltInCategory)) {
      setShowCustomCategory(true);
      setCustomCategoryInput(asset.category);
    }
  }, []);

  const addTag = () => {
    if (!tagInput.trim()) return;
    const newTag = tagInput.trim().toLowerCase();
    const currentTags = formData.tags || [];
    if (!currentTags.includes(newTag)) {
      setFormData({ ...formData, tags: [...currentTags, newTag] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: (formData.tags || []).filter(t => t !== tag) });
  };

  const startAdding = () => {
    // Pre-select category based on current filter
    const defaultCategory = filterCategory === 'all' ? 'consumable' : filterCategory;
    setFormData({ category: defaultCategory });
    setEditingId(null);
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    setIsAdding(true);
  };

  // Empty-state CTA opens the Add form pre-selected to a specific category so
  // the form matches the empty-state copy. WR-02: previously this was hardwired
  // to 'filament', which mismatched the user's intent when they sat on the
  // 'printer' tab with zero printers and were told to "Add Material". We now
  // route by filterCategory: on the 'printer' tab, seed 'printer'; on 'all'
  // (canonical empty-library surface) or any other tab, seed 'filament' as the
  // friendly first-asset default unless the active filter is a specific
  // (non-printer, non-'all') category, in which case seed that category.
  const startAddingForEmptyState = () => {
    const seedCategory: AssetCategory =
      filterCategory === 'all' ? 'filament' : filterCategory;
    setFormData({ category: seedCategory });
    setEditingId(null);
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setFormData({ category: 'consumable' });
    setEditingId(null);
    setIsAdding(false);
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    setTagInput('');
    setFormError(null);
  };

  const handleReset = async () => {
    setResetError(null);
    try {
      if (filterCategory === 'printer') {
        if (window.confirm('Reset all printers to defaults? This will replace your custom printers with the default printer list.')) {
          await onResetPrinters();
        }
      } else {
        if (window.confirm('Reset all materials to defaults? This will replace your current materials with the default list.')) {
          await onResetMaterials();
        }
      }
    } catch {
      setResetError('Could not reset — please try again.');
    }
  };

  // Export-what-you-see: the active category filter and search scope the
  // export, mirroring the Reset button's filter-scoped behavior in the same
  // toolbar. Unfiltered "all" exports the full library including printers
  // (searchedAssets excludes printers in the "all" view, so it is only used
  // while a search is active — i.e. when the visible list excludes them too).
  const exportableAssets = searchQuery.trim() ? searchedAssets : filteredAssets;
  const exportScope = searchQuery.trim()
    ? 'filtered'
    : filterCategory !== 'all' ? filterCategory : undefined;

  const handleExportCsv = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      downloadCsv(await generateExportCsv(exportableAssets), buildExportFilename('assets', exportScope));
    } catch (err) {
      console.error('Assets CSV export failed:', err);
      setExportError('Could not export assets to CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [exportableAssets, exportScope, isExporting]);

  const sortHeaderClass = 'pb-2 font-medium cursor-pointer hover:text-slate-200 transition-colors select-none';

  // Inventory header signals (v1.8): low-stock list + a one-time first-run nudge.
  const lowStockAssets = useMemo(
    () => assets
      .filter(a => {
        if (a.category === 'printer') return false;
        const s = stockByAssetId.get(a.id);
        if (s == null) return false;
        return s <= 0 || (a.lowStockThreshold != null && s <= a.lowStockThreshold);
      })
      .map(a => ({ id: a.id, name: a.name })),
    [assets, stockByAssetId]
  );
  const [stockPromptDismissed, setStockPromptDismissed] = useState(() => {
    try { return localStorage.getItem('inventory-prompt-dismissed') === '1'; } catch { return false; }
  });
  // Show only before any stock is tracked, and only when there are materials to track.
  const showStockPrompt = !stockPromptDismissed && stockByAssetId.size === 0 && assets.some(a => a.category !== 'printer');
  const dismissStockPrompt = () => {
    try { localStorage.setItem('inventory-prompt-dismissed', '1'); } catch { /* private mode — just dismiss for the session */ }
    setStockPromptDismissed(true);
  };

  // Dynamic row-height caches (CR-02 fix). Numeric rowHeight clipped rows
  // with notes/tags/lifespan content; useDynamicRowHeight measures the
  // actual rendered height per row. defaultRowHeight values match the
  // observed common case so initial render before measurement is close.
  const mobileCardHeightCache = useDynamicRowHeight({ defaultRowHeight: 240 });
  const printerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 64 });
  const materialRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 64 });

  // Stable rowProps for each List so react-window's shallow comparison can
  // skip unchanged rows. Same object shape feeds all three lists; only the
  // identity changes when paginatedAssets/startEdit/onDeleteAsset rotate.
  const listRowProps = useMemo<AssetRowPropsForList>(
    () => ({ assets: paginatedAssets, onEdit: startEdit, onDelete: onDeleteAsset, userCurrency, fxTable, stockByAssetId }),
    [paginatedAssets, startEdit, onDeleteAsset, userCurrency, fxTable, stockByAssetId]
  );

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      {loadError && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-3">
          {loadError}
        </div>
      )}
      {showStockPrompt && (
        <div role="status" className="mb-3 flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-sm text-blue-200">
          <div className="flex-1">
            <strong className="text-blue-100">Track your material stock.</strong> Add a “Stock on hand” amount when you edit a filament or supply — 3DCoster deducts it as you log jobs and flags anything running low.
          </div>
          <Button variant="ghost" btnSize="sm" onClick={dismissStockPrompt} aria-label="Dismiss" className="shrink-0 text-blue-300 hover:text-blue-100">✕</Button>
        </div>
      )}
      <LowStockBar lowAssets={lowStockAssets} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-white">Asset Library</h2>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {!isAdding && (
            <>
              <Button
                variant="secondary"
                btnSize="sm"
                onClick={() => setShowCsvImport(true)}
                className="relative flex-1 sm:flex-none gap-1.5"
                title="Import assets from CSV"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="sr-only sm:not-sr-only">Import CSV</span>
              </Button>
              {assets.length > 0 && (
                // NewBadge: absolute overlay on the relative button host —
                // never consumes layout width (project badge rule).
                <Button
                  variant="secondary"
                  btnSize="sm"
                  onClick={handleExportCsv}
                  disabled={isExporting || exportableAssets.length === 0}
                  className="relative flex-1 sm:flex-none gap-1.5"
                  title={exportScope
                    ? 'Export the currently filtered assets to CSV'
                    : 'Export all assets to CSV'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="sr-only sm:not-sr-only">
                    Export CSV{exportScope ? ` (${exportableAssets.length})` : ''}
                  </span>
                  <NewBadge feature="export-assets" className="absolute -top-1 -right-1 pointer-events-none" />
                </Button>
              )}
              {assets.length > 0 && (
                <Button
                  variant="secondary"
                  btnSize="sm"
                  onClick={handleReset}
                  className="flex-1 sm:flex-none"
                >
                  Reset {filterCategory === 'all' ? 'All' : getCategoryLabel(filterCategory)}
                </Button>
              )}
              <Button
                btnSize="sm"
                onClick={startAdding}
                className="flex-1 sm:flex-none"
              >
                + Add {filterCategory === 'all' ? 'Asset' : getCategoryLabel(filterCategory).replace(/s$/, '')}
              </Button>
            </>
          )}
        </div>
      </div>
      {exportError && (
        <div role="alert" className="text-sm text-red-400 mb-3">{exportError}</div>
      )}
      {resetError && (
        <div role="alert" className="text-sm text-red-400 mb-3">{resetError}</div>
      )}

      {isLoading ? (
        <AssetListSkeleton />
      ) : shouldShowEmptyState(displayAssets, isLoading) ? (
        // WR-02: gate on displayAssets (current view) rather than raw assets.
        // A printer-only library on the 'All' tab now correctly shows the
        // empty-state hero instead of the populated chrome with an empty table.
        // Empty-state copy + CTA route by the active filterCategory so a user
        // sitting on the 'Printers' tab with zero printers is invited to add
        // a printer rather than a material.
        filterCategory === 'printer' ? (
          <EmptyState
            icon={<PackageIcon className="w-12 h-12" />}
            title="No printers in your library yet"
            description="Add your first printer to start tracking electricity, depreciation, and per-job machine cost. You can also import from CSV if you already have a list."
            cta={{ label: 'Add Printer', onClick: startAddingForEmptyState }}
          />
        ) : filterCategory === 'all' ? (
          <EmptyState
            icon={<PackageIcon className="w-12 h-12" />}
            title="No materials in your library yet"
            description="Add your first filament to start tracking material costs across jobs. You can also import from CSV if you already have a list."
            cta={{ label: 'Add Material', onClick: startAddingForEmptyState }}
          />
        ) : (
          <EmptyState
            icon={<PackageIcon className="w-12 h-12" />}
            title={`No ${getCategoryLabel(filterCategory).toLowerCase()} in your library yet`}
            description={`Add your first ${getCategoryLabel(filterCategory).toLowerCase().replace(/s$/, '')} to start tracking costs across jobs. You can also import from CSV if you already have a list.`}
            cta={{ label: `Add ${getCategoryLabel(filterCategory).replace(/s$/, '')}`, onClick: startAddingForEmptyState }}
          />
        )
      ) : (
        <>
      {/* Filter tabs + Search */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {/* allow-raw-html */}
        <button
          onClick={() => handleFilterChange('all')}
          aria-pressed={filterCategory === 'all'}
          className={`px-4 py-1 min-h-[40px] text-sm rounded-lg transition-colors ${
            filterCategory === 'all'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          All
        </button>
        {allCategories.map(cat => (
          /* allow-raw-html */
          <button
            key={cat}
            onClick={() => handleFilterChange(cat)}
            aria-pressed={filterCategory === cat}
            className={`px-4 py-1 min-h-[40px] text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              filterCategory === cat
                ? 'bg-slate-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-56">
          <svg aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search..."
            aria-label="Search assets"
            className="pl-9 pr-8 placeholder-slate-500"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              btnSize="sm"
              onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none"
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={nameId} className="block text-xs text-slate-400 mb-1">Name</label>
              <Input
                id={nameId}
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={isPrinterForm ? "e.g., Creality Ender 3 V3" : "Asset name"}
                required
              />
            </div>
            <div>
              <label htmlFor={categoryId} className="block text-xs text-slate-400 mb-1">Category</label>
              {showCustomCategory ? (
                <div className="flex gap-2">
                  <Input
                    id={categoryId}
                    type="text"
                    value={customCategoryInput}
                    onChange={e => setCustomCategoryInput(e.target.value)}
                    className="flex-1"
                    placeholder="e.g., resin, packaging, electronics"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    btnSize="sm"
                    onClick={() => { setShowCustomCategory(false); setCustomCategoryInput(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    id={categoryId}
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as AssetCategory })}
                    className="flex-1"
                  >
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    btnSize="sm"
                    onClick={() => setShowCustomCategory(true)}
                    className="whitespace-nowrap"
                    title="Create custom category"
                  >
                    + New
                  </Button>
                </div>
              )}
            </div>

            {/* Brand field for all */}
            <div>
              <label htmlFor={brandId} className="block text-xs text-slate-400 mb-1">Brand (optional)</label>
              <Input
                id={brandId}
                type="text"
                value={formData.brand || ''}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                placeholder={isPrinterForm ? "e.g., Creality, Prusa, Bambu" : "e.g., Bambu Lab"}
              />
            </div>

            {/* Printer-specific fields */}
            {isPrinterForm ? (
              <>
                <div>
                  <label htmlFor={purchasePriceId} className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                  <Input
                    id={purchasePriceId}
                    type="number"
                    step="0.01"
                    compact
                    value={formData.purchasePrice || ''}
                    onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })}
                    placeholder="299"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={wattageId} className="block text-xs text-slate-400 mb-1">Wattage (avg during print)</label>
                  <Input
                    id={wattageId}
                    type="number"
                    compact
                    value={formData.wattage || ''}
                    onChange={e => setFormData({ ...formData, wattage: parseFloat(e.target.value) })}
                    placeholder="100"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={expectedLifespanHoursId} className="block text-xs text-slate-400 mb-1">Expected Lifespan (hours)</label>
                  <Input
                    id={expectedLifespanHoursId}
                    type="number"
                    compact
                    value={formData.expectedLifespanHours || ''}
                    onChange={e => setFormData({ ...formData, expectedLifespanHours: parseFloat(e.target.value) })}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label htmlFor={nozzleCostId} className="block text-xs text-slate-400 mb-1">Nozzle Cost ($)</label>
                  <Input
                    id={nozzleCostId}
                    type="number"
                    step="0.01"
                    compact
                    value={formData.nozzleCost || ''}
                    onChange={e => setFormData({ ...formData, nozzleCost: parseFloat(e.target.value) })}
                    placeholder="10"
                  />
                </div>
                <div>
                  <label htmlFor={nozzleLifespanId} className="block text-xs text-slate-400 mb-1">Nozzle Lifespan (cm³)</label>
                  <Input
                    id={nozzleLifespanId}
                    type="number"
                    compact
                    value={formData.nozzleLifespanCm3 || ''}
                    onChange={e => setFormData({ ...formData, nozzleLifespanCm3: parseFloat(e.target.value) })}
                    placeholder="15000"
                  />
                </div>
              </>
            ) : (
              /* Material-specific fields */
              <>
                <div>
                  <label htmlFor={unitId} className="block text-xs text-slate-400 mb-1">Unit (g, ml, sheet, etc.)</label>
                  <Input
                    id={unitId}
                    type="text"
                    value={formData.unit || ''}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="g"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={packageCostId} className="block text-xs text-slate-400 mb-1">Package Cost ($)</label>
                  <Input
                    id={packageCostId}
                    type="number"
                    step="0.01"
                    compact
                    value={formData.packageCost || ''}
                    onChange={e => setFormData({ ...formData, packageCost: parseFloat(e.target.value) })}
                    placeholder="20.00"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={unitsPerPackageId} className="block text-xs text-slate-400 mb-1">Units per Package</label>
                  <Input
                    id={unitsPerPackageId}
                    type="number"
                    compact
                    value={formData.unitsPerPackage || ''}
                    onChange={e => setFormData({ ...formData, unitsPerPackage: parseInt(e.target.value) })}
                    placeholder="1000"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={lifespanUnitsId} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Lifespan (uses, optional)</span>
                    <InfoTooltip text="For items that get reused (e.g., a brush)" />
                  </label>
                  <Input
                    id={lifespanUnitsId}
                    type="number"
                    compact
                    value={formData.lifespanUnits || ''}
                    onChange={e => setFormData({ ...formData, lifespanUnits: parseInt(e.target.value) || undefined })}
                    placeholder=""
                  />
                </div>
                <div>
                  <label htmlFor={stockOnHandId} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Stock on hand ({formStockUnit.unit}, optional)</span>
                    <InfoTooltip text={formStockUnit.unit === 'spools' ? 'How many spools you have right now. Logging a job deducts the grams it uses automatically.' : 'How much you have right now. Logging jobs deducts from this automatically.'} />
                  </label>
                  <Input
                    id={stockOnHandId}
                    type="number"
                    compact
                    value={stockOnHandInput}
                    onChange={e => setStockOnHandInput(e.target.value)}
                    placeholder=""
                  />
                </div>
                <div>
                  <label htmlFor={lowStockThresholdId} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Low-stock alert at ({formStockUnit.unit}, optional)</span>
                    <InfoTooltip text="Flag this material as low once stock drops to or below this amount." />
                  </label>
                  <Input
                    id={lowStockThresholdId}
                    type="number"
                    compact
                    value={formData.lowStockThreshold == null ? '' : formData.lowStockThreshold / formStockUnit.perUnit}
                    onChange={e => setFormData({ ...formData, lowStockThreshold: e.target.value === '' ? undefined : parseFloat(e.target.value) * formStockUnit.perUnit })}
                    placeholder=""
                  />
                </div>
              </>
            )}
          </div>
          <div>
            <label htmlFor={notesId} className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
            <Input
              id={notesId}
              type="text"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any notes..."
            />
          </div>
          {/* Tags */}
          <div>
            <label htmlFor={tagsId} className="block text-xs text-slate-400 mb-1">Tags (optional)</label>
            <div className="flex gap-2 mb-2">
              <Input
                id={tagsId}
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="flex-1"
                placeholder="Add a tag and press Enter..."
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addTag}
              >
                Add
              </Button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-600 text-slate-300"
                  >
                    {tag}
                    <Button
                      type="button"
                      variant="ghost"
                      btnSize="sm"
                      onClick={() => removeTag(tag)}
                      className="text-slate-400 hover:text-red-400 !p-0 !min-h-0"
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit">
              {editingId ? 'Update' : 'Add'} {isPrinterForm ? 'Printer' : 'Material'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Mobile Sort */}
      <div className="md:hidden flex items-center gap-2 mb-3">
        <span className="text-sm text-slate-400">Sort:</span>
        <Select
          selectSize="sm"
          value={sortField}
          onChange={e => { setSortField(e.target.value); setCurrentPage(1); }}
        >
          <option value="name">Name</option>
          <option value="brand">Brand</option>
          <option value="category">Type</option>
          {filterCategory === 'printer' ? (
            <>
              <option value="purchasePrice">Price</option>
              <option value="wattage">Wattage</option>
              <option value="nozzleCost">Nozzle Cost</option>
            </>
          ) : (
            <>
              <option value="costPerUnit">Cost/Unit</option>
              <option value="packageCost">Package Cost</option>
            </>
          )}
        </Select>
        <Button
          variant="secondary"
          btnSize="sm"
          onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
          title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDirection === 'asc' ? '\u2191 A-Z' : '\u2193 Z-A'}
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {paginatedAssets.length > 0 ? (
          effectiveItemsPerPage > 50 ? (
            <List
              role="list"
              aria-rowcount={paginatedAssets.length}
              rowComponent={MobileCardRow}
              rowCount={paginatedAssets.length}
              rowHeight={mobileCardHeightCache}
              rowProps={listRowProps}
              overscanCount={3}
              style={{ height: '70vh' }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedAssets.map(asset => (
                <MobileCardItem key={asset.id} asset={asset} onEdit={startEdit} onDelete={onDeleteAsset} userCurrency={userCurrency} fxTable={fxTable} stockByAssetId={stockByAssetId} />
              ))}
            </div>
          )
        ) : filteredAssets.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No {filterCategory === 'printer' ? 'printers' : 'materials'} found</p>
        ) : null}
      </div>

      {/* Desktop Table View (div-grid replacement — Phase 11-05 / PERF-02 / D-07).
          The two desktop `<table>` elements were replaced with `<div>`-based
          grid markup so we can virtualize the body when the page-size predicate
          fires. ARIA roles (row / columnheader / cell) preserve screen-reader
          semantics. */}
      <div className="hidden md:block overflow-x-auto">
        {filterCategory === 'printer' ? (
          /* Printer Table — 7 columns */
          <div role="grid" aria-rowcount={paginatedAssets.length + 1} className="w-full text-sm">
            {/* Header (was <thead><tr>) */}
            <div role="row" className="grid grid-cols-7 gap-x-4 text-slate-400 text-left border-b border-slate-700">
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={sortHeaderClass} onClick={() => toggleSort('name')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('name'); } }}>Printer<SortIndicator sortField={sortField} sortDirection={sortDirection} field="name" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'brand' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={sortHeaderClass} onClick={() => toggleSort('brand')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('brand'); } }}>Brand<SortIndicator sortField={sortField} sortDirection={sortDirection} field="brand" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={sortHeaderClass} onClick={() => toggleSort('category')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('category'); } }}>Type<SortIndicator sortField={sortField} sortDirection={sortDirection} field="category" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'purchasePrice' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('purchasePrice')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('purchasePrice'); } }}>Price<SortIndicator sortField={sortField} sortDirection={sortDirection} field="purchasePrice" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'wattage' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('wattage')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('wattage'); } }}>Wattage<SortIndicator sortField={sortField} sortDirection={sortDirection} field="wattage" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'nozzleCost' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('nozzleCost')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('nozzleCost'); } }}>Nozzle<SortIndicator sortField={sortField} sortDirection={sortDirection} field="nozzleCost" /></div>
              <div role="columnheader" className="pb-2 font-medium text-right">Actions</div>
            </div>
            {/* Body (was <tbody>) */}
            {effectiveItemsPerPage > 50 ? (
              // WR-01 fix: parent is role="grid" so the virtualized body is
              // role="rowgroup" (valid grid-child), not role="list" (which
              // breaks the grid → row → cell ARIA chain). aria-rowcount
              // belongs on the outer grid only.
              <List
                role="rowgroup"
                rowComponent={PrinterRowAdapter}
                rowCount={paginatedAssets.length}
                rowHeight={printerRowHeightCache}
                rowProps={listRowProps}
                overscanCount={5}
                style={{ height: '60vh' }}
              />
            ) : (
              <div>
                {paginatedAssets.map(asset => (
                  <PrinterRow key={asset.id} asset={asset} onEdit={startEdit} onDelete={onDeleteAsset} userCurrency={userCurrency} fxTable={fxTable} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Materials Table — 6 columns */
          <div role="grid" aria-rowcount={paginatedAssets.length + 1} className="w-full text-sm">
            {/* Header (was <thead><tr>) */}
            <div role="row" className="grid grid-cols-6 gap-x-4 text-slate-400 text-left border-b border-slate-700">
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={sortHeaderClass} onClick={() => toggleSort('name')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('name'); } }}>Material<SortIndicator sortField={sortField} sortDirection={sortDirection} field="name" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'brand' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={sortHeaderClass} onClick={() => toggleSort('brand')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('brand'); } }}>Brand<SortIndicator sortField={sortField} sortDirection={sortDirection} field="brand" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={sortHeaderClass} onClick={() => toggleSort('category')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('category'); } }}>Type<SortIndicator sortField={sortField} sortDirection={sortDirection} field="category" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'costPerUnit' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('costPerUnit')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('costPerUnit'); } }}>Cost/Unit<SortIndicator sortField={sortField} sortDirection={sortDirection} field="costPerUnit" /></div>
              <div role="columnheader" tabIndex={0} aria-sort={sortField === 'packageCost' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('packageCost')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('packageCost'); } }}>Package<SortIndicator sortField={sortField} sortDirection={sortDirection} field="packageCost" /></div>
              <div role="columnheader" className="pb-2 font-medium text-right">Actions</div>
            </div>
            {/* Body (was <tbody>) */}
            {effectiveItemsPerPage > 50 ? (
              // WR-01 fix: parent is role="grid" so the virtualized body is
              // role="rowgroup" (valid grid-child), not role="list".
              // aria-rowcount stays on the outer grid only.
              <List
                role="rowgroup"
                rowComponent={MaterialRowAdapter}
                rowCount={paginatedAssets.length}
                rowHeight={materialRowHeightCache}
                rowProps={listRowProps}
                overscanCount={5}
                style={{ height: '60vh' }}
              />
            ) : (
              <div>
                {paginatedAssets.map(asset => (
                  <MaterialRow key={asset.id} asset={asset} onEdit={startEdit} onDelete={onDeleteAsset} userCurrency={userCurrency} fxTable={fxTable} stockByAssetId={stockByAssetId} />
                ))}
              </div>
            )}
          </div>
        )}
        {filteredAssets.length === 0 && (
          <p className="text-center text-slate-500 py-4">No {filterCategory === 'printer' ? 'printers' : 'materials'} found</p>
        )}
      </div>

      {/* Pagination and Items Per Page */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Show:</span>
            <Select
              selectSize="sm"
              value={itemsPerPage}
              onChange={e => handleItemsPerPageChange(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </Select>
          </div>
          <div className="text-sm text-slate-400">
            {itemsPerPage === 0 ? (
              `Showing all ${displayAssets.length} items`
            ) : (
              `Showing ${((currentPage - 1) * effectiveItemsPerPage) + 1}-${Math.min(currentPage * effectiveItemsPerPage, displayAssets.length)} of ${displayAssets.length} items`
            )}
          </div>
        </div>
        {totalPages > 1 && itemsPerPage !== 0 && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              btnSize="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                // Show first pages, current page area, and last pages
                let page: number;
                if (totalPages <= 10) {
                  page = i + 1;
                } else if (currentPage <= 5) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 4) {
                  page = totalPages - 9 + i;
                } else {
                  page = currentPage - 4 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'primary' : 'secondary'}
                    btnSize="sm"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? '!w-8 !min-w-0 !min-h-0 !px-0 h-8' : '!w-8 !min-w-0 !min-h-0 !px-0 h-8 text-slate-400 hover:text-white'}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="secondary"
              btnSize="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
        </>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        existingAssets={assets}
        onImportAssets={onBulkImportAssets}
      />
    </div>
  );
}
