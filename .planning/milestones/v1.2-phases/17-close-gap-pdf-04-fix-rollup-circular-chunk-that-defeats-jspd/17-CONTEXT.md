---
phase: 17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd
type: context
gathered: 2026-05-25
gathered_by: discuss-phase
parent_milestone: v1.2 Quote-to-Customer
parent_audit: .planning/v1.2-MILESTONE-AUDIT.md
---

# Phase 17: Close Gap PDF-04 + Tax Rounding — Context

## Domain

A v1.2 closure phase. The milestone audit found one blocker (PDF lazy-load defeated by Rollup chunk ordering) and one warning (tax rounding divergence between CostCalculator and PrintQuoteModal). Both fixes are mechanical and bounded — no new capability, no behavior change for end users. The phase also folds in two trivial housekeeping items so the v1.2 audit trail is consistent before milestone close.

This phase exists only because the v1.2 audit (`.planning/v1.2-MILESTONE-AUDIT.md`) surfaced these defects. It is the last work before `/gsd:complete-milestone v1.2`.

## Carrying forward from prior phases / project lockings

| Source | Decision that applies |
|--------|----------------------|
| PROJECT.md | "Local-first; no API integrations" — Phase 17 introduces no network calls |
| Phase 11 (Bundle gate) | Main chunk ≤ 300 KB gz; `scripts/assert-bundle-size.mjs` enforces. UNCHANGED. |
| Phase 16 D-01 | jspdf + jspdf-autotable MUST load via dynamic `import()` from the user's "Generate PDF" / "Print Quote" click — never statically imported into any other chunk. THIS IS THE INTENT BEING REPAIRED. |
| Phase 16 D-XX (modulePreload) | `vite.config.ts` sets `build.modulePreload: false` — UNCHANGED. |
| Phase 13 D-XX (calculateTax) | `calculateTax(sellingPrice, ratePercent)` in `src/utils/costCalc.ts` is the canonical tax helper. Uses `Math.round(price * rate) / 100` rounding. UNCHANGED — Phase 17 makes PrintQuoteModal CALL this helper rather than fork its math. |
| Phase 13 D-XX (tax resolution) | `resolveTaxRate({ jobOverride, settingsDefault, currency, address })` returns `{ kind, rate, ... }` — UNCHANGED |
| v1.2 Milestone Audit (95ddae6) | PDF-04 status: partial → blocker. PrintQuoteModal:196 tax math: warning. REQUIREMENTS.md and ROADMAP.md have stale state from completed phases. |

## Decisions (D-01 through D-08)

**D-01 (Rollup chunk fix — REORDER manualChunks check):**
In `vite.config.ts` (`build.rollupOptions.output.manualChunks`), MOVE the `/src/pdf/` + `/jspdf/` + `/jspdf-autotable/` check ABOVE the `if (id.includes('node_modules'))` block. Reason: jspdf lives in `node_modules`, so today's outer check catches it as `'vendor'` BEFORE the inner PDF check ever fires. Reordering routes jspdf to the `'pdf'` chunk first, breaking the static-import injection into marketing route chunks.

Expected diff: ~5 lines moved, zero added. The reordered function returns `'pdf'` for any id matching `/src/pdf/`, `/jspdf/`, or `/jspdf-autotable/`; otherwise drops to the existing `node_modules` classification block; otherwise returns undefined (default chunk).

**D-02 (NEW CI gate — assert-no-static-pdf-import.mjs):**
Add `scripts/assert-no-static-pdf-import.mjs` as a sibling to the existing `scripts/assert-no-pdf-preload.mjs`. The new script:
1. Globs `dist/assets/*.js` excluding `index-*.js` (the only file allowed to import pdf, and only via dynamic `import()`)
2. For each file, reads its contents and matches against a regex like `/import\s*\(?\s*["']\.\/pdf-[\w-]+\.js["']/` — but the FAIL pattern is the STATIC form `import"./pdf-*"` (no parens, no async). Dynamic `import("./pdf-*")` is OK.
3. Exits 1 if any non-index chunk contains the static pattern, with a clear error message listing the offending file(s).

Wire into `package.json` `build` script AFTER `assert-no-pdf-preload.mjs`. The existing `assert-no-pdf-preload.mjs` keeps its current narrow scope (scans `dist/index.html` for `<link rel="modulepreload">` tags only). Two narrow scripts, two narrow names.

**D-03 (Tax rounding fix — call calculateTax directly):**
In `src/components/PrintQuoteModal.tsx` (around line 196), replace the inline expression `subtotal * (resolvedTax.rate / 100)` with `calculateTax(subtotal, resolvedTax.rate).taxAmount`. Add the import: `import { calculateTax } from '../utils/costCalc'`. Approximately a 2-line diff (1 import, 1 expression replacement).

After this change, both CostCalculator and PrintQuoteModal compute `taxAmount` through the same `Math.round(price * rate) / 100` helper. The two surfaces converge byte-identically on the same `taxAmount` for the same inputs. Quote.lineItemsSnapshot.taxAmount will match PrintJob.taxAmount for the same job (assuming `resolveTaxRate` returns the same rate, which it does — both pass the same 4-arg call).

**D-04 (No parity test in this phase — covered by D-03 architecture):**
Skip the optional "add a Vitest parity test asserting calculateTax === inline math". Once both surfaces call the same helper, there's nothing to parity-test — they're the same code path. If someone forks the math again in a future phase, the audit-time integration check will surface it. Don't add ceremony.

**D-05 (Housekeeping fold-in — REQUIREMENTS.md checkboxes):**
After the Rollup + tax fixes ship and verify, tick `[x]` on these REQUIREMENTS.md items:
- DUP-02 (Phase 15) — currently `[ ]` despite Phase 15 VERIFICATION.md confirming gap-free
- PDF-01 (Phase 16) — currently `[ ]`
- PDF-02 (Phase 16) — currently `[ ]`
- PDF-03 (Phase 16) — currently `[ ]`
- PDF-04 (Phase 16) — currently `[ ]`; ticks ONLY after Phase 17's fix lands AND build verification passes
- PDF-05 (Phase 16) — currently `[ ]` (bundle gate passes regardless)

Six checkboxes to update. One Edit in REQUIREMENTS.md.

**D-06 (Housekeeping fold-in — ROADMAP.md Phase 16 row):**
Update the Phase 16 row in ROADMAP.md's Progress Table from `12/13 | In Progress` to `12/12 | Complete | 2026-05-23`. Reasoning: Plan 16-05 is a verification-only plan that produced `16-VERIFICATION.md` instead of a per-plan `16-05-SUMMARY.md`. Counting 16-05 as one of the 12 substantive plans (rather than 13 including a phantom doc-only plan) reflects what actually shipped. The completion date `2026-05-23` matches Phase 16's VERIFICATION.md timestamp ("Final UAT verdict: 'this is perfect. Approved.'").

Also update the `[ ] **Phase 16: Printable PDF Quote**` bullet at the top of ROADMAP.md to `[x]` with the completion date.

**D-07 (NOT IN SCOPE — REQUIREMENTS.md text revisions for D-21..D-24):**
The Phase 14 mid-UAT scope reversal (D-21..D-24 — per-Sale customer instead of per-job; Etsy gated on marketplace=etsy) drifted REQUIREMENTS.md text from the shipped surface. The user explicitly EXCLUDED this from Phase 17 scope during discuss-phase. Captured for future cleanup (see Deferred Ideas).

**D-08 (NOT IN SCOPE — Nyquist VALIDATION.md backfill for Phase 13/15/15.1):**
The audit surfaced three missing or incomplete VALIDATION.md files. The user explicitly EXCLUDED this from Phase 17 scope during discuss-phase. Captured for future cleanup (see Deferred Ideas).

## Deferred ideas (NOT in scope of Phase 17)

- **REQUIREMENTS.md text updates for CUST-01 / CUST-02 / ETSY-01** — pre-reversal wording still describes per-job customer + always-visible Etsy section. Phase 14's D-21..D-24 changed both. Bounded content edit; defer to a follow-up cleanup PR or v1.3 housekeeping pass.
- **VALIDATION.md backfill (Phase 13, 15, 15.1)** — run `/gsd:validate-phase 13 / 15 / 15.1` to author the missing Nyquist contracts. Different workflow, not appropriate to fold into a closure phase. Defer.
- **Phase 15.1 deferred items M + N** — Customer Library row vertical-centering; CustomerCsvImportModal missing template-download button. Polish; defer to v1.3.
- **Phase 13 human UAT formal sign-off** — 8 visual-contract items deferred to wrap-up never performed. 4 days of production usage suggests no functional regression, but formal sign-off is missing. Defer to /gsd:validate-phase 13.
- **Refactoring tax math into a single Quote-creation helper** — option C from the discussion. Architectural improvement; not justified for one site. If a third surface ever computes tax, revisit.
- **Build-time Rollup plugin for chunk-isolation enforcement** — option from the CI-gate discussion. Heavier than the post-build script; defer unless the post-build approach proves flaky.

## Canonical refs (MUST be consulted by planner / researcher)

- `.planning/v1.2-MILESTONE-AUDIT.md` — the source of this phase's scope. Read Verdict + Cross-Phase Integration Findings sections.
- `vite.config.ts` lines 80-105 (current `build.rollupOptions.output.manualChunks` function — the file to be reordered)
- `scripts/assert-no-pdf-preload.mjs` (the existing CI gate to mirror in style for the new sibling script)
- `scripts/assert-bundle-size.mjs` (300 KB gate; UNCHANGED but the pattern for the new sibling script)
- `package.json` (the `build` script ordering — new sibling script wires in here)
- `src/utils/costCalc.ts` lines 124-136 (the `calculateTax` helper — canonical tax math)
- `src/components/PrintQuoteModal.tsx` around line 196 (the inline math to replace)
- `src/components/CostCalculator.tsx` (reference for how `calculateTax` is called today; mirror the call pattern)
- `.planning/REQUIREMENTS.md` (the checkboxes to tick under D-05)
- `.planning/ROADMAP.md` (the Phase 16 row + bullet to update under D-06)

## Open questions for the planner

None blocking. All four discuss-phase questions have explicit answers. Two judgment calls the planner may need to make:

1. **Build verification cadence** — should the new `assert-no-static-pdf-import.mjs` run BEFORE or AFTER `assert-no-pdf-preload.mjs` in the `package.json` build script? Either ordering works (both are post-build assertions); recommend AFTER so the modulepreload check (cheap regex on one file) fails fast before the more expensive multi-file scan.
2. **Test data for the parity sanity check (if any)** — D-04 says no Vitest parity test. If the planner disagrees and wants belt-and-suspenders coverage, a single `it()` in `costCalc.test.ts` asserting `calculateTax(29.99, 13).taxAmount === 3.90` is a 3-line addition. Planner discretion.

## Scope creep guards

If the user during planning or execution suggests any of the following, redirect to deferred ideas above:
- REQUIREMENTS.md text revisions for CUST-01/CUST-02/ETSY-01
- VALIDATION.md backfill for any phase
- Phase 15.1 deferred items M (row centering) or N (CSV template download)
- Phase 13 wrap-up UAT
- Refactoring tax math beyond the PrintQuoteModal:196 fix
- Adding a Rollup plugin

If a scope-creep request can't be redirected and the user insists: stop, surface the conflict, and ask whether to (a) defer and continue Phase 17 as scoped, (b) extend Phase 17 scope (and re-run plan-phase), or (c) split into a follow-up Phase 18.

## What's next

After this CONTEXT.md commits:
- `/gsd:plan-phase 17` — planner authors plans for the 4 tasks (Rollup reorder + new CI gate + tax fix + housekeeping). Expected: 1 plan with 4 tasks OR 2 plans across 2 waves (Wave 1 = code fixes; Wave 2 = housekeeping after code lands).
- `/gsd:execute-phase 17` — implements.
- After Phase 17 closes gap-free: `/gsd:complete-milestone v1.2` → archive milestone, tag `v1.2.0`, trigger desktop release pipeline.

The fix is bounded. Estimate: ≤ 1 hour of executor work + verification.

---

*Phase: 17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd*
*Context gathered: 2026-05-25 via /gsd:discuss-phase 17*
