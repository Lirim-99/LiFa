import type { Metadata } from "next";
import { BalanceSheetReport } from "./balance-sheet-report";

export const metadata: Metadata = { title: "Balance sheet — LiFa" };

export default function BalanceSheetPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Balance sheet</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Assets, liabilities and equity as of a date. Must satisfy A = L + E.
        </p>
      </div>
      <BalanceSheetReport />
    </div>
  );
}
