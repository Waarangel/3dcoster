# Product

## Register

brand

> The marketing site (`/`, `/features`, `/download`, `/faq`, `/roadmap`, `/changelog`)
> is **brand** — design is the product; a visitor's impression is the thing being made.
> The calculator itself (`/app`) is **product** (design serves the workflow) and keeps
> its own dense, data-forward dark UI. This document governs the brand surfaces.

## Users

Hobbyist and small-scale 3D-printing sellers — people who run a printer (or a few) in a
spare room or garage and sell prints on Etsy, Facebook Marketplace, and Kijiji. They are
makers first, not accountants. Their recurring pain: they *think* a print costs them
$4 of filament, set the price around that, and quietly lose money once electricity,
printer depreciation, nozzle wear, labour, packaging, shipping, and marketplace fees are
counted. They want a trustworthy answer to one question — *"what does this print actually
cost me, and what should I charge?"* — without a spreadsheet or an accounting course.

## Product Purpose

3DCoster computes the **true, fully-loaded cost per print** and turns it into a confident
price. It accounts for the costs makers habitually ignore, tracks break-even per model,
and works free in the browser or offline on the desktop with all data kept on-device.
Success looks like a seller saying *"I had no idea I was underpricing — now I know my
real number."* The product's north star is **cost truth**: replacing guesswork with an
honest figure the seller can stand behind.

## Brand Personality

Calm, approachable, and quietly credible. Three words: **honest, calm, grounded.**
It speaks like a knowledgeable workshop friend, not a hype-driven SaaS funnel — plain
language, no jargon, no pressure. The emotional goal is **relief and confidence**: the
maker should feel the intimidating money question has been made simple and trustworthy.
Warmth over flash; clarity over cleverness.

## Anti-references

- **Generic SaaS template.** No centered-hero-over-gradient-blob, no uniform 3×2 card
  grid, no tiny tracked-uppercase eyebrows above every section, no `bg-clip-text`
  gradient headlines. If it could be any B2B SaaS, it has failed.
- **Childish 3D-print clip-art.** No cartoon filament mascots, hand-drawn/doodle SVGs,
  or toy-like playfulness. Makers want to be taken seriously.
- **Loud / cluttered marketing.** No badge soup, popups, neon gradients, or competing
  CTAs. Calm restraint is the whole point.
- **Generic dark SaaS dashboard-landing.** The site IS dark — but anchored on the brand
  blue (`#1796FF`) with real depth and a hero that *demonstrates* cost truth. The failure
  mode to avoid is the flat, cold blue-slate template the site used before: dark for dark's
  sake, with no idea behind it.

## Design Principles

1. **Cost truth, visually.** The design should feel as honest and unembellished as the
   number it sells. Show the real product (real app screenshots), not abstract hero art.
2. **Calm is a feature.** Generous whitespace, one accent, quiet motion. The site should
   lower the visitor's blood pressure, mirroring the relief the product delivers.
3. **Approachable, not corporate.** Friendly display type, calm pacing, plain language, and
   a deep blue-ink canvas signal a tool made by a real maker — never stiff, enterprise-cold B2B.
4. **Earn every flourish.** Motion, color, and emphasis appear only where they clarify or
   guide. Restraint with intent — never decoration for its own sake.
5. **Free-first honesty.** The generosity of the product (free forever, offline, no
   account, data on-device) is a brand value; say it plainly and let it breathe.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA**. Body text ≥ 4.5:1, large text ≥ 3:1, verified against the deep
  blue-ink background (the palette was chosen with contrast measured, not eyeballed).
- **Reduced motion is honored** app-wide via `prefers-reduced-motion` (a global rule in
  `index.css` plus per-component guards using Motion's `useReducedMotion`). Reveals
  collapse to instant; nothing essential is gated on animation.
- Don't encode meaning in color alone (the single green accent is reinforced by label,
  weight, and position). Hover/focus/active states are all explicit and visible.
