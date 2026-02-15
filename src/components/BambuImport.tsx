import { useState, useMemo } from 'react';
import type { Asset } from '../types';
import { bambuFilaments, BAMBU_DATA_LAST_UPDATED, BAMBU_DATA_CURRENCY, BAMBU_DATA_SOURCE } from '../data/bambuFilaments';

interface BambuImportProps {
  existingAssets: Asset[];
  onImportAssets: (assets: Omit<Asset, 'id'>[]) => void;
  onUpdateAsset?: (asset: Asset) => void;
}

export function BambuImport({ existingAssets, onImportAssets, onUpdateAsset }: BambuImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Analyze which products are already in the library
  const analysis = useMemo(() => {
    return bambuFilaments.map((product, index) => {
      const existing = existingAssets.find(
        a => a.category === 'filament' &&
             a.brand?.toLowerCase() === 'bambu lab' &&
             a.name.toLowerCase() === product.name.toLowerCase()
      );
      const priceChanged = existing && existing.packageCost !== product.packageCost;
      return { index, product, existing, priceChanged };
    });
  }, [existingAssets]);

  const newProducts = analysis.filter(a => !a.existing);
  const existingProducts = analysis.filter(a => a.existing);
  const priceChangedProducts = analysis.filter(a => a.priceChanged);

  // Initialize selection when opening
  const handleOpen = () => {
    // Default: select all new products + products with price changes
    const initial = new Set<number>();
    analysis.forEach(a => {
      if (!a.existing || a.priceChanged) {
        initial.add(a.index);
      }
    });
    setSelectedIndices(initial);
    setIsOpen(true);
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIndices.size === bambuFilaments.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(bambuFilaments.map((_, i) => i)));
    }
  };

  const handleImport = () => {
    const toImport: Omit<Asset, 'id'>[] = [];
    const toUpdate: Asset[] = [];

    selectedIndices.forEach(index => {
      const item = analysis[index];
      if (item.existing && onUpdateAsset) {
        // Update existing asset's price
        toUpdate.push({
          ...item.existing,
          packageCost: item.product.packageCost,
          costPerUnit: item.product.costPerUnit,
          currency: item.product.currency,
        });
      } else if (!item.existing) {
        // New import
        toImport.push(item.product);
      }
    });

    if (toImport.length > 0) {
      onImportAssets(toImport);
    }
    toUpdate.forEach(asset => onUpdateAsset?.(asset));

    setIsOpen(false);
  };

  const selectedNewCount = Array.from(selectedIndices).filter(i => !analysis[i].existing).length;
  const selectedUpdateCount = Array.from(selectedIndices).filter(i => analysis[i].existing).length;

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors"
        title="Import Bambu Lab filament catalog with prices"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="hidden sm:inline">Bambu Prices</span>
        <span className="sm:hidden">Bambu</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Bambu Lab Filament Catalog</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {bambuFilaments.length} products | Prices in {BAMBU_DATA_CURRENCY} from {BAMBU_DATA_SOURCE} | Updated {BAMBU_DATA_LAST_UPDATED}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status badges */}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
              {newProducts.length} new
            </span>
            <span className="px-2 py-0.5 bg-slate-600/50 text-slate-400 text-xs rounded-full">
              {existingProducts.length} already imported
            </span>
            {priceChangedProducts.length > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                {priceChangedProducts.length} price changes
              </span>
            )}
          </div>

          {/* Select all */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={toggleAll}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {selectedIndices.size === bambuFilaments.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-slate-500">|</span>
            <button
              onClick={() => {
                const newOnly = new Set<number>();
                analysis.forEach(a => { if (!a.existing) newOnly.add(a.index); });
                setSelectedIndices(newOnly);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              New Only
            </button>
            {priceChangedProducts.length > 0 && (
              <>
                <span className="text-xs text-slate-500">|</span>
                <button
                  onClick={() => {
                    const changed = new Set<number>();
                    analysis.forEach(a => { if (a.priceChanged) changed.add(a.index); });
                    setSelectedIndices(changed);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Price Changes Only
                </button>
              </>
            )}
          </div>
        </div>

        {/* Product list */}
        <div className="overflow-y-auto flex-1 p-2">
          {analysis.map(({ index, product, existing, priceChanged }) => {
            const isSelected = selectedIndices.has(index);
            return (
              <label
                key={index}
                className={`
                  flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                  ${isSelected ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'}
                  ${existing && !priceChanged ? 'opacity-50' : ''}
                `}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(index)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{product.name}</span>
                    {existing && !priceChanged && (
                      <span className="px-1.5 py-0.5 bg-slate-600/50 text-slate-400 text-[10px] rounded shrink-0">
                        Imported
                      </span>
                    )}
                    {priceChanged && (
                      <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded shrink-0">
                        Price changed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span>{product.filamentType}</span>
                    <span>{product.unitsPerPackage}g</span>
                    {priceChanged && existing && (
                      <span className="text-yellow-400">
                        ${existing.packageCost?.toFixed(2)} → ${product.packageCost?.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm font-medium text-white shrink-0">
                  ${product.packageCost?.toFixed(2)}
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {selectedNewCount > 0 && <span>{selectedNewCount} to import</span>}
              {selectedNewCount > 0 && selectedUpdateCount > 0 && <span> | </span>}
              {selectedUpdateCount > 0 && <span>{selectedUpdateCount} to update</span>}
              {selectedNewCount === 0 && selectedUpdateCount === 0 && <span>Nothing selected</span>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedIndices.size === 0}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:text-slate-400 text-white text-sm rounded-lg transition-colors"
              >
                Import Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
