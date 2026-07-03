# Phase 38: Foundation - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the calculator codebase so every later v2.0 phase has a clean surface to attach to: split the 1,814-LOC `CostCalculator.tsx` God-component into `useCostForm` + `useCostDerivedValues` + cohesive section components with **zero behavioral change** (FOUND-01), eliminate the pricing double-render per keystroke inside the new architecture — the deferred PERF-11, done right (FOUND-02), and move the active app tab into the URL via `useSearchParams` so browser Back/Forward navigates tabs and tab links are bookmarkable (FOUND-03).

No new user-facing features. No new cost inputs, no new tabs beyond making the existing six URL-addressable (calculator, jobs, materials, customers, reports, settings). This phase is invisible to users except that browser Back stops exiting the app.

</domain>

<decisions>
## Implementation Decisions

### Equivalence gate (FOUND-01)
- **D-01: Golden fixtures, captured BEFORE the refactor.** Feed N input scenarios to the CURRENT CostCalculator and record all outputs into fixture files. The refactored code must reproduce every fixture exactly. No side-by-side dual-render harness; the old component is deleted once the gate passes (within this phase).
- **D-02: Fixture breadth = curated + randomized.** ~15–20 hand-picked landmine scenarios (multi-material slots, marketplace fixed fees + FX conversion, failure %, VAT modes, break-even, labor/shipping) PLUS a seeded random sweep (~100 generated input combos). The seed is fixed so runs are reproducible.
- **D-03: "Output" = every user-visible number as its RENDERED string** — cost breakdown lines, suggested price, profit, margin, break-even, per-unit values. String comparison catches rounding/formatting drift, not just math drift.
- **D-04: Sequence tests are part of the gate.** userEvent-driven tests: rapid consecutive keystrokes on interlinked price/margin/profit fields and field-to-field edit chains, asserting displayed values stay consistent after every step. This is the exact PERF-11 failure mode that 819 passing tests missed — static fixtures alone are not sufficient.

### Tab-in-URL (FOUND-03)
- **D-05: Push a history entry per tab switch.** Back retraces the user's tab trail (jobs → calculator → reports…). This is the literal FOUND-03 success criterion.
- **D-06: Bare `/app` = calculator tab.** No normalization redirect; `?tab=` appears only once the user switches tabs. `/app?tab=calculator` is accepted as an alias. PWA start_url and existing bookmarks keep working untouched.
- **D-07: Unknown/invalid `?tab=` values fall back to the calculator tab AND the URL is replaced to bare `/app`** (replace, not push — no junk history entry, bad params don't survive copy/paste).
- **D-08: One code path for web and Tauri.** `useSearchParams` runs identically inside the Tauri WebView on the `/` route. No platform fork.

### Section-component layout (FOUND-01)
- **D-09: Section count is cohesion-driven, expected 4–6.** Roadmap's "~4" and research's "6" are both estimates, not contracts. The researcher/planner finalize the groupings from the actual seams (likely along: job details, materials/slots, printer & time, cost parameters, pricing, results).
- **D-10: Clean seams only — no speculative Phase 39 extension points.** No placeholder props, no empty slots for failure-rate/TOU/maintenance inputs. The cost-parameters section gets a clear, documented props contract so Phase 39 inputs join as ordinary additions. Zero-behavior-change stays literal.
- **D-11: ~150 LOC orchestrator is a SOFT target; "zero business logic in the orchestrator" is the HARD rule** (enforced in review). If honest wiring lands at 200 LOC, that passes.

### Verification & landing (FOUND-01/02)
- **D-12: Focused human UAT script (~10 min), prepared for the user:** rapid consecutive keystrokes on interlinked fields, full calculate→save→edit→resave roundtrip, tab Back/Forward + bookmark + PWA start_url check, one G-code import prefill.
- **D-13: Develop on a feature branch (e.g. `feat/v2.0-foundation`); merge to main only after equivalence gate + code review + user UAT sign-off.** Merging deploys the (invisible) refactor to the live web app — that solo rollout is intentional and is the safest possible deployment of this change. No desktop tag in this phase.
- **D-14: `react-hooks/exhaustive-deps` at ERROR level scoped to the new calculator folder** (+ its hooks). Repo-wide promotion is a later cleanup item, not this phase.
- **D-15: Automated render-count test pins the double-render fix** — pricing sections render exactly once per keystroke, asserted in CI so ex-PERF-11 can never silently regress. Plus a one-time manual React DevTools Profiler spot-check during UAT.

### Claude's Discretion
- `useReducer` vs refined `useEffect` internals for the pricing interlink inside `useCostDerivedValues` — settle in research (FOUND-02 names the useReducer/event-handler pattern as the researched direction; validate it).
- Exact fixture-capture tooling (test-renderer harness vs extracted pure snapshot function), file layout of `src/components/calculator/`, naming of section components and hooks.
- How sessionStorage form-persistence and G-code prefill wiring are carried through the split (behavior must be identical; mechanism is free).
- Migration/retirement plan for existing CostCalculator tests that assert on internals the split dissolves.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (the "researched seams" FOUND-01 refers to)
- `.planning/research/ARCHITECTURE.md` — the split design: `calculator/` folder, `useCostForm`, `useCostDerivedValues`, section sketch, tab-in-URL pattern (useSearchParams in App.tsx only, NOT nested routes)
- `.planning/research/PITFALLS.md` — C-03 (split introduces pricing desync; why output-equivalence + exhaustive-deps + human rapid-typing UAT are all mandatory) and the PERF-11 post-mortem grounding
- `.planning/research/SUMMARY.md` — Phase A scope, wave ordering, research flags (dep-array design + useReducer-vs-useEffect spike required before planning)

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — FOUND-01, FOUND-02, FOUND-03 exact wording + milestone locked decisions (output-equivalence + reconcile rule for money math)
- `.planning/ROADMAP.md` — Phase 38 goal + 4 success criteria

### Source of truth in code
- `src/components/CostCalculator.tsx` (1,814 LOC) — the component being split; every behavior here is the contract
- `src/utils/pricingInterlink.ts` — net-of-fees pricing interlink math (v1.9); the desync-prone coupling the sequence tests target
- `src/utils/costCalc.ts` — pure cost function; must remain untouched by the split
- `src/App.tsx` — current `useState<Tab>` (6 tabs) + roving-tabindex tab bar (A11Y work from v1.9 must survive the URL change)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/costCalc.ts` and `src/utils/pricingInterlink.ts`: already-pure math — the split relocates callers, never these functions
- Existing Vitest + Testing Library + fake-indexeddb setup (819 tests): fixture and sequence tests slot into the established harness
- Shared UI primitives (`src/components/ui/`): section components keep using Button/Input/Select/Card as-is

### Established Patterns
- App.tsx owns all Dexie hook subscriptions and prop-drills into feature components — the split must NOT move data subscriptions into sections (research: keep hooks at one level)
- Calculator form state persists to sessionStorage across tab switches — this behavior is part of the equivalence contract
- JobsManager decomposition (Phase 22, 2067→1474 LOC via extracted hooks/components) is the in-repo precedent for this kind of split
- v1.9 roving-tabindex tab bar + `aria-selected` semantics must be preserved when tab state moves to the URL

### Integration Points
- `src/main.tsx` routes: `/app` (web) and `/` (Tauri) both render App.tsx — `useSearchParams` works on both since BrowserRouter wraps both
- PWA start_url and service worker (vite-plugin-pwa): bare-`/app`-as-calculator decision (D-06) keeps start_url valid with zero manifest change
- Phase 39 (failure/TOU/wear inputs), Phase 40 (Insights tab slot): consume the section seams and the tab registry this phase produces

</code_context>

<specifics>
## Specific Ideas

- Back/Forward should feel like Gmail/Linear-style tab navigation — each switch is a real history entry (D-05)
- The equivalence fixtures compare RENDERED strings ("$12.47", "23.5%"), not floats — formatting drift is a regression too (D-03)
- The render-count probe exists specifically because PERF-11 was reverted for lack of a pinning test — this time the fix ships with its own regression tripwire (D-15)

</specifics>

<deferred>
## Deferred Ideas

- Repo-wide `react-hooks/exhaustive-deps` at error level — later cleanup item once the calculator folder proves the posture (D-14)
- Phase 39 extension slots in section components — explicitly rejected for this phase (D-10); Phase 39 adds its inputs as ordinary changes
- Browser-Back/tab-URL deep links to sub-state (e.g. a specific job open in Jobs tab) — only the active tab goes in the URL this phase

</deferred>

---

*Phase: 38-foundation*
*Context gathered: 2026-07-03*
