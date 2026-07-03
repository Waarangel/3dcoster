# Phase 23: Test coverage hardening - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Three goals, one phase:

1. **Customer-UI test coverage** — first tests for the 3 Customer-UI surface files: `CustomerEditModal.tsx`, `CustomerCsvImportModal.tsx`, `CustomerLibrary.tsx`. These have shipped to production with zero unit-test coverage since Phase 15.1.

2. **Lock the email-lowercase resolution + reconcile legacy data** — `CustomerEditModal` does NOT lowercase email on save; `customerCsv.ts:139-140` does, citing "UI-SPEC discretion #8: emails normalized to LOWERCASE on write". This phase aligns the modal with the parser (modal lowercases on save) AND ships a one-time reconcile helper for existing mixed-case rows in user IndexedDB, then locks the new behavior by test.

3. **Promote the v7→v8 Dexie migration test from pure-helper fallback to real-Dexie** — `database.migrations.test.ts` currently runs in "fallback mode" against `backfillQuotesFromJobs` directly because `fake-indexeddb` was not a devDep. The file's own docstring tells you to rewrite it once the devDep is added. TEST-04 is exactly that promotion.

Plus two hygiene items folded in because they live in the same test files we're already touching:

4. **TEST-05** — retype `dbJobsPutSpy` in `JobsManager.test.tsx` to `vi.fn<(job: PrintJob) => Promise<void>>()` so typo-detection works for spy assertions.
5. **TEST-06** — split `duplicateJob.test.ts`'s `DUP-02 D-15 locked contract` `describe` block's single 6-assertion `it` into 6 named `it` blocks; preserve every `expect()` line byte-identically; update the lock comment to clarify shape-vs-assertion distinction.

**Net result:** TEST-01..TEST-06 closed. `npm test` continues to pass green. Coverage report shows non-zero coverage for the 3 new Customer-UI test files.

</domain>

<decisions>
## Implementation Decisions

### Email-lowercase resolution direction

- **D-01:** **Align modal with parser.** `CustomerEditModal.tsx` `handleSubmit` rewrites the email-save line from `email: email.trim() || undefined` to `email: email.trim().toLowerCase() || undefined`. The parser at `customerCsv.ts:139-140` stays as-is — it's already canonical. The CSV parser's existing comment ("UI-SPEC discretion #8: emails normalized to LOWERCASE on write") becomes the literal contract.
- **D-02:** **Ship a one-time reconcile helper** alongside the modal change — `reconcileCustomerEmailLowercase(customers: Customer[]): Customer[]` in `src/db/backfill.ts`. Pure function, idempotent at the row level (rows whose `email` is already lowercase or `undefined` skip), returns ONLY the patched rows. Wired into `useDatabase.ts` `useCustomers()` (or a new sibling `useCustomerReconcile`) behind a `customerEmailLowercaseRan` process-lifetime module flag — identical pattern to the four existing reconciles (`copiesSoldReconcileRan`, `tagsNormalizeRan`, `fixedCostsReconcileRan`, `saleCustomerBackfillRan`). On the first reload after Phase 23 lands, every existing `John@example.com` in the user's library becomes `john@example.com`. Subsequent reloads pay zero write cost.
- **D-03:** **Sales are NOT touched.** Historical `Sale.customer.email` snapshots stay byte-identical with their original case — `Sale.customer` is by-value per Phase 15.1 CL-05, and mutating it would violate the by-value audit-trail lock. The picker's existing case-insensitive lookup (`customersByEmail` uses `.toLowerCase()` keys) already masks any visual mismatch between a historical sale and its current library customer.

### fake-indexeddb scope and integration shape

- **D-04:** **Per-test import, NOT global setup.** `import 'fake-indexeddb/auto';` at the top of `src/db/database.migrations.test.ts` only. No `vitest.setup.ts` injection. The other 28+ test files stay jsdom-only with no IndexedDB shim — zero behavior change for the existing 438 passing tests, blast radius scoped to one file.
- **D-05:** **Replace the existing pure-helper fallback test, do NOT keep both.** The current `database.migrations.test.ts` file is in "fallback mode" by its own admission (lines 6-31 of its docstring spell out the replacement plan). The pure helper (`backfillQuotesFromJobs`) is still exhaustively covered by `src/db/backfill.test.ts` — nothing is lost. The new file opens a v7 Dexie fixture, runs the v7→v8 upgrade, asserts `db.quotes.toArray()` matches the locked D-17 G7 contract.
- **D-06:** **Customer-UI modal tests do NOT use fake-indexeddb.** TEST-01/02/03 mock `useDatabase` hooks (`vi.mock('../hooks/useDatabase', ...)` returning spies for `addCustomer`/`updateCustomer`/`deleteCustomer`/`bumpLastUsed`/`useCustomers`/`useCustomersByEmail`). Same pattern as Phase 22's `RecordSaleModal.test.tsx`. fake-indexeddb stays scoped to TEST-04 only. **Reason:** Phase 22 already proved the mocked-hook pattern catches the bugs that matter (it caught the WR-02 hydration regression). Going deeper would diverge from the established test convention and force a new pattern to maintain.

### Customer modal test depth

- **D-07:** **Render the real `<Modal>` primitive** (Phase 19) inside `createRoot(...).render(<CustomerEditModal isOpen={true} ... />)`. Do NOT stub `<Modal>` to render children inline. Reason: Phase 22's WR-02 (RecordSaleModal hydration `useEffect` clobbering form state on `useLiveQuery` re-emissions) was invisible to a stubbed-Modal test path — only the real Modal's mount/unmount lifecycle surfaces the hydration timing. The cost (per-test Modal portal mount) is paid every other test in this codebase already.
- **D-08:** **Test convention is raw `createRoot` + `act` from `react-dom/client` + `react`.** NO `@testing-library/react`. Locked by Phase 19 D-21, confirmed by Phase 22 D-21. Reference patterns: `RecordSaleModal.test.tsx`, `PrintQuoteModal.test.tsx`, `SaleRow.test.tsx`. Every new Customer-UI test file mirrors the spy-then-mock-then-render-then-act structure of `RecordSaleModal.test.tsx`.

### DUP-02 lock-comment intent

- **D-09:** **Split is allowed.** The "Do NOT modify these assertions" comment in `src/utils/duplicateJob.test.ts` locks the assertion expressions (the 6 `expect(...)` lines that lock PII reset / tax reset / copiesSold reset / id rotation / createdAt advance / tags preserve), NOT the test-block shape. TEST-06 splits the single 6-assertion `it` into 6 named `it` blocks with `it()` wrapper text describing each lock; the 6 `expect()` lines move byte-identically into their new homes.
- **D-10:** **Update the lock comment** during the split to make the distinction explicit. New comment text: `Do NOT modify the assertion expressions below — they are the unit-test acceptance criteria for DUP-02 and are referenced by threat-model mitigation T-15-03. Shape refactoring (e.g., one it() per assertion, rename describe()) is permitted as long as every expect() line stays byte-identical and every threat-model mitigation remains locked.` Plan 23-04 ships this rewrite as one atomic commit.

### Test-file location and naming

- **D-11:** `src/components/CustomerEditModal.test.tsx` — TEST-01. Sibling to `CustomerEditModal.tsx`. Matches every other component test in the repo.
- **D-12:** `src/components/CustomerCsvImportModal.test.tsx` — TEST-02. Sibling to `CustomerCsvImportModal.tsx`.
- **D-13:** `src/components/CustomerLibrary.test.tsx` — TEST-03. Sibling to `CustomerLibrary.tsx`.
- **D-14:** `src/db/database.migrations.test.ts` — TEST-04 (REPLACES existing file at same path). Same path means git-blame stays linked to the historical fallback context.

### Claude's Discretion

The following call to the researcher / planner — capture-and-go, no rework:

- Whether `reconcileCustomerEmailLowercase` lives in a new useEffect inside `useCustomers()` vs the existing `useJobs()` block alongside the other 4 reconciles. Recommend: put it next to `saleCustomerBackfillRan` (also customer-shaped) inside `useCustomers()`. Researcher picks based on existing reconcile placement.
- Whether to add a `customerEmailLowercaseRan` Dexie meta-row in addition to the module flag (other reconciles use module-only). Recommend: module-only, matches the existing 4-reconcile precedent.
- v7 fixture data shape for the migration test — researcher should mirror the existing `D-17 G7` 3-job-2-quote fixture from `backfill.test.ts:46-65` so the assertion shape stays exactly the same as what the pure-helper test was asserting; reuse `makeJob`/`makeSale` factories if they're already exported.
- Whether the `dbJobsPutSpy` retype (TEST-05) lands in its own atomic commit or piggybacks on the DUP-02 split commit (TEST-06). Recommend: separate commits for grep-ability in git log, but planner can combine if both files are touched in one task.

### Folded Todos

[none — no pending todos cross-referenced this phase]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 23 source artifacts

- `.planning/REQUIREMENTS.md` §Test coverage (TEST) — TEST-01 through TEST-06 wording; **TEST-01 explicitly references the email-lowercase divergence**, **TEST-06 explicitly flags the DUP-02 intent as "Discussion required"**. Both are now resolved in this CONTEXT.md.
- `.planning/ROADMAP.md` §Phase 23 — success criteria 1-7, including the email-lowercase resolution note on criterion 1 and the DUP-02 intent note on criterion 6.
- `.planning/PROJECT.md` — milestone-level scope and the standing reconcile-legacy-data rule.

### Phase 23 carry-forward CONTEXT files

- `.planning/phases/22-jobsmanager-decomposition-perf/22-CONTEXT.md` §D-21 — locks raw `createRoot` + `act` test convention. `RecordSaleModal.test.tsx` is the reference pattern for Phase 23's 3 new Customer-UI test files.
- `.planning/phases/22.1-break-even-formula-reconciliation/22.1-CONTEXT.md` §D-11 / §D-12 — Phase 22.1's "tests live alongside source files" + "no `@testing-library/react`" rules carry forward unchanged.
- `.planning/phases/19-modal-primitive-a11y-migration/19-CONTEXT.md` (§Modal primitive) — Phase 19 D-21 is the original test-convention lock + Modal primitive contract.
- `.planning/phases/15.1-customer-library/15.1-CONTEXT.md` — Customer Library source-of-truth contracts. **CL-01** (sort order: `lastUsedAt desc, undefined-first`) is locked by Phase 15.1 and MUST be the assertion in TEST-03. **CL-05** (Sale.customer is by-value) is why D-03 above does NOT touch historical sales.

### Reconcile pattern (D-02 implementation reference)

- `src/db/backfill.ts` — existing reconcile helpers: `reconcileCopiesSoldFromSales`, `normalizeTagsOnJob`, `reconcileFixedCostsAtSave`, `backfillCustomersFromSales`. The new `reconcileCustomerEmailLowercase` MUST mirror their shape: pure function, no Dexie imports, returns ONLY the patched rows, idempotent at the row level.
- `src/hooks/useDatabase.ts` lines 467-549 — the 4 existing reconcile useEffects with `*Ran` module flags. The new email-lowercase reconcile MUST follow Phase 22.1's WR-01 hardening (set flag AFTER successful completion, NOT before).

### Lock-comment / threat-model references (D-09 / D-10)

- `src/utils/duplicateJob.test.ts` — current DUP-02 D-15 6-assertion `it` block (must be split, NOT modified at the `expect()` level).
- `.planning/phases/15-tags-search-quick-duplicate/threat-model.md` (if it exists; otherwise the Phase 15 CONTEXT/PLAN that defines it) — threat-model mitigation T-15-03 references the DUP-02 6-assertion lock. The replacement lock-comment text in D-10 explicitly preserves the T-15-03 reference.

### Test-tooling references

- `src/db/database.migrations.test.ts` — current fallback-mode file; lines 6-31 of its docstring contain the explicit replacement instructions for when fake-indexeddb lands as a devDep.
- `src/db/backfill.test.ts` lines 46-65 — `D-17 G7` 3-job-2-quote fixture shape; TEST-04 reuses this fixture verbatim so the assertion shape stays unchanged between pure-helper and real-Dexie test layers.
- `src/components/RecordSaleModal.test.tsx` lines 1-50 — the spy-mock-render-act test-file scaffold pattern. Every new Customer-UI test file in this phase MUST start with the same shape.
- `package.json` devDependencies — `fake-indexeddb` will be added at v6.x or whatever Dexie v4 recommends for v9 + IDB v3. Researcher pins the version.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Modal primitive** at `src/components/ui/Modal.tsx` (Phase 19) — all 3 Customer-UI components already render through it. Tests render the real primitive (D-07).
- **`createRoot` + `act` test scaffold** at `src/components/RecordSaleModal.test.tsx:1-50` — copy-paste-adapt for each of the 3 new Customer-UI test files. Headers, spy declarations, vi.mock structure all transfer with file-name swaps.
- **Existing reconcile pattern** at `src/db/backfill.ts` + `src/hooks/useDatabase.ts:467-549` — exact shape for the new `reconcileCustomerEmailLowercase` helper + its useEffect wiring.
- **`D-17 G7` fixture** at `src/db/backfill.test.ts:46-65` — 3-job-2-quote fixture for TEST-04's migration assertion.
- **`useCustomersByEmail` lookup map** — already lowercases keys (`src/hooks/useDatabase.ts`). Confirms the broader codebase treats email as case-insensitive, which strengthens the D-01 alignment direction.

### Established Patterns

- **Pattern: raw `createRoot` + `act`, no `@testing-library/react`** (Phase 19 D-21, Phase 22 D-21). Locked. Every new test file in Phase 23 follows this.
- **Pattern: spies declared outside `vi.mock` factory, mock factory references spies via `vi.fn()` declarations** (RecordSaleModal.test.tsx:23-37). Avoids hoisting bugs in vitest.
- **Pattern: reconcile-legacy-data** — every schema/behavior change that touches a derived field ships with a one-time reconcile helper, not a forward-only fix (project memory `feedback_reconcile_legacy_data`). D-02 honors this.
- **Pattern: module-flag idempotency for reconciles** — 4 existing examples in `useDatabase.ts`. The new email reconcile MUST follow Phase 22.1's WR-01 hardening (set flag AFTER successful completion).

### Integration Points

- `CustomerEditModal.tsx` `handleSubmit` — single-line behavior change (D-01). Surface: rebroadcasts `Customer` through `onSave` prop.
- `useCustomers()` in `useDatabase.ts` — new useEffect for the email-lowercase reconcile alongside the existing `saleCustomerBackfillRan` flag.
- `database.migrations.test.ts` — full-file replacement at the same path (D-05). Git-blame preserves the historical fallback-mode context via the file rename history.
- `JobsManager.test.tsx` — single-line type fix for `dbJobsPutSpy` (TEST-05). Touches one declaration, no other tests change.
- `duplicateJob.test.ts` — shape refactor; assertion text is byte-identical (TEST-06). Touches the `describe` body + the lock comment.

</code_context>

<specifics>
## Specific Ideas

- The user-IndexedDB email-lowercase reconcile must NEVER touch historical `Sale.customer.email` snapshots (D-03 / Phase 15.1 CL-05 lock). The reconcile is scoped strictly to `db.customers`.
- TEST-01 covers the post-fix lowercase behavior — assert `await onSaveSpy.mock.calls[0][0].email === 'john@example.com'` after the user types `John@Example.com` and clicks Save. The `onSave` spy is the contract boundary.
- TEST-04 v7 fixture creation pattern: open a fresh Dexie at v7 schema, `bulkAdd` 3 jobs + 2 sales (per the existing D-17 G7 fixture), close, reopen at v8, assert `db.quotes.toArray()` returns exactly 2 quotes with the locked status/customerSnapshot shape from `backfill.test.ts`.

</specifics>

<deferred>
## Deferred Ideas

- v6→v7 customers-store-add migration test (was option 3 in the fake-indexeddb sub-Q B). Not in TEST-04's scope; a separate phase if ever desired.
- Hybrid test depth (fake-indexeddb for some Customer tests, mocks for others). Rejected — convention drift cost outweighs the integration-fidelity gain. Phase 22's mocked-hook pattern wins.
- Adding a meta-test that reads `duplicateJob.test.ts` as text and asserts the lock-comment string is present (was option 3 in the DUP-02 sub-Q). Rejected — gimmicky; the comment itself is the lock.
- Backfilling tests for `useCustomerPicker` beyond what Phase 22 already shipped. Out of scope; Phase 22's coverage is sufficient.

</deferred>
