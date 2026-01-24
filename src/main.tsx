import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isTauri } from '@tauri-apps/api/core'
import './index.css'
import App from './App.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { DownloadPage } from './pages/DownloadPage.tsx'
import { FeaturesPage } from './pages/FeaturesPage.tsx'
import { FeedbackPage } from './pages/FeedbackPage.tsx'

// Use official Tauri API to detect if running in desktop app
// This is the recommended approach per Tauri v2 documentation
// Sources:
// - https://github.com/tauri-apps/tauri/discussions/6119
// - https://github.com/tauri-apps/tauri/discussions/6941
const isDesktopApp = isTauri()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
)
