import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui'

/**
 * Web-only service-worker update prompt.
 *
 * The PWA uses `registerType: 'prompt'` (see vite.config.ts), so a new
 * deployment's service worker installs and WAITS instead of taking over
 * mid-session. The old service worker keeps serving the old precached chunks,
 * so a running tab never has a route chunk yanked out from under it. When an
 * update is ready we surface this dismissible banner; clicking "Reload" calls
 * `updateServiceWorker(true)` which activates the new worker and refreshes.
 *
 * This is the WEB counterpart to the Tauri-desktop `UpdateBanner` (which checks
 * GitHub Releases). Mount it only on web — never in the Tauri build.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white shadow-lg shadow-black/30"
      >
        <span>A new version of 3DCoster is available.</span>
        <Button
          variant="primary"
          btnSize="sm"
          onClick={() => updateServiceWorker(true)}
        >
          Reload
        </Button>
        <Button
          variant="ghost"
          btnSize="sm"
          onClick={() => setNeedRefresh(false)}
          className="text-slate-300 hover:text-white"
          aria-label="Dismiss update notification"
        >
          Later
        </Button>
      </div>
    </div>
  )
}
