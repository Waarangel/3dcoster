import type { Asset, PrinterConfig } from '../types';
import { bambuFilaments } from './bambuFilaments';

// Generate stable IDs for Bambu filaments based on name
// e.g. "Bambu PLA Basic" → "bambu-pla-basic"
function toBambuId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Convert scraped Bambu filament catalog into Asset entries with stable IDs
export const bambuFilamentAssets: Asset[] = bambuFilaments.map(f => ({
  ...f,
  id: toBambuId(f.name),
})) as Asset[];

export const defaultMaterials: Asset[] = [
  // ============================================
  // BAMBU LAB FILAMENTS (from scraped catalog, USD pricing)
  // See src/data/bambuFilaments.ts for the full catalog
  // ============================================
  ...bambuFilamentAssets,

  // ============================================
  // FINISHING SUPPLIES
  // ============================================
  {
    id: 'sandpaper-120',
    name: 'Sandpaper 120 grit',
    category: 'finishing',
    unit: 'sheet',
    costPerUnit: 0.50,
    unitsPerPackage: 10,
    packageCost: 5,
    lifespanUnits: 3,
  },
  {
    id: 'sandpaper-220',
    name: 'Sandpaper 220 grit',
    category: 'finishing',
    unit: 'sheet',
    costPerUnit: 0.50,
    unitsPerPackage: 10,
    packageCost: 5,
    lifespanUnits: 3,
  },
  {
    id: 'sandpaper-400',
    name: 'Sandpaper 400 grit',
    category: 'finishing',
    unit: 'sheet',
    costPerUnit: 0.60,
    unitsPerPackage: 10,
    packageCost: 6,
    lifespanUnits: 4,
  },
  {
    id: 'primer-spray',
    name: 'Filler Primer Spray (12oz)',
    category: 'finishing',
    unit: 'oz',
    costPerUnit: 0.75,
    unitsPerPackage: 12,
    packageCost: 9,
    notes: 'Rustoleum filler primer',
  },
  {
    id: 'paint-spray',
    name: 'Spray Paint (12oz)',
    category: 'finishing',
    unit: 'oz',
    costPerUnit: 0.67,
    unitsPerPackage: 12,
    packageCost: 8,
  },
  {
    id: 'clear-coat',
    name: 'Clear Coat Spray (12oz)',
    category: 'finishing',
    unit: 'oz',
    costPerUnit: 0.83,
    unitsPerPackage: 12,
    packageCost: 10,
  },

  // ============================================
  // CONSUMABLES
  // ============================================
  {
    id: 'ipa',
    name: 'Isopropyl Alcohol 91% (32oz)',
    category: 'consumable',
    unit: 'oz',
    costPerUnit: 0.25,
    unitsPerPackage: 32,
    packageCost: 8,
  },
  {
    id: 'gloves-nitrile',
    name: 'Nitrile Gloves (100ct)',
    category: 'consumable',
    unit: 'pair',
    costPerUnit: 0.10,
    unitsPerPackage: 100,
    packageCost: 10,
  },
  {
    id: 'paper-towels',
    name: 'Paper Towels',
    category: 'consumable',
    unit: 'sheet',
    costPerUnit: 0.02,
    unitsPerPackage: 100,
    packageCost: 2,
  },

  // ============================================
  // PACKAGING
  // ============================================
  {
    id: 'bubble-wrap',
    name: 'Bubble Wrap (12" x 30ft roll)',
    category: 'packaging',
    unit: 'ft',
    costPerUnit: 0.33,
    unitsPerPackage: 30,
    packageCost: 10,
    notes: 'Standard 3/16" bubbles',
  },
  {
    id: 'packing-paper',
    name: 'Packing Paper (24" x 24" sheets)',
    category: 'packaging',
    unit: 'sheet',
    costPerUnit: 0.15,
    unitsPerPackage: 50,
    packageCost: 7.50,
  },
  {
    id: 'poly-mailer-small',
    name: 'Poly Mailer 6x9"',
    category: 'packaging',
    unit: 'ea',
    costPerUnit: 0.15,
    unitsPerPackage: 100,
    packageCost: 15,
  },
  {
    id: 'poly-mailer-medium',
    name: 'Poly Mailer 10x13"',
    category: 'packaging',
    unit: 'ea',
    costPerUnit: 0.20,
    unitsPerPackage: 100,
    packageCost: 20,
  },
  {
    id: 'box-small',
    name: 'Shipping Box 6x4x4"',
    category: 'packaging',
    unit: 'ea',
    costPerUnit: 0.75,
    unitsPerPackage: 25,
    packageCost: 18.75,
  },
  {
    id: 'box-medium',
    name: 'Shipping Box 8x6x4"',
    category: 'packaging',
    unit: 'ea',
    costPerUnit: 1.00,
    unitsPerPackage: 25,
    packageCost: 25,
  },
  {
    id: 'box-large',
    name: 'Shipping Box 12x9x6"',
    category: 'packaging',
    unit: 'ea',
    costPerUnit: 1.50,
    unitsPerPackage: 25,
    packageCost: 37.50,
  },
  {
    id: 'packing-tape',
    name: 'Packing Tape 2" x 55yd',
    category: 'packaging',
    unit: 'yd',
    costPerUnit: 0.07,
    unitsPerPackage: 55,
    packageCost: 4,
    lifespanUnits: 20,
    notes: 'Per roll, ~20 uses per roll',
  },
  {
    id: 'tissue-paper',
    name: 'Tissue Paper (20x26" sheets)',
    category: 'packaging',
    unit: 'sheet',
    costPerUnit: 0.08,
    unitsPerPackage: 100,
    packageCost: 8,
    notes: 'White gift tissue',
  },
  {
    id: 'thank-you-card',
    name: 'Thank You Cards',
    category: 'packaging',
    unit: 'ea',
    costPerUnit: 0.20,
    unitsPerPackage: 50,
    packageCost: 10,
    notes: 'Business card size',
  },

  // ============================================
  // TOOLS
  // ============================================
  {
    id: 'flush-cutters',
    name: 'Flush Cutters',
    category: 'tool',
    unit: 'use',
    costPerUnit: 0.01,
    unitsPerPackage: 1,
    packageCost: 8,
    lifespanUnits: 500,
  },
  {
    id: 'deburring-tool',
    name: 'Deburring Tool',
    category: 'tool',
    unit: 'use',
    costPerUnit: 0.02,
    unitsPerPackage: 1,
    packageCost: 12,
    lifespanUnits: 500,
  },
];

// ============================================
// BAMBU LAB PRINTERS - As Assets
// Wattage is average during printing (not peak)
// Expected lifespan based on typical hobby/prosumer usage
// ============================================

export const defaultPrinterAssets: Asset[] = [
  {
    id: 'bambu-a1-mini',
    name: 'Bambu Lab A1 mini',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 299,
    expectedLifespanHours: 5000,
    wattage: 70,
    nozzleCost: 8,
    nozzleLifespanCm3: 15000,
  },
  {
    id: 'bambu-a1',
    name: 'Bambu Lab A1',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 399,
    expectedLifespanHours: 5000,
    wattage: 90,
    nozzleCost: 8,
    nozzleLifespanCm3: 15000,
  },
  {
    id: 'bambu-p1p',
    name: 'Bambu Lab P1P',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 599,
    expectedLifespanHours: 6000,
    wattage: 100,
    nozzleCost: 8,
    nozzleLifespanCm3: 15000,
  },
  {
    id: 'bambu-p1s',
    name: 'Bambu Lab P1S',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 699,
    expectedLifespanHours: 6000,
    wattage: 100,
    nozzleCost: 8,
    nozzleLifespanCm3: 15000,
  },
  {
    id: 'bambu-p2s',
    name: 'Bambu Lab P2S',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 549,
    expectedLifespanHours: 6000,
    wattage: 100,
    nozzleCost: 12,
    nozzleLifespanCm3: 15000,
  },
  {
    id: 'bambu-x1c',
    name: 'Bambu Lab X1 Carbon',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 1199,
    expectedLifespanHours: 8000,
    wattage: 120,
    nozzleCost: 12,
    nozzleLifespanCm3: 15000,
  },
  {
    id: 'bambu-x1e',
    name: 'Bambu Lab X1E',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 1699,
    expectedLifespanHours: 10000,
    wattage: 130,
    nozzleCost: 12,
    nozzleLifespanCm3: 15000,
  },
  {
    id: 'bambu-h2s',
    name: 'Bambu Lab H2S',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 1249,
    expectedLifespanHours: 8000,
    wattage: 150,
    nozzleCost: 15,
    nozzleLifespanCm3: 20000,
  },
  {
    id: 'bambu-h2d',
    name: 'Bambu Lab H2D',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 1749,
    expectedLifespanHours: 10000,
    wattage: 200,
    nozzleCost: 15,
    nozzleLifespanCm3: 20000,
  },
  {
    id: 'bambu-h2c',
    name: 'Bambu Lab H2C',
    category: 'printer',
    brand: 'Bambu Lab',
    purchasePrice: 2399,
    expectedLifespanHours: 12000,
    wattage: 250,
    nozzleCost: 20,
    nozzleLifespanCm3: 25000,
  },
  // Popular third-party printers
  {
    id: 'creality-ender3-v3',
    name: 'Creality Ender-3 V3',
    category: 'printer',
    brand: 'Creality',
    purchasePrice: 199,
    expectedLifespanHours: 4000,
    wattage: 350,
    nozzleCost: 5,
    nozzleLifespanCm3: 10000,
  },
  {
    id: 'creality-k1',
    name: 'Creality K1',
    category: 'printer',
    brand: 'Creality',
    purchasePrice: 399,
    expectedLifespanHours: 5000,
    wattage: 350,
    nozzleCost: 8,
    nozzleLifespanCm3: 12000,
  },
  {
    id: 'prusa-mk4',
    name: 'Prusa MK4',
    category: 'printer',
    brand: 'Prusa',
    purchasePrice: 799,
    expectedLifespanHours: 8000,
    wattage: 100,
    nozzleCost: 25,
    nozzleLifespanCm3: 15000,
    notes: 'Kit price - assembled is $1099',
  },
  {
    id: 'prusa-mini',
    name: 'Prusa Mini+',
    category: 'printer',
    brand: 'Prusa',
    purchasePrice: 429,
    expectedLifespanHours: 6000,
    wattage: 80,
    nozzleCost: 20,
    nozzleLifespanCm3: 12000,
    notes: 'Kit price - assembled is $459',
  },
  {
    id: 'elegoo-neptune4-pro',
    name: 'Elegoo Neptune 4 Pro',
    category: 'printer',
    brand: 'Elegoo',
    purchasePrice: 259,
    expectedLifespanHours: 4000,
    wattage: 310,
    nozzleCost: 5,
    nozzleLifespanCm3: 10000,
  },
  {
    id: 'anycubic-kobra3',
    name: 'Anycubic Kobra 3',
    category: 'printer',
    brand: 'Anycubic',
    purchasePrice: 349,
    expectedLifespanHours: 4000,
    wattage: 400,
    nozzleCost: 6,
    nozzleLifespanCm3: 10000,
  },
];

// Combined default assets (materials + printers)
export const defaultAssets: Asset[] = [...defaultMaterials, ...defaultPrinterAssets];

// Legacy exports for backwards compatibility
export const defaultPrinters: PrinterConfig[] = defaultPrinterAssets.map(asset => ({
  id: asset.id,
  name: asset.name,
  purchasePrice: asset.purchasePrice!,
  expectedLifespanHours: asset.expectedLifespanHours!,
  wattage: asset.wattage!,
  nozzleCost: asset.nozzleCost!,
  nozzleLifespanCm3: asset.nozzleLifespanCm3!,
}));

// Default printer for new users
export const defaultPrinter: PrinterConfig = defaultPrinters[0]; // A1 mini

// Helper to convert Asset to PrinterConfig
export function assetToPrinterConfig(asset: Asset): PrinterConfig | null {
  if (asset.category !== 'printer') return null;
  return {
    id: asset.id,
    name: asset.name,
    purchasePrice: asset.purchasePrice ?? 0,
    expectedLifespanHours: asset.expectedLifespanHours ?? 5000,
    wattage: asset.wattage ?? 100,
    nozzleCost: asset.nozzleCost ?? 10,
    nozzleLifespanCm3: asset.nozzleLifespanCm3 ?? 15000,
  };
}
