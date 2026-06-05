import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveCompanyId } from "@/lib/session";
import { serverFetch } from "@/lib/server-fetch";
import type { UserCompanyAccessSummary } from "@/lib/types";
import { getT } from "@/i18n/server";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings — LiFa" };

/**
 * Resolves the active company server-side. If the user has no companies, send
 * them to onboarding; if they have companies but no active one (first request
 * after register), fall back to the default.
 */
export default async function SettingsPage() {
  const { t } = await getT();
  const [cookieCompanyId, companies] = await Promise.all([
    getActiveCompanyId(),
    serverFetch<UserCompanyAccessSummary[]>("/users/me/companies"),
  ]);

  if (!companies || companies.length === 0) {
    redirect("/companies/new");
  }

  const activeId =
    cookieCompanyId && companies.some((c) => c.companyId === cookieCompanyId)
      ? cookieCompanyId
      : (companies.find((c) => c.isDefault) ?? companies[0]).companyId;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("settings.description")}
        </p>
      </div>
      <SettingsClient companyId={activeId} />
    </div>
  );
}
