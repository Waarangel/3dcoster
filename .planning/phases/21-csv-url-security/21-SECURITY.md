---
phase: 21
slug: csv-url-security
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-27
---

# Phase 21 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Generated from PLAN.md `<threat_model>` blocks (21-01/02/03) and verified by `gsd-security-auditor` on 2026-05-27.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User input → IndexedDB | Asset names, brands, notes, tags, currencies are typed by the user and stored verbatim (permissive string store). No escaping at the storage boundary — by design. | User-typed strings (untrusted) |
| IndexedDB → CSV export → External spreadsheet | User-typed strings re-enter an external trust domain (Excel / LibreOffice / Numbers) which interprets cells starting with `=`, `+`, `-`, or `@` as formulas. **This is the boundary hardened by plan 21-01 via `sanitizeCsvCell`.** | Per-cell strings (untrusted → spreadsheet formula interpreter) |
| User input (CostCalculator form) → IndexedDB | `job.modelUrl` is typed by the user and stored verbatim. No save-time validation (deferred — D-06). | URL string (untrusted) |
| IndexedDB → React render → DOM `<a href>` | The DOM treats `href="javascript:..."` as an executable URL scheme. Clicking such a link runs the payload in the page's origin → stored XSS. **This is the boundary hardened by plan 21-02 via `isSafeHttpUrl`.** | URL string (untrusted → DOM URL parser) |
| External CSV (user-uploaded file) → `parseCustomerCsv` → IndexedDB | Raw CSV cell values cross from an external trust domain (file picked by user, possibly from a third-party export or shared spreadsheet) into the in-process IndexedDB store. **Plan 21-03 locks the inverse invariant: the parser must NEVER re-escape values, or round-trip identity breaks.** | CSV cell values (untrusted → in-process store) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-21-01 | Tampering — CSV Formula Injection (CWE-1236) | `generateExportCsv` in `src/utils/csvHelpers.ts` | mitigate | `sanitizeCsvCell` declared at [csvHelpers.ts:443](src/utils/csvHelpers.ts:443); applied at [csvHelpers.ts:353](src/utils/csvHelpers.ts:353). Trigger set `{=, +, -, @}` at line 447. Locked by 8 SEC-01 cases at [csvHelpers.test.ts:56](src/utils/csvHelpers.test.ts:56). | closed |
| T-21-02 | Tampering — Defense in depth on template generators | `generateSampleCustomerCsv`, `generateSampleCsv` in csvHelpers.ts | mitigate | Universal coverage — all 4 `Papa.unparse` call sites wrap output cells in `sanitizeCsvCell`: [csvHelpers.ts:78–79](src/utils/csvHelpers.ts:78), [92–93](src/utils/csvHelpers.ts:92), [103–107](src/utils/csvHelpers.ts:103), [353](src/utils/csvHelpers.ts:353). | closed |
| T-21-03 | Information Disclosure — `=HYPERLINK("https://evil.com","click")` rendered in exported cell | exported asset cell | mitigate via T-21-01 | Single-quote prefix demotes formula to literal string. Verified: `sanitizeCsvCell('=HYPERLINK(...)')` returns `'=HYPERLINK(...)`. Closed-with-concerns — see audit notes. | closed |
| T-21-04 | Tampering / XSS — Stored XSS via `<a href={job.modelUrl}>` (CWE-79) | `JobsManager.tsx` Model source block | mitigate | `isSafeHttpUrl` imported at [JobsManager.tsx:15](src/components/JobsManager.tsx:15); render-time ternary guard at [JobsManager.tsx:625](src/components/JobsManager.tsx:625); invalid URLs render `<span title="Link blocked: …">` fallback at lines 636–641. Outer truthy gate `{job.modelUrl && (…)}` preserved at line 617. | closed |
| T-21-05 | Information Disclosure — `data:text/html,...` phishing | URL scheme guard | mitigate via T-21-04 | `isSafeHttpUrl` rejects `data:` by construction (only `http://`/`https://` after `trim().toLowerCase()` pass). Test case at [urlSecurity.test.ts:39](src/utils/urlSecurity.test.ts:39). | closed |
| T-21-06 | Tampering — `JavaScript:` case bypass | URL scheme guard | mitigate | `toLowerCase()` applied before prefix check at [urlSecurity.ts:22](src/utils/urlSecurity.ts:22). Test case at [urlSecurity.test.ts:31](src/utils/urlSecurity.test.ts:31). | closed |
| T-21-07 | Tampering — whitespace-padded `  javascript:alert(1)` bypass | URL scheme guard | mitigate | `trim()` applied before `toLowerCase()` at [urlSecurity.ts:22](src/utils/urlSecurity.ts:22). Test case at [urlSecurity.test.ts:34](src/utils/urlSecurity.test.ts:34). | closed |
| T-21-08 | Tampering / Repudiation — Parser neutralization regression (CWE-707) | `parseCustomerCsv` in `src/utils/customerCsv.ts` | mitigate (regression lock) | SEC-03 describe block at [customerCsv.test.ts:233](src/utils/customerCsv.test.ts:233). Tests 13–14 (lines 234, 249) lock formula-injection byte-for-byte pass-through. `sanitizeCsvCell` absent from `customerCsv.ts` (grep count = 0). | closed |
| T-21-09 | Information Disclosure — Unicode mishandling (CWE-176) | parser preserves codepoints | mitigate (regression lock) | Tests 15–17 at [customerCsv.test.ts:265](src/utils/customerCsv.test.ts:265): `Müller` codepoint equality, `张三` `[...name].length === 2`, `Great client 🎉` surrogate-pair integrity. | closed |
| T-21-10 | Tampering — Round-trip double-prefix (export ↔ import) | inverse invariant on parser | mitigate by complement | Parser does NOT call `sanitizeCsvCell` (grep returns 0 in `customerCsv.ts`); tests 13–14 in `customerCsv.test.ts` assert no `'` prefix on formula inputs entering the parser. | closed |
| T-21-SC | Tampering — Supply chain (npm) | npm/pip/cargo installs | accept | No new dependencies introduced by any of the three plans; `papaparse` and `vitest` pinned at Phase 19 audit baseline. See Accepted Risks Log. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-21-SC | Supply chain — npm package tampering | No new dependencies introduced in Phase 21. `papaparse` and `vitest` remain pinned at the Phase 19 dependency-audit baseline. Phase scope does not widen the supply-chain attack surface. | Phase 21 plan authors (21-01/02/03) | 2026-05-27 |

*Residual risks explicitly out of scope (recorded per 21-CONTEXT.md `<deferred>`; not re-litigated by future audits):*

- **CRLF injection in CSV cells** — `Papa.unparse` quote-wraps multi-line strings; residual risk low.
- **UTF-8 BOM injection** — exporter does not prepend BOM today.
- **Unicode look-alikes** of `=` (e.g. U+FF1D `＝`) — not treated as formula triggers by Excel.
- **Save-time UX feedback** for `javascript:` URL inputs — render-time guard fully neutralizes the attack vector; inline form-validation deferred to future UX phase.
- **`new URL()` parsing** for richer URL validation — prefix check is sufficient for in-scope schemes.
- **Hostname trust** (homograph / typo-squat) — `isSafeHttpUrl` validates scheme only, by design.
- **PDF embedder broadening** — `generateQuotePdf.ts` does not embed user-typed URLs.
- **Customer CSV export path** — does not exist today; universal `sanitizeCsvCell` coverage in `csvHelpers.ts` will apply when added.
- **Adversarial CSV with `\r\n` or null bytes** in parser — PapaParse handles common edge cases; exploit-driven coverage deferred unless a CVE surfaces.
- **Punycode / IDN homograph** in customer-name field — name is free-text, not parsed as URL.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-27 | 11 | 11 | 0 | `gsd-security-auditor` (sonnet) via `/gsd-secure-phase 21` |

### Audit 2026-05-27 — Notes

- **Mode:** State B (no prior SECURITY.md; constructed from PLAN.md `<threat_model>` blocks across 21-01/02/03).
- **register_authored_at_plan_time:** true — auditor instructed to verify mitigations, not scan for new threats.
- **Result:** SECURED. All 11 register threats verified closed. SUMMARY.md `## Threat Flags` sections in all three plans report no unregistered attack surface.
- **CLOSED-WITH-CONCERNS — T-21-03 (informational, not blocking):** The threat-register narrative cites `\t` (0x09) and `\r` (0x0d) as additional formula triggers, but both the plan's D-01 and the implementation at [csvHelpers.ts:447](src/utils/csvHelpers.ts:447) cover only `{=, +, -, @}`. Implementation matches the plan; the register description was more expansive than the plan. CRLF injection is explicitly deferred. Recommended (out of scope): reconcile the register's trigger-set wording or extend the implementation to include `\t`/`\r` in a future patch.

---

## Test Lock Summary

| Test File | Describe Block | Cases | Threats Locked |
|-----------|----------------|-------|----------------|
| [csvHelpers.test.ts:56](src/utils/csvHelpers.test.ts:56) | `sanitizeCsvCell (Phase 21 SEC-01)` | 8 | T-21-01, T-21-02, T-21-03 |
| [urlSecurity.test.ts:14](src/utils/urlSecurity.test.ts:14) | `isSafeHttpUrl (Phase 21 SEC-02 — render-time URL guard)` | 16 | T-21-04, T-21-05, T-21-06, T-21-07 |
| [customerCsv.test.ts:233](src/utils/customerCsv.test.ts:233) | `Phase 21 SEC-03 — formula-injection + Unicode pass-through` | 5 | T-21-08, T-21-09, T-21-10 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-27
