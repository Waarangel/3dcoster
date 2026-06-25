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
 * `handleReload` below, which activates the new worker and refreshes.
 *
 * This is the WEB counterpart to the Tauri-desktop `UpdateBanner` (which checks
 * GitHub Releases). Mount it only on web — never in the Tauri build.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  /**
   * Activate the waiting worker (if any) and reload onto the new version.
   *
   * We deliberately drive the reload ourselves rather than leaning on
   * vite-plugin-pwa's built-in auto-reload, because that only reloads pages
   * that were already service-worker-controlled when they loaded. A page opened
   * fresh (first visit, before `clientsClaim`) or via a hard refresh
   * (Cmd/Ctrl+Shift+R bypasses the SW) is UNCONTROLLED — and on an uncontrolled
   * page the newly-installed worker auto-activates with nothing left "waiting",
   * so `updateServiceWorker()` has no waiting worker to message and no
   * `controllerchange` ever fires. The result is a banner whose Reload button
   * does nothing. Handling both cases explicitly fixes that.
   */
  const handleReload = async () => {
    let reloaded = false
    const reload = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }

    // Controlled-page path: reload the instant the new worker takes control.
    navigator.serviceWorker?.addEventListener('controllerchange', reload, {
      once: true,
    })

    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration?.waiting) {
      // A worker is waiting — ask it to skip waiting and take over, with a
      // safety net in case `controllerchange` never arrives.
      updateServiceWorker(true)
      setTimeout(reload, 2000)
    } else {
      // Nothing waiting: the new worker already activated (uncontrolled page).
      // Just reload to pick up the new assets.
      reload()
    }
  }

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white shadow-lg shadow-black/30"
      >
        <span>A new version of 3DCoster is available.</span>
        <Button variant="primary" btnSize="sm" onClick={handleReload}>
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
