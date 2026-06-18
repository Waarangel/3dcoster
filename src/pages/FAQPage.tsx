import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';

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
    answer: 'The core calculator and selling workflow are free to use and open source under the MIT license — no ads, no data collection. If you find it useful, you can support development via Buy Me a Coffee.',
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
    answer: 'Not currently - data is stored locally on each device. Cloud sync is being considered for future versions, with privacy and keeping your data on your own device kept a priority.',
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <Reveal trigger="mount">
            <div className="text-center mb-12">
              <h1 className="font-display text-4xl font-bold text-[var(--ink)] mb-4">Frequently Asked Questions</h1>
              <p className="text-[var(--ink-soft)] text-lg">
                Everything you need to know about using 3DCoster
              </p>
            </div>
          </Reveal>

          <div className="max-w-3xl mx-auto">
            {/* Category Filter */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ease-out ${
                    activeCategory === cat.id
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-[var(--surface)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* FAQ Accordion */}
            <Reveal trigger="inView">
              <div className="space-y-3">
                {filteredFaqs.map((faq, index) => (
                  <div
                    key={index}
                    className="bg-[var(--surface)] border border-[var(--hairline)] rounded-2xl overflow-hidden transition duration-200 ease-out hover:border-[rgba(23,150,255,0.4)]"
                  >
                    <button
                      onClick={() => setOpenIndex(openIndex === index ? null : index)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between gap-4"
                    >
                      <span className="text-[var(--ink)] font-medium">{faq.question}</span>
                      <svg
                        className={`w-5 h-5 text-[var(--brand-soft)] transition-transform ${
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
                      <div className="px-6 pb-4 text-[var(--ink-soft)]">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Still have questions */}
            <Reveal trigger="inView">
              <div className="mt-12 text-center">
                <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-2xl p-8">
                  <h2 className="font-display text-xl font-semibold text-[var(--ink)] mb-2">Still have questions?</h2>
                  <p className="text-[var(--ink-soft)] mb-6">
                    Can't find what you're looking for? Reach out to the community or report an issue.
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <a
                      href="https://github.com/Waarangel/3dcoster/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-2)] hover:border-[rgba(23,150,255,0.4)] border border-[var(--hairline)] text-[var(--ink)] rounded-lg transition duration-200 ease-out text-sm font-medium"
                    >
                      Report an Issue
                    </a>
                    <Link
                      to="/feedback"
                      className="px-5 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-soft)] text-white rounded-lg transition duration-200 ease-out text-sm font-medium"
                    >
                      Send Feedback
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
