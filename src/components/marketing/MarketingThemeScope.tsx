import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface MarketingThemeScopeProps {
  children: ReactNode;
}

// Marker class toggled on document.body while a marketing route is mounted.
// vanilla-cookieconsent (Phase 42) appends its #cc-main banner directly to
// document.body — outside the React tree and outside the .theme-brand-dark
// div below — so no CSS cascade from this component reaches it. This
// body-level marker is the only signal 45-08's consent-banner brand override
// (`body.route-marketing #cc-main`) can key off. It MUST track this
// component's mount lifecycle exactly: present on every marketing route,
// absent on /app and the desktop build (the D-02/D-12 boundary).
const ROUTE_MARKETING_CLASS = 'route-marketing';

// Wraps marketing route content in the Cost-Truth Dark token scope. The
// `.theme-brand-dark` class overrides the CSS custom properties defined at
// :root (src/index.css) — /app never nests inside this wrapper, so its
// shared ui/ primitives keep resolving the slate-equivalent :root defaults
// unchanged (D-02). See .planning/phases/45-brand-launch/45-RESEARCH.md
// Architecture Patterns Pattern 1.
export function MarketingThemeScope({ children }: MarketingThemeScopeProps) {
  useEffect(() => {
    document.body.classList.add(ROUTE_MARKETING_CLASS);
    return () => {
      document.body.classList.remove(ROUTE_MARKETING_CLASS);
    };
  }, []);

  return <div className="theme-brand-dark">{children}</div>;
}
