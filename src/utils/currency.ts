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

// Format a number as currency
export function formatCurrency(amount: number, currency: Currency): string {
  const config = CURRENCY_CONFIG[currency];
  if (!config) return `$${amount.toFixed(2)}`; // Fallback for unknown currency
  const formatted = amount.toFixed(config.decimalPlaces);
  return `${config.symbol}${formatted}`;
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

// Format distance with appropriate unit
export function formatDistance(distanceKm: number, currency: Currency): string {
  const unit = CURRENCY_CONFIG[currency].distanceUnit;
  if (unit === 'mi') {
    return `${kmToMiles(distanceKm).toFixed(1)} mi`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
