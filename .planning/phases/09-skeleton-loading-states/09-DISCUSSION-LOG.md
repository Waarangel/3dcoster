# Phase 9 Discussion Log

**Date:** 2026-05-19

## Gray Areas Selected

User selected all four gray areas presented:
- Loading architecture
- Skeleton component shape
- Animation + flicker
- Marketing surfaces scope

## Q&A

### Loading architecture

**Q:** Where should the loading gate live in Phase 9?
**A:** Per-consumer (Recommended) — drop App.tsx's global gate, each list consumer renders its own skeleton based on its own loading flag.
→ **D-01**

### Skeleton component shape

**Q:** How should the skeleton component(s) be structured?
**A:** Primitive + 3 composed (Recommended) — `Skeleton.tsx` in `src/components/ui/` + three list-shape composed skeletons.
→ **D-02**

**Q:** Where should the three composed list skeletons live?
**A:** In consumer files (Recommended) — co-located with the real list each mirrors.
→ **D-03**

### Animation + flicker

**Q:** Animation style for the skeleton bars?
**A:** Tailwind `animate-pulse` (Recommended) — already used at LandingPage.tsx:16.
→ **D-04**

**Q:** Anti-flicker: IndexedDB usually loads in <100ms. How to handle?
**A:** Show immediately (Recommended) — render skeleton on first paint when `isLoading` is true. No debounce, no minimum display.
→ **D-05**

### Marketing surfaces scope

**Q:** What should be inside Phase 9's scope?
**A:** Three list screens only (Recommended) — per UI-05 verbatim. Calculator tab and marketing surfaces render immediately.
→ **D-06**

### Follow-up decisions

**Q:** CostCalculator empty-dropdown flash during initial load?
**A:** Acceptable (Recommended) — no special handling. Brief moment matches post-onboarding state.
→ **D-07**

**Q:** NEW badge for skeleton-loading?
**A:** No badge (Recommended) — falls on Phase 7 (invisible) side of the visibility line. Skeletons disappear after load.
→ **D-08**

**Q:** Inline "Loading…" sweep across other components?
**A:** Just App.tsx (Recommended) — surgical scope, defer broader sweep to a follow-up phase.
→ **D-09**

## Decisions Summary

11 decisions locked (D-01 through D-11). 3 follow-up decisions added beyond the four primary gray areas. All decisions follow Recommended option (user accepted senior-developer defaults across the board).

## Deferred ideas

- Broader inline "Loading…" sweep across modals — own polish phase if needed
- CostCalculator selector skeleton — only if empty-dropdown flash becomes user-visible
- Skeleton variants beyond line/card/circle — add as needed
