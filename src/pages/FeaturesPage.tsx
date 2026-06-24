import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';

/* ─────────────────────────────────────────────────────────────────────────
   Differentiators — capabilities that are 3DCoster-only across every free
   tool in the breakdown below (June 2026 methodology, same as the footnote).
   ───────────────────────────────────────────────────────────────────────── */
interface Differentiator {
  title: string;
  description: string;
  icon: ReactNode;
}

const ONLY_IN_3DCOSTER: Differentiator[] = [
  { title: 'Auto-numbered PDF quotes', description: 'Branded, valid-until-dated quotes you can send a customer, generated from the job.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  { title: 'Quote → Sale tracking', description: 'Turn a quote into a tracked sale with status, all in one place.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" /> },
  { title: 'Customer library', description: 'Store customers (CSV import included) and tie every job to them.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2-5.24" /> },
  { title: 'Nozzle & parts wear', description: 'The consumable cost every other calculator quietly forgets.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
  { title: 'Fully offline desktop app', description: 'Windows + macOS, with your data kept on your own machine.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
  { title: 'Open source under MIT', description: 'MIT-licensed and fully open — inspect the code, fork it, or self-host.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /> },
];

/* ─────────────────────────────────────────────────────────────────────────
   Selling-workflow coverage — a conservative summary of the detailed
   breakdown below. full = covered well · partial = limited or paid-tier ·
   none = not offered.
   ───────────────────────────────────────────────────────────────────────── */
type Cover = 'full' | 'partial' | 'none';

const STAGES = [
  { title: 'Cost truth', blurb: 'Your true, all-in cost' },
  { title: 'Quote', blurb: 'Send a branded quote' },
  { title: 'Sell', blurb: 'Fees, shipping & tax' },
  { title: 'Track & grow', blurb: 'Customers, sales, break-even' },
] as const;

interface Tool {
  name: string;
  price: string;
  us?: boolean;
  cover: [Cover, Cover, Cover, Cover];
}

const TOOLS: Tool[] = [
  { name: '3DCoster', price: 'Free', us: true, cover: ['full', 'full', 'full', 'full'] },
  { name: 'Prusa Calculator', price: 'Free', cover: ['partial', 'none', 'none', 'none'] },
  { name: 'Calc3dprint', price: 'Free', cover: ['partial', 'partial', 'partial', 'partial'] },
  { name: 'LayerMath', price: 'Free + £5-9/mo', cover: ['full', 'none', 'partial', 'partial'] },
  { name: 'SlicePrice3D', price: 'Free', cover: ['full', 'full', 'partial', 'none'] },
];

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

/** Coverage dot: ● full (brand) · ◐ partial (brand ring, half) · ○ none (faint ring). */
function CoverDot({ state }: { state: Cover }) {
  if (state === 'full') {
    return <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ background: 'var(--brand)' }} aria-label="full support" />;
  }
  if (state === 'partial') {
    return (
      <span
        className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[var(--brand-soft)]"
        style={{ background: 'linear-gradient(90deg, var(--brand-soft) 50%, transparent 50%)' }}
        aria-label="partial or paid-tier"
      />
    );
  }
  return <span className="inline-block w-3.5 h-3.5 rounded-full border border-[var(--ink-faint)]" aria-label="not offered" />;
}

interface HiddenCost {
  title: string;
  description: string;
  icon: ReactNode;
}

const HIDDEN_COSTS: HiddenCost[] = [
  { title: 'Electricity', description: 'That 20-hour print uses real power. At $0.15/kWh, it adds up fast.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13 10V3L4 14h7v7l9-11h-7z" /> },
  { title: 'Printer depreciation', description: "Your $500 printer won't last forever. Every hour of use has a cost.", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h12z" /> },
  { title: 'Nozzle & parts wear', description: 'Nozzles, belts, PEI sheets — consumables that need replacing.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" /> },
  { title: 'Your time', description: 'Prep, monitoring, post-processing, packing — your labor has value.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { title: 'Platform fees', description: 'Etsy takes 6.5%+. PayPal takes 2.9%. It compounds quickly.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { title: 'Failed prints', description: 'That 10% failure rate means 1 in 10 prints is pure loss.', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /> },
];

const td = 'py-4 px-4 text-center';
const tdUs = 'py-4 px-4 text-center bg-[rgba(23,150,255,0.13)] border-x border-[rgba(23,150,255,0.3)]';
const yes = `${td} text-[var(--brand-soft)]`;
const yesUs = `${tdUs} text-[var(--brand-soft)]`;
const no = `${td} text-[var(--ink-faint)]`;
const noUs = `${tdUs} text-[var(--ink-faint)]`;

export function FeaturesPage() {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-16 px-6">
        <div className="hero-aura pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <Reveal trigger="mount">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-[var(--ink)] leading-[1.05]">
              Where other tools stop, <span className="text-[var(--brand-soft)]">3DCoster keeps going.</span>
            </h1>
            <p className="mt-6 text-lg text-[var(--ink-soft)] max-w-xl mx-auto leading-relaxed [text-wrap:balance]">
              Most calculators give you a filament estimate and call it a day. 3DCoster counts every
              hidden cost and runs the whole selling workflow — quotes, customers, fees, sales —
              free to use, all in one place.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Only in 3DCoster */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal trigger="inView" className="max-w-2xl mb-10">
            <h2 className="font-display text-3xl font-bold text-[var(--ink)]">Only in 3DCoster</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed [text-wrap:balance]">
              Across every free tool we compared, these are the capabilities no one else offers —
              the difference between a calculator and a selling workflow.
            </p>
          </Reveal>
          <div className="grid gap-4 lg:grid-cols-6 lg:auto-rows-fr">
            {/* Featured — PDF quotes, with a mini quote mock */}
            <Reveal trigger="inView" className="lg:col-span-3 lg:row-span-2">
              <article className="group h-full flex flex-col rounded-2xl border border-[rgba(23,150,255,0.3)] bg-[var(--surface)] p-8 transition duration-200 ease-out hover:border-[rgba(23,150,255,0.5)]">
                <span className="block w-10 h-10 text-[var(--brand-soft)]"><Glyph>{ONLY_IN_3DCOSTER[0].icon}</Glyph></span>
                <h3 className="font-display mt-5 text-2xl font-bold text-[var(--ink)]">{ONLY_IN_3DCOSTER[0].title}</h3>
                <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{ONLY_IN_3DCOSTER[0].description}</p>
                <div className="mt-auto pt-8">
                  <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-4 max-w-xs">
                    <div className="flex items-center justify-between text-xs text-[var(--ink-faint)]">
                      <span>Quote #00042</span><span>Valid 30 days</span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="h-1.5 rounded w-3/4" style={{ background: 'var(--surface-2)' }} />
                      <div className="h-1.5 rounded w-1/2" style={{ background: 'var(--surface-2)' }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline)] pt-2.5">
                      <span className="text-xs text-[var(--ink-soft)]">Total</span>
                      <span className="text-sm font-semibold text-[var(--brand-soft)] tabular-nums">$48.00</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--ink-faint)]">Example — auto-generated from the job.</p>
                </div>
              </article>
            </Reveal>

            {/* Quote → Sale — with a status flow */}
            <Reveal trigger="inView" delay={0.06} className="lg:col-span-3">
              <article className="group h-full rounded-2xl border border-[rgba(23,150,255,0.22)] bg-[var(--surface)] p-8 transition duration-200 ease-out hover:border-[rgba(23,150,255,0.5)]">
                <h3 className="font-display text-xl font-bold text-[var(--ink)]">{ONLY_IN_3DCOSTER[1].title}</h3>
                <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{ONLY_IN_3DCOSTER[1].description}</p>
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <span className="rounded-lg border border-[var(--hairline-strong)] px-2.5 py-1 text-[var(--ink-soft)]">Quote sent</span>
                  <svg className="w-4 h-4 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <span className="rounded-lg border border-[rgba(23,150,255,0.3)] bg-[rgba(23,150,255,0.1)] px-2.5 py-1 font-medium text-[var(--brand-soft)]">Sale · tracked</span>
                </div>
              </article>
            </Reveal>

            {/* Customer library — icon-left */}
            <Reveal trigger="inView" delay={0.1} className="lg:col-span-3">
              <article className="group h-full flex items-start gap-5 rounded-2xl border border-[rgba(23,150,255,0.22)] bg-[var(--surface)] p-8 transition duration-200 ease-out hover:border-[rgba(23,150,255,0.5)]">
                <span className="block w-10 h-10 shrink-0 text-[var(--brand-soft)] transition-transform duration-200 ease-out group-hover:scale-110"><Glyph>{ONLY_IN_3DCOSTER[2].icon}</Glyph></span>
                <div>
                  <h3 className="font-display text-xl font-bold text-[var(--ink)]">{ONLY_IN_3DCOSTER[2].title}</h3>
                  <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{ONLY_IN_3DCOSTER[2].description}</p>
                </div>
              </article>
            </Reveal>

            {/* Compact trio */}
            {[ONLY_IN_3DCOSTER[3], ONLY_IN_3DCOSTER[4], ONLY_IN_3DCOSTER[5]].map((item, i) => (
              <Reveal key={item.title} trigger="inView" delay={0.14 + i * 0.05} className="lg:col-span-2 h-full">
                <article className="group h-full rounded-2xl border border-[rgba(23,150,255,0.22)] bg-[var(--surface)] p-6 transition duration-200 ease-out hover:-translate-y-1 hover:border-[rgba(23,150,255,0.5)]">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="w-5 h-5 text-[var(--brand-soft)] transition-transform duration-200 ease-out group-hover:scale-110"><Glyph>{item.icon}</Glyph></span>
                    <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                  </div>
                  <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{item.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Selling-workflow coverage — the at-a-glance story */}
      <section className="py-12 px-6">
        <Reveal trigger="inView" className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-8">
            <h2 className="font-display text-3xl font-bold text-[var(--ink)]">Follow the selling workflow</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed [text-wrap:balance]">
              Pricing a print is only step one. Here's how far each tool takes you through the rest —
              quoting, selling, and tracking. Most stop early. 3DCoster goes the whole way.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Stage header row */}
              <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] gap-px items-start pb-4">
                <div />
                {STAGES.map((s, i) => (
                  <div key={s.title} className="px-3 text-center">
                    <div className="font-display text-base font-bold text-[var(--ink)]">
                      <span className="text-[var(--brand-soft)]">{i + 1}.</span> {s.title}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-faint)] leading-snug">{s.blurb}</div>
                  </div>
                ))}
              </div>

              {/* Tool rows */}
              <div className="space-y-2">
                {TOOLS.map((tool) => (
                  <div
                    key={tool.name}
                    className={`grid grid-cols-[1.4fr_repeat(4,1fr)] items-center rounded-xl ${
                      tool.us
                        ? 'bg-[rgba(23,150,255,0.1)] border border-[rgba(23,150,255,0.3)]'
                        : 'border border-transparent'
                    }`}
                  >
                    <div className="px-4 py-4">
                      <div className={`font-medium ${tool.us ? 'text-[var(--ink)] font-semibold' : 'text-[var(--ink-soft)]'}`}>
                        {tool.name}
                      </div>
                      <div className={`text-xs ${tool.us ? 'text-[var(--brand-soft)]' : 'text-[var(--ink-faint)]'}`}>{tool.price}</div>
                    </div>
                    {tool.cover.map((c, i) => (
                      <div key={i} className="flex items-center justify-center py-4">
                        <CoverDot state={c} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--ink-faint)]">
            <span className="inline-flex items-center gap-2"><CoverDot state="full" /> Covered well</span>
            <span className="inline-flex items-center gap-2"><CoverDot state="partial" /> Limited or paid-tier</span>
            <span className="inline-flex items-center gap-2"><CoverDot state="none" /> Not offered</span>
          </div>
        </Reveal>
      </section>

      {/* Full breakdown — opt-in detail */}
      <section className="pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            className="group w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-5 py-4 text-left transition duration-200 ease-out hover:border-[rgba(23,150,255,0.45)] hover:bg-[var(--surface-2)]"
          >
            <span className="flex items-center gap-3.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(23,150,255,0.12)] text-[var(--brand-soft)] ${showTable ? '' : 'chevron-hint'}`}>
                <svg className={`w-4 h-4 transition-transform duration-300 ${showTable ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              <span>
                <span className="block font-display font-semibold text-[var(--ink)]">
                  {showTable ? 'Hide' : 'See'} the full feature-by-feature breakdown
                </span>
                <span className="block text-xs text-[var(--ink-faint)]">
                  25 capabilities across 5 tools — the detail behind this summary
                </span>
              </span>
            </span>
            <span className="hidden sm:inline shrink-0 text-sm font-medium text-[var(--brand-soft)] group-hover:underline">
              {showTable ? 'Collapse' : 'Expand'}
            </span>
          </button>

          {showTable && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-4 px-4 text-[var(--ink-soft)] font-medium align-bottom">Feature</th>
                    <th className="py-4 px-4 text-center align-bottom rounded-t-xl bg-[rgba(23,150,255,0.13)] border-x border-t border-[rgba(23,150,255,0.3)]">
                      <div className="font-display text-lg text-[var(--ink)] font-bold">3DCoster</div>
                      <div className="text-[var(--brand-soft)] text-sm font-medium">Free</div>
                    </th>
                    <th className="py-4 px-4 text-center align-bottom"><div className="text-[var(--ink-soft)] font-medium">Prusa Calculator</div><div className="text-[var(--ink-faint)] text-sm">Free</div></th>
                    <th className="py-4 px-4 text-center align-bottom"><div className="text-[var(--ink-soft)] font-medium">Calc3dprint</div><div className="text-[var(--ink-faint)] text-sm">Free</div></th>
                    <th className="py-4 px-4 text-center align-bottom"><div className="text-[var(--ink-soft)] font-medium">LayerMath</div><div className="text-[var(--ink-faint)] text-sm">Free + £5-9/mo</div></th>
                    <th className="py-4 px-4 text-center align-bottom"><div className="text-[var(--ink-soft)] font-medium">SlicePrice3D</div><div className="text-[var(--ink-faint)] text-sm">Free (donation)</div></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="bg-[var(--surface)] border-b border-[var(--hairline)]"><td colSpan={6} className="py-2 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--brand-soft)]">Cost calculation</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Material cost calculation</td><td className={yesUs}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Multi-filament cost (per-filament weight + price)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>Limited</td><td className={yes}>Yes (Pro)</td><td className={no}>Limited</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Slicer file import (G-code / 3MF, multi-slicer)</td><td className={yesUs}>Yes (G-code &amp; 3MF)</td><td className={no}>Limited</td><td className={yes}>Yes (G-code)</td><td className={yes}>Yes (G-code)</td><td className={yes}>Yes (G-code &amp; 3MF)</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Electricity costs</td><td className={yesUs}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Printer depreciation</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Nozzle &amp; parts wear</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Failed-print loss factor</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Labor time tracking (prep + post-processing)</td><td className={yesUs}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Multi-currency support</td><td className={yesUs}>Yes (18)</td><td className={no}>No</td><td className={yes}>Yes (5)</td><td className={yes}>Yes (5)</td><td className={no}>—</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Break-even analysis</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={yes}>Yes</td><td className={no}>—</td></tr>

                  <tr className="bg-[var(--surface)] border-b border-[var(--hairline)]"><td colSpan={6} className="py-2 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--brand-soft)]">Sales &amp; business management</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Customer library (CRUD + CSV import)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Save jobs with sales history per job</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>Limited (quote storage)</td><td className={no}>Limited (SKU manager, Pro)</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Marketplace fees (Etsy / eBay / Amazon Handmade)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>Limited (Etsy)</td><td className={yes}>Yes (Etsy/eBay/Amazon)</td><td className={no}>Limited (channel presets)</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Live Etsy order sync (90-day API import)</td><td className={noUs}>No</td><td className={no}>No</td><td className={no}>No</td><td className={yes}>Yes (£5/mo)</td><td className={no}>—</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Shipping management (8 carriers + local delivery)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>Limited (cost field only)</td><td className={no}>Limited (cost field only)</td><td className={no}>—</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Tax / VAT (region default + per-job override)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={yes}>Yes (Pro)</td><td className={no}>Limited (manual %)</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Editable tags + free-text search across jobs</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td><td className={no}>—</td></tr>

                  <tr className="bg-[var(--surface)] border-b border-[var(--hairline)]"><td colSpan={6} className="py-2 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--brand-soft)]">Quotes &amp; compliance</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Printable PDF quotes (auto-numbered, valid-until date)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>Limited (PDF export, no auto-#)</td><td className={no}>No</td><td className={yes}>Yes (auto-# + expiry)</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Quote &rarr; Sale conversion (with status tracking)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td><td className={no}>Limited (orders + fulfillment)</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Etsy ToS compliance helper</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td></tr>

                  <tr className="bg-[var(--surface)] border-b border-[var(--hairline)]"><td colSpan={6} className="py-2 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--brand-soft)]">Platform &amp; access</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Filament library management</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={yes}>Yes (Pro)</td><td className={yes}>Yes</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Works offline (PWA + IndexedDB)</td><td className={yesUs}>Yes</td><td className={no}>Web only</td><td className={yes}>Yes (local parsing)</td><td className={no}>Web only</td><td className={no}>Web only (account)</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Desktop app (Windows + macOS)</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">Open source</td><td className={yesUs}>Yes</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td><td className={no}>No</td></tr>
                  <tr className="border-b border-[var(--hairline)]"><td className="py-4 px-4 text-[var(--ink-soft)]">No account required</td><td className={yesUs}>Yes</td><td className={yes}>Yes</td><td className={yes}>Yes</td><td className={no}>Free: yes / Paid: no</td><td className={no}>Calc: yes / App: no</td></tr>
                  <tr><td className="py-4 px-4 text-[var(--ink-soft)] font-medium">Price</td><td className="py-4 px-4 text-center text-[var(--brand-soft)] font-bold bg-[rgba(23,150,255,0.13)] border-x border-b rounded-b-xl border-[rgba(23,150,255,0.3)]">Free</td><td className="py-4 px-4 text-center text-[var(--ink-soft)]">Free</td><td className="py-4 px-4 text-center text-[var(--ink-soft)]">Free</td><td className="py-4 px-4 text-center text-[var(--ink-soft)]">Free / £5 / £9 mo</td><td className="py-4 px-4 text-center text-[var(--ink-soft)]">Free (donation)</td></tr>
                </tbody>
              </table>

              <p className="text-xs text-[var(--ink-faint)] mt-4 max-w-3xl">
                Competitor feature availability checked June 2026 against each tool's public pricing
                and features pages. "Limited" indicates partial coverage (e.g., the field is collected
                but not woven through a full workflow). "—" means the tool's public pages don't state
                support either way. "(paid)" / "(Pro)" indicate features behind a paid tier
                (LayerMath £5-9/mo). SlicePrice3D is free and donation-funded; its product, sales, inventory and fleet features sit behind a free account, so "—" marks ones its public pages don't confirm.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Hidden costs */}
      <section className="py-16 px-6 border-y border-[var(--hairline)] bg-[var(--surface)]">
        <Reveal trigger="inView" className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-3xl font-bold text-[var(--ink)]">The costs you're probably ignoring</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed [text-wrap:balance]">
              Most 3D-printing sellers only count filament. Here's what's actually eating into your profit.
            </p>
          </div>
          {/* Editorial ruled list — deliberately not cards */}
          <div className="grid sm:grid-cols-2 sm:gap-x-12">
            {HIDDEN_COSTS.map((cost, i) => (
              <Reveal key={cost.title} trigger="inView" delay={i * 0.05}>
                <div className="group flex items-start gap-4 py-5 border-t border-[var(--hairline)]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(23,150,255,0.1)] text-[var(--brand-soft)] transition-transform duration-200 ease-out group-hover:scale-105">
                    <span className="block w-5 h-5"><Glyph>{cost.icon}</Glyph></span>
                  </span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-[var(--ink)]">{cost.title}</h3>
                    <p className="mt-1 text-sm text-[var(--ink-soft)] leading-relaxed">{cost.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <Reveal trigger="inView" className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--hairline)] px-10 py-14 sm:px-14 text-center" style={{ background: 'var(--surface-2)', boxShadow: '0 24px 70px -40px rgba(0,0,0,0.85)' }}>
            <h2 className="font-display text-3xl font-bold text-[var(--ink)]">Stop leaving money on the table</h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--ink-soft)] leading-relaxed [text-wrap:balance]">
              Know your true cost. Set profitable prices. Free to use.
            </p>
            <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
              <Link to="/app" className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[var(--brand)] text-white font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]" style={{ boxShadow: '0 8px 30px -8px var(--brand-glow)' }}>
                Use for free
              </Link>
              <Link to="/download" className="inline-flex items-center px-7 py-3.5 rounded-xl bg-white text-[var(--brand-deep)] font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/90 active:translate-y-0 active:scale-[0.98]">
                Download desktop app
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
