import { useState, useMemo } from 'react';
import type { Asset, AssetCategory, BuiltInCategory } from '../types';
import { NewBadge } from './NewBadge';
import { CsvImportModal } from './CsvImportModal';
import { Button, Input, Select } from './ui';

interface AssetLibraryProps {
  assets: Asset[];
  onAddAsset: (asset: Asset) => void;
  onUpdateAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
  onBulkImportAssets: (assets: Asset[]) => Promise<void>;
  onResetMaterials: () => void;
  onResetPrinters: () => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
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

export function AssetLibrary({
  assets,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
  onBulkImportAssets,
  onResetMaterials,
  onResetPrinters,
  itemsPerPage,
  onItemsPerPageChange,
}: AssetLibraryProps) {
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
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
        notes: formData.notes,
        brand: formData.brand,
        filamentType: formData.filamentType,
        currency: formData.currency,
        tags: formData.tags,
      };

      if (editingId) {
        onUpdateAsset(material);
        setEditingId(null);
      } else {
        onAddAsset(material);
      }
    }

    setFormData({ category: 'consumable' });
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    setTagInput('');
    setIsAdding(false);
  };

  const startEdit = (asset: Asset) => {
    setFormData(asset);
    setEditingId(asset.id);
    setIsAdding(true);
    // Check if editing a custom category
    if (!builtInCategories.includes(asset.category as BuiltInCategory)) {
      setShowCustomCategory(true);
      setCustomCategoryInput(asset.category);
    }
  };

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

  const cancelEdit = () => {
    setFormData({ category: 'consumable' });
    setEditingId(null);
    setIsAdding(false);
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    setTagInput('');
    setFormError(null);
  };

  const handleReset = () => {
    if (filterCategory === 'printer') {
      if (window.confirm('Reset all printers to defaults? This will replace your custom printers with the default printer list.')) {
        onResetPrinters();
      }
    } else {
      if (window.confirm('Reset all materials to defaults? This will replace your current materials with the default list.')) {
        onResetMaterials();
      }
    }
  };

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return <span className="ml-1 text-[0.6em] align-middle">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const sortHeaderClass = 'pb-2 font-medium cursor-pointer hover:text-slate-200 transition-colors select-none';

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="hidden sm:inline">Import CSV</span>
                <NewBadge feature="csv-import" className="absolute -top-3 -right-3" />
              </Button>
              <Button
                variant="secondary"
                btnSize="sm"
                onClick={handleReset}
                className="flex-1 sm:flex-none"
              >
                Reset {filterCategory === 'all' ? 'All' : getCategoryLabel(filterCategory)}
              </Button>
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

      {/* Filter tabs + Search */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {/* allow-raw-html */}
        <button
          onClick={() => handleFilterChange('all')}
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
            className={`px-4 py-1 min-h-[40px] text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              filterCategory === cat
                ? 'bg-slate-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {getCategoryLabel(cat)}
            {cat === 'packaging' && <NewBadge feature="packaging-materials" />}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-56">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search..."
            className="pl-9 pr-8 placeholder-slate-500"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              btnSize="sm"
              onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
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
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <Input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={isPrinterForm ? "e.g., Creality Ender 3 V3" : "Asset name"}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              {showCustomCategory ? (
                <div className="flex gap-2">
                  <Input
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
              <label className="block text-xs text-slate-400 mb-1">Brand (optional)</label>
              <Input
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
                  <label className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice || ''}
                    onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })}
                    placeholder="299"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Wattage (avg during print)</label>
                  <Input
                    type="number"
                    value={formData.wattage || ''}
                    onChange={e => setFormData({ ...formData, wattage: parseFloat(e.target.value) })}
                    placeholder="100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Expected Lifespan (hours)</label>
                  <Input
                    type="number"
                    value={formData.expectedLifespanHours || ''}
                    onChange={e => setFormData({ ...formData, expectedLifespanHours: parseFloat(e.target.value) })}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nozzle Cost ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.nozzleCost || ''}
                    onChange={e => setFormData({ ...formData, nozzleCost: parseFloat(e.target.value) })}
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nozzle Lifespan (cm³)</label>
                  <Input
                    type="number"
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
                  <label className="block text-xs text-slate-400 mb-1">Unit (g, ml, sheet, etc.)</label>
                  <Input
                    type="text"
                    value={formData.unit || ''}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="g"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Package Cost ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.packageCost || ''}
                    onChange={e => setFormData({ ...formData, packageCost: parseFloat(e.target.value) })}
                    placeholder="20.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Units per Package</label>
                  <Input
                    type="number"
                    value={formData.unitsPerPackage || ''}
                    onChange={e => setFormData({ ...formData, unitsPerPackage: parseInt(e.target.value) })}
                    placeholder="1000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Lifespan (uses, optional)</label>
                  <Input
                    type="number"
                    value={formData.lifespanUnits || ''}
                    onChange={e => setFormData({ ...formData, lifespanUnits: parseInt(e.target.value) || undefined })}
                    placeholder="For reusable items"
                  />
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
            <Input
              type="text"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any notes..."
            />
          </div>
          {/* Tags */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (optional)</label>
            <div className="flex gap-2 mb-2">
              <Input
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
          <div className="flex flex-col gap-3">
            {paginatedAssets.map(asset => (
              <div
                key={asset.id}
                className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50"
              >
                {/* Header: Name + Type badge */}
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

                {/* Brand */}
                {asset.brand && (
                  <div className="text-sm text-slate-400 mb-1">{asset.brand}</div>
                )}

                {/* Notes */}
                {asset.notes && (
                  <div className="text-sm text-slate-400 mb-2">{asset.notes}</div>
                )}

                {/* Tags */}
                {asset.tags && asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {asset.tags.map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Cost details - differs by asset type */}
                {asset.category === 'printer' ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3 pt-2 border-t border-slate-700/50">
                    <div className="text-slate-400">Price</div>
                    <div className="text-right font-mono text-white">
                      ${asset.purchasePrice?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-slate-400">Wattage</div>
                    <div className="text-right font-mono text-white">
                      {asset.wattage || 0}W
                    </div>
                    <div className="text-slate-400">Nozzle Cost</div>
                    <div className="text-right font-mono text-slate-400">
                      ${asset.nozzleCost?.toFixed(2) || '0.00'}
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
                        {asset.currency || '$'}{(asset.costPerUnit ?? 0).toFixed(3)}/{asset.unit}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-slate-400">Package</span>
                      <span className="text-sm font-mono text-slate-400">
                        {asset.currency || '$'}{(asset.packageCost ?? 0).toFixed(2)}
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
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                  <Button
                    variant="secondary"
                    onClick={() => startEdit(asset)}
                    className="flex-1 text-blue-400"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => onDeleteAsset(asset.id)}
                    className="flex-1 text-red-400"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No {filterCategory === 'printer' ? 'printers' : 'materials'} found</p>
        ) : null}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        {filterCategory === 'printer' ? (
          /* Printer Table */
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className={sortHeaderClass} onClick={() => toggleSort('name')}>Printer<SortIndicator field="name" /></th>
                <th className={sortHeaderClass} onClick={() => toggleSort('brand')}>Brand<SortIndicator field="brand" /></th>
                <th className={sortHeaderClass} onClick={() => toggleSort('category')}>Type<SortIndicator field="category" /></th>
                <th className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('purchasePrice')}>Price<SortIndicator field="purchasePrice" /></th>
                <th className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('wattage')}>Wattage<SortIndicator field="wattage" /></th>
                <th className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('nozzleCost')}>Nozzle<SortIndicator field="nozzleCost" /></th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {paginatedAssets.map(asset => (
                <tr key={asset.id} className="text-slate-300">
                  <td className="py-2">
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
                  </td>
                  <td className="py-2 text-slate-400">
                    {asset.brand || '-'}
                  </td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(asset.category)}`}>
                      {getCategoryLabel(asset.category)}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">
                    ${asset.purchasePrice?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {asset.wattage || 0}W
                  </td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    ${asset.nozzleCost?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      btnSize="sm"
                      onClick={() => startEdit(asset)}
                      className="text-blue-400 hover:text-blue-300 mr-2"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      btnSize="sm"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Materials Table */
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className={sortHeaderClass} onClick={() => toggleSort('name')}>Material<SortIndicator field="name" /></th>
                <th className={sortHeaderClass} onClick={() => toggleSort('brand')}>Brand<SortIndicator field="brand" /></th>
                <th className={sortHeaderClass} onClick={() => toggleSort('category')}>Type<SortIndicator field="category" /></th>
                <th className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('costPerUnit')}>Cost/Unit<SortIndicator field="costPerUnit" /></th>
                <th className={`${sortHeaderClass} text-right`} onClick={() => toggleSort('packageCost')}>Package<SortIndicator field="packageCost" /></th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {paginatedAssets.map(asset => (
                <tr key={asset.id} className="text-slate-300">
                  <td className="py-2">
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
                  </td>
                  <td className="py-2 text-slate-400">
                    {asset.brand || '-'}
                  </td>
                  <td className="py-2">
                    {asset.category === 'filament' && asset.filamentType ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {asset.filamentType}
                      </span>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(asset.category)}`}>
                        {getCategoryLabel(asset.category)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {asset.currency || '$'} {(asset.costPerUnit ?? 0).toFixed(3)}/{asset.unit}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    {asset.currency || '$'} {(asset.packageCost ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      btnSize="sm"
                      onClick={() => startEdit(asset)}
                      className="text-blue-400 hover:text-blue-300 mr-2"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      btnSize="sm"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
