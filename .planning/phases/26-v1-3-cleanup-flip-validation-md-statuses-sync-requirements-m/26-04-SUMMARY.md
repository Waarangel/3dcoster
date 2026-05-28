---
phase: 26-v1-3-cleanup-flip-validation-md-statuses-sync-requirements-m
plan: "04"
subsystem: customer-csv-import
tags:
  - ui
  - polish
  - parity
  - customer-import
dependency_graph:
  requires: []
  provides:
    - CustomerCsvImportModal layout parity with CsvImportModal (template-first order)
  affects:
    - src/components/CustomerCsvImportModal.tsx
tech_stack:
  added: []
  patterns:
    - JSX sibling reorder (structural only — no logic change)
key_files:
  created: []
  modified:
    - src/components/CustomerCsvImportModal.tsx
decisions:
  - "D-09 applied: template-download block moved above error + drop zone (mirrors CsvImportModal.tsx:235-256 reference pattern)"
  - "D-10 applied: button label changed from `Customer template` to `👥 Customer template` (U+1F465 BUSTS IN SILHOUETTE)"
  - "D-11 honored: no other CustomerCsvImportModal changes — onClick handler, wrapper className, drop-zone styling, imports, dedup-mode all preserved verbatim"
  - "D-12 Case A: CustomerCsvImportModal.test.tsx has zero matches for 'Customer template' or 'template' as a selector; no test file edit required"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 26 Plan 04: CustomerCsvImportModal Layout Parity Summary

One-liner: Reordered `CustomerCsvImportModal` UploadStep JSX to put the template-download block first (matching `CsvImportModal` layout) and added `👥` emoji prefix to the button label.

## What Was Done

Two surgical UI changes per decisions D-09 through D-12:

**Task 1 — JSX reorder + emoji prefix (D-09, D-10, D-11)**

The `UploadStep` function in `CustomerCsvImportModal.tsx` previously rendered its children in this order:
1. Error banner
2. Drop zone
3. Template download
4. Accepted columns reference

After the change, the order mirrors `CsvImportModal.tsx` (lines 235-256):
1. Template download (MOVED to first)
2. Error banner
3. Drop zone
4. Accepted columns reference

The button label was also updated from `Customer template` to `👥 Customer template` (D-10 emoji prefix — matches the weight of `📦 Materials template` and `🖨️ Printers template` in the asset modal).

All D-11 scope-locks were honored:
- `onClick={() => downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv')}` preserved verbatim
- `bg-slate-700/50 rounded-lg p-3` wrapper className preserved verbatim
- `variant="ghost"`, `btnSize="sm"`, `className="text-blue-400..."` on Button preserved verbatim
- `Download a sample template to get started:` paragraph text preserved verbatim
- Drop-zone `className="cursor-pointer border-2 border-dashed..."` preserved verbatim
- No imports added, no state added, no props changed

**Task 2 — Test suite verification (D-12)**

D-12 Case A applied: `grep` on `CustomerCsvImportModal.test.tsx` returned zero matches for `"Customer template"` or `"template"` as a selector. The test file was NOT modified.

Test results:
- Scoped: `npm test -- CustomerCsvImportModal` → **6 passed (6)** (all 6 it() blocks green)
- Full suite: `npm test` → **466 passed | 1 todo (467)** (baseline preserved)
- TypeScript: `npx tsc -b` → **exit 0** (no regressions)

## Verification Results

### D-10 Emoji Prefix (grep confirmation)
```
grep -F "👥 Customer template" src/components/CustomerCsvImportModal.tsx
          👥 Customer template
```
Result: 1 match found.

### D-09 JSX Sibling Order (line number confirmation)
```
grep -n "Template download\|Error banner\|Drop zone\|Accepted columns" src/components/CustomerCsvImportModal.tsx
265:      {/* Template download */}
279:      {/* Error banner */}
286:      {/* Drop zone */}
312:      {/* Accepted columns reference */}
```
Result: Template download (265) < Error banner (279) < Drop zone (286) < Accepted columns (312) — correct order confirmed.

### Test Suite Results
- CustomerCsvImportModal.test.tsx: **6 passed** (Test 1: non-CSV error, Test 2: valid CSV transition, Test 3: dedup toggle, Test 4: row select/deselect, Test 5a: import call shape, Test 5b: skip-mode dedup)
- Full suite: **466 passed | 1 todo | 0 failed**
- `npx tsc -b`: **exit 0**

### Preservation Checks (all return 1)
- `downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv')`: 1
- `bg-slate-700/50 rounded-lg p-3`: 1
- `cursor-pointer border-2 border-dashed`: 1
- `Download a sample template to get started:`: 1

### Visual Parity with CsvImportModal.tsx
`CsvImportModal.tsx` lines 235-256 show the reference pattern: template block first, then error block, then drop zone. `CustomerCsvImportModal.tsx` now matches this structural order exactly. The wrapper styling (`bg-slate-700/50 rounded-lg p-3`) is identical between the two modals.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `7b8b5bc` | feat(26-04): CustomerCsvImportModal layout parity with CsvImportModal per D-09/D-10/D-11 |
| Task 2 | (no commit — Case A, no test file edit required) | Test suite verified, 466/1/0 baseline preserved |

## Deviations from Plan

None. Plan executed exactly as written. Case A (no test edit) applied per D-12 prediction.

## Known Stubs

None.

## Threat Flags

None. The 👥 emoji is a static JSX text literal — no user input path, no innerHTML, no injection risk (T-26-04-XSS: accept per STRIDE register).

## Self-Check: PASSED

- [x] `src/components/CustomerCsvImportModal.tsx` modified and committed at `7b8b5bc`
- [x] `grep -F "👥 Customer template"` returns 1 match
- [x] JSX sibling order: Template (265) → Error (279) → Drop zone (286) → Accepted columns (312)
- [x] `npx tsc -b` exit 0 (verified from pedantic-ride-ab48c5 worktree which has full node_modules)
- [x] `npm test -- CustomerCsvImportModal` → 6 passed
- [x] `npm test` → 466 passed | 1 todo | 0 failed
- [x] No test file modifications (Case A per D-12)
- [x] D-11 scope-lock honored (onClick handler, wrapper className, drop-zone styling all preserved)
