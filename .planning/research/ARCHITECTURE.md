# Architecture Patterns — v1.2 Quote-to-Customer Integration

**Domain:** Adding 7 features to an existing local-first React/Dexie SPA
**Researched:** 2026-05-20
**Source confidence:** HIGH — all conclusions drawn directly from source files read in full

---

## 1. Dexie Schema: v5 → v6

### Current state (v5)

```typescript
// src/db/database.ts — current
db.version(5).stores({
  materials:       'id, category, brand, filamentType, currency',
  printers:        'id, name',          // orphan, carried forward
  printerInstances:'id, printerConfigId, nickname',
  jobs:            'id, name, createdAt, printerInstanceId',
  sales:           'id, jobId, soldAt',
  settings:        'key',
})
```

`PrintJob` in `src/types.ts` does NOT yet have `tags`, `customer`, `taxRate`, or `taxAmount`.

### Schema delta — v6

The new fields are all optional on `PrintJob`. Dexie only indexes fields you declare in the store string; optional fields that are not indexed need no schema change — they simply appear or don't on the stored object. The only new indexed field we need is `tags` (for `.where('tags').anyOf(...)` queries if we ever want DB-level tag filtering, but see note below).

**Decision: do NOT add `tags` as a Dexie index.** Filter at the React layer (after `useLiveQuery`) because:
- The virtualized list already materialises all jobs into memory for react-window.
- Tag filtering is a pure JS `.filter()` over that in-memory array — no DB round trip needed.
- Dexie multi-value index syntax (`*tags`) is not supported in Dexie v4's `stores()` string; it requires the `MultiEntry` workaround and adds migration complexity for no measurable gain at current data volumes.

**What v6 actually needs:** A new `db.version(6)` call to upgrade `customer` and `taxRate` fields is only required if we want to *index* them. We do not. Therefore v6 is a **data-only migration** with no store-string change — just an `upgrade()` that fills missing fields on existing jobs.

```typescript
// src/db/database.ts — v6 addition
db.version(6).stores({
  materials:       'id, category, brand, filamentType, currency',
  printers:        'id, name',
  printerInstances:'id, printerConfigId, nickname',
  jobs:            'id, name, createdAt, printerInstanceId',  // store string unchanged
  sales:           'id, jobId, soldAt',
  settings:        'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(job => {
    if (!Array.isArray(job.tags))     job.tags     = [];
    if (job.customer === undefined)   job.customer  = undefined;  // explicit undefined is a no-op; skip
    if (job.taxRate === undefined)    job.taxRate   = undefined;  // per-job override absent = inherit
    if (job.taxAmount === undefined)  job.taxAmount = undefined;
  });
});
```

In practice the upgrade body is a no-op for `customer`/`taxRate`/`taxAmount` (IndexedDB stores `undefined` fields as absent, which is what we want). The only meaningful write is `job.tags = []` for existing records that have no tags array — this makes the `Array.isArray(job.tags)` guard safe everywhere.

### Type delta in `src/types.ts`

```typescript
// New interface — add to src/types.ts
export interface JobCustomer {
  name?:    string;
  email?:   string;
  address?: string;   // free-text; not the UserProfile.address struct
}

// Additions to PrintJob interface
export interface PrintJob {
  // ... existing fields unchanged ...

  // v1.2 additions
  tags?:      string[];       // User-defined labels; [] for untagged jobs
  customer?:  JobCustomer;    // Optional customer details for this job
  taxRate?:   number;         // Per-job override (%). undefined = inherit from Settings/region
  taxAmount?: number;         // Computed and stored at save time for PDF snapshot accuracy
}
```

### `UserProfile` additions (tax Settings layer)

```typescript
// Addition to UserProfile in src/types.ts
export interface UserProfile {
  // ... existing fields ...
  defaultTaxRate?: number;    // User-set override (%). undefined = region lookup
}
```

### Tax rate resolution order (three-layer model)

```
1. job.taxRate        — per-job override (most specific)
2. profile.defaultTaxRate — Settings → Pricing (user override)
3. TAX_RATES[profile.address?.country ?? '']  — region lookup (src/data/taxRates.ts, new static JSON)
4. 0                  — fallback: US/no-tax default
```

Region lookup is a new `src/data/taxRates.ts` file: a `Record<string, number>` keyed by ISO 3166-1 alpha-2 country code (e.g., `{ CA: 5, GB: 20, DE: 19, AU: 10, ... }`). ~30 entries covers the 90% case. This is **static** — no API, no DB table needed.

### Downgrade safety (old client opens v6 DB)

IndexedDB schema version numbers are monotonically increasing. An old client (running code compiled against v5) opening a v6 database will trigger Dexie's version conflict path and **throw a `VersionError`**, blocking the DB open. This is standard Dexie behaviour and cannot be avoided.

**Mitigation:** This only affects users who install v1.2, then somehow revert to an older build. In practice:
- Web users always load the latest deployed version (Vercel auto-deploys on push to main). Version rollback for a web user would require them to manually serve an old bundle, which is not a supported scenario.
- Desktop users who downgrade a Tauri build would need to uninstall and reinstall an older `.dmg`/`.exe`. The UpdateBanner already directs users to download the latest version. A downgrade path is not advertised.

**No downgrade guard code is warranted** — the standard Dexie `VersionError` on open is the correct behaviour (prevents data corruption from an older schema writing over v6 records).

---

## 2. Cost Math Integration

### Where tax fits

Tax is applied **after the fully-resolved selling price** — it is not part of the cost model but part of the quote. The existing `calculateCost()` produces `sellingPrice` (the pre-tax price the seller intends to receive). Tax is then applied as a display/quote layer on top.

The order is:

```
filamentCost + electricityCost + depreciation + nozzleWear + ...
  → subtotal (per-unit costs)
  → failureAdjusted (× failure multiplier)
  → sellingPrice (user-set or profit-margin-derived)
  → taxAmount = sellingPrice × (taxRate / 100)        ← NEW, not in calculateCost
  → totalWithTax = sellingPrice + taxAmount            ← display only
```

Tax does **not** enter `calculateCost()`. It is a **display/snapshot concern**, not a cost-calculation concern. Reasons:

1. Tax is jurisdiction-imposed on the buyer; it does not change the seller's underlying cost or required margin.
2. Sellers may or may not collect tax (tax-inclusive pricing is common outside the US). Adding it to the cost math would conflate two separate concerns.
3. `CostBreakdown` is a snapshot of costs; tax is a function of where/when you sell, not of the print.

**CalcInput / CalcResult delta: zero.** Neither `CalcInput` nor `CostBreakdown` gains new fields.

**New pure helper in `src/utils/costCalc.ts`:**

```typescript
export function calculateTax(sellingPrice: number, taxRatePercent: number): number {
  if (taxRatePercent <= 0) return 0;
  return sellingPrice * (taxRatePercent / 100);
}
```

This helper is used:
- In `CostCalculator.tsx` for the live "Tax" row in the pricing section (display only, not saved into `CostBreakdown`)
- At job save time to compute `job.taxAmount` (snapshot for PDF accuracy)
- In `JobsManager.tsx` for display on job cards (optional)
- In the PDF renderer (definitive)

The `it.todo('tax/VAT applies after subtotal — activates in v1.2')` test in `costCalc.test.ts` should be filled in testing `calculateTax`, not `calculateCost`.

**Tax-inclusive vs tax-exclusive flag:** Not needed for v1.2. All display is tax-exclusive (price + tax shown separately). A `taxInclusive?: boolean` field on `PrintJob` can be deferred to v1.3 if demand surfaces.

---

## 3. PDF Rendering Component

### Architecture decision: page route, not modal or iframe

Use a dedicated page route `/app/quote/:jobId` (or `/quote/:jobId` for the web). This is the correct pattern because:

- A real `.pdf` file download is the goal, not an in-page preview. Modals constrain layout and make full-bleed PDF styling harder.
- Hidden iframes are a workaround pattern that fights the browser's PDF rendering pipeline.
- A page route is lazy-loaded via `React.lazy()` at the exact same point as the marketing pages — no architectural novelty, same pattern already in `src/main.tsx`.
- The "preview" UX is the page itself: the user sees the quote in a styled page component, then clicks "Download PDF" to trigger the client-side library.

### Component and chunk strategy

```
src/components/QuoteRenderer.tsx      ← the page component (layout, data loading)
src/utils/pdfExport.ts                ← PDF library calls; dynamically imported from QuoteRenderer
```

`QuoteRenderer` is lazy-loaded at the route level:

```typescript
// src/main.tsx addition
const QuoteRenderer = lazy(() => import('./components/QuoteRenderer.tsx').then(m => ({ default: m.QuoteRenderer })))

// Routes addition
<Route path="/quote/:jobId" element={<QuoteRenderer />} />
```

The PDF library itself (`jspdf` or `pdf-lib`) is **not** bundled with `QuoteRenderer` directly. Instead, `pdfExport.ts` does a dynamic import when the user clicks "Download PDF":

```typescript
// src/utils/pdfExport.ts
export async function downloadQuotePdf(job: PrintJob, profile: UserProfile): Promise<void> {
  const { jsPDF } = await import('jspdf');  // deferred; only downloaded on click
  // ... build PDF ...
}
```

This gives two levels of lazy loading:
1. `QuoteRenderer` chunk is only downloaded when the user navigates to `/quote/:jobId` (via the "Preview Quote" button in `JobsManager`)
2. The PDF library chunk is only downloaded when the user clicks "Download PDF" within `QuoteRenderer`

Users who never generate a PDF pay zero bundle cost.

### Vite chunk naming

The `manualChunks` function in `vite.config.ts` returns `undefined` for non-`node_modules` ids, which means Rollup creates the lazy chunk from `React.lazy()` automatically. No change to `manualChunks` is needed; both `QuoteRenderer` and the PDF library will become separate dynamic chunks automatically.

### Preview UX flow

```
JobsManager → "Preview Quote" button on job row
  → navigate to /quote/:job.id (or open in new tab — TBD per UX preference)
  → QuoteRenderer loads, reads job from db.jobs.get(jobId)
  → Renders styled quote (brand name, items, totals, tax, customer)
  → "Download PDF" button → calls downloadQuotePdf() → jspdf builds .pdf → browser download
  → "Made with 3DCoster" footer (free tier, hardcoded)
```

### Tauri desktop: PDF save

`window.open(blobUrl)` / `link.click()` triggers the system download dialog in Tauri's WebView — no Tauri plugin needed. The Tauri `plugin-shell` already installed handles `open()` calls. Standard browser download API works without any Tauri-specific code.

If a native "Save As" dialog is ever preferred, `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog` can be added. That is a v2.0 enhancement, not v1.2.

---

## 4. Tag Filter + Search Architecture

### Filter state location: `useState` in `JobsManager`

URL querystring state (`?tags=x,y&q=foo`) is the right call for shareable/bookmarkable searches — but `JobsManager` is an in-app tab, not a standalone page. There is no URL to share. The feature requirement is "filter chips + free-text search". `useState` inside `JobsManager` is the correct, consistent-with-the-existing-architecture answer.

```typescript
// Inside JobsManager.tsx
const [selectedTags, setSelectedTags] = useState<string[]>([]);
const [searchQuery,  setSearchQuery]  = useState('');
```

These are ephemeral — cleared on tab switch (which is the existing behavior for all `JobsManager` state). No persistence needed.

### Search algorithm: lowercase substring — no fuse.js

Fuse.js is ~24 KB gzipped. Fuzzy search on job titles is not a stated requirement and adds bundle weight. The requirement is "free-text search across title/customer/tags". Lowercase substring search is:

```typescript
function jobMatchesSearch(job: PrintJob, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    job.name.toLowerCase().includes(q) ||
    (job.customer?.name?.toLowerCase().includes(q) ?? false) ||
    (job.tags ?? []).some(t => t.toLowerCase().includes(q))
  );
}
```

This runs entirely in memory on the `jobs` array returned by `useLiveQuery`. At the scale of typical use (dozens to low hundreds of jobs), this is instant.

### react-window v2 + filtered subsets

The virtualized list (Phase 11, already shipped) uses `VariableSizeList` or `FixedSizeList` from react-window. The key constraint: when the filtered subset changes size (different number of visible rows), the list must:

1. Receive the filtered array as its data source, not the full `jobs` array.
2. Reset its internal scroll position and cache when the filter changes.

Pattern:

```typescript
const filteredJobs = useMemo(() => {
  return jobs
    .filter(job => selectedTags.length === 0 || selectedTags.every(t => (job.tags ?? []).includes(t)))
    .filter(job => jobMatchesSearch(job, searchQuery));
}, [jobs, selectedTags, searchQuery]);

// Pass filteredJobs.length as itemCount, filteredJobs[index] inside itemData
// Reset scroll on filter change:
const listRef = useRef<VariableSizeList>(null);
useEffect(() => {
  listRef.current?.scrollToItem(0);
  listRef.current?.resetAfterIndex(0);  // VariableSizeList only
}, [filteredJobs.length]);
```

The `filteredJobs` array replaces `jobs` as the data source passed into the virtualized list's `itemData`. The list renders `filteredJobs[index]` directly. No index remapping needed — the filtered array is already the correct contiguous set.

**Tag chips source:** The set of available filter chips is derived from all unique tags across all jobs (not just filtered):

```typescript
const allTags = useMemo(() =>
  [...new Set(jobs.flatMap(j => j.tags ?? []))].sort(),
  [jobs]
);
```

Chips are rendered above the search input. Selected chips highlight; clicking a chip toggles it in `selectedTags`.

---

## 5. Etsy ToS Helper Component

### Structure: data-driven rule list in `src/data/etsyToS.ts`

A static array in `src/data/etsyToS.ts` (following the convention of `src/data/bambuFilaments.ts` and `src/data/defaultMaterials.ts` for static data). Not `src/utils/` — utilities are pure functions; this is data.

```typescript
// src/data/etsyToS.ts
export interface EtsyToSRule {
  id:       string;
  section:  string;   // e.g. "Listings", "Fees", "Intellectual Property"
  summary:  string;   // one-sentence plain-English rule
  detail?:  string;   // longer explanation shown on expand
  severity: 'must' | 'should' | 'info';
}

export const ETSY_TOS_RULES: EtsyToSRule[] = [
  {
    id: 'original-design',
    section: 'Listings',
    summary: 'Only sell items you designed or have rights to sell.',
    severity: 'must',
  },
  // ... ~8–12 rules covering the most relevant ToS items for 3D print sellers ...
];
```

The component `src/components/EtsyToSHelper.tsx` renders the rule list. It is a **collapsible** section — collapsed by default, expanded on click (saves vertical space on the CostCalculator form).

### Placement in CostCalculator

Position: **below the job notes/tags fields**, above the "Save" button — after all costing fields are visible, so the seller reviews compliance before saving. This is a checklist, not a form field; it should not interrupt the cost entry flow.

### PDF rendering

The `EtsyToSHelper` renders on the PDF **only when the user's marketplace is `'etsy'` or `'etsy_offsite_ad'`** AND the user has not explicitly toggled it off. A prop `showOnPdf?: boolean` (default `true` when marketplace is Etsy) controls inclusion. The PDF version is non-interactive (no checkboxes) — it renders as a compact "Etsy compliance notes" section.

Implementation: the `QuoteRenderer` receives the job's marketplace field, checks if it is an Etsy variant, and conditionally includes a static text block (not the interactive React component). No prop threading needed — the QuoteRenderer reads job data directly from IndexedDB.

---

## 6. Quick Duplicate

### Action location: JobsManager row — icon button, not context menu

The existing `JobsManager` job rows have action buttons (edit, delete). Add a "Duplicate" icon button (copy icon) in the same row actions bar. This is consistent with the existing pattern and requires no new UI primitive (use `Button` with `btnSize="sm"` and the existing icon set in `src/components/ui/icons/`).

A context menu pattern would require a new dropdown/popover UI primitive not yet in `src/components/ui/`. Building that for a single action is over-engineering.

### Duplicate semantics

```typescript
// In useJobs() — new method duplicateJob:
const duplicateJob = useCallback(async (sourceJob: PrintJob): Promise<string> => {
  const newId = `job-${crypto.randomUUID()}`;
  const duplicate: PrintJob = {
    ...sourceJob,
    id:         newId,
    name:       `${sourceJob.name} (copy)`,
    createdAt:  new Date(),
    updatedAt:  new Date(),
    copiesSold: 0,
    // Reset customer and tax override — not inherited
    customer:   undefined,
    taxRate:    undefined,
    taxAmount:  undefined,
    // Tags ARE inherited — user duplicates to reuse the same category groupings
  };
  await db.jobs.add(duplicate);
  return newId;
}, []);
```

Note: `crypto.randomUUID()` is used — not `Date.now()`. This fixes the fragile ID generation concern flagged in `CONCERNS.md`.

### Post-duplicate behaviour: stays in JobsManager

After duplication, the new job appears at the top of the `JobsManager` list (ordered by `createdAt desc`, already the existing sort). Do **not** auto-switch to CostCalculator. The user's intent when duplicating is to have a copy in the list — they can then click "Edit" if they want to modify it. Auto-switching tabs is surprising and breaks the "I'm working in JobsManager" mental model.

If the user wants to edit immediately, the existing "Edit" button opens the job in `CostCalculator`. That flow is unchanged.

---

## 7. Build Order and Hard Dependencies

### Dependency graph

```
taxRates.ts (static data)
  ↓
UserProfile.defaultTaxRate (types.ts + useUserProfile hook + Settings UI)
  ↓
PrintJob: tags, customer, taxRate, taxAmount (types.ts + db v6 migration)
  ↓
calculateTax() helper (costCalc.ts) + tax row in CostCalculator UI
  ↓                                       ↓
JobCustomer fields in CostCalculator UI   PDF QuoteRenderer (needs all Job fields)
  ↓
Tags + filter/search in JobsManager
  ↓
Quick duplicate (reads job, writes copy)
```

UI consistency sweep and Etsy ToS helper have no data dependencies and can start any time, but **touch the same forms** v1.2 is adding fields to. Best to run the UI consistency sweep **before** the new fields land, to avoid doing the work twice.

### Suggested phase order

| Phase | Feature(s) | Hard deps | Parallelizable with |
|-------|-----------|-----------|---------------------|
| **Phase 12** | Dexie v6 migration + `src/types.ts` delta (tags, customer, taxRate, taxAmount on PrintJob; defaultTaxRate on UserProfile; JobCustomer interface) + `src/data/taxRates.ts` static region table | None — this is the foundation | Phase 13 can start immediately after |
| **Phase 13** | Tax/VAT — three-layer resolution, `calculateTax()` helper, Settings UI for `defaultTaxRate`, tax row in CostCalculator, `taxAmount` snapshot on save, test coverage (activates the `it.todo`) | Phase 12 (schema must exist) | Phase 14 can start in parallel once Phase 12 is done |
| **Phase 14** | Customer details — `JobCustomer` fields in CostCalculator form + JobsManager display | Phase 12 (schema must exist) | Can run in parallel with Phase 13 |
| **Phase 15** | Tags + filter/search — tag input in CostCalculator, chip filter + search in JobsManager, react-window integration | Phase 12 (tags field must exist on type) | Can run in parallel with 13 and 14 after Phase 12 |
| **Phase 16** | UI consistency sweep — `compact` Input rollout, InfoTooltip replacements, dead badge cleanup | Best done BEFORE Phase 13/14/15 touch the same forms; but if phases 13–15 are already in flight, sweep the new fields as part of those phases | Sequential — but small |
| **Phase 17** | Quick duplicate | Phase 12 (job schema complete); ideally after Phase 13/14/15 so duplicate inherits all new fields correctly | No downstream deps |
| **Phase 18** | Etsy ToS helper — `src/data/etsyToS.ts`, `EtsyToSHelper.tsx`, placement in CostCalculator | No data deps; needs Phase 17 done if we want it on the PDF (QuoteRenderer), else can ship standalone | Can run in parallel with Phase 17 |
| **Phase 19** | PDF QuoteRenderer — `/quote/:jobId` route, `QuoteRenderer.tsx`, `pdfExport.ts`, lazy chunk, "Made with 3DCoster" footer, Etsy ToS section on PDF | **Hard dep on Phases 13, 14** (tax and customer fields must be in the schema and saved correctly before PDF can display them). Phase 15 tags can be omitted from PDF if needed (tags are not a PDF requirement per PROJECT.md). Phase 18 Etsy section on PDF needs EtsyToSHelper data file. | Cannot start until Phase 13 + 14 complete |

### Critical path

```
Phase 12 → Phase 13 + Phase 14 (parallel) → Phase 19 (PDF)
                                           ↗
Phase 15 + Phase 16 + Phase 17 + Phase 18 (can all proceed in parallel after Phase 12)
```

**Minimum to unblock PDF:** Phase 12 (schema) + Phase 13 (tax) + Phase 14 (customer). Once those three land, PDF development can start without waiting for tags, duplicate, Etsy helper, or sweep.

### Phases that need deeper research at plan time

| Phase | Why |
|-------|-----|
| Phase 19 (PDF) | PDF library choice (jspdf vs pdf-lib vs @react-pdf/renderer) not yet locked. Need to verify bundle size, Tailwind-incompatibility (jspdf uses its own coordinate system, not CSS), font embedding for non-Latin characters (relevant for CAD French / EU markets). **Dedicated research step recommended before Phase 19 planning.** |
| Phase 13 (Tax) | Region tax table needs sourcing for accuracy. `src/data/taxRates.ts` entries need to be verified against current rates (GST/HST/PST splits for Canada, EU country-by-country, etc.) — cannot be generated from training data alone. |

### Phases safe to plan from existing patterns (no additional research)

- Phase 12: Pure schema migration — Dexie v5→v6 pattern is identical to v4→v5.
- Phase 14: Customer fields — standard form fields + type additions.
- Phase 15: Tags + filter — well-understood `useState` + `useMemo` pattern. react-window scroll reset is documented.
- Phase 16: UI sweep — mechanical; follows conventions already in `CONVENTIONS.md`.
- Phase 17: Quick duplicate — `db.jobs.add({ ...job })` + `crypto.randomUUID()`.
- Phase 18: Etsy ToS helper — static data + collapsible component.

---

## Component Map: New vs Modified

### New files

| File | Type | Purpose |
|------|------|---------|
| `src/data/taxRates.ts` | Static data | ISO country → default VAT/GST rate |
| `src/data/etsyToS.ts` | Static data | Rule list for EtsyToSHelper |
| `src/components/EtsyToSHelper.tsx` | New component | Collapsible ToS checklist |
| `src/components/QuoteRenderer.tsx` | New component (lazy chunk) | PDF preview page + download trigger |
| `src/utils/pdfExport.ts` | New utility | PDF library calls (dynamically imported) |

### Modified files

| File | Change |
|------|--------|
| `src/types.ts` | Add `JobCustomer`, extend `PrintJob` (+4 fields), extend `UserProfile` (+1 field) |
| `src/db/database.ts` | Add `db.version(6)` with `upgrade()` |
| `src/utils/costCalc.ts` | Add `calculateTax()` helper |
| `src/utils/costCalc.test.ts` | Activate `it.todo`, add tax tests |
| `src/hooks/useDatabase.ts` | Add `duplicateJob` to `useJobs()`; update `useUserProfile` default to include `defaultTaxRate` |
| `src/components/CostCalculator.tsx` | Tax row, customer fields, tags input, Etsy ToS section placement |
| `src/components/JobsManager.tsx` | Customer display, tag chips + search, duplicate button |
| `src/main.tsx` | Add `/quote/:jobId` lazy route |
| `src/features.ts` | Register new feature keys for NewBadge |
| `src/App.tsx` | Minimal: pass `duplicateJob` callback if needed (most new features are self-contained in CostCalculator and JobsManager) |

---

## Data Flow Changes

### Tax resolution (new flow in CostCalculator)

```
CostCalculator.tsx
  reads: profile.defaultTaxRate, TAX_RATES[profile.address?.country]
  computes: effectiveTaxRate = job.taxRate ?? profile.defaultTaxRate ?? TAX_RATES[country] ?? 0
  displays: taxAmount = calculateTax(sellingPrice, effectiveTaxRate)  ← display only
  on save: job.taxRate = perJobOverride (if user changed it), job.taxAmount = calculateTax(...)
```

### PDF flow (new)

```
JobsManager → "Preview Quote" → navigate to /quote/:jobId
QuoteRenderer → db.jobs.get(jobId), db.settings (userProfile)
  → renders quote HTML
  → "Download PDF" click → pdfExport.ts → dynamic import('jspdf') → build + download
```

### Tag filter flow (new, within JobsManager)

```
useJobs() → jobs[] (all)
  → useMemo filteredJobs (filter by selectedTags + searchQuery)
  → VariableSizeList itemData={filteredJobs}
  → on filter change: listRef.current?.scrollToItem(0); listRef.current?.resetAfterIndex(0)
```

---

## Sources

All findings are from direct source file inspection:
- `src/db/database.ts` (v1–v5 schema)
- `src/types.ts` (PrintJob, UserProfile, all interfaces)
- `src/utils/costCalc.ts` + `costCalc.test.ts` (cost math + pending test)
- `src/hooks/useDatabase.ts` (all hooks, job/sale CRUD)
- `src/main.tsx` (lazy-load pattern)
- `vite.config.ts` (manualChunks pattern)
- `src/components/ui/index.ts` (available primitives)
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `CONCERNS.md`, `STACK.md` (authoritative codebase map)
- `.planning/PROJECT.md` (v1.2 requirements and decisions)
