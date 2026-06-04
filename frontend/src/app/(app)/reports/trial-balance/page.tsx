import type { Metadata } from "next";
import { TrialBalanceReport } from "./trial-balance-report";

export const metadata: Metadata = { title: "Trial balance — LiFa" };

export default function TrialBalancePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trial balance</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Per-account debit/credit totals from posted journal entries. Must balance.
        </p>
      </div>
      <TrialBalanceReport />
    </div>
  );
}
