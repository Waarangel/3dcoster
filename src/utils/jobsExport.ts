import type { MaterialUsage, PrintJob, Sale } from '../types';
import { sanitizeCsvCell } from './csvHelpers';

// ============================================
// COLUMN CONTRACTS
// ============================================
// Deprecated fields are intentionally absent: PrintJob.customer and
// PrintJob.quoteNumber (superseded per Phase 14/16), Sale.customerName
// (read only as a legacy fallback for customer_name), and
// Sale.convertedFromQuoteId (internal back-reference, not user data).
// fixedCostsAtSave / etsyChecks are internal computation artifacts and
// also excluded.

export const JOBS_EXPORT_COLUMNS = [
  'id', 'name', 'created_at', 'updated_at', 'tags', 'filaments',
  'print_time_hours', 'printer_instance_id', 'model_cost',
  'model_cost_per_unit', 'author_min_price', 'model_url',
  'prep_time_minutes', 'post_processing_minutes', 'materials_used',
  'failure_rate', 'cost_per_unit', 'selling_price', 'tax_rate',
  'tax_amount', 'copies_sold', 'shipping_method', 'shipping_distance_km',
  'shipping_override_cost', 'packaging_materials', 'marketplace',
  'currency', 'notes',
] as const;

export const SALES_EXPORT_COLUMNS = [
  'id', 'job_id', 'job_name', 'quantity', 'unit_price', 'total_revenue',
  'currency', 'sold_at', 'customer_name', 'customer_email',
  'shipping_method', 'shipping_cost', 'marketplace', 'marketplace_fee',
  'notes',
] as const;

const EXPORT_FILENAME_PREFIX = '3dcoster';

// ============================================
// FLATTENING HELPERS
// ============================================
// Arrays join with '|' to match the shipped assets-export tag convention
// (csvHelpers.ts generateExportCsv). One row per record — summaries keep
// spreadsheet aggregates (SUM over selling_price etc.) correct.

function toCell(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value);
}

function serializeDate(date: Date): string {
  return date.toISOString();
}

function flattenFilaments(job: PrintJob, assetNamesById: Map<string, string>): string {
  return job.filaments
    .map(f => `${assetNamesById.get(f.filamentId) ?? f.filamentId}:${f.grams}g`)
    .join('|');
}

function flattenMaterials(materials: MaterialUsage[] | undefined, assetNamesById: Map<string, string>): string {
  if (!materials || materials.length === 0) return '';
  return materials
    .map(m => `${assetNamesById.get(m.materialId) ?? m.materialId}:${m.quantity}`)
    .join('|');
}

// ============================================
// EXPORT GENERATORS
// ============================================

/**
 * Builds the Jobs export CSV. One row per job; money fields are written
 * VERBATIM in the job's snapshot `currency` — never live-FX-converted
 * (historical records are immutable). `assetNamesById` resolves filament
 * and material ids to display names, falling back to the raw id.
 */
export async function generateJobsExportCsv(
  jobs: PrintJob[],
  assetNamesById: Map<string, string>,
): Promise<string> {
  const { default: Papa } = await import('papaparse');

  const rows = jobs.map(job => {
    const row: Record<string, string> = {
      id: job.id,
      name: job.name,
      created_at: serializeDate(job.createdAt),
      updated_at: serializeDate(job.updatedAt),
      tags: job.tags?.join('|') ?? '',
      filaments: flattenFilaments(job, assetNamesById),
      print_time_hours: toCell(job.printTimeHours),
      printer_instance_id: job.printerInstanceId,
      model_cost: toCell(job.modelCost),
      model_cost_per_unit: toCell(job.modelCostPerUnit),
      author_min_price: toCell(job.authorMinPrice),
      model_url: toCell(job.modelUrl),
      prep_time_minutes: toCell(job.prepTimeMinutes),
      post_processing_minutes: toCell(job.postProcessingMinutes),
      materials_used: flattenMaterials(job.materialsUsed, assetNamesById),
      failure_rate: toCell(job.failureRate),
      cost_per_unit: toCell(job.costPerUnit),
      selling_price: toCell(job.sellingPrice),
      tax_rate: toCell(job.taxRate),
      tax_amount: toCell(job.taxAmount),
      copies_sold: toCell(job.copiesSold),
      shipping_method: toCell(job.shippingMethod),
      shipping_distance_km: toCell(job.shippingDistanceKm),
      shipping_override_cost: toCell(job.shippingOverrideCost),
      packaging_materials: flattenMaterials(job.packagingMaterials, assetNamesById),
      marketplace: toCell(job.marketplace),
      currency: toCell(job.currency),
      notes: toCell(job.notes),
    };
    return row;
  });

  // SEC-01 / D-02: every cell passes through sanitizeCsvCell at the
  // cell-serialization boundary — user-typed names, notes, tags, urls,
  // and marketplaces all reach this file (see csvHelpers.ts for the
  // invariant's rationale).
  return Papa.unparse({
    fields: [...JOBS_EXPORT_COLUMNS],
    data: rows.map(r => JOBS_EXPORT_COLUMNS.map(col => sanitizeCsvCell(r[col] ?? ''))),
  });
}

/**
 * Builds the Sales export CSV. One row per sale; money fields are written
 * VERBATIM in the sale's snapshot `currency`. `jobsById` denormalizes a
 * human-readable job_name (empty when the job was deleted). The deprecated
 * `customerName` is read only as a legacy fallback, mirroring JobsManager's
 * display rule.
 */
export async function generateSalesExportCsv(
  sales: Sale[],
  jobsById: Map<string, PrintJob>,
): Promise<string> {
  const { default: Papa } = await import('papaparse');

  const rows = sales.map(sale => {
    const row: Record<string, string> = {
      id: sale.id,
      job_id: sale.jobId,
      job_name: jobsById.get(sale.jobId)?.name ?? '',
      quantity: toCell(sale.quantity),
      unit_price: toCell(sale.unitPrice),
      total_revenue: toCell(sale.totalRevenue),
      currency: toCell(sale.currency),
      sold_at: serializeDate(sale.soldAt),
      customer_name: sale.customer?.name ?? sale.customerName ?? '',
      customer_email: sale.customer?.email ?? '',
      shipping_method: toCell(sale.shippingMethod),
      shipping_cost: toCell(sale.shippingCost),
      marketplace: toCell(sale.marketplace),
      marketplace_fee: toCell(sale.marketplaceFee),
      notes: toCell(sale.notes),
    };
    return row;
  });

  // SEC-01 / D-02: every cell passes through sanitizeCsvCell at the
  // cell-serialization boundary.
  return Papa.unparse({
    fields: [...SALES_EXPORT_COLUMNS],
    data: rows.map(r => SALES_EXPORT_COLUMNS.map(col => sanitizeCsvCell(r[col] ?? ''))),
  });
}

// ============================================
// FILENAME
// ============================================

const SCOPE_MAX_LENGTH = 30;

/**
 * `3dcoster-<entity>[-<scope>]-YYYY-MM-DD.csv`, dated with the local export
 * date. `scope` names a filtered export (a category or 'filtered') so a
 * partial file is never mistaken for a full backup. Scope may be a
 * user-typed custom category, so it is sanitized to filesystem-safe
 * kebab-case and omitted if nothing survives.
 */
export function buildExportFilename(entity: 'jobs' | 'sales' | 'assets', scope?: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const safeScope = scope
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SCOPE_MAX_LENGTH);
  const scopeSegment = safeScope ? `-${safeScope}` : '';
  return `${EXPORT_FILENAME_PREFIX}-${entity}${scopeSegment}-${yyyy}-${mm}-${dd}.csv`;
}
