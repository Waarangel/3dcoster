export const MAINTENANCE_INTERVAL = 500;

const STORAGE_KEY = '3dcoster-maintenance-dismissed';

/**
 * Returns the current map of dismissed maintenance intervals by printer instance ID.
 * Format: { [instanceId]: [500, 1000, 1500, ...] }
 */
export function getMaintenanceDismissedMap(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number[]>;
  } catch {
    return {};
  }
}

/**
 * Returns true if the given maintenance interval (hours) has already been dismissed
 * for the specified printer instance.
 */
export function isMaintenanceDismissed(instanceId: string, hours: number): boolean {
  const map = getMaintenanceDismissedMap();
  const dismissed = map[instanceId];
  if (!dismissed) return false;
  return dismissed.includes(hours);
}

/**
 * Marks the given maintenance interval (hours) as dismissed for the specified
 * printer instance, persisting to localStorage.
 */
export function markMaintenanceDismissed(instanceId: string, hours: number): void {
  const map = getMaintenanceDismissedMap();
  const existing = map[instanceId] ?? [];
  if (!existing.includes(hours)) {
    map[instanceId] = [...existing, hours];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage full — silently ignore
  }
}
