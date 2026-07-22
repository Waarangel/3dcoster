import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ImageCarousel } from '../components/ImageCarousel';
import { Reveal } from '../components/motion/Reveal';
import { CostReveal } from '../components/landing/CostReveal';
import { useDisplayPrice } from '../hooks/useDisplayPrice';

// ---------------------------------------------------------------------------
// LandingPage — Cost-Truth Dark port (Phase 45-04, BRAND-01).
//
// Renders inside MarketingThemeScope (mounted by the marketing layout route
// in main.tsx), so every var(--x) class below resolves the brand-dark token
// values, not the /app slate defaults (docs/DESIGN.md convention, see
// PricingPage.tsx for the same pattern).
//
// Structure follows D-11 (all four v2.0 pillars get headline billing):
//   1. Hero (CostReveal) — the cost-truth engine thesis, demonstrated not
//      just claimed ("show, don't tell").
//   2. App preview.
//   3. Feature bento — the calculator's day-to-day workflow strengths.
//   4. "What's new" pillars — the four v2.0 pillars named plainly (cost-truth
//      engine, device sync without accounts, STL instant quote,
//      insights/printer-ROI). v2.0 secrecy expires at launch.
//   5. CTA.
//   6. Pro teaser (D-07, spot 2 of 3) — leads with the free-forever floor,
//      then a compact "Pro from [MONTHLY_PRICE_LABEL]/mo" card (price from
//      src/pricing.ts, never re-typed — guarded by PricingPage.test.tsx)
//      linking to /pricing. No donation ask; Pro is the only paid-tier
//      mention here.
//
// Phase 37's a11y hardening (`<main>` landmark, `aria-labelledby` on every
// section, `aria-hidden="true"` on decorative icons) is re-applied throughout
// — see .planning/phases/45-brand-launch/45-RESEARCH.md Pitfall 6.
//
// The branch's "Buy Me a Coffee" support section is dropped in this port —
// D-03 (one monetization voice at launch: Pro, no donation asks) and
// .planning/phases/45-brand-launch/deferred-items.md both call this out.
// ---------------------------------------------------------------------------

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

const cardBase =
  'rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] transition duration-200 ease-out';

const LEAD_FEATURE: Feature = {
  title: 'True cost calculation',
  description:
    'Filament, electricity, depreciation, nozzle wear, your labour — every hidden cost folded into one honest number you can price against.',
  icon: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
  ),
};

const CLOSING_FEATURE: Feature = {
  title: 'Works offline',
  description: 'The desktop app runs in your workshop with no internet connection. Your data stays on your machine.',
  icon: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  ),
};

const FEATURES: Feature[] = [
  {
    title: 'Break-even tracking',
    description: 'Know exactly how many units recover your investment on each model.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
  },
  {
    title: 'Marketplace fees',
    description: 'Etsy, Facebook Marketplace, Kijiji — your real profit after every platform cut.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  {
    title: 'Asset library',
    description: 'Filaments, consumables, tools, and printers — organized in one place.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    ),
  },
  {
    title: 'Shipping calculator',
    description: 'Delivery gas, carrier rates, packaging — factored in automatically.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />,
  },
];

// D-11: the four v2.0 pillars, named plainly now that v2.0 secrecy expires
// at launch. Cost-truth engine reinforces the hero's "show, don't tell"
// demonstration in words; the other three are genuinely new sections — the
// hero never covers them.
const PILLARS: Feature[] = [
  {
    title: 'Cost-Truth Engine',
    description:
      'Empirical failure rates, time-of-use electricity pricing, and printer wear/maintenance amortization — the numbers the hero just added up, running on every quote you make.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    ),
  },
  {
    title: 'Sync across your devices — no account',
    description:
      'Move your data between desktop and browser with file-based sync. No sign-up, no cloud account, no login screen — you own the file.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
  },
  {
    title: 'STL instant quote',
    description:
      'Drop in an STL and get a fast cost estimate before you even slice — mesh volume, print time, and true cost in one step.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
      />
    ),
  },
  {
    title: 'Insights & printer ROI',
    description:
      'Printer ROI, effective hourly wage, and what-if scenario insights turn your job history into pricing decisions, not guesswork.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm10 0V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v10m6 0a2 2 0 01-2 2h-2a2 2 0 01-2-2M9 19a2 2 0 002 2h2a2 2 0 002-2"
      />
    ),
  },
];

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function CompactCard({ feature }: { feature: Feature }) {
  return (
    <article className={`group h-full ${cardBase} p-6 hover:-translate-y-1 hover:border-[rgba(23,150,255,0.4)]`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="w-5 h-5 text-[var(--brand-soft)] transition-transform duration-200 ease-out group-hover:scale-110">
          <FeatureIcon>{feature.icon}</FeatureIcon>
        </span>
        <h3 className="text-base font-semibold text-[var(--ink)]">{feature.title}</h3>
      </div>
      <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{feature.description}</p>
    </article>
  );
}

function PillarCard({ feature }: { feature: Feature }) {
  return (
    <article className={`group h-full ${cardBase} p-7 flex flex-col hover:border-[rgba(23,150,255,0.4)]`}>
      <span className="block w-9 h-9 text-[var(--brand-soft)] transition-transform duration-200 ease-out group-hover:scale-110">
        <FeatureIcon>{feature.icon}</FeatureIcon>
      </span>
      <h3 className="font-display mt-4 text-lg font-bold text-[var(--ink)]">{feature.title}</h3>
      <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{feature.description}</p>
    </article>
  );
}

export function LandingPage() {
  const { monthly } = useDisplayPrice();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      <main>
        {/* Hero — copy proves the thesis; the card demonstrates it */}
        <section className="relative overflow-hidden pt-32 pb-20 px-6" aria-labelledby="hero-heading">
          <div className="hero-aura pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
            <div>
              <Reveal trigger="mount">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[rgba(23,150,255,0.1)] border border-[rgba(23,150,255,0.25)] text-[var(--brand-soft)] text-sm font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                  Free &amp; open source
                </div>
              </Reveal>

              <Reveal trigger="mount" delay={0.07}>
                <h1 id="hero-heading" className="font-display mt-6 text-5xl sm:text-6xl font-extrabold leading-[1.04] text-[var(--ink)]">
                  Filament is the <span className="text-[var(--brand-soft)]">cheap part.</span>
                </h1>
              </Reveal>

              <Reveal trigger="mount" delay={0.14}>
                <p className="mt-6 max-w-md text-lg text-[var(--ink-soft)] leading-relaxed [text-wrap:pretty]">
                  Electricity, printer wear, your time, failed prints, marketplace fees — they quietly eat
                  your margin. 3DCoster counts every one and tells you the price that actually profits.
                </p>
              </Reveal>

              <Reveal trigger="mount" delay={0.21}>
                <div className="mt-9 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Link
                    to="/app"
                    className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--brand)] text-white font-semibold text-lg transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]"
                    style={{ boxShadow: '0 8px 30px -8px var(--brand-glow)' }}
                  >
                    Use it free
                    <svg
                      className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link
                    to="/download"
                    className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-[var(--ink)] font-semibold text-lg transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(23,150,255,0.4)] active:translate-y-0 active:scale-[0.98]"
                  >
                    Download
                  </Link>
                </div>
              </Reveal>

              <Reveal trigger="mount" delay={0.28}>
                <p className="mt-5 text-base font-medium text-[var(--ink-soft)]">
                  The calculator that catches all of it.
                </p>
              </Reveal>
            </div>

            <Reveal trigger="mount" delay={0.18}>
              <CostReveal />
            </Reveal>
          </div>
        </section>

        {/* App preview */}
        <section className="px-6 pb-10" aria-label="App preview screenshots">
          <Reveal trigger="inView" className="max-w-6xl mx-auto">
            <div
              className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-2 sm:p-3"
              style={{ boxShadow: '0 30px 80px -40px rgba(0,0,0,0.8)' }}
            >
              <ImageCarousel />
            </div>
          </Reveal>
        </section>

        {/* Features — a varied bento (distinct treatments, not one template repeated) */}
        <section className="py-20 px-6" aria-labelledby="features-heading">
          <div className="max-w-6xl mx-auto">
            <Reveal trigger="inView" className="max-w-2xl mb-12">
              <h2 id="features-heading" className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
                Every cost factor, finally on the books
              </h2>
              <p className="mt-4 text-[var(--ink-soft)] leading-relaxed [text-wrap:pretty]">
                Built by 3D-printing sellers, for 3D-printing sellers. The numbers you&apos;ve been
                guessing at are now accounted for — automatically.
              </p>
            </Reveal>

            <div className="grid gap-4 lg:grid-cols-6 lg:auto-rows-fr">
              {/* Featured — large, with a mini cost-stack visual */}
              <Reveal trigger="inView" className="lg:col-span-3 lg:row-span-2">
                <article className={`group relative h-full overflow-hidden ${cardBase} p-8 flex flex-col hover:border-[rgba(23,150,255,0.4)]`}>
                  <div
                    className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: 'radial-gradient(circle, rgba(23,150,255,0.18), transparent 70%)' }}
                    aria-hidden="true"
                  />
                  <span className="block w-10 h-10 text-[var(--brand-soft)]">
                    <FeatureIcon>{LEAD_FEATURE.icon}</FeatureIcon>
                  </span>
                  <h3 className="font-display mt-5 text-2xl font-bold text-[var(--ink)]">{LEAD_FEATURE.title}</h3>
                  <p className="mt-3 max-w-md text-[var(--ink-soft)] leading-relaxed">{LEAD_FEATURE.description}</p>
                  <div className="mt-auto pt-8">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-[var(--ink-faint)]">filament $3.20</span>
                      <span className="text-[var(--brand-soft)] font-medium">true cost $11.80</span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                      <div style={{ width: '27%', background: 'var(--brand)' }} />
                      <div style={{ width: '73%', background: 'rgba(91,179,255,0.45)', borderLeft: '1.5px solid var(--surface)' }} />
                    </div>
                  </div>
                </article>
              </Reveal>

              {/* Marketplace fees — stat/example treatment with fee chips */}
              <Reveal trigger="inView" delay={0.06} className="lg:col-span-3">
                <article className={`group h-full ${cardBase} p-8 hover:border-[rgba(23,150,255,0.4)]`}>
                  <h3 className="font-display text-xl font-bold text-[var(--ink)]">Marketplace fees</h3>
                  <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">
                    Etsy, Facebook Marketplace, Kijiji — every platform cut subtracted before you see profit.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['Etsy 6.5%', 'Payment 3%', 'Listing $0.20', 'Shipping'].map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center rounded-lg bg-[rgba(23,150,255,0.1)] border border-[rgba(23,150,255,0.2)] px-2.5 py-1 text-xs font-medium text-[var(--brand-soft)] tabular-nums"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </article>
              </Reveal>

              {/* Break-even — icon-left layout */}
              <Reveal trigger="inView" delay={0.1} className="lg:col-span-3">
                <article className={`group h-full ${cardBase} p-8 flex items-start gap-5 hover:border-[rgba(23,150,255,0.4)]`}>
                  <span className="block w-10 h-10 shrink-0 text-[var(--brand-soft)] transition-transform duration-200 ease-out group-hover:scale-110">
                    <FeatureIcon>{FEATURES[0].icon}</FeatureIcon>
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold text-[var(--ink)]">{FEATURES[0].title}</h3>
                    <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{FEATURES[0].description}</p>
                  </div>
                </article>
              </Reveal>

              {/* Small trio */}
              {[FEATURES[2], FEATURES[3], CLOSING_FEATURE].map((feature, i) => (
                <Reveal key={feature.title} trigger="inView" delay={0.14 + i * 0.06} className="lg:col-span-2 h-full">
                  <CompactCard feature={feature} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* v2.0 pillars — named plainly now that secrecy expires at launch (D-11) */}
        <section className="py-20 px-6" aria-labelledby="pillars-heading">
          <div className="max-w-6xl mx-auto">
            <Reveal trigger="inView" className="max-w-2xl mb-12">
              <h2 id="pillars-heading" className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
                What&apos;s new in 3DCoster
              </h2>
              <p className="mt-4 text-[var(--ink-soft)] leading-relaxed [text-wrap:pretty]">
                Four pillars, all shipped, all free: the Cost-Truth Engine you just saw above, plus
                sync, instant STL quotes, and the insights that turn your history into pricing decisions.
              </p>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((pillar, i) => (
                <Reveal key={pillar.title} trigger="inView" delay={0.06 * i}>
                  <PillarCard feature={pillar} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — drenched brand panel with glow */}
        <section className="py-16 px-6" aria-labelledby="cta-heading">
          <Reveal trigger="inView" className="max-w-4xl mx-auto">
            <div
              className="relative overflow-hidden rounded-3xl border border-[var(--hairline)] px-10 py-14 sm:px-14 text-center"
              style={{ background: 'var(--surface-2)', boxShadow: '0 24px 70px -40px rgba(0,0,0,0.85)' }}
            >
              <h2 id="cta-heading" className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">Stop underpricing your work</h2>
              <p className="mx-auto mt-4 max-w-xl text-[var(--ink-soft)] leading-relaxed [text-wrap:pretty]">
                Join other 3D-printing sellers who&apos;ve stopped leaving money on the table. Free to
                use, no account required.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/app"
                  className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[var(--brand)] text-white font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]"
                  style={{ boxShadow: '0 8px 30px -8px var(--brand-glow)' }}
                >
                  Launch the app
                </Link>
                <Link
                  to="/download"
                  className="inline-flex items-center px-7 py-3.5 rounded-xl bg-white text-[var(--brand-deep)] font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/90 active:translate-y-0 active:scale-[0.98]"
                >
                  Download for desktop
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Pro teaser — D-07 (spot 2 of 3). Free-forever floor first, Pro ceiling second. */}
        <section className="pb-20 px-6" aria-labelledby="pro-teaser-heading">
          <Reveal trigger="inView" className="max-w-3xl mx-auto">
            <div className={`${cardBase} p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8`}>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm font-medium text-[var(--brand-soft)] mb-2">Free, forever</p>
                <h2 id="pro-teaser-heading" className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] mb-3">
                  The calculator stays free. Pro adds hosted quote links.
                </h2>
                <p className="text-[var(--ink-soft)] leading-relaxed max-w-md">
                  Every cost number, every insight, every device — no account, no paywall. Pro is
                  for sellers who want customers to approve quotes online.
                </p>
              </div>
              <div className="shrink-0 w-full sm:w-auto rounded-xl border border-[rgba(23,150,255,0.4)] bg-[var(--surface-2)] px-6 py-5 text-center">
                <p className="text-xs uppercase tracking-wide text-[var(--ink-faint)] mb-1">3DCoster Pro</p>
                <p className="text-2xl font-bold text-[var(--ink)]">
                  Pro from {monthly.approx ?? monthly.billingLabel}
                  <span className="text-sm font-normal text-[var(--ink-faint)]">/mo</span>
                </p>
                {monthly.approx && (
                  <p className="text-xs text-[var(--ink-faint)] mt-1">billed as {monthly.billingLabel}</p>
                )}
                <Link
                  to="/pricing"
                  className="mt-4 inline-flex items-center justify-center w-full rounded-lg bg-[var(--brand)] text-white font-semibold text-sm px-5 py-2.5 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
