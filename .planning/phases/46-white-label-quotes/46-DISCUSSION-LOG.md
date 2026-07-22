# Phase 46: White-label quotes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 46-white-label-quotes
**Areas discussed:** Branding scope, Pro gating & lapse, Hosted page depth, Free-user upsell surface

---

## Branding scope

| Option | Description | Selected |
|--------|-------------|----------|
| Logo + business name | Logo upload + existing business name on both PDF and hosted page; matches the /features pill promise ("your logo") | ✓ |
| Text-only white-label | Just remove the 3DCoster footers; fastest but the /features pill would need rewording | |
| Full brand kit | Logo + accent color + website/contact block; pushes past the "days" estimate | |

**User's choice:** Logo + business name

| Option | Description | Selected |
|--------|-------------|----------|
| Logo is Pro-only | Logo + footer removal ship as one Pro package; fits "paid when the tool wears your brand" | ✓ |
| Logo free, footer removal Pro | More generous free floor, blurs the white-label pitch | |

**User's choice:** Logo is Pro-only

| Option | Description | Selected |
|--------|-------------|----------|
| Settings → Branding section | Dedicated Branding area in Settings with Pro chip for free users | ✓ |
| Inside the quote modal | Closer to moment of use but branding is account-level | |
| Both | Settings home + quote-modal shortcut | |

**User's choice:** Settings → Branding section

| Option | Description | Selected |
|--------|-------------|----------|
| Logo + name together | Logo above/beside the name text block; both always render | ✓ |
| Logo replaces the name | Text name only when no logo exists | |
| You decide | Claude picks during planning | |

**User's choice:** Logo + name together

---

## Pro gating & lapse

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic when Pro | Pro = white-label, no switch | ✓ |
| Settings toggle, default on | Lets a maker keep the 3DCoster footer deliberately | |

**User's choice:** Automatic when Pro

| Option | Description | Selected |
|--------|-------------|----------|
| Revert fully, keep the data | Footer returns + logo stops rendering on new PDFs; upload kept locally | ✓ |
| Logo stays, footer returns | Softer downgrade, leaks Pro-only logo into free tier | |
| You decide | | |

**User's choice:** Revert fully, keep the data

| Option | Description | Selected |
|--------|-------------|----------|
| Cached entitlement wins | Last-known-good entitlement applies offline | ✓ |
| Strict live check | Offline = footer; punishes legitimate Pro users | |

**User's choice:** Cached entitlement wins

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, web-only this phase | Consistent with D-12 posture; desktop white-label with the planned follow-up | |
| Pull desktop auth into 46 | Desktop gets white-label now; expands the phase | ✓ |

**User's choice:** Pull desktop auth into 46 — **scope expansion**; desktop Pro parity (D-12 follow-up) absorbed into this phase

| Option | Description | Selected |
|--------|-------------|----------|
| Email OTP code entry | 6-digit code typed into the desktop app; no protocol registration | ✓ |
| Deep-link (3dcoster:// protocol) | Slicker but per-OS registration + flaky Linux edges | |
| You decide via research | | |

**User's choice:** Email OTP code entry

---

## Hosted page depth

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, remove for all new publishes | Every hosted page wears only the maker's brand | |
| Keep footer unless logo is set | Powered-by stays until the maker configures branding | ✓ |
| Per-quote choice at publish | Checkbox per publish | |

**User's choice:** Keep footer unless logo is set

| Option | Description | Selected |
|--------|-------------|----------|
| Keep them different | PDF footer-free for any Pro; hosted powered-by until logo set | ✓ |
| Same rule everywhere | Simpler mental model, no immediate PDF benefit for logo-less Pro | |

**User's choice:** Keep them different

| Option | Description | Selected |
|--------|-------------|----------|
| Bake at publish | White-label state part of the frozen snapshot; live links never change | ✓ |
| Live check at render | Branding propagates but violates frozen-snapshot model | |

**User's choice:** Bake at publish

| Option | Description | Selected |
|--------|-------------|----------|
| Current design minus 3DCoster marks | Keep dark layout; swap in logo + name, drop powered-by | ✓ |
| Neutral document styling | Light "document" restyle — a page redesign | |
| Maker accent color | Already declined at Branding scope | |

**User's choice:** Current design minus 3DCoster marks

---

## Free-user upsell surface

| Option | Description | Selected |
|--------|-------------|----------|
| Visible Branding section + Pro chip | Logo slot behind a Pro chip; opens pitch modal (mirrors Share-quote D-10) | ✓ |
| Hidden until Pro | Zero noise, zero discovery | |
| Branding section + PDF-modal hint | Two touchpoints; more sell pressure | |

**User's choice:** Visible Branding section + Pro chip

| Option | Description | Selected |
|--------|-------------|----------|
| One modal, full Pro story | Extend ProPitchModal to the Pro bundle from both entry points | ✓ |
| Context-specific pitches | Modal leads with the touched feature | |

**User's choice:** One modal, full Pro story

| Option | Description | Selected |
|--------|-------------|----------|
| All three in-phase | /features pills flip + /pricing gains white-label + /roadmap entries removed | ✓ |
| Pills only, rest at Phase 51 | Batch /pricing and /roadmap into launch-prep | |

**User's choice:** All three in-phase

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Leave in Phase 51 | Paddle PricePreview todo depends on Paddle SKUs (created in Phase 51) | ✓ |
| Fold into Phase 46 | Pull localized-pricing work forward | |

**User's choice:** Leave in Phase 51

## Claude's Discretion

- Logo image constraints (formats, size cap, client-side downscale, preview UX)
- Logo delivery to the hosted page (data-URL in snapshot vs storage mechanism)
- Local logo storage shape + backup/sync inclusion
- Desktop OTP UI shape + desktop session persistence mechanism (research-informed)
- Exact PDF header layout with logo
- NEW-badge registration per conventions
- ProPitchModal bundle copy
- Approval-email branding (only if trivially cheap)

## Deferred Ideas

- Full brand kit (accent color, contact block, themed hosted page)
- Neutral/light document restyle of the hosted page
- Per-quote white-label choice at publish
- Deep-link desktop auth (3dcoster://)
- Approval-email branding as a standalone polish item

## Process notes

- User initially selected "Something else" in the area picker by mistake — confirmed only the four listed areas were intended.
- The desktop-auth answer was a deliberate founder scope expansion, flagged inline during discussion and captured in CONTEXT.md's domain section.
