export type FilamentType =
  | 'PLA' | 'PLA Matte' | 'PLA Silk' | 'PLA Tough' | 'PLA-CF' | 'PLA Translucent' | 'PLA Pure'
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
  // v1.8 inventory: warn when derived stock falls to/below this (asset's native
  // unit — grams for filament, units otherwise). Undefined = no low-stock flag.
  lowStockThreshold?: number;
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

// v1.8 inventory ledger. Append-only stock movements; current stock for an
// asset is SUM(delta) over its events. `delta` is in the asset's native unit
// (grams for filament, units otherwise): negative = consumed, positive = added.
// `kind:'job'` events are keyed by `refId = PrintJob.id` with a deterministic
// id (`${jobId}__${assetId}`) so a re-save replaces them idempotently;
// `kind:'manual'` events use a fresh id for hand adjustments (e.g. a new spool).
export interface StockEvent {
  id: string;
  assetId: string;
  delta: number;
  kind: 'job' | 'manual';
  refId: string;
  timestamp: Date;
  note?: string;
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

export interface FilamentUsage {
  filamentId: string;       // References Asset with category === 'filament'
  grams: number;
  pricePerGram?: number;    // User-editable override; undefined = fall back to asset costPerUnit
  currency?: Currency;      // Currency for the price override
}

// Customer details for the job (Phase 14 writes/reads).
// All fields optional; runtime validation lives in Phase 14's form (D-09).
export interface JobCustomer {
  name?: string;
  email?: string;
  address?: string;  // Freeform multi-line; PDF prints verbatim (D-08)
  company?: string;
  /**
   * Customer-bound notes (added 2026-05-22 as a Phase 14 post-closure follow-up).
   * Captures buyer-specific quirks/preferences that travel with the customer:
   * "prefers pickup", "always wants invoice emailed", "kid's birthday in May", etc.
   * Distinct from `Sale.notes` which describes the specific transaction.
   * Phase 15.1 Customer Library will inherit this field automatically since the
   * library customer record uses the same JobCustomer shape.
   */
  notes?: string;
}

/**
 * Saved customer library record (Phase 15.1 — D-01).
 * Extends JobCustomer so the per-Sale snapshot stays byte-identical: picking a
 * library customer fills `sale.customer = { name, email, company, address, notes }`
 * with zero field mapping. The library-only fields (id, createdAt, lastUsedAt)
 * are NEVER copied into the sale snapshot — by-value rule, D-05.
 */
export interface Customer extends JobCustomer {
  id: string;
  createdAt: Date;
  /**
   * Bumped when the customer is picked in the Record Sale combobox or when
   * silent email-match auto-link fires (D-03, D-07). NOT bumped by library
   * edits — semantics: "last used in business," not "last touched."
   */
  lastUsedAt?: Date;
}

/**
 * Quote lifecycle status (Phase 16 gap closure — D-17).
 *
 * Full enum INCLUDING `'draft'`. The `'draft'` variant is a LEGACY MIGRATION-ONLY
 * value emitted by the v7→v8 backfill in `src/db/backfill.ts` for pre-existing
 * PrintJobs that had a `quoteNumber` but no Sales. Runtime code MUST NEVER write
 * `'draft'` — that is enforced at the type level by `RuntimeQuoteStatus` below
 * (G6 lock — D-17). The wider `QuoteStatus` exists so legacy `'draft'` rows can
 * still be READ by the runtime (e.g. rendered in plan 16-11's Recent Quotes
 * section if a user expands a job whose backfill emitted a draft).
 */
export type QuoteStatus = 'sent' | 'accepted' | 'declined' | 'converted' | 'draft';

/**
 * Runtime-only Quote status (Phase 16 gap closure — BLOCKER I-03 fix, G6 lock).
 *
 * Narrowed to the 3 states the second-extension UX surface tracks (D-24):
 * `'sent'` (Pending) / `'declined'` (Declined) / `'converted'` (Sale created).
 *
 * Excludes BOTH `'draft'` (migration-only) AND `'accepted'` (legacy — the
 * pre-second-extension UI used Mark Accepted as an in-between state; D-25
 * removed that button because accept = sale = Convert to Sale in one click).
 * Pre-extension data containing `'accepted'` is still readable (Quote.status
 * is the wider `QuoteStatus` on the interface) and reads as Pending in the
 * UI — see JobsManager status-pill mapping.
 *
 * The compiler REFUSES `status: 'draft'` AND `status: 'accepted'` at every
 * NEW Quote constructor / patch call site. PrintQuoteModal's createQuote
 * (plan 16-10) and the Convert-to-Sale Quote patch (plan 16-12) declare
 * their write payload's `status` field as `RuntimeQuoteStatus`.
 *
 * The migration helper in `src/db/backfill.ts` is the SOLE module allowed
 * to use the wider `QuoteStatus` when constructing `'draft'` backfill rows.
 */
export type RuntimeQuoteStatus = Exclude<QuoteStatus, 'draft' | 'accepted'>;

/**
 * First-class Quote entity (Phase 16 gap closure — D-17 G4 + G7 locks).
 *
 * Strict by-value snapshot rule (D-17 G4): a Quote captures the customer and
 * line-item state AT the moment Generate Quote fires. Subsequent edits to the
 * source PrintJob or UserProfile do NOT mutate already-issued Quotes. The PDF
 * generator's refactored signature `generateQuotePdf(quote: Quote)` accepts a
 * Quote argument ONLY — this is type-level enforcement of the snapshot rule.
 *
 * The `status` field is typed as the wider `QuoteStatus` (so legacy `'draft'`
 * rows from the v7→v8 backfill can be READ), but every runtime WRITE payload
 * declares `status: RuntimeQuoteStatus` so the compiler refuses `'draft'` at
 * the call site (per BLOCKER I-03 / G6 lock).
 */
export interface Quote {
  id: string;
  /** 4-digit display via formatQuoteNumber(); REQUIRED (no `?`) — type system locks presence at render time. */
  quoteNumber: number;
  /** FK to PrintJob.id */
  printJobId: string;
  /** FK to Customer.id (undefined when no library link — e.g. user typed values with no email match) */
  customerId?: string;
  /** By-value snapshot of customer fields at Generate time (D-17 G4) */
  customerSnapshot: JobCustomer;
  /** By-value snapshot of priced + identity fields at Generate time (D-17 G4) */
  lineItemsSnapshot: {
    jobTitle: string;
    sellingPrice: number;
    /** D-15: shipping line on the PDF. Default 0 when omitted. */
    shippingCost: number;
    /** D-21 lock: the RESOLVED tax rate (post-fallback), NOT the raw user override. */
    resolvedTaxRate: number;
    /** D-22 lock: computed as sellingPrice × (resolvedTaxRate / 100). Shipping is NOT in the tax base. */
    taxAmount: number;
    currency: Currency;
    /** PrintJob.notes at Generate time (may be '') */
    notes: string;
    /** UserProfile.defaultTerms at Generate time (may be '') */
    terms: string;
    /** UserProfile.address.country at Generate time — taxLabelFor reproducibility */
    countryAtSendTime?: string;
  };
  /**
   * Wider type so legacy 'draft' rows from v7→v8 backfill can be READ.
   * Runtime WRITES declare their payload `status: RuntimeQuoteStatus` so the
   * compiler refuses 'draft' at the call site (BLOCKER I-03 / G6 lock).
   */
  status: QuoteStatus;
  createdAt: Date;
  /** For v1.2, sentAt === createdAt (PDF generation IS sent per G6 lock). */
  sentAt: Date;
  /** Set when the user marks Declined or Convert-to-Sale fires (second extension D-25 collapsed Accepted into Convert). */
  decisionAt?: Date;
  /** Set when Convert to Sale fires (plan 16-12). */
  convertedAt?: Date;
  /** FK to Sale.id on conversion (plan 16-12). */
  convertedToSaleId?: string;
  /**
   * Free-form reason captured via DeclineQuoteModal when the user clicks
   * Mark Declined (second extension D-28). Optional — empty when the user
   * declined without providing a reason. Cleared on Reopen.
   * Future tags integration may migrate this into a structured tag.
   */
  declineReason?: string;
}

// A saved print job with break-even tracking
export interface PrintJob {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  /**
   * @deprecated Phase 14 originally placed customer details on the job. On 2026-05-22 the
   * decision was revised: customer details belong on each Sale (different buyers per sale).
   * Kept on the type so pre-revision IndexedDB records still type-check; UI no longer reads
   * or writes this field. Safe to remove once the codebase is sure no v6 records carry it.
   */
  customer?: JobCustomer;

  // Tags (Phase 15)
  tags?: string[];

  // Print parameters
  filaments: FilamentUsage[];
  printTimeHours: number;
  printerInstanceId: string; // References a PrinterInstance

  // Model costs
  modelCost: number;
  modelCostPerUnit?: boolean;    // If true, model cost is charged per unit (licensing), not amortized
  authorMinPrice?: number;        // Author's minimum sell price (for warning if underselling)
  modelUrl?: string;              // Where the STL was purchased/downloaded — for finding it again later

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
  taxRate?: number;    // Phase 13: per-job override (percent)
  taxAmount?: number;  // Phase 13: computed sellingPrice * taxRate

  // Break-even tracking
  copiesSold: number;

  // Notes
  notes?: string;

  /**
   * @deprecated Phase 16 gap closure (D-17). Read-only after v7→v8 migration —
   * the `Quote.quoteNumber` field is the source of truth for new quotes.
   * Pre-migration PrintJobs that had this field set will have a Quote backfilled
   * from them (status='converted' if sold, status='draft' otherwise). Removed in
   * a follow-up cleanup phase.
   */
  quoteNumber?: number;

  // Per-job Etsy compliance self-review (Phase 14 — D-18).
  // Schema-extension note: this field is NOT enumerated in SCHEMA-01's explicit field list.
  // Adding it here mirrors how Phase 12 D-07 flagged quoteNumber — the field is optional
  // and non-indexed, so the Dexie v6 schema string `'id, name, createdAt, printerInstanceId'`
  // is unchanged and no migration is needed. Existing v6 records have etsyChecks === undefined
  // which renders as "no boxes ticked".
  etsyChecks?: Record<string, boolean>;

  // Cost-input snapshot (Phase 14 fix-up — D-18 schema-extension pattern).
  // These fields are part of trueCost computation in CostCalculator. Saving them on the
  // job lets Edit re-hydrate the exact form state that produced the saved costPerUnit;
  // otherwise the form falls back to sessionStorage / defaults and recomputes a different
  // (lower) cost on Edit, silently overwriting the saved value when the user re-saves.
  // All optional, non-indexed — Dexie v6 schema string unchanged. Existing v6 records have
  // these fields undefined; the form falls back to its existing defaults in that case.
  shippingMethod?: ShippingMethodType;
  shippingDistanceKm?: number;
  shippingOverrideCost?: number | null;
  packagingMaterials?: MaterialUsage[];
  marketplace?: MarketplaceType;

  // Break-even fixed-cost snapshot (Phase 22.1 D-02 schema-extension pattern).
  // Snapshotted at Save/Update time by CostCalculator from its `fixedCosts` memo so the
  // JobsManager break-even pill can converge on the Calculator's broader formula
  // (modelCost + depreciation + nozzleWear) without recomputing live printer state.
  // Undefined on legacy v8 records until `reconcileFixedCostsAtSave` (src/db/backfill.ts)
  // backfills them on next page load. Non-indexed — Dexie schema string unchanged, no
  // migration needed (mirrors the Phase 14 D-18 schema-extension fields above).
  fixedCostsAtSave?: { depreciation: number; nozzleWear: number };
  /**
   * The currency this job's money fields (costPerUnit, sellingPrice, taxAmount)
   * were calculated and stored in. A historical SNAPSHOT — stamped at save time
   * and displayed verbatim, never live-converted. Undefined on legacy records
   * until the v10 migration backfills it with the user's profile currency.
   */
  currency?: Currency;
}

// Sales record for a print job
export interface Sale {
  id: string;
  jobId: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  soldAt: Date;
  // Per-sale customer (Phase 14 revised — moved from PrintJob to Sale on 2026-05-22).
  // Optional. Pre-revision sales used `customerName` (string only). On read, JobsManager
  // displays `customer.name || customerName` for backwards compatibility.
  customer?: JobCustomer;
  /** @deprecated Use `customer.name` instead. Kept on the type so existing IndexedDB records still type-check. */
  customerName?: string;
  notes?: string;
  // Shipping for this specific sale (may differ from job default)
  shippingMethod?: ShippingMethodType;
  shippingCost?: number;
  marketplace?: MarketplaceType;
  marketplaceFee?: number;
  /**
   * Back-reference to the Quote that produced this Sale (Phase 16 D-20).
   * Set inside the Convert-to-Sale transaction in JobsManager (plan 16-12)
   * so the Recent Sales row can render a `← Q-NNNN` link back to the
   * originating Quote in the Recent Quotes section (plan 16-11).
   */
  convertedFromQuoteId?: string;
  /**
   * The currency this sale's money fields (unitPrice, totalRevenue, shippingCost,
   * marketplaceFee) were recorded in. A historical SNAPSHOT — a sale that happened
   * at €20 must always read €20, so this is stamped at save and never converted.
   * Undefined on legacy records until the v10 migration backfills it.
   */
  currency?: Currency;
}

// User profile with preferences
export interface UserProfile {
  currency: Currency;
  name?: string;
  // Labor rate (what your time is worth)
  laborHourlyRate: number;
  // Default profit margin (%) applied to new jobs and on clear/save
  defaultProfitMargin?: number;
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

  // Tax (Phase 13)
  defaultTaxRate?: number;

  // Default quote terms (Phase 16 D-09) — boilerplate for PDF Notes/Terms section.
  // Optional; omitted from PDF when empty/whitespace-only.
  defaultTerms?: string;
  // Quote numbering (Phase 16) — first quote is #1 (D-06); read via `?? 1`
  nextQuoteNumber?: number;
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

// App-wide settings (separate from user profile). Reserved for future settings
// (shipping API keys, theme preferences, etc.) — intentionally empty for now.
export type AppSettings = Record<string, never>;
