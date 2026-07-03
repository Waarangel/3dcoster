---
phase: 16
slug: printable-pdf-quote
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-22
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `16-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 with jsdom environment |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `vitest run` |
| **Full suite command** | `vitest run --coverage` |
| **Estimated runtime** | ~10 seconds quick · ~25 seconds full |

---

## Sampling Rate

- **After every task commit:** Run `vitest run`
- **After every plan wave:** Run `vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green AND all build gates pass (`npm run build` → `assert-bundle-size.mjs` + `assert-no-pdf-preload.mjs` + `assert-no-static-jspdf.mjs`)
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

> Plans will fill in concrete Task IDs once the planner runs. This map captures the requirement → test → command map that EVERY plan must honor.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PDF-01 | "Generate PDF" button renders on CostCalculator + JobsManager; disabled when `sellingPrice <= 0` | manual (visual) + unit (rendered state) | `vitest run src/components/CostCalculator.test.tsx` (button disabled state) | ❌ Wave 0 | ⬜ pending |
| PDF-02 | Generated PDF byte stream starts with `%PDF-`, contains expected section strings (quote#, customer, totals, footer) | integration | `vitest run src/pdf/generateQuotePdf.test.ts` | ❌ Wave 0 | ⬜ pending |
| PDF-03 | No `from 'jspdf'`, `from 'jspdf-autotable'`, or `import 'jspdf'` in any `src/**/*.{ts,tsx}` | build gate | `node scripts/assert-no-static-jspdf.mjs` | ❌ Wave 0 | ⬜ pending |
| PDF-04 | `dist/index.html` contains no `modulepreload` referencing the pdf chunk | build gate | `node scripts/assert-no-pdf-preload.mjs` | ❌ Wave 0 | ⬜ pending |
| PDF-05 | Main app chunk ≤ 300 KB gzipped | build gate | `node scripts/assert-bundle-size.mjs` | ✅ exists (Phase 11) | ⬜ pending |
| util:formatQuoteNumber | `formatQuoteNumber(42) === 'Q-0042'`, padding to 4 digits | unit | `vitest run src/utils/format.test.ts` (or colocated) | ❌ Wave 0 | ⬜ pending |
| util:taxLabelFor | EU codes → `VAT`, AU/NZ/IN/CA → `GST`, ES/MX → `IVA`, US → `Sales Tax`, fallback → `Tax` | unit | `vitest run src/utils/taxResolution.test.ts` | ❌ Wave 0 | ⬜ pending |
| util:customerNameSlug | ASCII-safe, lowercase, hyphenated, ≤ 30 chars; empty/undefined returns `''` | unit | Same test file | ❌ Wave 0 | ⬜ pending |
| desktop:tauriSave | Web build uses `doc.save(filename)`; Tauri build calls `@tauri-apps/plugin-dialog::save` + `@tauri-apps/plugin-fs::writeFile`; user-cancel returns silently | manual (e2e) | `npm run tauri:dev` → click Generate PDF → confirm save dialog → reopen file | ❌ Wave 0 | ⬜ pending |
| font:glyphCoverage | PDF contains `€`, common accents (`é à ñ ß`), and Latin-Ext glyphs (`ą ł ž ş`) rendered with Noto Sans (no `Tj`-tofu) | integration + manual | Integration: doc string includes glyphs. Manual: open PDF in Preview/Adobe, eyeball glyphs | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 sets up the test scaffolding and CI gates BEFORE any feature code lands. Plans must include a Wave 0 plan covering these:

- [ ] `src/pdf/generateQuotePdf.test.ts` — integration tests for the PDF generator (`%PDF-` magic, expected strings, byte length sanity)
- [ ] `src/utils/format.test.ts` (new) OR extend existing — covers `formatQuoteNumber()` + `customerNameSlug()`
- [ ] `src/utils/taxResolution.test.ts` (extend existing) — covers `taxLabelFor()` mapping
- [ ] `src/components/CostCalculator.test.tsx` (new or extend) — covers disabled-state of Generate PDF when `sellingPrice <= 0`
- [ ] `scripts/assert-no-static-jspdf.mjs` — build gate for PDF-03
- [ ] `scripts/assert-no-pdf-preload.mjs` — build gate for PDF-04
- [ ] `scripts/subset-noto-sans.mjs` — one-time font subsetting (Latin + Latin-Ext + U+20AC; outputs base64 module)
- [ ] `src/pdf/notoSansBase64.ts` — committed output of the subsetting script (regular + bold base64 strings)
- [ ] `package.json` scripts wired: `build` chains `assert-no-static-jspdf.mjs` (pre) + `vite build` + `assert-no-pdf-preload.mjs` + `assert-bundle-size.mjs` (post)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual aesthetic (print-shop minimal, ruled lines, no color) | D-01, D-02 | Visual judgment cannot be automated | Generate PDF for sample job; open in Preview/Adobe Reader; compare to Stripe invoice reference; confirm B&W laser would render cleanly |
| Tauri save dialog UX | criterion #5 | Real desktop dialog needs OS interaction | `npm run tauri:dev` → click Generate PDF in cost calculator → pick a folder → confirm file is written → reopen file |
| Glyph rendering (no tofu) | criterion #5, D-10 | Subtle visual regression | Generate PDF for job with customer name `François Müller` + €-denominated price; open in Preview; eyeball all glyphs |
| 0% tax row omitted | criterion #1, D-07 | Visual layout | Generate two PDFs — one job with `taxRate=0`, one with `taxRate=19%`; confirm Tax row hidden in first, present + labeled `VAT (19%)` in second |
| Customer block omitted when missing | criterion #1 | Visual layout | Generate PDF for job with no customer details; confirm right-hand column under header is blank and layout doesn't break |
| Notes/Terms layered model | D-08 | Visual layout + content sourcing | Set `UserProfile.defaultTerms = 'Payment due 14d'`, leave `PrintJob.notes` empty → confirm only Terms subsection renders. Then add `PrintJob.notes = 'PLA, gloss finish'` → confirm both subsections render. Then clear both → confirm the whole Notes/Terms area is omitted |
| NEW badge overlay does not break button layout | project memory rule | Visual layout | Verify the absolute-positioned `<NewBadge>` overlays the Generate PDF buttons in CostCalculator + JobsManager without pushing siblings, wrapping, or reflowing — including the mobile/narrow JobsManager accordion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency entry above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references in the per-task map
- [ ] No watch-mode flags (CI must be deterministic)
- [ ] Feedback latency < 25s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 + tests are written

**Approval:** pending
