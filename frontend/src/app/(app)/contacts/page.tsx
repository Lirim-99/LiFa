import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ContactsClient } from "./contacts-client";

export const metadata: Metadata = { title: "Contacts — LiFa" };

export default async function ContactsPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("contacts.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("contacts.description")}</p>
      </div>
      <ContactsClient />
    </div>
  );
}
