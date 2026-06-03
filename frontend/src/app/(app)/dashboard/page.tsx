import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { serverFetch } from "@/lib/server-fetch";
import type { UserCompanyAccessSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard — LiFa" };

export default async function DashboardPage() {
  const companies = await serverFetch<UserCompanyAccessSummary[]>("/users/me/companies");
  if (!companies || companies.length === 0) {
    redirect("/companies/new");
  }

  const active = companies.find((c) => c.isDefault) ?? companies[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Active company:{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {active.tradeName ?? active.legalName}
          </span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
          <CardDescription>
            FE-3 brings contacts, catalog, tax rates, and the chart of accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>FE-3 — Contacts, Catalog, Tax rates, Chart of accounts</li>
            <li>FE-4 — Invoices, Payments, Journal entries, Periods</li>
            <li>
              FE-5 — Trial balance / GL / P&amp;L / Balance sheet / AR aging, Audit log, Users
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
