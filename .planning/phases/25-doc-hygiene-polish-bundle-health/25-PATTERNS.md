# Phase 25: Doc + Hygiene + Polish + Bundle Health — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 13 new/modified surfaces
**Analogs found:** 12 / 13 (one surface — `src/pdf/jspdf-augment.d.ts` — has a partial analog via `src/globals.d.ts`)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/utils/csvHelpers.ts` (add fn) | utility | transform | `src/utils/csvHelpers.ts` itself (existing `generateSampleCsv`) | exact — same file |
| `src/pdf/jspdf-augment.d.ts` (NEW) | config/type | — | `src/globals.d.ts` | partial — same ambient-declaration pattern |
| `.planning/milestones/v1.2-REQUIREMENTS.md` | doc | — | self (field flip only) | exact |
| `.planning/todos/ui-consistency-sweep.md` | doc | — | self (in-place audit) | exact |
| `.planning/todos/customer-csv-template-download.md` | doc | — | self (mark closed + move) | exact |
| `src/components/CustomerLibrary.tsx` | component | request-response | self — row layout lines 48–83 | exact |
| `src/components/CustomerCsvImportModal.tsx` | component | request-response | `src/components/CsvImportModal.tsx` + self upload-step block | role-match |
| `src/components/JobsManager.tsx` (HYG-01) | component | CRUD | self — `generatingJobIds` pattern lines 772–1746 | exact |
| `src/components/JobsManager.tsx` (HYG-04) | component | request-response | self — `onQuoteCreated` line 2085 | exact |
| `src/components/JobsManager.tsx` (POL-04) | component | event-driven | `src/components/FilamentSelector.tsx` lines 52–61 | role-match |
| `src/components/JobsManager.tsx` (A11Y-09) | component | request-response | self — `QUOTE_PILL_STYLES` / `QuoteStatusPill` lines 101–134 | exact |
| `src/components/PrintQuoteModal.tsx` (HYG-04) | component | request-response | self — `PrintQuoteModalProps` lines 31–49 | exact |
| `src/components/ImageCarousel.tsx` (HYG-05) | component | — | self — imports block lines 4–8 | exact |
| `src/pdf/generateQuotePdf.ts` (POL-03) | utility | transform | self — line 161 cast site | exact |
| `vite.config.ts` (PERF-05) | config | — | self — existing `manualChunks` function lines 101–135 | exact |

---

## Pattern Assignments

### `src/utils/csvHelpers.ts` — add `generateSampleCustomerCsv()` (POL-02)

**Analog:** `src/utils/csvHelpers.ts` — existing `generateSampleCsv()` function (lines 67–88)

**Imports pattern** (lines 1–2):
```typescript
import Papa from 'papaparse';
import type { Asset, Currency, FilamentType } from '../types';
```
For the customer variant, swap the type import:
```typescript
import type { Customer } from '../types';
```

**Core pattern — `generateSampleCsv`** (lines 67–88):
```typescript
export function generateSampleCsv(type: 'material' | 'printer'): string {
  if (type === 'printer') {
    return Papa.unparse({
      fields: [...PRINTER_COLUMNS],
      data: [
        ['Creality Ender 3 V3', 'printer', 'Creality', '199', ...],
      ],
    });
  }
  return Papa.unparse({
    fields: [...MATERIAL_COLUMNS],
    data: [
      ['PLA Basic White', 'filament', 'Bambu Lab', ...],
    ],
  });
}
```

**New function to mirror exactly** — same shape, customer columns:
```typescript
const CUSTOMER_COLUMNS = ['name', 'email', 'company', 'address', 'notes'] as const;

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

**Download trigger pattern** (lines 333–344 of `csvHelpers.ts`) — already exported as `downloadCsv(csvString, filename)`. The button handler in `CustomerCsvImportModal` calls this pair:
```typescript
import { generateSampleCustomerCsv, downloadCsv } from '../utils/csvHelpers';
// in handler:
downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv');
```

**Convention:** Customer column list (`name, email, company, address, notes`) is specified in the upload-step help text of `CustomerCsvImportModal.tsx` line 323. Use the identical set.

---

### `src/pdf/jspdf-augment.d.ts` — NEW file (POL-03)

**Analog:** `src/globals.d.ts` (lines 1–3) — the project's existing ambient `declare const` pattern:
```typescript
// Build-time constant injected by Vite's define option
// true when built via `tauri build`, false for web builds
declare const __IS_TAURI__: boolean
```

**File location decision (Claude's Discretion):** Create as a separate `src/pdf/jspdf-augment.d.ts`. It is auto-discovered by TypeScript because `src/` is in the compile root; it keeps `generateQuotePdf.ts` clean; it is under 10 lines.

**Exact augmentation block** (from REQUIREMENTS.md POL-03):
```typescript
declare module 'jspdf' {
  interface jsPDF { lastAutoTable: { finalY: number } }
}
```

**Cast to remove** in `src/pdf/generateQuotePdf.ts` line 161:
```typescript
// BEFORE:
return (doc as any).lastAutoTable.finalY as number;

// AFTER (once augmentation is in place):
return doc.lastAutoTable.finalY;
```

**Verification command:** `tsc -b` (not `--noEmit`) must exit 0 after the change. Then `npm run build` must also exit 0.

---

### `src/components/CustomerLibrary.tsx` — POL-01 CSS vertical centering

**Analog:** Same file, row layout (lines 48–83). The outer wrapper is `flex items-start justify-between gap-3`. The "Last used" `<div>` at line 57–62 sits between the customer name block and the action buttons:

```tsx
// Current (lines 57–62) — items-start on parent misaligns text vs. buttons:
<div
  className="hidden sm:block text-sm text-slate-400 whitespace-nowrap"
  title={customer.lastUsedAt?.toISOString()}
>
  {lastUsedLabel}
</div>
<div className="flex items-center gap-1 shrink-0">  {/* buttons — line 63 */}
```

**Fix:** Change the outer `flex items-start` (line 48) to `flex items-center`. Alternatively, add `self-center` to the "Last used" `<div>` if changing the outer alignment would affect the name/subline block layout.

**Pattern to follow** — the `flex items-center` pattern is already used at line 63 (action buttons container) and line 210 (CustomerLibrary header row). No new Tailwind class is needed.

---

### `src/components/CustomerCsvImportModal.tsx` — POL-02 "Customer template" download button

**Analog:** The upload step in `CustomerCsvImportModal.tsx` itself (lines 277–327 — `UploadStep` component). The template download button slots into the `UploadStep` body, after the drop zone, before (or after) the column reference text.

**Pattern from `CsvImportModal.tsx`** (the asset importer sibling) — check if it has a template button:
```bash
grep -n "template\|generateSample\|downloadCsv" src/components/CsvImportModal.tsx
```
If CsvImportModal has a template button, mirror its exact JSX placement inside UploadStep. If not, use `Button variant="ghost"` with a download icon — the `Button` component is already imported at line 2 of `CustomerCsvImportModal.tsx`.

**Handler shape:**
```typescript
import { generateSampleCustomerCsv, downloadCsv } from '../utils/csvHelpers';

function handleDownloadTemplate() {
  downloadCsv(generateSampleCustomerCsv(), 'customer-template.csv');
}
```

**Placement in JSX** — add to `UploadStep` props + render, after the column-reference `<p>` (line 322–324):
```tsx
<button
  type="button"
  onClick={onDownloadTemplate}
  className="text-sm text-blue-400 hover:text-blue-300 underline"
>
  Download template CSV
</button>
```
Or use the `Button` primitive with `variant="ghost" btnSize="sm"` (consistent with modal footer buttons).

---

### `src/components/JobsManager.tsx` — HYG-01 (`generatingJobIds` slot deletion)

**Analog:** Same file — the slot locations:

- Line 772: `generatingJobIds: Set<string>;` in `JobRowProps` interface — delete this line
- Line 803: `generatingJobIds,` in `JobRow` destructure — delete
- Line 834: `isGeneratingPdf={generatingJobIds.has(job.id)}` in `JobCard` call — delete prop
- Lines 978–980: `const generatingJobIds = useMemo(() => new Set<string>(), []);` and surrounding comment — delete
- Line 1628: `generatingJobIds,` in `rowProps` object — delete
- Line 1650: `generatingJobIds` in `useMemo` dependency array — remove
- Line 1746: `isGeneratingPdf={generatingJobIds.has(job.id)}` in non-virtualized branch — delete prop

Also remove `isGeneratingPdf` from `JobCardProps` (line 45) and its usage in `JobCard` at line 634 (`disabled={isGeneratingPdf || ...}`).

**Pattern:** Deletion-only. After removing all references, `tsc -b` will catch any missed sites.

---

### `src/components/JobsManager.tsx` — HYG-04 (`onQuoteCreated` no-op removal)

**Analog:** Same file, line 2085:
```tsx
// BEFORE:
onQuoteCreated={() => { /* no-op for now; could trigger a toast in a future plan */ }}
```
**Action:** Delete the entire prop at line 2085. The prop is now optional in `PrintQuoteModalProps`.

---

### `src/components/JobsManager.tsx` — POL-04 (overflow menu outside-click + Escape)

**Analog:** `src/components/FilamentSelector.tsx` lines 52–61 — closest existing outside-click pattern:
```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      setIsOpen(false);
      setHoveredBrand(null);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

**Secondary analog:** `src/components/Header.tsx` lines 29–31 — same `mousedown` pattern.

**Also analog:** `CustomerCsvImportModal.tsx` lines 59–66 — Escape key via `keydown` on `window`:
```typescript
useEffect(() => {
  if (!isOpen) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [isOpen, onClose]);
```

**Combined pattern for `QuoteRow`** — `QuoteRow` already has `overflowOpen` state (line 150). Add a `useRef` on the overflow container div and a gated `useEffect`:
```typescript
const overflowRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!overflowOpen) return;
  const handleMouseDown = (e: MouseEvent) => {
    if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
      setOverflowOpen(false);
    }
  };
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOverflowOpen(false);
  };
  document.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    document.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [overflowOpen]);
```
Attach `ref={overflowRef}` to the `<div className="flex items-center gap-2 shrink-0 relative">` at line 172.

**Convention:** Both registrations gated on `overflowOpen` so listeners are added/removed per open state. Mirrors the `FilamentSelector` pattern's implicit "always-registered" approach but gated for correctness.

---

### `src/components/JobsManager.tsx` — A11Y-09 (`QuoteStatusPill` aria-label + Declined contrast)

**Analog:** Same file — `QuoteStatusPill` component (lines 128–135) and `QUOTE_PILL_STYLES` (lines 101–106):

**Current `QuoteStatusPill`:**
```tsx
function QuoteStatusPill({ kind }: { kind: QuotePillKind }) {
  const { label, classes } = QUOTE_PILL_STYLES[kind];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
```

**Change 1 — aria-label** (per CONTEXT.md D-68 and REQUIREMENTS.md A11Y-09):
```tsx
<span
  aria-label={`Status: ${label}`}
  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
>
```

**Change 2 — Declined-pill contrast.** Current: `bg-slate-700 text-slate-300`. `slate-300` on `slate-700` is approximately 3.0:1 — at the WCAG AA 3:1 threshold for non-body text. To safely clear it, change `text-slate-300` to `text-slate-200` (increases contrast without changing the visual character of the pill).

```typescript
declined: { label: 'Declined', classes: 'bg-slate-700 text-slate-200' },
```

**Verification:** Use browser DevTools accessibility panel or WebAIM contrast checker. `slate-200` (#e2e8f0) on `slate-700` (#334155) ≈ 4.6:1, comfortably above 3:1.

---

### `src/components/PrintQuoteModal.tsx` — HYG-04 (prop optional + `?.()`)

**Analog:** Same file — `PrintQuoteModalProps` interface (lines 31–49) and invocation at line 283:

**Change 1 — interface** (line 36):
```typescript
// BEFORE:
onQuoteCreated: (quote: Quote) => void;

// AFTER:
onQuoteCreated?: (quote: Quote) => void;
```

**Change 2 — invocation** (line 283):
```typescript
// BEFORE:
onQuoteCreated(quote);

// AFTER:
onQuoteCreated?.(quote);
```

**Change 3 — destructure** (line 51): `onQuoteCreated` is already in the destructure — no change needed; TypeScript will accept it as optional.

---

### `src/components/ImageCarousel.tsx` — HYG-05 (one-line comment for `image5.png`)

**Analog:** Same file — import block (lines 4–8):
```typescript
import screenshot1 from '../assets/screenshots/image1.png';
import screenshot2 from '../assets/screenshots/image2.png';
import screenshot3 from '../assets/screenshots/image3.png';
import screenshot4 from '../assets/screenshots/image4.png';
import screenshot6 from '../assets/screenshots/image6.png';
import screenshot7 from '../assets/screenshots/image7.png';
```

Note the gap: `image5.png` is absent between `screenshot4` and `screenshot6`. The comment goes here:

```typescript
import screenshot4 from '../assets/screenshots/image4.png';
// image5.png retired in <commit-sha> — screenshot refresh removed this asset from the repo
import screenshot6 from '../assets/screenshots/image6.png';
```

**Executor action:** Run `git log --all --oneline -- 'src/assets/screenshots/image5.png' 'public/image5.png'` to find the commit that removed it. Substitute the actual commit SHA and a short description from the commit message. If the git log returns nothing (asset was never tracked or was removed in a squash), use: `// image5.png not in repo — screenshot sequence skips index 5`.

---

### `src/pdf/generateQuotePdf.ts` — POL-03 (remove `(doc as any)` cast)

**Analog:** Same file, line 161:
```typescript
// BEFORE:
return (doc as any).lastAutoTable.finalY as number;

// AFTER (once jspdf-augment.d.ts is in place):
return doc.lastAutoTable.finalY;
```

The function context (lines 129–162 `renderLineItems`) remains unchanged. Only line 161 is touched.

---

### `vite.config.ts` — PERF-05 (`manualChunks` explicit `react-*` routing)

**Analog:** Same file — existing `manualChunks` function (lines 101–135). Current `react-vendor` rule (lines 131–132):
```typescript
if (id.includes('node_modules')) {
  if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
  if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
  return 'vendor';
}
```

**Problem:** `react-router-dom`, `react-router`, `@remix-run/router`, and `react-window` (all `react-*` prefixed packages) are being claimed by the `vendor` fallback, and their transitive imports of core React packages create the `vendor -> react-vendor -> vendor` circular chunk warning.

**Fix — expand the react-vendor catch** to include all `react-*` scoped packages explicitly:
```typescript
if (id.includes('/react/') || id.includes('/react-dom/')
  || id.includes('/react-router') || id.includes('/react-window')
  || id.includes('/@remix-run/')) {
  return 'react-vendor';
}
```

OR use a regex approach:
```typescript
if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|react-window|@remix-run)\//.test(id)) {
  return 'react-vendor';
}
```

**Critical ordering constraint:** This block must remain INSIDE the `node_modules` guard and AFTER the `pdf` check (existing order is correct — do not reorder). The comment block at lines 95–100 documents the ordering rationale; add a note referencing PERF-05 Phase 25.

**Verification:** `npm run build` must emit zero chunk-graph warnings. Capture the last 20 lines of build output in the plan summary as proof.

---

## Shared Patterns

### TypeScript Verification
**Source:** `.claude/CLAUDE.md` + `~/CLAUDE.md`
**Apply to:** All files that touch TypeScript (every plan except P1 doc-only)
```bash
tsc -b     # required — matches Vercel's tsc -b && vite build
npm run build  # confirm no Rollup warnings or Vite errors
```
Never use `tsc --noEmit`. Both commands must exit 0 before committing.

### Atomic Commits
**Source:** Phase 24 precedent (24-CONTEXT.md), Phase 18 precedent
**Apply to:** All 5 plans
One commit per logical task within a plan. CONTEXT.md D-01b specifies the commit helper; D-01a (Plan 3) suggests ordering: HYG-05 → A11Y-09 → POL-04 → HYG-04 → HYG-01.

### No `--no-verify`
**Source:** Phase 18 + Phase 24 precedent, `.claude/CLAUDE.md`
**Apply to:** Every commit
Pre-commit hooks must run without bypass.

### `downloadCsv` blob pattern
**Source:** `src/utils/csvHelpers.ts` lines 333–344
**Apply to:** POL-02 button handler in `CustomerCsvImportModal`
```typescript
export function downloadCsv(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```
This is already exported from `csvHelpers.ts` — import and call directly, do not reimplement.

### Outside-click useEffect pattern
**Source:** `src/components/FilamentSelector.tsx` lines 52–61; `src/components/Header.tsx` lines 29–31
**Apply to:** POL-04 (`QuoteRow` overflow menu)
Key points: `document.addEventListener('mousedown', ...)`, `useRef` for container, `.contains(event.target as Node)` guard, cleanup in return function, guard the effect on the open-state boolean so it registers/deregisters per state cycle.

### Escape key via keydown pattern
**Source:** `src/components/CustomerCsvImportModal.tsx` lines 59–66
**Apply to:** POL-04 (`QuoteRow` overflow menu — Escape close)
`window.addEventListener('keydown', handler)` where `handler` checks `e.key === 'Escape'`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/pdf/jspdf-augment.d.ts` (NEW) | type config | — | No existing module-augmentation `.d.ts` in the project. `src/globals.d.ts` provides the ambient-declaration idiom but is `declare const`, not `declare module`. The POL-03 augmentation block is fully specified in REQUIREMENTS.md — no analog search needed. |

---

## Doc-Only Surfaces (P1 — no code analog needed)

These are pure text edits in `.planning/` files. Pattern is "read → locate → edit in place."

| File | Action | Location |
|---|---|---|
| `.planning/milestones/v1.2-REQUIREMENTS.md` | DOC-01: flip TAGS-01 + TAGS-04 rows from `Pending (outstanding-pending-...)` to `Complete` in Traceability table | Traceability table rows |
| `.planning/milestones/v1.2-REQUIREMENTS.md` | DOC-02: verify archive-header note about CUST-01/CUST-02 wording drift is present; add if missing | Archive header section |
| `.planning/todos/ui-consistency-sweep.md` | HYG-10: audit subtasks against current code; check off shipped items; leave open items with `<!-- audited 2026-05-25: still open -->` comment | All 5 sections of the todo |
| `.planning/todos/customer-csv-template-download.md` | POL-02 closure: mark closed; move to `.planning/todos/completed/` | File itself |

---

## Metadata

**Analog search scope:** `src/components/`, `src/utils/`, `src/pdf/`, root `vite.config.ts`, root `src/globals.d.ts`
**Files read:** 9 source files + 3 planning files
**Pattern extraction date:** 2026-05-25
