# Roadmap: 3DCoster

## Milestones

- ✅ **v1.0 Multi-Material Support** — Phases 1–6 (shipped 2026-04-15) — pre-GSD-archive; phase artifacts remain under `.planning/phases/01-06`
- ✅ **v1.1 Polish & Foundation** — Phases 7–11 (shipped 2026-05-20) — pre-GSD-archive; phase artifacts remain under `.planning/phases/07-11`
- ✅ **v1.2 Quote-to-Customer** — Phases 12–17 (shipped 2026-05-25) — [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- 📋 **v1.3** — not yet defined; will be scoped via `/gsd:new-milestone` after v1.2 customer-facing usage feedback

## Phases

<details>
<summary>✅ v1.2 Quote-to-Customer (Phases 12–17) — SHIPPED 2026-05-25</summary>

- [x] Phase 12: Schema Foundation (4/4 plans) — completed 2026-05-21
- [x] Phase 13: Tax Model + UI Sweep (6/6 plans) — completed 2026-05-21
- [x] Phase 14: Customer Details + Etsy Helper (4/4 plans) — completed 2026-05-22
- [x] Phase 15: Tags, Search + Quick Duplicate (12/12 plans) — completed 2026-05-25
- [x] Phase 15.1: Customer Library (5/5 plans, INSERTED) — completed 2026-05-22
- [x] Phase 16: Printable PDF Quote (12/12 plans) — completed 2026-05-23
- [x] Phase 17: Close gap PDF-04 + tax rounding + v1.2 doc housekeeping (2/2 plans, INSERTED) — completed 2026-05-25

Full detail: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · Audit: [milestones/v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)

</details>

### 📋 v1.3 (Planned — not yet defined)

Run `/gsd:new-milestone` to define v1.3 scope. Carry-over candidates from v1.2 tech debt include:

- Run `/gsd:validate-phase` for 4 missing/draft Nyquist contracts (13, 15, 15.1, 17)
- DUP-01 row-action UI (deferred from v1.2 — needs richer surface)
- Tag color options
- Customer CSV importer template-download button
- Customer Library row layout fix (vertical centering)
- Rollup vendor / react-vendor circular-chunk warning
- Phase 13 visual-contract UAT items (8 deferred)

## Progress

| Phase                                | Milestone | Plans Complete | Status   | Completed  |
| ------------------------------------ | --------- | -------------- | -------- | ---------- |
| 1. Data Foundation                   | v1.0      | 1/1            | Complete | 2026-04-15 |
| 2. G-code Parser                     | v1.0      | 1/1            | Complete | 2026-04-15 |
| 3. Calculator UI Import              | v1.0      | 3/3            | Complete | 2026-04-15 |
| 4. Jobs Display                      | v1.0      | 1/1            | Complete | 2026-04-15 |
| 5. Printer Maintenance Alerts        | v1.0      | 1/1            | Complete | 2026-04-15 |
| 6. 3MF Multi-Plate Project Import    | v1.0      | 2/2            | Complete | 2026-04-15 |
| 7. Styling Primitives Pass           | v1.1      | 3/3            | Complete | 2026-05-20 |
| 8. Empty States with CTAs            | v1.1      | 2/2            | Complete | 2026-05-20 |
| 9. Skeleton Loading States           | v1.1      | 2/2            | Complete | 2026-05-20 |
| 10. Cost Calculation Unit Tests      | v1.1      | 4/4            | Complete | 2026-05-20 |
| 11. Performance Optimization         | v1.1      | 5/5            | Complete | 2026-05-20 |
| 12. Schema Foundation                | v1.2      | 4/4            | Complete | 2026-05-21 |
| 13. Tax Model + UI Sweep             | v1.2      | 6/6            | Complete | 2026-05-21 |
| 14. Customer Details + Etsy Helper   | v1.2      | 4/4            | Complete | 2026-05-22 |
| 15. Tags, Search + Quick Duplicate   | v1.2      | 12/12          | Complete | 2026-05-25 |
| 15.1. Customer Library (INSERTED)    | v1.2      | 5/5            | Complete | 2026-05-22 |
| 16. Printable PDF Quote              | v1.2      | 12/12          | Complete | 2026-05-23 |
| 17. Close gap PDF-04 (INSERTED)      | v1.2      | 2/2            | Complete | 2026-05-25 |

---

*Roadmap collapsed: 2026-05-25 after v1.2 milestone close.*
*v1.0 and v1.1 entries are summary-only — those milestones predate `/gsd:complete-milestone` on this project; their phase artifacts are intact under `.planning/phases/`.*
