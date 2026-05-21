# Phase 14: Customer Details + Etsy Helper - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

A new collapsible "Customer" section and a new collapsible "Selling on Etsy?" section are added to the cost calculator screen — both rendered as separate cards positioned after the Pricing block and before the Save Job button. The Customer form persists name, email, address, and company onto the saved job (`PrintJob.customer`, schema landed in Phase 12 v6). Customer name + email surface on the JobsManager row in a new subline below the existing `filaments | print-time` line; address + company are visible only in the expanded row detail (and on the PDF in Phase 16). The Etsy section renders a 5-item self-review checklist sourced from a new `src/data/etsyToS.ts`, with per-item check state persisted per-job on a new optional `PrintJob.etsyChecks` field that piggybacks on the existing v6 schema (no Dexie version bump). A one-card-at-a-time `<CollapsibleSection>` primitive is introduced to `src/components/ui/`. UI-10 is verified as a no-op (Phase 13 left features.ts with 4 fresh entries, all with live JSX consumers — confirmed by grep on 2026-05-21).

**In scope:**
- New `<CollapsibleSection>` primitive in `src/components/ui/` (useState + Chevron header + animated body) + barrel export
- Two new collapsible cards on CostCalculator after Pricing, before Save: Customer form, then Etsy checklist
- Customer form fields (Name → Email → Company → Address) wired to `PrintJob.customer`, all optional, HTML5 `type="email"` (no inline error UI), example-value placeholders, no InfoTooltips
- JobsManager row: new subline `Name · email` with `truncate`, hidden when both fields empty; expanded detail panel gains a Customer block with full name/email/company/address
- `src/data/etsyToS.ts` exporting `etsyChecklist: { id, title, body, link? }[]` (5 items: original-design, no-third-party-templates, ip-copyright, production-partner-disclosure, ai-disclosure), `policySummaryAsOf: '2026-05-21'`, `policyLink: 'https://www.etsy.com/legal/creativity/'`
- New optional field `PrintJob.etsyChecks?: Record<string, boolean>` on the existing v6 schema — no migration, no version bump, undefined on existing records
- Etsy section: top-of-body slate-700 + yellow-tinted disclaimer notice ("Etsy's policies change — this is a reminder, not legal advice"); checklist items as labeled checkboxes; date + legal link rendered together under the checklist
- Two new `features.ts` entries (`customer-details`, `etsy-helper`) with release date matching phase ship date; `<NewBadge>` absolutely positioned on each section's collapsible header
- UI-10 verification: confirm `src/features.ts` still has exactly the 4 Phase 13 entries + the 2 added here; no stale `<NewBadge>` JSX in any new code

**Out of scope:**
- PDF rendering of customer block and quote-number assignment (Phase 16)
- Tag input, free-text search across customer fields, virtualized-list cache invalidation (Phase 15 — but Phase 15 will reuse the customer subline truncation behavior)
- Etsy API integration, marketplace-fee changes, paid-tier Etsy automation
- Phase 12 schema fields not used by Phase 14 (`taxRate`, `taxAmount`, `tags`, `nextQuoteNumber`, `defaultTaxRate`, `quoteNumber`)
- Editing the marketplace-selector copy or making the Etsy section conditional on marketplace choice (rejected — see D-15)
- Light/dark mode toggle for the new primitive (app is dark-only by design)
- Any change to Dexie schema version (v6 stays; `etsyChecks` is a non-indexed optional field)

</domain>

<decisions>
## Implementation Decisions

### Collapsible Primitive
- **D-01:** Introduce `src/components/ui/CollapsibleSection.tsx` — a custom React component with internal `useState` open/closed, a clickable header (chevron + title + optional badge slot + optional subtitle/right-slot), and a body that mounts when open. Exported via `src/components/ui/index.ts` barrel. Generic enough that Phase 16's PDF settings card can adopt it. Rejected: native `<details>/<summary>` (styling friction with our `rounded-xl + border` cards), inline `useState` per section (code duplication).
- **D-02:** Both Phase 14 sections render as **independent collapsibles** — opening one does not close the other. No accordion behavior. Each section owns its own state.
- **D-03:** Both sections are **collapsed by default** on first render and on every reload (no persistence of open/closed state). Locked by ROADMAP success criteria #1 and #3.
- **D-04:** The collapsible header **must reserve an absolute-positioned slot for `<NewBadge>`** per the project memory rule. Default pattern: `relative` host with badge `className="absolute -top-1 -right-1"`. The chevron and title remain on the natural flow; the badge overlays the corner of the header card without shifting layout.

### Placement on CostCalculator
- **D-05:** Both sections render as **two separate top-level cards** (each `bg-slate-800 rounded-xl p-6 border border-slate-700` — matches the existing Print Job Details / Pricing card chrome) positioned after Pricing and before the Save Job button. Order: **Customer first**, then **Etsy second** — customer is quote metadata that flows to the PDF; Etsy is the last compliance gut-check before save. Rejected: cramming both inside Print Job Details (mixes input-heavy form with optional metadata), single "Quote Extras" card with two collapsibles (loses visual separation between two distinct concerns).

### Customer Form
- **D-06:** Field order: **Name → Email → Company → Address**. Most-used first; the wide Address textarea anchors the bottom of the section. Locked.
- **D-07:** Layout: **Responsive 2-column grid** — row 1 `Name + Email`, row 2 `Company` (full-width within section), row 3 `Address` (full-width textarea). On `<md` screens the grid collapses to single column. Matches the flex-wrap precedent set in Phase 12's CostCalculator redesign (Model URL + Cost + Author Min row). Address always full-width regardless of breakpoint.
- **D-08:** **No `compact` prop** on Customer inputs — these are text fields, not numeric (per Phase 13 D-14 which restricts `compact` to numeric/currency/percentage/time fields). Name, Email, Company use the default-width `<Input>`; Address uses `<Textarea>`.
- **D-09:** Email validation: **HTML5 `type="email"` only**. No regex, no inline error message, save is never blocked. Phase 12 D-09 already locks "no runtime type validation" — D-09 here confirms that for the form layer. The `type="email"` attribute gives users the @-symbol mobile keyboard and the browser's free invalid-on-submit hint, costing zero code.
- **D-10:** Placeholders carry **example values only**, no InfoTooltips on Customer fields. Per Phase 13 D-15. Suggested placeholder strings (planner may copy-edit): `Name → "Jane Doe"`, `Email → "jane@example.com"`, `Company → "Acme LLC"`, `Address → "Shipping address or pickup location"`. Labels alone are clear enough that an info icon would be noise — the section being collapsed-by-default already de-prioritizes the visual surface.
- **D-11:** Address `<Textarea>` defaults to **3 rows** (resizable by the user; matches the existing `<Textarea>` primitive's `rows` prop default if it has one — planner verifies on touch). Freeform multi-line — Phase 12 D-08 already locked the data shape.

### JobsManager Row Display
- **D-12:** Collapsed row gains a **new subline directly below the existing `filaments | print-time` line** at [src/components/JobsManager.tsx:86](src/components/JobsManager.tsx:86). Format: `Jane Doe · jane@example.com` (middle dot separator). If only one of name/email is present, render just that one. If both are absent, the entire subline is **omitted** (don't reserve empty space). Right-side revenue + `copies sold` block is untouched.
- **D-13:** Subline uses `truncate` (overflow-hidden + text-ellipsis + whitespace-nowrap) so the row stays a predictable height. Phase 11's virtualized list cache (`useDynamicRowHeight`) keeps stable measurements. The full name/email/company/address are visible in the expanded panel — so truncation never hides data.
- **D-14:** Expanded row detail panel (the `isSelected` block) gains a new **Customer block** rendered alongside the existing Cost/Profit/Sell-price grid, **only when any customer field is set**. Block contents: Name, Email, Company, and full Address (with newlines preserved via `whitespace-pre-line`). This is the user's own private view — full address showing here does NOT violate CUST-02's "address visible on PDF only" intent, which is about what the *customer* sees on the deliverable. The expanded panel is the seller verifying what they saved.

### Etsy Section
- **D-15:** Etsy section is **always shown, collapsed by default, on every job** — not conditional on `marketplace === 'etsy'`. Matches ROADMAP success criterion #3 literally and avoids surprise visibility changes when the user changes their marketplace selector. The self-review value applies regardless of where a print eventually sells.
- **D-16:** Data file shape — `src/data/etsyToS.ts` exports:
  ```typescript
  export interface EtsyChecklistItem { id: string; title: string; body: string; link?: string }
  export const etsyChecklist: EtsyChecklistItem[] = [ … 5 items … ];
  export const policySummaryAsOf = '2026-05-21';
  export const policyLink = 'https://www.etsy.com/legal/creativity/';
  ```
  Five items in this order (planner finalizes wording, but `id` values are locked so check-state survives copy edits): `original-design`, `no-third-party-templates`, `ip-copyright`, `production-partner-disclosure`, `ai-disclosure`. Each `body` is 1–2 plain sentences. `link?` is optional per item (most will probably point to the same `policyLink`; some sub-policies have deeper URLs).
- **D-17:** Disclaimer placement: **top of the expanded body** in a slate-700 / yellow-tinted notice (e.g. `bg-slate-700/50 border border-yellow-500/30 text-yellow-100/90 rounded p-3 text-sm`). Exact wording: `"Etsy's policies change — this is a reminder, not legal advice."` Locked by ROADMAP success criterion #4. Date + live link render together inline below the checklist: `Verified against Etsy policy as of 2026-05-21 — etsy.com/legal/creativity/` (link uses the `policyLink` constant; date uses the `policySummaryAsOf` constant).
- **D-18:** Per-item check state persists on a **new optional `PrintJob.etsyChecks?: Record<string, boolean>` field**. Stored as `{ 'original-design': true, 'ai-disclosure': true, … }`. Existing v6 records have `etsyChecks === undefined`, which renders as "no boxes ticked" — no migration step needed and no schema string change (the field is not indexed). This piggybacks on Phase 12 D-02's "every other new field stays undefined" rule and does NOT bump the Dexie version (v6 stays). **Plan-phase MUST add a one-paragraph note in PLAN.md flagging that `etsyChecks` extends `PrintJob` beyond Phase 12 SCHEMA-01's explicit field list**, mirroring how Phase 12 D-07 flagged `quoteNumber`.

### NewBadge Audit (UI-10 verification)
- **D-19:** As of 2026-05-21, `src/features.ts` contains exactly 4 entries — all with live JSX consumers and all <14 days old:
  - `settings-reorg` (2026-05-20) → consumed at [src/App.tsx:187](src/App.tsx:187)
  - `default-profit-margin` (2026-05-18) → consumed at [src/components/SettingsModal.tsx:265](src/components/SettingsModal.tsx:265)
  - `model-url` (2026-05-20) → consumed at [src/components/CostCalculator.tsx:763](src/components/CostCalculator.tsx:763)
  - `default-tax-rate` (2026-05-21) → consumed at [src/components/SettingsModal.tsx:291](src/components/SettingsModal.tsx:291)

  ROADMAP success criterion #5 is satisfied — the audit Phase 13 completed still holds. Phase 14 verifies this at the end of execution (grep gate in UAT).
- **D-20:** Two new entries added in Phase 14: `customer-details` and `etsy-helper`, both dated to the actual phase ship date (not today's 2026-05-21 unless that's when the phase ships). Each is consumed exactly once by its respective `<CollapsibleSection>` header. The plan must instruct execution to **use the actual ship date** (current date when execute-phase runs), not the discussion date.

### Claude's Discretion
- Exact Tailwind classes for the `<CollapsibleSection>` chevron rotation transition (planner picks based on existing transition patterns; `transition-transform` + `rotate-180` is a reasonable default)
- Whether the chevron sits left (Material-style) or right (iOS-style) of the title in the header — planner picks; right-aligned chevron is slightly more common in form-style UIs
- Exact JSX/Tailwind for the Customer expanded-row block (mirror the existing Cost/Profit/Sell-price grid styling)
- Whether `<CollapsibleSection>` props use `title: string` and a `right?: ReactNode` slot, or pass `header: ReactNode` directly — planner picks based on whether other future uses need raw header control
- Test coverage: a single render-test that opens/closes the section and confirms body visibility is sufficient; no need to over-test the primitive
- Exact `etsyChecklist` body wording for each item — D-16 locks the `id` values and item count, but the body sentences are copy that can shift between planner draft and code review
- Order/layout of the Customer expanded-row block relative to the existing Cost/Profit/Sell-price grid (above, below, or side-by-side on wide screens)
- Whether the Etsy disclaimer notice uses a Heroicons exclamation-triangle icon to the left of the text, or just text — planner picks (icon would match Tailwind's typical alert pattern, but the section is text-heavy enough that an icon is optional)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 14 source-of-truth
- `.planning/REQUIREMENTS.md` § CUST-01, CUST-02, ETSY-01, ETSY-02 — requirement contracts.
- `.planning/ROADMAP.md` § Phase 14 — success criteria, especially the "collapsed by default" rule, the address-PDF-only constraint (CUST-02), the policy-summary-as-of + live link mandate (ETSY-02), and the UI-10 verification carry-over.

### Phase 12 carry-forward (schema already shipped)
- `.planning/phases/12-schema-foundation/12-CONTEXT.md` — D-02 (only `tags = []` backfilled; other new fields stay undefined on existing records), D-08 (`JobCustomer` type shape — name/email/address/company all optional, address is freeform string), D-09 (all customer fields optional, no runtime type validation in the type itself).
- `.planning/phases/12-schema-foundation/12-VERIFICATION.md` — confirms `customer?: JobCustomer` and `tags?: string[]` are landed on `PrintJob` in v6.

### Phase 13 carry-forward (UI sweep + features.ts state)
- `.planning/phases/13-tax-model-ui-sweep/13-CONTEXT.md` — D-14 (`compact` is for numeric/currency/percentage/time inputs only — Customer text fields stay default-width), D-15 (placeholders are example values only; descriptions go in `<InfoTooltip>` on the label), D-16 (text inputs also adopt InfoTooltip-on-label when they have a description today), D-17 (`src/features.ts` audit was folded into Phase 13 — Phase 14 verifies the audit holds).
- `.planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md` — confirms which surfaces have already been swept (CostCalculator, Settings, AssetLibrary, JobsManager, PrinterSettings, import modals) — the Customer + Etsy sections must follow the same conventions when first written.

### Existing code touchpoints
- [src/types.ts:140](src/types.ts:140) — `JobCustomer` interface (already landed via Phase 12; Phase 14 reads, does not modify).
- [src/types.ts:148](src/types.ts:148) — `PrintJob` interface; Phase 14 adds **one new optional field**: `etsyChecks?: Record<string, boolean>` (see D-18). No other `PrintJob` changes.
- [src/components/CostCalculator.tsx:1494](src/components/CostCalculator.tsx:1494) — Save Job Button block; new Customer card + Etsy card render immediately above this.
- [src/components/CostCalculator.tsx:1198](src/components/CostCalculator.tsx:1198) — Pricing card; new Customer card renders directly after this block.
- [src/components/JobsManager.tsx:86](src/components/JobsManager.tsx:86) — existing `filaments | print-time` subline; new Customer subline lands directly below.
- [src/components/JobsManager.tsx:107](src/components/JobsManager.tsx:107) — `isSelected` expanded panel; new Customer block lands alongside the existing 3-column grid.
- [src/components/ui/index.ts](src/components/ui/index.ts) — barrel export; new `CollapsibleSection` is added here.
- [src/components/ui/Input.tsx](src/components/ui/Input.tsx) — already supports default-width text usage; no changes needed.
- [src/components/ui/Textarea.tsx](src/components/ui/Textarea.tsx) — already exists; reused as-is for the Address field.
- [src/components/NewBadge.tsx](src/components/NewBadge.tsx) — unchanged; Phase 14 adds badges by appending to `src/features.ts` and rendering `<NewBadge feature="…">` in the new section headers.
- [src/features.ts](src/features.ts) — currently 4 entries (D-19); Phase 14 appends 2 more (`customer-details`, `etsy-helper`) per D-20.

### Codebase maps (background)
- `.planning/codebase/STRUCTURE.md` — directory layout, where new files land (data → `src/data/`, primitives → `src/components/ui/`).
- `.planning/codebase/CONVENTIONS.md` — naming, exports, Tailwind palette (`bg-slate-800`/`rounded-xl`/blue accent), `compact` rules, NewBadge usage pattern.

### Memory + global guidance
- `~/.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md` — NEW badge layout rule (badge must NEVER push siblings, must be `absolute -top-1 -right-1` on a `relative` host; never inline in flex-1 containers). Applies to D-04 and D-20.
- `.claude/CLAUDE.md` (project) — Vite port 4173, dev/build commands, Tauri version triple-update rule (not invoked by Phase 14; in-app only).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<Input />` (default width, type="email" supported via native HTMLInputElement attributes) — used as-is for Name / Email / Company.
- `<Textarea />` in `src/components/ui/` — used as-is for the freeform Address field.
- `<NewBadge feature="..." />` with the absolute-positioning pattern already established in [src/App.tsx:187](src/App.tsx:187) and [src/components/SettingsModal.tsx:265,291](src/components/SettingsModal.tsx:265).
- Card chrome pattern `bg-slate-800 rounded-xl p-6 border border-slate-700` reused for both new sections (matches Print Job Details and Pricing cards in CostCalculator).
- The expanded-row grid in JobsManager (`grid grid-cols-2 md:grid-cols-3 gap-4 mb-4`) at [src/components/JobsManager.tsx:109](src/components/JobsManager.tsx:109) is the visual reference for the new Customer block layout.

### Established Patterns
- All form-field labels: `<label className="block text-xs text-slate-400 mb-1">…</label>` (per Phase 13 sweep). Customer fields follow this exactly.
- Cost-breakdown / detail rows use flex-row label/value pairs — the Customer expanded-row block follows the same idiom.
- The two-gate `NewBadge` system handles "show for 14 days from release date, dismiss after user has seen it for 36 hours". No new badge logic — Phase 14 only adds entries to `src/features.ts` and a single `<NewBadge>` JSX per section header.
- `src/data/*.ts` are static seed files (no I/O); `etsyToS.ts` follows the same shape as `taxRates.ts` (typed export, no `db/` dependencies). Adding to this directory is the established place for static lookup data.
- Optional `PrintJob` fields are added by simply extending the interface — no migration needed when the field is not in the schema string (Phase 12 established this; `etsyChecks` follows the same rule).

### Integration Points
- New `<CollapsibleSection>` is consumed only by CostCalculator in Phase 14; tested only via its consumer's render tests + a small unit test for open/close.
- New `src/data/etsyToS.ts` is consumed only by the Etsy section component in CostCalculator.
- New `PrintJob.etsyChecks` field is read/written only inside the Etsy section block of CostCalculator and persisted as part of the existing job save path — no changes to `useDatabase.ts`, no new helpers, no new hooks.
- The Customer subline in JobsManager reads `job.customer?.name` and `job.customer?.email` only. No store changes.
- The expanded panel's new Customer block reads all four `JobCustomer` fields and renders them conditionally (block hidden if every field is empty).

</code_context>

<specifics>
## Specific Ideas

- Five Etsy checklist `id` values are LOCKED in D-16 so check state survives wording changes: `original-design`, `no-third-party-templates`, `ip-copyright`, `production-partner-disclosure`, `ai-disclosure`. The `title` and `body` text per item is for the planner to draft (mapped from ROADMAP success criterion #3's bullet list) and can be revised in code review without breaking saved state.
- Suggested Customer placeholder strings: `Name → "Jane Doe"`, `Email → "jane@example.com"`, `Company → "Acme LLC"`, `Address → "Shipping address or pickup location"`. Planner may copy-edit lightly; the substance ("example value, never description") is locked by D-10.
- Disclaimer wording is verbatim from ROADMAP: `"Etsy's policies change — this is a reminder, not legal advice."` No copy edits allowed (locked by ROADMAP success criterion #4).
- Date string `policySummaryAsOf: '2026-05-21'` is the v1.2 release date — planner must update it to the actual phase ship date (current date when execute-phase runs). Same instruction applies to the `customer-details` / `etsy-helper` release dates in `features.ts` (D-20).
- The Customer subline render expression in JobsManager is a small conditional join. Suggested shape:
  ```tsx
  {(job.customer?.name || job.customer?.email) && (
    <div className="mt-0.5 text-xs text-slate-500 truncate">
      {[job.customer?.name, job.customer?.email].filter(Boolean).join(' · ')}
    </div>
  )}
  ```
  Planner may refactor; the behavior is what's locked, not the syntax.
- The `<CollapsibleSection>` minimum props are roughly: `{ title: string; defaultOpen?: boolean; badge?: ReactNode; children: ReactNode }`. Planner may add a `right?: ReactNode` slot for future use cases (e.g. Phase 16's PDF settings card might want a "Preview" button in the header).

</specifics>

<deferred>
## Deferred Ideas

- **Etsy section conditional on marketplace selection** — explicitly rejected in D-15. If user feedback shows the Etsy section is noise for non-Etsy sellers, revisit by adding a `defaultOpen` prop wired to marketplace state.
- **Etsy API integration / live ToS sync** — paid-tier territory (PROJECT.md "Live marketplace integrations" out-of-scope). The static `etsyToS.ts` file is the v1.2 answer.
- **Persisting collapsible open/closed state across sessions** — rejected by D-03 (locked by ROADMAP). If user feedback shows users re-open the same sections on every visit, revisit with a `userProfile.expandedSections` field or `localStorage` keyed by section id.
- **Customer database / CRM tab (de-duplicate customers across jobs)** — CUST-F1 in REQUIREMENTS.md, deferred. Phase 14 ships customers as a freeform per-job snapshot; cross-job customer linkage is a future milestone.
- **Email regex validation + inline error UI** — explicitly rejected in D-09. If users complain that HTML5's free validation is too quiet, revisit with a lightweight `aria-invalid` + helper text pattern.
- **Search/filter by customer in JobsManager** — TAGS-related, Phase 15 (the free-text search there will include customer fields per ROADMAP).
- **Address structured fields (street/city/postal/country)** — rejected by Phase 12 D-08 already; reopens only alongside the deferred Customer DB milestone.
- **Type-level email validation (`Email = `${string}@${string}.${string}``)** — rejected; brittle. Runtime `type="email"` is the level of validation we ship.
- **Accordion behavior (opening one section closes the other)** — explicitly rejected in D-02. Adds magic and obscures content.
- **Etsy checklist items showing on the PDF** — explicitly forbidden by ETSY-02 / ROADMAP success criterion #4. The PDF reads the saved job data; `etsyChecks` is excluded from the PDF template by design.
- **NewBadge per checklist item or per customer field** — rejected by memory rule + simplicity; one badge per collapsible header is the limit. Badges on individual checkboxes would be visual noise.

</deferred>

---

*Phase: 14-customer-details-etsy-helper*
*Context gathered: 2026-05-21*
