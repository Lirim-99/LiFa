import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { AccountsClient } from "./accounts-client";

export const metadata: Metadata = { title: "Chart of accounts — LiFa" };

export default async function AccountsPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("accounts.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("accounts.description")}</p>
      </div>
      <AccountsClient />
    </div>
  );
}
