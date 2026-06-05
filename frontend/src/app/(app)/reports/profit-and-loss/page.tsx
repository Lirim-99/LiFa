import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ProfitAndLossReport } from "./profit-and-loss-report";

export const metadata: Metadata = { title: "Profit & loss — LiFa" };

export default async function ProfitAndLossPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("reports.profitAndLoss.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("reports.profitAndLoss.description")}
        </p>
      </div>
      <ProfitAndLossReport />
    </div>
  );
}
