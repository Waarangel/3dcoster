import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll to the top whenever the route's pathname changes, so navigating
 * to a different page starts at the top — the way a normal page load does.
 * Without this, an SPA keeps the previous scroll offset, which is why clicking a
 * footer link drops you into the middle/bottom of the next page.
 *
 * Instant (`behavior: 'auto'`), not smooth, on purpose — smooth animates the old
 * page all the way up before the new one settles, which feels slow and fights
 * the per-page reveal animations. Smooth scrolling is for in-page anchors, not
 * page navigation, so we also bail when the URL carries a `#hash` and let the
 * browser handle that jump.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}
