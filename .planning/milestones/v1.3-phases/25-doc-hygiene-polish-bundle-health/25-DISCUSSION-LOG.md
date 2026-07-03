# Phase 25: Doc + hygiene + polish + bundle health - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 25-doc-hygiene-polish-bundle-health
**Areas discussed:** Sequencing (gate), Plan structure / batching, HYG-01 strategy (generatingJobIds), HYG-04 strategy (onQuoteCreated), HYG-10 + PERF-06 scope footprint

---

## Sequencing (gate question — asked before gray-area selection)

ROADMAP.md says Phase 25 depends on Phases 19, 20, 21, 22, 23 complete; at time of discussion only Phases 18 + 24 are complete.

| Option | Description | Selected |
|--------|-------------|----------|
| Proceed — plan Phase 25 now | Capture decisions for the 12 v1.2 audit closures today. Replan or amend later if any of 19–23 surface new lag. | ✓ |
| Wait — discuss an earlier phase instead | Honor the roadmap dependency. Switch to Phase 19, 20, 21, 22, or 23 first. | |
| Proceed but scope down | Discuss only the items that can't gain new debt from later phases. | |

**User's choice:** Proceed — plan Phase 25 now.
**Notes:** Risk accepted. All 12 Phase 25 success criteria are scoped against already-published v1.2 audit findings and are technically independent of whatever 19–23 ship. If those phases surface new lag, it becomes a Phase 25 follow-on or v1.4 micro-sweep, not a Phase 25 amendment. Captured as D-00 in CONTEXT.md.

---

## Plan structure / batching

12 success criteria across ~8 surfaces. Need to decide how many plans and how they cluster.

| Option | Description | Selected |
|--------|-------------|----------|
| 5 plans (surface-grouped) | P1 docs (DOC-01+02, HYG-10) · P2 customer-UI (POL-01+02) · P3 JobsManager hygiene (HYG-01, HYG-04, POL-04, A11Y-09 + HYG-05) · P4 PDF (POL-03) · P5 bundle (PERF-05+06). | ✓ |
| 7 plans (1 per surface) | Same as 5-plan but splits HYG-05 and PERF-05/06 into their own plans. Maximum atomicity at higher overhead. | |
| ~3 mega-plans | Bundle by category (all docs, all polish+a11y, bundle). Less ceremony, heterogeneous PRs. | |
| 1 plan per requirement (12+ plans) | Maximum atomicity. Too much overhead for 5-min fixes. | |

**User's choice:** 5 plans, surface-grouped.
**Notes:** Single wave (all 5 plans parallel-safe — verified no file contention across plans). Atomic commits per task inside each plan. Captured as D-01 in CONTEXT.md.

---

## HYG-01 strategy (`generatingJobIds`)

`JobsManager.tsx:980` defines `generatingJobIds = useMemo(() => new Set<string>(), [])` — a frozen empty Set that exists only so call-site code (`isGeneratingPdf={generatingJobIds.has(job.id)}`) keeps compiling. Two paths in success criterion #2.

| Option | Description | Selected |
|--------|-------------|----------|
| B — delete the slot entirely | Remove `generatingJobIds`, `isGeneratingPdf` from `JobRowProps`/`JobCardProps`/`rowProps`, all call sites, the inline `useMemo` + comment. Smaller diff, kills dead UX scaffolding. | ✓ |
| A — derive at parent | Replace empty Set with `isPdfGenerating = (id) => printQuoteModalState?.job.id === id`. Wires the prop to something real (modal-open state). Adds visible feedback. | |
| Defer — wait for Phase 22 | Phase 22 decomposes JobsManager; let it land first so we don't touch the same file twice. | |

**User's choice:** Option B — delete the slot entirely.
**Notes:** PrintQuoteModal opens synchronously — no async window where a "Generating PDF" indicator would actually fire. Keeping a "real" indicator wired to modal-open is solving for a UX problem that doesn't exist. Future async PDF flow rebuilds with real data. Captured as D-02 in CONTEXT.md (plus D-02a rationale, D-02b Phase 22 collision note).

---

## HYG-04 strategy (`onQuoteCreated`)

`PrintQuoteModal.tsx:283` invokes `onQuoteCreated(quote)` with the real new Quote; `JobsManager.tsx:2085` passes a no-op with comment "could trigger a toast in a future plan." Two paths in success criterion #3.

| Option | Description | Selected |
|--------|-------------|----------|
| A — make optional + drop no-op arg | Change to `onQuoteCreated?: (quote: Quote) => void`, invocation becomes `onQuoteCreated?.(quote)`, drop the no-op call-site arg. Preserves future-toast extension point. | ✓ |
| B — remove entirely | Delete the prop, the invocation, the call-site arg. Smaller surface today. Costs: re-introduce the same prop when toast lands. | |
| C — wire the toast now | Scope creep — needs toast primitive design first. Not recommended. | |

**User's choice:** Option A — make optional + drop no-op arg.
**Notes:** The prop is invoked with real data and the future-toast intent is already documented in the existing code comment. Removing now means re-adding the same signature later. 4-character type change. Captured as D-03 in CONTEXT.md (plus D-03a rationale).

---

## HYG-10 + PERF-06 scope footprint (combined area — two questions)

### HYG-10: `ui-consistency-sweep.md` todo (30+ open subtasks)

Audit revealed the todo has 30+ unchecked subtasks across 5 sections (compact prop rollout × 5, InfoTooltip rollout × 5, features.ts dead-badge cleanup × 10+, uniform-width chunks, PrinterSettings refresh). Not a clean "close + archive" situation.

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + update in place | Audit each subtask against current code, check off what's shipped, leave the rest open. Do NOT archive — work is real. | ✓ |
| Audit + cherry-pick easy wins | Audit, then fold 1–2-line wins (dead `<NewBadge>` JSX past MAX_AGE) into Phase 25 as bonus tasks. Larger Phase 25 scope. | |
| Audit + spawn a follow-up phase | Audit only; if >50% remaining, write a "Phase 26: UI consistency sweep follow-through" proposal note. | |

**User's choice:** Audit + update in place.
**Notes:** Keeps Phase 25 scope predictable. Future polish phase consumes remaining subtasks. The todo file stays at `.planning/todos/ui-consistency-sweep.md` (NOT moved to archive). HYG-10 is "closed" by leaving the todo accurate, not by deleting/archiving. Captured as D-06 in CONTEXT.md (plus D-06a / D-06b rationale).

### PERF-06: vendor chunk classification (explicitly OPTIONAL in roadmap)

| Option | Description | Selected |
|--------|-------------|----------|
| Include + time-box (~30 min) | Plan 5 runs `npm run build` with analyzer, scans for any large vendor lib obviously safe to split. If clean win in ≤30 min, ship it. Else summarize "reviewed, no actionable splits" — satisfies "(Optional) reviewed". | ✓ |
| Always include | Force at least one vendor split. Risk: marginal change just to check the box. | |
| Defer to v1.4 | Drop PERF-06 from Phase 25. Plan 5 only does PERF-05. | |

**User's choice:** Include + time-box.
**Notes:** Success criterion #12 says "reviewed", not "delivered a size reduction" — the time-box captures any free wins without forcing the plan to do something marginal. Phase 11's perf-gate philosophy (300 KB gz main ceiling, measurable wins only) is the guardrail. Captured as D-07 in CONTEXT.md (plus D-07a / D-07b rationale).

---

## Claude's Discretion

Items where the user explicitly or implicitly left decisions to the executor (recorded in CONTEXT.md `<decisions>` "Claude's Discretion" subsection):

- **HYG-05 exact comment text** — executor decides the one-line wording, must capture (1) it was retired, (2) which phase, (3) why if recoverable
- **POL-03 file location** — separate `src/pdf/jspdf-augment.d.ts` vs. co-located inside `generateQuotePdf.ts` (recommendation: separate)
- **PERF-06 split decisions inside the 30-min time-box** — analyzer-driven, gated by Phase 11 philosophy
- **HYG-10 audit depth** — spot-check 1–2 representative components per rule, don't gate on exhaustive line-by-line audit
- **Plan 3 commit ordering** — suggested: HYG-05 → A11Y-09 → POL-04 → HYG-04 → HYG-01 (smallest to biggest diff); executor may reorder

## Deferred Ideas

Recorded in CONTEXT.md `<deferred>` section:

- HYG-04 Option C (wire actual toast) — needs toast primitive design first; v1.4+ candidate
- Full ui-consistency-sweep execution (30+ subtasks) — own future phase or v1.4 polish bucket
- Dead `<NewBadge>` JSX cleanup as Phase 25 in-scope (HYG-10 Option B) — rejected to keep scope predictable
- HYG-01 Option A (derive at parent) — rejected for D-02a reasons; escape hatch if user-testing surfaces real "I didn't know my click registered" UX bug
- Async PDF generation flow — if/when this lands, HYG-01's deleted slot needs to come back
- Phase 26 (UI consistency sweep follow-through) — HYG-10 Option C; revisit at v1.4 planning
- Splitting Plan 5 (PERF-05 vs PERF-06) — bundled because both touch `vite.config.ts` only
- jspdf / jspdf-autotable version bump — out of scope; POL-03 only does type augmentation
- Toast primitive design — recurring need (POL-02, future quote-created, error states); v1.4 backlog
