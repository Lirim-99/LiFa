import type { Metadata } from "next";
import { ContactsClient } from "./contacts-client";

export const metadata: Metadata = { title: "Contacts — LiFa" };

export default function ContactsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Customers, vendors, or both. Deactivated contacts are hidden by default.
        </p>
      </div>
      <ContactsClient />
    </div>
  );
}
