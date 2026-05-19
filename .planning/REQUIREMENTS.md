# Requirements: 3DCoster v1.1 — Quote-to-Customer

**Defined:** 2026-05-19
**Core Value:** Turn the cost calculator into a complete quoting tool — every saved job becomes something you can confidently send to a customer.

## v1.1 Requirements

Requirements for milestone v1.1. Each maps to exactly one roadmap phase. All requirements sit on the FREE side of the free/paid line per [docs/ROADMAP.md](../docs/ROADMAP.md) "Guiding Principle" (2026-05-19).

### Pricing

- [ ] **PRICING-01**: User can add a configurable Tax/VAT percentage to a job's selling price, displayed as a separate line item in the cost breakdown
- [ ] **PRICING-02**: User can set a default Tax/VAT percentage in Settings → Pricing (applied to new jobs on creation and on form clear)
- [ ] **PRICING-03**: Tax/VAT percentage persists per-saved-job and round-trips through edit/duplicate without loss

### Job Management

- [ ] **JOB-01**: User can duplicate any saved job into the calculator with all fields pre-filled (filaments, printer, times, customer, tags, tax/VAT) — the duplicate creates a new in-progress job, not a saved record
- [ ] **JOB-02**: User can attach customer name, email, and phone to a saved `PrintJob` (currently `Sale.customerName` exists; this extends to PrintJob with full contact fields)
- [ ] **JOB-03**: User can add up to 6 free-text tags to a saved job; tag input enforces the cap with a clear validation message
- [ ] **JOB-04**: User can filter the JobsManager list by selecting one or more tags as chips; multi-select uses OR semantics
- [ ] **JOB-05**: User can search the JobsManager list by tag substring (typing partial tag matches jobs containing any tag with that substring)

### Export

- [ ] **EXPORT-01**: User can generate a PDF quote from any saved job, downloadable to the local filesystem
- [ ] **EXPORT-02**: PDF quote includes: job name, customer details (if present), cost breakdown line items, selling price, tax/VAT (if applicable), shop currency, and a small "Made with 3DCoster" footer with a link to 3dcoster.app
- [ ] **EXPORT-03**: PDF generation works fully offline (no network call — PDF library bundled client-side)

### Compliance

- [ ] **COMPLIANCE-01**: User can flag each job with an origin/license type — one of: `own_design`, `licensed_commercial`, `third_party_stl`, `unknown`. Default is `unknown` for migrated and new jobs until set.
- [ ] **COMPLIANCE-02**: User can export a compliance attestation CSV listing all jobs flagged as `own_design` or `licensed_commercial` (date, job name, origin type, customer if present) — intended for Etsy / marketplace dispute response

## v2 / Future Requirements

Deferred to a future milestone.

### Pricing

- **PRICING-F1**: Per-region tax presets (e.g. "Canada GST 5%", "EU VAT 20%") with one-click apply

### Job Management

- **JOB-F1**: Bulk tag operations (apply/remove tag from multiple jobs at once)
- **JOB-F2**: Tag-based grouping in JobsManager (collapsible groups by primary tag)

### Export

- **EXPORT-F1**: Customizable PDF quote template (which line items to include/hide)
- **EXPORT-F2**: Per-quote terms-and-conditions text block

### Compliance

- **COMPLIANCE-F1**: Live Etsy listing-status lookup for flagged jobs (requires backend — paid tier)

## Out of Scope

Explicitly excluded from v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| White-label PDF (your logo, colors, no footer) | Paid Pro tier — see ROADMAP "Paid Tiers" |
| Email delivery of PDF quote | Requires hosted SMTP — paid Pro tier |
| Shareable hosted quote URL | Requires backend — paid Pro tier |
| Customer database / CRM with cross-job history | Customer details on job is records-keeping (free); full CRM is paid Business tier |
| Live Etsy API integration | Compliance helper is manual flag + export only this milestone — live API is paid |
| PDF invoice numbering / accounting integration | Out of scope for quote-focused milestone; covered under future Accounting milestone |
| Multiple currencies on a single quote | Quote uses the job's stored currency; conversion not in v1.1 |
| Tag autocomplete from prior jobs | Nice-to-have; v1.1 ships with free-text tags and adds autocomplete later if needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRICING-01 | TBD | Pending |
| PRICING-02 | TBD | Pending |
| PRICING-03 | TBD | Pending |
| JOB-01 | TBD | Pending |
| JOB-02 | TBD | Pending |
| JOB-03 | TBD | Pending |
| JOB-04 | TBD | Pending |
| JOB-05 | TBD | Pending |
| EXPORT-01 | TBD | Pending |
| EXPORT-02 | TBD | Pending |
| EXPORT-03 | TBD | Pending |
| COMPLIANCE-01 | TBD | Pending |
| COMPLIANCE-02 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 after initial definition*
