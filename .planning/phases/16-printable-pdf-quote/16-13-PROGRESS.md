---
phase: 16-printable-pdf-quote
plan: "13"
status: in_progress
task_1: complete (2026-05-23)
task_2: awaiting_human_uat
task_3: pending_uat_verdict
---

# 16-13 PROGRESS — UAT verification (mid-flight)

## Status

Plan 16-13 is paused at the human-verify checkpoint (Task 2). Task 1
(automated chain) is complete; Task 3 (update 16-VERIFICATION.md) is
pending the user's UAT verdict.

## Task 1 — automated chain (PASSED 2026-05-23)

| # | Check | Expected | Actual |
|---|-------|----------|--------|
| 1 | `npm run build` | exit 0 | exit 0 — all 7 build gates pass |
| 2 | `ls -lh dist/assets/ pdf-* + index-*` | pdf-*.js + main < 300KB gz | pdf-Ckwo6cOQ.js 150K / 77.79 KB gz · index-Bou_ncGb.js 244K / 57.7 KB gz |
| 3 | `grep -rn "from 'jspdf'" src/` | **1** | **1** — src/pdf/generateQuotePdf.ts |
| 4 | `grep -rn "from 'jspdf-autotable'" src/` | **1** | **1** — src/pdf/generateQuotePdf.ts |
| 5 | `grep -rn "await import('../pdf/generateQuotePdf')" src/` | **1** | **1** — src/components/PrintQuoteModal.tsx (D-13 audit count dropped 2→1) |
| 6 | `grep -rn "doc.html\|doc.autoTable(" src/pdf/` | **0** | **0** |
| 7 | `grep -c "GeneratePdfButton" src/components/CostCalculator.tsx` | **0** | **0** (D-13) |
| 8 | `grep -c "Print Quote" src/components/JobsManager.tsx` | ≥1 | **3** (D-14) |
| 9 | `grep -c "Generate PDF" src/components/JobsManager.tsx` | **0** | **0** |
| 10 | `grep -c "taxRate: tax.ratePercent" src/components/CostCalculator.tsx` | **2** | **2** (D-21) |
| 11 | `grep -c "taxRate: taxRateOverride" src/components/CostCalculator.tsx` | **0** | **0** (D-21) |
| 12 | `grep -c "db.version(8)" src/db/database.ts` | **1** | **1** (D-17) |
| 13 | `grep -c "Recent Quotes" src/components/JobsManager.tsx` | ≥1 | **3** (D-19) |
| 14 | `grep -c "db.transaction" src/components/JobsManager.tsx` | ≥1 | **1** (D-20 Sale+Quote tx) |
| 15 | `grep -c "db.transaction" src/components/PrintQuoteModal.tsx` | **0** | **0** (I-07 Option B lock) |
| 16 | `grep -c "db.transaction" src/hooks/useDatabase.ts` | ≥1 | **1** (D-18 createQuote tx) |
| 17 | `grep -c "shippingCost" src/pdf/generateQuotePdf.ts` | ≥2 | **6** (D-15) |
| 18 | `grep -c "QuotePdfParams\|userProfile:" src/pdf/generateQuotePdf.ts` | **0** | **0** (D-17 G4 strict by-value) |
| 19 | Quote interface in types.ts | **1** | **1** (D-17) |

Test suite: **216 passed, 2 todo** (was 177 pre-plan).

All build gates green: lint-no-raw-html, assert-no-static-jspdf,
vitest --coverage, tsc -b, vite build, assert-bundle-size,
assert-no-pdf-preload.

## Task 2 — Human UAT scenarios (PENDING)

User opted to run the 14 UAT scenarios manually. Reference card below;
full scenario scripts are in 16-13-PLAN.md lines 116-201.

### Environment

```bash
npm run dev          # web (port 4173)
npm run tauri:dev    # desktop (separate terminal)
```

### Original Phase 16 UAT — re-adapted (S1-S7)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| S1 | Web PDF — no customer, no tax, NEW JobsManager flow (CostCalculator has no Print button) | PDF has quote#, customer name, no tax/shipping row, Total=Subtotal |
| S2 | Web PDF — IT customer (VAT 22%) + Notes/Terms + shipping 5 | Bill To block, Subtotal €100, Shipping €5, VAT (22%) €22.00 (NOT €23.10 per D-22), Total €127 |
| S3 | Web PDF — Terms only, no Notes | PDF has Terms section, no Notes section |
| S4 | Web PDF — neither Notes nor Terms | Neither section renders, page reflows cleanly |
| S5 | Tauri PDF — Scenario 2 via native save dialog | macOS/Windows native save dialog fires; default filename `Quote-Q-NNNN-LucaBianchi.pdf` |
| S6 | NewBadge non-regression — fresh localStorage | `pdf-quote` badge on Print Quote button only; no badge on CostCalculator / Recent Quotes / PrintQuoteModal |
| S7 | Quote number lifecycle | Job A → Q-0001, Job B → Q-0002, Job A again → Q-0003; Recent Quotes on Job A shows Q-0001 + Q-0003 reverse-chrono |

### New extension UAT scenarios (E1-E7)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| E1 | D-15 shipping row | shipping 0 → no row; shipping 7.50 → "Shipping: €7.50" between Subtotal and Tax |
| E2 | D-22 tax base lock | sellingPrice 100, shipping 50, VAT 22% → Total €172 (NOT €183 — shipping NOT taxed) |
| E3 | D-16 picker reuse + by-value snapshot | Type to filter customers, ArrowDown+Enter picks, edit Name in modal, Generate → Quote has modal-edited Name, library record UNCHANGED |
| E4 | D-19 status transitions | Mark Accepted (gray → green) → Mark Declined (green → red) → Reopen (red → gray); decisionAt fresh on each |
| E5 | D-20 Convert to Sale + back-ref | Accepted Quote → Convert → modal pre-filled → adjust price → Save → Quote becomes Converted (blue) with → Sale annotation; Recent Sales has ← Q-NNNN back-ref that scrolls |
| E6 | D-21 tax-fallback regression | UserProfile defaultTaxRate=13, NEW job with BLANK tax field, save, reload, Generate → PDF shows Tax (13%) row (NOT missing) |
| E7 | D-17 G7 migration backfill | (Optional — requires pre-v8 DB). May be marked "verified by unit tests" if setup is hard |

### Result recording

For each scenario, record: PASS / FAIL (with description) / N/A (with reason).

## Task 3 — Update 16-VERIFICATION.md (PENDING UAT VERDICT)

When UAT is done, return to this session (or a new one) and provide the
verdict. Task 3 then:

- Updates frontmatter to `status: gaps_closed` (or `gaps_found` + new gap_X entry)
- Marks each gap A-H with `resolved_by: <plan-id>`
- Adds the "Gap-Closure Verification" section with the automated chain table + UAT scenario results
- Adds the Decision Coverage table (D-13..D-22 → plan IDs)
- Updates Requirement Status to PASS for PDF-01 + PDF-02
- Commits the update

## Resume signal

Reply with `approved` or describe failures (scenario # + observed behavior).

## Commits so far (plan 16-13)

(none — plan 16-13 has no source edits; only doc updates pending in Task 3.)
