# Phase 14: Customer Details + Etsy Helper - Research

**Researched:** 2026-05-21
**Domain:** React form composition + new shared primitive + existing UI conventions; no new external libraries
**Confidence:** HIGH

## Summary

Phase 14 is a pure UI/state phase on top of the v6 schema. There are no new external dependencies, no migrations, no API surfaces. The work consists of (1) building one new `<CollapsibleSection>` primitive that obeys the existing primitive conventions, (2) wiring two new collapsible cards into `CostCalculator.tsx`, (3) extending `PrintJob` with one optional field (`etsyChecks`), (4) extending `JobsManager.tsx`'s row and expanded panel, (5) adding a new static-data file `src/data/etsyToS.ts`, and (6) verifying the Phase 13 features.ts audit still holds.

The dominant integration risk is **stale CONTEXT.md line numbers**: the structure changed during Phase 13 such that `Cost Breakdown` now sits between `Set Financial Targets` and `Save Job`. CONTEXT.md says "after Pricing and before Save Job" — in code that means after the Cost Breakdown card (line :1492), not after the Set Financial Targets card (line :1326). The two new collapsible cards land between :1492 and :1494.

Secondary risks (all addressable): the `scripts/lint-no-raw-html.mjs` guard blocks raw `<input type="checkbox">` in `src/components/` (outside `ui/`) — the Etsy checkboxes must use the `// allow-raw-html` escape hatch (precedent: BambuImport, CsvImportModal). Test infrastructure only includes `*.test.ts` (not `.tsx`), so the CollapsibleSection test must follow the `react-dom/server` + `renderToStaticMarkup` pattern set by `EmptyState.test.ts` / `Skeleton.test.ts`. The `useDynamicRowHeight` cache in JobsManager is keyed only by `selectedJobId` — adding a subline and an expanded-panel customer block is safe (cache invalidates on selection change anyway, and the subline conditionally renders, so per-row height varies but is measured live).

**Primary recommendation:** Land in four small plans (P1 primitive + types, P2 data + Etsy section + persistence, P3 Customer form + JobsManager surfaces, P4 UAT + UI-10 audit). Treat the existing `BambuImport.tsx:209` checkbox + `// allow-raw-html` precedent as the template for the Etsy checkboxes; treat `EmptyState.test.ts` as the template for the CollapsibleSection unit test; treat the SettingsModal `<NewBadge feature="default-tax-rate" className="absolute top-0 left-full ml-2 pointer-events-none" />` pattern as the template for the two new badges.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render two collapsible cards | Component (`CostCalculator.tsx`) | UI primitive (`CollapsibleSection`) | Composition belongs in the consumer; the primitive owns chevron + state |
| `<CollapsibleSection>` open/closed state | UI primitive (internal `useState`) | — | D-03 locks no persistence — keep state private to the primitive |
| Customer form data flow | Component (`CostCalculator.tsx`) | Hook (`useJobs.addJob/updateJob`) | Same path as `taxRate`/`taxAmount` in Phase 13 — no new hook needed |
| `PrintJob.etsyChecks` persistence | Component (`CostCalculator.tsx`) → existing `addJob/updateJob` | Database singleton (`db.jobs.put`) | Object spread into job record; Dexie schema-string unchanged (D-18) |
| Customer subline on JobsManager row | Component (`JobsManager.tsx` JobCard) | — | Pure read of `job.customer?.name` / `job.customer?.email` |
| Customer expanded-row block | Component (`JobsManager.tsx` JobCard `isSelected` panel) | — | Pure read of all four `JobCustomer` fields |
| Etsy checklist content | Static data (`src/data/etsyToS.ts`) | Component (consumes it) | Same convention as `src/data/taxRates.ts`: typed const export, no I/O |
| NewBadge release dates | Static config (`src/features.ts`) | NewBadge primitive (consumes registry) | Existing two-gate system — append two entries with `new Date(...)` |
| Email validation | Browser (HTML5 `type="email"`) | — | D-09 locks — no JS-side regex |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component framework | Already in use — no change [VERIFIED: package.json] |
| TypeScript | 5.x (`strict: true`) | Type system | Already in use [VERIFIED: package.json] |
| Tailwind CSS | 4.1.18 | Styling | Already in use [VERIFIED: package.json] |
| Vitest | 4.1.4 | Test runner | Already in use [VERIFIED: package.json] |
| react-dom/server | 19.2.0 | `renderToStaticMarkup` for unit tests | Existing test pattern (EmptyState, Skeleton tests) [VERIFIED: src/components/ui/EmptyState.test.ts] |

### Supporting
No new packages required. Every primitive and convention this phase needs is already in `src/components/ui/` or `src/data/`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `<CollapsibleSection>` | Native `<details>/<summary>` | Native element fights the `rounded-xl + border border-slate-700` card chrome and won't accept the absolute-positioned NewBadge cleanly. D-01 already rejects. |
| Custom checkbox checkboxes | Build a `<Checkbox>` primitive in `src/components/ui/` | Existing convention is `// allow-raw-html` + inline `type="checkbox"` (4 precedents already in code). Adding a Checkbox primitive is out-of-scope per CONTEXT in-scope list. |
| `react-hook-form` for Customer form | Plain `useState` per field | 4 optional text fields with no validation (D-09) — `react-hook-form` is gross overkill. Current convention in CostCalculator is plain `useState`. |

**Installation:**
No `npm install` required. This phase ships zero new dependencies.

## Package Legitimacy Audit

Not applicable — phase installs no new packages. The `## Standard Stack` table lists only already-installed dependencies (verified against `package.json`).

## Architecture Patterns

### System Architecture Diagram

```
                     CostCalculator.tsx (the only file rendering the new sections)
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
        (Pricing card)         (Cost Breakdown card)   (Save Job button)
              :1198                  :1328                  :1494
                                       │
                                  insert here ↓
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                                             │
   <CollapsibleSection title="Customer">      <CollapsibleSection title="Selling on Etsy?">
       ┌── Name + Email (md:grid-cols-2)          ┌── disclaimer notice (top)
       ├── Company                                 ├── checkbox · title · body  (×5)
       └── Address <Textarea rows=3>               └── policySummaryAsOf · policyLink
                │                                             │
                ▼                                             ▼
        customer state                                etsyChecks state
        (4 strings, optional)                         (Record<id, boolean>)
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                          handleSaveJob (one path, both branches)
                                       │
                              addJob / updateJob (useJobs hook)
                                       │
                                  db.jobs.put(job) — Dexie v6, schema string unchanged
                                       │
                                       ▼
                              IndexedDB.jobs.{customer, etsyChecks}

                                    READ PATH
                                       │
                                  useLiveQuery → jobs[]
                                       │
                                       ▼
                              JobsManager.tsx (JobCard memo)
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
        existing subline           NEW subline           expanded panel
        "filaments | hours"        "Name · email"        + new Customer block
              :86-97               (directly below :97)    (inside :107 isSelected block,
                                                            sibling of :109 grid)
```

Data flow is one-way write (form → state → save) and one-way read (db → hook → list). No new abstraction layers.

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/
│   │   ├── CollapsibleSection.tsx     ← NEW (this phase)
│   │   └── index.ts                    ← MODIFIED (barrel export adds CollapsibleSection)
│   ├── CostCalculator.tsx              ← MODIFIED (two new cards between :1492 and :1494)
│   └── JobsManager.tsx                 ← MODIFIED (subline at :97, expanded block at :109)
├── data/
│   └── etsyToS.ts                       ← NEW (this phase)
├── types.ts                              ← MODIFIED (add etsyChecks?: Record<string, boolean>)
└── features.ts                           ← MODIFIED (append 2 entries)
```

### Pattern 1: Collapsible primitive with absolute-positioned badge slot
**What:** A clickable header (button) toggles an internal `useState` flag; the body conditionally renders. Header is `relative` so the badge slot can be `absolute -top-1 -right-1` per memory rule.
**When to use:** Sectional content that should be present but not visually competing for attention on first render. D-03 locks collapsed-by-default with no persistence.
**Example:**
```typescript
// Source: pattern derived from src/components/SettingsModal.tsx:262-266 (existing relative-host
// + absolute-positioned NewBadge convention) and CONVENTIONS.md "UI Component Patterns".
import { useState, type ReactNode, useId } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: ReactNode;       // slot for <NewBadge feature="..." />
  right?: ReactNode;       // optional right-side slot (future use, e.g. PDF preview button)
  subtitle?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title, defaultOpen = false, badge, right, subtitle, children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="relative">
        {/* The button is inside src/components/ui/, so lint-no-raw-html exempts it. */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="w-full flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded min-h-[44px]"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{title}</span>
            {subtitle && <span className="text-sm text-slate-400">{subtitle}</span>}
          </div>
          <div className="flex items-center gap-3">
            {right}
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {badge /* caller passes <NewBadge feature="..." className="absolute -top-1 -right-1" /> */}
      </div>
      {open && (
        <div id={bodyId} className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}
```

### Pattern 2: Etsy checkbox row (raw input + allow-raw-html escape)
**What:** A label-wrapped raw `<input type="checkbox">` with `// allow-raw-html` exemption, mirroring `BambuImport.tsx:209-216`.
**When to use:** Per-checklist-item check state. There is no Checkbox primitive (intentionally — see Alternatives table).
**Example:**
```typescript
// Source: src/components/BambuImport.tsx:209-216 — exact precedent for `// allow-raw-html` + accent-blue-500.
{etsyChecklist.map(item => (
  <label key={item.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-700/30 cursor-pointer">
    {/* allow-raw-html: checklist toggle; accent-blue would break under Input base styles (L-4) */}
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
```

### Pattern 3: Disclaimer notice
**What:** A slate-700/50 panel with a yellow-tinted border, used as a "policies change" disclaimer at the top of the Etsy body.
**Example:**
```tsx
<div className="bg-slate-700/50 border border-yellow-500/30 text-yellow-100/90 rounded p-3 text-sm mb-4">
  Etsy's policies change — this is a reminder, not legal advice.
</div>
```
The verbatim string is locked by ROADMAP success criterion #4 and D-17.

### Pattern 4: Customer subline in JobsManager
**What:** Conditional join of `name` and `email` with the middle-dot separator, hidden when both are absent.
**Example:**
```tsx
{(job.customer?.name || job.customer?.email) && (
  <div className="mt-0.5 text-xs text-slate-500 truncate">
    {[job.customer?.name, job.customer?.email].filter(Boolean).join(' · ')}
  </div>
)}
```

### Pattern 5: Static-data file (etsyToS.ts mirroring taxRates.ts)
**What:** Typed const export, no I/O imports, only `import type` from `'../types'` if any types are needed. Matches the convention used in `src/data/taxRates.ts:1-9`.
**Example:**
```typescript
// src/data/etsyToS.ts
export interface EtsyChecklistItem {
  id: string;
  title: string;
  body: string;
  link?: string;
}

export const policySummaryAsOf = '2026-05-21';  // updated to actual ship date by execute-phase
export const policyLink = 'https://www.etsy.com/legal/creativity/';

export const etsyChecklist: readonly EtsyChecklistItem[] = [
  { id: 'original-design',                title: '...', body: '...' },
  { id: 'no-third-party-templates',       title: '...', body: '...' },
  { id: 'ip-copyright',                   title: '...', body: '...' },
  { id: 'production-partner-disclosure',  title: '...', body: '...' },
  { id: 'ai-disclosure',                  title: '...', body: '...' },
];
```

### Anti-Patterns to Avoid
- **NewBadge inline in a flex-1 child:** The `<NewBadge>` slot on the CollapsibleSection header MUST be passed as an absolutely-positioned child, not rendered inline next to the title text. Inline placement in a flex container (especially `flex-1`) is the documented anti-pattern in MEMORY.md.
- **Building a Checkbox primitive just for the Etsy section:** Out-of-scope; 4 prior surfaces (BambuImport, CsvImportModal twice, CostCalculator licensing) use the `// allow-raw-html` escape. Follow the precedent.
- **Bumping the Dexie schema string:** `etsyChecks` is a non-indexed optional field. The Dexie schema string MUST stay `'id, name, createdAt, printerInstanceId'` — same as v6 today. Bumping it would trigger an unnecessary migration. D-18 locks this.
- **Persisting collapsible open/closed state:** D-03 rejects. No `localStorage`, no `sessionStorage`, no `userProfile` field for section state.
- **Email regex / inline validation:** D-09 rejects. HTML5 `type="email"` only.
- **Rendering the Etsy disclaimer or checklist on the customer PDF:** ETSY-02 / ROADMAP success criterion #4 explicitly forbid. Phase 14 doesn't touch the PDF, but the planner should not "helpfully" pre-wire any PDF hook for etsy data.
- **Making Etsy section conditional on `marketplace === 'etsy'`:** D-15 rejects. Always shown, always collapsed.
- **Backfilling customer fields on existing jobs:** Phase 12 D-02 already locks "only `tags = []` is backfilled; every other new field stays undefined". The new `etsyChecks` field follows the same rule — it's `undefined` on every pre-Phase-14 record and renders as "no boxes ticked".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email validation | Custom regex + inline error UI | HTML5 `type="email"` | D-09 locks; browsers handle @-keyboard, free invalid-on-submit hint, zero code |
| Collapsible logic | A new state-persistence hook | Internal `useState` in `CollapsibleSection` | D-03 locks no persistence |
| Multi-line address parsing | Street/city/postal/country parser | `<Textarea rows={3}>` storing freeform string | Phase 12 D-08 locks |
| Form validation | Library (zod, joi, yup, react-hook-form) | None — all fields optional | D-09 + Phase 12 D-09 both lock |
| Save mapping | Separate update method for customer | Object spread into existing `handleSaveJob` branches | Existing pattern (`taxRate`, `taxAmount` already spread the same way) |
| Etsy data fetch | API/network call to Etsy | Static `src/data/etsyToS.ts` | Free/local-only line — no network; `policySummaryAsOf` is the staleness signal |
| Dexie schema change | Bumping to v7 with `etsyChecks` indexed | Keep v6, add optional field on type only | D-18 locks; non-indexed optional fields don't need a migration |
| Component test framework | `@testing-library/react` | `react-dom/server` `renderToStaticMarkup` | Existing convention (EmptyState.test.ts, Skeleton.test.ts) |

**Key insight:** This is a phase where the right answer is "do nothing new at the infrastructure level." Every layer (form state, persistence, types, tests, badges, primitives) has an established pattern already in the codebase — the work is composition, not invention.

## Runtime State Inventory

Not applicable — Phase 14 is greenfield additive work (new optional fields, new files, new UI sections). No rename / refactor / migration is involved. All categories explicitly checked:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `etsyChecks` and `customer` are NEW optional fields on PrintJob; existing v6 jobs have them as `undefined`, which renders correctly | None |
| Live service config | None — no external services involved | None |
| OS-registered state | None — no OS integration | None |
| Secrets/env vars | None — no secrets | None |
| Build artifacts | None — no rename; new files only | None |

## Common Pitfalls

### Pitfall 1: Stale CONTEXT.md line numbers leading to wrong insertion site
**What goes wrong:** CONTEXT.md says "after Pricing (:1198) and before Save Job (:1494)" — but between them sits the Cost Breakdown card (:1328-:1492). Inserting "after the Pricing card" literally would put the two new sections in between Pricing and Cost Breakdown, breaking the natural reading order.
**Why it happens:** Phase 13 added the Tax row + per-job Tax input inside the Set Financial Targets card and shifted the surrounding JSX without updating CONTEXT.md's line numbers.
**How to avoid:** Insert the two new cards directly above the `{/* Save Job Button */}` comment at line :1494 — i.e. after the `</div>` that closes the Cost Breakdown card at line :1492. The literal phrasing in ROADMAP "on the cost calculator after Pricing" means "in the lower half of the form before Save", not "between Set Financial Targets and Cost Breakdown."
**Warning signs:** Reviewer sees the Customer section above Cost Breakdown; the Cost Breakdown's "Total (with Tax)" row is now visually separated from the Save button.

### Pitfall 2: Raw `<input type="checkbox">` failing the lint-no-raw-html guard
**What goes wrong:** `scripts/lint-no-raw-html.mjs` (wired into `npm run build` via package.json) greps for `<input` in `src/components/` (excluding `ui/`) and fails the build unless the previous line includes `allow-raw-html`. The 5 Etsy checkboxes will trigger this 5 times.
**Why it happens:** No `<Checkbox>` primitive exists; the project intentionally lets each consumer drop `// allow-raw-html` comments for one-off styled checkboxes.
**How to avoid:** Each checkbox gets a JSX comment `{/* allow-raw-html: ... */}` on the IMMEDIATE preceding line (the `.flatMap` over `etsyChecklist` requires placing the comment inside the map callback, immediately above the `<input>`).
**Warning signs:** `npm run build` exits with `Raw HTML form elements found` and 5 violations in `CostCalculator.tsx`.

### Pitfall 3: NewBadge inline in a flex-1 host breaks layout
**What goes wrong:** Per MEMORY.md, a `<NewBadge>` rendered as an inline child of a `flex-1` (or any equal-distribution flex container) widens its sibling and forces other items to wrap or truncate. The Phase 14 collapsible header is roughly `flex items-center justify-between` — placing the badge inline next to the title would shift the chevron right and could push other future right-slot content off-screen on narrow viewports.
**Why it happens:** Easy to write `<span>{title}</span><NewBadge .../>` without realizing the badge expands.
**How to avoid:** Pass the badge as a slot prop on `CollapsibleSection` (`badge={<NewBadge feature="..." className="absolute -top-1 -right-1" />}`); the primitive renders it inside the `relative` host but outside the `<button>`'s natural flow. Mirror the SettingsModal default-tax-rate pattern (`absolute top-0 left-full ml-2 pointer-events-none`) if the badge needs to sit to the right of the title text within the button rather than at the corner of the card.
**Warning signs:** On a narrow viewport, the chevron disappears off the right edge of the section header, or the title wraps to two lines.

### Pitfall 4: Customer subline breaking JobsManager virtualized row height
**What goes wrong:** JobsManager uses `useDynamicRowHeight({ defaultRowHeight: 88, key: selectedJobId ?? '' })` (JobsManager.tsx:464). Adding a subline that conditionally renders means rows with customers are now taller than rows without. The cache invalidates on selection change but NOT when a saved job's `customer` field flips between defined/undefined.
**Why it happens:** The `key` is just `selectedJobId`, so re-saves of an existing job that add/remove a customer keep the same `selectedJobId` and the cache will hold the old height until selection changes again.
**How to avoid:** In practice, this is benign — react-window re-measures whenever the row's children change height (the `useDynamicRowHeight` adapter uses `ResizeObserver` internally). The risk is mostly theoretical and the existing Phase 11 dynamic-row-height pattern handles dynamic content. The planner should NOT change the cache `key` — Phase 15 will handle search/filter cache invalidation per the Phase 15 plan. For Phase 14, just don't touch the cache.
**Warning signs:** After editing a saved job and adding a customer, the JobsManager row shows the new subline but is clipped at the bottom of the previous height. Resolves on the next list scroll or selection change.

### Pitfall 5: features.ts release date set to discussion date instead of ship date
**What goes wrong:** D-20 explicitly warns that the planner must instruct execute-phase to write the **current date when execute-phase runs**, not the discussion date `2026-05-21`. If the planner hard-codes `2026-05-21` into the PLAN.md task action, and execute-phase runs three days later, the NEW badge appears for `13 - 3 = 10` days instead of 14, and worse: if execute-phase runs 14+ days later, the badge never appears at all (gate 2 in NewBadge.tsx:47-49).
**Why it happens:** Planners default to copying constants from CONTEXT.md verbatim.
**How to avoid:** PLAN.md must explicitly instruct: *"Use the current date (as of execute-phase run) for both features.ts entries (`customer-details` and `etsy-helper`) AND for `policySummaryAsOf` in `etsyToS.ts`. Do not use 2026-05-21."* Pair this with a verification step that asserts the two entries' dates are within 7 days of the verification run date.
**Warning signs:** NewBadge does not appear at all on the new sections after merging, or appears for less than the full 14-day window.

### Pitfall 6: Forgetting to add customer + etsyChecks to clearForm() and the editingJob hydration effect
**What goes wrong:** CostCalculator has four state-touching sites for any new piece of form state: (1) `useState` initializer, (2) `useEffect` that persists to sessionStorage (:150-184), (3) `useEffect` that hydrates from editingJob (:187-227), (4) `clearForm()` reset (:494-519). Missing site (3) means the customer fields stay empty when the user opens a saved job for edit; missing site (4) means the customer from the previous job leaks into a new job (which is a PII bug, not just UX — see Pitfall M-06 in PITFALLS.md).
**Why it happens:** Long file, easy to miss one of the four sites.
**How to avoid:** Plan must enumerate all four sites explicitly and verify each gets the customer + etsyChecks state added. Add a UAT step: "Open job A with customer set; click 'Save as new', confirm customer fields are CLEAR (not job A's customer)." The current code path goes editingJob → clearForm in `handleSaveJob` update branch at :576.
**Warning signs:** A user reports the customer field is "stuck" from a previous job, or stays blank when editing an existing job that has a customer.

### Pitfall 7: Etsy ToS rules going stale (Pitfall m-01 from PITFALLS.md)
**What goes wrong:** Etsy updated its Creativity Standards on 2025-06-10 to remove the allowance for 3D-printed items using third-party templates. The static `etsyChecklist` items in this phase will be authored against the 2025-06-10 + later policy — any future policy shift makes the checklist actively misleading.
**Why it happens:** Policy text is hard-coded; no automated refresh; users may treat the checklist as authoritative.
**How to avoid:** D-17 already locks the disclaimer wording verbatim ("Etsy's policies change — this is a reminder, not legal advice"). D-16 locks `policySummaryAsOf` + `policyLink` placement inline below the checklist. The plan must verify these three guards land together: (a) disclaimer at top of section, (b) date constant rendered below checklist, (c) clickable link to `https://www.etsy.com/legal/creativity/`.
**Warning signs:** Reviewer notices the date in the UI is more than 3 months old at PR time; any checklist item makes a procedural rule claim (e.g. "templates are OK") that contradicts current Etsy policy.

## Code Examples

Verified patterns from this codebase:

### Adding a new optional field to PrintJob (mirror Phase 12 D-07 schema-extension note)
```typescript
// Source: src/types.ts:148-195 — existing PrintJob shape; Phase 12 D-07 precedent for quoteNumber
export interface PrintJob {
  // ... existing fields ...

  // Per-job Etsy compliance self-review (Phase 14 — D-18).
  // Schema-extension note: this field is NOT enumerated in SCHEMA-01's explicit field list.
  // Adding it here is a natural extension of the Phase 14 in-scope contract — the field is
  // optional and non-indexed, so Dexie v6's schema string is unchanged. Same pattern as
  // quoteNumber in Phase 12 (see 12-CONTEXT.md D-07).
  etsyChecks?: Record<string, boolean>;
}
```

### Wiring customer + etsyChecks state into the existing save path
```typescript
// Source: derived from src/components/CostCalculator.tsx:552-603 — existing taxRate / taxAmount pattern

// (1) useState
const [customer, setCustomer] = useState<JobCustomer>(() =>
  getStoredValue('customer', {}) ?? {}
);
const [etsyChecks, setEtsyChecks] = useState<Record<string, boolean>>(() =>
  getStoredValue('etsyChecks', {}) ?? {}
);

// (2) sessionStorage persist effect — add to the existing :150-184 useEffect dependency list

// (3) editingJob hydration — add to the existing :187-227 useEffect
setCustomer(editingJob.customer ?? {});
setEtsyChecks(editingJob.etsyChecks ?? {});

// (4) clearForm — add to :494-519
setCustomer({});
setEtsyChecks({});

// (5) handleSaveJob update branch (:552-573)
const updatedJob: PrintJob = {
  ...editingJob,
  // ... existing fields ...
  customer: hasAnyCustomerField(customer) ? customer : undefined,
  etsyChecks: Object.keys(etsyChecks).length > 0 ? etsyChecks : undefined,
};

// (5b) handleSaveJob create branch (:582-603) — same two-line addition

// Helper (define near handleSaveJob):
function hasAnyCustomerField(c: JobCustomer): boolean {
  return Boolean(c.name?.trim() || c.email?.trim() || c.address?.trim() || c.company?.trim());
}
```

### Component unit test pattern for `CollapsibleSection`
```typescript
// Source: src/components/ui/EmptyState.test.ts (test pattern); src/components/ui/Skeleton.test.ts (assertions style)
// File: src/components/ui/CollapsibleSection.test.ts
import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders the title and is collapsed by default (body absent in markup)', () => {
    const html = renderToStaticMarkup(
      React.createElement(CollapsibleSection, { title: 'Customer' },
        React.createElement('div', null, 'body content')
      )
    );
    expect(html).toContain('Customer');
    expect(html).not.toContain('body content');
    expect(html).toMatch(/aria-expanded="false"/);
  });

  it('renders the body when defaultOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(CollapsibleSection, { title: 'X', defaultOpen: true },
        React.createElement('div', null, 'visible body')
      )
    );
    expect(html).toContain('visible body');
    expect(html).toMatch(/aria-expanded="true"/);
  });

  it('renders the badge slot when provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(CollapsibleSection, {
        title: 'X',
        badge: React.createElement('span', { 'data-testid': 'b' }, 'NEW'),
      }, 'body')
    );
    expect(html).toContain('data-testid="b"');
  });
});
```
Note: `renderToStaticMarkup` does NOT execute click handlers, so the test cannot click the header to expand. That's why the suite uses `defaultOpen={true}` to assert the open-state markup. A live click-toggle test would require `@testing-library/react`, which is out-of-scope per Phase 14 dependency rule. CONTEXT.md "test coverage" guidance under Claude's Discretion says: *"a single render-test that opens/closes the section and confirms body visibility is sufficient; no need to over-test the primitive"* — the three tests above satisfy that bar via `defaultOpen` rather than via simulated interaction.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<details>/<summary>` for collapsibles | Custom `<CollapsibleSection>` primitive | Phase 14 (this phase) | Better card-chrome integration, accessible badge slot, controllable transitions |
| Email regex validation | HTML5 `type="email"` | Phase 14 (D-09) | Zero JS, free mobile keyboard, browser-native UX |
| One-off `useState` collapsible per section | Shared primitive | Phase 14 | Phase 16 PDF settings can reuse |

**Deprecated/outdated:**
- None. No deprecations introduced by Phase 14.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `// allow-raw-html` escape is the right choice for the 5 Etsy checkboxes (vs. creating a `<Checkbox>` primitive) | Architecture Patterns / Don't Hand-Roll | LOW — out-of-scope to build a primitive, but if a reviewer rejects 5x `// allow-raw-html`, the fallback is to create `src/components/ui/Checkbox.tsx` in a follow-up (~30 lines). The escape comment is the established convention in 4 prior sites. |
| A2 | `useDynamicRowHeight` will correctly re-measure JobsManager rows when the customer subline appears/disappears between renders | Common Pitfalls / Pitfall 4 | MEDIUM — the `key` arg only invalidates on `selectedJobId` change, but react-window v2's `useDynamicRowHeight` uses `ResizeObserver` under the hood per Phase 11's implementation. Verify by checking that adding a customer to an existing job and saving causes the row to grow visibly without clipping. UAT step needed. |
| A3 | The 5 Etsy checklist items (id values locked by D-16) capture genuinely stable rules vs. procedural ones (per PITFALLS.md m-01 guidance) | Architecture Patterns / Common Pitfalls Pitfall 7 | MEDIUM — `no-third-party-templates` is procedural and is the exact rule Etsy changed in June 2025. If Etsy reverses again, this item becomes misleading. The disclaimer + date + link mitigate this. Planner should treat the 5 ids as locked but bias the `body` text toward "verify at the link below" rather than asserting "you must do X". |
| A4 | The two new NewBadge consumers will be the only consumers of `customer-details` and `etsy-helper` feature keys; no other surface needs them | Architecture Patterns | LOW — these are section-header badges only; UI-10 audit catches stray consumers. |
| A5 | The CONTEXT.md insertion at "between :1492 and :1494" is the correct interpretation of "after Pricing, before Save Job" | Common Pitfalls / Pitfall 1 | LOW-MEDIUM — alternative reading would put the sections between :1326 (end of Set Financial Targets) and :1328 (start of Cost Breakdown). Planner / reviewer should confirm — but Etsy as "last compliance gut-check before save" (D-05 rationale) only makes sense directly above the Save button. |

If this table needs flagging during plan-phase: items A2 and A3 may warrant explicit acceptance-test entries in VALIDATION.md.

## Open Questions

1. **Where exactly within the JobsManager expanded panel does the Customer block render?**
   - What we know: D-14 says "alongside the existing Cost/Profit/Sell-price grid"; the existing grid is at :109 (`grid grid-cols-2 md:grid-cols-3 gap-4 mb-4`).
   - What's unclear: above, below, or as a 4th column / second-row block.
   - Recommendation: Render the Customer block BELOW the existing 3-column grid (above the Model URL block at :124) as a full-width labeled section: `<div className="mb-4"><div className="text-xs text-slate-500 mb-1">Customer</div><div className="text-sm text-slate-300 whitespace-pre-line">...</div></div>`. This keeps the existing grid responsive logic untouched and reads top-to-bottom in the order: financial first, customer second, model source third.

2. **Exact wording of the 5 Etsy checklist item titles and bodies.**
   - What we know: `id` values are locked. Title and body are Claude's discretion.
   - What's unclear: How "checklist-y" vs. "policy-recap" to write the bodies.
   - Recommendation: 1 sentence titles ("Original design", "No third-party templates", etc.), 1-2 sentence bodies each ending with "verify at the link below" or "see Etsy's policy". Bias toward neutral, link-deferring wording per Pitfall 7. Plan-phase locks the exact strings.

3. **Should the CollapsibleSection chevron sit on the right (iOS-style) or left (Material-style)?**
   - What we know: Discretion per CONTEXT.md.
   - What's unclear: User preference unstated.
   - Recommendation: Right side, matching the pattern of `justify-between` headers already used in the codebase (e.g., the various card titles). Right-aligned chevron is conventional in form-heavy UIs.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Vite, build scripts | ✓ | (existing) | — |
| npm | Package management (no new installs this phase) | ✓ | (existing) | — |
| React 19 | All component code | ✓ | 19.2.0 | — |
| Vitest | Unit tests | ✓ | 4.1.4 | — |
| jsdom | Vitest environment | ✓ | 29.0.2 | — |
| react-dom/server | Static markup tests | ✓ | 19.2.0 (bundled with react-dom) | — |
| Tailwind 4 | Styling | ✓ | 4.1.18 | — |
| Dexie | IndexedDB (read-only this phase) | ✓ | 4.2.1 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

This phase is fully executable in the current environment without any installs or upgrades.

## Validation Architecture

`workflow.nyquist_validation` is enabled (default; not explicitly disabled in `.planning/config.json`). Validation Architecture section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/ui/CollapsibleSection.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |
| Build gate | `npm run build` (= `lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build && assert-bundle-size.mjs`) |

Note: `vitest.config.ts` `include` only matches `src/**/*.test.ts` (not `.tsx`). Tests for the new primitive MUST be authored as `.test.ts` using `react-dom/server` `renderToStaticMarkup`, mirroring `EmptyState.test.ts` and `Skeleton.test.ts`. **Do not create `.test.tsx` files** — they will be silently skipped.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUST-01 | Customer section renders as a collapsible on CostCalculator with name/email/company/address inputs | Manual UAT (jsdom can't simulate full CostCalculator) | Manual UAT after `npm run dev` (port 4173) | Manual |
| CUST-01 | All four customer fields are optional and persist to `PrintJob.customer` | Manual UAT | Save a job with one field set; reopen; field present | Manual |
| CUST-01 | Section collapsed by default | Unit test (CollapsibleSection) | `npx vitest run src/components/ui/CollapsibleSection.test.ts` | ❌ Wave 0 — create test file |
| CUST-02 | Customer name + email visible on JobsManager row subline | Manual UAT | Save a job with name + email; switch to Jobs tab | Manual |
| CUST-02 | Full address visible only in expanded panel + on PDF (Phase 16) | Manual UAT | Expand a job row; address renders. PDF rendering is Phase 16 — out of scope here. | Manual |
| ETSY-01 | Etsy section renders as a collapsible with 5-item checklist sourced from `src/data/etsyToS.ts` | Unit test (data shape) + Manual UAT (render) | `grep -c "id:" src/data/etsyToS.ts` should equal 5; `npm run dev` UAT for render | ❌ Wave 0 — create data file; smoke-import in a test |
| ETSY-01 | Per-item check state persists per-job to `PrintJob.etsyChecks` | Manual UAT | Check 3 boxes, save, reopen; same 3 still checked | Manual |
| ETSY-02 | Section displays `policySummaryAsOf` date and link to `https://www.etsy.com/legal/creativity/` | Unit test (data shape) | `grep policySummaryAsOf src/data/etsyToS.ts && grep "etsy.com/legal/creativity" src/data/etsyToS.ts` | ❌ Wave 0 |
| ETSY-02 | Disclaimer text "Etsy's policies change — this is a reminder, not legal advice" present | Static grep | `grep "Etsy's policies change" src/components/CostCalculator.tsx` (or wherever the disclaimer JSX lands) | Verified at code-review time |
| ETSY-02 | Checklist content does NOT render on the customer PDF | Out-of-scope (Phase 16) — Phase 14 simply doesn't touch the PDF | n/a | n/a |
| UI-10 carry-over | `src/features.ts` contains exactly the 4 Phase 13 entries PLUS the 2 new Phase 14 entries (= 6 total) at phase wrap | Static grep | `grep -cE "new Date\(" src/features.ts` returns 6 | Verified at verify-work step |
| UI-10 carry-over | No stale `<NewBadge>` JSX in any new Phase 14 code (the 2 new badges are the only new consumers) | Cross-repo grep | `grep -rn '<NewBadge feature="customer-details"' src/ \| wc -l` returns 1; same for `etsy-helper` | Verified at verify-work step |
| (Primitive contract) | `<CollapsibleSection>` open/close behavior (defaultOpen, badge slot, aria-expanded) | Unit tests | `npx vitest run src/components/ui/CollapsibleSection.test.ts` | ❌ Wave 0 — create test file |
| (Primitive contract) | Barrel export exposes `CollapsibleSection` | Static grep | `grep "CollapsibleSection" src/components/ui/index.ts` returns 1 | Verified at code-review time |

### Sampling Rate
- **Per task commit:** `tsc -b` + `npx vitest run src/components/ui/CollapsibleSection.test.ts` (~3s)
- **Per wave merge:** `npm test` (full suite, ~5s) + `node scripts/lint-no-raw-html.mjs`
- **Phase gate:** `npm run build` (full build gate including lint, full vitest with coverage, tsc -b, vite build, bundle-size assertion) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/ui/CollapsibleSection.test.ts` — covers CUST-01 collapsed-by-default and primitive contract
- [ ] `src/data/etsyToS.ts` (the file itself doesn't need a `.test.ts`, but importing it from at least one existing test file gives a smoke-import guard against TypeScript regressions in the const shape)
- [ ] No new framework install required — Vitest already in place

## Security Domain

`security_enforcement` not explicitly set in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth — local-only app |
| V3 Session Management | no | No sessions; IndexedDB is per-origin |
| V4 Access Control | no | No multi-user model; single-user local app |
| V5 Input Validation | yes | HTML5 `type="email"` only (D-09); freeform text fields are stored as-is; address is freeform multi-line. No injection vector (no DB queries built from user input; Dexie uses object spread, not query strings; PDF renders verbatim via Phase 16). |
| V6 Cryptography | no | No crypto operations introduced |
| V7 Error Handling | n/a | No new error paths; the existing addJob/updateJob fail silently per existing pattern |
| V8 Data Protection | yes | Customer data (PII: name, email, address) lives in IndexedDB only. Per PITFALLS.md Pitfall M-06, there is no "Wipe my customer data" affordance yet — but that's out-of-scope per CUST-F1 deferral. Phase 14 does NOT introduce a transmission path (no fetch, no analytics on PII). Customer fields are NEVER sent to Vercel Analytics (already configured to track aggregate only). |
| V9 Communications | n/a | No network calls in Phase 14 |

### Known Threat Patterns for React + Dexie local-first stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via name/email/address fields rendered into JobsManager / future PDF | Tampering | React's JSX auto-escapes — no `dangerouslySetInnerHTML` is introduced. The expanded panel uses `whitespace-pre-line` on the address (D-14), which is a CSS property, not raw HTML rendering. Safe. |
| PII leak via quick-duplicate (Phase 15 concern) | Information Disclosure | Phase 14 does NOT introduce duplicate; Phase 15's DUP-02 already locks `customer: undefined` on duplicate. Phase 14 must avoid pre-wiring any duplicate path that would carry customer. |
| PII leak via JSON export (future feature) | Information Disclosure | Not applicable to Phase 14 (no export feature). |
| PII persistence after uninstall (Tauri) | Information Disclosure | Documented in PITFALLS.md Pitfall M-06 as a separate Tauri-side concern, deferred. Phase 14 does NOT have to solve this — but the planner should NOT add any "this data is private" assurance copy that would create a false promise. |
| Customer email used as IndexedDB key (would enable email enumeration if export feature later landed) | Information Disclosure | `customer` is a nested object on PrintJob; the IndexedDB primary key is `job.id` (UUID-shaped string). Email is NOT an index. Safe. |

**Security takeaway:** This phase introduces PII storage. The only contract is "data stays on device, no network transmission introduced." The planner must verify no new `fetch()` / `import()` over network / analytics call references `customer` or `etsyChecks`.

## Sources

### Primary (HIGH confidence)
- `src/types.ts` (full file) — current `JobCustomer` and `PrintJob` shapes
- `src/components/CostCalculator.tsx:1-1526` (relevant slices) — insertion site, state pattern, save path
- `src/components/JobsManager.tsx:1-200` and :455-485 — JobCard structure, useDynamicRowHeight wiring
- `src/components/ui/{Input,Textarea,InfoTooltip,EmptyState}.tsx` and `index.ts` — primitive conventions
- `src/components/NewBadge.tsx` (full file) — two-gate logic + `featureReleases` consumer
- `src/features.ts` (full file) — confirmed 4 entries: `settings-reorg` (2026-05-20), `default-profit-margin` (2026-05-18), `model-url` (2026-05-20), `default-tax-rate` (2026-05-21)
- `src/data/taxRates.ts` — typed const export shape precedent
- `src/db/database.ts` (verified via VERIFICATION.md) — Dexie v6 schema unchanged; non-indexed field additions need no migration
- `src/hooks/useDatabase.ts:424-458` — `addJob`/`updateJob` are object-spread inserts; no field mapping
- `scripts/lint-no-raw-html.mjs` (full file) — confirmed `src/components/ui/` is excluded; `// allow-raw-html` is the escape
- `vitest.config.ts` — confirmed `include: ['src/**/*.test.ts']` (not `.tsx`)
- `src/components/ui/EmptyState.test.ts` and `Skeleton.test.ts` — `renderToStaticMarkup` test pattern
- `.planning/phases/12-schema-foundation/12-CONTEXT.md` and `12-VERIFICATION.md` — schema shipped, optional-field rule, D-07 schema-extension note precedent
- `.planning/phases/13-tax-model-ui-sweep/13-CONTEXT.md` and `13-VERIFICATION.md` — compact/InfoTooltip rules, NewBadge consumer locations
- `.planning/research/PITFALLS.md` lines 200-265 — Etsy ToS stale-rules pitfall + PII handling guidance
- MEMORY.md (project memory) — NEW badge layout rule (absolute -top-1 -right-1)

### Secondary (MEDIUM confidence)
- ROADMAP.md Phase 14 success criteria — drives behavioral acceptance
- REQUIREMENTS.md CUST-01, CUST-02, ETSY-01, ETSY-02 — requirement contracts
- 14-CONTEXT.md D-01 through D-20 — locked decisions
- `.claude/CLAUDE.md` (project) — dev port, version triple-update rule (not invoked by Phase 14)

### Tertiary (LOW confidence)
- None. Every claim in this research is rooted in the codebase or in a planning document inside the repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; everything verified against `package.json` and existing imports
- Architecture: HIGH — every pattern has a concrete in-repo precedent
- Pitfalls: HIGH — line-numbered references for each, plus crosslink to PITFALLS.md for the Etsy stale-rule case
- Test architecture: HIGH — established `.test.ts` + `renderToStaticMarkup` pattern with 2 working examples in tree
- Insertion points: MEDIUM-HIGH — CONTEXT.md line numbers are stale (drifted during Phase 13), but the new correct positions are unambiguous from the JSX structure (:1494 anchor is stable)

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (30 days — stable codebase, no fast-moving external dependencies)

---

## Project Constraints (from CLAUDE.md)

From `./.claude/CLAUDE.md` (3DCoster project):
- React 18+ + TypeScript + Vite + Tailwind stack
- Dev server pinned to port 4173
- Dark-only theme; slate palette + blue accent; `rounded-xl` for regular cards
- Use `btnSize`/`inputSize`/etc, NOT `size` (TypeScript conflict)
- Tauri version triple-update rule: `UpdateBanner.tsx APP_VERSION` + `src-tauri/tauri.conf.json version` + `src-tauri/Cargo.toml version` — **NOT triggered by Phase 14** (in-app only; no shipped Tauri build needed for Phase 14 plans to merge)
- NEW badge layout rule: absolute positioning on relative host; never inline in `flex-1` (from MEMORY.md)
- Strict TypeScript: `tsc -b` (not `--noEmit`) for verification; `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- Build pipeline: `lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build && assert-bundle-size.mjs` — all must pass before merge

Phase 14 implementation must respect all of the above. The Tauri version rule does NOT apply because this phase ships no release; the desktop app will pick up Phase 14 only when a subsequent `v*` tag is published.

---

## Wave / Parallelization Sketch

`granularity: coarse` per `.planning/config.json`. Suggested 4-plan structure:

| Plan | Wave | Depends on | Scope | Why |
|------|------|------------|-------|-----|
| **14-01** Primitive + types + features.ts | Wave 1 | None | `src/components/ui/CollapsibleSection.tsx` + `.test.ts` + barrel export; `src/types.ts` `etsyChecks?` addition + schema-extension note; `src/features.ts` two new entries with `[INSTRUCTION: use today's date at execute time]` | Pure foundation; no consumer files touched yet. Can be reviewed independently. |
| **14-02** Etsy data + Etsy section | Wave 2 | 14-01 | `src/data/etsyToS.ts` (full file); Etsy CollapsibleSection in CostCalculator with disclaimer + checklist + date + link + `etsyChecks` state and persistence wiring (4 sites: useState, sessionStorage effect, editingJob hydration, clearForm, both handleSaveJob branches) | Etsy section depends on the primitive. Data file is self-contained. |
| **14-03** Customer form + JobsManager surfaces | Wave 2 | 14-01 | Customer CollapsibleSection in CostCalculator with the 4 fields + customer state and persistence wiring (4 sites); JobsManager subline at :97; JobsManager expanded-panel customer block below :109 grid | Parallel-eligible with 14-02 — different sections, different test surface. Both depend on the primitive landing first. |
| **14-04** UAT + UI-10 audit + features.ts state check | Wave 3 | 14-01, 14-02, 14-03 | `checkpoint:human-verify` UAT against the 8 acceptance scenarios (see Validation Architecture); grep gate `grep -cE "new Date\(" src/features.ts` returns 6; grep gate that no stale `<NewBadge>` JSX exists for non-registered keys | Final acceptance gate; cannot run until all UI work merges. |

**Dependency graph:**
```
14-01 ──┬──> 14-02 ──┐
        │            ├──> 14-04
        └──> 14-03 ──┘
```

Waves: `{14-01}` → `{14-02, 14-03}` (parallel) → `{14-04}`.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUST-01 | User can attach optional customer details (name, email, address, optional company name) to a saved job via a collapsible "Customer" section on the cost calculator | Architecture Patterns (CollapsibleSection + Customer form layout); D-06–D-11 in CONTEXT.md; insertion point established between :1492 and :1494; persistence path via existing `handleSaveJob` (Pitfall 6 enumerates the 4 state-touching sites) |
| CUST-02 | Customer name + email display on the saved-job row in JobsManager; full address is visible on the PDF only | Pattern 4 (subline syntax) + Open Question 1 (expanded-panel layout); JobsManager :86-97 confirmed as current subline site; address NOT rendered on the collapsed row (only name + email) keeps the "address on PDF only" contract; full address in the EXPANDED panel is the seller's private view, not the customer's deliverable (D-14 clarifies) |
| ETSY-01 | User sees an "Etsy compliance" collapsible section on the cost calculator with a checklist sourced from `src/data/etsyToS.ts` (covering original design, no third-party templates, IP/copyright, production-partner disclosure, AI disclosure) | Pattern 5 (etsyToS.ts shape) + Pattern 2 (checkbox row with allow-raw-html); 5 ids locked by D-16; persistence via new optional `PrintJob.etsyChecks` field (D-18) on existing v6 schema (no migration) |
| ETSY-02 | The Etsy section displays a `policySummaryAsOf` date and a direct link to `https://www.etsy.com/legal/creativity/`; the checklist content does NOT render on the customer PDF | Pattern 3 (disclaimer notice); date + link rendered together below the checklist per D-17; PDF non-rendering is automatic in Phase 14 (no PDF code touched); Phase 16 owns the actual PDF and will respect ETSY-02 by ignoring `etsyChecks` in its data extraction |
| UI-10 carry-over (ROADMAP success criterion #5) | Verify `src/features.ts` has exactly the 4 Phase 13 entries + 2 new Phase 14 entries; no stale NewBadge JSX introduced | features.ts state confirmed (4 entries, all <14 days old, all with live consumers — verified 2026-05-21); 14-04 plan runs the grep gate; D-19 / D-20 lock the audit |
