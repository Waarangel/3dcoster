import { Link } from 'react-router-dom';
import { CookieSettingsLink } from './consent/CookieSettingsLink';

interface FooterProps {
  variant?: 'full' | 'minimal';
}

export function Footer({ variant = 'full' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === 'minimal') {
    return (
      <footer className="py-4 border-t border-[var(--hairline)]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--ink-faint)]">
            <div className="flex items-center gap-2">
              <span>3DCoster - Know your true costs</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/faq" className="hover:text-[var(--ink)] transition-colors">FAQ</Link>
              <Link to="/changelog" className="hover:text-[var(--ink)] transition-colors">What's New</Link>
              <a
                href="https://github.com/Waarangel/3dcoster"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--ink)] transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="py-12 px-6 border-t border-[var(--hairline)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/pwa-192x192.png" alt="3DCoster" className="w-8 h-8 rounded-lg" />
              <span className="text-[var(--ink)] font-semibold">3DCoster</span>
            </div>
            <p className="text-[var(--ink-soft)] text-sm mb-4">
              Know your true costs
            </p>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="text-[var(--ink)] font-medium mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/features" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/roadmap" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Roadmap
                </Link>
              </li>
              <li>
                <Link to="/changelog" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  What's New
                </Link>
              </li>
              <li>
                <Link to="/download" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Download
                </Link>
              </li>
            </ul>
          </div>

          {/* Help Column */}
          <div>
            <h3 className="text-[var(--ink)] font-medium mb-4">Help</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/faq" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/Waarangel/3dcoster/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
                >
                  Report a Bug
                </a>
              </li>
              <li>
                <Link to="/feedback" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Feedback
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h3 className="text-[var(--ink)] font-medium mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/privacy" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/Waarangel/3dcoster/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
                >
                  MIT License
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Waarangel/3dcoster"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
                >
                  Source Code
                </a>
              </li>
              <li>
                <CookieSettingsLink />
              </li>
            </ul>
          </div>

          {/* Connect Column */}
          <div>
            <h3 className="text-[var(--ink)] font-medium mb-4">Connect</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/Waarangel/3dcoster"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://discord.gg/teYxBQMR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.197.373.291a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Discord
                </a>
              </li>
              <li>
                <a
                  href="https://ashlaindustries.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
                >
                  Ashla Industries
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[var(--hairline)] flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--ink-faint)]">
          <div>
            &copy; {currentYear} 3DCoster. Open source under MIT License.
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[var(--ink-faint)]">Data saved locally in your browser</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
