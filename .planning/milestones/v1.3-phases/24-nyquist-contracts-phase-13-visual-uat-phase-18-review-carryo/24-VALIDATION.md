---
phase: 24
slug: nyquist-contracts-phase-13-visual-uat-phase-18-review-carryo
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
backfilled: true
backfill_phase: 26-v1-3-cleanup
---

<!-- Self-contract: Phase 24's own Nyquist contract was meta-deferred during execution (Phase 24 authored OTHER phases' VALIDATION.md files — its self-contract was the gap closed by Phase 26 plan 26-02 per CONTEXT.md D-05) -->

# Phase 24 — Validation Strategy

> Per-phase validation contract. Backfilled retroactively by Phase 26 (2026-05-28); per-task map points to 24-VERIFICATION.md observable truths per CONTEXT.md D-06.

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

> Backfill: rows reference 24-VERIFICATION.md "Observable Truths" table verbatim per D-06.

| Req ID | Plan | Wave | Observable Truth (from VERIFICATION.md) | Test Type | Automated Command | Evidence Source | Status |
|--------|------|------|------------------------------------------|-----------|-------------------|-----------------|--------|
| NYQ-01 | 24-01 | 1 | `13-VALIDATION.md` has `status: passed`, `nyquist_compliant: true`, `wave_0_complete: true` | doc | `ls .planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` | 24-VERIFICATION.md SC#1 | passed |
| NYQ-02 | 24-02 | 1 | `15-VALIDATION.md` exists and is `nyquist_compliant: true` | doc | `ls .planning/phases/15-tags-search-quick-duplicate/15-VALIDATION.md` | 24-VERIFICATION.md SC#2 | passed |
| NYQ-03 | 24-03 | 1 | `15.1-VALIDATION.md` exists and is `nyquist_compliant: true` | doc | `ls .planning/phases/15.1-customer-library/15.1-VALIDATION.md` | 24-VERIFICATION.md SC#3 | passed |
| NYQ-04 | 24-04 | 1 | `17-VALIDATION.md` exists and is `nyquist_compliant: true` | doc | `ls .planning/phases/17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd/17-VALIDATION.md` | 24-VERIFICATION.md SC#4 | passed |
| NYQ-05 | 24-05 | 1 | `13-VERIFICATION.md` has `status: passed` (was human_needed); contains UAT Closure section with 2 smoke-tested + 6 rubber-stamped items | doc | `ls .planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` | 24-VERIFICATION.md SC#5 | passed |
| WR-01 | 24-06 | 1 | **WR-01**: forbidden-path test uses single invocation with combined regex | unit | `npm test && npm run build` | 24-VERIFICATION.md SC#6 | passed |
| WR-02 | 24-06 | 1 | **WR-02**: `@tauri-apps/api` dedup — Cargo.toml has `tauri = "2.11"`; package.json has `@tauri-apps/api: ^2.11.0`; lockfile has exactly ONE @tauri-apps/api entry with zero nested copies | build | `npm test && npm run build` | 24-VERIFICATION.md SC#7 | passed |
| WR-03 | 24-06 | 1 | **WR-03**: `generateQuotePdf.ts` uses `startsWith('forbidden path:')` (not `includes`) | unit | `npm test && npm run build` | 24-VERIFICATION.md SC#8 | passed |

---

## Wave 0 Requirements

Backfilled phase — Wave 0 was satisfied during the original phase execution. Phase 24 authored Nyquist contracts for Phases 13, 15, 15.1, and 17; all referenced VALIDATION.md files exist and are `nyquist_compliant: true`. No new test files required.

---

## Manual-Only Verifications

None. 24-VERIFICATION.md "Human Verification Required" section confirms: all behaviors covered are either doc-only contracts (verified via file existence + frontmatter grep + Per-Task Map row counts) or code edits with automated test/grep coverage. The two NYQ-05 human-verify checkpoint smoke tests (Phase 13 UAT) were attested PASS and recorded in 13-VERIFICATION.md UAT Closure section during Phase 24 execution.

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
- `.planning/phases/24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryo/24-VERIFICATION.md` (status: passed)
- `.planning/v1.3-MILESTONE-AUDIT.md` §requirements coverage
- CONTEXT.md decisions D-05 (template choice) and D-06 (pointer-doc semantics)
