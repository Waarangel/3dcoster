import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';
import { roadmapItems, STAGES } from '../roadmap';
import type { RoadmapStage, RoadmapItem } from '../roadmap';

const itemsForStage = (stage: RoadmapStage) => roadmapItems.filter((i) => i.stage === stage);
const stageMeta = (stage: RoadmapStage) => STAGES.find((s) => s.id === stage);

// The journey: the three real stages + a "Ships" destination. The connector
// leading INTO each node intensifies toward the brand as work nears shipping.
interface JourneyNode {
  id: RoadmapStage | 'ships';
  label: string;
  count: number | null;
  into: string | null; // colour of the segment entering this node
  active?: boolean;
}

function StageLink({ item }: { item: RoadmapItem }) {
  if (!item.href) return null;
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-soft)] transition-colors hover:text-[var(--brand)]"
    >
      {item.hrefLabel ?? 'Learn more'}
      <span aria-hidden="true">→</span>
    </a>
  );
}

/** Earlier stages (research / planning) render as a light editorial ruled list. */
function StageList({ items }: { items: RoadmapItem[] }) {
  return (
    <div className="grid sm:grid-cols-2 sm:gap-x-10">
      {items.map((item) => (
        <div key={item.title} className="flex items-start gap-4 py-5 border-t border-[var(--hairline)]">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full border border-[var(--ink-faint)]" />
          <div>
            <h3 className="font-display font-semibold text-[var(--ink)]">{item.title}</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)] leading-relaxed">{item.description}</p>
            <StageLink item={item} />
          </div>
        </div>
      ))}
    </div>
  );
}

function JourneyDot({ node }: { node: JourneyNode }) {
  if (node.id === 'ships') {
    return (
      <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--bg)]">
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (node.active) {
    return (
      <span className="relative z-10 flex h-5 w-5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--brand)] opacity-40 animate-ping" />
        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--brand)]" />
      </span>
    );
  }
  const ring = node.id === 'planning' ? 'border-[var(--ink-soft)]' : 'border-[var(--ink-faint)]';
  return <span className={`relative z-10 inline-block h-4 w-4 rounded-full border-2 ${ring} bg-[var(--bg)]`} />;
}

export function RoadmapPage() {
  const research = itemsForStage('research');
  const planning = itemsForStage('planning');
  const inDev = itemsForStage('in-development');

  const journey: JourneyNode[] = [
    { id: 'research', label: 'Research', count: research.length, into: null },
    { id: 'planning', label: 'Planning', count: planning.length, into: 'rgba(116,128,154,0.55)' },
    { id: 'in-development', label: 'In development', count: inDev.length, into: 'rgba(91,179,255,0.5)', active: true },
    { id: 'ships', label: 'Ships', count: null, into: 'var(--brand)' },
  ];

  // Item sections, most-advanced first (feature what's closest to shipping).
  const earlierStages: RoadmapStage[] = ['planning', 'research'];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-10 px-6">
        <div className="hero-aura pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <Reveal trigger="mount" className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-[var(--ink)]">Roadmap</h1>
          <p className="mt-5 text-lg text-[var(--ink-soft)] max-w-xl mx-auto leading-relaxed [text-wrap:balance]">
            Where 3DCoster is headed — what we&apos;re researching, planning, and actively building.
            A direction of travel, not a dated promise.
          </p>
        </Reveal>
      </section>

      {/* Journey spine */}
      <section className="pb-16 px-6">
        <Reveal trigger="inView" className="max-w-3xl mx-auto">
          <div className="flex">
            {journey.map((node, i) => {
              const leftColor = node.into ?? 'transparent';
              const rightColor = journey[i + 1]?.into ?? 'transparent';
              return (
                <div key={node.id} className="flex-1 flex flex-col items-center">
                  <div className="flex h-5 w-full items-center">
                    <div className="h-0.5 flex-1" style={{ background: leftColor }} />
                    <span className="shrink-0 mx-1.5"><JourneyDot node={node} /></span>
                    <div className="h-0.5 flex-1" style={{ background: rightColor }} />
                  </div>
                  <div className="mt-3 px-1 text-center">
                    <div className={`text-sm font-semibold ${node.active ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}>
                      {node.label}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--ink-faint)]">
                      {node.count === null ? 'the goal' : `${node.count} ${node.count === 1 ? 'item' : 'items'}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* In development — featured */}
      {inDev.length > 0 && (
        <section className="pb-14 px-6">
          <Reveal trigger="inView" className="max-w-5xl mx-auto">
            <div className="max-w-2xl mb-8">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">Building right now</h2>
              <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{stageMeta('in-development')?.blurb}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {inDev.map((item) => (
                <article
                  key={item.title}
                  className="relative overflow-hidden rounded-2xl border border-[rgba(23,150,255,0.3)] bg-[var(--surface)] p-7 transition duration-200 ease-out hover:border-[rgba(23,150,255,0.5)]"
                >
                  <div
                    className="pointer-events-none absolute -right-12 -top-12 w-44 h-44 rounded-full opacity-70"
                    style={{ background: 'radial-gradient(circle, rgba(23,150,255,0.16), transparent 70%)' }}
                    aria-hidden="true"
                  />
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-soft)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--brand)] opacity-50 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                    </span>
                    In development
                  </span>
                  <h3 className="font-display text-xl font-bold text-[var(--ink)] mt-3">{item.title}</h3>
                  <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{item.description}</p>
                  <StageLink item={item} />
                </article>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* Earlier stages — light editorial lists */}
      {earlierStages.map((stage) => {
        const items = itemsForStage(stage);
        if (items.length === 0) return null;
        const meta = stageMeta(stage);
        const heading = stage === 'planning' ? 'Scoped & being planned' : 'On the research bench';
        return (
          <section key={stage} className="pb-14 px-6">
            <Reveal trigger="inView" className="max-w-5xl mx-auto">
              <div className="max-w-2xl mb-2">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)]">{heading}</h2>
                <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{meta?.blurb}</p>
              </div>
              <StageList items={items} />
            </Reveal>
          </section>
        );
      })}

      {/* CTA */}
      <section className="py-8 pb-20 px-6">
        <Reveal trigger="inView" className="max-w-4xl mx-auto text-center">
          <div className="rounded-3xl border border-[rgba(23,150,255,0.25)] bg-[rgba(23,150,255,0.08)] p-10 sm:p-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">Want something on this board?</h2>
            <p className="mx-auto mt-3 mb-8 text-[var(--ink-soft)] max-w-xl leading-relaxed [text-wrap:balance]">
              The roadmap is shaped by what sellers actually ask for. Tell us what would make 3DCoster
              more useful — it might be the next thing we pick up.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                to="/feedback"
                className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[var(--brand)] text-white font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]"
                style={{ boxShadow: '0 8px 30px -8px var(--brand-glow)' }}
              >
                Request a feature
              </Link>
              <a
                href="https://github.com/Waarangel/3dcoster/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-[var(--ink)] font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(23,150,255,0.4)] active:translate-y-0 active:scale-[0.98]"
              >
                Open an issue on GitHub
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
