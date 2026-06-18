import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';
import { roadmapItems, STAGES } from '../roadmap';
import type { RoadmapStage, RoadmapItem } from '../roadmap';

// Per-stage accents harmonized into the dark token palette. Stages stay
// distinguishable (bar colour + count tint), with the brand-blue family
// reserved for the active "In Development" column and neutral ink tints for
// the earlier research/planning stages.
const stageStyles: Record<RoadmapStage, { bar: string; count: string; hover: string }> = {
  research: {
    bar: 'bg-[var(--surface-2)]',
    count: 'bg-[var(--surface-2)] text-[var(--ink-faint)]',
    hover: 'hover:border-[var(--hairline-strong)]',
  },
  planning: {
    bar: 'bg-[var(--ink-faint)]',
    count: 'bg-[var(--surface-2)] text-[var(--ink-soft)]',
    hover: 'hover:border-[var(--hairline-strong)]',
  },
  'in-development': {
    bar: 'bg-[var(--brand)]',
    count: 'bg-[rgba(23,150,255,0.1)] text-[var(--brand-soft)]',
    hover: 'hover:border-[rgba(23,150,255,0.4)]',
  },
};

function RoadmapCard({ item, hover }: { item: RoadmapItem; hover: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5 transition duration-200 ease-out hover:-translate-y-1 ${hover}`}
    >
      <h3 className="font-display text-[var(--ink)] font-semibold leading-snug mb-2">{item.title}</h3>
      <p className="text-[var(--ink-soft)] text-sm leading-relaxed">{item.description}</p>
      {item.href && (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[var(--brand-soft)] transition-colors hover:text-[var(--brand)]"
        >
          {item.hrefLabel ?? 'Learn more'}
          <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}

export function RoadmapPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <Reveal trigger="mount" className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[var(--ink)] mb-6">Roadmap</h1>
          <p className="text-xl text-[var(--ink-soft)] max-w-2xl mx-auto">
            Where 3DCoster is headed — what we're researching, what's being planned, and what's
            actively in the works. A direction of travel, not a dated promise.
          </p>
        </Reveal>
      </section>

      {/* Board */}
      <section className="pb-16 px-6">
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3 items-start">
          {STAGES.map((stage, i) => {
            const items = roadmapItems.filter((item) => item.stage === stage.id);
            const styles = stageStyles[stage.id];
            return (
              <Reveal key={stage.id} trigger="inView" delay={i * 0.06} className="flex flex-col">
                {/* Column header */}
                <div className="rounded-2xl overflow-hidden border border-[var(--hairline)] bg-[var(--surface)] mb-4">
                  <div className={`h-1 ${styles.bar}`} />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-display text-[var(--ink)] font-semibold">{stage.label}</h2>
                      <span
                        className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold ${styles.count}`}
                      >
                        {items.length}
                      </span>
                    </div>
                    <p className="text-[var(--ink-faint)] text-sm">{stage.blurb}</p>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-4">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <RoadmapCard key={item.title} item={item} hover={styles.hover} />
                    ))
                  ) : (
                    <div className="border border-dashed border-[var(--hairline)] rounded-2xl p-5 text-center text-[var(--ink-faint)] text-sm">
                      Nothing here right now.
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 px-6">
        <Reveal trigger="inView" className="max-w-4xl mx-auto text-center">
          <div className="bg-[rgba(23,150,255,0.1)] rounded-2xl p-12 border border-[rgba(23,150,255,0.25)]">
            <h2 className="font-display text-2xl font-bold text-[var(--ink)] mb-4">Want something on this board?</h2>
            <p className="text-[var(--ink-soft)] mb-8 max-w-xl mx-auto">
              The roadmap is shaped by what sellers actually ask for. Tell us what would make
              3DCoster more useful — it might be the next thing we pick up.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                to="/feedback"
                className="px-8 py-4 bg-[var(--brand)] hover:bg-[var(--brand-soft)] text-white rounded-xl transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] font-semibold"
                style={{ boxShadow: '0 8px 30px -8px var(--brand-glow)' }}
              >
                Request a Feature
              </Link>
              <a
                href="https://github.com/Waarangel/3dcoster/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-[var(--surface-2)] border border-[var(--hairline-strong)] hover:border-[rgba(23,150,255,0.4)] text-[var(--ink)] rounded-xl transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] font-semibold"
              >
                Open an Issue on GitHub
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
