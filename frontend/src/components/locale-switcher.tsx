"use client";

import { CheckIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

/**
 * Language switcher (Albanian / English). Persists the choice via the
 * `/api/locale` cookie route, then refreshes so both Server and Client
 * Components re-render in the chosen language.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const t = useT();
  const current = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const choose = async (locale: Locale) => {
    setOpen(false);
    if (locale === current) return;
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    startTransition(() => router.refresh());
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-label={t("switcher.ariaLabel")}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <GlobeAltIcon className="h-4 w-4 text-slate-400" />
        <span>{LOCALE_LABELS[current]}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {LOCALES.map((locale) => {
            const active = locale === current;
            return (
              <button
                key={locale}
                type="button"
                onClick={() => choose(locale)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                  active && "font-medium text-sky-700 dark:text-sky-300",
                )}
              >
                <span>{LOCALE_LABELS[locale]}</span>
                {active ? <CheckIcon className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
