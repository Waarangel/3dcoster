import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { DownloadPage } from './pages/DownloadPage.tsx'
import { FeaturesPage } from './pages/FeaturesPage.tsx'
import { FeedbackPage } from './pages/FeedbackPage.tsx'

// Detect if running in Tauri desktop app
const isTauri = '__TAURI__' in window

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {isTauri ? (
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
