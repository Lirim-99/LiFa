import { Logo } from "@/components/ui/logo";
import { getActiveCompanyId } from "@/lib/session";
import { serverFetch } from "@/lib/server-fetch";
import type { UserCompanyAccessSummary } from "@/lib/types";
import { CompanySwitcher } from "./company-switcher";
import { UserMenu } from "./user-menu";

interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Server Component — loads the user's profile, their companies, and the
 * active-company cookie at request time so everything renders with real data
 * on first paint (no client-side flash).
 */
export async function AppHeader() {
  const [companies, activeCompanyId, me] = await Promise.all([
    serverFetch<UserCompanyAccessSummary[]>("/users/me/companies"),
    getActiveCompanyId(),
    serverFetch<MeResponse>("/users/me"),
  ]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/85 px-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex items-center gap-4">
        <Logo />
        <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        <CompanySwitcher companies={companies ?? []} activeCompanyId={activeCompanyId ?? null} />
      </div>
      <UserMenu
        firstName={me?.firstName ?? ""}
        lastName={me?.lastName ?? ""}
        email={me?.email ?? ""}
      />
    </header>
  );
}
