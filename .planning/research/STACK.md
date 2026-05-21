# Stack Research — v1.2 Quote-to-Customer Additions

**Domain:** 3D printing cost calculator — PDF quote generation, VAT/tax handling, job search/filter
**Researched:** 2026-05-20
**Confidence:** MEDIUM-HIGH (bundle sizes from Bundlephobia + community data; VAT library from GitHub history; React 19 compatibility verified from issue tracker)

---

## Context

This document covers ONLY the new dependencies required for v1.2. The existing stack (React 19 + TypeScript + Vite 7 + Tailwind + Dexie 4 + react-window 2 + vitest) is validated and locked.

**Hard constraint:** The Phase 11 build gate (`scripts/assert-bundle-size.mjs`) rejects any main chunk > 300 KB gz. Every new library in this document is either (a) lazy-loaded into its own chunk, or (b) small enough that it lands in the existing `vendor` chunk without breaching the gate.

---

## 1. Client-Side PDF Library

### Recommendation: jsPDF v4

**Version:** 4.2.1 (latest as of research date — 2 months old, actively maintained)
**npm weekly downloads:** ~9 million
**Bundle size (minified + gz):** ~95 KB gz (minzipped, per devpick March 2026 comparison; ~229 KB minified-only)
**Last publish:** 2 months ago (active)

### Why jsPDF over the alternatives

| Library | gz size | React 19 compat | Maintenance | Verdict |
|---------|---------|-----------------|-------------|---------|
| **jsPDF v4** | ~95 KB gz | Full (no React dep) | Active — 4.2.1, 2 months ago | **Recommended** |
| @react-pdf/renderer v4 | ~450 KB gz | Issues resolved in v4.1.0 | Active — 4.5.1, 1 month ago | Too heavy |
| pdf-lib v1 | ~100 KB gz | Full (no React dep) | **Abandoned** — last publish 5 years ago | Hard no |

**Why not @react-pdf/renderer:** The JSX-to-PDF abstraction is compelling for complex layouts, but the library is ~450 KB gz. Even lazily loaded, that chunk is 4.7x larger than jsPDF's lazy chunk. A quote PDF for a 3D printing job has modest layout needs — a structured table, logo area, line-item rows, footer. You don't need Flexbox-in-PDF for that; you need an imperative tool that can render a clean table without hauling in a second React reconciler. Additionally, multiple open GitHub issues (#2756, #2912, #2935) confirm React 19 compat was shaky until v4.1.0 — and even post-fix, the library ships its own React renderer internals that can conflict in edge cases.

**Why not pdf-lib:** The API is excellent and the bundle is comparable to jsPDF, but it was last published 5 years ago (v1.17.1). No security updates since 2021. Abandoned upstream. Forks exist (@cantoo/pdf-lib, @pdfme/pdf-lib) but none are drop-in replacements. Do not use.

**Supporting plugin: jspdf-autotable**
For the line-item table in the quote PDF, use `jspdf-autotable` (actively maintained, ~3 million weekly downloads). It must be imported inside the same lazy chunk as jsPDF — do NOT import it at module level.

---

## 2. Lazy-Load Strategy

### Exact Vite code shape

The PDF library must never appear in the main chunk. The correct pattern is a module-level async import inside the click handler, with no static import at the top of the file. Vite will see the dynamic `import()` and automatically split it into a new async chunk.

```ts
// src/utils/generateQuotePDF.ts
// No top-level import of jspdf here.

export async function generateQuotePDF(job: SavedJob, settings: UserSettings): Promise<void> {
  // Dynamic import — Vite emits this as a separate chunk (e.g. pdf-[hash].js).
  // The font file is fetched separately only when generateQuotePDF is first called.
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // Fetch the subset font (served from /public/fonts/) in parallel with lib load.
  const fontResponse = await fetch('/fonts/Inter-subset.ttf');
  const fontBuffer = await fontResponse.arrayBuffer();
  const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontBuffer)));

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Inter-subset.ttf', fontBase64);
  doc.addFont('Inter-subset.ttf', 'Inter', 'normal');
  doc.setFont('Inter');

  // ... build PDF content ...

  doc.save(`${job.name}-quote.pdf`);
}
```

**Wire it to the button:**

```tsx
// Inside JobDetail or QuotePreview component
const [generating, setGenerating] = useState(false);

async function handleDownloadPDF() {
  setGenerating(true);
  try {
    const { generateQuotePDF } = await import('../utils/generateQuotePDF');
    await generateQuotePDF(job, settings);
  } finally {
    setGenerating(false);
  }
}
```

**Do NOT add jsPDF or jspdf-autotable to `manualChunks` in vite.config.ts.** The existing `manualChunks` function only runs on `node_modules` ids — jsPDF will already be caught by `return 'vendor'` if statically imported. The correct approach is to never statically import it, so Rollup creates a fresh async chunk that is excluded from the main bundle entirely. The naming will be `pdf-[hash].js` (Rollup's default for dynamic-only chunks).

**Optional prefetch hint** (improves perceived speed — loads chunk during idle time after the user opens a job):

```ts
// Inside JobDetail component — prefetch only after main render
useEffect(() => {
  const prefetch = () => import('../utils/generateQuotePDF');
  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetch, { timeout: 3000 });
  } else {
    setTimeout(prefetch, 2000);
  }
}, []);
```

**Bundle impact:** jsPDF v4 gz chunk ~95 KB + Inter subset font ~40 KB served from `/public` (not bundled) = well within the 300 KB gate since these never enter the main chunk.

---

## 3. Regional VAT / GST Data Source

### Recommendation: curated static JSON shipped with the app

**Do NOT use `sales-tax` (node-sales-tax).** Reason: it is a Node.js-first library designed for server environments. It pulls in Node-specific dependencies (optional `axios` for online VAT number validation) and its package.json does not declare a `browser` field or ESM exports. In a Vite tree-shake build it will either error or pull in Node polyfills. The ~4,600 weekly downloads figure further confirms it is not widely used in browser contexts. Technically the JSON rates file inside it is usable, but there is no benefit to shipping the whole library.

**Do NOT use any live-API approach.** 3DCoster is offline-first (PWA, Tauri desktop). An API call for VAT rates would break offline mode.

### The correct approach: own a 50-region static JSON file

Ship a hand-curated `src/data/vatRates.ts` (or `.json`) covering the ~50 regions that matter for the typical 3D printing seller:

| Region group | Coverage needed |
|---|---|
| EU-27 | All member states (standard rate) |
| UK | 20% VAT (post-Brexit) |
| Norway, Switzerland, Iceland | EEA non-EU |
| Australia | 10% GST |
| Canada | 5% GST + province HST/PST flags |
| New Zealand | 15% GST |
| Japan | 10% consumption tax |
| US | 0% (sales tax is state/county; not applicable to this tool's scope — show disclaimer) |
| Everywhere else | `null` → show "Set manually" UX |

**Data shape:**

```ts
// src/data/vatRates.ts
export type VatRegion = {
  code: string;       // ISO 3166-1 alpha-2
  name: string;       // Display name
  rate: number | null;  // null = no standard rate / US-style complexity
  rateLabel: string;  // "20% VAT" | "10% GST" | "Set manually"
  asOf: string;       // ISO date — "2025-01-01"
  notes?: string;     // e.g. "Slovakia rate changed 2025-01-01"
};

export const VAT_RATES: VatRegion[] = [ /* ... */ ];
export const VAT_DATA_AS_OF = '2025-01-01'; // shown in UI as "Rates as of Jan 2025"
```

**Why this is the right call for offline-first:**
- Zero runtime dependency, zero bundle impact, tree-shaken to only the regions actually referenced.
- Data is versioned in git — every rate change is a PR, not a silent API update.
- The `asOf` field allows the UI to surface a banner: "Tax rates may have changed — verify before quoting."
- Maintenance burden: EU and other major VAT changes happen 1–2 times per year and are widely reported. The maintainer (you) can update in < 5 minutes.
- Sources to monitor: EU Commission VAT Rates Table, HMRC, Australian Tax Office, CRA.

**Stale-data UX pattern:** Show the `asOf` date next to the auto-filled rate:
```
VAT Rate: 19% (DE — as of Jan 2025) [Override]
```
A yellow info line if `Date.now()` is > 18 months past `asOf`. This matches the "no arbitrary numbers" principle — never silently show a rate that may be wrong.

---

## 4. Tag Search Decision

### Recommendation: Plain `Array.filter` + `String.includes` — no fuzzy library

**Do NOT add fuse.js or minisearch for v1.2.**

Reasoning:

- Target data volume: 10–500 jobs. At 500 jobs, `Array.filter` over title + customer name + tags completes in < 1 ms. fuse.js is ~8.6 KB gz, minisearch is ~14 KB gz — both are non-zero additions for zero user-perceptible gain at this scale.
- The required search is NOT fuzzy. Users search for jobs they named and tags they typed. Exact substring match is correct behavior. Fuzzy search on user-defined strings introduces false positives ("PLA" matching "PLAT" when the user has a "PLATINUM" job and a "PLA" tag).
- The filtering is multi-field (title OR customer name OR any tag), but that is three `String.includes` calls inside one `filter` pass — about 10 lines of code.
- Defer to a later milestone if: (a) job counts regularly exceed 2,000 and users report search lag, or (b) a "search across all text content including notes/description" feature is requested.

**Implementation shape (fits in the JobsManager component):**

```ts
const filtered = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
  if (!q && activeTags.length === 0) return jobs;

  return jobs.filter(job => {
    const matchesText = !q || [
      job.name,
      job.customer?.name ?? '',
      ...(job.tags ?? []),
    ].some(s => s.toLowerCase().includes(q));

    const matchesTags = activeTags.length === 0 ||
      activeTags.every(t => (job.tags ?? []).includes(t));

    return matchesText && matchesTags;
  });
}, [jobs, searchQuery, activeTags]);
```

No external dependency. Wrap in `useMemo`, debounce the text input if desired (use a simple `useState` + `useEffect` + `setTimeout` — no debounce library needed at this scale).

---

## 5. PDF Font Strategy

### Recommendation: Inter subset TTF, served from `/public/fonts/`, fetched at PDF generation time

**Do NOT use jsPDF's built-in Helvetica/Times.** These are the 14 standard PDF fonts. They cover only ASCII-codepage characters. Non-ASCII characters (accented letters, € symbol, smart quotes, many customer names) will render as garbled or missing glyphs.

**Font choice: Inter (Regular + Bold subset)**

- Inter is already the visual language of the app (Tailwind's `font-sans` default in most dark-theme builds maps to Inter or similar).
- The Inter TTF covers Latin Extended-A/B (accents, umlauts, Scandinavian letters, Polish, Czech, etc.) and common symbols (€, £, ©, ×).
- A latin+latin-ext TTF subset is approximately 35–50 KB per weight. With two weights (Regular + Bold) that is ~80–100 KB served from `/public` — fetched once and cached by the browser/PWA service worker.
- CJK is explicitly out of scope for v1.2. If a future version requires CJK support, use a Noto Sans CJK subset instead — this changes only the font fetch URL, not the PDF generation architecture.

**How to create the subset (one-time build step, not a runtime dep):**

Use `pyftsubset` (fonttools) or the [subsetter at `everythingfonts.com`](https://everythingfonts.com/subsetter) to generate a TTF covering:
- Unicode ranges: `U+0020-007F` (Basic Latin), `U+00A0-00FF` (Latin-1 Supplement), `U+0100-017F` (Latin Extended-A), `U+0180-024F` (Latin Extended-B), `U+20AC` (Euro sign)

Commit the result as `public/fonts/Inter-Regular-subset.ttf` and `public/fonts/Inter-Bold-subset.ttf`. These are static assets — Vite copies them to `dist/fonts/` as-is and the PWA workbox glob pattern `'**/*.{js,css,html,ico,png,svg,woff2}'` will need `ttf` added to precache them for offline use.

**Workbox config change required:**

```ts
// vite.config.ts — workbox.globPatterns
globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}']
```

**Font loading inside the lazy chunk (see Section 2 for full code):**

```ts
const fontResponse = await fetch('/fonts/Inter-Regular-subset.ttf');
const fontBuffer = await fontResponse.arrayBuffer();
const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontBuffer)));
doc.addFileToVFS('Inter-Regular.ttf', fontBase64);
doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
```

**Why not embed the font as a base64 string in the JS bundle?**
A 40 KB TTF as base64 inflates by ~33% to ~53 KB of string literals, which adds to the lazy chunk size and is not compressible as efficiently. The fetch approach keeps the chunk small and lets the browser/PWA cache the font file separately.

---

## New Dependencies Summary

| Package | Version | Type | gz size | Purpose |
|---------|---------|------|---------|---------|
| `jspdf` | `^4.2.1` | dependency | ~95 KB (lazy chunk) | PDF document generation |
| `jspdf-autotable` | `^3.8.x` | dependency | ~15 KB (same lazy chunk) | Line-item table in PDF |
| `@types/jspdf` | n/a | — | — | Types are bundled in jsPDF v4 itself |

**No other new npm dependencies.** The VAT rates are a `.ts` data file (zero npm dep). Tag search uses native Array methods. Font subset is a static asset in `public/`.

---

## Alternatives Considered and Rejected

| Rejected | Reason |
|----------|--------|
| `@react-pdf/renderer` | ~450 KB gz lazy chunk — 4.7× larger than jsPDF for equivalent output quality on a simple quote layout |
| `pdf-lib` | Last published 5 years ago; no security patches since 2021; abandoned upstream |
| `sales-tax` / `node-sales-tax` | Node-first package, no browser/ESM field; 4,600 downloads/week confirms niche Node use; data last updated June 2023 per PwC source |
| `eu-vat-rates` | EU-only; doesn't cover UK, AU, CA, NZ, JP which all matter to 3D printing sellers |
| `fuse.js` | 8.6 KB gz for fuzzy search nobody needs at 10–500 jobs; exact substring match is the correct behavior for user-typed queries |
| `minisearch` | ~14 KB gz; same reasoning as fuse.js; index rebuild on every Dexie mutation adds complexity |
| Base64 font in JS bundle | Font literals inflate by 33% and bloat the lazy chunk; fetch + separate static file is leaner and separately cacheable |

---

## Installation

```bash
npm install jspdf jspdf-autotable
```

No other npm installs. Font subset files are static assets committed to `public/fonts/`.

---

## Version Compatibility Notes

- jsPDF v4 ships its own TypeScript types — do NOT install `@types/jspdf` (separate package targets old v2 API).
- jspdf-autotable v3 requires jsPDF v2+; works with v4. Import pattern for Vite: use `import autoTable from 'jspdf-autotable'` and call `autoTable(doc, {...})` rather than `doc.autoTable(...)` to avoid the Vite CJS/ESM mismatch that causes "autoTable is not a function" at runtime after build.
- React 19 (currently in this project's `package.json`) has no interaction with jsPDF — jsPDF is framework-agnostic and has zero React dependency.

---

## Sources

- [jspdf npm page](https://www.npmjs.com/package/jspdf) — version 4.2.1, ~9M weekly downloads (verified)
- [jspdf Snyk advisor](https://snyk.io/advisor/npm-package/jspdf) — Key ecosystem project rating
- [@react-pdf/renderer npm page](https://www.npmjs.com/package/@react-pdf/renderer) — version 4.5.1, ~2.2M weekly downloads (verified)
- [React 19 compat issues #2756, #2912, #2935, #2964 — diegomura/react-pdf](https://github.com/diegomura/react-pdf/issues/2756) — confirmed resolved in v4.1.0
- [pdf-lib npm page](https://www.npmjs.com/package/pdf-lib) — v1.17.1, last published 5 years ago (verified abandoned)
- [devpick jspdf vs pdfkit 2026](https://devpick.co/jspdf-vs-pdfkit) — 229.8 kB minified / 95 kB minzipped figure (MEDIUM confidence — cross-referenced with "~150 KB" from nutrient.io)
- [Huge bundle size issue #632 — diegomura/react-pdf](https://github.com/diegomura/react-pdf/issues/632) — confirmed @react-pdf/renderer increases bundle from 500 KB to >1.2 MB gzipped
- [node-sales-tax GitHub](https://github.com/valeriansaliou/node-sales-tax) — changelog confirms Slovakia/Finland updates in 2024–2025; Node-first architecture confirmed (no browser field)
- [eu-vat-rates GitHub](https://github.com/benbucksch/eu-vat-rates) — EU-only coverage confirmed
- [fuse.js official site](https://www.fusejs.io/) — 8.6 KB gz (full build) confirmed
- [npm-compare.com jspdf vs pdfmake vs react-pdf](https://npm-compare.com/@react-pdf/renderer,jspdf,pdfmake,react-pdf) — download volume cross-reference
- [Vite dynamic import discussion #17730](https://github.com/vitejs/vite/discussions/17730) — confirms dynamic import produces separate async chunk

---

*Stack research for: 3DCoster v1.2 Quote-to-Customer new dependencies*
*Researched: 2026-05-20*
