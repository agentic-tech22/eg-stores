/**
 * Pure, client-safe currency helpers (no server imports). The active currency
 * is stored once on the single `business_profile` row; this module only knows
 * how to list/resolve currencies. The server-only reader lives in
 * `currency.server.ts` so client components can import the constants here
 * without pulling in the Supabase server client.
 */

export interface CurrencyConfig {
  code: string;
  locale: string;
}

export const DEFAULT_CURRENCY_CODE = "NPR";

/** Selectable currencies. `locale` drives Intl number/symbol formatting. */
export const CURRENCIES: { code: string; label: string; locale: string }[] = [
  { code: "NPR", label: "Nepalese Rupee (रू)", locale: "en-NP" },
  { code: "INR", label: "Indian Rupee (₹)", locale: "en-IN" },
  { code: "USD", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", locale: "en-IE" },
  { code: "GBP", label: "British Pound (£)", locale: "en-GB" },
  { code: "AUD", label: "Australian Dollar (A$)", locale: "en-AU" },
  { code: "CAD", label: "Canadian Dollar (C$)", locale: "en-CA" },
  { code: "AED", label: "UAE Dirham (د.إ)", locale: "en-AE" },
  { code: "SGD", label: "Singapore Dollar (S$)", locale: "en-SG" },
  { code: "JPY", label: "Japanese Yen (¥)", locale: "ja-JP" },
];

/** Map a currency code to its `{ code, locale }`, falling back to the default. */
export function resolveCurrency(code: string | null | undefined): CurrencyConfig {
  const match =
    CURRENCIES.find((c) => c.code === code) ??
    CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY_CODE)!;
  return { code: match.code, locale: match.locale };
}
