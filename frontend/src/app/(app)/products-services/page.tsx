import type { Metadata } from "next";
import { CatalogClient } from "./catalog-client";

export const metadata: Metadata = { title: "Products & Services — LiFa" };

export default function CatalogPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products & services</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Catalog items that can be used on invoice lines.
        </p>
      </div>
      <CatalogClient />
    </div>
  );
}
