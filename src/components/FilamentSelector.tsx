import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Material, Currency } from '../types';
import { Button } from './ui';

// Filament names often embed the brand (e.g. "Bambu ASA", "eSun PLA"). The
// submenu is already grouped under a brand header, so repeating the brand on
// every row is redundant — strip the leading brand word for the submenu label.
// Match on the brand's FIRST word (brand "Bambu Lab" → strip "Bambu") so the
// common short form is removed without needing the full brand string to prefix
// the name. If the name doesn't start with the brand word, return it unchanged
// (never drop real content for user-added filaments).
function stripBrandFromName(name: string, brand?: string): string {
  if (!brand) return name;
  const brandFirst = brand.split(/\s+/)[0];
  const words = name.split(/\s+/);
  if (words[0]?.toLowerCase() === brandFirst.toLowerCase()) {
    return words.slice(1).join(' ') || name;
  }
  return name;
}

// Trigger label: brand short-word + bare name, e.g. "Bambu ASA" / "eSun PLA".
// Guarantees brand context even when a user-added name omits the brand
// (brand "eSun" + name "PLA+" → "eSun PLA+").
function brandedName(filament: Material): string {
  const bare = stripBrandFromName(filament.name, filament.brand);
  if (!filament.brand) return bare;
  const brandFirst = filament.brand.split(/\s+/)[0];
  return `${brandFirst} ${bare}`;
}

interface FilamentSelectorProps {
  materials: Material[];
  selectedFilamentId: string;
  onSelect: (filament: Material) => void;
  // Seed the row's price/currency from the chosen asset on selection. The price
  // is not shown or edited here (it lives in the Asset Library); these callbacks
  // exist only so the cost calc has the per-gram value for the selected filament.
  onPriceChange: (price: number) => void;
  onCurrencyChange: (currency: Currency) => void;
}

export function FilamentSelector({
  materials,
  selectedFilamentId,
  onSelect,
  onPriceChange,
  onCurrencyChange,
}: FilamentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);
  // Tracks which brand row has keyboard focus (independent of mouse hover).
  // The submenu renders when either hoveredBrand OR focusedBrand matches the brand.
  const [focusedBrand, setFocusedBrand] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to the trigger button so we can return focus on close.
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Parallel arrays of brand-row button refs and filament-item button refs.
  const brandRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const filamentRefs = useRef<(HTMLButtonElement | null)[][]>([]);

  // Show every filament regardless of its native currency. Prices are converted
  // to the user's currency at display time (useFxRates), so there is no reason
  // to hide a filament priced in another currency — the old currency-equality
  // filter is exactly what stranded USD-seeded rows from non-USD users.
  const filaments = materials.filter(m => m.category === 'filament');
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

  // Get filaments by brand group, sorted A-Z by name. Sort explicitly here — DB
  // insertion order is not alphabetical, and the submenu must stay A-Z regardless
  // of seed/save order. The 'Unbranded' group returns brand-less rows.
  const getFilamentsForBrand = (brand: string) => {
    const rows = brand === UNBRANDED
      ? filaments.filter(f => !f.brand)
      : filaments.filter(f => f.brand === brand);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Close dropdown and return focus to the trigger.
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setHoveredBrand(null);
    setFocusedBrand(null);
    triggerRef.current?.focus();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredBrand(null);
        setFocusedBrand(null);
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
    setFocusedBrand(null);
  };

  // ── Keyboard handlers ──────────────────────────────────────────────────────

  // Trigger button: ArrowDown opens the menu and focuses the first brand row.
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      // Defer so the brand rows are rendered before we call focus.
      requestAnimationFrame(() => {
        brandRefs.current[0]?.focus();
      });
    }
    // Enter/Space are native button click semantics — onClick already toggles isOpen.
  };

  // Brand row: ArrowUp/Down navigate between brands; ArrowRight/Enter opens the
  // submenu and focuses its first filament; Escape closes the entire menu.
  const handleBrandKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    brand: string,
    brandIndex: number,
  ) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = brandIndex + 1;
        if (next < brands.length) {
          setFocusedBrand(null);
          brandRefs.current[next]?.focus();
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = brandIndex - 1;
        if (prev >= 0) {
          setFocusedBrand(null);
          brandRefs.current[prev]?.focus();
        } else {
          // At the top — return focus to the trigger.
          closeMenu();
        }
        break;
      }
      case 'ArrowRight':
      case 'Enter': {
        e.preventDefault();
        setFocusedBrand(brand);
        requestAnimationFrame(() => {
          filamentRefs.current[brandIndex]?.[0]?.focus();
        });
        break;
      }
      case 'Escape': {
        e.preventDefault();
        closeMenu();
        break;
      }
    }
  };

  // Filament item: ArrowUp/Down navigate within the submenu; ArrowLeft/Escape
  // returns focus to the parent brand row; Enter selects the filament.
  const handleFilamentKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    filament: Material,
    brandIndex: number,
    filamentIndex: number,
    brandFilaments: Material[],
  ) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = filamentIndex + 1;
        if (next < brandFilaments.length) {
          filamentRefs.current[brandIndex]?.[next]?.focus();
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = filamentIndex - 1;
        if (prev >= 0) {
          filamentRefs.current[brandIndex]?.[prev]?.focus();
        } else {
          // Top of filament list — go back to the brand row.
          setFocusedBrand(null);
          brandRefs.current[brandIndex]?.focus();
        }
        break;
      }
      case 'ArrowLeft':
      case 'Escape': {
        e.preventDefault();
        setFocusedBrand(null);
        brandRefs.current[brandIndex]?.focus();
        break;
      }
      case 'Enter': {
        e.preventDefault();
        handleFilamentSelect(filament);
        break;
      }
    }
  };

  // The submenu for a brand is visible when mouse hovers OR keyboard focuses it.
  const isSubmenuOpen = (brand: string) =>
    hoveredBrand === brand || focusedBrand === brand;

  return (
    <div className="space-y-3">
      {/* Main dropdown trigger */}
      <div ref={containerRef} className="relative">
        <label className="block text-xs text-slate-400 mb-1">Filament</label>
        <Button
          ref={triggerRef}
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => {
            setIsOpen(!isOpen);
            setHoveredBrand(null);
            setFocusedBrand(null);
          }}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className="!justify-between text-left"
        >
          <span className={selectedFilament ? 'text-white' : 'text-slate-400'}>
            {selectedFilament ? brandedName(selectedFilament) : 'Select filament...'}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>

        {/* Dropdown menu */}
        {isOpen && (
          <div
            className="absolute z-50 mt-1 w-full bg-slate-700 rounded-lg shadow-lg border border-slate-600"
            role="menu"
          >
            {brands.map((brand, index) => (
              <div
                key={brand}
                className="relative"
                onMouseEnter={() => handleBrandMouseEnter(brand)}
                onMouseLeave={handleBrandMouseLeave}
              >
                {/* allow-raw-html: keyboard-accessible menu item — needs custom role/refs/keydown for arrow-key menu nav, no Button variant fits */}
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={isSubmenuOpen(brand)}
                  ref={el => { brandRefs.current[index] = el; }}
                  onClick={() => {
                    // Mouse click toggles the keyboard-focus submenu open state.
                    setFocusedBrand(prev => prev === brand ? null : brand);
                  }}
                  onKeyDown={e => handleBrandKeyDown(e, brand, index)}
                  className={`w-full px-3 py-2.5 hover:bg-slate-600 cursor-pointer flex justify-between items-center text-sm text-white text-left ${
                    index === 0 ? 'rounded-t-lg' : ''
                  } ${index === brands.length - 1 && !isSubmenuOpen(brand) ? 'rounded-b-lg' : ''}`}
                >
                  {brand}
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Submenu for filament types - positioned to the right */}
                {isSubmenuOpen(brand) && (
                  <div
                    className="absolute left-full top-0 ml-1 w-56 bg-slate-700 rounded-lg shadow-xl border border-slate-600 max-h-72 overflow-y-auto"
                    style={{ zIndex: 60 }}
                    role="menu"
                    onMouseEnter={handleSubMenuMouseEnter}
                    onMouseLeave={handleSubMenuMouseLeave}
                  >
                    {getFilamentsForBrand(brand).map((filament, fIndex) => {
                      const brandFilaments = getFilamentsForBrand(brand);
                      return (
                        // allow-raw-html: keyboard-accessible menu item — custom role/refs/keydown for menu nav
                        <button
                          key={filament.id}
                          type="button"
                          role="menuitem"
                          ref={el => {
                            if (!filamentRefs.current[index]) {
                              filamentRefs.current[index] = [];
                            }
                            filamentRefs.current[index][fIndex] = el;
                          }}
                          onClick={() => handleFilamentSelect(filament)}
                          onKeyDown={e =>
                            handleFilamentKeyDown(e, filament, index, fIndex, brandFilaments)
                          }
                          className={`w-full px-3 py-2.5 hover:bg-slate-600 cursor-pointer text-sm text-left ${
                            selectedFilamentId === filament.id
                              ? 'bg-blue-600/30 text-blue-300'
                              : 'text-white'
                          } ${fIndex === 0 ? 'rounded-t-lg' : ''} ${
                            fIndex === brandFilaments.length - 1 ? 'rounded-b-lg' : ''
                          }`}
                        >
                          {stripBrandFromName(filament.name, filament.brand)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
