"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { makeT, type Messages, type TranslateFn } from "./translate";

interface LocaleContextValue {
  locale: Locale;
  t: TranslateFn;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Provides the active locale + its dictionary to Client Components. Fed by the
 * root layout (which reads the cookie server-side), so only the active locale's
 * messages are serialized into the client payload.
 */
export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: makeT(messages) }),
    [locale, messages],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT/useLocale must be used within <LocaleProvider>");
  return ctx;
}

/** Returns the `t(key, vars?)` translator for the active locale. */
export function useT(): TranslateFn {
  return useLocaleContext().t;
}

/** Returns the active locale code ("sq" | "en"). */
export function useLocale(): Locale {
  return useLocaleContext().locale;
}
