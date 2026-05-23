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

*Phase: 16-printable-pdf-quote*
*Context gathered: 2026-05-22*
