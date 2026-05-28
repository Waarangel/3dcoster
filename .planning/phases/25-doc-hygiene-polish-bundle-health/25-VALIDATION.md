---
phase: 25
slug: doc-hygiene-polish-bundle-health
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
backfilled: true
backfill_phase: 26-v1-3-cleanup
---

# Phase 25 — Validation Strategy

> Per-phase validation contract. Backfilled retroactively by Phase 26 (2026-05-28); per-task map points to 25-VERIFICATION.md observable truths per CONTEXT.md D-06.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 + raw createRoot + act (project convention) |
| **Config file** | `vite.config.ts` (vitest config inline) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run build` (runs `tsc -b && vite build` after `vitest run`) |
| **Estimated runtime** | ~5s for `npm test`, ~30s for `npm run build` |

---

## Sampling Rate

- **After every task commit:** `npm test`
- **After every plan wave:** `npm run build`
- **Phase gate:** `npm run build` exit 0 + VERIFICATION.md status: passed

---

## Per-Task Verification Map

> Backfill: rows reference 25-VERIFICATION.md "Observable Truths" and "Requirements Coverage" tables verbatim per D-06.

| Req ID | Plan | Wave | Observable Truth (from VERIFICATION.md) | Test Type | Automated Command | Evidence Source | Status |
|--------|------|------|------------------------------------------|-----------|-------------------|-----------------|--------|
| DOC-01 | 25-01 | 1 | v1.2-REQUIREMENTS.md Traceability rows TAGS-01 + TAGS-04 read `Complete`; CUST-01/CUST-02 wording-drift note present in archive header | doc | `npm test && npm run build` | 25-VERIFICATION.md SC#1 | passed |
| DOC-02 | 25-01 | 1 | v1.2-REQUIREMENTS.md Traceability rows TAGS-01 + TAGS-04 read `Complete`; CUST-01/CUST-02 wording-drift note present in archive header | doc | `npm test && npm run build` | 25-VERIFICATION.md SC#1 | passed |
| HYG-01 | 25-03 | 1 | JobsManager `generatingJobIds` permanently-empty Set and `isGeneratingPdf` prop deleted from all locations | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#2 | passed |
| HYG-04 | 25-03 | 1 | PrintQuoteModal `onQuoteCreated` is optional (`?:`); invoked via `?.()`; no-op removed from JobsManager | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#3 | passed |
| HYG-05 | 25-03 | 1 | ImageCarousel.tsx has one-line comment explaining image5.png absence between image4 and image6 imports | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#4 | passed |
| HYG-10 | 25-01 | 1 | `.planning/todos/ui-consistency-sweep.md` updated in place with audit markers; not archived | doc | `npm test && npm run build` | 25-VERIFICATION.md SC#5 | passed |
| POL-01 | 25-02 | 1 | CustomerLibrary row layout "Last used" text vertically centered with Edit/Delete buttons | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#6 | passed |
| POL-02 | 25-02 | 1 | CustomerCsvImportModal has "Customer template" download button via new `generateSampleCustomerCsv()` helper; todo archived | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#7; 25-HUMAN-UAT.md verified 2026-05-28 | passed |
| POL-03 | 25-04 | 1 | `generateQuotePdf.ts` no longer contains `(doc as any).lastAutoTable.finalY`; module augmentation in `jspdf-augment.d.ts` declares the type | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#8 | passed |
| POL-04 | 25-03 | 1 | QuoteRow overflow menu closes on outside click and on Escape; useEffect registers/unregisters while `overflowOpen` is true | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#9; 25-HUMAN-UAT.md verified 2026-05-28 | passed |
| A11Y-09 | 25-03 | 1 | QuoteStatusPill has `aria-label="Status: {Pending\|Sale\|Declined}"` and Declined uses `text-slate-200` on `bg-slate-700` | unit | `npm test && npm run build` | 25-VERIFICATION.md SC#10; 25-HUMAN-UAT.md verified 2026-05-28 | passed |
| PERF-05 | 25-05 | 1 | Rollup circular chunk warning gone; `vite.config.ts` manualChunks explicitly routes all react-* packages + scheduler into `react-vendor` | build | `npm run build` | 25-VERIFICATION.md SC#11 | passed |
| PERF-06 | 25-05 | 1 | (Optional) Vendor chunk classification reviewed; outcome documented | build | `npm run build` | 25-VERIFICATION.md SC#12 | passed |

---

## Wave 0 Requirements

Backfilled phase — Wave 0 was satisfied during the original phase execution. All test files referenced in the Per-Task Map exist in `src/`. No new test files required. Three items (POL-02, POL-04, A11Y-09) required human UAT verified 2026-05-28 per 25-HUMAN-UAT.md.

---

## Manual-Only Verifications

All 5 manual UAT items from 25-VERIFICATION.md `human_verification` frontmatter were verified via 25-HUMAN-UAT.md on 2026-05-28.

| Test | Expected | Why Manual | Outcome |
|------|----------|------------|---------|
| Open CustomerCsvImportModal in npm run dev (port 4173), navigate to the Upload step, click 'Customer template' button | Browser downloads customer-template.csv with header row (name,email,company,address,notes) + 2 data rows; file opens cleanly in spreadsheet app showing 5 columns | Cannot trigger browser download in headless agent context; downloadCsv() uses Blob + URL.createObjectURL which requires a browser environment | PASS on 2026-05-28 per 25-HUMAN-UAT.md |
| Open JobsManager, navigate to Pending quotes, click the [⋯] overflow button on a Pending quote row, then click somewhere outside the menu | Overflow menu closes when clicking outside its container | POL-04 mousedown outside-click handler requires a real DOM environment; can't fire fireEvent.mouseDown(document.body) without running the test suite | PASS on 2026-05-28 per 25-HUMAN-UAT.md |
| With the overflow menu open (from above), press Escape | Overflow menu closes | POL-04 Escape handler requires a real keyboard event in a browser context | PASS on 2026-05-28 per 25-HUMAN-UAT.md |
| Inspect a Declined quote pill in browser DevTools; check the aria-label attribute | aria-label reads 'Status: Declined'; visually the text appears brighter/more readable against the dark bg-slate-700 background (text-slate-200 vs prior text-slate-300) | Contrast ratio verification (4.6:1 claim) and visual readability require DevTools color picker or human eye on rendered output | PASS on 2026-05-28 per 25-HUMAN-UAT.md |
| Generate a quote via PrintQuoteModal (create a job, add pricing, click Create Quote) | Modal closes without JavaScript error in console; no regression from making onQuoteCreated optional | HYG-04 optional-prop change is structurally verified but runtime modal flow needs visual confirmation | PASS on 2026-05-28 per 25-HUMAN-UAT.md |

---

## Validation Sign-Off

- [x] All tasks have automated verify or were satisfied during original execution
- [x] Sampling continuity preserved
- [x] Wave 0 satisfied retroactively
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] All 5 manual UAT items PASS per 25-HUMAN-UAT.md (2026-05-28)

**Approval:** backfilled 2026-05-28 by Phase 26 per CONTEXT.md D-05/D-06

---

## Backfill Audit Trail

Backfilled by Phase 26 plan 26-02 on 2026-05-28. Source of truth for verification claims:
- `.planning/phases/25-doc-hygiene-polish-bundle-health/25-VERIFICATION.md` (status: passed; re_verified: 2026-05-28T16:25:00Z)
- `.planning/phases/25-doc-hygiene-polish-bundle-health/25-HUMAN-UAT.md` (all 5 manual tests PASS 2026-05-28)
- `.planning/v1.3-MILESTONE-AUDIT.md` §requirements coverage
- CONTEXT.md decisions D-05 (template choice) and D-06 (pointer-doc semantics)
