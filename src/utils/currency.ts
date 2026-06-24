import type { Currency } from '../types';

// Distance unit type
export type DistanceUnit = 'km' | 'mi';

// Currency configuration with symbols, countries, and measurement preferences
export const CURRENCY_CONFIG: Record<Currency, {
  name: string;
  symbol: string;
  country: string;
  countryName: string;
  decimalPlaces: number;
  distanceUnit: DistanceUnit;
  fuelUnit: string; // L or gal
}> = {
  CAD: { name: 'Canadian Dollar', symbol: '$', country: 'CA', countryName: 'Canada', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  USD: { name: 'US Dollar', symbol: '$', country: 'US', countryName: 'United States', decimalPlaces: 2, distanceUnit: 'mi', fuelUnit: 'gal' },
  EUR: { name: 'Euro', symbol: '€', country: 'EU', countryName: 'European Union', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  GBP: { name: 'British Pound', symbol: '£', country: 'GB', countryName: 'United Kingdom', decimalPlaces: 2, distanceUnit: 'mi', fuelUnit: 'L' },
  AUD: { name: 'Australian Dollar', symbol: '$', country: 'AU', countryName: 'Australia', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  NZD: { name: 'New Zealand Dollar', symbol: '$', country: 'NZ', countryName: 'New Zealand', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  CHF: { name: 'Swiss Franc', symbol: 'Fr', country: 'CH', countryName: 'Switzerland', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  SEK: { name: 'Swedish Krona', symbol: 'kr', country: 'SE', countryName: 'Sweden', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  NOK: { name: 'Norwegian Krone', symbol: 'kr', country: 'NO', countryName: 'Norway', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  DKK: { name: 'Danish Krone', symbol: 'kr', country: 'DK', countryName: 'Denmark', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  PLN: { name: 'Polish Złoty', symbol: 'zł', country: 'PL', countryName: 'Poland', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  CZK: { name: 'Czech Koruna', symbol: 'Kč', country: 'CZ', countryName: 'Czech Republic', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  JPY: { name: 'Japanese Yen', symbol: '¥', country: 'JP', countryName: 'Japan', decimalPlaces: 0, distanceUnit: 'km', fuelUnit: 'L' },
  CNY: { name: 'Chinese Yuan', symbol: '¥', country: 'CN', countryName: 'China', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  INR: { name: 'Indian Rupee', symbol: '₹', country: 'IN', countryName: 'India', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  BRL: { name: 'Brazilian Real', symbol: 'R$', country: 'BR', countryName: 'Brazil', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  MXN: { name: 'Mexican Peso', symbol: '$', country: 'MX', countryName: 'Mexico', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
  ZAR: { name: 'South African Rand', symbol: 'R', country: 'ZA', countryName: 'South Africa', decimalPlaces: 2, distanceUnit: 'km', fuelUnit: 'L' },
};

// Format a number as currency.
//
// The numeric portion goes through Intl.NumberFormat so it gains locale-correct
// digit grouping (e.g. "1,234.50") instead of a bare "1234.50". The currency
// SYMBOL, decimal-place count, and sign ordering stay curated here on purpose —
// we don't use Intl's `style: 'currency'`, which would override our chosen
// symbols (e.g. render CHF as "CHF" not "Fr", or USD/CAD as "US$"/"CA$") and
// move the symbol position. Keeping them explicit preserves the exact look of
// PDF quotes across all 18 currencies.
//
// `locale` is the i18n seam: today it defaults to en-US (period decimal, comma
// grouping), but it's a separate axis from `currency` so a future locale layer
// can pass e.g. 'de-DE' to get "1.234,50" without touching call sites. Language
// (currency) and locale (number format) are intentionally decoupled.
//
// Examples:
//   formatCurrency(15.5, 'USD')      → "$15.50"
//   formatCurrency(1234.5, 'EUR')    → "€1,234.50"
//   formatCurrency(100, 'JPY')       → "¥100"        (0 decimal places)
//   formatCurrency(-15.5, 'USD')     → "-$15.50"     (sign before symbol)
export function formatCurrency(amount: number, currency: Currency, locale: string = 'en-US'): string {
  const config = CURRENCY_CONFIG[currency];
  if (!config) return `$${amount.toFixed(2)}`; // Fallback for unknown currency
  // Sign before symbol: "-$15.50", never "$-15.50". A value that rounds to
  // zero at the currency's precision (e.g. -0.001) must not show a stray "-".
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: config.decimalPlaces,
    maximumFractionDigits: config.decimalPlaces,
  }).format(abs);
  // Compute zero-ness from the number, not the grouped string (which Number()
  // can't parse once it contains separators).
  const roundsToZero = Number(abs.toFixed(config.decimalPlaces)) === 0;
  const sign = amount < 0 && !roundsToZero ? '-' : '';
  return `${sign}${config.symbol}${formatted}`;
}

// Get just the symbol for a currency
export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_CONFIG[currency].symbol;
}

// Get distance unit for a currency/region
export function getDistanceUnit(currency: Currency): DistanceUnit {
  return CURRENCY_CONFIG[currency].distanceUnit;
}

// Get fuel unit for a currency/region (L or gal)
export function getFuelUnit(currency: Currency): string {
  return CURRENCY_CONFIG[currency].fuelUnit;
}

// Convert km to miles (1 km = 0.621371 miles)
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

// Convert miles to km (1 mile = 1.60934 km)
export function milesToKm(miles: number): number {
  return miles * 1.60934;
}

// Convert L/100km to MPG (US) - note: inverse relationship
// L/100km to MPG: 235.215 / (L/100km)
export function litersPer100KmToMpg(lPer100km: number): number {
  if (lPer100km <= 0) return 0;
  return 235.215 / lPer100km;
}

// Convert MPG (US) to L/100km
export function mpgToLitersPer100Km(mpg: number): number {
  if (mpg <= 0) return 0;
  return 235.215 / mpg;
}

// Fuel price is stored canonically as price-per-litre (gasPricePerLiter); the
// dropoff cost math is metric-internal. US users enter/read it per US gallon, so
// the Settings field converts at the display/input seam — exactly like the
// km↔mi and L/100km↔MPG fields next to it. 1 US liquid gallon = 3.785411784 L.
export const LITERS_PER_US_GALLON = 3.785411784;

// Canonical seeded fuel price (per litre). Lives here with the fuel-unit
// helpers so the default and the per-gallon display conversion share one home.
// A USD user still sitting on this default never entered a per-gallon value, so
// it's the signal we use to suppress the one-time "re-check your fuel price"
// notice for untouched configs.
export const DEFAULT_GAS_PRICE_PER_LITER = 1.5;

// Stored per-litre price → per-(US)-gallon value to display.
export function pricePerLiterToPerGallon(perLiter: number): number {
  return perLiter * LITERS_PER_US_GALLON;
}

// Per-(US)-gallon entry → per-litre value to store.
export function pricePerGallonToPerLiter(perGallon: number): number {
  return perGallon / LITERS_PER_US_GALLON;
}

// Format distance with appropriate unit
export function formatDistance(distanceKm: number, currency: Currency): string {
  const unit = CURRENCY_CONFIG[currency].distanceUnit;
  if (unit === 'mi') {
    return `${kmToMiles(distanceKm).toFixed(1)} mi`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
