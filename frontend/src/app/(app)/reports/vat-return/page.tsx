import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { VatReturnReport } from "./vat-return-report";

export const metadata: Metadata = { title: "VAT return — LiFa" };

export default async function VatReturnPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reports.vatReturn.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("reports.vatReturn.description")}
        </p>
      </div>
      <VatReturnReport />
    </div>
  );
}
