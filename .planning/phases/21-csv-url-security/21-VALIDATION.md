---
phase: 21
slug: csv-url-security
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-27
---

# Phase 21 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively from PLAN.md / SUMMARY.md after Wave 1 execution; one Nyquist gap (SEC-01 export-flow integration) filled by `gsd-nyquist-auditor` on 2026-05-27.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (jsdom environment) |
| **Config file** | [vitest.config.ts](vitest.config.ts) |
| **Quick run command** | `npm test -- csvHelpers urlSecurity customerCsv --run` |
| **Full suite command** | `npm test -- --run` |
| **Typecheck command** | `npx tsc -b` (Vercel-parity per project CLAUDE.md) |
| **Estimated runtime** | ~5 s (full); ~1 s (Phase 21 files only) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- {touched-file} --run`
- **After every plan wave:** Run `npm test -- --run` + `npx tsc -b`
- **Before `/gsd:verify-work`:** Full suite green + tsc clean
- **Max feedback latency:** ~5 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | SEC-01 | T-21-01, T-21-02, T-21-03 | `sanitizeCsvCell` prefixes `'` to cells whose first char is `=`, `+`, `-`, or `@`; passes through otherwise; idempotent | unit | `npm test -- csvHelpers --run` (cases at [csvHelpers.test.ts:56](src/utils/csvHelpers.test.ts:56)) | ✅ | ✅ green (8/8) |
| 21-01-02 | 01 | 1 | SEC-01 | T-21-01, T-21-02 | Every `Papa.unparse` site in `csvHelpers.ts` wraps cells in `sanitizeCsvCell` (4 sites: lines 75/89/100/351) — universal coverage invariant | structural (grep) + integration | `grep -c "Papa.unparse(" src/utils/csvHelpers.ts` → 4; `grep -c "sanitizeCsvCell(" src/utils/csvHelpers.ts` ≥ 5; AND `npm test -- csvHelpers --run` covers `generateExportCsv` integration | ✅ | ✅ green |
| 21-01-N (gap-fill) | 01 | retro | SEC-01 | T-21-01, T-21-02, T-21-03 | `generateExportCsv` end-to-end: an asset with `name = '=HYPERLINK(...)'` produces a CSV cell starting with `'=`; safe strings pass through; template generators produce zero formula-prefixed cells | integration | `npm test -- csvHelpers --run` (5 new cases in `describe('Phase 21 SEC-01 — generateExportCsv integration')` at end of [csvHelpers.test.ts](src/utils/csvHelpers.test.ts)) | ✅ | ✅ green (5/5, added 2026-05-27) |
| 21-02-01 | 02 | 1 | SEC-02 | T-21-04, T-21-05, T-21-06, T-21-07 | `isSafeHttpUrl(v)` returns true only for strings whose `trim().toLowerCase()` starts with `http://` or `https://`; false for `javascript:`, `data:`, `vbscript:`, `file:`, `mailto:`, empty, undefined, case-variant, whitespace-padded | unit | `npm test -- urlSecurity --run` (16 cases at [urlSecurity.test.ts:14](src/utils/urlSecurity.test.ts:14)) | ✅ | ✅ green (16/16) |
| 21-02-02 | 02 | 1 | SEC-02 | T-21-04, T-21-05 | `JobCard` Model-source block renders `<a href>` for safe URLs and `<span title="Link blocked: …">` for unsafe URLs; renders nothing for empty/undefined; outer truthy gate preserved | integration (createRoot + DOM query) | `npm test -- JobsManager --run` (4 cases at [JobsManager.test.tsx:633](src/components/JobsManager.test.tsx:633)) | ✅ | ✅ green (4/4) |
| 21-03-01 | 03 | 1 | SEC-03 | T-21-08, T-21-09, T-21-10 | `parseCustomerCsv` preserves formula-injection cells byte-for-byte (`=HYPERLINK(...)`, `+CMD|' /C calc'!A0`) and Unicode codepoints (`Müller`, `张三`, `Great client 🎉`) WITHOUT applying any escaping (round-trip invariant — sibling export path owns sanitization) | regression-lock unit | `npm test -- customerCsv --run` (5 cases in `describe('Phase 21 SEC-03 …')` at [customerCsv.test.ts:233](src/utils/customerCsv.test.ts:233)) | ✅ | ✅ green (5/5) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing Vitest + jsdom infrastructure covered all phase requirements. No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Excel / LibreOffice Calc / Numbers renders an exported `'=HYPERLINK("https://evil.com","click")` cell as a literal string (no clickable hyperlink, no formula execution) | SEC-01 / T-21-03 | External-tool render — automated assertion requires running Excel/Numbers as a subprocess and reading rendered cells. The unit test (`sanitizeCsvCell('=HYPERLINK(...)')` → `'=HYPERLINK(...)`) and integration test (`generateExportCsv` → CSV with prefixed cell) together prove the contract on our side of the boundary; the spreadsheet-side render is by external-tool convention. | Tracked in [21-HUMAN-UAT.md](.planning/phases/21-csv-url-security/21-HUMAN-UAT.md) test #1. |
| Clicking a `javascript:alert(1)` Model URL in a real browser does NOT execute the payload | SEC-02 / T-21-04 | Real-browser DOM click — jsdom does not navigate or execute `javascript:` URLs the way Chromium/Firefox/Safari do. The createRoot + DOM-query integration test asserts that the unsafe-URL branch renders `<span title="…">` instead of `<a href>`, which is the necessary-and-sufficient structural mitigation; a live-browser check is the final cross-environment confirmation. | Tracked in [21-HUMAN-UAT.md](.planning/phases/21-csv-url-security/21-HUMAN-UAT.md) test #2. |

---

## Structural Verifications (acceptance-grep)

These behaviors are verified by acceptance-criteria grep rather than per-assertion tests. They are not "manual-only" — they fail loud at PR time and at CI typecheck time.

| Behavior | Requirement | Verification |
|----------|-------------|--------------|
| `customerCsv.ts` parser does NOT call `sanitizeCsvCell` (round-trip invariant T-21-10) | SEC-03 | `grep -c "sanitizeCsvCell" src/utils/customerCsv.ts` returns 0 (also asserted by the SEC-03 unit cases via byte-for-byte equality on adversarial inputs) |
| `urlSecurity.ts` does NOT use `new URL(...)` (deferred richer-validation path) | SEC-02 D-04 | `grep -c "new URL(" src/utils/urlSecurity.ts` returns 0 |
| `csvHelpers.ts` exports exactly 4 `Papa.unparse` call-sites, each wrapped in `sanitizeCsvCell` | SEC-01 D-02 | `grep -c "Papa.unparse("` returns 4; `grep -c "sanitizeCsvCell("` returns ≥ 5 |
| `JobsManager.tsx` outer truthy gate `{job.modelUrl && (…)}` preserved (empty URLs render nothing) | SEC-02 D-06 | `grep -c "job.modelUrl && ("` returns 1 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none required — existing Vitest+jsdom stack)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

---

## Audit Trail

### Validation Audit 2026-05-27

| Metric | Count |
|--------|-------|
| Requirements | 3 (SEC-01, SEC-02, SEC-03) |
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |
| Manual-only retained | 2 |

**Notes:** Retroactive State B reconstruction. Pre-audit state: SEC-01 helper unit (8 cases), SEC-02 helper unit (16 cases), SEC-02 JobsManager render guard (4 cases), SEC-03 parser pass-through (5 cases), and 2 manual UAT items in [21-HUMAN-UAT.md](.planning/phases/21-csv-url-security/21-HUMAN-UAT.md) were already in place. Gap: no integration test asserting `generateExportCsv` produces a sanitized CSV string given an adversarial row. Filled by appending a 5-case `Phase 21 SEC-01 — generateExportCsv integration` describe block at end of [csvHelpers.test.ts](src/utils/csvHelpers.test.ts) using PapaParse re-parse for robust assertion. Total Phase-21-related tests: 38 across 4 files; full suite 402 pass + 1 todo (no regressions); `tsc -b` clean.

**Approval:** verified 2026-05-27
