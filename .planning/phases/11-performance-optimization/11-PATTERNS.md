# Phase 11: Performance Optimization - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 6 (4 MODIFY + 2 CREATE)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vite.config.ts` (MODIFY) | config | build-config | `vitest.config.ts` (defineConfig + nested config block, Phase 10) | exact (same defineConfig shape, same nested-block insertion pattern) |
| `src/components/JobsManager.tsx` line 237 (MODIFY) | component | request-response (list render) | `src/components/AssetLibrary.tsx` `paginatedAssets.map` (lines 848 / 987 / 1057) | exact (sibling component in same dir, same list-render seam) |
| `src/components/AssetLibrary.tsx` lines 848 / 987 / 1057 (MODIFY) | component | request-response (list render) | Itself — three call sites need the same wrapping treatment; reference call site #1 (mobile, line 848) as the canonical pattern, then mirror to #2 / #3 | exact (in-file consistency) |
| `package.json` (MODIFY) | config | build-config | `package.json` `scripts.build` current chain (`lint-html → vitest → tsc → vite`) | exact (just appends one more `&&` step) |
| `scripts/assert-bundle-size.mjs` (CREATE) | utility | file-I/O + CLI exit-code | `scripts/lint-no-raw-html.mjs` | exact (same shape: Node CLI invoked from build chain, exits non-zero on failure, prints concise success/failure message) |
| `scripts/seed-test-jobs.mjs` (CREATE, one-off, NOT checked-in) | utility | data-seed | `scripts/lint-no-raw-html.mjs` (header style + Node built-ins approach) — content differs (uses Dexie) | role-match |

---

## Pattern Assignments

### `scripts/assert-bundle-size.mjs` (utility, file-I/O + CLI exit-code)

**Analog:** `scripts/lint-no-raw-html.mjs`

**Pattern: Header comment + script wiring trail** (lines 1-7):
```javascript
// scripts/lint-no-raw-html.mjs
// Grep-based guard: forbids raw <button>/<input>/<select>/<textarea> JSX
// in src/components/ (excluding src/components/ui/). Lines preceded by
// `allow-raw-html` (in a JSX or JS comment) are exempted.
//
// Wired into package.json `build` and `.git/hooks/pre-commit` per Phase 07
// (UI-03). Minimal Node built-ins; no npm install required.
```
Copy the format: top-line path comment, 2-3 lines of "what it does", a blank-comment-line separator, then "Wired into ... per Phase 11 (PERF-01). Minimal Node built-ins; no npm install required." Cite D-09.

**Pattern: ESM imports of Node built-ins** (lines 8-9):
```javascript
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
```
For Phase 11 use: `import { readdirSync, readFileSync, statSync } from 'fs';`, `import { gzipSync } from 'zlib';`, `import { join } from 'path';`. No third-party deps.

**Pattern: Top-level constants block** (lines 11-13):
```javascript
const SCAN_DIRS = ['src/components'];
const EXCLUDE_DIR = 'src/components/ui';
const PATTERN = /<(button|input|select|textarea)([\s>\/]|$)/;
```
For Phase 11: `const DIST_DIR = 'dist/assets';`, `const MAX_GZIPPED_BYTES = 307200; // 300 KB per PERF-01 / D-11`, `const MAIN_CHUNK_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;`. Inline-comment the 307200 with its provenance so a future bump (D-11) is traceable.

**Pattern: Violation accumulator + early-exit on non-empty** (lines 24, 41-46):
```javascript
const violations = [];
// ... loop body pushes to violations ...
if (violations.length > 0) {
  console.error('Raw HTML form elements found (use shared primitives or add // allow-raw-html):');
  violations.forEach(v => console.error('  ' + v));
  process.exit(1);
}
console.log('lint:no-raw-html passed');
```
For Phase 11: instead of a `violations[]`, measure one number (`gzippedBytes`), branch on `> MAX_GZIPPED_BYTES`. On failure, `console.error` the over-budget chunk path + actual size + threshold + delta, then `process.exit(1)`. On success, `console.log` per D-09's exact phrasing: `✓ main chunk: 187 KB gzipped (under 300 KB)` so headroom is visible over time. Use template literal with computed actual KB.

**Pattern: No try/catch, no async** — `lint-no-raw-html.mjs` uses sync APIs throughout (`readdirSync`, `readFileSync`). Match this. Use `readdirSync(DIST_DIR)`, `readFileSync(fullPath)`, `gzipSync(buffer).length`. Crashes propagate as non-zero exit — that's the desired behavior for a build gate.

**Discretion call from D-09:** Walk `dist/assets/` to find files matching `index-*.js`, sort by size descending, pick the largest (matches PERF-01 wording "main app chunk"). Simpler than asserting per-chunk.

---

### `vite.config.ts` (config, build-config)

**Analog:** `vitest.config.ts` (Phase 10 — most recently modified config file in the repo)

**Pattern: defineConfig with nested config object** (vitest.config.ts lines 1-17):
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/costCalc.ts'],
      thresholds: {
        lines: 95,
        functions: 100,
        branches: 90,
      },
    },
  },
})
```
This is the canonical "add a nested config block to a defineConfig call" shape. Phase 11 mirrors it by adding a `build` block inside vite.config.ts's existing `defineConfig({...})`.

**Current `vite.config.ts` skeleton** (lines 1-72) — the file is structured as:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: { __IS_TAURI__: JSON.stringify(!!process.env.TAURI_ENV_PLATFORM) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ /* ... ~50 lines of PWA config ... */ })
  ],
  server: {
    port: 4173,
  },
})
```
**There is no existing `build` block.** Phase 11 adds it as a new top-level key inside `defineConfig`, sibling to `define` / `plugins` / `server`. Insert AFTER `plugins` and BEFORE `server` to keep build-time vs dev-time concerns grouped.

**New block shape (per D-01):**
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
Function-style per D-01 (clearer than object-style for conditional logic). The fn name is at planner's discretion (D-01); a top-level helper named e.g. `getManualChunk` extracted above `defineConfig` works too if planner wants it unit-testable.

**Pattern: NO test block needed in vite.config.ts** — vitest has its own config file (vitest.config.ts). Do NOT collapse them.

**Pattern: `rollup-plugin-visualizer` integration (D-10):** import lazily/conditionally so it's only loaded when `--mode analyze` is set. Example shape:
```typescript
import { defineConfig } from 'vite'
// ...
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ /* ... */ }),
    ...(mode === 'analyze' ? [visualizer({ open: true, gzipSize: true })] : []),
  ],
  // ...
}))
```
Planner picks between this functional-form switch or a static import + always-on plugin. Functional-form is preferred because it keeps the analyzer out of every Vercel deploy (matches D-10's "opt-in" intent).

---

### `src/components/JobsManager.tsx` line 237 (component, request-response list render)

**Analog:** Itself, specifically the `paginatedAssets.map` pattern in `AssetLibrary.tsx`. The current JobsManager render is a flat `jobs.map(job => { ... })` with NO pagination, NO virtualization — Phase 11 introduces virtualization for the first time on this seam.

**Current pattern at lines 236-402** — `jobs.map` lives inside a wrapper `<div className="space-y-3">` and produces large per-job cards (~165 lines per iteration, lines 237-401). Item JSX shape:
```tsx
<div className="space-y-3">
  {jobs.map(job => {
    const info = getBreakEvenInfo(job);
    const isSelected = selectedJobId === job.id;

    return (
      <div
        key={job.id}
        onClick={() => setSelectedJobId(isSelected ? null : job.id)}
        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
          isSelected ? 'bg-slate-700 border-blue-500' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
        }`}
      >
        {/* header row: name + break-even badge */}
        {/* filament+time row */}
        {/* revenue + copies sold (right side) */}
        {isSelected && (
          {/* expanded details: cost grid, model URL, progress bar, action buttons, recent sales */}
        )}
      </div>
    );
  })}
</div>
```

**Closures the item-render needs** (per D-06 — extract from line 237 region):
- `job` (from `jobs[index]`)
- `info` = `getBreakEvenInfo(job)` (line 238 — `useCallback` defined at line 125)
- `isSelected` = `selectedJobId === job.id` (line 239)
- `setSelectedJobId` (line 43 state)
- `sales` (line 53, scoped to `selectedJobId`) — only used in the expanded section
- `getFilamentName` (line 215, captures `materials` prop)
- `setShowSaleForm`, `setSalePrice`, `handleEditJob`, `handleDeleteJob` — for the action buttons in the expanded section

**Pattern: Conditional render based on count (D-06)** — wrap with `jobs.length > 100 ? <FixedSizeList> : flat-map`. Below 100, keep current behavior identical to avoid any regression on the common case.

**Pattern: react-window item renderer** — extract the inner JSX into a function or memoized component that accepts `{ index, style }` from react-window and applies `style` to the outermost `<div>` (replaces the current outer `<div key={job.id} ...>`). Pass the closure-needed values either via component props or `itemData`. Example skeleton:
```tsx
const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
  const job = jobs[index];
  const info = getBreakEvenInfo(job);
  const isSelected = selectedJobId === job.id;
  return (
    <div
      style={style}
      key={job.id}
      onClick={() => setSelectedJobId(isSelected ? null : job.id)}
      className={/* same classes as today */}
    >
      {/* exact same children as lines 251-398 */}
    </div>
  );
};

return jobs.length > 100 ? (
  <FixedSizeList
    height={600}
    itemCount={jobs.length}
    itemSize={ROW_HEIGHT}
    width="100%"
  >
    {Row}
  </FixedSizeList>
) : (
  <div className="space-y-3">
    {jobs.map((_, index) => <Row key={jobs[index].id} index={index} style={{}} />)}
  </div>
);
```

**Row height note (D-08):** the collapsed card is ~88px (`p-4` + header row + filament row + revenue right-side). Expanded selected card is ~400px. Planner picks: (a) `FixedSizeList` with a height ≥ collapsed card, accepting overlap when expanded (BAD — clipping) OR (b) `VariableSizeList` keyed on `selectedJobId` so the expanded card claims more space (PREFERRED for jobs because expansion is the core UX). D-08 says bias toward fixed; planner should escalate this trade-off in the plan.

**Pattern: import** — add `import { FixedSizeList } from 'react-window';` (or `VariableSizeList`) to the existing imports at line 1-5. Keep the import grouping (external libs first, then `'../types'`, then `'../hooks/...'`, then `'./ui'` and `'./ui/icons'`).

---

### `src/components/AssetLibrary.tsx` lines 848 / 987 / 1057 (component, request-response list render)

**Analog:** Itself — the three call sites are intentionally three different DOM shapes (D-07: "mobile vs desktop vs another variant — they're different DOM shapes and may need different row heights"). Reference call site #1 (line 848, **mobile card**) as canonical, then apply parallel treatment to #2 (line 987, **printer table**) and #3 (line 1057, **materials table**).

**Confirmed identities of the three call sites:**
| Line | Variant | DOM shape | Wrapping element today |
|------|---------|-----------|------------------------|
| 848 | **Mobile cards** | `<div className="bg-slate-800/50 rounded-xl p-4 ...">...</div>` inside `<div className="flex flex-col gap-3">` inside `<div className="md:hidden">` | flex column of cards |
| 987 | **Desktop PRINTERS table** | `<tr className="text-slate-300">...<td>...</td>...</tr>` inside `<tbody className="divide-y divide-slate-700/50">` inside `<table className="w-full text-sm">` | `<tbody>` (table semantics) |
| 1057 | **Desktop MATERIALS table** | `<tr className="text-slate-300">...<td>...</td>...</tr>` inside `<tbody>` inside a second `<table>` | `<tbody>` (table semantics) |

**Critical pattern note for the planner:** The two `<tbody>` call sites (987, 1057) cannot be directly wrapped in `FixedSizeList` because `<tbody>` accepts only `<tr>` children and react-window injects positioned `<div>` wrappers. Planner MUST decide: (a) replace the `<table>` with a div-based grid when virtualizing (loses semantic markup), (b) use a custom `outerElementType` / `innerElementType` pointing to `tbody` / `tr` (react-window v2 supports this), or (c) accept that desktop tables are not virtualized and only virtualize the mobile cards (cleanest, but violates D-07 which says "all three must be virtualized when triggered"). This is the load-bearing design question for the AssetLibrary virtualization plan.

**Pagination/threshold context** (lines 250-258):
```typescript
// Pagination - itemsPerPage of 0 means show all
const effectiveItemsPerPage = itemsPerPage === 0 ? sortedAssets.length : itemsPerPage;
const totalPages = effectiveItemsPerPage > 0 ? Math.ceil(sortedAssets.length / effectiveItemsPerPage) : 1;
const paginatedAssets = itemsPerPage === 0
  ? sortedAssets
  : sortedAssets.slice(
      (currentPage - 1) * effectiveItemsPerPage,
      currentPage * effectiveItemsPerPage
    );
```
Per D-07 the trigger is `itemsPerPage > 50` (NOT `paginatedAssets.length`). The select at line 1132-1136 offers `10 / 25 / 50 / 100 / 0(All)`. So virtualization fires only when user picks 100 or All. Use `effectiveItemsPerPage > 50` as the predicate (handles the `itemsPerPage === 0` → "all" case correctly).

**Canonical wrap example (mobile cards, line 848):**
```tsx
{paginatedAssets.length > 0 ? (
  effectiveItemsPerPage > 50 ? (
    <FixedSizeList
      height={600}
      itemCount={paginatedAssets.length}
      itemSize={MOBILE_CARD_HEIGHT}
      width="100%"
    >
      {({ index, style }) => {
        const asset = paginatedAssets[index];
        return (
          <div style={style} key={asset.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            {/* exact same children as lines 853-961 */}
          </div>
        );
      }}
    </FixedSizeList>
  ) : (
    <div className="flex flex-col gap-3">
      {paginatedAssets.map(asset => (
        <div key={asset.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          {/* original children */}
        </div>
      ))}
    </div>
  )
) : filteredAssets.length === 0 ? (
  <p className="text-center text-slate-500 py-4">No {filterCategory === 'printer' ? 'printers' : 'materials'} found</p>
) : null}
```

**Row height measurement (D-08 + Claude's Discretion):**
- Mobile card (line 848): ~280px when populated (header + brand + notes + tags + cost grid + buttons + paddings). Planner should measure live.
- Printer table row (line 987): ~52px when only name+brand (single line), can grow to ~120px+ with notes + tags. Variable.
- Materials table row (line 1057): same shape as printer table — ~52-120px.

If planner picks `FixedSizeList`, row height must accommodate the maximum case (tags + notes present) → ~280px mobile, ~120px tables. Wastes vertical space for sparse rows. Alternative: `VariableSizeList` with a measurement pass. D-08 biases toward fixed.

**Closures the item-render needs** at the three call sites:
- Mobile (848): `asset`, `getCategoryColor`, `getCategoryLabel`, `startEdit`, `onDeleteAsset`
- Printer table (987): `asset`, `getCategoryColor`, `getCategoryLabel`, `startEdit`, `onDeleteAsset`
- Materials table (1057): `asset`, `getCategoryColor`, `getCategoryLabel`, `startEdit`, `onDeleteAsset`

All three share the same closure set — they differ only in DOM shape, not data dependencies.

---

### `package.json` (config, build-config)

**Analog:** Current `package.json` itself — Phase 11 appends to existing structures rather than introducing new shapes.

**Pattern: `scripts.build` chain (lines 7-8, current):**
```json
"build": "node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build",
```
This is a 4-step chain joined by ` && `. Phase 11 extends to 5 steps per D-09:
```json
"build": "node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs",
```
**Order is locked (D-09):** assertion runs AFTER `vite build` so `dist/assets/index-*.js` exists. Do NOT reorder.

**Pattern: New `scripts.analyze` entry** (per D-10) — add as a sibling to `build`/`dev`/`preview`:
```json
"analyze": "vite build --mode analyze",
```
Match the existing single-line script format. Place between `lint:no-raw-html` and `preview` to group build-related scripts together (planner's discretion on exact ordering).

**Pattern: dependency additions** (lines 19-28 deps block, 30-54 devDeps block):
- Add to `dependencies`: `"react-window": "^2.0.0"` (or whatever the current ^2 release is) — runtime dep, used by app components per D-05.
- Add to `devDependencies`: `"rollup-plugin-visualizer": "^5.0.0"` — build-time only per D-10.
Both blocks are alphabetized today (`dexie` before `dexie-react-hooks` before `jszip`, etc.). Maintain alphabetical order.

---

### `scripts/seed-test-jobs.mjs` (utility, data-seed) — one-off, NOT checked-in

**Analog:** `scripts/lint-no-raw-html.mjs` for the **header style and Node-built-ins philosophy**, but the body differs substantially (Dexie writes vs filesystem reads).

**Pattern to copy:**
- Top-comment header with file path + 2-3 lines of purpose + "Wired into ..." trail. Phase 11 trail line: `// One-off seed for PERF-02 manual UAT (D-13). NOT checked in. Run from browser DevTools console — see SUMMARY.md.`
- Sync code, no try/catch (the script either works or the operator sees the error)
- Console output: one success line at the end, error + exit on failure

**Pattern that DIFFERS from the analog:** This script does NOT run in Node — Dexie is browser-only (IndexedDB). The script is either:
1. A `.mjs` file the operator pastes into the browser DevTools console
2. A `.html` page with an inline `<script type="module">` that imports the app's Dexie instance

Planner picks. D-13 + the "ephemeral" specifier ("NOT a checked-in test seed") suggest option 1 — paste-into-console is simplest. The `.mjs` extension is misleading for Node; the planner may rename to `.js` or document in the header that this is browser-console-paste-only.

**Important per CONTEXT.md "Specifics":** "The 500-item test fixture for PERF-02 manual UAT should be ephemeral... NOT a checked-in test seed. The phase summary should document how to run it AND how to clean it up." So:
- Either gitignore `scripts/seed-test-jobs.mjs` OR keep it in a comment block inside SUMMARY.md
- Document the cleanup procedure (e.g., DevTools → Application → IndexedDB → 3DCoster → delete the seeded rows; or a paired `clean-test-jobs.mjs`)

---

## Shared Patterns

### Pattern: Build-chain gate script
**Source:** `scripts/lint-no-raw-html.mjs`
**Apply to:** `scripts/assert-bundle-size.mjs`

Both share: top-line path comment, ESM sync built-ins, top-level constants, accumulator + early-exit-on-non-empty (lint) or threshold-check (assert), `process.exit(1)` on failure with `console.error`, single success line on pass. Match the conciseness — the analog is 47 lines total; the new file should be similar (estimate ~30-40 lines).

### Pattern: defineConfig nested-block additions
**Source:** `vitest.config.ts` (Phase 10's coverage block at lines 7-14)
**Apply to:** `vite.config.ts` (Phase 11's `build.rollupOptions.output.manualChunks`)

Both share: a single new top-level key inside the existing `defineConfig({...})`, deeply nested config block, no new imports needed for the core change (rollup options use a function, not a plugin).

### Pattern: Conditional render based on threshold
**Source:** Existing AssetLibrary pagination check at line 1147 (`{totalPages > 1 && itemsPerPage !== 0 && ...}`)
**Apply to:** Both JobsManager (`jobs.length > 100 ? <FixedSizeList> : flat`) and AssetLibrary (`effectiveItemsPerPage > 50 ? <FixedSizeList> : flat`)

Both share: render-time conditional based on a numeric threshold, keeping the fast/simple path for small data and only paying virtualization cost when it earns its keep (D-06, D-07).

### Pattern: Sibling-component reuse, NOT generalization
JobsManager and AssetLibrary each get their own inline virtualization wrapper — do NOT extract a shared `<VirtualizedList>` component. The two seams have different thresholds (100 vs 50), different DOM shapes (cards vs cards+tables), and different item-render closure sets. A shared wrapper would over-abstract for two callers. Mirror the pattern, don't share the code.

---

## No Analog Found

None. All six files in this phase have strong analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `vite.config.ts`, `vitest.config.ts`, `package.json`, `scripts/`, `src/components/JobsManager.tsx`, `src/components/AssetLibrary.tsx`
**Files scanned:** 6 directly read; supporting grep over JobsManager/AssetLibrary for state/handler names
**Pattern extraction date:** 2026-05-20
