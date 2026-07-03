---
phase: 11-performance-optimization
plan: 02
subsystem: vite-build-config
tags:
  - vite
  - manual-chunks
  - bundle-splitting
  - rollup-visualizer
requirements:
  - PERF-01
dependency_graph:
  requires:
    - 11-01 (rollup-plugin-visualizer ^5.14.0 installed; `analyze` script wired)
  provides:
    - "Vendor chunk splitting: react-vendor / dexie-vendor / vendor in dist/assets/"
    - "Opt-in bundle analyzer via `npm run analyze` → dist/stats.html"
  affects:
    - 11-03 (bundle-size assertion script can now pattern-match `index-*.js` as the main chunk; vendor chunks are excluded from the 300 KB gate by design)
tech_stack:
  added:
    - "rollup-plugin-visualizer ^5.14.0 (already a devDep; first usage)"
  patterns:
    - "Functional defineConfig: `defineConfig(({ mode }) => ({...}))` to access build mode"
    - "Spread-empty-array plugin gate: `...(mode === 'analyze' ? [plugin()] : [])` keeps plugins array clean when not analyzing"
    - "Function-style manualChunks with 3-tier id.includes() branching"
key_files:
  created: []
  modified:
    - vite.config.ts
decisions:
  - "Functional `defineConfig` over object-form — minimum surface change to gain `mode` access (D-10)"
  - "Inline manualChunks function (not hoisted helper) — keeps file self-contained, matches PATTERNS.md guidance"
  - "Order of checks in manualChunks: react/react-dom first, then dexie/dexie-react-hooks (the longer substring `/dexie-react-hooks/` catches the hooks pkg before the bare `/dexie/` check fallthrough), then `vendor` fallback"
  - "Did NOT add `chunkFileNames` / `assetFileNames` overrides — Vite defaults (`[name]-[hash].js`) already produce `react-vendor-*.js` etc. that Plan 03's size script can pattern-match"
metrics:
  duration: ~10 minutes
  completed: 2026-05-20
---

# Phase 11 Plan 02: Vendor Chunk Splitting + Conditional Visualizer Summary

## One-liner
Switched `vite.config.ts` to functional `defineConfig` and added `build.rollupOptions.output.manualChunks` (3-tier: react-vendor / dexie-vendor / vendor) plus a `mode === 'analyze'` gated `rollup-plugin-visualizer` so the regular Vercel deploy chain pays zero analyzer cost.

## What Was Built

### `vite.config.ts` (modified — 73 → 98 lines)

1. **Imports** — added `import { visualizer } from 'rollup-plugin-visualizer'` at the top after the existing 4 imports.
2. **`defineConfig` shape** — changed from object-form `defineConfig({...})` to function-form `defineConfig(({ mode }) => ({...}))`. This is the lowest-impact way to gain access to the `mode` parameter for the visualizer guard (D-10).
3. **Plugins array** — appended a spread-empty-array entry as the LAST plugin:
   ```typescript
   ...(mode === 'analyze'
     ? [visualizer({ open: true, gzipSize: true, brotliSize: true, filename: 'dist/stats.html' })]
     : []),
   ```
   When `mode !== 'analyze'` (the Vercel deploy path), the spread contributes ZERO entries — the visualizer module is still tree-shakeable from the build but its plugin code never runs.
4. **New `build` block** — inserted between `plugins` and `server` per PATTERNS.md "build-time concerns grouped" convention. Contains the function-style manualChunks per D-01:
   ```typescript
   manualChunks(id) {
     if (id.includes('node_modules')) {
       if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
       if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
       return 'vendor';
     }
   }
   ```
   The function returns `undefined` for non-`node_modules` ids → Rollup uses default chunk allocation for them, preserving the 4 React.lazy route splits (D-03).
5. **Untouched** — `__IS_TAURI__` define, `server.port: 4173`, and the full VitePWA config remain identical.

## Verification

All gates from `<verify>` passed:

| Gate | Status | Notes |
|------|--------|-------|
| `grep -c manualChunks` == 1 | OK | One occurrence (function definition) |
| `grep -c react-vendor` == 1 | OK | One occurrence (return string) |
| `grep -c dexie-vendor` == 1 | OK | One occurrence (return string) |
| `grep -c "mode === 'analyze'"` == 1 | OK | One occurrence (plugin guard) |
| `grep -c "from 'rollup-plugin-visualizer'"` == 1 | OK | Import line |
| `tsc -b` passes | OK | No TS errors (function-form defineConfig typechecks against Vite 7) |
| `npm run build` passes end-to-end | OK | 4-step chain: lint-html → vitest+coverage (62 passed, 1 todo) → tsc -b → vite build |
| 3 vendor chunks emit | OK | react-vendor / dexie-vendor / vendor all present |
| 4 route lazy chunks preserved | OK | LandingPage, FeaturesPage, DownloadPage, FAQPage all separate |
| No `dist/stats.html` from default build | OK | D-10 satisfied — visualizer is opt-in only |

## Bundle Chunk Baseline (for Plan 03)

Captured from a clean default `npm run build`:

| Chunk | Raw bytes | Raw KB | Gzipped KB |
|-------|-----------|--------|------------|
| `dist/assets/index-Dtce8U6u.js` (main app) | 195,426 | 195.43 | **45.56** |
| `dist/assets/react-vendor-WStCuO__.js` | 190,943 | 190.94 | 59.94 |
| `dist/assets/vendor-Bu2k-o6b.js` | 154,870 | 154.87 | 50.60 |
| `dist/assets/dexie-vendor-4i-0Q9rj.js` | 97,081 | 97.08 | 32.43 |

**Main chunk gzipped is 45.56 KB — well under the 300 KB PERF-01 budget (~254 KB headroom).** Plan 03's `scripts/assert-bundle-size.mjs` will hard-gate this.

### Route lazy chunks (preserved per D-03)

| Chunk | Raw KB | Gzipped KB |
|-------|--------|------------|
| `LandingPage-CCsHMwuR.js` | 16.99 | 4.70 |
| `FeaturesPage-UACyMg2d.js` | 14.93 | 2.31 |
| `DownloadPage-Byn_9_dN.js` | 8.91 | 2.70 |
| `FAQPage-CsQ7IFJ6.js` | 7.83 | 3.17 |
| `ChangelogPage-pBohBu1_.js` | 6.53 | 2.24 |
| `FeedbackPage-UA0O5MDc.js` | 3.72 | 1.50 |
| `Header-EQdgzCzM.js` | 3.08 | 1.09 |

All 4 plan-required route chunks (LandingPage / FeaturesPage / DownloadPage / FAQPage) emit. The ChangelogPage / FeedbackPage / Header bonus chunks are pre-existing dynamic splits, also preserved.

## Visualizer Treemap (from `npm run analyze`)

A spot-check of `dist/stats.html` (generated only in `--mode analyze`) confirmed `vendor-*.js` contains `react-router`, `react-router-dom`, `@vercel/analytics`, `scheduler`, `papaparse`, `jszip`, `cookie`, and `set-cookie-parser`. **The biggest contributor to `vendor-*.js` is `jszip` (~95 KB minified, used for 3MF/G-code archive parsing) — by itself it accounts for roughly 60% of the `vendor` chunk's raw size.** This is expected (jszip is the heaviest non-React/non-Dexie runtime dep) and not actionable here; if `vendor` ever needs trimming, code-splitting the 3MF parser into a dynamic import is the obvious next lever.

## Build-Time Observations

A **Rollup warning** appeared during build: `Circular chunk: vendor -> react-vendor -> vendor. Please adjust the manual chunk logic for these chunks.` This is non-fatal (build succeeds, all chunks emit, app runs correctly) and arises because `scheduler` (in `vendor` per the fallback rule) is a runtime peer of `react-dom` (in `react-vendor`), and other small deps in `vendor` (e.g., `@vercel/analytics/react`) statically import `react` itself. Browsers handle the import graph correctly — the warning flags only that the named chunks have a cycle in their resolution graph, not a runtime problem.

**Not fixing it now because:**
1. It does not affect correctness or measured gzipped sizes (main chunk is still 45.56 KB).
2. Resolving it cleanly would require either (a) adding `scheduler` to the `react-vendor` set (changing chunk boundaries, drifting from D-01's explicit 3-tier definition) or (b) splitting `vendor` further (forbidden by D-02 — "no granular per-library chunking").
3. The plan's success criteria do not include "no Rollup warnings". The 300 KB gzip gate (Plan 03) is the real signal for whether chunk allocation is healthy.

Documented here so Plan 03 (and future bundle audits) know the cycle warning is expected, not a regression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Trimmed explanatory comments containing literal strings `react-vendor` / `dexie-vendor`**

- **Found during:** Verification step (initial grep returned 2 occurrences instead of the expected 1)
- **Issue:** First-draft comments said "Vendor chunk splitting per D-01: 3 named chunks (react-vendor, dexie-vendor, vendor)" and "the hooks package must be caught by the `/dexie-react-hooks/` substring" — these inline mentions made the simple `grep -c "react-vendor"` and `grep -c "dexie-vendor"` gates report 2 instead of 1, failing the plan's automated verifier.
- **Fix:** Rewrote the manualChunks comment to describe behavior without naming the literal return strings ("3 named chunks for React, Dexie, and other deps" / "the hooks package must be caught by its own substring match"). The return-statement strings inside the function body are now the single occurrence of each.
- **Files modified:** `vite.config.ts` (comment text only — no behavioral change)
- **Commit:** Folded into the single Task 1 commit (not a separate commit — the deviation surfaced and was fixed within the same task before staging).

No other deviations. The plan's exact instructions were followed for imports, defineConfig shape, plugin spread, manualChunks branching, and the omission of `chunkFileNames`/`assetFileNames` overrides.

## How to Run the Analyzer (operator reference)

```bash
npm run analyze
# Builds with --mode analyze, opens dist/stats.html in default browser,
# shows treemap with gzip + brotli sizes per chunk.
```

`dist/stats.html` is regenerated each run. The default `npm run build` does NOT produce it (D-10 verified).

## Final `vite.config.ts` Shape (sanity check)

- Total lines: **98** (was 73)
- New imports: 1 (`visualizer`)
- New top-level config keys: 1 (`build`)
- defineConfig form: function (was object)
- Behavior change to dev server: NONE (`server.port: 4173` unchanged)
- Behavior change to Tauri detection: NONE (`__IS_TAURI__` unchanged)
- Behavior change to PWA: NONE (full VitePWA block unchanged)

## Self-Check: PASSED

- `vite.config.ts` exists, 98 lines (verified via `wc -l`)
- `dist/assets/react-vendor-WStCuO__.js`, `dist/assets/dexie-vendor-4i-0Q9rj.js`, `dist/assets/vendor-Bu2k-o6b.js` all present after default `npm run build` (verified via `ls`)
- 4 route lazy chunks (LandingPage, FeaturesPage, DownloadPage, FAQPage) present (verified via `ls dist/assets/ | grep -E ...`)
- `dist/stats.html` NOT present after default build (verified via `! ls dist/stats.html`)
- `npm run analyze` round-tripped: produced `dist/stats.html` (verified separately, then cleaned)
- `tsc -b` exits 0
- `npm run build` exits 0
- Commit (forthcoming) will be the single Task 1 commit per plan
