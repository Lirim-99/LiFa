import type { Metadata } from "next";
import { ArAgingReport } from "./ar-aging-report";

export const metadata: Metadata = { title: "AR aging — LiFa" };

export default function ArAgingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts receivable aging</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Outstanding invoice balances bucketed by age vs. due date, grouped by customer.
        </p>
      </div>
      <ArAgingReport />
    </div>
  );
}
