import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { CreditNotesClient } from "./credit-notes-client";

export const metadata: Metadata = { title: "Credit Notes — LiFa" };

export default async function CreditNotesPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("creditNotes.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("creditNotes.description")}
        </p>
      </div>
      <CreditNotesClient />
    </div>
  );
}
