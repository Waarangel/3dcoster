import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

const RELOAD_FLAG_PREFIX = 'chunkReload:'

/**
 * Drop-in replacement for `React.lazy` that survives a stale code chunk.
 *
 * When the site is redeployed (every push to `main` triggers a Vercel build),
 * the hashed chunk filenames change. A tab still running the OLD build will
 * 404 when it tries to lazy-load a route whose chunk no longer exists, throwing
 * `Failed to fetch dynamically imported module`. Without handling, that lands
 * the user on the ErrorBoundary crash screen ("Something went wrong" + "Reload
 * App").
 *
 * This wrapper catches that failure and does ONE automatic `location.reload()`
 * to pull the new `index.html` (which references the new chunk names). A
 * per-chunk `sessionStorage` flag guarantees at most one reload, so a genuinely
 * broken chunk (offline, real bug) still falls through to the ErrorBoundary
 * instead of reload-looping.
 *
 * @param factory - the dynamic `import()` thunk, same as you'd pass to `lazy`
 * @param name - stable identifier for this chunk, used as the reload-guard key
 *
 * Examples:
 *   lazyWithRetry(() => import('./pages/FAQPage.tsx').then(m => ({ default: m.FAQPage })), 'FAQPage')
 *   lazyWithRetry(() => import('./Heavy.tsx'), 'Heavy')  // default export
 */
// `ComponentType<any>` mirrors React's own `lazy` signature — a generic lazy
// wrapper must accept components with arbitrary props, so this is the one place
// `any` is the correct constraint rather than `unknown`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const flagKey = `${RELOAD_FLAG_PREFIX}${name}`
    try {
      const component = await factory()
      // Loaded cleanly — clear any stale guard so a FUTURE deploy can retry.
      window.sessionStorage.removeItem(flagKey)
      return component
    } catch (error) {
      const alreadyReloaded = window.sessionStorage.getItem(flagKey)
      if (!alreadyReloaded) {
        window.sessionStorage.setItem(flagKey, '1')
        // New chunk names live in the freshly-served index.html, so a full
        // document reload (not a router navigation) is required to pick them up.
        window.location.reload()
        // Never resolve: keep the Suspense fallback on screen during the brief
        // reload window instead of flashing the crash screen.
        return new Promise<{ default: T }>(() => {})
      }
      // Second failure for the same chunk — this is a real error, not a stale
      // deploy. Let it propagate to the ErrorBoundary.
      throw error
    }
  })
}
