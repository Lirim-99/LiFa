import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { CreateCompanyForm } from "./create-company-form";

export const metadata: Metadata = { title: "New company — LiFa" };

export default async function NewCompanyPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("companies.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("companies.description")}</p>
      </div>
      <CreateCompanyForm />
    </div>
  );
}
