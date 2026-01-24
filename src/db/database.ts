import Dexie, { type EntityTable } from 'dexie';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, LaborConfig, PrintJob, Sale, UserProfile, ShippingConfig } from '../types';

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

export { db };

// Helper functions for settings
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await db.settings.get(key);
  if (!setting) return defaultValue;
  try {
    return JSON.parse(setting.value) as T;
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
} as const;

export async function getPrinter(defaultValue: PrinterConfig): Promise<PrinterConfig> {
  return getSetting(settingsKeys.printer, defaultValue);
}

export async function setPrinter(value: PrinterConfig): Promise<void> {
  return setSetting(settingsKeys.printer, value);
}

export async function getElectricity(defaultValue: ElectricityConfig): Promise<ElectricityConfig> {
  return getSetting(settingsKeys.electricity, defaultValue);
}

export async function setElectricity(value: ElectricityConfig): Promise<void> {
  return setSetting(settingsKeys.electricity, value);
}

export async function getLabor(defaultValue: LaborConfig): Promise<LaborConfig> {
  return getSetting(settingsKeys.labor, defaultValue);
}

export async function setLabor(value: LaborConfig): Promise<void> {
  return setSetting(settingsKeys.labor, value);
}

export async function getUserProfile(defaultValue: UserProfile): Promise<UserProfile> {
  return getSetting(settingsKeys.userProfile, defaultValue);
}

export async function setUserProfile(value: UserProfile): Promise<void> {
  return setSetting(settingsKeys.userProfile, value);
}

export async function getShippingConfig(defaultValue: ShippingConfig): Promise<ShippingConfig> {
  return getSetting(settingsKeys.shipping, defaultValue);
}

export async function setShippingConfig(value: ShippingConfig): Promise<void> {
  return setSetting(settingsKeys.shipping, value);
}
