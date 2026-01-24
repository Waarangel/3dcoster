import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { DownloadPage } from './pages/DownloadPage.tsx'
import { FeaturesPage } from './pages/FeaturesPage.tsx'
import { FeedbackPage } from './pages/FeedbackPage.tsx'

// Robust Tauri detection using __TAURI_INTERNALS__ with polling
// This handles timing issues where the bundle loads before Tauri's init script
function detectTauri(): Promise<boolean> {
  return new Promise((resolve) => {
    // Check immediately - __TAURI_INTERNALS__ is the IPC backbone, always present in Tauri
    if ('__TAURI_INTERNALS__' in window) {
      resolve(true)
      return
    }

    // Poll for up to 100ms (10 checks at 10ms intervals) to handle race conditions
    let attempts = 0
    const maxAttempts = 10
    const interval = setInterval(() => {
      attempts++
      if ('__TAURI_INTERNALS__' in window) {
        clearInterval(interval)
        resolve(true)
      } else if (attempts >= maxAttempts) {
        clearInterval(interval)
        resolve(false) // Not Tauri after 100ms - definitely web browser
      }
    }, 10)
  })
}

// Root component that handles Tauri detection at render time
function Root() {
  const [isDesktopApp, setIsDesktopApp] = useState<boolean | null>(null)

  useEffect(() => {
    detectTauri().then(setIsDesktopApp)
  }, [])

  // Show nothing while detecting environment (prevents flash)
  if (isDesktopApp === null) {
    return null
  }

  return (
    <BrowserRouter>
      <Routes>
        {isDesktopApp ? (
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
            <Route path="/feedback" element={<FeedbackPage />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
