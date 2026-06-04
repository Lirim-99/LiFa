import type { Metadata } from "next";
import { AccountsClient } from "./accounts-client";

export const metadata: Metadata = { title: "Chart of accounts — LiFa" };

export default function AccountsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chart of accounts</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          New companies start with a default chart. System accounts (AR, Cash, Bank, VAT Payable,
          Sales Revenue, Retained Earnings) cannot be deactivated.
        </p>
      </div>
      <AccountsClient />
    </div>
  );
}
