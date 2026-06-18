# Design

> Visual system for the 3DCoster **brand** surfaces ("Cost-Truth Dark" direction).
> The `/app` calculator keeps its own dense product UI and is out of scope here.
> Strategy, users, and principles live in [PRODUCT.md](./PRODUCT.md).

## Theme

**Deep, calm, brand-blue dark.** Built *around* the 3DCoster logo blue (`#1796FF`) so
the mark belongs instead of fighting the accent. Layered surfaces and controlled glow
give depth — this is a considered dark identity, not a flat cold-slate SaaS template.
The hero **demonstrates the product's thesis** (your true cost is higher than you think)
rather than stating it.

Color strategy: **Restrained + one committed accent.** Deep blue-ink neutrals carry the
surface; the brand blue does all the accent work (well under 10% of the surface) and is
allowed to glow at focal moments (hero card, CTA).

## Color

All values defined in `src/index.css` `:root`. Hex/`rgba` for the brand + neutrals here
(a fixed dark theme; OKLCH was used for the prior light exploration).

| Role | Token | Value | Notes |
| --- | --- | --- | --- |
| Page bg | `--bg` | `#0a0e18` | Deep blue-ink |
| Raised surface | `--surface` | `#121829` | Cards, panels, framed app preview |
| Secondary surface | `--surface-2` | `#18203a` | Secondary buttons, insets, bar track |
| Hairline | `--hairline` | `rgba(255,255,255,0.08)` | 1px borders |
| Hairline (strong) | `--hairline-strong` | `rgba(255,255,255,0.14)` | Secondary-button border |
| Ink (primary) | `--ink` | `#f2f5fb` | Headings/primary — ~16:1 on bg |
| Ink (secondary) | `--ink-soft` | `#a8b3c7` | Body — ~9:1 |
| Ink (tertiary) | `--ink-faint` | `#74809a` | Labels/meta — ~4.7:1 (AA) |
| Brand | `--brand` | `#1796ff` | Primary actions, logo blue |
| Brand (soft) | `--brand-soft` | `#5bb3ff` | Accents, links, icons, text-on-dark |
| Brand (deep) | `--brand-deep` | `#0b6fd4` | Text on a brand-filled surface |
| Brand glow | `--brand-glow` | `rgba(23,150,255,0.32)` | Focal glow (hero card, CTA) only |
| Warm highlight | `--amber` | `#f0b429` | **Support band + genuine warnings only** |
| Warm highlight bg | `--amber-soft` | `rgba(240,180,41,0.14)` | Amber tint surface |

Rules:
- One accent carries the brand: blue is meaning (the product, trust, the "true" number),
  not decoration. Common accent tints: `rgba(23,150,255,0.1)` fill,
  `rgba(23,150,255,0.25)` border, `rgba(23,150,255,0.4)` hover border.
- Amber is quarantined to the support/coffee band and to genuine warnings (e.g. the macOS
  Gatekeeper note) — never decorative.
- Semantic micro-tags only (changelog type tags, "Latest" badge) may use a second hue;
  keep them small and meaning-bearing.
- Never `bg-clip-text` gradients, side-stripe accents, or rainbow icon sets.

## Typography

Display + neutral body, paired on a contrast axis.

- **Display** — `Bricolage Grotesque` (600/700/800), `--font-display` / class `font-display`.
  Friendly, characterful = the "approachable" half of the brand. **All h1/h2/h3 headings.**
  Tracking `-0.02em`, `text-wrap: balance`.
- **Body** — system humanist stack. Calm, fast, neutral; lets the display font carry
  personality. Long prose uses `[text-wrap:pretty]`.

Scale: hero `text-5xl`→`6xl`; section heads `text-3xl`→`4xl`; body `text-base`/`lg`.
Hero clamp max ≤ 6rem. Numerals use `tabular-nums` (the cost card depends on it).

## Motion

**Orchestrated but tasteful.** Library: **Motion** (`motion/react`, v12), isolated into a
marketing-only `motion-vendor` chunk (never loaded by `/app`).

- **Reveal primitive** — `src/components/motion/Reveal.tsx`. `trigger="mount"` for
  above-the-fold (fires on load); `trigger="inView"` + `{ once: true }` for below-fold.
  Branches on `useReducedMotion()`.
- **Signature hero** — `src/components/landing/CostReveal.tsx`: the total **accumulates**
  ($3.20 → $11.80) as each hidden cost lands, bar building in lock-step (spring-smoothed).
  Meaning, not decoration.
- **Easing** — custom curves only: `--ease-out-expo` `cubic-bezier(0.16,1,0.3,1)`.
- **Duration** — UI feedback < 200ms; reveals ~450–650ms; nothing exceeds ~700ms.
- **Press feedback** — CSS `active:scale-[0.98]` (CSS beats JS for high-frequency press).
  Hover = `-translate-y-0.5`/`-translate-y-1` lift + brand border.
- **Reduced motion** — every Motion component collapses to the final state instantly,
  backed by the global `prefers-reduced-motion` rule in `index.css`.

## Components (canonical class patterns)

- **Primary button** — `rounded-xl bg-[var(--brand)] text-white font-semibold … hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:scale-[0.98]` (+ `shadow … var(--brand-glow)` on the hero CTA).
- **Secondary button** — `rounded-xl bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-[var(--ink)] … hover:border-[rgba(23,150,255,0.4)] active:scale-[0.98]`.
- **Card** — `rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] transition duration-200 ease-out` (+ `hover:-translate-y-1 hover:border-[rgba(23,150,255,0.4)]` when interactive). Radius caps at **16px** (`rounded-2xl`); never higher.
- **Feature layout** — asymmetric **bento**: one emphasized lead cell (2/3, soft brand
  corner wash) + a sidekick + a row of compact cells. Icons inline beside titles in
  `--brand-soft` — never a rounded icon-box above the heading.
- **App preview** — real app screenshots framed in a `--surface` panel with a soft shadow.
- **CTA band** — one **drenched** brand-blue panel (white text on `--brand`) with glow:
  the page's focal commit.
- **Header / Footer** — shared, dark; used as-is. (Header carries an unused `variant="light"`
  prop from the earlier light exploration — harmless, non-breaking.)

## Layout

- **Two section widths only.** Primary rail `max-w-6xl` (hero, gallery, features, footer —
  edges line up vertically down the page). Focal cards `max-w-4xl` (CTA, support). Don't
  introduce 5xl/3xl/2xl as *section* containers (inner text blocks may cap at `max-w-2xl`
  for line length).
- Horizontal gutter `px-6` everywhere; first section under the fixed header gets `pt-32`.
- Fluid vertical rhythm — vary section spacing, don't pad uniformly.
- Tested for zero horizontal overflow at 320/375/768/1024/1440.

## Bans (enforced)

Inherits impeccable's absolute bans. Project-specific: no gradient text, no side-stripe
accents, no rainbow feature icons, no rounded icon-box-above-heading, no tracked-uppercase
eyebrows on every section, no childish/doodle illustration, no badge clutter, no card
radius above 16px.
