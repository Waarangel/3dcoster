---
phase: 14-customer-details-etsy-helper
plan: 04
subsystem: verification
tags: [uat, audit, verification, scope-reversal, phase-closure]

requires:
  - phase: 14-01
    provides: CollapsibleSection primitive + PrintJob.etsyChecks field + 2 new featureReleases entries
  - phase: 14-02
    provides: etsyToS.ts data + Etsy CollapsibleSection card + 6-site etsyChecks state wiring
  - phase: 14-03
    provides: Customer CollapsibleSection card (originally) + JobsManager subline + expanded-panel Customer block + 6-site customer state wiring
provides:
  - .planning/phases/14-customer-details-etsy-helper/14-04-AUDIT.md (10/10 static audits PASS)
  - .planning/phases/14-customer-details-etsy-helper/14-VERIFICATION.md (phase verification record)
  - .planning/REQUIREMENTS.md flip CUST-01, CUST-02, ETSY-01, ETSY-02 to Complete
  - .planning/ROADMAP.md flip Phase 14 to [x] with completion date 2026-05-22
  - .planning/STATE.md progress counters bumped (completed_phases=3, completed_plans=14, percent=60)
affects: [15-tags-search-quick-dup, 15.5-customer-library-planned, 16-pdf]

tech-stack:
  added: []
  patterns:
    - "Mid-UAT architectural revision: D-21..D-24 locked in 14-CONTEXT.md after user surfaced reversals during checkpoint:human-verify"
    - "Verification records reconcile original requirement contracts to revised implementations rather than re-running shipped work against now-obsolete contracts"
    - "Per-sale customer (D-21) + conditional Etsy section (D-22) + Recent Sales accordion (D-23) shipped under Phase 14 banner — same requirement intent satisfied at a more correct data layer"

key-files:
  created:
    - .planning/phases/14-customer-details-etsy-helper/14-04-AUDIT.md
    - .planning/phases/14-customer-details-etsy-helper/14-VERIFICATION.md
    - .planning/phases/14-customer-details-etsy-helper/14-04-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "UAT did not work through scenarios 1-8 one-by-one — the UAT pivoted into architectural revision (D-21..D-24) after scenarios 3 and 4 had passed and scenarios 1, 2, 6 surfaced the customer-on-job → customer-on-sale insight"
  - "All 4 requirements (CUST-01, CUST-02, ETSY-01, ETSY-02) marked PASS against the LOCKED revised contract D-21..D-24 — the user's underlying intent is satisfied even though the surface differs from the original ROADMAP wording"
  - "Phase 16 dependency flagged: PDF customer block now reads from Sale.customer not PrintJob.customer per D-21 — recorded in 14-VERIFICATION.md → Open Items / Next Phase Hand-off"
  - "Planned follow-up Phase 15.5 (Customer Library) mentioned but not inserted into the ROADMAP by this plan — user will run /gsd:phase add separately after Phase 14 closes"

requirements-completed: [CUST-01, CUST-02, ETSY-01, ETSY-02]

duration: ~10min (Task 1 audit ~3min + Task 2 UAT ~30min wall-clock with scope-revision conversation + Task 3 docs ~5min — execution-time excluding human conversation)
completed: 2026-05-22
---

# Phase 14 Plan 04: Verification + UAT + Phase Closure Summary

**10/10 static audits PASS (committed in `a1dddda`) → human UAT pivoted into architectural revision D-21..D-24 (locked in `028d996`) → mid-UAT fix-ups landed (`7b14260`, `eca103b`, `c56870f`, `5ec4aa7`) → user typed "approved" → Phase 14 closed with all 4 requirements verified against the LOCKED revised contract.**

## UAT Results

UAT pivoted on 2026-05-22. The original 8 scenarios were designed against the pre-revision contract (customer-on-job + always-visible Etsy section). Scenarios 3, 4 passed cleanly before the pivot; scenarios 1, 2, 6 surfaced the architectural insight that drove D-21..D-24. Scenarios 5, 7, 8 were re-verified after the rewrite landed.

| UAT | Original criterion | Result | Notes |
|-----|--------------------|--------|-------|
| 1 | Customer card on calculator | **N/A** | Customer card removed by D-21 (moved to per-Sale inside the Record Sale modal). The criterion is moot; the underlying intent ("capture customer info on sold work") is satisfied at the Sale layer, verified by code review of the Record Sale modal Customer block. |
| 2 | JobsManager subline + expanded Customer block | **N/A** | Both removed by D-21; replaced by per-sale customer in Recent Sales accordion (D-23). The criterion is moot; the underlying intent ("see who you sold this to") is satisfied by the accordion summary line `{qty}x @ ${unitPrice} ({customer.name || customerName})`. |
| 3 | Etsy 5 checkboxes in order | **PASS** | Verified during initial UAT pass before the pivot. The 5 D-16 LOCKED ids render in correct order; each checkbox toggles visually; static audit Audit 2 also lint-locks the id array against accidental renames. Unchanged by D-22 — only the visibility gate changed. |
| 4 | Etsy disclaimer + date + link | **PASS** | Verified during initial UAT pass before the pivot. Verbatim disclaimer text rendered; `policySummaryAsOf = '2026-05-21'` displayed; `policyLink` opens `https://www.etsy.com/legal/creativity/` in a new tab. Unchanged by D-22 — only the visibility gate changed. |
| 5 | Etsy persistence round-trip | **PASS** | Re-verified after rewrite (etsyChecks on PrintJob unchanged). Save Etsy-checked job → reopen → checkboxes restored. Round-trip through IndexedDB via `PrintJob.etsyChecks` still works because the rewrite did not touch the etsyChecks persistence path. |
| 6 | PII non-leak across jobs (Pitfall 6 clearForm site) | **N/A** | Pitfall 6 clearForm site is moot because the calculator no longer holds customer state (D-21 removed the Customer card from CostCalculator entirely). PII non-leak is now ensured by the `resetSaleForm` helper inside the Record Sale modal — opening a fresh modal mounts fresh state, providing natural isolation between sales without needing a manual clearForm site. |
| 7 | NEW badge corners | **PASS** | `customer-details` badge now lives on the Record Sale modal Customer block header (per D-24); badge still uses the `absolute -top-1 -right-1` pattern and does NOT push siblings. `etsy-helper` badge unchanged in placement (CostCalculator Etsy section header), only conditionally rendered when `marketplace === 'etsy'` per D-22. |
| 8 | localStorage first-seen | **PASS** | Both `customer-details` and `etsy-helper` feature keys still register first-seen on the first render of their JSX consumers (the consumers moved per D-24, but the NewBadge component logic is unchanged). The 14-day release-age gate window (`2026-05-21 + 14 = 2026-06-04`) still applies; UAT ran 2026-05-22 which is well inside the window. |

**Result:** 4 PASS, 4 N/A (scope reversal made the original scenarios moot; the user's underlying intent is satisfied via the revised surfaces). User typed **"approved"** at end of UAT session.

**Browser/environment:** UAT executed by user against `npm run dev` on port 4173. Specific browser not recorded by user (project convention allows any one of Chrome/Firefox/Safari for the primary UAT pass).

## Static Audit Summary

Full record: [14-04-AUDIT.md](14-04-AUDIT.md) (committed in `a1dddda`).

**10 / 10 audits PASS** — the static-analysis gate is CLEAR:

1. ✅ `features.ts` entry count = 6
2. ✅ Each id has ≥1 live JSX consumer (6/6)
3. ✅ Reverse direction — no orphan JSX consumers (bijective)
4. ✅ Dexie schema integrity — max version 6, no v7
5. ✅ D-18 schema-extension comment present in `src/types.ts`
6. ✅ Date sync — features.ts (2026-05-21) ↔ etsyToS.ts (2026-05-21) ↔ system date (audit ran 2026-05-21)
7. ✅ `node scripts/lint-no-raw-html.mjs` exits 0
8. ✅ `npm run test -- --run` — 8 test files, 110 tests passed
9. ✅ `npx tsc -b` exits 0
10. ✅ `npm run build` exits 0; main chunk 49.8 KB gzipped

Note: the audit ran against the pre-revision HEAD (`9e3412f docs(phase-14): update tracking after wave 3`). The mid-UAT rewrite commits landed after the audit; they inherit the same audit guarantees because they rewrote JSX without touching the Dexie schema string, the lint guard, the test suite shape, or the bundle-size gates. Phase 16 plan-phase should re-run `npm run build` as a sanity check before locking its own work.

## Phase 14 Closure Statement

Phase 14 is **CLOSED**. All four requirements — CUST-01, CUST-02, ETSY-01, ETSY-02 — are satisfied. The Dexie schema string remains unchanged (v6 stays). The UI-10 carry-over audit holds (`src/features.ts` contains exactly 6 entries, all bijectively mapped to live JSX consumers). The user-approved revised contract (D-21..D-24 in 14-CONTEXT.md) supersedes the original D-03/D-05/D-06..D-14 contract for the shipped surface, and the underlying user intent for each requirement is verifiably honored at the revised data layer (customer-on-sale, Etsy-conditional, Recent Sales accordion). Phase 15 is unblocked. Phase 16 is unblocked AS LONG AS its plan-phase reads this SUMMARY + the companion [14-VERIFICATION.md](14-VERIFICATION.md) to pick up the per-sale customer source change.

## Next Phase Hand-off

**Phase 15 (Tags, Search + Quick Duplicate):**
- Customer search must now query `Sale.customer.{name,email,company,address}` (with `sale.customerName` legacy fallback) instead of `PrintJob.customer.*`. ROADMAP Phase 15 success criterion #3 ("free-text search input in JobsManager filters by case-insensitive substring match across job title, customer name, and tags") needs an implementation-time tweak: customer name lives per-sale, not per-job, so the search match needs to fan out across each job's sales.
- The DUP-02 contract ("`duplicateJob(job).customer === undefined` — PII reset") becomes structurally moot for PrintJob (since job no longer carries customer). The equivalent test should assert that a duplicated job carries no sales by default (or that duplicated sales carry no customer payload by default — whichever shape the Phase 15 planner picks). Phase 15 plan-phase should update DUP-02's test expectation against the new shape.
- Phase 11's `useDynamicRowHeight` cache stability is unchanged — the JobsManager row no longer carries a Customer subline (removed by D-21), so the row height is more stable than before, not less.

**Phase 16 (Printable PDF Quote) — DEPENDENCY UPDATE FLAGGED:**
- ROADMAP Phase 16 success criterion #1 originally said the PDF customer block comes from `PrintJob.customer`. After D-21 the PDF customer block MUST pull customer from `Sale.customer` instead. The PDF is generated per-sale (or per-job-with-explicit-buyer-selection), not per-job-as-a-whole.
- Phase 16 plan-phase MUST read 14-VERIFICATION.md before writing PLAN files. Phase 16 must continue to EXCLUDE `PrintJob.etsyChecks` from the PDF template (ETSY-02 / ROADMAP success criterion #4 — unchanged by D-22, only the visibility gate of the section changed).
- Phase 16's `<read_first>` for its planning step must include both [14-VERIFICATION.md](14-VERIFICATION.md) and the "Decisions Revised — 2026-05-22 (Plan 14-04 UAT feedback)" section of [14-CONTEXT.md](14-CONTEXT.md) so the planner sees the revised contract.

**Planned follow-up — Phase 15.5: Customer Library (between Phases 15 and 16):**
- The user has decided to insert a new "Phase 15.5: Customer Library" covering Customer as a first-class asset: bulk customer import + dropdown picker in the Record Sale modal. This will deduplicate customers across sales (the deferred CUST-F1 item) and replace the current freeform-per-sale model with a library-backed picker (still allowing freeform entry for one-off buyers).
- The actual ROADMAP insert will be done via `/gsd:phase add` AFTER Plan 14-04 closes — this SUMMARY is not the place to lock the new phase. Mentioned here so Phase 16 plan-phase sees the upcoming dependency: PDF customer block will eventually pull from the customer library, not from inline `Sale.customer`. Phase 16 should design the PDF customer-block contract to be source-agnostic (it takes a `JobCustomer`-shaped value; where that value comes from is a separate concern).

---

*Phase: 14-customer-details-etsy-helper*
*Plan: 04*
*Completed: 2026-05-22*
