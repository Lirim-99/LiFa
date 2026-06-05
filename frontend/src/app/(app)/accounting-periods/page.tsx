import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { PeriodsClient } from "./periods-client";

export const metadata: Metadata = { title: "Accounting periods — LiFa" };

export default async function PeriodsPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("periods.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("periods.description")}</p>
      </div>
      <PeriodsClient />
    </div>
  );
}
