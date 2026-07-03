# Phase 38: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 38-foundation
**Areas discussed:** Equivalence-gate design, Tab-URL semantics, Section-component layout, Verification & landing

---

## Equivalence-gate design

| Option | Description | Selected |
|--------|-------------|----------|
| Golden fixtures | Capture N input scenarios → all displayed numbers from the CURRENT calculator into fixtures BEFORE refactoring; new code must reproduce every fixture exactly | ✓ |
| Side-by-side dual render | Keep old component alive; harness diffs old vs new live | |
| Both | Fixtures + temporary side-by-side harness | |

| Option | Description | Selected |
|--------|-------------|----------|
| Curated + randomized | ~15–20 hand-picked landmine scenarios + seeded random sweep (~100 combos) | ✓ |
| Curated only (~15–20) | Hand-picked edge cases only | |
| Exhaustive matrix | Cross-product of all input dimensions | |

| Option | Description | Selected |
|--------|-------------|----------|
| All displayed numbers | Every user-visible numeric result as rendered strings (catches rounding/formatting drift) | ✓ |
| Core pricing values only | Total cost, price, profit, margin as raw numbers | |
| Full DOM snapshot | Entire rendered output — drowns in false positives since DOM intentionally changes | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, sequence tests | userEvent rapid-keystroke + field-to-field edit chains asserting consistency after every step (the PERF-11 failure mode) | ✓ |
| Static fixtures only | Input→output states only | |

**User's choice:** All recommended options.
**Notes:** Sequence tests explicitly motivated by PERF-11: 819 passing tests missed the stale-closure desync.

---

## Tab-URL semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Push per switch | Each tab click adds a history entry — Back retraces the tab trail (FOUND-03 criterion) | ✓ |
| Replace, single entry | URL updates but Back exits /app | |

| Option | Description | Selected |
|--------|-------------|----------|
| Bare /app = calculator | ?tab= appears only after switching; /app?tab=calculator accepted as alias; PWA start_url untouched | ✓ |
| Always normalize to ?tab=calculator | Redirect on every cold start | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback + clean URL | Unknown ?tab= shows calculator and replaces URL to bare /app (no history entry) | ✓ |
| Fallback, keep URL as-is | Broken param survives copy/paste | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same code path | useSearchParams identically in web + Tauri WebView; no platform fork | ✓ |
| Desktop keeps useState | Web-only URL state | |
| You decide | Researcher verifies WebView history behavior | |

**User's choice:** All recommended options.

---

## Section-component layout

| Option | Description | Selected |
|--------|-------------|----------|
| Cohesion-driven, 4–6 | Count falls out of actual seams; researcher/planner finalize; "~4" and "6" are estimates | ✓ |
| Hold to ~4 coarse sections | Fewer, bigger files | |
| Follow research's 6 exactly | Pre-commit before seam analysis | |

| Option | Description | Selected |
|--------|-------------|----------|
| Clean seams only | No speculative slots/props for Phase 39; documented props contract on cost-parameters section | ✓ |
| Reserve explicit extension points | Typed extension props now for Phase 39's known inputs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Soft target | ≈150 LOC is design intent; HARD rule is zero business logic in orchestrator (review-enforced) | ✓ |
| Hard gate | Fail phase if orchestrator > 150 LOC | |

**User's choice:** All recommended options.

---

## Verification & landing

| Option | Description | Selected |
|--------|-------------|----------|
| Focused UAT script | ~10-min checklist: rapid keystrokes on interlinked fields, calculate→save→edit→resave roundtrip, tab Back/Forward + bookmark + PWA start_url, G-code prefill | ✓ |
| Rapid-typing test only | Just the mandated desync check | |
| Full calculator UAT | v1.9-style comprehensive pass (~30–45 min) | |

| Option | Description | Selected |
|--------|-------------|----------|
| Branch → main after UAT | feat/v2.0-foundation; merge after equivalence gate + review + UAT sign-off; solo web deploy of the invisible refactor is intentional | ✓ |
| Stay on branch until Phase 39–40 join | Long-lived branch rot risk | |
| Work directly on main | Every intermediate state auto-deploys | |

| Option | Description | Selected |
|--------|-------------|----------|
| Calculator folder only | exhaustive-deps at error level scoped to new calculator/ (+hooks); repo-wide is later cleanup | ✓ |
| Repo-wide error | Legacy warnings become build failures in an unrelated phase | |

| Option | Description | Selected |
|--------|-------------|----------|
| Automated render-count test | CI asserts pricing sections render once per keystroke + one-time manual Profiler spot-check in UAT | ✓ |
| Manual profiler check only | No regression protection | |

**User's choice:** All recommended options.
**Notes:** User was reminded pushing to main auto-deploys the web app (deploy guard gates it); chose branch-then-merge deliberately.

---

## Claude's Discretion

- useReducer vs refined useEffect internals for the pricing interlink inside useCostDerivedValues (settle in research)
- Fixture-capture tooling, calculator/ file layout, section/hook naming
- sessionStorage form-persistence and G-code prefill wiring through the split (behavior identical, mechanism free)
- Migration/retirement of existing CostCalculator tests that assert on dissolved internals

## Deferred Ideas

- Repo-wide exhaustive-deps error promotion — later cleanup
- Phase 39 extension slots in sections — rejected for this phase (YAGNI)
- Tab-URL deep links to sub-state (e.g. specific job) — only the active tab this phase
