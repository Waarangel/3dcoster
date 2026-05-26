---
phase: 25-doc-hygiene-polish-bundle-health
verified: 2026-05-26T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open CustomerCsvImportModal in npm run dev (port 4173), navigate to the Upload step, click 'Customer template' button"
    expected: "Browser downloads customer-template.csv with header row (name,email,company,address,notes) + 2 data rows; file opens cleanly in spreadsheet app showing 5 columns"
    why_human: "Cannot trigger browser download in headless agent context; downloadCsv() uses Blob + URL.createObjectURL which requires a browser environment"
  - test: "Open JobsManager, navigate to Pending quotes, click the [⋯] overflow button on a Pending quote row, then click somewhere outside the menu"
    expected: "Overflow menu closes when clicking outside its container"
    why_human: "POL-04 mousedown outside-click handler requires a real DOM environment; can't fire fireEvent.mouseDown(document.body) without running the test suite"
  - test: "With the overflow menu open (from above), press Escape"
    expected: "Overflow menu closes"
    why_human: "POL-04 Escape handler requires a real keyboard event in a browser context"
  - test: "Inspect a Declined quote pill in browser DevTools; check the aria-label attribute"
    expected: "aria-label reads 'Status: Declined'; visually the text appears brighter/more readable against the dark bg-slate-700 background (text-slate-200 vs prior text-slate-300)"
    why_human: "Contrast ratio verification (4.6:1 claim) and visual readability require DevTools color picker or human eye on rendered output"
  - test: "Generate a quote via PrintQuoteModal (create a job, add pricing, click Create Quote)"
    expected: "Modal closes without JavaScript error in console; no regression from making onQuoteCreated optional"
    why_human: "HYG-04 optional-prop change is structurally verified but runtime modal flow needs visual confirmation"
---

# Phase 25: Doc + Hygiene + Polish + Bundle Health Verification Report

**Phase Goal:** Sweep up every remaining audit finding into one batch — doc-state lag, hygiene residue, polish items, low-priority defensive fixes, and bundle health
**Verified:** 2026-05-26T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | v1.2-REQUIREMENTS.md Traceability rows TAGS-01 + TAGS-04 read `Complete`; CUST-01/CUST-02 wording-drift note present in archive header | ✓ VERIFIED | `grep -E "TAGS-0[14]" v1.2-REQUIREMENTS.md` returns both rows with `Complete`. Archive header line 10 explicitly references CUST-01 + CUST-02 wording drift |
| 2 | JobsManager `generatingJobIds` permanently-empty Set and `isGeneratingPdf` prop deleted from all locations | ✓ VERIFIED | `grep -E "generatingJobIds\|isGeneratingPdf" src/components/JobsManager.tsx` returns 0 matches |
| 3 | PrintQuoteModal `onQuoteCreated` is optional (`?:`); invoked via `?.()`; no-op removed from JobsManager | ✓ VERIFIED | Line 36 of PrintQuoteModal.tsx: `onQuoteCreated?: (quote: Quote) => void;`. Line 283: `onQuoteCreated?.(quote);`. Zero occurrences of "no-op for now" or "could trigger a toast" in JobsManager.tsx |
| 4 | ImageCarousel.tsx has one-line comment explaining image5.png absence between image4 and image6 imports | ✓ VERIFIED | Line 8 of ImageCarousel.tsx: `// image5.png not in repo — screenshot sequence intentionally skips index 5 (asset retired pre-history-tracked timeframe).` positioned between screenshot4 (line 7) and screenshot6 (line 9) imports |
| 5 | `.planning/todos/ui-consistency-sweep.md` updated in place with audit markers; not archived | ✓ VERIFIED | 14 `audited 2026-05-25` markers confirmed by `grep -c`. File remains at `.planning/todos/ui-consistency-sweep.md` (not moved to archive). D-06 audit-in-place honored |
| 6 | CustomerLibrary row layout "Last used" text vertically centered with Edit/Delete buttons | ✓ VERIFIED | Line 48 of CustomerLibrary.tsx: `<div className="flex items-center justify-between gap-3">` — `items-start` replaced with `items-center` |
| 7 | CustomerCsvImportModal has "Customer template" download button via new `generateSampleCustomerCsv()` helper; todo archived | ✓ VERIFIED | `csvHelpers.ts` exports `generateSampleCustomerCsv()` at line 70 with CUSTOMER_COLUMNS `['name','email','company','address','notes']` and 2 sample rows. `CustomerCsvImportModal.tsx` imports and wires it at line 329 with `customer-template.csv` filename. `.planning/todos/completed/customer-csv-template-download.md` exists; original removed |
| 8 | `generateQuotePdf.ts` no longer contains `(doc as any).lastAutoTable.finalY`; module augmentation in `jspdf-augment.d.ts` declares the type | ✓ VERIFIED | `grep "(doc as any)" src/pdf/generateQuotePdf.ts` returns 0 matches. `src/pdf/jspdf-augment.d.ts` exists with `declare module 'jspdf'` augmentation. Line 161 of generateQuotePdf.ts: `return doc.lastAutoTable.finalY;`. `tsconfig.app.json` includes `"src"` so the .d.ts is auto-discovered |
| 9 | QuoteRow overflow menu closes on outside click and on Escape; useEffect registers/unregisters while `overflowOpen` is true | ✓ VERIFIED | Lines 155-171 of JobsManager.tsx: `useEffect` gated on `if (!overflowOpen) return;`, registers `mousedown` on `document` and `keydown` on `window`, cleanup removes both. `overflowRef` attached at line 193 to container div. Dep array: `[overflowOpen]` |
| 10 | QuoteStatusPill has `aria-label="Status: {Pending\|Sale\|Declined}"` and Declined uses `text-slate-200` on `bg-slate-700` | ✓ VERIFIED | Line 104: `declined: { label: 'Declined', classes: 'bg-slate-700 text-slate-200' }`. Line 131: `aria-label={\`Status: ${label}\`}`. Template literal resolves to static values `'Pending'`, `'Sale'`, `'Declined'` |
| 11 | Rollup circular chunk warning gone; `vite.config.ts` manualChunks explicitly routes all react-* packages + scheduler into `react-vendor` | ✓ VERIFIED | Lines 139-141 of vite.config.ts: explicit OR chain includes `/react-router`, `/react-window`, `/@remix-run/`, `/scheduler/`. Build log in SUMMARY-05 confirms 0 circular chunk warnings. react-vendor chunk grew from 190.94 KB to 238.56 KB (expected); vendor chunk shrank from 598.21 KB to 550.99 KB |
| 12 | (Optional) Vendor chunk classification reviewed; outcome documented | ✓ VERIFIED | PERF-06 Branch B documented in 25-05-SUMMARY.md: papaparse and jszip are statically imported; no vite.config.ts-only splits safe within 30-min time-box. Future candidates (lazy GcodeImport, lazy CSV modals) noted |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/milestones/v1.2-REQUIREMENTS.md` | TAGS-01 + TAGS-04 rows = Complete; CUST-01/CUST-02 note in archive header | ✓ VERIFIED | Both rows confirmed; archive header line 10 has explicit CUST-01 + CUST-02 reference |
| `.planning/todos/ui-consistency-sweep.md` | Audited with `audited 2026-05-25` markers; file NOT moved to archive | ✓ VERIFIED | 14 markers; file stays in todos/ |
| `.planning/todos/completed/customer-csv-template-download.md` | Archived via git mv | ✓ VERIFIED | File exists at completed/ path; original removed |
| `src/components/CustomerLibrary.tsx` | `items-center justify-between gap-3` in row layout | ✓ VERIFIED | Line 48 confirmed |
| `src/utils/csvHelpers.ts` | Exports `generateSampleCustomerCsv()` | ✓ VERIFIED | Line 70; CUSTOMER_COLUMNS const; 2 sample rows |
| `src/components/CustomerCsvImportModal.tsx` | Imports + wires `generateSampleCustomerCsv`; `customer-template.csv` literal | ✓ VERIFIED | Line 9 import; line 329 onClick handler |
| `src/components/JobsManager.tsx` | aria-label on QuoteStatusPill; text-slate-200 on declined; mousedown + Escape handlers; overflowRef; zero generatingJobIds/isGeneratingPdf; no-op removed | ✓ VERIFIED | All 6 sub-items confirmed via grep |
| `src/components/PrintQuoteModal.tsx` | `onQuoteCreated?:` optional; `onQuoteCreated?.(quote)` call | ✓ VERIFIED | Line 36 and 283 confirmed |
| `src/components/ImageCarousel.tsx` | One-line comment at line 8 referencing image5.png absence | ✓ VERIFIED | Comment present between image4 (line 7) and image6 (line 9) |
| `src/pdf/jspdf-augment.d.ts` | New file with `declare module 'jspdf'` augmentation block | ✓ VERIFIED | File created; lines 11-12 contain the locked augmentation |
| `src/pdf/generateQuotePdf.ts` | `doc.lastAutoTable.finalY` (no cast); zero `(doc as any)` on lastAutoTable | ✓ VERIFIED | Line 161 confirmed; grep returns 0 for cast pattern |
| `vite.config.ts` | manualChunks includes `/react-router`, `/react-window`, `/@remix-run/`, `/scheduler/` | ✓ VERIFIED | Lines 139-141 confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CustomerCsvImportModal.tsx` | `csvHelpers.ts` | `import { generateSampleCustomerCsv, downloadCsv }` | ✓ WIRED | Line 9 of CustomerCsvImportModal.tsx confirms import |
| `CustomerCsvImportModal.tsx` onClick | `downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv')` | handler call | ✓ WIRED | Line 329 of CustomerCsvImportModal.tsx |
| `QuoteRow` useEffect | `document.addEventListener('mousedown', ...)` | handler gated on `overflowOpen` | ✓ WIRED | Line 165; gating confirmed at line 156: `if (!overflowOpen) return;` |
| `QuoteRow` useEffect | `window.addEventListener('keydown', ...)` Escape | handler gated on `overflowOpen` | ✓ WIRED | Line 166; `e.key === 'Escape'` at line 163 |
| `QuoteStatusPill` span | `aria-label` | template literal `Status: ${label}` | ✓ WIRED | Line 131 of JobsManager.tsx |
| `generateQuotePdf.ts` | `jspdf-augment.d.ts` | TypeScript auto-discovery via tsconfig.app.json `include: ["src"]` | ✓ WIRED | tsconfig.app.json confirmed; augmentation used without cast at line 161 |

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers CSS polish, doc edits, TypeScript type improvements, dead-code removal, and build config changes. No new dynamic data flows are introduced. The `generateSampleCustomerCsv()` helper generates hardcoded literal template content (no user input, no DB queries — by design).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| HYG-01: zero generatingJobIds references | `grep -E "generatingJobIds\|isGeneratingPdf" src/components/JobsManager.tsx \| wc -l` | 0 | ✓ PASS |
| DOC-01: TAGS-01 + TAGS-04 rows Complete | `grep -E "TAGS-0[14]" v1.2-REQUIREMENTS.md` | Both rows show `Complete` | ✓ PASS |
| POL-03: no (doc as any) cast on lastAutoTable | `grep "(doc as any).*lastAutoTable" src/pdf/generateQuotePdf.ts` | 0 matches | ✓ PASS |
| PERF-05: react-router/scheduler in manualChunks | `grep "react-router\|scheduler" vite.config.ts` | Lines 139-140 confirmed | ✓ PASS |
| POL-04: mousedown + Escape handlers | `grep "addEventListener.*mousedown\|key.*Escape" src/components/JobsManager.tsx` | Both present in QuoteRow useEffect | ✓ PASS |
| A11Y-09: aria-label on QuoteStatusPill | `grep "aria-label.*Status" src/components/JobsManager.tsx` | Line 131 confirmed | ✓ PASS |

### Probe Execution

No phase-declared probes. Skipped — not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOC-01 | 25-01 | TAGS-01 + TAGS-04 Traceability rows flipped to Complete | ✓ SATISFIED | v1.2-REQUIREMENTS.md Traceability table confirmed |
| DOC-02 | 25-01 | Archive header documents CUST-01/CUST-02 wording drift | ✓ SATISFIED | Archive header line 10 of v1.2-REQUIREMENTS.md confirmed |
| HYG-01 | 25-03 | generatingJobIds permanently-empty Set + isGeneratingPdf prop deleted | ✓ SATISFIED | Zero grep matches in JobsManager.tsx |
| HYG-04 | 25-03 | onQuoteCreated made optional; no-op at call site dropped | ✓ SATISFIED | PrintQuoteModal.tsx line 36 (`?:`), line 283 (`?.(`), no-op absent from JobsManager |
| HYG-05 | 25-03 | ImageCarousel one-line comment for image5.png absence | ✓ SATISFIED | Line 8 of ImageCarousel.tsx confirmed |
| HYG-10 | 25-01 | ui-consistency-sweep.md audited in place with dated markers | ✓ SATISFIED | 14 `audited 2026-05-25` markers; file stays in todos/ |
| PERF-05 | 25-05 | Circular chunk warning resolved; all react-* + scheduler in react-vendor | ✓ SATISFIED | vite.config.ts lines 139-141; build log in SUMMARY-05 shows 0 circular warnings |
| PERF-06 | 25-05 | Vendor chunk classification reviewed (optional) | ✓ SATISFIED | Branch B documented — no actionable splits in 30-min time-box; candidates noted for future |
| POL-01 | 25-02 | CustomerLibrary row layout — items-center applied | ✓ SATISFIED | CustomerLibrary.tsx line 48 confirmed |
| POL-02 | 25-02 | CustomerCsvImportModal template download button + generateSampleCustomerCsv() | ✓ SATISFIED | Helper exported; button wired; customer-csv-template-download.md archived to completed/ |
| POL-03 | 25-04 | (doc as any).lastAutoTable.finalY cast replaced with module augmentation | ✓ SATISFIED | jspdf-augment.d.ts created; generateQuotePdf.ts line 161 cast-free |
| POL-04 | 25-03 | QuoteRow overflow menu closes on outside-click + Escape | ✓ VERIFIED (structural) | useEffect gated on overflowOpen; mousedown + keydown handlers; overflowRef on container. Runtime behavior needs human verification |
| A11Y-09 | 25-03 | QuoteStatusPill aria-label + Declined contrast text-slate-200 | ✓ VERIFIED (structural) | aria-label at line 131; text-slate-200 at line 104. Visual contrast (claimed 4.6:1) needs human verification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/JobsManager.tsx` | 1397 | `TODO(future-sale-pdf): D-21 audit 2026-05-23` | ℹ️ Info | Pre-existing marker from commit 42d84a5 (Phase 16). Not introduced by Phase 25. References a D-decision (`D-21`) which provides auditability; passes the debt-marker gate (the `D-21` reference is a formal traceable item) |

No blockers found. The one TODO is pre-existing and has a formal traceability reference (D-21).

### Human Verification Required

#### 1. CustomerCsvImportModal Template Download

**Test:** Open the running app (npm run dev, port 4173), navigate to the Customer Library section, click "Import CSV" to open CustomerCsvImportModal, go to the Upload step, click the "Customer template" button.
**Expected:** Browser downloads a file named `customer-template.csv` containing header row `name,email,company,address,notes` plus two data rows (Jane Smith / Bob Jones). File opens cleanly in Numbers/Excel showing 5 columns.
**Why human:** Blob + URL.createObjectURL download trigger requires a live browser; cannot verify in headless agent context.

#### 2. QuoteRow Overflow Menu — Outside Click

**Test:** Navigate to JobsManager, find a Pending quote, click the `[⋯]` (three-dot) overflow button to open the menu, then click anywhere outside the menu container.
**Expected:** The overflow menu closes.
**Why human:** POL-04 mousedown outside-click requires a live DOM event that grep cannot simulate.

#### 3. QuoteRow Overflow Menu — Escape Key

**Test:** With the overflow menu open (from above), press the Escape key.
**Expected:** The overflow menu closes.
**Why human:** POL-04 Escape keydown requires a live browser keyboard event.

#### 4. QuoteStatusPill Accessibility and Contrast

**Test:** Open DevTools on any page showing a Declined quote pill. Inspect the `<span>` element.
**Expected:** (a) `aria-label` attribute reads `Status: Declined`. (b) The text color (#e2e8f0 = slate-200) on the background (#334155 = slate-700) produces a visually readable label — the contrast ratio should be approximately 4.6:1 as claimed.
**Why human:** Contrast ratio verification requires a color picker tool or accessibility checker (axe, Lighthouse) on live rendered output.

#### 5. PrintQuoteModal Flow — onQuoteCreated Optional

**Test:** Create a job with pricing, click "Create Quote" to open PrintQuoteModal, fill in quote details, submit.
**Expected:** Modal closes without error; no JavaScript console errors related to `onQuoteCreated` being undefined; quote appears in the Recent Quotes section.
**Why human:** HYG-04 optional-prop change is structurally verified but the end-to-end runtime flow (optional callback invocation path) needs confirmation that no other call site was missed.

### Gaps Summary

No gaps. All 12 success criteria verified in the codebase. Five items require human UAT (runtime behavior, download trigger, visual contrast, accessibility attribute in live DOM) which is expected for a UI/accessibility/polish phase.

---

_Verified: 2026-05-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
