import type { Metadata } from "next";
import { PeriodsClient } from "./periods-client";

export const metadata: Metadata = { title: "Accounting periods — LiFa" };

export default function PeriodsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounting periods</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          12 monthly periods per fiscal year. Closed periods reject new postings;
          reopen them if you need to amend.
        </p>
      </div>
      <PeriodsClient />
    </div>
  );
}
