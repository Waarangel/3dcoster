---
created: 2026-05-21
title: Tax-rate refresh script — bump lastVerified per release
area: tax
resolves_phase: []
files:
  - scripts/refresh-tax-rates.ts (new)
  - src/data/taxRates.ts
---

# Tax-rate refresh script

## Why

Phase 13 introduced `lastVerified: string` on every `TaxRateEntry` row (single
constant `TAX_RATES_VERIFIED_AT` applied via shorthand `V` in
`src/data/taxRates.ts`). Without a refresh process, `TAX_RATES_VERIFIED_AT`
will drift backwards every release until the staleness gate in `isRateStale`
flips every row to "verify locally" — which is ironically the bad UX we
introduced the disambiguation to solve.

Phase 13 ships `TAX_RATES_VERIFIED_AT = '2026-05-21'`. With the 18-month
staleness threshold (`isRateStale`), rates start showing the stale warning
around **2027-11-21** if we never refresh.

## What

A maintainer script — `scripts/refresh-tax-rates.ts` — that:

1. Pulls authoritative source data (suggested order):
   - Tax Foundation "VAT Rates in Europe" page (HTML scrape acceptable)
   - EU Commission TEDB (XML feed)
   - HMRC / ato.gov.au / canada.ca for non-EU rows
2. Diffs each row's `rate` and `rateAsOf` against the live table
3. If any row changed → flag for human review (we don't auto-merge tax data)
4. Always → bump `TAX_RATES_VERIFIED_AT` to today's date when human approves
5. Writes the regenerated `taxRates.ts` (preserves the const ordering,
   `V` shorthand, and the locked `US_MARKETPLACE_FACILITATOR_NOTE`)

## Acceptance

- [ ] Script lives in `scripts/refresh-tax-rates.ts`
- [ ] Idempotent — running with no source changes only bumps `TAX_RATES_VERIFIED_AT`
- [ ] Has a `--dry-run` mode that prints the diff without writing
- [ ] Documented in CLAUDE.md / RELEASE.md as a pre-release chore
- [ ] First run after creation: re-verifies every existing row against source

## Constraints

- **No runtime network dependency.** The script runs at maintainer time and
  produces a static `taxRates.ts` commit. The app stays offline-first.
- **Locked `US_MARKETPLACE_FACILITATOR_NOTE` must be preserved verbatim.**
  WR-03 made it a single exported constant; if the script regenerates the
  USD row it must use that constant by name, not inline the string.
- **`Currency` union changes are out of scope** — that's a separate todo
  (`tax-currency-coverage-expansion.md`).

## Related

- [tax-currency-coverage-expansion](./tax-currency-coverage-expansion.md) — fills the IN-02 gap (9 currencies fall to "manual")
- Phase 13 verification report — `.planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md`
- Code review IN-01 — 22 unreachable EUR reference rows could be wired up by this refresh
