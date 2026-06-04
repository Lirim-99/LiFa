import type { Metadata } from "next";
import { TaxRatesClient } from "./tax-rates-client";

export const metadata: Metadata = { title: "Tax rates — LiFa" };

export default function TaxRatesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tax rates</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Per-company VAT rates. New companies start with copies of the Kosovo template rates
          (Standard 18%, Reduced 8%, Zero/Exempt 0%).
        </p>
      </div>
      <TaxRatesClient />
    </div>
  );
}
