---
phase: 25-doc-hygiene-polish-bundle-health
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/CustomerLibrary.tsx
  - src/components/CustomerCsvImportModal.tsx
  - src/utils/csvHelpers.ts
autonomous: true
requirements: [POL-01, POL-02]
must_haves:
  truths:
    - "CustomerLibrary row layout vertically centers Last used text with Edit/Delete buttons (POL-01)"
    - "CustomerCsvImportModal upload step renders a Customer template download button that triggers a CSV file download (POL-02)"
    - "The downloaded customer-template.csv contains header row (name,email,company,address,notes) + at least one sample row"
    - "src/utils/csvHelpers.ts exports generateSampleCustomerCsv() mirroring existing generateSampleCsv() shape"
    - "Plan scope follows D-01 (5 plans, surface-grouped, single wave, parallel-safe — this plan owns Customer-UI files only) and D-01b (atomic commit per POL item; no --no-verify; gsd-sdk query commit helper)"
  artifacts:
    - path: "src/utils/csvHelpers.ts"
      provides: "generateSampleCustomerCsv() helper"
      exports: ["generateSampleCustomerCsv"]
    - path: "src/components/CustomerCsvImportModal.tsx"
      provides: "Template download button in UploadStep"
      contains: "generateSampleCustomerCsv"
    - path: "src/components/CustomerLibrary.tsx"
      provides: "Vertically-centered row layout"
      contains: "items-center"
  key_links:
    - from: "src/components/CustomerCsvImportModal.tsx"
      to: "src/utils/csvHelpers.ts"
      via: "import { generateSampleCustomerCsv, downloadCsv }"
      pattern: "generateSampleCustomerCsv"
    - from: "CustomerCsvImportModal template button onClick"
      to: "downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv')"
      via: "handler call"
      pattern: "downloadCsv\\(generateSampleCustomerCsv"
---

<objective>
Customer-UI polish batch: align CustomerLibrary row vertical centering (POL-01) + add the Customer CSV template download button (POL-02). Phase 25 ships NO new user-facing FEATURES, but POL-01 + POL-02 are POLISH items closing v1.2 audit/debt findings — neither warrants a `features.ts` entry per project memory rule (litmus test: "Could the user describe what changed without reading the changelog?" — vertical-centering = no; CSV template download = arguably yes for power users, but project memory rule says NO new badges for hardening work, and Phase 25 explicitly disallows new badges).

Purpose:
- POL-01 (REQUIREMENTS.md line 90): CustomerLibrary row layout — change outer flex from `items-start` to `items-center` so "Last used" text aligns vertically with Edit/Delete buttons. ~5 min CSS fix.
- POL-02 (REQUIREMENTS.md line 91): Add `generateSampleCustomerCsv()` helper to `src/utils/csvHelpers.ts` mirroring existing `generateSampleCsv()` shape; add a "Customer template" download button to `CustomerCsvImportModal` UploadStep that invokes `downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv')`.

POL-02 also has a downstream side effect — the todo `.planning/todos/customer-csv-template-download.md` is archived to `.planning/todos/completed/` — but that archival is handled in Plan 25-01 Task 3 (which owns all `.planning/` edits). This plan ships ONLY the helper + button. No `<NewBadge>` JSX or `features.ts` entry.

Output: 2 atomic commits (one per POL item) + working `tsc -b` and `npm run build`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md
@src/utils/csvHelpers.ts
@src/components/CustomerCsvImportModal.tsx
@src/components/CustomerLibrary.tsx
@src/components/CsvImportModal.tsx

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from 25-PATTERNS.md. -->

From src/utils/csvHelpers.ts (existing — line 67–88 + 333–344):
```typescript
import Papa from 'papaparse';
import type { Asset, Currency, FilamentType } from '../types';

export function generateSampleCsv(type: 'material' | 'printer'): string {
  // Returns Papa.unparse({ fields: [...COLUMNS], data: [[...]] })
  // — string CSV body, no Blob, no download trigger.
}

export function downloadCsv(csvString: string, filename: string): void {
  // Blob + URL.createObjectURL + temp <a> click + revokeObjectURL.
  // Already exported. DO NOT reimplement.
}
```

From src/components/CustomerCsvImportModal.tsx (existing — UploadStep at lines 277–327):
- The modal's UploadStep renders a drop zone + column-reference help text at line 322–324: column list is `name,email,company,address,notes`.
- `Button` primitive is imported at line 2 (already available).
- The template-download button should slot into UploadStep AFTER the drop zone, BEFORE (or beside) the column reference text.

From src/components/CustomerLibrary.tsx (existing — row layout at lines 48–83):
- Line 48: `<div className="flex items-start justify-between gap-3">` — the outer flex with `items-start` is the misalignment culprit.
- Line 57–62: `<div className="hidden sm:block text-sm text-slate-400 whitespace-nowrap" title={customer.lastUsedAt?.toISOString()}>{lastUsedLabel}</div>` — the "Last used" cell.
- Line 63: `<div className="flex items-center gap-1 shrink-0">` — Edit/Delete buttons container, already uses items-center.

From src/components/CsvImportModal.tsx (sibling — analog for the template-button JSX shape):
- Run `grep -n "template\|generateSample\|downloadCsv" src/components/CsvImportModal.tsx` during execution to locate the existing template button placement and mirror its JSX style.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: POL-01 — CustomerLibrary row vertical centering</name>
  <files>src/components/CustomerLibrary.tsx</files>
  <read_first>
    - src/components/CustomerLibrary.tsx (FULL FILE — confirm current line 48 contains `<div className="flex items-start justify-between gap-3">` before editing; line numbers may have drifted since 25-PATTERNS.md was authored)
    - .planning/REQUIREMENTS.md (POL-01 line 90 — "Last used" text vertically centered with Edit/Delete action buttons)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`src/components/CustomerLibrary.tsx — POL-01` section — exact Tailwind class change spelled out)
  </read_first>
  <action>
    Per POL-01 + 25-PATTERNS.md: change the outer flex container in the customer-row layout (around line 48) from `flex items-start justify-between gap-3` to `flex items-center justify-between gap-3`. This is a single-class change: `items-start` → `items-center`.

    Verification: the customer name block (lines ~49–56) and the "Last used" cell (line ~57–62) and the action buttons (`line 63+`) all sit inside this flex parent — switching to `items-center` aligns the three children on the cross axis.

    Alternative implementation (if changing the parent class shifts the name/subline block in an undesired way that's visible during manual eyeball check): keep parent as `items-start`, and add `self-center` to ONLY the "Last used" `<div>` at line ~57. Both approaches are equally correct per 25-PATTERNS.md. Prefer the parent-class change for simplicity.

    Do NOT touch any other Tailwind class in the file. Do NOT touch any JSX outside this single flex container. Do NOT add `features.ts` entries or `<NewBadge>` JSX (per project memory + Phase 25 rule).
  </action>
  <verify>
    <automated>tsc -b 2>&1 | tee /tmp/25-02-pol01-tsc.log; grep -E "items-center justify-between gap-3" src/components/CustomerLibrary.tsx | head -1 && tsc -b > /dev/null 2>&1 && echo "POL-01 pass: items-center applied + tsc -b clean"</automated>
  </verify>
  <done>
    `grep -E "items-(start|center) justify-between gap-3" src/components/CustomerLibrary.tsx` returns at least one line containing `items-center`; `tsc -b` exits 0; commit landed via `gsd-sdk query commit` (no `--no-verify`).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POL-02 — add generateSampleCustomerCsv() helper + template-download button</name>
  <files>
    src/utils/csvHelpers.ts,
    src/components/CustomerCsvImportModal.tsx
  </files>
  <read_first>
    - src/utils/csvHelpers.ts (FULL FILE — confirm existing `generateSampleCsv` shape, lines ~67–88; confirm `downloadCsv` export, lines ~333–344; locate the `*_COLUMNS` constants for materials/printers to confirm convention for `CUSTOMER_COLUMNS`)
    - src/components/CustomerCsvImportModal.tsx (FULL FILE — locate `UploadStep` component lines ~277–327; confirm `Button` primitive import line 2; confirm column-reference help text at lines ~322–324 specifies `name,email,company,address,notes`)
    - src/components/CsvImportModal.tsx (sibling — grep for `template\|generateSample\|downloadCsv` to find the analog template-button JSX block to mirror its style)
    - src/utils/csvHelpers.test.ts (IF EXISTS — run `ls src/utils/csvHelpers.test.ts` first; if it exists, add a new test case for `generateSampleCustomerCsv`; if it does not exist, do NOT create a test file in this plan — testing scaffolds belong in Phase 23)
    - .planning/REQUIREMENTS.md (POL-02 line 91 — mirrors generateSampleCsv for materials/printers)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`src/utils/csvHelpers.ts — add generateSampleCustomerCsv()` section + `src/components/CustomerCsvImportModal.tsx — POL-02` section)
    - .planning/todos/customer-csv-template-download.md (read the existing todo for template content spec — "Header row + 2-3 sample rows that demonstrate the supported columns and the optional fields")
  </read_first>
  <behavior>
    - Test 1: `generateSampleCustomerCsv()` returns a non-empty string starting with the header row `name,email,company,address,notes` (exact field order, matching CONTEXT.md line 323 of CustomerCsvImportModal).
    - Test 2: The returned CSV body contains at least 2 sample data rows after the header (matching the todo's "2-3 sample rows" spec, e.g., `Jane Smith,jane@example.com,Acme Co,123 Main St,Repeat buyer` and `Bob Jones,bob@example.com,,,` — second row demonstrates optional fields).
    - Test 3 (manual UAT, captured in summary): Clicking the template button in CustomerCsvImportModal triggers a browser download of a file named `customer-template.csv` whose contents equal `generateSampleCustomerCsv()` output. (Cannot easily unit-test the download trigger; relies on `downloadCsv` being already-tested.)
  </behavior>
  <action>
    Per POL-02 + 25-PATTERNS.md, two sub-files:

    SUB-FILE A — `src/utils/csvHelpers.ts`:

    1. Add a `CUSTOMER_COLUMNS` const near other column constants (locate by reading `MATERIAL_COLUMNS` / `PRINTER_COLUMNS` declarations in the file):
       ```typescript
       const CUSTOMER_COLUMNS = ['name', 'email', 'company', 'address', 'notes'] as const;
       ```

    2. Export new `generateSampleCustomerCsv()` function mirroring the existing `generateSampleCsv()` shape:
       ```typescript
       export function generateSampleCustomerCsv(): string {
         return Papa.unparse({
           fields: [...CUSTOMER_COLUMNS],
           data: [
             ['Jane Smith', 'jane@example.com', 'Acme Co', '123 Main St', 'Repeat buyer'],
             ['Bob Jones', 'bob@example.com', '', '', ''],
           ],
         });
       }
       ```

    3. Field order MUST be `name,email,company,address,notes` — matches CustomerCsvImportModal's column-reference help text. The second sample row demonstrates the optional fields with empty strings (company, address, notes optional).

    4. If `src/utils/csvHelpers.test.ts` exists, add a test:
       ```typescript
       it('generateSampleCustomerCsv produces header + 2 sample rows', () => {
         const csv = generateSampleCustomerCsv();
         const lines = csv.split('\n');
         expect(lines[0]).toBe('name,email,company,address,notes');
         expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 rows
         expect(csv).toContain('Jane Smith');
         expect(csv).toContain('Bob Jones');
       });
       ```
       If the test file does NOT exist, skip the test-add step — do NOT scaffold a new test file in this plan (Phase 23 is the canonical test-coverage phase).

    SUB-FILE B — `src/components/CustomerCsvImportModal.tsx`:

    1. Import the new helper alongside the existing `downloadCsv` import. If `downloadCsv` is not already imported into the modal, add it:
       ```typescript
       import { generateSampleCustomerCsv, downloadCsv } from '../utils/csvHelpers';
       ```
       (Replace the import path if the actual relative path differs — match the project's existing import style.)

    2. Add a handler function inside the component scope (near other handlers):
       ```typescript
       function handleDownloadTemplate() {
         downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv');
       }
       ```

    3. Add a button in the `UploadStep` JSX after the drop zone and BEFORE the column-reference help text (line ~322). Mirror the JSX style used by `CsvImportModal.tsx` (read it first via grep — if `CsvImportModal.tsx` uses the `Button` primitive with `variant="ghost" btnSize="sm"`, mirror that; if it uses a plain `<button>` with `className="text-sm text-blue-400 hover:text-blue-300 underline"`, mirror that). Prefer the `Button` primitive variant — consistent with modal footer buttons. Suggested JSX:
       ```tsx
       <Button
         type="button"
         variant="ghost"
         btnSize="sm"
         onClick={handleDownloadTemplate}
       >
         Download customer template
       </Button>
       ```

    4. Do NOT add a `<NewBadge>` to this button (Phase 25 rule — no new badges for hardening work, per project memory MEMORY.md + 25-CONTEXT.md `Established Patterns`).

    5. Do NOT change the column-reference help text. Do NOT add a `features.ts` entry.

    COMMIT THIS TASK AS A SINGLE ATOMIC COMMIT (per D-01b) covering both csvHelpers.ts and CustomerCsvImportModal.tsx edits — POL-02 is one logical change spanning both files.
  </action>
  <verify>
    <automated>tsc -b 2>&1 | tee /tmp/25-02-pol02-tsc.log && grep -q "export function generateSampleCustomerCsv" src/utils/csvHelpers.ts && grep -q "generateSampleCustomerCsv" src/components/CustomerCsvImportModal.tsx && grep -q "customer-template.csv" src/components/CustomerCsvImportModal.tsx && (test -f src/utils/csvHelpers.test.ts && npm test -- src/utils/csvHelpers.test.ts 2>&1 | tail -3 || echo "no test file present — skipped"); echo "POL-02 pass: helper exported + button wired + tsc -b clean"</automated>
  </verify>
  <done>
    `src/utils/csvHelpers.ts` exports `generateSampleCustomerCsv`; `src/components/CustomerCsvImportModal.tsx` imports + uses it; `customer-template.csv` literal filename appears in the modal; `tsc -b` exits 0; if `csvHelpers.test.ts` exists, the new test passes; commit landed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → download trigger | User clicks template button; static `generateSampleCustomerCsv()` output is wrapped in a Blob via existing `downloadCsv()` (already-tested helper); URL.createObjectURL → temp anchor → revokeObjectURL. No user input flows into the CSV template (the template content is hard-coded literals). |
| browser → CSS-only change | POL-01 changes one Tailwind class. No user-input surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25-02-01 | Injection | `generateSampleCustomerCsv()` CSV output | accept | Template content is fully hard-coded literals (`'Jane Smith'`, `'jane@example.com'`, etc.) — zero user input flows into the unparse call. PapaParse `unparse` is the trusted upstream library, used by existing `generateSampleCsv()` without sanitization. SEC-01 formula-injection sanitization is Phase 21 scope and does not apply to this hard-coded sample (no `=`, `+`, `-`, `@` characters in the literals). |
| T-25-02-02 | Tampering | Blob URL leak | mitigate | `downloadCsv` already revokes the object URL after click (lines 333–344 of csvHelpers.ts). New button reuses this existing helper unchanged. No new Blob lifecycle code introduced. |
| T-25-02-03 | Information disclosure | Sample template content | accept | Sample names are fictional (`Jane Smith`, `Bob Jones`); no PII or sensitive data. |
| T-25-02-SC | Tampering | npm package installs | mitigate | N/A — no package installs in this plan. PapaParse already in dependencies. RESEARCH.md Package Legitimacy Audit table not required. |

**ASVS Level 1** — POL-01 is CSS-only (no security surface). POL-02 reuses fully-tested `downloadCsv` helper and ships hard-coded template content with zero user-input flow. Block threshold: HIGH severity (none present).
</threat_model>

<verification>
- `tsc -b` exits 0 after both tasks (Vercel build chain compatibility — per project CLAUDE.md `~/CLAUDE.md` rule)
- `grep -E "items-center justify-between gap-3" src/components/CustomerLibrary.tsx` returns ≥ 1 line (POL-01)
- `grep -q "export function generateSampleCustomerCsv" src/utils/csvHelpers.ts` returns 0 (POL-02 helper)
- `grep -q "generateSampleCustomerCsv" src/components/CustomerCsvImportModal.tsx` returns 0 (POL-02 wiring)
- `grep -q "customer-template.csv" src/components/CustomerCsvImportModal.tsx` returns 0 (POL-02 download filename)
- IF `src/utils/csvHelpers.test.ts` exists: `npm test -- src/utils/csvHelpers.test.ts` passes (new test for header + sample rows)
- Manual UAT (capture in plan summary): in `npm run dev` (port 4173), open CustomerCsvImportModal, click "Download customer template" button, confirm browser downloads `customer-template.csv` containing the header row + 2 data rows. The downloaded file opens cleanly in Numbers/Excel showing 5 columns.
- 2 atomic commits via `gsd-sdk query commit`; no `--no-verify`.
</verification>

<success_criteria>
- POL-01 closed: CustomerLibrary customer-row outer flex uses `items-center`; "Last used" cell aligns vertically with Edit/Delete buttons
- POL-02 closed: `generateSampleCustomerCsv()` exported from `src/utils/csvHelpers.ts`; Customer template download button rendered in `CustomerCsvImportModal` UploadStep; clicking triggers `customer-template.csv` download
- `tsc -b` exits 0
- `npm run build` exits 0 with no new Rollup warnings (existing chunk-graph warnings unchanged — that's Plan 25-05's territory)
- No `features.ts` entries added; no `<NewBadge>` JSX added (Phase 25 rule)
- 2 atomic commits landed
</success_criteria>

<output>
Create `.planning/phases/25-doc-hygiene-polish-bundle-health/25-02-SUMMARY.md` on completion. Capture: (1) the exact before/after of the CustomerLibrary class change (or the `self-center` fallback if used), (2) the line numbers of the inserted `generateSampleCustomerCsv()` function + the inserted JSX button in CustomerCsvImportModal, (3) whether a test was added to `csvHelpers.test.ts` or not (and why), (4) confirmation `tsc -b` + `npm run build` both exit 0, (5) the contents of the downloaded `customer-template.csv` (paste the CSV body for traceability — it's ~6 lines).
</output>
</content>
</invoke>