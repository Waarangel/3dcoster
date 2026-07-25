# Etsy Open API v3 — Phase 48 reference

Validated 2026-07-25 (founder on the developer dashboard + docs research).
Feeds the Phase 48 (live Etsy order sync) research spike and planning.

## App types & access ladder (developer dashboard, 2026 model)

| Type | Who can authorize | Approval | Use for us |
|------|-------------------|----------|------------|
| **Seller app** | Your own shop ONLY | Minutes, no manual review queue | Dev/test keys against the founder's real shop while reviews run |
| **Personal app** | Other buyers/sellers at **limited scale** | Manual review (deeper) | The Phase 48 gate — submit FIRST, it's step 1 of the ladder |
| **Commercial access** | Other sellers at broad scale | Requested ON an approved personal app; slowest review | Needed before Pro launch to all users — request as soon as the personal app is approved |

Key rule: **Commercial Access is not a separate app** — it's an upgrade
requested on an already-approved Personal app. So the critical path is
personal-app approval → commercial request. Register early; both reviews are
external lead time (same class of gate as Intuit for Phase 50).

**Registration strategy (advised 2026-07-25):** submit the Personal app now
AND create a Seller app the same day — the seller app's instant keys unblock
all Phase 48 development against the founder's own shop.

### Registration form notes
- App name must NOT lead with "Etsy" (trademark policy). e.g. "3DCoster order import".
- Use-case copy that reviews well (read-only, own-data-only, no resale):
  "Read-only import of a seller's own recent orders/receipts into a
  local-first 3D-printing cost calculator, so sellers can reconcile real Etsy
  sales against their true production costs. Data is stored on the seller's
  own device; no Etsy data is resold, aggregated across sellers, or shared
  with third parties."
- OAuth redirect: `https://3dcoster.com/...` (exact callback path pinned at
  Phase 48 planning; redirect URIs are editable later; add localhost for dev).

## What the API does and does NOT expose

**NO fee-schedule / rate-card endpoint exists** at any access tier. Etsy's
published percentages (6.5% transaction, $0.20 listing, processing rates) are
policy pages, not API resources. The calculator's free channel presets remain
the source for *estimates* and are maintained manually.

**What we get instead — the ACTUALS (this is the Phase 48 value):**

| Endpoint | Scope | Gives us |
|----------|-------|----------|
| `getShopReceipts` / `getShopReceipt` | `transactions_r` | The seller's real orders: items, totals, shipping charged, tax (the "90-day order import") |
| `getShopPaymentAccountLedgerEntries` | `transactions_r` | Every debit Etsy actually took: transaction fees, processing fees, **offsite-ads fees**, shipping labels, refunds |
| Payments endpoints (see Payments tutorial) | `transactions_r` | Payment details post-fulfillment incl. fees/shipping/taxes |

**Product angle (cost-truth):** reconcile each imported sale against the fees
Etsy ACTUALLY charged — estimated fees (channel presets) vs. real fees
(ledger), per sale. Offsite-ads fees are the one sellers forget to price in;
the ledger surfaces them. This beats any rate table and no competitor preset
can match it.

**Not Etsy's department:** live shipping/carrier rates = Phase 49 via the
EasyPost/Shippo-class aggregator, a separate account/registration.

## Sources
- https://developers.etsy.com/documentation/tutorials/payments/ (scopes + ledger)
- https://www.etsy.com/developers/documentation/reference/paymentaccountledgerentry
- https://help.etsy.com/hc/en-us/articles/41918478450967-How-to-Register-a-Seller-App-with-Etsy-s-API
- https://github.com/etsy/open-api/discussions/1205 (fee-fields discussion)
