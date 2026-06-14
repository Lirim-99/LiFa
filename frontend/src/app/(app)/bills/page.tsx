import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { BillsClient } from "./bills-client";

export const metadata: Metadata = { title: "Bills — LiFa" };

export default async function BillsPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("bills.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("bills.description")}</p>
      </div>
      <BillsClient />
    </div>
  );
}
