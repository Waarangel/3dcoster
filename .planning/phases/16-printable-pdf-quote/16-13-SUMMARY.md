---
phase: 16-printable-pdf-quote
plan: "13"
status: complete
gap_closure: true
gap_ids: [A, B, C, D, E, F, G, H]
decisions: [D-13, D-14, D-15, D-16, D-17, D-18, D-19, D-20, D-21, D-22, D-23, D-24, D-25, D-26, D-27, D-28, D-29, D-30, D-31, D-32]
executed: 2026-05-23T20:45:00Z
executed_by: orchestrator-inline + human-uat
key-files:
  modified:
    - .planning/phases/16-printable-pdf-quote/16-VERIFICATION.md
---

# 16-13 SUMMARY — UAT verification + second-extension closure

## Goal achieved

Plan 16-13 closes Phase 16 with all 12 user-facing gaps (A–L) resolved
across two extension cycles. The original 8 gaps (A–H) were closed by
plans 16-06..16-12. UAT against the live app surfaced 6 more findings;
gaps I, J, K, L resolved via the second-extension 5-commit inline pass
(D-23..D-32); M and N punted to Phase 15.1 backlog (out of scope).

**Final UAT verdict:** *"this is perfect. Approved."*

## Task outcomes

### Task 1 — Automated chain (PASS)

All 18 original static audits passed at the expected values, plus 8
second-extension audits. Full build chain (lint-no-raw-html, assert-no-
static-jspdf, vitest --coverage, tsc -b, vite build, assert-bundle-size,
assert-no-pdf-preload) exits 0. Test suite: 235 passed, 1 todo, 0 failed
(was 177 pre-gap-closure).

See [16-VERIFICATION.md § Gap-Closure Verification](.planning/phases/16-printable-pdf-quote/16-VERIFICATION.md) for the full audit table.

### Task 2 — Human UAT (PASS via iterative reframe)

The original UAT script (14 scenarios — 7 adapted + 7 new) was effectively
collapsed into a single live demo session: the user ran scenarios against
`npm run dev`, surfaced gaps I–N, articulated a fundamental UX reframe
("ultimately this is a print cost app"), iterated through the design with
the orchestrator including a research-backed proposal, locked the new
model in CONTEXT extension 2 (D-23..D-32), and approved the resulting
implementation.

The 14-scenario script from the original plan is therefore obsolete — the
final implementation differs substantially from what scenarios 1-7 + E1-E7
were written against (e.g. no more separate "Recent Quotes" section, no
more Mark Accepted button, Convert flow + Decline modal restructured). The
live-demo verdict supersedes scenario-by-scenario record-keeping.

### Task 3 — 16-VERIFICATION.md updated (PASS)

Frontmatter flipped to `status: gaps_closed`, `score: 5/5`. All 8 original
gaps (A–H) tagged with their `resolved_by` plans (16-06..16-12). All 4
new Phase 16 gaps (I, J, K, L) tagged with the second-extension commit
SHAs. M and N retain their "Phase 15.1 follow-up" deferred status.

New "Gap-Closure Verification (2026-05-23 evening — second extension)"
section appended with: 18+8 audit table, UAT verdict transcript,
D-13..D-32 decision coverage, requirement status table, next-step
routing.

## Final state

| Surface | Result |
|---------|--------|
| CostCalculator | No Generate PDF button (D-13) |
| JobsManager action row | Record Sale (green) > **Print Quote (blue)** > Edit (ghost+border) > Delete (red-tinted) — D-31 visible-hierarchy fix |
| Per-job "Orders" section | Single merged timeline (D-23): Pending/Declined Quote rows above Sale rows; Converted Quotes don't appear separately (D-26) |
| Quote statuses | 3 user-facing pills: Pending (amber), Sale (green — via Sale row), Declined (slate) — D-24 |
| Pending Quote row | `[Convert to Sale]` primary + `[⋯]` overflow (Edit Quote / Mark Declined) — D-25 + D-29 |
| Declined Quote row | `[Reopen]` + `Reason: {text}` sub-line when declineReason is set — D-28 |
| Sale row from converted Quote | Plain text subtext `from Q-NNNN · Quoted N days ago` (NOT clickable) — D-30 |
| PrintQuoteModal | Create + Edit modes; edit re-downloads PDF, no counter bump — D-27 |
| DeclineQuoteModal | Free-form optional reason via Textarea, follows project's confirm-modal convention — D-28 |
| Customer picker | Now finds Sale-only customers via one-time backfill on app load — D-32 (gap K fix) |
| Quote schema | `Quote.declineReason?` added; `RuntimeQuoteStatus` narrowed to `sent \| declined \| converted` (compile-time refuses `draft` AND `accepted` at all runtime write sites) |
| Test suite | 235 passed, 1 todo (rollback for D-20 punted to integration coverage) |
| Build chain | All 7 gates exit 0 |
| Bundle | Main 57.7 KB gz (< 300 gate); PDF chunk 77.79 KB gz lazy-loaded |

## Commits — full chronology

**Plans 16-06..16-12 (first extension — gaps A–H):**
- 16-06: refactor(16-06) × 2 + docs — remove CostCalculator Generate PDF surface
- 16-07: feat + docs — rename to Print Quote (with original secondary styling)
- 16-08: test(RED) + fix(GREEN) + docs — D-21 tax-fallback fix
- 16-09: 4 commits — Quote types + backfill + Dexie v8 + generateQuotePdf refactor
- 16-10: feat + docs — PrintQuoteModal + JobsManager rewire + App.tsx counter helper removed
- 16-11: feat + test + docs — Recent Quotes section + status pills (later restructured)
- 16-12: feat + test + docs — Convert to Sale atomic transaction

**Second extension (gaps I, J, K, L):**
- `eb0d128` feat(16-ext2): narrow RuntimeQuoteStatus + add Quote.declineReason
- `0d15501` feat(16-ext2): PrintQuoteModal edit mode
- `b18e2dd` feat(16-ext2): DeclineQuoteModal
- `76afd8d` feat(16-ext2): merge per-job Orders section + remove Mark Accepted + restyle Print Quote
- `5f25d6b` feat(16-ext2): backfillCustomersFromSales (gap K)
- (this SUMMARY commit closes the plan)

## Decision coverage

20 decisions across two extension cycles:
- D-13..D-22: first extension (UAT-driven gap-closure for A–H)
- D-23..D-32: second extension (post-UAT reframe for I–L)
- D-33: deferred to v1.3 (search bar on Orders)

See [16-CONTEXT.md § Second extension](.planning/phases/16-printable-pdf-quote/16-CONTEXT.md) for the full decision audit trail.

## Out of scope (deferred to Phase 15.1 backlog or v1.3)

- **M** (Phase 15.1): Customer Library "Last used" not vertically centered (CSS polish on CustomerLibrary.tsx)
- **N** (Phase 15.1): CustomerCsvImportModal missing template download button (mirror CsvImportModal.tsx:265-283)
- **D-33** (v1.3): Search bar on per-job Orders section (research-recommended once typical list > 10 rows)

## Self-Check: PASSED

All success criteria from the plan met. Phase 16 ready for `/gsd:phase-close 16`.
Phase 16 was the last phase in v1.2 "Quote-to-Customer" milestone — milestone-close routing applies next.
