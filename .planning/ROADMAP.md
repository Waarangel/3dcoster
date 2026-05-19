# Roadmap: 3DCoster v1.1 — Quote-to-Customer

## Overview

v1.1 transforms 3DCoster from a cost calculator into a complete quoting tool. Six tightly-scoped phases carry every saved job from raw cost data to something you can confidently hand to a customer: tax-aware pricing, customer contact details, searchable tags, a downloadable PDF quote, and Etsy compliance attestation. All features are FREE tier; all data stays local; all schema changes preserve existing v1.0 multi-material jobs without data loss.

Phases continue from v1.0 (which ended at Phase 6).

## Constraints (apply to all phases)

- **Free tier**: All v1.1 features are free. PDF quote includes "Made with 3DCoster" footer linking to 3dcoster.app; white-label PDF is paid tier.
- **Offline-first**: No network calls during feature operation. PDF library (jsPDF or pdfmake) bundled client-side.
- **Dexie migration**: Every schema change ships with a Dexie version migration that preserves existing v1.0 multi-material jobs without data loss.
- **NEW Badge rule**: Every shipped phase adds an entry to `src/features.ts` and places `<NewBadge>` as an absolute overlay (never inline, never disrupts layout).
- **Dev server port**: 4173 (pinned in `vite.config.ts`).

## Phases

- [ ] **Phase 7: Tax/VAT** - Add configurable Tax/VAT percentage to selling price, per-job and as a Settings default
- [ ] **Phase 8: Quick Duplicate Job** - One-click clone of any saved job into the calculator with all fields pre-filled
- [ ] **Phase 9: Customer Details** - Attach customer name, email, and phone to any saved PrintJob
- [ ] **Phase 10: Tags, Filter & Search** - Editable tags (max 6) on saved jobs with OR-filter chips and substring search in JobsManager
- [ ] **Phase 11: PDF Quote** - Generate a downloadable PDF quote from any saved job, fully offline, with "Made with 3DCoster" footer
- [ ] **Phase 12: Etsy Compliance Helper** - Per-job origin/license flag and CSV compliance attestation export for marketplace disputes

## Phase Details

### Phase 7: Tax/VAT
**Goal**: Users can add a configurable Tax/VAT percentage to any job's selling price, with a Settings default that pre-fills new jobs.
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: PRICING-01, PRICING-02, PRICING-03
**Success Criteria** (what must be TRUE):
  1. User can enter a Tax/VAT % on any job in the calculator; the cost breakdown shows it as a separate line item below selling price with the computed dollar amount
  2. User can set a default Tax/VAT % in Settings → Pricing; new jobs and cleared forms pick up that default automatically
  3. Saving a job persists its Tax/VAT %; re-opening the job for edit shows the same value; duplicating the job (Phase 8) carries the value forward without loss
  4. Existing v1.0 saved jobs (no tax field) continue to load and display correctly after the Dexie migration — no errors, no missing data
**Plans**: TBD
**UI hint**: yes

### Phase 8: Quick Duplicate Job
**Goal**: Users can duplicate any saved job into the calculator pre-filled with all its fields — no re-entry required.
**Depends on**: Phase 7
**Requirements**: JOB-01
**Success Criteria** (what must be TRUE):
  1. Every saved job in JobsManager has a "Duplicate" action that loads the calculator with all fields pre-filled (filaments, printer, times, customer, tags, tax/VAT)
  2. The duplicate appears as a new in-progress job in the calculator form — no new saved record is created until the user explicitly clicks Save
  3. Editing and saving the duplicate creates a distinct new saved job; the original job is unchanged
**Plans**: TBD
**UI hint**: yes

### Phase 9: Customer Details
**Goal**: Users can attach a customer's name, email, and phone number to any saved PrintJob.
**Depends on**: Phase 7
**Requirements**: JOB-02
**Success Criteria** (what must be TRUE):
  1. The job save form includes optional fields for customer name, email, and phone
  2. Saved customer details are visible on the job card or detail view in JobsManager
  3. Customer fields round-trip through edit without loss; duplicating a job (Phase 8) carries customer details forward
  4. Existing saved jobs (no customer fields) load correctly after the Dexie migration — no errors, customer section shows empty
**Plans**: TBD
**UI hint**: yes

### Phase 10: Tags, Filter & Search
**Goal**: Users can label saved jobs with up to 6 free-text tags and quickly find jobs by filtering or searching those tags in JobsManager.
**Depends on**: Phase 9
**Requirements**: JOB-03, JOB-04, JOB-05
**Success Criteria** (what must be TRUE):
  1. User can add up to 6 tags to a job; attempting to add a 7th shows a clear validation message and is blocked
  2. Selecting one or more tag chips above the jobs list filters to jobs that contain any of the selected tags (OR semantics); deselecting all chips restores the full list
  3. Typing in the tag search box shows only jobs whose tags contain the typed substring (partial match, case-insensitive)
  4. Chip filter and text search compose correctly — both active at once narrows results as expected
  5. Existing saved jobs (no tags field) continue to appear in the unfiltered list after the Dexie migration
**Plans**: TBD
**UI hint**: yes

### Phase 11: PDF Quote
**Goal**: Users can generate and download a professional PDF quote from any saved job with no network call required.
**Depends on**: Phase 9
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. Any saved job has a "Download PDF Quote" action that triggers an immediate local file download — no server round-trip
  2. The downloaded PDF contains: job name, customer details (if present), cost breakdown line items, selling price, Tax/VAT line (if applicable), shop currency, and a "Made with 3DCoster — 3dcoster.app" footer
  3. PDF generation works with no internet connection — verified by disabling network in DevTools and confirming the download still completes
  4. The generated PDF renders legibly on a standard A4 or Letter page with no content cut off or overflowing
**Plans**: TBD
**UI hint**: yes

### Phase 12: Etsy Compliance Helper
**Goal**: Users can flag each job with its design origin/license type and export a CSV attestation listing compliant jobs for marketplace dispute response.
**Depends on**: Phase 9
**Requirements**: COMPLIANCE-01, COMPLIANCE-02
**Success Criteria** (what must be TRUE):
  1. Every saved job has an origin/license selector with four options: Own Design, Licensed Commercial, Third-Party STL, Unknown; new and migrated jobs default to Unknown
  2. The selected flag is visible on the job card or detail view and persists through edit without loss
  3. A "Export Compliance CSV" action generates a downloadable CSV listing all jobs flagged as Own Design or Licensed Commercial, with columns: date, job name, origin type, customer name (if present)
  4. The export works fully offline and produces a valid CSV that opens correctly in Excel and Google Sheets
  5. Existing v1.0 jobs load without errors after the Dexie migration and default to Unknown origin type
**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Tax/VAT | 0/? | Not started | - |
| 8. Quick Duplicate Job | 0/? | Not started | - |
| 9. Customer Details | 0/? | Not started | - |
| 10. Tags, Filter & Search | 0/? | Not started | - |
| 11. PDF Quote | 0/? | Not started | - |
| 12. Etsy Compliance Helper | 0/? | Not started | - |

---
*Milestone: v1.1 — Quote-to-Customer*
*Created: 2026-05-19*
*Phases: 7–12 (continuing from v1.0 Phase 6)*
*Coverage: 13/13 requirements mapped*
