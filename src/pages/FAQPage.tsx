import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';

type Category = 'getting-started' | 'costs' | 'features' | 'technical';

interface FAQItem {
  question: string;
  answer: string;
  category: Category;
}

const faqs: FAQItem[] = [
  // Getting Started
  { category: 'getting-started', question: 'What is 3DCoster?', answer: 'A free cost calculator for 3D printing sellers. It helps you calculate the true cost of each print including filament, electricity, printer depreciation, labor, shipping, and marketplace fees - so you can price your products profitably.' },
  { category: 'getting-started', question: 'Do I need to create an account?', answer: 'No account needed. All your data is stored locally in your browser using IndexedDB. Your data stays on your device and is never sent to any server.' },
  { category: 'getting-started', question: 'Is 3DCoster really free?', answer: 'The core calculator and selling workflow are free to use and open source under the MIT license — no ads, no data collection. If you find it useful, you can support development via Buy Me a Coffee.' },
  { category: 'getting-started', question: 'Can I use it offline?', answer: 'Yes! Install it as a PWA (Progressive Web App) from your browser, or download the desktop app for Windows, macOS, or Linux. Both work fully offline.' },

  // Cost Calculations
  { category: 'costs', question: 'What costs does 3DCoster include?', answer: 'Filament cost, electricity, printer depreciation (with customizable recovery period), nozzle wear, labor (prep + post-processing time), failure rate adjustment, model/STL licensing, shipping (carrier or delivery), packaging materials, and marketplace fees (Etsy, Facebook, etc.).' },
  { category: 'costs', question: 'How does printer depreciation work?', answer: 'You set how long you want to recover your printer cost (e.g., 12 months) and your estimated monthly print hours. The calculator spreads the printer cost over that period. This is a "fixed cost" that gets recovered through sales, not added to each unit.' },
  { category: 'costs', question: 'What is the difference between fixed costs and per-unit costs?', answer: 'Per-unit costs (filament, electricity, labor) are spent every time you print. Fixed costs (printer depreciation, model purchase) are one-time investments recovered over multiple sales. The break-even calculator shows how many units you need to sell to recover fixed costs.' },
  { category: 'costs', question: 'How does the failure rate adjustment work?', answer: 'If you have a 10% failure rate, the calculator increases your per-unit cost to account for the 1-in-10 prints that fail. This ensures you factor in wasted filament and time.' },
  { category: 'costs', question: 'What marketplace fees are supported?', answer: 'Etsy (transaction + payment + listing + offsite ads), Facebook Marketplace (local and shipped), and Kijiji. You can customize the fee percentages in Settings if platforms change their rates.' },

  // Features
  { category: 'features', question: 'Can I track multiple printers?', answer: 'Yes! Add multiple printer instances in Printer Settings. Each tracks its own print hours, purchase price, and recovery period. Useful if you have the same model with different ages or purchase prices.' },
  { category: 'features', question: 'What currencies are supported?', answer: '18 currencies including USD, CAD, EUR, GBP, AUD, and more. Select your currency in User Profile (click the user icon). Currency affects which shipping carriers are shown.' },
  { category: 'features', question: 'How do I add custom shipping carriers?', answer: 'Go to Settings (gear icon) > Shipping tab > scroll to Custom Carriers. Add carriers with a name and default cost. They appear in the shipping dropdown when calculating costs.' },
  { category: 'features', question: 'What are "New" badges?', answer: 'Features added in the last 3 days show a "New" badge. After you see a feature, the badge disappears after 3 days. This helps you discover new functionality.' },

  // Technical
  { category: 'technical', question: 'Where is my data stored?', answer: "In your browser's IndexedDB - a local database that persists even when you close the browser. Nothing is sent to any server. If you clear browser data, your 3DCoster data will be deleted." },
  { category: 'technical', question: 'Can I export my data?', answer: 'Export functionality is on the roadmap. For now, your data is stored in IndexedDB which you can access via browser dev tools if needed.' },
  { category: 'technical', question: 'Will my data sync between devices?', answer: 'Not currently - data is stored locally on each device. Cloud sync is being considered for future versions, with privacy and keeping your data on your own device kept a priority.' },
  { category: 'technical', question: 'Is it open source?', answer: 'Yes! MIT licensed on GitHub. You can view the code, report issues, suggest features, or contribute at github.com/Waarangel/3dcoster.' },
  { category: 'technical', question: 'macOS says the app is "damaged" - what do I do?', answer: 'This happens because the app isn\'t signed with an Apple Developer certificate. It\'s not actually damaged. To fix: Right-click (or Ctrl+click) the app, select "Open", then click "Open" in the dialog. You only need to do this once. Alternatively, run this in Terminal: xattr -cr /Applications/3DCoster.app' },
];

const SECTIONS: { id: Category; label: string }[] = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'costs', label: 'Cost calculations' },
  { id: 'features', label: 'Features' },
  { id: 'technical', label: 'Technical' },
];

const categoryLabel = (id: Category) => SECTIONS.find((s) => s.id === id)?.label ?? id;
const slug = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function FaqRow({
  faq,
  open,
  onToggle,
  showCategory = false,
}: {
  faq: FAQItem;
  open: boolean;
  onToggle: () => void;
  showCategory?: boolean;
}) {
  const id = slug(faq.question);
  return (
    <div className="border-t border-[var(--hairline)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`panel-${id}`}
        id={`trigger-${id}`}
        className="group flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          {showCategory && (
            <span className="hidden sm:inline-flex shrink-0 rounded bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--ink-faint)]">
              {categoryLabel(faq.category)}
            </span>
          )}
          <span className="font-medium text-[var(--ink)] transition-colors group-hover:text-[var(--brand-soft)]">
            {faq.question}
          </span>
        </span>
        <svg
          className={`w-5 h-5 shrink-0 text-[var(--brand-soft)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div id={`panel-${id}`} role="region" aria-labelledby={`trigger-${id}`} className="pb-5 pr-8 text-sm text-[var(--ink-soft)] leading-relaxed">
          {faq.answer}
        </div>
      )}
    </div>
  );
}

export function FAQPage() {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Category>(SECTIONS[0].id);

  const q = query.trim().toLowerCase();
  const matches = q ? faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)) : null;
  const searching = matches !== null;

  const toggle = (question: string) => setOpenQuestion((cur) => (cur === question ? null : question));

  // Scroll-spy: highlight the rail item for the section currently in view.
  useEffect(() => {
    if (searching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id.replace('faq-', '') as Category);
      },
      { rootMargin: '-28% 0px -60% 0px' }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`faq-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [searching]);

  const jumpTo = (id: Category) => {
    const el = document.getElementById(`faq-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      <Header />

      <main className="flex-1 px-6">
        {/* Hero — reassurance + search */}
        <section className="relative overflow-hidden pt-32 pb-10">
          <div className="hero-aura pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
          <Reveal trigger="mount" className="max-w-2xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-[var(--ink)]">Questions? We&apos;ve got answers.</h1>
            <p className="mt-4 text-[var(--ink-soft)] text-lg leading-relaxed [text-wrap:balance]">
              {faqs.length} answers across getting started, costs, features, and the technical bits. The short
              version: free to use, works offline, and your data never leaves your device.
            </p>
            <div className="relative mt-7 max-w-md mx-auto">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the FAQ…"
                aria-label="Search the FAQ"
                className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] py-3 pl-11 pr-4 text-[var(--ink)] placeholder-[var(--ink-faint)] transition-colors focus:outline-none focus:border-[rgba(23,150,255,0.5)] focus:ring-2 focus:ring-[rgba(23,150,255,0.2)]"
              />
            </div>
          </Reveal>
        </section>

        <div className="max-w-5xl mx-auto pb-16">
          {searching ? (
            /* Search results — flat, with category tags */
            <div className="max-w-3xl mx-auto">
              <p className="mb-2 text-sm text-[var(--ink-faint)]">
                {matches.length} {matches.length === 1 ? 'result' : 'results'} for &ldquo;{query.trim()}&rdquo;
              </p>
              {matches.length > 0 ? (
                <div className="border-b border-[var(--hairline)]">
                  {matches.map((faq) => (
                    <FaqRow key={faq.question} faq={faq} open={openQuestion === faq.question} onToggle={() => toggle(faq.question)} showCategory />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center">
                  <p className="text-[var(--ink-soft)]">No answers match that. Try different words, or ask us directly.</p>
                  <Link to="/feedback" className="mt-4 inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]">
                    Ask a question
                  </Link>
                </div>
              )}
            </div>
          ) : (
            /* Browse mode — sticky category rail + grouped sections */
            <div className="lg:grid lg:grid-cols-[190px_1fr] lg:gap-12">
              <aside className="hidden lg:block">
                <nav className="sticky top-28 space-y-1" aria-label="FAQ categories">
                  {SECTIONS.map((sec) => {
                    const count = faqs.filter((f) => f.category === sec.id).length;
                    const isActive = activeSection === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => jumpTo(sec.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isActive ? 'bg-[rgba(23,150,255,0.1)] font-medium text-[var(--brand-soft)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {sec.label}
                        <span className="text-xs text-[var(--ink-faint)]">{count}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              <div>
                {SECTIONS.map((sec) => {
                  const items = faqs.filter((f) => f.category === sec.id);
                  if (items.length === 0) return null;
                  return (
                    <Reveal key={sec.id} trigger="inView" className="mb-10 scroll-mt-28" >
                      <section id={`faq-${sec.id}`} className="scroll-mt-28">
                        <h2 className="font-display text-xl font-bold text-[var(--ink)] mb-1">{sec.label}</h2>
                        <div className="border-b border-[var(--hairline)]">
                          {items.map((faq) => (
                            <FaqRow key={faq.question} faq={faq} open={openQuestion === faq.question} onToggle={() => toggle(faq.question)} />
                          ))}
                        </div>
                      </section>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          )}

          {/* Still have questions */}
          <Reveal trigger="inView" className="mt-14">
            <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-8 sm:p-10 text-center" style={{ boxShadow: '0 24px 70px -40px rgba(0,0,0,0.85)' }}>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)]">Still have questions?</h2>
              <p className="mx-auto mt-2 mb-6 max-w-md text-[var(--ink-soft)] leading-relaxed">
                Can&apos;t find what you&apos;re looking for? Ask the community, or send us a note — a real person reads every one.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <a
                  href="https://github.com/Waarangel/3dcoster/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-white text-[var(--brand-deep)] text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/90 active:translate-y-0 active:scale-[0.98]"
                >
                  Report an issue
                </a>
                <Link
                  to="/feedback"
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]"
                >
                  Send feedback
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
