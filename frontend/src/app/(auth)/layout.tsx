import type { ReactNode } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/ui/logo";
import { getT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="absolute right-4 top-4 z-20">
        <LocaleSwitcher />
      </div>
      {/* Decorative gradient blobs — subtle, never above z-0. */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-sky-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-300/15 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="text-lg" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("auth.tagline")}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
