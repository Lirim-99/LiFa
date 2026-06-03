import { getActiveCompanyId } from "@/lib/session";
import { serverFetch } from "@/lib/server-fetch";
import type { UserCompanyAccessSummary } from "@/lib/types";
import { CompanySwitcher } from "./company-switcher";
import { UserMenu } from "./user-menu";

/**
 * Server Component — loads the user's companies + active id at request time
 * so the switcher renders with real data on first paint (no flash).
 */
export async function AppHeader() {
  const [companies, activeCompanyId] = await Promise.all([
    serverFetch<UserCompanyAccessSummary[]>("/users/me/companies"),
    getActiveCompanyId(),
  ]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-4">
        <span className="text-base font-semibold tracking-tight">LiFa</span>
        <CompanySwitcher companies={companies ?? []} activeCompanyId={activeCompanyId ?? null} />
      </div>
      <UserMenu />
    </header>
  );
}
