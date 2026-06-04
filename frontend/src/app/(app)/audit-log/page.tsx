import type { Metadata } from "next";
import { AuditLogClient } from "./audit-log-client";

export const metadata: Metadata = { title: "Audit log — LiFa" };

export default function AuditLogPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Append-only record of critical actions: company / account changes, invoice &amp; payment
          lifecycle, user access changes.
        </p>
      </div>
      <AuditLogClient />
    </div>
  );
}
