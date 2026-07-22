# Phase 46: White-label quotes - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Pro users can present quotes under their own brand: (1) **white-label PDF quotes** — today every quote PDF ends with `Made with 3DCoster — 3dcoster.com` (`src/pdf/generateQuotePdf.ts:294`); (2) a **white-label hosted quote page** — today `/q/[token]` renders "Powered by 3DCoster" (`api/q/[token].ts:206`). Both gain maker **logo + business name** branding. The two /features "Coming" pills for white-label flip to shipped Pro pills.

**Scope expansion (founder decision this discussion):** desktop (Tauri) Pro sign-in — the Phase 43 D-12 "pre-launch follow-up" — lands **in this phase** via email OTP code entry, so white-label works on desktop too. This moves the phase past its original "days" estimate and requires research (Supabase OTP flow in Tauri, session persistence).

**Free floor untouched:** free-tier PDFs keep the "Made with 3DCoster" footer (locked since v1.2). No auth-gated features enter the free-floor path (PRO-01 boundary stands).

</domain>

<decisions>
## Implementation Decisions

### Branding scope
- **D-01: Logo + business name.** White-label = maker logo (new upload) + existing `UserProfile.name`, on both the PDF and the hosted page. This matches the /features pill promise ("your logo") — required for the shipped-only honesty rule when the pill flips. NOT a full brand kit: no accent colors, no custom contact block this phase.
- **D-02: Logo is Pro-only.** Logo rendering + footer removal ship as one Pro white-label package. Fits the free/paid line "paid when the tool wears your brand to your customers." Free tier stays exactly as today.
- **D-03: Settings → Branding section** is the single management home (logo upload + preview, alongside the existing business-name field). Not managed in the quote modal.
- **D-04: Logo + name render together** on the quote header (logo above/beside the existing business-name text block; both always render). No layout branching for logo-replaces-name.

### Pro gating & lapse
- **D-05: Automatic when Pro — no toggle.** Footer disappears and logo renders as soon as `isProStatus` is true (active + past_due, locked vocabulary in `src/hooks/useEntitlement.ts`). No "include 3DCoster footer" switch.
- **D-06: Lapse reverts fully, keeps the data.** On canceled/signed-out: footer returns and logo stops rendering on NEW PDFs; the uploaded logo stays stored locally so re-subscribing restores white-label instantly. Lapsed = free tier, cleanly.
- **D-07: Cached entitlement wins offline.** Last-known-good entitlement (persisted session) applies when Supabase is unreachable — a paying user offline still gets branded PDFs. Accept the small window where a just-canceled user generates a few white-label PDFs.
- **D-08: Desktop Pro auth ships in this phase** (scope expansion). Mechanism: **email OTP code entry** — the same Supabase email flow delivers a 6-digit code the user types into the desktop app. NO custom-protocol deep-link (`3dcoster://`), no per-OS protocol registration. Session persistence mechanism on desktop (keyring vs equivalent) is research territory.

### Hosted page depth
- **D-09: Hosted powered-by stays until a logo is set.** Publishing while Pro but with no logo configured keeps the "Powered by 3DCoster" footer; once the maker uploads a logo, new publishes are fully white-label. Preserves the organic-marketing loop for passive publishers.
- **D-10: PDF and hosted page deliberately differ.** PDF: footer gone for ANY Pro user (private deliverable, immediate value). Hosted page: powered-by until logo set (public page, attribution until real branding exists). Do not "align" them.
- **D-11: White-label bakes into the frozen publish snapshot.** Logo + footer state are part of the snapshot at publish time. Already-live links never change (consistent with Phase 43 D-13 frozen snapshots + D-11 lapse-safe links). Branding update path = unpublish → republish, same as any quote change.
- **D-12: Hosted page keeps its current design minus 3DCoster marks.** No neutral-document restyle, no maker accent color — swap in logo + name, drop the powered-by line.

### Free-user upsell surface
- **D-13: Branding section visible to all, Pro-chipped.** Free users see the Branding section with the logo slot behind a Pro chip; interacting opens the Pro pitch modal. Mirrors the Share-quote D-10 pattern from Phase 43. No banners, no toasts, no extra hints in the PDF modal.
- **D-14: One pitch modal, full Pro story.** Extend the existing `ProPitchModal` to present the Pro bundle (hosted quote links + white-label), shown from both entry points (Share quote, Branding section). One monetization voice.
- **D-15: All three marketing flips in-phase.** (a) the two /features "Coming" pills (`src/pages/FeaturesPage.tsx:496-497`) flip to shipped Pro pills; (b) /pricing's Pro card gains white-label; (c) the white-label entries come OFF /roadmap (shipped-only honesty rule). Remaining Coming pills flip in their own phases / Phase 51.

### Claude's Discretion
- Logo image constraints: accepted formats, size cap, client-side downscale/compression strategy, preview UX
- Logo delivery to the hosted page: data-URL embedded in the publish snapshot vs a storage mechanism (weigh row size vs infra; snapshot embedding is the frozen-snapshot-consistent default)
- Logo storage locally (Dexie field/blob shape on UserProfile or a dedicated store) + backup/restore + file-sync inclusion (follow additive-schema + backupSchema conventions)
- Desktop OTP UI shape (where the code-entry field lives in the existing SignInModal flow) and desktop session persistence mechanism (research-informed)
- Exact PDF header layout with logo (positioning, max dimensions on the page)
- NEW-badge registration per `src/features.ts` conventions (Branding section is user-facing → badge; follow the absolute-overlay rule)
- ProPitchModal copy for the bundle pitch
- Whether the approval-notification email needs any branding touch (out of the core promise; only if trivially cheap)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The two footers being white-labelled
- `src/pdf/generateQuotePdf.ts` — the jsPDF quote engine; line ~294 renders `Made with 3DCoster — 3dcoster.com`; header currently renders `UserProfile.name` text only. `src/pdf/generateQuotePdf.test.ts` covers the footer.
- `api/q/[token].ts` — hosted quote page renderer; line ~206 "Powered by 3DCoster" footer; `HostedSnapshot` contract already carries optional `businessName` + `variantsSnapshot` — the logo must join this snapshot shape (D-11).
- `src/hooks/usePublishedQuote.ts` — publish snapshot assembly (`businessName` trimming precedent); where the logo joins the publish payload.

### Entitlement & Pro surfaces
- `src/hooks/useEntitlement.ts` — `isProStatus` locked vocabulary (active + past_due); the single home of Pro-status logic; D-05/D-06/D-07 gate through this.
- `src/components/pro/ProPitchModal.tsx` (+ test) — the one pitch modal to extend for the bundle story (D-14).
- `src/components/pro/SignInModal.tsx` — magic-link sign-in; desktop OTP entry (D-08) extends this flow.
- `src/components/pro/ShareQuoteButton.tsx` — the existing Pro-chip + pitch pattern D-13 mirrors.

### Marketing flip targets
- `src/pages/FeaturesPage.tsx` — lines ~496-497: the two white-label rows with `<ComingCell />`; the `PHASE-51-LAUNCH-PREP` flip-marker comment (~line 150) documents the flip convention; intro paragraph (~line 433) mentions "white-label branding … on the way" and needs rewording.
- `src/pages/PricingPage.tsx` + `src/pricing.ts` — Pro card feature list gains white-label; do NOT touch price constants.
- `src/data/roadmap.ts` — Pro-badged white-label roadmap entries to remove (45-13 kept the /features Coming strip in comment-lockstep with `roadmap.ts` `pro:true` items — keep that lockstep when removing).

### Prior-phase decision sources (carry-forward constraints)
- `.planning/phases/43-pro-backend/43-CONTEXT.md` — D-05 (maker brand + powered-by baseline this phase supersedes), D-11 (lapse-safe links), D-12 (web-first; the desktop-parity follow-up this phase absorbs), D-13 (frozen snapshots), D-10 (one pitch modal).
- `docs/DATA-FLOW-INVENTORY.md` — inventory-first rule: uploading a logo into the publish snapshot is a NEW server-side data flow → update inventory first, `/privacy` policy second (Phase 42 C-05 defense).
- `docs/PRO-SECURITY-REVIEW.md` — the hosted endpoint's security posture; logo-in-snapshot and any storage decision must not regress the PRO-03 review assumptions (no PII beyond first name; check whether a logo image alters the CDN-cache stance).
- `.planning/ROADMAP.md` §Phase 46 — goal text; §Phase 51 — the launch-prep flips this phase must NOT pre-empt beyond its own two pills.

### Type & schema conventions
- `src/types.ts` §UserProfile — current brand data is `name?: string` only; new logo field(s) follow the additive-optional convention (no Dexie bump if non-indexed).
- `src/utils/backupSchema.ts` (and sync contract from Phase 44) — any new persisted field must be reflected per the established backup/sync inclusion rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UserProfile.name` — already renders on the PDF (header) and hosted page (`businessName` eyebrow); white-label extends this existing plumbing rather than inventing a branding pipeline
- `useEntitlement` / `isProStatus` — the exact gate D-05 needs; already consumed by `usePublishedQuote`'s publish gate
- `ProPitchModal` + `ShareQuoteButton` Pro-chip pattern — the upsell surface (D-13/D-14) is a straight reuse
- `SignInModal` (magic link) — Supabase `signInWithOtp` already underlies it; OTP code entry is an additive verification path, not a new auth system
- jsPDF engine already embeds images for nothing today — jsPDF `addImage` handles the logo; the Quote Variants tier-table precedent shows how the engine takes additive branches
- `src/features.ts` NEW-badge registry — Branding section registration

### Established Patterns
- Additive-optional schema fields, no Dexie bump when non-indexed (Phase 41 precedent) — logo field follows
- Frozen publish snapshot + lapse-safe links (Phase 43) — D-11 white-label-at-publish is the same philosophy
- Regex-guard tests as content locks (TermsPage price, Privacy processors) — consider one asserting the free-tier PDF footer never disappears
- `!__IS_TAURI__` compile-time gating — now partially inverted: Pro UI must ENABLE on desktop (OTP path) instead of hiding; audit existing web-only gates from 43-03
- Inventory-first GDPR rule — logo upload to Supabase is a new data flow; DATA-FLOW-INVENTORY.md then privacy policy, before code ships
- Shipped-only honesty on /features — pills flip only when the described capability (logo!) actually works

### Integration Points
- `src/pdf/generateQuotePdf.ts` header + footer (both change under entitlement)
- `api/q/[token].ts` HTML template (logo render + conditional footer from snapshot)
- `usePublishedQuote` publish payload (logo joins snapshot)
- Settings surface (new Branding section) + `SignInModal` (desktop OTP)
- `FeaturesPage.tsx` / `PricingPage.tsx` / `roadmap.ts` (marketing flips)
- Free-floor no-network E2E (`e2e/free-floor-no-network.spec.ts`) must stay green — branding additions cannot introduce network calls into the signed-out path

</code_context>

<specifics>
## Specific Ideas

- The /features pill copy is the promise: "White-label PDF quotes (**your logo**, no 'Made with 3DCoster' footer)" — logo support is what makes the flip honest
- The powered-by-until-logo rule (D-09) is deliberate strategy: makers who invest in branding get full white-label; passive publishers keep carrying 3DCoster attribution on public pages
- PDF vs hosted asymmetry (D-10) is intentional, not an oversight — private deliverable vs public page

</specifics>

<deferred>
## Deferred Ideas

- **Full brand kit** (accent color, custom contact block, themed hosted page) — declined this phase; potential future white-label deepening
- **Neutral/light "document" restyle of the hosted page** — considered, declined; revisit if maker feedback says the dark theme reads as 3DCoster's brand
- **Per-quote white-label choice at publish** — declined in favor of the logo-set rule (D-09)
- **Deep-link desktop auth (`3dcoster://`)** — declined in favor of OTP code entry; revisit if OTP friction shows up in real usage
- **Approval-email branding** — not part of the core promise; only if trivially cheap (Claude's discretion), otherwise a future polish item

### Reviewed Todos (not folded)
- **Paddle PricePreview localized pricing** (`.planning/todos/pending/paddle-price-preview-localized-pricing.md`) — weak keyword match (0.4); explicitly `resolves_phase: 51` (requires Paddle SKUs created in launch-prep). Stays in Phase 51.

</deferred>

---

*Phase: 46-white-label-quotes*
*Context gathered: 2026-07-22*
