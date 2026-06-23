import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ImageCarousel } from '../components/ImageCarousel';
import { Reveal } from '../components/motion/Reveal';
import { CostReveal } from '../components/landing/CostReveal';

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
  title: 'Free, no account, yours',
  description: 'Run it free in your browser, or fully offline on the desktop — no sign-up, and your data never leaves your machine.',
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

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Hero — copy proves the thesis; the card demonstrates it */}
      <section className="relative overflow-hidden pt-32 pb-20 px-6">
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
              <h1 className="font-display mt-6 text-5xl sm:text-6xl font-extrabold leading-[1.04] text-[var(--ink)]">
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
                  <svg className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <section className="px-6 pb-10">
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
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal trigger="inView" className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
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

      {/* CTA — drenched brand panel with glow */}
      <section className="py-16 px-6">
        <Reveal trigger="inView" className="max-w-4xl mx-auto">
          <div
            className="relative overflow-hidden rounded-3xl px-10 py-14 sm:px-14 text-center"
            style={{ background: 'var(--brand)', boxShadow: '0 0 120px -30px var(--brand-glow)' }}
          >
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">Stop underpricing your work</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85 leading-relaxed [text-wrap:pretty]">
              Join other 3D-printing sellers who&apos;ve stopped leaving money on the table. Free to
              use, no account required.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/app"
                className="inline-flex items-center px-7 py-3.5 rounded-xl bg-white text-[var(--brand-deep)] font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/90 active:translate-y-0 active:scale-[0.98]"
              >
                Launch the app
              </Link>
              <Link
                to="/download"
                className="inline-flex items-center px-7 py-3.5 rounded-xl border border-white/35 text-white font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 active:translate-y-0 active:scale-[0.98]"
              >
                Download for desktop
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Support — the one warm note */}
      <section className="pb-20 px-6">
        <Reveal trigger="inView" className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-[rgba(240,180,41,0.25)] bg-[var(--amber-soft)] p-8 sm:p-10 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(240,180,41,0.18)' }}>
              <svg className="h-7 w-7 text-[var(--amber)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">Love 3DCoster?</h2>
            <p className="mx-auto mt-3 mb-6 max-w-lg text-[var(--ink-soft)] leading-relaxed">
              3DCoster is free to use and open source. If it&apos;s helped you price your prints profitably,
              consider supporting its development.
            </p>
            <a
              href="https://buymeacoffee.com/3dcoster"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--amber)] text-[#3a2a06] font-semibold text-lg transition duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364z" />
              </svg>
              Buy me a coffee
            </a>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
