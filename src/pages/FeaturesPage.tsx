import { Link } from 'react-router-dom';

export function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/pwa-192x192.png" alt="3DCoster" className="w-10 h-10 rounded-xl" />
            <span className="text-white font-semibold text-xl">3DCoster</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/features"
              className="px-4 py-2 text-white transition-colors text-sm font-medium"
            >
              Features
            </Link>
            <Link
              to="/download"
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Download
            </Link>
            <Link
              to="/app"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Go to App
            </Link>
          </div>
        </div>
      </nav>

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

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-6">
          <a
            href="https://buymeacoffee.com/3dcoster"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-yellow-500 hover:text-yellow-400 text-sm transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364z"/>
            </svg>
            Buy me a coffee
          </a>
<a
            href="https://ashlaindustries.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            ashlaindustries.ca
          </a>
          <a
            href="https://github.com/Waarangel/3dcoster"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
