import { describe, it, expect, beforeEach } from 'vitest';
import { subscribeConsent, getAnalyticsConsentSnapshot, setAnalyticsConsent } from './consent';

describe('consent store', () => {
  beforeEach(() => {
    // Reset the module-level store to its safe default between tests.
    setAnalyticsConsent(false);
  });

  it('returns false before any consent is set (safe default)', () => {
    expect(getAnalyticsConsentSnapshot()).toBe(false);
  });

  it('returns true after setAnalyticsConsent(true)', () => {
    setAnalyticsConsent(true);
    expect(getAnalyticsConsentSnapshot()).toBe(true);
  });

  it('notifies a subscribed listener when the value changes', () => {
    let callCount = 0;
    subscribeConsent(() => { callCount += 1; });
    setAnalyticsConsent(true);
    expect(callCount).toBe(1);
  });

  it('stops notifying after unsubscribe', () => {
    let callCount = 0;
    const unsubscribe = subscribeConsent(() => { callCount += 1; });
    unsubscribe();
    setAnalyticsConsent(true);
    expect(callCount).toBe(0);
  });
});
