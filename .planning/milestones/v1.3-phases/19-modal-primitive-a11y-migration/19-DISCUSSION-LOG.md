# Phase 19: Modal primitive + a11y migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 19-modal-primitive-a11y-migration
**Areas discussed:** Focus-trap impl, Portal rendering, Inline overlays, Backdrop + sizes

---

## Focus-trap impl

### Q1: Hand-rolled focus trap inside <Modal>, or add the focus-trap-react dependency?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled (Recommended) | ~40 LOC inside Modal.tsx — query focusables, Tab/Shift+Tab cycle, useEffect mount focuses[0], useEffect cleanup restores previouslyFocused. Zero new deps; matches project's 14-runtime-deps culture; pattern documented in WAI-ARIA APG. Cost: edge cases (radio groups, disabled-mid-cycle, dynamic content) handled ourselves. | ✓ |
| focus-trap-react | Adds ~3 KB gz, ~9 KB raw. Battle-tested (Mantine, Reach UI). Handles edge cases out of the box. Risk: another React 19 compat surface. | |
| You decide | Pick based on planner research into edge cases in our 10 modals. | |

**User's choice:** Hand-rolled (Recommended)
**Notes:** Aligns with the project's dep-minimalism culture. Edge cases will be handled in code as they surface.

### Q2: How should the focus trap handle modals with NO focusable children?

| Option | Description | Selected |
|--------|-------------|----------|
| Focus the dialog itself (Recommended) | tabIndex={-1} on dialog card; focus it if no focusable children. Standard APG pattern; SR still announces dialog + title; Escape still works. ~3 LOC. | ✓ |
| Assume always has focusable | All 10 current modals have at least a Close button. Skip empty-state handling. | |
| You decide | Cost difference is ~3 LOC. | |

**User's choice:** Focus the dialog itself (Recommended)
**Notes:** Free insurance — none of today's 10 modals hit this case but future "Generating…" modals might.

### Q3: Focus restore-target: how 'sticky' should it be?

| Option | Description | Selected |
|--------|-------------|----------|
| Capture document.activeElement on mount (Recommended) | Standard APG. Save previouslyFocused on mount; restore on unmount if still in DOM. Handles 95% of cases. Edge: trigger unmounted → falls back to body. | ✓ |
| Caller-controlled via prop | Add initialFocusRef / restoreFocusRef props. More flexible but every consumer must think about it. Adds API surface. | |
| You decide | | |

**User's choice:** Capture document.activeElement on mount (Recommended)
**Notes:** Body-fallback is documented in JSDoc as known behavior.

### Q4: Test scope for focus-trap behavior in jsdom?

| Option | Description | Selected |
|--------|-------------|----------|
| Structural + handler-invocation (Recommended) | Test ARIA attrs present, useId produces unique ids, Escape handler closes, Tab handler invoked. Skip 'simulate-real-user' assertions. VoiceOver UAT catches what tests can't. | ✓ |
| Skip focus assertions entirely | Test only structural ARIA + Escape. Rely on manual UAT. Faster; no regression net for Tab cycling. | |
| Add @testing-library/react | Install testing-library + user-event to write realistic keyboard tests. Adds 2 dev deps; project-wide pattern change. | |

**User's choice:** Structural + handler-invocation (Recommended)
**Notes:** Stays with the project's existing raw `createRoot` + `act` test convention.

---

## Portal rendering

### Q1: Render <Modal> in-place at its call site, or createPortal to document.body?

| Option | Description | Selected |
|--------|-------------|----------|
| createPortal to document.body (Recommended) | WAI-ARIA APG recommended. Avoids stacking-context bugs (today's z-50 depends on no ancestor having transform/opacity/filter). Cleanly stacks above virtualized lists. Adds ~5 LOC. Risk: jsdom tests must query from document.body. | ✓ |
| Keep in-place | Current pattern. Smaller diff, no portal complexity. Risk: footgun if any future parent gets transform/opacity/filter. | |
| You decide | | |

**User's choice:** createPortal to document.body (Recommended)
**Notes:** Eliminates a class of future bugs; small jsdom test cost is acceptable.

### Q2: Body scroll-lock while a Modal is open?

| Option | Description | Selected |
|--------|-------------|----------|
| Add overflow:hidden on body (Recommended) | Standard companion to portal rendering. Stops background-scroll behind backdrop on mobile + touchpad. ~5 LOC inside useEffect; restore on unmount. | ✓ |
| Skip scroll-lock | Today's behavior. One fewer side-effect to manage. Acceptable if no UX complaint. | |
| Skip + iOS-safe later | Skip now; add if usage surfaces an issue. Lower risk surface. | |

**User's choice:** Add overflow:hidden on body (Recommended)
**Notes:** Capture prior overflow value at mount to handle the rare case of parent code already managing body overflow.

### Q3: Stacked modals (one modal opens another) — what should the primitive support?

| Option | Description | Selected |
|--------|-------------|----------|
| Single modal only (Recommended) | App doesn't stack today. Document constraint; dev-mode console.warn if second Modal mounts while one is open. Keeps scroll-lock + focus-restore + Escape unambiguous. ~3 LOC guard. | ✓ |
| Implement a stack | Module-level openModals[] stack with proper restore-target chaining. ~20 LOC + edge cases. Premature. | |
| Silent multi-modal | No guard; portal's natural stacking. Cheapest but most footgun-prone. | |

**User's choice:** Single modal only (Recommended)
**Notes:** Guard is dev-mode only (production never crashes on misuse).

### Q4: Portal mount node — where exactly does the Modal render?

| Option | Description | Selected |
|--------|-------------|----------|
| document.body directly (Recommended) | Simplest. Modal becomes last child of body. No SSR concern (Vite app). Tauri works identically. | ✓ |
| Dedicated #modal-root in index.html | Slight isolation. Cost: new project-setup gotcha; risks #modal-root missing in test setup. | |
| Inside #root next to React app | Same effective DOM position for our app (only #root in body). Weirder mental model. | |

**User's choice:** document.body directly (Recommended)
**Notes:** No new infrastructure needed.

---

## Inline overlays

### Q1: How should the 3 inline JobsManager overlays migrate?

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap inline, no extraction (Recommended) | Replace each `<div fixed inset-0 …>` with `<Modal …>`. Closes A11Y-03's 10-surface count exactly without doing Phase 22's work. Net ~15-30 LOC removed per overlay. | ✓ |
| Extract <ConfirmDialog> + wrap Record Sale inline | The 2 Delete confirms are structurally identical — extract a reusable <ConfirmDialog>. Wrap Record Sale inline. Ships a reusable primitive but adds scope. | |
| Extract Record Sale now | Do Phase 22's HYG-06 extraction inside Phase 19. Forces a much larger diff; scope creep. | |

**User's choice:** Wrap inline, no extraction (Recommended)
**Notes:** Strict scope; Phase 22 will extract from a Modal-wrapped baseline (cleaner foundation).

### Q2: Record Sale modal title — what goes into Modal's `title` prop?

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve current text (Recommended) | Pass the existing template literal verbatim. Modal renders as `<h3 id={titleId}>{title}</h3>`. Keeps migration purely structural. | ✓ |
| Split into title + subtitle | Add optional subtitle? prop. More structured; doesn't generalize to the other 9 surfaces. | |
| You decide | | |

**User's choice:** Preserve current text (Recommended)
**Notes:** `convertingFromQuote` blue helper banner stays as the first child of Modal's children, not a subtitle.

### Q3: Delete confirm modals — close button (X) in the header?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-render X via Modal (Recommended) | Modal always renders X with aria-label="Close" (closes A11Y-06 for Settings/UserProfile too). Minor UX improvement (3 close paths → 4). | ✓ |
| Opt-out via showCloseButton={false} | Default true; 2 Delete confirms pass false. Slight API bloat; less consistency. | |
| Confirm modals get no X by default | Modal auto-renders X for normal modals; not for ConfirmDialog. Since we wrap inline (not extract), worst of both. | |

**User's choice:** Auto-render X via Modal (Recommended)
**Notes:** Consistency wins; 2 Delete confirms gain the X as a free UX bump.

### Q4: Phase 19 boundary check — should we also extract HYG-06/HYG-07?

| Option | Description | Selected |
|--------|-------------|----------|
| No — Phase 22's scope (Recommended) | Stick to a11y-only mandate. HYG-06/HYG-07 are explicit Phase 22 scope. Clean separation. | ✓ |
| Fold in HYG-06 only | Extract useCustomerPicker. PrintQuoteModal benefits immediately. Scope creep; Phase 22 loses ~25% of its work. | |
| Fold in both HYG-06 + HYG-07 | Effectively does most of Phase 22 inside Phase 19. Wrong boundary. | |

**User's choice:** No — Phase 22's scope (Recommended)
**Notes:** Boundary discipline; Phase 19 and Phase 22 stay independent.

---

## Backdrop + sizes

### Q1: Backdrop-click behavior — keep close-immediately on all modals, or add an opt-out?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep close-immediately on all (Recommended) | All 7 component modals + 3 inline overlays close on backdrop click today. Zero data-loss complaints across v1.2. Simplest API. | ✓ |
| Add closeOnBackdrop?: boolean (default true) | Form modals could opt out. Adds one API prop. Risk: inconsistent UX if we pick wrong. | |
| Add closeOnBackdrop + confirm-discard guard | Modal exposes closeOnBackdrop + confirmDiscardIf? callback. Scope creep. | |

**User's choice:** Keep close-immediately on all (Recommended)
**Notes:** If data-loss complaints surface in v1.4+, revisit then.

### Q2: What `size` variants should the Modal primitive expose?

| Option | Description | Selected |
|--------|-------------|----------|
| sm \| md \| lg \| xl (Recommended) | sm=max-w-sm (Delete confirms), md=max-w-md (default, UserProfile/CustomerEdit/Decline/Maintenance/Record Sale), lg=max-w-lg (Settings/PrintQuote), xl=max-w-3xl (CsvImport/CustomerCsvImport). Full current spread; documented mapping. | ✓ |
| sm \| md \| lg only | Drop xl tier; CsvImport breaks the preview-table layout. | |
| Accept arbitrary className | No size prop; each consumer rolls own max-w-*. Defeats the primitive's purpose. | |

**User's choice:** sm | md | lg | xl (Recommended)
**Notes:** Mapping documented in Modal's JSDoc.

### Q3: SettingsModal and UserProfileModal top-right anchor — how should Modal handle this?

| Option | Description | Selected |
|--------|-------------|----------|
| Center all; migrate Settings/UserProfile to centered (Recommended) | One positioning code path; consistency across the app. The 2 outliers lose their top-right anchor (minor visual regression — anchoring was a quirky preference, not a design intent). | ✓ |
| Add a position prop | position?: 'center' \| 'top-right'. Preserves Settings/UserProfile exactly. API bloat for 2-of-10 surfaces. | |
| Migrate but keep classname escape | cardClassName escape hatch. Less clean than position prop. | |

**User's choice:** Center all; migrate Settings/UserProfile to centered (Recommended)
**Notes:** If users complain about the anchor change post-migration, revisit. Currently no usage signal.

### Q4: Modal max-height + overflow behavior — what's the primitive's default?

| Option | Description | Selected |
|--------|-------------|----------|
| max-h-[90vh] + overflow-y-auto (Recommended) | Most-used pattern. Card scrolls if exceeds 90% viewport. Works for short modals (Delete confirms) and tall ones (SettingsModal all tabs). | ✓ |
| max-h-[85vh] + overflow-y-auto | CustomerCsvImport uses this. 5% diff barely perceptible. | |
| No default; per-modal override | Each consumer wraps children in own scroll container. Worse for primitive consistency. | |

**User's choice:** max-h-[90vh] + overflow-y-auto (Recommended)
**Notes:** Settings/UserProfile lose their `calc(100vh-100px)` anchor (D-03) but gain the standard scroll behavior.

---

## Claude's Discretion

The user said "Recommended" on every question (selecting Claude's first-option recommendation each time). Specific items where the planner has discretion downstream are listed in CONTEXT.md under "Claude's Discretion":

- Exact prop API for Input/Textarea/Select label pairing (id?: string default via useId() recommended)
- Whether Modal's X close button uses `<Button variant="ghost" btnSize="sm">` (recommended for consistency) or a raw `<button>`
- Whether plans 19-03 + 19-06 execute as separate waves or single wave (parallel-safe — planner decides based on file contention check)
- Exact CSS for the centered modal layout (backdrop + flex centering + card padding)
- VoiceOver UAT bar in plan 19-06 (recommended: 4-check protocol per surface)

## Deferred Ideas

- `<ConfirmDialog>` primitive layered on top of Modal — defer until v1.4+ surfaces multiple confirm flows
- `closeOnBackdrop?: boolean` opt-out — defer until data-loss complaints surface
- `confirmDiscardIf?: () => boolean` guard callback — feature on top of primitive; defer indefinitely
- Stacked-modal support — single-modal-only is locked
- `<RecordSaleModal>` extraction (HYG-06) — Phase 22 scope
- `useCustomerPicker` hook (HYG-08) — Phase 22 scope
- `<SaleRow>` / `<JobCard>` extraction (HYG-07) — Phase 22 scope
- `@testing-library/react` migration — project-wide convention change; defer
- Modal `position?: 'center' | 'top-right'` prop — Settings/UserProfile migrate to centered
- `aria-hidden` on the rest of the React app while Modal is open — defer unless UAT flags
- Smooth open/close animations — v1.4+ candidate
- Modal portal target = `#modal-root` — rejected; `document.body` is sufficient
- Reusable Modal sub-components (`<Modal.Header>`, etc.) — out of scope; revisit if footer-button pattern repeats
