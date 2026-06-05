"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/client";
import type { Messages } from "@/i18n/translate";

/**
 * Wraps the tree in a single QueryClient created lazily so each browser session
 * gets its own cache. Server-rendered pages don't share this instance. Also
 * provides the active locale + dictionary (resolved server-side in the root
 * layout) to Client Components via LocaleProvider.
 */
export function Providers({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Don't retry 4xx — they're application-level rejections, not flakes.
              if (error instanceof Error && /^4\d\d/.test(error.message)) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <LocaleProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" ? (
          <ReactQueryDevtools initialIsOpen={false} />
        ) : null}
      </QueryClientProvider>
    </LocaleProvider>
  );
}
