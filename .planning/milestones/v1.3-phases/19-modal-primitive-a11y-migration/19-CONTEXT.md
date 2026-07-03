# Phase 19: Modal primitive + a11y migration - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a shared `<Modal>` primitive at `src/components/ui/Modal.tsx` that bakes in the WAI-ARIA dialog pattern — `role="dialog"`, `aria-modal="true"`, `aria-labelledby` via `useId()`, focus trap, focus restoration, Escape-to-close, backdrop-click-to-close, body scroll-lock, and `createPortal` to `document.body`. Migrate every existing modal surface in the app to use it. Closes 2 CRITICAL + 3 HIGH + 3 MEDIUM a11y findings from `v1.2-CODE-AUDIT.md` and absorbs HYG-09 (`useEscapeToClose` + `useModalReset`) into the primitive.

**In scope:**
- New `src/components/ui/Modal.tsx` with props `{ isOpen, onClose, title, children, size?: 'sm' | 'md' | 'lg' | 'xl' }`. Markup: portal-rendered backdrop wrapping a card with `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`. The card always auto-renders `<h3 id={titleId}>{title}</h3>` and an `aria-label="Close"` X button.
- Hand-rolled focus trap inside Modal — query focusable descendants, Tab/Shift+Tab cycle, mount focuses the first focusable child (or the dialog card itself via `tabIndex={-1}` if no focusable children exist), unmount restores focus to `document.activeElement` captured at mount (if still in DOM).
- Escape key closes via `onClose`; backdrop click closes immediately (no opt-out — consistent with the current behavior of all 10 surfaces).
- Body scroll-lock via `document.body.style.overflow = 'hidden'` while open; restore on unmount.
- Single-modal-only constraint: dev-mode `console.warn` if a second Modal mounts while one is open. No stack management.
- Migrate 10 modal surfaces to consume `<Modal>`:
  1. `src/components/PrintQuoteModal.tsx`
  2. `src/components/SettingsModal.tsx` — also closes A11Y-06 close-button `aria-label`; migrates from top-right anchor to centered
  3. `src/components/UserProfileModal.tsx` — also closes A11Y-06; migrates from top-right anchor to centered
  4. `src/components/CustomerEditModal.tsx`
  5. `src/components/CustomerCsvImportModal.tsx`
  6. `src/components/DeclineQuoteModal.tsx`
  7. `src/components/MaintenanceAlertModal.tsx`
  8. `src/components/CsvImportModal.tsx`
  9. `src/components/JobsManager.tsx` inline Record Sale overlay (line 1788) — wrapped in-place, NOT extracted
  10. `src/components/JobsManager.tsx` inline Delete Job confirm (line 2036) + inline Delete Sale confirm (line 2061) — both wrapped in-place
- Input/Textarea/Select primitives auto-generate `id` via `useId()` with optional explicit `id` override; consumed labels use `htmlFor` (closes A11Y-07 in Record Sale + CustomerEditModal form grids).
- `InfoTooltip` switches from hardcoded `id="info-tooltip-content"` to `useId()` (closes A11Y-04).
- `CollapsibleSection` body element always rendered with `hidden={!open}` (or equivalent CSS toggle) so `aria-controls` points to a real DOM id (closes A11Y-08).
- react-window `<List>` containers in `JobsManager`, `CustomerLibrary`, `AssetLibrary` get `role="list"` + `aria-rowcount={totalCount}`; each row's outer `<div>` gets `role="listitem"`; `AssetLibrary` desktop table parent gets `role="grid"` (closes A11Y-05).
- Tests for the new Modal primitive + the modified UI primitives use the project's existing raw-`createRoot` + `act` style — no new testing-library dependency.
- Final UAT (plan 19-06): VoiceOver smoke test against the 10 migrated surfaces — confirm dialog announcement + title + focus trap + focus restore on each.

**Out of scope (redirected):**
- Extraction of `<RecordSaleModal>` from JobsManager — explicit Phase 22 scope (HYG-06). Phase 19 only wraps the inline overlay in `<Modal>`.
- Extraction of `useCustomerPicker` hook — Phase 22 scope (HYG-08).
- Extraction of `<SaleRow>` / `<JobCard>` decomposition — Phase 22 scope (HYG-07).
- Reusable `<ConfirmDialog>` primitive layered on top of Modal — considered for the 2 inline Delete confirms; deferred. Both confirms are inline-wrapped in `<Modal>` directly. Revisit in a future phase if other confirm flows surface.
- `closeOnBackdrop?: boolean` opt-out prop for form modals — considered for PrintQuoteModal / CustomerEditModal data-loss risk; deferred. All modals close on backdrop click. If user complaints surface, v1.4+ adds a confirm-discard layer.
- Stacked-modal support — single-modal-only is enforced via dev-mode warn.
- Modal `position?: 'center' | 'top-right'` prop — Settings/UserProfile lose their `mt-12 mr-2` top-right anchor during migration and become centered like the other 8 modals.
- `@testing-library/react` + `user-event` — staying with raw `createRoot` + `act` for tests; matches existing JobsManager.test.tsx / PrintQuoteModal.test.tsx / DeclineQuoteModal.test.tsx conventions.
- Any new user-facing feature, badge, copy change, or visual restyle beyond what migration deletes/preserves.
- `aria-hidden` on the rest of the React app while a Modal is open — portal placement at `document.body` makes this less critical; defer unless VoiceOver UAT surfaces a problem.

</domain>

<decisions>
## Implementation Decisions

### Modal primitive API + markup (locked by ROADMAP success criteria)
- **D-01:** Props are `{ isOpen, onClose, title, children, size? }`. `title: ReactNode` (so Record Sale can pass `${editingSale ? 'Edit Sale' : 'Record Sale'} - ${job.name}` verbatim). `size: 'sm' | 'md' | 'lg' | 'xl'`, default `'md'`. Mapping:
  - `sm` → `max-w-sm` (Delete confirms today; covers any future tiny modal)
  - `md` → `max-w-md` (UserProfile, CustomerEdit, Decline, Maintenance, Record Sale, default)
  - `lg` → `max-w-lg` (Settings, PrintQuote)
  - `xl` → `max-w-3xl` (CsvImport, CustomerCsvImport)
  Document the mapping in Modal's JSDoc so future surfaces pick the right tier.
- **D-02:** Modal auto-renders the header chrome — `<h3 id={titleId}>{title}</h3>` on the left, an X close button with `aria-label="Close"` on the right. Closes A11Y-06 for SettingsModal + UserProfileModal close buttons in the same step as wrapping them in Modal. The 2 Delete confirm overlays (which don't have an X today) gain one — a UX improvement (Escape, backdrop, X, or Cancel = 4 ways out), and worth the consistency.
- **D-03:** Card default: `max-h-[90vh]` + `overflow-y-auto`. Backdrop is fixed; the card scrolls if content exceeds 90vh. Replaces the mix of `max-h-[85vh]`, `[90vh]`, `[calc(100vh-100px)]` currently used. SettingsModal + UserProfileModal lose their `mt-12 mr-2 max-h-[calc(100vh-100px)]` top-right anchor and become viewport-centered like the other 8 modals.

### Focus management
- **D-04:** Hand-rolled focus trap inside Modal.tsx (~40 LOC). NO new dependency. Project trend: 14 runtime deps, minimal. Pattern is exhaustively documented in the WAI-ARIA APG dialog example — copy that. focus-trap-react was considered (3 KB gz, battle-tested edge cases) but rejected for dep-minimalism + React 19 compat surface concerns.
- **D-05:** On mount, query focusable descendants (`button:not([disabled])`, `[href]`, `input:not([disabled])`, `select:not([disabled])`, `textarea:not([disabled])`, `[tabindex]:not([tabindex="-1"])`); focus the first one. If no focusable child exists, focus the dialog card itself (add `tabIndex={-1}` to the card so it can receive focus). Standard APG fallback.
- **D-06:** On mount, capture `document.activeElement as HTMLElement | null` as `previouslyFocused`. On unmount, if `previouslyFocused` is still in the DOM and focusable, call `.focus()` on it. If it's been unmounted (e.g., a JobsManager row was re-keyed), focus falls back to `document.body` — acceptable; documented in the Modal JSDoc as the known fallback.
- **D-07:** Tab / Shift+Tab handler — global keydown listener registered while `isOpen`. On Tab: if `document.activeElement === lastFocusable`, prevent default and focus first. On Shift+Tab: if `document.activeElement === firstFocusable`, prevent default and focus last. Re-query the focusable list on each Tab keystroke (handles modals with dynamically-rendered focusable children like PrintQuoteModal's customer picker dropdown).
- **D-08:** Escape keydown invokes `onClose()`. Same keydown listener as the Tab trap. Single global listener while open — symmetric with single-modal-only constraint.

### Portal + scroll-lock + single-modal-only
- **D-09:** Modal renders via `createPortal(jsx, document.body)` — escapes any parent stacking context, avoids overflow/z-index bugs, cleanly stacks above virtualized lists. No new `<div id="modal-root">` in index.html; portal directly to `document.body`. Tauri works identically (Tauri's webview is just a browser).
- **D-10:** While `isOpen`, set `document.body.style.overflow = 'hidden'`; on unmount, restore the prior value (capture it at mount to avoid clobbering any user-set overflow). Stops background-scroll behind the modal. ~5 LOC inside the same useEffect.
- **D-11:** Single-modal-only — Modal maintains a module-level `isAnyModalOpen` flag. If a second Modal tries to mount while the flag is true, emit a `console.warn` in dev (`process.env.NODE_ENV !== 'production'`). Don't throw — production must never crash on a misuse. This is a guard, not a stack.

### A11y migrations (mechanical fixes locked by ROADMAP success criteria)
- **D-12:** `Input.tsx`, `Textarea.tsx`, `Select.tsx` accept an optional `id?: string`. If not provided, internally call `useId()` and use it. Forward the id to the underlying `<input>` / `<textarea>` / `<select>`. Each primitive exposes the resolved id via a render-prop-style `htmlFor` mechanism — OR consumers continue using `<label htmlFor={someId}>` and pass `id={someId}` to the primitive. Planner decides which API (an `id` prop on both the label and the primitive is simplest — matches the existing `htmlFor="customer-picker-input"` + `id="customer-picker-input"` pattern at JobsManager.tsx:1834-1838).
- **D-13:** `InfoTooltip` uses `useId()` for its tooltip span's id (replacing the static `id="info-tooltip-content"` at line 39). Each instance gets a unique id; multiple tooltips on the same screen (e.g., 6+ on SettingsModal Costs & Rates tab) no longer collide. Pattern matches `CollapsibleSection.tsx:21`.
- **D-14:** `CollapsibleSection` body always rendered with `hidden={!open}` (CSS attribute) — `aria-controls` always references a real DOM id. Today the body is conditionally `{open && (<div id={bodyId}>…)}` which violates the ARIA spec. Switch to `<div id={bodyId} hidden={!open} className="mt-4">{children}</div>`. Bonus: enables smooth animations later.
- **D-15:** react-window `<List>` containers — pass `role="list"` and `aria-rowcount={searchedJobs.length}` (or equivalent per consumer) as standard HTML attrs via the `...rest` props slot. Row component (`JobRow`, `CustomerRow`, `AssetRow`) wraps its outer `<div>` with `role="listitem"`. `AssetLibrary`'s desktop table path: the parent `<div>` containing `role="row"` header rows already exists at lines 1189 + 1220 — wrap that parent with `role="grid"`.

### Inline JobsManager overlays
- **D-16:** Wrap-in-place, no extraction. Each of the 3 inline overlays (`{showSaleForm && (…)}` at 1788; `{deleteConfirmJobId && (…)}` at 2036; `{deleteSaleConfirmId && (…)}` at 2061) gets converted to `<Modal isOpen={…} onClose={…} title="…"><…/></Modal>`. Boilerplate deleted per surface: outer `<div className="fixed inset-0 …" onClick={…}>` backdrop, inner `<div … onClick={e => e.stopPropagation()}>` card chrome, the `<h3>` title that's now Modal's responsibility. Net ~15–30 LOC removed per overlay (matches ROADMAP criterion #4 estimate).
- **D-17:** Record Sale's "Converting Q-NNNN — review and adjust if needed" blue helper banner (at line 1794) stays as part of `children` — it's not a subtitle, it's contextual content. Don't add a `subtitle` prop to Modal for this one case.
- **D-18:** Delete Job + Delete Sale confirms gain the auto-rendered X close button. Today they only have Cancel/Delete buttons; the X is a free UX bump (3 close paths → 4) and unavoidable consequence of Modal owning the header chrome.

### Phase boundary discipline
- **D-19:** HYG-06 (`useCustomerPicker` extraction) and HYG-07 (`<SaleRow>` extraction) stay in Phase 22. Phase 19 does NOT fold them in even though it touches JobsManager. Boundary: Phase 19 = a11y primitive + 10 mechanical migrations; Phase 22 = JobsManager structural decomposition. Mixing them expands review surface and conflicts with Phase 22's plan.
- **D-20:** HYG-09 (`useEscapeToClose` + `useModalReset` hooks) is ABSORBED into Modal — no separate hook ships. The 8 existing Escape effects (one per current modal) all delete during migration; the 8 existing close-reset useEffects (`if (!isOpen) { reset… }`) become unnecessary because Modal unmounts its `children` when `isOpen` becomes false (use the `isOpen ? children : null` pattern in Modal). Consumers that need reset-on-close keep their reset effects keyed on `isOpen`. Document the absorption in REQUIREMENTS.md → HYG-09 closes via Modal, not via standalone hooks.

### Test strategy
- **D-21:** Modal tests use the project's existing raw `createRoot` + `act` style (matching `JobsManager.test.tsx`, `PrintQuoteModal.test.tsx`, `DeclineQuoteModal.test.tsx`). Test surface:
  - Structural ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` points to the rendered `<h3>` id, X button has `aria-label="Close"`.
  - `useId()` produces a non-empty unique id (assert on `getAttribute('id')` length > 0).
  - Escape keydown via `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` invokes the `onClose` spy.
  - Backdrop click via `fireEvent.mouseDown` on the backdrop invokes `onClose`; click on the card body does NOT.
  - Body scroll-lock: assert `document.body.style.overflow === 'hidden'` while `isOpen`, restored on unmount.
  - Focus trap (handler-invocation level): assert focus moves to a focusable child on mount; dispatch Tab and Shift+Tab keydowns and assert `document.activeElement` shifted as expected. Skip end-to-end "tab through entire modal" simulations — jsdom's tab traversal is incomplete; rely on VoiceOver UAT (plan 19-06) for that.
- **D-22:** No `@testing-library/react` install. Keep the existing convention. If a future phase wants to switch the whole project to testing-library, that's its own scope.

### Plan structure
- **D-23:** 6 plans, executed serially with light dependency coupling (matches ROADMAP):
  - **19-01:** Modal primitive + tests (foundation). Ships `src/components/ui/Modal.tsx` + `src/components/ui/Modal.test.tsx` + `src/components/ui/index.ts` barrel export update. Standalone — no consumer touched yet.
  - **19-02:** Input/Textarea/Select auto-id via `useId()`. Adds optional `id?` prop; if absent, generates one. Migrate the existing `htmlFor`/`id` pairs in CustomerEditModal + JobsManager Record Sale to use the new convention.
  - **19-03:** InfoTooltip `useId()` + CollapsibleSection always-rendered body. Two surgical edits; share a plan because they're both ui/ primitive fixes.
  - **19-04:** Migrate 5 modals — batch 1. PrintQuoteModal, SettingsModal, UserProfileModal, CustomerEditModal, MaintenanceAlertModal. Touches no other code.
  - **19-05:** Migrate 5 modals — batch 2. CustomerCsvImportModal, DeclineQuoteModal, CsvImportModal, plus the 3 inline JobsManager overlays.
  - **19-06:** Virtualized-list ARIA + final VoiceOver UAT. `role="list"` + `aria-rowcount` + per-row `role="listitem"` on JobsManager, CustomerLibrary, AssetLibrary; `role="grid"` on AssetLibrary desktop table. UAT smoke test against all 10 migrated surfaces.
- **D-24:** Dependency chain — 19-01 must complete before 19-04 / 19-05 (consumers need Modal). 19-02 must complete before 19-04 / 19-05 only if the migrations also retrofit `htmlFor`/`id` pairing (criterion #8) — in practice fold the retrofit into 19-04 / 19-05 since those are already touching the form modals. 19-03 + 19-06 are independent; either can run in parallel with the modal migrations.
- **D-25:** Atomic commit per task within each plan (Phase 18/24/25 precedent). Use `gsd-sdk query commit` helper. No `--no-verify` ever. `tsc -b` for TypeScript verification (not `tsc --noEmit`).

### Claude's Discretion
- Exact prop API for `Input`/`Textarea`/`Select` label pairing (D-12) — planner picks the cleanest convention. Recommendation: just accept `id?: string`, default to `useId()`-generated; consumer passes the same value to `<label htmlFor={id}>`. Matches the existing JobsManager.tsx:1834-1838 pattern with `id="customer-picker-input"` already.
- File location for the Modal primitive — `src/components/ui/Modal.tsx` (locked by ROADMAP success criterion #1). Barrel export update in `src/components/ui/index.ts`.
- Whether the Modal X close button uses the existing `<Button variant="ghost" btnSize="sm">` primitive (matching the current X buttons in CustomerEditModal, DeclineQuoteModal, PrintQuoteModal, CustomerCsvImportModal at lines 111, 89, 310, 210) or a raw `<button>` — recommend the Button primitive for consistency.
- Plan-3 (InfoTooltip + CollapsibleSection) and Plan-6 (virtualized lists) parallel-safe with the modal migrations — planner verifies no file contention and decides whether to execute as separate waves or single wave.
- The exact CSS for the centered modal layout (the wrapper backdrop + flex centering) — recommend `fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4` on the backdrop and `bg-slate-800 rounded-xl border border-slate-700 w-full max-w-{size} shadow-xl max-h-[90vh] overflow-y-auto` on the card. The `p-4` on the backdrop gives mobile a safe margin from viewport edges.
- VoiceOver UAT bar in plan 19-06 — recommend: open each of the 10 surfaces, confirm (a) VoiceOver announces "dialog" + the title; (b) Escape closes; (c) backdrop click closes; (d) after close, focus returns to the trigger button or a sensible fallback. Document any surface that fails as a follow-on, not a Phase 19 blocker.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 19 scope sources
- `.planning/ROADMAP.md` §"Phase 19" — locked goal, all 9 success criteria, plan estimate (~6 plans)
- `.planning/REQUIREMENTS.md` — full text of every requirement closed by this phase: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, A11Y-07, A11Y-08, and HYG-09 (modal hook absorption)
- `.planning/PROJECT.md` — milestone v1.3 framing (hardening-only, no new user-facing features); confirms Phase 19 is foundational for Phase 22 (JobsManager decomposition)
- `.planning/STATE.md` — current milestone position; Phase 19 dependency for Phase 22

### v1.2 audit sources (closure targets)
- `.planning/v1.2-CODE-AUDIT.md` §"CRITICAL findings" #2 (no role="dialog") + #3 (no focus trap) — closed by Modal primitive (A11Y-01, A11Y-02)
- `.planning/v1.2-CODE-AUDIT.md` §"HIGH findings" #8 (InfoTooltip static id) — closed by A11Y-04
- `.planning/v1.2-CODE-AUDIT.md` §"HIGH findings" #9 (virtualized lists lack role) — closed by A11Y-05
- `.planning/v1.2-CODE-AUDIT.md` §"HIGH findings" #10 (Settings/UserProfile close button aria-label) — closed by A11Y-06
- `.planning/v1.2-CODE-AUDIT.md` §"MEDIUM findings" #19 (3 inline overlays) — closed by A11Y-03 inline-wrap (D-16)
- `.planning/v1.2-CODE-AUDIT.md` §"MEDIUM findings" #20 (Record Sale + CustomerEdit label pairing) — closed by A11Y-07 (D-12)
- `.planning/v1.2-CODE-AUDIT.md` §"MEDIUM findings" #21 (CollapsibleSection aria-controls) — closed by A11Y-08 (D-14)
- `.planning/v1.2-CODE-AUDIT.md` §"Compounding fixes" final section — confirms the "single fix: build Modal primitive" framing, lists every audit finding closed by this phase
- `.planning/v1.2-TECH-DEBT.md` §HYG-09 — `useModalReset` + `useEscapeToClose` hooks; LOW severity; explicitly absorbed by Modal per D-20

### Prior phase context (carried-forward conventions)
- `.planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md` — Phase 25 precedent for atomic commits per task + `gsd-sdk query commit` helper usage + no-`--no-verify` rule + bundled-plan structure. Phase 25 also closed A11Y-09 (`QuoteStatusPill` aria-label + Declined-pill contrast) — Phase 19 should NOT re-touch QuoteStatusPill.
- `.planning/phases/24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryo/24-CONTEXT.md` — Phase 24 atomic-commit pattern, `gsd-sdk query commit` precedent
- `.planning/phases/16-printable-pdf-quote/16-CONTEXT.md` — PrintQuoteModal context including customer picker (combobox role on Input), email-match dedup, by-value snapshot rule. Phase 19 migration must preserve all of these. The combobox's dynamic listbox children mean Modal's focus trap MUST re-query focusable descendants on each Tab (D-07).
- `.planning/phases/15.1-customer-library/15.1-CONTEXT.md` — Customer picker pattern (reused inside Record Sale + PrintQuoteModal). Phase 19 doesn't extract; just wraps the Record Sale overlay in Modal.

### Existing code that the planner must read
- `src/components/SettingsModal.tsx` — current modal pattern (lines 84-99 for Escape + backdrop handlers; line 186 for the top-right-anchored card classname `max-w-lg mt-12 mr-2 max-h-[calc(100vh-100px)]`). Migration loses the anchor — becomes centered.
- `src/components/UserProfileModal.tsx` — same top-right anchor pattern (lines 23-37 for handlers; line 48 for the card). Same centering migration.
- `src/components/CustomerEditModal.tsx` — labels at 133, 143, 154, 165, 175 are `<label className="block text-xs text-slate-400 mb-1">` with NO `htmlFor`. Plan 19-02 / 19-04 retrofits.
- `src/components/PrintQuoteModal.tsx` — has a customer picker combobox (lines 1834-1858 on JobsManager side mirror this). Modal focus trap must re-query on each Tab (D-07).
- `src/components/DeclineQuoteModal.tsx` — simplest migration (lines 81-89 show clean Escape + backdrop + close-X pattern).
- `src/components/MaintenanceAlertModal.tsx` — note: uses `onDismiss` prop name, not `onClose`. During migration, the call site stays the same (`MaintenanceAlertModal` keeps its own prop API); only the internal implementation changes to use Modal with `onClose={onDismiss}`.
- `src/components/CsvImportModal.tsx` + `src/components/CustomerCsvImportModal.tsx` — both use `max-w-3xl` (size = `xl`). Preview table relies on the width.
- `src/components/JobsManager.tsx` — 3 inline overlays at lines 1788 (Record Sale), 2036 (Delete Job confirm), 2061 (Delete Sale confirm). Each wraps in-place per D-16.
- `src/components/ui/CollapsibleSection.tsx` — D-14 target. Body currently conditional at lines 53-57; switch to `<div id={bodyId} hidden={!open} className="mt-4">{children}</div>`. The `useId()` import is already there from line 1.
- `src/components/ui/InfoTooltip.tsx` — D-13 target. Replace `id="info-tooltip-content"` at line 39 with `useId()`. Also update the `aria-describedby` at line 26 to use the same id.
- `src/components/ui/Input.tsx` + `Textarea.tsx` + `Select.tsx` — D-12 targets. Add optional `id?: string`; default via `useId()`. Forward to the underlying form element.
- `src/components/CustomerLibrary.tsx` line 275 — `<List>` container; needs `role="list"` + `aria-rowcount`. Row component at line 88 wraps `<div role="listitem">`.
- `src/components/AssetLibrary.tsx` line 1159 — first `<List>`; lines 1200 + 1230 — additional `<List>` instances. Lines 1189 + 1220 — desktop table header `<div role="row">` parents need `role="grid"` (or `role="table"`).
- `node_modules/react-window/dist/react-window.d.ts` line 310 — confirms `ListProps` is `Omit<HTMLAttributes<HTMLDivElement>, "onResize">`, so `role` and `aria-rowcount` pass through via the `...rest` props.

### Codebase + workflow refs
- `.planning/codebase/STRUCTURE.md` — `src/components/ui/` is the primitive layer; `Modal.tsx` belongs here
- `.planning/codebase/STACK.md` — React 19 (useId built-in), Vite 7, Tailwind 4, jsdom 29 for tests
- `.planning/codebase/CONVENTIONS.md` — `src/components/ui/` primitives use `forwardRef` (see Input.tsx); Modal does NOT need forwardRef but can if useful
- `.planning/codebase/TESTING.md` — note: STALE (says "no test runner installed"). Reality: Vitest 4 + jsdom 29 + raw `createRoot`/`act` via existing tests like `JobsManager.test.tsx`. Trust the existing tests as the convention, not TESTING.md
- `~/.claude/CLAUDE.md` (global) — `tsc -b` for TypeScript verification (not `tsc --noEmit`); atomic commits; agents-aggressively rule
- `.claude/CLAUDE.md` (project) — port 4173, Tauri 2 detection via `__IS_TAURI__`, Vercel deploys on `tsc -b && vite build`
- `~/.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md` — NEW badge rule (NOT applicable: Phase 19 has zero user-facing features; do NOT add `features.ts` entries or `<NewBadge>` JSX)
- WAI-ARIA Authoring Practices Guide — Dialog (Modal) pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — reference for the hand-rolled focus trap (D-04 through D-08)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useId()` from React 19** — already in use at `src/components/ui/CollapsibleSection.tsx:1`. Same import pattern works for Modal, InfoTooltip, Input, Textarea, Select.
- **`<Button variant="ghost" btnSize="sm" aria-label="Close">` pattern** — used today by CustomerEditModal (line 111), DeclineQuoteModal (line 89), PrintQuoteModal (line 310), CustomerCsvImportModal (line 210). Modal's auto-rendered X reuses this exact button. SettingsModal (line 197) + UserProfileModal (line 53) get this for free during migration (closes A11Y-06).
- **`gsd-sdk query commit` helper** — Phase 18, 24, 25 precedent. Standard footer; atomic commit per task.
- **Backdrop + card chrome pattern** — every current modal uses the same skeleton: `<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={backdrop close}>` wrapping `<div className="bg-slate-800 rounded-xl border border-slate-700 ..." onClick={e => e.stopPropagation()}>`. Modal primitive consolidates this exactly; the migration removes the duplicated boilerplate.
- **`role="combobox"` + `aria-activedescendant` dropdown pattern** — JobsManager Record Sale at lines 1834-1896 + PrintQuoteModal internals. The Modal focus trap must accommodate dynamic-children dropdowns (re-query focusables on each Tab — D-07).
- **react-window v2 `<List>` `...rest` pass-through** — confirmed via `node_modules/react-window/dist/react-window.d.ts` line 310. `role` and `aria-rowcount` pass through naturally as HTMLAttributes; no react-window API change needed.

### Established Patterns
- **No `--no-verify` ever** — Phase 18 + 24 + 25 followed this without exception
- **`tsc -b` over `tsc --noEmit`** — global CLAUDE.md rule; Vercel uses `tsc -b && vite build`. Critical for the auto-id type changes on Input/Textarea/Select to compile cleanly under project references
- **Atomic commit per task** — every plan in v1.3 has done this; Phase 19 continues
- **Hardening-only milestone** — no `features.ts` entries, no `<NewBadge>` JSX. Phase 19 is pure a11y refactor; users won't see a visible change beyond Settings/UserProfile losing their top-right anchor
- **Tests use raw `createRoot` + `act`** — see `src/components/JobsManager.test.tsx`, `PrintQuoteModal.test.tsx`, `DeclineQuoteModal.test.tsx`. No `@testing-library/react`. Modal tests follow the same convention (D-21)
- **Sibling-not-generic pattern** — Phase 15.1 D-08 established that the project prefers a sibling component to a polymorphic generic. Applied here: Modal is its own primitive, NOT a generic `<Overlay variant="modal | toast | drawer">`

### Integration Points
- **Plan-internal file isolation** — Plan 19-01 touches only new files (`Modal.tsx`, `Modal.test.tsx`, `ui/index.ts`). Plan 19-02 touches `Input.tsx`, `Textarea.tsx`, `Select.tsx` + `CustomerEditModal.tsx` + `JobsManager.tsx` Record Sale form section (lines ~1803-1850). Plan 19-03 touches `InfoTooltip.tsx` + `CollapsibleSection.tsx`. Plans 19-04 / 19-05 touch the 7 modal files + the 3 JobsManager inline overlays. Plan 19-06 touches `JobsManager.tsx`, `CustomerLibrary.tsx`, `AssetLibrary.tsx` for List role attrs
- **Phase 22 collision** — Plans 19-04 / 19-05 / 19-06 all touch JobsManager.tsx. Phase 22's HYG-06/07 decomposition starts AFTER Phase 19 (per ROADMAP dependency). If Phase 22 lands before Phase 19 (it shouldn't), 19-05's 3 inline-overlay migrations and 19-06's role attrs re-target into the extracted components. Today (Phase 19 first per ROADMAP), Phase 22 starts from a Modal-wrapped baseline — cleaner foundation
- **Phase 25 already touched `QuoteStatusPill`** — A11Y-09 (aria-label + Declined-pill contrast) shipped via Phase 25. Phase 19 does NOT re-touch QuoteStatusPill; do not regress that work
- **VoiceOver UAT** — macOS-only (user is on Darwin per environment). Single-user UAT against the 10 surfaces; document any failures as Phase 19 follow-ons or v1.4 candidates, not blockers

</code_context>

<specifics>
## Specific Ideas

- **Focus trap implementation reference** — the WAI-ARIA APG dialog-modal pattern (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) is the canonical source. The example focus-trap code there is ~40 LOC; we should mirror it. Cite the URL in Modal.tsx's JSDoc so future-maintainers know where the pattern came from.
- **Body scroll-lock implementation** — capture the prior `document.body.style.overflow` value at mount; restore it (not just clear it) at unmount. This handles cases where some parent code is already managing body overflow.
- **Modal X button visual** — match the existing X icon in CustomerEditModal/PrintQuoteModal/DeclineQuoteModal/CustomerCsvImportModal headers. Reuse the same SVG markup or extract into a small reusable `<XIcon>` if it'd clean up. Planner's call.
- **JobsManager inline overlay migration tips** — when wrapping the Record Sale overlay (line 1788), keep the `convertingFromQuote` blue helper banner (line 1794) as the first child of Modal's `children` so it appears right under the title — preserves current visual order. The form fields stay below it.
- **Test for dev-mode warn (D-11)** — assert `console.warn` is called once when a second Modal opens. Use `vi.spyOn(console, 'warn')` per existing vitest convention. Restore the spy after test.
- **VoiceOver UAT script template** — for each of the 10 modals: (1) click the trigger button; (2) expect VoiceOver to announce "dialog, {title}"; (3) press Escape; (4) expect focus to return to the trigger button. Document pass/fail per surface in a UAT checklist inside plan 19-06's SUMMARY.md.

</specifics>

<deferred>
## Deferred Ideas

- **`<ConfirmDialog>` primitive layered on top of Modal** — for the 2 Delete confirms (title + body text + Cancel/Destructive-action buttons). Considered during Inline-overlays discussion; rejected to keep Phase 19 scope predictable. If more confirm flows appear in v1.4+ (e.g., "Discard unsaved changes?" in PrintQuoteModal), extract then.
- **`closeOnBackdrop?: boolean` opt-out prop** — for PrintQuoteModal / CustomerEditModal / Record Sale with unsaved typed data. Considered; deferred because no user complaint exists today. v1.4+ candidate if data-loss complaints surface.
- **`confirmDiscardIf?: () => boolean` guard callback** — feature-on-top-of-primitive; deferred indefinitely. Backlog if multiple modals start needing it.
- **Stacked-modal support** — single-modal-only is the locked behavior. If a v1.4+ feature needs nested modals (e.g., "Edit quote → confirm discard"), revisit the constraint then.
- **`<RecordSaleModal>` extraction (HYG-06)** — Phase 22 scope. Phase 19 leaves it inline-wrapped in Modal.
- **`useCustomerPicker` hook (HYG-08)** — Phase 22 scope.
- **`<SaleRow>` / `<JobCard>` extraction (HYG-07)** — Phase 22 scope.
- **`@testing-library/react` + `@testing-library/user-event` migration** — would enable richer focus-trap tests. Out of scope; project-wide convention change. Defer unless a future phase needs it.
- **Modal `position?: 'center' | 'top-right'` prop** — considered for Settings/UserProfile preservation. Rejected; both modals migrate to centered. If users complain about the anchor change, revisit.
- **`aria-hidden` on the rest of the React app while a Modal is open** — portal placement at `document.body` makes this lower-priority. Defer unless VoiceOver UAT (plan 19-06) flags a problem.
- **Smooth open/close animations** — Modal's hidden body in CollapsibleSection (D-14) enables future animation work; Phase 19 ships with no animation (instant show/hide matches current behavior). Animation polish = v1.4+ candidate.
- **Modal portal target = `#modal-root` instead of `document.body`** — considered for CSS-isolation. Rejected; `document.body` is sufficient and one less moving piece. Revisit if global-CSS-rule collisions surface.
- **Reusable Modal sub-components (`<Modal.Header>`, `<Modal.Body>`, `<Modal.Footer>`)** — compound-component API. Out of scope; current header + body + (caller's children include footer buttons) shape is sufficient. v1.4+ candidate if multiple modals end up writing the same footer pattern (Cancel/Confirm row).

</deferred>

---

*Phase: 19-modal-primitive-a11y-migration*
*Context gathered: 2026-05-26*
