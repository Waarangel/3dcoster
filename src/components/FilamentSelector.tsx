import { useState, useRef, useEffect, useMemo } from 'react';
import type { Material, Currency } from '../types';
import { Button, Input } from './ui';

interface FilamentSelectorProps {
  materials: Material[];
  selectedFilamentId: string;
  onSelect: (filament: Material) => void;
  // Editable price/currency after selection
  editedPrice: number;
  editedCurrency: Currency;
  onPriceChange: (price: number) => void;
  onCurrencyChange: (currency: Currency) => void;
  // User's preferred currency to filter materials
  userCurrency: Currency;
}

export function FilamentSelector({
  materials,
  selectedFilamentId,
  onSelect,
  editedPrice,
  editedCurrency,
  onPriceChange,
  onCurrencyChange,
  userCurrency,
}: FilamentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter filaments by user's preferred currency.
  // Tolerate null/undefined currency (legacy + freshly-added rows that never got a
  // currency written) but still exclude a DIFFERENT explicit currency — never a
  // false positive. Loose `== null` matches both undefined and null.
  const filaments = materials.filter(m => m.category === 'filament' && (m.currency === userCurrency || m.currency == null));
  const selectedFilament = materials.find(m => m.id === selectedFilamentId);

  // Get unique brand groups. Brand-less filaments are bucketed under a synthetic
  // 'Unbranded' label so they never silently vanish; 'Unbranded' always sorts last.
  const UNBRANDED = 'Unbranded';
  const brands = useMemo(() => {
    const brandSet = new Set<string>();
    filaments.forEach(f => {
      brandSet.add(f.brand || UNBRANDED);
    });
    return Array.from(brandSet).sort((a, b) => {
      if (a === UNBRANDED) return 1;
      if (b === UNBRANDED) return -1;
      return a.localeCompare(b);
    });
  }, [filaments]);

  // Get filaments by brand group. The 'Unbranded' group returns brand-less rows.
  const getFilamentsForBrand = (brand: string) => {
    if (brand === UNBRANDED) {
      return filaments.filter(f => !f.brand);
    }
    return filaments.filter(f => f.brand === brand);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredBrand(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle brand hover with delay to prevent flickering
  const handleBrandMouseEnter = (brand: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoveredBrand(brand);
  };

  const handleBrandMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredBrand(null);
    }, 200);
  };

  const handleSubMenuMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleSubMenuMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredBrand(null);
    }, 200);
  };

  const handleFilamentSelect = (filament: Material) => {
    onSelect(filament);
    onPriceChange(filament.costPerUnit ?? 0);
    onCurrencyChange(filament.currency || 'USD');
    setIsOpen(false);
    setHoveredBrand(null);
  };

  return (
    <div className="space-y-3">
      {/* Main dropdown trigger */}
      <div ref={containerRef} className="relative">
        <label className="block text-xs text-slate-400 mb-1">Filament</label>
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => setIsOpen(!isOpen)}
          className="!justify-between text-left"
        >
          <span className={selectedFilament ? 'text-white' : 'text-slate-400'}>
            {selectedFilament
              ? `${selectedFilament.brand} ${selectedFilament.filamentType || selectedFilament.name}`
              : 'Select filament...'}
          </span>
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-slate-700 rounded-lg shadow-lg border border-slate-600">
            {brands.map((brand, index) => (
              <div
                key={brand}
                className="relative"
                onMouseEnter={() => handleBrandMouseEnter(brand)}
                onMouseLeave={handleBrandMouseLeave}
              >
                <div className={`px-3 py-2.5 hover:bg-slate-600 cursor-pointer flex justify-between items-center text-sm text-white ${
                  index === 0 ? 'rounded-t-lg' : ''
                } ${index === brands.length - 1 ? 'rounded-b-lg' : ''}`}>
                  {brand}
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Submenu for filament types - positioned to the right */}
                {hoveredBrand === brand && (
                  <div
                    className="absolute left-full top-0 ml-1 w-56 bg-slate-700 rounded-lg shadow-xl border border-slate-600 max-h-72 overflow-y-auto"
                    style={{ zIndex: 60 }}
                    onMouseEnter={handleSubMenuMouseEnter}
                    onMouseLeave={handleSubMenuMouseLeave}
                  >
                    {getFilamentsForBrand(brand).map((filament, fIndex) => (
                      <div
                        key={filament.id}
                        onClick={() => handleFilamentSelect(filament)}
                        className={`px-3 py-2.5 hover:bg-slate-600 cursor-pointer text-sm ${
                          selectedFilamentId === filament.id ? 'bg-blue-600/30 text-blue-300' : 'text-white'
                        } ${fIndex === 0 ? 'rounded-t-lg' : ''} ${
                          fIndex === getFilamentsForBrand(brand).length - 1 ? 'rounded-b-lg' : ''
                        }`}
                      >
                        {filament.filamentType || filament.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editable price field (shown after selection) */}
      {selectedFilament && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Price per gram ({editedCurrency})</label>
          <Input
            type="number"
            step="0.001"
            value={editedPrice || ''}
            onChange={e => onPriceChange(parseFloat(e.target.value) || 0)}
          />
        </div>
      )}
    </div>
  );
}
