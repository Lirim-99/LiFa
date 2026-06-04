import type { Metadata } from "next";
import { GeneralLedgerReport } from "./general-ledger-report";

export const metadata: Metadata = { title: "General ledger — LiFa" };

export default function GeneralLedgerPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General ledger</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Posted journal lines for one account in date order, with a running balance.
        </p>
      </div>
      <GeneralLedgerReport />
    </div>
  );
}
