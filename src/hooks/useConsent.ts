import { useSyncExternalStore } from 'react';
import { subscribeConsent, getAnalyticsConsentSnapshot } from '../utils/consent';

/**
 * Subscribes to the analytics-consent store (src/utils/consent.ts), driven by
 * vanilla-cookieconsent's onFirstConsent/onConsent/onChange callbacks. NOT a
 * storage-event listener — the library persists to a first-party cookie, not
 * localStorage, so storage events never fire for same-tab consent changes.
 *
 * Examples:
 *   useAnalyticsConsent() → false (before any consent decision)
 *   useAnalyticsConsent() → true (after the user accepts the Analytics category)
 *
 * Returns: boolean — true when analytics consent is currently granted.
 */
export function useAnalyticsConsent(): boolean {
  return useSyncExternalStore(subscribeConsent, getAnalyticsConsentSnapshot, getAnalyticsConsentSnapshot);
}
