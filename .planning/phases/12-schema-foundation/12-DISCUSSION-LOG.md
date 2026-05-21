# Phase 12: Schema Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 12-schema-foundation
**Areas discussed:** Per-job quote number, JobCustomer type shape, Tags index strategy, versionchange UX

---

## Per-job quote number

| Option | Description | Selected |
|--------|-------------|----------|
| Store on job at PDF time | Add `quoteNumber?: number` to PrintJob. First PDF generation reads `UserProfile.nextQuoteNumber`, assigns to `job.quoteNumber`, then increments the counter. Regenerating reuses the stored number. | ✓ |
| Don't store — read counter each PDF | No quoteNumber field on jobs. Each PDF generation reads + increments the counter, so the same job gets a different number on every regenerate. | |
| Store on every saved job | Assign quoteNumber at save time. Every job has a number from day one; bloats jobs that never become quotes; migration must backfill. | |

**User's choice:** Store on job at PDF time
**Notes:** Adds `quoteNumber?: number` to PrintJob beyond the SCHEMA-01 explicit field list. CONTEXT.md D-07 flags this as a deliberate extension; plan-phase will call it out in PLAN.md.

---

## JobCustomer type shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single freeform string | `address?: string` — multi-line textarea. Casual seller use case, PDF prints verbatim, zero parsing complexity. | ✓ |
| Structured object mirroring UserProfile | `address?: { street?, city?, province?, postalCode?, country? }`. Cleaner for future CRM but casual sellers leave most fields blank. | |
| Hybrid — both | Freeform line + optional structured fields. Most flexible but adds UI complexity to a deliberately minimal Customer section. | |

**User's choice:** Single freeform string
**Notes:** Final type: `JobCustomer = { name?: string; email?: string; address?: string; company?: string }`. All fields optional. Future CRM milestone (CUST-F1) can introduce structured addresses without breaking the wire format if needed (parse-on-read).

---

## Tags index strategy

| Option | Description | Selected |
|--------|-------------|----------|
| No index — filter in memory | Schema string stays `'id, name, createdAt, printerInstanceId'`. Phase 15 uses `Array.filter`. <1ms at 10–500 jobs. | ✓ |
| Add multi-entry index `*tags` | Schema becomes `'id, name, createdAt, printerInstanceId, *tags'`. Enables `db.jobs.where('tags').equals(tag)`. Future-proof past 5000 jobs but adds reindex-on-migration risk. | |

**User's choice:** No index — filter in memory
**Notes:** Aligned with the hobbyist-seller scale assumption baked into the v1.2 milestone. Deferred per D-04; can be revisited if telemetry shows users with very large job libraries.

---

## versionchange UX

| Option | Description | Selected |
|--------|-------------|----------|
| Plain reload | `db.on('versionchange', () => window.location.reload())` verbatim from SCHEMA-02. No toast, no delay. Tab visibly reloads. | ✓ |
| Brief notice, then reload | 1–2s "Database updated — reloading…" toast before reload. More polished but couples UI to DB layer and risks a setTimeout race during navigation. | |
| Block writes, then reload on user action | Show "App was updated in another tab. Reload now." button. Friendliest but stale tab can stay open indefinitely, violating the spec's safety premise. | |

**User's choice:** Plain reload
**Notes:** Matches Dexie's official recommendation. The reload itself IS the signal — no extra UI primitive needed.

---

## Claude's Discretion

- Exact comment style in `database.ts` (match v5 block's terseness)
- Order of new fields within the `PrintJob` interface (planner groups semantically: customer near `name`, tax near `sellingPrice`, quoteNumber near the bottom)
- Whether `JobCustomer` interface sits above `PrintJob` or inline near it
- Whether to add a one-line comment explaining the `versionchange` handler — bias toward yes

## Deferred Ideas

- **`*tags` multi-entry index** — deferred to a future "scale" milestone if user job counts grow past 5000
- **Structured customer address** — could reopen alongside the future Customer Database / CRM tab milestone (CUST-F1)
- **`versionchange` UX polish (toast or block-then-reload)** — could revisit if support tickets reveal user confusion
- **Index on `customer.email`** — no current query pattern requires it; defer to the eventual CRM milestone if it lands
- **Type-level email validation** — runtime validation belongs in Phase 14's form, not the type
