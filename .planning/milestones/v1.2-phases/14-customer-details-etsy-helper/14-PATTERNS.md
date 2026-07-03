# Phase 14: Customer Details + Etsy Helper - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 8 (4 new, 4 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ui/CollapsibleSection.tsx` | UI primitive | presentation (internal state) | `src/components/ui/EmptyState.tsx` (primitive shape) + `src/components/SettingsModal.tsx:262-266` (relative-host + absolute NewBadge) | exact (composite) |
| `src/components/ui/CollapsibleSection.test.ts` | unit test | n/a | `src/components/ui/EmptyState.test.ts` + `src/components/ui/Skeleton.test.ts` | exact |
| `src/data/etsyToS.ts` | static data | metadata | `src/data/taxRates.ts` | exact (role + data flow) |
| `src/data/etsyToS.test.ts` | unit test (data shape) | n/a | `src/components/ui/EmptyState.test.ts` (vitest + .test.ts) | role-match |
| `src/types.ts` (modify) | type extension | metadata | Existing `PrintJob.quoteNumber?` (Phase 12 D-07 schema-extension precedent) | exact |
| `src/components/ui/index.ts` (modify) | barrel registry | n/a | The barrel itself (append-line pattern) | exact |
| `src/components/CostCalculator.tsx` (modify) | form section + persistence | persistence + presentation | Existing `taxRateOverride` four-site wiring at `:130, :170, :201, :510, :571, :600` | exact |
| `src/components/JobsManager.tsx` (modify) | list-row update | presentation (read-only) | Existing `:86-97` subline + `:109` expanded grid + `:124-137` Model URL block | exact |
| `src/features.ts` (modify) | registry append | metadata | The existing 4 entries themselves (append-line pattern) | exact |

---

## Pattern Assignments

### `src/components/ui/CollapsibleSection.tsx` (UI primitive, presentation)

**Analog (structure):** `src/components/ui/EmptyState.tsx`
**Analog (NewBadge slot):** `src/components/SettingsModal.tsx:262-266`
**Analog (test pattern):** `src/components/ui/EmptyState.test.ts`

**Imports pattern** (lines 1-2 of EmptyState.tsx — type-only React import + sibling primitive):
```typescript
import type { ReactNode } from 'react';
import { Button } from './Button';
```
For CollapsibleSection, expand to include `useState` + `useId`:
```typescript
import { useState, useId, type ReactNode } from 'react';
```

**Props interface pattern** (from EmptyState.tsx lines 4-13):
```typescript
export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string | ReactNode;
  cta?: { label: string; onClick: () => void };
  className?: string;
}
```
Mirror this exact shape for `CollapsibleSectionProps` — `title: string`, optional `defaultOpen?: boolean`, optional `badge?: ReactNode`, optional `right?: ReactNode`, optional `subtitle?: ReactNode`, required `children: ReactNode`. Per CONTEXT.md "Claude's Discretion": planner may add `right?: ReactNode` slot for future PDF preview button (Phase 16).

**Card chrome pattern** (from CostCalculator.tsx:1199 — verbatim card classes used throughout the file):
```typescript
<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
```
The CollapsibleSection root must use these exact classes — Phase 14 D-05 locks card chrome to match Print Job Details / Pricing cards.

**Relative-host + absolute-positioned NewBadge slot pattern** (from SettingsModal.tsx:262-266):
```tsx
<h3 className="text-sm font-medium text-slate-300 mb-3 relative inline-block">
  Default Profit Margin
  <NewBadge feature="default-profit-margin" className="absolute top-0 left-full ml-2 pointer-events-none" />
</h3>
```
**KEY LANDMINE (MEMORY.md):** Badge MUST be passed as a slot prop and rendered inside a `relative` host, OUTSIDE the `<button>`'s flex flow. Inline placement in the header's `flex items-center justify-between` row would widen the title sibling and push the chevron off-screen on narrow viewports (Pitfall 3).

Recommended slot placement inside the primitive (the header wrapper is `relative`, the badge is a sibling of the `<button>`, not a child):
```tsx
<div className="relative">
  <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={bodyId}
    className="w-full flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded min-h-[44px]"
  >
    {/* title + chevron in flex flow */}
  </button>
  {badge /* caller passes <NewBadge ... className="absolute -top-1 -right-1" /> */}
</div>
```

**Chevron rotation transition pattern** (Tailwind idiom; planner discretion per CONTEXT.md):
```tsx
<svg
  className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
  fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
>
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
</svg>
```

**Gotchas:**
- File MUST live in `src/components/ui/` so `scripts/lint-no-raw-html.mjs` exempts the `<button>` and any other interactive elements (the lint guard excludes the `ui/` directory).
- Must add `min-h-[44px]` to the clickable header for mobile tap-target compliance (matches App.tsx:180 settings-button pattern).
- `aria-expanded` and `aria-controls` are tested in the unit suite — they MUST be on the `<button>`, not the outer div.
- Body uses `{open && <div id={bodyId}>{children}</div>}` (mount-on-open) — NOT `hidden` toggling. The `EmptyState.test.ts` Test 6 pattern (`html).not.toContain('<button')` when CTA omitted) is the test idiom this primitive will be tested against.

---

### `src/components/ui/CollapsibleSection.test.ts` (vitest unit test)

**Analog:** `src/components/ui/EmptyState.test.ts`
**Secondary analog:** `src/components/ui/Skeleton.test.ts`

**CRITICAL LANDMINE: file MUST be `.test.ts`, NOT `.test.tsx`.** `vitest.config.ts` `include` only matches `src/**/*.test.ts`. A `.test.tsx` file will be silently skipped — no error, no warning, just no coverage. RESEARCH.md confirms via `vitest.config.ts` read.

**Imports pattern** (lines 1-4 of EmptyState.test.ts):
```typescript
import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollapsibleSection } from './CollapsibleSection';
```

**Test idiom — render via `React.createElement` (no JSX in `.test.ts`)** (from EmptyState.test.ts lines 29-36):
```typescript
const html = renderToStaticMarkup(
  React.createElement(EmptyState, {
    icon: null,
    title: 'Test title',
    description: 'Test desc',
    cta: { label: 'Go', onClick: () => {} },
  })
);
expect(html).toContain('Test title');
expect(html).toContain('Test desc');
expect(html).toContain('<button');
```

**Assertion patterns for the three CollapsibleSection tests** (per RESEARCH.md Code Examples + CONTEXT.md "Claude's Discretion"):
1. `defaultOpen` defaults to `false`: `expect(html).not.toContain('body content')` + `expect(html).toMatch(/aria-expanded="false"/)`
2. `defaultOpen={true}` exposes body: `expect(html).toContain('visible body')` + `expect(html).toMatch(/aria-expanded="true"/)`
3. `badge` slot is rendered: `expect(html).toContain('data-testid="b"')`

**Gotchas:**
- `renderToStaticMarkup` does NOT execute click handlers. The toggle behavior must be exercised via the `defaultOpen` prop, NOT a simulated click. RESEARCH.md confirms this is acceptable per CONTEXT.md "test coverage" discretion line.
- No `@testing-library/react` install — out-of-scope. Use only `react-dom/server`.

---

### `src/data/etsyToS.ts` (static data, metadata)

**Analog:** `src/data/taxRates.ts`

**Imports pattern** (taxRates.ts:1-7 — comment header + type-only import where needed):
```typescript
// Static tax-rate table keyed off Currency for the resolveTaxRate fallback chain.
// 27 EU member states + UK + AU + CA + US. EU is consumed via the EU_AVERAGE_RATE
// branch in resolveTaxRate (D-05); per-country rows are reference data (not hit by
// the currency-keyed lookup today, kept for future country-keyed lookup).
// Source: Tax Foundation 2026 VAT Rates + EU Commission TEDB.

import type { Currency } from '../types';
```
For etsyToS.ts: no `import type` needed (no project types referenced) — just the comment header documenting source + as-of date.

**Interface + readonly const export pattern** (taxRates.ts:9-23 + 70):
```typescript
export interface TaxRateEntry {
  currency: Currency;
  region: string;
  label: string;
  rate: number;
  rateAsOf: string;
  lastVerified: string;
  note?: string;
}

// ...
export const TAX_RATES: readonly TaxRateEntry[] = [
  { currency: 'USD', region: 'US', label: 'United States', rate: 0, rateAsOf: '2025-01-01', lastVerified: V,
    note: US_MARKETPLACE_FACILITATOR_NOTE },
  // ...
];
```

**Const-as-string export pattern** (taxRates.ts:50, 56):
```typescript
export const TAX_RATES_VERIFIED_AT = '2026-05-21';
export const EU_AVERAGE_RATE = 21;
```

**Target shape for etsyToS.ts** (per D-16, with locked `id` values):
```typescript
export interface EtsyChecklistItem {
  id: string;
  title: string;
  body: string;
  link?: string;
}

// IMPORTANT: execute-phase MUST replace this with the actual ship date (current
// date at execute time), NOT 2026-05-21 (the discussion date). Pitfall 5 in
// RESEARCH.md — if execute runs 14+ days later, NewBadge never appears.
export const policySummaryAsOf = '2026-05-21';
export const policyLink = 'https://www.etsy.com/legal/creativity/';

export const etsyChecklist: readonly EtsyChecklistItem[] = [
  { id: 'original-design',                title: '...', body: '...' },
  { id: 'no-third-party-templates',       title: '...', body: '...' },
  { id: 'ip-copyright',                   title: '...', body: '...' },
  { id: 'production-partner-disclosure',  title: '...', body: '...' },
  { id: 'ai-disclosure',                  title: '...', body: '...' },
];
```

**Gotchas:**
- The 5 `id` values are LOCKED by D-16 (saved check state on existing jobs survives wording changes). Title/body text is planner discretion.
- `policySummaryAsOf` SHIP-DATE TODO: execute-phase substitutes actual current date. Do NOT hard-code `2026-05-21` (Pitfall 5).
- Bias `body` copy toward "see the link below" / "verify at Etsy's policy" rather than asserting "you MUST do X" — per RESEARCH.md A3, the `no-third-party-templates` rule is the exact one Etsy reversed in June 2025. Neutral wording survives future policy shifts.

---

### `src/data/etsyToS.test.ts` (unit test, data shape)

**Analog:** `src/components/ui/EmptyState.test.ts` (vitest + .test.ts pattern)

**Purpose:** Smoke-import guard against TypeScript regressions in the const shape + lock the 5 LOCKED `id` values so renames are caught in CI rather than after deploy (saved check state on existing jobs would silently break).

**Imports pattern**:
```typescript
import { describe, it, expect } from 'vitest';
import { etsyChecklist, policySummaryAsOf, policyLink } from './etsyToS';
```

**Suggested assertions** (per CONTEXT.md ETSY-01 + ETSY-02 verification points):
```typescript
describe('etsyToS', () => {
  it('exports exactly 5 checklist items', () => {
    expect(etsyChecklist).toHaveLength(5);
  });

  it('locks the 5 stable id values (saved etsyChecks state depends on these)', () => {
    expect(etsyChecklist.map(i => i.id)).toEqual([
      'original-design',
      'no-third-party-templates',
      'ip-copyright',
      'production-partner-disclosure',
      'ai-disclosure',
    ]);
  });

  it('exports policy link pointing at etsy.com/legal/creativity', () => {
    expect(policyLink).toMatch(/etsy\.com\/legal\/creativity/);
  });

  it('exports a policySummaryAsOf date string in YYYY-MM-DD form', () => {
    expect(policySummaryAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

**Gotchas:**
- Per RESEARCH.md Test Map, this test backs ETSY-01 (`grep -c "id:"` returns 5) and ETSY-02 (`grep policySummaryAsOf && grep "etsy.com/legal/creativity"`). A vitest expectation is stricter than a grep and survives refactors.
- File MUST be `.test.ts` (not `.test.tsx`) — same vitest include rule.

---

### `src/types.ts` (modify — append `etsyChecks` to `PrintJob`)

**Analog:** Existing Phase 12 schema-extension precedent (`quoteNumber` at types.ts:193-194)

**Pattern to copy** (types.ts:193-194):
```typescript
// Quote numbering (Phase 16) — assigned on first PDF gen, then reused (D-05)
quoteNumber?: number;
```
This is the established pattern for adding a non-indexed optional field to `PrintJob` without bumping Dexie schema. The comment cites the phase + decision.

**Insertion target** — append inside `PrintJob` interface, anywhere after the existing optional fields (suggested: directly after `quoteNumber?: number;` at line 194, before the closing brace at 195):
```typescript
// Per-job Etsy compliance self-review (Phase 14 — D-18).
// Schema-extension note: this field is NOT enumerated in SCHEMA-01's explicit field list.
// Adding it here mirrors how Phase 12 D-07 flagged quoteNumber — the field is optional
// and non-indexed, so the Dexie v6 schema string `'id, name, createdAt, printerInstanceId'`
// is unchanged and no migration is needed. Existing v6 records have etsyChecks === undefined
// which renders as "no boxes ticked".
etsyChecks?: Record<string, boolean>;
```

**Gotchas:**
- Schema-extension note is REQUIRED per CONTEXT.md D-18: *"Plan-phase MUST add a one-paragraph note in PLAN.md flagging that `etsyChecks` extends `PrintJob` beyond Phase 12 SCHEMA-01's explicit field list, mirroring how Phase 12 D-07 flagged `quoteNumber`."*
- Do NOT touch `JobCustomer` (already landed at types.ts:140-145 in Phase 12). Phase 14 only ADDS one field.
- Do NOT bump the Dexie schema string in `src/db/database.ts` (Anti-Pattern in RESEARCH.md). `etsyChecks` is non-indexed and stays out of the schema string.

---

### `src/components/ui/index.ts` (modify — append CollapsibleSection)

**Analog:** The barrel itself (lines 1-8 — established append-line pattern)

**Current state** (verbatim):
```typescript
export { Button, ButtonLink, getButtonClasses } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { Card } from './Card';
export { EmptyState, shouldShowEmptyState } from './EmptyState';
export { Skeleton } from './Skeleton';
export { InfoTooltip } from './InfoTooltip';
```

**Append** (one new line; planner picks ordering — alphabetical would slot it between `Card` and `EmptyState`, but the established convention is "append on top of existing list" since `InfoTooltip` is also out of alphabetical order):
```typescript
export { CollapsibleSection } from './CollapsibleSection';
```

**Gotchas:**
- Only the named export is needed. Do NOT export `CollapsibleSectionProps` unless a consumer outside `src/components/` is identified — Phase 14 has only one consumer (CostCalculator).
- This barrel is the ONLY export surface for `ui/` primitives — CostCalculator imports via `from './ui'`.

---

### `src/components/CostCalculator.tsx` (modify — 4 state sites + 2 save branches + 2 new cards)

**Analog (state pattern):** Existing `taxRateOverride` wiring spans 6 sites in this file — the most recent (Phase 13) precedent for a per-job optional field. Each of the 4 state-touching sites + 2 save branches is enumerated below.

**KEY LANDMINE — INSERTION POINT (Pitfall 1):** CONTEXT.md line numbers are STALE. The two new collapsible cards land **between `:1492` (end of Cost Breakdown card) and `:1494` (`{/* Save Job Button */}`)**, NOT after Pricing. The literal reading of "after Pricing" would place them between :1196 and :1198 — wrong. The correct insertion site is directly above the Save Job Button comment.

#### Site 1: `useState` initializer (insertion near :141, after `setMarketplace`)

**Pattern to copy** (existing taxRateOverride at :130-132):
```typescript
const [taxRateOverride, setTaxRateOverride] = useState<number | undefined>(
  () => editingJob?.taxRate ?? getStoredValue<number | undefined>('taxRateOverride', undefined)
);
```

Add two new state hooks (mirror the same `getStoredValue + editingJob.field` shape):
```typescript
// Customer details (Phase 14 — CUST-01).
const [customer, setCustomer] = useState<JobCustomer>(
  () => editingJob?.customer ?? getStoredValue('customer', {} as JobCustomer)
);

// Etsy self-review check state (Phase 14 — ETSY-01).
const [etsyChecks, setEtsyChecks] = useState<Record<string, boolean>>(
  () => editingJob?.etsyChecks ?? getStoredValue('etsyChecks', {} as Record<string, boolean>)
);
```

**Gotcha:** `JobCustomer` must be in the existing type import list at top of file. Verify by reading the import block before editing — add `JobCustomer` to the existing `from '../types'` import.

#### Site 2: sessionStorage persist effect (`useEffect` at :150-184)

**Pattern to copy** (existing — the `formState` object literal at :154-177 lists every persisted field; the dep array at :180-183 must match):
```typescript
const formState = {
  printName,
  filamentRows,
  // ... 20 existing fields ...
  marketplace,
};
sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
```

Add `customer, etsyChecks` to BOTH:
1. The `formState` object literal (after `marketplace,` at :177)
2. The dep array (after `marketplace` at :183)

**Gotcha:** Missing either site means the user's typed values vanish on page reload (sessionStorage misses) or, worse, become stale (dep array missing but formState updated → stale snapshot persists).

#### Site 3: editingJob hydration effect (`useEffect` at :187-227)

**Pattern to copy** (existing — `setTaxRateOverride(editingJob.taxRate)` at :201, and the multi-line filament hydration at :214-224):
```typescript
setTaxRateOverride(editingJob.taxRate);
```

Add two new hydration lines (after the existing setters in the :187-211 block):
```typescript
setCustomer(editingJob.customer ?? {});
setEtsyChecks(editingJob.etsyChecks ?? {});
```

**Gotcha (Pitfall 6 — PII bug):** Missing this site means when the user clicks "Edit" on a saved job that HAS a customer, the customer fields stay empty. The user then re-saves and silently OVERWRITES the customer with `undefined` (because `hasAnyCustomerField` returns false on empty state).

#### Site 4: `clearForm()` reset (at :494-519)

**Pattern to copy** (existing — every state has a corresponding `setX(initialValue)` line):
```typescript
setMarketplace('none');
// Clear sessionStorage when form is cleared
sessionStorage.removeItem(FORM_STORAGE_KEY);
```

Add two new reset lines (anywhere before the `sessionStorage.removeItem` line, suggested: directly after `setMarketplace('none')` at :516):
```typescript
setCustomer({});
setEtsyChecks({});
```

**Gotcha (Pitfall 6 — PII LEAK):** Missing this site means a saved Job A's customer leaks into a new Job B when the user clicks "Save as new" or clears the form. This is a PII bug, NOT just a UX issue. UAT step required: "Open job A with customer set; click 'Cancel Edit' or save & clear; verify customer fields are EMPTY (not job A's customer)."

#### Site 5: handleSaveJob UPDATE branch (at :552-573)

**Pattern to copy** (existing — every persisted field is spread into the updated `PrintJob` literal):
```typescript
const updatedJob: PrintJob = {
  ...editingJob,
  name: printName.trim(),
  // ... existing fields ...
  taxRate: taxRateOverride,
  taxAmount: tax.taxAmount,
};
```

Add two new fields BEFORE the closing brace at :573 (with the `hasAnyCustomerField` helper guard — undefined when all fields blank so the field doesn't appear in storage at all):
```typescript
customer: hasAnyCustomerField(customer) ? customer : undefined,
etsyChecks: Object.keys(etsyChecks).length > 0 ? etsyChecks : undefined,
```

#### Site 6: handleSaveJob CREATE branch (at :582-603)

**Pattern to copy** (same shape as Site 5 — the create branch literal at :582-603):
```typescript
const job: PrintJob = {
  id: `job-${Date.now()}`,
  // ... existing fields ...
  copiesSold: 0,
};
```

Add same two lines before `copiesSold: 0,` at :602:
```typescript
customer: hasAnyCustomerField(customer) ? customer : undefined,
etsyChecks: Object.keys(etsyChecks).length > 0 ? etsyChecks : undefined,
```

#### Helper function (define once near handleSaveJob, around :528):
```typescript
function hasAnyCustomerField(c: JobCustomer): boolean {
  return Boolean(c.name?.trim() || c.email?.trim() || c.address?.trim() || c.company?.trim());
}
```

#### Site 7: JSX insertion — two new collapsible cards (between :1492 and :1494)

**Pattern to copy** (Card chrome from CostCalculator.tsx:1199 + Model URL row pattern from :758-771):
```tsx
<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
  <h2 className="text-lg font-semibold text-white mb-4">Set Financial Targets</h2>
  {/* ... */}
</div>
```

**Customer section JSX** (after :1492, before :1494):
```tsx
<CollapsibleSection
  title="Customer"
  badge={<NewBadge feature="customer-details" className="absolute -top-1 -right-1" />}
>
  {/* Responsive 2-column grid per D-07: row 1 Name + Email, row 2 Company, row 3 Address full-width */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-xs text-slate-400 mb-1">Name</label>
      <Input
        type="text"
        value={customer.name ?? ''}
        onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
        placeholder="Jane Doe"
      />
    </div>
    <div>
      <label className="block text-xs text-slate-400 mb-1">Email</label>
      <Input
        type="email"
        value={customer.email ?? ''}
        onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))}
        placeholder="jane@example.com"
      />
    </div>
  </div>
  <div className="mt-4">
    <label className="block text-xs text-slate-400 mb-1">Company</label>
    <Input
      type="text"
      value={customer.company ?? ''}
      onChange={e => setCustomer(c => ({ ...c, company: e.target.value }))}
      placeholder="Acme LLC"
    />
  </div>
  <div className="mt-4">
    <label className="block text-xs text-slate-400 mb-1">Address</label>
    <Textarea
      rows={3}
      value={customer.address ?? ''}
      onChange={e => setCustomer(c => ({ ...c, address: e.target.value }))}
      placeholder="Shipping address or pickup location"
    />
  </div>
</CollapsibleSection>
```

**Etsy section JSX** (directly after the Customer section, still before :1494):
```tsx
<CollapsibleSection
  title="Selling on Etsy?"
  badge={<NewBadge feature="etsy-helper" className="absolute -top-1 -right-1" />}
>
  {/* Disclaimer at top — verbatim string locked by D-17 / ROADMAP #4 */}
  <div className="bg-slate-700/50 border border-yellow-500/30 text-yellow-100/90 rounded p-3 text-sm mb-4">
    Etsy's policies change — this is a reminder, not legal advice.
  </div>

  {/* 5-item checklist — see BambuImport.tsx:209-214 for the allow-raw-html precedent */}
  <div className="space-y-1">
    {etsyChecklist.map(item => (
      <label key={item.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-700/30 cursor-pointer">
        {/* allow-raw-html: per-item checklist toggle; no Checkbox primitive exists (RESEARCH.md Alternatives) */}
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer"
          checked={!!etsyChecks?.[item.id]}
          onChange={e => setEtsyChecks(prev => ({ ...prev, [item.id]: e.target.checked }))}
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{item.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">{item.body}</div>
        </div>
      </label>
    ))}
  </div>

  {/* Date + link inline beneath checklist — D-17 */}
  <div className="mt-4 text-xs text-slate-500">
    Verified against Etsy policy as of {policySummaryAsOf} —{' '}
    <a
      href={policyLink}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline"
    >
      etsy.com/legal/creativity/
    </a>
  </div>
</CollapsibleSection>
```

**Gotchas:**
- **`// allow-raw-html` placement (Pitfall 2):** The JSX comment `{/* allow-raw-html: ... */}` MUST be on the IMMEDIATELY preceding line of each `<input type="checkbox">`. Inside a `.map()` callback the comment goes inside the callback body, directly above the JSX. Build (`npm run build`) runs `scripts/lint-no-raw-html.mjs` which greps for `<input` in `src/components/` (excluding `ui/`) and fails unless the previous line has `allow-raw-html`. 5 checkboxes → 5 inline comments.
- **NewBadge badge slot (Pitfall 3 + MEMORY.md):** Pass the `<NewBadge>` as the `badge` PROP, NOT as inline children. The CollapsibleSection primitive renders it in a `relative` host outside the `<button>`'s flex flow. Use `className="absolute -top-1 -right-1"`.
- **Imports to add at top of file:** `CollapsibleSection` (from `./ui`), `JobCustomer` (from `../types`), `etsyChecklist`, `policySummaryAsOf`, `policyLink` (from `../data/etsyToS`), `NewBadge` (likely already imported — verify).
- **No InfoTooltip on Customer fields (D-10).** Phase 13 D-15 locks placeholders as example-only values; descriptions go in InfoTooltip — but Customer labels are self-explanatory, so no tooltips at all.
- **No `compact` prop on Customer inputs (D-08).** Per Phase 13 D-14, `compact` is for numeric/currency/percentage/time fields only. Name/Email/Company are default-width `<Input>`; Address is `<Textarea>`.

---

### `src/components/JobsManager.tsx` (modify — subline + expanded block)

**Analog (subline):** Existing `filaments | print-time` subline at JobsManager.tsx:86-97
**Analog (expanded block):** Existing 3-column grid at :109-122 + Model URL block at :124-137

#### Site 1: Subline insertion (directly below the closing `</div>` of :97)

**Pattern to copy** (the existing filaments subline at :86-97):
```tsx
<div className="mt-1 text-sm text-slate-400">
  {job.filaments && job.filaments.length > 0 ? (
    job.filaments.map((f, i) => (
      <span key={i}>
        {i > 0 && ' + '}
        {getFilamentName(f.filamentId ?? '')}{f.grams ? ` ${f.grams}g` : ''}
      </span>
    ))
  ) : (
    <span className="text-slate-500 italic">No filament data</span>
  )} | {job.printTimeHours}h
</div>
```

**New Customer subline** (per RESEARCH.md Pattern 4 + CONTEXT.md "Specifics"):
```tsx
{(job.customer?.name || job.customer?.email) && (
  <div className="mt-0.5 text-xs text-slate-500 truncate">
    {[job.customer?.name, job.customer?.email].filter(Boolean).join(' · ')}
  </div>
)}
```
Insertion: directly after line :97's `</div>` and before the closing `</div>` of the JobCard left-column container at :98.

**Gotchas:**
- `truncate` (Tailwind shorthand for `overflow-hidden text-ellipsis whitespace-nowrap`) is REQUIRED — keeps row height predictable so Phase 11's `useDynamicRowHeight` cache stays stable (D-13).
- When both fields are absent, the entire `<div>` is omitted (D-12 — "don't reserve empty space"). The truthy guard at the top handles this.
- Middle-dot separator is `·` (U+00B7), NOT `*` or `|`. Copy verbatim from CONTEXT.md "Specifics".
- Reads from `job.customer?` (already on `PrintJob` since Phase 12). Do NOT introduce a new prop or hook.

#### Site 2: Expanded-row Customer block (inside the `isSelected` panel at :107)

**Pattern to copy** (the Model URL block at :124-137 — full-width labeled section under the 3-column grid):
```tsx
{job.modelUrl && (
  <div className="mb-4 text-sm">
    <span className="text-slate-500">Model source: </span>
    <a
      href={job.modelUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-blue-400 hover:text-blue-300 underline break-all"
    >
      {job.modelUrl}
    </a>
  </div>
)}
```

**New Customer block** (rendered BELOW the existing 3-column grid at :122, ABOVE the Model URL block at :124 — per RESEARCH.md Open Question 1 recommendation, financial first → customer second → model source third):
```tsx
{(job.customer?.name || job.customer?.email || job.customer?.company || job.customer?.address) && (
  <div className="mb-4">
    <div className="text-xs text-slate-500 mb-1">Customer</div>
    <div className="space-y-0.5 text-sm text-slate-300">
      {job.customer?.name && <div>{job.customer.name}</div>}
      {job.customer?.email && <div className="text-slate-400">{job.customer.email}</div>}
      {job.customer?.company && <div className="text-slate-400">{job.customer.company}</div>}
      {job.customer?.address && (
        <div className="text-slate-400 whitespace-pre-line">{job.customer.address}</div>
      )}
    </div>
  </div>
)}
```

**Gotchas:**
- `whitespace-pre-line` on the address is a CSS class (NOT raw HTML rendering — safe per RESEARCH.md Security Domain). Preserves multi-line address newlines without `dangerouslySetInnerHTML`.
- D-14 / CUST-02: full address in the EXPANDED panel does NOT violate "address visible on PDF only" — that constraint is about what the *customer* sees on the deliverable. The expanded panel is the seller verifying their own saved data.
- Block hidden entirely when ALL four fields empty (the outer `&&` guard).
- Don't change the cache `key` (Pitfall 4) — `useDynamicRowHeight` uses `ResizeObserver` internally and will re-measure when the row grows.

---

### `src/features.ts` (modify — append 2 entries)

**Analog:** The 4 existing entries themselves (lines 6-9)

**Current state** (verbatim):
```typescript
export const featureReleases: Record<string, Date> = {
  'settings-reorg': new Date('2026-05-20'),
  'default-profit-margin': new Date('2026-05-18'),
  'model-url': new Date('2026-05-20'),
  'default-tax-rate': new Date('2026-05-21'),
  // Add new features here with their release date
};
```

**Append** (insert above the trailing comment, after the `default-tax-rate` line):
```typescript
'customer-details': new Date('YYYY-MM-DD'), // execute-phase: replace with actual ship date
'etsy-helper': new Date('YYYY-MM-DD'),      // execute-phase: replace with actual ship date
```

**Gotchas (Pitfall 5 — CRITICAL):**
- D-20 + RESEARCH.md Pitfall 5: execute-phase MUST replace the placeholder with the **current date at execute time**, NOT the discussion date `2026-05-21`. If execute runs 14+ days after discussion, NewBadge never appears at all (Gate 2 in `NewBadge.tsx:48-49`).
- VERIFICATION step required: `grep -cE "new Date\(" src/features.ts` returns exactly **6** (= 4 Phase 13 + 2 Phase 14) after Phase 14 ships.
- Each badge has exactly ONE JSX consumer:
  - `customer-details` → CostCalculator's `<CollapsibleSection title="Customer">` header slot
  - `etsy-helper` → CostCalculator's `<CollapsibleSection title="Selling on Etsy?">` header slot
- VERIFICATION: `grep -rn '<NewBadge feature="customer-details"' src/ | wc -l` returns 1; same for `etsy-helper`.

---

## Shared Patterns

### Card chrome (applies to: CollapsibleSection root)
**Source:** `src/components/CostCalculator.tsx:1199` (verbatim — used 6+ times in this file)
```typescript
<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
```
Phase 14 D-05 locks this as the only card chrome — matches Print Job Details, Pricing, and Cost Breakdown cards.

### NewBadge absolute-positioning (applies to: both new section headers)
**Source:** `src/App.tsx:187` (corner overlay) + `src/components/SettingsModal.tsx:265, 291` (inline-right slot)
```tsx
{/* Corner overlay (preferred for collapsible card headers) */}
<NewBadge feature="customer-details" className="absolute -top-1 -right-1" />

{/* Inline-right slot (alternative — used in SettingsModal under h3 headings) */}
<NewBadge feature="default-profit-margin" className="absolute top-0 left-full ml-2 pointer-events-none" />
```
**MEMORY.md rule:** Host must be `relative`; badge is `absolute -top-1 -right-1` (or equivalent). NEVER inline as a flex child — would push siblings.

### Label idiom (applies to: every form field in the Customer section)
**Source:** Phase 13 sweep convention — used throughout CostCalculator.tsx
```tsx
<label className="block text-xs text-slate-400 mb-1">Name</label>
```
No InfoTooltip on Customer fields (D-10). No `compact` prop (D-08).

### Raw-checkbox escape (applies to: 5 Etsy checkbox inputs)
**Source:** `src/components/BambuImport.tsx:209-214`
```tsx
{/* allow-raw-html: ... brief reason ... */}
<input
  type="checkbox"
  className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer"
  checked={...}
  onChange={...}
/>
```
The `// allow-raw-html` comment MUST be on the immediately preceding line. Inside a `.map()` callback, the comment goes inside the callback body. `scripts/lint-no-raw-html.mjs` fails the build otherwise. 4 prior precedents in the codebase (BambuImport, CsvImportModal x2, CostCalculator licensing) — this is the established pattern, NOT a workaround.

### sessionStorage-backed useState (applies to: customer + etsyChecks state)
**Source:** `src/components/CostCalculator.tsx:104-138` — every form-state hook follows this shape
```typescript
const [field, setField] = useState(() => getStoredValue('field', defaultValue));
```
And for edit-aware fields (taxRateOverride at :130-132 — exact precedent for Phase 14 Customer):
```typescript
const [field, setField] = useState<Type>(
  () => editingJob?.field ?? getStoredValue<Type>('field', defaultValue)
);
```

### Schema-extension note (applies to: types.ts modification)
**Source:** Phase 12 D-07 precedent + existing `quoteNumber?` comment at types.ts:193
```typescript
// Quote numbering (Phase 16) — assigned on first PDF gen, then reused (D-05)
quoteNumber?: number;
```
Phase 14's `etsyChecks` comment MUST cite the schema-extension note pattern (D-18 mandates it).

### Test pattern (applies to: both new .test.ts files)
**Source:** `src/components/ui/EmptyState.test.ts` + `Skeleton.test.ts`
- File extension: `.test.ts` ONLY (vitest skips `.test.tsx`)
- JSX via `React.createElement` (no `.tsx` JSX in test files)
- Render via `renderToStaticMarkup` from `react-dom/server`
- Assertions via `expect(html).toContain(...)` / `.not.toContain(...)` / `.toMatch(/regex/)`
- No click simulation (use `defaultOpen` prop instead)

---

## Load-Bearing Landmines (cross-cutting)

These are pulled out of RESEARCH.md "Common Pitfalls" because they straddle multiple files and the planner must surface them in PLAN.md so execute-phase doesn't trip:

1. **`.test.ts` not `.test.tsx`** — `vitest.config.ts` include only matches `.test.ts`. `.test.tsx` is silently skipped, zero error. Affects `CollapsibleSection.test.ts` and `etsyToS.test.ts`.
2. **Insertion site is between :1492 and :1494** — CONTEXT.md line numbers drifted in Phase 13. The literal reading of "after Pricing" is wrong; the correct anchor is `{/* Save Job Button */}` at :1494. Two new cards land directly above it.
3. **`// allow-raw-html` per checkbox** — `npm run build` runs lint-no-raw-html.mjs which fails on every raw `<input>` in `src/components/` (outside `ui/`) without the escape comment on the line above. 5 Etsy checkboxes = 5 inline comments inside the `.map()` callback.
4. **NewBadge absolute-positioning, NOT inline** — MEMORY.md rule. Inline placement in a flex container pushes siblings. Pass as `badge={...}` slot prop on CollapsibleSection; primitive renders inside a `relative` host outside the `<button>`'s flex flow.
5. **features.ts dates MUST be replaced at execute-time** — D-20 + Pitfall 5. Planner uses `YYYY-MM-DD` placeholder; execute-phase substitutes the actual current date. Same applies to `policySummaryAsOf` in `etsyToS.ts`. Otherwise NewBadge may never appear.
6. **All 6 CostCalculator sites must be touched (4 state + 2 save branches)** — Pitfall 6. Missing Site 3 (editingJob hydration) breaks edit. Missing Site 4 (clearForm) causes a PII leak between jobs.
7. **Etsy 5 ids are LOCKED** — D-16. Saved `etsyChecks` state on existing jobs depends on these strings. Title/body copy is editable; ids are not.
8. **Schema-extension note required in PLAN.md** — D-18 mandates a paragraph flagging that `etsyChecks` extends `PrintJob` beyond SCHEMA-01's explicit field list, mirroring how Phase 12 D-07 flagged `quoteNumber`.

---

## No Analog Found

None. Every file in Phase 14 has a close analog in the codebase.

---

## Metadata

**Analog search scope:** `src/components/ui/`, `src/components/`, `src/data/`, `src/types.ts`, `src/features.ts`, `src/App.tsx`
**Files scanned:** 12 (EmptyState.tsx, EmptyState.test.ts, Skeleton.test.ts, taxRates.ts, ui/index.ts, features.ts, types.ts, JobsManager.tsx, SettingsModal.tsx, NewBadge.tsx, CostCalculator.tsx, BambuImport.tsx, App.tsx)
**Pattern extraction date:** 2026-05-21
