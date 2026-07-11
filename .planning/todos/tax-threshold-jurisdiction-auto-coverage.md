---
created: 2026-07-11
title: Tax-threshold jurisdictions — auto-coverage for every supported locale
area: tax
resolves_phase: []
files:
  - src/utils/taxThreshold.ts
  - src/utils/taxThreshold.test.ts
  - src/components/insights/TaxThresholdCard.tsx
  - src/types.ts (TaxJurisdiction union)
---

# Tax-threshold jurisdictions — auto-coverage for every supported locale

## Why

User fix note (2026-07-11, during Phase 42 UAT): the tax-threshold tracker's
jurisdiction dropdown offers only **None / UK / DE / AU / US / Other**, while
the app supports **17 currencies** (and is i18n-ready per the deferred-translation
decision). A seller in New Zealand, Switzerland, Norway, Japan, Canada, etc.
falls straight to "Other" manual entry even though their country has a
well-defined registration/trading threshold — the same coverage gap pattern as
IN-02 for tax *rates*.

Thresholds should not require a hand-edit per country: coverage should expand
**automatically in step with the locales/currencies we support**, enforced by
the codebase rather than by remembering.

## What

1. **Expand `THRESHOLDS` + `TAX_YEAR_START`** (`src/utils/taxThreshold.ts`) to
   every supported currency's home jurisdiction where a national threshold is
   well-defined (NZ GST $60k, CH VAT CHF 100k, NO MVA 50k, CA GST $30k small
   supplier, etc. — **each figure must be sourced from the authoritative gov
   site at implementation time; never type numbers from memory**).
2. **Coverage gate (the "automatic" part):** add a unit test that iterates the
   `Currency` union and fails when a currency's home jurisdiction has neither
   (a) a `THRESHOLDS` entry nor (b) an explicit documented exemption (like the
   existing US badges-of-trade note). Adding a locale/currency then *forces*
   threshold coverage or a conscious opt-out — no silent gaps.
3. **Complex jurisdictions stay honest:** where no single national threshold
   exists (e.g. US state nexus, BR, CN), keep the "Other"/manual path with
   explicit "no data available — enter your local threshold" messaging (never
   an arbitrary default).
4. **Fold into the refresh pipeline:** threshold figures get `lastVerified`
   treatment and are maintained by the same maintainer-time refresh script as
   tax rates, so they stay current per release.

## Acceptance

- [ ] Every currency in the `Currency` union maps to a threshold entry OR a
      documented exemption; a test enforces this exhaustively
- [ ] Each new threshold cited against an authoritative gov source in the PR
- [ ] Dropdown in `TaxThresholdCard` grows automatically from the data table
      (no hardcoded option list drift)
- [ ] D-16 disclaimer text preserved verbatim; no tax *advice* implied
- [ ] `scripts/refresh-tax-rates.ts` (when built) also diffs threshold rows

## Constraints

- Offline-first: static data shipped in the bundle, no runtime fetching
- i18n decision unchanged — this is data coverage, not translation; but when
  translation triggers fire, threshold coverage must already follow locale
  additions automatically via the coverage gate

## Related

- [tax-currency-coverage-expansion](./tax-currency-coverage-expansion.md) — same gap for tax *rates* (IN-02)
- [tax-rate-refresh-script](./tax-rate-refresh-script.md) — shared refresh/verification pipeline
- Phase 41 LIFE-02 — original 4-jurisdiction tracker (D-13/D-15/D-16)
