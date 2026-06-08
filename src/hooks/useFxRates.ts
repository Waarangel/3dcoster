import { useState, useEffect } from 'react';
import { getFxRateTable, setFxRateTable } from '../db/database';
import { fetchUsdRateTable } from '../utils/fxRates';
import type { FxRateTable } from '../utils/fxConvert';

// How long a cached rate table is considered fresh. FX rates move slowly enough
// that a once-a-day refresh is plenty for cost estimation; this keeps the app
// off the network on every launch while never showing badly stale rates.
const RATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Module-lifetime latch so the network refresh runs at most once per page load,
// even though many components mount the hook. The cached table itself is shared
// via IndexedDB, so concurrent mounts converge on the same data.
let refreshRan = false;

function isStale(table: FxRateTable): boolean {
  const fetched = Date.parse(`${table.date}T00:00:00Z`);
  if (Number.isNaN(fetched)) return true;
  return Date.now() - fetched > RATE_MAX_AGE_MS;
}

/**
 * Provides the cached USD-based FX rate table for display-time currency
 * conversion. Loads the cached table from IndexedDB immediately, then (once per
 * page load) refreshes it from the network when it is missing or stale and the
 * device is online. A failed refresh is non-fatal — the last good cached table
 * keeps being used, and conversion falls back to a no-data state only when no
 * table has ever been cached.
 *
 * Never blocks rendering: returns `null` until the first table is available.
 *
 * @returns the current FxRateTable, or null if none is cached yet.
 */
export function useFxRates(): FxRateTable | null {
  const [table, setTable] = useState<FxRateTable | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await getFxRateTable();
      if (cancelled) return;
      if (cached) setTable(cached);

      // Only one network refresh per page load.
      if (refreshRan) return;
      const needsRefresh = !cached || isStale(cached);
      if (!needsRefresh) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      refreshRan = true;
      try {
        const fresh = await fetchUsdRateTable();
        if (!fresh) {
          // No rate this launch — release the latch so a later mount retries.
          refreshRan = false;
          return;
        }
        await setFxRateTable(fresh);
        if (!cancelled) setTable(fresh);
      } catch (err) {
        refreshRan = false;
        if (import.meta.env.DEV) console.error('useFxRates refresh failed:', err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return table;
}
