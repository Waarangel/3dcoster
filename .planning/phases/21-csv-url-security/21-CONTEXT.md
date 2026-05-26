---
phase: 21-csv-url-security
created: 2026-05-26
status: ready_to_research
---

# Phase 21: CSV + URL security — Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Exported CSVs cannot trigger formula injection in Excel/LibreOffice, and user-entered `modelUrl` values cannot create stored XSS payloads via `javascript:` (or other dangerous schemes) when rendered as anchor links. Hardening-only — no new user-facing capabilities. Three audit findings close: SEC-01 (CSV sanitization), SEC-02 (URL render guard), SEC-03 (parser-passthrough edge-case tests).

</domain>

<decisions>
## Implementation Decisions

### CSV sanitization

- **D-01:** `sanitizeCsvCell(value: string): string` lives in `src/utils/csvHelpers.ts`, exported. Prefixes a single `'` to any string whose first character is `=`, `+`, `-`, or `@`. Returns the value unchanged otherwise. Idempotent (calling twice does not double-prefix — applied only when raw input matches the trigger pattern). Locked by [ROADMAP](.planning/ROADMAP.md#phase-21) success criteria #1 + [v1.2-CODE-AUDIT.md](v1.2-CODE-AUDIT.md) finding #5.
- **D-02:** **Universal coverage** — every `Papa.unparse` call site in `csvHelpers.ts` sanitizes every string cell before passing to PapaParse. Four sites: `generateExportCsv` (assets), `generateSampleCsv('material')`, `generateSampleCsv('printer')`, `generateSampleCustomerCsv`. Templates are no-op in practice (hardcoded strings don't start with `= + - @`), but the invariant "every cell written to CSV passes through `sanitizeCsvCell`" is enforceable by `grep "Papa.unparse"` and removes future judgment calls from contributors.
- **D-03:** Sanitization applies at the **cell-serialization boundary** (immediately before the value enters the `data` array passed to `Papa.unparse`), NOT inside `Papa.unparse` itself. This keeps the helper pure and makes the call sites self-documenting.

### URL validation

- **D-04:** New helper module `src/utils/urlSecurity.ts` exports `isSafeHttpUrl(value: string | undefined): boolean`. Implementation: `trim()` the input, lowercase it, return `true` iff it starts with `http://` or `https://`. Returns `false` for undefined, empty, whitespace-only, all non-http(s) schemes (`javascript:`, `data:`, `vbscript:`, `file:`, mailto:, etc.), and any malformed input. Reusable for future render sites (PDF embedder, eventual quote-share pages).
- **D-05:** Co-located test file `src/utils/urlSecurity.test.ts` covers: valid `http://`, valid `https://`, `JavaScript:alert(1)` (lowercase normalization), `  javascript:alert(1)` (whitespace trim), bare `javascript:alert(1)`, `data:text/html,...`, `vbscript:`, `file:///etc/passwd`, empty string, undefined, plain word `"foo"`, `http:foo` (no slashes).
- **D-06:** **Render-time only** validation at `src/components/JobsManager.tsx:620` (the existing `<a href={job.modelUrl}>` block). No save-time validation in `CostCalculator` — out of scope for this phase, IndexedDB stays a permissive string store, existing jobs untouched. Audit-aligned ("one-line guard at render"). If a future phase wants input-time UX feedback, the same `isSafeHttpUrl` helper is ready.
- **D-07:** **Invalid-URL render fallback** — render the URL as plain text (not omitted) with a `title` attribute warning: `<span title="Link blocked: must start with http:// or https://">{job.modelUrl}</span>`. Self-healing UX — user sees what they typed (and the warning) so they can edit it. Wraps the existing "Model source: ..." label so the row still appears.

### Test coverage

- **D-08:** `customerCsv.test.ts` gains 3–4 new test cases under a new `describe('Phase 21 SEC-03 — formula-injection + Unicode pass-through')` block (does not modify existing locked-contract tests). Cases:
  - Formula-injection in `name` (`=HYPERLINK("https://evil.com","click")`) → parser preserves the literal string verbatim; built Customer's `name` equals the raw input character-for-character.
  - Formula-injection in `notes` (`+CMD|' /C calc'!A0`) → same pass-through assertion.
  - Unicode in `name` (`Müller`, `张三`) → preserved exactly, no NFC/NFD normalization, no character loss.
  - Emoji in `notes` (`Great client 🎉`) → preserved exactly.
  - Locks the **parser-passthrough** behavior. Does NOT test `sanitizeCsvCell` here — `csvHelpers.test.ts` owns that. Comment in the new describe block explicitly states the separation.
- **D-09:** `csvHelpers.test.ts` gains a new `describe('sanitizeCsvCell (Phase 21 SEC-01)')` block appended below the existing `parsePositiveNumber` describe (Phase 20 left an inline comment reserving this slot). Cases: `=SUM(A1:A10)` → `'=SUM(A1:A10)`; `+CMD` → `'+CMD`; `-2+3` → `'-2+3`; `@SUM()` → `'@SUM()`; `"safe string"` → `"safe string"` (passthrough); `""` → `""`; multi-char strings starting with safe char then containing trigger (`"foo=bar"`) → unchanged (only leading char matters); idempotence smoke (`sanitizeCsvCell(sanitizeCsvCell("=A1"))` does NOT double-prefix because the second call sees a string starting with `'`, not a trigger char).

### Plan structure

- **D-10:** Three plans per ROADMAP suggestion:
  - **21-01** — `sanitizeCsvCell` helper + `csvHelpers.test.ts` block + apply universally to all 4 `Papa.unparse` sites in `csvHelpers.ts`.
  - **21-02** — `urlSecurity.ts` + `urlSecurity.test.ts` + render-time guard in `JobsManager.tsx:620` with plain-text + title fallback.
  - **21-03** — `customerCsv.test.ts` SEC-03 describe block (formula-injection + Unicode passthrough tests).
  - Plans can ship independently — no inter-plan dependencies. 21-01 and 21-02 can run in parallel waves.

### Claude's Discretion

- Exact wording of the `title` attribute warning — pick a short, clear message; if it's awkward Claude can adjust at planning.
- Exact comment text inside the new test describe blocks — must explain the test family's purpose but wording is open.
- Whether to inline-export `isSafeHttpUrl` from `urlSecurity.ts` as the single export, or add minor adjacent helpers if they emerge naturally (e.g., `assertSafeHttpUrl` for future throw-style validation). Don't speculate — start with one export and grow only if a real call site needs more.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- [.planning/ROADMAP.md](.planning/ROADMAP.md) — Phase 21 success criteria (6 numbered criteria), suggested plan breakdown (~3 plans), dependency note (none).
- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) §Security — SEC-01, SEC-02, SEC-03 traceability; each maps to a specific audit finding.
- [.planning/v1.2-CODE-AUDIT.md](.planning/v1.2-CODE-AUDIT.md) — Findings #5 (CSV formula injection, lines 114–124), #6 (modelUrl javascript: render, lines 126–134), #15 (customerCsv missing edge cases, lines 235–243). Severity + fix rationale.

### Implementation sites
- [src/utils/csvHelpers.ts](src/utils/csvHelpers.ts) — All 4 `Papa.unparse` call sites: `generateSampleCustomerCsv` (line 70), `generateSampleCsv` printer branch (line 82), `generateSampleCsv` material branch (line 91), `generateExportCsv` (line 320). New `sanitizeCsvCell` helper lands here; new tests append to existing `csvHelpers.test.ts`.
- [src/utils/csvHelpers.test.ts](src/utils/csvHelpers.test.ts) — Existing file (42 lines, `parsePositiveNumber` describe from Phase 20). **Line 4 comment** explicitly reserves Phase 21's `sanitizeCsvCell` describe block — append below, don't re-author the file.
- [src/components/JobsManager.tsx:620](src/components/JobsManager.tsx) — The `<a href={job.modelUrl}>` render site (full block: lines 616–629). Wrap with `isSafeHttpUrl(job.modelUrl)` check; fall back to plain-text `<span title="...">`.
- [src/utils/customerCsv.ts](src/utils/customerCsv.ts) — Parser already passes through raw cell values (no escaping). New tests in [src/utils/customerCsv.test.ts](src/utils/customerCsv.test.ts) (217 lines, 12 existing tests) lock this behavior without modifying existing assertions.

### Standing rules
- User auto-memory — `[[feedback_reconcile_legacy_data]]` does NOT apply here (no derived stored fields, no schema bump).
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — `tsc -b` (not `--noEmit`) for local TypeScript verification.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PapaParse `Papa.unparse`** — already used everywhere CSV is produced; sanitizer just runs before values land in the `data` array.
- **Phase 20 forward-comment in `csvHelpers.test.ts:4`** — Phase 20 already wrote `// Phase 21 (SEC) will append a describe('sanitizeCsvCell') block below`. Honor it.
- **Existing `<a href>` render at JobsManager:620** — only render site of `modelUrl` as a link (verified by grep). One-site fix.

### Established Patterns
- **Helper + co-located test file** — every util in `src/utils/` has a `.test.ts` sibling (`csvHelpers.test.ts`, `customerCsv.test.ts`, `duplicateJob.test.ts`). `urlSecurity.ts` + `urlSecurity.test.ts` follows the same shape.
- **`describe` blocks scoped by phase** — `customerCsv.test.ts` already has `describe('parseCustomerCsv (Phase 15.1 — CL-03 / D-09 / D-07)')`. Phase 21 additions follow the same `describe('Phase 21 SEC-03 — …')` convention.
- **Conventions** ([.planning/codebase/CONVENTIONS.md](.planning/codebase/CONVENTIONS.md)) — camelCase utils, single-quote strings, 2-space indent, named exports, ESLint strict (`noUnusedLocals`).

### Integration Points
- `sanitizeCsvCell` is called inline at the 4 `Papa.unparse` sites in `csvHelpers.ts`. No new module boundaries crossed.
- `isSafeHttpUrl` is imported into `JobsManager.tsx` only (for this phase). PDF generator (`src/pdf/generateQuotePdf.ts`) currently embeds nothing user-typed as a clickable link — **do not** broaden the integration as part of this phase (deferred).

</code_context>

<specifics>
## Specific Ideas

- `title` attribute on invalid-URL fallback so the user has a self-healing signal — not a toast, not a console warning, just an inline tooltip on the now-plain-text URL.
- `isSafeHttpUrl` named to read as a predicate at call sites: `if (isSafeHttpUrl(job.modelUrl)) { … }`.
- New `describe` blocks named with the audit ID (`Phase 21 SEC-01`, `Phase 21 SEC-03`) so future debugging traces from test name → phase → audit finding instantly.

</specifics>

<deferred>
## Deferred Ideas

- **Save-time `modelUrl` validation in `CostCalculator`** — would require form-validation UX (error message, inline feedback, disable-save logic). Out of scope for hardening milestone; render-time guard fully neutralizes the attack vector. Note for a future UX-quality phase.
- **`new URL()` parsing for richer URL validation** — would catch encoded payloads and weird hostnames the prefix check misses. Marginal added safety; prefix check sufficient for `javascript:`/`data:`/`vbscript:` blocking. Deferred unless a real-world exploit surfaces.
- **Customer CSV export path** — does not exist today (only import). Adding `generateExportCustomerCsv` would be a NEW capability and a separate phase; the universal-coverage decision (D-02) ensures any future export path inherits sanitization automatically.
- **`assertSafeHttpUrl` throw-style helper in `urlSecurity.ts`** — only add when a real call site needs it (e.g., a render path that must hard-fail rather than degrade).

</deferred>

---

*Phase: 21-csv-url-security*
*Context gathered: 2026-05-26*
