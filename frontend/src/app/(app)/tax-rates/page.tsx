import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { TaxRatesClient } from "./tax-rates-client";

export const metadata: Metadata = { title: "Tax rates — LiFa" };

export default async function TaxRatesPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("tax.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("tax.description")}</p>
      </div>
      <TaxRatesClient />
    </div>
  );
}
