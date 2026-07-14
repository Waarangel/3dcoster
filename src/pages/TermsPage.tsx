import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

// Phase 42 GDPR-03 — Terms of Service page.
// Phase 43-02 — Pro-tier section replaced with concrete billing terms (D-06
// carry-forward): price EUR 6.90/month and EUR 69/year, billed by Paddle as
// Merchant of Record (D-01), no free trial (D-04), lapse-safe existing
// hosted-quote links (D-11). These values must stay identical to the Paddle
// SKUs and billing-panel copy configured in plan 43-06.
//
// Free-tier terms are fully concrete (D-06). 100% developer-authored static
// JSX — no dangerouslySetInnerHTML, no user-supplied content.
const EFFECTIVE_DATE = 'July 14, 2026';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
            <p className="text-slate-400">Effective date: {EFFECTIVE_DATE}</p>
          </div>

          <div className="space-y-10 text-slate-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">Free tier</h2>
              <p className="mb-3">
                3DCoster is free, open-source software licensed under the MIT
                License. By using it, you agree to the following:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>No account is required to use the free tier.</li>
                <li>
                  Your project data (printers, filaments, jobs, customers, sales, and
                  settings) is stored locally on your device and is your
                  responsibility to back up. We have no copy of it and cannot
                  recover it if you lose access to your device or clear your
                  browser data.
                </li>
                <li>
                  The software is provided &ldquo;as is,&rdquo; without warranty of any
                  kind, express or implied, including but not limited to warranties
                  of merchantability, fitness for a particular purpose, and
                  non-infringement. See the{' '}
                  <a
                    href="https://github.com/Waarangel/3dcoster/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    MIT License
                  </a>{' '}
                  for the full text.
                </li>
                <li>
                  You agree to use 3DCoster only for lawful purposes and not to
                  attempt to disrupt, reverse-engineer for malicious purposes, or
                  abuse the hosted infrastructure (for example, the feedback form or
                  update-check endpoints) in a way that degrades service for others.
                </li>
                <li>
                  The cost figures 3DCoster produces are estimates based on the
                  inputs you provide. You are responsible for verifying pricing and
                  business decisions made using this tool.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">Pro tier</h2>
              <p className="mb-3">
                The Pro tier is a paid subscription offering account-based features
                on top of the free tier &mdash; including cloud-hosted, shareable
                quote pages. It has no free trial: the free tier itself is the
                trial. The terms below govern Pro subscriptions.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>Price.</strong> Pro is EUR 6.90 per month, or EUR 69 per
                  year (paid annually, equivalent to roughly two months free versus
                  the monthly price). Prices are shown and billed in EUR regardless
                  of your local currency.
                </li>
                <li>
                  <strong>Merchant of Record.</strong> Pro subscriptions are billed
                  and administered by <strong>Paddle</strong> (paddle.com), acting as
                  our Merchant of Record. Paddle handles your payment method and
                  billing, issues receipts, and is the seller of record on your
                  statement &mdash; not 3DCoster directly.
                </li>
                <li>
                  <strong>No trial.</strong> There is no free trial period for Pro.
                  You can evaluate 3DCoster fully on the free tier before deciding
                  to subscribe.
                </li>
                <li>
                  <strong>Accounts.</strong> Pro features require creating an
                  account. You are responsible for keeping your account credentials
                  secure and for all activity under your account.
                </li>
                <li>
                  <strong>Acceptable use.</strong> The same acceptable-use terms that
                  apply to the free tier apply to Pro accounts, plus any additional
                  fair-use limits disclosed at the time of purchase (for example, on
                  storage or hosted-page bandwidth).
                </li>
                <li>
                  <strong>Cancellation.</strong> You can cancel a Pro subscription at
                  any time; cancellation stops future billing at the end of the
                  current billing period. Hosted quote links you already published
                  stay live and reachable by customers even after you cancel &mdash;
                  canceling does not retroactively take down existing links.
                </li>
                <li>
                  <strong>Refunds.</strong> Refunds are handled per Paddle&apos;s
                  standard refund policy as Merchant of Record. Contact Paddle
                  support (linked from your purchase receipt) or us at the address
                  below to start a refund request.
                </li>
                <li>
                  <strong>Data on termination.</strong> If a Pro account is canceled
                  or terminated, Pro-specific data stored off your device (account
                  email, hosted quotes, billing records) is retained per our{' '}
                  <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                    Privacy Policy
                  </Link>
                  , and you will be given a reasonable opportunity to export your
                  data first.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">Changes to these terms</h2>
              <p>
                We may update these Terms of Service from time to time, most notably
                when the Pro tier launches with concrete billing terms. Material
                changes will be reflected with a new effective date at the top of
                this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">Contact</h2>
              <p>
                Questions about these terms can be sent to{' '}
                <a
                  href="mailto:privacy@3dcoster.com"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  privacy@3dcoster.com
                </a>
                . For data-privacy questions specifically, see our{' '}
                <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
