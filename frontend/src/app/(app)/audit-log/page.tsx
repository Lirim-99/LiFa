import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { AuditLogClient } from "./audit-log-client";

export const metadata: Metadata = { title: "Audit log — LiFa" };

export default async function AuditLogPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("audit.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("audit.description")}</p>
      </div>
      <AuditLogClient />
    </div>
  );
}
