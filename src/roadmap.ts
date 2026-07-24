// Public roadmap data for the /roadmap page.
//
// Keep this HONEST — only list genuinely user-facing work, and place each item
// at the stage it is actually at. As work progresses, move an item to the next
// stage (research → planning → in-development). When it ships, REMOVE it from
// here: the /features comparison table and /changelog become its home. This is
// a direction-of-travel board, not a dated commitment.

export type RoadmapStage = 'research' | 'planning' | 'in-development';

export interface RoadmapItem {
  title: string;
  description: string;
  stage: RoadmapStage;
  /** Optional external link (e.g. a Discord invite) surfaced as a CTA on the card. */
  href?: string;
  /** CTA link text. Defaults to "Learn more" if omitted. */
  hrefLabel?: string;
  /** Marks a genuine paid-tier (Pro) trajectory item. Omit for free-floor items.
   *  Mirrors the "Coming to Pro" strip on /features (Phase 45-13) — keep both
   *  in sync. Honesty contract holds: remove pro (and the item) on ship. */
  pro?: boolean;
}

export const roadmapItems: RoadmapItem[] = [
  {
    title: 'Per-marketplace pricing optimization',
    description:
      'Set channel-specific target prices so Etsy, Amazon, and TikTok each hit your margin after their different fees — computed locally, no account needed.',
    stage: 'research',
  },
  {
    title: 'Live marketplace order sync',
    description:
      'Pull orders straight from Etsy (90-day order history via the Etsy API) and other storefronts so cost and profit are tracked without manual entry. Needs a secure connection layer that is still in design.',
    stage: 'research',
    pro: true,
  },
  {
    title: 'Live shipping rates & labels',
    description:
      'Real carrier rates and printable labels inside 3DCoster, so the shipping cost baked into your price matches what you actually pay.',
    stage: 'research',
    pro: true,
  },
  {
    title: 'QuickBooks accounting sync',
    description:
      'Push sales and fees straight into QuickBooks so your books reconcile without re-entering every order by hand. Scoping which QuickBooks API tier this needs.',
    stage: 'research',
    pro: true,
  },
  {
    title: 'Use 3DCoster in your language',
    description:
      'The app is English-only today. Because 3DCoster is open source, the plan is to let the community translate it — numbers and currency already format per-region. We are scoping the groundwork now. If you would like to help translate, come say hi.',
    stage: 'research',
    href: 'https://github.com/Waarangel/3dcoster',
    hrefLabel: 'Help translate',
  },
  {
    title: 'More currencies',
    description:
      'Today you can price in 18 currencies. The FX data behind the scenes already covers 200+, so this is mostly about expanding the picker and labels to match — a well-scoped, low-effort follow-up post-launch.',
    stage: 'planning',
  },
  {
    title: 'Green-print nudge',
    description:
      'A grid-carbon-aware suggestion ("run at 2am, save $X and cut carbon") using a free grid-carbon API, so time-of-use pricing can factor in when the grid is cleanest, not just cheapest.',
    stage: 'research',
  },
];

export interface StageMeta {
  id: RoadmapStage;
  label: string;
  blurb: string;
}

// Ordered left → right as work flows through it.
export const STAGES: StageMeta[] = [
  { id: 'research', label: 'Research', blurb: 'Exploring whether and how to build it.' },
  { id: 'planning', label: 'Planning', blurb: 'Scoped and being designed — build is next.' },
  { id: 'in-development', label: 'In Development', blurb: 'Actively being built right now.' },
];
