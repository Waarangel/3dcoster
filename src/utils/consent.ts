// Phase 42 GDPR-01: module-level consent pub/sub store. No React imports here —
// this is a pure store consumed via useSyncExternalStore in src/hooks/useConsent.ts.
// Safe default: analytics is OFF until vanilla-cookieconsent reports an explicit
// opt-in via onFirstConsent/onConsent/onChange (see CookieConsentManager.tsx).
type ConsentListener = () => void;

const listeners = new Set<ConsentListener>();
let analyticsAccepted = false;

/**
 * Updates the analytics-consent flag and notifies all subscribers.
 *
 * Examples:
 *   setAnalyticsConsent(true) → subsequent getAnalyticsConsentSnapshot() returns true
 *   setAnalyticsConsent(false) → subsequent getAnalyticsConsentSnapshot() returns false
 */
export function setAnalyticsConsent(accepted: boolean): void {
  analyticsAccepted = accepted;
  listeners.forEach((listener) => listener());
}

/**
 * Registers a listener invoked whenever setAnalyticsConsent changes the value.
 * Returns an unsubscribe function.
 *
 * Examples:
 *   const unsubscribe = subscribeConsent(() => console.log('changed'));
 *   unsubscribe(); → listener no longer invoked on future setAnalyticsConsent calls
 */
export function subscribeConsent(listener: ConsentListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Returns the current analytics-consent snapshot. Defaults to false (safe —
 * analytics off) until setAnalyticsConsent(true) has been called.
 *
 * Examples:
 *   getAnalyticsConsentSnapshot() → false (before any consent decision)
 */
export function getAnalyticsConsentSnapshot(): boolean {
  return analyticsAccepted;
}
