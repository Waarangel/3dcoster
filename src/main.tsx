import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isTauri } from '@tauri-apps/api/core'
import './index.css'
import App from './App.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { DownloadPage } from './pages/DownloadPage.tsx'
import { FeaturesPage } from './pages/FeaturesPage.tsx'
import { FeedbackPage } from './pages/FeedbackPage.tsx'

// Debug: Log at module load time
console.log('[DEBUG main.tsx] Module loading...')
console.log('[DEBUG main.tsx] window.isTauri:', (window as unknown as { isTauri?: boolean }).isTauri)
console.log('[DEBUG main.tsx] globalThis.isTauri:', (globalThis as unknown as { isTauri?: boolean }).isTauri)
console.log('[DEBUG main.tsx] isTauri() result:', isTauri())

// Root component that handles Tauri detection at render time
// Detection must happen AFTER Tauri's initialization script sets window.isTauri
function Root() {
  const [isDesktopApp, setIsDesktopApp] = useState<boolean | null>(null)

  useEffect(() => {
    // Debug: Log at useEffect time
    console.log('[DEBUG Root useEffect] Running...')
    console.log('[DEBUG Root useEffect] window.isTauri:', (window as unknown as { isTauri?: boolean }).isTauri)
    console.log('[DEBUG Root useEffect] isTauri() result:', isTauri())

    const result = isTauri()
    console.log('[DEBUG Root useEffect] Setting isDesktopApp to:', result)
    setIsDesktopApp(result)
  }, [])

  console.log('[DEBUG Root render] isDesktopApp:', isDesktopApp)

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
