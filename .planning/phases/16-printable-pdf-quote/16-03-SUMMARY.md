---
phase: 16-printable-pdf-quote
plan: "03"
subsystem: pdf-generator
tags: [pdf, jspdf, autotable, fonts, integration-tests, cid-encoding]
dependency_graph:
  requires:
    - 16-01 (notoSansBase64.ts, assert-no-static-jspdf.mjs with src/pdf/ exclusion)
    - 16-02 (formatQuoteNumber, customerNameSlug, taxLabelFor)
  provides:
    - src/pdf/generateQuotePdf.ts — main PDF generator (dynamic-import target)
    - src/pdf/generateQuotePdf.test.ts — 21 real integration tests (0 todos)
  affects:
    - scripts/assert-no-static-jspdf.mjs (path guard fixed for relative paths)
tech_stack:
  added: []
  patterns:
    - jsPDF 4.x per-instance VFS registration (addFileToVFS + addFont per new jsPDF())
    - ToUnicode CMap parsing for CID-encoded text extraction in tests
    - Tauri save-path via dynamic import('@tauri-apps/plugin-dialog') + plugin-fs
    - autoTable(doc, options) named-function form (v5 pattern, NOT doc.autoTable())
    - D-04 collapsed single-row line items (no cost breakdown exposed)
    - D-07 tax row hidden at 0% with region-aware label inline
    - D-08 layered Notes/Terms independently omitted when empty/whitespace-only
key_files:
  created:
    - src/pdf/generateQuotePdf.ts
  modified:
    - src/pdf/generateQuotePdf.test.ts
    - scripts/assert-no-static-jspdf.mjs
decisions:
  - "jsPDF 4.x VFS is per-instance (not shared between jsPDF() instances) — RESEARCH.md Pattern 3 fontsLoaded guard does NOT apply; addFileToVFS + addFont must be called on every new doc"
  - "pdfExtractText() uses ToUnicode CMap parsing to decode CID-encoded text — raw byte search fails for custom font text in jsPDF 4.x"
  - "assert-no-static-jspdf.mjs path guard extended with startsWith('src/pdf/') to handle relative paths from scanDir('src') — fixes Rule 3 blocker"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-23"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
---

# Phase 16 Plan 03: PDF Generator Module and Integration Tests Summary

**One-liner:** Full A4 PDF generator with NotoSans fonts, jsPDF 4.x per-instance VFS, web+Tauri save paths, 21 integration tests using ToUnicode CMap text extraction.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Author src/pdf/generateQuotePdf.ts | 2b329af | 338-LOC generator module, web+Tauri branches, all section renderers |
| 2 | Flip Wave 0 test todos to real tests | 21da80b | 370-LOC test file, 21 passing tests, pdfExtractText() CMap helper |

## Exported Interface

### `QuotePdfParams`
```typescript
interface QuotePdfParams {
  job: PrintJob;        // job.quoteNumber MUST be assigned — throws if undefined
  userProfile: UserProfile;
  sale?: Sale;          // optional; absent = no customer block in PDF
}
```

### `generateQuotePdf(params): Promise<void>`
Full flow: builds PDF doc, saves to disk (browser download dialog on web; native file dialog on Tauri via dynamic plugin imports).

### `generateQuotePdfBytes(params): Promise<Uint8Array>`
Builds PDF, returns bytes. Used by tests and as an intermediate in the Tauri save path.

## jsPDF/autotable API Notes (Actual vs RESEARCH.md)

| Topic | RESEARCH.md | Actual (jsPDF 4.2.1) |
|-------|-------------|----------------------|
| VFS sharing | Implied global ("once per session") | Per-instance: `this.internal.vFS = {}` per new `jsPDF()`. Must call `addFileToVFS` + `addFont` on every instance. |
| Text encoding | "strings appear searchable in raw byte stream" | CID-encoded with custom fonts — raw bytes do NOT contain ASCII text. Must parse ToUnicode CMap. |
| autotable call | `autoTable(doc, options)` — correct | Named function from `'jspdf-autotable'` — confirmed working |
| lastAutoTable | `(doc as any).lastAutoTable.finalY` | Confirmed: returns Y position after table render |
| output('arraybuffer') | Returns ArrayBuffer | Confirmed — `new Uint8Array(doc.output('arraybuffer'))` works |

## PDF Layout (A4 Portrait, pt units)

```
y=40-65  Header: wordmark (bold 18pt left) + QUOTE / Q-NNNN (right)
y=65     Horizontal rule (0.5pt)
y=85+    Meta LEFT (Quote#, Issue date, Valid until) + Customer RIGHT (Bill To: block)
y=?+     Line items table (autoTable, plain theme)
y=?+     Totals (right-aligned: Subtotal, [Tax (N%):], Total)
y=?+     Notes / Terms (independently omitted if empty)
y=ph-30  Footer: "Made with 3DCoster — 3dcoster.vercel.app" (gray 9pt)
```

## Test Coverage (21 tests, 648ms)

| Category | Count |
|----------|-------|
| Magic bytes (%PDF-) | 1 |
| Throws on missing quoteNumber | 1 |
| Quote number format | 1 |
| Customer block presence/absence | 3 |
| Tax row show/hide (VAT/GST/Tax/none) | 5 |
| Notes/Terms layered model | 5 |
| Footer (3DCoster + URL) | 2 |
| Line item job name | 1 |
| Whitespace-only empty treatment | 2 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] assert-no-static-jspdf.mjs path exclusion guard was relative-path blind**

- **Found during:** Task 1 — after creating `src/pdf/generateQuotePdf.ts`, CI gate exited 1
- **Issue:** The script uses `scanDir('src')` which builds relative paths like `src/pdf/generateQuotePdf.ts`. The exclusion check `fullPath.includes('/src/pdf/')` requires a leading slash, which is absent in relative paths. The guard silently failed to exclude the allowed directory.
- **Fix:** Extended guard with `fullPath.startsWith('src/pdf/')` and `fullPath.startsWith('src\\pdf\\')` to handle both relative and absolute path forms
- **Files modified:** scripts/assert-no-static-jspdf.mjs
- **Commit:** 2b329af

**2. [Rule 1 - Bug] jsPDF 4.x VFS is per-instance — RESEARCH.md Pattern 3 `fontsLoaded` guard does not apply**

- **Found during:** Task 2 — tests 4+ produced "Unable to look up font label for font 'NotoSans'" and empty text extraction
- **Issue:** jsPDF 4.2.1 stores VFS in `this.internal.vFS = {}` (per-instance). The `fontsLoaded` module-level guard (RESEARCH.md Pattern 3) assumed VFS is global/shared — it is not. The second `new jsPDF()` call got an empty VFS because `addFileToVFS` was gated behind `fontsLoaded = true` from the first call.
- **Fix:** Removed the `fontsLoaded` guard entirely. Each `new jsPDF()` calls `ensureFontsLoaded(doc)` which runs `addFileToVFS` + `addFont` unconditionally. The base64 strings are module-level constants (already in memory), so the per-instance VFS registration is fast — it just copies the string reference.
- **Files modified:** src/pdf/generateQuotePdf.ts
- **Commit:** 21da80b

**3. [Rule 1 - Bug] jsPDF 4.x with custom CID fonts encodes text as glyph index sequences**

- **Found during:** Task 2 — most tests failed because `pdfText(bytes)` (raw byte string) did not contain ASCII text
- **Issue:** When NotoSans (a custom CID font) is registered and used, jsPDF encodes all text as 2-byte glyph index sequences (`<glyphId_hex> Tj`) instead of plain ASCII. Raw byte matching for strings like `'Q-0042'` or `'VAT (19%)'` fails.
- **Fix:** Added `pdfExtractText(bytes)` helper that (1) parses all `beginbfchar` / `endbfchar` ToUnicode CMap sections embedded in the PDF to build a glyph→char map, then (2) finds all `<hexstring> Tj` operators and decodes them using the map. This correctly recovers all user-visible text regardless of font encoding.
- **Files modified:** src/pdf/generateQuotePdf.test.ts
- **Commit:** 21da80b

## Known Stubs

None. The generator is fully implemented. All section renderers produce real output. The Tauri save branch uses real dynamic imports. Tests use real PDF byte output.

## Threat Flags

No new unplanned threat surface. All planned mitigations verified:

| Threat | Status |
|--------|--------|
| T-16-07: HTML injection | MITIGATED — `grep -c "doc.html" generateQuotePdf.ts` = 0 |
| T-16-08: Static jspdf outside src/pdf/ | MITIGATED — gate exits 0 |
| T-16-09: Tauri path safety | MITIGATED — save() dialog is user-controlled |
| T-16-10: Cost breakdown leakage | MITIGATED — single-row table, no filament/labor rows |
| T-16-11: Repudiation | ACCEPTED — Issue date + Q-NNNN in PDF is sufficient |

## Self-Check

- [x] `src/pdf/generateQuotePdf.ts` exists with 3 named exports (generateQuotePdf, generateQuotePdfBytes, QuotePdfParams): VERIFIED
- [x] `src/pdf/generateQuotePdf.test.ts` exists with 21 real tests, 0 it.todo: VERIFIED
- [x] `16-03-SUMMARY.md` exists: VERIFIED
- [x] Task 1 commit 2b329af exists: VERIFIED
- [x] Task 2 commit 21da80b exists: VERIFIED
- [x] No unintended file deletions: VERIFIED
- [x] `vitest run` exits 0 (177 passing, 0 failures): VERIFIED
- [x] `tsc -b` exits 0: VERIFIED
- [x] `assert-no-static-jspdf.mjs` exits 0: VERIFIED
- [x] `grep -c "doc.html"` = 0: VERIFIED
- [x] `grep -c "doc.autoTable"` = 0: VERIFIED

## Self-Check: PASSED
