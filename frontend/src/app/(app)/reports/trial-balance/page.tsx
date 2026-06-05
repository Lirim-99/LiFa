import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { TrialBalanceReport } from "./trial-balance-report";

export const metadata: Metadata = { title: "Trial balance — LiFa" };

export default async function TrialBalancePage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("reports.trialBalance.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("reports.trialBalance.description")}
        </p>
      </div>
      <TrialBalanceReport />
    </div>
  );
}
