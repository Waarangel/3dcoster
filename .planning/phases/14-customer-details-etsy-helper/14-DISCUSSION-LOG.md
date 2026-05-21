# Phase 14: Customer Details + Etsy Helper - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 14-customer-details-etsy-helper
**Areas discussed:** Collapsible primitive + placement, Customer form layout + email validation, JobsManager row display of customer name/email, Etsy checklist content + state persistence

---

## Collapsible primitive + placement

### Q1: Which collapsible primitive should the two new sections use?

| Option | Description | Selected |
|--------|-------------|----------|
| Custom React (useState + Chevron) | A small `<CollapsibleSection>` in `src/components/ui/` with header (chevron + title + optional NewBadge slot) and body. Full control of styling/animation, matches Tailwind dark theme cleanly, ~40 lines. | ✓ |
| Native `<details>/<summary>` | Zero JS, accessible by default. Styling harder, can't smoothly animate without recent CSS-only tricks; rounded-xl/border patterns need workarounds. | |
| Inline `useState` per section (no primitive) | Each section manages its own state. Faster but duplicates code; sections would diverge in subtle ways. | |

**User's choice:** Custom React (useState + Chevron). Lives in `src/components/ui/`.

### Q2: Where should the Customer and Etsy sections live in the cost calculator?

| Option | Description | Selected |
|--------|-------------|----------|
| Both as separate cards after Pricing, before Save | Two new `bg-slate-800 rounded-xl` cards. Customer first (quote metadata), Etsy second (compliance check before saving). | ✓ |
| Both inside the Print Job Details card (top of page) | Mixes input-heavy form with collapsible metadata; pushes Pricing down. | |
| Customer in Print Job Details; Etsy as its own card | Splits the two — customer travels with name/printer, Etsy stays compliance-only. | |
| Both as a single 'Quote Extras' card with two collapsibles | One card hosts both. Less visual chrome. | |

**User's choice:** Two separate cards, after Pricing, before Save. Customer first, then Etsy.

### Q3: Should the collapsible header support a NEW badge slot for v1.2 launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — register `customer-details` and `etsy-helper` in features.ts and badge each header | Phase 14 is the headline user-facing feature of v1.2. Two new entries, badge absolutely positioned on the chevron container. | ✓ |
| Only one section gets a badge — Customer | Customer is the bigger user-visible change; Etsy is supportive. Less badge noise. | |
| No badges — sections are obvious enough | Two collapsibles appearing self-announces. Saves features.ts churn. | |

**User's choice:** Badge both section headers. Two new `features.ts` entries.

### Q4: Where should the new `<CollapsibleSection>` primitive live?

| Option | Description | Selected |
|--------|-------------|----------|
| `src/components/ui/CollapsibleSection.tsx` + barrel export | Lives next to Button, Input, Card; generic, reusable for any future collapsible (e.g. Phase 16 PDF settings). Matches 'all primitives in ui/' convention. | ✓ |
| `src/components/CollapsibleSection.tsx` (feature folder, not primitive) | YAGNI-friendly but inconsistent with existing pattern. | |
| Inline component inside `CostCalculator.tsx` | Local helper for Phase 14; risks duplication in Phase 16. | |

**User's choice:** `src/components/ui/CollapsibleSection.tsx` with barrel export.

**Notes:** None — straight rolls.

---

## Customer form layout + email validation

### Q1: What's the field order inside the Customer section?

| Option | Description | Selected |
|--------|-------------|----------|
| Name → Email → Company → Address | Most-used first. Wide Address anchors the bottom. | ✓ |
| Name → Company → Email → Address | Groups 'who' fields, then 'how to reach'. | |
| Name → Email → Address → Company | Address before Company as contact-info cluster. | |

**User's choice:** Name → Email → Company → Address.

### Q2: How should the form be laid out on desktop and mobile?

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive 2-col grid: Name + Email on row 1, Company spanning row 2, Address textarea spanning row 3 | Matches Print Job Details flex-wrap pattern. Compact prop NOT used (text fields). | ✓ |
| Single column stack for all four fields | Simpler markup, wastes desktop horizontal space. | |
| All in one flex-wrap row, Address as own block below | Mirrors Phase 12's Model URL + Cost + Author Min row. | |

**User's choice:** Responsive 2-col grid; Address full-width textarea on its own row.

### Q3: How strict should email validation be?

| Option | Description | Selected |
|--------|-------------|----------|
| HTML5 `type="email"` only — no inline error UI | Phase 12 D-09 said no runtime type validation. Free browser tooltip + mobile @-keyboard. Save never blocked. | ✓ |
| `type="email"` + inline error message on blur if regex fails | Friendlier but introduces our own regex + error UI. | |
| No validation at all — `type="text"` | Truly permissive. JobsManager would render anything verbatim. | |

**User's choice:** HTML5 `type="email"` attribute only, no inline error UI.

### Q4: Placeholders, InfoTooltips, or both?

| Option | Description | Selected |
|--------|-------------|----------|
| Example-value placeholders, no InfoTooltips | Per Phase 13 D-15. Labels alone are clear; section is collapsed-by-default. | ✓ |
| Example placeholders + InfoTooltip on Address only | Address tooltip clarifies 'shown on PDF' usage. | |
| Empty placeholders, all descriptions in InfoTooltips | 4 info icons in a small section = visual noise. | |

**User's choice:** Example-value placeholders, no InfoTooltips.

**Notes:** None.

---

## JobsManager row display of customer name/email

### Q1: Where on the JobsManager row should customer name + email show?

| Option | Description | Selected |
|--------|-------------|----------|
| New subline below the existing 'filaments \| print-time' line | Compact, visible without expanding. Hidden when customer undefined. Revenue + sold counter untouched. | ✓ |
| Inline next to the print name (h3 line) | Tight on mobile, risks visual collision with break-even badges. | |
| Only when row is expanded | Defeats CUST-02 ('shows on the row, not just expansion'). | |

**User's choice:** New subline below the existing filaments/print-time line.

### Q2: How should the customer subline format name + email together?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Jane Doe · jane@example.com' — middle dot separator | Matches existing subline separator style; falls back gracefully when only one field is filled. Company intentionally NOT shown on row. | ✓ |
| Name on its own; email as smaller text-slate-500 line under it | Two-line hierarchy. Adds vertical height to every customer row. | |
| 'For: Jane Doe — jane@example.com' with explicit label | Self-explanatory but adds chrome; inconsistent with label-free subline style. | |

**User's choice:** 'Jane Doe · jane@example.com' with middle dot.

### Q3: How should long names/emails behave on narrow screens?

| Option | Description | Selected |
|--------|-------------|----------|
| Single line with `truncate` CSS ellipsis | Stable row height; predictable for virtualized list (Phase 11). | ✓ |
| Wrap to 2 lines max with `line-clamp-2` | Breaks row-height predictability; cache drift risk. | |
| Conditional break (only if both fields long) | Hard to predict and test. | |

**User's choice:** Single line with `truncate`.

### Q4: Should the expanded row detail panel show address + company?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show full Customer block (name, email, company, address) in expanded panel | Expanded panel is seller's own view (not the PDF). Helps verify what's saved without re-opening the calculator. | ✓ |
| No — stick literally to CUST-02 'address visible on PDF only' | Strict reading: address never renders in the app. | |
| Show only name + email in expanded panel (mirror collapsed row) | Redundant with the collapsed row. | |

**User's choice:** Yes — full Customer block (including address) in the expanded panel.

**Notes:** None.

---

## Etsy checklist content + state persistence

### Q1: How should the 5 Etsy checklist items be structured in `src/data/etsyToS.ts`?

| Option | Description | Selected |
|--------|-------------|----------|
| Array of `{id, title, body, link?}` objects | Stable id, short title, 1–2 sentence body, optional per-item link. `policySummaryAsOf` + `policyLink` exported as constants alongside. PRable to extend. | ✓ |
| Array of `{id, title}` only — body/link in JSX | Simpler data, but couples wording to React component. | |
| Object map `{id: title}` + i18n strings file | Future-proofs for translation. Overkill — no i18n setup. | |

**User's choice:** Array of typed objects with optional per-item link; date + main link as separate exported constants.

### Q2: Where should the per-item check state (which boxes the user ticked) persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-job, in a new `PrintJob.etsyChecks?: Record<string, boolean>` field | User's checks travel with the specific job. Non-indexed optional field — no Dexie version bump (piggybacks on Phase 12 D-02's 'undefined on existing records' rule). | ✓ |
| Local component state — resets every visit | Simplest, but defeats per-listing self-review value. | |
| Single global `userProfile.etsyChecksAck` boolean | One-time ack. Loses per-listing self-review. | |

**User's choice:** Per-job, on a new optional `PrintJob.etsyChecks` field with no schema-version bump.

### Q3: How should the policy disclaimer + 'as of' date be shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Disclaimer at top of expanded body in slate-700/yellow-tinted notice; date inline under the checklist with the legal link | Disclaimer read first (prominent per ETSY-02); date + source link travel together. | ✓ |
| Disclaimer + date + link all at the bottom | Cleaner top, but risks burying disclaimer below the fold. | |
| Disclaimer in section header subtitle, date + link at the bottom | Most prominent placement (visible when collapsed); adds chrome to header. | |

**User's choice:** Disclaimer top of body, date + link inline under the checklist.

### Q4: Should the Etsy section be visible only when marketplace === 'etsy', or always shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Always shown (collapsed by default) for every job | Matches ROADMAP success criterion #3 literally. Discoverable for new users. Self-review value applies regardless of marketplace. | ✓ |
| Only shown when `marketplace === 'etsy'` | Less real estate for non-Etsy sellers but introduces visibility magic tied to a different form section. | |
| Always shown, but expanded by default when `marketplace === 'etsy'` | Smart-default; section state no longer purely user-controlled. | |

**User's choice:** Always shown, collapsed by default. No marketplace-conditional visibility or auto-expand.

**Notes:** None.

---

## Claude's Discretion

- Exact Tailwind classes for the `<CollapsibleSection>` chevron rotation transition.
- Whether the chevron sits left or right of the title in the section header.
- Exact JSX/Tailwind for the Customer expanded-row block in JobsManager.
- Exact `<CollapsibleSection>` prop API (`title: string` + `right?: ReactNode` slot vs `header: ReactNode` directly).
- Test coverage depth for the `<CollapsibleSection>` primitive (one render-test for open/close behavior is sufficient).
- Exact `etsyChecklist` body wording per item — `id` values are locked but the prose can shift.
- Whether the Etsy disclaimer notice uses a Heroicons exclamation-triangle icon or text-only.

## Deferred Ideas

- Etsy section conditional on marketplace selection (rejected D-15; revisit if non-Etsy users find it noisy).
- Etsy API integration / live ToS sync (paid tier, future milestone).
- Persisting collapsible open/closed state across sessions (rejected D-03; revisit if usage analytics show re-opens).
- Customer DB / CRM tab (CUST-F1, future milestone).
- Email regex validation + inline error UI (rejected D-09; revisit if HTML5 validation proves too quiet).
- Search/filter by customer in JobsManager (Phase 15 free-text search includes this).
- Structured address fields (street/city/postal/country) (rejected Phase 12 D-08; revisit alongside Customer DB).
- Type-level email template-literal validation (rejected; brittle).
- Accordion behavior between Customer + Etsy sections (rejected D-02).
- Etsy checklist items appearing on the PDF (forbidden by ETSY-02).
- NewBadge per individual checklist item or per Customer field (visual noise).
