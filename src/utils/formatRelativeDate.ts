/** Tiny formatter for "Last used: 3 days ago" / "Never used" labels (Phase 15.1 — UI-SPEC §2). */

// Cache the formatter at module scope so we don't allocate a new one per call.
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelativeDate(date: Date | undefined): string {
  if (date === undefined) return 'Never used';

  const deltaSeconds = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(deltaSeconds);

  // Pick the largest applicable unit. Past dates have negative deltas, which is
  // exactly what Intl.RelativeTimeFormat expects (value=-3, unit='day' → "3 days ago").
  if (abs < 60) {
    return rtf.format(Math.round(deltaSeconds), 'second');
  }
  if (abs < 3600) {
    return rtf.format(Math.round(deltaSeconds / 60), 'minute');
  }
  if (abs < 86400) {
    return rtf.format(Math.round(deltaSeconds / 3600), 'hour');
  }
  if (abs < 604800) {
    return rtf.format(Math.round(deltaSeconds / 86400), 'day');
  }
  if (abs < 2592000) {
    return rtf.format(Math.round(deltaSeconds / 604800), 'week');
  }
  if (abs < 31536000) {
    return rtf.format(Math.round(deltaSeconds / 2592000), 'month');
  }
  return rtf.format(Math.round(deltaSeconds / 31536000), 'year');
}
