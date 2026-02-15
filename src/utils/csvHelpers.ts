import Papa from 'papaparse';
import type { Asset, Currency, FilamentType } from '../types';

// ============================================
// CONSTANTS
// ============================================

const VALID_CURRENCIES: Currency[] = [
  'CAD', 'USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'SEK',
  'NOK', 'DKK', 'PLN', 'CZK', 'JPY', 'CNY', 'INR', 'BRL', 'MXN', 'ZAR',
];

const VALID_FILAMENT_TYPES: FilamentType[] = [
  'PLA', 'PLA Matte', 'PLA Silk', 'PLA Tough', 'PLA-CF', 'PLA Translucent',
  'PETG', 'PETG HF', 'PETG-CF', 'PETG Translucent',
  'ABS', 'ASA',
  'TPU', 'TPU 95A', 'TPU 85A',
  'PA6-CF', 'PPA-CF',
  'PC',
  'PVA',
  'Other',
];

// Columns for material CSV (non-printer assets)
const MATERIAL_COLUMNS = [
  'name', 'category', 'brand', 'unit', 'packageCost', 'unitsPerPackage',
  'currency', 'filamentType', 'lifespanUnits', 'notes', 'tags',
] as const;

// Columns for printer CSV
const PRINTER_COLUMNS = [
  'name', 'category', 'brand', 'purchasePrice', 'wattage',
  'expectedLifespanHours', 'nozzleCost', 'nozzleLifespanCm3', 'notes', 'tags',
] as const;

// All columns (union) for export — material + printer fields together
const ALL_COLUMNS = [
  'name', 'category', 'brand', 'unit', 'packageCost', 'unitsPerPackage',
  'currency', 'filamentType', 'lifespanUnits',
  'purchasePrice', 'wattage', 'expectedLifespanHours', 'nozzleCost', 'nozzleLifespanCm3',
  'notes', 'tags',
] as const;

// ============================================
// TYPES
// ============================================

export interface ParsedRow {
  rowNumber: number;          // 1-indexed (header is row 0)
  data: Record<string, string>;
  asset: Partial<Asset> | null;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  existingAssetId?: string;   // If duplicate, the existing asset's ID
}

export interface CsvParseResult {
  rows: ParsedRow[];
  globalErrors: string[];     // File-level errors (bad format, empty, etc.)
}

// ============================================
// SAMPLE TEMPLATE GENERATION
// ============================================

export function generateSampleCsv(type: 'material' | 'printer'): string {
  if (type === 'printer') {
    return Papa.unparse({
      fields: [...PRINTER_COLUMNS],
      data: [
        ['Creality Ender 3 V3', 'printer', 'Creality', '199', '100', '5000', '10', '15000', 'Budget FDM printer', 'fdm|budget'],
        ['Bambu Lab P1S', 'printer', 'Bambu Lab', '699', '120', '6000', '8', '15000', 'Enclosed CoreXY', 'corexy|enclosed'],
      ],
    });
  }

  return Papa.unparse({
    fields: [...MATERIAL_COLUMNS],
    data: [
      ['PLA Basic White', 'filament', 'Bambu Lab', 'g', '19.99', '1000', 'USD', 'PLA', '', 'Standard white PLA', 'pla|white'],
      ['Isopropyl Alcohol 70%', 'consumable', '', 'ml', '8.99', '500', 'USD', '', '', 'Bed cleaning', 'cleaning'],
      ['Sandpaper 220 grit', 'finishing', '', 'sheet', '5.00', '10', 'USD', '', '3', 'Fine sanding', 'sanding'],
      ['Shipping Box 8x6x4"', 'packaging', '', 'ea', '25.00', '25', 'USD', '', '', 'Medium shipping box', 'shipping'],
      ['Flush Cutters', 'tool', '', 'use', '8.00', '1', 'USD', '', '500', 'For removing supports', 'tools'],
    ],
  });
}

// ============================================
// CSV PARSING
// ============================================

export function parseCsvFile(csvString: string, existingAssets: Asset[]): CsvParseResult {
  const globalErrors: string[] = [];

  if (!csvString.trim()) {
    return { rows: [], globalErrors: ['CSV file is empty'] };
  }

  const parsed = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    // PapaParse errors — filter out minor ones
    const serious = parsed.errors.filter(e => e.type !== 'FieldMismatch');
    if (serious.length > 0) {
      globalErrors.push(...serious.map(e => `Row ${(e.row ?? 0) + 2}: ${e.message}`));
    }
  }

  if (!parsed.data || parsed.data.length === 0) {
    return { rows: [], globalErrors: ['No data rows found in CSV'] };
  }

  // Check if headers look valid — must have at least 'name' and 'category'
  const headers = parsed.meta.fields?.map(f => f.toLowerCase()) ?? [];
  if (!headers.includes('name') || !headers.includes('category')) {
    globalErrors.push('CSV must have at least "name" and "category" columns');
    return { rows: [], globalErrors };
  }

  // Validate each row
  const rows: ParsedRow[] = parsed.data.map((rowData, index) => {
    const result = validateCsvRow(rowData, index + 2); // +2 because row 1 is header, data starts at row 2
    return {
      rowNumber: index + 2,
      data: rowData,
      asset: result.asset,
      errors: result.errors,
      warnings: result.warnings,
      isDuplicate: false,
    };
  });

  // Check for duplicates against existing assets
  checkDuplicates(rows, existingAssets);

  return { rows, globalErrors };
}

// ============================================
// ROW VALIDATION
// ============================================

function validateCsvRow(
  row: Record<string, string>,
  _rowNumber: number,
): { asset: Partial<Asset> | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = row.name?.trim();
  const category = row.category?.trim().toLowerCase();

  if (!name) {
    errors.push('Name is required');
  }
  if (!category) {
    errors.push('Category is required');
  }

  if (errors.length > 0) {
    return { asset: null, errors, warnings };
  }

  const isPrinter = category === 'printer';
  const asset: Partial<Asset> = { name: name!, category: category! };

  // Brand (optional)
  if (row.brand?.trim()) {
    asset.brand = row.brand.trim();
  }

  // Notes (optional)
  if (row.notes?.trim()) {
    asset.notes = row.notes.trim();
  }

  // Tags (optional, pipe-separated)
  if (row.tags?.trim()) {
    asset.tags = row.tags.split('|').map(t => t.trim().toLowerCase()).filter(Boolean);
  }

  // Currency (optional, validated)
  if (row.currency?.trim()) {
    const curr = row.currency.trim().toUpperCase() as Currency;
    if (VALID_CURRENCIES.includes(curr)) {
      asset.currency = curr;
    } else {
      warnings.push(`Unknown currency "${row.currency}" — will use workspace default`);
    }
  }

  if (isPrinter) {
    // Printer-specific validation
    const purchasePrice = parsePositiveNumber(row.purchaseprice);
    const wattage = parsePositiveNumber(row.wattage);

    if (purchasePrice === null) {
      errors.push('Purchase price must be a positive number');
    } else {
      asset.purchasePrice = purchasePrice;
    }

    if (wattage === null) {
      errors.push('Wattage must be a positive number');
    } else {
      asset.wattage = wattage;
    }

    // Optional printer fields with defaults
    const lifespan = parsePositiveNumber(row.expectedlifespanhours);
    asset.expectedLifespanHours = lifespan ?? 5000;

    const nozzleCost = parsePositiveNumber(row.nozzlecost);
    asset.nozzleCost = nozzleCost ?? 10;

    const nozzleLifespan = parsePositiveNumber(row.nozzlelifespancm3);
    asset.nozzleLifespanCm3 = nozzleLifespan ?? 15000;

  } else {
    // Material-specific validation
    const unit = row.unit?.trim();
    const packageCost = parsePositiveNumber(row.packagecost);
    const unitsPerPackage = parsePositiveNumber(row.unitsperpackage);

    if (!unit) {
      errors.push('Unit is required (e.g., g, ml, sheet, ea, use)');
    } else {
      asset.unit = unit;
    }

    if (packageCost === null) {
      errors.push('Package cost must be a positive number');
    } else {
      asset.packageCost = packageCost;
    }

    if (unitsPerPackage === null || unitsPerPackage <= 0) {
      errors.push('Units per package must be greater than zero');
    } else {
      asset.unitsPerPackage = unitsPerPackage;
    }

    // Calculate costPerUnit
    if (packageCost !== null && unitsPerPackage !== null && unitsPerPackage > 0) {
      asset.costPerUnit = packageCost / unitsPerPackage;
    }

    // Optional: lifespanUnits
    const lifespan = parsePositiveNumber(row.lifespanunits);
    if (lifespan !== null) {
      asset.lifespanUnits = lifespan;
    }

    // Optional: filamentType (only meaningful for filament category)
    const ft = row.filamenttype;
    if (ft?.trim()) {
      const matched = matchFilamentTypeFromCsv(ft.trim());
      if (matched) {
        asset.filamentType = matched;
      } else {
        warnings.push(`Unknown filament type "${ft}" — setting as "Other"`);
        asset.filamentType = 'Other';
      }
    }
  }

  return {
    asset: errors.length > 0 ? null : asset,
    errors,
    warnings,
  };
}

// ============================================
// DUPLICATE DETECTION
// ============================================

function checkDuplicates(rows: ParsedRow[], existingAssets: Asset[]): void {
  // Build lookup map from existing assets: "name|category" → asset.id
  const existingMap = new Map<string, string>();
  for (const asset of existingAssets) {
    const key = `${asset.name.toLowerCase()}|${asset.category.toLowerCase()}`;
    existingMap.set(key, asset.id);
  }

  for (const row of rows) {
    if (!row.asset) continue;
    const key = `${row.asset.name!.toLowerCase()}|${row.asset.category!.toLowerCase()}`;
    const existingId = existingMap.get(key);
    if (existingId) {
      row.isDuplicate = true;
      row.existingAssetId = existingId;
    }
  }
}

// ============================================
// EXPORT
// ============================================

export function generateExportCsv(assets: Asset[]): string {
  const rows = assets.map(asset => {
    const row: Record<string, string> = {};
    for (const col of ALL_COLUMNS) {
      const value = asset[col as keyof Asset];
      if (col === 'tags' && Array.isArray(value)) {
        row[col] = value.join('|');
      } else if (value != null && value !== '') {
        row[col] = String(value);
      } else {
        row[col] = '';
      }
    }
    return row;
  });

  return Papa.unparse({
    fields: [...ALL_COLUMNS],
    data: rows.map(r => ALL_COLUMNS.map(col => r[col] ?? '')),
  });
}

// ============================================
// DOWNLOAD HELPER
// ============================================

export function downloadCsv(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// BUILD FINAL ASSETS FOR IMPORT
// ============================================

export function buildAssetsForImport(
  rows: ParsedRow[],
  selectedIndices: Set<number>,
  duplicateMode: 'skip' | 'overwrite',
): Asset[] {
  const now = Date.now();
  const assets: Asset[] = [];

  for (const row of rows) {
    if (!row.asset) continue;
    if (!selectedIndices.has(row.rowNumber)) continue;

    // Handle duplicates
    if (row.isDuplicate && duplicateMode === 'skip') continue;

    const isPrinter = row.asset.category === 'printer';

    // Generate ID — reuse existing for overwrites, else create new
    const id = (row.isDuplicate && duplicateMode === 'overwrite' && row.existingAssetId)
      ? row.existingAssetId
      : `${isPrinter ? 'printer' : 'material'}-${now}-${row.rowNumber}`;

    assets.push({
      ...row.asset,
      id,
    } as Asset);
  }

  return assets;
}

// ============================================
// HELPERS
// ============================================

function parsePositiveNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const num = Number(value.trim());
  if (isNaN(num) || num < 0) return null;
  return num;
}

function matchFilamentTypeFromCsv(input: string): FilamentType | null {
  // Try exact match (case-insensitive)
  for (const ft of VALID_FILAMENT_TYPES) {
    if (ft.toLowerCase() === input.toLowerCase()) return ft;
  }
  // Try startsWith match
  for (const ft of VALID_FILAMENT_TYPES) {
    if (input.toLowerCase().startsWith(ft.toLowerCase())) return ft;
  }
  return null;
}
