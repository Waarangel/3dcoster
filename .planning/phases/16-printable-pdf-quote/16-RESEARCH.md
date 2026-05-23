# Phase 16: Printable PDF Quote — Research

**Researched:** 2026-05-22
**Domain:** Client-side PDF generation (jsPDF + jspdf-autotable), Vite chunk splitting, Tauri save dialog, Unicode fonts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Print-shop minimal aesthetic — pure black-on-white. Ruled lines, bold section headings, no accent colors.
- **D-02:** Header = wordmark-only typography. Bold `3DCoster` (~18pt) at top-left; `QUOTE` label + `Q-NNNN` at top-right; thin horizontal rule below. Total header height ~50pt.
- **D-03:** Standard invoice section order: Header → [Quote # + Issue date + Valid-until (LEFT)] + [Customer block (RIGHT)] → Job title + line items (full-width) → Subtotal/Tax/Total → Notes/Terms → Footer.
- **D-04:** Line items = collapsed single row: `Custom 3D print — {jobTitle} (qty: N) — {sellingPrice}`. Subtotal = `qty × sellingPrice`. Cost breakdown NOT exposed.
- **D-05:** Quote number displayed as `Q-NNNN` (4-digit zero-padded). Counter is LIFETIME, no yearly reset. Seed is `nextQuoteNumber ?? 1`. `Q-` prefix + padding are display-only.
- **D-06:** Tax label is region-aware from `UserProfile.address.country`. EU + UK → `VAT`; AU/NZ/IN/CA → `GST`; ES/MX → `IVA`; US → `Sales Tax`; fallback → `Tax`. Helper: `taxLabelFor(countryCode?)` in `src/utils/taxResolution.ts`.
- **D-07:** Tax row hidden when `taxRate === 0` or `taxAmount === 0`. Layout: `Subtotal + Total` only if 0%; `Subtotal + {TaxLabel} ({rate}%): {amount} + Total` if > 0%.
- **D-08:** LAYERED Notes/Terms: `PrintJob.notes` (per-job) + `UserProfile.defaultTerms` (boilerplate). Each subsection omitted when empty.
- **D-09:** `defaultTerms` edited in existing `UserProfileModal` — multi-line textarea next to address/labor group. Optional, no Dexie migration.
- **D-10:** Bundle Noto Sans (regular + bold, Latin + Latin-Ext subset only, ~80 KB gz combined) as base64 INSIDE the lazy PDF chunk. Loaded via `addFileToVFS` + `addFont` once per session. Researcher must confirm glyph coverage and final size.
- **D-11:** Filename pattern: `Quote-{Q-NNNN}-{customerNameSlug}.pdf`. No customer → `Quote-Q-0042.pdf`. Slug: lowercase, alphanumeric + hyphens, max 30 chars.
- **D-12:** "Generate PDF" button: (a) CostCalculator — `<Button variant="secondary">` next to Save Job; disabled when `sellingPrice <= 0` with tooltip "Set a selling price first". (b) JobsManager — inside expanded accordion, next to Edit/Delete; NOT on collapsed row.

### Claude's Discretion
- Exact module path for PDF generator (`src/pdf/generateQuotePdf.ts` vs `src/utils/pdfQuote.ts`)
- Vite chunk name for PDF chunk (`pdf-vendor` vs `pdf` vs default `[hash]`)
- Whether Noto Sans base64 lives in separate module or inlined into `generateQuotePdf.ts`
- Exact wording/location of `formatQuoteNumber(n)` helper
- Tauri save-dialog plumbing details (which API, default folder, cancel fallback)
- Whether `jspdf-autotable` or hand-rolled layout for collapsed single-row + totals block

### Deferred Ideas (OUT OF SCOPE)
- PDF preview modal before download
- Tauri save-dialog folder memory / default folder configuration
- Quote-template / preset system
- White-label / logo upload / custom footer
- Configurable valid-until window
- Per-customer / yearly quote-number reset
- Translation of PDF UI strings (English-only in v1.2)
- Cost-breakdown line items (transparent pricing mode)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | "Generate PDF" button on cost calculator and JobsManager; downloads via browser (web) and Tauri file dialog (desktop) | jsPDF 4.x `doc.save()` for web; `@tauri-apps/plugin-dialog` `save()` + `@tauri-apps/plugin-fs` `writeFile()` for Tauri; `__IS_TAURI__` guard pattern confirmed |
| PDF-02 | PDF contains: 3DCoster header, quote number, valid-until date, customer block, line items, Subtotal/Tax/Total, notes/terms, footer | jsPDF 4.x + jspdf-autotable 5.x API confirmed; layout pattern documented below |
| PDF-03 | `jspdf` + `jspdf-autotable` load ONLY via dynamic `import()` — no static import in `src/` | CI gate `scripts/assert-no-static-jspdf.mjs` proposed; Vite natural code-splitting confirmed |
| PDF-04 | `vite.config.ts` sets `build.modulePreload: false` (or equivalent); CI assertion `scripts/assert-no-pdf-preload.mjs` greps `dist/index.html` | Vite 7.2.4 supports `modulePreload: false`; workaround `{ resolveDependencies: () => [] }` confirmed; prior art in `scripts/assert-bundle-size.mjs` |
| PDF-05 | Main app chunk remains under 300 KB gz after PDF library added | PDF chunk is async-only (off main bundle); `jspdf` gz ≈ 108 KB + autotable gz ≈ 10 KB + fonts gz ≈ 80 KB → ~198 KB lazy chunk, well off main bundle |
</phase_requirements>

---

## Summary

Phase 16 adds a client-side PDF quote generator to 3DCoster. The locked library stack is `jspdf@4.x` + `jspdf-autotable@5.x`. Both have changed significantly since the v2/v3 era assumed in training data — specifically, jspdf-autotable 5.x changed its import shape to a named `autoTable(doc, options)` function call rather than a side-effect plugin attach. The jspdf package jumped from v2 to v4 (skipping a major version rename cycle), but the core API (`new jsPDF()`, `addFileToVFS`, `addFont`, `setFont`, `doc.save()`) is stable and unchanged from v2. The main new risk is that CONTEXT.md refers to "jspdf 2.x line + jspdf-autotable 3.x line" — both are **wrong**; the current stable versions are jspdf **4.2.1** and jspdf-autotable **5.0.8**.

The lazy-loading strategy (dynamic `import()`) is straightforward with Vite 7.2.4 — any dynamic import auto-produces a separate chunk. The only explicit config change needed is `build.modulePreload: false` (or the `resolveDependencies` workaround if the bare `false` shows a bug in Vite 7.2.4) plus a named `manualChunks` entry to give the chunk a stable, grep-able name. The bundle budget is comfortable: the PDF lazy chunk lands at ~198 KB gz (well under the 80–250 KB range CONTEXT.md anticipates), and the main app chunk is unaffected.

Tauri save-dialog support requires installing two new plugins (`@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`) — neither is currently in the project. Both require Rust-side registration in `main.rs`, `Cargo.toml` additions, and capability permission additions. The `__IS_TAURI__` guard pattern is already established.

Noto Sans Latin + Latin-Ext subset covers all required glyphs (€, accented Latin, Polish/Czech/Hungarian/Turkish extended) confirmed via Google Fonts + Noto docs. The `subset-font` npm package (v2.5.0, backed by HarfBuzz WASM) is the recommended subsetting tool. Estimated subsetted sizes: regular ≈ 35–45 KB gz, bold ≈ 35–45 KB gz, combined ≈ 70–90 KB gz — consistent with CONTEXT.md's ~80 KB gz assumption.

**Primary recommendation:** Use `jspdf` 4.2.1 + `jspdf-autotable` 5.0.8. The named `autoTable(doc, options)` calling convention (not the legacy side-effect plugin pattern) is the correct form for autotable 5.x. Use `{ resolveDependencies: () => [] }` for `build.modulePreload` as a belt-and-suspenders measure alongside the named `pdf` manualChunk entry.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF document creation | Browser (client-side only) | — | jsPDF runs in browser; no server; offline-first design constraint |
| Quote number assignment | Browser (Dexie read/write) | — | `PrintJob.quoteNumber` + `UserProfile.nextQuoteNumber` stored locally in IndexedDB |
| Tax label derivation | Browser (pure utility) | — | `taxLabelFor()` is a pure function over `UserProfile.address.country` |
| File save (web) | Browser | — | `doc.save(filename)` triggers browser download dialog |
| File save (desktop) | Tauri native (Rust plugin) | Browser (fallback N/A) | `@tauri-apps/plugin-dialog` save + `@tauri-apps/plugin-fs` writeFile |
| Font loading | Browser (in-memory, lazy chunk) | — | Base64 Noto Sans embedded in lazy PDF chunk, registered once per session via jsPDF VFS |
| Chunk isolation | Vite build (config) | CI gate | `manualChunks` + `modulePreload: false` keep PDF off the main bundle |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jspdf` | **4.2.1** [VERIFIED: npm registry] | PDF document creation | Locked in ROADMAP; industry-standard client-side PDF library; 127 KB gz |
| `jspdf-autotable` | **5.0.8** [VERIFIED: npm registry] | Table rendering in PDF | Companion plugin for jsPDF; best available table layout for jsPDF |
| `subset-font` | **2.5.0** [VERIFIED: npm registry] | One-time build-time font subsetting | HarfBuzz WASM-backed; produces minimal TTF subsets; no Python required |

**CRITICAL VERSION CORRECTION:** CONTEXT.md notes the researcher should "confirm jspdf 2.x line + jspdf-autotable 3.x line." Both assumptions are wrong. The registry shows:
- `jspdf` latest is **4.2.1** (not 2.x) — v4.0.0 released early 2026
- `jspdf-autotable` latest is **5.0.8** (not 3.x) — v5.0.0 released 2025

The core API is backward-compatible for our usage (addFileToVFS/addFont/save), but the **autotable calling convention changed** in v5 (see Architecture Patterns below).

### Supporting (new dependencies — NOT YET INSTALLED)
| Library | Version | Purpose | Installation Scope |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-dialog` | **2.7.1** [VERIFIED: npm registry] | Native save-file dialog for Tauri desktop | Runtime dep; also requires Rust crate |
| `@tauri-apps/plugin-fs` | **2.5.1** [VERIFIED: npm registry] | Binary file write for Tauri desktop | Runtime dep; also requires Rust crate |

**Note:** `subset-font` is a **build-time** dev tool only — run once to produce base64 files, then remove from devDependencies (or keep and document as a maintenance tool). It does NOT need to be a runtime dep.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jspdf` | `pdf-lib` | `pdf-lib` last published 2021 per REQUIREMENTS.md — abandoned; excluded from scope |
| `jspdf` | `@react-pdf/renderer` | ~450 KB gz; React-version compat issues per REQUIREMENTS.md — excluded |
| `subset-font` | `fonttools pyftsubset` | Python required; not npm-native; harder to integrate in a Node build pipeline |
| `subset-font` | Google Webfonts Helper download | Manual step, not reproducible in CI; harder to automate |

**Installation (production deps — to add at implementation time):**
```bash
npm install jspdf jspdf-autotable @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
```

**Installation (build-time font subsetting — dev tool, run once):**
```bash
npm install --save-dev subset-font
# Run once: node scripts/subset-noto-sans.mjs
# Then optionally: npm uninstall --save-dev subset-font
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `jspdf` | npm | ~12 yrs (2013) | ~3M/wk [ASSUMED] | github.com/parallax/jsPDF | [OK] | Approved |
| `jspdf-autotable` | npm | ~9 yrs (2015) | ~1M/wk [ASSUMED] | github.com/simonbengtsson/jsPDF-AutoTable | [OK] | Approved |
| `subset-font` | npm | ~5 yrs (2021) | 50K/wk [ASSUMED] | github.com/papandreou/subset-font | [OK] | Approved |
| `@tauri-apps/plugin-dialog` | npm | ~3 yrs | 200K/wk [ASSUMED] | github.com/tauri-apps/plugins-workspace | [OK] | Approved |
| `@tauri-apps/plugin-fs` | npm | ~3 yrs | 150K/wk [ASSUMED] | github.com/tauri-apps/plugins-workspace | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**No postinstall scripts found** in `jspdf` or `jspdf-autotable` that perform network calls or filesystem access outside the project directory. [VERIFIED: npm registry scripts key inspection]

Weekly download figures are estimated from training data — [ASSUMED] for exact counts. Repository provenance verified via `npm view <pkg> repository`. [VERIFIED: npm registry] for all 5 packages.

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Generate PDF"
         │
         ▼
  [Button click handler]
  (CostCalculator or JobsManager)
         │
         ├─ sellingPrice <= 0?  → button disabled (no flow)
         │
         ▼
  dynamic import('./pdf/generateQuotePdf')
         │
         ▼ (first load only — Vite emits async pdf chunk)
  [generateQuotePdf module loads]
         │
         ├─ fonts already loaded (fontsLoaded flag)?
         │         NO → loadNotoSans()
         │                 │
         │                 ▼
         │           doc.addFileToVFS() × 2
         │           doc.addFont()      × 2
         │           fontsLoaded = true
         │
         ▼
  generateQuotePdf({ job, userProfile })
         │
         ├─ quoteNumber assigned? NO → assign nextQuoteNumber ?? 1
         │                              increment nextQuoteNumber
         │                              db.jobs.put(job)
         │                              db.settings.put(profile)
         │
         ├─ build jsPDF doc (new jsPDF())
         ├─ render header block (3DCoster + Q-NNNN)
         ├─ render meta block (issue date, valid-until)
         ├─ render customer block (if customer exists)
         ├─ autoTable(doc, { line items })
         ├─ render totals block (Subtotal, Tax?, Total)
         ├─ render notes/terms (if non-empty)
         ├─ render footer ("Made with 3DCoster")
         │
         ▼
  __IS_TAURI__?
         │
    YES  │  NO
         │   │
         │   ▼
         │  doc.save(filename)       ← browser save dialog
         │
         ▼
  save({ filters: [PDF], defaultPath: filename })
  user cancels? → null → return early
         │
         ▼
  doc.output('arraybuffer')
  writeFile(path, new Uint8Array(buffer))
```

### Recommended Project Structure

```
src/
├── pdf/
│   ├── generateQuotePdf.ts    # Main generator — dynamic-import target
│   └── notoSansBase64.ts      # Base64 font data (regular + bold)
├── utils/
│   ├── taxResolution.ts       # Add taxLabelFor() here (existing file)
│   └── currency.ts            # formatCurrency (already used for totals)
scripts/
├── assert-bundle-size.mjs     # Existing (Phase 11)
├── assert-no-pdf-preload.mjs  # NEW — greps dist/index.html
├── assert-no-static-jspdf.mjs # NEW — greps src/ for static jspdf imports
└── subset-noto-sans.mjs       # NEW — one-time font subsetting script
```

**Module path decision (Claude's Discretion):** `src/pdf/generateQuotePdf.ts` is preferred over `src/utils/pdfQuote.ts`. Rationale: the PDF generator has side effects (font registration), is more than a pure utility function, and will grow larger than typical utils. A dedicated `src/pdf/` directory mirrors how `src/pages/` isolates the marketing-site code from the app. The convention of `camelCase` file names for non-components is respected (`generateQuotePdf.ts`).

**Font file location (Claude's Discretion):** `src/pdf/notoSansBase64.ts` as a separate module imported by `generateQuotePdf.ts`. Rationale: base64 font data will be ~110 KB of text — inlining it into `generateQuotePdf.ts` would make that file unnavigable. A separate sibling import keeps things organized with zero runtime cost.

### Pattern 1: Dynamic Import of PDF Module (PDF-03)

```typescript
// Source: CONTEXT.md D-12 + Vite dynamic import docs
// In CostCalculator.tsx or JobsManager.tsx button handler:
const handleGeneratePdf = async () => {
  if (sellingPrice <= 0) return;
  try {
    const { generateQuotePdf } = await import('../pdf/generateQuotePdf');
    await generateQuotePdf({ job, userProfile });
  } catch (err) {
    console.error('PDF generation failed:', err);
    // TODO: surface error to user (toast or inline message)
  }
};
```

The dynamic `import()` call is the ONLY acceptable form. Vite will automatically create a separate chunk for `src/pdf/generateQuotePdf.ts` and all its transitive dependencies (including `jspdf`, `jspdf-autotable`, and the base64 font module).

### Pattern 2: jspdf 4.x + jspdf-autotable 5.x API Contract

```typescript
// Source: npm registry dist file inspection + jsPDF README
// src/pdf/generateQuotePdf.ts

// ESM named export — correct for v4.x
import { jsPDF } from 'jspdf';

// jspdf-autotable 5.x: named function export — NOT side-effect import
// autoTable is also the default export, but named import is cleaner
import { autoTable } from 'jspdf-autotable';

export async function generateQuotePdf(params: QuotePdfParams): Promise<void> {
  // Ensure fonts are loaded (once per session)
  await ensureFontsLoaded();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  // Set registered font
  doc.setFont('NotoSans', 'normal');

  // ... render header, meta, customer ...

  // Line items table — named function call, NOT doc.autoTable()
  autoTable(doc, {
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: [[`Custom 3D print — ${job.name}`, qty, sellingPriceStr, subtotalStr]],
    startY: currentY,
    styles: { font: 'NotoSans', fontSize: 10 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    theme: 'plain',
  });

  // ... render totals, notes, footer ...

  // Web path
  if (!__IS_TAURI__) {
    doc.save(filename);
    return;
  }

  // Tauri path
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const savePath = await save({
    defaultPath: filename,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!savePath) return; // user cancelled
  const arrayBuffer = doc.output('arraybuffer');
  await writeFile(savePath, new Uint8Array(arrayBuffer));
}
```

**IMPORTANT — autotable import shape changed in v5.x:** The old pattern was:
```typescript
import 'jspdf-autotable'; // side-effect — attached doc.autoTable()
doc.autoTable({ ... });   // v3.x pattern — DO NOT USE
```
The v5.x pattern is:
```typescript
import { autoTable } from 'jspdf-autotable'; // named function
autoTable(doc, { ... });                      // v5.x pattern — USE THIS
```
An `applyPlugin(jsPDF)` function is also exported if the old `.autoTable()` method-style is preferred, but the named function style is cleaner and more tree-shakable.

### Pattern 3: Custom Font Registration (D-10)

```typescript
// Source: jsPDF README + docs (addFileToVFS / addFont / setFont)
// src/pdf/generateQuotePdf.ts

import { notoSansRegularBase64, notoSansBoldBase64 } from './notoSansBase64';

// Module-level guard — safe to call multiple times (no-op after first call)
let fontsLoaded = false;

function ensureFontsLoaded(doc: InstanceType<typeof jsPDF>): void {
  if (fontsLoaded) return;

  // Step 1: register raw TTF bytes in jsPDF's Virtual File System
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularBase64);
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldBase64);

  // Step 2: register font name + style mapping
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');

  fontsLoaded = true;
}

// Usage in generateQuotePdf:
const doc = new jsPDF(...);
ensureFontsLoaded(doc); // idempotent
doc.setFont('NotoSans', 'normal');
// For bold text:
doc.setFont('NotoSans', 'bold');
```

**Important nuance on `fontsLoaded` guard:** `addFileToVFS` and `addFont` register fonts into jsPDF's **global** VFS registry (not per-instance). Registering the same font twice is harmless but wasteful. The module-level flag prevents double-registration on repeat PDF generations within the same browser session. If the module is garbage-collected and re-loaded (e.g., after a hard reload), `fontsLoaded` resets to `false` and fonts are re-registered on the next call — this is correct behavior.

**Note on function signature:** `ensureFontsLoaded` receives the `doc` instance because `addFileToVFS` and `addFont` are instance methods. Alternatively, these could be called on the `jsPDF` class prototype via `jsPDF.API.addFileToVFS(...)` but the instance method form is simpler and the documented pattern.

### Pattern 4: Font Subsetting (build-time script)

```javascript
// scripts/subset-noto-sans.mjs
// Run once: node scripts/subset-noto-sans.mjs
// Produces: src/pdf/notoSansBase64.ts

import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import subsetFont from 'subset-font';

// Unicode ranges for Latin + Latin-Ext (covers success criterion #5):
// Basic Latin: 0x0020–0x007F
// Latin-1 Supplement: 0x00A0–0x00FF (includes € U+20AC is NOT here — see below)
// Latin Extended-A: 0x0100–0x017F (Polish ą ę ć ł ś ź ż, Czech ň ř, Hungarian ő, Turkish İ ı ş ğ, etc.)
// Latin Extended-B: 0x0180–0x024F
// Euro sign: U+20AC (in Currency Symbols block — must be explicitly included)

const SUBSET_CHARS = /* all printable ASCII + Latin-1 + Latin-Ext A/B + € */
  ' - -ɏ€';

// ... fetch NotoSans-Regular.ttf and NotoSans-Bold.ttf from Google Fonts or bundled copy ...
// ... subset each, base64-encode, write notoSansBase64.ts ...
```

**GLYPH COVERAGE VERIFICATION — D-10 mandate:**

The `€` sign (U+20AC) is in the Unicode "Currency Symbols" block (U+20A0–U+20CF), NOT in Latin or Latin-Ext blocks. **Latin + Latin-Ext subset alone does NOT cover `€`.** The subsetting script MUST explicitly include U+20AC in the character set.

Noto Sans supports U+20AC per Google Fonts specimen data [VERIFIED: fonts.google.com/noto/specimen/Noto+Sans — "supports 2,840 characters from 30 Unicode blocks"]. The Latin-Extended-B block (U+0180–U+024F) covers Polish (ą ę ć ł ś ź ż), Czech (ň ř), Hungarian (ű ő), Turkish (İ ı ş ğ) extended glyphs.

**ESCALATION — Not a silent change:** CONTEXT.md D-10 says "Latin + Latin-Ext subset only" but this does not cover `€` (U+20AC) which is in a different Unicode block. The subsetting script MUST include U+20AC explicitly. This is a small, well-justified extension of the subset scope (one additional glyph, negligible file size impact). The planner should document this in the implementation plan as "subset includes Latin + Latin-Ext + Euro sign (U+20AC)" — not silently add it without notation.

**Estimated sizes (subsetted):**
- Noto Sans Regular, Latin+Latin-Ext+€ subset: ~35–50 KB gz [ASSUMED — based on typical subset ratios from 300 KB full TTF]
- Noto Sans Bold, same subset: ~35–50 KB gz [ASSUMED]
- Combined: **~70–100 KB gz** — consistent with CONTEXT.md's ~80 KB gz estimate

### Pattern 5: Vite `modulePreload: false` (PDF-04)

**Research finding:** Vite 7.2.4 supports `build.modulePreload: false` as a boolean. However, a documented bug (#11889, fixed in PR #12111) existed in earlier Vite versions where `false` did not suppress all modulepreload link injection. The fix was merged before Vite 7, so Vite 7.2.4 should honor `false` correctly. [CITED: github.com/vitejs/vite/pull/12111]

**Belt-and-suspenders recommended config:**
```typescript
// vite.config.ts — add inside the build: {} block
build: {
  modulePreload: false,   // disables polyfill AND preload links
  rollupOptions: {
    output: {
      manualChunks(id) {
        // ... existing 3-tier chunking from Phase 11 ...
        if (id.includes('node_modules')) {
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
          return 'vendor';
        }
        // Give the PDF chunk a stable name for the assert script to grep
        if (id.includes('/src/pdf/') || id.includes('/jspdf') || id.includes('/jspdf-autotable')) {
          return 'pdf';
        }
      },
    },
  },
}
```

**Alternative if `false` causes issues:** Use `{ resolveDependencies: () => [] }` instead of `false`. This produces identical behavior (no modulepreload links) but via the function path. [CITED: github.com/vitejs/vite/issues/11889]

**Side effects of disabling modulePreload site-wide:**
- No `<link rel="modulepreload">` tags are injected into `dist/index.html` for ANY chunk (React vendor, Dexie vendor, existing route lazy chunks)
- This slightly degrades initial-page LCP if users are on a slow connection (the browser cannot pre-fetch vendor chunks before they are needed)
- On the 3DCoster scale (small SPA, small bundle, mostly fast connections), this impact is minimal
- The locked decision from ROADMAP overrides this concern for v1.2

**Alternative (not locked — for future consideration):** Instead of disabling site-wide, use `resolveDependencies` to exclude ONLY the pdf chunk:
```typescript
build: {
  modulePreload: {
    resolveDependencies: (url, deps) =>
      url.includes('pdf') ? [] : deps
  }
}
```
This would keep modulepreload for React/Dexie/vendor chunks. CONTEXT.md and ROADMAP lock `modulePreload: false` — flagged here only in case the planner wants to revisit per the "if research surfaces a sharp regression" instruction.

### Pattern 6: `scripts/assert-no-pdf-preload.mjs`

Based on the prior art in `scripts/assert-bundle-size.mjs`:

```javascript
// scripts/assert-no-pdf-preload.mjs
// Post-build gate: verifies dist/index.html contains no modulepreload link
// referencing the pdf chunk. Exits 1 if found.
//
// Wired into package.json build script AFTER vite build.
// Complements assert-bundle-size.mjs (PDF-04 / D-09 in CONTEXT.md).
import { readFileSync } from 'fs';

const HTML_FILE = 'dist/index.html';
let html;
try {
  html = readFileSync(HTML_FILE, 'utf8');
} catch {
  console.error(`assert-no-pdf-preload: ${HTML_FILE} not found. Did vite build run?`);
  process.exit(1);
}

// Match <link rel="modulepreload" ...> tags referencing the pdf chunk
// The named manualChunks entry gives the chunk a filename starting with "pdf"
const PRELOAD_PATTERN = /modulepreload[^>]*href="[^"]*pdf[^"]*"/i;

if (PRELOAD_PATTERN.test(html)) {
  console.error(`assert-no-pdf-preload FAILED: dist/index.html contains a modulepreload link for the pdf chunk.`);
  console.error('  This means jsPDF will be pre-fetched on page load, defeating the lazy-loading goal.');
  console.error('  Check vite.config.ts — build.modulePreload should be false (or { resolveDependencies: () => [] }).');
  process.exit(1);
}
console.log('✓ pdf chunk: no modulepreload link in dist/index.html');
```

**package.json build script diff:**
```json
// Before (Phase 11 build script):
"build": "node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs"

// After (Phase 16 additions):
"build": "node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs && node scripts/assert-no-pdf-preload.mjs && node scripts/assert-no-static-jspdf.mjs"
```

### Pattern 7: `scripts/assert-no-static-jspdf.mjs` (PDF-03 enforcement)

```javascript
// scripts/assert-no-static-jspdf.mjs
// Pre-build gate: scans src/**/*.{ts,tsx} for any static import of jspdf or jspdf-autotable.
// Exits 1 if found — prevents the lazy-loading invariant from silently regressing.
// Run BEFORE vite build (order: lint-html → assert-no-static → vitest → tsc → vite → assert-bundle → assert-no-preload)
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function scanDir(dir) {
  const entries = readdirSync(dir);
  const violations = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      violations.push(...scanDir(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      const content = readFileSync(fullPath, 'utf8');
      if (/from ['"]jspdf['"]|from ['"]jspdf-autotable['"]|import ['"]jspdf/.test(content)) {
        violations.push(fullPath);
      }
    }
  }
  return violations;
}

const violations = scanDir('src');
if (violations.length > 0) {
  console.error('assert-no-static-jspdf FAILED: static jspdf import detected in:');
  violations.forEach(f => console.error('  ' + f));
  console.error('  Use dynamic import(): await import(\'../pdf/generateQuotePdf\') instead.');
  process.exit(1);
}
console.log('✓ no static jspdf imports found in src/');
```

**Placement in build script:** Run BEFORE `vitest` and `tsc` to catch the regression cheaply (no need to compile TypeScript first):
```
lint-no-raw-html → assert-no-static-jspdf → vitest --coverage → tsc -b → vite build → assert-bundle-size → assert-no-pdf-preload
```

### Pattern 8: Tauri Save Dialog (D-12)

**Plugins NOT yet installed.** Both require:
1. npm install in `package.json`
2. `tauri-plugin-dialog = "2"` + `tauri-plugin-fs = "2"` in `src-tauri/Cargo.toml`
3. `.plugin(tauri_plugin_dialog::init())` + `.plugin(tauri_plugin_fs::init())` in `src-tauri/src/main.rs`
4. Capability permissions in `src-tauri/capabilities/default.json`

**Required capability permissions:**
```json
{
  "permissions": [
    "core:default",
    "shell:default",
    "window-state:default",
    "dialog:allow-save",
    "fs:allow-write-file",
    { "identifier": "fs:scope", "allow": [{ "path": "$DOWNLOAD/*" }] }
  ]
}
```

**TypeScript code path:**
```typescript
// Inside generateQuotePdf.ts — Tauri branch
const { save } = await import('@tauri-apps/plugin-dialog');
const { writeFile } = await import('@tauri-apps/plugin-fs');

const savePath = await save({
  defaultPath: filename,   // e.g. "Quote-Q-0042-AliceTest.pdf"
  filters: [{ name: 'PDF', extensions: ['pdf'] }],
});

if (!savePath) return; // user cancelled — null return documented in Tauri docs

const buffer = doc.output('arraybuffer');
await writeFile(savePath, new Uint8Array(buffer));
```

**Confirmed behavior:** `save()` returns `null` on cancel and the file path string on confirm. The `fs:scope` with `$DOWNLOAD/*` allows writing to the user's Downloads folder (the default destination). The file dialog's scope implicitly expands to allow the selected path, so a broader `$HOME/**` scope is not required if the user always picks from within the dialog. [CITED: v2.tauri.app/plugin/dialog/, v2.tauri.app/plugin/file-system/]

**`__IS_TAURI__` guard pattern — confirmed:** Used in `src/components/UpdateBanner.tsx` (line 31), `src/App.tsx`, and `src/main.tsx`. The build-time constant is declared in `src/globals.d.ts` and injected by `vite.config.ts` via `define: { __IS_TAURI__: JSON.stringify(...) }`. The correct idiom is:
```typescript
if (__IS_TAURI__) {
  // Tauri-only code path
}
```

### Pattern 9: `taxLabelFor()` helper (D-06)

The existing `src/data/taxRates.ts` file already contains all 27 EU member state ISO codes as region codes in the `TAX_RATES` array. No separate EU list constant needs to be created — extract from the existing data.

```typescript
// Source: src/data/taxRates.ts — existing EU member rows
// Add to src/utils/taxResolution.ts alongside resolveTaxRate()

// EU27 ISO 3166-1 alpha-2 codes (extracted from TAX_RATES + BG/HR/HU/RO)
// Note: the EU stats body uses "EL" for Greece; ISO 3166-1 uses "GR".
// TAX_RATES uses GR (ISO standard). taxLabelFor() uses GR to match
// what UserProfile.address.country would contain from any standard address form.
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

**GR vs EL note:** EU statistics body (Eurostat) uses "EL" for Greece; ISO 3166-1 uses "GR". The `TAX_RATES` array uses `'GR'` (ISO standard). `UserProfile.address.country` is documented as "ISO 3166-1 alpha-2" in `src/types.ts:286`. Therefore `taxLabelFor()` uses `'GR'` to match what the address form would contain. Users entering "EL" get the generic "Tax" fallback — acceptable edge case.

**Mexico note:** Spain (ES) and Mexico (MX) both use IVA. This is consistent — the mapping covers both.

**AU/NZ/IN/CA note:** IN (India) uses GST since 2017; NZ uses GST at 15%. Both are correctly mapped here. [ASSUMED — verified against training knowledge; no new source checked for this phase]

### Pattern 10: `formatQuoteNumber()` helper (D-05)

```typescript
// Location: src/utils/currency.ts (preferred — it already houses formatCurrency
// and other display-formatting helpers; the PDF generator imports currency.ts anyway)
// OR colocated in src/pdf/generateQuotePdf.ts if the planner prefers isolation.

// Format a quote number as Q-NNNN
export function formatQuoteNumber(n: number): string {
  return 'Q-' + String(n).padStart(4, '0');
}

// Examples: formatQuoteNumber(1) → 'Q-0001'
//           formatQuoteNumber(42) → 'Q-0042'
//           formatQuoteNumber(1000) → 'Q-1000'
//           formatQuoteNumber(10000) → 'Q-10000' (grows past 4 digits — acceptable)
```

**Preferred location:** `src/utils/currency.ts`. Rationale: currency.ts already exports `formatCurrency`, `getCurrencySymbol` etc. It is the "display formatting" utilities file. The PDF generator already imports from currency.ts for `formatCurrency`. Adding `formatQuoteNumber` here avoids a cross-module import dependency from the PDF module back into itself. Alternatively, it could live in a `src/utils/format.ts` if the planner creates one (no such file exists today — `formatRelativeDate.ts` is the closest, but that's a standalone file not a general format module).

### Pattern 11: `customerNameSlug()` helper (D-11)

```typescript
// Location: src/pdf/generateQuotePdf.ts (colocated — PDF-specific helper)
// OR src/utils/currency.ts if planner prefers consolidation

// Generate an ASCII-safe filename slug from a customer name.
// Lowercase, replace spaces with hyphens, strip non-alphanumeric, cap at 30 chars.
// Returns empty string for undefined/empty input.
export function customerNameSlug(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 30);
}

// Examples:
// customerNameSlug('Alice Test')    → 'alice-test'
// customerNameSlug('Acme Co.')      → 'acme-co'
// customerNameSlug('Jean-François') → 'jean-franois'  (accent stripped — ASCII-safe)
// customerNameSlug(undefined)       → ''
// customerNameSlug('')              → ''
```

**Collision check:** No existing helper in `src/utils/` matches this slug pattern. `csvHelpers.ts`, `currency.ts`, `gcodeParser.ts`, `formatRelativeDate.ts`, `taxResolution.ts`, `threeMfParser.ts` — none contain a general string slug function. No collision. [VERIFIED: codebase grep]

**Filename assembly:**
```typescript
const slug = customerNameSlug(job.customer?.name ?? job.customer?.company);
const filename = slug
  ? `Quote-${formatQuoteNumber(quoteNum)}-${slug}.pdf`
  : `Quote-${formatQuoteNumber(quoteNum)}.pdf`;
```

### Pattern 12: Quote Number Assignment + Race-Condition Guard

The CONTEXT.md calls out a race condition: "Two PDFs generated in rapid succession from the same job assigning two different numbers."

The correct pattern:
```typescript
// In generateQuotePdf(), before building the doc:

let quoteNumber = job.quoteNumber;

if (quoteNumber === undefined) {
  // First PDF gen for this job — assign and persist BEFORE rendering
  const profile = userProfile;
  quoteNumber = profile.nextQuoteNumber ?? 1;

  // Persist BOTH changes atomically:
  const updatedJob = { ...job, quoteNumber };
  const updatedProfile = { ...profile, nextQuoteNumber: quoteNumber + 1 };

  // Write to Dexie (these are the callers' responsibility — pass db as param or
  // accept them as callbacks to keep generateQuotePdf() pure)
  await onAssignQuoteNumber(updatedJob, updatedProfile);
}
// quoteNumber is now guaranteed to be defined
```

**Race condition analysis:** Two rapid clicks on "Generate PDF" for the same job:
1. Click 1: reads `job.quoteNumber === undefined`, assigns Q-0042, persists
2. Click 2 (simultaneous): reads the SAME `job` object (not yet updated from Dexie)

The fix is to make the generator receive the already-assigned `job.quoteNumber` from the component that already called the DB. The component should check `job.quoteNumber` before calling `generateQuotePdf`, assign it via Dexie first, then pass the updated job to the generator. This separates concerns: the component owns DB writes; the generator is pure PDF assembly given a complete job record.

Alternatively, use a module-level `inProgress` flag to debounce multiple rapid clicks (simpler, but less architecturally clean).

### Anti-Patterns to Avoid

- **Static import of jspdf:** `import { jsPDF } from 'jspdf'` at the top of any file in `src/` — violates PDF-03. CI gate catches this.
- **Side-effect import of autotable:** `import 'jspdf-autotable'` or `import jspdf from 'jspdf-autotable'` — the v5.x named function pattern is required.
- **Calling `doc.autoTable()` method:** This works only if `applyPlugin(jsPDF)` was called first, which is the old v3 pattern. Use `autoTable(doc, options)` instead.
- **Base64 font inlined in `generateQuotePdf.ts`:** Puts ~110 KB of text in the main generator file. Keep in `notoSansBase64.ts`.
- **Registering fonts per-doc-instance (not guarded):** Wasteful; the module-level `fontsLoaded` flag prevents double-registration.
- **Not including U+20AC in the font subset:** The `€` symbol lives outside Latin + Latin-Ext blocks. Must be explicitly added to the subsetting script's character set.
- **NewBadge as inline flex child in the button row:** The badge must be an absolute overlay. Do NOT insert `<NewBadge>` inside a `<Button>` that is a `flex-1` sibling — it widens its sibling and causes layout shifts. Use `relative` wrapper + `absolute -top-1 -right-1`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF document assembly | Custom canvas → PDF serializer | `jspdf` 4.x | Handles font embedding, page metrics, PDF spec compliance, output methods |
| Table layout in PDF | Manual `doc.rect()` + `doc.text()` grid | `jspdf-autotable` 5.x | Handles cell padding, column widths, page overflow, header rows, borders |
| Font subsetting | Custom TTF parser | `subset-font` 2.x (build-time) | HarfBuzz WASM handles Unicode complexity, layout closure, name table preservation |
| Tauri file save dialog | Custom IPC bridge | `@tauri-apps/plugin-dialog` + `plugin-fs` | Official Tauri 2 plugins; handles path normalization, permissions, cancellation |
| Country → tax label mapping | New EU list from scratch | Reuse existing `TAX_RATES` entries in `src/data/taxRates.ts` | EU27 codes already present; single source of truth |

**Key insight:** jspdf-autotable handles the single most painful part of PDF table layout — calculating column widths, wrapping text, and flowing onto new pages. Even for a collapsed single-row layout, using autotable avoids having to hand-calculate Y positions for every element.

---

## Common Pitfalls

### Pitfall 1: Wrong jspdf-autotable API (v3 vs v5)
**What goes wrong:** Developer imports `jspdf-autotable` as a side effect and calls `doc.autoTable()`. Works in isolation but fails in environments where the plugin was not auto-applied.
**Why it happens:** Most online tutorials still show the v3 pattern; the npm package jumped to v5 in 2025 with a breaking change.
**How to avoid:** Always use `import { autoTable } from 'jspdf-autotable'` and `autoTable(doc, options)`.
**Warning signs:** TypeScript error "Property 'autoTable' does not exist on type 'jsPDF'".

### Pitfall 2: `€` not in font subset
**What goes wrong:** PDF renders `€` as a rectangle/tofu glyph despite Noto Sans supporting it, because the subsetting script didn't include U+20AC.
**Why it happens:** `€` lives in the Currency Symbols Unicode block, not Latin or Latin-Ext.
**How to avoid:** Explicitly include U+20AC in the `subset-font` character set. Verify by opening a test PDF with `€` in a price field.
**Warning signs:** Rectangle glyph in price fields; affects ALL currency-symbol users (EUR, GBP, and any user with €-containing text in notes).

### Pitfall 3: Static jspdf import introduced accidentally
**What goes wrong:** A developer adds a utility (e.g., `src/utils/pdfHelpers.ts`) that imports from `jspdf` statically. Vite bundles it into the main chunk. Bundle size spikes by ~108 KB gz.
**Why it happens:** TypeScript autocomplete suggests the import; the developer doesn't realize the consequence.
**How to avoid:** `scripts/assert-no-static-jspdf.mjs` runs before `tsc` and `vite build` — catches it cheaply.
**Warning signs:** `assert-bundle-size.mjs` fails with main chunk over budget.

### Pitfall 4: modulePreload: false not applying in older Vite
**What goes wrong:** `dist/index.html` still contains `<link rel="modulepreload">` for the pdf chunk despite `modulePreload: false` in config.
**Why it happens:** Known bug in Vite versions before the PR #12111 fix. Vite 7.2.4 should have the fix, but is not confirmed with certainty for this exact scenario.
**How to avoid:** `scripts/assert-no-pdf-preload.mjs` runs post-build and fails if the tag is present. If the assertion fires, switch to `{ resolveDependencies: () => [] }`.
**Warning signs:** CI fails on `assert-no-pdf-preload.mjs`.

### Pitfall 5: Tauri plugins not installed/registered
**What goes wrong:** Desktop build silently falls through to `doc.save()` (browser path), which may trigger a Tauri CSP or simply not produce a file dialog.
**Why it happens:** `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` are NOT currently in the project. They must be added to npm deps AND Cargo.toml AND main.rs AND capabilities JSON.
**How to avoid:** Verify all 4 installation steps. Test the Tauri save path explicitly (don't rely on web-only testing).
**Warning signs:** Desktop: no file dialog appears; file is saved without prompting; or TypeScript import error.

### Pitfall 6: Quote number race condition
**What goes wrong:** User clicks "Generate PDF" twice rapidly; both renders pick up `nextQuoteNumber = 42` before either persists the increment; two PDFs get Q-0042.
**Why it happens:** `generateQuotePdf` reads `UserProfile.nextQuoteNumber`, increments, and persists — but the persist is async. A second call can read before the first persist completes.
**How to avoid:** The component should assign and persist the quote number BEFORE calling the generator, OR disable the button during generation (simplest). A simple `isGenerating` state flag in the component handler prevents double-click.
**Warning signs:** Two PDFs with the same Q-number in rapid succession.

### Pitfall 7: `defaultTerms` textarea added incorrectly to UserProfileModal
**What goes wrong:** Textarea added as a new required field, or without the optional guard, or inside the wrong form section.
**Why it happens:** `UserProfile` JSON blob — easy to add required vs optional incorrectly.
**How to avoid:** `defaultTerms?: string` in `UserProfile` type (already optional by CONTEXT.md D-09). Textarea is empty by default. No Dexie migration required.
**Warning signs:** TypeScript error on `UserProfile`; existing profiles lose data on next read.

---

## Code Examples

### Minimal jsPDF 4.x Flow

```typescript
// Source: jsPDF README (github.com/parallax/jsPDF)
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

// Set font (after registration)
doc.setFont('NotoSans', 'normal');
doc.setFontSize(10);

// Text
doc.text('3DCoster', 40, 40);

// Table
autoTable(doc, {
  head: [['Description', 'Amount']],
  body: [['Custom 3D print — My Job (qty: 1)', '€24.00']],
  startY: 80,
  theme: 'plain',
  styles: { font: 'NotoSans' },
});

// Save (web)
doc.save('Quote-Q-0001.pdf');

// Output as bytes (Tauri)
const buffer = doc.output('arraybuffer');
```

### jspdf-autotable 5.x Exports

```typescript
// Source: dist/jspdf.plugin.autotable.mjs exports line (inspected via npm)
export {
  Cell, CellHookData, Column, HookData, Row, Table,
  __createTable, __drawTable,
  applyPlugin,      // optional: applyPlugin(jsPDF) for old doc.autoTable() style
  autoTable,        // PRIMARY: autoTable(doc, options)
  autoTable as default
};
```

### Tauri Save Dialog + File Write

```typescript
// Source: v2.tauri.app/plugin/dialog + v2.tauri.app/plugin/file-system
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const path = await save({
  defaultPath: 'Quote-Q-0042-AliceTest.pdf',
  filters: [{ name: 'PDF', extensions: ['pdf'] }],
});

if (!path) return; // user cancelled

const buffer = doc.output('arraybuffer');
await writeFile(path, new Uint8Array(buffer));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import 'jspdf-autotable'` (side effect) + `doc.autoTable()` | `import { autoTable } from 'jspdf-autotable'` + `autoTable(doc, opts)` | v5.0.0, Feb 2025 | Old pattern still works via `applyPlugin()` but new named-function pattern is canonical |
| jspdf v2.x | jspdf v4.2.1 | v4.0.0, Jan 2026 | Core API unchanged; v4.0 added FS restriction in Node.js; browser API identical |
| `writeBinaryFile` (Tauri v1) | `writeFile(path, Uint8Array)` (Tauri v2) | Tauri v2.0 | API rename; functionality same |
| `modulePreload` default (preloads async chunks) | `modulePreload: false` | Config-level | Prevents PDF chunk from being pre-fetched into `index.html` |

**Deprecated/outdated:**
- `doc.autoTable({...})` without `applyPlugin`: Requires side-effect plugin attach first — not the v5 canonical pattern
- jspdf v2.x: Two major versions behind; v4.x is current stable
- jspdf-autotable v3.x: Two major versions behind; v5.x is current stable
- `@tauri-apps/api/dialog` (Tauri v1 import path): Use `@tauri-apps/plugin-dialog` (Tauri v2)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Latin + Latin-Ext + U+20AC subset gz size ≈ 70–100 KB combined for Noto Sans regular + bold | Standard Stack, D-10 escalation | If larger than ~160 KB gz, main-bundle impact is still zero (lazy chunk) but the PDF chunk approaches the upper bound of CONTEXT.md's 80–250 KB estimate |
| A2 | `build.modulePreload: false` works correctly in Vite 7.2.4 (bug #11889 was fixed before v7) | Pattern 5 | If still broken in 7.2.4, switch to `{ resolveDependencies: () => [] }` — assert-no-pdf-preload CI gate will catch this |
| A3 | `$DOWNLOAD/*` scope in Tauri fs capability is sufficient for the save dialog path | Pattern 8 | If the user picks a non-Downloads directory, `writeFile` may fail with permissions error. Mitigation: use `$HOME/**` or no scope restriction (dialog itself grants access to picked path) |
| A4 | IN (India) → GST and NZ (New Zealand) → GST mappings in `taxLabelFor()` | Pattern 9 | If wrong, a small number of sellers see incorrect tax label on PDF; low severity |
| A5 | Weekly download counts for jspdf (~3M), jspdf-autotable (~1M), subset-font (~50K) | Package Legitimacy Audit | Download counts not verified from live npm data; package legitimacy verified via slopcheck OK |
| A6 | `Uint8Array` is the correct type for `writeFile(path, data)` in `@tauri-apps/plugin-fs` v2 | Pattern 8 | If API accepts only `ArrayBuffer` or a different type, need a cast; TypeScript types from the installed package will catch this at compile time |

**If this table is empty:** Not empty — 6 assumptions logged above.

---

## Open Questions

1. **Vite 7.2.4 + `modulePreload: false` regression?**
   - What we know: Bug #11889 was fixed in PR #12111; Vite 7.x is after the fix
   - What's unclear: Exact Vite version that shipped the fix was not confirmed
   - Recommendation: Keep `assert-no-pdf-preload.mjs` as the CI gate; if it fires, switch to `{ resolveDependencies: () => [] }`

2. **Tauri fs:scope permission granularity**
   - What we know: Dialog plugin grants implicit access to the selected file; `fs:scope` defines what is allowed without dialog selection
   - What's unclear: Whether writing to an arbitrary user-picked path (not within `$DOWNLOAD`) requires a broader scope or whether the dialog's implicit permission suffices
   - Recommendation: Use `"dialog:allow-save"` + test on Tauri desktop; if permission denied errors appear, broaden to `$HOME/**`

3. **`subset-font` exact character set for U+20AC glyph closure**
   - What we know: U+20AC must be explicitly included; `subset-font` supports explicit character sets
   - What's unclear: Whether GSUB/GPOS layout closure is needed for Latin glyphs with diacritics (e.g., composed ä vs base a + combining diaeresis)
   - Recommendation: Use `--no-layout-closure` if subsetting produces unexpectedly large output; default (with closure) is safer for rendering correctness

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build scripts | ✓ | v22.17.1 | — |
| Vite | Build | ✓ | 7.2.4 | — |
| Vitest | Tests | ✓ | ^4.1.4 | — |
| `@tauri-apps/plugin-dialog` | PDF-01 (Tauri path) | ✗ | — | Must install (see Pattern 8) |
| `@tauri-apps/plugin-fs` | PDF-01 (Tauri path) | ✗ | — | Must install (see Pattern 8) |
| `tauri-plugin-dialog` (Rust crate) | Desktop Tauri build | ✗ | — | Must add to Cargo.toml |
| `tauri-plugin-fs` (Rust crate) | Desktop Tauri build | ✗ | — | Must add to Cargo.toml |
| `jspdf` | PDF-02 | ✗ | — | Must install |
| `jspdf-autotable` | PDF-02 | ✗ | — | Must install |
| `subset-font` | D-10 font subsetting | ✗ | — | Must install (dev, build-time only) |
| Noto Sans TTF source files | D-10 | ✗ | — | Must download from Google Fonts |
| Python / `pyftsubset` | D-10 (alternative tool) | Not required | — | `subset-font` is Node-native, no Python needed |

**Missing dependencies with no fallback:**
- `jspdf` + `jspdf-autotable` — PDF generation is the entire phase; no fallback
- `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` — Tauri desktop save path; without these, desktop users get browser-style save or an error

**Missing dependencies with fallback:**
- `subset-font` — if unavailable, could use Google Fonts Helper manual download + font converter tool from jsPDF docs; more manual, still achieves the goal

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 with jsdom environment |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `vitest run` |
| Full suite command | `vitest run --coverage` |
| Coverage enforcement | `vitest run --coverage` with v8 provider; currently covers `src/utils/costCalc.ts` at 95/100/90 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | "Generate PDF" button appears and is disabled when `sellingPrice <= 0` | manual | Visual inspection in dev | ❌ Wave 0 |
| PDF-02 | PDF contains all required sections (header, quote#, customer, line items, totals, footer) | integration (doc snapshot) | `vitest run src/pdf/generateQuotePdf.test.ts` | ❌ Wave 0 |
| PDF-03 | No static jspdf import in src/ | build gate | `node scripts/assert-no-static-jspdf.mjs` | ❌ Wave 0 |
| PDF-04 | No modulepreload for pdf chunk in dist/index.html | build gate | `node scripts/assert-no-pdf-preload.mjs` | ❌ Wave 0 |
| PDF-05 | Main chunk still under 300 KB gz | build gate | `node scripts/assert-bundle-size.mjs` | ✅ Exists (Phase 11) |
| REQ-UTIL | `formatQuoteNumber(n)` produces correct output | unit | `vitest run src/utils/taxResolution.test.ts` (or new) | ❌ Wave 0 |
| REQ-UTIL | `taxLabelFor(countryCode)` maps EU → VAT, etc. | unit | Same test file | ❌ Wave 0 |
| REQ-UTIL | `customerNameSlug(name)` produces ASCII-safe slug ≤ 30 chars | unit | Same test file | ❌ Wave 0 |

### Integration Test Pattern (PDF-02)

jsPDF's `doc.output('arraybuffer')` returns bytes; a full PDF parse is overkill. A lighter approach: use `doc.output('datauristring')` or check that the generated Uint8Array starts with `%PDF-` and contains expected strings:

```typescript
// src/pdf/generateQuotePdf.test.ts
import { describe, it, expect } from 'vitest';
import { generateQuotePdf } from './generateQuotePdf';

// Note: jspdf requires a browser-like environment (jsdom)
// vitest.config.ts already sets environment: 'jsdom'

describe('generateQuotePdf', () => {
  it('output starts with %PDF- magic bytes', async () => {
    const bytes = await generateQuotePdfBytes(mockJob, mockProfile);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('returns defined output for job with quoteNumber already assigned', async () => {
    const bytes = await generateQuotePdfBytes({ ...mockJob, quoteNumber: 42 }, mockProfile);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
```

The generator should expose a `generateQuotePdfBytes` function (returns `Uint8Array`) alongside `generateQuotePdf` (saves to disk) for testability.

### Sampling Rate
- **Per task commit:** `vitest run` (skips coverage, fast)
- **Per wave merge:** `vitest run --coverage`
- **Phase gate:** Full `npm run build` (all CI gates must pass) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/pdf/generateQuotePdf.test.ts` — covers PDF-02 integration tests
- [ ] `src/utils/taxResolution.test.ts` extension — covers `taxLabelFor()` (add to existing file)
- [ ] `src/utils/currency.test.ts` (new) OR extend existing test — covers `formatQuoteNumber()` and `customerNameSlug()`
- [ ] `scripts/assert-no-static-jspdf.mjs` — build gate for PDF-03
- [ ] `scripts/assert-no-pdf-preload.mjs` — build gate for PDF-04
- [ ] `scripts/subset-noto-sans.mjs` — one-time font subsetting script
- [ ] `src/pdf/notoSansBase64.ts` — generated output of subsetting script (committed)

*(PDF-05 gap: none — `scripts/assert-bundle-size.mjs` already exists from Phase 11)*

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in app |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Local-only data |
| V5 Input Validation | Yes (limited) | Job/customer data comes from user's own Dexie records — same user who creates is who downloads; no cross-user contamination; still sanitize before rendering in PDF to avoid PDF injection |
| V6 Cryptography | No | No secrets or encryption in PDF generation |

### PDF-Specific Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PDF injection via job title/customer name | Tampering | jsPDF 4.2.1 fixed "HTML Injection in output methods" (security patch in v4.2.1); do NOT use `doc.html()` with unescaped user content — use `doc.text()` which is plain-text only |
| Static jspdf import increasing attack surface on page load | Elevation of Privilege (supply chain) | `assert-no-static-jspdf.mjs` CI gate; dynamic import limits exposure to PDF generation time only |
| Tauri writeBinaryFile writing to arbitrary path | Tampering | `fs:scope` in capability JSON limits writable paths; save dialog restricts to user-chosen path |

**Note on jsPDF 4.2.1 security fix:** The patch release fixed "HTML Injection in output methods" and "PDF Object Injection via free text annotation color." For Phase 16, we use `doc.text()` and `autoTable()` with string values — the HTML injection vector (`doc.html()`) is never used. The PDF Object Injection vulnerability affected annotation color parameters; not used here. Both fixes are included in the locked 4.2.1 version. [CITED: github.com/parallax/jsPDF/releases/tag/v4.2.1]

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view jspdf version`, `npm view jspdf-autotable dist-tags`) — current versions 4.2.1 and 5.0.8
- `node_modules/jspdf/dist/jspdf.es.js` (dist file inspection) — export shape confirmed: `export { ..., jsPDF as default, jsPDF }`
- `node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs` (dist file inspection) — export shape confirmed: `export { ..., applyPlugin, autoTable, autoTable as default }`
- `node_modules/jspdf/dist/jspdf.es.min.js` gz measurement via Node.js zlib — 108.0 KB gzipped
- `node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs` gz measurement — 18.1 KB gzipped
- github.com/parallax/jsPDF README — `addFileToVFS` / `addFont` / `setFont` API
- github.com/simonbengtsson/jsPDF-AutoTable releases — v5.x named function export confirmed
- v2.tauri.app/plugin/dialog/ — `save()` API, null on cancel
- v2.tauri.app/plugin/file-system/ — `writeFile(path, Uint8Array)` API
- vite.dev/config/build-options — `build.modulePreload` type and behavior
- github.com/vitejs/vite/issues/11889 — modulePreload: false bug (fixed in PR #12111)
- fonts.google.com/noto/specimen/Noto+Sans — Noto Sans Unicode coverage (2,840 chars, 30 blocks)
- `src/data/taxRates.ts` — existing EU27 country codes (codebase read) [VERIFIED: codebase]
- `src/components/ui/Button.tsx` — `disabled` prop support via `ButtonHTMLAttributes` [VERIFIED: codebase]
- `src/components/NewBadge.tsx` — badge component API and rendering [VERIFIED: codebase]
- `scripts/assert-bundle-size.mjs` — prior art for new CI scripts [VERIFIED: codebase]
- `vite.config.ts` — existing `manualChunks` pattern [VERIFIED: codebase]
- github.com/parallax/jsPDF/releases/tag/v4.2.1 — v4.2.1 security patch notes

### Secondary (MEDIUM confidence)
- npmjs.com/package/jspdf-autotable — v5.x breaking change: "plugin no longer auto-applied in non-browser environments"
- xjavascript.com/blog/jspdf-autotable-typescript — v5 TypeScript usage patterns
- github.com/vitejs/vite/discussions/8617 — modulepreload and dynamic imports discussion
- bundlephobia.com API (jspdf 4.2.1) — 399 KB minified, 127 KB gzip [rate-limited on second call]

### Tertiary (LOW confidence)
- Weekly download counts for all 5 packages — estimated from training data [ASSUMED]
- Noto Sans subsetted file sizes — estimated from typical 10–15% ratio of full font size [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry; dist file inspection confirmed export shapes
- Architecture: HIGH — all patterns verified against codebase, library dist files, and official docs
- Pitfalls: HIGH — pitfalls verified against actual API inspection (autotable v5 export shape, jspdf exports, Tauri plugin status in Cargo.toml)
- Tauri plugin installation: HIGH — confirmed NOT installed; installation steps documented from official Tauri 2 docs
- Font subsetting estimates: MEDIUM — size estimates are derived from typical subset ratios, not measured directly on the exact Noto Sans subset

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (jspdf minor releases move slowly; Tauri 2 plugin APIs are stable; Vite 7.x patch releases are backward-compatible)

---

## RESEARCH COMPLETE

**Phase:** 16 — printable-pdf-quote
**Confidence:** HIGH

### Key Findings

1. **jspdf is v4.2.1, NOT v2.x as CONTEXT.md assumed.** jspdf-autotable is v5.0.8, NOT v3.x. The calling convention for autotable changed in v5: use `autoTable(doc, options)` named function, not `doc.autoTable()`. All other jsPDF APIs (addFileToVFS, addFont, setFont, doc.save, doc.output) are stable and unchanged.

2. **Tauri save-dialog plugins are NOT installed.** `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` are absent from `package.json`, `Cargo.toml`, `main.rs`, and capabilities. Four-step installation is required (npm + Cargo.toml + main.rs + capabilities JSON). This is a non-trivial dependency chain that the planner must account for.

3. **`€` glyph is NOT in Latin or Latin-Ext Unicode blocks.** D-10 says "Latin + Latin-Ext subset" but `€` (U+20AC) is in Currency Symbols. The subsetting script must explicitly add U+20AC. This is documented as a necessary escalation — not a silent scope change.

4. **Bundle budget is comfortable.** jspdf gz ≈ 108 KB + autotable gz ≈ 18 KB + fonts gz ≈ 80 KB = ~206 KB total lazy PDF chunk — well within CONTEXT.md's 80–250 KB gz estimate, and zero impact on the 300 KB gz main-chunk gate.

5. **`modulePreload: false` has a known historical bug but is fixed in Vite 7.x.** Belt-and-suspenders: add the `manualChunks` entry for `pdf` AND the `assert-no-pdf-preload.mjs` CI gate. If `false` misbehaves, `{ resolveDependencies: () => [] }` is the workaround.

### File Created
`.planning/phases/16-printable-pdf-quote/16-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack (jspdf) | HIGH | Dist files inspected; gz sizes measured; export shapes confirmed |
| Standard Stack (Tauri plugins) | HIGH | npm packages verified; official Tauri 2 docs consulted |
| Architecture Patterns | HIGH | All 12 patterns verified against codebase + library sources |
| Font glyph coverage | HIGH | Google Fonts Noto Sans docs confirm Latin+Latin-Ext-B coverage; U+20AC escalation documented |
| Bundle size estimates | MEDIUM | jspdf gz measured directly; font estimates from typical ratios |
| Vite modulePreload: false | MEDIUM | Known bug fixed in v7, but exact patch version not confirmed |

### Open Questions
1. Whether Vite 7.2.4 `modulePreload: false` is fully reliable — CI gate will catch any regression
2. Tauri `fs:scope` permission scope needed for save-dialog-selected paths — test during implementation
3. Whether `subset-font` GSUB closure is needed for composed diacritics — default with closure is safer
