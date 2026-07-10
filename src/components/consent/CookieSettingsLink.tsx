import type { ReactNode } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';

interface CookieSettingsLinkProps {
  className?: string;
  children?: ReactNode;
}

// Phase 42 GDPR-01 (D-02) — thin control that reopens vanilla-cookieconsent's
// preferences modal. Renders inline as a plain text link matching the
// Footer's sibling <a>/<Link> list (text-slate-400 hover:text-slate-300); the
// shared <Button> primitive's padding/background/min-height would visually
// dwarf a footer link row and the SettingsModal's other inline controls
// (mirrors the JobsManager.tsx overflow-toggle precedent for this exception).
export function CookieSettingsLink({ className, children }: CookieSettingsLinkProps) {
  return (
    // allow-raw-html: plain-text link control in a footer/settings link list — the shared Button primitive's padding/min-height would dwarf a footer link row
    <button
      type="button"
      onClick={() => CookieConsent.showPreferences()}
      className={className ?? 'text-slate-400 hover:text-slate-300 transition-colors'}
    >
      {children ?? 'Cookie settings'}
    </button>
  );
}
