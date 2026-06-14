import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ApAgingReport } from "./ap-aging-report";

export const metadata: Metadata = { title: "AP aging — LiFa" };

export default async function ApAgingPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reports.apAging.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("reports.apAging.description")}
        </p>
      </div>
      <ApAgingReport />
    </div>
  );
}
