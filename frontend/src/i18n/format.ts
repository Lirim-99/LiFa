import { INTL_LOCALE, type Locale } from "./config";

/**
 * Locale-aware formatting helpers. Currency defaults to EUR (Kosovo's
 * currency); pass a different ISO code per company when needed.
 */

export function formatCurrency(value: number, locale: Locale, currency = "EUR"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
  }).format(value);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

export function formatDate(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "2-digit" },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(date);
}
