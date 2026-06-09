import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { roadmapItems, STAGES } from '../roadmap';
import type { RoadmapStage, RoadmapItem } from '../roadmap';

// Full literal class strings per stage so Tailwind keeps them in the build.
const stageStyles: Record<RoadmapStage, { bar: string; count: string; hover: string }> = {
  research: {
    bar: 'bg-indigo-500',
    count: 'bg-indigo-500/15 text-indigo-300',
    hover: 'hover:border-indigo-500/50',
  },
  planning: {
    bar: 'bg-blue-500',
    count: 'bg-blue-500/15 text-blue-300',
    hover: 'hover:border-blue-500/50',
  },
  'in-development': {
    bar: 'bg-emerald-500',
    count: 'bg-emerald-500/15 text-emerald-300',
    hover: 'hover:border-emerald-500/50',
  },
};

function RoadmapCard({ item, hover }: { item: RoadmapItem; hover: string }) {
  return (
    <div
      className={`bg-slate-800/60 border border-slate-700 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 ${hover}`}
    >
      <h3 className="text-white font-semibold leading-snug mb-2">{item.title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
      {item.href && (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Roadmap</h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Where 3DCoster is headed — what we're researching, what's being planned, and what's
            actively in the works. A direction of travel, not a dated promise.
          </p>
        </div>
      </section>

      {/* Board */}
      <section className="pb-16 px-6">
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3 items-start">
          {STAGES.map((stage) => {
            const items = roadmapItems.filter((item) => item.stage === stage.id);
            const styles = stageStyles[stage.id];
            return (
              <div key={stage.id} className="flex flex-col">
                {/* Column header */}
                <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800/40 mb-4">
                  <div className={`h-1 ${styles.bar}`} />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-white font-semibold">{stage.label}</h2>
                      <span
                        className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold ${styles.count}`}
                      >
                        {items.length}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm">{stage.blurb}</p>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-4">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <RoadmapCard key={item.title} item={item} hover={styles.hover} />
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-700 rounded-xl p-5 text-center text-slate-500 text-sm">
                      Nothing here right now.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-2xl p-12 border border-blue-500/20">
            <h2 className="text-2xl font-bold text-white mb-4">Want something on this board?</h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              The roadmap is shaped by what sellers actually ask for. Tell us what would make
              3DCoster more useful — it might be the next thing we pick up.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                to="/feedback"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-semibold shadow-lg shadow-blue-500/25"
              >
                Request a Feature
              </Link>
              <a
                href="https://github.com/Waarangel/3dcoster/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-semibold"
              >
                Open an Issue on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
