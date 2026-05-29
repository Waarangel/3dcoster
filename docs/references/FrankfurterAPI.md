# Currency Exchange Rate APIs

Validated 2026-05-29 for the one-time USD→user-currency conversion of the
built-in (Bambu) filament seeds. Both providers are **keyless, free, and
CORS-enabled**, so they work from the browser with no backend (3DCoster has no
server). Client: `src/utils/fxRates.ts` (`fetchUsdRate`).

## Why two providers + a mirror

`fetchUsdRate` tries them in order and returns the first valid rate, or `null`
if all fail. A `null` means **defer** — do not invent a rate (project rule: no
arbitrary numbers). The conversion retries on the next online launch.

1. **frankfurter.dev** — primary. ECB reference rates. Clean, fast, stable.
2. **fawazahmed0 currency-api (jsDelivr CDN)** — fallback. Covers currencies
   ECB/frankfurter may omit and rides jsDelivr's CDN uptime.
3. **fawazahmed0 currency-api (Cloudflare Pages mirror)** — last resort, same
   data as #2 on a different CDN.

---

## 1. Frankfurter (primary)

**Endpoint** (USD base, one symbol):

```
GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=CAD
```

**Response:**

```json
{
  "amount": 1.0,
  "base": "USD",
  "date": "2026-05-28",
  "rates": { "CAD": 1.3854 }
}
```

- `rates[<TARGET>]` — units of target per 1 USD. **Uppercase** ISO codes.
- `date` — publish date (ECB business day; weekends return Friday's rate).
- Multiple symbols: comma-separate, e.g. `symbols=CAD,EUR,GBP`.

---

## 2. fawazahmed0 currency-api (fallback + mirror)

**Endpoints** (USD base, all currencies in one file):

```
GET https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json   # jsDelivr
GET https://latest.currency-api.pages.dev/v1/currencies/usd.json                            # Cloudflare mirror
```

**Response:**

```json
{
  "date": "2026-05-28",
  "usd": { "cad": 1.38674016, "eur": 0.92, "gbp": 0.79 }
}
```

- `usd[<target>]` — units of target per 1 USD. **Lowercase** ISO codes
  (`fetchUsdRate` lowercases the target before lookup).
- `date` — publish date.
- Returns ALL currencies in one payload (no per-symbol query).

---

## Gotchas

- **Code case differs:** frankfurter = UPPERCASE keys; fawazahmed0 = lowercase.
  `fetchUsdRate` handles both.
- **USD→USD is identity** (`rate: 1`); `fetchUsdRate('USD')` short-circuits with
  no network call.
- **Validate the rate:** only accept a finite number `> 0`. A missing/garbage
  field falls through to the next provider, then to `null`.
- **Timeout:** each request is capped at 6s (`AbortController`) so a hung socket
  can't stall the "deferred" decision on a flaky network.
- **No estimate, ever:** all-providers-fail → `null` → caller defers and retries.
