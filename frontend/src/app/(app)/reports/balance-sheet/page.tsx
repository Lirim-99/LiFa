import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { BalanceSheetReport } from "./balance-sheet-report";

export const metadata: Metadata = { title: "Balance sheet — LiFa" };

export default async function BalanceSheetPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("reports.balanceSheet.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("reports.balanceSheet.description")}
        </p>
      </div>
      <BalanceSheetReport />
    </div>
  );
}
