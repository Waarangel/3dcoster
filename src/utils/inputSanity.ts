/**
 * Plausibility checks for settings inputs whose natural human entry differs
 * from the unit the field stores — a misentry there silently wrecks the cost
 * math (e.g. an electricity rate typed in cents lands 100× too high).
 *
 * These return a non-blocking warning string (or null). They never change the
 * value — the user might genuinely be an edge case — they only nudge.
 *
 * Thresholds are deliberately well ABOVE any real-world value, so a warning
 * means "almost certainly a unit mistake", not "unusual but possible".
 */

/** Residential electricity is ~$0.05–$0.40/kWh worldwide; >$1 is a cents-as-dollars misentry. */
export const ELECTRICITY_RATE_MAX_PLAUSIBLE = 1; // currency units per kWh

/** Pump fuel tops out around $2.50/L; >$5 means cents (e.g. Canada shows 150.9¢/L) typed as dollars. */
export const FUEL_PRICE_MAX_PLAUSIBLE_PER_LITRE = 5; // currency units per litre

/** Per-gallon fuel tops out around $6/gal; >$20 is a misentry. */
export const FUEL_PRICE_MAX_PLAUSIBLE_PER_GALLON = 20; // currency units per gallon

/** A printer's service life is thousands of print-hours; <100 looks like years were entered. */
export const PRINTER_LIFESPAN_MIN_PLAUSIBLE_HOURS = 100;

/** Warns when a per-kWh electricity rate looks like cents typed into a dollars field. */
export function electricityRateWarning(costPerKwh: number, currencySymbol: string): string | null {
  if (costPerKwh > ELECTRICITY_RATE_MAX_PLAUSIBLE) {
    return `That's high for a per-kWh rate — most are ${currencySymbol}0.05–${currencySymbol}0.30. Did you mean cents? Enter ${currencySymbol}0.15 for 15¢.`;
  }
  return null;
}

/** Warns when a fuel price looks like cents typed into a per-litre/gallon dollars field. */
export function fuelPriceWarning(price: number, fuelUnit: string, currencySymbol: string): string | null {
  const max =
    fuelUnit === 'gal' ? FUEL_PRICE_MAX_PLAUSIBLE_PER_GALLON : FUEL_PRICE_MAX_PLAUSIBLE_PER_LITRE;
  if (price > max) {
    return `That's high for a price per ${fuelUnit}. Did you mean cents? Enter ${currencySymbol}1.50, not 150.`;
  }
  return null;
}

/** Warns when a printer lifespan looks like years rather than print-hours. */
export function printerLifespanWarning(hours: number): string | null {
  if (hours > 0 && hours < PRINTER_LIFESPAN_MIN_PLAUSIBLE_HOURS) {
    return 'That looks like years, not hours. Enter the print-hours of service life (e.g. 5000).';
  }
  return null;
}
