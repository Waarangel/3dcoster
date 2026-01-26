import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';

interface FAQItem {
  question: string;
  answer: string;
  category: 'getting-started' | 'costs' | 'features' | 'technical';
}

const faqs: FAQItem[] = [
  // Getting Started
  {
    category: 'getting-started',
    question: 'What is 3DCoster?',
    answer: 'A free cost calculator for 3D printing sellers. It helps you calculate the true cost of each print including filament, electricity, printer depreciation, labor, shipping, and marketplace fees - so you can price your products profitably.',
  },
  {
    category: 'getting-started',
    question: 'Do I need to create an account?',
    answer: 'No account needed. All your data is stored locally in your browser using IndexedDB. Your data stays on your device and is never sent to any server.',
  },
  {
    category: 'getting-started',
    question: 'Is 3DCoster really free?',
    answer: 'Yes, completely free and open source under the MIT license. No ads, no premium tiers, no data collection. If you find it useful, you can support development via Buy Me a Coffee.',
  },
  {
    category: 'getting-started',
    question: 'Can I use it offline?',
    answer: 'Yes! Install it as a PWA (Progressive Web App) from your browser, or download the desktop app for Windows, macOS, or Linux. Both work fully offline.',
  },

  // Cost Calculations
  {
    category: 'costs',
    question: 'What costs does 3DCoster include?',
    answer: 'Filament cost, electricity, printer depreciation (with customizable recovery period), nozzle wear, labor (prep + post-processing time), failure rate adjustment, model/STL licensing, shipping (carrier or delivery), packaging materials, and marketplace fees (Etsy, Facebook, etc.).',
  },
  {
    category: 'costs',
    question: 'How does printer depreciation work?',
    answer: 'You set how long you want to recover your printer cost (e.g., 12 months) and your estimated monthly print hours. The calculator spreads the printer cost over that period. This is a "fixed cost" that gets recovered through sales, not added to each unit.',
  },
  {
    category: 'costs',
    question: 'What is the difference between fixed costs and per-unit costs?',
    answer: 'Per-unit costs (filament, electricity, labor) are spent every time you print. Fixed costs (printer depreciation, model purchase) are one-time investments recovered over multiple sales. The break-even calculator shows how many units you need to sell to recover fixed costs.',
  },
  {
    category: 'costs',
    question: 'How does the failure rate adjustment work?',
    answer: 'If you have a 10% failure rate, the calculator increases your per-unit cost to account for the 1-in-10 prints that fail. This ensures you factor in wasted filament and time.',
  },
  {
    category: 'costs',
    question: 'What marketplace fees are supported?',
    answer: 'Etsy (transaction + payment + listing + offsite ads), Facebook Marketplace (local and shipped), and Kijiji. You can customize the fee percentages in Settings if platforms change their rates.',
  },

  // Features
  {
    category: 'features',
    question: 'Can I track multiple printers?',
    answer: 'Yes! Add multiple printer instances in Printer Settings. Each tracks its own print hours, purchase price, and recovery period. Useful if you have the same model with different ages or purchase prices.',
  },
  {
    category: 'features',
    question: 'What currencies are supported?',
    answer: '18 currencies including USD, CAD, EUR, GBP, AUD, and more. Select your currency in User Profile (click the user icon). Currency affects which shipping carriers are shown.',
  },
  {
    category: 'features',
    question: 'How do I add custom shipping carriers?',
    answer: 'Go to Settings (gear icon) > Shipping tab > scroll to Custom Carriers. Add carriers with a name and default cost. They appear in the shipping dropdown when calculating costs.',
  },
  {
    category: 'features',
    question: 'What are "New" badges?',
    answer: 'Features added in the last 3 days show a "New" badge. After you see a feature, the badge disappears after 3 days. This helps you discover new functionality.',
  },

  // Technical
  {
    category: 'technical',
    question: 'Where is my data stored?',
    answer: 'In your browser\'s IndexedDB - a local database that persists even when you close the browser. Nothing is sent to any server. If you clear browser data, your 3DCoster data will be deleted.',
  },
  {
    category: 'technical',
    question: 'Can I export my data?',
    answer: 'Export functionality is on the roadmap. For now, your data is stored in IndexedDB which you can access via browser dev tools if needed.',
  },
  {
    category: 'technical',
    question: 'Will my data sync between devices?',
    answer: 'Not currently - data is stored locally on each device. Cloud sync is being considered for future versions, but privacy and keeping it free are priorities.',
  },
  {
    category: 'technical',
    question: 'Is it open source?',
    answer: 'Yes! MIT licensed on GitHub. You can view the code, report issues, suggest features, or contribute at github.com/Waarangel/3dcoster.',
  },
  {
    category: 'technical',
    question: 'macOS says the app is "damaged" - what do I do?',
    answer: 'This happens because the app isn\'t signed with an Apple Developer certificate. It\'s not actually damaged. To fix: Right-click (or Ctrl+click) the app, select "Open", then click "Open" in the dialog. You only need to do this once. Alternatively, run this in Terminal: xattr -cr /Applications/3DCoster.app',
  },
];

const categories = [
  { id: 'all', label: 'All' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'costs', label: 'Cost Calculations' },
  { id: 'features', label: 'Features' },
  { id: 'technical', label: 'Technical' },
] as const;

export function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredFaqs = activeCategory === 'all'
    ? faqs
    : faqs.filter(faq => faq.category === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
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
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Features
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

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Frequently Asked Questions</h1>
            <p className="text-slate-400 text-lg">
              Everything you need to know about using 3DCoster
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-3">
            {filteredFaqs.map((faq, index) => (
              <div
                key={index}
                className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4"
                >
                  <span className="text-white font-medium">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-4 text-slate-400">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-12 text-center">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
              <h2 className="text-xl font-semibold text-white mb-2">Still have questions?</h2>
              <p className="text-slate-400 mb-6">
                Can't find what you're looking for? Reach out to the community or report an issue.
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="https://github.com/Waarangel/3dcoster/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Report an Issue
                </a>
                <Link
                  to="/feedback"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Send Feedback
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
