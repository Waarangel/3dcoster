---
phase: 17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd
type: discussion-log
gathered: 2026-05-25
---

# Phase 17: Discussion Log

Closure phase surfaced by `.planning/v1.2-MILESTONE-AUDIT.md` (commit 95ddae6). Scope established by the audit; discussion focused on HOW to fix the two findings + which housekeeping to fold in.

## Pre-discussion analysis (Claude)

Scouted `vite.config.ts:80-105` and confirmed the audit's root-cause description was incomplete. Actual cause: the `manualChunks` function checks `if (id.includes('node_modules'))` FIRST and returns `'vendor'` for any match. The `/jspdf/` + `/jspdf-autotable/` + `/src/pdf/` check is positioned AFTER and therefore never fires for jspdf (which lives in node_modules). Reordering the checks routes jspdf to `'pdf'` correctly. This narrowed Q1's options.

Also scouted `scripts/assert-no-pdf-preload.mjs` and `src/utils/costCalc.ts:124-136` (`calculateTax` helper) to confirm the proposed fixes are surgical.

## Gray areas presented (4 questions, 1 AskUserQuestion call after initial 5-question batch was rejected as too many)

### Q1: Rollup chunk fix — which approach for vite.config.ts?

Options presented:
- **A. Reorder: PDF check FIRST (Recommended)** — Move `/src/pdf/` + `/jspdf/` + `/jspdf-autotable/` check above the `node_modules` block. Surgical ~5-line reorder.
- B. Special-case inside node_modules block — same effect, check `/jspdf/` before the `return 'vendor'`.
- C. Switch to manualChunks object form — declarative, heavier rewrite.

**User selected:** A (Reorder, PDF check first). → Captured as D-01.

### Q2: CI gate tightening — close the assert-no-pdf-preload.mjs blind spot how?

Options presented:
- **A. Add NEW script assert-no-static-pdf-import.mjs (Recommended)** — Scan dist/assets/*.js for static `import "*pdf*"` patterns. Sibling to existing script. Two narrow scripts beat one fat script.
- B. Extend assert-no-pdf-preload.mjs to also scan route chunks — one script does both, rename.
- C. Build-time Rollup plugin — catch at build time. Heavier change.

**User selected:** A (Add new sibling script). → Captured as D-02.

### Q3: Tax rounding fix in PrintQuoteModal — how invasive?

Options presented:
- **A. Call calculateTax directly (Recommended)** — Replace inline math at PrintQuoteModal.tsx:196 with `calculateTax(subtotal, resolvedTax.rate).taxAmount`. ~2-line diff.
- B. Direct call + add a Vitest parity test.
- C. Centralize tax math at Quote-creation time (architectural refactor).

**User selected:** A (Direct call). → Captured as D-03 + D-04 (no parity test).

### Q4: Housekeeping fold-in — multi-select

Options presented:
- **A. Tick REQUIREMENTS.md checkboxes (DUP-02, PDF-01..05) (Recommended)** — Trivial Edit.
- **B. Update ROADMAP.md Phase 16 progress row (Recommended)** — Trivial Edit.
- C. Update REQUIREMENTS.md text for CUST-01/CUST-02/ETSY-01 to reflect D-21..D-24 reversal — Bounded but heavier.
- D. Backfill missing VALIDATION.md for Phase 13/15/15.1 — Different workflow, expands scope.

**User selected:** A + B ("tick requirements and update roadmap"). C and D explicitly excluded. → Captured as D-05 + D-06; C deferred per D-07; D deferred per D-08.

## Outcomes

All four answers aligned with the recommended option(s). No scope creep raised by the user. Discussion took ~1 round (single AskUserQuestion call after initial 5-question batch was reformulated to 4).

CONTEXT.md captures decisions D-01 through D-08. Next: `/gsd:plan-phase 17`.

## Scope creep guards added to CONTEXT.md

Six items listed as "redirect to deferred ideas" if raised during planning or execution:
- REQUIREMENTS.md text revisions for CUST-01/CUST-02/ETSY-01
- VALIDATION.md backfill for any phase
- Phase 15.1 deferred items M (row centering) or N (CSV template download)
- Phase 13 wrap-up UAT
- Tax math refactoring beyond PrintQuoteModal:196
- Adding a Rollup plugin
