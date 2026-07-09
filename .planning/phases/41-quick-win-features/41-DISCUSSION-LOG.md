# Phase 41: Quick-Win Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 41-quick-win-features
**Areas discussed:** Reprice alert mechanics, Quote Variants shape, Spool data model, Tax tracker surface

---

## Reprice alert mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Material price save only | Scan fires in Asset Library save handler; deterministic, zero noise; FX deferred | ✓ |
| Price save + FX check on app open | Full CONN-01 wording; needs stored rate snapshot to diff | |
| You decide | Claude picks at planning | |

**User's choice:** Material price save only (Recommended)
**Notes:** FX-drift scan noted as scope refinement vs CONN-01's "or FX rate changes" wording; captured as deferred idea.

| Option | Description | Selected |
|--------|-------------|----------|
| Global default margin | Reuse UserProfile.defaultProfitMargin as single threshold | ✓ |
| Global + per-material override | Per-material alert threshold field, falls back to global | |
| Job's own saved margin | Flag jobs whose margin dropped vs when saved (no threshold concept) | |

**User's choice:** Global default margin (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Toast → review modal | Toast on save opens shared-Modal list with old → new margin per job | ✓ |
| Toast → filtered JobsManager | Deep-link to Jobs tab pre-filtered to affected jobs | |
| Persistent badge + panel | Badge counter persisting until reviewed, backed by stored alert record | |

**User's choice:** Toast → review modal (Recommended)
**Notes:** Modal must be re-openable after toast dismissal (mechanism = planner discretion).

| Option | Description | Selected |
|--------|-------------|----------|
| Per-job reprice Apply | Suggested price to restore margin with explicit per-job Apply; no bulk | ✓ |
| Per-job Apply + bulk "reprice all" | Adds one-click apply-to-all | |
| View-only list | Names affected jobs only; user edits manually | |

**User's choice:** Per-job reprice Apply (Recommended)

---

## Quote Variants shape

| Option | Description | Selected |
|--------|-------------|----------|
| Editable, default 1/10/50 | Three quantity fields pre-filled with roadmap defaults | ✓ |
| Fixed 1/10/50 | Roadmap-literal, zero configuration | |
| Editable count AND quantities | 2–5 tiers, any quantities | |

**User's choice:** Editable, default 1/10/50 (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tier discount % | Unit price = saved price × (1 − discount%); user-entered, remembered defaults | ✓ |
| Cost amortization at quantity | Recompute true cost at qty N through pure cost math; real money-math change | |
| Same unit price, just totals | Every tier same unit price × quantity | |

**User's choice:** Per-tier discount % (Recommended)
**Notes:** Deliberately avoids C-03 pricing-desync risk and new equivalence-test obligations.

| Option | Description | Selected |
|--------|-------------|----------|
| Section in PrintQuoteModal | "Quantity variants" toggle/section inside existing quote modal | ✓ |
| Separate "Variants" action | Distinct action + own modal | |
| You decide | Claude picks at planning | |

**User's choice:** Section in PrintQuoteModal (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Quote record + tier picker on convert | Optional by-value variants snapshot; Convert-to-Sale asks which tier | ✓ |
| Quote record, convert = base tier | Variants stored, conversion always uses base price | |
| PDF-only, no variant persistence | Variants exist only in generated PDF | |

**User's choice:** Quote record + tier picker on convert (Recommended)

---

## Spool data model

| Option | Description | Selected |
|--------|-------------|----------|
| Asset = active spool | Bolt openedAt/location/drying log onto material Asset; zero new stores | ✓ |
| Lightweight spools store | New Dexie store, rows link to assetId, lifecycle only | |
| Full spool inventory | Spools own remaining weight; overlaps v1.8 stockEvents | |

**User's choice:** Asset = active spool (Recommended)
**Notes:** Accepted gap — can't track two open spools of one material; lightweight store deferred as upgrade path.

| Option | Description | Selected |
|--------|-------------|----------|
| Date-only log, resets clock | "Dried on [date]"; risk counts from max(openedAt, last dried) | ✓ |
| Date + duration + method, resets clock | Richer entries, same reset semantics | |
| Log only, no clock effect | Risk always counts from openedAt | |

**User's choice:** Date-only log, resets clock (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto from filamentType + override | Phase 39 isAbrasive D-13 pattern | ✓ |
| Auto only, no override | Pure derivation | |
| Manual per material | User assigns class | |

**User's choice:** Auto from filamentType + override (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Badge on card + edit-modal section | Risk badge on filament card; fields in material edit modal; one-tap log drying on card | ✓ |
| Dedicated lifecycle drill-in | Separate per-material lifecycle panel | |
| You decide | Claude arranges at planning | |

**User's choice:** Badge on card + edit-modal section (Recommended)

---

## Tax tracker surface

| Option | Description | Selected |
|--------|-------------|----------|
| Insights tab | Threshold card in Phase 40 Insights tab; jurisdiction in Settings | ✓ |
| Reports tab | Alongside sales-report tooling | |
| Settings only | Progress bar next to jurisdiction picker | |

**User's choice:** Insights tab (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Jurisdiction-aware tax year | UK Apr 6 / AU Jul 1 / US-DE Jan 1 lookup table | ✓ |
| Calendar year everywhere | Jan 1 for everyone; wrong for UK/AU | |
| User-set year start month | Settings field for year start | |

**User's choice:** Jurisdiction-aware tax year (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Gross sale revenue | Sum of Sale.totalRevenue in home currency; matches legal definitions | ✓ |
| Net of marketplace fees | Consistent with v1.9 profit treatment but understates progress | |
| Show both | Gross drives bar, net as secondary context | |

**User's choice:** Gross sale revenue (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Roadmap 4 + custom "Other" | UK/DE/AU/US + user-entered threshold amount + label | ✓ |
| Roadmap 4 only | Everyone else sees "not supported" | |
| Roadmap 4 + Canada + Other | Adds CAD 30k / 4 rolling quarters | |

**User's choice:** Roadmap 4 + custom "Other" (Recommended)

---

## Claude's Discretion

- Reprice review modal re-open mechanism and affected-jobs state between sessions
- Multi-material job treatment in the reprice scan display
- Variants PDF tier-table layout; discount-default persistence location
- "New spool" reset affordance; risk-badge visuals; whether non-filament categories get lifecycle fields
- Tax crossing-alert once-only semantics
- NEW-badge placement for four features (avoid badge spam)
- Dexie schema field details + version bump number

## Deferred Ideas

- FX-rate-drift reprice scan (needs stored rate snapshot)
- Per-material alert threshold override
- Bulk "reprice all"
- Price history sparkline on material cards
- Multi-spool tracking (lightweight spools store)
- Drying method/duration fields
- Link failed prints to "suspected wet filament"
- Last-used date + stale-stock alert
- Canada jurisdiction (rolling-quarters math)
- Multi-year revenue trend for US 3-of-5-years rule
