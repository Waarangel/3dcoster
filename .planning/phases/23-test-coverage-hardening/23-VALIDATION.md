---
phase: 23
slug: test-coverage-hardening
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
backfilled: true
backfill_phase: 26-v1-3-cleanup
---

# Phase 23 — Validation Strategy

> Per-phase validation contract. Backfilled retroactively by Phase 26 (2026-05-28); per-task map points to 23-VERIFICATION.md observable truths per CONTEXT.md D-06.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 + raw createRoot + act (project convention) |
| **Config file** | `vite.config.ts` (vitest config inline) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run build` (runs `tsc -b && vite build` after `vitest run`) |
| **Estimated runtime** | ~5s for `npm test`, ~30s for `npm run build` |

---

## Sampling Rate

- **After every task commit:** `npm test`
- **After every plan wave:** `npm run build`
- **Phase gate:** `npm run build` exit 0 + VERIFICATION.md status: passed

---

## Per-Task Verification Map

> Backfill: rows reference 23-VERIFICATION.md "Observable Truths" table verbatim per D-06.

| Req ID | Plan | Wave | Observable Truth (from VERIFICATION.md) | Test Type | Automated Command | Evidence Source | Status |
|--------|------|------|------------------------------------------|-----------|-------------------|-----------------|--------|
| TEST-01 | 23-01 | 1 | CustomerEditModal.test.tsx exists; covers Add/Edit hydration, Name-OR-Email validation, Escape close, submit-disable during save, error recovery, locks email-lowercase behavior | unit | `npm test` | 23-VERIFICATION.md SC#1 | passed |
| TEST-02 | 23-02 | 1 | CustomerCsvImportModal.test.tsx exists; covers non-CSV → WR-06 error, valid CSV → preview transition, dedup toggle, row selection/deselect, confirm import call shape | unit | `npm test` | 23-VERIFICATION.md SC#2 | passed |
| TEST-03 | 23-02 | 1 | CustomerLibrary.test.tsx exists; covers search filter, delete confirmation, edit modal open/close, empty state, sort order (lastUsedAt desc with undefined-first per CL-01) | unit | `npm test` | 23-VERIFICATION.md SC#3 | passed |
| TEST-04 | 23-03 | 1 | fake-indexeddb in devDependencies; database.migrations.test.ts opens real v7 Dexie fixture, runs v7→v8, asserts db.quotes.toArray() matches D-17 G7 contract | integration | `npm test` | 23-VERIFICATION.md SC#4 | passed |
| TEST-05 | 23-04 | 1 | JobsManager.test.tsx dbJobsPutSpy retyped to vi.fn<(job: PrintJob) => Promise<void>>() | unit | `npm test` | 23-VERIFICATION.md SC#5 | passed |
| TEST-06 | 23-04 | 1 | DUP-02 D-15 contract test split into 6 named it() blocks inside describe("DUP-02 D-15 locked contract"); assertion text unchanged | unit | `npm test` | 23-VERIFICATION.md SC#6 | passed |

---

## Wave 0 Requirements

Backfilled phase — Wave 0 was satisfied during the original phase execution. All test files referenced in the Per-Task Map exist in `src/`. No new test files required.

---

## Manual-Only Verifications

None. 23-VERIFICATION.md "Human Verification Required" section confirms: all success criteria are programmatically verifiable and were verified (file existence, test counts, assertion text, test pass/fail all confirmed by `npm test` returning 466 passed / 0 failures).

---

## Validation Sign-Off

- [x] All tasks have automated verify or were satisfied during original execution
- [x] Sampling continuity preserved
- [x] Wave 0 satisfied retroactively
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** backfilled 2026-05-28 by Phase 26 per CONTEXT.md D-05/D-06

---

## Backfill Audit Trail

Backfilled by Phase 26 plan 26-02 on 2026-05-28. Source of truth for verification claims:
- `.planning/phases/23-test-coverage-hardening/23-VERIFICATION.md` (status: passed)
- `.planning/v1.3-MILESTONE-AUDIT.md` §requirements coverage
- CONTEXT.md decisions D-05 (template choice) and D-06 (pointer-doc semantics)
