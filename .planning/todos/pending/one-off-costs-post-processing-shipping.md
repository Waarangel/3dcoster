---
created: 2026-10-18
source: Founder note (2026-10-18)
area: calculator — Post-Processing Materials + Shipping
---

# Manual one-off cost entry for Post-Processing materials & Shipping, with "save to asset library?" prompt

**Problem:** Post-Processing Materials and Shipping only let the user pick items
already in the asset library. There is no way to add an ad-hoc, one-off cost.

**Example:** User buys an auger for $200. A 3D-printed product needs that auger.
They want to add it to the job as a one-off cost but currently cannot.

**Ask:**
1. In both the Post-Processing Materials list and Shipping, allow a manual
   entry (name + cost) alongside the library picker — a one-off line item that
   is not linked to a library asset.
2. On **Save Job**, if the job contains manual one-off items, show a popup
   asking whether each should be added to the asset library (per-item
   accept/skip, so a one-time purchase can stay one-off).

**Design notes to resolve when planned:**
- Persist manual lines on the job snapshot (name + cost) so reports/quotes/PDFs
  still reconcile; don't depend on a library row existing.
- Cost semantics: is the $200 charged in full to this job, or amortized across
  expected uses? (Needs founder decision — one-off vs. reusable tool.)
- Respect the free-floor/Pro-ceiling model and web+desktop parity; use the
  shared `useToast` / modal components, `compact` currency inputs, 2dp display.
- Dexie schema change → ship a reconcile helper if any derived field is touched.
