import type { Metadata } from "next";
import { InvoicesClient } from "./invoices-client";

export const metadata: Metadata = { title: "Invoices — LiFa" };

export default function InvoicesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales invoices</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Draft → Issued (numbered, journal posted) → Paid → Void. Issuing is
          transactional — if the journal entry fails, the invoice stays draft.
        </p>
      </div>
      <InvoicesClient />
    </div>
  );
}
