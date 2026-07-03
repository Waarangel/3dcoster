# Phase 38: Foundation - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 12 (2 hooks, 5 components, 1 modified orchestrator, 1 modified App.tsx, 3 test files)
**Analogs found:** 12 / 12 (all resolve to in-repo precedent; no external-pattern fallback needed)

**Key project fact for the planner:** This phase has no true "controller/service/model" analogs in the CRUD sense — it is a pure client-side React refactor. Every file's closest analog is another React component/hook in this same codebase, primarily the source file being split (`CostCalculator.tsx` itself, which supplies every excerpt to preserve) and the Phase 22/36 `JobsManager.tsx` decomposition (still a single file, but internally split into extracted pure functions, a `memo`-wrapped subcomponent, and hook-lifted Dexie subscriptions — the actual in-repo precedent for "how this codebase decomposes a God-component" even though it never moved to a folder).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hooks/useCostForm.ts` | hook (state/store) | CRUD (local form state + sessionStorage) | `src/components/CostCalculator.tsx` lines 162-351 (state to extract) | exact — literal extraction, not a new pattern |
| `src/hooks/useCostDerivedValues.ts` | hook (derived state / reducer) | transform (useMemo chain + useReducer state machine) | `src/components/CostCalculator.tsx` lines 367-610, 789-852 (memos + both pricing effects) | exact — literal extraction + FOUND-02 redesign |
| `src/components/calculator/CostCalculator.tsx` (orchestrator) | component (container) | request-response (composes hooks + sections) | `src/components/JobsManager.tsx` lines 1033-1737 (`JobsManager` — lean-ish orchestrator that lifts Dexie hooks and composes extracted subcomponents) | role-match — best "orchestrator that stayed the entry point" precedent in-repo |
| `src/components/calculator/CostFormSection.tsx` | component (presentational) | request-response (controlled inputs) | `src/components/JobsManager.tsx` lines 478-958 (`JobCard`, `memo`-wrapped, all-props-in, no Dexie access) | role-match — same "props-in, callbacks-out, no data fetching" contract |
| `src/components/calculator/CostParametersSection.tsx` | component (presentational) | request-response | same as above (`JobCard`) | role-match |
| `src/components/calculator/ShippingSection.tsx` | component (presentational) | request-response | same as above (`JobCard`) | role-match |
| `src/components/calculator/PricingSection.tsx` | component (presentational) | request-response (dispatches reducer actions) | same as above (`JobCard`) + `src/components/JobsManager.tsx` lines 228-378 (`QuoteRow`/`OrdersQuoteRows` — smaller extracted presentational pieces with callback props) | role-match |
| `src/components/calculator/CostSummaryPanel.tsx` | component (presentational) | transform (renders derived cost breakdown) | `src/components/JobsSummaryBar.tsx` (renders aggregate/derived numbers, no own state) | role-match |
| `src/App.tsx` (modified: tab state → URL) | component (container) + routing | request-response | `src/App.tsx` lines 41-46, 171-205, 301-339 (self — the state/JSX being replaced) | exact — in-place modification, not extraction |
| `src/components/calculator/__fixtures__/goldenScenarios.ts` | test fixture / factory | batch (fixture data) | `src/utils/costCalc.test.ts` lines 65-80 (`makeRow`/`makeCalcInput` factory pattern) | exact — same factory-with-overrides idiom, one level up (component props, not `CalcInput`) |
| `src/components/calculator/outputEquivalence.test.tsx` + `pricingSequence.test.tsx` + `renderCount.test.tsx` | test (integration, component-mount) | event-driven (sequence of dispatched DOM events) | `src/components/JobsManager.test.tsx` lines 1-120 (createRoot/act harness, native DOM event dispatch, vi.mock of `useDatabase`) | exact — this IS the project's only component-mount test idiom |
| `src/App.test.tsx` (new) | test (integration, routing) | request-response | `src/components/JobsManager.test.tsx` (harness) + `src/main.tsx` (BrowserRouter shape to wrap in test) | role-match — no existing App-level test; harness is exact, subject is new |

## Pattern Assignments

### `src/hooks/useCostForm.ts` (hook, CRUD/local-state)

**Analog:** `src/components/CostCalculator.tsx` (the file being split — this is a literal relocation, not a stylistic analog)

**sessionStorage-backed initial state pattern** (lines 40-55):
```typescript
// Session storage key for form persistence
const FORM_STORAGE_KEY = 'costCalculatorForm';

// Helper to get initial state from sessionStorage or default
function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (key in parsed) return parsed[key];
    }
  } catch (e) {
    console.error('[CostCalculator] Failed to parse sessionStorage:', e);
    sessionStorage.removeItem(FORM_STORAGE_KEY);
  }
  return defaultValue;
}
```
Move this constant + helper into `useCostForm.ts` unchanged. Every `useState(() => getStoredValue('field', default))` call (lines 162-241, ~19 fields) moves with it — do not rewrite the lazy-initializer pattern.

**Persistence effect pattern** (lines 248-284): a single `useEffect` that serializes every form field to `sessionStorage` on every change, skipping when `editingJob` is set. Dep array is the full field list — this is intentionally exhaustive (not a candidate for trimming).

**editingJob-population effect** (lines 286-337) — **contains an intentional, pre-existing suppression that must be preserved verbatim**:
```typescript
    // Restore filament rows from FilamentUsage[] (new multi-filament data model)
    const restoredRows: FilamentRow[] = (editingJob.filaments ?? []).map(fu => { /* ... */ });
    setFilamentRows(restoredRows.length > 0 ? restoredRows : [makeDefaultRow(userCurrency)]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [editingJob]);
```
This disable is documented, intentional (only re-run when the user selects a different job to edit, not on `materials`/`userCurrency` changes) and must move as-is per RESEARCH.md's Anti-Patterns section — do NOT widen the dep array during extraction.

**Filament row helpers** (lines 184-197) — plain closures over `setFilamentRows`, no special pattern, move verbatim: `addFilamentRow`, `removeFilamentRow`, `updateFilamentRow`.

---

### `src/hooks/useCostDerivedValues.ts` (hook, useReducer state machine + useMemo chain)

**Analog:** `src/components/CostCalculator.tsx` lines 367-610 (memo chain to relocate) + lines 789-852 (the two effects to REPLACE, not relocate) + `src/utils/pricingInterlink.ts` (the pure functions the reducer calls, untouched)

**The pattern being eliminated — two effects computing the same branch, one via a ref escape hatch** (lines 789-852, full text; this is the "don't copy this shape" reference, included so the planner/implementer recognizes exactly what must NOT survive):
```typescript
  useEffect(() => {
    if (trueCost <= 0) return;
    const fee = feeShapeRef.current;

    if (lastEdited === 'margin') {
      const { price, netProfit } = priceFromMargin(trueCost, profitMarginPercent, fee);
      setSellingPrice(parseFloat(price.toFixed(2)));
      setTargetProfit(parseFloat(netProfit.toFixed(2)));
    } else if (lastEdited === 'profit') {
      const { price, marginPercent } = priceFromProfit(trueCost, targetProfit, fee);
      setSellingPrice(parseFloat(price.toFixed(2)));
      setProfitMarginPercent(parseFloat(marginPercent.toFixed(1)));
    } else if (lastEdited === 'price') {
      const { netProfit, marginPercent } = marginFromPrice(trueCost, sellingPrice, fee);
      setTargetProfit(parseFloat(netProfit.toFixed(2)));
      setProfitMarginPercent(parseFloat(marginPercent.toFixed(1)));
    }
  }, [trueCost, lastEdited, profitMarginPercent, targetProfit, sellingPrice]); // "LOCKED" per comment

  useEffect(() => {
    // ...identical branch logic again...
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplaceFeeParts.pctFees, marketplaceFeeParts.fixedFees]);
```

**The pure functions the new reducer calls — already correct, do not modify** (`src/utils/pricingInterlink.ts`, full file, 70 lines):
```typescript
export interface FeeShape {
  pctFees: number;
  fixedFees: number;
}

export function priceFromMargin(trueCost: number, marginPercent: number, fee: FeeShape = NO_FEE): { price: number; netProfit: number } { /* ... */ }
export function priceFromProfit(trueCost: number, targetNetProfit: number, fee: FeeShape = NO_FEE): { price: number; marginPercent: number } { /* ... */ }
export function marginFromPrice(trueCost: number, price: number, fee: FeeShape = NO_FEE): { netProfit: number; marginPercent: number } { /* ... */ }
```
Import these three named functions unchanged. RESEARCH.md's "Pattern 1" (`pricingReducer`) is the target replacement shape — treat that code block as canonical for the reducer's structure; it is not reproduced again here to avoid duplication, see RESEARCH.md lines 171-223.

**Currency-conversion memo pattern to relocate verbatim (dep arrays are correctness-critical, do not "simplify")** (lines 130-145):
```typescript
  const convertToProfile = useCallback(
    (amount: number, from: Currency): number => convert(amount, from, userCurrency, fxTable) ?? amount,
    [userCurrency, fxTable],
  );

  const materialsInProfile = useMemo<Material[]>(
    () => materials.map(m =>
      m.costPerUnit == null
        ? m
        : { ...m, costPerUnit: convertToProfile(m.costPerUnit, m.currency ?? userCurrency), currency: userCurrency },
    ),
    [materials, convertToProfile, userCurrency],
  );
```

**Pure cost-function boundary — the hook wires reactive inputs to this, never modifies it** (`src/utils/costCalc.ts` lines 1-40, `CalcInput` shape):
```typescript
export interface CalcInputFilamentRow {
  filamentId: string;
  grams: number;
  editedPrice: number;
  editedCurrency: Currency;
}

export interface CalcInput {
  filamentRows: CalcInputFilamentRow[];
  printTimeHours: number;
  selectedPrinter: PrinterConfig | undefined;
  selectedInstance: PrinterInstance | undefined;
  electricity: ElectricityConfig;
  materials: Material[];
  materialsUsed: MaterialUsage[];
  prepTimeMinutes: number;
  postProcessingMinutes: number;
  laborHourlyRate: number;
  failureRate: number;
  profitMarginPercent: number;
  // ...
}
```
`calculateCost(input: CalcInput): CostBreakdown` is imported and called unchanged — the hook's job is only to assemble `CalcInput` from `useCostForm`'s state + props each render (inside the relocated `useMemo`, line 516 region).

---

### `src/components/calculator/CostFormSection.tsx` / `CostParametersSection.tsx` / `ShippingSection.tsx` / `PricingSection.tsx` (presentational components)

**Analog:** `src/components/JobsManager.tsx` lines 478-958 (`JobCard`) — the project's clearest "props-in, callbacks-out, memo-wrapped, zero data-fetching" presentational component

**Component shape + memo wrapping pattern** (lines 478-511):
```typescript
export const JobCard = memo(function JobCard({
  job,
  isSelected,
  info,
  recentSales,
  userCurrency,
  getFilamentName,
  getQuotesForJob,
  updateQuote,
  onToggleSelect,
  onOpenSaleForm,
  onEdit,
  onDelete,
  // ...
  style,
}: JobCardProps) {
  const [titleDraft, setTitleDraft] = useState(() => job.name);
  const [addTagDraft, setAddTagDraft] = useState('');

  useEffect(() => {
    if (isEditingTitle) {
      setTitleDraft(job.name);
    }
  }, [isEditingTitle, job.name]);
  // ...
```
Sections should follow this same contract: destructured named props (no `props.x` access), local-only `useState` for any in-section UI state (e.g., collapse toggles), `useEffect` only for re-seeding local drafts from props — never for deriving values that could be computed inline. Per D-10, no speculative extension props for Phase 39 inputs.

**Shared UI primitives import pattern** (`JobsManager.tsx` line 7, mirrors what `CostCalculator.tsx` line 7 already does — both consume the same barrel):
```typescript
import { Button, EditButton, DeleteButton, Input, EmptyState, Skeleton, shouldShowEmptyState, Modal, useToast } from './ui';
```
Section components under `src/components/calculator/` should import from `../ui` (one level up from the new `calculator/` subfolder) using the same barrel — `Button`, `Input`, `Select`, `InfoTooltip`, `CollapsibleSection` per `CostCalculator.tsx`'s existing import (line 7): `import { Button, RemoveButton, Input, Select, InfoTooltip, CollapsibleSection, useToast } from './ui';` (becomes `from '../ui'` after the folder move).

**Stable-key list-row pattern to preserve in `CostFormSection`/`CostParametersSection`** (lines 57-64 of `CostCalculator.tsx`):
```typescript
// Monotonic source of stable, view-only row keys for the dynamic filament &
// material lists. A key is assigned when a row enters component state and is
// never persisted — it's stripped before a job is written to IndexedDB
let rowKeySeq = 0;
const nextRowKey = (): string => `row-${++rowKeySeq}`;
```
This module-level counter must live in exactly one place after the split (recommend `useCostForm.ts`, since it owns `filamentRows`/`materialsUsed` state) — do not duplicate it into a section file, which would create two independent counters and risk key collisions across rows created by different sections.

---

### `src/components/calculator/CostSummaryPanel.tsx` (presentational, derived-value display)

**Analog:** `src/components/JobsSummaryBar.tsx` (renders purely derived/aggregate numbers, receives them as computed props, no own state) — closest existing "summary of derived numbers" component in the codebase.

**Analog for the currency-string rendering contract** — every derived value must render via the same `formatCurrency`/`currencySymbol` path used elsewhere so D-03's "rendered string" equivalence tests are comparing against the established formatting pipeline, not a new one. `CostCalculator.tsx` line 79: `const currencySymbol = getCurrencySymbol(userCurrency);` — pass this down as a prop from the orchestrator, do not recompute it in the panel.

---

### `src/components/calculator/CostCalculator.tsx` (orchestrator, ~150-200 LOC)

**Analog:** `src/components/JobsManager.tsx` lines 1033-1737 (`JobsManager` function) — the project's best example of a top-level feature component that stayed the single default export while its internals were decomposed into extracted functions/components living in the SAME file (not a separate folder, but the decomposition discipline is the transferable pattern: lift Dexie/derived-state hooks to the top, delegate all rendering to extracted pieces).

**Hook composition + no-business-logic-in-orchestrator pattern** (JobsManager.tsx lines 1033-1060, illustrative — the orchestrator calls hooks, computes a couple of thin derived values via `useCallback`/`useMemo`, and otherwise delegates):
```typescript
export function JobsManager({ jobs, isLoading, materials, shippingConfig, marketplaceFees, userCurrency, userProfile, fxTable, onDeleteJob, onEditJob, onSwitchTab }: JobsManagerProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // ...
  const { quotes, quotesByJobId, /* ... */ } = useQuotes();
  const getQuotesForJob = useCallback(
    (jobId: string) => quotesByJobId.get(jobId) ?? [],
    [quotesByJobId],
  );
```
`CostCalculator.tsx` (orchestrator) should mirror this: call `useCostForm()` and `useCostDerivedValues(formState, props)` at the top, keep the editing-banner `useRef`/scroll effect (lines 104-118, unchanged — this is orchestrator-owned chrome per RESEARCH.md's JSX inventory) and `handleSaveJob` inline, then render the four-to-six section components, passing hook outputs down as props. No new `useMemo`/business math should appear in this file — if a derived value doesn't already exist in `useCostForm`/`useCostDerivedValues`, it belongs in one of those hooks, not the orchestrator.

**Editing-banner scroll effect — orchestrator-owned, unchanged** (lines 104-118):
```typescript
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingJob || !bannerRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bannerRef.current.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [editingJob]);
```

---

### `src/App.tsx` (modified — tab state to URL)

**Analog:** self (in-place modification) + `src/main.tsx` (confirms `BrowserRouter` already wraps both platforms, zero changes needed there)

**Current state to replace** (line 42):
```typescript
const [activeTab, setActiveTab] = useState<Tab>('calculator');
```

**Current tab-bar click/keyboard-nav call sites that must keep calling a `setActiveTab`-shaped function with an unchanged signature** (lines 185-205, 313, 366, 382):
```typescript
  const handleTablistKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = tabs.findIndex(t => t.id === activeTab);
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') { nextIdx = (currentIdx + 1) % tabs.length; }
    // ... Home/End/ArrowLeft ...
    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = tabs[nextIdx];
      setActiveTab(nextTab.id);
      document.getElementById(`tab-${nextTab.id}`)?.focus();
    }
  };
  // ...
  onClick={() => setActiveTab(tab.id)}
  // ...
  onViewJobs={() => setActiveTab('jobs')}
  // ...
  onSwitchTab={setActiveTab}
```
The roving-tabindex A11Y contract (`role="tablist"`, `aria-selected`, `tabIndex={activeTab === tab.id ? 0 : -1}`, lines 304-336) must render identically — only the state's source (`useState` → `useSearchParams`-derived) changes. `handleEditJob` (lines 156-159) currently does `setActiveTab('calculator')` unconditionally on edit-navigation — RESEARCH.md Assumption A3 flags this needs an explicit `{replace: true}` decision at plan time (not silently assumed).

**Target replacement shape** — see RESEARCH.md "Pattern 2" (lines 233-259) for the full worked `useSearchParams` implementation; reproduced here only as the pointer since RESEARCH.md already supplies the canonical code:
```typescript
import { useSearchParams } from 'react-router-dom';
const VALID_TABS: Tab[] = ['calculator', 'jobs', 'materials', 'customers', 'reports', 'settings'];
const [searchParams, setSearchParams] = useSearchParams();
const rawTab = searchParams.get('tab');
const activeTab: Tab = (rawTab && VALID_TABS.includes(rawTab as Tab)) ? (rawTab as Tab) : 'calculator';
```

---

### Test files — `outputEquivalence.test.tsx`, `pricingSequence.test.tsx`, `renderCount.test.tsx`, `App.test.tsx`

**Analog:** `src/components/JobsManager.test.tsx` lines 1-120 — this is the ONLY component-mount test harness in the project. `@testing-library/react` is confirmed absent (`npm ls` empty).

**Full harness to copy verbatim (createRoot + act, no RTL)**:
```typescript
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});
```

**vi.mock pattern for Dexie hooks — reuse for any test that mounts a component reading `useDatabase.ts` hooks** (JobsManager.test.tsx lines 22-61):
```typescript
vi.mock('../hooks/useDatabase', () => ({
  useQuotes: () => ({ quotes: quotesFixture, quotesByJobId, isLoading: false, addQuote: vi.fn(), updateQuote: updateQuoteSpy, deleteQuote: vi.fn(), createQuote: vi.fn() }),
  useCustomers: () => ({ customers: [], customersByEmail: new Map(), isLoading: false, addCustomer: vi.fn(), updateCustomer: vi.fn(), deleteCustomer: vi.fn(), bumpLastUsed: vi.fn(), bulkImportCustomers: vi.fn() }),
  useSales: () => ({ sales: [], addSale: vi.fn(), updateSale: vi.fn(), deleteSale: vi.fn() }),
  useAllSales: () => [], // NOT { sales: [] } — matches the real hook's plain-array contract
}));
```
Note the comment convention: document WHY a mock returns a particular shape (mirrors the production hook contract) — carry this documentation habit into the new calculator test mocks (e.g. mocking `useCostForm`/`useCostDerivedValues` if the render-count test needs to isolate one hook from the other).

**Native DOM event dispatch (the project's `userEvent` substitute, for D-04 sequence tests)** — reproduced from RESEARCH.md's "Test Harness" section, itself sourced from this same file's idioms:
```typescript
await act(async () => {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  nativeSetter.call(input, '35');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
```

**Fixture factory pattern (for `goldenScenarios.ts`)** — `src/utils/costCalc.test.ts` lines 65-80:
```typescript
function makeRow(overrides: Partial<CalcInputFilamentRow> = {}): CalcInputFilamentRow { /* ...defaults..., ...overrides */ }

// Build a baseline CalcInput so integration tests can override only what matters.
function makeCalcInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return { /* ...defaults..., */ ...overrides };
}
```
The component-level fixture factory for D-01/D-02 should follow this exact override-pattern shape, but build a full `CostCalculatorProps`-equivalent object (broader surface: marketplace, tax, currency — see RESEARCH.md "Fixture Generation" section) rather than reusing `makeCalcInput` directly.

**Source-contract test pattern (alternative idiom already in use in `CostCalculator.test.tsx`)** — worth knowing about even though it is NOT the primary pattern for D-01/D-04/D-15 (those need real mounts):
```typescript
const COST_CALC_SRC = readFileSync(resolve(__dirname, 'CostCalculator.tsx'), 'utf8');
it('source: scrollIntoView called in effect keyed on editingJob when truthy', () => {
  expect(COST_CALC_SRC).toContain('scrollIntoView');
  expect(COST_CALC_SRC).toMatch(/useEffect\s*\(/);
});
```
This pattern exists in the current `CostCalculator.test.tsx` for the FIX-04 scroll behavior. Per CONTEXT.md's "migration/retirement plan for existing CostCalculator tests" (Claude's Discretion), the planner should decide whether these source-contract assertions get ported to check the new `calculator/CostCalculator.tsx` file path, retired in favor of a real mount-based equivalence test, or left as-is pointing at the new orchestrator file.

## Shared Patterns

### sessionStorage form persistence
**Source:** `src/components/CostCalculator.tsx` lines 40-55, 248-284
**Apply to:** `useCostForm.ts` only — this is the single owner of form persistence; no other new file should read/write `FORM_STORAGE_KEY`.

### Pure math / no-React utility boundary
**Source:** `src/utils/pricingInterlink.ts` (full file), `src/utils/costCalc.ts` (full file)
**Apply to:** `useCostDerivedValues.ts` — both files stay untouched; the hook only imports and calls their exports. This is the established "framework-free pure function, unit-tested independently" pattern the project already uses and must not be broken by inlining math back into a hook/component.

### Currency conversion at display/compute time
**Source:** `src/components/CostCalculator.tsx` lines 120-145 (`convertToProfile`, `materialsInProfile`)
**Apply to:** `useCostDerivedValues.ts` — dep arrays (`[userCurrency, fxTable]`, `[materials, convertToProfile, userCurrency]`) are correctness-sensitive per code comments; preserve exactly.

### Component-mount test harness (createRoot + act, no RTL)
**Source:** `src/components/JobsManager.test.tsx` lines 1-120
**Apply to:** All new test files in `src/components/calculator/` and the new `src/App.test.tsx`. This is a **deliberate, confirmed deviation** from the org's default React testing rule (`~/.claude/rules/ecc/react/testing.md` recommends RTL) — the project has zero `@testing-library/*` packages installed and an established alternative idiom across dozens of files. Do not introduce RTL for this phase.

### Shared UI primitives (Button/Input/Select/etc.)
**Source:** `src/components/ui/index.ts` (barrel), consumed at `src/components/CostCalculator.tsx` line 7 and `src/components/JobsManager.tsx` line 7
**Apply to:** All five new section components — import via `../ui` from the new `calculator/` subfolder. Never hand-roll a raw `<button>`/`<input>` (repo-wide `lint:no-raw-html` rule per `.claude/CLAUDE.md`).

### Roving-tabindex tab bar (A11Y, v1.9)
**Source:** `src/App.tsx` lines 180-205, 301-339 (`handleTablistKeyDown`, `role="tablist"`/`aria-selected`/`tabIndex` JSX)
**Apply to:** `src/App.tsx` itself post-modification — the JSX and keyboard handler logic must survive the `useState` → `useSearchParams` swap byte-for-byte; only the setter's implementation changes.

### `useReducer` for 3+ mutually-derived fields
**Source:** Org rule `~/.claude/rules/ecc/react/hooks.md` ("`useState` Patterns" — "Use `useReducer` once state transitions are conditional on the previous state or there are 3+ related values") + RESEARCH.md Pattern 1 (canonical target code)
**Apply to:** `useCostDerivedValues.ts` pricing interlink — no existing in-repo `useReducer` example exists yet (grep confirms), so this is a first-in-project pattern justified directly by the org rule and FOUND-02's explicit mandate, not by a codebase analog. Flagged here so the planner knows this ONE piece has no in-repo precedent — everything else in this phase does.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `useCostDerivedValues.ts`'s internal `pricingReducer` function | reducer (state machine) | event-driven | No `useReducer` exists anywhere in the current codebase (confirmed via grep across `src/`) — this is the one genuinely new pattern in the phase. Use RESEARCH.md's "Pattern 1" code block (lines 171-223) as the implementation target instead of an in-repo analog; it was authored against the exact effects it replaces. |

## Metadata

**Analog search scope:** `src/components/`, `src/hooks/`, `src/utils/`, `src/App.tsx`, `src/main.tsx` (full directory listing + targeted greps for `useReducer`, `JobsManager` decomposition history, `useSearchParams` usage)
**Files scanned:** `App.tsx`, `main.tsx`, `CostCalculator.tsx` (full, 1814 lines, two-pass targeted reads), `CostCalculator.test.tsx` (excerpt), `JobsManager.tsx` (targeted reads of imports + JobCard signature), `JobsManager.test.tsx` (harness excerpt), `pricingInterlink.ts` (full, 70 lines), `costCalc.ts` (excerpt, types), `costCalc.test.ts` (factory excerpt), `jobsAggregates.ts` (excerpt), `src/components/ui/` + `src/components/inventory/` directory listings
**Pattern extraction date:** 2026-07-03
