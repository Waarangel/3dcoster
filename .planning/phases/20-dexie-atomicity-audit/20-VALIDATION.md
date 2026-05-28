---
phase: 20
slug: dexie-atomicity-audit
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from [20-RESEARCH.md §Validation Architecture](20-RESEARCH.md).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest@^4.1.4` with `@vitest/coverage-v8@^4.1.4` |
| **Config file** | `vitest.config.ts` |
| **Environment** | `jsdom` (no IndexedDB — pure-helper fallback pattern in use) |
| **Quick run command** | `npx vitest run src/db src/utils/csvHelpers src/hooks/useDatabase` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Build chain** | `npm run build` runs `vitest run --coverage` before `tsc -b && vite build` |
| **Estimated runtime** | ~5–10 seconds (scoped) / ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/db src/utils/csvHelpers src/hooks/useDatabase` (scoped to changed files)
- **After every plan wave:** Run `npm test` (full Vitest suite)
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run build` exits 0
- **Max feedback latency:** ~10 seconds for scoped runs

---

## Per-Task Verification Map

> Plan-level mapping. Task-level IDs assigned by gsd-planner — see PLAN.md frontmatter `tests:` blocks.

| Req ID | Plan | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|------|------|----------|-----------|-------------------|-------------|--------|
| DATA-01a | 20-01 | 1 | `addSale` rolls back sale row if `jobs.put` throws mid-tx | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "addSale rolls back"` | ❌ W0 | ⬜ pending |
| DATA-01b | 20-01 | 1 | `deleteSale` rolls back sale row if `jobs.put` throws mid-tx | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "deleteSale rolls back"` | ❌ W0 | ⬜ pending |
| DATA-01c | 20-01 | 1 | `updateSale` rolls back sale row if `jobs.put` throws mid-tx | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "updateSale rolls back"` | ❌ W0 | ⬜ pending |
| DATA-02 auto | 20-02 | 2 | `createQuote` reads `nextQuoteNumber` from settings inside tx | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "createQuote tx-scoped read"` | ❌ W0 | ⬜ pending |
| DATA-02 UAT | 20-02 | 2 | Two near-simultaneous `createQuote` calls in two tabs produce distinct quote numbers | manual UAT (jsdom lacks IDB) | — | — | ⬜ pending UAT |
| DATA-03a | 20-03 | 3 | `backfillQuotesFromJobs(jobs, sales, currency)` propagates currency to `lineItemsSnapshot.currency` | unit | `npx vitest run src/db/backfill.test.ts -t "currency parameter"` | ✅ extend | ⬜ pending |
| DATA-03b | 20-03 | 3 | v8 upgrade callback reads currency from settings via `tx.table('settings').get('userProfile')` | unit (pure-helper fallback) | `npx vitest run src/db/database.migrations.test.ts -t "v8 currency"` | ✅ extend | ⬜ pending |
| DATA-03c | 20-03 | 3 | v9 reconcile pure helper is idempotent (rerun → 0 patches) | unit (pure helper) | `npx vitest run src/db/backfill.test.ts -t "v9 reconcile idempotent"` | ❌ W0 | ⬜ pending |
| DATA-03d | 20-03 | — | Real-Dexie v9 upgrade end-to-end (open v8 fixture, reopen at v9) | integration | — needs `fake-indexeddb` | — | ⏭ deferred to Phase 23 TEST-04 |
| DATA-04a | 20-04 | 1 | `parsePositiveNumber('0')` returns `null` by default | unit | `npx vitest run src/utils/csvHelpers.test.ts -t "rejects 0"` | ❌ W0 | ⬜ pending |
| DATA-04b | 20-04 | 1 | `parsePositiveNumber('0', { allowZero: true })` returns `0` | unit | `npx vitest run src/utils/csvHelpers.test.ts -t "allows 0 opt-in"` | ❌ W0 | ⬜ pending |
| DATA-04c | 20-04 | 1 | All 8 call sites compile (TS verifies the signature change is consistent) | type-check | `tsc -b` (in build chain) | ✅ build chain | ⬜ pending |
| DATA-05a | 20-04 | 1 | `versionchange` handler awaits `db.close()` before reload | unit | `npx vitest run src/db/database.test.ts -t "versionchange awaits close"` | ❌ W0 | ⬜ pending |
| DATA-05b | 20-04 | 1 | Cross-tab reload works in real browser (no aborted-tx warnings) | manual UAT | — | — | ⬜ pending UAT |
| DATA-06a | 20-04 | 1 | `getSetting('foo', defaultValue, validator)` returns `defaultValue` on validator reject | unit | `npx vitest run src/db/database.test.ts -t "getSetting validator rejects malformed shape"` | ❌ W0 | ⬜ pending |
| DATA-06b | 20-04 | 1 | Each of 6 hand-rolled `is`-predicates correctly identifies its shape | unit | `npx vitest run src/db/database.test.ts -t "isPrinterConfig|isElectricityConfig|isLaborConfig|isUserProfile|isShipping|isMarketplaceFees"` | ❌ W0 | ⬜ pending |
| DATA-06c | 20-04 | 1 | `console.warn` fires in dev when validator rejects; silent in prod | unit (mock `import.meta.env.DEV`) | `npx vitest run src/db/database.test.ts -t "validator warns in dev"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⏭ deferred*

---

## Wave 0 Requirements

The following test files must be authored before any task ships its implementation:

- [ ] `src/hooks/useDatabase.test.ts` — **new file.** Covers DATA-01 (3 mutations) + DATA-02 tx-scoped read.
- [ ] `src/utils/csvHelpers.test.ts` — **new file.** Covers DATA-04 default-reject-0 + `{ allowZero: true }` opt-in. ⚠ Coordinate with Phase 21 SEC which will also add to this file.
- [ ] `src/db/database.test.ts` — **new file.** Covers DATA-05 versionchange + DATA-06 `getSetting` validator + 6 `is`-predicates. Small surface; do not bury inside migrations test.
- [ ] Extend `src/db/backfill.test.ts` — DATA-03 currency parameter + v9 reconcile pure helper.
- [ ] Extend `src/db/database.migrations.test.ts` — v8 currency-flowthrough fixture.

**[ASSUMED → Wave 0 risk] Vitest-spy rollback assertion:** The DATA-01/02 transaction-boundary tests use `vi.spyOn(db.jobs, 'put').mockRejectedValueOnce(...)` to simulate mid-tx failure, then assert `await db.sales.get(saleId)` returns undefined. This pattern has not been verified empirically in this codebase. **The first DATA-01 test must prove the rollback assertion works against jsdom before the rest of the test plan locks in.** If the spy approach fails to trigger a Dexie rollback, fallback is explicit `tx.abort()` inside the test transaction.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two near-simultaneous `createQuote` calls in two browser tabs produce distinct quote numbers | DATA-02 | jsdom lacks IndexedDB; concurrent-tab semantics require real browser | 1. Open 3DCoster in two browser tabs. 2. In each tab, set up a quote draft. 3. Click "Save Quote" in both tabs within ~1 second. 4. Verify the two saved quotes have different `quoteNumber` values (no collision). 5. Verify `userProfile.nextQuoteNumber` in settings is incremented by exactly 2. Automated equivalent deferred to Phase 23 TEST-04 (real-Dexie via `fake-indexeddb`). |
| Cross-tab reload on schema bump produces no aborted-tx console warnings | DATA-05 | Multi-tab `versionchange` behavior requires real browser + real IDB | 1. Open 3DCoster in two browser tabs (both on v8). 2. In tab A, trigger the v9 schema bump (open DevTools console: `await db.delete(); window.location.reload();` — or wait for the v9 ship). 3. Confirm tab B reloads cleanly with no "transaction aborted" or "PrematureCommitError" warnings in console. 4. Confirm tab B's UI returns to a working state post-reload. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all `❌ W0` references in the verification map
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for scoped, < 30s for full
- [ ] Vitest-spy rollback pattern empirically validated before DATA-01 implementation lands
- [ ] `nyquist_compliant: true` set in frontmatter after planner verifies task-level coverage

**Approval:** pending
