import type { PrintJob, Sale, Quote, QuoteStatus, Customer, Currency } from '../types';

/**
 * Backfill `tags = []` on a job record that came from a pre-v6 schema.
 *
 * Used by the v6 Dexie upgrade callback in `database.ts` (Plan 03). Extracted
 * as a pure function so it can be unit-tested under jsdom (Vitest's environment),
 * which does NOT implement IndexedDB and therefore cannot run a full Dexie
 * migration test (RESEARCH Pitfall 3).
 *
 * Uses `Array.isArray` (not `??=`) so a manually-edited IndexedDB row with
 * `tags: "some-string"` or `tags: 42` is also normalised to `[]`.
 * The nullish-coalesce-assign operator (`??=`) only catches `null`/`undefined`;
 * the `Array.isArray` guard handles all non-array corruption modes that DevTools
 * can produce (RESEARCH Pitfall 5).
 *
 * No imports from `dexie` or `./database` — keeps this module jsdom-safe so
 * the sibling test can `import { backfillTagsOnJob } from './backfill'` without
 * triggering the `new Dexie('3DCosterDB')` top-level side effect (RESEARCH Pitfall 4).
 *
 * Examples:
 *   const j = {}; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: ['a', 'b'] }; backfillTagsOnJob(j); // j.tags === ['a', 'b'] (unchanged)
 *   const j = { tags: 'oops' }; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: null }; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: 42 }; backfillTagsOnJob(j); // j.tags === []
 */
export function backfillTagsOnJob(job: Record<string, unknown>): void {
  if (!Array.isArray(job.tags)) job.tags = [];
}

/**
 * D-02 maximum number of tags per job. Excess silently dropped after this cap
 * (the input parser surfaces a one-time inline warning; the reconcile path is
 * silent because it runs on app boot and has no UI surface).
 *
 * Centralized so `parseTagsInput` and `normalizeTagsOnJob` can never drift —
 * both functions read THIS constant, not a hard-coded literal.
 */
const TAGS_MAX = 10;

/**
 * _normalizeTagToken — Phase 15 D-02 single-token transform.
 *
 * Shared private helper used by BOTH `parseTagsInput` (input path) and
 * `normalizeTagsOnJob` (reconcile path) so the regex + the trim/lowercase
 * sequence cannot drift. Returns the cleaned token, or '' when the token
 * strips to empty (callers drop empty tokens before deduping).
 *
 * Whitelist: `/[^a-z0-9\s\-_]/g` — alphanumeric, whitespace, hyphen, underscore.
 * Emoji, punctuation, HTML-like characters are stripped. The result is safe to
 * render as plain text in React (no `<` or `>` can survive).
 */
function _normalizeTagToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9\s\-_]/g, '');
}

/**
 * normalizeTagsOnJob — Phase 15 D-12 reconcile (per [[reconcile-legacy-data]]).
 *
 * Phase 12's backfillTagsOnJob set tags=[] but never enforced D-02's normalization
 * rules (lowercase + trim + dedupe + cap-at-10 + whitelist /[^a-z0-9\s\-_]/g)
 * because those rules didn't exist yet. Any pre-Phase-15 record with hand-edited
 * tags via DevTools could carry uppercase, untrimmed, or punctuation-laced values
 * that the chip filter would treat as distinct from their normalized equivalents.
 *
 * Pure. Idempotent — no-op when tags already conform. Returns true if a write
 * is needed (caller decides whether to bulkPut), false otherwise.
 *
 * Mirrors the SAME normalization rules the CostCalculator + JobsManager inline
 * tag inputs apply on save (D-02). The shared transform lives in the private
 * `_normalizeTagToken` helper above so input + reconcile paths cannot drift.
 *
 * No imports from `dexie` or `./database` — keeps this module jsdom-safe so the
 * sibling test can `import { normalizeTagsOnJob } from './backfill'` without
 * triggering the `new Dexie('3DCosterDB')` top-level side effect.
 *
 * Examples:
 *   normalizeTagsOnJob({ tags: ['PLA', ' phone-stand '] }) → mutates to ['pla', 'phone-stand'], returns true
 *   normalizeTagsOnJob({ tags: ['pla', 'pla', 'pla'] })   → mutates to ['pla'], returns true
 *   normalizeTagsOnJob({ tags: ['pla'] })                  → no change, returns false
 *   normalizeTagsOnJob({ tags: undefined })                → no change, returns false
 *   normalizeTagsOnJob({ tags: ['pla!!', 'phone💀stand'] }) → mutates to ['pla', 'phonestand'], returns true
 *   normalizeTagsOnJob({ tags: Array.from({ length: 15 }, (_, i) => `tag${i}`) }) → mutates to length 10, returns true
 */
export function normalizeTagsOnJob(job: { tags?: string[] }): boolean {
  if (!Array.isArray(job.tags)) return false;  // backfillTagsOnJob already ran; nothing to normalize
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of job.tags) {
    if (typeof raw !== 'string') continue;
    const normalized = _normalizeTagToken(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(normalized);
    if (cleaned.length >= TAGS_MAX) break;  // D-02 cap
  }
  // Idempotency check — bail out without mutating when input is already canonical.
  if (cleaned.length === job.tags.length && cleaned.every((t, i) => t === job.tags![i])) {
    return false;
  }
  job.tags = cleaned;
  return true;
}

/**
 * parseTagsInput — Phase 15 D-02 (tag input parse — shares the same normalization
 * rules as normalizeTagsOnJob).
 *
 * Pipeline (D-02 line 39):
 *   raw.split(',')
 *     → .map(s => s.trim().toLowerCase())
 *     → .filter(s => s.length > 0)
 *     → whitelist strip /[^a-z0-9\s\-_]/g
 *     → drop entries that strip to empty
 *     → dedupe via Set<string>
 *     → cap at TAGS_MAX (10)
 *
 * Empty input (or input where every entry strips to empty) returns `undefined`
 * — NOT `[]` — to preserve the "no tags ever set" semantic per D-02 line 43.
 * The Phase 12 backfill normalizes legacy `undefined`/non-array shapes to `[]`,
 * but a freshly-saved job should leave the field `undefined` when the user
 * typed nothing.
 *
 * Re-uses the private `_normalizeTagToken` helper and the `TAGS_MAX` constant
 * with `normalizeTagsOnJob`. Single source of truth — the whitelist regex and
 * the cap appear ONCE in this module.
 *
 * No imports from `dexie` or `./database` — keeps this module jsdom-safe.
 *
 * Examples:
 *   parseTagsInput('PLA, phone-stand,  GLOSS ')             → ['pla', 'phone-stand', 'gloss']
 *   parseTagsInput('a, a, a')                                → ['a']
 *   parseTagsInput('phone stand, pla')                       → ['phone stand', 'pla'] (multi-word preserved)
 *   parseTagsInput('')                                       → undefined
 *   parseTagsInput('   ,,,  ')                               → undefined
 *   parseTagsInput('emoji💀,@@@')                            → ['emoji']      ('@@@' strips to '' → dropped)
 *   parseTagsInput(Array.from({length: 15}, (_,i)=>`t${i}`).join(',')) → length 10 (cap)
 */
export function parseTagsInput(raw: string): string[] | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const normalized = _normalizeTagToken(part);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(normalized);
    if (cleaned.length >= TAGS_MAX) break;  // D-02 cap — silent drop in helper, inline warning in the UI
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * backfillQuotesFromJobs — pure helper for v7→v8 migration (Phase 16 gap closure D-17 G7).
 *
 * Reads existing PrintJobs and Sales; returns the Quote rows that should be created.
 * No Dexie, no React, no IO. Mirrors backfillTagsOnJob's pure-function pattern so it
 * can be unit-tested under jsdom without an IndexedDB shim.
 *
 * TYPE-LEVEL NOTE (BLOCKER I-03 / G6 lock):
 * This is the SOLE module in the codebase allowed to WRITE `status='draft'`. Runtime
 * callers (PrintQuoteModal, Convert-to-Sale) use `RuntimeQuoteStatus = Exclude<QuoteStatus, 'draft'>`
 * which excludes 'draft' so the compiler refuses any accidental 'draft' write at those
 * call sites. The migration legitimately needs to emit 'draft' for legacy PrintJobs
 * that had a quoteNumber but no Sale — hence the wider `QuoteStatus` type is used here.
 *
 * Rules (per D-17):
 *  - For each PrintJob with `quoteNumber` set:
 *    - If the job has ≥1 Sale → emit Quote(status='converted', convertedToSaleId=mostRecentSale.id,
 *      customerSnapshot=mostRecentSale.customer ?? { name: mostRecentSale.customerName ?? '' },
 *      convertedAt=mostRecentSale.soldAt).
 *    - Else → emit Quote(status='draft', customerSnapshot={ name: '' }) — best-effort empty snapshot
 *      for legacy. No `convertedToSaleId`.
 *  - PrintJobs WITHOUT quoteNumber are SKIPPED — no Quote emitted, the PrintJob row is untouched.
 *
 * Currency is supplied by the caller. The v8 upgrade callback in database.ts reads
 * userProfile.currency from the tx-scoped settings record; brand-new installs (no settings
 * row) pass 'USD' as the safe default.
 *
 * Timestamps: createdAt = sentAt = new Date(job.createdAt) (best-effort lift from the job).
 */
export function backfillQuotesFromJobs(jobs: PrintJob[], sales: Sale[], currency: string): Quote[] {
  // Index sales by jobId for O(1) lookup (vs nested filter per job which is O(n×m)).
  const salesByJobId = new Map<string, Sale[]>();
  for (const sale of sales) {
    const list = salesByJobId.get(sale.jobId);
    if (list) list.push(sale);
    else salesByJobId.set(sale.jobId, [sale]);
  }

  const out: Quote[] = [];
  for (const job of jobs) {
    if (job.quoteNumber === undefined) continue;

    const jobSales = salesByJobId.get(job.id) ?? [];
    // Sort descending by soldAt — most recent first. Copy first to avoid mutating salesByJobId arrays.
    const sortedSales = [...jobSales].sort(
      (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
    );
    const mostRecentSale = sortedSales[0];

    const isConverted = mostRecentSale !== undefined;
    // STATUS WRITE: the SOLE site allowed to write 'draft'. Runtime call sites use
    // RuntimeQuoteStatus which excludes 'draft'; the compiler refuses 'draft' there.
    // Here the wider QuoteStatus type is the contract.
    const status: QuoteStatus = isConverted ? 'converted' : 'draft';

    const customerSnapshot = isConverted
      ? (mostRecentSale.customer ?? { name: mostRecentSale.customerName ?? '' })
      : { name: '' };

    const createdAt = new Date(job.createdAt);

    out.push({
      id: crypto.randomUUID(),
      quoteNumber: job.quoteNumber,
      printJobId: job.id,
      customerId: undefined,
      customerSnapshot,
      lineItemsSnapshot: {
        jobTitle: job.name,
        sellingPrice: job.sellingPrice ?? 0,
        shippingCost: 0,
        resolvedTaxRate: job.taxRate ?? 0,
        taxAmount: job.taxAmount ?? 0,
        currency: currency as Currency,
        notes: job.notes ?? '',
        terms: '',
        countryAtSendTime: undefined,
      },
      status,
      createdAt,
      sentAt: createdAt,
      ...(isConverted
        ? {
            convertedAt: new Date(mostRecentSale.soldAt),
            convertedToSaleId: mostRecentSale.id,
          }
        : {}),
    });
  }
  return out;
}

/**
 * backfillCustomersFromSales — second extension D-32 (gap K fix).
 *
 * One-time pass to populate the Customer Library with any customer that
 * exists ONLY on a historical Sale.customer snapshot (typically pre-Phase
 * 15.1 sales whose auto-create path never fired). Without this, the
 * PrintQuoteModal customer picker — which queries db.customers — can't
 * find them, even though they're visibly present on Sale rows. The user
 * surfaced this in UAT: typing "Logan" in the picker returned no match
 * even though Logan was clearly on a Sale.
 *
 * Pure helper. Returns the Customer rows that should be inserted. The
 * caller is responsible for the actual db.customers.bulkAdd. Mirrors the
 * backfillQuotesFromJobs / backfillTagsOnJob pattern — no Dexie, no
 * React, no IO — so jsdom can unit-test it without an IndexedDB shim.
 *
 * Idempotent: the dedup key is `(trimmed lowercase email) || (trimmed
 * lowercase name)`. A subsequent call with the same Sales + the freshly-
 * inserted Customers in `existingCustomers` returns an empty array.
 *
 * Skips Sales with NO usable identity:
 *   - no Sale.customer object AND no Sale.customerName (legacy field)
 *   - empty name AND empty email after trim
 *
 * lastUsedAt for the backfilled record = the most-recent Sale.soldAt for
 * any Sale whose customer matched this dedup key — semantically "last
 * used in business" per Phase 15.1 D-03.
 */
export function backfillCustomersFromSales(
  sales: Sale[],
  existingCustomers: Customer[],
): Customer[] {
  // Build the set of dedup keys already present in the library so we never
  // emit a Customer that would duplicate one. The picker's dedup is by
  // email, but a Sale may carry only a name with no email — fall back to
  // a name-based key in that case (matches the picker's substring search
  // surface; not a UNIQUE constraint, just a backfill collision-avoidance).
  const existingKeys = new Set<string>();
  for (const c of existingCustomers) {
    const emailKey = (c.email || '').trim().toLowerCase();
    if (emailKey) existingKeys.add(`email:${emailKey}`);
    const nameKey = (c.name || '').trim().toLowerCase();
    if (nameKey) existingKeys.add(`name:${nameKey}`);
  }

  // Aggregate Sales by dedup key so each emitted Customer carries the
  // most-recent soldAt across all matching Sales (lastUsedAt semantic).
  type Acc = {
    key: string;
    name?: string;
    email?: string;
    company?: string;
    address?: string;
    notes?: string;
    lastSoldAt: Date;
  };
  const accByKey = new Map<string, Acc>();

  for (const sale of sales) {
    const cust = sale.customer;
    const name = (cust?.name ?? sale.customerName ?? '').trim();
    const email = (cust?.email ?? '').trim();
    if (!name && !email) continue;  // Sale has no usable customer identity — skip

    const emailKey = email.toLowerCase();
    const nameKey = name.toLowerCase();
    const dedupKey = emailKey ? `email:${emailKey}` : `name:${nameKey}`;

    if (existingKeys.has(dedupKey)) continue;  // already in library

    const soldAt = new Date(sale.soldAt);
    const prev = accByKey.get(dedupKey);
    if (prev) {
      // Same dedup key across multiple Sales — keep the most-recent soldAt,
      // and merge in any non-empty fields the prior entry was missing.
      if (soldAt.getTime() > prev.lastSoldAt.getTime()) prev.lastSoldAt = soldAt;
      if (!prev.name && name) prev.name = name;
      if (!prev.email && email) prev.email = email;
      if (!prev.company && cust?.company) prev.company = cust.company;
      if (!prev.address && cust?.address) prev.address = cust.address;
      if (!prev.notes && cust?.notes) prev.notes = cust.notes;
    } else {
      accByKey.set(dedupKey, {
        key: dedupKey,
        name: name || undefined,
        email: email || undefined,
        company: cust?.company,
        address: cust?.address,
        notes: cust?.notes,
        lastSoldAt: soldAt,
      });
    }
  }

  const out: Customer[] = [];
  for (const acc of accByKey.values()) {
    out.push({
      id: crypto.randomUUID(),
      createdAt: acc.lastSoldAt,  // best-effort: we don't know when the customer was first added
      lastUsedAt: acc.lastSoldAt,
      name: acc.name,
      email: acc.email,
      company: acc.company,
      address: acc.address,
      notes: acc.notes,
    });
  }
  return out;
}

/**
 * reconcileCopiesSoldFromSales — self-heal job.copiesSold against the
 * authoritative sum of Sale.quantity per job (second extension hotfix
 * after the Convert-to-Sale regression that silently dropped the bump).
 *
 * Pure helper. Returns an array of { id, copiesSold } patches that the
 * caller applies via db.jobs.update or bulkPut. Idempotent — returns
 * an empty array when every job's copiesSold already matches its sales
 * sum.
 *
 * Why this exists: useSales().addSale + the Convert-to-Sale transaction
 * are the TWO write paths that bump job.copiesSold. Either one silently
 * skipping the bump (as the original Convert path did) leaves jobs with
 * stale counters that the break-even computation reads as gospel — the
 * UI surfaces "0 sold" even when the Orders list visibly shows multiple
 * sales. This reconcile runs once on app load so historical mistakes
 * self-heal AND any future drift (manual DB edits, race conditions,
 * test data) gets corrected on the next reload.
 *
 * Counter semantic: job.copiesSold = sum of Sale.quantity for every
 * Sale with Sale.jobId === job.id. Sales whose jobId points at a deleted
 * job are silently ignored (orphan-sale safety).
 */
export function reconcileCopiesSoldFromSales(
  jobs: PrintJob[],
  sales: Sale[],
): Array<{ id: string; copiesSold: number }> {
  const expectedByJobId = new Map<string, number>();
  for (const sale of sales) {
    const prev = expectedByJobId.get(sale.jobId) ?? 0;
    expectedByJobId.set(sale.jobId, prev + sale.quantity);
  }

  const out: Array<{ id: string; copiesSold: number }> = [];
  for (const job of jobs) {
    const expected = expectedByJobId.get(job.id) ?? 0;
    if (job.copiesSold !== expected) {
      out.push({ id: job.id, copiesSold: expected });
    }
  }
  return out;
}
