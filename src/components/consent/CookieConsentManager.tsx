import { useEffect } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import './consent-theme.css';
import { setAnalyticsConsent } from '../../utils/consent';

// Phase 42 GDPR-01 — mounts vanilla-cookieconsent v3 in opt-in mode with two
// categories: necessary (locked on) and analytics (off by default). Web-only
// (see main.tsx's `!__IS_TAURI__` gate) — the Tauri desktop build never mounts
// this component and therefore never shows a banner (D-03).
//
// T-42-01 mitigation: `equalWeightButtons` defaults to `true` in the library —
// left unset here deliberately. Do NOT set it to `false`; that recreates the
// C-04 dark-pattern violation (reject harder to find/click than accept).
export function CookieConsentManager() {
  useEffect(() => {
    CookieConsent.run({
      mode: 'opt-in',
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: { enabled: false },
      },
      guiOptions: {
        consentModal: {
          layout: 'bar inline',
          position: 'bottom',
        },
        preferencesModal: {
          layout: 'box',
          position: 'right',
        },
      },
      onFirstConsent: ({ cookie }) => setAnalyticsConsent(cookie.categories.includes('analytics')),
      onConsent: ({ cookie }) => setAnalyticsConsent(cookie.categories.includes('analytics')),
      onChange: ({ cookie }) => setAnalyticsConsent(cookie.categories.includes('analytics')),
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'We use cookies',
              description:
                'We use analytics cookies to understand how 3DCoster is used and improve it. Your calculator data (jobs, materials, customers) always stays on your device — we never see it.',
              acceptAllBtn: 'Accept All',
              acceptNecessaryBtn: 'Reject All',
              showPreferencesBtn: 'Manage preferences',
            },
            preferencesModal: {
              title: 'Cookie preferences',
              acceptAllBtn: 'Accept All',
              acceptNecessaryBtn: 'Reject All',
              savePreferencesBtn: 'Save preferences',
              sections: [
                {
                  title: 'Strictly necessary',
                  description: 'Required to remember your cookie preference itself. Cannot be disabled.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analytics',
                  description: 'Vercel Web Analytics — aggregate page-view counts only, no cross-site tracking, no advertising.',
                  linkedCategory: 'analytics',
                },
              ],
            },
          },
        },
      },
    });
  }, []);

  return null;
}
