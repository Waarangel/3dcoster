import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui';

type HeaderVariant = 'dark' | 'light';

interface HeaderProps {
  /** 'dark' (default) keeps the original dark chrome for all app/marketing pages.
   *  'light' is the warm "Quiet Workshop" landing treatment. */
  variant?: HeaderVariant;
}

export function Header({ variant = 'dark' }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  const isLight = variant === 'light';

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  const navClass = isLight
    ? 'fixed top-0 left-0 right-0 z-50 bg-[var(--paper)]/80 backdrop-blur-sm border-b border-[var(--hairline)]'
    : 'fixed top-0 left-0 right-0 z-50 bg-[var(--bg)]/80 backdrop-blur-sm border-b border-[var(--hairline)]';

  const linkClass = isLight
    ? 'px-4 py-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-sm font-medium'
    : 'px-4 py-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-sm font-medium';

  const ctaClass = isLight
    ? 'px-4 py-2 bg-[var(--pine)] hover:bg-[var(--pine-strong)] text-white rounded-lg transition-colors text-sm font-medium'
    : 'px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-soft)] text-white rounded-lg transition-colors text-sm font-medium';

  const mobilePanelClass = isLight
    ? 'bg-[var(--paper)]/95 backdrop-blur-sm border-t border-[var(--hairline)] px-6 py-3 flex flex-col gap-1'
    : 'bg-[var(--bg)]/95 backdrop-blur-sm border-t border-[var(--hairline)] px-6 py-3 flex flex-col gap-1';

  const mobileLinkClass = isLight
    ? 'flex items-center px-4 py-3 min-h-[44px] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunk)] rounded-lg transition-colors text-sm font-medium'
    : 'flex items-center px-4 py-3 min-h-[44px] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-lg transition-colors text-sm font-medium';

  const mobileCtaClass = isLight
    ? 'flex items-center justify-center px-4 py-3 min-h-[44px] bg-[var(--pine)] hover:bg-[var(--pine-strong)] text-white rounded-lg transition-colors text-sm font-medium mt-1'
    : 'flex items-center justify-center px-4 py-3 min-h-[44px] bg-[var(--brand)] hover:bg-[var(--brand-soft)] text-white rounded-lg transition-colors text-sm font-medium mt-1';

  return (
    <nav className={navClass}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" aria-label="3DCoster home">
          {isLight ? (
            <>
              {/* Full-color wordmark SVG has a white wordmark (dark-only); on light we
                  compose the icon mark with a display-font wordmark in ink. */}
              <img src="/3DCosterLogoOnly.svg" alt="" className="h-8 w-auto" aria-hidden="true" />
              <span className="font-display text-xl font-extrabold text-[var(--ink)]">3DCoster</span>
            </>
          ) : (
            <img src="/3DCosterLogoWithWords.svg" alt="3DCoster" className="h-9 w-auto" />
          )}
        </Link>

        {/* Desktop navigation - hidden below md */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/features" className={linkClass}>
            Features
          </Link>
          <Link to="/download" className={linkClass}>
            Download
          </Link>
          <Link to="/app" className={ctaClass}>
            Go to App
          </Link>
        </div>

        {/* Hamburger button - visible only below md */}
        <Button
          ref={buttonRef}
          variant="ghost"
          btnSize="sm"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className={`md:hidden w-11 h-11 rounded-lg ${isLight ? 'text-[var(--ink)]' : ''}`}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            /* X close icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Hamburger icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </Button>
      </div>

      {/* Mobile menu dropdown */}
      <div
        ref={menuRef}
        className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out ${
          mobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={mobilePanelClass}>
          <Link to="/features" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass}>
            Features
          </Link>
          <Link to="/download" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass}>
            Download
          </Link>
          <Link to="/app" onClick={() => setMobileMenuOpen(false)} className={mobileCtaClass}>
            Go to App
          </Link>
        </div>
      </div>
    </nav>
  );
}
