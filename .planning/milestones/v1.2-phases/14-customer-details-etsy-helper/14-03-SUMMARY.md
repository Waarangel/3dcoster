---
phase: 14-customer-details-etsy-helper
plan: 03
subsystem: cost-calculator
tags: [customer, pii, cost-calculator, jobs-manager, react, tailwind, privacy]

requires:
  - phase: 14-01
    provides: CollapsibleSection UI primitive, customer-details featureReleases entry
  - phase: 14-02
    provides: Etsy CollapsibleSection card landmark in CostCalculator (Customer card lands immediately above), 6-site state-wiring template (etsyChecks → reused verbatim for customer)
  - phase: 12-schema-foundation
    provides: PrintJob.customer? + JobCustomer type (already shipped on Dexie v6)
provides:
  - Customer CollapsibleSection card in CostCalculator above the Etsy card (D-05 order)
  - 6-site customer state wiring (useState, sessionStorage formState + dep array, editingJob hydration, clearForm, both handleSaveJob branches)
  - hasAnyCustomerField helper guarding empty-object persistence on save
  - JobsManager row subline "Name · Email" with truncate (omitted when both absent)
  - JobsManager expanded-panel Customer block between 3-col grid and Model URL block (omitted when all 4 fields absent)
affects: [14-04-uat, 15-search-tags, 16-pdf]

tech-stack:
  added: []
  patterns:
    - "JobCustomer type-import threaded through CostCalculator; Textarea added to ./ui barrel import"
    - "6-site state wiring discipline (Phase 14-02 etsyChecks pattern reapplied verbatim for customer field)"
    - "hasAnyCustomerField module-scope helper to guard empty-object persistence (mirrors Phase 12 D-02 'undefined when empty' rule)"
    - "JSX-comment landmark from Plan 14-02 removed and replaced with the Customer card itself (clean JSX, no leftover marker)"
    - "JobsManager conditional reads via `job.customer?.field && <div>` chain; whitespace-pre-line on address; truncate on subline (Phase 11 useDynamicRowHeight cache stays stable via ResizeObserver)"

key-files:
  created: []
  modified:
    - src/components/CostCalculator.tsx
    - src/components/JobsManager.tsx

key-decisions:
  - "Customer card lands BEFORE Etsy card in JSX (Customer at :1523, Etsy at :1571) — D-05 order confirmed: Cost Breakdown → Customer → Etsy → Save Job button"
  - "Landmark comment `{/* Plan 14-03 inserts its Customer card directly above this comment. */}` from 14-02 was removed in this commit (clean JSX, no leftover marker); the Customer card itself now occupies that source location"
  - "hasAnyCustomerField declared as module-scope `function` (not a hook) per PLAN Step F; placed between clearForm and the auto-dismiss useEffect — visually grouped with its single call-site cluster (handleSaveJob)"
  - "Textarea is reused from src/components/ui (Phase 11+ primitive); `rows={3}` per D-11; the Textarea primitive's default size='md' is fine for a 3-row address field"

requirements-completed: [CUST-01, CUST-02]

duration: ~5min
completed: 2026-05-21
---

# Phase 14 Plan 03: Customer Form (Card + Wiring + JobsManager) Summary

**Customer CollapsibleSection card shipped above the Etsy card in CostCalculator with all 6 state-touching sites wired (including the PII-critical clearForm reset); JobsManager gains a Name · Email row subline and a full Customer block in the expanded panel. Phase 14 implementation phase is complete — only the UAT plan (14-04) remains.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-21T23:18Z (approx)
- **Completed:** 2026-05-21T23:23Z (approx)
- **Tasks:** 2
- **Files created:** 0
- **Files modified:** 2

## Accomplishments

- **Task 1 (CostCalculator):** Wired `customer` field into all 6 state-touching sites (useState init, sessionStorage formState literal + dep array, editingJob hydration, clearForm reset, both handleSaveJob branches). Defined the module-scope `hasAnyCustomerField` helper used by both save branches to guard empty-object persistence (mirrors Phase 12 D-02). Inserted the Customer `<CollapsibleSection>` directly above the Etsy card landmark (Customer at :1523, Etsy at :1571 — D-05 order confirmed). The landmark comment from Plan 14-02 was removed and replaced with the actual Customer card.
- **Task 2 (JobsManager):** Added a subline `Name · Email` (U+00B7 middle dot, `.truncate`) directly below the existing `filaments | print-time` line at :97 — omitted entirely when both fields absent. Added a Customer block in the expanded `isSelected` panel between the 3-column financial grid and the Model URL block — labeled "Customer", lists name/email/company/address conditionally with `whitespace-pre-line` on the address; block hidden entirely when all 4 fields empty.
- All 4 form-field labels follow the established `<label className="block text-xs text-slate-400 mb-1">` Phase 13-sweep convention.
- Email field uses native HTML5 `type="email"` only — no regex, no inline error UI, save never blocked (D-09).
- No `compact` prop on any of the 4 inputs (D-08); no `<InfoTooltip>` next to any label (D-10) — labels are self-explanatory.
- `<NewBadge feature="customer-details" className="absolute -top-1 -right-1" />` is passed via the CollapsibleSection's `badge` prop slot (NOT inline as a flex child) per MEMORY.md / D-04.

## Task Commits

1. **Task 1 — Wire Customer section into CostCalculator (6 state sites + JSX above Etsy)** — `8969f66` (`feat`)
2. **Task 2 — Add Customer subline + expanded panel block to JobsManager** — `6b29be1` (`feat`)

## 6-Site `customer` Wiring Confirmation (final line numbers post-commit `8969f66`)

| Site | Code reference | Line |
|------|---------------|------|
| 1. useState init | `const [customer, setCustomer] = useState<JobCustomer>(() => editingJob?.customer ?? getStoredValue('customer', {} as JobCustomer))` | 151–153 |
| 2. sessionStorage formState | `customer,` inside the `formState` literal (after `etsyChecks,`) | 190 |
| 3. sessionStorage dep array | `..., marketplace, etsyChecks, customer` | 197 |
| 4. editingJob hydration | `setCustomer(editingJob.customer ?? {});` (after `setEtsyChecks(editingJob.etsyChecks ?? {});`) | 217 |
| 5. clearForm reset | `setCustomer({});` (PII-critical, Pitfall 6 guard) | 534 |
| 6a. handleSaveJob update branch | `customer: hasAnyCustomerField(customer) ? customer : undefined,` | 599 |
| 6b. handleSaveJob create branch | `customer: hasAnyCustomerField(customer) ? customer : undefined,` | 630 |
| Bonus: hasAnyCustomerField definition | `function hasAnyCustomerField(c: JobCustomer): boolean { ... }` | 542–544 |
| Bonus: 4 JSX onChange handlers | `setCustomer(c => ({ ...c, name/email/company/address: ... }))` | 1535, 1544, 1555, 1565 |

`grep -c "setCustomer" src/components/CostCalculator.tsx` returns **7** (1 useState declaration + 1 hydration + 1 clearForm + 4 onChange handlers — meets the ≥ 6 acceptance threshold; the count of 7 reflects that the useState destructure `const [customer, setCustomer]` matches once and the 4 JSX handlers each contribute one match alongside the hydration and clearForm).

`grep -c "customer" src/components/CostCalculator.tsx` returns **14** (well above the implicit threshold).

`grep -c "hasAnyCustomerField" src/components/CostCalculator.tsx` returns **3** (1 definition + 2 call-sites: one in each handleSaveJob branch) — matches acceptance exactly.

`grep -c "feature=\"customer-details\"" src/components/CostCalculator.tsx` returns **1** — matches acceptance exactly.

## Customer Card vs. Etsy Card JSX Order (D-05 Confirmation)

```text
1523: {/* Customer details — Phase 14 CUST-01, CUST-02 */}
1524: <CollapsibleSection title="Customer" ...>
...
1571: {/* Etsy compliance helper — Phase 14 ETSY-01, ETSY-02 */}
1572: <CollapsibleSection title="Selling on Etsy?" ...>
```

Customer card source-line **:1523 is BEFORE** Etsy card source-line **:1571** — D-05 order confirmed (Customer first, Etsy second). The 14-02 landmark comment `{/* Plan 14-03 inserts its Customer card directly above this comment. */}` has been removed; the Customer card now occupies that source location.

## PII Guard Confirmation (Pitfall 6)

```text
$ grep -n "setCustomer({})" src/components/CostCalculator.tsx
534:    setCustomer({});
```

`setCustomer({})` appears in `clearForm()` at line 534, between `setEtsyChecks({});` and `sessionStorage.removeItem(FORM_STORAGE_KEY);`. This is the choke point that prevents Job A's customer (name, email, address — PII) from leaking into a new Job B when the user clicks "Cancel Edit" or saves a job that triggers `clearForm` (handleSaveJob update branch at :587).

The threat T-14-03-02 (Information Disclosure — cross-job customer leakage) is structurally mitigated.

## JobsManager Subline + Expanded Block (Task 2)

**Subline** (lines 98–102):
```tsx
{(job.customer?.name || job.customer?.email) && (
  <div className="mt-0.5 text-xs text-slate-500 truncate">
    {[job.customer?.name, job.customer?.email].filter(Boolean).join(' · ')}
  </div>
)}
```
- Middle-dot separator is the exact `·` (U+00B7) — verified via `grep "·" src/components/JobsManager.tsx`.
- `.truncate` keeps the row a predictable height; `useDynamicRowHeight` cache stays stable (ResizeObserver handles dynamic re-measure per Pitfall 4 — no cache key touched).
- Entire `<div>` is omitted when both name+email are absent (D-12).

**Expanded-panel Customer block** (lines 129–141):
```tsx
{(job.customer?.name || job.customer?.email || job.customer?.company || job.customer?.address) && (
  <div className="mb-4">
    <div className="text-xs text-slate-500 mb-1">Customer</div>
    <div className="space-y-0.5 text-sm text-slate-300">
      {job.customer?.name && <div>{job.customer.name}</div>}
      {job.customer?.email && <div className="text-slate-400">{job.customer.email}</div>}
      {job.customer?.company && <div className="text-slate-400">{job.customer.company}</div>}
      {job.customer?.address && (
        <div className="text-slate-400 whitespace-pre-line">{job.customer.address}</div>
      )}
    </div>
  </div>
)}
```
- `whitespace-pre-line` on the address preserves multi-line newlines that the user typed in the Address textarea (CSS-only, no `dangerouslySetInnerHTML` — T-14-03-03 mitigated).
- Block hidden entirely when all 4 customer fields are absent (D-14).

`grep -c "job.customer?.name"` returns **4** (1 subline guard + 1 subline value extraction + 1 expanded-block guard + 1 expanded-block conditional render — exceeds ≥ 2 threshold).
`grep -c "job.customer?.email"` returns **4** (same pattern as name — exceeds ≥ 2 threshold).
`grep -c "job.customer?.address"` returns **2** (expanded-block guard + expanded-block conditional render — exceeds ≥ 1 threshold; address never appears on the collapsed row per CUST-02).
`grep -c "whitespace-pre-line"` returns **1** (the address `<div>` only).

## Test Pass Count

`npm run test -- --run` → **Test Files 8 passed (8)**, **Tests 110 passed (110)**.

Same suite-level result as 14-02. No new JobsManager test exists (per RESEARCH Test Map). The 110/110 includes the 3 CollapsibleSection tests from 14-01 and the 4 etsyToS tests from 14-02 — all green.

## Lint and Type Checks

- `node scripts/lint-no-raw-html.mjs` → `lint:no-raw-html passed` (4 new Customer inputs all use the `Input` / `Textarea` primitives, no raw HTML form elements introduced)
- `npx tsc -b` → reports the same 3 pre-existing worktree-environment errors documented in 14-01 and 14-02:
  - `src/components/AssetLibrary.tsx:2` — Cannot find module 'react-window'
  - `src/components/JobsManager.tsx:2` — Cannot find module 'react-window'
  - `vite.config.ts:5` — Cannot find module 'rollup-plugin-visualizer'

  These are environmental (worktree `node_modules/` missing two packages). They are NOT caused by this plan — `grep -i "costcalculator\|customer\|jobcustomer\|hasAnyCustomerField" <tsc output>` returns zero. The CostCalculator integration of `JobCustomer` + `customer` state typechecks cleanly. The JobsManager additions (read-only `job.customer?.field` chains) also typecheck cleanly — they ride on the already-narrowed optional `customer?: JobCustomer` field that Phase 12 shipped.

## Decisions Made

1. **No new vitest test added for the JobsManager subline/block or the CostCalculator Customer card.** Why: RESEARCH Test Map notes no JobsManager test exists; the PLAN's verification ladder is the existing 110/110 vitest suite + the static `grep -c` checks + `lint-no-raw-html.mjs` + `tsc -b`. The PLAN does not call for new unit tests (Task 1 is `type="auto"`, Task 2 is `type="auto"`, neither has `tdd="true"`). The UAT script in Plan 14-04 will provide visual + interaction coverage.

2. **Removed the 14-02 landmark comment in the same commit as the Customer card insertion.** Why: The PLAN Step H notes the comment is a one-shot landmark; keeping it after the card lands would be confusing source-code clutter. The replace operation atomically swaps the landmark for the Customer card JSX in one Edit call.

3. **`Textarea` import added to the `./ui` barrel import on line :6 alongside `CollapsibleSection`.** Why: The PLAN's Step A.1 explicitly calls for this; Textarea is exported from the barrel at `src/components/ui/index.ts:4`. The runtime resize behaviour is preserved (default `textareaSize='md'` is what the existing Textarea primitive ships).

## Deviations from Plan

**None.** Plan executed exactly as written. All step-by-step instructions in the PLAN's Task 1 (Steps A–H) and Task 2 (Steps A–C) were applied verbatim. No Rule 1, 2, or 3 auto-fixes were needed. No checkpoints encountered.

## Issues Encountered

- **Pre-existing TypeScript errors unrelated to this plan:** Same 3 errors Plans 14-01 and 14-02 documented (`react-window` × 2 in AssetLibrary.tsx + JobsManager.tsx, `rollup-plugin-visualizer` × 1 in vite.config.ts). Worktree `node_modules/` is missing both packages. NOT caused by this plan — verified by `grep -i "costcalculator\|customer\|jobcustomer\|hasAnyCustomerField"` against `tsc -b` output returning zero. Environmental, not a code defect; logged for visibility per prior plans' precedent.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced.

- **T-14-03-01 (Information Disclosure — PII in IndexedDB):** ACCEPTED per plan. Customer name/email/address/company stays in local IndexedDB. No fetch(), no analytics call references the field. No transmission path introduced.
- **T-14-03-02 (Information Disclosure — cross-job customer leakage via clearForm):** MITIGATED. `setCustomer({})` is wired into `clearForm()` at line 534, between `setEtsyChecks({})` and `sessionStorage.removeItem(FORM_STORAGE_KEY)`. Pitfall 6 guard structurally in place. UAT in 14-04 will exercise this.
- **T-14-03-03 (Tampering — Customer fields rendered into JSX):** MITIGATED. All 4 reads (`{job.customer?.name}`, `{job.customer?.email}`, `{job.customer?.company}`, `{job.customer?.address}`) are React text-node interpolations with auto-escaping. The `whitespace-pre-line` Tailwind class is a CSS property only — NOT raw HTML rendering. No `dangerouslySetInnerHTML` introduced.
- **T-14-03-04 (Spoofing — email accepts arbitrary text):** ACCEPTED per D-09. HTML5 `type="email"` is the level of validation we ship. The user is the seller saving their own customer's contact info — no auth boundary crossed.
- **T-14-SC (npm install legitimacy):** N/A. Plan installs zero new packages.

## Known Stubs

None. The Customer card renders four real form inputs that bind to live `customer` state via controlled `onChange` handlers. The `hasAnyCustomerField` helper gates real save-time behaviour (not a placeholder). The JobsManager subline and expanded block render real reads of `job.customer?.field`; no mock data or placeholder text. The "Customer" header in the expanded block only renders when at least one customer field is present, so there is no empty-shell "Customer" label sitting on rows with no customer data.

## Self-Check: PASSED

- [x] `src/components/CostCalculator.tsx` modified — exists on disk (`ls` confirms)
- [x] `src/components/JobsManager.tsx` modified — exists on disk
- [x] Commit `8969f66` exists (`git log --oneline | grep 8969f66` returns 1 line)
- [x] Commit `6b29be1` exists
- [x] `grep -c "customer" src/components/CostCalculator.tsx` returns 14
- [x] `grep -c "setCustomer" src/components/CostCalculator.tsx` returns 7 (≥ 6 per acceptance)
- [x] `grep -c "feature=\"customer-details\"" src/components/CostCalculator.tsx` returns exactly 1
- [x] `grep -c "hasAnyCustomerField" src/components/CostCalculator.tsx` returns exactly 3 (1 def + 2 call sites)
- [x] `grep -E "setCustomer\\(\\{\\}\\)" src/components/CostCalculator.tsx` matches the clearForm reset at line 534
- [x] `grep "title=\"Customer\"" src/components/CostCalculator.tsx` returns 1 line at :1525 (the new CollapsibleSection's title prop)
- [x] Customer card source-line :1523 PRECEDES Etsy card source-line :1571 (D-05 confirmed)
- [x] `grep -c "job.customer?.name" src/components/JobsManager.tsx` returns 4 (≥ 2 per acceptance)
- [x] `grep -c "job.customer?.email" src/components/JobsManager.tsx` returns 4 (≥ 2 per acceptance)
- [x] `grep -c "job.customer?.address" src/components/JobsManager.tsx` returns 2 (≥ 1 per acceptance)
- [x] `grep -c "whitespace-pre-line" src/components/JobsManager.tsx` returns 1 (on the address `<div>` in the expanded block)
- [x] `grep "·" src/components/JobsManager.tsx` shows U+00B7 in the subline JSX (not `*`, `|`, or `-`)
- [x] `npm run test -- --run` exits 0 with 110/110 tests passing
- [x] `node scripts/lint-no-raw-html.mjs` passes
- [x] `tsc -b` reports only the 3 pre-existing worktree-environment errors; zero new errors from this plan
- [x] Dexie schema string unchanged (this plan touches no `db/` files — `git diff --name-only f5ea6f6..HEAD src/db/` is empty)

## TDD Gate Compliance

Per PLAN this is a non-TDD plan (Task 1 and Task 2 are both `type="auto"` with no `tdd="true"` attribute). The PLAN explicitly says "no new unit test for the Customer card or subline" and relies on the existing 110/110 vitest suite + grep-based static gates + lint + tsc + the Plan 14-04 UAT for verification. Phase 14's TDD gates were exercised in Plans 14-01 (CollapsibleSection RED/GREEN) and 14-02 (etsyToS RED/GREEN); Plan 14-03 builds on those primitives without introducing a new behaviour that warrants a fresh failing test.

## Next Plan Readiness

- **Plan 14-04 (UAT)** can:
  - Run `npm run dev` on port 4173 and confirm the CostCalculator shows TWO new cards in order [Customer card, Etsy card] above the Save Job button, both collapsed by default.
  - Confirm the NEW badge appears on the Customer card header (gate 1 release-age check: `2026-05-21 + 14 days = 2026-06-04`, so as long as UAT runs before 2026-06-04, the badge appears).
  - Exercise the PII-leak guard (T-14-03-02): open Job A with customer set → click "Cancel Edit" or save → create a new job → verify customer fields are EMPTY.
  - Verify the JobsManager row shows `Name · Email` subline when name/email are set; omits the subline entirely when both are absent.
  - Expand a row with customer data → verify the Customer block appears between the 3-col financial grid and the Model URL block, with newlines preserved on the address.
  - Re-verify the Etsy card features (14-02 surface): disclaimer text verbatim, 5 checklist items, date + policyLink rendered below.

No blockers. No concerns. Wave 3 of Phase 14 is implementation-complete; the UAT plan can now run end-to-end.

---
*Phase: 14-customer-details-etsy-helper*
*Plan: 03*
*Completed: 2026-05-21*
