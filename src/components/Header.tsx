import { Link } from 'react-router-dom';

export function Header() {
  return (
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
      </div>
    </nav>
  );
}
