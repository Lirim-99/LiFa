import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveCompanyId } from "@/lib/session";
import { serverFetch } from "@/lib/server-fetch";
import type { UserCompanyAccessSummary } from "@/lib/types";
import { UsersClient } from "./users-client";

export const metadata: Metadata = { title: "Users — LiFa" };

export default async function UsersPage() {
  const [cookieCompanyId, companies] = await Promise.all([
    getActiveCompanyId(),
    serverFetch<UserCompanyAccessSummary[]>("/users/me/companies"),
  ]);

  if (!companies || companies.length === 0) redirect("/companies/new");

  const activeId =
    cookieCompanyId && companies.some((c) => c.companyId === cookieCompanyId)
      ? cookieCompanyId
      : (companies.find((c) => c.isDefault) ?? companies[0]).companyId;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          People with access to this company. Owners can invite, change roles, or revoke access. You
          can&apos;t remove yourself or the last owner.
        </p>
      </div>
      <UsersClient companyId={activeId} />
    </div>
  );
}
