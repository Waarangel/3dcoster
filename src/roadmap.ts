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
}

export const roadmapItems: RoadmapItem[] = [
  {
    title: 'PDF sales report',
    description:
      'A clean, printable summary of your sales — totals, revenue by marketplace, fees, and profit for any month or year. Made for tax season and anyone who asks for "something official".',
    stage: 'planning',
  },
  {
    title: 'Per-marketplace pricing optimization',
    description:
      'Set channel-specific target prices so Etsy, Amazon, and TikTok each hit your margin after their different fees — computed locally, no account needed.',
    stage: 'research',
  },
  {
    title: 'Live marketplace order sync',
    description:
      'Pull orders straight from Etsy and other storefronts so cost and profit are tracked without manual entry. Needs a secure connection layer that is still in design.',
    stage: 'research',
  },
  {
    title: 'Live shipping rates & labels',
    description:
      'Real carrier rates and printable labels inside 3DCoster, so the shipping cost baked into your price matches what you actually pay.',
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
