import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ArAgingReport } from "./ar-aging-report";

export const metadata: Metadata = { title: "AR aging — LiFa" };

export default async function ArAgingPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reports.arAging.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("reports.arAging.description")}
        </p>
      </div>
      <ArAgingReport />
    </div>
  );
}
