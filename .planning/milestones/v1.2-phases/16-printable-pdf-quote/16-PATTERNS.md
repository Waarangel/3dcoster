# Phase 16: Printable PDF Quote — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 18 (new or modified)
**Analogs found:** 16 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/pdf/generateQuotePdf.ts` | utility | request-response (async, side-effect: file save) | `src/utils/costCalc.ts` | role-match (pure utility, no React/Dexie) |
| `src/pdf/notoSansBase64.ts` | data | static payload | `src/data/bambuFilaments.ts` | role-match (large generated static data export) |
| `src/utils/format.ts` (new) | utility | transform | `src/utils/currency.ts` | role-match (display-formatting helpers) |
| `scripts/subset-noto-sans.mjs` | script | file-I/O (one-shot build tool) | `scripts/generate-icons.mjs` | exact (one-shot Node ESM build script) |
| `scripts/assert-no-static-jspdf.mjs` | script | file-I/O (CI gate, src scan) | `scripts/assert-bundle-size.mjs` | exact (Node ESM CI gate, exit-code semantics) |
| `scripts/assert-no-pdf-preload.mjs` | script | file-I/O (CI gate, dist scan) | `scripts/assert-bundle-size.mjs` | exact |
| `src/pdf/generateQuotePdf.test.ts` | test | N/A | `src/utils/costCalc.test.ts` | exact (pure utility unit test) |
| `src/utils/taxResolution.test.ts` (extend) | test | N/A | `src/utils/taxResolution.test.ts` (itself) | N/A — extend existing file |
| `src/utils/format.test.ts` | test | N/A | `src/utils/costCalc.test.ts` | exact |
| `src/components/CostCalculator.test.tsx` | test | N/A | `src/utils/costCalc.test.ts` | role-match |
| `src/types.ts` (modify lines 273–296) | type | N/A | `src/types.ts` itself | N/A — surgical field addition |
| `src/utils/taxResolution.ts` (modify) | utility | transform | `src/utils/taxResolution.ts` itself | N/A — additive function |
| `src/components/CostCalculator.tsx` (modify) | component | request-response | `src/components/JobsManager.tsx` (button row) | role-match |
| `src/components/JobsManager.tsx` (modify) | component | request-response | `src/components/JobsManager.tsx` itself | N/A — additive button |
| `src/components/UserProfileModal.tsx` (modify) | component | CRUD | `src/components/UserProfileModal.tsx` itself | N/A — additive field |
| `src/features.ts` (modify) | config | N/A | `src/features.ts` itself | N/A — additive entry |
| `vite.config.ts` (modify) | config | N/A | `vite.config.ts` itself | N/A — extend existing build block |
| `package.json` (modify) | config | N/A | `package.json` itself | N/A — extend scripts + deps |
| `src-tauri/Cargo.toml` (modify) | config | N/A | `src-tauri/Cargo.toml` itself | N/A — additive crate entries |
| `src-tauri/src/main.rs` (modify) | config | N/A | `src-tauri/src/main.rs` itself | N/A — additive `.plugin()` calls |
| `src-tauri/capabilities/default.json` (modify) | config | N/A | `src-tauri/capabilities/default.json` itself | N/A — additive permissions |

---

## Pattern Assignments

### `src/pdf/generateQuotePdf.ts` (utility, async request-response)

**Analog:** `src/utils/costCalc.ts`

**Imports pattern** (`src/utils/costCalc.ts` lines 1–9):
```typescript
import type {
  CostBreakdown,
  Material,
  PrinterConfig,
  PrinterInstance,
  ElectricityConfig,
  MaterialUsage,
  Currency,
} from '../types';
import { getMaterialDensity } from './gcodeParser';
```

**Adaptation:** Replace `../types` imports with `PrintJob`, `UserProfile`, `JobCustomer`. Add the jspdf/autotable imports (static — these ARE inside the lazy chunk, so static import within the chunk is correct). Add `import type` for all type-only usage. Module path is `src/pdf/generateQuotePdf.ts` — relative imports will be `'../types'`, `'../utils/taxResolution'`, `'../utils/currency'`, `'../utils/format'`, `'./notoSansBase64'`.

**Module header comment pattern** (`src/utils/costCalc.ts` lines 13–14):
```typescript
// Pure cost-calculation module. Mirrors the math in
// src/components/CostCalculator.tsx:374-446 (the `useMemo((): CostBreakdown => {…})`)
// with byte-for-byte identical semantics. No React, no Dexie, no IO.
```

**Adaptation:** Use `// PDF quote generator — dynamic-import target. No static jspdf import in src/. No React.`

**Named export + typed params pattern** (`src/utils/costCalc.ts` lines 18–45):
```typescript
export interface CalcInput {
  filamentRows: CalcInputFilamentRow[];
  printTimeHours: number;
  selectedPrinter: PrinterConfig | undefined;
  // ... optional fields use `?`
}

export function calculateFilamentCost(filamentRows: CalcInput['filamentRows']): number {
  return filamentRows.reduce((sum, row) => {
```

**Adaptation:** Export `QuotePdfParams` interface with `job: PrintJob`, `userProfile: UserProfile`. Export `generateQuotePdf(params: QuotePdfParams): Promise<void>` as the primary entry point. Also export `customerNameSlug(name?: string): string` as a sibling named export.

**Error handling pattern** (`src/utils/currency.ts` lines 37–42):
```typescript
export function formatCurrency(amount: number, currency: Currency): string {
  const config = CURRENCY_CONFIG[currency];
  if (!config) return `$${amount.toFixed(2)}`; // Fallback for unknown currency
  const formatted = amount.toFixed(config.decimalPlaces);
  return `${config.symbol}${formatted}`;
}
```

**Adaptation:** `generateQuotePdf` itself does not throw — errors are surfaced to the call site (the button handler wraps in `try/catch` and calls `console.error`). Internal helper calls use null-coalescing defaults: `userProfile.nextQuoteNumber ?? 1`, `job.copiesSold || 1`.

**`__IS_TAURI__` guard pattern** (`src/App.tsx` lines 23–25):
```typescript
if (__IS_TAURI__) {
  return true;
}
```

**Adaptation in generateQuotePdf.ts:**
```typescript
if (!__IS_TAURI__) {
  doc.save(filename);
  return;
}
// Tauri path — dynamic import of Tauri plugins (NOT static — inside the lazy chunk)
const { save } = await import('@tauri-apps/plugin-dialog');
const { writeFile } = await import('@tauri-apps/plugin-fs');
const savePath = await save({
  defaultPath: filename,
  filters: [{ name: 'PDF', extensions: ['pdf'] }],
});
if (!savePath) return; // user cancelled
const buffer = doc.output('arraybuffer');
await writeFile(savePath, new Uint8Array(buffer));
```

**Module-level font guard pattern** (no existing analog — use pattern from RESEARCH.md Pattern 3):
```typescript
// Module-level guard — safe to call multiple times (no-op after first call)
let fontsLoaded = false;

function ensureFontsLoaded(doc: InstanceType<typeof jsPDF>): void {
  if (fontsLoaded) return;
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularBase64);
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldBase64);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  fontsLoaded = true;
}
```

**jsPDF 4.x + autotable 5.x calling convention** (from RESEARCH.md Pattern 2 — no codebase analog):
```typescript
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable'; // named function, NOT side-effect import

const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
ensureFontsLoaded(doc);
doc.setFont('NotoSans', 'normal');
autoTable(doc, {                              // function call, NOT doc.autoTable()
  head: [['Description', 'Qty', 'Unit Price', 'Amount']],
  body: [[ ... ]],
  startY: currentY,
  styles: { font: 'NotoSans', fontSize: 10 },
  headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
  theme: 'plain',
});
```

---

### `src/pdf/notoSansBase64.ts` (data, static payload)

**Analog:** `src/data/bambuFilaments.ts` (large generated data export)

**Pattern** (`src/data/bambuFilaments.ts` — file header + export shape):
```typescript
// Generated data — do not edit manually
// Source: ...
export const bambuFilaments: BambuFilament[] = [ ... ];
```

**Adaptation:** File is auto-generated by `scripts/subset-noto-sans.mjs`. Header comment must say:
```typescript
// AUTO-GENERATED by scripts/subset-noto-sans.mjs — do not edit manually.
// Noto Sans Regular + Bold, Latin + Latin-Ext + Euro sign (U+20AC) subset.
// Regenerate: node scripts/subset-noto-sans.mjs
export const notoSansRegularBase64: string = '...';
export const notoSansBoldBase64: string = '...';
```

Named exports (not default) to match project-wide convention.

---

### `src/utils/format.ts` (utility, transform) — NEW FILE

**Check:** File does not currently exist in `src/utils/`. `formatRelativeDate.ts` is a standalone formatter, not a general format module. `formatQuoteNumber` and `customerNameSlug` go here (or in `currency.ts`).

**Analog:** `src/utils/currency.ts` (display-formatting utility with named exports and one-line comments)

**Imports pattern** (`src/utils/currency.ts` lines 1–1):
```typescript
import type { Currency } from '../types';
```

**Core pattern** (`src/utils/currency.ts` lines 36–42):
```typescript
// Format a number as currency
export function formatCurrency(amount: number, currency: Currency): string {
  const config = CURRENCY_CONFIG[currency];
  if (!config) return `$${amount.toFixed(2)}`; // Fallback for unknown currency
  const formatted = amount.toFixed(config.decimalPlaces);
  return `${config.symbol}${formatted}`;
}
```

**Adaptation for `src/utils/format.ts`:**
```typescript
// Format a quote number as Q-NNNN (D-05)
export function formatQuoteNumber(n: number): string {
  return 'Q-' + String(n).padStart(4, '0');
}

// Generate an ASCII-safe filename slug from a customer name (D-11)
export function customerNameSlug(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 30);
}
```

No `import type` needed — these functions have no external type dependencies. One-line `//` comment above each function, no JSDoc. Named exports only.

---

### `scripts/subset-noto-sans.mjs` (script, file-I/O one-shot)

**Analog:** `scripts/generate-icons.mjs` (one-shot Node ESM utility in scripts/)

**Pattern** (`scripts/assert-bundle-size.mjs` lines 1–13 — best header reference):
```javascript
// scripts/assert-bundle-size.mjs
// Build-time gate: reads the largest dist/assets/index-*.js, gzips it
// in-memory, and fails the build if it exceeds 300 KB. Keeps the main
// app chunk under the PERF-01 budget.
//
// Wired into package.json `build` AFTER `vite build` per Phase 11
// (PERF-01 / D-09). Minimal Node built-ins; no npm install required.
import { readdirSync, readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { join } from 'path';
```

**Adaptation:** Header comment explains this is a ONE-TIME script (run once, output committed). Uses `subset-font` (devDependency). Produces `src/pdf/notoSansBase64.ts`. Must include U+20AC (Euro sign) explicitly in addition to Latin + Latin-Ext — RESEARCH.md notes this is outside the Latin/Latin-Ext blocks. Output file is TypeScript, not JSON.

---

### `scripts/assert-no-static-jspdf.mjs` (script, CI gate)

**Analog:** `scripts/assert-bundle-size.mjs` — exact match

**Full pattern to copy** (`scripts/assert-bundle-size.mjs` lines 1–43):
```javascript
// scripts/assert-bundle-size.mjs
// Build-time gate: ...
//
// Wired into package.json `build` AFTER `vite build` per Phase 11
import { readdirSync, readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { join } from 'path';

const DIST_DIR = 'dist/assets';
const MAX_GZIPPED_BYTES = 307200;
const MAIN_CHUNK_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;

const candidates = readdirSync(DIST_DIR)
  .filter(name => MAIN_CHUNK_PATTERN.test(name))
  // ...
if (candidates.length === 0) {
  console.error(`assert-bundle-size: no files matching ...`);
  process.exit(1);
}
// ...
if (largest.gzipped > MAX_GZIPPED_BYTES) {
  console.error(`assert-bundle-size FAILED: ...`);
  process.exit(1);
}
console.log(`✓ main chunk: ${actualKB} KB gzipped ...`);
```

**Adaptation for `scripts/assert-no-static-jspdf.mjs`:** Scans `src/` tree recursively for `.ts`/`.tsx` files. Greps for `/from ['"]jspdf['"]|from ['"]jspdf-autotable['"]|import ['"]jspdf/`. Exits 1 with file list on match; exits 0 with `✓` on clean. Uses only Node built-ins (`fs`, `path`). Runs BEFORE `vitest` in the build chain (cheapest check first).

---

### `scripts/assert-no-pdf-preload.mjs` (script, CI gate)

**Analog:** `scripts/assert-bundle-size.mjs` — exact match (post-build dist scan)

**Adaptation:** Reads `dist/index.html` (not `dist/assets/`). Greps for `modulepreload[^>]*href="[^"]*pdf[^"]*"` regex. Exits 1 if match found; exits 0 with `✓` on clean. Runs AFTER `vite build` and AFTER `assert-bundle-size`. Uses only `fs` built-in.

---

### `src/pdf/generateQuotePdf.test.ts` (test, unit)

**Analog:** `src/utils/costCalc.test.ts`

**Test file structure** (`src/utils/costCalc.test.ts` lines 1–12):
```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  calculateFilamentCost,
  // ...
} from './costCalc';
import type { CalcInput, CalcInputFilamentRow } from './costCalc';
```

**Fixture helper pattern** (`src/utils/costCalc.test.ts` lines 27–50):
```typescript
function makePrinter(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    id: 'printer-1',
    name: 'Test Printer',
    purchasePrice: 1200,
    // ... full shape with overrides spread last
    ...overrides,
  };
}
```

**Adaptation:** Import `{ customerNameSlug }` from `'../utils/format'` (or wherever it lands). Import `{ formatQuoteNumber }` similarly. Use `describe` + `it` + `expect`. Fixture builders for `PrintJob` and `UserProfile` stubs. Test `customerNameSlug` edge cases (empty, spaces, non-ASCII, >30 chars). Test `formatQuoteNumber` boundary values (1, 42, 1000, 10000). Integration tests for `generateQuotePdf` should mock jsPDF (or test helper functions in isolation since `jsPDF` is a side-effecting external).

---

### `src/utils/taxResolution.test.ts` (extend existing)

**Analog:** `src/utils/taxResolution.test.ts` itself — just append new `describe('taxLabelFor', ...)` block.

**Existing test structure** (`src/utils/taxResolution.test.ts` lines 1–10):
```typescript
import { describe, it, expect } from 'vitest';
import { resolveTaxRate, isRateStale, tooltipForSource } from './taxResolution';
import type { TaxRateSource } from './taxResolution';
```

**Adaptation:** Add `taxLabelFor` to the named import list. Add a `describe('taxLabelFor', ...)` block after the existing describes. Cover: EU code → `'VAT'`, GB → `'VAT'`, AU/NZ/IN/CA → `'GST'`, ES/MX → `'IVA'`, US → `'Sales Tax'`, undefined → `'Tax'`, unknown code → `'Tax'`.

---

### `src/utils/format.test.ts` (new test file)

**Analog:** `src/utils/costCalc.test.ts` — same structure

**Pattern:** Same `describe`/`it`/`expect` from vitest. No fixture builders needed (pure string → string functions). Cover: `formatQuoteNumber(1)` → `'Q-0001'`, `formatQuoteNumber(42)` → `'Q-0042'`, `formatQuoteNumber(10000)` → `'Q-10000'`. Cover `customerNameSlug`: empty → `''`, `'Alice Test'` → `'alice-test'`, `'Ça va'` → `'a-va'` (strips non-ASCII), 31-char name → 30-char slug.

---

### `src/types.ts` — add `defaultTerms?: string` to `UserProfile` (lines 273–296)

**Existing pattern** (`src/types.ts` lines 273–296 — `UserProfile` interface):
```typescript
export interface UserProfile {
  currency: Currency;
  name?: string;
  laborHourlyRate: number;
  defaultProfitMargin?: number;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  assetLibraryItemsPerPage?: number;
  defaultTaxRate?: number;
  // Quote numbering (Phase 16) — first quote is #1 (D-06); read via `?? 1`
  nextQuoteNumber?: number;
}
```

**Adaptation:** Add immediately before `nextQuoteNumber`:
```typescript
  // Default quote terms (Phase 16 D-09) — boilerplate for PDF Notes/Terms section.
  // Optional; omitted from PDF when empty/whitespace-only.
  defaultTerms?: string;
```

No Dexie migration needed — `UserProfile` is a JSON blob in the `settings` store.

---

### `src/utils/taxResolution.ts` — add `taxLabelFor()` (modify)

**Existing file pattern** (`src/utils/taxResolution.ts` lines 1–6):
```typescript
// Pure tax-resolution module — owns the fallback chain (override → settings →
// eu-average → region → manual). No React, no Dexie, no IO. Consumed by
// SettingsModal Default Tax Rate field and CostCalculator Tax row.

import type { Currency } from '../types';
import { TAX_RATES, EU_AVERAGE_RATE, ... } from '../data/taxRates';
```

**Section divider pattern** (`CONVENTIONS.md`): Use `// ============================================` between sections in long utility files.

**Adaptation:** Append after `labelForSource` at end of file (line 188+):
```typescript
// ============================================
// PDF quote helpers (Phase 16)
// ============================================

// EU27 ISO 3166-1 alpha-2 codes — used by taxLabelFor() below.
// Note: uses GR (ISO standard) not EL (Eurostat notation). See RESEARCH.md Pattern 9.
const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
  'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

// Region-aware tax label for PDF quote (D-06)
export function taxLabelFor(countryCode?: string): 'VAT' | 'GST' | 'IVA' | 'Sales Tax' | 'Tax' {
  if (!countryCode) return 'Tax';
  const code = countryCode.trim().toUpperCase();
  if (EU_COUNTRY_CODES.has(code) || code === 'GB') return 'VAT';
  if (['AU', 'NZ', 'IN', 'CA'].includes(code)) return 'GST';
  if (['ES', 'MX'].includes(code)) return 'IVA';
  if (code === 'US') return 'Sales Tax';
  return 'Tax';
}
```

---

### `src/components/CostCalculator.tsx` — add Generate PDF button (modify)

**Analog:** Existing Save Job button row at `src/components/CostCalculator.tsx` lines 1575–1603.

**Existing button row pattern** (lines 1575–1603):
```tsx
<div className="flex flex-col md:flex-row md:justify-end gap-4">
  {justSaved && (
    <span className="text-green-400 text-sm self-center">...</span>
  )}
  {editingJob && (
    <Button variant="secondary" btnSize="lg" onClick={...} className="w-full md:w-auto">
      Cancel Edit
    </Button>
  )}
  <Button
    variant={editingJob ? 'primary' : 'success'}
    btnSize="lg"
    onClick={handleSaveJob}
    disabled={!printName.trim() || filamentRows.every(r => !r.filamentId) || trueCost <= 0}
    className="w-full md:w-auto"
  >
    {editingJob ? 'Update Job' : 'Save Job for Tracking'}
  </Button>
</div>
```

**Dynamic import handler pattern** (from RESEARCH.md Pattern 1 — no codebase analog yet):
```typescript
const handleGeneratePdf = async () => {
  if (sellingPrice <= 0) return;
  try {
    const { generateQuotePdf } = await import('../pdf/generateQuotePdf');
    await generateQuotePdf({ job: currentJobSnapshot, userProfile });
  } catch (err) {
    console.error('PDF generation failed:', err);
  }
};
```

**NewBadge on button pattern** (`src/components/CostCalculator.tsx` line 1533):
```tsx
badge={<NewBadge feature="etsy-helper" className="absolute -top-1 -right-1" />}
```

**Adaptation:** Add a `<div className="relative w-full md:w-auto">` wrapper around the Generate PDF button so the `<NewBadge>` can be positioned absolutely. `variant="secondary"`, `btnSize="lg"`, `disabled={sellingPrice <= 0}`, `title="Set a selling price first"` on disabled state. The button sits BEFORE the Save Job button in DOM order (left of it visually). Import `NewBadge` already present in this file.

---

### `src/components/JobsManager.tsx` — add Generate PDF button (modify)

**Analog:** Existing Edit/Delete/Record Sale button row (`src/components/JobsManager.tsx` lines 170–190):
```tsx
<Button
  variant="success" btnSize="sm"
  onClick={(e) => { e.stopPropagation(); onOpenSaleForm(job); }}
>Record Sale</Button>
<Button
  btnSize="sm"
  onClick={(e) => { e.stopPropagation(); onEdit(job); }}
>Edit</Button>
<Button
  variant="danger" btnSize="sm"
  onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
>Delete</Button>
```

**Adaptation:** Add Generate PDF button between Record Sale and Edit in this row. Same `e.stopPropagation()` pattern. `variant="secondary"`, `btnSize="sm"`. Dynamic import call site identical to CostCalculator pattern. The `job` is already the saved Dexie row — pass directly to `generateQuotePdf`. Wrap in `<div className="relative">` for the `<NewBadge>` overlay. `NewBadge` import already in this file.

---

### `src/components/UserProfileModal.tsx` — add `defaultTerms` textarea (modify)

**Analog:** Existing address group in `UserProfileModal.tsx` lines 105–173.

**Existing optional-string field pattern** (lines 113–122):
```tsx
<div>
  <label className="block text-xs text-slate-400 mb-1">Street Address</label>
  <Input
    type="text"
    value={userProfile.address?.street || ''}
    onChange={e => onProfileChange({
      ...userProfile,
      address: { ...userProfile.address, street: e.target.value || undefined, ... },
    })}
    placeholder="123 Main St"
  />
</div>
```

**Textarea in JobsManager** (lines 980–994):
```tsx
<Textarea
  rows={2}
  value={saleCustomerAddress}
  onChange={e => setSaleCustomerAddress(e.target.value)}
  placeholder="Shipping address or pickup location"
/>
```

**Adaptation:** After the address group, before the Feedback Link section, add:
```tsx
{/* Default Quote Terms */}
<div>
  <h3 className="text-sm font-medium text-slate-300 mb-3">Default Quote Terms</h3>
  <div>
    <label className="block text-xs text-slate-400 mb-1">
      Default quote terms (optional)
    </label>
    <Textarea
      rows={4}
      value={userProfile.defaultTerms || ''}
      onChange={e => onProfileChange({
        ...userProfile,
        defaultTerms: e.target.value || undefined,
      })}
      placeholder="e.g. Payment due within 14 days. All sales final."
    />
    <p className="text-xs text-slate-500 mt-1">
      Added to the Terms section of every PDF quote.
    </p>
  </div>
</div>
```

Add `Textarea` to the existing `import { Button, Input, Select } from './ui'` line. No new state — form drives off `userProfile` prop directly (matches the rest of the modal's controlled pattern).

---

### `src/features.ts` — add `pdf-quote` entry (modify)

**Existing pattern** (`src/features.ts` lines 5–14):
```typescript
export const featureReleases: Record<string, Date> = {
  'settings-reorg': new Date('2026-05-20'),
  'default-profit-margin': new Date('2026-05-18'),
  'model-url': new Date('2026-05-20'),
  'default-tax-rate': new Date('2026-05-21'),
  'customer-details': new Date('2026-05-21'),
  'etsy-helper': new Date('2026-05-21'),
  'customer-library': new Date('2026-05-22'),
  // Add new features here with their release date
};
```

**Adaptation:** Add `'pdf-quote': new Date('YYYY-MM-DD')` on the actual ship date. The key `'pdf-quote'` must match the string passed to all `<NewBadge feature="pdf-quote" ...>` instances across CostCalculator and JobsManager.

---

### `vite.config.ts` — add `modulePreload: false` + `pdf` chunk (modify)

**Existing build block** (`vite.config.ts` lines 75–93):
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
          return 'vendor';
        }
      },
    },
  },
},
```

**Adaptation:** Add `modulePreload: false` as a sibling key to `rollupOptions`. Extend `manualChunks` with a PDF chunk arm:
```typescript
build: {
  modulePreload: false,
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
          return 'vendor';
        }
        // Give the PDF chunk a stable grep-able name for assert-no-pdf-preload.mjs
        if (id.includes('/src/pdf/') || id.includes('/jspdf') || id.includes('/jspdf-autotable')) {
          return 'pdf';
        }
      },
    },
  },
},
```

The `modulePreload: false` key placement is at the same level as `rollupOptions` inside the `build` object — same nesting depth as the Phase 11 chunk config.

---

### `package.json` — extend build script + deps (modify)

**Existing build script** (line 8):
```json
"build": "node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs"
```

**Adaptation — new build script order:**
```json
"build": "node scripts/lint-no-raw-html.mjs && node scripts/assert-no-static-jspdf.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs && node scripts/assert-no-pdf-preload.mjs"
```

Order rationale: `assert-no-static-jspdf` is a cheap `src/` scan — runs before the expensive `vitest` + `tsc` + `vite` steps to fail fast.

**New production deps to add to `dependencies`:**
```json
"jspdf": "^4.2.1",
"jspdf-autotable": "^5.0.8",
"@tauri-apps/plugin-dialog": "^2.7.1",
"@tauri-apps/plugin-fs": "^2.5.1"
```

**New dev dep** (one-time build tool — may be removed after running once, but keep for reproducibility):
```json
"subset-font": "^2.5.0"
```

---

### `src-tauri/Cargo.toml` — add dialog + fs crates (modify)

**Existing pattern** (`src-tauri/Cargo.toml` lines 12–15):
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-window-state = "2"
```

**Adaptation:** Append two lines after `tauri-plugin-window-state`:
```toml
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```

Matches the existing bare `"2"` version specifier style (not `{ version = "2", features = [] }`).

---

### `src-tauri/src/main.rs` — register plugins (modify)

**Existing pattern** (`src-tauri/src/main.rs` lines 4–13):
```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Adaptation:** Add two `.plugin()` calls before `.run()`:
```rust
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
```

Use the simple `::init()` form (no Builder needed) — matches `tauri_plugin_shell::init()` idiom.

---

### `src-tauri/capabilities/default.json` — add permissions (modify)

**Existing pattern** (`src-tauri/capabilities/default.json` lines 1–11):
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:default",
    "window-state:default"
  ]
}
```

**Adaptation:** Append to the `permissions` array:
```json
    "dialog:allow-save",
    "fs:allow-write-file",
    { "identifier": "fs:scope", "allow": [{ "path": "$DOWNLOAD/*" }] }
```

The object-style permission `{ "identifier": "fs:scope", ... }` is supported alongside string-style in Tauri 2 capabilities. The `$DOWNLOAD` variable expands to the OS downloads folder — confirmed in RESEARCH.md Pattern 8.

---

## Shared Patterns

### Dynamic Import for Lazy Chunk (PDF-03)
**Source:** RESEARCH.md Pattern 1 (no codebase analog yet — first dynamic import for a feature module)
**Apply to:** `CostCalculator.tsx` button handler, `JobsManager.tsx` button handler
```typescript
const handleGeneratePdf = async () => {
  if (sellingPrice <= 0) return;
  try {
    const { generateQuotePdf } = await import('../pdf/generateQuotePdf');
    await generateQuotePdf({ job, userProfile });
  } catch (err) {
    console.error('PDF generation failed:', err);
  }
};
```
The `try/catch` + `console.error` matches the error-handling pattern from `CONVENTIONS.md` (unexpected errors get `console.error` with the error object).

### NewBadge Absolute Overlay on Button
**Source:** `src/components/CostCalculator.tsx` line 1533 + `src/components/JobsManager.tsx` line 880
**Apply to:** Generate PDF button in CostCalculator, Generate PDF button in JobsManager
```tsx
// Host wrapper: make host relative
<div className="relative w-full md:w-auto">
  <Button variant="secondary" btnSize="lg" ...>Generate PDF</Button>
  <NewBadge feature="pdf-quote" className="absolute -top-1 -right-1" />
</div>
```
Both surfaces use the same feature key `"pdf-quote"`.

### `__IS_TAURI__` Build-Time Guard
**Source:** `src/App.tsx` line 23, `src/components/UpdateBanner.tsx` line 31
**Apply to:** `src/pdf/generateQuotePdf.ts` (Tauri save-dialog branch)
```typescript
if (__IS_TAURI__) {
  // Tauri-only code path
}
```
Declared in `src/globals.d.ts`, injected by `vite.config.ts` `define` block. No `window.navigator` detection.

### Optional String Field in UserProfile (spread pattern)
**Source:** `src/components/UserProfileModal.tsx` lines 113–122
**Apply to:** `UserProfileModal.tsx` `defaultTerms` textarea `onChange`
```tsx
onChange={e => onProfileChange({
  ...userProfile,
  defaultTerms: e.target.value || undefined,
})}
```
`|| undefined` converts empty string to `undefined` — keeps the stored object clean of empty-string fields.

### CI Gate Script Exit Codes
**Source:** `scripts/assert-bundle-size.mjs` lines 20–24 + 36–42
**Apply to:** `scripts/assert-no-static-jspdf.mjs`, `scripts/assert-no-pdf-preload.mjs`
```javascript
if (errorCondition) {
  console.error(`assert-<name> FAILED: <description>`);
  console.error('  <remediation hint>');
  process.exit(1);
}
console.log(`✓ <name>: <success description>`);
```
Exit 1 on failure, exit 0 (implicit) on success. `console.error` for failures, `console.log` for success. Prefix with script name for grep-ability in CI logs.

---

## No Analog Found

Files where codebase has no close prior art (planner must rely on RESEARCH.md patterns and library docs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/pdf/generateQuotePdf.ts` (jsPDF layout) | utility | file-I/O | jsPDF 4.x + autotable 5.x API — no PDF generation exists in codebase. Use RESEARCH.md Patterns 2, 3, 8. |
| `src/pdf/notoSansBase64.ts` (content) | data | static | Auto-generated by `subset-noto-sans.mjs`; structure from RESEARCH.md Pattern 4. |
| `scripts/subset-noto-sans.mjs` (body) | script | file-I/O | `subset-font` API has no prior use in codebase. Use RESEARCH.md Pattern 4. |

---

## Metadata

**Analog search scope:** `src/utils/`, `src/components/`, `scripts/`, `src-tauri/src/`, `src/features.ts`, `vite.config.ts`, `package.json`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/`
**Files scanned:** 21
**Pattern extraction date:** 2026-05-22

---

## PATTERN MAPPING COMPLETE
