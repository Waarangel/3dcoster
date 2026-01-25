import { useState, useMemo } from 'react';
import type { Asset, AssetCategory, BuiltInCategory } from '../types';
import { NewBadge } from './NewBadge';

interface AssetLibraryProps {
  assets: Asset[];
  onAddAsset: (asset: Asset) => void;
  onUpdateAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
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
  onResetMaterials,
  onResetPrinters,
  itemsPerPage,
  onItemsPerPageChange,
}: AssetLibraryProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'all'>('all');
  const [formData, setFormData] = useState<Partial<Asset>>({
    category: 'consumable',
  });
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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

  // Pagination - itemsPerPage of 0 means show all
  const effectiveItemsPerPage = itemsPerPage === 0 ? displayAssets.length : itemsPerPage;
  const totalPages = effectiveItemsPerPage > 0 ? Math.ceil(displayAssets.length / effectiveItemsPerPage) : 1;
  const paginatedAssets = itemsPerPage === 0
    ? displayAssets
    : displayAssets.slice(
        (currentPage - 1) * effectiveItemsPerPage,
        currentPage * effectiveItemsPerPage
      );

  // Reset to page 1 when filter or items per page changes, and cancel any in-progress add/edit
  const handleFilterChange = (category: AssetCategory | 'all') => {
    setFilterCategory(category);
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
      if (!formData.name || !formData.purchasePrice || !formData.wattage) return;

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
      if (!formData.name || !formData.unit || !formData.packageCost || !formData.unitsPerPackage) return;

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

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Asset Library</h2>
        <div className="flex gap-2">
          {!isAdding && (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors"
              >
                Reset {filterCategory === 'all' ? 'All' : getCategoryLabel(filterCategory)}
              </button>
              <button
                onClick={startAdding}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                + Add {filterCategory === 'all' ? 'Asset' : getCategoryLabel(filterCategory).replace(/s$/, '')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => handleFilterChange('all')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filterCategory === 'all'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          All
        </button>
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => handleFilterChange(cat)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              filterCategory === cat
                ? 'bg-slate-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {getCategoryLabel(cat)}
            {cat === 'packaging' && <NewBadge feature="packaging-materials" />}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                placeholder={isPrinterForm ? "e.g., Creality Ender 3 V3" : "Asset name"}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              {showCustomCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={e => setCustomCategoryInput(e.target.value)}
                    className="flex-1 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., resin, packaging, electronics"
                  />
                  <button
                    type="button"
                    onClick={() => { setShowCustomCategory(false); setCustomCategoryInput(''); }}
                    className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as AssetCategory })}
                    className="flex-1 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  >
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomCategory(true)}
                    className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded whitespace-nowrap"
                    title="Create custom category"
                  >
                    + New
                  </button>
                </div>
              )}
            </div>

            {/* Brand field for all */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Brand (optional)</label>
              <input
                type="text"
                value={formData.brand || ''}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                placeholder={isPrinterForm ? "e.g., Creality, Prusa, Bambu" : "e.g., Bambu Lab"}
              />
            </div>

            {/* Printer-specific fields */}
            {isPrinterForm ? (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice || ''}
                    onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="299"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Wattage (avg during print)</label>
                  <input
                    type="number"
                    value={formData.wattage || ''}
                    onChange={e => setFormData({ ...formData, wattage: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Expected Lifespan (hours)</label>
                  <input
                    type="number"
                    value={formData.expectedLifespanHours || ''}
                    onChange={e => setFormData({ ...formData, expectedLifespanHours: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nozzle Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.nozzleCost || ''}
                    onChange={e => setFormData({ ...formData, nozzleCost: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nozzle Lifespan (cm³)</label>
                  <input
                    type="number"
                    value={formData.nozzleLifespanCm3 || ''}
                    onChange={e => setFormData({ ...formData, nozzleLifespanCm3: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="15000"
                  />
                </div>
              </>
            ) : (
              /* Material-specific fields */
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unit (g, ml, sheet, etc.)</label>
                  <input
                    type="text"
                    value={formData.unit || ''}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="g"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Package Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.packageCost || ''}
                    onChange={e => setFormData({ ...formData, packageCost: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="20.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Units per Package</label>
                  <input
                    type="number"
                    value={formData.unitsPerPackage || ''}
                    onChange={e => setFormData({ ...formData, unitsPerPackage: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="1000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Lifespan (uses, optional)</label>
                  <input
                    type="number"
                    value={formData.lifespanUnits || ''}
                    onChange={e => setFormData({ ...formData, lifespanUnits: parseInt(e.target.value) || undefined })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    placeholder="For reusable items"
                  />
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
              placeholder="Any notes..."
            />
          </div>
          {/* Tags */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (optional)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="flex-1 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                placeholder="Add a tag and press Enter..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg"
              >
                Add
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-600 text-slate-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              {editingId ? 'Update' : 'Add'} {isPrinterForm ? 'Printer' : 'Material'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Assets Table */}
      <div className="overflow-x-auto">
        {filterCategory === 'printer' ? (
          /* Printer Table */
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className="pb-2 font-medium">Printer</th>
                <th className="pb-2 font-medium">Brand</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Price</th>
                <th className="pb-2 font-medium text-right">Wattage</th>
                <th className="pb-2 font-medium text-right">Nozzle</th>
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
                    <button
                      onClick={() => startEdit(asset)}
                      className="text-blue-400 hover:text-blue-300 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteAsset(asset.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
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
                <th className="pb-2 font-medium">Material</th>
                <th className="pb-2 font-medium">Brand</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Cost/Unit</th>
                <th className="pb-2 font-medium text-right">Package</th>
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
                    <button
                      onClick={() => startEdit(asset)}
                      className="text-blue-400 hover:text-blue-300 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteAsset(asset.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
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
            <select
              value={itemsPerPage}
              onChange={e => handleItemsPerPageChange(Number(e.target.value))}
              className="bg-slate-700 text-white text-sm px-2 py-1 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
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
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm rounded-lg transition-colors"
            >
              Previous
            </button>
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
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
