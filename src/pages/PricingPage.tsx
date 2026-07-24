import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';
import { useDisplayPrice } from '../hooks/useDisplayPrice';

// ---------------------------------------------------------------------------
// PricingPage — D-06, the dedicated /pricing spot (Phase 45-03, BRAND-01).
//
// Free column ("everything, forever") vs Pro column, priced from
// src/pricing.ts (never re-typed — guarded against BillingPanel.tsx drift by
// PricingPage.test.tsx). The Pro CTA routes into the app ("Start free,
// upgrade in-app" -> /app, D-10) — this page adds NO marketing-side
// sign-in/checkout surface. Copy uses the early-supporter launch framing
// (D-09) with no countdown/urgency mechanics.
//
// Native to the Cost-Truth Dark system: renders inside MarketingThemeScope
// (mounted by the marketing layout route in main.tsx), so every var(--x)
// class below resolves the brand-dark token values, not the /app slate
// defaults (docs/DESIGN.md).
// ---------------------------------------------------------------------------

const FREE_FEATURES = [
  'The full cost calculator — filament, electricity, printer depreciation, labor, marketplace fees',
  'Failure-rate, time-of-use electricity, and maintenance-wear cost modeling',
  'Printer ROI, hourly wage, and what-if scenario insights',
  'Customer library, PDF quotes, and quote-to-sale conversion',
  'File-based sync across your own devices — no account required',
  'STL instant quote from a 3D file',
  'Inventory, spool tracking, and sales reporting',
  'Desktop app for Windows, macOS, and Linux, plus the installable web app',
];

const PRO_FEATURES = [
  'Live, hosted quote links branded with your business — not just a PDF',
  'Customers approve or decline online; you see the result the moment they respond',
  'White-label your quotes — your logo on PDF quotes and hosted quote pages, no "Made with 3DCoster" footer',
  'Real-time cloud sync across all your devices — end-to-end encrypted, so we can\'t read your data',
  'Cancel anytime — quote links you’ve already shared stay live',
];

export function PricingPage() {
  const { monthly, annual, freePrice } = useDisplayPrice();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />

      <main>
        {/* Hero */}
        <section className="pt-32 pb-16 px-6" aria-labelledby="pricing-hero-heading">
          <Reveal trigger="mount">
            <div className="max-w-3xl mx-auto text-center">
              <h1
                id="pricing-hero-heading"
                className="font-display text-4xl md:text-5xl font-bold text-[var(--ink)] mb-6 [text-wrap:balance]"
              >
                Simple pricing. No surprises.
              </h1>
              <p className="text-lg text-[var(--ink-soft)] [text-wrap:pretty]">
                The full cost calculator is free, forever — no account, no trial, no
                paywall on the numbers that matter. Pro adds one thing: live, hosted
                quote links your customers can approve online.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Free vs Pro */}
        <section className="pb-20 px-6" aria-labelledby="pricing-plans-heading">
          <h2 id="pricing-plans-heading" className="sr-only">
            Plans
          </h2>
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* Free column */}
            <Reveal trigger="inView">
              <div className="h-full rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-8 flex flex-col">
                <div className="mb-6">
                  <h3 className="font-display text-2xl font-bold text-[var(--ink)] mb-1">Free</h3>
                  <p className="text-[var(--ink-faint)]">Everything, forever</p>
                </div>
                <p className="text-3xl font-bold text-[var(--ink)] mb-6">
                  {freePrice}
                  <span className="text-base font-normal text-[var(--ink-faint)]"> / forever</span>
                </p>
                <ul className="space-y-3 mb-8 flex-1">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-[var(--ink-soft)] text-sm">
                      <svg
                        className="w-5 h-5 text-[var(--brand-soft)] mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/app"
                  className="mt-auto rounded-xl bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-[var(--ink)] font-semibold text-center px-6 py-3 transition hover:-translate-y-0.5 hover:border-[rgba(23,150,255,0.4)] active:scale-[0.98]"
                >
                  Use for free
                </Link>
              </div>
            </Reveal>

            {/* Pro column */}
            <Reveal trigger="inView" delay={0.08}>
              <div className="h-full rounded-2xl border border-[rgba(23,150,255,0.4)] bg-[var(--surface)] p-8 flex flex-col relative overflow-hidden">
                <div
                  className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full"
                  style={{ background: 'var(--brand-glow)', filter: 'blur(40px)' }}
                  aria-hidden="true"
                />
                <div className="mb-6 relative">
                  <h3 className="font-display text-2xl font-bold text-[var(--ink)] mb-1">Pro</h3>
                  <p className="text-[var(--ink-faint)]">For sellers who share quotes with customers</p>
                </div>
                <div className="mb-2 relative">
                  <p className="text-3xl font-bold text-[var(--ink)]">
                    {monthly.approx ?? monthly.billingLabel}
                    <span className="text-base font-normal text-[var(--ink-faint)]"> / month</span>
                  </p>
                  <p className="text-sm text-[var(--ink-faint)] mt-1">
                    or {annual.approx ?? annual.billingLabel} / year — 2 months free
                  </p>
                  {monthly.approx && (
                    <p className="text-xs text-[var(--ink-faint)] mt-1">
                      Billed as {monthly.billingLabel}/mo · {annual.billingLabel}/yr
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--brand-soft)] mb-6 relative">
                  Launch price — {monthly.approx ?? monthly.billingLabel}/mo for early supporters
                </p>
                <ul className="space-y-3 mb-8 flex-1 relative">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-[var(--ink-soft)] text-sm">
                      <svg
                        className="w-5 h-5 text-[var(--brand-soft)] mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-[var(--ink-faint)] mb-3 relative">
                  Billed by Paddle, our Merchant of Record. Upgrade any time from Settings once you hit
                  the free ceiling — no sign-up required just to try the calculator.
                </p>
                <Link
                  to="/app"
                  className="mt-auto relative rounded-xl bg-[var(--brand)] text-white font-semibold text-center px-6 py-3 shadow-[0_8px_24px_var(--brand-glow)] transition hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:scale-[0.98]"
                >
                  Start free, upgrade in-app
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Reassurance / why free */}
        <section className="pb-24 px-6" aria-labelledby="pricing-why-heading">
          <div className="max-w-2xl mx-auto text-center">
            <h2 id="pricing-why-heading" className="font-display text-2xl font-bold text-[var(--ink)] mb-4">
              Why is the calculator free?
            </h2>
            <p className="text-[var(--ink-soft)] [text-wrap:pretty]">
              Knowing your true cost shouldn&apos;t be a paid feature — it&apos;s the whole point of the
              tool. Pro exists for one thing only: turning a quote into a live link your customer can
              open, review, and approve online. Everything else stays free, on every platform, for as
              long as 3DCoster exists.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
