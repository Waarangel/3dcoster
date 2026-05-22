// Static Etsy ToS self-review checklist used by the Phase 14 Etsy compliance helper
// section in CostCalculator. No I/O, no network — see ROADMAP success criterion #3 / ETSY-02.
// The `policySummaryAsOf` date constant is updated each release; the disclaimer rendered above
// the checklist + the live link below it mitigate stale-rule risk per PITFALLS.md m-01.
//
// The 5 `id` values are LOCKED by D-16 because saved `PrintJob.etsyChecks` state on existing
// jobs uses these strings as map keys — renaming an id silently orphans persisted check state.
// `etsyToS.test.ts` enforces this with an equality assertion.

export interface EtsyChecklistItem {
  id: string;
  title: string;
  body: string;
  link?: string;
}

// Date the checklist content was last verified against Etsy's live policy page.
// Bumped each release that touches this file. Must match the `etsy-helper` release
// date in src/features.ts so the user-visible date and the NewBadge gate stay aligned
// (Pitfall 5: a stale date here while the NewBadge gate has already expired would let
// the checklist drift unnoticed).
export const policySummaryAsOf = '2026-05-21';

// Live link to Etsy's Creativity Standards landing page — single source of truth for
// the section's "click to verify the live policy" affordance (D-16, ROADMAP success #4).
export const policyLink = 'https://www.etsy.com/legal/creativity/';

// 5-item self-review checklist (D-16 order LOCKED). Wording biases toward "verify at the
// link" / "see Etsy's policy" rather than asserting hard procedural rules, because Etsy
// has reversed individual rules before (e.g. third-party templates in June 2025) and the
// disclaimer + date + link defend against future drift better than wording can (Pitfall 7).
export const etsyChecklist: readonly EtsyChecklistItem[] = [
  {
    id: 'original-design',
    title: 'Original design',
    body: 'Your listing is your own design or you have rights to sell it. See Etsy\'s policy at the link below for the current definition of "handmade" and original-creator standards.',
  },
  {
    id: 'no-third-party-templates',
    title: 'No off-the-shelf templates',
    body: 'If you used a third-party model or template, confirm the licence permits commercial resale. Etsy\'s rules on resold templates have changed before — verify against the live policy.',
  },
  {
    id: 'ip-copyright',
    title: 'IP and copyright',
    body: 'You hold or have permission for any logos, characters, or trademarks in the print. See Etsy\'s intellectual-property policy at the link below.',
  },
  {
    id: 'production-partner-disclosure',
    title: 'Production-partner disclosure',
    body: 'If anyone outside your household helps print, finish, or ship the order, you have a production partner declared in your shop. See Etsy\'s policy at the link below for what counts.',
  },
  {
    id: 'ai-disclosure',
    title: 'AI disclosure',
    body: 'If AI was used to design the model, your listing discloses that per Etsy\'s current AI-generated-content policy.',
  },
];
