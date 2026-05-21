---
created: 2026-05-21
title: Expand TAX_RATES currency coverage — fill the IN-02 gap
area: tax
resolves_phase: []
files:
  - src/data/taxRates.ts
  - src/utils/taxResolution.test.ts
  - src/types.ts (potentially — if Currency union grows)
---

# Expand TAX_RATES currency coverage

## Why

Phase 13 code review IN-02: 9 supported currencies fall through to
`kind: 'manual'` because `TAX_RATES` doesn't cover them. The `Currency` union
in `src/types.ts:12-30` declares **17 currencies**, but `TAX_RATES` provides
currency-keyed coverage for only 8 (USD, GBP, AUD, CAD, CZK, DKK, PLN, SEK)
plus the EUR-average branch.

Currencies that currently fall to "manual" despite having well-defined
national VAT/GST rates:

| Currency | Country | Rate | Source |
|----------|---------|------|--------|
| NZD | New Zealand | 15% GST | ird.govt.nz |
| CHF | Switzerland | 8.1% VAT (from 2024-01-01) | estv.admin.ch |
| NOK | Norway | 25% MVA | skatteetaten.no |
| JPY | Japan | 10% consumption tax | nta.go.jp |
| INR | India | 18% GST (default category) | gst.gov.in |
| BRL | Brazil | varies (~17% ICMS) | gov.br/receitafederal — **complex, may need to stay manual** |
| MXN | Mexico | 16% IVA | sat.gob.mx |
| CNY | China | 13% VAT | chinatax.gov.cn — **complex, may need to stay manual** |
| ZAR | South Africa | 15% VAT | sars.gov.za |

A user in any of these currencies sees "Unknown region — enter manually" even
though we could ship a sensible default.

## What

For each currency where a single national rate makes sense (NZD/CHF/NOK/JPY/INR/MXN/ZAR — 7 rows), add a `TaxRateEntry` row to `TAX_RATES`:

```ts
{ currency: 'NZD', region: 'NZ', label: 'New Zealand', rate: 15, rateAsOf: '2010-10-01', lastVerified: V },
{ currency: 'CHF', region: 'CH', label: 'Switzerland', rate: 8.1, rateAsOf: '2024-01-01', lastVerified: V },
// ... etc
```

For BRL and CNY (federal/state mix or complex schedule), leave as "manual"
and document the reason inline so future maintainers don't add a wrong rate.

## Acceptance

- [ ] 7 new `TaxRateEntry` rows added (NZD, CHF, NOK, JPY, INR, MXN, ZAR)
- [ ] Each row's `rate` + `rateAsOf` cited in PR description against the
      authoritative gov source
- [ ] BRL and CNY documented as intentionally manual in `taxRates.ts` comment
- [ ] New unit tests in `taxResolution.test.ts` for each new currency branch
- [ ] `IN-02` from `.planning/phases/13-tax-model-ui-sweep/13-REVIEW.md`
      referenced + marked resolved

## Constraints

- Pair with [tax-rate-refresh-script](./tax-rate-refresh-script.md) — if the
  refresh script lands first, this is a one-time data extension that the
  script then maintains.
- **Do NOT add currencies to the `Currency` union here.** All 7 candidates
  are already in the union (`src/types.ts`); this todo only fills missing
  data rows for currencies the app already supports.

## Related

- Code review finding `IN-02` — `.planning/phases/13-tax-model-ui-sweep/13-REVIEW.md:308`
- [tax-rate-refresh-script](./tax-rate-refresh-script.md)
