import Dexie, { type EntityTable } from 'dexie';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, LaborConfig, PrintJob, Sale, UserProfile, ShippingConfig, MarketplaceFees, Customer, Quote } from '../types';
import { backfillTagsOnJob, backfillQuotesFromJobs } from './backfill';

// Settings stored as key-value pairs
interface Setting {
  key: string;
  value: string;
}

// Extend Dexie
const db = new Dexie('3DCosterDB') as Dexie & {
  materials: EntityTable<Material, 'id'>;
  printers: EntityTable<PrinterConfig, 'id'>;
  printerInstances: EntityTable<PrinterInstance, 'id'>;
  jobs: EntityTable<PrintJob, 'id'>;
  sales: EntityTable<Sale, 'id'>;
  settings: EntityTable<Setting, 'key'>;
  customers: EntityTable<Customer, 'id'>;
  quotes: EntityTable<Quote, 'id'>;
};

// Schema - version 3 (added jobs and sales tables)
db.version(1).stores({
  materials: 'id, category, brand, filamentType, currency',
  settings: 'key',
});

db.version(2).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  settings: 'key',
});

db.version(3).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  jobs: 'id, name, createdAt',
  sales: 'id, jobId, soldAt',
  settings: 'key',
});

db.version(4).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
});

db.version(5).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(job => {
    const hasFilament = job.filamentId && job.filamentId.trim() !== '';
    if (hasFilament) {
      job.filaments = [{
        filamentId: job.filamentId,
        grams: job.filamentGrams || 0,
        // pricePerGram intentionally omitted — form falls back to asset library price
      }];
    } else {
      job.filaments = [];
    }
    delete job.filamentId;
    delete job.filamentGrams;
  });
});

// v6: backfill tags=[] for Phase 15; all other new fields stay undefined (read-side fallback handles them)
// Schema strings IDENTICAL to v5 — no multi-entry index on tags per D-04
db.version(6).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(backfillTagsOnJob);
});

// v7: add `customers` library store (Phase 15.1 — D-02). New store starts empty;
// no row backfill on existing stores. The versionchange→reload handler below
// (already added in Phase 12 SCHEMA-02) covers v7 across multiple tabs.
db.version(7).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
  customers: 'id, name, email, lastUsedAt',  // email is non-unique index — fast lookup, no ConstraintError on duplicate
});

// v8: add `quotes` library store (Phase 16 gap closure — D-17 G7).
// Backfill: one Quote per PrintJob that has a quoteNumber set. PrintJobs
// with sales → Quote(status='converted'); PrintJobs without sales →
// Quote(status='draft'). PrintJobs without a quoteNumber are skipped.
//
// The pure-helper boundary (backfillQuotesFromJobs) is exhaustively tested
// in src/db/backfill.test.ts + src/db/database.migrations.test.ts — Dexie's
// transactional upgrade just pipes existing jobs+sales into the helper and
// bulkAdds the result. The versionchange→reload handler below (Phase 12
// SCHEMA-02) covers v8 multi-tab reload automatically.
db.version(8).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
  customers: 'id, name, email, lastUsedAt',
  quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',  // quoteNumber + status indexed per D-17
}).upgrade(async tx => {
  const jobs = await tx.table('jobs').toArray();
  const sales = await tx.table('sales').toArray();
  // DATA-03 forward fix: read user's currency from tx-scoped settings;
  // brand-new installs (no settings row yet) default to 'USD' — matches
  // current behavior for users who reach v8 without having opened settings.
  const settingsRow = await tx.table('settings').get('userProfile');
  let currency = 'USD';
  if (settingsRow) {
    try {
      currency = (JSON.parse(settingsRow.value) as UserProfile).currency;
    } catch {
      // Corrupt settings → fall through to 'USD'. The v9 reconcile (added below)
      // re-stamps these quotes if the user has a valid currency at next open.
    }
  }
  const quotes = backfillQuotesFromJobs(jobs, sales, currency);
  if (quotes.length > 0) {
    await tx.table('quotes').bulkAdd(quotes);
  }
});

// Reload this tab if another tab loads a newer schema (SCHEMA-02 / D-10 / D-11).
// Without this, Dexie's default closes the connection and console.warn()s,
// which crashes the React tree via useLiveQuery references.
//
// DATA-05: handler is async so db.close() is awaited BEFORE window.location.reload().
// Without the await, in-flight transactions in this tab can be aborted mid-write when
// another tab triggers a schema bump (e.g. the v9 bump in plan 20-03).
// The named export allows database.test.ts to assert the close-then-reload order.
export async function handleVersionchange(): Promise<void> {
  await db.close();
  window.location.reload();
}
db.on('versionchange', handleVersionchange);

export { db };

// Helper functions for settings
export async function getSetting<T>(
  key: string,
  defaultValue: T,
  validator?: (parsed: unknown) => parsed is T,
): Promise<T> {
  const setting = await db.settings.get(key);
  if (!setting) return defaultValue;
  try {
    const parsed = JSON.parse(setting.value);
    if (validator && !validator(parsed)) {
      if (import.meta.env.DEV) {
        console.warn(`[getSetting] validator rejected stored "${key}"; using default`);
      }
      return defaultValue;
    }
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value: JSON.stringify(value) });
}

// Typed setting getters/setters
export const settingsKeys = {
  printer: 'printer',
  electricity: 'electricity',
  labor: 'labor',
  userProfile: 'userProfile',
  shipping: 'shipping',
  marketplaceFees: 'marketplaceFees',
} as const;

/** DATA-06 — structural validator for PrinterConfig stored in db.settings.
 *  Strict on numeric fields; loose on string fields. */
export function isPrinterConfig(x: unknown): x is PrinterConfig {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === 'string'
    && typeof o.name === 'string'
    && typeof o.purchasePrice === 'number'
    && typeof o.expectedLifespanHours === 'number'
    && typeof o.wattage === 'number'
    && typeof o.nozzleCost === 'number'
    && typeof o.nozzleLifespanCm3 === 'number';
}

export async function getPrinter(defaultValue: PrinterConfig): Promise<PrinterConfig> {
  return getSetting(settingsKeys.printer, defaultValue, isPrinterConfig);
}

export async function setPrinter(value: PrinterConfig): Promise<void> {
  return setSetting(settingsKeys.printer, value);
}

/** DATA-06 — structural validator for ElectricityConfig stored in db.settings.
 *  Strict on numeric fields. */
export function isElectricityConfig(x: unknown): x is ElectricityConfig {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.costPerKwh === 'number';
}

export async function getElectricity(defaultValue: ElectricityConfig): Promise<ElectricityConfig> {
  return getSetting(settingsKeys.electricity, defaultValue, isElectricityConfig);
}

export async function setElectricity(value: ElectricityConfig): Promise<void> {
  return setSetting(settingsKeys.electricity, value);
}

/** DATA-06 — structural validator for LaborConfig stored in db.settings.
 *  Strict on numeric fields. */
export function isLaborConfig(x: unknown): x is LaborConfig {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.hourlyRate === 'number';
}

export async function getLabor(defaultValue: LaborConfig): Promise<LaborConfig> {
  return getSetting(settingsKeys.labor, defaultValue, isLaborConfig);
}

export async function setLabor(value: LaborConfig): Promise<void> {
  return setSetting(settingsKeys.labor, value);
}

/** DATA-06 — structural validator for UserProfile stored in db.settings.
 *  Loose on string fields (currency validated as string only — NOT narrowed to
 *  the Currency union, per RESEARCH.md A4: tightening would reject future currency
 *  additions and crash old settings). Strict on numeric fields. */
export function isUserProfile(x: unknown): x is UserProfile {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.currency === 'string'
    && typeof o.laborHourlyRate === 'number';
}

export async function getUserProfile(defaultValue: UserProfile): Promise<UserProfile> {
  return getSetting(settingsKeys.userProfile, defaultValue, isUserProfile);
}

export async function setUserProfile(value: UserProfile): Promise<void> {
  return setSetting(settingsKeys.userProfile, value);
}

/** DATA-06 — structural validator for ShippingConfig stored in db.settings.
 *  Validates load-bearing numeric carrier fields. */
export function isShippingConfig(x: unknown): x is ShippingConfig {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return typeof o.maxDeliveryRadiusKm === 'number'
    && typeof o.gasPricePerLiter === 'number'
    && typeof o.vehicleFuelEfficiency === 'number'
    && typeof o.upsBaseCost === 'number'
    && typeof o.fedexBaseCost === 'number'
    && typeof o.purolatorBaseCost === 'number'
    && typeof o.uspsBaseCost === 'number'
    && typeof o.dhlBaseCost === 'number'
    && typeof o.royalMailBaseCost === 'number'
    && typeof o.australiaPostBaseCost === 'number'
    && typeof o.canadaPostBaseCost === 'number';
}

export async function getShippingConfig(defaultValue: ShippingConfig): Promise<ShippingConfig> {
  return getSetting(settingsKeys.shipping, defaultValue, isShippingConfig);
}

export async function setShippingConfig(value: ShippingConfig): Promise<void> {
  return setSetting(settingsKeys.shipping, value);
}

/** DATA-06 — structural validator for MarketplaceFees stored in db.settings.
 *  Validates load-bearing numeric fee fields across all built-in marketplaces. */
export function isMarketplaceFees(x: unknown): x is MarketplaceFees {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.facebookShippedPercent === 'number'
    && typeof o.facebookMinFee === 'number'
    && typeof o.facebookProcessingPercent === 'number'
    && typeof o.etsyTransactionPercent === 'number'
    && typeof o.etsyPaymentPercent === 'number'
    && typeof o.etsyPaymentFixed === 'number'
    && typeof o.etsyListingFee === 'number'
    && typeof o.etsyOffsiteAdPercent === 'number'
    && typeof o.kijijiFeaturedFee === 'number'
    && typeof o.ebayFinalValuePercent === 'number'
    && typeof o.ebayFixedFee === 'number'
    && typeof o.amazonHandmadePercent === 'number';
}

export async function getMarketplaceFees(defaultValue: MarketplaceFees): Promise<MarketplaceFees> {
  return getSetting(settingsKeys.marketplaceFees, defaultValue, isMarketplaceFees);
}

export async function setMarketplaceFees(value: MarketplaceFees): Promise<void> {
  return setSetting(settingsKeys.marketplaceFees, value);
}
