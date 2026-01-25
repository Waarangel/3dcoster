export type FilamentType =
  | 'PLA' | 'PLA Matte' | 'PLA Silk' | 'PLA Tough' | 'PLA-CF' | 'PLA Translucent'
  | 'PETG' | 'PETG HF' | 'PETG-CF' | 'PETG Translucent'
  | 'ABS' | 'ASA'
  | 'TPU' | 'TPU 95A' | 'TPU 85A'
  | 'PA6-CF' | 'PPA-CF'
  | 'PC'
  | 'PVA'
  | 'Other';

// Major currencies for 3D printing markets worldwide
export type Currency =
  | 'CAD'  // Canadian Dollar
  | 'USD'  // US Dollar
  | 'EUR'  // Euro (EU)
  | 'GBP'  // British Pound
  | 'AUD'  // Australian Dollar
  | 'NZD'  // New Zealand Dollar
  | 'CHF'  // Swiss Franc
  | 'SEK'  // Swedish Krona
  | 'NOK'  // Norwegian Krone
  | 'DKK'  // Danish Krone
  | 'PLN'  // Polish Złoty
  | 'CZK'  // Czech Koruna
  | 'JPY'  // Japanese Yen
  | 'CNY'  // Chinese Yuan
  | 'INR'  // Indian Rupee
  | 'BRL'  // Brazilian Real
  | 'MXN'  // Mexican Peso
  | 'ZAR'; // South African Rand

// Built-in asset categories
export type BuiltInCategory = 'filament' | 'consumable' | 'finishing' | 'tool' | 'packaging' | 'printer';

// Asset category - can be built-in or custom string
export type AssetCategory = BuiltInCategory | string;

// Unified Asset type (formerly Material + PrinterConfig)
export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  brand?: string;
  notes?: string;
  currency?: Currency;
  tags?: string[]; // Custom tags for additional classification

  // Material-specific fields (filament, consumable, finishing, tool)
  unit?: string;
  costPerUnit?: number;
  unitsPerPackage?: number;
  packageCost?: number;
  lifespanUnits?: number;
  filamentType?: FilamentType;

  // Printer-specific fields
  purchasePrice?: number;
  expectedLifespanHours?: number;
  wattage?: number;
  nozzleCost?: number;
  nozzleLifespanCm3?: number;
}

// Type alias for backwards compatibility
export type Material = Asset;

// Helper type for printer assets
export interface PrinterAsset extends Asset {
  category: 'printer';
  purchasePrice: number;
  expectedLifespanHours: number;
  wattage: number;
  nozzleCost: number;
  nozzleLifespanCm3: number;
}

// Legacy PrinterConfig type (maps to PrinterAsset for backwards compatibility)
export interface PrinterConfig {
  id: string;
  name: string;
  purchasePrice: number;
  expectedLifespanHours: number;
  wattage: number;
  nozzleCost: number;
  nozzleLifespanCm3: number;
}

// A user's specific printer instance (they may have multiple of the same model)
export interface PrinterInstance {
  id: string;
  printerConfigId: string; // References a PrinterConfig
  nickname: string; // User-defined name like "Office A1" or "Garage P1S"
  printHours: number; // Total hours this specific machine has printed
  purchaseDate?: Date;
  notes?: string;

  // Cost recovery settings (user's actual investment)
  actualPurchasePrice?: number;          // What user actually paid (may differ from MSRP)
  recoveryMonths?: number;               // Target months to recover investment (e.g., 6, 12, 24)
  estimatedMonthlyPrintHours?: number;   // How many hours/month user expects to print
}

export interface MaterialUsage {
  materialId: string;
  quantity: number;
}

export interface ElectricityConfig {
  costPerKwh: number;
}

export interface LaborConfig {
  hourlyRate: number;
}

export interface CostBreakdown {
  filament: number;
  electricity: number;
  printerDepreciation: number;
  nozzleWear: number;
  modelAmortization: number;
  materials: number;
  labor: number;
  subtotal: number;
  failureAdjusted: number;
  profitMargin: number;
  targetProfit: number;
  sellingPrice: number;
}

// A saved print job with break-even tracking
export interface PrintJob {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  // Print parameters
  filamentId: string;
  filamentGrams: number;
  printTimeHours: number;
  printerInstanceId: string; // References a PrinterInstance

  // Model costs
  modelCost: number;
  modelCostPerUnit?: boolean;    // If true, model cost is charged per unit (licensing), not amortized
  authorMinPrice?: number;        // Author's minimum sell price (for warning if underselling)

  // Post-processing
  prepTimeMinutes: number;
  postProcessingMinutes: number;
  materialsUsed: MaterialUsage[];

  // Risk
  failureRate: number;

  // Calculated costs (stored for historical reference)
  costPerUnit: number;

  // Pricing
  sellingPrice: number;

  // Break-even tracking
  copiesSold: number;

  // Notes
  notes?: string;
}

// Sales record for a print job
export interface Sale {
  id: string;
  jobId: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  soldAt: Date;
  customerName?: string;
  notes?: string;
  // Shipping for this specific sale (may differ from job default)
  shippingMethod?: ShippingMethodType;
  shippingCost?: number;
  marketplace?: MarketplaceType;
  marketplaceFee?: number;
}

// User profile with preferences
export interface UserProfile {
  currency: Currency;
  name?: string;
  // Labor rate (what your time is worth)
  laborHourlyRate: number;
  // Address for shipping calculations
  address?: {
    street?: string;
    city?: string;
    province?: string;  // Province/State/Region
    postalCode?: string;
    country?: string;   // ISO 3166-1 alpha-2 country code
  };
  // UI preferences
  assetLibraryItemsPerPage?: number;
}

// Built-in shipping carriers
export type BuiltInCarrier = 'local_pickup' | 'dropoff' | 'ups' | 'fedex' | 'purolator' | 'usps' | 'dhl' | 'royal_mail' | 'australia_post' | 'canada_post';

// Shipping method can be built-in or custom carrier ID
export type ShippingMethodType = BuiltInCarrier | string;

// Custom carrier defined by user
export interface CustomCarrier {
  id: string;
  name: string;
  defaultCost: number;
}

// Shipping configuration
export interface ShippingConfig {
  // Local delivery settings
  maxDeliveryRadiusKm: number;  // Maximum km for pickup/dropoff
  gasPricePerLiter: number;     // Current fuel price
  vehicleFuelEfficiency: number; // L/100km

  // Built-in carrier flat rates (user can override per job)
  upsBaseCost: number;
  fedexBaseCost: number;
  purolatorBaseCost: number;
  uspsBaseCost: number;
  dhlBaseCost: number;
  royalMailBaseCost: number;
  australiaPostBaseCost: number;
  canadaPostBaseCost: number;

  // User-defined custom carriers
  customCarriers: CustomCarrier[];
}

// Shipping selection for a specific job/sale
export interface ShippingSelection {
  method: ShippingMethodType;
  distanceKm?: number;         // For dropoff
  carrierCost?: number;        // Override carrier cost
  calculatedCost: number;      // Final calculated cost
}

// Built-in marketplace types
export type BuiltInMarketplace =
  | 'none'                // Direct sale, no marketplace
  | 'facebook_local'      // Facebook Marketplace - local pickup (0% fee)
  | 'facebook_shipped'    // Facebook Marketplace - shipped (10% + processing)
  | 'etsy'                // Etsy (6.5% transaction + 3% + $0.25 payment + $0.20 listing)
  | 'etsy_offsite_ad'     // Etsy with offsite ad (adds 12-15%)
  | 'kijiji'              // Kijiji (CAD) - free for most listings
  | 'ebay'                // eBay
  | 'amazon_handmade';    // Amazon Handmade

// Marketplace can be built-in or custom marketplace ID
export type MarketplaceType = BuiltInMarketplace | string;

// Custom marketplace defined by user
export interface CustomMarketplace {
  id: string;
  name: string;
  feePercent: number;       // Percentage fee (e.g., 10 for 10%)
  fixedFee: number;         // Fixed fee per transaction
  notes?: string;           // User notes about the marketplace
}

// Marketplace fee configuration
export interface MarketplaceFees {
  // Facebook Marketplace
  facebookShippedPercent: number;       // 10%
  facebookMinFee: number;               // $0.80 minimum
  facebookProcessingPercent: number;    // 2.9%

  // Etsy
  etsyTransactionPercent: number;       // 6.5%
  etsyPaymentPercent: number;           // 3%
  etsyPaymentFixed: number;             // $0.25
  etsyListingFee: number;               // $0.20
  etsyOffsiteAdPercent: number;         // 12-15% (use 15% as default)

  // Kijiji - generally free for basic listings
  kijijiFeaturedFee: number;            // Optional featured listing

  // eBay fees
  ebayFinalValuePercent: number;        // 12.9% for most categories
  ebayFixedFee: number;                 // $0.30 per order

  // Amazon Handmade
  amazonHandmadePercent: number;        // 15% referral fee

  // User-defined custom marketplaces
  customMarketplaces: CustomMarketplace[];
}

// App-wide settings (separate from user profile)
export interface AppSettings {
  // Future: API keys for shipping integrations
  // canadaPostApiKey?: string;
  // uspsApiKey?: string;
  // etc.

  // Theme preferences (future)
  // theme?: 'dark' | 'light' | 'system';
}
