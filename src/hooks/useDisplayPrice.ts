import { useEffect, useState } from 'react';
import { getSetting, settingsKeys, isUserProfile } from '../db/database';
import type { UserProfile, Currency } from '../types';
import { useFxRates } from './useFxRates';
import { resolveDisplayCurrency, formatApproxPrice, formatZeroPrice } from '../utils/pricingDisplay';
import {
  MONTHLY_PRICE_AMOUNT,
  ANNUAL_PRICE_AMOUNT,
  BILLING_CURRENCY,
  MONTHLY_PRICE_LABEL,
  ANNUAL_PRICE_LABEL,
} from '../pricing';

export interface DisplayPriceSpot {
  /** Home-currency approximation, or null when there is nothing to show
   *  beyond the billing label (same currency, or no FX table yet). */
  approx: string | null;
  /** Verbatim MONTHLY_PRICE_LABEL / ANNUAL_PRICE_LABEL — the disclosed,
   *  guarded billing truth. Always present, never derived/re-typed. */
  billingLabel: string;
}

export interface DisplayPrice {
  displayCurrency: Currency;
  monthly: DisplayPriceSpot;
  annual: DisplayPriceSpot;
  /** A decimal-free zero in the SAME currency the Pro card visibly shows —
   *  the display currency when an approximation is present, otherwise the
   *  USD billing currency (G-45-PRICING-CONSISTENCY). Never a different
   *  currency than the Pro figure next to it. */
  freePrice: string;
}

/**
 * Resolves the marketing Pro price for display: a home-currency
 * approximation (when resolvable) paired with the always-disclosed, fixed
 * USD billing amount. Resolution ladder: stored app currency preference
 * (read once on mount from the userProfile settings row, WITHOUT the
 * CAD getUserProfile default — a never-set visitor must fall through to
 * locale, not silently become CAD) → navigator.language locale inference →
 * USD fallback.
 *
 * Before the stored-currency read resolves and before the FX table loads,
 * this returns approx=null with the real billingLabel — first paint always
 * shows the true USD price, never a blank or a wrong-currency flash.
 */
export function useDisplayPrice(): DisplayPrice {
  const [storedCurrency, setStoredCurrency] = useState<Currency | null>(null);
  const fxTable = useFxRates();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await getSetting<UserProfile | null>(
        settingsKeys.userProfile,
        null,
        (p): p is UserProfile | null => p === null || isUserProfile(p),
      );
      if (cancelled) return;
      setStoredCurrency(profile?.currency ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  const languageTag = typeof navigator !== 'undefined' ? navigator.language : undefined;
  const displayCurrency = resolveDisplayCurrency(storedCurrency, languageTag);
  const monthlyApprox = formatApproxPrice(MONTHLY_PRICE_AMOUNT, BILLING_CURRENCY, displayCurrency, fxTable);

  return {
    displayCurrency,
    monthly: {
      approx: monthlyApprox,
      billingLabel: MONTHLY_PRICE_LABEL,
    },
    annual: {
      approx: formatApproxPrice(ANNUAL_PRICE_AMOUNT, BILLING_CURRENCY, displayCurrency, fxTable),
      billingLabel: ANNUAL_PRICE_LABEL,
    },
    // The Pro card shows the display currency when it has an approximation,
    // otherwise it falls back to the USD billing label — the Free card's
    // zero must always match whichever one is actually shown.
    freePrice: formatZeroPrice(monthlyApprox !== null ? displayCurrency : BILLING_CURRENCY),
  };
}
