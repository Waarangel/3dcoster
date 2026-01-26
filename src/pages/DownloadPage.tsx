import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';

type Platform = 'windows' | 'mac' | 'unknown';

function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('mac')) return 'mac';
  return 'unknown';
}

export function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

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
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Features
            </Link>
            <Link
              to="/download"
              className="px-4 py-2 text-white transition-colors text-sm font-medium"
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

      {/* Download Content */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Download 3DCoster</h1>
            <p className="text-slate-400 text-lg">
              Get the desktop app for the best experience. Works offline, keeps your data safe.
            </p>
          </div>

          {/* Download Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Windows */}
            <div className="flex flex-col items-center">
              {/* Badge outside card */}
              <div className="h-6 mb-2">
                {platform === 'windows' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs">
                    Recommended for you
                  </span>
                )}
              </div>
              <div className={`bg-slate-800 rounded-xl p-6 border transition-colors w-full ${
                platform === 'windows' ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'
              }`}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Windows</h2>
                    <p className="text-slate-500 text-sm">Windows 10 or later</p>
                  </div>
                </div>
                <a
                  href="https://github.com/Waarangel/3dcoster/releases/latest/download/3DCoster_1.0.0_x64-setup.exe"
                  className="block w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-center text-sm"
                >
                  Download for Windows
                </a>
                {/* Spacer to match Mac card height */}
                <div className="h-[34px] mt-2"></div>
                <p className="text-slate-500 text-xs text-center mt-2">
                  .exe installer
                </p>
              </div>
            </div>

            {/* Mac */}
            <div className="flex flex-col items-center">
              {/* Badge outside card */}
              <div className="h-6 mb-2">
                {platform === 'mac' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs">
                    Recommended for you
                  </span>
                )}
              </div>
              <div className={`bg-slate-800 rounded-xl p-6 border transition-colors w-full ${
                platform === 'mac' ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'
              }`}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">macOS</h2>
                    <p className="text-slate-500 text-sm">macOS 10.15 or later</p>
                  </div>
                </div>
                <a
                  href="https://github.com/Waarangel/3dcoster/releases/latest/download/3DCoster_1.0.0_aarch64.dmg"
                  className="block w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-center text-sm"
                >
                  Download for Mac Silicon
                </a>
                <a
                  href="https://github.com/Waarangel/3dcoster/releases/latest/download/3DCoster_1.0.0_x64.dmg"
                  className="block w-full py-2 mt-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors font-medium text-center text-xs"
                >
                  Download for Mac Intel
                </a>
                <p className="text-slate-500 text-xs text-center mt-2">
                  M1/M2/M3/M4 • Intel (pre-2020)
                </p>
                <p className="text-yellow-500/80 text-xs text-center mt-3">
                  <strong>Note:</strong> If macOS shows a "damaged" warning, right-click the app and select "Open".{' '}
                  <Link to="/faq" className="underline hover:text-yellow-400">Learn more</Link>
                </p>
              </div>
            </div>
          </div>

          {/* Alternative */}
          <div className="text-center mt-12">
            <p className="text-slate-500 mb-4">Don't want to install anything?</p>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Use the Web App</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Why Desktop */}
          <div className="mt-20">
            <h2 className="text-2xl font-bold text-white text-center mb-8">Why Use the Desktop App?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Works Offline</h3>
                <p className="text-slate-400 text-sm">
                  No internet? No problem. Perfect for workshops and print farms.
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Data Safety</h3>
                <p className="text-slate-400 text-sm">
                  Your data stays on your computer. No browser cache to accidentally clear.
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Fast &amp; Native</h3>
                <p className="text-slate-400 text-sm">
                  Launches instantly from your desktop. No browser tabs to manage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
