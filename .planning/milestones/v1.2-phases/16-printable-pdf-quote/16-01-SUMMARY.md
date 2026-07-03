---
phase: 16-printable-pdf-quote
plan: "01"
subsystem: pdf-infrastructure
tags: [dependencies, ci-gates, fonts, test-scaffolds, tauri-plugins]
dependency_graph:
  requires: []
  provides:
    - jspdf@4.2.1 + jspdf-autotable@5.0.8 installed as production deps
    - "@tauri-apps/plugin-dialog@2.7.1 + plugin-fs@2.5.1 installed and wired"
    - subset-font@2.5.0 installed as devDep
    - scripts/assert-no-static-jspdf.mjs CI gate (PDF-03)
    - scripts/assert-no-pdf-preload.mjs CI gate (PDF-04)
    - scripts/subset-noto-sans.mjs font subsetting script
    - scripts/fonts/ source TTF files (committed for reproducibility)
    - src/pdf/notoSansBase64.ts (136 KB raw, ~70-80 KB gz)
    - src/pdf/generateQuotePdf.test.ts Wave 0 scaffold
    - src/utils/format.test.ts Wave 0 scaffold
    - src/utils/taxResolution.test.ts extended with taxLabelFor todos
    - src/components/CostCalculator.test.tsx Wave 0 scaffold
  affects:
    - package.json build script (two new gates wired)
    - vitest.config.ts (extended include to .test.tsx)
    - 16-VALIDATION.md (nyquist_compliant + wave_0_complete set to true)
tech_stack:
  added:
    - jspdf@4.2.1 (production dep — PDF generation)
    - jspdf-autotable@5.0.8 (production dep — table rendering)
    - "@tauri-apps/plugin-dialog@2.7.1 (production dep — native save dialog)"
    - "@tauri-apps/plugin-fs@2.5.1 (production dep — binary file write)"
    - subset-font@2.5.0 (devDep — one-time build-time font subsetting)
  patterns:
    - CI gate scripts using Node built-ins only, exit-code + console.error convention
    - subset-font CJS API: subsetFont(buffer, charString, { targetFormat: 'truetype' })
    - Raw base64 font strings (no data URI prefix) for jsPDF addFileToVFS
    - Wave 0 test scaffold pattern: it.todo() for future assertions, real passing scaffold test
key_files:
  created:
    - scripts/assert-no-static-jspdf.mjs
    - scripts/assert-no-pdf-preload.mjs
    - scripts/subset-noto-sans.mjs
    - scripts/fonts/NotoSans-Regular.ttf
    - scripts/fonts/NotoSans-Bold.ttf
    - src/pdf/notoSansBase64.ts
    - src/pdf/generateQuotePdf.test.ts
    - src/utils/format.test.ts
    - src/components/CostCalculator.test.tsx
  modified:
    - package.json (deps added + build script updated)
    - package-lock.json
    - src-tauri/Cargo.toml (plugin crates added)
    - src-tauri/Cargo.lock
    - src-tauri/src/main.rs (plugin registrations added)
    - src-tauri/capabilities/default.json (permissions added)
    - src/utils/taxResolution.test.ts (taxLabelFor describe block appended)
    - vitest.config.ts (include extended to .test.tsx)
    - .planning/phases/16-printable-pdf-quote/16-VALIDATION.md (flags flipped)
decisions:
  - "jsPDF 4.2.1 + jspdf-autotable 5.0.8 — not 2.x/3.x as CONTEXT.md assumed; RESEARCH.md already corrected this"
  - "Noto Sans TTF downloaded from Google Fonts static CDN and committed in scripts/fonts/ for reproducibility; download URLs recorded in script comments"
  - "subset-font uses CJS require() API (not ESM default export) — createRequire() bridging used in the ESM script"
  - "src/pdf/ directory excluded from assert-no-static-jspdf scan — it is the one allowed static jspdf consumer"
  - "vitest.config.ts include extended to .test.tsx so CostCalculator.test.tsx is picked up"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-23"
  tasks_completed: 4
  files_created: 9
  files_modified: 9
  commits: 4
---

# Phase 16 Plan 01: Wave 0 Dependencies, CI Gates, Fonts, and Test Scaffolds Summary

**One-liner:** jspdf/autotable/Tauri plugin deps installed + two CI gates wired + Noto Sans Latin+Euro subsetted (136 KB) + 4 Wave 0 test scaffolds with 27 it.todo() placeholders.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Install runtime deps + Tauri plugin | e840139 | package.json deps, Cargo.toml, main.rs, capabilities/default.json |
| 2 | CI gate scripts + build chain | 38f1ca6 | assert-no-static-jspdf.mjs, assert-no-pdf-preload.mjs, build script |
| 3 | Font subset script + notoSansBase64.ts | 8d9ee03 | scripts/subset-noto-sans.mjs, src/pdf/notoSansBase64.ts (136 KB) |
| 4 | Wave 0 test scaffolds | 8dd97a7 | 4 test files, vitest.config.ts .tsx fix, VALIDATION.md flags |

## Dependencies Installed

### Production (`dependencies`)
| Package | Version | Purpose |
|---------|---------|---------|
| jspdf | ^4.2.1 | PDF document creation (lazy-loaded chunk) |
| jspdf-autotable | ^5.0.8 | Table rendering in PDF (named function API in v5) |
| @tauri-apps/plugin-dialog | ^2.7.1 | Native save-file dialog for Tauri desktop |
| @tauri-apps/plugin-fs | ^2.5.1 | Binary file write for Tauri desktop |

### Dev (`devDependencies`)
| Package | Version | Purpose |
|---------|---------|---------|
| subset-font | ^2.5.0 | One-time build-time font subsetting (HarfBuzz WASM) |

## CI Gate Scripts

### `scripts/assert-no-static-jspdf.mjs` (PDF-03)
- Scans `src/**/*.{ts,tsx}` for static `from 'jspdf'` / `from 'jspdf-autotable'` imports
- **Excludes `src/pdf/` from scanning** — it is the one allowed static consumer
- Exits 0 today (no jspdf imports yet); will continue to exit 0 after plan 03 ships `src/pdf/generateQuotePdf.ts`
- Runs BEFORE vitest in build chain (cheapest check first)

### `scripts/assert-no-pdf-preload.mjs` (PDF-04)
- Reads `dist/index.html` post-build; exits 1 if any `modulepreload` link references the pdf chunk
- Currently exits 1 with "dist/index.html not found" (correct — no build has run yet)
- Will exit 0 after plan 04 ships `build.modulePreload: false` in vite.config.ts

### Build script order (after this plan)
```
lint-no-raw-html → assert-no-static-jspdf → vitest --coverage → tsc -b → vite build → assert-bundle-size → assert-no-pdf-preload
```

## Tauri Plugin Wiring

| Layer | Change |
|-------|--------|
| Cargo.toml | `tauri-plugin-dialog = "2"` + `tauri-plugin-fs = "2"` |
| main.rs | `.plugin(tauri_plugin_dialog::init())` + `.plugin(tauri_plugin_fs::init())` |
| capabilities/default.json | `dialog:allow-save`, `fs:allow-write-file`, `{ "identifier": "fs:scope", "allow": [{ "path": "$DOWNLOAD/*" }] }` |

## Font Subset

| Property | Value |
|----------|-------|
| Source | NotoSans-Regular.ttf + Bold.ttf from Google Fonts static CDN |
| Character set | Basic Latin (U+0020–U+007E) + Latin-1 Supplement (U+00A0–U+00FF) + Latin Extended-A (U+0100–U+017F) + Latin Extended-B (U+0180–U+024F) + **U+20AC Euro sign** (explicitly included) |
| Regular subset | 52,084 bytes raw → 69,448 chars base64 |
| Bold subset | 52,248 bytes raw → 69,664 chars base64 |
| notoSansBase64.ts total | 136 KB raw (well within 100–250 KB acceptance range) |
| jsPDF consumption | Raw base64 string (no data URI prefix) — `addFileToVFS()` expected format |
| Idempotency | Verified: running twice produces byte-identical output |

## Wave 0 Test Scaffolds

| File | it.todo count | Real passing tests | Status |
|------|--------------|-------------------|--------|
| src/pdf/generateQuotePdf.test.ts | 6 | 1 (fixture scaffold) | vitest green |
| src/utils/format.test.ts | 9 | 0 | vitest green (skipped) |
| src/utils/taxResolution.test.ts | 10 (appended) | 20 (existing unchanged) | vitest green |
| src/components/CostCalculator.test.tsx | 2 | 0 | vitest green (skipped) |

**Total:** 27 `it.todo()` placeholders across 4 files. All 4 files compile under `tsc -b`. `vitest run` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended vitest.config.ts to include .test.tsx**

- **Found during:** Task 4
- **Issue:** `vitest.config.ts` include pattern was `src/**/*.test.ts` only. `src/components/CostCalculator.test.tsx` (a `.tsx` file) was not picked up by vitest — `vitest run CostCalculator.test.tsx` exited 1 with "No test files found"
- **Fix:** Extended include to `['src/**/*.test.ts', 'src/**/*.test.tsx']`
- **Files modified:** vitest.config.ts
- **Commit:** 8dd97a7

**2. [Rule 3 - Blocking] subset-font is CJS module — createRequire() bridge needed**

- **Found during:** Task 3
- **Issue:** `subset-font` uses `module.exports` (CJS) not ESM named export. Importing it in an ESM `.mjs` script as `import subsetFont from 'subset-font'` fails because the package doesn't have an `"exports"` field pointing to an ESM entry.
- **Fix:** Used `createRequire(import.meta.url)` to bridge CJS from the ESM script (`const require = createRequire(import.meta.url); const subsetFont = require('subset-font');`)
- **Files modified:** scripts/subset-noto-sans.mjs
- **Commit:** 8d9ee03

**3. [Justified deviation] Google Fonts TTF URL required Google Fonts CSS API lookup**

- **Found during:** Task 3
- **Issue:** The PATTERNS.md/RESEARCH.md instructions to "fetch Noto Sans TTF from Google Fonts" didn't give an exact URL. The Google Fonts CDN uses content-addressed URLs. Direct URL guessing returned HTML (redirect).
- **Fix:** Used `curl` to fetch Google Fonts CSS2 API with `User-Agent: Mozilla/4.0` (legacy agent returns TTF format rather than WOFF2). Extracted the exact TTF URLs from the CSS. Both TTF files committed to `scripts/fonts/` for reproducibility.
- **Impact:** None — output is byte-identical Noto Sans TTF files, committed alongside the script.

## Known Stubs

None — this plan creates infrastructure (deps, scripts, fonts, test scaffolds). No user-facing features or data stubs.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond what was planned and reviewed in the threat model.

## Self-Check

- [x] `scripts/assert-no-static-jspdf.mjs` exists and exits 0: VERIFIED
- [x] `scripts/assert-no-pdf-preload.mjs` exists and exits 1 with "not found": VERIFIED
- [x] `scripts/subset-noto-sans.mjs` exists: VERIFIED
- [x] `src/pdf/notoSansBase64.ts` exists with both exports: VERIFIED
- [x] `src/pdf/generateQuotePdf.test.ts` exists with 6 todos: VERIFIED
- [x] `src/utils/format.test.ts` exists with 9 todos: VERIFIED
- [x] `src/utils/taxResolution.test.ts` appended with 10 todos: VERIFIED
- [x] `src/components/CostCalculator.test.tsx` exists with 2 todos: VERIFIED
- [x] `vitest run` exits 0 (27 todos, 31 passing): VERIFIED
- [x] `tsc -b` exits 0: VERIFIED
- [x] All 4 task commits exist: e840139, 38f1ca6, 8d9ee03, 8dd97a7: VERIFIED
- [x] 16-VALIDATION.md: nyquist_compliant: true, wave_0_complete: true: VERIFIED

## Self-Check: PASSED
