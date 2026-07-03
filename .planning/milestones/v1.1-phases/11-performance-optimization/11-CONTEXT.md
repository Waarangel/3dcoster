# Phase 11: Performance Optimization - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Cut the main app bundle below 300 KB gzipped via Vite vendor chunk splitting, AND virtualize the Jobs and Assets lists so 100+ items stay smooth on a 4× CPU-throttled device. Both items are the FINAL phase of the v1.1 Polish & Foundation milestone; they ship together as part of the v1.2 release per the project's release-bundling rule (no `v*` tag pushed for this phase alone).

**In scope:**
- Add `build.rollupOptions.output.manualChunks` to `vite.config.ts` splitting React runtime, Dexie+hooks, and other-vendors into 3 named chunks
- Install `react-window ^2` as a runtime dep
- Virtualize JobsManager's list rendering at `src/components/JobsManager.tsx:237` (`jobs.map(...)`) when `jobs.length > 100`
- Virtualize AssetLibrary's `paginatedAssets.map(...)` (currently at lines 848, 987, 1057) when the page size exceeds 50 items — pagination stays the primary UX, virtualization only kicks in for power users who bumped `assetLibraryItemsPerPage`
- Install `rollup-plugin-visualizer ^5` as a devDep with a separate `npm run analyze` script
- Add a build-time chunk-size assertion that fails `npm run build` if the main chunk exceeds 300 KB gzipped — wire after `vite build` in the build chain
- Manual UAT: load a 500-item Jobs test set, throttle CPU 4× in DevTools, scroll — confirm no dropped frames

**Out of scope:**
- Route lazy-loading (already done — LandingPage, FeaturesPage, etc. are separate chunks)
- Service worker caching changes (VitePWA plugin auto-precaches built chunks correctly; no tuning needed)
- Image optimization (no large images in app shell)
- Tree-shaking unused exports (handled by Vite/Rollup by default — no manual config needed)
- Automated Playwright/Lighthouse perf tests — manual UAT is sufficient for v1.1
- Server-side rendering or React Server Components — app is client-only
- WebAssembly bundling concerns (Tauri desktop wraps the web build; no separate WASM)
- NEW badge — invisible infrastructure improvement (per the user-facing-only badge rule)

</domain>

<decisions>
## Implementation Decisions

### Vendor Chunking
- **D-01:** Use `build.rollupOptions.output.manualChunks` in `vite.config.ts` to split into 3 named chunks: `react-vendor` (react, react-dom), `dexie-vendor` (dexie, dexie-react-hooks), and `vendor` (everything else from node_modules). The function-style manualChunks is clearer than object-style for conditional logic and easier to test.
- **D-02:** No granular per-library chunking (no separate chunks for react-router, @vitejs/plugin-react runtime, etc.) — 3 chunks is the sweet spot for caching vs HTTP request count.
- **D-03:** Don't touch the existing route-level code-splitting (LandingPage, FeaturesPage, DownloadPage, FAQPage are already separate dynamic-import chunks via React.lazy — DO NOT undo this).
- **D-04:** Target metric: **main app chunk < 300 KB gzipped**. Current pre-split state is ~190 KB gzipped; post-split should drop the main chunk meaningfully because Dexie alone is ~80 KB gzipped.

### Virtualization
- **D-05:** Library: `react-window ^2` (the v2 release supports React 18+, works with React 19). Pick over `@tanstack/react-virtual` for smaller bundle footprint (~5 KB vs ~10 KB gzipped). The list patterns here are simple flat scrolls — we don't need TanStack's tree/grid flexibility.
- **D-06:** JobsManager (`src/components/JobsManager.tsx:237`): virtualize the `jobs.map(...)` rendering when `jobs.length > 100`. Below 100, render the flat list as today. This keeps the small-list case identical (no observer overhead, no key churn) and only pays the virtualization cost when it earns its keep.
- **D-07:** AssetLibrary virtualization: **keep pagination as the primary UX**. The default `itemsPerPage` is 10, so most users never hit virtualization. Only virtualize the within-page list when `itemsPerPage > 50` — covers users who bumped it to "show 100" or "show all". Below 50/page, render normally. There are three `paginatedAssets.map(...)` call sites (lines 848, 987, 1057 — mobile vs desktop vs another variant) — all three must be virtualized when triggered.
- **D-08:** Item height: use `FixedSizeList` from react-window with conservatively measured row heights. If row heights are dynamic (tags, multi-line content), planner picks between `VariableSizeList` (per-item height function) or padding rows to a fixed `min-height`. Bias toward fixed heights for simpler code; only fall back to variable if Phase 11's UAT shows visual breakage.

### Build Gate
- **D-09:** Add a Node.js script `scripts/assert-bundle-size.mjs` that reads `dist/assets/index-*.js`, gzips it in-memory (`zlib.gzipSync`), and exits 1 if the size exceeds **300 KB (307,200 bytes)**. Append it to `scripts.build` AFTER `vite build`: `... && vite build && node scripts/assert-bundle-size.mjs`. The order is locked — assertion must run AFTER vite produces the dist artifacts.
- **D-10:** Install `rollup-plugin-visualizer` as a devDep. Add `scripts.analyze` to package.json: `vite build --mode analyze` (or equivalent). The visualizer is opt-in (`npm run analyze`), NOT in the regular build chain — no overhead on every Vercel deploy.
- **D-11:** Threshold is 300 KB gzipped (matches PERF-01 exactly). If a future phase needs to grow the bundle deliberately, bump this value in the assertion script with a code-review trail; do NOT silently raise it.

### Verification
- **D-12:** Bundle-size verification is automated via D-09's build gate — fails fast and visibly.
- **D-13:** Virtualization smoothness is verified manually for v1.1: load a 500-item Jobs fixture (planner generates a one-off seed script or uses Dexie inspector), open DevTools Performance tab, set CPU throttle to 4×, scroll the list, confirm no dropped frames (>16ms per frame) in the trace. Document the procedure in SUMMARY.md so future devs can re-run it. Automated perf testing (Playwright) is deferred to v2.

### Claude's Discretion
- Exact `FixedSizeList` row heights — planner measures from the live UI and picks the smallest value that doesn't clip content
- Whether to add an overscan count (react-window's `overscanCount` prop) — default of 1 is usually fine
- The exact name of the manualChunks function (`getManualChunk`, `chunkAllocator`, etc.) — planner picks
- Whether to use `react-window`'s `FixedSizeList` or `VariableSizeList` — see D-08
- Whether assert-bundle-size.mjs walks all `dist/assets/index-*.js` files or only the largest — planner picks; the largest-only is simpler and matches the PERF-01 wording ("main app chunk")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` (Phase 11 entry) — Goal, 4 success criteria, the dependency-on-nothing note
- `.planning/REQUIREMENTS.md` — PERF-01 (chunk-split + 300 KB gzipped), PERF-02 (virtualization + 4× CPU smoothness)
- `.planning/PROJECT.md` — v1.1 active requirement list

### Source files to modify
- `vite.config.ts` — add `build.rollupOptions.output.manualChunks` per D-01
- `src/components/JobsManager.tsx:237` — virtualize `jobs.map(...)` rendering per D-06
- `src/components/AssetLibrary.tsx:848`, `:987`, `:1057` — virtualize `paginatedAssets.map(...)` per D-07 (three call sites: mobile, desktop, and another variant)
- `package.json` — add `react-window` runtime dep, `rollup-plugin-visualizer` dev dep, `scripts.analyze` script, append bundle-size assertion to `scripts.build`
- `scripts/assert-bundle-size.mjs` — NEW file per D-09

### Build configuration
- `package.json` `scripts.build` (current): `node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build` — extend with `&& node scripts/assert-bundle-size.mjs` at the end
- `vitest.config.ts` — coverage scoping is locked to `src/utils/costCalc.ts` only (Phase 10); do NOT widen during this phase

### Pattern references
- `src/components/JobsManager.tsx` — current flat-list pattern, no pagination
- `src/components/AssetLibrary.tsx` — current `paginatedAssets` pattern + 10/page default

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Route-level code splitting already in place** — LandingPage, FeaturesPage, DownloadPage, FAQPage are separate chunks (proven by `dist/assets/LandingPage-*.js` etc. in last build). Don't undo this.
- **Pagination machinery exists in AssetLibrary** — `paginatedAssets`, `itemsPerPage` (from `userProfile.assetLibraryItemsPerPage ?? 10`), and `onItemsPerPageChange`. Plan 11 builds on top, doesn't replace.
- **Vite PWA plugin auto-precaches all built chunks** — no manual service-worker tuning needed when chunks split.

### Established patterns
- Vite uses `@vitejs/plugin-react` + `tailwindcss` + `VitePWA` (see `vite.config.ts`). manualChunks goes inside `build.rollupOptions.output`.
- Build chain is `lint-html → vitest+coverage → tsc → vite` (Phase 10 D-06). Bundle assertion appends AFTER `vite build` — does NOT replace the existing chain.
- React 19.2 is installed. react-window v2 is the compatible version.

### Integration points
- `JobsManager.tsx:237` — single seam for jobs list. Wrapping the map in a `FixedSizeList` (when >100) requires hoisting the item render JSX into a function that takes `{ index, style }` and applies `style` to the outer div.
- `AssetLibrary.tsx` has THREE map call sites at lines 848 / 987 / 1057. Verify these are mobile-card / desktop-table / something-else and apply virtualization to each separately — they're different DOM shapes and may need different row heights.
- `vite.config.ts` `manualChunks` is a single config object addition; no other file changes needed for chunk splitting itself.

</code_context>

<specifics>
## Specific Ideas

- The 300 KB gzipped threshold is a hard product gate (PERF-01). The build assertion script should print the actual measured size on success ("✓ main chunk: 187 KB gzipped (under 300 KB)") so devs see headroom shrink over time.
- The 100-item virtualization threshold for JobsManager and the 50-items-per-page threshold for AssetLibrary are different on purpose — Assets has pagination as its primary chunking strategy, Jobs doesn't.
- The 500-item test fixture for PERF-02 manual UAT should be ephemeral — a script in `scripts/` that seeds Dexie with 500 fake jobs, NOT a checked-in test seed. The phase summary should document how to run it AND how to clean it up.

</specifics>

<deferred>
## Deferred Ideas

- **Playwright / Lighthouse automated perf tests** — manual UAT is sufficient for v1.1 per D-13; automated perf testing belongs in v2 alongside E2E (TEST-F1).
- **Per-library granular chunking** — 3-chunk strategy (D-01) is the chosen middle ground; per-library could be revisited if main chunk grows past 250 KB gzipped in a future phase.
- **Service worker chunking strategy tuning** — VitePWA defaults are fine for now; if cache busting becomes a problem after a release, tune in a separate phase.
- **Tree-shaking audit / unused export removal** — out of scope; Vite/Rollup default behavior is sufficient.
- **Image lazy-loading / Next-gen formats (AVIF, WebP)** — no large images in the app shell; would be a separate "asset optimization" phase if it ever matters.
- **Replacing pagination with infinite scroll in AssetLibrary** — explicitly rejected per D-07; pagination is the primary UX, virtualization is a power-user-only assist.

</deferred>

---

*Phase: 11-performance-optimization*
*Context gathered: 2026-05-20*
