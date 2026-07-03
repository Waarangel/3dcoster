# Phase 7: Styling Primitives Pass - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace raw `<button>`, `<input>`, `<select>`, and `<textarea>` JSX elements in **all 14 main app components** with shared primitives from `src/components/ui/` (Button, ButtonLink, Input, Select, Textarea, Card), and install a CI/pre-commit guard that prevents new raw form elements from being introduced into main app components.

This is internal foundation work — no user-visible new features, no NEW badge required. The phase exists to give every subsequent free-tier milestone (v1.2 Quote-to-Customer through v1.6) a consistent component foundation so per-feature styling decisions aren't re-litigated.

**In scope (14 main app components):**
- `src/components/CostCalculator.tsx` (32 raw elements)
- `src/components/SettingsModal.tsx` (44 raw elements)
- `src/components/PrinterSettings.tsx` (18 raw elements)
- `src/components/JobsManager.tsx` (13 raw elements)
- `src/components/AssetLibrary.tsx`
- `src/components/GcodeImport.tsx`
- `src/components/BambuImport.tsx`
- `src/components/CsvImportModal.tsx`
- `src/components/MaintenanceAlertModal.tsx`
- `src/components/UserProfileModal.tsx`
- `src/components/UpdateBanner.tsx`
- `src/components/FilamentSelector.tsx`
- `src/components/Header.tsx`
- `src/components/ImageCarousel.tsx`

**Out of scope:**
- Marketing pages (`src/pages/FAQPage.tsx`, `src/pages/FeedbackPage.tsx`, `src/pages/LandingPage.tsx`, etc.) — content-heavy, intentionally styled differently; deferred to a separate marketing redesign milestone
- `src/components/ui/*` — primitive implementations themselves (they use the underlying raw HTML by definition)
- Adding new primitive variants speculatively — only add a variant if a real use case in the 14 components demands it
- Full design-system token pass (typography scale, animation, elevation tokens) — separate later milestone

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** Expand scope from the audit's 3 components to all 14 main app components. Reason: every subsequent free-tier milestone touches some of these; foundation-first compounds, foundation-last creates rework debt. Stopping at 3 would leave SettingsModal (44 raw elements!) and 10 others as future debt.

### Marketing pages
- **D-02:** Marketing pages (`src/pages/`) are explicitly OUT of scope. They are content-heavy and intentionally styled differently from the calculator app. A future "marketing redesign" milestone will address them with their own design language.

### Lint guard mechanism (UI-03)
- **D-03:** Use a grep-based check, not a custom ESLint rule. Implementation: an `npm run lint:no-raw-html` script and a pre-commit hook (or CI step) that greps for `<button|<input|<select|<textarea` in `src/components/` (excluding `src/components/ui/`) and `src/pages/` (excluding marketing pages). Non-zero exit on match.
- **D-04:** Provide an opt-out comment marker `// allow-raw-html` on the line above any intentionally-raw element (for edge cases the primitive doesn't cover). Marker is grep-aware — matched lines are excluded from the violation count.
- **D-05:** Hook the check into both `pre-commit` and `npm run build` so it fails locally AND in CI. A separate `npm run lint:no-raw-html` script lets developers check on demand.

### Visual / behavior fidelity bar
- **D-06:** Accept primitive defaults over preservation. The whole purpose of the milestone is consistency; some visible change (focus rings, padding, sizes) IS the goal. The audit literally identified the inconsistency as the problem — this fix is the resolution, not a regression.
- **D-07:** Only add new variants/sizes to primitives if a real use case in the 14 components demands it (e.g., if a button needs a size that's not `sm`/`md`/`lg`, add it; don't speculatively widen the API).
- **D-08:** All replaced elements must preserve **behavior**: variant, disabled state, type coercion, validation, `onChange`/`onClick` handlers. Visual change is acceptable; behavioral change is not.

### Claude's Discretion
- Order of file refactoring (which of the 14 to do first) — recommend: heaviest first (SettingsModal → CostCalculator → PrinterSettings → JobsManager) so the heaviest debt gets paid down first, but planner can split into plans however makes sense.
- Per-file vs per-primitive refactoring style (e.g., "do all buttons in all files first" vs "finish each file before moving on") — recommend per-file so each plan ships a complete, reviewable unit.
- Whether to wrap as multiple plans (e.g., 07-01 heavy-3 + 07-02 modals + 07-03 utilities) or one big plan — recommend multiple plans given the scope; each ~3-4 components.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primitives to use
- `src/components/ui/Button.tsx` — `Button`, `ButtonLink`; variants `primary | secondary | success | danger | ghost`; sizes `sm | md | lg`; `btnSize` prop (not `size` — collides with HTML attribute)
- `src/components/ui/Input.tsx` — `Input`; `inputSize` prop with `sm | md | lg`
- `src/components/ui/Select.tsx` — `Select`; `selectSize` prop with `sm | md | lg`
- `src/components/ui/Textarea.tsx` — `Textarea`; `textareaSize` prop
- `src/components/ui/Card.tsx` — `Card`; `variant: default | elevated | interactive`; padding via `padding` prop
- `src/components/ui/index.ts` — public exports

### Phase scope source of truth
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03 (locked requirements)
- `.planning/ROADMAP.md` § Phase 7 — success criteria
- `.planning/PROJECT.md` § Current Milestone — milestone-level goals + foundation-first rationale

### Project conventions
- `.claude/CLAUDE.md` § Shared UI Components — names the available primitives, calls out the `btnSize`/`inputSize`/etc. prop quirk
- `docs/ROADMAP.md` § "Inconsistent styling pass" — the original audit finding that motivated this phase

### Audit findings
- 2026-05-19 codebase audit confirmed: zero imports from `src/components/ui/` exist across the 14 in-scope components. Primitives ARE available but unused. Fresh grep counts: SettingsModal=44, CostCalculator=32, PrinterSettings=18, JobsManager=13.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/` primitives exist with full variant/size matrices — no new primitive infrastructure needed
- `getButtonClasses()` and exported style maps in `Button.tsx` available if a component needs button-styled anchor or div (rare)
- Tailwind config is project-default; no additional config needed for the pass
- Vitest infra exists (Phase 11 will leverage it); Phase 7 doesn't need new test infra, just `npm run build` passing

### Established Patterns
- All in-scope components are functional components with hooks — no class-component conversion needed
- Existing primitives use `forwardRef` and standard HTML attribute types via `Omit<HTMLAttributes, 'size'>` — replacement is mostly mechanical
- Form state and validation patterns live in the component files (not extracted hooks) — that pattern stays; only the JSX element type changes

### Integration Points
- The components in scope are consumed via `App.tsx` (tabs) and routing in `main.tsx` — no parent-side changes required
- `NewBadge` placement convention (absolute overlay, never inline) — Phase 7 doesn't add NEW badges (internal refactoring) but must not introduce raw `<span>` badge patterns where `<NewBadge>` should be used

</code_context>

<specifics>
## Specific Ideas

- The lint script should live in `package.json` as `lint:no-raw-html` and run from both `pre-commit` (via husky or a manual `.git/hooks/pre-commit` script — TBD by planner based on project's existing hook setup) and as part of `npm run build` so CI catches it.
- For the `// allow-raw-html` opt-out comment: it should match the JSX-comment placement convention used elsewhere in the codebase. Grep the line above the matched element; if it contains `allow-raw-html`, exclude.
- Heaviest-first refactor order suggested: SettingsModal → CostCalculator → PrinterSettings → JobsManager → modals (CsvImportModal, BambuImport, MaintenanceAlertModal, UserProfileModal) → utility (Header, UpdateBanner, AssetLibrary, GcodeImport, FilamentSelector, ImageCarousel). Reduces "biggest source of inconsistency" first so subsequent feature work benefits sooner.

</specifics>

<deferred>
## Deferred Ideas

- **Marketing-page primitives pass** — `src/pages/FAQPage.tsx`, `src/pages/FeedbackPage.tsx`, `src/pages/LandingPage.tsx`, etc. Deferred to a separate marketing redesign milestone with its own design language.
- **Custom ESLint rule** for raw-HTML ban — if the grep approach proves too fragile in practice (false positives in string literals, etc.), upgrade to a real ESLint rule in a future foundation pass.
- **Full design-system token pass** (typography scale, animation curves, elevation tokens) — out of scope for v1.1; the primitives pass is the minimum viable foundation.
- **`Modal` primitive** — multiple modals (Settings, Profile, Maintenance, CSV import, BambuImport) duplicate modal-shell structure (backdrop, close button, escape handling). Could be extracted as `src/components/ui/Modal.tsx`. Not in v1.1 scope; tee'd up for a later DX pass.

</deferred>

---

*Phase: 07-styling-primitives-pass*
*Context gathered: 2026-05-19*
