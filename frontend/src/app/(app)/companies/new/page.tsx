import type { Metadata } from "next";
import { CreateCompanyForm } from "./create-company-form";

export const metadata: Metadata = { title: "New company — LiFa" };

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create a company</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Every transaction lives under a company. You can add more later from the company switcher
          in the header.
        </p>
      </div>
      <CreateCompanyForm />
    </div>
  );
}
