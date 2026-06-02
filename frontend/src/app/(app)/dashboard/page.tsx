import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard — LiFa" };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          You're signed in. The rest of the UI lands across the next frontend steps.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
          <CardDescription>
            FE-2 adds company creation + switcher, then contacts, invoices, payments,
            and reports follow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>FE-2 — Company onboarding + switcher + settings</li>
            <li>FE-3 — Contacts, Catalog, Tax rates, Chart of accounts</li>
            <li>FE-4 — Invoices, Payments, Journal entries, Periods</li>
            <li>FE-5 — Trial balance / GL / P&L / Balance sheet / AR aging, Audit log, Users</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
