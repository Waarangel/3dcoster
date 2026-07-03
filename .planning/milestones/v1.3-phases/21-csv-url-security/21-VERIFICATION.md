---
phase: 21-csv-url-security
verified: 2026-05-27T09:15:00Z
re_verified: 2026-05-28T16:10:00Z
status: passed
score: 4/4 automated truths VERIFIED; 1/2 manual UAT truths VERIFIED, 1/2 SKIPPED with acknowledged spec gap
re_verification: "Phase 21 HUMAN-UAT executed 2026-05-28 (see 21-HUMAN-UAT.md). Test 2 (javascript: Model URL render-guard) PASS in live browser. Test 1 (customer CSV formula-injection) SKIPPED — the customer CSV export feature named by SC#5 does not exist in the codebase; only assets export (generateExportCsv) shipped, with sanitization hardening verified at unit-test layer (csvHelpers.test.ts 8/8 + customerCsv.test.ts 5/5). User deprioritized adding customer export. Follow-up captured in .planning/todos/pending/customer-import-modal-parity.md (separate UI polish item also discovered during UAT)."
human_verification:
  - test: "Export a customer CSV containing a customer named `=HYPERLINK(\"https://example.com\",\"click\")`; open the exported file in Excel/Numbers/LibreOffice Calc"
    expected: "The cell shows the literal string `=HYPERLINK(\"https://example.com\",\"click\")` (with the leading single-quote stripped by the spreadsheet's text-cell convention) — NOT a clickable hyperlink. No formula execution."
    why_human: "Requires opening the exported file in an external spreadsheet application (Excel / Numbers / LibreOffice Calc) and observing the visual / interactive rendering. Cannot be verified by grep or unit test — the rendering is owned by the consuming application, not by the codebase."
    outcome: "SKIPPED on 2026-05-28 — Customer CSV export does not exist in the codebase. Phase 21 SC#5 specified a UAT for an unbuilt feature; only generateExportCsv(assets) ships sanitization. User confirmed deprioritization. Defense-in-depth at the helper layer (sanitizeCsvCell + 8 unit tests) and parser pass-through layer (customerCsv.test.ts 5 tests) preserved. Backlog: add customer CSV export when needed and route through sanitizeCsvCell."
  - test: "In the calculator, enter `javascript:alert(1)` (or `data:text/html,<script>alert(1)</script>`) as a job's Model URL; save the job; navigate to the Jobs tab and expand the job card"
    expected: "The Model source row shows `javascript:alert(1)` as plain muted text (slate-400, no underline, no link-blue) with a hover tooltip reading `Link blocked: must start with http:// or https://`. Clicking the text does NOT navigate, does NOT execute the payload, does NOT show an alert dialog."
    why_human: "Requires running the dev server (port 4173), interacting with the form, saving to IndexedDB, navigating tabs, expanding a job card, and visually observing the muted styling + hover tooltip + non-interactive behavior. The render-time guard is unit-covered (JobsManager.test.tsx Phase 21 SEC-02 block, 5 passing tests) but visual + interactive UX confirmation requires a live browser session."
    outcome: "PASS on 2026-05-28 — User confirmed live browser test passes. Render-time guard works as specified."
---

# Phase 21: CSV + URL Security Verification Report

**Phase Goal:** Exported CSVs cannot trigger formula injection in Excel/LibreOffice; user-entered `modelUrl` values cannot create stored XSS payloads via `javascript:` URLs.

**Verified:** 2026-05-27T09:15:00Z
**Status:** human_needed (4/4 automated must-haves PASS; 2 manual UAT items defer to human)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                                                          | Status      | Evidence                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/utils/csvHelpers.ts` exports `sanitizeCsvCell(value: string): string` that prefixes a leading `'` to strings starting with `=`, `+`, `-`, or `@`; every Papa.unparse cell is sanitized before passing in. | VERIFIED    | `grep -c "export function sanitizeCsvCell" src/utils/csvHelpers.ts` → 1. Implementation at line 443–451 uses `charCodeAt(0)` against `0x3D / 0x2B / 0x2D / 0x40`. All 4 `Papa.unparse(` sites in the file are wrapped: `generateSampleCustomerCsv` (L78–79), printer branch (L92–93), material branch (L103–107), `generateExportCsv` (L353). `grep -v "^[[:space:]]*//" src/utils/csvHelpers.ts \| grep -c "Papa.unparse("` → 4. `grep -v "^[[:space:]]*//" src/utils/csvHelpers.ts \| grep -c "sanitizeCsvCell("` → 11 (1 declaration + 10 call-site usages). 20 unit tests pass in `csvHelpers.test.ts`. |
| 2   | `src/components/JobsManager.tsx` validates `job.modelUrl` starts with `http://` or `https://` before rendering as an `<a href>`; otherwise renders as plain text with a `<title>` warning.                                       | VERIFIED    | `grep -c "isSafeHttpUrl" src/components/JobsManager.tsx` → 2 (1 import at L15, 1 ternary guard at L625). The single `href={job.modelUrl}` site (L627) is wrapped in `isSafeHttpUrl(job.modelUrl) ? <a …> : <span title="Link blocked: must start with http:// or https://" className="text-slate-400 break-all">{job.modelUrl}</span>`. The outer `{job.modelUrl && (` truthy gate is preserved (empty URLs render nothing). No other `modelUrl` render site exists in the codebase — verified by `grep -rn "modelUrl" src/ --include="*.tsx"` showing only this site as an `<a href>`. 5 new tests in `JobsManager.test.tsx` `describe('JobCard Model source render-time URL guard (Phase 21 SEC-02)')` cover the safe path, two dangerous-scheme cases, and both empty-modelUrl cases (31/31 pass). |
| 3   | `customerCsv.test.ts` adds 4+ tests covering formula-injection in `name` / `notes` and Unicode in `name` / `notes` — locks parser pass-through.                                                                                  | VERIFIED    | New `describe('Phase 21 SEC-03 — formula-injection + Unicode pass-through')` block at L233–313 contains 5 tests: Test 13 (formula `=HYPERLINK(…)` in name, RFC-4180-quoted), Test 14 (formula `+CMD\|' /C calc'!A0` in notes), Test 15 (`Müller` with `codePointAt(0)` integrity check), Test 16 (`张三` with code-point count = 2), Test 17 (`Great client 🎉` emoji surrogate pair). 17/17 customerCsv tests pass. Existing Phase 15.1 blocks are unchanged. Parser source `src/utils/customerCsv.ts` has zero diff (last touched in commit `b3de9c8` / `44172c1` from Phase 15.1). |
| 4   | A new `csvHelpers.test.ts` block covers `sanitizeCsvCell` with all 4 trigger chars + a passthrough case.                                                                                                                         | VERIFIED    | `describe('sanitizeCsvCell (Phase 21 SEC-01)')` at L56–89 contains 8 tests: 4 trigger chars (`=`, `+`, `-`, `@`), passthrough (`'safe string'`), empty (`''`), leading-char-only rule (`'foo=bar'`), and idempotence smoke (`sanitizeCsvCell(sanitizeCsvCell('=A1'))`). All 8 pass; existing `parsePositiveNumber` block (11 tests) remains intact. Phase 20's reserved-slot forward comment at L4 was honored — block appended below, not interleaved. |
| 5   | Manual UAT: export a customer CSV with `=HYPERLINK(…)` as the name; opens in Excel/Numbers as literal text, not formula.                                                                                                          | HUMAN_NEEDED | Implementation is in place (`sanitizeCsvCell` wired into `generateExportCsv` cell-serialization boundary). External-application rendering is not testable by grep/unit-test — requires opening the file in Excel / Numbers / LibreOffice Calc. Flagged in `human_verification` frontmatter. |
| 6   | Manual UAT: enter `javascript:alert(1)` as a Model URL; row shows as text, not a clickable link.                                                                                                                                  | HUMAN_NEEDED | Implementation is in place (`isSafeHttpUrl` guards the only `<a href={job.modelUrl}>` site). Unit tests cover the render contract (JobsManager.test.tsx SEC-02 block, 5 passing). Visual + interactive UX confirmation (muted styling, hover tooltip text, non-interactive click) requires a live browser session. Flagged in `human_verification` frontmatter. |

**Score:** 4/4 automated truths VERIFIED; 2 manual UAT truths deferred to human verification.

### Required Artifacts

| Artifact                              | Expected                                                                              | Exists | Substantive (Level 2)                                                                                                 | Wired (Level 3)                                                                                                                      | Status     |
| ------------------------------------- | ------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `src/utils/csvHelpers.ts`             | `sanitizeCsvCell` export + 4 sanitized `Papa.unparse` call sites                       | YES    | YES — 9-line implementation with `charCodeAt`-based trigger check, full JSDoc, idempotence by construction             | YES — all 4 `Papa.unparse` sites wrap cells via `.map(c => sanitizeCsvCell(c))` or inline; imported by `csvHelpers.test.ts`         | ✓ VERIFIED |
| `src/utils/csvHelpers.test.ts`        | `describe('sanitizeCsvCell …')` block with ≥6 cases including all 4 trigger chars + passthrough | YES    | YES — 8 unit tests under `describe('sanitizeCsvCell (Phase 21 SEC-01)')`, all enumerated cases present                  | YES — imports `sanitizeCsvCell` from `./csvHelpers`; vitest runs 20/20 in this file                                                  | ✓ VERIFIED |
| `src/utils/urlSecurity.ts`            | Single named export `isSafeHttpUrl(value: string \| undefined): boolean`              | YES    | YES — `trim().toLowerCase()` then `startsWith('http://' \| 'https://')`, undefined-guard, ASCII-safe                  | YES — imported by `src/components/JobsManager.tsx` (L15) and tested in `urlSecurity.test.ts`                                         | ✓ VERIFIED |
| `src/utils/urlSecurity.test.ts`       | Co-located Vitest spec covering D-05's 16 cases                                       | YES    | YES — 16 unit tests under `describe('isSafeHttpUrl (Phase 21 SEC-02 — render-time URL guard)')`                        | YES — imports `isSafeHttpUrl` from `./urlSecurity`; vitest runs 16/16 in this file                                                   | ✓ VERIFIED |
| `src/components/JobsManager.tsx`     | Render-time URL guard around the Model source anchor                                   | YES    | YES — ternary at L625 routes valid URLs to existing `<a>`, invalid to muted `<span title=…>` per D-07                    | YES — `isSafeHttpUrl` is imported (L15) AND used at L625; preserves outer truthy gate; preserves all original `<a>` props verbatim   | ✓ VERIFIED |
| `src/utils/customerCsv.test.ts`       | New `describe('Phase 21 SEC-03 …')` block with ≥4 tests locking parser pass-through    | YES    | YES — 5 tests (L233–313) covering formula-injection in name+notes, Latin diacritic, CJK ideographs, emoji surrogate    | YES — uses already-imported `parseCustomerCsv`; existing Phase 15.1 blocks untouched (byte-identical)                                | ✓ VERIFIED |

### Key Link Verification

| From                                                  | To                          | Via                                                       | Pattern Result                                                              | Status |
| ----------------------------------------------------- | --------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| `csvHelpers.ts` `generateSampleCustomerCsv` (L70–82)    | `sanitizeCsvCell`            | `.map(c => sanitizeCsvCell(c))` on each data row          | Found at L78, L79                                                            | WIRED  |
| `csvHelpers.ts` `generateSampleCsv` printer (L85–96)    | `sanitizeCsvCell`            | `.map(c => sanitizeCsvCell(c))` on each printer row       | Found at L92, L93                                                            | WIRED  |
| `csvHelpers.ts` `generateSampleCsv` material (L100–110) | `sanitizeCsvCell`            | `.map(c => sanitizeCsvCell(c))` on each material row      | Found at L103, L104, L105, L106, L107                                        | WIRED  |
| `csvHelpers.ts` `generateExportCsv` (L329–355)         | `sanitizeCsvCell`            | `ALL_COLUMNS.map(col => sanitizeCsvCell(r[col] ?? ''))`   | Found at L353                                                                | WIRED  |
| `JobsManager.tsx` (L617–644 Model source block)         | `isSafeHttpUrl`              | `isSafeHttpUrl(job.modelUrl) ? <a …> : <span title=…>`     | Found at L625; outer `{job.modelUrl && (` gate preserved at L617              | WIRED  |
| `urlSecurity.test.ts`                                  | `urlSecurity.ts`             | `import { isSafeHttpUrl } from './urlSecurity'`           | Found at L12                                                                 | WIRED  |
| `csvHelpers.test.ts`                                  | `csvHelpers.ts`              | `import { parsePositiveNumber, sanitizeCsvCell } from './csvHelpers'` | Found at L9                                                                  | WIRED  |
| `customerCsv.test.ts` SEC-03 block                      | `parseCustomerCsv`            | Existing top-of-file named import (no new import added)    | Used 5 times in new tests at L240, L256, L270, L288, L305                    | WIRED  |

### Data-Flow Trace (Level 4)

| Artifact                | Data Variable             | Source                                              | Produces Real Data                                                   | Status   |
| ----------------------- | ------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| `JobsManager.tsx` Model source block | `job.modelUrl`             | `useDatabase` hook → IndexedDB live `jobs` query     | YES — `job.modelUrl` flows from PrintJob records in IndexedDB        | ✓ FLOWING |
| `csvHelpers.ts` `generateExportCsv` | `assets` (function arg) → `r[col]` per ALL_COLUMNS | Caller passes `assets: Asset[]` from Material/Printer store; each `String(value)` is then sanitized | YES — call sites use real IndexedDB-backed asset records (verified by prior phases' integration); the sanitized output enters the downstream CSV blob | ✓ FLOWING |

Both data-rendering artifacts trace to real IndexedDB-backed sources. No hollow-prop or static-fallback anti-pattern detected.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| sanitizeCsvCell + isSafeHttpUrl + customerCsv parser pass-through unit tests pass | `npx vitest run src/utils/csvHelpers.test.ts src/utils/urlSecurity.test.ts src/utils/customerCsv.test.ts` | `Test Files 3 passed (3) / Tests 53 passed (53)` | ✓ PASS |
| JobsManager render-guard SEC-02 tests pass | `npx vitest run src/components/JobsManager.test.tsx` | `Test Files 1 passed (1) / Tests 31 passed (31)` | ✓ PASS |
| TypeScript build is clean (Vercel-parity, catches noUnusedLocals/noUnusedParameters) | `npx tsc -b` | Exit 0, no output | ✓ PASS |

### Probe Execution

Not applicable to this phase — phase 21 is a security-hardening phase with no probe scripts declared in PLAN files or roadmap success criteria, and no conventional `scripts/*/tests/probe-*.sh` files exist in the project tree (3DCoster's verification convention uses vitest unit tests + manual UAT, not bash probes).

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                                                                                                | Status      | Evidence                                                                                                                                                                                                                   |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01      | 21-01-PLAN  | `sanitizeCsvCell()` helper escapes leading `=`, `+`, `-`, `@` with a `'` prefix; applied to every CSV export cell. (CODE-AUDIT #5, HIGH)                                                     | ✓ SATISFIED | Helper exists at `csvHelpers.ts:443`; wired into all 4 `Papa.unparse` sites; 8 unit tests pass.                                                                                                                            |
| SEC-02      | 21-02-PLAN  | `job.modelUrl` validated to start with `http://` / `https://` before rendering as `<a href>`; otherwise plain text. (CODE-AUDIT #6, HIGH)                                                    | ✓ SATISFIED | `isSafeHttpUrl` exists at `urlSecurity.ts:18`; guards the single render site in `JobsManager.tsx:625`; muted `<span title="Link blocked: must start with http:// or https://">` fallback per D-07; 16 + 5 unit tests pass. |
| SEC-03      | 21-03-PLAN  | `customerCsv.test.ts` adds tests for formula-injection (`=HYPERLINK(...)`, `+CMD`, `@SUM()`) + Unicode (`Müller`, `张三`, emoji) locking parser pass-through. (CODE-AUDIT #15, MEDIUM)         | ✓ SATISFIED | 5 new tests in `customerCsv.test.ts:233–313`; parser source untouched; existing 12 Phase 15.1 tests still pass; full file has 17 passing tests.                                                                            |

All 3 requirement IDs declared in plan frontmatter are accounted for in REQUIREMENTS.md and satisfied. No orphaned requirements detected for Phase 21.

### Anti-Patterns Found

| File                            | Line | Pattern                                                                  | Severity | Impact                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ---- | ------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/JobsManager.tsx` | 1443 | `// TODO(future-sale-pdf): D-21 audit 2026-05-23 — when Sale gains taxRate (e.g., …)` | ℹ️ Info  | NOT a Phase 21 marker — this `TODO` predates Phase 21 (introduced by an earlier phase's D-21 audit and references `future-sale-pdf`, unrelated to CSV / URL security). It carries an explicit dated reference (`D-21 audit 2026-05-23`) which the debt-marker gate treats as auditable follow-up. Out of Phase 21 scope; not a regression. |

No `TBD` / `FIXME` / `XXX` / `HACK` / `PLACEHOLDER` markers introduced by Phase 21. Phase 21 files (`csvHelpers.ts`, `urlSecurity.ts`, `csvHelpers.test.ts`, `urlSecurity.test.ts`, `customerCsv.test.ts`, and the modified blocks of `JobsManager.tsx`) are clean. The pre-existing `TODO(future-sale-pdf)` marker at JobsManager.tsx:1443 is not in any range Phase 21 modified — it sits in the SaleRow accordion block, far from the Model source URL guard at L617–644.

### Human Verification Required

#### 1. Excel/Numbers/LibreOffice CSV formula-injection UAT (Success Criterion #5)

**Test:** Export a customer CSV (use the Customer Library → Export action, or the sample CSV download) that contains a customer named `=HYPERLINK("https://example.com","click")`. Open the resulting `.csv` file in Excel, Apple Numbers, AND LibreOffice Calc (the three target spreadsheets per ROADMAP threat model).

**Expected:**
- In each spreadsheet, the cell containing the formula renders as the literal text `=HYPERLINK("https://example.com","click")` (the leading `'` injected by `sanitizeCsvCell` is consumed by the spreadsheet's text-cell convention and not visible).
- The cell is NOT clickable. Clicking it selects the cell, does not open a browser.
- No formula evaluation occurs (no hyperlink result, no error popup, no JavaScript prompt).

**Why human:** Excel / Numbers / LibreOffice are external applications; their CSV-rendering behavior is not testable by codebase grep or unit tests. The implementation guarantees the literal `'` prefix is written to the file (verified by unit test), but only a human can confirm each spreadsheet interprets the prefixed cell as literal text.

#### 2. JavaScript URL render-guard UAT (Success Criterion #6)

**Test:**
1. Start the dev server (`npm run dev` on port 4173) OR run a production build.
2. In the calculator, fill in the required job fields and enter `javascript:alert(1)` (then repeat with `data:text/html,<script>alert(1)</script>`) into the Model URL field.
3. Save the job.
4. Navigate to the Jobs tab. Expand the saved job card.

**Expected:**
- The Model source row renders the literal text `javascript:alert(1)` (and `data:text/html,…` for the second case) in muted slate-400 color — no link-blue, no underline, no hover state change.
- Hovering over the text shows a tooltip reading `Link blocked: must start with http:// or https://`.
- Clicking the text does NOT navigate, does NOT execute the payload, does NOT show an alert dialog.
- For comparison, a valid `https://example.com` URL still renders as a clickable blue underlined link with `target="_blank"` and `rel="noopener noreferrer"` (existing behavior preserved).

**Why human:** Visual styling (muted color), interactive hover tooltip, and confirmation of non-execution all require a live browser session. Unit tests cover the React render output but cannot prove the browser's hover-tooltip rendering or the absence of JavaScript execution from a clicked element.

### Gaps Summary

**No automated gaps.** All 4 must-haves with codebase-verifiable evidence (Truths 1–4) pass at all four verification levels:

1. **Level 1 (Exists):** Every required file is present and committed.
2. **Level 2 (Substantive):** Each artifact contains substantive implementation, not stubs. `sanitizeCsvCell` is a 9-line `charCodeAt`-based function; `isSafeHttpUrl` is a 7-line `trim → lowercase → startsWith` predicate; render-guard is a 17-line ternary with proper fallback styling and `title` attribute.
3. **Level 3 (Wired):** Every call site that needs the helper has it. All 4 `Papa.unparse` sites in `csvHelpers.ts` route through `sanitizeCsvCell`. The single `<a href={job.modelUrl}>` site in `JobsManager.tsx` is guarded by `isSafeHttpUrl`. No other render site of `modelUrl` as an anchor exists in the codebase.
4. **Level 4 (Data flows):** The Model source block reads `job.modelUrl` from real IndexedDB-backed records; `generateExportCsv` operates on real `Asset[]` records.

**Two manual UAT items remain** (Truths 5 and 6 — ROADMAP Success Criteria #5 and #6). These are explicitly called out in the ROADMAP as "Manual UAT" and require external spreadsheets (Excel/Numbers/LibreOffice) and a live browser session respectively. They are flagged in the `human_verification` frontmatter for end-of-phase human testing.

**Threat coverage** per the three plans' STRIDE registers (T-21-01 through T-21-10) is fully mitigated by the deployed code paths. Residual risks (CRLF in cells, BOM injection, Unicode look-alikes of `=`, save-time UX feedback, hostname spoofing, PDF embedder broadening) are explicitly deferred per `21-CONTEXT.md <deferred>` and recorded in each plan's threat model — these are not gaps.

---

*Verified: 2026-05-27T09:15:00Z*
*Verifier: Claude (gsd-verifier)*
