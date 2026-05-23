# Phase 16: Printable PDF Quote - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A "Generate PDF" action on saved jobs produces a downloadable, professional-looking quote PDF — generated entirely client-side, using `jspdf` + `jspdf-autotable` loaded ONLY via dynamic `import()`. The PDF renders the 3DCoster wordmark header, an auto-incremented quote number (`Q-NNNN` format, lifetime counter persisted in `UserProfile.nextQuoteNumber`), a 30-day valid-until date, an optional customer block, a single collapsed line item (no cost breakdown exposed), Subtotal/Tax/Total totals (region-aware Tax label, Tax row hidden when rate=0%), an optional Notes/Terms section (layered from `PrintJob.notes` + new `UserProfile.defaultTerms`), and a fixed "Made with 3DCoster — 3dcoster.vercel.app" footer. The PDF works in web (browser save dialog) AND Tauri desktop (Tauri file dialog), with Unicode-safe font rendering for `€`, accented letters, and similar non-ASCII glyphs.

**In scope:**
- New `Generate PDF` button in `src/components/CostCalculator.tsx` (next to `Save job` at form bottom, disabled when `sellingPrice <= 0`) and `src/components/JobsManager.tsx` (inside the expanded saved-job accordion, next to Edit / Delete).
- New lazy-loaded PDF generation module at `src/pdf/generateQuotePdf.ts` (or equivalent path the planner chooses). MUST be reached only via dynamic `import()` from the button click — never via static `import 'jspdf'` anywhere in `src/`. Researcher confirms exact module shape during research phase.
- New `UserProfile.defaultTerms?: string` field — multi-line textarea added to the existing `UserProfileModal` (placed next to address/labor — business-defaults grouping). Optional, persists via existing `setUserProfile`. No Dexie schema change (UserProfile is a JSON blob).
- Quote-number lifecycle: on first PDF gen for a saved job, assign `PrintJob.quoteNumber = UserProfile.nextQuoteNumber ?? 1`, then increment `nextQuoteNumber`. Subsequent PDF gens for the SAME job re-use the persisted `PrintJob.quoteNumber` (counter does NOT increment). Both fields already exist in `src/types.ts` (lines 226 + 295) — no schema change needed.
- New `taxLabelFor(countryCode?: string)` helper in `src/utils/taxResolution.ts` (where the rest of the tax stack lives). Returns `'VAT' | 'GST' | 'IVA' | 'Sales Tax' | 'Tax'` based on `UserProfile.address.country` ISO code. Default fallback: `'Tax'`.
- `vite.config.ts` change: add `build: { modulePreload: false }` to prevent the PDF chunk from being preloaded into `index.html`.
- New CI assertion script `scripts/assert-no-pdf-preload.mjs` — greps `dist/index.html` for any `modulepreload` referencing the pdf chunk, exits non-zero if found. Runs as part of `npm run build`.
- Phase 11's existing `scripts/assert-bundle-size.mjs` continues to enforce the 300 KB gz main-chunk gate. PDF chunk grows to ~80–250 KB gz (lazy, off main bundle).
- Bundled fonts: Noto Sans regular + bold (Latin + Latin-Ext subset only, ~80 KB gz total). Embedded as base64 INSIDE the lazy PDF chunk and loaded into jspdf via `addFileToVFS` + `addFont` once on first PDF gen per session.
- `src/features.ts` entry `pdf-quote` (or similar key — planner picks) dated to the actual ship date. `<NewBadge feature="pdf-quote">` placed as absolute overlay on the new "Generate PDF" buttons (cost calc + JobsManager accordion) per project memory rule — single feature entry point per surface.
- Tauri save dialog wired for desktop builds via the existing `__IS_TAURI__` guard pattern (see `src/App.tsx` / Header for the established detection idiom). Web path uses jspdf's built-in `doc.save(filename)` (triggers browser save dialog).

**Out of scope:**
- White-label / paid-tier PDF (logo upload, custom colors, footer override) — locked in PROJECT.md Key Decisions: "white-label deferred to paid tier (v2.0+)". v1.2 ships free-tier only.
- Cost-breakdown line items (material/labor/depreciation as separate rows) — D-04 locks collapsed single-row line items; itemized breakdown exposes the seller's cost structure to the buyer.
- PDF preview modal before download — clicking "Generate PDF" downloads immediately. Preview UX is a future enhancement, not in v1.2 scope.
- Yearly quote-number reset / per-customer numbering — D-05 locks lifetime counter (simplest, matches the existing `nextQuoteNumber ?? 1` seed in types.ts).
- Quote-template / preset system — D-08 rejected templates as overkill for v1; layered `defaultTerms` + per-job `notes` is the chosen pattern.
- Configurable valid-until window — ROADMAP locks at 30 days; deferring "configurable per-user" until usage signals demand.
- Configurable filename pattern — D-11 locks `Quote-Q-NNNN-{customerSlug}.pdf`; not a user setting in v1.
- Multi-page line-item handling beyond auto-pagination jspdf-autotable already provides — collapsed single-row pattern (D-04) means most quotes are 1 page anyway.
- E-signature / send-by-email / save-to-cloud — out of v1.2 scope, paid-tier territory.
- Translation of UI strings (`QUOTE`, `Subtotal`, `Total`, `Notes`, `Terms`, footer text) — app is English-only in v1.2; locale-aware Tax label (D-06) is the one exception because it's already encoded in country data.
- Any changes to existing Dexie store schemas — only `UserProfile` (a JSON blob) gains `defaultTerms`; no migration needed.
- `jspdf-autotable` advanced theming, alternating row colors, or custom cell renderers beyond what's needed for the collapsed line-item row + totals block.

</domain>

<decisions>
## Implementation Decisions

### Visual Style + Layout

- **D-01:** Print-shop minimal aesthetic — pure black-on-white. Ruled lines, bold section headings, no accent colors. Prints fine on B&W laser printers. Mirrors the look of Stripe / QuickBooks / professional invoice tools. Rejected: subtle blue accent (extra ink, harder on B&W); branded card-style with colored blocks (heavy, less professional, multi-page risk); "use your judgment" (user has a clear preference for the print-shop idiom).

- **D-02:** Header = wordmark-only typography. Bold sans-serif `3DCoster` (~18pt) at top-left; `QUOTE` label and quote number (`Q-NNNN`) stacked at top-right; thin horizontal rule (~0.5pt) immediately below. Total header height ~50pt. No logo image, no tagline, no accent band. Works regardless of whether a logo asset is ever added. Rejected: wordmark + tagline + ruled band (more presence but extra vertical footprint); reserved logo slot (premature; adds structural complexity for a logo that doesn't exist).

- **D-03:** Standard invoice section order top → bottom: Header → [Quote # + Issue date + Valid-until block (LEFT column)] + [Customer block (RIGHT column)] → Job title + line items table (full width) → Subtotal/Tax/Total totals block → Notes/Terms section → Footer. Two-column meta-and-customer block under the header is the only non-stacked region. Mirrors the 99% case for professional quotes; reader's eye moves top-left to top-right (meta + recipient), then down through items + totals. Rejected: customer-first prominence (wastes horizontal real estate); compact single-column (looks less professional, easier jspdf layout doesn't justify the regression).

- **D-04:** Line items = collapsed single row. One `jspdf-autotable` row per quote: `Custom 3D print — {jobTitle} (qty: N) — {sellingPrice}`. Subtotal = `qty × sellingPrice` (qty defaults to 1 if `copiesSold === 0` or undefined). Cost breakdown (material / electricity / labor / depreciation / wear / post-processing / profit) is NOT exposed to the buyer — protects the seller's cost structure. Rejected: itemized cost breakdown (exposes margin; sellers don't want this); hybrid with optional print-details note (over-complex; user can write print details into `PrintJob.notes` manually if wanted).

### Quote Number Format + Tax Label

- **D-05:** Quote number displays as `Q-NNNN` — 4-digit zero-padded with `Q-` prefix. `UserProfile.nextQuoteNumber` remains a plain integer (e.g. `42`); the `Q-` prefix + zero padding are display-only at PDF render time. Counter is LIFETIME — no yearly reset, no per-customer counter, no resequencing. Matches the existing `?? 1` seed comment in `src/types.ts:294`. Display logic lives in a small `formatQuoteNumber(n: number): string` helper next to the PDF generator (or in `src/utils/format.ts` if planner prefers). Rejected: bare `0042` (customer can confuse with invoice/PO number); `Q-2026-0042` year-prefix (forces yearly-reset decision, more moving parts).

- **D-06:** Tax row label is REGION-AWARE — derived from `UserProfile.address.country` ISO 3166-1 alpha-2 code at PDF render time. Mapping: EU member states + UK → `VAT`; AU/NZ/IN/CA → `GST`; ES/MX → `IVA`; US → `Sales Tax`; everything else (or no country set) → `Tax`. Helper: new `taxLabelFor(countryCode?: string): string` in `src/utils/taxResolution.ts` (where `defaultTaxRate` + tax stack already live). Researcher confirms full EU member list (likely just lift it from the existing tax-region table in Phase 13 if one exists). Rejected: universal `Tax` (feels generic to EU sellers); user-configurable `taxLabel` setting (overkill for v1, adds a Settings field for one string).

- **D-07:** When `taxRate === 0` (or `taxAmount === 0`), HIDE the Tax row but STILL show Subtotal AND Total — clearest math chain for the customer. Layout:
    - Tax = 0% → `Subtotal: €120.00` then `Total: €120.00` (no Tax row)
    - Tax > 0% → `Subtotal: €120.00` then `{TaxLabel} ({rate}%): €22.80` then `Total: €142.80`
  The tax row label includes the rate inline (e.g. `VAT (19%): €22.80`) so the customer doesn't need to back-compute the rate. Honors ROADMAP success criterion #1 ("Tax hidden at 0%"). Rejected: hide both Tax AND Subtotal (looks weird; subtotal anchors the math); show `0%` row anyway (contradicts ROADMAP — would require updating the success criterion).

### Notes/Terms Section Source

- **D-08:** LAYERED model — two distinct subsections in the PDF Notes/Terms area:
    1. **Notes** — pulled from `PrintJob.notes` (already exists on the job record, per-sale specific)
    2. **Terms** — pulled from `UserProfile.defaultTerms` (new field — boilerplate: payment terms, refund policy, lead times)

  Each subsection is OMITTED if its source string is empty / whitespace-only. If BOTH are empty, the entire Notes/Terms area is omitted entirely and the page reflows up (no empty section, no gap). Mirrors the 3-layer tax pattern (default + per-job override). Rejected: per-job free-text only (forces seller to retype boilerplate every quote); templates / presets array (overkill for v1; UI scope explosion). Deferred: template-picker UI (could come in v2 if user demand surfaces).

- **D-09:** `defaultTerms` is edited in the EXISTING `UserProfileModal` — added as a multi-line textarea labeled "Default quote terms" placed adjacent to address / labor rate (business-defaults grouping). No new modal, no new Settings section. The field is OPTIONAL — empty by default for new users; PDF Terms subsection silently omits when empty. Rejected: SettingsModal (Settings is app config; defaultTerms is business identity); dedicated "PDF settings" subsection (premature — only one field exists; revisit when v2 white-label adds more PDF prefs).

### Font + Filename + Generate-PDF Placement

- **D-10:** Bundle Noto Sans (regular + bold, Latin + Latin-Ext subset only, ~80 KB gz combined) as base64 INSIDE the lazy PDF chunk. Loaded via `jspdf.addFileToVFS` + `addFont` once on first PDF gen per session. Works fully offline (web + Tauri) with zero network calls and no `/public/fonts/` filesystem dependency. The ~80 KB lives in the lazy PDF chunk — does NOT affect the main bundle 300 KB gz gate. Researcher confirms during research phase: (a) Latin + Latin-Ext subset covers `€`, accented Latin letters, and the glyphs ROADMAP success criterion #5 calls out; (b) exact subset tool (e.g. `subset-font`, `fonttools pyftsubset`) + final base64 file size. If the Latin-Ext subset somehow can't reach the success-criterion glyph set, researcher escalates BEFORE planning. Rejected: fetch `/public/fonts/*.ttf` at PDF gen time (worse offline story; Tauri csp + asset-scope changes; one more failure mode); jspdf default Helvetica (Latin-1 only — violates success criterion #5).

- **D-11:** Filename pattern: `Quote-{Q-NNNN}-{customerNameSlug}.pdf`. Examples: `Quote-Q-0042-AliceTest.pdf`, `Quote-Q-0043-AcmeCo.pdf`. Slug is ASCII-safe: lowercase, alphanumeric only, hyphenate spaces, strip all other characters, capped at 30 chars. When the customer block is OMITTED (no customer details on the sale), drop the slug entirely: `Quote-Q-0042.pdf`. Rejected: bare `Quote-Q-0042.pdf` always (loses customer-name context that helps customer find the file in their downloads); branded `3DCoster-Quote-Q-0042.pdf` (longer, less useful when downloads pile up).

- **D-12:** "Generate PDF" button placement:
    - **CostCalculator (`src/components/CostCalculator.tsx`):** Secondary button (`<Button variant="secondary">`) labeled `Generate PDF` placed next to `Save job` at the bottom of the form. DISABLED when `sellingPrice <= 0` — the PDF needs a price to render meaningfully. Tooltip on the disabled state: "Set a selling price first".
    - **JobsManager (`src/components/JobsManager.tsx`):** `Generate PDF` button rendered INSIDE the expanded saved-job accordion (next to Edit / Delete buttons). NOT shown on the collapsed row — avoids row clutter and keeps the mobile experience clean. Requires the user to click-to-expand once, then click `Generate PDF`. Two clicks total; acceptable friction for an export action.
  Rejected: cost-calc bottom + JobsManager row-level (visual noise on every row; worse on mobile); dedicated "Export" section in both views (premature — PDF is the only export action in v1.2).

### Pre-Existing Code Seeds (honor as locked)

- `src/types.ts:226` — `PrintJob.quoteNumber?: number` — comment says "assigned on first PDF gen, then reused (D-05)". HONOR this: assign once per job, persist to Dexie via `db.jobs.put(job)`, subsequent PDF gens re-use.
- `src/types.ts:295` — `UserProfile.nextQuoteNumber?: number` — comment says "first quote is #1 (D-06); read via `?? 1`". HONOR this: counter starts at 1 (not 0); read with nullish coalescing fallback.
- The D-05 / D-06 numbering in the type-file comments refers to forward-looking decision numbers in THIS document; they map roughly to D-05 (format) and the seed-value side of D-05 (lifetime counter, no reset). Researcher should not be confused — the type-file comments were written ahead of CONTEXT.md as scaffolding.

### Claude's Discretion

- Exact module path for the PDF generator (`src/pdf/generateQuotePdf.ts` vs `src/utils/pdfQuote.ts` vs `src/components/pdf/...`) — planner picks based on the prevailing organization of utility-vs-component code in this codebase.
- `vite.config.ts` chunk-naming for the PDF chunk (`pdf-vendor` vs `pdf` vs default `[hash]`) — planner picks; only requirement is that the assert-no-pdf-preload script can identify the chunk reliably.
- Whether the Noto Sans base64 lives in a separate module imported by the PDF generator, vs inlined directly into `generateQuotePdf.ts` — purely organizational; researcher / planner decide based on file-size readability.
- Exact wording of the `formatQuoteNumber(n)` helper signature and home (utility file vs colocated with PDF generator).
- Tauri save-dialog plumbing details (which `@tauri-apps/plugin-dialog` API to call, default folder, fallback on user-cancel) — researcher confirms during research phase; the `__IS_TAURI__` guard pattern is already established in the codebase.
- Whether `jspdf-autotable` or hand-rolled `doc.rect` + `doc.text` is the cleanest path for the collapsed single-row line items + the totals block — researcher decides based on what gives the cleanest layout with the smallest chunk size.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + milestone context
- `.planning/PROJECT.md` — Key Decisions row for PDF lock (lazy-loaded client-side library, free-tier with footer + white-label deferred). Last-updated footer confirms Phase 16 is the final v1.2 phase.
- `.planning/ROADMAP.md` Phase 16 section — full goal + 5 success criteria + dependencies (Phase 13 tax + Phase 14 customer).
- `.planning/REQUIREMENTS.md` PDF-01 through PDF-05 — requirement IDs that map to this phase.

### Prior phase artifacts that constrain Phase 16
- `.planning/phases/13-tax-model-ui-sweep/13-SUMMARY.md` — how the 3-layer tax model resolves; what `taxRate` / `taxAmount` mean on `PrintJob`.
- `.planning/phases/13-tax-model-ui-sweep/13-CONTEXT.md` — region-table decisions that may already encode an EU member list reusable for D-06's `taxLabelFor`.
- `.planning/phases/14-customer-details-etsy-helper/14-SUMMARY.md` — `JobCustomer` shape + per-Sale customer snapshot — confirms the customer block fields available to the PDF (name/email/company/address/notes).
- `.planning/phases/11-performance-optimization/11-SUMMARY.md` — the 300 KB gz main-chunk gate + `scripts/assert-bundle-size.mjs`. PDF chunk MUST stay off the main bundle.
- `.planning/phases/15.1-customer-library/15.1-SUMMARY.md` (and `15.1-CONTEXT.md` D-01 by-value snapshot rule) — the per-Sale customer block is by-value; PDF reads from the per-Sale snapshot, NOT the library record.

### Codebase maps
- `.planning/codebase/STACK.md` — Vite 7 / React 19 / Tailwind 4 / Dexie versions. PDF library selection (jspdf + jspdf-autotable) is already locked in ROADMAP.
- `.planning/codebase/STRUCTURE.md` — where `src/components/`, `src/utils/`, `src/hooks/` are organized — informs planner's choice of PDF generator module location.
- `.planning/codebase/CONVENTIONS.md` — naming rules (PascalCase for components, camelCase for utilities, `use` prefix for hooks). The PDF generator is a utility, not a component or hook.
- `.planning/codebase/INTEGRATIONS.md` — Tauri 2 integration patterns; `__IS_TAURI__` guard idiom.

### Existing code that the planner must read
- `src/types.ts:213–248` — `PrintJob` interface (especially the existing `quoteNumber?` field at 226).
- `src/types.ts:273–296` — `UserProfile` interface (especially the existing `nextQuoteNumber?` field at 295 — where `defaultTerms?` must be added).
- `src/utils/taxResolution.ts` — where the 3-layer tax resolver lives. `taxLabelFor()` helper belongs here.
- `src/components/CostCalculator.tsx` — find the Save-job button row to slot Generate PDF next to it.
- `src/components/JobsManager.tsx` — find the expanded-accordion Edit / Delete buttons to slot Generate PDF next to them.
- `src/components/UserProfileModal.tsx` — find the address / labor rate group to slot the "Default quote terms" textarea adjacent.
- `src/db/database.ts` — confirm `setUserProfile` writes back to Dexie (no schema change needed since UserProfile is a JSON blob).
- `vite.config.ts` — where `build.modulePreload: false` lands; the existing `manualChunks` config from Phase 11 is the prior art for chunk control.
- `scripts/assert-bundle-size.mjs` (Phase 11) — prior art for the new `scripts/assert-no-pdf-preload.mjs`.

### External constraints
- ROADMAP locks `jspdf` + `jspdf-autotable` as the chosen library — researcher does NOT need to compare against pdf-lib / react-pdf.
- ROADMAP locks `vite.config.ts` `build.modulePreload: false` — non-negotiable.
- Project memory rule (NEW badge): `~/.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md` — absolute overlay, never inline, single entry point per surface.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`UserProfile.nextQuoteNumber`** (types.ts:295) + **`PrintJob.quoteNumber`** (types.ts:226) — both fields already declared with Phase 16 comments. No type changes needed; just write to them.
- **`UserProfileModal.tsx`** — existing modal already handles currency / name / labor / margin / address / tax. Pattern for adding `defaultTerms` textarea is straightforward (mirror the existing optional-string handling).
- **`getUserProfile` / `setUserProfile`** (`src/db/database.ts`) — UserProfile is a JSON blob in the `settings` store. Adding a field requires no Dexie migration.
- **`src/utils/taxResolution.ts`** — the 3-layer tax resolver from Phase 13 is the natural home for `taxLabelFor(countryCode)`. Country code already lives on `UserProfile.address.country` (types.ts:286).
- **`__IS_TAURI__` guard pattern** — used throughout the codebase for desktop-specific code paths. Web/Tauri save-dialog branch follows this idiom.
- **`scripts/assert-bundle-size.mjs`** — prior art for `scripts/assert-no-pdf-preload.mjs` (Node script, exit code semantics, runs in `npm run build`).
- **`<Button>` / `<Input>` / `<Textarea>` primitives** from Phase 7 — used for the Generate PDF buttons and the defaultTerms textarea. No raw `<button>` or `<input>` needed.
- **`<NewBadge>`** + `src/features.ts` — used for the "this is new" affordance on the Generate PDF buttons per the global NEW-badge rule.
- **`formatCurrency`** (currency.ts) — already used app-wide for prices; PDF totals call this for `Subtotal` / `Tax` / `Total` rendering so symbol placement / decimals match the rest of the app.

### Established Patterns

- **Lazy chunk splitting** (Phase 11): Vite `manualChunks` already splits `react-vendor` / `dexie-vendor` / `vendor`. The PDF generator follows the same pattern — it's reached via dynamic `import()` so Vite naturally chunks it; the only explicit config is `modulePreload: false` so the chunk isn't pre-fetched into `index.html`.
- **Sibling-not-generic pattern** (Phase 15.1 D-08 for CSV imports): when adding a new feature that resembles an existing one (CSV import / sale modal), the codebase prefers a SIBLING file with feature-specific shape over genericizing the existing one. PDF generator follows this — it is its own module, not a polymorphic generic.
- **Lock dangerous-by-default vs ship-by-default** (project-wide): PDF chunk MUST be dynamically imported; CI gate enforces this. Mirrors how Phase 11 enforces the 300 KB gz gate.
- **By-value snapshot rule (CL-05 from Phase 15.1):** the per-Sale customer block is a snapshot. PDF reads from the Sale snapshot (or, if generating from CostCalculator before a sale is recorded, from the current form values) — NOT from the customer library record. If the user edits the library record AFTER PDF gen, the PDF stays byte-identical (already on disk).

### Integration Points

- **CostCalculator → PDF generator:** the Save-job button row is where the new `Generate PDF` button slots in. Click handler does dynamic `import('./pdf/generateQuotePdf')` then calls `generateQuotePdf({...job, currentUserProfile})`. Disabled state when `sellingPrice <= 0`.
- **JobsManager → PDF generator:** expanded-accordion action row is where the new `Generate PDF` button slots in. Same dynamic-import pattern; `job` is the saved Dexie row (re-uses `job.quoteNumber` if already assigned, else assigns + bumps `nextQuoteNumber`).
- **UserProfileModal → defaultTerms field:** add a multi-line `<Textarea>` field next to the labor / address group. State managed by the existing UserProfileModal form pattern.
- **`taxResolution.ts` → PDF generator:** the PDF generator calls `taxLabelFor(userProfile.address?.country)` to derive the row label.
- **`src/features.ts` → NewBadge on Generate PDF buttons:** add a `pdf-quote` entry on ship date. NewBadge wraps the button text per the absolute-overlay rule.

</code_context>

<specifics>
## Specific Ideas

- **Visual reference:** "Stripe-style invoices" and "QuickBooks-quote-feel" were the implicit anchors during the aesthetic discussion — print-shop minimal, ruled lines, bold section heads, no color. Researcher / planner can look at a sample Stripe invoice if they need a visual reference.
- **Layout reference:** "Standard invoice section order" — top-left meta, top-right customer, full-width items, totals stacked right-aligned, notes/terms full-width, footer.
- **Tax label region mapping:** user opted for region-aware — implied trust that a small ISO-country → label map is the right tradeoff vs hardcoded "Tax" or user-configurable.
- **Filename anchor:** "Quote-Q-0042-AliceTest.pdf" — the customer-name slug is non-negotiable when a customer exists, because it helps the customer find the file.

</specifics>

<deferred>
## Deferred Ideas

- **PDF preview modal before download** — user wants a click-to-generate, immediate-download flow. Preview UX is a future enhancement (probably v1.3+) if usage signals demand.
- **Tauri save-dialog UX polish** — folder memory, default folder configuration, fallback on user-cancel — researcher confirms minimum bar during research; deeper UX deferred until usage signals friction.
- **Quote-template / preset system** — `UserProfile.termsTemplates: Array<{name, body}>` with picker — explicitly out of v1.2 per D-08. Revisit when v2 white-label work adds more PDF surface.
- **White-label / logo upload / custom footer** — locked in PROJECT.md to paid tier (v2.0+). Not v1.2.
- **Configurable valid-until window** — ROADMAP locks 30 days; configurability is deferred to a UserProfile/Settings addition if customer usage shows demand.
- **Per-customer / yearly quote-number reset** — lifetime counter is locked. Yearly-reset is a future enhancement requiring `nextQuoteNumber` to grow into `{nextSeq, year}` shape.
- **Translation of PDF UI strings** — app is English-only in v1.2. Tax label is the one exception (region-aware via country code).
- **Cost-breakdown line items** (transparent pricing mode) — could be a toggle in UserProfile for sellers who DO want to expose cost structure (rare in B2C, common in B2B / government bids). Deferred.

</deferred>

---

<extension>
## Extension — UAT-driven scope additions (2026-05-23)

**Trigger:** After Phase 16 plans 16-01..16-04 shipped, UAT (plan 16-05 Task 2) surfaced 8 gaps. See [16-VERIFICATION.md](.planning/phases/16-printable-pdf-quote/16-VERIFICATION.md) for the verbatim user report and per-gap fix detail. The user's verdict was: "extend Phase 16 to cover everything." The extension is in scope of Phase 16, not v1.3.

**Goal of the extension:** Turn the printable PDF (already correct as a document) into a real **Quote lifecycle**. A quote is sent to a specific customer (not the most-recent-sale customer), carries shipping, has an explicit status (sent → accepted/declined → converted), and is preserved as a by-value snapshot that the PDF can reproduce immutably. Plus one pre-existing tax-fallback bug that Phase 16 surfaced.

### Carrying forward from Phase 15.1 + 14

- **Customer entity already exists** (Phase 15.1 D-01): `Customer extends JobCustomer` at `src/types.ts:163`. Dexie `customers` store. `useCustomers()` hook. Typeahead combobox picker in JobsManager Record Sale modal (15.1 D-04). The extension reuses ALL of these — no new picker UX language, no Customer schema work.
- **By-value snapshot rule is locked project-wide** (Phase 15.1 D-04, Phase 14 D-21, Phase 16 D-04 line item collapse): Sale.customer is a snapshot, Sale.lineItems are snapshots, PDF is a frozen artifact. **Quote inherits this rule fully** — see D-17 below.
- **Email-match dedup pattern** (Phase 15.1 D-07): typed email matching `trim().toLowerCase()` an existing Customer silently links to that record; do not create a duplicate, do not overwrite the library from per-quote edits. Applied to Print Quote modal.
- **3-layer tax model** (Phase 13): `resolveTaxRate({ jobOverride, settingsDefault, currency, address })` is correct; the defect is at the save boundary (gap H / D-21 below).

### Extension domain delta

**Added to in-scope:**
- New `Quote` Dexie store (v7 → v8 migration) — first-class quote records distinct from Sales.
- New `Quote.shippingCost: number` field; PDF gains a Shipping row between Subtotal and Tax (D-15 below extends D-07).
- New `src/components/PrintQuoteModal.tsx` — modal opened on the JobsManager "Print Quote" button (renamed from "Generate PDF" per D-14). Customer combobox (reuses 15.1's typeahead) + shipping input + live totals preview + Generate button.
- New "Recent Quotes" section in JobsManager accordion (mirrors existing "Recent Sales" — D-19 below).
- New "Convert to Sale" action on accepted Quotes — opens the existing Record Sale modal pre-populated from Quote snapshot (D-20).
- Tax-fallback bug fix in CostCalculator save path (D-21).

**Moved to OUT of scope (was in-scope per original D-12):**
- "Generate PDF" button on CostCalculator — REMOVED per gap A / D-13. CostCalculator never had Sale/Customer context, so a quote from this surface was always wrong-by-default.

**Newly out of scope (explicitly deferred to v1.3):**
- Top-level "Quotes" tab in main nav. Per-job Recent Quotes section is sufficient for v1.2 (G1 locked). Revisit when usage shows demand for a cross-job outstanding-quotes view.
- Quote PDF preview-before-download — same answer as Phase 16 original deferred list.
- Per-jurisdiction shipping-tax handling. Tax computed on `sellingPrice` only; shipping is NOT taxed. Total = `subtotal + shipping + tax`. v1.2 ships US-default behavior even for EU users; per-jurisdiction shipping-VAT is v2 work (D-22).
- E-signing / send-by-email integrations — still v2.0+ territory.

### Extension decisions (D-13 through D-22)

**D-13 (gap A):** Remove "Generate PDF" button + handler + dynamic-import block from `src/components/CostCalculator.tsx`. Remove the 4 GeneratePdfButton tests from `src/components/CostCalculator.test.tsx`. The single remaining call site for `await import('../pdf/generateQuotePdf')` is in JobsManager — the audit count drops from 2 → 1 (update any pinned grep expectation in CI scripts). The `GeneratePdfButton` subcomponent itself can stay (it'll be reused by the new Print Quote modal in D-18 if it's the right shape) OR be inlined into the modal — planner picks. **Supersedes original D-12 CostCalculator branch.** Original D-12 JobsManager branch survives but the button label changes per D-14.

**D-14 (gap B):** Rename JobsManager "Generate PDF" → **"Print Quote"**. Replace the current ghost styling with the standard secondary button variant from `src/components/ui/Button.tsx`. The button must look like a button — same affordance as Edit / Delete next to it. NewBadge stays as absolute overlay (no inline layout change). Tooltip on disabled state stays "Set a selling price first" (still gated by `sellingPrice <= 0`). The button no longer auto-generates a PDF on click — it opens the modal in D-18.

**D-15 (gap C — shipping):** Add `Quote.shippingCost: number` (default 0; D-17 below). The PDF generator inserts a "Shipping" row between Subtotal and Tax when `shippingCost > 0`:
- Shipping = 0 → Subtotal → (Tax row if applicable) → Total
- Shipping > 0 → Subtotal → `Shipping: €X.XX` → (Tax row if applicable) → Total
- Total = `subtotal + shippingCost + taxAmount` (never includes shipping in the taxable base — see D-22)
- Extends D-07 (tax-row hide/show); shipping row uses the same hide-when-zero rule.

**D-16 (gap D — customer picker behavior):** PrintQuoteModal customer picker reuses Phase 15.1's typeahead combobox pattern verbatim. Inline new-customer auto-save on submit (15.1 D-06). Email-match dedup with silent link (15.1 D-07). Library record is NOT overwritten by per-quote edits. The per-Quote customer fields (the `Quote.customerSnapshot` written at Generate time) ARE the by-value snapshot — they can diverge from the library record and the PDF reflects what was in the modal at Generate time.

**D-17 (gaps D + E + G7-locked — Quote schema + migration):**
- New Dexie store `quotes` at v8 with schema `'id, quoteNumber, status, customerId, printJobId, createdAt, sentAt'`. `quoteNumber` is indexed because the Recent Quotes section needs it for sort. `status` is indexed because filtering by status is a common query.
- `Quote` interface in `src/types.ts`:
  ```ts
  interface Quote {
    id: string;                         // uuid
    quoteNumber: number;                // 4-digit; display via formatQuoteNumber()
    printJobId: string;                 // FK to PrintJob.id
    customerId?: string;                // FK to Customer.id (undefined if new customer typed but email-dedup never fired)
    customerSnapshot: JobCustomer;      // by-value copy at Generate time
    lineItemsSnapshot: {                // by-value snapshot of priced + identity fields
      jobTitle: string;
      sellingPrice: number;
      shippingCost: number;
      resolvedTaxRate: number;          // the rate ACTUALLY APPLIED (post-fallback) — NOT the override
      taxAmount: number;                // computed from resolvedTaxRate
      currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'NZD' | 'CHF' | 'JPY' | 'ZAR';
      notes: string;                    // PrintJob.notes at Generate time (may be empty)
      terms: string;                    // UserProfile.defaultTerms at Generate time (may be empty)
      countryAtSendTime?: string;       // UserProfile.address.country at Generate time — needed for taxLabelFor() reproducibility
    };
    status: 'sent' | 'accepted' | 'declined' | 'converted';
    createdAt: Date;
    sentAt: Date;                       // = createdAt for v1.2 (PDF download IS sent — see D-19/G6 lock)
    decisionAt?: Date;                  // set when user clicks Mark Accepted / Mark Declined
    convertedAt?: Date;                 // set when Convert to Sale fires (D-20)
    convertedToSaleId?: string;         // FK to Sale.id on conversion
  }
  ```
- **Snapshot rule (per G4 lock — strict by-value):** PDF reads ONLY from Quote. NEVER from PrintJob or UserProfile at render time. Even `countryAtSendTime` is snapshotted so the `taxLabelFor()` mapping is reproducible 6 months later if the user moves countries.
- **Migration v7 → v8 (per G7 lock — backfill old PrintJobs):**
  - For each PrintJob with `quoteNumber` set:
    - If the job has ≥1 Sale: create a Quote with `status='converted'`, `convertedToSaleId = most-recent Sale.id`, `customerSnapshot = most-recent Sale.customer`, `convertedAt = most-recent Sale.createdAt`.
    - Else: create a Quote with `status='draft'` (NOT `'sent'` — we have no PDF on file proving it was sent). Migration writes minimal snapshot from the job's current state; this is acknowledged best-effort for legacy data.
  - PrintJob.quoteNumber stays as a deprecated field (read-only) for one phase as a safety belt. Removed in a follow-up cleanup phase (16.1 or v1.3 hygiene).
  - `UserProfile.nextQuoteNumber` stays — still the counter source. Increment site moves from CostCalculator-save / JobsManager-PDF-gen to Quote-creation (the Generate button in PrintQuoteModal).
- **Migration test (locked):** v7 fixture with 3 PrintJobs (1 has sales, 1 has quoteNumber but no sales, 1 has no quote ever) → after v8 upgrade, exactly 2 Quote rows exist with correct statuses; the 3rd PrintJob remains as-is.

**D-18 (gap D + G5-locked — Print Quote modal UX):**
- New `src/components/PrintQuoteModal.tsx`. Opened when the user clicks "Print Quote" on the JobsManager accordion (D-14).
- Layout (top to bottom):
  1. Header: `Print Quote — {jobTitle}` + close X.
  2. Customer combobox (reuses 15.1's typeahead via `useCustomers()` — same Name + Email + Company filter, same dropdown row layout).
  3. Four customer fields below the combobox (Name / Email / Company / Address) — auto-filled on pick, freely editable per-quote (the edits flow into `customerSnapshot`, not back into the library).
  4. Shipping input: single `<Input compact>` with currency-suffix per project conventions (compact input rule from `feedback_narrow_currency_inputs.md`).
  5. Live totals preview block (reuses the same `formatCurrency` + `resolveTaxRate` helpers — so the modal shows EXACTLY what the PDF will show):
     - Subtotal: €X.XX
     - Shipping: €Y.YY (hidden when zero)
     - {TaxLabel} ({rate}%): €Z.ZZ (hidden when zero)
     - **Total: €T.TT** (bold)
  6. Footer: `[Cancel]` and `[Generate Quote]` (primary).
- **On Generate Quote click:**
  1. Validate: customer Name OR Email required (matches Customer-library required-field rule from 15.1 D-09).
  2. Compute resolved tax via `resolveTaxRate({ jobOverride: job.taxRate, settingsDefault: userProfile.defaultTaxRate, currency, address })`. Note: `job.taxRate` is now the corrected-by-D-21 resolved value, so this falls back correctly.
  3. Assign quote number: `Q-{userProfile.nextQuoteNumber ?? 1}`; bump `UserProfile.nextQuoteNumber` in the SAME write transaction as the Quote insert (Dexie `transaction('rw', ['quotes', 'settings'], ...)`). This is the lifetime counter increment site moving per D-17.
  4. If typed customer email matches an existing Customer (case-insensitive after trim): silently link (`Quote.customerId = existing.id`, bump `Customer.lastUsedAt`). Otherwise create a new Customer record (mirrors 15.1 D-06 auto-save). `customerSnapshot` always reflects what was in the modal — never the library record.
  5. Write the Quote row with `status='sent'`, `sentAt=now`, `customerSnapshot` + `lineItemsSnapshot` populated. `customerId` is set if the dedup or pick path fired.
  6. Generate + download the PDF (existing `generateQuotePdf` API, called with the new `quote` argument shape — PDF generator refactor: read all fields from `quote.lineItemsSnapshot` + `quote.customerSnapshot` instead of `job` + `userProfile`).
  7. Close modal, show a transient toast/banner: `Quote Q-NNNN saved. View it in Recent Quotes.`

**D-19 (gap F + G1-locked — Recent Quotes UI):**
- JobsManager accordion grows a new `Recent Quotes` section, rendered above the existing `Recent Sales` section (quotes precede sales chronologically in the workflow).
- Section behaves like Recent Sales — collapsed list with expandable rows. Empty state: section is hidden entirely if zero quotes exist for this job (don't show "No quotes yet" — visual noise).
- Row layout:
  - Top line (bold): `Q-NNNN · {customerSnapshot.name}` (or email if name is empty).
  - Muted second line: `{sentAt relative date}` · `€{total}` (where `total = subtotal + shipping + tax` from the snapshot).
  - Right side: status badge — `[Sent]` (gray pill) / `[Accepted]` (green pill) / `[Declined]` (red pill) / `[Converted]` (blue pill).
- Action buttons on the row (right-aligned, after the badge):
  - status='sent' → `[Mark Accepted]` + `[Mark Declined]`.
  - status='accepted' → `[Convert to Sale]` + `[Mark Declined]` (allow flip if user typo'd).
  - status='declined' → `[Reopen]` (sets back to status='sent' — for the rare typo case; bumps decisionAt = undefined).
  - status='converted' → no action buttons; row shows "→ Sale on {convertedAt date}" instead.
- Mark Accepted / Mark Declined: single-click, no modal — just writes `status` + `decisionAt = now`. (Per-quote audit trail is the timestamp; no notes field on the decision for v1.2.)
- Mobile layout: planner discretion. Reasonable default: stacked layout with status badge inline + a `⋯` overflow menu for actions.
- The accordion's existing Recent Sales display gets a small enhancement: if a Sale was `convertedFromQuoteId`, surface a tiny `← Q-NNNN` link on the Sale row (clicking scrolls to the corresponding Quote row above). Improves the audit-trail discoverability.

**D-20 (gap G + G2-locked — Convert Quote → Sale):**
- The `[Convert to Sale]` button on a status='accepted' Quote opens the existing Record Sale modal (`JobsManager.tsx` Record Sale flow) pre-populated from `Quote.lineItemsSnapshot` + `Quote.customerSnapshot`:
  - Sale price = `Quote.lineItemsSnapshot.sellingPrice` (user can adjust — e.g., $5 discount agreed in negotiation).
  - Customer fields = `Quote.customerSnapshot` (user can adjust).
  - Shipping cost: **Sale model gets a new optional `shippingCost?: number` field**, pre-populated from `Quote.lineItemsSnapshot.shippingCost`. (Sale schema gain is symmetric to the Quote schema gain — they share the same priced-fields shape.)
  - Tax rate: pre-populated from `Quote.lineItemsSnapshot.resolvedTaxRate`. The Sale-save fix from D-21 also applies — store the resolved rate, not the override.
- On Sale save (within the existing Record Sale flow):
  - Write the Sale as today, plus `Sale.convertedFromQuoteId = quote.id` for the back-reference.
  - Update the Quote row: `status='converted'`, `convertedAt=now`, `convertedToSaleId=newSale.id`.
  - Both writes in the same Dexie transaction (`rw` over `['sales', 'quotes']`). On rollback, neither persists — no half-converted state.
- The user can also Record Sale **without** a Quote (legacy path stays). Only the Quote → Sale convert path sets `convertedFromQuoteId`.

**D-21 (gap H — tax-fallback bug fix):**
- In `src/components/CostCalculator.tsx`:
  ```diff
  - taxRate: taxRateOverride,
  + taxRate: tax.ratePercent,
  ```
  at the two save sites (lines 634 + 670 as of pre-fix HEAD). The form's `taxRateOverride` state stays unchanged — it's the live-edit value. The saved record reflects what was actually applied, mirroring how `taxAmount` already does.
- Regression test: PrintJob saved with `taxRateOverride=undefined` and `userProfile.defaultTaxRate=13` → saved `job.taxRate === 13`, `job.taxAmount > 0`. PDF generated from such a job MUST show "Tax (13%): €X.XX" between Subtotal and Total.
- **Audit Phase 13 Sale writes** for the same defect: grep `taxRate: taxRateOverride` and `taxRate: .*Override` across `src/` outside CostCalculator. If found in a Sale write path (Record Sale modal, Sale repair scripts, anywhere), apply the symmetric fix. Sale.taxRate must reflect the resolved rate, not the override. Do NOT backfill historical Sale records — Sale invoice PDFs don't exist yet, so the inconsistency is invisible. (Add a TODO comment in the Sale-write site if a future Sale-PDF feature lands.)

**D-22 (tax base excludes shipping):**
- The Quote PDF computes tax on `sellingPrice` only, NOT on `(sellingPrice + shippingCost)`. Matches the existing `calculateTax(sellingPrice, ratePercent)` behavior in `src/utils/costCalc.ts:127` — no change needed. Total = `subtotal + shipping + tax` where `tax = subtotal × rate`.
- Per-jurisdiction shipping-tax (shipping IS taxable in most EU jurisdictions) is explicitly out of scope for v1.2. Locked here to prevent the planner from extending the tax engine. Defer to v2 alongside any wider EU VAT compliance work.

### Extension canonical refs

- [16-VERIFICATION.md](.planning/phases/16-printable-pdf-quote/16-VERIFICATION.md) — verbatim UAT report + 8-gap list (A–H). PRIMARY source for extension scope.
- [15.1-CONTEXT.md](.planning/phases/15.1-customer-library/15.1-CONTEXT.md) — Customer entity (D-01), Dexie store + index strategy (D-02), `useCustomers()` hook, typeahead combobox pattern (D-04), inline auto-save on submit (D-06), email-match silent-dedup (D-07), `<NewBadge>` placement rules (D-16). PrintQuoteModal MUST mirror this.
- [14-CONTEXT.md](.planning/phases/14-customer-details-etsy-helper/14-CONTEXT.md) — customer-on-Sale shape, by-value snapshot rule, fields-editable-per-sale (D-21).
- [13-CONTEXT.md](.planning/phases/13-tax-model-ui-sweep/13-CONTEXT.md) — `resolveTaxRate` fallback chain, 3-layer model, address-aware lookup. Phase 16 extension D-21 fix is at the save boundary; the resolver itself is correct.
- `src/utils/costCalc.ts:127` — `calculateTax(sellingPrice, ratePercent)` — shows tax base is sellingPrice only (D-22 lock).
- `src/utils/taxResolution.ts` — `taxLabelFor()` already lives here from Phase 16 original D-06; PDF reads it given `countryAtSendTime` from `Quote.lineItemsSnapshot`.

### Extension claude's discretion

- **Migration scoping:** Plan v7→v8 as one plan (schema + backfill) vs two (schema-only then backfill). One plan is cleaner; two reduces blast radius if backfill has edge cases. Planner picks based on risk read.
- **PrintQuoteModal file path:** `src/components/PrintQuoteModal.tsx` mirrors the existing modal naming convention (CustomerEditModal, CsvImportModal). No discretion needed — planner just uses this.
- **Quote.id generation:** Use the same UUID strategy as Customer (Phase 15.1 — `crypto.randomUUID()` from `src/utils/uuid.ts` if it exists, else inline `crypto.randomUUID()`). Planner reads 15.1 plans for the established idiom.
- **Recent Quotes section's mobile layout:** Status badge stacking + overflow menu vs single-row inline — planner picks based on accordion width budget. Test at 375px.
- **Whether to refactor `generateQuotePdf` to take a `Quote` argument vs keep its current `(job, userProfile)` signature and have callers materialize a "temp quote" before render** — refactor cleanly is the right move (the function is at most 1 caller after D-13); reduces argument drift and surfaces the by-value snapshot rule in the API.
- **NewBadge handling on the renamed "Print Quote" button** — keep the `pdf-quote` feature key + absolute-overlay placement. The badge stays for 36 hours after first sight per the existing rule; we are NOT bumping the feature date because the rename is incremental polish, not a new feature.
- **`vite.config.ts` audit count update:** `await import('../pdf/generateQuotePdf')` drops from 2 → 1. Update `scripts/assert-no-static-jspdf.mjs` if it pins the count; otherwise no change. The PDF generator is still lazy-loaded via the same chunk strategy.
- **Test fixture for the migration test:** Planner builds a v7 fixture + asserts v8 outcome. Reasonable to put in `src/db/database.migrations.test.ts` if it exists, else colocate with the v8 upgrade callback.

</extension>

---

*Phase: 16-printable-pdf-quote*
*Context gathered: 2026-05-22 (original) + 2026-05-23 (UAT extension)*
*Extension trigger: 16-VERIFICATION.md gaps A–H — user verdict "extend Phase 16 to cover everything"*
