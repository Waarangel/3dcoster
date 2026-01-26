import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Why 3DCoster?
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Most calculators give you a rough estimate. 3DCoster gives you the real number -
            every cost factor that eats into your profit, finally visible.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">How We Compare</h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Feature</th>
                  <th className="py-4 px-4 text-center">
                    <div className="text-white font-semibold">3DCoster</div>
                    <div className="text-green-400 text-sm">Free</div>
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="text-slate-300 font-medium">Prusa Calculator</div>
                    <div className="text-slate-500 text-sm">Free</div>
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="text-slate-300 font-medium">3DPrinterOS</div>
                    <div className="text-slate-500 text-sm">$19-95/mo</div>
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="text-slate-300 font-medium">SimplyPrint</div>
                    <div className="text-slate-500 text-sm">$5-31/mo</div>
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Material cost calculation</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Electricity costs</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">Limited</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Printer depreciation</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Marketplace fees (Etsy, etc.)</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Labor time tracking</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Filament library management</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Break-even analysis</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Works offline</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">Web only</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Desktop app</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">Open source</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-4 px-4 text-slate-300">No account required</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-green-400">Yes</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                  <td className="py-4 px-4 text-center text-slate-500">No</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-slate-300 font-medium">Price</td>
                  <td className="py-4 px-4 text-center text-green-400 font-bold">Free forever</td>
                  <td className="py-4 px-4 text-center text-slate-400">Free</td>
                  <td className="py-4 px-4 text-center text-slate-400">$228+/year</td>
                  <td className="py-4 px-4 text-center text-slate-400">$65+/year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What Others Focus On vs What We Focus On */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Others */}
            <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700">
              <h3 className="text-xl font-semibold text-slate-400 mb-6">Other tools focus on...</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-400">
                  <svg className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span>Printer management & monitoring</span>
                </li>
                <li className="flex items-start gap-3 text-slate-400">
                  <svg className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span>Remote printing & queues</span>
                </li>
                <li className="flex items-start gap-3 text-slate-400">
                  <svg className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span>Print farm fleet operations</span>
                </li>
                <li className="flex items-start gap-3 text-slate-400">
                  <svg className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span>Basic material cost (as an afterthought)</span>
                </li>
              </ul>
            </div>

            {/* 3DCoster */}
            <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-2xl p-8 border border-blue-500/30">
              <h3 className="text-xl font-semibold text-white mb-6">3DCoster focuses on...</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-200">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Your actual profit</strong> after every cost</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Hidden costs</strong> most sellers ignore</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Marketplace fees</strong> that eat your margins</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Break-even points</strong> for smart pricing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The Hidden Costs Section */}
      <section className="py-16 px-6 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-4">The Costs You're Probably Ignoring</h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Most 3D printing sellers only count filament. Here's what's actually eating into your profit:
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="text-2xl mb-3">⚡</div>
              <h3 className="text-white font-medium mb-1">Electricity</h3>
              <p className="text-slate-400 text-sm">That 20-hour print uses real power. At $0.15/kWh, it adds up fast.</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="text-2xl mb-3">🖨️</div>
              <h3 className="text-white font-medium mb-1">Printer Depreciation</h3>
              <p className="text-slate-400 text-sm">Your $500 printer won't last forever. Every hour of use has a cost.</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="text-2xl mb-3">🔧</div>
              <h3 className="text-white font-medium mb-1">Nozzle & Parts Wear</h3>
              <p className="text-slate-400 text-sm">Nozzles, belts, PEI sheets - consumables that need replacing.</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="text-2xl mb-3">⏱️</div>
              <h3 className="text-white font-medium mb-1">Your Time</h3>
              <p className="text-slate-400 text-sm">Prep, monitoring, post-processing, packing - your labor has value.</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="text-2xl mb-3">🏪</div>
              <h3 className="text-white font-medium mb-1">Platform Fees</h3>
              <p className="text-slate-400 text-sm">Etsy takes 6.5%+. PayPal takes 2.9%. It compounds quickly.</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="text-2xl mb-3">❌</div>
              <h3 className="text-white font-medium mb-1">Failed Prints</h3>
              <p className="text-slate-400 text-sm">That 10% failure rate means 1 in 10 prints is pure loss.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-2xl p-12 border border-blue-500/20">
            <h2 className="text-3xl font-bold text-white mb-4">Stop Leaving Money on the Table</h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              Know your true cost. Set profitable prices. Free forever.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                to="/app"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-semibold shadow-lg shadow-blue-500/25"
              >
                Use for Free
              </Link>
              <Link
                to="/download"
                className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-semibold"
              >
                Download Desktop App
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
