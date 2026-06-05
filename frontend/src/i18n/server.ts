import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "./config";
import en from "./messages/en.json";
import sq from "./messages/sq.json";
import { makeT, mergeMessages, type Messages, type TranslateFn } from "./translate";

// Non-English locales layer their (possibly partial) catalog over English so a
// not-yet-translated key falls back to English rather than a raw key path.
const DICTIONARIES: Record<Locale, Messages> = {
  en: en as Messages,
  sq: mergeMessages(en as Messages, sq as Messages),
};

/** Reads the active locale from the cookie (defaults to Albanian). */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return normalizeLocale(value ?? DEFAULT_LOCALE);
}

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/**
 * Server-Component translator. Usage:
 *   const { t } = await getT();
 *   <h1>{t("invoices.title")}</h1>
 */
export async function getT(): Promise<{ locale: Locale; t: TranslateFn; messages: Messages }> {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return { locale, t: makeT(messages), messages };
}
