# Phase 21: CSV + URL security — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 21-csv-url-security
**Areas discussed:** sanitizeCsvCell coverage scope, modelUrl invalid render fallback, modelUrl validation depth & placement, URL validator helper location

---

## sanitizeCsvCell coverage scope

| Option | Description | Selected |
|--------|-------------|----------|
| Universal: every Papa.unparse path | Apply sanitizeCsvCell to all 4 export paths (generateExportCsv, generateSampleCsv 'material', generateSampleCsv 'printer', generateSampleCustomerCsv). One rule, no exceptions. Templates are no-op in practice but the invariant is enforceable by lint/grep. | ✓ |
| Audit-strict: only generateExportCsv | Apply only where audit identified user input flowing to CSV. Smaller diff, but the rule becomes 'sanitize when user input is involved' — future contributors must judge per export. | |

**User's choice:** Universal (Recommended)
**Notes:** Locks the invariant: any new `Papa.unparse` call site in the future is held to the same sanitization rule with no judgement call required.

---

## modelUrl invalid render fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text with title warning | Render the URL as plain-text span with `title="URL blocked: must start with http:// or https://"`. User still sees what they typed (so they can fix it). Self-healing UX. | ✓ |
| Omit the entire Model source block | If invalid, skip rendering the 'Model source: ...' div entirely. Cleaner visually but user has no signal the field exists or something is wrong. | |
| Plain text, no title warning | Render as plain text but no warning attribute. Minimum surface change; user sees their string but no explanation. | |

**User's choice:** Plain text with title warning (Recommended)
**Notes:** Preserves user data visibility and gives an inline explanation without inventing a toast/console-warning surface.

---

## modelUrl validation depth & placement

| Option | Description | Selected |
|--------|-------------|----------|
| Render-time only, simple prefix check | Single guard at JobsManager:620. Trim whitespace, lowercase-check the prefix to catch 'JavaScript:'/' javascript:'. Audit-aligned, smallest diff, zero risk to existing data. No save-time gate — IndexedDB stays a string store. | ✓ |
| Render-time, new URL() parsing | Use new URL(value) inside try/catch and check parsed.protocol. Catches more edge cases but new URL is permissive (accepts 'http:foo' without //). Slightly bigger diff for marginal added safety. | |
| Both render-time AND save-time | Add validator in CostCalculator save handler too. Belt-and-suspenders but expands scope to form-validation UX (error message, inline feedback) the phase doesn't budget for. | |

**User's choice:** Render-time only, simple prefix check (Recommended)
**Notes:** Audit-aligned — the `javascript:` payload only fires when clicked, so a render-time gate fully neutralizes the attack. Save-time noted as deferred for a future UX phase.

---

## URL validator helper location

| Option | Description | Selected |
|--------|-------------|----------|
| Extract to src/utils/urlSecurity.ts | New file exporting `isSafeHttpUrl(value): boolean`. Co-located unit tests in urlSecurity.test.ts. Reusable for future render sites (PDF embedder, future quote-portal). Senior-dev hygiene: security primitives belong in a named module. | ✓ |
| Inline in JobsManager | 3-line check at the render site, no new file. Minimum surface but the security rule is invisible to anyone reading another modelUrl render site later. | |
| Add to existing src/utils/csvHelpers.ts | Avoids a new file but conflates CSV-export concerns with URL-validation concerns. Bad semantic fit. | |

**User's choice:** Extract to src/utils/urlSecurity.ts (Recommended)
**Notes:** Same util+test pattern as csvHelpers, customerCsv, duplicateJob. Reusable surface for future render sites without re-engineering.

---

## Claude's Discretion

- Exact wording of the `title` attribute warning on invalid URL fallback.
- Exact comment text inside the new test `describe` blocks (must explain purpose; wording open).
- Whether `urlSecurity.ts` exports only `isSafeHttpUrl` initially or grows additional helpers — start with one, grow only on real demand.

## Deferred Ideas

- **Save-time `modelUrl` validation in `CostCalculator`** — requires form-validation UX (error message, inline feedback, disable-save). Out of scope for hardening milestone.
- **`new URL()` parsing for richer URL validation** — marginal added safety vs prefix check; deferred unless an exploit surfaces.
- **Customer CSV export path** — does not exist today (import only); adding it would be a NEW capability. Universal sanitization (D-02) ensures any future export inherits the guard automatically.
- **`assertSafeHttpUrl` throw-style helper in `urlSecurity.ts`** — only add when a real call site needs hard-fail rather than degrade.
