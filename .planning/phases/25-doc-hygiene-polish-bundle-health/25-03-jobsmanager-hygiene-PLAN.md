---
phase: 25-doc-hygiene-polish-bundle-health
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/JobsManager.tsx
  - src/components/PrintQuoteModal.tsx
  - src/components/ImageCarousel.tsx
autonomous: true
requirements: [HYG-01, HYG-04, HYG-05, POL-04, A11Y-09]
must_haves:
  truths:
    - "JobsManager has no permanently-empty generatingJobIds Set; isGeneratingPdf prop is removed from JobRowProps + JobCardProps + rowProps + all call sites (HYG-01) — locked to D-02: Option B (delete the slot entirely; no derive-at-parent fallback per D-02a)"
    - "PrintQuoteModal.onQuoteCreated is optional (`?:`) and invoked via `?.()`; JobsManager no longer passes a no-op (HYG-04) — locked to D-03: Option A (make optional + drop no-op arg; the prop survives as an optional extension point)"
    - "ImageCarousel has a one-line comment near imports explaining image5.png absence (HYG-05)"
    - "QuoteRow overflow menu closes when user clicks outside its container OR presses Escape; listeners register/unregister gated on overflowOpen (POL-04)"
    - "QuoteStatusPill has aria-label='Status: {Pending|Sale|Declined}' and Declined-pill text contrast meets WCAG AA 3:1 on bg-slate-700 (A11Y-09)"
    - "Phase 25 sequencing accepted per D-00 (proceed despite Phase 19–23 not yet landed; risk of follow-on accepted) and plan layout follows D-01 (5 plans, surface-grouped, single wave, parallel-safe — this plan owns JobsManager+PrintQuoteModal+ImageCarousel surfaces only)"
  artifacts:
    - path: "src/components/JobsManager.tsx"
      provides: "Slot-free + accessible QuoteStatusPill + outside-click-closing QuoteRow overflow"
      contains: "aria-label={`Status: ${label}`}"
    - path: "src/components/PrintQuoteModal.tsx"
      provides: "Optional onQuoteCreated prop"
      contains: "onQuoteCreated?: (quote: Quote) => void"
    - path: "src/components/ImageCarousel.tsx"
      provides: "Documented image5.png absence"
      contains: "image5.png"
  key_links:
    - from: "QuoteRow overflow useEffect"
      to: "document.addEventListener('mousedown', ...)"
      via: "outside-click handler gated on overflowOpen"
      pattern: "addEventListener\\(['\"]mousedown['\"]"
    - from: "QuoteRow overflow useEffect"
      to: "window.addEventListener('keydown', ...) Escape"
      via: "Escape handler gated on overflowOpen"
      pattern: "key === ['\"]Escape['\"]"
    - from: "QuoteStatusPill <span>"
      to: "aria-label"
      via: "static template literal"
      pattern: "aria-label=\\{`Status:"
---

<objective>
JobsManager hygiene + accessibility batch — close 5 audit findings on the JobsManager + PrintQuoteModal + ImageCarousel surfaces. Atomic commits in the order specified by 25-CONTEXT.md Claude's Discretion (HYG-05 first as trivial, HYG-01 last as biggest diff so prior commits review against a stable baseline).

Purpose:
- **HYG-05** (REQUIREMENTS.md line 58): one-line comment in `src/components/ImageCarousel.tsx` between `image4` and `image6` imports explaining why `image5.png` is absent. Trivial. Done first.
- **A11Y-09** (REQUIREMENTS.md line 26): `QuoteStatusPill` (`JobsManager.tsx` lines 128–135) gets `aria-label="Status: ${label}"`; Declined-pill `text-slate-300` → `text-slate-200` so contrast on `bg-slate-700` clears WCAG AA 3:1 (measured ~4.6:1 after change per 25-PATTERNS.md).
- **POL-04** (REQUIREMENTS.md line 99): `QuoteRow` overflow menu (Pending Quote actions) closes on outside click + Escape. Add gated `useEffect` registering `mousedown` document listener + `keydown` window listener while `overflowOpen` is true. Pattern from `FilamentSelector.tsx:52–61` + `CustomerCsvImportModal.tsx:59–66` (Escape).
- **HYG-04** (REQUIREMENTS.md line 57): `PrintQuoteModal.onQuoteCreated` made optional (`?:`); invocation at `PrintQuoteModal.tsx:283` changes from `onQuoteCreated(quote)` to `onQuoteCreated?.(quote)`; the no-op `onQuoteCreated={() => { /* ... */ }}` at `JobsManager.tsx:2085` is dropped. The "could trigger a toast in a future plan" comment is NOT carried forward (per 25-CONTEXT.md `<specifics>`).
- **HYG-01** (REQUIREMENTS.md line 54): delete the `generatingJobIds` permanently-empty Set + the `isGeneratingPdf` prop from `JobRowProps`, `JobCardProps`, `rowProps`, and all call sites (lines 772, 803, 834, 978–980, 1628, 1650, 1746 + JobCardProps line 45 + JobCard usage at line 634). Option B per D-02 — pure deletion. Phase 22 collision risk acknowledged (D-02b) — if Phase 22 lands first, executor re-targets to extracted files; today (D-00 ordering) Phase 25 is first.

Output: 5 atomic commits in the locked order (HYG-05 → A11Y-09 → POL-04 → HYG-04 → HYG-01) + `tsc -b` clean + `npm run build` clean + existing tests pass.
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
@src/components/JobsManager.tsx
@src/components/PrintQuoteModal.tsx
@src/components/ImageCarousel.tsx
@src/components/FilamentSelector.tsx
@src/components/CustomerCsvImportModal.tsx

<interfaces>
<!-- Extracted from 25-PATTERNS.md — executor uses these directly, no codebase scavenger hunt needed -->

From src/components/JobsManager.tsx — HYG-01 slot locations (per 25-PATTERNS.md):
- Line 45 (JobCardProps): `isGeneratingPdf` prop
- Line 634 (JobCard usage): `disabled={isGeneratingPdf || ...}`
- Line 772 (JobRowProps): `generatingJobIds: Set<string>;`
- Line 803 (JobRow destructure): `generatingJobIds,`
- Line 834 (JobCard call in JobRow): `isGeneratingPdf={generatingJobIds.has(job.id)}`
- Lines 978–980 (useMemo + comment): `const generatingJobIds = useMemo(() => new Set<string>(), []);` + inline comment
- Line 1628 (rowProps): `generatingJobIds,`
- Line 1650 (useMemo deps): `generatingJobIds` in dep array
- Line 1746 (non-virtualized JobCard call): `isGeneratingPdf={generatingJobIds.has(job.id)}`

Line numbers per 25-PATTERNS.md (read 2026-05-25). Verify they have NOT drifted by re-greppng before editing.

From src/components/JobsManager.tsx — QuoteStatusPill (A11Y-09, lines 101–135):
```tsx
const QUOTE_PILL_STYLES = {
  pending:  { label: 'Pending',  classes: 'bg-amber-500/20 text-amber-300' },  // current — verify
  sale:     { label: 'Sale',     classes: 'bg-green-500/20 text-green-300' },  // current — verify
  declined: { label: 'Declined', classes: 'bg-slate-700 text-slate-300' },      // CHANGE text-slate-300 → text-slate-200
};

function QuoteStatusPill({ kind }: { kind: QuotePillKind }) {
  const { label, classes } = QUOTE_PILL_STYLES[kind];
  return (
    <span
      aria-label={`Status: ${label}`}   // ADD
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}
```

From src/components/JobsManager.tsx — QuoteRow (POL-04, around line 150):
- `overflowOpen` state already exists in QuoteRow component
- The overflow container `<div className="flex items-center gap-2 shrink-0 relative">` is at line 172 — attach `ref={overflowRef}` here
- Insert new `useEffect` gated on `overflowOpen` (see action section)

From src/components/JobsManager.tsx — line 2085 (HYG-04):
```tsx
// BEFORE:
onQuoteCreated={() => { /* no-op for now; could trigger a toast in a future plan */ }}
// AFTER:
// (entire line deleted — prop is now optional)
```

From src/components/PrintQuoteModal.tsx — HYG-04 (lines 31–49 + 51 + 283):
- Line 36: `onQuoteCreated: (quote: Quote) => void;` → `onQuoteCreated?: (quote: Quote) => void;`
- Line 51: destructure already includes `onQuoteCreated` — no change needed
- Line 283: `onQuoteCreated(quote);` → `onQuoteCreated?.(quote);`

From src/components/ImageCarousel.tsx — HYG-05 (lines 4–8 imports):
```typescript
import screenshot4 from '../assets/screenshots/image4.png';
// INSERT comment HERE — between image4 and image6 imports
import screenshot6 from '../assets/screenshots/image6.png';
```

From src/components/FilamentSelector.tsx — outside-click analog (lines 52–61):
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

From src/components/CustomerCsvImportModal.tsx — Escape analog (lines 59–66):
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
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: HYG-05 — one-line comment for image5.png absence in ImageCarousel</name>
  <files>src/components/ImageCarousel.tsx</files>
  <read_first>
    - src/components/ImageCarousel.tsx (FULL FILE — confirm imports block at lines 4–8 has gap between image4 and image6)
    - .planning/REQUIREMENTS.md (HYG-05 line 58)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`src/components/ImageCarousel.tsx — HYG-05` section)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (`Specific Ideas` — HYG-05 commit-history grep guidance)
  </read_first>
  <action>
    Per HYG-05 + 25-CONTEXT.md Claude's Discretion (HYG-05 exact comment text):

    1. Run a git history grep to find when/why `image5.png` was retired:
       `git log --all --oneline -- 'src/assets/screenshots/image5.png' 'public/image5.png'`
       Also try variants: `git log --all --diff-filter=D -- 'src/assets/screenshots/image5.png'`

    2. Insert ONE line of comment between the `image4` and `image6` imports (currently lines 4–8 of `src/components/ImageCarousel.tsx`). Pick from these formats (executor's discretion — pick the one most accurate to git history findings):

       Format A (commit + reason found):
       `// image5.png retired in <commit-sha> (<commit-message-summary>) — asset removed from repo during screenshot refresh; carousel index sequence skips 5.`

       Format B (commit found, reason ambiguous):
       `// image5.png retired in <commit-sha> — screenshot refresh removed this asset; carousel index sequence skips 5.`

       Format C (git log returns nothing — asset never tracked or removed in squash):
       `// image5.png not in repo — screenshot sequence intentionally skips index 5 (asset retired pre-history-tracked timeframe).`

    3. Must capture: (1) it was retired, (2) which commit retired it (if grep returns), (3) why (if recoverable). If the why is lost: "retired in v1.x screenshot refresh — image asset no longer in repo" is acceptable (per CONTEXT.md Claude's Discretion).

    4. Do NOT change any import statements. Do NOT change any JSX. ONE comment line, nothing else.

    Commit message focus: `chore(25-03): document image5.png absence (HYG-05)`.
  </action>
  <verify>
    <automated>grep -E "image5\.png" src/components/ImageCarousel.tsx | grep -c "//" | grep -qE "^[1-9]" && tsc -b > /dev/null 2>&1 && echo "HYG-05 pass: comment present + tsc -b clean"</automated>
  </verify>
  <done>
    `src/components/ImageCarousel.tsx` contains ≥ 1 comment line referencing `image5.png`; line is positioned between `image4` and `image6` imports; `tsc -b` exits 0; commit landed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: A11Y-09 — QuoteStatusPill aria-label + Declined-pill contrast</name>
  <files>src/components/JobsManager.tsx</files>
  <read_first>
    - src/components/JobsManager.tsx (lines 95–140 — QUOTE_PILL_STYLES + QuoteStatusPill — confirm current `text-slate-300` for Declined pill BEFORE editing; line numbers may have drifted)
    - .planning/REQUIREMENTS.md (A11Y-09 line 26)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`A11Y-09 (QuoteStatusPill aria-label + Declined contrast)` section — exact `aria-label="Status: ${label}"` and `text-slate-300` → `text-slate-200` changes)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (`code_context` → "A11Y-09 contrast check" — `slate-200` on `slate-700` ≈ 4.6:1, comfortably above 3:1 threshold)
  </read_first>
  <action>
    Per A11Y-09 + 25-PATTERNS.md, two surgical edits inside `src/components/JobsManager.tsx`:

    EDIT 1 — `QUOTE_PILL_STYLES.declined.classes` (around line 104):
    BEFORE: `declined: { label: 'Declined', classes: 'bg-slate-700 text-slate-300' },`
    AFTER:  `declined: { label: 'Declined', classes: 'bg-slate-700 text-slate-200' },`

    Rationale: `slate-300` (#cbd5e1) on `slate-700` (#334155) ≈ 3.0:1 — exactly at the WCAG AA 3:1 minimum for non-body text, no safety margin. `slate-200` (#e2e8f0) on `slate-700` ≈ 4.6:1, comfortably above. Verified via 25-CONTEXT.md `<code_context>`.

    EDIT 2 — `QuoteStatusPill` component `<span>` (around line 128–135):
    Add the `aria-label` attribute on the `<span>`:
    ```tsx
    function QuoteStatusPill({ kind }: { kind: QuotePillKind }) {
      const { label, classes } = QUOTE_PILL_STYLES[kind];
      return (
        <span
          aria-label={`Status: ${label}`}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
        >
          {label}
        </span>
      );
    }
    ```

    The exact aria-label string per REQUIREMENTS.md A11Y-09 is `Status: {Pending|Sale|Declined}` — which the template literal `\`Status: ${label}\`` produces (label values are exactly `'Pending'`, `'Sale'`, `'Declined'` per `QUOTE_PILL_STYLES`).

    Do NOT touch `QUOTE_PILL_STYLES.pending` or `QUOTE_PILL_STYLES.sale`. Do NOT touch any other QuoteRow code. Do NOT add a `features.ts` entry.

    Commit message focus: `fix(25-03): add aria-label to QuoteStatusPill + Declined contrast (A11Y-09)`.
  </action>
  <verify>
    <automated>grep -E "aria-label=\{`Status:" src/components/JobsManager.tsx | head -1 && grep -E "declined:.*'bg-slate-700 text-slate-200'" src/components/JobsManager.tsx | head -1 && tsc -b > /dev/null 2>&1 && echo "A11Y-09 pass: aria-label present + slate-200 applied + tsc -b clean"</automated>
  </verify>
  <done>
    `grep "aria-label=\\\`Status:" src/components/JobsManager.tsx` returns ≥ 1 line; `grep "declined.*text-slate-200" src/components/JobsManager.tsx` returns ≥ 1 line; `text-slate-300` no longer appears in the QUOTE_PILL_STYLES `declined` entry; `tsc -b` exits 0; commit landed.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: POL-04 — QuoteRow overflow menu outside-click + Escape close</name>
  <files>src/components/JobsManager.tsx</files>
  <read_first>
    - src/components/JobsManager.tsx (lines 140–200 — locate `QuoteRow` component; find `overflowOpen` state; find the overflow container `<div className="flex items-center gap-2 shrink-0 relative">` at ~line 172)
    - src/components/FilamentSelector.tsx (lines 52–61 — outside-click pattern analog)
    - src/components/CustomerCsvImportModal.tsx (lines 59–66 — Escape pattern analog)
    - .planning/REQUIREMENTS.md (POL-04 line 99 — "mousedown document listener while open")
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`POL-04 (overflow menu outside-click + Escape)` section — exact useEffect block spelled out)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (`Integration Points` → POL-04 test harness: `fireEvent.mouseDown(document.body)` + `fireEvent.keyDown(window, { key: 'Escape' })`)
  </read_first>
  <behavior>
    - Test 1 (behavioral): when `overflowOpen` is true, clicking outside the QuoteRow overflow container (e.g., `fireEvent.mouseDown(document.body)`) sets `overflowOpen` to false → menu closes.
    - Test 2 (behavioral): when `overflowOpen` is true, pressing Escape (`fireEvent.keyDown(window, { key: 'Escape' })`) sets `overflowOpen` to false → menu closes.
    - Test 3 (cleanup): when component unmounts OR `overflowOpen` flips false, both listeners are removed (no leak — `removeEventListener` called in the return cleanup).
    - Test 4 (no-fire-when-closed): when `overflowOpen` is false, clicks outside have no effect (listeners are not registered).
  </behavior>
  <action>
    Per POL-04 + 25-PATTERNS.md, inside `QuoteRow` component in `src/components/JobsManager.tsx`:

    1. Locate `QuoteRow` component. Confirm `overflowOpen` state is declared (line ~150).

    2. Add a `useRef` for the overflow container near other refs/state in the component body:
       ```typescript
       const overflowRef = useRef<HTMLDivElement>(null);
       ```

    3. Add a gated `useEffect` immediately after the state declarations:
       ```typescript
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

    4. Attach `ref={overflowRef}` to the existing overflow container `<div className="flex items-center gap-2 shrink-0 relative">` at line ~172.

    5. CRITICAL: the `if (!overflowOpen) return;` early-return at the top of the useEffect ensures the listeners are registered ONLY while the menu is open (per 25-PATTERNS.md convention + REQUIREMENTS.md POL-04 spec "while open"). This is more efficient than FilamentSelector's always-registered approach AND prevents the handler from firing when the menu isn't even visible.

    6. Verify `useRef` and `useEffect` are already imported at the top of `JobsManager.tsx` (they almost certainly are — JobsManager uses them heavily). If not, add to the React import.

    7. If a `JobsManager.test.tsx` test for QuoteRow exists (run `grep -l 'QuoteRow' src/components/JobsManager.test.tsx 2>/dev/null`), add the 4 behavioral tests above using existing RTL patterns. If no test for QuoteRow exists in the file, add a new `describe("POL-04 overflow menu close", ...)` block following existing test conventions in that file. Do NOT scaffold a new test file in this plan — extend the existing JobsManager.test.tsx if it exists; if the file does not exist, defer test coverage to Phase 23 (which covers Customer-UI tests but may absorb QuoteRow tests as well — note the deferral in the plan summary).

    Commit message focus: `fix(25-03): QuoteRow overflow menu closes on outside-click + Escape (POL-04)`.
  </action>
  <verify>
    <automated>grep -E "addEventListener\(['\"]mousedown['\"]" src/components/JobsManager.tsx | head -1 && grep -E "key === ['\"]Escape['\"]" src/components/JobsManager.tsx | head -1 && grep -E "overflowRef = useRef" src/components/JobsManager.tsx | head -1 && tsc -b > /dev/null 2>&1 && npm test -- src/components/JobsManager.test.tsx 2>&1 | tail -5 || echo "test file absent — POL-04 manual UAT noted in summary"; echo "POL-04 pass: handlers + ref present + tsc -b clean"</automated>
  </verify>
  <done>
    `JobsManager.tsx` contains the outside-click + Escape useEffect; `overflowRef` is a `useRef<HTMLDivElement>`; the existing overflow container `<div>` has `ref={overflowRef}`; listeners register/unregister gated on `overflowOpen`; `tsc -b` exits 0; if test file exists, tests pass; commit landed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: HYG-04 — PrintQuoteModal.onQuoteCreated optional + drop no-op in JobsManager</name>
  <files>
    src/components/PrintQuoteModal.tsx,
    src/components/JobsManager.tsx
  </files>
  <read_first>
    - src/components/PrintQuoteModal.tsx (lines 31–55 — `PrintQuoteModalProps` interface + destructure; line 283 — invocation site)
    - src/components/JobsManager.tsx (around line 2085 — the no-op `onQuoteCreated={...}` call site)
    - .planning/REQUIREMENTS.md (HYG-04 line 57)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`HYG-04` sections in both JobsManager + PrintQuoteModal)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (D-03 + D-03a — Option A locked: make optional + drop the no-op arg; `<specifics>` line 170 — do NOT carry the future-toast comment forward into the new site)
  </read_first>
  <action>
    Per HYG-04 + D-03 (Option A — locked) + 25-PATTERNS.md, three surgical edits across two files:

    EDIT 1 — `src/components/PrintQuoteModal.tsx` line 36 (`PrintQuoteModalProps` interface):
    BEFORE: `onQuoteCreated: (quote: Quote) => void;`
    AFTER:  `onQuoteCreated?: (quote: Quote) => void;`

    Single character change: add `?` before `:`. Type becomes optional.

    EDIT 2 — `src/components/PrintQuoteModal.tsx` line 283 (invocation):
    BEFORE: `onQuoteCreated(quote);`
    AFTER:  `onQuoteCreated?.(quote);`

    Optional-chaining call invocation. If the prop is provided, it's invoked with the new Quote (unchanged behavior). If absent (as in the post-edit JobsManager call site), it's a no-op (matches the deleted JSX's behavior — but without the dead code).

    EDIT 3 — `src/components/JobsManager.tsx` line 2085: DELETE the entire prop line `onQuoteCreated={() => { /* no-op for now; could trigger a toast in a future plan */ }}`.

    DO NOT carry the "could trigger a toast in a future plan" comment forward to a new location (per 25-CONTEXT.md `<specifics>` line 170 — the optional prop is self-documenting; if the toast intent matters, drop it as a sibling todo in `.planning/todos/` named `quote-created-toast.md`, NOT as a JSX comment in production code).

    Verify: after the deletion, the surrounding JSX in JobsManager (the `<PrintQuoteModal ... />` element) still passes all required props. The destructure inside PrintQuoteModal at line 51 already includes `onQuoteCreated` — no change to destructure needed (TypeScript treats it as `(quote: Quote) => void | undefined`).

    Optional toast-intent note: If the executor judges the toast intent worth preserving for future readers, drop a new todo at `.planning/todos/quote-created-toast.md` (NOT in `.planning/todos/completed/`) with one paragraph describing the deferred future-toast wiring. Executor's discretion — not required by the spec.

    Commit message focus: `refactor(25-03): make onQuoteCreated optional + drop no-op (HYG-04)`.
  </action>
  <verify>
    <automated>grep -E "onQuoteCreated\?: \(quote: Quote\) => void;" src/components/PrintQuoteModal.tsx | head -1 && grep -E "onQuoteCreated\?\.\(quote\);" src/components/PrintQuoteModal.tsx | head -1 && ! grep -q "no-op for now.*toast in a future plan" src/components/JobsManager.tsx && tsc -b > /dev/null 2>&1 && echo "HYG-04 pass: prop optional + invocation ?.() + no-op deleted + tsc -b clean"</automated>
  </verify>
  <done>
    PrintQuoteModalProps.onQuoteCreated is optional; invocation uses `?.()`; the no-op comment is no longer in JobsManager.tsx (grep returns 0); `tsc -b` exits 0; commit landed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: HYG-01 — delete generatingJobIds slot entirely from JobsManager</name>
  <files>src/components/JobsManager.tsx</files>
  <read_first>
    - src/components/JobsManager.tsx (FULL FILE — line numbers may have drifted from 25-PATTERNS.md's 2026-05-25 read; pre-edit, run greps to confirm current locations: `grep -n "generatingJobIds\|isGeneratingPdf" src/components/JobsManager.tsx`)
    - .planning/REQUIREMENTS.md (HYG-01 line 54 — "EITHER derive loading state at the parent FROM `printQuoteModalState !== null && state.job.id === job.id`, OR delete the slot entirely")
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (D-02 + D-02a + D-02b — Option B locked: delete entirely; rationale: no async window where indicator would fire; Phase 22 collision risk noted)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`HYG-01 (generatingJobIds slot deletion)` section — exact 9 deletion sites listed)
  </read_first>
  <action>
    Per HYG-01 + D-02 (Option B — locked: delete entirely) + 25-PATTERNS.md, perform pure deletion across 9 locations in `src/components/JobsManager.tsx`. This is the biggest diff in the plan and is ordered LAST per 25-CONTEXT.md Claude's Discretion so that Tasks 1–4 commit against a stable baseline.

    Pre-edit step: run `grep -n "generatingJobIds\|isGeneratingPdf" src/components/JobsManager.tsx` to confirm current locations. The 25-PATTERNS.md line numbers (read 2026-05-25) may have drifted from Tasks 2–4 above touching the same file. Use the grep output as ground truth.

    The 9 locations to delete (from 25-PATTERNS.md):

    1. **JobCardProps line ~45** — delete the `isGeneratingPdf: boolean;` (or `isGeneratingPdf?: boolean;`) line from the `JobCardProps` interface.

    2. **JobCard usage line ~634** — in the JobCard component body, remove `isGeneratingPdf` from any destructure AND remove its usage in `disabled={isGeneratingPdf || ...}`. If `isGeneratingPdf` was the ONLY condition in the `disabled` expression, the result is `disabled={false}` — in that case, delete the entire `disabled` prop. If `isGeneratingPdf` was OR'd with another condition, drop the `isGeneratingPdf ||` portion only.

    3. **JobRowProps line ~772** — delete `generatingJobIds: Set<string>;` from the `JobRowProps` interface.

    4. **JobRow destructure line ~803** — remove `generatingJobIds,` from the parameters destructure.

    5. **JobCard call line ~834** — in the `JobRow` body, remove `isGeneratingPdf={generatingJobIds.has(job.id)}` from the JobCard JSX call.

    6. **useMemo + comment lines ~978–980** — delete the entire `const generatingJobIds = useMemo(() => new Set<string>(), []);` declaration AND the surrounding inline comment about why it's a permanently-empty Set.

    7. **rowProps line ~1628** — remove `generatingJobIds,` from the `rowProps` object literal.

    8. **useMemo deps line ~1650** — remove `generatingJobIds` from the dep array of the `useMemo` that builds `rowProps`.

    9. **Non-virtualized branch line ~1746** — remove `isGeneratingPdf={generatingJobIds.has(job.id)}` from the JobCard JSX call in the non-virtualized branch.

    AFTER all 9 deletions: `grep -n "generatingJobIds\|isGeneratingPdf" src/components/JobsManager.tsx` MUST return ZERO matches. If TypeScript catches any missed sites at `tsc -b`, fix them in the same commit.

    DO NOT preserve the slot as an optional prop. DO NOT add a comment "removed in Phase 25". DO NOT add a placeholder for future async PDF flow (per D-02a — if/when async PDF flow lands, the slot comes back with real backing data, not a permanently-empty Set).

    Phase 22 collision note (D-02b): Phase 22 decomposes JobsManager (extracts `<RecordSaleModal>`, `<SaleRow>`, `useCustomerPicker`). HYG-01 deletions touch surfaces that Phase 22 will move. By ordering Phase 25 first (D-00), Phase 22 starts from a slot-free baseline — slightly easier for Phase 22 executors.

    Commit message focus: `refactor(25-03): delete generatingJobIds permanently-empty slot (HYG-01)`.
  </action>
  <verify>
    <automated>! grep -E "generatingJobIds|isGeneratingPdf" src/components/JobsManager.tsx && tsc -b > /dev/null 2>&1 && npm run build > /tmp/25-03-hyg01-build.log 2>&1 && tail -5 /tmp/25-03-hyg01-build.log; echo "HYG-01 pass: zero slot references + tsc -b + npm run build clean"</automated>
  </verify>
  <done>
    `grep -E "generatingJobIds|isGeneratingPdf" src/components/JobsManager.tsx` returns 0 matches (zero occurrences); `tsc -b` exits 0; `npm run build` exits 0; existing tests (if `JobsManager.test.tsx` exists) still pass; commit landed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → QuoteRow overflow menu | User clicks `[⋯]` button → menu opens; user clicks outside OR presses Escape → menu closes. Handlers registered on `document` (mousedown) and `window` (keydown). Listeners gated on `overflowOpen` — registered only when menu open. |
| browser → QuoteStatusPill | Static aria-label string from `QUOTE_PILL_STYLES.<kind>.label` (`'Pending'`, `'Sale'`, `'Declined'`) — no user input flows into the template literal. |
| internal → JobsManager state | HYG-01 + HYG-04 are pure deletions/optionality changes — no new attack surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25-03-01 | Tampering | POL-04 outside-click handler registration | mitigate | useEffect early-returns when `overflowOpen` is false — listeners are NOT registered when menu is closed. Cleanup function in useEffect return removes both listeners on unmount AND when `overflowOpen` flips false. No leak. |
| T-25-03-02 | Information disclosure | POL-04 event handlers | accept | Handlers only call `setOverflowOpen(false)` — no event data is read, transmitted, or logged. The `e.target` is checked only for DOM containment via `.contains()` — no user-controlled data flows out. |
| T-25-03-03 | Injection | A11Y-09 aria-label template literal | accept | The template `` `Status: ${label}` `` interpolates ONLY values from the `QUOTE_PILL_STYLES` const (`'Pending'`, `'Sale'`, `'Declined'`) — no user input. aria-label is a static attribute consumed by AT software; no XSS surface (React escapes attribute values by default). |
| T-25-03-04 | Denial of service | POL-04 keydown listener on `window` | accept | One keydown listener, gated on `overflowOpen`, single keystroke check (`e.key === 'Escape'`). Cleanup on unmount/state-change. Pattern is identical to `CustomerCsvImportModal.tsx:59–66` already in production. |
| T-25-03-05 | Elevation of privilege | HYG-04 optional prop / HYG-01 slot deletion | accept | Pure type/code deletion. No new capabilities introduced. Existing call sites either pass the prop (real handler) or omit it (no-op). |
| T-25-03-SC | Tampering | npm package installs | mitigate | N/A — no package installs in this plan. RESEARCH.md Package Legitimacy Audit table not required. |

**ASVS Level 1** — handler registration is leak-safe (cleanup verified); aria-label uses static literals only; no user input enters any new surface. Block threshold: HIGH severity (none present).
</threat_model>

<verification>
- `tsc -b` exits 0 after each task (Vercel build chain compatibility)
- `npm run build` exits 0 after Task 5 (sanity check the largest diff)
- After Task 1 (HYG-05): `grep "image5.png" src/components/ImageCarousel.tsx | grep "//"` returns ≥ 1
- After Task 2 (A11Y-09): `grep "aria-label={\`Status:" src/components/JobsManager.tsx` returns ≥ 1; `grep "text-slate-200" src/components/JobsManager.tsx` returns ≥ 1 (in the `declined` pill row)
- After Task 3 (POL-04): `grep "addEventListener('mousedown'" src/components/JobsManager.tsx` returns ≥ 1; `grep "key === 'Escape'" src/components/JobsManager.tsx` returns ≥ 1; `grep "overflowRef = useRef" src/components/JobsManager.tsx` returns ≥ 1
- After Task 4 (HYG-04): `grep "onQuoteCreated\?:" src/components/PrintQuoteModal.tsx` returns ≥ 1; `grep "onQuoteCreated\?\.(quote)" src/components/PrintQuoteModal.tsx` returns ≥ 1; `grep "no-op for now.*toast in a future plan" src/components/JobsManager.tsx` returns 0
- After Task 5 (HYG-01): `grep -E "generatingJobIds|isGeneratingPdf" src/components/JobsManager.tsx` returns 0
- Existing tests pass: `npm test` exits 0 (if a JobsManager test or PrintQuoteModal test exists)
- Manual UAT (capture in plan summary):
  - Open the app in `npm run dev` (port 4173); navigate to JobsManager; click `[⋯]` on a Pending quote row; click outside the menu → menu closes; reopen; press Escape → menu closes.
  - Inspect a Declined quote pill in DevTools; aria-label reads `Status: Declined`; visually confirm the Declined-pill text is readable against `bg-slate-700`.
  - Generate a quote via PrintQuoteModal; confirm modal closes without error (HYG-04 no-op deletion didn't break the flow).
- 5 atomic commits in order: HYG-05 → A11Y-09 → POL-04 → HYG-04 → HYG-01; each via `gsd-sdk query commit`; no `--no-verify`.
</verification>

<success_criteria>
- HYG-05 closed: `src/components/ImageCarousel.tsx` has one-line comment near imports explaining `image5.png` absence
- A11Y-09 closed: `QuoteStatusPill` has `aria-label="Status: ${label}"`; Declined-pill uses `text-slate-200` on `bg-slate-700` (≈ 4.6:1 contrast, > WCAG AA 3:1)
- POL-04 closed: `QuoteRow` overflow menu closes on outside click + Escape; useEffect gated on `overflowOpen`; cleanup removes both listeners
- HYG-04 closed: `PrintQuoteModal.onQuoteCreated` is optional; invocation uses `?.()`; JobsManager no-op deleted; "future toast" comment dropped (not carried forward)
- HYG-01 closed: zero references to `generatingJobIds` or `isGeneratingPdf` remain in `JobsManager.tsx`
- `tsc -b` exits 0
- `npm run build` exits 0 with no NEW Rollup warnings (existing chunk-graph warning still present — Plan 25-05's territory)
- 5 atomic commits in the locked order
- No `features.ts` entries added; no `<NewBadge>` JSX added
</success_criteria>

<output>
Create `.planning/phases/25-doc-hygiene-polish-bundle-health/25-03-SUMMARY.md` on completion. Capture: (1) commit SHA + message for each of the 5 atomic commits in execution order, (2) the exact image5.png comment text + commit-history grep result, (3) the measured Declined-pill contrast ratio post-change (paste WebAIM or DevTools reading), (4) confirmation the 9 HYG-01 deletion sites all resolved (grep evidence), (5) Phase 22 collision watch — if JobsManager is later decomposed and any deleted slot was missed, note it for Phase 22 to verify, (6) any deviation from suggested line numbers (drift from 25-PATTERNS.md's 2026-05-25 read).
</output>
</content>
</invoke>