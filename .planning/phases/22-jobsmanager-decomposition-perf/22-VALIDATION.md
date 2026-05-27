---
phase: 22
slug: jobsmanager-decomposition-perf
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project-installed) + jsdom |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- --reporter=verbose <file-glob>` |
| **Full suite command** | `npm test` |
| **TypeScript check** | `tsc -b` (Vercel runs `tsc -b && vite build` — `tsc --noEmit` is insufficient) |
| **Estimated runtime** | ~15-20 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <new-or-changed-file>` (targeted, < 5s)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** `tsc -b && npm test` must be fully green
- **Max feedback latency:** ~20 seconds per full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-* | 01 | 1 | HYG-08 | — | N/A — refactor only | Unit (hook) | `npm test -- useCustomerPicker` | ❌ W0 — `src/hooks/useCustomerPicker.test.tsx` | ⬜ pending |
| 22-02-* | 02 | 1 | HYG-02, HYG-03 | — | N/A | Static / regression | `tsc -b && npm test` | ✅ (existing) | ⬜ pending |
| 22-03-* | 03 | 2 | HYG-06 | — | V5 carried forward (`saleQuantity <= 0` guard moves verbatim with `handleRecordSale`) | Component | `npm test -- RecordSaleModal` | ❌ W0 — `src/components/RecordSaleModal.test.tsx` | ⬜ pending |
| 22-04-* | 04 | 2 | HYG-07 | — | N/A | Regression | `npm test -- JobsManager` | ✅ (existing) | ⬜ pending |
| 22-05-* | 05 | 3 | PERF-01, PERF-02, PERF-03, PERF-04 | — | N/A | Component / regression | `npm test -- RecordSaleModal CustomerLibrary` | Mostly existing | ⬜ pending |
| 22-06-* | 06 | 3 | PERF-07 | — | N/A | Regression | `npm test -- JobsManager` | ✅ (existing; mock update in same commit) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Files to create **before** the implementation tasks in their respective plans can claim acceptance:

- [ ] `src/hooks/useCustomerPicker.test.tsx` — covers keyDown branches (ArrowDown open/cycle, ArrowUp wrap-last→first, Enter-with-match calls onPick, Enter-with-no-match closes without onPick, Escape closes + `stopPropagation`, Tab close-without-pick), plus `visibleCustomers` slice to `PICKER_VISIBLE_LIMIT` and `filteredCustomers` derivation from query
- [ ] `src/components/RecordSaleModal.test.tsx` — covers the 3 modes (ROADMAP success criterion #11): create mode, edit mode (form hydrates from `editingSale`), convert-from-quote mode (spy on `db.transaction` to confirm atomic tx fires). Uses raw `createRoot` + `act` per Phase 19 D-21 and `PrintQuoteModal.test.tsx` precedent

These two test files are the only Wave 0 dependencies. All other tests already exist (`JobsManager.test.tsx`, `PrintQuoteModal.test.tsx`, `CustomerLibrary.test.tsx` where applicable).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Record Sale modal Escape key closes the picker dropdown only, NOT the modal | HYG-08 (D-03 — CR-04 fix) | DOM event propagation across nested document-level Escape listeners is jsdom-flaky; manual confirms the production UX | Open Record Sale → click into picker → press Escape. Picker closes, modal stays open. Press Escape again → modal closes. |
| Break-even pill values still match pre-refactor | PERF-01 | Visual regression — confirm map-based lookup returns identical info shape | Open Jobs Manager with mixed jobs (some break-even hit, some not). Compare pill copy + color before/after Phase 22. No deltas. |
| Convert-from-Quote single-row transaction still atomic | HYG-06 (D-07) | Atomicity verified by spy in unit test, but manual confirms end-to-end (creates sale + decrements quote `copiesAvailable` + bumps job `copiesSold`) | Open job with a Quote → "Convert to Sale" → save. Confirm new Sale row appears, Quote disappears (or count decrements), and job summary `copiesSold` increments. |
| Customer picker overflow footer still displays | HYG-08 (D-05) | Footer JSX moves byte-identically with the hook integration | Open Record Sale → type to match >8 customers → confirm "Showing first 8 of N matches" footer. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the 2 new test files (`useCustomerPicker.test.tsx`, `RecordSaleModal.test.tsx`)
- [ ] No watch-mode flags (`npm test` runs once, exits)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
