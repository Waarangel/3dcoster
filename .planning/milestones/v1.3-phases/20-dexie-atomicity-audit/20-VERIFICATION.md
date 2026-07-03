---
phase: 20-dexie-atomicity-audit
verified: 2026-05-26T17:00:00Z
human_uat_approved: 2026-05-26T20:58:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Two-tab concurrent createQuote produces distinct quote numbers (DATA-02 race fix)"
    expected: "Tab A gets quote number N, Tab B gets quote number N+1 (never the same number); userProfile.nextQuoteNumber increments by exactly 2; no PrematureCommitError or TransactionInactiveError in either tab's DevTools console"
    result: "passed — human-approved 2026-05-26. Two tabs saved Print Quote within ~1s; observed distinct sequential quoteNumbers in the quotes IndexedDB store; no aborted-transaction errors in either console. UAT details persisted in 20-HUMAN-UAT.md."
---

# Phase 20: dexie-atomicity-audit Verification Report

**Phase Goal:** Every multi-store Dexie mutation in useDatabase.ts runs atomically — no half-applied state survives a tab close or thrown exception mid-write.
**Verified:** 2026-05-26T17:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | addSale/deleteSale/updateSale each wrapped in `db.transaction('rw', db.sales, db.jobs, ...)` | ✓ VERIFIED | useDatabase.ts:578, 593, 615 — three distinct `await db.transaction('rw', db.sales, db.jobs, async () => { ... })` envelopes confirmed by code read and grep |
| 2 | deleteJob wraps sales-cleanup + job-delete in a single transaction (WR-01 remediation) | ✓ VERIFIED | useDatabase.ts:548 — `await db.transaction('rw', db.sales, db.jobs, async () => { ... })` wrapping both `db.sales.where('jobId').equals(id).delete()` and `db.jobs.delete(id)` |
| 3 | createQuote reads nextQuoteNumber via `tx.table('settings').get('userProfile')` inside the tx body (DATA-02) | ✓ VERIFIED | useDatabase.ts:887-895 — `async (tx) => { const settingsRow = await tx.table('settings').get('userProfile'); let nextNum = 1; ...` at the top of the scope function; no `userProfile.nextQuoteNumber` reference outside the tx |
| 4 | v9 schema stanza + idempotent reconcileQuoteCurrency upgrade callback with 3-layer no-op guards | ✓ VERIFIED | database.ts:155-194 — `db.version(9).stores({...}).upgrade(async tx => { Layer 1: if (!settingsRow) return; Layer 2: try/parse with currency non-string guard (CR-01 applied); Layer 3: reconcileQuoteCurrency returns [] for USD users` |
| 5 | parsePositiveNumber('0') returns null by default; only packageCost opts in with `{ allowZero: true }` | ✓ VERIFIED | csvHelpers.ts:398-406 — `opts?.allowZero ? num < 0 : num <= 0`; csvHelpers.ts:241 — sole `{ allowZero: true }` call site confirmed; 12/12 csvHelpers.test.ts tests pass |
| 6 | handleVersionchange awaits db.close() before window.location.reload(); getSetting accepts optional structural validator; 6 type predicates wired to typed getters | ✓ VERIFIED | database.ts:204-208 — `export async function handleVersionchange(): Promise<void> { await db.close(); window.location.reload(); }`; database.ts:213-231 — `validator?: (parsed: unknown) => parsed is T`; database.ts:250-375 — all 6 predicates exported and passed as 3rd arg to getSetting inside respective typed getters; 28/28 database.test.ts tests pass |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/useDatabase.ts` | addSale/deleteSale/updateSale + deleteJob wrapped in transactions; createQuote tx-scoped read | ✓ VERIFIED | All 4 transaction envelopes present and substantive; quotePayload typed as `\| undefined` (CR-02 applied — no `!` assertion) |
| `src/db/database.ts` | v9 stanza, handleVersionchange, getSetting validator, 6 predicates | ✓ VERIFIED | All present; CR-01 fix applied (Partial<UserProfile> cast + currency non-string guard); CR-03 fix applied (Array.isArray checks on customCarriers + customMarketplaces) |
| `src/db/backfill.ts` | backfillQuotesFromJobs 3-arg signature; reconcileQuoteCurrency pure helper | ✓ VERIFIED | Signature at L185; `currency: currency as Currency` at L229; reconcileQuoteCurrency at L267 with all idempotency guards |
| `src/utils/csvHelpers.ts` | parsePositiveNumber exported with `opts?: { allowZero?: boolean }` | ✓ VERIFIED | L398-406; only packageCost at L241 opts in |
| `src/hooks/useDatabase.test.ts` | 9 tests: Wave 0 spike + DATA-01 call-order + DATA-02 call-order | ✓ VERIFIED | 9/9 tests pass; tautology acknowledged per CR-04/WR-04 (see Human Verification) |
| `src/db/database.test.ts` | 28 tests: versionchange + getSetting validator + 6 predicate suites | ✓ VERIFIED | 28/28 pass |
| `src/utils/csvHelpers.test.ts` | 12 tests: parsePositiveNumber default-reject-0 + allowZero | ✓ VERIFIED | 12/12 pass |
| `src/db/backfill.test.ts` | 49 tests including 7 new DATA-03 tests | ✓ VERIFIED | 49/49 pass |
| `src/db/database.migrations.test.ts` | 5 tests including v8-currency-flowthrough and v9-reconcile | ✓ VERIFIED | 5/5 pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| useDatabase.ts:addSale | db.sales + db.jobs (atomic) | `db.transaction('rw', db.sales, db.jobs, async () => { ... })` | ✓ WIRED | L578 — confirmed |
| useDatabase.ts:deleteSale | db.sales + db.jobs (atomic) | `db.transaction('rw', db.sales, db.jobs, async () => { ... })` | ✓ WIRED | L593 — confirmed |
| useDatabase.ts:updateSale | db.sales + db.jobs (atomic) | `db.transaction('rw', db.sales, db.jobs, async () => { ... })` | ✓ WIRED | L615 — confirmed |
| useDatabase.ts:deleteJob | db.sales + db.jobs (atomic) | `db.transaction('rw', db.sales, db.jobs, async () => { ... })` | ✓ WIRED | L548 — WR-01 remediation confirmed |
| useDatabase.ts:createQuote tx body | tx.table('settings').get('userProfile') | `async (tx) =>` scope function parameter | ✓ WIRED | L887, L891 — tx parameter present; tx-scoped read first in body |
| database.ts:v8 upgrade | backfillQuotesFromJobs(jobs, sales, currency) | tx-scoped settings read before call | ✓ WIRED | L121-141 — reads currency from settings inside upgrade tx, passes as 3rd arg |
| database.ts:v9 upgrade | reconcileQuoteCurrency(quotes, userCurrency) | import at L3, call at L186 | ✓ WIRED | L3 import confirmed; L186 call inside upgrade callback confirmed |
| database.ts:getSetting | validator parameter | `validator?: (parsed: unknown) => parsed is T` | ✓ WIRED | L216 — parameter declared; L222 — `if (validator && !validator(parsed))` guard present |
| database.ts:6 typed getters | 6 is-predicates | each getter passes its predicate as 3rd arg | ✓ WIRED | getPrinter→isPrinterConfig (L263), getElectricity→isElectricityConfig (L279), getLabor→isLaborConfig (L295), getUserProfile→isUserProfile (L314), getShippingConfig→isShippingConfig (L344), getMarketplaceFees→isMarketplaceFees (L374) |
| database.ts:on('versionchange') | handleVersionchange | `db.on('versionchange', handleVersionchange)` | ✓ WIRED | L208 — named function registered |
| handleVersionchange | db.close() then reload | `await db.close(); window.location.reload()` | ✓ WIRED | L205-206 — await sequencing confirmed |

### Data-Flow Trace (Level 4)

Not applicable — phase produces no components with dynamic data rendering. All changes are pure data-layer hardening (transaction wrappers, schema migrations, validation helpers).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| parsePositiveNumber rejects 0 | `npx vitest run src/utils/csvHelpers.test.ts` | 12/12 pass | ✓ PASS |
| DATA-01 transaction envelopes present | `grep -c "db.transaction('rw', db.sales, db.jobs," src/hooks/useDatabase.ts` | 4 (3 actual + 1 comment) | ✓ PASS |
| USD literal gone from backfill.ts | `grep -c "currency: 'USD'" src/db/backfill.ts` | 0 | ✓ PASS |
| v9 stanza exists | `grep -c "db.version(9)" src/db/database.ts` | 1 | ✓ PASS |
| tsc -b clean | `npx tsc -b` | exit 0, no output | ✓ PASS |
| Full test sampling | `npx vitest run src/db src/utils/csvHelpers src/hooks/useDatabase` | all pass | ✓ PASS |

### Probe Execution

No probe scripts declared or applicable for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-01 | 20-01 | addSale/deleteSale/updateSale atomic across db.sales + db.jobs | ✓ SATISFIED | useDatabase.ts:578,593,615 — 3 `db.transaction('rw', db.sales, db.jobs)` envelopes |
| DATA-02 | 20-02 | createQuote reads nextQuoteNumber inside tx, not from React state | ✓ SATISFIED | useDatabase.ts:887-895 — `tx.table('settings').get('userProfile')` as first tx body statement |
| DATA-03 | 20-03 | backfillQuotesFromJobs never hardcodes 'USD'; v9 reconcile for legacy data | ✓ SATISFIED | backfill.ts:185,229 — 3-arg signature; database.ts:155-194 — v9 stanza with reconcileQuoteCurrency |
| DATA-04 | 20-04 | parsePositiveNumber rejects 0 by default; packageCost opts in | ✓ SATISFIED | csvHelpers.ts:398-406 — widened signature; L241 — only opt-in |
| DATA-05 | 20-04 | versionchange handler awaits db.close() before reload | ✓ SATISFIED | database.ts:204-208 — async named export with await db.close(); cross-tab UAT approved 2026-05-26 |
| DATA-06 | 20-04 | getSetting<T> with optional structural validator; 6 hand-rolled predicates | ✓ SATISFIED | database.ts:213-231 — validator param; database.ts:248-375 — 6 predicates declared and wired to typed getters |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| useDatabase.test.ts | 103-121, 135-149, 160-178 | DATA-01 spy tests call `db.transaction(...)` directly from the test body, not through the production hook | ⚠️ Warning (CR-04/WR-04) | Tests prove the test's own inline code uses the transaction envelope, not that the production hook does. These tests carry no signal about the production addSale/deleteSale/updateSale implementation. Production code IS correct (verified by code read). Tests are marked for Phase 23 TEST-04 (fake-indexeddb). |
| useDatabase.test.ts | 211-322 | DATA-02 test calls `db.transaction(...)` directly, never invokes `createQuote` hook | ⚠️ Warning (CR-04) | Same tautology: test proves the test's inline scope function reads from the mock tx, not that the production createQuote does. Production code IS correct. Deferred to Phase 23 TEST-04. |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-20-modified files.

### Human Verification Required

#### 1. Two-Tab Concurrent createQuote (DATA-02)

**Test:** Open two browser tabs at `http://localhost:4173/`. In each tab, open the Print Quote modal for the same job and fill it to a ready-to-save state. Within approximately 1 second, click Save in both tabs.

**Expected:** Tab A gets quote number N; Tab B gets quote number N+1. The two quote numbers are distinct. After both saves, DevTools → Application → IndexedDB → 3DCosterDB → settings → userProfile JSON value shows `nextQuoteNumber: N+2`. No `PrematureCommitError`, `TransactionInactiveError`, or "connection closed" errors in either tab's console.

**Why human:** The DATA-02 two-tab UAT noted as non-autonomous in 20-02-PLAN.md (Task 2, `checkpoint:human-verify`). The 20-02-SUMMARY.md does not record an explicit "approved" verdict for this task — it documents the code change and test results but does not include a two-tab UAT verdict section. The DATA-05 cross-tab UAT (in 20-04-SUMMARY.md Task 5) was explicitly approved. DATA-02's concurrent quote-number uniqueness under real IndexedDB concurrency still needs a human-run verification pass. The production code change is correct per code inspection, but the concurrency guarantee requires real IDB to exercise.

**Additional context:** The existing DATA-02 test in useDatabase.test.ts (lines 211-322) does not test the production `createQuote` hook — it constructs the transaction inline in the test body (CR-04 tautology). The test proves the pattern works but not that the hook applies it. Phase 23 TEST-04 (fake-indexeddb) will provide the automated proof.

---

## Gaps Summary

No blockers. All six DATA-0x requirements are satisfied in the production code. The single human_needed item is a verification gap (DATA-02 concurrent-tab UAT not explicitly recorded as approved in 20-02-SUMMARY), not a code correctness gap.

Code review remediations (CR-01, CR-02, CR-03, WR-01) are all applied and verified:
- **CR-01** (v9 stamps undefined currency): Fixed — `Partial<UserProfile>` cast + `typeof parsed.currency !== 'string'` guard at database.ts:176-177
- **CR-02** (quotePayload! returns undefined): Fixed — typed as `| undefined`, runtime guard at useDatabase.ts:885,946-948
- **CR-03** (isShippingConfig/isMarketplaceFees missing array checks): Fixed — `Array.isArray(o.customCarriers)` at database.ts:340; `Array.isArray(o.customMarketplaces)` at database.ts:370
- **WR-01** (deleteJob non-atomic): Fixed — db.transaction wrapping both operations at useDatabase.ts:548-551

The test tautology (CR-04/WR-04) is a test quality issue, not a production code defect. Production code is verifiably correct by direct code inspection. Deferred to Phase 23 TEST-04.

---

_Verified: 2026-05-26T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
