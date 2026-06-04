import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/server-fetch";
import type { UserCompanyAccessSummary } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "Dashboard — LiFa" };

export default async function DashboardPage() {
  const [companies, me] = await Promise.all([
    serverFetch<UserCompanyAccessSummary[]>("/users/me/companies"),
    serverFetch<{ id: string; firstName: string; lastName: string; email: string }>("/users/me"),
  ]);
  if (!companies || companies.length === 0) redirect("/companies/new");

  const active = companies.find((c) => c.isDefault) ?? companies[0];
  const firstName = me?.firstName ?? "there";

  return <DashboardClient firstName={firstName} companyName={active.tradeName ?? active.legalName} />;
}
