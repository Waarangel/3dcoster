import Dexie, { type EntityTable } from 'dexie';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, LaborConfig, PrintJob, Sale, UserProfile, ShippingConfig, MarketplaceFees, Customer, Quote, StockEvent } from '../types';
import { backfillTagsOnJob, backfillQuotesFromJobs, reconcileQuoteCurrency, stampRecordCurrency } from './backfill';
import type { FxRateTable } from '../utils/fxConvert';

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
  stockEvents: EntityTable<StockEvent, 'id'>;
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
      // HYG-12.3 C1: narrow to Partial<UserProfile> + typeof check (mirrors v9 pattern
      // at lines 179-181) so a corrupt/partial row cannot flow undefined into currency.
      const parsedV8 = JSON.parse(settingsRow.value) as Partial<UserProfile>;
      if (typeof parsedV8.currency === 'string' && parsedV8.currency.length > 0) {
        currency = parsedV8.currency;
      }
      // else fall through to the 'USD' default set above
    } catch (err) {
      console.error('[v8 migration] skipped — settings unreadable:', err);
      // Corrupt settings → fall through to 'USD'. The v9 reconcile (added below)
      // re-stamps these quotes if the user has a valid currency at next open.
    }
  }
  const quotes = backfillQuotesFromJobs(jobs, sales, currency);
  if (quotes.length > 0) {
    await tx.table('quotes').bulkAdd(quotes);
  }
});

// v9: DATA-03 reconcile — re-stamp any quote whose lineItemsSnapshot.currency
// is still 'USD' for a non-USD user. Closes the legacy-data gap left by the
// Phase 16 v8 hardcode. Per [[feedback_reconcile_legacy_data]] standing rule:
// every schema/behavior change touching a derived field ships with a one-time
// reconcile helper, not a forward-only fix. Schema string IDENTICAL to v8 —
// only the version number changes. Three layers of no-op guards keep this
// cheap for new users, USD users, and already-reconciled users.
//
// Plan-order constraint (RESEARCH.md): the async versionchange handler below
// MUST be registered before this stanza ships — when v9 lands, every other
// open tab fires versionchange. The async handler awaits db.close() so
// in-flight transactions in those tabs complete or roll back cleanly.
db.version(9).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
  customers: 'id, name, email, lastUsedAt',
  quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
}).upgrade(async tx => {
  // Layer 1: no settings → brand-new device. Nothing to reconcile.
  const settingsRow = await tx.table('settings').get('userProfile');
  if (!settingsRow) return;

  // Layer 2: corrupt settings → bail silently. Won't make it worse.
  // CR-01 hardening: JSON.parse can succeed but .currency may be undefined
  // (older partial-shape settings rows). Treat any non-string as a bail signal —
  // reconcileQuoteCurrency would otherwise stamp `undefined as Currency` onto
  // every USD quote because `undefined !== 'USD'` skips its early-return guard.
  let userCurrency: string;
  try {
    const parsed = JSON.parse(settingsRow.value) as Partial<UserProfile>;
    if (typeof parsed.currency !== 'string' || parsed.currency.length === 0) return;
    userCurrency = parsed.currency;
  } catch (err) {
    console.error('[v9 migration] skipped — settings unreadable:', err);
    return;
  }

  // Layer 3 (inside helper): currency === 'USD' → no drift possible. Helper
  // returns []. Single quotes scan + zero writes.
  const quotes = await tx.table('quotes').toArray();
  const patched = reconcileQuoteCurrency(quotes, userCurrency);
  if (patched.length === 0) return;

  await tx.table('quotes').bulkPut(patched);

  if (import.meta.env.DEV) {
    console.info(`[v9 reconcile] patched ${patched.length} quotes from USD → ${userCurrency}`);
  }
});

// v10 — stamp legacy PrintJob + Sale records with a snapshot `currency`. Their
// money fields (costPerUnit, sellingPrice, unitPrice, totalRevenue, …) were
// stored in the user's currency at save time but never tagged; without a tag
// they render with a hardcoded "$". Backfill them with the user's profile
// currency so they display correctly and stay fixed (historical records are
// snapshots — never live-converted). Schema strings are identical to v9
// (currency is non-indexed on both stores). Same two-layer bail-out as v9.
db.version(10).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
  customers: 'id, name, email, lastUsedAt',
  quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
}).upgrade(async tx => {
  // Layer 1: no settings → brand-new device (no jobs/sales to stamp). Bail.
  const settingsRow = await tx.table('settings').get('userProfile');
  if (!settingsRow) return;

  // Layer 2: corrupt / shape-incomplete settings → bail silently.
  let userCurrency: string;
  try {
    const parsed = JSON.parse(settingsRow.value) as Partial<UserProfile>;
    if (typeof parsed.currency !== 'string' || parsed.currency.length === 0) return;
    userCurrency = parsed.currency;
  } catch (err) {
    console.error('[v10 migration] skipped — settings unreadable:', err);
    return;
  }

  await tx.table('jobs').toCollection().modify(job => stampRecordCurrency(job, userCurrency));
  await tx.table('sales').toCollection().modify(sale => stampRecordCurrency(sale, userCurrency));

  if (import.meta.env.DEV) {
    console.info(`[v10 reconcile] stamped legacy jobs + sales with ${userCurrency}`);
  }
});

// v11 (v1.8): add the inventory `stockEvents` ledger. New empty store, so no
// upgrade/backfill — existing users start at zero derived stock and set their
// levels via the one-time Asset Library prompt.
db.version(11).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
  customers: 'id, name, email, lastUsedAt',
  quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
  stockEvents: 'id, assetId, refId, timestamp',
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
    console.error(`[getSetting] failed to parse stored "${key}"; using default`);
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
  fxRateTable: 'fxRateTable',
} as const;

/** Structural validator for the cached FX rate table. Requires the USD base, a
 *  rates object, and a date string. Rates themselves are validated lazily at
 *  conversion time (convert() rejects non-finite/non-positive entries), so a
 *  partially-corrupt table still yields usable rates for the good currencies. */
export function isFxRateTable(x: unknown): x is FxRateTable {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return o.base === 'USD'
    && typeof o.rates === 'object' && o.rates !== null
    && typeof o.date === 'string';
}

/** Read the cached USD-based FX rate table used for display-time currency
 *  conversion, or null if none is cached yet. */
export async function getFxRateTable(): Promise<FxRateTable | null> {
  return getSetting<FxRateTable | null>(
    settingsKeys.fxRateTable,
    null,
    (p): p is FxRateTable | null => p === null || isFxRateTable(p),
  );
}

/** Cache a freshly-fetched FX rate table in the settings store. */
export async function setFxRateTable(value: FxRateTable): Promise<void> {
  return setSetting(settingsKeys.fxRateTable, value);
}

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
 *  Validates load-bearing numeric carrier fields AND the required customCarriers
 *  array — without the array check, callers that .map/.forEach over
 *  customCarriers would receive a settings row that passes validation and
 *  then crashes at runtime (CR-03). */
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
    && typeof o.canadaPostBaseCost === 'number'
    && Array.isArray(o.customCarriers);
}

export async function getShippingConfig(defaultValue: ShippingConfig): Promise<ShippingConfig> {
  return getSetting(settingsKeys.shipping, defaultValue, isShippingConfig);
}

export async function setShippingConfig(value: ShippingConfig): Promise<void> {
  return setSetting(settingsKeys.shipping, value);
}

/** DATA-06 — structural validator for MarketplaceFees stored in db.settings.
 *  Validates load-bearing numeric fee fields across all built-in marketplaces
 *  AND the required customMarketplaces array — same array-shape concern as
 *  isShippingConfig (CR-03). Also rejects arrays explicitly (typeof [] === 'object'). */
export function isMarketplaceFees(x: unknown): x is MarketplaceFees {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
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
    && typeof o.amazonHandmadePercent === 'number'
    && Array.isArray(o.customMarketplaces);
}

export async function getMarketplaceFees(defaultValue: MarketplaceFees): Promise<MarketplaceFees> {
  return getSetting(settingsKeys.marketplaceFees, defaultValue, isMarketplaceFees);
}

export async function setMarketplaceFees(value: MarketplaceFees): Promise<void> {
  return setSetting(settingsKeys.marketplaceFees, value);
}
