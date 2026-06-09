import { StrictMode, Component, Suspense } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { lazyWithRetry } from './utils/lazyWithRetry.ts'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt.tsx'

// Lazy load marketing pages (not needed for calculator startup).
// lazyWithRetry auto-reloads once on a stale-chunk 404 after a redeploy,
// instead of crashing into the ErrorBoundary below.
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage.tsx').then(m => ({ default: m.LandingPage })), 'LandingPage')
const DownloadPage = lazyWithRetry(() => import('./pages/DownloadPage.tsx').then(m => ({ default: m.DownloadPage })), 'DownloadPage')
const FeaturesPage = lazyWithRetry(() => import('./pages/FeaturesPage.tsx').then(m => ({ default: m.FeaturesPage })), 'FeaturesPage')
const RoadmapPage = lazyWithRetry(() => import('./pages/RoadmapPage.tsx').then(m => ({ default: m.RoadmapPage })), 'RoadmapPage')
const FeedbackPage = lazyWithRetry(() => import('./pages/FeedbackPage.tsx').then(m => ({ default: m.FeedbackPage })), 'FeedbackPage')
const FAQPage = lazyWithRetry(() => import('./pages/FAQPage.tsx').then(m => ({ default: m.FAQPage })), 'FAQPage')
const ChangelogPage = lazyWithRetry(() => import('./pages/ChangelogPage.tsx').then(m => ({ default: m.ChangelogPage })), 'ChangelogPage')

// Page loading fallback
function PageLoading() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </div>
  )
}

// Error Boundary
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function Root() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {__IS_TAURI__ ? (
            <>
              {/* Desktop app: only show the calculator */}
              <Route path="/" element={<App />} />
              <Route path="/app" element={<App />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              {/* Web: show full site with marketing pages */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/app" element={<App />} />
              <Route path="/download" element={<DownloadPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
            </>
          )}
        </Routes>
      </Suspense>
      {/* Web-only PWA update prompt. Desktop (Tauri) uses UpdateBanner instead,
          so the service-worker hook never runs in the desktop build. */}
      {!__IS_TAURI__ && <PwaUpdatePrompt />}
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
    <Analytics />
  </StrictMode>,
)
