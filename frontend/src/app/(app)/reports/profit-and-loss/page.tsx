import type { Metadata } from "next";
import { ProfitAndLossReport } from "./profit-and-loss-report";

export const metadata: Metadata = { title: "Profit & loss — LiFa" };

export default function ProfitAndLossPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; loss</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Revenue minus expenses over the selected range.
        </p>
      </div>
      <ProfitAndLossReport />
    </div>
  );
}
