import type { Metadata } from "next";
import { JournalEntriesClient } from "./journal-entries-client";

export const metadata: Metadata = { title: "Journal entries — LiFa" };

export default function JournalEntriesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Journal entries</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manual accountant adjustments + system-generated entries from invoices & payments. Posted
          entries are immutable; correct via reversal.
        </p>
      </div>
      <JournalEntriesClient />
    </div>
  );
}
