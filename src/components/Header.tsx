import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/pwa-192x192.png" alt="3DCoster" className="w-10 h-10 rounded-xl" />
          <span className="text-white font-semibold text-xl">3DCoster</span>
        </Link>

        {/* Desktop navigation - hidden below md */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/features"
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Go to App
          </Link>
        </div>

        {/* Hamburger button - visible only below md */}
        <button
          ref={buttonRef}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
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
        </button>
      </div>

      {/* Mobile menu dropdown */}
      <div
        ref={menuRef}
        className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out ${
          mobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 px-6 py-3 flex flex-col gap-1">
          <Link
            to="/features"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-4 py-3 min-h-[44px] text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-sm font-medium"
          >
            Features
          </Link>
          <Link
            to="/download"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-4 py-3 min-h-[44px] text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-sm font-medium"
          >
            Download
          </Link>
          <Link
            to="/app"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center px-4 py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium mt-1"
          >
            Go to App
          </Link>
        </div>
      </div>
    </nav>
  );
}
