---
phase: 14-customer-details-etsy-helper
verified: 2026-05-22T12:51:30Z
status: passed
score: 4/4 requirements verified — 5/5 roadmap criteria verified (1, 2 satisfied via revised UI per D-21; 3 via revised gating per D-22)
verified_by: human-uat + static-audit
re_verification: null
gaps: []
deferred: []
human_verification:
  - user typed "approved" after mid-UAT scope reversal (D-21..D-24) was applied and re-verified in the same session
notes:
  - "Implementation differs from the original ROADMAP wording for CUST-01/CUST-02 and ETSY-01 because the user surfaced architectural reversals during UAT. Decisions D-21..D-24 in 14-CONTEXT.md are LOCKED and supersede D-03/D-05/D-06..D-14 for the shipped surface. The underlying requirement intent (capture customer info on sold work; gate Etsy noise to Etsy sellers) is still satisfied — see Requirement Verification table for the per-requirement reconciliation."
---

# Phase 14: Customer Details + Etsy Helper Verification Report

**Phase Goal:** Users can attach customer details to sold work, see customer name on the saved-job surface, and check their Etsy compliance from the same screen — with stale NewBadge entries cleaned up.

**Verified:** 2026-05-22T12:51:30Z
**Status:** PASSED (with locked scope revision — see Requirement Verification table)
**Re-verification:** No — initial verification

---

## Requirement Verification

Each requirement was originally contracted against the ROADMAP wording (which assumed customer-on-job + always-visible Etsy section per D-03/D-05/D-06..D-14). During Plan 14-04 Task 2 UAT on 2026-05-22 the user surfaced three architectural reversals which are now LOCKED at D-21..D-24 in [14-CONTEXT.md](14-CONTEXT.md). The shipped implementation reflects D-21..D-24, not the superseded originals. The reconciliation column below explains why each requirement's intent is still satisfied.

| Requirement | Original contract (REQUIREMENTS.md) | Verification method | Result | Reconciliation against revised scope |
|-------------|-------------------------------------|---------------------|--------|--------------------------------------|
| **CUST-01** | "User can attach optional customer details (name, email, address, optional company name) to a saved job via a collapsible 'Customer' section on the cost calculator" | Code review + UAT scenarios 1, 2, 6, 7 (originally targeted the CostCalculator Customer card; rerun against the Record Sale modal Customer block per D-21) | **PASS — implementation per D-21 (customer-on-sale, not customer-on-job)** | The Customer CollapsibleSection was removed from `src/components/CostCalculator.tsx` (eca103b). The Record Sale modal in `src/components/JobsManager.tsx` now grows a 4-field Customer block (Name + Email + Company + Address) per sale, surfaced via the same `customer-details` NewBadge (D-24). The user's underlying intent — "capture customer info for jobs you sell" — is still satisfied, at the Sale level instead of the Job level. The data-model fit is actually better: a single PrintJob can be sold to multiple buyers, and customer-on-job lost N-1 buyers per multi-sale job. New sales write `sale.customer = {name?, email?, company?, address?}` only when at least one field is non-empty (no empty-object pollution); reads fall back to `sale.customerName` for legacy rows. Implementation lives at [src/components/JobsManager.tsx](src/components/JobsManager.tsx) Record Sale modal block. |
| **CUST-02** | "Customer name + email display on the saved-job row in JobsManager; full address is visible on the PDF only" | Code review + UAT scenarios 2, 5 (rerun against Recent Sales accordion per D-23) | **PASS — implementation per D-21 + D-23 (per-sale customer surfaced in Recent Sales accordion, not on the job row)** | The job-row subline that originally rendered `Name · Email` was removed when the Customer card moved off the job (D-21). The Recent Sales accordion (D-23, commit eca103b + c56870f) renders one `<details>` per sale; the `<summary>` line reads `{qty}x @ ${unitPrice} ({customer.name || customerName})`; expanding the row reveals Name / Email / Company / Address with `whitespace-pre-line` on the address. Address still does NOT appear on any collapsed-by-default surface — it lives only in the expanded accordion body (a seller-private view) and will be rendered on the PDF (Phase 16 — see Next Phase Hand-off below for the dependency-update note). Legacy rows with `customerName` only render the legacy name in both summary and expanded body. Implementation lives at [src/components/JobsManager.tsx](src/components/JobsManager.tsx) Recent Sales `<details>` block. |
| **ETSY-01** | "User sees an 'Etsy compliance' collapsible section on the cost calculator with a checklist sourced from `src/data/etsyToS.ts`" | Code review + UAT scenarios 3, 5 + static audit Audit 2 (etsyToS shape + 5 LOCKED ids) | **PASS — implementation per D-22 (section is now conditional on `marketplace === 'etsy'`; checklist content + persistence unchanged)** | Same 5-item D-16 checklist, same per-item check state, same `PrintJob.etsyChecks?: Record<string, boolean>` persistence shape. Only difference vs. the original contract: the section is wrapped in `{marketplace === 'etsy' && (<CollapsibleSection ...>)}` so non-Etsy sellers never see the noise. The user IS the source of truth for marketplace; gating on that field surfaces compliance content only when it applies. Etsy persistence round-trip (UAT 5) verified after the rewrite: `etsyChecks` on PrintJob remains the persistence path, no schema change required. Implementation lives at [src/components/CostCalculator.tsx](src/components/CostCalculator.tsx) Etsy CollapsibleSection block. |
| **ETSY-02** | "The Etsy section displays a `policySummaryAsOf` date and a direct link to `https://www.etsy.com/legal/creativity/`; the checklist content does NOT render on the customer PDF" | Code review + UAT scenario 4 + static audit Audit 5 (date sync) + Audit 4 (no PDF code wired) | **PASS — unchanged by D-22** | The verbatim disclaimer text "Etsy's policies change — this is a reminder, not legal advice." + the `policySummaryAsOf = '2026-05-21'` date + the live `policyLink = 'https://www.etsy.com/legal/creativity/'` are all rendered as originally specified. Only the visibility gate changed (D-22); when the section IS shown, every original element is present. No PDF code is wired by Phase 14 — the ETSY-02 PDF-exclusion contract is structurally upheld by absence. Phase 16 must continue to exclude `etsyChecks` from its PDF template. |

**Score:** 4/4 requirements PASS. All four implementations honor the user's underlying intent; the surface placement was revised mid-UAT and the revisions are LOCKED.

---

## ROADMAP Success Criteria

Each criterion is verified against the LOCKED revised contract (D-21..D-24), not the original wording. The "Reconciliation" column maps the criterion's intent to the shipped surface.

| # | Original criterion text | Verification method | Result | Reconciliation against revised scope |
|---|-------------------------|---------------------|--------|--------------------------------------|
| 1 | "A collapsible 'Customer' section on the cost calculator accepts name, email, address (freeform), and optional company name; all fields are optional and the section is collapsed by default" | UAT scenario 1 + code review (CostCalculator Customer card REMOVED by D-21) | **PASS — implementation per D-21** | The collapsible Customer section now lives in the Record Sale modal (per-sale, D-21) instead of the cost calculator (per-job, original). All four fields (Name / Email / Company / Address) remain optional and freeform. The modal section is collapsed-by-default behavior is moot because the entire Record Sale modal is itself a modal that the user explicitly opens — there's no "always-visible above the fold" state to collapse. The user's underlying intent ("capture customer info for sold jobs") is satisfied at the more correct data layer. |
| 2 | "Customer name and email are visible on the saved-job row in JobsManager; full address appears only on the PDF (Phase 16)" | UAT scenario 2 + code review (job-row Name · Email subline REMOVED by D-21; replaced by per-sale customer in Recent Sales accordion per D-23) | **PASS — implementation per D-21 + D-23** | Customer name (per-sale) now surfaces in the Recent Sales accordion summary line `{qty}x @ ${unitPrice} ({customer.name || customerName})`. The PDF (Phase 16) will still be the only surface that renders full address to the customer, satisfying the "PDF only" intent. See Next Phase Hand-off below for the Phase 16 dependency update — PDF must now pull customer from `Sale.customer` instead of `PrintJob.customer`. |
| 3 | "A collapsible 'Selling on Etsy?' section on the cost calculator displays the `EtsyToSHelper` checklist sourced from `src/data/etsyToS.ts`; each checklist item is checkable by the user for self-review purposes" | UAT scenarios 3, 5 + static audit Audit 2 (etsyToS test locks the 5 D-16 ids against accidental renames) | **PASS — implementation per D-22 (conditional on `marketplace === 'etsy'`)** | Same checklist, same checkboxes, same per-item persistence. Only the visibility gate changed: the section now only renders when the user has selected Etsy as their marketplace. Self-review value is preserved for the audience that needs it; noise is suppressed for everyone else. |
| 4 | "The Etsy section displays a `policySummaryAsOf` date and a live link to `https://www.etsy.com/legal/creativity/`; a prominent disclaimer reads 'Etsy's policies change — this is a reminder, not legal advice'; the checklist items do NOT appear on the customer PDF" | UAT scenario 4 + static audit Audit 5 (date sync verbatim) + static audit Audit 4 (no PDF code touches `etsyChecks` because no PDF code exists yet) | **PASS — unchanged by D-22 (only the gating changed)** | All three sub-conditions verified: `policySummaryAsOf = '2026-05-21'` rendered alongside the live `policyLink`; verbatim disclaimer present at the top of the body; zero PDF wiring touches `etsyChecks` (Phase 14 ships no PDF code — Phase 16 owns that surface and is forbidden from including the field). |
| 5 | "UI-10 has been completed by Phase 13 (CONTEXT D-17 fold-in); Phase 14 verifies the audit holds — `src/features.ts` still contains only the 4 fresh entries Phase 13 left, and no new stale `<NewBadge>` JSX has been introduced. If Phase 13's audit was complete, this criterion is a no-op verification step." | Static audits 1, 2, 3 in [14-04-AUDIT.md](14-04-AUDIT.md) | **PASS — 6/6 bijective mapping confirmed; UI-10 baseline holds** | `src/features.ts` contains exactly 6 entries (4 Phase 13 + 2 Phase 14 = `customer-details` + `etsy-helper`). Each id has exactly one live JSX consumer (verified bijectively in Audit 3). After D-24, the `customer-details` consumer is now in `src/components/JobsManager.tsx` (Record Sale modal Customer header) instead of `src/components/CostCalculator.tsx`; the `etsy-helper` consumer stays in `src/components/CostCalculator.tsx` but is rendered conditionally on marketplace (D-22). Both `featureReleases` dates remain `2026-05-21` so the 14-day NEW window is shared across the original and revised UI placements. No stale `<NewBadge>` JSX introduced. |

**Score:** 5/5 ROADMAP criteria PASS. Criteria 1, 2, 3 satisfied via revised surfaces (D-21, D-22, D-23); criteria 4, 5 unchanged.

---

## Static Audit Results

Full audit record: [14-04-AUDIT.md](14-04-AUDIT.md) (committed in `a1dddda`).

| # | Audit | Result | Notes |
|---|-------|--------|-------|
| 1 | `features.ts` entry count | **PASS** | exactly 6 (`grep -cE "^\s*'[a-z-]+': new Date\(" src/features.ts` → `6`) |
| 2 | Each id has ≥1 JSX consumer | **PASS** | 6/6 ids resolve to exactly 1 JSX consumer (line table in audit) |
| 3 | Reverse direction — no orphan JSX consumers | **PASS** | 6 unique JSX-consumer ids match the 6 registry ids bijectively |
| 4 | Dexie schema integrity | **PASS** | Max version is 6; v6 stores call byte-identical to pre-Phase-14 (jobs: `'id, name, createdAt, printerInstanceId'`). See "Schema State" below for the verbatim block. |
| 5 | D-18 schema-extension comment | **PASS** | Both "Phase 14 — D-18" and "Schema-extension note" cited verbatim above the `etsyChecks?: Record<string, boolean>` line in `src/types.ts` |
| 6 | Date sync (features.ts vs. etsyToS.ts) | **PASS** | All 3 dates exactly `2026-05-21`; zero-day drift; not future-dated relative to system date at audit time |
| 7 | `node scripts/lint-no-raw-html.mjs` | **PASS** | exit 0; `lint:no-raw-html passed` |
| 8 | `npm run test -- --run` | **PASS** | 8 test files, 110 tests passed; `tests 110 passed (110)` |
| 9 | `npx tsc -b` | **PASS** | exit 0; pre-existing worktree-environmental errors resolved at audit time |
| 10 | `npm run build` | **PASS** | exit 0; main chunk **49.8 KB gzipped** (under the 300 KB Phase 11 gate) |

**Static-analysis gate: 10 / 10 PASS — CLEAR.**

The audit ran against the originally-shipped 14-01/02/03 implementation (HEAD `9e3412f docs(phase-14): update tracking after wave 3` at audit time). The mid-UAT rewrite landed AFTER the audit (commits `7b14260`, `eca103b`, `028d996`, `c56870f`, `5ec4aa7`), so the audit numbers reflect the pre-revision surface. The 6 features.ts ids, the bijective JSX-consumer mapping, the Dexie schema integrity, and the date sync all remain valid post-revision — the JSX consumers moved (D-24) but the registry shape did not change.

---

## Schema State

Dexie remains on v6 — no migration was needed for the per-sale customer (Sale.customer extension follows the same Phase 12 D-02 / D-07 precedent as PrintJob.etsyChecks). The v6 stores call is byte-identical to pre-Phase-14:

```typescript
// v6: backfill tags=[] for Phase 15; all other new fields stay undefined (read-side fallback handles them)
// Schema strings IDENTICAL to v5 — no multi-entry index on tags per D-04
db.version(6).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(backfillTagsOnJob);
});
```

Verified by `grep -nE "db\.version\([0-9]+\)\.stores" src/db/database.ts` returning lines for v1–v6 only (no v7). The `sales` table primary key is `id` with secondary indexes `jobId, soldAt` — `Sale.customer` (added per D-21) is a non-indexed optional field, mirroring how `PrintJob.etsyChecks` was added in Plan 14-01 (D-18). The `PrintJob.customer` field added in Phase 12 remains in the type but is now `@deprecated` for forward writes; existing PrintJob records that pre-date D-21 retain their customer payload and remain readable.

Phase 16's PDF generator will read customer data from `Sale.customer` (with `sale.customerName` legacy-read fallback), NOT from `PrintJob.customer`. See Next Phase Hand-off below.

---

## Threat Model Closure

### From Plan 14-01 (CollapsibleSection + types + features.ts)

| Threat ID | Category | Disposition | Rationale |
|-----------|----------|-------------|-----------|
| T-14-01-* | Tampering / XSS via children prop | **Accepted — no mitigation needed** | `<CollapsibleSection>` renders `children: ReactNode` via React's auto-escaping JSX path; no `dangerouslySetInnerHTML` introduced. |
| T-14-01-SC | npm install legitimacy | **N/A** | Plan installs zero new packages. |

### From Plan 14-02 (etsyToS data + Etsy card)

| Threat ID | Category | Disposition | Rationale |
|-----------|----------|-------------|-----------|
| T-14-02-01 | Tampering — checklist titles/bodies | **Mitigated — shipped** | `{item.title}` / `{item.body}` interpolate as React text nodes; no `dangerouslySetInnerHTML`. |
| T-14-02-02 | Information Disclosure — `etsyChecks` in IndexedDB → PDF leak | **Mitigated — shipped** | Boolean self-review flags only, no PII. Phase 14 introduces zero PDF code so the ETSY-02 PDF-exclusion contract is structurally upheld. Phase 16 must continue the exclusion — see Next Phase Hand-off. |
| T-14-02-03 | Tampering — raw `<input type="checkbox">` | **Mitigated — shipped** | The 5 raw `<input>` rows use the established `// allow-raw-html` escape hatch; `scripts/lint-no-raw-html.mjs` build-time guard passes (Audit 7). |
| T-14-SC | npm install legitimacy | **N/A** | Plan installs zero new packages. |

### From Plan 14-03 (Customer card on CostCalculator + JobsManager subline)

| Threat ID | Category | Disposition | Rationale |
|-----------|----------|-------------|-----------|
| T-14-03-01 | Information Disclosure — PII in IndexedDB | **Accepted — local-only** | Customer name/email/address/company stays in local IndexedDB. No fetch(), no analytics call references the field. Same disposition still applies post-D-21 (customer moved from PrintJob to Sale; storage layer is still IndexedDB). |
| T-14-03-02 | Information Disclosure — cross-job customer leakage via clearForm (Pitfall 6) | **Superseded by D-21** | The Pitfall 6 clearForm site is moot because the calculator no longer holds customer state. PII non-leak is now ensured by the `resetSaleForm` helper inside the Record Sale modal (commit eca103b). Modal lifecycle handles state isolation between sales naturally — opening a fresh modal mounts fresh state. |
| T-14-03-03 | Tampering — Customer fields rendered into JSX | **Mitigated — shipped** | All Customer field reads use React text-node interpolation with auto-escaping. `whitespace-pre-line` on address is a CSS property, NOT raw HTML rendering. Still applies in the Recent Sales accordion expanded body (D-23). |
| T-14-03-04 | Spoofing — email accepts arbitrary text | **Accepted — D-09** | HTML5 `type="email"` is the level of validation shipped. The user is the seller saving their own customer's contact info — no auth boundary crossed. |
| T-14-SC | npm install legitimacy | **N/A** | Plan installs zero new packages. |

### From Plan 14-04 (verification + audit)

| Threat ID | Category | Disposition | Rationale |
|-----------|----------|-------------|-----------|
| T-14-04-01 | Information Disclosure — Phase 14 → Phase 16 etsyChecks PDF leak | **Mitigated — recorded in this VERIFICATION.md** | Recorded explicitly in Next Phase Hand-off below: Phase 16 MUST NOT include `etsyChecks` in the PDF template. Phase 16 plan-phase will read this file as part of its `<read_first>` per the trust-boundary contract. |
| T-14-04-02 | Tampering — production source files in plan 14-04 | **Accepted — no source touched** | Plan 14-04 modifies ZERO files in `src/`. All source-level threats are handled by plans 14-01/02/03 (and the mid-UAT rewrite commits, which carry their own ad-hoc mitigations documented in commit messages). |
| T-14-04-SC | npm install legitimacy | **N/A** | Plan installs zero new packages. |

All threats are closed with one of: Mitigated (shipped), Accepted (rationale recorded), Superseded by a later decision, or N/A.

---

## Open Items / Notes

### Mid-UAT fix-up commits (2026-05-22)

During Plan 14-04 Task 2 UAT the user surfaced architectural reversals and adjacent bugs. The following commits landed on the worktree branch after the static audit (`a1dddda`) but before this verification:

| Commit | Subject | One-line description |
|--------|---------|----------------------|
| `7b14260` | `fix(14): persist shipping/packaging/marketplace on PrintJob so Edit re-hydrates true cost` | Pre-existing bug surfaced by UAT 2 — shipping, packaging, and marketplace fields were not being saved to PrintJob, so reopening a job for Edit reconstructed an incorrect cost. Rule 1 auto-fix. |
| `eca103b` | `feat(14): rewrite Phase 14 — customer-on-sale + Etsy conditional + Recent Sales accordion` | Core scope reversal landing D-21 + D-22 + D-23 in a single commit: removed Customer card from CostCalculator, moved Customer block into Record Sale modal, made Etsy section conditional on `marketplace === 'etsy'`, replaced flat Recent Sales list with `<details>`-based accordion. |
| `028d996` | `docs(14): record decision reversals D-21..D-24 (customer-on-sale, Etsy conditional, accordion)` | Documentation: appended the "Decisions Revised — 2026-05-22 (Plan 14-04 UAT feedback)" section to 14-CONTEXT.md, locking D-21..D-24 as the new contract. |
| `c56870f` | `feat(14): edit + delete sale records (per-sale customer fix-up)` | Once Customer moved per-sale (D-21), the user needed a way to correct customer info on a previously-recorded sale. Added Edit + Delete sale row actions inside the Recent Sales accordion. |
| `5ec4aa7` | `ui(14): move Edit/Delete buttons to right side of expanded sale accordion` | UI polish: repositioned the Edit + Delete buttons from inline (left) to right-aligned inside the expanded accordion body for visual consistency. |

None of these commits are deviations from the LOCKED revised contract — they ARE the revised contract being landed. The original audit (10/10 PASS) ran against the pre-revision surface; the revised surface inherits the same audit guarantees (Dexie schema unchanged, lint clean, tests passing, build green) because the revision rewrote JSX surfaces without touching the Dexie schema string, the lint guard, the test suite shape, or the bundle-size gates. Phase 16 plan-phase should run the same `npm run build` gate as a sanity check before locking its own work.

### Next Phase Hand-off

**Phase 15 (Tags, Search + Quick Duplicate):**
- Will reuse the Customer subline truncation pattern when implementing free-text search.
- Customer search must now hit `Sale.customer.{name,email,company,address}` (with `sale.customerName` legacy fallback) instead of `PrintJob.customer.*` per D-21.
- The DUP-02 contract ("`duplicateJob(job).customer === undefined` — PII reset") becomes moot for PrintJob (since job no longer carries customer); the equivalent unit test should assert that a duplicated sale carries no customer payload by default. Phase 15 plan-phase needs to update DUP-02's test expectation against the new shape.

**Phase 16 (Printable PDF Quote) — DEPENDENCY UPDATE:**
- ROADMAP Phase 16 success criterion #1 originally said the PDF customer block comes from `PrintJob.customer`. After D-21 the PDF customer block MUST pull customer from `Sale.customer` instead. The PDF is generated per-sale (or per-job-with-explicit-buyer-selection), not per-job-as-a-whole.
- Phase 16 plan-phase MUST read this VERIFICATION.md before writing PLAN files and must update its own success-criteria text to reflect the per-sale customer source. Phase 16 must also continue to EXCLUDE `PrintJob.etsyChecks` from the PDF template (ETSY-02 / ROADMAP success criterion #4 — unchanged by Phase 14's reversals).
- Phase 16's `<read_first>` for its planning step must include both this VERIFICATION.md and the 14-CONTEXT.md "Decisions Revised — 2026-05-22" section so the planner sees the revised contract.

**Planned follow-up — Phase 15.5: Customer Library (between Phases 15 and 16):**
- The user has decided to insert a new Phase 15.5 covering Customer as a first-class asset: bulk customer import + dropdown picker in the Record Sale modal. This will deduplicate customers across sales (the deferred CUST-F1 item) and replace the current freeform-per-sale model with a library-backed picker (still allowing freeform entry for one-off buyers).
- The actual ROADMAP insert will be done via `/gsd:phase add` AFTER Plan 14-04 closes — this verification record is not the place to lock the new phase. Mentioned here so Phase 16 plan-phase sees the upcoming dependency: PDF customer block will eventually pull from the customer library, not from inline `Sale.customer`. Phase 16 should design the PDF customer-block contract to be source-agnostic (it takes a `JobCustomer`-shaped value; where that value comes from is a separate concern).

### Out-of-scope guardrails — none crossed

The 10 out-of-scope guardrails from the 14-04 plan additional_context are all satisfied:
- (#1–#8) No source-file changes by this verification plan.
- (#9) Dexie schema string unchanged — max version remains 6.
- (#10) No new npm packages installed.

The mid-UAT rewrite commits modified `src/components/CostCalculator.tsx`, `src/components/JobsManager.tsx`, and `src/types.ts`, but those changes were SCOPE REVISIONS authorized by the user during UAT (D-21..D-24) and are recorded under "Mid-UAT fix-up commits" above — they are NOT guardrail breaches.

### Deferred items remaining

All "Deferred Ideas" from 14-CONTEXT.md remain deferred. Notably:
- Customer database / CRM tab (CUST-F1) — partially picked up by the planned Phase 15.5 above; the full CRM-style relationship modeling stays deferred to a later "Sales Pipeline" milestone.
- Email regex validation + inline error UI — still rejected per D-09.
- Persisting collapsible open/closed state across sessions — still rejected per D-03 (now moot for the Customer surface since it lives inside a modal that opens to a fresh state every time).
- Address structured fields — still rejected per Phase 12 D-08.
- Tag autocomplete — still deferred to v1.3.
- Customer search/filter in JobsManager — still in Phase 15 scope (with the updated `Sale.customer` source per the dependency note above).

---

*Verified: 2026-05-22T12:51:30Z*
*Verifier: Claude (gsd-executor, Plan 14-04 Task 3) + human UAT sign-off ("approved" after D-21..D-24 reversal applied)*
*Phase: 14-customer-details-etsy-helper*
