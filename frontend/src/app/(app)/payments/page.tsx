import type { Metadata } from "next";
import { PaymentsClient } from "./payments-client";

export const metadata: Metadata = { title: "Payments — LiFa" };

export default function PaymentsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Record incoming payments. Every payment must be fully allocated to one or more invoices —
          the system posts the journal entry automatically.
        </p>
      </div>
      <PaymentsClient />
    </div>
  );
}
